import { options } from '../public/shared.js';

export const hex = buffer => Array.from(new Uint8Array(buffer), byte=>byte.toString(16).padStart(2,'0')).join('');
export const uid = () => hex(crypto.getRandomValues(new Uint8Array(16)));
export const digest = async s => hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
export const value = (s,max=120) => typeof s==='string' ? s.trim().slice(0,max) : '';
export const timestamp = () => new Date().toISOString();
export const fail = (message,status=400) => { throw Object.assign(new Error(message),{status}); };
export const requireRule = (ok,message,status) => { if (!ok) fail(message,status); };
export const allowedUrl = raw => {
  try { const url = new URL(raw); return url.protocol==='https:' && !url.username && !url.password ? url.href : ''; }
  catch { return ''; }
};
export const owned = u => { requireRule(u,'Log in to continue.',401); return u; };
export const cleanAvatar = traits => Object.fromEntries(Object.entries(options).map(([key,variants])=>{
  const n=traits?.[key]; requireRule(Number.isInteger(n)&&n>=0&&n<variants.length,'Invalid avatar option.');
  return [key,n];
}));
export function cookie(name,token,age,secure) {
  return name+'='+token+'; Path=/; HttpOnly; SameSite=Lax; Max-Age='+age+(secure?'; Secure':'');
}
