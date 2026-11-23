import { stats,tags,options,colors,avatar,defaultAvatar,seededAvatar } from './shared.js';
const app=document.querySelector('#app'), account=document.querySelector('#account'), toast=document.querySelector('#toast');
const $=(selector,root=document)=>root.querySelector(selector);
const all=(selector,root=document)=>[...root.querySelectorAll(selector)];
const esc=(text='')=>String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const qs=s=>encodeURIComponent(s);
const pick=(a,b)=>a===b?'selected':'';
const fmt=n=>n===null?'Timed out':Number(n).toLocaleString('en-US',{maximumFractionDigits:2});
const date=s=>new Date(s).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
const sprite=(a,classes='')=>'<img class="sprite '+classes+'" src="'+avatar(a)+'" alt="" aria-hidden="true">';
const searchIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>';
const bolt='<span aria-hidden="true">⚡</span>';
const empty=(message)=>'<div class="empty">'+message+'</div>';
let state={people:[],schools:[],me:null}, timer, toastTimer, routeCounter=0, returnTo='', activeDialog;
const current=()=>decodeURIComponent(location.hash.slice(1).split('?')[0]||'home');
const params=()=>new URLSearchParams(location.hash.split('?')[1]||'');
const prof=id=>state.people.find(p=>p.id===id);
const school=id=>state.schools.find(s=>s.id===id);
const go=fragment=>{if(location.hash==='#'+fragment) route();else location.hash=fragment;};
const button=(label,href,classes='')=>'<a class="btn '+classes+'" href="#'+href+'">'+label+'</a>';
const head=(label,title,description='')=>'<div class="page-title">'+(label?'<span class="eyebrow">'+label+'</span>':'')+'<h1>'+title+'</h1>'+(description?'<p class="muted">'+description+'</p>':'')+'</div>';
const sectionHead=(label,title,action='',subtitle='')=>'<div class="section-head"><div><span class="eyebrow">'+label+'</span><h2>'+title+'</h2>'+(subtitle?'<p class="muted">'+subtitle+'</p>':'')+'</div>'+action+'</div>';
const score=(n,label='POWER')=>'<div class="score">'+n+'<span>'+label+'</span></div>';
const schoolName=id=>esc(school(id)?.name??'Independent');
const linkProf=id=>'professor?id='+qs(id);
const linkSchool=id=>'school?id='+qs(id);
const noAuth=()=>{returnTo=location.hash.slice(1);go('login');};
async function api(path,data,method='POST'){
  const response=await fetch('/api/'+path,data===undefined?{}:{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  const payload=await response.json();
  if(!response.ok)throw new Error(payload.error);
  return payload;
}
function showToast(message){
  clearTimeout(toastTimer);toast.textContent=message;
  toastTimer=setTimeout(()=>toast.textContent='',4500);
}
async function refresh(){state=await api('init');nav();}
function nav(){
  account.innerHTML=state.me?'<div class="account-actions">'+(state.me.admin?'<a href="#admin">Admin</a>':'')+button('My Fighter','fighter','primary')+'</div>':'<div class="account-actions"><a href="#login">Log in</a>'+button('Sign up','signup','primary')+'</div>';
  all('.nav nav a').forEach(node=>{
    const section=current();
    if(node.hash===location.hash||node.hash==='#'+section||(section==='professor'&&node.hash==='#search')||(section==='battle'&&node.hash==='#fight')||(section==='school'&&node.hash==='#schools'))node.setAttribute('aria-current','page'); else node.removeAttribute('aria-current');
  });
}
function page(content,classes=''){app.innerHTML='<div class="wrap page '+classes+'">'+content+'</div>';}
function card(p,action='Challenge'){
  return '<article class="prof-card"><a href="#'+linkProf(p.id)+'" class="card-stage tone-'+esc(p.tone)+'" aria-label="View '+esc(p.name)+'"><span class="pill">'+esc(p.difficulty)+'</span>'+(p.demo?'<span class="demo">DEMO</span>':'')+sprite(p.avatar)+'</a><div class="card-body"><div class="card-name"><div><h3><a href="#'+linkProf(p.id)+'">'+esc(p.name)+'</a></h3><p>'+esc(p.department)+' · '+esc(school(p.school)?.short??'')+'</p></div>'+score(p.power)+'</div><small>'+esc(p.title)+' · '+p.count+' '+(p.count===1?'rating':'ratings')+'</small>'+button(action,action==='Challenge'?'fight?to='+qs(p.id):linkProf(p.id),'subtle')+'</div></article>';
}
const bars=p=>'<div class="bars">'+stats.map((label,i)=>'<div class="bar-row"><span>'+label+'</span><div class="meter" aria-hidden="true"><i style="width:'+p.values[i]+'%"></i></div><strong>'+p.values[i]+'</strong></div>').join('')+'</div>';
const schoolCard=s=>'<a class="school-card" href="#'+linkSchool(s.id)+'"><span class="school-icon" aria-hidden="true">▦</span><h3>'+esc(s.name)+'</h3><small>'+esc(s.location)+' · '+s.count+' '+(s.count===1?'professor':'professors')+'</small></a>';
function home(){
  const [left,right]=[prof('park'),prof('vale')];
  const featured=[prof('vale'),prof('park'),prof('rivera')].filter(Boolean);
  const top=state.people.filter(p=>p.eligible).slice(0,4);
  const campuses=state.schools.filter(s=>s.eligible).sort((a,b)=>b.power-a.power).slice(0,4);
  app.innerHTML='<section class="hero"><div class="wrap hero-inner"><div><span class="eyebrow">'+bolt+' Rate. Rank. Fight.</span><h1>Think you can<br>beat your <span>professor?</span></h1><p class="lede">Rate their combat stats. Build a tiny pixel fighter. Take on the faculty in closest-wins trivia.</p><form id="hero-search" class="searchbox" role="search">'+searchIcon+'<input name="q" aria-label="Search for a professor or university" placeholder="Search for a professor or university" autocomplete="off"><button class="btn primary">Find a professor</button><div class="suggestions"></div></form><div class="hero-actions">'+button(bolt+' Start fighting','fight','dark')+'<small>Guest battles require no account.</small></div></div>'+
    (left&&right?'<aside class="arcade" aria-label="Preview of two pixel fighters in the campus arena"><div class="arcade-top pixel"><span>Campus Arena</span><span class="lights" aria-hidden="true"><i></i><i></i><i></i></span></div><div class="showdown"><div class="hero-meter left">PROF. PARK<span><i></i></span></div><div class="hero-meter right">DR. VALE<span><i></i></span></div>'+sprite(left.avatar,'left-sprite')+sprite(right.avatar,'right-sprite')+'<div class="arcade-vs">VS</div></div><div class="arcade-bottom pixel"><span>Closest guess lands the hit</span><a href="#fight?from=park&to=vale">Play matchup</a></div></aside>':'')+'</div></section>'+
    '<section class="section wrap">'+sectionHead('The battle board','Featured Professor Battles',button('Enter the arena','fight','subtle'))+'<div class="grid three">'+featured.map(p=>card(p)).join('')+'</div></section>'+
    '<section class="section dark-section"><div class="wrap">'+sectionHead('How to play','From office hours to the arena')+'<div class="grid steps">'+[
      ['Find your professor','Search the campus directory.'],['Rate their stats','Give each of the six traits a score.'],['Make it personal','Build your own pixel fighter.'],['Enter the arena','Land hits with closer estimates.'],['Level up','Earn XP and unlock cosmetics.']
    ].map(([label,copy])=>'<div class="step"><h3>'+label+'</h3><p>'+copy+'</p></div>').join('')+'</div></div></section>'+
    '<section class="section wrap">'+sectionHead('Leaderboards','Campus standings',button('Full rankings','rankings','subtle'))+'<div class="grid three"><div class="panel stack"><h3>Top-ranked professors</h3><div class="mini-list">'+(top.length?top.map((p,i)=>'<a href="#'+linkProf(p.id)+'"><span>#'+(i+1)+'</span><strong>'+esc(p.name)+'</strong>'+score(p.power)+'</a>').join(''):empty('Official ranks appear after '+state.settings.minRatings+' community ratings.'))+'</div></div><div class="panel stack"><h3>Strongest universities</h3><div class="mini-list">'+(campuses.length?campuses.map((s,i)=>'<a href="#'+linkSchool(s.id)+'"><span>#'+(i+1)+'</span><strong>'+esc(s.short)+'</strong>'+score(s.power)+'</a>').join(''):empty('School ranks require '+state.settings.minProfessors+' ranked professors.'))+'</div></div><div class="panel stack"><h3>Top student fighters</h3><div id="home-players" class="mini-list">'+empty('Loading student standings…')+'</div></div></div></section>';
  api('players').then(players=>{
    const el=$('#home-players');if(!el)return;
    el.innerHTML=players.sort((a,b)=>b.xp-a.xp).slice(0,4).map((u,i)=>'<a href="#player?id='+qs(u.id)+'"><span>#'+(i+1)+'</span><strong>'+esc(u.name)+'</strong><span>Lv. '+u.level+'</span></a>').join('')||empty('Complete a battle to get on the board.');
  }).catch(()=>{if($('#home-players'))$('#home-players').textContent='Standings are temporarily unavailable.';});
  const form=$('#hero-search'), input=form.elements.q, suggestions=$('.suggestions',form);
  form.onsubmit=e=>{e.preventDefault();go('search?q='+qs(input.value.trim()));};
  input.oninput=()=>{
    const query=input.value.toLowerCase().trim();
    const entries=[...state.people.filter(p=>p.name.toLowerCase().includes(query)).map(p=>[p.name,p.demo?'Demo professor':p.department,linkProf(p.id)]),...state.schools.filter(s=>(s.name+' '+s.short).toLowerCase().includes(query)).map(s=>[s.name,'University',linkSchool(s.id)])];
    suggestions.innerHTML=query?entries.slice(0,6).map(([name,type,link])=>'<a href="#'+link+'"><strong>'+esc(name)+'</strong><small>'+esc(type)+'</small></a>').join(''):'';
  };
  form.addEventListener('focusout',event=>{if(!form.contains(event.relatedTarget))suggestions.replaceChildren();});
  input.addEventListener('focus',()=>input.oninput());
  input.addEventListener('keydown',event=>{if(event.key==='Escape')suggestions.replaceChildren();if(event.key==='ArrowDown'&&$('a',suggestions)){event.preventDefault();$('a',suggestions).focus();}});
}
const schoolOptions=(selected='',allLabel='All schools')=>'<option value="">'+allLabel+'</option>'+state.schools.map(s=>'<option value="'+esc(s.id)+'" '+pick(s.id,selected)+'>'+esc(s.name)+'</option>').join('');
function search(){
  const q=params().get('q')??'';
  page(head('Faculty directory','Find a Professor','Explore fictional combat stats, student ratings, and trivia opponents.')+
    '<div class="filters"><input id="query" aria-label="Search directory" placeholder="Professor, department or university" value="'+esc(q)+'"><select id="school-filter" aria-label="Filter by school">'+schoolOptions(params().get('school')??'')+'</select>'+button('Request a professor','request?kind=professor','subtle')+'</div><div id="search-results"></div>');
  const input=$('#query'),select=$('#school-filter'),results=$('#search-results');
  const render=()=>{
    const query=input.value.trim().toLowerCase(), campus=select.value;
    const people=state.people.filter(p=>(!campus||p.school===campus)&&[p.name,p.department,school(p.school)?.name,school(p.school)?.short].filter(Boolean).join(' ').toLowerCase().includes(query));
    const schools=query&&!campus?state.schools.filter(s=>(s.name+' '+s.short).toLowerCase().includes(query)):[];
    results.innerHTML='<p class="muted">'+people.length+' professor'+(people.length===1?'':'s')+'</p>'+(people.length?'<div class="grid three">'+people.map(p=>card(p,'View profile')).join('')+'</div>':empty('No professors match this search.'))+(schools.length?'<div class="section"><h2>Matching schools</h2><br><div class="grid three school-grid">'+schools.map(schoolCard).join('')+'</div></div>':'');
  };
  input.oninput=render;select.onchange=render;render();
}
function schools(){
  page(head('University directory','Schools','Browse the launch campuses and see who’s in their arena.')+'<div class="filters"><input id="school-query" aria-label="Search schools" placeholder="Search schools">'+button('Request a school','request?kind=school','subtle')+'</div><div id="schools" class="grid three school-grid"></div>');
  const input=$('#school-query');
  input.oninput=()=>{$('#schools').innerHTML=state.schools.filter(s=>(s.name+' '+s.short+' '+s.location).toLowerCase().includes(input.value.toLowerCase().trim())).map(schoolCard).join('')||empty('No schools match.');};
  input.oninput();
}
function schoolPage(){
  const s=school(params().get('id'));if(!s)throw new Error('School not found.');
  const people=state.people.filter(p=>p.school===s.id);
  page(head('Campus directory',esc(s.name),esc(s.location))+'<div class="actions"><a class="btn subtle" href="'+esc(s.url)+'" target="_blank" rel="noopener">University website</a>'+button('Campus rankings','rankings?school='+qs(s.id),'subtle')+button('Request a professor','request?kind=professor&school='+qs(s.id),'primary')+'</div><div class="section"><h2>Professors</h2><br>'+(people.length?'<div class="grid three">'+people.map(p=>card(p)).join('')+'</div>':empty('This school is waiting for its first approved faculty profile.'))+'</div>');
}
function modal(title,content){
  activeDialog?.close();
  const el=document.createElement('dialog');el.className='modal';
  el.innerHTML='<div class="modal-header"><h3>'+title+'</h3><button type="button" aria-label="Close">×</button></div>'+content;
  $('.modal-header button',el).onclick=()=>el.close();
  el.addEventListener('close',()=>{el.remove();if(activeDialog===el)activeDialog=null;});
  document.body.append(el);activeDialog=el;el.showModal();return el;
}
const field=(label,name,extra='')=>'<label class="field">'+label+'<input name="'+name+'" '+extra+'></label>';
const textarea=(label,name,extra='')=>'<label class="field">'+label+'<textarea name="'+name+'" '+extra+'></textarea></label>';
const err='<p class="error" role="alert"></p>';
function bindForm(form,submit){
  form.onsubmit=async event=>{
    event.preventDefault();
    const button=event.submitter, error=$('.error',form), data=new FormData(form);
    if(button)button.disabled=true;if(error)error.textContent='';
    try{await submit(data,button);}
    catch(ex){if(error)error.textContent=ex.message;else showToast(ex.message);}
    finally{if(button)button.disabled=false;}
  };
}
function auth(signup){
  page('<div class="auth">'+head('Campus arcade',signup?'Join the arena':'Welcome back',signup?'Create an account to rate professors and level up your fighter.':'Log in to manage your fighter and community ratings.')+
    '<form class="panel stack" id="auth">'+(signup?field('Display name','name','required minlength="2" maxlength="28" autocomplete="nickname"'):'')+field('Email','email','required type="email" autocomplete="email"')+field('Password','password','required type="password" minlength="8" maxlength="128" autocomplete="'+(signup?'new-password':'current-password')+'"')+(signup&&params().has('admin')?field('Admin invite code','adminCode','type="password" autocomplete="off"'):'')+err+'<button class="btn primary raised">'+(signup?'Create account':'Log in')+'</button><small>'+(signup?'Already have an account? <a class="text-link" href="#login">Log in</a>':'New here? <a class="text-link" href="#signup">Create an account</a>')+'</small></form></div>');
  if(!signup)$('#auth').insertAdjacentHTML('beforeend','<small><a class="text-link" href="#recover">Use a recovery key</a></small>');
  bindForm($('#auth'),async data=>{
    const result=await api('auth',{...Object.fromEntries(data),mode:signup?'signup':'login'});
    await refresh();
    const proceed=()=>{
      if(result.newFighter)go('fighter?edit=1');
      else{const destination=returnTo||'fighter';returnTo='';go(destination);}
    };
    if(result.recoveryKey)showRecoveryKey(result.recoveryKey,proceed);
    else proceed();
  });
}
function showRecoveryKey(key,proceed=()=>{}){
  const dialog=modal('Save your recovery key','<p>This key lets you reset your password. Store it privately. A replacement key invalidates the previous one.</p>'+field('Recovery key','key','readonly value="'+esc(key)+'"')+'<br><button class="btn primary" id="continue">Continue</button>');
  $('#continue',dialog).onclick=()=>dialog.close();
  dialog.addEventListener('close',proceed,{once:true});
}
function recovery(){
  page('<div class="auth">'+head('Account access','Reset your password','Use the recovery key you saved for this account.')+'<form id="recovery" class="panel stack">'+field('Email','email','required type="email" autocomplete="email"')+field('Recovery key','key','required maxlength="64" autocomplete="off"')+field('New password','password','required type="password" minlength="8" maxlength="128" autocomplete="new-password"')+err+'<button class="btn primary">Reset password</button></form></div>');
  bindForm($('#recovery'),async data=>{
    const result=await api('recover',Object.fromEntries(data));
    await refresh();showRecoveryKey(result.recoveryKey,()=>go('login'));
  });
}
async function professor(id,version){
  const {p,reviews,fought}=await api('professor?id='+qs(id));
  if(version!==routeCounter)return;
  const mine=reviews.find(r=>r.mine);
  page('<div class="profile-head">'+score(p.power,'OVERALL POWER')+'<div><span class="eyebrow">'+(p.demo?'Fictional demo professor':'Professor profile')+'</span><h1>'+esc(p.name)+'</h1><p class="muted">'+esc(p.department)+' · <a class="text-link" href="#'+linkSchool(p.school)+'">'+schoolName(p.school)+'</a></p><span class="pill">'+p.difficulty+'</span> <small>'+p.count+' ratings'+(p.rank?' · #'+p.schoolRank+' at '+esc(school(p.school)?.short)+' · #'+p.rank+' globally':'')+'</small></div><div class="card-stage tone-'+esc(p.tone)+'">'+sprite(p.avatar)+'</div></div>'+
    '<div class="actions">'+button(bolt+' Challenge professor','fight?to='+qs(p.id),'primary raised')+'<button class="btn" id="rate">'+(mine?'Edit your rating':'Rate professor')+'</button><button class="btn subtle" id="compare">Compare</button><button class="btn subtle" id="favorite">'+(state.me?.favorites.includes(p.id)?'★ Saved':'☆ Save')+'</button></div>'+
    '<div class="section grid two"><div class="panel stack"><h2>Combat stats</h2>'+bars(p)+'<small>Bayesian average weighted with '+state.settings.priorWeight+' prior ratings at '+(p.demo?'each demo base stat':state.settings.prior+'/100')+'. Official ranks require '+state.settings.minRatings+' ratings and a verified faculty profile.</small></div><div class="panel stack"><h2>About this fighter</h2><p>'+esc(p.title)+' · '+fought+' completed '+(fought===1?'battle':'battles')+'</p><small>'+(p.demo?'This is a fictional training character. The university label identifies the demo arena.':'This avatar and combat profile are community-created game elements.')+'</small><div class="actions"><button class="btn subtle" id="avatar-edit">Suggest avatar edit</button><button class="btn subtle" id="correction">Request correction or removal</button></div>'+(p.source?'<a class="text-link small" href="'+esc(p.source)+'" target="_blank" rel="noopener">Official faculty source</a>':'')+'</div></div>'+
    '<div class="panel"><h2>Student reviews</h2>'+(reviews.map(r=>'<article class="review"><div class="split"><strong>'+((r.values.reduce((x,y)=>x+y,0)/6).toFixed(1))+' / 5</strong><small>'+date(r.date)+(r.course?' · '+esc(r.course):'')+'</small></div><small>'+stats.map((s,i)=>s+' '+r.values[i]).join(' · ')+'</small><p>'+esc(r.comment)+'</p><div class="actions">'+r.tags.map(t=>'<span class="pill">'+esc(t)+'</span>').join('')+'</div><div class="actions">'+(r.mine?'<button class="btn subtle danger" id="remove-review">Delete your rating</button>':'<button class="btn subtle" data-help="'+esc(r.id)+'" aria-pressed="'+r.voted+'">Helpful ('+r.helpful+')</button><button class="btn subtle" data-report="'+esc(r.id)+'">Report</button>')+'</div></article>').join('')||empty('No student ratings yet.'))+'</div>');
  $('#rate').onclick=()=>state.me?rating(p,mine):noAuth();
  $('#favorite').onclick=async()=>{if(!state.me){noAuth();return;}try{await api('favorite',{id:p.id});await refresh();route(false);}catch(e){showToast(e.message);}};
  $('#avatar-edit').onclick=()=>state.me?avatarEditor(p):noAuth();
  $('#correction').onclick=()=>report('correction',p.id,'Request a correction or removal');
  $('#compare').onclick=()=>compare(p);
  all('[data-help]').forEach(el=>el.onclick=async()=>{el.disabled=true;try{await api('helpful',{id:el.dataset.help});route(false);}catch(e){showToast(e.message);el.disabled=false;}});
  all('[data-report]').forEach(el=>el.onclick=()=>report('report',el.dataset.report,'Report this review'));
  if($('#remove-review'))$('#remove-review').onclick=()=>{
    const dialog=modal('Delete your rating?','<p>This removes your rating and written review.</p><button class="btn danger" id="confirm-delete">Delete rating</button>');
    $('#confirm-delete',dialog).onclick=async()=>{try{await api('rating',{id:p.id},'DELETE');dialog.close();await refresh();route(false);showToast('Rating deleted.');}catch(e){showToast(e.message);}};
  };
}
function rating(p,mine){
  const dialog=modal('Rate '+esc(p.name),'<p class="small">Score their fictional game attributes from 1 to 5.</p><form class="stack">'+stats.map((name,i)=>'<div class="rating-row"><strong>'+name+'</strong><fieldset aria-label="'+name+'">'+[1,2,3,4,5].map(n=>'<label class="rating-choice"><input type="radio" name="r'+i+'" value="'+n+'" '+(mine?.values[i]===n?'checked':'')+' required><span>'+n+'</span></label>').join('')+'</fieldset></div>').join('')+'<label><strong>Tags</strong> <small>Pick up to 3</small></label><div class="actions">'+tags.map(t=>'<label class="tag-choice"><input type="checkbox" name="tags" value="'+esc(t)+'" '+(mine?.tags.includes(t)?'checked':'')+'><span>'+esc(t)+'</span></label>').join('')+'</div>'+field('Course code (optional)','course','maxlength="24" value="'+esc(mine?.course)+'"')+'<label class="field">Comment (optional)<textarea name="comment" maxlength="600" placeholder="Keep it playful and about the game.">'+esc(mine?.comment)+'</textarea></label>'+err+'<button class="btn primary raised">Save rating</button></form>');
  all('[name=tags]',dialog).forEach(box=>box.onchange=()=>{if(all('[name=tags]:checked',dialog).length>3){box.checked=false;showToast('Choose up to three tags.');}});
  bindForm($('form',dialog),async data=>{
    await api('rating',{id:p.id,values:stats.map((_,i)=>Number(data.get('r'+i))),tags:data.getAll('tags'),course:data.get('course'),comment:data.get('comment')});
    dialog.close();await refresh();route(false);showToast('Rating saved.');
  });
}
function compare(p){
  const peers=state.people.filter(x=>x.id!==p.id);
  const dialog=modal('Compare professors',peers.length?'<div class="stack"><label class="field">Compare with<select id="peer">'+peers.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name)+'</option>').join('')+'</select></label><div id="comparison" class="grid two"></div></div>':empty('Add another professor to compare.'));
  const select=$('#peer',dialog);if(!select)return;
  select.onchange=()=>{$('#comparison',dialog).innerHTML=[p,prof(select.value)].map(x=>'<div class="stack"><h3>'+esc(x.name)+'</h3>'+bars(x)+'</div>').join('');};select.onchange();
}
function report(kind,target,title){
  const dialog=modal(title,'<form class="stack">'+textarea('Describe the issue','note','required maxlength="600"')+(kind==='correction'?field('Contact email (optional)','reply','type="email" maxlength="254"'):'')+err+'<button class="btn primary">Send for review</button></form>');
  bindForm($('form',dialog),async data=>{await api('request',{kind,target,...Object.fromEntries(data)});dialog.close();showToast('Sent for moderator review.');});
}
function requestPage(){
  if(!state.me){noAuth();return;}
  const kind=params().get('kind')==='school'?'school':'professor', isSchool=kind==='school';
  page(head('Directory requests','Request a '+kind,'A moderator checks an official source before publishing directory entries.')+
    '<form id="request" class="panel stack">'+field(isSchool?'University name':'Professor name','name','required maxlength="120"')+(isSchool?field('City and state or country','location','required maxlength="120"'):'<label class="field">University<select name="school" required>'+schoolOptions(params().get('school')??'','Choose a school')+'</select></label>'+field('Department','department','required maxlength="120"'))+field(isSchool?'Official university website':'Official faculty-directory URL','url','type="url" required')+textarea('Supporting information (optional)','note','maxlength="600"')+err+'<div><button class="btn primary raised">Submit for verification</button></div></form>');
  bindForm($('#request'),async data=>{await api('request',{kind,...Object.fromEntries(data)});go(isSchool?'schools':'search');showToast('Request is pending verification.');});
}
const traitLabels={skin:'Skin tone',hair:'Hair',hairColor:'Hair color',glasses:'Glasses',beard:'Facial hair',shirt:'Shirt',shirtColor:'Shirt color',pants:'Pants',pantsColor:'Pants color',shoes:'Shoes',prop:'Accessory'};
function availability(key,index){return ({prop:{3:5,6:10},shirtColor:{7:20}})[key]?.[index]??0;}
function attachCreator(root,initial,maxLevel=Infinity){
  let traits={...initial};
  const draw=()=>{
    root.innerHTML='<div class="creator"><div class="preview">'+sprite(traits)+'</div><div class="stack"><div class="choices">'+Object.entries(options).map(([key,variants])=>colors.has(key)?'<div class="field"><strong>'+traitLabels[key]+'</strong><div class="swatches">'+variants.map((color,i)=>'<button type="button" data-color="'+key+'" data-index="'+i+'" aria-label="'+traitLabels[key]+' '+(i+1)+'" aria-pressed="'+(traits[key]===i)+'" style="background:'+color+'" '+(availability(key,i)>maxLevel?'disabled':'')+'></button>').join('')+'</div></div>':'<label class="field">'+traitLabels[key]+'<select data-trait="'+key+'">'+variants.map((variant,i)=>'<option value="'+i+'" '+pick(i,traits[key])+' '+(availability(key,i)>maxLevel?'disabled':'')+'>'+variant+(availability(key,i)>maxLevel?' (Lv. '+availability(key,i)+')':'')+'</option>').join('')+'</select></label>').join('')+'</div><div class="actions"><button class="btn subtle" type="button" id="randomize">Randomize</button><button class="btn subtle" type="button" id="reset">Reset</button></div></div></div>';
    const updateFocus=(selector)=>{draw();$(selector,root)?.focus({preventScroll:true});};
    all('[data-color]',root).forEach(node=>node.onclick=()=>{
      traits[node.dataset.color]=Number(node.dataset.index);
      updateFocus('[data-color="'+node.dataset.color+'"][data-index="'+node.dataset.index+'"]');
    });
    all('[data-trait]',root).forEach(node=>node.onchange=()=>{traits[node.dataset.trait]=Number(node.value);$('.preview img',root).src=avatar(traits);});
    $('#randomize',root).onclick=()=>{
      traits=seededAvatar(crypto.randomUUID());
      for(const key of Object.keys(traits))if(availability(key,traits[key])>maxLevel)traits[key]=0;
      updateFocus('#randomize');
    };
    $('#reset',root).onclick=()=>{traits={...initial};updateFocus('#reset');};
  };
  draw();return ()=>traits;
}
function avatarEditor(p){
  const dialog=modal('Suggest an avatar edit','<form class="stack"><div id="creator"></div>'+textarea('Reason (optional)','note','maxlength="600"')+err+'<button class="btn primary">Submit for approval</button></form>');
  const get=attachCreator($('#creator',dialog),p.avatar);
  bindForm($('form',dialog),async data=>{await api('request',{kind:'avatar',target:p.id,avatar:get(),note:data.get('note')});dialog.close();showToast('Avatar suggestion is pending review.');});
}
function fighter(){
  if(!state.me){noAuth();return;}
  const me=state.me;
  if(params().has('edit')||!me.avatar){
    page(head('Character creator','Create Your Fighter','Think you can survive office hours?')+
      '<form id="fighter-form" class="panel stack"><div id="creator"></div><label class="field">Home university (optional)<select name="school">'+schoolOptions(me.school,'No university selected')+'</select></label><div id="allocation"></div>'+err+'<div><button class="btn primary raised">Save character</button></div></form>');
    const get=attachCreator($('#creator'),me.avatar??defaultAvatar,me.level), values=[...me.values], budget=303+(me.level-1)*2;
    const build=()=>{
      const remaining=budget-values.reduce((a,b)=>a+b,0);
      $('#allocation').innerHTML='<h3>Combat build</h3><p class="small">'+remaining+' points available</p>'+stats.map((label,i)=>'<div class="stat-build"><strong>'+label+'</strong><div>'+values[i]+' <button type="button" class="btn subtle" data-index="'+i+'" data-offset="-1" aria-label="Remove '+label+' point" '+(values[i]===me.values[i]?'disabled':'')+'>−</button><button type="button" class="btn subtle" data-index="'+i+'" data-offset="1" aria-label="Add '+label+' point" '+(remaining<=0||values[i]>=80?'disabled':'')+'>+</button></div></div>').join('');
      all('[data-offset]').forEach(el=>el.onclick=()=>{values[el.dataset.index]+=Number(el.dataset.offset);build();$('[data-index="'+el.dataset.index+'"][data-offset="'+el.dataset.offset+'"]')?.focus();});
    };
    build();
    bindForm($('#fighter-form'),async data=>{
      await api('fighter',{avatar:get(),school:data.get('school'),values});
      await refresh();
      const target=returnTo||'fighter';returnTo='';go(target);showToast('Fighter saved.');
    });
    return;
  }
  playerProfile(me,true);
}
const fighterTitle=n=>n>=50?'Dean’s Nightmare':n>=30?'Tenure Threat':n>=20?'Professor Slayer':n>=10?'Academic Weapon':n>=5?'Teaching Assistant':'Campus Challenger';
function playerProfile(user,isMe=false){
  const total=user.wins+user.losses+(user.draws??0), power=Math.round(user.values.reduce((a,b)=>a+b,0)/6), xp=user.xp%state.settings.levelXP;
  page('<div class="profile-head">'+score(power)+'<div><span class="eyebrow">'+fighterTitle(user.level)+'</span><h1>'+esc(user.name)+'</h1><p class="muted">Level '+user.level+' · '+(user.school?schoolName(user.school):'Independent fighter')+'</p></div><div class="card-stage tone-violet">'+sprite(user.avatar)+'</div></div>'+
    (isMe?'<div class="actions">'+button(bolt+' Challenge a professor','fight?mode=player','primary raised')+button('Customize fighter','fighter?edit=1')+'<button class="btn subtle" id="recovery-key">Recovery key</button><button class="btn subtle" id="logout">Log out</button></div>':'')+
    '<div class="section grid two"><div class="panel stack"><h2>Combat stats</h2>'+bars(user)+'</div><div class="panel stack"><h2>Progression</h2><div><strong>'+user.xp+' XP</strong><div class="meter" aria-hidden="true"><i style="width:'+(xp/state.settings.levelXP*100)+'%"></i></div><small>'+xp+' / '+state.settings.levelXP+' XP to next level</small></div><div>'+total+' battles · '+user.wins+' wins · '+user.losses+' losses'+(user.draws?' · '+user.draws+' draws':'')+'</div><div>'+(total?Math.round(user.wins/total*100):0)+'% win rate · '+user.defeated.length+' unique opponents defeated</div><div>Best trivia score '+user.best+'</div></div></div>'+
    (isMe?'<div class="grid two"><div class="panel stack"><h2>Achievements</h2><div class="actions">'+(user.achievements.map(a=>'<span class="pill">'+esc(a)+'</span>').join('')||'<small>Play your first battle to start earning badges.</small>')+'</div><h3>Saved professors</h3><div class="mini-list">'+(user.favorites.map(id=>prof(id)).filter(Boolean).map(p=>'<a href="#'+linkProf(p.id)+'">★ <strong>'+esc(p.name)+'</strong>'+score(p.power)+'</a>').join('')||'<small>Save professors from their profiles.</small>')+'</div></div><div class="panel stack"><h2>Battle history</h2><div class="mini-list">'+(user.history.map(b=>'<a href="#battle?id='+qs(b.id)+'"><span>'+({player:'✓',enemy:'×',tie:'='})[b.result]+'</span><strong>'+esc(b.name)+'</strong><small>'+date(b.date)+'</small></a>').join('')||'<small>Your completed challenges will appear here.</small>')+'</div></div></div>':''));
  if(isMe)$('#recovery-key').onclick=()=>{
    const dialog=modal('Generate a recovery key','<form class="stack">'+field('Current password','password','type="password" required autocomplete="current-password"')+err+'<button class="btn primary">Generate key</button></form>');
    bindForm($('form',dialog),async data=>{
      const result=await api('recovery-key',Object.fromEntries(data));
      dialog.close();showRecoveryKey(result.recoveryKey);
    });
  };
  if(isMe)$('#logout').onclick=async()=>{try{await api('logout',{});await refresh();go('home');showToast('Logged out.');}catch(e){showToast(e.message);}};
}
async function ranks(version){
  const types=['Professors','Schools','Players'];
  const players=await api('players');if(version!==routeCounter)return;
  const initial=params().get('school')??'';
  let mode=types.includes(params().get('tab'))?params().get('tab'):initial?'Professors': 'Professors';
  const playerMetrics=['Player level','Total wins','Unique professors defeated','Win rate','Best trivia performance','Bosses defeated'];
  const professorMetrics=['Overall power',...stats];
  const dept=[...new Set(state.people.filter(p=>!p.demo).map(p=>p.department))].sort();
  page(head('The standings','Rankings','Compare verified faculty, campus standings, and student fighters.')+'<div id="rankers"></div>');
  const container=$('#rankers');
  function build(){
    const choices=mode==='Players'?playerMetrics:professorMetrics;
    container.innerHTML='<div class="tabs" role="tablist" aria-label="Ranking type">'+types.map(t=>'<button class="btn subtle" type="button" role="tab" aria-selected="'+(mode===t)+'" data-tab="'+t+'">'+t+'</button>').join('')+'</div>'+
      (mode==='Schools'?'':'<div class="filters"><select id="rank-school" aria-label="Filter by university">'+schoolOptions(initial)+'</select><select id="metric" aria-label="Ranking metric">'+choices.map((m,i)=>'<option value="'+i+'">'+m+'</option>').join('')+'</select>'+(mode==='Professors'?'<select id="department" aria-label="Filter by department"><option value="">All departments</option>'+dept.map(d=>'<option>'+esc(d)+'</option>').join('')+'</select>':'')+'</div>')+'<div class="panel" id="rank-list"></div>';
    all('[data-tab]',container).forEach(el=>el.onclick=()=>{mode=el.dataset.tab;build();$('[data-tab="'+mode+'"]').focus();});
    all('select',container).forEach(el=>el.onchange=rows);rows();
  }
  function rows(){
    const campus=$('#rank-school')?.value, metric=Number($('#metric')?.value??0), department=$('#department')?.value;
    let entries=[];
    if(mode==='Professors')entries=state.people.filter(p=>p.eligible&&(!campus||p.school===campus)&&(!department||p.department===department)).map(p=>({name:p.name,link:linkProf(p.id),detail:p.count+' ratings · '+(school(p.school)?.short??''),points:metric?p.values[metric-1]:p.power}));
    if(mode==='Schools')entries=state.schools.filter(s=>s.eligible).map(s=>({name:s.name,link:linkSchool(s.id),detail:s.location,points:s.power}));
    if(mode==='Players')entries=players.filter(u=>(!campus||u.school===campus)&&(metric!==3||u.wins+u.losses+(u.draws??0)>=5)).map(u=>({name:u.name,link:'player?id='+qs(u.id),detail:'Lv. '+u.level+' · '+(school(u.school)?.short??'Independent'),points:[u.level,u.wins,u.defeated.length,Math.round(100*u.wins/(u.wins+u.losses+(u.draws??0)||1)),u.best,u.bosses][metric],xp:u.xp}));
    entries.sort((a,b)=>b.points-a.points||(mode==='Players'&&metric===0?b.xp-a.xp:0)||a.name.localeCompare(b.name));
    const note=mode==='Schools'?'Official standings require '+state.settings.minProfessors+' ranked professors per school.':mode==='Professors'?'Official standings require verified faculty and '+state.settings.minRatings+' ratings.':metric===3?'Win-rate rankings require at least five battles.':'Create a fighter to enter the rankings.';
    $('#rank-list').innerHTML='<p class="small">'+note+'</p>'+(entries.map((p,i)=>'<div class="rank-row"><strong>#'+(i+1)+'</strong><div><a href="#'+p.link+'"><strong>'+esc(p.name)+'</strong></a><br><small>'+esc(p.detail)+'</small></div><strong>'+p.points+(mode==='Players'&&metric===3?'%':'')+'</strong></div>').join('')||empty('No entries meet the current ranking criteria.'));
  }
  build();
}
function arena(){
  const initial=params(), latest=state.people;
  let mode=initial.get('mode')??(state.me?.avatar&&!initial.has('from')?'player':'guest');
  if(mode!=='player') mode='guest';
  let to=prof(initial.get('to'))?.id??latest[0]?.id, from=prof(initial.get('from'))?.id??latest.find(p=>p.id!==to)?.id;
  page(head('Campus arena','Pick your matchup','Both fighters estimate the same number. The closest guess lands the hit.')+'<div id="setup"></div>');
  const setup=$('#setup');
  function picker(label,id,selected){
    return '<div class="stack"><label class="field">'+label+'<input id="'+id+'-find" placeholder="Find by name or school" autocomplete="off"></label><label class="field"><span class="small">Select professor</span><select id="'+id+'-select">'+pickerOptions(latest,selected)+'</select></label></div>';
  }
  const pickerOptions=(people,selected)=>people.map(p=>'<option value="'+esc(p.id)+'" '+pick(p.id,selected)+'>'+esc(p.name)+(p.demo?' (demo)':'')+'</option>').join('');
  const preview=(p,player=false)=>p?'<div class="card-stage tone-'+esc(p.tone??'violet')+'">'+sprite(p.avatar)+'</div><h3>'+esc(p.name)+'</h3><p class="small">'+(player?'Level '+p.level:schoolName(p.school)+' · '+p.power+' power · '+p.difficulty)+'</p>'+bars(p):empty('No matching fighter.');
  function draw(){
    const playerReady=mode==='player'&&state.me?.avatar;
    setup.innerHTML='<div class="tabs" role="tablist" aria-label="Battle mode"><button type="button" class="btn subtle" id="guest-mode" role="tab" aria-selected="'+(mode==='guest')+'">Professor vs. Professor</button><button type="button" class="btn subtle" id="player-mode" role="tab" aria-selected="'+(mode==='player')+'">Challenge as your fighter</button></div>'+
      (!latest.length?empty('There are no professors in the arena yet.'):'<form id="matchup" class="stack"><div class="grid two fighter-setup"><div class="panel"><h2>Play as</h2><br>'+(mode==='guest'?picker('Your professor','from',from):!playerReady?(state.me?button('Create your fighter','fighter?edit=1','primary'):'<button type="button" id="login-to-play" class="btn primary">Log in to play</button>'):'')+'<div id="from-preview">'+(mode==='guest'?preview(prof(from)):playerReady?preview(state.me,true):'')+'</div></div><div class="panel"><h2>Fight against</h2><br>'+picker('Opponent professor','to',to)+'<div id="to-preview">'+preview(prof(to))+'</div></div></div>'+err+'<div class="actions"><button class="btn primary raised" '+(mode==='player'&&!playerReady?'disabled':'')+'>'+bolt+' '+(mode==='guest'?'Let them fight':'Start challenge')+'</button><small>'+(mode==='guest'?'Guest battles don’t earn XP.':'Base victory reward '+state.settings.winXP+' XP.')+'</small></div></form>');
    $('#guest-mode').onclick=()=>{mode='guest';draw();$('#guest-mode').focus();};
    $('#player-mode').onclick=()=>{mode='player';draw();$('#player-mode').focus();};
    if($('#login-to-play'))$('#login-to-play').onclick=()=>{returnTo='fight?mode=player&to='+qs(to);go('login');};
    if(!$('#matchup'))return;
    for(const key of mode==='guest'?['from','to']:['to']){
      const input=$('#'+key+'-find'), select=$('#'+key+'-select');
      select.onchange=()=>{
        if(key==='from')from=select.value;else to=select.value;
        $('#'+key+'-preview').innerHTML=preview(prof(select.value));
      };
      input.oninput=()=>{
        const search=input.value.toLowerCase().trim(), selected=key==='from'?from:to;
        const matching=latest.filter(p=>[p.name,p.department,school(p.school)?.name,school(p.school)?.short].filter(Boolean).join(' ').toLowerCase().includes(search));
        select.innerHTML=matching.length?pickerOptions(matching,selected):'<option value="">No results</option>';
        select.onchange();
      };
    }
    setup.insertAdjacentHTML('beforeend','<details class="panel battle-question"><summary>How battle stats work</summary><p class="small battle-question">The closer guess lands the hit. Exact ties deal zero damage. Higher Intelligence narrows the bot’s estimate range. Durability adds starting HP and, along with Agility, reduces incoming damage. Strength boosts hits. Rizz adds a small bonus in round three, and Aura does the same in round five. If both fighters are still standing after round seven, the higher percentage of HP remaining wins.</p></details>');
    bindForm($('#matchup'),async()=>{
      const battle=await api('battle/start',{mode,from,to});go('battle?id='+qs(battle.id));
    });
  }
  draw();
}
function combatant(f,hp,max,animation){
  return '<div class="fighter-battle '+animation+'"><strong>'+esc(f.name)+(f.demo?' (demo)':'')+'</strong><div class="health"><i style="width:'+(100*hp/max)+'%"></i></div><small>'+hp+' / '+max+' HP · '+(f.level?'Lv. '+f.level:f.power+' power')+'</small>'+sprite(f.avatar)+'</div>';
}
function battlePage(b,version,animate=false){
  if(version!==routeCounter)return;
  clearInterval(timer);
  const last=b.log.at(-1), ended=b.status==='finished', reveal=b.status==='reveal'||ended;
  const attack=who=>!animate||last?.winner==='tie'?'':last?.winner===who?'lunge':'flash';
  const stage='<div class="battle-stage">'+combatant(b.player,b.playerHP,b.maxPlayer,attack('player'))+'<span class="pixel">VS</span>'+combatant(b.enemy,b.enemyHP,b.maxEnemy,attack('enemy'))+(animate&&last?.damage?'<span aria-hidden="true" class="damage '+(last.winner==='player'?'right':'left')+'">−'+last.damage+'</span>':'')+'</div>';
  const score=b.log.reduce((n,r)=>n+r.score,0);
  const roundLabel='Round '+(b.round+1)+' of '+b.total;
  const result=ended?'<div class="panel battle-question stack"><h2>'+(b.winner==='player'?'Victory!':b.winner==='enemy'?'Defeat!':'Draw!')+'</h2><p>'+(b.winner==='tie'?'Both fighters finished with the same share of HP.':esc(b[b.winner].name)+' takes the match.')+'</p><div class="actions"><span class="pill">'+score+' trivia points</span><span class="pill">'+b.log.filter(r=>r.playerError===0).length+' exact estimates</span><span class="pill">'+b.log.filter(r=>r.winner==='player').reduce((sum,r)=>sum+r.damage,0)+' damage dealt</span><span class="pill">'+b.log.filter(r=>r.winner==='enemy').length+' bot rounds won</span>'+(b.reward?'<span class="pill">+'+b.reward.xp+' XP</span>':'')+'</div>'+
    (b.reward?.leveled?'<div class="notice"><strong>LEVEL UP!</strong> You reached level '+b.reward.level+' and earned new stat points.</div>':'')+
    (b.reward?.achievements.length?'<div class="notice">Unlocked '+esc(b.reward.achievements.join(', '))+'</div>':'')+
    '<div class="actions">'+button('Rematch','fight?from='+qs(b.player.id)+'&to='+qs(b.enemy.id)+'&mode='+(b.progression?'player':'guest'),'primary')+button('Challenge another','fight','subtle')+'<button class="btn subtle" id="share">Share result</button>'+button('View rankings','rankings','subtle')+'</div><div id="share-field"></div>'+
    (b.progression?(state.me?button('Customize your fighter','fighter?edit=1','subtle'):''):'<small>Create an account to build your own fighter and start leveling up. <a class="text-link" href="#signup">Sign up</a></small>')+'</div>':'';
  const answerPanel=reveal&&last?'<div class="panel battle-question"><div class="battle-meta"><span class="eyebrow">'+roundLabel+'</span><span class="pill">'+(last.winner==='player'?'You land the hit':last.winner==='enemy'?'The professor lands the hit':'Tie · no damage')+'</span></div><h2>'+esc(last.prompt)+'</h2><div class="grid guess-grid"><div><small>Your estimate</small><strong>'+fmt(last.estimate)+'</strong></div><div><small>Bot estimate</small><strong>'+fmt(last.bot)+'</strong></div><div><small>Answer</small><strong>'+fmt(last.answer)+'</strong></div></div><p class="small">'+last.damage+' damage · '+last.score+' trivia points'+(last.source?' · <a class="text-link" href="'+esc(last.source)+'" target="_blank" rel="noopener">Answer source</a>':'')+'</p><div class="actions">'+(!ended?'<button class="btn primary raised" id="next">Next round</button>':'')+'<button class="btn subtle" id="question-report">Report question</button></div></div>':'';
  const question=!reveal?'<div class="panel battle-question"><div class="battle-meta"><span class="eyebrow">'+roundLabel+' · '+esc(b.question.category)+'</span><span class="clock" id="clock">—</span></div><h2>'+esc(b.question.prompt)+'</h2><form id="guess" class="stack"><div class="actions">'+field('Your estimate ('+esc(b.question.unit)+')','estimate','required inputmode="decimal" autocomplete="off" placeholder="Enter a number"')+'<button class="btn primary raised">Lock in guess</button></div>'+err+'</form></div>':'';
  page('<div class="battle">'+(ended?head('Battle result',esc(b.player.name)+' vs. '+esc(b.enemy.name)):head('Campus arena','Closest Wins'))+stage+result+answerPanel+question+'<p class="small battle-question">Trivia score '+score+' · '+b.log.length+' completed '+(b.log.length===1?'round':'rounds')+'</p>'+(b.log.length>1?'<details class="panel"><summary>Round history</summary>'+b.log.map((r,i)=>'<div class="review"><strong>Round '+(i+1)+'</strong><p>'+esc(r.prompt)+'</p><small>You '+fmt(r.estimate)+' · Bot '+fmt(r.bot)+' · Answer '+fmt(r.answer)+' · '+r.damage+' damage</small></div>').join('')+'</details>':'')+'</div>');
  const next=async(action,estimate)=>{
    const updated=await api('battle',{id:b.id,round:b.round,action,estimate});
    if(updated.status==='finished'&&updated.reward)refresh().catch(()=>{});
    battlePage(updated,version,action==='guess');
  };
  if($('#next'))$('#next').onclick=async event=>{event.currentTarget.disabled=true;try{await next('next');}catch(e){showToast(e.message);if($('#next'))$('#next').disabled=false;}};
  if($('#question-report'))$('#question-report').onclick=()=>report('question',b.id+':'+b.round,'Report this question');
  if($('#share'))$('#share').onclick=async()=>{
    const url=location.href;
    if(navigator.clipboard){try{await navigator.clipboard.writeText(url);showToast('Result link copied.');return;}catch{}}
    $('#share-field').innerHTML=field('Result link','share','readonly value="'+esc(url)+'"');$('[name=share]').select();
  };
  if($('#guess')){
    const form=$('#guess'), clock=$('#clock'), end=performance.now()+b.remaining;
    let busy=false;
    const tick=async()=>{
      const left=Math.max(0,Math.ceil((end-performance.now())/1000));clock.textContent=left+'s';
      if(left||busy||version!==routeCounter)return;
      busy=true;
      try{await next('guess',null);}catch(e){if(version===routeCounter){$('.error',form).textContent=e.message;}busy=false;}
    };
    timer=setInterval(tick,250);tick();
    bindForm(form,async data=>{
      if(busy||version!==routeCounter)return;
      const raw=String(data.get('estimate')).trim();
      if(!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?\s*%?$/.test(raw))throw new Error('Enter a positive number or zero.');
      busy=true;
      try{await next('guess',Number(raw.replace(/[,\s%]/g,'')));}finally{busy=false;}
    });
  }
}
const settingsLabels={prior:'Faculty prior (0–100)',priorWeight:'Prior rating weight',minRatings:'Ratings required for official rank',minProfessors:'Ranked professors required per school',winXP:'Victory XP',lossXP:'Loss or draw XP',firstXP:'First victory bonus XP',levelXP:'XP per level',hp:'Base HP',damage:'Base damage',botSpread:'Bot estimate spread'};
async function admin(version){
  if(!state.me?.admin)throw new Error('Admin access required.');
  const data=await api('admin');if(version!==routeCounter)return;
  let tab=params().get('tab')??'Overview';
  const kinds={'University Requests':['school'],'Professor Requests':['professor'],'Avatar Edits':['avatar'],'Reports':['report','correction','question']};
  const tabs=['Overview',...Object.keys(kinds),'Questions','Game Balance','Users'];
  const requests=data.requests.filter(r=>kinds[tab]?.includes(r.kind));
  const actionForm=r=>'<form data-request="'+esc(r.id)+'" class="stack"><div class="actions">'+(r.url?'<label><input name="verified" type="checkbox"> Official source verified</label>':'')+(r.kind==='correction'?'<label><input name="remove" type="checkbox"> Remove profile</label>':'')+'</div>'+field('Decision note (optional)','note','maxlength="600"')+'<div class="actions"><button class="btn primary" name="action" value="approve">Approve</button><button class="btn subtle" name="action" value="hold">Hold</button><button class="btn subtle danger" name="action" value="reject">Reject</button></div>'+err+'</form>';
  const requestRows=()=>requests.map(r=>'<article class="admin-row stack"><div class="split"><strong>'+esc(r.name??prof(r.target)?.name??r.target??r.kind)+'</strong><span class="pill">'+esc(r.status)+'</span></div><small>'+[r.department,school(r.school)?.name,r.location,r.reply,date(r.date)].filter(Boolean).map(esc).join(' · ')+'</small>'+(r.url?'<a class="text-link" href="'+esc(r.url)+'" target="_blank" rel="noopener">Review submitted source</a>':'')+(r.avatar?'<div class="grid two"><div><small>Current</small><div class="preview">'+(prof(r.target)?sprite(prof(r.target).avatar):'Unavailable')+'</div></div><div><small>Proposed</small><div class="preview">'+sprite(r.avatar)+'</div></div></div>':'')+(r.note?'<p>'+esc(r.note)+'</p>':'')+(['pending','hold'].includes(r.status)?actionForm(r):r.decisionNote?'<small>'+esc(r.decisionNote)+'</small>':'')+'</article>').join('')||empty('No requests in this queue.');
  let content;
  if(tab in kinds)content='<div class="panel">'+requestRows()+'</div>';
  else if(tab==='Questions')content='<div class="panel stack"><div class="actions"><button class="btn primary" id="add-question">Add question</button><button class="btn subtle" id="import-questions">Import JSON pack</button></div>'+data.questions.map(q=>'<div class="admin-row split"><div><strong>'+esc(q.prompt)+'</strong><br><small>'+esc(q.category)+' · '+fmt(q.answer)+' '+esc(q.unit)+' · '+(q.active?'Active':'Disabled')+'</small></div><button class="btn subtle" data-question="'+esc(q.id)+'">Edit</button></div>').join('')+'</div>';
  else if(tab==='Game Balance')content='<form id="settings" class="panel stack">'+Object.entries(data.config).map(([key,n])=>field(settingsLabels[key],key,'required type="number" step="'+(key==='botSpread'?'0.1':'1')+'" value="'+n+'"')).join('')+err+'<div><button class="btn primary">Save settings</button></div></form>';
  else if(tab==='Users')content='<div class="panel">'+data.users.map(u=>'<div class="admin-row"><strong>'+esc(u.name)+'</strong> · '+esc(u.email)+' · '+u.xp+' XP'+(u.admin?' · Admin':'')+'</div>').join('')+'</div>';
  else content='<div class="grid two"><div class="panel stack"><h2>Review queues</h2>'+Object.entries(kinds).map(([label,types])=>'<a class="text-link" href="#admin?tab='+qs(label)+'">'+label+' ('+data.requests.filter(r=>types.includes(r.kind)&&['pending','hold'].includes(r.status)).length+')</a>').join('')+'</div><div class="panel stack"><h2>Audit log</h2>'+(data.audit.map(row=>'<small>'+date(row.date)+' · '+esc(row.admin)+' · '+esc(row.action)+'</small>').join('')||'<small>No actions recorded.</small>')+'</div></div>';
  page(head('Moderation','Admin dashboard')+'<div class="tabs">'+tabs.map(t=>button(t,'admin?tab='+qs(t),tab===t?'primary':'subtle')).join('')+'</div>'+content);
  all('[data-request]').forEach(form=>{
    bindForm(form,async (fields,button)=>{
      await api('admin',{id:form.dataset.request,action:button?.value,verified:fields.has('verified'),remove:fields.has('remove'),note:fields.get('note')});
      await refresh();route(false);showToast('Review decision saved.');
    });
  });
  if($('#settings'))bindForm($('#settings'),async fields=>{
    await api('admin',{action:'settings',settings:Object.fromEntries([...fields].map(([key,n])=>[key,Number(n)]))});
    await refresh();route(false);showToast('Balancing settings saved.');
  });
  if($('#add-question'))$('#add-question').onclick=()=>editQuestion();
  all('[data-question]').forEach(el=>el.onclick=()=>editQuestion(data.questions.find(q=>q.id===el.dataset.question)));
  if($('#import-questions'))$('#import-questions').onclick=()=>{
    const dialog=modal('Import question pack','<p class="small">Paste a JSON array. Each question needs prompt, category, unit, answer, scale, time, and active. Source is optional.</p><form class="stack">'+textarea('Question pack','pack','required')+err+'<button class="btn primary">Import questions</button></form>');
    bindForm($('form',dialog),async fields=>{
      let questions;
      try{questions=JSON.parse(fields.get('pack'));}catch{throw new Error('Enter a valid JSON array.');}
      await api('admin',{action:'import',questions});dialog.close();route(false);showToast('Question pack imported.');
    });
  };
}
function editQuestion(q={time:25,active:true}){
  const dialog=modal(q.id?'Edit question':'Add question','<form class="stack">'+field('Prompt','prompt','required maxlength="240" value="'+esc(q.prompt)+'"')+field('Category','category','required maxlength="32" value="'+esc(q.category)+'"')+field('Unit','unit','required maxlength="32" value="'+esc(q.unit)+'"')+field('Answer','answer','required type="number" min="0" step="any" value="'+esc(q.answer)+'"')+field('Typical error scale','scale','required type="number" min="0.01" step="any" value="'+esc(q.scale)+'"')+field('Time limit in seconds','time','required type="number" min="10" max="120" value="'+q.time+'"')+field('Source URL (optional)','source','type="url" value="'+esc(q.source)+'"')+'<label><input type="checkbox" name="active" '+(q.active?'checked':'')+'> Active in battle rotation</label>'+err+'<button class="btn primary">Save question</button></form>');
  bindForm($('form',dialog),async fields=>{
    const body=Object.fromEntries(fields);for(const key of ['answer','scale','time'])body[key]=Number(body[key]);
    await api('admin',{...body,id:q.id,action:'question',active:fields.has('active')});dialog.close();route(false);showToast('Question saved.');
  });
}
function guidelines(){
  page(head('Campus arcade','Community Guidelines')+'<div class="guidelines panel"><h2>Keep the fight fictional</h2><p>Combat ratings describe imaginary trivia fighters. Keep comments playful and focused on the game.</p><h2>Respect people’s privacy and safety</h2><p>Threats, harassment, discriminatory comments, private personal information, and unverified accusations are prohibited.</p><h2>Report a problem</h2><p>Use Report on a review or Request correction or removal on a professor profile to send a private note to a moderator.</p><h2>Check the source</h2><p>New faculty listings require an official university directory source. Avatar suggestions are reviewed before they appear.</p><h2>About the arcade</h2><p>Fight My Professor is an independent parody and is unaffiliated with universities and rating sites.</p></div>');
}
async function route(scroll=true){
  const version=++routeCounter;
  clearInterval(timer);activeDialog?.close();
  if(scroll){window.scrollTo(0,0);app.focus({preventScroll:true});}
  try{
    nav();
    const section=current(),p=params(), id=p.get('id')??'';
    if(section==='home')home();
    else if(section==='search')search();
    else if(section==='schools')schools();
    else if(section==='school')schoolPage();
    else if(section==='professor')await professor(id,version);
    else if(section==='fight')arena();
    else if(section==='rankings')await ranks(version);
    else if(section==='login'||section==='signup')auth(section==='signup');
    else if(section==='fighter')fighter();
    else if(section==='recover')recovery();
    else if(section==='request')requestPage();
    else if(section==='admin')await admin(version);
    else if(section==='guidelines')guidelines();
    else if(section==='battle'){const b=await api('battle?id='+qs(id));battlePage(b,version);}
    else if(section==='player'){
      const u=(await api('players')).find(p=>p.id===id);if(version!==routeCounter)return;
      if(!u)throw new Error('Fighter not found.');
      playerProfile(u);
    }else throw new Error('Page not found.');
  }catch(e){if(version===routeCounter)page(head('Campus arcade','Something went wrong',esc(e.message))+button('Back to homepage','home','primary'));}
}
window.addEventListener('hashchange',()=>route());
refresh().then(()=>route()).catch(error=>page(head('Campus arcade','Couldn’t load the site',esc(error.message))));
