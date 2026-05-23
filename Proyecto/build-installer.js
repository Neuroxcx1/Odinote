const winstaller = require('electron-winstaller');
const path = require('path');

async function main() {
  console.log('Building beautiful OdinoteSetup.exe installer...');
  try {
    await winstaller.createWindowsInstaller({
      appDirectory: path.join(__dirname, 'dist', 'Odinote-win32-x64'),
      outputDirectory: path.join(__dirname, 'dist', 'installer'),
      authors: 'Odinote',
      exe: 'Odinote.exe',
      setupExe: 'OdinoteSetup.exe',
      setupIcon: path.join(__dirname, 'Icon', 'Icon.ico'),
      noMsi: true,
      description: 'Tu mente, ordenada en canvases anidados libres e infinitos.'
    });
    console.log('OdinoteSetup.exe installer built successfully inside dist/installer/!');
  } catch (e) {
    console.error('Failed to build installer:', e.message);
    process.exit(1);
  }
}

main();
