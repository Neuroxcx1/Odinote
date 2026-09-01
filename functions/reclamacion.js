// =====================================================
// Odinote — la decisión de si una reclamación es válida
//
// Vive en su propio archivo y sin depender de Firebase a propósito: es la
// única parte de todo esto que decide algo, y así se puede probar de verdad
// con `node scripts/test-reclamacion.js`, sin nube y sin cuentas.
//
// El problema que resuelve: alguien dona en Ko-fi con su correo de Hotmail y
// luego entra en Odinote con su Google. Son dos correos distintos, así que la
// corona no le llega. Para arreglarlo tiene que poder demostrar que esa
// donación es suya, y lo hace diciendo dos cosas que solo sabe él: con qué
// correo pagó y cuánto pagó.
//
// Por qué el importe y no solo el correo: el correo de alguien se puede saber.
// Que además donó, y cuánto exactamente, ya no. Y como cada donación solo se
// puede reclamar una vez, el que llegue después se encuentra la puerta
// cerrada.
//
// Hasta dónde llega esto, dicho claro: quien conozca el correo de un donante Y
// acierte el importe puede quedarse con su corona. No es un candado
// criptográfico y no pretende serlo — al otro lado hay un adorno, no una
// función de pago. Lo que sí evita es que alguien se pasee reclamando a ciegas.
// =====================================================

(function () {
  'use strict';

  // Los importes llegan de sitios distintos y escritos de formas distintas:
  // Ko-fi manda "3.00", la persona escribe "3", o "3,00" si tiene el teclado
  // en español, o "$3" si copia de su recibo. Todos son la misma donación.
  function normalizaImporte(valor) {
    if (typeof valor === 'number') {
      return isFinite(valor) ? valor.toFixed(2) : null;
    }
    if (typeof valor !== 'string') return null;

    // El signo se descarta antes de limpiar, no después. Si se limpiara
    // primero, "-3" se quedaría en "3" y pasaría como una donación de tres:
    // el filtro de abajo se come el guion y con él la única señal de que ese
    // número no era lo que decía.
    if (valor.indexOf('-') !== -1) return null;

    var limpio = valor.trim().replace(/[^0-9.,]/g, '');
    if (!limpio) return null;

    // Si lleva las dos, la última es la decimal y la otra separa los miles.
    if (limpio.indexOf(',') !== -1 && limpio.indexOf('.') !== -1) {
      limpio = limpio.lastIndexOf(',') > limpio.lastIndexOf('.')
        ? limpio.replace(/\./g, '').replace(',', '.')
        : limpio.replace(/,/g, '');
    } else if (limpio.indexOf(',') !== -1) {
      limpio = limpio.replace(',', '.');
    }

    var n = parseFloat(limpio);
    if (!isFinite(n) || n < 0) return null;
    return n.toFixed(2);
  }

  function normalizaCorreo(valor) {
    if (typeof valor !== 'string') return null;
    var limpio = valor.trim().toLowerCase();
    if (!limpio || limpio.length > 320) return null;
    if (limpio.indexOf('/') !== -1) return null;
    if (limpio.indexOf('@') === -1) return null;
    if (/^__.*__$/.test(limpio)) return null;
    return limpio;
  }

  // `ficha` es lo que hay guardado de esa donación, o null si no hay nada.
  // Devuelve siempre un motivo, porque el de arriba necesita saber qué
  // decirle a la persona: no es lo mismo "no encuentro esa donación" que
  // "esa donación ya la reclamó alguien".
  function evalua(ficha, correoPedido, importePedido, correoDeSesion) {
    var correo = normalizaCorreo(correoPedido);
    if (!correo) return { ok: false, motivo: 'correo-invalido' };

    var mio = normalizaCorreo(correoDeSesion);
    if (!mio) return { ok: false, motivo: 'sin-sesion' };

    // Reclamar el correo con el que ya has entrado no tiene sentido: si esa
    // donación existiera, ya tendrías la corona sin hacer nada.
    if (correo === mio) return { ok: false, motivo: 'es-el-mismo' };

    var importe = normalizaImporte(importePedido);
    if (importe === null) return { ok: false, motivo: 'importe-invalido' };

    if (!ficha) return { ok: false, motivo: 'no-existe' };
    if (ficha.reclamadoPor) return { ok: false, motivo: 'ya-reclamado' };

    // Donaciones apuntadas antes de que se guardara el importe. No se pueden
    // comprobar, así que se mandan a la vía manual en vez de dejarlas pasar.
    var guardado = normalizaImporte(ficha.importe);
    if (guardado === null) return { ok: false, motivo: 'sin-importe' };

    if (guardado !== importe) return { ok: false, motivo: 'importe-no-cuadra' };

    return { ok: true, motivo: 'vale', correo: correo, mio: mio };
  }

  var Reclamacion = { evalua: evalua, normalizaImporte: normalizaImporte, normalizaCorreo: normalizaCorreo };
  if (typeof module !== 'undefined' && module.exports) module.exports = Reclamacion;
  if (typeof window !== 'undefined') window.Reclamacion = Reclamacion;
})();
