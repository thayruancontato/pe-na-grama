// Versão "sem-firebase": o Worker injeta window.__MARCA__ = { nome } (a escola do subdomínio).
// Aqui o nome antigo do sistema ("Rumo ao Esporte...") é trocado pelo da escola em tudo o que aparece na tela.
const NOME_ANTIGO = /Rumo ao Esporte( e ao Lazer\s*[-–]\s*REAL)?( 2026)?/gi;
const trocaNome = (t: string) => trocaCampos(t.replace(NOME_ANTIGO, (x) => (x === x.toUpperCase() ? nome!.toUpperCase() : nome!)));
const TEM_NOME = { test: (t: string) => /rumo ao esporte/i.test(t) || (!!marca?.perfil && TEM_CAMPO.test(t)) };
const marca = (window as unknown as { __MARCA__?: { nome: string; perfil?: Record<string, string> } }).__MARCA__;
const nome = marca?.nome;
// Dados da escola (página "Dados da escola"): os campos entre colchetes do contrato, dos termos e dos recibos viram o valor preenchido; vazio mantém o campo.
const CAMPOS: [string, string][] = [['[CNPJ DA ESCOLA]', 'cnpj'], ['[ENDEREÇO DA ESCOLA]', 'endereco'], ['[CEP DA ESCOLA]', 'cep'], ['[E-MAIL DA ESCOLA]', 'email'], ['[TELEFONE DA ESCOLA]', 'telefone'], ['[CIDADE/UF]', 'foro']];
const TEM_CAMPO = /\[(?:CNPJ DA ESCOLA|ENDEREÇO DA ESCOLA|CEP DA ESCOLA|E-MAIL DA ESCOLA|TELEFONE DA ESCOLA|CIDADE\/UF)\]/;
const trocaCampos = (t: string) => CAMPOS.reduce((s, [campo, k]) => (marca?.perfil?.[k] ? s.split(campo).join(marca.perfil[k]) : s), t);
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
