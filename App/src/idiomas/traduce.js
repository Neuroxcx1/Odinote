// =====================================================
// Oddinote — los otros nueve idiomas (window.odiTraduce)
//
// El texto de la interfaz está escrito en el código como
// window.t('en español', 'in English'). Hasta ahora, quien elegía francés o
// coreano veía esas frases en inglés: la aplicación ofrecía once idiomas y de
// verdad hablaba dos. Aquí están los otros nueve sin tocar esas llamadas:
//
//  · frases.js (generado por scripts/saca-frases.js --escribe): todas las
//    frases del código, cada una con su número, [español, inglés]. Solo se
//    añaden al final, nunca se quitan ni se reordenan: el número es la clave.
//  · fr.js, de.js, it.js, pt.js, zh.js, ja.js, ko.js, ar.js, ru.js: la
//    traducción de cada número.
//  · window.t (data.js) pregunta aquí antes que a nada cuando el idioma no es
//    español ni inglés.
//
// Las frases con partes que cambian (`Plantilla puesta: ${nombre}`) se
// guardan con {0}, {1}… en el orden del INGLÉS: lo que se pone en esos huecos
// sale de la frase en inglés que llega a window.t (el nombre de una plantilla
// en inglés le dice más a un francés que en español).
//
// La prueba: scripts/test-idiomas.js (que no falte ninguna frase, que cada
// traducción tenga sus huecos).
// =====================================================
(function () {
  const raiz = typeof window !== 'undefined' ? window : globalThis;
  raiz.ODI_IDIOMAS = raiz.ODI_IDIOMAS || {};

  let indice = null;      // español → número, para las frases fijas
  let plantillas = null;  // las de huecos, con su patrón en las dos lenguas

  const aPatron = (texto) => {
    const trozos = String(texto).split(/\{\d+\}/);
    const escapa = (t) => t.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&');
    return new RegExp('^' + trozos.map(escapa).join('([\\s\\S]*?)') + '$');
  };

  function prepara() {
    indice = new Map();
    plantillas = [];
    (raiz.ODI_FRASES || []).forEach((par, i) => {
      if (!par) return;
      const es = par[0], en = par[1];
      if (/\{\d+\}/.test(es) || /\{\d+\}/.test(en)) {
        const huecosEn = (String(en).match(/\{(\d+)\}/g) || []).map(h => +h.slice(1, -1));
        plantillas.push({ i, es: aPatron(es), en: aPatron(en), huecosEn });
      } else if (!indice.has(es)) {
        indice.set(es, i);
      }
    });
  }

  function traduce(idioma, es, en) {
    const dic = raiz.ODI_IDIOMAS[idioma];
    if (!dic || typeof es !== 'string') return null;
    if (!indice) prepara();
    const i = indice.get(es);
    if (i != null) return dic[i] || null;
    for (const p of plantillas) {
      if (!p.es.test(es)) continue;
      const tr = dic[p.i];
      if (!tr) return null;
      // Los valores, sacados de la frase en inglés (ver arriba); si no casa,
      // de la española.
      const me = typeof en === 'string' ? p.en.exec(en) : null;
      let valores;
      if (me) {
        valores = [];
        p.huecosEn.forEach((n, k) => { valores[n] = me[k + 1]; });
      } else {
        valores = p.es.exec(es).slice(1);
      }
      return tr.replace(/\{(\d+)\}/g, (_, k) => (valores[k] != null ? valores[k] : ''));
    }
    return null;
  }

  // Si se añaden frases con la app abierta (pruebas), que se vuelva a mirar.
  traduce.olvida = () => { indice = null; plantillas = null; };
  raiz.odiTraduce = traduce;
  if (typeof module !== 'undefined' && module.exports) module.exports = { traduce };
})();
