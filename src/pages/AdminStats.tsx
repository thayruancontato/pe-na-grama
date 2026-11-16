import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, Timestamp } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Printer, FileText } from 'lucide-react';
import { db } from '../firebase';
import { planService } from '../utils/planService';
import { expenseService } from '../utils/expenseService';
import { generateOverduePDF } from './AdminDashboard/utils/pdfGenerator';
import PaymentReceiptModal from '../components/admin/PaymentReceiptModal';
import '../styles/estatisticas.css';

const PAGO = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH', 'pago', 'confirmado'];
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const brl = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const dataDe = (x: any): Date | null => {
    if (!x) return null;
    if (x instanceof Timestamp) return x.toDate();
    if (typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x)) { const [a, m, d] = x.split('-').map(Number); return new Date(a, m - 1, d); }
    const d = new Date(x); return isNaN(d.getTime()) ? null : d;
};
const valorPlano = (p: any) => (p?.valores?.mensalidade?.ateVencimento || p?.valor || 0) / 100;

type Reg = any;

export default function AdminStats() {
    const workerUrl = import.meta.env.VITE_WORKER_URL || '';
    const hoje = new Date();
    const [mes, setMes] = useState({ ano: hoje.getFullYear(), m: hoje.getMonth() });
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState('');
    const [regs, setRegs] = useState<Reg[]>([]);
    const [pags, setPags] = useState<any[]>([]);
    const [planos, setPlanos] = useState<any[]>([]);
    const [gastos, setGastos] = useState<any[]>([]);
    const [recibo, setRecibo] = useState<any | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const [r, p, pl, g] = await Promise.all([
                    getDocs(collection(db, 'rumo_ao_esporte_2026_registrations')),
                    getDocs(collection(db, 'financial_payments')),
                    planService.getPlans(),
                    expenseService.listExpenses(workerUrl),
                ]);
                setRegs(r.docs.map((d) => ({ id: d.id, ...d.data() })));
                setPags(p.docs.map((d) => ({ id: d.id, ...d.data() })));
                setPlanos(pl || []);
                setGastos(g || []);
            } catch (e) { setErro('Não foi possível carregar os dados.'); console.error(e); }
            finally { setCarregando(false); }
        })();
    }, [workerUrl]);

    // ---------- base: alunos ativos (contrato aprovado, fora os desativados) ----------
    const ativos = useMemo(() => regs.filter((r) => String(r.contractStatus || '').toLowerCase() === 'aprovado'), [regs]);
    const pendentes = useMemo(() => regs.filter((r) => !['aprovado', 'desativado'].includes(String(r.contractStatus || '').toLowerCase())), [regs]);
    const nAlunos = (r: Reg) => (Array.isArray(r.alunos) && r.alunos.length) || 1;
    const modalidade = (r: Reg) => cap(String(r.modalidade || 'Outros'));

    const mensalidade = (r: Reg) => {
        const plano = planos.find((p) => p.id === r.planId) || planos.find((p) => p.active && String(p.modalidade || '').toLowerCase() === String(r.modalidade || '').toLowerCase());
        return valorPlano(plano) * nAlunos(r);
    };
    const mrr = useMemo(() => ativos.reduce((t, r) => t + mensalidade(r), 0), [ativos, planos]); // eslint-disable-line react-hooks/exhaustive-deps

    // ---------- mês selecionado ----------
    const doMes = (d: Date | null) => !!d && d.getFullYear() === mes.ano && d.getMonth() === mes.m;
    const nomePagador = (p: any) => {
        const r = regs.find((x) => x.id === p.studentId);
        return r?.alunos?.[0]?.nome || r?.responsavel?.nome || 'Desconhecido';
    };
    const recebidos = useMemo(() => pags
        .filter((p) => PAGO.includes(p.status))
        .map((p) => ({ ...p, quando: dataDe(p.paymentDate || p.dateCreated || p.lastUpdate) }))
        .filter((p) => doMes(p.quando))
        .sort((a, b) => (b.quando as Date).getTime() - (a.quando as Date).getTime()), [pags, mes]); // eslint-disable-line react-hooks/exhaustive-deps
    const gastosMes = useMemo(() => gastos.filter((g) => doMes(dataDe(g.scheduleDate))), [gastos, mes]); // eslint-disable-line react-hooks/exhaustive-deps
    const receita = recebidos.reduce((t, p) => t + (p.value || 0), 0);
    const despesa = gastosMes.reduce((t, g) => t + (g.value || 0), 0);
    // Tarifas da Cora: Pix = 1% (máx. R$ 0,50) por cobrança; boleto compensado = R$ 1,70.
    const tarifas = recebidos.reduce((t, p) => { const tp = String(p.billingType || '').toUpperCase(); return t + (tp === 'PIX' ? Math.min((p.value || 0) * 0.01, 0.5) : tp === 'BOLETO' ? 1.7 : 0); }, 0);
    const lucro = receita - despesa - tarifas;

    // ---------- inadimplência e a receber ----------
    const emAtraso = useMemo(() => ativos.filter((r) => ['overdue', 'atrasado', 'OVERDUE'].includes(r.status) && (r.financialPendingAmount || 0) > 0).map((r) => {
        const abertas = pags.filter((p) => p.studentId === r.id && !PAGO.concat(['DELETED', 'REFUNDED', 'REMOVED_BY_RECEIVER']).includes(p.status) && p.dueDate && new Date(p.dueDate) < new Date())
            .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
        const dias = abertas[0] ? Math.floor((Date.now() - new Date(abertas[0].dueDate).getTime()) / 864e5) : 0;
        return { ...r, daysOverdue: dias, oldestDueDate: abertas[0]?.dueDate, pendingItems: abertas.map((p) => ({ description: p.description, value: p.value, dueDate: p.dueDate })) };
    }).sort((a, b) => b.daysOverdue - a.daysOverdue), [ativos, pags]);
    const valorAtraso = emAtraso.reduce((t, r) => t + (r.financialPendingAmount || 0), 0);
    const aReceber = useMemo(() => ativos.filter((r) => !PAGO.includes(r.status) && r.status !== 'vazio' && (r.financialPendingAmount || 0) > 0), [ativos]);
    const valorAReceber = aReceber.reduce((t, r) => t + (r.financialPendingAmount || 0), 0);

    // ---------- distribuições ----------
    const porModalidade = useMemo(() => {
        const m: Record<string, { alunos: number; mrr: number; receita: number }> = {};
        ativos.forEach((r) => { const k = modalidade(r); m[k] ||= { alunos: 0, mrr: 0, receita: 0 }; m[k].alunos += nAlunos(r); m[k].mrr += mensalidade(r); });
        recebidos.forEach((p) => { const r = regs.find((x) => x.id === p.studentId); const k = cap(String(r?.modalidade || 'Outros')); m[k] ||= { alunos: 0, mrr: 0, receita: 0 }; m[k].receita += p.value || 0; });
        return Object.entries(m).sort((a, b) => b[1].mrr - a[1].mrr);
    }, [ativos, recebidos, regs, planos]); // eslint-disable-line react-hooks/exhaustive-deps
    const faixas = useMemo(() => {
        const f = { '0 a 5 anos': 0, '6 a 12 anos': 0, '13 a 17 anos': 0, '18 anos ou mais': 0 };
        ativos.forEach((r) => (r.alunos || []).forEach((a: any) => {
            const t = String(a.dataNascimento || ''), iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
            const [d, m, y] = iso ? [+iso[3], +iso[2], +iso[1]] : t.split('/').map(Number); if (!y || !m) return;
            const idade = hoje.getFullYear() - y - (hoje.getMonth() + 1 < m || (hoje.getMonth() + 1 === m && hoje.getDate() < d) ? 1 : 0);
            f[idade <= 5 ? '0 a 5 anos' : idade <= 12 ? '6 a 12 anos' : idade <= 17 ? '13 a 17 anos' : '18 anos ou mais']++;
        }));
        return Object.entries(f);
    }, [ativos]); // eslint-disable-line react-hooks/exhaustive-deps
    const crescimento = useMemo(() => {
        const out: { rotulo: string; n: number }[] = [];
        for (let i = 11; i >= 0; i--) {
            const d = new Date(mes.ano, mes.m - i, 1);
            out.push({ rotulo: MESES[d.getMonth()].slice(0, 3) + '/' + String(d.getFullYear()).slice(2), n: regs.filter((r) => { const c = dataDe(r.createdAt); return c && c.getFullYear() === d.getFullYear() && c.getMonth() === d.getMonth() && String(r.contractStatus || '').toLowerCase() !== 'desativado'; }).length });
        }
        return out;
    }, [regs, mes]);
    const maxCresc = Math.max(1, ...crescimento.map((c) => c.n));
    const maxFaixa = Math.max(1, ...faixas.map((f) => f[1]));
    const totalAlunos = ativos.reduce((t, r) => t + nAlunos(r), 0);
    const novosNoMes = regs.filter((r) => doMes(dataDe(r.createdAt)) && String(r.contractStatus || '').toLowerCase() !== 'desativado').length;

    const anterior = () => setMes((x) => (x.m === 0 ? { ano: x.ano - 1, m: 11 } : { ...x, m: x.m - 1 }));
    const proximo = () => setMes((x) => (x.m === 11 ? { ano: x.ano + 1, m: 0 } : { ...x, m: x.m + 1 }));

    if (carregando) return <div className="est"><p className="est-vazio">Carregando estatísticas…</p></div>;
    if (erro) return <div className="est"><p className="est-vazio">{erro}</p></div>;

    return (
        <div className="est">
            <div className="est-topo">
                <div>
                    <h1>Estatísticas</h1>
                    <p>Visão geral dos alunos, do financeiro e do crescimento da escola.</p>
                </div>
                <div className="est-acoes">
                    <Link to="/admin/financeiro/relatorio" className="est-btn"><FileText size={14} /> Relatório financeiro</Link>
                    <button className="est-btn" onClick={() => window.print()}><Printer size={14} /> Imprimir</button>
                </div>
            </div>

            <div className="est-filtro">
                <button className="est-btn" onClick={anterior} aria-label="Mês anterior"><ChevronLeft size={14} /></button>
                <strong>{MESES[mes.m]} de {mes.ano}</strong>
                <button className="est-btn" onClick={proximo} aria-label="Próximo mês"><ChevronRight size={14} /></button>
                <span className="est-dica">Receita, despesas e lucro seguem o mês escolhido. Alunos, mensalidades e inadimplência mostram a situação de hoje.</span>
            </div>

            <div className="est-kpis">
                <Kpi cor="verde" rotulo="Receita do mês" valor={brl(receita)} nota={`${recebidos.length} pagamento(s)`} />
                <Kpi cor="vermelho" rotulo="Despesas do mês" valor={brl(despesa)} nota={`${gastosMes.length} lançamento(s)`} />
                <Kpi cor={lucro >= 0 ? 'azul' : 'vermelho'} rotulo="Lucro líquido" valor={brl(lucro)} nota={`Já descontadas as tarifas (${brl(tarifas)})`} />
                <Kpi cor="azul" rotulo="Receita mensal prevista" valor={brl(mrr)} nota="Mensalidades dos planos ativos" />
                <Kpi cor="cinza" rotulo="Alunos ativos" valor={String(totalAlunos)} nota={`${ativos.length} cadastro(s) · ${novosNoMes} novo(s) no mês`} />
                <Kpi cor="amarelo" rotulo="A receber" valor={brl(valorAReceber)} nota={`${aReceber.length} cadastro(s)`} />
                <Kpi cor="vermelho" rotulo="Inadimplência" valor={brl(valorAtraso)} nota={`${emAtraso.length} em atraso`} />
                <Kpi cor="cinza" rotulo="Aguardando aprovação" valor={String(pendentes.length)} nota="Cadastros pendentes" />
            </div>

            <div className="est-grade">
                <Painel titulo="Modalidades" nota="Alunos ativos, previsão mensal e recebido no mês">
                    <table className="est-tab"><thead><tr><th>Modalidade</th><th className="n">Alunos</th><th className="n">Previsto</th><th className="n">Recebido</th></tr></thead>
                        <tbody>{porModalidade.length ? porModalidade.map(([k, v]) => <tr key={k}><td>{k}</td><td className="n">{v.alunos}</td><td className="n">{brl(v.mrr)}</td><td className="n">{brl(v.receita)}</td></tr>) : <tr><td colSpan={4} className="est-vazio">Nenhuma modalidade ainda.</td></tr>}</tbody></table>
                </Painel>

                <Painel titulo="Faixa etária" nota="Alunos ativos">
                    <div className="est-barras">{faixas.map(([k, n]) => <div key={k} className="est-barra"><span>{k}</span><div><i style={{ width: (n / maxFaixa) * 100 + '%' }} /></div><b>{n}</b></div>)}</div>
                </Painel>

                <Painel titulo="Cadastros nos últimos 12 meses" nota="Novos cadastros por mês" largo>
                    <div className="est-colunas">{crescimento.map((c) => <div key={c.rotulo} className="est-coluna"><b>{c.n || ''}</b><div><i style={{ height: (c.n / maxCresc) * 100 + '%' }} /></div><span>{c.rotulo}</span></div>)}</div>
                </Painel>

                <Painel titulo={`Inadimplentes (${emAtraso.length})`} nota="Do mais antigo para o mais recente" acao={emAtraso.length ? <button className="est-btn" onClick={() => generateOverduePDF(emAtraso, true)}><FileText size={14} /> PDF</button> : undefined}>
                    <table className="est-tab"><thead><tr><th>Aluno</th><th className="n">Dias</th><th className="n">Valor</th></tr></thead>
                        <tbody>{emAtraso.length ? emAtraso.map((r) => <tr key={r.id}><td>{r.alunos?.[0]?.nome || r.responsavel?.nome}</td><td className="n">{r.daysOverdue}</td><td className="n neg">{brl(r.financialPendingAmount)}</td></tr>) : <tr><td colSpan={3} className="est-vazio">Ninguém em atraso.</td></tr>}</tbody></table>
                </Painel>

                <Painel titulo={`A receber (${aReceber.length})`} nota="Cobranças em aberto">
                    <table className="est-tab"><thead><tr><th>Aluno</th><th className="n">Valor</th><th></th></tr></thead>
                        <tbody>{aReceber.length ? aReceber.map((r) => <tr key={r.id}><td>{r.alunos?.[0]?.nome || r.responsavel?.nome}</td><td className="n">{brl(r.financialPendingAmount)}</td><td className="n">{r.financialInvoiceUrl ? <a href={r.financialInvoiceUrl} target="_blank" rel="noreferrer">Fatura</a> : ''}</td></tr>) : <tr><td colSpan={3} className="est-vazio">Nada a receber.</td></tr>}</tbody></table>
                </Painel>

                <Painel titulo={`Pagamentos de ${MESES[mes.m].toLowerCase()} (${recebidos.length})`} nota="Toque em uma linha para ver o recibo" largo>
                    <table className="est-tab est-clicavel"><thead><tr><th>Data</th><th>Aluno</th><th>Descrição</th><th>Forma</th><th className="n">Valor</th></tr></thead>
                        <tbody>{recebidos.length ? recebidos.map((p) => <tr key={p.id} onClick={() => setRecibo({ ...p, payerName: nomePagador(p) })}><td>{(p.quando as Date).toLocaleDateString('pt-BR')}</td><td>{nomePagador(p)}</td><td>{p.description || '—'}</td><td>{String(p.billingType || '—')}</td><td className="n">{brl(p.value)}</td></tr>) : <tr><td colSpan={5} className="est-vazio">Nenhum pagamento neste mês.</td></tr>}</tbody></table>
                </Painel>

                <Painel titulo={`Despesas de ${MESES[mes.m].toLowerCase()} (${gastosMes.length})`} nota="Lançamentos do mês" largo>
                    <table className="est-tab"><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th className="n">Valor</th></tr></thead>
                        <tbody>{gastosMes.length ? gastosMes.map((g, i) => <tr key={g.id || i}><td>{dataDe(g.scheduleDate)?.toLocaleDateString('pt-BR')}</td><td>{g.description || '—'}</td><td>{g.category || '—'}</td><td className="n neg">{brl(g.value)}</td></tr>) : <tr><td colSpan={4} className="est-vazio">Nenhuma despesa neste mês.</td></tr>}</tbody></table>
                </Painel>
            </div>

            {recibo && <PaymentReceiptModal payment={recibo} onClose={() => setRecibo(null)} />}
        </div>
    );
}

function Kpi({ cor, rotulo, valor, nota }: { cor: string; rotulo: string; valor: string; nota: string }) {
    return <div className={`est-kpi ${cor}`}><span>{rotulo}</span><strong>{valor}</strong><small>{nota}</small></div>;
}

function Painel({ titulo, nota, acao, largo, children }: { titulo: string; nota?: string; acao?: React.ReactNode; largo?: boolean; children: React.ReactNode }) {
    return (
        <section className={`est-painel${largo ? ' largo' : ''}`}>
            <header><div><h2>{titulo}</h2>{nota && <small>{nota}</small>}</div>{acao}</header>
            <div className="est-corpo">{children}</div>
        </section>
    );
}
