// Consistência visual: reconhece botões, campos, cartões, janelas, selos, tabelas e títulos de qualquer tela
// (a maioria tem estilo próprio) e põe a classe ux-* que aplica as medidas únicas de src/styles/consistencia.css.
import '../styles/consistencia.css';

const IGNORA = 'aside, nav, [data-ux-skip], [class*="print"], [class*="contract"], [class*="termo"], canvas';
const lum = (c: string) => { const m = c.match(/[\d.]+/g); return m ? (0.299 * +m[0] + 0.587 * +m[1] + 0.114 * +m[2]) : 255; };
const alfa = (c: string) => { const m = c.match(/[\d.]+/g); return m && m.length > 3 ? +m[3] : c === 'transparent' ? 0 : 1; };
// verde sólido "solto" (não é WhatsApp nem status) segue a cor primária da escola
const verdeSolto = (c: string) => {
    const m = c.match(/[\d.]+/g); if (!m || alfa(c) < 0.9) return false;
    const [r, g, b] = m.slice(0, 3).map((x) => +x / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    return mx === g && mx - mn > 0.25 && mx > 0.3 && (g - b) > 0.1 && (g - r) > 0.15;
};
const px = (v: string) => parseFloat(v) || 0;
const marca = (el: Element, cls: string) => { el.classList.add(cls); el.setAttribute('data-ux', '1'); };
const nada = (el: Element) => el.setAttribute('data-ux', '-');
const texto = (el: Element) => (el.textContent || '').replace(/\s+/g, ' ').trim();
const SO_NUMERO = /^[R$\s\d.,%+\-/:]+$/;

function botao(el: HTMLElement) {
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
    const cs = getComputedStyle(el);
    if (el.getAttribute('role') === 'tab' || r.height > 72 || el.querySelector('img, div, p, h1, h2, h3, h4')) return nada(el);
    const t = texto(el), temIcone = !!el.querySelector('svg, i, img');
    const sm = r.height <= 36;
    if (!t && temIcone) { marca(el, 'ux-btn-ico'); if (sm) el.classList.add('ux-btn-sm'); }
    else if (t.length <= 48) {
        marca(el, 'ux-btn'); if (sm) el.classList.add('ux-btn-sm');
        // botão sem estilo nenhum (borda 3D do navegador) vira botão secundário
        const grad = cs.backgroundImage.includes('gradient') && (cs.backgroundImage.match(/rgba?\([^)]*\)/g) || []).some((c) => verdeSolto(c));
        if ((grad || verdeSolto(cs.backgroundColor)) && !/whats|aprov|pag|ativ|confirm/i.test(t) && !/25d366|37,\s*211,\s*102/i.test(cs.backgroundColor)) el.classList.add('ux-btn-primary');
        if (el.closest('.ux-modal, .ux-overlay')) {
            if (/^(cancelar|fechar|voltar|não|nao)$/i.test(t)) el.classList.add('ux-btn-cancel');
            else if (/^(salvar|criar|adicionar|confirmar|enviar|gerar|finalizar|ok|aplicar|atualizar|continuar|sim)/i.test(t) && alfa(cs.backgroundColor) > 0.9 && lum(cs.backgroundColor) < 235) el.classList.add('ux-btn-primary');
        }
        if (cs.borderTopStyle === 'outset' || (cs.backgroundColor === 'rgb(239, 239, 239)' && px(cs.borderTopWidth) >= 2)) el.classList.add('ux-btn-raw');
    } else nada(el);
}

function campo(el: HTMLElement) {
    if (el.closest('.al-lado')) return nada(el); // telas de login têm estilo próprio (consistencia.css)
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
    const cs = getComputedStyle(el);
    // sem borda = campo embutido em outro desenho (busca com ícone, célula editável): não mexe
    if (px(cs.borderTopWidth) < 1 || cs.borderTopStyle === 'none' || r.height < 28 || r.width < 56) return nada(el);
    el.style.setProperty('--ux-pl', Math.max(12, px(cs.paddingLeft)) + 'px');
    marca(el, 'ux-field');
}

function titulo(el: HTMLElement) {
    const r = el.getBoundingClientRect(); if (!r.width) return;
    const cs = getComputedStyle(el), t = texto(el);
    if (lum(cs.color) > 150 || t.length < 3 || SO_NUMERO.test(t) || el.closest('th, td, button, a')) return nada(el);
    const n = el.tagName.toLowerCase();
    marca(el, n === 'h1' ? 'ux-h1' : n === 'h2' ? 'ux-h2' : 'ux-h3'); caixa(el);
    if (n === 'h1') {
        // o bloco do título (até o filho direto da moldura) ganha o respiro padrão
        let b: HTMLElement | null = el;
        while (b && b.parentElement && !b.parentElement.matches('.ux-page, .page-container')) b = b.parentElement;
        if (b && b.parentElement) b.classList.add('ux-pagehead');
    }
    const s = el.nextElementSibling;
    if (s && s.tagName === 'P' && texto(s).length > 3 && texto(s).length < 220) s.classList.add('ux-sub');
}

