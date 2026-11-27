import {SOURCE, validateLibrary, createIndex, search} from './search.mjs?v=2';
import {extract, stopOcr} from './extract.mjs?v=2';
import {localHealth, readLocalLibrary} from './local-reader.mjs?v=3';

const $ = id => document.getElementById(id);
let library = null, index = null, documents = [], selected = 0;
let results = [], shown = 0, view = 'history', report = '', parsing = false, generation = 0, libraryVersion = 0;
let libraryConnection = 'import', localPending = null;
const el = (tag, text, cls) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (cls) node.className = cls; return node; };
function status(id, message, error = false) { $(id).textContent = message; $(id).classList.toggle('error', error); }
function settings(open) { $('settings').hidden = !open; $('settings-toggle').setAttribute('aria-expanded', String(open)); }
$('settings-toggle').onclick = () => settings($('settings').hidden);
$('library-open').onclick = () => connectLocal(false);
$('refresh-library').onclick = () => connectLocal(true);
$('settings-close').onclick = () => settings(false);
function step(current) { ['upload', 'review', 'results'].forEach((name, i) => { $('step-' + name).className = i === current ? 'active' : i < current ? 'done' : ''; }); }
function saveEditor() { if (documents[selected]) documents[selected].text = $('query').value; }
function content() { return documents.map(d => d.text).filter(Boolean).join('\n\n'); }
function count() { $('char-count').textContent = `${documents.length} 个文件 · ${content().length.toLocaleString('zh-CN')} 字`; }
function invalidate() {
  results = []; report = ''; shown = 0;
  $('results').replaceChildren(); $('export').disabled = true; $('more').hidden = true;
  $('result-panel').hidden = true;
  step(documents.length ? 1 : 0);
}
function showDocument(n) {
  selected = n;
  const d = documents[n]; if (!d) return;
  $('query').value = d.text; $('file-select').value = String(n);
  $('ocr-options').hidden = d.kind !== 'image';
  $('ocr-layout').value = d.layout || 'paragraph';
  $('review-note').textContent = d.hint || (d.kind === 'image' ? '已按文字位置整理段落，保留列表。可切换查看原始换行；切换会恢复对应解析版本。' : d.kind === 'excel' ? '按工作表和原始行号提取。多行单元格保留换行。' : '核对内容后可直接修改，再点击重新匹配。');
  count();
}
function refreshDocuments() {
  $('file-select').replaceChildren(...documents.map((d, i) => { const option = el('option', d.name); option.value = String(i); return option; }));
  $('review-panel').hidden = !documents.length;
  $('reset').hidden = !documents.length;
  $('upload-panel').classList.toggle('compact', !!documents.length);
  if (documents.length) showDocument(Math.min(selected, documents.length - 1));
}
$('file-select').onchange = e => { saveEditor(); showDocument(+e.target.value); };
$('query').oninput = () => { saveEditor(); count(); invalidate(); };
$('mode').onchange = () => { if (index && documents.length && !parsing) match(); };
$('ocr-layout').onchange = e => { const d = documents[selected]; if (!d || d.kind !== 'image') return; d.layout = e.target.value; d.text = d.layout === 'original' ? d.original : d.formatted; showDocument(selected); invalidate(); };

