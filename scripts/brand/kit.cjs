// Kit de marca a partir da logo escolhida (opção 2). Rodar: node scripts/brand/kit.cjs
const { chromium } = require('C:/Users/thayr/projetos/desenho-bot/node_modules/playwright-core');
const fs = require('fs'), path = require('path');
const A = path.join(__dirname, '../../produto/assets/');
const SRC = A + 'logos/02-tipografico-italico.png';
const C = { verde: '#007a2b', vivo: '#00a63a', amarelo: '#ffc61a', marinho: '#17428f', noite: '#151c33', fundo: '#f2f7fd' };

(async () => {
  const b = await chromium.launch({ channel: 'chrome', headless: true });
  const pg = await b.newPage({ deviceScaleFactor: 1 });
  await pg.setContent('<body></body>');
  const src = 'data:image/png;base64,' + fs.readFileSync(SRC).toString('base64');
  // Tira o fundo branco (desfaz a mistura com branco) e devolve versões recortadas.
  const r = await pg.evaluate(async (src) => {
    const img = await new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = src; });
    const W = img.width, H = img.height, c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0); const d = x.getImageData(0, 0, W, H), p = d.data;
    let x0 = W, y0 = H, x1 = 0, y1 = 0;
    for (let i = 0; i < p.length; i += 4) {
      const m = Math.min(p[i], p[i + 1], p[i + 2]); let a = 1 - m / 255; a = a < .04 ? 0 : Math.min(1, a * 1.02);
      if (a > 0) { p[i] = Math.round((p[i] - 255 * (1 - a)) / a); p[i + 1] = Math.round((p[i + 1] - 255 * (1 - a)) / a); p[i + 2] = Math.round((p[i + 2] - 255 * (1 - a)) / a); }
      p[i + 3] = Math.round(a * 255);
      if (a > .15) { const px = (i / 4) % W, py = Math.floor(i / 4 / W); if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py; }
    }
    x.putImageData(d, 0, 0);
    const pad = 14, bx = Math.max(0, x0 - pad), by = Math.max(0, y0 - pad), bw = Math.min(W, x1 + pad) - bx, bh = Math.min(H, y1 + pad) - by;
    const crop = (sx, sy, sw, sh, tint) => {
      const o = document.createElement('canvas'); o.width = sw; o.height = sh; const ox = o.getContext('2d');
      ox.drawImage(c, sx, sy, sw, sh, 0, 0, sw, sh);
      if (tint) { ox.globalCompositeOperation = 'source-in'; ox.fillStyle = tint; ox.fillRect(0, 0, sw, sh); }
      return o.toDataURL('image/png');
    };
    // "Pé" com a folha (canto superior esquerdo do letreiro) vira o símbolo compacto
    const sym = { x: 228, y: 335, w: 452, h: 270 };
    return { color: crop(bx, by, bw, bh), white: crop(bx, by, bw, bh, '#ffffff'), black: crop(bx, by, bw, bh, '#10261f'), pe: crop(sym.x, sym.y, sym.w, sym.h, '#ffffff'), peColor: crop(sym.x, sym.y, sym.w, sym.h), box: [bw, bh] };
  }, src);
  const save = (n, u) => fs.writeFileSync(A + n, Buffer.from(u.split(',')[1], 'base64'));
  save('logo.png', r.color); save('logo-branco.png', r.white); save('logo-preto.png', r.black); save('simbolo-pe.png', r.peColor);
  const [bw, bh] = r.box, ratio = bw / bh;

  // ícone do app: quadrado verde com "Pé" branco; favicon igual
  const icon = (px, rad) => `<body style="margin:0;background:transparent"><div style="width:${px}px;height:${px}px;border-radius:${rad}px;background:${C.verde};display:grid;place-items:center"><img src="${r.pe}" style="width:${px * .72}px"></div></body>`;
  for (const [n, px] of [['icone-app.png', 512], ['icone-192.png', 192], ['favicon.png', 64]]) {
    await pg.setViewportSize({ width: px, height: px }); await pg.setContent(icon(px, px * .22)); await pg.waitForTimeout(150);
    await pg.screenshot({ path: A + n, omitBackground: true });
  }
  // logo em quadrado verde (barra lateral do painel)
  await pg.setViewportSize({ width: 512, height: 512 }); await pg.setContent(`<body style="margin:0"><div style="width:512px;height:512px;border-radius:112px;background:${C.verde};display:grid;place-items:center"><img src="${r.white}" style="width:78%"></div></body>`); await pg.waitForTimeout(150); await pg.screenshot({ path: A + 'logo-quadrado.png', omitBackground: true });
  // logo reduzida p/ o menu
  await pg.setViewportSize({ width: 600, height: Math.round(600 / ratio) });
  await pg.setContent(`<body style="margin:0;background:transparent"><img src="${r.color}" style="width:600px;display:block"></body>`); await pg.waitForTimeout(150);
  await pg.screenshot({ path: A + 'logo-600.png', omitBackground: true });

  // prancha de identidade
  const css = `body{margin:0;font:400 16px/1.5 Lato,sans-serif;background:${C.fundo};color:#1e293b}.w{max-width:1100px;margin:0 auto;padding:40px 24px 80px}h1,h2{text-transform:uppercase;font-weight:900;color:${C.verde};margin:0 0 6px}h1{font-size:2.6rem}h2{font-size:1.4rem;margin-top:44px}p{color:#475569;max-width:70ch;margin:0 0 16px}.g{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}.c{background:#fff;border-radius:16px;padding:28px;display:grid;place-items:center;min-height:200px;box-shadow:0 4px 20px rgba(23,66,143,.08);overflow:hidden}.c img{max-width:100%;max-height:170px}.sw{border-radius:16px;overflow:hidden;background:#fff;box-shadow:0 4px 20px rgba(23,66,143,.08)}.sw i{display:block;height:90px}.sw div{padding:12px 16px;font-weight:900}.sw small{display:block;font-weight:400;color:#64748b}.btn{display:inline-block;background:${C.verde};color:#fff;font-weight:900;padding:14px 26px;border-radius:10px}.btn.o{background:#fff;color:${C.marinho};border:2px solid ${C.marinho}}.kpi{background:${C.noite};color:#fff;border-radius:16px;padding:20px 24px}.kpi b{display:block;font-size:2rem}.kpi.v{background:linear-gradient(135deg,#00a63a,#007a2b)}`;
  const sheet = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Identidade visual · Pé na Grama</title><link href="https://fonts.googleapis.com/css2?family=Lato:ital,wght@0,400;0,700;0,900;1,900&display=swap" rel="stylesheet"><style>${css}</style></head><body><div class="w">
