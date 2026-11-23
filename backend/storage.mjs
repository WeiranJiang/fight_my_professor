import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { seedSchools, seedProfessors, seedQuestions } from '../seed.mjs';
import { DEFAULTS } from '../game.mjs';

const file = resolve(process.env.FMP_DB || 'data/fmp.sqlite');
mkdirSync(dirname(file),{recursive:true});
export const db = new DatabaseSync(file);
db.exec(`
PRAGMA busy_timeout=5000;
PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS records (
  type TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY(type,id)
) STRICT;
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL,
  data TEXT NOT NULL
) STRICT;
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires INTEGER NOT NULL
) STRICT;
PRAGMA foreign_keys=ON;
`);
const one = db.prepare('SELECT data FROM records WHERE type=? AND id=?');
const many = db.prepare('SELECT data FROM records WHERE type=?');
const insert = db.prepare('INSERT OR IGNORE INTO records VALUES (?,?,?)');
const upsert = db.prepare('INSERT INTO records VALUES (?,?,?) ON CONFLICT(type,id) DO UPDATE SET data=excluded.data');
export const remove = db.prepare('DELETE FROM records WHERE type=? AND id=?');
export const get = (type,id) => JSON.parse(one.get(type,id)?.data ?? 'null');
export const list = type => many.all(type).map(row=>JSON.parse(row.data));
export const put = (type,id,data) => upsert.run(type,id,JSON.stringify(data));
const seed = (type, rows) => rows.forEach(row=>insert.run(type,row.id,JSON.stringify(row)));
seed('school',seedSchools);
seed('professor',seedProfessors);
seed('question',seedQuestions);
export const config = () => ({...DEFAULTS,...get('config','main')});
export const getUser = id => JSON.parse(db.prepare('SELECT data FROM users WHERE id=?').get(id)?.data ?? 'null');
export const saveUser = u => db.prepare('UPDATE users SET data=? WHERE id=?').run(JSON.stringify(u),u.id);
export const users = () => db.prepare('SELECT data FROM users').all().map(row=>JSON.parse(row.data));
