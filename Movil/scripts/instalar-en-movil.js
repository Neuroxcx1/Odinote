// =====================================================
// Oddinote para Android — meter el APK en un teléfono enchufado
//
// Esto es el equivalente al Start-Process del escritorio: compilar y no poder
// probarlo no sirve de nada. Con el móvil conectado por USB tarda segundos, y
// evita el baile de subir el archivo a Drive, bajarlo en el teléfono y
// buscarlo en la carpeta de descargas cada vez que se cambia una línea.
//
// Si no hay teléfono a mano no es un error: el APK está hecho y se puede pasar
// a mano. Por eso aquí solo se avisa y se sale en paz.
// =====================================================

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const RAIZ = path.resolve(__dirname, '..');
const HERRAMIENTAS = path.join(process.env.USERPROFILE || 'C:\\Users\\USER', 'android-tools');
const sdk = (process.env.ANDROID_HOME && fs.existsSync(process.env.ANDROID_HOME))
  ? process.env.ANDROID_HOME
  : path.join(HERRAMIENTAS, 'sdk');
const adb = path.join(sdk, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');

if (!fs.existsSync(adb)) {
  console.log('No encuentro adb; no intento instalar nada.');
  process.exit(0);
}

const version = require(path.resolve(RAIZ, '..', 'App', 'package.json')).version;
const apk = path.resolve(RAIZ, '..', 'App', 'dist', 'Oddinote-Android', 'Oddinote-' + version + '.apk');
if (!fs.existsSync(apk)) {
  console.error('No hay APK que instalar en ' + apk);
  process.exit(1);
}

// "adb devices" lista una cabecera y luego un teléfono por línea. Solo cuentan
// los que dicen "device": un "unauthorized" es el móvil esperando a que se
// acepte el aviso de depuración en su pantalla, y un "offline" es el cable.
const lista = spawnSync(adb, ['devices'], { encoding: 'utf8' });
const lineas = (lista.stdout || '').split('\n').slice(1).map(l => l.trim()).filter(Boolean);
const listos = lineas.filter(l => /\bdevice$/.test(l));
const pendientes = lineas.filter(l => /unauthorized|offline/.test(l));

if (!listos.length) {
  console.log('');
  if (pendientes.length) {
    console.log('El teléfono está enchufado pero no da permiso todavía.');
    console.log('Mira su pantalla: sale un aviso de "¿Permitir depuración por USB?" — acéptalo.');
  } else {
    console.log('No hay ningún teléfono enchufado, así que el APK se queda aquí:');
    console.log('  ' + apk);
    console.log('');
    console.log('Para instalarlo por cable, en el teléfono: Ajustes › Información del');
    console.log('teléfono › pulsar siete veces en "Número de compilación" para abrir las');
    console.log('opciones de desarrollador, y ahí encender "Depuración por USB".');
  }
  process.exit(0);
}

console.log('Instalando en ' + listos[0].split(/\s+/)[0] + '…');
const r = spawnSync(adb, ['install', '-r', apk], { encoding: 'utf8' });
const salida = (r.stdout || '') + (r.stderr || '');
console.log(salida.trim());

// El fallo típico al pasar de un APK a otro firmado con distinta clave. Android
// lo cuenta con un nombre que no dice nada, así que se traduce.
if (/INSTALL_FAILED_UPDATE_INCOMPATIBLE|signatures do not match/i.test(salida)) {
  console.log('');
  console.log('Ya hay un Oddinote instalado firmado con otra clave. Hay que desinstalar');
  console.log('el de antes (se van sus notas con él, así que exporta primero si hay algo):');
  console.log('  adb uninstall io.github.neuroxcx1.oddinote');
  process.exit(1);
}
if (r.status !== 0) process.exit(1);
console.log('Listo: ábrelo en el teléfono, se llama Oddinote.');
