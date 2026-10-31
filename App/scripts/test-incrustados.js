// Que cada enlace se traduzca a su reproductor.  node scripts/test-incrustados.js
const I = require('../src/incrustados.js');

let fallos = 0;
const check = (nombre, ok, extra) => {
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${extra ? ' — ' + extra : ''}`);
  if (!ok) fallos++;
};
const src = (u) => (I.incrustado(u) || {}).src || null;


check('Spotify, canción', src('https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT?si=abc') === 'https://open.spotify.com/embed/track/4cOdK2wGLETKBW3PvgPWqT');
check('Spotify con idioma en la dirección', src('https://open.spotify.com/intl-es/album/1A2GTWGtFfWp7KSQTwWOyo') === 'https://open.spotify.com/embed/album/1A2GTWGtFfWp7KSQTwWOyo');
check('Spotify, la portada no vale', src('https://open.spotify.com/') === null);
check('una canción es más baja que una lista', I.incrustado('https://open.spotify.com/track/x').alto < I.incrustado('https://open.spotify.com/playlist/x').alto);

check('SoundCloud', src('https://soundcloud.com/forss/flickermood') === 'https://w.soundcloud.com/player/?url=' + encodeURIComponent('https://soundcloud.com/forss/flickermood') + '&auto_play=true&visual=true');
check('SoundCloud sin parámetros de seguimiento', src('https://soundcloud.com/forss/flickermood?utm_source=x').includes(encodeURIComponent('https://soundcloud.com/forss/flickermood') + '&'));
check('SoundCloud, una página suya que no es pista no vale', src('https://soundcloud.com/discover/sets') === null && src('https://soundcloud.com/forss') === null);


check('CodePen de un equipo', src('https://codepen.io/team/codepen/pen/PNaGbb') === 'https://codepen.io/team/codepen/embed/PNaGbb?default-tab=result');
check('CodePen de una persona', src('https://codepen.io/chriscoyier/pen/gfdDu') === 'https://codepen.io/chriscoyier/embed/gfdDu?default-tab=result');
// Vimeo no va dentro del programa y Maps tiene su propio nodo: se quedan
// como enlace normal.
check('Vimeo y Google Maps se quedan como enlace normal', src('https://vimeo.com/76979871') === null && src('https://www.google.com/maps/place/Torre+Eiffel/@48.8583701,2.2944813,17z') === null);
check('cualquier otra web, nada', src('https://github.com/Neuroxcx1/Odinote') === null && src('') === null && src('esto no es un enlace') === null);

console.log(fallos ? `\n${fallos} FALLAN` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
