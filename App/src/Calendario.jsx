// =====================================================
// Oddinote — el nodo de calendario
//
// Rehecho en la 1.0.9, en dos pasos pedidos por el usuario. Primero "más
// parecido a Notion o a como lo hacen Apple o Google, pero manteniendo las
// imágenes": el mes como título, rejilla fina, hoy en un círculo verde. Después
// "investiga todo lo que tiene Google y pónselo", empezando por poder darle una
// hora a cada cosa. Así que ahora tiene lo de Google Calendar que tiene sentido
// en un calendario que vive en un lienzo y no en una cuenta:
//  · Vistas de día, semana, mes, año y agenda, con "Hoy" y las flechas.
//  · Eventos de día entero o con hora de inicio y de fin, de uno o varios días.
//  · Repetir: cada día, cada día laborable, cada semana (qué días), cada mes (el
//    mismo día o "el cuarto jueves"), cada año, o cada N, hasta un día o N veces.
//  · Avisos antes de que empiece, con el aviso del sistema (ver app.jsx).
//  · Color, lugar y notas en cada evento; tareas que se marcan como hechas.
//  · Arrastrar un evento a otro día o a otra hora, y estirarlo para alargarlo.
//  · La línea roja de la hora actual, números de semana, semana que empieza en
//    lunes, domingo o sábado, ocultar fines de semana, reloj de 12 o 24 horas.
//  · Exportar e importar .ics (en ContextSidebar), que es como se pasan los
//    calendarios entre Google, Outlook y Apple.
// Se queda fuera lo que necesita cuentas o internet: invitados, Meet, zonas
// horarias, festivos y varios calendarios con su color.
//
// Y sigue lo que ya había: la foto de cada día, el color de cada día, el día
// elegido en rojo, el verde de hoy que se puede quitar y los tamaños de letra.
//
// Las fechas se cuentan en calendario-logica.js (window.CalLogica), sin React,
// para poder probarlas: ver scripts/test-calendario-logica.js.
// =====================================================

const CalL = window.CalLogica;
const CAL_VISTAS = ['dia', 'semana', 'mes', 'anio', 'agenda'];
// Los colores que se ofrecen de primeras, cuatro como en el resto de la
// aplicación (el selector añade el arcoíris y los últimos usados): para el
// fondo de un día, y para un evento.
const CAL_COLORES_DIA = ['#F7DA84', '#90B968', '#E6544F', '#3D5A80'];
const CAL_COLORES_EVENTO = ['#E6544F', '#F7DA84', '#90B968', '#3D5A80'];
// Los minutos de antes que se ofrecen para avisar, como en Google.
const CAL_AVISOS = [0, 5, 10, 15, 30, 60, 120, 1440, 2880, 10080];

// Los nombres de los días y de los meses los pone el propio navegador en el
// idioma de la aplicación. Antes estaban escritos a mano en español e inglés, y
// en los otros nueve idiomas el calendario salía en inglés.
function calNombreDia(lang, f, forma) {
  try { return f.toLocaleDateString(lang, { weekday: forma || 'short' }).replace(/\.$/, ''); }
  catch (e) { return ['D', 'L', 'M', 'X', 'J', 'V', 'S'][f.getDay()]; }
}
function calNombreMes(lang, m, forma) {
  try { return new Date(2024, m, 1).toLocaleDateString(lang, { month: forma || 'long' }).replace(/\.$/, ''); }
  catch (e) { return String(m + 1); }
}
function calFecha(lang, f, opciones) {
  try { return f.toLocaleDateString(lang, opciones); } catch (e) { return f.toDateString(); }
}
const calFechaCorta = (lang, f) => calFecha(lang, f, { weekday: 'short', day: 'numeric', month: 'short' });
// Para los campos de fecha del editor: "2026-09-24".
const calIsoDe = (f) => f.getFullYear() + '-' + String(f.getMonth() + 1).padStart(2, '0') + '-' + String(f.getDate()).padStart(2, '0');
const calDeIso = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };

// Un color de evento: los nombres de siempre ('red', 'blue'…) o uno libre.
function calColorDe(ev) {
  if (ev && typeof ev.color === 'string' && ev.color.charAt(0) === '#') return ev.color;
  return CATEGORY_HEX[ev && ev.color] || CATEGORY_HEX.blue;
}
// Una tarea que se repite guarda sus días hechos aparte; una suelta, en "hecho".
const calHecha = (ev, clave) => !!ev.tarea && (ev.repite ? (ev.hechos || []).includes(clave) : !!ev.hecho);

// La foto de un día viaja dentro del proyecto (en su json, en la bóveda y en
// Drive), así que se encoge al ponerla, igual que la portada de un proyecto:
// una casilla del calendario no pasa de unos cientos de píxeles, y una foto del
// móvil de varios megas pesaría en todas partes. Si algo falla al encogerla, se
// guarda tal cual, como se hacía antes.
function calFotoDelDia(file) {
  return new Promise((resolve) => {
    const tal = () => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => resolve(null);
      r.readAsDataURL(file);
    };
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const k = Math.min(1, 800 / img.naturalWidth, 800 / img.naturalHeight);
        const w = Math.max(1, Math.round(img.naturalWidth * k));
        const h = Math.max(1, Math.round(img.naturalHeight * k));
        const lienzo = document.createElement('canvas');
        lienzo.width = w; lienzo.height = h;
        lienzo.getContext('2d').drawImage(img, 0, 0, w, h);
        let datos = lienzo.toDataURL('image/webp', 0.85);
        if (!/^data:image\/webp/.test(datos)) datos = lienzo.toDataURL('image/jpeg', 0.86);
        resolve(datos);
      } catch (e) { tal(); }
      finally { URL.revokeObjectURL(url); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); tal(); };
    img.src = url;
  });
}

// El texto de un aviso: "10 minutos antes", "1 día antes"…
function calTextoAviso(min) {
  if (!min) return window.t('Cuando empiece', 'At start time');
  if (min % 10080 === 0) { const n = min / 10080; return n === 1 ? window.t('1 semana antes', '1 week before') : window.t(`${n} semanas antes`, `${n} weeks before`); }
  if (min % 1440 === 0) { const n = min / 1440; return n === 1 ? window.t('1 día antes', '1 day before') : window.t(`${n} días antes`, `${n} days before`); }
  if (min % 60 === 0) { const n = min / 60; return n === 1 ? window.t('1 hora antes', '1 hour before') : window.t(`${n} horas antes`, `${n} hours before`); }
  return window.t(`${min} minutos antes`, `${min} minutes before`);
}

