// =====================================================
// Odinote — la corona de patrocinador
//
// Dibujada a mano y no sacada de la tipografía de iconos a propósito: el
// archivo de iconos que viaja con la app es un recorte, y si "crown" no
// estuviera dentro, en la esquina del botón aparecería la palabra "crown"
// escrita. Un SVG siempre se ve, pesa cuatro líneas y además deja elegir el
// dorado exacto, que es justo lo que aquí importa.
//
// Quién la lleva se decide en `patrocinio.js`.
// =====================================================

window.Corona = function Corona({ size = 16, className = '', title }) {
  return (
    <span
      className={'corona-patrocinador ' + className}
      title={title || window.t('Patrocinador de Odinote', 'Odinote supporter')}
      aria-label={title || window.t('Patrocinador de Odinote', 'Odinote supporter')}
      style={{ width: size, height: size }}
    >
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
