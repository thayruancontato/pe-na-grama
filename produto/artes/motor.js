// Motor de artes: desenha um modelo (lista de camadas) num <canvas>.
// É usado pelo editor da Central (produto/admin) e pelo sistema da escola (src/artes), para o desenho sair igual nos dois lugares.
// Sem dependências: o QR code, a foto e a logo chegam prontos em `recursos`.
//
// Modelo:  { id, nome, tipo: 'carteirinha' | 'aniversario', w, h, temas: [ids], camadas: [...] }            (aniversário)
//          { id, nome, tipo: 'carteirinha', w, h, temas: [ids], lados: { frente: [...], verso: [...] } }   (carteirinha)
// Camada:  { t: tipo, nome, x, y, w, h, rot, op, sombra, oculto, se, ...propriedades do tipo }
// Cores:   '#rrggbb' | '@primaria' (paleta da escola) | '$acento' (cor do tema) | mix(a,b,0.3) | alfa(a,0.5) | sobre(a) | acento(a) | marca(a) | legivel(a,fundo)

export const FONTES = {
    padrao: '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    festa: '"DucksFiesta", "Segoe UI", Roboto, Arial, sans-serif',
    mao: '"BeneathTheSilence", "Segoe UI", Roboto, Arial, sans-serif',
    serifa: 'Georgia, "Times New Roman", serif',
    mono: 'ui-monospace, Consolas, monospace'
};
export const PALETA_PADRAO = { primaria: '#00a63a', secundaria: '#17428f', escura: '#09245c', destaque: '#f4c20d' };
export const TIPOS = ['ret', 'elipse', 'poli', 'linha', 'texto', 'foto', 'logo', 'qr', 'grao', 'meiotom', 'guilloche', 'listras', 'confete', 'arcos', 'campo', 'foil', 'balao'];

