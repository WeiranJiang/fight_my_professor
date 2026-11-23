import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { correctFacultyAffiliations, seedRecords, store } from './storage.mjs';

export function openSQLite(filename) {
  const file = resolve(filename);
  mkdirSync(dirname(file),{recursive:true});
  const db = new DatabaseSync(file);
  db.exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
  db.exec(readFileSync(new URL('../drizzle/0000_initial.sql',import.meta.url),'utf8'));
  db.exec(correctFacultyAffiliations);
  const insert=db.prepare('INSERT OR IGNORE INTO records VALUES (?,?,?)');
  for (const row of seedRecords) insert.run(...row);
  const storage=store({
    one: (sql,...args)=>db.prepare(sql).get(...args),
    all: (sql,...args)=>db.prepare(sql).all(...args),
    write: (sql,...args)=>db.prepare(sql).run(...args)
  });
  let queue = Promise.resolve();
  return (mutating, callback) => {
    const pending = queue.then(async () => {
      if (mutating) db.exec('BEGIN IMMEDIATE');
      try {
        const result=await callback(storage);
        if (mutating) db.exec('COMMIT');
        return result;
      } catch (error) {
        if (mutating) db.exec('ROLLBACK');
        throw error;
      }
    });
    queue = pending.catch(()=>{});
    return pending;
  };
}
