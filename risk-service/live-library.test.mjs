import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCsv, recordsForSheet} from './live-library.mjs';

test('CSV multiline quotes and empty rows preserve original row indexing', () => {
  const data = parseCsv('日期,BUG说明,备注\r\n2026/1/1,"换行\n并含""引号""",原因\r\n,,');
  assert.equal(data.length, 3); assert.equal(data[1][1], '换行\n并含"引号"'); assert.deepEqual(data[2], ['', '', '']);
  assert.throws(() => parseCsv('"truncated'));
});
test('merged bug rows retain every note with real source range', () => {
  const rows = new Map([[1, ['日期','BUG说明','','','','','','','备注']], [2,['date','问题','已解决','','','','','','原因']], [3,['','','','','','','','','规避方法']]]);
  const records = recordsForSheet({name:'系统',sheetId:'sheet'}, rows, ['B2:B3']);
  assert.equal(records.length, 1); assert.equal(records[0].issueRef, 'B2:B3'); assert.equal(records[0].notesRef, 'I2:I3');
  assert.match(records[0].notes, /\[I2\] 原因/); assert.match(records[0].notes, /\[I3\] 规避方法/);
});
test('shared merged note references its master cell for both bug rows', () => {
  const rows = new Map([[2,['','问题1','','','','','','','共同复盘']], [3,['','问题2','','','','','','','']]]);
  const records = recordsForSheet({name:'系统',sheetId:'sheet'}, rows, ['I2:I3']);
  assert.equal(records.length, 2); assert.equal(records[1].notes, '共同复盘'); assert.equal(records[1].notesRef, 'I2:I3');
});