// ---------------- cores ----------------
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hex = (a) => '#' + a.map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
const ehHex = (s) => /^#[0-9a-f]{6}$/i.test(s);
// aceita #rgb e rgba(): converte para #rrggbb quando preciso fazer conta
function paraHex(s) {
    s = String(s || '').trim();
    if (ehHex(s)) return s.toLowerCase();
    let m = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(s); if (m) return '#' + m[1] + m[1] + m[2] + m[2] + m[3] + m[3];
    m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(s); if (m) return hex([+m[1], +m[2], +m[3]]);
    return '#000000';
}
const luz = (h) => { const [r, g, b] = rgb(paraHex(h)).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const contraste = (a, b) => { const x = luz(a), y = luz(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const mistura = (a, b, t) => { const A = rgb(paraHex(a)), B = rgb(paraHex(b)); return hex(A.map((x, i) => x + (B[i] - x) * t)); };
const alfaDe = (a, o) => `rgba(${rgb(paraHex(a)).join(',')},${o})`;

function partes(s) { // separa argumentos por vírgula fora de parênteses
    const out = []; let nivel = 0, ini = 0;
    for (let i = 0; i < s.length; i++) { const c = s[i]; if (c === '(') nivel++; else if (c === ')') nivel--; else if (c === ',' && nivel === 0) { out.push(s.slice(ini, i)); ini = i + 1; } }
    out.push(s.slice(ini)); return out.map((x) => x.trim());
}
/** Calcula uma expressão de cor. ctx = { paleta, tokens (expressões do tema), _cache }. */
export function cor(expr, ctx, prof = 0) {
    if (expr == null || expr === '') return '#000000';
    const s = String(expr).trim();
    if (prof > 10) return '#000000';
    if (s[0] === '@') return (ctx.paleta && ctx.paleta[s.slice(1)]) || PALETA_PADRAO[s.slice(1)] || '#000000';
    if (s[0] === '$') {
        const k = s.slice(1); ctx._cache = ctx._cache || {};
        if (ctx._cache[k] == null) { ctx._cache[k] = '#000000'; ctx._cache[k] = cor((ctx.tokens || {})[k], ctx, prof + 1); }
        return ctx._cache[k];
    }
    const f = /^([a-z]+)\((.*)\)$/i.exec(s);
    if (f) {
        const a = partes(f[2]), v = (i) => cor(a[i], ctx, prof + 1), n = (i, d) => (a[i] == null || a[i] === '' ? d : parseFloat(a[i]));
        switch (f[1].toLowerCase()) {
            case 'mix': return mistura(v(0), v(1), n(2, 0.5));
            case 'alfa': return alfaDe(v(0), n(1, 1));
            case 'escurece': return mistura(v(0), '#000000', n(1, 0.3));
            case 'clareia': return mistura(v(0), '#ffffff', n(1, 0.3));
            case 'sobre': return luz(v(0)) > 0.45 ? (a[2] ? v(2) : '#10213f') : (a[1] ? v(1) : '#ffffff');
            case 'acento': { const fundo = v(0); const c = ['destaque', 'secundaria', 'primaria'].map((k) => cor('@' + k, ctx)).find((x) => contraste(x, fundo) >= 3); return c || (luz(fundo) > 0.45 ? '#10213f' : '#ffd23f'); }
            case 'marca': { const fundo = v(0); const c = ['primaria', 'secundaria', 'escura', 'destaque'].map((k) => cor('@' + k, ctx)).find((x) => contraste(x, fundo) >= 3); return c || (luz(fundo) > 0.45 ? '#10213f' : '#ffffff'); }
            case 'legivel': { let c = v(0); const fundo = v(1), min = n(2, 4.5), alvo = luz(fundo) > 0.4 ? '#000000' : '#ffffff'; for (let i = 0; i < 12 && contraste(c, fundo) < min; i++) c = mistura(c, alvo, 0.18); return c; }
            default: return s;
        }
    }
    return s;
}
/** Contexto de cores: paleta da escola + tema (tokens). */
export function contextoCores(paleta, tema) { return { paleta: { ...PALETA_PADRAO, ...(paleta || {}) }, tokens: (tema && tema.tokens) || {}, _cache: {} }; }

// ---------------- imagens e fontes ----------------
const cacheImg = new Map();
/** Carrega uma imagem sem "sujar" o canvas. Devolve null se falhar. */
export function imagem(url) {
    if (!url) return Promise.resolve(null);
    if (!cacheImg.has(url)) {
        cacheImg.set(url, (async () => {
            try {
                const src = url.startsWith('data:') ? url : URL.createObjectURL(await (await fetch(url)).blob());
                return await new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });
            } catch { return null; }
        })());
    }
    return cacheImg.get(url);
}
let fontesProntas = null;
/** Fontes decorativas (DucksFiesta e BeneathTheSilence) a partir de uma pasta ('/' na escola, '/assets/fonts/' na Central). */
export function carregaFontes(pasta = '/') {
    if (!fontesProntas) {
        const um = async (nome, arq) => { try { const f = new FontFace(nome, `url("${encodeURI(pasta + arq)}")`); await f.load(); document.fonts.add(f); } catch { /* usa a fonte padrão */ } };
        fontesProntas = Promise.all([um('DucksFiesta', 'Ducks Fiesta.ttf'), um('BeneathTheSilence', 'Beneath the Silence.ttf')]);
    }
    return fontesProntas;
}

// ---------------- dados do aluno ----------------
const primeiro = (n) => { const p = String(n || '').trim().split(/\s+/)[0] || ''; return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase(); };
const curto = (n) => { const p = String(n || '').trim().split(/\s+/); if (p.length >= 4) for (let i = 2; i < p.length - 1; i++) p[i] = p[i][0].toUpperCase() + '.'; return p.join(' '); };
/** Variáveis que os textos aceitam, ex.: "{primeiroNome}". */
export const VARIAVEIS = [['nome', 'Nome completo'], ['nomeCurto', 'Nome (meio abreviado)'], ['primeiroNome', 'Primeiro nome'], ['idade', 'Idade que completa'], ['escola', 'Nome da escola'], ['matricula', 'Matrícula'], ['cpf', 'CPF do aluno'], ['nascimento', 'Data de nascimento'], ['modalidade', 'Modalidade'], ['turma', 'Turma'], ['respNome', 'Responsável'], ['respCpf', 'CPF do responsável'], ['respFone', 'Telefone do responsável'], ['respEmail', 'E-mail do responsável'], ['respEndereco', 'Endereço do responsável'], ['ano', 'Ano atual']];
export function variaveis(d) {
    const r = d.responsavel || {}, e = r.endereco || {};
    return {
        nome: d.nome || '', nomeCurto: curto(d.nome), primeiroNome: primeiro(d.nome), idade: d.idade != null ? String(d.idade) : '', escola: d.escola || '',
        matricula: d.numeroCota || '-', cpf: d.cpf || '-', nascimento: d.dataNascimento || '-', modalidade: d.modalidade || '-', turma: d.turma || '',
        respNome: r.nome || '-', respCpf: r.cpf || '-', respFone: r.telefonePrincipal || r.telefone || '-', respEmail: r.email || '-',
        respEndereco: [e.rua, e.numero, e.bairro, e.cidade, e.estado || e.uf].filter(Boolean).join(', ') || '-', ano: String(new Date().getFullYear())
    };
}

// ---------------- geometria das camadas (usada também pelo editor) ----------------
/** Caixa que envolve a camada: { x, y, w, h }. */
export function caixaDe(L) {
    if (L.t === 'poli') { const p = L.pts && L.pts.length ? L.pts : [[0, 0]]; const xs = p.map((q) => q[0]), ys = p.map((q) => q[1]); return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }; }
    if (L.t === 'linha') return { x: Math.min(L.x, L.x2), y: Math.min(L.y, L.y2), w: Math.abs(L.x2 - L.x), h: Math.abs(L.y2 - L.y) };
    if (L.t === 'texto') { const linhas = L.quebra ? (L.quebra.linhas || 2) : 1; return { x: L.x, y: L.y, w: L.w || 400, h: Math.round(L.tam * 1.25 * (L.quebra ? linhas * (L.quebra.alt || 1) : 1)) }; }
    if (L.t === 'qr') return { x: L.x, y: L.y, w: L.w, h: L.w };
    if (L.t === 'grao') return { x: 0, y: 0, w: 0, h: 0 };
    return { x: L.x || 0, y: L.y || 0, w: L.w || 0, h: L.h || 0 };
}

