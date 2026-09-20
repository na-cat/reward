// 報酬台帳「専用」の保管場所への中継。
// LEDGER_SYNC_URL が未設定の間は、誤って共有の保管場所を壊さないよう、
// 同期はせずローカル保存のみで動く（空を返す／送信は失敗として扱う）。
const H = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };

export async function onRequestGet({ env }) {
  const target = env.LEDGER_SYNC_URL;
  if (!target) return new Response('{}', { status: 200, headers: H });
  try {
    const r = await fetch(target, { headers: { 'Accept': 'application/json' } });
    const t = await r.text();
    return new Response(t || '{}', { status: 200, headers: H });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 502, headers: H });
  }
}

export async function onRequestPost({ request, env }) {
  const target = env.LEDGER_SYNC_URL;
  if (!target) return new Response(JSON.stringify({ ok: false, reason: 'LEDGER_SYNC_URL未設定' }), { status: 200, headers: H });
  try {
    const body = await request.text();
    const r = await fetch(target, {
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
