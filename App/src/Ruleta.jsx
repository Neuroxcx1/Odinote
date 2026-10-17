// =====================================================
// Oddinote — el nodo de ruleta
//
// Lo básico de la ruleta que pidió el usuario, a partir de la de su captura:
// sin "personas", con elementos, y con la cara de la aplicación. Al girar
// frena como una ruleta de verdad, suena un "tic" cada vez que una tachuela
// pasa por la flecha y, al parar, un sonido corto de premio, confeti y un
// cartel con el que ha salido.
//
// Rehecha el 17/10 dos veces. Al usuario le parecía «muy simple»; la primera
// vuelta, de feria (tinta gruesa, aro con bombillas), le pareció más fea: la
// quiere con estilo Apple. Ahora es un plato blanco con sombra suave, las
// porciones en colores suaves separadas por líneas blancas, una flecha
// pequeña, el botón como los de iOS y el premio en una tarjeta de cristal.
// Lo que gira (las porciones y sus nombres) va en un SVG; lo que no gira (el
// plato, el brillo y la flecha) va aparte, quieto.
//
// Sin elementos se enseña un círculo en blanco que lo dice, con el botón para
// ir añadiéndolos ahí mismo. Con uno ya se dibuja la rueda, con ese y el hueco
// del segundo, que se va rellenando según se escribe.
//
// En el nodo se guarda: el giro (item.giro) para que siga donde se quedó, el
// último elegido (item.ultimo), los últimos resultados (item.historial), si
// el que sale se quita para la siguiente (item.quitaGanador, para sorteos y
// turnos) y cuánto dura el giro (item.duracion). Un elemento quitado no se
// borra: lleva fuera: true y se puede volver a meter desde la barra.
// =====================================================

// Los colores con los que va naciendo cada elemento, por turno. Los cuatro de
// la aplicación primero.
const RULETA_COLORES = ['#E6544F', '#F7DA84', '#90B968', '#3D5A80', '#955BA5', '#F2A65A', '#5BB5A2', '#E58FB0'];
// Cuánto dura una tirada, según lo elegido en la barra.
const RULETA_DURACIONES = { corta: 3000, normal: 5200, larga: 8500 };
// Hasta dónde llegan las porciones; de ahí al borde, el filo blanco del plato.
const RULETA_R = 92;
// A qué distancia del centro va el centro de cada nombre: a medio camino
// entre el botón de girar (radio ~27) y el borde.
const RULETA_RADIO_TEXTO = 60;
// Cuántos resultados se recuerdan.
const RULETA_HISTORIAL = 20;

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

