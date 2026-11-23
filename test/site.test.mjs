import { dailyQuestions, selectQuestions } from '../backend/question-bank.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { DatabaseSync } from 'node:sqlite';
import { defaultAvatar, avatar } from '../public/shared.js';
import { seedQuestions } from '../seed.mjs';
import { botGuess, DEFAULTS, resolveRound } from '../game.mjs';

test('five daily questions unlock and recent questions stay out of the next mixed battle', () => {
  const now=Date.UTC(2026,10,23,13);
  const justReleased=dailyQuestions(now,1);
  assert.equal(justReleased.length,5);
  assert.equal(new Set(justReleased.map(q=>q.id)).size,5);
  assert.ok(dailyQuestions(now-86400000,1).every(q=>!justReleased.some(today=>today.id===q.id)));
  const bank=dailyQuestions(now);
  const first=selectQuestions(bank,{},'mixed',now,()=>.5);
  const second=selectQuestions(bank,first.recent,'mixed',now+1000,()=>.5);
  assert.equal(first.selected.length,7);
  assert.deepEqual(new Set(first.selected.map(q=>q.kind)),new Set(['estimate','rare','common']));
  assert.ok(second.selected.every(q=>!Object.hasOwn(first.recent,q.id)));
});

test('closest wins, ties do zero damage, and intelligence improves bot estimates', () => {
  const q={answer:300,scale:150}, weak={values:[50,50,50,0,50,50]}, strong={values:[50,50,50,100,50,50]};
  assert.ok(Math.abs(botGuess(q,strong,()=>.84,DEFAULTS)-q.answer)<Math.abs(botGuess(q,weak,()=>.84,DEFAULTS)-q.answer));
  assert.equal(resolveRound(q,299,303,weak,strong,DEFAULTS,1).winner,'player');
  assert.equal(resolveRound(q,297,303,weak,strong,DEFAULTS,1).damage,0);
  assert.equal(resolveRound(q,null,303,weak,strong,DEFAULTS,1).winner,'enemy');
  assert.notEqual(avatar(defaultAvatar),avatar({...defaultAvatar,hair:2,glasses:3}));
});

