// Gera o kit de marca do Pé na Grama em produto/assets (SVG vetorial + PNGs). Rodar: node scripts/brand/build.cjs
const fs = require('fs'), path = require('path');
const OUT = path.join(__dirname, '../../produto/assets/');
const { chromium } = require('C:/Users/thayr/projetos/desenho-bot/node_modules/playwright-core');

const C = { verde: '#007a2b', vivo: '#00a63a', amarelo: '#ffc61a', marinho: '#17428f', noite: '#151c33', fundo: '#f2f7fd', branco: '#ffffff' };

// Símbolo em caixa 100x100: haste e barriga do P, bola na barriga, três folhas de grama recortadas na haste.
// bola = cor do disco; miolo = pentágono central; seam = costuras (pentágono + raios). cheio=false tira os raios (versão minúscula).
function simbolo({ p, bola, miolo, seam, corte, cheio = true }) {
  const cx = 54, cy = 36, R = 21;
  const pent = (r) => [0, 1, 2, 3, 4].map(i => { const a = -Math.PI / 2 + i * 2 * Math.PI / 5; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });
  const P = pent(8.5), pts = P.map(q => q.map(n => n.toFixed(2)).join(',')).join(' ');
  const spokes = P.map(([x, y]) => { const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy); return `M${x.toFixed(2)} ${y.toFixed(2)}L${(cx + dx / d * R).toFixed(2)} ${(cy + dy / d * R).toFixed(2)}`; }).join('');
  return `
  <path fill="${p}" d="M8 4H54A32 32 0 0 1 54 68H38V96H8Z"/>
  <circle cx="${cx}" cy="${cy}" r="${R}" fill="${bola}"/>
  ${cheio ? `<path d="${spokes}" stroke="${seam}" stroke-width="2.4" stroke-linecap="round" fill="none"/>` : ''}
  <polygon points="${pts}" fill="${miolo}" stroke="${seam}" stroke-width="${cheio ? 2.4 : 0}" stroke-linejoin="round"/>
  <path fill="${corte}" d="M10 96C10 86 11 78 16 70C18 80 18 88 17 96ZM19 96C19 80 21 66 24.5 54C28 66 30 80 29 96ZM31 96C31 88 32 80 37 72C38 82 38 90 36 96Z"/>`;
}
const svg = (inner, vb = '0 0 100 100', extra = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" ${extra}>${inner}</svg>\n`;

const ICON = (cheio) => svg(`<rect width="100" height="100" rx="22" fill="${C.verde}"/><g transform="translate(16 14) scale(.72)">${simbolo({ p: "#fff", bola: C.amarelo, miolo: C.verde, seam: C.verde, corte: C.verde, cheio })}</g>`);
const V = {
  "logo-simbolo": svg(simbolo({ p: C.verde, bola: C.amarelo, miolo: C.verde, seam: C.verde, corte: C.branco })),
  "logo-simbolo-preto": svg(simbolo({ p: "#10261f", bola: "#fff", miolo: "#10261f", seam: "#10261f", corte: "#fff" })),
  "logo-simbolo-branco": svg(simbolo({ p: "#fff", bola: C.noite, miolo: "#fff", seam: "#fff", corte: C.noite })),
  "icone-app": ICON(true),
  "icone-favicon": ICON(false),
};
for (const [n, s] of Object.entries(V)) fs.writeFileSync(OUT + n + '.svg', s);

const inline = (s, w, h) => s.replace('<svg ', `<svg width="${w}" height="${h}" `);
const wm = (cor1, cor2, size) => `<span style="font:900 ${size}px/1 Lato,sans-serif;letter-spacing:-.01em;color:${cor1}">Pé na<br><span style="color:${cor2}">Grama</span></span>`;
const horiz = (fundo, cor1, cor2, sym, embed = true) => `<div style="display:flex;align-items:center;gap:22px;padding:${embed ? 0 : 40}px">${inline(sym, 120, 120)}${wm(cor1, cor2, 56)}</div>`;

const HEAD = '<link href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700;900&display=swap" rel="stylesheet"><meta charset="utf-8">';
const SHEET = `<!doctype html><html lang="pt-BR"><head>${HEAD}<title>Identidade visual · Pé na Grama</title><style>
body{margin:0;font:400 16px/1.5 Lato,sans-serif;background:${C.fundo};color:#1e293b}
.w{max-width:1100px;margin:0 auto;padding:40px 24px 80px}h1,h2{text-transform:uppercase;font-weight:900;color:${C.verde};margin:0 0 6px}h1{font-size:2.6rem}h2{font-size:1.4rem;margin-top:44px}
p{color:#475569;max-width:70ch;margin:0 0 16px}.g{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}.c{overflow:hidden}
.c{background:#fff;border-radius:16px;padding:24px;display:grid;place-items:center;min-height:180px;box-shadow:0 4px 20px rgba(23,66,143,.08)}
.sw{border-radius:16px;overflow:hidden;background:#fff;box-shadow:0 4px 20px rgba(23,66,143,.08)}.sw i{display:block;height:90px}.sw div{padding:12px 16px;font-weight:900}.sw small{display:block;font-weight:400;color:#64748b}
.btn{display:inline-block;background:${C.verde};color:#fff;font-weight:900;padding:14px 26px;border-radius:10px}.btn.o{background:#fff;color:${C.marinho};border:2px solid ${C.marinho}}
.kpi{background:${C.noite};color:#fff;border-radius:16px;padding:20px 24px}.kpi b{display:block;font-size:2rem}.kpi.v{background:linear-gradient(135deg,#00a63a,#007a2b)}
</style></head><body><div class="w">
<h1>Identidade visual</h1><p>Marca, cores, tipografia e componentes do Pé na Grama. O mesmo conjunto vale para a landing, o painel, a carteirinha e as mensagens.</p>
<h2>Logo</h2><p>O P é a inicial, a bola é o esporte e as folhas na haste são a grama. Funciona em uma cor só e em tamanho de ícone.</p>
<div class="g"><div class="c">${inline(V['logo-simbolo'], 150, 150)}</div><div class="c" style="background:${C.noite}">${inline(V['logo-simbolo-branco'], 150, 150)}</div><div class="c">${inline(V['logo-simbolo-preto'], 150, 150)}</div><div class="c" style="background:${C.verde}">${inline(V['icone-app'], 130, 130)}</div></div>
<div class="g" style="margin-top:16px"><div class="c" style="grid-column:span 2">${horiz('#fff', C.marinho, C.verde, V['logo-simbolo'])}</div><div class="c" style="background:${C.marinho}">${horiz(C.marinho, '#fff', C.amarelo, V['logo-simbolo-branco'])}</div></div>
<h2>Cores</h2><div class="g">${[['Verde marca', C.verde, 'botões, títulos, marca'], ['Verde vivo', C.vivo, 'sucesso, destaques'], ['Amarelo', C.amarelo, 'bola, alerta, destaque'], ['Azul-marinho', C.marinho, 'menu, links, contorno'], ['Azul-noite', C.noite, 'cartões escuros'], ['Fundo', C.fundo, 'fundo das telas']].map(([n, h, u]) => `<div class="sw"><i style="background:${h}"></i><div>${n}<small>${h} · ${u}</small></div></div>`).join('')}</div>
<h2>Tipografia</h2><p>Lato. Títulos em caixa alta, peso 900. Texto corrido em peso 400 e 700.</p>
<div class="c" style="place-items:start"><div style="font:900 2.6rem/1.05 Lato;text-transform:uppercase;color:${C.verde}">Mensalidade em dia</div><div style="font:400 1.1rem Lato;margin-top:8px">Cada aluno com o status à vista, sem planilha e sem cobrar um por um.</div></div>
<h2>Componentes</h2><div class="g"><div class="c" style="gap:12px"><span class="btn">Ver minha escola</span><span class="btn o">Saiba mais</span></div><div class="kpi"><small>Receita do mês</small><b>R$ 3.000,00</b></div><div class="kpi v"><small>Pagos no mês</small><b>25 de 40</b></div></div>
<h2>Uso</h2><p>Deixe ao redor do símbolo um espaço livre igual à largura da haste. Tamanho mínimo: 16 px de altura. Sobre fundo escuro use a versão branca. Não gire, não estique e não troque as cores.</p>
</div></body></html>`;
fs.writeFileSync(OUT + 'identidade.html', SHEET);
fs.writeFileSync(OUT + 'tokens.css', `/* Tokens da marca Pé na Grama: importe em qualquer tela */\n:root{\n  --pg-verde:${C.verde}; --pg-verde-vivo:${C.vivo}; --pg-amarelo:${C.amarelo};\n  --pg-marinho:${C.marinho}; --pg-noite:${C.noite}; --pg-fundo:${C.fundo};\n  --pg-ink:#1e293b; --pg-slate:#64748b; --pg-linha:#dce7f3;\n  --pg-raio:16px; --pg-raio-botao:10px; --pg-sombra:0 4px 20px rgba(23,66,143,.08);\n  --pg-fonte:'Lato','Segoe UI',system-ui,sans-serif;\n}\n`);

(async () => {
  const b = await chromium.launch({ channel: 'chrome', headless: true });
  const pg = await b.newPage({ deviceScaleFactor: 2 });
  const shot = async (html, name, sel = 'body', omit = true) => { await pg.setContent(html, { waitUntil: 'networkidle' }); await pg.waitForTimeout(500); await pg.locator(sel).screenshot({ path: OUT + name, omitBackground: omit }); };
  await shot(`<body style="margin:0;display:inline-block">${horiz('transparent', C.marinho, C.verde, V['logo-simbolo'], false)}</body>`, 'logo-horizontal.png');
  await shot(`<body style="margin:0;display:inline-block;background:${C.marinho}">${horiz(C.marinho, '#fff', C.amarelo, V['logo-simbolo-branco'], false)}</body>`, 'logo-horizontal-branco.png', 'body', false);
  for (const [n, px] of [['logo-simbolo', 512], ['icone-app', 512], ['icone-favicon', 64]]) {
    await pg.setViewportSize({ width: px, height: px }); await pg.setContent(`<body style="margin:0;background:transparent">${inline(V[n], px, px)}</body>`); await pg.screenshot({ path: OUT + n + '.png', omitBackground: true });
  }
  await pg.setViewportSize({ width: 1200, height: 900 }); await pg.goto('file:///' + (OUT + 'identidade.html').replace(/\\/g, '/'), { waitUntil: 'networkidle' }); await pg.waitForTimeout(800);
  await pg.screenshot({ path: OUT + 'identidade.png', fullPage: true });
  await b.close(); console.log('kit ok');
})().catch(e => { console.log('ERRO', e.message); process.exit(1); });
