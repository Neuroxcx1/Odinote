// =====================================================
// Oddinote — la tarjeta de un enlace de YouTube, Spotify, SoundCloud o
// CodePen (window.EnlaceServicio)
//
// El usuario lo pidió así: que el nodo de enlace no sea solo pegar un enlace,
// que los de estos servicios queden «bien y estéticos» (en Spotify el
// reproductor dejaba una franja verde vacía debajo), y que un enlace a una
// web cualquiera siga como estaba (eso lo pinta LinkItem, en items.jsx).
//
//  · Música (Spotify, SoundCloud): portada cuadrada, título y artista, y
//    «Reproducir». Al darle, el reproductor ocupa la tarjeta, que mide justo
//    lo que él más una barra fina encima: por la barra se coge el nodo (el
//    reproductor se queda los clics) y en ella está «Parar».
//  · Vídeo y código (YouTube, CodePen): miniatura 16:9 con ▶ grande y, debajo,
//    el título y el autor. Al darle, el reproductor ocupa la miniatura.
//
// Los datos salen de oEmbed (src/incrustados.js): por main.js en el programa
// (los servicios no dejan que una página se los pida) y directo en la web y
// el teléfono. Si no llegan, la tarjeta sale igual, con lo que dice el enlace.
// El reproductor solo se carga al pulsar: diez cargando a la vez pesarían.
// =====================================================
(function () {
  const { useState, useEffect } = React;
  const CACHE = {};

  async function pideDatos(s) {
    if (CACHE[s.oembed]) return CACHE[s.oembed];
    const I = window.OdiIncrusta;
    let j = null;
    try {
      if (window.electronAPI && window.electronAPI.oembed) {
        const r = await window.electronAPI.oembed(s.oembed);
        if (r && r.ok) j = r.datos;
      } else {
        const r = await fetch(s.oembed);
        if (r.ok) j = await r.json();
      }
    } catch (e) {}
    const d = I.datosDe(s.tipo, j) || { titulo: '', autor: '', portada: null };
    if (!d.portada && s.portada) d.portada = s.portada;
    if (j) CACHE[s.oembed] = d;
    return d;
  }

  // Lo que se puede decir sin datos: «Pen de usuario», «Canción en Spotify»…
  function textoDeReserva(s, url) {
    try {
      const p = new URL(url).pathname.split('/').filter(Boolean);
      if (s.tipo === 'codepen') return { titulo: window.t('Un pen de CodePen', 'A CodePen pen'), autor: (p[0] === 'team' ? p[1] : p[0]) || '' };
      if (s.tipo === 'soundcloud') return { titulo: (p[1] || '').replace(/-/g, ' '), autor: (p[0] || '').replace(/-/g, ' ') };
    } catch (e) {}
    return { titulo: s.nombre, autor: '' };
  }

  const LOGOS = {
    youtube: 'https://www.google.com/s2/favicons?domain=youtube.com&sz=64',
    spotify: 'https://www.google.com/s2/favicons?domain=spotify.com&sz=64',
    soundcloud: 'https://www.google.com/s2/favicons?domain=soundcloud.com&sz=64',
    codepen: 'https://www.google.com/s2/favicons?domain=codepen.io&sz=64',
  };

  function EnlaceServicio({ item, servicio: s, onOpen }) {
    const [datos, setDatos] = useState(() => CACHE[s.oembed] || null);
    const [suena, setSuena] = useState(false);
    useEffect(() => {
      let vivo = true;
      setDatos(CACHE[s.oembed] || null);
      pideDatos(s).then(d => { if (vivo) setDatos(d); });
      return () => { vivo = false; };
    }, [s.oembed]);
    useEffect(() => { setSuena(false); }, [item.url]);

    const reserva = textoDeReserva(s, item.url);
    const titulo = (item.title != null && item.title !== '') ? item.title : ((datos && datos.titulo) || reserva.titulo);
    const autor = (datos && datos.autor) || reserva.autor || (s.tipo === 'spotify' ? window.t('En Spotify', 'On Spotify') : '');
    // La miniatura de CodePen viene con márgenes blancos y queda pobre: su
    // tarjeta lleva un fondo oscuro propio (styles.css, .svc-codepen).
    const portada = s.tipo === 'codepen' ? null : ((datos && datos.portada) || s.portada || null);
    const para = (e) => e.stopPropagation();
    // YouTube, en el idioma de la app y sin subtítulos forzados: dentro del
    // programa los sacaba solos, y en alemán.
    const idioma = window.currentLang || 'es';
    const src = s.tipo === 'youtube' ? `${s.src}&hl=${idioma}&cc_lang_pref=${idioma}&cc_load_policy=0` : s.src;
    const reproductor = (
      <iframe
        className="svc-iframe"
        src={src}
        title={titulo}
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture"
        allowFullScreen
        // YouTube (desde 2025) pide saber desde qué página se incrusta.
        referrerPolicy="strict-origin-when-cross-origin"
        onMouseDown={para}
      />
    );
    const abrir = (
      <button className="svc-abrir" title={window.t(`Abrir en ${s.nombre}`, `Open in ${s.nombre}`)} onMouseDown={para} onClick={(e) => { e.stopPropagation(); onOpen(); }}>
        <span className="material-symbols-rounded">open_in_new</span>
      </button>
    );

    if (s.forma === 'musica') {
      return (
        <div className={`svc svc-musica svc-${s.tipo}${suena ? ' suena' : ''}`}>
          {suena ? (
            <>
              <div className="svc-barra">
                <img src={LOGOS[s.tipo]} alt="" />
                <span className="svc-barra-titulo">{titulo}</span>
                <button className="svc-parar" title={window.t('Parar', 'Stop')} onMouseDown={para} onClick={(e) => { e.stopPropagation(); setSuena(false); }}>
                  <span className="material-symbols-rounded">stop</span>
                </button>
              </div>
              <div className="svc-reproductor" style={{ height: s.alto }}>{reproductor}</div>
            </>
          ) : (
            <>
              <div className="svc-portada" style={portada ? { backgroundImage: `url(${portada})` } : null}>
                {!portada && <span className="material-symbols-rounded">music_note</span>}
              </div>
              <div className="svc-info">
                <div className="svc-marca"><img src={LOGOS[s.tipo]} alt="" /><span>{s.nombre}</span></div>
                <div className="svc-titulo">{titulo}</div>
                {autor && <div className="svc-autor">{autor}</div>}
                <div className="svc-acciones">
                  <button className="svc-reproducir" onMouseDown={para} onClick={(e) => { e.stopPropagation(); setSuena(true); }}>
                    <span className="material-symbols-rounded">play_arrow</span>
                    <span>{window.t('Reproducir', 'Play')}</span>
                  </button>
                  {abrir}
                </div>
              </div>
            </>
          )}
        </div>
      );
    }

    return (
      <div className={`svc svc-video svc-${s.tipo}${suena ? ' suena' : ''}`}>
        <div className="svc-medio" style={!suena && portada ? { backgroundImage: `url(${portada})` } : null}>
          {suena ? reproductor : (
            <button className="svc-play-grande" title={s.tipo === 'codepen' ? window.t('Ver aquí', 'View here') : window.t('Reproducir', 'Play')} onMouseDown={para} onClick={(e) => { e.stopPropagation(); setSuena(true); }}>
              <span className="material-symbols-rounded">{s.tipo === 'codepen' ? 'code' : 'play_arrow'}</span>
            </button>
          )}
        </div>
        <div className="svc-pie">
          <img src={LOGOS[s.tipo]} alt="" />
          <div className="svc-textos">
            <b>{titulo}</b>
            <span>{[autor !== s.nombre ? autor : null, s.nombre].filter(Boolean).join(' · ')}</span>
          </div>
          {suena && (
            <button className="svc-parar" title={window.t('Parar', 'Stop')} onMouseDown={para} onClick={(e) => { e.stopPropagation(); setSuena(false); }}>
              <span className="material-symbols-rounded">stop</span>
            </button>
          )}
          {abrir}
        </div>
      </div>
    );
  }

  window.EnlaceServicio = EnlaceServicio;
})();
