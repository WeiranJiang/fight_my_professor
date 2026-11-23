import { defaultAvatar } from '../public/shared.js';
import { digest } from './request.mjs';

const preferredCampuses=new Set(['mit','stanford','harvard','princeton','yale','penn','caltech','duke','northwestern','uchicago']);
const easternDate=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'});
export function challengeDay(now){
  const parts=Object.fromEntries(easternDate.formatToParts(new Date(now)).map(part=>[part.type,part.value]));
  return [parts.year,parts.month,parts.day].join('-');
}
export const guestFighter=Object.freeze({
  id:'guest-fighter',name:'Campus Challenger',avatar:defaultAvatar,values:[45,45,45,45,45,45],power:45,level:1
});

export async function pickDailyProfessor(people,day) {
  const faculty=people.filter(p=>!p.demo).sort((a,b)=>a.id.localeCompare(b.id));
  const preferred=faculty.filter(p=>preferredCampuses.has(p.school));
  const hash=await digest(day+'|fight-my-professor-daily');
  const group=preferred.length&&Number.parseInt(hash.slice(0,4),16)%4!==0?preferred:faculty;
  return group[Number.parseInt(hash.slice(4,12),16)%group.length]??null;
}

export async function dailyProfessor(people,day,storage) {
  const scheduled=await storage.get('daily-professor',day);
  return people.find(p=>p.id===scheduled&&!p.demo)??pickDailyProfessor(people,day);
}

export async function earnedRematch(storage,professorId,userId,day) {
  if(!userId)return false;
  const rating=await storage.get('rating',professorId+':'+userId);
  if(!rating)return false;
  const original=await storage.get('rating-origin',rating.id);
  return challengeDay(original??rating.createdAt??rating.date)===day;
}
