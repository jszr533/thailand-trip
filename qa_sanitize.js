// 验证 F：远端合并的评价被净化（去标签 / 限长 / 评分夹取）
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync('index.html', 'utf8');
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push('jsdomError: ' + (e.detail ? (e.detail.stack || e.detail.message) : e.message)));
const dom = new JSDOM(html, {
  runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
  url: 'https://jszr533.github.io/thailand-trip/',
  beforeParse(window) {
    window.localStorage = { _d:{}, getItem(k){return this._d[k]||null;}, setItem(k,v){this._d[k]=String(v);}, removeItem(k){delete this._d[k];} };
    window.matchMedia = () => ({ matches:false, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){} });
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
setTimeout(() => {
  const out = [];
  // 模拟一份带攻击载荷的远端状态
  const evil = { days: [], reviews: { 'X::Y': [ { date:'<b>2026', rating: 99, text:'<script>alert(1)</script>注入', name:'<img src=x>' } ] } };
  window.importTripState(evil);
  const r = window.eval("(SPOT_REVIEWS['X::Y']||[])[0] || null");
  out.push('合并后评价 = ' + JSON.stringify(r));
  const ok = r && r.rating === 5 && typeof r.date === 'string'
    && !/<[a-z/]/.test(r.text) && !/<[a-z/]/.test(r.name)
    && r.text.indexOf('<script>') === -1 && r.name.indexOf('<img') === -1;
  console.log('==== F 远端评价净化 ====');
  out.forEach(l=>console.log('  '+l));
  console.log('运行时错误: ' + (errors.length?errors.join('\n  '):'无'));
  console.log(ok ? '✅ PASS：标签已剥离、评分夹取为 5' : '❌ FAIL');
  process.exit(ok && errors.length===0 ?0:1);
}, 500);
