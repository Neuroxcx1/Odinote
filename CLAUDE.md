# Oddinote — lo que hay que saber antes de tocar nada

App de lienzos anidados en Electron + React. El código está en `App/`: JSX
transpilado en el navegador con Babel, **sin bundler**.

## 1. Comprueba la rama ANTES de escribir código

Cada chat trabaja en su propio worktree y **esas ramas no se juntan solas con
`main`**. Ya pasó una vez: un chat empezó desde `main`, no vio el trabajo del
anterior, dijo que "había desaparecido" el nodo de figuras y reprogramó cosas
que ya estaban hechas. **No repetirlo.**

Lo primero de la sesión, siempre:

```bash
git worktree list && git branch --show-current && git log --oneline -1
```

La rama viva es **`claude/oddinote-pending-tasks-de1c71`**. Si el worktree
actual no está en ella, **no empieces**: pon respaldo y júntala antes.

```bash
git tag respaldo-antes-de-juntar && git merge claude/oddinote-pending-tasks-de1c71
```

Al resolver conflictos, por defecto **conserva las dos cosas** (lo de la rama y
lo nuevo), no elijas un lado: casi siempre son complementarias.

Después de juntar, comprueba que siguen existiendo: `CodeItem`, `TimerItem` y
`FIGURAS` (20 formas) en `App/src/items.jsx`, y `sinCamposDelMomento` en
`App/src/app.jsx`. Si falta alguno, la mezcla salió mal: párate y dilo.

## 2. Estado y qué falta

- Versión **1.0.8**, marcador de caché **1.0.8-174** (el siguiente build va con 175).
- La lista de tareas vive en un artefacto privado del mantenedor; pídele el
  enlace si lo necesitas. Las casillas se marcan en el HTML de ese artefacto
  (`tarea hecha` + `checked`) y se republica con la **misma URL**.

**La 1.0.8 está cerrada.** Todo lo que quedaba (nodo de tiempo, carpetas de
proyectos y el repaso de la web) está hecho. El resto de la lista es 1.0.9:
la ruleta, los cuatro nodos que quedaban, las plantillas de tablero, la flecha
en modo recto y lo que falta del cambio de nombre.

**A medias, hay que revisarlo:** la flecha en modo recto está escrita pero **sin
probar con el ratón**; la terminal del nodo de código quedó fuera (era
opcional).

**Las carpetas de proyectos** no son un objeto que se guarde en ninguna lista:
una carpeta existe porque hay proyectos que dicen estar dentro (`p.carpeta`, el
nombre tal cual). Por eso agrupar **no toca la sincronización** — el campo viaja
dentro del proyecto. Las vacías, que no se pueden deducir, van en localStorage
(`odinote.carpetas_vacias`) y solo en este equipo. Quitar una carpeta **no borra
nada**: sus proyectos vuelven a quedar sueltos.

El **nodo de tiempo está cerrado**: el tiempo se escribe en el propio reloj, la
barra de arriba lleva color y nombre (con la barra de texto de siempre), el
fondo va al 58% con desenfoque, y el pomodoro tiene botón de cambiar de fase e
interruptor de encadenado. El salto de fase **ya está medido**: la decisión
vive en `siguienteFasePomodoro`, fuera de React, para poder probarla sin
esperar los minutos de verdad. Sigue **sin verse en el .exe**, solo en el
servidor de pruebas.

**La web** (carpeta `Website/` junto a este repositorio, **fuera de él y con su
propio git**: `Neuroxcx1/Odinote-web`, que es lo que sirve Vercel): las comparativas ya no dicen que la
colaboración sean carpetas de Drive —hay sesiones en vivo entre navegadores— ni
que haya 16 tipos de nodo (son 19, más conectores y dibujo a mano), y la
portada explica qué se lleva quien dona. Ese repositorio tenía **cambios sin
commitear de antes**; los míos van encima, sin commitear tampoco.

## 3. Reglas de la casa

- **Colores de los botones: solo gris, blanco, verde y rojo.**
- Comentarios **en español**, explicando el **porqué** y no el qué. Los archivos
  van en **CRLF**.
- Un **commit por cambio coherente**: asunto en inglés, cuerpo en español con el
  porqué y **qué se comprobó**.
- **Al terminar cualquier tanda de cambios se compila el `.exe`**, sin que haga
  falta pedirlo. Dicho por el usuario con todas las letras.
- En la barra de nodos y en el menú del **+**, el color dice de qué es cada
  nodo y van **agrupados por color**: verde lo que se escribe, gris los medios
  y archivos, rojo la estructura, blanco las dos de trazo. Un nodo nuevo se
  coloca en su grupo, no al final.
