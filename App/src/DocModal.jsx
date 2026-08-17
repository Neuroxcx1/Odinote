// =====================================================
// Odinote — DocModal (fullscreen rich text editor)
// Uses contenteditable + execCommand for B/I/U/lists.
// =====================================================

// Tamaños de letra del selector, en píxeles. La misma escala que usan Word o
// Google Docs: pasos cortos en los tamaños de lectura y saltos grandes arriba,
// donde un punto más o menos ya no se nota.
const DOC_FONT_SIZES = [11, 12, 13, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64, 80];
const DOC_TEXT_COLORS = [
  '#1A1A1A', '#595459', '#9A969A', '#FFFFFF',
  '#E6544F', '#D88040', '#DDAF2C', '#90B968',
  '#3CA59E', '#3D5A80', '#6C5FAF', '#955BA5',
  '#993844', '#1F4D3F',
];
const DOC_MARK_COLORS = [
  '#FFF3A3', '#FFD9A0', '#FFC7C2', '#E6D6FF',
  '#CDE9FF', '#CFEFD6', '#E7E4EA', 'transparent',
];
// Tipografías. Se ofrecen familias, no fuentes sueltas: si el equipo no tiene
// la primera, el navegador baja a la siguiente y el texto no acaba en una letra
// cualquiera. La primera opción devuelve el documento a la letra del programa.
const DOC_FONTS = [
  { n: 'Del programa', v: '' },
  { n: 'Georgia', v: 'Georgia, "Times New Roman", serif' },
  { n: 'Times', v: '"Times New Roman", Times, serif' },
  { n: 'Arial', v: 'Arial, Helvetica, sans-serif' },
  { n: 'Verdana', v: 'Verdana, Geneva, sans-serif' },
  { n: 'Courier', v: '"Courier New", Courier, monospace' },
];
// Interlineado, en múltiplos de la altura de la línea, como en Word.
const DOC_LINE_HEIGHTS = [1, 1.15, 1.5, 2, 2.5, 3];
// Bloques a los que tiene sentido cambiarles interlineado o sangría.
const DOC_BLOCKS = 'P,H1,H2,H3,LI,BLOCKQUOTE,PRE,DIV';

// Lenguajes que se ofrecen en los bloques de código. "auto" deja que el
// resaltador adivine, y "plaintext" apaga los colores —que es lo que hace falta
// cuando el bloque no lleva código sino texto normal: si no, el adivinador
// pinta palabras sueltas de la prosa como si fueran palabras clave.
const DOC_LANGS = [
  { id: 'auto', n: 'Automático', en: 'Automatic' },
  { id: 'plaintext', n: 'Texto sin colores', en: 'Plain text' },
  { id: 'javascript', n: 'JavaScript' }, { id: 'typescript', n: 'TypeScript' },
  { id: 'python', n: 'Python' },         { id: 'json', n: 'JSON' },
  { id: 'css', n: 'CSS' },               { id: 'xml', n: 'HTML / XML' },
  { id: 'sql', n: 'SQL' },               { id: 'bash', n: 'Bash' },
  { id: 'c', n: 'C' },                   { id: 'cpp', n: 'C++' },
  { id: 'csharp', n: 'C#' },             { id: 'java', n: 'Java' },
  { id: 'go', n: 'Go' },                 { id: 'rust', n: 'Rust' },
  { id: 'lua', n: 'Lua' },               { id: 'php', n: 'PHP' },
  { id: 'ruby', n: 'Ruby' },             { id: 'yaml', n: 'YAML' },
];
// Para adivinar solo se le dejan los lenguajes corrientes. Con los 36 que trae
// el resaltador, un párrafo en castellano acababa detectado como Perl y salía
// pintado de colores sin ningún sentido.
const DOC_AUTO_LANGS = ['javascript', 'python', 'json', 'css', 'xml', 'sql', 'bash', 'java', 'cpp', 'csharp', 'go', 'rust', 'php', 'yaml', 'lua'];


