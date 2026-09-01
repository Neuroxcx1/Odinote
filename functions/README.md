# La corona de patrocinador — cómo se pone en marcha

Esto se hace **una vez**. Después funciona solo para siempre: alguien dona en
Ko-fi, Ko-fi avisa aquí, aquí se apunta su correo, y la próxima vez que esa
persona abra Odinote tiene la corona y el cursor dorado. Nadie apunta nada a
mano.

Todos los comandos se escriben **en la raíz del repositorio** (la carpeta donde
están `App/` y `functions/`), no dentro de `App/`.

---

## 1. Activar el plan Blaze en Firebase

Google no deja tener un programa como este en el plan gratuito, así que hay que
poner una tarjeta.

**Qué es "pago por uso":** no es una cuota. La parte gratuita **no desaparece**
al pasar a Blaze; sigue siendo gratis lo mismo que antes, y solo se paga por lo
que se gaste **por encima** de ese regalo mensual. Lo que regalan cada mes:

| | Regalado al mes | Lo que va a gastar esto |
|---|---|---|
| Llamadas a la función | 2.000.000 | unas decenas |
| Escrituras en Firestore | 20.000 al día | una por donación |

O sea: el gasto va a ser **0 €**, o unos céntimos por el espacio donde Google
guarda la función. La tarjeta es un requisito suyo, no un cobro.

1. Consola de Firebase → rueda dentada (arriba a la izquierda) → **Uso y facturación**
2. Pestaña **Detalles y configuración** → **Modificar el plan** → **Blaze**
3. Poner un **presupuesto de 1 €** con avisos por correo.

**Y aquí una advertencia que hay que decir clara:** ese presupuesto es una
**alarma, no un freno**. Google avisa cuando se pasa, pero no corta el
servicio ni deja de cobrar. Un presupuesto no es un límite de gasto.

Los frenos de verdad están en el código, no en la consola (ver `index.js`), y
son tres:

- **`maxInstances: 1`** — una sola copia de la función corriendo, como máximo.
  Por muchas llamadas que lleguen a la vez, se atienden de una en una.
- **Corte por avalancha** — pasados 20 avisos en un minuto, se contesta 429 y
  se corta **antes de tocar Firestore**. Esto importa más de lo que parece: la
  base de datos es el recurso con la cuota más estrecha, así que un atacante
  puede conseguir que la función se ejecute, pero no que escriba.
- **128 MB y 10 segundos** — se paga por memoria y por tiempo, y aquí no hace
  falta más.

**Aun así, hay que decirlo claro: esto acota el gasto, no lo garantiza en cero.**
Nada de lo que se escriba en el código puede impedir que Google cuente una
llamada. Lo que sí se puede afirmar es que el peor caso imaginable queda en
calderilla, y que llegaría el correo del presupuesto mucho antes.

Si se quiere un tope duro de verdad, el único que existe está en Google Cloud
Console → **IAM y administración → Cuotas**, bajando la cuota de invocaciones
de Cloud Functions. Eso sí lo corta Google, no el código.

**Si no te fías de poner la tarjeta**, no la pongas: no es obligatorio para
nada de Odinote. Hay dos alternativas y las dos funcionan:

