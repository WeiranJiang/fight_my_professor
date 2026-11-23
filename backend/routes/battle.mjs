import { average, hp, level, botGuess, resolveChoice, resolveRound } from '../../game.mjs';
import { owned, requireRule, timestamp, uid } from '../request.mjs';
import { profiles } from '../profiles.mjs';
import { botChoice, dailyQuestions, questionType, selectQuestions } from '../question-bank.mjs';
import { challengeDay, dailyProfessor, earnedRematch, guestFighter } from '../daily-challenge.mjs';
import { achievementNames } from '../progression.mjs';

function exposedBattle(b, now) {
  const {questions,owner,guest,config,reward, ...visible}=b;
  const q = questions[b.round];
  return {...visible,reward,total:questions.length,remaining:b.status==='question'?Math.max(0,b.deadline-now):0,question:b.status==='question'?{prompt:q.prompt,unit:q.unit,category:q.category,time:q.time,kind:questionType(q),options:q.options?.map(option=>option.text)}:null};
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
  u.history=[{id:b.id,opponent:b.enemy.id,name:b.enemy.name,result:b.winner,date:timestamp(),xp,rounds:b.log.length,score:b.log.reduce((sum,row)=>sum+row.score,0)},...(u.history??[])].slice(0,200);
  b.reward={xp,level:level(u.xp,b.config),leveled:level(u.xp,b.config)>previous,achievements:achievementNames(u).filter(a=>!before.includes(a))};
  saveUser(u);
}
async function createBattle(body,u,guest,c,storage) {
  const {get,list,put}=storage;
  const type=body.type??'daily';
  requireRule(['daily','rematch'].includes(type),'Choose a valid challenge.');
  const now=Date.now(), day=challengeDay(now), seenKey=u?.id??guest;
  const {people}=await profiles(c,storage);
  if(type==='rematch')owned(u);
  const to=type==='daily'?await dailyProfessor(people,day,storage):people.find(p=>p.id===body.to&&!p.demo);
  requireRule(to,'Professor not found.',404);
  const dailyKey=type==='daily'?day+':'+seenKey:day+':'+seenKey+':'+to.id;
  const previous=await get('challenge-entry',dailyKey);
  if(previous){
    const battle=await get('battle',previous);
    requireRule(battle,'This challenge is unavailable.',404);
    return battle;
  }
  if(type==='rematch')requireRule(await earnedRematch(storage,to.id,u.id,day),'Submit your first rating for this professor today to unlock a bonus match.',403);
  const from=u?{id:u.id,name:u.name,avatar:u.avatar??guestFighter.avatar,values:u.values,power:Math.round(average(u.values)),level:level(u.xp,c)}:guestFighter;
  const playlist=body.playlist??'mixed';
  requireRule(['mixed','estimate','rare','common'].includes(playlist),'Choose a valid trivia format.');
  const saved=(await list('question')).filter(q=>q.active);
  const bank=[...saved,...dailyQuestions(now)];
  const {selected,recent}=selectQuestions(bank,await get('recent',seenKey),playlist,now);
  requireRule(selected.length===7,'Not enough questions are available for this format.',503);
  const questions=selected.map(q=>{
    if(questionType(q)==='estimate')return {...q,bot:botGuess(q,to,Math.random,c)};
    // Randomize presentation order so the answer cannot be inferred by position.
    const choices=q.options.map(option=>({option,order:Math.random()})).sort((a,b)=>a.order-b.order).map(x=>x.option);
    const shuffled={...q,options:choices};
    return {...shuffled,bot:botChoice(shuffled,to)};
  });
  put('recent',seenKey,recent);
  const fighter = ({id,name,avatar,values,power,level,difficulty,school,demo})=>({id,name,avatar,values,power,level,difficulty,school,demo});
  const maxPlayer=hp(from,c),maxEnemy=hp(to,c);
  const b={id:uid(),owner:u?.id??null,guest,progression:Boolean(u),playlist,challengeType:type,challengeDay:day,player:fighter(from),enemy:fighter(to),config:c,questions,round:0,status:'question',deadline:Date.now()+questions[0].time*1000,log:[],maxPlayer,maxEnemy,playerHP:maxPlayer,enemyHP:maxEnemy,date:timestamp()};
  put('battle',b.id,b);
  put('challenge-entry',dailyKey,b.id);
  if(type==='daily')put('daily-professor',day,to.id);
  return b;
}

async function challenge({u,guest,c,storage,params}){
  const day=challengeDay(Date.now());
  const {people}=await profiles(c,storage);
  const target=params.get('rematch');
  const type=target?'rematch':'daily';
  const professor=target?people.find(p=>p.id===target&&!p.demo):await dailyProfessor(people,day,storage);
  requireRule(professor,'Professor not found.',404);
  const key=day+':'+(u?.id??guest)+(target?':'+professor.id:'');
  const id=await storage.get('challenge-entry',key);
  const battle=id?await storage.get('battle',id):null;
  return {day,type,professor,battleId:battle?.id??null,status:battle?.status??null,
    available:type==='daily'||Boolean(battle)||await earnedRematch(storage,professor.id,u?.id,day)};
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
  requireRule(Number.isInteger(body.round)&&['next','guess'].includes(body.action),'Invalid battle action.');
  if(b.round!==body.round||b.status==='finished') return exposedBattle(b,Date.now());
  if(body.action==='next'&&b.status==='reveal'){
    b.round++; b.status='question'; b.deadline=Date.now()+b.questions[b.round].time*1000;
  } else if(body.action==='guess'&&b.status==='question'){
    const q=b.questions[b.round], expired=Date.now()>=b.deadline;
    let round;
    if(questionType(q)==='estimate'){
      const estimate=expired?null:body.estimate;
      requireRule(expired||(typeof estimate==='number'&&Number.isFinite(estimate)&&estimate>=0&&estimate<=1e12&&(q.unit!=='%'||estimate<=100)),'Enter a valid numeric estimate.');
      round=resolveRound(q,estimate,q.bot,b.player,b.enemy,b.config,b.round+1);
    }else{
      const choice=expired?null:body.choice;
      requireRule(expired||(Number.isInteger(choice)&&choice>=0&&choice<q.options.length),'Choose an answer.');
      round=resolveChoice(q,choice,q.bot,b.player,b.enemy,b.config,b.round+1);
    }
    b.log.push({...round,prompt:q.prompt,unit:q.unit});
    if(round.winner==='player') b.enemyHP=Math.max(0,b.enemyHP-round.damage);
    if(round.winner==='enemy') b.playerHP=Math.max(0,b.playerHP-round.damage);
    if(!b.enemyHP||!b.playerHP||b.round===b.questions.length-1) finish(b,u,storage);
    else b.status='reveal';
  }else return exposedBattle(b,Date.now());
  put('battle',b.id,b);
  return exposedBattle(b,Date.now());
}

export default {
  'GET /api/challenge': challenge,
  'POST /api/battle/start': battleStart,
  'GET /api/battle': battle,
  'POST /api/battle': battle
};
