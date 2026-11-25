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
    const meiaNoite = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const restam = fim ? Math.max(0, Math.round((meiaNoite(fim) - meiaNoite(new Date())) / 864e5)) : DIAS_TESTE;
    const usados = Math.min(DIAS_TESTE, Math.max(0, DIAS_TESTE - restam));

    new Image().src = '/teste-foto.webp'; // já carrega a foto do modal, para ele abrir completo
    const css = document.createElement('style');
    css.textContent = `
.tb{--p:${pri};--e:${esc};position:sticky;top:0;z-index:300;display:flex;align-items:center;gap:18px;flex-wrap:wrap;padding:10px 24px;color:#fff;background:linear-gradient(100deg,var(--e),var(--p));box-shadow:0 4px 18px rgba(0,0,0,.18);font-family:inherit}
aside{top:var(--tb-h,0px)!important;height:calc(100vh - var(--tb-h,0px))!important}
.tb-sel{flex:none;padding:5px 12px;border-radius:999px;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.4);font-size:11px;font-weight:800;letter-spacing:.08em}
.tb-txt{flex:1 1 300px;font-size:14px;line-height:1.35}.tb-txt b{font-weight:800}.tb-txt small{display:block;font-size:12px;opacity:.85}
.tb-dir{flex:none;display:flex;align-items:center;gap:18px;margin-left:auto}
.tb-prog{display:grid;gap:5px;min-width:190px}.tb-prog span{font-size:11.5px;font-weight:700;letter-spacing:.03em;opacity:.92;display:flex;justify-content:space-between}
.tb-barra{height:8px;border-radius:999px;background:rgba(255,255,255,.22);overflow:hidden}.tb-barra i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#fff,#e9ffd0)}
.tb-btn{flex:none;display:inline-flex;align-items:center;gap:9px;border:0;border-radius:999px;padding:10px 12px 10px 20px;background:#fff;color:var(--e);font:inherit;font-size:14px;font-weight:800;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.25);transition:transform .15s,box-shadow .15s}
.tb-btn i{display:grid;place-items:center;width:24px;height:24px;border-radius:50%;background:var(--p);color:#fff;font-style:normal;font-size:13px}
.tb-btn:hover{transform:translateY(-1px);box-shadow:0 10px 24px rgba(0,0,0,.3)}.tb-btn:hover i{transform:translateX(2px)}.tb-btn:focus-visible{outline:3px solid #fff;outline-offset:2px}
@media(max-width:760px){.tb{padding:9px 14px;gap:10px}.tb-dir{width:100%;margin-left:0;justify-content:space-between;gap:12px}.tb-prog{flex:1;min-width:0}.tb-sel{display:none}}
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
.pm-logo{flex:none;display:flex;align-items:center;justify-content:center;min-width:104px;height:76px;padding:8px 14px;border-radius:14px;background:#fff;box-shadow:0 8px 22px rgba(0,0,0,.3)}.pm-logo img{display:block;height:60px;width:auto;max-width:168px;object-fit:contain}
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
.pm-pag{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,.9fr);gap:16px;padding:20px 30px 6px}
.pm-pag-esq{padding:22px 24px;border-radius:14px;background:#f1f8f3;border:1px solid #d6e8dc}
.pm-pag .rot{font-size:15px;font-weight:700;color:var(--e)}
.pm-pag .val{margin:6px 0 2px;font-size:46px;font-weight:800;line-height:1.05;color:var(--e);letter-spacing:-.02em}
.pm-pag .venc{font-size:14px;color:#4b5764}
.pm-aguarda{display:inline-flex;align-items:center;gap:11px;margin:16px 0 14px;padding:9px 18px 9px 12px;border-radius:999px;background:#dcf0e2;color:var(--e);font-size:15px;font-weight:800}
.pm-aguarda i{width:14px;height:14px;border-radius:50%;background:#3ecb62;box-shadow:0 0 0 0 rgba(62,203,98,.6);animation:pm-pulso 1.6s ease-out infinite}
@keyframes pm-pulso{70%{box-shadow:0 0 0 12px rgba(62,203,98,0)}100%{box-shadow:0 0 0 0 rgba(62,203,98,0)}}
.pm-pag ol{list-style:none;margin:0;padding:0;display:grid;gap:11px;counter-reset:p}
.pm-pag ol li{counter-increment:p;position:relative;padding-left:40px;font-size:14.5px;line-height:1.4;color:#27323d}
.pm-pag ol li::before{content:counter(p);position:absolute;left:0;top:-2px;display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:#dcf0e2;color:var(--e);font-weight:800;font-size:14px}
.pm-pag-dir{display:flex;flex-direction:column;gap:8px;padding:22px 24px;border-radius:14px;border:2px solid var(--p);background:#fff}
.pm-pag-dir>b{font-size:18px;color:var(--e)}
.pm-qr{display:grid;place-items:center;min-height:200px}
.pm-qr img{width:206px;height:206px;image-rendering:pixelated}
.pm-qr p{margin:0;color:#66727f;font-size:14px}
.pm-pag-dir label{margin-top:4px;font-size:14px;font-weight:700;color:var(--e)}
.pm-pag-dir input{width:100%;box-sizing:border-box;padding:12px 14px;border:1px solid #cfd6de;border-radius:10px;background:#f5f7fa;color:#27323d;font:inherit;font-size:14px;text-overflow:ellipsis}
.pm-copia{display:flex;align-items:center;justify-content:center;gap:10px;border:0;border-radius:10px;padding:14px;background:var(--p);color:#fff;font:inherit;font-size:16px;font-weight:800;cursor:pointer;transition:filter .15s,background .15s}
.pm-copia:hover{filter:brightness(.92)}.pm-copia.ok{background:#1f9d4a}
.pm-rodape{display:flex;align-items:center;gap:22px;flex-wrap:wrap;margin:14px 30px 24px;padding:12px 18px;border-radius:12px;background:#f1f8f3;font-size:14px;font-weight:700;color:#24523a}
.pm-rodape button{margin-left:auto;border:0;background:none;color:var(--e);font:inherit;font-size:14px;font-weight:700;text-decoration:underline;text-underline-offset:3px;cursor:pointer}
.pm-doc{padding:26px 30px 30px;max-width:560px;margin:0 auto;display:grid;gap:12px}
.pm-doc h3{margin:0;font-size:20px;color:var(--e)}.pm-doc p{margin:0;font-size:14px;color:#4b5764}
.pm-doc input{padding:14px;border:2px solid #cfd6de;border-radius:10px;font:inherit;font-size:17px;letter-spacing:.02em}.pm-doc input:focus{outline:none;border-color:var(--p)}
.pm-doc button.go{border:0;border-radius:10px;padding:14px;background:var(--p);color:#fff;font:inherit;font-size:16px;font-weight:800;cursor:pointer}.pm-doc button.go:disabled{opacity:.6;cursor:wait}
.pm-doc .voltar{border:0;background:none;color:var(--e);font:inherit;font-size:14px;font-weight:700;text-decoration:underline;cursor:pointer;justify-self:start}
.pm-doc .err{padding:10px 12px;border-radius:8px;background:#fdecec;color:#8a1c1c;font-size:13.5px}
@media(max-width:760px){.pm-pag{grid-template-columns:1fr;padding:16px 16px 4px}.pm-pag .val{font-size:38px}.pm-rodape{margin:12px 16px 20px;gap:12px}.pm-doc{padding:20px 16px 24px}}
@media(max-width:760px){.pm-logo{height:60px;min-width:84px}.pm-logo img{height:44px;max-width:120px}.pm-foto{width:100%;opacity:.55;background-position:70% 30%}.pm-topo::before{background:linear-gradient(180deg,color-mix(in srgb,var(--e) 92%,transparent),color-mix(in srgb,var(--e) 62%,transparent))}.pm-topo-in{padding:22px 18px}.pm-topo h2{font-size:23px}.pm-tira{margin:14px 16px 0}.pm-direita{padding:16px 16px 20px}.pm-garantia{grid-template-columns:1fr;gap:6px}.pm-garantia span+span{border-left:0}}
@media(prefers-reduced-motion:reduce){.pm-fundo,.pm,.pm-ok i{animation:none}}`;
    document.head.appendChild(css);

    // ---- barra de aviso ----
    const bar = document.createElement('div');
    bar.className = 'tb'; bar.setAttribute('role', 'status');
    const dia = Math.min(DIAS_TESTE, usados + 1);
    bar.innerHTML = `<span class="tb-sel">TESTE GRÁTIS</span><div class="tb-txt"><b>${restam === 0 ? 'Seu teste termina hoje' : restam === 1 ? 'Falta 1 dia' : 'Faltam ' + restam + ' dias'}</b> para o fim do teste${fim ? ' (' + fim.toLocaleDateString('pt-BR') + ')' : ''}<small>Alunos, turmas e professores já estão liberados. Escolha um plano para liberar o restante.</small></div><div class="tb-dir"><div class="tb-prog" aria-hidden="true"><span><em style="font-style:normal">Dia ${dia} de ${DIAS_TESTE}</em><em style="font-style:normal">${restam}d restantes</em></span><div class="tb-barra"><i style="width:${(dia / DIAS_TESTE) * 100}%"></i></div></div><button type="button" class="tb-btn">Escolher plano <i>→</i></button></div>`;
    bar.querySelector('.tb-btn')!.addEventListener('click', () => abrirPlanos());
    const medeBarra = () => document.documentElement.style.setProperty('--tb-h', bar.offsetHeight + 'px');
    new ResizeObserver(medeBarra).observe(bar);
    const raiz = document.getElementById('root');
    raiz ? raiz.parentNode!.insertBefore(bar, raiz) : document.body.prepend(bar);
    medeBarra();

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
    const auth = () => ({ 'content-type': 'application/json', authorization: 'Bearer ' + (localStorage.getItem('pg_sys_token') || '') });
    const dinheiro = (c: number) => ((c || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const dataBr = (iso?: string) => (iso ? iso.split('-').reverse().join('/') : '—');
    const mascaraDoc = (v: string) => { const d = v.replace(/\D/g, '').slice(0, 14); return d.length <= 11 ? d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2') : d.replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d{1,2})$/, '$1-$2'); };
    function abrirPlanos(item?: string) {
        if (document.querySelector('.pm-fundo')) return;
        const fundo = document.createElement('div');
        fundo.className = 'pm-fundo';
        const dias = restam === 0 ? 'termina hoje' : restam === 1 ? 'falta 1 dia' : 'faltam ' + restam + ' dias';
        const [titulo, sub, tiraT, tiraD] = RECURSOS[item || ''] || PADRAO;
        fundo.innerHTML = `<div class="pm" role="dialog" aria-modal="true" aria-label="Escolha o seu plano"><button class="pm-x" type="button" aria-label="Fechar">✕</button><div class="pm-topo"><div class="pm-foto" role="img" aria-label="Treinador comemorando com um aluno"></div><div class="pm-topo-in"><div class="pm-id"><div class="pm-logo"><img class="pm-logo-img" alt="Logo da escola"></div><div><div class="pm-nome"></div><span class="pm-pill">Seu teste grátis · ${dias}</span></div></div><h2>${titulo}</h2><p>${sub}</p></div></div><div class="pm-tira"><i>${LOCK}</i><div><b>${tiraT}</b><span>${tiraD}</span></div></div><div class="pm-corpo"><p class="pm-rod">Carregando…</p></div></div>`;
        document.body.appendChild(fundo);
        prepararLogo().then((l) => { const im = fundo.querySelector('.pm-logo-img') as HTMLImageElement | null; if (im) im.src = l.src; });
        let timer = 0, temDoc = false, escola = '', whats = '';
        const fecha = () => { clearInterval(timer); fundo.remove(); document.removeEventListener('keydown', esc2); };
        const esc2 = (e: KeyboardEvent) => { if (e.key === 'Escape') fecha(); };
        document.addEventListener('keydown', esc2);
        fundo.addEventListener('click', (e) => { if (e.target === fundo) fecha(); });
        fundo.querySelector('.pm-x')!.addEventListener('click', fecha);
        const corpo = fundo.querySelector('.pm-corpo') as HTMLElement;
        const $t = (s: string) => fundo.querySelector(s) as HTMLElement;
        const topo = (t: string, s2: string, pill?: string, tira = true) => {
            $t('.pm-topo h2').innerHTML = t; $t('.pm-topo p').textContent = s2; if (pill) $t('.pm-pill').textContent = pill;
            $t('.pm-tira').style.display = tira ? '' : 'none';
        };
        const msg = (h: string) => { corpo.style.display = ''; corpo.innerHTML = h; };

        // ---- planos
        const telaPlanos = () => {
            clearInterval(timer);
            topo(titulo, sub, 'Seu teste grátis · ' + dias, true);
            msg('<p class="pm-rod">Carregando planos…</p>');
            fetch('/sys/public/planos', { cache: 'no-store' }).then((r) => r.json()).then(({ planos, whats: w, escola: e }) => {
                whats = w || whats; escola = e || escola;
                const nm = $t('.pm-nome'); if (nm && escola) nm.textContent = escola;
                if (!planos?.length) { msg('<p class="pm-rod" style="padding:30px">Nenhum plano disponível agora. Fale com a gente pelo WhatsApp.</p>'); return; }
                const meio = Math.min(1, planos.length - 1);
                const lim = (d: string) => { const m = /até\s+(\d+)\s+alunos/i.exec(d || ''); return m ? 'até ' + m[1] + ' alunos' : ''; };
                const resumo = (d: string) => (d || '').replace(/^[^:]*:\s*/, '').replace(/^até\s+\d+\s+alunos,?\s*/i, '').replace(/^./, (c) => c.toUpperCase());
                const zapLink = whats ? `<a class="pm-zap" href="https://wa.me/${whats}?text=${encodeURIComponent('Olá! Estou testando o sistema e quero tirar uma dúvida sobre os planos.')}" target="_blank" rel="noreferrer">Prefere conversar antes? Chame no WhatsApp →</a>` : '';
                msg(`<div class="pm-direita"><div class="pm-lista">${planos.map((p: any, i: number) => `<div class="pm-card${i === meio ? ' top' : ''}">${i === meio ? '<span class="sel">★ Plano recomendado</span>' : ''}<h3>${seguro(p.nome)}</h3><span class="lim">${lim(p.descricao)}</span><div class="pr">${brl(p.mensal)}<small> /mês</small></div><span class="dia">≈ R$ ${(p.mensal / 100 / 30).toFixed(2).replace('.', ',')} por dia</span><p>${seguro(resumo(p.descricao))}</p><button type="button" data-p="${seguro(p.nome)}">${i === meio ? 'Quero o ' + seguro(p.nome) : 'Escolher ' + seguro(p.nome)}</button></div>`).join('')}</div><div class="pm-garantia"><span>✓ Sem fidelidade</span><span>✓ Seus dados são preservados</span><span>✓ Cancele quando quiser</span></div>${zapLink}</div>`);
                corpo.querySelectorAll('button[data-p]').forEach((bt) => bt.addEventListener('click', () => escolher((bt as HTMLElement).dataset.p!)));
            }).catch(() => msg('<p class="pm-rod" style="padding:30px">Não consegui carregar os planos agora. Tente de novo em instantes.</p>'));
        };

        // ---- escolha: pede CPF/CNPJ (uma vez) e cria a assinatura
        const criar = async (nome: string, doc: string, erroEl?: HTMLElement, btn?: HTMLButtonElement) => {
            if (btn) btn.disabled = true;
            try {
                const r = await fetch('/sys/assinatura', { method: 'POST', headers: auth(), body: JSON.stringify({ plano: nome, doc }) });
                const j = await r.json().catch(() => ({}));
                if (j.indisponivel) { // pagamento online ainda não ligado na Central: só registra a escolha
                    const r2 = await fetch('/sys/plano', { method: 'POST', headers: auth(), body: JSON.stringify({ plano: nome }) }); const j2 = await r2.json();
                    const zap = j2.whats || whats;
                    topo('Plano ' + seguro(nome) + ' escolhido!', 'Recebemos o seu pedido.', 'Pedido recebido', false);
                    msg(`<div class="pm-ok"><i>✓</i><h3>Plano ${seguro(nome)} escolhido!</h3><p>Nossa equipe confirma e libera tudo em seguida${zap ? '. Para agilizar, chame a gente no WhatsApp.' : '.'}</p>${zap ? `<a href="https://wa.me/${zap}?text=${encodeURIComponent('Olá! Escolhi o plano ' + nome + ' para a minha escola.')}" target="_blank" rel="noreferrer">Falar no WhatsApp</a>` : '<button type="button" class="pm-fim">Fechar</button>'}</div>`);
                    corpo.querySelector('.pm-fim')?.addEventListener('click', fecha); return;
                }
                if (!r.ok || !j.ok) throw new Error(j.erro || 'Não foi possível gerar o Pix agora.');
                temDoc = true; telaPagamento(j.assinatura);
            } catch (x) {
                if (erroEl) { erroEl.textContent = (x as Error).message; erroEl.hidden = false; } else alert((x as Error).message);
                if (btn) btn.disabled = false;
            }
        };
        const escolher = (nome: string) => {
            if (temDoc) { msg('<p class="pm-rod" style="padding:30px">Gerando o seu Pix…</p>'); criar(nome, '').then(() => undefined); return; }
            topo('Quase lá! Falta só um dado', 'Para gerar o Pix da primeira fatura do plano ' + seguro(nome) + '.', 'Plano ' + seguro(nome), false);
            msg(`<div class="pm-doc"><h3>CPF ou CNPJ de quem vai pagar</h3><p>É exigido para emitir a cobrança Pix. Usamos só para isso.</p><input id="pm-doc" inputmode="numeric" autocomplete="off" placeholder="000.000.000-00" maxlength="18"><div class="err" hidden></div><button class="go" type="button">Gerar Pix da primeira fatura</button><button class="voltar" type="button">← Voltar aos planos</button></div>`);
            const inp = corpo.querySelector('#pm-doc') as HTMLInputElement, er = corpo.querySelector('.err') as HTMLElement, go = corpo.querySelector('.go') as HTMLButtonElement;
            inp.addEventListener('input', () => { inp.value = mascaraDoc(inp.value); }); inp.focus();
            go.addEventListener('click', () => { er.hidden = true; if (inp.value.replace(/\D/g, '').length < 11) { er.textContent = 'Digite um CPF (11 números) ou CNPJ (14 números).'; er.hidden = false; return; } go.textContent = 'Gerando o Pix…'; criar(nome, inp.value, er, go).finally(() => { go.textContent = 'Gerar Pix da primeira fatura'; }); });
            corpo.querySelector('.voltar')!.addEventListener('click', telaPlanos);
        };

        // ---- pagamento: QR code + copia e cola; confere a cada 6 s e volta aqui se recarregar a página
        const telaPago = () => {
            clearInterval(timer);
            topo('Pagamento confirmado!', 'Tudo liberado na sua escola.', 'Plano ativo', false);
            msg('<div class="pm-ok"><i>✓</i><h3>Tudo liberado!</h3><p>Recebemos o seu pagamento. Estamos atualizando o seu sistema…</p></div>');
            setTimeout(() => location.reload(), 2600);
        };
        const telaPagamento = (a: any) => {
            clearInterval(timer);
            topo('O Plano ' + seguro(a.plano) + ' é seu próximo passo', 'Pague a primeira fatura para liberar os recursos do seu plano.', 'Primeira fatura via Pix', false);
            msg(`<div class="pm-pag"><div class="pm-pag-esq"><span class="rot">Valor da primeira fatura</span><div class="val">${dinheiro(a.valor)}</div><div class="venc">Vencimento: ${dataBr(a.vencimento)}</div><div class="pm-aguarda"><i></i>Aguardando pagamento</div><ol><li>Abra o app do seu banco.</li><li>Escolha Pix e escaneie o QR Code ou cole o código.</li><li>Pronto! Liberamos os recursos na hora.</li></ol></div><div class="pm-pag-dir"><b>Pague com Pix</b><div class="pm-qr">${a.imagem ? `<img src="${a.imagem}" alt="QR Code do Pix">` : '<p>Gerando o QR code…</p>'}</div><label for="pm-cod">Pix copia e cola</label><input id="pm-cod" readonly value="${seguro(a.codigo || '')}"><button type="button" class="pm-copia">Copiar código</button></div></div><div class="pm-rodape"><span>🔒 Pagamento seguro</span><span>✓ Sem fidelidade</span><button type="button" class="pm-trocar">Trocar de plano</button></div>`);
            const cod = corpo.querySelector('#pm-cod') as HTMLInputElement, bc = corpo.querySelector('.pm-copia') as HTMLButtonElement;
            bc.addEventListener('click', async () => {
                if (!a.codigo) return;
                try { await navigator.clipboard.writeText(a.codigo); } catch { cod.select(); document.execCommand('copy'); }
                bc.textContent = '✓ Código copiado!'; bc.classList.add('ok'); setTimeout(() => { bc.textContent = 'Copiar código'; bc.classList.remove('ok'); }, 2500);
            });
            corpo.querySelector('.pm-trocar')!.addEventListener('click', async () => {
                if (!confirm('Trocar de plano cancela esta cobrança e cria outra. Continuar?')) return;
                msg('<p class="pm-rod" style="padding:30px">Cancelando a cobrança…</p>');
                await fetch('/sys/assinatura/trocar', { method: 'POST', headers: auth(), body: '{}' }).catch(() => undefined); telaPlanos();
            });
            timer = window.setInterval(async () => {
                try {
                    const d = await (await fetch('/sys/assinatura', { headers: auth(), cache: 'no-store' })).json();
                    if (d.assinatura && d.assinatura.status === 'paga') telaPago();
                    else if (!d.assinatura) telaPlanos();
                    else if (d.assinatura.codigo && !a.codigo) telaPagamento(d.assinatura);
                } catch { /* tenta de novo no próximo ciclo */ }
            }, 6000);
        };

        // ---- abertura: se já existe uma cobrança pendente, volta direto para o pagamento
        fetch('/sys/assinatura', { headers: auth(), cache: 'no-store' }).then((r) => r.json()).then((d) => {
            temDoc = Boolean(d.temDoc);
            if (d.assinatura && d.assinatura.status === 'paga') telaPago();
            else if (d.assinatura) { fetch('/sys/public/planos').then((r) => r.json()).then((p) => { escola = p.escola || ''; const nm = $t('.pm-nome'); if (nm && escola) nm.textContent = escola; }).catch(() => undefined); telaPagamento(d.assinatura); }
            else telaPlanos();
        }).catch(telaPlanos);
    }
}
