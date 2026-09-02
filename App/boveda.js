// =====================================================
// Oddinote — cómo se reparte la bóveda en carpetas
//
// Hasta ahora la bóveda era un montón: un `odinote.json` con todo dentro, una
// carpeta `projects/<id>/` con nombres que no dicen nada, y un único `media/`
// donde caían las imágenes de TODOS los proyectos mezcladas. Quinientos
// archivos con nombres como `media_it-1788381436906-1423_f567…png` y ninguna
// forma de saber cuál es de qué.
//
// Ahora cada proyecto tiene su carpeta, con su nombre:
//
//   Oddinote/
//     Diana/
//       project.json
//       media/
//     Aurora Studio/
//       project.json
//       media/
//     odinote.json        ← la red de seguridad, se sigue escribiendo
//     media/              ← lo de antes, que se queda donde está
//
// Este archivo no toca el disco ni sabe de Electron: solo decide nombres y
// rutas. Por eso se puede probar entero con `node scripts/test-boveda.js`, que
// es la única forma de estar seguro de algo que mueve los datos de la gente.
// =====================================================

(function () {
  'use strict';

  // Lo que Windows no admite en el nombre de una carpeta, más los nombres que
  // tiene reservados desde MS-DOS. Un proyecto llamado "CON" o "PRN" no puede
  // tener carpeta propia, por absurdo que suene en 2026.
  var PROHIBIDOS = /[<>:"/\\|?*\u0000-\u001F]/g;
  var RESERVADOS = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
  var LARGO_MAX = 60;

  // El nombre de un proyecto puede venir en varios idiomas ({es, en}) o suelto.
  function nombreLegible(proyecto, idioma) {
    if (!proyecto) return '';
    var n = proyecto.name;
    if (typeof n === 'string') return n;
    if (n && typeof n === 'object') {
      return n[idioma || 'es'] || n.es || n.en || Object.values(n)[0] || '';
    }
    return '';
  }

  // De un nombre a algo que Windows acepte como carpeta, sin perder el acento
  // ni el espacio: "Aurora Studio — Showcase" sigue siendo legible de un
  // vistazo, que es de lo que va todo esto.
  function saneaNombre(nombre) {
    var limpio = String(nombre == null ? '' : nombre)
      .replace(PROHIBIDOS, '-')
      .replace(/\s+/g, ' ')
      .trim();

    // Windows no deja terminar en punto ni en espacio: la carpeta se crea pero
    // luego no se puede abrir ni borrar con el explorador.
    limpio = limpio.replace(/[. ]+$/, '');

    if (limpio.length > LARGO_MAX) limpio = limpio.slice(0, LARGO_MAX).replace(/[. ]+$/, '');
    if (!limpio) return '';
    if (RESERVADOS.test(limpio)) return limpio + '-';
    return limpio;
  }

  // El trozo de identificador que se añade cuando dos proyectos se llaman
  // igual. Corto para que la carpeta siga leyéndose, y del final del id porque
  // es la parte que cambia (los identificadores empiezan todos por "proj-").
  function colilla(id) {
    var texto = String(id == null ? '' : id).replace(/[^a-zA-Z0-9]/g, '');
    return texto.slice(-4) || 'x';
  }

  // La carpeta de cada proyecto, para una lista entera de proyectos.
  //
  // Devuelve un mapa id → carpeta. Dos proyectos con el mismo nombre no pueden
  // compartir carpeta —se pisarían el json y las imágenes—, así que al segundo
  // se le añade su colilla. Al PRIMERO no: quien tiene un solo "Diana" no tiene
  // por qué ver "Diana (1423)".
  //
  // El orden de la lista manda, y eso es a propósito: es el mismo orden en que
  // la aplicación los guarda, así que la carpeta de un proyecto no cambia sola
  // entre dos arranques.
  function carpetasDeProyectos(proyectos, idioma) {
    var mapa = {};
    var usadas = {};
    (proyectos || []).forEach(function (p) {
      if (!p || !p.id) return;
      var base = saneaNombre(nombreLegible(p, idioma));
      if (!base) base = 'Proyecto ' + colilla(p.id);
      var candidata = base;
      if (Object.prototype.hasOwnProperty.call(usadas, candidata.toLowerCase())) {
        candidata = base + ' (' + colilla(p.id) + ')';
        // Y si hasta eso choca —dos proyectos con el mismo nombre y el mismo
        // final de identificador—, se numera hasta encontrar hueco.
        var n = 2;
        while (Object.prototype.hasOwnProperty.call(usadas, candidata.toLowerCase())) {
          candidata = base + ' (' + colilla(p.id) + '-' + n + ')';
          n++;
        }
      }
      usadas[candidata.toLowerCase()] = true;
      mapa[p.id] = candidata;
    });
    return mapa;
  }

  // ── Dónde está el archivo de un nodo ──
  //
  // Un nodo guarda su medio de tres formas, según cuándo se añadió:
  //
  //   · 'media/foto.png'                         ← el nuevo, dentro del proyecto
  //   · 'file:///D:/…/Oddinote/media/foto.png'   ← el viejo, absoluto
  //   · '/vault-media/…'                         ← ya resuelto para la pantalla
  //
  // Esto devuelve la ruta RELATIVA a la bóveda, que es lo que sabe resolver
  // tanto el servidor interno como el botón de abrir la carpeta. Con carpeta de
  // proyecto se busca dentro de ella; sin ella, en el montón de siempre.
  function relativoEnBoveda(src, carpeta) {
    if (typeof src !== 'string' || !src.trim()) return null;
    if (src.indexOf('data:') === 0 || /^https?:/.test(src)) return null;

    var s = src;
    if (s.indexOf('/vault-media/') === 0) return s.slice('/vault-media/'.length);

    if (s.indexOf('file:///') === 0) {
      // Una ruta absoluta es SIEMPRE de las de antes: lo nuevo se guarda
      // relativo. Y de ella solo interesa el final —la bóveda pudo haberse
      // movido de sitio—, pero del texto no se puede saber si el trozo
      // anterior a 'media' es una carpeta de proyecto o el nombre de la
      // propia bóveda. Así que se devuelve el montón de siempre, y quien
      // busque el archivo probará además dentro de la carpeta del proyecto.
      var m = s.match(/media\/[^/]+$/i);
      if (m) return decodeURI(m[0]);
      return null;
    }
    if (s.indexOf('media/') === 0) {
      return carpeta ? carpeta + '/' + s : s;
    }

    // 'Diana/media/foto.png' tal cual.
    if (/^[^/]+\/media\/[^/]+$/.test(s)) return s;

    return null;
  }

  // ══════════════════════════════════════════════════════════
  // Lo que toca el disco
  // ══════════════════════════════════════════════════════════
  //
  // Recibe `io` con { fs, path, log } en vez de pedirlos por su cuenta. No es
  // ceremonia: es lo que permite probar contra una carpeta temporal de verdad
  // —con sus renombrados y sus borrados— sin levantar Electron, y esto borra
  // carpetas de datos de la gente, así que probarlo no es opcional.

  // Los lienzos de un proyecto: su raíz y los tableros anidados, que se
  // alcanzan siguiendo el canvasId de cada nodo "board".
  function canvasesDeProyecto(todos, raiz) {
    var fuera = {};
    var visita = function (id) {
      var c = todos[id];
      if (!c || fuera[id]) return;
      fuera[id] = c;
      (c.items || []).forEach(function (it) { if (it.canvasId) visita(it.canvasId); });
    };
    visita(raiz);
    return fuera;
  }

  // Las carpetas de proyecto que ya hay, con el identificador que lleva cada
  // una dentro. Es lo que permite reconocer un proyecto renombrado: la carpeta
  // se llama distinto, pero el identificador es el mismo.
  function carpetasConProyecto(io, folderPath) {
    var fuera = [];
    var entradas;
    try {
      entradas = io.fs.readdirSync(folderPath, { withFileTypes: true });
    } catch (err) {
      return fuera;
    }
    entradas.forEach(function (entrada) {
      if (!entrada.isDirectory()) return;
      var archivo = io.path.join(folderPath, entrada.name, 'project.json');
      if (!io.fs.existsSync(archivo)) return;
      try {
        var leido = JSON.parse(io.fs.readFileSync(archivo, 'utf-8'));
        var id = leido && leido.project && leido.project.id;
        if (id) fuera.push({ carpeta: entrada.name, id: id });
      } catch (err) {
        io.log && io.log('bóveda: ' + entrada.name + '/project.json ilegible (' + err.message + ')');
      }
    });
    return fuera;
  }

  // Junta los proyectos de todas esas carpetas.
  function leeCarpetas(io, folderPath) {
    var proyectos = [];
    var canvases = {};
    var meta = {};
    carpetasConProyecto(io, folderPath).forEach(function (c) {
      var archivo = io.path.join(folderPath, c.carpeta, 'project.json');
      try {
        var leido = JSON.parse(io.fs.readFileSync(archivo, 'utf-8'));
        if (leido.project) proyectos.push(leido.project);
        Object.assign(canvases, leido.canvases || {});
        if (leido.meta) meta = leido.meta;
      } catch (err) {
        // Un proyecto ilegible ya no se lleva a los demás por delante.
        io.log && io.log('read-vault: ' + c.carpeta + '/project.json ilegible (' + err.message + '), se omite');
      }
    });
    if (!proyectos.length) return null;
    return Object.assign({}, meta, { projects: proyectos, canvases: canvases });
  }

  // El reparto ANTERIOR, en projects/<id>/. Se sigue leyendo para que quien
  // actualice desde una versión de antes no vea la bóveda vacía; ya no se
  // escribe: lo que se escribe ahora son las carpetas con nombre.
  function leeRepartoAnterior(io, folderPath) {
    var dir = io.path.join(folderPath, 'projects');
    if (!io.fs.existsSync(dir)) return null;
    var proyectos = [];
    var canvases = {};
    var meta = {};
    io.fs.readdirSync(dir).forEach(function (entrada) {
      var archivo = io.path.join(dir, entrada, 'project.json');
      if (!io.fs.existsSync(archivo)) return;
      try {
        var leido = JSON.parse(io.fs.readFileSync(archivo, 'utf-8'));
        if (leido.project) proyectos.push(leido.project);
        Object.assign(canvases, leido.canvases || {});
        if (leido.meta) meta = leido.meta;
      } catch (err) {
        io.log && io.log('read-vault: projects/' + entrada + '/project.json ilegible (' + err.message + '), se omite');
      }
    });
    if (!proyectos.length) return null;
    return Object.assign({}, meta, { projects: proyectos, canvases: canvases });
  }

  // Escribe una carpeta por proyecto: renombra las que cambiaron de nombre,
  // guarda cada json, y retira las de los proyectos borrados.
  function escribeCarpetas(io, folderPath, data, mapa) {
    var datos = data || {};
    var proyectos = datos.projects || [];
    var canvases = datos.canvases || {};
    var meta = {};
    Object.keys(datos).forEach(function (k) {
      if (k !== 'projects' && k !== 'canvases') meta[k] = datos[k];
    });
    var carpetas = mapa || carpetasDeProyectos(proyectos);
    var hecho = { escritos: [], renombrados: [], retirados: [] };

    // 1. Un proyecto renombrado no empieza una carpeta nueva: se le MUEVE la
    // suya, con su json y sus imágenes dentro. Se reconoce por el identificador
    // de su project.json, no por el nombre.
    carpetasConProyecto(io, folderPath).forEach(function (c) {
      var quiere = carpetas[c.id];
      if (!quiere || quiere === c.carpeta) return;
      var de = io.path.join(folderPath, c.carpeta);
      var a = io.path.join(folderPath, quiere);
      if (io.fs.existsSync(a)) return; // ocupada: se deja como está, sin pisar nada
      try {
        io.fs.renameSync(de, a);
        hecho.renombrados.push([c.carpeta, quiere]);
        io.log && io.log('write-vault: "' + c.carpeta + '" pasa a llamarse "' + quiere + '"');
      } catch (err) {
        io.log && io.log('write-vault: no se pudo renombrar "' + c.carpeta + '" (' + err.message + ')');
      }
    });

    // 2. Cada proyecto, en la suya.
    var vivas = {};
    proyectos.forEach(function (proyecto) {
      if (!proyecto || !proyecto.id) return;
      var carpeta = carpetas[proyecto.id];
      if (!carpeta) return;
      vivas[carpeta] = true;
      var dir = io.path.join(folderPath, carpeta);
      io.fs.mkdirSync(dir, { recursive: true });
      var carga = { meta: meta, project: proyecto, canvases: canvasesDeProyecto(canvases, proyecto.id) };
      // Escritura atómica: a un temporal y luego renombrar. Si se corta la
      // corriente a media escritura, el project.json anterior sigue entero en
      // vez de quedarse truncado.
      var tmp = io.path.join(dir, 'project.json.tmp');
      io.fs.writeFileSync(tmp, JSON.stringify(carga, null, 2), 'utf-8');
      io.fs.renameSync(tmp, io.path.join(dir, 'project.json'));
      hecho.escritos.push(carpeta);
    });

    // 3. Las carpetas de proyectos que ya no existen. Se retiran SOLO si llevan
    // un project.json nuestro y su identificador no está en la lista: una
    // carpeta cualquiera que alguien haya dejado ahí no se toca jamás.
    var ids = {};
    proyectos.forEach(function (p) { if (p && p.id) ids[p.id] = true; });
    carpetasConProyecto(io, folderPath).forEach(function (c) {
      if (vivas[c.carpeta] || ids[c.id]) return;
      io.fs.rmSync(io.path.join(folderPath, c.carpeta), { recursive: true, force: true });
      hecho.retirados.push(c.carpeta);
      io.log && io.log('write-vault: retirada la carpeta del proyecto eliminado "' + c.carpeta + '"');
    });

    return hecho;
  }

  var Boveda = {
    saneaNombre: saneaNombre,
    nombreLegible: nombreLegible,
    carpetasDeProyectos: carpetasDeProyectos,
    relativoEnBoveda: relativoEnBoveda,
    canvasesDeProyecto: canvasesDeProyecto,
    carpetasConProyecto: carpetasConProyecto,
    leeCarpetas: leeCarpetas,
    leeRepartoAnterior: leeRepartoAnterior,
    escribeCarpetas: escribeCarpetas,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Boveda;
  if (typeof window !== 'undefined') window.Boveda = Boveda;
})();
