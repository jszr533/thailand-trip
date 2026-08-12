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

// 把断言注入脚本同一作用域，直接调用函数（绕开 onclick 在 new Function 下找不到全局函数的限制）
const probe = `
;(function(){
  const out = [];
  const chips = document.getElementById('tripChips');
  const filter = document.getElementById('tripCountryFilter');
  const pills = filter ? [...filter.querySelectorAll('.cf-pill')] : [];
  out.push('筛选 pills 数量(应为 全部+3国=4): ' + pills.length);
  out.push('默认 组数(应=1, 仅当前国家): ' + chips.querySelectorAll('.trip-group').length);
  const defName = chips.querySelector('.tg-name');
  out.push('默认显示国家(应为泰国): ' + (defName ? defName.textContent : '无'));
  out.push('默认 tripCountryFilter(应为 泰国): ' + tripCountryFilter);
  // 直接调用过滤函数（模拟点击韩国 pill）
  setTripCountryFilter('韩国');
  renderTripBar();
  const g2 = chips.querySelectorAll('.trip-group');
  const n2 = chips.querySelector('.tg-name');
  const krText = chips.textContent;
  out.push('选韩国后 组数(应=1): ' + g2.length + ' | 国家: ' + (n2?n2.textContent:'?') + ' | tripCountryFilter=' + tripCountryFilter);
  out.push('选韩国后 是否残留泰国行程?: ' + (/曼谷|清迈/.test(krText) ? '是(❌)' : '否(✅)'));
  out.push('选韩国后 是否显示韩国行程?: ' + (/首尔/.test(krText) ? '是(✅)' : '否(❌)'));
  // 全部
  setTripCountryFilter('__all__');
  renderTripBar();
  out.push('选全部后 组数(应=3): ' + chips.querySelectorAll('.trip-group').length + ' | tripCountryFilter=' + tripCountryFilter);
  // 恢复默认（当前国家）
  setTripCountryFilter(countryOfTrip(currentTrip()));
  renderTripBar();
  out.push('恢复默认(当前国家)后 组数(应=1): ' + chips.querySelectorAll('.trip-group').length);
  const pass = pills.length === 4 && tripCountryFilter !== '__all__' && chips.querySelectorAll('.trip-group').length === 1
    && defName && defName.textContent === '泰国'
    && g2.length === 1 && n2.textContent === '韩国' && !/曼谷|清迈/.test(krText) && /首尔/.test(krText)
    && chips.querySelectorAll('.trip-group').length === 1;
  out.push(pass ? '\\n✅ 国家筛选：默认仅当前国、点国只显该国、全部显全部分组 —— 全部通过' : '\\n❌ 国家筛选存在异常');
  console.log(out.join('\\n'));
})();
`;

const fn = new window.Function(code + '\n' + probe);
try { fn.call(window); } catch (e) { console.log('RUN ERROR:', e.message, e.stack); }
