/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, TrendingDown, TrendingUp, Minus, X } from 'lucide-react';
import '../styles/cadastros-mes.css';

export type MesCad = { rotulo: string; longo: string; ano: number; m: number; n: number; regs: any[] };

type Props = {
    indice: number; meses: MesCad[]; pags: any[];
    mensalidade: (r: any) => number; modalidade: (r: any) => string; dataDe: (x: any) => Date | null;
    onIr: (i: number) => void; onFechar: () => void;
};

const brl = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (v: number) => (v > 0 ? '+' : '') + v.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + '%';
const PAGO = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH', 'pago', 'confirmado'];
const STATUS: Record<string, string> = { aprovado: 'Ativo', pendente: 'Aguardando', desativado: 'Desativado' };

function idadeDe(a: any): number | null {
    const t = String(a?.dataNascimento || ''), iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
    const [d, m, y] = iso ? [+iso[3], +iso[2], +iso[1]] : t.split('/').map(Number);
    if (!y || !m) return null;
    const h = new Date();
    return h.getFullYear() - y - (h.getMonth() + 1 < m || (h.getMonth() + 1 === m && h.getDate() < d) ? 1 : 0);
}
const faixa = (i: number) => (i <= 5 ? '0 a 5 anos' : i <= 12 ? '6 a 12 anos' : i <= 17 ? '13 a 17 anos' : '18 anos ou mais');

function Barras({ dados, total, vazio }: { dados: [string, number][]; total: number; vazio: string }) {
    if (!dados.length || !total) return <p className="cm-vazio">{vazio}</p>;
    const max = Math.max(...dados.map((d) => d[1]));
    return <div className="cm-barras">{dados.map(([k, v]) => (
        <div key={k}><span>{k}</span><div><i style={{ width: (v / max) * 100 + '%' }} /></div><b>{v}<small>{Math.round((v / total) * 100)}%</small></b></div>
    ))}</div>;
}

