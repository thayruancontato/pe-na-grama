/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import { ArrowDown, ArrowUp, Handshake, ImagePlus, Loader2, Pencil, Save, Trash2, X } from 'lucide-react';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useDialog } from '../context/CustomDialogContext';
import { SPONSORS_COLLECTION, SPONSORS_SETTINGS, type SponsorDoc } from '../hooks/useSponsors';

const LADO = 256;

/** Reduz a logo para caber num quadrado de 256px e guarda como imagem embutida (sem armazenamento externo). */
async function prepararLogo(arquivo: File): Promise<string> {
    if (!/^image\/(png|jpe?g|webp)$/.test(arquivo.type)) throw new Error('Envie uma imagem PNG, JPG ou WebP.');
    const url = URL.createObjectURL(arquivo);
    try {
        const img = await new Promise<HTMLImageElement>((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => erro(new Error('Não consegui abrir essa imagem.')); i.src = url; });
        const c = document.createElement('canvas'); c.width = LADO; c.height = LADO;
        const g = c.getContext('2d')!;
        g.fillStyle = '#ffffff'; g.fillRect(0, 0, LADO, LADO);
        const k = Math.min(LADO / img.width, LADO / img.height);
        g.drawImage(img, (LADO - img.width * k) / 2, (LADO - img.height * k) / 2, img.width * k, img.height * k);
        let saida = c.toDataURL('image/png');
        if (saida.length > 150000) saida = c.toDataURL('image/jpeg', 0.86);
        return saida;
    } finally { URL.revokeObjectURL(url); }
}

/** Aceita (31) 99999-8888, 31999998888 ou 5531999998888 e devolve 55 + DDD + número, ou '' se não fizer sentido. */
function normalizarWhatsapp(texto: string): string {
    let d = texto.replace(/\D/g, '');
    if (d.length === 10 || d.length === 11) d = '55' + d;
    return /^55\d{10,11}$/.test(d) ? d : '';
}

const mascara = (d: string) => (d.length >= 12 ? `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, d.length - 4)}-${d.slice(-4)}` : d);