// ── El editor de un evento ──
// Un panel al lado de la barra, como los demás de la aplicación, y no dentro
// del nodo: el nodo puede ser pequeño o estar lejos con el zoom, y el editor
// necesita su sitio. Guarda según se escribe, como Google, sin botón de
// guardar: un campo que solo guarda al salir pierde lo escrito si el panel se
// cierra de otra forma.
function CalEditor({ item, lang, onUpdate, editor, setEditor, onCerrar }) {
  const eventos = item.events || {};
  const lista = Array.isArray(eventos[editor.origen]) ? eventos[editor.origen] : [];
  const ev = lista.find(e => e.id === editor.id);
  const [borrando, setBorrando] = React.useState(false);
  const [aMedida, setAMedida] = React.useState(false);
  const en24 = item.formato24 !== false;
  if (!ev) return null;
  const inicio = CalL.deClave(editor.origen);
  const ocurrencia = editor.ocurrencia || editor.origen;
  const diaEntero = CalL.esDeDiaEntero(ev);

  const cambia = (patch) => {
    const next = { ...eventos };
    next[editor.origen] = lista.map(e => e.id === ev.id ? { ...e, ...patch } : e);
    onUpdate({ events: next });
  };
  // Cambiar el día de inicio mueve el evento a la casilla de ese día, y el
  // último día (si dura varios) se corre lo mismo.
  const mueveA = (f) => {
    const nueva = CalL.claveDe(f);
    if (nueva === editor.origen) return;
    const delta = CalL.diasEntre(inicio, f);
    const movido = { ...ev };
    if (ev.fin) movido.fin = CalL.claveDe(CalL.sumaDias(CalL.deClave(ev.fin), delta));
    if (ev.repite && ev.repite.hasta && CalL.deClave(ev.repite.hasta) < f) movido.repite = { ...ev.repite, hasta: undefined };
    const next = { ...eventos };
    next[editor.origen] = lista.filter(e => e.id !== ev.id);
    if (!next[editor.origen].length) delete next[editor.origen];
    next[nueva] = [...(Array.isArray(next[nueva]) ? next[nueva] : []), movido];
    onUpdate({ events: next });
    setEditor({ ...editor, origen: nueva, ocurrencia: nueva });
  };
  const quita = (modo) => {
    const next = { ...eventos };
    if (modo === 'este' && ev.repite) {
      next[editor.origen] = lista.map(e => e.id === ev.id ? { ...e, excepciones: [...(e.excepciones || []), ocurrencia] } : e);
    } else if (modo === 'siguientes' && ev.repite && ocurrencia !== editor.origen) {
      const hasta = CalL.claveDe(CalL.sumaDias(CalL.deClave(ocurrencia), -1));
      next[editor.origen] = lista.map(e => e.id === ev.id ? { ...e, repite: { ...e.repite, hasta, veces: undefined } } : e);
    } else {
      next[editor.origen] = lista.filter(e => e.id !== ev.id);
      if (!next[editor.origen].length) delete next[editor.origen];
    }
    onUpdate({ events: next });
    onCerrar(true);
  };
  const duplica = () => {
    const copia = { ...ev, id: `ev-${Date.now()}-${Math.floor(Math.random() * 9999)}` };
    const next = { ...eventos, [editor.origen]: [...lista, copia] };
    onUpdate({ events: next });
    setEditor({ ...editor, id: copia.id, nuevo: false });
  };

  // ── La repetición, en el menú de Google ──
  const ds = CalL.diaSemana(inicio);
  const enesimo = Math.ceil(inicio.getDate() / 7);
  const nombreDs = calNombreDia(lang, inicio, 'long');
  const ordinales = [window.t('primer', 'first'), window.t('segundo', 'second'), window.t('tercer', 'third'), window.t('cuarto', 'fourth'), window.t('quinto', 'fifth')];
  const r = ev.repite;
  const clase = !r ? 'no'
    : aMedida ? 'medida'
    : r.unidad === 'dia' && (r.cada || 1) === 1 && !r.veces && !r.hasta ? 'dia'
    : r.unidad === 'semana' && (r.cada || 1) === 1 && !r.veces && !r.hasta && Array.isArray(r.dias) && r.dias.join() === '0,1,2,3,4' ? 'laborables'
    : r.unidad === 'semana' && (r.cada || 1) === 1 && !r.veces && !r.hasta && (!r.dias || r.dias.join() === String(ds)) ? 'semana'
    : r.unidad === 'mes' && (r.cada || 1) === 1 && !r.veces && !r.hasta && r.modo === 'diaSemana' ? 'mesDiaSemana'
    : r.unidad === 'mes' && (r.cada || 1) === 1 && !r.veces && !r.hasta && !r.modo ? 'mes'
    : r.unidad === 'anio' && (r.cada || 1) === 1 && !r.veces && !r.hasta ? 'anio'
    : 'medida';
  const eligeRepeticion = (v) => {
    setAMedida(v === 'medida');
    if (v === 'no') cambia({ repite: undefined, excepciones: undefined });
    else if (v === 'dia') cambia({ repite: { unidad: 'dia', cada: 1 } });
    else if (v === 'laborables') cambia({ repite: { unidad: 'semana', cada: 1, dias: [0, 1, 2, 3, 4] } });
    else if (v === 'semana') cambia({ repite: { unidad: 'semana', cada: 1, dias: [ds] } });
    else if (v === 'mes') cambia({ repite: { unidad: 'mes', cada: 1 } });
    else if (v === 'mesDiaSemana') cambia({ repite: { unidad: 'mes', cada: 1, modo: 'diaSemana' } });
    else if (v === 'anio') cambia({ repite: { unidad: 'anio', cada: 1 } });
    else if (v === 'medida' && !r) cambia({ repite: { unidad: 'semana', cada: 1, dias: [ds] } });
  };
  const cambiaRepite = (patch) => cambia({ repite: { ...(r || { unidad: 'semana', cada: 1 }), ...patch } });
  const inicialesDias = Array.from({ length: 7 }, (_, i) => calNombreDia(lang, new Date(2024, 0, 1 + i), 'narrow'));

  const cambiaHoraInicio = (h) => {
    // Como en Google: mover el inicio arrastra el final y la duración se queda.
    const antes = CalL.minutosDe(ev.hora), fin = CalL.minutosDe(ev.horaFin);
    const ahora = CalL.minutosDe(h);
    if (ahora == null) return;
    const dur = antes != null && fin != null ? Math.max(15, fin - antes) : (item.duracion || 60);
    cambia({ hora: h, horaFin: CalL.horaDe(Math.min(24 * 60 - 1, ahora + dur)) });
  };
  const pideAvisos = () => {
    // En la web el navegador pregunta antes de dejar avisar; mejor en el
    // momento en que alguien pide un aviso que al abrir la aplicación.
    try { if (window.Notification && Notification.permission === 'default') Notification.requestPermission(); } catch (e) {}
  };

  return ReactDOM.createPortal((
    <>
      <div className="cal-editor-fondo" onMouseDown={(e) => { e.stopPropagation(); onCerrar(); }}/>
      <div className="cal-editor" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') onCerrar(); }}>
        <div className="cal-editor-cab">
          <button className="cal-editor-icono" onClick={() => onCerrar()} title={window.t('Cerrar', 'Close')}>
            <span className="material-symbols-rounded">arrow_back</span>
          </button>
          <div className="cal-editor-tipos">
            <button className={!ev.tarea ? 'active' : ''} onClick={() => cambia({ tarea: undefined, hecho: undefined })}>{window.t('Evento', 'Event')}</button>
            <button className={ev.tarea ? 'active' : ''} onClick={() => cambia({ tarea: true })}>{window.t('Tarea', 'Task')}</button>
          </div>
        </div>

        <input
          className="cal-editor-titulo"
          autoFocus
          value={ev.text || ''}
          placeholder={window.t('Añade un título', 'Add title')}
          onChange={(e) => cambia({ text: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onCerrar(); } }}
        />

        {ev.tarea && (
          <label className="cal-editor-fila cal-editor-check">
            <input type="checkbox" checked={calHecha(ev, ocurrencia)} onChange={() => {
              if (ev.repite) {
                const hechos = new Set(ev.hechos || []);
                hechos.has(ocurrencia) ? hechos.delete(ocurrencia) : hechos.add(ocurrencia);
                cambia({ hechos: [...hechos] });
              } else cambia({ hecho: !ev.hecho });
            }}/>
            <span>{window.t('Hecha', 'Done')}</span>
          </label>
        )}

        <div className="cal-editor-bloque">
          <span className="material-symbols-rounded">schedule</span>
          <div className="cal-editor-col">
            <div className="cal-editor-fila">
              <input type="date" className="cal-editor-campo" value={calIsoDe(inicio)} onChange={(e) => { const f = calDeIso(e.target.value); if (f) mueveA(f); }}/>
              {!diaEntero && (
                <>
                  <input type="time" className="cal-editor-campo" value={ev.hora || ''} onChange={(e) => cambiaHoraInicio(e.target.value)}/>
                  {!ev.tarea && <span className="cal-editor-guion">–</span>}
                  {!ev.tarea && <input type="time" className="cal-editor-campo" value={ev.horaFin || ''} onChange={(e) => cambia({ horaFin: e.target.value })}/>}
                </>
              )}
            </div>
            {!ev.tarea && (
              <div className="cal-editor-fila">
                <span className="cal-editor-etiqueta">{window.t('Hasta el', 'Until')}</span>
                <input
                  type="date" className="cal-editor-campo"
                  min={calIsoDe(inicio)}
                  value={calIsoDe(ev.fin ? CalL.deClave(ev.fin) : inicio)}
                  onChange={(e) => {
                    const f = calDeIso(e.target.value);
                    if (!f) return;
                    cambia({ fin: f > inicio ? CalL.claveDe(f) : undefined });
                  }}
                />
              </div>
            )}
            <label className="cal-editor-fila cal-editor-check">
              <input type="checkbox" checked={diaEntero} onChange={() => {
                if (diaEntero) {
                  const h = CalL.horaDe(9 * 60);
                  cambia({ hora: h, horaFin: CalL.horaDe(9 * 60 + (item.duracion || 60)), avisos: ev.avisos || [10] });
                } else cambia({ hora: undefined, horaFin: undefined });
              }}/>
              <span>{window.t('Todo el día', 'All day')}</span>
            </label>
          </div>
        </div>

        <div className="cal-editor-bloque">
          <span className="material-symbols-rounded">repeat</span>
          <div className="cal-editor-col">
            <select className="cal-editor-campo" value={clase} onChange={(e) => eligeRepeticion(e.target.value)}>
              <option value="no">{window.t('No se repite', 'Does not repeat')}</option>
              <option value="dia">{window.t('Cada día', 'Daily')}</option>
              <option value="laborables">{window.t('Todos los días laborables (lunes a viernes)', 'Every weekday (Monday to Friday)')}</option>
              <option value="semana">{window.t(`Cada semana el ${nombreDs}`, `Weekly on ${nombreDs}`)}</option>
              <option value="mes">{window.t(`Cada mes el día ${inicio.getDate()}`, `Monthly on day ${inicio.getDate()}`)}</option>
              {enesimo <= 5 && <option value="mesDiaSemana">{window.t(`Cada mes el ${ordinales[enesimo - 1]} ${nombreDs}`, `Monthly on the ${ordinales[enesimo - 1]} ${nombreDs}`)}</option>}
              <option value="anio">{window.t(`Cada año el ${calFecha(lang, inicio, { day: 'numeric', month: 'long' })}`, `Annually on ${calFecha(lang, inicio, { day: 'numeric', month: 'long' })}`)}</option>
              <option value="medida">{window.t('Personalizado…', 'Custom…')}</option>
            </select>
            {clase === 'medida' && r && (
              <>
                <div className="cal-editor-fila">
                  <span className="cal-editor-etiqueta">{window.t('Cada', 'Every')}</span>
                  <input type="number" min="1" max="99" className="cal-editor-campo cal-editor-num" value={r.cada || 1}
                    onChange={(e) => cambiaRepite({ cada: Math.max(1, Math.min(99, parseInt(e.target.value, 10) || 1)) })}/>
                  <select className="cal-editor-campo" value={r.unidad} onChange={(e) => cambiaRepite({ unidad: e.target.value, dias: e.target.value === 'semana' ? [ds] : undefined, modo: undefined })}>
                    <option value="dia">{window.t('días', 'days')}</option>
                    <option value="semana">{window.t('semanas', 'weeks')}</option>
                    <option value="mes">{window.t('meses', 'months')}</option>
                    <option value="anio">{window.t('años', 'years')}</option>
                  </select>
                </div>
                {r.unidad === 'semana' && (
                  <div className="cal-editor-dias">
                    {inicialesDias.map((n, i) => {
                      const dias = Array.isArray(r.dias) && r.dias.length ? r.dias : [ds];
                      const activo = dias.includes(i);
                      return (
                        <button key={i} className={activo ? 'active' : ''} onClick={() => {
                          const otros = activo ? dias.filter(d => d !== i) : [...dias, i];
                          cambiaRepite({ dias: otros.length ? otros.sort((a, b) => a - b) : [i] });
                        }}>{n}</button>
                      );
                    })}
                  </div>
                )}
                <div className="cal-editor-fila">
                  <span className="cal-editor-etiqueta">{window.t('Termina', 'Ends')}</span>
                  <select className="cal-editor-campo" value={r.veces ? 'veces' : r.hasta ? 'hasta' : 'nunca'}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === 'nunca') cambiaRepite({ veces: undefined, hasta: undefined });
                      else if (v === 'veces') cambiaRepite({ veces: 10, hasta: undefined });
                      else cambiaRepite({ veces: undefined, hasta: CalL.claveDe(CalL.sumaDias(inicio, 90)) });
                    }}>
                    <option value="nunca">{window.t('Nunca', 'Never')}</option>
                    <option value="hasta">{window.t('El día…', 'On…')}</option>
                    <option value="veces">{window.t('Tras…', 'After…')}</option>
                  </select>
                  {r.hasta && !r.veces && (
                    <input type="date" className="cal-editor-campo" min={calIsoDe(inicio)} value={calIsoDe(CalL.deClave(r.hasta))}
                      onChange={(e) => { const f = calDeIso(e.target.value); if (f) cambiaRepite({ hasta: CalL.claveDe(f) }); }}/>
                  )}
                  {r.veces && (
                    <>
                      <input type="number" min="1" max="730" className="cal-editor-campo cal-editor-num" value={r.veces}
                        onChange={(e) => cambiaRepite({ veces: Math.max(1, Math.min(730, parseInt(e.target.value, 10) || 1)) })}/>
                      <span className="cal-editor-etiqueta">{window.t('veces', 'times')}</span>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="cal-editor-bloque">
          <span className="material-symbols-rounded">notifications</span>
          <div className="cal-editor-col">
            {(ev.avisos || []).map((a, i) => (
              <div key={i} className="cal-editor-fila">
                <select className="cal-editor-campo" value={a} onChange={(e) => {
                  const avisos = [...ev.avisos]; avisos[i] = Number(e.target.value); cambia({ avisos });
                }}>
                  {(CAL_AVISOS.includes(a) ? CAL_AVISOS : [...CAL_AVISOS, a].sort((x, y) => x - y)).map(m => <option key={m} value={m}>{calTextoAviso(m)}</option>)}
                </select>
                <button className="cal-editor-icono" onClick={() => cambia({ avisos: ev.avisos.filter((_, j) => j !== i) })} title={window.t('Quitar el aviso', 'Remove reminder')}>
                  <span className="material-symbols-rounded">close</span>
                </button>
              </div>
            ))}
            {(ev.avisos || []).length < 5 && (
              <button className="cal-editor-mas" onClick={() => { pideAvisos(); cambia({ avisos: [...(ev.avisos || []), diaEntero ? 1440 : 10] }); }}>
                {window.t('Añadir un aviso', 'Add reminder')}
              </button>
            )}
          </div>
        </div>

        <div className="cal-editor-bloque">
          <span className="material-symbols-rounded">palette</span>
          <div className="cal-editor-col">
            {window.SelectorColor && (
              <window.SelectorColor
                valor={calColorDe(ev)}
                onCambio={(c) => cambia({ color: c })}
                colores={CAL_COLORES_EVENTO}
                tam={22}
              />
            )}
          </div>
        </div>

        <div className="cal-editor-bloque">
          <span className="material-symbols-rounded">location_on</span>
          <input className="cal-editor-campo cal-editor-ancho" value={ev.lugar || ''} placeholder={window.t('Añade un lugar', 'Add location')}
            onChange={(e) => cambia({ lugar: e.target.value || undefined })}/>
        </div>
        <div className="cal-editor-bloque">
          <span className="material-symbols-rounded">notes</span>
          <textarea className="cal-editor-campo cal-editor-ancho cal-editor-notas" value={ev.notas || ''} placeholder={window.t('Añade una descripción', 'Add description')}
            onChange={(e) => cambia({ notas: e.target.value || undefined })}/>
        </div>

        {borrando && ev.repite ? (
          <div className="cal-editor-borrar">
            <div className="cal-editor-etiqueta">{window.t('Borrar un evento que se repite', 'Delete recurring event')}</div>
            <button className="cal-editor-boton" onClick={() => quita('este')}>{window.t('Solo este', 'This event')}</button>
            {ocurrencia !== editor.origen && <button className="cal-editor-boton" onClick={() => quita('siguientes')}>{window.t('Este y los siguientes', 'This and following events')}</button>}
            <button className="cal-editor-boton peligro" onClick={() => quita('todos')}>{window.t('Todos', 'All events')}</button>
            <button className="cal-editor-boton" onClick={() => setBorrando(false)}>{window.t('Cancelar', 'Cancel')}</button>
          </div>
        ) : (
          <div className="cal-editor-pie">
            <button className="cal-editor-boton" onClick={duplica}>
              <span className="material-symbols-rounded">content_copy</span>{window.t('Duplicar', 'Duplicate')}
            </button>
            <button className="cal-editor-boton peligro" onClick={() => (ev.repite ? setBorrando(true) : quita('todos'))}>
              <span className="material-symbols-rounded">delete</span>{window.t('Eliminar', 'Delete')}
            </button>
          </div>
        )}
      </div>
    </>
  ), document.body);
}

function CalendarItem({ item, lang, onUpdate, editing }) {
  const hoy = new Date();
  const [ahora, setAhora] = React.useState(() => new Date());
  const [ancla, setAncla] = React.useState(() => new Date(
    item.year || hoy.getFullYear(), item.month != null ? item.month : hoy.getMonth(),
    item.year || item.month != null ? 1 : hoy.getDate()));
  const vista = CAL_VISTAS.includes(item.vista) ? item.vista : 'mes';
  const [dayMenu, setDayMenu] = React.useState(null); // { key }
  const [editor, setEditor] = React.useState(null);   // { origen, id, ocurrencia, nuevo }
  const [selector, setSelector] = React.useState(null); // el año que enseña el selector, o null
  const [menuVista, setMenuVista] = React.useState(false);
  const [verMas, setVerMas] = React.useState(null);     // el día cuya lista entera está abierta
  const [sitioLista, setSitioLista] = React.useState(null);
  const [arrastre, setArrastre] = React.useState(null); // { id, destino } en el mes; { id, clave, desde, hasta } en las horas
  const [caben, setCaben] = React.useState(3);
  const fileRef = React.useRef(null);
  const pendingImgKey = React.useRef(null);
  const rejillaRef = React.useRef(null);
  const horasRef = React.useRef(null);
  const cuerpoHorasRef = React.useRef(null);
  const selectorRef = React.useRef(null);
  const vistaRef = React.useRef(null);
  const listaRef = React.useRef(null);
  const tarjetaRef = React.useRef(null);
  // La foto se encoge con calma y llega después: para entonces el nodo puede
  // tener otras fotos nuevas, y hay que sumarla a las de ESE momento. Lo mismo
  // al soltar un arrastre: se aplica sobre los eventos de ese momento.
  const itemRef = React.useRef(item);
  itemRef.current = item;
  // Al soltar un arrastre, el clic que viene detrás cae en el hueco donde se
  // soltó, y crearía un evento nuevo ahí. Esto lo deja pasar de largo.
  const recienArrastrado = React.useRef(0);
  const bg = window.nodeBg(item);
  const quieto = (e) => e.stopPropagation();

  const events = item.events || {};
  const images = item.images || {};
  const dayColors = item.dayColors || {};
  const primerDia = item.primerDia == null ? 1 : item.primerDia;
  const conFinde = item.finesDeSemana !== false;
  const conSemanas = item.numSemana === true;
  const en24 = item.formato24 !== false;
  const claveDeHoy = CalL.claveDe(hoy);
  // Marcar hoy en verde está bien casi siempre, pero en un calendario que se
  // usa para planear otro mes es una mancha que no dice nada. Se puede quitar.
  const claveHoy = item.hoyMarcado === false ? null : claveDeHoy;
  const selectedKey = item.selectedDay != null
    ? CalL.clave(
        item.selectedYear != null ? item.selectedYear : ancla.getFullYear(),
        item.selectedMonth != null ? item.selectedMonth : ancla.getMonth(),
        item.selectedDay)
    : null;
  const esFinde = (f) => f.getDay() === 0 || f.getDay() === 6;

  // El editor y el menú de un día esconden la barra del nodo, que si no se
  // quedaría encima.
  const avisaBarra = (abierto) => {
    window._calendarDayMenuOpen = abierto;
    window._notifyFocusedRowChanged?.();
  };
  const openDayMenu = (menuData) => { setDayMenu(menuData); avisaBarra(!!menuData || !!editor); };
  const abreEditor = (o, nuevo) => {
    setDayMenu(null);
    setEditor({ origen: o.origen, id: o.ev.id, ocurrencia: o.clave || o.origen, nuevo: !!nuevo });
    avisaBarra(true);
  };
  const cierraEditor = (yaBorrado) => {
    // Uno nuevo que se cierra sin título no se queda: es un clic sin querer.
    if (!yaBorrado && editor && editor.nuevo) {
      const lista = itemRef.current.events && itemRef.current.events[editor.origen];
      const ev = Array.isArray(lista) && lista.find(e => e.id === editor.id);
      if (ev && !String(ev.text || '').trim()) {
        const next = { ...itemRef.current.events };
        next[editor.origen] = lista.filter(e => e.id !== editor.id);
        if (!next[editor.origen].length) delete next[editor.origen];
        onUpdate({ events: next });
      }
    }
    setEditor(null);
    avisaBarra(false);
  };
  const nuevoEvento = (clave, extra) => {
    const lista = Array.isArray(events[clave]) ? events[clave] : [];
    const ev = {
      id: `ev-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
      text: '',
      color: CATEGORY_COLORS[lista.length % CATEGORY_COLORS.length],
      ...(extra || {}),
    };
    onUpdate({ events: { ...events, [clave]: [...lista, ev] } });
    abreEditor({ origen: clave, ev, clave }, true);
  };
  React.useEffect(() => () => { if (window._calendarDayMenuOpen) avisaBarra(false); }, []);

  // ── Lo que se ve ──
  let desdeVista, hastaVista, diasVista = [], semanas = [];
  if (vista === 'mes') {
    const primero = new Date(ancla.getFullYear(), ancla.getMonth(), 1);
    const ultimo = new Date(ancla.getFullYear(), ancla.getMonth() + 1, 0);
    desdeVista = CalL.inicioSemana(primero, primerDia);
    const n = Math.ceil((CalL.diasEntre(desdeVista, ultimo) + 1) / 7);
    for (let s = 0; s < n; s++) {
      const dias = [];
      for (let d = 0; d < 7; d++) {
        const f = CalL.sumaDias(desdeVista, s * 7 + d);
        if (conFinde || !esFinde(f)) dias.push(f);
      }
      semanas.push({ dias, lunes: CalL.sumaDias(desdeVista, s * 7) });
    }
    hastaVista = CalL.sumaDias(desdeVista, n * 7 - 1);
  } else if (vista === 'semana') {
    desdeVista = CalL.inicioSemana(ancla, primerDia);
    hastaVista = CalL.sumaDias(desdeVista, 6);
    for (let d = 0; d < 7; d++) { const f = CalL.sumaDias(desdeVista, d); if (conFinde || !esFinde(f)) diasVista.push(f); }
  } else if (vista === 'dia') {
    desdeVista = new Date(ancla.getFullYear(), ancla.getMonth(), ancla.getDate());
    hastaVista = desdeVista;
    diasVista = [desdeVista];
  } else if (vista === 'anio') {
    desdeVista = new Date(ancla.getFullYear(), 0, 1);
    hastaVista = new Date(ancla.getFullYear(), 11, 31);
  } else {
    desdeVista = new Date(ancla.getFullYear(), ancla.getMonth(), ancla.getDate());
    hastaVista = CalL.sumaDias(desdeVista, 59);
  }
  const ocus = React.useMemo(
    () => CalL.eventosEnRango(events, desdeVista, hastaVista),
    [item.events, desdeVista.getTime(), hastaVista.getTime()]);
  const delDia = (f) => CalL.delDia(ocus, f);
  const columnas = vista === 'mes' ? (conFinde ? 7 : 5) : diasVista.length;

  // La hora actual se refresca cada minuto, solo si hay una línea que moverla.
  React.useEffect(() => {
    if (vista !== 'semana' && vista !== 'dia') return;
    const t = setInterval(() => setAhora(new Date()), 60000);
    return () => clearInterval(t);
  }, [vista]);

  // Cuántos eventos caben en una casilla del mes, medido: depende del alto del
  // nodo y del tamaño de la letra. Lo que no cabe se resume en "+N más".
  React.useEffect(() => {
    const el = rejillaRef.current;
    if (!el || vista !== 'mes') return;
    const mide = () => {
      const fs = parseFloat(getComputedStyle(el).fontSize) || 12;
      const alto = el.clientHeight / Math.max(1, semanas.length);
      setCaben(Math.max(1, Math.floor((alto - fs * 2.3) / (fs * 1.62 + 2))));
    };
    mide();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(mide);
    ro.observe(el);
    return () => ro.disconnect();
  }, [semanas.length, item.textScale, vista]);

  // En las vistas de horas se abre con la mañana a la vista, como Google, y no
  // con la madrugada.
  React.useEffect(() => {
    const c = cuerpoHorasRef.current, h = horasRef.current;
    if (!c || !h) return;
    const hora = vista === 'dia' && CalL.claveDe(ancla) === claveDeHoy ? Math.max(0, hoy.getHours() - 1) : 7.5;
    c.scrollTop = h.offsetHeight / 24 * hora;
  }, [vista]);

  // El selector de mes, el menú de vistas y la lista de un día se cierran al
  // tocar fuera o con Escape (que entonces no llega al lienzo: ahí soltaría el
  // nodo).
  React.useEffect(() => {
    if (selector == null && verMas == null && !menuVista) return;
    const fuera = (e) => {
      if (selector != null && selectorRef.current && !selectorRef.current.contains(e.target)) setSelector(null);
      if (menuVista && vistaRef.current && !vistaRef.current.contains(e.target)) setMenuVista(false);
      if (verMas != null && listaRef.current && !listaRef.current.contains(e.target)) setVerMas(null);
    };
    const escape = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setSelector(null); setVerMas(null); setMenuVista(false);
    };
    document.addEventListener('mousedown', fuera, true);
    document.addEventListener('keydown', escape, true);
    return () => {
      document.removeEventListener('mousedown', fuera, true);
      document.removeEventListener('keydown', escape, true);
    };
  }, [selector, verMas, menuVista]);

  // ── Moverse ──
  const mueve = (d) => {
    if (vista === 'mes') setAncla(a => new Date(a.getFullYear(), a.getMonth() + d, 1));
    else if (vista === 'semana') setAncla(a => CalL.sumaDias(a, 7 * d));
    else if (vista === 'dia') setAncla(a => CalL.sumaDias(a, d));
    else if (vista === 'anio') setAncla(a => new Date(a.getFullYear() + d, 0, 1));
    else setAncla(a => CalL.sumaDias(a, 30 * d));
  };
  const aHoy = () => setAncla(new Date());
  const ponVista = (v, f) => {
    if (f) setAncla(f);
    if (v !== vista) onUpdate({ vista: v });
    setMenuVista(false);
  };
  const nombresVista = {
    dia: window.t('Día', 'Day'), semana: window.t('Semana', 'Week'), mes: window.t('Mes', 'Month'),
    anio: window.t('Año', 'Year'), agenda: window.t('Agenda', 'Schedule'),
  };

  // El título de arriba, según la vista.
  let titulo;
  if (vista === 'mes' || vista === 'agenda') titulo = <><span className="cal-mb-mes">{calNombreMes(lang, ancla.getMonth())}</span><span className="cal-mb-anio">{ancla.getFullYear()}</span></>;
  else if (vista === 'anio') titulo = <span className="cal-mb-mes">{ancla.getFullYear()}</span>;
  else if (vista === 'dia') titulo = <><span className="cal-mb-mes">{calFecha(lang, ancla, { weekday: 'long', day: 'numeric', month: 'long' })}</span><span className="cal-mb-anio">{ancla.getFullYear()}</span></>;
  else {
    const a = desdeVista, b = hastaVista;
    const mismoMes = a.getMonth() === b.getMonth();
    titulo = <><span className="cal-mb-mes">{mismoMes
      ? `${a.getDate()} – ${b.getDate()} ${calNombreMes(lang, a.getMonth())}`
      : `${a.getDate()} ${calNombreMes(lang, a.getMonth(), 'short')} – ${b.getDate()} ${calNombreMes(lang, b.getMonth(), 'short')}`}</span>
      <span className="cal-mb-anio">{b.getFullYear()}</span></>;
  }

  // ── Mover un evento ──
  // Uno que se repite no se lleva la serie entera al arrastrarlo: se mueve solo
  // esa vez (queda una excepción en la serie y un evento suelto en el sitio
  // nuevo), que es lo que uno espera al arrastrar un día concreto.
  const mueveEvento = (o, destino, patch) => {
    const actuales = itemRef.current.events || {};
    const lista = Array.isArray(actuales[o.origen]) ? actuales[o.origen] : [];
    const ev = lista.find(e => e.id === o.ev.id);
    if (!ev) return;
    const next = { ...actuales };
    const dFin = ev.fin ? CalL.diasEntre(o.inicio, CalL.deClave(ev.fin)) - CalL.diasEntre(CalL.deClave(o.origen), o.inicio) : 0;
    const finNuevo = ev.fin ? CalL.claveDe(CalL.sumaDias(CalL.deClave(destino), CalL.diasEntre(CalL.deClave(o.origen), CalL.deClave(ev.fin)))) : undefined;
    if (ev.repite) {
      next[o.origen] = lista.map(e => e.id === ev.id ? { ...e, excepciones: [...(e.excepciones || []), o.clave] } : e);
      const suelto = { ...ev, ...(patch || {}), id: `ev-${Date.now()}-${Math.floor(Math.random() * 9999)}`, repite: undefined, excepciones: undefined, hechos: undefined };
      if (ev.fin) suelto.fin = CalL.claveDe(CalL.sumaDias(CalL.deClave(destino), Math.max(0, dFin)));
      next[destino] = [...(Array.isArray(next[destino]) ? next[destino] : []), suelto];
    } else {
      const movido = { ...ev, ...(patch || {}) };
      if (ev.fin) movido.fin = finNuevo;
      if (destino === o.origen) next[o.origen] = lista.map(e => e.id === ev.id ? movido : e);
      else {
        next[o.origen] = lista.filter(e => e.id !== ev.id);
        if (!next[o.origen].length) delete next[o.origen];
        next[destino] = [...(Array.isArray(next[destino]) ? next[destino] : []), movido];
      }
    }
    onUpdate({ events: next });
  };
  const alternaHecha = (o) => {
    const actuales = itemRef.current.events || {};
    const lista = actuales[o.origen] || [];
    const next = { ...actuales, [o.origen]: lista.map(e => {
      if (e.id !== o.ev.id) return e;
      if (e.repite) {
        const hechos = new Set(e.hechos || []);
        hechos.has(o.clave) ? hechos.delete(o.clave) : hechos.add(o.clave);
        return { ...e, hechos: [...hechos] };
      }
      return { ...e, hecho: !e.hecho };
    }) };
    onUpdate({ events: next });
  };
  // Clic derecho sobre un evento lo borra, como siempre. Si se repite, solo ese
  // día.
  const borraRapido = (o) => {
    const actuales = itemRef.current.events || {};
    const lista = actuales[o.origen] || [];
    const next = { ...actuales };
    if (o.ev.repite) next[o.origen] = lista.map(e => e.id === o.ev.id ? { ...e, excepciones: [...(e.excepciones || []), o.clave] } : e);
    else {
      next[o.origen] = lista.filter(e => e.id !== o.ev.id);
      if (!next[o.origen].length) delete next[o.origen];
    }
    onUpdate({ events: next });
  };

  // Arrastrar en el mes: se suelta sobre otra casilla. Un clic sin moverse abre
  // el editor.
  const arrastraEnMes = (e, o) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const x0 = e.clientX, y0 = e.clientY;
    let moviendo = false, destino = null;
    const mueveRaton = (m) => {
      if (!moviendo && Math.hypot(m.clientX - x0, m.clientY - y0) < 5) return;
      moviendo = true;
      const el = document.elementFromPoint(m.clientX, m.clientY);
      const celda = el && el.closest && el.closest('[data-dia]');
      destino = celda && tarjetaRef.current && tarjetaRef.current.contains(celda) ? celda.dataset.dia : null;
      setArrastre({ id: o.ev.id, clave: o.clave, destino });
    };
    const suelta = () => {
      document.removeEventListener('pointermove', mueveRaton);
      document.removeEventListener('pointerup', suelta);
      setArrastre(null);
      if (!moviendo) { abreEditor(o); return; }
      recienArrastrado.current = Date.now();
      if (destino && destino !== o.clave) {
        // El evento se mueve lo mismo que se ha movido la vez arrastrada.
        const delta = CalL.diasEntre(o.inicio, CalL.deClave(destino));
        const nuevoOrigen = o.ev.repite ? destino : CalL.claveDe(CalL.sumaDias(CalL.deClave(o.origen), delta));
        mueveEvento(o, nuevoOrigen);
        window.playAudioTone && window.playAudioTone('drop');
      }
    };
    document.addEventListener('pointermove', mueveRaton);
    document.addEventListener('pointerup', suelta);
  };

  // Arrastrar en las horas: mover (arriba/abajo cambia la hora, a los lados el
  // día) o estirar por el borde de abajo. Todo en cuartos de hora. Las medidas
  // salen de la rejilla en pantalla, que ya trae el zoom del lienzo.
  const arrastraEnHoras = (e, o, modo) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const rej = horasRef.current;
    if (!rej) return;
    const pxMin = rej.getBoundingClientRect().height / 1440;
    const ini0 = CalL.minutosDe(o.ev.hora) || 0;
    const fin0 = Math.max(ini0 + 15, CalL.minutosDe(o.ev.horaFin) || ini0 + (item.duracion || 60));
    const y0 = e.clientY, x0 = e.clientX;
    let moviendo = false, estado = null;
    const mueveRaton = (m) => {
      if (!moviendo && Math.hypot(m.clientX - x0, m.clientY - y0) < 4) return;
      moviendo = true;
      const dMin = Math.round((m.clientY - y0) / pxMin / 15) * 15;
      let desde = ini0, hasta = fin0, clave = o.clave;
      if (modo === 'estirar') hasta = Math.max(ini0 + 15, Math.min(1440, fin0 + dMin));
      else {
        desde = Math.max(0, Math.min(1440 - (fin0 - ini0), ini0 + dMin));
        hasta = desde + (fin0 - ini0);
        const el = document.elementFromPoint(m.clientX, m.clientY);
        const col = el && el.closest && el.closest('[data-dia-horas]');
        if (col && rej.contains(col)) clave = col.dataset.diaHoras;
      }
      estado = { id: o.ev.id, ocurrencia: o.clave, clave, desde, hasta };
      setArrastre(estado);
    };
    const suelta = () => {
      document.removeEventListener('pointermove', mueveRaton);
      document.removeEventListener('pointerup', suelta);
      setArrastre(null);
      if (!moviendo || !estado) { if (!moviendo) abreEditor(o); return; }
      recienArrastrado.current = Date.now();
      const patch = { hora: CalL.horaDe(estado.desde), horaFin: CalL.horaDe(Math.min(1439, estado.hasta)) };
      const delta = CalL.diasEntre(o.inicio, CalL.deClave(estado.clave));
      const nuevoOrigen = o.ev.repite ? estado.clave : CalL.claveDe(CalL.sumaDias(CalL.deClave(o.origen), delta));
      mueveEvento(o, nuevoOrigen, patch);
    };
    document.addEventListener('pointermove', mueveRaton);
    document.addEventListener('pointerup', suelta);
  };

  // La lista entera de un día se abre PEGADA a ese día, como en Google: centrada
  // en el calendario tapaba justo las casillas de alrededor, y el siguiente clic
  // en ellas caía encima de la lista. En los días de abajo crece hacia arriba
  // para no salirse del nodo. Las medidas se pasan a píxeles del nodo, porque
  // getBoundingClientRect ya viene multiplicado por el zoom del lienzo.
  const abreLista = (key) => {
    const tarjeta = tarjetaRef.current;
    const celda = tarjeta && tarjeta.querySelector(`[data-dia="${key}"]`);
    if (tarjeta && celda) {
      const kr = tarjeta.getBoundingClientRect();
      const cr = celda.getBoundingClientRect();
      const escala = kr.width / (tarjeta.offsetWidth || kr.width) || 1;
      const x = (cr.left - kr.left) / escala;
      const arriba = (cr.top - kr.top) / escala;
      const abajo = (kr.bottom - cr.bottom) / escala;
      setSitioLista(arriba < tarjeta.offsetHeight / 2 ? { x, top: arriba } : { x, bottom: abajo });
    } else setSitioLista(null);
    setVerMas(key);
  };

  const startAddImage = (key) => {
    pendingImgKey.current = key;
    fileRef.current?.click();
  };
  const handlePickImage = (e) => {
    const f = e.target.files && e.target.files[0];
    const key = pendingImgKey.current;
    e.target.value = '';
    if (!f || !key) return;
    calFotoDelDia(f).then((datos) => {
      if (!datos) return;
      onUpdate({ images: { ...(itemRef.current.images || {}), [key]: datos } });
    });
  };
  const removeImage = (key) => {
    const next = { ...images };
    delete next[key];
    onUpdate({ images: next });
  };
  const setDayColor = (key, color) => {
    const next = { ...dayColors };
    if (color) next[key] = color; else delete next[key];
    onUpdate({ dayColors: next });
  };
  const clearDayEvents = (key) => {
    const next = { ...events };
    delete next[key];
    onUpdate({ events: next });
  };
  const fuenteFoto = (v) => (window.resolveMediaSrc ? window.resolveMediaSrc(v) : v);

  // ── Un evento en el mes o en la lista de un día ──
  // Los de día entero, una píldora de su color; los que tienen hora, un punto,
  // la hora y el título, como en Google.
  const pintaEvento = (o, dia) => {
    const color = calColorDe(o.ev);
    const entero = CalL.esDeDiaEntero(o.ev);
    const hecha = calHecha(o.ev, o.clave);
    const empieza = CalL.claveDe(o.inicio) === CalL.claveDe(dia);
    const acaba = CalL.claveDe(o.fin) === CalL.claveDe(dia);
    const moviendose = arrastre && arrastre.id === o.ev.id && arrastre.clave === o.clave;
    return (
      <div
        key={o.ev.id + '|' + o.clave}
        className={`cal-mb-event ${entero ? 'entero' : 'con-hora'} ${hecha ? 'hecha' : ''} ${!empieza ? 'sigue-antes' : ''} ${!acaba ? 'sigue-despues' : ''} ${moviendose ? 'moviendose' : ''}`}
        style={{ '--ev': color }}
        onPointerDown={(e) => arrastraEnMes(e, o)}
        onMouseDown={quieto}
        onClick={quieto}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); borraRapido(o); }}
        title={(entero ? '' : CalL.textoHora(o.ev.hora, en24) + ' ') + (o.ev.text || '') + (o.ev.lugar ? ' · ' + o.ev.lugar : '')}
      >
        {o.ev.tarea && (
          <span className="cal-mb-tarea" onPointerDown={quieto} onClick={(e) => { e.stopPropagation(); alternaHecha(o); }}>
            <span className="material-symbols-rounded">{hecha ? 'check_circle' : 'radio_button_unchecked'}</span>
          </span>
        )}
        {!entero && !o.ev.tarea && <span className="cal-mb-punto"/>}
        {!entero && <span className="cal-mb-hora">{CalL.textoHora(o.ev.hora, en24)}</span>}
        <span className="cal-mb-texto">{o.ev.text || window.t('(sin título)', '(no title)')}</span>
      </div>
    );
  };

  // ── Vista de mes ──
  const pintaMes = () => (
    <>
      <div className="cal-mb-dows" style={{ gridTemplateColumns: `${conSemanas ? '2.2em ' : ''}repeat(${columnas}, minmax(0, 1fr))` }}>
        {conSemanas && <div className="cal-mb-dow cal-mb-semana-cab">{window.t('Sem', 'Wk')}</div>}
        {semanas[0].dias.map((f, i) => <div key={i} className="cal-mb-dow">{calNombreDia(lang, f)}</div>)}
      </div>
      <div
        className="cal-mb-grid"
        ref={rejillaRef}
        style={{
          gridTemplateColumns: `${conSemanas ? '2.2em ' : ''}repeat(${columnas}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${semanas.length}, minmax(0, 1fr))`,
        }}
      >
        {semanas.map((s, si) => (
          <React.Fragment key={si}>
            {conSemanas && <div className="cal-mb-semana">{CalL.semanaISO(CalL.sumaDias(s.lunes, 3))}</div>}
            {s.dias.map((f) => {
              const k = CalL.claveDe(f);
              const lista = delDia(f);
              const img = images[k];
              const tinte = dayColors[k];
              const esHoy = k === claveHoy;
              const esSel = k === selectedKey && k !== claveHoy;
              // Si sobran eventos, el último hueco es para el "+N más".
              const visibles = lista.length > caben ? lista.slice(0, Math.max(0, caben - 1)) : lista;
              const resto = lista.length - visibles.length;
              const destino = arrastre && arrastre.destino === k;
              return (
                <div
                  key={k}
                  className={`cal-mb-cell ${f.getMonth() !== ancla.getMonth() ? 'fuera' : ''} ${esFinde(f) ? 'finde' : ''} ${esHoy ? 'today' : ''} ${esSel ? 'selected-day' : ''} ${img ? 'has-image' : ''} ${tinte ? 'con-color' : ''} ${destino ? 'destino' : ''}`}
                  style={tinte ? { '--dia': tinte } : null}
                  data-dia={k}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (Date.now() - recienArrastrado.current < 400) return;
                    // Un segundo clic en el día elegido lo suelta: sin el
                    // desplegable de "Día" de antes, es la forma de quitar el aro.
                    if (k === selectedKey) onUpdate({ selectedDay: null, selectedYear: null, selectedMonth: null });
                    else onUpdate({ selectedDay: f.getDate(), selectedYear: f.getFullYear(), selectedMonth: f.getMonth() });
                    window.playAudioTone && window.playAudioTone('click');
                    openDayMenu({ key: k });
                  }}
                  onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); openDayMenu({ key: k }); }}
                  onMouseDown={quieto}
                >
                  {img && <div className="cal-mb-cell-img" style={{ backgroundImage: `url("${fuenteFoto(img)}")` }}/>}
                  <div className="cal-mb-cell-top">
                    <button className="cal-mb-add" onClick={(e) => { e.stopPropagation(); nuevoEvento(k); }} onMouseDown={quieto} title={window.t('Añadir un evento', 'Add an event')}>
                      <span className="material-symbols-rounded">add</span>
                    </button>
                    {/* El número lleva a ese día en la vista de día, como en Google. */}
                    <span className="cal-mb-day" onClick={(e) => { e.stopPropagation(); ponVista('dia', f); }} title={window.t('Ver este día', 'Show this day')}>
                      {f.getDate() === 1 ? `${f.getDate()} ${calNombreMes(lang, f.getMonth(), 'short')}` : f.getDate()}
                    </span>
                  </div>
                  {visibles.map(o => pintaEvento(o, f))}
                  {resto > 0 && (
                    <button className="cal-mb-mas" onClick={(e) => { e.stopPropagation(); abreLista(k); }} onMouseDown={quieto}>
                      {window.t(`+${resto} más`, `+${resto} more`)}
                    </button>
                  )}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </>
  );

  // ── Vistas de semana y de día: las horas ──
  const pintaHoras = () => {
    const plantilla = `3.6em repeat(${diasVista.length}, minmax(0, 1fr))`;
    const horas = Array.from({ length: 24 }, (_, h) => h);
    return (
      <div className="cal-horas">
        <div className="cal-horas-cab" style={{ gridTemplateColumns: plantilla }}>
          <div className="cal-horas-esquina">{conSemanas ? window.t('Sem ', 'Wk ') + CalL.semanaISO(CalL.sumaDias(diasVista[0], 3)) : ''}</div>
          {diasVista.map(f => {
            const k = CalL.claveDe(f);
            return (
              <button key={k} className={`cal-horas-dia ${k === claveHoy ? 'today' : ''}`} onClick={(e) => { e.stopPropagation(); ponVista('dia', f); }} onMouseDown={quieto}>
                <span className="cal-horas-dia-nombre">{calNombreDia(lang, f)}</span>
                <span className="cal-horas-dia-num">{f.getDate()}</span>
              </button>
            );
          })}
        </div>
        <div className="cal-horas-todo" style={{ gridTemplateColumns: plantilla }}>
          <div className="cal-horas-etiqueta">{window.t('Todo el día', 'All day')}</div>
          {diasVista.map(f => {
            const k = CalL.claveDe(f);
            return (
              <div key={k} className="cal-horas-todo-dia" data-dia={k} onDoubleClick={(e) => { e.stopPropagation(); nuevoEvento(k); }} onMouseDown={quieto}>
                {delDia(f).filter(o => CalL.esDeDiaEntero(o.ev)).map(o => pintaEvento(o, f))}
              </div>
            );
          })}
        </div>
        <div className="cal-horas-cuerpo" ref={cuerpoHorasRef}>
          <div className="cal-horas-rejilla" ref={horasRef} style={{ gridTemplateColumns: plantilla }}>
            <div className="cal-horas-regla">
              {horas.map(h => <div key={h} className="cal-horas-marca">{h ? CalL.textoHora(CalL.horaDe(h * 60), en24) : ''}</div>)}
            </div>
            {diasVista.map(f => {
              const k = CalL.claveDe(f);
              const conHora = delDia(f).filter(o => !CalL.esDeDiaEntero(o.ev) && CalL.claveDe(o.inicio) === k);
              // Lo que se está arrastrando se pinta donde va a caer.
              const bloques = conHora
                .filter(o => !(arrastre && arrastre.id === o.ev.id && arrastre.ocurrencia === o.clave && arrastre.clave !== k))
                .map(o => {
                  const vivo = arrastre && arrastre.id === o.ev.id && arrastre.ocurrencia === o.clave ? arrastre : null;
                  const desde = vivo ? vivo.desde : (CalL.minutosDe(o.ev.hora) || 0);
                  const hasta = vivo ? vivo.hasta : Math.max(desde + 15, CalL.minutosDe(o.ev.horaFin) || desde + (item.duracion || 60));
                  return { o, desde, hasta, vivo: !!vivo };
                });
              if (arrastre && arrastre.clave === k && arrastre.desde != null && !bloques.some(b => b.vivo)) {
                const o = ocus.find(x => x.ev.id === arrastre.id && x.clave === arrastre.ocurrencia);
                if (o) bloques.push({ o, desde: arrastre.desde, hasta: arrastre.hasta, vivo: true });
              }
              const puestos = CalL.reparteColumnas(bloques);
              const esHoy = k === claveDeHoy;
              const minAhora = ahora.getHours() * 60 + ahora.getMinutes();
              return (
                <div
                  key={k}
                  className={`cal-horas-col ${esFinde(f) ? 'finde' : ''}`}
                  data-dia-horas={k}
                  onMouseDown={quieto}
                  onClick={(e) => {
                    // Un clic en un hueco crea un evento a esa hora, redondeada a
                    // la media hora, con la duración elegida en los ajustes.
                    e.stopPropagation();
                    if (Date.now() - recienArrastrado.current < 400) return;
                    const r = e.currentTarget.getBoundingClientRect();
                    const min = Math.floor(((e.clientY - r.top) / r.height * 1440) / 30) * 30;
                    const fin = Math.min(1439, min + (item.duracion || 60));
                    nuevoEvento(k, { hora: CalL.horaDe(min), horaFin: CalL.horaDe(fin), avisos: [10] });
                  }}
                >
                  {puestos.map(({ o, desde, hasta, col, cols, vivo }) => (
                    <div
                      key={o.ev.id + '|' + o.clave}
                      className={`cal-horas-evento ${calHecha(o.ev, o.clave) ? 'hecha' : ''} ${vivo ? 'moviendose' : ''}`}
                      style={{
                        '--ev': calColorDe(o.ev),
                        top: (desde / 1440 * 100) + '%',
                        height: (Math.max(15, hasta - desde) / 1440 * 100) + '%',
                        left: `calc(${col / cols * 100}% + 1px)`,
                        width: `calc(${100 / cols}% - 3px)`,
                      }}
                      onPointerDown={(e) => arrastraEnHoras(e, o, 'mover')}
                      onClick={quieto}
                      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); borraRapido(o); }}
                    >
                      <div className="cal-horas-evento-titulo">
                        {o.ev.tarea && (
                          <span className="cal-mb-tarea" onPointerDown={quieto} onClick={(e) => { e.stopPropagation(); alternaHecha(o); }}>
                            <span className="material-symbols-rounded">{calHecha(o.ev, o.clave) ? 'check_circle' : 'radio_button_unchecked'}</span>
                          </span>
                        )}
                        {o.ev.text || window.t('(sin título)', '(no title)')}
                      </div>
                      <div className="cal-horas-evento-hora">
                        {CalL.textoHora(CalL.horaDe(desde), en24)} – {CalL.textoHora(CalL.horaDe(Math.min(1439, hasta)), en24)}
                        {o.ev.lugar ? ' · ' + o.ev.lugar : ''}
                      </div>
                      {!o.ev.tarea && <div className="cal-horas-estirar" onPointerDown={(e) => arrastraEnHoras(e, o, 'estirar')} title={window.t('Arrastra para cambiar la duración', 'Drag to change the duration')}/>}
                    </div>
                  ))}
                  {esHoy && <div className="cal-horas-ahora" style={{ top: (minAhora / 1440 * 100) + '%' }}/>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // ── Vista de año: los doce meses en pequeño ──
  const pintaAnio = () => (
    <div className="cal-anio">
      {Array.from({ length: 12 }, (_, m) => {
        const primero = new Date(ancla.getFullYear(), m, 1);
        const inicio = CalL.inicioSemana(primero, primerDia);
        const dias = Array.from({ length: 42 }, (_, i) => CalL.sumaDias(inicio, i));
        return (
          <div key={m} className="cal-anio-mes">
            <button className="cal-anio-titulo" onClick={(e) => { e.stopPropagation(); ponVista('mes', primero); }} onMouseDown={quieto}>
              {calNombreMes(lang, m)}
            </button>
            <div className="cal-anio-rejilla">
              {dias.slice(0, 7).map((f, i) => <span key={'n' + i} className="cal-anio-dow">{calNombreDia(lang, f, 'narrow')}</span>)}
              {dias.map((f, i) => {
                if (f.getMonth() !== m) return <span key={i}/>;
                const k = CalL.claveDe(f);
                const hay = delDia(f).length > 0;
                return (
                  <button
                    key={i}
                    className={`cal-anio-dia ${k === claveHoy ? 'today' : ''} ${hay ? 'con-eventos' : ''}`}
                    onClick={(e) => { e.stopPropagation(); ponVista('dia', f); }}
                    onMouseDown={quieto}
                  >{f.getDate()}</button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );

  // ── Agenda: lo que viene, día a día ──
  const pintaAgenda = () => {
    const grupos = [];
    for (let i = 0; i < 60; i++) {
      const f = CalL.sumaDias(desdeVista, i);
      const lista = delDia(f);
      if (lista.length) grupos.push({ f, lista });
    }
    if (!grupos.length) return <div className="cal-agenda-vacia">{window.t('Nada en los próximos 60 días.', 'Nothing in the next 60 days.')}</div>;
    return (
      <div className="cal-agenda">
        {grupos.map(({ f, lista }) => {
          const k = CalL.claveDe(f);
          return (
            <div key={k} className={`cal-agenda-dia ${k === claveHoy ? 'today' : ''}`}>
              <button className="cal-agenda-fecha" onClick={(e) => { e.stopPropagation(); ponVista('dia', f); }} onMouseDown={quieto}>
                <span className="cal-agenda-num">{f.getDate()}</span>
                <span className="cal-agenda-dow">{calFecha(lang, f, { weekday: 'short', month: 'short' })}</span>
              </button>
              <div className="cal-agenda-lista">
                {lista.map(o => (
                  <div
                    key={o.ev.id + '|' + o.clave}
                    className={`cal-agenda-evento ${calHecha(o.ev, o.clave) ? 'hecha' : ''}`}
                    style={{ '--ev': calColorDe(o.ev) }}
                    onClick={(e) => { e.stopPropagation(); abreEditor(o); }}
                    onMouseDown={quieto}
                  >
                    {o.ev.tarea
                      ? <span className="cal-mb-tarea" onClick={(e) => { e.stopPropagation(); alternaHecha(o); }}><span className="material-symbols-rounded">{calHecha(o.ev, o.clave) ? 'check_circle' : 'radio_button_unchecked'}</span></span>
                      : <span className="cal-mb-punto"/>}
                    <span className="cal-agenda-hora">
                      {CalL.esDeDiaEntero(o.ev) ? window.t('Todo el día', 'All day')
                        : CalL.textoHora(o.ev.hora, en24) + (o.ev.horaFin && !o.ev.tarea ? ' – ' + CalL.textoHora(o.ev.horaFin, en24) : '')}
                    </span>
                    <span className="cal-agenda-texto">{o.ev.text || window.t('(sin título)', '(no title)')}</span>
                    {o.ev.lugar && <span className="cal-agenda-lugar">{o.ev.lugar}</span>}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div
      className="cal-mb"
      style={{
        width: '100%', height: '100%',
        // Multiplican al --node-scale que ya tiene el nodo. La cabecera va por
        // encima del texto: al subir el tamaño, los días crecían y el mes se
        // quedaba enano arriba (lo vio el usuario). Su ajuste propio (headScale)
        // ya no tiene botón, pero se respeta en los calendarios que lo tenían.
        '--cal-texto': `var(--vista-escala, ${item.textScale || 1})`,
        '--cal-cabecera': `calc(${item.headScale || 1} * var(--cal-texto, 1))`,
        ...(item.numberColor ? { '--cal-numero': item.numberColor } : null),
      }}
    >
      <div className="item-card" ref={tarjetaRef} style={{ background: bg, color: window.nodeInk(item) }}>
        <div className="cal-mb-head">
          <div className="cal-mb-titulo-caja" ref={selectorRef}>
            <button
              className="cal-mb-pick-btn cal-mb-titulo"
              onClick={(e) => { e.stopPropagation(); setSelector(selector == null ? ancla.getFullYear() : null); }}
              onMouseDown={quieto}
              title={window.t('Elegir mes y año', 'Pick month and year')}
            >
              {titulo}
              <span className="material-symbols-rounded">expand_more</span>
            </button>
            {selector != null && (
              <div className="cal-mb-selector" onMouseDown={quieto} onClick={quieto}>
                <div className="cal-mb-selector-anio">
                  <button className="cal-mb-nav" onClick={() => setSelector(selector - 1)} title={window.t('Año anterior', 'Previous year')}>
                    <span className="material-symbols-rounded">chevron_left</span>
                  </button>
                  <span>{selector}</span>
                  <button className="cal-mb-nav" onClick={() => setSelector(selector + 1)} title={window.t('Año siguiente', 'Next year')}>
                    <span className="material-symbols-rounded">chevron_right</span>
                  </button>
                </div>
                <div className="cal-mb-selector-meses">
                  {Array.from({ length: 12 }, (_, m) => (
                    <button
                      key={m}
                      className={`cal-mb-selector-mes ${selector === ancla.getFullYear() && m === ancla.getMonth() ? 'active' : ''} ${selector === hoy.getFullYear() && m === hoy.getMonth() ? 'actual' : ''}`}
                      onClick={() => { setAncla(new Date(selector, m, 1)); setSelector(null); window.playAudioTone && window.playAudioTone('click'); }}
                    >
                      {calNombreMes(lang, m, 'short')}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="cal-mb-navs">
            <div className="cal-mb-vista-caja" ref={vistaRef}>
              <button className="cal-mb-nav cal-mb-vista" onClick={(e) => { e.stopPropagation(); setMenuVista(!menuVista); }} onMouseDown={quieto} title={window.t('Cambiar de vista', 'Change view')}>
                {nombresVista[vista]}
                <span className="material-symbols-rounded">arrow_drop_down</span>
              </button>
              {menuVista && (
                <div className="cal-mb-vistas" onMouseDown={quieto} onClick={quieto}>
                  {CAL_VISTAS.map(v => (
                    <button key={v} className={v === vista ? 'active' : ''} onClick={() => ponVista(v)}>{nombresVista[v]}</button>
                  ))}
                </div>
              )}
            </div>
            <button className="cal-mb-nav" onClick={(e) => { e.stopPropagation(); mueve(-1); }} onMouseDown={quieto} title={window.t('Anterior', 'Previous')}>
              <span className="material-symbols-rounded">chevron_left</span>
            </button>
            <button className="cal-mb-nav cal-mb-hoy" onClick={(e) => { e.stopPropagation(); aHoy(); }} onMouseDown={quieto} title={window.t('Ir a hoy', 'Go to today')}>
              {window.t('Hoy', 'Today')}
            </button>
            <button className="cal-mb-nav" onClick={(e) => { e.stopPropagation(); mueve(1); }} onMouseDown={quieto} title={window.t('Siguiente', 'Next')}>
              <span className="material-symbols-rounded">chevron_right</span>
            </button>
          </div>
        </div>

        {vista === 'mes' && pintaMes()}
        {(vista === 'semana' || vista === 'dia') && pintaHoras()}
        {vista === 'anio' && pintaAnio()}
        {vista === 'agenda' && pintaAgenda()}

        {verMas && (() => {
          const f = CalL.deClave(verMas);
          return (
            <div
              className={`cal-mb-lista ${sitioLista ? 'anclada' : ''}`}
              ref={listaRef}
              onMouseDown={quieto}
              onClick={quieto}
              style={sitioLista ? {
                '--lista-x': sitioLista.x + 'px',
                ...(sitioLista.top != null ? { top: sitioLista.top + 'px' } : { top: 'auto', bottom: sitioLista.bottom + 'px' }),
              } : null}
            >
              <div className="cal-mb-lista-cab">
                <span>{calFechaCorta(lang, f)}</span>
                <button className="cal-mb-nav" onClick={() => setVerMas(null)} title={window.t('Cerrar', 'Close')}>
                  <span className="material-symbols-rounded">close</span>
                </button>
              </div>
              <div className="cal-mb-lista-cuerpo">
                {delDia(f).map(o => pintaEvento(o, f))}
                <button className="cal-mb-lista-add" onClick={() => { setVerMas(null); nuevoEvento(verMas); }}>
                  <span className="material-symbols-rounded">add</span>
                  {window.t('Nuevo evento', 'New event')}
                </button>
              </div>
            </div>
          );
        })()}

        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePickImage}/>
        {editor && (
          <CalEditor item={item} lang={lang} onUpdate={onUpdate} editor={editor} setEditor={setEditor} onCerrar={cierraEditor}/>
        )}
        {dayMenu && (() => {
          const k = dayMenu.key;
          const hasImg = !!images[k];
          const hasEvents = (events[k] || []).length > 0;
          return ReactDOM.createPortal((
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 200 }} onClick={() => openDayMenu(null)} onMouseDown={(e) => e.stopPropagation()}/>
              <div className="ctx-side ctx-side-day" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                <button className="ctx-close" onClick={() => openDayMenu(null)} title={window.t('Cerrar', 'Close')}>
                  <span className="material-symbols-rounded">arrow_back</span>
                </button>
                <div className="cal-menu-fecha">{calFechaCorta(lang, CalL.deClave(k))}</div>
                <button className="ctx-btn" onClick={() => { openDayMenu(null); nuevoEvento(k); }}>
                  <span className="material-symbols-rounded">add</span>
                  <span>{window.t('Evento', 'Event')}</span>
                </button>
                <button className="ctx-btn" onClick={() => { openDayMenu(null); nuevoEvento(k, { tarea: true }); }}>
                  <span className="material-symbols-rounded">task_alt</span>
                  <span>{window.t('Tarea', 'Task')}</span>
                </button>
                <button className="ctx-btn" onClick={() => { startAddImage(k); openDayMenu(null); }}>
                  <span className="material-symbols-rounded">image</span>
                  <span>{hasImg ? window.t('Cambiar', 'Change') : window.t('Imagen', 'Image')}</span>
                </button>
                {hasImg && (
                  <button className="ctx-btn" onClick={() => { removeImage(k); }}>
                    <span className="material-symbols-rounded">hide_image</span>
                    <span>{window.t('Quitar', 'Remove')}</span>
                  </button>
                )}
                {/* El color del día, con el mismo selector que el resto de la
                    aplicación —cualquier color, con el historial— en su panel
                    al lado. Antes eran siete círculos fijos, la paleta vieja
                    (lo vio el usuario). */}
                <button className={`ctx-btn ${dayMenu.color ? 'active' : ''}`} onClick={() => setDayMenu({ ...dayMenu, color: !dayMenu.color })}>
                  <div className="ctx-color-chip" style={{ background: dayColors[k] || 'transparent', border: '1.5px solid var(--line-soft)' }}/>
                  <span>{window.t('Color', 'Color')}</span>
                </button>
                {hasEvents && (
                  <>
                    <div className="ctx-sep-h"/>
                    <button className="ctx-btn danger" onClick={() => { clearDayEvents(k); openDayMenu(null); }}>
                      <span className="material-symbols-rounded">delete_sweep</span>
                      <span>{window.t('Limpiar', 'Clear')}</span>
                    </button>
                  </>
                )}
              </div>
              {dayMenu.color && (
                <div className="ctx-popout cal-dia-color" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                  <div className="ctx-pop-section">
                    <div className="ctx-pop-title">{window.t('Color del día', 'Day colour')}</div>
                    {window.SelectorColor && (
                      <window.SelectorColor
                        valor={dayColors[k] || null}
                        onCambio={(c) => setDayColor(k, c)}
                        colores={CAL_COLORES_DIA}
                        tam={26}
                      />
                    )}
                    {dayColors[k] && (
                      <button className="cal-menu-sin-color" onClick={() => setDayColor(k, null)}>
                        <span className="material-symbols-rounded">format_color_reset</span>
                        {window.t('Quitar el color', 'Remove colour')}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          ), document.body);
        })()}
        {item.showCaption && (
          <div className="node-caption-row">
            <NodeCaption item={item} lang={lang} onUpdate={onUpdate} autoGrow/>
          </div>
        )}
      </div>
    </div>
  );
}

window.CalendarItem = CalendarItem;
