// Dados 100% fictícios para tirar prints do sistema. Só roda dentro dos emuladores (veja scripts/demo/README).
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
if (!process.env.FIRESTORE_EMULATOR_HOST) { console.error('Rode dentro do emulador.'); process.exit(1); }
const P = 'demo-rumo';
const iso = (off) => { const d = new Date(); d.setDate(d.getDate() + off); return d.toISOString().slice(0, 10); };
const mes = (off) => { const d = new Date(); d.setDate(10); d.setMonth(d.getMonth() + off); return d; };
const dstr = (d) => d.toISOString().slice(0, 10);

await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=x', { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'rumoaoesporte@admin.com', password: 'demo1234', returnSecureToken: true }) });

const env = await initializeTestEnvironment({ projectId: P, firestore: { host: '127.0.0.1', port: 8089 } });
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  const set = (c, id, d) => setDoc(doc(db, c, id), d);
  await set('rumo_ao_esporte_2026_plans', 'plano1', { nome: 'Mensal Futebol', modalidade: 'Futebol', valores: { mensalidade: { ateVencimento: 12000, aposVencimento: 12500 }, matricula: 0 }, valor: 120, active: true, isDefault: true, frequencia: 'mensal', paymentDay: 10 });
  const turmas = [
    ['t1', 'Sub-9', '17:00', ['Terça', 'Quinta'], 'Prof. Marcos'], ['t2', 'Sub-11', '18:00', ['Terça', 'Quinta'], 'Prof. Marcos'],
    ['t3', 'Sub-13', '17:00', ['Segunda', 'Quarta'], 'Prof. Rafael'], ['t4', 'Sub-15', '18:30', ['Segunda', 'Quarta'], 'Prof. Rafael'],
  ];
  for (const [id, nome, horario, dias, responsavel] of turmas) await set('turmas', id, { nome, modalidade: 'Futebol', horario, dias, responsavel, ativo: true, vagas: 20 });
  const alunos = ['Pedro Lima','Miguel Souza','Arthur Costa','Gael Ferreira','Heitor Almeida','Theo Martins','Davi Oliveira','Bernardo Gomes','Samuel Ribeiro','Lorenzo Carvalho','Noah Araújo','Enzo Mendes','Benício Rocha','Matheus Dias','Isaac Moreira','Lucas Nunes','Caio Castro','Gustavo Cardoso','Rafael Teixeira','Felipe Correia','Vicente Pinto','Bruno Freitas','Otávio Barros','Murilo Lopes','Yuri Santos','André Melo','Joaquim Reis','Nicolas Vieira','Henrique Duarte','Leonardo Cunha','Davi Lucca','Tomás Ramos','Emanuel Nogueira','Cauã Farias','Diego Pires','Ícaro Batista','Kaique Moraes','Luiz Fagundes','Mateus Borges','Ryan Machado'];
  const resp = ['Carla','Roberto','Fernanda','Marcelo','Juliana','Anderson','Patrícia','Ricardo','Camila','Eduardo'];
  const sob = ['Lima','Souza','Costa','Ferreira','Almeida','Martins','Oliveira','Gomes','Ribeiro','Carvalho'];
  for (let i = 0; i < alunos.length; i++) {
    const id = 'reg' + (i + 1), turma = turmas[i % 4][0], plano = 'plano1';
    const nasc = 2010 + (i % 4) * 2 + (i % 2);
    const situ = i % 10 === 0 ? 'atrasado' : i % 5 === 1 ? 'pendente' : 'pago';
    const aprovado = i % 13 !== 12;
    const created = new Date(); created.setDate(created.getDate() - 20 - i * 5);
    const nomeResp = `${resp[i % 10]} ${sob[(i * 3) % 10]}`;
    await set('rumo_ao_esporte_2026_registrations', id, {
      responsavel: { nome: nomeResp, cpf: '000.000.000-00', email: `responsavel${i + 1}@exemplo.com`, telefonePrincipal: `(11) 9${String(80000000 + i * 1371).slice(0, 4)}-${String(1000 + i * 37).slice(0, 4)}` },
      modalidade: 'Futebol', createdAt: created.toISOString(), status: aprovado ? situ : 'pendente', contractStatus: aprovado ? 'aprovado' : 'pendente', planId: plano, associadoUba: false,
      alunos: [{ nome: alunos[i], dataNascimento: `${nasc}-0${(i % 9) + 1}-1${i % 9}`, turmaId: turma }],
      financialPendingAmount: situ === 'pago' ? 0 : 120, financialPendingDescription: 'Mensalidade', financialInvoiceUrl: situ === 'pago' ? '' : '#', financialReceivedAmount: situ === 'pago' ? 120 : 0,
    });
    if (!aprovado) continue;
    for (let m = -5; m <= 0; m++) {
      const due = mes(m); const cur = m === 0;
      const status = !cur ? 'RECEIVED' : situ === 'pago' ? 'RECEIVED' : situ === 'atrasado' ? 'OVERDUE' : 'PENDING';
      const pay = new Date(due); pay.setDate(due.getDate() - (i % 4));
      await set('financial_payments', `p${i}_${m + 5}`, { studentId: id, value: 120, status, dueDate: dstr(status === 'OVERDUE' ? mes(-1) : due), paymentDate: status.startsWith('RECEIVED') ? dstr(pay) : null, dateCreated: dstr(due), description: `Mensalidade ${String(due.getMonth() + 1).padStart(2, '0')}/${due.getFullYear()}`, invoiceUrl: '#', externalReference: `MONTHLY_${id}_${m}` });
    }
  }
});
await env.cleanup();
console.log('seed ok');
