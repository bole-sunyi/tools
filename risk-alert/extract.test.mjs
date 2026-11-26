import test from 'node:test';
import assert from 'node:assert/strict';
import {formatOcr, cleanLine} from './extract.mjs';

test('OCR joins a wrapped Chinese paragraph using line geometry', () => {
  const output = formatOcr({text: '购买礼包后玩家需要领取全部奖励\n然后断网重连检查到账情况', paragraphs: [{lines: [
    {text: '购 买 礼 包 后 玩家需要领取全部奖励', bbox: {x0: 10, y0: 10, x1: 400, y1: 30}},
    {text: '然后断网重连检查到账情况', bbox: {x0: 10, y0: 36, x1: 300, y1: 56}}
  ]}]});
  assert.equal(output.formatted, '购买礼包后玩家需要领取全部奖励然后断网重连检查到账情况');
  assert.ok(output.original.includes('\n'));
});
test('OCR retains list items, paragraph breaks, and English spaces', () => {
  const data = {text: 'raw', paragraphs: [{lines: [
    {text: '1. purchase reward', bbox: {x0: 10, y0: 10, x1: 400, y1: 30}},
    {text: '2. reconnect reward', bbox: {x0: 10, y0: 36, x1: 400, y1: 56}}
  ]}, {lines: [{text: 'WEBSTORE COUPON', bbox: {x0: 10, y0: 90, x1: 300, y1: 110}}]}]};
  assert.equal(formatOcr(data).formatted, '1. purchase reward\n2. reconnect reward\n\nWEBSTORE COUPON');
});
test('OCR does not merge wide-gap table rows or completed sentences', () => {
  const lines = [
    {text: '活动名称 购买道具及对应奖励', bbox: {x0: 0, y0: 0, x1: 400, y1: 20}, words: [{bbox:{x0:0,x1:70}},{bbox:{x0:200,x1:400}}]},
    {text: '领奖说明 检查领取数量', bbox: {x0: 0, y0: 26, x1: 400, y1: 46}}
  ];
  assert.ok(formatOcr({text:'',lines}).formatted.includes('\n'));
  assert.equal(cleanLine('网 店 优 惠 券 WEBSTORE COUPON ，'), '网店优惠券 WEBSTORE COUPON，');
});
test('plain OCR fallback retains original line boundaries', () => {
  assert.equal(formatOcr({text:'网 店\n领 奖\n\n核 对'}).formatted, '网店\n领奖\n\n核对');
});
