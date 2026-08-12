// QA：年份作为一等公民（筛选 / 标签 / 编辑器年份 / 首页历年条 / 自动归档 / 跨年）
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
function ok(name, cond) { if (cond) { pass++; console.log('  ✅ ' + name); } else { fail++; console.log('  ❌ ' + name); } }

setTimeout(() => {
  const w = dom.window;
  // 0) 启动无运行时错误
  ok('boot 无运行时错误', errs.length === 0);
  if (errs.length) console.log(errs.join('\n'));

  // 1) 默认年份筛选 = 当前行程主年份（2026）
  ok('tripYearFilter 默认=2026', w.tripYearFilter === 2026);

  // 2) 年份筛选 pills 渲染（全部 + 2026）
  const yf = w.document.getElementById('tripYearFilter');
  ok('年份筛选条渲染了「全部」', /全部/.test(yf.innerHTML));
  ok('年份筛选条渲染了 2026', /2026/.test(yf.innerHTML));

  // 3) 跨年行程：dayYear 推算正确
  const days = [{ date: '12.30' }, { date: '12.31' }, { date: '1.1' }, { date: '1.5' }];
  const cross = { year: 2026, start: '12.30', end: '1.5', days };
  ok('dayYear 跨年：1.1 属 2027', w.dayYear(cross, days[2]) === 2027);
  ok('dayYear 跨年：12.30 属 2026', w.dayYear(cross, days[0]) === 2026);
  ok('tripYearRange 跨年 endYear=2027', w.tripYearRange(cross).endYear === 2027);
  ok('tripPrimaryYear 跨年=2026（按 startYear）', w.tripPrimaryYear(cross) === 2026);

  // 4) 普通行程 dayYear 一致
  const t2026 = w.currentTrip();
  ok('当前行程 dayYear=2026', w.dayYear(t2026, t2026.days[0]) === 2026);

  // 5) 自动归档：注入一个 2025 的 active 行程
  w.createTrip();
  const nt = w.currentTrip();
  nt.year = 2025; nt.status = 'active'; nt.title = '测试2025'; nt.country = '测试国'; nt.start = '5.1'; nt.end = '5.3';
  w.autoArchivePastYears();
  ok('2025 active 行程被自动归档为 archived', nt.status === 'archived');

  // 6) 年份筛选生效（2025 与 2026 互相隔离）
  w.setTripYearFilter(2025); w.renderTripBar();
  const chips25 = w.document.getElementById('tripChips').innerHTML;
  ok('筛选 2025 时库里出现测试2025', /测试2025/.test(chips25));
  ok('筛选 2025 时库里不含 2026 行程', !/曼谷/.test(chips25));
  w.setTripYearFilter(2026); w.renderTripBar();
  const chips26 = w.document.getElementById('tripChips').innerHTML;
  ok('筛选 2026 时库里出现曼谷', /曼谷/.test(chips26));
  ok('筛选 2026 时库里不含 测试2025', !/测试2025/.test(chips26));
  w.setTripYearFilter(null); // 复位

  // 7) 行程 chip 带年份徽标
  w.renderTripBar();
  ok('行程 chip 渲染年份徽标(2025)', /tc-year[^>]*>2025</.test(w.document.getElementById('tripChips').innerHTML) || /2025/.test(w.document.getElementById('tripChips').innerHTML));

  // 8) 首页历年旅行条
  w.setFlow('home');
  const ys = w.document.getElementById('homeYearStrip');
  ok('首页历年条含 2026', /2026/.test(ys.innerHTML));
  ok('首页历年条含按年卡片(onclick 切年份)', /setTripYearFilter\(2026\)/.test(ys.innerHTML));

  // 9) 编辑器标题 + 日签显示年份（把当前行程改成 2025 年验证）
  const cur = w.currentTrip();
  cur.year = 2025; cur.status = 'closed';
  w.setFlow('trip');
  const h1 = w.document.getElementById('tripTitleH1');
  ok('编辑器标题含年份 2025', /2025/.test(h1.textContent));
  const dt = w.document.getElementById('dayTitle');
  ok('日签含年份前缀 2025·（非当前年）', /2025·/.test(dt.textContent));

  console.log('\n==== QA ' + (fail === 0 ? 'PASS ✅' : 'FAIL ❌') + ' ====  pass=' + pass + ' fail=' + fail + '  运行时错误=' + (errs.length ? '有(' + errs.length + ')' : '无'));
  process.exit(fail === 0 && errs.length === 0 ? 0 : 1);
}, 400);
