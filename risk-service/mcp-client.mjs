import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
const exec = promisify(execFile);

export async function configuredClients() {
  let value;
  try {
    const {stdout} = await exec(process.env.RISK_PYTHON || 'python3', [fileURLToPath(new URL('./read-config.py', import.meta.url))], {timeout: 10000, maxBuffer: 1024 * 1024});
    value = JSON.parse(stdout);
  } catch { throw Error('无法读取本机钉钉 MCP 配置。请确认 python3 支持 tomllib，且已配置 dingtalk-sheets 与 dingtalk-docs。'); }
  return {sheets: new McpClient(value['dingtalk-sheets']), docs: new McpClient(value['dingtalk-docs'])};
}

export class McpClient {
  constructor(config) { this.config = config; this.id = 0; this.session = null; this.tools = null; this.ready = null; }
  async rpc(method, params, notification = false) {
    const id = notification ? undefined : ++this.id;
    const headers = {...this.config.headers, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream'};
    if (this.session) headers['Mcp-Session-Id'] = this.session;
    if (method !== 'initialize') headers['MCP-Protocol-Version'] = this.protocol || '2024-11-05';
    let response;
    try { response = await fetch(this.config.url, {method: 'POST', headers, body: JSON.stringify({jsonrpc: '2.0', ...(id === undefined ? {} : {id}), method, params}), signal: AbortSignal.timeout(90000), redirect: 'error'}); }
    catch { throw Error('钉钉 MCP 连接失败或超时，请检查网络和本机配置。'); }
    if (!response.ok) { await response.body?.cancel(); throw Error(`钉钉 MCP 返回 HTTP ${response.status}。请检查连接授权。`); }
    if (response.headers.get('mcp-session-id')) this.session = response.headers.get('mcp-session-id');
    if (notification || response.status === 202 || response.status === 204) { await response.body?.cancel(); return null; }
    let envelope;
    if ((response.headers.get('content-type') || '').includes('text/event-stream')) {
      const reader = response.body.getReader(), decoder = new TextDecoder();
      let buffer = '';
      try {
        while (!envelope) {
          const {done, value} = await reader.read();
          buffer = (buffer + decoder.decode(value || new Uint8Array(), {stream: !done})).replace(/\r\n/g, '\n');
          let end;
          while ((end = buffer.indexOf('\n\n')) >= 0) {
            const frame = buffer.slice(0, end); buffer = buffer.slice(end + 2);
            const payload = frame.split('\n').filter(s => s.startsWith('data:')).map(s => s.slice(5).trimStart()).join('\n');
            if (!payload) continue;
            const data = JSON.parse(payload); if (data.id === id) { envelope = data; break; }
          }
          if (done) break;
        }
      } finally { await reader.cancel(); }
    } else envelope = await response.json();
    if (!envelope || envelope.id !== id) throw Error('钉钉 MCP 响应格式不匹配。');
    if (envelope.error) throw Error(`钉钉 MCP 调用失败（${envelope.error.code || 'RPC'}）。`);
    return envelope.result;
  }
  async init() {
    if (!this.ready) this.ready = (async () => {
      const initialized = await this.rpc('initialize', {protocolVersion: '2024-11-05', capabilities: {}, clientInfo: {name: 'local-risk-reader', version: '1.0.0'}});
      this.protocol = initialized.protocolVersion;
      await this.rpc('notifications/initialized', {}, true);
      this.tools = (await this.rpc('tools/list', {})).tools;
    })().catch(error => { this.ready = null; throw error; });
    return this.ready;
  }
  async call(name, args) {
    await this.init();
    const tool = this.tools.find(t => t.name === name || t.name.endsWith('__' + name));
    if (!tool) throw Error(`钉钉 MCP 未提供 ${name} 读取工具。`);
    const raw = await this.rpc('tools/call', {name: tool.name, arguments: args});
    if (raw?.isError) throw Error(`钉钉读取失败：${name}。请检查表格访问权限。`);
    let data = raw.structuredContent;
    if (!data) {
      for (const item of raw.content || []) if (item.type === 'text') { try { data = JSON.parse(item.text); break; } catch {} }
    }
    if (!data || data.success === false) throw Error(`钉钉未返回有效表格数据：${name}。`);
    return data;
  }
}