function loadLibrary(data, connection = 'import') {
  const validated = validateLibrary(data);
  library = validated; index = createIndex(library.records); libraryConnection = connection;
  $('library-dot').classList.add('ready');
  const local = connection === 'local';
  status('library-status', local ? `本机钉钉已连接 · ${library.records.length} 条问题 · ${new Date(library.fetchedAt).toLocaleTimeString('zh-CN')} 读取` : `测试BUG记录 · ${library.records.length} 条历史问题 · 快照 ${new Date(library.fetchedAt).toLocaleDateString('zh-CN')}`);
  $('library-open').textContent = '重新连接'; $('refresh-library').hidden = !local; $('local-fallback').hidden = local;
  $('coverage').textContent = `${library.coverage || '覆盖范围未声明'}。读取时间：${new Date(library.fetchedAt).toLocaleString('zh-CN')}。` + (local ? '通过本机 MCP 读取，最多缓存 1 分钟；刷新问题库可立即重新读取。' : '当前是手动导入的快照。');
  settings(false); invalidate();
  if (documents.length && !parsing) match();
}
function unsetLibrary() {
  library = index = null; invalidate();
  $('library-dot').classList.remove('ready'); $('library-open').textContent = '连接本机'; $('refresh-library').hidden = true;
  status('library-status', '本机问题库待连接 · 可以先上传需求文件');
  $('coverage').textContent = '启动本机服务后，会自动通过现有钉钉 MCP 读取汇总表。';
}
async function connectLocal(force = false, quiet = false) {
  if (localPending) return localPending;
  const version = ++libraryVersion;
  if (libraryConnection === 'local') unsetLibrary();
  $('library-open').disabled = true; $('refresh-library').disabled = true;
  localPending = (async () => {
    try {
      if (!quiet || !library) status('library-status', '正在连接本机钉钉读取服务…');
      await localHealth();
      if (version !== libraryVersion) return;
      status('library-status', '已连接本机，正在读取钉钉汇总表…');
      const data = await readLocalLibrary(force);
      if (version === libraryVersion) loadLibrary(data, 'local');
    } catch (error) {
      if (version === libraryVersion) {
        status('library-status', library ? '本机连接失败，当前使用已导入的问题库快照。' : error.message, true);
        $('local-fallback').hidden = false;
      }
    } finally {
      localPending = null; $('library-open').disabled = false; $('refresh-library').disabled = false;
    }
  })();
  return localPending;
}
$('library').onchange = async e => {
  const version = ++libraryVersion, file = e.target.files[0]; if (!file) return;
  unsetLibrary();
  try {
    if (file.size > 30 * 1024 * 1024) throw Error('问题库文件超过 30 MB。');
    const data = JSON.parse(await file.text());
    if (version === libraryVersion) loadLibrary(data);
  } catch (error) { if (version === libraryVersion) status('library-status', '问题库加载失败：' + error.message, true); }
};
$('connect').onclick = async () => {
  const version = ++libraryVersion; unsetLibrary(); $('connect').disabled = true;
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 20000);
  try {
    const url = new URL($('endpoint').value);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) throw Error('服务地址需要 HTTPS。');
    if (url.username || url.password || url.search || url.hash) throw Error('服务地址不能包含账号、查询参数或片段。');
    if (!$('token').value.trim()) throw Error('请输入访问口令。');
    url.pathname = url.pathname.replace(/\/$/, '') + '/library';
    status('library-status', '正在读取问题库…');
    const response = await fetch(url, {headers: {Authorization: 'Bearer ' + $('token').value}, cache: 'no-store', redirect: 'error', signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer'});
    if (!response.ok) throw Error(`服务返回 ${response.status}，请检查配置。`);
    const data = await response.json(); if (version === libraryVersion) loadLibrary(data);
  } catch (error) { if (version === libraryVersion) status('library-status', '读取失败：' + error.message, true); }
  finally { clearTimeout(timer); $('token').value = ''; $('connect').disabled = false; }
};
$('clear-library').onclick = () => { ++libraryVersion; unsetLibrary(); $('library').value = ''; $('token').value = ''; };

