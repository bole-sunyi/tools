// Extractive retrieval only: no generative model and no synthesized bug claims.
export const SOURCE = 'https://alidocs.dingtalk.com/i/nodes/ZgpG2NdyVXrb196dfR2GBvBr8MwvDqPk';
const groups = [
 ['网店','webstore','web store','网页商店','网站商店'],
 ['收奖','领奖','领取奖励','奖励领取'], ['到账','收到奖励','奖励发放','发奖'],
 ['断线','掉线','断网','网络中断'], ['重登','重新登录','重新登陆','重连'],
 ['coupon','优惠券','折扣券'], ['pass','通行证'], ['token','代币'],
 ['spin','spins','旋转'], ['byd','build your dream'], ['ios','iphone','苹果'],
 ['ipad','平板'], ['崩溃','闪退','crash'], ['卡死','卡住','无响应'],
 ['多语','多语言','本地化'], ['竖版','竖屏'], ['横版','横屏'],
 ['abtest','ab test','a/b','实验组','对照组'], ['购买','付费','支付','充值'],
 ['小游戏','mini game','minigame'], ['活动中心','activity center'],
 ['赛季','season'], ['结束时间','end_time'], ['金币','coins','coin'],
 ['道具','物品'], ['进度','progress'], ['礼包','bundle'], ['签到','login bonus']
];
const stop = new Set(['活动','功能','需求','内容','问题','测试','玩家','需要','相关','进行','可以','显示','一个','这个','是否','情况','时候','没有','导致','出现','正常','当前','我们','你们','以及','中的','本次','the','and','with','that']);
export function norm(s){return String(s??'').normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();}
function has(text,term){return /^[a-z0-9 ]+$/.test(term) ? new RegExp('(^|[^a-z0-9])'+term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?=$|[^a-z0-9])').test(text):text.includes(term);}
function tokens(text){
 const out = new Set();
 for(const w of norm(text).match(/[a-z][a-z0-9_]*(?:-[a-z0-9]+)*|\d{4,}|[\u4e00-\u9fff]+/g)||[]){
  if(/^[\u4e00-\u9fff]+$/.test(w)){for(let i=0;i<w.length-1;i++){const t=w.slice(i,i+2);if(!stop.has(t))out.add(t);}}
  else if(!stop.has(w)&&w.length>2)out.add(w);
 }
 return out;
}
function oneEdit(a,b){if(a.length<5||b.length<5||Math.abs(a.length-b.length)>1)return false;if(a.length===b.length){const diffs=[...a].map((c,i)=>c!==b[i]?i:-1).filter(i=>i>=0);if(diffs.length===2&&diffs[1]===diffs[0]+1&&a[diffs[0]]===b[diffs[1]]&&a[diffs[1]]===b[diffs[0]])return true;}let i=0,j=0,n=0;while(i<a.length&&j<b.length){if(a[i]===b[j]){i++;j++;}else{if(++n>1)return false;if(a.length>=b.length)i++;if(b.length>=a.length)j++;}}return n+(a.length-i)+(b.length-j)===1;}
export function validateLibrary(data){
 if(data?.schemaVersion!==1||data.sourceUrl!==SOURCE||!Array.isArray(data.records)||!data.records.length||data.records.length>20000)throw Error('不是此反馈表的问题库，或问题库为空。');
 if(!Number.isFinite(Date.parse(data.fetchedAt)))throw Error('问题库缺少有效读取时间。');
 const ids=new Set();
 for(const r of data.records){if(typeof r.issue!=='string'||!r.issue.trim()||typeof r.notes!=='string'||typeof r.sheet!=='string'||!Number.isInteger(r.row)||r.row<2||!['系统（2026）','主题','系统'].includes(r.sheet)||!r.id||ids.has(r.id))throw Error('问题库记录或来源行号无效。');ids.add(r.id);}
 return data;
}
export function createIndex(records){
 const docs=records.map(r=>({r,text:norm(r.issue+' '+r.notes),tokens:tokens(r.issue+' '+r.notes)}));
 const df=new Map();for(const d of docs)for(const t of d.tokens)df.set(t,(df.get(t)||0)+1);
 return {docs,df,N:docs.length};
}
export function search(index,query,mode='standard'){
 const q=norm(query);if(q.length<2||stop.has(q)||(/^[a-z]+$/.test(q)&&q.length<3))return [];
 const qt=tokens(q);const qg=groups.map(g=>({g,hits:g.filter(t=>has(q,t))})).filter(x=>x.hits.length);
 // When a named feature is present, standard mode stays on that feature.
 // Broad mode also exposes cross-feature mechanism candidates.
 const featureNames = new Set(['网店','coupon','pass','byd','签到']);
 const featureGroups = qg.filter(x=>featureNames.has(x.g[0]));
 const allEnglish=[...qt].filter(t=>/^[a-z]{5,}$/.test(t));
 let results=[];
 for(const d of index.docs){
  const featureMatches = featureGroups.filter(x=>x.g.some(t=>has(d.text,t))).length;
  if(mode!=='broad'&&featureGroups.length&&!featureMatches)continue;
  let lexical=0;const matches=[];const aliases=[];const typos=[];
  for(const t of qt){if(d.tokens.has(t)){let weight=Math.log(1+index.N/(1+(index.df.get(t)||0)));if(/^\d/.test(t))weight*=1.5;lexical+=weight;matches.push(t);}}
  for(const {g,hits} of qg){const found=g.filter(t=>has(d.text,t));if(found.length)aliases.push({input:hits[0],source:found[0]});}
  if(mode!=='strict')for(const t of allEnglish){if(d.tokens.has(t))continue;const found=[...d.tokens].find(x=>/^[a-z]+$/.test(x)&&oneEdit(t,x));if(found)typos.push({input:t,source:found});}
  const distinctive=aliases.some(a=>groups.filter(g=>['网店','coupon','pass','byd','小游戏','礼包','签到'].includes(g[0])).some(g=>g.includes(a.input)));
  const exact=q.length<=60&&has(d.text,q);
  const score=lexical+aliases.length*3+typos.length*2+(exact?8:0)+featureMatches*15;
  // Short/common overlaps cannot silently become a confident functional match.
  const pass=exact||(mode==='strict'?(matches.length>=2&&lexical>=7):(mode==='broad'?(lexical>=4.5||aliases.length>=1||typos.length>=1):(lexical>=7&&matches.length>=2||aliases.length>=2||distinctive||aliases.length>=1&&lexical>=3||typos.length>=1&&matches.some(t=>/^[a-z]{4,}$/.test(t)))));
  if(pass)results.push({record:d.r,score:Math.round(score*10)/10,matches,aliases,typos,label:exact?'原文直接命中':aliases.some(a=>a.input!==a.source)?'别名 / 机制相似，需确认':typos.length?'拼写近似，需确认':'文字相似，需确认'});
 }
 return results.sort((a,b)=>b.score-a.score||a.record.id.localeCompare(b.record.id));
}
