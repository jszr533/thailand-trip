// 深度交互 QA：扩展覆盖搜索/评价/推荐加入/行程编辑/城市钻取/地图点点击等路径
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
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  virtualConsole: vc,
  beforeParse(window) {
    window.onerror = (msg, src, line, col, err) => { errors.push('window.onerror: ' + msg + (err && err.stack ? '\n' + err.stack : '')); return false; };
    window.matchMedia = () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {} });
    window.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
    window.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
    window.cancelAnimationFrame = (id) => clearTimeout(id);
    if (!window.navigator.serviceWorker) Object.defineProperty(window.navigator, 'serviceWorker', { value: { register: () => Promise.resolve() }, configurable: true });
    stubCanvas(window);
    window.alert = () => {};
    window.confirm = () => true;  // 自动确认删除/归档
    window.prompt = () => null;
    window.addEventListener('unhandledrejection', e => errors.push('unhandledrejection: ' + (e.reason && e.reason.message ? e.reason.message : e.reason)));
  }
});

const { window } = dom;
const D = window.document;

function run() {
  const steps = [];
  function step(name, fn) {
    try { fn(); steps.push('✓ ' + name); }
    catch (e) { steps.push('✗ ' + name + ' -> ' + e.message); errors.push(name + ' threw: ' + e.stack); }
  }

  // ---- 基础导航 ----
  step('boot 初始化', () => { if (!/flow-\w+/.test(D.body.className)) throw new Error('无 flow class'); });
  step('setFlow(home)', () => window.setFlow('home'));

  // ---- 首页搜索 ----
  step('homeSearch(曼谷) 命中', () => {
    window.homeSearch('曼谷');
    const r = D.getElementById('homeSearchResults');
    if (!r || !r.children.length) throw new Error('搜索「曼谷」无结果');
  });
  step('homeSearch(xyz随机) 空结果不崩', () => { window.homeSearch('zxywq123'); const r = D.getElementById('homeSearchResults'); if (!r) throw new Error('无结果容器'); });
  step('homeSearch 清空', () => { window.homeSearch(''); const r = D.getElementById('homeSearchResults'); if (r.innerHTML !== '') throw new Error('清空失败'); });

  // ---- 城市钻取 ----
  step('renderHomeDrill 大洲钻取', () => {
    // 直接调用内部需经 DOM；通过点击 drill 元素模拟
    window.setFlow('cities');
    const cont = D.querySelector('#homeDrillBody .drill-cont');
    if (cont) cont.click();
    else if (!D.getElementById('homeDrillBody')) throw new Error('homeDrillBody 缺失');
  });
  step('城市库渲染 homeVisited', () => { const v = D.getElementById('homeVisited'); if (!v || !v.children.length) throw new Error('城市库空'); });

  // ---- 城市指南 + 行程点库 ----
  step('openCity(曼谷)', () => { window.openCity('曼谷'); });
  step('城市指南入境须知有内容', () => { const e = D.getElementById('cityEntryBody'); if (!e || !e.innerHTML.trim()) throw new Error('cityEntryBody 空'); });
  step('城市交通须知有内容', () => { const e = D.getElementById('cityTransitBody'); if (!e || !e.innerHTML.trim()) throw new Error('cityTransitBody 空'); });
  step('setFlow(points) 行程点库渲染', () => { window.setFlow('points'); const b = D.getElementById('pointsBody'); if (!b || !b.children.length) throw new Error('pointsBody 空'); });

  // ---- 库搜索 + 首字母筛选 ----
  step('库搜索 setPointsQuery + renderPointsList', () => {
    window.pointsQuery = '大'; window.renderPointsList();
    const b = D.getElementById('pointsBody'); if (!b || !b.children.length) throw new Error('筛选「大」无结果');
  });
  step('库首字母筛选 setPointsLetter(全部)', () => { window.pointsQuery = ''; window.setPointsLetter(''); window.renderPointsList(); const b = D.getElementById('pointsBody'); if (!b) throw new Error('pointsBody 缺失'); });
  // 取索引栏里第一个真实字母来点
  step('库首字母筛选 取一个真实字母', () => {
    const idx = D.querySelector('#pointsBody .pt-index .pt-idx');
    let letter = '';
    D.querySelectorAll('#pointsBody .pt-index .pt-idx').forEach(el => { const t = el.textContent.trim(); if (!letter && t !== '全部' && t !== '#') letter = t; });
    if (letter) { window.setPointsLetter(letter); window.renderPointsList(); }
  });

  // ---- 评价流程 ----
  step('openReviewModal(曼谷, 大皇宫)', () => { window.openReviewModal('曼谷', '大皇宫'); });
  step('setReviewStar(4)', () => { window.setReviewStar(4); });
  step('saveReview 保存评价', () => { window.saveReview(); });
  step('评价后 refreshReviewHost 不崩', () => { const b = D.getElementById('pointsBody'); if (!b) throw new Error('pointsBody 缺失'); });
  step('openReviewModal 再次打开看评价列表', () => { window.openReviewModal('曼谷', '大皇宫'); window.setFlow('points'); });
  step('toggleReviews 展开/收起', () => {
    window.renderReviewStars();
    const revs = D.querySelectorAll('#pointsBody .poi-reviews .rev-list, #pointsBody [id^="rev-"]');
    // 直接调一个已知 hk
    const el = D.querySelector('#pointsBody [id^="rev-"]');
    if (el) window.toggleReviews(el.id.replace('rev-', ''));
  });
  step('deleteReview 删除第一条', () => {
    const k = window.reviewKey('曼谷', '大皇宫');
    const arr = window.SPOT_REVIEWS && window.SPOT_REVIEWS[k];
    if (arr && arr.length) window.deleteReview('曼谷', '大皇宫', 0);
  });

  // ---- 推荐加入行程 ----
  step('openRecs(曼谷)', () => { window.openRecs('曼谷'); });
  step('togglePoi 加入一个推荐点', () => {
    const btn = D.querySelector('#recBody .poi-row .poi-add');
    if (btn) btn.click(); else throw new Error('无 poi-add 按钮');
  });
  step('togglePoi 再点移除（来回切换）', () => {
    const btn = D.querySelector('#recBody .poi-row .poi-add');
    if (btn) btn.click();
  });
  step('closeRecs', () => { window.closeRecs && window.closeRecs(); });

  // ---- 行程编辑 ----（TRIPS/DAYS 是 const/let，未挂 window，用 window.eval 在页面作用域取真实值）
  const firstTripId = window.eval('(TRIPS && TRIPS[0] && TRIPS[0].id) || null');
  const firstSpotId = window.eval('(function(){var s=null; DAYS.forEach(function(d){(d.spots||[]).forEach(function(x){if(!s)s=x.id;});}); return s;})()');
  step('setActiveTrip 切换行程', () => { if (firstTripId) window.setActiveTrip(firstTripId); });
  step('editTripMeta 打开编辑', () => { if (firstTripId) window.editTripMeta(firstTripId); });
  step('saveTripMetaFromForm 保存', () => {
    const idEl = D.getElementById('mtId'); if (!idEl || !idEl.value) throw new Error('mtId 未填');
    window.saveTripMetaFromForm();
  });
  step('closeTrip 归档', () => { if (firstTripId) window.closeTrip(firstTripId); });
  step('reopenTrip 取消归档', () => { if (firstTripId) window.reopenTrip(firstTripId); });

  // ---- 行程编辑器：勾选/取消 spot ----
  step('renderSpotList 渲染行程', () => { window.renderSpotList && window.renderSpotList(); });
  step('toggleSpot 勾选第一个 spot', () => {
    if (!firstSpotId) throw new Error('无 spot 可勾选');
    window.toggleSpot(firstSpotId, true);
  });
  step('toggleSpot 取消勾选', () => {
    if (!firstSpotId) throw new Error('无 spot 可勾选');
    window.toggleSpot(firstSpotId, false);
  });

  // ---- 地图点点击 -> openFlowCity ----
  step('openFlowCity(清迈)', () => { window.openFlowCity('清迈'); window.setFlow('points'); });
  step('openCity(清迈) 交通须知', () => {
    window.openCity('清迈'); window.setFlow('points');
    const e = D.getElementById('cityTransitBody'); if (!e || !e.innerHTML.trim()) throw new Error('清迈交通须知空');
  });

  // ---- 回首页再走一遍确认无残留错误 ----
  step('setFlow(home) 收尾', () => { window.setFlow('home'); });

  console.log('==== 深度交互 QA ====');
  steps.forEach(s => console.log(s));
  console.log('==== 运行时错误 (' + errors.length + ') ====');
  errors.forEach(e => console.log('• ' + e));
  console.log(errors.length ? 'QA FAILED (' + errors.length + ' 错误)' : 'QA PASSED (无运行时错误)');
  process.exit(errors.length ? 1 : 0);
}

if (window.document.readyState === 'complete') setTimeout(run, 400);
else window.addEventListener('load', () => setTimeout(run, 400));
setTimeout(() => { console.log('TIMEOUT'); errors.forEach(e => console.log('• ' + e)); process.exit(1); }, 20000);