function fileRow(name, state, failed = false) {
  const row = el('li', undefined, failed ? 'error' : ''); row.append(el('span', name), el('span', state)); $('file-list').append(row); return row;
}
async function upload(files) {
  if (parsing || !files.length) return;
  if (files.length > 12) { status('extract-status', '每次最多 12 个文件，请分批上传。', true); return; }
  const run = ++generation, useLocal = libraryConnection === 'local' || !index;
  parsing = true; documents = []; selected = 0; invalidate(); refreshDocuments();
  $('file-list').replaceChildren(); $('requirements').disabled = true; $('search').disabled = true;
  let total = 0, failures = 0;
  for (const file of files) {
    const row = fileRow(file.name, '解析中…');
    try {
      status('extract-status', `正在解析 ${file.name}…`);
      if (file.size > 20 * 1024 * 1024) throw Error('超过 20 MB');
      const parsed = await extract(file, message => { if (run === generation) status('extract-status', file.name + ' · ' + message); });
      if (run !== generation) return;
      parsed.text = parsed.text.trim();
      if (!parsed.text) throw Error('未提取到文字；扫描 PDF 请转成截图');
      if (total + parsed.text.length > 100000) throw Error('累计内容超过 10 万字，请拆分');
      total += parsed.text.length; documents.push({...parsed, name: file.name});
      row.lastChild.textContent = `${parsed.text.length.toLocaleString('zh-CN')} 字 · 已解析`;
    } catch (error) {
      if (run !== generation) return;
      failures++; row.className = 'error'; row.lastChild.textContent = '解析失败'; row.firstChild.textContent = file.name + '：' + error.message;
    }
  }
  if (run !== generation) return;
  parsing = false; $('requirements').disabled = false; $('requirements').value = ''; $('search').disabled = false;
  refreshDocuments(); step(documents.length ? 1 : 0);
  status('extract-status', `已解析 ${documents.length} 个文件${failures ? `，${failures} 个失败（未参与匹配）` : ''}。` + (documents.length && !index ? '加载问题库后会自动匹配。' : ''), !!failures);
  if (documents.length && useLocal) await connectLocal(false, true);
  else if (documents.length && index) match();
}
$('requirements').onchange = e => upload([...e.target.files]);
for (const type of ['dragover', 'dragleave', 'drop']) $('dropzone').addEventListener(type, event => {
  event.preventDefault(); $('dropzone').classList.toggle('dragover', type === 'dragover');
  if (type === 'drop') upload([...event.dataTransfer.files]);
});
$('manual').onclick = () => { if (parsing) return; saveEditor(); documents.push({name: '手动补充内容', kind: 'text', text: ''}); selected = documents.length - 1; refreshDocuments(); invalidate(); $('query').focus(); };
$('reset').onclick = async () => {
  ++generation; documents = []; selected = 0; parsing = false;
  $('requirements').disabled = false; $('requirements').value = ''; $('search').disabled = false;
  $('query').value = ''; $('file-list').replaceChildren(); status('extract-status', '选择新文件后会重新解析。');
  invalidate(); refreshDocuments(); await stopOcr();
};

