// =====================================================
// Odinote — modo instantáneo (window.OdiNube)
//
// Dos personas editando el mismo proyecto sin que ninguna tenga que estar de
// anfitrión. El contenido va y viene por Firestore; las imágenes y los audios
// NO — esos siguen en el Drive de quien comparte y aquí solo viaja su
// dirección, que es lo que mantiene el documento pequeño.
//
// Está apagado de fábrica y se enciende proyecto por proyecto: quien no lo
// encienda no manda ni un byte de contenido a ningún servidor.
//
// Lo delicado no es subir, es RECIBIR. La versión anterior de esto hacía
// `setCanvases(lo que llegó)`, y como el estado son todos los proyectos de una
// persona, un solo mensaje del otro lado borraba el resto. Aquí no se sustituye
// nunca: se calcula qué cambió al otro lado desde la última vez que miramos, y
// se aplica solo eso. Si tú mueves una nota y el otro escribe en otra, las dos
// sobreviven — es el mismo motor que usan las sesiones en vivo (src/sync.js).
//
// Sin React ni DOM: se prueba entero desde Node (scripts/test-nube.js).
// =====================================================
(function () {
  'use strict';

  function sync() {
    if (typeof window !== 'undefined' && window.OdiSync) return window.OdiSync;
    return require('./sync.js');
  }

  // Un documento de Firestore no puede pasar de 1 MiB. Se corta antes, con
  // sitio de sobra: pasarse no da un aviso suave, da un error que tiraría la
  // subida entera y dejaría a los dos lados desincronizados sin saberlo.
  const TOPE = 900 * 1024;

  // Los lienzos de UN proyecto: el suyo y los tableros que cuelgan de él.
  //
  // Que esto sea así de estricto es media razón de ser del módulo. Antes se
  // subía el estado entero —todos los proyectos, también los privados— dentro
  // del documento del que se estaba compartiendo, así que invitar a alguien a
  // un tablero le entregaba el resto del trabajo.
  function soloDelProyecto(canvases, raiz) {
    const out = {};
    if (!canvases || !raiz) return out;
    const visita = (id) => {
      const c = canvases[id];
      if (!c || out[id]) return;
      out[id] = c;
      (c.items || []).forEach(it => { if (it.canvasId) visita(it.canvasId); });
    };
    visita(raiz);
    return out;
  }

  function pesa(lienzos) {
    try { return JSON.stringify(lienzos || {}).length; } catch (e) { return Infinity; }
  }

  function cabe(lienzos) {
    return pesa(lienzos) <= TOPE;
  }

  // Quién puede entrar: el dueño y las cuentas a las que compartió la carpeta.
  // En minúsculas y sin repetidos, porque el correo del token de Google viene
  // en minúsculas y la comparación en las reglas es exacta.
  function correosDe(proyecto, correoDueno) {
    const lista = [];
    const mete = (c) => {
      const limpio = String(c || '').trim().toLowerCase();
      if (limpio && lista.indexOf(limpio) === -1) lista.push(limpio);
    };
    mete(correoDueno);
    ((proyecto && proyecto.collaborators) || []).forEach(col => mete(col && col.id));
    return lista;
  }

  // ── Recibir sin pisar ──
  //
  // `locales`      : TODOS mis lienzos (todos mis proyectos).
  // `ultimoRemoto` : la última foto del otro lado que ya apliqué, o null.
  // `remoto`       : la foto que acaba de llegar.
  //
  // Se compara remoto contra remoto, nunca contra lo mío: así salen los
  // cambios DEL OTRO y solo esos se aplican. Comparando contra lo mío, todo lo
  // que yo hubiera tocado y él todavía no tuviera saldría como "cambio suyo" y
  // se desharía solo.
  //
  // La primera vez no hay foto anterior. Ahí sí se compara contra la mía, que
  // es lo correcto al llegar a un proyecto: te pones al día con lo que hay.
  function fusiona({ locales, ultimoRemoto, remoto, raiz }) {
    const S = sync();
    const mios = locales || {};
    const base = ultimoRemoto || soloDelProyecto(mios, raiz);
    const ops = S.diff(base, remoto || {});
    if (!ops.length) return { ops, lienzos: mios, cambio: false };
    return { ops, lienzos: S.aplica(mios, ops), cambio: true };
  }

  // ¿Hay algo que subir? Se compara con lo último que quedó acordado —lo que
  // mandé o lo que recibí—, y no con la última subida a secas: sin eso, un
  // cambio que llega del otro lado rebotaría de vuelta hacia él para siempre.
  function hayQueSubir(lienzos, ultimoAcordado) {
    if (!ultimoAcordado) return true;
    return pesa(lienzos) !== pesa(ultimoAcordado) ||
           JSON.stringify(lienzos) !== JSON.stringify(ultimoAcordado);
  }

  const OdiNube = { TOPE, soloDelProyecto, pesa, cabe, correosDe, fusiona, hayQueSubir };
  if (typeof window !== 'undefined') window.OdiNube = OdiNube;
  if (typeof module !== 'undefined' && module.exports) module.exports = OdiNube;
})();
