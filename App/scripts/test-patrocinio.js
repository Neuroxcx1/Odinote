// =====================================================
// Odinote — pruebas de src/patrocinio.js (la corona de patrocinador).
//
//   node scripts/test-patrocinio.js
//
// La pregunta que importa aquí no es "¿sabe leer la lista?" sino "¿en qué
// casos se le quita la corona a alguien que la ha pagado?". Un fallo de red,
// un bloqueador de anuncios o un avión no son respuestas, y ninguno de ellos
// debe apagarla. El único que puede apagarla es Firestore diciendo que no.
//
// El otro frente es el contrario: que la corona NO se quede pegada al equipo.
// Es de una cuenta. Si alguien cierra sesión y entra otro en ese ordenador, el
// segundo no hereda nada.
// =====================================================

const path = require('path');
const P = require(path.join(__dirname, '..', 'src', 'patrocinio.js'));

let fallos = 0;
const check = (nombre, ok, extra) => {
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${extra ? ' — ' + extra : ''}`);
  if (!ok) fallos++;
};

// ── Los dobles ──

// Un localStorage de mentira, que además deja mirar qué quedó escrito.
function almacenFalso(inicial) {
  const datos = Object.assign({}, inicial || {});
  return {
    getItem: (k) => (k in datos ? datos[k] : null),
    setItem: (k, v) => { datos[k] = String(v); },
    removeItem: (k) => { delete datos[k]; },
    _datos: datos,
  };
}

// Un Firebase de mentira. `consultas` cuenta las veces que se ha ido a la red,
// que es como se comprueba que el recuerdo evita preguntas de más.
function firebaseFalso({ correo, anonimo, existe, falla }) {
  const consultas = { n: 0, ultimaRuta: null };
  const api = {
    auth: () => ({
      currentUser: correo ? { email: correo, isAnonymous: !!anonimo } : null,
    }),
    firestore: () => ({
      collection: (col) => ({
        doc: (id) => ({
          get: () => {
            consultas.n++;
            consultas.ultimaRuta = col + '/' + id;
            return falla
              ? Promise.reject({ code: 'unavailable' })
              : Promise.resolve({ exists: !!existe });
          },
        }),
      }),
    }),
  };
  api._consultas = consultas;
  return api;
}

// Lo que deja escrito un arranque anterior que salió bien.
const recuerdo = (correo, activo, edadMs, avisado) => ({
  'odinote.patrocinio.v1': JSON.stringify({
    correo,
    activo,
    comprobadoEn: Date.now() - (edadMs || 0),
    avisado: !!avisado,
  }),
});

const sinRuido = async (fn) => {
  const antes = console.warn;
  console.warn = () => {};
  try { return await fn(); } finally { console.warn = antes; }
};

async function main() {

  // ── Lo que se sabe sin preguntar a nadie ──
  {
    global.localStorage = almacenFalso(recuerdo('ana@gmail.com', true));
    global.firebase = firebaseFalso({ correo: 'ana@gmail.com', existe: true });

    check('la corona sale antes de preguntar nada, con lo del último arranque',
      P.activo() === true);

    check('el correo se compara en minúsculas, no como lo escribiera en PayPal',
      P.activo('ANA@Gmail.com ') === true);
  }

  // ── La corona es de la cuenta, no del ordenador ──
  {
    global.localStorage = almacenFalso(recuerdo('ana@gmail.com', true));
    global.firebase = firebaseFalso({ correo: 'luis@gmail.com', existe: false });

    check('el siguiente que entre en este equipo NO hereda la corona',
      P.activo() === false);

    global.localStorage = almacenFalso(recuerdo('ana@gmail.com', true));
    P.olvida();
    check('cerrar sesión borra el recuerdo',
      global.localStorage.getItem('odinote.patrocinio.v1') === null);
  }

  // ── Sin cuenta de Google no hay nada que consultar ──
  {
    global.localStorage = almacenFalso(recuerdo('ana@gmail.com', true));
    global.firebase = firebaseFalso({ correo: 'ana@gmail.com', anonimo: true, existe: true });

    check('una sesión anónima (la de entrar en una sala sin cuenta) no da corona',
      (await P.comprueba()) === false);
    check('y ni siquiera va a preguntar: no tiene correo por el que preguntar',
      global.firebase._consultas.n === 0);

    global.firebase = firebaseFalso({ correo: null, existe: true });
    check('sin sesión ninguna, tampoco', (await P.comprueba()) === false);
  }

  // ── El caso que da sentido a todo esto: el avión ──
  {
    global.localStorage = almacenFalso(recuerdo('ana@gmail.com', true, 48 * 60 * 60 * 1000));
    global.firebase = firebaseFalso({ correo: 'ana@gmail.com', falla: true });

    const sigue = await sinRuido(() => P.comprueba());
    check('sin línea, quien ya tenía la corona la conserva', sigue === true);
    check('y el recuerdo se queda intacto, no se sobrescribe con un "no"',
      JSON.parse(global.localStorage._datos['odinote.patrocinio.v1']).activo === true);
  }

  {
    global.localStorage = almacenFalso({});
    global.firebase = firebaseFalso({ correo: 'nuevo@gmail.com', falla: true });
    check('sin línea y sin recuerdo previo, no se inventa una corona',
      (await sinRuido(() => P.comprueba())) === false);
  }

  // ── Firestore es el único que puede quitarla ──
  {
    global.localStorage = almacenFalso(recuerdo('ana@gmail.com', true, 48 * 60 * 60 * 1000));
    global.firebase = firebaseFalso({ correo: 'ana@gmail.com', existe: false });

    check('si Firestore dice que ya no está, la corona se apaga',
      (await P.comprueba()) === false);
    check('se pregunta por el documento correcto',
      global.firebase._consultas.ultimaRuta === 'patrocinadores/ana@gmail.com',
      global.firebase._consultas.ultimaRuta);
  }

  // ── No gastar cuota preguntando lo que ya se sabe ──
  {
    global.localStorage = almacenFalso(recuerdo('ana@gmail.com', true, 60 * 1000));
    global.firebase = firebaseFalso({ correo: 'ana@gmail.com', existe: true });

    check('con una respuesta de hace un minuto, se responde de memoria',
      (await P.comprueba()) === true);
    check('y no se toca la red', global.firebase._consultas.n === 0);

    check('forzando, sí se pregunta', (await P.comprueba({ forzar: true })) === true);
    check('y esta vez sí se ha ido a la red', global.firebase._consultas.n === 1);
  }

  {
    global.localStorage = almacenFalso(recuerdo('ana@gmail.com', true, 48 * 60 * 60 * 1000));
    global.firebase = firebaseFalso({ correo: 'ana@gmail.com', existe: true });
    await P.comprueba();
    check('pasado un día se vuelve a preguntar', global.firebase._consultas.n === 1);
  }

  // ── El que acaba de pagar: un "no" caduca enseguida ──
  //
  // Si un no durase lo mismo que un sí, quien dona hoy podría no ver la corona
  // hasta mañana. Es justo el momento en el que peor sienta, así que un no vale
  // un cuarto de hora y no un día.
  {
    global.localStorage = almacenFalso(recuerdo('ana@gmail.com', false, 30 * 60 * 1000));
    global.firebase = firebaseFalso({ correo: 'ana@gmail.com', existe: true });
    check('un "no" de hace media hora se vuelve a preguntar (acaba de donar)',
      (await P.comprueba()) === true);
    check('y esta vez fue a la red', global.firebase._consultas.n === 1);
  }

  {
    global.localStorage = almacenFalso(recuerdo('ana@gmail.com', false, 5 * 60 * 1000));
    global.firebase = firebaseFalso({ correo: 'ana@gmail.com', existe: true });
    check('un "no" de hace cinco minutos todavía vale, no se pregunta',
      (await P.comprueba()) === false);
    check('y no se tocó la red', global.firebase._consultas.n === 0);
  }

  {
    global.localStorage = almacenFalso(recuerdo('ana@gmail.com', true, 30 * 60 * 1000));
    global.firebase = firebaseFalso({ correo: 'ana@gmail.com', existe: true });
    check('en cambio un "sí" de hace media hora NO se vuelve a preguntar',
      (await P.comprueba()) === true);
    check('quien ya tiene la corona no gasta cuota cada rato', global.firebase._consultas.n === 0);
  }

  // ── Las gracias se dan una vez, no en cada arranque ──
  {
    global.localStorage = almacenFalso({});
    global.firebase = firebaseFalso({ correo: 'ana@gmail.com', existe: true });

    await P.comprueba();
    check('la primera vez que aparece la corona, hay que dar las gracias',
      P.esNuevo() === true);

    P.marcaAvisado();
    check('ya dadas, no se repiten', P.esNuevo() === false);

    // Otro arranque al día siguiente, con la misma cuenta y el mismo sí.
    const viejo = JSON.parse(global.localStorage._datos['odinote.patrocinio.v1']);
    viejo.comprobadoEn = Date.now() - 48 * 60 * 60 * 1000;
    global.localStorage._datos['odinote.patrocinio.v1'] = JSON.stringify(viejo);

    await P.comprueba();
    check('ni al día siguiente, aunque se vuelva a consultar',
      P.esNuevo() === false);
  }

  {
    // Se fue de la lista y volvió: eso sí merece las gracias otra vez.
    global.localStorage = almacenFalso(recuerdo('ana@gmail.com', false, 48 * 60 * 60 * 1000, true));
    global.firebase = firebaseFalso({ correo: 'ana@gmail.com', existe: true });
    await P.comprueba();
    check('quien vuelve a la lista después de salir, recibe las gracias de nuevo',
      P.esNuevo() === true);
  }

  // ── Que nada de esto reviente donde no hay dónde guardar ──
  {
    delete global.localStorage;
    global.firebase = firebaseFalso({ correo: 'ana@gmail.com', existe: true });
    check('sin localStorage (modo privado), no se cae', P.activo() === false);
    check('y la consulta sigue funcionando', (await P.comprueba()) === true);
    P.olvida();
    P.marcaAvisado();
    check('olvidar y marcar tampoco se caen sin almacén', true);
  }

  console.log('');
  console.log(fallos === 0 ? 'Todo en orden.' : fallos + ' fallo(s).');
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('La prueba se rompió:', err);
  process.exit(1);
});
