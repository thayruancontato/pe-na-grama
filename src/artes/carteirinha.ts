import QRCode from 'qrcode';
import { formatModalidade } from '../utils/modalidadeUtils';
import { ESCOLA as E, LOGO_URL, acento, alfa, capa, caixa, degrade, dentro, imagem, mistura, nomeCurto, preenche, sobre, tela, texto, visivel, type Ctx } from './base';

// Carteirinha do aluno em vários modelos. Tamanho de cartão (85,6 x 54 mm) a 300 dpi.
export const L = 1012, A = 638;

export interface DadosCarteirinha {
    nome: string; cpf?: string; dataNascimento?: string; fotoUrl?: string; numeroCota?: string; modalidade?: string | string[];
    responsavel?: { nome?: string; cpf?: string; telefonePrincipal?: string; telefone?: string; email?: string; endereco?: { rua?: string; numero?: string; bairro?: string; cidade?: string; estado?: string; uf?: string } };
}
export const MODELOS_CARTEIRINHA = [
    { id: 'faixa', nome: 'Clássica', resumo: 'Faixa da escola no topo' },
    { id: 'lateral', nome: 'Lateral', resumo: 'Coluna colorida com a foto' },
    { id: 'noite', nome: 'Noite', resumo: 'Fundo escuro com destaque' },
    { id: 'esportiva', nome: 'Esportiva', resumo: 'Corte diagonal' },
    { id: 'campo', nome: 'Campo', resumo: 'Linhas de campo ao fundo' },
    { id: 'limpa', nome: 'Limpa', resumo: 'Branca e discreta' }
] as const;
export type ModeloCarteirinha = typeof MODELOS_CARTEIRINHA[number]['id'];
export const MODELO_CARTEIRINHA_PADRAO: ModeloCarteirinha = 'faixa';
export const modeloCarteirinhaValido = (m?: string): ModeloCarteirinha => (MODELOS_CARTEIRINHA.some((x) => x.id === m) ? (m as ModeloCarteirinha) : MODELO_CARTEIRINHA_PADRAO);

interface Rec { foto: HTMLImageElement | null; logo: HTMLImageElement | null; qr: HTMLCanvasElement | null }
type Campo = [string, string];
const camposDe = (d: DadosCarteirinha): Campo[] => [['Matrícula', d.numeroCota || '-'], ['CPF', d.cpf || '-'], ['Nascimento', d.dataNascimento || '-'], ['Modalidade', formatModalidade(d.modalidade) || '-']];

/** Rótulo pequeno em cima e valor embaixo, em colunas. */
function campos(g: Ctx, lista: Campo[], x: number, y: number, larg: number, corRot: string, corVal: string, colunas = 2, passo = 100) {
    const lc = larg / colunas;
    lista.forEach(([rot, val], i) => {
        const cx = x + (i % colunas) * lc, cy = y + Math.floor(i / colunas) * passo;
        texto(g, rot, cx, cy, { tam: 21, cor: corRot, peso: 700, espaco: 1.5, caixaAlta: true });
        texto(g, val, cx, cy + 42, { tam: 36, cor: corVal, peso: 800, max: lc - 20, min: 21 });
    });
}
/** QR sobre um quadrado branco (lê bem em qualquer fundo). */
function qr(g: Ctx, r: Rec, x: number, y: number, t: number) { if (!r.qr) return; preenche(g, x - 10, y - 10, t + 20, t + 20, 14, '#fff'); g.drawImage(r.qr, x, y, t, t); }

