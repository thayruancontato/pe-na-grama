/**
 * Plano atual da escola, logo abaixo da logo no menu lateral do administrador.
 *  - em teste: "Teste grátis · faltam N dias" + botão para escolher o plano
 *  - assinante: nome do plano, valor e vencimento; faltando 7 dias ou menos (ou vencida),
 *    aparece o botão "Pagar próxima fatura", que abre o Pix da cobrança em aberto no Asaas.
 */
type Info = { situacao?: { status: string; plano?: string; mensal?: number }; proxima?: { vencimento: string; valor: number; dias: number; atrasada?: boolean } | null };
type Valores = Record<string, any>;

const brl = (c: number) => ((c || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const dataBr = (iso: string) => iso.split('-').reverse().join('/');

export function instalarPlano(v: Valores) {
    if ((window as any).__plano) return;
    (window as any).__plano = true;

    const css = document.createElement('style');
    css.textContent = `
.pl-chip{position:relative;z-index:3;display:flex;align-items:center;justify-content:space-between;gap:8px;margin:-19px 12px 8px;padding:6px 8px 6px 12px;border-radius:12px;background:#09245c;border:1px solid rgba(255,255,255,.28);box-shadow:0 8px 18px rgba(0,0,0,.28);color:#fff;font-family:inherit}
.pl-txt{display:grid;min-width:0}.pl-txt b{font-size:13.5px;font-weight:800;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pl-txt small{font-size:11.5px;opacity:.85;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pl-chip button{flex:none;border:0;border-radius:8px;padding:7px 10px;background:#fff;color:#10213f;font:inherit;font-size:12px;font-weight:800;cursor:pointer}
.pl-chip button:hover{filter:brightness(.93)}
.pl-chip.alerta{background:#8a5a00;border-color:#ffc400}
.pl-chip.atraso{background:#8a1c1c;border-color:#ff8a7a}
.pl-chip.atraso button{background:#ffe3df;color:#8a1c1c}`;
    document.head.appendChild(css);

    let info: Info | null = null;
    const token = () => localStorage.getItem('pg_sys_token') || '';
    const diasTeste = () => {
        const f = /^\d{4}-\d{2}-\d{2}$/.test(String(v.teste_ate || '')) ? new Date(v.teste_ate + 'T00:00:00') : null;
        if (!f) return null;
        const h = new Date(); return Math.max(0, Math.round((f.getTime() - new Date(h.getFullYear(), h.getMonth(), h.getDate()).getTime()) / 864e5));
    };
    const noAdmin = () => location.pathname.startsWith('/admin') && !location.pathname.includes('/login') && Boolean(token());

    async function carrega() {
        if (!noAdmin()) return;
        try {
            const r = await fetch('/sys/assinatura', { headers: { authorization: 'Bearer ' + token() }, cache: 'no-store' });
            if (r.ok) { info = await r.json(); pinta(); }
        } catch { /* tenta no próximo ciclo */ }
    }

    function conteudo(): { html: string; cls: string; acao?: () => void } | null {
        const s = info?.situacao; if (!s) return null;
        if (s.status === 'teste') {
            const d = diasTeste();
            return { cls: '', html: `<div class="pl-txt"><b>Teste grátis</b><small>${d === null ? 'Plano atual' : d === 0 ? 'termina hoje' : d === 1 ? 'falta 1 dia' : 'faltam ' + d + ' dias'}</small></div><button type="button">Escolher plano</button>`, acao: () => (window as any).__pgModal?.planos() };
        }
        if (s.status !== 'ativo') return null;
        const nome = s.plano && s.plano !== 'Teste grátis' ? s.plano.replace(/^Plano\s+/i, '') : 'Ativo';
        const p = info?.proxima, perto = p && p.dias <= 7;
        const linha = [s.mensal ? brl(s.mensal) + '/mês' : '', p ? (p.atrasada || p.dias < 0 ? 'venceu ' : 'vence ') + dataBr(p.vencimento).slice(0, 5) : ''].filter(Boolean).join(' · ');
        return {
            cls: perto ? (p!.atrasada || p!.dias < 0 ? 'atraso' : 'alerta') : '',
            html: `<div class="pl-txt"><b>Plano ${nome.replace(/[<>&]/g, '')}</b>${linha ? `<small>${linha}</small>` : ''}</div>${perto ? `<button type="button" title="Pagar a próxima fatura">Pagar fatura</button>` : ''}`,
            acao: perto ? () => (window as any).__pgModal?.proxima() : undefined,
        };
    }

    function pinta() {
        const aside = document.querySelector('aside'); const topo = aside?.firstElementChild as HTMLElement | null;
        if (!aside || !topo || !noAdmin()) { document.querySelector('.pl-chip')?.remove(); return; }
        const c = conteudo();
        let chip = aside.querySelector('.pl-chip') as HTMLElement | null;
        if (!c || aside.getBoundingClientRect().width < 120) { chip?.remove(); return; }
        const sig = c.cls + c.html;
        if (chip && chip.dataset.sig === sig) return;
        chip?.remove();
        chip = document.createElement('div'); chip.className = 'pl-chip ' + c.cls; chip.dataset.sig = sig; chip.innerHTML = c.html;
        chip.querySelector('button')?.addEventListener('click', () => c.acao?.());
        topo.after(chip);
    }

    new MutationObserver(() => requestAnimationFrame(pinta)).observe(document.body, { childList: true, subtree: true });
    carrega(); setInterval(carrega, 60000); setInterval(pinta, 2000);
}
