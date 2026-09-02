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

// Y los cuatro de fondo de nodo. Tambien claros, y por lo mismo: encima de un
// nodo se escribe, y sobre el negro o el vino de trazo no se lee nada.
window.COLORES_ODINOTE_FONDO = ['#FEF7E0', '#F7DA84', '#FBDFDD', '#E8F0DA'];

// ── Los últimos que se usaron ──
//
// Quien se sale de la paleta casi siempre lo hace por algo suyo: el color de su
// marca, el de su juego. Y lo va a querer otra vez dentro de dos minutos, en
// otro nodo. Sin esto tendría que volver a buscarlo en la rueda cada vez, y
// acertar el mismo tono a ojo no se puede.
//
// Se guardan en el equipo y no en el proyecto: son una costumbre de quien
// trabaja, no parte del tablero, y no tiene sentido que viajen a quien lo abra.
const CLAVE_RECIENTES = 'odinote.colores.recientes';
const MAX_RECIENTES = 6;

function leeRecientes() {
  try {
    const crudo = localStorage.getItem(CLAVE_RECIENTES);
    const lista = crudo ? JSON.parse(crudo) : [];
    return Array.isArray(lista) ? lista.filter(c => typeof c === 'string').slice(0, MAX_RECIENTES) : [];
  } catch (e) {
    return [];
  }
}

function apuntaReciente(color) {
  if (typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color)) return leeRecientes();
  const c = color.toLowerCase();
  const lista = [c, ...leeRecientes().filter(x => x.toLowerCase() !== c)].slice(0, MAX_RECIENTES);
  try { localStorage.setItem(CLAVE_RECIENTES, JSON.stringify(lista)); } catch (e) {}
  return lista;
}

