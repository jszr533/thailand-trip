// 验证：A. 主题三态（亮/暗/跟随系统）；#3 马来西亚营业时间边界修正
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync('index.html', 'utf8');
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push('jsdomError: ' + (e.detail ? (e.detail.stack || e.detail.message) : e.message)));
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));
const dom = new JSDOM(html, {
  runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
  url: 'https://jszr533.github.io/thailand-trip/',
  beforeParse(window) {
    window.localStorage = { _d:{}, getItem(k){return this._d[k]||null;}, setItem(k,v){this._d[k]=String(v);}, removeItem(k){delete this._d[k];} };
    window.matchMedia = () => ({ matches:true, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){} });
    window.IntersectionObserver = class { observe(){} unobserve(){} disconnect(){} };
    window.requestAnimationFrame = cb => setTimeout(()=>cb(Date.now()),0);
    window.cancelAnimationFrame = id => clearTimeout(id);
    if (!window.navigator.serviceWorker) Object.defineProperty(window.navigator, 'serviceWorker', { value:{ register: () => Promise.resolve({scope:''}) }, configurable:true });
    window.HTMLCanvasElement.prototype.getContext = function(){ return new Proxy({},{get:(t,p)=>{ if(p==='createLinearGradient'||p==='createRadialGradient') return ()=>({addColorStop(){}}); if(p==='getImageData') return ()=>({data:[]}); if(p==='measureText') return ()=>({width:0}); return ()=>{}; }}); };
    window.alert = ()=>{}; window.confirm = ()=>true; window.prompt = ()=>null;
    window.fetch = () => Promise.resolve({ ok:false, json:()=>Promise.resolve({}) });
    window.addEventListener('unhandledrejection', e => errors.push('unhandledrejection: ' + (e.reason && e.reason.message ? e.reason.message : e.reason)));
  }
});
const { window } = dom;
const D = window.document;
setTimeout(() => {
  const out = []; const steps = [];
  // A. 主题三态
  const mode0 = window.eval('themeMode');
  const labels = [mode0];
  window.toggleTheme(); labels.push(window.eval('themeMode'));
  window.toggleTheme(); labels.push(window.eval('themeMode'));
  window.toggleTheme(); const back = window.eval('themeMode');
  const uniq = Array.from(new Set(labels));
  out.push('主题循环: ' + labels.join(' → ') + ' → ' + back + ' （应覆盖 light/dark/system 三态并回到起点）');
  const themeOk = uniq.length === 3 && ['light','dark','system'].every(m=>uniq.includes(m)) && back === mode0;
  // 跟随系统时 dark class 与 matchMedia(true) 一致
  window.eval("themeMode='system'; applyTheme();");
  const darkWhenSystem = D.documentElement.classList.contains('dark');
  out.push('system 模式（系统=暗）document.dark = ' + darkWhenSystem + ' （期望 true）');
  steps.push(themeOk && darkWhenSystem);

  // #3 马来西亚营业时间
  const get = (id) => window.eval("(function(){var s=null;(TRIPS.find(t=>/马来西亚/.test(t.title)).days||[]).forEach(d=>d.spots.forEach(x=>{if(x.id==='"+id+"')s=x.time;}));return s;})()");
  const t1 = get('m2_6'), t2 = get('m3_1'), t3 = get('m3_2');
  out.push('龙山堂邱公司 time = ' + t1 + ' （期望 15:30-16:30，落在 9:00-17:00 内）');
  out.push('观音亭/博物馆 time = ' + t2 + ' （期望 09:00-10:30，>=9:00 开）');
  out.push('愉园茶室 time = ' + t3 + ' （期望 11:00-12:30，>=11:00 开）');
  const bizOk = t1==='15:30-16:30' && t2==='09:00-10:30' && t3==='11:00-12:30';

  console.log('==== A 主题三态 + #3 马来西亚时间 ====');
  out.forEach(l=>console.log('  '+l));
  console.log('运行时错误: ' + (errors.length?errors.join('\n  '):'无'));
  const ok = steps[0] && bizOk && errors.length===0;
  console.log(ok ? '✅ PASS' : '❌ FAIL');
  process.exit(ok?0:1);
}, 600);
