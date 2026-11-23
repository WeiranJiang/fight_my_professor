import { owned, requireRule, timestamp, uid, value } from '../request.mjs';

async function contact({u,body,storage}) {
  owned(u);
  const subject=value(body.subject,90), note=value(body.message,1600);
  requireRule(subject.length>=3&&note.length>=10,'Enter a subject and a message of at least 10 characters.');
  const now=Date.now();
  const recent=(await storage.get('contact-limit',u.id)??[]).filter(time=>now-time<86400000);
  requireRule(recent.length<5,'You can send up to five messages per day.',429);
  const id=uid();
  storage.put('request',id,{id,kind:'contact',status:'pending',date:timestamp(),author:u.id,
    name:subject,note,reply:u.email,displayName:u.name});
  storage.put('contact-limit',u.id,[...recent,now]);
  return {id};
}

export default {'POST /api/contact':contact};
