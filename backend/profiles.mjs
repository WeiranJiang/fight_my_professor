import facultySnapshot from '../data-source/faculty.json' with {type:'json'};
import { average, difficulty, level } from '../game.mjs';

export const publicUser = (u,c) => ({id:u.id,name:u.name,school:u.school,avatar:u.avatar,xp:u.xp,level:level(u.xp,c),wins:u.wins,losses:u.losses,draws:u.draws??0,defeated:u.defeated,best:u.best,bosses:u.bosses,values:u.values});
const facultyDetails = new Map(facultySnapshot.map(({id,academicTitle,research})=>[id,{academicTitle,research}]));
export async function profiles(c, storage) {
  const {list}=storage;
  const byProfessor = new Map();
  for (const rating of (await list('rating'))) {
    if (!byProfessor.has(rating.professor)) byProfessor.set(rating.professor,[]);
    byProfessor.get(rating.professor).push(rating);
  }
  const people = (await list('professor')).filter(p=>p.published!==false).map(p=>{
    const reviews = byProfessor.get(p.id) ?? [];
    const values = p.base.map((base,i)=>{
      const prior=p.demo?base:c.prior;
      return Math.round((prior*c.priorWeight+reviews.reduce((sum,r)=>sum+(r.values[i]-1)*25,0))/(c.priorWeight+reviews.length || 1));
    });
    const power=Math.round(average(values));
    return {...facultyDetails.get(p.id),...p,values,power,count:reviews.length,eligible:!p.demo&&reviews.length>=c.minRatings,difficulty:difficulty(power,values[3])};
  }).sort((a,b)=>b.power-a.power||a.name.localeCompare(b.name));
  const schools = (await list('school')).map(s=>{
    const rated=people.filter(p=>p.school===s.id&&p.eligible);
    return {...s,count:people.filter(p=>p.school===s.id).length,eligible:rated.length>=c.minProfessors,power:rated.length?Math.round(average(rated.map(p=>p.power))):null};
  });
  const rankable=people.filter(p=>p.eligible);
  for(const p of rankable){
    p.rank=rankable.indexOf(p)+1;
    p.schoolRank=rankable.filter(x=>x.school===p.school).indexOf(p)+1;
  }
  return {people,schools,byProfessor};
}
