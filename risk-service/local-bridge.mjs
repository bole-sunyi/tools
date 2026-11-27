import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {configuredClients} from './mcp-client.mjs';
import {readLiveLibrary} from './live-library.mjs';

const HOST = '127.0.0.1', PORT = 18787;
const localOrigin = `http://${HOST}:${PORT}`;
const allowed = new Set(['https://bole-sunyi.github.io', localOrigin]);
const root = fileURLToPath(new URL('..', import.meta.url));
let clients, cached, pending, progress = '';
async function library(force) {
  if (pending) return pending;
  if (!force && cached && Date.now() - Date.parse(cached.fetchedAt) < 60000) return cached;
  pending = (async () => {
    clients ||= await configuredClients();
    const next = await readLiveLibrary(clients, value => { progress = value; });
    cached = next; return next;
  })().catch(error => { clients = null; cached = null; throw error; }).finally(() => { pending = null; progress = ''; });
  return pending;
}
function json(res, code, value) { res.writeHead(code, {'Content-Type': 'application/json; charset=utf-8'}); res.end(JSON.stringify(value)); }
const server = http.createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.headers.host !== `${HOST}:${PORT}` && req.headers.host !== `localhost:${PORT}`) return json(res, 403, {error: 'Host denied'});
  const origin = req.headers.origin;
  if (origin && !allowed.has(origin)) return json(res, 403, {error: 'Origin denied'});
  if (origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
  if (req.method === 'OPTIONS') {
    if (!origin || !allowed.has(origin)) return json(res, 403, {error: 'Origin denied'});
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-Risk-Reader');
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    res.writeHead(204); res.end(); return;
  }
  const url = new URL(req.url, localOrigin);
  if (req.method !== 'GET') return json(res, 405, {error: 'Read only'});
  if (url.pathname === '/health') return json(res, 200, {service: 'local-risk-reader', version: 1, reading: !!pending, progress});
  if (url.pathname === '/library') {
    const sameOrigin = !origin && req.headers['sec-fetch-site'] === 'same-origin';
    if (!(origin && allowed.has(origin) || sameOrigin) || req.headers['x-risk-reader'] !== '1') return json(res, 403, {error: 'Reader origin required'});
    try { return json(res, 200, await library(url.searchParams.get('refresh') === '1')); }
    catch (error) { return json(res, 503, {error: error.message}); }
  }
  // Same-origin fallback for browsers that do not allow public pages to access localhost.
  if (url.pathname === '/' || url.pathname === '/app') { res.writeHead(302, {Location: '/app/'}); res.end(); return; }
  if (url.pathname === '/app/' || url.pathname.startsWith('/app/')) {
    let relative;
    try { relative = decodeURIComponent(url.pathname.slice('/app/'.length)) || 'index.html'; } catch { return json(res, 400, {error: 'Invalid path'}); }
    const base = path.join(root, 'risk-alert'), target = path.resolve(base, relative);
    if (!target.startsWith(base + path.sep)) return json(res, 403, {error: 'Path denied'});
    try {
      const data = await readFile(target);
      res.writeHead(200, {'Content-Type': ({'.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css', '.txt': 'text/plain'})[path.extname(target)] || 'application/octet-stream'}); res.end(data); return;
    } catch { return json(res, 404, {error: 'Not found'}); }
  }
  return json(res, 404, {error: 'Not found'});
});
server.requestTimeout = 200000; server.headersTimeout = 10000;
function openApp() { const child = spawn('open', [localOrigin + '/app/'], {stdio: 'ignore'}); child.on('error', () => {}); child.unref(); }
server.on('error', async error => {
  if (error.code === 'EADDRINUSE') {
    try {
      const health = await fetch(localOrigin + '/health', {signal: AbortSignal.timeout(2000)}).then(r => r.json());
      if (health.service === 'local-risk-reader') { console.log('本机服务已在运行，正在打开工具。'); if (process.argv.includes('--open')) openApp(); return; }
    } catch {}
    console.error('端口 18787 已被其他程序占用，请检查后重试。'); process.exitCode = 1;
  } else { console.error('本机服务启动失败。'); process.exitCode = 1; }
});
server.listen(PORT, HOST, () => {
  console.log(`本机钉钉读取服务已启动：${localOrigin}/app/`);
  console.log('使用时保持此窗口运行；按 Ctrl+C 停止。MCP 凭据仅从本机配置读取。');
  if (process.argv.includes('--open')) openApp();
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
