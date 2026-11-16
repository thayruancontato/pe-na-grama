// Aba "Criativos" da Central: catálogo de modelos de carteirinha e de post de aniversário + editor visual.
// Os modelos são dados (camadas) desenhados por ../artes/motor.js, o mesmo motor que o sistema da escola usa.
import { FONTES, PALETA_PADRAO, VARIAVEIS, caixaDe, carregaFontes, contextoCores, cor, desenha, imagem, renderiza } from '../artes/motor.js';
import { catalogoPadrao } from '../artes/modelos.js';

const clone = (x) => JSON.parse(JSON.stringify(x));
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
let app, cat, personalizado = false, aba = 'carteirinha', paletaId = 'padrao', rec = {}, fontesOk = null;

const PALETAS = {
    padrao: { nome: 'Pé na Grama (padrão)', cores: { ...PALETA_PADRAO } },
    vermelha: { nome: 'Escola vermelha', cores: { primaria: '#b62026', secundaria: '#7a1218', escura: '#2a0a0c', destaque: '#f4c20d' } },
    laranja: { nome: 'Escola laranja e preto', cores: { primaria: '#d15b05', secundaria: '#8a3d02', escura: '#111111', destaque: '#f4c20d' } },
    roxa: { nome: 'Escola roxa', cores: { primaria: '#7a3fd1', secundaria: '#4b2a99', escura: '#1d1040', destaque: '#ffc61a' } },
    clara: { nome: 'Escola de cores claras', cores: { primaria: '#2eb872', secundaria: '#7fc4e8', escura: '#2a6b8a', destaque: '#ffd23f' } },
    preta: { nome: 'Preto e dourado', cores: { primaria: '#000000', secundaria: '#3a3a3a', escura: '#000000', destaque: '#d4a72c' } }
};
const DADOS = {
    completo: { nome: 'Pedro Henrique Souza Lima', cpf: '123.456.789-00', dataNascimento: '12/05/2014', numeroCota: '0042', modalidade: 'Futebol', idade: 12, turma: 'Sub 12 · Manhã', escola: 'Escola de Futebol Craques do Vale', responsavel: { nome: 'Juliana Alves Bianchi Souza', cpf: '855.775.115-00', telefonePrincipal: '(33) 99848-0019', email: 'juliana.alves@exemplo.com.br', endereco: { rua: 'Rua das Palmeiras', numero: '120', bairro: 'Centro', cidade: 'Manhuaçu', estado: 'MG' } } },
    longo: { nome: 'Maria Eduarda Albuquerque de Vasconcelos Figueiredo da Rocha', cpf: '123.456.789-00', dataNascimento: '03/11/2012', numeroCota: '1.204', modalidade: 'Futebol, Vôlei e Natação', idade: 14, escola: 'Associação Atlética Banco do Brasil de Manhuaçu — Escolinha de Esportes', responsavel: { nome: 'José Carlos de Albuquerque Vasconcelos Figueiredo', cpf: '855.775.115-00', telefonePrincipal: '(33) 99848-0019', email: 'jose.carlos.vasconcelos.figueiredo@exemplo.com.br', endereco: { rua: 'Avenida Governador Valadares', numero: '1.250, apto 302', bairro: 'Bom Jardim', cidade: 'Manhuaçu', estado: 'MG' } } },
    semidade: { nome: 'Ana Luiza Gomes', cpf: '-', dataNascimento: '-', escola: 'Escolinha Craques do Vale', responsavel: { nome: 'Wesley Gomes Rodrigues' } }
};
const TIPO_NOME = { ret: 'Retângulo', elipse: 'Elipse', poli: 'Polígono', linha: 'Linha', texto: 'Texto', foto: 'Foto do aluno', logo: 'Logo da escola', qr: 'QR Code', grao: 'Grão', meiotom: 'Meio-tom', guilloche: 'Guilloché', listras: 'Listras', confete: 'Confete', arcos: 'Arcos', campo: 'Campo', foil: 'Faixa metálica', balao: 'Balão' };
const GLIFO = { ret: '▭', elipse: '◯', poli: '△', linha: '╱', texto: 'T', foto: '▣', logo: '◈', qr: '▦', grao: '░', meiotom: '⁘', guilloche: '≈', listras: '☰', confete: '✦', arcos: '◎', campo: '▢', foil: '═', balao: '⬭' };
const COND = [['', 'Sempre aparece'], ['logo', 'Só se a escola tem logo'], ['foto', 'Só se o aluno tem foto'], ['semfoto', 'Só se o aluno não tem foto'], ['idade', 'Só se a idade é conhecida']];

// ---------------- carga ----------------
async function carrega() {
    const r = await app.api('criativos');
    personalizado = Boolean(r.catalogo);
    cat = r.catalogo || catalogoPadrao();
    if (!fontesOk) fontesOk = carregaFontes('/assets/fonts/');
    await fontesOk;
    rec.logoBase = rec.logoBase || await imagem('/assets/logo-600.png');
    rec.fotoBase = rec.fotoBase || await imagem('/assets/criancas.webp');
}
async function salva(msg = 'Modelos salvos. Já valem para todas as escolas.') {
    await app.api('criativos', { m: 'PUT', b: { catalogo: cat } });
    personalizado = true; if (msg) app.toast(msg);
}
const temaDe = (tipo, id) => cat.temas[tipo].find((t) => t.id === id) || cat.temas[tipo][0];
const idUnico = (lista, base) => { let id = String(base || 'modelo').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 18) || 'modelo', n = 1; const livre = (x) => !lista.some((m) => m.id === x); if (livre(id)) return id; while (!livre(id + n)) n++; return id + n; };

// ---------------- página: galeria ----------------
export async function pagina(pg, a) {
    app = a;
    pg.innerHTML = '<div class="pg-empty">Carregando…</div>';
    await carrega();
    const temaCard = {}, ladoCard = {};
    const desenhaCard = (m, cv) => {
        const tema = temaDe(m.tipo, temaCard[m.id] || (m.temas && m.temas[0])), lado = ladoCard[m.id] || 'frente';
        const novo = renderiza(m, DADOS.completo, { paleta: PALETAS[paletaId].cores, tema, lado, recursos: { logo: rec.logoBase, foto: rec.fotoBase } });
        cv.width = novo.width; cv.height = novo.height; cv.getContext('2d').drawImage(novo, 0, 0);
    };
    const tela = () => {
        const lista = cat[aba], carte = aba === 'carteirinha';
        pg.innerHTML = a.cabeca('Criativos', 'Modelos de carteirinha e de post de aniversário que as escolas podem escolher. Edite, crie e ligue ou desligue cada um.',
            `<button class="pg-btn" id="crTemas">Temas de cor</button><button class="pg-btn" id="crPadrao">Restaurar padrão</button><button class="pg-btn green" id="crNovo">${a.I('plus')} Novo modelo</button>`) +
            `<div class="cf-tabs" role="tablist"><button class="cf-tab ${carte ? 'on' : ''}" data-aba="carteirinha">Carteirinhas <span class="pg-badge">${cat.carteirinha.length}</span></button><button class="cf-tab ${!carte ? 'on' : ''}" data-aba="aniversario">Posts de aniversário <span class="pg-badge">${cat.aniversario.length}</span></button></div>
            <div class="cr-barra"><label>Visualizar com as cores de <select class="pg-select" id="crPaleta">${Object.entries(PALETAS).map(([k, v]) => `<option value="${k}" ${k === paletaId ? 'selected' : ''}>${a.E(v.nome)}</option>`).join('')}</select></label>
              <span class="cr-nota">${personalizado ? 'Catálogo personalizado: o que você salva vale para todas as escolas.' : 'Usando os modelos padrão do sistema. Ao salvar uma alteração, o catálogo passa a ser o seu.'}</span></div>
            <div class="cr-grade ${carte ? 'cart' : 'aniv'}">${lista.map((m, i) => `<article class="cr-card ${m.ativo === false ? 'off' : ''}" data-i="${i}">
              <div class="cr-prev"><canvas></canvas></div>
              <div class="cr-info"><b>${a.E(m.nome)}</b><small>${(m.temas || []).length} temas · ${m.w}×${m.h}</small></div>
              <div class="cr-linha"><select class="pg-select" data-tema aria-label="Tema da visualização">${cat.temas[aba].filter((t) => (m.temas || []).includes(t.id)).map((t) => `<option value="${t.id}">${a.E(t.nome)}</option>`).join('')}</select>${carte ? '<select class="pg-select" data-lado aria-label="Lado"><option value="frente">Frente</option><option value="verso">Verso</option></select>' : ''}</div>
              <div class="cr-ac"><button class="pg-btn green" data-ac="editar">Editar</button><button class="pg-btn detail" data-ac="dup">Duplicar</button><button class="pg-btn detail" data-ac="ativo">${m.ativo === false ? 'Ativar' : 'Desativar'}</button><button class="pg-btn detail cr-del" data-ac="excluir">Excluir</button></div></article>`).join('')}</div>`;
        $$('.cr-card', pg).forEach((el) => desenhaCard(lista[+el.dataset.i], $('canvas', el)));
        $$('[data-aba]', pg).forEach((b) => (b.onclick = () => { aba = b.dataset.aba; tela(); }));
        $('#crPaleta', pg).onchange = (e) => { paletaId = e.target.value; $$('.cr-card', pg).forEach((el) => desenhaCard(lista[+el.dataset.i], $('canvas', el))); };
        $('#crTemas', pg).onclick = () => editorTemas(tela);
        $('#crPadrao', pg).onclick = async () => {
            if (!(await a.confirma('Restaurar os modelos padrão?', 'Todos os modelos e temas voltam ao que veio com o sistema. O que você editou aqui se perde.', 'Restaurar', true))) return;
            try { await a.api('criativos', { m: 'DELETE', b: {} }); cat = catalogoPadrao(); personalizado = false; a.toast('Modelos padrão restaurados'); tela(); } catch (e) { a.falha(e); }
        };
        $('#crNovo', pg).onclick = () => { const m = novoModelo(aba); cat[aba].push(m); abreEditor(m, tela, true); };
        $$('.cr-card', pg).forEach((el) => {
            const m = lista[+el.dataset.i];
            $('[data-tema]', el).onchange = (e) => { temaCard[m.id] = e.target.value; desenhaCard(m, $('canvas', el)); };
            const sl = $('[data-lado]', el); if (sl) sl.onchange = (e) => { ladoCard[m.id] = e.target.value; desenhaCard(m, $('canvas', el)); };
            $('canvas', el).onclick = () => abreEditor(m, tela);
            $$('[data-ac]', el).forEach((b) => (b.onclick = async () => {
                const ac = b.dataset.ac;
                try {
                    if (ac === 'editar') return abreEditor(m, tela);
                    if (ac === 'dup') { const c = clone(m); c.id = idUnico(lista, m.id + 'copia'); c.nome = m.nome + ' (cópia)'; lista.splice(+el.dataset.i + 1, 0, c); await salva('Modelo duplicado'); return tela(); }
                    if (ac === 'ativo') { m.ativo = m.ativo === false; await salva(m.ativo ? 'Modelo ativado: as escolas já podem usar.' : 'Modelo desativado: as escolas deixam de ver.'); return tela(); }
                    if (ac === 'excluir') { if (lista.length <= 1) return a.toast('Mantenha pelo menos um modelo.', 'err'); if (!(await a.confirma('Excluir o modelo "' + m.nome + '"?', 'Escolas que usam este modelo passam para outro automaticamente. Não dá para desfazer.', 'Excluir', true))) return; lista.splice(+el.dataset.i, 1); await salva('Modelo excluído'); tela(); }
                } catch (e) { a.falha(e); }
            }));
        });
    };
    tela();
}

