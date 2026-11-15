import { ESCOLA as E, FONTE, LOGO_URL, acento, alfa, capa, degrade, dentro, fonte, imagem, mistura, preenche, primeiroNome, sobre, sorteio, tela, texto, visivel, type Ctx } from './base';

// Arte de aniversário em vários modelos, no formato de post (1080 x 1350).
export const L = 1080, A = 1350;
export interface DadosAniversario { nome: string; fotoUrl?: string | null }

export const MODELOS_ANIVERSARIO = [
    { id: 'festa', nome: 'Festa', resumo: 'Confete nas cores da escola' },
    { id: 'campo', nome: 'Campo', resumo: 'Gramado e círculo central' },
    { id: 'craque', nome: 'Craque do dia', resumo: 'Escuro, com faixas' },
    { id: 'baloes', nome: 'Balões', resumo: 'Claro e alegre' },
    { id: 'polaroid', nome: 'Polaroid', resumo: 'Foto colada e letra à mão' },
    { id: 'limpa', nome: 'Limpa', resumo: 'Foto grande e texto simples' }
] as const;
export type ModeloAniversario = typeof MODELOS_ANIVERSARIO[number]['id'];
export const MODELO_ANIVERSARIO_PADRAO: ModeloAniversario = 'festa';
export const modeloAniversarioValido = (m?: string): ModeloAniversario => (MODELOS_ANIVERSARIO.some((x) => x.id === m) ? (m as ModeloAniversario) : MODELO_ANIVERSARIO_PADRAO);

const FESTA = '"DucksFiesta", ' + FONTE, MAO = '"BeneathTheSilence", ' + FONTE;
interface Rec { foto: HTMLImageElement | null; logo: HTMLImageElement | null }

