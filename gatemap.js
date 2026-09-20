// Gate Map の保管場所を「読み取り専用」で覗くための窓口。
// ここからは絶対に書き込まない（POSTは実装しない）ので、Gate Map側のデータを壊す心配がない。
const FALLBACK = 'https://api.npoint.io/76f8b55be7d3461b4aeb'; // Gate Mapの実データ
const H = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };

export async function onRequestGet({ env }) {
  const target = env.GATEMAP_SYNC_URL || env.SYNC_URL || FALLBACK;
  try {
    const r = await fetch(target, { headers: { 'Accept': 'application/json' } });
    const t = await r.text();
    return new Response(t || '{}', { status: 200, headers: H });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 502, headers: H });
  }
}
