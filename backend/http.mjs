import { cookie, digest, fail, requireRule, uid } from './request.mjs';
import account from './routes/account.mjs';
import admin from './routes/admin.mjs';
import battle from './routes/battle.mjs';
import directory from './routes/directory.mjs';

const routes = { ...account, ...admin, ...battle, ...directory };
const authPaths=new Set(['/api/auth','/api/recover','/api/recovery-key']);
const limit=150000;

export const securityHeaders = {
  'X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'strict-origin-when-cross-origin',
  'Content-Security-Policy':"default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; base-uri 'none'; frame-ancestors 'self'"
};
export const assets={
  '/':['index.html','text/html'],
  '/app.js':['app.js','text/javascript'],
  '/shared.js':['shared.js','text/javascript'],
  '/style.css':['style.css','text/css'],
  '/arena.svg':['arena.svg','image/svg+xml'],
  '/robots.txt':['robots.txt','text/plain']
};

async function readBody(request, origin) {
  requireRule(!request.headers.has('origin')||request.headers.get('origin')===origin,'Cross-origin request denied.',403);
  requireRule(!request.headers.has('sec-fetch-site')||['same-origin','none'].includes(request.headers.get('sec-fetch-site')),'Cross-origin request denied.',403);
  requireRule(request.headers.get('content-type')?.split(';')[0]==='application/json','Expected JSON.',415);
  const reader=request.body?.getReader();
  const decoder=new TextDecoder();
  let raw='', bytes=0;
  if (reader) {
    while (true) {
      const {value,done}=await reader.read();
      if(done)break;
      bytes+=value.length;
      if(bytes>limit){await reader.cancel();fail('Request is too large.',413);}
      raw+=decoder.decode(value,{stream:true});
    }
    raw+=decoder.decode();
  }
  let body;
  try{body=JSON.parse(raw);}catch{fail('Invalid JSON.');}
  requireRule(body&&typeof body==='object'&&!Array.isArray(body),'Expected an object.');
  return body;
}

export function createHandler({ withStore, readAsset, env={}, legacyPassword }) {
  const attempts=new Map();
  function rateLimit(key,path){
    const now=Date.now();
    for(const [id,bucket] of attempts)if(bucket.until<=now)attempts.delete(id);
    const id=path+' '+key;
    const bucket=attempts.get(id)??{count:0,until:now+600000};
    requireRule(bucket.count<(authPaths.has(path)?20:30),'Too many attempts. Try again in ten minutes.',429);
    bucket.count++;
    attempts.set(id,bucket);
  }
  return async (request,address='unknown')=>{
    const url=new URL(request.url), method=request.method;
    const headers=new Headers(securityHeaders);
    if(!url.pathname.startsWith('/api/')){
      const asset=Object.hasOwn(assets,url.pathname)?assets[url.pathname]:null;
      if(!asset||!['GET','HEAD'].includes(method))return new Response('Page not found',{status:404,headers});
      headers.set('Content-Type',asset[1]+'; charset=utf-8');
      return new Response(method==='HEAD'?null:await readAsset(asset[0]),{headers});
    }
    headers.set('Cache-Control','no-store');
    const handle=routes[method+' '+url.pathname];
    try {
      if(method==='GET'&&url.pathname==='/api/health'){
        const revision=await withStore(false, storage=>storage.one('SELECT version FROM write_revision WHERE id=1'));
        requireRule(revision,'Database is being initialized.',503);
        return Response.json({status:'ok',database:'ready'},{headers});
      }
      requireRule(handle,'Page not found.',404);
      const mutating=method!=='GET';
      const body=mutating?await readBody(request,url.origin):{};
      if(authPaths.has(url.pathname)||['/api/request','/api/helpful','/api/battle/start'].includes(url.pathname))rateLimit(address,url.pathname);
      const cookies=Object.fromEntries((request.headers.get('cookie')??'').split(';').map(pair=>pair.trim().split('=')));
      const token=/^[a-f0-9]{64}$/.test(cookies.fmp_session??'')?cookies.fmp_session:null;
      const tokenDigest=token?await digest(token):null;
      const secure=env.FMP_SECURE_COOKIES==='1'||url.protocol==='https:';
      const validGuest=/^[a-f0-9]{32}$/.test(cookies.fmp_guest??'');
      const guest=validGuest?cookies.fmp_guest:uid();
      const result=await withStore(mutating,async storage=>{
        const cookies=[];
        const session=tokenDigest?await storage.one('SELECT user_id FROM sessions WHERE token=? AND expires>?',tokenDigest,Date.now()):null;
        const u=session?await storage.getUser(session.user_id):null;
        const c=await storage.config();
        const data=await handle({method,params:url.searchParams,body,u,guest,token,headers:cookies,secure,c,storage,env,legacyPassword});
        return {data,cookies};
      });
      if(!validGuest)headers.append('Set-Cookie',cookie('fmp_guest',guest,60*60*24*30,secure));
      for(const item of result.cookies)headers.append('Set-Cookie',item);
      return Response.json(result.data,{headers});
    }catch(error){
      if(!error.status)console.error(error);
      return Response.json({error:error.status?error.message:'Something went wrong. Try again.'},{status:error.status??500,headers});
    }
  };
}
