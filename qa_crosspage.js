// 跨页逻辑一致性 QA：
// 1) 各行程 cities 是否都有 国家+坐标（世界地图足迹完整性）
// 2) 城市指南(入境须知/交通)是否按城市所属国家显示（不应误显示泰国规则）
// 3) 行程页 guide 是否按行程国家显示
// 4) jumpToCityTrip 是否能从城市名直达正确行程
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
  function step(name, fn){ try{ fn(); steps.push('✓ '+name); }catch(e){ steps.push('✗ '+name+' -> '+e.message); errors.push(name+' threw: '+e.message); } }
  step('boot', ()=>{ if(!/flow-\w+/.test(D.body.className)) throw new Error('无 flow class'); });

  // 确保三套种子
  window.ensureAllSeeds && window.ensureAllSeeds();
  window.render && window.render();

  // 1) 各行程 cities 国家+坐标
  const tripsInfo = JSON.parse(window.eval("(function(){var r=[];(TRIPS||[]).forEach(function(t){var cs=(t.cities||[]).map(function(c){return {name:c.name,country:c.country,lat:c.lat,lng:c.lng};});r.push({title:t.title,country:t.country,cities:cs});});return JSON.stringify(r);})()"));
  tripsInfo.forEach(t=>{
    step('行程['+t.title+'] 国家='+t.country, ()=>{ if(!t.country) throw new Error('country 为空'); });
    t.cities.forEach(c=>{
      step('  └城市['+c.name+'] 有国家+坐标', ()=>{
        if(!c.country) throw new Error('country 空');
        if(c.lat==null||c.lat===''||isNaN(+c.lat)) throw new Error('lat 缺失:'+c.lat);
        if(c.lng==null||c.lng===''||isNaN(+c.lng)) throw new Error('lng 缺失:'+c.lng);
      });
    });
  });

  // 2) aggregateCities：哪些城市进了世界地图足迹
  const agg = JSON.parse(window.eval("(function(){var r=aggregateCities().map(function(c){return {name:c.name,country:c.country,cont:(CONTINENT_OF[(c.country||'').trim()]||'其他')};});return JSON.stringify(r);})()"));
  const aggNames = agg.map(c=>c.name);
  step('世界地图足迹含 槟城/古晋/吉隆坡', ()=>{
    ['槟城','古晋','吉隆坡'].forEach(n=>{ if(aggNames.indexOf(n)<0) throw new Error('足迹缺少: '+n+' (现有: '+aggNames.join(',')+')'); });
  });
  step('世界地图足迹中 槟城/古晋 归属 亚洲/马来西亚', ()=>{
    ['槟城','古晋'].forEach(n=>{ const c=agg.find(x=>x.name===n); if(!c) throw new Error('缺 '+n); if(c.cont!=='亚洲'||c.country!=='马来西亚') throw new Error(n+' 归属错误: '+c.cont+'/'+c.country); });
  });

  // 3) 城市指南 入境须知/交通 按国家（不应误显示泰国）
  function cityGuideCheck(city, expectIn, expectNot){
    window.openCity(city); window.setFlow('points');
    const eb = D.getElementById('cityEntryBody').innerHTML;
    const tb = D.getElementById('cityTransitBody').innerHTML;
    const all = eb+tb;
    step('城市指南['+city+'] 含本国标记('+expectIn+')', ()=>{ if(all.indexOf(expectIn)<0) throw new Error('缺失 '+expectIn+' | entry='+eb.slice(0,80)); });
    step('城市指南['+city+'] 不含他国标记('+expectNot+')', ()=>{ if(all.indexOf(expectNot)>=0) throw new Error('误含 '+expectNot); });
  }
  cityGuideCheck('槟城','MDAC','中泰');
  cityGuideCheck('古晋','MDAC','中泰');
  cityGuideCheck('吉隆坡','MDAC','中泰');
  cityGuideCheck('首尔','K-ETA','中泰');
  cityGuideCheck('曼谷','中泰','MDAC'); // 曼谷应为泰国，正确

  // 4) 行程页 guide 按行程国家
  function tripGuideCheck(titleFragment, expectIn, expectNot){
    const id = window.eval("(TRIPS.find(function(t){return t.title.indexOf('"+titleFragment+"')>=0;})||{}).id");
    window.setActiveTrip(id); window.setFlow('trip'); window.renderCountryGuides();
    const eb = D.getElementById('tripEntryBody').innerHTML;
    const tb = D.getElementById('tripTransitBody').innerHTML;
    const all = eb+tb;
    step('行程['+titleFragment+'] guide 含('+expectIn+')', ()=>{ if(all.indexOf(expectIn)<0) throw new Error('缺失 '+expectIn); });
    step('行程['+titleFragment+'] guide 不含('+expectNot+')', ()=>{ if(all.indexOf(expectNot)>=0) throw new Error('误含 '+expectNot); });
  }
  tripGuideCheck('马来西亚','MDAC','中泰');
  tripGuideCheck('首尔','K-ETA','中泰');
  tripGuideCheck('曼谷','中泰','MDAC');

  // 5) jumpToCityTrip 直达正确行程
  function jumpCheck(city, expectTitleFrag){
    window.jumpToCityTrip(city);
    const title = window.eval("(currentTrip()||{}).title||''");
    step('jumpToCityTrip('+city+') → 行程['+expectTitleFrag+']', ()=>{ if(title.indexOf(expectTitleFrag)<0) throw new Error('实际跳到: '+title); });
  }
  jumpCheck('槟城','马来西亚');
  jumpCheck('古晋','马来西亚');
  jumpCheck('吉隆坡','马来西亚');
  jumpCheck('首尔','首尔');

  console.log('==== 跨页逻辑一致性 QA ====');
  steps.forEach(s=>console.log(s));
  console.log('==== 运行时错误 ('+errors.length+') ====');
  errors.forEach(e=>console.log('• '+e));
  console.log(errors.length?'QA FAILED':'QA PASSED (无运行时错误)');
  process.exit(errors.length?1:0);
}
if(window.document.readyState==='complete') setTimeout(run,400);
else window.addEventListener('load',()=>setTimeout(run,400));
setTimeout(()=>{console.log('TIMEOUT');errors.forEach(e=>console.log('• '+e));process.exit(1);},25000);
