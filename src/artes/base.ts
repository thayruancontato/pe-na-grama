// Base das artes da escola (carteirinha e aniversário): tudo é desenhado num <canvas>, com o nome, a logo e as cores
// da própria escola. A mesma função serve para a tela, para o PDF e para a imagem enviada por WhatsApp.

type Marca = { nome?: string; controle?: { valores?: Record<string, unknown> } };
const marca = ((typeof window !== 'undefined' && (window as unknown as { __MARCA__?: Marca }).__MARCA__) || {}) as Marca;
const cor = (k: string, padrao: string) => { const v = String(marca.controle?.valores?.[k] || ''); return /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : padrao; };

/** Nome e paleta da escola (as mesmas cores do painel). */
export const ESCOLA = {
    nome: marca.nome || 'Rumo ao Esporte',
    primaria: cor('cor_primaria', '#00a63a'),
    secundaria: cor('cor_secundaria', '#17428f'),
    escura: cor('cor_escura', '#09245c'),
    destaque: cor('cor_destaque', '#f4c20d')
};
export const LOGO_URL = '/rumo-ao-esporte-logo.png'; // o Worker entrega a logo da escola neste endereço
export const FONTE = '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

// ---------- cores ----------
const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export const mistura = (a: string, b: string, t: number) => '#' + rgb(a).map((x, i) => Math.round(x + (rgb(b)[i] - x) * t).toString(16).padStart(2, '0')).join('');
export const alfa = (h: string, a: number) => `rgba(${rgb(h).join(',')},${a})`;
const luz = (h: string) => { const [r, g, b] = rgb(h).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
/** Cor de texto legível sobre o fundo dado. */
export const sobre = (fundo: string, claro = '#ffffff', escuro = '#10213f') => (luz(fundo) > 0.45 ? escuro : claro);
const contraste = (a: string, b: string) => { const x = luz(a), y = luz(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
/** Cor de destaque que aparece sobre o fundo dado: tenta o destaque, a secundária e a primária da escola; se nenhuma servir, branco ou amarelo. */
export const acento = (fundo: string) => [ESCOLA.destaque, ESCOLA.secundaria, ESCOLA.primaria].find((c) => contraste(c, fundo) >= 3) || (luz(fundo) > 0.45 ? '#10213f' : '#ffd23f');
/** Cor da marca (primária, secundária, escura, destaque) que aparece sobre o fundo dado; sem nenhuma, a cor de texto. */
export const marcaSobre = (fundo: string) => [ESCOLA.primaria, ESCOLA.secundaria, ESCOLA.escura, ESCOLA.destaque].find((c) => contraste(c, fundo) >= 3) || sobre(fundo);
/** Garante que a cor aparece sobre branco (uma primária muito clara é escurecida). */
export const visivel = (h: string) => (luz(h) > 0.6 ? mistura(h, '#000000', 0.45) : h);

// ---------- imagens e fontes ----------
const cache = new Map<string, Promise<HTMLImageElement | null>>();
/** Carrega uma imagem sem "sujar" o canvas (baixa como arquivo e abre localmente). Devolve null se falhar. */
export function imagem(url?: string | null): Promise<HTMLImageElement | null> {
    if (!url) return Promise.resolve(null);
    if (!cache.has(url)) {
        cache.set(url, (async () => {
            try {
                const src = url.startsWith('data:') ? url : URL.createObjectURL(await (await fetch(url)).blob());
                return await new Promise<HTMLImageElement | null>((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });
            } catch { return null; }
        })());
    }
    return cache.get(url)!;
}
const fontes = new Map<string, Promise<void>>();
/** Fonte decorativa da pasta pública (usada nas artes de aniversário). Se não carregar, o desenho usa a fonte padrão. */
export function fonte(nome: string, arquivo: string): Promise<void> {
    if (!fontes.has(nome)) fontes.set(nome, (async () => { try { const f = new FontFace(nome, `url("${encodeURI(arquivo)}")`); await f.load(); document.fonts.add(f); } catch { /* segue com a fonte padrão */ } })());
    return fontes.get(nome)!;
}

// ---------- desenho ----------
export type Ctx = CanvasRenderingContext2D;
export function tela(w: number, h: number): [HTMLCanvasElement, Ctx] { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')!]; }
export function caixa(g: Ctx, x: number, y: number, w: number, h: number, r = 0) { g.beginPath(); g.roundRect(x, y, w, h, r); }
export function preenche(g: Ctx, x: number, y: number, w: number, h: number, r: number, estilo: string | CanvasGradient) { caixa(g, x, y, w, h, r); g.fillStyle = estilo; g.fill(); }
export function degrade(g: Ctx, x0: number, y0: number, x1: number, y1: number, ...cores: string[]) { const d = g.createLinearGradient(x0, y0, x1, y1); cores.forEach((c, i) => d.addColorStop(cores.length === 1 ? 0 : i / (cores.length - 1), c)); return d; }

/** Imagem cobrindo a área (como object-fit: cover), com cantos arredondados; `foco` sobe o enquadramento para rostos. */
export function capa(g: Ctx, img: HTMLImageElement | null, x: number, y: number, w: number, h: number, r = 0, foco = 0.35) {
    g.save(); caixa(g, x, y, w, h, r); g.clip();
    if (img) { const k = Math.max(w / img.width, h / img.height), iw = img.width * k, ih = img.height * k; g.drawImage(img, x + (w - iw) / 2, y + (h - ih) * foco, iw, ih); }
    else { // sem foto: silhueta neutra
        g.fillStyle = '#e6ebf2'; g.fillRect(x, y, w, h); g.fillStyle = '#b9c3d1';
        g.beginPath(); g.arc(x + w / 2, y + h * 0.4, Math.min(w, h) * 0.19, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.ellipse(x + w / 2, y + h * 1.02, w * 0.36, h * 0.36, 0, 0, Math.PI * 2); g.fill();
    }
    g.restore();
}
/** Imagem inteira dentro da área (object-fit: contain). */
export function dentro(g: Ctx, img: HTMLImageElement | null, x: number, y: number, w: number, h: number, alinhar: 'centro' | 'esquerda' | 'direita' = 'centro') {
    if (!img) return;
    const k = Math.min(w / img.width, h / img.height), iw = img.width * k, ih = img.height * k;
    g.drawImage(img, alinhar === 'esquerda' ? x : alinhar === 'direita' ? x + w - iw : x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
}

export interface Texto { tam: number; cor: string; peso?: number | string; max?: number; alinhar?: CanvasTextAlign; fam?: string; min?: number; espaco?: number; caixaAlta?: boolean }
/** Escreve uma linha; se passar de `max`, diminui a letra até caber (e corta com reticências no limite). Devolve o tamanho usado. */
export function texto(g: Ctx, t: string, x: number, y: number, o: Texto): number {
    let s = o.caixaAlta ? String(t).toUpperCase() : String(t), tam = o.tam;
    const fam = o.fam || FONTE, min = o.min ?? o.tam * 0.6, define = () => { g.font = `${o.peso ?? 700} ${tam}px ${fam}`; };
    g.textAlign = o.alinhar || 'left'; g.textBaseline = 'alphabetic'; g.fillStyle = o.cor;
    (g as unknown as { letterSpacing: string }).letterSpacing = `${o.espaco || 0}px`;
    define();
    if (o.max) {
        while (g.measureText(s).width > o.max && tam > min) { tam -= 1; define(); }
        while (g.measureText(s).width > o.max && s.length > 2) s = s.slice(0, -2).trimEnd() + '…';
    }
    g.fillText(s, x, y);
    (g as unknown as { letterSpacing: string }).letterSpacing = '0px';
    return tam;
}

/** Números repetíveis (o mesmo modelo sai sempre igual), para confetes e enfeites. */
export function sorteio(semente: number) { let a = semente >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** Primeiro nome com inicial maiúscula. */
export const primeiroNome = (n: string) => { const p = String(n || '').trim().split(/\s+/)[0] || ''; return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase(); };
/** Nome para documento: abrevia os nomes do meio quando são 4 ou mais. */
export const nomeCurto = (n: string) => { const p = String(n || '').trim().split(/\s+/); if (p.length >= 4) for (let i = 2; i < p.length - 1; i++) p[i] = p[i][0].toUpperCase() + '.'; return p.join(' '); };
export const paraBlob = (c: HTMLCanvasElement, tipo = 'image/png', q?: number) => new Promise<Blob | null>((ok) => c.toBlob(ok, tipo, q));
