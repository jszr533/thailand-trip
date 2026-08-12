// 營業時間校驗 (Business Hours Validation)
// 提取三套行程種子資料，逐點校驗「排程時間 / 當日星期」與「營業時間 hours」是否衝突。
// 用法: node qa_business_hours.js [index.html]
// 輸出: 控制台摘要 + outputs/business_hours_report.md

const fs = require('fs');
const path = require('path');

const FILE = process.argv[2] || 'index.html';
const SRC = fs.readFileSync(FILE, 'utf8');

const WD = { '周日': 0, '周一': 1, '周二': 2, '周三': 3, '周四': 4, '周五': 5, '周六': 6 };
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

// ---------- 提取資料陣列 ----------
function extractBlock(name, openChar) {
  const re = new RegExp('(?:let|const|var)\\s+' + name + '\\s*=\\s*\\' + openChar, 'g');
  const m = re.exec(SRC);
  if (!m) return null;
  const start = m.index + m[0].length - 1; // 指向 openChar
  let depth = 0, inStr = null, escaped = false;
  for (let i = start; i < SRC.length; i++) {
    const c = SRC[i];
    if (inStr) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
    if (c === openChar) depth++;
    else if (c === (openChar === '[' ? ']' : '}')) {
      depth--;
      if (depth === 0) return SRC.slice(m.index, i + 1);
    }
  }
  return null;
}

function evalBlock(name, openChar) {
  const blk = extractBlock(name, openChar);
  if (!blk) throw new Error('Cannot extract ' + name);
  const trimmed = blk.replace(/^(let|const|var)\s+/, '');
  // eslint-disable-next-line no-eval
  return eval('(' + trimmed + ')');
}

const TRIPS = [
  { tag: '泰国雙城', data: evalBlock('DAYS', '[') },
  { tag: '首爾聖誕', data: evalBlock('SEOUL_DAYS', '[') },
  { tag: '馬來西亞人文', data: evalBlock('MALAYSIA_DAYS', '[') },
];

// ---------- 解析 hours ----------
function toMin(h, m) { return parseInt(h, 10) * 60 + parseInt(m, 10); }

function parseHours(hours) {
  const raw = (hours || '').trim();
  const out = { raw, open: null, close: null, always: false, fuzzy: false, sessions: false, except: [], exceptSoft: false, allowed: null, note: '' };

  if (!raw) { out.note = 'hours 空白'; return out; }
  if (/^24h$|^24\s*小?时|全天|全日/.test(raw)) { out.always = true; out.note = '全天/24h'; return out; }
  if (/按航班|航班/.test(raw) && !/\d{1,2}:\d{2}\s*[-~–]/.test(raw)) { out.fuzzy = true; out.note = '依航班'; return out; }
  // 純時長 (如「約 5 小時」「約 3.5 小時」「約 1 小時車程」)
  if (/約\s*\d+(\.\d+)?\s*小?时|車程|分鐘/.test(raw) && !/\d{1,2}:\d{2}\s*[-~–]/.test(raw)) { out.fuzzy = true; out.note = '時長描述'; return out; }

  // 星期限制
  if (/每日|每天/.test(raw)) out.allowed = ALL_DAYS.slice();
  if (/僅?週六日|僅?周末|僅?週末|僅?周六日/.test(raw)) out.allowed = [0, 6];
  const range = raw.match(/周([一二三四五六日])\s*至\s*周([一二三四五六日])/);
  if (range) {
    let a = WD['周' + range[1]], b = WD['周' + range[2]];
    const set = [];
    if (a <= b) for (let d = a; d <= b; d++) set.push(d);
    else { for (let d = a; d <= 6; d++) set.push(d); for (let d = 0; d <= b; d++) set.push(d); }
    out.allowed = set;
  }
  if (/週六日|周六日|六日/.test(raw)) out.allowed = [0, 6];
  if (/週五六日|周五六日/.test(raw)) out.allowed = [5, 6, 0];
  const excl = raw.match(/周([一二三四五六日])\s*(?:休|閉館|闭馆|休息|休業|休业|休館|休馆)/g);
  if (excl) {
    excl.forEach(e => { out.except.push(WD['周' + e[1]]); });
    if (/部分/.test(raw)) out.exceptSoft = true;
    if (!out.allowed) out.allowed = ALL_DAYS.filter(d => !out.except.includes(d));
  }
  // 單一日限制 (如「周日 16:00-22:00」表示僅周日) — 僅在無其他限制時作為兜底
  if (!out.allowed && out.except.length === 0) {
    const lead = raw.match(/周([一二三四五六日])\s*(?=\d)/);
    if (lead) out.allowed = [WD['周' + lead[1]]];
  }

  // 時間窗口
  const pairs = [];
  const pr = /(\d{1,2}):(\d{2})\s*[-~–]\s*(\d{1,2}):(\d{2})/g;
  let mm;
  while ((mm = pr.exec(raw)) !== null) pairs.push([toMin(mm[1], mm[2]), toMin(mm[3], mm[4])]);
  if (/導覽|場次|班次/.test(raw) && pairs.length === 0) out.sessions = true;

  if (pairs.length) {
    let o = Math.min(...pairs.map(p => p[0]));
    let c = Math.max(...pairs.map(p => p[1]));
    if (c < o) c += 24 * 60; // 跨日 (如 17:00-02:00)
    out.open = o; out.close = c;
  } else {
    const after = raw.match(/(\d{1,2}):(\d{2})\s*[後后]/);
    const before = raw.match(/(\d{1,2}):(\d{2})\s*前/);
    if (after) { out.open = toMin(after[1], after[2]); out.close = 24 * 60; }
    else if (before) { out.open = 0; out.close = toMin(before[1], before[2]); }
    else if (/清晨|上午|中午|下午|傍晚|晚上|夜晚|深夜|凌晨|日落入夜|日落后|為主|也開|最佳/.test(raw)) { out.fuzzy = true; out.note = '模糊時段描述'; }
    else out.fuzzy = true; // 有數字但無法解析成窗口
  }
  return out;
}