// ---------------- desenho ----------------
function caminhoRet(g, x, y, w, h, r) { g.beginPath(); if (r > 0 && g.roundRect) g.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2)); else g.rect(x, y, w, h); }
function sorteio(semente) { let a = semente >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** Preenchimento: cor simples ou degradê { tipo: 'h'|'v'|'d1'|'d2'|'radial', c: [cores], tela?: true }. */
function estilo(g, f, caixa, ctx, W, H) {
    if (f && typeof f === 'object' && f.c) {
        const b = f.tela ? { x: 0, y: 0, w: W, h: H } : caixa, cores = f.c.map((c) => cor(c, ctx));
        let d;
        if (f.tipo === 'radial') d = g.createRadialGradient(b.x + b.w / 2, b.y + b.h / 2, 0, b.x + b.w / 2, b.y + b.h / 2, Math.max(b.w, b.h) / 2 || 1);
        else if (f.tipo === 'v') d = g.createLinearGradient(0, b.y, 0, b.y + b.h);
        else if (f.tipo === 'd1') d = g.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h);
        else if (f.tipo === 'd2') d = g.createLinearGradient(b.x + b.w, b.y, b.x, b.y + b.h);
        else d = g.createLinearGradient(b.x, 0, b.x + b.w, 0);
        cores.forEach((c, i) => d.addColorStop(cores.length === 1 ? 0 : i / (cores.length - 1), c));
        return d;
    }
    return cor(f, ctx);
}
function contorno(g, borda, ctx) { if (borda && borda.larg > 0) { g.lineWidth = borda.larg; g.strokeStyle = cor(borda.cor, ctx); g.stroke(); } }

