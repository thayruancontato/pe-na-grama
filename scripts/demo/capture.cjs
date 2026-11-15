// Tira prints do painel rodando nos emuladores (veja scripts/demo). Troca nome/logo do cliente pela marca Pé na Grama.
const fs = require('fs');
const { chromium } = require('C:/Users/thayr/projetos/desenho-bot/node_modules/playwright-core');
const OUT = 'C:/Users/thayr/Desktop/rumo-ao-esporte/rumo-ao-esporte/produto/prints/';
const BASE = 'http://localhost:5174';
const LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" rx="40" fill="#147a42"/><circle cx="200" cy="150" r="70" fill="#fff"/><path d="M200 105l35 25-13 41h-44l-13-41z" fill="#10261f"/><text x="200" y="285" font-family="Arial Black,Arial" font-weight="900" font-size="52" fill="#fff" text-anchor="middle">PÉ NA</text><text x="200" y="345" font-family="Arial Black,Arial" font-weight="900" font-size="52" fill="#ffc61a" text-anchor="middle">GRAMA</text></svg>`;
const PAGES = [
  ['painel', '/admin/stats'], ['alunos', '/admin/dashboard'], ['cobrancas', '/admin/financeiro/cobrancas'],
  ['turmas', '/admin/turmas'], ['carteirinhas', '/admin/carteirinhas'], ['mensagens', '/admin/mensagens/automacao'],
];
(async () => {
  const b = await chromium.launch({ channel: 'chrome', headless: true });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await ctx.route(/(logo|real-|timbrado|carteirinha)[^/]*\.(png|jpe?g|svg)(\?.*)?$/i, r => {
    if (/carteirinha/i.test(r.request().url())) return r.continue();
    return r.fulfill({ status: 200, contentType: 'image/png', body: fs.readFileSync('C:/Users/thayr/Desktop/rumo-ao-esporte/rumo-ao-esporte/produto/assets/logo-branco.png') });
  });
  await ctx.addInitScript(() => {
    const fix = () => {
      const w = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT);
      for (let n; (n = w.nextNode());) { const v = n.nodeValue.replace(/rumo ao esporte/gi, m => m === m.toUpperCase() ? 'PÉ NA GRAMA' : 'Pé na Grama').replace(/\bREAL\b/g, 'Pé na Grama'); if (v !== n.nodeValue) n.nodeValue = v; }
      const s = document.getElementById('selo-modo-teste'); if (s) s.remove();
    };
    let t; new MutationObserver(() => { clearTimeout(t); t = setTimeout(fix, 150); }).observe(document, { childList: true, subtree: true });
    document.addEventListener('DOMContentLoaded', fix);
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('pageerror', e.message.slice(0, 100)));
  await page.goto(BASE + '/admin/login', { waitUntil: 'domcontentloaded' }); await page.waitForSelector('input[type=email]', { timeout: 30000 });
  await page.fill('input[type=email]', 'rumoaoesporte@admin.com');
  await page.fill('input[type=password]', 'demo1234');
  await page.click('button[type=submit]');
  await page.waitForURL(/admin\/(stats|dashboard)/, { timeout: 20000 });
  for (const [nome, rota] of PAGES) {
    await page.goto(BASE + rota, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3500);
    await page.screenshot({ path: OUT + nome + '.jpg', type: 'jpeg', quality: 85 });
    console.log('ok', nome, page.url());
  }
  await b.close();
})().catch(e => { console.log('ERRO', e.message); process.exit(1); });
