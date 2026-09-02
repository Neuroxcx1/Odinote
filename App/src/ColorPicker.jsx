// =====================================================
// Odinote — un solo selector de color para toda la aplicación
//
// Antes había cinco paletas escritas a mano, cada una en su archivo y con su
// propio número de colores: doce para dibujar, ocho para las flechas, catorce
// para el texto del documento, ocho para el subrayado. Ninguna dejaba elegir un
// color que no estuviera en la lista, así que quien quería el azul de su marca
// no lo tenía y punto.
//
// Ahora es al revés: cuatro colores buenos a mano y una quinta casilla que abre
// el selector del sistema. Cuatro y no doce a propósito — una fila de doce
// círculos parecidos obliga a comparar, y comparar cuesta más que elegir. Los
// cuatro cubren lo que se usa el 90% de las veces y el resto está a un clic.
//
// La única excepción es el fondo del lienzo, que se queda con sus temas: ahí el
// color no es una decisión de quien escribe, es la piel del programa.
// =====================================================

// Los cuatro de trazo: tinta, vino, oliva y azul. Son los de la propia
// aplicación, así que un tablero pintado con ellos sigue pareciendo Odinote.
window.COLORES_ODINOTE = ['#1A1A1A', '#E6544F', '#90B968', '#3D5A80'];

// Los cuatro de subrayar. Van aparte porque un marcador tiene que dejar leer lo
// que hay debajo: los de arriba tapan el texto y no valen aquí.
window.COLORES_ODINOTE_SUAVES = ['#FFF3A3', '#FFC7C2', '#CFEFD6', '#CDE9FF'];

window.SelectorColor = function SelectorColor({
  valor,
  onCambio,
  colores,
  tam = 24,
  incluirTransparente = false,
  etiquetaLibre,
}) {
  const { useRef } = React;
  const entrada = useRef(null);
  const paleta = colores || window.COLORES_ODINOTE;

  const norm = (c) => (typeof c === 'string' ? c.trim().toLowerCase() : '');
  const actual = norm(valor);
  const enPaleta = paleta.some(c => norm(c) === actual) ||
                   (incluirTransparente && (actual === 'transparent' || actual === ''));

  const marco = (activo) => (activo ? '2.5px solid var(--wine)' : '1.5px solid var(--line-soft)');

  const redondo = {
    width: tam + 'px',
    height: tam + 'px',
    borderRadius: '50%',
    cursor: 'pointer',
    padding: 0,
  };

  return (
    <div
      className="selector-color"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${paleta.length + (incluirTransparente ? 2 : 1)}, ${tam}px)`,
        gap: '6px',
        alignItems: 'center',
      }}
    >
      {incluirTransparente && (
        <button
          type="button"
          className="selector-color-ninguno"
          style={{ ...redondo, border: marco(actual === 'transparent' || actual === '') }}
          onClick={() => onCambio('transparent')}
          title={window.t('Sin color', 'No colour')}
          aria-label={window.t('Sin color', 'No colour')}
        />
      )}

      {paleta.map(c => (
        <button
          key={c}
          type="button"
          style={{ ...redondo, background: c, border: marco(norm(c) === actual) }}
          onClick={() => onCambio(c)}
          title={c}
          aria-label={c}
        />
      ))}

      {/* La quinta. Cuando hay un color de la paleta puesto se ve el arcoíris,
          que es lo que dice "aquí hay más"; en cuanto se elige uno libre, la
          casilla pasa a mostrarlo, porque si no no habría forma de saber cuál
          está puesto. */}
      <button
        type="button"
        className="selector-color-libre"
        style={{
          ...redondo,
          position: 'relative',
          border: marco(!enPaleta),
          background: enPaleta
            ? 'conic-gradient(#E6544F, #DDAF2C, #90B968, #3CA59E, #3D5A80, #955BA5, #E6544F)'
            : (valor || '#1A1A1A'),
        }}
        onClick={() => entrada.current && entrada.current.click()}
        title={etiquetaLibre || window.t('Elegir otro color', 'Pick another colour')}
        aria-label={etiquetaLibre || window.t('Elegir otro color', 'Pick another colour')}
      >
        {/* El campo de color del sistema, escondido detrás de la casilla: se
            usa su ventana, que es la que la persona ya conoce, sin heredar su
            aspecto, que no se parece a nada de aquí. */}
        <input
          ref={entrada}
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(valor || '') ? valor : '#1A1A1A'}
          onChange={(e) => onCambio(e.target.value)}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            opacity: 0,
            border: 'none',
            padding: 0,
            cursor: 'pointer',
          }}
          tabIndex={-1}
          aria-hidden="true"
        />
      </button>
    </div>
  );
};
