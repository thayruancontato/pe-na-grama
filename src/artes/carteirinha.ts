import QRCode from 'qrcode';
import { formatModalidade } from '../utils/modalidadeUtils';
import { PADRAO_ID, desenharArte, idValido } from './catalogo';

// Carteirinha do aluno. O desenho vem do catálogo (modelos editáveis na Central) e é feito pelo mesmo motor da Central.
// Cartão de 85,6 x 54 mm a 300 dpi.
export const L = 1012, A = 638;

export interface DadosCarteirinha {
    nome: string; cpf?: string; dataNascimento?: string; fotoUrl?: string; numeroCota?: string; modalidade?: string | string[];
    responsavel?: { nome?: string; cpf?: string; telefonePrincipal?: string; telefone?: string; email?: string; endereco?: { rua?: string; numero?: string; bairro?: string; cidade?: string; estado?: string; uf?: string } };
}
export const MODELO_CARTEIRINHA_PADRAO = PADRAO_ID.carteirinha;

async function qrDe(d: DadosCarteirinha): Promise<HTMLCanvasElement | null> {
    try { const c = document.createElement('canvas'); await QRCode.toCanvas(c, `${d.cpf || d.responsavel?.cpf || '000.000.000-00'}|${d.dataNascimento || ''}|${d.nome}`, { margin: 1, width: 320 }); return c; } catch { return null; }
}

/** Desenha um lado da carteirinha no modelo escolhido. */
export async function desenharCarteirinha(modelo: string, d: DadosCarteirinha, lado: 'frente' | 'verso' = 'frente'): Promise<HTMLCanvasElement> {
    const dados = { ...d, modalidade: formatModalidade(d.modalidade) };
    return desenharArte('carteirinha', modelo, dados, { lado, foto: lado === 'frente' ? d.fotoUrl : null, qr: lado === 'frente' ? await qrDe(d) : null });
}

/** Frente e verso, do mesmo tamanho, um embaixo do outro, em um só desenho: usado na galeria de modelos. */
export const FOLGA = 28;
export const A_DUPLA = A * 2 + FOLGA;
export async function desenharCarteirinhaDupla(modelo: string, d: DadosCarteirinha): Promise<HTMLCanvasElement> {
    const [frente, verso] = await Promise.all([desenharCarteirinha(modelo, d, 'frente'), desenharCarteirinha(modelo, d, 'verso')]);
    const c = document.createElement('canvas'); c.width = L; c.height = A_DUPLA;
    const g = c.getContext('2d')!; g.fillStyle = '#ffffff'; g.fillRect(0, 0, L, A_DUPLA);
    g.drawImage(frente, 0, 0, L, A); g.drawImage(verso, 0, A + FOLGA, L, A);
    return c;
}

/** PDF no tamanho de cartão: frente e verso de cada aluno, uma página por lado. */
export async function pdfCarteirinhas(modelo: string, lista: DadosCarteirinha[], arquivo: string, aoAndar?: (feitos: number) => void) {
    const { default: jsPDF } = await import('jspdf');
    const id = await idValido('carteirinha', modelo);
    const pdf = new jsPDF({ orientation: 'l', unit: 'mm', format: [85.6, 54] });
    for (let i = 0; i < lista.length; i++) {
        for (const lado of ['frente', 'verso'] as const) {
            if (i || lado === 'verso') pdf.addPage([85.6, 54], 'l');
            pdf.addImage((await desenharCarteirinha(id, lista[i], lado)).toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 85.6, 54);
        }
        aoAndar?.(i + 1);
    }
    pdf.save(arquivo);
}
