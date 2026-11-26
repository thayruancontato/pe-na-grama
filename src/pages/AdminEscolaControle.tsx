/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from 'react';
import { Download, FileSpreadsheet, KeyRound, Loader2, LogOut, ShieldCheck, Upload, UserCog, FileDown, Eye, EyeOff } from 'lucide-react';
import { useDialog } from '../context/CustomDialogContext';
import '../styles/escola-controle.css';

// Inscrições abertas/fechadas, importação, backup, senhas e registro de ações (versão sem Firebase, rotas /sys/*).
const token = () => { try { return localStorage.getItem('pg_sys_token') || sessionStorage.getItem('pg_sys_token') || ''; } catch { return ''; } };
async function api(method: string, caminho: string, body?: unknown) {
    const r = await fetch('/sys/' + caminho, { method, headers: { 'content-type': 'application/json', authorization: `Bearer ${token()}` }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).erro || `Erro ${r.status}`);
    return r;
}
const MODELO_CSV = 'responsavel_nome,responsavel_email,responsavel_cpf,responsavel_telefone,aluno_nome,aluno_nascimento,aluno_cpf\nMaria da Silva,maria@exemplo.com,00000000000,31999998888,João da Silva,2014-05-20,\n';
const senhaForte = (s: string) => s.length >= 8 && /[A-Za-z]/.test(s) && /\d/.test(s);