export default function AdminPatrocinadores() {
    const { showAlert, showConfirm } = useDialog();
    const [itens, setItens] = useState<SponsorDoc[]>([]);
    const [mostrar, setMostrar] = useState(true);
    const [carregando, setCarregando] = useState(true);
    const [salvando, setSalvando] = useState(false);
    const [editando, setEditando] = useState<string | null>(null);
    const [nome, setNome] = useState('');
    const [whatsapp, setWhatsapp] = useState('');
    const [logo, setLogo] = useState('');
    const arquivo = useRef<HTMLInputElement>(null);

    const carregar = async () => {
        setCarregando(true);
        try {
            const [snap, cfg] = await Promise.all([getDocs(collection(db, SPONSORS_COLLECTION)), getDoc(doc(db, SPONSORS_SETTINGS.collection, SPONSORS_SETTINGS.id))]);
            const lista = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as SponsorDoc[];
            setItens(lista.sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)));
            setMostrar(cfg.exists() ? (cfg.data() as any).mostrar !== false : true);
        } catch (e) { showAlert('Não consegui carregar os patrocinadores: ' + (e instanceof Error ? e.message : String(e)), 'error'); }
        finally { setCarregando(false); }
    };
    useEffect(() => { carregar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

    const limpar = () => { setEditando(null); setNome(''); setWhatsapp(''); setLogo(''); if (arquivo.current) arquivo.current.value = ''; };

    const alternarMostrar = async (valor: boolean) => {
        setMostrar(valor);
        try { await setDoc(doc(db, SPONSORS_SETTINGS.collection, SPONSORS_SETTINGS.id), { mostrar: valor }, { merge: true }); }
        catch (e) { setMostrar(!valor); showAlert('Não consegui salvar: ' + (e instanceof Error ? e.message : String(e)), 'error'); }
    };

    const escolherLogo = async (f?: File | null) => {
        if (!f) return;
        try { setLogo(await prepararLogo(f)); } catch (e) { showAlert(e instanceof Error ? e.message : String(e), 'warning'); }
    };

    const salvar = async () => {
        const wa = normalizarWhatsapp(whatsapp);
        if (nome.trim().length < 2) return showAlert('Informe o nome do patrocinador.', 'warning');
        if (!logo) return showAlert('Envie a logo do patrocinador.', 'warning');
        if (!wa) return showAlert('Informe o WhatsApp com DDD, por exemplo (31) 99999-8888.', 'warning');
        setSalvando(true);
        try {
            if (editando) await updateDoc(doc(db, SPONSORS_COLLECTION, editando), { nome: nome.trim(), whatsapp: wa, logo });
            else await addDoc(collection(db, SPONSORS_COLLECTION), { nome: nome.trim(), whatsapp: wa, logo, ordem: itens.length ? Math.max(...itens.map((i) => i.ordem ?? 0)) + 1 : 1, ativo: true });
            limpar(); await carregar();
        } catch (e) { showAlert('Não consegui salvar: ' + (e instanceof Error ? e.message : String(e)), 'error'); }
        finally { setSalvando(false); }
    };

    const editar = (s: SponsorDoc) => { setEditando(s.id); setNome(s.nome); setWhatsapp(s.whatsapp); setLogo(s.logo); window.scrollTo({ top: 0, behavior: 'smooth' }); };

    const alternarAtivo = async (s: SponsorDoc) => { await updateDoc(doc(db, SPONSORS_COLLECTION, s.id), { ativo: s.ativo === false }); carregar(); };

    const mover = async (i: number, d: -1 | 1) => {
        const j = i + d; if (j < 0 || j >= itens.length) return;
        const a = itens[i], b = itens[j];
        await Promise.all([updateDoc(doc(db, SPONSORS_COLLECTION, a.id), { ordem: j + 1 }), updateDoc(doc(db, SPONSORS_COLLECTION, b.id), { ordem: i + 1 })]);
        carregar();
    };

    const remover = (s: SponsorDoc) => showConfirm(`Remover ${s.nome} dos patrocinadores?`, async () => { await deleteDoc(doc(db, SPONSORS_COLLECTION, s.id)); if (editando === s.id) limpar(); carregar(); }, 'warning', 'Remover patrocinador');

    const ativos = itens.filter((i) => i.ativo !== false).length;

    return (
        <div className="admin-page" style={{ padding: 24, color: '#172033' }}>
            <header style={{ marginBottom: 20 }}>
                <p style={{ margin: '0 0 6px', color: '#00a63a', fontWeight: 900, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Divulgação</p>
                <h1 style={{ margin: 0, fontSize: '2rem', color: '#17428f' }}>Patrocinadores</h1>
                <p style={{ margin: '8px 0 0', color: '#64748b', maxWidth: 760 }}>
                    As logos aparecem numa faixa na página de inscrição e no portal do aluno. Quem toca na logo abre uma conversa no WhatsApp do patrocinador. Sem nenhum patrocinador ativo, a faixa nem aparece.
                </p>
            </header>

            <section style={painel}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', fontWeight: 800 }}>
                    <input type="checkbox" checked={mostrar} onChange={(e) => alternarMostrar(e.target.checked)} style={{ width: 22, height: 22, accentColor: '#00a63a' }} />
                    Mostrar patrocinadores no sistema
                </label>
                <p style={{ margin: '8px 0 0', color: '#64748b', fontSize: '0.9rem' }}>
                    {!mostrar ? 'Desligado: nada é mostrado ao público.' : ativos ? `Ligado: ${ativos} patrocinador${ativos > 1 ? 'es' : ''} ativo${ativos > 1 ? 's' : ''} aparece${ativos > 1 ? 'm' : ''} na faixa.` : 'Ligado, mas sem patrocinador ativo: a faixa fica escondida até você cadastrar um.'}
                </p>
            </section>

            <section style={{ ...painel, marginTop: 16 }}>
                <h2 style={{ margin: '0 0 14px', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: 8 }}><Handshake size={20} color="#17428f" /> {editando ? 'Editar patrocinador' : 'Novo patrocinador'}</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 14, alignItems: 'start' }}>
                    <label style={rotulo}>Nome
                        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Padaria do Bairro" style={campo} maxLength={60} />
                    </label>
                    <label style={rotulo}>WhatsApp (com DDD)
                        <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(31) 99999-8888" inputMode="tel" style={campo} />
                    </label>
                    <div style={rotulo}>
                        Logo
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 72, height: 72, borderRadius: 14, border: '1px dashed #cbd5e1', background: '#f8fafc', display: 'grid', placeItems: 'center', overflow: 'hidden', flex: '0 0 72px' }}>
                                {logo ? <img src={logo} alt="Logo escolhida" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <ImagePlus size={24} color="#94a3b8" />}
                            </div>
                            <button type="button" onClick={() => arquivo.current?.click()} style={botao('#334155')}>{logo ? 'Trocar logo' : 'Escolher logo'}</button>
                            <input ref={arquivo} type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => escolherLogo(e.target.files?.[0])} style={{ display: 'none' }} aria-label="Arquivo da logo" />
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
                    <button type="button" onClick={salvar} disabled={salvando} style={botao('#00a63a')}>{salvando ? <Loader2 className="spin" size={17} /> : <Save size={17} />} {editando ? 'Salvar alterações' : 'Adicionar patrocinador'}</button>
                    {editando && <button type="button" onClick={limpar} style={botao('#64748b')}><X size={17} /> Cancelar</button>}
                </div>
            </section>

            <section style={{ marginTop: 16 }}>
                {carregando ? <p style={{ color: '#64748b' }}>Carregando...</p> : itens.length === 0 ? (
                    <div style={{ ...painel, textAlign: 'center', color: '#64748b' }}>
                        <Handshake size={34} color="#94a3b8" />
                        <p style={{ margin: '8px 0 0', fontWeight: 800, color: '#334155' }}>Nenhum patrocinador cadastrado</p>
                        <p style={{ margin: '4px 0 0' }}>Enquanto não houver nenhum, a faixa de patrocinadores não aparece para o público.</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: 12 }}>
                        {itens.map((s, i) => (
                            <article key={s.id} style={{ ...painel, padding: 14, opacity: s.ativo === false ? 0.55 : 1 }}>
                                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                    <img src={s.logo} alt={`Logo ${s.nome}`} style={{ width: 64, height: 64, borderRadius: 12, objectFit: 'cover', border: '1px solid #e2e8f0', flex: '0 0 64px' }} />
                                    <div style={{ minWidth: 0 }}>
                                        <strong style={{ display: 'block', overflowWrap: 'anywhere' }}>{s.nome}</strong>
                                        <span style={{ color: '#64748b', fontSize: '0.88rem' }}>{mascara(s.whatsapp)}</span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '0.88rem', marginRight: 'auto' }}>
                                        <input type="checkbox" checked={s.ativo !== false} onChange={() => alternarAtivo(s)} style={{ width: 18, height: 18, accentColor: '#00a63a' }} /> Ativo
                                    </label>
                                    <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} aria-label={`Subir ${s.nome}`} style={iconeBtn}><ArrowUp size={16} /></button>
                                    <button type="button" onClick={() => mover(i, 1)} disabled={i === itens.length - 1} aria-label={`Descer ${s.nome}`} style={iconeBtn}><ArrowDown size={16} /></button>
                                    <button type="button" onClick={() => editar(s)} aria-label={`Editar ${s.nome}`} style={iconeBtn}><Pencil size={16} /></button>
                                    <button type="button" onClick={() => remover(s)} aria-label={`Remover ${s.nome}`} style={{ ...iconeBtn, color: '#be123c' }}><Trash2 size={16} /></button>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}

const painel: React.CSSProperties = { background: '#fff', border: '1px solid rgba(16,33,63,0.14)', borderRadius: 12, padding: 18, boxShadow: '0 8px 24px rgba(15,23,42,0.06)', minWidth: 0 };
const rotulo: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, color: '#334155', fontWeight: 800, fontSize: '0.9rem' };
const campo: React.CSSProperties = { width: '100%', boxSizing: 'border-box', minHeight: 48, border: '1px solid rgba(16,33,63,0.22)', borderRadius: 8, padding: '10px 12px', color: '#10213f', background: '#fff', font: 'inherit', fontWeight: 600 };
const botao = (bg: string): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44, border: 'none', borderRadius: 9, background: bg, color: '#fff', padding: '0 16px', fontWeight: 900, cursor: 'pointer' });
const iconeBtn: React.CSSProperties = { display: 'inline-grid', placeItems: 'center', width: 40, height: 40, borderRadius: 9, border: '1px solid rgba(16,33,63,0.18)', background: '#fff', color: '#334155', cursor: 'pointer' };
