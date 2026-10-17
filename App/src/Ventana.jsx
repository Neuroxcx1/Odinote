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

// ── El tamaño de toda la aplicación (Ajustes) ──
//
// Pedido así: en una pantalla 4K los botones de arriba salen diminutos, y en
// una de 720 se querría ver más cosas a la vez. Una barra del 50 % al 200 %,
// y la aplicación de detrás cambia mientras se arrastra, para ver lo que se
// está haciendo. La ventana de Ajustes no cambia con ella (la compensa quien
// la pinta, con onCambia): si creciera bajo el ratón, la barra se escaparía
// del puntero en cada paso.
//
// Por arriba, el tope es lo que cabe: por debajo de 860 px de ancho la
// aplicación pasa a la disposición del teléfono (touch.js), así que una
// pantalla de 1366 px no puede ir más allá del 150 %.
//
// Es el zoom de Chromium (main.js, ventana:escala). En la web no hay forma de
// tocarlo desde la página: allí se explica el del navegador.
const ESCALA_ANCHO_MINIMO = 900;
const ESCALAS_RAPIDAS = [0.75, 1, 1.25, 1.5];

function AjusteEscala({ onCambia, onArrastra }) {
  const { useState, useEffect, useRef } = React;
  const api = window.electronAPI && window.electronAPI.ventana && window.electronAPI.ventana.escala ? window.electronAPI.ventana : null;
  const [escala, setEscala] = useState(1);
  const pendiente = useRef(null);
  const barraRef = useRef(null);

  // El tope sale del ancho de la VENTANA en píxeles de verdad (lo que mide en
  // CSS por la escala que ya tiene), no del de la pantalla: con la ventana a
  // 1280 en un monitor de 1920, el 200 % la dejaba en 640 y la aplicación se
  // ponía como en el teléfono. Se mide una vez al abrir: mientras se arrastra,
  // el ancho en CSS cambia con la escala y el tope bailaría.
  const [anchoReal, setAnchoReal] = useState(window.innerWidth);
  const maximo = Math.max(1, Math.min(2, Math.floor(anchoReal / ESCALA_ANCHO_MINIMO * 20) / 20));

  useEffect(() => {
    if (!api || !api.leeEscala) return;
    api.leeEscala().then(f => {
      if (!f) return;
      setEscala(f);
      setAnchoReal(window.innerWidth * f);
      onCambia && onCambia(f);
    }).catch(() => {});
  }, []);

  // Soltar la barra: el «change» de verdad. El onChange de React salta en
  // cada movimiento, como onInput, y guardaría config.json a cada paso.
  const ponRef = useRef(null);
  useEffect(() => {
    const b = barraRef.current;
    if (!b) return;
    const alSoltar = () => { ponRef.current && ponRef.current(Number(b.value) / 100, true); onArrastra && onArrastra(false); };
    b.addEventListener('change', alSoltar);
    return () => b.removeEventListener('change', alSoltar);
  }, [api]);

  if (!api) {
    return (
      <p className="ajuste-escala-nota">
        {window.t(
          'En el navegador, el tamaño lo pone el propio navegador: Ctrl + y Ctrl − (o ⌘ + y ⌘ − en Mac), y Ctrl 0 para volver.',
          'In the browser, size is set by the browser itself: Ctrl + and Ctrl − (or ⌘ + and ⌘ − on Mac), and Ctrl 0 to reset.')}
      </p>
    );
  }

  // Mientras se arrastra se manda una vez por cuadro y sin guardar; al soltar
  // se guarda. Así no se escribe config.json cuarenta veces por segundo.
  const pon = (f, guardar) => {
    const v = Math.max(0.5, Math.min(maximo, Math.round(f * 100) / 100));
    setEscala(v);
    onCambia && onCambia(v);
    if (guardar) { pendiente.current = null; api.escala(v, true); return; }
    if (pendiente.current == null) {
      requestAnimationFrame(() => {
        const x = pendiente.current;
        pendiente.current = null;
        if (x != null) api.escala(x, false);
      });
    }
    pendiente.current = v;
  };

  ponRef.current = pon;
  const pct = Math.round(escala * 100);
  return (
    <div className="ajuste-escala">
      <div className="ajuste-escala-fila">
        <span className="material-symbols-rounded ajuste-escala-icono pequena" aria-hidden="true">text_fields</span>
        <input
          ref={barraRef}
          type="range"
          className="ajuste-escala-barra"
          min={50}
          max={Math.round(maximo * 100)}
          step={5}
          value={pct}
          aria-label={window.t('Tamaño de la interfaz', 'Interface size')}
          onPointerDown={() => onArrastra && onArrastra(true)}
          onPointerUp={() => onArrastra && onArrastra(false)}
          onChange={(e) => pon(Number(e.target.value) / 100, false)}
        />
        <span className="material-symbols-rounded ajuste-escala-icono grande" aria-hidden="true">text_fields</span>
        <span className="ajuste-escala-valor">{pct} %</span>
      </div>
      <div className="ajuste-escala-rapidos">
        {ESCALAS_RAPIDAS.filter(f => f <= maximo + 0.001).map(f => (
          <button
            key={f}
            type="button"
            className={`ajuste-escala-rapido ${Math.abs(f - escala) < 0.001 ? 'activo' : ''}`}
            onClick={() => pon(f, true)}
          >
            {Math.round(f * 100)} %{f === 1 ? window.t(' (normal)', ' (normal)') : ''}
          </button>
        ))}
      </div>
      {maximo < 2 && (
        <p className="ajuste-escala-nota">
          {window.t(
            `En esta pantalla llega hasta el ${Math.round(maximo * 100)} %: más grande, la aplicación ya no cabría y se pondría como en el teléfono.`,
            `On this screen it goes up to ${Math.round(maximo * 100)} %: any bigger and the app would no longer fit and would switch to the phone layout.`)}
        </p>
      )}
    </div>
  );
}

window.BotonFijar = BotonFijar;
window.useVentana = useVentana;
window.AjusteEscala = AjusteEscala;
