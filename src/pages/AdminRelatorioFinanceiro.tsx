/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import type React from 'react';
import { ChevronLeft, ChevronRight, Download, Loader2, MessageCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useDialog } from '../context/CustomDialogContext';
import { sendWhatsAppBatch } from './AdminMensagens/whatsappUtils';

// Relatório financeiro: recebido, a receber e atrasado do mês; inadimplência por aluno; receita por plano e modalidade; planilha.
// "Atrasado" = não pago e vencimento no passado (não depende de o provedor ter marcado OVERDUE).
const PAGO = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH', 'DONE'];
const IGNORADO = ['DELETED', 'REFUNDED', 'REMOVED_BY_RECEIVER'];
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const hoje = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const dia = (s?: string | null) => (s ? String(s).slice(0, 10) : '');
const dataBr = (s: string) => (s ? s.split('-').reverse().join('/') : '-');
const diasEntre = (a: string, b: string) => Math.max(0, Math.round((Date.parse(b + 'T12:00:00') - Date.parse(a + 'T12:00:00')) / 864e5));
const somaMes = (ym: string, n: number) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const nomeMes = (ym: string) => new Date(ym + '-15T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

interface Pag { id: string; studentId: string; value: number; status: string; dueDate: string; paymentDate: string; description: string; invoiceUrl: string }
interface Fam { nome: string; tel: string; aluno: string; plano: string; modalidade: string }

export default function AdminRelatorioFinanceiro() {
    const { showAlert, showConfirm } = useDialog();
    const [mes, setMes] = useState(hoje().slice(0, 7));
    const [pags, setPags] = useState<Pag[]>([]);
    const [fams, setFams] = useState<Record<string, Fam>>({});
    const [carregando, setCarregando] = useState(true);
    const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
    const [enviando, setEnviando] = useState(false);
    const [progresso, setProgresso] = useState('');

    useEffect(() => {
        (async () => {
            try {
                const [ps, rs, pl] = await Promise.all([
                    getDocs(collection(db, 'financial_payments')),
                    getDocs(collection(db, 'rumo_ao_esporte_2026_registrations')),
                    getDocs(collection(db, 'rumo_ao_esporte_2026_plans')),
                ]);
                const nomesPlano: Record<string, string> = {};
                pl.docs.forEach((d) => { const x: any = d.data(); nomesPlano[d.id] = x.nome || x.name || x.title || d.id; });
                const f: Record<string, Fam> = {};
                rs.docs.forEach((d) => {
                    const x: any = d.data();
                    f[d.id] = { nome: x.responsavel?.nome || '-', tel: String(x.responsavel?.telefonePrincipal || ''), aluno: (x.alunos || []).map((a: any) => a.nome).filter(Boolean).join(' e ') || '-', plano: nomesPlano[x.planId] || x.planId || 'Sem plano', modalidade: x.modalidade || 'Sem modalidade' };
                });
                setFams(f);
                setPags(ps.docs.map((d) => { const x: any = d.data(); return { id: d.id, studentId: x.studentId || '', value: Number(x.value || 0), status: String(x.status || ''), dueDate: dia(x.dueDate), paymentDate: dia(x.paymentDate), description: x.description || '', invoiceUrl: x.invoiceUrl || '' }; }).filter((p) => !IGNORADO.includes(p.status)));
            } catch (e) { showAlert(e instanceof Error ? e.message : 'Não consegui carregar os dados financeiros.', 'error'); }
            finally { setCarregando(false); }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const r = useMemo(() => {
        const h = hoje(), pago = (p: Pag) => PAGO.includes(p.status);
        let recebido = 0, aReceber = 0, atrasadoMes = 0;
        const porPlano: Record<string, number> = {}, porModalidade: Record<string, number> = {};
        const devendo: Record<string, { itens: Pag[]; total: number; maisAntigo: string }> = {};
        for (const p of pags) {
            if (pago(p)) {
                if ((p.paymentDate || p.dueDate).slice(0, 7) === mes) {
                    recebido += p.value;
                    const f = fams[p.studentId]; porPlano[f?.plano || 'Sem plano'] = (porPlano[f?.plano || 'Sem plano'] || 0) + p.value; porModalidade[f?.modalidade || 'Sem modalidade'] = (porModalidade[f?.modalidade || 'Sem modalidade'] || 0) + p.value;
                }
            } else if (p.dueDate) {
                if (p.dueDate.slice(0, 7) === mes) { if (p.dueDate < h) atrasadoMes += p.value; else aReceber += p.value; }
                if (p.dueDate < h) { const d = (devendo[p.studentId] ||= { itens: [], total: 0, maisAntigo: p.dueDate }); d.itens.push(p); d.total += p.value; if (p.dueDate < d.maisAntigo) d.maisAntigo = p.dueDate; }
            }
        }
        const lista = Object.entries(devendo).map(([id, d]) => ({ id, ...d, dias: diasEntre(d.maisAntigo, h) })).sort((a, b) => b.dias - a.dias);
        return { recebido, aReceber, atrasadoMes, porPlano, porModalidade, lista, totalDevido: lista.reduce((s, x) => s + x.total, 0) };
    }, [pags, fams, mes]);

    const alternar = (id: string) => setSelecionados((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    const todos = r.lista.length > 0 && r.lista.every((x) => selecionados.has(x.id));

    const cobrar = () => {
        const alvo = r.lista.filter((x) => selecionados.has(x.id) && (fams[x.id]?.tel || '').replace(/\D/g, '').length >= 10);
        if (!alvo.length) { showAlert('Selecione devedores com telefone cadastrado.', 'info'); return; }
        showConfirm(`Enviar cobrança para ${alvo.length} responsável(is) pelo WhatsApp da escola? Há 2,5 segundos entre mensagens; deixe esta aba aberta até terminar.`, async () => {
            setEnviando(true); setProgresso('Enviando…');
            const msgs = alvo.map((x) => {
                const f = fams[x.id], link = x.itens.find((i) => /^https?:/.test(i.invoiceUrl))?.invoiceUrl;
                const texto = `Olá, ${f.nome.split(' ')[0]}! Consta em aberto o valor de ${brl(x.total)} referente a ${f.aluno} (vencimento mais antigo: ${dataBr(x.maisAntigo)}).` + (link ? `\n\nPague aqui: ${link}` : '') + '\n\nSe já pagou, desconsidere esta mensagem. Qualquer dúvida, é só responder.';
                return { id: x.id, phone: f.tel, text: texto, name: f.nome };
            });
            const res = await sendWhatsAppBatch(msgs, (p) => setProgresso(`${p.current} de ${p.total}: ${p.currentName}`));
            setEnviando(false); setProgresso('');
            showAlert(res.success ? `${res.queued} cobrança(s) enviada(s).` : `Enviadas: ${res.queued} de ${msgs.length}. Confira o servidor de WhatsApp.`, res.success ? 'success' : 'error');
        });
    };

    const exportar = () => {
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ Mês: nomeMes(mes), Recebido: r.recebido, 'A receber': r.aReceber, 'Atrasado do mês': r.atrasadoMes, 'Inadimplência total': r.totalDevido }]), 'Resumo');
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(r.lista.map((x) => ({ Responsável: fams[x.id]?.nome, Aluno: fams[x.id]?.aluno, Telefone: fams[x.id]?.tel, 'Valor em atraso': x.total, 'Dias de atraso': x.dias, 'Vencimento mais antigo': dataBr(x.maisAntigo), Cobranças: x.itens.length }))), 'Inadimplência');
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([...Object.entries(r.porPlano).map(([k, v]) => ({ Tipo: 'Plano', Nome: k, Recebido: v })), ...Object.entries(r.porModalidade).map(([k, v]) => ({ Tipo: 'Modalidade', Nome: k, Recebido: v }))]), 'Receita');
        XLSX.writeFile(wb, `relatorio-financeiro-${mes}.xlsx`);
    };

    if (carregando) return <div style={{ padding: 24 }}><Loader2 className="spin" /> Carregando…</div>;
    const ordem = (o: Record<string, number>) => Object.entries(o).sort((a, b) => b[1] - a[1]);

    return (
        <div className="admin-page" style={{ padding: 24, color: '#172033' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
                <h1 style={{ margin: 0, fontSize: '2rem', color: '#17428f' }}>Relatório financeiro</h1>
                <style>{`@media (max-width: 640px) {
  .rf-tabela thead { display: none }
  .rf-tabela, .rf-tabela tbody { display: block }
  .rf-tabela tr { display: grid; grid-template-columns: 28px 1fr auto; grid-template-areas: "c n v" "c t d"; gap: 2px 10px; padding: 10px 0 }
  .rf-tabela td { padding: 0 !important; text-align: left !important }
  .rf-tabela td:nth-child(1) { grid-area: c } .rf-tabela td:nth-child(2) { grid-area: n }
  .rf-tabela td:nth-child(3) { grid-area: t; color: #64748b } .rf-tabela td:nth-child(4) { grid-area: v; text-align: right !important }
  .rf-tabela td:nth-child(5) { grid-area: d; text-align: right !important; color: #64748b } .rf-tabela td:nth-child(5)::after { content: ' dias' }
}`}</style>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <button type="button" aria-label="Mês anterior" onClick={() => setMes(somaMes(mes, -1))} style={botaoIcone}><ChevronLeft size={20} /></button>
                    <strong style={{ minWidth: 150, textAlign: 'center', textTransform: 'capitalize' }}>{nomeMes(mes)}</strong>
                    <button type="button" aria-label="Próximo mês" onClick={() => setMes(somaMes(mes, 1))} style={botaoIcone}><ChevronRight size={20} /></button>
                    <button type="button" onClick={exportar} style={botao('#17428f')}><Download size={17} /> Planilha</button>
                </div>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 14, marginBottom: 18 }}>
                <Cartao titulo="Recebido no mês" valor={brl(r.recebido)} cor="#027a48" />
                <Cartao titulo="A receber (ainda no prazo)" valor={brl(r.aReceber)} cor="#17428f" />
                <Cartao titulo="Atrasado do mês" valor={brl(r.atrasadoMes)} cor="#b42318" />
                <Cartao titulo="Inadimplência total" valor={brl(r.totalDevido)} cor="#b42318" sub={`${r.lista.length} família(s)`} />
            </div>

            <section style={painel}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
                    <h2 style={titulo}>Inadimplência por aluno</h2>
                    <button type="button" onClick={cobrar} disabled={enviando || selecionados.size === 0} style={botao('#00a63a')}>{enviando ? <Loader2 className="spin" size={17} /> : <MessageCircle size={17} />} Cobrar selecionados ({selecionados.size})</button>
                </div>
                {progresso && <p style={{ margin: '0 0 10px', fontWeight: 700 }}>{progresso}</p>}
                {r.lista.length === 0 ? <p style={{ color: '#64748b' }}>Ninguém em atraso. 🎉</p> : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="rf-tabela" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                            <thead><tr style={{ textAlign: 'left', color: '#64748b' }}>
                                <th style={{ padding: 8 }}><input type="checkbox" style={caixa} aria-label="Selecionar todos" checked={todos} onChange={() => setSelecionados(todos ? new Set() : new Set(r.lista.map((x) => x.id)))} /></th>
                                <th style={{ padding: 8 }}>Responsável / aluno</th><th style={{ padding: 8 }}>Telefone</th><th style={{ padding: 8, textAlign: 'right' }}>Em atraso</th><th style={{ padding: 8, textAlign: 'right' }}>Dias</th></tr></thead>
                            <tbody>{r.lista.map((x) => (
                                <tr key={x.id} style={{ borderTop: '1px solid rgba(16,33,63,0.1)' }}>
                                    <td style={{ padding: 8 }}><input type="checkbox" style={caixa} aria-label={`Selecionar ${fams[x.id]?.nome}`} checked={selecionados.has(x.id)} onChange={() => alternar(x.id)} /></td>
                                    <td style={{ padding: 8 }}><strong>{fams[x.id]?.nome || 'Cadastro removido'}</strong><div style={{ color: '#64748b' }}>{fams[x.id]?.aluno}</div></td>
                                    <td style={{ padding: 8, whiteSpace: 'nowrap' }}>{fams[x.id]?.tel || <span style={{ color: '#b42318' }}>sem telefone</span>}</td>
                                    <td style={{ padding: 8, textAlign: 'right', fontWeight: 800, color: '#b42318' }}>{brl(x.total)}<div style={{ fontWeight: 400, color: '#64748b' }}>{x.itens.length} cobrança(s)</div></td>
                                    <td style={{ padding: 8, textAlign: 'right' }}>{x.dias}</td>
                                </tr>))}</tbody>
                        </table>
                    </div>
                )}
            </section>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 16, marginTop: 16 }}>
                <Quadro titulo="Receita por plano" dados={ordem(r.porPlano)} total={r.recebido} />
                <Quadro titulo="Receita por modalidade" dados={ordem(r.porModalidade)} total={r.recebido} />
            </div>
        </div>
    );
}

