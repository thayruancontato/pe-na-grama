import QRCode from 'qrcode';
import { formatModalidade } from '../utils/modalidadeUtils';
import { ESCOLA as E, LOGO_URL, acento, alfa, capa, caixa, degrade, dentro, imagem, marcaSobre, mistura, nomeCurto, preenche, sobre, tela, texto, type Ctx } from './base';

// Carteirinha do aluno. Cada modelo é um FORMATO (onde ficam foto, nome e dados) combinado com um TEMA (as cores):
// 7 formatos x 7 temas = 49 modelos. Tamanho de cartão (85,6 x 54 mm) a 300 dpi.
export const L = 1012, A = 638;

export interface DadosCarteirinha {
    nome: string; cpf?: string; dataNascimento?: string; fotoUrl?: string; numeroCota?: string; modalidade?: string | string[];
    responsavel?: { nome?: string; cpf?: string; telefonePrincipal?: string; telefone?: string; email?: string; endereco?: { rua?: string; numero?: string; bairro?: string; cidade?: string; estado?: string; uf?: string } };
}

/** Cores de um tema: `base` é o fundo do cartão; `forte` é o bloco colorido (faixa, coluna, fundo cheio). */
interface Tema { base: string; tinta: string; suave: string; forte: string; forte2: string; sobreForte: string; acento: string; marca: string }
const monta = (base: string, forte: string, forte2: string, ac?: string): Tema => {
    const tinta = sobre(base);
    return { base, tinta, suave: mistura(tinta, base, 0.45), forte, forte2, sobreForte: sobre(forte), acento: ac || acento(forte), marca: ac && tinta === '#ffffff' ? ac : marcaSobre(base) };
};
const TEMAS = {
    escola: { nome: 'Escola', cores: () => monta('#ffffff', E.escura, E.secundaria) },
    primaria: { nome: 'Primária', cores: () => monta('#ffffff', E.primaria, mistura(E.primaria, '#000000', 0.35)) },
    destaque: { nome: 'Destaque', cores: () => monta('#ffffff', E.destaque, mistura(E.destaque, '#000000', 0.22)) },
    noite: { nome: 'Noite', cores: () => { const b = mistura(E.escura, '#000000', 0.6); return monta(b, mistura(b, '#ffffff', 0.1), mistura(b, '#ffffff', 0.2)); } },
    clara: { nome: 'Clara', cores: () => monta('#f3f6fa', '#ffffff', '#e8edf4') },
    grafite: { nome: 'Grafite', cores: () => monta('#ffffff', '#1f2933', '#3d4a5c') },
    ouro: { nome: 'Ouro', cores: () => monta('#14151a', '#000000', '#2b2618', '#d4a72c') }
} as const;
type IdTema = keyof typeof TEMAS;

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
const fundoForte = (g: Ctx, t: Tema, x0: number, y0: number, x1: number, y1: number) => degrade(g, x0, y0, x1, y1, t.forte, t.forte2);
type Desenho = (g: Ctx, d: DadosCarteirinha, r: Rec, t: Tema) => void;

