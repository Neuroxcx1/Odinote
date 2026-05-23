/**
 * ODINOTE — Ko-fi Webhook Receiver & Server Template (Node.js/Express)
 * ===================================================================
 * Este script te permite recibir notificaciones automáticas de donaciones
 * desde Ko-fi, validar que provengan de tu cuenta de forma segura y guardar
 * los últimos donadores en un archivo JSON público ('donations.json') en tu
 * servidor para que la app cliente de Odinote los muestre en tiempo real.
 * 
 * ¿Cómo usar este script?
 * 1. Instala express: npm install express
 * 2. Despliega este servidor en Render, Vercel, o tu servidor VPS favorito.
 * 3. En tu panel de Ko-fi (https://ko-fi.com/manage/webhooks), configura
 *    tu URL de webhook apuntando a: https://tu-servidor.com/kofi-webhook
 * 4. Copia tu token de verificación de Ko-fi y reemplázalo en KOFI_VERIFICATION_TOKEN abajo.
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de Ko-fi
const KOFI_VERIFICATION_TOKEN = 'fd67ed4c-f7d7-47fc-a652-124d36eccf30'; // Tu token de verificación de la imagen
const DONATIONS_FILE_PATH = path.join(__dirname, 'donations.json'); // Archivo que servirá la app de Odinote
const MAX_DONATIONS_LIST = 10; // Número máximo de donantes recientes a conservar

// Habilitar CORS para que la app cliente de Odinote pueda descargar el JSON
app.use(cors());

// Ko-fi envía la información como x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Endpoint público para que Odinote descargue la lista de donadores en tiempo real
app.get('/donations.json', (req, res) => {
  if (fs.existsSync(DONATIONS_FILE_PATH)) {
    return res.sendFile(DONATIONS_FILE_PATH);
  }
  // Retornar lista vacía o valores por defecto
  return res.json([
    { name: 'Gabriel S.', amount: '5.00 USD', msg: { es: 'Increíble proyecto, me ayuda mucho con mis apuntes.', en: 'Amazing project, helps me a lot with my notes.' }, date: { es: 'hace 2 horas', en: '2 hours ago' } },
    { name: 'Elena R.', amount: '10.00 USD', msg: { es: '¡Sigue así! Me encanta la estética de lámpara de lava.', en: 'Keep it up! I love the lava lamp aesthetics.' }, date: { es: 'hace 1 día', en: '1 day ago' } },
    { name: 'David M.', amount: '3.00 USD', msg: { es: 'El mejor canvas anidado que he probado.', en: 'The best nested canvas I have ever tried.' }, date: { es: 'hace 3 días', en: '3 days ago' } }
  ]);
});

// Endpoint webhook receptor (Ko-fi POST)
app.post('/kofi-webhook', (req, res) => {
  try {
    // 1. Obtener los datos codificados recibidos en la variable "data"
    const rawData = req.body.data;
    if (!rawData) {
      console.warn('[Ko-fi Webhook] Petición vacía recibida.');
      return res.status(400).send('No data received');
    }

    // 2. Parsear el JSON enviado por Ko-fi
    const kofiPayload = JSON.parse(rawData);

    // 3. Validar el token de verificación para certificar que proviene genuinamente de Ko-fi
    if (kofiPayload.verification_token !== KOFI_VERIFICATION_TOKEN) {
      console.error('[Ko-fi Webhook] Token de verificación inválido. Petición rechazada.');
      return res.status(401).send('Unauthorized Token');
    }

    // 4. Extraer la información útil del pago
    // Tipos de transacción admitidos: 'Tip', 'Subscription', 'Commission', 'Shop Order'
    const newDonation = {
      name: kofiPayload.from_name || 'Anónimo',
      amount: `${parseFloat(kofiPayload.amount).toFixed(2)} ${kofiPayload.currency}`,
      msg: {
        es: kofiPayload.message || 'Apoyó el proyecto.',
        en: kofiPayload.message || 'Supported the project.'
      },
      date: {
        es: 'hace unos instantes',
        en: 'just now'
      },
      timestamp: Date.now()
    };

    console.log(`[Ko-fi Webhook] ¡Nueva donación de ${newDonation.name} por ${newDonation.amount}!`);

    // 5. Cargar lista existente, insertar la nueva donación al inicio y acortar al tamaño máximo
    let currentList = [];
    if (fs.existsSync(DONATIONS_FILE_PATH)) {
      try {
        const fileContent = fs.readFileSync(DONATIONS_FILE_PATH, 'utf8');
        currentList = JSON.parse(fileContent);
      } catch (err) {
        console.error('[Ko-fi Webhook] Error leyendo la lista existente de donaciones:', err);
      }
    }

    // Insertar al inicio de la lista
    currentList.unshift(newDonation);

    // Acotar el arreglo al tamaño límite
    if (currentList.length > MAX_DONATIONS_LIST) {
      currentList = currentList.slice(0, MAX_DONATIONS_LIST);
    }

    // 6. Guardar archivo JSON actualizado
    fs.writeFileSync(DONATIONS_FILE_PATH, JSON.stringify(currentList, null, 2), 'utf8');
    console.log('[Ko-fi Webhook] Archivo donations.json actualizado exitosamente.');

    // Responder con éxito HTTP 200 (obligatorio para confirmar recepción a Ko-fi)
    res.status(200).send('OK');
  } catch (error) {
    console.error('[Ko-fi Webhook] Error procesando el webhook:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Servir la aplicación
app.listen(PORT, () => {
  console.log(`[Odinote Webhook Server] Escuchando en el puerto ${PORT}`);
  console.log(`- Webhook POST: http://localhost:${PORT}/kofi-webhook`);
  console.log(`- Consulta GET: http://localhost:${PORT}/donations.json`);
});