- **A mano.** Cuando alguien done, Ko-fi te avisa por correo; apuntas su correo
  en Firestore (ver más abajo, "Cuando el correo de Ko-fi no es el de su
  Google"). Son treinta segundos por donación y no cuesta nada.
- **En Vercel.** Gratis y sin tarjeta, pero entonces sí hay que generar la
  llave privada de la pantalla "Cuentas de servicio" y pegarla en el panel de
  Vercel. Más pasos y un secreto más que cuidar.

## 2. Instalar las herramientas

```bash
npm install -g firebase-tools
```

```bash
npm --prefix functions install
```

## 3. Entrar con la cuenta de Google del proyecto

```bash
firebase login
```

Se abre el navegador. Hay que entrar con **la misma cuenta que es dueña del
proyecto odinote-firebase**.

## 4. Guardar el código secreto de Ko-fi

El código está en <https://ko-fi.com/manage/webhooks>, en la caja
**Verification Token** (hay que pulsar "Show" o "Advanced" para verlo).

```bash
firebase functions:secrets:set KOFI_TOKEN
```

Pide el código, se pega y se pulsa Enter. **No se queda escrito en ningún
archivo del proyecto**: se guarda en el almacén de secretos de Google. Por eso
este repositorio puede seguir siendo público sin problema.

## 5. Subirlo todo

```bash
firebase deploy --only functions,firestore:rules
```

Tarda un par de minutos la primera vez y va preguntando si puede activar unos
cuantos servicios de Google. **A todo eso, que sí.**

Esto sube dos cosas: el programa que recibe los avisos y las reglas de
seguridad de Firestore (que ahora incluyen la lista de patrocinadores).

## 6. Decirle a Ko-fi a dónde avisar

De vuelta en <https://ko-fi.com/manage/webhooks>, en **Webhook URL**, pegar:

```
https://us-central1-odinote-firebase.cloudfunctions.net/kofi
```

Y guardar.

## 7. Comprobar que funciona

En esa misma página de Ko-fi hay un botón **Send Test** (o "Enviar prueba").
Al pulsarlo:

1. En la consola de Firebase → Firestore, debe aparecer una colección nueva
   llamada **patrocinadores** con un documento dentro.
2. Si no aparece, mirar qué pasó:

```bash
firebase functions:log --only kofi
```

---

## Mientras esto no esté montado

No pasa nada malo: la app simplemente no le pone la corona a nadie. Todo lo
demás de Odinote funciona igual, y el botón de Ko-fi sigue llevando a la página
de siempre.

---

## Las dos cosas que sí hay que saber

### Cuando el correo de Ko-fi no es el de su Google

La corona se enciende comparando el correo con el que se pagó contra el correo
con el que esa persona entra en Odinote. Casi siempre es el mismo, pero no
tiene por qué serlo.

Para que pase lo menos posible, conviene poner en el mensaje de agradecimiento
de Ko-fi (Ko-fi → Settings → Thank You Message) algo así:

> Si usas Odinote, entra con la misma cuenta de Google con la que has pagado y
> verás tu corona la próxima vez que abras la app.

Y si alguien escribe diciendo que pagó y no la ve, se arregla en veinte
segundos: consola de Firebase → Firestore → colección `patrocinadores` →
**Agregar documento**, y como **nombre del documento** su correo **en
minúsculas**. Los campos de dentro dan igual, puede ir vacío; lo que se mira es
si el documento existe.

### Quitarle la corona a alguien

Borrando su documento de `patrocinadores`. Tarda hasta un día en apagarse en su
equipo, porque la app solo pregunta una vez al día.

Ojo con esto: **las suscripciones canceladas no se quitan solas**. Ko-fi no
avisa de forma fiable cuando alguien cancela, así que quien haya pagado una vez
se queda con la corona para siempre a menos que se borre a mano. Es una
decisión, no un descuido: son cosméticos, y quitárselos a quien un día apoyó el
proyecto sale más caro en cariño de lo que vale.

---

## Qué hay en cada sitio

| Dónde | Qué hace |
|---|---|
| `functions/index.js` | Recibe el aviso de Ko-fi y apunta el correo. |
| `App/firestore.rules` | Cada uno solo puede mirar si él está en la lista. Nadie puede escribir en ella desde la app. |
| `App/src/patrocinio.js` | Pregunta una vez al día si a esta cuenta le toca corona. |
| `App/src/Corona.jsx` | El dibujo de la corona. |
| `App/src/styles.css` | El cursor dorado (busca `data-patrocinador`). |

## Por qué esto no se puede "hackear"

Se puede, y no importa. Odinote es de código abierto: cualquiera con maña puede
editar `patrocinio.js` en su copia y ponerse la corona. No hay forma de evitar
eso en un programa que se ejecuta en el ordenador de otra persona, y no merece
la pena intentarlo, porque **detrás de esto no hay ninguna función de Odinote**:
solo un adorno. Lo que sí está bien cerrado es lo que importa — nadie puede
escribir en la lista, ni leer los correos de los demás.
