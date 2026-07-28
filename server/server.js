/**
 * 泰国旅行行程 — 共享实时同步服务器
 * 零外部依赖（纯 Node.js built-in）
 * 启动：node server.js
 * 默认端口 3000
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.PORT, 10) || 3000;
const DATA_DIR = path.join(__dirname, 'data');

// 确保 data 目录存在
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// 每个 trip 的数据：以 code 为 key 的 JSON 文件
function tripPath(code) {
  // 只允许字母数字
  const c = String(code).replace(/[^a-zA-Z0-9_-]/g, '');
  return path.join(DATA_DIR, c + '.json');
}

function loadTrip(code) {
  const p = tripPath(code);
  try {
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) { console.error('loadTrip error:', e.message); }
  return null;
}

function saveTrip(code, data) {
  const p = tripPath(code);
  try {
    fs.writeFileSync(p, JSON.stringify(data), 'utf8');
    return true;
  } catch (e) { console.error('saveTrip error:', e.message); }
  return false;
}

// 生成 6 位随机行程码
function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 无 I/O/0/1 避免混淆
  let code;
  do {
    code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  } while (loadTrip(code) !== null); // 确保不重复
  return code;
}

// 解析 JSON body
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch (e) { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

// 简易 CORS 标头
function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function json(res, status, data) {
  setCORS(res);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

// 静态文件服务
const STATIC_DIRS = [
  path.join(__dirname, '..', 'outputs'),     // outputs/
  path.join(__dirname, '..'),                  // 项目根（fallback）
];

function serveStatic(req, res, next) {
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') urlPath = '/index.html';

  // 如果请求的是 JSON 或 API，跳过
  if (urlPath.startsWith('/api/')) return next();

  for (const dir of STATIC_DIRS) {
    const fp = path.join(dir, urlPath);
    // 安全检查：禁止跳出目录
    const resolved = path.resolve(fp);
    if (!resolved.startsWith(path.resolve(dir))) continue;
    if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
      const ext = path.extname(resolved).toLowerCase();
      const mime = {
        '.html': 'text/html; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        '.webmanifest': 'application/manifest+json',
      }[ext] || 'application/octet-stream';
      setCORS(res);
      res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache' });
      fs.createReadStream(resolved).pipe(res);
      return;
    }
  }
  next();
}

const server = http.createServer(async (req, res) => {
  setCORS(res);
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const u = new URL(req.url, 'http://localhost');
  const parts = u.pathname.split('/').filter(Boolean);

  try {
    // POST /api/create — 创建新行程，返回 code
    if (req.method === 'POST' && parts[0] === 'api' && parts[1] === 'create') {
      const body = req.method === 'POST' ? await parseBody(req).catch(() => ({})) : {};
      const code = genCode();
      const defaultState = body.state || {};
      const data = { code, state: defaultState, createdAt: Date.now(), updatedAt: Date.now(), version: 1 };
      saveTrip(code, data);
      json(res, 200, { ok: true, code, version: 1 });
      return;
    }

    // PUT /api/:code — 保存行程状态
    if (req.method === 'PUT' && parts[0] === 'api' && parts[1] && !parts[2]) {
      const code = parts[1];
      const body = await parseBody(req);
      const existing = loadTrip(code);
      const data = {
        code,
        state: body.state || {},
        createdAt: existing ? existing.createdAt : Date.now(),
        updatedAt: Date.now(),
        version: (existing ? existing.version : 0) + 1,
      };
      saveTrip(code, data);
      json(res, 200, { ok: true, code, version: data.version });
      return;
    }

    // GET /api/:code — 加载行程状态
    if (req.method === 'GET' && parts[0] === 'api' && parts[1] && !parts[2]) {
      const code = parts[1];
      const data = loadTrip(code);
      if (!data) { json(res, 404, { ok: false, error: 'Trip not found', code }); return; }
      json(res, 200, { ok: true, code, state: data.state, version: data.version, updatedAt: data.updatedAt });
      return;
    }

    // GET /api/:code/version — 仅查版本号（快速轮询）
    if (req.method === 'GET' && parts[0] === 'api' && parts[1] && parts[2] === 'version') {
      const code = parts[1];
      const data = loadTrip(code);
      if (!data) { json(res, 404, { ok: false, error: 'Trip not found' }); return; }
      json(res, 200, { ok: true, code, version: data.version, updatedAt: data.updatedAt });
      return;
    }

    // 静态文件
    serveStatic(req, res, () => {
      json(res, 404, { ok: false, error: 'Not found' });
    });
  } catch (e) {
    console.error('Request error:', e.message);
    json(res, 500, { ok: false, error: 'Server error' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 泰国旅行同步服务器已启动`);
  console.log(`   本地访问: http://localhost:${PORT}`);
  console.log(`   局域网分享: http://<本机IP>:${PORT}`);
  console.log(`   数据目录: ${DATA_DIR}`);
});
