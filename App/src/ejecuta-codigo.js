// =====================================================
// Oddinote — la terminal del nodo de código (window.OdiEjecuta)
//
// Ejecuta el JavaScript de un bloque de código y devuelve lo que imprime. Va
// en un Web Worker hecho al momento, y eso es lo que lo hace seguro de usar
// con código pegado de cualquier sitio (o de un tablero compartido):
//
//  · no ve la aplicación: ni la página, ni los proyectos, ni electronAPI;
//  · sin red: fetch, XMLHttpRequest, WebSocket y compañía se quitan antes de
//    empezar, así que no puede mandar nada a ningún sitio;
//  · con tiempo límite: un bucle infinito no congela nada (el worker va en su
//    propio hilo) y a los 5 segundos se para.
//
// Solo JavaScript: es lo que el navegador sabe ejecutar sin descargar nada.
// Lo de formatear valores (formatea) va suelto para poder probarlo con node:
// scripts/test-ejecuta-codigo.js.
// =====================================================
(function () {
  // Cómo se escribe un valor en la terminal, a lo console.log: el texto tal
  // cual, los objetos en una línea, sin colgarse con los que se contienen a sí
  // mismos ni con los enormes. Esta función viaja al worker como texto
  // (formatea.toString()), así que no puede usar nada de fuera de ella.
  function formatea(v, hondo) {
    const nivel = hondo || 0;
    const vistos = formatea._vistos || (formatea._vistos = []);
    const t = typeof v;
    if (v === null) return 'null';
    if (t === 'undefined') return 'undefined';
    if (t === 'string') return nivel ? JSON.stringify(v) : v;
    if (t === 'number') return Object.is(v, -0) ? '-0' : String(v);
    if (t === 'bigint') return String(v) + 'n';
    if (t === 'boolean' || t === 'symbol') return String(v);
    if (t === 'function') return '[Function' + (v.name ? ': ' + v.name : ' (anónima)') + ']';
    if (v instanceof Error) return (v.name || 'Error') + ': ' + v.message;
    if (v instanceof Date) return isNaN(v) ? 'Invalid Date' : v.toISOString();
    if (v instanceof RegExp) return String(v);
    if (vistos.indexOf(v) !== -1) return '[Circular]';
    if (nivel > 4) return Array.isArray(v) ? '[Array]' : '[Object]';
    vistos.push(v);
    try {
      if (Array.isArray(v)) {
        const max = 100;
        const partes = v.slice(0, max).map(x => formatea(x, nivel + 1));
        if (v.length > max) partes.push('… ' + (v.length - max) + ' más');
        return partes.length ? '[ ' + partes.join(', ') + ' ]' : '[]';
      }
      if (v instanceof Map) return 'Map(' + v.size + ') { ' + Array.from(v).slice(0, 50).map(([k, x]) => formatea(k, nivel + 1) + ' => ' + formatea(x, nivel + 1)).join(', ') + ' }';
      if (v instanceof Set) return 'Set(' + v.size + ') { ' + Array.from(v).slice(0, 50).map(x => formatea(x, nivel + 1)).join(', ') + ' }';
      const claves = Object.keys(v);
      const nombre = v.constructor && v.constructor.name && v.constructor.name !== 'Object' ? v.constructor.name + ' ' : '';
      if (!claves.length) return nombre + '{}';
      const partes = claves.slice(0, 50).map(k => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)) + ': ' + formatea(v[k], nivel + 1));
      if (claves.length > 50) partes.push('… ' + (claves.length - 50) + ' más');
      return nombre + '{ ' + partes.join(', ') + ' }';
    } finally {
      vistos.pop();
    }
  }

  // El error, con la línea del bloque donde pasó si la pila la trae.
  function describeError(err, desfase, palabra) {
    if (!err || typeof err !== 'object') return 'Error: ' + String(err);
    const base = (err.name || 'Error') + ': ' + (err.message || '');
    // La posición dentro del eval: «eval at … (…), <anonymous>:3:1)». Sin la
    // coma se colaba la línea del propio worker.
    const m = String(err.stack || '').match(/,\s*<anonymous>:(\d+):(\d+)\)/);
    if (!m) return base;
    const linea = Number(m[1]) - (desfase || 0);
    return linea > 0 ? base + ' (' + (palabra || 'línea') + ' ' + linea + ')' : base;
  }

  // Lo que corre dentro del worker. Se arma como texto: un worker no comparte
  // nada con la página, y así no hace falta otro archivo.
  function fuenteDelTrabajador() {
    return [
      '"use strict";',
      'const formatea = ' + formatea.toString() + ';',
      'const describeError = ' + describeError.toString() + ';',
      'const avisa = postMessage.bind(self);',
      // Sin red y sin más hilos: se quitan del global y de sus prototipos (si
      // no, se recuperarían con Object.getPrototypeOf(self).fetch).
      '(function () {',
      '  const fuera = ["fetch", "XMLHttpRequest", "WebSocket", "WebSocketStream", "EventSource", "importScripts", "Worker", "SharedWorker", "indexedDB", "caches", "BroadcastChannel", "WebTransport", "Request", "navigator"];',
      '  let o = self;',
      '  while (o) {',
      '    for (const k of fuera) {',
      '      if (o === self || Object.prototype.hasOwnProperty.call(o, k)) {',
      '        try { Object.defineProperty(o, k, { value: undefined, writable: false, configurable: false }); } catch (e) {}',
      '      }',
      '    }',
      '    o = Object.getPrototypeOf(o);',
      '  }',
      '})();',
      'const linea = (tipo, args) => avisa({ tipo, texto: Array.prototype.map.call(args, a => typeof a === "string" ? a : formatea(a)).join(" ") });',
      'const tiempos = {};',
      'const consola = {',
      '  log: function () { linea("log", arguments); },',
      '  info: function () { linea("info", arguments); },',
      '  debug: function () { linea("log", arguments); },',
      '  warn: function () { linea("warn", arguments); },',
      '  error: function () { linea("error", arguments); },',
      '  table: function () { linea("log", arguments); },',
      '  dir: function () { linea("log", arguments); },',
      '  clear: function () { avisa({ tipo: "limpia" }); },',
      '  time: function (n) { tiempos[n || "default"] = performance.now(); },',
      '  timeEnd: function (n) { const k = n || "default"; if (k in tiempos) { linea("log", [k + ": " + (performance.now() - tiempos[k]).toFixed(1) + " ms"]); delete tiempos[k]; } },',
      '  assert: function (c) { if (!c) linea("error", ["Assertion failed"].concat(Array.prototype.slice.call(arguments, 1))); },',
      '};',
      'Object.defineProperty(self, "console", { value: consola, writable: false, configurable: false });',
      'self.addEventListener("error", (e) => { e.preventDefault(); avisa({ tipo: "error", texto: describeError(e.error || { name: "Error", message: e.message }) }); });',
      'self.addEventListener("unhandledrejection", (e) => { e.preventDefault(); avisa({ tipo: "error", texto: "(promesa) " + describeError(e.reason) }); });',
      'self.onmessage = async (e) => {',
      '  const codigo = String(e.data && e.data.codigo || "");',
      '  const palabra = String(e.data && e.data.palabraLinea || "línea");',
      '  const t0 = performance.now();',
      '  let desfase = 0;',
      '  try {',
      '    let r;',
      '    try {',
      '      r = (0, eval)(codigo);',
      '    } catch (err) {',
      // «await» suelto fuera de una función: se envuelve en una async y se espera.
      '      if (err instanceof SyntaxError && /await/.test(err.message)) {',
      '        desfase = 1;',
      '        r = (0, eval)("(async () => {\\n" + codigo + "\\n})()");',
      '      } else { throw err; }',
      '    }',
      '    if (r && typeof r.then === "function") r = await r;',
      '    avisa({ tipo: "fin", hay: r !== undefined, resultado: r === undefined ? null : formatea(r, 1), ms: performance.now() - t0 });',
      '  } catch (err) {',
      '    avisa({ tipo: "error", texto: describeError(err, desfase, palabra) });',
      '    avisa({ tipo: "fin", hay: false, ms: performance.now() - t0, fallo: true });',
      '  }',
      '};',
    ].join('\n');
  }

  // Ejecuta y va contando. alLinea recibe { tipo, texto } según llegan.
  // Devuelve { para, hecho }: hecho se resuelve con { ms, resultado, motivo }.
  //
  // Lo que se programa para luego (setTimeout, promesas) también se ve: tras
  // terminar lo de arriba se espera un poco más, y cada línea nueva alarga la
  // espera. Hasta los 5 segundos en total, que es cuando se para seguro.
  const MS_MAX = 5000;
  const MS_GRACIA = 800;
  function ejecuta(codigo, alLinea, opciones) {
    const msMax = (opciones && opciones.msMax) || MS_MAX;
    const url = URL.createObjectURL(new Blob([fuenteDelTrabajador()], { type: 'text/javascript' }));
    const w = new Worker(url);
    let acabado = false, fin = null, gracia = null, tope = null;
    let resolver;
    const hecho = new Promise(r => { resolver = r; });
    const t0 = performance.now();
    const termina = (motivo) => {
      if (acabado) return;
      acabado = true;
      clearTimeout(gracia); clearTimeout(tope);
      try { w.terminate(); } catch (e) {}
      URL.revokeObjectURL(url);
      resolver({ motivo, ms: fin ? fin.ms : performance.now() - t0, resultado: fin && fin.hay ? fin.resultado : null, hay: !!(fin && fin.hay), fallo: !!(fin && fin.fallo) });
    };
    const esperaUnPoco = () => { clearTimeout(gracia); gracia = setTimeout(() => termina('fin'), MS_GRACIA); };
    w.onmessage = (e) => {
      const d = e.data || {};
      if (acabado) return;
      if (d.tipo === 'fin') { fin = d; esperaUnPoco(); return; }
      if (d.tipo === 'limpia' || d.tipo === 'log' || d.tipo === 'info' || d.tipo === 'warn' || d.tipo === 'error') {
        alLinea && alLinea({ tipo: d.tipo, texto: String(d.texto == null ? '' : d.texto).slice(0, 20000) });
        if (fin) esperaUnPoco();
      }
    };
    w.onerror = (e) => {
      e.preventDefault && e.preventDefault();
      alLinea && alLinea({ tipo: 'error', texto: e.message || 'Error' });
    };
    tope = setTimeout(() => termina(fin ? 'fin' : 'tiempo'), msMax);
    w.postMessage({ codigo: String(codigo || ''), palabraLinea: (opciones && opciones.palabraLinea) || 'línea' });
    return { para: () => termina('parado'), hecho };
  }

  const OdiEjecuta = { formatea, describeError, fuenteDelTrabajador, ejecuta, MS_MAX };
  if (typeof window !== 'undefined') window.OdiEjecuta = OdiEjecuta;
  if (typeof module !== 'undefined' && module.exports) module.exports = OdiEjecuta;
})();
