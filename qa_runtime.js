// 真机运行时 QA：用 jsdom 加载页面，stub 浏览器 API，模拟串联导航，捕获运行时报错
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');

const html = fs.readFileSync('index.html', 'utf8');

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push('jsdomError: ' + (e.detail ? (e.detail.stack || e.detail.message) : e.message)));
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));

function stubCanvas(window) {
  const noop = () => {};
  const ctx = new Proxy({}, { get: () => () => ({}) });
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
    // 静默未捕获 promise rejection
    window.addEventListener('unhandledrejection', e => errors.push('unhandledrejection: ' + (e.reason && e.reason.message ? e.reason.message : e.reason)));
  }
});

const { window } = dom;

function run() {
  const steps = [];
  function step(name, fn) {
    try {
      fn();
      steps.push('✓ ' + name);
    } catch (e) {
      steps.push('✗ ' + name + ' -> ' + e.message);
      errors.push(name + ' threw: ' + e.stack);
    }
  }

  step('boot/初始化已执行 (body 有 flow class)', () => {
    if (!/flow-\w+/.test(window.document.body.className)) throw new Error('body 没有 flow-* class: ' + window.document.body.className);
  });
  step('首页 pageHome 可见', () => {
    const el = window.document.getElementById('pageHome');
    if (!el) throw new Error('pageHome 不存在');
  });
  step('城市页 行程模块框已移除', () => {
    if (window.document.querySelector('.city-module')) throw new Error('仍存在 .city-module 框');
  });
  step('setFlow(cities)', () => window.setFlow('cities'));
  step('城市页 pageCities 可见', () => { if (!window.document.getElementById('pageCities')) throw new Error('pageCities 缺失'); });
  step('城市库渲染 (homeVisited 有内容)', () => {
    const v = window.document.getElementById('homeVisited');
    if (!v || !v.children.length) throw new Error('homeVisited 空');
  });
  step('openCity(曼谷) -> 城市指南', () => { window.openCity && window.openCity('曼谷'); });
  step('setFlow(points) 城市指南有入境须知', () => {
    window.setFlow('points');
    const e = window.document.getElementById('cityEntryBody');
    if (!e || !e.innerHTML.trim()) throw new Error('cityEntryBody 空');
  });
  step('setFlow(trip) 我的行程可打开', () => { window.setFlow('trip'); });
  step('setFlow(home) 回到首页', () => { window.setFlow('home'); });

  console.log('==== 导航模拟 ====');
  steps.forEach(s => console.log(s));
  console.log('==== 运行时错误 (' + errors.length + ') ====');
  errors.forEach(e => console.log('• ' + e));
  console.log(errors.length ? 'QA FAILED' : 'QA PASSED (无运行时错误)');
  process.exit(0);
}

// 等待 DOMContentLoaded + 初始化完成
if (window.document.readyState === 'complete') setTimeout(run, 300);
else window.addEventListener('load', () => setTimeout(run, 300));
setTimeout(() => { console.log('TIMEOUT'); errors.forEach(e => console.log('• ' + e)); process.exit(1); }, 15000);