function Cartao({ titulo: t, valor, cor, sub }: { titulo: string; valor: string; cor: string; sub?: string }) {
    return <div style={painel}><div style={{ color: '#64748b', fontWeight: 700, fontSize: 13 }}>{t}</div><div style={{ fontSize: '1.7rem', fontWeight: 900, color: cor, margin: '6px 0 2px' }}>{valor}</div>{sub && <div style={{ color: '#64748b', fontSize: 13 }}>{sub}</div>}</div>;
}
function Quadro({ titulo: t, dados, total }: { titulo: string; dados: [string, number][]; total: number }) {
    return (
        <section style={painel}>
            <h2 style={titulo}>{t}</h2>
            {dados.length === 0 ? <p style={{ color: '#64748b' }}>Nenhum recebimento neste mês.</p> : dados.map(([nome, v]) => (
                <div key={nome} style={{ margin: '10px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}><span>{nome}</span><strong>{brl(v)}</strong></div>
                    <div style={{ height: 8, borderRadius: 4, background: '#e8edf5', marginTop: 4 }}><div style={{ width: `${total ? Math.round((v / total) * 100) : 0}%`, height: 8, borderRadius: 4, background: '#17428f' }} /></div>
                </div>))}
        </section>
    );
}
const painel: React.CSSProperties = { background: '#fff', border: '1px solid rgba(16,33,63,0.14)', borderRadius: 12, padding: 18, boxShadow: '0 8px 24px rgba(15,23,42,0.06)', minWidth: 0 };
const titulo: React.CSSProperties = { margin: 0, fontSize: '1.15rem' };
const botao = (bg: string): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 44, border: 'none', borderRadius: 9, background: bg, color: '#fff', padding: '0 16px', fontWeight: 900, cursor: 'pointer' });
const botaoIcone: React.CSSProperties = { width: 44, height: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(16,33,63,0.22)', borderRadius: 9, background: '#fff', cursor: 'pointer' };

// O CSS global do sistema esconde checkbox (display: none); aqui precisa aparecer.
const caixa: React.CSSProperties = { display: 'inline-block', width: 20, height: 20, accentColor: '#17428f', cursor: 'pointer' };
