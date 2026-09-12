# Oddinote para Android

Esto **no es otra aplicación**. Es un envoltorio: coge la misma Oddinote que
está en `App/` y la mete dentro de un APK, con Capacitor. No hay ni una línea
de la aplicación duplicada aquí, y eso es lo importante — el día que se
duplique, una de las dos copias se quedará vieja sin que nadie se entere.

## Compilar

Desde esta carpeta:

```bash
npm run apk
```

Eso hace tres cosas, por orden:

1. **`scripts/preparar-web.js`** arma `www/` a partir de `App/`. No es una copia
   tal cual: traduce el JSX de una vez (en el navegador la aplicación se traduce
   sola al arrancar, y en un teléfono eso son segundos en blanco), mete Firebase
   dentro en vez de traerlo de gstatic.com, y marca la plataforma como
   `android`. Y deja fuera `google-oauth.json`, `main.js`, `preload.js`,
   `node_modules` y `dist`.
2. **`cap copy android`** lleva `www/` dentro del proyecto de Android.
3. **`scripts/compilar-apk.js`** llama a Gradle y deja el APK con su versión en
   el nombre, junto a un `LEEME.txt`, en la carpeta de entregas de siempre:

   ```
   App/dist/Oddinote-Android/Oddinote-1.0.8.1.apk
   ```

   Ahí al lado están `Odinote-win32-x64` (la instalación de diario),
   `pre-release` y `release`. Van juntas a propósito: tener lo que se reparte en
   dos sitios distintos es como se acaba subiendo a una publicación el archivo
   de la semana pasada.

Con el móvil enchufado por USB, `npm run movil` hace lo mismo y además lo
instala.

## Lo que hace falta tener

No hay nada instalado "en el sistema": Java y el SDK de Android viven sueltos en
`C:\Users\USER\android-tools`, para poder borrarlos de un tirón el día que
estorben. Ocupan unos 1,5 GB.

- **Java 21** (Microsoft OpenJDK) en `android-tools\jdk-21…`
- **SDK de Android** en `android-tools\sdk`, con `platform-tools`,
  `platforms;android-36` y `build-tools;36.0.0`

Si se pierden, se vuelven a dejar ahí con los zip de
`aka.ms/download-jdk/microsoft-jdk-21-windows-x64.zip` y de
`dl.google.com/android/repository/commandlinetools-win-13114758_latest.zip`, y
luego `sdkmanager --licenses` y `sdkmanager "platform-tools"
"platforms;android-36" "build-tools;36.0.0"`.

`android/local.properties` apunta al SDK y es de este equipo: va con **barras
normales** (`C:/Users/...`). En un archivo `.properties` la barra invertida es
un escape, así que `C:\Users` se lee como `C:Users` y Gradle dice que no
encuentra un archivo, sin decir cuál. Costó una compilación entera.

## La versión

No se escribe aquí. `android/app/build.gradle` la lee de `App/package.json`:
el nombre tal cual (`1.0.8.1`) y el número interno como
`1·1000000 + 0·10000 + 8·100 + 1 = 1000801`. Ese número **tiene que crecer** en
cada entrega o el teléfono se niega a instalar la nueva encima de la vieja, y no
explica por qué.

## Qué funciona y qué no

**Comprobado** (12 de septiembre de 2026): el APK se compila y pesa 9,9 MB;
dentro van los 76 archivos de la aplicación, las 15 tipografías y Firebase, y
**no** va `google-oauth.json` ni el JSX sin traducir. Pide un solo permiso:
internet. Funciona desde Android 7 (`minSdk 24`). Servida esa misma carpeta en
un navegador con pantalla de móvil, la aplicación arranca entera, se reconoce
como táctil y no le falta ni un archivo.

**Sin comprobar todavía:** no se ha abierto en un teléfono de verdad — no había
ninguno enchufado. Eso incluye lo que solo se ve allí: el rendimiento al mover
el lienzo con el dedo, el teclado tapando los nodos y el botón de "atrás".

**Lo que se sabe que NO va a funcionar, y hay que rehacer:**

- **Entrar con Google.** Comprobado en el teléfono: Firebase contesta
  `auth/internal-error` en cuanto se intenta. La aplicación usa una ventana emergente
  (`signInWithPopup`), y Google **bloquea a propósito** el inicio de sesión
  dentro de un WebView. Sin eso no hay Drive, ni salas en vivo, ni corona. La
  solución es abrir la sesión en el navegador del teléfono (Custom Tabs) y
  devolver el resultado a la aplicación.
- **La bóveda en carpeta.** En Android no hay carpeta de la bóveda: se guarda en
  el propio teléfono (IndexedDB), igual que hace hoy la versión web.
- **Lo que era de Electron:** el corrector, el menú del botón derecho, la
  captura del lienzo a archivo y el instalador de actualizaciones.

El aviso de "hay una versión nueva" sí se va a ver: mira las publicaciones de
GitHub. Al pulsarlo abrirá la página de descargas en el navegador, que para un
móvil no está mal, pero ahí solo hay `.exe` hasta que se suba también el APK.

## Publicarlo

Va en una **publicación aparte** de la de Windows, y el `.apk` se sube **tal
cual, sin comprimir**: un APK ya es un archivo comprimido, y metido en un zip el
teléfono no puede instalarlo de una pasada.

Eso obligó a tocar el aviso de "hay versión nueva" del escritorio. Miraba la
lista entera de publicaciones de GitHub y se quedaba con la primera; en cuanto
hay publicaciones de Android en esa lista, eso rompe por los dos lados: si la
del móvil es la más reciente, **tapa** una versión de Windows que sí era nueva y
el programa dice "estás al día"; y si su etiqueta se leyera como un número
mayor, le ofrecería a alguien de Windows descargar algo que no puede instalar.

Ahora una publicación cuenta para el escritorio **si trae algún archivo que no
sea un APK** — se mira lo que lleva dentro, no cómo se llama la etiqueta, porque
las etiquetas las escribe una persona a mano. Está en
`eligePublicacionDeEscritorio` (en `App/src/app.jsx`) y medido en
`App/scripts/test-actualizacion.js`, con los dos casos feos de arriba.

## Repartirlo

El APK va firmado con la **clave de pruebas** de Android, que es la que crea
Gradle solo. Sirve para instalarlo a mano y pasárselo a quien sea; el teléfono
avisará de que viene "de una fuente desconocida" y hay que darle permiso una
vez. Es lo normal fuera de las tiendas.

Para firmarlo con una clave propia hace falta crear un almacén de claves con su
contraseña. Eso **lo tiene que hacer el mantenedor en persona**: es una
credencial, y si se pierde no se pueden publicar más actualizaciones de esta
misma aplicación nunca más.
