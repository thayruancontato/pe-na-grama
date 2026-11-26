// Central do dono do Pé na Grama: pedidos, propostas, contratos, clientes e faturas. Usa o design system em /ds.
(() => {
  const E = PG.esc, I = PG.icon, brl = PG.brl, dt = PG.data;
  const $ = (s, r = document) => r.querySelector(s);
  const app = $('#app');
  // [rota, rótulo, ícone, grupo do menu]
  const NAV = [['painel', 'Painel', 'chart', ''], ['pedidos', 'Pedidos', 'inbox', 'Vendas'], ['contratos', 'Contratos', 'file', 'Vendas'], ['clientes', 'Clientes', 'cap', 'Escolas'], ['faturas', 'Faturas', 'receipt', 'Escolas'], ['criativos', 'Criativos', 'pencil', 'Ajustes'], ['planos', 'Planos', 'tag', 'Ajustes'], ['config', 'Configurações', 'settings', 'Ajustes']];
  const ST_LEAD = { novo: ['Novo', 'info'], proposta: ['Proposta enviada', 'warn'], contratado: ['Contratado', 'ok'], perdido: ['Perdido', ''] };
  const ST_CLI = { implantando: ['Implantando', 'warn'], ativo: ['Ativo', 'ok'], teste: ['Em teste', 'warn'], teste_fim: ['Teste encerrado', ''], cancelado: ['Cancelado', ''] };
  const ST_FAT = { aberta: ['Em aberto', 'warn'], informada: ['Pagamento informado', 'info'], paga: ['Paga', 'ok'], cancelada: ['Cancelada', ''] };
  const CHECK = ['Conta do sistema criada', 'Nome, logo e cores aplicados', 'Endereço do sistema definido', 'WhatsApp da escola conectado', 'Pix da escola configurado', 'Alunos importados', 'Treinamento feito'];

  // ---------- utilidades ----------
  const money = s => { const n = parseFloat(String(s).replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? Math.round(n * 100) : 0; };
  const fmtIn = c => (c / 100).toFixed(2).replace('.', ',');
  const badge = (m, k) => { const [t, c] = m[k] || [k, '']; return `<span class="pg-badge ${c}">${E(t)}</span>`; };
  const digits = s => String(s || '').replace(/\D/g, '');
  const waLink = (tel, msg) => { let d = digits(tel); if (d.length <= 11) d = '55' + d; return 'https://wa.me/' + d + (msg ? '?text=' + encodeURIComponent(msg) : ''); };
  function toast(t, tipo) { const e = document.createElement('div'); e.className = 'pg-toast' + (tipo === 'err' ? ' err' : ''); e.setAttribute('role', tipo === 'err' ? 'alert' : 'status'); e.textContent = t; document.body.appendChild(e); setTimeout(() => e.remove(), tipo === 'err' ? 5200 : 2800); }
  async function copiar(t) { try { await navigator.clipboard.writeText(t); } catch { const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); document.execCommand('copy'); a.remove(); } toast('Copiado'); }
  async function api(p, o = {}) {
    const r = await fetch('/api/admin/' + p, { method: o.m || 'GET', headers: { 'content-type': 'application/json', 'x-pg': '1' }, body: o.b ? JSON.stringify(o.b) : undefined });
    if (r.status === 401) { entrar(); throw new Error('sessao'); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.erro || 'Algo deu errado.');
    return j;
  }
  const falha = e => { if (e.message !== 'sessao') toast(e.message, 'err'); };

  // ---------- janela ----------
  function modal(titulo, html, onOpen, opts = {}) {
    const antes = document.activeElement, back = document.createElement('div'); back.className = 'pg-modal-back';
    back.innerHTML = `<div class="pg-modal ${opts.wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${E(titulo)}"><div class="pg-modal-head"><div class="pg-card-title">${E(titulo)}</div><button class="pg-x" aria-label="Fechar">${I('x')}</button></div><div class="mbody">${html}</div></div>`;
    const sair = () => { back.remove(); document.removeEventListener('keydown', esc); if (antes && antes.focus) antes.focus(); };
    const fechar = async () => { if (opts.guarda && opts.guarda() && !(await confirma('Descartar alterações?', 'Você mudou opções que ainda não foram salvas. Se fechar agora, elas se perdem.', 'Descartar', true))) return; sair(); };
    const esc = e => { if (e.key === 'Escape' && !document.querySelector('.pg-modal-back.conf')) fechar(); };
    back.addEventListener('mousedown', e => { if (e.target === back) fechar(); });
    $('.pg-x', back).onclick = fechar; document.addEventListener('keydown', esc);
    document.body.appendChild(back); $('.pg-x', back).focus();
    if (onOpen) onOpen($('.mbody', back), sair);
    return { el: $('.mbody', back), fechar: sair };
  }
  // Confirmação no padrão da Central (no lugar do confirm do navegador); perigo = botão vermelho.
  function confirma(titulo, texto, rotulo = 'Confirmar', perigo = false, extra = '') {
    return new Promise(res => {
      const back = document.createElement('div'); back.className = 'pg-modal-back conf'; back.style.zIndex = 200;
      back.innerHTML = `<div class="pg-modal ct-conf" role="alertdialog" aria-modal="true" aria-label="${E(titulo)}" style="width:min(440px,100%);padding:24px;overflow:visible"><div class="pg-card-title">${E(titulo)}</div><p>${E(texto)}</p>${extra}<div class="pg-actions" style="justify-content:flex-end;margin-top:20px"><button class="pg-btn" data-n>Cancelar</button><button class="pg-btn ${perigo ? 'danger' : 'green'}" data-s>${E(rotulo)}</button></div></div>`;
      const fim = v => { back.remove(); document.removeEventListener('keydown', k, true); res(v); };
      const k = e => { if (e.key === 'Escape') { e.stopPropagation(); fim(false); } };
      document.addEventListener('keydown', k, true);
      back.addEventListener('mousedown', e => { if (e.target === back) fim(false); });
      $('[data-n]', back).onclick = () => fim(false); $('[data-s]', back).onclick = () => fim(back.querySelector('select') ? back.querySelector('select').value : back.querySelector('input') ? back.querySelector('input').value : true);
      document.body.appendChild(back); const campo = back.querySelector('input'); if (campo) campo.addEventListener('keydown', e => { if (e.key === 'Enter') $('[data-s]', back).click(); }); (campo || $('[data-n]', back)).focus();
    });
  }

  // ---------- entrada ----------
  function entrar() {
    app.innerHTML = `<div class="pg-login"><form class="pg-login-card" id="f"><div class="top"><img src="../assets/logo-branco.png" alt="Pé na Grama"></div><div class="body"><h1>Central do dono</h1>
      <div class="pg-field"><label class="pg-label" for="s">Senha</label><input class="pg-input" id="s" type="password" autocomplete="current-password" required autofocus></div>
      <div id="m" class="pg-alert bad" hidden></div><button class="pg-btn green" style="width:100%">Entrar</button></div></form></div>`;
    $('#f').onsubmit = async e => { e.preventDefault(); const m = $('#m'); m.hidden = true;
      const r = await fetch('/api/admin/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ senha: $('#s').value }) });
      if (r.ok) return abrir(); const j = await r.json().catch(() => ({})); m.textContent = j.erro || 'Não foi possível entrar.'; m.hidden = false; };
  }
  async function sair() { await fetch('/api/admin/logout', { method: 'POST', headers: { 'content-type': 'application/json', 'x-pg': '1' } }); entrar(); }

  // ---------- estrutura ----------
  function shell() {
    app.innerHTML = `<div class="pg-app"><aside class="pg-side" id="side"><div class="pg-side-head"><img src="../assets/logo-branco.png" alt="Pé na Grama"></div>
      <nav class="pg-nav" aria-label="Seções">${NAV.map(([id, t, ic, g], i) => (g && g !== NAV[i - 1][3] ? `<div class="nav-sec">${g}</div>` : '') + `<a class="pg-nav-item" data-r="${id}" href="#/${id}">${I(ic)}<span class="grow">${t}</span><span class="nav-n" data-n="${id}"></span></a>`).join('')}</nav>
      <div class="pg-side-foot"><a class="pg-btn side" href="../ds/">Design system</a><button class="pg-btn exit" id="sair">${I('logout')} Sair</button></div></aside>
      <div class="ct-scrim" id="scrim"></div><main class="pg-main"><div class="ct-topm"><button class="pg-btn" id="menu2" aria-label="Abrir menu" aria-controls="side">${I('menu')}</button><b id="tit"></b></div><div class="pg-page" id="page"></div></main></div>`;
    $('#sair').onclick = sair;
    const gaveta = (abrir) => { $('#side').classList.toggle('open', abrir); $('#scrim').classList.toggle('on', abrir); };
    $('#menu2').onclick = () => gaveta(!$('#side').classList.contains('open')); $('#scrim').onclick = () => gaveta(false);
    $('#side').addEventListener('click', e => { if (e.target.closest('a[data-r]')) gaveta(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#side') && $('#side').classList.contains('open')) gaveta(false); });
  }
  const cabeca = (titulo, sub, acoes = '') => `<div class="pg-page-head"><div><button class="pg-btn ct-menu" id="menu" aria-label="Abrir menu" style="margin-bottom:10px">${I('menu')} Menu</button><h1 class="pg-title">${titulo}</h1><p class="pg-sub">${sub}</p></div><div class="pg-actions">${acoes}</div></div>`;
  const vazio = (t, d) => `<div class="pg-empty"><b>${t}</b><br>${d || ''}</div>`;

  // ---------- rotas ----------
  // Aba Criativos: o editor é um módulo à parte (criativos.js), carregado só quando a aba é aberta.
  const criativos = async (pg) => (await import('./criativos.js?v=2')).pagina(pg, { api, toast, confirma, falha, cabeca, E, I });
  const ROTAS = { painel, pedidos, clientes, faturas, contratos, planos, criativos, config };
  async function rota() {
    const [r, qs] = (location.hash.replace(/^#\//, '') || 'painel').split('?'), q = new URLSearchParams(qs || '');
    if (r === 'faturas' && q.has('f')) filtroFat = q.get('f');
    document.querySelectorAll('[data-r]').forEach(a => a.classList.toggle('on', a.dataset.r === r));
    const pg = $('#page'); if (!pg) return;
    if (pg.children.length && !pg.querySelector('.pg-alert.bad')) pg.classList.add('trocando'); else pg.innerHTML = '<div class="pg-empty">Carregando…</div>';
    try { await (ROTAS[r] || painel)(pg); const ab = +q.get('abrir'); if (ab && r === 'pedidos') detalhePedido(ab); if (ab && r === 'clientes') detalheCliente(ab); } catch (e) { if (e.message !== 'sessao') pg.innerHTML = `<div class="pg-alert bad">${E(e.message)}</div>`; }
    pg.classList.remove('trocando'); contagens();
    const m = $('#menu'); if (m) m.onclick = () => $('#side').classList.toggle('open');
    rotular(pg); const t = $('#tit'); if (t) t.textContent = (NAV.find(n => n[0] === r) || NAV[0])[1];
    window.scrollTo(0, 0);
  }
  // Números ao lado do menu: pedidos novos e faturas que pedem atenção (atrasadas ou com pagamento informado).
  const contagens = () => api('contagens').then(c => Object.entries(c).forEach(([k, n]) => { const e = document.querySelector(`[data-n="${k}"]`); if (e) e.textContent = n || ''; })).catch(() => {});
  // Escola com a logo (ou as iniciais) ao lado do nome, usada em todas as listas.
  const iniciais = s => E((String(s).match(/[A-Za-zÀ-ú0-9]+/g) || ['?']).slice(0, 2).map(w => w[0]).join('').toUpperCase());
  const escolaCel = (nome, leadId, sub = '') => `<div class="ct-esc"><span class="cl-logo sm"><b>${iniciais(nome)}</b>${leadId ? `<img src="/api/admin/leads/${leadId}/logo" alt="" loading="lazy" onerror="this.remove()">` : ''}</span><div><b>${E(nome)}</b>${sub ? `<small>${sub}</small>` : ''}</div></div>`;
  // Cada célula de tabela leva o nome da coluna (usado quando a tabela vira lista de cartões no celular).
  function rotular(raiz) {
    raiz.querySelectorAll('table.pg-table').forEach(t => {
      const nomes = [...t.querySelectorAll('thead th')].map(h => h.textContent.trim());
      t.querySelectorAll('tbody tr').forEach(tr => [...tr.children].forEach((td, i) => { if (!td.hasAttribute('data-l')) td.setAttribute('data-l', nomes[i] || ''); }));
    });
  }
  async function abrir() { try { await api('me'); } catch { return; } shell(); window.addEventListener('hashchange', () => { document.querySelectorAll('.pg-modal-back').forEach(m => m.remove()); rota(); }); rota(); }

  // ---------- painel ----------
  let mesSel = '';
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'], MES3 = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const mesTxt = ym => MESES[+ym.slice(5) - 1] + ' de ' + ym.slice(0, 4);
  const somaMesJs = (ym, n) => { const d = new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5) - 1 + n, 1)); return d.toISOString().slice(0, 7); };
  const pct = (v, t) => (t ? Math.round(v / t * 100) : 0);
  const kk = v => v >= 100000 ? (v / 100000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil' : brl(v).replace(',00', '').replace(/R\$\s*/, '');
  const idadeTxt = iso => { const d = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5); return d <= 0 ? 'hoje' : d === 1 ? 'ontem' : 'há ' + d + ' dias'; };
  let timerPainel;

  async function painel(pg) {
    clearInterval(timerPainel);
    const [r, planos, cfg] = await Promise.all([api('resumo' + (mesSel ? '?mes=' + mesSel : '')), api('planos'), api('config')]);
    const kpi = (cls, ic, rot, val, pe) => '<div class="pg-kpi ' + cls + '"><div class="pg-kpi-head"><span class="pg-kpi-icon">' + I(ic) + '</span><span class="pg-kpi-label">' + rot + '</span></div><div class="pg-kpi-value">' + val + '</div><div class="pg-kpi-foot">' + pe + '</div><div class="pg-kpi-bg"><svg viewBox="0 0 24 24">' + I(ic).replace(/<\/?svg[^>]*>/g, '') + '</svg></div></div>';
    const atual = r.mes === r.mes_atual, hora = new Date().toTimeString().slice(0, 5);
    const dif = r.mrr - r.mrr_anterior, difTxt = r.mrr_anterior ? (dif >= 0 ? '+' : '−') + brl(Math.abs(dif)) + ' (' + (dif >= 0 ? '+' : '−') + pct(Math.abs(dif), r.mrr_anterior) + '%) sobre o mês anterior' : (r.mrr ? 'primeiros clientes' : 'ainda sem clientes');
    const pend = [['Crie pelo menos um plano', '#/planos', planos.length > 0], ['Configure o seu Pix para receber', '#/config', !!cfg.pix_chave], ['Coloque o CNPJ ou CPF no contrato', '#/config', !!cfg.empresa_doc]];
    const faltam = pend.filter(p => !p[2]).length, totalAtencao = r.atencao.reduce((s, g) => s + g.itens.length, 0);
    const max = Math.max(1, ...r.receita_meses.map(x => x.valor)), total12 = r.receita_meses.reduce((s, x) => s + x.valor, 0);
    const prev = r.previsto_mes.valor, p = pct(r.recebido_mes.valor, prev);
    const planosTot = r.por_plano.reduce((s, x) => s + x.mrr, 0);
    const f = r.funil, tx = (v, t) => t ? pct(v, t) + '%' : '—';
    const NIVEL = { bad: 'bad', warn: 'warn', info: 'info' };

    pg.innerHTML = cabeca('Painel do dono', 'Pedidos, contratos e cobranças das escolas que você vendeu.',
      '<span class="pg-hint" style="margin-right:6px">Atualizado às ' + hora + '</span><button class="pg-btn" id="atu">' + I('refresh') + ' Atualizar</button><button class="pg-btn ok" id="gerar">' + I('plus') + ' Gerar mensalidades</button>') +
      '<div class="pg-stack">' +
      '<div class="pg-bar"><button id="mant" aria-label="Mês anterior">' + I('chevron').replace('<svg', '<svg style="transform:scaleX(-1)"') + '</button><div><small>Dados do mês</small><b>' + E(mesTxt(r.mes)) + '</b></div><button id="mpro" aria-label="Próximo mês" ' + (atual ? 'disabled style="opacity:.35;cursor:not-allowed"' : '') + '>' + I('chevron') + '</button></div>' +
      (faltam ? '<div class="pg-card edge-gold"><div class="pg-card-title">' + I('alert') + ' Falta pouco para vender</div><div class="ct-steps">' + pend.map((x, i) => '<a class="' + (x[2] ? 'ok' : '') + '" href="' + x[1] + '"><span class="n">' + (x[2] ? '✓' : i + 1) + '</span>' + x[0] + '</a>').join('') + '</div></div>' : '') +
      (totalAtencao ? '<div class="pg-card edge-red"><div class="pg-card-title">' + I('alert') + ' Precisa da sua atenção <span class="pg-count" style="margin-left:4px">' + totalAtencao + '</span></div><div class="ct-att">' +
        r.atencao.map(g => '<div class="ct-att-g"><div class="ct-att-h"><span class="pg-badge ' + NIVEL[g.nivel] + '">' + g.itens.length + '</span> ' + E(g.titulo) + '</div>' + g.itens.map(it => '<a class="ct-att-i" href="' + E(it.rota) + '"><span><b>' + E(it.texto) + '</b><small>' + E(it.detalhe) + '</small></span>' + I('chevron') + '</a>').join('') + '</div>').join('') + '</div></div>'
        : '<div class="pg-card edge-green"><div class="pg-card-title">' + I('check') + ' Tudo em dia</div><p class="pg-sub" style="margin-top:8px">Nenhum pedido esperando resposta, nenhuma fatura atrasada e nenhum pagamento para conferir.</p></div>') +
      '<div class="pg-grid-4">' +
        kpi('dark', 'trend', 'Receita mensal recorrente', brl(r.mrr), '<span class="ct-delta ' + (dif >= 0 ? 'up' : 'down') + '">' + E(difTxt) + '</span>') +
        kpi('green', 'check', 'Recebido em ' + MES3[+r.mes.slice(5) - 1], brl(r.recebido_mes.valor), r.recebido_mes.n + ' fatura(s) paga(s)' + (prev ? ' · ' + p + '% do previsto' : '') + '<div class="pg-track ct-onbrand"><i style="width:' + Math.min(100, p) + '%"></i></div>') +
        kpi('', 'users', 'Clientes ativos', r.clientes.ativo, r.clientes.implantando + ' em implantação · ' + r.periodo.clientes_novos + ' novo(s) no mês') +
        kpi('purple', 'dollar', 'Ticket médio', brl(r.ticket), 'Receita anual projetada R$ ' + kk(r.arr)) +
        kpi('', 'inbox', 'Pedidos no mês', r.periodo.pedidos, r.leads.novo + ' esperando resposta agora') +
        kpi('', 'file', 'Contratos assinados no mês', r.periodo.assinados, r.periodo.propostas + ' proposta(s) enviada(s) no mês') +
        kpi('amber', 'clock', 'A receber', brl(r.a_receber.valor), r.a_receber.n + ' fatura(s) em aberto no prazo') +
        kpi('red', 'alert', 'Em atraso', brl(r.atrasado.valor), r.atrasado.n + ' fatura(s) vencida(s)') +
      '</div>' +
      '<div class="ct-split"><div class="pg-card"><div class="pg-card-title">' + I('chart') + ' Receita dos últimos 12 meses</div><p class="pg-card-sub" style="margin-top:4px">Total no período: <b>' + brl(total12) + '</b></p>' +
        '<div class="ct-chart" role="img" aria-label="Receita por mês: ' + E(r.receita_meses.map(m => MES3[+m.mes.slice(5) - 1] + ' ' + brl(m.valor)).join(', ')) + '">' +
        '<div class="ct-grid" aria-hidden="true">' + [1, .5, 0].map(k => '<span><em>' + (k ? 'R$ ' + kk(Math.round(max * k)) : 'R$ 0') + '</em></span>').join('') + '</div>' +
        '<div class="ct-cols">' + r.receita_meses.map(m => '<div class="ct-col' + (m.mes === r.mes ? ' now' : '') + '" title="' + E(MES3[+m.mes.slice(5) - 1] + '/' + m.mes.slice(0, 4) + ': ' + brl(m.valor) + ' em ' + m.n + ' fatura(s)') + '"><div class="bw"><b>' + (m.valor ? kk(m.valor) : '') + '</b><i style="height:' + Math.max(m.valor ? 6 : 2, Math.round(m.valor / max * 150)) + 'px"></i></div><small>' + MES3[+m.mes.slice(5) - 1] + '</small></div>').join('') + '</div></div></div>' +
        '<div class="pg-card"><div class="pg-card-title">' + I('pie') + ' Funil de vendas</div><div class="ct-funil">' +
        [['Pedidos recebidos', f.pedidos, '', 100], ['Propostas enviadas', f.propostas, tx(f.propostas, f.pedidos) + ' dos pedidos', pct(f.propostas, f.pedidos)], ['Contratos assinados', f.assinados, tx(f.assinados, f.propostas) + ' das propostas', pct(f.assinados, f.pedidos)]].map(([n, v, t, w], i) => '<div><div class="l"><span>' + n + '</span><span>' + v + '</span></div><div class="pg-track ' + (i === 2 ? '' : 'blue') + '"><i style="width:' + w + '%"></i></div>' + (t ? '<small class="pg-hint">' + t + '</small>' : '') + '</div>').join('') +
        '</div><dl class="pg-dl" style="margin-top:16px;grid-template-columns:150px 1fr"><dt>Conversão geral</dt><dd><b>' + r.conversao + '%</b></dd><dt>Até assinar</dt><dd>' + (f.dias_ate_assinar == null ? '—' : f.dias_ate_assinar < 1 ? '<b>menos de 1</b> dia em média' : '<b>' + String(f.dias_ate_assinar).replace('.', ',') + '</b> dia(s) em média') + '</dd><dt>Perdidos</dt><dd>' + r.leads.perdido + '</dd></dl></div></div>' +
      '<div class="pg-grid-2"><div class="pg-card"><div class="pg-card-title">' + I('tag') + ' Receita recorrente por plano</div>' +
        (r.por_plano.length ? '<div class="ct-hb">' + r.por_plano.map(x => '<div><div class="l"><span>' + E(x.nome || 'Sem plano') + ' <small>· ' + x.n + ' cliente(s)</small></span><b>' + brl(x.mrr) + '</b></div><div class="pg-track"><i style="width:' + pct(x.mrr, planosTot) + '%"></i></div></div>').join('') + '</div>' : vazio('Sem clientes ainda', 'Quando o primeiro contrato for assinado, a divisão por plano aparece aqui.')) + '</div>' +
        '<div class="pg-card"><div class="pg-card-title">' + I('clock') + ' Vencem nos próximos 7 dias</div>' +
        (r.vencendo.length ? '<div class="pg-table-wrap" style="margin-top:12px"><table class="pg-table"><thead><tr><th>Escola</th><th>Vence</th><th class="num">Valor</th></tr></thead><tbody>' + r.vencendo.map(v => '<tr><td><b>' + E(v.escola) + '</b><small>' + E(v.descricao) + '</small></td><td>' + dt(v.vencimento) + '</td><td class="num">' + brl(v.valor) + '</td></tr>').join('') + '</tbody></table></div>' : vazio('Nada vencendo nesta semana', 'As faturas que vencem em até 7 dias aparecem aqui.')) + '</div></div>' +
      '<div class="ct-split b"><div class="pg-card"><div class="pg-card-title">' + I('inbox') + ' Últimos pedidos</div>' +
        (r.ultimos_pedidos.length ? '<div class="pg-table-wrap" style="margin-top:12px"><table class="pg-table"><thead><tr><th>Escola</th><th>Recebido</th><th>Situação</th><th></th></tr></thead><tbody>' + r.ultimos_pedidos.map(l => '<tr><td><b>' + E(l.escola) + '</b><small>' + E(l.contato_nome) + '</small></td><td>' + idadeTxt(l.criado) + '</td><td>' + badge(ST_LEAD, l.status) + '</td><td class="ac"><a class="pg-btn detail" href="#/pedidos?abrir=' + l.id + '">Abrir</a></td></tr>').join('') + '</tbody></table></div>' : vazio('Nenhum pedido ainda', 'Divulgue o endereço do site: os pedidos chegam aqui sozinhos.')) + '</div>' +
        '<div class="pg-card"><div class="pg-card-title">' + I('clock') + ' Atividades</div>' + (r.atividade.length ? '<div class="ct-feed">' + r.atividade.map(x => '<div><time>' + dt(x.quando).slice(0, 5) + ' ' + new Date(x.quando).toTimeString().slice(0, 5) + '</time><span>' + E(x.texto) + '</span></div>').join('') + '</div>' : vazio('Nada por aqui ainda', 'Pedidos, contratos e pagamentos aparecem neste histórico.')) + '</div></div>' +
      '</div>';

    $('#mant').onclick = () => { mesSel = somaMesJs(r.mes, -1); rota(); };
    $('#mpro').onclick = () => { if (!atual) { const n = somaMesJs(r.mes, 1); mesSel = n >= r.mes_atual ? '' : n; rota(); } };
    $('#atu').onclick = () => rota();
    $('#gerar').onclick = async () => { try { const x = await api('faturas/gerar', { m: 'POST', b: {} }); toast(x.criadas ? x.criadas + ' mensalidade(s) gerada(s)' : 'Nenhuma mensalidade nova para gerar'); rota(); } catch (e) { falha(e); } };
    timerPainel = setInterval(() => { if (!document.hidden && !document.querySelector('.pg-modal-back') && (location.hash || '#/painel').startsWith('#/painel')) rota(); else if (!(location.hash || '#/painel').startsWith('#/painel')) clearInterval(timerPainel); }, 90000);
  }

  // ---------- pedidos ----------
  let filtroPed = '';
  async function pedidos(pg) {
    const lista = await api('leads' + (filtroPed ? '?status=' + filtroPed : ''));
    const chips = [['', 'Todos'], ['novo', 'Novos'], ['proposta', 'Proposta'], ['contratado', 'Contratados'], ['perdido', 'Perdidos']];
    pg.innerHTML = cabeca('Pedidos', 'Escolas que montaram o teste no formulário do site.') +
      `<div class="pg-stack"><div class="pg-chips">${chips.map(([k, t]) => `<button class="pg-chip ${filtroPed === k ? 'on info' : ''}" data-f="${k}">${t}</button>`).join('')}</div>
      <div class="pg-table-wrap"><table class="pg-table"><thead><tr><th>Escola</th><th>Contato</th><th>Alunos</th><th>Módulos</th><th>Recebido em</th><th>Situação</th><th></th></tr></thead><tbody>
      ${lista.map(l => `<tr><td>${escolaCel(l.escola, l.id, E([l.cidade, l.uf].filter(Boolean).join(' / ')))}</td><td>${E(l.contato_nome)}<small><a class="pg-tag wa" target="_blank" rel="noopener" href="${E(waLink(l.contato_tel))}">WhatsApp</a> ${E(l.contato_tel)}</small></td><td>${E(l.resumo.alunos || '—')}</td><td>${l.resumo.modulos || 0}</td><td>${dt(l.criado)}</td><td>${badge(ST_LEAD, l.status)}</td><td class="ac"><button class="pg-btn detail" data-id="${l.id}">Detalhes</button></td></tr>`).join('')}
      </tbody></table>${lista.length ? '' : vazio('Nenhum pedido ainda', 'Divulgue o endereço do site: os pedidos chegam aqui sozinhos.')}</div></div>`;
    pg.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { filtroPed = b.dataset.f; rota(); });
    pg.querySelectorAll('[data-id]').forEach(b => b.onclick = () => detalhePedido(+b.dataset.id));
  }

  async function detalhePedido(id) {
    const [l, planos, cfg] = await Promise.all([api('leads/' + id), api('planos'), api('config')]);
    const c = l.config || {}, ativos = planos.filter(p => p.ativo);
    const m = modal('Pedido de ' + l.escola, `<div class="pg-stack">
      <div style="display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap">${l.logo ? `<img class="ct-logo" src="${E(l.logo)}" alt="Logo enviada">` : ''}<dl class="pg-dl" style="flex:1;min-width:260px">
        <dt>Situação</dt><dd>${badge(ST_LEAD, l.status)}</dd><dt>Contato</dt><dd>${E(l.contato_nome)} · <a target="_blank" rel="noopener" href="${E(waLink(l.contato_tel))}">${E(l.contato_tel)}</a></dd>${l.contato_email ? `<dt>E-mail</dt><dd>${E(l.contato_email)}</dd>` : ''}
        <dt>Cidade</dt><dd>${E([l.cidade, l.uf].filter(Boolean).join(' / ') || '—')}</dd><dt>Recebido</dt><dd>${dt(l.criado)}</dd>
        <dt>Modalidades</dt><dd>${E((c.modalidades || []).join(', ') || '—')}</dd><dt>Alunos</dt><dd>${E(c.alunos || '—')}</dd><dt>Controle atual</dt><dd>${E(c.controle || '—')}</dd><dt>Maior dor</dt><dd>${E(c.dor || '—')}</dd>
        <dt>Módulos</dt><dd>${E((c.modulos || []).join(', ') || '—')}</dd><dt>Cores</dt><dd><span class="ct-pal">${[c.cor, c.cor2].filter(Boolean).map(x => `<i style="background:${E(x)}" title="${E(x)}"></i>`).join('')}</span></dd></dl></div>
      ${c.templates ? `<details><summary class="pg-link">Mensagens de WhatsApp que ela escolheu</summary><div class="pg-stack" style="margin-top:10px">${Object.entries(c.templates).map(([k, v]) => `<div><div class="pg-label">${E(k)}</div><div class="ct-msg">${E(v)}</div></div>`).join('')}</div></details>` : ''}
      <div class="pg-field"><label class="pg-label" for="nt">Anotações</label><textarea class="pg-textarea" id="nt" style="min-height:80px">${E(l.notas)}</textarea></div>
      ${l.contratos.length ? `<div><div class="ct-sec" style="margin-top:0">Contratos deste pedido</div>${l.contratos.map(k => `<div class="pg-check"><span style="flex:1">${E(k.plano_nome)} · ${brl(k.mensal)}/mês · ${dt(k.criado)}</span><span class="pg-badge ${k.status === 'assinado' ? 'ok' : k.status === 'enviado' ? 'warn' : ''}">${E(k.status)}</span><button class="pg-btn detail" data-copia="${location.origin}/contrato?t=${E(k.token)}">Copiar link</button></div>`).join('')}</div>` : ''}
      <div class="pg-card soft" style="background:var(--surface-soft)"><div class="pg-card-title" style="font-size:16px">${I('file')} Criar proposta e contrato</div>
        ${ativos.length || true ? `<div class="ct-two" style="margin-top:12px"><div class="pg-field"><label class="pg-label" for="pl">Plano</label><select class="pg-select" id="pl"><option value="">Valores manuais</option>${ativos.map(p => `<option value="${p.id}" data-m="${p.mensal}" data-i="${p.implantacao}">${E(p.nome)} · ${brl(p.mensal)}/mês</option>`).join('')}</select></div>
        <div class="pg-field"><label class="pg-label" for="pn">Nome do plano no contrato</label><input class="pg-input" id="pn" value="${ativos[0] ? E(ativos[0].nome) : 'Plano Pé na Grama'}"></div>
        <div class="pg-field"><label class="pg-label" for="pm">Mensalidade (R$)</label><input class="pg-input" id="pm" inputmode="decimal" value="${ativos[0] ? fmtIn(ativos[0].mensal) : ''}" placeholder="149,90"></div>
        <div class="pg-field"><label class="pg-label" for="pi">Implantação (R$, uma vez)</label><input class="pg-input" id="pi" inputmode="decimal" value="${ativos[0] ? fmtIn(ativos[0].implantacao) : '0,00'}"></div>
        <div class="pg-field"><label class="pg-label" for="pd">Dia do vencimento</label><input class="pg-input" id="pd" type="number" min="1" max="28" value="${E(cfg.dia_venc_padrao || '10')}"></div></div>
        <div style="margin-top:14px"><button class="pg-btn green" id="criar">${I('send')} Criar proposta</button></div><div id="resp" style="margin-top:14px"></div>` : ''}</div>
      <div class="pg-actions" style="justify-content:space-between"><div class="pg-actions"><button class="pg-btn" id="perd">${l.status === 'perdido' ? 'Reabrir pedido' : 'Marcar como perdido'}</button>${l.contratos.length ? '' : '<button class="pg-btn danger" id="exc">Excluir pedido</button>'}</div><button class="pg-btn green" id="salvar">Salvar anotações</button></div></div>`, (el, fechar) => {
      el.querySelectorAll('[data-copia]').forEach(b => b.onclick = () => copiar(b.dataset.copia));
      const sel = $('#pl', el); if (sel) sel.onchange = () => { const o = sel.selectedOptions[0]; if (o.value) { $('#pn', el).value = o.textContent.split(' · ')[0]; $('#pm', el).value = fmtIn(+o.dataset.m); $('#pi', el).value = fmtIn(+o.dataset.i); } };
      $('#salvar', el).onclick = async () => { try { await api('leads/' + id, { m: 'PATCH', b: { notas: $('#nt', el).value } }); toast('Anotações salvas'); } catch (e) { falha(e); } };
      $('#perd', el).onclick = async () => { try { await api('leads/' + id, { m: 'PATCH', b: { status: l.status === 'perdido' ? 'novo' : 'perdido' } }); fechar(); rota(); } catch (e) { falha(e); } };
      const exc = $('#exc', el); if (exc) exc.onclick = () => { if (exc.dataset.ok) api('leads/' + id, { m: 'DELETE' }).then(() => { toast('Pedido excluído'); fechar(); rota(); }).catch(falha); else { exc.dataset.ok = '1'; exc.textContent = 'Clique de novo para excluir'; setTimeout(() => { exc.dataset.ok = ''; exc.textContent = 'Excluir pedido'; }, 4000); } };
      $('#criar', el).onclick = async () => {
        try {
          const b = { plano_id: sel.value || undefined, plano_nome: $('#pn', el).value, mensal: money($('#pm', el).value), implantacao: money($('#pi', el).value), dia_venc: +$('#pd', el).value };
          if (!b.mensal) return toast('Informe a mensalidade.');
          const r = await api(`leads/${id}/proposta`, { m: 'POST', b });
          const msg = `Olá, ${l.contato_nome}! Segue o contrato do Pé na Grama para a ${l.escola}. É só abrir, conferir e assinar na tela: ${r.link}`;
          $('#resp', el).innerHTML = `<div class="pg-alert ok">Proposta criada. Mande o link para o cliente.</div><div class="ct-copy" style="margin-top:10px"><input class="pg-input" readonly value="${E(r.link)}" aria-label="Link do contrato"><button class="pg-btn" id="cp">${I('copy')} Copiar</button></div>
            <p style="margin-top:10px"><a class="pg-btn ok" target="_blank" rel="noopener" href="${E(waLink(l.contato_tel, msg))}">${I('whats')} Enviar pelo WhatsApp</a></p>`;
          $('#cp', el).onclick = () => copiar(r.link); rota();
        } catch (e) { falha(e); }
      };
    });
    return m;
  }

  // ---------- clientes ----------
  // Endereço do painel admin da escola: só http(s); evita "javascript:" vindo de um campo de texto.
  const painelEscola = (url) => { try { const u = new URL(/^https?:\/\//i.test(url || '') ? url : 'https://' + url); return /^https?:$/.test(u.protocol) && url ? u.origin + '/admin/login' : ''; } catch { return ''; } };
  const btnPainel = (url, sm) => { const h = painelEscola(url); return h ? `<a class="pg-btn green ${sm ? 'detail' : ''}" target="_blank" rel="noopener" href="${E(h)}">${I('link')} Abrir painel da escola</a>` : `<button class="pg-btn ${sm ? 'detail' : ''}" disabled title="Informe o endereço do sistema em Detalhes">Sem endereço</button>`; };

  let buscaCli = '', stCli = '';
  async function clientes(pg) {
    const lista = await api('clientes');
    const ini = iniciais;
    const linha = c => { const feitos = CHECK.filter(k => c.checklist[k]).length, pc = Math.round(feitos / CHECK.length * 100);
      return `<article class="cl-card" data-id="${c.id}" tabindex="0">
        <div class="cl-top"><span class="cl-logo"><b>${ini(c.escola)}</b><img src="/api/admin/clientes/${c.id}/logo" alt="" loading="lazy" onerror="this.remove()"></span>
          <div class="cl-id"><h3>${E(c.escola)}</h3><small>${E(c.contato_nome)}${c.contato_tel ? ' · ' + E(c.contato_tel) : ''}</small></div>
          <div class="cl-st">${badge(ST_CLI, c.status)}${c.atrasadas ? `<span class="pg-badge bad">Em atraso · ${brl(c.valor_atrasado)}</span>` : ''}</div></div>
        <dl class="cl-meta"><div><dt>Plano</dt><dd>${E(c.plano_nome)}</dd></div><div><dt>Mensalidade</dt><dd>${brl(c.mensal)}</dd></div><div><dt>Próxima cobrança</dt><dd>${c.proximo ? dt(c.proximo) : '—'}</dd></div></dl>
        <button class="cl-prog" data-imp="${c.id}" title="Abrir o roteiro de implantação"><div class="pg-track"><i style="width:${pc}%"></i></div><small>${feitos === CHECK.length ? 'Implantada' : 'Implantação · ' + feitos + ' de ' + CHECK.length + ' — continuar'}</small></button>
        <div class="cl-ac">${btnPainel(c.url_sistema, true).replace('Abrir painel da escola', 'Abrir painel')}${c.url_sistema ? `<button class="pg-btn detail" data-ctl="${c.id}">${I('settings')} Controle</button>` : ''}<button class="pg-btn detail danger-txt" data-del="${c.id}" title="Excluir a escola e todos os dados dela">${I('trash')} Excluir</button><button class="pg-btn detail" data-det="${c.id}">Detalhes</button></div></article>`; };
    pg.innerHTML = cabeca('Clientes', 'Escolas que assinaram o contrato e o andamento de cada uma.') +
      (lista.length ? `<div class="ct-find"><input class="pg-input" id="cb" type="search" placeholder="Buscar escola ou contato…" aria-label="Buscar cliente" value="${E(buscaCli)}"><select class="pg-select" id="cs" aria-label="Filtrar por situação"><option value="">Todas as situações</option>${Object.entries(ST_CLI).map(([k, v]) => `<option value="${k}" ${stCli === k ? 'selected' : ''}>${v[0]}</option>`).join('')}<option value="atraso" ${stCli === 'atraso' ? 'selected' : ''}>Com fatura em atraso</option></select><span class="n" id="cn" aria-live="polite"></span></div>` : '') +
      `<div class="cl-grid" id="cl"></div>${lista.length ? '' : vazio('Nenhum cliente ainda', 'Quando uma escola assinar o contrato, ela aparece aqui já com a primeira fatura.')}<div id="cv"></div>`;
    const desenha = () => {
      const q = buscaCli.trim().toLowerCase(), v = lista.filter(c => (!q || (c.escola + ' ' + c.contato_nome + ' ' + c.contato_tel).toLowerCase().includes(q)) && (!stCli || (stCli === 'atraso' ? c.atrasadas > 0 : c.status === stCli)));
      $('#cl', pg).innerHTML = v.map(linha).join('');
      const n = $('#cn', pg); if (n) n.textContent = v.length + ' de ' + lista.length + ' escola(s)';
      $('#cv', pg).innerHTML = lista.length && !v.length ? vazio('Nenhuma escola encontrada', 'Mude a busca ou o filtro de situação.') : '';
      pg.querySelectorAll('[data-imp]').forEach(b => b.onclick = e => { e.stopPropagation(); implantar(+b.dataset.imp).catch(falha); });
      pg.querySelectorAll('[data-det]').forEach(b => b.onclick = e => { e.stopPropagation(); detalheCliente(+b.dataset.det); });
      pg.querySelectorAll('[data-del]').forEach(b => b.onclick = async e => {
        e.stopPropagation(); const c = lista.find(x => x.id === +b.dataset.del); if (!c) return;
        const v = await confirma('Excluir ' + c.escola + '?', 'Isso apaga a escola, o sistema dela, os alunos, usuários, faturas e cobranças. Não dá para desfazer. Para confirmar, digite o nome da escola.', 'Excluir para sempre', true, '<input class="pg-input" style="margin-top:6px" placeholder="' + E(c.escola) + '" aria-label="Nome da escola para confirmar" autocomplete="off">');
        if (!v) return; if (String(v).trim() !== String(c.escola).trim()) { toast('O nome digitado não confere. Nada foi excluído.', 'err'); return; }
        b.disabled = true; try { await api('clientes/' + c.id, { m: 'DELETE', b: { confirmar: String(v).trim() } }); toast('Escola excluída.'); lista.splice(lista.indexOf(c), 1); desenha(); } catch (x) { falha(x); b.disabled = false; }
      });
      pg.querySelectorAll('[data-ctl]').forEach(b => b.onclick = async e => { e.stopPropagation(); const c = lista.find(x => x.id === +b.dataset.ctl); b.disabled = true; try { await controleEscola(c); } finally { b.disabled = false; } });
      pg.querySelectorAll('.cl-card').forEach(tr => { const abre = e => { if (e.target.closest('a,button')) return; detalheCliente(+tr.dataset.id); }; tr.onclick = abre; tr.onkeydown = e => { if (e.key === 'Enter' && e.target === tr) detalheCliente(+tr.dataset.id); }; });
    };
    const cb = $('#cb', pg); if (cb) { cb.oninput = () => { buscaCli = cb.value; desenha(); }; $('#cs', pg).onchange = e => { stCli = e.target.value; desenha(); }; }
    desenha();
  }


  // Assistente de implantação: uma pergunta por tela; a resposta já executa o passo e marca o checklist.
  async function implantar(id) {
    const c = await api('clientes/' + id), feitos = { ...c.checklist };
    const base = location.hostname.split('.').slice(1).join('.');
    const slug = String(c.escola).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
    const [saude, dom, ctl] = c.url_sistema ? await Promise.all([api('clientes/' + id + '/saude').catch(() => null), api('clientes/' + id + '/dominio').catch(() => null), api('clientes/' + id + '/controle').catch(() => null)]) : [null, null, null];
    if (saude && saude.usuarios > 0) feitos[CHECK[0]] = true;
    if (dom && dom.estado === 'ok') feitos[CHECK[2]] = true;
    if (saude && saude.matriculas > 0) feitos[CHECK[5]] = true;
    const grava = () => api('clientes/' + id, { m: 'PATCH', b: { checklist: feitos } }).catch(falha);
    const marca = (k, v) => { feitos[k] = v; return grava(); };
    const abrePainel = async () => { const w = window.open('', '_blank'); try { const r = await api('clientes/' + id + '/entrar', { m: 'POST', b: {} }); if (w) w.location = r.url; else toast('Libere pop-ups para abrir a escola.', 'err'); } catch (e) { if (w) w.close(); falha(e); } };
    const COR = [['cor_primaria', 'Primária', '#00a63a'], ['cor_secundaria', 'Secundária', '#17428f'], ['cor_escura', 'Escura', '#09245c'], ['cor_destaque', 'Destaque', '#f4c20d']];
    const op = (v, t, d) => ({ v, t, d });
    // Cada passo: pergunta, opções (ou campo), e a função que executa a resposta. Devolve true para avançar.
    const PASSOS = [
      { k: CHECK[2], t: 'Endereço', q: 'Em que endereço a escola vai usar o sistema?', ja: () => feitos[CHECK[2]] ? 'A escola já está no ar em ' + E(c.url_sistema) : '',
        campo: () => c.url_sistema ? `<p>Endereço definido: <b>${E(c.url_sistema)}</b>. Falta colocar no ar.</p>` : `<label class="pg-label" for="w1">Nome do endereço</label><div class="imp-url"><input class="pg-input" id="w1" value="${E(slug)}" autocomplete="off" spellcheck="false"><span>.${E(base)}</span></div>`,
        botao: 'Colocar no ar', aplica: async el => {
          let url = c.url_sistema;
          if (!url) { const s = ($('#w1', el).value || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, ''); if (!s) { toast('Digite o nome do endereço.', 'err'); return false; } url = `https://${s}.${base}`; await api('clientes/' + id, { m: 'PATCH', b: { url_sistema: url } }); c.url_sistema = url; }
          const r = await api('clientes/' + id + '/publicar', { m: 'POST', b: {} });
          if (!r.ok) { toast(r.motivo || 'Não foi possível publicar agora.', 'err'); return false; }
          await marca(CHECK[2], true); toast('Endereço no ar'); return true; } },
      { k: CHECK[0], t: 'Acesso', q: 'Qual e-mail o administrador da escola vai usar para entrar?', ja: () => '',
        campo: () => `<label class="pg-label" for="w2">E-mail do administrador</label><input class="pg-input" id="w2" type="email" value="${E(c.contato_email || '')}" placeholder="nome@escola.com.br">` + (feitos[CHECK[0]] ? '<p class="imp-note">Esta escola já tem acesso criado. Gerar de novo troca a senha atual.</p>' : '') + '<div id="w2r"></div>',
        botao: feitos[CHECK[0]] ? 'Gerar nova senha' : 'Criar acesso', pular: feitos[CHECK[0]], aplica: async el => {
          if (el.dataset.res) return true;
          const em = ($('#w2', el).value || '').trim(); if (em && em !== c.contato_email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em) && !feitos[CHECK[0]]) { await api('clientes/' + id, { m: 'PATCH', b: { contato_email: em } }); c.contato_email = em; }
          const r = await api('clientes/' + id + '/acesso', { m: 'POST', b: {} }); await marca(CHECK[0], true);
          const msg = `Olá, ${c.contato_nome}! Seu acesso ao sistema da ${c.escola}: ${r.url}\nE-mail: ${r.email}\nSenha: ${r.senha}`;
          $('#w2r', el).innerHTML = `<div class="pg-alert ok" style="margin-top:12px">Anote agora, a senha não aparece de novo.<br>E-mail: <b>${E(r.email)}</b><br>Senha: <b>${E(r.senha)}</b></div><p style="margin-top:10px"><a class="pg-btn ok" target="_blank" rel="noopener" href="${E(waLink(c.contato_tel, msg))}">${I('whats')} Enviar pelo WhatsApp</a></p>`;
          el.dataset.res = '1'; $('[data-go]', el).textContent = 'Continuar'; return false; } },
      { k: CHECK[1], t: 'Marca', q: 'Como ficam as cores e a logo da escola?', ja: () => '',
        opcoes: [op('cores', 'Escolher as cores agora', 'Você define as 4 cores do sistema aqui mesmo.'), op('logo', 'Gerar as cores a partir da logo', 'Abre o Controle: troque a logo e clique em "Aplicar paleta da logo".'), op('padrao', 'Manter as cores padrão do Pé na Grama', 'Dá para mudar depois, a qualquer hora.')],
        extra: v => v === 'cores' ? `<div class="imp-cores">${COR.map(([k, r, d]) => `<label><span>${r}</span><input type="color" data-cor="${k}" value="${E((ctl && ctl.valores && ctl.valores[k]) || d)}"></label>`).join('')}</div>` : '',
        aplica: async (el, v) => {
          if (!c.url_sistema) { toast('Defina o endereço primeiro.', 'err'); return false; }
          if (v === 'cores') { const valores = {}; el.querySelectorAll('[data-cor]').forEach(x => valores[x.dataset.cor] = x.value); await api('clientes/' + id + '/controle', { m: 'PUT', b: { valores } }); toast('Cores aplicadas na escola'); }
          if (v === 'logo') controleEscola(c);
          await marca(CHECK[1], true); return true; } },
      { k: CHECK[3], t: 'WhatsApp', q: 'O WhatsApp da escola já está conectado?', ja: () => '',
        opcoes: [op('sim', 'Sim, já está conectado', ''), op('agora', 'Vou conectar agora com a escola', 'Abre o painel da escola em Mensagens para ler o QR Code.'), op('depois', 'Deixar para depois', 'Fica pendente no roteiro.')],
        aplica: async (el, v) => { if (v === 'agora') await abrePainel(); await marca(CHECK[3], v !== 'depois'); return true; } },
      { k: CHECK[4], t: 'Pix', q: 'A chave Pix da escola já está configurada?', ja: () => '',
        opcoes: [op('sim', 'Sim, já está configurada', ''), op('agora', 'Vou configurar agora', 'Abre o painel da escola; a chave fica em Configurações.'), op('depois', 'Deixar para depois', 'Fica pendente no roteiro.')],
        aplica: async (el, v) => { if (v === 'agora') await abrePainel(); await marca(CHECK[4], v !== 'depois'); return true; } },
      { k: CHECK[5], t: 'Alunos', q: 'Como os alunos vão entrar no sistema?', ja: () => feitos[CHECK[5]] ? `A escola já tem ${saude.matriculas} aluno(s) cadastrado(s).` : '',
        opcoes: [op('sozinha', 'A própria escola cadastra', 'Ela usa o formulário de matrícula e o cadastro do painel.'), op('eu', 'Eu importo para ela', 'Abre o painel da escola para você cadastrar ou importar.'), op('depois', 'Decidir depois', 'Fica pendente no roteiro.')],
        aplica: async (el, v) => { if (v === 'eu') await abrePainel(); await marca(CHECK[5], v !== 'depois'); return true; } },
      { k: CHECK[6], t: 'Treinamento', q: 'Como será o treinamento da escola?', ja: () => '',
        opcoes: [op('feito', 'Já fiz o treinamento', ''), op('agendar', 'Agendar com a escola', 'Escolha o dia e abro o WhatsApp com a mensagem pronta.'), op('depois', 'Decidir depois', 'Fica pendente no roteiro.')],
        extra: v => v === 'agendar' ? '<label class="pg-label" for="w7" style="margin-top:12px">Data e hora</label><input class="pg-input" id="w7" type="datetime-local">' : '',
        aplica: async (el, v) => {
          if (v === 'agendar') { const d = $('#w7', el).value; if (!d) { toast('Escolha a data e a hora.', 'err'); return false; } const q = new Date(d); const txt = q.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }) + ' às ' + q.toTimeString().slice(0, 5); window.open(waLink(c.contato_tel, `Olá, ${c.contato_nome}! Podemos fazer o treinamento do sistema da ${c.escola} na ${txt}?`), '_blank', 'noopener'); }
          await marca(CHECK[6], v === 'feito'); return true; } }
    ];
    modal('Implantar · ' + c.escola, '<div id="imp"></div>', (el, fechar) => {
      const box = $('#imp', el); let n = Math.max(0, PASSOS.findIndex(p => !feitos[p.k])), esc = {};
      const fim = () => { const ok = CHECK.filter(k => feitos[k]).length;
        box.innerHTML = `<div class="imp-dots">${PASSOS.map(() => '<i class="on"></i>').join('')}</div><h3 class="imp-q">${ok === CHECK.length ? 'Tudo pronto!' : 'Quase lá'}</h3><p class="imp-note">${ok} de ${CHECK.length} passos concluídos.</p>
          <ul class="imp-sum">${PASSOS.map(p => `<li class="${feitos[p.k] ? 'ok' : ''}"><span>${feitos[p.k] ? '✓' : '○'}</span>${E(p.k)}</li>`).join('')}</ul>
          <div class="imp-nav"><button class="pg-btn" data-v>Revisar passos</button>${c.status !== 'ativo' ? '<button class="pg-btn green" data-ativa>Marcar escola como ativa</button>' : '<button class="pg-btn green" data-ok>Concluir</button>'}</div>`;
        $('[data-v]', box).onclick = () => { n = 0; pinta(); };
        const a = $('[data-ativa]', box); if (a) a.onclick = async () => { try { await api('clientes/' + id, { m: 'PATCH', b: { status: 'ativo' } }); toast('Escola marcada como ativa'); fechar(); rota(); } catch (e) { falha(e); } };
        const o = $('[data-ok]', box); if (o) o.onclick = () => { fechar(); rota(); }; };
      const pinta = () => {
        if (n >= PASSOS.length) return fim();
        const p = PASSOS[n], ja = p.ja ? p.ja() : '', v = esc[n] || (p.opcoes ? p.opcoes[0].v : '');
        box.innerHTML = `<div class="imp-dots">${PASSOS.map((_, i) => `<i class="${i < n ? 'on' : i === n ? 'now' : ''}"></i>`).join('')}</div><small class="imp-step-n">Passo ${n + 1} de ${PASSOS.length} · ${E(p.t)}</small><h3 class="imp-q">${E(p.q)}</h3>
          ${ja ? `<div class="pg-alert ok">${ja}</div>` : ''}
          ${p.opcoes ? `<div class="imp-ops" role="radiogroup">${p.opcoes.map(o => `<label class="imp-op ${o.v === v ? 'sel' : ''}"><input type="radio" name="op" value="${o.v}" ${o.v === v ? 'checked' : ''}><span><b>${E(o.t)}</b>${o.d ? `<small>${E(o.d)}</small>` : ''}</span></label>`).join('')}</div><div id="ex">${p.extra ? p.extra(v) : ''}</div>` : (p.campo ? p.campo() : '')}
          <div class="imp-nav">${n ? '<button class="pg-btn" data-volta>Voltar</button>' : '<span></span>'}<span class="imp-right">${ja || p.pular ? '<button class="pg-btn" data-pula>Pular</button>' : ''}<button class="pg-btn green" data-go>${ja && !p.opcoes && !p.campo ? 'Continuar' : (p.botao || 'Continuar')}</button></span></div>`;
        box.querySelectorAll('[name=op]').forEach(r => r.onchange = () => { esc[n] = r.value; if (p.extra) { const cores = {}; box.querySelectorAll('[data-cor]').forEach(x => cores[x.dataset.cor] = x.value); $('#ex', box).innerHTML = p.extra(r.value); Object.entries(cores).forEach(([k, val]) => { const x = box.querySelector(`[data-cor="${k}"]`); if (x) x.value = val; }); } box.querySelectorAll('.imp-op').forEach(l => l.classList.toggle('sel', l.querySelector('input').checked)); });
        const vb = $('[data-volta]', box); if (vb) vb.onclick = () => { n--; pinta(); };
        const pu = $('[data-pula]', box); if (pu) pu.onclick = () => { n++; pinta(); };
        const go = $('[data-go]', box); go.onclick = async () => {
          if (box.dataset.res === '1' || $('#w2r', box) && $('#w2r', box).innerHTML) { n++; return pinta(); }
          go.disabled = true;
          try { const sel = (box.querySelector('[name=op]:checked') || {}).value; const r = await p.aplica(box, sel); if (r) { n++; pinta(); } } catch (e) { falha(e); } finally { go.disabled = false; }
        };
      };
      pinta();
    });
  }

  async function detalheCliente(id) {
    const c = await api('clientes/' + id);
    modal(c.escola, `<div class="pg-stack"><div style="display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap">${c.logo ? `<img class="ct-logo" src="${E(c.logo)}" alt="Logo">` : ''}<dl class="pg-dl" style="flex:1;min-width:260px">
      <dt>Contato</dt><dd>${E(c.contato_nome)} · <a target="_blank" rel="noopener" href="${E(waLink(c.contato_tel))}">${E(c.contato_tel)}</a></dd>${c.contato_email ? `<dt>E-mail</dt><dd>${E(c.contato_email)}</dd>` : ''}
      <dt>Desde</dt><dd>${dt(c.criado)}</dd>${c.contrato ? `<dt>Contrato</dt><dd>Assinado por ${E(c.contrato.ass_nome)} (doc. ${E(c.contrato.ass_doc)}) em ${dt(c.contrato.assinado_em)}<br><small style="color:var(--medium-gray)">Código de verificação: ${E((c.contrato.ass_hash || '').slice(0, 24))}…</small></dd>` : ''}</dl></div>
      <div class="ct-two"><div class="pg-field"><label class="pg-label" for="st">Situação</label><select class="pg-select" id="st">${Object.entries(ST_CLI).map(([k, v]) => `<option value="${k}" ${c.status === k ? 'selected' : ''}>${v[0]}</option>`).join('')}</select></div>
        <div class="pg-field"><label class="pg-label" for="ur">Endereço do sistema dela</label><input class="pg-input" id="ur" value="${E(c.url_sistema)}" placeholder="https://escola.penagrama.com.br"><div style="margin-top:8px">${btnPainel(c.url_sistema)}</div></div>
        <div class="pg-field"><label class="pg-label" for="mn">Mensalidade (R$)</label><input class="pg-input" id="mn" inputmode="decimal" value="${fmtIn(c.mensal)}"></div>
        <div class="pg-field"><label class="pg-label" for="dv">Dia do vencimento</label><input class="pg-input" id="dv" type="number" min="1" max="28" value="${c.dia_venc}"></div></div>
      ${c.url_sistema ? `<div><div class="ct-sec" style="margin-top:0">Sistema da escola</div><div id="saude" class="pg-alert" style="margin-bottom:10px">Carregando situação…</div>
        <div class="ct-two"><div class="pg-field"><label class="pg-label" for="lm">Limite de matrículas (0 = sem limite)</label><div class="ct-copy"><input class="pg-input" id="lm" type="number" min="0" value="0"><button class="pg-btn" id="lmb">Salvar limite</button></div></div>
        <div class="pg-field"><label class="pg-label">Acesso do administrador</label><button class="pg-btn" id="acesso">Gerar acesso do administrador</button></div></div>
        <div class="ct-cta"><div><b>Controle total da escola</b><span>127 opções: módulos, marca, limites, segurança, usuários e dados desta escola.</span></div><button class="pg-btn" id="ctl">Abrir controle</button></div>
        <div class="pg-field"><label class="pg-label">Endereço no ar</label><div class="ct-copy"><span id="dom" style="flex:1;align-self:center">Verificando…</span><button class="pg-btn" id="pub">Publicar endereço</button></div></div><div class="pg-field"><label class="pg-label">Cópias de segurança (automáticas, 1 por dia; ficam as 7 mais recentes)</label><div id="bks" style="margin-bottom:8px">Carregando…</div><button class="pg-btn" id="bkn">Fazer cópia agora</button></div><div id="acessoRes"></div></div>` : ''}
      <div><div class="ct-sec" style="margin-top:0">Implantação</div>${CHECK.map(k => `<label class="pg-check ${c.checklist[k] ? 'done' : ''}"><input type="checkbox" data-ck="${E(k)}" ${c.checklist[k] ? 'checked' : ''}><span>${E(k)}</span></label>`).join('')}</div>
      <div class="pg-field"><label class="pg-label" for="nt">Anotações</label><textarea class="pg-textarea" id="nt" style="min-height:80px">${E(c.notas)}</textarea></div>
      <div><div class="ct-sec" style="margin-top:0;display:flex;justify-content:space-between;align-items:center"><span>Faturas</span><button class="pg-btn sm" id="nova">${I('plus')} Cobrança avulsa</button></div>
        <div class="pg-table-wrap"><table class="pg-table"><thead><tr><th>Descrição</th><th>Vence</th><th class="num">Valor</th><th>Situação</th><th></th></tr></thead><tbody>${c.faturas.map(f => `<tr><td>${E(f.descricao)}</td><td>${dt(f.vencimento)}</td><td class="num">${brl(f.valor)}</td><td>${badge(ST_FAT, f.status)}</td><td class="ac">${f.status === 'aberta' || f.status === 'informada' ? `<button class="pg-btn detail" data-paga="${f.id}">Marcar paga</button> ` : ''}<button class="pg-btn detail" data-copia="${location.origin}/fatura?t=${E(f.token)}">Copiar link</button></td></tr>`).join('')}</tbody></table></div></div>
      <div class="ct-foot"><button class="pg-btn green" id="salvar">Salvar alterações</button></div></div>`, (el, fechar) => {
      el.querySelectorAll('[data-copia]').forEach(b => b.onclick = () => copiar(b.dataset.copia));
      el.querySelectorAll('[data-paga]').forEach(b => b.onclick = async () => { try { await api('faturas/' + b.dataset.paga, { m: 'PATCH', b: { status: 'paga' } }); toast('Fatura marcada como paga'); fechar(); rota(); } catch (e) { falha(e); } });
      $('#nova', el).onclick = () => cobrancaAvulsa(c, fechar);
      if (c.url_sistema) {
        api('clientes/' + id + '/saude').then(s => { $('#saude', el).innerHTML = `<b>${s.matriculas}</b> matrícula(s)${s.limite ? ` de ${s.limite}` : ''} · <b>${s.usuarios}</b> usuário(s) · ${s.kb} KB de dados · última ação: ${s.ultima_acao ? E(s.ultima_acao.quando.slice(0, 16).replace('T', ' ')) + ' (' + E(s.ultima_acao.quem) + ')' : 'nenhuma ainda'}`; $('#lm', el).value = s.limite; }).catch(() => { $('#saude', el).textContent = 'Sem dados ainda (sistema sem uso ou fora do ar).'; });
        const estadoDom = () => api('clientes/' + id + '/dominio').then(d => { $('#dom', el).textContent = d.estado === 'ok' ? 'Publicado (' + d.host + ')' : d.estado + (d.chave_configurada ? '' : ' · chave do Cloudflare não configurada'); }).catch(() => { $('#dom', el).textContent = 'Não consegui verificar.'; });
        estadoDom();
        const listaBk = () => api('clientes/' + id + '/backups').then(r => { $('#bks', el).innerHTML = r.lista.length ? r.lista.map(b => `<div style="display:flex;gap:10px;align-items:center;margin:4px 0"><span style="flex:1">${E(b.quando.slice(0, 16).replace('T', ' '))} UTC · ${Math.round(b.bytes / 1024)} KB</span><button class="pg-btn detail" data-rest="${E(b.quando)}">Restaurar</button></div>`).join('') : 'Nenhuma ainda. A primeira sai em até 24 horas.'; $('#bks', el).querySelectorAll('[data-rest]').forEach(x => x.onclick = async () => { if (!(await confirma('Restaurar esta cópia?', 'Os dados atuais da escola são substituídos pelos desta cópia. Antes disso, o estado de agora também é guardado como cópia.', 'Restaurar', true))) return; try { const r2 = await api('clientes/' + id + '/restaurar', { m: 'POST', b: { quando: x.dataset.rest, confirmar: true } }); toast('Restaurado (' + r2.docs + ' registros)'); listaBk(); } catch (e) { falha(e); } }); }).catch(() => { $('#bks', el).textContent = 'Não consegui listar.'; });
        listaBk();
        $('#bkn', el).onclick = async () => { try { await api('clientes/' + id + '/backup', { m: 'POST', b: {} }); toast('Cópia feita'); listaBk(); } catch (e) { falha(e); } };
        $('#pub', el).onclick = async () => { try { const r = await api('clientes/' + id + '/publicar', { m: 'POST', b: {} }); if (r.ok) toast('Endereço publicado'); else alert(r.motivo); estadoDom(); } catch (e) { falha(e); } };
        $('#ctl', el).onclick = () => controleEscola(c);
        $('#lmb', el).onclick = async () => { try { await api('clientes/' + id + '/limite', { m: 'PUT', b: { max: +$('#lm', el).value || 0 } }); toast('Limite salvo'); } catch (e) { falha(e); } };
        $('#acesso', el).onclick = async () => { if (!(await confirma('Gerar novo acesso?', 'A senha anterior do administrador da escola deixa de valer. A nova aparece uma única vez.', 'Gerar acesso', true))) return; try { const r = await api('clientes/' + id + '/acesso', { m: 'POST', b: {} }); $('#acessoRes', el).innerHTML = `<div class="pg-alert ok" style="margin-top:10px">Anote agora, a senha não aparece de novo.<br>Endereço: <b>${E(r.url)}</b><br>E-mail: <b>${E(r.email)}</b><br>Senha: <b>${E(r.senha)}</b></div>`; } catch (e) { falha(e); } };
      }
      $('#salvar', el).onclick = async () => {
        const checklist = {}; el.querySelectorAll('[data-ck]').forEach(i => checklist[i.dataset.ck] = i.checked);
        try { await api('clientes/' + id, { m: 'PATCH', b: { status: $('#st', el).value, url_sistema: $('#ur', el).value, mensal: money($('#mn', el).value), dia_venc: +$('#dv', el).value, notas: $('#nt', el).value, checklist } }); toast('Cliente salvo'); fechar(); rota(); } catch (e) { falha(e); } };
    }, { wide: true });
  }
  const ATALHO_TXT = { 'suspensa:true': 'O endereço da escola sai do ar e mostra a mensagem de suspensão.', 'suspensa:false': 'A escola volta ao ar.', 'manutencao:true': 'Só administradores conseguem entrar enquanto durar.', 'manutencao:false': 'Todos voltam a entrar.', 'somente_leitura:true': 'Ninguém consegue gravar nada até você liberar.', 'somente_leitura:false': 'A gravação volta ao normal.' };
  // ---------- controle total da escola (dono master) ----------
  // ---- logo e paleta ----
  const hsl = (r, g, b) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0; if (mx !== mn) { const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; } return [h, s, l]; };
  const hex = (h, s, l) => { h = ((h % 360) + 360) % 360; const a = s * Math.min(l, 1 - l), f = n => { const k = (n + h / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, '0'); }; return '#' + f(0) + f(8) + f(4); };
  const dist = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
  const carregaImg = src => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('Não consegui ler essa imagem.')); i.src = src; });
  // Reduz a imagem (a logo vai no banco, então tem limite de tamanho) e mantém a transparência do PNG.
  async function logoDeArquivo(f) {
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) throw new Error('Use uma imagem PNG, JPEG ou WebP.');
    const url = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => no(new Error('Não consegui abrir o arquivo.')); r.readAsDataURL(f); });
    const img = await carregaImg(url);
    for (const max of [640, 480, 320]) {
      const k = Math.min(1, max / Math.max(img.width, img.height)), cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(img.width * k)); cv.height = Math.max(1, Math.round(img.height * k));
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      const out = cv.toDataURL(f.type === 'image/jpeg' ? 'image/jpeg' : 'image/png', .88);
      if (out.length < 600000) return out;
    }
    throw new Error('A imagem é pesada demais. Use uma menor.');
  }
  // Paleta a partir dos pixels: agrupa por cor, ignora fundo branco/transparente e escolhe 4 papéis com contraste para texto branco.
  async function paletaDaLogo(src) {
    const img = await carregaImg(src), cv = document.createElement('canvas'), N = 72; cv.width = cv.height = N;
    const cx = cv.getContext('2d', { willReadFrequently: true }); const k = Math.min(N / img.width, N / img.height); cx.drawImage(img, 0, 0, img.width * k, img.height * k);
    const px = cx.getImageData(0, 0, N, N).data, grupos = new Map();
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] < 140) continue; const [h, sa, l] = hsl(px[i], px[i + 1], px[i + 2]); if (l > .93 || l < .06) continue;
      const kk = Math.round(h / 12) + '_' + Math.round(sa * 4) + '_' + Math.round(l * 4), g = grupos.get(kk) || { n: 0, h: 0, s: 0, l: 0 }; g.n++; g.h += h; g.s += sa; g.l += l; grupos.set(kk, g);
    }
    const cores = [...grupos.values()].map(g => ({ h: g.h / g.n, s: g.s / g.n, l: g.l / g.n, n: g.n })).map(c => ({ ...c, peso: c.n * (.25 + c.s) * (c.l > .15 && c.l < .85 ? 1 : .4) })).sort((a, b) => b.peso - a.peso);
    if (!cores.length) throw new Error('Não achei cores nessa imagem (talvez seja só branca ou transparente).');
    const vivas = cores.filter(c => c.s > .22), base = vivas.length ? vivas : cores;
    const p = base[0], sat = x => Math.max(.45, Math.min(.95, x)), real = base.find(c => dist(c.h, p.h) > 28);
    // Logo de uma cor só (ex.: vermelho com branco): a secundária e a escura são tons escuros da própria cor; o destaque é dourado (ou azul-marinho se a cor já for amarela).
    const sec = real || { h: p.h, s: Math.max(.5, p.s), l: .26 }, dest = base.find(c => dist(c.h, p.h) > 35 && dist(c.h, sec.h) > 35) || (dist(p.h, 46) < 32 ? { h: 220, s: .7, l: .5 } : { h: 46, s: .92, l: .5 });
    return { cor_primaria: hex(p.h, sat(p.s), Math.min(.42, Math.max(.28, p.l))), cor_secundaria: hex(sec.h, sat(sec.s), Math.min(.34, Math.max(.2, sec.l))), cor_escura: hex(sec.h, Math.min(.85, sat(sec.s)), .14), cor_destaque: hex(dest.h, sat(dest.s), Math.min(.58, Math.max(.46, dest.l))) };
  }
  const ROT_COR = { cor_primaria: 'Primária', cor_secundaria: 'Secundária', cor_escura: 'Escura', cor_destaque: 'Destaque' };

  async function controleEscola(c) {
    const id = c.id, base = 'clientes/' + id + '/';
    let ctl; try { ctl = await api(base + 'controle'); } catch (e) { return falha(e); }
    let planosAtivos = []; try { planosAtivos = (await api('planos')).filter(p => p.ativo); } catch { /* sem planos */ }
    let logoAtual = ''; try { logoAtual = (await api('clientes/' + id)).logo || ''; } catch { /* sem logo */ }
    let logoPend = null, paleta = null;
    const grupos = [...new Set(ctl.catalogo.map(o => o.g))], mudou = {}, internoMud = {};
    const PERIGO = k => /^(suspensa|manutencao|somente_leitura|bloq_)/.test(k);
    const padrao = o => o.d, difere = o => ctl.valores[o.k] !== padrao(o);
    const atual = o => (o.k in mudou ? mudou[o.k] : ctl.valores[o.k]);
    const nMud = () => Object.keys(mudou).length + Object.keys(internoMud).length;
    const campo = o => {
      const v = atual(o), k = E(o.k), aj = o.a ? `<span class="help">${E(o.a)}</span>` : '';
      if (o.t === 'bool') return `<label class="ct-sw ${PERIGO(o.k) ? 'danger' : ''}"><input type="checkbox" data-k="${k}" ${v ? 'checked' : ''}><span>${E(o.r)}</span></label>${aj}`;
      const rot = `<label class="pg-label" for="k_${k}">${E(o.r)}</label>`;
      const ent = o.t === 'num' ? `<input class="pg-input" id="k_${k}" type="number" inputmode="numeric" min="0" data-k="${k}" value="${E(v)}">`
        : o.t === 'cor' ? `<div class="ct-colorrow"><input type="color" id="k_${k}" data-k="${k}" value="${E(v)}"><code>${E(v)}</code></div>`
        : o.t === 'sel' ? `<select class="pg-select" id="k_${k}" data-k="${k}">${o.o.map(x => `<option value="${E(x[0])}" ${v === x[0] ? 'selected' : ''}>${E(x[1])}</option>`).join('')}</select>`
        : `<input class="pg-input" id="k_${k}" data-k="${k}" value="${E(v)}" placeholder="${E(o.a || '')}" maxlength="400">`;
      return rot + ent + (o.t === 'txt' ? '' : aj || (o.t === 'num' && o.d === 0 ? '<span class="help">0 = sem limite</span>' : ''));
    };
    const caixaLogo = () => `<div class="ct-logobox" id="logoBox" data-gi="g${grupos.indexOf('Marca e aparência')}"><div class="lg-prev" id="lgPrev"></div><div class="lg-body"><b>Logo da escola</b><p>Aparece no menu, nos documentos e no ícone do aplicativo. PNG, JPEG ou WebP; fundo transparente fica melhor.</p><div class="lg-btns"><input type="file" id="lgFile" accept="image/png,image/jpeg,image/webp" hidden><button class="pg-btn" id="lgEsc">Trocar logo</button><button class="pg-btn green" id="lgSalva" hidden>Salvar logo</button><button class="pg-btn" id="lgCanc" hidden>Cancelar</button></div><div id="lgPal"></div></div></div>`;
    const opcao = o => `<div class="ct-op" data-op="${E(o.k)}" data-txt="${E((o.r + ' ' + (o.a || '')).toLowerCase())}">${campo(o)}<span class="ct-tags"></span></div>`;
    const CURTO = { 'Módulos do painel da escola': 'Módulos do painel', 'Portais de pais e professores': 'Portais', 'Estado da escola': 'Estado', 'Avisos na tela': 'Avisos', 'Marca e aparência': 'Marca', 'Limites do plano': 'Limites', 'Segurança e senhas': 'Segurança', 'Permissões do administrador da escola': 'Permissões' };
    const META = {
      'Módulos do painel da escola': ['pie', 'Desligou, a tela some do menu e o endereço fica bloqueado para todos os administradores da escola.'],
      'Portais de pais e professores': ['cap', 'Escolha as telas liberadas nos portais do responsável e do professor.'],
      'Estado da escola': ['alert', 'Suspender, pôr em manutenção, travar gravações ou fechar portas específicas. Vale na hora.'],
      'Avisos na tela': ['inbox', 'Faixa no topo e recados em telas específicas, com texto e cor definidos por você.'],
      'Marca e aparência': ['tag', 'Cores, letras, rodapé, botão de WhatsApp e outros detalhes de aparência.'],
      'Limites do plano': ['chart', 'Máximos de cadastros, usuários, armazenamento e envios. Em todos os limites, 0 significa sem limite.'],
      'Segurança e senhas': ['check', 'Regras de acesso: tentativas, duração da sessão, tamanho de senha e primeiro acesso.'],
      'Permissões do administrador da escola': ['settings', 'Tire poderes específicos do administrador da escola. Você continua podendo tudo pela Central.'],
      usuarios: ['users', 'Crie, bloqueie, troque o papel ou gere nova senha.'], dados: ['file', 'O que há guardado e o registro de ações.'], whatsapp: ['whats', 'Servidor, instância e número de WhatsApp desta escola.'],
      ficha: ['pencil', 'Anotações só suas. Nada daqui aparece para a escola.'], acoes: ['send', 'Entrar como a escola, mudar o estado e encerrar sessões.']
    };
    const tabs = [...grupos.map((g, i) => ['g' + i, CURTO[g] || g, ctl.catalogo.filter(o => o.g === g).length, META[g][0], g]), ['usuarios', 'Usuários', 0, META.usuarios[0], 'usuarios'], ['dados', 'Dados e registro', 0, META.dados[0], 'dados'], ['whatsapp', 'WhatsApp', 0, META.whatsapp[0], 'whatsapp'], ['ficha', 'Ficha interna', 0, META.ficha[0], 'ficha'], ['acoes', 'Ações', 0, META.acoes[0], 'acoes']];
    const grupoDe = Object.fromEntries(ctl.catalogo.map(o => [o.k, 'g' + grupos.indexOf(o.g)]));
    const soBool = g => ctl.catalogo.filter(o => o.g === g).every(o => o.t === 'bool');
    let aberta = 'g0';
    modal('Controle total · ' + c.escola, `<div class="ct-shell"><nav class="ct-rail" role="tablist" aria-label="Seções do controle" aria-orientation="vertical">${tabs.map(([k, r, n, ic], i) => (i === grupos.length ? '<span class="ct-rsep">Gestão</span>' : i === 0 ? '<span class="ct-rsep">Opções</span>' : '') + `<button role="tab" id="t_${k}" data-aba="${k}" aria-selected="${k === aberta}" aria-controls="corpoAba">${I(ic)}<b>${r}</b>${n ? `<small>${n}</small>` : ''}<i class="dot" hidden></i></button>`).join('')}</nav><div class="ct-main"><div id="corpoAba" role="tabpanel"></div></div></div>`, (el) => {
      const corpo = $('#corpoAba', el);
      const marca = () => { // destaca o que mudou e mostra o contador no rodapé
        corpo.querySelectorAll('.ct-op').forEach(d => {
          const o = ctl.catalogo.find(x => x.k === d.dataset.op), tem = o.k in mudou, per = !tem && difere(o);
          d.classList.toggle('mod', tem);
          d.querySelector('.ct-tags').innerHTML = (tem ? '<span class="tag">não salvo</span>' : per ? '<span class="tag" style="background:#e0f2fe;color:#075985">personalizado</span>' : '') + ((tem ? mudou[o.k] !== padrao(o) : per) ? ' <button class="pg-btn detail" style="min-height:24px;padding:2px 8px;font-size:12px" data-reset="' + E(o.k) + '">Voltar ao padrão</button>' : '');
        });
        corpo.querySelectorAll('.ct-grp').forEach(g => { const n = g.querySelectorAll('.ct-op.mod').length; g.querySelector('.alt').textContent = n ? n + ' não salva(s)' : ''; });
        corpo.querySelectorAll('[data-reset]').forEach(b => b.onclick = () => { const o = ctl.catalogo.find(x => x.k === b.dataset.reset), i = corpo.querySelector('[data-k="' + o.k + '"]'); if (o.t === 'bool') i.checked = !!o.d; else i.value = o.d; i.dispatchEvent(new Event('change')); });
        tabs.forEach(([k]) => { const d = el.querySelector('[data-aba="' + k + '"] .dot'); if (d) d.hidden = !(k === 'ficha' ? Object.keys(internoMud).length : Object.keys(mudou).some(x => grupoDe[x] === k)); });
        const st = $('#stat', corpo); if (st) { const os = ctl.catalogo.filter(o => grupoDe[o.k] === aberta); st.textContent = os.every(o => o.t === 'bool') ? os.filter(o => atual(o)).length + ' de ' + os.length + ' ligados' : os.filter(o => difere(o) || o.k in mudou).length + ' personalizada(s)'; }
        const f = $('#fInfo', corpo); if (f) { const n = nMud(); f.textContent = n ? n + ' alteração(ões) ainda não salva(s)' : 'Tudo salvo'; f.classList.toggle('has', !!n); const sv = $('#salva', corpo); if (sv) sv.disabled = !n; const ds = $('#descarta', corpo); if (ds) ds.disabled = !n; }
        corpo.querySelectorAll('.ct-colorrow code').forEach(cd => { const i = cd.parentNode.querySelector('input'); cd.textContent = i.value; });
      };
      const rodape = txt => `<div class="ct-foot"><span class="ct-foot-info" id="fInfo" aria-live="polite"></span><button class="pg-btn" id="descarta">Descartar</button><button class="pg-btn green" id="salva">${txt}</button></div>`;
      const abas = {
        opcoes: () => `<div class="ct-find" style="margin-bottom:12px"><input class="pg-input" id="busca" type="search" placeholder="Buscar em todas as ${ctl.catalogo.length} opções (ex.: senha, WhatsApp, turmas)…" aria-label="Buscar opção"><label class="ct-sw" style="font-weight:600;font-size:14px"><input type="checkbox" id="soMud"><span>Só personalizadas</span></label></div><div id="ops" class="solo">${caixaLogo()}${grupos.map((g, gi) => `<details class="ct-grp" data-gi="g${gi}" open><summary>${E(g)} <span class="c">${ctl.catalogo.filter(o => o.g === g).length} opções</span> <span class="c alt" style="color:#92400e"></span></summary><div class="gb">${ctl.catalogo.filter(o => o.g === g).map(opcao).join('')}</div></details>`).join('')}</div><div class="ct-none" id="nenhuma" hidden>Nenhuma opção encontrada. Tente outra palavra.</div>${rodape('Salvar opções')}`,
        usuarios: () => '<div id="usu"><div class="pg-empty">Carregando…</div></div>',
        dados: () => '<div id="dad"><div class="pg-empty">Carregando…</div></div>',
        whatsapp: () => '<div id="wa"><div class="pg-empty">Carregando…</div></div>',
        ficha: () => `<p class="pg-sub" style="margin:0 0 14px">Anotações só suas. Nada daqui aparece para a escola.</p><div class="ct-two">${ctl.interno_campos.map(([k, r]) => `<div class="pg-field"><label class="pg-label" for="i_${E(k)}">${E(r)}</label><input class="pg-input" id="i_${E(k)}" data-i="${E(k)}" value="${E(internoMud[k] != null ? internoMud[k] : (ctl.interno[k] || ''))}" maxlength="300"></div>`).join('')}</div>${rodape('Salvar ficha')}`,
        acoes: () => {
          const v = ctl.valores, est = [['suspensa', 'Suspensa', 'bad'], ['manutencao', 'Em manutenção', 'warn'], ['somente_leitura', 'Somente leitura', 'warn']].filter(([k]) => v[k]);
          const at = (k, val, rot, cls = '') => `<button class="pg-btn ${cls}" data-atalho="${k}:${val}" ${!!v[k] === val ? 'disabled' : ''}>${rot}</button>`;
          return `<div class="pg-stack"><div class="ct-cta"><div><b>Entrar como a escola</b><span>Abre o painel como administrador por 30 minutos, em outra aba. A entrada fica no registro de ações.</span></div><button class="pg-btn" id="entrarEsc">Abrir painel da escola</button></div>
          <div><div class="ct-sec" style="margin-top:0">Estado agora</div><div id="estAgora">${est.length ? est.map(([, t, c2]) => `<span class="pg-badge ${c2}" style="margin-right:6px">${t}</span>`).join('') : '<span class="pg-badge ok">Funcionando normalmente</span>'}</div></div>
          <div><div class="ct-sec" style="margin-top:0">Atalhos de estado</div><div class="ct-quick">${at('suspensa', true, 'Suspender escola', 'dang')}${at('suspensa', false, 'Reativar escola')}${at('manutencao', true, 'Ligar manutenção', 'warnb')}${at('manutencao', false, 'Desligar manutenção')}${at('somente_leitura', true, 'Somente leitura', 'warnb')}${at('somente_leitura', false, 'Liberar gravação')}</div></div>
          <div><div class="ct-sec" style="margin-top:0">Plano e cobrança</div><div class="ct-situ"><div class="ct-situ-txt"><span>Situação atual</span><b id="sitTxt"></b></div><div class="ct-situ-acoes"><select class="pg-select" id="sitPlano" aria-label="Plano da escola"><option value="">Manter o plano atual</option>${planosAtivos.map(p => `<option value="${E(p.nome)}">${E(p.nome)} · ${brl(p.mensal)}/mês</option>`).join('')}</select><button class="pg-btn green" id="sitAtiva">Marcar como paga e ativa</button><button class="pg-btn" id="sitTeste">Voltar para o teste (14 dias)</button></div></div></div>
          <div><div class="ct-sec" style="margin-top:0">Segurança e dados</div><div class="ct-quick"><button class="pg-btn" id="sessTodas">Encerrar todas as sessões</button><button class="pg-btn green" id="popular">Popular com dados de teste</button><a class="pg-btn" href="/api/admin/${base}exportar" download>Baixar todos os dados (JSON)</a></div></div></div>`;
        },
      };
      grupos.forEach((g, i) => { abas['g' + i] = abas.opcoes; });
      const liga = () => {
        corpo.querySelectorAll('input[data-k],select[data-k]').forEach(i => { if (i.dataset.reset !== undefined) return; i.onchange = i.oninput = () => { const o = ctl.catalogo.find(x => x.k === i.dataset.k), val = i.type === 'checkbox' ? i.checked : i.type === 'number' ? Math.max(0, Math.floor(+i.value || 0)) : i.value; if (val === ctl.valores[o.k]) delete mudou[o.k]; else mudou[o.k] = val; marca(); }; });
        corpo.querySelectorAll('[data-i]').forEach(i => i.oninput = () => { if (i.value === (ctl.interno[i.dataset.i] || '')) delete internoMud[i.dataset.i]; else internoMud[i.dataset.i] = i.value; marca(); });
        corpo.querySelectorAll('[data-bulk]').forEach(bt => bt.onclick = () => { corpo.querySelectorAll('.ct-grp[data-gi="' + aberta + '"] .ct-op input[type=checkbox]').forEach(i => { if (i.checked !== (bt.dataset.bulk === '1')) { i.checked = bt.dataset.bulk === '1'; i.dispatchEvent(new Event('change')); } }); });
        const b = $('#busca', corpo);
        if (b) {
          const filtra = () => { const q = b.value.trim().toLowerCase(), so = $('#soMud', corpo).checked, todos = !!(q || so); let ach = 0; $('#ops', corpo).classList.toggle('solo', !todos); const lbx = $('#logoBox', corpo); if (lbx) lbx.style.display = !todos && lbx.dataset.gi === aberta ? '' : 'none';
            corpo.querySelectorAll('.ct-op').forEach(d => { const o = ctl.catalogo.find(x => x.k === d.dataset.op), ok = (!q || d.dataset.txt.includes(q)) && (!so || difere(o) || o.k in mudou); d.style.display = ok ? '' : 'none'; if (ok) ach++; });
            corpo.querySelectorAll('.ct-grp').forEach(g => { const ve = [...g.querySelectorAll('.ct-op')].some(d => d.style.display !== 'none'); g.style.display = ve && (todos || g.dataset.gi === aberta) ? '' : 'none'; if (ve) g.open = true; });
            $('#nenhuma', corpo).hidden = ach > 0; };
          b.oninput = filtra; $('#soMud', corpo).onchange = filtra;
          filtra();
        }
        const lb = $('#logoBox', corpo);
        if (lb) {
          const prev = $('#lgPrev', lb), pal = $('#lgPal', lb), fonte = () => logoPend || logoAtual;
          const pinta = async () => {
            prev.innerHTML = fonte() ? `<img src="${E(fonte())}" alt="Logo da escola">` : '<span>Sem logo</span>';
            $('#lgSalva', lb).hidden = $('#lgCanc', lb).hidden = !logoPend;
            if (!fonte()) { pal.innerHTML = ''; return; }
            try { paleta = await paletaDaLogo(fonte()); } catch (e) { paleta = null; pal.innerHTML = `<p class="help">${E(e.message)}</p>`; return; }
            pal.innerHTML = `<div class="lg-pal">${Object.entries(paleta).map(([k, v]) => `<span class="sw" title="${E(v)}"><i style="background:${E(v)}"></i><em>${ROT_COR[k]}</em></span>`).join('')}<button class="pg-btn detail" id="lgAplica">Aplicar paleta da logo</button></div><p class="help">As cores são sugestões geradas da imagem e entram como alterações não salvas. Ajuste se quiser e clique em Salvar opções.</p>`;
            $('#lgAplica', lb).onclick = () => { for (const [k, v] of Object.entries(paleta)) { const i = corpo.querySelector('input[data-k="' + k + '"]'); if (i && /^#[0-9a-f]{6}$/i.test(v)) { i.value = v; i.dispatchEvent(new Event('change')); } } toast('Paleta aplicada nos campos de cor. Clique em Salvar opções.'); };
          };
          $('#lgEsc', lb).onclick = () => $('#lgFile', lb).click();
          $('#lgFile', lb).onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { logoPend = await logoDeArquivo(f); await pinta(); } catch (er) { falha(er); } };
          $('#lgCanc', lb).onclick = () => { logoPend = null; pinta(); };
          $('#lgSalva', lb).onclick = async e => { e.target.disabled = true; try { await api('clientes/' + id, { m: 'PATCH', b: { logo: logoPend } }); logoAtual = logoPend; logoPend = null; toast('Logo salva — já vale na escola'); await pinta(); } catch (er) { falha(er); } e.target.disabled = false; };
          pinta();
        }
        const sv = $('#salva', corpo), ds = $('#descarta', corpo);
        if (sv) sv.onclick = async () => {
          const ficha = aberta === 'ficha'; sv.disabled = true; const rot = sv.textContent; sv.textContent = 'Salvando…';
          try {
            if (ficha) { await api(base + 'controle', { m: 'PUT', b: { interno: internoMud } }); Object.assign(ctl.interno, internoMud); for (const k in internoMud) delete internoMud[k]; toast('Ficha salva'); }
            else { const r = await api(base + 'controle', { m: 'PUT', b: { valores: mudou } }); const n = Object.keys(mudou).length; Object.assign(ctl.valores, r.valores); for (const k in mudou) delete mudou[k]; toast(n + ' opção(ões) salva(s) — já valem na escola'); }
          } catch (e) { falha(e); }
          sv.textContent = rot; marca();
        };
        if (ds) ds.onclick = () => { if (aberta === 'ficha') for (const k in internoMud) delete internoMud[k]; else for (const k in mudou) delete mudou[k]; mostra(aberta); };
        const usu = $('#usu', corpo); if (usu) listaUsuarios(usu);
        const dad = $('#dad', corpo); if (dad) painelDados(dad);
        const wa = $('#wa', corpo); if (wa) painelWa(wa);
        const ent = $('#entrarEsc', corpo);
        if (ent) {
          ent.onclick = async () => { const w = window.open('', '_blank'); ent.disabled = true; try { const r = await api(base + 'entrar', { m: 'POST', b: {} }); if (w) w.location = r.url; else toast('Libere pop-ups para abrir a escola.', 'err'); } catch (e) { if (w) w.close(); falha(e); } ent.disabled = false; };
          const pintaSit = () => { const ST = { ativo: 'Ativa · paga', teste: 'Em teste grátis', teste_fim: 'Teste encerrado', implantando: 'Implantando', cancelado: 'Cancelada' }; $('#sitTxt', corpo).textContent = ST[c.status] || c.status; $('#sitAtiva', corpo).disabled = c.status === 'ativo' && !$('#sitPlano', corpo).value; $('#sitTeste', corpo).disabled = c.status === 'teste'; };
          pintaSit(); $('#sitPlano', corpo).onchange = pintaSit;
          $('#sitAtiva', corpo).onclick = async (e) => { const plano = $('#sitPlano', corpo).value; if (!(await confirma('Marcar como paga e ativa?', 'A escola passa a ser cliente ativa, sem prazo de teste e sem cadeados' + (plano ? ', no plano ' + plano : '') + '. Se houver cobrança pendente no Asaas, ela é cancelada.', 'Marcar como ativa'))) return; e.target.disabled = true; try { await api(base + 'situacao', { m: 'POST', b: { acao: 'ativar', plano } }); c.status = 'ativo'; toast('Escola marcada como paga e ativa'); } catch (x) { falha(x); } pintaSit(); };
          $('#sitTeste', corpo).onclick = async (e) => { if (!(await confirma('Voltar para o teste grátis?', 'A escola volta a ter 14 dias de teste a partir de hoje, com as opções pagas bloqueadas no menu. Se houver cobrança pendente no Asaas, ela é cancelada.', 'Voltar para o teste'))) return; e.target.disabled = true; try { await api(base + 'situacao', { m: 'POST', b: { acao: 'teste', dias: 14 } }); c.status = 'teste'; toast('Escola voltou para o período de teste'); } catch (x) { falha(x); } pintaSit(); };
          $('#popular', corpo).onclick = async (e) => { if (!(await confirma('Popular com dados de teste?', 'Copia alunos, turmas, planos e pagamentos fictícios da escola de demonstração para esta escola. Os registros de teste são atualizados; os seus outros dados não mudam.', 'Popular agora'))) return; e.target.disabled = true; try { const r = await api(base + 'popular', { m: 'POST', b: {} }); toast(r.total ? r.total + ' registros de teste adicionados' : 'Já estava tudo populado'); } catch (x) { falha(x); } e.target.disabled = false; };
          $('#sessTodas', corpo).onclick = async () => { if (!(await confirma('Encerrar todas as sessões?', 'Todos os usuários desta escola precisam entrar de novo.', 'Encerrar sessões', true))) return; try { const r = await api(base + 'sessoes', { m: 'POST', b: {} }); toast('Sessões encerradas (' + r.usuarios + ' usuários)'); } catch (e) { falha(e); } };
          corpo.querySelectorAll('[data-atalho]').forEach(b => b.onclick = async () => { const [k, val] = b.dataset.atalho.split(':'); if (!(await confirma(b.textContent + '?', ATALHO_TXT[b.dataset.atalho] || 'Vale na hora para todos os usuários da escola.', b.textContent, /suspensa:true|somente_leitura:true/.test(b.dataset.atalho)))) return; try { const r = await api(base + 'controle', { m: 'PUT', b: { valores: { [k]: val === 'true' } } }); Object.assign(ctl.valores, r.valores); toast('Feito: ' + b.textContent); mostra('acoes'); } catch (e) { falha(e); } });
        }
        marca();
      };
      function mostra(k) {
        aberta = k; const T = tabs.find(t => t[0] === k), gr = T[4], eG = grupos.includes(gr), bool = eG && soBool(gr);
        corpo.innerHTML = `<div class="ct-head"><div><h3>${E(eG ? gr : T[1])}</h3><p>${E(META[gr][1])}</p></div>${eG ? `<div class="ct-headr"><span class="ct-stat" id="stat"></span>${bool ? '<button class="pg-btn detail" data-bulk="1">Ligar todos</button><button class="pg-btn detail" data-bulk="0">Desligar todos</button>' : ''}</div>` : ''}</div>` + abas[k](); corpo.setAttribute('aria-labelledby', 't_' + k);
        el.querySelectorAll('[data-aba]').forEach(b => b.setAttribute('aria-selected', b.dataset.aba === k)); liga();
      }
      el.querySelectorAll('[data-aba]').forEach(b => { b.onclick = () => mostra(b.dataset.aba); b.onkeydown = e => { const i = tabs.findIndex(t => t[0] === b.dataset.aba), d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (d) { const n = tabs[(i + d + tabs.length) % tabs.length][0]; mostra(n); el.querySelector('[data-aba="' + n + '"]').focus(); } }; });
      mostra('g0');
    }, { wide: true, guarda: () => nMud() > 0 });

    // ---------- WhatsApp da escola: servidor (instância própria no Evolution compartilhado) + número ----------
    async function painelWa(box) {
      const ROT = { open: ['Conectado', 'ok'], close: ['Desconectado — leia o QR', 'warn'], connecting: ['Conectando…', 'warn'], sem: ['Sem servidor', 'bad'], erro: ['Servidor não respondeu', 'bad'] };
      const desenha = async () => {
        let x; try { x = await api(base + 'whatsapp'); } catch (e) { box.innerHTML = `<div class="pg-alert bad">${E(e.message)}</div>`; return; }
        const [rot, cls] = ROT[x.estado] || [x.estado, 'warn'];
        box.innerHTML = `<div class="pg-stack">
          <div class="ct-situ"><div class="ct-situ-txt"><span>Servidor de WhatsApp</span><b>${x.servidor ? 'Criado' : 'Ainda não criado'}${x.instance ? ' · instância <code>' + E(x.instance) + '</code>' : ''}</b></div>
            <div class="ct-situ-ac">${x.servidor ? '' : `<button class="pg-btn green" id="waCriar" ${x.plataforma ? '' : 'disabled'}>Criar servidor agora</button>`}</div></div>
          ${x.plataforma ? '' : '<div class="pg-alert warn">O servidor Evolution da plataforma ainda não foi configurado. Vá em <b>Configurações → Servidor de WhatsApp</b>, informe o endereço e a chave mestra uma vez, e então crie o servidor de cada escola.</div>'}
          ${x.servidor ? `<div><div class="ct-sec" style="margin-top:0">Número conectado</div>
            <p><span class="pg-badge ${cls}">${E(rot)}</span>${x.numero ? ' <b style="margin-left:8px">+' + E(x.numero) + '</b>' : ''}</p>${x.erro ? `<p class="pg-hint">${E(x.erro)}</p>` : ''}
            <div class="ct-quick"><button class="pg-btn" id="waAtual">${I('refresh')} Atualizar estado</button>${x.estado === 'open' ? '<button class="pg-btn dang" id="waSair">Desconectar número</button>' : '<button class="pg-btn green" id="waQr">Mostrar QR code para conectar o número</button>'}</div>
            <div id="waQrBox" style="margin-top:14px"></div></div>` : ''}
        </div>`;
        const criar = $('#waCriar', box); if (criar) criar.onclick = async () => { criar.disabled = true; try { await api(base + 'whatsapp', { m: 'POST', b: { acao: 'criar' } }); toast('Servidor de WhatsApp criado'); await desenha(); } catch (e) { falha(e); criar.disabled = false; } };
        const atual = $('#waAtual', box); if (atual) atual.onclick = desenha;
        const sair = $('#waSair', box); if (sair) sair.onclick = async () => { if (!(await confirma('Desconectar o número?', 'O WhatsApp desta escola para de enviar até um novo QR ser lido.', 'Desconectar', true))) return; try { await api(base + 'whatsapp', { m: 'POST', b: { acao: 'sair' } }); toast('Número desconectado'); await desenha(); } catch (e) { falha(e); } };
        const qr = $('#waQr', box); if (qr) qr.onclick = async () => {
          qr.disabled = true; const alvo = $('#waQrBox', box); alvo.innerHTML = '<div class="pg-empty">Gerando o QR…</div>';
          try {
            const g = await api(base + 'whatsapp', { m: 'POST', b: { acao: 'qr' } });
            alvo.innerHTML = g.imagem ? `<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap"><img src="${E(g.imagem)}" alt="QR code do WhatsApp" style="width:240px;height:240px;border:1px solid #dfe4ea;border-radius:8px;background:#fff"><div><b>No celular do número da escola:</b><ol style="margin:6px 0 0 18px;padding:0"><li>Abra o WhatsApp</li><li>Aparelhos conectados → Conectar aparelho</li><li>Aponte para este QR (vale por poucos segundos)</li></ol>${g.codigo ? '<p class="pg-hint">Ou use o código: <code>' + E(g.codigo) + '</code></p>' : ''}</div></div>` : '<div class="pg-alert warn">O servidor não devolveu um QR agora. Tente de novo em instantes.</div>';
            let n = 0; const t = setInterval(async () => { n++; if (!document.body.contains(alvo) || n > 20) { clearInterval(t); return; } try { const e2 = await api(base + 'whatsapp'); if (e2.estado === 'open') { clearInterval(t); toast('Número conectado'); desenha(); } } catch { /* tenta no próximo ciclo */ } }, 6000);
          } catch (e) { alvo.innerHTML = `<div class="pg-alert bad">${E(e.message)}</div>`; }
          qr.disabled = false;
        };
      };
      await desenha();
    }

    async function listaUsuarios(box) {
      try {
        const r = await api(base + 'usuarios'), PAPEL = { admin: 'Administrador', professor: 'Professor', user: 'Responsável' };
        box.innerHTML = `<div class="nu-card"><div class="nu-cab"><b>Novo usuário</b><span>Crie um acesso para esta escola. Deixe a senha em branco para gerar uma automaticamente.</span></div><div class="nu-grade"><label class="nu-campo"><span>E-mail</span><input class="pg-input" id="nuE" type="email" placeholder="nome@escola.com.br" autocomplete="off"></label><label class="nu-campo"><span>Senha <em>opcional</em></span><input class="pg-input" id="nuS" type="text" placeholder="vazio = gerar uma" autocomplete="off" spellcheck="false"></label><label class="nu-campo"><span>Papel</span><select class="pg-select" id="nuP"><option value="admin">Administrador</option><option value="professor">Professor</option><option value="user">Responsável</option></select></label></div><div class="nu-rod"><small>Administrador vê tudo · Professor vê só as suas turmas · Responsável acessa o portal do aluno.</small><button class="pg-btn green" id="nuB" type="button">Criar usuário</button></div></div><div id="usRes" aria-live="polite"></div>
          <div class="ct-find"><input class="pg-input" id="usB" type="search" placeholder="Buscar usuário…" aria-label="Buscar usuário"><span class="n">${r.usuarios.length} usuário(s)</span></div>
          <div class="us-lista" id="usT">${r.usuarios.map(u => {
            const e = E(u.email), ini = E(u.email.slice(0, 1).toUpperCase()), btn = (a, txt, cls = '') => `<button class="pg-btn detail ${cls}" data-u="${a}" data-e="${e}">${txt}</button>`;
            const senha = u.senha
              ? `<span class="us-senha"><code>${E(u.senha)}</code><button class="pg-btn detail" data-cp="${E(u.senha)}" aria-label="Copiar a senha de ${e}">${I('copy')} Copiar</button></span>`
              : `<span class="us-senha off">${u.senha_trocada ? 'o próprio usuário trocou a senha' : u.role === 'user' ? 'padrão: o CPF do responsável, ou a que ele definiu' : 'definida antes da Central: troque para ver aqui'}</span>`;
            return `<article class="us-item" data-e="${e.toLowerCase()}">
              <span class="us-av" aria-hidden="true">${ini}</span>
              <div class="us-main"><div class="us-top"><b>${e}</b><span class="pg-badge ${u.role === 'admin' ? 'info' : ''}">${E(PAPEL[u.role] || u.role)}</span>${u.principal ? '<span class="pg-badge info">principal</span>' : ''}${u.bloqueado ? '<span class="pg-badge bad">bloqueado</span>' : ''}</div>
                <div class="us-pw"><small>Senha</small>${senha}</div>
                <div class="us-ac">${btn('entrar', I('link') + ' Entrar como este', 'green')}${btn('senha', 'Nova senha')}${btn('sessoes', 'Sair dos aparelhos')}${u.bloqueado ? btn('desbloquear', 'Desbloquear') : u.principal ? '' : btn('bloquear', 'Bloquear')}${u.principal ? '' : btn('papel', 'Mudar papel') + `<button class="pg-btn detail us-del" data-u="excluir" data-e="${e}">Excluir</button>`}</div></div></article>`;
          }).join('')}</div>`;
        $('#usB', box).oninput = e => { const q = e.target.value.trim().toLowerCase(); box.querySelectorAll('#usT .us-item').forEach(it => it.style.display = !q || it.dataset.e.includes(q) ? '' : 'none'); };
        box.querySelectorAll('[data-cp]').forEach(b => b.onclick = () => copiar(b.dataset.cp));
        const mostra = (t, senha) => { $('#usRes', box).innerHTML = `<div class="pg-alert ok" style="margin-bottom:12px">${E(t)}<div class="ct-copy" style="margin-top:8px"><input class="pg-input" readonly value="${E(senha)}" aria-label="Senha gerada" style="flex:1"><button class="pg-btn" id="cpS">${I('copy')} Copiar</button></div><small style="display:block;margin-top:6px;font-weight:600">Anote agora: a senha não aparece de novo.</small></div>`; $('#cpS', box).onclick = () => copiar(senha); };
        $('#nuB', box).onclick = async e => { e.target.disabled = true; try { const x = await api(base + 'usuario', { m: 'POST', b: { acao: 'criar', email: $('#nuE', box).value, papel: $('#nuP', box).value, senha: $('#nuS', box).value } }); await listaUsuarios(box); mostra('Usuário criado: ' + x.email, x.senha); } catch (er) { falha(er); e.target.disabled = false; } };
        box.querySelectorAll('[data-u]').forEach(b => b.onclick = async () => {
          const acao = b.dataset.u, email = b.dataset.e; let papel, senha;
          if (acao === 'entrar') { // abre a escola já logada como este usuário (30 minutos), em outra aba
            const w = window.open('', '_blank'); b.disabled = true;
            try { const r = await api(base + 'entrar', { m: 'POST', b: { email } }); if (w) w.location = r.url; else toast('Libere pop-ups para abrir a escola.', 'err'); } catch (e) { if (w) w.close(); falha(e); }
            b.disabled = false; return;
          }
          if (acao === 'senha') { senha = await confirma('Nova senha', email, 'Trocar senha', false, '<div class="pg-field" style="margin-top:12px"><label class="pg-label">Senha (deixe em branco para gerar uma)</label><input class="pg-input" type="text" autocomplete="off" spellcheck="false" placeholder="Escreva a senha que quiser"></div>'); if (senha === false || senha == null) return; senha = String(senha === true ? '' : senha); }
          if (acao === 'papel') { papel = await confirma('Mudar o papel', email, 'Mudar papel', false, '<div class="pg-field" style="margin-top:12px"><label class="pg-label">Novo papel</label><select class="pg-select"><option value="admin">Administrador</option><option value="professor">Professor</option><option value="user">Responsável</option></select></div>'); if (!papel) return; }
          if (['excluir', 'bloquear'].includes(acao) && !(await confirma(acao === 'excluir' ? 'Excluir usuário?' : 'Bloquear usuário?', email + (acao === 'excluir' ? ' perde o acesso e o login deixa de existir.' : ' não consegue mais entrar até você desbloquear.'), acao === 'excluir' ? 'Excluir' : 'Bloquear', true))) return;
          b.disabled = true;
          try { const x = await api(base + 'usuario', { m: 'POST', b: { acao, email, papel, senha } }); if (acao !== 'sessoes') await listaUsuarios(box); if (x.senha) mostra('Nova senha de ' + email, x.senha); else toast(acao === 'sessoes' ? 'Sessões encerradas' : 'Feito'); } catch (e) { falha(e); }
          b.disabled = false;
        });
      } catch (e) { box.innerHTML = '<div class="pg-alert bad">Não consegui listar os usuários.</div>'; }
    }
    async function painelDados(box) {
      try {
        const [d, a] = await Promise.all([api(base + 'dados'), api(base + 'auditoria')]), tot = d.colecoes.reduce((s, x) => s + x.kb, 0) || 1;
        box.innerHTML = `<div class="ct-sec" style="margin-top:0">Dados armazenados <small style="font-weight:600;text-transform:none;color:var(--medium-gray)">· ${tot} KB no total</small></div><div class="pg-table-wrap"><table class="pg-table"><thead><tr><th>Coleção</th><th class="num">Registros</th><th class="num">KB</th><th>Peso</th></tr></thead><tbody>${d.colecoes.map(x => `<tr><td><b>${E(x.col)}</b></td><td class="num">${x.n}</td><td class="num">${x.kb}</td><td><div class="pg-track" style="width:120px"><i style="width:${Math.max(2, Math.round(x.kb / tot * 100))}%"></i></div></td></tr>`).join('')}</tbody></table></div>
          <div class="ct-sec">Limpeza</div><div class="ct-quick"><button class="pg-btn" data-l="auditoria">Limpar registro de ações</button><button class="pg-btn" data-l="rumo_ao_esporte_2026_chamadas">Limpar histórico de chamadas</button></div>
          <div class="ct-sec">Últimas ações na escola</div>${a.registros.length ? `<div class="ct-feed">${a.registros.map(x => `<div><time>${E((x.quando || '').slice(5, 16).replace('T', ' '))}</time><span><b>${E(x.quem)}</b> · ${E(x.acao)}</span></div>`).join('')}</div>` : vazio('Nenhuma ação registrada', 'As ações dos usuários da escola aparecem aqui.')}`;
        rotular(box);
        box.querySelectorAll('[data-l]').forEach(b => b.onclick = async () => { if (!(await confirma('Apagar tudo de ' + (b.dataset.l === 'auditoria' ? 'registro de ações' : 'histórico de chamadas') + '?', 'Não dá para desfazer (só restaurando um backup).', 'Apagar', true))) return; try { const r = await api(base + 'limpar-dados', { m: 'POST', b: { col: b.dataset.l, confirmar: true } }); toast(r.apagados + ' registro(s) apagado(s)'); painelDados(box); } catch (e) { falha(e); } });
      } catch (e) { box.innerHTML = '<div class="pg-alert bad">Não consegui carregar os dados.</div>'; }
    }
  }
  function cobrancaAvulsa(c, fecharAntes) {
    modal('Cobrança avulsa · ' + c.escola, `<div class="pg-stack"><div class="pg-field"><label class="pg-label" for="d">Descrição</label><input class="pg-input" id="d" value="Cobrança avulsa"></div><div class="ct-two"><div class="pg-field"><label class="pg-label" for="v">Valor (R$)</label><input class="pg-input" id="v" inputmode="decimal"></div><div class="pg-field"><label class="pg-label" for="w">Vencimento</label><input class="pg-input" id="w" type="date" value="${new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10)}"></div></div><div id="r"></div><div class="pg-actions" style="justify-content:flex-end"><button class="pg-btn green" id="g">Criar cobrança</button></div></div>`, el => {
      $('#g', el).onclick = async () => { try { const r = await api('faturas', { m: 'POST', b: { cliente_id: c.id, descricao: $('#d', el).value, valor: money($('#v', el).value), vencimento: $('#w', el).value } });
        $('#r', el).innerHTML = `<div class="pg-alert ok">Cobrança criada.</div><div class="ct-copy" style="margin-top:10px"><input class="pg-input" readonly value="${E(r.link)}"><button class="pg-btn" id="cp">${I('copy')} Copiar</button></div>`; $('#cp', el).onclick = () => copiar(r.link); $('#g', el).disabled = true; if (fecharAntes) rota(); } catch (e) { falha(e); } };
    });
  }

  // ---------- faturas ----------
  let filtroFat = '';
  async function faturas(pg) {
    const lista = await api('faturas' + (filtroFat ? '?status=' + filtroFat : ''));
    const chips = [['', 'Todas', ''], ['aberta', 'Em aberto', 'warn'], ['atrasada', 'Atrasadas', ''], ['informada', 'Pagamento informado', 'info'], ['paga', 'Pagas', 'ok']];
    pg.innerHTML = cabeca('Faturas', 'Mensalidades e cobranças de todas as escolas.', `<button class="pg-btn ok" id="gerar">${I('refresh')} Gerar mensalidades</button>`) +
      `<div class="pg-stack"><div class="pg-chips">${chips.map(([k, t, c]) => `<button class="pg-chip ${filtroFat === k ? 'on ' + c : ''}" data-f="${k}">${t}</button>`).join('')}</div>
      <div class="pg-table-wrap"><table class="pg-table"><thead><tr><th>Escola</th><th>Descrição</th><th>Vencimento</th><th class="num">Valor</th><th>Situação</th><th></th></tr></thead><tbody>
      ${lista.map(f => `<tr><td>${escolaCel(f.escola, f.lead_id)}</td><td>${E(f.descricao)}</td><td>${dt(f.vencimento)}</td><td class="num">${brl(f.valor)}</td><td>${badge(ST_FAT, f.status)}${f.atrasada ? ' <span class="pg-badge bad">Atrasada</span>' : ''}${f.pago_em ? `<small>em ${dt(f.pago_em)}</small>` : ''}</td>
        <td class="ac">${f.status === 'aberta' || f.status === 'informada' ? `<button class="pg-btn detail" data-paga="${f.id}">Marcar paga</button> <button class="pg-btn detail" data-cancela="${f.id}">Cancelar</button> ` : ''}${f.asaas_url ? `<button class="pg-btn detail" data-copia="${E(f.asaas_url)}">Link de pagamento</button> ` : f.asaas_on && (f.status === 'aberta' || f.status === 'informada') ? `<button class="pg-btn detail" data-asaas="${f.id}">Gerar no Asaas</button> ` : ''}<button class="pg-btn detail" data-copia="${E(f.link)}">Copiar link</button>${f.asaas_erro ? `<small style="display:block;color:#b91c1c">Asaas: ${E(f.asaas_erro)}</small>` : ''}</td></tr>`).join('')}</tbody></table>
      ${lista.length ? '' : vazio('Nenhuma fatura aqui', 'As faturas nascem quando o contrato é assinado e todo mês pelas mensalidades.')}</div></div>`;
    pg.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { filtroFat = b.dataset.f; rota(); });
    pg.querySelectorAll('[data-copia]').forEach(b => b.onclick = () => copiar(b.dataset.copia));
    pg.querySelectorAll('[data-asaas]').forEach(b => b.onclick = async () => { b.disabled = true; try { const r = await api('faturas/' + b.dataset.asaas + '/asaas', { m: 'POST', b: {} }); toast('Cobrança criada no Asaas'); copiar(r.url); rota(); } catch (e) { falha(e); rota(); } });
    pg.querySelectorAll('[data-paga]').forEach(b => b.onclick = async () => { try { await api('faturas/' + b.dataset.paga, { m: 'PATCH', b: { status: 'paga' } }); toast('Fatura marcada como paga'); rota(); } catch (e) { falha(e); } });
    pg.querySelectorAll('[data-cancela]').forEach(b => b.onclick = async () => { try { await api('faturas/' + b.dataset.cancela, { m: 'PATCH', b: { status: 'cancelada' } }); toast('Fatura cancelada'); rota(); } catch (e) { falha(e); } });
    $('#gerar').onclick = async () => { try { const x = await api('faturas/gerar', { m: 'POST', b: {} }); toast(x.criadas ? x.criadas + ' mensalidade(s) gerada(s)' : 'Nenhuma mensalidade nova para gerar'); rota(); } catch (e) { falha(e); } };
  }

  // ---------- contratos ----------
  async function contratos(pg) {
    const lista = await api('contratos');
    const ST = { enviado: ['Aguardando assinatura', 'warn'], assinado: ['Assinado', 'ok'], cancelado: ['Cancelado', ''] };
    pg.innerHTML = cabeca('Contratos', 'Propostas enviadas e contratos assinados.') +
      `<div class="pg-table-wrap"><table class="pg-table"><thead><tr><th>Escola</th><th>Plano</th><th class="num">Mensalidade</th><th>Situação</th><th>Enviado</th><th>Assinado por</th><th></th></tr></thead><tbody>
      ${lista.map(k => `<tr><td>${escolaCel(k.escola, k.lead_id)}</td><td>${E(k.plano_nome)}</td><td class="num">${brl(k.mensal)}</td><td>${badge(ST, k.status)}</td><td>${dt(k.criado)}</td><td>${k.ass_nome ? E(k.ass_nome) + `<small>${dt(k.assinado_em)}</small>` : '—'}</td>
        <td class="ac"><button class="pg-btn detail" data-copia="${E(k.link)}">Copiar link</button> ${k.status === 'enviado' ? `<button class="pg-btn detail" data-cancela="${k.id}">Cancelar</button>` : ''}</td></tr>`).join('')}</tbody></table>
      ${lista.length ? '' : vazio('Nenhum contrato ainda', 'Abra um pedido e clique em "Criar proposta".')}</div>`;
    pg.querySelectorAll('[data-copia]').forEach(b => b.onclick = () => copiar(b.dataset.copia));
    pg.querySelectorAll('[data-cancela]').forEach(b => b.onclick = async () => { try { await api('contratos/' + b.dataset.cancela, { m: 'PATCH', b: {} }); toast('Contrato cancelado'); rota(); } catch (e) { falha(e); } });
  }

  // ---------- planos ----------
  async function planos(pg) {
    const lista = await api('planos');
    pg.innerHTML = cabeca('Planos', 'O que você vende e por quanto.', `<button class="pg-btn green" id="novo">${I('plus')} Novo plano</button>`) +
      (lista.length ? `<div class="pg-grid-3">${lista.map(p => `<div class="pg-card soft ct-plan ${p.ativo ? '' : 'off'}"><div class="pg-card-title" style="font-size:16px">${E(p.nome)}</div><div class="v">${brl(p.mensal)}<small style="font:700 13px var(--font-primary);color:var(--medium-gray)"> /mês</small></div><div class="pg-card-sub">Implantação: ${p.implantacao ? brl(p.implantacao) : 'sem cobrança'}</div>${p.descricao ? `<div>${E(p.descricao)}</div>` : ''}<div class="pg-actions"><button class="pg-btn detail" data-ed="${p.id}">Editar</button><button class="pg-btn detail" data-at="${p.id}" data-v="${p.ativo ? 0 : 1}">${p.ativo ? 'Desativar' : 'Reativar'}</button></div></div>`).join('')}</div>` : `<div class="pg-card">${vazio('Você ainda não tem planos', 'Crie o primeiro para poder montar propostas.')}</div>`);
    const form = (p = {}) => `<div class="pg-stack"><div class="pg-field"><label class="pg-label" for="n">Nome</label><input class="pg-input" id="n" value="${E(p.nome || '')}" placeholder="Essencial"></div><div class="ct-two"><div class="pg-field"><label class="pg-label" for="m">Mensalidade (R$)</label><input class="pg-input" id="m" inputmode="decimal" value="${p.mensal ? fmtIn(p.mensal) : ''}"></div><div class="pg-field"><label class="pg-label" for="i">Implantação (R$)</label><input class="pg-input" id="i" inputmode="decimal" value="${fmtIn(p.implantacao || 0)}"></div></div><div class="pg-field"><label class="pg-label" for="d">Descrição</label><input class="pg-input" id="d" value="${E(p.descricao || '')}" placeholder="O que está incluído"></div><div class="pg-actions" style="justify-content:flex-end"><button class="pg-btn green" id="s">Salvar plano</button></div></div>`;
    $('#novo').onclick = () => modal('Novo plano', form(), (el, f) => { $('#s', el).onclick = async () => { try { await api('planos', { m: 'POST', b: { nome: $('#n', el).value, mensal: money($('#m', el).value), implantacao: money($('#i', el).value), descricao: $('#d', el).value } }); f(); rota(); } catch (e) { falha(e); } }; });
    pg.querySelectorAll('[data-ed]').forEach(b => b.onclick = () => { const p = lista.find(x => x.id === +b.dataset.ed); modal('Editar plano', form(p), (el, f) => { $('#s', el).onclick = async () => { try { await api('planos/' + p.id, { m: 'PATCH', b: { nome: $('#n', el).value, mensal: money($('#m', el).value), implantacao: money($('#i', el).value), descricao: $('#d', el).value } }); f(); rota(); } catch (e) { falha(e); } }; }); });
    pg.querySelectorAll('[data-at]').forEach(b => b.onclick = async () => { try { await api('planos/' + b.dataset.at, { m: 'PATCH', b: { ativo: b.dataset.v === '1' } }); rota(); } catch (e) { falha(e); } });
  }

  // ---------- configurações ----------
  // Aba do Asaas: é o recebimento do DONO do sistema (mensalidades que as escolas pagam ao Pé na Grama), não o da escolinha.
  function asaasTela(el, a) {
    const copia = (id, v) => `<div class="ct-copy"><input class="pg-input" id="${id}" readonly value="${E(v)}" aria-label="${id}"><button class="pg-btn detail" data-cp="${id}">${I('copy')} Copiar</button></div>`;
    el.innerHTML = `<div class="pg-alert ${a.ativo ? 'ok' : ''}" style="margin-bottom:14px"><b>${a.ativo ? 'Ligado' : 'Desligado'}</b> · ${a.configurada ? 'chave final ' + E(a.final) + ' · ambiente ' + (a.amb === 'producao' ? 'de produção' : 'de teste (sandbox)') : 'nenhuma chave salva ainda'}.<br>Aqui é onde <b>você</b> recebe: o Asaas cobra a mensalidade que cada escola paga ao Pé na Grama e dá baixa na fatura sozinho. Isso não tem ligação com o dinheiro que as escolinhas recebem dos alunos.</div>
      <ol class="pg-sub" style="margin:0 0 14px 18px;line-height:1.7"><li>Entre no Asaas, vá em <b>Integrações → Chave de API</b> e gere uma chave (teste: <code>sandbox.asaas.com</code>).</li><li>Cole a chave abaixo e salve. Ela fica guardada no servidor e nunca aparece de novo.</li><li>Clique em <b>Testar conexão</b>.</li><li>Cadastre o webhook (abaixo) no Asaas e ligue o recebimento.</li></ol>
      <div class="ct-two"><div class="pg-field"><label class="pg-label" for="asChave">Chave de API do Asaas</label><input class="pg-input" id="asChave" type="password" autocomplete="new-password" spellcheck="false" placeholder="${a.configurada ? '•••• ' + E(a.final) + ' (deixe em branco para manter)' : '$aact_...'}"></div>
        <div class="pg-field"><label class="pg-label" for="asAmb">Ambiente</label><select class="pg-select" id="asAmb"><option value="sandbox" ${a.amb === 'sandbox' ? 'selected' : ''}>Teste (sandbox): sem dinheiro de verdade</option><option value="producao" ${a.amb === 'producao' ? 'selected' : ''}>Produção: cobranças reais</option></select></div>
        <div class="pg-field"><label class="pg-label" for="asTipo">Forma de pagamento</label><select class="pg-select" id="asTipo">${[['UNDEFINED', 'O cliente escolhe (Pix, boleto ou cartão)'], ['PIX', 'Só Pix'], ['BOLETO', 'Só boleto'], ['CREDIT_CARD', 'Só cartão']].map(([k, n]) => `<option value="${k}" ${a.tipo === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
        <div class="pg-field"><label class="pg-label">Cobrar pelo Asaas</label><label class="pg-check ${a.ativo ? 'done' : ''}"><input type="checkbox" id="asAtivo" ${a.ativo ? 'checked' : ''}><span>Criar a cobrança no Asaas quando uma fatura nascer</span></label></div></div>
      <div class="pg-actions" style="margin:6px 0 18px"><button class="pg-btn green" id="asSalva">Salvar</button><button class="pg-btn" id="asTesta">Testar conexão</button></div><div id="asRes" aria-live="polite"></div>
      <div class="ct-sec">Webhook (baixa automática)</div>
      <p class="pg-sub" style="margin-bottom:10px">No Asaas: <b>Integrações → Webhooks → Novo webhook</b>. Use a versão v3, marque como habilitado e escolha os eventos de cobrança <code>PAYMENT_CONFIRMED</code> e <code>PAYMENT_RECEIVED</code>.</p>
      <div class="pg-field"><label class="pg-label">URL do webhook</label>${copia('asUrl', a.webhook_url)}</div>
      <div class="pg-field"><label class="pg-label">Token de autenticação</label>${a.webhook_token ? copia('asTok', a.webhook_token) : '<div class="pg-hint">Aparece depois que você salvar pela primeira vez.</div>'}${a.webhook_token ? '<button class="pg-btn detail" id="asNovoTok" style="margin-top:8px">Gerar novo token</button>' : ''}</div>`;
    const res = (ok, txt) => { $('#asRes', el).innerHTML = `<div class="pg-alert ${ok ? 'ok' : 'bad'}" style="margin-bottom:12px">${E(txt)}</div>`; };
    const salva = async (extra = {}) => { const b = { amb: $('#asAmb', el).value, tipo: $('#asTipo', el).value, ativo: $('#asAtivo', el).checked, ...extra }, k = $('#asChave', el).value.trim(); if (k) b.chave = k; return api('asaas', { m: 'PUT', b }); };
    $('#asSalva', el).onclick = async (e) => { e.target.disabled = true; try { const r = await salva(); toast('Recebimento salvo'); asaasTela(el, r); } catch (er) { falha(er); e.target.disabled = false; } };
    $('#asTesta', el).onclick = async (e) => { e.target.disabled = true; try { await salva(); const r = await api('asaas/testar', { m: 'POST', b: {} }); res(true, 'Conectou no ambiente ' + (r.ambiente === 'producao' ? 'de produção' : 'de teste') + '. Saldo: ' + brl(Math.round((r.saldo || 0) * 100)) + '.'); } catch (er) { res(false, er.message); } e.target.disabled = false; };
    const nt = $('#asNovoTok', el); if (nt) nt.onclick = async () => { if (!(await confirma('Gerar novo token?', 'Depois você precisa colocar o novo token no webhook do Asaas, senão as baixas automáticas param.', 'Gerar novo token'))) return; try { asaasTela(el, await salva({ regenerarToken: true })); } catch (er) { falha(er); } };
    el.querySelectorAll('[data-cp]').forEach((b) => (b.onclick = () => copiar($('#' + b.dataset.cp, el).value)));
  }
  let abaCfg = 'empresa';
  async function config(pg) {
    const c = await api('config');
    const f = (id, rot, v, dica, ph = '') => `<div class="pg-field"><label class="pg-label" for="${id}">${rot}</label><input class="pg-input" id="${id}" value="${E(v)}" placeholder="${E(ph)}">${dica ? `<span class="pg-hint">${dica}</span>` : ''}</div>`;
    const ABAS = [['empresa', 'Sua empresa', 'users'], ['pix', 'Pix para receber', 'dollar'], ['asaas', 'Recebimento (Asaas)', 'receipt'], ['contrato', 'Texto do contrato', 'file'], ['whatsapp', 'Servidor de WhatsApp', 'whats']];
    pg.innerHTML = cabeca('Configurações', 'Seus dados, o Pix que recebe e o texto do contrato.', `<button class="pg-btn green" id="salvar">Salvar tudo</button>`) +
      `<div class="cf-tabs" role="tablist">${ABAS.map(([k, n, ic]) => `<button class="cf-tab ${k === abaCfg ? 'on' : ''}" role="tab" aria-selected="${k === abaCfg}" data-aba="${k}">${I(ic)} ${n}</button>`).join('')}</div>
      <div class="pg-card cf-pane" data-pane="empresa"><div class="ct-two">${f('empresa_nome', 'Nome', c.empresa_nome, 'Aparece no contrato e na fatura.')}${f('empresa_doc', 'CNPJ ou CPF', c.empresa_doc, 'Vai no texto do contrato.', '00.000.000/0000-00')}${f('empresa_email', 'E-mail', c.empresa_email, '')}${f('empresa_whats', 'WhatsApp (com 55 e DDD)', c.empresa_whats, 'Os clientes falam com você por aqui.', '5533999999999')}</div></div>
      <div class="pg-card cf-pane" data-pane="pix"><p class="pg-sub" style="margin-bottom:14px">As faturas geram um Pix "copia e cola" com o valor certo. O dinheiro cai direto na sua conta; depois você marca a fatura como paga.</p><div class="ct-two">${f('pix_chave', 'Chave Pix', c.pix_chave, 'CPF, CNPJ, e-mail, telefone ou chave aleatória.')}${f('pix_nome', 'Nome que aparece no Pix', c.pix_nome, 'Até 25 letras.')}${f('pix_cidade', 'Cidade', c.pix_cidade, 'Até 15 letras.')}${f('dia_venc_padrao', 'Dia de vencimento padrão', c.dia_venc_padrao, 'De 1 a 28.')}</div></div>
      <div class="pg-card cf-pane" data-pane="asaas" id="asaasPane"><div class="pg-empty">Carregando…</div></div>
      <div class="pg-card cf-pane" data-pane="whatsapp" id="waPane"><div class="pg-empty">Carregando…</div></div>
      <div class="pg-card cf-pane" data-pane="contrato"><p class="pg-sub" style="margin-bottom:12px">Este é um modelo-base. Peça para um advogado revisar antes de usar. Variáveis: <code>{{empresa}}</code> <code>{{doc_empresa}}</code> <code>{{escola}}</code> <code>{{assinante}}</code> <code>{{plano}}</code> <code>{{mensal}}</code> <code>{{implantacao}}</code> <code>{{dia}}</code> <code>{{data}}</code>. Cada contrato guarda o texto como estava na hora do envio.</p><textarea class="pg-textarea" id="contrato_texto" style="min-height:420px;font-size:13px">${E(c.contrato_texto)}</textarea></div>`;
    api('whatsapp-plataforma').then((w) => {
      const box = $('#waPane', pg), ok = Boolean(w.url && w.chaveDefinida);
      box.innerHTML = `<div class="ct-situ"><div class="ct-situ-txt"><span>Servidor de WhatsApp das escolas</span><b>${ok ? 'Ligado · ' + E(w.url.replace(/^https?:\/\//, '')) : 'Ainda não instalado'}</b></div></div>
        <p class="pg-sub" style="margin:12px 0">Um servidor atende todas as escolas e cada uma ganha o WhatsApp próprio <b>automaticamente</b> ao ser criada. ${ok ? 'Para cada escola, só falta ler o QR do número dela (Clientes → Controle → WhatsApp).' : 'Instale uma vez, com um comando, numa máquina Linux grátis (ex.: Oracle Cloud Always Free). O endereço, a chave e o túnel seguro são criados sozinhos.'}</p>
        <div class="ct-quick"><button class="pg-btn green" id="waCmd">${ok ? 'Reinstalar / trocar de máquina' : 'Gerar comando de instalação'}</button>${ok ? '<button class="pg-btn" id="waTesta">Testar conexão</button><button class="pg-btn" id="waLote">Ligar escolas que ainda não têm</button>' : ''}</div>
        <div id="waRes" style="margin-top:14px"></div>
        <details style="margin-top:14px"><summary class="pg-hint" style="cursor:pointer">Avançado: já tenho um servidor Evolution</summary>
          <div class="ct-two" style="margin-top:10px"><div class="pg-field"><label class="pg-label" for="waUrl">Endereço (https)</label><input class="pg-input" id="waUrl" value="${E(w.url)}" placeholder="https://wa.seudominio.com.br"></div>
          <div class="pg-field"><label class="pg-label" for="waKey">Chave mestra</label><input class="pg-input" id="waKey" type="password" autocomplete="off" placeholder="${w.chaveDefinida ? 'já definida — deixe em branco para manter' : 'AUTHENTICATION_API_KEY'}"></div></div>
          <button class="pg-btn" id="waSalva" style="margin-top:8px">Salvar manualmente</button></details>`;
      const res = (h, bom = true) => { $('#waRes', box).innerHTML = `<div class="pg-alert ${bom ? 'ok' : 'bad'}">${h}</div>`; };
      $('#waCmd', box).onclick = async () => {
        try {
          const x = await api('whatsapp-plataforma', { m: 'POST', b: { acao: 'token-instalacao' } });
          $('#waRes', box).innerHTML = `<div class="pg-alert ok"><b>Cole este comando no terminal da máquina (vale por 1 hora, uso único):</b><div class="ct-copy" style="margin-top:8px"><input class="pg-input" readonly value="${E(x.comando)}" aria-label="Comando de instalação"><button class="pg-btn detail" id="waCp">${I('copy')} Copiar</button></div><p class="pg-hint" style="margin-top:8px">Leva uns 3 minutos. No fim, todas as escolas já ficam com o WhatsApp criado; o número de cada uma você liga lendo o QR.</p></div>`;
          $('#waCp', box).onclick = () => copiar(x.comando);
        } catch (e) { res(E(e.message), false); }
      };
      const t1 = $('#waTesta', box); if (t1) t1.onclick = async () => { try { const x = await api('whatsapp-plataforma', { m: 'POST', b: { acao: 'testar' } }); res('Conexão ok. O servidor tem ' + x.instancias + ' instância(s).'); } catch (e) { res(E(e.message), false); } };
      const t2 = $('#waLote', box); if (t2) t2.onclick = async () => {
        t2.disabled = true;
        try { const x = await api('whatsapp-plataforma', { m: 'POST', b: { acao: 'criar-pendentes' } }); res(`${x.criadas.length} escola(s) ligada(s), ${x.jaTinham} já tinha(m)${x.falhas.length ? '; com erro: ' + x.falhas.map(f => E(f.escola + ' (' + f.erro + ')')).join('; ') : ''}${x.restantes ? '. Restam ' + x.restantes + ': clique de novo.' : '.'}`, !x.falhas.length); } catch (e) { res(E(e.message), false); }
        t2.disabled = false;
      };
      $('#waSalva', box).onclick = async () => { try { await api('whatsapp-plataforma', { m: 'PUT', b: { url: $('#waUrl', box).value, apikey: $('#waKey', box).value } }); toast('Servidor de WhatsApp salvo'); } catch (e) { falha(e); } };
    }).catch((e) => { $('#waPane', pg).innerHTML = `<div class="pg-alert bad">${E(e.message)}</div>`; });
    api('asaas').then((a) => asaasTela($('#asaasPane', pg), a)).catch((e) => { $('#asaasPane', pg).innerHTML = `<div class="pg-alert bad">${E(e.message)}</div>`; });
    const mostra = () => { pg.querySelectorAll('[data-pane]').forEach(x => x.hidden = x.dataset.pane !== abaCfg); pg.querySelectorAll('[data-aba]').forEach(x => { x.classList.toggle('on', x.dataset.aba === abaCfg); x.setAttribute('aria-selected', x.dataset.aba === abaCfg); }); };
    pg.querySelectorAll('[data-aba]').forEach(x => x.onclick = () => { abaCfg = x.dataset.aba; mostra(); }); mostra();
    $('#salvar').onclick = async () => { const b = {}; ['empresa_nome', 'empresa_doc', 'empresa_email', 'empresa_whats', 'pix_chave', 'pix_nome', 'pix_cidade', 'dia_venc_padrao', 'contrato_texto'].forEach(k => b[k] = $('#' + k).value);
      if (!b.contrato_texto.trim()) delete b.contrato_texto; try { await api('config', { m: 'PUT', b }); toast('Configurações salvas'); } catch (e) { falha(e); } };
  }

  abrir().then(() => { if (!$('#page') && !$('.pg-login')) entrar(); });
  addEventListener('load', () => { if (!app.innerHTML) entrar(); });
})();
