// =====================================================
// Oddinote — qué enlaces se pueden ver dentro del nodo (window.OdiIncrusta)
//
// El nodo de enlace ya reproducía YouTube dentro. Desde la 1.2.2 también
// Spotify, SoundCloud y CodePen: tienen una dirección pública para incrustar
// que no pide cuenta ni clave (lo que el usuario pidió: «gratis y fácil»).
// Fuera, a propósito: Vimeo (dentro del programa dice «No se pudo reproducir
// el video», probado dos veces) y Google Maps (ya hay un nodo de mapa). Aquí solo se traduce el enlace normal a
// esa dirección; LinkItem (items.jsx) pone el <iframe> al pulsar «Ver aquí»,
// y no antes: diez reproductores cargando a la vez en un lienzo pesarían.
//
// Solo están los que se probaron con enlaces reales dentro del .exe. Sin
// React ni DOM, para probar las cuentas desde Node (scripts/test-incrustados.js).
// =====================================================
(function () {
  function url(u) {
    if (!u) return null;
    let s = String(u).trim();
    if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
    try { return new URL(s); } catch (e) { return null; }
  }
  const sinWww = (h) => h.replace(/^www\./, '').toLowerCase();

  // Devuelve { tipo, src, alto } o null. `alto` es la altura que le sienta al
  // reproductor (lo que el nodo crece al abrirlo si es más bajo).
  function incrustado(enlace) {
    const u = url(enlace);
    if (!u) return null;
    const host = sinWww(u.hostname);
    const partes = u.pathname.split('/').filter(Boolean);

    // Spotify: open.spotify.com/(intl-es/)track/ID, y álbumes, listas, episodios…
    if (host === 'open.spotify.com') {
      const p = partes[0] && /^intl-/.test(partes[0]) ? partes.slice(1) : partes;
      if (['track', 'album', 'playlist', 'episode', 'show', 'artist'].includes(p[0]) && p[1]) {
        return { tipo: 'spotify', src: `https://open.spotify.com/embed/${p[0]}/${p[1]}`, alto: p[0] === 'track' || p[0] === 'episode' ? 232 : 380 };
      }
    }
    // SoundCloud: soundcloud.com/usuario/pista (o /sets/lista).
    if (host === 'soundcloud.com' && partes.length >= 2 && !['discover', 'search', 'you', 'upload', 'stream'].includes(partes[0])) {
      const limpia = `https://soundcloud.com/${partes.join('/')}`;
      return { tipo: 'soundcloud', src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(limpia)}&auto_play=true&visual=true`, alto: 300 };
    }
    // CodePen: codepen.io/usuario/pen/ID → el resultado del pen.
    // Las cuentas de equipo van como /team/nombre/pen/ID.
    if (host === 'codepen.io') {
      const p = partes[0] === 'team' ? [partes[0] + '/' + partes[1], ...partes.slice(2)] : partes;
      if (p.length >= 3 && ['pen', 'full', 'details'].includes(p[1])) {
        return { tipo: 'codepen', src: `https://codepen.io/${p[0]}/embed/${p[2]}?default-tab=result`, alto: 340 };
      }
    }
    return null;
  }

  const api = { incrustado };
  if (typeof window !== 'undefined') window.OdiIncrusta = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