// ---------- formatos (frente) ----------
const FORMATOS: Record<string, { nome: string; desenha: Desenho }> = {
    faixa: { nome: 'Faixa', desenha(g, d, r, t) {
        g.fillStyle = t.base; g.fillRect(0, 0, L, A);
        g.fillStyle = fundoForte(g, t, 0, 0, L, 0); g.fillRect(0, 0, L, 196);
        g.fillStyle = t.acento; g.fillRect(0, 196, L, 8);
        dentro(g, r.logo, 36, 14, 270, 168, 'esquerda');
        texto(g, E.nome, 336, 96, { tam: 40, cor: t.sobreForte, peso: 800, max: L - 376 });
        texto(g, 'Carteirinha do aluno', 336, 140, { tam: 22, cor: alfa(t.sobreForte, 0.8), peso: 600, espaco: 2, caixaAlta: true });
        capa(g, r.foto, 44, 232, 250, 306, 22);
        texto(g, nomeCurto(d.nome), 334, 282, { tam: 44, cor: t.marca, peso: 900, max: L - 374, caixaAlta: true });
        campos(g, camposDe(d), 334, 336, 460, t.suave, t.tinta, 2, 96);
        qr(g, r, L - 196, A - 252, 156);
        g.fillStyle = t.marca; g.fillRect(0, A - 44, L, 44);
        texto(g, 'Pessoal e intransferível', L / 2, A - 15, { tam: 19, cor: sobre(t.marca), peso: 700, alinhar: 'center', espaco: 2, caixaAlta: true });
    } },
    lateral: { nome: 'Lateral', desenha(g, d, r, t) {
        g.fillStyle = t.base; g.fillRect(0, 0, L, A);
        g.fillStyle = fundoForte(g, t, 0, 0, 0, A); g.fillRect(0, 0, 330, A);
        g.fillStyle = alfa(t.sobreForte, 0.08); g.beginPath(); g.arc(330, 0, 260, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.arc(165, 214, 126, 0, Math.PI * 2); g.fillStyle = t.acento; g.fill();
        capa(g, r.foto, 49, 98, 232, 232, 116);
        dentro(g, r.logo, 24, 404, 282, 204);
        texto(g, E.nome, 380, 84, { tam: 30, cor: t.tinta, peso: 800, max: L - 420 });
        g.fillStyle = t.marca; g.fillRect(380, 106, 90, 6);
        texto(g, 'Aluno', 380, 178, { tam: 20, cor: t.suave, peso: 700, espaco: 2, caixaAlta: true });
        texto(g, nomeCurto(d.nome), 380, 232, { tam: 48, cor: t.tinta, peso: 900, max: L - 420 });
        campos(g, camposDe(d), 380, 306, 420, t.suave, t.tinta);
        qr(g, r, L - 190, A - 196, 150);
    } },
    arcos: { nome: 'Arcos', desenha(g, d, r, t) {
        g.fillStyle = fundoForte(g, t, 0, 0, L, A); g.fillRect(0, 0, L, A);
        g.strokeStyle = alfa(t.acento, 0.5); g.lineWidth = 3;
        for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(L + 40, -40, 190 + i * 70, 0, Math.PI * 2); g.stroke(); }
        dentro(g, r.logo, 36, 18, 250, 150, 'esquerda');
        texto(g, E.nome, 306, 86, { tam: 34, cor: t.sobreForte, peso: 800, max: 460 });
        texto(g, 'Atleta', 306, 126, { tam: 20, cor: t.acento, peso: 800, espaco: 4, caixaAlta: true });
        preenche(g, 38, 188, 262, 322, 28, t.acento); capa(g, r.foto, 46, 196, 246, 306, 22);
        texto(g, nomeCurto(d.nome), 340, 250, { tam: 46, cor: t.sobreForte, peso: 900, max: L - 380, caixaAlta: true });
        g.fillStyle = t.acento; g.fillRect(340, 272, 120, 6);
        campos(g, camposDe(d), 340, 336, 450, alfa(t.sobreForte, 0.62), t.sobreForte);
        qr(g, r, L - 194, A - 198, 150);
        texto(g, 'Pessoal e intransferível', 44, A - 34, { tam: 18, cor: alfa(t.sobreForte, 0.55), peso: 600, espaco: 2, caixaAlta: true });
    } },
    diagonal: { nome: 'Diagonal', desenha(g, d, r, t) {
        g.fillStyle = t.base; g.fillRect(0, 0, L, A);
        const faixa = (x: number, w: number, cor: string) => { g.fillStyle = cor; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + w, 0); g.lineTo(x + w - 150, A); g.lineTo(x - 150, A); g.closePath(); g.fill(); };
        g.fillStyle = fundoForte(g, t, 0, 0, 0, A); g.beginPath(); g.moveTo(0, 0); g.lineTo(450, 0); g.lineTo(300, A); g.lineTo(0, A); g.closePath(); g.fill();
        faixa(450, 24, t.acento); faixa(474, 12, t.marca);
        dentro(g, r.logo, 30, 16, 290, 160, 'esquerda');
        preenche(g, 46, 196, 232, 286, 20, '#fff'); capa(g, r.foto, 54, 204, 216, 270, 14);
        texto(g, 'Temporada ' + new Date().getFullYear(), 46, A - 50, { tam: 20, cor: t.sobreForte, peso: 800, espaco: 3, caixaAlta: true });
        texto(g, E.nome, L - 44, 78, { tam: 30, cor: t.tinta, peso: 800, max: 470, alinhar: 'right' });
        texto(g, nomeCurto(d.nome), L - 44, 180, { tam: 50, cor: t.marca, peso: 900, max: 520, alinhar: 'right', caixaAlta: true });
        campos(g, camposDe(d), 440, 262, 380, t.suave, t.tinta, 2, 100);
        qr(g, r, L - 192, A - 194, 148);
    } },
    campo: { nome: 'Campo', desenha(g, d, r, t) {
        const v2 = mistura(t.forte, t.sobreForte === '#ffffff' ? '#000000' : '#ffffff', 0.12);
        for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? t.forte : v2; g.fillRect(i * (L / 8), 0, L / 8 + 1, A); }
        g.strokeStyle = alfa(t.sobreForte, 0.35); g.lineWidth = 5;
        g.strokeRect(22, 22, L - 44, A - 44); g.beginPath(); g.moveTo(L / 2, 22); g.lineTo(L / 2, A - 22); g.stroke();
        g.beginPath(); g.arc(L / 2, A / 2, 110, 0, Math.PI * 2); g.stroke(); g.strokeRect(22, A / 2 - 130, 120, 260); g.strokeRect(L - 142, A / 2 - 130, 120, 260);
        preenche(g, 60, 60, L - 120, A - 120, 30, t.base);
        dentro(g, r.logo, 80, 66, 230, 130, 'esquerda');
        texto(g, E.nome, 330, 124, { tam: 32, cor: t.tinta, peso: 800, max: L - 440 });
        texto(g, 'Carteirinha do aluno', 330, 160, { tam: 19, cor: t.suave, peso: 700, espaco: 2, caixaAlta: true });
        capa(g, r.foto, 92, 214, 210, 258, 18);
        texto(g, nomeCurto(d.nome), 334, 250, { tam: 42, cor: t.marca, peso: 900, max: L - 430, caixaAlta: true });
        campos(g, camposDe(d), 334, 300, 400, t.suave, t.tinta, 2, 92);
        qr(g, r, L - 236, A - 244, 136);
    } },
    limpa: { nome: 'Limpa', desenha(g, d, r, t) {
        g.fillStyle = t.base; g.fillRect(0, 0, L, A);
        g.strokeStyle = mistura(t.base, t.tinta, 0.14); g.lineWidth = 4; caixa(g, 2, 2, L - 4, A - 4, 0); g.stroke();
        g.fillStyle = t.marca; g.fillRect(0, 0, 16, A);
        dentro(g, r.logo, L - 350, 22, 310, 164, 'direita');
        texto(g, E.nome, 62, 78, { tam: 26, cor: t.suave, peso: 700, max: L - 440, espaco: 1 });
        texto(g, nomeCurto(d.nome), 62, 168, { tam: 56, cor: t.tinta, peso: 800, max: L - 440 });
        g.fillStyle = mistura(t.base, t.tinta, 0.1); g.fillRect(62, 204, L - 124, 3);
        capa(g, r.foto, 62, 244, 220, 280, 16);
        campos(g, camposDe(d), 322, 280, 440, t.suave, t.tinta, 2, 104);
        qr(g, r, L - 200, A - 206, 150);
        texto(g, 'Pessoal e intransferível', 62, A - 44, { tam: 18, cor: t.suave, peso: 600, espaco: 2, caixaAlta: true });
    } },
    banda: { nome: 'Banda', desenha(g, d, r, t) {
        g.fillStyle = t.base; g.fillRect(0, 0, L, A);
        g.fillStyle = fundoForte(g, t, 0, 0, L, 0); g.fillRect(0, A - 196, L, 196);
        g.fillStyle = t.acento; g.fillRect(0, A - 204, L, 8);
        dentro(g, r.logo, 36, 14, 250, 150, 'esquerda');
        texto(g, E.nome, 306, 80, { tam: 32, cor: t.tinta, peso: 800, max: L - 346 });
        texto(g, 'Carteirinha do aluno', 306, 116, { tam: 19, cor: t.suave, peso: 700, espaco: 2, caixaAlta: true });
        campos(g, camposDe(d), 340, 196, 640, t.suave, t.tinta, 2, 100);
        preenche(g, 38, 172, 264, 332, 26, t.base); capa(g, r.foto, 48, 182, 244, 312, 18);
        texto(g, 'Aluno', 340, A - 132, { tam: 20, cor: alfa(t.sobreForte, 0.7), peso: 700, espaco: 3, caixaAlta: true });
        texto(g, nomeCurto(d.nome), 340, A - 72, { tam: 50, cor: t.sobreForte, peso: 900, max: L - 560, caixaAlta: true });
        texto(g, 'Pessoal e intransferível', 340, A - 32, { tam: 17, cor: alfa(t.sobreForte, 0.6), peso: 600, espaco: 2, caixaAlta: true });
        qr(g, r, L - 184, A - 174, 140);
    } }
};

