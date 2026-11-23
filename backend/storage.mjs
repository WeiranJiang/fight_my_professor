import { seedSchools, seedProfessors, seedQuestions } from '../seed.mjs';
import { DEFAULTS } from '../game.mjs';

const upsert = 'INSERT INTO records VALUES (?,?,?) ON CONFLICT(type,id) DO UPDATE SET data=excluded.data';

export const seedRecords = [
  ...seedSchools.map(row=>['school',row]),
  ...seedProfessors.map(row=>['professor',row]),
  ...seedQuestions.map(row=>['question',row])
].map(([type, row])=>[type,row.id,JSON.stringify(row)]);

export function store({ one, all, write }) {
  const get = async (type,id) => typeof id !== 'string' || !id || id.length > 200 ? null : JSON.parse((await one('SELECT data FROM records WHERE type=? AND id=?',type,id))?.data ?? 'null');
  return {
    one,
    write,
    get,
    list: async type => (await all('SELECT data FROM records WHERE type=?',type)).map(row=>JSON.parse(row.data)),
    put: (type,id,data) => write(upsert,type,id,JSON.stringify(data)),
    remove: (type,id) => write('DELETE FROM records WHERE type=? AND id=?',type,id),
    config: async () => ({...DEFAULTS,...await get('config','main')}),
    getUser: async id => JSON.parse((await one('SELECT data FROM users WHERE id=?',id))?.data ?? 'null'),
    saveUser: user => write('UPDATE users SET data=? WHERE id=?',JSON.stringify(user),user.id),
    users: async () => (await all('SELECT data FROM users')).map(row=>JSON.parse(row.data)),
    battleCount: async id => (await one("SELECT count(*) AS count FROM records WHERE type='battle' AND json_extract(data,'$.enemy.id')=? AND json_extract(data,'$.status')='finished'",id)).count
  };
}
