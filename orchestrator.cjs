const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const microservicesDir = path.join(__dirname, 'microservices');
const logsDir = path.join(__dirname, 'Logs');

if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}
const logFile = path.join(logsDir, 'ecosystem.log');

// Función para registrar en archivo y opcionalmente en consola
function writeLog(prefix, message, isError = false, toConsole = true) {
  const timestamp = new Date().toISOString();
  const cleanMsg = message.replace(/\x1b\[[0-9;]*m/g, ''); // Remover colores ANSI para el archivo
  const logLine = `[${timestamp}] ${prefix} ${cleanMsg}\n`;
  fs.appendFileSync(logFile, logLine);
  if (toConsole) {
    if (isError) {
      process.stderr.write(message + '\n');
    } else {
      process.stdout.write(message + '\n');
    }
  }
}

const services = [
  { dir: 'antigravity-link-local', cmd: 'npm run start:public' },
  { dir: 'gpt-5.4-mini-lab', cmd: 'npm run dev' },
  { dir: 'Nodriza-Core', cmd: 'npm run dev:all' },
  { dir: 'omni-drive-dashboard', cmd: 'npm run dev -- -p 3006' },
  { dir: 'omniverso-hypervisor', cmd: 'npm run dev' }, // Usa puerto 3000
  { dir: 'qr-generator-system', cmd: 'npm run dev -- --port 3007' },
  { dir: 'status.civer.cloud', cmd: 'npm run dev' },
  { dir: 'sitio-descarga', cmd: 'set PORT=4000 && node server.js' }, // Forzar puerto 4000 para evitar colisión con hypervisor
  { dir: 'boveda-credenciales', cmd: 'python vault-server.py --port 5000' },
  { dir: 'visual-md5-viewer', cmd: 'npx serve -p 3011' },
  { dir: 'api-system/Email-API/devops-gui', cmd: 'npm run dev -- --port 3001' },
  { dir: 'profeonline', cmd: 'npx serve -p 3012' },
  { dir: 'streamit-flutter_v1.4.0/streamit-laravel-flutter-v1.4.0', cmd: 'npx serve -p 8000' }, // Fallback estático en lugar de PHP para evitar crasheos
  { dir: 'vps-manager-project', cmd: 'python check_instances.py' }
];

const colors = ['\x1b[32m', '\x1b[33m', '\x1b[34m', '\x1b[35m', '\x1b[36m', '\x1b[92m', '\x1b[93m', '\x1b[94m', '\x1b[95m', '\x1b[96m'];
const resetColor = '\x1b[0m';

writeLog('[ORQUESTADOR]', '\x1b[36m======================================================');
writeLog('[ORQUESTADOR]', '   CIVER CLOUD MANAGER IDE - ORQUESTADOR UNIVERSAL    ');
writeLog('[ORQUESTADOR]', '======================================================\x1b[0m');
writeLog('[INFO]', 'Los logs ultra verbosos se están guardando en Logs/ecosystem.log');

services.forEach((service, index) => {
  const fullPath = path.join(microservicesDir, service.dir);
  if (!fs.existsSync(fullPath)) {
    writeLog('[ERROR]', `\x1b[31mDirectorio no encontrado: ${service.dir}${resetColor}`, true);
    return;
  }

  const color = colors[index % colors.length];
  writeLog('[BOOT]', `${color}Iniciando ${service.dir} => ${service.cmd}${resetColor}`);

  const child = spawn(service.cmd, { cwd: fullPath, shell: true, stdio: 'pipe' });

  child.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(l => l.trim() !== '');
    lines.forEach(l => writeLog(`[${service.dir}]`, `${color}${l}${resetColor}`, false, false));
  });

  child.stderr.on('data', (data) => {
    const lines = data.toString().split('\n').filter(l => l.trim() !== '');
    lines.forEach(l => writeLog(`[${service.dir}]`, `\x1b[31m${l}${resetColor}`, true, false));
  });

  child.on('close', (code) => {
    writeLog('[EXIT]', `${color}${service.dir} terminó (Exit: ${code})${resetColor}`);
  });
});
