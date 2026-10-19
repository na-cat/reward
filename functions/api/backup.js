// サーバーのバックアップの一覧と取り出し（読み取りだけ。保存は sync.js が送信のたびに自動でする）。
//   GET /api/backup          → 一覧 { enabled, items:[{id, kind:'recent'|'daily', t, d}] }
//   GET /api/backup?id=...   → その時点の中身（台帳のJSON）
// LEDGER_BACKUP_URL が未設定の間は { enabled:false } を返す。
const H = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };

async function gunz(b64) {
  const bin = atob(b64);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  const ds = new DecompressionStream('gzip');
  const w = ds.writable.getWriter(); w.write(u); w.close();
  return await new Response(ds.readable).text();
}

export async function onRequestGet({ request, env }) {
  const url = env.LEDGER_BACKUP_URL;
  if (!url) return new Response(JSON.stringify({ enabled: false, items: [] }), { status: 200, headers: H });
  try {
    const r = await fetch(url, { headers: { 'Accept': 'application/json' }, cf: { cacheTtl: 0 } });
    if (!r.ok) return new Response(JSON.stringify({ error: 'upstream ' + r.status }), { status: 502, headers: H });
    let bk = {};
    try { bk = JSON.parse((await r.text()) || '{}') || {}; } catch (e) { bk = {}; }
    const recent = Array.isArray(bk.recent) ? bk.recent : [];
    const daily = Array.isArray(bk.daily) ? bk.daily : [];
    const id = new URL(request.url).searchParams.get('id');
    if (!id) {
      const items = recent.map(x => ({ id: 'r-' + x.t, kind: 'recent', t: x.t }))
        .concat(daily.map(x => ({ id: 'd-' + x.d, kind: 'daily', t: x.t, d: x.d })))
        .sort((a, b) => b.t - a.t);
      return new Response(JSON.stringify({ enabled: true, items }), { status: 200, headers: H });
    }
    let hit = null;
    if (id.startsWith('r-')) hit = recent.find(x => 'r-' + x.t === id);
    if (id.startsWith('d-')) hit = daily.find(x => 'd-' + x.d === id);
    if (!hit) return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: H });
    return new Response(await gunz(hit.z), { status: 200, headers: H });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 502, headers: H });
  }
}
