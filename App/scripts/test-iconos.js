// Los iconos propios (src/iconos/iconos.js).
//
// Mira tres cosas: que cada icono que nombra el código tenga su dibujo (si no,
// saldría con la letra de Material y se notaría el cambio de estilo); que los
// dibujos sean SVG limpio, sin nada que cargar de fuera; y que el cambio en
// React.createElement haga lo que dice y deje pasar lo demás.
//   node scripts/test-iconos.js
const fs = require('fs');
const path = require('path');

const APP = path.join(__dirname, '..');
const SRC = path.join(APP, 'src');
let fallos = 0;
const ok = (cond, que, detalle) => {
  if (cond) console.log('OK    ' + que + (detalle !== undefined ? ' — ' + detalle : ''));
  else { fallos++; console.log('FALLA ' + que + (detalle !== undefined ? ' — ' + detalle : '')); }
};

// Un React de mentira para ver qué crea el cambio.
const creados = [];
global.window = { React: { createElement: (tipo, props, ...hijos) => { const e = { tipo, props, hijos }; creados.push(e); return e; } } };
require(path.join(SRC, 'iconos', 'iconos.js'));
const ICONOS = window.ODI_ICONOS;
const nombres = Object.keys(ICONOS);
ok(nombres.length > 250, 'hay dibujos', nombres.length);

// ── 1. Que no falte ninguno ──
const B = require(path.join(APP, 'lib', 'babel.min.js'));
const Babel = B.transform ? B : global.Babel;
const usados = new Map();
const apunta = (v, f) => {
  v = String(v).trim();
  if (!/^[a-z][a-z0-9_]*$/.test(v)) return;
  if (!usados.has(v)) usados.set(v, new Set());
  usados.get(v).add(f);
};
// Solo las cadenas que pueden acabar siendo el nombre: el resultado de un
// ternario o de un ||, los valores de una tabla. Las de una comparación
// (estado === 'offline' ? …) o las que se pasan a una función no lo son.
const cadenas = (n, cb) => {
  if (!n || typeof n !== 'object') return;
  if (Array.isArray(n)) return n.forEach((x) => cadenas(x, cb));
  switch (n.type) {
    case 'StringLiteral': case 'JSXText': return cb(n.value);
    case 'JSXExpressionContainer': return cadenas(n.expression, cb);
    case 'ConditionalExpression': cadenas(n.consequent, cb); return cadenas(n.alternate, cb);
    case 'LogicalExpression': cadenas(n.left, cb); return cadenas(n.right, cb);
    case 'MemberExpression': return n.object.type === 'ObjectExpression' ? cadenas(n.object, cb) : undefined;
    case 'ObjectExpression': return n.properties.forEach((p) => p.value && cadenas(p.value, cb));
    case 'ArrayExpression': return n.elements.forEach((e) => cadenas(e, cb));
    default: return undefined;
  }
};
const claseDe = (el) => {
  const a = (el.openingElement.attributes || []).find((x) => x.name && x.name.name === 'className');
  let t = '';
  const junta = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach(junta);
    if (n.type === 'StringLiteral') t += ' ' + n.value;
    if (n.type === 'TemplateElement') t += ' ' + n.value.raw;
    for (const k of Object.keys(n)) if (k !== 'loc' && k !== 'start' && k !== 'end') junta(n[k]);
  };
  if (a) junta(a.value);
  return t;
};
// Cadenas que van dentro de un icono pero no son su nombre (un texto que se
// calcula y luego se cambia por otro, por ejemplo). Vacío a propósito: si
// aparece algo, que se mire antes de meterlo aquí.
const NO_SON_ICONO = new Set([]);
for (const f of fs.readdirSync(SRC).filter((x) => /\.jsx?$/.test(x))) {
  const ast = Babel.transform(fs.readFileSync(path.join(SRC, f), 'utf8'), { presets: [], parserOpts: { plugins: ['jsx'] }, filename: f, ast: true, code: false }).ast;
  const visita = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach(visita);
    if (n.type === 'JSXElement' && /material-symbols/.test(claseDe(n))) cadenas(n.children, (v) => apunta(v, f));
    if (n.type === 'ObjectProperty' && n.key && /^(icon|icono|ic|iconName|sym)$/i.test(n.key.name || n.key.value || '')) cadenas(n.value, (v) => apunta(v, f));
    if (n.type === 'JSXAttribute' && n.name && /^(icon|icono)$/i.test(n.name.name)) cadenas(n.value, (v) => apunta(v, f));
    // Las listas de iconos para elegir (la portada de un proyecto, la de un tablero).
    if (n.type === 'ArrayExpression' && n.elements.length >= 6) {
      const s = n.elements.filter((e) => e && e.type === 'StringLiteral');
      if (s.length >= 6 && s.filter((e) => ICONOS[e.value]).length / s.length > 0.6) s.forEach((e) => apunta(e.value, f));
    }
    for (const k of Object.keys(n)) if (k !== 'loc' && k !== 'start' && k !== 'end') visita(n[k]);
  };
  visita(ast.program);
}
const faltan = [...usados.keys()].filter((v) => !ICONOS[v] && !NO_SON_ICONO.has(v));
ok(faltan.length === 0, 'cada icono que nombra el código tiene su dibujo',
  faltan.length ? faltan.map((v) => v + ' (' + [...usados.get(v)].join(', ') + ')').join('; ') : usados.size + ' nombres');

