// =====================================================
// Oddinote — el nodo de galería
//
// Varias fotos en un solo nodo: un tablero de inspiración (un "moodboard") sin
// tener que colocar diez imágenes sueltas a mano. Se llena soltando fotos
// encima o con el botón de añadir, y tiene dos maneras de verse:
//
//   · Rejilla: todas a la vista, llenando el nodo. Las filas se reparten solas
//     según cuántas fotos hay y la forma del nodo, y la última fila se estira
//     para no dejar huecos.
//   · Pila: una encima de otra, un poco torcidas, como fotos de papel. Al pasar
//     el ratón se abren en abanico.
//
// Cada foto está colocada con posición absoluta y transiciones, así que cambiar
// de vista, añadir o quitar una foto, o estirar el nodo hasta que cambian las
// columnas, las mueve deslizándose a su sitio nuevo en vez de saltar.
//
// Doble clic en una foto abre el visor: la foto crece desde su sitio hasta
// ocupar la pantalla (como en la galería del iPhone), con flechas, teclado y
// una tira de miniaturas abajo; al cerrarlo vuelve a su sitio.
//
// Las fotos se guardan como las del nodo de imagen: al añadirlas se encogen
// (1600 px por el lado largo) y en el .exe con bóveda pasan a ser archivos de
// la carpeta del proyecto (ver saveBase64MediaLocally en app.jsx), y con Drive
// se suben por el mismo camino que las demás (syncProjectMedia en drive.js).
// Cada una lleva su propio id para eso.
//
// Lo que se PINTA no es la foto guardada sino una miniatura del tamaño que
// ocupa en la pantalla (galeria-miniaturas.js): con 111 fotos enteras el
// lienzo iba a tirones. Y en la pila solo se pintan las de arriba: las demás
// quedan debajo y no se ven.
// =====================================================

const GALERIA_LADO = 1600;   // lado largo máximo al guardar una foto
const GALERIA_HUECO = 6;     // separación entre fotos, en píxeles del lienzo
const GALERIA_BORDE = 8;     // margen del nodo alrededor de las fotos
const GALERIA_ABANICO = 7;   // cuántas se abren en el abanico de la pila
const GALERIA_EN_PILA = 12;  // cuántas se pintan en la pila (el resto no asoma)