function tabela(el: HTMLTableElement) {
    if (el.closest(IGNORA) || !el.querySelector('th') || el.getBoundingClientRect().width < 200) return nada(el);
    marca(el, 'ux-table');
}

function rotulo(el: HTMLElement) {
    if (el.querySelector('input, select, textarea') || texto(el).length < 2 || texto(el).length > 60 || el.closest('button, th')) return nada(el);
    const cs = getComputedStyle(el); if (px(cs.fontSize) > 15 || lum(cs.color) > 170) return nada(el);
    marca(el, 'ux-label');
}

function selo(el: HTMLElement) {
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
    const cs = getComputedStyle(el), t = texto(el);
    if (!/^inline/.test(cs.display) || r.height < 16 || r.height > 32 || t.length < 1 || t.length > 28 || px(cs.fontSize) > 13.6 || el.closest('button, a, [role=tab], th')) return nada(el);
    if (alfa(cs.backgroundColor) < 0.05 && px(cs.borderTopWidth) < 1) return nada(el);
    if (el.querySelector('div, p, button, input')) return nada(el);
    marca(el, 'ux-badge');
}

function cartao(el: HTMLElement) {
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
    const cs = getComputedStyle(el);
    const [rr, gg, bb] = (cs.backgroundColor.match(/\d+/g) || []).map(Number);
    if (alfa(cs.backgroundColor) < 0.99 || rr < 250 || gg < 250 || bb < 250) return nada(el);
    if (px(cs.borderTopLeftRadius) < 8 || r.width < 200 || r.height < 56 || r.width > innerWidth - 8) {
        // cartão que ocupa a tela toda de ponta a ponta (ex.: janela cheia no celular) não vira cartão
        return nada(el);
    }
    if (cs.boxShadow === 'none' && px(cs.borderTopWidth) < 1) return nada(el);
    marca(el, 'ux-card');
}

function fundo(el: HTMLElement) {
    const cs = getComputedStyle(el);
    if (cs.position !== 'fixed') return nada(el);
    const r = el.getBoundingClientRect();
    if (r.width < innerWidth * 0.95 || r.height < innerHeight * 0.9) return nada(el);
    if (alfa(cs.backgroundColor) < 0.15 || alfa(cs.backgroundColor) > 0.95 || lum(cs.backgroundColor) > 110) return nada(el);
    marca(el, 'ux-overlay');
    // a janela é o primeiro bloco claro com cantos arredondados dentro do fundo
    for (const c of el.querySelectorAll<HTMLElement>(':scope > *, :scope > * > *')) {
        const k = getComputedStyle(c);
        if (lum(k.backgroundColor) > 245 && alfa(k.backgroundColor) > 0.99 && px(k.borderTopLeftRadius) >= 6 && c.getBoundingClientRect().width > 240) {
            c.classList.remove('ux-card'); marca(c, 'ux-modal'); break;
        }
    }
}

// Só os invólucros de página (cadeia de filho único) perdem largura máxima/centralização; o conteúdo dentro fica como está.
function moldura(f: Element) {
    let n: Element = f;
    for (let d = 0; d < 3; d++) {
        const filhos: Element[] = Array.from(n.children).filter((c) => c.tagName !== 'STYLE' && c.tagName !== 'SCRIPT');
        if (filhos.length !== 1) break;
        const c = filhos[0]; n = c;
        if (c.classList.contains('ux-root') || c.classList.contains('ux-root-box')) continue;
        if (c.matches('.ux-overlay, [style*="position: fixed"]')) break;
        const cs = getComputedStyle(c);
        // spinner/ícone pequeno de carregamento não é invólucro de página: esticá-lo a 100% quebra o loading
        if ((cs.animationName && cs.animationName !== 'none') || (c.children.length === 0 && c.getBoundingClientRect().width < 160)) break;
        // invólucro com fundo/sombra próprios é um painel: mantém o respiro de dentro
        const painel = alfa(cs.backgroundColor) > 0.05 || cs.boxShadow !== 'none' || px(cs.borderTopWidth) > 0;
        c.classList.add(painel ? 'ux-root-box' : 'ux-root');
    }
}

const PEQUENAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o', 'para', 'por', 'em', 'no', 'na', 'nos', 'nas', 'com', 'ao', 'à']);
const SIGLAS = new Set(['cpf', 'cnpj', 'pix', 'pdf', 'uba', 'mrr', 'qr', 'rg', 'id', 'sms', 'cep', 'ddd', 'ok', 'url', 'rf']);
// título todo em maiúsculas vira "Título Normal" (siglas ficam)
function caixa(el: HTMLElement) {
    for (const no of Array.from(el.childNodes)) {
        if (no.nodeType !== Node.TEXT_NODE) continue;
        const t = no.nodeValue || '';
        if (t.length < 4 || t !== t.toUpperCase() || !/[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ]{3}/.test(t) || /\d{3}/.test(t)) continue;
        no.nodeValue = t.toLowerCase().replace(/[a-záàâãéêíóôõúç]+/g, (w, i) => {
            if (SIGLAS.has(w)) return w.toUpperCase();
            if (i > 0 && PEQUENAS.has(w)) return w;
            return w[0].toUpperCase() + w.slice(1);
        });
    }
}

const CAND = 'button, input, select, textarea, table, h1, h2, h3, label, span[style], small[style], div[style], section[style], article[style], li[style], [class*="card"], [class*="overlay"], [class*="modal"]';
const TIPOS_TEXTO = /^(text|email|password|number|tel|date|time|search|url|datetime-local|month|week)$/;

function varre(raiz: ParentNode) {
    const els = raiz.querySelectorAll<HTMLElement>(CAND);
    // janelas primeiro, para os cartões de dentro não virarem cartões soltos
    const ordem = Array.from(els).filter((e) => !e.hasAttribute('data-ux'));
    for (const el of ordem) if (/^DIV$|^SECTION$/.test(el.tagName) && /overlay|modal|fixed/i.test(el.className + (el.getAttribute('style') || ''))) fundo(el);
    for (const el of ordem) {
        if (el.hasAttribute('data-ux') || el.closest('aside, nav, [data-ux-skip]')) continue;
        const t = el.tagName;
        if (t === 'BUTTON') botao(el);
        else if (t === 'INPUT') { if (TIPOS_TEXTO.test((el as HTMLInputElement).type)) campo(el); else nada(el); }
        else if (t === 'SELECT' || t === 'TEXTAREA') campo(el);
        else if (t === 'TABLE') tabela(el as HTMLTableElement);
        else if (/^H[123]$/.test(t)) { if (el.closest('.ux-page')) titulo(el); else nada(el); }
        else if (t === 'LABEL') rotulo(el);
        else if (t === 'SPAN' || t === 'SMALL') selo(el);
        else if (/^DIV$|^SECTION$|^ARTICLE$|^LI$/.test(t)) {
            if (el.classList.contains('ux-overlay') || el.classList.contains('ux-modal')) continue;
            if (/overlay/i.test(el.className) && getComputedStyle(el).position === 'fixed') { fundo(el); continue; }
            cartao(el);
        }
    }
    // barras de botões/campos lado a lado quebram de linha no celular
    document.querySelectorAll<HTMLElement>('.ux-btn, .ux-field').forEach((e) => {
        const pai = e.parentElement; if (!pai || pai.classList.contains('ux-row') || pai.hasAttribute('data-ux-row')) return;
        const cs = getComputedStyle(pai);
        if (cs.display === 'flex' && cs.flexDirection === 'row' && cs.flexWrap === 'nowrap' && pai.querySelectorAll(':scope > .ux-btn, :scope > .ux-field').length >= 2) pai.classList.add('ux-row');
        else pai.setAttribute('data-ux-row', '1');
    });
    document.querySelectorAll('.ux-page').forEach(moldura);
}

let agendado = 0;
// no máximo uma varredura a cada 250 ms, para não pesar em telas com animação
let ultima = 0;
// A primeira varredura depois de uma mudança sai no quadro seguinte (a tela nova já nasce no padrão, sem "pulo");
// mudanças em sequência ficam limitadas a uma varredura a cada 250 ms.
const agenda = () => {
    if (agendado) return;
    const roda = () => { agendado = 0; ultima = performance.now(); try { varre(document); } catch { /* nunca quebra a tela */ } };
    const espera = 250 - (performance.now() - ultima);
    agendado = espera > 0 ? window.setTimeout(roda, espera) : window.requestAnimationFrame(roda);
};

const iniciar = () => {
    new MutationObserver(agenda).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    setInterval(() => { if (!document.hidden) agenda(); }, 6000); // rede de segurança: o observador já pega o resto
    agenda();
};
if (document.body) iniciar(); else document.addEventListener('DOMContentLoaded', iniciar);
