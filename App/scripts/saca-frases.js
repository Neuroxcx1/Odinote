// Saca del código todas las frases de la interfaz: cada window.t('español', 'inglés').
//   node scripts/saca-frases.js            → resumen
//   node scripts/saca-frases.js --json F   → escribe el catálogo en F
//
// Las frases con partes que cambian (`Hola ${nombre}`) salen como plantilla:
// cada ${…} se vuelve {0}, {1}… en el mismo orden en las dos lenguas. Lo usan
// las traducciones de src/idiomas/ (y su prueba, test-idiomas.js) para saber
// qué hay que traducir.
const fs = require('fs');
const path = require('path');
const B = require('../lib/babel.min.js');
const Babel = B.transform ? B : global.Babel;

const SRC = path.join(__dirname, '..', 'src');
const archivos = fs.readdirSync(SRC).filter(f => /\.(jsx|js)$/.test(f)).map(f => path.join(SRC, f));

// Una plantilla `a ${x} b` → 'a {0} b'. Devuelve null si no es texto ni plantilla.
function texto(nodo) {
  if (!nodo) return null;
  if (nodo.type === 'StringLiteral') return { t: nodo.value, n: 0 };
  if (nodo.type === 'TemplateLiteral') {
    let t = '', n = 0;
    nodo.quasis.forEach((q, i) => {
      t += q.value.cooked;
      if (i < nodo.expressions.length) t += '{' + (n++) + '}';
    });
    return { t, n };
  }
  return null;
}

function frasesDe(archivo) {
  const codigo = fs.readFileSync(archivo, 'utf8');
  const fuera = [];
  let ast;
  try {
    ast = Babel.transform(codigo, { presets: archivo.endsWith('.jsx') ? ['react'] : [], ast: true, code: false, filename: path.basename(archivo) }).ast;
  } catch (e) {
    return { fuera, error: e.message };
  }
  const visita = (n) => {
    if (!n || typeof n.type !== 'string') return;
    if (n.type === 'CallExpression' && n.callee && n.callee.type === 'MemberExpression' &&
        n.callee.object && n.callee.object.name === 'window' && n.callee.property && n.callee.property.name === 't' &&
        n.arguments.length === 2) {
      const es = texto(n.arguments[0]), en = texto(n.arguments[1]);
      if (es && en && es.t.trim()) fuera.push({ es: es.t, en: en.t, huecos: Math.max(es.n, en.n), plantilla: es.n > 0 || en.n > 0, archivo: path.basename(archivo), linea: n.loc ? n.loc.start.line : 0 });
    }
    // Los avisos del selector de color: tostada('español', 'inglés').
    if (n.type === 'CallExpression' && n.callee && n.callee.type === 'Identifier' && n.callee.name === 'tostada' && n.arguments.length === 2) {
      const es = texto(n.arguments[0]), en = texto(n.arguments[1]);
      if (es && en && es.t.trim()) fuera.push({ es: es.t, en: en.t, huecos: Math.max(es.n, en.n), plantilla: es.n > 0 || en.n > 0, archivo: path.basename(archivo), linea: n.loc ? n.loc.start.line : 0 });
    }
    // Las plantillas de tablero (plantillas.js) escriben sus textos con su
    // propia ayuda, p('español', 'inglés'): también son frases de la interfaz.
    // Y sus notas, nota(títuloEs, títuloEn, ayudaEs, ayudaEn), y las tareas
    // como parejas ['es', 'en'].
    if (path.basename(archivo) === 'plantillas.js') {
      const apunta = (a, b) => {
        const es = texto(a), en = texto(b);
        // Las flechas también son parejas (['b1', 'b2']), pero de referencias, no de texto.
        const esRef = (x) => /^[a-z]+\d+$/.test(x.t) || /^centro$/.test(x.t);
        if (es && en && es.t.trim() && es.n === 0 && en.n === 0 && !esRef(es) && !esRef(en)) fuera.push({ es: es.t, en: en.t, huecos: 0, plantilla: false, archivo: path.basename(archivo), linea: n.loc ? n.loc.start.line : 0 });
      };
      if (n.type === 'CallExpression' && n.callee && n.callee.type === 'Identifier') {
        if (n.callee.name === 'p' && n.arguments.length === 2) apunta(n.arguments[0], n.arguments[1]);
        if (n.callee.name === 'nota' && n.arguments.length === 4) { apunta(n.arguments[0], n.arguments[1]); apunta(n.arguments[2], n.arguments[3]); }
      }
      if (n.type === 'ArrayExpression' && n.elements.length === 2 && n.elements.every(e => e && e.type === 'StringLiteral')) apunta(n.elements[0], n.elements[1]);
    }
    // Los textos por defecto que la app guarda en el propio nodo como
    // { es: '…', en: '…' } (el título de una lista nueva, «Nuevo tablero»):
    // pickLang (items.jsx) los busca aquí para los otros nueve idiomas.
    if (n.type === 'ObjectExpression') {
      const props = n.properties.filter(p => p.type === 'ObjectProperty');
      const de = (k) => props.find(p => p.key && (p.key.name || p.key.value) === k);
      const pes = de('es'), pen = de('en');
      if (props.length === 2 && pes && pen && pes.value.type === 'StringLiteral' && pen.value.type === 'StringLiteral' && pes.value.value.trim()) {
        fuera.push({ es: pes.value.value, en: pen.value.value, huecos: 0, plantilla: false, archivo: path.basename(archivo), linea: n.loc ? n.loc.start.line : 0 });
      }
    }
    for (const k of Object.keys(n)) {
      if (k === 'loc' || k === 'start' || k === 'end') continue;
      const v = n[k];
      if (Array.isArray(v)) v.forEach(visita);
      else if (v && typeof v.type === 'string') visita(v);
    }
  };
  visita(ast.program);
  return { fuera };
}

