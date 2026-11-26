// Cria o grupo de WhatsApp da convocação pelo servidor da escola (Worker /sys/wa/grupo).
export type GrupoCriado = { jid: string; foto: 'ok' | 'falhou' | 'sem-logo'; convite: string; participantes: number };

/** 10 ou 11 dígitos (com DDD) ganham o 55; devolve só o que parece telefone. */
export const normalizaTelefone = (t: unknown) => {
    let d = String(t || '').replace(/\D/g, '');
    if (d.length === 10 || d.length === 11) d = '55' + d;
    return /^\d{12,15}$/.test(d) ? d : '';
};

export async function criarGrupoWhatsApp(p: { nome: string; descricao: string; numeros: string[]; logo?: string }): Promise<GrupoCriado> {
    let tk = ''; try { tk = localStorage.getItem('pg_sys_token') || sessionStorage.getItem('pg_sys_token') || ''; } catch { /* sem armazenamento */ }
    const r = await fetch('/sys/wa/grupo', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${tk}` }, body: JSON.stringify(p) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.erro || `Erro ${r.status}`);
    return j as GrupoCriado;
}
