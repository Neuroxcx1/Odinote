// =====================================================
// Oddinote — el minimapa del lienzo (window.Minimapa)
//
// Un mapa pequeño abajo a la derecha, encima del zoom, con todos los nodos del
// lienzo y un recuadro con lo que se está viendo: para no perderse en un
// lienzo grande, como en Miro o Figma (lo pidió el usuario para la 1.2.2).
// Pulsar o arrastrar encima lleva la vista a ese punto.
//
// Se pinta en un <canvas> y no con un div por nodo: se repinta en cada paso
// del paneo y del zoom, y con quinientos nodos un div por nodo haría lo que
// CLAUDE.md dice que no hay que hacer (recalcular estilo en cada paso). Un
// <canvas> con quinientos rectángulos tarda menos de un milisegundo.
//
// Se esconde con su × o en Ajustes (localStorage `odinote.minimapa`, de este
// equipo); el evento `odi-minimapa` avisa a todos.
// =====================================================
(function () {
  const { useEffect, useRef, useState, useMemo } = React;
  const CLAVE = 'odinote.minimapa';
  const EVENTO = 'odi-minimapa';
  const ANCHO = 200, ALTO = 128, MARGEN = 8;

  function leeVisible() {
    try { return localStorage.getItem(CLAVE) !== '0'; } catch (e) { return true; }
  }
  function ponVisible(si) {
    try { localStorage.setItem(CLAVE, si ? '1' : '0'); } catch (e) {}
    try { window.dispatchEvent(new CustomEvent(EVENTO, { detail: !!si })); } catch (e) {}
  }
  function useVisible() {
    const [v, setV] = useState(leeVisible);
    useEffect(() => {
      const al = (e) => setV(e && typeof e.detail === 'boolean' ? e.detail : leeVisible());
      window.addEventListener(EVENTO, al);
      return () => window.removeEventListener(EVENTO, al);
    }, []);
    return v;
  }

  // La caja de cada nodo (con el tamaño por defecto si no lo guarda).
  function cajaDe(it) {
    const def = window.defaultDims ? window.defaultDims(it.type) : { w: 200, h: 120 };
    return { x: +it.x || 0, y: +it.y || 0, w: it.w || def.w, h: it.h || def.h, tipo: it.type };
  }

  function Minimapa({ items, pan, scale, medida, onPan }) {
    const visible = useVisible();
    const ref = useRef(null);
    const vistaRef = useRef(null);   // la cuenta del último pintado, para los clics
    const cajas = useMemo(() => (items || []).filter(it => it && it.type !== 'line').map(cajaDe), [items]);

    useEffect(() => {
      const cv = ref.current;
      if (!cv || !visible) return;
      const r = medida && medida();
      if (!r || !r.width) return;
      // Lo que se ve, en coordenadas del lienzo.
      const vx = -pan.x / scale, vy = -pan.y / scale, vw = r.width / scale, vh = r.height / scale;
      // El mundo que hay que enseñar: los nodos y la vista.
      let x0 = vx, y0 = vy, x1 = vx + vw, y1 = vy + vh;
      cajas.forEach(c => { x0 = Math.min(x0, c.x); y0 = Math.min(y0, c.y); x1 = Math.max(x1, c.x + c.w); y1 = Math.max(y1, c.y + c.h); });
      const k = Math.min((ANCHO - MARGEN * 2) / Math.max(1, x1 - x0), (ALTO - MARGEN * 2) / Math.max(1, y1 - y0));
      const ox = MARGEN + ((ANCHO - MARGEN * 2) - (x1 - x0) * k) / 2 - x0 * k;
      const oy = MARGEN + ((ALTO - MARGEN * 2) - (y1 - y0) * k) / 2 - y0 * k;
      vistaRef.current = { k, ox, oy, vw: r.width, vh: r.height };

      const dpr = window.devicePixelRatio || 1;
      if (cv.width !== ANCHO * dpr) { cv.width = ANCHO * dpr; cv.height = ALTO * dpr; }
      const g = cv.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, ANCHO, ALTO);
      const oscuro = document.documentElement.getAttribute('data-theme') === 'dark';
      // Los marcos, solo el contorno (van detrás de lo que tienen dentro).
      cajas.forEach(c => {
        const x = ox + c.x * k, y = oy + c.y * k, w = Math.max(1.5, c.w * k), h = Math.max(1.5, c.h * k);
        if (c.tipo === 'frame') {
          g.strokeStyle = oscuro ? 'rgba(240,238,240,0.35)' : 'rgba(26,26,26,0.28)';
          g.lineWidth = 1;
          g.strokeRect(x + 0.5, y + 0.5, w, h);
        } else {
          g.fillStyle = c.tipo === 'image' || c.tipo === 'galeria'
            ? (oscuro ? 'rgba(240,238,240,0.55)' : 'rgba(26,26,26,0.42)')
            : (oscuro ? 'rgba(240,238,240,0.32)' : 'rgba(26,26,26,0.22)');
          g.fillRect(x, y, w, h);
        }
      });
      // Lo que se ve: verde, el color de «estás aquí» de la casa.
      g.fillStyle = 'rgba(144,185,104,0.16)';
      g.strokeStyle = '#90B968';
      g.lineWidth = 1.5;
      g.fillRect(ox + vx * k, oy + vy * k, vw * k, vh * k);
      g.strokeRect(ox + vx * k, oy + vy * k, vw * k, vh * k);
    }, [cajas, pan.x, pan.y, scale, visible]);

    if (!visible || !cajas.length) return null;

    // Llevar el centro de la vista al punto pulsado (y seguir al arrastrar).
    const llevaA = (ev) => {
      const v = vistaRef.current, cv = ref.current;
      if (!v || !cv) return;
      const b = cv.getBoundingClientRect();
      const cx = ((ev.clientX - b.left) * (ANCHO / b.width) - v.ox) / v.k;
      const cy = ((ev.clientY - b.top) * (ALTO / b.height) - v.oy) / v.k;
      onPan({ x: Math.round(v.vw / 2 - cx * scale), y: Math.round(v.vh / 2 - cy * scale) });
    };
    const alPulsar = (e) => {
      if (e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      llevaA(e);
      const mueve = (ev) => llevaA(ev);
      const suelta = () => { window.removeEventListener('pointermove', mueve); window.removeEventListener('pointerup', suelta); };
      window.addEventListener('pointermove', mueve);
      window.addEventListener('pointerup', suelta);
    };

    return (
      <div className="minimapa" onMouseDown={(e) => e.stopPropagation()} onWheel={(e) => e.stopPropagation()}>
        <canvas ref={ref} style={{ width: ANCHO, height: ALTO }} onPointerDown={alPulsar} />
        <button
          className="minimapa-cierra"
          title={window.t('Esconder el minimapa (se vuelve a poner en Ajustes)', 'Hide the minimap (turn it back on in Settings)')}
          onClick={(e) => { e.stopPropagation(); ponVisible(false); }}
        >
          <span className="material-symbols-rounded">close</span>
        </button>
      </div>
    );
  }

  // El interruptor de Ajustes.
  function AjusteMinimapa() {
    const visible = useVisible();
    return (
      <button
        type="button"
        role="switch"
        aria-checked={visible}
        className={'cuadricula-interruptor' + (visible ? ' on' : '')}
        onClick={() => { ponVisible(!visible); window.playAudioTone && window.playAudioTone('click'); }}
      >
        <span className="cuadricula-carril" aria-hidden="true"><i /></span>
        <span>{window.t('Enseñar el minimapa en el lienzo', 'Show the minimap on the canvas')}</span>
      </button>
    );
  }

  window.Minimapa = Minimapa;
  window.AjusteMinimapa = AjusteMinimapa;
})();
