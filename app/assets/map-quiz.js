'use strict';

const mapRegions = regions.map(name => ({
  name,
  countries: ATLAS.filter(country => country.region === name)
}));
let mapScale = 1;

function startMap(freshRound) {
  if (!data.sessions.map || freshRound) {
    data.sessions.map = {named: []};
    save();
  }
  mapScale = 1;
  openScreen('map');
}

function worldDrawing(named) {
  function landClass(id) {
    return named.has(id) ? 'map-land is-named' : 'map-land';
  }
  const shapes = Object.keys(WORLD_MAP.countries).map(id =>
    '<path data-land="'+id+'" class="'+landClass(id)+'" d="'+WORLD_MAP.countries[id]+'"/>'
  ).join('');
  const markers = WORLD_MAP.small.map(id => {
    const [x,y] = WORLD_MAP.centers[id];
    return '<circle data-land="'+id+'" class="map-islet '+landClass(id)+'" cx="'+x+'" cy="'+y+'" r="2.1"/>';
  }).join('');
  return '<svg class="map-sheet" viewBox="0 0 1000 510" role="img" aria-label="World map showing countries named in this round">'+
    '<path class="map-sea" d="'+WORLD_MAP.frame+'"/><path class="map-grid" d="'+WORLD_MAP.grid+'"/>'+
    '<g fill-rule="evenodd" stroke-linejoin="round"><path class="map-other" d="'+WORLD_MAP.other+'"/>'+shapes+'</g>'+
    markers+'<g id="map-pin" visibility="hidden"><circle r="7.8" class="pin-ring"/><circle r="2.9" class="pin-dot"/></g></svg>';
}

function mapQuiz() {
  const ids = data.sessions.map.named;
  const regionRows = mapRegions.map((region,i) =>
    '<div class="map-region"><div class="between"><span>'+region.name+'</span><small id="region-count-'+i+'"></small></div>'+
    '<div class="meter"><i id="region-bar-'+i+'"></i></div></div>'
  ).join('');
  layout('<div class="map-heading"><h1 class="title" id="map-title">Fill the map.</h1>'+
    '<div class="map-tally"><strong id="map-count"></strong><span> / '+ATLAS.length+'</span><small>Countries named</small></div></div>'+
    '<p class="intro" id="map-instruction">Type countries in any order. Correct names fill the map automatically.</p>'+
    '<section class="world-plate" aria-label="Quiz map"><div class="map-window"><div class="map-scroll" id="map-scroll" tabindex="0" aria-label="Scrollable world map">'+
      worldDrawing(new Set(ids))+'</div></div>'+
      '<div class="map-tools"><div class="map-legend"><span><i></i>To name</span><span><i class="swatch-named"></i>Named</span><span><i class="swatch-other"></i>Other land</span></div>'+
      '<div class="map-zoom"><button data-act="zoom-out" aria-label="Zoom out" disabled>−</button><output id="map-scale">1×</output><button data-act="zoom-in" aria-label="Zoom in">+</button></div></div></section>'+
    '<form id="map-form" class="map-entry">'+icon('scope')+'<input id="map-guess" type="text" placeholder="Country name" aria-label="Country name" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="go">'+
    '</form>'+
    '<p id="map-message" class="map-message" role="status"></p>'+
    '<button class="cta wide" data-act="new-map" hidden>Start a new map '+icon('redo')+'</button>'+
    '<div class="subhead"><h2>By region</h2></div><div class="map-regions">'+regionRows+'</div>'+
    '<details id="map-index" class="map-index" hidden><summary>Countries named <span id="index-count"></span></summary><ul id="named-list"></ul></details>',
    null, context('Save & exit','World map quiz'), 'map-shell');
  updateMapProgress();
}

function updateMapProgress() {
  const ids = data.sessions.map.named;
  const named = new Set(ids);
  document.getElementById('map-count').textContent = ids.length;
  mapRegions.forEach((region,i) => {
    const total = region.countries.length;
    const found = region.countries.filter(country => named.has(country.id)).length;
    document.getElementById('region-count-'+i).textContent = found+' / '+total;
    document.getElementById('region-bar-'+i).style.width = (100*found/total)+'%';
  });
  if (ids.length) {
    const [x,y] = WORLD_MAP.centers[ids[ids.length-1]];
    const pin = document.getElementById('map-pin');
    pin.setAttribute('transform','translate('+x+' '+y+')');
    pin.setAttribute('visibility','visible');
    document.getElementById('map-index').hidden = false;
    document.getElementById('index-count').textContent = ids.length;
    document.getElementById('named-list').innerHTML = ids.slice().reverse().map(id =>
      '<li>'+escapeHtml(countries.get(id).name)+'</li>').join('');
  }
  if (ids.length === ATLAS.length) {
    document.getElementById('map-title').textContent = 'Map complete.';
    document.getElementById('map-instruction').textContent = 'You named all '+ATLAS.length+' countries.';
    document.getElementById('map-form').hidden = true;
    document.querySelector('[data-act="new-map"]').hidden = false;
  }
}

function submitMapCountry(automatic) {
  const ids = data.sessions.map.named;
  if (ids.length === ATLAS.length) return;
  const input = document.getElementById('map-guess');
  const message = document.getElementById('map-message');
  const guess = norm(input.value);
  if (!guess) { input.focus(); return; }
  const country = countriesByAnswer.get(guess);
  if (!country || ids.includes(country.id)) {
    message.textContent = country ? country.name+' is already on your map.' : 'No match. Check the spelling and try again.';
    message.className = 'map-message map-notice';
    input.focus();
    if (automatic && country) input.value = '';
    else input.select();
    return;
  }
  ids.push(country.id);
  add(data.known,country.id);
  if (ids.length === ATLAS.length) data.rounds++;
  save();
  document.querySelectorAll('[data-land="'+country.id+'"]').forEach(el => el.classList.add('is-named'));
  message.textContent = '✓ '+country.name+' added.';
  message.className = 'map-message map-success';
  input.value = '';
  updateMapProgress();
  if (ids.length < ATLAS.length) input.focus();
  else announce('Map complete. All '+ATLAS.length+' countries named.');
}

function zoomMap(factor) {
  const scroll = document.getElementById('map-scroll');
  const sheet = scroll.querySelector('svg');
  const scale = Math.max(1,Math.min(8,mapScale*factor));
  const ratio = scale/mapScale;
  const centerX = scroll.scrollLeft + scroll.clientWidth/2;
  const centerY = scroll.scrollTop + scroll.clientHeight/2;
  mapScale = scale;
  sheet.style.width = (100*scale)+'%';
  scroll.scrollLeft = centerX*ratio-scroll.clientWidth/2;
  scroll.scrollTop = centerY*ratio-scroll.clientHeight/2;
  scroll.classList.toggle('can-pan',scale>1);
  document.getElementById('map-scale').textContent = scale+'×';
  document.querySelector('[data-act="zoom-out"]').disabled = scale===1;
  document.querySelector('[data-act="zoom-in"]').disabled = scale===8;
}