function escapaTexto(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Por debajo de esto, lo que hay en el bloque no parece código de ese lenguaje.
// Una función corta de JavaScript ronda el 10; un párrafo de prosa castellana se
// queda entre 0 y 3, y sin este umbral acababa pintado de colores al azar.
const RELEVANCIA_MINIMA = 5;

// Cómo se comenta una línea en cada lenguaje.
const DOC_COMENTARIO = {
  javascript: '//', typescript: '//', java: '//', c: '//', cpp: '//', csharp: '//',
  go: '//', rust: '//', php: '//', css: '/*', scss: '//', less: '//',
  python: '#', bash: '#', shell: '#', yaml: '#', ruby: '#', makefile: '#',
  sql: '--', lua: '--', ini: ';', xml: '<!--', plaintext: '#', auto: '//',
};

// =====================================================
// BLOQUE DE CÓDIGO
//
// Un editor de código de verdad, no un trozo de texto enriquecido.
//
// Antes el código vivía dentro del mismo contenteditable que el resto del
// documento, y eso no funciona: el navegador decide por su cuenta qué hace el
// Intro, se traga los saltos de línea sueltos, el tabulador se lleva el foco, y
// cada vez que hay que repintar los colores el cursor se va a otro sitio. Cada
// arreglo abría un agujero nuevo.
//
// Ahora cada bloque es un widget aislado (`contenteditable=false`) con dentro la
// técnica de siempre para esto: un <textarea> transparente encima de una capa
// coloreada, alineados al píxel. El navegador se encarga del cursor, la
// selección, el Intro, el tabulador y el arrastrar-para-seleccionar —que es lo
// que sabe hacer bien—, y nosotros solo pintamos los colores detrás.
//
// GUARDADO: el documento sigue guardándose como <pre data-lang><code>texto</code>,
// igual que antes. El widget se monta al abrir y se deshace al guardar, así que
// lo ya escrito se sigue leyendo y el archivo no engorda con la maquinaria.
// =====================================================

const CLASE_WIDGET = 'odi-code';

function esWidget(pre) {
  return pre && pre.classList && pre.classList.contains(CLASE_WIDGET);
}

// Colorea el texto y lo mete en la capa de atrás.
function pintaCapa(pre, texto) {
  const capa = pre.querySelector('.odi-code-hl > code');
  if (!capa) return;
  const idioma = pre.getAttribute('data-lang') || 'auto';
  let html = escapaTexto(texto), detectado = '';

  if (window.hljs && texto.trim()) {
    try {
      if (idioma === 'auto') {
        const r = window.hljs.highlightAuto(texto, DOC_AUTO_LANGS);
        if (r && (r.relevance || 0) >= RELEVANCIA_MINIMA) {
          html = r.value;
          detectado = r.language || '';
        }
      } else if (idioma !== 'plaintext') {
        html = window.hljs.highlight(texto, { language: idioma, ignoreIllegals: true }).value;
      }
    } catch (e) { /* si el resaltador falla, se enseña el texto tal cual */ }
  }
  pre.setAttribute('data-detectado', detectado);
  // El salto final da altura a la última línea: sin él, al pulsar Intro abajo
  // del todo el cursor se salía de la caja.
  capa.innerHTML = html + '\n';
}

// Ajusta el alto del widget al del texto: la capa coloreada es la que manda, y
// el textarea se estira encima. Así no aparece una barra de desplazamiento
// dentro del bloque, que en un documento largo es incomodísima.
function ajustaAlto(pre) {
  const capa = pre.querySelector('.odi-code-hl');
  const ta = pre.querySelector('.odi-code-src');
  if (!capa || !ta) return;
  ta.style.height = capa.offsetHeight + 'px';
}

function refrescaWidget(pre) {
  const ta = pre.querySelector('.odi-code-src');
  if (!ta) return;
  pintaCapa(pre, ta.value);
  ajustaAlto(pre);
}

// Construye el widget dentro de un <pre data-lang><code>texto</code></pre>.
function montaCodigo(pre, cb) {
  if (!pre || esWidget(pre)) return;
  const texto = (pre.textContent || '').replace(/\n$/, '');
  if (!pre.getAttribute('data-lang')) pre.setAttribute('data-lang', 'auto');

  pre.classList.add(CLASE_WIDGET);
  pre.setAttribute('contenteditable', 'false');
  pre.innerHTML =
    '<div class="odi-code-head">' +
      '<span class="odi-code-lang"></span>' +
      '<span class="odi-code-tip">' +
        window.t('Tab sangra', 'Tab indents') + ' · ' +
        escapaTexto(etiquetaAtajoComentar()) + ' ' + window.t('comenta', 'comments') + ' · ' +
        window.t('Ctrl+Intro sale', 'Ctrl+Enter exits') +
      '</span>' +
    '</div>' +
    '<div class="odi-code-body">' +
      '<pre class="odi-code-hl" aria-hidden="true"><code></code></pre>' +
      '<textarea class="odi-code-src" spellcheck="false" autocapitalize="off" ' +
        'autocorrect="off" autocomplete="off"></textarea>' +
    '</div>';

  const ta = pre.querySelector('.odi-code-src');
  ta.value = texto;
  refrescaWidget(pre);
  ponEtiqueta(pre);
  enchufaTeclado(pre, ta, cb);
}

function ponEtiqueta(pre) {
  const et = pre.querySelector('.odi-code-lang');
  if (!et) return;
  const idioma = pre.getAttribute('data-lang') || 'auto';
  const det = pre.getAttribute('data-detectado') || '';
  const legible = (DOC_LANGS.find(l => l.id === idioma) || {}).n || idioma;
  et.textContent = idioma === 'auto' && det ? 'auto · ' + det : legible;
}

// ── Teclado del editor de código ──
//
// Todo esto es trivial en un <textarea> y era un infierno en un contenteditable:
// aquí el texto es una cadena y el cursor son dos números.
const PASO_TAB = '  ';

// ¿Esta tecla es la de comentar? Se mira primero lo que el usuario haya
// configurado en Ajustes, y si no, las dos formas de serie.
function esAtajoComentar(e) {
  const cfg = (window.shortcuts || {}).commentCode;
  if (cfg && cfg.key) {
    const igual = (e.key || '').toLowerCase() === String(cfg.key).toLowerCase();
    if (igual && !!e.shiftKey === !!cfg.shift && !!e.altKey === !!cfg.alt) return true;
  }
  return e.key === '/' || e.key === '7' || e.code === 'Slash' || e.code === 'Digit7';
}

// La combinación tal y como hay que enseñarla en la cabecera del bloque.
function etiquetaAtajoComentar() {
  const cfg = (window.shortcuts || {}).commentCode;
  return (cfg && cfg.label) || 'Ctrl + 7';
}

function enchufaTeclado(pre, ta, cb) {
  const avisa = () => {
    pre.setAttribute('data-src', ta.value);
    pintaCapa(pre, ta.value);
    ajustaAlto(pre);
    ponEtiqueta(pre);
    cb && cb.cambio && cb.cambio();
  };
  pre.setAttribute('data-src', ta.value);

  // Reemplaza un trozo del texto dejando el cursor donde se le diga
  const pon = (texto, desde, hasta) => {
    ta.value = texto;
    ta.selectionStart = desde;
    ta.selectionEnd = hasta === undefined ? desde : hasta;
    avisa();
  };

  // Las líneas que toca la selección, y dónde empieza y acaba cada una
  const lineasTocadas = () => {
    const t = ta.value;
    const iniLinea = t.lastIndexOf('\n', ta.selectionStart - 1) + 1;
    let finLinea = t.indexOf('\n', ta.selectionEnd);
    if (finLinea === -1) finLinea = t.length;
    return { iniLinea, finLinea, trozo: t.slice(iniLinea, finLinea) };
  };

  ta.addEventListener('input', () => { avisa(); cb && cb.escribe && cb.escribe(); });

  ta.addEventListener('focus', () => { cb && cb.foco && cb.foco(pre); });
  ta.addEventListener('blur', () => { cb && cb.desenfoca && cb.desenfoca(pre); });

  ta.addEventListener('keydown', (e) => {
    // Ningún atajo del documento ni del lienzo debe pasar de aquí
    const ctrl = e.ctrlKey || e.metaKey;
    const t = ta.value;
    const a = ta.selectionStart, b = ta.selectionEnd;

    // ── Tabulador: sangrar / desangrar ──
    if (e.key === 'Tab') {
      e.preventDefault(); e.stopPropagation();
      cb && cb.antesDeCambiar && cb.antesDeCambiar();
      const { iniLinea, finLinea, trozo } = lineasTocadas();
      if (!e.shiftKey && a === b && !trozo.includes('\n')) {
        pon(t.slice(0, a) + PASO_TAB + t.slice(a), a + PASO_TAB.length);
        return;
      }
      const lineas = trozo.split('\n');
      let corrIni = 0, corrTot = 0;
      const nuevas = lineas.map((l, i) => {
        if (e.shiftKey) {
          const quita = l.startsWith(PASO_TAB) ? PASO_TAB.length : (l.startsWith(' ') || l.startsWith('\t') ? 1 : 0);
          if (i === 0) corrIni -= quita;
          corrTot -= quita;
          return l.slice(quita);
        }
        if (i === 0) corrIni += PASO_TAB.length;
        corrTot += PASO_TAB.length;
        return PASO_TAB + l;
      });
      pon(t.slice(0, iniLinea) + nuevas.join('\n') + t.slice(finLinea),
        Math.max(iniLinea, a + corrIni), Math.max(iniLinea, b + corrTot));
      return;
    }

    // ── Comentar y descomentar ──
    // Se admiten tres formas a propósito: el atajo que el usuario haya puesto en
    // Ajustes, el Ctrl+7 de serie —que en un teclado español se pulsa de un
    // tirón— y el Ctrl+/ de siempre, para quien venga de otro editor. En un
    // teclado español ese "/" es Shift+7, por eso no puede ser el único.
    if (ctrl && esAtajoComentar(e)) {
      e.preventDefault(); e.stopPropagation();
      cb && cb.antesDeCambiar && cb.antesDeCambiar();
      const idioma = (pre.getAttribute('data-lang') !== 'auto' && pre.getAttribute('data-lang')) ||
        pre.getAttribute('data-detectado') || 'auto';
      const marca = DOC_COMENTARIO[idioma] || '//';
      const { iniLinea, finLinea, trozo } = lineasTocadas();
      const lineas = trozo.split('\n');
      const conTexto = lineas.filter(l => l.trim());
      // Si TODAS las líneas con algo escrito ya están comentadas, se descomenta
      const todasComentadas = conTexto.length > 0 &&
        conTexto.every(l => l.trimStart().startsWith(marca));
      // La sangría común, para que el comentario no rompa la alineación
      const sangria = conTexto.reduce((min, l) => {
        const s = (l.match(/^[ \t]*/) || [''])[0];
        return min === null || s.length < min.length ? s : min;
      }, null) || '';

      let corrIni = 0, corrTot = 0;
      const nuevas = lineas.map((l, i) => {
        if (!l.trim()) return l;
        let salida;
        if (todasComentadas) {
          const idx = l.indexOf(marca);
          const trasMarca = l.slice(idx + marca.length);
          salida = l.slice(0, idx) + (trasMarca.startsWith(' ') ? trasMarca.slice(1) : trasMarca);
        } else {
          salida = sangria + marca + ' ' + l.slice(sangria.length);
        }
        const delta = salida.length - l.length;
        if (i === 0) corrIni += delta;
        corrTot += delta;
        return salida;
      });
      pon(t.slice(0, iniLinea) + nuevas.join('\n') + t.slice(finLinea),
        Math.max(iniLinea, a + corrIni), Math.max(iniLinea, b + corrTot));
      return;
    }

    // ── Intro: salto de línea heredando la sangría, y un paso más tras "{" ──
    if (e.key === 'Enter' && !e.shiftKey && !ctrl) {
      e.preventDefault(); e.stopPropagation();
      cb && cb.antesDeCambiar && cb.antesDeCambiar();
      const lineaActual = t.slice(0, a).split('\n').pop();
      let sangria = (lineaActual.match(/^[ \t]*/) || [''])[0];
      if (/[{[(]\s*$/.test(lineaActual)) sangria += PASO_TAB;
      const mete = '\n' + sangria;
      pon(t.slice(0, a) + mete + t.slice(b), a + mete.length);
      return;
    }

    // ── Salir del bloque ──
    // Ctrl+Intro y Escape llevan al párrafo de abajo. La flecha abajo también,
    // si ya estás en la última línea: es lo que uno intenta por instinto.
    const bajaAlSalir = () => {
      e.preventDefault(); e.stopPropagation();
      cb && cb.sal && cb.sal(pre);
    };
    if ((ctrl && e.key === 'Enter') || e.key === 'Escape') { bajaAlSalir(); return; }
    if (e.key === 'ArrowDown' && a === b && t.indexOf('\n', a) === -1) { bajaAlSalir(); return; }
    if (e.key === 'ArrowUp' && a === b && t.lastIndexOf('\n', a - 1) === -1) {
      e.preventDefault(); e.stopPropagation();
      cb && cb.sube && cb.sube(pre);
      return;
    }

    // Retroceso en un bloque vacío: se borra el bloque entero. Sin esto, un
    // bloque puesto por error no había forma de quitarlo desde el teclado.
    if (e.key === 'Backspace' && !t && a === 0) {
      e.preventDefault(); e.stopPropagation();
      cb && cb.borra && cb.borra(pre);
      return;
    }

    // Deshacer/rehacer: los del <textarea> son los del navegador y funcionan
    // bien aquí, pero no deben subir al documento ni al lienzo.
    if (ctrl && (e.key === 'z' || e.key === 'Z' || e.key === 'y' || e.key === 'Y')) {
      e.stopPropagation();
      return;
    }
    // Cualquier otra tecla se queda dentro del bloque
    e.stopPropagation();
  });
}

// Deshace todos los widgets de una copia del documento y devuelve el HTML que se
// guarda. Se trabaja sobre un clon: el editor que ve el usuario no se toca.
function htmlParaGuardar(raiz) {
  if (!raiz) return '';
  const copia = raiz.cloneNode(true);
  copia.querySelectorAll('pre.' + CLASE_WIDGET).forEach(w => {
    // En el clon los textarea no llevan su valor, así que se lee del original
    const limpio = document.createElement('pre');
    limpio.setAttribute('data-lang', w.getAttribute('data-lang') || 'auto');
    const code = document.createElement('code');
    code.textContent = w.getAttribute('data-src') || '';
    limpio.appendChild(code);
    w.parentNode.replaceChild(limpio, w);
  });
  return copia.innerHTML;
}

// Un grupo de la barra: los botones y, debajo, el nombre de la categoría.
//
// Va FUERA del componente a propósito. Declarado dentro, React lo trataría como
// un tipo de componente distinto en cada dibujado y desmontaría y volvería a
// crear la barra entera cada vez que cambia la selección: parpadeo, y los
// botones que ya tenías en la mano dejaban de responder porque el elemento al
// que apuntaba el ratón ya no estaba en la página.
function DocGrupo({ nombre, children }) {
  return (
    <div className="doc-group">
      <div className="doc-group-btns">{children}</div>
      <div className="doc-group-name">{nombre}</div>
    </div>
  );
}

function DocModal({ docItem, lang, onClose, onUpdate }) {
  const titleRef = React.useRef(null);
  const bodyRef = React.useRef(null);
  const [active, setActive] = React.useState({});
  const [linkMenu, setLinkMenu] = React.useState(null); // { top, left, value }
  const [pop, setPop] = React.useState(null);           // 'size' | 'text' | 'mark' | null
  const savedRangeRef = React.useRef(null);             // selection captured when the link menu opened
  const linkInputRef = React.useRef(null);
  const popRangeRef = React.useRef(null);               // selección al abrir un desplegable de la barra
  const colorLibreRef = React.useRef(null);             // color elegido en el selector del sistema

  // Último color usado de cada tipo. Se recuerda entre sesiones porque casi
  // nadie cambia de color a cada frase: se elige uno y se repite.
  const [ultimoColor, setUltimoColor] = React.useState(() => {
    try {
      const g = JSON.parse(localStorage.getItem('odinote.doc_colors') || '{}');
      return { text: g.text || '#E6544F', mark: g.mark || '#FFF3A3' };
    } catch (e) { return { text: '#E6544F', mark: '#FFF3A3' }; }
  });
  const recuerdaColor = (kind, color) => {
    setUltimoColor(prev => {
      const next = { ...prev, [kind === 'text' ? 'text' : 'mark']: color };
      try { localStorage.setItem('odinote.doc_colors', JSON.stringify(next)); } catch (e) {}
      return next;
    });
  };

  const timeoutRef = React.useRef(null);
  const pendingUpdateRef = React.useRef(null);

  const debounceUpdate = React.useCallback((patch) => {
    pendingUpdateRef.current = { ...pendingUpdateRef.current, ...patch };
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (pendingUpdateRef.current) {
        onUpdate(pendingUpdateRef.current);
        pendingUpdateRef.current = null;
      }
    }, 600); // 600ms debounce
  }, [onUpdate]);

  // Flush pending updates on unmount
  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (pendingUpdateRef.current) {
        onUpdate(pendingUpdateRef.current);
      }
    };
  }, [onUpdate]);

  // ── Deshacer y rehacer, propios del documento ──
  //
  // El lienzo intercepta Ctrl+Z incluso escribiendo dentro de un nodo, para
  // poder deshacer el movimiento de una nota mientras la editas. Dentro del
  // documento eso está mal: aquí Ctrl+Z tiene que deshacer LO ESCRITO. Y el
  // deshacer del navegador tampoco vale, porque no sabe nada de los cambios que
  // hacemos por nuestra cuenta al DOM (tamaño de letra, sangría, interlineado,
  // código); solo recordaría la mitad de lo ocurrido, que es peor que nada.
  //
  // Se guardan instantáneas del contenido: una al parar de escribir y otra a
  // cada lado de las operaciones de la barra.
  const pilaRef = React.useRef([]);
  const idxRef = React.useRef(-1);
  const capturaTimerRef = React.useRef(null);
  const MAX_HISTORIA = 120;

  const captura = React.useCallback(() => {
    const el = bodyRef.current;
    if (!el) return;
    // Siempre la forma limpia: si se guardara el HTML del editor de código, al
    // deshacer se reconstruirían widgets dentro de widgets.
    const html = htmlParaGuardar(el);
    if (pilaRef.current[idxRef.current] === html) return;
    // Al escribir después de haber deshecho, lo rehecho deja de tener sentido.
    pilaRef.current = pilaRef.current.slice(0, idxRef.current + 1);
    pilaRef.current.push(html);
    if (pilaRef.current.length > MAX_HISTORIA) pilaRef.current.shift();
    idxRef.current = pilaRef.current.length - 1;
  }, []);

  // Instantánea inmediata, sin esperar a que pare de escribir. Se usa ANTES de
  // cada operación de la barra, para que deshacer devuelva al estado anterior.
  const capturaYa = React.useCallback(() => {
    if (capturaTimerRef.current) { clearTimeout(capturaTimerRef.current); capturaTimerRef.current = null; }
    captura();
  }, [captura]);

  const restaura = (html) => {
    const el = bodyRef.current;
    if (!el || html == null) return;
    el.innerHTML = html;
    montaTodosLosCodigos();
    el.focus();
    // Cursor al final: recolocarlo donde estaba exigiría guardar también la
    // selección en cada instantánea, y no compensa.
    const sel = window.getSelection();
    const r = document.createRange();
    r.selectNodeContents(el);
    r.collapse(false);
    sel.removeAllRanges();
    sel.addRange(r);
    debounceUpdate({ body: { es: html, en: html } });
    refreshActive();
  };

  const deshacer = () => {
    capturaYa();
    if (idxRef.current <= 0) return;
    idxRef.current--;
    restaura(pilaRef.current[idxRef.current]);
  };

  const rehacer = () => {
    if (idxRef.current >= pilaRef.current.length - 1) return;
    idxRef.current++;
    restaura(pilaRef.current[idxRef.current]);
  };

  // Set initial content once
  React.useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.innerHTML = window.pickLang(docItem.body, lang) || '';
      // Los bloques de código guardados se vuelven a colorear al abrir: los
      // colores no se guardan en el documento, se calculan. Así un cambio en el
      // resaltador se nota en lo ya escrito, y el archivo guardado no engorda
      // con cientos de etiquetas de color.
      montaTodosLosCodigos();
      pilaRef.current = [htmlParaGuardar(bodyRef.current)];
      idxRef.current = 0;
    }
    if (titleRef.current) {
      titleRef.current.value = window.pickLang(docItem.title, lang) || '';
      // Adjust height to fit loaded title
      titleRef.current.style.height = 'auto';
      titleRef.current.style.height = titleRef.current.scrollHeight + 'px';
    }
    // El número del selector de tamaño tiene que decir algo desde el principio,
    // no un guion hasta que el usuario toque el texto.
    setTimeout(() => { bodyRef.current?.focus(); refreshActive(); }, 50);
  // eslint-disable-next-line
  }, [docItem.id]);

  const refreshActive = () => {
    const sel = window.getSelection();
    const hasSel = !!(sel && sel.rangeCount && !sel.isCollapsed &&
      bodyRef.current && bodyRef.current.contains(sel.getRangeAt(0).commonAncestorContainer));
      
    let isH1 = false;
    let isH2 = false;
    let isH3 = false;
    let isQuote = false;
    if (sel && sel.rangeCount) {
      let node = sel.anchorNode;
      while (node && node !== bodyRef.current) {
        if (node.nodeType === 1) {
          if (node.tagName === 'H1') isH1 = true;
          if (node.tagName === 'H2') isH2 = true;
          if (node.tagName === 'H3') isH3 = true;
          if (node.tagName === 'BLOCKQUOTE') isQuote = true;
        }
        node = node.parentNode;
      }
    }
    const isP = !isH1 && !isH2 && !isH3 && !isQuote && !document.queryCommandState('insertUnorderedList') && !document.queryCommandState('insertOrderedList');

    // ¿Se está escribiendo dentro de un bloque de código? Ya no se puede mirar
    // la selección del documento: el bloque es un editor aparte con su propio
    // foco, así que se lleva apuntado cuál lo tiene.
    const preActual = codigoActivoRef.current;

    // Tamaño de letra donde está el cursor. Se lee del estilo ya calculado en
    // vez del atributo: así también sale bien el tamaño heredado de un H1 o de
    // una cita, que es lo que el usuario está viendo en pantalla.
    let size = null;
    if (sel && sel.anchorNode && bodyRef.current && bodyRef.current.contains(sel.anchorNode)) {
      let node = sel.anchorNode;
      // Cuando la selección abarca elementos enteros, el ancla es el padre y el
      // desplazamiento dice cuál de sus hijos empieza la selección. Sin bajar a
      // ese hijo se leería el tamaño del párrafo y no el del texto elegido: la
      // cifra se quedaba en 16 con el texto ya puesto a 18.
      if (node.nodeType === 1 && node.childNodes[sel.anchorOffset]) {
        node = node.childNodes[sel.anchorOffset];
      }
      const el = node.nodeType === 1 ? node : node.parentElement;
      if (el && el.nodeType === 1) {
        const px = parseFloat(getComputedStyle(el).fontSize);
        if (px) size = Math.round(px);
      }
    }

    setActive({
      size,
      bold:      document.queryCommandState('bold'),
      italic:    document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      strike:    document.queryCommandState('strikeThrough'),
      ul:        document.queryCommandState('insertUnorderedList'),
      ol:        document.queryCommandState('insertOrderedList'),
      alignC:    document.queryCommandState('justifyCenter'),
      alignR:    document.queryCommandState('justifyRight'),
      alignJ:    document.queryCommandState('justifyFull'),
      sup:       document.queryCommandState('superscript'),
      sub:       document.queryCommandState('subscript'),
      h1:        isH1,
      h2:        isH2,
      h3:        isH3,
      p:         isP,
      quote:     isQuote,
      hasSel,
      enCodigo: !!preActual,
      langCodigo: preActual ? (preActual.getAttribute('data-lang') || 'auto') : null,
      // Cuenta de palabras y caracteres, como la barra de estado de Word. Para
      // quien escribe de verdad es información de trabajo, no un adorno.
      words: cuentaPalabras(bodyRef.current),
      chars: (bodyRef.current ? (bodyRef.current.innerText || '') : '').replace(/\s+$/,'').length,
    });
  };

  const cuentaPalabras = (el) => {
    const texto = (el ? (el.innerText || '') : '').trim();
    return texto ? texto.split(/\s+/).length : 0;
  };

  const exec = (cmd, val) => {
    capturaYa();
    if (cmd === 'formatBlock') {
      const cleanTag = val.replace(/[<>]/g, '').toLowerCase();
      const changed = window.changeBlockTag && window.changeBlockTag(bodyRef.current, cleanTag);
      if (changed) {
        bodyRef.current?.focus();
        refreshActive();
        commitBody();
        return;
      }
      // Clean inline styling so the block takes theme styles cleanly
      document.execCommand('removeFormat', false, null);
    }
    document.execCommand(cmd, false, val);
    bodyRef.current?.focus();
    refreshActive();
    commitBody();
  };

  const commitBody = () => {
    if (!bodyRef.current) return;
    // Se guarda la forma LIMPIA: los bloques de código vuelven a ser
    // <pre><code>texto</code></pre>, sin la maquinaria del editor.
    const html = htmlParaGuardar(bodyRef.current);
    debounceUpdate({ body: { es: html, en: html } });
    // Instantánea al parar de escribir: deshacer va de pausa en pausa, como en
    // un procesador de textos, no letra a letra.
    if (capturaTimerRef.current) clearTimeout(capturaTimerRef.current);
    capturaTimerRef.current = setTimeout(() => { capturaTimerRef.current = null; captura(); }, 500);
  };

  const commitTitle = () => {
    if (!titleRef.current) return;
    debounceUpdate({ title: { es: titleRef.current.value, en: titleRef.current.value } });
  };

  // Detrás de un bloque de código tiene que quedar SIEMPRE un párrafo normal.
  // Si el bloque es lo último del documento no hay dónde pulsar para salir de
  // él: el cursor se queda atrapado dentro y todo lo que escribas después
  // acaba siendo código.
  const garantizaSalidaTrasCodigo = () => {
    const ed = bodyRef.current;
    if (!ed) return false;
    let cambió = false;
    [...ed.children].filter(n => n.tagName === 'PRE').forEach(pre => {
      const sig = pre.nextElementSibling;
      if (!sig || sig.tagName === 'PRE') {
        const p = document.createElement('p');
        p.appendChild(document.createElement('br'));
        pre.parentNode.insertBefore(p, pre.nextSibling);
        cambió = true;
      }
    });
    return cambió;
  };

  // Lleva el cursor al final del documento, siempre a un párrafo normal.
  const vaAlFinal = () => {
    const ed = bodyRef.current;
    if (!ed) return;
    garantizaSalidaTrasCodigo();
    let destino = ed.lastElementChild;
    if (!destino) {
      const p = document.createElement('p');
      p.appendChild(document.createElement('br'));
      ed.appendChild(p);
      destino = p;
    }
    const r = document.createRange();
    r.selectNodeContents(destino);
    r.collapse(false);
    const s = window.getSelection();
    s.removeAllRanges();
    s.addRange(r);
    ed.focus();
    refreshActive();
  };

  // ── Los bloques de código, que son widgets aparte ──
  const codigoActivoRef = React.useRef(null);   // el bloque que tiene el foco

  // Qué hace el widget cuando pasa algo dentro de él.
  const ganchosCodigo = {
    antesDeCambiar: () => capturaYa(),
    cambio: () => commitBody(),
    foco: (pre) => { codigoActivoRef.current = pre; refreshActive(); },
    desenfoca: (pre) => {
      if (codigoActivoRef.current === pre) codigoActivoRef.current = null;
      refreshActive();
    },
    // Salir del bloque hacia el párrafo de abajo (o el de arriba)
    sal: (pre) => { garantizaSalidaTrasCodigo(); ponCursorEnBloque(pre.nextElementSibling, true); },
    sube: (pre) => { ponCursorEnBloque(pre.previousElementSibling, false); },
    borra: (pre) => {
      capturaYa();
      const sig = pre.nextElementSibling || pre.previousElementSibling;
      pre.remove();
      ponCursorEnBloque(sig, true);
      commitBody();
    },
  };

  const ponCursorEnBloque = (el, alPrincipio) => {
    const ed = bodyRef.current;
    if (!ed) return;
    if (!el) {
      const p = document.createElement('p');
      p.appendChild(document.createElement('br'));
      ed.appendChild(p);
      el = p;
    }
    if (esWidget(el)) { const ta = el.querySelector('.odi-code-src'); if (ta) ta.focus(); return; }
    const r = document.createRange();
    r.selectNodeContents(el);
    r.collapse(!!alPrincipio);
    const s = window.getSelection();
    s.removeAllRanges();
    s.addRange(r);
    ed.focus();
    refreshActive();
  };

  // Monta el editor dentro de cada bloque de código guardado como texto.
  // Solo los <pre> que son hijos directos del editor. El widget lleva DENTRO
  // otro <pre> (la capa de colores), y sin este filtro se montaría un editor
  // dentro de otro hasta reventar.
  const bloquesDeCodigo = () => {
    const ed = bodyRef.current;
    if (!ed) return [];
    return [...ed.children].filter(n => n.tagName === 'PRE');
  };

  const montaTodosLosCodigos = () => {
    bloquesDeCodigo().forEach(pre => montaCodigo(pre, ganchosCodigo));
    garantizaSalidaTrasCodigo();
  };

  const cambiaIdiomaCodigo = (id) => {
    const pre = codigoActivoRef.current ||
      (bodyRef.current && bodyRef.current.querySelector('pre.' + CLASE_WIDGET));
    if (!pre) return;
    capturaYa();
    pre.setAttribute('data-lang', id);
    refrescaWidget(pre);
    ponEtiqueta(pre);
    const ta = pre.querySelector('.odi-code-src');
    if (ta) ta.focus();
    commitBody();
    refreshActive();
  };

  // ── Selección: casi todo lo de abajo solo tiene sentido sobre texto elegido ──
  const selectionInBody = () => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || !bodyRef.current) return null;
    const range = sel.getRangeAt(0);
    if (!bodyRef.current.contains(range.commonAncestorContainer)) return null;
    return { sel, range };
  };

  // Los desplegables de la barra se colocan en coordenadas fijas junto al botón
  // pulsado. La barra es una columna estrecha que puede desbordarse y llevar su
  // propia barra de desplazamiento: un panel colocado dentro de ella quedaría
  // recortado, que es justo lo que ya pasó con la ayuda de los atajos.
  const abrePop = (kind, e) => {
    if (pop && pop.kind === kind) { setPop(null); return; }
    // El texto marcado se guarda al abrir. Hace falta para el selector de color
    // libre: es un campo del sistema, y para abrirse tiene que quedarse con el
    // foco, lo que borra la selección del documento. Con el trozo guardado se
    // puede devolver antes de aplicar el color.
    const found = selectionInBody();
    popRangeRef.current = found && !found.sel.isCollapsed ? found.range.cloneRange() : null;

    const r = e.currentTarget.getBoundingClientRect();
    const alto = kind === 'size' ? 320 : 190;
    const ancho = 210;
    setPop({
      kind,
      // La barra ahora es horizontal y está arriba, así que el panel cuelga por
      // debajo del botón, no a su derecha.
      left: Math.max(12, Math.min(r.left, window.innerWidth - ancho - 12)),
      top: Math.min(r.bottom + 6, window.innerHeight - alto - 12),
    });
  };

  // Devuelve al documento el texto que estaba marcado al abrir el desplegable.
  const recuperaSeleccion = () => {
    const rango = popRangeRef.current;
    if (!rango || !bodyRef.current) return false;
    if (!bodyRef.current.contains(rango.commonAncestorContainer)) return false;
    bodyRef.current.focus();
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(rango);
    return true;
  };

  const aplicaColorLibre = () => {
    const c = colorLibreRef.current;
    if (!c || !pop) return;
    colorLibreRef.current = null;
    recuperaSeleccion();
    applyColor(pop.kind === 'text' ? 'foreColor' : 'hiliteColor', c);
    setPop(null);
  };

  const avisaSelecciona = () => {
    window.showToast && window.showToast(
      window.t('Selecciona antes el texto que quieres cambiar.', 'Select the text you want to change first.')
    );
  };

  // ── Tamaño de letra, como en Word ──
  //
  // execCommand('fontSize') solo admite los siete tamaños de HTML 3.2 y escribe
  // <font>, una etiqueta muerta. Pero es lo único que sabe repartir un cambio
  // por una selección que cruza varios párrafos, listas y negritas, que es la
  // parte de verdad difícil. Así que se le pide el tamaño 7 —el que nadie usa,
  // para reconocer lo que acaba de crear— y acto seguido se cambian esos <font>
  // por un <span> con el tamaño real en píxeles.
  const applyFontSize = (px) => {
    const ed = bodyRef.current;
    const found = selectionInBody();
    if (!ed || !found || found.sel.isCollapsed) { avisaSelecciona(); return; }
    capturaYa();

    document.execCommand('styleWithCSS', false, false);
    document.execCommand('fontSize', false, '7');

    const creados = [];
    ed.querySelectorAll('font[size="7"]').forEach(f => {
      const span = document.createElement('span');
      span.style.fontSize = px + 'px';
      while (f.firstChild) span.appendChild(f.firstChild);
      f.parentNode.replaceChild(span, f);
      creados.push(span);
    });

    // Un tamaño escrito más adentro gana al de fuera, así que si la selección
    // ya tenía trozos con tamaño propio hay que quitárselo; si no, cambiar el
    // tamaño del párrafo entero no tocaría esos trozos y quedaría a medias.
    creados.forEach(span => {
      span.querySelectorAll('[style*="font-size"]').forEach(hijo => {
        hijo.style.fontSize = '';
        if (!hijo.getAttribute('style')) hijo.removeAttribute('style');
      });
    });

    // Se deja seleccionado lo mismo que había, para poder seguir subiendo o
    // bajando el tamaño a golpes sin volver a marcar el texto cada vez.
    if (creados.length) {
      const r = document.createRange();
      r.setStartBefore(creados[0]);
      r.setEndAfter(creados[creados.length - 1]);
      const s = window.getSelection();
      s.removeAllRanges();
      s.addRange(r);
    }
    ed.focus();
    refreshActive();
    commitBody();
  };

  // Sube o baja al siguiente tamaño de la escala partiendo del actual.
  const stepFontSize = (dir) => {
    const actual = active.size || 16;
    const px = dir > 0
      ? (DOC_FONT_SIZES.find(s => s > actual) || DOC_FONT_SIZES[DOC_FONT_SIZES.length - 1])
      : (DOC_FONT_SIZES.slice().reverse().find(s => s < actual) || DOC_FONT_SIZES[0]);
    applyFontSize(px);
  };

  // ── Tipografía ──
  // Mismo truco que con el tamaño: el navegador reparte el cambio por la
  // selección escribiendo <font face>, y aquí se cambia por un <span>.
  const applyFontFamily = (familia) => {
    const ed = bodyRef.current;
    const found = selectionInBody();
    if (!ed || !found || found.sel.isCollapsed) { avisaSelecciona(); return; }
    capturaYa();

    document.execCommand('styleWithCSS', false, false);
    document.execCommand('fontName', false, familia || 'ODI-RESET');

    const creados = [];
    ed.querySelectorAll('font[face]').forEach(f => {
      const span = document.createElement('span');
      if (familia) span.style.fontFamily = familia;
      while (f.firstChild) span.appendChild(f.firstChild);
      f.parentNode.replaceChild(span, f);
      creados.push(span);
    });
    // "Del programa" no pone una letra concreta: quita las que hubiera, para
    // que el documento vuelva a heredar la del resto de la aplicación.
    creados.forEach(span => {
      span.querySelectorAll('[style*="font-family"]').forEach(hijo => {
        hijo.style.fontFamily = '';
        if (!hijo.getAttribute('style')) hijo.removeAttribute('style');
      });
      if (!familia && !span.getAttribute('style')) {
        while (span.firstChild) span.parentNode.insertBefore(span.firstChild, span);
        span.remove();
      }
    });
    ed.focus();
    commitBody();
  };

  // ── Bloques tocados por la selección ──
  // El interlineado y la sangría son propiedades del párrafo, no del trozo de
  // texto marcado: hay que dar con los bloques que la selección atraviesa.
  const bloquesDeLaSeleccion = () => {
    const ed = bodyRef.current;
    const found = selectionInBody();
    if (!ed) return [];
    if (!found) return [];
    const todos = [...ed.querySelectorAll(DOC_BLOCKS)];
    const dentro = todos.filter(b => found.range.intersectsNode(b));
    // Sin bloques (texto suelto directamente en el editor) se usa el editor.
    if (!dentro.length) return [ed];
    // Solo los bloques más internos: si un <li> está dentro de un <ul> y ambos
    // salen en la lista, poner el estilo en los dos lo aplica dos veces.
    return dentro.filter(b => !dentro.some(o => o !== b && b.contains(o)));
  };

  const applyLineHeight = (lh) => {
    const bloques = bloquesDeLaSeleccion();
    if (!bloques.length) { avisaSelecciona(); return; }
    capturaYa();
    bloques.forEach(b => { b.style.lineHeight = String(lh); });
    bodyRef.current?.focus();
    commitBody();
  };

  // Sangría: se mueve el margen izquierdo del bloque en pasos de 32px, como el
  // tabulador de un procesador de textos. No se usa el mandato "indent" del
  // navegador porque envuelve el párrafo en una cita y cambia su aspecto.
  const stepIndent = (dir) => {
    const bloques = bloquesDeLaSeleccion();
    if (!bloques.length) { avisaSelecciona(); return; }
    capturaYa();
    bloques.forEach(b => {
      const actual = parseFloat(b.style.marginLeft) || 0;
      const nuevo = Math.max(0, Math.min(320, actual + dir * 32));
      b.style.marginLeft = nuevo ? nuevo + 'px' : '';
      if (!b.getAttribute('style')) b.removeAttribute('style');
    });
    bodyRef.current?.focus();
    commitBody();
  };

  // ── Color de letra y resaltado ──
  const applyColor = (cmd, color) => {
    let found = selectionInBody();
    // Si el desplegable se llevó el foco, se devuelve el trozo que había marcado
    if ((!found || found.sel.isCollapsed) && recuperaSeleccion()) found = selectionInBody();
    if (!found || found.sel.isCollapsed) { avisaSelecciona(); return; }
    capturaYa();
    // Con styleWithCSS el color sale como estilo en un <span>; sin él, el
    // navegador aún escribe <font color>, que ya no se estila igual en todas
    // partes. Se devuelve luego a su valor normal para no cambiar cómo se
    // comportan la negrita y la cursiva, que sí quedan mejor como etiquetas.
    document.execCommand('styleWithCSS', false, true);
    document.execCommand(cmd, false, color);
    document.execCommand('styleWithCSS', false, false);
    recuerdaColor(cmd === 'foreColor' ? 'text' : 'mark', color);
    bodyRef.current?.focus();
    commitBody();
  };

  // ── Código: en línea si es un trozo corto, en bloque si no ──
  // Mismo criterio que en las notas, para que el nodo documento no se comporte
  // distinto del resto del programa.
  const insertCode = () => {
    const ed = bodyRef.current;
    if (!ed) return;
    capturaYa();
    const found = selectionInBody();
    const sel = found ? found.sel : window.getSelection();
    const texto = sel && !sel.isCollapsed ? sel.toString() : '';

    // Trozo corto de una sola línea → código EN LÍNEA, dentro del párrafo.
    if (texto && !texto.includes('\n') && texto.length < 60) {
      const range = sel.getRangeAt(0);
      const code = document.createElement('code');
      code.appendChild(range.extractContents());
      range.insertNode(code);
      ed.focus();
      commitBody();
      return;
    }

    // Lo demás → BLOQUE de código. Un <pre> es un bloque y no puede ir dentro de
    // un <p>: si se inserta ahí, el navegador cierra el párrafo por su cuenta y
    // el resultado es la caja descuadrada, con el texto saliéndose, que salía
    // antes. Así que el bloque se coloca SIEMPRE al mismo nivel que el párrafo,
    // detrás de él, y el texto elegido se saca de donde estaba.
    const pre = document.createElement('pre');
    pre.setAttribute('data-lang', 'auto');
    const code = document.createElement('code');
    code.textContent = texto || (lang === 'es' ? '// código' : '// code');
    pre.appendChild(code);

    // El bloque que contiene la selección; si no hay ninguno, el propio editor.
    let bloque = null;
    if (found) {
      const nodo = found.range.startContainer;
      const el = nodo.nodeType === 1 ? nodo : nodo.parentElement;
      bloque = el && el.closest ? el.closest(DOC_BLOCKS) : null;
      if (bloque && !ed.contains(bloque)) bloque = null;
      if (sel && !sel.isCollapsed) sel.getRangeAt(0).deleteContents();
    }

    if (bloque && bloque !== ed) {
      // Si el párrafo se queda vacío, el bloque ocupa su sitio; si no, va detrás
      const vacío = !(bloque.textContent || '').trim();
      if (vacío) bloque.parentNode.replaceChild(pre, bloque);
      else bloque.parentNode.insertBefore(pre, bloque.nextSibling);
    } else {
      ed.appendChild(pre);
    }

    // Se convierte en editor de código y se deja un párrafo detrás
    montaCodigo(pre, ganchosCodigo);
    garantizaSalidaTrasCodigo();

    // Cursor dentro del bloque recién creado, que es donde se va a escribir
    const ta = pre.querySelector('.odi-code-src');
    if (ta) { ta.focus(); ta.selectionStart = ta.selectionEnd = ta.value.length; }
    commitBody();
    refreshActive();
  };

  // ── Enlazar con OTRO NODO del programa (no con una dirección de internet) ──
  // Es lo mismo que hace la barra de formato de las notas: abre el buscador en
  // modo "elegir destino" y él se encarga de envolver la selección.
  const linkToNode = () => {
    const found = selectionInBody();
    if (!found || found.sel.isCollapsed) {
      window.showToast && window.showToast(
        window.t('Selecciona antes el texto que quieres enlazar.', 'Select the text you want to link first.')
      );
      return;
    }
    window.odiStartLinkFromSelection && window.odiStartLinkFromSelection(found.range.cloneRange());
  };

  // Toggle blockquote on/off
  const toggleQuote = () => {
    const sel = window.getSelection();
    let node = sel?.anchorNode;
    while (node && node !== bodyRef.current) {
      if (node.tagName === 'BLOCKQUOTE') { exec('formatBlock', '<p>'); return; }
      node = node.parentNode;
    }
    exec('formatBlock', '<blockquote>');
  };

  // Open the floating link editor next to the current text selection.
  const openLinkMenu = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    // Must be inside the editor
    if (!bodyRef.current || !bodyRef.current.contains(range.commonAncestorContainer)) return;
    savedRangeRef.current = range.cloneRange();
    const rect = range.getBoundingClientRect();
    // Pre-fill if the selection already sits inside an existing link
    let existing = '';
    let node = sel.anchorNode;
    while (node && node !== bodyRef.current) {
      if (node.tagName === 'A') { existing = node.getAttribute('href') || ''; break; }
      node = node.parentNode;
    }
    const top = (rect.bottom || rect.top) + 8;
    const left = rect.left || rect.x || 0;
    setLinkMenu({ top, left, value: existing });
    setTimeout(() => linkInputRef.current?.focus(), 0);
  };

  // Apply (or update) the link on the saved selection, painted with the wine accent via CSS.
  const applyLink = () => {
    const url = (linkMenu?.value || '').trim();
    const sel = window.getSelection();
    if (savedRangeRef.current) { sel.removeAllRanges(); sel.addRange(savedRangeRef.current); }
    if (url) {
      const href = /^(https?:\/\/|mailto:)/i.test(url) ? url : 'https://' + url;
      if (savedRangeRef.current && savedRangeRef.current.collapsed) {
        // No text selected → insert the URL itself as the linked text
        const safe = href.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        document.execCommand('insertHTML', false, `<a href="${safe}">${safe}</a>`);
      } else {
        document.execCommand('createLink', false, href);
      }
    } else if (savedRangeRef.current && !savedRangeRef.current.collapsed) {
      document.execCommand('unlink');
    }
    setLinkMenu(null);
    commitBody();
    bodyRef.current?.focus();
  };

  const removeLink = () => {
    const sel = window.getSelection();
    if (savedRangeRef.current) { sel.removeAllRanges(); sel.addRange(savedRangeRef.current); }
    document.execCommand('unlink');
    setLinkMenu(null);
    commitBody();
    bodyRef.current?.focus();
  };

  // Turn a bare URL ending at the caret into a hyperlink. Returns true if it did.
  const linkifyBeforeCaret = (addSpace) => {
    const sel = window.getSelection();
    if (!sel || !sel.isCollapsed) return false;
    const node = sel.anchorNode;
    if (!node || node.nodeType !== 3) return false; // must be a text node
    // bail out if we're already inside a link, or outside the editor
    let p = node.parentNode;
    while (p && p !== bodyRef.current) { if (p.nodeName === 'A') return false; p = p.parentNode; }
    if (p !== bodyRef.current) return false;
    const offset = sel.anchorOffset;
    const m = node.textContent.slice(0, offset).match(/(https?:\/\/[^\s]+|www\.[^\s]+)$/i);
    if (!m) return false;
    const url = m[0];
    const range = document.createRange();
    range.setStart(node, offset - url.length);
    range.setEnd(node, offset);
    sel.removeAllRanges();
    sel.addRange(range);
    const href = /^https?:\/\//i.test(url) ? url : 'https://' + url;
    document.execCommand('createLink', false, href);
    // drop the caret just after the new link (plus a space if requested) so typing continues outside it
    let aEl = window.getSelection().anchorNode;
    while (aEl && aEl.nodeName !== 'A' && aEl !== bodyRef.current) aEl = aEl.parentNode;
    if (aEl && aEl.nodeName === 'A') {
      const after = document.createTextNode(addSpace ? ' ' : '');
      aEl.parentNode.insertBefore(after, aEl.nextSibling);
      const rng = document.createRange();
      rng.setStart(after, after.length);
      rng.collapse(true);
      const s2 = window.getSelection();
      s2.removeAllRanges();
      s2.addRange(rng);
    }
    commitBody();
    return true;
  };

  // Paste of a single bare URL → insert it as a clickable link automatically.
  const onBodyPaste = (e) => {
    const text = ((e.clipboardData && e.clipboardData.getData('text/plain')) || '').trim();
    if (text && !/\s/.test(text) && /^(https?:\/\/|www\.)\S+$/i.test(text)) {
      e.preventDefault();
      const href = /^https?:\/\//i.test(text) ? text : 'https://' + text;
      const safe = href.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      document.execCommand('insertHTML', false, `<a href="${safe}">${safe}</a>`);
      commitBody();
    }
  };

  const onBodyKey = (e) => {
    // Deshacer/rehacer del documento. Hace falta cortar la propagación además
    // de anular la acción por defecto: si no, el atajo sigue subiendo hasta el
    // lienzo, que deshace el ÚLTIMO cambio del tablero en vez de lo escrito.
    const conCtrl = e.ctrlKey || e.metaKey;
    if (conCtrl && (e.key === 'z' || e.key === 'Z')) {
      e.preventDefault(); e.stopPropagation();
      e.shiftKey ? rehacer() : deshacer();
      return;
    }
    if (conCtrl && (e.key === 'y' || e.key === 'Y')) {
      e.preventDefault(); e.stopPropagation();
      rehacer();
      return;
    }
    if (e.key === 'Escape') { onClose(); return; }
    // Typing a space right after a bare URL auto-links it
    if (e.key === ' ') {
      if (linkifyBeforeCaret(true)) { e.preventDefault(); return; }
    }
    // Backspace at start of empty blockquote exits it
    if (e.key === 'Backspace') {
      const sel = window.getSelection();
      if (sel?.isCollapsed && sel.anchorOffset === 0) {
        let node = sel.anchorNode;
        while (node && node !== bodyRef.current) {
          if (node.tagName === 'BLOCKQUOTE') {
            if ((node.textContent || '').trim() === '') {
              e.preventDefault();
              document.execCommand('formatBlock', false, '<p>');
              commitBody();
            }
            return;
          }
          node = node.parentNode;
        }
      }
    }
    // Enter on empty blockquote line exits it
    if (e.key === 'Enter' && !e.shiftKey) {
      // auto-link a bare URL at the end of the line before the new line is created
      linkifyBeforeCaret(false);
      const sel = window.getSelection();
      let node = sel?.anchorNode;
      while (node && node !== bodyRef.current) {
        if (node.tagName === 'BLOCKQUOTE') {
          if ((node.textContent || '').trim() === '') {
            e.preventDefault();
            document.execCommand('formatBlock', false, '<p>');
            commitBody();
          }
          return;
        }
        node = node.parentNode;
      }
    }
  };

  // Open links on click inside contentEditable
  const onBodyClick = (e) => {
    const a = e.target.closest('a[href]');
    if (a) {
      e.preventDefault();
      window.open(a.href, '_blank', 'noopener,noreferrer');
    }
  };

  const onKey = (e) => {
    if (e.key === 'Escape') onClose();
  };

  return (
    // Sin cerrar al pulsar fuera: el documento ocupa la pantalla entera y esa
    // costumbre cerraba el editor por accidente en cuanto se pulsaba al lado de
    // un desplegable. Se sale con la X o con Esc, que se ven y no sorprenden.
    <div className="doc-modal-backdrop">
      <div className="doc-modal" onMouseDown={(e)=>e.stopPropagation()} onKeyDown={onKey}>
        <div className="doc-modal-head">
          <span className="material-symbols-rounded" style={{color:'var(--wine)'}}>description</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
            <textarea
              ref={titleRef}
              className="doc-title-input"
              placeholder={lang==='es'?'Sin título':'Untitled'}
              onChange={(e) => {
                commitTitle();
                e.target.style.height = 'auto';
                e.target.style.height = e.target.scrollHeight + 'px';
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } }}
              rows={1}
              style={{
                resize: 'none',
                overflowY: 'hidden',
                height: 'auto',
                fontFamily: 'var(--font-display)',
                fontWeight: '800',
                fontSize: '20px',
                flex: 1,
                letterSpacing: '-0.02em',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'inherit',
                padding: '4px 0'
              }}
            />
            <button
              className="icon-btn lift"
              onClick={() => titleRef.current?.select()}
              title={lang==='es' ? 'Editar título' : 'Edit title'}
              style={{
                padding: '6px',
                minWidth: 'auto',
                height: 'auto',
                flexShrink: 0,
                background: '#FFFFFF',
                borderColor: '#E1DFE3',
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '18px', color: '#595459' }}>edit</span>
            </button>
          </div>
          <button className="btn btn-ghost" onClick={onClose}>
            <span className="material-symbols-rounded">close</span>
            {lang==='es'?'Cerrar':'Close'}
          </button>
        </div>
        {/* Barra de herramientas en horizontal y agrupada por categoría. Antes
            era una columna de 31 botones sin nombre: había que ir probando uno
            a uno para dar con el que se buscaba. */}
        <div className="doc-ribbon" onMouseDown={(e)=>e.preventDefault()}>
          <DocGrupo nombre={window.t('Deshacer', 'Undo')}>
            <button onClick={deshacer} title={lang==='es'?'Deshacer (Ctrl+Z)':'Undo (Ctrl+Z)'}>
              <span className="material-symbols-rounded">undo</span>
            </button>
            <button onClick={rehacer} title={lang==='es'?'Rehacer (Ctrl+Y)':'Redo (Ctrl+Y)'}>
              <span className="material-symbols-rounded">redo</span>
            </button>
          </DocGrupo>

          <DocGrupo nombre={window.t('Texto', 'Text')}>
            <button onClick={()=>exec('bold')} className={active.bold ? 'active' : ''} title={lang==='es'?'Negrita (Ctrl+B)':'Bold (Ctrl+B)'}>
              <span className="doc-tool-label">B</span>
            </button>
            <button onClick={()=>exec('italic')} className={active.italic ? 'active' : ''} title={lang==='es'?'Cursiva (Ctrl+I)':'Italic (Ctrl+I)'}>
              <i>I</i>
            </button>
            <button onClick={()=>exec('underline')} className={active.underline ? 'active' : ''} title={lang==='es'?'Subrayado (Ctrl+U)':'Underline (Ctrl+U)'}>
              <span style={{textDecoration:'underline', fontWeight: 700}}>U</span>
            </button>
            <button onClick={()=>exec('strikeThrough')} className={active.strike ? 'active' : ''} title={lang==='es'?'Tachado':'Strikethrough'}>
              <span style={{textDecoration:'line-through', fontWeight: 700}}>S</span>
            </button>
            <button onClick={()=>exec('superscript')} className={active.sup ? 'active' : ''} title={lang==='es'?'Superíndice':'Superscript'}>
              <span className="material-symbols-rounded">superscript</span>
            </button>
            <button onClick={()=>exec('subscript')} className={active.sub ? 'active' : ''} title={lang==='es'?'Subíndice':'Subscript'}>
              <span className="material-symbols-rounded">subscript</span>
            </button>
            <button onClick={()=>exec('removeFormat')} title={lang==='es'?'Limpiar formato':'Clear formatting'}>
              <span className="material-symbols-rounded">format_clear</span>
            </button>
          </DocGrupo>

          <DocGrupo nombre={window.t('Letra', 'Font')}>
            <button
              className={`doc-font-btn ${pop && pop.kind === 'font' ? 'active' : ''}`}
              onClick={(e)=>abrePop('font', e)}
              title={lang==='es'?'Tipo de letra':'Typeface'}
            >
              <span className="material-symbols-rounded">font_download</span>
              <span className="material-symbols-rounded doc-caret">expand_more</span>
            </button>
            <div className="doc-size-ctrl">
              <button onClick={()=>stepFontSize(-1)} title={lang==='es'?'Reducir el tamaño de la letra':'Decrease font size'}>
                <span className="material-symbols-rounded">text_decrease</span>
              </button>
              <button
                className={`doc-size-num ${pop && pop.kind === 'size' ? 'active' : ''}`}
                onClick={(e)=>abrePop('size', e)}
                title={lang==='es'?'Elegir el tamaño de la letra':'Choose font size'}
              >
                {active.size || '—'}
              </button>
              <button onClick={()=>stepFontSize(1)} title={lang==='es'?'Aumentar el tamaño de la letra':'Increase font size'}>
                <span className="material-symbols-rounded">text_increase</span>
              </button>
            </div>
          </DocGrupo>

          <DocGrupo nombre={window.t('Color', 'Colour')}>
            {/* La barra de debajo del icono enseña el último color usado, como
                en Word: de un vistazo se sabe qué va a poner sin abrir nada. */}
            <button
              className={`doc-color-btn ${pop && pop.kind === 'text' ? 'active' : ''}`}
              onClick={(e)=>abrePop('text', e)}
              title={lang==='es'?'Color del texto':'Text colour'}
            >
              <span className="material-symbols-rounded">format_color_text</span>
              <i className="doc-color-bar" style={{ background: ultimoColor.text }}/>
            </button>
            <button
              className={`doc-color-btn ${pop && pop.kind === 'mark' ? 'active' : ''}`}
              onClick={(e)=>abrePop('mark', e)}
              title={lang==='es'?'Resaltar':'Highlight'}
            >
              <span className="material-symbols-rounded">format_ink_highlighter</span>
              <i
                className="doc-color-bar"
                style={ultimoColor.mark === 'transparent'
                  ? { background: 'repeating-linear-gradient(45deg, var(--line-soft) 0 3px, transparent 3px 6px)' }
                  : { background: ultimoColor.mark }}
              />
            </button>
          </DocGrupo>

          <DocGrupo nombre={window.t('Estilo', 'Style')}>
            <button onClick={()=>exec('formatBlock', '<h1>')} className={active.h1 ? 'active' : ''} title={lang==='es'?'Título 1':'Heading 1'}>
              <span style={{fontFamily:'var(--font-display)', fontWeight: 800, fontSize: 14}}>H1</span>
            </button>
            <button onClick={()=>exec('formatBlock', '<h2>')} className={active.h2 ? 'active' : ''} title={lang==='es'?'Título 2':'Heading 2'}>
              <span style={{fontFamily:'var(--font-display)', fontWeight: 700, fontSize: 12.5}}>H2</span>
            </button>
            <button onClick={()=>exec('formatBlock', '<h3>')} className={active.h3 ? 'active' : ''} title={lang==='es'?'Título 3':'Heading 3'}>
              <span style={{fontFamily:'var(--font-display)', fontWeight: 700, fontSize: 11.5}}>H3</span>
            </button>
            <button onClick={()=>exec('formatBlock', '<p>')} className={active.p ? 'active' : ''} title={lang==='es'?'Texto normal':'Paragraph'}>
              <span className="material-symbols-rounded">notes</span>
            </button>
            <button onClick={toggleQuote} className={active.quote ? 'active' : ''} title={lang==='es'?'Cita':'Quote'}>
              <span className="material-symbols-rounded">format_quote</span>
            </button>
          </DocGrupo>

          <DocGrupo nombre={window.t('Párrafo', 'Paragraph')}>
            <button onClick={()=>exec('insertUnorderedList')} className={active.ul ? 'active' : ''} title={lang==='es'?'Lista con viñetas':'Bulleted list'}>
              <span className="material-symbols-rounded">format_list_bulleted</span>
            </button>
            <button onClick={()=>exec('insertOrderedList')} className={active.ol ? 'active' : ''} title={lang==='es'?'Lista numerada':'Numbered list'}>
              <span className="material-symbols-rounded">format_list_numbered</span>
            </button>
            <button onClick={()=>exec('justifyLeft')} className={!active.alignC && !active.alignR && !active.alignJ ? 'active' : ''} title={lang==='es'?'Alinear a la izquierda':'Align left'}>
              <span className="material-symbols-rounded">format_align_left</span>
            </button>
            <button onClick={()=>exec('justifyCenter')} className={active.alignC ? 'active' : ''} title={lang==='es'?'Centrar':'Align centre'}>
              <span className="material-symbols-rounded">format_align_center</span>
            </button>
            <button onClick={()=>exec('justifyRight')} className={active.alignR ? 'active' : ''} title={lang==='es'?'Alinear a la derecha':'Align right'}>
              <span className="material-symbols-rounded">format_align_right</span>
            </button>
            <button onClick={()=>exec('justifyFull')} className={active.alignJ ? 'active' : ''} title={lang==='es'?'Justificar':'Justify'}>
              <span className="material-symbols-rounded">format_align_justify</span>
            </button>
            <button onClick={()=>stepIndent(1)} title={lang==='es'?'Aumentar sangría':'Increase indent'}>
              <span className="material-symbols-rounded">format_indent_increase</span>
            </button>
            <button onClick={()=>stepIndent(-1)} title={lang==='es'?'Reducir sangría':'Decrease indent'}>
              <span className="material-symbols-rounded">format_indent_decrease</span>
            </button>
            <button
              onClick={(e)=>abrePop('lh', e)}
              className={pop && pop.kind === 'lh' ? 'active' : ''}
              title={lang==='es'?'Interlineado':'Line spacing'}
            >
              <span className="material-symbols-rounded">format_line_spacing</span>
            </button>
          </DocGrupo>

          <DocGrupo nombre={window.t('Insertar', 'Insert')}>
            <button onClick={insertCode} title={lang==='es'?'Código':'Code'}>
              <span className="material-symbols-rounded">code</span>
            </button>
            {/* Elegir el lenguaje del bloque donde está el cursor. Solo se puede
                usar dentro de un bloque: fuera no habría a qué aplicarlo. */}
            <button
              onClick={(e)=>abrePop('lang', e)}
              disabled={!active.enCodigo}
              className={pop && pop.kind === 'lang' ? 'active' : ''}
              title={active.enCodigo
                ? (lang==='es'?'Lenguaje del bloque de código':'Code block language')
                : (lang==='es'?'Pon el cursor dentro de un bloque de código':'Put the caret inside a code block')}
            >
              <span className="material-symbols-rounded">manage_search</span>
            </button>
            <button onClick={()=>exec('insertHorizontalRule')} title={lang==='es'?'Línea separadora':'Horizontal rule'}>
              <span className="material-symbols-rounded">horizontal_rule</span>
            </button>
            <button
              onClick={openLinkMenu}
              disabled={!active.hasSel}
              className={linkMenu ? 'active' : ''}
              title={active.hasSel ? (lang==='es'?'Enlace a una dirección de internet':'Link to a web address') : (lang==='es'?'Selecciona texto primero':'Select text first')}
            >
              <span className="material-symbols-rounded">link</span>
            </button>
            {/* Enlazar con otro nodo: es lo que alimenta los backlinks y la
                vista de conexiones, así que el documento lo necesita igual que
                las notas. */}
            <button
              onClick={linkToNode}
              disabled={!active.hasSel}
              title={active.hasSel
                ? (lang==='es'?'Enlazar la selección con otro nodo':'Link selection to another node')
                : (lang==='es'?'Selecciona texto primero':'Select text first')}
            >
              <span className="material-symbols-rounded">add_link</span>
            </button>
          </DocGrupo>
        </div>

        <div className="doc-modal-body">
          <div className="doc-modal-pane-wrap">
            {/* Pulsar el hueco de debajo del texto lleva el cursor al final del
                documento. Antes solo enfocaba, y si lo último era un bloque de
                código el cursor acababa dentro de él: querías escribir texto
                normal y seguías escribiendo código. */}
            <div className="doc-modal-editor-pane" onClick={(e) => { if (e.target === e.currentTarget) vaAlFinal(); }}>
              <div
                ref={bodyRef}
                className="doc-modal-content"
                contentEditable
                suppressContentEditableWarning
                spellCheck={true}
                onInput={(e)=>{ garantizaSalidaTrasCodigo(); commitBody(); refreshActive(); }}
                onKeyUp={refreshActive}
                onMouseUp={refreshActive}
                onKeyDown={onBodyKey}
                onPaste={onBodyPaste}
                onClick={onBodyClick}
              />
            </div>
            {/* Barra de estado, como la de Word */}
            <div className="doc-status">
              <span>{active.words || 0} {window.t(active.words === 1 ? 'palabra' : 'palabras', active.words === 1 ? 'word' : 'words')}</span>
              <span className="doc-status-sep">·</span>
              <span>{active.chars || 0} {window.t('caracteres', 'characters')}</span>
              {active.size && (
                <>
                  <span className="doc-status-sep">·</span>
                  <span>{active.size} px</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Desplegables de la barra (tamaño, color, resaltado) */}
      {pop && ReactDOM.createPortal(
        <>
          <div className="doc-link-overlay" onMouseDown={(e)=>{ e.preventDefault(); setPop(null); }}/>
          <div
            className="doc-tool-pop"
            style={{ position:'fixed', top: pop.top, left: pop.left }}
            onMouseDown={(e)=>{ e.preventDefault(); e.stopPropagation(); }}
          >
            {pop.kind === 'size' ? (
              <div className="doc-size-list">
                {DOC_FONT_SIZES.map(s => (
                  <button
                    key={s}
                    className={active.size === s ? 'active' : ''}
                    onClick={()=>{ applyFontSize(s); setPop(null); }}
                  >{s}</button>
                ))}
              </div>
            ) : pop.kind === 'font' ? (
              <div className="doc-menu-list">
                {DOC_FONTS.map(f => (
                  <button
                    key={f.n}
                    style={{ fontFamily: f.v || 'var(--font-body, inherit)' }}
                    onClick={()=>{ applyFontFamily(f.v); setPop(null); }}
                  >
                    {f.v ? f.n : (lang==='es' ? 'Del programa' : 'App default')}
                  </button>
                ))}
              </div>
            ) : pop.kind === 'lh' ? (
              <div className="doc-menu-list">
                {DOC_LINE_HEIGHTS.map(lh => (
                  <button key={lh} onClick={()=>{ applyLineHeight(lh); setPop(null); }}>
                    {lh.toFixed(2).replace(/\.?0+$/, '')}
                  </button>
                ))}
              </div>
            ) : pop.kind === 'lang' ? (
              <div className="doc-menu-list">
                {DOC_LANGS.map(l => (
                  <button
                    key={l.id}
                    className={active.langCodigo === l.id ? 'active' : ''}
                    onClick={()=>{ cambiaIdiomaCodigo(l.id); setPop(null); }}
                  >
                    {lang === 'es' ? l.n : (l.en || l.n)}
                  </button>
                ))}
              </div>
            ) : (
              <>
                <div className="doc-pop-title">
                  {pop.kind === 'text'
                    ? (lang==='es'?'Color del texto':'Text color')
                    : (lang==='es'?'Resaltar':'Highlight')}
                </div>
                <div className="doc-color-grid">
                  {(pop.kind === 'text' ? DOC_TEXT_COLORS : DOC_MARK_COLORS).map(c => (
                    <button
                      key={c}
                      className="doc-color-swatch"
                      style={{
                        background: c === 'transparent' ? 'var(--paper)' : c,
                        borderColor: c === '#FFFFFF' || c === 'transparent' ? 'var(--line-soft)' : 'var(--line)',
                      }}
                      title={c === 'transparent' ? (lang==='es'?'Sin resaltado':'No highlight') : c}
                      onClick={()=>{
                        applyColor(pop.kind === 'text' ? 'foreColor' : 'hiliteColor', c);
                        setPop(null);
                      }}
                    >
                      {c === 'transparent' && (
                        <span className="material-symbols-rounded" style={{fontSize:13}}>format_color_reset</span>
                      )}
                    </button>
                  ))}
                </div>
                {/* Cualquier color, no solo los de la paleta. Los de arriba son
                    los que se usan a diario; esto es para el resto. Se aplica al
                    soltar el selector, no mientras se arrastra, para no llenar
                    el historial de deshacer con un color por cada píxel movido. */}
                <div className="doc-color-libre">
                  <input
                    type="color"
                    defaultValue={pop.kind === 'text' ? '#1A1A1A' : '#FFF3A3'}
                    title={window.t('Elegir cualquier color', 'Pick any colour')}
                    onChange={(e)=>{ colorLibreRef.current = e.target.value; }}
                  />
                  <button className="doc-color-ok" onClick={aplicaColorLibre}>
                    {window.t('Usar este color', 'Use this colour')}
                  </button>
                </div>
              </>
            )}
          </div>
        </>,
        document.body
      )}

      {/* Floating link editor — appears right next to the selected text */}
      {linkMenu && ReactDOM.createPortal(
        <>
          <div className="doc-link-overlay" onMouseDown={(e)=>{ e.preventDefault(); setLinkMenu(null); }}/>
          <div
            className="doc-link-pop"
            style={{ position:'fixed', top: linkMenu.top, left: linkMenu.left }}
            onMouseDown={(e)=>e.stopPropagation()}
          >
            <span className="material-symbols-rounded" style={{fontSize:18, color:'var(--olive)'}}>link</span>
            <input
              ref={linkInputRef}
              className="doc-link-input"
              placeholder={lang==='es'?'Pega o escribe el enlace…':'Paste or type the link…'}
              value={linkMenu.value}
              onChange={(e)=>setLinkMenu(m => ({ ...m, value: e.target.value }))}
              onKeyDown={(e)=>{
                if (e.key === 'Enter') { e.preventDefault(); applyLink(); }
                if (e.key === 'Escape') { e.preventDefault(); setLinkMenu(null); bodyRef.current?.focus(); }
              }}
            />
            {linkMenu.value && (
              <button className="doc-link-rm" title={lang==='es'?'Quitar enlace':'Remove link'} onClick={removeLink}>
                <span className="material-symbols-rounded" style={{fontSize:17}}>link_off</span>
              </button>
            )}
            <button className="doc-link-ok" onClick={applyLink}>{lang==='es'?'Aplicar':'Apply'}</button>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

window.DocModal = DocModal;
