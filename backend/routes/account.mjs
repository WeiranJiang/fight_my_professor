import { equalSecret, passwordHash, verifyPassword } from '../passwords.mjs';
import { level } from '../../game.mjs';
import { cleanAvatar, cookie, digest, owned, requireRule, uid, value } from '../request.mjs';
import { publicUser } from '../profiles.mjs';

async function recover({body, headers, secure, storage, env}) {
  const {one, write, get, put}=storage;
  const email=value(body.email,254).toLowerCase(), key=value(body.key,64).toLowerCase(), password=body.password;
  requireRule(/^[a-f0-9]{32}$/.test(key)&&typeof password==='string'&&password.length>=8&&password.length<=128,'Enter your recovery key and a password of 8–128 characters.');
  const row=(await one('SELECT id FROM users WHERE email=?',email));
  const expected=row?(await get('recovery',row.id)):null;
  requireRule(expected && await equalSecret(expected,await digest(key)),'Email or recovery key is incorrect.',401);
  requireRule(email!==env.FMP_ADMIN_EMAIL?.toLowerCase()||password.toLowerCase()!==email,'Choose a private password different from the moderator email.');
  const replacement=uid();
  write('UPDATE users SET password=? WHERE id=?',await passwordHash(password),row.id);
  write('DELETE FROM sessions WHERE user_id=?',row.id);
  put('recovery',row.id,await digest(replacement));
  headers.push(cookie('fmp_session','',0,secure));
  return {recoveryKey:replacement};
}

async function recoveryKey({body, u, storage, legacyPassword}) {
  const {one, put}=storage;
  owned(u);
  const password=body.password, account=(await one('SELECT password FROM users WHERE id=?',u.id));
  requireRule(typeof password==='string'&&password.length>=8&&password.length<=128,'Enter your current password.');
  requireRule(await verifyPassword(password,account.password,legacyPassword),'Password is incorrect.',401);
  const recoveryKey=uid();
  put('recovery',u.id,await digest(recoveryKey));
  return {recoveryKey};
}

async function auth({body, u, token, headers, secure, storage, env, legacyPassword}) {
  const {one, write, put, users}=storage;
  const email=value(body.email,254).toLowerCase(), password=body.password;
  requireRule(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)&&typeof password==='string'&&password.length>=8&&password.length<=128,'Enter a valid email and a password of 8–128 characters.');
  const reserved=Boolean(env.FMP_ADMIN_EMAIL&&email===env.FMP_ADMIN_EMAIL.toLowerCase());
  const hasAdminInvite=()=>Boolean(env.FMP_ADMIN_CODE)&&equalSecret(body.adminCode,env.FMP_ADMIN_CODE);
  requireRule(!reserved||password.toLowerCase()!==email,'Choose a private password different from the moderator email.');
  let recoveryKey;
  if(body.mode==='signup'){
    const name=value(body.name,28);
    requireRule(name.length>=2,'Choose a display name with at least 2 characters.');
    requireRule(!(await one('SELECT 1 FROM users WHERE email=?',email)),'An account already uses this email.',409);
    requireRule(!(await users()).some(account=>account.name.toLowerCase()===name.toLowerCase()),'Choose a different display name.',409);
    const admin=reserved&&await hasAdminInvite();
    requireRule(!reserved||admin,'This email requires a moderator invite code.',403);
    u={id:uid(),email,name,admin,school:null,avatar:null,values:[50,50,50,50,50,50],xp:0,wins:0,losses:0,draws:0,best:0,bosses:0,defeated:[],favorites:[],history:[]};
    write('INSERT INTO users VALUES (?,?,?,?)',u.id,email,await passwordHash(password),JSON.stringify(u));
    recoveryKey=uid();
    put('recovery',u.id,await digest(recoveryKey));
  } else {
    const row=(await one('SELECT password,data FROM users WHERE email=?',email));
    requireRule(await verifyPassword(password,row?.password,legacyPassword),'Email or password is incorrect.',401);
    u=JSON.parse(row.data);
    if(reserved&&!u.admin&&body.adminCode){
      requireRule(await hasAdminInvite(),'Moderator invite code is incorrect.',403);
      u.admin=true;
      write('UPDATE users SET data=? WHERE id=?',JSON.stringify(u),u.id);
    }
  }
  if(token) write('DELETE FROM sessions WHERE token=?',await digest(token));
  const newToken=uid()+uid(), ttl=60*60*24*30;
  write('INSERT INTO sessions VALUES (?,?,?)',await digest(newToken),u.id,Date.now()+ttl*1000);
  headers.push(cookie('fmp_session',newToken,ttl,secure));
  return {id:u.id,newFighter:!u.avatar,recoveryKey};
}

async function logout({token, headers, secure, storage}) {
  const {write}=storage;
  if(token) write('DELETE FROM sessions WHERE token=?',await digest(token));
  headers.push(cookie('fmp_session','',0,secure));
  return {};
}

async function fighter({body, u, c, storage}) {
  const {get, saveUser}=storage;
  owned(u);
  const previous=u.values;
  const vals=body.values??previous;
  requireRule(Array.isArray(vals)&&vals.length===6&&vals.every((n,i)=>Number.isInteger(n)&&n>=previous[i]&&n<=80)&&vals.reduce((a,b)=>a+b,0)<=303+(level(u.xp,c)-1)*2,'You have exceeded your available stat points.');
  requireRule(!body.school||(await get('school',body.school)),'Choose a listed school.');
  const traits=cleanAvatar(body.avatar);
  const unlocks={prop:{3:5,6:10},shirtColor:{7:20}};
  for(const [key,variants] of Object.entries(unlocks)){
    const needed=variants[traits[key]];
    requireRule(!needed||level(u.xp,c)>=needed||u.avatar?.[key]===traits[key],'Reach level '+needed+' to use this cosmetic.');
  }
  Object.assign(u,{avatar:traits,values:vals,school:body.school||null});
  saveUser(u); return {};
}

async function players({c, storage}) {
  const {users}=storage;
  return (await users()).filter(u=>u.avatar).map(u=>publicUser(u,c));
}

export default {
  'POST /api/recover': recover,
  'POST /api/recovery-key': recoveryKey,
  'POST /api/auth': auth,
  'POST /api/logout': logout,
  'POST /api/fighter': fighter,
  'GET /api/players': players
};
