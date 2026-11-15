// Escola 100% FICTÍCIA com dados realistas, para demonstração. Só roda nos emuladores (nunca em produção).
// Nome, CNPJ, pessoas, e-mails e telefones são inventados; CPFs/CNPJ têm dígitos verificadores válidos só para passar nas validações.
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
if (!process.env.FIRESTORE_EMULATOR_HOST) { console.error('Rode dentro do emulador.'); process.exit(1); }

// gerador determinístico: a mesma escola a cada execução
let seed = 20260514;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const pad = (n, l = 2) => String(n).padStart(l, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const cpf = () => {
  const n = Array.from({ length: 9 }, () => Math.floor(rnd() * 10));
  for (let t = 9; t < 11; t++) { let s = 0; for (let i = 0; i < t; i++) s += n[i] * (t + 1 - i); n.push(((s * 10) % 11) % 10); }
  return `${n.slice(0, 3).join('')}.${n.slice(3, 6).join('')}.${n.slice(6, 9).join('')}-${n.slice(9).join('')}`;
};
const hex = (n) => Array.from({ length: n }, () => Math.floor(rnd() * 16).toString(16)).join('');

const ESCOLA = { nome: 'Centro Esportivo Bosque das Araucárias', cnpj: '41.907.253/0001-60', cidade: 'Curitiba', uf: 'PR', fundacao: 2014 };

const nomes = ['Pedro', 'Miguel', 'Arthur', 'Gael', 'Heitor', 'Theo', 'Davi', 'Bernardo', 'Samuel', 'Lorenzo', 'Enzo', 'Benício', 'Matheus', 'Isaac', 'Lucas', 'Caio', 'Gustavo', 'Rafael', 'Felipe', 'Vicente', 'Bruno', 'Otávio', 'Murilo', 'Yuri', 'Joaquim', 'Nicolas', 'Henrique', 'Leonardo', 'Tomás', 'Cauã', 'Diego', 'Kaique', 'Ryan',
  'Helena', 'Alice', 'Laura', 'Manuela', 'Sophia', 'Isabella', 'Luna', 'Valentina', 'Heloísa', 'Maria Clara', 'Cecília', 'Eloá', 'Lívia', 'Giovanna', 'Maitê', 'Antonella', 'Beatriz', 'Júlia', 'Mariana', 'Rebeca'];
const sobrenomes = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves', 'Pereira', 'Lima', 'Gomes', 'Costa', 'Ribeiro', 'Martins', 'Carvalho', 'Almeida', 'Lopes', 'Soares', 'Fernandes', 'Vieira', 'Barbosa', 'Rocha', 'Dias', 'Nascimento', 'Andrade', 'Moreira', 'Nunes', 'Marques', 'Machado', 'Mendes', 'Freitas', 'Cardoso', 'Ramos', 'Teixeira', 'Kowalski', 'Schmidt', 'Pietrowski', 'Zanella', 'Bianchi'];
const pais = ['Carlos', 'Roberto', 'Marcelo', 'Anderson', 'Ricardo', 'Eduardo', 'Fábio', 'Rodrigo', 'Leandro', 'Thiago', 'Juliana', 'Fernanda', 'Patrícia', 'Camila', 'Aline', 'Priscila', 'Renata', 'Vanessa', 'Daniela', 'Luciana', 'Cristiane', 'Simone'];
const bairros = ['Água Verde', 'Bacacheri', 'Batel', 'Boa Vista', 'Boqueirão', 'Cabral', 'Cajuru', 'Centro Cívico', 'Hauer', 'Portão', 'Santa Felicidade', 'São Braz', 'Tarumã', 'Uberaba', 'Xaxim'];
const ruas = ['Rua Mateus Leme', 'Rua Padre Anchieta', 'Av. Água Verde', 'Rua Brigadeiro Franco', 'Rua Carlos de Carvalho', 'Rua Francisco Torres', 'Av. Presidente Wenceslau Braz', 'Rua Nunes Machado'];

const planos = [
  ['futebol', 'Futebol', 135, 65], ['futsal', 'Futsal', 125, 65], ['volei', 'Vôlei', 120, 60], ['natacao', 'Natação', 190, 90],
];
const turmas = [
  ['f1', 'Futebol Sub-8', 'Futebol', '16:00', ['Terça', 'Quinta'], 'Prof. Marcelo Tavares', 18], ['f2', 'Futebol Sub-10', 'Futebol', '17:00', ['Terça', 'Quinta'], 'Prof. Marcelo Tavares', 20],
  ['f3', 'Futebol Sub-12', 'Futebol', '18:00', ['Segunda', 'Quarta'], 'Prof. Diego Ferrari', 20], ['f4', 'Futebol Sub-15', 'Futebol', '19:00', ['Segunda', 'Quarta'], 'Prof. Diego Ferrari', 22],
  ['s1', 'Futsal Sub-9', 'Futsal', '15:30', ['Segunda', 'Quarta'], 'Prof. Renato Pimentel', 16], ['s2', 'Futsal Sub-13', 'Futsal', '17:30', ['Terça', 'Quinta'], 'Prof. Renato Pimentel', 16],
  ['v1', 'Vôlei Feminino Sub-12', 'Vôlei', '16:30', ['Terça', 'Quinta'], 'Profª Camila Bortolini', 14], ['v2', 'Vôlei Misto Sub-15', 'Vôlei', '18:00', ['Segunda', 'Quarta'], 'Profª Camila Bortolini', 14],
  ['n1', 'Natação Iniciante', 'Natação', '14:00', ['Terça', 'Quinta'], 'Profª Larissa Menezes', 10], ['n2', 'Natação Intermediário', 'Natação', '15:00', ['Segunda', 'Quarta', 'Sexta'], 'Profª Larissa Menezes', 10],
];
const idadeTurma = { f1: 7, f2: 9, f3: 11, f4: 14, s1: 8, s2: 12, v1: 11, v2: 14, n1: 7, n2: 11 };

const P = 'demo-rumo';
await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=x', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'rumoaoesporte@admin.com', password: 'demo1234', returnSecureToken: true })
});