function novoModelo(tipo) {
    const carte = tipo === 'carteirinha', w = carte ? 1012 : 1080, h = carte ? 638 : 1350, fundo = { t: 'ret', nome: 'Fundo', x: 0, y: 0, w, h, fill: carte ? '$fundo' : { tipo: 'd1', c: ['$fundo', '$fundo2'] } };
    const base = { id: idUnico(cat[tipo], 'novo'), nome: 'Novo modelo', tipo, w, h, ativo: true, temas: cat.temas[tipo].map((t) => t.id) };
    return carte ? { ...base, lados: { frente: [fundo, { t: 'foto', nome: 'Foto', x: 40, y: 200, w: 240, h: 300, raio: 20 }, { t: 'texto', nome: 'Nome', txt: '{nomeCurto}', x: 320, y: 220, w: 640, tam: 48, cor: '$texto', peso: 900 }], verso: [clone(fundo)] } }
        : { ...base, camadas: [fundo, { t: 'foto', nome: 'Foto', x: 140, y: 380, w: 800, h: 640, raio: 30 }, { t: 'texto', nome: 'Nome', txt: '{primeiroNome}', x: 60, y: 1080, w: 960, tam: 120, cor: '$texto', peso: 900, al: 'center' }] };
}

// ---------------- editor de temas ----------------
function editorTemas(volta) {
    let tipo = aba, idx = 0;
    const back = document.createElement('div'); back.className = 'pg-modal-back'; document.body.appendChild(back);
    const fecha = () => { back.remove(); volta(); };
    const desenhar = () => {
        const lista = cat.temas[tipo], t = lista[Math.min(idx, lista.length - 1)], ctx = contextoCores(PALETAS[paletaId].cores, t), E = app.E;
        back.innerHTML = `<div class="pg-modal wide cr-temas" role="dialog" aria-label="Temas de cor"><div class="pg-modal-head"><div class="pg-card-title">Temas de cor</div><button class="pg-x" aria-label="Fechar">${app.I('x')}</button></div><div class="mbody">
          <p class="pg-sub">Um tema é um conjunto de cores (como <code>$fundo</code>, <code>$acento</code>) que os modelos usam. Cada valor pode ser uma cor (#00a63a), uma cor da escola (<code>@primaria</code>, <code>@secundaria</code>, <code>@escura</code>, <code>@destaque</code>), outro item do tema (<code>$forte</code>) ou uma conta: <code>mix(a,b,0.3)</code>, <code>alfa(a,0.5)</code>, <code>escurece(a,0.3)</code>, <code>clareia(a,0.3)</code>, <code>sobre(a)</code> (branco ou escuro, o que ler melhor), <code>acento(a)</code>, <code>marca(a)</code>, <code>legivel(a,fundo)</code>.</p>
          <div class="cr-tt"><select class="pg-select" id="ttTipo"><option value="carteirinha" ${tipo === 'carteirinha' ? 'selected' : ''}>Carteirinha</option><option value="aniversario" ${tipo === 'aniversario' ? 'selected' : ''}>Aniversário</option></select>
            <select class="pg-select" id="ttTema">${lista.map((x, i) => `<option value="${i}" ${x === t ? 'selected' : ''}>${E(x.nome)}</option>`).join('')}</select>
            <button class="pg-btn detail" id="ttNovo">Novo tema (cópia deste)</button><button class="pg-btn detail cr-del" id="ttDel">Excluir tema</button></div>
          <div class="pg-field"><label class="pg-label" for="ttNome">Nome do tema</label><input class="pg-input" id="ttNome" value="${E(t.nome)}"></div>
          <div class="cr-tokens">${Object.entries(t.tokens).map(([k, v]) => `<div class="cr-tok"><code>$${k}</code><input class="pg-input" data-tok="${k}" value="${E(v)}" aria-label="Valor de ${k}"><span class="cr-sw" style="background:${E(cor('$' + k, ctx))}" title="${E(cor('$' + k, ctx))}"></span><button class="pg-btn detail" data-rm="${k}" aria-label="Remover ${k}">×</button></div>`).join('')}</div>
          <div class="cr-tok"><input class="pg-input" id="ttK" placeholder="novo item (ex.: faixa)" style="max-width:200px"><button class="pg-btn detail" id="ttAdd">Adicionar item</button></div>
          <div class="cr-ttprev">${['fundo', 'fundo2', 'forte', 'forte2', 'texto', 'suave', 'acento', 'marca'].filter((k) => t.tokens[k]).map((k) => `<span><i style="background:${E(cor('$' + k, ctx))}"></i>${k}</span>`).join('')}</div>
          <div class="pg-actions" style="justify-content:flex-end;margin-top:16px"><button class="pg-btn" id="ttFim">Fechar</button><button class="pg-btn green" id="ttSalva">Salvar temas</button></div></div></div>`;
        $('.pg-x', back).onclick = fecha; $('#ttFim', back).onclick = fecha;
        $('#ttTipo', back).onchange = (e) => { tipo = e.target.value; idx = 0; desenhar(); };
        $('#ttTema', back).onchange = (e) => { idx = +e.target.value; desenhar(); };
        $('#ttNome', back).oninput = (e) => { t.nome = e.target.value; };
        $$('[data-tok]', back).forEach((i) => (i.onchange = () => { t.tokens[i.dataset.tok] = i.value; desenhar(); }));
        $$('[data-rm]', back).forEach((b) => (b.onclick = () => { delete t.tokens[b.dataset.rm]; desenhar(); }));
        $('#ttAdd', back).onclick = () => { const k = $('#ttK', back).value.trim().replace(/[^a-zA-Z0-9]/g, '').slice(0, 20); if (k) { t.tokens[k] = t.tokens[k] || '#888888'; desenhar(); } };
        $('#ttNovo', back).onclick = () => { const c = clone(t); c.id = idUnico(lista, t.id + 'copia'); c.nome = t.nome + ' (cópia)'; lista.push(c); idx = lista.length - 1; desenhar(); };
        $('#ttDel', back).onclick = () => { if (lista.length <= 1) return app.toast('Mantenha pelo menos um tema.', 'err'); lista.splice(idx, 1); cat[tipo].forEach((m) => (m.temas = (m.temas || []).filter((x) => x !== t.id))); idx = 0; desenhar(); };
        $('#ttSalva', back).onclick = async () => { try { await salva('Temas salvos'); } catch (e) { app.falha(e); } };
    };
    desenhar();
}

