/**
 * Cloudflare Pages Functions — 泰国旅行同步 API
 * 自动捕获 /api/* 请求，使用 KV 持久化存储
 */

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function genCode() {
  let code = '';
  for (let i = 0; i < 6; i++) code += CHARS[Math.floor(Math.random() * CHARS.length)];
  return code;
}

async function generateCode(env) {
  let code;
  do {
    code = genCode();
    const existing = await env.TRIPS.get(code);
    if (!existing) return code;
  } while (true);
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;

  // CORS
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const parts = url.pathname.replace('/api/', '').split('/').filter(Boolean);

  try {
    // POST /api/create
    if (method === 'POST' && parts[0] === 'create') {
      const body = await request.json().catch(() => ({}));
      const code = await generateCode(env);
      const data = { state: body.state || {}, createdAt: Date.now(), updatedAt: Date.now(), version: 1 };
      await env.TRIPS.put(code, JSON.stringify(data));
      return new Response(JSON.stringify({ ok: true, code, version: 1 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // PUT /api/:code
    if (method === 'PUT' && parts.length === 1 && parts[0]) {
      const code = parts[0].toUpperCase();
      const existing = await env.TRIPS.get(code);
      if (!existing) return new Response(JSON.stringify({ ok: false, error: 'Not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const body = await request.json().catch(() => ({}));
      const data = JSON.parse(existing);
      data.state = body.state || {};
      data.updatedAt = Date.now();
      data.version++;
      await env.TRIPS.put(code, JSON.stringify(data));
      return new Response(JSON.stringify({ ok: true, code, version: data.version }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // GET /api/:code/version
    if (method === 'GET' && parts.length === 2 && parts[0] && parts[1] === 'version') {
      const code = parts[0].toUpperCase();
      const existing = await env.TRIPS.get(code);
      if (!existing) return new Response(JSON.stringify({ ok: false, error: 'Not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const data = JSON.parse(existing);
      return new Response(JSON.stringify({ ok: true, code, version: data.version, updatedAt: data.updatedAt }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // GET /api/:code
    if (method === 'GET' && parts.length === 1 && parts[0]) {
      const code = parts[0].toUpperCase();
      const existing = await env.TRIPS.get(code);
      if (!existing) return new Response(JSON.stringify({ ok: false, error: 'Not found', code }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const data = JSON.parse(existing);
      return new Response(JSON.stringify({ ok: true, code, state: data.state, version: data.version, updatedAt: data.updatedAt }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ ok: false, error: 'Not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
}