// ---------- frentes ----------
const FRENTES: Record<ModeloCarteirinha, (g: Ctx, d: DadosCarteirinha, r: Rec) => void> = {
    faixa(g, d, r) {
        g.fillStyle = '#fff'; g.fillRect(0, 0, L, A);
        g.fillStyle = degrade(g, 0, 0, L, 0, E.escura, E.secundaria); g.fillRect(0, 0, L, 168);
        g.fillStyle = E.destaque; g.fillRect(0, 168, L, 8);
        dentro(g, r.logo, 40, 26, 190, 116, 'esquerda');
        texto(g, E.nome, 250, 82, { tam: 40, cor: sobre(E.escura), peso: 800, max: L - 290 });
        texto(g, 'Carteirinha do aluno', 250, 124, { tam: 22, cor: alfa(sobre(E.escura), 0.8), peso: 600, espaco: 2, caixaAlta: true });
        capa(g, r.foto, 44, 214, 250, 310, 22);
        g.lineWidth = 4; g.strokeStyle = '#e3e9f2'; caixa(g, 44, 214, 250, 310, 22); g.stroke();
        texto(g, nomeCurto(d.nome), 334, 262, { tam: 44, cor: visivel(E.primaria), peso: 900, max: L - 374, caixaAlta: true });
        campos(g, camposDe(d), 334, 326, 460, '#7a879c', '#1c2b45');
        qr(g, r, L - 196, A - 252, 156);
        g.fillStyle = E.primaria; g.fillRect(0, A - 44, L, 44);
        texto(g, 'Pessoal e intransferível', L / 2, A - 15, { tam: 19, cor: sobre(E.primaria), peso: 700, alinhar: 'center', espaco: 2, caixaAlta: true });
    },
    lateral(g, d, r) {
        g.fillStyle = '#fff'; g.fillRect(0, 0, L, A);
        g.fillStyle = degrade(g, 0, 0, 0, A, E.primaria, mistura(E.primaria, E.escura, 0.55)); g.fillRect(0, 0, 330, A);
        g.fillStyle = alfa('#ffffff', 0.08); g.beginPath(); g.arc(330, 0, 260, 0, Math.PI * 2); g.fill();
        g.save(); g.beginPath(); g.arc(165, 250, 126, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill(); g.restore();
        capa(g, r.foto, 49, 134, 232, 232, 116);
        dentro(g, r.logo, 60, 432, 210, 150);
        texto(g, E.nome, 380, 84, { tam: 30, cor: E.escura, peso: 800, max: L - 420 });
        g.fillStyle = E.destaque; g.fillRect(380, 106, 90, 6);
        texto(g, 'Aluno', 380, 178, { tam: 20, cor: '#7a879c', peso: 700, espaco: 2, caixaAlta: true });
        texto(g, nomeCurto(d.nome), 380, 232, { tam: 48, cor: E.escura, peso: 900, max: L - 420 });
        campos(g, camposDe(d), 380, 312, 420, '#7a879c', '#1c2b45');
        qr(g, r, L - 190, A - 196, 150);
    },
    noite(g, d, r) {
        const ac = acento(E.escura);
        g.fillStyle = degrade(g, 0, 0, L, A, mistura(E.escura, '#000000', 0.35), E.escura); g.fillRect(0, 0, L, A);
        g.strokeStyle = alfa(ac, 0.5); g.lineWidth = 3;
        for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(L + 40, -40, 190 + i * 70, 0, Math.PI * 2); g.stroke(); }
        dentro(g, r.logo, 44, 34, 170, 104, 'esquerda');
        texto(g, E.nome, 232, 82, { tam: 34, cor: '#fff', peso: 800, max: 520 });
        texto(g, 'Atleta', 232, 120, { tam: 20, cor: ac, peso: 800, espaco: 4, caixaAlta: true });
        preenche(g, 38, 188, 262, 322, 28, ac); capa(g, r.foto, 46, 196, 246, 306, 22);
        texto(g, nomeCurto(d.nome), 340, 250, { tam: 46, cor: '#fff', peso: 900, max: L - 380, caixaAlta: true });
        g.fillStyle = ac; g.fillRect(340, 272, 120, 6);
        campos(g, camposDe(d), 340, 340, 450, alfa('#ffffff', 0.6), '#fff');
        qr(g, r, L - 194, A - 198, 150);
        texto(g, 'Pessoal e intransferível', 44, A - 34, { tam: 18, cor: alfa('#ffffff', 0.55), peso: 600, espaco: 2, caixaAlta: true });
    },
    esportiva(g, d, r) {
        g.fillStyle = '#fff'; g.fillRect(0, 0, L, A);
        g.fillStyle = degrade(g, 0, 0, 0, A, E.secundaria, E.escura); g.beginPath(); g.moveTo(0, 0); g.lineTo(450, 0); g.lineTo(300, A); g.lineTo(0, A); g.closePath(); g.fill();
        g.fillStyle = E.destaque; g.beginPath(); g.moveTo(450, 0); g.lineTo(474, 0); g.lineTo(324, A); g.lineTo(300, A); g.closePath(); g.fill();
        g.fillStyle = E.primaria; g.beginPath(); g.moveTo(474, 0); g.lineTo(486, 0); g.lineTo(336, A); g.lineTo(324, A); g.closePath(); g.fill();
        dentro(g, r.logo, 40, 30, 200, 120, 'esquerda');
        preenche(g, 46, 190, 232, 290, 20, '#fff'); capa(g, r.foto, 54, 198, 216, 274, 14);
        texto(g, 'Temporada ' + new Date().getFullYear(), 46, A - 50, { tam: 20, cor: '#fff', peso: 800, espaco: 3, caixaAlta: true });
        texto(g, E.nome, L - 44, 78, { tam: 30, cor: E.escura, peso: 800, max: 470, alinhar: 'right' });
        texto(g, nomeCurto(d.nome), L - 44, 180, { tam: 50, cor: visivel(E.primaria), peso: 900, max: 520, alinhar: 'right', caixaAlta: true });
        campos(g, camposDe(d), 440, 268, 380, '#7a879c', '#1c2b45', 2, 96);
        qr(g, r, L - 192, A - 194, 148);
    },
    campo(g, d, r) {
        const v1 = E.primaria, v2 = mistura(E.primaria, '#000000', 0.12);
        for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? v1 : v2; g.fillRect(i * (L / 8), 0, L / 8 + 1, A); }
        g.strokeStyle = alfa('#ffffff', 0.35); g.lineWidth = 5;
        g.strokeRect(22, 22, L - 44, A - 44); g.beginPath(); g.moveTo(L / 2, 22); g.lineTo(L / 2, A - 22); g.stroke();
        g.beginPath(); g.arc(L / 2, A / 2, 110, 0, Math.PI * 2); g.stroke(); g.strokeRect(22, A / 2 - 130, 120, 260); g.strokeRect(L - 142, A / 2 - 130, 120, 260);
        preenche(g, 60, 60, L - 120, A - 120, 30, '#fff');
        dentro(g, r.logo, 92, 84, 150, 92, 'esquerda');
        texto(g, E.nome, 262, 126, { tam: 32, cor: E.escura, peso: 800, max: L - 370 });
        texto(g, 'Carteirinha do aluno', 262, 160, { tam: 19, cor: '#7a879c', peso: 700, espaco: 2, caixaAlta: true });
        capa(g, r.foto, 92, 208, 210, 264, 18);
        texto(g, nomeCurto(d.nome), 334, 250, { tam: 42, cor: visivel(E.primaria), peso: 900, max: L - 430, caixaAlta: true });
        campos(g, camposDe(d), 334, 306, 400, '#7a879c', '#1c2b45', 2, 86);
        qr(g, r, L - 236, A - 244, 136);
    },
    limpa(g, d, r) {
        g.fillStyle = '#fff'; g.fillRect(0, 0, L, A);
        g.strokeStyle = '#dfe5ee'; g.lineWidth = 4; caixa(g, 2, 2, L - 4, A - 4, 34); g.stroke();
        g.fillStyle = visivel(E.primaria); g.fillRect(0, 0, 16, A);
        dentro(g, r.logo, L - 240, 36, 196, 110, 'direita');
        texto(g, E.nome, 62, 78, { tam: 26, cor: '#7a879c', peso: 700, max: L - 330, espaco: 1 });
        texto(g, nomeCurto(d.nome), 62, 168, { tam: 56, cor: '#10213f', peso: 800, max: L - 330 });
        g.fillStyle = '#eef1f6'; g.fillRect(62, 204, L - 124, 3);
        capa(g, r.foto, 62, 244, 220, 280, 16);
        campos(g, camposDe(d), 322, 286, 440, '#7a879c', '#10213f', 2, 100);
        qr(g, r, L - 200, A - 206, 150);
        texto(g, 'Pessoal e intransferível', 62, A - 44, { tam: 18, cor: '#9aa5b8', peso: 600, espaco: 2, caixaAlta: true });
    }
};

