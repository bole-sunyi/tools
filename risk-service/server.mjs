// Private read-only snapshot service. Never deploy the snapshot into GitHub Pages.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {timingSafeEqual} from 'node:crypto';
import {validateLibrary} from '../risk-alert/search.mjs';
const {RISK_TOKEN,RISK_LIBRARY,RISK_ORIGIN='https://bole-sunyi.github.io',PORT='8787',HOST='127.0.0.1'}=process.env;
if(!RISK_TOKEN||RISK_TOKEN.length<24||!RISK_LIBRARY)throw Error('Set RISK_TOKEN (>=24 chars) and absolute RISK_LIBRARY path.');
function equal(a,b){const aa=Buffer.from(a),bb=Buffer.from(b);return aa.length===bb.length&&timingSafeEqual(aa,bb);}
const server=http.createServer(async(req,res)=>{
 const origin=req.headers.origin;
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Type','application/json; charset=utf-8');
 if(origin&&origin!==RISK_ORIGIN){res.writeHead(403);res.end('{"error":"Origin denied"}');return;}
 if(origin){res.setHeader('Access-Control-Allow-Origin',RISK_ORIGIN);res.setHeader('Vary','Origin');}
 if(req.method==='OPTIONS'){res.setHeader('Access-Control-Allow-Methods','GET, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Authorization');res.writeHead(204);res.end();return;}
 if(req.url!=='/library'||req.method!=='GET'){res.writeHead(404);res.end('{"error":"Not found"}');return;}
 if(!equal(req.headers.authorization||'','Bearer '+RISK_TOKEN)){res.writeHead(401);res.end('{"error":"Unauthorized"}');return;}
 try{const data=validateLibrary(JSON.parse(await readFile(RISK_LIBRARY,'utf8')));res.end(JSON.stringify(data));}catch{res.writeHead(503);res.end('{"error":"Library unavailable or invalid"}');}
});
server.requestTimeout=10000;server.headersTimeout=10000;server.listen(Number(PORT),HOST,()=>console.log(`Read-only risk service on ${HOST}:${PORT}. No automatic DingTalk sync configured.`));
