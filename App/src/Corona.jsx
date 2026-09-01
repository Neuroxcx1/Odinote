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

// ── "Doné y no veo mi corona" ──
//
// En Ko-fi se paga con el correo de PayPal o de la tarjeta, y muy a menudo no
// es el de Google: un Hotmail de toda la vida, un Yahoo del instituto. Esa
// persona ha pagado, no ve nada, y el programa no puede adivinarlo solo.
//
// Aquí lo demuestra con dos datos que solo tiene ella: con qué correo pagó y
// cuánto. Va plegado porque a quien no le hace falta no debe estorbarle, y
// quien lo necesita lo busca.
window.PanelReclamo = function PanelReclamo({ onConcedida }) {
  const { useState } = React;
  const [abierto, setAbierto] = useState(false);
  const [correo, setCorreo] = useState('');
  const [importe, setImporte] = useState('');
  const [esperando, setEsperando] = useState(false);
  const [aviso, setAviso] = useState(null);

  // Un mensaje por cada motivo. El del servidor no distingue entre "no existe"
  // y "el importe no cuadra" a propósito —decirlo sería una forma de averiguar
  // quién ha donado—, así que aquí se explica lo que la persona puede hacer.
  const MENSAJES = {
    'ya-reclamado': window.t(
      'Esa donación ya está vinculada a otra cuenta.',
      'That donation is already linked to another account.'),
    'es-el-mismo': window.t(
      'Ese es el correo con el que ya has entrado. Si hubiera una donación a su nombre, ya tendrías la corona.',
      'That is the email you signed in with. If there were a donation under it, you would already have the crown.'),
    'sin-sesion': window.t(
      'Hay que iniciar sesión con Google para poder vincularla.',
      'You need to sign in with Google to link it.'),
    'correo-invalido': window.t('Ese correo no parece un correo.', 'That does not look like an email.'),
    'importe-invalido': window.t(
      'Escribe cuánto donaste, por ejemplo 5 o 3.50.',
      'Enter how much you donated, for example 5 or 3.50.'),
    'no-cuadra': window.t(
      'No encontramos una donación con ese correo y ese importe. Revisa los dos. Si acabas de pagar, espera un minuto y vuelve a intentarlo.',
      'We could not find a donation with that email and amount. Check both. If you just paid, wait a minute and try again.'),
    'demasiadas': window.t(
      'Demasiados intentos seguidos. Espera un minuto.',
      'Too many attempts in a row. Wait a minute.'),
    'sin-conexion': window.t('Sin conexión.', 'No connection.'),
    'error': window.t('Algo falló. Inténtalo más tarde.', 'Something went wrong. Try again later.'),
  };

  const enviar = () => {
    if (esperando) return;
    setEsperando(true);
    setAviso(null);
    window.Patrocinio.reclama(correo, importe).then((r) => {
      setEsperando(false);
      if (r.ok) {
        setAviso({ bien: true, texto: window.t('¡Listo! Tu corona ya está activa.', 'Done! Your crown is active.') });
        onConcedida && onConcedida();
        return;
      }
      setAviso({ bien: false, texto: MENSAJES[r.motivo] || MENSAJES.error });
    });
  };

  if (!abierto) {
    return (
      <button
        onClick={() => { setAbierto(true); window.playAudioTone && window.playAudioTone('click'); }}
        style={{
          background: 'none', border: 'none', padding: '2px 0', cursor: 'pointer',
          fontSize: '12px', color: 'var(--ink-3, #595459)', textDecoration: 'underline',
          textAlign: 'left', alignSelf: 'flex-start',
        }}
      >
        {window.t('¿Donaste y no ves tu corona?', 'Donated and cannot see your crown?')}
      </button>
    );
  }

  const campo = {
    padding: '9px 10px', borderRadius: '6px', fontSize: '13px', width: '100%',
    border: '1.5px solid var(--line-soft, #E5E1DD)', background: 'var(--paper, #FFF)',
    color: 'var(--ink, #1A1A1A)',
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: '9px', padding: '12px',
      borderRadius: '8px', border: '1.5px solid var(--line-soft, #E5E1DD)',
      background: 'rgba(224, 168, 46, 0.07)',
    }}>
      <div style={{ fontSize: '12.5px', color: 'var(--ink-3, #595459)', lineHeight: 1.45 }}>
        {window.t(
          'Si pagaste con un correo distinto al de tu Google, dinos cuál y cuánto donaste. Es la forma de comprobar que esa donación es tuya.',
          'If you paid with an email other than your Google one, tell us which and how much you donated. That is how we check the donation is yours.')}
      </div>

      <input
        type="email"
        value={correo}
        onChange={(e) => setCorreo(e.target.value)}
        placeholder={window.t('Correo con el que pagaste', 'Email you paid with')}
        style={campo}
      />
      <input
        type="text"
        inputMode="decimal"
        value={importe}
        onChange={(e) => setImporte(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') enviar(); }}
        placeholder={window.t('Cuánto donaste (por ejemplo 5)', 'How much you donated (e.g. 5)')}
        style={campo}
      />

      {aviso && (
        <div style={{
          fontSize: '12.5px', lineHeight: 1.45, padding: '8px 10px', borderRadius: '6px',
          color: 'var(--ink, #1A1A1A)',
          background: aviso.bien ? 'rgba(144, 185, 104, 0.16)' : 'rgba(230, 84, 79, 0.10)',
          border: '1.5px solid ' + (aviso.bien ? 'var(--brand-green, #90B968)' : 'var(--wine, #E6544F)'),
        }}>
          {aviso.texto}
        </div>
      )}

      <button
        className="btn lift"
        onClick={enviar}
        disabled={esperando}
        style={{
          padding: '9px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer',
          background: 'var(--olive, #6A8546)', color: '#FFF', fontWeight: 700, fontSize: '13px',
          opacity: esperando ? 0.6 : 1,
        }}
      >
        {esperando ? window.t('Comprobando…', 'Checking…') : window.t('Vincular mi donación', 'Link my donation')}
      </button>
    </div>
  );
};