/** Verso: dados do responsável, na paleta da escola (claro no modelo "limpa", escuro nos demais). */
function verso(g: Ctx, d: DadosCarteirinha, r: Rec, claro: boolean) {
    const tinta = claro ? '#10213f' : '#ffffff', suave = claro ? '#7a879c' : alfa('#ffffff', 0.62), resp = d.responsavel || {}, e = resp.endereco || {};
    g.fillStyle = claro ? '#fff' : degrade(g, 0, 0, L, A, E.escura, mistura(E.escura, E.secundaria, 0.6)); g.fillRect(0, 0, L, A);
    if (claro) { g.strokeStyle = '#dfe5ee'; g.lineWidth = 4; caixa(g, 2, 2, L - 4, A - 4, 34); g.stroke(); g.fillStyle = visivel(E.primaria); g.fillRect(0, 0, 16, A); }
    else { g.fillStyle = acento(E.escura); g.fillRect(0, 0, L, 10); }
    dentro(g, r.logo, 48, 40, 130, 80, 'esquerda');
    texto(g, E.nome, 196, 92, { tam: 30, cor: tinta, peso: 800, max: L - 520 });
    texto(g, 'Responsável financeiro', L - 48, 92, { tam: 19, cor: suave, peso: 700, alinhar: 'right', espaco: 2, caixaAlta: true });
    texto(g, resp.nome || '-', 48, 206, { tam: 44, cor: tinta, peso: 800, max: L - 96 });
    const linha = (rot: string, val: string, x: number, y: number, max: number) => { texto(g, rot, x, y, { tam: 18, cor: suave, peso: 700, espaco: 1.5, caixaAlta: true }); texto(g, val || '-', x, y + 36, { tam: 28, cor: tinta, peso: 700, max, min: 16 }); };
    linha('CPF', resp.cpf || '', 48, 270, 400); linha('Telefone', resp.telefonePrincipal || resp.telefone || '', L / 2, 270, 400);
    linha('E-mail', resp.email || '', 48, 372, L - 300);
    linha('Endereço', [e.rua, e.numero, e.bairro, e.cidade, e.estado || e.uf].filter(Boolean).join(', '), 48, 474, L - 300);
    texto(g, 'Em caso de perda, devolva na secretaria da escola.', 48, A - 36, { tam: 18, cor: suave, peso: 600, max: L - 96 });
}

