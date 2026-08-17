// Pruebas del acceso a Google Drive que no caduca (PKCE + token de refresco).
//   node scripts/test-oauth.js
//
// main.js no se puede cargar desde Node (necesita Electron), así que aquí se
// comprueban dos cosas distintas: que la CUENTA del método PKCE es la correcta
// —contra el ejemplo oficial de la norma— y que main.js pide a Google los
// parámetros sin los cuales no hay token de refresco. Son justo los detalles que
// hacen que esto funcione o que falle en silencio dentro de una hora.
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

let fallos = 0;
const check = (nombre, ok, extra) => {
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${extra ? ' — ' + extra : ''}`);
  if (!ok) fallos++;
};

const main = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf-8');
const preload = fs.readFileSync(path.join(__dirname, '..', 'preload.js'), 'utf-8');

// ── La cuenta de PKCE, contra el ejemplo oficial (RFC 7636, apéndice B) ──
const base64url = (buf) =>
  buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const verificadorEjemplo = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const retoEsperado = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
const reto = base64url(crypto.createHash('sha256').update(verificadorEjemplo).digest());
check('el reto PKCE coincide con el ejemplo oficial de la norma',
  reto === retoEsperado, reto);

check('el reto no lleva caracteres que haya que escapar en una URL',
  !/[+/=]/.test(reto));

// ── main.js pide lo que hace falta ──
check('se pide access_type=offline (sin esto NO hay token de refresco)',
  /access_type:\s*'offline'/.test(main));
check('se pide prompt=consent (sin esto solo lo daría la primera vez)',
  /prompt:\s*'consent'/.test(main));
check('el método del reto es S256, no "plain"',
  /code_challenge_method:\s*'S256'/.test(main));
check('se manda el verificador al canjear el código',
  /code_verifier:\s*verificador/.test(main));
check('se pide el permiso de Drive',
  /auth\/drive\.file/.test(main));

// ── Las credenciales ──
// Google EXIGE el secreto también en los clientes de escritorio, aunque se use
// PKCE: sin él el canje falla con "client_secret is missing". Así que tiene que
// mandarse, pero NO puede estar escrito en el código: la protección de GitHub
// bloquea la subida en cuanto lo reconoce. Vive en google-oauth.json, que está
// fuera del repositorio y sí entra en el ejecutable al empaquetar.
const APP_DIR = path.join(__dirname, '..');
const fuentes = ['main.js', 'preload.js', 'src/app.jsx', 'google-oauth.example.json']
  .map(f => ({ f, txt: fs.readFileSync(path.join(APP_DIR, f), 'utf-8') }));

fuentes.forEach(({ f, txt }) => {
  check(`no hay credenciales escritas en ${f}`,
    !/GOCSPX-[A-Za-z0-9_-]{10,}/.test(txt) &&
    !/\d{10,}-[a-z0-9]{20,}\.apps\.googleusercontent\.com/.test(txt));
});

check('las credenciales se leen de google-oauth.json',
  /google-oauth\.json/.test(main) && /function leeCredenciales/.test(main));
check('el secreto se manda al canjear el código (sin él Google rechaza)',
  /client_secret: GOOGLE_CLIENT_SECRET,[\s\S]{0,120}grant_type: 'authorization_code'/.test(main));
check('…y también al renovar con el token de refresco',
  /client_secret: GOOGLE_CLIENT_SECRET,[\s\S]{0,120}grant_type: 'refresh_token'/.test(main));
check('sin credenciales se avisa con todas las letras, no se falla en silencio',
  /sin-credenciales/.test(main));
check('hay un ejemplo con instrucciones para quien compile',
  fs.existsSync(path.join(APP_DIR, 'google-oauth.example.json')));

// Y que el archivo de verdad no pueda subirse ni por descuido
const gitignore = fs.readFileSync(path.join(APP_DIR, '..', '.gitignore'), 'utf-8');
check('google-oauth.json está en .gitignore',
  /App\/google-oauth\.json/.test(gitignore));

// ── El token de refresco se guarda cifrado, o no se guarda ──
check('el token de refresco se cifra con safeStorage',
  /safeStorage\.encryptString/.test(main));
check('si no hay cifrado disponible NO se escribe en claro',
  /isEncryptionAvailable\(\)/.test(main) &&
  /no se guarda el token de refresco/.test(main));
check('se borra el token cuando Google dice que ya no vale',
  /invalid_grant[\s\S]{0,80}borraRefresco\(\)/.test(main));

// ── La respuesta de Google se comprueba antes de fiarse ──
check('se rechaza una respuesta cuyo estado no cuadra',
  /estado\s*!==\s*pkceState/.test(main));
check('el verificador es de un solo uso',
  /pkceVerifier\s*=\s*null;\s*pkceState\s*=\s*null/.test(main));

// ── El puente con la aplicación ──
['googleRefreshAccess', 'googleHasRefresh', 'googleSignOut'].forEach(fn => {
  check(`preload.js expone ${fn}`, preload.includes(fn));
});
['google-refresh-access', 'google-has-refresh', 'google-sign-out'].forEach(canal => {
  check(`main.js atiende el canal ${canal}`, main.includes(`'${canal}'`));
});

// ── La aplicación renueva antes de que caduque, no después ──
const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.jsx'), 'utf-8');
check('la aplicación intenta renovar sola antes de dar la sesión por perdida',
  /const nuevo = await renuevaAccesoDrive\(\)/.test(app));
check('se renueva a los 50 minutos, antes de la hora en que caduca',
  /50 \* 60 \* 1000/.test(app));

console.log(fallos ? `\n${fallos} FALLOS` : '\nTodo correcto');
process.exit(fallos ? 1 : 0);
