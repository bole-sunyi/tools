export const LOCAL_READER = 'http://127.0.0.1:18787';
async function read(path, timeout, headers = {}) {
  let response;
  try { response = await fetch(LOCAL_READER + path, {method: 'GET', mode: 'cors', credentials: 'omit', cache: 'no-store', redirect: 'error', headers, signal: AbortSignal.timeout(timeout)}); }
  catch { throw Error('未连接到本机服务，请启动「启动风险提示工具.command」；若浏览器拦截本地连接，可使用本机入口。'); }
  const value = await response.json();
  if (!response.ok) throw Error(value.error || '本机读取失败，请检查服务窗口。');
  return value;
}
export async function localHealth() {
  const value = await read('/health', 4000);
  if (value.service !== 'local-risk-reader' || value.version !== 1) throw Error('本机读取端口被其他程序占用。');
  return value;
}
export async function readLocalLibrary(force = false) { return read('/library' + (force ? '?refresh=1' : ''), 180000, {'X-Risk-Reader': '1'}); }