// Encoge una foto antes de guardarla. Un GIF se deja tal cual, que encogerlo
// en un lienzo lo dejaría quieto; y si algo falla al encoger, también.
//
// De cuatro en cuatro y descodificando fuera del hilo de la página: soltar
// quinientas fotos de golpe las abría todas a la vez (gigas de memoria) y las
// encogía una detrás de otra con la ventana congelada.
const galeriaEncogiendo = { activos: 0, cola: [] };
function galeriaEncoge(file) {
  return new Promise((resolve) => {
    galeriaEncogiendo.cola.push(() => galeriaEncogeYa(file).then(resolve, () => resolve(null)));
    galeriaSigueEncogiendo();
  });
}
function galeriaSigueEncogiendo() {
  const g = galeriaEncogiendo;
  while (g.activos < 4 && g.cola.length) {
    const tarea = g.cola.shift();
    g.activos++;
    tarea().finally(() => { g.activos--; galeriaSigueEncogiendo(); });
  }
}
const galeriaComoDataURL = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = () => reject(r.error);
  r.readAsDataURL(blob);
});
async function galeriaEncogeYa(file) {
  if (/gif|svg/.test(file.type || '') || typeof createImageBitmap !== 'function' || typeof OffscreenCanvas === 'undefined') {
    return galeriaEncogeEnLaPagina(file);
  }
  let entera;
  try { entera = await createImageBitmap(file); } catch (e) { return galeriaEncogeEnLaPagina(file); }
  let bmp = entera;
  try {
    const escala = Math.min(1, GALERIA_LADO / Math.max(entera.width, entera.height));
    const w = Math.max(1, Math.round(entera.width * escala));
    const h = Math.max(1, Math.round(entera.height * escala));
    if (escala < 1) bmp = await createImageBitmap(entera, { resizeWidth: w, resizeHeight: h, resizeQuality: 'high' });
    const lienzo = new OffscreenCanvas(w, h);
    lienzo.getContext('2d').drawImage(bmp, 0, 0);
    let blob = await lienzo.convertToBlob({ type: 'image/webp', quality: 0.86 });
    let fileType = 'webp';
    if (!/webp/.test(blob.type)) { blob = await lienzo.convertToBlob({ type: 'image/jpeg', quality: 0.86 }); fileType = 'jpg'; }
    return { src: await galeriaComoDataURL(blob), w, h, fileType };
  } catch (e) {
    return galeriaEncogeEnLaPagina(file);
  } finally {
    if (bmp !== entera) bmp.close();
    entera.close();
  }
}
// La manera de antes, para lo que no pasa por la de arriba (un GIF, o un
// navegador sin createImageBitmap).
function galeriaEncogeEnLaPagina(file) {
  return new Promise((resolve) => {
    const tal = () => {
      const r = new FileReader();
      r.onload = () => {
        const tipo = String(file.type || '').split('/')[1] || 'png';
        resolve({ src: r.result, w: 0, h: 0, fileType: tipo === 'jpeg' ? 'jpg' : tipo });
      };
      r.onerror = () => resolve(null);
      r.readAsDataURL(file);
    };
    if (/gif|svg/.test(file.type || '')) { tal(); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const escala = Math.min(1, GALERIA_LADO / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * escala));
        const h = Math.max(1, Math.round(img.naturalHeight * escala));
        const lienzo = document.createElement('canvas');
        lienzo.width = w; lienzo.height = h;
        lienzo.getContext('2d').drawImage(img, 0, 0, w, h);
        let src = lienzo.toDataURL('image/webp', 0.86);
        let fileType = 'webp';
        if (!/^data:image\/webp/.test(src)) { src = lienzo.toDataURL('image/jpeg', 0.86); fileType = 'jpg'; }
        resolve({ src, w, h, fileType });
      } catch (e) { tal(); }
      finally { URL.revokeObjectURL(url); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); tal(); };
    img.src = url;
  });
}

const galeriaNuevoId = () => `f-${Date.now()}-${Math.floor(Math.random() * 99999)}`;

// Un número estable a partir del id de una foto: la inclinación de cada foto
// en la pila sale de aquí, para que no cambie cada vez que se pinta.
function galeriaSemilla(id, sal) {
  let h = 2166136261 ^ (sal || 0);
  const s = String(id);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10000) / 10000;
}

// ── La rejilla ──
// Prueba cada número de columnas y se queda con el que deja las celdas más
// cerca de un poco apaisadas (1,15) y la última fila menos estirada. Devuelve
// cada caja en porcentajes del área de las fotos: así, al estirar el nodo sin
// que cambie el reparto, las fotos crecen con él al instante, y solo se
// deslizan cuando de verdad cambian de sitio.
function galeriaRejilla(n, W, H, hueco) {
  if (!n || W <= 0 || H <= 0) return [];
  let mejor = null;
  for (let cols = 1; cols <= n; cols++) {
    const filas = Math.ceil(n / cols);
    const celdaW = (W - hueco * (cols - 1)) / cols;
    const celdaH = (H - hueco * (filas - 1)) / filas;
    if (celdaW <= 4 || celdaH <= 4) continue;
    const ultima = n - (filas - 1) * cols;
    const anchoUltima = (W - hueco * (ultima - 1)) / ultima;
    const nota = Math.abs(Math.log((celdaW / celdaH) / 1.15))
      + 0.45 * Math.abs(Math.log(anchoUltima / celdaW));
    if (!mejor || nota < mejor.nota) mejor = { cols, filas, celdaW, celdaH, ultima, anchoUltima, nota };
  }
  if (!mejor) return [];
  const cajas = [];
  for (let i = 0; i < n; i++) {
    const f = Math.floor(i / mejor.cols);
    const esUltima = f === mejor.filas - 1;
    const c = esUltima ? i - f * mejor.cols : i % mejor.cols;
    const w = esUltima ? mejor.anchoUltima : mejor.celdaW;
    const x = c * (w + hueco);
    const y = f * (mejor.celdaH + hueco);
    cajas.push({ x: x / W * 100, y: y / H * 100, w: w / W * 100, h: mejor.celdaH / H * 100 });
  }
  return cajas;
}

