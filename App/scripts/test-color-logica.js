// Las cuentas del selector de color (src/color-logica.js).  node scripts/test-color-logica.js
const C = require('../src/color-logica.js');

let fallos = 0;
const check = (nombre, ok, extra) => {
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${extra !== undefined ? ' — ' + extra : ''}`);
  if (!ok) fallos++;
};
const hexDe = (rgb) => rgb ? C.rgbAHex(rgb) : null;

// ── Ida y vuelta: ningún color cambia por pasar por otro modelo ──
let peor = 0;
for (let r = 0; r <= 255; r += 17) for (let g = 0; g <= 255; g += 17) for (let b = 0; b <= 255; b += 17) {
  const hex = C.rgbAHex({ r, g, b });
  const porHsv = C.rgbAHex(C.hsvARgb(C.rgbAHsv({ r, g, b })));
  const porHsl = C.rgbAHex(C.hslARgb(C.rgbAHsl({ r, g, b })));
  if (porHsv !== hex || porHsl !== hex) peor++;
}
check('4.096 colores van y vuelven por HSV y HSL sin cambiar', peor === 0, peor + ' distintos');

check('rojo puro en HSV', JSON.stringify(C.rgbAHsv({ r: 255, g: 0, b: 0 })) === JSON.stringify({ h: 0, s: 100, v: 100 }));
check('un gris no tiene tono ni saturación', (() => { const x = C.rgbAHsv({ r: 128, g: 128, b: 128 }); return x.h === 0 && x.s === 0; })());
check('el tono 360 es el 0', C.rgbAHex(C.hsvARgb({ h: 360, s: 100, v: 100 })) === '#FF0000');

// ── Leer lo que se escribe o se pega ──
const casos = [
  ['#6b8e3a', 'hex', '#6B8E3A'],
  ['6B8E3A', 'hex', '#6B8E3A'],
  ['#abc', 'hex', '#AABBCC'],
  ['abc', 'hex', '#AABBCC'],
  ['#6B8E3AFF', 'hex', '#6B8E3A'],
  ['  #6B8E3A  ', 'hex', '#6B8E3A'],
  ['rgb(107, 142, 58)', 'hex', '#6B8E3A'],
  ['rgba(107,142,58,0.5)', 'rgb', '#6B8E3A'],
  ['107, 142, 58', 'rgb', '#6B8E3A'],
  ['107 142 58', 'rgb', '#6B8E3A'],
  ['rgb(100%, 0%, 0%)', 'rgb', '#FF0000'],
  // HSL en números enteros no es exacto: hsl(85, 42%, 39%) es #6A8D3A, a un
  // paso del #6B8E3A del que salió. Igual en cualquier programa de diseño.
  ['hsl(85, 42%, 39%)', 'hex', '#6A8D3A'],
  ['85, 42%, 39%', 'hsl', '#6A8D3A'],
  ['85 42 39', 'hsl', '#6A8D3A'],
  ['hsl(85deg 42% 39%)', 'rgb', '#6A8D3A'],
  ['HSL(0, 100%, 50%)', 'hex', '#FF0000'],
  // Seis cifras en el campo RGB: no son tres números, así que es un HEX.
  ['123456', 'rgb', '#123456'],
];
for (const [texto, pista, esperado] of casos) {
  const sale = hexDe(C.lee(texto, pista));
  check(`lee «${texto}» en el campo ${pista}`, sale === esperado, sale);
}
const malos = [['', 'hex'], ['hola', 'hex'], ['#12', 'hex'], ['300, 0, 0', 'rgb'], ['10, 20', 'rgb'], ['0, 120%, 50%', 'hsl'], ['rgb(a, b, c)', 'rgb'], [null, 'hex']];
for (const [texto, pista] of malos) {
  check(`no se inventa nada con «${texto}»`, C.lee(texto, pista) === null);
}

// ── Lo que enseña cada campo y lo que se copia ──
const t = C.textos('#6b8e3a');
check('HEX en mayúsculas', t.hex === '#6B8E3A', t.hex);
check('RGB del campo', t.rgb === '107, 142, 58', t.rgb);
check('HSL del campo', t.hsl === '85, 42%, 39%', t.hsl);
check('lo que se copia lleva el nombre', t.copia.rgb === 'rgb(107, 142, 58)' && t.copia.hsl === 'hsl(85, 42%, 39%)', JSON.stringify(t.copia));
check('el HEX y el RGB copiados se vuelven a leer igual', ['hex', 'rgb'].every(k => hexDe(C.lee(t.copia[k], 'hex')) === '#6B8E3A'));
// Y el HSL, a lo sumo a dos pasos por canal, en cualquier color.
let lejos = 0;
for (let r = 0; r <= 255; r += 51) for (let g = 0; g <= 255; g += 51) for (let b = 0; b <= 255; b += 51) {
  const hex = C.rgbAHex({ r, g, b }); const v = C.lee(C.textos(hex).copia.hsl, 'hex');
  if (Math.max(Math.abs(v.r - r), Math.abs(v.g - g), Math.abs(v.b - b)) > 2) lejos++;
}
check('el HSL copiado vuelve a dos pasos como mucho', lejos === 0, lejos + ' lejos');
check('un color que no es color no da textos', C.textos('nada') === null);
check('el HSL del rojo dice 0 y no 360', C.textos('#FF0000').hsl === '0, 100%, 50%', C.textos('#FF0000').hsl);

check('el blanco es claro y el negro oscuro', C.luminancia('#FFFFFF') > 0.99 && C.luminancia('#000000') < 0.01);

// ── La paleta de una imagen ──
// Una imagen de mentira: 70 % verde, 25 % azul, 5 % rojo, con algo de ruido,
// y un trozo transparente que no debe contar.
const px = [];
const pon = (r, g, b, a, veces) => { for (let i = 0; i < veces; i++) { const ru = (i * 7) % 9 - 4; px.push(r + ru, g + ru, b + ru, a); } };
pon(80, 140, 60, 255, 700);
pon(50, 90, 160, 255, 250);
pon(220, 40, 40, 255, 50);
pon(255, 0, 255, 0, 400);
const pal = C.paletaDeImagen(new Uint8ClampedArray(px), 5);
const cerca = (hex, r, g, b) => { const c = C.hexARgb(hex); return Math.abs(c.r - r) < 12 && Math.abs(c.g - g) < 12 && Math.abs(c.b - b) < 12; };
check('saca los tres colores de la imagen', pal.length === 3, pal.join(' '));
check('el que más pesa va primero', pal[0] && cerca(pal[0], 80, 140, 60), pal[0]);
check('el rojo pequeño no se pierde', pal.some(h => cerca(h, 220, 40, 40)));
check('lo transparente no cuenta', !pal.some(h => cerca(h, 255, 0, 255)));
check('la misma imagen da siempre la misma paleta', C.paletaDeImagen(new Uint8ClampedArray(px), 5).join() === pal.join());
check('una imagen vacía no da paleta', C.paletaDeImagen(new Uint8ClampedArray([0, 0, 0, 0]), 5).length === 0);
// Muchos colores: no pasa de los pedidos.
const arcoiris = [];
for (let h = 0; h < 360; h += 3) { const c = C.hsvARgb({ h, s: 80, v: 80 }); arcoiris.push(c.r, c.g, c.b, 255); }
const pal6 = C.paletaDeImagen(new Uint8ClampedArray(arcoiris), 6);
check('un arcoíris da los seis pedidos, todos distintos', pal6.length === 6 && new Set(pal6).size === 6, pal6.join(' '));

console.log(fallos ? `\n${fallos} FALLAN` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
