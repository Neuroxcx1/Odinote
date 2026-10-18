// Pruebas de la lógica de fechas del calendario.  node scripts/test-calendario-logica.js
//
// Una repetición mal contada no se ve al crearla: se ve meses después, cuando
// falta el evento de un mes con 30 días o el del año bisiesto. Por eso aquí se
// cuentan a mano los casos donde se suele equivocar uno.
const L = require('../src/calendario-logica.js');

let fallos = 0;
const check = (nombre, ok, extra) => {
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${extra ? ' — ' + extra : ''}`);
  if (!ok) fallos++;
};
const F = (y, m, d) => new Date(y, m - 1, d);          // mes de 1 a 12, para leerlo fácil
const K = (y, m, d) => L.clave(y, m - 1, d);           // la clave guardada (mes desde 0)
const dias = (lista) => lista.map(f => `${f.getDate()}/${f.getMonth() + 1}`).join(' ');

// ── Sin repetir ──
check('un evento suelto sale en su día', L.ocurrencias({ id: 'a' }, K(2026, 9, 10), F(2026, 9, 1), F(2026, 9, 30)).length === 1);
check('y no fuera de su mes', L.ocurrencias({ id: 'a' }, K(2026, 9, 10), F(2026, 10, 1), F(2026, 10, 31)).length === 0);
check('uno de varios días se ve aunque empezara antes del rango',
  L.ocurrencias({ id: 'a', fin: K(2026, 10, 2) }, K(2026, 9, 29), F(2026, 10, 1), F(2026, 10, 31)).length === 1);

// ── Cada día ──
const cada2 = L.ocurrencias({ id: 'a', repite: { unidad: 'dia', cada: 2 } }, K(2026, 9, 1), F(2026, 9, 1), F(2026, 9, 9));
check('cada dos días', dias(cada2) === '1/9 3/9 5/9 7/9 9/9', dias(cada2));
// Diez años después: sin el salto contaría diez años día a día, y con un salto
// mal hecho se descuadraría la paridad.
const lejos = L.ocurrencias({ id: 'a', repite: { unidad: 'dia', cada: 2 } }, K(2016, 1, 1), F(2026, 9, 1), F(2026, 9, 6));
const esperado = [1, 2, 3, 4, 5, 6].map(d => F(2026, 9, d)).filter(f => L.diasEntre(F(2016, 1, 1), f) % 2 === 0);
check('cada dos días, diez años después, sigue cayendo en su día', dias(lejos) === dias(esperado), dias(lejos));

// ── Cada semana ──
const lmv = L.ocurrencias({ id: 'a', repite: { unidad: 'semana', cada: 1, dias: [0, 2, 4] } }, K(2026, 9, 7), F(2026, 9, 1), F(2026, 9, 20));
check('lunes, miércoles y viernes', dias(lmv) === '7/9 9/9 11/9 14/9 16/9 18/9', dias(lmv));
const quincenal = L.ocurrencias({ id: 'a', repite: { unidad: 'semana', cada: 2 } }, K(2026, 1, 5), F(2026, 9, 1), F(2026, 9, 30));
const q = [];
for (let f = F(2026, 1, 5); f <= F(2026, 9, 30); f = L.sumaDias(f, 14)) if (f >= F(2026, 9, 1)) q.push(f);
check('cada dos semanas, meses después, en la semana que toca', dias(quincenal) === dias(q), dias(quincenal));
check('sin días elegidos, repite el día de la semana en que empezó',
  L.ocurrencias({ id: 'a', repite: { unidad: 'semana' } }, K(2026, 9, 24), F(2026, 9, 24), F(2026, 10, 8)).every(f => f.getDay() === 4));

// ── Cada mes ──
const el31 = L.ocurrencias({ id: 'a', repite: { unidad: 'mes' } }, K(2026, 1, 31), F(2026, 1, 1), F(2026, 12, 31));
check('el 31 se salta los meses que no tienen 31, como Google', dias(el31) === '31/1 31/3 31/5 31/7 31/8 31/10 31/12', dias(el31));
const cuartoJueves = L.ocurrencias({ id: 'a', repite: { unidad: 'mes', modo: 'diaSemana' } }, K(2026, 9, 24), F(2026, 9, 1), F(2026, 12, 31));
check('el cuarto jueves de cada mes', dias(cuartoJueves) === '24/9 22/10 26/11 24/12', dias(cuartoJueves));

// ── Cada año ──
const bisiesto = L.ocurrencias({ id: 'a', repite: { unidad: 'anio' } }, K(2024, 2, 29), F(2024, 1, 1), F(2032, 12, 31));
check('el 29 de febrero solo los años bisiestos', dias(bisiesto) === '29/2 29/2 29/2', bisiesto.map(f => f.getFullYear()).join(' '));

// ── Cuándo termina ──
const tres = L.ocurrencias({ id: 'a', repite: { unidad: 'dia', veces: 3 } }, K(2026, 9, 1), F(2026, 9, 1), F(2026, 9, 30));
check('tras tres veces se acaba', dias(tres) === '1/9 2/9 3/9', dias(tres));
const tresSinUno = L.ocurrencias({ id: 'a', repite: { unidad: 'dia', veces: 3 }, excepciones: [K(2026, 9, 2)] }, K(2026, 9, 1), F(2026, 9, 1), F(2026, 9, 30));
check('un día borrado cuenta entre las tres veces, como en los .ics', dias(tresSinUno) === '1/9 3/9', dias(tresSinUno));
const hasta = L.ocurrencias({ id: 'a', repite: { unidad: 'dia', hasta: K(2026, 9, 4) } }, K(2026, 9, 1), F(2026, 9, 1), F(2026, 9, 30));
check('hasta un día, ese incluido', dias(hasta) === '1/9 2/9 3/9 4/9', dias(hasta));

// ── Juntos y ordenados ──
const eventos = {
  [K(2026, 9, 24)]: [{ id: 'b', text: 'tarde', hora: '17:00' }, { id: 'c', text: 'mañana', hora: '09:00' }, { id: 'd', text: 'todo el día' }],
  [K(2026, 9, 22)]: [{ id: 'e', text: 'viaje', fin: K(2026, 9, 25) }],
};
const del24 = L.delDia(L.eventosEnRango(eventos, F(2026, 9, 21), F(2026, 9, 27)), F(2026, 9, 24));
check('primero los de día entero (el largo antes), luego por hora',
  del24.map(o => o.ev.text).join(', ') === 'viaje, todo el día, mañana, tarde', del24.map(o => o.ev.text).join(', '));

// ── Los que se pisan ──
const cols = L.reparteColumnas([{ desde: 540, hasta: 600 }, { desde: 570, hasta: 630 }, { desde: 660, hasta: 720 }]);
check('dos que se pisan van en dos columnas', cols[0].cols === 2 && cols[1].cols === 2 && cols[0].col !== cols[1].col);
check('y el que llega después, cuando ya no se pisa, a lo ancho', cols[2].cols === 1 && cols[2].col === 0);

// ── Semanas ──
check('semana ISO del 1 de enero de 2026: la 1', L.semanaISO(F(2026, 1, 1)) === 1);
check('el 1 de enero de 2027, viernes, aún es la 53 de 2026', L.semanaISO(F(2027, 1, 1)) === 53);
check('la semana empieza en lunes', L.inicioSemana(F(2026, 9, 24), 1).getDate() === 21);
check('o en domingo, si se elige', L.inicioSemana(F(2026, 9, 24), 0).getDate() === 20);

// ── Avisos ──
const lienzos = { c1: { items: [{ id: 'cal', type: 'calendar', events: { [K(2026, 9, 24)]: [{ id: 'x', text: 'Dentista', hora: '10:00', avisos: [10] }] } }] } };
check('el aviso de 10 minutos salta a las 9:50',
  L.avisosPendientes(lienzos, new Date(2026, 8, 24, 9, 50, 20), 60000).length === 1);
check('y no a las 9:45', L.avisosPendientes(lienzos, new Date(2026, 8, 24, 9, 45), 60000).length === 0);
check('ni un cuarto de hora tarde', L.avisosPendientes(lienzos, new Date(2026, 8, 24, 10, 5), 60000).length === 0);

// ── .ics ──
const mios = {
  [K(2026, 9, 24)]: [{ id: 'r1', text: 'Clase, de inglés; nivel 2', hora: '18:30', horaFin: '20:00', lugar: 'Academia', notas: 'Llevar\nel libro',
    repite: { unidad: 'semana', cada: 1, dias: [1, 3], veces: 10 }, excepciones: [K(2026, 10, 1)], avisos: [15] }],
  [K(2026, 12, 24)]: [{ id: 'r2', text: 'Vacaciones', fin: K(2027, 1, 6) }],
};
const texto = L.aICS(mios, 'Mi calendario');
check('el .ics lleva un evento por cada uno', (texto.match(/BEGIN:VEVENT/g) || []).length === 2);
check('ninguna línea pasa de 75 caracteres', texto.split('\r\n').every(l => l.length <= 75));
const vuelta = L.deICS(texto);
const r1 = (vuelta[K(2026, 9, 24)] || [])[0] || {};
check('de vuelta: título con comas y punto y coma', r1.text === 'Clase, de inglés; nivel 2', r1.text);
check('las horas', r1.hora === '18:30' && r1.horaFin === '20:00', r1.hora + '-' + r1.horaFin);
check('la repetición', r1.repite && r1.repite.unidad === 'semana' && r1.repite.veces === 10 && r1.repite.dias.join() === '1,3', JSON.stringify(r1.repite));
check('el día borrado', (r1.excepciones || []).join() === K(2026, 10, 1));
check('el lugar, las notas con su salto de línea y el aviso',
  r1.lugar === 'Academia' && r1.notas === 'Llevar\nel libro' && (r1.avisos || []).join() === '15');
const r2 = (vuelta[K(2026, 12, 24)] || [])[0] || {};
check('uno de varios días vuelve con su último día', r2.fin === K(2027, 1, 6) && !r2.hora, r2.fin);

// Uno como los que exporta Google: en UTC, con zona y de día entero.
const google = [
  'BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'DTSTART;VALUE=DATE:20261012', 'DTEND;VALUE=DATE:20261013',
  'SUMMARY:Festivo', 'END:VEVENT', 'BEGIN:VEVENT', 'DTSTART;TZID=Europe/Madrid:20261015T093000',
  'DTEND;TZID=Europe/Madrid:20261015T103000', 'SUMMARY:Reunión', 'RRULE:FREQ=MONTHLY;BYDAY=3TH',
  'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
const g = L.deICS(google);
check('de Google: un día entero de un solo día', (g[K(2026, 10, 12)] || [])[0] && !g[K(2026, 10, 12)][0].fin && !g[K(2026, 10, 12)][0].hora);
const reu = (g[K(2026, 10, 15)] || [])[0] || {};
check('de Google: la hora con zona, tal cual', reu.hora === '09:30' && reu.horaFin === '10:30', reu.hora);
check('de Google: "el tercer jueves de cada mes"', reu.repite && reu.repite.unidad === 'mes' && reu.repite.modo === 'diaSemana');

// ── El título de un evento ──
// El proyecto de ejemplo (odinote-showcase-demo.json) guarda los títulos como
// { es, en }. Pintar el objeto tal cual tumbaba el nodo entero (error 31 de
// React) en cuanto uno caía en un día a la vista.
const T = L.textoEvento;
check('una cadena sale tal cual', T({ text: 'Dentista' }, 'fr') === 'Dentista');
check('sin título, cadena vacía (y no "undefined")', T({ id: 'a' }, 'es') === '' && T(null, 'es') === '' && T({ text: null }, 'es') === '');
const bilingue = { id: 'e-demo0018', text: { es: 'Prueba de juego', en: 'Playtest #4' } };
check('{ es, en } en español: el español', T(bilingue, 'es') === 'Prueba de juego');
check('{ es, en } en inglés: el inglés', T(bilingue, 'en') === 'Playtest #4');
check('en otro idioma sin su texto: el inglés antes que el español', T(bilingue, 'fr') === 'Playtest #4');
check('si el inglés está vacío, el español', T({ text: { es: 'Rodaje', en: '' } }, 'de') === 'Rodaje');
check('el idioma de la app si lo tiene', T({ text: { es: 'Rodaje', en: 'Shoot', fr: 'Tournage' } }, 'fr') === 'Tournage');
check('solo en otro idioma: ese, mejor que nada', T({ text: { ja: '撮影' } }, 'es') === '撮影');
check('un objeto vacío o raro da cadena vacía', T({ text: {} }, 'es') === '' && T({ text: { es: 3 } }, 'es') === '');
check('un número se vuelve texto', T({ text: 42 }, 'es') === '42');
// Sin idioma, como lo llama alguien que no lo sabe: no puede romper.
check('sin idioma: el inglés', T(bilingue) === 'Playtest #4');
check('siempre devuelve una cadena', [bilingue, { text: {} }, {}, null, { text: 5 }].every(ev => typeof T(ev, 'es') === 'string'));

// Los eventos del proyecto de ejemplo, con sus claves de verdad (mes desde 0:
// "2026-7-6" es el 6 de AGOSTO). Se ven en agosto y se ordenan sin tropezar.
const demo = {
  '2026-7-6': [{ id: 'e-demo0018', text: { es: 'Playtest #4', en: 'Playtest #4' } }],
  '2026-7-9': [{ id: 'e-demo0019', text: { es: 'Shoot day 1', en: 'Shoot day 1' } }],
  '2026-7-28': [{ id: 'e-demo0023', text: { es: 'Trailer lock', en: 'Trailer lock' } }],
};
const agosto = L.eventosEnRango(demo, F(2026, 8, 1), F(2026, 8, 31));
check('los del ejemplo salen en agosto de 2026', agosto.length === 3, agosto.length);
const titulosAgosto = agosto.map(o => T(o.ev, 'es')).join(', ');
check('y sus títulos se leen como texto', titulosAgosto === 'Playtest #4, Shoot day 1, Trailer lock', titulosAgosto);

// El .ics con títulos { es, en }: antes escribía "SUMMARY:[object Object]".
const icsDemo = L.aICS({ [K(2026, 8, 6)]: [{ id: 'b1', text: { es: 'Revisión', en: 'Review' }, hora: '10:00', avisos: [10] }] }, 'Demo', 'en');
check('el .ics no escribe "[object Object]"', !/object Object/.test(icsDemo));
check('el .ics lleva el título en el idioma pedido', /SUMMARY:Review\r\n/.test(icsDemo));
check('y el aviso, el mismo título', /DESCRIPTION:Review\r\n/.test(icsDemo));
check('y de vuelta llega como cadena', (L.deICS(icsDemo)[K(2026, 8, 6)] || [])[0].text === 'Review');
check('en español, el título español', /SUMMARY:Revisi/.test(L.aICS({ [K(2026, 8, 6)]: [{ id: 'b1', text: { es: 'Revisión', en: 'Review' } }] }, '', 'es')));

console.log(fallos ? `\n${fallos} FALLOS` : '\nTodo en orden.');
process.exit(fallos ? 1 : 0);
