const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('index.html', 'utf8');
const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom;
window.matchMedia = window.matchMedia || function(){ return { matches:false, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){} }; };
window.IntersectionObserver = window.IntersectionObserver || class { observe(){} unobserve(){} disconnect(){} };
global.window = window; global.document = window.document;
const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const code = scripts.join('\n');

const test = `
;(function(){
  const errors = [];
  window.addEventListener('error', function(e){ errors.push(e.message); });
  function flightText(){ const el = document.getElementById('flightSummary'); return el ? el.textContent : '(none)'; }
  function setTripByTitle(sub){
    const t = TRIPS.find(function(x){ return (x.title||'').indexOf(sub) >= 0; });
    if (t) { setActiveTrip(t.id); render(); }
    return t ? t.id : null;
  }
  setTimeout(function(){
    const out = [];
    const thai = flightText();
    out.push('泰国: MU2803='+/MU2803/.test(thai)+' VZ106='+/VZ106/.test(thai)+' VZ2107='+/VZ2107/.test(thai)+' MU2804='+/MU2804/.test(thai));
    out.push('  泰国片段: ' + thai.replace(/\\s+/g,' ').slice(0,110));
    setTripByTitle('首尔');
    const kr = flightText();
    out.push('\\n韩国: 残留泰国航班(应无)=' + (/MU2803|VZ106/.test(kr) ? '❌' : '✅') + ' 空提示=' + (/暂无具体航班/.test(kr) ? '✅' : '⚠️'+kr.replace(/\\s+/g,' ').slice(0,70)));
    setTripByTitle('马来西亚');
    const my = flightText();
    out.push('\\n马来西亚: MF8530='+/MF8530/.test(my)+' MF8705='+/MF8705/.test(my)+' AK5432='+/AK5432/.test(my)+' AK5213='+/AK5213/.test(my)+' MF8716='+/MF8716/.test(my));
    out.push('  马来西亚片段: ' + my.replace(/\\s+/g,' ').slice(0,150));
    out.push('  马来西亚含泰国航班(应无)=' + (/MU2803|VZ106/.test(my) ? '❌串台' : '✅'));
    setTripByTitle('双城');
    const back = flightText();
    out.push('\\n切回泰国 MU2803 恢复=' + /MU2803/.test(back));
    out.push('\\n运行时错误: ' + errors.length + (errors.length ? ' -> ' + errors.join(' | ') : ''));
    const pass = /MU2803/.test(thai) && !/MU2803/.test(kr) && /MF8530/.test(my) && !/MU2803/.test(my) && /MU2803/.test(back);
    out.push(pass ? '\\n✅ 航班总览已按当前行程动态渲染（不串台）' : '\\n❌ 航班总览仍有问题');
    document.getElementById('toastBox') && (document.getElementById('toastBox').style.display='none');
    window.__qaResult = out.join('\\n');
  }, 500);
})();
`;

try { new window.Function(code + test).call(window); } catch(e){ console.log('RUN ERROR:', e.message); process.exit(1); }

setTimeout(() => {
  console.log(window.__qaResult || '(no result)');
  process.exit(0);
}, 1200);
