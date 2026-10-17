// =====================================================
// Oddinote — la ventana: "siempre encima" sin bordes
//
// Pedido por el usuario: un botón que deje el programa siempre encima de las
// demás ventanas y, a la vez, sin los bordes típicos de Windows, como PureRef.
// Es la chincheta: arriba a la derecha del todo, en la línea del buscador (en
// la cabecera de inicio y flotando en el lienzo); primero estuvo a la
// izquierda, junto al avatar, y no gustó. Las dos dicen lo mismo porque leen
// el estado de la ventana, no uno propio.
//
// Fijada, la ventana no tiene barra de título (ver main.js: la barra es una
// página aparte y la aplicación, al fijar, la tapa), así que se mueve
// arrastrando las zonas vacías de la barra de arriba de la aplicación: las
// marcadas con data-mueve-ventana. Se cambia de tamaño por los bordes, como
// siempre, y se puede hacer pequeña.
//
// Solo en la aplicación de escritorio: en la web y en el teléfono no hay
// ventana que fijar y la chincheta no sale.
// =====================================================

function useVentana() {
  const api = window.electronAPI && window.electronAPI.ventana;
  const [est, setEst] = React.useState({ fijada: false });
  React.useEffect(() => {
    if (!api) return;
    let vivo = true;
    api.estado().then(e => { if (vivo && e) setEst(e); });
    const quita = api.alCambiar(e => setEst(e || {}));
    return () => { vivo = false; quita && quita(); };
  }, []);
  return [est, api];
}

// La transparencia elegida se recuerda para la próxima vez que se fije. Del 10
// al 100 %: por debajo, una ventana encima de todo y casi invisible no habría
// quien la encontrara.
const OPACIDAD_CLAVE = 'odinote.opacidad_fijada';
const leeOpacidad = () => {
  try {
    const v = parseFloat(localStorage.getItem(OPACIDAD_CLAVE));
    return v >= 0.1 && v <= 1 ? v : 1;
  } catch (e) { return 1; }
};

function BotonFijar({ className }) {
  const [est, api] = useVentana();
  const [opacidad, setOpacidad] = React.useState(leeOpacidad);
  const [abierta, setAbierta] = React.useState(false);
  const cierre = React.useRef(null);
  if (!api) return null;
  const fijada = !!est.fijada;
  const cambiaOpacidad = (v) => {
    setOpacidad(v);
    try { localStorage.setItem(OPACIDAD_CLAVE, String(v)); } catch (e) {}
    api.opacidad && api.opacidad(v);
  };
  // Con un respiro al salir: entre la chincheta y la barrita hay un hueco, y
  // sin él se cerraba al bajar el ratón hacia ella.
  const entra = () => { clearTimeout(cierre.current); if (fijada) setAbierta(true); };
  const sale = () => { clearTimeout(cierre.current); cierre.current = setTimeout(() => setAbierta(false), 260); };
  return (
    <span className="fijar-caja" onMouseEnter={entra} onMouseLeave={sale}>
    <button
      className={`boton-fijar ${fijada ? 'fijada' : ''} ${className || ''}`}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={async (e) => {
        e.stopPropagation();
        const r = await api.fija(!fijada);
        window.playAudioTone && window.playAudioTone('click');
        // La transparencia de la última vez, en cuanto se fija (al soltarla
        // la ventana vuelve sola a verse entera: ver main.js).
        if (r && r.fijada && api.opacidad) api.opacidad(opacidad);
        setAbierta(false);
        // La primera vez, cómo se mueve ahora que no tiene barra de título.
        if (r && r.fijada && !window.__odiAvisoFijada) {
          window.__odiAvisoFijada = true;
          window.showToast && window.showToast(window.t(
            'Siempre encima y sin bordes. Muévela arrastrando la barra de arriba; la chincheta la suelta.',
            'Always on top and borderless. Move it by dragging the top bar; the pin releases it.'));
        }
      }}
      title={fijada
        ? window.t('Soltar: volver a la ventana normal', 'Unpin: back to a normal window')
        : window.t('Fijar: siempre encima y sin bordes', 'Pin: always on top, borderless')}
      aria-pressed={fijada}
    >
      <span className="material-symbols-rounded">push_pin</span>
    </button>
    {/* Solo con la ventana fijada: para ver a través de ella lo de debajo. */}
    {fijada && abierta && (
      <div className="fijar-opacidad" onMouseDown={(e) => e.stopPropagation()}>
        <div className="fijar-opacidad-panel">
          <div className="fijar-opacidad-fila">
            <span>{window.t('Opacidad', 'Opacity')}</span>
            <span>{Math.round(opacidad * 100)} %</span>
          </div>
          <input
            type="range"
            min="10" max="100" step="5"
            value={Math.round(opacidad * 100)}
            onChange={(e) => cambiaOpacidad(Number(e.target.value) / 100)}
            aria-label={window.t('Opacidad de la ventana', 'Window opacity')}
          />
        </div>
      </div>
    )}
    </span>
  );
}

// La marca en <html> (para el cursor de las zonas de arrastre) y el arrastre
// de la ventana fijada. Una sola vez, al cargar.
(function () {
  const api = window.electronAPI && window.electronAPI.ventana;
  if (!api) return;
  const marca = (e) => document.documentElement.toggleAttribute('data-ventana-fijada', !!(e && e.fijada));
  api.estado().then(marca);
  api.alCambiar(marca);
  // Solo si se pulsa JUSTO en la zona vacía (no en un botón de dentro): la
  // barra de arriba está llena de cosas que tienen que seguir funcionando.
  document.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || !document.documentElement.hasAttribute('data-ventana-fijada')) return;
    const t = e.target;
    if (!t || !t.hasAttribute || !t.hasAttribute('data-mueve-ventana')) return;
    e.preventDefault();
    e.stopPropagation();
    api.arrastra('inicio');
    const suelta = () => {
      api.arrastra('fin');
      window.removeEventListener('mouseup', suelta, true);
      window.removeEventListener('blur', suelta);
    };
    window.addEventListener('mouseup', suelta, true);
    window.addEventListener('blur', suelta);
  }, true);
})();

window.BotonFijar = BotonFijar;
window.useVentana = useVentana;
