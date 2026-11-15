/* eslint-disable @typescript-eslint/no-explicit-any */
// Substituto do Firebase (Firestore + Auth) para a versão "sem-firebase": mesma API usada pelo sistema,
// mas os dados ficam no Worker (rotas /sys/*, SQLite no Cloudflare). Só entra no build com `--mode sem-firebase`.
// Limites: consultas rodam no navegador sobre a coleção inteira; onSnapshot é por consulta periódica (4 s).

const TOKEN_KEY = 'pg_sys_token';
const base = '/sys';
let guardarNaSessao = false; // "Manter conectado" desmarcado: o login vale só até fechar a aba
const token = () => { try { return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } };
const guardarToken = (t: string) => { try { localStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(TOKEN_KEY); (guardarNaSessao ? sessionStorage : localStorage).setItem(TOKEN_KEY, t); } catch { /* sem armazenamento */ } };
const limparToken = () => { try { localStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(TOKEN_KEY); } catch { /* sem armazenamento */ } };

async function chamar(method: string, path: string, body?: unknown) {
    const t = token();
    const r = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(t ? { authorization: `Bearer ${t}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e: any = new Error(j.erro || `Erro ${r.status}`); e.code = r.status === 401 ? 'auth/invalid-credential' : r.status === 403 ? 'permission-denied' : 'unavailable'; e.status = r.status; throw e; }
    return j;
}

/* ---------------- app / analytics / storage (sem função aqui) ---------------- */
export const initializeApp = (config: unknown) => ({ options: config });
export const getAnalytics = () => null;
export const isSupported = async () => false;
export const getStorage = () => ({});

/* ---------------- valores ---------------- */
export class Timestamp {
    seconds: number; nanoseconds: number;
    constructor(seconds: number, nanoseconds: number) { this.seconds = seconds; this.nanoseconds = nanoseconds; }
    static now() { return Timestamp.fromMillis(Date.now()); }
    static fromDate(d: Date) { return Timestamp.fromMillis(d.getTime()); }
    static fromMillis(ms: number) { return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6); }
    toDate() { return new Date(this.toMillis()); }
    toMillis() { return this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6); }
    isEqual(o: Timestamp) { return o && o.seconds === this.seconds && o.nanoseconds === this.nanoseconds; }
    valueOf() { return String(this.toMillis()); }
}
export const serverTimestamp = () => ({ __op: 'ts' });
export const increment = (n: number) => ({ __op: 'inc', n });
export const deleteField = () => ({ __op: 'del' });

const codificar = (v: any): any => {
    if (v instanceof Timestamp) return { __t: [v.seconds, v.nanoseconds] };
    if (v instanceof Date) return { __t: [Math.floor(v.getTime() / 1000), (v.getTime() % 1000) * 1e6] };
    if (Array.isArray(v)) return v.map(codificar);
    if (v && typeof v === 'object') { const o: any = {}; for (const [k, x] of Object.entries(v)) if (x !== undefined) o[k] = codificar(x); return o; }
    return v;
};
const decodificar = (v: any): any => {
    if (Array.isArray(v)) return v.map(decodificar);
    if (v && typeof v === 'object') {
        if (Array.isArray(v.__t)) return new Timestamp(v.__t[0], v.__t[1]);
        const o: any = {}; for (const [k, x] of Object.entries(v)) o[k] = decodificar(x); return o;
    }
    return v;
};

/* ---------------- referências ---------------- */
const caminho = (segs: string[]) => segs.join('/').split('/').filter(Boolean);
const colDe = (partes: string[]) => partes.join('__').replace(/[^A-Za-z0-9_-]/g, '_');
const idAleatorio = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 20);

export const getFirestore = () => ({ __db: true });
export const connectFirestoreEmulator = () => undefined;

export function collection(_db: unknown, ...segs: string[]) { const p = caminho(segs); return { type: 'collection', path: p.join('/'), col: colDe(p), id: p[p.length - 1] }; }
export function doc(parent: any, ...segs: string[]) {
    if (parent && parent.type === 'collection') { const id = segs[0] || idAleatorio(); return { type: 'document', col: parent.col, id, path: `${parent.path}/${id}`, parent }; }
    const p = caminho(segs); const id = p.pop() as string; return { type: 'document', col: colDe(p), id, path: [...p, id].join('/'), parent: { type: 'collection', col: colDe(p), path: p.join('/') } };
}

class DocSnap {
    id: string; ref: any; private _d: any | null;
    constructor(id: string, d: any | null, ref: any) { this.id = id; this._d = d; this.ref = ref; }
    exists() { return this._d !== null; }
    data() { return this._d === null ? undefined : this._d; }
    get(campo: string) { return campo.split('.').reduce((a: any, k) => (a == null ? undefined : a[k]), this._d); }
}
class QuerySnap {
    docs: DocSnap[]; size: number; empty: boolean;
    constructor(docs: DocSnap[]) { this.docs = docs; this.size = docs.length; this.empty = docs.length === 0; }
    forEach(f: (d: DocSnap) => void) { this.docs.forEach(f); }
    docChanges() { return this.docs.map((d) => ({ type: 'added', doc: d })); }
}

/* ---------------- consultas (rodam no navegador) ---------------- */
export const where = (campo: string, op: string, valor: any) => ({ k: 'where', campo, op, valor });
export const orderBy = (campo: string, dir: 'asc' | 'desc' = 'asc') => ({ k: 'order', campo, dir });
export const limit = (n: number) => ({ k: 'limit', n });
export function query(ref: any, ...restricoes: any[]) { return { type: 'query', col: ref.col, path: ref.path, restricoes: [...(ref.restricoes || []), ...restricoes] }; }

const campoDe = (d: any, campo: string) => campo.split('.').reduce((a: any, k) => (a == null ? undefined : a[k]), d);
const num = (v: any) => (v instanceof Timestamp ? v.toMillis() : v);
const igual = (a: any, b: any) => (a instanceof Timestamp || b instanceof Timestamp ? num(a) === num(b) : JSON.stringify(a) === JSON.stringify(b));
const cmp = (a: any, b: any) => { const x = num(a), y = num(b); return x === y ? 0 : x === undefined ? -1 : y === undefined ? 1 : x < y ? -1 : 1; };
function passa(d: any, r: any) {
    const v = campoDe(d, r.campo);
    switch (r.op) {
        case '==': return igual(v, r.valor);
        case '!=': return v !== undefined && !igual(v, r.valor);
        case '<': return v !== undefined && cmp(v, r.valor) < 0;
        case '<=': return v !== undefined && cmp(v, r.valor) <= 0;
        case '>': return v !== undefined && cmp(v, r.valor) > 0;
        case '>=': return v !== undefined && cmp(v, r.valor) >= 0;
        case 'in': return Array.isArray(r.valor) && r.valor.some((x: any) => igual(v, x));
        case 'not-in': return v !== undefined && Array.isArray(r.valor) && !r.valor.some((x: any) => igual(v, x));
        case 'array-contains': return Array.isArray(v) && v.some((x) => igual(x, r.valor));
        case 'array-contains-any': return Array.isArray(v) && Array.isArray(r.valor) && v.some((x) => r.valor.some((y: any) => igual(x, y)));
        default: return false;
    }
}

async function lerColecao(ref: any) {
    const j = await chamar('GET', `/db/${encodeURIComponent(ref.col)}`);
    let docs: DocSnap[] = (j.docs || []).map((x: any) => new DocSnap(x.id, decodificar(x.data), doc({ type: 'collection', col: ref.col, path: ref.path }, x.id)));
    const rs: any[] = ref.restricoes || [];
    for (const r of rs.filter((x) => x.k === 'where')) docs = docs.filter((d) => passa(d.data(), r));
    const ords = rs.filter((x) => x.k === 'order');
    if (ords.length) docs.sort((a, b) => { for (const o of ords) { const c = cmp(campoDe(a.data(), o.campo), campoDe(b.data(), o.campo)); if (c) return o.dir === 'desc' ? -c : c; } return 0; });
    const lim = rs.find((x) => x.k === 'limit'); if (lim) docs = docs.slice(0, lim.n);
    return new QuerySnap(docs);
}

export async function getDocs(q: any) { return lerColecao(q); }
export async function getDoc(ref: any) {
    const j = await chamar('GET', `/db/${encodeURIComponent(ref.col)}/${encodeURIComponent(ref.id)}`);
    return new DocSnap(ref.id, j.existe ? decodificar(j.data) : null, ref);
}

/* ---------------- gravação ---------------- */
const dadosDe = (d: any) => codificar(d);
export async function setDoc(ref: any, data: any, opts?: { merge?: boolean }) { await chamar('PUT', `/db/${encodeURIComponent(ref.col)}/${encodeURIComponent(ref.id)}`, { data: dadosDe(data), merge: Boolean(opts?.merge) }); }
function paraPatch(a: any[]) { if (typeof a[0] === 'string') { const o: any = {}; for (let i = 0; i < a.length; i += 2) o[a[i]] = a[i + 1]; return o; } return a[0]; }
export async function updateDoc(ref: any, ...args: any[]) { await chamar('PUT', `/db/${encodeURIComponent(ref.col)}/${encodeURIComponent(ref.id)}`, { data: dadosDe(paraPatch(args)), update: true }); }
export async function addDoc(colRef: any, data: any) { const j = await chamar('POST', `/db/${encodeURIComponent(colRef.col)}`, { data: dadosDe(data) }); return doc(colRef, j.id); }
export async function deleteDoc(ref: any) { await chamar('DELETE', `/db/${encodeURIComponent(ref.col)}/${encodeURIComponent(ref.id)}`); }

export function writeBatch() {
    const ops: any[] = [];
    const b = {
        set(ref: any, data: any, opts?: { merge?: boolean }) { ops.push({ op: 'set', col: ref.col, id: ref.id, data: dadosDe(data), merge: Boolean(opts?.merge) }); return b; },
        update(ref: any, ...args: any[]) { ops.push({ op: 'update', col: ref.col, id: ref.id, data: dadosDe(paraPatch(args)) }); return b; },
        delete(ref: any) { ops.push({ op: 'delete', col: ref.col, id: ref.id }); return b; },
        async commit() { for (let i = 0; i < ops.length; i += 200) await chamar('POST', '/batch', { ops: ops.slice(i, i + 200) }); }
    };
    return b;
}

export function onSnapshot(alvo: any, next: (s: any) => void, erro?: (e: unknown) => void) {
    let vivo = true, ultimo = '';
    const ciclo = async () => {
        if (!vivo) return;
        try {
            const s: any = alvo.type === 'document' ? await getDoc(alvo) : await getDocs(alvo);
            const assinatura = JSON.stringify(alvo.type === 'document' ? s.data() ?? null : s.docs.map((d: DocSnap) => [d.id, d.data()]));
            if (assinatura !== ultimo) { ultimo = assinatura; next(s); }
        } catch (e) { if (erro) erro(e); }
        if (vivo) setTimeout(ciclo, 4000);
    };
    ciclo();
    return () => { vivo = false; };
}

/* ---------------- auth ---------------- */
type Ouvinte = (u: any) => void;
const ouvintes = new Set<Ouvinte>();
const auth: any = { currentUser: null, async signOut() { limparToken(); auth.currentUser = null; ouvintes.forEach((f) => f(null)); } };
const usuario = (j: any) => ({ uid: j.uid, email: j.email, role: j.role, displayName: null, emailVerified: true, getIdToken: async () => token() });
let restaurado = false;
const restaurar = async () => {
    if (restaurado) return; restaurado = true;
    if (token()) { try { auth.currentUser = usuario(await chamar('GET', '/auth/me')); } catch { limparToken(); } }
};
auth.onAuthStateChanged = (cb: Ouvinte) => onAuthStateChanged(auth, cb); // as telas do aluno e do professor chamam auth.onAuthStateChanged(cb) no objeto
export const getAuth = () => auth;
export const connectAuthEmulator = () => undefined;
export function onAuthStateChanged(_a: unknown, cb: Ouvinte) { ouvintes.add(cb); restaurar().then(() => cb(auth.currentUser)); return () => { ouvintes.delete(cb); }; }
export async function signInWithEmailAndPassword(_a: unknown, email: string, password: string) {
    const j = await chamar('POST', '/auth/login', { email, password });
    guardarToken(j.token);
    auth.currentUser = usuario(j); restaurado = true; ouvintes.forEach((f) => f(auth.currentUser));
    return { user: auth.currentUser };
}
export async function createUserWithEmailAndPassword(_a: unknown, email: string, password: string) {
    try { const j = await chamar('POST', '/auth/create', { email, password }); return { user: usuario(j) }; }
    catch (e: any) { if (e.status === 409) e.code = 'auth/email-already-in-use'; else if (e.status === 401 || e.status === 403) e.code = 'auth/operation-not-allowed'; throw e; }
}
export async function updatePassword(_u: unknown, password: string) { await chamar('POST', '/auth/password', { password }); }
export async function sendPasswordResetEmail() { const e: any = new Error('Recuperação de senha por e-mail ainda não está disponível. Peça ao administrador para redefinir.'); e.code = 'auth/operation-not-allowed'; throw e; }

export const browserLocalPersistence = { type: 'local' };
export const indexedDBLocalPersistence = { type: 'local' };
export const browserSessionPersistence = { type: 'session' };
export async function setPersistence(_a: unknown, p: { type: string }) { guardarNaSessao = p.type === 'session'; }
export const signOut = (a: any) => a.signOut();
