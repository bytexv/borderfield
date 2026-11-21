'use strict';
const countries = new Map(ATLAS.map(c => [c.id,c]));
const regions = ['Africa','Asia','Europe','North America','South America','Oceania'];
const labels = {world:'World quiz',quick:'Quick round',review:'Review mistakes'};
const root = document.getElementById('app');
const icons = {
  arrow:'<path d="M4 12h15m-6-6 6 6-6 6"/>', upRight:'<path d="M6 18 18 6M7 6h11v11"/>',
  next:'<path d="m9 5 7 7-7 7"/>', back:'<path d="m14 5-7 7 7 7"/>',
  desk:'<path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-6h6v6"/>',
  book:'<path d="M3 4c4-1 7 0 9 2 2-2 5-3 9-2v15c-3-1-7 0-9 2-2-2-6-3-9-2zM12 6v15"/>',
  chart:'<path d="M3 21h18M6 17v-5m6 5V4m6 13V8"/>',
  settings:'<path d="M3 7h5m5 0h8M3 17h10m5 0h3"/><circle cx="10.5" cy="7" r="2.5"/><circle cx="15.5" cy="17" r="2.5"/>',
  scope:'<circle cx="12" cy="12" r="7"/><path d="M12 2v5m0 10v5M2 12h5m10 0h5"/>',
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/>',
  bookmark:'<path d="M6 3h12v18l-6-4-6 4z"/>', hint:'<path d="M8 15c0-2-3-3-3-7a7 7 0 0 1 14 0c0 4-3 5-3 7zM9 19h6m-5 3h4"/>',
  check:'<path d="m4 12 5 5L20 6"/>', redo:'<path d="M3 10a9 9 0 1 1 1 8M3 4v6h6"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4"/>',
  layers:'<path d="m2 8 10-5 10 5-10 5zM3 12l9 5 9-5M3 16l9 5 9-5"/>'
};
function icon(name){return '<svg aria-hidden="true" class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+icons[name]+'</svg>';}
const logo='<svg aria-hidden="true" class="mark" viewBox="0 0 36 36"><rect width="36" height="36" rx="8" fill="#263d33"/><circle cx="18" cy="18" r="12.2" fill="none" stroke="#dcefaa" stroke-dasharray="1 3"/><path d="m24.8 7.8-3.5 13.4-10.1 7 3.4-13.3z" fill="#dff39e"/><path d="m24.8 7.8-7 10.2-3.2-3.1z" fill="#8faa72"/><circle cx="18" cy="18" r="1.5" fill="#233a30"/></svg>';
const escapeHtml = str => String(str).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
function norm(str){return str.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,'and').replace(/^the\s+/,'').replace(/[^a-z0-9]/g,'');}
const countriesByAnswer = new Map();
for (const country of ATLAS) {
  for (const alias of country.aliases) countriesByAnswer.set(norm(alias), country);
}
// Some complete answers also begin longer answers (Niger/Nigeria, US/USA).
// Wait for a short pause on these names so a continuing word stays intact.
const extendableNames = new Set();
for (const alias of countriesByAnswer.keys()) {
  for (let end = 1; end < alias.length; end++) {
    const prefix = alias.slice(0,end);
    if (countriesByAnswer.has(prefix)) extendableNames.add(prefix);
  }
}
let nameTimer;
function checkTypedName(input) {
  if (input.id !== 'map-guess' && input.id !== 'guess') return;
  clearTimeout(nameTimer);
  const guess = norm(input.value);
  const country = countriesByAnswer.get(guess);
  if (!country) return;
  if (input.id === 'guess' && current().ids[current().index] !== country.id) return;
  function accept() {
    if (!input.isConnected || norm(input.value) !== guess) return;
    if (input.id === 'map-guess') submitMapCountry(true);
    else answer();
  }
  if (extendableNames.has(guess)) nameTimer = setTimeout(accept,1100);
  else accept();
}
const fresh = {known:[],saved:[],missed:[],rounds:0,sessions:{},auto:true};
let data;
try{data=Object.assign({},fresh,JSON.parse(localStorage.getItem('borderfield.v1'))||{});}catch(e){data=Object.assign({},fresh);}
function save(){try{localStorage.setItem('borderfield.v1',JSON.stringify(data));}catch(e){announce('Storage is unavailable. This session will last until you close the app.');}}
function add(list,id){if(!list.includes(id))list.push(id);}
function remove(list,id){const i=list.indexOf(id);if(i>=0)list.splice(i,1);}
function announce(message){document.getElementById('announcer').textContent=message;}
let screen='desk',detailId='',origin='guide',mode='world',query='',filter='All',listY=0,settingsOrigin='desk',notice='',quizMsg='',draft='';
function today(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
function dailyCountry(){const day=Math.floor(Date.parse(today()+'T00:00:00Z')/86400000);return ATLAS[(day*37)%ATLAS.length];}
function thumb(c){return '<span class="thumb">'+outline(c)+'</span>';}
function outline(c){return '<svg class="sil" aria-hidden="true" viewBox="0 0 300 180"><path d="'+c.path+'" fill="currentColor" stroke="currentColor" stroke-width=".5" fill-rule="evenodd" stroke-linejoin="round"/>'+c.dots.map(p=>'<circle cx="'+p[0]+'" cy="'+p[1]+'" r=".95" fill="currentColor"/>').join('')+'</svg>';}
function header(){return '<header class="top"><button class="brand" data-act="desk" aria-label="Borderfield field desk">'+logo+'Borderfield</button><button class="tool" data-act="settings" aria-label="Settings">'+icon('settings')+'</button></header>';}
function context(back,meta){return '<header class="top context"><button class="back" data-act="back">'+icon('back')+back+'</button><span class="meta">'+meta+'</span></header>';}
function nav(active){return '<nav class="nav" aria-label="Main navigation">'+[['desk','desk','Field desk'],['guide','book','Field guide'],['log','chart','Logbook']].map(([id,i,n])=>'<button class="'+(id===active?'current':'')+'" '+(id===active?'aria-current="page"':'')+' data-act="'+id+'"><span class="ico">'+icon(i)+'</span>'+n+'</button>').join('')+'</nav>';}
function layout(content,active,top,cls){root.innerHTML='<div class="shell '+(cls||'')+'">'+(top||header())+'<main class="main">'+content+'</main>'+(active?nav(active):'')+'</div>';}
function openScreen(next){screen=next;draw();window.scrollTo(0,0);}
function draw(){({desk:desk,guide:guide,detail:detail,log:logbook,quiz:quiz,map:mapQuiz,result:result,settings:settings})[screen]();}
function desk(){
  const c=dailyCountry(), date=new Date(), map=data.sessions.map, legacy=data.sessions.world;
  const mapAction=map&&map.named.length===ATLAS.length?'View map':map&&map.named.length?'Resume map':'Start map';
  const day=date.toLocaleDateString('en-US',{weekday:'long'}), stamp=date.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
  layout('<div class="heading"><h1>Field desk</h1><div class="date">'+day+'<b>'+stamp+'</b></div></div>'+
    '<section class="hero"><div class="hero-graphic"><img src="art/globe.svg" alt=""></div><div class="kicker">'+icon('scope')+'World map quiz</div><h2>Name the<br>world.</h2><p>195 countries · Any order</p><button class="cta" data-act="world">'+mapAction+icon('arrow')+'</button></section>'+
    '<div class="subhead"><h2>Ways to practice</h2></div><div class="routes">'+
    '<button class="route" data-act="guide"><img class="route-art" src="art/map.svg" alt="">'+icon('upRight')+'<strong>Field guide</strong><small>Study the outlines</small></button>'+
    '<button class="route quick" data-act="quick"><img class="route-art" src="art/timer.svg" alt="">'+icon('upRight')+'<strong>Quick round</strong><small>10 random countries</small></button></div>'+
    (legacy&&!legacy.done?'<button class="actionrow" data-act="legacy"><span class="grow"><strong>Resume your outline quiz</strong><small>Country '+(legacy.index+1)+' of '+legacy.ids.length+'</small></span>'+icon('next')+'</button>':'')+
    '<div class="subhead"><h2>Country of the day</h2></div><button class="daily" data-act="daily">'+thumb(c)+'<span class="grow"><strong>'+escapeHtml(c.name)+'</strong><small>'+c.region+'</small></span>'+icon('next')+'</button>','desk');
}
function guide(){
  layout('<h1 class="title">Field guide</h1><p class="intro">Explore the outlines, capitals and clues.</p>'+
    '<label class="search">'+icon('search')+'<input id="search" aria-label="Search countries" placeholder="Search countries" type="search" value="'+escapeHtml(query)+'"></label>'+
    '<div class="filters" aria-label="Filter countries">'+['All','Saved',...regions].map(r=>'<button class="chip '+(filter===r?'sel':'')+'" data-act="filter" data-id="'+r+'" aria-pressed="'+(filter===r)+'">'+r+'</button>').join('')+'</div><div id="listing"></div>','guide');
  list();
}
function filtered(){const q=norm(query);return ATLAS.filter(c=>(filter==='All'||(filter==='Saved'?data.saved.includes(c.id):c.region===filter))&&(!q||c.aliases.some(a=>norm(a).includes(q))));}
function list(){const rows=filtered();document.getElementById('listing').innerHTML='<div class="meta index-count">'+rows.length+' '+(rows.length===1?'country':'countries')+'</div>'+ (rows.length?rows.map(c=>'<button class="entry" data-act="country" data-id="'+c.id+'">'+thumb(c)+'<span class="grow"><strong>'+escapeHtml(c.name)+'</strong><small>'+c.region+'</small></span>'+icon('next')+'</button>').join(''):'<p class="empty">'+(filter==='Saved'&&!query?'Bookmark a country in the field guide to find it here.':'No countries match this search.')+'</p>');}
function plate(c,study){
  const foot=study?c.detail:'Country outline';
  return '<div class="plate"><svg class="plate-grid" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="grid" width="25" height="25" patternUnits="userSpaceOnUse"><path d="M25 0H0v25" fill="none" stroke="#aab69e" stroke-width=".65"/><circle r="1" fill="#9eaa92"/></pattern></defs><rect width="100%" height="100%" fill="url(#grid)"/></svg><div class="platehead"><span class="meta">'+(study?'Field guide / '+c.id:'Silhouette study')+'</span><span class="north">N <svg viewBox="0 0 10 14" aria-hidden="true"><path d="M5 1 9 13 5 10 1 13z" fill="currentColor"/></svg></span></div>'+outline(c)+'<div class="platefoot"><span class="meta">'+escapeHtml(foot)+'</span>'+icon('scope')+'</div></div>';
}
function showCountry(id,from){if(from==='guide')listY=window.scrollY;origin=from;detailId=id;openScreen('detail');}
function detail(){
  const c=countries.get(detailId),saved=data.saved.includes(c.id);
  layout('<div class="heading"><h1 class="title">'+escapeHtml(c.name)+'</h1><button data-act="bookmark" class="star '+(saved?'on':'')+'" aria-pressed="'+saved+'" aria-label="'+(saved?'Remove bookmark':'Bookmark country')+'">'+icon('bookmark')+'</button></div>'+plate(c,true)+
    '<div class="note"><b>Shape clue</b><p>'+escapeHtml(c.note)+'</p></div>'+
    '<div class="facts"><span>Region</span><strong>'+c.region+'</strong></div><div class="facts"><span>Capital'+(c.id==='ZAF'?'s':'')+'</span><strong>'+escapeHtml(c.capital)+'</strong></div><div class="facts"><span>Land borders</span><strong>'+escapeHtml(c.neighbors.join(', ')||'No land neighbors')+'</strong></div>'+
    '<div class="pair"><button class="secondary" data-act="prevCountry">'+icon('back')+'Previous</button><button class="cta" data-act="nextCountry">Next country'+icon('arrow')+'</button></div>','guide',context(origin==='desk'?'Field desk':origin==='log'?'Logbook':'Field guide','Country card'),'detail-shell');
}
function shuffled(list){const out=list.slice();for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
function start(type,again){mode=type;let s=data.sessions[mode];
  if(again||!s||s.done){const ids=shuffled(type==='review'?data.missed:ATLAS.map(c=>c.id));if(!ids.length){openScreen('log');return;}
    s={ids:type==='quick'?ids.slice(0,10):ids,index:0,score:0,hints:0,wrong:false,outcome:'',done:false};data.sessions[mode]=s;save();}
  quizMsg='';draft='';openScreen('quiz');
}
function current(){return data.sessions[mode];}
function quiz(){
  const s=current(),c=countries.get(s.ids[s.index]),n=s.ids.length;
  const hintList=['Region · '+c.region,'Capital · '+c.capital,'First letter · '+c.name[0]];
  layout('<div class="between"><span class="meta">'+labels[mode]+'</span><span class="meta">'+(s.index+1)+' / '+n+'</span></div><h1 class="qtitle">Name this country.</h1><div class="meter"><i style="width:'+s.index/n*100+'%"></i></div>'+plate(c,false)+
    (s.outcome?'<div class="feedback '+(s.outcome==='reveal'?'warn':'')+'"><strong>'+(s.outcome==='reveal'?'Revealed · ':'Correct · ')+escapeHtml(c.name)+'</strong>'+escapeHtml(c.note)+'</div><button class="cta wide" data-act="advance">'+(s.index===n-1?'See results':'Next outline')+icon('arrow')+'</button>':
     '<form id="answerform" class="answer"><input id="guess" type="text" aria-label="Country name" placeholder="Country name" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="go" value="'+escapeHtml(draft)+'"><button type="submit" class="cta">Check'+icon('arrow')+'</button></form>'+
     '<div id="message" aria-live="polite">'+(quizMsg?'<p class="feedback warn">'+escapeHtml(quizMsg)+'</p>':'')+'</div>'+
     hintList.slice(0,s.hints).map(h=>'<p class="hint">'+escapeHtml(h)+'</p>').join('')+
     '<div class="between"><button class="textbtn" data-act="hint" '+(s.hints===3?'disabled':'')+'>'+icon('hint')+'Hint ('+s.hints+'/3)</button><button class="textbtn" data-act="reveal">Reveal answer'+icon('next')+'</button></div>'),
     null,context('Save & exit','Borderfield'),'quiz-shell');
}
function answer(){
  const s=current();if(s.outcome)return;const c=countries.get(s.ids[s.index]),input=document.getElementById('guess'),guess=norm(input.value);
  if(!guess){input.focus();return;}
  if(countriesByAnswer.get(guess)===c){
    s.outcome='correct';s.score++;add(data.known,c.id);
    if(!s.wrong&&!s.hints)remove(data.missed,c.id);
    advance();
    if(screen==='quiz'){
      const message=document.getElementById('message');
      message.className='map-message map-success';
      message.textContent='✓ '+c.name+' named.';
      document.getElementById('guess').focus();
    }else announce('Round complete.');
  }else{
    s.wrong=true;add(data.missed,c.id);save();quizMsg='Try another name, or use a hint.';
    document.getElementById('message').innerHTML='<p class="feedback warn">'+quizMsg+'</p>';input.focus();input.select();
  }
}
function advance(){const s=current();if(!s.outcome||s.done)return;s.index++;draft='';quizMsg='';
  if(s.index===s.ids.length){s.done=true;data.rounds++;save();openScreen('result');}
  else{s.outcome='';s.hints=0;s.wrong=false;save();quiz();window.scrollTo(0,0);}
}
function result(){const s=current();layout('<h1 class="title">Round complete.</h1><div class="totals"><div class="meta">'+labels[mode]+' · Results</div><div class="bigstat">'+s.score+' <small>/ '+s.ids.length+'</small></div><p>Countries named</p></div><button class="cta wide" data-act="log">Open logbook'+icon('arrow')+'</button><div class="pair"><button class="secondary" data-act="again">Play again</button><button class="secondary" data-act="desk">Field desk</button></div>',null,context('Field desk','Results'));}
function logbook(){const count=data.known.length,pct=Math.round(count/ATLAS.length*100);
  layout('<h1 class="title">Logbook</h1><div class="totals"><div class="meta">World coverage</div><div class="bigstat">'+count+' <small>/ 195</small></div><p>Unique countries named · '+pct+'%</p><div class="meter"><i style="width:'+pct+'%"></i></div></div>'+
    '<div class="stats"><div class="stat"><b>'+data.rounds+'</b><small>Rounds finished</small></div><div class="stat"><b>'+data.saved.length+'</b><small>Bookmarked</small></div></div>'+
    '<button class="actionrow" data-act="review" '+(data.missed.length||data.sessions.review&&!data.sessions.review.done?'':'disabled')+'><span class="icon-stand">'+icon('redo')+'</span><span class="grow"><strong>Review mistakes</strong><small>'+data.missed.length+' to practice</small></span>'+icon('next')+'</button>'+
    '<button class="actionrow" data-act="saved"><span class="icon-stand">'+icon('bookmark')+'</span><span class="grow"><strong>Saved countries</strong><small>Your bookmarked study cards</small></span>'+icon('next')+'</button>'+
    '<div class="subhead"><h2>By region</h2></div>'+regions.map(r=>{const set=ATLAS.filter(c=>c.region===r),v=set.filter(c=>data.known.includes(c.id)).length;return '<div class="region-row"><div class="between"><strong>'+r+'</strong><span class="meta">'+v+' / '+set.length+'</span></div><div class="meter"><i style="width:'+v/set.length*100+'%"></i></div></div>';}).join(''),'log');
}
function settings(){
  const version=window.Borderfield?window.Borderfield.version():'1.0.1';
  layout('<h1 class="title">Settings</h1><div class="subhead"><h2>App updates</h2><small>v'+escapeHtml(version)+'</small></div><div class="setting"><span class="grow"><strong>Check on launch</strong><small>Look for a new GitHub release once a day.</small></span><button class="chip '+(data.auto?'sel':'')+'" data-act="auto" role="switch" aria-checked="'+data.auto+'" aria-label="Check on launch">'+(data.auto?'On':'Off')+'</button></div><button class="actionrow" data-act="updates"><span class="icon-stand">'+icon('download')+'</span><span class="grow"><strong>Check for updates</strong></span>'+icon('next')+'</button><p class="intro" role="status">'+escapeHtml(notice)+'</p><div class="subhead"><h2>About the atlas</h2></div><p class="intro">195 countries: the 193 United Nations members, Palestine and Vatican City. Progress and bookmarks are stored on this device.</p><p class="intro">The world map uses the Equal Earth projection. Dots mark small countries. Individual study cards use their own scale and label any mainland or island detail views.</p><p class="license">Cartography: Natural Earth, 1:10m, public domain. Country data adapted from mledoze/countries under ODbL 1.0. Map boundaries follow the source cartography. Fonts: Barlow Condensed, DM Sans and IBM Plex Mono under the SIL Open Font License.</p>',null,context('Back','Borderfield'));
}
function back(){
  if(screen==='desk')return false;
  if(screen==='detail'){openScreen(origin);if(origin==='guide')window.scrollTo(0,listY);}
  else if(screen==='settings'){openScreen(settingsOrigin);}
  else if(screen==='quiz'&&mode==='review'){openScreen('log');}
  else openScreen('desk');
  return true;
}
window.borderfieldBack=back;
window.onUpdateStatus=message=>{notice=message;if(screen==='settings')settings();};
root.addEventListener('input',ev=>{
  if(ev.target.id==='search'){query=ev.target.value;list();}
  if(ev.target.id==='guess')draft=ev.target.value;
  if(!ev.isComposing)checkTypedName(ev.target);
});
root.addEventListener('compositionstart',()=>clearTimeout(nameTimer));
root.addEventListener('compositionend',ev=>{
  const input=ev.target;
  setTimeout(()=>{if(input.isConnected)checkTypedName(input);},0);
});
root.addEventListener('submit',ev=>{if(ev.target.id==='answerform'){ev.preventDefault();answer();}
  if(ev.target.id==='map-form'){ev.preventDefault();submitMapCountry();}});
root.addEventListener('click',ev=>{
  const button=ev.target.closest('[data-act]');if(!button||button.disabled)return;const act=button.dataset.act;
  if(['desk','log','guide'].includes(act)){if(act==='guide'){filter='All';query='';}openScreen(act);return;}
  if(['quick','review'].includes(act)){start(act);return;}
  switch(act){
    case 'world':startMap();break;
    case 'new-map':if(data.sessions.map.named.length===ATLAS.length)startMap(true);break;
    case 'zoom-in':zoomMap(2);break;
    case 'zoom-out':zoomMap(.5);break;
    case 'legacy':start('world');break;
    case 'settings':settingsOrigin=screen;openScreen('settings');break;
    case 'back':back();break;
    case 'filter':filter=button.dataset.id;for(const el of document.querySelectorAll('.chip[data-act="filter"]')){el.classList.toggle('sel',el.dataset.id===filter);el.setAttribute('aria-pressed',el.dataset.id===filter);}list();break;
    case 'country':showCountry(button.dataset.id,'guide');break;
    case 'daily':showCountry(dailyCountry().id,'desk');break;
    case 'bookmark':if(data.saved.includes(detailId))remove(data.saved,detailId);else add(data.saved,detailId);save();detail();announce(data.saved.includes(detailId)?'Bookmark added':'Bookmark removed');break;
    case 'nextCountry':case 'prevCountry':{let rows=origin==='guide'?filtered():ATLAS;if(!rows.length)rows=ATLAS;const pos=rows.findIndex(c=>c.id===detailId);detailId=rows[(pos+(act==='nextCountry'?1:-1)+rows.length)%rows.length].id;detail();window.scrollTo(0,0);break;}
    case 'saved':filter='Saved';query='';openScreen('guide');break;
    case 'hint':current().hints=Math.min(3,current().hints+1);save();quiz();break;
    case 'reveal':{const s=current();if(s.outcome)break;s.outcome='reveal';add(data.missed,s.ids[s.index]);save();quiz();break;}
    case 'advance':advance();break;
    case 'again':start(mode,true);break;
    case 'auto':data.auto=!data.auto;save();settings();break;
    case 'updates':notice='Checking GitHub…';settings();if(window.Borderfield)window.Borderfield.checkUpdates(true);else window.onUpdateStatus('Update checks are available in the Android app.');break;
  }
});
document.addEventListener('DOMContentLoaded',()=>{
  desk();
  if(data.auto&&window.Borderfield)window.Borderfield.checkUpdates(false);
});
