// Junta las traducciones en un archivo por idioma (src/idiomas/<idioma>.js).
//   node scripts/junta-idiomas.js <carpeta-de-tandas>
//
// Las tandas son JSON { "<número de frase>": [fr, de, it, pt, zh, ja, ko, ar, ru] }:
// así cada frase se traduce de una vez a los nueve idiomas y no se descuadra
// ninguno. Lo que ya tradujo el diccionario común (UI_WORDS, en data.js) se
// copia de ahí. Si ya existe el archivo de un idioma, lo suyo se conserva y lo
// de las tandas lo completa o lo corrige.
const fs = require('fs');
const path = require('path');

const IDIOMAS = ['fr', 'de', 'it', 'pt', 'zh', 'ja', 'ko', 'ar', 'ru'];
const NOMBRES = { fr: 'francés', de: 'alemán', it: 'italiano', pt: 'portugués (de Brasil)', zh: 'chino simplificado', ja: 'japonés', ko: 'coreano', ar: 'árabe', ru: 'ruso' };
const APP = path.join(__dirname, '..');
const DIR = path.join(APP, 'src', 'idiomas');

const lee = (archivo, nombre) => {
  const caja = {};
  new Function('window', fs.readFileSync(archivo, 'utf8'))(caja);
  return caja[nombre];
};
const frases = lee(path.join(DIR, 'frases.js'), 'ODI_FRASES');

global.window = {};
require(path.join(APP, 'src', 'data.js'));
const ui = window.UI_WORDS || {};

const carpeta = process.argv[2];
const tandas = {};
if (carpeta) {
  for (const f of fs.readdirSync(carpeta).filter(x => /^tanda-.*\.json$/.test(x)).sort()) {
    const datos = JSON.parse(fs.readFileSync(path.join(carpeta, f), 'utf8'));
    for (const [k, v] of Object.entries(datos)) {
      if (!Array.isArray(v) || v.length !== IDIOMAS.length) throw new Error(`${f}: la frase ${k} no trae los ${IDIOMAS.length} idiomas`);
      tandas[k] = v;
    }
  }
}

for (const [n, idioma] of IDIOMAS.entries()) {
  const destino = path.join(DIR, idioma + '.js');
  const antes = fs.existsSync(destino) ? (lee(destino, 'ODI_IDIOMAS') || {})[idioma] || {} : {};
  const dic = {};
  frases.forEach(([es], i) => {
    const deTanda = tandas[i] && tandas[i][n];
    const deUi = ui[es] && ui[es][idioma];
    const t = deTanda || antes[i] || deUi;
    if (t) dic[i] = t;
  });
  const lineas = Object.keys(dic).map(Number).sort((a, b) => a - b)
    .map(i => `  ${i}: ${JSON.stringify(dic[i])},`);
  const texto = [
    `// Oddinote en ${NOMBRES[idioma]}: la traducción de cada frase de frases.js, por su número.`,
    '// Lo junta scripts/junta-idiomas.js; ver src/idiomas/traduce.js.',
    'window.ODI_IDIOMAS = window.ODI_IDIOMAS || {};',
    `window.ODI_IDIOMAS.${idioma} = {`,
    ...lineas,
    '};',
    '',
  ].join('\r\n');
  fs.writeFileSync(destino, texto);
  console.log(`${idioma}: ${Object.keys(dic).length} de ${frases.length}`);
}
