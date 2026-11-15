// Tira o fundo branco dos objetos 3D (vira transparência real) e salva em webp. Rodar: node scripts/brand/cutout.cjs
const { chromium } = require('C:/Users/thayr/projetos/desenho-bot/node_modules/playwright-core');
const fs = require('fs'), path = require('path');
const A = path.join(__dirname, '../../produto/assets/');
const JOBS = [['bola', 720], ['trofeu', 720], ['kit', 720], ['criancas', 1100]];
(async () => {
  const b = await chromium.launch({ channel: 'chrome', headless: true });
  const pg = await b.newPage(); await pg.setContent('<body></body>');
  for (const [n, w] of JOBS) {
    const src = 'data:image/png;base64,' + fs.readFileSync(A + n + '.png').toString('base64');
    const out = await pg.evaluate(async ([src, w]) => {
      const img = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = src; });
      const s = w / img.width, c = document.createElement('canvas'); c.width = w; c.height = Math.round(img.height * s);
      const x = c.getContext('2d'); x.drawImage(img, 0, 0, c.width, c.height);
      const d = x.getImageData(0, 0, c.width, c.height), p = d.data;
      for (let i = 0; i < p.length; i += 4) {
        const m = Math.min(p[i], p[i + 1], p[i + 2]); let a = 1 - m / 255; a = a < .045 ? 0 : Math.min(1, a * 1.04);
        if (a > 0) for (let k = 0; k < 3; k++) p[i + k] = Math.max(0, Math.min(255, Math.round((p[i + k] - 255 * (1 - a)) / a)));
        p[i + 3] = Math.round(a * 255);
      }
      x.putImageData(d, 0, 0); return c.toDataURL('image/webp', 0.92);
    }, [src, w]);
    fs.writeFileSync(A + n + '.webp', Buffer.from(out.split(',')[1], 'base64')); console.log('ok', n);
  }
  await b.close();
})();
