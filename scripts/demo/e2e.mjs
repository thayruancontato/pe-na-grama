// Teste de ponta a ponta do fluxo de venda. Uso: node scripts/demo/e2e.mjs http://127.0.0.1:8788 senha
// ATENÇÃO: cria registros de teste no banco do endereço informado. Use só no ambiente local.
const [base, senha] = process.argv.slice(2);
let cookie = '';
const req = async (m, p, b, admin) => {
  const r = await fetch(base + p, { method: m, headers: { 'content-type': 'application/json', ...(admin ? { 'x-pg': '1', cookie } : {}) }, body: b ? JSON.stringify(b) : undefined });
  const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  let j = null; try { j = await r.json(); } catch {}
  return { s: r.status, j };
};
let falhas = 0;
const ok = (nome, cond, extra = '') => { console.log((cond ? 'ok   ' : 'FALHA') + ' ' + nome + (cond ? '' : ' ' + extra)); if (!cond) falhas++; };

let r = await req('POST', '/api/admin/login', { senha: 'errada' }); ok('login com senha errada é recusado', r.s === 401, r.s);
r = await req('GET', '/api/admin/resumo', null, true); ok('painel sem sessão é recusado', r.s === 401, r.s);
r = await req('POST', '/api/leads', { escola: '', contato_nome: 'A', contato_tel: '1' }); ok('pedido inválido é recusado', r.s === 400, r.s);
r = await req('POST', '/api/leads', { escola: 'Escola Teste E2E', cidade: 'Manhuaçu', uf: 'MG', contato_nome: 'Maria Teste', contato_tel: '(33) 99988-7766', contato_email: 'maria@exemplo.com', config: { modalidades: ['Futebol'], alunos: '51 a 150', modulos: ['Financeiro e cobranças', 'Mensagens no WhatsApp'], dor: 'Cobrar mensalidades' } });
ok('pedido do formulário é gravado', r.s === 200 && r.j.id > 0, JSON.stringify(r)); const leadId = r.j && r.j.id;
r = await req('POST', '/api/leads', { site: 'robo', escola: 'X', contato_nome: 'Robô', contato_tel: '33999999999' }); ok('campo-isca devolve ok sem gravar', r.s === 200 && !r.j.id, JSON.stringify(r));

