// =====================================================
// Odinote — la corona de patrocinador
//
// Dibujada a mano y no sacada de la tipografía de iconos a propósito: el
// archivo de iconos que viaja con la app es un recorte, y si "crown" no
// estuviera dentro, en la esquina del botón aparecería la palabra "crown"
// escrita. Un SVG siempre se ve, pesa cuatro líneas y además deja elegir el
// dorado exacto, que es justo lo que aquí importa.
//
// Hay dos formas de sacarla:
//
//   · `<window.Corona />` — el dibujo suelto, para meterlo donde sea.
//   · `<window.CoronaBoton />` — el botón dorado de la barra, que es lo que
//     ve quien ha invitado a un café.
//
// Quién la lleva se decide en `patrocinio.js`.
// =====================================================

window.Corona = function Corona({ size = 16, className = '', title, insignia = false }) {
  // Como insignia va pegada a la esquina de otro botón (posición absoluta);
  // suelta se comporta como un elemento normal y la coloca quien la use.
  const clases = ['corona-dibujo', insignia ? 'corona-patrocinador' : '', className]
    .filter(Boolean).join(' ');
  const texto = title || window.t('Patrocinador de Odinote', 'Odinote supporter');

  return (
    <span className={clases} title={texto} aria-label={texto} style={{ width: size, height: size }}>
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="odi-corona-oro" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F6D65C" />
            <stop offset="55%" stopColor="#E0A82E" />
            <stop offset="100%" stopColor="#C1841B" />
          </linearGradient>
        </defs>
        {/* Cuerpo: los tres picos y la base, de una sola pieza para que el
            borde la recorra entera y no se vean costuras entre partes. */}
        <path
          d="M3 8.5 L7 12.5 L12 4.5 L17 12.5 L21 8.5 L19.4 18.5 L4.6 18.5 Z"
          fill="url(#odi-corona-oro)"
          stroke="#7A5310"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        {/* Las tres piedras. Puntos, no círculos con borde: a este tamaño un
            borde las convierte en manchas. */}
        <circle cx="7" cy="12.2" r="1.15" fill="#FFF3C4" />
        <circle cx="12" cy="9.3" r="1.15" fill="#FFF3C4" />
        <circle cx="17" cy="12.2" r="1.15" fill="#FFF3C4" />
      </svg>
    </span>
  );
};

// El botón que se ve en la barra. Solo lo pinta quien tiene la corona, así que
// no hay que enseñárselo a nadie más ni explicar nada: quien lo ve, lo ha
// pagado.
//
// Que sea un botón y no una insignia pegada al perfil es deliberado: una marca
// de tres píxeles en una esquina no la ve nadie, y lo que se compra aquí es
// precisamente que se vea. El brillo respira despacio en vez de parpadear —
// un parpadeo en una barra de herramientas cansa a los diez minutos.
window.CoronaBoton = function CoronaBoton({ size = 19 }) {
  const gracias = window.t(
    'Gracias por invitar a un café. Tus cosméticos de patrocinador están activos.',
    'Thanks for the coffee. Your supporter cosmetics are active.'
  );

  return (
    <button
      className="icon-btn lift corona-btn"
      title={gracias}
      aria-label={gracias}
      onClick={() => {
        window.showToast && window.showToast('👑 ' + gracias);
        window.playAudioTone && window.playAudioTone('click');
      }}
    >
      <window.Corona size={size} title={gracias} />
    </button>
  );
};
