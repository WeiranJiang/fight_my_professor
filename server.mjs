import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { scryptSync, timingSafeEqual } from 'node:crypto';
import { openSQLite } from './backend/sqlite.mjs';
import { createHandler } from './backend/http.mjs';

function legacyPassword(password,stored){
  const [salt,hash]=stored.split(':');
  if(!/^[a-f0-9]{128}$/.test(hash??''))return false;
  return timingSafeEqual(scryptSync(password,salt,64),Buffer.from(hash,'hex'));
}

const handle=createHandler({
  withStore:openSQLite(process.env.FMP_DB || 'data/fmp.sqlite'),
  readAsset:name=>readFile(new URL('./public/'+name,import.meta.url)),
  env:process.env,
  legacyPassword
});
const server=createServer(async(req,res)=>{
  try{
    const scheme=process.env.FMP_SECURE_COOKIES==='1'?'https':'http';
    const url=new URL(req.url,scheme+'://'+(req.headers.host||'localhost'));
    const body=['GET','HEAD'].includes(req.method)?undefined:Readable.toWeb(req);
    const request=new Request(url,{method:req.method,headers:req.headers,body,duplex:body?'half':undefined});
    const response=await handle(request,req.socket.remoteAddress);
    const headers=Object.fromEntries(response.headers);
    if(response.headers.has('Set-Cookie'))headers['set-cookie']=response.headers.getSetCookie();
    res.writeHead(response.status,headers);
    res.end(Buffer.from(await response.arrayBuffer()));
  }catch(error){
    console.error(error);
    if(!res.headersSent)res.writeHead(500);
    res.end();
  }
});
const port=Number(process.env.PORT??3000);
server.listen(port,process.env.HOST??'127.0.0.1',()=>console.log('Fight My Professor is running at http://127.0.0.1:'+server.address().port));
