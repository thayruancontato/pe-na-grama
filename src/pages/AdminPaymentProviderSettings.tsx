import { useEffect, useMemo, useState } from 'react';
import type React from 'react';
import { ArrowUpRight, CheckCircle2, Copy, FlaskConical, KeyRound, Loader2, RefreshCw, ShieldAlert, Trash2, Webhook, XCircle } from 'lucide-react';
import { useDialog } from '../context/CustomDialogContext';
import {
    ADMIN_KEY_STORAGE,
    getAdminKey,
    getPaymentProviderConfig,
    getPaymentProviderLabel,
    savePaymentProviderConfig,
    type PaymentProviderConfig
} from '../utils/paymentProviderConfig';
import {
    METHOD_LABEL,
    PROVIDERS,
    VERIFICATION_LABEL,
    getProviderDef,
    type BillingMethod,
    type ProviderDef
} from '../utils/paymentProviders';

interface StoredConfig {
    fields: Record<string, string | { set: boolean }>;
    environment: string;
    updatedAt: string | null;
    encrypted: boolean;
    configured: boolean;
}

const workerUrl = import.meta.env.VITE_WORKER_URL || import.meta.env.VITE_PAYMENT_API_URL;
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const isSecretSet = (v: unknown) => typeof v === "object" && v !== null && "set" in v && Boolean((v as { set: unknown }).set);
const LEGACY = ['asaas', 'cora'];

/** Chamada ao Worker com a chave de administrador (PROVIDER_ADMIN_KEY), guardada neste navegador. */
async function authFetch(path: string, options: RequestInit = {}) {
    if (!workerUrl) throw new Error('VITE_WORKER_URL não configurado.');
    const token = getAdminKey();
    const response = await fetch(`${workerUrl}${path}`, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) }
    });
    return response.json();
}

/** Logo do provedor; se o arquivo faltar, vira um selo com a cor e as iniciais da marca. */
function ProviderLogo({ provider, size = 44 }: { provider: ProviderDef; size?: number }) {
    const [broken, setBroken] = useState(!provider.logo);
    return (
        <span style={{ width: size, height: size, flex: `0 0 ${size}px`, borderRadius: 10, background: broken ? provider.color : '#fff', border: '1px solid #e2e8f0', display: 'inline-grid', placeItems: 'center', overflow: 'hidden' }}>
            {broken
                ? <b style={{ color: '#fff', fontSize: size * 0.4 }}>{provider.name.slice(0, 1)}</b>
                : <img src={provider.logo} alt={`Logo ${provider.name}`} onError={() => setBroken(true)} style={{ width: size * 0.7, height: size * 0.7, objectFit: 'contain' }} />}
        </span>
    );
}