// ── 2. Que los dibujos estén bien hechos ──
const malos = [];
for (const n of nombres) {
  const s = ICONOS[n];
  if (/<script|on[a-z]+=|href|url\(|xlink|<image|<foreignObject/i.test(s)) { malos.push(n + ': trae algo de fuera'); continue; }
  const pila = [];
  for (const m of s.matchAll(/<(\/?)([a-zA-Z]+)[^>]*?(\/?)>/g)) {
    if (m[3]) continue;
    if (m[1]) { if (pila.pop() !== m[2]) { malos.push(n + ': etiqueta mal cerrada'); break; } }
    else pila.push(m[2]);
  }
  if (pila.length) malos.push(n + ': algo sin cerrar');
  if (!/<(path|circle|rect|g|line|polyline|ellipse)/.test(s)) malos.push(n + ': vacío');
}
ok(malos.length === 0, 'los dibujos son SVG limpio, sin nada de fuera', malos.join('; ') || nombres.length + ' dibujos');

// ── 3. El cambio de React.createElement ──
const R = window.React;
ok(R.createElement.odiIconos === true, 'createElement queda marcado (no se envuelve dos veces)');
creados.length = 0;
const icono = R.createElement('span', { className: 'material-symbols-rounded', style: { fontSize: 18 } }, 'edit');
ok(icono.props.className === 'material-symbols-rounded odi-icono' && icono.props['data-icono'] === 'edit', 'un icono conocido lleva su clase y su nombre', icono.props.className);
ok(icono.hijos[0].tipo === 'svg' && icono.hijos[0].props.dangerouslySetInnerHTML.__html === ICONOS.edit, 'y dentro, su dibujo');
ok(icono.hijos[1].tipo === 'span' && icono.hijos[1].props.hidden === true && icono.hijos[1].hijos[0] === 'edit', 'con el nombre escondido al lado, para quien lo busque por el texto');
ok(icono.props.style.fontSize === 18, 'sin perder su estilo');
const lleno = R.createElement('span', { className: 'material-symbols-rounded', style: { fontVariationSettings: '"FILL" 1' } }, 'cloud');
ok(/icono-lleno/.test(lleno.props.className), 'FILL 1 pasa a icono-lleno', lleno.props.className);
const conEspacios = R.createElement('span', { className: 'material-symbols-rounded x' }, '\n   push_pin\n  ');
ok(conEspacios.props['data-icono'] === 'push_pin', 'el nombre con saltos de línea alrededor también vale');
const raro = R.createElement('span', { className: 'material-symbols-rounded' }, 'no_existe_este');
ok(raro.hijos.length === 1 && raro.hijos[0] === 'no_existe_este' && !/odi-icono/.test(raro.props.className), 'un nombre sin dibujo se queda como estaba (con la letra de Material)');
const otro = R.createElement('span', { className: 'texto' }, 'edit');
ok(otro.hijos[0] === 'edit' && otro.props.className === 'texto', 'un elemento que no es icono no se toca');
const variosHijos = R.createElement('span', { className: 'material-symbols-rounded' }, 'edit', 'x');
ok(variosHijos.hijos.length === 2 && variosHijos.hijos[0] === 'edit', 'con más de un hijo tampoco se toca');
const sinProps = R.createElement('div', null, 'edit');
ok(sinProps.props === null, 'sin props, tal cual');

// La hoja de estilos tiene que esconder el nombre y medir el dibujo.
const css = fs.readFileSync(path.join(SRC, 'styles.css'), 'utf8');
ok(/\.odi-icono > span\[hidden\] \{ display: none !important; \}/.test(css), 'styles.css esconde el nombre aunque otra regla quiera enseñarlo');
ok(/\.odi-icono > svg \{[^}]*width: 1em; height: 1em;/.test(css), 'styles.css mide el dibujo como la letra (1em)');

// Y index.html lo carga detrás de React y antes del primer .jsx.
const html = fs.readFileSync(path.join(APP, 'index.html'), 'utf8');
const iReact = html.indexOf('react-dom.production.min.js'), iIconos = html.indexOf('src/iconos/iconos.js'), iJsx = html.indexOf('type="text/babel"');
ok(iReact > 0 && iIconos > iReact && iIconos < iJsx, 'index.html carga los iconos entre React y el primer .jsx');

console.log(fallos ? '\n' + fallos + ' fallo(s).' : '\nTodo bien.');
process.exit(fallos ? 1 : 0);
