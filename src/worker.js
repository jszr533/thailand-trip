/**
 * Cloudflare Workers — 泰国旅行同步 API
 * 使用 KV 持久化存储（不丢数据）
 */

// 生成 6 位行程码
function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  } while (false); // KV check will happen in actual create
  return code;
}

// 检查 KV 中是否已存在
async function codeExists(env, code) {
  const existing = await env.TRIPS.get(code);
  return existing !== null;
}

// 生成不重复的 code
async function generateCode(env) {
  let code;
  do { code = genCode(); } while (await codeExists(env, code));
  return code;
}

function json(res, status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}

async function parseBody(request) {
  try { return await request.json(); } catch(e) { return {}; }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method;

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      });
    }

    // Static files from Pages
    // (Worker only handles /api/* routes; Pages handles the rest)

    const parts = url.pathname.replace('/api/', '').split('/').filter(Boolean);

    try {
      // POST /api/create
      if (method === 'POST' && parts[0] === 'create') {
        const body = await parseBody(request);
        const code = await generateCode(env);
        const data = {
          state: body.state || {},
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
        };
        await env.TRIPS.put(code, JSON.stringify(data));
        return json(null, 200, { ok: true, code, version: 1 });
      }

      // PUT /api/:code
      if (method === 'PUT' && parts.length === 1 && parts[0]) {
        const code = parts[0].toUpperCase();
        const existing = await env.TRIPS.get(code);
        if (!existing) return json(null, 404, { ok: false, error: 'Not found' });
        const body = await parseBody(request);
        const data = JSON.parse(existing);
        data.state = body.state || {};
        data.updatedAt = Date.now();
        data.version++;
        await env.TRIPS.put(code, JSON.stringify(data));
        return json(null, 200, { ok: true, code, version: data.version });
      }

      // GET /api/:code/version
      if (method === 'GET' && parts.length === 2 && parts[0] && parts[1] === 'version') {
        const code = parts[0].toUpperCase();
        const existing = await env.TRIPS.get(code);
        if (!existing) return json(null, 404, { ok: false, error: 'Not found' });
        const data = JSON.parse(existing);
        return json(null, 200, { ok: true, code, version: data.version, updatedAt: data.updatedAt });
      }

      // GET /api/:code
      if (method === 'GET' && parts.length === 1 && parts[0]) {
        const code = parts[0].toUpperCase();
        const existing = await env.TRIPS.get(code);
        if (!existing) return json(null, 404, { ok: false, error: 'Not found', code });
        const data = JSON.parse(existing);
        return json(null, 200, { ok: true, code, state: data.state, version: data.version, updatedAt: data.updatedAt });
      }

      return json(null, 404, { ok: false, error: 'Not found' });
    } catch (e) {
      return json(null, 500, { ok: false, error: 'Server error: ' + e.message });
    }
  }
};