export default function AdminEscolaControle() {
    const { showAlert } = useDialog();
    const erro = (e: unknown) => showAlert(e instanceof Error ? e.message : String(e), 'error');

    // ----- inscrições -----
    const [abertas, setAbertas] = useState(true);
    const [mensagem, setMensagem] = useState('');
    const [salvo, setSalvo] = useState({ abertas: true, mensagem: '' });
    const [ocupado, setOcupado] = useState(false);
    const sujo = abertas !== salvo.abertas || mensagem !== salvo.mensagem;
    const [log, setLog] = useState<{ quem: string; quando: string; acao: string }[]>([]);
    const [carregandoLog, setCarregandoLog] = useState(true);

    useEffect(() => {
        api('GET', 'db/system_settings/inscricoes').then((r) => r.json()).then((j) => { if (j.existe) { const a = j.data.abertas !== false, m = j.data.mensagem || ''; setAbertas(a); setMensagem(m); setSalvo({ abertas: a, mensagem: m }); } }).catch(() => {});
        api('GET', 'db/auditoria').then((r) => r.json()).then((j) => setLog((j.docs || []).map((d: any) => d.data).sort((a: any, b: any) => b.quando.localeCompare(a.quando)).slice(0, 100))).catch(() => {}).finally(() => setCarregandoLog(false));
    }, []);

    const salvar = async () => {
        setOcupado(true);
        try { await api('PUT', 'db/system_settings/inscricoes', { data: { abertas, mensagem } }); setSalvo({ abertas, mensagem }); showAlert(abertas ? 'Inscrições abertas.' : 'Inscrições fechadas.', 'success'); }
        catch (e) { erro(e); } finally { setOcupado(false); }
    };

    // ----- importar CSV -----
    const [resumoImport, setResumoImport] = useState<{ ok: number; falhas: { linha: number; motivo: string }[] } | null>(null);
    const [importando, setImportando] = useState(false);
    const [arrastando, setArrastando] = useState(false);
    const arquivoRef = useRef<HTMLInputElement>(null);
    const importar = async (arquivo?: File) => {
        if (!arquivo) return;
        setImportando(true); setResumoImport(null);
        try {
            const texto = (await arquivo.text()).replace(/^﻿/, '');
            const linhasTxt = texto.split(/\r?\n/).filter((l) => l.trim());
            const sep = (linhasTxt[0] || '').includes(';') ? ';' : ',';
            const cab = (linhasTxt.shift() || '').split(sep).map((c) => c.trim().toLowerCase().replace(/^"|"$/g, ''));
            // shortcut: CSV simples (sem vírgula dentro de aspas); planilhas com texto entre aspas e separador dentro precisam de um parser completo
            const linhas = linhasTxt.map((l) => Object.fromEntries(l.split(sep).map((v, i) => [cab[i], v.trim().replace(/^"|"$/g, '')])));
            const j = await (await api('POST', 'import', { linhas })).json();
            setResumoImport({ ok: j.importados, falhas: j.falhas || [] });
        } catch (e) { erro(e); } finally { setImportando(false); if (arquivoRef.current) arquivoRef.current.value = ''; }
    };
    const baixarModelo = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + MODELO_CSV], { type: 'text/csv;charset=utf-8' })); a.download = 'modelo-importacao-alunos.csv'; a.click(); URL.revokeObjectURL(a.href); };

    // ----- senhas e sessões -----
    const [minhaSenha, setMinhaSenha] = useState('');
    const [senhaAtual, setSenhaAtual] = useState('');
    const [ver, setVer] = useState(false);
    const trocarMinha = async () => {
        try { const j = await (await api('POST', 'auth/password', { password: minhaSenha, atual: senhaAtual })).json(); if (j && j.token) localStorage.setItem('pg_sys_token', j.token); setMinhaSenha(''); setSenhaAtual(''); showAlert('Senha trocada. Os outros aparelhos foram desconectados.', 'success'); }
        catch (e) { erro(e); }
    };
    const sairTudo = async () => {
        try { await api('POST', 'auth/logout-all', {}); try { localStorage.removeItem('pg_sys_token'); sessionStorage.removeItem('pg_sys_token'); } catch { /* sem armazenamento */ } location.href = '/'; }
        catch (e) { erro(e); }
    };
    const [emailRs, setEmailRs] = useState('');
    const [senhaRs, setSenhaRs] = useState('');
    const redefinir = async () => {
        try { await api('POST', 'auth/reset', { email: emailRs, password: senhaRs }); setSenhaRs(''); showAlert('Senha redefinida. Avise a pessoa e peça para trocá-la no primeiro acesso.', 'success'); }
        catch (e) { erro(e); }
    };

    // ----- backup -----
    const [ultimoBackup, setUltimoBackup] = useState(() => { try { return localStorage.getItem('pg_ultimo_backup') || ''; } catch { return ''; } });
    const [baixando, setBaixando] = useState(false);
    const baixar = async () => {
        setBaixando(true);
        try {
            const blob = await (await api('GET', 'export')).blob();
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `backup-${location.hostname.split('.')[0]}-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(a.href);
            const agora = new Date().toISOString(); setUltimoBackup(agora); try { localStorage.setItem('pg_ultimo_backup', agora); } catch { /* sem armazenamento */ }
        } catch (e) { erro(e); } finally { setBaixando(false); }
    };
    const diasDesde = ultimoBackup ? Math.floor((Date.now() - new Date(ultimoBackup).getTime()) / 864e5) : null;

    return (
        <div className="ec">
            <header className="ec-topo"><h1><ShieldCheck size={22} /> Inscrições, backup e segurança</h1><p>Abra ou feche o formulário, importe alunos, proteja o acesso e guarde uma cópia dos dados.</p></header>

            <div className="ec-grade">
                <div className="ec-col">
                    <section className="ec-p">
                        <h2>Formulário de inscrição <span className={`ec-tag ${abertas ? 'ok' : 'no'}`}>{abertas ? 'Aberto' : 'Fechado'}</span></h2>
                        <label className="ec-sw">
                            <input type="checkbox" role="switch" checked={abertas} onChange={(e) => setAbertas(e.target.checked)} />
                            <i aria-hidden />
                            <span><b>Receber novas inscrições</b><small>{abertas ? 'Responsáveis conseguem se inscrever pela página inicial.' : 'O formulário mostra a mensagem abaixo no lugar dos campos.'}</small></span>
                        </label>
                        {!abertas && <div className="ec-campo"><label htmlFor="ec-msg">Mensagem para quem tentar se inscrever</label><input id="ec-msg" value={mensagem} onChange={(e) => setMensagem(e.target.value)} maxLength={300} placeholder="Ex.: Inscrições encerradas. Volte em janeiro!" /><small>{mensagem.length}/300</small></div>}
                        <div className="ec-acoes"><button type="button" className="ec-btn forte" onClick={salvar} disabled={ocupado || !sujo}>{ocupado ? <Loader2 size={16} className="spin" /> : null} Salvar</button>{!sujo && <small className="ec-ok">Tudo salvo</small>}</div>
                    </section>

                    <section className="ec-p">
                        <h2>Importar alunos por planilha</h2>
                        <p className="ec-sub">Use um arquivo CSV com os nomes das colunas na primeira linha. Os alunos entram como <b>pendentes de aprovação</b>.</p>
                        <div className={`ec-drop${arrastando ? ' on' : ''}`} onDragOver={(e) => { e.preventDefault(); setArrastando(true); }} onDragLeave={() => setArrastando(false)} onDrop={(e) => { e.preventDefault(); setArrastando(false); importar(e.dataTransfer.files?.[0]); }}>
                            {importando ? <Loader2 size={26} className="spin" /> : <FileSpreadsheet size={26} />}
                            <b>{importando ? 'Importando…' : 'Arraste o arquivo CSV aqui'}</b>
                            <span>ou</span>
                            <button type="button" className="ec-btn" onClick={() => arquivoRef.current?.click()} disabled={importando}><Upload size={15} /> Escolher arquivo</button>
                            <input ref={arquivoRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => importar(e.target.files?.[0])} />
                        </div>
                        <button type="button" className="ec-link" onClick={baixarModelo}><FileDown size={14} /> Baixar planilha modelo</button>
                        {resumoImport && (
                            <div className="ec-res">
                                <span className="ec-tag ok">{resumoImport.ok} importado(s)</span>{resumoImport.falhas.length > 0 && <span className="ec-tag no">{resumoImport.falhas.length} recusado(s)</span>}
                                {resumoImport.falhas.length > 0 && <ul>{resumoImport.falhas.slice(0, 6).map((f, i) => <li key={i}>Linha {f.linha}: {f.motivo}</li>)}{resumoImport.falhas.length > 6 && <li>…e mais {resumoImport.falhas.length - 6}</li>}</ul>}
                            </div>
                        )}
                    </section>

                    <section className="ec-p">
                        <h2>Cópia de segurança {diasDesde !== null && <span className={`ec-tag ${diasDesde > 7 ? 'no' : 'ok'}`}>{diasDesde === 0 ? 'feita hoje' : `há ${diasDesde} dia(s)`}</span>}</h2>
                        <p className="ec-sub">Baixa todos os dados da escola em um arquivo. O backup automático diário ainda não existe: faça este download com frequência{ultimoBackup ? '' : ' (você ainda não fez nenhum neste aparelho)'}.</p>
                        <div className="ec-acoes"><button type="button" className="ec-btn forte" onClick={baixar} disabled={baixando}>{baixando ? <Loader2 size={16} className="spin" /> : <Download size={16} />} Baixar backup</button></div>
                    </section>
                </div>

                <div className="ec-col">
                    <section className="ec-p">
                        <h2><KeyRound size={17} /> Minha conta</h2>
                        <p className="ec-sub">Troque a senha inicial por uma só sua. Ao trocar, os outros aparelhos são desconectados.</p>
                        <div className="ec-campo"><label htmlFor="ec-atual">Senha atual</label><input id="ec-atual" value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)} type={ver ? 'text' : 'password'} autoComplete="current-password" /></div>
                        <div className="ec-campo"><label htmlFor="ec-nova">Nova senha</label>
                            <div className="ec-olho"><input id="ec-nova" value={minhaSenha} onChange={(e) => setMinhaSenha(e.target.value)} type={ver ? 'text' : 'password'} autoComplete="new-password" /><button type="button" onClick={() => setVer(!ver)} aria-label={ver ? 'Ocultar senhas' : 'Mostrar senhas'}>{ver ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>
                            <small className={minhaSenha ? (senhaForte(minhaSenha) ? 'ec-ok' : 'ec-no') : ''}>Mínimo 8 caracteres, com letras e números.</small></div>
                        <div className="ec-acoes"><button type="button" className="ec-btn forte" onClick={trocarMinha} disabled={!senhaForte(minhaSenha) || !senhaAtual}>Trocar minha senha</button>
                            <button type="button" className="ec-btn perigo" onClick={sairTudo}><LogOut size={15} /> Sair de todos os aparelhos</button></div>
                    </section>

                    <section className="ec-p">
                        <h2><UserCog size={17} /> Redefinir senha de um usuário</h2>
                        <p className="ec-sub">Para quem esqueceu a senha: informe o e-mail e uma senha nova, e avise a pessoa.</p>
                        <div className="ec-campo"><label htmlFor="ec-em">E-mail do usuário</label><input id="ec-em" value={emailRs} onChange={(e) => setEmailRs(e.target.value)} type="email" autoComplete="off" /></div>
                        <div className="ec-campo"><label htmlFor="ec-sn">Senha nova</label><input id="ec-sn" value={senhaRs} onChange={(e) => setSenhaRs(e.target.value)} type="password" autoComplete="new-password" /><small className={senhaRs ? (senhaForte(senhaRs) ? 'ec-ok' : 'ec-no') : ''}>Mínimo 8 caracteres, com letras e números.</small></div>
                        <div className="ec-acoes"><button type="button" className="ec-btn forte" onClick={redefinir} disabled={!emailRs || !senhaForte(senhaRs)}>Redefinir senha</button></div>
                    </section>
                </div>
            </div>

            <section className="ec-p ec-largo">
                <h2>Registro de ações <span className="ec-tag">últimas {log.length || 100}</span></h2>
                {carregandoLog ? <p className="ec-sub">Carregando…</p> : log.length === 0 ? <p className="ec-sub">Nenhuma ação registrada ainda.</p> : (
                    <div className="ec-rolagem"><table className="est-tab"><thead><tr><th>Quando</th><th>Quem</th><th>Ação</th></tr></thead>
                        <tbody>{log.map((l, i) => <tr key={i}><td>{new Date(l.quando).toLocaleString('pt-BR')}</td><td>{l.quem}</td><td>{l.acao}</td></tr>)}</tbody></table></div>
                )}
            </section>
        </div>
    );
}
