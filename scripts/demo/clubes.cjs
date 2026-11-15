// Gera prints do painel real para escolas de exemplo (nomes fictícios, cores inspiradas em clubes famosos, números altos).
// Parte de produto/sistema/stats.html (tela real congelada). Rodar com o servidor da landing na porta 5199: node scripts/demo/clubes.cjs
const { chromium } = require('C:/Users/thayr/projetos/desenho-bot/node_modules/playwright-core');
const OUT = 'C:/Users/thayr/Desktop/rumo-ao-esporte/rumo-ao-esporte/produto/prints/';
const CLUBES = [
  { slug: "rubronegro", cor2: "#1b1b1b", nome: "Escola Rubro-Negra Vila Nova", cor: "#c8102e", mod: "Futebol", alunos: 96, total: 104, receita: "12.480,00", mes: "9.360,00", pct: 75, pagos: 72 },
  { slug: "alvinegro", cor2: "#2e2e2e", nome: "Academia Alvinegra Central", cor: "#111111", mod: "Futsal", alunos: 148, total: 158, receita: "17.760,00", mes: "14.160,00", pct: 80, pagos: 118 },
  { slug: "verdao", cor2: "#0b3d2e", nome: "Centro Esportivo Verdão", cor: "#006437", mod: "Futebol", alunos: 64, total: 70, receita: "7.040,00", mes: "5.280,00", pct: 75, pagos: 48 },
  { slug: "blaugrana", cor2: "#004d98", nome: "Escola Blaugrana Jardim", cor: "#a50044", mod: "Futebol de Base", alunos: 215, total: 228, receita: "30.100,00", mes: "24.080,00", pct: 80, pagos: 172 },
  { slug: "azulouro", cor2: "#8a6a00", nome: "Escola Azul e Ouro", cor: "#103f91", mod: "Futebol", alunos: 82, total: 90, receita: "9.840,00", mes: "7.440,00", pct: 76, pagos: 62 },
  { slug: "celeste", cor2: "#0a3a6b", nome: "Escolinha Celeste do Sul", cor: "#0b7bbf", mod: "Futebol Society", alunos: 46, total: 52, receita: "5.980,00", mes: "4.550,00", pct: 76, pagos: 35 },
];
const fmt = n => n.toLocaleString('pt-BR');
(async () => {
  const b = await chromium.launch({ channel: 'chrome', headless: true });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  for (const c of CLUBES) {
    await p.goto('http://localhost:5199/sistema/stats.html', { waitUntil: 'load' }); await p.waitForTimeout(800);
    await p.evaluate(c => {
      const root = document.documentElement; root.style.setProperty('--pg-brand', c.cor); root.style.setProperty('--pg-sec', c.cor2); root.style.setProperty('--pg-sec-d', '#0a0a14');
      document.querySelectorAll('[data-pg-name]').forEach(e => e.textContent = c.nome);
      document.querySelectorAll('[data-pg-mod]').forEach(e => e.textContent = c.mod);
      // escudo original (não é o de nenhum clube real): escudo na cor da escola, iniciais e a modalidade
      const S = 512, cv = document.createElement("canvas"); cv.width = cv.height = S; const x = cv.getContext("2d");
      const shield = (k, dx) => { const p = new Path2D(); const m = (X, Y) => [S / 2 + (X - 256) * k, 256 + (Y - 256) * k];
        const P = [["M",256,30],["L",460,90],["L",460,250],["C",460,370,370,450,256,490],["C",142,450,52,370,52,250],["L",52,90]];
        for (const q of P) { const pts = []; for (let i = 1; i < q.length; i += 2) pts.push(m(q[i], q[i + 1])); if (q[0] === "M") p.moveTo(...pts[0]); else if (q[0] === "L") p.lineTo(...pts[0]); else p.bezierCurveTo(...pts[0], ...pts[1], ...pts[2]); } p.closePath(); return p; };
      x.fillStyle = "#ffffff"; x.fill(shield(1)); x.fillStyle = c.cor; x.fill(shield(.93));
      x.lineWidth = 8; x.strokeStyle = "rgba(255,255,255,.9)"; x.stroke(shield(.8));
      x.fillStyle = "#fff"; x.textAlign = "center";
      const ini = c.nome.replace(/^(Escola|Academia|Centro Esportivo|Escolinha)\s+/i, "").split(/\s+/).filter(w => w.length > 2 && !/^(do|da|de|e)$/i.test(w)).slice(0, 2).map(w => w[0]).join("").toUpperCase();
      x.font = "900 36px Lato,sans-serif"; x.fillText("★ ★ ★", S / 2, 150);
      x.font = "900 170px Lato,sans-serif"; x.fillText(ini, S / 2, 300);
      x.font = "900 34px Lato,sans-serif"; x.fillText(c.mod.split(" ")[0].toUpperCase(), S / 2, 370);
      const img = document.querySelector("img[data-pg-logo]"); if (img) img.src = cv.toDataURL();
      // números do painel
      const f = n => n.toLocaleString('pt-BR');
      const trocas = [[/^37$/, f(c.alunos)], [/^Total: 40$/, 'Total: ' + f(c.total)], [/^R\$\s*4\.440,00$/, 'R$ ' + c.receita], [/^R\$\s*3\.000,00$/, 'R$ ' + c.mes],
        [/^Total geral: R\$\s*3\.000,00$/, 'Total geral: R$ ' + c.mes], [/^25 \/ 40 pagos no mês$/, f(c.pagos) + ' / ' + f(c.alunos) + ' pagos no mês']];
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n; (n = w.nextNode());) {
        let t = n.nodeValue; const s = t.trim();
        for (const [re, nv] of trocas) if (re.test(s)) t = t.replace(s, nv);
        t = t.replace(/\(68%\)/, `(${c.pct}%)`).replace(/R\$\s*3\.000,00/, 'R$ ' + c.mes).replace(/68% pagos/, c.pct + '% pagos');
        if (t !== n.nodeValue) n.nodeValue = t;
      }
      // elementos que juntam texto em partes (ex.: "25 / 40 pagos")
      document.querySelectorAll('*').forEach(e => { const t = (e.textContent || '').replace(/\s+/g, ' ').trim(); if (e.children.length === 0) return;
        if (/^\d+ \/ \d+ pagos no mês$/.test(t) && e.children.length < 4) e.textContent = f(c.pagos) + ' / ' + f(c.alunos) + ' pagos no mês'; });
    }, c);
    await p.waitForTimeout(400);
    await p.screenshot({ path: OUT + 'clube-' + c.slug + '.jpg', type: 'jpeg', quality: 84 });
    console.log('ok', c.slug);
  }
  await b.close();
})().catch(e => { console.log('ERRO', e.message); process.exit(1); });
