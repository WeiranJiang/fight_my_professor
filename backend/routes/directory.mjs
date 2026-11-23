import { level } from '../../game.mjs';
import { tags } from '../../public/shared.js';
import { allowedUrl, cleanAvatar, fail, owned, requireRule, timestamp, uid, value } from '../request.mjs';
import { profiles } from '../profiles.mjs';
import { challengeDay, earnedRematch } from '../daily-challenge.mjs';
import { cleanQuestion } from '../questions.mjs';
import { achievementNames } from '../progression.mjs';

async function init({c, u, storage}) {
  const {people,schools}=await profiles(c, storage, {includeSchools:true});
  const featured=schools.filter(s=>s.count||s.id===u?.school);
  return {people,schools:featured,settings:{prior:c.prior,priorWeight:c.priorWeight,minRatings:c.minRatings,minProfessors:c.minProfessors,levelXP:c.levelXP,winXP:c.winXP},me:u?{...u,level:level(u.xp,c),achievements:achievementNames(u)}:null};
}

async function schools({c,storage}) {
  return (await profiles(c,storage,{includeSchools:true})).schools;
}

async function favorite({body, u, c, storage}) {
  const {saveUser}=storage;
  owned(u); requireRule((await profiles(c, storage)).people.some(p=>p.id===body.id),'Professor not found.',404);
  u.favorites=u.favorites.includes(body.id)?u.favorites.filter(id=>id!==body.id):[...u.favorites,body.id];
  saveUser(u); return {};
}

async function professor({params, c, u, guest, storage}) {
  const id=params.get('id'), {people,byProfessor}=(await profiles(c, storage)), p=people.find(x=>x.id===id);
  requireRule(p,'Professor not found.',404);
  const reviews=(byProfessor.get(id)??[]).sort((a,b)=>b.date.localeCompare(a.date)).map(({author,voters,...review})=>({...review,helpful:voters.length,voted:voters.includes(u?.id??guest),mine:u?.id===author}));
  const fought=await storage.battleCount(id);
  const canRematch=!p.demo&&await earnedRematch(storage,id,u?.id,challengeDay(Date.now()));
  return {p,reviews,fought,canRematch};
}

async function rating({method, body, u, storage}) {
  const {get, put, remove}=storage;
  owned(u); const p=(await get('professor',body.id)); requireRule(p&&p.published!==false,'Professor not found.',404);
  const id=p.id+':'+u.id;
  const previous=await get('rating',id);
  const origin=await get('rating-origin',id);
  if(method==='DELETE'){
    if(previous&&!origin)put('rating-origin',id,previous.createdAt??previous.date);
    remove('rating',id);
    return {};
  }
  requireRule(Array.isArray(body.values)&&body.values.length===6&&body.values.every(n=>Number.isInteger(n)&&n>=1&&n<=5),'Rate each of the six attributes from 1 to 5.');
  const selected=Array.isArray(body.tags)?[...new Set(body.tags.filter(t=>tags.includes(t)))].slice(0,3):[];
  const date=timestamp(), createdAt=origin??previous?.createdAt??previous?.date??date;
  if(!origin)put('rating-origin',id,createdAt);
  put('rating',id,{id,professor:p.id,author:u.id,values:body.values,tags:selected,course:value(body.course,24),comment:value(body.comment,600),date,createdAt,voters:previous?.voters??[]});
  return {};
}

async function helpful({body, u, storage}) {
  owned(u);
  const {get, put}=storage;
  const rating=(await get('rating',body.id)), voter=u.id;
  requireRule(rating&&u?.id!==rating.author,'This vote is unavailable.',404);
  rating.voters=rating.voters.includes(voter)?rating.voters.filter(x=>x!==voter):[...rating.voters,voter];
  put('rating',rating.id,rating); return {};
}

async function request({body, u, c, guest, storage}) {
  const {get, put, list}=storage;
  const kind=body.kind, id=uid(), base={id,kind,status:'pending',date:timestamp(),author:u?.id??guest};
  let fields;
  if(kind==='avatar'){
    owned(u); requireRule((await profiles(c, storage)).people.some(p=>p.id===body.target),'Professor not found.',404);
    fields={target:body.target,avatar:cleanAvatar(body.avatar),note:value(body.note,600)};
  } else if(kind==='proposal'){
    owned(u);
    const {id: ignored, active, ...question}=cleanQuestion({...body.question,active:true},id);
    requireRule(question.source,'Provide an HTTPS source link for the answer.');
    const samePrompt=q=>q.prompt.trim().toLowerCase()===question.prompt.toLowerCase();
    requireRule(!(await list('question')).some(samePrompt)&&!(await list('request')).some(row=>row.kind==='proposal'&&['pending','hold'].includes(row.status)&&samePrompt(row.question)),'A question with this prompt already exists or is under review.',409);
    fields={question,note:value(body.note,600)};
  } else if(kind==='school'||kind==='professor'){
    owned(u);
    const name=value(body.name), school=value(body.school), department=value(body.department), location=value(body.location), url=allowedUrl(body.url);
    requireRule(name&&(kind==='school'?Boolean(location&&url):Boolean(department&&(await get('school',school)))),'Complete the directory request.');
    const duplicate = row=>row.name.toLowerCase()===name.toLowerCase()&&(kind==='school'||row.school===school);
    requireRule(!(await list(kind)).some(duplicate)&&!(await list('request')).some(x=>x.kind===kind&&['pending','hold'].includes(x.status)&&duplicate(x)),'This entry already exists or is under review.',409);
    fields={name,school,department,location,url,note:value(body.note,600)};
  } else if(['report','correction','question'].includes(kind)){
    const note=value(body.note,600), target=value(body.target,150), reply=value(body.reply,254);
    requireRule(note,'Please describe the issue.');
    if(kind==='report') requireRule((await get('rating',target)),'Review not found.',404);
    if(kind==='correction') requireRule((await get('professor',target)),'Professor not found.',404);
    fields={target,note,reply};
  } else fail('Unknown request type.');
  requireRule(!(await list('request')).some(x=>x.status==='pending'&&x.kind===kind&&x.author===base.author&&JSON.stringify(Object.fromEntries(Object.keys(fields).map(key=>[key,x[key]])))===JSON.stringify(fields)),'This request is already under review.',409);
  put('request',id,{...base,...fields});
  return {id};
}

async function submissions({u,storage}) {
  owned(u);
  return (await storage.list('request')).filter(row=>row.author===u.id&&['proposal','school','professor','avatar'].includes(row.kind))
    .sort((a,b)=>b.date.localeCompare(a.date))
    .map(({id,kind,status,date,name,question,target,decisionNote})=>({id,kind,status,date,title:question?.prompt??name??target,decisionNote}));
}

export default {
  'GET /api/submissions': submissions,
  'GET /api/init': init,
  'GET /api/schools': schools,
  'POST /api/favorite': favorite,
  'GET /api/professor': professor,
  'POST /api/rating': rating,
  'DELETE /api/rating': rating,
  'POST /api/helpful': helpful,
  'POST /api/request': request
};
