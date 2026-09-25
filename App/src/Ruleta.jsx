// =====================================================
// Oddinote — el nodo de ruleta
//
// Lo básico de la ruleta que pidió el usuario, a partir de la de su captura:
// sin "personas", con elementos, y con la cara de la aplicación. Cada porción
// lleva su color con un degradado hacia el centro, más claro abajo; al girar
// frena como una ruleta de verdad, suena un "tic" cada vez que pasa una porción
// por la flecha y, al parar, un sonido corto de premio y el elegido que salta
// en medio con un rebote.
//
// Sin elementos se enseña un círculo en blanco que lo dice, con el botón para
// ir añadiéndolos ahí mismo. Con uno ya se dibuja la rueda, con ese y el hueco
// del segundo, que se va rellenando según se escribe.
//
// El giro se guarda en el nodo (item.giro) para que la ruleta siga donde se
// quedó al volver a abrir el proyecto, y el último elegido (item.ultimo) para
// que se siga viendo cuál salió.
// =====================================================

// Los colores con los que va naciendo cada elemento, por turno. Los cuatro de
// la aplicación primero.
const RULETA_COLORES = ['#E6544F', '#F7DA84', '#90B968', '#3D5A80', '#955BA5', '#F2A65A', '#5BB5A2', '#E58FB0'];
const RULETA_DURACION = 5200;

// Un solo reproductor para todos los "tic": el de la aplicación crea uno nuevo
// en cada sonido, y una ruleta suena decenas de veces por vuelta.
let ruletaAudio = null;
function ruletaSuena(tipo) {
  if (window.isAudioMuted) return;
  try {
    ruletaAudio = ruletaAudio || new (window.AudioContext || window.webkitAudioContext)();
    const ctx = ruletaAudio;
    const k = (typeof window.audioVolume === 'number' ? window.audioVolume : 0.5) * 3.2;
    const ahora = ctx.currentTime;
    const tono = (desde, hasta, en, dur, g, onda) => {
      const o = ctx.createOscillator(), v = ctx.createGain();
      o.type = onda || 'triangle';
      o.connect(v); v.connect(ctx.destination);
      o.frequency.setValueAtTime(desde, ahora + en);
      if (hasta) o.frequency.exponentialRampToValueAtTime(hasta, ahora + en + dur);
      v.gain.setValueAtTime(Math.min(0.5, g * k), ahora + en);
      v.gain.exponentialRampToValueAtTime(0.0001, ahora + en + dur);
      o.start(ahora + en); o.stop(ahora + en + dur + 0.02);
    };
    if (tipo === 'tic') tono(1800, 900, 0, 0.03, 0.03, 'square');
    else if (tipo === 'premio') {
      // Do, mi, sol y do arriba, rápidos: una fanfarria de bolsillo.
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tono(f, null, i * 0.075, 0.34, 0.04));
      tono(1568, null, 0.3, 0.5, 0.025, 'sine');
    }
  } catch (e) {}
}

// Un punto de la circunferencia, con 0 grados ARRIBA y girando como el reloj.
function ruletaPunto(grados, radio) {
  const r = (grados - 90) * Math.PI / 180;
  return [Math.cos(r) * radio, Math.sin(r) * radio];
}
function ruletaAclara(hex, cuanto) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const mezcla = (c) => Math.round(c + (255 - c) * cuanto);
  return `rgb(${mezcla(n >> 16)}, ${mezcla((n >> 8) & 255)}, ${mezcla(n & 255)})`;
}

