// =====================================================
// Oddinote — los enlaces que se ven dentro del nodo (window.OdiIncrusta)
//
// YouTube, Spotify, SoundCloud y CodePen tienen una dirección pública para
// incrustar y otra (oEmbed) que da su título, autor y portada, sin cuenta ni
// clave: lo que el usuario pidió («gratis y fácil»). Con eso el nodo de
// enlace pinta una tarjeta propia de cada servicio (src/EnlaceServicio.jsx)
// en vez de la de una web cualquiera, que sigue igual que antes.
//
// Fuera, a propósito: Vimeo (dentro del programa dice «No se pudo reproducir
// el video», probado dos veces) y Google Maps (ya hay un nodo de mapa).
//
// `tamano` es el que le sienta a la tarjeta: en la música mide justo lo que
// el reproductor, para que al darle a reproducir no quede hueco (en Spotify
// se veía una franja verde vacía debajo). Sin React ni DOM, para probarlo
// desde Node (scripts/test-incrustados.js).
// =====================================================
(function () {
  function url(u) {
    if (!u) return null;
    let s = String(u).trim();
    if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
    try { return new URL(s); } catch (e) { return null; }
  }
  const sinWww = (h) => h.replace(/^www\.|^m\./, '').toLowerCase();
  const ANCHO = 420;
  // La barra que lleva la tarjeta de música encima del reproductor mientras
  // suena: por ella se coge el nodo (el reproductor se queda los clics) y
  // tiene el botón de parar.
  const BARRA = 28;

  function servicio(enlace) {
    const u = url(enlace);
    if (!u) return null;
    const host = sinWww(u.hostname);
    const partes = u.pathname.split('/').filter(Boolean);

    // YouTube: watch?v=ID, youtu.be/ID, /shorts/ID, /embed/ID.
    let yt = null;
    if (host === 'youtu.be') yt = partes[0];
    else if (host === 'youtube.com' || host === 'music.youtube.com') {
      yt = u.searchParams.get('v') || (['shorts', 'embed', 'live'].includes(partes[0]) ? partes[1] : null);
    }
    if (yt && /^[\w-]{6,}$/.test(yt)) {
      const canon = `https://www.youtube.com/watch?v=${yt}`;
      return {
        tipo: 'youtube', nombre: 'YouTube', forma: 'video', color: '#FF0033',
        src: `https://www.youtube.com/embed/${yt}?autoplay=1&rel=0`,
        oembed: `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(canon)}`,
        portada: `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`,
        tamano: { w: ANCHO, h: 292 },
      };
    }

    // Spotify: open.spotify.com/(intl-es/)track/ID, y álbumes, listas, episodios…
    if (host === 'open.spotify.com') {
      const p = partes[0] && /^intl-/.test(partes[0]) ? partes.slice(1) : partes;
      if (['track', 'album', 'playlist', 'episode', 'show', 'artist'].includes(p[0]) && p[1]) {
        const corto = p[0] === 'track' || p[0] === 'episode';
        const alto = corto ? 152 : 352;
        return {
          tipo: 'spotify', nombre: 'Spotify', forma: 'musica', color: '#1DB954',
          // theme=0: el reproductor oscuro, que casa con la tarjeta.
          src: `https://open.spotify.com/embed/${p[0]}/${p[1]}?utm_source=oddinote&theme=0`,
          oembed: `https://open.spotify.com/oembed?url=${encodeURIComponent(`https://open.spotify.com/${p[0]}/${p[1]}`)}`,
          alto, tamano: { w: ANCHO, h: alto + BARRA },
        };
      }
    }

    // SoundCloud: soundcloud.com/usuario/pista (o /sets/lista).
    if (host === 'soundcloud.com' && partes.length >= 2 && !['discover', 'search', 'you', 'upload', 'stream'].includes(partes[0])) {
      const limpia = `https://soundcloud.com/${partes.join('/')}`;
      const lista = partes[1] === 'sets';
      const alto = lista ? 300 : 166;
      return {
        tipo: 'soundcloud', nombre: 'SoundCloud', forma: 'musica', color: '#FF5500',
        src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(limpia)}&auto_play=true&visual=false&color=%23ff5500&show_teaser=false`,
        oembed: `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(limpia)}`,
        alto, tamano: { w: ANCHO, h: alto + BARRA },
      };
    }

    // CodePen: codepen.io/usuario/pen/ID (las de equipo, /team/nombre/pen/ID).
    if (host === 'codepen.io') {
      const p = partes[0] === 'team' ? [partes[0] + '/' + partes[1], ...partes.slice(2)] : partes;
      if (p.length >= 3 && ['pen', 'full', 'details'].includes(p[1])) {
        return {
          tipo: 'codepen', nombre: 'CodePen', forma: 'video', color: '#1E1F26',
          src: `https://codepen.io/${p[0]}/embed/${p[2]}?default-tab=result`,
          oembed: `https://codepen.io/api/oembed?format=json&url=${encodeURIComponent(`https://codepen.io/${p[0]}/pen/${p[2]}`)}`,
          tamano: { w: ANCHO, h: 292 },
        };
      }
    }
    return null;
  }

  // Los proveedores de oEmbed a los que se deja preguntar (main.js solo pide
  // a estos: no es un pasadizo para pedir cualquier dirección).
  const PROVEEDORES = ['https://www.youtube.com/oembed?', 'https://open.spotify.com/oembed?', 'https://soundcloud.com/oembed?', 'https://codepen.io/api/oembed?'];
  const proveedorValido = (u) => PROVEEDORES.some(p => String(u || '').startsWith(p));

  // Lo que interesa de una respuesta de oEmbed (cada servicio la da distinta).
  function datosDe(tipo, j) {
    if (!j || typeof j !== 'object') return null;
    let titulo = String(j.title || '').trim();
    const autor = String(j.author_name || '').trim();
    // SoundCloud pone «Pista by Autor» en el título.
    if (tipo === 'soundcloud' && autor && titulo.endsWith(' by ' + autor)) titulo = titulo.slice(0, -(' by ' + autor).length);
    return { titulo, autor, portada: j.thumbnail_url || null };
  }

  // Compatibilidad: lo de antes (solo dirección y alto).
  function incrustado(enlace) {
    const s = servicio(enlace);
    return s && s.tipo !== 'youtube' ? { tipo: s.tipo, src: s.src, alto: s.alto || s.tamano.h } : null;
  }

  const api = { servicio, incrustado, datosDe, proveedorValido, PROVEEDORES, BARRA };
  if (typeof window !== 'undefined') window.OdiIncrusta = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