window.SelectorColor = function SelectorColor({
  valor,
  onCambio,
  colores,
  tam = 24,
  incluirTransparente = false,
  etiquetaLibre,
}) {
  const { useRef, useState } = React;
  const entrada = useRef(null);
  const paleta = colores || window.COLORES_ODINOTE;

  const [recientes, setRecientes] = useState(leeRecientes);
  // Mientras se mueve la rueda del sistema el color se va aplicando para poder
  // verlo sobre el nodo de verdad, pero no se da por bueno hasta Aceptar. Por
  // eso hace falta recordar con qué se empezó: si se cierra sin aceptar, se
  // devuelve lo que había.
  const [eligiendo, setEligiendo] = useState(null);

  // ── Que no se pierda lo que hay seleccionado ──
  //
  // Dos cosas distintas se lo llevan por delante. Pulsar una casilla le quita el
  // foco al texto, y eso se evita cancelando el mousedown. Pero la rueda de
  // color del sistema es una ventana aparte: al abrirse se lleva la seleccion
  // entera y no hay forma de impedirlo, asi que hay que apuntarla antes y
  // devolverla justo antes de aplicar el color.
  //
  // Sin esto, elegir un color y escribir despues salia del color de antes, que
  // es exactamente lo que no espera nadie.
  const rango = useRef(null);

  const apuntaSeleccion = () => {
    try {
      const sel = window.getSelection();
      if (sel && sel.rangeCount) rango.current = sel.getRangeAt(0).cloneRange();
    } catch (e) {}
  };

  const devuelveSeleccion = () => {
    try {
      if (!rango.current) return;
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(rango.current);
    } catch (e) {}
  };

  const sinRobarFoco = (e) => { e.preventDefault(); apuntaSeleccion(); };

  const norm = (c) => (typeof c === 'string' ? c.trim().toLowerCase() : '');
  const actual = norm(valor);
  const enPaleta = paleta.some(c => norm(c) === actual) ||
                   (incluirTransparente && (actual === 'transparent' || actual === ''));

  const marco = (activo) => (activo ? '2.5px solid var(--wine)' : '1.5px solid var(--line-soft)');
  const redondo = { width: tam + 'px', height: tam + 'px', borderRadius: '50%', cursor: 'pointer', padding: 0 };

  const elige = (c) => {
    setEligiendo(null);
    setRecientes(apuntaReciente(c));
    devuelveSeleccion();
    onCambio(c);
  };

  return (
    <div className="selector-color-caja" style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>

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
            onMouseDown={sinRobarFoco}
            onClick={() => elige('transparent')}
            title={window.t('Sin color', 'No colour')}
            aria-label={window.t('Sin color', 'No colour')}
          />
        )}

        {paleta.map(c => (
          <button
            key={c}
            type="button"
            style={{ ...redondo, background: c, border: marco(norm(c) === actual) }}
            onMouseDown={sinRobarFoco}
            onClick={() => elige(c)}
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
            // Siempre el arcoiris, tenga o no un color libre puesto. Antes pasaba
            // a mostrar el color elegido y entonces se confundia con una casilla
            // mas de la paleta: dejaba de leerse como "aqui hay mas". Que este
            // elegido se ve por el aro, igual que en las demas.
            background: 'conic-gradient(#E6544F, #DDAF2C, #90B968, #3CA59E, #3D5A80, #955BA5, #E6544F)',
          }}
          onMouseDown={sinRobarFoco}
          onClick={() => entrada.current && entrada.current.click()}
          title={etiquetaLibre || window.t('Elegir otro color', 'Pick another colour')}
          aria-label={etiquetaLibre || window.t('Elegir otro color', 'Pick another colour')}
        >
          <input
            ref={entrada}
            type="color"
            value={/^#[0-9a-f]{6}$/i.test(valor || '') ? valor : '#1A1A1A'}
            onChange={(e) => {
              const c = e.target.value;
              // El primer movimiento guarda de dónde se venía, para poder
              // deshacer si se cierra sin aceptar. Y en cada uno se apunta el
              // color en curso: es el que hay que dar por bueno al aceptar.
              setEligiendo(prev => (prev === null ? { previo: valor || '#1A1A1A', actual: c } : { ...prev, actual: c }));
              devuelveSeleccion();
              onCambio(c);
            }}
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              opacity: 0, border: 'none', padding: 0, cursor: 'pointer',
            }}
            tabIndex={-1}
            aria-hidden="true"
          />
        </button>
      </div>

      {/* ── Los últimos que se usaron ── */}
      {recientes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-3, #8E8A8E)' }}>
            {window.t('Los últimos que usaste', 'The last ones you used')}
          </div>
        <div
          className="selector-color-recientes"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${MAX_RECIENTES}, ${tam - 5}px)`,
            gap: '5px',
            alignItems: 'center',
          }}
        >
          {recientes.map(c => (
            <button
              key={c}
              type="button"
              style={{
                width: (tam - 5) + 'px', height: (tam - 5) + 'px', borderRadius: '50%',
                padding: 0, cursor: 'pointer', background: c,
                border: norm(c) === actual ? '2px solid var(--wine)' : '1.5px solid var(--line-soft)',
              }}
              onMouseDown={sinRobarFoco}
              onClick={() => elige(c)}
              title={window.t('Usado hace poco: ', 'Used recently: ') + c}
              aria-label={c}
            />
          ))}
          </div>
        </div>
      )}

      {/* ── Aceptar ──
          Solo aparece mientras se está moviendo la rueda del sistema. El color ya
          se está viendo aplicado —que es la única forma de acertar un tono—, así
          que este botón no lo aplica: lo da por bueno y lo guarda en los
          recientes. Cancelar devuelve lo que había antes de tocar nada. */}
      {eligiendo && (
        <div style={{
          display: 'flex', gap: '6px', alignItems: 'center',
          padding: '8px', borderRadius: '8px',
          background: 'rgba(224, 168, 46, 0.10)',
          border: '1.5px solid rgba(224, 168, 46, 0.45)',
        }}>
          <button
            type="button"
            className="btn"
            style={{
              flex: 1, padding: '6px 10px', borderRadius: '6px', border: 'none',
              background: 'var(--olive, #6A8546)', color: '#FFF',
              fontWeight: 700, fontSize: '11.5px', cursor: 'pointer',
            }}
            onMouseDown={sinRobarFoco}
            onClick={() => elige(eligiendo.actual || valor)}
          >
            {window.t('Aceptar', 'Accept')}
          </button>
          <button
            type="button"
            className="btn"
            style={{
              padding: '6px 10px', borderRadius: '6px', fontSize: '11.5px', cursor: 'pointer',
              border: '1.5px solid var(--line-soft)', background: 'transparent',
              color: 'var(--ink-3, #595459)',
            }}
            onMouseDown={sinRobarFoco}
            onClick={() => { const p = eligiendo.previo; setEligiendo(null); devuelveSeleccion(); onCambio(p); }}
          >
            {window.t('Cancelar', 'Cancel')}
          </button>
        </div>
      )}
    </div>
  );
};