async function qrDe(d: DadosCarteirinha): Promise<HTMLCanvasElement | null> {
    try { const c = document.createElement('canvas'); await QRCode.toCanvas(c, `${d.cpf || d.responsavel?.cpf || '000.000.000-00'}|${d.dataNascimento || ''}|${d.nome}`, { margin: 1, width: 320 }); return c; } catch { return null; }
}

/** Desenha um lado da carteirinha no modelo escolhido. */
export async function desenharCarteirinha(modelo: string, d: DadosCarteirinha, lado: 'frente' | 'verso' = 'frente'): Promise<HTMLCanvasElement> {
    const m = modeloCarteirinhaValido(modelo), [c, g] = tela(L, A);
    const [foto, logo, qrc] = await Promise.all([lado === 'frente' ? imagem(d.fotoUrl) : null, imagem(LOGO_URL), lado === 'frente' ? qrDe(d) : null]);
    const r: Rec = { foto, logo, qr: qrc };
    if (lado === 'verso') verso(g, d, r, m === 'limpa'); else FRENTES[m](g, d, r);
    return c;
}

/** PDF no tamanho de cartão: frente e verso de cada aluno, uma página por lado. */
export async function pdfCarteirinhas(modelo: string, lista: DadosCarteirinha[], arquivo: string, aoAndar?: (feitos: number) => void) {
    const { default: jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ orientation: 'l', unit: 'mm', format: [85.6, 54] });
    for (let i = 0; i < lista.length; i++) {
        for (const lado of ['frente', 'verso'] as const) {
            if (i || lado === 'verso') pdf.addPage([85.6, 54], 'l');
            pdf.addImage((await desenharCarteirinha(modelo, lista[i], lado)).toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 85.6, 54);
        }
        aoAndar?.(i + 1);
    }
    pdf.save(arquivo);
}
