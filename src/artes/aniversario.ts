import { ESCOLA as E, FONTE, LOGO_URL, acento, alfa, capa, degrade, dentro, fonte, imagem, marcaSobre, mistura, preenche, primeiroNome, sobre, sorteio, tela, texto, type Ctx } from './base';

// Arte de aniversário. Cada modelo é um FORMATO (a composição) combinado com um TEMA (as cores):
// 7 formatos x 7 temas = 49 modelos, no formato de post (1080 x 1350).
export const L = 1080, A = 1350;
export interface DadosAniversario { nome: string; fotoUrl?: string | null }

/** Cores de um tema: fundo em degradê (f1 -> f2), texto, destaque e as cores dos enfeites. */
interface Tema { f1: string; f2: string; tinta: string; suave: string; ac: string; marca: string; enfeites: string[] }
const monta = (f1: string, f2: string, ac?: string): Tema => {
    const meio = mistura(f1, f2, 0.5), tinta = sobre(meio), a = ac || acento(meio), marca = ac || marcaSobre(meio);
    return { f1, f2, tinta, suave: mistura(tinta, meio, 0.35), ac: a, marca, enfeites: [a, tinta, marca] };
};
const TEMAS = {
    escola: { nome: 'Escola', cores: () => monta(E.secundaria, E.escura) },
    primaria: { nome: 'Primária', cores: () => monta(E.primaria, mistura(E.primaria, '#000000', 0.4)) },
    destaque: { nome: 'Destaque', cores: () => monta(E.destaque, mistura(E.destaque, '#000000', 0.2)) },
    noite: { nome: 'Noite', cores: () => monta(mistura(E.escura, '#000000', 0.6), '#000000') },
    clara: { nome: 'Clara', cores: () => monta(mistura(E.secundaria, '#ffffff', 0.88), '#ffffff') },
    papel: { nome: 'Papel', cores: () => monta('#f6f1e7', '#efe6d4') },
    ouro: { nome: 'Ouro', cores: () => monta('#17181d', '#000000', '#d4a72c') }
} as const;
type IdTema = keyof typeof TEMAS;

const FESTA = '"DucksFiesta", ' + FONTE, MAO = '"BeneathTheSilence", ' + FONTE;
interface Rec { foto: HTMLImageElement | null; logo: HTMLImageElement | null }
type Desenho = (g: Ctx, d: DadosAniversario, r: Rec, t: Tema) => void;

const fundo = (g: Ctx, t: Tema) => { g.fillStyle = degrade(g, 0, 0, L, A, t.f1, t.f2); g.fillRect(0, 0, L, A); };
function confete(g: Ctx, cores: string[], n: number, semente: number, yMax = A) {
    const r = sorteio(semente);
    for (let i = 0; i < n; i++) {
        const x = r() * L, y = r() * yMax, s = 10 + r() * 22;
        g.save(); g.translate(x, y); g.rotate(r() * Math.PI); g.fillStyle = cores[Math.floor(r() * cores.length)]; g.globalAlpha = 0.55 + r() * 0.45;
        if (r() > 0.5) g.fillRect(-s / 2, -s / 4, s, s / 2); else { g.beginPath(); g.arc(0, 0, s / 2.4, 0, Math.PI * 2); g.fill(); }
        g.restore();
    }
}
function balao(g: Ctx, x: number, y: number, s: number, cor: string, fio: string) {
    g.strokeStyle = fio; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y + s * 1.2); g.bezierCurveTo(x - 30, y + s * 2, x + 30, y + s * 2.6, x - 8, y + s * 3.4); g.stroke();
    g.fillStyle = cor; g.beginPath(); g.ellipse(x, y, s, s * 1.2, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(x - 12, y + s * 1.18); g.lineTo(x + 12, y + s * 1.18); g.lineTo(x, y + s * 1.36); g.closePath(); g.fill();
    g.fillStyle = alfa('#ffffff', 0.35); g.beginPath(); g.ellipse(x - s * 0.35, y - s * 0.45, s * 0.18, s * 0.32, -0.5, 0, Math.PI * 2); g.fill();
}
/** Rodapé comum: logo da escola e o nome dela. */
function assinatura(g: Ctx, r: Rec, cor: string, y = A - 150) {
    dentro(g, r.logo, L / 2 - 190, y - 30, 380, 150);
    texto(g, E.nome, L / 2, y + 138, { tam: 28, cor, peso: 700, alinhar: 'center', max: L - 160 });
}
/** Foto redonda com aro. */
function fotoRedonda(g: Ctx, r: Rec, cx: number, cy: number, raio: number, aro: string, espessura = 24) {
    g.save(); g.shadowColor = alfa('#000000', 0.28); g.shadowBlur = 38; g.shadowOffsetY = 16; g.fillStyle = aro; g.beginPath(); g.arc(cx, cy, raio + espessura, 0, Math.PI * 2); g.fill(); g.restore();
    capa(g, r.foto, cx - raio, cy - raio, raio * 2, raio * 2, raio);
}