function evidence(result) {
  return [...(result.matches.length ? ['原文词：' + result.matches.join('、')] : []), ...result.aliases.map(a => `${a.input} → ${a.source}`), ...result.typos.map(a => `拼写近似：${a.input} → ${a.source}`)].join('；');
}
function visibleResults() { return view === 'focus' ? results.filter(r => r.record.notes.trim()) : results; }
function issueText(issue) { return issue.match(/【问题描述】\s*([\s\S]*)/)?.[1]?.trim() || issue; }
function renderMore() {
  const list = visibleResults();
  for (const result of list.slice(shown, shown + 10)) {
    const record = result.record, card = el('article', undefined, 'result');
    const top = el('div', undefined, 'record-top');
    top.append(el('span', result.label, 'badge'), el('span', `${record.date || '日期未填'} · ${record.status || '状态未填'}`, 'record-meta'));
    card.append(top);
    if (view === 'focus') card.append(el('p', issueText(record.issue), 'issue-context'));
    card.append(el('pre', view === 'focus' ? record.notes : issueText(record.issue), view === 'focus' ? 'focus-text' : ''));
    const detail = el('details');
    detail.append(el('summary', view === 'focus' ? '查看对应的历史问题与匹配依据' : '查看原表复盘与匹配依据'));
    if (view === 'focus') detail.append(el('pre', record.issue));
    else {
      if (issueText(record.issue) !== record.issue) detail.append(el('pre', record.issue));
      if (record.notes.trim()) detail.append(el('pre', record.notes));
    }
    detail.append(el('p', evidence(result), 'evidence')); card.append(detail);
    const source = el('div', undefined, 'source');
    source.append(el('span', `${record.sheet} · 第 ${record.row} 行`));
    const link = el('a', '查看反馈原表 ↗'); link.href = SOURCE; link.target = '_blank'; link.rel = 'noopener';
    link.title = `${record.issueRef || 'B' + record.row} / ${record.notesRef || 'I' + record.row}，打开后按行号查找`;
    source.append(link); card.append(source); $('results').append(card);
  }
  shown = Math.min(shown + 10, list.length); $('more').hidden = shown >= list.length;
}
function switchView(next) {
  view = next; shown = 0; $('results').replaceChildren();
  for (const name of ['history', 'focus']) { $('tab-' + name).classList.toggle('selected', name === view); $('tab-' + name).setAttribute('aria-selected', String(name === view)); }
  $('results').setAttribute('aria-labelledby', 'tab-' + view);
  $('view-description').textContent = view === 'focus' ? '引用匹配记录中的原因、漏测复盘与处理备注，作为本次重点核查的依据。' : '以下为反馈表中的历史问题，按与本次内容的相关程度排序。';
  if (!visibleResults().length) $('results').append(el('div', view === 'focus' && results.length ? '命中的历史问题未填写备注，可切换查看已经出现过的问题。' : '汇总表中未检索到相关记录。可补充功能名称或扩大匹配范围；未命中不代表不存在风险。', 'empty'));
  renderMore();
}
$('tab-history').onclick = () => switchView('history'); $('tab-focus').onclick = () => switchView('focus');
for (const name of ['history', 'focus']) $('tab-' + name).onkeydown = e => { if (['ArrowLeft', 'ArrowRight'].includes(e.key)) { e.preventDefault(); const next = name === 'history' ? 'focus' : 'history'; switchView(next); $('tab-' + next).focus(); } };
$('more').onclick = renderMore;
function match() {
  saveEditor();
  if (parsing) return;
  if (!index) { settings(true); status('extract-status', '内容已解析。请加载「测试BUG记录」问题库，加载后自动匹配。'); $('settings').scrollIntoView({behavior: 'smooth'}); return; }
  const text = content().trim();
  if (text.length < 2 || text.length > 100000) { status('extract-status', '请输入至少两个字的需求内容，总字数不超过 10 万。', true); return; }
  results = search(index, text, $('mode').value);
  $('result-panel').hidden = false; step(2);
  $('history-count').textContent = results.length; $('focus-count').textContent = results.filter(r => r.record.notes.trim()).length;
  status('result-status', `基于 ${documents.length} 个文件的解析内容 · 命中 ${results.length} 条历史记录 · ${libraryConnection === 'local' ? '本机 MCP 读取于 ' + new Date(library.fetchedAt).toLocaleString('zh-CN') : '问题库快照 ' + new Date(library.fetchedAt).toLocaleDateString('zh-CN')}`);
  switchView('history');
  report = `# 历史反馈风险提示\n\n来源：${SOURCE}\n问题库读取时间：${library.fetchedAt}\n匹配范围：${$('mode').selectedOptions[0].text}\n历史记录需结合本次需求确认。\n\n## 本次解析内容\n` + documents.map(d => `### ${d.name}\n${d.text}`).join('\n\n') + '\n\n' + (results.length ? results.map(r => `## 已经出现过的问题\n${r.record.issue}\n\n重点关注依据（反馈表原备注）：\n${r.record.notes || '原表未填写备注'}\n\n来源：${r.record.sheet}，第 ${r.record.row} 行（${r.record.issueRef || 'B' + r.record.row} / ${r.record.notesRef || 'I' + r.record.row}）\n匹配依据：${evidence(r)}\n`).join('\n') : '汇总表中未检索到相关记录，不代表不存在风险。');
  $('export').disabled = false;
}
$('search').onclick = match;
$('export').onclick = () => {
  const url = URL.createObjectURL(new Blob([report], {type: 'text/markdown;charset=utf-8'}));
  const link = el('a'); link.href = url; link.download = '历史反馈风险提示.md'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
};

connectLocal(false, true);
