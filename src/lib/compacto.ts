/**
 * Espaçamentos compactos (estilo ERP): reduz todo padding, margin e gap do sistema.
 * A maior parte do espaçamento está escrita direto nos elementos (style), então um CSS não alcança:
 * este script reduz esses valores em cada elemento que aparece ou muda, uma vez só por valor.
 */
const FATOR = 0.68;
const PROPS = ['padding', 'margin', 'gap', 'row-gap', 'column-gap'];
const UNIDADE = /(-?\d*\.?\d+)(px|rem|em)\b/g;
const feito = new WeakMap<HTMLElement, string>();

function reduz(el: HTMLElement) {
    const atual = el.getAttribute('style');
    if (!atual || feito.get(el) === atual) return;
    for (const p of PROPS) {
        // propriedade escrita pelo React (padding, paddingTop...) vira CSS no style; lê e reescreve só as de espaçamento
        for (let i = el.style.length - 1; i >= 0; i--) {
            const nome = el.style.item(i);
            if (!PROPS.some((b) => nome === b || nome.startsWith(b + '-'))) continue;
            const v = el.style.getPropertyValue(nome);
            const n = v.replace(UNIDADE, (_m, num, un) => (+num === 0 ? '0' : (+num * FATOR).toFixed(2).replace(/\.?0+$/, '') + un));
            if (n !== v) el.style.setProperty(nome, n, el.style.getPropertyPriority(nome));
        }
        break; // as propriedades já foram varridas de uma vez
    }
    feito.set(el, el.getAttribute('style') || '');
}

export function instalarCompacto() {
    if ((window as unknown as { __compacto?: boolean }).__compacto) return;
    (window as unknown as { __compacto?: boolean }).__compacto = true;
    const varre = (raiz: Element) => { if (raiz instanceof HTMLElement) reduz(raiz); raiz.querySelectorAll?.('[style]').forEach((e) => reduz(e as HTMLElement)); };
    varre(document.body);
    new MutationObserver((ms) => ms.forEach((m) => {
        if (m.type === 'attributes') reduz(m.target as HTMLElement);
        else m.addedNodes.forEach((n) => { if (n instanceof Element) varre(n); });
    })).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
    const s = document.createElement('style');
    s.textContent = 'table th, table td { padding: 5px 8px !important; } h1, h2, h3, h4, h5, h6 { margin-top: 0.3em; margin-bottom: 0.3em; } hr { margin: 6px 0; }';
    document.head.appendChild(s);
}