/** Verso: dados do responsável, nas cores do tema. */
function verso(g: Ctx, d: DadosCarteirinha, r: Rec, t: Tema) {
    const tinta = t.sobreForte, suave = alfa(tinta, 0.62), resp = d.responsavel || {}, e = resp.endereco || {};
    g.fillStyle = fundoForte(g, t, 0, 0, L, A); g.fillRect(0, 0, L, A);
    g.fillStyle = t.acento; g.fillRect(0, 0, L, 10);
    dentro(g, r.logo, 40, 24, 210, 130, 'esquerda');
    texto(g, E.nome, 270, 98, { tam: 30, cor: tinta, peso: 800, max: L - 600 });
    texto(g, 'Responsável financeiro', L - 48, 92, { tam: 19, cor: suave, peso: 700, alinhar: 'right', espaco: 2, caixaAlta: true });
    texto(g, resp.nome || '-', 48, 206, { tam: 44, cor: tinta, peso: 800, max: L - 96 });
    const linha = (rot: string, val: string, x: number, y: number, max: number) => { texto(g, rot, x, y, { tam: 18, cor: suave, peso: 700, espaco: 1.5, caixaAlta: true }); texto(g, val || '-', x, y + 36, { tam: 28, cor: tinta, peso: 700, max, min: 16 }); };
    linha('CPF', resp.cpf || '', 48, 270, 400); linha('Telefone', resp.telefonePrincipal || resp.telefone || '', L / 2, 270, 400);
    linha('E-mail', resp.email || '', 48, 372, L - 300);
    linha('Endereço', [e.rua, e.numero, e.bairro, e.cidade, e.estado || e.uf].filter(Boolean).join(', '), 48, 474, L - 300);
    texto(g, 'Em caso de perda, devolva na secretaria da escola.', 48, A - 36, { tam: 18, cor: suave, peso: 600, max: L - 96 });
}

