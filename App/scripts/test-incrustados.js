// Que cada enlace se reconozca y dé su ficha.  node scripts/test-incrustados.js
const I = require('../src/incrustados.js');

let fallos = 0;
const check = (nombre, ok, extra) => {
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${extra ? ' — ' + JSON.stringify(extra) : ''}`);
  if (!ok) fallos++;
};
const s = (u) => I.servicio(u) || {};

// YouTube, en todas sus formas.
check('YouTube watch', s('https://www.youtube.com/watch?v=jNQXAC9IVRw').src === 'https://www.youtube.com/embed/jNQXAC9IVRw?autoplay=1&rel=0');
check('YouTube corto, shorts y móvil', s('https://youtu.be/jNQXAC9IVRw').tipo === 'youtube' && s('https://youtube.com/shorts/abcdefgh').tipo === 'youtube' && s('https://m.youtube.com/watch?v=jNQXAC9IVRw').tipo === 'youtube');
check('YouTube da su portada y su oEmbed', s('https://youtu.be/jNQXAC9IVRw').portada === 'https://i.ytimg.com/vi/jNQXAC9IVRw/hqdefault.jpg' && s('https://youtu.be/jNQXAC9IVRw').oembed.startsWith('https://www.youtube.com/oembed?format=json&url='));
check('la portada de YouTube sin vídeo no es nada', I.servicio('https://www.youtube.com/') === null);

// Spotify.
check('Spotify, canción (reproductor oscuro)', s('https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT?si=abc').src === 'https://open.spotify.com/embed/track/4cOdK2wGLETKBW3PvgPWqT?utm_source=oddinote&theme=0');
check('Spotify con idioma en la dirección', s('https://open.spotify.com/intl-es/album/1A2GTWGtFfWp7KSQTwWOyo').tipo === 'spotify');
check('una canción de Spotify mide su reproductor (152) más la barra', s('https://open.spotify.com/track/x').tamano.h === 152 + I.BARRA && s('https://open.spotify.com/playlist/x').tamano.h === 352 + I.BARRA && s('https://open.spotify.com/track/x').alto === 152);
check('el oEmbed de Spotify va sin parámetros de seguimiento', s('https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT?si=abc').oembed === 'https://open.spotify.com/oembed?url=' + encodeURIComponent('https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT'));
check('Spotify, la portada no vale', I.servicio('https://open.spotify.com/') === null);

// SoundCloud.
check('SoundCloud: reproductor compacto naranja', s('https://soundcloud.com/forss/flickermood').src.includes('visual=false') && s('https://soundcloud.com/forss/flickermood').alto === 166);
check('SoundCloud, sin parámetros de seguimiento', s('https://soundcloud.com/forss/flickermood?utm_source=x').oembed === 'https://soundcloud.com/oembed?format=json&url=' + encodeURIComponent('https://soundcloud.com/forss/flickermood'));
check('SoundCloud, una lista es más alta', s('https://soundcloud.com/forss/sets/soulhack').tamano.h === 300 + I.BARRA);
check('SoundCloud, una página suya que no es pista no vale', I.servicio('https://soundcloud.com/discover/sets') === null && I.servicio('https://soundcloud.com/forss') === null);

// CodePen.
check('CodePen de un equipo', s('https://codepen.io/team/codepen/pen/PNaGbb').src === 'https://codepen.io/team/codepen/embed/PNaGbb?default-tab=result');
check('CodePen de una persona', s('https://codepen.io/chriscoyier/pen/gfdDu').oembed === 'https://codepen.io/api/oembed?format=json&url=' + encodeURIComponent('https://codepen.io/chriscoyier/pen/gfdDu'));

// Lo que no es de estos servicios se queda como enlace normal.
check('Vimeo y Google Maps se quedan como enlace normal', I.servicio('https://vimeo.com/76979871') === null && I.servicio('https://www.google.com/maps/place/Torre+Eiffel') === null);
check('cualquier otra web, nada', I.servicio('https://github.com/Neuroxcx1/Odinote') === null && I.servicio('') === null && I.servicio('esto no es un enlace') === null);

// oEmbed: solo a los proveedores conocidos, y sus datos limpios.
check('solo se pregunta a los cuatro proveedores', I.proveedorValido(s('https://youtu.be/jNQXAC9IVRw').oembed) && !I.proveedorValido('https://evil.example/oembed?') && !I.proveedorValido('file:///c:/x'));
check('SoundCloud: el título sin «by Autor»', JSON.stringify(I.datosDe('soundcloud', { title: 'Flickermood by Forss', author_name: 'Forss', thumbnail_url: 'u' })) === JSON.stringify({ titulo: 'Flickermood', autor: 'Forss', portada: 'u' }));
check('una respuesta rara no rompe', I.datosDe('spotify', null) === null && I.datosDe('spotify', {}).titulo === '');

// Lo de antes sigue respondiendo (sin YouTube, que tenía su camino aparte).
check('incrustado() de antes', I.incrustado('https://open.spotify.com/track/x').tipo === 'spotify' && I.incrustado('https://youtu.be/jNQXAC9IVRw') === null);

console.log(fallos ? `\n${fallos} FALLAN` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