function escreve(g, L, ctx, vars) {
    const s0 = String(L.txt == null ? '' : L.txt).replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : ''));
    let s = L.caixaAlta ? s0.toUpperCase() : s0;
    if (!s) return;
    const caixa = caixaDe(L), fam = FONTES[L.fam || 'padrao'] || FONTES.padrao, peso = L.peso == null ? 700 : L.peso, al = L.al || 'left';
    let tam = L.tam || 40;
    const def = () => { g.font = `${peso} ${tam}px ${fam}`; };
    g.textBaseline = 'top'; g.textAlign = al; g.letterSpacing = `${L.esp || 0}px`;
    const ax = al === 'center' ? caixa.x + caixa.w / 2 : al === 'right' ? caixa.x + caixa.w : caixa.x;
    const pinta = (t, y) => {
        if (L.contorno && L.contorno.larg > 0) { g.lineJoin = 'round'; g.lineWidth = L.contorno.larg; g.strokeStyle = cor(L.contorno.cor, ctx); g.strokeText(t, ax, y); }
        if (!L.semPreenchimento) { g.fillStyle = cor(L.cor, ctx); g.fillText(t, ax, y); }
    };
    def();
    if (L.quebra) { // várias linhas dentro da largura
        const max = L.quebra.linhas || 2, alt = tam * 1.25 * (L.quebra.alt || 1), palavras = s.split(/\s+/), linhas = []; let atual = '';
        for (const p of palavras) { const t = atual ? atual + ' ' + p : p; if (g.measureText(t).width > caixa.w && atual) { linhas.push(atual); atual = p; } else atual = t; }
        if (atual) linhas.push(atual);
        if (linhas.length > max) { linhas.length = max; let u = linhas[max - 1]; while (g.measureText(u + '…').width > caixa.w && u.length > 1) u = u.slice(0, -1); linhas[max - 1] = u.trimEnd() + '…'; }
        linhas.forEach((t, i) => pinta(t, caixa.y + i * alt));
    } else {
        if (L.ajusta !== false && caixa.w) {
            const min = L.min || tam * 0.45;
            while (g.measureText(s).width > caixa.w && tam > min) { tam -= 1; def(); }
            while (g.measureText(s).width > caixa.w && s.length > 2) s = s.slice(0, -2).trimEnd() + '…';
        }
        pinta(s, caixa.y);
    }
    g.letterSpacing = '0px';
}
function silhueta(g, x, y, w, h) {
    g.fillStyle = '#e6ebf2'; g.fillRect(x, y, w, h); g.fillStyle = '#b9c3d1';
    g.beginPath(); g.arc(x + w / 2, y + h * 0.4, Math.min(w, h) * 0.19, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(x + w / 2, y + h * 1.02, w * 0.36, h * 0.36, 0, 0, Math.PI * 2); g.fill();
}
function imgCapa(g, img, x, y, w, h, foco = 0.35) { const k = Math.max(w / img.width, h / img.height), iw = img.width * k, ih = img.height * k; g.drawImage(img, x + (w - iw) / 2, y + (h - ih) * foco, iw, ih); }
function imgDentro(g, img, x, y, w, h, al) { const k = Math.min(w / img.width, h / img.height), iw = img.width * k, ih = img.height * k; g.drawImage(img, al === 'esquerda' ? x : al === 'direita' ? x + w - iw : x + (w - iw) / 2, y + (h - ih) / 2, iw, ih); }
function qrFalso(g, x, y, t) { // pré-visualização sem QR de verdade
    const n = 25, c = t / n, r = sorteio(5); g.fillStyle = '#10213f';
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const canto = (i < 7 && j < 7) || (i > n - 8 && j < 7) || (i < 7 && j > n - 8); if (canto ? (i % 6 === 0 || j % 6 === 0 || (i % 6 > 1 && i % 6 < 5 && j % 6 > 1 && j % 6 < 5)) && !((i === 0 || i === n - 1) && false) : r() > 0.52) g.fillRect(x + i * c, y + j * c, c, c); }
}