// ── El confeti del final ──
// Pedido por el usuario: al parar, una explosión de confeti con los colores de
// la aplicación —verde, rojo y blanco— y solo de triangulitos, que son su
// otra seña. Cada uno lleva el borde de tinta de todo lo demás, que además
// hace que los blancos se vean sobre el lienzo claro.
//
// Va en un SVG encima de la rueda y en sus mismas unidades (la rueda mide 200),
// así que crece con ella y se mueve con el lienzo. Se anima a mano, fotograma
// a fotograma: salen del botón del centro hacia todos lados, caen con un poco
// de gravedad y aire, dan vueltas y se aplastan como papel al voltearse, y se
// apagan solos. Luego el SVG se quita.
const RULETA_CONFETI = ['#90B968', '#E6544F', '#FFFFFF'];
function ruletaConfeti(caja) {
  if (!caja) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'ruleta-confeti');
  svg.setAttribute('viewBox', '-200 -200 400 400');
  const piezas = [];
  for (let i = 0; i < 96; i++) {
    const lado = 2.4 + Math.random() * 3.2;
    const p = document.createElementNS(NS, 'polygon');
    p.setAttribute('points', `0,${(-lado).toFixed(2)} ${(lado * 0.9).toFixed(2)},${(lado * 0.6).toFixed(2)} ${(-lado * 0.9).toFixed(2)},${(lado * 0.6).toFixed(2)}`);
    p.setAttribute('fill', RULETA_CONFETI[i % RULETA_CONFETI.length]);
    // Con la ruleta al estilo Apple, el borde ya no es de tinta: un filo
    // suave, que basta para que los blancos se vean sobre el lienzo claro.
    p.setAttribute('stroke', 'rgba(0,0,0,0.22)');
    p.setAttribute('stroke-width', '0.4');
    p.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(p);
    const ang = Math.random() * Math.PI * 2;
    const vel = 120 + Math.random() * 190;
    const r0 = Math.random() * 12;
    piezas.push({
      el: p,
      x: Math.cos(ang) * r0, y: Math.sin(ang) * r0,
      vx: Math.cos(ang) * vel, vy: Math.sin(ang) * vel - 70,
      giro: Math.random() * 360, vg: (Math.random() - 0.5) * 820,
      volteo: 5 + Math.random() * 9,
      vida: 1.3 + Math.random() * 0.9,
    });
  }
  caja.appendChild(svg);
  // El tiempo del confeti es el que se ha dibujado, no el del reloj: en un
  // equipo lento o con la ventana atascada, los triángulos se apagaban por
  // edad antes de haber llegado a volar.
  let antes = performance.now();
  let t = 0;
  const paso = (ahora) => {
    const dt = Math.min(0.05, (ahora - antes) / 1000);
    antes = ahora;
    t += dt;
    let vivas = 0;
    for (const p of piezas) {
      if (t >= p.vida) { if (p.el.parentNode) p.el.remove(); continue; }
      vivas++;
      p.vx *= 1 - 1.5 * dt;
      p.vy = p.vy * (1 - 1.1 * dt) + 240 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.giro += p.vg * dt;
      const aplastado = Math.cos(t * p.volteo);
      const luz = Math.min(1, (p.vida - t) / 0.4);
      p.el.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${p.giro.toFixed(0)}) scale(1 ${aplastado.toFixed(2)})`);
      p.el.setAttribute('opacity', luz.toFixed(2));
    }
    if (vivas) requestAnimationFrame(paso);
    else svg.remove();
  };
  requestAnimationFrame(paso);
}

// La foto de una porción, encogida (360 px por el lado largo, WebP) y DENTRO
// del elemento como data: URL, igual que la portada de un proyecto. Así no
// pasa por los cinco sitios por donde viajan los medios de un nodo (bóveda,
// Drive, reemplazos, caché y tablero a proyecto): ocho fotos así son unos
// cientos de KB en el proyecto. Es a propósito, no un olvido.
function ruletaEncogeFoto(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const k = Math.min(1, 360 / Math.max(img.naturalWidth, img.naturalHeight));
        const lienzo = document.createElement('canvas');
        lienzo.width = Math.max(1, Math.round(img.naturalWidth * k));
        lienzo.height = Math.max(1, Math.round(img.naturalHeight * k));
        lienzo.getContext('2d').drawImage(img, 0, 0, lienzo.width, lienzo.height);
        let src = lienzo.toDataURL('image/webp', 0.82);
        if (!/^data:image\/webp/.test(src)) src = lienzo.toDataURL('image/jpeg', 0.85);
        resolve(src);
      } catch (e) { resolve(null); }
      finally { URL.revokeObjectURL(url); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}
window.ruletaEncogeFoto = ruletaEncogeFoto;

// Un punto de la circunferencia, con 0 grados ARRIBA y girando como el reloj.
function ruletaPunto(grados, radio) {
  const r = (grados - 90) * Math.PI / 180;
  return [Math.cos(r) * radio, Math.sin(r) * radio];
}

// Los elementos que están en la rueda: los quitados (fuera: true) se quedan
// en la lista para poder volver a meterlos, pero no giran.
function ruletaActivos(item) {
  return (Array.isArray(item.elementos) ? item.elementos : []).filter(e => e && !e.fuera);
}
window.ruletaActivos = ruletaActivos;

function RuletaItem({ item, lang, onUpdate }) {
  const elementos = Array.isArray(item.elementos) ? item.elementos : [];
  const activos = elementos.filter(e => !e.fuera);
  const n = activos.length;
  const [giro, setGiro] = React.useState(item.giro || 0);
  const [girando, setGirando] = React.useState(false);
  // Qué nombres van cabeza abajo se decide con el giro EN REPOSO: el de antes
  // de una tirada mientras dura, y el nuevo cuando para. Antes se decidía sin
  // contar el giro, y después de una tirada los de un lado acababan en el
  // otro, al revés. Mientras gira no se tocan (se verían voltearse a saltos).
  // Aquí arriba y no junto a la rueda: más abajo hay un return temprano (la
  // ruleta vacía) y un hook después de él rompía el nodo al añadir elementos.
  const reposoRef = React.useRef(giro);
  if (!girando) reposoRef.current = giro;
  const [ganador, setGanador] = React.useState(null);
  // Las luces celebran un momento al salir el premio.
  const [celebra, setCelebra] = React.useState(false);
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
  // La flecha salta un poco cuando la golpea una tachuela y vuelve con rebote.
  // Antes temblaba sin parar mientras la rueda giraba, también a punto de
  // frenar (lo vio el usuario). Así, al frenar, los golpes se espacian y la
  // flecha se queda quieta sola. Hacia la derecha porque la rueda gira como el
  // reloj: arriba, las porciones pasan de izquierda a derecha.
  const golpeFlecha = () => {
    const f = flechaRef.current;
    if (!f || !f.animate) return;
    f.animate([
      { transform: 'translateX(-50%) rotate(-16deg)' },
      { transform: 'translateX(-50%) rotate(0deg)' },
    ], { duration: 240, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' });
  };
  const animacion = React.useRef(null);
  // Lo último del nodo, para cuando la tirada acaba: el cierre del giro se
  // creó al empezar, y lo que haya cambiado entre medias se perdería.
  const itemRef = React.useRef(item);
  itemRef.current = item;
  const idBase = 'ruleta-' + String(item.id).replace(/[^a-z0-9_-]/gi, '');

  const escribe = (v) => { textoRef.current = v; setTexto(v); };
  const anade = (t) => {
    const limpio = String(t || '').trim();
    if (!limpio) return;
    const actuales = Array.isArray(itemRef.current.elementos) ? itemRef.current.elementos : [];
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
    ? [activos[0], { id: '__hueco', texto: texto.trim() || '?', hueco: true }]
    : activos;
  const m = lista.length;
  const paso = m ? 360 / m : 360;

  const gira = () => {
    if (n < 2 || girando) return;
    const it = itemRef.current;
    let todos = Array.isArray(it.elementos) ? it.elementos : [];
    // Con «quitar al que sale», el de la tirada anterior se va de la rueda
    // ahora, al empezar la siguiente: así se ha visto salir antes de irse.
    if (it.quitaGanador && it.ultimo && todos.some(e => e.id === it.ultimo && !e.fuera)) {
      if (todos.filter(e => !e.fuera).length <= 2) {
        window.showToast && window.showToast(window.t('Solo quedan dos: vuelve a meter los que salieron para seguir.', 'Only two left: put back the ones that came out to keep going.'));
        return;
      }
      todos = todos.map(e => e.id === it.ultimo ? { ...e, fuera: true } : e);
    }
    const enRueda = todos.filter(e => !e.fuera);
    const pasoTirada = 360 / enRueda.length;
    const elegido = Math.floor(Math.random() * enRueda.length);
    // Dónde tiene que quedar la flecha dentro de la porción elegida: en
    // cualquier sitio salvo pegada a los bordes, que parecería trampa.
    const dentro = (0.15 + Math.random() * 0.7) * pasoTirada;
    const objetivo = elegido * pasoTirada + dentro;
    const duracion = RULETA_DURACIONES[it.duracion] || RULETA_DURACIONES.normal;
    const vueltas = Math.max(3, Math.round(duracion / 1000)) + Math.floor(Math.random() * 3);
    const base = giro - (((giro % 360) + 360) % 360) + 360 * vueltas;
    const final = base + ((360 - objetivo) % 360);
    if (todos !== it.elementos) onUpdate({ elementos: todos, ultimo: null });
    setGanador(null);
    setCelebra(false);
    setGirando(true);
    setGiro(final);

    // Un "tic" cada vez que una tachuela pasa por la flecha. Se lee el giro
    // que lleva de verdad la rueda en pantalla (la transición la hace el
    // navegador) en vez de calcularlo, para que suene justo cuando se ve pasar.
    let ultima = null;
    const mira = () => {
      const el = ruedaRef.current;
      if (el) {
        const t = getComputedStyle(el).transform;
        const mm = /matrix\(([^,]+),\s*([^,]+)/.exec(t);
        if (mm) {
          const ang = Math.atan2(parseFloat(mm[2]), parseFloat(mm[1])) * 180 / Math.PI;
          const arriba = ((360 - ang) % 360 + 360) % 360;
          const porcion = Math.floor(arriba / pasoTirada);
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
      const gano = enRueda[elegido];
      setGanador(gano ? gano.id : null);
      setCelebra(true);
      setTimeout(() => setCelebra(false), 1800);
      ruletaSuena('premio');
      ruletaConfeti(ruedaRef.current && ruedaRef.current.parentElement);
      const antes = Array.isArray(itemRef.current.historial) ? itemRef.current.historial : [];
      const patch = { giro: ((final % 360) + 360) % 360, ultimo: gano ? gano.id : null };
      if (gano) patch.historial = [{ id: gano.id, texto: gano.texto, color: gano.color, t: Date.now() }, ...antes].slice(0, RULETA_HISTORIAL);
      onUpdate(patch);
      // El giro se deja en lo que se guarda: así la siguiente vuelta sale del
      // mismo sitio y no desenrolla las cinco vueltas de antes hacia atrás.
      setGiro(((final % 360) + 360) % 360);
    }, duracion);
  };
  React.useEffect(() => () => cancelAnimationFrame(animacion.current), []);
  // Lo mismo con el que acaba de salir, si cambian los elementos.
  React.useEffect(() => { if (!girando) setGanador(null); }, [n]);
  // Con dos ya se puede girar: el campo de añadir se va solo.
  React.useEffect(() => { if (n >= 2) { setEscribiendo(false); escribe(''); } }, [n]);
  React.useEffect(() => {
    const pedido = (e) => { if (e.detail === item.id) gira(); };
    window.addEventListener('odi-ruleta-girar', pedido);
    return () => window.removeEventListener('odi-ruleta-girar', pedido);
  });

  const elegidoId = n >= 2 ? (ganador || (!girando ? item.ultimo : null)) : null;
  const elegido = activos.find(e => e.id === elegidoId);
  // Quitar al que ha salido, a mano, desde su cartel.
  const quitaElegido = (e) => {
    e.stopPropagation();
    if (!elegido) return;
    if (n <= 2) {
      window.showToast && window.showToast(window.t('Hacen falta al menos dos en la rueda.', 'The wheel needs at least two.'));
      return;
    }
    onUpdate({ ultimo: null, elementos: elementos.map(x => x.id === elegido.id ? { ...x, fuera: true } : x) });
    setGanador(null);
    window.playAudioTone && window.playAudioTone('delete');
  };

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

  // Lo que no gira: el plato (blanco, con su sombra suave, debajo) y encima un
  // brillo muy leve que se queda quieto mientras la rueda da vueltas.
  const fondo = (
    <svg className="ruleta-fondo" viewBox="-100 -100 200 200" aria-hidden="true" key="fondo">
      <circle r="99" className="ruleta-plato"/>
    </svg>
  );
  const marco = (
    <svg className={`ruleta-marco ${celebra ? 'celebra' : ''}`} viewBox="-100 -100 200 200" aria-hidden="true" key="marco">
      <defs>
        <radialGradient id={`${idBase}-luz`} cx="0" cy={-RULETA_R * 0.35} r={RULETA_R * 1.1} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.22"/>
          <stop offset="60%" stopColor="#FFFFFF" stopOpacity="0"/>
        </radialGradient>
      </defs>
      {n >= 1 && <circle r={RULETA_R} fill={`url(#${idBase}-luz)`}/>}
      <circle r={RULETA_R} className="ruleta-filo"/>
      <circle r="99" className="ruleta-plato-borde"/>
    </svg>
  );
  // La flecha: un triángulo pequeño de puntas redondeadas, como los de iOS.
  const flecha = (
    <div className="ruleta-flecha" ref={flechaRef} key="flecha">
      <svg viewBox="0 0 24 26" aria-hidden="true">
        <path d="M4.2 2.5 H19.8 A2.6 2.6 0 0 1 22 6.4 L14.2 22.6 A2.5 2.5 0 0 1 9.8 22.6 L2 6.4 A2.6 2.6 0 0 1 4.2 2.5 Z" className="ruleta-flecha-cuerpo"/>
      </svg>
    </div>
  );

  // ── Sin ningún elemento ──
  if (n === 0) {
    const fuera = elementos.length;
    return (
      <div className="ruleta cero">
        <div className="ruleta-rueda-caja">
          <div className="ruleta-vacia" key="vacia">
            <div className="ruleta-vacia-texto">
              {fuera
                ? window.t('Han salido todos. Vuelve a meterlos desde la barra.', 'They have all come out. Put them back from the bar.')
                : window.t('Añade al menos dos elementos para girar la ruleta.', 'Add at least two items to spin the wheel.')}
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
    const [x0, y0] = ruletaPunto(a0, RULETA_R);
    const [x1, y1] = ruletaPunto(a1, RULETA_R);
    const grande = a1 - a0 > 180 ? 1 : 0;
    const medio = (a0 + a1) / 2;
    // El color del elemento, suavizado (ver ruletaSuave): vivos y oscuros a la
    // vez cansan, y el nombre negro tiene que leerse en todos.
    const color = el.hueco ? null : ruletaSuave(el.color || RULETA_COLORES[i % RULETA_COLORES.length]);
    // El nombre va a lo largo del radio, CENTRADO en su porción y a la misma
    // distancia del centro en todas (RULETA_RADIO_TEXTO). En la mitad que
    // queda a la izquierda en pantalla se da la vuelta para no leerse cabeza
    // abajo.
    const giroTexto = medio - 90;
    const enPantalla = (((giroTexto + reposoRef.current) % 360) + 360) % 360;
    const volteado = enPantalla > 90 && enPantalla < 270;
    // Siempre oscuro, lo pidió así: elegirlo según lo oscuro de cada porción
    // hacía que unos salieran blancos y otros negros, y parecía al azar. Con
    // los colores suavizados se lee en todas; sobre una foto lleva halo.
    const oscura = false;
    // La que ha salido se adelanta un poco hacia fuera, como si saliera.
    const [sx, sy] = ruletaPunto(medio, 2.4);
    return { el, i, color, medio, volteado, giroTexto, oscura, sx, sy,
      d: `M0 0 L${x0.toFixed(3)} ${y0.toFixed(3)} A${RULETA_R} ${RULETA_R} 0 ${grande} 1 ${x1.toFixed(3)} ${y1.toFixed(3)} Z` };
  });
  const maxLetras = m <= 4 ? 16 : m <= 8 ? 12 : 9;
  // La letra de cada porción no puede ser más alta que lo que mide la porción
  // de ancho donde empieza el texto (a unos 34 del centro): con 60 elementos
  // se montaban unos encima de otros. Hasta 24 se queda en su tamaño.
  const letraPorcion = Math.min(8, Math.max(3, (2 * Math.PI * 34 / Math.max(1, m)) * 0.9));
  const conFotos = lista.some(el => el.imagen && !el.hueco);
  const hayElegido = !!(elegido && !girando);

  return (
    <div className={`ruleta ${n === 1 ? 'uno' : ''} ${girando ? 'girando' : ''} ${hayElegido ? 'con-elegido' : ''}`}>
      <div className="ruleta-rueda-caja">
        {fondo}
        <svg
          key="rueda"
          ref={ruedaRef}
          className="ruleta-rueda"
          viewBox="-100 -100 200 200"
          style={{
            transform: `rotate(${giro}deg)`,
            transition: girando ? `transform ${RULETA_DURACIONES[item.duracion] || RULETA_DURACIONES.normal}ms cubic-bezier(0.12, 0.72, 0.1, 1)` : 'none',
          }}
        >
          <defs>
            {/* Las fotos: cada una recortada a su porción, y un desvanecido
                común que las deja enteras en el borde (lo más ancho, donde
                más lucen) y las borra hacia el centro, donde va el nombre. */}
            {conFotos && porciones.filter(p => p.el.imagen && !p.el.hueco).map(p => (
              <clipPath key={'c' + p.el.id} id={`${idBase}-recorte-${p.i}`}><path d={p.d}/></clipPath>
            ))}
            {conFotos && (
              <radialGradient id={`${idBase}-desvanece`} cx="0" cy="0" r={RULETA_R} gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0"/>
                <stop offset="32%" stopColor="#FFFFFF" stopOpacity="0.08"/>
                <stop offset="100%" stopColor="#FFFFFF" stopOpacity="1"/>
              </radialGradient>
            )}
            {conFotos && (
              <mask id={`${idBase}-mascara`} maskUnits="userSpaceOnUse" x="-100" y="-100" width="200" height="200">
                <rect x="-100" y="-100" width="200" height="200" fill={`url(#${idBase}-desvanece)`}/>
              </mask>
            )}
          </defs>
          {porciones.map(p => {
            const sale = hayElegido && p.el.id === elegido.id;
            return (
              <path
                key={p.el.id}
                d={p.d}
                fill={p.color || undefined}
                className={`ruleta-porcion ${p.el.hueco ? 'fantasma' : ''} ${p.el.id === recien ? 'nueva' : ''} ${hayElegido && !sale ? 'apagada' : ''} ${sale ? 'sale' : ''}`}
                style={sale ? { transform: `translate(${p.sx}px, ${p.sy}px)` } : undefined}
                onAnimationEnd={p.el.id === recien ? () => setRecien(null) : undefined}
              />
            );
          })}
          {/* Encima de su color: la foto, girada para que mire hacia fuera y
              tapando su porción sin deformarse (como object-fit: cover). */}
          {conFotos && (
            <g mask={`url(#${idBase}-mascara)`} className="ruleta-fotos">
              {porciones.filter(p => p.el.imagen && !p.el.hueco).map(p => {
                const ancho = Math.min(RULETA_R * 2, 2 * RULETA_R * Math.sin(Math.min(paso, 180) / 2 * Math.PI / 180)) + 4;
                return (
                  <g key={'f' + p.el.id} clipPath={`url(#${idBase}-recorte-${p.i})`}
                    style={{ opacity: hayElegido && p.el.id !== elegido.id ? 0.35 : 1 }}>
                    <image href={p.el.imagen} x={-ancho / 2} y={-RULETA_R - 2} width={ancho} height={RULETA_R + 2}
                      preserveAspectRatio="xMidYMid slice" transform={`rotate(${p.medio})`}/>
                  </g>
                );
              })}
            </g>
          )}
          {/* Una línea blanca entre porciones, del botón al borde: las separa
              sin pintar nada encima (con muchas, más fina). */}
          {n >= 2 && lista.map((el, i) => {
            const [x0, y0] = ruletaPunto(i * paso, 15);
            const [x, y] = ruletaPunto(i * paso, RULETA_R + 1);
            return <line key={'s' + el.id} x1={x0} y1={y0} x2={x} y2={y} className="ruleta-raya" style={m > 24 ? { strokeWidth: 0.8 } : undefined}/>;
          })}
          {porciones.map(p => (
            <text
              key={'n' + p.el.id}
              className={`ruleta-texto ${p.el.hueco ? 'fantasma' : ''} ${(p.el.imagen || p.oscura) ? 'con-halo' : ''}`}
              textAnchor="middle"
              dominantBaseline="central"
              style={{
                opacity: hayElegido && p.el.id !== elegido.id ? 0.35 : 1,
                // Con transform de CSS y no el atributo, para que al parar los
                // que quedan cabeza abajo se den la vuelta girando en su sitio
                // (y al añadir una porción, los demás se deslicen a la suya).
                transform: `rotate(${p.giroTexto}deg) translateX(${RULETA_RADIO_TEXTO}px) rotate(${p.volteado ? 180 : 0}deg)`,
                fontSize: letraPorcion < 8 ? letraPorcion + 'px' : undefined,
              }}
            >
              {p.el.texto.length > maxLetras ? p.el.texto.slice(0, maxLetras - 1) + '…' : p.el.texto}
            </text>
          ))}
        </svg>
        {marco}
        {flecha}
        <button
          key="centro"
          className={`ruleta-centro ${n < 2 ? 'espera' : ''}`}
          disabled={girando || n < 2}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); gira(); }}
          title={n < 2 ? window.t('Falta uno más para poder girar', 'One more to be able to spin') : window.t('Girar la ruleta', 'Spin the wheel')}
        >
          {girando ? <span className="material-symbols-rounded ruleta-centro-gira">cached</span> : window.t('Girar', 'Spin')}
        </button>
        {hayElegido && (
          <div className={'ruleta-premio' + (elegido.texto.length > 22 ? ' largo' : '')} key={elegido.id + String(item.giro)}>
            <i className="ruleta-premio-color" style={{ background: ruletaSuave(elegido.color || RULETA_COLORES[0]) }}/>
            <span className="ruleta-premio-texto">
              <span className="ruleta-premio-eti">{window.t('Ha salido', 'The wheel says')}</span>
              <span className="ruleta-premio-nombre">{elegido.texto}</span>
            </span>
            {n > 2 && (
              <button className="ruleta-premio-quitar" onMouseDown={(e) => e.stopPropagation()} onClick={quitaElegido}
                title={window.t('Quitarlo de la rueda (se puede volver a meter desde la barra)', 'Take it off the wheel (it can be put back from the bar)')}>
                {window.t('Quitar', 'Remove')}
              </button>
            )}
          </div>
        )}
        {anadir}
      </div>
    </div>
  );
}