function RuletaItem({ item, lang, onUpdate }) {
  const elementos = Array.isArray(item.elementos) ? item.elementos : [];
  const n = elementos.length;
  const [giro, setGiro] = React.useState(item.giro || 0);
  const [girando, setGirando] = React.useState(false);
  const [ganador, setGanador] = React.useState(null);
  const [escribiendo, setEscribiendo] = React.useState(false);
  const [texto, setTexto] = React.useState('');
  // El último elemento añadido desde el propio nodo: su porción entra con un
  // rebote desde el centro, para que se vea que lo escrito ha llegado.
  const [recien, setRecien] = React.useState(null);
  // Lo escrito, también en una ref: al pulsar Intro se vacía AL MOMENTO, y el
  // "salir del campo" que pueda llegar después no lo añade otra vez.
  const textoRef = React.useRef('');
  const ruedaRef = React.useRef(null);
  const flechaRef = React.useRef(null);
  // La flecha salta un poco cuando la golpea una porción y vuelve con rebote.
  // Antes temblaba sin parar mientras la rueda giraba, también a punto de
  // frenar (lo vio el usuario). Así, al frenar, los golpes se espacian y la
  // flecha se queda quieta sola. Hacia la derecha porque la rueda gira como el
  // reloj: arriba, las porciones pasan de izquierda a derecha.
  const golpeFlecha = () => {
    const f = flechaRef.current;
    if (!f || !f.animate) return;
    f.animate([
      { transform: 'translateX(-50%) rotate(-24deg)' },
      { transform: 'translateX(-50%) rotate(0deg)' },
    ], { duration: 260, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' });
  };
  const animacion = React.useRef(null);
  const elementosRef = React.useRef(elementos);
  elementosRef.current = elementos;
  const idBase = 'ruleta-' + String(item.id).replace(/[^a-z0-9_-]/gi, '');

  const escribe = (v) => { textoRef.current = v; setTexto(v); };
  const anade = (t) => {
    const limpio = String(t || '').trim();
    if (!limpio) return;
    const actuales = elementosRef.current;
    const id = `el-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
    // Con otros elementos, el elegido de antes ya no dice nada: se suelta.
    onUpdate({ ultimo: null, elementos: [...actuales, {
      id,
      texto: limpio,
      color: RULETA_COLORES[actuales.length % RULETA_COLORES.length],
    }] });
    setRecien(id);
    window.playAudioTone && window.playAudioTone('create');
  };

  // Mientras solo hay uno, la rueda se dibuja con ese y con el hueco del
  // segundo. Antes se quedaba el círculo en blanco con un texto que cambiaba,
  // y escribir el primero parecía no haber servido de nada.
  const lista = n === 1
    ? [elementos[0], { id: '__hueco', texto: texto.trim() || '?', hueco: true }]
    : elementos;
  const m = lista.length;
  const paso = m ? 360 / m : 360;

  const gira = () => {
    if (n < 2 || girando) return;
    const elegido = Math.floor(Math.random() * n);
    // Dónde tiene que quedar la flecha dentro de la porción elegida: en
    // cualquier sitio salvo pegada a los bordes, que parecería trampa.
    const dentro = (0.15 + Math.random() * 0.7) * paso;
    const objetivo = elegido * paso + dentro;
    const vueltas = 5 + Math.floor(Math.random() * 3);
    const base = giro - (((giro % 360) + 360) % 360) + 360 * vueltas;
    const final = base + ((360 - objetivo) % 360);
    setGanador(null);
    setGirando(true);
    setGiro(final);

    // Un "tic" cada vez que una porción pasa por la flecha. Se lee el giro que
    // lleva de verdad la rueda en pantalla (la transición la hace el navegador)
    // en vez de calcularlo, para que suene justo cuando se ve pasar.
    let ultima = null;
    const mira = () => {
      const el = ruedaRef.current;
      if (el) {
        const t = getComputedStyle(el).transform;
        const mm = /matrix\(([^,]+),\s*([^,]+)/.exec(t);
        if (mm) {
          const ang = Math.atan2(parseFloat(mm[2]), parseFloat(mm[1])) * 180 / Math.PI;
          const arriba = ((360 - ang) % 360 + 360) % 360;
          const porcion = Math.floor(arriba / paso);
          if (ultima !== null && porcion !== ultima) { ruletaSuena('tic'); golpeFlecha(); }
          ultima = porcion;
        }
      }
      animacion.current = requestAnimationFrame(mira);
    };
    cancelAnimationFrame(animacion.current);
    animacion.current = requestAnimationFrame(mira);

    setTimeout(() => {
      cancelAnimationFrame(animacion.current);
      setGirando(false);
      const gano = elementosRef.current[elegido];
      setGanador(gano ? gano.id : null);
      ruletaSuena('premio');
      onUpdate({ giro: ((final % 360) + 360) % 360, ultimo: gano ? gano.id : null });
      // El giro se deja en lo que se guarda: así la siguiente vuelta sale del
      // mismo sitio y no desenrolla las cinco vueltas de antes hacia atrás.
      setGiro(((final % 360) + 360) % 360);
    }, RULETA_DURACION);
  };
  React.useEffect(() => () => cancelAnimationFrame(animacion.current), []);
  // Lo mismo con el que acaba de salir, si cambian los elementos.
  React.useEffect(() => { setGanador(null); }, [n]);
  // Con dos ya se puede girar: el campo de añadir se va solo.
  React.useEffect(() => { if (n >= 2) { setEscribiendo(false); escribe(''); } }, [n]);
  React.useEffect(() => {
    const pedido = (e) => { if (e.detail === item.id) gira(); };
    window.addEventListener('odi-ruleta-girar', pedido);
    return () => window.removeEventListener('odi-ruleta-girar', pedido);
  });

  const elegidoId = n >= 2 ? (ganador || (!girando ? item.ultimo : null)) : null;
  const elegido = elementos.find(e => e.id === elegidoId);

  // El botón de añadir o el campo, para cuando faltan elementos. Va suelto y
  // con su clave para que siga siendo EL MISMO al pasar de cero a uno: si se
  // rehiciera, se perdería el cursor entre el primero y el segundo.
  const anadir = n < 2 && (
    <div className="ruleta-anadir" key="anadir">
      {escribiendo ? (
        <input
          className="ruleta-campo"
          autoFocus
          value={texto}
          placeholder={n === 0
            ? window.t('Escribe y pulsa Intro', 'Type and press Enter')
            : window.t('El segundo, y pulsa Intro', 'The second one, then Enter')}
          onChange={(e) => escribe(e.target.value)}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') { const t = textoRef.current; escribe(''); anade(t); }
            if (e.key === 'Escape') { escribe(''); setEscribiendo(false); }
          }}
          onBlur={() => { const t = textoRef.current; escribe(''); if (t.trim()) anade(t); setEscribiendo(false); }}
        />
      ) : (
        <button
          className="ruleta-boton"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); setEscribiendo(true); }}
        >
          <span className="material-symbols-rounded">add</span>
          {n === 0 ? window.t('Añadir elemento', 'Add item') : window.t('Añadir otro', 'Add another')}
        </button>
      )}
    </div>
  );

  // ── Sin ningún elemento ──
  if (n === 0) {
    return (
      <div className="ruleta cero">
        <div className="ruleta-rueda-caja">
          <div className="ruleta-vacia" key="vacia">
            <div className="ruleta-vacia-texto">
              {window.t('Añade al menos dos elementos para girar la ruleta.', 'Add at least two items to spin the wheel.')}
            </div>
          </div>
          {anadir}
        </div>
      </div>
    );
  }

  // ── La rueda ──
  const porciones = lista.map((el, i) => {
    const a0 = i * paso, a1 = (i + 1) * paso;
    const [x0, y0] = ruletaPunto(a0, 96);
    const [x1, y1] = ruletaPunto(a1, 96);
    const grande = a1 - a0 > 180 ? 1 : 0;
    const medio = (a0 + a1) / 2;
    const color = el.hueco ? null : (el.color || RULETA_COLORES[i % RULETA_COLORES.length]);
    // El texto sale del centro hacia fuera; en la mitad izquierda se da la
    // vuelta para no leerse cabeza abajo.
    const giroTexto = medio - 90;
    const volteado = giroTexto > 90 && giroTexto < 270;
    const tinta = color && typeof tintaLegible === 'function' ? tintaLegible(color) : '#1A1A1A';
    return { el, i, color, medio, tinta, volteado, giroTexto,
      d: `M0 0 L${x0.toFixed(3)} ${y0.toFixed(3)} A96 96 0 ${grande} 1 ${x1.toFixed(3)} ${y1.toFixed(3)} Z` };
  });
  const maxLetras = m <= 4 ? 16 : m <= 8 ? 12 : 9;

  return (
    <div className={`ruleta ${n === 1 ? 'uno' : ''} ${girando ? 'girando' : ''} ${elegido && !girando ? 'con-elegido' : ''}`}>
      <div className="ruleta-rueda-caja">
        <div className="ruleta-flecha" ref={flechaRef} key="flecha"/>
        <svg
          key="rueda"
          ref={ruedaRef}
          className="ruleta-rueda"
          viewBox="-100 -100 200 200"
          style={{
            transform: `rotate(${giro}deg)`,
            transition: girando ? `transform ${RULETA_DURACION}ms cubic-bezier(0.12, 0.72, 0.1, 1)` : 'none',
          }}
        >
          <defs>
            {porciones.filter(p => p.color).map(p => (
              <radialGradient key={p.el.id} id={`${idBase}-${p.i}`} cx="0" cy="0" r="96" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor={ruletaAclara(p.color, 0.62)}/>
                <stop offset="100%" stopColor={p.color}/>
              </radialGradient>
            ))}
          </defs>
          <circle r="99" className="ruleta-borde"/>
          {porciones.map(p => (
            <path
              key={p.el.id}
              d={p.d}
              fill={p.color ? `url(#${idBase}-${p.i})` : undefined}
              className={`ruleta-porcion ${p.el.hueco ? 'fantasma' : ''} ${p.el.id === recien ? 'nueva' : ''} ${elegido && !girando && p.el.id !== elegido.id ? 'apagada' : ''}`}
              onAnimationEnd={p.el.id === recien ? () => setRecien(null) : undefined}
            />
          ))}
          {porciones.map(p => (
            <text
              key={'t' + p.el.id}
              className={`ruleta-texto ${p.el.hueco ? 'fantasma' : ''}`}
              fill={p.el.hueco ? undefined : p.tinta}
              transform={`rotate(${p.giroTexto}) translate(${p.volteado ? 86 : 30} 0)${p.volteado ? ' rotate(180)' : ''}`}
              textAnchor="start"
              dominantBaseline="central"
              style={{ opacity: elegido && !girando && p.el.id !== elegido.id ? 0.45 : 1 }}
            >
              {p.el.texto.length > maxLetras ? p.el.texto.slice(0, maxLetras - 1) + '…' : p.el.texto}
            </text>
          ))}
          {/* Las luces del borde, como en una ruleta de feria. */}
          {Array.from({ length: 24 }, (_, i) => {
            const [x, y] = ruletaPunto(i * 15, 97.5);
            return <circle key={'l' + i} cx={x} cy={y} r="1.6" className="ruleta-luz"/>;
          })}
        </svg>
        <button
          key="centro"
          className={`ruleta-centro ${n < 2 ? 'espera' : ''}`}
          disabled={girando || n < 2}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); gira(); }}
          title={n < 2 ? window.t('Falta uno más para poder girar', 'One more to be able to spin') : window.t('Girar la ruleta', 'Spin the wheel')}
        >
          {girando ? '' : window.t('Girar', 'Spin')}
        </button>
        {elegido && !girando && (
          <div className="ruleta-premio" key={elegido.id + String(item.giro)} style={{ '--ev': elegido.color }}>
            {elegido.texto}
          </div>
        )}
        {anadir}
      </div>
    </div>
  );
}

window.RuletaItem = RuletaItem;