<h1>Identidade visual</h1><p>Marca, cores, tipografia e componentes do Pé na Grama. O mesmo conjunto vale para a landing, o painel, a carteirinha e as mensagens.</p>
<h2>Logo</h2><p>Letreiro itálico pesado, com a folha no acento do É e a bola dentro do A. Funciona sozinho, sem símbolo à parte.</p>
<div class="g"><div class="c"><img src="logo.png" alt="Logo colorida"></div><div class="c" style="background:${C.noite}"><img src="logo-branco.png" alt="Logo branca"></div><div class="c" style="background:${C.verde}"><img src="logo-branco.png" alt="Logo branca sobre verde"></div><div class="c"><img src="logo-preto.png" alt="Logo em uma cor"></div></div>
<h2>Símbolo e ícone</h2><p>O "Pé" com a folha é o símbolo compacto, para o ícone do aplicativo, o favicon e o avatar do WhatsApp.</p>
<div class="g"><div class="c"><img src="icone-app.png" style="width:150px" alt="Ícone do aplicativo"></div><div class="c"><img src="simbolo-pe.png" style="width:180px" alt="Símbolo"></div></div>
<h2>Cores</h2><div class="g">${[['Verde marca', C.verde, 'botões, títulos, marca'], ['Verde vivo', C.vivo, 'sucesso, destaques'], ['Amarelo', C.amarelo, 'detalhes e sublinhado'], ['Azul-marinho', C.marinho, 'menu, links, contorno'], ['Azul-noite', C.noite, 'cartões escuros'], ['Fundo', C.fundo, 'fundo das telas']].map(([n, h, u]) => `<div class="sw"><i style="background:${h}"></i><div>${n}<small>${h} · ${u}</small></div></div>`).join('')}</div>
<h2>Tipografia</h2><p>Lato. Títulos em caixa alta, peso 900. Texto corrido em peso 400 e 700. O itálico pesado fica só no letreiro da marca.</p>
<div class="c" style="place-items:start"><div style="font:900 2.6rem/1.05 Lato;text-transform:uppercase;color:${C.verde}">Mensalidade em dia</div><div style="font:400 1.1rem Lato;margin-top:8px">Cada aluno com o status à vista, sem planilha e sem cobrar um por um.</div></div>
<h2>Componentes</h2><div class="g"><div class="c" style="gap:12px"><span class="btn">Ver minha escola</span><span class="btn o">Saiba mais</span></div><div class="kpi"><small>Receita do mês</small><b>R$ 3.000,00</b></div><div class="kpi v"><small>Pagos no mês</small><b>25 de 40</b></div></div>
<h2>Uso</h2><p>Deixe ao redor da logo um espaço livre igual à altura do "P". Tamanho mínimo: 80 px de largura (use o ícone abaixo disso). Sobre fundo escuro ou verde use a versão branca. Não gire, não estique e não troque as cores.</p>
</div></body></html>`;
  fs.writeFileSync(A + 'identidade.html', sheet);
  fs.writeFileSync(A + 'tokens.css', `/* Tokens da marca Pé na Grama: importe em qualquer tela */\n:root{\n  --pg-verde:${C.verde}; --pg-verde-vivo:${C.vivo}; --pg-amarelo:${C.amarelo};\n  --pg-marinho:${C.marinho}; --pg-noite:${C.noite}; --pg-fundo:${C.fundo};\n  --pg-ink:#1e293b; --pg-slate:#64748b; --pg-linha:#dce7f3;\n  --pg-raio:16px; --pg-raio-botao:10px; --pg-sombra:0 4px 20px rgba(23,66,143,.08);\n  --pg-fonte:'Lato','Segoe UI',system-ui,sans-serif;\n}\n`);
  await pg.setViewportSize({ width: 1200, height: 900 });
  await pg.goto('file:///' + (A + 'identidade.html').split(path.sep).join('/'), { waitUntil: 'networkidle' }); await pg.waitForTimeout(800);
  await pg.screenshot({ path: A + 'identidade.png', fullPage: true });
  await b.close(); console.log('kit ok', bw, bh);
})().catch(e => { console.log('ERRO', e.message); process.exit(1); });
