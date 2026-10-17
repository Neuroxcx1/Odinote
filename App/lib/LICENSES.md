# Lo que Oddinote empaqueta y de quién es

Oddinote se distribuye bajo la licencia Apache 2.0 (ver `App/LICENSE`), pero
dentro del programa viajan cosas hechas por otras personas. Desde la 1.2.0, lo
que más se ve —los iconos y las letras— está en **dominio público**: no pide
nada. Lo demás son licencias permisivas que dejan usarlo, modificarlo y
venderlo, y lo único que exigen es que su aviso viaje con ello. Eso hace este
archivo.

Si añades algo nuevo a `lib/`, añádelo también aquí y en `NOTICE`. Un archivo
que nadie mantiene no cumple nada.

---

## Nada que licenciar

**Los sonidos.** No hay ni un archivo de audio en el repositorio. Cada tono se
genera en el momento con osciladores del navegador (`window.playAudioTone` en
`src/data.js`), así que no hay muestras de nadie ni derechos de nadie.

**Los emoji del texto y de los títulos** (🏆 🎲 🔥 …). Son caracteres Unicode,
no imágenes: los dibuja la fuente del sistema de cada persona.

## Iconos de la interfaz

| Qué | De quién | Licencia |
|---|---|---|
| `src/iconos/iconos.js` — los que tienen pareja | Corey Ginnivan, [System UIcons](https://systemuicons.com) | **Unlicense** (dominio público) |
| `src/iconos/iconos.js` — los demás | Dibujados a mano para Oddinote | **CC0 1.0** (dominio público) |
| `material-symbols-rounded.ttf` | Google, [Material Symbols](https://github.com/google/material-design-icons) | Apache 2.0 (`lib/licenses/Apache-2.0.txt`) |

La fuente de Material ya no pinta nada: se queda solo de reserva, para un
nombre de icono que llegue sin dibujo (un proyecto viejo con un icono que ya no
está en la lista). Si `npm test` pasa, no se usa en ningún sitio.

## Portadas de proyecto

| Qué | De quién | Licencia | Aviso |
|---|---|---|---|
| `lib/project-icons/*_3d.png` | Microsoft, [Fluent Emoji](https://github.com/microsoft/fluentui-emoji) | MIT | `lib/project-icons/LICENSE.txt` |
| `lib/project-icons/3dicons/*.png` | Vijay Verma, [3dicons](https://3dicons.co) | **CC0 1.0** | `lib/project-icons/3dicons/LICENSE.txt` y `ORIGEN.txt` |

## Tipografías

| Fuente | De quién | Licencia |
|---|---|---|
| `vegur-*.otf` (el texto) | dotcolon (Arro), [Vegur](https://dotcolon.net) | **CC0 1.0** |
| `aileron-*.otf` (los títulos) | dotcolon (Arro), [Aileron](https://dotcolon.net) | **CC0 1.0** |
| `jetbrains-*.ttf` (el código) | JetBrains, [JetBrains Mono](https://github.com/JetBrains/JetBrainsMono) | SIL OFL 1.1 (`lib/licenses/OFL-1.1.txt`) |

No hay ninguna letra de ancho fijo en dominio público que valga para el nodo de
código, por eso JetBrains Mono se queda. La OFL exige que su texto acompañe a
los archivos, y que una copia modificada no siga llamándose igual.

## Bibliotecas

| Archivo | De quién | Licencia |
|---|---|---|
| `react.production.min.js`, `react-dom.production.min.js` | Meta | MIT |
| `babel.min.js` | Babel | MIT |
| `highlight.min.js`, `github.min.css` | highlight.js | BSD-3-Clause |
| `mammoth.browser.min.js` | Michael Williamson | BSD-2-Clause |
| `xlsx.full.min.js` | SheetJS | Apache 2.0 (`lib/licenses/Apache-2.0.txt`) |
| `html2pdf.bundle.min.js` | Erik Koopmans (incluye html2canvas y jsPDF) | MIT (`lib/licenses/html2pdf-MIT.txt`) |

## Servicios de fuera

No se empaquetan, pero la aplicación habla con ellos: Google Drive y Firebase
(Google), y los servidores STUN públicos de Google para que dos equipos se
encuentren en una sesión en vivo. Se usan a través de sus APIs oficiales y con
la cuenta de cada persona.
