// 報酬台帳「専用」の保管場所への中継。
// LEDGER_SYNC_URL が未設定の間は、誤って共有の保管場所を壊さないよう、
// 同期はせずローカル保存のみで動く（空を返す／送信は失敗として扱う）。
//
// 【データが消えないための見張り】
// 送られてきた内容で、今サーバーにある城戦・城が「削除の印（del）」なしで消えている場合は、保存を断る（409）。
// 古い画面や、何も入れていない画面から送られた内容で、入力済みのデータが上書きで消されるのを防ぐため。
//
// 【古い版に戻さないための見張り】
// 城ごとに「いつ送ったか（v）」が付いている。送られてきた内容で、ある城の中身が今より古いv（またはvなし）の
// 中身に戻っている場合も、保存を断る（409）。開きっぱなしの古い画面が、あとから入れた内容を巻き戻すのを防ぐため。
// 断られた画面は、最新を受け取り直してから送り直す（新しい版の画面は自動でやり直す）。
//
// 【サーバーのバックアップ】
// LEDGER_BACKUP_URL（控え用の別の保存先）が登録されていれば、保存のたびに「保存する前の中身」を控える。
//   直近の分：前の控えから30分以上たっていれば1個。最大6個。
//   日ごとの分：その日（日本時間）にまだ控えがなければ1個（＝その日最初の変更の直前＝前の日の最後の状態）。最大20日分。
// 結果スクショは外し、圧縮（gzip）して保存する。控えに失敗しても、本体の保存は止めない。
const H = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };

export async function onRequestGet({ env }) {
  const target = env.LEDGER_SYNC_URL;
  if (!target) return new Response('{}', { status: 200, headers: H });
  try {
    const r = await fetch(target, { headers: { 'Accept': 'application/json' }, cf: { cacheTtl: 0 } });
    const t = await r.text();
    if (!r.ok) return new Response(JSON.stringify({ error: 'upstream ' + r.status }), { status: 502, headers: H });
    return new Response(t || '{}', { status: 200, headers: H });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 502, headers: H });
  }
}

const RECENT_MAX = 6, RECENT_GAP = 30 * 60 * 1000, DAILY_MAX = 20;

async function gz(str) {
  const cs = new CompressionStream('gzip');
  const w = cs.writable.getWriter(); w.write(new TextEncoder().encode(str)); w.close();
  const buf = new Uint8Array(await new Response(cs.readable).arrayBuffer());
  let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return btoa(s);
}

async function saveBackup(url, cur) {
  const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
  let bk = {};
  if (r.ok) { try { bk = JSON.parse((await r.text()) || '{}') || {}; } catch (e) { bk = {}; } }
  const recent = Array.isArray(bk.recent) ? bk.recent : [];
  const daily = Array.isArray(bk.daily) ? bk.daily : [];
  const now = Date.now();
  const day = new Date(now + 9 * 3600 * 1000).toISOString().slice(0, 10);
  const needRecent = !recent.length || now - recent[recent.length - 1].t >= RECENT_GAP;
  const needDaily = !daily.some(x => x.d === day);
  if (!needRecent && !needDaily) return;
  const copy = JSON.parse(JSON.stringify(cur));
  (copy.battles || []).forEach(b => (b.rows || []).forEach(x => { if (x) delete x.shot; }));
  const z = await gz(JSON.stringify(copy));
  if (needRecent) { recent.push({ t: now, z }); while (recent.length > RECENT_MAX) recent.shift(); }
  if (needDaily) { daily.push({ d: day, t: now, z }); daily.sort((a, b) => a.d.localeCompare(b.d)); while (daily.length > DAILY_MAX) daily.shift(); }
  await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ v: 1, recent, daily }) });
}

function rowBody(r) {
  if (!r) return '';
  const o = JSON.parse(JSON.stringify(r));
  ['synced', 'v', 'bv', 'shot'].forEach(k => delete o[k]);
  return JSON.stringify(o);
}

function missingItems(cur, next) {
  const del = (next && next.del) || {};
  const nb = new Map(((next && next.battles) || []).map(b => [b.id, b]));
  const miss = [];
  ((cur && cur.battles) || []).forEach(b => {
    if (!b || del[b.id]) return;
    const n = nb.get(b.id);
    if (!n) { miss.push(b.date || b.id); return; }
    const nr = new Map((n.rows || []).map(r => [r.id, r]));
    (b.rows || []).forEach(r => {
      if (!r || del[r.id]) return;
      const x = nr.get(r.id);
      if (!x) { miss.push((b.date || '') + ' ' + (r.c || r.id)); return; }
      // 中身が違うのに、送られてきた方が古い版（v が小さい・ない）なら、巻き戻しとみなす
      if ((r.v || 0) > (x.v || 0) && rowBody(r) !== rowBody(x)) miss.push((b.date || '') + ' ' + (r.c || r.id) + '（古い版）');
    });
  });
  return miss;
}

export async function onRequestPost({ request, env }) {
  const target = env.LEDGER_SYNC_URL;
  if (!target) return new Response(JSON.stringify({ ok: false, reason: 'LEDGER_SYNC_URL未設定' }), { status: 200, headers: H });
  try {
    const body = await request.text();
    let next;
    try { next = JSON.parse(body); } catch (e) { return new Response(JSON.stringify({ ok: false, reason: 'bad json' }), { status: 400, headers: H }); }
    if (!next || !Array.isArray(next.battles)) return new Response(JSON.stringify({ ok: false, reason: 'no battles' }), { status: 400, headers: H });
    // 今の中身と見比べる（取れなかった時は、安全のため保存しない）
    const cr = await fetch(target, { headers: { 'Accept': 'application/json' } });
    if (!cr.ok) return new Response(JSON.stringify({ ok: false, reason: 'upstream ' + cr.status }), { status: 502, headers: H });
    let cur = {};
    try { cur = JSON.parse((await cr.text()) || '{}'); } catch (e) { return new Response(JSON.stringify({ ok: false, reason: 'upstream bad json' }), { status: 502, headers: H }); }
    const miss = missingItems(cur, next);
    if (miss.length) return new Response(JSON.stringify({ ok: false, reason: 'missing', missing: miss.slice(0, 20) }), { status: 409, headers: H });
    // 保存する前の中身を控える（控え用の保存先が登録されている時だけ。失敗しても本体の保存は続ける）
    if (env.LEDGER_BACKUP_URL && Array.isArray(cur.battles) && cur.battles.length) {
      try { await saveBackup(env.LEDGER_BACKUP_URL, cur); } catch (e) {}
    }
    const r = await fetch(target, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    const t = await r.text();
    return new Response(t || '{}', { status: r.ok ? 200 : 502, headers: H });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 502, headers: H });
  }
}
