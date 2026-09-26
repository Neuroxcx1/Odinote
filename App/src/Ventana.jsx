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

function BotonFijar({ className }) {
  const [est, api] = useVentana();
  if (!api) return null;
  const fijada = !!est.fijada;
  return (
    <button
      className={`boton-fijar ${fijada ? 'fijada' : ''} ${className || ''}`}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={async (e) => {
        e.stopPropagation();
        const r = await api.fija(!fijada);
        window.playAudioTone && window.playAudioTone('click');
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
