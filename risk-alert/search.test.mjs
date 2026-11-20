import test from 'node:test';
import assert from 'node:assert/strict';
import {SOURCE,validateLibrary,createIndex,search} from './search.mjs';
// Synthetic algorithm fixtures only; not actual feedback and never shown in UI.
const records=[
 {id:'a',sheet:'系统',row:2,issue:'webstore coupon 购买收奖',notes:'断线后重新登录核查奖励',status:'已解决'},
 {id:'b',sheet:'主题',row:3,issue:'竖版布局遮挡',notes:'查看宽屏布局',status:'未解决'},
 {id:'c',sheet:'系统',row:4,issue:'mansion upgrade',notes:'测试数据',status:'已解决'}
];
const index=createIndex(records);
test('exact quote has source identity',()=>{const r=search(index,'竖版布局遮挡');assert.equal(r[0].record,records[1]);assert.equal(r[0].label,'原文直接命中');});
test('fuzzy alias and mechanism',()=>{const r=search(index,'网页商店优惠券掉线重连');assert.equal(r[0].record.id,'a');assert.ok(r[0].aliases.some(a=>a.input==='网页商店'&&a.source==='webstore'));});
test('english typo with corroborating context',()=>assert.equal(search(index,'mansoin upgrade')[0].record.id,'c'));
test('unknown does not invent results',()=>assert.deepEqual(search(index,'量子隧穿紫罗兰引擎'),[]));
test('generic words do not trigger',()=>assert.deepEqual(search(index,'活动功能需求内容问题测试'),[]));
test('single distinctive alias is retrieved with provenance',()=>{assert.equal(search(index,'优惠券')[0].record.id,'a');assert.equal(search(index,'网页商店')[0].record.id,'a');assert.equal(search(index,'优惠券','strict').length,0);});
test('two-letter generic english does not match',()=>assert.deepEqual(search(index,'in'),[]));
test('resolved records remain historical facts',()=>assert.equal(search(index,'webstore coupon')[0].record.status,'已解决'));
test('library wrong source is rejected',()=>assert.throws(()=>validateLibrary({schemaVersion:1,sourceUrl:'https://example.com',records})));
test('missing row or empty library fails closed',()=>{assert.throws(()=>validateLibrary({schemaVersion:1,sourceUrl:SOURCE,records:[],fetchedAt:new Date().toISOString()}));assert.throws(()=>validateLibrary({schemaVersion:1,sourceUrl:SOURCE,records:[{...records[0],row:0}],fetchedAt:new Date().toISOString()}));});
test('duplicate provenance rejected',()=>assert.throws(()=>validateLibrary({schemaVersion:1,sourceUrl:SOURCE,records:[records[0],records[0]],fetchedAt:new Date().toISOString()})));
