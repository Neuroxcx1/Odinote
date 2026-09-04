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

- Versión **1.0.8**, marcador de caché **1.0.8-173** (el siguiente build va con 174).
- Lista de tareas (27 de 35): https://claude.ai/code/artifact/4f27cc5e-75f9-4d0d-96a0-ce2003a7023d
  Las casillas las marca Claude en el HTML del artefacto (`tarea hecha` +
  `checked`) y se republica con la **misma URL**.

**Para la 1.0.8 quedan dos:**

1. **Carpetas para agrupar proyectos** — es cosa de la pantalla de inicio de la
   aplicación, **nada de Google Drive**: poder meter proyectos dentro de una
   carpeta en vez de tenerlos todos sueltos. Sin tocar la sincronización.
2. **La web** — corto y solo texto: repasar las comparativas (hay cosas que ya
   no son verdad, como que no se puede dibujar a mano o exportar a JSON) y
   **añadir lo de la corona**, para que se vea qué se llevan los que donan.

El resto de la lista es 1.0.9.

**A medias, hay que revisarlo:** la flecha en modo recto está escrita pero **sin
probar con el ratón**; el salto de trabajo a descanso del pomodoro no se pudo
medir (60 s reales de espera); la terminal del nodo de código quedó fuera (era
opcional).

## 3. Reglas de la casa

- **Colores de los botones: solo gris, blanco, verde y rojo.**
- Comentarios **en español**, explicando el **porqué** y no el qué. Los archivos
  van en **CRLF**.
- Un **commit por cambio coherente**: asunto en inglés, cuerpo en español con el
  porqué y **qué se comprobó**.
- **No renombrar lo interno.** `%APPDATA%\Odinote` cuelga del `name` de
  `App/package.json`; si cambia, Electron mira en otra carpeta y la gente creerá
  que perdió sus notas. Tampoco: la carpeta "Odinote" de Google Drive,
  `OdinoteDB`, la marca `app: 'Odinote'` de los respaldos, ni las direcciones de
  GitHub (el repositorio se sigue llamando Odinote).

## 4. Compilar — siempre a pre-release, nunca a la instalación de diario

Desde `App/`:

```bash
npx electron-packager . Odinote-pre --platform=win32 --arch=x64 --out="D:/Documentos/Proyectos/Oddinote/App/dist/pre-release" --overwrite --icon=Icon/Icon.ico --ignore="^/dist($|/)"
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
- El worktree necesita prestado del checkout principal: `App/node_modules` y
  `functions/node_modules` (enlaces con `New-Item -ItemType Junction`) y
  `App/google-oauth.json` (está en .gitignore; sin él Google falla).

## 5. Cómo comprobar antes de decir "listo"

- `npm test` desde `App/` → **383 comprobaciones**, todas deben pasar.
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
- La herramienta Bash **se come las comillas invertidas y las barras invertidas**
  dentro de un heredoc. Para archivos con plantillas de JS, usar Write o un
  script de node aparte. Y cuidado con dejar LF donde va CRLF.
