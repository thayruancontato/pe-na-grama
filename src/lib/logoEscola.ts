import { useEffect, useState } from 'react';

/**
 * Deixa a logo da escola sempre visível, qualquer que seja o arquivo enviado:
 *  1. se a imagem tem fundo chapado (branco, creme, qualquer cor uniforme nas bordas), tira o fundo;
 *  2. recorta a margem transparente, para a logo ocupar o espaço dela;
 *  3. mede se a logo é clara ou escura, para o cabeçalho escolher um fundo que contraste.
 * Qualquer falha devolve a imagem original (nunca deixa a logo sumir).
 */
export type LogoPronta = { src: string; clara: boolean; pronta: boolean };

const URL_LOGO = '/rumo-ao-esporte-logo.png';
const cache = new Map<string, Promise<LogoPronta>>();

const lum = (r: number, g: number, b: number) => {
    const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

function processar(src: string): Promise<LogoPronta> {
    const original: LogoPronta = { src, clara: false, pronta: true };
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onerror = () => resolve(original);
        img.onload = () => {
            try {
                const esc = Math.min(1, 700 / Math.max(img.naturalWidth, img.naturalHeight));
                const W = Math.max(1, Math.round(img.naturalWidth * esc)), H = Math.max(1, Math.round(img.naturalHeight * esc));
                const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
                const cx = cv.getContext('2d', { willReadFrequently: true })!;
                cx.drawImage(img, 0, 0, W, H);
                const im = cx.getImageData(0, 0, W, H), d = im.data;
                const at = (x: number, y: number) => (y * W + x) * 4;

                // 1) fundo chapado: cantos opacos e parecidos entre si
                const cantos = [at(0, 0), at(W - 1, 0), at(0, H - 1), at(W - 1, H - 1)];
                const opacos = cantos.every((i) => d[i + 3] > 240);
                const ref = [d[cantos[0]], d[cantos[0] + 1], d[cantos[0] + 2]];
                const dist = (i: number) => Math.hypot(d[i] - ref[0], d[i + 1] - ref[1], d[i + 2] - ref[2]);
                if (opacos && cantos.every((i) => dist(i) < 40)) {
                    const visto = new Uint8Array(W * H), pilha: number[] = [];
                    const empurra = (x: number, y: number) => { const k = y * W + x; if (!visto[k] && dist(k * 4) < 60) { visto[k] = 1; pilha.push(k); } };
                    for (let x = 0; x < W; x++) { empurra(x, 0); empurra(x, H - 1); }
                    for (let y = 0; y < H; y++) { empurra(0, y); empurra(W - 1, y); }
                    while (pilha.length) {
                        const k = pilha.pop()!, x = k % W, y = (k / W) | 0;
                        if (x > 0) empurra(x - 1, y); if (x < W - 1) empurra(x + 1, y); if (y > 0) empurra(x, y - 1); if (y < H - 1) empurra(x, y + 1);
                    }
                    for (let k = 0; k < visto.length; k++) if (visto[k]) d[k * 4 + 3] = 0;
                }

                // 2) recorte da margem transparente + 3) claro/escuro
                let x0 = W, y0 = H, x1 = -1, y1 = -1, soma = 0, n = 0;
                for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
                    const i = at(x, y);
                    if (d[i + 3] > 12) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
                    if (d[i + 3] > 128) { soma += lum(d[i], d[i + 1], d[i + 2]); n++; }
                }
                if (x1 < 0 || n < 20) return resolve(original);                 // imagem vazia: usa a original
                cx.putImageData(im, 0, 0);
                const m = Math.round(Math.max(W, H) * 0.02), cw = x1 - x0 + 1 + m * 2, ch = y1 - y0 + 1 + m * 2;
                const out = document.createElement('canvas'); out.width = cw; out.height = ch;
                out.getContext('2d')!.drawImage(cv, x0 - m, y0 - m, cw, ch, 0, 0, cw, ch);
                out.toBlob((b) => resolve(b ? { src: URL.createObjectURL(b), clara: soma / n > 0.6, pronta: true } : original), 'image/png');
            } catch { resolve(original); }
        };
        img.src = src;
    });
}

export function prepararLogo(src: string = URL_LOGO) {
    if (!cache.has(src)) cache.set(src, processar(src));
    return cache.get(src)!;
}

/** Logo pronta para uso. Enquanto prepara, mostra a original (sem piscar). */
export function useLogoEscola(src: string = URL_LOGO): LogoPronta {
    const [l, setL] = useState<LogoPronta>({ src, clara: false, pronta: false });
    useEffect(() => { let vivo = true; prepararLogo(src).then((r) => vivo && setL(r)); return () => { vivo = false; }; }, [src]);
    return l;
}

/** Fundo do cabeçalho que sempre contrasta com a logo. */
export const fundoParaLogo = (clara: boolean, escuro = 'linear-gradient(135deg, #17428f 0%, #09245c 100%)') => (clara ? escuro : '#ffffff');

/** Cobre todas as outras telas (matrícula, login do aluno, contratos, eventos...): toda <img> da logo ganha a versão pronta e, se a logo é escura, um fundo claro atrás. */
export function instalarLogoGlobal() {
    const ajusta = (img: HTMLImageElement) => {
        if (img.dataset.logoOk || !img.src.includes('rumo-ao-esporte-logo.png')) return;
        img.dataset.logoOk = '1';
        prepararLogo().then((l) => {
            img.src = l.src; img.style.objectFit = 'contain';
            if (!l.clara) { img.style.background = '#fff'; img.style.borderRadius = '10px'; img.style.padding = '6px 10px'; img.style.boxSizing = 'border-box'; }
        });
    };
    const varre = (raiz: ParentNode) => raiz.querySelectorAll?.('img[src*="rumo-ao-esporte-logo.png"]').forEach((i) => ajusta(i as HTMLImageElement));
    varre(document);
    new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => { if (n instanceof HTMLImageElement) ajusta(n); else if (n instanceof HTMLElement) varre(n); }))).observe(document.documentElement, { childList: true, subtree: true });
}
