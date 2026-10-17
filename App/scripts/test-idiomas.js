// Los otros nueve idiomas (src/idiomas/).  node scripts/test-idiomas.js
//
// Que no se vuelva a lo de antes —once idiomas en el menú y dos de verdad—:
// toda frase del código tiene que estar en frases.js, y cada idioma tiene que
// traducirlas todas, con sus huecos {0}, {1}… intactos.
const fs = require('fs');
const path = require('path');
const { catalogo } = require('./saca-frases.js');

let fallos = 0;
const check = (nombre, ok, extra) => {
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${extra !== undefined && extra !== '' ? ' — ' + extra : ''}`);
  if (!ok) fallos++;
};

const DIR = path.join(__dirname, '..', 'src', 'idiomas');
const caja = {};
new Function('window', fs.readFileSync(path.join(DIR, 'frases.js'), 'utf8'))(caja);
const frases = caja.ODI_FRASES || [];
const IDIOMAS = ['fr', 'de', 'it', 'pt', 'zh', 'ja', 'ko', 'ar', 'ru'];
IDIOMAS.forEach(l => new Function('window', fs.readFileSync(path.join(DIR, l + '.js'), 'utf8'))(caja));

// ── frases.js tiene todo lo del código ──
const enFrases = new Set(frases.map(p => p[0]));
const faltan = catalogo.filter(f => !enFrases.has(f.es));
check('frases.js tiene todas las frases del código', faltan.length === 0,
  faltan.length ? `${faltan.length} sin apuntar (node scripts/saca-frases.js --escribe), p. ej. «${faltan[0].es.slice(0, 50)}»` : `${frases.length} frases`);

// ── cada idioma, completo y con sus huecos ──
const huecos = (t) => (String(t).match(/\{\d+\}/g) || []).sort().join('');
const palabras = (t) => (String(t).match(/[A-Za-zÀ-ÿ]{2,}/g) || []).length;
// Lo que no se traduce: nombres propios, teclas y siglas.
const igualAlIngles = /^(Oddinote|Odinote|Google Drive|Google|Drive|Firebase|Ko-fi|OK|HEX|RGB|HSL|PDF|URL|Ctrl\b.*|Shift\b.*|Alt\b.*|JavaScript|Python|Bash|Markdown|Kanban.*|Pomodoro.*|GitHub.*|Email|E-mail|Web|Wi-Fi|API|ID|·.*)$/i;
for (const l of IDIOMAS) {
  const dic = (caja.ODI_IDIOMAS || {})[l] || {};
  const sin = [], malHueco = [], comoIngles = [];
  frases.forEach(([es, en], i) => {
    const t = dic[i];
    if (!t || !String(t).trim()) { sin.push(i); return; }
    if (huecos(t) !== huecos(en)) malHueco.push(i);
    if (t === en && palabras(en) >= 3 && !igualAlIngles.test(en.trim())) comoIngles.push(i);
  });
  check(`${l}: todas las frases traducidas`, sin.length === 0, sin.length ? `faltan ${sin.length} de ${frases.length} (p. ej. ${sin.slice(0, 5).join(', ')})` : `${frases.length}`);
  check(`${l}: cada traducción con sus huecos {0}…`, malHueco.length === 0, malHueco.slice(0, 5).join(', '));
  check(`${l}: ninguna frase larga se quedó en inglés`, comoIngles.length === 0, comoIngles.slice(0, 5).join(', '));
}

// ── window.t de verdad, con traduce.js ──
global.window = { ODI_FRASES: frases, ODI_IDIOMAS: caja.ODI_IDIOMAS };
require('../src/idiomas/traduce.js');
const iFija = frases.findIndex(p => !/\{\d+\}/.test(p[0]) && caja.ODI_IDIOMAS.fr[frases.indexOf(p)]);
check('una frase fija sale en francés', iFija >= 0 && window.odiTraduce('fr', frases[iFija][0], frases[iFija][1]) === caja.ODI_IDIOMAS.fr[iFija]);
const iHueco = frases.findIndex(p => /\{0\}/.test(p[0]) && /\{0\}/.test(p[1]) && !/\{1\}/.test(p[1]) && caja.ODI_IDIOMAS.fr[frases.indexOf(p)]);
if (iHueco >= 0) {
  const [es, en] = frases[iHueco];
  const sale = window.odiTraduce('fr', es.replace('{0}', 'COSA-ES'), en.replace('{0}', 'THING-EN'));
  check('una frase con hueco pone en él lo de la frase inglesa', !!sale && sale.includes('THING-EN') && !sale.includes('{0}'), sale);
}
check('lo que no está en frases.js no se inventa', window.odiTraduce('fr', 'Frase que no existe en ningún sitio', 'Nope') === null);
check('sin archivo de un idioma, nada', window.odiTraduce('xx', frases[0][0], frases[0][1]) === null);

console.log(fallos ? `\n${fallos} FALLAN` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