const FORMATOS: Record<string, { nome: string; desenha: Desenho }> = {
    festa: { nome: 'Festa', desenha(g, d, r, t) {
        fundo(g, t); confete(g, t.enfeites, 150, 7);
        texto(g, 'Parabéns', L / 2, 190, { tam: 150, cor: t.tinta, fam: FESTA, peso: 400, alinhar: 'center', max: L - 120 });
        texto(g, primeiroNome(d.nome), L / 2, 316, { tam: 112, cor: t.ac, fam: FESTA, peso: 400, alinhar: 'center', max: L - 140 });
        g.save(); g.translate(L / 2, 720); g.rotate(-0.03); g.shadowColor = alfa('#000000', 0.35); g.shadowBlur = 40; g.shadowOffsetY = 16; preenche(g, -310, -330, 620, 660, 46, '#fff'); g.restore();
        g.save(); g.translate(L / 2, 720); g.rotate(-0.03); capa(g, r.foto, -286, -306, 572, 612, 30); g.restore();
        texto(g, 'Hoje o dia é todo seu!', L / 2, 1150, { tam: 42, cor: t.tinta, peso: 700, alinhar: 'center' });
        assinatura(g, r, t.suave, 1190);
    } },
    campo: { nome: 'Campo', desenha(g, d, r, t) {
        const v2 = mistura(t.f1, t.tinta === '#ffffff' ? '#000000' : '#ffffff', 0.14);
        for (let i = 0; i < 9; i++) { g.fillStyle = i % 2 ? t.f1 : v2; g.fillRect(0, i * (A / 9), L, A / 9 + 1); }
        g.strokeStyle = alfa(t.tinta, 0.45); g.lineWidth = 8; g.strokeRect(50, 50, L - 100, A - 100);
        g.beginPath(); g.moveTo(50, 700); g.lineTo(L - 50, 700); g.stroke(); g.beginPath(); g.arc(L / 2, 700, 360, 0, Math.PI * 2); g.stroke();
        texto(g, 'Feliz aniversário', L / 2, 200, { tam: 96, cor: t.tinta, fam: FESTA, peso: 400, alinhar: 'center', max: L - 180 });
        fotoRedonda(g, r, L / 2, 700, 296, '#fff');
        const nome = primeiroNome(d.nome).toUpperCase(); g.font = `900 92px ${FONTE}`; const larg = Math.min(L - 160, Math.max(420, g.measureText(nome).width + 120));
        preenche(g, L / 2 - larg / 2, 1010, larg, 136, 68, t.ac);
        texto(g, nome, L / 2, 1112, { tam: 92, cor: sobre(t.ac), peso: 900, alinhar: 'center', max: larg - 80 });
        assinatura(g, r, t.tinta, 1180);
    } },
    craque: { nome: 'Craque do dia', desenha(g, d, r, t) {
        fundo(g, t);
        [[t.marca, -200, 60], [t.ac, -60, 24], [alfa(t.tinta, 0.25), 40, 60]].forEach(([c, dx, w]) => { g.fillStyle = c as string; g.beginPath(); g.moveTo(1300 + +dx, 0); g.lineTo(1300 + +dx + +w, 0); g.lineTo(1000 + +dx + +w, A); g.lineTo(1000 + +dx, A); g.closePath(); g.fill(); });
        texto(g, 'Craque do dia', 80, 150, { tam: 38, cor: t.ac, peso: 900, espaco: 8, caixaAlta: true });
        texto(g, 'Parabéns,', 80, 268, { tam: 110, cor: t.tinta, peso: 900, max: L - 160 });
        texto(g, primeiroNome(d.nome) + '!', 80, 392, { tam: 128, cor: t.ac, peso: 900, max: L - 160, caixaAlta: true });
        preenche(g, 80, 452, L - 160, 640, 34, t.ac); capa(g, r.foto, 92, 464, L - 184, 616, 24);
        texto(g, 'Que venham muitos gols e conquistas.', 80, 1170, { tam: 38, cor: t.tinta, peso: 600, max: L - 160 });
        dentro(g, r.logo, 70, 1184, 330, 150, 'esquerda');
        texto(g, E.nome, L - 80, 1270, { tam: 26, cor: t.suave, peso: 700, alinhar: 'right', max: L - 520 });
    } },
    baloes: { nome: 'Balões', desenha(g, d, r, t) {
        g.fillStyle = degrade(g, 0, 0, 0, A, t.f1, t.f2); g.fillRect(0, 0, L, A);
        const cores = [t.ac, t.marca, mistura(t.ac, t.marca, 0.5), mistura(t.ac, t.tinta, 0.35)], fio = alfa(t.tinta, 0.3);
        [[120, 250, 74, 0], [270, 150, 60, 2], [L - 130, 230, 78, 1], [L - 290, 140, 58, 3], [80, 760, 56, 2], [L - 90, 800, 60, 0]].forEach(([x, y, s, c]) => balao(g, x, y, s, cores[c], fio));
        texto(g, 'Feliz', L / 2, 300, { tam: 120, cor: t.tinta, fam: FESTA, peso: 400, alinhar: 'center' });
        texto(g, 'aniversário!', L / 2, 410, { tam: 120, cor: t.ac, fam: FESTA, peso: 400, alinhar: 'center', max: L - 200 });
        fotoRedonda(g, r, L / 2, 760, 276, '#fff');
        texto(g, primeiroNome(d.nome), L / 2, 1150, { tam: 104, cor: t.tinta, peso: 900, alinhar: 'center', max: L - 160 });
        confete(g, cores, 50, 21, 420);
        assinatura(g, r, t.suave, 1190);
    } },
    polaroid: { nome: 'Polaroid', desenha(g, d, r, t) {
        fundo(g, t);
        const rd = sorteio(3); g.fillStyle = alfa(t.tinta, 0.05); for (let i = 0; i < 260; i++) g.fillRect(rd() * L, rd() * A, 3, 3);
        texto(g, 'Feliz aniversário', L / 2, 210, { tam: 130, cor: t.tinta, fam: MAO, peso: 400, alinhar: 'center', max: L - 140 });
        g.save(); g.translate(L / 2, 700); g.rotate(-0.045); g.shadowColor = alfa('#000000', 0.28); g.shadowBlur = 44; g.shadowOffsetY = 20; g.fillStyle = '#fff'; g.fillRect(-350, -400, 700, 840); g.restore();
        g.save(); g.translate(L / 2, 700); g.rotate(-0.045); capa(g, r.foto, -310, -360, 620, 620, 0);
        texto(g, primeiroNome(d.nome), 0, 384, { tam: 110, cor: '#2a2a2a', fam: MAO, peso: 400, alinhar: 'center', max: 600 });
        g.fillStyle = alfa(t.ac, 0.85); g.rotate(0.07); g.fillRect(-120, -440, 240, 64); g.restore();
        texto(g, 'com carinho de toda a equipe', L / 2, 1168, { tam: 34, cor: t.suave, peso: 600, alinhar: 'center' });
        assinatura(g, r, t.suave, 1210);
    } },
    limpa: { nome: 'Limpa', desenha(g, d, r, t) {
        g.fillStyle = t.f1; g.fillRect(0, 0, L, A);
        capa(g, r.foto, 0, 0, L, 830, 0);
        g.fillStyle = degrade(g, 0, 560, 0, 830, alfa(t.f1, 0), t.f1); g.fillRect(0, 560, L, 272);
        g.fillStyle = t.ac; g.fillRect(80, 880, 110, 10);
        texto(g, 'Feliz aniversário,', 80, 990, { tam: 64, cor: t.suave, peso: 600, max: L - 160 });
        texto(g, primeiroNome(d.nome) + '!', 80, 1120, { tam: 132, cor: t.tinta, peso: 900, max: L - 160 });
        dentro(g, r.logo, 70, 1170, 340, 160, 'esquerda');
        texto(g, E.nome, L - 80, 1260, { tam: 26, cor: t.suave, peso: 700, alinhar: 'right', max: L - 520 });
    } },
    faixas: { nome: 'Faixas', desenha(g, d, r, t) {
        fundo(g, t);
        const canto = (cor: string, a: number, b: number, baixo: boolean) => { g.fillStyle = cor; g.beginPath(); if (baixo) { g.moveTo(L, A - a); g.lineTo(L, A - b); g.lineTo(L - b, A); g.lineTo(L - a, A); } else { g.moveTo(0, a); g.lineTo(0, b); g.lineTo(b, 0); g.lineTo(a, 0); } g.closePath(); g.fill(); };
        canto(t.ac, 250, 330, false); canto(t.marca, 370, 410, false); canto(t.ac, 250, 330, true); canto(t.marca, 370, 410, true);
        texto(g, 'Feliz aniversário', L / 2, 230, { tam: 44, cor: t.ac, peso: 900, alinhar: 'center', espaco: 10, caixaAlta: true, max: L - 300 });
        fotoRedonda(g, r, L / 2, 640, 300, t.ac, 18);
        texto(g, primeiroNome(d.nome), L / 2, 1120, { tam: 150, cor: t.tinta, peso: 900, alinhar: 'center', max: L - 160, caixaAlta: true });
        g.fillStyle = t.ac; g.fillRect(L / 2 - 70, 1150, 140, 8);
        assinatura(g, r, t.suave, 1190);
    } }
};

