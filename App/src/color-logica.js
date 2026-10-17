// =====================================================
// Oddinote — las cuentas del selector de color (window.OdiColor)
//
// Sin React y sin pantalla, para poder probarlas con node
// (scripts/test-color-logica.js). Aquí está todo lo que el panel de color
// (ColorPicker.jsx) necesita saber de los colores:
//
//  · pasar de un modelo a otro: HEX, RGB, HSL y HSV. El cuadro y la rueda
//    trabajan en HSV porque es lo que se ve (el cuadro es saturación × brillo
//    de un tono); los campos enseñan HEX, RGB y HSL porque es lo que se copia.
//  · leer lo que alguien escribe o pega: «#abc», «6B8E3A», «rgb(1, 2, 3)»,
//    «107 142 58», «hsl(85, 42%, 39%)»… Quien copia un color de otro programa
//    lo trae en cualquiera de esas formas, y ninguna debería dar error.
//  · sacar la paleta de una imagen: los cinco o seis colores que más pesan.
// =====================================================
(function () {
  const limita = (v, a, b) => Math.min(b, Math.max(a, v));
  const redondea = (v) => Math.round(v);

  // ── Modelos ──
  function hexARgb(hex) {
    if (typeof hex !== 'string') return null;
    let h = hex.trim().replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(h)) h = h.split('').map(c => c + c).join('');
    // Con transparencia (#RRGGBBAA) se queda el color: el panel no maneja alfa.
    if (/^[0-9a-f]{8}$/i.test(h)) h = h.slice(0, 6);
    if (!/^[0-9a-f]{6}$/i.test(h)) return null;
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
  }

  function rgbAHex({ r, g, b }) {
    const dos = (x) => limita(redondea(x), 0, 255).toString(16).padStart(2, '0');
    return ('#' + dos(r) + dos(g) + dos(b)).toUpperCase();
  }

  function rgbAHsl({ r, g, b }) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0, s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return { h, s: s * 100, l: l * 100 };
  }

  function hslARgb({ h, s, l }) {
    h = ((h % 360) + 360) % 360; s = limita(s, 0, 100) / 100; l = limita(l, 0, 100) / 100;
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return { r: f(0) * 255, g: f(8) * 255, b: f(4) * 255 };
  }

  function rgbAHsv({ r, g, b }) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    if (d) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    return { h, s: max ? (d / max) * 100 : 0, v: max * 100 };
  }

  function hsvARgb({ h, s, v }) {
    h = ((h % 360) + 360) % 360; s = limita(s, 0, 100) / 100; v = limita(v, 0, 100) / 100;
    const f = (n) => {
      const k = (n + h / 60) % 6;
      return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
    };
    return { r: f(5) * 255, g: f(3) * 255, b: f(1) * 255 };
  }

  // ── Leer lo que se escribe ──
  //
  // `pista` dice en qué campo se escribió ('hex', 'rgb' o 'hsl'): tres números
  // sueltos son RGB en el campo RGB y HSL en el de HSL. Con «rgb(…)» o «hsl(…)»
  // delante la pista no hace falta, y así pegar «hsl(…)» en el campo HEX
  // también funciona.
  function lee(texto, pista) {
    if (typeof texto !== 'string') return null;
    const t = texto.trim().toLowerCase();
    if (!t) return null;
    const conNombre = t.match(/^(rgb|hsl)a?\s*\(([^)]*)\)\s*;?$/);
    const modelo = conNombre ? conNombre[1] : null;
    const cuerpo = conNombre ? conNombre[2] : t;
    const hex = modelo ? null : hexARgb(t);
    if (hex && (pista !== 'rgb' && pista !== 'hsl' || /[#a-f]/.test(t))) return hex;
    const nums = cuerpo.split(/[\s,/]+/).filter(Boolean);
    if (nums.length < 3 || nums.length > 4) return hex;
    const vals = nums.slice(0, 3).map(n => parseFloat(n.replace('%', '').replace('°', '').replace('deg', '')));
    if (vals.some(v => !isFinite(v))) return null;
    const como = modelo || (pista === 'hsl' ? 'hsl' : 'rgb');
    if (como === 'hsl') {
      const [h, s, l] = vals;
      if (s < 0 || s > 100 || l < 0 || l > 100) return null;
      return redondeaRgb(hslARgb({ h, s, l }));
    }
    // rgb(10%, 20%, 30%) también existe: en porcentaje, sobre 255.
    const enPorcentaje = nums.slice(0, 3).every(n => /%$/.test(n));
    const rgb = enPorcentaje ? vals.map(v => v * 2.55) : vals;
    if (rgb.some(v => v < 0 || v > 255)) return null;
    return redondeaRgb({ r: rgb[0], g: rgb[1], b: rgb[2] });
  }

  const redondeaRgb = ({ r, g, b }) => ({ r: redondea(r), g: redondea(g), b: redondea(b) });

  // ── Escribir: lo que enseña cada campo y lo que se copia ──
  function textos(hex) {
    const rgb = hexARgb(hex);
    if (!rgb) return null;
    const hsl = rgbAHsl(rgb);
    const H = redondea(hsl.h) % 360, S = redondea(hsl.s), L = redondea(hsl.l);
    return {
      hex: rgbAHex(rgb),
      rgb: `${rgb.r}, ${rgb.g}, ${rgb.b}`,
      hsl: `${H}, ${S}%, ${L}%`,
      copia: {
        hex: rgbAHex(rgb),
        rgb: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
        hsl: `hsl(${H}, ${S}%, ${L}%)`,
      },
    };
  }

  // Lo claro que se ve un color (0 negro, 1 blanco), para elegir si se le
  // escribe encima en negro o en blanco.
  function luminancia(hex) {
    const c = hexARgb(hex);
    if (!c) return 0;
    const lin = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
    return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  }

  // ── La paleta de una imagen ──
  //
  // k-medias sobre una muestra de la foto (no hacen falta todos los píxeles: la
  // imagen llega ya encogida a unos 64 px). Las semillas no son al azar: la
  // primera es el color más repetido y cada una de las siguientes la más lejana
  // de las ya elegidas. Así la misma foto da siempre la misma paleta, y un
  // detalle pequeño pero muy distinto (la chaqueta roja en un paisaje verde)
  // tiene su sitio en vez de perderse entre cinco verdes.
  //
  // `pixeles` es lo de getImageData: RGBA seguido. Lo casi transparente no
  // cuenta (el fondo de un PNG recortado no es un color de la imagen).
  function paletaDeImagen(pixeles, cuantos) {
    const n = cuantos || 5;
    const puntos = [];
    for (let i = 0; i + 3 < pixeles.length; i += 4) {
      if (pixeles[i + 3] < 128) continue;
      puntos.push([pixeles[i], pixeles[i + 1], pixeles[i + 2]]);
    }
    if (!puntos.length) return [];
    const dist = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

    // El más repetido, contando en cubitos de 16 para que el ruido no lo esconda.
    const cubos = new Map();
    for (const p of puntos) {
      const k = (p[0] >> 4) * 256 + (p[1] >> 4) * 16 + (p[2] >> 4);
      const c = cubos.get(k) || { n: 0, s: [0, 0, 0] };
      c.n++; c.s[0] += p[0]; c.s[1] += p[1]; c.s[2] += p[2];
      cubos.set(k, c);
    }
    let mejor = null;
    for (const c of cubos.values()) if (!mejor || c.n > mejor.n) mejor = c;
    const centros = [mejor.s.map(v => v / mejor.n)];
    while (centros.length < n) {
      let lejos = null, dLejos = -1;
      for (const p of puntos) {
        const d = Math.min(...centros.map(c => dist(p, c)));
        if (d > dLejos) { dLejos = d; lejos = p; }
      }
      // Ya no queda nada distinto: la imagen tiene menos colores que los pedidos.
      if (dLejos < 1) break;
      centros.push(lejos.slice());
    }

    const pesos = new Array(centros.length).fill(0);
    for (let vuelta = 0; vuelta < 8; vuelta++) {
      const suma = centros.map(() => [0, 0, 0]);
      pesos.fill(0);
      for (const p of puntos) {
        let k = 0, dk = Infinity;
        for (let j = 0; j < centros.length; j++) { const d = dist(p, centros[j]); if (d < dk) { dk = d; k = j; } }
        suma[k][0] += p[0]; suma[k][1] += p[1]; suma[k][2] += p[2]; pesos[k]++;
      }
      for (let j = 0; j < centros.length; j++) {
        if (pesos[j]) centros[j] = suma[j].map(v => v / pesos[j]);
      }
    }

    // Del que más pesa al que menos, y sin dos casi iguales.
    const orden = centros.map((c, j) => ({ hex: rgbAHex({ r: c[0], g: c[1], b: c[2] }), peso: pesos[j], c }))
      .filter(x => x.peso > 0)
      .sort((a, b) => b.peso - a.peso);
    const fuera = [];
    for (const x of orden) {
      if (fuera.every(y => dist(y.c, x.c) > 18 * 18)) fuera.push(x);
    }
    return fuera.map(x => x.hex);
  }

  const OdiColor = { hexARgb, rgbAHex, rgbAHsl, hslARgb, rgbAHsv, hsvARgb, lee, textos, luminancia, paletaDeImagen };
  if (typeof window !== 'undefined') window.OdiColor = OdiColor;
  if (typeof module !== 'undefined' && module.exports) module.exports = OdiColor;
})();
