/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import type React from 'react';
import { CheckCircle2, Loader2, Plug, QrCode, Save, Send, Server, XCircle } from 'lucide-react';
import { useDialog } from '../context/CustomDialogContext';

// Servidor de WhatsApp (Evolution API) PRÓPRIO desta escola. Fala com as rotas /sys/wa/* do Worker, que guarda a chave cifrada.
const token = () => { try { return localStorage.getItem('pg_sys_token') || sessionStorage.getItem('pg_sys_token') || ''; } catch { return ''; } };
async function wa(method: string, acao: string, body?: unknown) {
    const r = await fetch('/sys/wa/' + acao, { method, headers: { 'content-type': 'application/json', authorization: `Bearer ${token()}` }, body: body === undefined ? undefined : JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.erro || `Erro ${r.status}`);
    return j;
}
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export default function AdminWhatsappServidor() {
    const { showAlert } = useDialog();
    const [url, setUrl] = useState('');
    const [instance, setInstance] = useState('');
    const [apikey, setApikey] = useState('');
    const [apikeySet, setApikeySet] = useState(false);
    const [ocupado, setOcupado] = useState<string | null>(null);
    const [estado, setEstado] = useState<string>('');
    const [qr, setQr] = useState('');
    const [numero, setNumero] = useState('');
    const [texto, setTexto] = useState('Olá! Esta é uma mensagem de teste do sistema da escola.');

    useEffect(() => {
        wa('GET', 'config').then((c) => { setUrl(c.url || ''); setInstance(c.instance || ''); setApikeySet(Boolean(c.apikeySet)); }).catch((e) => showAlert(msg(e), 'error'));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const rodar = async (chave: string, f: () => Promise<void>) => { setOcupado(chave); try { await f(); } catch (e) { showAlert(msg(e), 'error'); } finally { setOcupado(null); } };

    const salvar = () => rodar('salvar', async () => {
        await wa('PUT', 'config', { url, instance, apikey });
        setApikey(''); setApikeySet(true); showAlert('Servidor de WhatsApp salvo. A chave fica guardada cifrada.', 'success');
    });
    const testar = () => rodar('status', async () => {
        const j = await wa('GET', 'status');
        setEstado(String(j?.instance?.state || j?.state || 'desconhecido'));
    });
    const criar = () => rodar('criar', async () => {
        const j = await wa('POST', 'criar', {});
        setQr(j?.qrcode?.base64 || ''); showAlert('Instância criada. Leia o QR Code com o WhatsApp da escola.', 'success');
    });
    const buscarQr = () => rodar('qr', async () => {
        const j = await wa('GET', 'qr');
        if (j?.base64) setQr(j.base64); else showAlert('O servidor não devolveu QR Code. A instância pode já estar conectada.', 'info');
    });
    const enviar = () => rodar('enviar', async () => { await wa('POST', 'enviar', { numero, texto }); showAlert('Mensagem enviada.', 'success'); });

    const conectado = estado === 'open';

    return (
        <div className="admin-page" style={{ padding: 24, color: '#172033' }}>
            <header style={{ marginBottom: 20 }}>
                <p style={{ margin: '0 0 6px', color: '#00a63a', fontWeight: 900, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Mensagens</p>
                <h1 style={{ margin: 0, fontSize: '2rem', color: '#17428f' }}>Servidor de WhatsApp da escola</h1>
                <p style={{ margin: '8px 0 0', color: '#64748b', maxWidth: 780 }}>
                    Cada escola usa o próprio servidor Evolution API, com o próprio número de WhatsApp. Informe aqui o endereço e a chave do servidor desta escola (o passo a passo para criar o servidor está em <code>docs/evolution-por-escola.md</code>).
                </p>
            </header>

            <section style={painel}>
                <h2 style={titulo}><Server size={20} color="#17428f" /> Servidor</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 14 }}>
                    <label style={rotulo}>Endereço do servidor (https)
                        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://whatsapp.suaescola.com.br" style={campo} inputMode="url" autoComplete="off" />
                    </label>
                    <label style={rotulo}>Nome da instância
                        <input value={instance} onChange={(e) => setInstance(e.target.value)} placeholder="minha-escola" style={campo} autoComplete="off" />
                    </label>
                    <label style={rotulo}>Chave de API do servidor
                        <input type="password" value={apikey} onChange={(e) => setApikey(e.target.value)} placeholder={apikeySet ? '•••••••• salva — deixe em branco para manter' : 'AUTHENTICATION_API_KEY'} style={campo} autoComplete="off" />
                    </label>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
                    <button type="button" onClick={salvar} disabled={!!ocupado} style={botao('#111827')}>{ocupado === 'salvar' ? <Loader2 className="spin" size={17} /> : <Save size={17} />} Salvar</button>
                    <button type="button" onClick={testar} disabled={!!ocupado} style={botao('#17428f')}>{ocupado === 'status' ? <Loader2 className="spin" size={17} /> : <Plug size={17} />} Testar conexão</button>
                    {estado && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 800, color: conectado ? '#027a48' : '#9a3412' }}>
                            {conectado ? <CheckCircle2 size={18} /> : <XCircle size={18} />} {conectado ? 'WhatsApp conectado' : `Estado: ${estado}`}
                        </span>
                    )}
                </div>
            </section>

            <section style={{ ...painel, marginTop: 16 }}>
                <h2 style={titulo}><QrCode size={20} color="#17428f" /> Conectar o número da escola</h2>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button type="button" onClick={criar} disabled={!!ocupado} style={botao('#334155')}>{ocupado === 'criar' ? <Loader2 className="spin" size={17} /> : null} Criar instância</button>
                    <button type="button" onClick={buscarQr} disabled={!!ocupado} style={botao('#334155')}>{ocupado === 'qr' ? <Loader2 className="spin" size={17} /> : null} Gerar QR Code</button>
                </div>
                {qr && <img src={qr} alt="QR Code para conectar o WhatsApp" style={{ marginTop: 16, width: 240, height: 240, borderRadius: 12, border: '1px solid rgba(16,33,63,0.14)', background: '#fff' }} />}
            </section>

            <section style={{ ...painel, marginTop: 16 }}>
                <h2 style={titulo}><Send size={20} color="#17428f" /> Mensagem de teste</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 14 }}>
                    <label style={rotulo}>Número com DDD
                        <input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="(31) 99999-8888" style={campo} inputMode="tel" />
                    </label>
                    <label style={rotulo}>Texto
                        <input value={texto} onChange={(e) => setTexto(e.target.value)} style={campo} maxLength={1000} />
                    </label>
                </div>
                <button type="button" onClick={enviar} disabled={!!ocupado || !numero} style={{ ...botao('#00a63a'), marginTop: 16 }}>{ocupado === 'enviar' ? <Loader2 className="spin" size={17} /> : <Send size={17} />} Enviar teste</button>
            </section>
        </div>
    );
}

const painel: React.CSSProperties = { background: '#fff', border: '1px solid rgba(16,33,63,0.14)', borderRadius: 12, padding: 18, boxShadow: '0 8px 24px rgba(15,23,42,0.06)', minWidth: 0 };
const titulo: React.CSSProperties = { margin: '0 0 14px', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: 8 };
const rotulo: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, color: '#334155', fontWeight: 800, fontSize: '0.9rem' };
const campo: React.CSSProperties = { width: '100%', boxSizing: 'border-box', minHeight: 48, border: '1px solid rgba(16,33,63,0.22)', borderRadius: 8, padding: '10px 12px', color: '#10213f', background: '#fff', font: 'inherit', fontWeight: 600 };
const botao = (bg: string): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44, border: 'none', borderRadius: 9, background: bg, color: '#fff', padding: '0 16px', fontWeight: 900, cursor: 'pointer' });
