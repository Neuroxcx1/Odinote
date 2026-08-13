// =====================================================
// Odinote — servidor de pruebas para la versión web
//
//   npm run dev:web
//
// Sirve la carpeta App tal cual, SIN caché, y escuchando en todas las
// interfaces de red. Eso permite las dos formas de probar el móvil sin subir
// nada a GitHub:
//
//   1. En el PC: abrir la URL local en Chrome/Brave y activar la emulación de
//      móvil con F12 → Ctrl+Shift+M.
//   2. En el móvil de verdad (lo más fiable): conectarlo al mismo wifi y abrir
//      la URL de red que se imprime al arrancar.
//
// Cada petición se registra con el dispositivo que la pidió, así se ve al
// instante si el navegador está pidiendo los archivos nuevos o sirviendo una
// copia vieja de su caché.
// =====================================================

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 4173);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.jsx': 'text/babel; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
};

// Etiqueta corta para el registro: interesa distinguir el móvil del PC.
function deviceOf(userAgent) {
  const ua = userAgent || '';
  if (/Android/i.test(ua)) return 'ANDROID';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  if (/Mobile/i.test(ua)) return 'MÓVIL';
  return 'pc';
}

const server = http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel === '/') rel = '/index.html';

  const file = path.join(ROOT, rel);
  // Nada fuera de App/, aunque la petición traiga ../
  if (!path.resolve(file).startsWith(path.resolve(ROOT))) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(file, (err, buf) => {
    const tag = deviceOf(req.headers['user-agent']);
    const when = new Date().toTimeString().slice(0, 8);
    if (err) {
      console.log(`${when} [${tag}] 404 ${req.url}`);
      res.writeHead(404);
      return res.end('No encontrado: ' + rel);
    }
    console.log(`${when} [${tag}] 200 ${req.url}`);
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      // Sin esto el navegador del móvil sirve el index.html viejo de su caché
      // y parece que los cambios no han llegado.
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    });
    res.end(buf);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const nets = os.networkInterfaces();
  const lan = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) lan.push(net.address);
    }
  }
  console.log('');
  console.log('  Odinote web — servidor de pruebas');
  console.log('  ─────────────────────────────────');
  console.log(`  En este PC:   http://localhost:${PORT}`);
  lan.forEach(ip => console.log(`  En el móvil:  http://${ip}:${PORT}`));
  console.log('');
  console.log('  PC:    F12 → Ctrl+Shift+M para emular un móvil.');
  console.log('  Móvil: mismo wifi, abre la URL de arriba. Ctrl+C para parar.');
  console.log('');
});
