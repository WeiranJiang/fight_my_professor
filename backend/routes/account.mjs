import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { level } from '../../game.mjs';
import { db, get, put, saveUser, users } from '../storage.mjs';
import { cleanAvatar, cookie, digest, owned, requireRule, uid, value } from '../request.mjs';
import { publicUser } from '../profiles.mjs';

const passwordHash = (password,salt=randomBytes(16).toString('hex')) => salt+':'+scryptSync(password,salt,64).toString('hex');

function recover({body, headers, secure}) {
  const email=value(body.email,254).toLowerCase(), key=value(body.key,64).toLowerCase(), password=body.password;
  requireRule(/^[a-f0-9]{32}$/.test(key)&&typeof password==='string'&&password.length>=8&&password.length<=128,'Enter your recovery key and a password of 8–128 characters.');
  const row=db.prepare('SELECT id FROM users WHERE email=?').get(email);
  const expected=row?get('recovery',row.id):null;
  requireRule(expected&&timingSafeEqual(Buffer.from(expected),Buffer.from(digest(key))),'Email or recovery key is incorrect.',401);
  const replacement=uid();
  db.prepare('UPDATE users SET password=? WHERE id=?').run(passwordHash(password),row.id);
  db.prepare('DELETE FROM sessions WHERE user_id=?').run(row.id);
  put('recovery',row.id,digest(replacement));
  headers.push(cookie('fmp_session','',0,secure));
  return {recoveryKey:replacement};
}

function recoveryKey({body, u}) {
  owned(u);
  const password=body.password, account=db.prepare('SELECT password FROM users WHERE id=?').get(u.id);
  requireRule(typeof password==='string'&&password.length>=8&&password.length<=128,'Enter your current password.');
  const supplied=passwordHash(password,account.password.split(':')[0]);
  requireRule(timingSafeEqual(Buffer.from(supplied),Buffer.from(account.password)),'Password is incorrect.',401);
  const recoveryKey=uid();
  put('recovery',u.id,digest(recoveryKey));
  return {recoveryKey};
}

function auth({body, u, token, headers, secure}) {
  const email=value(body.email,254).toLowerCase(), password=body.password;
  requireRule(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)&&typeof password==='string'&&password.length>=8&&password.length<=128,'Enter a valid email and a password of 8–128 characters.');
  let recoveryKey;
  if(body.mode==='signup'){
    const name=value(body.name,28);
    requireRule(name.length>=2,'Choose a display name with at least 2 characters.');
    requireRule(!db.prepare('SELECT 1 FROM users WHERE email=?').get(email),'An account already uses this email.',409);
    requireRule(!users().some(account=>account.name.toLowerCase()===name.toLowerCase()),'Choose a different display name.',409);
    const admin=Boolean(process.env.FMP_ADMIN_EMAIL&&email===process.env.FMP_ADMIN_EMAIL.toLowerCase()&&process.env.FMP_ADMIN_CODE&&body.adminCode===process.env.FMP_ADMIN_CODE);
    u={id:uid(),email,name,admin,school:null,avatar:null,values:[50,50,50,50,50,50],xp:0,wins:0,losses:0,draws:0,best:0,bosses:0,defeated:[],favorites:[],history:[]};
    db.prepare('INSERT INTO users VALUES (?,?,?,?)').run(u.id,email,passwordHash(password),JSON.stringify(u));
    recoveryKey=uid();
    put('recovery',u.id,digest(recoveryKey));
  } else {
    const row=db.prepare('SELECT password,data FROM users WHERE email=?').get(email);
    const expected=row?.password??'00000000000000000000000000000000:'+('0'.repeat(128));
    const supplied=passwordHash(password,expected.split(':')[0]);
    requireRule(timingSafeEqual(Buffer.from(expected),Buffer.from(supplied))&&row,'Email or password is incorrect.',401);
    u=JSON.parse(row.data);
  }
  if(token) db.prepare('DELETE FROM sessions WHERE token=?').run(digest(token));
  const newToken=uid()+uid(), ttl=60*60*24*30;
  db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(digest(newToken),u.id,Date.now()+ttl*1000);
  headers.push(cookie('fmp_session',newToken,ttl,secure));
  return {id:u.id,newFighter:!u.avatar,recoveryKey};
}

function logout({token, headers, secure}) {
  if(token) db.prepare('DELETE FROM sessions WHERE token=?').run(digest(token));
  headers.push(cookie('fmp_session','',0,secure));
  return {};
}

function fighter({body, u, c}) {
  owned(u);
  const previous=u.values;
  const vals=body.values??previous;
  requireRule(Array.isArray(vals)&&vals.length===6&&vals.every((n,i)=>Number.isInteger(n)&&n>=previous[i]&&n<=80)&&vals.reduce((a,b)=>a+b,0)<=303+(level(u.xp,c)-1)*2,'You have exceeded your available stat points.');
  requireRule(!body.school||get('school',body.school),'Choose a listed school.');
  const traits=cleanAvatar(body.avatar);
  const unlocks={prop:{3:5,6:10},shirtColor:{7:20}};
  for(const [key,variants] of Object.entries(unlocks)){
    const needed=variants[traits[key]];
    requireRule(!needed||level(u.xp,c)>=needed||u.avatar?.[key]===traits[key],'Reach level '+needed+' to use this cosmetic.');
  }
  Object.assign(u,{avatar:traits,values:vals,school:body.school||null});
  saveUser(u); return {};
}

function players({c}) {
  return users().filter(u=>u.avatar).map(u=>publicUser(u,c));
}

export default {
  'POST /api/recover': recover,
  'POST /api/recovery-key': recoveryKey,
  'POST /api/auth': auth,
  'POST /api/logout': logout,
  'POST /api/fighter': fighter,
  'GET /api/players': players
};
