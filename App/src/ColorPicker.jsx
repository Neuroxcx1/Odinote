// =====================================================
// Odinote — un solo selector de color para toda la aplicación
//
// Antes había cinco paletas escritas a mano, cada una en su archivo y con su
// propio número de colores: doce para dibujar, ocho para las flechas, catorce
// para el texto del documento, ocho para el subrayado. Ninguna dejaba elegir un
// color que no estuviera en la lista, así que quien quería el azul de su marca
// no lo tenía y punto.
//
// Ahora es al revés: unos pocos colores buenos a mano y una casilla que abre el
// selector del sistema. Cuatro y no doce a propósito — una fila de doce
// círculos parecidos obliga a comparar, y comparar cuesta más que elegir.
//
// La única excepción es el fondo del lienzo, que se queda con sus temas: ahí el
// color no es una decisión de quien escribe, es la piel del programa.
//
// ── El orden de las cosas, que no es casual ──
//
// De arriba abajo: los últimos que se usaron, el botón de aceptar, los colores
// de siempre, y ABAJO DEL TODO el arcoíris.
//
// El arcoíris va el último porque abre una ventana del sistema operativo, y esa
// ventana se coloca junto a lo que la abrió y tapa lo que tenga debajo. Con el
// arcoíris arriba, esa ventana caía encima del resto del panel y el botón de
// aceptar quedaba escondido detrás de ella. Con el arcoíris abajo, la ventana
// cae fuera del panel y todo lo demás se sigue viendo y se puede pulsar.
// =====================================================

// Los cuatro de trazo: tinta, vino, oliva y azul. Son los de la propia
// aplicación, así que un tablero pintado con ellos sigue pareciendo Oddinote.
window.COLORES_ODINOTE = ['#1A1A1A', '#E6544F', '#90B968', '#3D5A80'];

// Los cuatro de subrayar. Van aparte porque un marcador tiene que dejar leer lo
// que hay debajo: los de arriba tapan el texto y no valen aquí.
window.COLORES_ODINOTE_SUAVES = ['#FFF3A3', '#FFC7C2', '#CFEFD6', '#CDE9FF'];

// El blanco va el primero de los de fondo. Sin él no hay forma de devolver una
// nota a su aspecto normal: el más claro sería un crema y la nota se quedaría
// amarilleando para siempre.
window.COLORES_ODINOTE_FONDO = ['#FFFFFF', '#F7DA84', '#FBDFDD', '#E8F0DA'];

// Los del cursor de quien invita a un café. El dorado va PRIMERO y no es
// decoración del orden: es el que se anuncia en la propia ventana —"el cursor
// dorado"— y hasta ahora no estaba en ninguna casilla, así que quien pagaba por
// él tenía que ir a buscarlo a la rueda del sistema y acertar el tono a ojo.
// Detrás, blanco para los lienzos oscuros y dos de la casa. El cuerpo de la
// flecha es oscuro y el color elegido es su borde, así que aquí no valen los
// tonos que se confunden con ese cuerpo.
window.COLORES_ODINOTE_CURSOR = ['#E0A82E', '#FFFFFF', '#E6544F', '#3D5A80'];

// Y los de una flecha: negro y blanco, nada más. Sobre el lienzo claro se ve el
// negro y sobre el oscuro el blanco, y con eso está casi todo resuelto; el resto
// está en el arcoíris. Además su barra lateral es estrecha y no caben más.
window.COLORES_ODINOTE_FLECHA = ['#1A1A1A', '#FFFFFF'];