// ── La pila ──
// Todas del mismo tamaño en el centro, con su forma de verdad (si se sabe),
// un poco torcidas y movidas. En el abanico, las de arriba se reparten como
// una mano de cartas.
function galeriaPila(fotos, W, H) {
  const n = fotos.length;
  const visibles = Math.min(n, GALERIA_ABANICO);
  const mitad = (visibles - 1) / 2;
  return fotos.map((f, i) => {
    const forma = f.w && f.h ? f.w / f.h : 4 / 3;
    let w = W * 0.62, h = w / forma;
    if (h > H * 0.74) { h = H * 0.74; w = h * forma; }
    const x = (W - w) / 2, y = (H - h) / 2;
    const giro = (galeriaSemilla(f.id, 1) - 0.5) * 16;
    const dx = (galeriaSemilla(f.id, 2) - 0.5) * W * 0.05;
    const dy = (galeriaSemilla(f.id, 3) - 0.5) * H * 0.05;
    const k = Math.min(i, visibles - 1);
    const lado = visibles > 1 ? (k - mitad) / mitad : 0;
    return {
      x: x / W * 100, y: y / H * 100, w: w / W * 100, h: h / H * 100,
      // En reposo la primera va arriba y casi derecha: es la portada.
      reposo: i === 0 ? { dx: 0, dy: 0, giro: giro * 0.25 } : { dx, dy, giro },
      abanico: i < visibles
        ? { dx: lado * W * 0.3, dy: Math.abs(lado) * H * 0.08 - H * 0.03, giro: lado * 14 }
        : { dx: 0, dy: 0, giro },
      z: n - i,
    };
  });
}

// Lo que se pinta de cada foto: en el .exe, la copia de la bóveda si la hay;
// si esa no carga (viene de otro equipo), la de la nube.
function galeriaSrc(foto) {
  return window.displayMediaSrc ? window.displayMediaSrc(foto) : foto.src;
}
function galeriaSiFalla(e, foto) {
  const img = e.currentTarget;
  const remota = window.resolveMediaSrc ? window.resolveMediaSrc(foto.src) : foto.src;
  if (!img.dataset.probadaRemota && foto.srcLocal && img.getAttribute('src') !== remota) {
    img.dataset.probadaRemota = '1';
    img.src = remota;
    return;
  }
  window.driveImageFallback && window.driveImageFallback(e);
}
// Las fotos aparecen con un fundido al llegar su miniatura, en vez de
// pintarse a trozos.
const galeriaYaCargo = (e) => e.currentTarget.classList.add('lista');

// Qué pintar de una foto para un lado: su miniatura si ya está (o una mayor),
// y si no, la pide. '' mientras no hay nada; la foto de siempre si no hay
// miniatura que valga. "activa" dice si está cerca de verse: las que están
// lejos no piden nada.
function useGaleriaMini(foto, lado, activa) {
  const M = window.GaleriaMinis;
  const ahora = () => (M && M.hecha ? M.hecha(foto, lado) : { url: null, basta: true });
  const [url, setUrl] = React.useState(() => ahora().url);
  React.useEffect(() => {
    const h = ahora();
    setUrl(h.url);
    if (h.basta || !activa || !M) return;
    let vivo = true;
    M.pide(foto, lado).then(u => { if (vivo) setUrl(u); });
    return () => { vivo = false; };
  }, [foto.src, foto.srcLocal, lado, activa]);
  if (url === null) return galeriaSrc(foto);
  return url || '';
}

// Una miniatura suelta, para las listas largas (la tira del visor y el panel
// de ordenar): solo se pide cuando se acerca a la vista.
function GaleriaMiniImg({ foto, caja, className }) {
  const M = window.GaleriaMinis;
  const ref = React.useRef(null);
  const [ve, setVe] = React.useState(false);
  React.useEffect(() => {
    if (!M || !M.observa) { setVe(true); return; }
    return M.observa(ref.current, (si) => { if (si) setVe(true); });
  }, []);
  const lado = M ? M.ladoPara(foto, caja, caja, M.escalaRedonda(window.devicePixelRatio || 1)) : 0;
  const src = useGaleriaMini(foto, lado, ve);
  return (
    <span ref={ref} className={`galeria-mini-caja ${className || ''}`}>
      {src && <img src={src} alt="" draggable={false} onLoad={galeriaYaCargo} onError={(e) => galeriaSiFalla(e, foto)}/>}
    </span>
  );
}