const todas = [];
const errores = [];
for (const a of archivos) {
  const r = frasesDe(a);
  if (r.error) errores.push(path.basename(a) + ': ' + r.error);
  todas.push(...r.fuera);
}
// Una por pareja español–inglés. Casi siempre es una por frase en español,
// pero no siempre: «Reacciones» es «React» en un botón y «Reactions» en un
// título, y en francés son «Réagir» y «Réactions». Antes se quedaba la primera
// y el título salía como verbo. Ahora cada pareja tiene su número.
const clave = (es, en) => es + '\u0001' + en;
const porPareja = new Map();
const porEs = new Map();
const dobles = [];
for (const f of todas) {
  if (!porPareja.has(clave(f.es, f.en))) porPareja.set(clave(f.es, f.en), f);
  if (!porEs.has(f.es)) porEs.set(f.es, f);
  else if (porEs.get(f.es).en !== f.en && !dobles.includes(f.es)) dobles.push(f.es);
}
const catalogo = [...porPareja.values()].map(f => ({ es: f.es, en: f.en, huecos: f.huecos, plantilla: f.plantilla, donde: f.archivo + ':' + f.linea }));

// ── src/idiomas/frases.js: el catálogo numerado ──
// Solo se añade al final: el número de una frase es su clave en los archivos
// de cada idioma, así que una frase que se va del código se queda (no
// molesta) y las nuevas toman el número siguiente.
const FRASES = path.join(SRC, 'idiomas', 'frases.js');
function leeFrases() {
  if (!fs.existsSync(FRASES)) return [];
  const caja = { window: {} };
  new Function('window', fs.readFileSync(FRASES, 'utf8'))(caja.window);
  return caja.window.ODI_FRASES || [];
}
function escribeFrases() {
  const antes = leeFrases();
  const ya = new Set(antes.map(p => clave(p[0], p[1])));
  const nuevas = catalogo.filter(f => !ya.has(clave(f.es, f.en))).map(f => [f.es, f.en]);
  const todas = antes.concat(nuevas);
  const lineas = todas.map((p, i) => `  /* ${i} */ ${JSON.stringify(p)},`);
  const texto = [
    '// Generado por scripts/saca-frases.js --escribe. No se edita a mano.',
    '// Todas las frases de la interfaz: [español, inglés], cada una con su número',
    '// (el de los archivos de cada idioma). Solo se añade al final. Ver traduce.js.',
    'window.ODI_FRASES = [',
    ...lineas,
    '];',
    '',
  ].join('\r\n');
  fs.writeFileSync(FRASES, texto);
  return { antes: antes.length, nuevas: nuevas.length, total: todas.length };
}

module.exports = { catalogo, dobles, errores, leeFrases, clave };

if (require.main === module) {
  const i = process.argv.indexOf('--json');
  if (i >= 0) fs.writeFileSync(process.argv[i + 1], JSON.stringify(catalogo, null, 1));
  if (process.argv.includes('--escribe')) {
    const r = escribeFrases();
    console.log(`frases.js: ${r.antes} que ya había, ${r.nuevas} nuevas, ${r.total} en total`);
  }
  const plantillas = catalogo.filter(f => f.plantilla).length;
  console.log(`${todas.length} llamadas, ${catalogo.length} frases distintas (${catalogo.length - plantillas} fijas, ${plantillas} con partes que cambian)`);
  if (dobles.length) console.log(`${dobles.length} frases en español con más de un sentido en inglés (cada uno con su número)`);
  if (errores.length) console.log('No se pudieron leer: ' + errores.join(' | '));
}
