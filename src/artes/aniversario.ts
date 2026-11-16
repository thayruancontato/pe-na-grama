import { PADRAO_ID, desenharArte } from './catalogo';

// Arte de aniversário (post). O desenho vem do catálogo (modelos editáveis na Central); formato padrão 1080 x 1350.
export const L = 1080, A = 1350;
export interface DadosAniversario { nome: string; fotoUrl?: string | null; idade?: number }
export const MODELO_ANIVERSARIO_PADRAO = PADRAO_ID.aniversario;

/** Desenha a arte de aniversário no modelo escolhido. */
export function desenharAniversario(modelo: string, d: DadosAniversario): Promise<HTMLCanvasElement> {
    return desenharArte('aniversario', modelo, { nome: d.nome, idade: d.idade }, { foto: d.fotoUrl });
}
