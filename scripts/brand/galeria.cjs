// Monta galerias numeradas (2 folhas de 15) com as logos geradas em produto/assets/logos.
const { chromium } = require('C:/Users/thayr/projetos/desenho-bot/node_modules/playwright-core');
const fs = require('fs'), path = require('path');
const D = path.join(__dirname, '../../produto/assets/logos/');
const files = fs.readdirSync(D).filter(f => /^\d\d-.*\.png$/.test(f)).sort();
const url = f => 'file:///' + (D + f).split(path.sep).join('/');
(async () => {
  const b = await chromium.launch({ channel: 'chrome', headless: true });
  const pg = await b.newPage({ viewport: { width: 1500, height: 1000 } });
  for (const [k, part] of [[1, files.slice(0, 15)], [2, files.slice(15)]]) {
    const cell = f => `<div style="background:#fff;border-radius:10px;padding:8px"><img src="${url(f)}" style="width:100%;aspect-ratio:1;object-fit:contain;display:block"><div style="padding:6px 4px;color:#17428f">${Number(f.slice(0, 2))} · ${f.slice(3, -4).split('-').join(' ')}</div></div>`;
    const html = `<body style="margin:0;background:#eef2f7;font:700 18px Arial"><div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;padding:10px">${part.map(cell).join('')}</div></body>`;
    fs.writeFileSync(D + `galeria-${k}.html`, html);
    await pg.goto(url(`galeria-${k}.html`), { waitUntil: 'load' }); await pg.waitForTimeout(1500);
    await pg.screenshot({ path: D + `galeria-${k}.jpg`, type: 'jpeg', quality: 88, fullPage: true });
  }
  await b.close(); console.log('ok', files.length);
})();
