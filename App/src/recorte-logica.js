// =====================================================
// Oddinote — las cuentas del recorte de imágenes (window.OdiRecorte)
//
// El usuario lo vio: al aplicar un recorte la imagen se quedaba deformada.
// Mientras se recortaba, la foto entera se apretaba dentro de la caja que ya
// tenía el nodo (con la forma del recorte anterior), y al pulsar «Listo» la
// caja no cambiaba: la parte elegida se estiraba a la forma vieja.
//
// Ahora, como en cualquier editor de fotos: al entrar, la caja se abre a la
// foto ENTERA con su forma de verdad (la zona recortada se queda en su sitio y
// a la misma escala); al salir, se ciñe a la parte elegida. Así lo que se ve
// nunca está deformado. Sin React ni DOM, para probarlo desde Node
// (scripts/test-recorte-logica.js).
//
// El recorte va en porcentajes de la foto: { x, y, w, h } de 0 a 100.
// =====================================================
(function () {
  const ENTERO = { x: 0, y: 0, w: 100, h: 100 };

  function recorteDe(item) {
    const c = item && item.crop;
    if (!c || !(c.w > 0) || !(c.h > 0)) return { ...ENTERO };
    return { x: +c.x || 0, y: +c.y || 0, w: +c.w, h: +c.h };
  }

  // La proporción ancho/alto de la foto entera. Si no se sabe (la imagen aún
  // no ha cargado nunca), la que da la caja actual con su recorte: así, como
  // mucho, se queda como estaba.
  function proporcion(item) {
    const r = Number(item && item.naturalRatio);
    if (r > 0 && isFinite(r)) return r;
    const c = recorteDe(item);
    const w = item.w || 1, h = item.h || 1;
    return (w / (c.w / 100)) / (h / (c.h / 100));
  }

  // Al entrar: la caja de la foto entera, con la zona recortada encima de
  // donde estaba y a la misma escala de ancho.
  function abre(item) {
    const c = recorteDe(item);
    const r = proporcion(item);
    const w = item.w / (c.w / 100);
    const h = w / r;
    return {
      x: item.x - (c.x / 100) * w,
      y: item.y - (c.y / 100) * h,
      w, h,
    };
  }

  // Al salir: la caja ceñida a la parte elegida de esa foto entera.
  function cierra(caja, crop) {
    const c = crop && crop.w > 0 && crop.h > 0 ? crop : ENTERO;
    return {
      x: caja.x + (c.x / 100) * caja.w,
      y: caja.y + (c.y / 100) * caja.h,
      w: (c.w / 100) * caja.w,
      h: (c.h / 100) * caja.h,
    };
  }

  const redondea = (caja) => ({ x: Math.round(caja.x), y: Math.round(caja.y), w: Math.max(8, Math.round(caja.w)), h: Math.max(8, Math.round(caja.h)) });

  const api = { recorteDe, proporcion, abre, cierra, redondea };
  if (typeof window !== 'undefined') window.OdiRecorte = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