// ---------- 解析排程 time ----------
function parseTime(time, spot) {
  const raw = (time || '').trim();
  const out = { raw, start: null, end: null, point: null, fuzzy: false };
  if (!raw) { out.fuzzy = true; return out; }
  // 飯店：以「入住 / 退房」對應時間為準（紅眼抵達不等於入住時段）
  if (spot && spot.type === 'hotel') {
    const hm = raw.match(/(?:入住|退房|辦理入住|抵店)[^\d]*(\d{1,2}):(\d{2})|(\d{1,2}):(\d{2})\s*(?:入住|退房)/);
    if (hm) { const hh = hm[1] || hm[3], mm = hm[2] || hm[4]; out.point = toMin(hh, mm); return out; }
  }
  const nums = [];
  const pr = /(\d{1,2}):(\d{2})/g;
  let mm;
  while ((mm = pr.exec(raw)) !== null) nums.push(toMin(mm[1], mm[2]));
  if (nums.length >= 2) {
    out.start = nums[0]; out.end = nums[nums.length - 1];
    if (out.end < out.start) out.end += 24 * 60;
    return out;
  }
  if (nums.length === 1) {
    const t = nums[0];
    if (/前/.test(raw)) { out.end = t; }
    else if (/後|后/.test(raw)) { out.start = t; out.end = 24 * 60; }
    else { out.point = t; }
    return out;
  }
  out.fuzzy = true;
  return out;
}

// ---------- 校驗單點 ----------
function checkSpot(spot, day) {
  const h = parseHours(spot.hours);
  const t = parseTime(spot.time, spot);
  const wd = WD[day.weekday];
  const issues = [];

  // 航班/交通無營業時間概念，跳過
  if (spot.type === 'flight') return issues;

  // 1. 星期限制衝突
  if (h.allowed && Array.isArray(h.allowed)) {
    if (!h.allowed.includes(wd)) {
      const label = h.allowed.length === 7 ? '每日' : '限 ' + h.allowed.map(d => Object.keys(WD).find(k => WD[k] === d)).join('/');
      const soft = h.exceptSoft || /部分|更晚|約|左右/.test(spot.hours || '');
      issues.push({ level: soft ? 'review' : 'conflict', kind: 'weekday', msg: `當日 ${day.weekday} 不在營業日（${label}）` });
    }
  }

  // 2. 時間窗口衝突
  if (h.open !== null && h.close !== null) {
    const o = h.open, c = h.close;
    if (t.point !== null) {
      const within = (t.point >= o && t.point <= c) || (c > 24 * 60 && t.point + 24 * 60 >= o && t.point + 24 * 60 <= c);
      if (!within) issues.push({ level: 'conflict', kind: 'time', msg: `排程 ${fmt(t.point)} 不在營業 ${fmt(o)}-${fmt(c)}` });
    } else if (t.start !== null && t.end !== null) {
      if (t.end <= o) issues.push({ level: 'conflict', kind: 'time', msg: `排程 ${fmt(t.start)}-${fmt(t.end)} 全部早於開門 ${fmt(o)}` });
      else if (t.start >= c) issues.push({ level: 'conflict', kind: 'time', msg: `排程 ${fmt(t.start)}-${fmt(t.end)} 全部晚於關門 ${fmt(c)}` });
      else if (t.start < o || t.end > c) issues.push({ level: 'review', kind: 'time', msg: `排程 ${fmt(t.start)}-${fmt(t.end)} 部分超出營業 ${fmt(o)}-${fmt(c)}` });
    } else if (t.end !== null) {
      // 僅「X 前」：end=X
      if (t.end <= o) issues.push({ level: 'conflict', kind: 'time', msg: `排程 ${fmt(t.end)} 前，早於開門 ${fmt(o)}` });
      else if (t.end > c) issues.push({ level: 'review', kind: 'time', msg: `排程 ${fmt(t.end)} 前，可能超過關門 ${fmt(c)}` });
    } else if (t.start !== null) {
      // 僅「X 後」：start=X
      if (t.start >= c) issues.push({ level: 'conflict', kind: 'time', msg: `排程 ${fmt(t.start)} 後，晚於關門 ${fmt(c)}` });
      else if (t.start < o) issues.push({ level: 'review', kind: 'time', msg: `排程 ${fmt(t.start)} 後，可能早於開門 ${fmt(o)}` });
    }
  }

  // 3. 無法驗證
  if (issues.length === 0) {
    if (h.note === 'hours 空白') issues.push({ level: 'review', kind: 'missing', msg: 'hours 空白，無法校驗' });
    else if (h.fuzzy && (t.start !== null || t.end !== null || t.point !== null)) issues.push({ level: 'review', kind: 'unverifiable', msg: `hours 為模糊/時長描述，無法自動核對排程時間` });
    else if (h.sessions) issues.push({ level: 'review', kind: 'sessions', msg: 'hours 為場次制，需人工確認' });
  }

  // 飯店：提早抵達可寄放行李屬正常情況，降級為待確認
  if (spot.type === 'hotel') issues.forEach(i => { if (i.level === 'conflict') { i.level = 'review'; i.msg += '（飯店提早抵達，通常可寄存行李）'; } });
  return issues;
}

