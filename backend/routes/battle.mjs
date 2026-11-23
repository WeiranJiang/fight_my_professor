import { average, hp, level, botGuess, resolveRound } from '../../game.mjs';
import { owned, requireRule, timestamp, uid } from '../request.mjs';
import { profiles } from '../profiles.mjs';
import { achievementNames } from '../progression.mjs';

function exposedBattle(b, now) {
  const {questions,owner,guest,config,reward, ...visible}=b;
  const q = questions[b.round];
  return {...visible,reward,total:questions.length,remaining:b.status==='question'?Math.max(0,b.deadline-now):0,question:b.status==='question'?{prompt:q.prompt,unit:q.unit,category:q.category,time:q.time}:null};
}
function finish(b,u,storage) {
  const {saveUser}=storage;
  b.status='finished';
  const diff=b.playerHP/b.maxPlayer-b.enemyHP/b.maxEnemy;
  b.winner=Math.abs(diff)<1e-8?'tie':diff>0?'player':'enemy';
  if (!b.progression || !u) return;
  const won=b.winner==='player', first=won&&!u.defeated.includes(b.enemy.id);
  const recent = (u.history ?? []).filter(entry=>entry.opponent===b.enemy.id && Date.now()-Date.parse(entry.date)<86400000).length;
  const bonus=won&&b.enemy.power>=b.player.power+12?25:0;
  const xp=Math.floor((won?b.config.winXP+(first?b.config.firstXP:0)+bonus:b.config.lossXP)*Math.max(.15,1-recent*.28));
  const previous=level(u.xp,b.config);
  const before=achievementNames(u);
  u.xp+=xp;
  if(won) u.wins++; else if(b.winner==='enemy') u.losses++; else u.draws=(u.draws??0)+1;
  if(first) u.defeated.push(b.enemy.id);
  if(won&&b.enemy.difficulty==='Boss') u.bosses++;
  u.best=Math.max(u.best,b.log.reduce((n,row)=>n+row.score,0));
  u.perfect=(u.perfect??0)+b.log.filter(r=>r.playerError===0).length;
  u.history=[{id:b.id,opponent:b.enemy.id,name:b.enemy.name,result:b.winner,date:timestamp(),xp},...(u.history??[])];
  b.reward={xp,level:level(u.xp,b.config),leveled:level(u.xp,b.config)>previous,achievements:achievementNames(u).filter(a=>!before.includes(a))};
  saveUser(u);
}
async function createBattle(body,u,guest,c,storage) {
  const {get,list,put}=storage;
  const {people}=(await profiles(c, storage));
  const playerMode=body.mode==='player';
  if(playerMode) { owned(u); requireRule(u.avatar,'Save your fighter first.'); }
  const from=playerMode?{id:u.id,name:u.name,avatar:u.avatar,values:u.values,power:Math.round(average(u.values)),level:level(u.xp,c)}:people.find(p=>p.id===body.from);
  const to=people.find(p=>p.id===body.to);
  requireRule(from&&to&&from.id!==to.id,'Choose two distinct fighters.');
  const bank=(await list('question')).filter(q=>q.active);
  requireRule(bank.length>=7,'The arena needs at least seven active questions.',503);
  const recent=(await get('recent',u?.id??guest))??[];
  const shuffled = [...bank];
  for(let i=shuffled.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}
  shuffled.sort((a,b)=>Number(recent.includes(a.id))-Number(recent.includes(b.id)));
  const questions=shuffled.slice(0,7).map(q=>({...q,bot:botGuess(q,to,Math.random,c)}));
  put('recent',u?.id??guest,[...questions.map(q=>q.id),...recent].slice(0,14));
  const fighter = ({id,name,avatar,values,power,level,difficulty,school,demo})=>({id,name,avatar,values,power,level,difficulty,school,demo});
  const maxPlayer=hp(from,c),maxEnemy=hp(to,c);
  const b={id:uid(),owner:u?.id??null,guest,progression:playerMode,player:fighter(from),enemy:fighter(to),config:c,questions,round:0,status:'question',deadline:Date.now()+questions[0].time*1000,log:[],maxPlayer,maxEnemy,playerHP:maxPlayer,enemyHP:maxEnemy,date:timestamp()};
  put('battle',b.id,b);
  return b;
}

async function battleStart({body, u, guest, c, storage}) {
  return exposedBattle(await createBattle(body,u,guest,c,storage),Date.now());
}

async function battle({method, params, body, u, guest, storage}) {
  const {get, put}=storage;
  const b=await get('battle',method==='GET'?params.get('id'):body.id);
  requireRule(b,'Battle not found.',404);
  const owner=b.owner?u?.id===b.owner:guest===b.guest;
  if(method==='GET'){
    requireRule(owner||b.status==='finished','Battle not found.',404);
    return exposedBattle(b,Date.now());
  }
  requireRule(owner,'Battle not found.',404);
  if(b.round!==body.round||b.status==='finished') return exposedBattle(b,Date.now());
  if(body.action==='next'&&b.status==='reveal'){
    b.round++; b.status='question'; b.deadline=Date.now()+b.questions[b.round].time*1000;
  } else if(body.action==='guess'&&b.status==='question'){
    const q=b.questions[b.round], expired=Date.now()>=b.deadline;
    const estimate=expired?null:body.estimate;
    requireRule(expired||(typeof estimate==='number'&&Number.isFinite(estimate)&&estimate>=0&&estimate<=1e12&&(q.unit!=='%'||estimate<=100)),'Enter a valid numeric estimate.');
    const round=resolveRound(q,estimate,q.bot,b.player,b.enemy,b.config,b.round+1);
    b.log.push({...round,prompt:q.prompt,unit:q.unit});
    if(round.winner==='player') b.enemyHP=Math.max(0,b.enemyHP-round.damage);
    if(round.winner==='enemy') b.playerHP=Math.max(0,b.playerHP-round.damage);
    if(!b.enemyHP||!b.playerHP||b.round===b.questions.length-1) finish(b,u,storage);
    else b.status='reveal';
  }
  put('battle',b.id,b);
  return exposedBattle(b,Date.now());
}

export default {
  'POST /api/battle/start': battleStart,
  'GET /api/battle': battle,
  'POST /api/battle': battle
};
