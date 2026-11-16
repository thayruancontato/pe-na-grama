// Tipos de motor.js (o motor é JavaScript puro para a Central e o sistema da escola usarem o mesmo arquivo).
/* eslint-disable @typescript-eslint/no-explicit-any */
export const PALETA_PADRAO: { primaria: string; secundaria: string; escura: string; destaque: string };
export const FONTES: Record<string, string>;
export const TIPOS: string[];
export const VARIAVEIS: [string, string][];
export function imagem(url?: string | null): Promise<HTMLImageElement | null>;
export function carregaFontes(pasta?: string): Promise<unknown>;
export function variaveis(d: any): Record<string, string>;
export function cor(expr: unknown, ctx: any): string;
export function contextoCores(paleta: any, tema: any): any;
export function contraste(a: string, b: string): number;
export function caixaDe(camada: any): { x: number; y: number; w: number; h: number };
export function desenha(g: CanvasRenderingContext2D, camadas: any[], ctx: any, rec: any, dados: any, W: number, H: number): void;
export function camadasDe(modelo: any, lado?: string): any[];
export function renderiza(modelo: any, dados: any, opcoes?: { paleta?: any; tema?: any; lado?: string; recursos?: any }): HTMLCanvasElement;
export function listaModelos(catalogo: any, tipo: string): { id: string; nome: string; grupo: string }[];
export function resolveId(catalogo: any, tipo: string, id: string): { modelo: any; tema: any } | null;
