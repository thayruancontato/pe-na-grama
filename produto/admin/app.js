// Central do dono do Pé na Grama: pedidos, propostas, contratos, clientes e faturas. Usa o design system em /ds.
(() => {
  const E = PG.esc, I = PG.icon, brl = PG.brl, dt = PG.data;
  const $ = (s, r = document) => r.querySelector(s);
  const app = $('#app');
  const NAV = [['painel', 'Painel', 'chart'], ['pedidos', 'Pedidos', 'inbox'], ['clientes', 'Clientes', 'cap'], ['faturas', 'Faturas', 'receipt'], ['contratos', 'Contratos', 'file'], ['planos', 'Planos', 'tag'], ['config', 'Configurações', 'settings']];
  const ST_LEAD = { novo: ['Novo', 'info'], proposta: ['Proposta enviada', 'warn'], contratado: ['Contratado', 'ok'], perdido: ['Perdido', ''] };
  const ST_CLI = { implantando: ['Implantando', 'warn'], ativo: ['Ativo', 'ok'], cancelado: ['Cancelado', ''] };
  const ST_FAT = { aberta: ['Em aberto', 'warn'], informada: ['Pagamento informado', 'info'], paga: ['Paga', 'ok'], cancelada: ['Cancelada', ''] };
  const CHECK = ['Conta do sistema criada', 'Nome, logo e cores aplicados', 'Endereço do sistema definido', 'WhatsApp da escola conectado', 'Pix da escola configurado', 'Alunos importados', 'Treinamento feito'];

  // ---------- utilidades ----------
  const money = s => { const n = parseFloat(String(s).replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? Math.round(n * 100) : 0; };
  const fmtIn = c => (c / 100).toFixed(2).replace('.', ',');
  const badge = (m, k) => { const [t, c] = m[k] || [k, '']; return `<span class="pg-badge ${c}">${E(t)}</span>`; };
  const digits = s => String(s || '').replace(/\D/g, '');
  const waLink = (tel, msg) => { let d = digits(tel); if (d.length <= 11) d = '55' + d; return 'https://wa.me/' + d + (msg ? '?text=' + encodeURIComponent(msg) : ''); };
  function toast(t) { const e = document.createElement('div'); e.className = 'pg-toast'; e.setAttribute('role', 'status'); e.textContent = t; document.body.appendChild(e); setTimeout(() => e.remove(), 2800); }
  async function copiar(t) { try { await navigator.clipboard.writeText(t); } catch { const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); document.execCommand('copy'); a.remove(); } toast('Copiado'); }
  async function api(p, o = {}) {
    const r = await fetch('/api/admin/' + p, { method: o.m || 'GET', headers: { 'content-type': 'application/json', 'x-pg': '1' }, body: o.b ? JSON.stringify(o.b) : undefined });
    if (r.status === 401) { entrar(); throw new Error('sessao'); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.erro || 'Algo deu errado.');
    return j;
  }
  const falha = e => { if (e.message !== 'sessao') toast(e.message); };

  // ---------- janela ----------
  function modal(titulo, html, onOpen) {
    const back = document.createElement('div'); back.className = 'pg-modal-back';
    back.innerHTML = `<div class="pg-modal" role="dialog" aria-modal="true" aria-label="${E(titulo)}"><div class="pg-modal-head"><div class="pg-card-title">${E(titulo)}</div><button class="pg-x" aria-label="Fechar">${I('x')}</button></div><div class="mbody">${html}</div></div>`;
    const fechar = () => { back.remove(); document.removeEventListener('keydown', esc); };
    const esc = e => { if (e.key === 'Escape') fechar(); };
    back.addEventListener('mousedown', e => { if (e.target === back) fechar(); });
    $('.pg-x', back).onclick = fechar; document.addEventListener('keydown', esc);
    document.body.appendChild(back); $('.pg-x', back).focus();
    if (onOpen) onOpen($('.mbody', back), fechar);
    return { el: $('.mbody', back), fechar };
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
      <nav class="pg-nav" aria-label="Seções">${NAV.map(([id, t, ic]) => `<a class="pg-nav-item" data-r="${id}" href="#/${id}">${I(ic)}<span class="grow">${t}</span></a>`).join('')}</nav>
      <div class="pg-side-foot"><a class="pg-btn side" href="../ds/">Design system</a><button class="pg-btn exit" id="sair">${I('logout')} Sair</button></div></aside>
      <main class="pg-main"><div class="pg-page" id="page"></div></main></div>`;
    $('#sair').onclick = sair;
    $('#side').addEventListener('click', e => { if (e.target.closest('a[data-r]')) $('#side').classList.remove('open'); });
  }
  const cabeca = (titulo, sub, acoes = '') => `<div class="pg-page-head"><div><button class="pg-btn ad-menu" id="menu" aria-label="Abrir menu" style="margin-bottom:10px">${I('menu')} Menu</button><h1 class="pg-title">${titulo}</h1><p class="pg-sub">${sub}</p></div><div class="pg-actions">${acoes}</div></div>`;
  const vazio = (t, d) => `<div class="pg-empty"><b>${t}</b><br>${d || ''}</div>`;

  // ---------- rotas ----------
  const ROTAS = { painel, pedidos, clientes, faturas, contratos, planos, config };
  async function rota() {
    const [r, qs] = (location.hash.replace(/^#\//, '') || 'painel').split('?'), q = new URLSearchParams(qs || '');
    if (r === 'faturas' && q.has('f')) filtroFat = q.get('f');
    document.querySelectorAll('[data-r]').forEach(a => a.classList.toggle('on', a.dataset.r === r));
    const pg = $('#page'); if (!pg) return;
    pg.innerHTML = '<div class="pg-empty">Carregando…</div>';
    try { await (ROTAS[r] || painel)(pg); const ab = +q.get('abrir'); if (ab && r === 'pedidos') detalhePedido(ab); if (ab && r === 'clientes') detalheCliente(ab); } catch (e) { if (e.message !== 'sessao') pg.innerHTML = `<div class="pg-alert bad">${E(e.message)}</div>`; }
    const m = $('#menu'); if (m) m.onclick = () => $('#side').classList.toggle('open');
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
      (faltam ? '<div class="pg-card edge-gold"><div class="pg-card-title">' + I('alert') + ' Falta pouco para vender</div><div class="ad-steps">' + pend.map((x, i) => '<a class="' + (x[2] ? 'ok' : '') + '" href="' + x[1] + '"><span class="n">' + (x[2] ? '✓' : i + 1) + '</span>' + x[0] + '</a>').join('') + '</div></div>' : '') +
      (totalAtencao ? '<div class="pg-card edge-red"><div class="pg-card-title">' + I('alert') + ' Precisa da sua atenção <span class="pg-count" style="margin-left:4px">' + totalAtencao + '</span></div><div class="ad-att">' +
        r.atencao.map(g => '<div class="ad-att-g"><div class="ad-att-h"><span class="pg-badge ' + NIVEL[g.nivel] + '">' + g.itens.length + '</span> ' + E(g.titulo) + '</div>' + g.itens.map(it => '<a class="ad-att-i" href="' + E(it.rota) + '"><span><b>' + E(it.texto) + '</b><small>' + E(it.detalhe) + '</small></span>' + I('chevron') + '</a>').join('') + '</div>').join('') + '</div></div>'
        : '<div class="pg-card edge-green"><div class="pg-card-title">' + I('check') + ' Tudo em dia</div><p class="pg-sub" style="margin-top:8px">Nenhum pedido esperando resposta, nenhuma fatura atrasada e nenhum pagamento para conferir.</p></div>') +
      '<div class="pg-grid-4">' +
        kpi('dark', 'trend', 'Receita mensal recorrente', brl(r.mrr), '<span class="ad-delta ' + (dif >= 0 ? 'up' : 'down') + '">' + E(difTxt) + '</span>') +
        kpi('green', 'check', 'Recebido em ' + MES3[+r.mes.slice(5) - 1], brl(r.recebido_mes.valor), r.recebido_mes.n + ' fatura(s) paga(s)' + (prev ? ' · ' + p + '% do previsto' : '') + '<div class="pg-track ad-onbrand"><i style="width:' + Math.min(100, p) + '%"></i></div>') +
        kpi('', 'users', 'Clientes ativos', r.clientes.ativo, r.clientes.implantando + ' em implantação · ' + r.periodo.clientes_novos + ' novo(s) no mês') +
        kpi('purple', 'dollar', 'Ticket médio', brl(r.ticket), 'Receita anual projetada R$ ' + kk(r.arr)) +
        kpi('', 'inbox', 'Pedidos no mês', r.periodo.pedidos, r.leads.novo + ' esperando resposta agora') +
        kpi('', 'file', 'Contratos assinados no mês', r.periodo.assinados, r.periodo.propostas + ' proposta(s) enviada(s) no mês') +
        kpi('amber', 'clock', 'A receber', brl(r.a_receber.valor), r.a_receber.n + ' fatura(s) em aberto no prazo') +
        kpi('red', 'alert', 'Em atraso', brl(r.atrasado.valor), r.atrasado.n + ' fatura(s) vencida(s)') +
      '</div>' +
      '<div class="ad-split"><div class="pg-card"><div class="pg-card-title">' + I('chart') + ' Receita dos últimos 12 meses</div><p class="pg-card-sub" style="margin-top:4px">Total no período: <b>' + brl(total12) + '</b></p>' +
        '<div class="ad-chart" role="img" aria-label="Receita por mês: ' + E(r.receita_meses.map(m => MES3[+m.mes.slice(5) - 1] + ' ' + brl(m.valor)).join(', ')) + '">' +
        '<div class="ad-grid" aria-hidden="true">' + [1, .5, 0].map(k => '<span><em>' + (k ? 'R$ ' + kk(Math.round(max * k)) : 'R$ 0') + '</em></span>').join('') + '</div>' +
        '<div class="ad-cols">' + r.receita_meses.map(m => '<div class="ad-col' + (m.mes === r.mes ? ' now' : '') + '" title="' + E(MES3[+m.mes.slice(5) - 1] + '/' + m.mes.slice(0, 4) + ': ' + brl(m.valor) + ' em ' + m.n + ' fatura(s)') + '"><div class="bw"><b>' + (m.valor ? kk(m.valor) : '') + '</b><i style="height:' + Math.max(m.valor ? 6 : 2, Math.round(m.valor / max * 150)) + 'px"></i></div><small>' + MES3[+m.mes.slice(5) - 1] + '</small></div>').join('') + '</div></div></div>' +
        '<div class="pg-card"><div class="pg-card-title">' + I('pie') + ' Funil de vendas</div><div class="ad-funil">' +
        [['Pedidos recebidos', f.pedidos, '', 100], ['Propostas enviadas', f.propostas, tx(f.propostas, f.pedidos) + ' dos pedidos', pct(f.propostas, f.pedidos)], ['Contratos assinados', f.assinados, tx(f.assinados, f.propostas) + ' das propostas', pct(f.assinados, f.pedidos)]].map(([n, v, t, w], i) => '<div><div class="l"><span>' + n + '</span><span>' + v + '</span></div><div class="pg-track ' + (i === 2 ? '' : 'blue') + '"><i style="width:' + w + '%"></i></div>' + (t ? '<small class="pg-hint">' + t + '</small>' : '') + '</div>').join('') +
        '</div><dl class="pg-dl" style="margin-top:16px;grid-template-columns:150px 1fr"><dt>Conversão geral</dt><dd><b>' + r.conversao + '%</b></dd><dt>Até assinar</dt><dd>' + (f.dias_ate_assinar == null ? '—' : f.dias_ate_assinar < 1 ? '<b>menos de 1</b> dia em média' : '<b>' + String(f.dias_ate_assinar).replace('.', ',') + '</b> dia(s) em média') + '</dd><dt>Perdidos</dt><dd>' + r.leads.perdido + '</dd></dl></div></div>' +
      '<div class="pg-grid-2"><div class="pg-card"><div class="pg-card-title">' + I('tag') + ' Receita recorrente por plano</div>' +
        (r.por_plano.length ? '<div class="ad-hb">' + r.por_plano.map(x => '<div><div class="l"><span>' + E(x.nome || 'Sem plano') + ' <small>· ' + x.n + ' cliente(s)</small></span><b>' + brl(x.mrr) + '</b></div><div class="pg-track"><i style="width:' + pct(x.mrr, planosTot) + '%"></i></div></div>').join('') + '</div>' : vazio('Sem clientes ainda', 'Quando o primeiro contrato for assinado, a divisão por plano aparece aqui.')) + '</div>' +
        '<div class="pg-card"><div class="pg-card-title">' + I('clock') + ' Vencem nos próximos 7 dias</div>' +
        (r.vencendo.length ? '<div class="pg-table-wrap" style="margin-top:12px"><table class="pg-table"><thead><tr><th>Escola</th><th>Vence</th><th class="num">Valor</th></tr></thead><tbody>' + r.vencendo.map(v => '<tr><td><b>' + E(v.escola) + '</b><small>' + E(v.descricao) + '</small></td><td>' + dt(v.vencimento) + '</td><td class="num">' + brl(v.valor) + '</td></tr>').join('') + '</tbody></table></div>' : vazio('Nada vencendo nesta semana', 'As faturas que vencem em até 7 dias aparecem aqui.')) + '</div></div>' +
      '<div class="ad-split b"><div class="pg-card"><div class="pg-card-title">' + I('inbox') + ' Últimos pedidos</div>' +
        (r.ultimos_pedidos.length ? '<div class="pg-table-wrap" style="margin-top:12px"><table class="pg-table"><thead><tr><th>Escola</th><th>Recebido</th><th>Situação</th><th></th></tr></thead><tbody>' + r.ultimos_pedidos.map(l => '<tr><td><b>' + E(l.escola) + '</b><small>' + E(l.contato_nome) + '</small></td><td>' + idadeTxt(l.criado) + '</td><td>' + badge(ST_LEAD, l.status) + '</td><td class="ac"><a class="pg-btn detail" href="#/pedidos?abrir=' + l.id + '">Abrir</a></td></tr>').join('') + '</tbody></table></div>' : vazio('Nenhum pedido ainda', 'Divulgue o endereço do site: os pedidos chegam aqui sozinhos.')) + '</div>' +
        '<div class="pg-card"><div class="pg-card-title">' + I('clock') + ' Atividades</div>' + (r.atividade.length ? '<div class="ad-feed">' + r.atividade.map(x => '<div><time>' + dt(x.quando).slice(0, 5) + ' ' + new Date(x.quando).toTimeString().slice(0, 5) + '</time><span>' + E(x.texto) + '</span></div>').join('') + '</div>' : vazio('Nada por aqui ainda', 'Pedidos, contratos e pagamentos aparecem neste histórico.')) + '</div></div>' +
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
    pg.innerHTML = cabeca('Pedidos de teste', 'Quem montou o teste no formulário do site.') +
      `<div class="pg-stack"><div class="pg-chips">${chips.map(([k, t]) => `<button class="pg-chip ${filtroPed === k ? 'on info' : ''}" data-f="${k}">${t}</button>`).join('')}</div>
      <div class="pg-table-wrap"><table class="pg-table"><thead><tr><th>Escola</th><th>Contato</th><th>Alunos</th><th>Módulos</th><th>Recebido em</th><th>Situação</th><th></th></tr></thead><tbody>
      ${lista.map(l => `<tr><td><b>${E(l.escola)}</b><small>${E([l.cidade, l.uf].filter(Boolean).join(' / '))}</small></td><td>${E(l.contato_nome)}<small><a class="pg-tag wa" target="_blank" rel="noopener" href="${E(waLink(l.contato_tel))}">WhatsApp</a> ${E(l.contato_tel)}</small></td><td>${E(l.resumo.alunos || '—')}</td><td>${l.resumo.modulos || 0}</td><td>${dt(l.criado)}</td><td>${badge(ST_LEAD, l.status)}</td><td class="ac"><button class="pg-btn detail" data-id="${l.id}">Detalhes</button></td></tr>`).join('')}
      </tbody></table>${lista.length ? '' : vazio('Nenhum pedido ainda', 'Divulgue o endereço do site: os pedidos chegam aqui sozinhos.')}</div></div>`;
    pg.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { filtroPed = b.dataset.f; rota(); });
    pg.querySelectorAll('[data-id]').forEach(b => b.onclick = () => detalhePedido(+b.dataset.id));
  }

  async function detalhePedido(id) {
    const [l, planos, cfg] = await Promise.all([api('leads/' + id), api('planos'), api('config')]);
    const c = l.config || {}, ativos = planos.filter(p => p.ativo);
    const m = modal('Pedido de ' + l.escola, `<div class="pg-stack">
      <div style="display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap">${l.logo ? `<img class="ad-logo" src="${E(l.logo)}" alt="Logo enviada">` : ''}<dl class="pg-dl" style="flex:1;min-width:260px">
        <dt>Situação</dt><dd>${badge(ST_LEAD, l.status)}</dd><dt>Contato</dt><dd>${E(l.contato_nome)} · <a target="_blank" rel="noopener" href="${E(waLink(l.contato_tel))}">${E(l.contato_tel)}</a></dd>${l.contato_email ? `<dt>E-mail</dt><dd>${E(l.contato_email)}</dd>` : ''}
        <dt>Cidade</dt><dd>${E([l.cidade, l.uf].filter(Boolean).join(' / ') || '—')}</dd><dt>Recebido</dt><dd>${dt(l.criado)}</dd>
        <dt>Modalidades</dt><dd>${E((c.modalidades || []).join(', ') || '—')}</dd><dt>Alunos</dt><dd>${E(c.alunos || '—')}</dd><dt>Controle atual</dt><dd>${E(c.controle || '—')}</dd><dt>Maior dor</dt><dd>${E(c.dor || '—')}</dd>
        <dt>Módulos</dt><dd>${E((c.modulos || []).join(', ') || '—')}</dd><dt>Cores</dt><dd><span class="ad-pal">${[c.cor, c.cor2].filter(Boolean).map(x => `<i style="background:${E(x)}" title="${E(x)}"></i>`).join('')}</span></dd></dl></div>
      ${c.templates ? `<details><summary class="pg-link">Mensagens de WhatsApp que ela escolheu</summary><div class="pg-stack" style="margin-top:10px">${Object.entries(c.templates).map(([k, v]) => `<div><div class="pg-label">${E(k)}</div><div class="ad-msg">${E(v)}</div></div>`).join('')}</div></details>` : ''}
      <div class="pg-field"><label class="pg-label" for="nt">Anotações</label><textarea class="pg-textarea" id="nt" style="min-height:80px">${E(l.notas)}</textarea></div>
      ${l.contratos.length ? `<div><div class="ad-sec" style="margin-top:0">Contratos deste pedido</div>${l.contratos.map(k => `<div class="pg-check"><span style="flex:1">${E(k.plano_nome)} · ${brl(k.mensal)}/mês · ${dt(k.criado)}</span><span class="pg-badge ${k.status === 'assinado' ? 'ok' : k.status === 'enviado' ? 'warn' : ''}">${E(k.status)}</span><button class="pg-btn detail" data-copia="${location.origin}/contrato?t=${E(k.token)}">Copiar link</button></div>`).join('')}</div>` : ''}
      <div class="pg-card soft" style="background:var(--surface-soft)"><div class="pg-card-title" style="font-size:16px">${I('file')} Criar proposta e contrato</div>
        ${ativos.length || true ? `<div class="ad-two" style="margin-top:12px"><div class="pg-field"><label class="pg-label" for="pl">Plano</label><select class="pg-select" id="pl"><option value="">Valores manuais</option>${ativos.map(p => `<option value="${p.id}" data-m="${p.mensal}" data-i="${p.implantacao}">${E(p.nome)} · ${brl(p.mensal)}/mês</option>`).join('')}</select></div>
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
          $('#resp', el).innerHTML = `<div class="pg-alert ok">Proposta criada. Mande o link para o cliente.</div><div class="ad-copy" style="margin-top:10px"><input class="pg-input" readonly value="${E(r.link)}" aria-label="Link do contrato"><button class="pg-btn" id="cp">${I('copy')} Copiar</button></div>
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

  async function clientes(pg) {
    const lista = await api('clientes');
    pg.innerHTML = cabeca('Clientes', 'Escolas que assinaram o contrato e o andamento de cada uma.') +
      `<div class="pg-table-wrap"><table class="pg-table"><thead><tr><th>Escola</th><th>Plano</th><th class="num">Mensalidade</th><th>Situação</th><th>Próxima cobrança</th><th>Implantação</th><th></th></tr></thead><tbody>
      ${lista.map(c => { const feitos = CHECK.filter(k => c.checklist[k]).length; return `<tr><td><b>${E(c.escola)}</b><small>${E(c.contato_nome)} · ${E(c.contato_tel)}</small></td><td>${E(c.plano_nome)}</td><td class="num">${brl(c.mensal)}</td>
        <td>${badge(ST_CLI, c.status)}${c.atrasadas ? ` <span class="pg-badge bad">Em atraso · ${brl(c.valor_atrasado)}</span>` : ''}</td><td>${c.proximo ? dt(c.proximo) : '—'}</td>
        <td><div class="pg-track" style="width:110px"><i style="width:${Math.round(feitos / CHECK.length * 100)}%"></i></div><small>${feitos} de ${CHECK.length}</small></td><td class="ac">${btnPainel(c.url_sistema, true)} <button class="pg-btn detail" data-id="${c.id}">Detalhes</button></td></tr>`; }).join('')}</tbody></table>
      ${lista.length ? '' : vazio('Nenhum cliente ainda', 'Quando uma escola assinar o contrato, ela aparece aqui já com a primeira fatura.')}</div>`;
    pg.querySelectorAll('[data-id]').forEach(b => b.onclick = () => detalheCliente(+b.dataset.id));
  }

  async function detalheCliente(id) {
    const c = await api('clientes/' + id);
    modal(c.escola, `<div class="pg-stack"><div style="display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap">${c.logo ? `<img class="ad-logo" src="${E(c.logo)}" alt="Logo">` : ''}<dl class="pg-dl" style="flex:1;min-width:260px">
      <dt>Contato</dt><dd>${E(c.contato_nome)} · <a target="_blank" rel="noopener" href="${E(waLink(c.contato_tel))}">${E(c.contato_tel)}</a></dd>${c.contato_email ? `<dt>E-mail</dt><dd>${E(c.contato_email)}</dd>` : ''}
      <dt>Desde</dt><dd>${dt(c.criado)}</dd>${c.contrato ? `<dt>Contrato</dt><dd>Assinado por ${E(c.contrato.ass_nome)} (doc. ${E(c.contrato.ass_doc)}) em ${dt(c.contrato.assinado_em)}<br><small style="color:var(--medium-gray)">Código de verificação: ${E((c.contrato.ass_hash || '').slice(0, 24))}…</small></dd>` : ''}</dl></div>
      <div class="ad-two"><div class="pg-field"><label class="pg-label" for="st">Situação</label><select class="pg-select" id="st">${Object.entries(ST_CLI).map(([k, v]) => `<option value="${k}" ${c.status === k ? 'selected' : ''}>${v[0]}</option>`).join('')}</select></div>
        <div class="pg-field"><label class="pg-label" for="ur">Endereço do sistema dela</label><input class="pg-input" id="ur" value="${E(c.url_sistema)}" placeholder="https://escola.penagrama.com.br"><div style="margin-top:8px">${btnPainel(c.url_sistema)}</div></div>
        <div class="pg-field"><label class="pg-label" for="mn">Mensalidade (R$)</label><input class="pg-input" id="mn" inputmode="decimal" value="${fmtIn(c.mensal)}"></div>
        <div class="pg-field"><label class="pg-label" for="dv">Dia do vencimento</label><input class="pg-input" id="dv" type="number" min="1" max="28" value="${c.dia_venc}"></div></div>
      <div><div class="ad-sec" style="margin-top:0">Implantação</div>${CHECK.map(k => `<label class="pg-check ${c.checklist[k] ? 'done' : ''}"><input type="checkbox" data-ck="${E(k)}" ${c.checklist[k] ? 'checked' : ''}><span>${E(k)}</span></label>`).join('')}</div>
      <div class="pg-field"><label class="pg-label" for="nt">Anotações</label><textarea class="pg-textarea" id="nt" style="min-height:80px">${E(c.notas)}</textarea></div>
      <div><div class="ad-sec" style="margin-top:0;display:flex;justify-content:space-between;align-items:center"><span>Faturas</span><button class="pg-btn sm" id="nova">${I('plus')} Cobrança avulsa</button></div>
        <div class="pg-table-wrap"><table class="pg-table"><thead><tr><th>Descrição</th><th>Vence</th><th class="num">Valor</th><th>Situação</th><th></th></tr></thead><tbody>${c.faturas.map(f => `<tr><td>${E(f.descricao)}</td><td>${dt(f.vencimento)}</td><td class="num">${brl(f.valor)}</td><td>${badge(ST_FAT, f.status)}</td><td class="ac">${f.status === 'aberta' || f.status === 'informada' ? `<button class="pg-btn detail" data-paga="${f.id}">Marcar paga</button> ` : ''}<button class="pg-btn detail" data-copia="${location.origin}/fatura?t=${E(f.token)}">Copiar link</button></td></tr>`).join('')}</tbody></table></div></div>
      <div class="pg-actions" style="justify-content:flex-end"><button class="pg-btn green" id="salvar">Salvar</button></div></div>`, (el, fechar) => {
      el.querySelectorAll('[data-copia]').forEach(b => b.onclick = () => copiar(b.dataset.copia));
      el.querySelectorAll('[data-paga]').forEach(b => b.onclick = async () => { try { await api('faturas/' + b.dataset.paga, { m: 'PATCH', b: { status: 'paga' } }); toast('Fatura marcada como paga'); fechar(); rota(); } catch (e) { falha(e); } });
      $('#nova', el).onclick = () => cobrancaAvulsa(c, fechar);
      $('#salvar', el).onclick = async () => {
        const checklist = {}; el.querySelectorAll('[data-ck]').forEach(i => checklist[i.dataset.ck] = i.checked);
        try { await api('clientes/' + id, { m: 'PATCH', b: { status: $('#st', el).value, url_sistema: $('#ur', el).value, mensal: money($('#mn', el).value), dia_venc: +$('#dv', el).value, notas: $('#nt', el).value, checklist } }); toast('Cliente salvo'); fechar(); rota(); } catch (e) { falha(e); } };
    });
  }
  function cobrancaAvulsa(c, fecharAntes) {
    modal('Cobrança avulsa · ' + c.escola, `<div class="pg-stack"><div class="pg-field"><label class="pg-label" for="d">Descrição</label><input class="pg-input" id="d" value="Cobrança avulsa"></div><div class="ad-two"><div class="pg-field"><label class="pg-label" for="v">Valor (R$)</label><input class="pg-input" id="v" inputmode="decimal"></div><div class="pg-field"><label class="pg-label" for="w">Vencimento</label><input class="pg-input" id="w" type="date" value="${new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10)}"></div></div><div id="r"></div><div class="pg-actions" style="justify-content:flex-end"><button class="pg-btn green" id="g">Criar cobrança</button></div></div>`, el => {
      $('#g', el).onclick = async () => { try { const r = await api('faturas', { m: 'POST', b: { cliente_id: c.id, descricao: $('#d', el).value, valor: money($('#v', el).value), vencimento: $('#w', el).value } });
        $('#r', el).innerHTML = `<div class="pg-alert ok">Cobrança criada.</div><div class="ad-copy" style="margin-top:10px"><input class="pg-input" readonly value="${E(r.link)}"><button class="pg-btn" id="cp">${I('copy')} Copiar</button></div>`; $('#cp', el).onclick = () => copiar(r.link); $('#g', el).disabled = true; if (fecharAntes) rota(); } catch (e) { falha(e); } };
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
      ${lista.map(f => `<tr><td><b>${E(f.escola)}</b></td><td>${E(f.descricao)}</td><td>${dt(f.vencimento)}</td><td class="num">${brl(f.valor)}</td><td>${badge(ST_FAT, f.status)}${f.atrasada ? ' <span class="pg-badge bad">Atrasada</span>' : ''}${f.pago_em ? `<small>em ${dt(f.pago_em)}</small>` : ''}</td>
        <td class="ac">${f.status === 'aberta' || f.status === 'informada' ? `<button class="pg-btn detail" data-paga="${f.id}">Marcar paga</button> <button class="pg-btn detail" data-cancela="${f.id}">Cancelar</button> ` : ''}<button class="pg-btn detail" data-copia="${E(f.link)}">Copiar link</button></td></tr>`).join('')}</tbody></table>
      ${lista.length ? '' : vazio('Nenhuma fatura aqui', 'As faturas nascem quando o contrato é assinado e todo mês pelas mensalidades.')}</div></div>`;
    pg.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { filtroFat = b.dataset.f; rota(); });
    pg.querySelectorAll('[data-copia]').forEach(b => b.onclick = () => copiar(b.dataset.copia));
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
      ${lista.map(k => `<tr><td><b>${E(k.escola)}</b></td><td>${E(k.plano_nome)}</td><td class="num">${brl(k.mensal)}</td><td>${badge(ST, k.status)}</td><td>${dt(k.criado)}</td><td>${k.ass_nome ? E(k.ass_nome) + `<small>${dt(k.assinado_em)}</small>` : '—'}</td>
        <td class="ac"><button class="pg-btn detail" data-copia="${E(k.link)}">Copiar link</button> ${k.status === 'enviado' ? `<button class="pg-btn detail" data-cancela="${k.id}">Cancelar</button>` : ''}</td></tr>`).join('')}</tbody></table>
      ${lista.length ? '' : vazio('Nenhum contrato ainda', 'Abra um pedido e clique em "Criar proposta".')}</div>`;
    pg.querySelectorAll('[data-copia]').forEach(b => b.onclick = () => copiar(b.dataset.copia));
    pg.querySelectorAll('[data-cancela]').forEach(b => b.onclick = async () => { try { await api('contratos/' + b.dataset.cancela, { m: 'PATCH', b: {} }); toast('Contrato cancelado'); rota(); } catch (e) { falha(e); } });
  }

  // ---------- planos ----------
  async function planos(pg) {
    const lista = await api('planos');
    pg.innerHTML = cabeca('Planos', 'O que você vende e por quanto.', `<button class="pg-btn green" id="novo">${I('plus')} Novo plano</button>`) +
      (lista.length ? `<div class="pg-grid-3">${lista.map(p => `<div class="pg-card soft ad-plan ${p.ativo ? '' : 'off'}"><div class="pg-card-title" style="font-size:16px">${E(p.nome)}</div><div class="v">${brl(p.mensal)}<small style="font:700 13px var(--font-primary);color:var(--medium-gray)"> /mês</small></div><div class="pg-card-sub">Implantação: ${p.implantacao ? brl(p.implantacao) : 'sem cobrança'}</div>${p.descricao ? `<div>${E(p.descricao)}</div>` : ''}<div class="pg-actions"><button class="pg-btn detail" data-ed="${p.id}">Editar</button><button class="pg-btn detail" data-at="${p.id}" data-v="${p.ativo ? 0 : 1}">${p.ativo ? 'Desativar' : 'Reativar'}</button></div></div>`).join('')}</div>` : `<div class="pg-card">${vazio('Você ainda não tem planos', 'Crie o primeiro para poder montar propostas.')}</div>`);
    const form = (p = {}) => `<div class="pg-stack"><div class="pg-field"><label class="pg-label" for="n">Nome</label><input class="pg-input" id="n" value="${E(p.nome || '')}" placeholder="Essencial"></div><div class="ad-two"><div class="pg-field"><label class="pg-label" for="m">Mensalidade (R$)</label><input class="pg-input" id="m" inputmode="decimal" value="${p.mensal ? fmtIn(p.mensal) : ''}"></div><div class="pg-field"><label class="pg-label" for="i">Implantação (R$)</label><input class="pg-input" id="i" inputmode="decimal" value="${fmtIn(p.implantacao || 0)}"></div></div><div class="pg-field"><label class="pg-label" for="d">Descrição</label><input class="pg-input" id="d" value="${E(p.descricao || '')}" placeholder="O que está incluído"></div><div class="pg-actions" style="justify-content:flex-end"><button class="pg-btn green" id="s">Salvar plano</button></div></div>`;
    $('#novo').onclick = () => modal('Novo plano', form(), (el, f) => { $('#s', el).onclick = async () => { try { await api('planos', { m: 'POST', b: { nome: $('#n', el).value, mensal: money($('#m', el).value), implantacao: money($('#i', el).value), descricao: $('#d', el).value } }); f(); rota(); } catch (e) { falha(e); } }; });
    pg.querySelectorAll('[data-ed]').forEach(b => b.onclick = () => { const p = lista.find(x => x.id === +b.dataset.ed); modal('Editar plano', form(p), (el, f) => { $('#s', el).onclick = async () => { try { await api('planos/' + p.id, { m: 'PATCH', b: { nome: $('#n', el).value, mensal: money($('#m', el).value), implantacao: money($('#i', el).value), descricao: $('#d', el).value } }); f(); rota(); } catch (e) { falha(e); } }; }); });
    pg.querySelectorAll('[data-at]').forEach(b => b.onclick = async () => { try { await api('planos/' + b.dataset.at, { m: 'PATCH', b: { ativo: b.dataset.v === '1' } }); rota(); } catch (e) { falha(e); } });
  }

  // ---------- configurações ----------
  async function config(pg) {
    const c = await api('config');
    const f = (id, rot, v, dica, ph = '') => `<div class="pg-field"><label class="pg-label" for="${id}">${rot}</label><input class="pg-input" id="${id}" value="${E(v)}" placeholder="${E(ph)}">${dica ? `<span class="pg-hint">${dica}</span>` : ''}</div>`;
    pg.innerHTML = cabeca('Configurações', 'Seus dados, o Pix que recebe e o texto do contrato.', `<button class="pg-btn green" id="salvar">Salvar tudo</button>`) +
      `<div class="pg-stack"><div class="pg-card"><div class="pg-card-title">${I('users')} Sua empresa</div><div class="ad-two" style="margin-top:14px">${f('empresa_nome', 'Nome', c.empresa_nome, 'Aparece no contrato e na fatura.')}${f('empresa_doc', 'CNPJ ou CPF', c.empresa_doc, 'Vai no texto do contrato.', '00.000.000/0000-00')}${f('empresa_email', 'E-mail', c.empresa_email, '')}${f('empresa_whats', 'WhatsApp (com 55 e DDD)', c.empresa_whats, 'Os clientes falam com você por aqui.', '5533999999999')}</div></div>
      <div class="pg-card"><div class="pg-card-title">${I('dollar')} Pix para receber</div><p class="pg-sub" style="margin-bottom:14px">As faturas geram um Pix "copia e cola" com o valor certo. O dinheiro cai direto na sua conta; depois você marca a fatura como paga.</p><div class="ad-two">${f('pix_chave', 'Chave Pix', c.pix_chave, 'CPF, CNPJ, e-mail, telefone ou chave aleatória.')}${f('pix_nome', 'Nome que aparece no Pix', c.pix_nome, 'Até 25 letras.')}${f('pix_cidade', 'Cidade', c.pix_cidade, 'Até 15 letras.')}${f('dia_venc_padrao', 'Dia de vencimento padrão', c.dia_venc_padrao, 'De 1 a 28.')}</div></div>
      <div class="pg-card"><div class="pg-card-title">${I('file')} Texto do contrato</div><p class="pg-sub" style="margin-bottom:12px">Este é um modelo-base. Peça para um advogado revisar antes de usar. Variáveis: <code>{{empresa}}</code> <code>{{doc_empresa}}</code> <code>{{escola}}</code> <code>{{assinante}}</code> <code>{{plano}}</code> <code>{{mensal}}</code> <code>{{implantacao}}</code> <code>{{dia}}</code> <code>{{data}}</code>. Cada contrato guarda o texto como estava na hora do envio.</p><textarea class="pg-textarea" id="contrato_texto" style="min-height:420px;font-size:13px">${E(c.contrato_texto)}</textarea></div></div>`;
    $('#salvar').onclick = async () => { const b = {}; ['empresa_nome', 'empresa_doc', 'empresa_email', 'empresa_whats', 'pix_chave', 'pix_nome', 'pix_cidade', 'dia_venc_padrao', 'contrato_texto'].forEach(k => b[k] = $('#' + k).value);
      if (!b.contrato_texto.trim()) delete b.contrato_texto; try { await api('config', { m: 'PUT', b }); toast('Configurações salvas'); } catch (e) { falha(e); } };
  }

  abrir().then(() => { if (!$('#page') && !$('.pg-login')) entrar(); });
  addEventListener('load', () => { if (!app.innerHTML) entrar(); });
})();
