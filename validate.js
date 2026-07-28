const fs = require('fs');
const path = 'D:/新建文件夹 (2)/2026-07-27-20-29-15/outputs/index.html';
const html = fs.readFileSync(path, 'utf8');
const re = /<script[^>]*>([\s\S]*?)<\/script>/g;
let m, count = 0, ok = true;
while ((m = re.exec(html)) !== null) {
  count++;
  const code = m[1];
  try {
    new Function(code);
    console.log('script #' + count + ' OK (' + code.length + ' chars)');
  } catch (e) {
    ok = false;
    console.error('script #' + count + ' SYNTAX ERROR: ' + e.message);
  }
}
// sanity: confirm SOURCES count
const sm = html.match(/const SOURCES = \{[\s\S]*?\n    \};/);
if (sm) {
  const ids = (sm[0].match(/'[a-z0-9_]+':\s*\[/g) || []).length;
  console.log('SOURCES entries: ' + ids);
} else {
  console.error('SOURCES block not found!');
  ok = false;
}
console.log(ok ? 'ALL GOOD' : 'HAS ERRORS');
