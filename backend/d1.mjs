import { correctFacultyAffiliations, seedRecords, store } from './storage.mjs';
import { fail } from './request.mjs';

async function seed(db) {
  // Seed inserts preserve changes made by moderators to existing records.
  const key='bank-and-faculty-2026-11-23-trivia';
  const marker=await db.prepare("SELECT 1 FROM records WHERE type='seed' AND id=?").bind(key).first();
  if (marker) return;
  const statements=[db.prepare(correctFacultyAffiliations)];
  // Thirty records per statement stays below D1's bound parameter limit.
  for (let offset=0;offset<seedRecords.length;offset+=30) {
    const rows=seedRecords.slice(offset,offset+30);
    const placeholders=rows.map(()=>'(?,?,?)').join(',');
    statements.push(db.prepare('INSERT OR IGNORE INTO records VALUES '+placeholders).bind(...rows.flat()));
  }
  statements.push(db.prepare("INSERT OR IGNORE INTO records VALUES ('seed',?,'true')").bind(key));
  await db.batch(statements);
}

export function openD1(binding) {
  return async (mutating, callback) => {
    // Start at the primary and keep reads monotonic for this request.
    const db=binding.withSession('first-primary');
    await seed(db);
    for (let attempt=0;attempt<4;attempt++) {
      const changes=[];
      const storage=store({
        one: (sql,...args)=>db.prepare(sql).bind(...args).first(),
        all: async (sql,...args)=>(await db.prepare(sql).bind(...args).all()).results,
        write: (sql,...args)=>changes.push(db.prepare(sql).bind(...args))
      });
      const guard="SELECT version FROM write_revision WHERE id=1";
      const revision=mutating?(await db.prepare(guard).first()).version:null;
      const result=await callback(storage);
      if (!changes.length) return result;
      try {
        // A stale revision violates the CHECK and rolls back the entire batch.
        const advance=db.prepare('UPDATE write_revision SET version=CASE WHEN version=? THEN version+1 ELSE -1 END WHERE id=1').bind(revision);
        await db.batch([advance,...changes]);
        return result;
      } catch (error) {
        const latest=await db.prepare(guard).first();
        if (latest.version===revision) throw error;
      }
    }
    fail('The game is busy. Try again in a moment.',503);
  };
}