function camada(g, L, ctx, rec, vars, W, H) {
    const c = caixaDe(L);
    g.save();
    if (L.op != null && L.op < 1) g.globalAlpha = Math.max(0, L.op);
    if (L.rot) { const cx = L.pivo ? L.pivo[0] : c.x + c.w / 2, cy = L.pivo ? L.pivo[1] : c.y + c.h / 2; g.translate(cx, cy); g.rotate((L.rot * Math.PI) / 180); g.translate(-cx, -cy); }
    if (L.sombra) { g.shadowColor = cor(L.sombra.cor || 'rgba(0,0,0,0.3)', ctx); g.shadowBlur = L.sombra.blur || 0; g.shadowOffsetX = L.sombra.x || 0; g.shadowOffsetY = L.sombra.y || 0; }
    switch (L.t) {
        case 'ret': caminhoRet(g, c.x, c.y, c.w, c.h, L.raio || 0); g.fillStyle = estilo(g, L.fill, c, ctx, W, H); if (L.fill !== 'nenhum') g.fill(); contorno(g, L.borda, ctx); break;
        case 'elipse': g.beginPath(); g.ellipse(c.x + c.w / 2, c.y + c.h / 2, Math.abs(c.w / 2), Math.abs(c.h / 2), 0, 0, Math.PI * 2); g.fillStyle = estilo(g, L.fill, c, ctx, W, H); if (L.fill !== 'nenhum') g.fill(); contorno(g, L.borda, ctx); break;
        case 'poli': if (L.pts && L.pts.length > 1) { g.beginPath(); L.pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fillStyle = estilo(g, L.fill, c, ctx, W, H); if (L.fill !== 'nenhum') g.fill(); contorno(g, L.borda, ctx); } break;
        case 'linha': g.beginPath(); g.moveTo(L.x, L.y); g.lineTo(L.x2, L.y2); g.lineWidth = L.larg || 4; g.lineCap = L.ponta || 'butt'; g.strokeStyle = cor(L.cor, ctx); if (L.trac) g.setLineDash(L.trac); g.stroke(); break;
        case 'texto': escreve(g, L, ctx, vars); break;
        case 'foto': {
            g.save(); caminhoRet(g, c.x, c.y, c.w, c.h, L.raio || 0); g.clip();
            if (rec.foto) imgCapa(g, rec.foto, c.x, c.y, c.w, c.h, L.foco == null ? 0.35 : L.foco); else silhueta(g, c.x, c.y, c.w, c.h);
            g.restore(); g.shadowColor = 'transparent';
            if (L.borda && L.borda.larg > 0) { caminhoRet(g, c.x, c.y, c.w, c.h, L.raio || 0); contorno(g, L.borda, ctx); }
            break;
        }
        case 'logo': {
            if (!rec.logo) break;
            if (L.placa) { preenchePlaca(g, c, L, ctx); g.shadowColor = 'transparent'; const pad = Math.min(c.w, c.h) * 0.12; imgDentro(g, rec.logo, c.x + pad, c.y + pad, c.w - pad * 2, c.h - pad * 2, L.al); }
            else imgDentro(g, rec.logo, c.x, c.y, c.w, c.h, L.al);
            break;
        }
        case 'qr': {
            const t = c.w, pad = L.pad == null ? 10 : L.pad;
            if (L.fundo !== 'nenhum') { caminhoRet(g, c.x - pad, c.y - pad, t + pad * 2, t + pad * 2, L.raio == null ? 14 : L.raio); g.fillStyle = cor(L.fundo || '#ffffff', ctx); g.fill(); }
            g.shadowColor = 'transparent'; if (rec.qr) g.drawImage(rec.qr, c.x, c.y, t, t); else qrFalso(g, c.x, c.y, t);
            break;
        }
        case 'grao': { const r = sorteio(L.semente || 11), q = L.q || 7000; g.fillStyle = cor(L.cor || '#000000', ctx); g.globalAlpha = L.op == null ? 0.06 : L.op; for (let i = 0; i < q; i++) g.fillRect(r() * W, r() * H, 2, 2); break; }
        case 'meiotom': {
            g.beginPath(); g.rect(c.x, c.y, c.w, c.h); g.clip(); g.fillStyle = cor(L.cor, ctx); if (L.op == null) g.globalAlpha = 0.22;
            const passo = L.passo || 26, canto = L.canto || 'se', cx = canto.endsWith('e') ? c.x + c.w : c.x, cy = canto.startsWith('s') ? c.y + c.h : c.y, max = Math.hypot(c.w, c.h) || 1;
            for (let j = 0; j * passo < c.h + passo; j++) for (let i = 0; i < c.w / passo + 1; i++) { const px = c.x + i * passo + (j % 2 ? passo / 2 : 0), py = c.y + j * passo, k = 1 - Math.hypot(px - cx, py - cy) / max, raio = Math.max(0, k * passo * 0.5); if (raio > 0.8) { g.beginPath(); g.arc(px, py, raio, 0, Math.PI * 2); g.fill(); } }
            break;
        }
        case 'guilloche': {
            g.beginPath(); g.rect(c.x, c.y, c.w, c.h); g.clip(); g.strokeStyle = cor(L.cor, ctx); if (L.op == null) g.globalAlpha = 0.16; g.lineWidth = 1.6; const n = L.linhas || 14;
            for (let k = 0; k < n; k++) { g.beginPath(); for (let i = 0; i <= c.w; i += 6) { const yy = c.y + c.h * (0.1 + 0.8 * k / Math.max(1, n - 1)) + Math.sin(i / 38 + k * 0.55) * c.h * 0.1 + Math.sin(i / 17 - k) * c.h * 0.03; if (i) g.lineTo(c.x + i, yy); else g.moveTo(c.x, yy); } g.stroke(); }
            break;
        }
        case 'listras': {
            g.beginPath(); g.rect(c.x, c.y, c.w, c.h); g.clip(); const n = Math.max(1, L.n || 8), vert = L.dir === 'v';
            for (let i = 0; i < n; i++) { g.fillStyle = cor(i % 2 ? L.cor2 : L.cor1, ctx); if (vert) g.fillRect(c.x, c.y + i * (c.h / n), c.w, c.h / n + 1); else g.fillRect(c.x + i * (c.w / n), c.y, c.w / n + 1, c.h); }
            break;
        }
        case 'confete': {
            const r = sorteio(L.semente || 7), cores = (L.cores && L.cores.length ? L.cores : ['#ffffff']).map((x) => cor(x, ctx)), n = L.n || 100;
            g.beginPath(); g.rect(c.x, c.y, c.w, c.h); g.clip();
            for (let i = 0; i < n; i++) { const x = c.x + r() * c.w, y = c.y + r() * c.h, s = (L.tam || 22) * (0.45 + r() * 0.55); g.save(); g.translate(x, y); g.rotate(r() * Math.PI); g.fillStyle = cores[Math.floor(r() * cores.length)]; g.globalAlpha = (L.op == null ? 1 : L.op) * (0.55 + r() * 0.45); if (r() > 0.5) g.fillRect(-s / 2, -s / 4, s, s / 2); else { g.beginPath(); g.arc(0, 0, s / 2.4, 0, Math.PI * 2); g.fill(); } g.restore(); }
            break;
        }
        case 'arcos': { g.strokeStyle = cor(L.cor, ctx); g.lineWidth = L.larg || 3; const n = L.n || 4; for (let i = 0; i < n; i++) { g.beginPath(); g.arc(c.x + c.w / 2, c.y + c.h / 2, (L.r0 || 100) + i * (L.passo || 60), 0, Math.PI * 2); g.stroke(); } break; }
        case 'campo': {
            g.strokeStyle = cor(L.cor, ctx); g.lineWidth = L.larg || 6; const pad = L.pad == null ? 0 : L.pad, x = c.x + pad, y = c.y + pad, w = c.w - pad * 2, h = c.h - pad * 2;
            g.strokeRect(x, y, w, h);
            if (c.w >= c.h) { g.beginPath(); g.moveTo(x + w / 2, y); g.lineTo(x + w / 2, y + h); g.stroke(); g.beginPath(); g.arc(x + w / 2, y + h / 2, Math.min(w, h) * 0.2, 0, Math.PI * 2); g.stroke(); g.strokeRect(x, y + h * 0.3, w * 0.12, h * 0.4); g.strokeRect(x + w * 0.88, y + h * 0.3, w * 0.12, h * 0.4); }
            else { g.beginPath(); g.moveTo(x, y + h / 2); g.lineTo(x + w, y + h / 2); g.stroke(); g.beginPath(); g.arc(x + w / 2, y + h / 2, Math.min(w, h) * 0.36, 0, Math.PI * 2); g.stroke(); }
            break;
        }
        case 'foil': g.fillStyle = (() => { const d = g.createLinearGradient(c.x, 0, c.x + c.w, 0); ['#d9c27a', '#fff4c2', '#b89a45', '#f6e7a8', '#c9ab5a'].forEach((k, i) => d.addColorStop(i / 4, k)); return d; })(); g.fillRect(c.x, c.y, c.w, c.h); break;
        case 'balao': {
            const rx = c.w / 2, ry = c.h / 2, cx = c.x + rx, cy = c.y + ry;
            g.strokeStyle = cor(L.fio || 'rgba(0,0,0,0.3)', ctx); g.lineWidth = 3; g.beginPath(); g.moveTo(cx, cy + ry * 1.02); g.bezierCurveTo(cx - 30, cy + ry * 1.7, cx + 30, cy + ry * 2.2, cx - 8, cy + ry * 2.8); g.stroke();
            g.fillStyle = estilo(g, L.fill, c, ctx, W, H); g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.fill();
            g.beginPath(); g.moveTo(cx - 12, cy + ry * 0.98); g.lineTo(cx + 12, cy + ry * 0.98); g.lineTo(cx, cy + ry * 1.16); g.closePath(); g.fill();
            g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(cx - rx * 0.42, cy - ry * 0.45, rx * 0.17, ry * 0.3, -0.5, 0, Math.PI * 2); g.fill();
            if (L.txt) { g.shadowColor = 'transparent'; escreve(g, { t: 'texto', txt: L.txt, x: c.x, y: cy - (L.tam || 100) * 0.62, w: c.w, tam: L.tam || 100, peso: L.peso || 900, cor: L.cor || '#ffffff', al: 'center', fam: L.fam }, ctx, vars); }
            break;
        }
        default: break;
    }
    g.restore();
}
function preenchePlaca(g, c, L, ctx) { caminhoRet(g, c.x, c.y, c.w, c.h, L.raio == null ? 22 : L.raio); g.fillStyle = cor(L.placaCor || '#ffffff', ctx); g.fill(); }

