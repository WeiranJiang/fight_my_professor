import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { openD1 } from '../backend/d1.mjs';
import { createHandler } from '../backend/http.mjs';

test('hosted storage adapter seeds gameplay and atomically retries overlapping writes', async () => {
  const db=new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../drizzle/0000_initial.sql',import.meta.url),'utf8'));
  const prepare=(sql,args=[])=>({
    bind:(...values)=>prepare(sql,values),
    first:async()=>db.prepare(sql).get(...args),
    all:async()=>({results:db.prepare(sql).all(...args)}),
    run:()=>db.prepare(sql).run(...args)
  });
  const backend={
    prepare,
    async batch(statements){
      db.exec('BEGIN');
      try {
        const results=statements.map(statement=>statement.run());
        db.exec('COMMIT');
        return results;
      } catch(error){
        db.exec('ROLLBACK');
        throw error;
      }
    }
  };
  const withStore=openD1({withSession:()=>backend});
  const handle=createHandler({withStore,readAsset:async()=>''});
  const request=(path,body,cookie)=>handle(new Request('https://game.example'+path,body?{
    method:'POST',body:JSON.stringify(body),headers:{'content-type':'application/json',cookie}
  }:{}));
  const init=await request('/api/init');
  const {people,schools}=await init.json();
  assert.ok(people.some(p=>p.id==='vale'));
  const faculty=people.filter(p=>!p.demo);
  assert.ok(faculty.length>=1200);
  assert.ok(faculty.some(p=>p.school==='duke'&&p.department==='English'));
  assert.ok(faculty.some(p=>p.school==='berkeley'&&p.department==='Economics'));
  assert.equal(new Set(faculty.map(p=>p.id)).size,faculty.length);
  assert.ok(schools.every(school=>faculty.some(p=>p.school===school.id)));
  const profile=faculty.find(p=>p.id==='princeton-parastoo-abtahi');
  assert.equal(profile.academicTitle,'Assistant Professor');
  assert.ok(profile.research.includes('Robotics'));
  assert.equal(profile.power,60);
  assert.equal(profile.eligible,false);
  const guest=init.headers.getSetCookie()[0].split(';')[0];
  const unsafe=await handle(new Request('https://game.example/api/battle/start',{
    method:'POST',body:'{}',headers:{'content-type':'application/json',origin:'https://elsewhere.example'}
  }));
  assert.equal(unsafe.status,403);
  const matchup={mode:'guest',from:'park',to:'vale'};
  const [first,second]=await Promise.all([
    request('/api/battle/start',matchup,guest),
    request('/api/battle/start',matchup,guest)
  ]);
  assert.equal(first.status,200);
  assert.equal(second.status,200);
  const [left,right]=await Promise.all([first.json(),second.json()]);
  assert.notEqual(left.id,right.id);
  const recent=db.prepare("SELECT data FROM records WHERE type='recent'").get();
  assert.equal(new Set(JSON.parse(recent.data)).size,14);
  assert.equal((await request('/api/health')).status,200);
  db.close();
});
