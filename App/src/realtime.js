// =====================================================
// Odinote — sesiones en vivo (window.OdiRealtime)
//
// Dos personas trabajando sobre el mismo lienzo. Firebase se usa SOLO para
// que se encuentren: cada uno deja ahí su dirección de red, se leen, y a
// partir de ese momento hablan directamente entre sus dos ordenadores. Ni el
// texto de una nota ni un dibujo pasan por ningún servidor.
//
// La forma es de estrella: quien abre la sala es el centro y los demás se
// conectan a él, que reparte a los otros. Con dos o seis personas es lo más
// simple que funciona, y deja UNA copia buena —la del anfitrión— que es la
// que se guarda en el disco y en su Drive.
//
// Mensajes que viajan por el canal:
//   { t:'ops',      ops:[...] }        cambios del lienzo (ver src/sync.js)
//   { t:'cursor',   x, y, lienzo }     dónde tiene el ratón
//   { t:'quienes',  lista:[...] }      quién hay y de qué color (lo manda el anfitrión)
//   { t:'proyecto', canvases, raiz }   el volcado inicial para quien entra
//   { t:'adios' }
// =====================================================
(function () {
  'use strict';

  const SERVIDORES_HIELO = [
    // STUN público de Google: solo sirve para que cada uno averigüe su propia
    // dirección pública. No ve ni un byte de lo que se envía después.
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  // Colores de cursor. El anfitrión los reparte por orden de llegada, así que
  // una misma persona es del mismo color para TODOS los que están en la sala:
  // eso permite decir "el cursor azul" por voz y que se entienda.
  const COLORES = [
    '#90B968', '#3D5A80', '#E6544F', '#955BA5',
    '#D88040', '#3CA59E', '#DDAF2C', '#E58AB8',
  ];

  const ALFABETO = '23456789BCDFGHJKLMNPQRSTVWXYZ';   // sin vocales ni letras que se confundan
  function nuevoCodigo(largo) {
    const n = largo || 6;
    let out = '';
    const bytes = new Uint8Array(n);
    (window.crypto || window.msCrypto).getRandomValues(bytes);
    for (let i = 0; i < n; i++) out += ALFABETO[bytes[i] % ALFABETO.length];
    return out;
  }

  function disponible() {
    return typeof window !== 'undefined' &&
           typeof window.firebase !== 'undefined' &&
           !!window.firebase.firestore &&
           typeof RTCPeerConnection !== 'undefined';
  }

  // Cada participante necesita un identificador. Si ya inició sesión con
  // Google se usa esa; si no, una sesión anónima — que no le pide cuenta a
  // nadie y es lo que permite invitar a alguien sin cuenta de Google.
  async function identifica() {
    const auth = window.firebase.auth();
    if (auth.currentUser) return auth.currentUser.uid;
    const cred = await auth.signInAnonymously();
    return (cred && cred.user && cred.user.uid) || auth.currentUser.uid;
  }

  // ── Una conexión con otra persona ──
  function creaPar({ db, sala, miUid, otroUid, esAnfitrion, onCanal, onEstado }) {
    const pc = new RTCPeerConnection({ iceServers: SERVIDORES_HIELO });
    const senales = db.collection('salas').doc(sala).collection('senales');

    pc.onicecandidate = (ev) => {
      if (!ev.candidate) return;
      senales.add({
        de: miUid, para: otroUid, tipo: 'candidato',
        carga: JSON.stringify(ev.candidate.toJSON()),
        creadaEn: Date.now(),
      }).catch(() => {});
    };

    pc.onconnectionstatechange = () => {
      onEstado && onEstado(otroUid, pc.connectionState);
    };

    if (esAnfitrion) {
      // El invitado abre el canal; el anfitrión lo recibe.
      pc.ondatachannel = (ev) => onCanal(ev.channel);
    } else {
      const canal = pc.createDataChannel('odinote', { ordered: true });
      onCanal(canal);
    }

    return pc;
  }

  // ── Sesión (vale para el anfitrión y para el invitado) ──
  function creaSesion({ db, miUid, codigo, esAnfitrion, yo, callbacks }) {
    const cb = callbacks || {};
    const pares = new Map();      // uid -> { pc, canal }
    const roster = new Map();     // uid -> { uid, nombre, color, anfitrion }
    let cerrada = false;
    const desuscribir = [];

    function anota(uid, datos) {
      if (!roster.has(uid)) {
        roster.set(uid, {
          uid,
          nombre: (datos && datos.nombre) || 'Invitado',
          color: COLORES[roster.size % COLORES.length],
          anfitrion: !!(datos && datos.anfitrion),
        });
      } else if (datos && datos.nombre) {
        roster.get(uid).nombre = datos.nombre;
      }
      return roster.get(uid);
    }

    function lista() { return [...roster.values()]; }

    function enviaA(uid, mensaje) {
      const p = pares.get(uid);
      if (!p || !p.canal || p.canal.readyState !== 'open') return false;
      try { p.canal.send(JSON.stringify(mensaje)); return true; } catch (e) { return false; }
    }

    function envia(mensaje, excepto) {
      let n = 0;
      pares.forEach((_, uid) => { if (uid !== excepto && enviaA(uid, mensaje)) n++; });
      return n;
    }

    function recibe(deUid, texto) {
      let m;
      try { m = JSON.parse(texto); } catch (e) { return; }
      if (!m || !m.t) return;

      // El anfitrión es el centro: lo que le llega de uno se lo pasa a los
      // demás. Sin esto, con tres personas cada uno solo vería al anfitrión.
      if (esAnfitrion && (m.t === 'ops' || m.t === 'cursor')) {
        envia({ ...m, de: deUid }, deUid);
      }
      cb.onMensaje && cb.onMensaje(m, m.de || deUid);
    }

    function preparaCanal(uid, canal) {
      const par = pares.get(uid) || {};
      par.canal = canal;
      pares.set(uid, par);

      canal.onopen = () => {
        cb.onEstado && cb.onEstado('conectado', uid);
        if (esAnfitrion) {
          // Quien entra recibe primero la foto completa del proyecto y luego
          // ya solo los cambios.
          const foto = cb.pideProyecto && cb.pideProyecto();
          if (foto) enviaA(uid, { t: 'proyecto', ...foto });
          envia({ t: 'quienes', lista: lista() }, null);
          cb.onParticipantes && cb.onParticipantes(lista());
        } else {
          enviaA(uid, { t: 'hola', nombre: yo.nombre });
        }
      };
      canal.onmessage = (ev) => recibe(uid, ev.data);
      canal.onclose = () => {
        pares.delete(uid);
        roster.delete(uid);
        cb.onEstado && cb.onEstado('desconectado', uid);
        if (esAnfitrion) {
          envia({ t: 'quienes', lista: lista() }, null);
          cb.onParticipantes && cb.onParticipantes(lista());
        }
      };
    }

    // ── Señales de Firestore ──
    const senales = db.collection('salas').doc(codigo).collection('senales');

    async function limpiaMisSenales() {
      try {
        const mias = await senales.where('de', '==', miUid).get();
        const lote = db.batch();
        mias.forEach(d => lote.delete(d.ref));
        await lote.commit();
      } catch (e) {}
    }

    function escuchaSenales() {
      const off = senales.where('para', '==', miUid).onSnapshot(async (snap) => {
        for (const cambio of snap.docChanges()) {
          if (cambio.type !== 'added' || cerrada) continue;
          const d = cambio.doc.data();
          try { await manejaSenal(d); } catch (e) { console.warn('[SALA] señal ignorada', e); }
          cambio.doc.ref.delete().catch(() => {});
        }
      }, (err) => {
        cb.onError && cb.onError(err);
      });
      desuscribir.push(off);
    }

    async function manejaSenal(d) {
      const otro = d.de;

      if (d.tipo === 'oferta' && esAnfitrion) {
        anota(otro, {});
        const pc = creaPar({ db, sala: codigo, miUid, otroUid: otro, esAnfitrion: true,
          onCanal: (c) => preparaCanal(otro, c),
          onEstado: (uid, est) => cb.onEstado && cb.onEstado(est, uid) });
        pares.set(otro, { ...(pares.get(otro) || {}), pc });
        await pc.setRemoteDescription(JSON.parse(d.carga));
        const respuesta = await pc.createAnswer();
        await pc.setLocalDescription(respuesta);
        await senales.add({
          de: miUid, para: otro, tipo: 'respuesta',
          carga: JSON.stringify({ type: respuesta.type, sdp: respuesta.sdp }),
          creadaEn: Date.now(),
        });
        return;
      }

      if (d.tipo === 'respuesta' && !esAnfitrion) {
        const par = pares.get(otro);
        if (par && par.pc) await par.pc.setRemoteDescription(JSON.parse(d.carga));
        return;
      }

      if (d.tipo === 'candidato') {
        const par = pares.get(otro);
        if (par && par.pc) {
          try { await par.pc.addIceCandidate(JSON.parse(d.carga)); } catch (e) {}
        }
      }
    }

    async function arrancaComoInvitado(uidAnfitrion) {
      anota(uidAnfitrion, { anfitrion: true });
      const pc = creaPar({ db, sala: codigo, miUid, otroUid: uidAnfitrion, esAnfitrion: false,
        onCanal: (c) => preparaCanal(uidAnfitrion, c),
        onEstado: (uid, est) => cb.onEstado && cb.onEstado(est, uid) });
      // Conservando lo que ya hubiera: quien invita crea el canal DENTRO de
      // creaPar, o sea que preparaCanal ya ha guardado el canal aquí antes de
      // llegar a esta línea. Escribir `{ pc }` a secas lo borraba, y entonces
      // el invitado recibía todo pero no podía enviar nada — el otro lado
      // nunca veía sus cambios ni su cursor.
      pares.set(uidAnfitrion, { ...(pares.get(uidAnfitrion) || {}), pc });
      const oferta = await pc.createOffer();
      await pc.setLocalDescription(oferta);
      await senales.add({
        de: miUid, para: uidAnfitrion, tipo: 'oferta',
        carga: JSON.stringify({ type: oferta.type, sdp: oferta.sdp }),
        creadaEn: Date.now(),
      });
    }

    async function cierra() {
      if (cerrada) return;
      cerrada = true;
      envia({ t: 'adios' }, null);
      pares.forEach(p => { try { p.canal && p.canal.close(); } catch (e) {} try { p.pc && p.pc.close(); } catch (e) {} });
      pares.clear();
      roster.clear();
      desuscribir.forEach(f => { try { f(); } catch (e) {} });
      await limpiaMisSenales();
      if (esAnfitrion) {
        try { await db.collection('salas').doc(codigo).delete(); } catch (e) {}
      }
      cb.onEstado && cb.onEstado('cerrada', null);
    }

    return {
      codigo, miUid, esAnfitrion,
      escuchaSenales, arrancaComoInvitado, anota, lista,
      envia, enviaA, cierra,
      cuantos: () => pares.size,
      // Para poder decir qué está pasando cuando alguien reporta que "no le
      // llega nada": dice si el canal con cada persona está realmente abierto.
      diagnostico: () => [...pares.entries()].map(([uid, p]) => ({
        uid,
        canal: p.canal ? p.canal.readyState : 'sin canal',
        conexion: p.pc ? p.pc.connectionState : 'sin conexión',
      })),
    };
  }

  // ── API pública ──
  async function abreSala({ nombre, callbacks }) {
    if (!disponible()) throw new Error('sin-soporte');
    const db = window.firebase.firestore();
    const miUid = await identifica();
    const codigo = nuevoCodigo(6);

    await db.collection('salas').doc(codigo).set({
      anfitrion: miUid,
      creadaEn: Date.now(),
      version: 1,
    });

    const sesion = creaSesion({
      db, miUid, codigo, esAnfitrion: true,
      yo: { nombre: nombre || 'Anfitrión' },
      callbacks,
    });
    sesion.anota(miUid, { nombre: nombre || 'Anfitrión', anfitrion: true });
    sesion.escuchaSenales();
    callbacks && callbacks.onParticipantes && callbacks.onParticipantes(sesion.lista());
    return sesion;
  }

  async function entraSala({ codigo, nombre, callbacks }) {
    if (!disponible()) throw new Error('sin-soporte');
    const db = window.firebase.firestore();
    const miUid = await identifica();
    const limpio = String(codigo || '').trim().toUpperCase();

    const doc = await db.collection('salas').doc(limpio).get();
    if (!doc.exists) throw new Error('sala-no-existe');
    const uidAnfitrion = doc.data().anfitrion;
    if (uidAnfitrion === miUid) throw new Error('es-tu-propia-sala');

    const sesion = creaSesion({
      db, miUid, codigo: limpio, esAnfitrion: false,
      yo: { nombre: nombre || 'Invitado' },
      callbacks,
    });
    sesion.anota(miUid, { nombre: nombre || 'Invitado' });
    sesion.escuchaSenales();
    await sesion.arrancaComoInvitado(uidAnfitrion);
    return sesion;
  }

  const OdiRealtime = { disponible, abreSala, entraSala, nuevoCodigo, COLORES, SERVIDORES_HIELO };
  if (typeof window !== 'undefined') window.OdiRealtime = OdiRealtime;
  if (typeof module !== 'undefined' && module.exports) module.exports = OdiRealtime;
})();