// Cada foto por separado y memorizada: el lienzo vuelve a pintar todos sus
// nodos a cada paso al moverlo o hacer zoom, y así la galería no rehace sus
// cien fotos cada vez, solo las que cambian.
const GaleriaFoto = React.memo(function GaleriaFoto({ f, c, i, vista, orden, sale, lado, activa, acciones }) {
  const src = useGaleriaMini(f, lado, activa);
  const estilo = {
    left: c.x + '%', top: c.y + '%', width: c.w + '%', height: c.h + '%',
    zIndex: vista === 'pila' ? c.z : undefined,
    animationDelay: orden != null ? (orden * 70) + 'ms' : undefined,
  };
  if (vista === 'pila') {
    estilo['--pila-x'] = c.reposo.dx + 'px';
    estilo['--pila-y'] = c.reposo.dy + 'px';
    estilo['--pila-giro'] = c.reposo.giro + 'deg';
    estilo['--abanico-x'] = c.abanico.dx + 'px';
    estilo['--abanico-y'] = c.abanico.dy + 'px';
    estilo['--abanico-giro'] = c.abanico.giro + 'deg';
    estilo.transitionDelay = (Math.min(i, GALERIA_ABANICO) * 25) + 'ms';
  }
  return (
    <div
      data-foto={f.id}
      className={`galeria-foto ${orden != null ? 'entra' : ''} ${sale ? 'sale' : ''}`}
      style={estilo}
      onAnimationEnd={orden != null ? () => acciones.current.entro(f.id) : undefined}
      onDoubleClick={(e) => { e.stopPropagation(); acciones.current.abre(f.id, e.currentTarget); }}
    >
      {src && <img src={src} alt="" draggable={false} onLoad={galeriaYaCargo} onError={(e) => galeriaSiFalla(e, f)}/>}
      <button
        className="galeria-quitar"
        title={window.t('Quitar esta foto', 'Remove this photo')}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); acciones.current.quita(f.id); }}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <span className="material-symbols-rounded">close</span>
      </button>
    </div>
  );
});

