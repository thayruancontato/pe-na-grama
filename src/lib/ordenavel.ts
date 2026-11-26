/**
 * Ordenação em qualquer tabela: um botão ao lado de cada título de coluna.
 * Clique alterna crescente → decrescente → ordem original. Valores em R$, datas dd/mm/aaaa,
 * números e texto são reconhecidos pelo conteúdo. Use data-sem-ordem no <th> para pular a coluna.
 */
const css = `
.ord-btn{display:inline-grid;vertical-align:middle;margin-left:5px;padding:2px;border:0;border-radius:4px;background:transparent;color:inherit;opacity:.35;cursor:pointer;line-height:0}
.ord-btn:hover,.ord-btn:focus-visible{opacity:.9;background:rgba(23,66,143,.1)}
.ord-btn svg{width:11px;height:13px}.ord-btn .c,.ord-btn .b{fill:currentColor;opacity:.45}
th[aria-sort=ascending] .ord-btn,th[aria-sort=descending] .ord-btn{opacity:1;color:#17428f}
th[aria-sort=ascending] .ord-btn .c{opacity:1}th[aria-sort=descending] .ord-btn .b{opacity:1}
th.n .ord-btn{margin-left:0;margin-right:5px;float:none}`;

const SVG = '<svg viewBox="0 0 10 14" aria-hidden="true"><path class="c" d="M5 0l4.5 5.5h-9z"/><path class="b" d="M5 14L.5 8.5h9z"/></svg>';

const norm = (t: string) => t.replace(/\s+/g, ' ').trim();
function valor(t: string): number | string {
    const x = norm(t);
    const d = x.match(/^(\d{2})\/(\d{2})\/(\d{4})/); if (d) return +new Date(+d[3], +d[2] - 1, +d[1]);
    const m = x.match(/^-?\s*R\$\s*([\d.]+,\d{2})$/) || x.match(/^R\$\s*-?\s*([\d.]+,\d{2})$/);
    if (m) return (x.includes('-') ? -1 : 1) * parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
    if (/^-?[\d.]+(,\d+)?%?$/.test(x)) return parseFloat(x.replace(/\./g, '').replace(',', '.'));
    return x.toLocaleLowerCase('pt-BR');
}

function preparar(t: HTMLTableElement) {
    const ths = [...t.querySelectorAll<HTMLTableCellElement>('thead th')];
    const corpo = t.tBodies[0];
    if (!ths.length || !corpo || t.dataset.semOrdem !== undefined) return;
    ths.forEach((th, col) => {
        if (th.dataset.ord || th.hasAttribute('data-sem-ordem') || !norm(th.textContent || '')) return;
        th.dataset.ord = '1';
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'ord-btn'; b.innerHTML = SVG; b.title = 'Ordenar por ' + norm(th.textContent || '');
        b.setAttribute('aria-label', b.title);
        b.addEventListener('click', (e) => {
            e.stopPropagation();
            const atual = th.getAttribute('aria-sort');
            ths.forEach((o) => o.removeAttribute('aria-sort'));
            const linhas = [...corpo.rows].filter((r) => r.cells.length === ths.length);
            if (!linhas.length) return;
            linhas.forEach((r, i) => { if (!r.dataset.ordem0) r.dataset.ordem0 = String(i); });
            const dir = atual === 'ascending' ? 'descending' : atual === 'descending' ? '' : 'ascending';
            if (dir) th.setAttribute('aria-sort', dir);
            const chave = (r: HTMLTableRowElement) => valor(r.cells[col].textContent || '');
            linhas.sort((a, z) => {
                if (!dir) return +(a.dataset.ordem0 || 0) - +(z.dataset.ordem0 || 0);
                const x = chave(a), y = chave(z);
                const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'pt-BR', { numeric: true });
                return dir === 'ascending' ? c : -c;
            });
            linhas.forEach((r) => corpo.appendChild(r));
        });
        th.appendChild(b);
    });
}

export function instalarOrdenavel() {
    if ((window as any).__ordenavel) return;
    (window as any).__ordenavel = true;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    let agendado = false;
    const varre = () => { agendado = false; document.querySelectorAll<HTMLTableElement>('table').forEach(preparar); };
    new MutationObserver(() => { if (!agendado) { agendado = true; requestAnimationFrame(varre); } }).observe(document.body, { childList: true, subtree: true });
    varre();
}
