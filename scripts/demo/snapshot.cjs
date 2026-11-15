// Congela as telas REAIS do sistema (HTML + CSS do app rodando nos emuladores) em produto/sistema/*.html,
// para a landing mostrar o painel idêntico ao de verdade e trocar só nome, logo, cor e módulos. Rodar: node scripts/demo/snapshot.cjs
const fs = require('fs');
const { chromium } = require('C:/Users/thayr/projetos/desenho-bot/node_modules/playwright-core');
const OUT = 'C:/Users/thayr/Desktop/rumo-ao-esporte/rumo-ao-esporte/produto/sistema/';
const BASE = 'http://localhost:5174';
const VIEWS = [
  ['stats', '/admin/stats'], ['turmas', '/admin/turmas'], ['alunos', '/admin/dashboard'],
  ['cobrancas', '/admin/financeiro/cobrancas'], ['mensagem', '/admin/financeiro/cobrancas', 'Editar Mensagem'],
];
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ channel: 'chrome', headless: true });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route(/(logo|real-|timbrado)[^/]*\.(png|jpe?g|svg)(\?.*)?$/i, r => r.fulfill({ status: 200, contentType: 'image/png', body: fs.readFileSync('C:/Users/thayr/Desktop/rumo-ao-esporte/rumo-ao-esporte/produto/assets/logo-branco.png') }));
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('pageerror', e.message.slice(0, 100)));
  await page.goto(BASE + '/admin/login', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type=email]', { timeout: 30000 });
  await page.fill('input[type=email]', 'rumoaoesporte@admin.com'); await page.fill('input[type=password]', 'demo1234');
  await page.click('button[type=submit]'); await page.waitForURL(/admin\/(stats|dashboard)/, { timeout: 20000 });
  for (const [nome, rota, clique] of VIEWS) {
    await page.goto(BASE + rota, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(3500);
    if (clique) { await page.getByText(clique, { exact: false }).first().click(); await page.waitForTimeout(1200); }
    const info = await page.evaluate(() => {
      // 1) nome da marca vira span editável
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), alvo = [];
      for (let n; (n = w.nextNode());) if (/rumo ao esporte|pé na grama/i.test(n.nodeValue)) alvo.push(n);
      for (const n of alvo) {
        const frag = document.createDocumentFragment();
        n.nodeValue.split(/(rumo ao esporte|pé na grama)/i).forEach(p => {
          if (/^(rumo ao esporte|pé na grama)$/i.test(p)) { const s = document.createElement('span'); s.setAttribute('data-pg-name', ''); s.textContent = p; frag.appendChild(s); } else frag.appendChild(document.createTextNode(p));
        });
        n.replaceWith(frag);
      }
      // 2) modalidade (Futebol) editável
      const w2 = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n; (n = w2.nextNode());) if (/^\s*futebol\s*$/i.test(n.nodeValue) && n.parentElement) n.parentElement.setAttribute('data-pg-mod', '');
      // 3) logo da barra lateral
      const aside = document.querySelector('aside'); const img = aside && aside.querySelector('img'); if (img) img.setAttribute('data-pg-logo', '');
      // 4) itens do menu de primeiro nível
      const nav = aside && aside.querySelector('nav'); const itens = [];
      if (nav) [...nav.children].forEach(c => { const t = (c.innerText || '').split('\n')[0].trim(); if (t) { c.setAttribute('data-pg-menu', t); itens.push(t); } });
      // 5) valores digitados viram conteúdo
      document.querySelectorAll('textarea').forEach(t => { t.textContent = t.value; t.setAttribute('data-pg-msg', ''); });
      document.querySelectorAll('input').forEach(i => i.setAttribute('value', i.value));
      document.querySelectorAll('script,link[rel=modulepreload],#selo-modo-teste').forEach(s => s.remove());
      return { itens, textareas: document.querySelectorAll('textarea').length, logo: !!img };
    });
    let html = await page.evaluate(() => '<!doctype html>' + document.documentElement.outerHTML);
    // cor da marca vira variável (o verde #00a63a do sistema)
    html = html.replace(/#00a63a/gi, 'var(--pg-brand)').replace(/rgb\(0, 166, 58\)/g, 'var(--pg-brand)')
      .replace(/rgba\(0, 166, 58, ([\d.]+)\)/g, (m, a) => `color-mix(in srgb, var(--pg-brand) ${Math.round(a * 100)}%, transparent)`);
    // o azul-marinho do sistema vira a cor secundária da escola (menu, links, cabeçalho da barra lateral)
    html = html.replace(/#17428f/gi, 'var(--pg-sec)').replace(/rgb\(23, 66, 143\)/g, 'var(--pg-sec)')
      .replace(/#09245c/gi, 'var(--pg-sec-d)').replace(/rgb\(9, 36, 92\)/g, 'var(--pg-sec-d)');
    html = html.replace('<head>', '<head><base target="_blank"><style>:root{--pg-brand:#00a63a;--pg-sec:#17428f;--pg-sec-d:#09245c}html,body{overflow:hidden!important}*{pointer-events:none!important}</style>');
    fs.writeFileSync(OUT + nome + '.html', html);
    console.log(nome, Math.round(html.length / 1024) + 'KB', JSON.stringify(info));
  }
  await b.close();
})().catch(e => { console.log('ERRO', e.message); process.exit(1); });