// Lo claro que es un color (0 negro, 1 blanco).
function ruletaBrillo(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return 1;
  const v = parseInt(m[1], 16);
  return (0.299 * (v >> 16) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255)) / 255;
}
// El color de una porción, suavizado como los de Apple: se mezcla con blanco
// lo justo para que quede claro (brillo de al menos 0,62) y el nombre oscuro
// se lea encima; un amarillo casi no cambia y un azul oscuro pasa a un azul
// suave. Lo guardado no cambia: es solo cómo se pinta.
const ruletaSuaves = {};
function ruletaSuave(hex) {
  if (ruletaSuaves[hex]) return ruletaSuaves[hex];
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return hex;
  const v = parseInt(m[1], 16);
  const r = v >> 16, g = (v >> 8) & 255, b = v & 255;
  let k = 0.12;
  const mezcla = (c, f) => Math.round(c + (255 - c) * f);
  while (k < 0.8 && (0.299 * mezcla(r, k) + 0.587 * mezcla(g, k) + 0.114 * mezcla(b, k)) / 255 < 0.62) k += 0.04;
  const sale = '#' + [mezcla(r, k), mezcla(g, k), mezcla(b, k)].map(c => c.toString(16).padStart(2, '0')).join('');
  ruletaSuaves[hex] = sale;
  return sale;
}
window.ruletaSuave = ruletaSuave;

window.RuletaItem = RuletaItem;
// El confeti de triangulitos, para quien más celebre algo (el nodo de
// progreso al llegar al 100 %).
window.odiConfeti = ruletaConfeti;
