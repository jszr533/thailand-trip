// 专项 QA：首尔行程（种子补齐 / 地图 seoul 底图 / 坐标 / POI / 航班）+ 折叠列表
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync('index.html', 'utf8');
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push('jsdomError: ' + (e.detail ? (e.detail.stack || e.detail.message) : e.message)));
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));
function stubCanvas(w){ const noop=()=>{}; w.HTMLCanvasElement.prototype.getContext=function(){ return new Proxy({},{get:(t,p)=>{ if(p==='createLinearGradient'||p==='createRadialGradient') return ()=>({addColorStop:noop}); if(p==='getImageData') return ()=>({data:[]}); if(p==='measureText') return ()=>({width:0}); return noop; }}); }; }
const dom = new JSDOM(html, { runScripts:'dangerously', pretendToBeVisual:true, virtualConsole:vc, beforeParse(window){
  window.onerror=(m,s,l,c,e)=>{errors.push('window.onerror: '+m+(e&&e.stack?'\n'+e.stack:''));return false;};
  window.matchMedia=()=>({matches:false,addEventListener:()=>{},removeEventListener:()=>{},addListener:()=>{},removeListener:()=>{}});
  window.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};
  window.requestAnimationFrame=cb=>setTimeout(()=>cb(Date.now()),0);
  window.cancelAnimationFrame=id=>clearTimeout(id);
  if(!window.navigator.serviceWorker) Object.defineProperty(window.navigator,'serviceWorker',{value:{register:()=>Promise.resolve()},configurable:true});
  stubCanvas(window);
  window.alert=()=>{}; window.confirm=()=>true; window.prompt=()=>null;
  window.addEventListener('unhandledrejection',e=>errors.push('unhandledrejection: '+(e.reason&&e.reason.message?e.reason.message:e.reason)));
}});
const { window } = dom;
const D = window.document;
function run(){
  const steps=[];
  function step(name, fn){ try{ fn(); steps.push('✓ '+name); }catch(e){ steps.push('✗ '+name+' -> '+e.message); errors.push(name+' threw: '+e.stack); } }

  step('boot 初始化', ()=>{ if(!/flow-\w+/.test(D.body.className)) throw new Error('无 flow class'); });

  const total = window.eval('TRIPS.length');
  const seoulId = window.eval("(TRIPS.find(t=>/首尔/.test(t.title))||{}).id");
  step('首尔种子已自动补齐 (TRIPS 含首尔, total>=2)', ()=>{
    if(!seoulId) throw new Error('TRIPS 中找不到首尔行程');
    if(!(total>=2)) throw new Error('行程数不足: '+total);
  });

  // 行程库：默认仅显示当前行程所在国家分组（国家筛选 pills 设计）
  if (window.renderTripBar) window.renderTripBar();
  step('默认仅显示当前行程所在国家分组（1 组）', ()=>{
    const chips = D.getElementById('tripChips');
    const filter = D.getElementById('tripCountryFilter');
    const groups = chips.querySelectorAll('.trip-group');
    if(groups.length!==1) throw new Error('默认分组数='+groups.length+'（应为1）');
    const pills = filter ? [...filter.querySelectorAll('.cf-pill')] : [];
    if(pills.length!==4) throw new Error('筛选 pills 数='+pills.length+'（应为4：全部+3国）');
    const defName = chips.querySelector('.tg-name');
    if(!defName || !/泰国/.test(defName.textContent)) throw new Error('默认显示国家应为泰国: '+(defName?defName.textContent:'无'));
  });
  step('国家筛选：点全部显示全部分组 → 点具体国家只显该国', ()=>{
    window.setTripCountryFilter('__all__');
    const chips = D.getElementById('tripChips');
    if(chips.querySelectorAll('.trip-group').length!==3) throw new Error('选全部后分组数='+chips.querySelectorAll('.trip-group').length+'（应为3）');
    window.setTripCountryFilter('韩国');
    const g2 = chips.querySelectorAll('.trip-group');
    const n2 = chips.querySelector('.tg-name');
    if(g2.length!==1) throw new Error('选韩国后分组数='+g2.length+'（应为1）');
    if(!n2 || !/韩国/.test(n2.textContent)) throw new Error('选韩国后显示国家异常: '+(n2?n2.textContent:'?'));
    window.setTripCountryFilter(window.countryOfTrip(window.currentTrip()));
    if(chips.querySelectorAll('.trip-group').length!==1) throw new Error('恢复默认后分组数异常');
  });

  // 首尔地图底图
  step('首尔行程地图渲染 seoul 底图（非曼谷）', ()=>{
    window.setActiveTrip(seoulId);
    window.eval("currentDay='s1'");
    window.setFlow('trip');
    window.renderMap();
    const svg = D.getElementById('mapSvg').innerHTML;
    if(!/首尔站|明洞|N首尔塔/.test(svg)) throw new Error('首尔底图文本缺失');
    if(/曼谷/.test(svg)) throw new Error('误显示曼谷底图');
  });

  step('首尔所有境内 spot.loc 均在 LOCATIONS 注册', ()=>{
    const bad = window.eval("(function(){var bad=[];(TRIPS.find(t=>/首尔/.test(t.title)).days||[]).forEach(function(d){d.spots.forEach(function(s){if(s.loc&&!LOCATIONS[s.loc])bad.push(s.loc);});});return bad;})()");
    if(bad.length) throw new Error('无效坐标: '+bad.join(','));
  });

  step('openCity(首尔) 行程点库含首尔 POI 且已解耦', ()=>{
    window.openCity('首尔');
    window.setFlow('points');
    const b = D.getElementById('pointsBody');
    if(!b || !b.children.length) throw new Error('首尔行程点库空');
    if(!/明洞|N首尔塔|景福宫/.test(b.innerHTML)) throw new Error('首尔 POI 未渲染');
    if(/出现在/.test(b.innerHTML)) throw new Error('仍存在「出现在N个行程」字样(未解耦)');
  });

  step('首尔航班已按用户要求移除（航班未购买）', ()=>{
    const r = window.eval("(function(){var t=TRIPS.find(x=>/首尔/.test(x.title));var fl=[];var refs=[];t.days.forEach(function(d){d.spots.forEach(function(s){if(s.type==='flight')fl.push(s.id);});});return {count:fl.length, ids:fl};})()");
    if(r.count!==0) throw new Error('首尔仍残留航班点: '+JSON.stringify(r));
  });

  step('setFlow(home) 收尾', ()=>{ window.setFlow('home'); });

  console.log('==== 首尔行程 + 折叠列表 专项 QA ====');
  steps.forEach(s=>console.log(s));
  console.log('==== 运行时错误 ('+errors.length+') ====');
  errors.forEach(e=>console.log('• '+e));
  console.log(errors.length?'QA FAILED':'QA PASSED (无运行时错误)');
  process.exit(errors.length?1:0);
}
if(window.document.readyState==='complete') setTimeout(run,400);
else window.addEventListener('load',()=>setTimeout(run,400));
setTimeout(()=>{console.log('TIMEOUT');errors.forEach(e=>console.log('• '+e));process.exit(1);},20000);
