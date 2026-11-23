import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { db, config, getUser } from './backend/storage.mjs';
import { cookie, digest, fail, requireRule, uid } from './backend/request.mjs';
import account from './backend/routes/account.mjs';
import admin from './backend/routes/admin.mjs';
import battle from './backend/routes/battle.mjs';
import directory from './backend/routes/directory.mjs';

const routes = { ...account, ...admin, ...battle, ...directory };
const attempts=new Map();
function authLimit(key){
  const now=Date.now();
  for(const [id,bucket] of attempts) if(bucket.until<=now) attempts.delete(id);
  const bucket=attempts.get(key)??{count:0,until:now+600000};
  requireRule(bucket.count<20,'Too many sign-in attempts. Try again in ten minutes.',429);
  bucket.count++;attempts.set(key,bucket);
}
const assets={'/':'index.html','/app.js':'app.js','/shared.js':'shared.js','/style.css':'style.css','/arena.svg':'arena.svg'};
const mime={html:'text/html',js:'text/javascript',css:'text/css',svg:'image/svg+xml'};
const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  const headers=[];
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; base-uri 'none'; frame-ancestors 'self'");
  if(!url.pathname.startsWith('/api/')){
    const asset=assets[url.pathname];
    if(!asset||!existsSync(new URL('./public/'+asset,import.meta.url))){res.writeHead(404);res.end('Page not found');return;}
    res.writeHead(200,{'Content-Type':mime[asset.split('.').pop()]+'; charset=utf-8'});
    res.end(readFileSync(new URL('./public/'+asset,import.meta.url)));return;
  }
  let status=200, output;
  try{
    const method=req.method;
    const cookies=Object.fromEntries((req.headers.cookie??'').split(';').map(pair=>pair.trim().split('=')));
    const token=/^[a-f0-9]{64}$/.test(cookies.fmp_session??'')?cookies.fmp_session:null;
    const secure=process.env.FMP_SECURE_COOKIES==='1'||Boolean(req.socket.encrypted);
    let guest=/^[a-f0-9]{32}$/.test(cookies.fmp_guest??'')?cookies.fmp_guest:null;
    if(!guest){guest=uid();headers.push(cookie('fmp_guest',guest,60*60*24*30,secure));}
    let body={};
    if(method!=='GET'){
      requireRule(!req.headers['sec-fetch-site']||['same-origin','none'].includes(req.headers['sec-fetch-site']),'Cross-origin request denied.',403);
      requireRule(req.headers['content-type']?.split(';')[0]==='application/json','Expected JSON.',415);
      let raw='';
      for await(const chunk of req){raw+=chunk;requireRule(raw.length<=150000,'Request is too large.',413);}
      try{body=JSON.parse(raw);}catch{fail('Invalid JSON.');}
      requireRule(body&&typeof body==='object'&&!Array.isArray(body),'Expected an object.');
      if(['/api/auth','/api/recover','/api/recovery-key'].includes(url.pathname))authLimit(req.socket.remoteAddress);
    }
    if(method!=='GET')db.exec('BEGIN IMMEDIATE');
    try{
      const handle = routes[method+' '+url.pathname];
      if (!handle) fail('Page not found.',404);
      const session=token?db.prepare('SELECT user_id FROM sessions WHERE token=? AND expires>?').get(digest(token),Date.now()):null;
      const u=session?getUser(session.user_id):null;
      output=handle({method,params:url.searchParams,body,u,guest,token,headers,secure,c:config()});
      if(method!=='GET')db.exec('COMMIT');
    }catch(error){if(method!=='GET')db.exec('ROLLBACK');throw error;}
  }catch(error){
    status=error.status??500;output={error:error.status?error.message:'Something went wrong. Try again.'};
    if(status===500)console.error(error);
  }
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Set-Cookie':headers});
  res.end(JSON.stringify(output));
});
const port=Number(process.env.PORT??3000);
server.listen(port,process.env.HOST??'127.0.0.1',()=>console.log('Fight My Professor is running at http://127.0.0.1:'+server.address().port));
