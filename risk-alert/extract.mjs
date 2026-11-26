// Parsers return content only. File names and UI labels are not used as search terms.
const scripts = new Map();
export async function script(url, name) {
  if (window[name]) return window[name];
  if (!scripts.has(url)) scripts.set(url, new Promise((resolve, reject) => {
    const tag = document.createElement('script');
    tag.src = url;
    tag.crossOrigin = 'anonymous';
    tag.onload = () => resolve(window[name]);
    tag.onerror = () => { scripts.delete(url); reject(Error('解析组件加载失败，请检查网络后重试。')); };
    document.head.append(tag);
  }));
  return scripts.get(url);
}

export function cleanLine(text) {
  return String(text || '').replace(/\r/g, '').replace(/[ \u3000]+/g, ' ')
    .replace(/([\u3400-\u9fff]) +(?=[\u3400-\u9fff])/g, '$1')
    .replace(/ +([，。！？；：、）】])/g, '$1').trim();
}
const numbered = text => /^(?:[（(]?\d+[.)）、．]|[一二三四五六七八九十]+[、．]|[•●▪◆]|[-*]\s)/.test(text);
const ended = text => /[。！？!?；;：:）】]$/.test(text);

// Retain actual paragraph boundaries and lists; join only geometric line wraps.
export function formatOcr(data) {
  const original = String(data.text || '').replace(/\r\n?/g, '\n').trim();
  const paragraphs = data.paragraphs?.length ? data.paragraphs : [{lines: data.lines || []}];
  if (!paragraphs.some(p => p.lines?.length)) return {original, formatted: original.split('\n').map(cleanLine).join('\n').replace(/\n{3,}/g, '\n\n')};
  const formatted = paragraphs.map(paragraph => {
    const lines = paragraph.lines.filter(l => l.text?.trim());
    const right = Math.max(...lines.map(l => l.bbox?.x1 || 0));
    const out = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i], prev = lines[i - 1];
      const text = cleanLine(line.text);
      if (!prev) { out.push(text); continue; }
      const box = line.bbox, pbox = prev.bbox;
      const height = Math.max(1, pbox ? pbox.y1 - pbox.y0 : 20);
      const previous = cleanLine(prev.text);
      const columns = l => (l.words || []).some((w, j, words) => j && w.bbox && words[j-1].bbox && w.bbox.x0 - words[j-1].bbox.x1 > height * 2.5);
      const wrapped = box && pbox && !columns(prev) && !columns(line)
        && right - pbox.x1 < height * 1.8 && Math.abs(box.x0 - pbox.x0) < height * 1.3
        && box.y0 - pbox.y1 < height * 1.1 && previous.length >= 14
        && !ended(previous) && !numbered(text) && !numbered(previous);
      if (wrapped) {
        const space = /[a-z0-9]$/i.test(out.at(-1)) && /^[a-z0-9]/i.test(text) ? ' ' : '';
        out[out.length - 1] += space + text;
      } else out.push(text);
    }
    return out.join('\n');
  }).filter(Boolean).join('\n\n');
  return {original, formatted: formatted || original};
}

export function excelText(workbook, XLSX) {
  let count = 0, length = 0;
  const sections = [];
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name], rows = new Map();
    for (const key of Object.keys(sheet)) {
      if (!/^[A-Z]+[1-9]\d*$/.test(key)) continue;
      const cell = sheet[key];
      if (cell.v == null && !cell.f) continue;
      if (++count > 100000) throw Error('Excel 非空单元格超过 10 万个，请拆分文件。');
      const value = String(cell.v == null ? '公式：=' + cell.f : XLSX.utils.format_cell(cell) || cell.v).trim();
      if (!value) continue;
      length += value.length;
      if (length > 100000) throw Error('Excel 内容超过 10 万字，请拆分需求。');
      const [, col, row] = key.match(/^([A-Z]+)(\d+)$/);
      const column = [...col].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0);
      if (!rows.has(+row)) rows.set(+row, []);
      rows.get(+row).push({column, value});
    }
    if (!rows.size) continue;
    const text = [...rows].sort((a, b) => a[0] - b[0]).map(([row, cells]) => {
      const values = cells.sort((a, b) => a.column - b.column).map(c => c.value.replace(/\r\n?/g, '\n').replace(/\n/g, '\n    '));
      return `第 ${row} 行｜` + values.join('　｜　');
    }).join('\n');
    sections.push(`【工作表：${name}】\n${text}`);
  }
  return sections.join('\n\n');
}

let ocr = null;
export async function stopOcr() { if (ocr) { const worker = ocr; ocr = null; await worker.terminate(); } }
export async function extract(file, progress = () => {}) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (['xlsx', 'xls', 'csv'].includes(ext)) {
    const XLSX = await script(new URL('./vendor/xlsx.full.min.js', import.meta.url).href, 'XLSX');
    const bytes = await file.arrayBuffer();
    const head = new Uint8Array(bytes);
    if (ext === 'xlsx' && !(head[0] === 0x50 && head[1] === 0x4b)) throw Error('文件不是有效的 XLSX 工作簿，请检查文件格式。');
    const workbook = XLSX.read(bytes, {type: 'array', cellDates: false, codepage: ext === 'csv' ? 65001 : undefined});
    return {kind: 'excel', text: excelText(workbook, XLSX), hint: `${workbook.SheetNames.length} 个工作表（仅提取单元格文字与缓存值，不读取内嵌图片）`};
  }
  if (['txt', 'md'].includes(ext)) return {kind: 'text', text: await file.text()};
  if (ext === 'docx') {
    const mammoth = await script('https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js', 'mammoth');
    return {kind: 'word', text: (await mammoth.extractRawText({arrayBuffer: await file.arrayBuffer()})).value};
  }
  if (ext === 'pdf') {
    const pdfjs = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';
    const doc = await pdfjs.getDocument({data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false}).promise;
    try {
      if (doc.numPages > 200) throw Error('PDF 超过 200 页，请拆分。');
      const pages = [];
      for (let n = 1; n <= doc.numPages; n++) {
        const content = await (await doc.getPage(n)).getTextContent();
        pages.push(content.items.map(i => i.str + (i.hasEOL ? '\n' : ' ')).join(''));
      }
      return {kind: 'pdf', text: pages.join('\n\n')};
    } finally { await doc.destroy(); }
  }
  if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
    const bitmap = await createImageBitmap(file), pixels = bitmap.width * bitmap.height;
    bitmap.close();
    if (pixels > 24000000) throw Error('截图超过 2400 万像素，请缩小。');
    const Tesseract = await script('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js', 'Tesseract');
    if (!ocr) ocr = await Tesseract.createWorker('chi_sim+eng');
    progress('正在识别截图文字…');
    const {data} = await ocr.recognize(file);
    const {original, formatted} = formatOcr(data);
    return {kind: 'image', text: formatted, original, formatted, layout: 'paragraph'};
  }
  throw Error('不支持此文件格式，请使用 Excel、截图、PDF、DOCX、TXT 或 MD。');
}
