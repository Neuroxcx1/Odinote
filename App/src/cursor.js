// =====================================================
// Odinote — el cursor de quien invita a un café
//
// Lo que se compra con una donación es esto: que el programa se parezca un poco
// más a ti. Así que la personalización va aquí y no en Ajustes — en Ajustes
// estaría escondida entre veinte cosas y no la vería nadie.
//
// Dos maneras, y ninguna es un menú de veinte opciones:
//
//   · El color. La misma flecha de siempre, en el color que se elija. Es lo que
//     usa casi todo el mundo, porque cambia lo justo.
//   · Una imagen propia. Ahí ya se puede poner cualquier cosa.
//
// Se guarda en el equipo y no en la cuenta: es una preferencia de esta máquina,
// como el tema o el volumen, y nadie espera que su cursor viaje a otro ordenador.
//
// Y se apaga solo si deja de haber corona (ver `patrocinio.js`). No hay que
// borrarlo al perderla: basta con no aplicarlo.
// =====================================================

(function () {
  'use strict';

  var CLAVE = 'odinote.cursor.v1';
  var ID_ESTILO = 'odi-cursor-propio';

  // El tamaño al que se recorta una imagen subida. No es un capricho: los
  // navegadores ignoran un cursor de más de 128 píxeles y lo dejan en la flecha
  // del sistema, sin avisar de nada. A 40 se ve bien y va sobrado de margen.
  var LADO = 40;

  function lee() {
    try {
      var crudo = localStorage.getItem(CLAVE);
      if (!crudo) return null;
      var c = JSON.parse(crudo);
      if (!c || (c.modo !== 'color' && c.modo !== 'imagen')) return null;
      return c;
    } catch (e) {
      return null;
    }
  }

  function guarda(cfg) {
    try {
      if (cfg) localStorage.setItem(CLAVE, JSON.stringify(cfg));
      else localStorage.removeItem(CLAVE);
    } catch (e) {}
  }

  // La flecha de Odinote, con el color que se le pida. Es la misma silueta que
  // lleva la aplicación de fábrica: cambiarla entera desorienta, y lo que se
  // quiere aquí es que se note que es tuya, no que sea otra cosa.
  function flechaSVG(color) {
    var c = encodeURIComponent(color || '#E0A82E');
    return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'" +
           " viewBox='0 0 24 24' fill='none'%3E%3Cpath d='M4.5 4.5L12.5 20.5L15.5 13.5L22.5 10.5L4.5 4.5Z'" +
           " fill='%231A1A1A' stroke='" + c + "' stroke-width='1.5' stroke-linejoin='round'/%3E%3C/svg%3E";
  }

  function urlDe(cfg) {
    if (!cfg) return null;
    if (cfg.modo === 'imagen') return cfg.imagen || null;
    return flechaSVG(cfg.color);
  }

  // Pone o quita el cursor. Se hace con una hoja de estilo propia y no tocando
  // `style` de cada elemento porque el cursor cambia en decenas de sitios —los
  // botones, los enlaces, el lienzo— y perseguirlos uno a uno no acabaría nunca.
  function aplica(cfg) {
    var hoja = document.getElementById(ID_ESTILO);
    var url = urlDe(cfg);

    if (!url) {
      if (hoja) hoja.remove();
      return false;
    }

    if (!hoja) {
      hoja = document.createElement('style');
      hoja.id = ID_ESTILO;
      document.head.appendChild(hoja);
    }

    // El punto activo va en la punta de la flecha (4,4) cuando es la de casa. En
    // una imagen subida se centra: no hay forma de adivinar dónde está su punta,
    // y el centro es lo que menos sorprende.
    var ancla = cfg.modo === 'imagen' ? '20 20' : '4 4';

    // `!important` porque las reglas de la aplicación son muy concretas —hay una
    // por tipo de botón— y sin esto solo cambiaría el cursor del fondo.
    hoja.textContent =
      'body[data-patrocinador="1"], body[data-patrocinador="1"] * {' +
      '  cursor: url("' + url + '") ' + ancla + ', auto !important;' +
      '}' +
      'body[data-patrocinador="1"] a, body[data-patrocinador="1"] button,' +
      'body[data-patrocinador="1"] [role="button"], body[data-patrocinador="1"] .icon-btn,' +
      'body[data-patrocinador="1"] .btn, body[data-patrocinador="1"] .project-card {' +
      '  cursor: url("' + url + '") ' + ancla + ', pointer !important;' +
      '}';
    return true;
  }

  // Recorta una imagen a un cuadrado del tamaño que admite un cursor. Devuelve
  // una promesa con la imagen ya lista para usar.
  function preparaImagen(archivo) {
    return new Promise(function (resolve, reject) {
      if (!archivo || !/^image\//.test(archivo.type)) {
        reject(new Error('no-es-imagen'));
        return;
      }
      var lector = new FileReader();
      lector.onerror = function () { reject(new Error('no-se-pudo-leer')); };
      lector.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error('no-se-pudo-leer')); };
        img.onload = function () {
          try {
            var lienzo = document.createElement('canvas');
            lienzo.width = LADO;
            lienzo.height = LADO;
            var ctx = lienzo.getContext('2d');
            // Se encaja dentro del cuadrado sin deformar: una imagen estirada
            // como cursor queda fatal y no hay forma de arreglarlo después.
            var escala = Math.min(LADO / img.width, LADO / img.height);
            var an = Math.max(1, Math.round(img.width * escala));
            var al = Math.max(1, Math.round(img.height * escala));
            ctx.drawImage(img, Math.round((LADO - an) / 2), Math.round((LADO - al) / 2), an, al);
            resolve(lienzo.toDataURL('image/png'));
          } catch (e) {
            reject(new Error('no-se-pudo-leer'));
          }
        };
        img.src = lector.result;
      };
      lector.readAsDataURL(archivo);
    });
  }

  window.CursorOdinote = {
    LADO: LADO,
    lee: lee,
    guarda: guarda,
    aplica: aplica,
    flechaSVG: flechaSVG,
    urlDe: urlDe,
    preparaImagen: preparaImagen,
  };
})();
