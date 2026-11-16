/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import { catalogoPadrao } from '../../produto/artes/modelos.js';
import { PALETA_PADRAO, carregaFontes, imagem, listaModelos, renderiza, resolveId } from '../../produto/artes/motor.js';

// Catálogo de artes (modelos e temas). O dono edita na Central (aba Criativos) e o servidor entrega em /sys/public/criativos;
// sem nada salvo (ou fora do ar), valem os modelos padrão que vêm no próprio sistema.
export type Tipo = 'carteirinha' | 'aniversario';
export interface ItemModelo { id: string; nome: string; grupo: string }
type Marca = { nome?: string; controle?: { valores?: Record<string, unknown> } };
const marca = ((typeof window !== 'undefined' && (window as unknown as { __MARCA__?: Marca }).__MARCA__) || {}) as Marca;

export const ESCOLA_NOME = marca.nome || 'Rumo ao Esporte';
export const LOGO_URL = '/rumo-ao-esporte-logo.png'; // o Worker entrega a logo da escola neste endereço
const cor = (k: string, padrao: string) => { const v = String(marca.controle?.valores?.[k] || ''); return /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : padrao; };
/** Cores da escola (as mesmas do painel). */
export const PALETA = { primaria: cor('cor_primaria', PALETA_PADRAO.primaria), secundaria: cor('cor_secundaria', PALETA_PADRAO.secundaria), escura: cor('cor_escura', PALETA_PADRAO.escura), destaque: cor('cor_destaque', PALETA_PADRAO.destaque) };

const valido = (c: any) => c && c.temas && Array.isArray(c.temas.carteirinha) && Array.isArray(c.temas.aniversario) && Array.isArray(c.carteirinha) && Array.isArray(c.aniversario);
let pedido: Promise<any> | null = null;
/** Catálogo em uso (lido uma vez por carregamento da página). */
export function lerCatalogo(): Promise<any> {
    if (!pedido) pedido = fetch('/sys/public/criativos').then((r) => (r.ok ? r.json() : null)).then((j) => (j && valido(j.catalogo) ? j.catalogo : catalogoPadrao())).catch(() => catalogoPadrao());
    return pedido;
}
/** Ids gravados antes de os modelos virarem dados. */
const ANTIGOS: Record<string, string> = { faixa: 'faixa-escola', lateral: 'lateral-primaria', noite: 'arcos-noite', esportiva: 'diagonal-escola', campo: 'campo-primaria', limpa: 'limpa-escola', festa: 'festa-escola', craque: 'craque-noite', baloes: 'baloes-clara', polaroid: 'polaroid-papel' };
export const PADRAO_ID: Record<Tipo, string> = { carteirinha: 'faixa-escola', aniversario: 'festa-escola' };
/** Id existente no catálogo; se o escolhido sumiu (o dono apagou), cai no primeiro modelo disponível. */
export async function idValido(tipo: Tipo, id?: string): Promise<string> {
    const c = await lerCatalogo(), x = ANTIGOS[id || ''] || id || '';
    if (resolveId(c, tipo, x)) return x;
    const l = listaModelos(c, tipo) as ItemModelo[];
    return l.some((m) => m.id === PADRAO_ID[tipo]) ? PADRAO_ID[tipo] : l[0]?.id || PADRAO_ID[tipo];
}
/** Lista de modelos para a galeria; começa com os padrões e troca pela da Central quando chega. */
export function useModelos(tipo: Tipo): ItemModelo[] {
    const [l, setL] = useState<ItemModelo[]>(() => listaModelos(catalogoPadrao(), tipo));
    useEffect(() => { let vivo = true; lerCatalogo().then((c) => vivo && setL(listaModelos(c, tipo))); return () => { vivo = false; }; }, [tipo]);
    return l;
}

/** Desenha uma arte com o modelo "modelo-tema". */
export async function desenharArte(tipo: Tipo, id: string, dados: Record<string, unknown>, opcoes: { lado?: string; foto?: string | null; qr?: HTMLCanvasElement | null } = {}): Promise<HTMLCanvasElement> {
    const c = await lerCatalogo(), r = resolveId(c, tipo, id) || resolveId(c, tipo, await idValido(tipo, id));
    if (!r) throw new Error('Nenhum modelo de arte disponível.');
    const [foto, logo] = await Promise.all([imagem(opcoes.foto), imagem(LOGO_URL), carregaFontes('/')]);
    return renderiza(r.modelo, { ...dados, escola: ESCOLA_NOME }, { paleta: PALETA, tema: r.tema, lado: opcoes.lado, recursos: { foto, logo, qr: opcoes.qr || null } });
}
export const paraBlob = (c: HTMLCanvasElement, tipo = 'image/png', q?: number) => new Promise<Blob | null>((ok) => c.toBlob(ok, tipo, q));
