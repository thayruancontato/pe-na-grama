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
th.n .ord-btn{margin-left:0;margin-right:5px;float:none}
.ord-busca{position:relative;padding:8px 12px;background:#fff;border-bottom:1px solid #e6ebf1}
.ord-busca input{width:100%;box-sizing:border-box;height:32px;padding:0 30px 0 32px;border:1px solid #cfd8e3;border-radius:6px;background:#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='15' height='15' viewBox='0 0 24 24' fill='none' stroke='%2366727f' stroke-width='2.4' stroke-linecap='round'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='m20 20-3.5-3.5'/%3E%3C/svg%3E") 10px center no-repeat;font:inherit;font-size:13px;color:#1d2733}
.ord-busca input:focus{outline:2px solid color-mix(in srgb,#17428f 35%,transparent);border-color:#17428f}
.ord-busca button{position:absolute;right:18px;top:50%;transform:translateY(-50%);border:0;background:none;color:#66727f;font-size:18px;line-height:1;cursor:pointer;display:none}
.ord-busca.tem button{display:block}
.ord-nada{margin:8px 2px 0;font-size:12.5px;color:#8a95a3}.ord-nada[hidden]{display:none}`;

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

const sem = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function buscar(t: HTMLTableElement) {
    const corpo = t.tBodies[0];
    if (!corpo || t.dataset.busca || t.hasAttribute('data-sem-busca') || t.closest('[data-sem-busca], .pm-fundo') || !t.tHead) return;
    t.dataset.busca = '1';
    const alvo = (t.parentElement && getComputedStyle(t.parentElement).overflowY !== 'visible' ? t.parentElement : t) as HTMLElement;
    const pai = alvo.parentElement; if (!pai) return;
    if (alvo.previousElementSibling?.classList.contains('ord-busca')) alvo.previousElementSibling.remove(); // tabela recriada pelo React
    const box = document.createElement('div'); box.className = 'ord-busca'; (box as any)._t = t;
    box.innerHTML = '<input type="search" placeholder="Buscar na tabela…" aria-label="Buscar na tabela" autocomplete="off"><button type="button" aria-label="Limpar busca">×</button><p class="ord-nada" hidden>Nenhum resultado para a busca.</p>';
    const inp = box.querySelector('input')!, limpa = box.querySelector('button')!, nada = box.querySelector('p') as HTMLElement;
    let pendente = false;
    const filtra = () => {
        pendente = false;
        const q = sem(inp.value.trim()); box.classList.toggle('tem', Boolean(q));
        let vis = 0, total = 0;
        [...corpo.rows].forEach((r) => { total++; const ok = !q || sem(r.textContent || '').includes(q); r.style.display = ok ? '' : 'none'; if (ok) vis++; });
        nada.hidden = !(q && total > 0 && !vis);
    };
    inp.addEventListener('input', filtra);
    inp.addEventListener('keydown', (e) => { if (e.key === 'Escape') { inp.value = ''; filtra(); } });
    limpa.addEventListener('click', () => { inp.value = ''; filtra(); inp.focus(); });
    // linhas novas (a tela recarrega os dados) entram já filtradas
    new MutationObserver(() => { if (inp.value && !pendente) { pendente = true; requestAnimationFrame(filtra); } }).observe(corpo, { childList: true });
    pai.insertBefore(box, alvo);
}

function preparar(t: HTMLTableElement) {
    buscar(t);
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
    const varre = () => { agendado = false; document.querySelectorAll<HTMLElement>('.ord-busca').forEach((b) => { if (!(b as any)._t?.isConnected) b.remove(); }); document.querySelectorAll<HTMLTableElement>('table').forEach(preparar); };
    new MutationObserver(() => { if (!agendado) { agendado = true; requestAnimationFrame(varre); } }).observe(document.body, { childList: true, subtree: true });
    varre();
}