// ── Los últimos que se usaron ──
//
// Quien se sale de la paleta casi siempre lo hace por algo suyo: el color de su
// marca, el de su juego. Y lo va a querer otra vez dentro de dos minutos, en
// otro nodo. Sin esto tendría que volver a buscarlo en la rueda cada vez, y
// acertar el mismo tono a ojo no se puede.
//
// Se guardan en el equipo y no en el proyecto: son una costumbre de quien
// trabaja, no parte del tablero.
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
  // Todo en una fila en vez de en tres. Lo pide quien tiene ancho y no altura.
  compacto = false,
  // El color del botón de aceptar. Verde en toda la aplicación; la ventana de
  // la corona lo pide dorado, porque allí el dorado es lo que se ha comprado.
  acento,
  acentoTexto,
}) {
  const { useRef, useState } = React;
  const entrada = useRef(null);
  const paleta = colores || window.COLORES_ODINOTE;

  const [recientes, setRecientes] = useState(leeRecientes);

  // Mientras se mueve la rueda del sistema el color se va aplicando —es la única
  // forma de acertar un tono— pero NO se da por bueno. De eso se encarga
  // Aceptar, y por eso hay que recordar de dónde se venía.
  //
  // Que la rueda no dé nada por bueno arregla además el historial. Los
  // navegadores avisan del cambio en cada movimiento del ratón, así que
  // apuntarlo ahí llenaba la lista con seis tonos casi idénticos del mismo
  // color: elegías un rojo y todo el historial se volvía rojo. Ahora un paseo
  // entero por la rueda deja una sola entrada, la que se acepta.
  const [eligiendo, setEligiendo] = useState(null);

  // ── Que no se pierda lo que hay seleccionado ──
  //
  // Dos cosas se lo llevan por delante. Pulsar una casilla le quita el foco al
  // texto, y eso se evita cancelando el mousedown. Pero la rueda del sistema es
  // una ventana aparte: al abrirse se lleva la selección entera y no hay forma
  // de impedirlo, así que hay que apuntarla antes y devolverla justo antes de
  // aplicar el color.
  //
  // Sin esto, elegir un color y escribir después salía del color de antes.
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

  // Elegir de la paleta o de los recientes es inmediato: no hay nada que
  // confirmar, ya se sabía qué color era antes de pulsarlo.
  const elige = (c) => {
    setEligiendo(null);
    setRecientes(apuntaReciente(c));
    devuelveSeleccion();
    onCambio(c);
  };

  // En fila con salto de línea, no en rejilla de ancho fijo. La barra lateral de
  // un conector mide 86 píxeles: con columnas fijas el contenido se salía del
  // panel y las casillas se apilaban de cualquier manera.
  const enFila = { display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' };

  const enCurso = (c) => setEligiendo(prev => (
    prev === null ? { previo: valor || '#1A1A1A', actual: c } : { ...prev, actual: c }
  ));

  // ── Las casillas, cada una definida una sola vez ──
  //
  // Se sacan del return porque hay dos maneras de colocarlas —en filas o todas
  // seguidas— y lo que no puede haber es dos copias del mismo botón: la
  // siguiente vez que se toque una, se arregla en una y se queda rota en la
  // otra.

  // Los recientes van un poco más pequeños. No es adorno: así se distinguen de
  // la paleta cuando van pegados en la misma fila, sin necesidad de un rótulo.
  const casillaReciente = (c) => (
    <button
      key={'reciente-' + c}
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
  );

  const casillaNinguno = () => (
    <button
      key="ninguno"
      type="button"
      className="selector-color-ninguno"
      style={{ ...redondo, border: marco(actual === 'transparent' || actual === '') }}
      onMouseDown={sinRobarFoco}
      onClick={() => elige('transparent')}
      title={window.t('Sin color', 'No colour')}
      aria-label={window.t('Sin color', 'No colour')}
    />
  );

  const casillaPaleta = (c) => (
    <button
      key={c}
      type="button"
      style={{ ...redondo, background: c, border: marco(norm(c) === actual) }}
      onMouseDown={sinRobarFoco}
      onClick={() => elige(c)}
      title={c}
      aria-label={c}
    />
  );

  // El arcoíris: siempre arcoíris, tenga o no un color libre puesto. Si mostrara
  // el color elegido se confundiría con una casilla más de la paleta y dejaría
  // de leerse como "aquí hay más". Que esté elegido se ve por el aro, igual que
  // en las demás.
  const casillaLibre = () => (
    <button
      key="libre"
      type="button"
      className="selector-color-libre"
      style={{
        ...redondo,
        position: 'relative',
        border: marco(!enPaleta),
        background: 'conic-gradient(#E6544F, #DDAF2C, #90B968, #3CA59E, #3D5A80, #955BA5, #E6544F)',
      }}
      onMouseDown={sinRobarFoco}
      onClick={() => entrada.current && entrada.current.click()}
      title={etiquetaLibre || window.t('Elegir otro color', 'Pick another colour')}
      aria-label={etiquetaLibre || window.t('Elegir otro color', 'Pick another colour')}
    >
      {/* Se escuchan los dos avisos que da el navegador. Cuál de ellos llega,
          y cuántas veces, cambia de un navegador a otro; lo único seguro es
          que con los dos no se pierde ningún movimiento de la rueda. Ninguno
          da el color por bueno: de eso se encarga Aceptar. */}
      <input
        ref={entrada}
        type="color"
        value={/^#[0-9a-f]{6}$/i.test(valor || '') ? valor : '#1A1A1A'}
        onInput={(e) => { enCurso(e.target.value); devuelveSeleccion(); onCambio(e.target.value); }}
        onChange={(e) => { enCurso(e.target.value); devuelveSeleccion(); onCambio(e.target.value); }}
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          opacity: 0, border: 'none', padding: 0, cursor: 'pointer',
        }}
        tabIndex={-1}
        aria-hidden="true"
      />
    </button>
  );

  // Aceptar y Deshacer. Van ARRIBA del todo y no al final: la ventana del
  // sistema se abre junto al arcoíris, que está abajo, así que este botón se
  // queda fuera de su sombra y se puede pulsar sin cerrar nada antes. El color
  // ya se está viendo aplicado; esto lo da por bueno y lo guarda.
  //
  // `reservado` pinta la misma fila pero invisible y sin poder tocarse. Es para
  // que el sitio esté guardado antes de hacer falta: cuando aparecía y
  // desaparecía de verdad, todo lo que tenía debajo —los colores, la zona de
  // prueba, los botones— pegaba un salto de treinta píxeles cada vez que se
  // tocaba la rueda, y volvía a saltar al aceptar. Con la ventana quieta, el
  // ojo puede seguir el color en lugar de perseguir los botones.
  const confirmacion = (reservado) => (!eligiendo && !reservado ? null : (
    <div
      style={{
        display: 'flex', gap: '6px', flexWrap: 'wrap',
        visibility: eligiendo ? 'visible' : 'hidden',
        pointerEvents: eligiendo ? 'auto' : 'none',
      }}
      aria-hidden={!eligiendo}
    >
      <button
        type="button"
        className="btn"
        tabIndex={eligiendo ? 0 : -1}
        style={{
          flex: '1 1 auto', padding: '7px 10px', borderRadius: '6px', border: 'none',
          background: acento || 'var(--olive, #6A8546)', color: acentoTexto || '#FFF',
          fontWeight: 700, fontSize: '11.5px', cursor: 'pointer',
        }}
        onMouseDown={sinRobarFoco}
        onClick={() => eligiendo && elige(eligiendo.actual || valor)}
      >
        {window.t('Aceptar', 'Accept')}
      </button>
      <button
        type="button"
        className="btn"
        style={{
          flex: '0 0 auto', padding: '7px 9px', borderRadius: '6px', fontSize: '11.5px', cursor: 'pointer',
          border: '1.5px solid var(--line-soft)', background: 'transparent',
          color: 'var(--ink-3, #595459)',
        }}
        tabIndex={eligiendo ? 0 : -1}
        onMouseDown={sinRobarFoco}
        onClick={() => {
          if (!eligiendo) return;
          const previo = eligiendo.previo;
          setEligiendo(null);
          devuelveSeleccion();
          onCambio(previo);
        }}
      >
        {window.t('Deshacer', 'Undo')}
      </button>
    </div>
  ));

  // ── Todo seguido, en una sola fila ──
  //
  // Para quien tiene ancho de sobra y ninguna prisa por la altura: una ventana,
  // no una barra lateral de 86 píxeles. Repartido en tres filas —recientes,
  // paleta, arcoíris— ninguna llegaba a la mitad del ancho y la ventana se
  // quedaba con un agujero al lado de los colores.
  //
  // ── Por qué el historial va a la DERECHA y con un reloj delante ──
  //
  // La primera versión de esta fila puso los recientes a la izquierda y los
  // separó de la paleta con una rayita de un píxel. No se entendía: la rayita
  // no se ve sobre fondo oscuro, y sin el rótulo que tenía en la versión de
  // tres filas, once círculos seguidos parecen una sola paleta larga. Quien la
  // usó dio por hecho que el historial era la parte de la derecha —la fija—,
  // eligió un color nuevo, vio que esa parte no cambiaba y concluyó que el
  // historial estaba roto. Funcionaba; no se veía.
  //
  // Ahora lo de siempre va primero, porque no cambia nunca, y detrás de una
  // separación de verdad viene el historial con un reloj delante. El color
  // recién elegido aparece justo después del reloj, que es donde se está
  // mirando al soltar la rueda.
  if (compacto) {
    return (
      <div className="selector-color-caja" style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
        {confirmacion(true)}
        <div className="selector-color" style={enFila}>
          {incluirTransparente && casillaNinguno()}
          {paleta.map(casillaPaleta)}
          {casillaLibre()}

          {recientes.length > 0 && (
            <span
              className="selector-color-raya"
              aria-hidden="true"
              style={{ height: (tam + 2) + 'px' }}
            />
          )}
          {recientes.length > 0 && (
            <span
              className="material-symbols-rounded selector-color-reloj"
              title={window.t('Los últimos que usaste', 'The last ones you used')}
              aria-label={window.t('Los últimos que usaste', 'The last ones you used')}
            >
              schedule
            </span>
          )}
          {recientes.map(casillaReciente)}
        </div>
      </div>
    );
  }

  return (
    <div className="selector-color-caja" style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>

      {/* ── 1. Los últimos que usaste ── */}
      {recientes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-3, #8E8A8E)' }}>
            {window.t('Los últimos que usaste', 'The last ones you used')}
          </div>
          <div className="selector-color-recientes" style={{ ...enFila, gap: '5px' }}>
            {recientes.map(casillaReciente)}
          </div>
        </div>
      )}

      {/* ── 2. Aceptar ── */}
      {confirmacion()}

      {/* ── 3. Los de siempre ── */}
      <div className="selector-color" style={enFila}>
        {incluirTransparente && casillaNinguno()}
        {paleta.map(casillaPaleta)}
      </div>

      {/* ── 4. El arcoíris, abajo del todo ── */}
      <div style={enFila}>
        {casillaLibre()}
      </div>
    </div>
  );
};