r = await req('POST', '/api/admin/login', { senha }); ok('login do dono', r.s === 200 && cookie.startsWith('pg_admin='), JSON.stringify(r));
r = await req('POST', '/api/admin/planos', { nome: 'Plano Teste', mensal: 14900, implantacao: 30000, descricao: 'teste' }, true); ok('cria plano', r.s === 200, JSON.stringify(r)); const planoId = r.j.id;
r = await req('PUT', '/api/admin/config', { empresa_nome: 'Pé na Grama', empresa_doc: '12.345.678/0001-95', pix_chave: 'pagamentos@exemplo.com', pix_nome: 'Pé na Grama Sistemas', pix_cidade: 'Manhuaçu', empresa_whats: '5533998200546' }, true); ok('salva configurações', r.s === 200, JSON.stringify(r));
r = await req('GET', '/api/admin/leads', null, true); ok('lista pedidos', r.s === 200 && r.j.some(l => l.id === leadId), JSON.stringify(r).slice(0, 200));
r = await req('POST', `/api/admin/leads/${leadId}/proposta`, { plano_id: planoId, dia_venc: 10 }, true); ok('cria proposta e link do contrato', r.s === 200 && /contrato\?t=[0-9a-f]{48}/.test(r.j.link), JSON.stringify(r)); const t = r.j.token;
r = await req('GET', '/api/contrato/' + t); ok('cliente abre o contrato', r.s === 200 && r.j.mensal === 14900 && r.j.texto.includes('Escola Teste E2E') && !r.j.texto.includes('{{'), JSON.stringify(r).slice(0, 200));
r = await req('POST', `/api/contrato/${t}/assinar`, { nome: 'Maria Teste', documento: '111.111.111-11', aceito: true }); ok('CPF inválido é recusado', r.s === 400, JSON.stringify(r));
r = await req('POST', `/api/contrato/${t}/assinar`, { nome: 'Maria Teste', documento: '529.982.247-25', aceito: false }); ok('sem aceite é recusado', r.s === 400, JSON.stringify(r));
r = await req('POST', `/api/contrato/${t}/assinar`, { nome: 'Maria Teste', documento: '529.982.247-25', aceito: true }); ok('assinatura grava e devolve a fatura', r.s === 200 && /^[0-9a-f]{32}$/.test(r.j.fatura), JSON.stringify(r)); const ft = r.j.fatura;
r = await req('POST', `/api/contrato/${t}/assinar`, { nome: 'Maria Teste', documento: '529.982.247-25', aceito: true }); ok('assinar de novo é recusado', r.s === 409, JSON.stringify(r));
r = await req('GET', '/api/fatura/' + ft); ok('fatura traz Pix com valor de implantação + mensalidade', r.s === 200 && r.j.valor === 44900 && r.j.pix && r.j.pix.payload.startsWith('000201') && r.j.pix.payload.includes('44900'.slice(0, 0) + '449.00'), JSON.stringify(r).slice(0, 300));
const pl = r.j.pix.payload, crc = (() => { let c = 0xFFFF; const s = pl.slice(0, -4); for (let i = 0; i < s.length; i++) { c ^= s.charCodeAt(i) << 8; for (let j = 0; j < 8; j++) c = (c & 0x8000) ? ((c << 1) ^ 0x1021) & 0xFFFF : (c << 1) & 0xFFFF; } return c.toString(16).toUpperCase().padStart(4, '0'); })();
ok('CRC do Pix confere', pl.endsWith(crc), pl);
r = await req('POST', `/api/fatura/${ft}/paguei`, {}); ok('cliente informa pagamento', r.s === 200 && r.j.status === 'informada', JSON.stringify(r));
r = await req('GET', '/api/admin/clientes', null, true); ok('cliente aparece na lista', r.s === 200 && r.j.some(c => c.escola === 'Escola Teste E2E' && c.status === 'implantando'), JSON.stringify(r).slice(0, 200)); const cid = r.j.find(c => c.escola === 'Escola Teste E2E').id;
r = await req('GET', '/api/admin/faturas', null, true); const fat = r.j.find(f => f.token === ft); ok('fatura aparece como informada', fat && fat.status === 'informada', JSON.stringify(fat));
r = await req('PATCH', `/api/admin/faturas/${fat.id}`, { status: 'paga' }, true); ok('dono marca como paga', r.s === 200, JSON.stringify(r));
r = await req('PATCH', `/api/admin/clientes/${cid}`, { status: 'ativo', checklist: { 'Conta criada': true }, url_sistema: 'https://teste.exemplo.com' }, true); ok('cliente vira ativo', r.s === 200, JSON.stringify(r));
r = await req('POST', '/api/admin/faturas/gerar', {}, true); ok('gera mensalidades (idempotente)', r.s === 200 && typeof r.j.criadas === 'number', JSON.stringify(r));
r = await req('POST', '/api/admin/faturas', { cliente_id: cid, descricao: 'Avulsa', valor: 5000, vencimento: '2020-01-01' }, true); ok('cria fatura avulsa vencida', r.s === 200, JSON.stringify(r));
r = await req('GET', '/api/admin/resumo', null, true); ok('resumo soma tudo', r.s === 200 && r.j.clientes.ativo >= 1 && r.j.recebido_mes.valor >= 44900 && r.j.atrasado.n >= 1 && r.j.leads.contratado >= 1, JSON.stringify(r.j));
r = await req('GET', `/api/admin/clientes/${cid}`, null, true); ok('detalhe do cliente', r.s === 200 && r.j.contrato && r.j.contrato.ass_hash && r.j.faturas.length >= 2, JSON.stringify(r).slice(0, 200));
r = await req('POST', '/api/admin/logout', {}, true); r = await fetch(base + '/api/admin/resumo', { headers: { 'x-pg': '1', cookie: '' } }); ok('sem cookie volta a recusar', r.status === 401, r.status);
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTudo certo');
process.exit(falhas ? 1 : 0);