function fmt(min) {
  if (min == null) return '—';
  let m = ((min % (24 * 60)) + 24 * 60) % (24 * 60);
  const hh = Math.floor(m / 60), mm = m % 60;
  return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
}

// ---------- 執行 ----------
const report = [];
let total = { ok: 0, review: 0, conflict: 0 };

TRIPS.forEach(trip => {
  const tripFindings = [];
  trip.data.forEach(day => {
    (day.spots || []).forEach(spot => {
      const issues = checkSpot(spot, day);
      const levels = issues.map(i => i.level);
      const hasConflict = levels.includes('conflict');
      const hasReview = levels.includes('review');
      let status = 'ok';
      if (hasConflict) status = 'conflict';
      else if (hasReview) status = 'review';
      total[status]++;
      if (status !== 'ok') {
        const text = (spot.notes || '') + ' ' + (spot.tips || '');
        const mitigated = /[⚠!！?？]|\b不開\b|\b不开\b|休|閉館|闭馆|改去|改到|移至|挪|調整|建議|请/.test(text);
        tripFindings.push({ day: day.date + ' ' + day.weekday, spot: spot.name, time: spot.time, hours: spot.hours, status, issues, mitigated: !!mitigated });
      }
    });
  });
  report.push({ tag: trip.tag, findings: tripFindings });
});

// ---------- 輸出 ----------
console.log('=== 營業時間校驗結果 ===');
console.log(`總計: OK ${total.ok} | 待確認 REVIEW ${total.review} | 衝突 CONFLICT ${total.conflict}`);
report.forEach(r => {
  console.log(`\n[${r.tag}] 待處理 ${r.findings.length} 項`);
  r.findings.forEach(f => {
    const tag = f.status === 'conflict' ? '❌' : '⚠️';
    console.log(`  ${tag} ${f.day} | ${f.spot}`);
    console.log(`      排程: ${f.time}  | 營業: ${f.hours}`);
    f.issues.forEach(i => console.log(`      - [${i.kind}] ${i.msg}`));
  });
});

// 寫 Markdown 報告
const now = new Date().toISOString().slice(0, 10);
let md = `# 營業時間校驗報告\n\n生成日期: ${now}  \n來源: \`${FILE}\`\n\n`;
md += `## 總結\n\n| 狀態 | 數量 |\n|---|---|\n| ✅ 通過 (OK) | ${total.ok} |\n| ⚠️ 待確認 (REVIEW) | ${total.review} |\n| ❌ 衝突 (CONFLICT) | ${total.conflict} |\n\n`;
md += `> 說明: CONFLICT = 排程明顯落在營業時間外或當日公休；REVIEW = hours 為模糊/場次/空白描述，無法自動核對，需人工確認。\n\n`;
report.forEach(r => {
  if (!r.findings.length) return;
  md += `## ${r.tag}\n\n`;
  r.findings.forEach(f => {
    const tag = f.status === 'conflict' ? '❌ CONFLICT' : '⚠️ REVIEW';
    const mit = (f.status === 'conflict' && f.mitigated) ? '  _(資料中已有 ⚠️ 備註/替代方案)_' : '';
    md += `### ${tag} · ${f.day} · ${f.spot}${mit}\n`;
    md += `- 排程時間: \`${f.time}\`\n- 營業時間: \`${f.hours}\`\n`;
    f.issues.forEach(i => md += `  - [${i.kind}] ${i.msg}\n`);
    md += '\n';
  });
});

const outPath = path.join('outputs', 'business_hours_report.md');
fs.mkdirSync('outputs', { recursive: true });
fs.writeFileSync(outPath, md);
console.log('\n報告已寫入: ' + outPath);
