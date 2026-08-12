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

  // 折叠默认收起
  if (window.renderTripBar) window.renderTripBar();
  step('折叠列表默认收起：仅 active 行程 + 「全部N个」按钮，非 active 不渲染', ()=>{
    const activeCollapsed = D.querySelectorAll('#tripChips .trip-chip.active');
    const toggleCollapsed = D.querySelector('#tripChips .tc-toggle');
    if(activeCollapsed.length!==1) throw new Error('active chip 数='+activeCollapsed.length);
    if(!toggleCollapsed) throw new Error('缺少展开按钮');
    if(!/全部/.test(toggleCollapsed.textContent)) throw new Error('展开按钮文案异常: '+toggleCollapsed.textContent);
    if(!new RegExp(total).test(toggleCollapsed.textContent)) throw new Error('展开按钮数字不对: '+toggleCollapsed.textContent+' total='+total);
    const html = D.getElementById('tripChips').innerHTML;
    const nonActiveTitles = window.eval('TRIPS.filter(t=>t.id!==activeTripId).map(t=>t.title)');
    nonActiveTitles.forEach(t=>{ if(html.includes(t)) throw new Error('收起态不应显示非active行程: '+t); });
  });
  step('toggleTripList 展开(全部显示)→再收起', ()=>{
    window.toggleTripList();
    const t2 = D.querySelector('#tripChips .tc-toggle');
    if(!/收起/.test(t2.textContent)) throw new Error('展开后按钮文案异常: '+t2.textContent);
    const html = D.getElementById('tripChips').innerHTML;
    const allTitles = window.eval('TRIPS.map(t=>t.title)');
    allTitles.forEach(t=>{ if(!html.includes(t)) throw new Error('展开态未显示: '+t); });
    window.toggleTripList();
    const t3 = D.querySelector('#tripChips .tc-toggle');
    if(!/全部/.test(t3.textContent)) throw new Error('二次收起文案异常');
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
