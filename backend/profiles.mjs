import facultySnapshot from '../data-source/faculty.json' with {type:'json'};
import { average, difficulty, level } from '../game.mjs';

export const publicUser = (u,c) => ({id:u.id,name:u.name,school:u.school,avatar:u.avatar,xp:u.xp,level:level(u.xp,c),wins:u.wins,losses:u.losses,draws:u.draws??0,defeated:u.defeated,best:u.best,bosses:u.bosses,values:u.values});
const facultyDetails = new Map(facultySnapshot.map(({id,academicTitle,research})=>[id,{academicTitle,research}]));
export async function profiles(c, storage, {includeSchools=false}={}) {
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
  const counts = new Map(), rates = new Map();
  let rank=0;
  for (const professor of people) {
    const {school,eligible,power,demo}=professor;
    if(!demo)counts.set(school,(counts.get(school)??0)+1);
    if(!eligible)continue;
    const rating=rates.get(school)??{count:0,total:0};
    rating.count++;
    rating.total+=power;
    rates.set(school,rating);
    professor.rank=++rank;
    professor.schoolRank=rating.count;
  }
  if(!includeSchools)return {people,byProfessor};
  const schools = (await list('school')).map(s=>{
    const rating=rates.get(s.id);
    return {...s,count:counts.get(s.id)??0,eligible:Boolean(rating&&rating.count>=c.minProfessors),power:rating?Math.round(rating.total/rating.count):null};
  });
  return {people,schools,byProfessor};
}
