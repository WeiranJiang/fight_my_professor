import { createHash, randomBytes } from 'node:crypto';
import { options } from '../public/shared.js';

export const uid = () => randomBytes(16).toString('hex');
export const digest = s => createHash('sha256').update(s).digest('hex');
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
