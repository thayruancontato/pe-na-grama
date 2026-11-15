// Teste automático do que o sistema da escola promete (login, inscrições, portal dos pais, importação, sessões, backup).
// Uso: HOST=https://escola.thayruan.com.br EMAIL=admin@x SENHA=... node scripts/demo/teste-seguranca.mjs
// Cria dados de teste e os apaga no fim (exceto o usuário de teste dos pais, que não tem rota de exclusão).
const { HOST, EMAIL, SENHA } = process.env;
if (!HOST || !EMAIL || !SENHA) { console.error('Defina HOST, EMAIL e SENHA.'); process.exit(2); }
const REG = 'rumo_ao_esporte_2026_registrations';
const req = async (m, p, tk, b) => { const r = await fetch(HOST + p, { method: m, headers: { 'content-type': 'application/json', ...(tk ? { authorization: 'Bearer ' + tk } : {}) }, body: b ? JSON.stringify(b) : undefined }); let j = {}; try { j = await r.json(); } catch { /* sem corpo */ } return [r.status, j]; };
let falhas = 0;
const confere = (nome, ok, extra = '') => { console.log((ok ? 'OK    ' : 'FALHOU') + ' ' + nome + (ok ? '' : ' ' + extra)); if (!ok) falhas++; };

const [, l] = await req('POST', '/sys/auth/login', null, { email: EMAIL, password: SENHA });
confere('login admin', l.role === 'admin');
const tk = l.token;
confere('auditoria sem login recusada', (await req('GET', '/sys/db/auditoria'))[0] === 401);
confere('export sem login recusado', (await req('GET', '/sys/export'))[0] === 401);
confere('gravação sem login recusada', (await req('PUT', '/sys/db/system_settings/x', null, { data: {} }))[0] === 401);

await req('PUT', '/sys/db/system_settings/inscricoes', tk, { data: { abertas: false, mensagem: 'Fechado.' } });
confere('inscrição recusada com formulário fechado', (await req('POST', '/sys/db/' + REG, null, { data: { responsavel: { nome: 'Teste Fechado' }, alunos: [{ nome: 'A' }] } }))[0] === 403);
await req('PUT', '/sys/db/system_settings/inscricoes', tk, { data: { abertas: true, mensagem: '' } });
const [si, ins] = await req('POST', '/sys/db/' + REG, null, { data: { responsavel: { nome: 'Maria Teste Pais', email: 'pais.teste@example.com', cpf: '11144477735' }, alunos: [{ nome: 'Joao Teste', cpf: '52998224725' }] } });
confere('inscrição aceita com formulário aberto', si === 200 && !!ins.id);

// Primeiro acesso do responsável: e-mail do cadastro + CPF como senha (a conta é criada no servidor).
// Se o usuário de teste já existe de uma execução anterior, o admin devolve a senha dele ao CPF (404 na primeira vez é normal).
await req('POST', '/sys/auth/reset', tk, { email: 'pais.teste@example.com', password: '11144477735' });
const [, lp] = await req('POST', '/sys/auth/login', null, { email: 'pais.teste@example.com', password: '11144477735' });
confere('login do responsável', lp.role === 'user');
const todas = (await req('GET', '/sys/db/' + REG, tk))[1].docs || [];
const minhas = (await req('GET', '/sys/db/' + REG, lp.token))[1].docs || [];
confere('responsável vê só a própria inscrição', minhas.length === 1 && todas.length >= minhas.length);
confere('responsável não altera status', (await req('PUT', `/sys/db/${REG}/${ins.id}`, lp.token, { update: true, data: { status: 'aprovado' } }))[0] === 403);
confere('responsável não apaga', (await req('DELETE', `/sys/db/${REG}/${ins.id}`, lp.token))[0] === 403);
confere('responsável não lê professores', ((await req('GET', '/sys/db/teachers', lp.token))[1].docs || []).length === 0);

const [sm, imp] = await req('POST', '/sys/import', tk, { linhas: [{ responsavel_nome: 'Ana Importada', responsavel_email: 'ana@example.com', responsavel_cpf: '39053344705', aluno_nome: 'Beto Importado' }, { responsavel_nome: 'X', aluno_nome: '' }] });
confere('importação: 1 aceito, 1 recusado', sm === 200 && imp.importados === 1 && imp.falhas.length === 1, JSON.stringify(imp));
const importados = ((await req('GET', '/sys/db/' + REG, tk))[1].docs || []).filter((d) => d.data.origem === 'importacao' && d.data.responsavel.email === 'ana@example.com');
for (const d of importados) await req('DELETE', `/sys/db/${REG}/${d.id}`, tk);
await req('DELETE', `/sys/db/${REG}/${ins.id}`, tk);

const ex = await fetch(HOST + '/sys/export', { headers: { authorization: 'Bearer ' + tk } });
const exj = await ex.json();
confere('backup sem a chave do WhatsApp', ex.status === 200 && !exj.docs.some((d) => d.id === 'whatsapp_evolution'));

// sessões revogáveis: por último, porque derruba o token do responsável de teste
await req('POST', '/sys/auth/logout-all', lp.token, {});
confere('token do responsável cai após "sair de todos"', (await req('GET', '/sys/auth/me', lp.token))[0] === 401);
const [, l2] = await req('POST', '/sys/auth/login', null, { email: 'pais.teste@example.com', password: '11144477735' });
confere('novo login depois de revogar funciona', (await req('GET', '/sys/auth/me', l2.token))[0] === 200);

console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo certo');
process.exit(falhas ? 1 : 0);
