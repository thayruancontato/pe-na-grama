// Controle do dono (Central) aplicado no sistema da escola. O Worker injeta window.__MARCA__.controle = { valores, bloqueados }.
// bloqueado(): módulo desligado (menu e página). O resto é visual: cores, avisos, rodapé, botão de WhatsApp, letras e animações.
type Controle = { valores: Record<string, any>; bloqueados: string[] };
const c: Controle = (typeof window !== 'undefined' && (window as any).__MARCA__?.controle) || { valores: {}, bloqueados: [] };
const v = c.valores;

export const valorControle = (k: string) => v[k];
export const bloqueado = (path: string) => c.bloqueados.some((p) => path === p || path.startsWith(p + '/'));

function aplicar() {
    if (!Object.keys(v).length) return;
    const css: string[] = [];
    const fontes: Record<string, string> = { sans: 'Arial, Helvetica, sans-serif', serif: 'Georgia, "Times New Roman", serif', mono: '"Courier New", monospace' };
    if (fontes[v.fonte]) css.push(`body, button, input, select, textarea { font-family: ${fontes[v.fonte]} !important; }`);
    if (v.cantos_retos) css.push('*, *::before, *::after { border-radius: 0 !important; }');
    if (v.sem_animacoes) css.push('*, *::before, *::after { animation: none !important; transition: none !important; }');
    if (v.letra_grande) css.push('body { zoom: 1.12; }');
    if (v.ocultar_whatsapp_pais) css.push('body[data-pg-aluno] a[href*="wa.me"]:not([data-pg]), body[data-pg-aluno] a[href*="api.whatsapp.com"]:not([data-pg]) { display: none !important; }');
    if (css.length) { const s = document.createElement('style'); s.textContent = css.join('\n'); document.head.appendChild(s); }

    // ---- cores: troca as quatro cores do sistema nos estilos, atributos de SVG e folhas de estilo ----
    const PADRAO: Record<string, string> = { cor_primaria: '#00a63a', cor_secundaria: '#17428f', cor_escura: '#09245c', cor_destaque: '#f4c20d' };
    const trocas: [RegExp, string][] = [];
    for (const [k, de] of Object.entries(PADRAO)) {
        const para = String(v[k] || '').toLowerCase();
        if (!/^#[0-9a-f]{6}$/.test(para) || para === de) continue;
        const [r, g, b] = [1, 3, 5].map((i) => parseInt(de.slice(i, i + 2), 16));
        trocas.push([new RegExp(`${de}|rgb\\(\\s*${r},\\s*${g},\\s*${b}\\s*\\)`, 'gi'), para]);
        trocas.push([new RegExp(`rgba\\(\\s*${r},\\s*${g},\\s*${b},`, 'gi'), `rgba(${[1, 3, 5].map((i) => parseInt(para.slice(i, i + 2), 16)).join(', ')},`]);
    }
    if (trocas.length) {
        const pinta = (t: string) => trocas.reduce((s, [re, novo]) => s.replace(re, novo), t);
        const ATTRS = ['style', 'fill', 'stroke', 'stop-color', 'color'];
        const visita = (n: Node) => {
            if (n.nodeType !== 1) return;
            const el = n as Element;
            for (const a of ATTRS) { const x = el.getAttribute(a); if (x) { const y = pinta(x); if (y !== x) el.setAttribute(a, y); } }
            el.childNodes.forEach(visita);
        };
        const obs = new MutationObserver((ms) => { for (const m of ms) { if (m.type === 'attributes') visita(m.target); else m.addedNodes.forEach(visita); } });
        const iniciar = () => { visita(document.body); obs.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ATTRS }); };
        document.body ? iniciar() : document.addEventListener('DOMContentLoaded', iniciar);
        // folhas de estilo do sistema: baixa o texto, troca as cores e usa a cópia
        document.querySelectorAll('link[rel="stylesheet"]').forEach((l) => {
            const href = (l as HTMLLinkElement).href;
            if (!href.startsWith(location.origin)) return;
            fetch(href).then((r) => r.text()).then((t) => { const s = document.createElement('style'); s.textContent = pinta(t); l.after(s); l.remove(); }).catch(() => {});
        });
    }

    // ---- título da aba ----
    if (v.titulo_aba) {
        const t = String(v.titulo_aba);
        const fixa = () => { if (document.title !== t) document.title = t; };
        fixa();
        new MutationObserver(fixa).observe(document.querySelector('title') || document.head, { childList: true, subtree: true, characterData: true });
    }

    // ---- faixas, avisos por tela, rodapé e botão de WhatsApp ----
    const topo = document.createElement('div');
    topo.style.cssText = 'position:sticky;top:0;z-index:100000;font-family:Arial,sans-serif;';
    const mk = (cor: string, texto: string, link?: string, extra = '') => {
        const d = document.createElement('div');
        d.style.cssText = `background:${cor};color:#fff;padding:8px 14px;text-align:center;font-size:14px;line-height:1.4;${extra}`;
        const seguro = /^https?:\/\//i.test(link || '');
        if (seguro) { const a = document.createElement('a'); a.href = link!; a.target = '_blank'; a.rel = 'noopener'; a.style.cssText = 'color:#fff;text-decoration:underline'; a.textContent = texto; d.appendChild(a); } else d.textContent = texto;
        return d;
    };
    if (v.banner_ativo && v.banner_texto) topo.appendChild(mk(/^#[0-9a-f]{6}$/i.test(v.banner_cor) ? v.banner_cor : '#b45309', String(v.banner_texto), v.banner_link));
    const avisoTela = document.createElement('div');
    topo.appendChild(avisoTela);
    const AVISOS: [string, string][] = [['/admin/login', 'aviso_login'], ['/aluno/login', 'aviso_login'], ['/admin/dashboard', 'aviso_admin'], ['/aluno/dashboard', 'aviso_pais'], ['/professor/turmas', 'aviso_professor'], ['/aluno/financeiro', 'aviso_financeiro']];
    const atualizaAviso = () => {
        const p = location.pathname.replace(/\/$/, ''), a = AVISOS.find(([r]) => r === p), t = a && v[a[1]];
        avisoTela.replaceChildren();
        if (t) avisoTela.appendChild(mk('#17428f', String(t)));
        document.body.toggleAttribute('data-pg-aluno', p.startsWith('/aluno'));
    };
    for (const m of ['pushState', 'replaceState'] as const) { const o = history[m]; history[m] = function (this: History, ...a: any[]) { const r = (o as any).apply(this, a); setTimeout(atualizaAviso, 0); return r; } as any; }
    window.addEventListener('popstate', atualizaAviso);
    const montar = () => {
        document.body.prepend(topo); atualizaAviso();
        if (v.rodape_texto) { const f = mk('transparent', String(v.rodape_texto), v.rodape_link, 'color:#667;font-size:12px;'); const a = f.querySelector('a'); if (a) (a as HTMLElement).style.color = '#667'; else f.style.color = '#667'; document.body.appendChild(f); }
        const num = String(v.wa_numero || '').replace(/\D/g, '');
        if (v.wa_flutuante && num.length >= 10) {
            const a = document.createElement('a');
            a.setAttribute('data-pg', '1'); a.target = '_blank'; a.rel = 'noopener';
            a.href = `https://wa.me/${num}?text=${encodeURIComponent(String(v.wa_mensagem || ''))}`;
            a.textContent = String(v.wa_texto || 'WhatsApp');
            a.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:99999;background:#25d366;color:#fff;padding:12px 18px;border-radius:999px;font:bold 14px Arial,sans-serif;text-decoration:none;box-shadow:0 4px 14px rgba(0,0,0,.25)';
            document.body.appendChild(a);
        }
    };
    document.body ? montar() : document.addEventListener('DOMContentLoaded', montar);
}
try { aplicar(); } catch (e) { console.error('controle:', e); }
