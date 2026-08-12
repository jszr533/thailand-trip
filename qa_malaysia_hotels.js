const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const vc = new VirtualConsole();
let errors = [];
vc.on('jsdomError', e => errors.push(String(e.message || e)));
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  virtualConsole: vc,
  beforeParse(window) {
    window.matchMedia = function () { return { matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }; };
    window.IntersectionObserver = function () { return { observe() {}, unobserve() {}, disconnect() {} }; };
    window.requestAnimationFrame = function (cb) { return setTimeout(cb, 0); };
    Object.defineProperty(window.navigator, 'serviceWorker', { value: { register() { return Promise.resolve(); } }, configurable: true });
    window.HTMLCanvasElement.prototype.getContext = function () { return {}; };
  }
});

function runTests(window) {
  const D = window.document;
  let fail = 0;
  function assert(cond, msg) {
    if (!cond) { console.log('FAIL: ' + msg); fail++; }
  }

  // 切换到马来西亚行程
  const malaysia = window.eval('TRIPS.find(t => t.id === "seed_malaysia_2026")');
  assert(!!malaysia, '找到马来西亚行程');
  if (!malaysia) { console.log('ERROR: 马来西亚行程缺失'); return 1; }

  window.eval('setActiveTrip("seed_malaysia_2026")');
  window.eval('setFlow("trip")');

  const days = window.eval('DAYS');
  assert(!!days && days.length === 7, '马来西亚行程有 7 天');

  const day1 = days.find(d => d.id === 'm1');
  const day2 = days.find(d => d.id === 'm2');
  const day3 = days.find(d => d.id === 'm3');
  const day4 = days.find(d => d.id === 'm4');
  const day5 = days.find(d => d.id === 'm5');
  const day6 = days.find(d => d.id === 'm6');

  // Day1 槟城酒店
  const d1Hotel = day1.spots.find(s => s.type === 'hotel');
  assert(!!d1Hotel, 'Day1 有酒店点');
  assert(/Citadines Connect Georgetown Penang/.test(d1Hotel.name), 'Day1 酒店名正确：' + d1Hotel.name);
  assert(/202 Lebuh Noordin/.test(d1Hotel.addr), 'Day1 酒店地址正确');
  assert(/住 2 晚/.test(d1Hotel.duration), 'Day1 酒店显示连住 2 晚');

  // Day2 续住
  const d2Hotel = day2.spots.find(s => s.type === 'hotel');
  assert(!!d2Hotel, 'Day2 有续住酒店点');
  assert(/续住.*Citadines/.test(d2Hotel.name), 'Day2 是续住 Citadines：' + d2Hotel.name);

  // Day3 古晋酒店
  const d3Hotel = day3.spots.find(s => s.type === 'hotel');
  assert(!!d3Hotel, 'Day3 有酒店点');
  assert(/Meritin Hotel/.test(d3Hotel.name), 'Day3 酒店名正确：' + d3Hotel.name);
  assert(/Lot 315, Jalan Padungan/.test(d3Hotel.addr), 'Day3 酒店地址正确');
  assert(/住 2 晚/.test(d3Hotel.duration), 'Day3 酒店显示连住 2 晚');

  // Day4 续住
  const d4Hotel = day4.spots.find(s => s.type === 'hotel');
  assert(!!d4Hotel, 'Day4 有续住酒店点');
  assert(/续住.*Meritin/.test(d4Hotel.name), 'Day4 是续住 Meritin：' + d4Hotel.name);

  // Day5 吉隆坡酒店
  const d5Hotel = day5.spots.find(s => s.type === 'hotel');
  assert(!!d5Hotel, 'Day5 有酒店点');
  assert(/AC Hotel by Marriott Kuala Lumpur/.test(d5Hotel.name), 'Day5 酒店名正确：' + d5Hotel.name);
  assert(/9 Jalan Lumut/.test(d5Hotel.addr), 'Day5 酒店地址正确');
  assert(/住 2 晚/.test(d5Hotel.duration), 'Day5 酒店显示连住 2 晚');

  // Day6 续住
  const d6Hotel = day6.spots.find(s => s.type === 'hotel');
  assert(!!d6Hotel, 'Day6 有续住酒店点');
  assert(/续住.*AC Hotel/.test(d6Hotel.name), 'Day6 是续住 AC Hotel：' + d6Hotel.name);

  // 旧占位文案不应再出现
  const allSpots = days.flatMap(d => d.spots);
  assert(!allSpots.some(s => /酒店待订/.test(s.notes || '')), '无“酒店待订”占位文案');
  assert(!allSpots.some(s => /可订 Hilton/.test(s.tips || '')), '无 Hilton 占位提示');

  // 运行时错误
  assert(errors.length === 0, '页面无运行时错误：' + errors.join('; '));

  if (fail === 0) {
    console.log('ALL PASS ✅ 马来西亚酒店已全部加入行程（0 运行时错误）');
    return 0;
  } else {
    console.log('FAILURES: ' + fail);
    return 1;
  }
}

setTimeout(() => {
  const code = runTests(dom.window);
  process.exit(code);
}, 400);