function confete(g: Ctx, cores: string[], n: number, semente: number, yMax = A) {
    const r = sorteio(semente);
    for (let i = 0; i < n; i++) {
        const x = r() * L, y = r() * yMax, t = 10 + r() * 22;
        g.save(); g.translate(x, y); g.rotate(r() * Math.PI); g.fillStyle = cores[Math.floor(r() * cores.length)]; g.globalAlpha = 0.55 + r() * 0.45;
        if (r() > 0.5) g.fillRect(-t / 2, -t / 4, t, t / 2); else { g.beginPath(); g.arc(0, 0, t / 2.4, 0, Math.PI * 2); g.fill(); }
        g.restore();
    }
}
function balao(g: Ctx, x: number, y: number, t: number, cor: string) {
    g.strokeStyle = alfa('#10213f', 0.25); g.lineWidth = 3; g.beginPath(); g.moveTo(x, y + t * 1.2); g.bezierCurveTo(x - 30, y + t * 2, x + 30, y + t * 2.6, x - 8, y + t * 3.4); g.stroke();
    g.fillStyle = cor; g.beginPath(); g.ellipse(x, y, t, t * 1.2, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(x - 12, y + t * 1.18); g.lineTo(x + 12, y + t * 1.18); g.lineTo(x, y + t * 1.36); g.closePath(); g.fill();
    g.fillStyle = alfa('#ffffff', 0.35); g.beginPath(); g.ellipse(x - t * 0.35, y - t * 0.45, t * 0.18, t * 0.32, -0.5, 0, Math.PI * 2); g.fill();
}
/** Rodapé comum: logo da escola e o nome dela. */
function assinatura(g: Ctx, r: Rec, cor: string, y = A - 150) {
    dentro(g, r.logo, L / 2 - 110, y, 220, 90);
    texto(g, E.nome, L / 2, y + 122, { tam: 26, cor, peso: 700, alinhar: 'center', max: L - 160 });
}

const MODELOS: Record<ModeloAniversario, (g: Ctx, d: DadosAniversario, r: Rec) => void> = {
    festa(g, d, r) {
        const ac = acento(E.escura);
        g.fillStyle = degrade(g, 0, 0, L, A, E.secundaria, E.escura); g.fillRect(0, 0, L, A);
        confete(g, [ac, '#ffffff', acento(E.secundaria)], 150, 7);
        texto(g, 'Parabéns', L / 2, 190, { tam: 150, cor: '#fff', fam: FESTA, peso: 400, alinhar: 'center', max: L - 120 });
        texto(g, primeiroNome(d.nome), L / 2, 316, { tam: 112, cor: ac, fam: FESTA, peso: 400, alinhar: 'center', max: L - 140 });
        g.save(); g.translate(L / 2, 720); g.rotate(-0.03); g.shadowColor = alfa('#000000', 0.35); g.shadowBlur = 40; g.shadowOffsetY = 16; preenche(g, -310, -330, 620, 660, 46, '#fff'); g.restore();
        g.save(); g.translate(L / 2, 720); g.rotate(-0.03); capa(g, r.foto, -286, -306, 572, 612, 30); g.restore();
        texto(g, 'Hoje o dia é todo seu!', L / 2, 1150, { tam: 42, cor: '#fff', peso: 700, alinhar: 'center' });
        assinatura(g, r, alfa('#ffffff', 0.8), 1190);
    },
    campo(g, d, r) {
        const v1 = E.primaria, v2 = mistura(E.primaria, '#000000', 0.14);
        for (let i = 0; i < 9; i++) { g.fillStyle = i % 2 ? v1 : v2; g.fillRect(0, i * (A / 9), L, A / 9 + 1); }
        g.strokeStyle = alfa('#ffffff', 0.45); g.lineWidth = 8; g.strokeRect(50, 50, L - 100, A - 100);
        g.beginPath(); g.moveTo(50, 700); g.lineTo(L - 50, 700); g.stroke(); g.beginPath(); g.arc(L / 2, 700, 360, 0, Math.PI * 2); g.stroke();
        texto(g, 'Feliz aniversário', L / 2, 200, { tam: 96, cor: '#fff', fam: FESTA, peso: 400, alinhar: 'center', max: L - 180 });
        g.save(); g.shadowColor = alfa('#000000', 0.3); g.shadowBlur = 36; g.shadowOffsetY = 14; g.fillStyle = '#fff'; g.beginPath(); g.arc(L / 2, 700, 320, 0, Math.PI * 2); g.fill(); g.restore();
        capa(g, r.foto, L / 2 - 296, 404, 592, 592, 296);
        const nome = primeiroNome(d.nome); g.font = `900 92px ${FONTE}`; const larg = Math.min(L - 160, Math.max(420, g.measureText(nome.toUpperCase()).width + 120));
        preenche(g, L / 2 - larg / 2, 1010, larg, 136, 68, E.destaque);
        texto(g, nome, L / 2, 1112, { tam: 92, cor: sobre(E.destaque, '#fff', E.escura), peso: 900, alinhar: 'center', max: larg - 80, caixaAlta: true });
        assinatura(g, r, '#fff', 1180);
    },
    craque(g, d, r) {
        const fundo = mistura(E.escura, '#000000', 0.45), ac = acento(fundo);
        g.fillStyle = fundo; g.fillRect(0, 0, L, A);
        [[E.primaria, -200, 60], [ac, -60, 24], [E.secundaria, 40, 60]].forEach(([c, dx, w]) => { g.fillStyle = c as string; g.beginPath(); g.moveTo(1120 + +dx, 0); g.lineTo(1120 + +dx + +w, 0); g.lineTo(700 + +dx + +w, A); g.lineTo(700 + +dx, A); g.closePath(); g.fill(); });
        g.fillStyle = alfa('#000000', 0.35); g.fillRect(0, 0, L, A);
        texto(g, 'Craque do dia', 80, 150, { tam: 38, cor: ac, peso: 900, espaco: 8, caixaAlta: true });
        texto(g, 'Parabéns,', 80, 268, { tam: 110, cor: '#fff', peso: 900, max: L - 160 });
        texto(g, primeiroNome(d.nome) + '!', 80, 392, { tam: 128, cor: ac, peso: 900, max: L - 160, caixaAlta: true });
        preenche(g, 80, 452, L - 160, 640, 34, ac); capa(g, r.foto, 92, 464, L - 184, 616, 24);
        texto(g, 'Que venham muitos gols e conquistas.', 80, 1170, { tam: 38, cor: '#fff', peso: 600, max: L - 160 });
        dentro(g, r.logo, 80, 1206, 200, 96, 'esquerda');
        texto(g, E.nome, L - 80, 1266, { tam: 26, cor: alfa('#ffffff', 0.75), peso: 700, alinhar: 'right', max: L - 400 });
    },
    baloes(g, d, r) {
        g.fillStyle = degrade(g, 0, 0, 0, A, mistura(E.secundaria, '#ffffff', 0.86), '#ffffff'); g.fillRect(0, 0, L, A);
        const cores = [visivel(E.primaria), E.secundaria, E.destaque, mistura(E.primaria, E.secundaria, 0.5)];
        [[120, 250, 74, 0], [270, 150, 60, 2], [L - 130, 230, 78, 1], [L - 290, 140, 58, 3], [80, 760, 56, 2], [L - 90, 800, 60, 0]].forEach(([x, y, t, c]) => balao(g, x, y, t, cores[c]));
        texto(g, 'Feliz', L / 2, 300, { tam: 120, cor: E.escura, fam: FESTA, peso: 400, alinhar: 'center' });
        texto(g, 'aniversário!', L / 2, 410, { tam: 120, cor: visivel(E.primaria), fam: FESTA, peso: 400, alinhar: 'center', max: L - 200 });
        g.save(); g.shadowColor = alfa(E.escura, 0.25); g.shadowBlur = 40; g.shadowOffsetY = 18; g.fillStyle = '#fff'; g.beginPath(); g.arc(L / 2, 760, 300, 0, Math.PI * 2); g.fill(); g.restore();
        capa(g, r.foto, L / 2 - 276, 484, 552, 552, 276);
        texto(g, primeiroNome(d.nome), L / 2, 1150, { tam: 104, cor: E.escura, peso: 900, alinhar: 'center', max: L - 160 });
        confete(g, cores, 50, 21, 420);
        assinatura(g, r, '#5b6880', 1190);
    },
    polaroid(g, d, r) {
        g.fillStyle = '#f6f1e7'; g.fillRect(0, 0, L, A);
        const rd = sorteio(3); g.fillStyle = alfa(E.escura, 0.05); for (let i = 0; i < 260; i++) g.fillRect(rd() * L, rd() * A, 3, 3);
        texto(g, 'Feliz aniversário', L / 2, 210, { tam: 130, cor: E.escura, fam: MAO, peso: 400, alinhar: 'center', max: L - 140 });
        g.save(); g.translate(L / 2, 700); g.rotate(-0.045); g.shadowColor = alfa('#000000', 0.28); g.shadowBlur = 44; g.shadowOffsetY = 20; g.fillStyle = '#fff'; g.fillRect(-350, -400, 700, 840); g.restore();
        g.save(); g.translate(L / 2, 700); g.rotate(-0.045); capa(g, r.foto, -310, -360, 620, 620, 0);
        texto(g, primeiroNome(d.nome), 0, 384, { tam: 110, cor: '#2a2a2a', fam: MAO, peso: 400, alinhar: 'center', max: 600 });
        g.fillStyle = alfa(E.destaque, 0.85); g.rotate(0.07); g.fillRect(-120, -440, 240, 64); g.restore();
        texto(g, 'com carinho de toda a equipe', L / 2, 1190, { tam: 34, cor: '#6b6256', peso: 600, alinhar: 'center' });
        assinatura(g, r, '#6b6256', 1210);
    },
    limpa(g, d, r) {
        g.fillStyle = '#fff'; g.fillRect(0, 0, L, A);
        capa(g, r.foto, 0, 0, L, 830, 0);
        g.fillStyle = degrade(g, 0, 560, 0, 830, alfa('#ffffff', 0), '#ffffff'); g.fillRect(0, 560, L, 272);
        g.fillStyle = visivel(E.primaria); g.fillRect(80, 880, 110, 10);
        texto(g, 'Feliz aniversário,', 80, 990, { tam: 64, cor: '#5b6880', peso: 600, max: L - 160 });
        texto(g, primeiroNome(d.nome) + '!', 80, 1120, { tam: 132, cor: E.escura, peso: 900, max: L - 160 });
        dentro(g, r.logo, 80, 1190, 180, 96, 'esquerda');
        texto(g, E.nome, L - 80, 1250, { tam: 26, cor: '#7a879c', peso: 700, alinhar: 'right', max: L - 380 });
    }
};

/** Desenha a arte de aniversário no modelo escolhido. */
export async function desenharAniversario(modelo: string, d: DadosAniversario): Promise<HTMLCanvasElement> {
    const m = modeloAniversarioValido(modelo), [c, g] = tela(L, A);
    const [foto, logo] = await Promise.all([imagem(d.fotoUrl), imagem(LOGO_URL), fonte('DucksFiesta', '/Ducks Fiesta.ttf'), fonte('BeneathTheSilence', '/Beneath the Silence.ttf')]);
    MODELOS[m](g, d, { foto, logo });
    return c;
}