test('HTTP guest play, player progression, moderated directory, and persistence', {timeout:30000}, async t => {
  const directory=await mkdtemp(join(tmpdir(),'fmp-test-'));
  const dbPath=join(directory,'test.sqlite');
  let server;
  t.after(async()=>{
    if(server&&server.exitCode===null){const done=once(server,'exit');server.kill();await done;}
    await rm(directory,{force:true,recursive:true});
  });
  async function start(){
    server=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'0',FMP_DB:dbPath,FMP_ADMIN_EMAIL:'moderator@example.test',FMP_ADMIN_CODE:'integration-invite'},stdio:['ignore','pipe','pipe']});
    let errors='';
    server.stderr.on('data',chunk=>errors+=chunk);
    const origin=await Promise.race([
      once(server.stdout,'data').then(([chunk])=>String(chunk).match(/http:\/\/127\.0\.0\.1:\d+/)?.[0]),
      once(server,'exit').then(()=>{throw new Error(errors);})
    ]);
    assert.ok(origin);
    return origin;
  }
  let origin=await start();
  for(const path of ['/schools','/fighter/edit','/signup?admin=1']){
    const page=await fetch(origin+path);
    assert.equal(page.status,200);
    assert.match(await page.text(),/Fight My Professor/);
  }
  const mark=await fetch(origin+'/school-marks/penn.png');
  assert.equal(mark.headers.get('content-type'),'image/png');
  assert.deepEqual(new Uint8Array(await mark.arrayBuffer()).slice(0,8),Uint8Array.of(137,80,78,71,13,10,26,10));
  function client(){
    const cookies=new Map();
    return async (path,body,method='POST',expected=200)=>{
      const headers={Cookie:[...cookies].map(([key,n])=>key+'='+n).join('; ')};
      if(body!==undefined)headers['Content-Type']='application/json';
      const res=await fetch(origin+'/api/'+path,{method:body===undefined?'GET':method,headers,body:body===undefined?null:JSON.stringify(body)});
      for(const cookie of res.headers.getSetCookie()){
        const [key,n]=cookie.split(';')[0].split('=');
        cookies.set(key,n);
      }
      const result=await res.json();
      assert.equal(res.status,expected,JSON.stringify(result));
      return result;
    };
  }
  const guest=client(), spectator=client(), player=client(), moderator=client();
  async function play(request,b){
    const seen=new Set();
    while(b.status!=='finished'){
      assert.equal(b.status,'question');
      assert.equal('answer' in b.question,false);
      assert.equal('questions' in b,false);
      const q=[...seedQuestions,...dailyQuestions()].find(x=>x.prompt===b.question.prompt);
      assert.ok(q);
      assert.equal(seen.has(q.id),false);
      seen.add(q.id);
      const body={id:b.id,round:b.round,action:'guess',estimate:q.answer};
      b=await request('battle',body);
      assert.deepEqual(await request('battle',body),b);
      assert.ok(['player','tie'].includes(b.log.at(-1).winner));
      assert.equal(b.log.at(-1).score,100);
      if(b.status==='reveal')b=await request('battle',{id:b.id,round:b.round,action:'next'});
    }
    assert.equal(b.winner,'player');
    return b;
  }
  const metadata=await guest('init');
  assert.ok(metadata.schools.length>=32);
  const national=await guest('schools');
  assert.ok(national.length>=5800);
  assert.equal(new Set(national.map(s=>s.id)).size,national.length);
  assert.equal(national.find(s=>s.id==='penn').unit,215062);
  assert.ok(national.some(s=>s.state==='AK'));
  assert.ok(national.some(s=>s.state==='PR'));
  assert.ok(national.find(s=>s.id==='ipeds122977').count>0);
  assert.ok(national.find(s=>s.id==='ipeds187596').count>0);
  const maryland=national.find(s=>s.id==='ipeds163286');
  assert.ok(maryland.count>0);
  assert.ok(metadata.people.some(p=>p.school===maryland.id&&p.source.startsWith('https://www.cs.umd.edu/')));
  assert.ok(metadata.people.some(p=>!p.demo&&p.source));
  const expected=await guest('challenge');
  const b=await guest('battle/start',{mode:'guest',from:'park',to:'vale',playlist:'estimate'});
  assert.equal(b.player.id,'guest-fighter');
  assert.equal(b.enemy.id,expected.professor.id);
  assert.equal((await spectator('challenge')).professor.id,b.enemy.id);
  assert.deepEqual((await guest('battle/start',{playlist:'rare'})).id,b.id);
  await guest('battle/start',{type:'rematch',to:b.enemy.id},'POST',401);
  await spectator('battle?id='+b.id,undefined,'GET',404);
  await guest('battle',{id:b.id,round:0,action:'guess',estimate:-5},'POST',400);
  const result=await play(guest,b);
  assert.equal(result.reward,undefined);
  assert.equal((await spectator('battle?id='+b.id)).winner,'player');
  for(const playlist of ['rare','common']){
    const contender=client();
    await contender('init');
    const match=await contender('battle/start',{playlist});
    assert.equal(match.question.kind,playlist);
    assert.ok(match.question.options.every(option=>typeof option==='string'));
    const reveal=await contender('battle',{id:match.id,round:0,action:'guess',choice:0});
    assert.equal(reveal.log[0].estimate,match.question.options[0]);
    assert.equal(typeof reveal.log[0].botScore,'number');
  }
  const timed=client();
  await timed('init');
  const by=await timed('battle/start',{playlist:'estimate'});
  const db=new DatabaseSync(dbPath);
  const stored=db.prepare("SELECT data FROM records WHERE type='battle' AND id=?").get(by.id);
  db.prepare("UPDATE records SET data=? WHERE type='battle' AND id=?").run(JSON.stringify({...JSON.parse(stored.data),deadline:0}),by.id);
  db.close();
  assert.equal((await timed('battle',{id:by.id,round:0,action:'guess',estimate:null})).log[0].estimate,null);
  const credential={email:'student@example.test',password:'test-password-123',name:'Test Student'};
  const {recoveryKey}=await player('auth',{...credential,mode:'signup'});
  assert.match(recoveryKey,/^[a-f0-9]{32}$/);
  const custom={...defaultAvatar,skin:2,hair:4,glasses:2,shirt:3,pants:2,prop:4,eyeShape:1,eyeSize:2,eyeColor:4};
  const {eyeShape,eyeSize,eyeColor,...legacyAvatar}=defaultAvatar;
  await player('fighter',{avatar:legacyAvatar});
  assert.deepEqual((await player('init')).me.avatar,defaultAvatar);
  await player('fighter',{avatar:{...custom,eyeColor:99}},'POST',400);
  await player('fighter',{avatar:custom,values:[50,51,50,51,50,51],school:'penn'});
  await player('logout',{});
  await player('auth',{...credential,mode:'login'});
  assert.deepEqual((await player('init')).me.avatar,custom);
  const challenge=await player('battle/start',{playlist:'estimate'});
  assert.deepEqual(challenge.player.avatar,custom);
  await player('battle/start',{type:'rematch',to:challenge.enemy.id},'POST',403);
  const win=await play(player,challenge);
  assert.ok(win.reward.xp>=160);
  assert.ok(win.reward.leveled);
  const progress=(await player('init')).me;
  assert.equal(progress.wins,1);
  assert.equal(progress.history.length,1);
  assert.equal((await player('challenge')).status,'finished');
  assert.equal((await player('battle/start',{})).id,challenge.id);
  const opponent=challenge.enemy.id;
  const rating={id:opponent,values:Array(6).fill(3)};
  await player('rating',rating);
  assert.equal((await player('professor?id='+opponent)).canRematch,true);
  const rematch=await player('battle/start',{type:'rematch',to:opponent,playlist:'common'});
  assert.equal(rematch.enemy.id,opponent);
  assert.notEqual(rematch.id,challenge.id);
  await player('rating',{id:opponent},'DELETE');
  await player('rating',rating);
  assert.equal((await player('battle/start',{type:'rematch',to:opponent})).id,rematch.id);
  const avatarChange={...defaultAvatar,hair:3,eyeShape:2,eyeSize:1,eyeColor:5};
  const appearance=await player('request',{kind:'avatar',target:'vale',avatar:avatarChange});
  assert.notDeepEqual((await guest('professor?id=vale')).p.avatar,avatarChange);
  await player('admin',{id:appearance.id,action:'approve'},'POST',403);
  await moderator('auth',{mode:'signup',email:'moderator@example.test',password:'moderator@example.test',name:'Test Moderator',adminCode:'integration-invite'},'POST',400);
  await moderator('auth',{mode:'signup',email:'moderator@example.test',password:'moderator-pass-123',name:'Test Moderator'},'POST',403);
  await moderator('auth',{mode:'signup',email:'moderator@example.test',password:'moderator-pass-123',name:'Test Moderator',adminCode:'integration-invite'});
  await moderator('admin',{id:appearance.id,action:'approve'});
  assert.deepEqual((await guest('professor?id=vale')).p.avatar,avatarChange);
  const submission=await player('request',{kind:'professor',name:'Fixture Faculty',school:'penn',department:'Mathematics',url:'https://www.upenn.edu'});
  assert.ok(!(await guest('init')).people.some(p=>p.name==='Fixture Faculty'));
  await moderator('admin',{id:submission.id,action:'approve'},'POST',400);
  await moderator('admin',{id:submission.id,action:'approve',verified:true});
  const fixture=(await guest('init')).people.find(p=>p.name==='Fixture Faculty');
  const review={id:fixture.id,values:Array(6).fill(5),tags:['Final Boss Energy'],course:'MATH 101',comment:'A champion of fractions.'};
  await player('rating',review);
  await player('rating',{...review,comment:'Edited review'});
  assert.equal((await guest('professor?id='+fixture.id)).reviews.length,1);
  assert.ok((await guest('professor?id='+fixture.id)).p.power>60);
  for(let i=0;i<2;i++){
    const rater=client();
    await rater('auth',{mode:'signup',email:'rating'+i+'@example.test',name:'Rating '+i,password:'rating-pass-123'});
    await rater('rating',review);
  }
  assert.equal((await guest('professor?id='+fixture.id)).p.rank,1);
  assert.equal((await guest('players')).length,1);
  const question={prompt:'How many minutes are in a full week?',category:'Math',unit:'minutes',answer:10080,scale:4000,time:25,active:true};
  const message={subject:'Test contact',message:'This message belongs in the moderator inbox.'};
  await guest('contact',message,'POST',401);
  const contact=await player('contact',message);
  await player('admin',undefined,'GET',403);
  const inbox=(await moderator('admin')).requests.find(r=>r.id===contact.id);
  assert.equal(inbox.kind,'contact');
  assert.equal(inbox.note,message.message);
  for(let i=0;i<4;i++)await player('contact',message);
  await player('contact',message,'POST',429);
  assert.ok(!(await player('submissions')).some(row=>row.id===contact.id));
  await moderator('admin',{id:contact.id,action:'approve'});
  assert.equal((await moderator('admin')).requests.find(r=>r.id===contact.id).status,'approve');
  const questionCount=(await moderator('admin')).questions.length;
  assert.equal((await guest('health')).database,'ready');
  const contribution={kind:'proposal',question:{...question,prompt:'How many hours are in a full week?',unit:'hours',answer:168,source:'https://www.nist.gov/'}};
  await guest('request',contribution,'POST',401);
  const proposal=await player('request',contribution);
  assert.equal((await player('submissions')).find(x=>x.id===proposal.id).status,'pending');
  assert.ok(!(await moderator('admin')).questions.some(q=>q.prompt===contribution.question.prompt));
  await moderator('admin',{id:proposal.id,action:'approve'});
  assert.equal((await player('submissions')).find(x=>x.id===proposal.id).status,'approve');
  assert.ok((await moderator('admin')).questions.some(q=>q.prompt===contribution.question.prompt));

  await player('admin',{action:'import',questions:[question]},'POST',403);
  const invalidImport=await moderator('admin',{action:'import',questions:[question,null]},'POST',400);
  assert.match(invalidImport.error,/Question 2/);
  assert.equal((await moderator('admin')).questions.length,questionCount+1);
  await moderator('admin',{action:'import',questions:[question]});
  assert.ok((await moderator('admin')).questions.some(q=>q.prompt===question.prompt));
  const closed=once(server,'exit');server.kill();await closed;
  origin=await start();
  assert.deepEqual((await player('init')).me.avatar,custom);
  assert.equal((await player('init')).me.xp,progress.xp);
  assert.equal((await guest('professor?id='+fixture.id)).p.count,3);
  assert.equal((await spectator('battle?id='+win.id)).winner,'player');
  const recovery=client();
  const recovered=await recovery('recover',{email:credential.email,key:recoveryKey,password:'new-test-password'});
  assert.notEqual(recovered.recoveryKey,recoveryKey);
  assert.equal((await player('init')).me,null);
  await recovery('recover',{email:credential.email,key:recoveryKey,password:'another-password'},'POST',401);
  await player('auth',{...credential,password:'new-test-password',mode:'login'});
  assert.deepEqual((await player('init')).me.avatar,custom);
});
