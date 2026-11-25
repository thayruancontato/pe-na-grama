/**
 * Escola em teste grátis: barra de aviso bonita no topo, opções pagas do menu com cadeado
 * e, ao clicar numa delas (ou em "Escolher plano"), um modal com os planos para a pessoa escolher.
 * Ligado pela Central (controle "teste_ativo"); sair do teste desliga tudo.
 */
import { prepararLogo } from './logoEscola';
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

    new Image().src = '/teste-foto.webp'; // já carrega a foto do modal, para ele abrir completo
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
.pm-fundo{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:14px;background:rgba(5,20,16,.66);backdrop-filter:blur(5px);animation:pm-in .22s ease}
@keyframes pm-in{from{opacity:0}}@keyframes pm-up{from{opacity:0;transform:translateY(18px) scale(.98)}}
.pm{--p:${pri};--e:${esc};position:relative;width:min(980px,100%);max-height:96vh;overflow:auto;border-radius:20px;background:#fff;color:#1d2733;box-shadow:0 40px 100px rgba(0,0,0,.45);font-family:inherit;animation:pm-up .3s ease}
.pm-x{position:absolute;right:14px;top:14px;z-index:3;width:34px;height:34px;border:0;border-radius:50%;background:rgba(0,0,0,.35);color:#fff;font-size:17px;cursor:pointer}.pm-x:hover{background:rgba(0,0,0,.55)}
.pm-topo{position:relative;overflow:hidden;min-height:232px;color:#fff;background:var(--e)}
.pm-foto{position:absolute;right:0;top:0;bottom:0;width:62%;background:url(/teste-foto.webp) 62% 38%/cover no-repeat}
.pm-topo::before{content:"";position:absolute;inset:0;z-index:1;background:linear-gradient(90deg,var(--e) 0%,var(--e) 36%,color-mix(in srgb,var(--e) 55%,transparent) 62%,transparent 100%)}
.pm-topo-in{position:relative;z-index:2;display:grid;gap:11px;max-width:620px;padding:26px 34px 28px}
.pm-id{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.pm-logo{flex:none;display:grid;place-items:center;width:104px;height:64px;padding:7px 11px;border-radius:12px;background:#fff;box-shadow:0 8px 22px rgba(0,0,0,.3)}.pm-logo img{max-width:100%;max-height:100%;object-fit:contain}
.pm-nome{font-size:14px;font-weight:700;opacity:.95}
.pm-pill{display:inline-block;margin-top:3px;padding:4px 11px;border-radius:999px;background:#ffd84a;color:#2b2100;font-size:12px;font-weight:800}
.pm-topo h2{margin:2px 0 0;font-size:31px;line-height:1.1;letter-spacing:-.01em}
.pm-topo p{margin:0;font-size:16px;opacity:.93}
.pm-tira{display:flex;align-items:center;gap:14px;margin:18px 30px 0;padding:12px 16px;border-radius:12px;background:#f1f8f3}
.pm-tira i{flex:none;display:grid;place-items:center;width:42px;height:42px;border-radius:11px;background:#fff;color:var(--p);box-shadow:0 2px 8px rgba(0,0,0,.08)}
.pm-tira b{display:block;font-size:16px;color:var(--e)}.pm-tira span{font-size:13.5px;color:#4b5764}
.pm-direita{padding:20px 30px 22px}
.pm-lista{display:grid;grid-template-columns:repeat(auto-fit,minmax(196px,1fr));gap:14px;align-items:stretch;padding-top:12px}
.pm-card{position:relative;display:flex;flex-direction:column;gap:7px;padding:20px 18px 18px;border:1px solid #d9dee5;border-radius:14px;background:#fff;transition:transform .18s,box-shadow .18s}
.pm-card:hover{transform:translateY(-3px);box-shadow:0 12px 28px rgba(0,0,0,.1)}
.pm-card.top{border:2px solid var(--p);background:color-mix(in srgb,var(--p) 6%,#fff);box-shadow:0 14px 34px rgba(0,0,0,.14)}
.pm-card .sel{position:absolute;top:-13px;left:50%;transform:translateX(-50%);white-space:nowrap;padding:5px 13px;border-radius:999px;background:var(--p);color:#fff;font-size:12px;font-weight:800}
.pm-card h3{margin:0;font-size:20px}.pm-card .lim{font-size:13.5px;font-weight:700;color:var(--e)}
.pm-card .pr{font-size:34px;font-weight:800;line-height:1.05;color:var(--p)}.pm-card .pr small{font-size:14px;font-weight:600;color:#66727f}
.pm-card .dia{font-size:12px;color:#66727f}
.pm-card p{margin:0;font-size:13.5px;color:#3f4a56;line-height:1.45;flex:1}
.pm-card button{margin-top:8px;border:2px solid var(--p);border-radius:10px;padding:12px 8px;background:#fff;color:var(--p);font:inherit;font-size:14.5px;font-weight:800;cursor:pointer;transition:background .15s,color .15s}
.pm-card.top button{background:var(--p);color:#fff}
.pm-card button:hover{background:var(--p);color:#fff;filter:brightness(.95)}.pm-card button:disabled{opacity:.6;cursor:wait}
.pm-garantia{display:grid;grid-template-columns:repeat(3,1fr);margin:16px 0 0;padding:12px 6px;border-radius:10px;background:#f1f8f3;font-size:13.5px;font-weight:700;color:#24523a;text-align:center}
.pm-garantia span+span{border-left:1px solid #cfe3d6}
.pm-zap{display:inline-block;margin-top:12px;font-size:13px;font-weight:700;color:var(--e)}
.pm-rod{padding:14px 28px;font-size:13px;color:#66727f}
.pm-ok{padding:44px 30px 40px;text-align:center}.pm-ok i{display:inline-grid;place-items:center;width:64px;height:64px;border-radius:50%;background:var(--p);color:#fff;font-size:30px;font-style:normal;animation:pm-up .4s ease}
.pm-ok h3{margin:16px 0 6px;font-size:23px}.pm-ok p{margin:0 auto 18px;max-width:440px;color:#4b5764;font-size:14.5px}
.pm-ok a,.pm-ok button{display:inline-block;border:0;border-radius:10px;padding:12px 24px;background:var(--p);color:#fff;font:inherit;font-weight:800;text-decoration:none;cursor:pointer}
@media(max-width:760px){.pm-foto{width:100%;opacity:.55;background-position:70% 30%}.pm-topo::before{background:linear-gradient(180deg,color-mix(in srgb,var(--e) 92%,transparent),color-mix(in srgb,var(--e) 62%,transparent))}.pm-topo-in{padding:22px 18px}.pm-topo h2{font-size:23px}.pm-tira{margin:14px 16px 0}.pm-direita{padding:16px 16px 20px}.pm-garantia{grid-template-columns:1fr;gap:6px}.pm-garantia span+span{border-left:0}}
@media(prefers-reduced-motion:reduce){.pm-fundo,.pm,.pm-ok i{animation:none}}`;
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
        e.preventDefault(); e.stopPropagation(); abrirPlanos(b.querySelector('.sb-label')?.textContent?.trim());
    }, true);

    // ---- modal de planos ----
    const RECURSOS: Record<string, [string, string, string, string]> = {
        Financeiro: ['Libere o Financeiro da sua escola', 'Organize mensalidades e receba com Pix.', 'Financeiro em todos os planos', 'Mensalidades, recebimentos e atrasos em um só lugar.'],
        Contratos: ['Libere os Contratos digitais', 'O responsável assina pelo celular, sem papel.', 'Contratos em todos os planos', 'Modelos prontos, assinatura digital e tudo guardado.'],
        Carteirinhas: ['Libere as Carteirinhas com a sua marca', 'Com QR para a portaria, prontas para imprimir.', 'Carteirinhas em todos os planos', 'Vários modelos de arte, com a logo da escola.'],
        Aniversariantes: ['Libere as artes de aniversário', 'Cartões prontos com o nome e a foto do aluno.', 'Aniversariantes em todos os planos', 'Modelos de arte e envio rápido para o responsável.'],
        Jogos: ['Libere Jogos e convocações', 'Convoque os atletas e avise os responsáveis.', 'Jogos em todos os planos', 'Convocações organizadas e fáceis de compartilhar.'],
        Eventos: ['Libere os Eventos da escola', 'Inscrições, jogos e resultados num só lugar.', 'Eventos em todos os planos', 'Campeonatos e torneios com a cara da sua escola.'],
        Documentos: ['Libere os Documentos da escola', 'Tudo guardado, organizado e à mão.', 'Documentos em todos os planos', 'Arquivos da escola sempre no lugar certo.'],
    };
    const PADRAO: [string, string, string, string] = ['Libere tudo para a sua escola', 'Escolha o plano e continue de onde parou.', 'Todos os recursos em todos os planos', 'Financeiro, contratos, carteirinhas, eventos e muito mais.'];
    const seguro = (t: string) => t.replace(/[<>&"]/g, '');
    function abrirPlanos(item?: string) {
        if (document.querySelector('.pm-fundo')) return;
        const fundo = document.createElement('div');
        fundo.className = 'pm-fundo';
        const dias = restam === 0 ? 'termina hoje' : restam === 1 ? 'falta 1 dia' : 'faltam ' + restam + ' dias';
        const [titulo, sub, tiraT, tiraD] = RECURSOS[item || ''] || PADRAO;
        fundo.innerHTML = `<div class="pm" role="dialog" aria-modal="true" aria-label="Escolha o seu plano"><button class="pm-x" type="button" aria-label="Fechar">✕</button><div class="pm-topo"><div class="pm-foto" role="img" aria-label="Treinador comemorando com um aluno"></div><div class="pm-topo-in"><div class="pm-id"><div class="pm-logo"><img class="pm-logo-img" alt="Logo da escola"></div><div><div class="pm-nome"></div><span class="pm-pill">Seu teste grátis · ${dias}</span></div></div><h2>${titulo}</h2><p>${sub}</p></div></div><div class="pm-tira"><i>${LOCK}</i><div><b>${tiraT}</b><span>${tiraD}</span></div></div><div class="pm-corpo"><p class="pm-rod">Carregando planos…</p></div></div>`;
        document.body.appendChild(fundo);
        prepararLogo().then((l) => { const im = fundo.querySelector('.pm-logo-img') as HTMLImageElement | null; if (im) im.src = l.src; });
        const fecha = () => { fundo.remove(); document.removeEventListener('keydown', esc2); };
        const esc2 = (e: KeyboardEvent) => { if (e.key === 'Escape') fecha(); };
        document.addEventListener('keydown', esc2);
        fundo.addEventListener('click', (e) => { if (e.target === fundo) fecha(); });
        fundo.querySelector('.pm-x')!.addEventListener('click', fecha);
        const corpo = fundo.querySelector('.pm-corpo') as HTMLElement;
        fetch('/sys/public/planos', { cache: 'no-store' }).then((r) => r.json()).then(({ planos, whats, escola }) => {
            const nm = fundo.querySelector('.pm-nome'); if (nm && escola) nm.textContent = escola;
            if (!planos?.length) { corpo.innerHTML = '<p class="pm-rod" style="padding:30px">Nenhum plano disponível agora. Fale com a gente pelo WhatsApp.</p>'; return; }
            const meio = Math.min(1, planos.length - 1);
            const lim = (d: string) => { const m = /até\s+(\d+)\s+alunos/i.exec(d || ''); return m ? 'até ' + m[1] + ' alunos' : ''; };
            const resumo = (d: string) => (d || '').replace(/^[^:]*:\s*/, '').replace(/^até\s+\d+\s+alunos,?\s*/i, '').replace(/^./, (c) => c.toUpperCase());
            const zapLink = whats ? `<a class="pm-zap" href="https://wa.me/${whats}?text=${encodeURIComponent('Olá! Estou testando o sistema e quero tirar uma dúvida sobre os planos.')}" target="_blank" rel="noreferrer">Prefere conversar antes? Chame no WhatsApp →</a>` : '';
            corpo.innerHTML = `<div class="pm-direita"><div class="pm-lista">${planos.map((p: any, i: number) => `<div class="pm-card${i === meio ? ' top' : ''}">${i === meio ? '<span class="sel">★ Plano recomendado</span>' : ''}<h3>${seguro(p.nome)}</h3><span class="lim">${lim(p.descricao)}</span><div class="pr">${brl(p.mensal)}<small> /mês</small></div><span class="dia">≈ R$ ${(p.mensal / 100 / 30).toFixed(2).replace('.', ',')} por dia</span><p>${seguro(resumo(p.descricao))}</p><button type="button" data-p="${seguro(p.nome)}">${i === meio ? 'Quero o ' + seguro(p.nome) : 'Escolher ' + seguro(p.nome)}</button></div>`).join('')}</div><div class="pm-garantia"><span>✓ Sem fidelidade</span><span>✓ Seus dados são preservados</span><span>✓ Cancele quando quiser</span></div>${zapLink}</div>`;
            corpo.querySelectorAll('button[data-p]').forEach((bt) => bt.addEventListener('click', async () => {
                const nome = (bt as HTMLElement).dataset.p!; corpo.querySelectorAll('button').forEach((x) => ((x as HTMLButtonElement).disabled = true));
                try {
                    const r = await fetch('/sys/plano', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + (localStorage.getItem('pg_sys_token') || '') }, body: JSON.stringify({ plano: nome }) });
                    const j = await r.json(); if (!r.ok) throw new Error(j.erro || 'Não foi possível registrar.');
                    const zap = j.whats || whats;
                    corpo.style.display = 'block';
                    corpo.innerHTML = `<div class="pm-ok"><i>✓</i><h3>Plano ${nome} escolhido!</h3><p>Recebemos o seu pedido. Nossa equipe confirma e libera tudo em seguida${zap ? '. Para agilizar, chame a gente no WhatsApp.' : '.'}</p>${zap ? `<a href="https://wa.me/${zap}?text=${encodeURIComponent('Olá! Escolhi o plano ' + nome + ' para a minha escola.')}" target="_blank" rel="noreferrer">Falar no WhatsApp</a>` : '<button type="button" class="pm-fim">Fechar</button>'}</div>`;
                    corpo.querySelector('.pm-fim')?.addEventListener('click', fecha);
                } catch (x) { corpo.querySelectorAll('button').forEach((y) => ((y as HTMLButtonElement).disabled = false)); alert((x as Error).message); }
            }));
        }).catch(() => { corpo.innerHTML = '<p class="pm-rod" style="padding:30px">Não consegui carregar os planos agora. Tente de novo em instantes.</p>'; });
    }
}
