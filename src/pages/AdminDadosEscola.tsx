/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import { Building2, ImagePlus, Loader2, PenLine, Save, Search, Trash2 } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useDialog } from '../context/CustomDialogContext';
import SignatureCanvas from '../components/SignatureCanvas';

// Dados da escola usados no contrato, na ficha, nos termos e nos recibos (CNPJ, endereço, contato, foro) e a assinatura da associação.
// Ficam em system_settings/school_profile. O Worker injeta estes dados na página (window.__MARCA__.perfil) e o sistema troca os campos [..DA ESCOLA].
const PERFIL = ['system_settings', 'school_profile'] as const;
const VAZIO = { razaoSocial: '', cnpj: '', rua: '', numero: '', bairro: '', cidade: '', uf: '', cep: '', email: '', telefone: '', foroCidade: '', foroUf: '', assinatura: '' };
type Perfil = typeof VAZIO;

const so = (s: string) => s.replace(/\D/g, '');
const maskCnpj = (v: string) => { const d = so(v).slice(0, 14); return d.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2'); };
const maskCep = (v: string) => so(v).slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2');
const maskTel = (v: string) => { const d = so(v).slice(0, 11); return d.length > 10 ? d.replace(/^(\d{2})(\d{5})(\d)/, '($1) $2-$3') : d.replace(/^(\d{2})(\d{4})(\d)/, '($1) $2-$3'); };

const cnpjValido = (v: string) => {
    const d = so(v); if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
    const dv = (n: number) => { let s = 0, pos = n - 7; for (let i = 0; i < n; i++) { s += +d[i] * pos--; if (pos < 2) pos = 9; } const r = s % 11; return r < 2 ? 0 : 11 - r; };
    return dv(12) === +d[12] && dv(13) === +d[13];
};
const MINUSCULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'a', 'o']), SIGLAS = new Set(['ltda', 'epp', 'me', 'mei', 'eireli', 'ss', 'sa', 's/a', 'cia', 'ii', 'iii', 'iv']);
const bonito = (s: string) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim().split(' ').map((w, i) => SIGLAS.has(w) ? w.toUpperCase() : (i && MINUSCULAS.has(w)) ? w : w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

/** Consulta pública do CNPJ (BrasilAPI, gratuita) e devolve os campos já formatados. */
async function consultarCnpj(cnpj: string): Promise<Partial<Perfil>> {
    const r = await fetch('https://brasilapi.com.br/api/cnpj/v1/' + so(cnpj));
    if (r.status === 404) throw new Error('CNPJ não encontrado na Receita.');
    if (!r.ok) throw new Error('A consulta da Receita está fora do ar agora. Preencha manualmente ou tente de novo.');
    const j = await r.json(), tel = so(String(j.ddd_telefone_1 || '')), cidade = bonito(j.municipio), uf = String(j.uf || '').toUpperCase();
    return {
        razaoSocial: bonito(j.razao_social), rua: bonito([j.descricao_tipo_de_logradouro, j.logradouro].filter(Boolean).join(' ')), numero: String(j.numero || '').trim(), bairro: bonito(j.bairro),
        cidade, uf, cep: maskCep(String(j.cep || '')), email: String(j.email || '').toLowerCase(), telefone: tel.length >= 10 ? maskTel(tel) : '',
        foroCidade: cidade, foroUf: uf
    };
}

/** Reduz a foto da assinatura para no máximo 600px de largura e guarda como imagem embutida. */
async function prepararFoto(arquivo: File): Promise<string> {
    if (!/^image\/(png|jpe?g|webp)$/.test(arquivo.type)) throw new Error('Envie uma imagem PNG, JPG ou WebP.');
    const url = URL.createObjectURL(arquivo);
    try {
        const img = await new Promise<HTMLImageElement>((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => erro(new Error('Não consegui abrir essa imagem.')); i.src = url; });
        const k = Math.min(1, 600 / img.width), c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        const g = c.getContext('2d')!; g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
        return c.toDataURL('image/jpeg', 0.85);
    } finally { URL.revokeObjectURL(url); }
}

export default function AdminDadosEscola() {
    const { showAlert } = useDialog();
    const [p, setP] = useState<Perfil>(VAZIO);
    const [carregando, setCarregando] = useState(true);
    const [salvando, setSalvando] = useState(false);
    const [desenhando, setDesenhando] = useState(false);
    const arquivo = useRef<HTMLInputElement>(null);
    const [busca, setBusca] = useState<{ estado: 'parado' | 'buscando' | 'ok' | 'erro'; msg: string }>({ estado: 'parado', msg: '' });
    const ultimo = useRef('');

    const buscar = async (cnpj: string) => {
        if (!cnpjValido(cnpj)) { setBusca({ estado: 'erro', msg: 'Esse CNPJ não é válido. Confira os números.' }); return; }
        ultimo.current = so(cnpj); setBusca({ estado: 'buscando', msg: 'Consultando a Receita…' });
        try {
            const d = await consultarCnpj(cnpj), vazios = Object.entries(d).filter(([, v]) => !v).length;
            setP((atual) => ({ ...atual, ...Object.fromEntries(Object.entries(d).filter(([, v]) => v)) }));
            setBusca({ estado: 'ok', msg: vazios ? 'Dados preenchidos. Complete o que faltou e confira abaixo.' : 'Tudo preenchido. Confira e salve.' });
        } catch (e) { ultimo.current = ''; setBusca({ estado: 'erro', msg: e instanceof Error ? e.message : 'Não consegui consultar.' }); }
    };

    useEffect(() => {
        getDoc(doc(db, ...PERFIL)).then((s) => { if (s.exists()) setP({ ...VAZIO, ...(s.data() as any) }); }).catch(() => {}).finally(() => setCarregando(false));
    }, []);

    const campo = (k: keyof Perfil, rotulo: string, extra?: { mask?: (v: string) => string; ph?: string; modo?: string; max?: number }) => (
        <label style={rotuloCss}>{rotulo}
            <input value={p[k]} onChange={(e) => setP({ ...p, [k]: extra?.mask ? extra.mask(e.target.value) : e.target.value })} placeholder={extra?.ph} inputMode={extra?.modo as any} maxLength={extra?.max} style={campoCss} autoComplete="off" />
        </label>
    );

    const salvar = async () => {
        if (p.cnpj && so(p.cnpj).length !== 14) { showAlert('CNPJ deve ter 14 números.', 'error'); return; }
        if (p.uf && !/^[A-Za-z]{2}$/.test(p.uf)) { showAlert('UF deve ter 2 letras.', 'error'); return; }
        setSalvando(true);
        try {
            await setDoc(doc(db, ...PERFIL), { ...p, uf: p.uf.toUpperCase(), foroUf: p.foroUf.toUpperCase() });
            showAlert('Dados salvos. A página vai recarregar para aplicar nos documentos.', 'success');
            setTimeout(() => location.reload(), 1200);
        } catch (e) { showAlert(e instanceof Error ? e.message : 'Não consegui salvar.', 'error'); setSalvando(false); }
    };

    if (carregando) return <div style={{ padding: 24 }}><Loader2 className="spin" /> Carregando…</div>;

    return (
        <div className="admin-page" style={{ padding: 24, color: '#172033' }}>
            <h1 style={{ margin: '0 0 6px', fontSize: '2rem', color: '#17428f', display: 'flex', alignItems: 'center', gap: 10 }}><Building2 /> Dados da escola</h1>
            <p style={{ margin: '0 0 18px', color: '#64748b', maxWidth: 760 }}>Estes dados entram automaticamente no contrato, na ficha de inscrição, nos termos e nos recibos. Enquanto estiverem em branco, os documentos mostram campos como [CNPJ DA ESCOLA].</p>

            <section style={painel}>
                <h2 style={titulo}>Comece pelo CNPJ</h2>
                <p style={{ margin: '0 0 12px', color: '#64748b' }}>Digite só o CNPJ: buscamos na Receita a razão social, o endereço, o telefone e o e-mail e preenchemos tudo abaixo.</p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <label style={{ ...rotuloCss, flex: '1 1 260px', maxWidth: 360 }}>CNPJ
                        <input value={p.cnpj} inputMode="numeric" placeholder="00.000.000/0000-00" autoComplete="off" style={{ ...campoCss, fontSize: '1.1rem' }}
                            onChange={(e) => { const v = maskCnpj(e.target.value); setP({ ...p, cnpj: v }); if (so(v).length === 14 && so(v) !== ultimo.current) buscar(v); else if (so(v).length < 14) setBusca({ estado: 'parado', msg: '' }); }} />
                    </label>
                    <button type="button" onClick={() => buscar(p.cnpj)} disabled={busca.estado === 'buscando' || so(p.cnpj).length !== 14} style={{ ...botao('#17428f'), opacity: so(p.cnpj).length === 14 ? 1 : 0.5 }}>{busca.estado === 'buscando' ? <Loader2 className="spin" size={17} /> : <Search size={17} />} Buscar dados</button>
                </div>
                {busca.msg && <p role="status" style={{ margin: '12px 0 0', fontWeight: 700, color: busca.estado === 'erro' ? '#b42318' : busca.estado === 'ok' ? '#15803d' : '#64748b' }}>{busca.msg}</p>}
            </section>
            <section style={{ ...painel, marginTop: 16 }}>
                <h2 style={titulo}>Identificação</h2>
                <div style={grade}>{campo('razaoSocial', 'Razão social', { max: 120 })}</div>
            </section>
            <section style={{ ...painel, marginTop: 16 }}>
                <h2 style={titulo}>Endereço</h2>
                <div style={grade}>{campo('rua', 'Rua / avenida', { max: 120 })}{campo('numero', 'Número', { max: 10 })}{campo('bairro', 'Bairro', { max: 80 })}{campo('cidade', 'Cidade', { max: 80 })}{campo('uf', 'UF', { max: 2, ph: 'MG' })}{campo('cep', 'CEP', { mask: maskCep, ph: '00000-000', modo: 'numeric' })}</div>
            </section>
            <section style={{ ...painel, marginTop: 16 }}>
                <h2 style={titulo}>Contato</h2>
                <div style={grade}>{campo('email', 'E-mail da escola', { modo: 'email', max: 120 })}{campo('telefone', 'Telefone / WhatsApp', { mask: maskTel, ph: '(00) 00000-0000', modo: 'tel' })}</div>
            </section>
            <section style={{ ...painel, marginTop: 16 }}>
                <h2 style={titulo}>Foro do contrato</h2>
                <p style={{ margin: '0 0 12px', color: '#64748b' }}>Cidade/UF da cláusula do foro e da linha de data. Em branco, usa a cidade do endereço.</p>
                <div style={grade}>{campo('foroCidade', 'Cidade do foro', { max: 80 })}{campo('foroUf', 'UF do foro', { max: 2, ph: 'MG' })}</div>
            </section>

            <section style={{ ...painel, marginTop: 16 }}>
                <h2 style={titulo}>Assinatura da associação</h2>
                <p style={{ margin: '0 0 12px', color: '#64748b' }}>Aparece no contrato e nos recibos. Desenhe na tela ou envie uma foto da assinatura/carimbo. Sem assinatura, o contrato mostra só a linha.</p>
                {p.assinatura && <div style={{ marginBottom: 12 }}><img src={p.assinatura} alt="Assinatura da associação" style={{ maxHeight: 90, maxWidth: '100%', border: '1px solid rgba(16,33,63,0.14)', borderRadius: 8, background: '#fff', padding: 6 }} /></div>}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => setDesenhando(!desenhando)} style={botao('#334155')}><PenLine size={17} /> {desenhando ? 'Fechar o quadro' : 'Desenhar na tela'}</button>
                    <button type="button" onClick={() => arquivo.current?.click()} style={botao('#334155')}><ImagePlus size={17} /> Enviar foto</button>
                    {p.assinatura && <button type="button" onClick={() => setP({ ...p, assinatura: '' })} style={botao('#9a3412')}><Trash2 size={17} /> Remover</button>}
                    <input ref={arquivo} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { setP({ ...p, assinatura: await prepararFoto(f) }); } catch (er) { showAlert(er instanceof Error ? er.message : 'Imagem inválida.', 'error'); } e.target.value = ''; }} />
                </div>
                {desenhando && <div style={{ marginTop: 14, maxWidth: 520 }}><SignatureCanvas onConfirm={(url) => { setP({ ...p, assinatura: url }); setDesenhando(false); }} /></div>}
            </section>

            <button type="button" onClick={salvar} disabled={salvando} style={{ ...botao('#00a63a'), marginTop: 20 }}>{salvando ? <Loader2 className="spin" size={17} /> : <Save size={17} />} Salvar dados da escola</button>
        </div>
    );
}

const painel: React.CSSProperties = { background: '#fff', border: '1px solid rgba(16,33,63,0.14)', borderRadius: 12, padding: 18, boxShadow: '0 8px 24px rgba(15,23,42,0.06)', minWidth: 0 };
const titulo: React.CSSProperties = { margin: '0 0 12px', fontSize: '1.15rem' };
const grade: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 14 };
const rotuloCss: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, color: '#334155', fontWeight: 800, fontSize: '0.9rem' };
const campoCss: React.CSSProperties = { width: '100%', boxSizing: 'border-box', minHeight: 48, border: '1px solid rgba(16,33,63,0.22)', borderRadius: 8, padding: '10px 12px', color: '#10213f', background: '#fff', font: 'inherit', fontWeight: 600 };
const botao = (bg: string): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44, border: 'none', borderRadius: 9, background: bg, color: '#fff', padding: '0 16px', fontWeight: 900, cursor: 'pointer' });
