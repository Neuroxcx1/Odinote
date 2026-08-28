// =====================================================
// Odinote — sesiones en vivo (window.OdiRealtime)
//
// Dos personas trabajando sobre el mismo lienzo. Firebase se usa SOLO para
// que se encuentren: cada uno deja ahí su dirección de red, se leen, y a
// partir de ese momento hablan directamente entre sus dos computadores. Ni el
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
//   { t:'hola',     nombre }           quien entra dice cómo se llama
//   { t:'quienes',  lista:[...] }      quién hay, de qué color y con qué papel
//   { t:'proyecto', canvases, raiz }   el volcado inicial para quien entra
//   { t:'expulsado' }                  el anfitrión te ha sacado de la sala
//   { t:'adios' }
// =====================================================
(function () {
  'use strict';

  const SERVIDORES_HIELO = [
    // STUN público de Google: solo sirve para que cada uno averigüe su propia
    // dirección pública. No ve ni un byte de lo que se envía después.
    //
    // Van cinco y no dos: cuando uno de ellos no contesta —pasa, y en móvil
    // más—, el navegador se queda sin dirección pública que ofrecer y la
    // conexión muere sin que nadie sepa por qué. Preguntar a varios cuesta
    // cuatro paquetes de nada y quita ese punto de fallo.
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ];

  // Papeles dentro de una sala. Los reparte quien la abrió.
  //
  //   editor — puede tocar el lienzo; sus cambios se aplican y se reparten.
  //   lector — lo ve todo y ve los cursores, pero no cambia nada.
  //
  // La palabra final la tiene SIEMPRE el equipo del anfitrión: aunque alguien
  // trucara su copia del programa para mandar cambios siendo lector, ahí se
  // tiran antes de aplicarse y antes de repartirse a los demás.
  const ROLES = ['editor', 'lector'];

  // ¿Puede esta persona tocar el lienzo?
  //
  // Vive aquí fuera, suelta, para poder probarla sin montar media conexión de
  // red. Quien no está en la lista NO puede: es el caso de alguien recién
  // expulsado cuyo último mensaje llega cuando ya se le ha cerrado la puerta.
  function puedeEditar(ficha) {
    if (!ficha) return false;
    if (ficha.anfitrion) return true;
    return ficha.rol !== 'lector';
  }

  // Pone los papeles del apretón de manos en el orden en que se escribieron y
  // marca como rancias las ofertas viejas de quien mandó más de una.
  //
  // Firestore los entrega sin orden. Atender primero una oferta vieja y
  // después la buena abría una conexión, la mataba con la siguiente, y dejaba
  // la respuesta correcta viajando hacia algo que ya no existía: desde el otro
  // lado se veía como si nadie hubiera contestado nunca.
  function ordenaYFiltra(papeles) {
    const orden = (papeles || []).slice().sort((a, b) => (a.creadaEn || 0) - (b.creadaEn || 0));
    const ultima = new Map();
    orden.forEach(p => { if (p.tipo === 'oferta') ultima.set(p.de, p.id); });
    return orden.map(p => ({ ...p, rancia: p.tipo === 'oferta' && ultima.get(p.de) !== p.id }));
  }

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
  function creaPar({ db, sala, miUid, otroUid, esAnfitrion, etiqueta, onCanal, onEstado }) {
    const pc = new RTCPeerConnection({ iceServers: SERVIDORES_HIELO });
    const senales = db.collection('salas').doc(sala).collection('senales');

    pc.onicecandidate = (ev) => {
      if (!ev.candidate) return;
      senales.add({
        de: miUid, para: otroUid, tipo: 'candidato',
        // La etiqueta del intento viaja DENTRO del papel, junto a la
        // dirección. Así el otro lado sabe si esta dirección es de la
        // conversación que tiene abierta ahora o de una de hace diez minutos.
        carga: JSON.stringify({ ...ev.candidate.toJSON(), intento: (etiqueta && etiqueta()) || null }),
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
    const pendientes = new Map(); // uid -> candidatos que llegaron antes de tiempo
    const roster = new Map();     // uid -> { uid, nombre, color, anfitrion, rol }
    const vetados = new Set();    // uid -> expulsados, no se les vuelve a abrir
    // Etiqueta del intento de conexión que está vivo con cada persona. Sirve
    // para distinguir los papeles de ESTA conversación de los que quedaron
    // tirados de un intento anterior (ver «Papeles rancios» más abajo).
    const intentoDe = new Map();  // uid -> etiqueta del intento en curso
    const ofertaDe = new Map();   // uid -> cuándo se escribió su última oferta
    let miIntento = null;         // la etiqueta de MI intento (siendo invitado)
    // Qué papel recibe quien entre a partir de ahora. Lo cambia el anfitrión
    // antes de dar el código, para invitar a alguien ya como lector.
    let rolNuevos = 'editor';
    let cerrada = false;
    const desuscribir = [];

    function anota(uid, datos) {
      if (!roster.has(uid)) {
        roster.set(uid, {
          uid,
          nombre: (datos && datos.nombre) || 'Invitado',
          color: COLORES[roster.size % COLORES.length],
          anfitrion: !!(datos && datos.anfitrion),
          // Quien abre la sala edita siempre; a los demás les toca el papel
          // que el anfitrión tenga puesto en ese momento.
          rol: (datos && datos.anfitrion) ? 'editor' : ((datos && datos.rol) || rolNuevos),
        });
      } else {
        const r = roster.get(uid);
        if (datos && datos.nombre) r.nombre = datos.nombre;
        if (datos && datos.rol) r.rol = datos.rol;
      }
      return roster.get(uid);
    }

    function lista() { return [...roster.values()]; }
    function rolDe(uid) {
      const r = roster.get(uid);
      return (r && r.rol) || 'editor';
    }

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

      if (esAnfitrion) {
        // Un lector no escribe, y eso se decide AQUÍ.
        //
        // Poner el candado solo en la pantalla del otro no es un candado: el
        // programa es de código abierto y su copia hace lo que él quiera. En
        // el equipo del anfitrión, en cambio, es la última palabra: si sus
        // cambios no se aplican ni se reparten, no han pasado.
        if (m.t === 'ops' && !puedeEditar(roster.get(deUid))) return;

        // Quien entra dice cómo se llama. Antes este mensaje se recibía y no
        // se hacía nada con él, así que en la lista de la sala TODOS eran
        // "Invitado" y no había forma de saber a quién se le estaba dando
        // permiso de editar ni a quién se estaba expulsando.
        if (m.t === 'hola') {
          anota(deUid, { nombre: m.nombre });
          envia({ t: 'quienes', lista: lista() }, null);
          cb.onParticipantes && cb.onParticipantes(lista());
        }

        // El anfitrión es el centro: lo que le llega de uno se lo pasa a los
        // demás. Sin esto, con tres personas cada uno solo vería al anfitrión.
        if (m.t === 'ops' || m.t === 'cursor') envia({ ...m, de: deUid }, deUid);
      } else if (m.t === 'quienes') {
        // El invitado también guarda la lista, para poder preguntar por su
        // propio papel sin depender de quién la esté pintando.
        roster.clear();
        (m.lista || []).forEach(p => roster.set(p.uid, p));
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
        // Solo si el canal que se cierra sigue siendo el de esta persona.
        //
        // Al volver a entrar con el mismo código se abre una conexión nueva
        // mientras la vieja aún agoniza; cuando la vieja se cerraba, este
        // aviso llegaba tarde y borraba la ENTRADA NUEVA. A partir de ahí el
        // anfitrión no podía mandarle nada: ni el proyecto ni los cambios. La
        // persona veía "conectado con éxito", se quedaba en su propio lienzo,
        // y todo lo que tocaba se perdía. Era el mismo fallo detrás de los dos
        // síntomas.
        const actual = pares.get(uid);
        if (!actual || actual.canal !== canal) return;
        pares.delete(uid);
        roster.delete(uid);
        cb.onEstado && cb.onEstado('desconectado', uid);
        if (esAnfitrion) {
          envia({ t: 'quienes', lista: lista() }, null);
          cb.onParticipantes && cb.onParticipantes(lista());
        }
      };
    }

    // ── Lo que puede hacer quien abrió la sala ──
    //
    // Estas tres cosas solo tienen efecto en el equipo del anfitrión. Si las
    // llama un invitado no pasa nada: no es que su botón esté escondido, es
    // que no hay tal botón.

    function ponRol(uid, rol) {
      if (!esAnfitrion || ROLES.indexOf(rol) < 0) return false;
      const r = roster.get(uid);
      if (!r || r.anfitrion) return false;
      r.rol = rol;
      envia({ t: 'quienes', lista: lista() }, null);
      cb.onParticipantes && cb.onParticipantes(lista());
      return true;
    }

    // El papel con el que entrará el PRÓXIMO que llegue. Se decide antes de
    // dar el código, que es cuando uno sabe a quién se lo está dando.
    function ponRolNuevos(rol) {
      if (!esAnfitrion || ROLES.indexOf(rol) < 0) return false;
      rolNuevos = rol;
      return true;
    }

    async function expulsa(uid) {
      if (!esAnfitrion) return false;
      const r = roster.get(uid);
      if (!r || r.anfitrion) return false;
      // Se le avisa ANTES de cortar y se le da un respiro para que el aviso
      // salga por el cable. Cerrar el canal en el mismo instante deja a la
      // otra persona mirando un lienzo que de pronto no se actualiza, sin
      // saber si la han echado o se le ha caído el wifi.
      vetados.add(uid);
      enviaA(uid, { t: 'expulsado' });
      await new Promise(sigue => setTimeout(sigue, 200));
      const p = pares.get(uid);
      if (p) {
        try { p.canal && p.canal.close(); } catch (e) {}
        try { p.pc && p.pc.close(); } catch (e) {}
      }
      pares.delete(uid);
      pendientes.delete(uid);
      intentoDe.delete(uid);
      roster.delete(uid);
      envia({ t: 'quienes', lista: lista() }, null);
      cb.onParticipantes && cb.onParticipantes(lista());
      return true;
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

    // Papeles ya atendidos, para no repetirlos cuando el repaso los vuelva a ver.
    const atendidas = new Set();
    const intentos = new Map();   // id -> cuántas veces se ha intentado
    const enCurso = new Set();    // ids que se están atendiendo ahora mismo

    // Papeles de intentos ANTERIORES, tirados antes de empezar.
    //
    // Una respuesta vieja aplicada a una conexión nueva revienta ("wrong
    // state"), y como ahora los fallos se reintentan, se quedaba dando vueltas
    // para siempre y arrastraba con ella a la respuesta buena. Cada intento
    // empieza con la mesa limpia.
    async function tiraLoViejo() {
      try {
        const q = await senales.where('para', '==', miUid).get();
        if (q.empty) return;
        const lote = db.batch();
        q.forEach(d => lote.delete(d.ref));
        await lote.commit();
      } catch (e) {}
    }

    async function atiende(doc) {
      if (cerrada || atendidas.has(doc.id) || enCurso.has(doc.id)) return;
      // Se aparta ANTES de empezar, no después.
      //
      // El aviso en vivo y el repaso periódico pueden ver el mismo papel casi
      // a la vez. Marcándolo solo al terminar, los dos pasaban el control y lo
      // atendían por duplicado: dos ofertas contestadas, dos conexiones
      // abiertas para la misma persona, la segunda matando a la primera, y la
      // respuesta buena llegando a una conexión que ya estaba cerrada
      // ("wrong state: stable"). De ahí que volver a entrar nunca funcionara.
      enCurso.add(doc.id);
      try {
        await manejaSenal(doc.data());
      } catch (e) {
        enCurso.delete(doc.id);
        // Tres intentos y a la basura: un papel que nunca se puede atender
        // (una respuesta de otra conexión, por ejemplo) no puede quedarse
        // atascando la cola de los que sí sirven.
        const n = (intentos.get(doc.id) || 0) + 1;
        intentos.set(doc.id, n);
        if (n >= 3) {
          console.warn('[SALA] señal descartada tras 3 intentos', e);
          atendidas.add(doc.id);
          doc.ref.delete().catch(() => {});
          return;
        }
        // Se deja el papel donde está: el repaso volverá a intentarlo.
        //
        // Antes se borraba pasara lo que pasara. Si la escritura de la
        // respuesta fallaba —y la conexión con Firebase se corta sola cada
        // tanto— la oferta desaparecía y nadie volvía a intentarlo nunca: el
        // invitado se quedaba esperando para siempre. Eso era exactamente lo
        // que pasaba al volver a entrar.
        console.warn('[SALA] no se pudo atender una señal, se reintentará', e);
        return;
      }
      atendidas.add(doc.id);
      doc.ref.delete().catch(() => {});
    }

    // Los papeles, en orden y sin las ofertas rancias (ver `ordenaYFiltra`).
    async function procesa(docs) {
      const porId = new Map();
      const fichas = docs.map(d => {
        porId.set(d.id, d);
        const dd = d.data() || {};
        return { id: d.id, tipo: dd.tipo, de: dd.de, creadaEn: dd.creadaEn };
      });
      for (const ficha of ordenaYFiltra(fichas)) {
        if (cerrada) return;
        const doc = porId.get(ficha.id);
        if (!doc) continue;
        if (ficha.rancia) {
          atendidas.add(doc.id);
          doc.ref.delete().catch(() => {});
          continue;
        }
        await atiende(doc);
      }
    }

    function escuchaSenales() {
      const off = senales.where('para', '==', miUid).onSnapshot(async (snap) => {
        const nuevos = [];
        snap.docChanges().forEach(cambio => {
          if (cambio.type === 'added') nuevos.push(cambio.doc);
        });
        if (nuevos.length) await procesa(nuevos);
      }, (err) => {
        cb.onError && cb.onError(err);
      });
      desuscribir.push(off);

      // Repaso periódico: red de seguridad para lo que el aviso en vivo no
      // trajo — porque falló al atenderlo, o porque la conexión con Firebase
      // se cayó y volvió sin avisar de lo ocurrido mientras tanto.
      //
      // Cada dos segundos y no cada cuatro: este repaso es lo que decide
      // cuánto tarda como MUCHO en atenderse una oferta, y ese retraso lo
      // paga entero quien está esperando a entrar.
      const repaso = setInterval(async () => {
        if (cerrada) return;
        try {
          const q = await senales.where('para', '==', miUid).get();
          await procesa(q.docs);
        } catch (e) {}
      }, 2000);
      desuscribir.push(() => clearInterval(repaso));
    }

    // ── Papeles rancios ──
    //
    // Los papeles del apretón de manos se borran al usarlos, pero el que los
    // recibe no siempre PUEDE borrarlos: las reglas de Firestore solo dejan
    // borrar lo que uno mismo escribió. Así que al segundo intento de entrar
    // en la misma sala, ahí seguían la oferta y la respuesta del primero.
    //
    // Y una respuesta vieja no da error: es una descripción de conexión
    // perfectamente válida, solo que de otra conversación. El navegador la
    // acepta, la da por buena, y luego las dos partes se pasan media hora
    // llamándose a direcciones que ya no contesta nadie. Desde el móvil eso se
    // ve como "la otra persona no respondió a tiempo" — y era mentira: había
    // respondido, pero se estaba atendiendo la respuesta equivocada.
    //
    // La cura es que cada intento lleve su etiqueta y todo lo que no la lleve
    // se tire sin mirarlo.
    function etiquetaDe(otro) {
      return esAnfitrion ? (intentoDe.get(otro) || null) : miIntento;
    }

    async function manejaSenal(d) {
      const otro = d.de;
      let carga;
      try { carga = JSON.parse(d.carga); } catch (e) { return; }
      if (!carga) return;

      if (d.tipo === 'oferta' && esAnfitrion) {
        if (vetados.has(otro)) return;   // expulsado: no se le vuelve a abrir
        // Una oferta anterior a la que ya se contestó es basura del pasado.
        const cuando = d.creadaEn || 0;
        if (cuando && (ofertaDe.get(otro) || 0) > cuando) return;
        ofertaDe.set(otro, cuando);
        intentoDe.set(otro, carga.intento || null);

        // Si esta persona ya tenía una conexión, se cierra antes de abrirle
        // otra. Dejar la vieja viva era lo que provocaba la carrera de arriba.
        const previo = pares.get(otro);
        if (previo) {
          try { previo.canal && previo.canal.close(); } catch (e) {}
          try { previo.pc && previo.pc.close(); } catch (e) {}
          pares.delete(otro);
          pendientes.delete(otro);
        }
        anota(otro, {});
        const pc = creaPar({ db, sala: codigo, miUid, otroUid: otro, esAnfitrion: true,
          etiqueta: () => etiquetaDe(otro),
          onCanal: (c) => preparaCanal(otro, c),
          onEstado: (uid, est) => cb.onEstado && cb.onEstado(est, uid) });
        pares.set(otro, { ...(pares.get(otro) || {}), pc });
        await pc.setRemoteDescription({ type: carga.type, sdp: carga.sdp });
        const respuesta = await pc.createAnswer();
        await pc.setLocalDescription(respuesta);
        await senales.add({
          de: miUid, para: otro, tipo: 'respuesta',
          // La respuesta vuelve con la MISMA etiqueta que traía la oferta: es
          // la única forma que tiene el otro de reconocerla como suya.
          carga: JSON.stringify({ type: respuesta.type, sdp: respuesta.sdp, intento: carga.intento || null }),
          creadaEn: Date.now(),
        });
        apunta(`contestada la oferta de ${String(otro).slice(0, 6)}`);
        // Ya hay descripción remota: los candidatos que se adelantaron entran.
        await sueltaPendientes(otro);
        return;
      }

      if (d.tipo === 'respuesta' && !esAnfitrion) {
        if (carga.intento && miIntento && carga.intento !== miIntento) return;
        const par = pares.get(otro);
        if (par && par.pc) {
          // Y ya contestada: una segunda respuesta encima de una conexión que
          // ya la tiene revienta con "wrong state" y se reintenta en balde.
          if (par.pc.remoteDescription) return;
          await par.pc.setRemoteDescription({ type: carga.type, sdp: carga.sdp });
          await sueltaPendientes(otro);
        }
        return;
      }

      if (d.tipo === 'candidato') {
        const mia = etiquetaDe(otro);
        if (carga.intento && mia && carga.intento !== mia) return;
        const limpio = { ...carga };
        delete limpio.intento;
        await agregaCandidato(otro, limpio);
      }
    }

    // ── Candidatos de red que llegan antes de tiempo ──
    //
    // Cada lado va anunciando por dónde se le puede alcanzar, y esos avisos
    // viajan por Firebase en paralelo con la oferta y la respuesta. Es normal
    // que alguno llegue ANTES de que este lado sepa con quién está hablando, y
    // el navegador los rechaza si todavía no hay descripción remota.
    //
    // Antes se descartaban en silencio. En la primera conexión daba igual
    // porque llegaban tarde y sobraban; al volver a entrar llegaban de golpe
    // y se perdían los buenos, así que la conexión moría en "failed" — y la
    // persona veía que entraba pero no pasaba nada. Ahora se guardan y se
    // entregan en cuanto hay a quién.
    async function agregaCandidato(uid, candidato) {
      const par = pares.get(uid);
      if (!par || !par.pc) {
        pendientes.set(uid, (pendientes.get(uid) || []).concat([candidato]));
        return;
      }
      if (!par.pc.remoteDescription) {
        pendientes.set(uid, (pendientes.get(uid) || []).concat([candidato]));
        return;
      }
      try { await par.pc.addIceCandidate(candidato); } catch (e) {}
    }

    async function sueltaPendientes(uid) {
      const cola = pendientes.get(uid);
      if (!cola || !cola.length) return;
      pendientes.delete(uid);
      const par = pares.get(uid);
      if (!par || !par.pc) return;
      for (const c of cola) {
        try { await par.pc.addIceCandidate(c); } catch (e) {}
      }
    }

    async function arrancaComoInvitado(uidAnfitrion) {
      anota(uidAnfitrion, { anfitrion: true });
      // Etiqueta nueva en cada intento: lo que conteste el anfitrión a partir
      // de ahora se reconoce por ella, y lo de antes se ignora.
      miIntento = nuevoCodigo(10);
      const pc = creaPar({ db, sala: codigo, miUid, otroUid: uidAnfitrion, esAnfitrion: false,
        etiqueta: () => miIntento,
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
        carga: JSON.stringify({ type: oferta.type, sdp: oferta.sdp, intento: miIntento }),
        creadaEn: Date.now(),
      });
    }

    // ¿Ha contestado ya el anfitrión? Es la frontera entre «no me ha oído» y
    // «me ha oído pero nuestras redes no se ven», que son dos averías
    // distintas y con soluciones distintas.
    function hayRespuesta() {
      return [...pares.values()].some(p => p.pc && p.pc.remoteDescription);
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
      escuchaSenales, arrancaComoInvitado, anota, lista, tiraLoViejo,
      limpiaMisSenales, hayRespuesta,
      envia, enviaA, cierra,
      // Papeles (solo hacen algo en el equipo del anfitrión)
      ponRol, ponRolNuevos, expulsa,
      rolNuevos: () => rolNuevos,
      rolDe,
      miRol: () => rolDe(miUid),
      cuantos: () => pares.size,
      // Para poder decir qué está pasando cuando alguien reporta que "no le
      // llega nada": dice si el canal con cada persona está realmente abierto.
      diagnostico: () => [...pares.entries()].map(([uid, p]) => ({
        uid,
        canal: p.canal ? p.canal.readyState : 'sin canal',
        conexion: p.pc ? p.pc.connectionState : 'sin conexión',
        // `connectionState` no existe en navegadores de móvil algo viejos, y
        // sin él un fallo de red no se detecta nunca: se agotaba el reloj.
        hielo: p.pc ? p.pc.iceConnectionState : 'sin conexión',
      })),
    };
  }

  // ── ¿Deja el navegador hablar con Firebase? ──
  //
  // Los bloqueadores de anuncios (el de Opera y Brave de serie, uBlock, y los
  // filtros de muchos routers) cortan firestore.googleapis.com por venir de un
  // dominio de Google. La aplicación entera funciona igual, pero las sesiones
  // en vivo no: es por ahí por donde los dos equipos se dicen dónde están.
  //
  // Sin esta comprobación el síntoma era desesperante — "conectando…" durante
  // veinticinco segundos y un fallo sin explicación — y no hay forma de que a
  // nadie se le ocurra que la culpa es de su bloqueador.
  async function compruebaPaso(db) {
    try {
      // Un nombre corriente: Firestore RESERVA los identificadores que empiezan
      // y acaban con doble guion bajo, y rechaza la consulta con
      // "invalid-argument" — que aquí se leía como "hay un bloqueador" y
      // acusaba al navegador de algo que no estaba haciendo.
      await db.collection('salas').doc('PRUEBADEPASO').get();
      return true;
    } catch (e) {
      // Solo cuenta como bloqueo lo que huele a red cortada. Un permiso
      // denegado o un argumento inválido son otra cosa y no deben confundirse.
      return !(e && (e.code === 'unavailable' || e.code === 'internal' ||
                     String(e.message || '').includes('network')));
    }
  }

  // Rastro de lo que va pasando al conectar.
  //
  // En un teléfono no hay devtools que abrir, así que cuando la página viene
  // del servidor de pruebas esto sale por la consola del PC (ver el buzón
  // /__log en dev-server.js y `window.odiRemoteLog` en touch.js). Es la
  // diferencia entre saber en qué paso se atasca y volver a "no funciona".
  function apunta(texto) {
    try {
      console.log('[SALA] ' + texto);
      if (typeof window !== 'undefined' && window.odiRemoteLog) window.odiRemoteLog('SALA', texto);
    } catch (e) {}
  }

  function resume(sesion) {
    try {
      return sesion.diagnostico()
        .map(p => `${p.uid.slice(0, 6)}: canal=${p.canal} conexión=${p.conexion} hielo=${p.hielo}`)
        .join(' | ') || 'sin nadie al otro lado';
    } catch (e) { return 'sin diagnóstico'; }
  }

  // Espera a que algo pase, con fecha de caducidad y con una salida rápida
  // para cuando ya se sabe que no va a pasar.
  //
  // Devuelve 'ok', 'roto' (la condición de fallo se cumplió) o 'tarde'. Nunca
  // lanza: quien llama decide qué significa cada final.
  function espera({ condicion, falla, limite, paso }) {
    return new Promise((termina) => {
      const desde = Date.now();
      const tic = setInterval(() => {
        let fin = null;
        try {
          if (condicion()) fin = 'ok';
          else if (falla && falla()) fin = 'roto';
          else if (Date.now() - desde >= limite) fin = 'tarde';
        } catch (e) { fin = 'roto'; }
        if (fin) { clearInterval(tic); termina(fin); }
      }, paso || 200);
    });
  }

  // ── API pública ──
  async function abreSala({ nombre, rol, callbacks }) {
    if (!disponible()) throw new Error('sin-soporte');
    const db = window.firebase.firestore();
    // La sesión PRIMERO: las reglas exigen estar identificado para leer nada,
    // así que comprobar el paso antes de eso daba "bloqueador" siempre, incluso
    // sin bloqueador ninguno.
    const miUid = await identifica();
    // Y ahora sí: un bloqueador de anuncios corta Firebase y las sesiones no
    // pueden ni empezar. Se detecta sin hacer esperar a nadie 25 segundos.
    if (!(await compruebaPaso(db))) throw new Error('bloqueador');
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
    if (rol) sesion.ponRolNuevos(rol);
    sesion.anota(miUid, { nombre: nombre || 'Anfitrión', anfitrion: true });
    // Mesa limpia: papeles de intentos anteriores fuera antes de escuchar.
    // Los dos sentidos, porque las reglas solo dejan borrar lo propio y lo que
    // más daño hace es justamente lo que uno mismo dejó escrito.
    await sesion.tiraLoViejo();
    await sesion.limpiaMisSenales();
    sesion.escuchaSenales();
    callbacks && callbacks.onParticipantes && callbacks.onParticipantes(sesion.lista());
    return sesion;
  }

  async function entraSala({ codigo, nombre, callbacks }) {
    if (!disponible()) throw new Error('sin-soporte');
    const db = window.firebase.firestore();
    // La sesión PRIMERO: las reglas exigen estar identificado para leer nada,
    // así que comprobar el paso antes de eso daba "bloqueador" siempre, incluso
    // sin bloqueador ninguno.
    const miUid = await identifica();
    // Y ahora sí: un bloqueador de anuncios corta Firebase y las sesiones no
    // pueden ni empezar. Se detecta sin hacer esperar a nadie 25 segundos.
    if (!(await compruebaPaso(db))) throw new Error('bloqueador');
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
    // Mesa limpia: papeles de intentos anteriores fuera antes de escuchar.
    //
    // `limpiaMisSenales` es la importante de las dos. Borra las ofertas que
    // este mismo aparato dejó en intentos anteriores, y son ELLAS las que
    // envenenaban el siguiente: el anfitrión podía atender la vieja, contestar
    // a una conexión que ya no existía, y dejar a este lado esperando una
    // respuesta que nunca iba a ser para él.
    await sesion.limpiaMisSenales();
    await sesion.tiraLoViejo();
    sesion.escuchaSenales();
    const avisa = (paso) => {
      try { callbacks && callbacks.onProgreso && callbacks.onProgreso(paso); } catch (e) {}
    };
    avisa('llamando');
    apunta(`entrando en ${limpio}; el anfitrión es ${String(uidAnfitrion).slice(0, 6)}`);
    await sesion.arrancaComoInvitado(uidAnfitrion);
    apunta('oferta escrita, esperando respuesta');

    // No se dice "conectado" hasta que el canal esté abierto de verdad, y la
    // espera va en DOS tramos con relojes cortos.
    //
    // Antes era uno solo de veinticinco segundos para todo. Daba igual que el
    // anfitrión no hubiera contestado nunca o que hubiera contestado y las dos
    // redes no se vieran: el mensaje era el mismo, no decía nada útil, y en un
    // móvil veinticinco segundos mirando "conectando…" no se distinguen de un
    // programa colgado. Ahora cada tramo tiene su reloj, su aviso en pantalla
    // y su explicación cuando se acaba.

    // Tramo 1: que el anfitrión conteste. Si tiene la sala abierta esto son
    // dos segundos; ocho es de sobra incluso yendo por el repaso periódico.
    avisa('esperando');
    if (await espera({ condicion: () => sesion.hayRespuesta(), limite: 8000 }) !== 'ok') {
      apunta('el anfitrión no contestó en 8s — ' + resume(sesion));
      await sesion.cierra();
      throw new Error('sin-respuesta');
    }
    apunta('respuesta recibida, enlazando redes');

    // Tramo 2: que las dos redes se encuentren. Aquí sí puede fallar de verdad
    // (routers que no dejan pasar, wifis de invitados que aíslan a sus
    // aparatos), y en cuanto el navegador lo da por perdido se corta: no hay
    // por qué esperar al reloj si la respuesta ya se sabe.
    avisa('enlazando');
    const enlace = await espera({
      condicion: () => sesion.diagnostico().some(p => p.canal === 'open'),
      falla: () => sesion.diagnostico().some(p => p.conexion === 'failed' || p.hielo === 'failed'),
      limite: 12000,
    });
    if (enlace !== 'ok') {
      apunta(`las redes no se enlazaron (${enlace}) — ` + resume(sesion));
      await sesion.cierra();
      throw new Error('no-se-pudo-conectar');
    }
    apunta('canal abierto: dentro');
    return sesion;
  }

  const OdiRealtime = {
    disponible, abreSala, entraSala, nuevoCodigo,
    ROLES, COLORES, SERVIDORES_HIELO,
    // Sueltas y comprobables desde `scripts/test-sala.js`.
    puedeEditar, ordenaYFiltra,
  };
  if (typeof window !== 'undefined') window.OdiRealtime = OdiRealtime;
  if (typeof module !== 'undefined' && module.exports) module.exports = OdiRealtime;
})();
