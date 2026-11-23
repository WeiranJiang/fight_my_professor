import { seedSchools, seedProfessors, seedQuestions } from '../seed.mjs';
import { nationalSchools } from './schools.mjs';
import { DEFAULTS } from '../game.mjs';

const upsert = 'INSERT INTO records VALUES (?,?,?) ON CONFLICT(type,id) DO UPDATE SET data=excluded.data';

// Correct the old Purdue campus mapping without replacing professor IDs or user records.
export const correctFacultyAffiliations = `UPDATE records
  SET data=json_set(data,'$.school','ipeds243780')
  WHERE type='professor' AND id LIKE 'ipeds151351-%'
    AND json_extract(data,'$.school')='ipeds151351'
    AND json_extract(data,'$.source') LIKE 'https://www.cs.purdue.edu/%'`;

export const seedRecords = [
  ...seedSchools.map(row=>['school',row]),
  ...seedProfessors.map(row=>['professor',row]),
  ...seedQuestions.map(row=>['question',row])
].map(([type, row])=>[type,row.id,JSON.stringify(row)]);

export function store({ one, all, write }) {
  const get = async (type,id) => {
    if(typeof id !== 'string' || !id || id.length > 200)return null;
    const stored=JSON.parse((await one('SELECT data FROM records WHERE type=? AND id=?',type,id))?.data ?? 'null');
    if(type!=='school')return stored;
    const baseline=nationalSchools.get(id);
    return stored?{...baseline,...stored}:baseline??null;
  };
  const list = async type => {
    const stored=(await all('SELECT data FROM records WHERE type=?',type)).map(row=>JSON.parse(row.data));
    if(type!=='school')return stored;
    const merged=new Map(nationalSchools);
    for(const row of stored)merged.set(row.id,{...merged.get(row.id),...row});
    return [...merged.values()];
  };
  return {
    one,
    write,
    get,
    list,
    put: (type,id,data) => write(upsert,type,id,JSON.stringify(data)),
    remove: (type,id) => write('DELETE FROM records WHERE type=? AND id=?',type,id),
    config: async () => ({...DEFAULTS,...await get('config','main')}),
    getUser: async id => JSON.parse((await one('SELECT data FROM users WHERE id=?',id))?.data ?? 'null'),
    saveUser: user => write('UPDATE users SET data=? WHERE id=?',JSON.stringify(user),user.id),
    users: async () => (await all('SELECT data FROM users')).map(row=>JSON.parse(row.data)),
    battleCount: async id => (await one("SELECT count(*) AS count FROM records WHERE type='battle' AND json_extract(data,'$.enemy.id')=? AND json_extract(data,'$.status')='finished'",id)).count
  };
}