// ---------- lista de modelos ----------
/** Todos os modelos: id "formato-tema", nome "Formato · Tema" e o grupo (formato) para o filtro da galeria. */
export const MODELOS_CARTEIRINHA = Object.keys(FORMATOS).flatMap((f) => (Object.keys(TEMAS) as IdTema[]).map((t) => ({ id: `${f}-${t}`, nome: `${FORMATOS[f].nome} · ${TEMAS[t].nome}`, grupo: FORMATOS[f].nome })));
export const MODELO_CARTEIRINHA_PADRAO = 'faixa-escola';
// Escolhas gravadas antes de existirem os temas.
const ANTIGOS: Record<string, string> = { faixa: 'faixa-escola', lateral: 'lateral-primaria', noite: 'arcos-noite', esportiva: 'diagonal-escola', campo: 'campo-primaria', limpa: 'limpa-escola' };
export const modeloCarteirinhaValido = (m?: string): string => { const x = ANTIGOS[m || ''] || m || ''; return MODELOS_CARTEIRINHA.some((y) => y.id === x) ? x : MODELO_CARTEIRINHA_PADRAO; };

async function qrDe(d: DadosCarteirinha): Promise<HTMLCanvasElement | null> {
    try { const c = document.createElement('canvas'); await QRCode.toCanvas(c, `${d.cpf || d.responsavel?.cpf || '000.000.000-00'}|${d.dataNascimento || ''}|${d.nome}`, { margin: 1, width: 320 }); return c; } catch { return null; }
}

/** Desenha um lado da carteirinha no modelo escolhido. */
export async function desenharCarteirinha(modelo: string, d: DadosCarteirinha, lado: 'frente' | 'verso' = 'frente'): Promise<HTMLCanvasElement> {
    const [f, t] = modeloCarteirinhaValido(modelo).split('-') as [string, IdTema], [c, g] = tela(L, A);
    const [foto, logo, qrc] = await Promise.all([lado === 'frente' ? imagem(d.fotoUrl) : null, imagem(LOGO_URL), lado === 'frente' ? qrDe(d) : null]);
    const r: Rec = { foto, logo, qr: qrc }, cores = TEMAS[t].cores();
    if (lado === 'verso') verso(g, d, r, cores); else FORMATOS[f].desenha(g, d, r, cores);
    return c;
}

/** Frente e verso, do mesmo tamanho, um embaixo do outro, em um só desenho: usado na galeria de modelos. */
export const FOLGA = 28;
export const A_DUPLA = A * 2 + FOLGA;
export async function desenharCarteirinhaDupla(modelo: string, d: DadosCarteirinha): Promise<HTMLCanvasElement> {
    const [frente, verso_] = await Promise.all([desenharCarteirinha(modelo, d, 'frente'), desenharCarteirinha(modelo, d, 'verso')]);
    const [c, g] = tela(L, A_DUPLA);
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, L, A_DUPLA);
    g.drawImage(frente, 0, 0); g.drawImage(verso_, 0, A + FOLGA);
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
