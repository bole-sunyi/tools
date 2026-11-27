import {SOURCE, validateLibrary} from '../risk-alert/search.mjs';
const NODE = 'ZgpG2NdyVXrb196dfR2GBvBr8MwvDqPk';

export function parseCsv(input) {
  const rows = []; let row = [], value = '', quoted = false;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === '"') {
      if (quoted && input[i + 1] === '"') { value += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && (char === ',' || char === '\n')) {
      row.push(value.replace(/\r$/, '')); value = '';
      if (char === '\n') { rows.push(row); row = []; }
    } else value += char;
  }
  if (quoted) throw Error('钉钉返回的 CSV 内容不完整，未更新问题库。');
  if (value || row.length) { row.push(value.replace(/\r$/, '')); rows.push(row); }
  return rows;
}

export function recordsForSheet(sheet, rows, merges = []) {
  const spans = {B: [], I: []};
  for (const range of merges) {
    const m = range.match(/^([BI])(\d+):\1(\d+)$/);
    if (m) spans[m[1]].push({start: +m[2], end: +m[3], ref: range});
  }
  const noteAt = row => {
    const span = spans.I.find(s => s.start <= row && s.end >= row);
    const source = span?.start || row;
    return {ref: span?.ref || 'I' + row, text: rows.get(source)?.[8] || ''};
  };
  const records = [];
  for (const [row, cells] of rows) {
    if (row === 1 || !cells[1]?.trim()) continue;
    const span = spans.B.find(s => s.start === row), end = span?.end || row;
    const notes = new Map();
    for (let n = row; n <= end; n++) { const note = noteAt(n); if (note.text.trim()) notes.set(note.ref, note.text); }
    const notesText = [...notes].map(([ref, text]) => notes.size > 1 ? `[${ref}] ${text}` : text).join('\n\n');
    records.push({id: sheet.sheetId + ':' + row, sheet: sheet.name, sheetId: sheet.sheetId, row, date: cells[0] || '', issue: cells[1], status: cells[2] || '', notes: notesText, issueRef: span?.ref || 'B' + row, notesRef: end > row ? `I${row}:I${end}` : noteAt(row).ref});
  }
  return records;
}

export async function readLiveLibrary(clients, progress = () => {}) {
  const meta = await clients.docs.call('get_document_info', {nodeId: NODE});
  if (meta.extension !== 'axls') throw Error('反馈表的文档类型发生变化，请检查来源。');
  const listed = await clients.sheets.call('get_all_sheets', {nodeId: NODE});
  if (!listed.sheets?.length) throw Error('未读取到反馈表工作表。');
  const records = [], sheetStats = [];
  for (const sheet of listed.sheets) {
    if (!['系统（2026）', '主题', '系统'].includes(sheet.name)) throw Error('发现新的工作表，请先确认问题字段结构。');
    progress(sheet.name);
    const info = await clients.sheets.call('get_sheet', {nodeId: NODE, sheetId: sheet.sheetId});
    const end = info.nonEmptyRange?.lastRow ?? (info.lastNonEmptyRow == null ? 0 : info.lastNonEmptyRow + 1);
    if (!Number.isInteger(end) || end < 1 || end > 10000) throw Error('反馈表行数异常，未更新问题库。');
    const rows = new Map();
    for (let start = 1; start <= end; start += 80) {
      const rangeEnd = Math.min(end, start + 79);
      const chunk = await clients.sheets.call('get_range_as_csv', {nodeId: NODE, sheetId: sheet.sheetId, range: `A${start}:I${rangeEnd}`, annotateRowNumbers: false, maxChars: 200000});
      if (chunk.hasMore) throw Error('反馈表读取被截断，未使用不完整数据。');
      const values = parseCsv(chunk.csv || '');
      const indices = chunk.rowIndices;
      if (indices && indices.length !== values.length) throw Error('反馈表行号与内容不一致，未更新问题库。');
      if (!indices && values.length !== rangeEnd - start + 1) throw Error('反馈表读取范围不完整，未更新问题库。');
      values.forEach((value, i) => rows.set(indices?.[i] ?? start + i, value));
    }
    if (!rows.get(1)?.[1]?.includes('BUG说明') || !rows.get(1)?.[8]?.includes('备注')) throw Error('反馈表字段位置发生变化，未更新问题库。');
    const found = recordsForSheet(sheet, rows, info.mergedRanges || []);
    records.push(...found); sheetStats.push({name: sheet.name, records: found.length});
  }
  return validateLibrary({schemaVersion: 1, sourceUrl: SOURCE, sourceName: meta.name || '测试BUG记录', fetchedAt: new Date().toISOString(), sourceUpdatedAt: meta.updateTime ? new Date(meta.updateTime).toISOString() : undefined, sourceMode: 'local-mcp', coverage: '钉钉 MCP 只读获取三个工作表的 BUG说明（B列）与备注（I列），含合并单元格；不含图片/附件', cacheSeconds: 60, sheets: sheetStats, records});
}
