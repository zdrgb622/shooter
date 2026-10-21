// 將成個遊戲砌做一個 HTML 檔(CSS、JS 全部塞入去),用嚟喺 Claude 做 artifact 試玩。
// 調數面板預設打開。用法:node tools/build-artifact.js [輸出檔]
// 正常玩 / GitHub Pages 唔使呢個,直接用 index.html。

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const out = process.argv[2] || path.join(ROOT, 'dist', 'stardrift-tune.html');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const index = read('index.html');
const scripts = [...index.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
const fonts = [...index.matchAll(/<link[^>]+fonts\.(?:googleapis|gstatic)[^>]*>/g)].map(m => m[0]);
const body = index.split('<body>')[1].split('<script')[0].trim();

for (const s of scripts) if (read(s).includes('</script')) throw new Error(s + ' 入面有 </script>');

const html = `<title>星際戰機調數</title>
${fonts.join('\n')}
<style>
${read('css/style.css')}
:root { color-scheme: dark; }
</style>
${body}
<script>globalThis.STARDRIFT_TUNE = true;</script>
${scripts.map(s => `<script>\n// ---- ${s} ----\n${read(s)}\n</script>`).join('\n')}
`;

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(out, (html.length / 1024).toFixed(0) + ' KB,' + scripts.length + ' 個 script');