export default function CadastrosMesModal({ indice, meses, pags, mensalidade, modalidade, dataDe, onIr, onFechar }: Props) {
    const mes = meses[indice], ant = indice > 0 ? meses[indice - 1] : null;
    useEffect(() => {
        const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar(); if (e.key === 'ArrowLeft' && indice > 0) onIr(indice - 1); if (e.key === 'ArrowRight' && indice < meses.length - 1) onIr(indice + 1); };
        const ov = document.body.style.overflow; document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', esc);
        return () => { document.removeEventListener('keydown', esc); document.body.style.overflow = ov; };
    }, [indice, meses.length, onIr, onFechar]);

    const a = useMemo(() => {
        const regs = mes.regs;
        const alunos = regs.flatMap((r) => (Array.isArray(r.alunos) && r.alunos.length ? r.alunos : [{ nome: r.responsavel?.nome || 'Aluno' }]).map((al: any) => ({ al, r })));
        const ativos = regs.filter((r) => String(r.contractStatus || '').toLowerCase() === 'aprovado');
        const pend = regs.filter((r) => !['aprovado', 'desativado'].includes(String(r.contractStatus || '').toLowerCase()));
        const atrasados = regs.filter((r) => ['overdue', 'atrasado', 'OVERDUE'].includes(r.status) && (r.financialPendingAmount || 0) > 0);
        const mod: Record<string, number> = {}; regs.forEach((r) => { const k = modalidade(r); mod[k] = (mod[k] || 0) + ((Array.isArray(r.alunos) && r.alunos.length) || 1); });
        const fx: Record<string, number> = { '0 a 5 anos': 0, '6 a 12 anos': 0, '13 a 17 anos': 0, '18 anos ou mais': 0 };
        let semIdade = 0, somaIdade = 0, nIdade = 0;
        alunos.forEach(({ al }) => { const i = idadeDe(al); if (i === null) { semIdade++; return; } fx[faixa(i)]++; somaIdade += i; nIdade++; });
        const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'], porDia: Record<string, number> = {}; dias.forEach((d) => (porDia[d] = 0));
        const nSem = Math.ceil(new Date(mes.ano, mes.m + 1, 0).getDate() / 7), porSem: number[] = Array(nSem).fill(0);
        regs.forEach((r) => { const d = dataDe(r.createdAt); if (!d) return; porDia[dias[d.getDay()]]++; porSem[Math.min(nSem - 1, Math.floor((d.getDate() - 1) / 7))]++; });
        const ids = new Set(regs.map((r) => r.id));
        const pagos = pags.filter((p) => ids.has(p.studentId) && PAGO.includes(p.status));
        const receita = pagos.reduce((t, p) => t + (p.value || 0), 0);
        const prev = regs.reduce((t, r) => t + (String(r.contractStatus || '').toLowerCase() === 'aprovado' ? mensalidade(r) : 0), 0);
        const media = meses.reduce((t, m) => t + m.n, 0) / meses.length;
        const rank = [...meses].sort((x, y) => y.n - x.n).findIndex((m) => m === mes) + 1;
        const melhor = [...meses].sort((x, y) => y.n - x.n)[0];
        const dif = ant ? mes.n - ant.n : 0, difPct = ant && ant.n ? (dif / ant.n) * 100 : null;
        return { alunos, ativos, pend, atrasados, mod: Object.entries(mod).sort((x, y) => y[1] - x[1]), fx: Object.entries(fx), semIdade, idadeMedia: nIdade ? somaIdade / nIdade : null, porDia: Object.entries(porDia), porSem, receita, prev, media, rank, melhor, dif, difPct };
    }, [mes, ant, meses, pags]); // eslint-disable-line react-hooks/exhaustive-deps

    const totalAlunos = a.alunos.length, maxSerie = Math.max(1, ...meses.map((m) => m.n)), maxSem = Math.max(1, ...a.porSem), maxDia = Math.max(1, ...a.porDia.map((d) => d[1]));
    const Seta = a.dif > 0 ? TrendingUp : a.dif < 0 ? TrendingDown : Minus;
    const vsMedia = a.media ? ((mes.n - a.media) / a.media) * 100 : 0;
    const txt = !mes.n ? 'Nenhum cadastro neste mês.'
        : `${mes.longo} teve ${mes.n} ${mes.n === 1 ? 'cadastro' : 'cadastros'} (${totalAlunos} ${totalAlunos === 1 ? 'aluno' : 'alunos'}), ${a.rank}º melhor mês dos últimos ${meses.length}${a.difPct !== null ? `, ${a.dif >= 0 ? 'alta' : 'queda'} de ${Math.abs(Math.round(a.difPct))}% sobre o mês anterior` : ''}. ${a.ativos.length} já estão ativos${a.pend.length ? ` e ${a.pend.length} aguardam aprovação` : ''}.`;

    return createPortal(
        <div className="cm-fundo" onMouseDown={(e) => { if (e.target === e.currentTarget) onFechar(); }}>
            <div className="cm" role="dialog" aria-modal="true" aria-label={`Análise de cadastros de ${mes.longo}`}>
                <header className="cm-topo">
                    <div>
                        <small>Análise de cadastros</small>
                        <h2>{mes.longo}</h2>
                    </div>
                    <nav>
                        <button type="button" onClick={() => onIr(indice - 1)} disabled={indice === 0} aria-label="Mês anterior"><ChevronLeft size={16} /></button>
                        <button type="button" onClick={() => onIr(indice + 1)} disabled={indice === meses.length - 1} aria-label="Próximo mês"><ChevronRight size={16} /></button>
                        <button type="button" className="x" onClick={onFechar} aria-label="Fechar"><X size={18} /></button>
                    </nav>
                </header>
                <div className="cm-corpo" key={indice}>
                    <p className="cm-resumo">{txt}</p>

                    <div className="cm-kpis">
                        <div><small>Cadastros</small><b>{mes.n}</b><em>{totalAlunos} {totalAlunos === 1 ? 'aluno' : 'alunos'}</em></div>
                        <div><small>Vs. mês anterior</small><b className={a.dif > 0 ? 'pos' : a.dif < 0 ? 'neg' : ''}><Seta size={18} />{ant ? (a.difPct !== null ? pct(a.difPct) : a.dif > 0 ? 'novo' : '0%') : '—'}</b><em>{ant ? `${ant.n} em ${ant.longo.split(' ')[0]}` : 'sem mês anterior'}</em></div>
                        <div><small>Vs. média de 12 meses</small><b className={vsMedia > 0 ? 'pos' : vsMedia < 0 ? 'neg' : ''}>{pct(vsMedia)}</b><em>média de {a.media.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} por mês</em></div>
                        <div><small>Posição no ano</small><b>{mes.n ? a.rank + 'º' : '—'}</b><em>de {meses.length} meses{a.melhor === mes ? ' · o melhor' : ''}</em></div>
                        <div><small>Mensalidades previstas</small><b>{brl(a.prev)}</b><em>dos que já estão ativos</em></div>
                        <div><small>Já pago por eles</small><b>{brl(a.receita)}</b><em>{a.atrasados.length ? `${a.atrasados.length} em atraso` : 'nenhum em atraso'}</em></div>
                    </div>

                    <section className="cm-sec">
                        <h3>Os 12 meses lado a lado</h3>
                        <div className="cm-serie">{meses.map((m, i) => (
                            <button type="button" key={m.rotulo} className={i === indice ? 'on' : ''} onClick={() => onIr(i)} title={`${m.longo}: ${m.n}`}>
                                <b>{m.n || ''}</b><i style={{ height: Math.max(2, (m.n / maxSerie) * 70) + 'px' }} /><span>{m.rotulo.slice(0, 3)}</span>
                            </button>))}</div>
                    </section>

                    <div className="cm-duas">
                        <section className="cm-sec"><h3>Por modalidade</h3><Barras dados={a.mod} total={totalAlunos} vazio="Sem dados." /></section>
                        <section className="cm-sec"><h3>Faixa etária{a.idadeMedia !== null && <small> · idade média {a.idadeMedia.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} anos</small>}</h3>
                            <Barras dados={a.fx} total={totalAlunos - a.semIdade} vazio="Sem datas de nascimento." />
                            {a.semIdade > 0 && <p className="cm-nota">{a.semIdade} sem data de nascimento informada.</p>}
                        </section>
                    </div>

                    <div className="cm-duas">
                        <section className="cm-sec"><h3>Ritmo ao longo do mês</h3>
                            <div className="cm-col">{a.porSem.map((n, i) => <div key={i}><b>{n}</b><i style={{ height: Math.max(2, (n / maxSem) * 56) + 'px' }} /><span>{i * 7 + 1}–{Math.min(i * 7 + 7, new Date(mes.ano, mes.m + 1, 0).getDate())}</span></div>)}</div>
                        </section>
                        <section className="cm-sec"><h3>Dia da semana</h3>
                            <div className="cm-col">{a.porDia.map(([d, n]) => <div key={d}><b>{n || ''}</b><i style={{ height: Math.max(2, (n / maxDia) * 56) + 'px' }} /><span>{d}</span></div>)}</div>
                        </section>
                    </div>

                    <section className="cm-sec">
                        <h3>Situação dos {mes.n === 1 ? 'cadastros' : mes.n + ' cadastros'}</h3>
                        <div className="cm-sit">
                            <span className="ok"><b>{a.ativos.length}</b>ativos</span>
                            <span className="pe"><b>{a.pend.length}</b>aguardando aprovação</span>
                            <span className="at"><b>{a.atrasados.length}</b>com pagamento em atraso</span>
                        </div>
                    </section>

                    <section className="cm-sec">
                        <h3>Todos os cadastros do mês</h3>
                        {a.alunos.length ? (
                            <div className="cm-rolagem"><table className="est-tab"><thead><tr><th>Aluno</th><th>Cadastro</th><th>Modalidade</th><th>Responsável</th><th>Situação</th><th className="n">Mensalidade</th></tr></thead>
                                <tbody>{a.alunos.map(({ al, r }, i) => (
                                    <tr key={r.id + i}>
                                        <td><span className="cm-al">{al.fotoUrl ? <img src={al.fotoUrl} alt="" loading="lazy" /> : <i>{String(al.nome || '?').trim().charAt(0).toUpperCase()}</i>}{al.nome || 'Aluno'}</span></td>
                                        <td>{dataDe(r.createdAt)?.toLocaleDateString('pt-BR') || '—'}</td>
                                        <td>{modalidade(r)}</td>
                                        <td>{r.responsavel?.nome || '—'}</td>
                                        <td><span className={`cm-st ${String(r.contractStatus || '').toLowerCase()}`}>{STATUS[String(r.contractStatus || '').toLowerCase()] || 'Aguardando'}</span></td>
                                        <td className="n">{brl(mensalidade(r) / ((Array.isArray(r.alunos) && r.alunos.length) || 1))}</td>
                                    </tr>))}</tbody></table></div>
                        ) : <p className="cm-vazio">Nenhum cadastro neste mês.</p>}
                    </section>
                </div>
            </div>
        </div>,
        document.body,
    );
}