/** Todos os modelos: id "formato-tema", nome "Formato · Tema" e o grupo (formato) para o filtro da galeria. */
export const MODELOS_ANIVERSARIO = Object.keys(FORMATOS).flatMap((f) => (Object.keys(TEMAS) as IdTema[]).map((t) => ({ id: `${f}-${t}`, nome: `${FORMATOS[f].nome} · ${TEMAS[t].nome}`, grupo: FORMATOS[f].nome })));
export const MODELO_ANIVERSARIO_PADRAO = 'festa-escola';
// Escolhas gravadas antes de existirem os temas.
const ANTIGOS: Record<string, string> = { festa: 'festa-escola', campo: 'campo-primaria', craque: 'craque-noite', baloes: 'baloes-clara', polaroid: 'polaroid-papel', limpa: 'limpa-clara' };
export const modeloAniversarioValido = (m?: string): string => { const x = ANTIGOS[m || ''] || m || ''; return MODELOS_ANIVERSARIO.some((y) => y.id === x) ? x : MODELO_ANIVERSARIO_PADRAO; };

/** Desenha a arte de aniversário no modelo escolhido. */
export async function desenharAniversario(modelo: string, d: DadosAniversario): Promise<HTMLCanvasElement> {
    const [f, t] = modeloAniversarioValido(modelo).split('-') as [string, IdTema], [c, g] = tela(L, A);
    const [foto, logo] = await Promise.all([imagem(d.fotoUrl), imagem(LOGO_URL), fonte('DucksFiesta', '/Ducks Fiesta.ttf'), fonte('BeneathTheSilence', '/Beneath the Silence.ttf')]);
    FORMATOS[f].desenha(g, d, { foto, logo }, TEMAS[t].cores());
    return c;
}
