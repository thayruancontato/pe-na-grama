/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import type React from 'react';
import { Download, Loader2, ShieldCheck } from 'lucide-react';
import { useDialog } from '../context/CustomDialogContext';

// Inscrições abertas/fechadas, cópia de segurança e registro de ações (versão sem Firebase, rotas /sys/*).
const token = () => { try { return localStorage.getItem('pg_sys_token') || sessionStorage.getItem('pg_sys_token') || ''; } catch { return ''; } };
async function api(method: string, caminho: string, body?: unknown) {
    const r = await fetch('/sys/' + caminho, { method, headers: { 'content-type': 'application/json', authorization: `Bearer ${token()}` }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).erro || `Erro ${r.status}`);
    return r;
}

export default function AdminEscolaControle() {
    const { showAlert } = useDialog();
    const [abertas, setAbertas] = useState(true);
    const [mensagem, setMensagem] = useState('');
    const [log, setLog] = useState<{ quem: string; quando: string; acao: string }[]>([]);
    const [ocupado, setOcupado] = useState(false);

    useEffect(() => {
        api('GET', 'db/system_settings/inscricoes').then((r) => r.json()).then((j) => { if (j.existe) { setAbertas(j.data.abertas !== false); setMensagem(j.data.mensagem || ''); } }).catch(() => {});
        api('GET', 'db/auditoria').then((r) => r.json()).then((j) => setLog((j.docs || []).map((d: any) => d.data).sort((a: any, b: any) => b.quando.localeCompare(a.quando)).slice(0, 100))).catch(() => {});
    }, []);

    const salvar = async () => {
        setOcupado(true);
        try { await api('PUT', 'db/system_settings/inscricoes', { data: { abertas, mensagem } }); showAlert(abertas ? 'Inscrições abertas.' : 'Inscrições fechadas.', 'success'); }
        catch (e) { showAlert(e instanceof Error ? e.message : String(e), 'error'); } finally { setOcupado(false); }
    };
    const [resumoImport, setResumoImport] = useState('');
    const importar = async (arquivo?: File) => {
        if (!arquivo) return;
        try {
            const texto = (await arquivo.text()).replace(/^﻿/, '');
            const linhasTxt = texto.split(/\r?\n/).filter((l) => l.trim());
            const sep = (linhasTxt[0] || '').includes(';') ? ';' : ',';
            const cab = (linhasTxt.shift() || '').split(sep).map((c) => c.trim().toLowerCase().replace(/^"|"$/g, ''));
            // shortcut: CSV simples (sem vírgula dentro de aspas); planilhas com texto entre aspas e separador dentro precisam de um parser completo
            const linhas = linhasTxt.map((l) => Object.fromEntries(l.split(sep).map((v, i) => [cab[i], v.trim().replace(/^"|"$/g, '')])));
            const j = await (await api('POST', 'import', { linhas })).json();
            setResumoImport(`${j.importados} aluno(s) importado(s)` + (j.falhas.length ? `; ${j.falhas.length} recusado(s): ` + j.falhas.slice(0, 5).map((f: any) => `linha ${f.linha} (${f.motivo})`).join('; ') : '.'));
        } catch (e) { showAlert(e instanceof Error ? e.message : String(e), 'error'); }
    };
    const [minhaSenha, setMinhaSenha] = useState('');
    const [senhaAtual, setSenhaAtual] = useState('');
    const trocarMinha = async () => {
        try { const j = await (await api('POST', 'auth/password', { password: minhaSenha, atual: senhaAtual })).json(); if (j && j.token) localStorage.setItem('pg_sys_token', j.token); setMinhaSenha(''); setSenhaAtual(''); showAlert('Senha trocada.', 'success'); }
        catch (e) { showAlert(e instanceof Error ? e.message : String(e), 'error'); }
    };
    const sairTudo = async () => {
        try { await api('POST', 'auth/logout-all', {}); try { localStorage.removeItem('pg_sys_token'); sessionStorage.removeItem('pg_sys_token'); } catch { /* sem armazenamento */ } location.href = '/'; }
        catch (e) { showAlert(e instanceof Error ? e.message : String(e), 'error'); }
    };
    const [emailRs, setEmailRs] = useState('');
    const [senhaRs, setSenhaRs] = useState('');
    const redefinir = async () => {
        try { await api('POST', 'auth/reset', { email: emailRs, password: senhaRs }); setSenhaRs(''); showAlert('Senha redefinida.', 'success'); }
        catch (e) { showAlert(e instanceof Error ? e.message : String(e), 'error'); }
    };
    const baixar = async () => {
        try {
            const blob = await (await api('GET', 'export')).blob();
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `backup-${location.hostname.split('.')[0]}.json`; a.click(); URL.revokeObjectURL(a.href);
        } catch (e) { showAlert(e instanceof Error ? e.message : String(e), 'error'); }
    };

    return (
        <div className="admin-page" style={{ padding: 24, color: '#172033' }}>
            <h1 style={{ margin: '0 0 18px', fontSize: '2rem', color: '#17428f', display: 'flex', alignItems: 'center', gap: 10 }}><ShieldCheck /> Inscrições, backup e segurança</h1>
            <section style={painel}>
                <h2 style={titulo}>Formulário de inscrição</h2>
                <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontWeight: 800 }}>
                    <input type="checkbox" checked={abertas} onChange={(e) => setAbertas(e.target.checked)} style={{ width: 22, height: 22 }} /> Inscrições abertas
                </label>
                {!abertas && <input value={mensagem} onChange={(e) => setMensagem(e.target.value)} maxLength={300} placeholder="Mensagem para quem tentar se inscrever" style={{ ...campo, marginTop: 12 }} />}
                <button type="button" onClick={salvar} disabled={ocupado} style={{ ...botao, marginTop: 14 }}>{ocupado ? <Loader2 size={17} className="spin" /> : null} Salvar</button>
            </section>
            <section style={painel}>
                <h2 style={titulo}>Minha conta</h2>
                <p style={{ margin: '0 0 12px', color: '#64748b' }}>Troque a senha inicial por uma só sua. "Sair de todos os dispositivos" derruba todas as sessões abertas desta conta.</p>
                <input value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)} placeholder="Senha atual" style={{ ...campo, marginBottom: 8 }} type="password" autoComplete="current-password" />
                <input value={minhaSenha} onChange={(e) => setMinhaSenha(e.target.value)} placeholder="Nova senha (mínimo 8, com letras e números)" style={campo} type="password" autoComplete="new-password" />
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
                    <button type="button" onClick={trocarMinha} disabled={minhaSenha.length < 8 || !senhaAtual} style={botao}>Trocar minha senha</button>
                    <button type="button" onClick={sairTudo} style={{ ...botao, background: '#9a3412' }}>Sair de todos os dispositivos</button>
                </div>
            </section>
            <section style={{ ...painel, marginTop: 16 }}>
                <h2 style={titulo}>Redefinir senha de um usuário</h2>
                <p style={{ margin: '0 0 12px', color: '#64748b' }}>Para quem esqueceu a senha: informe o e-mail do usuário e uma senha nova (mínimo 6 caracteres) e avise a pessoa.</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 12 }}>
                    <input value={emailRs} onChange={(e) => setEmailRs(e.target.value)} placeholder="E-mail do usuário" style={campo} type="email" autoComplete="off" />
                    <input value={senhaRs} onChange={(e) => setSenhaRs(e.target.value)} placeholder="Senha nova" style={campo} type="password" autoComplete="new-password" />
                </div>
                <button type="button" onClick={redefinir} disabled={!emailRs || senhaRs.length < 6} style={{ ...botao, marginTop: 14 }}>Redefinir senha</button>
            </section>
            <section style={{ ...painel, marginTop: 16 }}>
                <h2 style={titulo}>Importar alunos por planilha (CSV)</h2>
                <p style={{ margin: '0 0 12px', color: '#64748b' }}>Colunas: <code>responsavel_nome, responsavel_email, responsavel_cpf, responsavel_telefone, aluno_nome, aluno_nascimento, aluno_cpf</code> (primeira linha com os nomes; separador vírgula ou ponto e vírgula; até 500 linhas). Os alunos entram como pendentes de aprovação.</p>
                <input type="file" accept=".csv,text/csv" onChange={(e) => importar(e.target.files?.[0])} style={{ minHeight: 44 }} />
                {resumoImport && <p style={{ marginTop: 12, fontWeight: 700 }}>{resumoImport}</p>}
            </section>
            <section style={{ ...painel, marginTop: 16 }}>
                <h2 style={titulo}>Cópia de segurança</h2>
                <p style={{ margin: '0 0 12px', color: '#64748b' }}>Baixa todos os dados da escola em um arquivo. O backup automático diário ainda não existe: faça este download com frequência.</p>
                <button type="button" onClick={baixar} style={botao}><Download size={17} /> Baixar backup</button>
            </section>
            <section style={{ ...painel, marginTop: 16 }}>
                <h2 style={titulo}>Registro de ações (últimas 100)</h2>
                {log.length === 0 ? <p style={{ color: '#64748b' }}>Nenhuma ação registrada ainda.</p> : (
                    <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}><tbody>
                        {log.map((l, i) => <tr key={i} style={{ borderTop: '1px solid rgba(16,33,63,0.1)' }}><td style={{ padding: 8, whiteSpace: 'nowrap' }}>{new Date(l.quando).toLocaleString('pt-BR')}</td><td style={{ padding: 8 }}>{l.quem}</td><td style={{ padding: 8 }}>{l.acao}</td></tr>)}
                    </tbody></table></div>
                )}
            </section>
        </div>
    );
}

const painel: React.CSSProperties = { background: '#fff', border: '1px solid rgba(16,33,63,0.14)', borderRadius: 12, padding: 18, boxShadow: '0 8px 24px rgba(15,23,42,0.06)', minWidth: 0 };
const titulo: React.CSSProperties = { margin: '0 0 12px', fontSize: '1.15rem' };
const campo: React.CSSProperties = { width: '100%', boxSizing: 'border-box', minHeight: 48, border: '1px solid rgba(16,33,63,0.22)', borderRadius: 8, padding: '10px 12px', font: 'inherit' };
const botao: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 44, border: 'none', borderRadius: 9, background: '#17428f', color: '#fff', padding: '0 16px', fontWeight: 900, cursor: 'pointer' };
