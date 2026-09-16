// npoint.io への中継。同期先URLはブラウザに出さず、ここ（サーバー側）だけが知っている。
const FALLBACK = 'https://api.npoint.io/76f8b55be7d3461b4aeb';
const H = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };

export async function onRequestGet({ env }) {
  try {
    const r = await fetch(env.SYNC_URL || FALLBACK, { headers: { 'Accept': 'application/json' } });
    const t = await r.text();
    return new Response(t || '{}', { status: 200, headers: H });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 502, headers: H });
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.text();
    const r = await fetch(env.SYNC_URL || FALLBACK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body
    });
    const t = await r.text();
    return new Response(t || '{}', { status: r.ok ? 200 : 502, headers: H });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 502, headers: H });
  }
}
