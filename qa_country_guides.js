// 验证：入境须知/公共交通/时间提醒 是否按当前行程国家切换
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');

const html = fs.readFileSync('index.html', 'utf8');
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

function summary(label){
  const country = window.eval('(currentTrip()||{}).country');
  const title = (D.getElementById('tripTransitTitle')||{}).textContent;
  const entry = (D.getElementById('tripEntryBody')||{}).textContent || '';
  const time = (D.getElementById('tripTimeBody')||{}).textContent || '';
  console.log('=== ' + label + ' ===');
  console.log('  currentTrip().country =', country);
  console.log('  公共交通标题         =', title);
  console.log('  入境须知含关键词?     =', /免签|MDAC|K-ETA|Q-CODE/.test(entry) ? '有' : '无', '| 长度', entry.length);
  console.log('  时间提醒卡片数       =', D.querySelectorAll('#tripTimeBody > div').length);
  console.log('');
}

// 断言：逐个切换，验证各国专属内容出现
let ok = true;
const checks = [
  ['seed_thai_2026', '永久互免签证', '曼谷/清迈 公共交通指南'],
  ['seed_seoul_xmas_2026', 'K-ETA', '首尔 公共交通指南'],
  ['seed_malaysia_2026', 'MDAC', '槟城/古晋/吉隆坡 公共交通指南']
];
checks.forEach(function(c){
  window.setActiveTrip(c[0]);
  const entry = D.getElementById('tripEntryBody').textContent || '';
  const title = D.getElementById('tripTransitTitle').textContent || '';
  const pass = entry.indexOf(c[1]) >= 0 && title === c[2];
  if (!pass) ok = false;
  console.log((pass ? '✓ ' : '✗ ') + c[0] + ' → 入境含「' + c[1] + '」且交通标题「' + c[2] + '」');
});
console.log('运行时错误:', errors.length ? errors.join(' | ') : '无');
console.log(ok && !errors.length ? 'PASS ✅ 三套行程指南均按国家正确切换' : 'FAIL ❌ 指南未正确切换');
process.exit(ok && !errors.length ? 0 : 1);
