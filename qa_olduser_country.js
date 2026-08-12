// 验证：老用户（localStorage 旧行程、无 country 字段）打开后，
//       入境须知 / 公共交通是否按城市反推出正确国家并显示。
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');

let html = fs.readFileSync('index.html', 'utf8');

// 构造“旧版”localStorage：三套行程都缺 country 字段
const oldData = {
  active: 'oldt',
  trips: [
    { id: 'oldt', title: '曼谷 · 清迈 双城旅行', city: '泰国',
      days: [ { id: 'd1', city: 'bangkok', spots: [] } ] },
    { id: 'olds', title: '首尔 · 圣诞周末', city: '首尔',
      days: [ { id: 's1', city: 'seoul', spots: [] } ] },
    { id: 'oldm', title: '马来西亚线', city: '马来西亚',
      days: [ { id: 'm1', city: 'penang', spots: [] } ] }
  ]
};
const prefill = '<script>localStorage.setItem("trips_v1", ' + JSON.stringify(JSON.stringify(oldData)) + ');</script>';

// 在 </head> 前注入预置脚本（早于主应用脚本执行）
html = html.replace('</head>', prefill + '</head>');

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push('jsdomError: ' + (e.detail ? (e.detail.stack || e.detail.message) : e.message)));
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  virtualConsole: vc,
  url: 'https://x.test/',
  beforeParse(window) {
    window.onerror = (msg) => { errors.push('window.onerror: ' + msg); return false; };
    window.matchMedia = () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {} });
    window.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
    window.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
    window.cancelAnimationFrame = (id) => clearTimeout(id);
    if (!window.navigator.serviceWorker) Object.defineProperty(window.navigator, 'serviceWorker', { value: { register: () => Promise.resolve() }, configurable: true });
    window.HTMLCanvasElement.prototype.getContext = function () { return new Proxy({}, { get: () => () => ({}) }); };
  }
});
const { window } = dom;
const D = window.document;

let ok = true;
function check(tripId, expectCountry, marker){
  window.setActiveTrip(tripId);
  const country = window.eval('(currentTrip()||{}).country');
  const entry = (D.getElementById('tripEntryBody')||{}).textContent || '';
  const title = (D.getElementById('tripTransitTitle')||{}).textContent || '';
  const pass = country === expectCountry && entry.indexOf(marker) >= 0;
  if (!pass) ok = false;
  console.log((pass ? '✓ ' : '✗ ') + tripId + ' → country=' + country + '（期望 ' + expectCountry + '）| 入境含「' + marker + '」| 交通标题「' + title + '」');
}
console.log('=== 模拟老用户（localStorage 旧行程无 country）===');
check('oldt', '泰国', '永久互免签证');
check('olds', '韩国', 'K-ETA');
check('oldm', '马来西亚', 'MDAC');
console.log('运行时错误:', errors.length ? errors.join(' | ') : '无');
console.log(ok && !errors.length ? 'PASS ✅ 旧行程已按城市反推国家，指南正确显示' : 'FAIL ❌ 仍有行程未正确识别国家');
process.exit(ok && !errors.length ? 0 : 1);
