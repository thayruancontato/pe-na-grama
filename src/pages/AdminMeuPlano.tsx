/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import { Check, CreditCard, Crown, FileText, MessageCircle, QrCode, Repeat } from 'lucide-react';
import '../styles/meuplano.css';

type Fatura = { vencimento: string; valor: number; status: 'pago' | 'aberta' | 'vencida' | 'outro'; pagoEm: string; url: string };
type Plano = { nome: string; mensal: number; descricao?: string };

const brl = (c: number) => ((c || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const brl0 = (c: number) => ((c || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const dataBr = (iso: string) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—');
const RECURSOS: [string, string][] = [['alunos', 'Gestão de alunos'], ['pix', 'Financeiro com Pix'], ['carteirinha', 'Carteirinha digital'], ['portal', 'Portal do responsável'], ['relatorios', 'Relatórios'], ['portaria', 'Controle de portaria'], ['whatsapp', 'Cobrança por WhatsApp'], ['suporte', 'Suporte da equipe']];
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const SELOS = ['bronze', 'prata', 'ouro'];
const ROTULO = { pago: 'Pago', aberta: 'Em aberto', vencida: 'Vencida', outro: '—' } as const;

function Barra({ rotulo, n, max }: { rotulo: string; n: number; max: number }) {
    const pct = max ? Math.min(100, Math.round((n / max) * 100)) : 0;
    return (
        <div className="mp-uso">
            <div><span>{rotulo}</span><b>{n}{max ? <small> de {max}</small> : <small> · sem limite</small>}</b></div>
            {max > 0 && <div className="mp-barra" aria-hidden><i style={{ width: pct + '%' }} className={pct >= 90 ? 'cheio' : ''} /></div>}
        </div>
    );
}

export default function AdminMeuPlano() {
    const [info, setInfo] = useState<any>(null);
    const [fat, setFat] = useState<{ itens: Fatura[]; uso: any } | null>(null);
    const [planos, setPlanos] = useState<{ planos: Plano[]; whats: string; escola: string } | null>(null);
    const auth = () => ({ authorization: 'Bearer ' + (localStorage.getItem('pg_sys_token') || '') });

    useEffect(() => {
        const j = (u: string, h = true) => fetch(u, { headers: h ? auth() : {}, cache: 'no-store' }).then((r) => r.json()).catch(() => null);
        j('/sys/assinatura').then(setInfo); j('/sys/assinatura/faturas').then(setFat); j('/sys/public/planos', false).then(setPlanos);
    }, []);

    const modal = (window as any).__pgModal;
    const s = info?.situacao, teste = s?.status === 'teste', prox = info?.proxima;
    const atual = String(s?.plano || '').replace(/^Plano\s+/i, '') || (teste ? 'Teste grátis' : '—');
    const atrasada = prox && (prox.atrasada || prox.dias < 0);
    const aviso = !prox ? '' : atrasada ? 'Fatura vencida' : prox.dias <= 7 ? (prox.dias === 0 ? 'Vence hoje' : `Vence em ${prox.dias} ${prox.dias === 1 ? 'dia' : 'dias'}`) : '';
    const wa = planos?.whats ? `https://wa.me/${planos.whats}?text=${encodeURIComponent('Olá! Preciso de ajuda com o meu plano (' + atual + ').')}` : '';

    if (!info) return <div className="mp"><div className="mp-carga"><i /><span>Carregando o seu plano…</span></div></div>;

    return (
        <div className="mp">
            <header className="mp-topo">
                <div><h1>Meu plano</h1><p>Acompanhe a sua assinatura, o uso do sistema e as suas faturas.</p></div>

            </header>

            <section className="mp-heroi">
                <div className="mp-heroi-id">
                    <img className="mp-escudo" src="/plano/escudo.png" alt="" />
                    <div>
                        <small>Plano atual</small>
                        <h2>{atual}<span className={`mp-selo ${teste ? 'teste' : 'ativo'}`}><i />{teste ? 'Em teste' : 'Ativo'}</span></h2>
                        <p>{teste ? 'Escolha um plano para liberar todos os recursos.' : 'Cobrança mensal via Pix, sem fidelidade.'}</p>
                    </div>
                </div>
                <div className="mp-heroi-v">
                    <small>Valor</small>
                    <b>{teste ? '—' : brl0(s?.mensal || 0)}<span>{teste ? '' : '/mês'}</span></b>
                </div>
                <div className="mp-heroi-v">
                    <small>Próximo vencimento</small>
                    <b>{prox ? dataBr(prox.vencimento) : '—'}</b>
                    {aviso && <em className={atrasada ? 'neg' : 'aviso'}>{aviso}</em>}
                </div>
                <div className="mp-heroi-acoes">
                    {teste
                        ? <button type="button" className="mp-btn forte" onClick={() => modal?.planos()}><Crown size={16} />Escolher plano</button>
                        : <>
                            <button type="button" className="mp-btn forte" disabled={!prox} onClick={() => modal?.proxima()}><QrCode size={16} />Pagar próxima fatura</button>
                            <button type="button" className="mp-btn" onClick={() => modal?.planos()}><Repeat size={16} />Trocar de plano</button>
                        </>}
                </div>
            </section>

            <div className="mp-grade">
                <section className="mp-card">
                    <h3>Uso do plano</h3>
                    {fat ? <>
                        <Barra rotulo="Alunos" n={fat.uso.alunos} max={fat.uso.limiteAlunos} />
                        <Barra rotulo="Turmas" n={fat.uso.turmas} max={0} />
                        <Barra rotulo="Professores" n={fat.uso.professores} max={0} />
                    </> : <div className="mp-sk" />}
                </section>
                <section className="mp-card">
                    <h3>Recursos incluídos</h3>
                    <ul className="mp-lista">{RECURSOS.map(([ic, t]) => <li key={ic}><i style={{ WebkitMaskImage: `url(/plano/ic-${ic}.png)`, maskImage: `url(/plano/ic-${ic}.png)` }} />{t}</li>)}</ul>
                </section>
            </div>

            <section className="mp-card mp-tabela">
                <h3>Histórico de faturas</h3>
                {fat && !fat.itens.length ? <p className="mp-vazio">{teste ? 'As faturas aparecem aqui depois que você escolher um plano.' : 'Nenhuma fatura ainda.'}</p> : <div className="mp-rolagem">
                    <table><thead><tr><th>Referência</th><th>Vencimento</th><th className="n">Valor</th><th>Status</th><th>Pago em</th><th className="n" data-sem-ordem>Ação</th></tr></thead>
                        <tbody>{fat ? (fat.itens.length ? fat.itens.map((f, i) => (
                            <tr key={i}>
                                <td>{MESES[+f.vencimento.slice(5, 7) - 1]}/{f.vencimento.slice(0, 4)}</td><td>{dataBr(f.vencimento)}</td><td className="n">{brl(f.valor)}</td>
                                <td><span className={`mp-st ${f.status}`}>{ROTULO[f.status]}</span></td>
                                <td>{f.pagoEm ? dataBr(f.pagoEm) : '—'}</td>
                                <td className="n">{f.status === 'pago'
                                    ? (f.url ? <a className="mp-btn peq" href={f.url} target="_blank" rel="noreferrer"><FileText size={13} />Ver recibo</a> : '')
                                    : <button type="button" className="mp-btn forte peq" onClick={() => modal?.proxima()}><QrCode size={13} />Pagar</button>}</td>
                            </tr>)) : <tr><td colSpan={6} className="mp-vazio">{teste ? 'As faturas aparecem aqui depois que você escolher um plano.' : 'Nenhuma fatura ainda.'}</td></tr>) : <tr><td colSpan={6} className="mp-vazio">Carregando…</td></tr>}</tbody>
                    </table>
                </div>}
            </section>

            {planos && planos.planos.length > 0 && (
                <section className="mp-card">
                    <h3>Comparar planos</h3>
                    <div className="mp-planos">
                        {planos.planos.map((p, idx) => {
                            const eh = !teste && p.nome.toLowerCase().includes(atual.toLowerCase());
                            return (
                                <div key={p.nome} className={`mp-plano${eh ? ' atual' : ''}`}>
                                    {eh && <em>Seu plano</em>}
                                    <img className="mp-selo-img" src={`/plano/selo-${SELOS[Math.min(idx, 2)]}.png`} alt="" />
                                    <b>{p.nome.replace(/^Plano\s+/i, '')}</b>
                                    <strong>{brl0(p.mensal)}<span>/mês</span></strong>
                                    {p.descricao && <p>{p.descricao}</p>}
                                    {eh ? <span className="mp-atual"><Check size={14} />Plano atual</span> : <button type="button" className="mp-btn" onClick={() => modal?.planos()}><CreditCard size={15} />Mudar para este</button>}
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            <section className="mp-ajuda">
                <div><h3>Precisa de ajuda?</h3><p>Fale com a nossa equipe: dúvidas sobre cobrança, mudança de plano ou limite de alunos.</p></div>
                {wa && <a className="mp-btn forte" href={wa} target="_blank" rel="noreferrer"><MessageCircle size={16} />Falar no WhatsApp</a>}
            </section>
        </div>
    );
}