// Las fotos que trae un arrastre: archivos de imagen, o la dirección de una
// imagen arrastrada desde el navegador.
function galeriaDeArrastre(dt) {
  const archivos = Array.from((dt && dt.files) || []).filter(f => /^image\//.test(f.type || ''));
  if (archivos.length) return { archivos };
  let url = '';
  try {
    const lista = dt.getData('text/uri-list');
    const html = dt.getData('text/html');
    url = lista ? lista.split('\n')[0].trim() : '';
    if (!url && html) { const m = html.match(/<img[^>]+src=["']([^"']+)["']/i); if (m) url = m[1]; }
  } catch (e) {}
  return /^(https?:|data:image\/)/.test(url) ? { url } : null;
}

function GaleriaItem({ item, lang, onUpdate }) {
  const fotos = Array.isArray(item.fotos) ? item.fotos : [];
  const vista = item.vista === 'pila' ? 'pila' : 'rejilla';
  const [soltando, setSoltando] = React.useState(false);
  const [cargando, setCargando] = React.useState(0);
  // Las que acaban de entrar (entran con rebote, una detrás de otra) y las que
  // se están yendo (se encogen antes de quitarse de verdad).
  const [recientes, setRecientes] = React.useState({});
  const [saliendo, setSaliendo] = React.useState({});
  const [visor, setVisor] = React.useState(null); // { i, desde }
  const fotosRef = React.useRef(fotos);
  fotosRef.current = fotos;
  const onUpdateRef = React.useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  const campoRef = React.useRef(null);
  const cajaRef = React.useRef(null);
  const raizRef = React.useRef(null);
  const profundidad = React.useRef(0);
  const M = window.GaleriaMinis;
  // Si está cerca de verse (entonces pide sus miniaturas; una galería en la
  // otra punta del lienzo no hace trabajar a nadie). Una vez vista se queda.
  const [activa, setActiva] = React.useState(false);
  // El zoom del lienzo por los píxeles de la pantalla, en escalones: decide
  // de qué tamaño se pide cada miniatura.
  const [escala, setEscala] = React.useState(() => (M ? M.escalaRedonda(window.devicePixelRatio || 1) : 1));

  React.useEffect(() => {
    if (!M || !M.observa) { setActiva(true); return; }
    return M.observa(raizRef.current, (si) => { if (si) setActiva(true); });
  }, []);
  // El lienzo pinta de nuevo todos los nodos a cada paso del zoom, así que
  // basta con mirarlo después de cada vez: el zoom está en --handle-libre
  // (1/zoom) de la superficie.
  React.useEffect(() => {
    if (!M) return;
    const sup = raizRef.current && raizRef.current.closest('.canvas-surface');
    const libre = sup ? parseFloat(sup.style.getPropertyValue('--handle-libre')) : 0;
    const e = M.escalaRedonda((libre > 0 ? 1 / libre : 1) * (window.devicePixelRatio || 1));
    if (e !== escala) setEscala(e);
  });

  const W = Math.max(40, (item.w || 420) - GALERIA_BORDE * 2);
  const H = Math.max(40, (item.h || 320) - GALERIA_BORDE * 2);

  const anade = async ({ archivos, url }) => {
    let nuevas = [];
    if (archivos && archivos.length) {
      setCargando(c => c + archivos.length);
      try {
        const hechas = await Promise.all(archivos.map(galeriaEncoge));
        nuevas = hechas.filter(Boolean).map((h, k) => ({
          id: galeriaNuevoId() + '-' + k, src: h.src, w: h.w, h: h.h, fileType: h.fileType,
          name: archivos[k] && archivos[k].name ? archivos[k].name : undefined,
        }));
      } finally {
        setCargando(c => Math.max(0, c - archivos.length));
      }
    } else if (url) {
      nuevas = [{ id: galeriaNuevoId(), src: url }];
    }
    if (!nuevas.length) return;
    setRecientes(r => { const s = { ...r }; nuevas.forEach((f, k) => { s[f.id] = k; }); return s; });
    onUpdateRef.current({ fotos: [...fotosRef.current, ...nuevas] });
    window.playAudioTone && window.playAudioTone('create');
  };

  const quita = (id) => {
    setSaliendo(s => ({ ...s, [id]: true }));
    window.playAudioTone && window.playAudioTone('delete');
    setTimeout(() => {
      onUpdateRef.current({ fotos: fotosRef.current.filter(f => f.id !== id) });
      setSaliendo(s => { const c = { ...s }; delete c[id]; return c; });
    }, 240);
  };

  const abreVisor = (i, el) => {
    const r = el ? el.getBoundingClientRect() : null;
    setVisor({ i, desde: r ? { left: r.left, top: r.top, width: r.width, height: r.height } : null });
    window.playAudioTone && window.playAudioTone('board_open');
  };

  // Los avisos de la barra del nodo: añadir, ver, y quitar desde su panel.
  React.useEffect(() => {
    const anadir = (e) => { if (e.detail === item.id && campoRef.current) campoRef.current.click(); };
    const ver = (e) => {
      if (e.detail !== item.id || !fotosRef.current.length) return;
      const el = cajaRef.current && cajaRef.current.querySelector('.galeria-foto');
      abreVisor(0, el);
    };
    const quitar = (e) => { if (e.detail && e.detail.id === item.id) quita(e.detail.foto); };
    window.addEventListener('odi-galeria-anadir', anadir);
    window.addEventListener('odi-galeria-ver', ver);
    window.addEventListener('odi-galeria-quitar', quitar);
    return () => {
      window.removeEventListener('odi-galeria-anadir', anadir);
      window.removeEventListener('odi-galeria-ver', ver);
      window.removeEventListener('odi-galeria-quitar', quitar);
    };
  }, [item.id]);

  // Soltar fotos encima. Se para aquí para que el lienzo no cree además un
  // nodo de imagen suelto con la misma foto (lo escucha en el documento).
  const alEntrar = (e) => {
    const tipos = Array.from((e.dataTransfer && e.dataTransfer.types) || []);
    if (!tipos.some(t => t === 'Files' || t === 'text/uri-list' || t === 'text/html')) return;
    e.preventDefault();
    profundidad.current += 1;
    setSoltando(true);
  };
  const alSalir = () => {
    profundidad.current = Math.max(0, profundidad.current - 1);
    if (!profundidad.current) setSoltando(false);
  };
  const alSoltar = (e) => {
    profundidad.current = 0;
    setSoltando(false);
    const lo = galeriaDeArrastre(e.dataTransfer);
    if (!lo) return;
    e.preventDefault();
    e.stopPropagation();
    anade(lo);
  };

  // En la pila solo las de arriba: con cien fotos, las otras noventa quedan
  // debajo sin asomar y solo costaban.
  const vistas = vista === 'pila' ? fotos.slice(0, GALERIA_EN_PILA) : fotos;
  const cajas = React.useMemo(
    () => (vista === 'pila' ? galeriaPila(vistas, W, H) : galeriaRejilla(fotos.length, W, H, GALERIA_HUECO)),
    [vista, fotos, W, H]
  );
  // Lo que hacen las fotos, siempre el mismo objeto para no deshacer la
  // memoria de GaleriaFoto; dentro, lo de este momento.
  const acciones = React.useRef({});
  acciones.current.abre = (id, el) => {
    const i = fotosRef.current.findIndex(x => x.id === id);
    if (i >= 0) abreVisor(i, el);
  };
  acciones.current.quita = quita;
  acciones.current.entro = (id) => setRecientes(r => { const s = { ...r }; delete s[id]; return s; });

  return (
    <div
      ref={raizRef}
      className={`galeria ${vista} ${fotos.length ? '' : 'vacia'} ${soltando ? 'soltando' : ''}`}
      style={{ background: window.nodeBg ? window.nodeBg(item) : 'var(--paper)', '--galeria-borde': GALERIA_BORDE + 'px' }}
      onDragEnter={alEntrar}
      onDragOver={(e) => { if (soltando) e.preventDefault(); }}
      onDragLeave={alSalir}
      onDrop={alSoltar}
    >
      <input
        ref={campoRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          const archivos = Array.from(e.target.files || []);
          e.target.value = '';
          if (archivos.length) anade({ archivos });
        }}
      />

      {fotos.length === 0 ? (
        <div className="galeria-vacia-caja">
          <span className="material-symbols-rounded galeria-vacia-icono">photo_library</span>
          <div className="galeria-vacia-texto">
            {cargando
              ? window.t('Preparando las fotos…', 'Getting the photos ready…')
              : window.t('Suelta aquí tus fotos', 'Drop your photos here')}
          </div>
          {!cargando && (
            <button
              className="galeria-boton"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); campoRef.current && campoRef.current.click(); }}
            >
              <span className="material-symbols-rounded">add_photo_alternate</span>
              {window.t('Añadir fotos', 'Add photos')}
            </button>
          )}
        </div>
      ) : (
        <div className="galeria-fotos" ref={cajaRef}>
          {vistas.map((f, i) => {
            const c = cajas[i];
            if (!c) return null;
            return (
              <GaleriaFoto
                key={f.id}
                f={f}
                c={c}
                i={i}
                vista={vista}
                orden={recientes[f.id]}
                sale={!!saliendo[f.id]}
                lado={M ? M.ladoPara(f, c.w * W / 100, c.h * H / 100, escala) : 0}
                activa={activa}
                acciones={acciones}
              />
            );
          })}
          {vista === 'pila' && fotos.length > 1 && (
            <div className="galeria-contador">{fotos.length}</div>
          )}
        </div>
      )}

      {soltando && (
        <div className="galeria-suelta">
          <span className="material-symbols-rounded">add_photo_alternate</span>
          {window.t('Suelta para añadir', 'Drop to add')}
        </div>
      )}
      {cargando > 0 && fotos.length > 0 && <div className="galeria-cargando"/>}

      {visor && (
        <GaleriaVisor
          fotos={fotos}
          inicio={visor.i}
          desde={visor.desde}
          rectDe={(i) => {
            // Por su id y no por su puesto: en la pila no están pintadas todas.
            const f = fotosRef.current[i];
            const el = f && cajaRef.current && [...cajaRef.current.querySelectorAll('.galeria-foto')].find(x => x.dataset.foto === f.id);
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return { left: r.left, top: r.top, width: r.width, height: r.height };
          }}
          onCerrar={() => setVisor(null)}
        />
      )}
    </div>
  );
}

