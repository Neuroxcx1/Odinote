// =====================================================
// Oddinote — la lógica de fechas del calendario
//
// Todo lo que el nodo de calendario sabe de fechas, sin React ni pantalla: qué
// días caen dentro de una repetición, cómo se reparten los eventos que se pisan
// en una misma hora, qué avisos tocan ahora, y cómo se escribe y se lee un .ics.
// Va aparte para poder probarlo con node (scripts/test-calendario-logica.js):
// una repetición mal contada no se ve hasta que falta un evento meses después.
//
// Las claves de día son las que ya usaban los calendarios: "año-mes-día", con el
// mes EMPEZANDO EN 0 (septiembre es 8). No se cambian: los eventos de todos los
// calendarios que ya existen están guardados con ellas.
//
// Un evento es { id, text, color } como siempre, y ahora además, si hacen falta:
//   hora, horaFin      "09:00" / "10:30"; sin hora, es de día entero
//   fin                clave del último día, si dura varios
//   repite             { cada, unidad: 'dia'|'semana'|'mes'|'anio', dias?, modo?, hasta?, veces? }
//   excepciones        claves de los días en que NO se repite (borrados sueltos)
//   avisos             minutos antes: [10, 60…]
//   lugar, notas       texto
//   tarea, hecho       una tarea de Google: se marca como hecha
//   hechos             en una tarea que se repite, los días ya hechos
// =====================================================
(function () {
  const clave = (y, m, d) => `${y}-${m}-${d}`;
  const deClave = (k) => {
    const [y, m, d] = String(k).split('-').map(Number);
    return new Date(y, m, d);
  };
  const claveDe = (f) => clave(f.getFullYear(), f.getMonth(), f.getDate());
  const sumaDias = (f, n) => new Date(f.getFullYear(), f.getMonth(), f.getDate() + n);
  // Días enteros entre dos fechas, contando por calendario y no por horas: con
  // el cambio de hora un día puede tener 23 o 25 horas.
  const diasEntre = (a, b) => Math.round(
    (Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000);
  // Lunes = 0 … domingo = 6, que es como se piensa una semana aquí.
  const diaSemana = (f) => (f.getDay() + 6) % 7;

  const minutosDe = (h) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(h || ''));
    return m ? Math.min(24 * 60, Number(m[1]) * 60 + Number(m[2])) : null;
  };
  const horaDe = (min) => {
    const t = Math.max(0, Math.min(24 * 60 - 1, Math.round(min)));
    return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
  };
  // "9:00" o "9:00 a. m." según el reloj que se haya elegido en el calendario.
  const textoHora = (h, en24) => {
    const min = minutosDe(h);
    if (min == null) return '';
    const hh = Math.floor(min / 60), mm = min % 60;
    if (en24 !== false) return hh + ':' + String(mm).padStart(2, '0');
    const h12 = hh % 12 === 0 ? 12 : hh % 12;
    return h12 + (mm ? ':' + String(mm).padStart(2, '0') : '') + (hh < 12 ? ' am' : ' pm');
  };

  const esDeDiaEntero = (ev) => !ev || minutosDe(ev.hora) == null;
  // Cuántos días DE MÁS dura (0 = cabe en su día).
  const diasDeMas = (ev, claveInicio) => {
    if (!ev || !ev.fin) return 0;
    return Math.max(0, diasEntre(deClave(claveInicio), deClave(ev.fin)));
  };

  // El n-ésimo día de la semana de un mes ("el cuarto jueves"). null si ese
  // mes no tiene tantos.
  function enesimoDia(y, m, ds, n) {
    const primero = new Date(y, m, 1);
    const d = 1 + ((ds - diaSemana(primero) + 7) % 7) + (n - 1) * 7;
    const f = new Date(y, m, d);
    return f.getMonth() === m ? f : null;
  }

  // ── Las fechas en que empieza cada vez un evento, dentro de [desde, hasta] ──
  // Devuelve las que tocan el rango aunque empiecen antes (un evento de varios
  // días que empezó el domingo sigue viéndose el lunes). Como Google, un
  // "cada mes el 31" se salta los meses que no tienen 31, y "cada año el 29 de
  // febrero" los años que no son bisiestos. "veces" cuenta también los días
  // borrados sueltos, como hace el estándar de los .ics.
  function ocurrencias(ev, claveInicio, desde, hasta) {
    const ini = deClave(claveInicio);
    const mas = diasDeMas(ev, claveInicio);
    const tocaRango = (f) => f <= hasta && sumaDias(f, mas) >= desde;
    if (!ev || !ev.repite) return tocaRango(ini) ? [ini] : [];

    const r = ev.repite;
    const cada = Math.max(1, Math.floor(Number(r.cada) || 1));
    const tope = r.hasta ? deClave(r.hasta) : null;
    const veces = r.veces ? Math.max(1, Math.floor(Number(r.veces))) : null;
    const fuera = new Set(ev.excepciones || []);
    const res = [];
    let cuenta = 0;
    // Devuelve false cuando ya no hay que seguir buscando.
    const mira = (f) => {
      if (f < ini) return true;
      if (tope && f > tope) return false;
      if (veces && cuenta >= veces) return false;
      if (f > hasta) return false;
      cuenta++;
      if (!fuera.has(claveDe(f)) && tocaRango(f)) res.push(f);
      return true;
    };

    // Sin límite de veces se puede saltar directamente cerca del rango: un
    // evento diario que empezó hace diez años no necesita contar los diez años.
    const puedeSaltar = !veces;
    let guardia = 0;
    if (r.unidad === 'semana') {
      const dias = (Array.isArray(r.dias) && r.dias.length ? r.dias : [diaSemana(ini)]).slice().sort((a, b) => a - b);
      const lunes = sumaDias(ini, -diaSemana(ini));
      let semana = 0;
      if (puedeSaltar) {
        const semanas = Math.floor(diasEntre(lunes, sumaDias(desde, -mas)) / 7);
        if (semanas > cada) semana = Math.floor((semanas - 1) / cada);
      }
      for (; guardia < 20000; semana++, guardia++) {
        const base = sumaDias(lunes, semana * cada * 7);
        let seguir = true;
        for (const d of dias) { if (!mira(sumaDias(base, d))) { seguir = false; break; } }
        if (!seguir) break;
      }
    } else if (r.unidad === 'mes') {
      let k = 0;
      if (puedeSaltar) {
        const meses = (desde.getFullYear() - ini.getFullYear()) * 12 + desde.getMonth() - ini.getMonth() - 1;
        if (meses > cada) k = Math.floor((meses - 1) / cada);
      }
      const ds = diaSemana(ini), n = Math.ceil(ini.getDate() / 7);
      for (; guardia < 20000; k++, guardia++) {
        const y = ini.getFullYear(), m = ini.getMonth() + k * cada;
        const base = new Date(y, m, 1);
        let f;
        if (r.modo === 'diaSemana') f = enesimoDia(base.getFullYear(), base.getMonth(), ds, n);
        else {
          f = new Date(base.getFullYear(), base.getMonth(), ini.getDate());
          if (f.getMonth() !== base.getMonth()) f = null;
        }
        if (!f) { if (base > hasta || (tope && base > tope)) break; continue; }
        if (!mira(f)) break;
      }
    } else if (r.unidad === 'anio') {
      let k = 0;
      if (puedeSaltar) {
        const anios = desde.getFullYear() - ini.getFullYear() - 1;
        if (anios > cada) k = Math.floor((anios - 1) / cada);
      }
      for (; guardia < 5000; k++, guardia++) {
        const y = ini.getFullYear() + k * cada;
        const f = new Date(y, ini.getMonth(), ini.getDate());
        if (f.getMonth() !== ini.getMonth()) { if (new Date(y, 0, 1) > hasta) break; continue; }
        if (!mira(f)) break;
      }
    } else {
      // Cada día (o cada N días).
      let k = 0;
      if (puedeSaltar) {
        const dias = diasEntre(ini, sumaDias(desde, -mas));
        if (dias > cada) k = Math.floor((dias - 1) / cada);
      }
      for (; guardia < 40000; k++, guardia++) {
        if (!mira(sumaDias(ini, k * cada))) break;
      }
    }
    return res;
  }

  // Todas las veces de todos los eventos de un calendario que tocan [desde,
  // hasta], ya ordenadas como las ordena Google: primero los de día entero (los
  // que duran más, antes) y después por hora.
  function eventosEnRango(eventos, desde, hasta) {
    const lista = [];
    for (const origen of Object.keys(eventos || {})) {
      const arr = Array.isArray(eventos[origen]) ? eventos[origen] : [];
      for (const ev of arr) {
        if (!ev || !ev.id) continue;
        for (const f of ocurrencias(ev, origen, desde, hasta)) {
          lista.push({ ev, origen, inicio: f, clave: claveDe(f), fin: sumaDias(f, diasDeMas(ev, origen)) });
        }
      }
    }
    return lista.sort(ordenEventos);
  }
  function ordenEventos(a, b) {
    const ea = esDeDiaEntero(a.ev), eb = esDeDiaEntero(b.ev);
    if (ea !== eb) return ea ? -1 : 1;
    if (a.inicio - b.inicio) return a.inicio - b.inicio;
    if (ea) return diasEntre(b.inicio, b.fin) - diasEntre(a.inicio, a.fin);
    return (minutosDe(a.ev.hora) || 0) - (minutosDe(b.ev.hora) || 0);
  }

  // Lo que se ve en un día concreto, contando los que empezaron antes y duran.
  function delDia(ocus, f) {
    return ocus.filter(o => o.inicio <= f && o.fin >= f);
  }

  // ── Los eventos con hora que se pisan, uno al lado del otro ──
  // Como en Google: los que coinciden en el tiempo se reparten el ancho en
  // columnas, y un grupo acaba cuando llega uno que ya no se pisa con ninguno.
  // Recibe [{ desde, hasta }] en minutos y devuelve cada uno con col y cols.
  function reparteColumnas(bloques) {
    const orden = bloques.map((b, i) => ({ ...b, i })).sort((a, b) => a.desde - b.desde || b.hasta - a.hasta);
    const res = new Array(bloques.length);
    let grupo = [], finGrupo = -1, columnas = [];
    const cierra = () => {
      const n = columnas.length || 1;
      for (const g of grupo) res[g.i] = { ...bloques[g.i], col: g.col, cols: n };
      grupo = []; columnas = []; finGrupo = -1;
    };
    for (const b of orden) {
      if (grupo.length && b.desde >= finGrupo) cierra();
      let col = columnas.findIndex(fin => fin <= b.desde);
      if (col === -1) { col = columnas.length; columnas.push(b.hasta); } else columnas[col] = b.hasta;
      grupo.push({ ...b, col });
      finGrupo = Math.max(finGrupo, b.hasta);
    }
    cierra();
    return res;
  }

  // Número de semana ISO (la que empieza en lunes y cuenta desde la del primer
  // jueves del año), el que enseña Google con "Mostrar números de semana".
  function semanaISO(f) {
    const d = new Date(Date.UTC(f.getFullYear(), f.getMonth(), f.getDate()));
    const dia = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dia);
    const inicio = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d - inicio) / 86400000 + 1) / 7);
  }

  // El primer día de la semana que contiene f, empezando en el día elegido
  // (1 = lunes, 0 = domingo, 6 = sábado: los valores de getDay).
  function inicioSemana(f, primerDia) {
    const p = primerDia == null ? 1 : primerDia;
    return sumaDias(f, -((f.getDay() - p + 7) % 7));
  }

  // ── Los avisos que tocan ahora ──
  // Recorre los calendarios de todos los lienzos cargados y devuelve los avisos
  // cuya hora cae entre (ahora − ventana) y ahora. Un evento de día entero avisa
  // tomando como hora las 9 de la mañana de ese día, como Google.
  function avisosPendientes(canvases, ahora, ventanaMs) {
    const res = [];
    const desde = sumaDias(ahora, -1), hasta = sumaDias(ahora, 8);
    for (const cid of Object.keys(canvases || {})) {
      const items = (canvases[cid] && canvases[cid].items) || [];
      for (const it of items) {
        if (!it || it.type !== 'calendar' || !it.events) continue;
        for (const o of eventosEnRango(it.events, desde, hasta)) {
          const avisos = Array.isArray(o.ev.avisos) ? o.ev.avisos : [];
          if (!avisos.length) continue;
          const min = esDeDiaEntero(o.ev) ? 9 * 60 : minutosDe(o.ev.hora);
          const empieza = new Date(o.inicio.getFullYear(), o.inicio.getMonth(), o.inicio.getDate(), 0, min);
          for (const antes of avisos) {
            const cuando = empieza.getTime() - Number(antes) * 60000;
            if (cuando <= ahora.getTime() && cuando > ahora.getTime() - ventanaMs) {
              res.push({ id: `${it.id}|${o.ev.id}|${o.clave}|${antes}`, ev: o.ev, empieza, antes: Number(antes) });
            }
          }
        }
      }
    }
    return res;
  }

  // ── .ics: el formato con el que se pasan calendarios de un programa a otro ──
  const ics = {
    escapa: (t) => String(t || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'),
    desescapa: (t) => String(t || '').replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1'),
    fecha: (f) => f.getFullYear() + String(f.getMonth() + 1).padStart(2, '0') + String(f.getDate()).padStart(2, '0'),
    // Las líneas de un .ics no pasan de 75 caracteres: lo que sobra sigue en la
    // siguiente, empezando por un espacio.
    pliega: (l) => {
      const trozos = [];
      let resto = l;
      while (resto.length > 74) { trozos.push(resto.slice(0, 74)); resto = ' ' + resto.slice(74); }
      trozos.push(resto);
      return trozos.join('\r\n');
    },
  };
  const DIAS_ICS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

  function aICS(eventos, nombre) {
    const l = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Oddinote//Calendario//ES', 'CALSCALE:GREGORIAN'];
    if (nombre) l.push('X-WR-CALNAME:' + ics.escapa(nombre));
    const sello = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    for (const origen of Object.keys(eventos || {})) {
      for (const ev of (Array.isArray(eventos[origen]) ? eventos[origen] : [])) {
        if (!ev || !ev.id) continue;
        const ini = deClave(origen);
        const ultimo = ev.fin ? deClave(ev.fin) : ini;
        l.push('BEGIN:' + (ev.tarea ? 'VTODO' : 'VEVENT'));
        l.push('UID:' + ev.id + '@oddinote');
        l.push('DTSTAMP:' + sello);
        l.push('SUMMARY:' + ics.escapa(ev.text));
        if (esDeDiaEntero(ev)) {
          l.push('DTSTART;VALUE=DATE:' + ics.fecha(ini));
          // En los .ics el final de un evento de día entero es el día SIGUIENTE.
          if (!ev.tarea) l.push('DTEND;VALUE=DATE:' + ics.fecha(sumaDias(ultimo, 1)));
        } else {
          const hi = ev.hora.replace(':', '') + '00';
          const hf = (ev.horaFin || horaDe((minutosDe(ev.hora) || 0) + 60)).replace(':', '') + '00';
          l.push('DTSTART:' + ics.fecha(ini) + 'T' + hi);
          if (!ev.tarea) l.push('DTEND:' + ics.fecha(ultimo) + 'T' + hf);
        }
        const r = ev.repite;
        if (r) {
          const freq = { dia: 'DAILY', semana: 'WEEKLY', mes: 'MONTHLY', anio: 'YEARLY' }[r.unidad] || 'DAILY';
          let regla = 'RRULE:FREQ=' + freq;
          if ((r.cada || 1) > 1) regla += ';INTERVAL=' + r.cada;
          if (r.unidad === 'semana' && Array.isArray(r.dias) && r.dias.length) regla += ';BYDAY=' + r.dias.map(d => DIAS_ICS[d]).join(',');
          if (r.unidad === 'mes' && r.modo === 'diaSemana') regla += ';BYDAY=' + Math.ceil(ini.getDate() / 7) + DIAS_ICS[diaSemana(ini)];
          if (r.veces) regla += ';COUNT=' + r.veces;
          else if (r.hasta) regla += ';UNTIL=' + ics.fecha(deClave(r.hasta));
          l.push(regla);
          for (const x of ev.excepciones || []) l.push('EXDATE;VALUE=DATE:' + ics.fecha(deClave(x)));
        }
        if (ev.lugar) l.push('LOCATION:' + ics.escapa(ev.lugar));
        if (ev.notas) l.push('DESCRIPTION:' + ics.escapa(ev.notas));
        if (ev.tarea) l.push('STATUS:' + (ev.hecho ? 'COMPLETED' : 'NEEDS-ACTION'));
        for (const a of ev.avisos || []) {
          l.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + ics.escapa(ev.text), 'TRIGGER:-PT' + Number(a) + 'M', 'END:VALARM');
        }
        l.push('END:' + (ev.tarea ? 'VTODO' : 'VEVENT'));
      }
    }
    l.push('END:VCALENDAR');
    return l.map(ics.pliega).join('\r\n') + '\r\n';
  }

  // Lee un .ics (de Google, Outlook, Apple…) y devuelve los eventos con las
  // claves de este calendario. Lo que no se entiende se deja fuera sin romper
  // nada: un .ics trae muchas cosas que aquí no tienen sitio.
  function deICS(texto) {
    const lineas = String(texto || '').replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
    const eventos = {};
    let ev = null, enAlarma = false, cuenta = 0;
    const leeFecha = (valor, params) => {
      const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/.exec(valor || '');
      if (!m) return null;
      let f = m[4] != null
        ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]))
        : new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      // En UTC ("Z"): se pasa a la hora de aquí. Con zona propia (TZID) se toma
      // tal cual, que para un calendario personal es casi siempre lo correcto.
      if (m[7]) f = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])));
      return { f, conHora: m[4] != null && !/VALUE=DATE(?!-)/.test(params || '') };
    };
    for (const linea of lineas) {
      const dos = linea.indexOf(':');
      if (dos < 0) continue;
      const cab = linea.slice(0, dos), valor = linea.slice(dos + 1);
      const [nombre, ...resto] = cab.split(';');
      const params = resto.join(';');
      const N = nombre.toUpperCase();
      if (N === 'BEGIN' && (valor === 'VEVENT' || valor === 'VTODO')) { ev = { tarea: valor === 'VTODO', avisos: [] }; continue; }
      if (!ev) continue;
      if (N === 'BEGIN' && valor === 'VALARM') { enAlarma = true; continue; }
      if (N === 'END' && valor === 'VALARM') { enAlarma = false; continue; }
      if (enAlarma) {
        if (N === 'TRIGGER') {
          const m = /^-?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:\d+S)?)?$/.exec(valor);
          if (m) ev.avisos.push(((+m[1] || 0) * 7 * 24 * 60) + ((+m[2] || 0) * 24 * 60) + ((+m[3] || 0) * 60) + (+m[4] || 0));
        }
        continue;
      }
      if (N === 'END' && (valor === 'VEVENT' || valor === 'VTODO')) {
        if (ev.ini) {
          const origen = claveDe(ev.ini.f);
          const nuevo = {
            id: 'ev-ics-' + Date.now().toString(36) + '-' + (cuenta++),
            text: ev.titulo || '(sin título)',
            color: 'blue',
          };
          if (ev.ini.conHora) {
            nuevo.hora = horaDe(ev.ini.f.getHours() * 60 + ev.ini.f.getMinutes());
            if (ev.finF && ev.finF.conHora) {
              nuevo.horaFin = horaDe(ev.finF.f.getHours() * 60 + ev.finF.f.getMinutes());
              if (diasEntre(ev.ini.f, ev.finF.f) > 0) nuevo.fin = claveDe(ev.finF.f);
            }
          } else if (ev.finF) {
            // El final de un día entero en un .ics es el día siguiente al último.
            const ultimo = sumaDias(ev.finF.f, -1);
            if (diasEntre(ev.ini.f, ultimo) > 0) nuevo.fin = claveDe(ultimo);
          }
          if (ev.repite) nuevo.repite = ev.repite;
          if (ev.excepciones && ev.excepciones.length) nuevo.excepciones = ev.excepciones;
          if (ev.lugar) nuevo.lugar = ev.lugar;
          if (ev.notas) nuevo.notas = ev.notas;
          if (ev.avisos.length) nuevo.avisos = ev.avisos;
          if (ev.tarea) { nuevo.tarea = true; nuevo.hecho = !!ev.hecho; }
          (eventos[origen] = eventos[origen] || []).push(nuevo);
        }
        ev = null;
        continue;
      }
      if (N === 'SUMMARY') ev.titulo = ics.desescapa(valor);
      else if (N === 'LOCATION') ev.lugar = ics.desescapa(valor);
      else if (N === 'DESCRIPTION') ev.notas = ics.desescapa(valor);
      else if (N === 'DTSTART') ev.ini = leeFecha(valor, params);
      else if (N === 'DTEND' || N === 'DUE') ev.finF = leeFecha(valor, params);
      else if (N === 'STATUS') ev.hecho = valor.toUpperCase() === 'COMPLETED';
      else if (N === 'EXDATE') {
        ev.excepciones = ev.excepciones || [];
        for (const v of valor.split(',')) { const x = leeFecha(v, params); if (x) ev.excepciones.push(claveDe(x.f)); }
      } else if (N === 'RRULE') {
        const p = {};
        for (const par of valor.split(';')) { const [k, v] = par.split('='); p[k.toUpperCase()] = v; }
        const unidad = { DAILY: 'dia', WEEKLY: 'semana', MONTHLY: 'mes', YEARLY: 'anio' }[p.FREQ];
        if (unidad) {
          const r = { cada: Number(p.INTERVAL) || 1, unidad };
          if (p.BYDAY) {
            const dias = p.BYDAY.split(',').map(x => DIAS_ICS.indexOf(x.replace(/^[-+]?\d+/, ''))).filter(x => x >= 0);
            if (unidad === 'semana' && dias.length) r.dias = dias;
            if (unidad === 'mes' && /^\d/.test(p.BYDAY)) r.modo = 'diaSemana';
          }
          if (p.COUNT) r.veces = Number(p.COUNT);
          else if (p.UNTIL) { const x = leeFecha(p.UNTIL, ''); if (x) r.hasta = claveDe(x.f); }
          ev.repite = r;
        }
      }
    }
    return eventos;
  }

  const API = {
    clave, deClave, claveDe, sumaDias, diasEntre, diaSemana,
    minutosDe, horaDe, textoHora, esDeDiaEntero, diasDeMas,
    ocurrencias, eventosEnRango, delDia, reparteColumnas, semanaISO, inicioSemana,
    avisosPendientes, aICS, deICS,
  };
  if (typeof window !== 'undefined') window.CalLogica = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
