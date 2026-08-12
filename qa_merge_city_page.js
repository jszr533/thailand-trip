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
const doc = window.document;

setTimeout(() => {
  if (captured.length) { console.log('BOOT ERRORS:\n' + captured.join('\n')); process.exit(1); }
  const errors = [];
  function assert(cond, label){ console.log((cond?'PASS':'FAIL')+': '+label); if(!cond) errors.push(label); }

  // 1) nav 只剩 3 个 tab，行程点已移除
  const navBtns = doc.querySelectorAll('#flowNav .flow-step');
  const navIds = Array.from(navBtns).map(b=>b.id);
  assert(navBtns.length===3, '导航只有 3 个 tab（首页/城市/我的行程），实际='+navIds.join(','));
  assert(!doc.getElementById('navPoints'), 'navPoints 已移除');

  // 2) 点「城市」→ 显示城市库列表（hub），详情隐藏
  doc.getElementById('navCities').click();
  const hub = doc.getElementById('cityHub');
  const det = doc.getElementById('cityDetail');
  assert(doc.body.classList.contains('flow-cities'), '进入城市页 flow-cities');
  assert(hub.style.display !== 'none', '城市库列表(hub)可见');
  assert(det.style.display === 'none', '城市详情(detail)隐藏（未选城市）');

  // 3) 点一个「去过的城市」卡 → 进入该城详情，hub 隐藏，详情含指南+推荐点
  const card = doc.querySelector('#homeVisited .home-city-card.visited');
  assert(!!card, '存在「去过的城市」卡片');
  const cityName = card.querySelector('.hc-name').textContent;
  card.click();
  assert(det.style.display !== 'none', '点城市后详情(detail)可见');
  assert(hub.style.display === 'none', '点城市后列表(hub)隐藏');
  assert(doc.getElementById('pointsCityName').textContent === cityName, '详情标题显示城市名：'+cityName);
  assert(doc.getElementById('pointsBody').children.length > 0, '推荐点库有内容（'+doc.getElementById('pointsBody').children.length+' 项）');
  assert(doc.getElementById('cityEntryBody').innerHTML.length > 0, '入境须知已渲染');
  assert(doc.getElementById('cityTransitBody').innerHTML.length > 0, '交通须知已渲染');

  // 4) 点「返回城市列表」→ 回到 hub
  doc.querySelector('#cityDetail button[onclick^="backToCityHub"]').click();
  assert(hub.style.display !== 'none', '返回后 hub 可见');
  assert(det.style.display === 'none', '返回后 detail 隐藏');

  // 5) 再次进详情后，从顶部「城市」导航应回到 hub（不是停在详情）
  doc.querySelector('#homeVisited .home-city-card.visited').click();
  assert(det.style.display !== 'none', '再次进入详情 OK');
  doc.getElementById('navCities').click();
  assert(hub.style.display !== 'none' && det.style.display === 'none', '顶部「城市」导航回到列表（清除了选中城市）');

  if (errors.length) { console.log('\nFAILURES:\n' + errors.join('\n')); process.exit(1); }
  console.log('\nALL PASS');
  process.exit(0);
}, 300);