// ── El visor ──
// Va en un portal, encima de todo. La foto crece desde su miniatura: se
// coloca en su sitio final y se anima desde la caja de la miniatura (escala
// y recorte), que es lo que hace que parezca la misma foto y no otra que
// aparece. Al cerrar hace el camino al revés hasta donde esté ahora su
// miniatura.
function GaleriaVisor({ fotos, inicio, desde, rectDe, onCerrar }) {
  const n = fotos.length;
  const [i, setI] = React.useState(Math.min(inicio, n - 1));
  const [cerrando, setCerrando] = React.useState(false);
  const imgRef = React.useRef(null);
  const fondoRef = React.useRef(null);
  const direccion = React.useRef(0);
  const abierto = React.useRef(false);
  const toque = React.useRef(null);
  const foto = fotos[i];

  // De la caja de la miniatura a la de la foto grande: cuánto moverla,
  // escalarla y recortarla para que empiece siendo la miniatura.
  const desdeCaja = (r1, r2) => {
    const s = Math.max(r1.width / r2.width, r1.height / r2.height);
    const dx = (r1.left + r1.width / 2) - (r2.left + r2.width / 2);
    const dy = (r1.top + r1.height / 2) - (r2.top + r2.height / 2);
    const recX = Math.max(0, (r2.width - r1.width / s) / 2);
    const recY = Math.max(0, (r2.height - r1.height / s) / 2);
    return {
      transform: `translate(${dx}px, ${dy}px) scale(${s})`,
      clipPath: `inset(${recY}px ${recX}px round ${2 / s}px)`,
    };
  };

  const animaEntrada = () => {
    const img = imgRef.current;
    if (!img || abierto.current) return;
    abierto.current = true;
    if (fondoRef.current && fondoRef.current.animate) {
      fondoRef.current.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 280, easing: 'ease-out' });
    }
    if (!desde || !img.animate) return;
    const r2 = img.getBoundingClientRect();
    if (!r2.width || !r2.height) return;
    const ini = desdeCaja(desde, r2);
    img.animate([
      { transform: ini.transform, clipPath: ini.clipPath },
      { transform: 'translate(0px, 0px) scale(1)', clipPath: 'inset(0px 0px round 4px)' },
    ], { duration: 460, easing: 'cubic-bezier(0.32, 1.18, 0.42, 1)' });
  };

  const cierra = () => {
    if (cerrando) return;
    setCerrando(true);
    window.playAudioTone && window.playAudioTone('click');
    const img = imgRef.current;
    const r1 = rectDe(i);
    const dura = 300;
    if (fondoRef.current && fondoRef.current.animate) {
      fondoRef.current.animate([{ opacity: 1 }, { opacity: 0 }], { duration: dura, easing: 'ease-in', fill: 'forwards' });
    }
    if (img && img.animate && r1 && r1.width) {
      const fin = desdeCaja(r1, img.getBoundingClientRect());
      img.animate([
        { transform: 'translate(0px, 0px) scale(1)', clipPath: 'inset(0px 0px round 4px)' },
        { transform: fin.transform, clipPath: fin.clipPath },
      ], { duration: dura, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' });
    } else if (img && img.animate) {
      img.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.92)' }],
        { duration: dura, easing: 'ease-in', fill: 'forwards' });
    }
    setTimeout(onCerrar, dura);
  };

  const ve = (k) => {
    if (n < 2) return;
    direccion.current = k > i || (i === n - 1 && k === 0) ? 1 : -1;
    if (i === 0 && k === n - 1) direccion.current = -1;
    setI((k + n) % n);
    window.playAudioTone && window.playAudioTone('click');
  };
  const siguiente = () => ve((i + 1) % n);
  const anterior = () => ve((i - 1 + n) % n);

  // La foto nueva entra deslizándose desde el lado hacia el que se va.
  React.useEffect(() => {
    if (!direccion.current || !imgRef.current || !imgRef.current.animate) return;
    imgRef.current.animate([
      { transform: `translateX(${direccion.current * 70}px) scale(0.96)`, opacity: 0 },
      { transform: 'translateX(0px) scale(1)', opacity: 1 },
    ], { duration: 360, easing: 'cubic-bezier(0.34, 1.3, 0.64, 1)' });
  }, [i]);

  // El teclado es del visor mientras está abierto: sin esto, Supr borraría el
  // nodo de detrás y las flechas moverían el lienzo.
  React.useEffect(() => {
    const tecla = (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); cierra(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); siguiente(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); anterior(); }
      else if (e.key === 'Delete' || e.key === 'Backspace' || e.key === ' ') e.preventDefault();
    };
    window.addEventListener('keydown', tecla, true);
    return () => window.removeEventListener('keydown', tecla, true);
  });

  if (!foto) return null;

  return ReactDOM.createPortal(
    // Los eventos de un portal suben por el árbol de React hasta el nodo del
    // lienzo: sin pararlos aquí, pulsar en el visor arrastraba la galería de
    // detrás y la rueda movía el lienzo.
    <div
      className="galeria-visor"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => { e.stopPropagation(); e.preventDefault(); }}
      onWheel={(e) => e.stopPropagation()}
      onPointerDown={(e) => { toque.current = e.clientX; }}
      onPointerUp={(e) => {
        const dx = toque.current == null ? 0 : e.clientX - toque.current;
        toque.current = null;
        if (Math.abs(dx) > 60) { dx < 0 ? siguiente() : anterior(); }
      }}
    >
      <div className="galeria-visor-fondo" ref={fondoRef} onClick={cierra}/>
      <div className="galeria-visor-arriba">
        <span className="galeria-visor-cuenta">{i + 1} / {n}</span>
        <button className="galeria-visor-cerrar" onClick={cierra} title={window.t('Cerrar (Esc)', 'Close (Esc)')}>
          <span className="material-symbols-rounded">close</span>
        </button>
      </div>
      <div className="galeria-visor-escena" onClick={(e) => { if (e.target === e.currentTarget) cierra(); }}>
        <img
          key={foto.id}
          ref={imgRef}
          className="galeria-visor-foto"
          src={galeriaSrc(foto)}
          alt=""
          draggable={false}
          // Nace invisible (ver .galeria-visor-foto) y se enseña al cargar,
          // ya colocada en la miniatura: si no, se veía un instante en grande
          // antes de empezar a crecer.
          onLoad={(e) => { e.currentTarget.classList.add('lista'); animaEntrada(); }}
          onError={(e) => { e.currentTarget.classList.add('lista'); galeriaSiFalla(e, foto); }}
        />
      </div>
      {n > 1 && (
        <>
          <button className="galeria-visor-flecha izq" onClick={anterior} title={window.t('Anterior', 'Previous')}>
            <span className="material-symbols-rounded">chevron_left</span>
          </button>
          <button className="galeria-visor-flecha der" onClick={siguiente} title={window.t('Siguiente', 'Next')}>
            <span className="material-symbols-rounded">chevron_right</span>
          </button>
          <div className="galeria-visor-tira">
            {fotos.map((f, k) => (
              <button
                key={f.id}
                className={`galeria-visor-mini ${k === i ? 'actual' : ''}`}
                onClick={() => ve(k)}
              >
                <GaleriaMiniImg foto={f} caja={50}/>
              </button>
            ))}
          </div>
        </>
      )}
    </div>,
    document.body
  );
}

window.GaleriaItem = GaleriaItem;
window.GaleriaMiniImg = GaleriaMiniImg;
window.galeriaRejilla = galeriaRejilla;
