// 후보 그림 검수 화면 (내 컴퓨터에서만 열림). 실제 카드 크기(64px)와 크게(256px)를 같이 보여줌.
// npm run images:review  → 브라우저에서 http://localhost:4545
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { CANDIDATES, SELECTIONS, loadWords } from './common.mjs';

const words = loadWords().filter((w) => fs.existsSync(path.join(CANDIDATES, w.id)));
const saved = fs.existsSync(SELECTIONS) ? JSON.parse(fs.readFileSync(SELECTIONS, 'utf8')) : {};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function page() {
  const rows = words.map((w) => {
    const files = fs.readdirSync(path.join(CANDIDATES, w.id)).filter((f) => f.endsWith('.png')).sort();
    const opts = files.map((f) => {
      const src = `/img/${w.id}/${f}`;
      const chk = saved[w.id] === f ? 'checked' : '';
      return `<label class="c"><input type="radio" name="${w.id}" value="${f}" ${chk}><img src="${src}" width="64" height="64"><img src="${src}" width="256" height="256"></label>`;
    }).join('');
    const none = !saved[w.id] ? 'checked' : '';
    return `<section><h2>${esc(w.label)} <small>${w.kind === 'n' ? '단어' : '표현'} · ${esc(w.meaning)}</small></h2><div class="row">${opts}<label class="c none"><input type="radio" name="${w.id}" value="" ${none}>쓸 만한 그림 없음<br>(다시 생성)</label></div></section>`;
  }).join('');
  return `<!doctype html><meta charset="utf-8"><title>그림 검수</title><style>
body{font-family:system-ui;margin:20px;max-width:1200px}section{border-bottom:1px solid #ddd;padding:10px 0}h2{font-size:18px}small{color:#666;font-weight:400}
.row{display:flex;gap:12px;flex-wrap:wrap;align-items:center}.c{display:flex;gap:8px;align-items:center;border:2px solid #eee;border-radius:10px;padding:6px;cursor:pointer}
.c:has(input:checked){border-color:#2458c6;background:#eef3ff}.none{width:140px;font-size:13px}img{border:1px solid #eee;background:#fff}
#bar{position:sticky;top:0;background:#fff;padding:10px 0;z-index:1}button{font-size:16px;padding:10px 16px}</style>
<div id="bar"><b>기준</b>: 작게(64px) 봐도 뜻이 바로 보이는가 · 글자/이상한 손가락·물체 없음 · 다른 것과 헷갈리지 않음 &nbsp; <button onclick="save()">선택 저장</button> <span id="msg"></span></div>${rows}
<script>async function save(){const sel={};document.querySelectorAll('input[type=radio]:checked').forEach(i=>{if(i.value)sel[i.name]=i.value});
const r=await fetch('/save',{method:'POST',body:JSON.stringify(sel)});document.getElementById('msg').textContent=r.ok?'저장했어요 ('+Object.keys(sel).length+'개). 터미널에서 npm run images:approve -- --reviewer 이름':'저장 실패'}</script>`;
}

http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/save') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => { fs.writeFileSync(SELECTIONS, JSON.stringify(JSON.parse(body), null, 2)); res.end('ok'); });
    return;
  }
  const m = req.url.match(/^\/img\/([a-z]_[0-9a-f]{10})\/(\d+\.png)$/);
  if (m) { res.setHeader('Content-Type', 'image/png'); return fs.createReadStream(path.join(CANDIDATES, m[1], m[2])).pipe(res); }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(page());
}).listen(4545, '127.0.0.1', () => console.log(`검수할 단어 ${words.length}개 → http://localhost:4545 (끝내려면 Ctrl+C)`));
