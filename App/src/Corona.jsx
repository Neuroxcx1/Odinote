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

window.Corona = function Corona({ size = 16, className = '', title, insignia = false, apagada = false }) {
  // Como insignia va pegada a la esquina de otro botón (posición absoluta);
  // suelta se comporta como un elemento normal y la coloca quien la use.
  const clases = ['corona-dibujo', insignia ? 'corona-patrocinador' : '', className]
    .filter(Boolean).join(' ');
  const texto = title || window.t('Patrocinador de Odinote', 'Odinote supporter');
  // Dos degradados con nombres distintos: si compartieran id, el primero que
  // se pintara mandaria sobre el otro y la corona apagada saldria dorada.
  const idTinta = apagada ? 'odi-corona-gris' : 'odi-corona-oro';
  const tintas = apagada
    ? { alto: '#B9B4B0', medio: '#8E8A8E', bajo: '#6E6A6E', borde: '#4A474A', piedra: '#E6E3E0' }
    : { alto: '#F6D65C', medio: '#E0A82E', bajo: '#C1841B', borde: '#7A5310', piedra: '#FFF3C4' };

  return (
    <span className={clases} title={texto} aria-label={texto} style={{ width: size, height: size }}>
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none" aria-hidden="true">
        <defs>
          <linearGradient id={idTinta} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={tintas.alto} />
            <stop offset="55%" stopColor={tintas.medio} />
            <stop offset="100%" stopColor={tintas.bajo} />
          </linearGradient>
        </defs>
        {/* Cuerpo: los tres picos y la base, de una sola pieza para que el
            borde la recorra entera y no se vean costuras entre partes. */}
        <path
          d="M3 8.5 L7 12.5 L12 4.5 L17 12.5 L21 8.5 L19.4 18.5 L4.6 18.5 Z"
          fill={'url(#' + idTinta + ')'}
          stroke={tintas.borde}
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        {/* Las tres piedras. Puntos, no círculos con borde: a este tamaño un
            borde las convierte en manchas. */}
        <circle cx="7" cy="12.2" r="1.15" fill={tintas.piedra} />
        <circle cx="12" cy="9.3" r="1.15" fill={tintas.piedra} />
        <circle cx="17" cy="12.2" r="1.15" fill={tintas.piedra} />
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
//
// Abre la ventana en los dos estados, y esto es lo importante: con la corona
// encendida antes solo sacaba un aviso de agradecimiento y ahí se acababa. Un
// botón que da las gracias y no hace nada más está roto — se pulsa una vez, se
// lee el mensaje y no se vuelve a tocar, así que quien había pagado no llegaba
// nunca al sitio donde se cambia el cursor, que es justo lo que había pagado.
// Las gracias siguen estando, dentro de la ventana, que es donde no estorban.
window.CoronaBoton = function CoronaBoton({ activo = false, onAbrir, size = 19 }) {
  const cosmeticos = window.t(
    'Tus cosméticos de patrocinador: elige tu cursor',
    'Your supporter cosmetics: choose your cursor'
  );
  const invita = window.t(
    'Apoya Odinote y consigue la corona y el cursor dorado',
    'Support Odinote and get the crown and the golden cursor'
  );
  const texto = activo ? cosmeticos : invita;

  return (
    <button
      className={'icon-btn lift corona-btn' + (activo ? '' : ' apagada')}
      title={texto}
      aria-label={texto}
      onClick={() => {
        window.playAudioTone && window.playAudioTone('click');
        // Encendida lleva al taller —el cursor— y apagada a lo que se consigue
        // y al panel para reclamar una donación ya hecha. Es la misma ventana:
        // ella sabe cuál de las dos caras toca enseñar.
        onAbrir && onAbrir();
      }}
    >
      <window.Corona size={size} title={texto} apagada={!activo} />
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
    // Este mensaje salía antes como 'hay que iniciar sesión' a alguien que
    // estaba viendo 'Conectado mediante Google' dos centímetros más arriba, lo
    // cual es de locos. No es que no haya entrado: es que la sesión ante
    // Firebase, que es otra cosa, se ha perdido. Ahora se dice lo que pasa y
    // qué hacer.
    'sin-sesion': window.t(
      'Odinote no consigue identificarte ante Google en este momento. Cierra sesión aquí abajo, vuelve a entrar y prueba otra vez.',
      'Odinote cannot verify your Google identity right now. Sign out below, sign back in and try again.'),
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
          display: 'flex', alignItems: 'center', gap: '7px',
          background: 'rgba(224, 168, 46, 0.10)', cursor: 'pointer',
          border: '1.5px solid rgba(224, 168, 46, 0.55)', borderRadius: '8px',
          padding: '9px 12px', fontSize: '12.5px', fontWeight: 600,
          color: 'var(--ink, #1A1A1A)', textAlign: 'left', width: '100%',
        }}
      >
        <window.Corona size={15} apagada title="" />
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

// ── La ventana de la corona ──
//
// Tiene la suya y no comparte la del perfil, que es donde estaba antes. No es
// una manía de orden: en la del perfil, la corona era un párrafo más entre el
// correo y el botón de cerrar sesión, y lo que se compra con una donación es
// precisamente que se note.
//
// Quien no tiene corona ve lo que se consigue y por dónde. Quien la tiene ve el
// taller: aquí se cambia el cursor, que es lo que de verdad hace que el programa
// se parezca un poco a ti.
window.VentanaCorona = function VentanaCorona({ esPatrocinador, onCerrar, onConcedida }) {
  const { useState, useEffect, useRef } = React;
  const C = window.CursorOdinote;

  const [cfg, setCfg] = useState(() => (C && C.lee()) || { modo: 'color', color: '#E0A82E', imagen: null });
  const [aviso, setAviso] = useState(null);

  // Se va aplicando mientras se toca, no al guardar. Un cursor no se puede
  // elegir a ciegas: hay que verlo moverse para saber si estorba.
  useEffect(() => {
    if (!C || !esPatrocinador) return;
    C.aplica(cfg);
  }, [cfg, esPatrocinador]);

  // Y al cerrar manda lo que hay guardado, no lo que se estuvo probando. Sin
  // esto, quien paseaba por la rueda de color y cerraba sin guardar se quedaba
  // con el último tono que rozó el ratón hasta reiniciar la aplicación, sin
  // haber dicho que sí en ningún momento.
  const esPatro = useRef(esPatrocinador);
  esPatro.current = esPatrocinador;
  useEffect(() => () => {
    if (!C) return;
    C.aplica(esPatro.current ? C.lee() : null);
  }, []);

  const guardar = () => {
    C && C.guarda(cfg);
    setAviso(window.t('Guardado.', 'Saved.'));
    setTimeout(() => setAviso(null), 2200);
  };

  const restablecer = () => {
    const limpio = { modo: 'color', color: '#E0A82E', imagen: null };
    setCfg(limpio);
    C && C.guarda(null);
    C && C.aplica(null);
    setAviso(window.t('Cursor de siempre restablecido.', 'Default cursor restored.'));
    setTimeout(() => setAviso(null), 2200);
  };

  const subirImagen = (e) => {
    const archivo = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!archivo || !C) return;
    C.preparaImagen(archivo)
      .then(img => setCfg({ ...cfg, modo: 'imagen', imagen: img }))
      .catch(() => setAviso(window.t(
        'Ese archivo no se pudo usar. Prueba con un PNG o un JPG.',
        'That file could not be used. Try a PNG or a JPG.')));
  };

  const pestana = (activa) => ({
    flex: 1, padding: '8px 10px', borderRadius: '7px', fontSize: '12.5px', fontWeight: 600,
    cursor: 'pointer', border: '1.5px solid ' + (activa ? 'var(--olive, #6A8546)' : 'var(--line-soft, #E5E1DD)'),
    background: activa ? 'rgba(106, 133, 70, 0.12)' : 'transparent',
    color: 'var(--ink, #1A1A1A)',
  });

  const urlPrueba = C && C.urlDe(cfg);
  const cursorDePrueba = urlPrueba
    ? 'url("' + urlPrueba + '") ' + (cfg.modo === 'imagen' ? '20 20' : '4 4') + ', auto'
    : 'auto';

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onCerrar(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9000, display: 'grid', placeItems: 'center',
        background: 'rgba(0,0,0,0.45)', padding: '20px',
      }}
    >
      <div
        style={{
          width: 'min(420px, 100%)', maxHeight: '86vh', overflowY: 'auto',
          background: 'var(--bg-card, #FFF)', color: 'var(--ink, #1A1A1A)',
          border: '1.5px solid var(--line, #595459)', borderRadius: '14px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.35)', padding: '20px',
          display: 'flex', flexDirection: 'column', gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <window.Corona size={30} apagada={!esPatrocinador} title="" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '16px', lineHeight: 1.2 }}>
              {esPatrocinador
                ? window.t('Tus cosméticos', 'Your cosmetics')
                : window.t('Apoya Odinote', 'Support Odinote')}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--ink-3, #595459)', marginTop: '2px' }}>
              {esPatrocinador
                ? window.t('Gracias por invitar a un café.', 'Thanks for the coffee.')
                : window.t('Un café, y el programa se parece un poco más a ti.', 'One coffee, and the app looks a little more like you.')}
            </div>
          </div>
          <button
            className="icon-btn"
            onClick={onCerrar}
            title={window.t('Cerrar', 'Close')}
            style={{ width: '32px', height: '32px', flexShrink: 0 }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>

        {esPatrocinador ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontWeight: 600, fontSize: '13px' }}>
                {window.t('Tu cursor', 'Your cursor')}
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button style={pestana(cfg.modo === 'color')} onClick={() => setCfg({ ...cfg, modo: 'color' })}>
                  {window.t('Un color', 'A colour')}
                </button>
                <button style={pestana(cfg.modo === 'imagen')} onClick={() => setCfg({ ...cfg, modo: 'imagen' })}>
                  {window.t('Una imagen', 'An image')}
                </button>
              </div>

              {cfg.modo === 'color' ? (
                <window.SelectorColor
                  valor={cfg.color || '#E0A82E'}
                  colores={window.COLORES_ODINOTE_CURSOR}
                  onCambio={(c) => setCfg({ ...cfg, color: c })}
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label
                    className="btn lift"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                      padding: '10px', borderRadius: '8px', cursor: 'pointer', fontSize: '12.5px',
                      border: '1.5px dashed var(--line-soft, #E5E1DD)', fontWeight: 600,
                    }}
                  >
                    <span className="material-symbols-rounded" style={{ fontSize: 18 }}>add_photo_alternate</span>
                    {cfg.imagen ? window.t('Cambiar la imagen', 'Change the image') : window.t('Elegir una imagen', 'Choose an image')}
                    <input type="file" accept="image/*" onChange={subirImagen} style={{ display: 'none' }} />
                  </label>
                  <div style={{ fontSize: '11px', color: 'var(--ink-3, #595459)', lineHeight: 1.4 }}>
                    {window.t(
                      'Se recorta a 40 píxeles. Los navegadores ignoran los cursores más grandes, así que no se puede hacer otra cosa.',
                      'It is cropped to 40 pixels. Browsers ignore larger cursors, so there is no way around it.')}
                  </div>
                </div>
              )}

              {/* La prueba. Sin un sitio donde moverlo no hay forma de saber si
                  el cursor elegido estorba o se pierde sobre el fondo. */}
              <div
                style={{
                  border: '1.5px dashed var(--line-soft, #E5E1DD)', borderRadius: '9px',
                  padding: '20px 12px', textAlign: 'center', fontSize: '12px',
                  color: 'var(--ink-3, #595459)', cursor: cursorDePrueba,
                }}
              >
                {window.t('Mueve el ratón por aquí para probarlo', 'Move the mouse here to try it')}
              </div>
            </div>

            {aviso && (
              <div style={{
                fontSize: '12.5px', padding: '8px 10px', borderRadius: '7px',
                background: 'rgba(144, 185, 104, 0.16)',
                border: '1.5px solid var(--brand-green, #90B968)',
              }}>{aviso}</div>
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn lift"
                onClick={guardar}
                style={{
                  flex: 1, padding: '10px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                  background: 'var(--olive, #6A8546)', color: '#FFF', fontWeight: 700, fontSize: '13px',
                }}
              >
                {window.t('Guardar', 'Save')}
              </button>
              <button
                className="btn lift"
                onClick={restablecer}
                style={{
                  padding: '10px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12.5px',
                  border: '1.5px solid var(--line-soft, #E5E1DD)', background: 'transparent',
                  color: 'var(--ink-3, #595459)',
                }}
              >
                {window.t('El de siempre', 'Default one')}
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{
              display: 'flex', flexDirection: 'column', gap: '9px',
              padding: '14px', borderRadius: '10px',
              background: 'rgba(224, 168, 46, 0.08)',
              border: '1.5px solid rgba(224, 168, 46, 0.45)',
            }}>
              {[
                window.t('La corona dorada, en tu barra.', 'The gold crown, in your toolbar.'),
                window.t('El cursor en el color que elijas.', 'The cursor in the colour you choose.'),
                window.t('O con una imagen tuya.', 'Or with an image of your own.'),
              ].map((t, i) => (
                <div key={i} style={{ display: 'flex', gap: '9px', alignItems: 'flex-start', fontSize: '13px' }}>
                  <span className="material-symbols-rounded" style={{ fontSize: 17, color: '#C9962A' }}>check</span>
                  <span>{t}</span>
                </div>
              ))}
              <div style={{ fontSize: '11.5px', color: 'var(--ink-3, #595459)', lineHeight: 1.45, marginTop: '2px' }}>
                {window.t(
                  'Nada de Odinote está detrás de esto: la aplicación entera es gratis y lo seguirá siendo. Esto son adornos.',
                  'None of Odinote is behind this: the whole app is free and will stay that way. These are ornaments.')}
              </div>
            </div>

            <button
              className="btn lift"
              onClick={() => window.open('https://ko-fi.com/neuroxcx', '_blank', 'noopener,noreferrer')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                padding: '11px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                background: 'var(--wine, #7B2D26)', color: '#FFF', fontWeight: 700, fontSize: '13px',
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: 18 }}>coffee</span>
              {window.t('Invitar a un café', 'Buy a coffee')}
            </button>

            <window.PanelReclamo onConcedida={onConcedida} />
          </>
        )}
      </div>
    </div>
  );
};