/** Desenha uma lista de camadas num canvas de W x H. rec = { foto, logo, qr } (imagens já carregadas). */
export function desenha(g, camadas, ctx, rec, dados, W, H) {
    const vars = variaveis(dados || {});
    for (const L of camadas || []) {
        if (L.oculto) continue;
        if (L.se === 'logo' && !rec.logo) continue;
        if (L.se === 'foto' && !rec.foto) continue;
        if (L.se === 'semfoto' && rec.foto) continue;
        if (L.se === 'idade' && !vars.idade) continue;
        try { camada(g, L, ctx, rec || {}, vars, W, H); } catch (e) { /* uma camada com defeito não derruba a arte */ }
    }
}

/** Camadas de um lado do modelo ('frente' | 'verso'; aniversário usa só as próprias camadas). */
export function camadasDe(modelo, lado) { return modelo.lados ? (modelo.lados[lado || 'frente'] || []) : (modelo.camadas || []); }

/** Desenha o modelo num canvas novo. opcoes = { paleta, tema (objeto do catálogo), lado, recursos: { foto, logo, qr } } */
export function renderiza(modelo, dados, opcoes) {
    const o = opcoes || {}, W = modelo.w, H = modelo.h, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'), ctx = contextoCores(o.paleta, o.tema);
    desenha(g, camadasDe(modelo, o.lado), ctx, o.recursos || {}, dados, W, H);
    return c;
}

// ---------------- catálogo ----------------
/** Lista de opções para a galeria da escola: cada modelo ativo combinado com cada tema permitido. */
export function listaModelos(catalogo, tipo) {
    const temas = (catalogo.temas && catalogo.temas[tipo]) || [], out = [];
    for (const m of catalogo[tipo] || []) {
        if (m.ativo === false) continue;
        const ids = m.temas && m.temas.length ? m.temas : temas.map((t) => t.id);
        for (const id of ids) { const t = temas.find((x) => x.id === id); if (t) out.push({ id: `${m.id}-${t.id}`, nome: `${m.nome} · ${t.nome}`, grupo: m.nome }); }
    }
    return out;
}
/** Acha modelo e tema a partir do id "modelo-tema" (o id do modelo pode ter hífen: o tema é o último pedaço). */
export function resolveId(catalogo, tipo, id) {
    const i = String(id || '').lastIndexOf('-'); if (i < 0) return null;
    const mid = id.slice(0, i), tid = id.slice(i + 1), modelo = (catalogo[tipo] || []).find((m) => m.id === mid), tema = ((catalogo.temas || {})[tipo] || []).find((t) => t.id === tid);
    return modelo && tema ? { modelo, tema } : null;
}
