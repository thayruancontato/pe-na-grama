// Cria na Central do dono UM cliente fictício e realista (pedido > proposta > contrato assinado > cliente ativo com histórico de faturas).
// Uso: node scripts/demo/seed-cliente-ficticio.mjs https://esporte.thayruan.com.br <senha-do-dono>
// Pessoas, escola e contatos são inventados; o CPF do signatário tem dígitos válidos só para passar na validação.
const [base, senha] = process.argv.slice(2);
let cookie = '';
const req = async (m, p, b, admin) => {
  const r = await fetch(base + p, { method: m, headers: { 'content-type': 'application/json', ...(admin ? { 'x-pg': '1', cookie } : {}) }, body: b ? JSON.stringify(b) : undefined });
  const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`${m} ${p} -> ${r.status} ${JSON.stringify(j)}`);
  return j;
};
await req('POST', '/api/admin/login', { senha });
const planos = await req('GET', '/api/admin/planos', null, true);
const plano = planos.find((p) => /profiss|completo|padr/i.test(p.nome)) || planos.sort((a, b) => b.mensal - a.mensal)[0] || (await req('POST', '/api/admin/planos', { nome: 'Profissional', mensal: 24900, implantacao: 49000, descricao: 'Matrículas, turmas, financeiro com cobrança automática e WhatsApp.' }, true));
const planoId = plano.id ?? (await req('GET', '/api/admin/planos', null, true))[0].id;

const lead = await req('POST', '/api/leads', {
  escola: 'Centro Esportivo Bosque das Araucárias', cidade: 'Curitiba', uf: 'PR', contato_nome: 'Marcelo Tavares Kowalski', contato_tel: '(41) 99872-4410', contato_email: 'secretaria@bosquedasaraucarias.example.com',
  config: { modalidades: ['Futebol', 'Futsal', 'Vôlei', 'Natação'], alunos: '51 a 150', modulos: ['Financeiro e cobranças', 'Mensagens no WhatsApp', 'Turmas e presença', 'Portal do aluno'], dor: 'Cobrar mensalidades sem planilha e avisar atrasos no WhatsApp' }
});
const { token } = await req('POST', `/api/admin/leads/${lead.id}/proposta`, { plano_id: planoId, dia_venc: 10 }, true);
const ass = await req('POST', `/api/contrato/${token}/assinar`, { nome: 'Marcelo Tavares Kowalski', documento: '529.982.247-25', aceito: true });
const clientes = await req('GET', '/api/admin/clientes', null, true);
const c = clientes.find((x) => x.escola === 'Centro Esportivo Bosque das Araucárias');
const faturas = await req('GET', '/api/admin/faturas', null, true);
const primeira = faturas.find((f) => f.token === ass.fatura);
await req('PATCH', `/api/admin/faturas/${primeira.id}`, { status: 'paga' }, true);

const mensal = c.mensal, hoje = new Date();
for (let m = -2; m <= -1; m++) {
  const d = new Date(hoje.getFullYear(), hoje.getMonth() + m, 10), mm = String(d.getMonth() + 1).padStart(2, '0');
  const f = await req('POST', '/api/admin/faturas', { cliente_id: c.id, descricao: `Mensalidade ${mm}/${d.getFullYear()}`, valor: mensal, vencimento: d.toISOString().slice(0, 10) }, true);
  const id = f.id ?? (await req('GET', '/api/admin/faturas', null, true)).find((x) => x.descricao === `Mensalidade ${mm}/${d.getFullYear()}` && x.cliente_id === c.id)?.id;
  await req('PATCH', `/api/admin/faturas/${id}`, { status: 'paga' }, true);
}
await req('PATCH', `/api/admin/clientes/${c.id}`, {
  status: 'ativo', url_sistema: 'https://sistema.bosquedasaraucarias.example.com', notas: 'Implantação concluída em 3 semanas. Importou 125 alunos de planilha. Pediu relatório mensal de inadimplência por e-mail.',
  checklist: Object.fromEntries(['Conta do sistema criada', 'Nome, logo e cores aplicados', 'Endereço do sistema definido', 'WhatsApp da escola conectado', 'Pix da escola configurado', 'Alunos importados', 'Treinamento feito'].map((k) => [k, true]))
}, true);
await req('POST', '/api/admin/faturas/gerar', {}, true);
console.log('cliente criado:', c.escola, '· mensalidade', (mensal / 100).toFixed(2));
