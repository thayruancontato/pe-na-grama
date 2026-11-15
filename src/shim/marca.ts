// Versão "sem-firebase": o Worker injeta window.__MARCA__ = { nome } (a escola do subdomínio).
// Aqui o nome antigo do sistema ("Rumo ao Esporte...") é trocado pelo da escola em tudo o que aparece na tela.
const NOME_ANTIGO = /Rumo ao Esporte( e ao Lazer\s*[-–]\s*REAL)?( 2026)?/gi;
const trocaNome = (t: string) => t.replace(NOME_ANTIGO, (x) => (x === x.toUpperCase() ? nome!.toUpperCase() : nome!));
const TEM_NOME = /rumo ao esporte/i;
const nome = (window as unknown as { __MARCA__?: { nome: string } }).__MARCA__?.nome;
const ATRIBUTOS = ['alt', 'title', 'placeholder', 'aria-label'];

function trocar(no: Node) {
    if (!nome) return;
    if (no.nodeType === Node.TEXT_NODE) {
        const t = no.nodeValue || '';
        if (TEM_NOME.test(t)) no.nodeValue = trocaNome(t);
        return;
    }
    if (no.nodeType !== Node.ELEMENT_NODE) return;
    const el = no as Element;
    if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return;
    for (const a of ATRIBUTOS) { const v = el.getAttribute(a); if (v && TEM_NOME.test(v)) el.setAttribute(a, trocaNome(v)); }
    el.childNodes.forEach(trocar);
}

if (nome) {
    const ajustarTitulo = () => { if (TEM_NOME.test(document.title)) document.title = trocaNome(document.title); };
    const obs = new MutationObserver((muts) => {
        for (const m of muts) {
            if (m.type === 'characterData') trocar(m.target);
            else if (m.type === 'attributes') trocar(m.target);
            else m.addedNodes.forEach(trocar);
        }
        ajustarTitulo();
    });
    const iniciar = () => { trocar(document.body); ajustarTitulo(); obs.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATRIBUTOS }); };
    if (document.body) iniciar(); else document.addEventListener('DOMContentLoaded', iniciar);
}