const env = await initializeTestEnvironment({ projectId: P, firestore: { host: '127.0.0.1', port: 8089 } });
let counts = { alunos: 0, responsaveis: 0, pagamentos: 0, atrasados: 0 };
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  const set = (c, id, d) => setDoc(doc(db, c, id), d);
  const hoje = new Date();

  await set('system_settings', 'escola_ficticia', { ...ESCOLA, aviso: 'Dados fictícios de demonstração.' });
  for (const [id, modalidade, mensal, matricula] of planos) {
    await set('rumo_ao_esporte_2026_plans', id, { nome: `Mensal ${modalidade}`, modalidade, valores: { mensalidade: { ateVencimento: mensal * 100, aposVencimento: Math.round(mensal * 1.04) * 100 }, matricula: matricula * 100 }, valor: mensal, active: true, isDefault: id === 'futebol', frequencia: 'mensal', paymentDay: 10 });
  }
  for (const [id, nome, modalidade, horario, dias, responsavel, vagas] of turmas) await set('turmas', id, { nome, modalidade, horario, dias, responsavel, ativo: true, vagas });

  // turmas com lotação realista (70% a 95%)
  const lotacao = Object.fromEntries(turmas.map(([id, , , , , , v]) => [id, Math.max(4, Math.round(v * (0.7 + rnd() * 0.25)))]));
  let reg = 0;
  const planoDe = Object.fromEntries(turmas.map(([id, , m]) => [id, planos.find((p) => p[1] === m)]));
  const fila = Object.entries(lotacao).flatMap(([id, n]) => Array(n).fill(id));
  while (fila.length) {
    reg++;
    const sob = pick(sobrenomes), pai = pick(pais);
    const turmaId = fila.splice(Math.floor(rnd() * fila.length), 1)[0];
    const irmaos = [turmaId];
    // ~15% das famílias têm dois filhos matriculados (às vezes na mesma modalidade)
    if (rnd() < 0.15 && fila.length) {
      const mesma = fila.findIndex((t) => planoDe[t][1] === planoDe[turmaId][1]);
      if (mesma >= 0) irmaos.push(fila.splice(mesma, 1)[0]);
    }
    const id = `reg${reg}`, plano = planoDe[turmaId];
    const alunos = irmaos.map((t) => {
      const ano = hoje.getFullYear() - idadeTurma[t] - Math.floor(rnd() * 2);
      return { nome: `${pick(nomes)} ${sob}`, dataNascimento: `${ano}-${pad(1 + Math.floor(rnd() * 12))}-${pad(1 + Math.floor(rnd() * 28))}`, turmaId: t };
    });
    const valor = plano[2] + (alunos.length > 1 ? Math.round(plano[2] * 0.9) : 0); // 2º filho com 10% de desconto
    const r = rnd();
    const situ = r < 0.12 ? 'atrasado' : r < 0.3 ? 'pendente' : 'pago';
    const meses = 1 + Math.floor(rnd() * 6);
    const criado = new Date(hoje); criado.setMonth(criado.getMonth() - meses); criado.setDate(1 + Math.floor(rnd() * 25));
    const ddd = pick(['41', '41', '41', '42']);
    const nomeResp = `${pai} ${sob} ${pick(sobrenomes)}`;
    await set('rumo_ao_esporte_2026_registrations', id, {
      responsavel: {
        nome: nomeResp, cpf: cpf(), email: `${pai.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '')}.${sob.toLowerCase()}${10 + Math.floor(rnd() * 89)}@exemplo.com.br`,
        telefonePrincipal: `(${ddd}) 9${8000 + Math.floor(rnd() * 1999)}-${pad(Math.floor(rnd() * 9999), 4)}`,
        endereco: { logradouro: pick(ruas), numero: String(40 + Math.floor(rnd() * 1800)), bairro: pick(bairros), cidade: 'Curitiba', uf: 'PR', cep: `80${pad(Math.floor(rnd() * 999), 3)}-${pad(Math.floor(rnd() * 999), 3)}` }
      },
      modalidade: plano[1], createdAt: criado.toISOString(), status: situ, contractStatus: 'aprovado', planId: plano[0], associadoUba: false, alunos,
      financialPendingAmount: situ === 'pago' ? 0 : valor, financialPendingDescription: 'Mensalidade', financialInvoiceUrl: situ === 'pago' ? '' : '#', financialReceivedAmount: situ === 'pago' ? valor : 0
    });
    counts.responsaveis++; counts.alunos += alunos.length;

    const forma = pick(['PIX', 'PIX', 'PIX', 'BOLETO']);
    for (let m = -(meses - 1); m <= 0; m++) {
      const due = new Date(hoje.getFullYear(), hoje.getMonth() + m, 10);
      const atual = m === 0;
      const status = !atual ? 'RECEIVED' : situ === 'pago' ? 'RECEIVED' : situ === 'atrasado' ? 'OVERDUE' : 'PENDING';
      const pago = new Date(due); pago.setDate(due.getDate() - Math.floor(rnd() * 5) + (rnd() < 0.15 ? 3 : 0));
      if (status === 'OVERDUE') counts.atrasados++;
      counts.pagamentos++;
      await set('financial_payments', `inv_${hex(24)}`, {
        studentId: id, customer: id, value: valor, netValue: valor, status, billingType: forma, provider: 'cora', dueDate: iso(due),
        paymentDate: status === 'RECEIVED' ? iso(pago) : null, dateCreated: iso(new Date(due.getFullYear(), due.getMonth(), 1)),
        description: `Mensalidade ${pad(due.getMonth() + 1)}/${due.getFullYear()} - ${alunos.map((a) => a.nome.split(' ')[0]).join(' e ')} (${plano[1]})`,
        invoiceUrl: '#', externalReference: `${id}_${m + meses}_${hex(6)}`
      });
    }
  }
});
await env.cleanup();
console.log(`escola fictícia criada: ${ESCOLA.nome} (${ESCOLA.cnpj}) · ${counts.responsaveis} famílias, ${counts.alunos} alunos, ${turmas.length} turmas, ${counts.pagamentos} cobranças (${counts.atrasados} atrasadas)`);
