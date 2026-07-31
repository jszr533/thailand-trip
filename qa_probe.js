// 探针：测量「我的世界足迹」首页实际可见内容 + 追踪所有能进入城市指南的路径
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync('index.html', 'utf8');
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push('jsdomError: ' + (e.detail ? (e.detail.stack || e.detail.message) : e.message)));
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));
function stubCanvas(window){const noop=()=>{};window.HTMLCanvasElement.prototype.getContext=function(){return new Proxy({},{get:(t,p)=>{if(p==='createLinearGradient'||p==='createRadialGradient')return ()=>({addColorStop:noop});if(p==='getImageData')return ()=>({data:[]});if(p==='measureText')return ()=>({width:0});return noop;}});};}
const dom = new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(window){
  window.onerror=(m,s,l,c,e)=>{errors.push('onerror: '+m+(e&&e.stack?'\n'+e.stack:''));return false;};
  window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}});
  window.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};
  window.requestAnimationFrame=cb=>setTimeout(()=>cb(Date.now()),0);
  window.cancelAnimationFrame=id=>clearTimeout(id);
  if(!window.navigator.serviceWorker)Object.defineProperty(window.navigator,'serviceWorker',{value:{register:()=>Promise.resolve()},configurable:true});
  stubCanvas(window);
  window.addEventListener('unhandledrejection',e=>errors.push('unhandledrejection: '+(e.reason&&e.reason.message?e.reason.message:e.reason)));
}});
const { window } = dom;
const D = window.document;
function shown(id){const el=D.getElementById(id);if(!el)return false;return el.offsetParent!==null || el.getClientRects().length>0;}
function visText(id){const el=D.getElementById(id);return el?el.textContent.replace(/\s+/g,' ').trim():'(missing)';}
setTimeout(()=>{
  const out=[];
  out.push('=== 1. 当前 flow class: '+D.body.className);
  out.push('=== 2. 首页 pageHome 可见? '+shown('pageHome'));
  out.push('=== 3. 城市指南 pagePoints 可见? '+shown('pagePoints')+' (应=false)');
  out.push('=== 4. 首页可见文本(pageHome):');
  out.push('   '+visText('pageHome').slice(0,400));
  // 模拟点顶部「📍 行程点」导航
  window.setFlow('points');
  out.push('=== 5. 点 navPoints 后 flow: '+D.body.className+'  pagePoints可见? '+shown('pagePoints')+' (应为 cities, false)');
  // 模拟点首页地图某个城市点
  window.setFlow('home');
  const pts=D.querySelectorAll('#homeMapPoints .wm-pt');
  out.push('=== 6. 首页地图城市点数: '+pts.length);
  if(pts[0]){ pts[0].dispatchEvent(new window.MouseEvent('click',{bubbles:true})); out.push('=== 7. 点地图点['+(pts[0].dataset.name)+']后 flow: '+D.body.className+'  (应为 cities)'); }
  // 检查是否有任何「入境/交通须知」文字出现在 pageHome 之内或顶层可见
  out.push('=== 8. 全文是否含「入境须知」: '+ /入境须知/.test(D.body.textContent));
  out.push('=== 9. 运行时错误: '+(errors.length?('\n'+errors.join('\n')):'无'));
  console.log(out.join('\n'));
  process.exit(0);
},400);
