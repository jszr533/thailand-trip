// 复现：点击首尔行程后，渲染内容是否仍是泰国
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync('index.html', 'utf8');

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push('jsdomError: ' + (e.detail ? (e.detail.stack || e.detail.message) : e.message)));
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));

function stubCanvas(window) {
  const noop = () => {};
  window.HTMLCanvasElement.prototype.getContext = function () {
    return new Proxy({}, { get: (t, p) => {
      if (p === 'createLinearGradient' || p === 'createRadialGradient') return () => ({ addColorStop: noop });
      if (p === 'getImageData') return () => ({ data: [] });
      if (p === 'measureText') return () => ({ width: 0 });
      return noop;
    }});
  };
}

const dom = new JSDOM(html, {
  runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(window) {
    window.onerror = (msg, src, line, col, err) => { errors.push('window.onerror: ' + msg); return false; };
    window.matchMedia = () => ({ matches:false, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){} });
    window.IntersectionObserver = class { observe(){} unobserve(){} disconnect(){} };
    window.requestAnimationFrame = cb => setTimeout(()=>cb(Date.now()),0);
    window.cancelAnimationFrame = id => clearTimeout(id);
    if (!window.navigator.serviceWorker) Object.defineProperty(window.navigator, 'serviceWorker', { value:{ register: () => Promise.resolve() }, configurable:true });
    stubCanvas(window);
    window.alert = ()=>{}; window.confom = ()=>true; window.confirm = ()=>true; window.prompt = ()=>null;
    window.addEventListener('unhandledrejection', e => errors.push('unhandledrejection: ' + (e.reason && e.reason.message ? e.reason.message : e.reason)));
  }
});
const { window } = dom;
const D = window.document;

// 让 loadAllTrips 走「已有 localStorage = 仅泰国」的场景，模拟老用户
function summarize(label){
  const title = (D.getElementById('tripTitleH1')||{}).textContent || '(无)';
  const sub = (D.getElementById('tripSubtitle')||{}).textContent || '';
  // 抓行程编辑器里出现的第一个 spot 名
  const firstSpot = D.querySelector('#spotList .spot-name, #editor .spot-name, .day-card .spot-name');
  const spotTxt = firstSpot ? firstSpot.textContent : '(无 spot 渲染)';
  console.log(`[${label}] 标题="${title}" | 副标="${sub}" | 首spot="${spotTxt}"`);
}

// 列出当前所有 trip 与 active
const info = window.eval(`(function(){
  return {
    trips: (TRIPS||[]).map(t=>({id:t.id,title:t.title,city:t.city})),
    active: activeTripId,
    dayCount: (DAYS||[]).length,
    firstDayTitle: (DAYS&&DAYS[0])?DAYS[0].title:null
  };
})()`);
console.log('启动后 TRIPS:'); console.log(JSON.stringify(info,null,2));

// 找首尔 trip id
const seoulId = window.eval(`(TRIPS||[]).find(t=>/首尔/.test(t.title||'')) ? (TRIPS.find(t=>/首尔/.test(t.title||'')).id) : null`);
console.log('首尔 trip id =', seoulId);

window.setFlow('trip');

// 模拟真实用户操作：1) 收起态下是否只看到当前行程；2) 点「全部」展开；3) 点首尔 chip
function chipCount(){ return D.querySelectorAll('#tripChips .trip-chip:not(.tc-toggle)').length; }
function seoulChip(){ return Array.from(D.querySelectorAll('#tripChips .trip-chip')).find(b => /首尔/.test(b.textContent)); }
function toggleBtn(){ return D.querySelector('#tripChips .trip-chip.tc-toggle'); }

console.log('初始(收起) chip 数 =', chipCount(), '| 有首尔chip?', !!seoulChip());
// 展开
const tb = toggleBtn();
if (tb) tb.click();
console.log('展开后 chip 数 =', chipCount(), '| 有首尔chip?', !!seoulChip());