export default function AdminPaymentProviderSettings() {
    const { showConfirm } = useDialog();
    const [selectedId, setSelectedId] = useState('cora');
    const [environment, setEnvironment] = useState('production');
    const [filter, setFilter] = useState<'ALL' | BillingMethod>('ALL');
    const [statusMap, setStatusMap] = useState<Record<string, { configured: boolean; certificateInstalled?: boolean }>>({});
    const [stored, setStored] = useState<StoredConfig | null>(null);
    const [form, setForm] = useState<Record<string, string>>({});
    const [webhookUrls, setWebhookUrls] = useState<Record<string, string>>({});
    const [activeConfig, setActiveConfig] = useState<PaymentProviderConfig | null>(null);
    const [loading, setLoading] = useState<string | null>(null);
    const [result, setResult] = useState<unknown>(null);
    const [amount, setAmount] = useState('5.00');
    const [description, setDescription] = useState('Teste Pé na Grama');
    const [billingType, setBillingType] = useState<BillingMethod>('PIX');
    const [paymentId, setPaymentId] = useState('');
    const [adminKey, setAdminKey] = useState(getAdminKey());
    const [keySaved, setKeySaved] = useState(Boolean(getAdminKey()));

    const selected = useMemo(() => getProviderDef(selectedId) as ProviderDef, [selectedId]);
    const visible = useMemo(() => PROVIDERS.filter(p => filter === 'ALL' || p.methods.includes(filter)), [filter]);
    const isLegacy = LEGACY.includes(selectedId);
    const hasForm = selected.fields.length > 0;

    const fetchStatus = async () => {
        if (!workerUrl) { setResult({ success: false, error: 'VITE_WORKER_URL não configurado.' }); return; }
        setLoading('providers');
        try {
            const data = await (await fetch(`${workerUrl}/payment-providers`)).json();
            const map: Record<string, { configured: boolean; certificateInstalled?: boolean }> = {};
            for (const p of data.providers || []) map[p.id] = { configured: Boolean(p.configured) };
            for (const p of data.adapterProviders || []) map[p.id] = { configured: Boolean(p.configured), certificateInstalled: p.certificateInstalled };
            setStatusMap(map);
        } catch (error) {
            setResult({ success: false, error: errMsg(error) });
        } finally {
            setLoading(null);
        }
    };

    const loadStored = async (id: string) => {
        const def = getProviderDef(id);
        setStored(null);
        setForm({});
        if (!def || def.managed) return;
        try {
            const data = await authFetch(`/payment-providers/config/${id}`);
            if (data.success) {
                setStored(data.config);
                const plain: Record<string, string> = {};
                for (const f of def.fields) if (!f.secret) plain[f.key] = String(data.config.fields[f.key] || '');
                setForm(plain);
                setEnvironment(prev => (def.environments.some(e => e.id === prev) ? prev : data.config.environment));
            }
        } catch { /* sem login/Worker: o formulário abre vazio */ }
    };

    useEffect(() => {
        fetchStatus();
        getPaymentProviderConfig().then(config => {
            setActiveConfig(config);
            setSelectedId(config.provider);
            setEnvironment(config.environment);
        });
        authFetch('/payment-providers/webhook-info').then(d => d.success && setWebhookUrls(d.urls)).catch(() => undefined);
    }, []);

    useEffect(() => {
        loadStored(selectedId);
        const def = getProviderDef(selectedId);
        if (def) {
            setEnvironment(prev => (def.environments.some(e => e.id === prev) ? prev : def.environments[0].id));
            setBillingType(prev => (def.methods.includes(prev) ? prev : def.methods[0]));
        }
    }, [selectedId]);

    const run = async (key: string, task: () => Promise<unknown>) => {
        setLoading(key);
        try { setResult(await task()); } catch (error) { setResult({ success: false, error: errMsg(error) }); } finally { setLoading(null); }
    };

    const handleSaveCredentials = () => run('save', async () => {
        const missing = selected.fields.filter(f => f.required && !(form[f.key] || isSecretSet(stored?.fields[f.key])));
        if (missing.length) return { success: false, error: `Preencha: ${missing.map(f => f.label).join(', ')}.` };
        const data = await authFetch(`/payment-providers/config/${selectedId}`, { method: 'PUT', body: JSON.stringify({ fields: form, environment }) });
        if (data.success) {
            setStored(data.config);
            setForm(prev => Object.fromEntries(Object.entries(prev).filter(([k]) => !selected.fields.find(f => f.key === k)?.secret)));
            fetchStatus();
            return { success: true, message: `Credenciais de ${selected.name} salvas${data.config.encrypted ? ' (cifradas).' : ' (sem cifra: defina PROVIDER_CONFIG_KEY no Worker).'}` };
        }
        return data;
    });

    const handleRemove = () => showConfirm(
        `Remover as credenciais de ${selected.name} salvas no sistema?`,
        () => run('remove', async () => {
            const data = await authFetch(`/payment-providers/config/${selectedId}`, { method: 'DELETE' });
            await loadStored(selectedId);
            fetchStatus();
            return data.success ? { success: true, message: 'Credenciais removidas.' } : data;
        }),
        'warning',
        'Remover credenciais'
    );

    const handleUse = () => run('use', async () => {
        const saved = await savePaymentProviderConfig({ provider: selectedId, environment, testMode: selectedId === 'cora' && environment === 'stage' });
        setActiveConfig(saved);
        return { success: true, message: `Provedor ativo: ${getPaymentProviderLabel(saved)}.`, config: saved };
    });

    const handleTest = (action: 'auth' | 'balance') => run(action, () =>
        authFetch('/payment-providers/test', { method: 'POST', body: JSON.stringify({ provider: selectedId, environment, action }) }));

    const handleRegisterWebhook = () => run('webhook', () => authFetch(`/payment-providers/webhook-register/${selectedId}`, { method: 'POST' }));

    const handleCreateTestPayment = () => run('create', async () => {
        const data = await authFetch('/create-payment', {
            method: 'POST',
            body: JSON.stringify({
                provider: selectedId, environment, financialTestMode: selectedId === 'cora' && environment === 'stage',
                amount: Math.round(Number(amount.replace(',', '.')) * 100), billingType,
                responsibleName: 'Admin Tester', responsibleCpf: '15133300638', responsibleEmail: 'admin_test@rumoaoesporte.com.br',
                responsiblePhone: '44999999999', childName: 'Teste Sistema', registrationId: `TEST_${selectedId.toUpperCase()}_${Date.now()}`, description
            })
        });
        if (data.payment?.id) setPaymentId(data.payment.id);
        return data;
    });

    const handleStatus = () => run('status', () =>
        authFetch(`/payment-status?paymentId=${encodeURIComponent(paymentId)}&provider=${selectedId}&environment=${environment}`));

    const handleCoraStagePay = () => run('stage-pay', () =>
        authFetch('/payment-providers/cora/stage-pay', { method: 'POST', body: JSON.stringify({ invoiceId: paymentId }) }));

    const saveAdminKey = () => {
        try { localStorage.setItem(ADMIN_KEY_STORAGE, adminKey.trim()); } catch { /* navegador sem armazenamento */ }
        setKeySaved(Boolean(adminKey.trim()));
        loadStored(selectedId);
        authFetch('/payment-providers/webhook-info').then(d => d.success && setWebhookUrls(d.urls)).catch(() => undefined);
        setResult({ success: true, message: 'Chave guardada neste navegador.' });
    };

    const copy = (text: string) => navigator.clipboard?.writeText(text).then(() => setResult({ success: true, message: 'Copiado.' }));

    const state = statusMap[selectedId];
    const webhookUrl = selectedId === 'asaas' ? (workerUrl ? `${workerUrl}/asaas/webhook` : '') : webhookUrls[selectedId];
    const canRegisterWebhook = ['efi', 'inter', 'sicoob'].includes(selectedId);
    const verification = VERIFICATION_LABEL[selected.verification];

    const badge = (ok: boolean, yes: string, no: string) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 999, background: ok ? '#ecfdf3' : '#fff1f2', color: ok ? '#027a48' : '#be123c', fontWeight: 800, fontSize: '0.74rem', whiteSpace: 'nowrap' }}>
            {ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />}{ok ? yes : no}
        </span>
    );

    return (
        <div className="admin-page" style={{ padding: 24, color: '#172033' }}>
            <header style={{ marginBottom: 20 }}>
                <p style={{ margin: '0 0 6px', color: '#00a63a', fontWeight: 900, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Financeiro</p>
                <h1 style={{ margin: 0, fontSize: '2rem', color: '#17428f' }}>Provedores de pagamento</h1>
                <p style={{ margin: '8px 0 0', color: '#64748b', maxWidth: 820 }}>
                    Escolha por onde a escola recebe. Cada provedor tem as próprias credenciais, ambientes e passos de webhook. Salve, teste a conexão e só então ative.
                </p>
                <div style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 999, background: '#ecfdf3', color: '#027a48', fontWeight: 900 }}>
                    Provedor ativo: {activeConfig ? getPaymentProviderLabel(activeConfig) : 'carregando...'}
                </div>
            </header>

            <div style={{ ...panelStyle, marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <label style={{ ...labelStyle, flex: '1 1 280px' }}>
                    Chave de administrador {keySaved && <span style={{ color: '#027a48' }}>(guardada)</span>}
                    <input type="password" autoComplete="off" value={adminKey} onChange={e => setAdminKey(e.target.value)} placeholder="Cole a chave entregue na instalação" style={inputStyle} />
                </label>
                <button onClick={saveAdminKey} style={buttonStyle('#17428f')}><KeyRound size={17} /> Guardar chave</button>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
                {(['ALL', 'PIX', 'BOLETO', 'CREDIT_CARD'] as const).map(m => (
                    <button key={m} type="button" onClick={() => setFilter(m)} style={{ ...chipStyle, ...(filter === m ? { background: '#17428f', color: '#fff', borderColor: '#17428f' } : {}) }}>
                        {m === 'ALL' ? `Todos (${PROVIDERS.length})` : METHOD_LABEL[m]}
                    </button>
                ))}
                <button onClick={fetchStatus} disabled={loading === 'providers'} style={{ ...chipStyle, marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {loading === 'providers' ? <Loader2 className="spin" size={14} /> : <RefreshCw size={14} />} Atualizar status
                </button>
            </div>

            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12, marginBottom: 22 }}>
                {visible.map(p => {
                    const isSel = selectedId === p.id, isActive = activeConfig?.provider === p.id;
                    return (
                        <button key={p.id} type="button" onClick={() => setSelectedId(p.id)} aria-pressed={isSel}
                            style={{ textAlign: 'left', border: `2px solid ${isSel ? p.color : '#e2e8f0'}`, borderRadius: 12, background: isSel ? '#f8fbff' : '#fff', padding: 14, cursor: 'pointer', boxShadow: isSel ? '0 10px 24px rgba(23,66,143,0.12)' : '0 2px 8px rgba(15,23,42,0.04)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <ProviderLogo provider={p} />
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <strong style={{ display: 'block', fontSize: '1rem' }}>{p.name}</strong>
                                    <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700 }}>{VERIFICATION_LABEL[p.verification].text}</span>
                                </div>
                            </div>
                            <p style={{ margin: '10px 0', color: '#475569', fontSize: '0.84rem', lineHeight: 1.4, minHeight: 34 }}>{p.tagline}</p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
                                {p.methods.map(m => <span key={m} style={{ padding: '3px 7px', borderRadius: 6, background: '#f1f5f9', color: '#334155', fontSize: '0.7rem', fontWeight: 800 }}>{METHOD_LABEL[m]}</span>)}
                                <span style={{ marginLeft: 'auto' }}>{isActive ? badge(true, 'Em uso', '') : badge(Boolean(statusMap[p.id]?.configured), 'Configurado', 'Pendente')}</span>
                            </div>
                        </button>
                    );
                })}
            </section>

            <main style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gap: 18 }}>
                <section style={panelStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                        <ProviderLogo provider={selected} size={52} />
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{selected.name}</h2>
                            <a href={selected.docs} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: selected.color, fontWeight: 800, fontSize: '0.84rem', textDecoration: 'none' }}>
                                Documentação oficial <ArrowUpRight size={14} />
                            </a>
                        </div>
                    </div>
                    <p style={{ margin: '8px 0 14px', color: '#64748b' }}>{selected.tagline}</p>

                    <div title={verification.hint} style={{ padding: '10px 12px', borderRadius: 10, marginBottom: 14, background: selected.verification === 'assisted' ? '#fffbeb' : selected.verification === 'partial' ? '#fff7ed' : '#f0f9ff', color: selected.verification === 'assisted' ? '#92400e' : selected.verification === 'partial' ? '#9a3412' : '#075985', fontSize: '0.84rem', lineHeight: 1.5 }}>
                        <b>{verification.text}.</b> {verification.hint}
                    </div>

                    {selected.certificate && state && !state.certificateInstalled && (
                        <div style={{ display: 'flex', gap: 8, padding: '10px 12px', borderRadius: 10, marginBottom: 14, background: '#fef2f2', color: '#991b1b', fontSize: '0.84rem', lineHeight: 1.5 }}>
                            <ShieldAlert size={18} style={{ flex: '0 0 18px' }} />
                            <span>Certificado ainda não instalado: crie o binding <code>{selected.certificate}</code> no Worker (veja <code>docs/provedores-de-pagamento.md</code>).</span>
                        </div>
                    )}

                    {selected.environments.length > 1 && (
                        <label style={{ ...labelStyle, marginBottom: 14 }}>
                            Ambiente
                            <select value={environment} onChange={e => setEnvironment(e.target.value)} style={inputStyle}>
                                {selected.environments.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
                            </select>
                        </label>
                    )}

                    {hasForm ? (
                        <div style={{ display: 'grid', gap: 12, marginBottom: 14 }}>
                            {selected.fields.map(f => {
                                const isSet = f.secret && Boolean(isSecretSet(stored?.fields[f.key]));
                                return (
                                    <label key={f.key} style={labelStyle}>
                                        <span>{f.label}{f.required && ' *'}</span>
                                        <input
                                            type={f.secret ? 'password' : 'text'}
                                            autoComplete="off"
                                            value={form[f.key] || ''}
                                            onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                                            placeholder={isSet ? '•••••••• salvo — deixe em branco para manter' : f.placeholder}
                                            style={inputStyle}
                                        />
                                        {f.help && <span style={{ fontWeight: 500, color: '#64748b', fontSize: '0.78rem', lineHeight: 1.4 }}>{f.help}</span>}
                                    </label>
                                );
                            })}
                        </div>
                    ) : (
                        <p style={{ color: '#475569', fontSize: '0.88rem', lineHeight: 1.5 }}>{selected.webhook}</p>
                    )}

                    {stored && !stored.encrypted && stored.updatedAt && (
                        <p style={{ margin: '0 0 12px', fontSize: '0.78rem', color: '#9a3412' }}>
                            As credenciais estão salvas sem cifra. Defina o segredo <code>PROVIDER_CONFIG_KEY</code> no Worker para cifrá-las.
                        </p>
                    )}

                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {hasForm && (
                            <button onClick={handleSaveCredentials} disabled={!!loading} style={buttonStyle('#111827')}>
                                {loading === 'save' ? <Loader2 className="spin" size={17} /> : <KeyRound size={17} />} Salvar credenciais
                            </button>
                        )}
                        <button onClick={() => handleTest('auth')} disabled={!!loading} style={buttonStyle(selected.color)}>
                            {loading === 'auth' ? <Loader2 className="spin" size={17} /> : <FlaskConical size={17} />} Testar conexão
                        </button>
                        {isLegacy && (
                            <button onClick={() => handleTest('balance')} disabled={!!loading} style={buttonStyle('#17428f')}>
                                {loading === 'balance' ? <Loader2 className="spin" size={17} /> : <RefreshCw size={17} />} Testar saldo
                            </button>
                        )}
                        <button onClick={handleUse} disabled={!!loading || (activeConfig?.provider === selectedId && activeConfig?.environment === environment)} style={buttonStyle('#00a63a')}>
                            {loading === 'use' ? <Loader2 className="spin" size={17} /> : <CheckCircle2 size={17} />} Usar no sistema
                        </button>
                        {hasForm && stored?.configured && (
                            <button onClick={handleRemove} disabled={!!loading} style={buttonStyle('#be123c')}>
                                <Trash2 size={17} /> Remover
                            </button>
                        )}
                    </div>
                </section>

                <aside style={panelStyle}>
                    <h2 style={{ margin: '0 0 12px', fontSize: '1.1rem' }}>Recebimento automático (webhook)</h2>
                    <p style={{ margin: '0 0 10px', color: '#475569', fontSize: '0.88rem', lineHeight: 1.5 }}>{selected.webhook}</p>
                    {webhookUrl && !selected.managed && (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'stretch', marginBottom: 12 }}>
                            <input readOnly value={webhookUrl} style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '0.78rem' }} onFocus={e => e.currentTarget.select()} />
                            <button onClick={() => copy(webhookUrl)} aria-label="Copiar URL do webhook" style={{ ...buttonStyle('#334155'), padding: '0 12px' }}><Copy size={16} /></button>
                        </div>
                    )}
                    {canRegisterWebhook && (
                        <button onClick={handleRegisterWebhook} disabled={!!loading} style={buttonStyle('#334155')}>
                            {loading === 'webhook' ? <Loader2 className="spin" size={17} /> : <Webhook size={17} />} Registrar webhook
                        </button>
                    )}
                    <p style={{ margin: '14px 0 0', color: '#64748b', fontSize: '0.8rem', lineHeight: 1.5 }}>
                        O sistema nunca confia no conteúdo recebido: a cada aviso ele consulta o pagamento no próprio provedor antes de dar baixa.
                    </p>

                    <h2 style={{ margin: '22px 0 10px', fontSize: '1.1rem' }}>Cobrança de teste</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
                        <label style={labelStyle}>Forma
                            <select value={billingType} onChange={e => setBillingType(e.target.value as BillingMethod)} style={inputStyle}>
                                {selected.methods.map(m => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}
                            </select>
                        </label>
                        <label style={labelStyle}>Valor (R$)
                            <input value={amount} onChange={e => setAmount(e.target.value)} style={inputStyle} />
                        </label>
                    </div>
                    <label style={{ ...labelStyle, marginTop: 10 }}>Descrição
                        <input value={description} onChange={e => setDescription(e.target.value)} style={inputStyle} />
                    </label>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
                        <button onClick={handleCreateTestPayment} disabled={!!loading} style={buttonStyle('#00a63a')}>
                            {loading === 'create' ? <Loader2 className="spin" size={17} /> : <CheckCircle2 size={17} />} Gerar cobrança
                        </button>
                    </div>
                    <label style={{ ...labelStyle, marginTop: 12 }}>ID da cobrança
                        <input value={paymentId} onChange={e => setPaymentId(e.target.value)} placeholder="ID retornado pelo provedor" style={inputStyle} />
                    </label>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
                        <button onClick={handleStatus} disabled={!paymentId || !!loading} style={buttonStyle('#334155')}>Consultar status</button>
                        {selectedId === 'cora' && environment === 'stage' && (
                            <button onClick={handleCoraStagePay} disabled={!paymentId || !!loading} style={buttonStyle('#ff3f70')}>Simular pagamento (stage)</button>
                        )}
                    </div>
                </aside>
            </main>

            <section style={{ ...panelStyle, marginTop: 18, background: '#111827', color: '#d1d5db' }}>
                <div style={{ marginBottom: 10, fontWeight: 900, color: '#fff' }}>Resultado da última chamada</div>
                <pre style={{ margin: 0, overflow: 'auto', maxHeight: 320, fontSize: '0.82rem' }}>{JSON.stringify(result || {}, null, 2)}</pre>
            </section>
        </div>
    );
}

const panelStyle: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 18, boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)', minWidth: 0 };
const labelStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, color: '#334155', fontWeight: 800, fontSize: '0.86rem' };
const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid #cbd5e1', borderRadius: 8, padding: '10px 11px', color: '#0f172a', background: '#fff', font: 'inherit', fontWeight: 600 };
const chipStyle: React.CSSProperties = { border: '1px solid #cbd5e1', background: '#fff', color: '#334155', borderRadius: 999, padding: '7px 13px', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer' };
const buttonStyle = (background: string): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 'none', borderRadius: 9, background, color: '#fff', padding: '11px 14px', fontWeight: 900, cursor: 'pointer' });
