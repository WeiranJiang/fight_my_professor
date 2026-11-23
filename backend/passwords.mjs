import { hex, uid } from './request.mjs';

const encoder = new TextEncoder();
const iterations = 100000;
const dummy = 'pbkdf2:'+'0'.repeat(32)+':'+'0'.repeat(64);

export async function equalSecret(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const key=await crypto.subtle.importKey('raw',crypto.getRandomValues(new Uint8Array(32)),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  const signature=await crypto.subtle.sign('HMAC',key,encoder.encode(left));
  return crypto.subtle.verify('HMAC',key,signature,encoder.encode(right));
}

export async function passwordHash(password, salt=uid()) {
  const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
  const hash=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-512',iterations,salt:encoder.encode(salt)},key,256);
  return 'pbkdf2:'+salt+':'+hex(hash);
}

export async function verifyPassword(password, stored, legacy) {
  const expected=stored??dummy;
  if (!expected.startsWith('pbkdf2:')) return Boolean(legacy?.(password,expected));
  const supplied=await passwordHash(password,expected.split(':')[1]);
  return await equalSecret(supplied,expected) && Boolean(stored);
}
