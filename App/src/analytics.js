// =====================================================
// Odinote — medición de uso (window.odiTrack)
//
// Solo cuenta CUÁNTOS y QUÉ, nunca QUIÉN: aquí no viaja ni un nombre, ni un
// correo, ni el contenido de una nota. Enviar algo que identifique a una
// persona incumpliría las condiciones de Google y la ley de protección de
// datos, además de ser una traición a lo que promete la aplicación.
//
// Todo esto se apaga solo cuando la copia no es la web oficial ni el programa
// instalado (window.ODINOTE_PLATFORM === 'dev'), así que quien trabaje sobre
// el código no envía nada ni ensucia las cuentas.
// =====================================================
(function () {
  'use strict';

  const activo = () =>
    typeof window !== 'undefined' &&
    window.ODINOTE_PLATFORM &&
    window.ODINOTE_PLATFORM !== 'dev' &&
    typeof window.gtag === 'function';

  function odiTrack(nombre, params) {
    if (!activo()) return;
    try {
      window.gtag('event', nombre, Object.assign({
        odi_platform: window.ODINOTE_PLATFORM,
        odi_version: window.ODINOTE_BUILD || '',
      }, params || {}));
    } catch (e) {}
  }
  window.odiTrack = odiTrack;

  // Escritorio y web separados SIN tocar nada en la consola.
  //
  // La forma fina de separarlos es la propiedad odi_platform de arriba, pero
  // para verla hay que darla de alta como dimensión personalizada en Google
  // Analytics, y hasta que eso pase el dato se recoge y no se puede mirar.
  // Un nombre de evento distinto por plataforma sale en el informe de eventos
  // tal cual, sin configurar nada: dos contadores que se leen de un vistazo.
  function odiTrackPorPlataforma(nombre, params) {
    odiTrack(nombre, params);
    odiTrack(nombre + '_' + (window.ODINOTE_PLATFORM || 'x'), params);
  }
  window.odiTrackPorPlataforma = odiTrackPorPlataforma;

  // ── Minutos de uso de verdad ──
  //
  // El "tiempo de interacción" que da Analytics por su cuenta se queda corto
  // para un lienzo: solo corre con la ventana en primer plano, y quien deja
  // Odinote abierta al lado mientras trabaja no suma nada. Peor aún, una
  // ventana olvidada durante horas contaría como uso si solo se mirara si está
  // visible.
  //
  // Aquí un minuto cuenta si la ventana está a la vista Y la persona ha hecho
  // algo en los últimos dos minutos. Eso es "estar usándola".
  const MINUTO = 60 * 1000;
  const INACTIVIDAD = 2 * MINUTO;
  let ultimoGesto = Date.now();
  let minutos = 0;

  const marcaGesto = () => { ultimoGesto = Date.now(); };
  ['pointerdown', 'keydown', 'wheel', 'pointermove'].forEach(ev => {
    // pointermove sin `passive` bloquearía el desplazamiento; y en captura para
    // que llegue aunque algún nodo detenga la propagación.
    window.addEventListener(ev, marcaGesto, { passive: true, capture: true });
  });

  function arrancaLatido() {
    setInterval(() => {
      if (!activo()) return;
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - ultimoGesto > INACTIVIDAD) return;
      minutos++;
      // El número acumulado permite ver la distribución (cuánta gente pasa del
      // minuto 5, del 20…), que es lo que de verdad dice si la aplicación se
      // usa o solo se prueba.
      odiTrackPorPlataforma('uso_activo', { minuto: minutos });
    }, MINUTO);
  }

  // ── Apertura ──
  function anunciaApertura() {
    if (!activo()) return;
    odiTrackPorPlataforma('app_abierta', {
      tema: document.body.getAttribute('data-theme') || 'light',
      idioma: (window.currentLang || 'es'),
      // Ancho en tramos, no exacto: sirve para saber si hay que cuidar el móvil
      // y no señala a nadie.
      pantalla: window.innerWidth < 860 ? 'movil' : (window.innerWidth < 1280 ? 'mediana' : 'grande'),
    });
    arrancaLatido();
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(anunciaApertura, 1200);
  } else {
    window.addEventListener('DOMContentLoaded', () => setTimeout(anunciaApertura, 1200));
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { odiTrack };
})();