// ---------------- editor visual ----------------
const MAX_HIST = 120;
function abreEditor(modelo, aoFechar, novo = false) {
    const tipo = modelo.tipo, carte = tipo === 'carteirinha';
    let M = clone(modelo), lado = 'frente', sel = -1, zoom = 0.5, dirty = false, jaSalvo = !novo, mostraCaixas = true, snapOn = true, temaId = (M.temas && M.temas[0]) || cat.temas[tipo][0].id, dadosId = 'completo', pal = paletaId, painel = 'prop';
    const hist = [], fut = []; let ultimaChave = '', ultimoT = 0, guias = [], clip = null, fotoEx = rec.fotoBase, logoEx = rec.logoBase, qrFoto = true;
    const camadas = () => (M.lados ? M.lados[lado] : M.camadas);
    const E = app.E;

    const root = document.createElement('div'); root.className = 'ed'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Editor de modelo');
    root.innerHTML = `<header class="ed-top"><button class="pg-btn" data-a="sair">‹ Voltar</button><input class="pg-input ed-nome" id="edNome" aria-label="Nome do modelo" value="${E(M.nome)}">
      <div class="ed-grupo"><button class="pg-btn detail" data-a="desfaz" title="Desfazer (Ctrl+Z)">Desfazer</button><button class="pg-btn detail" data-a="refaz" title="Refazer (Ctrl+Y)">Refazer</button></div>
      ${carte ? `<div class="ed-grupo ed-lados"><button class="pg-btn detail on" data-lado="frente">Frente</button><button class="pg-btn detail" data-lado="verso">Verso</button></div>` : ''}
      <div class="ed-grupo"><button class="pg-btn detail" data-a="zmenos" aria-label="Diminuir">−</button><button class="pg-btn detail" data-a="zfit" id="edZ">Ajustar</button><button class="pg-btn detail" data-a="zmais" aria-label="Aumentar">+</button></div>
      <div class="ed-grupo"><label class="ed-chk"><input type="checkbox" id="edSnap" checked> Imã</label><label class="ed-chk"><input type="checkbox" id="edCx" checked> Contornos</label></div>
      <span class="ed-flex"></span><span class="ed-aviso" id="edAviso"></span>
      <button class="pg-btn" data-a="salvar">Salvar</button><button class="pg-btn green" data-a="salvarsair">Salvar e fechar</button></header>
      <div class="ed-bar2"><label>Tema <select class="pg-select" id="edTema">${cat.temas[tipo].map((t) => `<option value="${t.id}" ${t.id === temaId ? 'selected' : ''}>${E(t.nome)}</option>`).join('')}</select></label>
        <label>Cores da escola <select class="pg-select" id="edPal">${Object.entries(PALETAS).map(([k, v]) => `<option value="${k}" ${k === pal ? 'selected' : ''}>${E(v.nome)}</option>`).join('')}</select></label>
        <label>Dados <select class="pg-select" id="edDados"><option value="completo">Aluno completo</option><option value="longo">Nomes muito longos</option><option value="semidade">Sem idade e sem dados</option><option value="semfoto">Sem foto</option><option value="semlogo">Escola sem logo</option></select></label>
        <label class="pg-btn detail ed-up">Foto de exemplo<input type="file" accept="image/*" id="edFoto" hidden></label><label class="pg-btn detail ed-up">Logo de exemplo<input type="file" accept="image/*" id="edLogo" hidden></label>
        <span class="ed-alinha"><button class="pg-btn detail" data-al="esq" title="Alinhar à esquerda da arte">⇤</button><button class="pg-btn detail" data-al="cx" title="Centralizar na horizontal">⇔</button><button class="pg-btn detail" data-al="dir" title="Alinhar à direita da arte">⇥</button><button class="pg-btn detail" data-al="topo" title="Alinhar ao topo">⤒</button><button class="pg-btn detail" data-al="cy" title="Centralizar na vertical">⇕</button><button class="pg-btn detail" data-al="base" title="Alinhar à base">⤓</button></span></div>
      <div class="ed-corpo"><aside class="ed-esq"><div class="ed-tit">Camadas <span><select class="pg-select" id="edAdd" aria-label="Adicionar camada"><option value="">+ Adicionar…</option>${Object.entries(TIPO_NOME).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}<option value="@selo">Selo de idade</option><option value="@faixa">Faixa com texto</option></select></span></div><div class="ed-camadas" id="edLista"></div></aside>
        <main class="ed-palco" id="edPalco"><div class="ed-tela" id="edTela"><canvas id="edCv"></canvas><div class="ed-ov" id="edOv"></div></div></main>
        <aside class="ed-dir"><div class="ed-abas"><button class="on" data-painel="prop">Propriedades</button><button data-painel="modelo">Modelo</button><button data-painel="vars">Variáveis</button></div><div class="ed-prop" id="edProp"></div></aside></div>`;
    document.body.appendChild(root); document.body.style.overflow = 'hidden';
    const cv = $('#edCv', root), g = cv.getContext('2d'), ov = $('#edOv', root), palco = $('#edPalco', root), telaEl = $('#edTela', root);

    // ---- recursos de exemplo ----
    const recursos = () => ({ foto: dadosId === 'semfoto' ? null : fotoEx, logo: dadosId === 'semlogo' ? null : logoEx });
    const dados = () => DADOS[dadosId === 'semfoto' || dadosId === 'semlogo' ? 'completo' : dadosId];
    // ---- desenho ----
    let pend = 0;
    const redesenha = () => { if (pend) return; pend = requestAnimationFrame(() => { pend = 0; pinta(); }); };
    function pinta() {
        cv.width = M.w; cv.height = M.h; g.clearRect(0, 0, M.w, M.h);
        const ctx = contextoCores(PALETAS[pal].cores, temaDe(tipo, temaId));
        desenha(g, camadas(), ctx, recursos(), dados(), M.w, M.h);
        const px = M.w * zoom; cv.style.width = px + 'px'; cv.style.height = M.h * zoom + 'px'; telaEl.style.width = px + 'px'; telaEl.style.height = M.h * zoom + 'px';
        $('#edZ', root).textContent = Math.round(zoom * 100) + '%';
        overlay();
    }
    function ajusta() { const r = palco.getBoundingClientRect(); zoom = Math.max(0.1, Math.min((r.width - 48) / M.w, (r.height - 48) / M.h, 2)); pinta(); }

    // ---- histórico ----
    const snap = () => JSON.stringify({ M, lado });
    function marca(chave = '') { // guarda o estado anterior; mudanças seguidas de mesma chave (digitação) viram um passo só
        const agora = Date.now(); if (chave && chave === ultimaChave && agora - ultimoT < 900) { ultimoT = agora; dirty = true; aviso(); return; }
        hist.push(snap()); if (hist.length > MAX_HIST) hist.shift(); fut.length = 0; ultimaChave = chave; ultimoT = agora; dirty = true; aviso();
    }
    const restaura = (s) => { const o = JSON.parse(s); M = o.M; lado = o.lado; sel = Math.min(sel, camadas().length - 1); $$('[data-lado]', root).forEach((b) => b.classList.toggle('on', b.dataset.lado === lado)); lista(); props(); redesenha(); };
    const desfaz = () => { if (!hist.length) return; fut.push(snap()); restaura(hist.pop()); dirty = true; aviso(); };
    const refaz = () => { if (!fut.length) return; hist.push(snap()); restaura(fut.pop()); dirty = true; aviso(); };
    const aviso = () => { $('#edAviso', root).textContent = dirty ? 'Alterações não salvas' : 'Salvo'; };
    aviso();

    // ---- camadas: lista ----
    function lista() {
        const L = camadas();
        $('#edLista', root).innerHTML = [...L].map((l, i) => i).reverse().map((i) => { const l = L[i]; return `<div class="ed-cam ${i === sel ? 'on' : ''} ${l.oculto ? 'oc' : ''}" draggable="true" data-i="${i}"><span class="ed-gl">${GLIFO[l.t] || '?'}</span><span class="ed-cn" data-ren="${i}">${E(l.nome || TIPO_NOME[l.t])}</span><button data-vis="${i}" title="${l.oculto ? 'Mostrar' : 'Ocultar'}">${l.oculto ? '◌' : '◉'}</button><button data-trv="${i}" title="${l.travado ? 'Destravar' : 'Travar'}">${l.travado ? '▪' : '▫'}</button></div>`; }).join('') || '<div class="pg-hint" style="padding:12px">Sem camadas. Use "Adicionar".</div>';
        $$('.ed-cam', root).forEach((el) => {
            const i = +el.dataset.i;
            el.onclick = (e) => { if (e.target.closest('button')) return; seleciona(i); };
            el.ondragstart = (e) => { e.dataTransfer.setData('text/plain', String(i)); e.dataTransfer.effectAllowed = 'move'; };
            el.ondragover = (e) => { e.preventDefault(); el.classList.add('alvo'); }; el.ondragleave = () => el.classList.remove('alvo');
            el.ondrop = (e) => { e.preventDefault(); el.classList.remove('alvo'); const de = +e.dataTransfer.getData('text/plain'); if (de !== i) move(de, i); };
        });
        $$('[data-vis]', root).forEach((b) => (b.onclick = () => { marca(); L[+b.dataset.vis].oculto = !L[+b.dataset.vis].oculto; lista(); redesenha(); }));
        $$('[data-trv]', root).forEach((b) => (b.onclick = () => { marca(); L[+b.dataset.trv].travado = !L[+b.dataset.trv].travado; lista(); }));
        $$('[data-ren]', root).forEach((s) => (s.ondblclick = () => { const i = +s.dataset.ren, inp = document.createElement('input'); inp.className = 'pg-input'; inp.value = L[i].nome || ''; s.replaceWith(inp); inp.focus(); inp.select(); const ok = () => { marca(); L[i].nome = inp.value.trim() || TIPO_NOME[L[i].t]; lista(); props(); }; inp.onblur = ok; inp.onkeydown = (e) => { if (e.key === 'Enter') inp.blur(); }; }));
    }
    function move(de, para) { marca(); const L = camadas(), [x] = L.splice(de, 1); L.splice(para, 0, x); sel = para; lista(); redesenha(); props(); }
    function seleciona(i) { sel = i; painel = 'prop'; $$('.ed-abas button', root).forEach((x) => x.classList.toggle('on', x.dataset.painel === 'prop')); lista(); props(); overlay(); }

    // ---- sobreposição (caixa de seleção, alças, guias) ----
    function overlay() {
        const L = camadas(), l = L[sel]; let h = '';
        if (mostraCaixas) L.forEach((o, i) => { if (o.oculto || i === sel) return; const b = caixaDe(o); if (!b.w && !b.h) return; h += `<div class="ed-bx" style="${estiloCaixa(o, b)}"></div>`; });
        if (l && !l.oculto) {
            const b = caixaDe(l);
            if (b.w || b.h) h += `<div class="ed-bx sel" style="${estiloCaixa(l, b)}"></div>`;
            if (!l.travado) {
                if (l.t === 'poli') (l.pts || []).forEach((p, k) => (h += `<i class="ed-al v" data-v="${k}" style="left:${p[0] * zoom}px;top:${p[1] * zoom}px"></i>`));
                else if (l.t === 'linha') h += `<i class="ed-al v" data-v="0" style="left:${l.x * zoom}px;top:${l.y * zoom}px"></i><i class="ed-al v" data-v="1" style="left:${l.x2 * zoom}px;top:${l.y2 * zoom}px"></i>`;
                else if (l.t !== 'grao') {
                    const pts = { nw: [0, 0], n: [0.5, 0], ne: [1, 0], e: [1, 0.5], se: [1, 1], s: [0.5, 1], sw: [0, 1], w: [0, 0.5] };
                    const c = pivoDe(l, b), ang = ((l.rot || 0) * Math.PI) / 180;
                    const rot = (x, y) => { const dx = x - c[0], dy = y - c[1]; return [c[0] + dx * Math.cos(ang) - dy * Math.sin(ang), c[1] + dx * Math.sin(ang) + dy * Math.cos(ang)]; };
                    for (const [k, [fx, fy]] of Object.entries(pts)) { const p = rot(b.x + b.w * fx, b.y + b.h * fy); h += `<i class="ed-al ${k}" data-al="${k}" style="left:${p[0] * zoom}px;top:${p[1] * zoom}px"></i>`; }
                    const rp = rot(b.x + b.w / 2, b.y - 36 / zoom); h += `<i class="ed-al rot" data-al="rot" style="left:${rp[0] * zoom}px;top:${rp[1] * zoom}px" title="Girar"></i>`;
                }
            }
        }
        guias.forEach((gd) => (h += gd.x != null ? `<div class="ed-gd v" style="left:${gd.x * zoom}px"></div>` : `<div class="ed-gd h" style="top:${gd.y * zoom}px"></div>`));
        ov.innerHTML = h;
    }
    const pivoDe = (l, b) => (l.pivo ? [l.pivo[0], l.pivo[1]] : [b.x + b.w / 2, b.y + b.h / 2]);
    function estiloCaixa(l, b) { const c = pivoDe(l, b); return `left:${b.x * zoom}px;top:${b.y * zoom}px;width:${b.w * zoom}px;height:${b.h * zoom}px;${l.rot ? `transform:rotate(${l.rot}deg);transform-origin:${(c[0] - b.x) * zoom}px ${(c[1] - b.y) * zoom}px;` : ''}`; }

    // ---- interação no palco ----
    const ponto = (e) => { const r = telaEl.getBoundingClientRect(); return [(e.clientX - r.left) / zoom, (e.clientY - r.top) / zoom]; };
    function acha(x, y) {
        const L = camadas();
        for (let i = L.length - 1; i >= 0; i--) {
            const l = L[i]; if (l.oculto || l.travado || l.t === 'grao') continue; const b = caixaDe(l); if (!b.w && !b.h) continue;
            let px = x, py = y; if (l.rot) { const c = pivoDe(l, b), a = (-l.rot * Math.PI) / 180, dx = x - c[0], dy = y - c[1]; px = c[0] + dx * Math.cos(a) - dy * Math.sin(a); py = c[1] + dx * Math.sin(a) + dy * Math.cos(a); }
            const m = l.t === 'linha' ? 14 / zoom : 0; if (px >= b.x - m && px <= b.x + b.w + m && py >= b.y - m && py <= b.y + b.h + m) return i;
        }
        return -1;
    }
    function candidatosSnap(exceto) { const xs = [0, M.w / 2, M.w], ys = [0, M.h / 2, M.h]; camadas().forEach((l, i) => { if (i === exceto || l.oculto || l.t === 'grao') return; const b = caixaDe(l); if (!b.w && !b.h) return; xs.push(b.x, b.x + b.w / 2, b.x + b.w); ys.push(b.y, b.y + b.h / 2, b.y + b.h); }); return { xs, ys }; }
    function imaDe(valores, cands, lim) { let melhor = null; for (const v of valores) for (const c of cands) { const d = c - v; if (Math.abs(d) <= lim && (melhor == null || Math.abs(d) < Math.abs(melhor.d))) melhor = { d, c }; } return melhor; }

    let arrasto = null;
    ov.addEventListener('pointerdown', (e) => {
        e.preventDefault(); ov.setPointerCapture(e.pointerId); const [x, y] = ponto(e), L = camadas(), alvo = e.target.closest('[data-al]'), vert = e.target.closest('[data-v]');
        if (vert && sel >= 0) { marca(); arrasto = { tipo: 'vert', k: +vert.dataset.v }; return; }
        if (alvo && sel >= 0) { marca(); const l = L[sel], b = clone(caixaDe(l)); arrasto = { tipo: alvo.dataset.al === 'rot' ? 'rot' : 'res', lado: alvo.dataset.al, ini: clone(l), b, x, y, shift: e.shiftKey }; return; }
        const i = acha(x, y); if (i !== sel) seleciona(i);
        if (i >= 0) { marca(); arrasto = { tipo: 'mov', ini: clone(L[i]), x, y, b: caixaDe(L[i]) }; }
    });
    ov.addEventListener('pointermove', (e) => {
        if (!arrasto) return; const [x, y] = ponto(e), L = camadas(), l = L[sel]; if (!l) return; const dx = x - arrasto.x, dy = y - arrasto.y, ini = arrasto.ini; guias = [];
        if (arrasto.tipo === 'mov') {
            let mx = dx, my = dy;
            if (snapOn && !e.altKey) { const b = arrasto.b, { xs, ys } = candidatosSnap(sel), lim = 8 / zoom, sx = imaDe([b.x + dx, b.x + dx + b.w / 2, b.x + dx + b.w], xs, lim), sy = imaDe([b.y + dy, b.y + dy + b.h / 2, b.y + dy + b.h], ys, lim); if (sx) { mx += sx.d; guias.push({ x: sx.c }); } if (sy) { my += sy.d; guias.push({ y: sy.c }); } }
            deslocar(l, ini, Math.round(mx), Math.round(my));
        } else if (arrasto.tipo === 'vert') {
            if (l.t === 'poli') l.pts[arrasto.k] = [Math.round(x), Math.round(y)]; else if (arrasto.k === 0) { l.x = Math.round(x); l.y = Math.round(y); } else { l.x2 = Math.round(x); l.y2 = Math.round(y); }
        } else if (arrasto.tipo === 'rot') {
            const b = arrasto.b, c = pivoDe(ini, b); let a = (Math.atan2(y - c[1], x - c[0]) * 180) / Math.PI + 90; if (e.shiftKey) a = Math.round(a / 15) * 15; l.rot = Math.round(((a % 360) + 360) % 360 * 10) / 10; if (l.rot > 180) l.rot -= 360;
        } else redimensiona(l, ini, arrasto, x, y, e.shiftKey);
        redesenha(); props(true);
    });
    const fimArrasto = () => { arrasto = null; guias = []; overlay(); lista(); props(); };
    ov.addEventListener('pointerup', fimArrasto); ov.addEventListener('pointercancel', fimArrasto);
    function deslocar(l, ini, dx, dy) {
        if (l.t === 'poli') l.pts = ini.pts.map((p) => [p[0] + dx, p[1] + dy]);
        else if (l.t === 'linha') { l.x = ini.x + dx; l.y = ini.y + dy; l.x2 = ini.x2 + dx; l.y2 = ini.y2 + dy; }
        else { l.x = ini.x + dx; l.y = ini.y + dy; if (ini.pivo) l.pivo = [ini.pivo[0] + dx, ini.pivo[1] + dy]; }
    }
    function redimensiona(l, ini, a, x, y, shift) {
        // gira o ponteiro de volta para o eixo da camada, para redimensionar camadas inclinadas
        const b0 = a.b, c = pivoDe(ini, b0); let px = x, py = y, ax = a.x, ay = a.y;
        if (ini.rot) { const ang = (-ini.rot * Math.PI) / 180, g2 = (X, Y) => [c[0] + (X - c[0]) * Math.cos(ang) - (Y - c[1]) * Math.sin(ang), c[1] + (X - c[0]) * Math.sin(ang) + (Y - c[1]) * Math.cos(ang)]; [px, py] = g2(x, y); [ax, ay] = g2(a.x, a.y); }
        const dx = px - ax, dy = py - ay, s = a.lado; let nx = b0.x, ny = b0.y, nw = b0.w, nh = b0.h;
        if (s.includes('e')) nw = b0.w + dx; if (s.includes('w')) { nw = b0.w - dx; nx = b0.x + dx; } if (s.includes('s')) nh = b0.h + dy; if (s.includes('n')) { nh = b0.h - dy; ny = b0.y + dy; }
        const prop = shift || ['foto', 'logo', 'elipse'].includes(l.t) && shift;
        if (prop && b0.w && b0.h) { const k = Math.max(nw / b0.w, nh / b0.h); const w2 = b0.w * k, h2 = b0.h * k; if (s.includes('w')) nx = b0.x + b0.w - w2; if (s.includes('n')) ny = b0.y + b0.h - h2; nw = w2; nh = h2; }
        if (snapOn && !prop && !ini.rot) { const { xs, ys } = candidatosSnap(sel), lim = 8 / zoom; if (s.includes('e')) { const m = imaDe([nx + nw], xs, lim); if (m) { nw += m.d; guias.push({ x: m.c }); } } if (s.includes('w')) { const m = imaDe([nx], xs, lim); if (m) { nx += m.d; nw -= m.d; guias.push({ x: m.c }); } } if (s.includes('s')) { const m = imaDe([ny + nh], ys, lim); if (m) { nh += m.d; guias.push({ y: m.c }); } } if (s.includes('n')) { const m = imaDe([ny], ys, lim); if (m) { ny += m.d; nh -= m.d; guias.push({ y: m.c }); } } }
        nw = Math.max(4, nw); nh = Math.max(4, nh);
        if (l.t === 'texto') { l.x = Math.round(nx); l.y = Math.round(ny); l.w = Math.round(nw); if (s.length === 2 || s === 'n' || s === 's') l.tam = Math.max(6, Math.round(ini.tam * (nh / b0.h))); }
        else if (l.t === 'poli') { const sx = nw / (b0.w || 1), sy = nh / (b0.h || 1); l.pts = ini.pts.map((p) => [Math.round(nx + (p[0] - b0.x) * sx), Math.round(ny + (p[1] - b0.y) * sy)]); }
        else if (l.t === 'qr') { const t = Math.max(nw, nh); l.x = Math.round(nx); l.y = Math.round(ny); l.w = Math.round(t); }
        else { l.x = Math.round(nx); l.y = Math.round(ny); l.w = Math.round(nw); l.h = Math.round(nh); }
    }

    // ---- ações sobre camadas ----
    function novaCamada(t) {
        const W = M.w, H = M.h, cx = Math.round(W / 2), cy = Math.round(H / 2), nome = TIPO_NOME[t];
        const D = {
            ret: { x: cx - 150, y: cy - 100, w: 300, h: 200, fill: '$forte', raio: 0 }, elipse: { x: cx - 120, y: cy - 120, w: 240, h: 240, fill: '$acento' },
            poli: { pts: [[cx, cy - 120], [cx + 130, cy + 100], [cx - 130, cy + 100]], fill: '$acento' }, linha: { x: cx - 150, y: cy, x2: cx + 150, y2: cy, cor: '$texto', larg: 6 },
            texto: { txt: 'Novo texto', x: cx - 250, y: cy - 30, w: 500, tam: 64, cor: '$texto', peso: 800, al: 'center' }, foto: { x: cx - 150, y: cy - 150, w: 300, h: 300, raio: 24 },
            logo: { x: cx - 150, y: cy - 60, w: 300, h: 120, placa: false }, qr: { x: cx - 75, y: cy - 75, w: 150 }, grao: { q: 7000, op: 0.07, cor: '#000000' },
            meiotom: { x: 0, y: 0, w: Math.round(W / 2), h: Math.round(H / 2), cor: '$texto', op: 0.12, passo: 26, canto: 'se' }, guilloche: { x: 0, y: 0, w: W, h: Math.round(H / 3), cor: '$texto', op: 0.16, linhas: 14 },
            listras: { x: 0, y: 0, w: W, h: H, n: 8, dir: 'h', cor1: '$fundo', cor2: 'mix($fundo,$texto,0.12)' }, confete: { x: 0, y: 0, w: W, h: H, n: 100, semente: 7, tam: 22, cores: ['$acento', '$texto', '$marca'], op: 0.9 },
            arcos: { x: W, y: 0, w: 0, h: 0, r0: 160, passo: 60, n: 5, cor: 'alfa($acento,0.5)', larg: 3 }, campo: { x: 30, y: 30, w: W - 60, h: H - 60, cor: 'alfa($texto,0.4)', larg: 6 },
            foil: { x: 0, y: H - 14, w: W, h: 14 }, balao: { x: cx - 100, y: cy - 120, w: 200, h: 240, fill: '$acento', txt: '{idade}', tam: 120, cor: 'sobre($acento)' }
        };
        return { t, nome, ...D[t] };
    }
    function adiciona(t) {
        marca(); const L = camadas(); let novas;
        if (t === '@selo') novas = [{ t: 'elipse', nome: 'Selo', x: M.w - 300, y: 80, w: 220, h: 220, fill: '$acento', se: 'idade', borda: { cor: '#ffffff', larg: 8 }, sombra: { cor: 'rgba(0,0,0,0.3)', blur: 22, x: 0, y: 10 } }, { t: 'texto', nome: 'Idade', txt: '{idade}', x: M.w - 300, y: 100, w: 220, tam: 116, cor: 'sobre($acento)', peso: 900, al: 'center', se: 'idade', ajusta: false }, { t: 'texto', nome: 'Anos', txt: 'ANOS', x: M.w - 300, y: 226, w: 220, tam: 32, cor: 'sobre($acento)', peso: 800, al: 'center', esp: 3, se: 'idade', ajusta: false }];
        else if (t === '@faixa') novas = [{ t: 'ret', nome: 'Faixa', x: 60, y: Math.round(M.h / 2) - 50, w: M.w - 120, h: 100, fill: '$acento', raio: 50 }, { t: 'texto', nome: 'Texto da faixa', txt: 'Texto', x: 60, y: Math.round(M.h / 2) - 32, w: M.w - 120, tam: 56, cor: 'sobre($acento)', peso: 900, al: 'center' }];
        else novas = [novaCamada(t)];
        L.push(...novas); sel = L.length - 1; lista(); props(); redesenha(); $('#edAdd', root).value = '';
    }
    function duplica() { const L = camadas(); if (sel < 0) return; marca(); const c = clone(L[sel]); c.nome = (c.nome || TIPO_NOME[c.t]) + ' cópia'; const d = 20; if (c.t === 'poli') c.pts = c.pts.map((p) => [p[0] + d, p[1] + d]); else if (c.t === 'linha') { c.x += d; c.y += d; c.x2 += d; c.y2 += d; } else { c.x = (c.x || 0) + d; c.y = (c.y || 0) + d; } L.splice(sel + 1, 0, c); sel++; lista(); props(); redesenha(); }
    function apaga() { if (sel < 0) return; marca(); camadas().splice(sel, 1); sel = Math.min(sel, camadas().length - 1); lista(); props(); redesenha(); }
    function alinha(modo) {
        const l = camadas()[sel]; if (!l) return; marca(); const b = caixaDe(l); let dx = 0, dy = 0;
        if (modo === 'esq') dx = -b.x; if (modo === 'cx') dx = M.w / 2 - (b.x + b.w / 2); if (modo === 'dir') dx = M.w - (b.x + b.w);
        if (modo === 'topo') dy = -b.y; if (modo === 'cy') dy = M.h / 2 - (b.y + b.h / 2); if (modo === 'base') dy = M.h - (b.y + b.h);
        deslocar(l, clone(l), Math.round(dx), Math.round(dy)); redesenha(); props();
    }

    // ---- painel de propriedades ----
    const getP = (o, k) => k.split('.').reduce((a, c) => (a == null ? a : a[c]), o);
    function setP(o, k, v) { const p = k.split('.'); let a = o; for (let i = 0; i < p.length - 1; i++) { if (a[p[i]] == null || typeof a[p[i]] !== 'object') a[p[i]] = /^\d+$/.test(p[i + 1]) ? [] : {}; a = a[p[i]]; } if (v === undefined) delete a[p[p.length - 1]]; else a[p[p.length - 1]] = v; }
    const ctxCor = () => contextoCores(PALETAS[pal].cores, temaDe(tipo, temaId));
    const tokens = () => Object.keys(temaDe(tipo, temaId).tokens || {});
    function fCor(rot, k, v, extra = '') {
        const hex = (() => { const c = cor(v, ctxCor()); return /^#[0-9a-f]{6}$/i.test(c) ? c : '#808080'; })();
        return `<div class="pg-field ed-f ${extra}"><label class="pg-label">${rot}</label><div class="ed-cor"><label class="ed-sw" style="background:${E(cor(v, ctxCor()))}"><input type="color" value="${hex}" data-corpick="${k}" tabindex="-1"></label><input class="pg-input" data-k="${k}" data-t="cor" value="${E(v == null ? '' : v)}" spellcheck="false"><select class="pg-select" data-tok="${k}" aria-label="Cores do tema"><option value="">Tema…</option>${['primaria', 'secundaria', 'escura', 'destaque'].map((p) => `<option value="@${p}">@${p}</option>`).join('')}${tokens().map((t) => `<option value="$${t}">$${t}</option>`).join('')}<option value="#ffffff">branco</option><option value="#000000">preto</option><option value="rgba(0,0,0,0.3)">sombra</option></select></div></div>`;
    }
    const fNum = (rot, k, v, min, max, passo = 1, extra = '') => `<div class="pg-field ed-f ${extra}"><label class="pg-label">${rot}</label><input class="pg-input" type="number" data-k="${k}" data-t="num" ${min != null ? `min="${min}"` : ''} ${max != null ? `max="${max}"` : ''} step="${passo}" value="${v == null ? '' : v}"></div>`;
    const fRange = (rot, k, v, min, max, passo = 1) => `<div class="pg-field ed-f"><label class="pg-label">${rot} <output>${v == null ? '' : v}</output></label><input type="range" data-k="${k}" data-t="num" min="${min}" max="${max}" step="${passo}" value="${v == null ? min : v}"></div>`;
    const fSel = (rot, k, v, ops, extra = '') => `<div class="pg-field ed-f ${extra}"><label class="pg-label">${rot}</label><select class="pg-select" data-k="${k}" data-t="sel">${ops.map(([a, b]) => `<option value="${E(a)}" ${String(v == null ? '' : v) === a ? 'selected' : ''}>${E(b)}</option>`).join('')}</select></div>`;
    const fChk = (rot, k, v) => `<label class="ed-chk ed-f2"><input type="checkbox" data-k="${k}" data-t="chk" ${v ? 'checked' : ''}> ${rot}</label>`;
    const sec = (t, h) => `<section class="ed-sec"><h4>${t}</h4>${h}</section>`;

    function fFill(l, k = 'fill', rot = 'Preenchimento') {
        const f = l[k], tipoF = f === 'nenhum' ? 'nenhum' : f && typeof f === 'object' ? f.tipo || 'h' : 'cor';
        let h = `<div class="pg-field ed-f"><label class="pg-label">${rot}</label><select class="pg-select" data-fill="${k}"><option value="cor" ${tipoF === 'cor' ? 'selected' : ''}>Cor lisa</option><option value="h" ${tipoF === 'h' ? 'selected' : ''}>Degradê horizontal</option><option value="v" ${tipoF === 'v' ? 'selected' : ''}>Degradê vertical</option><option value="d1" ${tipoF === 'd1' ? 'selected' : ''}>Degradê diagonal ↘</option><option value="d2" ${tipoF === 'd2' ? 'selected' : ''}>Degradê diagonal ↙</option><option value="radial" ${tipoF === 'radial' ? 'selected' : ''}>Degradê radial</option><option value="nenhum" ${tipoF === 'nenhum' ? 'selected' : ''}>Sem preenchimento</option></select></div>`;
        if (tipoF === 'cor') h += fCor('Cor', k, f);
        else if (tipoF !== 'nenhum') h += (f.c || []).map((c, i) => fCor(`Cor ${i + 1} ${f.c.length > 2 ? `<button class="ed-mini" data-rmc="${k}:${i}" title="Remover">×</button>` : ''}`, `${k}.c.${i}`, c)).join('') + `<button class="pg-btn detail" data-addc="${k}">+ Cor no degradê</button>` + fChk('Degradê pela arte toda', `${k}.tela`, f.tela);
        return h;
    }
    const fBorda = (l, k = 'borda', rot = 'Contorno') => l[k] ? sec(rot, fCor('Cor', `${k}.cor`, l[k].cor) + fNum('Espessura', `${k}.larg`, l[k].larg, 0, 80) + `<button class="pg-btn detail" data-rmb="${k}">Remover ${rot.toLowerCase()}</button>`) : `<button class="pg-btn detail ed-add" data-addb="${k}">+ ${rot}</button>`;
    const fSombra = (l) => l.sombra ? sec('Sombra', fCor('Cor', 'sombra.cor', l.sombra.cor) + fNum('Desfoque', 'sombra.blur', l.sombra.blur, 0, 200) + `<div class="ed-2">${fNum('Desloc. X', 'sombra.x', l.sombra.x || 0, -200, 200)}${fNum('Desloc. Y', 'sombra.y', l.sombra.y || 0, -200, 200)}</div><button class="pg-btn detail" data-rmsh>Remover sombra</button>`) : `<button class="pg-btn detail ed-add" data-addsh>+ Sombra</button>`;

    function propsCamada(l) {
        const geo = (l.t === 'linha' ? `<div class="ed-2">${fNum('X inicial', 'x', l.x)}${fNum('Y inicial', 'y', l.y)}</div><div class="ed-2">${fNum('X final', 'x2', l.x2)}${fNum('Y final', 'y2', l.y2)}</div>`
            : l.t === 'poli' ? `<div class="pg-hint">Arraste os pontos na arte. ${(l.pts || []).length} pontos.</div><div class="ed-2"><button class="pg-btn detail" data-pt="+">+ Ponto</button><button class="pg-btn detail" data-pt="-">− Ponto</button></div>`
            : l.t === 'grao' ? '' : l.t === 'qr' ? `<div class="ed-2">${fNum('X', 'x', l.x)}${fNum('Y', 'y', l.y)}</div>${fNum('Tamanho', 'w', l.w, 20, 2000)}`
            : l.t === 'texto' ? `<div class="ed-2">${fNum('X', 'x', l.x)}${fNum('Y', 'y', l.y)}</div>${fNum('Largura da caixa', 'w', l.w, 20, 4000)}`
            : `<div class="ed-2">${fNum('X', 'x', l.x)}${fNum('Y', 'y', l.y)}</div><div class="ed-2">${fNum('Largura', 'w', l.w, 0, 4000)}${fNum('Altura', 'h', l.h, 0, 4000)}</div>`);
        let esp = '';
        const T = l.t;
        if (T === 'ret') esp = sec('Forma', fNum('Cantos arredondados', 'raio', l.raio || 0, 0, 1000) + fFill(l)) + fBorda(l);
        if (T === 'elipse') esp = sec('Forma', fFill(l)) + fBorda(l);
        if (T === 'poli') esp = sec('Forma', fFill(l)) + fBorda(l);
        if (T === 'linha') esp = sec('Linha', fCor('Cor', 'cor', l.cor) + fNum('Espessura', 'larg', l.larg, 1, 200) + fSel('Pontas', 'ponta', l.ponta || 'butt', [['butt', 'Retas'], ['round', 'Redondas'], ['square', 'Quadradas']]));
        if (T === 'texto') esp = sec('Texto', `<div class="pg-field ed-f"><label class="pg-label">Conteúdo <select class="pg-select ed-var" id="edVar"><option value="">Inserir variável…</option>${VARIAVEIS.map(([k, n]) => `<option value="{${k}}">${E(n)}</option>`).join('')}</select></label><textarea class="pg-textarea" data-k="txt" data-t="txt" rows="2">${E(l.txt || '')}</textarea></div>` +
            fSel('Fonte', 'fam', l.fam || 'padrao', [['padrao', 'Padrão (sem serifa)'], ['festa', 'Festa (decorativa)'], ['mao', 'Letra à mão'], ['serifa', 'Com serifa'], ['mono', 'Monoespaçada']]) +
            `<div class="ed-2">${fNum('Tamanho', 'tam', l.tam, 6, 1200)}${fSel('Peso', 'peso', String(l.peso == null ? 700 : l.peso), [['400', 'Normal'], ['600', 'Seminegrito'], ['700', 'Negrito'], ['800', 'Extranegrito'], ['900', 'Preto']])}</div>` +
            fCor('Cor', 'cor', l.cor) + fSel('Alinhamento', 'al', l.al || 'left', [['left', 'Esquerda'], ['center', 'Centro'], ['right', 'Direita']]) + fNum('Espaço entre letras', 'esp', l.esp || 0, -10, 60, 0.5) +
            fChk('TUDO EM MAIÚSCULAS', 'caixaAlta', l.caixaAlta) + fChk('Encolher para caber na caixa', 'ajusta', l.ajusta !== false) + fChk('Quebrar em várias linhas', 'quebraOn', !!l.quebra) + (l.quebra ? `<div class="ed-2">${fNum('Máx. linhas', 'quebra.linhas', l.quebra.linhas || 2, 1, 12)}${fNum('Entrelinha', 'quebra.alt', l.quebra.alt || 1, 0.6, 3, 0.05)}</div>` : '') + fChk('Só o contorno (sem preencher)', 'semPreenchimento', l.semPreenchimento)) + (l.contorno ? sec('Contorno do texto', fCor('Cor', 'contorno.cor', l.contorno.cor) + fNum('Espessura', 'contorno.larg', l.contorno.larg, 0, 40) + '<button class="pg-btn detail" data-rmb="contorno">Remover contorno</button>') : '<button class="pg-btn detail ed-add" data-addb="contorno">+ Contorno do texto</button>');
        if (T === 'foto') esp = sec('Foto do aluno', fNum('Cantos arredondados', 'raio', l.raio || 0, 0, 2000) + fRange('Enquadramento vertical', 'foco', l.foco == null ? 0.35 : l.foco, 0, 1, 0.05)) + fBorda(l);
        if (T === 'logo') esp = sec('Logo da escola', fChk('Logo sobre placa clara', 'placa', l.placa) + (l.placa ? fCor('Cor da placa', 'placaCor', l.placaCor || '#ffffff') + fNum('Cantos da placa', 'raio', l.raio == null ? 22 : l.raio, 0, 200) : '') + fSel('Alinhamento', 'al', l.al || 'centro', [['centro', 'Centro'], ['esquerda', 'Esquerda'], ['direita', 'Direita']]));
        if (T === 'qr') esp = sec('QR Code', fCor('Cor da placa', 'fundo', l.fundo || '#ffffff') + fNum('Margem da placa', 'pad', l.pad == null ? 10 : l.pad, 0, 60) + fNum('Cantos', 'raio', l.raio == null ? 14 : l.raio, 0, 100));
        if (T === 'grao') esp = sec('Grão', fNum('Quantidade', 'q', l.q, 100, 40000, 100) + fCor('Cor', 'cor', l.cor) + fNum('Semente', 'semente', l.semente || 11, 1, 9999));
        if (T === 'meiotom') esp = sec('Meio-tom', fCor('Cor', 'cor', l.cor) + fNum('Tamanho do ponto', 'passo', l.passo || 26, 8, 120) + fSel('Cresce para o canto', 'canto', l.canto || 'se', [['no', 'Noroeste ↖'], ['ne', 'Nordeste ↗'], ['so', 'Sudoeste ↙'], ['se', 'Sudeste ↘']]));
        if (T === 'guilloche') esp = sec('Guilloché', fCor('Cor', 'cor', l.cor) + fNum('Linhas', 'linhas', l.linhas || 14, 2, 60));
        if (T === 'listras') esp = sec('Listras', fCor('Cor 1', 'cor1', l.cor1) + fCor('Cor 2', 'cor2', l.cor2) + fNum('Quantidade', 'n', l.n || 8, 2, 60) + fSel('Direção', 'dir', l.dir || 'h', [['h', 'Verticais (lado a lado)'], ['v', 'Horizontais (empilhadas)']]));
        if (T === 'confete') esp = sec('Confete', fNum('Quantidade', 'n', l.n || 100, 1, 600) + fNum('Tamanho', 'tam', l.tam || 22, 4, 100) + fNum('Semente', 'semente', l.semente || 7, 1, 9999) + [0, 1, 2, 3].map((i) => (l.cores || [])[i] != null || i < 3 ? fCor(`Cor ${i + 1}`, `cores.${i}`, (l.cores || [])[i] || '') : '').join(''));
        if (T === 'arcos') esp = sec('Arcos', `<div class="pg-hint">O centro dos círculos é o ponto X, Y.</div>` + fCor('Cor', 'cor', l.cor) + `<div class="ed-2">${fNum('Raio inicial', 'r0', l.r0 || 100, 1, 3000)}${fNum('Passo', 'passo', l.passo || 60, 5, 500)}</div>${fNum('Quantidade', 'n', l.n || 4, 1, 30)}${fNum('Espessura', 'larg', l.larg || 3, 1, 40)}`);
        if (T === 'campo') esp = sec('Linhas de campo', fCor('Cor', 'cor', l.cor) + fNum('Espessura', 'larg', l.larg || 6, 1, 40) + fNum('Margem interna', 'pad', l.pad || 0, 0, 400));
        if (T === 'balao') esp = sec('Balão', fFill(l) + `<div class="pg-field ed-f"><label class="pg-label">Texto dentro do balão</label><input class="pg-input" data-k="txt" data-t="txt" value="${E(l.txt || '')}"></div>` + (l.txt ? fNum('Tamanho do texto', 'tam', l.tam || 100, 10, 800) + fCor('Cor do texto', 'cor', l.cor || '#ffffff') : ''));
        return `<div class="ed-sel-tit"><b>${E(l.nome || TIPO_NOME[l.t])}</b><small>${TIPO_NOME[l.t]}</small></div>
          <div class="ed-acoes"><button class="pg-btn detail" data-a2="dup">Duplicar</button><button class="pg-btn detail" data-a2="sobe">Subir</button><button class="pg-btn detail" data-a2="desce">Descer</button><button class="pg-btn detail cr-del" data-a2="del">Excluir</button></div>
          ${sec('Posição e tamanho', geo + `<div class="ed-2">${fNum('Giro (°)', 'rot', l.rot || 0, -360, 360, 0.5)}${fRange('Opacidade', 'op', l.op == null ? 1 : l.op, 0, 1, 0.05)}</div>`)}${esp}${T === 'grao' || T === 'poli' || T === 'linha' ? '' : fSombra(l)}
          ${sec('Quando aparece', fSel('', 'se', l.se || '', COND))}`;
    }
    function propsModelo() {
        const temas = cat.temas[tipo];
        return `${sec('Modelo', `<div class="pg-field ed-f"><label class="pg-label">Nome</label><input class="pg-input" id="edNome2" value="${E(M.nome)}"></div>` + `<label class="ed-chk ed-f2"><input type="checkbox" id="edAtivo" ${M.ativo === false ? '' : 'checked'}> Disponível para as escolas</label>`)}
          ${sec('Temas disponíveis', `<div class="pg-hint">O modelo aparece para a escola combinado com cada tema marcado.</div>${temas.map((t) => `<label class="ed-chk ed-f2"><input type="checkbox" data-tema="${t.id}" ${(M.temas || []).includes(t.id) ? 'checked' : ''}> ${E(t.nome)}</label>`).join('')}`)}
          ${carte ? sec('Tamanho', '<div class="pg-hint">Cartão padrão CR80: 85,6 × 54 mm (1012 × 638 px a 300 dpi). Para imprimir, mantenha este tamanho.</div>') : sec('Tamanho do post', `<div class="pg-field ed-f"><select class="pg-select" id="edTam">${[['1080x1350', 'Feed vertical 4:5 (1080 × 1350)'], ['1080x1080', 'Feed quadrado (1080 × 1080)'], ['1080x1920', 'Story / Reels 9:16 (1080 × 1920)']].map(([v, n]) => `<option value="${v}" ${v === M.w + 'x' + M.h ? 'selected' : ''}>${n}</option>`).join('')}</select></div><div class="pg-hint">Ao trocar o tamanho, as camadas não mudam de lugar: ajuste o que ficar fora.</div>`)}
          ${sec('Atalhos', '<div class="pg-hint">Setas: mover 1 px (Shift: 10). Ctrl+Z / Ctrl+Y: desfazer / refazer. Ctrl+D: duplicar. Ctrl+C / Ctrl+V: copiar / colar. Delete: excluir. [ e ]: descer / subir. Shift ao redimensionar: mantém a proporção. Alt ao arrastar: sem ímã.</div>')}`;
    }
    function propsVars() { return sec('Variáveis de texto', `<div class="pg-hint">Escreva entre chaves em qualquer texto. Elas são trocadas pelos dados de cada aluno.</div><table class="ed-vars">${VARIAVEIS.map(([k, n]) => `<tr><td><code>{${k}}</code></td><td>${E(n)}</td></tr>`).join('')}</table>`) + sec('Cores', `<div class="pg-hint">Escreva a cor como #rrggbb, cor da escola (<code>@primaria</code>, <code>@secundaria</code>, <code>@escura</code>, <code>@destaque</code>), item do tema (<code>${tokens().map((t) => '$' + t).join(', ')}</code>) ou conta: <code>mix(a,b,0.3)</code>, <code>alfa(a,0.5)</code>, <code>sobre(a)</code>, <code>acento(a)</code>, <code>legivel(a,fundo)</code>.</div>`); }

    function props(leve = false) {
        const el = $('#edProp', root);
        if (leve && el.dataset.sel == String(sel) && painel === 'prop') { atualizaValores(); return; }
        const l = camadas()[sel];
        el.dataset.sel = String(sel);
        el.innerHTML = painel === 'vars' ? propsVars() : painel === 'modelo' || !l ? propsModelo() : propsCamada(l);
        liga(el);
    }
    function atualizaValores() { // durante o arrasto: só atualiza os números, sem recriar os campos
        const l = camadas()[sel]; if (!l) return;
        $$('[data-k]', $('#edProp', root)).forEach((i) => { if (document.activeElement === i) return; const v = getP(l, i.dataset.k); if (i.dataset.t === 'num' && v != null) i.value = v; });
    }
    function liga(el) {
        const l = camadas()[sel];
        $$('[data-k]', el).forEach((i) => {
            const k = i.dataset.k, t = i.dataset.t;
            const grava = () => {
                if (!l) return; marca(k);
                let v = i.value;
                if (t === 'num') { v = v === '' ? undefined : parseFloat(v); if (Number.isNaN(v)) v = undefined; }
                else if (t === 'chk') { v = i.checked; if (k === 'quebraOn') { if (v) l.quebra = { linhas: 2, alt: 1 }; else delete l.quebra; lista(); redesenha(); props(); return; } if (k === 'ajusta') v = v ? undefined : false; else if (!v) v = undefined; }
                else if (t === 'sel' && k === 'peso') v = parseInt(v, 10);
                else if (t === 'sel' && (k === 'se' || k === 'ponta') && (v === '' || v === 'butt')) v = undefined;
                if (k.startsWith('quebra.') || k === 'quebraOn') { /* já tratado */ }
                setP(l, k, v);
                if (t === 'cor') { const sw = i.closest('.ed-cor'); if (sw) { const c = cor(i.value, ctxCor()); $('.ed-sw', sw).style.background = c; if (/^#[0-9a-f]{6}$/i.test(c)) $('input[type=color]', sw).value = c; } }
                if (i.type === 'range') { const o = i.closest('.pg-field').querySelector('output'); if (o) o.textContent = v; }
                if (t === 'sel' || t === 'chk') { lista(); props(); }
                redesenha();
            };
            i.addEventListener(t === 'sel' || t === 'chk' ? 'change' : 'input', grava);
        });
        $$('[data-corpick]', el).forEach((i) => i.addEventListener('input', () => { const inp = $(`[data-k="${i.dataset.corpick}"]`, el); inp.value = i.value; inp.dispatchEvent(new Event('input')); }));
        $$('[data-tok]', el).forEach((s) => s.addEventListener('change', () => { if (!s.value) return; const inp = $(`[data-k="${s.dataset.tok}"]`, el); inp.value = s.value; inp.dispatchEvent(new Event('input')); s.value = ''; props(); }));
        $$('[data-fill]', el).forEach((s) => s.addEventListener('change', () => {
            marca(); const k = s.dataset.fill, atual = l[k], v = s.value, prim = typeof atual === 'string' && atual !== 'nenhum' ? atual : atual && atual.c ? atual.c[0] : '$forte';
            if (v === 'cor') l[k] = prim; else if (v === 'nenhum') l[k] = 'nenhum'; else l[k] = { tipo: v, c: atual && atual.c ? atual.c : [prim, '$forte2'.replace('$forte2', tokens().includes('forte2') ? '$forte2' : '#000000')], tela: atual && atual.tela };
            props(); redesenha();
        }));
        $$('[data-addc]', el).forEach((b) => (b.onclick = () => { marca(); l[b.dataset.addc].c.push('$acento'); props(); redesenha(); }));
        $$('[data-rmc]', el).forEach((b) => (b.onclick = () => { marca(); const [k, i] = b.dataset.rmc.split(':'); l[k].c.splice(+i, 1); props(); redesenha(); }));
        $$('[data-addb]', el).forEach((b) => (b.onclick = () => { marca(); l[b.dataset.addb] = { cor: '$marca', larg: 4 }; props(); redesenha(); }));
        $$('[data-rmb]', el).forEach((b) => (b.onclick = () => { marca(); delete l[b.dataset.rmb]; props(); redesenha(); }));
        const as = $('[data-addsh]', el); if (as) as.onclick = () => { marca(); l.sombra = { cor: 'rgba(0,0,0,0.3)', blur: 20, x: 0, y: 8 }; props(); redesenha(); };
        const rs = $('[data-rmsh]', el); if (rs) rs.onclick = () => { marca(); delete l.sombra; props(); redesenha(); };
        $$('[data-pt]', el).forEach((b) => (b.onclick = () => { marca(); if (b.dataset.pt === '+') { const u = l.pts[l.pts.length - 1], p = l.pts[0]; l.pts.push([Math.round((u[0] + p[0]) / 2) + 30, Math.round((u[1] + p[1]) / 2) + 30]); } else if (l.pts.length > 3) l.pts.pop(); props(); redesenha(); }));
        $$('[data-a2]', el).forEach((b) => (b.onclick = () => { const a = b.dataset.a2; if (a === 'dup') duplica(); else if (a === 'del') apaga(); else if (a === 'sobe' && sel < camadas().length - 1) move(sel, sel + 1); else if (a === 'desce' && sel > 0) move(sel, sel - 1); }));
        const v = $('#edVar', el); if (v) v.onchange = () => { if (!v.value) return; const ta = $('[data-k="txt"]', el), p = ta.selectionStart == null ? ta.value.length : ta.selectionStart; ta.value = ta.value.slice(0, p) + v.value + ta.value.slice(p); ta.dispatchEvent(new Event('input')); v.value = ''; };
        const n2 = $('#edNome2', el); if (n2) n2.oninput = () => { marca('nome'); M.nome = n2.value; $('#edNome', root).value = n2.value; };
        const at = $('#edAtivo', el); if (at) at.onchange = () => { marca(); M.ativo = at.checked; };
        $$('[data-tema]', el).forEach((c) => { if (c.type === 'checkbox') c.onchange = () => { marca(); const s = new Set(M.temas || []); if (c.checked) s.add(c.dataset.tema); else s.delete(c.dataset.tema); M.temas = cat.temas[tipo].map((t) => t.id).filter((x) => s.has(x)); }; });
        const tm = $('#edTam', el); if (tm) tm.onchange = () => { marca(); const [w, h] = tm.value.split('x').map(Number); M.w = w; M.h = h; ajusta(); };
    }

    // ---- barra ----
    root.addEventListener('click', async (e) => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.a === 'sair') return sair();
        if (b.dataset.a === 'desfaz') return desfaz(); if (b.dataset.a === 'refaz') return refaz();
        if (b.dataset.a === 'zmenos') { zoom = Math.max(0.1, zoom - 0.1); return pinta(); } if (b.dataset.a === 'zmais') { zoom = Math.min(3, zoom + 0.1); return pinta(); } if (b.dataset.a === 'zfit') return ajusta();
        if (b.dataset.a === 'salvar') return gravar(false); if (b.dataset.a === 'salvarsair') return gravar(true);
        if (b.dataset.lado) { lado = b.dataset.lado; sel = -1; $$('[data-lado]', root).forEach((x) => x.classList.toggle('on', x === b)); lista(); props(); return redesenha(); }
        if (b.dataset.painel) { painel = b.dataset.painel; $$('.ed-abas button', root).forEach((x) => x.classList.toggle('on', x === b)); return props(); }
        if (b.dataset.al && b.closest('.ed-alinha')) return alinha(b.dataset.al);
    });
    $('#edNome', root).oninput = (e) => { marca('nome'); M.nome = e.target.value; const n2 = $('#edNome2', root); if (n2) n2.value = e.target.value; };
    $('#edTema', root).onchange = (e) => { temaId = e.target.value; props(); redesenha(); };
    $('#edPal', root).onchange = (e) => { pal = e.target.value; props(); redesenha(); };
    $('#edDados', root).onchange = (e) => { dadosId = e.target.value; redesenha(); };
    $('#edSnap', root).onchange = (e) => { snapOn = e.target.checked; }; $('#edCx', root).onchange = (e) => { mostraCaixas = e.target.checked; overlay(); };
    $('#edAdd', root).onchange = (e) => { if (e.target.value) adiciona(e.target.value); };
    $('#edFoto', root).onchange = async (e) => { const f = e.target.files[0]; if (f) { fotoEx = await imagem(await lerArquivo(f)); redesenha(); } };
    $('#edLogo', root).onchange = async (e) => { const f = e.target.files[0]; if (f) { logoEx = await imagem(await lerArquivo(f)); redesenha(); } };
    const lerArquivo = (f) => new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(f); });
    palco.addEventListener('wheel', (e) => { if (!e.ctrlKey) return; e.preventDefault(); zoom = Math.min(3, Math.max(0.1, zoom * (e.deltaY < 0 ? 1.1 : 0.9))); pinta(); }, { passive: false });
    palco.addEventListener('pointerdown', (e) => { if (e.target === palco) { sel = -1; lista(); props(); overlay(); } });

    // ---- teclado ----
    const tecla = (e) => {
        if (!document.body.contains(root)) return document.removeEventListener('keydown', tecla, true);
        if (document.querySelector('.pg-modal-back')) return;
        const digitando = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) && document.activeElement.type !== 'checkbox' && document.activeElement.type !== 'range';
        const ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
        if (ctrl && k === 's') { e.preventDefault(); return gravar(false); }
        if (digitando) return;
        if (ctrl && k === 'z') { e.preventDefault(); return e.shiftKey ? refaz() : desfaz(); } if (ctrl && k === 'y') { e.preventDefault(); return refaz(); }
        if (ctrl && k === 'd') { e.preventDefault(); return duplica(); }
        if (ctrl && k === 'c' && sel >= 0) { clip = clone(camadas()[sel]); return; }
        if (ctrl && k === 'v' && clip) { e.preventDefault(); marca(); const c = clone(clip); c.nome = (c.nome || TIPO_NOME[c.t]) + ' cópia'; deslocar(c, clone(c), 24, 24); camadas().push(c); sel = camadas().length - 1; lista(); props(); return redesenha(); }
        if (k === 'delete' || k === 'backspace') { e.preventDefault(); return apaga(); }
        if (k === 'escape') { sel = -1; lista(); props(); return overlay(); }
        if (k === '[' && sel > 0) return move(sel, sel - 1); if (k === ']' && sel >= 0 && sel < camadas().length - 1) return move(sel, sel + 1);
        const passo = e.shiftKey ? 10 : 1, d = { arrowleft: [-passo, 0], arrowright: [passo, 0], arrowup: [0, -passo], arrowdown: [0, passo] }[k];
        if (d && sel >= 0) { e.preventDefault(); const l = camadas()[sel]; if (l.travado) return; marca('seta'); deslocar(l, clone(l), d[0], d[1]); redesenha(); props(true); }
    };
    document.addEventListener('keydown', tecla, true);

    // ---- salvar / sair ----
    async function gravar(fecha) {
        try {
            const i = cat[tipo].findIndex((m) => m.id === modelo.id);
            if (!M.temas || !M.temas.length) M.temas = cat.temas[tipo].map((t) => t.id);
            M.nome = (M.nome || '').trim() || 'Modelo sem nome';
            if (i >= 0) cat[tipo][i] = clone(M); else cat[tipo].push(clone(M));
            await salva('Modelo salvo. Já vale para todas as escolas.'); dirty = false; jaSalvo = true; modelo = cat[tipo].find((m) => m.id === M.id); aviso();
            if (fecha) fechar();
        } catch (e) { app.falha(e); }
    }
    async function sair() {
        if (dirty && !(await app.confirma('Sair sem salvar?', 'As alterações deste modelo que não foram salvas se perdem.', 'Sair sem salvar', true))) return;
        if (!jaSalvo) { const k = cat[tipo].findIndex((m) => m.id === modelo.id); if (k >= 0) cat[tipo].splice(k, 1); } // modelo novo que nunca foi salvo
        fechar();
    }
    function fechar() { document.removeEventListener('keydown', tecla, true); window.removeEventListener('resize', ajusta); root.remove(); document.body.style.overflow = ''; aoFechar(); }
    window.addEventListener('resize', ajusta);
    window.onbeforeunload = null;

    lista(); props(); requestAnimationFrame(() => { ajusta(); });
}
