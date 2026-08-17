const { spawn, exec } = require('child_process');

const url = 'http://localhost:8787/desktop.html';
const platform = process.platform;
if (!['darwin', 'win32'].includes(platform)) {
  console.warn(`当前系统 ${platform} 未提供专用启动脚本，将继续启动服务。`);
}

const server = spawn(process.execPath, ['phone-transfer/server.js'], { stdio: 'inherit' });
const openBrowser = platform === 'win32'
  ? `start "" "${url}"`
  : `open "${url}"`;

setTimeout(() => exec(openBrowser), 1000);
server.on('exit', code => process.exit(code || 0));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.kill(signal));
