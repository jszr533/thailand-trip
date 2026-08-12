// 验证 #1 修复：公开部署（非 localhost、无 ?code=、无本地 sync_code）时默认不自动同步
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync('index.html', 'utf8');
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push('jsdomError: ' + (e.detail ? (e.detail.stack || e.detail.message) : e.message)));
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));
const dom = new JSDOM(html, {
  runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
  url: 'https://jszr533.github.io/thailand-trip/',  // 模拟公开部署
  beforeParse(window) {
    // 干净 localStorage（无 sync_code）
    window.localStorage = { _d:{}, getItem(k){return this._d[k]||null;}, setItem(k,v){this._d[k]=String(v);}, removeItem(k){delete this._d[k];} };
    window.matchMedia = () => ({ matches:false, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){} });
    window.IntersectionObserver = class { observe(){} unobserve(){} disconnect(){} };
    window.requestAnimationFrame = cb => setTimeout(()=>cb(Date.now()),0);
    window.cancelAnimationFrame = id => clearTimeout(id);
    if (!window.navigator.serviceWorker) Object.defineProperty(window.navigator, 'serviceWorker', { value:{ register: () => Promise.resolve({scope:''}) }, configurable:true });
    window.HTMLCanvasElement.prototype.getContext = function(){ return new Proxy({},{get:(t,p)=>{ if(p==='createLinearGradient'||p==='createRadialGradient') return ()=>({addColorStop(){}}); if(p==='getImageData') return ()=>({data:[]}); if(p==='measureText') return ()=>({width:0}); return ()=>{}; }}); };
    window.alert = ()=>{}; window.confirm = ()=>true; window.prompt = ()=>null;
    window.fetch = () => Promise.resolve({ ok:false, status:404, json:()=>Promise.resolve({}) });
    window.addEventListener('unhandledrejection', e => errors.push('unhandledrejection: ' + (e.reason && e.reason.message ? e.reason.message : e.reason)));
  }
});
const { window } = dom;
const D = window.document;
setTimeout(() => {
  const out = [];
  const code = window.eval('typeof tripCode!=="undefined"?tripCode:undefined');
  const enBtn = D.getElementById('syncEnableBtn');
  const ind = D.getElementById('syncIndicator');
  out.push('公开部署下默认 tripCode = ' + code + ' （期望 null）');
  out.push('开启同步按钮 display = ' + (enBtn ? enBtn.style.display || '(空=可见)' : 'MISSING') + ' （期望可见）');
  out.push('同步指示 display = ' + (ind ? ind.style.display : 'MISSING') + ' （期望 none）');
  const pass1 = (code === null) && enBtn && (enBtn.style.display !== 'none') && ind && ind.style.display === 'none';

  // 模拟用户点击「开启同步」
  try { window.createTripCode(); } catch(e){ errors.push('createTripCode threw: '+e.message); }
  const code2 = window.eval('typeof tripCode!=="undefined"?tripCode:undefined');
  out.push('点击开启同步后 tripCode = ' + code2 + ' （期望 TRIP-XXXXXX）');
  const pass2 = typeof code2 === 'string' && /^TRIP-[A-Z0-9]{6}$/.test(code2);

  console.log('==== #1 同步默认码修复验证 ====');
  out.forEach(l=>console.log('  '+l));
  console.log('运行时错误: ' + (errors.length?errors.join('\n  '):'无'));
  const ok = pass1 && pass2 && errors.length===0;
  console.log(ok ? '✅ PASS：默认不污染 + 可显式开启随机同步' : '❌ FAIL');
  process.exit(ok?0:1);
}, 600);
