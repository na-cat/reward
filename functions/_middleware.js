// 合言葉ゲート：SITE_PASSWORD が設定されているとき、全ページ・全APIに合言葉を要求する
const COOKIE = 'arl_auth';

async function tokenOf(pass) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('arl:' + pass));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function loginPage(to, failed) {
  const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>通關密語｜合言葉｜암구호</title>
<style>
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
background:#FBF7F2;color:#3B332C;font-family:system-ui,"Hiragino Sans","Noto Sans JP","Noto Sans TC","Noto Sans KR",sans-serif}
form{background:#fff;border:1px solid #E7DED2;border-radius:16px;padding:22px;width:min(92vw,340px);text-align:center}
h1{font-size:15px;margin:0 0 4px}p{font-size:12px;color:#8A7D6E;margin:0 0 14px}
input{width:100%;font-size:16px;padding:10px;border:1px solid #E7DED2;border-radius:10px;margin-bottom:10px;
  -webkit-appearance:none;appearance:none}
input::-ms-reveal,input::-ms-clear{display:none}
input::-webkit-credentials-auto-fill-button{visibility:hidden;display:none !important;pointer-events:none;position:absolute;right:0}
input::-webkit-contacts-auto-fill-button{visibility:hidden;display:none !important;pointer-events:none;position:absolute;right:0}
button{width:100%;font-size:15px;font-weight:700;padding:11px;border:0;border-radius:10px;background:#E8A0B4;color:#fff}
.e{color:#D9736F;font-size:12px;margin-bottom:8px}
</style></head><body>
<form method="POST" action="/__login">
<h1>通關密語｜合言葉｜암구호</h1>
<p>請輸入通關密語｜合言葉をどうぞ｜암구호를 입력하세요</p>
${failed ? '<div class="e">✕ 通關密語錯誤｜合言葉が違います｜암구호가 틀렸습니다</div>' : ''}
<input type="password" name="p" autofocus autocomplete="current-password">
<input type="hidden" name="to" value="${to.replace(/"/g, '&quot;')}">
<button type="submit">OK</button>
</form></body></html>`;
  return new Response(html, {
    status: failed ? 401 : 401,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const pass = env.SITE_PASSWORD || '';

  // 合言葉が未設定のときは素通し（設定前に自分が締め出されないように）
  if (!pass) return next();

  const token = await tokenOf(pass);
  const cookie = request.headers.get('Cookie') || '';
  const ok = cookie.split(';').some(c => c.trim() === COOKIE + '=' + token);

  if (url.pathname === '/__login' && request.method === 'POST') {
    const form = await request.formData();
    if ((form.get('p') || '') === pass) {
      return new Response(null, {
        status: 302,
        headers: {
          'Location': form.get('to') || '/',
          'Set-Cookie': `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`
        }
      });
    }
    return loginPage(String(form.get('to') || '/'), true);
  }

  if (ok) return next();
  return loginPage(url.pathname + url.search, false);
}