// 真实点击首尔 chip
const sc = seoulChip();
console.log('点击首尔 chip 前 title =', (D.getElementById('tripTitleH1')||{}).textContent);
if (sc) sc.click(); else console.log('!! 找不到首尔 chip 无法点击');

// 检查渲染的 day 标题里是否含 Seoul 特征（明洞/景福宫/北村）而非泰国特征（大皇宫/塔佩门）
const editorHtml = D.getElementById('editor') ? D.getElementById('editor').innerHTML : (D.getElementById('spotList')?D.getElementById('spotList').innerHTML:'');
const hasSeoul = /明洞|景福宫|北村|弘大|东大门|N首尔|清溪川|仁寺洞/.test(editorHtml);
const hasThai = /大皇宫|塔佩门|素贴山|恰图恰|考山路|郑王庙|瓦洛洛/.test(editorHtml);
console.log('渲染内容含首尔特征:', hasSeoul, '| 含泰国特征:', hasThai);

// 再确认 activeTrip 确实是首尔
const after = window.eval(`(function(){var t=(TRIPS||[]).find(x=>x.id===activeTripId);return {active:activeTripId, title:(t&&t.title)||null, dayCount:(DAYS||[]).length, firstDay:(DAYS&&DAYS[0])?DAYS[0].title:null};})()`);
console.log('setActiveTrip 后状态:', JSON.stringify(after));

// ===== 额外复现：通过「世界地图 dot」点 首尔，看用户实际看到什么 =====
console.log('\n===== 路径B：世界地图点 首尔 =====');
window.openWorldMap();
const wmDot = Array.from(D.querySelectorAll('#wmPoints .wm-pt')).find(g => g.dataset.name === '首尔');
console.log('世界地图有 首尔 dot?', !!wmDot, '| 点击它...');
if (wmDot) wmDot.dispatchEvent(new window.Event('click', { bubbles: true }));
console.log('点击后 currentFlow =', window.eval('currentFlow'));
console.log('点击后 标题 =', (D.getElementById('tripTitleH1')||{}).textContent, '| 副标 =', (D.getElementById('tripSubtitle')||{}).textContent);
// 验证修复：现在应直接打开首尔「行程」而非城市库
console.log('  → 修复判定(应打开首尔行程):', window.eval('currentFlow')==='trip' && /首尔/.test((document.getElementById("tripTitleH1")||{}).textContent||'') ? '✅ 已打开首尔行程' : '❌ 未打开首尔行程');

console.log('\n===== 路径C：世界地图层级列表点 首尔 =====');
window.openWorldMap();
const wmCity = Array.from(D.querySelectorAll('#worldHierarchy .wm-city')).find(el => el.dataset.name === '首尔');
console.log('层级列表有 首尔?', !!wmCity);
if (wmCity) wmCity.dispatchEvent(new window.Event('click', { bubbles: true }));
console.log('点击后 currentFlow =', window.eval('currentFlow'), '| 标题 =', (D.getElementById('tripTitleH1')||{}).textContent);
console.log('  → 修复判定:', window.eval('currentFlow')==='trip' ? '✅ 已打开行程' : '❌ 未打开行程');

console.log('\n运行时错误:', errors.length ? errors.join('\n') : '无');

// ===== 路径E：在城市库点 首尔 → 城市指南内容是否变成泰国？ =====
console.log('\n===== 路径E：openCity(首尔) 城市指南内容 =====');
window.openCity('首尔');
const pb = D.getElementById('pointsBody');
const korean = /景福宫|明洞|北村|东大门|仁寺洞|N首尔塔|弘大|清溪川|韩屋/.test(pb ? pb.innerHTML : '');
const thai = /大皇宫|塔佩门|素贴山|恰图恰|考山路|郑王庙|瓦洛洛|娘惹/.test(pb ? pb.innerHTML : '');
console.log('pointsCity =', window.eval('pointsCity'));
console.log('城市指南含韩国特征:', korean, '| 含泰国特征:', thai);
console.log('pointsBody 首屏文本片段:', pb ? pb.textContent.slice(0, 80) : '(空)');

