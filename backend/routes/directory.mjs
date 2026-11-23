import { level } from '../../game.mjs';
import { tags } from '../../public/shared.js';
import { get, list, put, remove, saveUser } from '../storage.mjs';
import { allowedUrl, cleanAvatar, fail, owned, requireRule, timestamp, uid, value } from '../request.mjs';
import { profiles } from '../profiles.mjs';
import { achievementNames } from '../progression.mjs';

function init({c, u}) {
  const {people,schools}=profiles(c);
  return {people,schools,settings:{prior:c.prior,priorWeight:c.priorWeight,minRatings:c.minRatings,minProfessors:c.minProfessors,levelXP:c.levelXP,winXP:c.winXP},me:u?{...u,level:level(u.xp,c),achievements:achievementNames(u)}:null};
}

function favorite({body, u, c}) {
  owned(u); requireRule(profiles(c).people.some(p=>p.id===body.id),'Professor not found.',404);
  u.favorites=u.favorites.includes(body.id)?u.favorites.filter(id=>id!==body.id):[...u.favorites,body.id];
  saveUser(u); return {};
}

function professor({params, c, u, guest}) {
  const id=params.get('id'), {people,byProfessor}=profiles(c), p=people.find(x=>x.id===id);
  requireRule(p,'Professor not found.',404);
  const reviews=(byProfessor.get(id)??[]).sort((a,b)=>b.date.localeCompare(a.date)).map(({author,voters,...review})=>({...review,helpful:voters.length,voted:voters.includes(u?.id??guest),mine:u?.id===author}));
  const fought=list('battle').filter(b=>b.enemy.id===id&&b.status==='finished').length;
  return {p,reviews,fought};
}

function rating({method, body, u}) {
  owned(u); const p=get('professor',body.id); requireRule(p&&p.published!==false,'Professor not found.',404);
  const id=p.id+':'+u.id;
  if(method==='DELETE'){ remove.run('rating',id); return {}; }
  requireRule(Array.isArray(body.values)&&body.values.length===6&&body.values.every(n=>Number.isInteger(n)&&n>=1&&n<=5),'Rate each of the six attributes from 1 to 5.');
  const selected=Array.isArray(body.tags)?[...new Set(body.tags.filter(t=>tags.includes(t)))].slice(0,3):[];
  put('rating',id,{id,professor:p.id,author:u.id,values:body.values,tags:selected,course:value(body.course,24),comment:value(body.comment,600),date:timestamp(),voters:get('rating',id)?.voters??[]});
  return {};
}

function helpful({body, u, guest}) {
  const rating=get('rating',body.id), voter=u?.id??guest;
  requireRule(rating&&u?.id!==rating.author,'This vote is unavailable.',404);
  rating.voters=rating.voters.includes(voter)?rating.voters.filter(x=>x!==voter):[...rating.voters,voter];
  put('rating',rating.id,rating); return {};
}

function request({body, u, c, guest}) {
  const kind=body.kind, id=uid(), base={id,kind,status:'pending',date:timestamp(),author:u?.id??guest};
  let fields;
  if(kind==='avatar'){
    owned(u); requireRule(profiles(c).people.some(p=>p.id===body.target),'Professor not found.',404);
    fields={target:body.target,avatar:cleanAvatar(body.avatar),note:value(body.note,600)};
  } else if(kind==='school'||kind==='professor'){
    owned(u);
    const name=value(body.name), school=value(body.school), department=value(body.department), location=value(body.location), url=allowedUrl(body.url);
    requireRule(name&&(kind==='school'?Boolean(location&&url):Boolean(department&&get('school',school))),'Complete the directory request.');
    const duplicate = row=>row.name.toLowerCase()===name.toLowerCase()&&(kind==='school'||row.school===school);
    requireRule(!list(kind).some(duplicate)&&!list('request').some(x=>x.kind===kind&&['pending','hold'].includes(x.status)&&duplicate(x)),'This entry already exists or is under review.',409);
    fields={name,school,department,location,url,note:value(body.note,600)};
  } else if(['report','correction','question'].includes(kind)){
    const note=value(body.note,600), target=value(body.target,150), reply=value(body.reply,254);
    requireRule(note,'Please describe the issue.');
    if(kind==='report') requireRule(get('rating',target),'Review not found.',404);
    if(kind==='correction') requireRule(get('professor',target),'Professor not found.',404);
    fields={target,note,reply};
  } else fail('Unknown request type.');
  requireRule(!list('request').some(x=>x.status==='pending'&&x.kind===kind&&x.author===base.author&&JSON.stringify(Object.fromEntries(Object.keys(fields).map(key=>[key,x[key]])))===JSON.stringify(fields)),'This request is already under review.',409);
  put('request',id,{...base,...fields});
  return {id};
}

export default {
  'GET /api/init': init,
  'POST /api/favorite': favorite,
  'GET /api/professor': professor,
  'POST /api/rating': rating,
  'DELETE /api/rating': rating,
  'POST /api/helpful': helpful,
  'POST /api/request': request
};
