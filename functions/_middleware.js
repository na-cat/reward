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
input{width:100%;font-size:16px;padd
