const fs = require('fs');
const topo = require('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/topojson-client');
const raw = fs.readFileSync('D:/新建文件夹 (2)/2026-07-27-20-29-15/_world110.json', 'utf8');
const json = JSON.parse(raw);
const fc = topo.feature(json, json.objects.countries); // FeatureCollection

const W = 1000, H = 500;
function proj(lng, lat) {
  const x = (lng + 180) / 360 * W;
  const y = (90 - lat) / 180 * H;
  return [Math.round(x), Math.round(y)];
}
// 计算环面积(像素)用于丢弃极小碎片
function ringArea(ring) {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += (ring[j][0] * ring[i][1]) - (ring[i][0] * ring[j][1]);
  }
  return Math.abs(a / 2);
}

let d = '';
let polys = 0, pts = 0;
for (const f of fc.features) {
  const g = f.geometry;
  if (!g) continue;
  const rings = g.type === 'Polygon' ? g.coordinates : g.type === 'MultiPolygon' ? g.coordinates.flat() : [];
  // 整国太小则跳过(碎片岛屿)
  const totalPts = rings.reduce((s, r) => s + r.length, 0);
  if (totalPts < 10) continue;
  for (const ring of rings) {
    if (ring.length < 4) continue;
    if (ringArea(ring) < 30) continue; // 丢弃极小碎块
    polys++;
    let sub = '';
    for (let i = 0; i < ring.length; i++) {
      const [x, y] = proj(ring[i][0], ring[i][1]);
      sub += (i === 0 ? 'M' : 'L') + x + ' ' + y + ' ';
      pts++;
    }
    d += sub + 'Z ';
  }
}
fs.writeFileSync('D:/新建文件夹 (2)/2026-07-27-20-29-15/build/world-path.txt', d.trim());
console.log('rings(polygons):', polys, 'points:', pts, 'path bytes:', Buffer.byteLength(d.trim()));
