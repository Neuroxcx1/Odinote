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
  // Si dos carpetas dicen ser el mismo proyecto (un «gemelo»: lo encontró un
  // bot de pruebas al renombrar, al borrar uno de dos proyectos con el mismo
  // nombre o al pasar un tablero a proyecto), se queda la que se escribió la
  // última. Antes se leían las dos: el proyecto salía repetido y, según el
  // orden, con la versión vieja encima de la nueva.
  function sinGemelos(io, folderPath, carpetas) {
    var porId = {};
    carpetas.forEach(function (c) {
      var t = 0;
      try { t = io.fs.statSync(io.path.join(folderPath, c.carpeta, 'project.json')).mtimeMs || 0; } catch (err) {}
      var otra = porId[c.id];
      if (!otra || t > otra.t) {
        if (otra) io.log && io.log('read-vault: "' + otra.c.carpeta + '" y "' + c.carpeta + '" son el mismo proyecto; se usa "' + c.carpeta + '", la más reciente');
        porId[c.id] = { c: c, t: t };
      } else {
        io.log && io.log('read-vault: "' + c.carpeta + '" y "' + otra.c.carpeta + '" son el mismo proyecto; se usa "' + otra.c.carpeta + '", la más reciente');
      }
    });
    return carpetas.filter(function (c) { return porId[c.id] && porId[c.id].c === c; });
  }

  function leeCarpetas(io, folderPath) {
    var proyectos = [];
    var canvases = {};
    var meta = {};
    sinGemelos(io, folderPath, carpetasConProyecto(io, folderPath)).forEach(function (c) {
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

  // ── Los archivos de medios que usa un proyecto ──
  // Los nombres (sin el 'media/' de delante) de todo lo que sus nodos guardan
  // relativo a su carpeta: imágenes, archivos, hijos de columna y fotos de
  // galería.
  function mediosDeLienzos(canvases) {
    var fuera = {};
    var mira = function (n) {
      if (!n || typeof n !== 'object') return;
      ['src', 'srcLocal'].forEach(function (k) {
        var s = n[k];
        if (typeof s !== 'string' || s.indexOf('media/') !== 0) return;
        var nombre = s.slice('media/'.length);
        // Solo un nombre de archivo, nada de subir de carpeta.
        if (!nombre || /[\\/]|\.\./.test(nombre)) return;
        fuera[nombre] = true;
      });
      (Array.isArray(n.children) ? n.children : []).forEach(mira);
      (Array.isArray(n.fotos) ? n.fotos : []).forEach(mira);
    };
    Object.keys(canvases || {}).forEach(function (cid) {
      var c = canvases[cid];
      (c && Array.isArray(c.items) ? c.items : []).forEach(mira);
    });
    return Object.keys(fuera);
  }

  // ── Dónde está de verdad un archivo de medios ──
  // Primero donde dice (la carpeta de su proyecto), luego en el montón de
  // siempre ('media' en la raíz) y, si no, en la carpeta de cualquier otro
  // proyecto. Lo último es lo que hace que no se rompa una imagen que acabó en
  // otra carpeta: la de un tablero convertido en proyecto (su carpeta nueva
  // aún no tenía nada), o una copiada de un proyecto a otro. Los nombres llevan
  // una huella del contenido, así que dos archivos distintos no se llaman igual.
  // relativo: 'Diana/media/foto.png' o 'media/foto.png'. Devuelve la ruta o null.
  function buscaMedio(io, folderPath, relativo) {
    if (!relativo || /\.\./.test(relativo)) return null;
    var directa = io.path.join(folderPath, relativo);
    if (io.fs.existsSync(directa)) return directa;
    var cola = String(relativo).match(/media\/([^/]+)$/i);
    if (!cola) return null;
    var monton = io.path.join(folderPath, 'media', cola[1]);
    if (io.fs.existsSync(monton)) return monton;
    var entradas;
    try { entradas = io.fs.readdirSync(folderPath, { withFileTypes: true }); } catch (err) { return null; }
    for (var i = 0; i < entradas.length; i++) {
      if (!entradas[i].isDirectory() || entradas[i].name === 'media') continue;
      var otra = io.path.join(folderPath, entradas[i].name, 'media', cola[1]);
      if (io.fs.existsSync(otra)) return otra;
    }
    return null;
  }

  // Trae a la carpeta de un proyecto los archivos que usa y no tiene, desde la
  // carpeta de otro proyecto. Del montón de siempre no se copia: de ahí el
  // servidor ya los sirve, y copiar la historia entera de golpe llenaría el
  // disco a quien actualice. Devuelve cuántos trajo.
  function reparaMedios(io, folderPath, carpeta, canvases) {
    var dir = io.path.join(folderPath, carpeta, 'media');
    var traidos = 0;
    mediosDeLienzos(canvases).forEach(function (nombre) {
      var destino = io.path.join(dir, nombre);
      if (io.fs.existsSync(destino)) return;
      if (io.fs.existsSync(io.path.join(folderPath, 'media', nombre))) return;
      var origen = buscaMedio(io, folderPath, carpeta + '/media/' + nombre);
      if (!origen) return;
      try {
        io.fs.mkdirSync(dir, { recursive: true });
        io.fs.copyFileSync(origen, destino);
        traidos++;
        io.log && io.log('write-vault: "' + carpeta + '" trae ' + nombre + ' de otra carpeta');
      } catch (err) {
        io.log && io.log('write-vault: no se pudo traer ' + nombre + ' a "' + carpeta + '" (' + err.message + ')');
      }
    });
    return traidos;
  }

  // ── Retirar una carpeta ──
  // Nunca se borra: se mueve a .retirados, dentro de la propia bóveda, con la
  // fecha. Un bot de pruebas encontró que un odinote.json cortado acababa con
  // la app guardando una lista vacía, y el borrado de entonces (rmSync) se
  // llevaba TODAS las carpetas de proyectos con sus imágenes, sin papelera.
  // Desde aquí se pueden recuperar a mano. Lo que lleva allí más de 30 días
  // sí se borra: eran proyectos que la persona eliminó a propósito.
  var RETIRADOS = '.retirados';
  function retira(io, folderPath, carpeta) {
    var destino = io.path.join(folderPath, RETIRADOS);
    io.fs.mkdirSync(destino, { recursive: true });
    var sello = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    var nombre = carpeta + ' (' + sello + ')';
    var n = 2;
    while (io.fs.existsSync(io.path.join(destino, nombre))) nombre = carpeta + ' (' + sello + '-' + (n++) + ')';
    io.fs.renameSync(io.path.join(folderPath, carpeta), io.path.join(destino, nombre));
    return nombre;
  }
  function limpiaRetirados(io, folderPath, ahora) {
    var dir = io.path.join(folderPath, RETIRADOS);
    var entradas;
    try { entradas = io.fs.readdirSync(dir, { withFileTypes: true }); } catch (err) { return 0; }
    var limite = (ahora || Date.now()) - 30 * 24 * 3600 * 1000;
    var quitados = 0;
    entradas.forEach(function (e) {
      if (!e.isDirectory()) return;
      var ruta = io.path.join(dir, e.name);
      try {
        if (io.fs.statSync(ruta).mtimeMs < limite) {
          io.fs.rmSync(ruta, { recursive: true, force: true });
          quitados++;
        }
      } catch (err) {}
    });
    return quitados;
  }

  // Escribe una carpeta por proyecto: retira las de los proyectos borrados,
  // renombra las que cambiaron de nombre, guarda cada json y retira las copias
  // viejas de un mismo proyecto.
  // Lo último que se escribió en cada project.json: su proyecto y sus lienzos
  // (sin la vista, el idioma y el tema, que cambian con solo moverse y que se
  // leen de odinote.json), con el tamaño y la fecha del archivo que quedó. Si
  // no ha cambiado nada y el archivo sigue siendo el que se dejó, no se
  // vuelve a escribir: antes cada guardado reescribía todos los proyectos.
  // Vive en memoria: al abrir la app, el primer guardado escribe todo.
  var yaEscrito = {};
  function sigueIgual(io, ruta, firma) {
    var antes = yaEscrito[ruta];
    if (!antes || antes.firma !== firma) return false;
    try {
      var st = io.fs.statSync(ruta);
      return st.size === antes.size && st.mtimeMs === antes.mtimeMs;
    } catch (e) { return false; }
  }
  function apuntaEscrito(io, ruta, firma) {
    try { var st = io.fs.statSync(ruta); yaEscrito[ruta] = { firma: firma, size: st.size, mtimeMs: st.mtimeMs }; }
    catch (e) { delete yaEscrito[ruta]; }
  }

  function escribeCarpetas(io, folderPath, data, mapa) {
    var datos = data || {};
    var proyectos = datos.projects || [];
    var canvases = datos.canvases || {};
    var meta = {};
    Object.keys(datos).forEach(function (k) {
      if (k !== 'projects' && k !== 'canvases') meta[k] = datos[k];
    });
    var carpetas = mapa || carpetasDeProyectos(proyectos);
    var hecho = { escritos: [], iguales: [], renombrados: [], retirados: [], traidos: 0 };
    var ids = {};
    proyectos.forEach(function (p) { if (p && p.id) ids[p.id] = true; });

    // 0. Primero se retiran las carpetas de los proyectos que ya no existen,
    // para que su nombre quede libre ANTES de renombrar: si no, un proyecto que
    // recupera el nombre de uno borrado no podía mudarse a esa carpeta y se
    // escribía en ella dejando su carpeta de antes viva (los «gemelos»).
    // Una lista sin ningún proyecto no retira nada: es mucho más probable que
    // venga de una lectura fallida que de que se hayan borrado todos.
    if (proyectos.length) {
      carpetasConProyecto(io, folderPath).forEach(function (c) {
        if (ids[c.id]) return;
        try {
          var a = retira(io, folderPath, c.carpeta);
          hecho.retirados.push(c.carpeta);
          io.log && io.log('write-vault: retirada la carpeta del proyecto eliminado "' + c.carpeta + '" (en ' + RETIRADOS + '/' + a + ')');
        } catch (err) {
          io.log && io.log('write-vault: no se pudo retirar "' + c.carpeta + '" (' + err.message + ')');
        }
      });
    } else {
      io.log && io.log('write-vault: la lista llega sin proyectos; no se retira ninguna carpeta');
    }

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
      var suyos = canvasesDeProyecto(canvases, proyecto.id);
      var destino = io.path.join(dir, 'project.json');
      var firma = JSON.stringify({ project: proyecto, canvases: suyos });
      if (sigueIgual(io, destino, firma)) { hecho.iguales.push(carpeta); return; }
      var carga = { meta: meta, project: proyecto, canvases: suyos };
      // Escritura atómica: a un temporal y luego renombrar. Si se corta la
      // corriente a media escritura, el project.json anterior sigue entero en
      // vez de quedarse truncado.
      var tmp = io.path.join(dir, 'project.json.tmp');
      io.fs.writeFileSync(tmp, JSON.stringify(carga, null, 2), 'utf-8');
      io.fs.renameSync(tmp, destino);
      apuntaEscrito(io, destino, firma);
      hecho.escritos.push(carpeta);
    });

    // 2b. Que cada proyecto tenga en su carpeta los archivos que usa. Se hace
    // después de escribirlos todos y de los renombres: un proyecto nuevo que
    // se queda con el nombre de otro (el que va primero en la lista gana el
    // nombre limpio) estrena carpeta vacía, y sus imágenes siguen en la otra.
    proyectos.forEach(function (proyecto) {
      if (!proyecto || !proyecto.id || !carpetas[proyecto.id]) return;
      hecho.traidos += reparaMedios(io, folderPath, carpetas[proyecto.id], canvasesDeProyecto(canvases, proyecto.id));
    });

    // 3. Copias viejas: una carpeta con el identificador de un proyecto vivo que
    // no es la suya (la suya se acaba de escribir). Sus imágenes ya se trajeron
    // en el paso 2b. Solo carpetas con un project.json nuestro: una carpeta
    // cualquiera que alguien haya dejado ahí no se toca jamás.
    carpetasConProyecto(io, folderPath).forEach(function (c) {
      // Solo si a ese proyecto le toca OTRA carpeta y esa se acaba de escribir:
      // con un mapa incompleto (un proyecto sin carpeta asignada) su carpeta de
      // siempre NO es una copia vieja. Sin esta condición, un guardado con el
      // mapa vacío retiró las setenta carpetas de una bóveda de pruebas.
      var suya = carpetas[c.id];
      if (vivas[c.carpeta] || !ids[c.id] || !suya || suya === c.carpeta || !vivas[suya]) return;
      try {
        var a = retira(io, folderPath, c.carpeta);
        hecho.retirados.push(c.carpeta);
        io.log && io.log('write-vault: "' + c.carpeta + '" era una copia vieja de "' + carpetas[c.id] + '"; retirada (en ' + RETIRADOS + '/' + a + ')');
      } catch (err) {
        io.log && io.log('write-vault: no se pudo retirar la copia vieja "' + c.carpeta + '" (' + err.message + ')');
      }
    });

    var limpios = limpiaRetirados(io, folderPath);
    if (limpios) io.log && io.log('write-vault: ' + limpios + ' carpetas de ' + RETIRADOS + ' tenían más de 30 días; borradas');
    return hecho;
  }

  // ══════════════════════════════════════════════════════════
  // Ordenar los medios: lo repetido y lo que no usa nadie
  // ══════════════════════════════════════════════════════════
  //
  // Hasta la 1.2.0, cada imagen que se subía a Google Drive acababa DOS veces
  // en el disco: la de la carpeta del proyecto, que el nodo olvidaba al pasar
  // a la dirección de Drive, y otra que la app bajaba de Drive al 'media'
  // común. En la bóveda del usuario (el 18/10): 845 archivos, 1 GB, y 598 de
  // ellos (864 MB) sin que ninguna nota los nombrara. Esto lo ordena:
  //
  //   1. Lo del montón común que usa UN solo proyecto se muda a la carpeta de
  //      ese proyecto, con el mismo nombre: el nodo no cambia, y «Abrir la
  //      carpeta del archivo» lleva a la del proyecto y no a la de Oddinote.
  //      Lo que usan varios se queda en el montón: mudarlo a uno haría que los
  //      demás se trajeran su copia al guardar (reparaMedios).
  //   2. Lo que no nombra ninguna nota se aparta a .retirados, como las
  //      carpetas de los proyectos borrados: a los 30 días se borra solo.
  //
  // «Lo nombra una nota» se mira en el TEXTO: los datos de la app y además
  // cada json que haya en la bóveda (odinote.json, cada project.json, el
  // reparto viejo y lo retirado). Así cuenta cualquier campo, también los que
  // se añadan mañana, y unos datos a medias de la app no bastan para apartar
  // nada. Y si algo apartado se vuelve a pedir, el servidor lo devuelve a su
  // sitio (rescataRetirado): equivocarse aquí no rompe ninguna imagen.
  //
  // Lo que se queda aunque no lo nombre nadie:
  //   · lo tocado hace menos de una hora (una imagen recién pegada cuyo nodo
  //     aún no se ha guardado);
  //   · lo que lleva en el nombre el id de un nodo vivo y puede ser lo único
  //     bueno que tiene en este equipo (salvo que sea copia exacta de otro que
  //     sí se usa). Ver loQueGuarda, abajo: el ORIGINAL de una imagen que
  //     pegó la persona (media_…) se queda mientras su nodo solo tenga la
  //     versión que sirve Drive, que viene recomprimida (en la bóveda del
  //     usuario, un original de 19,8 MB contra 2,2 MB de la de Drive).
  var SIN_USAR = 'Archivos sin usar';

  function archivosDeMedia(io, dir) {
    var fuera = [];
    var entradas;
    try { entradas = io.fs.readdirSync(dir, { withFileTypes: true }); } catch (err) { return fuera; }
    entradas.forEach(function (e) {
      if (!e.isFile()) return;
      try {
        var ruta = io.path.join(dir, e.name);
        var st = io.fs.statSync(ruta);
        fuera.push({ nombre: e.name, ruta: ruta, size: st.size, mtimeMs: st.mtimeMs });
      } catch (err) {}
    });
    return fuera;
  }

  // El texto de los json que hay en la bóveda.
  function textosDeJson(io, folderPath) {
    var fuera = [];
    var lee = function (ruta) { try { fuera.push(io.fs.readFileSync(ruta, 'utf-8')); } catch (err) {} };
    lee(io.path.join(folderPath, 'odinote.json'));
    [folderPath, io.path.join(folderPath, 'projects'), io.path.join(folderPath, RETIRADOS)].forEach(function (dir) {
      var entradas;
      try { entradas = io.fs.readdirSync(dir, { withFileTypes: true }); } catch (err) { return; }
      entradas.forEach(function (e) {
        if (e.isDirectory()) lee(io.path.join(dir, e.name, 'project.json'));
      });
    });
    return fuera;
  }

  // ¿Sale este nombre de archivo en el texto? Tal cual o codificado como en
  // una dirección (los espacios y los acentos de un file:/// de los de antes).
  function nombra(texto, nombre) {
    if (texto.indexOf(nombre) !== -1) return true;
    var a = encodeURI(nombre);
    if (a !== nombre && texto.indexOf(a) !== -1) return true;
    var b = encodeURIComponent(nombre);
    return b !== a && b !== nombre && texto.indexOf(b) !== -1;
  }

  function mismoContenido(io, a, b) {
    if (a.size !== b.size || a.ruta === b.ruta) return false;
    try { return io.fs.readFileSync(a.ruta).equals(io.fs.readFileSync(b.ruta)); } catch (err) { return false; }
  }

  // De cada nodo (también hijos de columna y fotos de galería), el nombre del
  // archivo de este equipo que usa: el de srcLocal, el de su src si es local,
  // o '' si su medio está solo en internet.
  function copiasDeNodos(canvases) {
    var ids = {};
    var nombreDe = function (s) { var m = typeof s === 'string' && s.match(/media\/([^/]+)$/i); return m ? m[1] : ''; };
    var mira = function (n) {
      if (!n || typeof n !== 'object') return;
      if (n.id != null && (n.src || n.srcLocal)) ids[String(n.id)] = nombreDe(n.srcLocal) || nombreDe(n.src);
      (Array.isArray(n.children) ? n.children : []).forEach(mira);
      (Array.isArray(n.fotos) ? n.fotos : []).forEach(mira);
    };
    Object.keys(canvases || {}).forEach(function (cid) {
      var c = canvases[cid];
      (c && Array.isArray(c.items) ? c.items : []).forEach(mira);
    });
    return ids;
  }

  // ¿Hay que guardar este archivo que nadie nombra porque es de un nodo vivo?
  // Los nombres que pone la app son <cloud|media|galeria>_<id>[_<id>]_<huella>:
  // cloud_ es lo bajado de la nube, media_ y galeria_ lo que guardó la app al
  // pegarlo o soltarlo (el original).
  //   · El nodo no tiene copia en este equipo: se guarda (es la suya, olvidada).
  //   · Es un cloud_ y el nodo ya tiene su copia: una bajada vieja, sobra.
  //   · Es un original y el nodo solo tiene un cloud_: se guarda, es mejor.
  //   · Es un original y el nodo ya tiene su original: una versión vieja.
  function loQueGuarda(nombre, copias) {
    var m = String(nombre).match(/^(cloud|media|galeria)_(.+)_[0-9a-f]{16}\.[a-z0-9]+$/i);
    if (!m) return false;
    var partes = [m[2]].concat(m[2].split('_'));
    for (var i = 0; i < partes.length; i++) {
      var p = partes[i];
      if (!p || !Object.prototype.hasOwnProperty.call(copias, p)) continue;
      var suya = copias[p];
      if (!suya) return true;
      if (m[1].toLowerCase() === 'cloud') continue;
      if (/^cloud_/i.test(suya)) return true;
    }
    return false;
  }

  // opciones: { ahora, edadMinimaMs } (por defecto, una hora).
  function ordenaMedios(io, folderPath, data, mapa, opciones) {
    var op = opciones || {};
    var ahora = op.ahora || Date.now();
    var edadMinima = op.edadMinimaMs == null ? 3600 * 1000 : op.edadMinimaMs;
    var hecho = { movidos: 0, apartados: 0, bytes: 0, repetidos: 0 };
    var datos = data || {};
    var proyectos = datos.projects || [];
    var canvases = datos.canvases || {};
    // Sin proyectos o sin lienzos no se toca nada: es mucho más probable una
    // lectura fallida que una bóveda en la que sobre todo.
    if (!proyectos.length || !Object.keys(canvases).length) return hecho;
    var carpetas = mapa || carpetasDeProyectos(proyectos);

    // El texto de cada proyecto: sus lienzos en la app y su project.json.
    var textoDe = {};
    proyectos.forEach(function (p) {
      var c = p && p.id && carpetas[p.id];
      if (!c) return;
      var t = JSON.stringify(p) + JSON.stringify(canvasesDeProyecto(canvases, p.id));
      try { t += io.fs.readFileSync(io.path.join(folderPath, c, 'project.json'), 'utf-8'); } catch (err) {}
      textoDe[c] = (textoDe[c] || '') + t;
    });
    var nombresCarpeta = Object.keys(textoDe);
    var todo = nombresCarpeta.map(function (c) { return textoDe[c]; })
      .concat(textosDeJson(io, folderPath), [JSON.stringify(datos)]).join('\n');
    var copias = copiasDeNodos(canvases);
    var monton = io.path.join(folderPath, 'media');

    // 1. Del montón a la carpeta de su proyecto.
    archivosDeMedia(io, monton).forEach(function (f) {
      var duenos = nombresCarpeta.filter(function (c) { return nombra(textoDe[c], f.nombre); });
      if (duenos.length !== 1) return;
      var dir = io.path.join(folderPath, duenos[0], 'media');
      var destino = io.path.join(dir, f.nombre);
      if (io.fs.existsSync(destino)) return;
      try {
        io.fs.mkdirSync(dir, { recursive: true });
        io.fs.renameSync(f.ruta, destino);
        hecho.movidos++;
      } catch (err) {
        io.log && io.log('ordena-medios: no se pudo mudar ' + f.nombre + ' a "' + duenos[0] + '" (' + err.message + ')');
      }
    });

    // 2. Lo que no nombra nadie, a .retirados.
    var usados = [], sobran = [];
    [monton].concat(nombresCarpeta.map(function (c) { return io.path.join(folderPath, c, 'media'); }))
      .forEach(function (dir) {
        archivosDeMedia(io, dir).forEach(function (f) { (nombra(todo, f.nombre) ? usados : sobran).push(f); });
      });
    var sello = new Date(ahora).toISOString().slice(0, 19).replace(/[:T]/g, '-');
    var lote = io.path.join(folderPath, RETIRADOS, SIN_USAR + ' (' + sello + ')');
    sobran.forEach(function (f) {
      if (ahora - f.mtimeMs < edadMinima) return;
      var copia = usados.some(function (u) { return mismoContenido(io, u, f); });
      if (!copia && loQueGuarda(f.nombre, copias)) return;
      try {
        var destino = io.path.join(lote, io.path.relative(folderPath, f.ruta));
        io.fs.mkdirSync(io.path.dirname(destino), { recursive: true });
        io.fs.renameSync(f.ruta, destino);
        hecho.apartados++;
        hecho.bytes += f.size;
        if (copia) hecho.repetidos++;
      } catch (err) {
        io.log && io.log('ordena-medios: no se pudo apartar ' + f.ruta + ' (' + err.message + ')');
      }
    });
    if (hecho.apartados) {
      try {
        io.fs.writeFileSync(io.path.join(lote, 'LEEME.txt'), [
          'Oddinote apartó aquí archivos de la bóveda que no usa ninguna nota:',
          'copias repetidas y archivos de nodos que ya no existen.',
          'Esta carpeta se borra sola a los 30 días. Si antes de eso una nota',
          'vuelve a pedir uno de estos archivos, Oddinote lo devuelve a su sitio.',
          'Si quieres el espacio ya, puedes borrar esta carpeta.',
          '',
          'Oddinote moved here vault files that no note uses: repeated copies',
          'and files of nodes that no longer exist. This folder deletes itself',
          'after 30 days. If a note asks for one of these files before then,',
          'Oddinote puts it back. To get the space now, delete this folder.',
          ''
        ].join('\r\n'), 'utf-8');
      } catch (err) {}
    }
    return hecho;
  }

  // Un archivo que se pide y no está: si se apartó (ordenaMedios), vuelve a su
  // sitio. relativo: 'Diana/media/foto.png' o 'media/foto.png'. Devuelve la
  // ruta donde queda, o null.
  function rescataRetirado(io, folderPath, relativo) {
    if (!relativo || /\.\./.test(relativo)) return null;
    var cola = String(relativo).match(/media\/([^/]+)$/i);
    if (!cola) return null;
    var dir = io.path.join(folderPath, RETIRADOS);
    var lotes;
    try { lotes = io.fs.readdirSync(dir, { withFileTypes: true }); } catch (err) { return null; }
    for (var i = 0; i < lotes.length; i++) {
      if (!lotes[i].isDirectory() || lotes[i].name.indexOf(SIN_USAR) !== 0) continue;
      var base = io.path.join(dir, lotes[i].name);
      // Dentro del lote, lo apartado conserva dónde estaba: 'media/…' o '<carpeta>/media/…'.
      var sitios = ['media'];
      try {
        io.fs.readdirSync(base, { withFileTypes: true }).forEach(function (e) {
          if (e.isDirectory() && e.name !== 'media') sitios.push(io.path.join(e.name, 'media'));
        });
      } catch (err) { continue; }
      for (var j = 0; j < sitios.length; j++) {
        var origen = io.path.join(base, sitios[j], cola[1]);
        if (!io.fs.existsSync(origen)) continue;
        var destino = io.path.join(folderPath, sitios[j], cola[1]);
        try {
          if (io.fs.existsSync(destino)) return destino;
          io.fs.mkdirSync(io.path.dirname(destino), { recursive: true });
          io.fs.renameSync(origen, destino);
          io.log && io.log('vault: ' + cola[1] + ' estaba apartado y se ha pedido; vuelve a ' + sitios[j]);
          return destino;
        } catch (err) {
          return origen;
        }
      }
    }
    return null;
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
    sinGemelos: sinGemelos,
    limpiaRetirados: limpiaRetirados,
    RETIRADOS: RETIRADOS,
    mediosDeLienzos: mediosDeLienzos,
    buscaMedio: buscaMedio,
    reparaMedios: reparaMedios,
    ordenaMedios: ordenaMedios,
    rescataRetirado: rescataRetirado,
    SIN_USAR: SIN_USAR,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Boveda;
  if (typeof window !== 'undefined') window.Boveda = Boveda;
})();
