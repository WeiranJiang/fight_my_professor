import { openD1 } from '../backend/d1.mjs';
import { createHandler } from '../backend/http.mjs';
import assets from 'virtual:fmp-assets';

const handlers = new WeakMap();
export default {
  fetch(request, env) {
    if (!env.DB) return new Response('Database binding unavailable',{status:503});
    let handle=handlers.get(env.DB);
    if(!handle){
      handle=createHandler({withStore:openD1(env.DB),readAsset:name=>assets[name],env});
      handlers.set(env.DB,handle);
    }
    return handle(request,request.headers.get('CF-Connecting-IP')??'unknown');
  }
};
