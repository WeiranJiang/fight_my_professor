import { schoolMarkSources } from './school-marks.js';
import { stats,tags,options,colors,avatar,defaultAvatar,eyeColorNames,eyeTraits,seededAvatar } from './shared.js';
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
const current=()=>location.pathname==='/fighter/edit'?'fighter':location.pathname.slice(1)||'home';
const params=()=>{
  const query=new URLSearchParams(location.search);
  if(location.pathname==='/fighter/edit')query.set('edit','1');
  return query;
};
const prof=id=>state.people.find(p=>p.id===id);
let schoolsById=new Map();
const school=id=>schoolsById.get(id);
const pageURL=path=>path==='home'?'/':path==='fighter?edit=1'?'/fighter/edit':'/'+path;
const currentPage=()=>current()+(params().size?'?'+params().toString():'');
function migrateBookmark(){
  const hash=location.hash.slice(1);
  if(/^[-a-z]+(?:\?.*)?$/.test(hash))history.replaceState(null,'',pageURL(hash));
}
const go=path=>{
  const url=pageURL(path);
  if(location.pathname+location.search!==url)history.pushState(null,'',url);
  route();
};
const button=(label,href,classes='')=>'<a class="btn '+classes+'" href="'+esc(pageURL(href))+'">'+label+'</a>';
const head=(label,title,description='')=>'<div class="page-title">'+(label?'<span class="eyebrow">'+label+'</span>':'')+'<h1>'+title+'</h1>'+(description?'<p class="muted">'+description+'</p>':'')+'</div>';
const sectionHead=(label,title,action='',subtitle='')=>'<div class="section-head"><div><span class="eyebrow">'+label+'</span><h2>'+title+'</h2>'+(subtitle?'<p class="muted">'+subtitle+'</p>':'')+'</div>'+action+'</div>';
const score=(n,label='POWER')=>'<div class="score">'+n+'<span>'+label+'</span></div>';
const schoolName=id=>esc(school(id)?.name??'Independent');
const linkProf=id=>'professor?id='+qs(id);
const linkSchool=id=>'school?id='+qs(id);
const noAuth=()=>{returnTo=currentPage();go('login');};
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
let allSchoolsLoaded=false;
let loadingSchools=null;
function indexSchools(schools){
  state.schools=schools;
  schoolsById=new Map(schools.map(s=>[s.id,s]));
  for(const s of schools)s.searchText=normalizeSearch([s.name,s.short,s.location,...(s.aliases??[])].join(' '));
}
function loadSchoolDirectory(){
  if(allSchoolsLoaded)return Promise.resolve();
  if(!loadingSchools){
    loadingSchools=api('schools').then(schools=>{
      indexSchools(schools);
      allSchoolsLoaded=true;
    }).finally(()=>{loadingSchools=null;});
  }
  return loadingSchools;
}
async function refresh(){
  const latest=await api('init');
  const previous=schoolsById;
  state=latest;
  if(allSchoolsLoaded){
    const merged=new Map([...previous].map(([id,s])=>[id,{...s,count:0,eligible:false,power:null}]));
    for(const s of latest.schools)merged.set(s.id,s);
    indexSchools([...merged.values()]);
  }else indexSchools(latest.schools);
  nav();
}
function nav(){
  account.innerHTML=state.me?'<div class="account-actions">'+(state.me.admin?'<a href="/admin">Admin</a>':'')+button('My Fighter','fighter','primary')+'</div>':'<div class="account-actions"><a href="/login">Log in</a>'+button('Sign up','signup','primary')+'</div>';
  all('.nav nav a').forEach(node=>{
    const section=current();
    if(node.pathname==='/'+section||(section==='professor'&&node.pathname==='/search')||(section==='battle'&&node.pathname==='/fight')||(section==='school'&&node.pathname==='/schools'))node.setAttribute('aria-current','page'); else node.removeAttribute('aria-current');
  });
}
function page(content,classes=''){app.innerHTML='<div class="wrap page '+classes+'">'+content+'</div>';}
const bars=p=>'<div class="bars">'+stats.map((label,i)=>'<div class="bar-row"><span>'+label+'</span><div class="meter" aria-hidden="true"><i style="width:'+p.values[i]+'%"></i></div><strong>'+p.values[i]+'</strong></div>').join('')+'</div>';
function schoolMark(s){
  if(!Object.hasOwn(schoolMarkSources,s.id))return '<span class="school-icon" aria-hidden="true">▦</span>';
  return '<span class="school-icon school-mark"><img src="/school-marks/'+s.id+'.png" alt="" width="48" height="48" loading="lazy"></span>';
}
const schoolCard=s=>'<a class="school-card" href="/'+linkSchool(s.id)+'">'+schoolMark(s)+'<h3>'+esc(s.name)+'</h3><small>'+esc(s.location)+' · '+(s.count?s.count+' '+(s.count===1?'faculty profile':'faculty profiles'):'Faculty roster pending')+'</small></a>';
function home(){
  const top=state.people.filter(p=>p.eligible).slice(0,4);
  app.innerHTML='<section class="hero"><div class="wrap hero-inner"><div><span class="eyebrow">'+bolt+' Rate. Rank. Fight.</span><h1>Think you can<br>beat your <span>professor?</span></h1><p class="lede">A professor awaits every day. Play trivia as a guest or build your own pixel fighter.</p><form id="hero-search" class="searchbox" role="search">'+searchIcon+'<input name="q" aria-label="Search for a professor or university" placeholder="Search for a professor or university" autocomplete="off"><button class="btn primary">Find a professor</button><div class="suggestions"></div></form><div class="hero-actions">'+button(bolt+' Play today’s challenge','fight','dark')+'<small>No account needed.</small></div></div><aside class="arcade" id="daily-preview"><div class="arcade-top pixel">Daily professor challenge</div></aside></div></section>'+
    '<section class="section wrap">'+sectionHead('','Strongest professors',button('View rankings','rankings','subtle'))+'<div class="panel mini-list">'+(top.length?top.map(p=>'<a href="/'+linkProf(p.id)+'"><span>#'+p.rank+'</span><strong>'+esc(p.name)+'</strong>'+score(p.power)+'</a>').join(''):empty('Professors appear here after '+state.settings.minRatings+' community ratings.'))+'</div></section>';
  const preview=$('#daily-preview');
  api('challenge').then(({professor:p})=>{
    if(!preview.isConnected)return;
    preview.innerHTML='<div class="arcade-top pixel">Daily professor challenge</div><div class="showdown"><div class="hero-meter left">YOU<span><i></i></span></div><div class="hero-meter right">'+esc(p.name)+'<span><i></i></span></div>'+sprite(state.me?.avatar??defaultAvatar,'left-sprite')+sprite(p.avatar,'right-sprite')+'<div class="arcade-vs">VS</div></div><div class="arcade-bottom pixel"><span>'+schoolName(p.school)+'</span><a href="/fight">Play today</a></div>';
  }).catch(()=>{if(preview.isConnected)preview.innerHTML='<div class="arcade-top">'+button('Open the arena','fight','primary')+'</div>';});
  const form=$('#hero-search'), input=form.elements.q, suggestions=$('.suggestions',form);
  form.onsubmit=e=>{e.preventDefault();go('search?q='+qs(input.value.trim()));};
  const suggest=()=>{
    const query=input.value.toLowerCase().trim();
    const entries=[...state.schools.filter(s=>matchesSchool(s,normalizeSearch(query))).map(s=>[s.name,'University',linkSchool(s.id)]),...state.people.filter(p=>normalizeSearch(p.name).includes(normalizeSearch(query))).map(p=>[p.name,p.demo?'Demo professor':p.department,linkProf(p.id)])];
    suggestions.innerHTML=query?entries.slice(0,6).map(([name,type,link])=>'<a href="/'+link+'"><strong>'+esc(name)+'</strong><small>'+esc(type)+'</small></a>').join(''):'';
  };
  input.oninput=()=>{
    suggest();
    if(!allSchoolsLoaded&&input.value.trim()){
      loadSchoolDirectory().then(()=>{if(document.activeElement===input)suggest();}).catch(()=>{});
    }
  };
  form.addEventListener('focusout',event=>{if(!form.contains(event.relatedTarget))suggestions.replaceChildren();});
  input.addEventListener('focus',()=>input.oninput());
  input.addEventListener('keydown',event=>{if(event.key==='Escape')suggestions.replaceChildren();if(event.key==='ArrowDown'&&$('a',suggestions)){event.preventDefault();$('a',suggestions).focus();}});
}
const directoryOrder=new Intl.Collator('en',{sensitivity:'base'});
const normalizeSearch=value=>value.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().trim();
const matchesSchool=(s,query)=>query.split(/\s+/).every(term=>s.searchText.includes(term));
function schoolOptions(selected='', allLabel='All schools', query=''){
  const matches=state.schools.filter(s=>matchesSchool(s,query));
  if(!query)matches.sort((a,b)=>Number(b.count>0)-Number(a.count>0)||directoryOrder.compare(a.name,b.name));
  const choices=matches.slice(0,35);
  const active=school(selected);
  if(active&&matches.includes(active)&&!choices.includes(active))choices.unshift(active);
  return '<option value="">'+(choices.length?allLabel:'No matching schools')+'</option>'+
    choices.map(s=>'<option value="'+esc(s.id)+'" '+pick(s.id,selected)+'>'+esc(s.name+' · '+s.location)+'</option>').join('');
}
function schoolPicker(id,label,selected='',allLabel='All schools',required=false){
  return '<div class="school-picker"><label class="field">'+label+'<input id="'+id+'-find" type="search" placeholder="Type a school or city" autocomplete="off"></label><label class="field"><span class="visually-hidden">Select '+label.toLowerCase()+'</span><select id="'+id+'" name="school" '+(required?'required':'')+'>'+schoolOptions(selected,allLabel)+'</select></label></div>';
}
function bindSchoolPicker(id,allLabel='All schools'){
  const input=$('#'+id+'-find'), select=$('#'+id);
  input.oninput=()=>{
    const selected=select.value;
    select.innerHTML=schoolOptions(selected,allLabel,normalizeSearch(input.value));
    if(selected!==select.value)select.dispatchEvent(new Event('change'));
  };
}
const matchesProfessor=(p,query)=>normalizeSearch([p.name,p.department,p.academicTitle,school(p.school)?.name,school(p.school)?.short,...(p.research??[])].filter(Boolean).join(' ')).includes(query);
function directoryRow(p){
  const label=p.demo?'Demo fighter':p.count?p.power+' game power':'Unrated';
  const details=[p.department,school(p.school)?.short].filter(Boolean).join(' · ');
  return '<a class="directory-row" href="/'+linkProf(p.id)+'"><span class="directory-avatar tone-'+esc(p.tone)+'">'+sprite(p.avatar)+'</span><span class="directory-person"><strong>'+esc(p.name)+'</strong><small>'+esc(details)+'</small>'+(p.research?.length?'<small class="directory-topics">'+esc(p.research.slice(0,3).join(' · '))+'</small>':'')+'</span><span class="directory-rating">'+esc(label)+'</span></a>';
}
function search(){
  const query=params().get('q')??'', campus=params().get('school')??'';
  page(head('','Faculty Directory','Search by professor, university, department, or research topic.')+
    '<div class="filters directory-filters"><input id="query" type="search" aria-label="Search faculty directory" placeholder="Name, school, or research topic" value="'+esc(query)+'">'+schoolPicker('school-filter','School',campus)+'</div><div id="search-results"></div><p class="directory-footer">'+button('Request a professor','request?kind=professor'+(campus?'&school='+qs(campus):''),'subtle')+'</p>');
  bindSchoolPicker('school-filter');
  const input=$('#query'),select=$('#school-filter'),results=$('#search-results');
  const pageSize=24;
  let shown=pageSize;
  const render=(focusNew=false)=>{
    const query=normalizeSearch(input.value), campus=select.value;
    const people=state.people.filter(p=>(!p.demo||Boolean(query))&&(!campus||p.school===campus)&&matchesProfessor(p,query))
      .sort((a,b)=>Number(a.demo)-Number(b.demo)||directoryOrder.compare(a.name,b.name));
    const matchingSchools=query&&!campus?state.schools.filter(s=>matchesSchool(s,query)).slice(0,6):[];
    results.innerHTML=(matchingSchools.length?'<div class="directory-schools">'+matchingSchools.map(s=>button(esc(s.name),linkSchool(s.id),'subtle')).join('')+'</div>':'')+
      '<p class="directory-count small">'+people.length.toLocaleString()+' '+(people.length===1?'profile':'profiles')+'</p>'+
      (people.length?'<div class="directory-list">'+people.slice(0,shown).map(directoryRow).join('')+'</div>':empty('No professors match this search.'))+
      (people.length>shown?'<div class="directory-footer"><button class="btn subtle" id="more-faculty">Show more professors</button></div>':'');
    if(focusNew) all('.directory-row',results)[shown-pageSize]?.focus();
    if($('#more-faculty'))$('#more-faculty').onclick=()=>{shown+=pageSize;render(true);};
  };
  input.oninput=select.onchange=()=>{shown=pageSize;render();};
  render();
}
function schools(){
  const states=[...new Set(state.schools.map(s=>s.state).filter(Boolean))].sort();
  page(head('','U.S. Schools','Find colleges, universities, and technical schools in the federal postsecondary directory.')+
    '<div class="filters"><input id="school-query" type="search" aria-label="Search schools" placeholder="School name, city, or abbreviation" value="'+esc(params().get('q')??'')+'"><select id="school-state" aria-label="Filter by state or territory"><option value="">All states and territories</option>'+states.map(code=>'<option>'+esc(code)+'</option>').join('')+'</select><select id="faculty-filter" aria-label="Filter by faculty coverage"><option value="">All schools</option><option value="listed">With faculty profiles</option></select></div><p id="school-count" class="small"></p><div id="schools" class="grid three school-grid"></div><div class="directory-footer actions"><button class="btn subtle" id="more-schools" hidden>Show more schools</button>'+button('Request a school','request?kind=school','subtle')+'</div>');
  const input=$('#school-query'), region=$('#school-state'), faculty=$('#faculty-filter'), more=$('#more-schools');
  const pageSize=24;
  let shown=pageSize;
  const ordered=[...state.schools].sort((a,b)=>Number(b.count>0)-Number(a.count>0)||directoryOrder.compare(a.name,b.name));
  const render=()=>{
    const query=normalizeSearch(input.value);
    const results=ordered.filter(s=>(!region.value||region.value===s.state)&&(!faculty.value||s.count>0)&&matchesSchool(s,query));
    $('#school-count').textContent=results.length.toLocaleString()+' '+(results.length===1?'school':'schools');
    $('#schools').innerHTML=results.slice(0,shown).map(schoolCard).join('')||empty('No schools match these filters.');
    more.hidden=results.length<=shown;
  };
  input.oninput=region.onchange=faculty.onchange=()=>{shown=pageSize;render();};
  more.onclick=()=>{shown+=pageSize;render();all('.school-card',$('#schools'))[shown-pageSize]?.focus();};
  render();
}
function schoolPage(){
  const s=school(params().get('id'));if(!s)throw new Error('School not found.');
  const people=state.people.filter(p=>p.school===s.id&&!p.demo).sort((a,b)=>directoryOrder.compare(a.name,b.name));
  page('<div class="school-page-heading">'+schoolMark(s)+head('',esc(s.name),esc(s.location))+'</div>'+'<div class="actions">'+(people.length?button('Browse all '+people.length+' faculty profiles','search?school='+qs(s.id),'primary'):'')+'<a class="btn subtle" href="'+esc(s.url)+'" target="_blank" rel="noopener">University website</a>'+button('Campus rankings','rankings?school='+qs(s.id),'subtle')+'</div><div class="section"><h2>Faculty</h2><br>'+(people.length?'<div class="directory-list">'+people.slice(0,12).map(directoryRow).join('')+'</div>':empty('No verified faculty profiles yet. '+button('Suggest a professor','request?kind=professor&school='+qs(s.id),'subtle')))+'</div>');
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
    '<form class="panel stack" id="auth">'+(signup?field('Display name','name','required minlength="2" maxlength="28" autocomplete="nickname"'):'')+field('Email','email','required type="email" autocomplete="email"')+field('Password','password','required type="password" minlength="8" maxlength="128" autocomplete="'+(signup?'new-password':'current-password')+'"')+(params().has('admin')?field('Admin invite code','adminCode','type="password" autocomplete="off"'):'')+err+'<button class="btn primary raised">'+(signup?'Create account':'Log in')+'</button><small>'+(signup?'Already have an account? <a class="text-link" href="/login">Log in</a>':'New here? <a class="text-link" href="/signup">Create an account</a>')+'</small></form></div>');
  if(!signup)$('#auth').insertAdjacentHTML('beforeend','<div class="actions"><a class="text-link small" href="/recover">Use a recovery key</a><a class="text-link small" href="/login?admin=1">Moderator login</a>'+(params().has('admin')?'<a class="text-link small" href="/signup?admin=1">Set up a moderator account</a>':'')+'</div>');
  bindForm($('#auth'),async data=>{
    const result=await api('auth',{...Object.fromEntries(data),mode:signup?'signup':'login'});
    await refresh();
    const proceed=()=>{
      if(state.me?.admin){returnTo='';go('admin');}
      else if(result.newFighter)go('fighter?edit=1');
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
  const {p,reviews,fought,canRematch}=await api('professor?id='+qs(id));
  if(version!==routeCounter)return;
  const mine=reviews.find(r=>r.mine);
  page('<div class="profile-head">'+score(p.demo||p.count?p.power:'—',p.demo||p.count?'GAME POWER':'UNRATED')+'<div><span class="eyebrow">'+(p.demo?'Fictional demo professor':'Professor profile')+'</span><h1>'+esc(p.name)+'</h1><p class="muted">'+esc(p.department)+' · <a class="text-link" href="/'+linkSchool(p.school)+'">'+schoolName(p.school)+'</a></p>'+(p.academicTitle?'<p class="faculty-title">'+esc(p.academicTitle)+'</p>':'')+'<span class="pill">'+p.difficulty+'</span> <small>'+p.count+' ratings'+(p.rank?' · #'+p.schoolRank+' at '+esc(school(p.school)?.short)+' · #'+p.rank+' globally':'')+'</small></div><div class="card-stage tone-'+esc(p.tone)+'">'+sprite(p.avatar)+'</div></div>'+
    '<div class="actions">'+(canRematch?button(bolt+' Play bonus match','fight?rematch='+qs(p.id),'primary raised'):'')+'<button class="btn '+(canRematch?'':'primary raised')+'" id="rate">'+(mine?'Edit your rating':'Rate professor')+'</button><button class="btn subtle" id="compare">Compare</button><button class="btn subtle" id="favorite">'+(state.me?.favorites.includes(p.id)?'★ Saved':'☆ Save')+'</button></div>'+
    '<div class="section grid two"><div class="panel stack"><h2>Game stats</h2>'+bars(p)+'<small>'+(p.demo?'Demo battle stats.':p.count?'Community game ratings use a baseline and require '+state.settings.minRatings+' reviews for official ranks.':'This fighter uses neutral starting stats until the community adds ratings.')+'</small></div><div class="panel stack"><h2>'+(p.demo?'Training fighter':'Academic profile')+'</h2>'+(p.demo?'<p>'+esc(p.title)+' · '+fought+' completed '+(fought===1?'battle':'battles')+'</p>':(p.research?.length?'<div><h3>Research areas</h3><ul class="research-list">'+p.research.map(topic=>'<li>'+esc(topic)+'</li>').join('')+'</ul></div>':'<p>'+esc(p.department)+'</p>'))+(p.source?'<a class="text-link small" href="'+esc(p.source)+'" target="_blank" rel="noopener">Official faculty source</a>':'')+'<details><summary>Profile feedback</summary><div class="actions directory-footer"><button class="btn subtle" id="avatar-edit">Suggest avatar edit</button><button class="btn subtle" id="correction">Request correction or removal</button></div></details></div></div>'+
    '<div class="panel"><h2>Student reviews</h2>'+(reviews.map(r=>'<article class="review"><div class="split"><strong>'+((r.values.reduce((x,y)=>x+y,0)/6).toFixed(1))+' / 5</strong><small>'+date(r.date)+(r.course?' · '+esc(r.course):'')+'</small></div><small>'+stats.map((s,i)=>s+' '+r.values[i]).join(' · ')+'</small><p>'+esc(r.comment)+'</p><div class="actions">'+r.tags.map(t=>'<span class="pill">'+esc(t)+'</span>').join('')+'</div><div class="actions">'+(r.mine?'<button class="btn subtle danger" id="remove-review">Delete your rating</button>':'<button class="btn subtle" data-help="'+esc(r.id)+'" aria-pressed="'+r.voted+'">Helpful ('+r.helpful+')</button><button class="btn subtle" data-report="'+esc(r.id)+'">Report</button>')+'</div></article>').join('')||empty('No student ratings yet.'))+'</div>');
  $('#rate').onclick=()=>state.me?rating(p,mine):noAuth();
  $('#favorite').onclick=async()=>{if(!state.me){noAuth();return;}try{await api('favorite',{id:p.id});await refresh();route(false);}catch(e){showToast(e.message);}};
  $('#avatar-edit').onclick=()=>state.me?avatarEditor(p):noAuth();
  $('#correction').onclick=()=>report('correction',p.id,'Request a correction or removal');
  $('#compare').onclick=()=>compare(p);
  all('[data-help]').forEach(el=>el.onclick=async()=>{if(!state.me){noAuth();return;}el.disabled=true;try{await api('helpful',{id:el.dataset.help});route(false);}catch(e){showToast(e.message);el.disabled=false;}});
  all('[data-report]').forEach(el=>el.onclick=()=>report('report',el.dataset.report,'Report this review'));
  if($('#remove-review'))$('#remove-review').onclick=()=>{
    const dialog=modal('Delete your rating?','<p>This removes your rating and written review.</p><button class="btn danger" id="confirm-delete">Delete rating</button>');
    $('#confirm-delete',dialog).onclick=async()=>{try{await api('rating',{id:p.id},'DELETE');dialog.close();await refresh();route(false);showToast('Rating deleted.');}catch(e){showToast(e.message);}};
  };
}
function rating(p,mine){
  const dialog=modal('Rate '+esc(p.name),'<p class="small">Score their fictional game attributes from 1 to 5.'+(!mine&&!p.demo?' A first rating unlocks a bonus match today.':'')+'</p><form class="stack">'+stats.map((name,i)=>'<div class="rating-row"><strong>'+name+'</strong><fieldset aria-label="'+name+'">'+[1,2,3,4,5].map(n=>'<label class="rating-choice"><input type="radio" name="r'+i+'" value="'+n+'" '+(mine?.values[i]===n?'checked':'')+' required><span>'+n+'</span></label>').join('')+'</fieldset></div>').join('')+'<label><strong>Tags</strong> <small>Pick up to 3</small></label><div class="actions">'+tags.map(t=>'<label class="tag-choice"><input type="checkbox" name="tags" value="'+esc(t)+'" '+(mine?.tags.includes(t)?'checked':'')+'><span>'+esc(t)+'</span></label>').join('')+'</div>'+field('Course code (optional)','course','maxlength="24" value="'+esc(mine?.course)+'"')+'<label class="field">Comment (optional)<textarea name="comment" maxlength="600" placeholder="Keep it playful and about the game.">'+esc(mine?.comment)+'</textarea></label>'+err+'<button class="btn primary raised">Save rating</button></form>');
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
    '<form id="request" class="panel stack">'+field(isSchool?'University name':'Professor name','name','required maxlength="120"')+(isSchool?field('City and state or country','location','required maxlength="120"'):schoolPicker('request-school','University',params().get('school')??'','Choose a school',true)+field('Department','department','required maxlength="120"'))+field(isSchool?'Official university website':'Official faculty-directory URL','url','type="url" required')+textarea('Supporting information (optional)','note','maxlength="600"')+err+'<div><button class="btn primary raised">Submit for verification</button></div></form>');
  if(!isSchool)bindSchoolPicker('request-school','Choose a school');
  bindForm($('#request'),async data=>{await api('request',{kind,...Object.fromEntries(data)});go(isSchool?'schools':'search');showToast('Request is pending verification.');});
}
const traitLabels={skin:'Skin tone',hair:'Hair',hairColor:'Hair color',glasses:'Glasses',beard:'Facial hair',shirt:'Shirt',shirtColor:'Shirt color',pants:'Pants',pantsColor:'Pants color',shoes:'Shoes',prop:'Accessory',eyeShape:'Eye shape',eyeSize:'Eye size',eyeColor:'Eye color'};
function availability(key,index){return ({prop:{3:5,6:10},shirtColor:{7:20}})[key]?.[index]??0;}
function attachCreator(root,initial,maxLevel=Infinity){
  const startingTraits={...eyeTraits,...initial};
  let traits={...startingTraits};
  const draw=()=>{
    root.innerHTML='<div class="creator"><div class="preview">'+sprite(traits)+'</div><div class="stack"><div class="choices">'+Object.entries(options).map(([key,variants])=>colors.has(key)?'<div class="field"><strong>'+traitLabels[key]+'</strong><div class="swatches">'+variants.map((color,i)=>'<button type="button" data-color="'+key+'" data-index="'+i+'" aria-label="'+traitLabels[key]+': '+(key==='eyeColor'?eyeColorNames[i]:i+1)+'" aria-pressed="'+(traits[key]===i)+'" style="background:'+color+'" '+(availability(key,i)>maxLevel?'disabled':'')+'></button>').join('')+'</div></div>':'<label class="field">'+traitLabels[key]+'<select data-trait="'+key+'">'+variants.map((variant,i)=>'<option value="'+i+'" '+pick(i,traits[key])+' '+(availability(key,i)>maxLevel?'disabled':'')+'>'+variant+(availability(key,i)>maxLevel?' (Lv. '+availability(key,i)+')':'')+'</option>').join('')+'</select></label>').join('')+'</div><div class="actions"><button class="btn subtle" type="button" id="randomize">Randomize</button><button class="btn subtle" type="button" id="reset">Reset</button></div></div></div>';
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
    $('#reset',root).onclick=()=>{traits={...startingTraits};updateFocus('#reset');};
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
      '<form id="fighter-form" class="panel stack"><div id="creator"></div>'+schoolPicker('fighter-school','Home university (optional)',me.school,'No university selected')+'<div id="allocation"></div>'+err+'<div><button class="btn primary raised">Save character</button></div></form>');
    bindSchoolPicker('fighter-school','No university selected');
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
    (isMe?'<div class="actions">'+button(bolt+' Daily challenge','fight','primary raised')+button('Customize fighter','fighter?edit=1')+'<button class="btn subtle" id="recovery-key">Recovery key</button><button class="btn subtle" id="logout">Log out</button></div>':'')+
    '<div class="section grid two"><div class="panel stack"><h2>Combat stats</h2>'+bars(user)+'</div><div class="panel stack"><h2>Progression</h2><div><strong>'+user.xp+' XP</strong><div class="meter" aria-hidden="true"><i style="width:'+(xp/state.settings.levelXP*100)+'%"></i></div><small>'+xp+' / '+state.settings.levelXP+' XP to next level</small></div><div>'+total+' battles · '+user.wins+' wins · '+user.losses+' losses'+(user.draws?' · '+user.draws+' draws':'')+'</div><div>'+(total?Math.round(user.wins/total*100):0)+'% win rate · '+user.defeated.length+' unique opponents defeated</div><div>Best trivia score '+user.best+'</div></div></div>'+
    (isMe?'<div class="grid two"><div class="panel stack"><h2>Achievements</h2><div class="actions">'+(user.achievements.map(a=>'<span class="pill">'+esc(a)+'</span>').join('')||'<small>Play your first battle to start earning badges.</small>')+'</div><h3>Saved professors</h3><div class="mini-list">'+(user.favorites.map(id=>prof(id)).filter(Boolean).map(p=>'<a href="/'+linkProf(p.id)+'">★ <strong>'+esc(p.name)+'</strong>'+score(p.power)+'</a>').join('')||'<small>Save professors from their profiles.</small>')+'</div></div><div class="panel stack"><h2>Battle history</h2><div class="mini-list">'+(user.history.map(b=>'<a href="/battle?id='+qs(b.id)+'"><span>'+({player:'✓',enemy:'×',tie:'='})[b.result]+'</span><strong>'+esc(b.name)+'<br><small>'+({player:'Win',enemy:'Loss',tie:'Draw'})[b.result]+' · +'+b.xp+' XP'+(b.score!=null?' · '+b.score+' trivia points':'')+'</small></strong><small>'+date(b.date)+'</small></a>').join('')||'<small>Your completed challenges will appear here.</small>')+'</div></div></div>':''));
  if(isMe)$('#recovery-key').onclick=()=>{
    const dialog=modal('Generate a recovery key','<form class="stack">'+field('Current password','password','type="password" required autocomplete="current-password"')+err+'<button class="btn primary">Generate key</button></form>');
    bindForm($('form',dialog),async data=>{
      const result=await api('recovery-key',Object.fromEntries(data));
      dialog.close();showRecoveryKey(result.recoveryKey);
    });
  };
  if(isMe)$('#logout').onclick=async()=>{try{await api('logout',{});await refresh();go('home');showToast('Logged out.');}catch(e){showToast(e.message);}};
}
function ranks(){
  const initial=params().get('school')??'';
  page(head('','Strongest professors','Ranked by overall game power from community ratings.')+
    '<div class="filters">'+schoolPicker('rank-school','University',initial)+'</div><div class="panel" id="rank-list"></div>');
  bindSchoolPicker('rank-school');
  const campus=$('#rank-school');
  campus.onchange=()=>{
    const entries=state.people.filter(p=>p.eligible&&(!campus.value||p.school===campus.value))
      .sort((a,b)=>b.power-a.power||a.name.localeCompare(b.name));
    $('#rank-list').innerHTML='<p class="small">Official rankings require '+state.settings.minRatings+' ratings.</p>'+
      (entries.map((p,i)=>'<div class="rank-row"><strong>#'+(i+1)+'</strong><div><a href="/'+linkProf(p.id)+'"><strong>'+esc(p.name)+'</strong></a><br><small>'+p.count+' ratings · '+schoolName(p.school)+'</small></div><strong>'+p.power+'</strong></div>').join('')||empty('No professors meet the ranking requirements yet.'));
  };
  campus.onchange();
}
async function arena(version){
  const rematch=params().get('rematch');
  const match=await api('challenge'+(rematch?'?rematch='+qs(rematch):''));
  if(version!==routeCounter)return;
  const {professor:p}=match;
  const type=rematch?'Bonus match':'Daily challenge';
  const opponent='<div class="battle-stage challenge-preview">'+combatant({name:state.me?.name??'Campus Challenger',avatar:state.me?.avatar??defaultAvatar,level:state.me?.level??1},100,100,'',true)+'<span class="pixel">VS</span>'+combatant(p,100,100,'',true)+'</div>';
  const links='<div class="actions">'+button('View professor',linkProf(p.id),'subtle')+(state.me?button('Customize your fighter','fighter?edit=1','subtle'):'<a class="btn subtle" href="/signup">Create a fighter</a>')+'</div>';
  const intro=head('Campus arena',type,rematch?'A bonus match earned by rating this professor.':'Face today’s professor. The challenge resets at midnight Eastern time.');
  if(match.battleId){
    page('<div class="battle">'+intro+opponent+'<div class="panel battle-question stack"><h2>'+esc(p.name)+'</h2><p>'+(match.status==='finished'?'You finished this challenge.':'Your match is already underway.')+'</p><div class="actions">'+button(match.status==='finished'?'View result':'Continue match','battle?id='+qs(match.battleId),'primary raised')+'</div>'+links+'</div></div>');
    return;
  }
  if(!match.available){
    page('<div class="battle">'+intro+opponent+'<div class="panel battle-question stack"><h2>'+esc(p.name)+'</h2><p>Submit your first rating for this professor to unlock a bonus match.</p>'+links+'</div></div>');
    return;
  }
  page('<div class="battle">'+intro+opponent+'<form id="daily-battle" class="panel battle-question stack"><div><h2>'+esc(p.name)+'</h2><p class="small">'+schoolName(p.school)+' · '+esc(p.department)+'</p></div><label class="field">Question format<select name="playlist"><option value="mixed">Mixed trivia</option><option value="estimate">Estimation</option><option value="rare">Find the rarest answer</option><option value="common">Find the most common answer</option></select></label>'+err+'<div class="actions"><button class="btn primary raised">'+bolt+(rematch?' Start bonus match':' Play today’s challenge')+'</button>'+button('View professor',linkProf(p.id),'subtle')+'</div>'+(!state.me?'<small>Play with the default fighter. <a class="text-link" href="/signup">Create an account</a> to customize your fighter and earn XP.</small>':'')+'</form></div>');
  bindForm($('#daily-battle'),async data=>{
    const b=await api('battle/start',{type:match.type,to:rematch,playlist:data.get('playlist')});
    go('battle?id='+qs(b.id));
  });
}
function combatant(f,hp,max,animation,preview=false){
  return '<div class="fighter-battle '+animation+'"><strong>'+esc(f.name)+(f.demo?' (demo)':'')+'</strong>'+(preview?'':'<div class="health"><i style="width:'+(100*hp/max)+'%"></i></div><small>'+hp+' / '+max+' HP · '+(f.level?'Lv. '+f.level:f.power+' power')+'</small>')+sprite(f.avatar)+'</div>';
}
const formatTriviaAnswer=answer=>typeof answer==='string'?esc(answer):fmt(answer);
function battlePage(b,version,animate=false){
  if(version!==routeCounter)return;
  clearInterval(timer);
  const last=b.log.at(-1), ended=b.status==='finished', reveal=b.status==='reveal'||ended;
  const attack=who=>!animate||last?.winner==='tie'?'':last?.winner===who?'lunge':'flash';
  const stage='<div class="battle-stage">'+combatant(b.player,b.playerHP,b.maxPlayer,attack('player'))+'<span class="pixel">VS</span>'+combatant(b.enemy,b.enemyHP,b.maxEnemy,attack('enemy'))+(animate&&last?.damage?'<span aria-hidden="true" class="damage '+(last.winner==='player'?'right':'left')+'">−'+last.damage+'</span>':'')+'</div>';
  const score=b.log.reduce((n,r)=>n+r.score,0);
  const roundLabel='Round '+(b.round+1)+' of '+b.total;
  const result=ended?'<div class="panel battle-question stack"><h2>'+(b.winner==='player'?'Victory!':b.winner==='enemy'?'Defeat!':'Draw!')+'</h2><p>'+(b.winner==='tie'?'Both fighters finished with the same share of HP.':esc(b[b.winner].name)+' takes the match.')+'</p><div class="actions"><span class="pill">'+score+' trivia points</span><span class="pill">'+b.log.filter(r=>r.playerError===0).length+' perfect answers</span><span class="pill">'+b.log.filter(r=>r.winner==='player').reduce((sum,r)=>sum+r.damage,0)+' damage dealt</span><span class="pill">'+b.log.filter(r=>r.winner==='enemy').length+' bot rounds won</span>'+(b.reward?'<span class="pill">+'+b.reward.xp+' XP</span>':'')+'</div>'+
    (b.reward?.leveled?'<div class="notice"><strong>LEVEL UP!</strong> You reached level '+b.reward.level+' and earned new stat points.</div>':'')+
    (b.reward?.achievements.length?'<div class="notice">Unlocked '+esc(b.reward.achievements.join(', '))+'</div>':'')+
    '<div class="actions">'+(b.challengeType!=='rematch'&&!b.enemy.demo?button('Rate professor for a bonus match',linkProf(b.enemy.id),'primary'):'')+button('Daily challenge','fight','subtle')+'<button class="btn subtle" id="share">Share result</button>'+button('View rankings','rankings','subtle')+'</div><div id="share-field"></div>'+
    (b.progression?(state.me?button('Customize your fighter','fighter?edit=1','subtle'):''):'<small>Create an account to build your own fighter and start leveling up. <a class="text-link" href="/signup">Sign up</a></small>')+'</div>':'';
  const answerPanel=reveal&&last?'<div class="panel battle-question"><div class="battle-meta"><span class="eyebrow">'+roundLabel+'</span><span class="pill">'+(last.winner==='player'?'You land the hit':last.winner==='enemy'?'The professor lands the hit':'Tie · no damage')+'</span></div><h2>'+esc(last.prompt)+'</h2><div class="grid guess-grid"><div><small>Your answer</small><strong>'+formatTriviaAnswer(last.estimate)+'</strong></div><div><small>Bot answer</small><strong>'+formatTriviaAnswer(last.bot)+'</strong></div><div><small>Answer</small><strong>'+formatTriviaAnswer(last.answer)+'</strong></div></div><p class="small">'+last.damage+' damage · '+last.score+' trivia points'+(last.source?' · <a class="text-link" href="'+esc(last.source)+'" target="_blank" rel="noopener">Answer source</a>':'')+'</p><div class="actions">'+(!ended?'<button class="btn primary raised" id="next">Next round</button>':'')+'<button class="btn subtle" id="question-report">Report question</button></div></div>':'';
  const choiceQuestion=b.question?.kind==='rare'||b.question?.kind==='common';
  const instruction=choiceQuestion?(b.question.kind==='rare'?'Pick the rarest outcome':'Pick the most common outcome'):'Closest estimate wins';
  const choices=choiceQuestion?'<fieldset class="trivia-options"><legend>'+instruction+'</legend>'+b.question.options.map((option,index)=>'<label><input type="radio" name="choice" value="'+index+'" required><span>'+esc(option)+'</span></label>').join('')+'</fieldset>':'';
  const question=!reveal?'<div class="panel battle-question"><div class="battle-meta"><span class="eyebrow">'+roundLabel+' · '+esc(b.question.category)+'</span><span class="clock" id="clock">—</span></div><h2>'+esc(b.question.prompt)+'</h2><form id="guess" class="stack">'+choices+'<div class="actions">'+(choiceQuestion?'':field('Your estimate ('+esc(b.question.unit)+')','estimate','required inputmode="decimal" autocomplete="off" placeholder="Enter a number"'))+'<button class="btn primary raised">Lock in answer</button></div>'+err+'</form></div>':'';
  page('<div class="battle">'+(ended?head('Battle result',esc(b.player.name)+' vs. '+esc(b.enemy.name)):head('Campus arena',b.playlist&&b.playlist!=='estimate'?'Trivia Battle':'Closest Wins'))+stage+result+answerPanel+question+'<p class="small battle-question">Trivia score '+score+' · '+b.log.length+' completed '+(b.log.length===1?'round':'rounds')+'</p>'+(b.log.length>1?'<details class="panel"><summary>Round history</summary>'+b.log.map((r,i)=>'<div class="review"><strong>Round '+(i+1)+'</strong><p>'+esc(r.prompt)+'</p><small>You '+formatTriviaAnswer(r.estimate)+' · Bot '+formatTriviaAnswer(r.bot)+' · Answer '+formatTriviaAnswer(r.answer)+' · '+r.damage+' damage</small></div>').join('')+'</details>':'')+'</div>');
  const next=async(action,answer={})=>{
    const updated=await api('battle',{id:b.id,round:b.round,action,...answer});
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
      try{await next('guess');}catch(e){if(version===routeCounter){$('.error',form).textContent=e.message;}busy=false;}
    };
    timer=setInterval(tick,250);tick();
    bindForm(form,async data=>{
      if(busy||version!==routeCounter)return;
      let answer;
      if(choiceQuestion)answer={choice:Number(data.get('choice'))};
      else{
        const raw=String(data.get('estimate')).trim();
        if(!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?\s*%?$/.test(raw))throw new Error('Enter a positive number or zero.');
        answer={estimate:Number(raw.replace(/[,\s%]/g,''))};
      }
      busy=true;
      try{await next('guess',answer);}finally{busy=false;}
    });
  }
}
const settingsLabels={prior:'Faculty prior (0–100)',priorWeight:'Prior rating weight',minRatings:'Ratings required for official rank',minProfessors:'Ranked professors required per school',winXP:'Victory XP',lossXP:'Loss or draw XP',firstXP:'First victory bonus XP',levelXP:'XP per level',hp:'Base HP',damage:'Base damage',botSpread:'Bot estimate spread'};
async function admin(version){
  if(!state.me?.admin)throw new Error('Admin access required.');
  const data=await api('admin');if(version!==routeCounter)return;
  let tab=params().get('tab')??'Overview';
  const kinds={'University Requests':['school'],'Professor Requests':['professor'],'Avatar Edits':['avatar'],'Trivia Submissions':['proposal'],'Inbox':['contact'],'Reports':['report','correction','question']};
  const tabs=['Overview',...Object.keys(kinds),'Questions','Game Balance','Users'];
  const requests=data.requests.filter(r=>kinds[tab]?.includes(r.kind));
  const actionForm=r=>'<form data-request="'+esc(r.id)+'" class="stack"><div class="actions">'+(r.url?'<label><input name="verified" type="checkbox"> Official source verified</label>':'')+(r.kind==='correction'?'<label><input name="remove" type="checkbox"> Remove profile</label>':'')+'</div>'+field('Decision note (optional)','note','maxlength="600"')+'<div class="actions"><button class="btn primary" name="action" value="approve">'+(r.kind==='contact'?'Mark resolved':'Approve')+'</button><button class="btn subtle" name="action" value="hold">Hold</button><button class="btn subtle danger" name="action" value="reject">Reject</button></div>'+err+'</form>';
  const requestRows=()=>requests.map(r=>'<article class="admin-row stack"><div class="split"><strong>'+esc(r.question?.prompt??r.name??prof(r.target)?.name??r.target??r.kind)+'</strong><span class="pill">'+esc(r.status)+'</span></div><small>'+[r.department,school(r.school)?.name,r.location,r.displayName,r.reply,date(r.date)].filter(Boolean).map(esc).join(' · ')+'</small>'+(r.question?'<p class="small">'+esc(r.question.category)+' · Answer '+fmt(r.question.answer)+' '+esc(r.question.unit)+(r.question.source?' · <a class="text-link" href="'+esc(r.question.source)+'" target="_blank" rel="noopener">Check answer source</a>':'')+'</p>':'')+(r.url?'<a class="text-link" href="'+esc(r.url)+'" target="_blank" rel="noopener">Review submitted source</a>':'')+(r.avatar?'<div class="grid two"><div><small>Current</small><div class="preview">'+(prof(r.target)?sprite(prof(r.target).avatar):'Unavailable')+'</div></div><div><small>Proposed</small><div class="preview">'+sprite(r.avatar)+'</div></div></div>':'')+(r.note?'<p>'+esc(r.note)+'</p>':'')+(['pending','hold'].includes(r.status)?actionForm(r):r.decisionNote?'<small>'+esc(r.decisionNote)+'</small>':'')+'</article>').join('')||empty('No requests in this queue.');
  let content;
  if(tab in kinds)content='<div class="panel">'+requestRows()+'</div>';
  else if(tab==='Questions')content='<div class="panel stack"><div class="actions"><button class="btn primary" id="add-question">Add question</button><button class="btn subtle" id="import-questions">Import JSON pack</button></div><details><summary>Today’s five automatic questions (UTC)</summary><ul>'+data.daily.map(q=>'<li>'+esc(q.prompt)+'</li>').join('')+'</ul></details><div class="filters"><input id="question-search" type="search" placeholder="Search questions" aria-label="Search questions"><select id="question-status" aria-label="Filter question status"><option value="">All statuses</option><option value="active">Active</option><option value="disabled">Disabled</option></select></div><div id="question-list"></div></div>';
  else if(tab==='Game Balance')content='<form id="settings" class="panel stack">'+Object.entries(data.config).map(([key,n])=>field(settingsLabels[key],key,'required type="number" step="'+(key==='botSpread'?'0.1':'1')+'" value="'+n+'"')).join('')+err+'<div><button class="btn primary">Save settings</button></div></form>';
  else if(tab==='Users')content='<div class="panel">'+data.users.map(u=>'<div class="admin-row"><strong>'+esc(u.name)+'</strong> · '+esc(u.email)+' · '+u.xp+' XP'+(u.admin?' · Admin':'')+'</div>').join('')+'</div>';
  else content='<div class="grid two"><div class="panel stack"><h2>Review queues</h2>'+Object.entries(kinds).map(([label,types])=>'<a class="text-link" href="/admin?tab='+qs(label)+'">'+label+' ('+data.requests.filter(r=>types.includes(r.kind)&&['pending','hold'].includes(r.status)).length+')</a>').join('')+'</div><div class="panel stack"><h2>Audit log</h2>'+(data.audit.map(row=>'<small>'+date(row.date)+' · '+esc(row.admin)+' · '+esc(row.action)+'</small>').join('')||'<small>No actions recorded.</small>')+'</div></div>';
  page(head('Moderation','Admin dashboard')+'<div class="tabs">'+tabs.map(t=>button(t,'admin?tab='+qs(t),tab===t?'primary':'subtle')).join('')+'</div>'+content);
  all('[data-request]').forEach(form=>{
    bindForm(form,async (fields,button)=>{
      await api('admin',{id:form.dataset.request,action:button?.value,verified:fields.has('verified'),remove:fields.has('remove'),note:fields.get('note')});
      if(button?.value==='approve'&&requests.some(request=>request.id===form.dataset.request&&request.kind==='school'))allSchoolsLoaded=false;
      await refresh();route(false);showToast('Review decision saved.');
    });
  });
  if($('#settings'))bindForm($('#settings'),async fields=>{
    await api('admin',{action:'settings',settings:Object.fromEntries([...fields].map(([key,n])=>[key,Number(n)]))});
    await refresh();route(false);showToast('Balancing settings saved.');
  });
  if($('#add-question')){
    $('#add-question').onclick=()=>editQuestion();
    const search=$('#question-search'), status=$('#question-status'), list=$('#question-list');
    const renderQuestions=()=>{
      const query=search.value.trim().toLowerCase();
      const filtered=data.questions.filter(q=>(q.prompt+' '+q.category).toLowerCase().includes(query)&&(!status.value||(status.value==='active')===q.active));
      list.innerHTML=filtered.map(q=>'<div class="admin-row split"><div><strong>'+esc(q.prompt)+'</strong><br><small>'+esc(q.category)+' · '+(q.kind&&q.kind!=='estimate'?esc(q.kind==='rare'?'Rarest answer':'Most common answer'):fmt(q.answer)+' '+esc(q.unit))+' · '+(q.active?'Active':'Disabled')+'</small></div><button class="btn subtle" data-question="'+esc(q.id)+'">Edit</button></div>').join('')||empty('No questions match these filters.');
      all('[data-question]',list).forEach(el=>el.onclick=()=>editQuestion(filtered.find(q=>q.id===el.dataset.question)));
    };
    search.oninput=renderQuestions;
    status.onchange=renderQuestions;
    renderQuestions();
  }
  if($('#import-questions'))$('#import-questions').onclick=()=>{
    const dialog=modal('Import question pack','<p class="small">Paste a JSON array. For estimation, include prompt, category, unit, answer, scale, time, and active. For choice questions set kind to rare or common and include options with text and weight. Source is optional.</p><form class="stack">'+field('Upload a JSON file','file','type="file" accept=".json,application/json"')+textarea('Or paste JSON','pack')+err+'<button class="btn primary">Import questions</button></form>');
    bindForm($('form',dialog),async fields=>{
      let questions;
      const file=fields.get('file'), pasted=String(fields.get('pack')).trim();
      if(file.size&&pasted)throw new Error('Choose a file or paste JSON.');
      if(file.size>140000)throw new Error('Choose a JSON file under 140 KB.');
      const raw=file.size?await file.text():pasted;
      try{questions=JSON.parse(raw);}catch{throw new Error('Enter a valid JSON array.');}
      await api('admin',{action:'import',questions});dialog.close();route(false);showToast('Question pack imported.');
    });
  };
}
async function contribute(version){
  const intro=head('Community','Contribute to the game','Send in trivia questions or help expand the professor directory.');
  const links='<div class="actions">'+button('Request a professor','request?kind=professor','subtle')+button('Request a school','request?kind=school','subtle')+'</div>';
  if(!state.me){
    page(intro+'<div class="panel stack"><h2>Submit a contribution</h2><p>Log in to send ideas and check whether they’ve been reviewed.</p><div class="actions"><button class="btn primary" id="contribute-login">Log in</button><button class="btn" id="contribute-signup">Create account</button></div></div>');
    $('#contribute-login').onclick=noAuth;
    $('#contribute-signup').onclick=()=>{returnTo='contribute';go('signup');};
    return;
  }
  const submissions=await api('submissions');
  if(version!==routeCounter)return;
  const states={pending:'Pending review',approve:'Approved',reject:'Declined',hold:'On hold'};
  const history=submissions.map(row=>'<div class="admin-row"><div class="split"><strong>'+esc(row.title)+'</strong><span class="pill">'+esc(states[row.status]??row.status)+'</span></div><small>'+date(row.date)+'</small>'+(row.decisionNote?'<p class="small">'+esc(row.decisionNote)+'</p>':'')+'</div>').join('');
  page(intro+links+'<div class="section grid two"><form id="proposal" class="panel stack"><h2>Suggest a trivia question</h2><p class="small">Choose a question with one numeric answer. A moderator reviews submissions before they enter the arena.</p>'+field('Question','prompt','required maxlength="240"')+field('Category','category','required maxlength="32" placeholder="Space, history, sports…"')+field('Unit','unit','required maxlength="32" placeholder="years, km, %"')+field('Correct answer','answer','required type="number" min="0" max="1000000000000" step="any"')+field('HTTPS source link','source','required type="url"')+textarea('Note to the moderator (optional)','note','maxlength="600"')+err+'<div><button class="btn primary raised">Send for review</button></div></form><div class="panel"><h2>Your submissions</h2>'+ (history||empty('Your contributions will appear here.'))+'</div></div>');
  bindForm($('#proposal'),async form=>{
    const {note,answer,...details}=Object.fromEntries(form);
    const number=Number(answer);
    await api('request',{kind:'proposal',note,question:{...details,answer:number,time:25,scale:Math.max(1,Math.abs(number)*.25)}});
    showToast('Question sent for review.');
    route(false);
  });
}
function editQuestion(q={time:25,active:true}){
  const kinds=[['estimate','Estimation'],['rare','Rarest answer'],['common','Most common answer']];
  const dialog=modal(q.id?'Edit question':'Add question','<form class="stack">'+field('Prompt','prompt','required maxlength="240" value="'+esc(q.prompt)+'"')+field('Category','category','required maxlength="32" value="'+esc(q.category)+'"')+'<label class="field">Question format<select name="kind">'+kinds.map(([id,label])=>'<option value="'+id+'" '+pick(id,q.kind??'estimate')+'>'+label+'</option>').join('')+'</select></label><div id="question-fields" class="stack"></div>'+field('Time limit in seconds','time','required type="number" min="10" max="120" value="'+q.time+'"')+field('Source URL (optional)','source','type="url" value="'+esc(q.source)+'"')+'<label><input type="checkbox" name="active" '+(q.active?'checked':'')+'> Active in battle rotation</label>'+err+'<button class="btn primary">Save question</button></form>');
  const kind=$('[name=kind]',dialog);
  kind.onchange=()=>{
    $('#question-fields',dialog).innerHTML=kind.value==='estimate'
      ?field('Unit','unit','required maxlength="32" value="'+esc(q.unit)+'"')+field('Answer','answer','required type="number" min="0" step="any" value="'+esc(q.answer)+'"')+field('Typical error scale','scale','required type="number" min="0.01" step="any" value="'+esc(q.scale)+'"')
      :'<label class="field">Choices and weights<textarea name="options" required placeholder="1 | Example answer">'+esc(q.options?.map(o=>o.weight+' | '+o.text).join('\n')??'')+'</textarea></label><small>One choice per line. Enter a weight, a vertical bar, and the answer text. Weights represent counts or probabilities on the same scale.</small>';
  };
  kind.onchange();
  bindForm($('form',dialog),async fields=>{
    const body=Object.fromEntries(fields);
    body.time=Number(body.time);
    if(body.kind==='estimate'){
      body.answer=Number(body.answer);body.scale=Number(body.scale);
    }else{
      body.options=body.options.split(/\r?\n/).filter(line=>line.trim()).map(line=>{
        const [weight,...text]=line.split('|');
        return {weight:weight.trim()?Number(weight):null,text:text.join('|').trim()};
      });
    }
    await api('admin',{...body,id:q.id,action:'question',active:fields.has('active')});dialog.close();route(false);showToast('Question saved.');
  });
}
function contactPage(){
  const intro=head('','Contact the moderators','Send feedback, report a site problem, or ask a question.');
  if(!state.me){
    page(intro+'<button class="btn primary" id="contact-login">Log in to send a message</button>');
    $('#contact-login').onclick=noAuth;
    return;
  }
  page(intro+'<form class="panel stack auth" id="contact">'+field('Subject','subject','required minlength="3" maxlength="90"')+textarea('Message','message','required minlength="10" maxlength="1600"')+'<p class="small">Your account email accompanies the message so a moderator can reply.</p>'+err+'<button class="btn primary">Send message</button></form>');
  bindForm($('#contact'),async data=>{
    await api('contact',Object.fromEntries(data));
    page(intro+'<p class="notice" role="status">Message sent to the moderator inbox.</p>');
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
    if(['search','schools','school','fighter','request','rankings'].includes(section)){
      await loadSchoolDirectory();
      if(version!==routeCounter)return;
    }
    if(section==='home')home();
    else if(section==='search')search();
    else if(section==='schools')schools();
    else if(section==='school')schoolPage();
    else if(section==='professor')await professor(id,version);
    else if(section==='fight')await arena(version);
    else if(section==='rankings')ranks();
    else if(section==='login'||section==='signup')auth(section==='signup');
    else if(section==='fighter')fighter();
    else if(section==='recover')recovery();
    else if(section==='contribute')await contribute(version);
    else if(section==='request')requestPage();
    else if(section==='admin')await admin(version);
    else if(section==='guidelines')guidelines();
    else if(section==='contact')contactPage();
    else if(section==='battle'){const b=await api('battle?id='+qs(id));battlePage(b,version);}
    else if(section==='player'){
      const u=(await api('players')).find(p=>p.id===id);if(version!==routeCounter)return;
      if(!u)throw new Error('Fighter not found.');
      playerProfile(u);
    }else throw new Error('Page not found.');
  }catch(e){if(version===routeCounter)page(head('Campus arcade','Something went wrong',esc(e.message))+button('Back to homepage','home','primary'));}
}
window.addEventListener('popstate',()=>{migrateBookmark();route();});
document.addEventListener('click',event=>{
  if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  const link=event.target.closest('a[href]');
  if(!link||link.target||link.hasAttribute('download')||link.origin!==location.origin||!link.getAttribute('href').startsWith('/'))return;
  event.preventDefault();
  const url=link.pathname+link.search;
  if(location.pathname+location.search!==url)history.pushState(null,'',url);
  route();
});
migrateBookmark();
refresh().then(()=>route()).catch(error=>page(head('Campus arcade','Couldn’t load the site',esc(error.message))));
