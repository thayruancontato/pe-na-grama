/**
 * Escola em teste grátis: barra de aviso bonita no topo, opções pagas do menu com cadeado
 * e, ao clicar numa delas (ou em "Escolher plano"), um modal com os planos para a pessoa escolher.
 * Ligado pela Central (controle "teste_ativo"); sair do teste desliga tudo.
 */
type Valores = Record<string, any>;
const BLOQUEADOS = ['Aniversariantes', 'Financeiro', 'Contratos', 'Jogos', 'Eventos', 'Carteirinhas', 'Documentos'];
const DIAS_TESTE = 14;
const LOCK = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
const brl = (c: number) => 'R$ ' + Math.round((c || 0) / 100).toLocaleString('pt-BR');
const cor = (x: unknown, pad: string) => (/^#[0-9a-f]{6}$/i.test(String(x || '')) ? String(x) : pad);

export function instalarTeste(v: Valores) {
    if ((window as any).__teste) return;
    (window as any).__teste = true;
    const pri = cor(v.cor_primaria, '#0f7a3a'), esc = cor(v.cor_escura, '#09245c');
    const fim = /^\d{4}-\d{2}-\d{2}$/.test(String(v.teste_ate || '')) ? new Date(v.teste_ate + 'T23:59:59') : null;
    const restam = fim ? Math.max(0, Math.ceil((fim.getTime() - Date.now()) / 864e5)) : DIAS_TESTE;
    const usados = Math.min(DIAS_TESTE, Math.max(0, DIAS_TESTE - restam));

    const css = document.createElement('style');
    css.textContent = `
.tb{--p:${pri};--e:${esc};display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding:10px 20px;color:#fff;background:linear-gradient(100deg,var(--e),var(--p));font-family:inherit}
.tb-sel{flex:none;padding:5px 11px;border-radius:999px;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.35);font-size:11px;font-weight:800;letter-spacing:.08em}
.tb-txt{flex:1 1 280px;font-size:14px;line-height:1.35}.tb-txt b{font-weight:800}.tb-txt small{display:block;font-size:12px;opacity:.85}
.tb-barra{flex:0 1 190px;height:8px;border-radius:999px;background:rgba(255,255,255,.22);overflow:hidden}.tb-barra i{display:block;height:100%;border-radius:inherit;background:#fff}
.tb-btn{flex:none;border:0;border-radius:999px;padding:9px 18px;background:#fff;color:var(--e);font:inherit;font-size:13px;font-weight:800;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.2)}
.tb-btn:hover{transform:translateY(-1px)}.tb-btn:focus-visible{outline:3px solid #fff;outline-offset:2px}
@media(max-width:700px){.tb{padding:10px 14px;gap:10px}.tb-barra{flex-basis:100%;order:3}}
.sb-bloq{opacity:.72}.sb-bloq .sb-cad{display:inline-flex;margin-left:auto;opacity:.9}
.sb-bloq:hover{opacity:1}
.pm-fundo{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:16px;background:rgba(5,20,16,.62);backdrop-filter:blur(4px);animation:pm-in .2s ease}
@keyframes pm-in{from{opacity:0}}
.pm{--p:${pri};--e:${esc};position:relative;width:min(920px,100%);max-height:94vh;overflow:auto;border-radius:18px;background:#fff;color:#1d2733;box-shadow:0 30px 80px rgba(0,0,0,.4);font-family:inherit}
.pm-topo{padding:26px 30px 18px;color:#fff;background:linear-gradient(110deg,var(--e),var(--p))}
.pm-topo small{display:inline-block;padding:4px 10px;border-radius:999px;background:rgba(255,255,255,.18);font-size:11px;font-weight:800;letter-spacing:.08em}
.pm-topo h2{margin:10px 0 4px;font-size:26px;line-height:1.15}.pm-topo p{margin:0;font-size:14px;opacity:.9}
.pm-x{position:absolute;right:14px;top:14px;width:34px;height:34px;border:0;border-radius:50%;background:rgba(255,255,255,.2);color:#fff;font-size:18px;cursor:pointer}
.pm-lista{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:14px;padding:24px 30px 8px}
.pm-card{position:relative;display:flex;flex-direction:column;gap:8px;padding:20px;border:1px solid #d9dee5;border-radius:14px;background:#fff}
.pm-card.top{border:2px solid var(--p);box-shadow:0 10px 30px rgba(0,0,0,.1)}
.pm-card .sel{position:absolute;top:-11px;left:16px;padding:3px 10px;border-radius:999px;background:var(--p);color:#fff;font-size:11px;font-weight:800;letter-spacing:.05em}
.pm-card h3{margin:0;font-size:18px}.pm-card .pr{font-size:30px;font-weight:800;color:var(--e)}.pm-card .pr small{font-size:13px;font-weight:600;color:#66727f}
.pm-card p{margin:0;font-size:13px;color:#4b5764;line-height:1.45;flex:1}
.pm-card button{margin-top:6px;border:0;border-radius:10px;padding:12px;background:var(--p);color:#fff;font:inherit;font-size:14px;font-weight:800;cursor:pointer}
.pm-card button:hover{filter:brightness(.93)}.pm-card button:disabled{opacity:.6;cursor:wait}
.pm-rod{padding:12px 30px 24px;font-size:12.5px;color:#66727f}
.pm-ok{padding:44px 30px 38px;text-align:center}.pm-ok i{display:inline-grid;place-items:center;width:62px;height:62px;border-radius:50%;background:var(--p);color:#fff;font-size:30px;font-style:normal}
.pm-ok h3{margin:16px 0 6px;font-size:22px}.pm-ok p{margin:0 auto 18px;max-width:420px;color:#4b5764;font-size:14px}
.pm-ok a,.pm-ok button{display:inline-block;border:0;border-radius:10px;padding:12px 22px;background:var(--p);color:#fff;font:inherit;font-weight:800;text-decoration:none;cursor:pointer}
@media(max-width:600px){.pm-topo{padding:22px 18px 14px}.pm-lista{padding:20px 18px 4px}.pm-rod{padding:10px 18px 20px}}
@media(prefers-reduced-motion:reduce){.pm-fundo{animation:none}}`;
    document.head.appendChild(css);

    // ---- barra de aviso ----
    const bar = document.createElement('div');
    bar.className = 'tb'; bar.setAttribute('role', 'status');
    bar.innerHTML = `<span class="tb-sel">TESTE GRÁTIS</span><div class="tb-txt"><b>${restam === 0 ? 'Seu teste terminou hoje' : restam === 1 ? 'Falta 1 dia' : 'Faltam ' + restam + ' dias'}</b> para o fim do teste${fim ? ' (' + fim.toLocaleDateString('pt-BR') + ')' : ''}<small>Alunos, turmas e professores já estão liberados. Escolha um plano para liberar o restante.</small></div><div class="tb-barra" aria-hidden="true"><i style="width:${(usados / DIAS_TESTE) * 100}%"></i></div><button type="button" class="tb-btn">Escolher plano</button>`;
    bar.querySelector('.tb-btn')!.addEventListener('click', () => abrirPlanos());
    const raiz = document.getElementById('root');
    raiz ? raiz.parentNode!.insertBefore(bar, raiz) : document.body.prepend(bar);

    // ---- cadeados no menu ----
    const marca = (raizDom: ParentNode) => raizDom.querySelectorAll?.('.sb-item, .sb-sub').forEach((b) => {
        if (b.classList.contains('sb-bloq')) return;
        const nome = b.querySelector('.sb-label')?.textContent?.trim() || '';
        if (!BLOQUEADOS.includes(nome)) return;
        b.classList.add('sb-bloq'); b.setAttribute('aria-label', nome + ' (bloqueado no teste grátis)');
        const c = document.createElement('span'); c.className = 'sb-cad'; c.innerHTML = LOCK; b.appendChild(c);
    });
    marca(document);
    new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => { if (n instanceof Element) { if (n.matches?.('.sb-item,.sb-sub')) marca(n.parentNode!); marca(n); } }))).observe(document.body, { childList: true, subtree: true });
    document.addEventListener('click', (e) => {
        const b = (e.target as Element).closest?.('.sb-bloq');
        if (!b) return;
        e.preventDefault(); e.stopPropagation(); abrirPlanos();
    }, true);

    // ---- modal de planos ----
    function abrirPlanos() {
        if (document.querySelector('.pm-fundo')) return;
        const fundo = document.createElement('div');
        fundo.className = 'pm-fundo';
        fundo.innerHTML = `<div class="pm" role="dialog" aria-modal="true" aria-label="Escolha o seu plano"><button class="pm-x" type="button" aria-label="Fechar">✕</button><div class="pm-topo"><small>LIBERE TUDO</small><h2>Escolha o plano da sua escola</h2><p>Esse recurso faz parte dos planos. Escolha um e a gente libera para você.</p></div><div class="pm-corpo"><p class="pm-rod" style="padding:30px">Carregando planos…</p></div></div>`;
        document.body.appendChild(fundo);
        const fecha = () => { fundo.remove(); document.removeEventListener('keydown', esc2); };
        const esc2 = (e: KeyboardEvent) => { if (e.key === 'Escape') fecha(); };
        document.addEventListener('keydown', esc2);
        fundo.addEventListener('click', (e) => { if (e.target === fundo) fecha(); });
        fundo.querySelector('.pm-x')!.addEventListener('click', fecha);
        const corpo = fundo.querySelector('.pm-corpo') as HTMLElement;
        fetch('/sys/public/planos', { cache: 'no-store' }).then((r) => r.json()).then(({ planos, whats }) => {
            if (!planos?.length) { corpo.innerHTML = '<p class="pm-rod" style="padding:30px">Nenhum plano disponível agora. Fale com a gente pelo WhatsApp.</p>'; return; }
            const meio = Math.min(1, planos.length - 1);
            corpo.innerHTML = `<div class="pm-lista">${planos.map((p: any, i: number) => `<div class="pm-card${i === meio ? ' top' : ''}">${i === meio ? '<span class="sel">MAIS ESCOLHIDO</span>' : ''}<h3>${p.nome}</h3><div class="pr">${brl(p.mensal)}<small> /mês</small></div><p>${p.descricao || ''}</p><button type="button" data-p="${p.nome}">Escolher este plano</button></div>`).join('')}</div><p class="pm-rod">Sem fidelidade. Seus dados e o que você já cadastrou continuam do jeito que estão.</p>`;
            corpo.querySelectorAll('button[data-p]').forEach((bt) => bt.addEventListener('click', async () => {
                const nome = (bt as HTMLElement).dataset.p!; corpo.querySelectorAll('button').forEach((x) => ((x as HTMLButtonElement).disabled = true));
                try {
                    const r = await fetch('/sys/plano', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + (localStorage.getItem('pg_sys_token') || '') }, body: JSON.stringify({ plano: nome }) });
                    const j = await r.json(); if (!r.ok) throw new Error(j.erro || 'Não foi possível registrar.');
                    const zap = j.whats || whats;
                    corpo.innerHTML = `<div class="pm-ok"><i>✓</i><h3>Plano ${nome} escolhido!</h3><p>Recebemos o seu pedido. Nossa equipe confirma e libera o seu plano em seguida${zap ? '. Para agilizar, chame a gente no WhatsApp.' : '.'}</p>${zap ? `<a href="https://wa.me/${zap}?text=${encodeURIComponent('Olá! Escolhi o plano ' + nome + ' para a minha escola.')}" target="_blank" rel="noreferrer">Falar no WhatsApp</a>` : '<button type="button" class="pm-fim">Fechar</button>'}</div>`;
                    corpo.querySelector('.pm-fim')?.addEventListener('click', fecha);
                } catch (x) { corpo.querySelectorAll('button').forEach((y) => ((y as HTMLButtonElement).disabled = false)); alert((x as Error).message); }
            }));
        }).catch(() => { corpo.innerHTML = '<p class="pm-rod" style="padding:30px">Não consegui carregar os planos agora. Tente de novo em instantes.</p>'; });
    }
}
