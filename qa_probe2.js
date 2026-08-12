const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('index.html', 'utf8');
const errors = [];
const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  beforeParse(window) {
    window.localStorage = { _d:{}, getItem(k){return this._d[k]||null;}, setItem(k,v){this._d[k]=String(v);}, removeItem(k){delete this._d[k];} };
    window.matchMedia = () => ({ matches:false, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){} });
    window.IntersectionObserver = class { observe(){} unobserve(){} disconnect(){} };
    window.requestAnimationFrame = (cb)=>setTimeout(cb,0);
    window.cancelAnimationFrame = ()=>{};
    if (window.navigator && window.navigator.serviceWorker) {} else {
      Object.defineProperty(window.navigator, 'serviceWorker', { value: { register:()=>Promise.resolve({scope:''}), addEventListener(){} }, configurable:true });
    }
    window.HTMLCanvasElement.prototype.getContext = () => ({ fillRect(){}, clearRect(){}, getImageData(){return {data:[]};}, putImageData(){}, createImageData(){return [];}, setTransform(){}, drawImage(){}, save(){}, restore(){}, beginPath(){}, moveTo(){}, lineTo(){}, closePath(){}, stroke(){}, translate(){}, scale(){}, rotate(){}, arc(){}, fill(){}, measureText(){return {width:0};}, transform(){}, rect(){}, clip(){} });
    window.console.error = (...a)=>errors.push('console.error: '+a.join(' '));
    window.addEventListener('error', e => errors.push('window.error: '+(e.error&&e.error.stack||e.message)));
    window.addEventListener('unhandledrejection', e => errors.push('unhandledrejection: '+(e.reason&&e.reason.stack||e.reason)));
  }
});
const { window } = dom;
const D = window.document;
function visibleText(sel){
  const el = D.querySelector(sel);
  return el ? el.textContent.replace(/\s+/g,' ').trim() : '(missing)';
}
function hasEntryNotice(sel){
  const el = D.querySelector(sel);
  if(!el) return false;
  return /入境须知|必带清单|交通须知/.test(el.textContent);
}

setTimeout(() => {
  try {
    console.log('=== 1) 初始足迹页 (flow-home) ===');
    console.log('  body class:', D.body.className);
    console.log('  足迹页可见文本:', visibleText('#pageHome').slice(0,200));
    console.log('  足迹页含入境须知?', hasEntryNotice('#pageHome'));

    console.log('=== 1.5) 足迹页搜索「曼谷」并点击结果 ===');
    if (window.homeSearch && D.getElementById('homeSearch')) {
      window.homeSearch('曼谷');
      const res = D.querySelectorAll('#homeSearchResults .home-search-res');
      console.log('  搜索结果数:', res.length);
      let clickedVisited = false;
      res.forEach(r => {
        if (r.className.includes('visited') && !clickedVisited) {
          console.log('  点击已去过的城市结果:', r.textContent.trim());
          r.click();
          clickedVisited = true;
        }
      });
      if (clickedVisited) {
        console.log('  -> body class:', D.body.className);
        console.log('  是否直达城市指南(pagePoints)?', D.body.className.includes('flow-points'), '(应为 false)');
        console.log('  是否去了城市页(flow-cities)?', D.body.className.includes('flow-cities'), '(应为 true)');
        window.setFlow('home');
      }
    }

    console.log('=== 2) 模拟点击足迹地图上第一个城市点 ===');
    const pts = D.querySelectorAll('#homeMapPoints .wm-pt');
    console.log('  地图城市点数:', pts.length);
    if (pts.length) {
      // 触发 mouseenter + click（地图点一般用 onclick 或事件）
      const ev = new window.Event('click', {bubbles:true});
      const first = pts[0];
      // 尝试 data-name 方式调用 openFlowCity
      const name = first.getAttribute('data-name');
      console.log('  点击城市:', name);
      if (window.openFlowCity) window.openFlowCity(name);
      console.log('  -> body class:', D.body.className);
      console.log('  当前是否在城市指南(pagePoints)?', D.body.className.includes('flow-points'));
      console.log('  城市指南含入境须知?', hasEntryNotice('#pagePoints'));
      console.log('  城市页(pageCities)含入境须知?', hasEntryNotice('#pageCities'));
    }

    console.log('=== 3) 从城市页点开一个城市(openCity)后 ===');
    if (window.openCity) {
      const c = window.aggregateCities && window.aggregateCities()[0];
      if (c) { window.openCity(c.name); }
      console.log('  -> body class:', D.body.className);
      console.log('  城市指南含入境须知?', hasEntryNotice('#pagePoints'));
    }

    console.log('=== 4) 回到足迹页，检查是否残留 ===');
    window.setFlow('home');
    console.log('  body class:', D.body.className);
    console.log('  足迹页含入境须知?', hasEntryNotice('#pageHome'));

    console.log('=== 运行时错误:', errors.length, '===');
    errors.slice(0,5).forEach(e=>console.log('  ', e));
  } catch(e) {
    console.log('PROBE ERROR:', e.stack);
  }
  process.exit(0);
}, 400);
