/**
 * Vercel Serverless Function — 泰国旅行同步 API
 * 存储使用内存（Vercel 无服务器环境不支持文件写入）
 */
const crypto = require('crypto');

// 内存存储（每次冷启动会重置，但运行时保持）
const store = {};

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  } while (store[code]);
  return code;
}

function parseBody(req) {
  return new Promise((resolve) => {
    if (req.body) return resolve(req.body);
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch (e) { resolve({}); }
    });
  });
}

function json(res, status, data) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(status).json(data);
}

module.exports = async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  const url = new URL(req.url, 'http://localhost');
  const parts = url.pathname.replace('/api/', '').split('/').filter(Boolean);

  try {
    // POST /api/create
    if (req.method === 'POST' && parts[0] === 'create') {
      const body = await parseBody(req);
      const code = genCode();
      store[code] = {
        state: body.state || {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };
      return json(res, 200, { ok: true, code, version: 1 });
    }

    // PUT /api/:code
    if (req.method === 'PUT' && parts.length === 1 && parts[0]) {
      const code = parts[0];
      const body = await parseBody(req);
      if (!store[code]) return json(res, 404, { ok: false, error: 'Not found' });
      store[code].state = body.state || {};
      store[code].updatedAt = Date.now();
      store[code].version++;
      return json(res, 200, { ok: true, code, version: store[code].version });
    }

    // GET /api/:code/version
    if (req.method === 'GET' && parts.length === 2 && parts[0] && parts[1] === 'version') {
      const code = parts[0];
      if (!store[code]) return json(res, 404, { ok: false, error: 'Not found' });
      return json(res, 200, { ok: true, code, version: store[code].version, updatedAt: store[code].updatedAt });
    }

    // GET /api/:code
    if (req.method === 'GET' && parts.length === 1 && parts[0]) {
      const code = parts[0];
      if (!store[code]) return json(res, 404, { ok: false, error: 'Not found' });
      return json(res, 200, { ok: true, code, state: store[code].state, version: store[code].version, updatedAt: store[code].updatedAt });
    }

    return json(res, 404, { ok: false, error: 'Not found' });
  } catch (e) {
    return json(res, 500, { ok: false, error: 'Server error' });
  }
};
