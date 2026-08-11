// 马来西亚行程数据校验（静态解析 index.html）
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');

function extractObject(name, startMarker, endMarker){
  const start = html.indexOf(startMarker);
  if(start<0){ console.error('✗ 未找到 '+name+' 起点'); process.exit(1); }
  const end = html.indexOf(endMarker, start);
  if(end<0){ console.error('✗ 未找到 '+name+' 终点'); process.exit(1); }
  const src = html.slice(start + startMarker.length, end + endMarker.length);
  return new Function('return ' + src)();
}

const locs = extractObject('LOCATIONS', 'const LOCATIONS = ', '\n    };');
const poi = extractObject('POI_DB', 'const POI_DB = ', '\n    };');
const days = extractObject('MALAYSIA_DAYS', 'const MALAYSIA_DAYS = ', '\n    ];');

const locKeys = new Set(Object.keys(locs));
let ok = true;
function check(name, cond){ if(cond){ console.log('✓ '+name); } else { console.log('✗ '+name); ok=false; } }

check('POI_DB 有槟城', Array.isArray(poi['槟城']) && poi['槟城'].length > 0);
check('POI_DB 有古晋', Array.isArray(poi['古晋']) && poi['古晋'].length > 0);
check('POI_DB 有吉隆坡', Array.isArray(poi['吉隆坡']) && poi['吉隆坡'].length > 0);

const malaysiaPois = ['槟城','古晋','吉隆坡'].flatMap(c => poi[c] || []);
const missingAddr = malaysiaPois.filter(p => !p.addr).length;
check('马来西亚 POI 都有 addr', missingAddr === 0);

check('MALAYSIA_DAYS 共 7 天', days.length === 7);
check('行程种子年份 2026', /buildMalaysiaTrip\(\)[\s\S]{0,200}year:\s*2026/.test(html));

const allSpots = days.flatMap(d => d.spots);
const flights = allSpots.filter(s => s.type === 'flight');
const fnos = flights.map(s => s.flightNo).filter(Boolean);
check('航班号齐全', ['MF8530','MF8705','AK5432','AK5213','MF8716'].every(n => fnos.includes(n)));

const refs = allSpots.map(s => s.loc).filter(Boolean);
const badLocs = refs.filter(k => !locKeys.has(k));
check('所有 loc 引用有效', badLocs.length === 0);
if(badLocs.length) console.log('  无效 loc:', badLocs.join(', '));

let badFields = 0;
allSpots.forEach(s => { if(!s.id || !s.name || !s.time || !s.type) badFields++; });
check('spot 字段完整', badFields === 0);

check('drawBase 支持 penang', /if \(type === 'penang'\)/.test(html));
check('drawBase 支持 kuching', /if \(type === 'kuching'\)/.test(html));
check('drawBase 支持 kl', /if \(type === 'kl'\)/.test(html));
check('renderMap type 判断支持三城', /day\.city\.includes\('penang'\)/.test(html) && /day\.city\.includes\('kuching'\)/.test(html));

check('ensureMalaysiaSeed 存在', /function ensureMalaysiaSeed/.test(html));
check('loadAllTrips 调用 ensureMalaysiaSeed', /ensureMalaysiaSeed\(\);/.test(html));
check('deleteTrip 记录马来西亚种子删除', /id===SEED_MALAYSIA_ID/.test(html));

if(!ok){ process.exit(1); }
console.log('\nQA PASSED (马来西亚行程数据校验通过)');
