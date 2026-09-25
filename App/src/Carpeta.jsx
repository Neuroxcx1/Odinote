// =====================================================
// Oddinote — el nodo de carpeta
//
// Pedido por el usuario en vez del "hito", que no se entendía: un acceso
// directo a una carpeta del ordenador. Enseña cómo se llama, cuántos archivos
// y carpetas tiene y, al pasar el ratón, las miniaturas de lo último que se
// tocó dentro asoman por arriba —fotos, PDFs, otras carpetas—, con la parte de
// delante medio transparente para que se vea lo que hay detrás. Doble clic la
// abre en el Explorador.
//
// Leer el disco solo se puede desde la aplicación de escritorio (ver
// 'carpeta-leer' en main.js, que pide las miniaturas a Windows). En la web y
// en el teléfono el nodo lo dice en vez de quedarse vacío sin explicación.
//
// Del nodo se guarda la ruta y el nombre; las miniaturas no, que pesarían en
// el proyecto y se quedarían viejas: se leen al pintarlo, al volver a la
// ventana y al pasar el ratón (como mucho cada quince segundos).
// =====================================================

// Amarilla, el amarillo de la paleta de la aplicación: una carpeta de cartón.
const CARPETA_COLOR = '#F7DA84';
const CARPETA_ICONOS = {
  carpeta: 'folder', imagen: 'image', pdf: 'picture_as_pdf', video: 'movie', audio: 'music_note',
  texto: 'description', hoja: 'table_chart', presentacion: 'slideshow', otro: 'draft',
};

function CarpetaItem({ item, lang, onUpdate }) {
  const api = window.electronAPI && window.electronAPI.carpetaLeer ? window.electronAPI : null;
  const [info, setInfo] = React.useState(null);
  const ultimaLectura = React.useRef(0);
  const rutaRef = React.useRef(item.ruta);
  rutaRef.current = item.ruta;
  const onUpdateRef = React.useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  const lee = React.useCallback(async (forzar) => {
    const ruta = rutaRef.current;
    if (!api || !ruta) return;
    if (!forzar && Date.now() - ultimaLectura.current < 15000) return;
    ultimaLectura.current = Date.now();
    const r = await api.carpetaLeer(ruta);
    if (rutaRef.current !== ruta) return; // se cambió de carpeta mientras se leía
    setInfo(r);
  }, []);

  const elige = React.useCallback(async () => {
    if (!api) return;
    const ruta = await api.carpetaElegir(rutaRef.current || undefined);
    if (!ruta) return;
    const nombre = ruta.split(/[\\/]/).filter(Boolean).pop() || ruta;
    onUpdateRef.current({ ruta, nombre });
  }, []);

  const abre = async () => {
    if (!api || !item.ruta) return;
    const r = await api.carpetaAbrir(item.ruta);
    if (!r || !r.ok) {
      window.showToast && window.showToast(window.t('Esa carpeta ya no está donde estaba.', 'That folder is no longer where it was.'), 'error');
      lee(true);
    }
  };

  React.useEffect(() => { setInfo(null); lee(true); }, [item.ruta]);
  // Al volver a la aplicación (de mover archivos en el Explorador, por ejemplo)
  // se vuelve a mirar, para que el número y las miniaturas no mientan.
  React.useEffect(() => {
    const alVolver = () => lee(false);
    const pedido = (e) => { if (e.detail === item.id) { lee(true); } };
    const pedidoElegir = (e) => { if (e.detail === item.id) elige(); };
    window.addEventListener('focus', alVolver);
    window.addEventListener('odi-carpeta-leer', pedido);
    window.addEventListener('odi-carpeta-elegir', pedidoElegir);
    return () => {
      window.removeEventListener('focus', alVolver);
      window.removeEventListener('odi-carpeta-leer', pedido);
      window.removeEventListener('odi-carpeta-elegir', pedidoElegir);
    };
  }, [item.id]);

  const color = item.color
    ? (window.resolveStickyColor ? window.resolveStickyColor(item.color) : item.color)
    : CARPETA_COLOR;
  const muestras = info && info.ok ? info.muestras || [] : [];
  const perdida = info && !info.ok && info.motivo === 'no-esta';
  const nombre = (info && info.ok && info.nombre) || item.nombre || window.t('Carpeta', 'Folder');
  const fondo = muestras.find(m => m.miniatura);

  let pie = null;
  if (!api) pie = window.t('Solo en la aplicación de escritorio', 'Desktop app only');
  else if (!item.ruta) pie = null;
  else if (perdida) pie = window.t('No se encuentra', 'Not found');
  else if (info && info.ok) {
    const a = info.archivos, c = info.carpetas;
    pie = window.t(
      `${a} ${a === 1 ? 'archivo' : 'archivos'}, ${c} ${c === 1 ? 'carpeta' : 'carpetas'}`,
      `${a} ${a === 1 ? 'file' : 'files'}, ${c} ${c === 1 ? 'folder' : 'folders'}`);
  }

  return (
    <div
      className={`carpeta ${!item.ruta ? 'vacia' : ''} ${perdida ? 'perdida' : ''} ${muestras.length ? 'con-muestras' : ''}`}
      style={{ '--carpeta': color }}
      onMouseEnter={() => lee(false)}
      onDoubleClick={(e) => { e.stopPropagation(); if (item.ruta) abre(); else elige(); }}
      title={item.ruta || ''}
    >
      <div className="carpeta-dibujo">
        <div className="carpeta-trasera"/>
        {fondo && <div className="carpeta-fondo" style={{ backgroundImage: `url("${fondo.miniatura}")` }}/>}
        <div className="carpeta-hojas">
          {(muestras.length ? muestras : [null, null, null]).slice(0, 3).map((m, i) => (
            <div key={i} className={`carpeta-hoja h${i} ${m ? 'tipo-' + m.tipo : 'hueca'}`}>
              {m && m.miniatura
                ? <img src={m.miniatura} alt="" draggable={false}/>
                : m && (
                  <>
                    <span className="material-symbols-rounded">{CARPETA_ICONOS[m.tipo] || 'draft'}</span>
                    {/* La extensión en pequeño, como la etiqueta de un archivo. */}
                    {m.tipo !== 'carpeta' && /\.[a-z0-9]{1,5}$/i.test(m.nombre) && (
                      <span className="carpeta-hoja-ext">{m.nombre.split('.').pop().toUpperCase()}</span>
                    )}
                  </>
                )}
            </div>
          ))}
        </div>
        <div className="carpeta-delantera">
          <div className="carpeta-cara"/>
          <div className="carpeta-ventana"/>
          {!item.ruta && api && (
            <button
              className="carpeta-elegir"
              onClick={(e) => { e.stopPropagation(); elige(); }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <span className="material-symbols-rounded">folder_open</span>
              {window.t('Elegir carpeta', 'Choose folder')}
            </button>
          )}
          {perdida && api && (
            <button
              className="carpeta-elegir"
              onClick={(e) => { e.stopPropagation(); elige(); }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <span className="material-symbols-rounded">search</span>
              {window.t('Buscarla', 'Find it')}
            </button>
          )}
        </div>
      </div>
      <div className="carpeta-nombre">{nombre}</div>
      {pie && <div className="carpeta-cuenta">{pie}</div>}
    </div>
  );
}

window.CarpetaItem = CarpetaItem;