- **No renombrar lo interno.** `%APPDATA%\Odinote` cuelga del `name` de
  `App/package.json`; si cambia, Electron mira en otra carpeta y la gente creerá
  que perdió sus notas. Tampoco: la carpeta "Odinote" de Google Drive,
  `OdinoteDB`, la marca `app: 'Odinote'` de los respaldos, ni las direcciones de
  GitHub (el repositorio se sigue llamando Odinote).

## 4. Compilar — siempre a pre-release, nunca a la instalación de diario

Desde `App/`:

```bash
npx electron-packager . Odinote-pre --platform=win32 --arch=x64 --out=dist/pre-release --overwrite --icon=Icon/Icon.ico --ignore="^/dist($|/)"
```

- Cerrar antes: `Get-Process -Name "Odinote-pre" | Stop-Process -Force`. **Nunca**
  el proceso `Odinote`, que es la instalación del usuario.
- **Abrirle la app al terminar** con `Start-Process`. Si solo se le da la ruta,
  acaba abriendo otro .exe.
- **Verificar el binario** con grep dentro de
  `dist/pre-release/Odinote-pre-win32-x64/resources/app/`. No fiarse del "Listo".
- **Subir el marcador de caché en cada build**: `?v=NNN` en `App/index.html` (29
  apariciones) y `window.ODINOTE_BUILD` en `App/src/app.jsx`. Sin eso se sirve la
  versión cacheada y parece que nada cambió.
- Un worktree necesita prestado del checkout principal: `App/node_modules` y
  `functions/node_modules` (enlaces con `New-Item -ItemType Junction`) y
  `App/google-oauth.json` (está en .gitignore; sin él Google falla). Ver
  `App/google-oauth.example.json` para conseguir el tuyo.

## 5. Cómo comprobar antes de decir "listo"

- `npm test` desde `App/` → **502 comprobaciones**, todas deben pasar.
- Los .jsx no los valida nadie: compilarlos con el Babel que viaja dentro —
  `node -e "const B=require('./App/lib/babel.min.js');const Babel=B.transform?B:global.Babel;Babel.transform(require('fs').readFileSync('App/src/X.jsx','utf8'),{presets:['react'],filename:'X.jsx'})"`
- Para ver cosas de verdad: `node dev-server.js` desde `App/` (puerto 4173).
- **El navegador de la herramienta es Chrome normal**: nunca reproduce fallos que
  dependen de Electron (visor de PDF, diálogos nativos, el selector de archivos).
  Eso se prueba **en el .exe**.
- El registro está en `%APPDATA%\Odinote\odinote-debug.log`: dice de qué carpeta
  salió el build que corre y recoge los `console.log` del renderer. Se borra en
  cada arranque. **Ahí se han resuelto casi todos los misterios del proyecto.**
- **Reproducir el fallo antes de arreglarlo** y volver a comprobarlo después.
- **Decir siempre lo que NO funciona o no se pudo probar.** El usuario prefiere
  eso a un "listo" falso.

## 6. Trampas que ya costaron tiempo

- El `src` de un medio **casi nunca es una `data:` URL**: al guardarse pasa a
  `media/algo.ext` o `file:///…`. Sacar los bytes con `src.split(',')[1]` +
  `atob` devuelve **cero bytes** y falla **en silencio**. Usar
  `fetch(window.resolveMediaSrc(src))`.
- Los campos que empiezan por guion bajo (`_dragging`, `_editing`,
  `_triggerFilePick`…) son **del momento** y no deben guardarse:
  `sinCamposDelMomento` los limpia al guardar y al cargar. Si se añade uno nuevo,
  respetar esa regla — guardarlos hacía que al abrir un proyecto saliera solo el
  selector de archivos.
- La caché de medios de la nube guarda con la extensión de verdad (nombre → tipo
  del servidor → primeras letras del archivo). No volver al `.png` por defecto:
  un PDF guardado como `.png` no se puede pintar.
- En **móvil** la app fuerza `font-size: 16px` a todo campo de texto (para que
  el navegador no dé el zoom que da al escribir en letra pequeña) con una regla
  de cinco clases de especificidad. Le gana a cualquier cosa razonable: las
  casillas del reloj salían a 16px al lado de unos números de 40. Si un campo
  tuyo tiene que ser grande, hay que ganarle a esa regla a propósito.
- Un `<input>` que solo guarda **al perder el foco** pierde lo escrito cuando la
  barra de texto se cierra con su flecha: eso lo desmonta, y de un campo
  desmontado no sale ningún blur. Los títulos se guardan **según se escriben**.
- La herramienta Bash **se come las comillas invertidas y las barras invertidas**
  dentro de un heredoc. Para archivos con plantillas de JS, usar Write o un
  script de node aparte. Y cuidado con dejar LF donde va CRLF.
