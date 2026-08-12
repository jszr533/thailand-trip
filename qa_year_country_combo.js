// QA：年份筛选 与 国家筛选 共存（dangerously  harness，可读取输出）
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const vc = new VirtualConsole();
const errs = [];
vc.on('jsdomError', e => errs.push('jsdomError: ' + (e.detail ? (e.detail.stack || e.detail) : e.message)));
vc.on('error', (...a) => errs.push('console.error: ' + a.join(' ')));
const dom = new JSDOM(html, {
  runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(window) {
    window.matchMedia = () => ({ matches: false, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){} });
    window.IntersectionObserver = function(){ return { observe(){}, unobserve(){}, disconnect(){} }; };
    window.requestAnimationFrame = cb => setTimeout(cb, 0);
    Object.defineProperty(window.navigator, 'serviceWorker', { value: { register: () => Promise.resolve() }, configurable: true });
    window.HTMLCanvasElement.prototype.getContext = () => ({});
  }
});
let pass = 0, fail = 0;
function ok(n, c){ if(c){pass++;console.log('  ✅ '+n);}else{fail++;console.log('  ❌ '+n);} }
setTimeout(() => {
  const w = dom.window;
  ok('boot 无运行时错误', errs.length === 0);
  // 默认：年份=2026, 国家=泰国 → 1 个分组(泰国)
  const chips = w.document.getElementById('tripChips');
  ok('默认分组数=1(仅泰国)', chips.querySelectorAll('.trip-group').length === 1);
  // 点韩国 pill（国家筛选）
  w.setTripCountryFilter('韩国'); w.renderTripBar();
  const c2 = w.document.getElementById('tripChips');
  ok('选韩国后 分组数=1', c2.querySelectorAll('.trip-group').length === 1);
  ok('选韩国后 显示首尔、不含曼谷', /首尔/.test(c2.textContent) && !/曼谷|清迈/.test(c2.textContent));
  // 切回全部国家 + 年份 2026 → 3 个分组
  w.setTripCountryFilter('__all__'); w.renderTripBar();
  ok('全部国家(2026) 分组数=3', w.document.getElementById('tripChips').querySelectorAll('.trip-group').length === 3);
  // 注入 2025 韩国行程，验证年份×国家 AND
  w.createTrip(); const nt = w.currentTrip();
  nt.year = 2025; nt.status='active'; nt.title='韩2025'; nt.country='韩国'; nt.start='3.1'; nt.end='3.3';
  w.autoArchivePastYears();
  w.setTripYearFilter(2025); w.setTripCountryFilter('韩国'); w.renderTripBar();
  const c3 = w.document.getElementById('tripChips');
  ok('2025×韩国 → 仅韩2025(分组=1, 含韩2025)', c3.querySelectorAll('.trip-group').length===1 && /韩2025/.test(c3.textContent));
  ok('2025×韩国 → 不含 首尔(2026)', !/首尔/.test(c3.textContent));
  console.log('\n==== QA ' + (fail===0?'PASS ✅':'FAIL ❌') + ' ==== pass='+pass+' fail='+fail+' 运行时错误='+(errs.length?errs.length:'无'));
  process.exit(fail===0 && errs.length===0 ? 0 : 1);
}, 400);
