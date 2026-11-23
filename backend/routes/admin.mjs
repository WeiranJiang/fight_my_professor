import { DEFAULTS } from '../../game.mjs';
import { seededAvatar } from '../../public/shared.js';
import { get, list, put, remove, users } from '../storage.mjs';
import { allowedUrl, requireRule, timestamp, uid, value } from '../request.mjs';
import { cleanQuestion } from '../questions.mjs';

function admin({method, body, u, c}) {
  requireRule(u?.admin,'Admin access required.',403);
  if(method==='GET') return {requests:list('request').sort((a,b)=>b.date.localeCompare(a.date)),questions:list('question'),config:c,users:users().map(({id,name,email,admin,xp})=>({id,name,email,admin,xp})),audit:list('audit').sort((a,b)=>b.date.localeCompare(a.date))};
  if(method==='POST'){
    const {action}=body;
    if(action==='question'){
      const id=get('question',body.id)?body.id:uid();
      put('question',id,cleanQuestion(body,id));
    } else if(action==='import'){
      requireRule(Array.isArray(body.questions)&&body.questions.length<=150,'Import up to 150 numeric questions.');
      for(const q of body.questions.map(question=>cleanQuestion(question,uid()))) put('question',q.id,q);
    } else if(action==='settings'){
      const min={prior:0,priorWeight:1,minRatings:1,minProfessors:1,winXP:1,lossXP:0,firstXP:0,levelXP:50,hp:25,damage:1,botSpread:.1};
      const max={prior:100,priorWeight:100,minRatings:1000,minProfessors:100,winXP:1000,lossXP:1000,firstXP:1000,levelXP:10000,hp:300,damage:60,botSpread:5};
      const settings={};
      for(const key of Object.keys(DEFAULTS)){
        const n=body.settings?.[key];requireRule(typeof n==='number'&&n>=min[key]&&n<=max[key]&&(key==='botSpread'||Number.isInteger(n)),'Invalid balancing value for '+key+'.');settings[key]=n;
      }
      put('config','main',settings);
    } else {
      const request=get('request',body.id);
      requireRule(request&&['pending','hold'].includes(request.status)&&['approve','reject','hold'].includes(action),'Request action unavailable.');
      if(action==='approve'){
        if(request.kind==='avatar'){
          const p=get('professor',request.target); requireRule(p,'Professor was removed.');
          put('professor',p.id,{...p,avatar:request.avatar,appearanceHistory:[...(p.appearanceHistory??[]),{before:p.avatar,after:request.avatar,date:timestamp()}]});
        } else if(request.kind==='school'||request.kind==='professor'){
          requireRule(allowedUrl(request.url)&&body.verified===true,'Review the official source and confirm verification first.');
          requireRule(!list(request.kind).some(x=>x.name.toLowerCase()===request.name.toLowerCase()&&(request.kind==='school'||x.school===request.school)),'This directory entry already exists.');
          const id=uid();
          if(request.kind==='school') put('school',id,{id,name:request.name,short:request.name,location:request.location,url:request.url});
          else put('professor',id,{id,name:request.name,department:request.department,school:request.school,source:request.url,avatar:seededAvatar(id),base:Array(6).fill(c.prior),tone:'violet',title:'Faculty Challenger',demo:false});
        } else if(request.kind==='report') remove.run('rating',request.target);
        else if(request.kind==='correction'&&body.remove===true){
          const p=get('professor',request.target);
          requireRule(p,'Professor not found.',404);
          put('professor',p.id,{...p,published:false});
        }
      }
      put('request',request.id,{...request,status:action,decisionNote:value(body.note,600),reviewer:u.id,decided:timestamp()});
    }
    const id=uid();
    put('audit',id,{id,action,target:body.id??null,admin:u.name,date:timestamp()}); return {};
  }
}

export default {
  'GET /api/admin': admin,
  'POST /api/admin': admin
};
