import {SOURCE,validateLibrary,createIndex,search} from './search.mjs';
const $=id=>document.getElementById(id);
let library=null,index=null,results=[],shown=0,report='',generation=0,libraryVersion=0,extracting=false;
function status(id,text,error=false){$(id).textContent=text;$(id).classList.toggle('error',error);}
function invalidate(){results=[];shown=0;report='';$('results').replaceChildren();$('export').disabled=true;$('more').hidden=true;status('result-status','需求或问题库已变更，请重新检索。');}
function loadLibrary(data){library=validateLibrary(data);index=createIndex(library.records);invalidate();$('search').disabled=extracting;status('library-status',`已加载 ${library.records.length} 条历史问题 · 快照读取时间：${new Date(library.fetchedAt).toLocaleString('zh-CN')}`);$('coverage').textContent=`${library.coverage||'覆盖范围未声明'}。来源文档修改时间：${library.sourceUpdatedAt?new Date(library.sourceUpdatedAt).toLocaleString('zh-CN'):'未提供'}。这不是实时钉钉数据；图片/附件内容未纳入检索。`;}
function unsetLibrary(){library=index=null;$('search').disabled=true;$('coverage').textContent='';invalidate();}
$('library').addEventListener('change',async e=>{const version=++libraryVersion;unsetLibrary();try{const f=e.target.files[0];if(!f)return;if(f.size>30*1024*1024)throw Error('问题库文件过大。');const data=JSON.parse(await f.text());if(version!==libraryVersion)return;loadLibrary(data);}catch(err){status('library-status','加载失败：'+err.message,true);}});
$('connect').onclick=async()=>{const version=++libraryVersion;unsetLibrary();$('connect').disabled=true;const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),20000);try{const url=new URL($('endpoint').value);if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)))throw Error('服务必须使用 HTTPS；仅本机调试允许 HTTP。');if(url.username||url.password||url.search||url.hash)throw Error('服务地址不能包含账号、查询参数或片段。');if(!$('token').value.trim())throw Error('请输入访问口令。');url.pathname=url.pathname.replace(/\/$/,'')+'/library';status('library-status','正在读取受保护的问题库……');const r=await fetch(url,{headers:{Authorization:'Bearer '+$('token').value},cache:'no-store',redirect:'error',signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});if(!r.ok)throw Error(`服务返回 ${r.status}，请检查口令与服务配置。`);const data=await r.json();if(version!==libraryVersion)return;loadLibrary(data);}catch(err){status('library-status','读取失败：'+err.message,true);}finally{clearTimeout(timer);$('token').value='';$('connect').disabled=false;}};
$('query').oninput=invalidate;$('mode').onchange=invalidate;
const scripts=new Map();
async function script(url,name){if(window[name])return window[name];if(!scripts.has(url))scripts.set(url,new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=url;s.crossOrigin='anonymous';s.onload=()=>resolve(window[name]);s.onerror=()=>{scripts.delete(url);reject(Error('解析组件下载失败，请检查网络后重试。'));};document.head.append(s);}));return scripts.get(url);}
let ocr=null;
async function extract(file){
 const ext=file.name.split('.').pop().toLowerCase();
 if(['txt','md'].includes(ext))return file.text();
 if(ext==='docx'){const mammoth=await script('https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js','mammoth');return (await mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()})).value;}
 if(ext==='pdf'){
  const pdfjs=await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs');pdfjs.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';
  const doc=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false}).promise;
  try{if(doc.numPages>200)throw Error('PDF 超过 200 页，请拆分。');let pages=[];for(let n=1;n<=doc.numPages;n++){const page=await doc.getPage(n);const t=await page.getTextContent();pages.push(t.items.map(i=>i.str+(i.hasEOL?'\n':' ')).join(''));}return pages.join('\n');}finally{await doc.destroy();}
 }
 if(['png','jpg','jpeg','webp'].includes(ext)){
  const bitmap=await createImageBitmap(file);const pixels=bitmap.width*bitmap.height;bitmap.close();if(pixels>24000000)throw Error('截图超过 2400 万像素，请缩小。');
  const Tesseract=await script('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js','Tesseract');
  if(!ocr)ocr=await Tesseract.createWorker('chi_sim+eng',1,{logger:m=>{if(m.status==='recognizing text')status('extract-status',`本机识别截图中……${Math.round((m.progress||0)*100)}%`);}});
  return (await ocr.recognize(file)).data.text;
 }
 throw Error('不支持此文件格式，请使用截图、PDF、DOCX、TXT 或 MD。');
}
$('requirements').onchange=async e=>{
 const run=++generation,files=[...e.target.files];if(!files.length)return;extracting=true;invalidate();$('requirements').disabled=true;$('search').disabled=true;let texts=[],logs=[];
 try{if(files.length>12)throw Error('单次最多 12 个文件，请分批上传。');for(const f of files){try{status('extract-status','正在读取：'+f.name);if(f.size>20*1024*1024)throw Error('超过 20 MB');const text=(await extract(f)).trim();if(!text)throw Error('未提取到文字，扫描 PDF 请转成截图');texts.push(`【文件：${f.name}】\n${text}`);logs.push(`✓ ${f.name}`);}catch(err){logs.push(`✗ ${f.name}：${err.message}`);}if(run!==generation)return;}
  const combined=[$('query').value,...texts].filter(Boolean).join('\n\n');if(combined.length>100000)throw Error('提取内容超过 10 万字，请拆分需求；本次内容未加入。');$('query').value=combined;status('extract-status',logs.join('\n')+'\n请核对文字后点击检索。失败文件未参与检索。',logs.some(l=>l.startsWith('✗')));
 }catch(err){status('extract-status',err.message,true);}finally{if(run===generation){extracting=false;$('requirements').disabled=false;$('search').disabled=!library;}}
};
function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
function evidence(r){return [...(r.matches.length?['原文词：'+r.matches.join('、')]:[]),...r.aliases.map(a=>`别名/机制：${a.input} → ${a.source}`),...r.typos.map(a=>`拼写近似：${a.input} → ${a.source}`)].join('；');}
function renderMore(){
 for(const r of results.slice(shown,shown+20)){const d=r.record,card=el('article',undefined,'result');card.append(el('span',r.label,'badge'),el('p',`${d.sheet} · 第 ${d.row} 行 · ${d.date||'日期未填'} · 历史状态：${d.status||'未填'}`,'source'),el('p',evidence(r),'evidence'),el('h3','历史问题原文'),el('pre',d.issue),el('h3','重点核查依据（原表备注，不是新推测）'),el('pre',d.notes||'原表未填写备注；请依据上方历史问题核查，不额外推断原因。'));
  const link=el('a',`查看来源表 ↗（${d.sheet}，${d.issueRef||'B'+d.row} / ${d.notesRef||'I'+d.row}；打开后按行号查找）`);link.href=SOURCE;link.target='_blank';link.rel='noopener';card.append(link,el('p','请确认本次需求是否包含上述历史情形。此记录不能证明当前功能存在同一问题。','muted'));$('results').append(card);
 }shown=Math.min(shown+20,results.length);$('more').hidden=shown>=results.length;
}
$('more').onclick=renderMore;
$('search').onclick=()=>{
 if(!index)return;if($('query').value.trim().length<2){status('result-status','请先上传文件，或输入至少两个字的功能内容。',true);return;}
 results=search(index,$('query').value,$('mode').value);shown=0;$('results').replaceChildren();renderMore();
 const count=new Set(results.map(r=>r.record.id)).size;status('result-status',count?`找到 ${count} 条相似历史反馈（按文字相关性排序，并非出现频率或风险等级）。先显示 ${Math.min(count,20)} 条，可继续展开。`:'汇总表文字记录中未检索到相关记录，不代表不存在风险。可补充功能名称、玩法机制或扩大匹配范围。');
 report=`# 历史反馈风险提示\n\n来源：${SOURCE}\n快照读取时间：${library.fetchedAt}\n覆盖：${library.coverage||'未声明'}\n匹配范围：${$('mode').selectedOptions[0].text}\n注意：历史记录不证明当前功能存在相同 Bug；不含图片/附件内容。\n\n## 当前需求\n${$('query').value}\n\n`+(results.length?results.map(r=>`## ${r.label} · ${r.record.sheet} 第${r.record.row}行\n历史状态：${r.record.status}\n匹配依据：${evidence(r)}\n\n历史问题原文：\n${r.record.issue}\n\n重点核查依据（原表备注）：\n${r.record.notes||'未填'}\n\n来源：${SOURCE}（${r.record.issueRef||'B'+r.record.row} / ${r.record.notesRef||'I'+r.record.row}）\n`).join('\n'):'汇总表中未检索到相关记录，不代表不存在风险。');$('export').disabled=false;
};
$('export').onclick=()=>{const url=URL.createObjectURL(new Blob([report],{type:'text/markdown;charset=utf-8'}));const a=el('a');a.href=url;a.download='历史反馈风险提示.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('clear').onclick=async()=>{++generation;++libraryVersion;extracting=false;unsetLibrary();for(const id of ['library','requirements','query','token'])$(id).value='';$('coverage').textContent='';$('requirements').disabled=false;status('library-status','本页问题库与需求内容已清除。');status('extract-status','');status('result-status','等待检索。');if(ocr){const worker=ocr;ocr=null;await worker.terminate();}};
