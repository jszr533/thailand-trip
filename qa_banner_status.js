const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
const vc = new VirtualConsole();
let captured = [];
vc.on('jsdomError', e => captured.push('jsdomError: ' + (e.detail ? (e.detail.stack || e.detail) : e.message)));

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  virtualConsole: vc,
  beforeParse(window) {
    window.matchMedia = function(){ return { matches:false, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){} }; };
    window.IntersectionObserver = function(){ return { observe(){}, unobserve(){}, disconnect(){} }; };
    window.requestAnimationFrame = function(cb){ return setTimeout(cb,0); };
    Object.defineProperty(window.navigator, 'serviceWorker', { value:{ register:function(){ return Promise.resolve(); } }, configurable:true });
    window.HTMLCanvasElement.prototype.getContext = function(){ return {}; };
  }
});
const { window } = dom;

setTimeout(() => {
  if (captured.length) { console.log('BOOT ERRORS:\n' + captured.join('\n')); process.exit(1); }
  const errors = [];
  function setTripAndCheck(id, expectContains, label){
    window.eval("setActiveTrip('" + id + "'); renderNowBanner();");
    const txt = window.document.getElementById('nowBannerText').textContent;
    const shown = window.document.getElementById('nowBanner').className.includes('show');
    const ok = txt.includes(expectContains);
    console.log(`[${label}] active=${id} shown=${shown} text="${txt}" => ${ok ? 'PASS' : 'FAIL'}`);
    if(!ok) errors.push(label + ' banner wrong: ' + txt);
  }
  setTripAndCheck('seed_seoul_xmas_2026', '尚未开始', 'Korea(upcoming 12.25)');
  setTripAndCheck('seed_malaysia_2026', '尚未开始', 'Malaysia(upcoming 10.2)');
  const thaiId = window.eval("TRIPS.find(t=>t.title.indexOf('曼谷')>=0).id");
  setTripAndCheck(thaiId, '已结束', 'Thailand(closed, ended 8.5)');
  if (errors.length) { console.log('\nFAILURES:\n' + errors.join('\n')); process.exit(1); }
  console.log('\nALL PASS');
}, 300);
