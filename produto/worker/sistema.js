// Banco e login do SISTEMA DA ESCOLA, sem Firebase: cada escola (subdomínio) é um "tenant" no mesmo SQLite do Worker.
// O front (src/shim) fala com estas rotas /sys/* no lugar do Firestore e do Firebase Auth.
// Limites assumidos: a coleção inteira é lida de uma vez (escolas pequenas/médias) e as consultas rodam no navegador.

const J = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const erro = (msg, status = 400) => J({ erro: msg }, status);
const enc = new TextEncoder();
const b64u = (u8) => btoa(String.fromCharCode(...u8)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), (c) => c.charCodeAt(0));
const idNovo = () => b64u(crypto.getRandomValues(new Uint8Array(15)));

async function pbkdf2(senha, salt) {
  const k = await crypto.subtle.importKey('raw', enc.encode(senha), 'PBKDF2', false, ['deriveBits']);
  return b64u(new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unb64u(salt), iterations: 100000 }, k, 256)));
}
/** A senha guardada pelo dono ainda é a do usuário? (o usuário pode ter trocado a dele) */
export async function confereSenha(senha, u) { return (await pbkdf2(String(senha), u.salt)) === u.hash; }
export async function hashSenha(senha) { const salt = b64u(crypto.getRandomValues(new Uint8Array(16))); return { salt, hash: await pbkdf2(senha, salt) }; }

const hmacKey = (env) => crypto.subtle.importKey('raw', enc.encode(env.SESSION_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
import { controleDe, controlePublico, LIMITE_COLECAO, PERMISSAO_COLECAO } from './controle.js';
async function emitirToken(env, tenant, u, horas) {
  const h = horas || (await controleDe(env, tenant)).lim_sessao_horas || 12;
  const corpo = b64u(enc.encode(JSON.stringify({ t: tenant, e: u.email, u: u.uid, r: u.role, i: Date.now(), x: Date.now() + h * 3600e3 })));
  return corpo + '.' + b64u(new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(env), enc.encode(corpo))));
}
async function lerToken(req, env, tenant) {
  const tk = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const [corpo, ass] = tk.split('.');
  if (!corpo || !ass) return null;
  try {
    if (!(await crypto.subtle.verify('HMAC', await hmacKey(env), unb64u(ass), enc.encode(corpo)))) return null;
    const d = JSON.parse(new TextDecoder().decode(unb64u(corpo)));
    if (!(d.t === tenant && d.x > Date.now())) return null;
    // "Sair de todos os dispositivos": token emitido (x - 12h) antes da revogação deixa de valer
    const fl = await env.DB.prepare("SELECT data FROM sys_docs WHERE tenant=? AND col='sys_flags' AND id=?").bind(tenant, d.e).first();
    if (fl && (JSON.parse(fl.data).bloqueado || JSON.parse(fl.data).revogado > (d.i || d.x - 12 * 3600e3))) return null;
    return { email: d.e, uid: d.u, role: d.r };
  } catch { return null; }
}

// ---- valores especiais do Firestore (increment, serverTimestamp, Timestamp) ----
const resolver = (v, antigo) => {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    if (v.__op === 'ts') return { __t: [Math.floor(Date.now() / 1000), 0] };
    if (v.__op === 'inc') return (typeof antigo === 'number' ? antigo : 0) + Number(v.n || 0);
    if (v.__op === 'del') return undefined;
    const o = {}; for (const [k, x] of Object.entries(v)) { const r = resolver(x, antigo && typeof antigo === 'object' ? antigo[k] : undefined); if (r !== undefined) o[k] = r; }
    return o;
  }
  return Array.isArray(v) ? v.map((x) => resolver(x)) : v;
};
function atualizar(antigo, patch) { // updateDoc: chaves "a.b.c" caminham dentro do objeto
  const r = JSON.parse(JSON.stringify(antigo || {}));
  for (const [k, v] of Object.entries(patch)) {
    const partes = k.split('.'); let alvo = r;
    for (let i = 0; i < partes.length - 1; i++) { if (typeof alvo[partes[i]] !== 'object' || alvo[partes[i]] === null) alvo[partes[i]] = {}; alvo = alvo[partes[i]]; }
    const ultimo = partes[partes.length - 1], novo = resolver(v, alvo[ultimo]);
    if (novo === undefined) delete alvo[ultimo]; else alvo[ultimo] = novo;
  }
  return r;
}
const mescla = (a, b) => { const r = { ...a }; for (const [k, v] of Object.entries(b)) r[k] = v && typeof v === 'object' && !Array.isArray(v) && !('__t' in v) && a && typeof a[k] === 'object' && a[k] && !Array.isArray(a[k]) ? mescla(a[k], v) : v; return r; };

const colOk = (c) => /^[A-Za-z0-9_-]{1,80}$/.test(c);
const idOk = (c) => /^[^/\\]{1,200}$/.test(c);

async function gravar(env, tenant, op) {
  const { col, id } = op;
  if (!colOk(col) || !idOk(id)) throw new Error('Caminho inválido.');
  const atual = await env.DB.prepare('SELECT data FROM sys_docs WHERE tenant=? AND col=? AND id=?').bind(tenant, col, id).first();
  const antigo = atual ? JSON.parse(atual.data) : null;
  if (op.op === 'delete') { await env.DB.prepare('DELETE FROM sys_docs WHERE tenant=? AND col=? AND id=?').bind(tenant, col, id).run(); return; }
  let novo;
  if (op.op === 'update') { if (!antigo) throw new Error('Documento não existe.'); novo = atualizar(antigo, op.data || {}); }
  else if (op.merge && antigo) novo = mescla(antigo, atualizar({}, op.data || {}));
  else novo = atualizar({}, op.data || {});
  const json = JSON.stringify(novo);
  const cfg = await controleDe(env, tenant);
  if (json.length > Math.min(900000, (cfg.lim_doc_kb || 900) * 1024)) throw new Error('Documento grande demais.');
  if (!antigo) { // limites do plano na criação de registros novos
    const nome = col === 'rumo_ao_esporte_2026_registrations' ? 'lim_matriculas' : LIMITE_COLECAO[col];
    if (nome && cfg[nome]) { const n = await env.DB.prepare('SELECT COUNT(*) n FROM sys_docs WHERE tenant=? AND col=?').bind(tenant, col).first(); if (n.n >= cfg[nome]) throw new Error('Limite do plano atingido (' + cfg[nome] + '). Fale com a Central.'); }
    if (cfg.lim_armazenamento_mb) { const b = await env.DB.prepare('SELECT COALESCE(SUM(LENGTH(data)),0) b FROM sys_docs WHERE tenant=?').bind(tenant).first(); if (b.b + json.length > cfg.lim_armazenamento_mb * 1048576) throw new Error('Armazenamento do plano esgotado. Fale com a Central.'); }
    if (col === 'rumo_ao_esporte_2026_chamadas' && cfg.lim_chamadas_dia && novo.turmaId && novo.data) { const n = await env.DB.prepare("SELECT COUNT(*) n FROM sys_docs WHERE tenant=? AND col=? AND json_extract(data,'$.turmaId')=? AND json_extract(data,'$.data')=?").bind(tenant, col, novo.turmaId, novo.data).first(); if (n.n >= cfg.lim_chamadas_dia) throw new Error('Limite de chamadas por dia desta turma atingido.'); }
  }
  await env.DB.prepare('INSERT INTO sys_docs(tenant,col,id,data) VALUES(?,?,?,?) ON CONFLICT(tenant,col,id) DO UPDATE SET data=excluded.data').bind(tenant, col, id, json).run();
}

async function publico(env, tenant, col, id) {
  if (id) { const x = await env.DB.prepare('SELECT data FROM sys_docs WHERE tenant=? AND col=? AND id=?').bind(tenant, col, id).first(); return J(x ? { existe: true, data: JSON.parse(x.data) } : { existe: false }); }
  const r = await env.DB.prepare('SELECT id,data FROM sys_docs WHERE tenant=? AND col=?').bind(tenant, col).all();
  return J({ docs: (r.results || []).map((x) => ({ id: x.id, data: JSON.parse(x.data) })) });
}

/** Inscrição enviada pelo formulário público: valida o formato, limita por endereço e grava como pendente de aprovação. */
async function novaInscricao(req, env, tenant, corpo) {
  const cfgI = await env.DB.prepare("SELECT data FROM sys_docs WHERE tenant=? AND col='system_settings' AND id='inscricoes'").bind(tenant).first();
  const ci = cfgI ? JSON.parse(cfgI.data) : {};
  const cfgC = await controleDe(env, tenant);
  if (ci.abertas === false || cfgC.bloq_inscricoes) return erro(String(ci.mensagem || 'As inscrições estão fechadas no momento.').slice(0, 300), 403);
  if (!(await dentroDoLimite(env, tenant, 1))) return erro('Esta escola atingiu o limite de matrículas do plano.', 403);
  const ipc = req.headers.get('cf-connecting-ip') || 'x', chave = 'insc:' + tenant + ':' + ipc, desde = Date.now() - 3600e3;
  const f = await env.DB.prepare('SELECT COUNT(*) n FROM tentativas WHERE chave=? AND quando>?').bind(chave, desde).first();
  if (cfgC.lim_inscricoes_ip && f.n >= cfgC.lim_inscricoes_ip) return erro('Muitas inscrições deste endereço. Tente de novo em uma hora.', 429);
  const d = corpo && corpo.data;
  const nome = d && d.responsavel && String(d.responsavel.nome || '').trim();
  if (!d || !nome || nome.length < 3 || !Array.isArray(d.alunos) || d.alunos.length < 1 || d.alunos.length > Math.max(1, cfgC.lim_alunos_inscricao || 8)) return erro('Dados da inscrição incompletos.');
  const seguro = { ...d, status: 'pendente', contractStatus: 'pendente', origem: 'formulario-publico' };
  for (const k of ['financialPendingAmount', 'financialReceivedAmount', 'financialInvoiceUrl', 'approvedBy', 'role']) delete seguro[k];
  await env.DB.prepare('INSERT INTO tentativas(chave,quando) VALUES(?,?)').bind(chave, Date.now()).run();
  const id = idNovo();
  try { await gravar(env, tenant, { op: 'set', col: 'rumo_ao_esporte_2026_registrations', id, data: seguro }); } catch (e) { return erro(e.message); }
  return J({ id });
}

// ---- WhatsApp: cada escola tem o PRÓPRIO servidor Evolution API (endereço, chave e instância ficam por escola) ----
const chaveWa = async (env) => crypto.subtle.importKey('raw', await crypto.subtle.digest('SHA-256', enc.encode('wa:' + env.SESSION_SECRET)), 'AES-GCM', false, ['encrypt', 'decrypt']);
async function cifrar(env, texto) { const iv = crypto.getRandomValues(new Uint8Array(12)); const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await chaveWa(env), enc.encode(texto))); return b64u(iv) + '.' + b64u(ct); }
async function decifrar(env, t) { const [iv, ct] = String(t || '').split('.'); return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64u(iv) }, await chaveWa(env), unb64u(ct))); }
const urlWaOk = (u) => { try { const x = new URL(u); return x.protocol === 'https:' && !x.username && !/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[)/i.test(x.hostname) && !/^172\.(1[6-9]|2\d|3[01])\./.test(x.hostname); } catch { return false; } };
async function lerWa(env, tenant) { const x = await env.DB.prepare("SELECT data FROM sys_docs WHERE tenant=? AND col='system_settings' AND id='whatsapp_evolution'").bind(tenant).first(); return x ? JSON.parse(x.data) : null; }
async function evo(env, cfg, method, path, body) {
  const r = await fetch(cfg.url.replace(/\/+$/, '') + path, { method, headers: { apikey: await decifrar(env, cfg.apikey_enc), 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000) });
  const t = await r.text(); let j; try { j = t ? JSON.parse(t) : {}; } catch { j = { raw: t.slice(0, 200) }; }
  if (!r.ok) throw new Error('Servidor de WhatsApp respondeu ' + r.status + (j.message ? ': ' + (Array.isArray(j.message) ? j.message.join(', ') : j.message) : ''));
  return j;
}
async function rotaWa(req, env, tenant, partes, corpo) {
  const m = req.method, acao = partes[1], cfg = await lerWa(env, tenant);
  if (acao === 'config' && m === 'GET') return J({ url: cfg ? cfg.url : '', instance: cfg ? cfg.instance : tenant.split('.')[0].slice(0, 40), apikeySet: Boolean(cfg && cfg.apikey_enc), configurado: Boolean(cfg && cfg.url && cfg.apikey_enc) });
  if (acao === 'config' && m === 'PUT') {
    const url = String(corpo.url || '').trim(), instance = String(corpo.instance || '').trim() || tenant.split('.')[0];
    if (!urlWaOk(url)) return erro('Informe o endereço https do servidor Evolution API desta escola (não pode ser endereço local).');
    if (!/^[A-Za-z0-9_-]{2,60}$/.test(instance)) return erro('Nome da instância: 2 a 60 letras, números, - ou _.');
    const nova = String(corpo.apikey || '').trim();
    if (!nova && !(cfg && cfg.apikey_enc)) return erro('Informe a chave de API (AUTHENTICATION_API_KEY) do servidor.');
    const dados = { url, instance, apikey_enc: nova ? await cifrar(env, nova) : cfg.apikey_enc };
    await env.DB.prepare("INSERT INTO sys_docs(tenant,col,id,data) VALUES(?,?,?,?) ON CONFLICT(tenant,col,id) DO UPDATE SET data=excluded.data").bind(tenant, 'system_settings', 'whatsapp_evolution', JSON.stringify(dados)).run();
    return J({ ok: true });
  }
  if (!cfg || !cfg.url || !cfg.apikey_enc) return erro('Configure o servidor de WhatsApp desta escola primeiro.', 409);
  try {
    if (acao === 'status') return J(await evo(env, cfg, 'GET', '/instance/connectionState/' + encodeURIComponent(cfg.instance)));
    if (acao === 'qr') return J(await evo(env, cfg, 'GET', '/instance/connect/' + encodeURIComponent(cfg.instance)));
    if (acao === 'criar' && m === 'POST') return J(await evo(env, cfg, 'POST', '/instance/create', { instanceName: cfg.instance, qrcode: true, integration: 'WHATSAPP-BAILEYS' }));
    if (acao === 'desconectar' && m === 'POST') return J(await evo(env, cfg, 'DELETE', '/instance/logout/' + encodeURIComponent(cfg.instance)));
    if (acao === 'enviar' && m === 'POST') {
      const numero = String(corpo.numero || '').replace(/\D/g, ''), texto = String(corpo.texto || '').slice(0, 1000);
      if (!/^\d{10,15}$/.test(numero) || !texto) return erro('Informe o número com DDD e o texto.');
      const marca = await marcaDaEscola(env, tenant); // mensagens montadas no front ainda citam o nome antigo do sistema
      const final = marca ? texto.replace(NOME_ANTIGO, marca.nome) : texto;
      return J(await evo(env, cfg, 'POST', '/message/sendText/' + encodeURIComponent(cfg.instance), { number: numero, text: final }));
    }
  } catch (e) { return erro(e.message, 502); }
  return erro('Não encontrado.', 404);
}

function senhaFraca(cfg, pw) {
  const s = String(pw || ''), min = Math.max(6, cfg.senha_minima || 6);
  if (s.length < min) return 'Senha muito curta (mínimo ' + min + ' caracteres).';
  if (cfg.senha_forte && !(/[A-Za-z]/.test(s) && /\d/.test(s))) return 'A senha precisa ter letras e números.';
  return '';
}
/** Quem pode o quê no banco, segundo a Central (vale para o administrador da escola). Devolve a mensagem de recusa ou ''. */
function recusaDb(cfg, op, col, id) {
  const escrita = op !== 'get';
  for (const [re, chave, rotulo] of PERMISSAO_COLECAO) if (escrita && re.test(col) && cfg[chave] === false) return 'A Central desligou: ' + rotulo + '.';
  if (op === 'delete' && col === 'rumo_ao_esporte_2026_registrations' && cfg.adm_apagar_matriculas === false) return 'A Central desligou: apagar matrículas.';
  if (op === 'delete' && col === 'turmas' && cfg.adm_apagar_turmas === false) return 'A Central desligou: apagar turmas.';
  if (escrita && col === 'system_settings') {
    if (id === 'school_profile' && cfg.adm_dados_escola === false) return 'A Central desligou: editar os dados da escola.';
    if (id === 'inscricoes' && cfg.adm_inscricoes_config === false) return 'A Central desligou: abrir ou fechar inscrições.';
    if (/contra|termo/i.test(String(id)) && cfg.adm_contrato_gravar === false) return 'A Central desligou: alterar o contrato.';
  }
  if (escrita && /^contract/i.test(col) && cfg.adm_contrato_gravar === false) return 'A Central desligou: alterar o contrato.';
  if (!escrita && col === 'auditoria' && cfg.adm_ver_auditoria === false) return 'A Central desligou: ver o registro de ações.';
  return '';
}

/** Limite de matrículas do plano (definido pelo dono na Central; 0 ou ausente = sem limite). */
async function dentroDoLimite(env, tenant, adicionar) {
  const max = (await controleDe(env, tenant)).lim_matriculas;
  if (!max) return true;
  const n = await env.DB.prepare("SELECT COUNT(*) n FROM sys_docs WHERE tenant=? AND col='rumo_ao_esporte_2026_registrations'").bind(tenant).first();
  return n.n + adicionar <= max;
}
async function revogar(env, tenant, email) {
  const ant = await env.DB.prepare("SELECT data FROM sys_docs WHERE tenant=? AND col='sys_flags' AND id=?").bind(tenant, email).first();
  await env.DB.prepare('INSERT INTO sys_docs(tenant,col,id,data) VALUES(?,?,?,?) ON CONFLICT(tenant,col,id) DO UPDATE SET data=excluded.data').bind(tenant, 'sys_flags', email, JSON.stringify({ ...(ant ? JSON.parse(ant.data) : {}), revogado: Date.now() })).run();
}
async function auditar(env, tenant, s, acao) {
  const data = { quem: s.email, quando: new Date().toISOString(), acao: String(acao).slice(0, 300) };
  await env.DB.prepare('INSERT INTO sys_docs(tenant,col,id,data) VALUES(?,?,?,?)').bind(tenant, 'auditoria', idNovo(), JSON.stringify(data)).run();
  const dias = (await controleDe(env, tenant)).auditoria_dias; // retenção definida pela Central
  if (dias && Math.random() < 0.05) await env.DB.prepare("DELETE FROM sys_docs WHERE tenant=? AND col='auditoria' AND json_extract(data,'$.quando')<?").bind(tenant, new Date(Date.now() - dias * 86400e3).toISOString()).run();
}

// Reservas de espaços (responsável e professor): leem os horários já ocupados (sem dados pessoais) e criam a própria reserva.
async function rotaReservas(env, tenant, s, m, col, id, corpo) {
  if (col !== 'rentals_bookings') return null;
  if (m === 'GET') {
    const r = await env.DB.prepare('SELECT id,data FROM sys_docs WHERE tenant=? AND col=?').bind(tenant, col).all();
    const docs = (r.results || []).map((x) => { const d = JSON.parse(x.data), meu = String(d.criadoPor || d.email || '').toLowerCase() === s.email, o = {}; for (const [k, v] of Object.entries(d)) if (meu || !/nome|name|mail|phone|telefone|cpf|user|criadoPor|contact/i.test(k)) o[k] = v; return { id: x.id, data: o }; });
    if (id) { const x = docs.find((d) => d.id === id); return J(x ? { existe: true, data: x.data } : { existe: false }); }
    return J({ docs });
  }
  if (m === 'POST' && !id) {
    const d = corpo.data; if (!d || typeof d.locationId !== 'string' || typeof d.date !== 'string') return erro('Dados da reserva incompletos.');
    const novo = idNovo(); try { await gravar(env, tenant, { op: 'set', col, id: novo, data: { ...d, criadoPor: s.email } }); } catch (e) { return erro(e.message); }
    await auditar(env, tenant, s, 'reserva criada ' + novo); return J({ id: novo });
  }
  return null;
}
// Acesso do responsável (role 'user'): lê só a própria inscrição (pelo e-mail) e coleções de consulta; edita só dados de contato da própria inscrição.
const LEITURA_PAIS = new Set(['rumo_ao_esporte_2026_plans', 'turmas', 'rentals_locations', 'patrocinadores']);
const CAMPO_PROIBIDO = /^(status|financial|contract|approved|role|plan|valor|desconto|discount|origem)/i;
async function portalPais(env, tenant, s, m, partes, corpo) {
  const [, col, id] = partes, REG = 'rumo_ao_esporte_2026_registrations', meu = (d) => String(d && d.responsavel && d.responsavel.email || '').toLowerCase() === s.email;
  if (partes[0] !== 'db' || !colOk(col || '')) return erro('Sem permissão.', 403);
  const rr = await rotaReservas(env, tenant, s, m, col, id, corpo); if (rr) return rr;
  if (m === 'GET') {
    if (col === REG) {
      if (id) { const x = await env.DB.prepare('SELECT data FROM sys_docs WHERE tenant=? AND col=? AND id=?').bind(tenant, col, id).first(); const d = x && JSON.parse(x.data); return J(d && meu(d) ? { existe: true, data: d } : { existe: false }); }
      const r = await env.DB.prepare('SELECT id,data FROM sys_docs WHERE tenant=? AND col=?').bind(tenant, col).all();
      return J({ docs: (r.results || []).map((x) => ({ id: x.id, data: JSON.parse(x.data) })).filter((x) => meu(x.data)) });
    }
    if (col === 'financial_payments') { // só as cobranças dos alunos deste responsável
      const rs = await env.DB.prepare("SELECT id,data FROM sys_docs WHERE tenant=? AND col=?").bind(tenant, REG).all();
      const meus = new Set((rs.results || []).filter((x) => meu(JSON.parse(x.data))).map((x) => x.id));
      if (id) { const x = await env.DB.prepare('SELECT data FROM sys_docs WHERE tenant=? AND col=? AND id=?').bind(tenant, col, id).first(); const d = x && JSON.parse(x.data); return J(d && meus.has(d.studentId) ? { existe: true, data: d } : { existe: false }); }
      const r = await env.DB.prepare('SELECT id,data FROM sys_docs WHERE tenant=? AND col=?').bind(tenant, col).all();
      return J({ docs: (r.results || []).map((x) => ({ id: x.id, data: JSON.parse(x.data) })).filter((x) => meus.has(x.data.studentId)) });
    }
    if (col === CHAMADAS) { // frequência: só as chamadas das turmas dos alunos deste responsável, e só a situação deles (sem os outros nomes)
      if (id) return J({ existe: false });
      const rs = await env.DB.prepare('SELECT data FROM sys_docs WHERE tenant=? AND col=?').bind(tenant, REG).all();
      const meus = (rs.results || []).map((x) => JSON.parse(x.data)).filter(meu).flatMap((d) => (d.alunos || []).map((a) => ({ nome: a.nome, turmaId: a.turmaId })));
      const r = await env.DB.prepare('SELECT id,data FROM sys_docs WHERE tenant=? AND col=?').bind(tenant, CHAMADAS).all();
      const docs = (r.results || []).map((x) => ({ id: x.id, c: JSON.parse(x.data) })).map(({ id: i, c }) => {
        const alunos = meus.filter((a) => a.turmaId === c.turmaId).map((a) => ({ nome: a.nome, presente: (c.presentStudents || []).some((p) => p.nome === a.nome) }));
        return alunos.length ? { id: i, data: { data: c.data, turmaId: c.turmaId, turmaNome: c.turmaNome, alunos } } : null;
      }).filter(Boolean);
      return J({ docs });
    }
    if (LEITURA_PAIS.has(col) || (col === 'system_settings' && id !== 'whatsapp_evolution')) return id ? publico(env, tenant, col, id) : publico(env, tenant, col);
    return J(id ? { existe: false } : { docs: [] });
  }
  if (m === 'PUT' && col === REG && id && corpo.update) {
    const x = await env.DB.prepare('SELECT data FROM sys_docs WHERE tenant=? AND col=? AND id=?').bind(tenant, col, id).first();
    if (!x || !meu(JSON.parse(x.data))) return erro('Sem permissão.', 403);
    if (Object.keys(corpo.data || {}).some((k) => CAMPO_PROIBIDO.test(k))) return erro('Campo não editável pelo responsável.', 403);
    try { await gravar(env, tenant, { op: 'update', col, id, data: corpo.data }); } catch (e) { return erro(e.message); }
    await auditar(env, tenant, s, `responsável editou ${col}/${id}`);
    return J({ ok: true });
  }
  return erro('Sem permissão.', 403);
}

// Acesso do professor (role 'professor'): lê turmas, a própria ficha e os alunos (só o que a chamada precisa) e registra chamadas; nada além.
const CHAMADAS = 'rumo_ao_esporte_2026_chamadas';
async function portalProfessor(env, tenant, s, m, partes, corpo) {
  const [, col, id] = partes, REG = 'rumo_ao_esporte_2026_registrations';
  if (partes[0] !== 'db' || !colOk(col || '')) return erro('Sem permissão.', 403);
  const rr = await rotaReservas(env, tenant, s, m, col, id, corpo); if (rr) return rr;
  const limpa = (d) => ({ contractStatus: d.contractStatus, status: d.status, responsavel: { nome: d.responsavel && d.responsavel.nome, telefonePrincipal: d.responsavel && d.responsavel.telefonePrincipal },
    alunos: (d.alunos || []).map((a) => ({ nome: a.nome, dataNascimento: a.dataNascimento, fotoUrl: a.fotoUrl, turmaId: a.turmaId, camisa: a.camisa, medicamentos: a.medicamentos, alergias: a.alergias })) });
  // Só as turmas em que o professor é o responsável (o nome do cadastro dele = o responsável da turma)
  const norm = (v) => String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const tr = await env.DB.prepare("SELECT data FROM sys_docs WHERE tenant=? AND col='teachers' AND lower(trim(json_extract(data,'$.email')))=? LIMIT 1").bind(tenant, s.email).first();
  const meuNome = tr ? norm(JSON.parse(tr.data).nome) : '';
  const rt = await env.DB.prepare("SELECT id,data FROM sys_docs WHERE tenant=? AND col='turmas'").bind(tenant).all();
  const minhas = new Set((rt.results || []).filter((x) => meuNome && norm(JSON.parse(x.data).responsavel) === meuNome).map((x) => x.id));
  if (m === 'GET') {
    if (col === 'turmas') {
      const docs = (rt.results || []).filter((x) => minhas.has(x.id)).map((x) => ({ id: x.id, data: JSON.parse(x.data) }));
      if (id) { const x = docs.find((d) => d.id === id); return J(x ? { existe: true, data: x.data } : { existe: false }); }
      return J({ docs });
    }
    if (col === CHAMADAS) {
      const r = await env.DB.prepare('SELECT id,data FROM sys_docs WHERE tenant=? AND col=?').bind(tenant, col).all();
      const docs = (r.results || []).map((x) => ({ id: x.id, data: JSON.parse(x.data) })).filter((x) => minhas.has(x.data.turmaId));
      if (id) { const x = docs.find((d) => d.id === id); return J(x ? { existe: true, data: x.data } : { existe: false }); }
      return J({ docs });
    }
    if (col === REG || col === 'teachers') {
      const r = await env.DB.prepare('SELECT id,data FROM sys_docs WHERE tenant=? AND col=?').bind(tenant, col).all();
      let docs = (r.results || []).map((x) => ({ id: x.id, data: JSON.parse(x.data) }));
      if (col === REG) docs = docs.map((x) => { const l = limpa(x.data); l.alunos = l.alunos.filter((a) => minhas.has(a.turmaId)); return { id: x.id, data: l }; }).filter((x) => x.data.alunos.length);
      else docs = docs.filter((x) => String(x.data.email || '').trim().toLowerCase() === s.email).map((x) => { const { senha, cpf, ...resto } = x.data; return { id: x.id, data: resto }; });
      if (id) { const x = docs.find((d) => d.id === id); return J(x ? { existe: true, data: x.data } : { existe: false }); }
      return J({ docs });
    }
    if ((LEITURA_PAIS.has(col) && col !== 'turmas') || col === 'rumo_ao_esporte_2026_convocacoes' || (col === 'system_settings' && id !== 'whatsapp_evolution')) return id ? publico(env, tenant, col, id) : publico(env, tenant, col);
    return J(id ? { existe: false } : { docs: [] });
  }
  if (m === 'POST' && col === CHAMADAS && !id) {
    if (!corpo.data || !minhas.has(corpo.data.turmaId)) return erro('Você só pode registrar chamada das suas turmas.', 403);
    const novo = idNovo();
    try { await gravar(env, tenant, { op: 'set', col, id: novo, data: corpo.data }); } catch (e) { return erro(e.message); }
    await auditar(env, tenant, s, `professor registrou chamada ${novo}`);
    return J({ id: novo });
  }
  return erro('Sem permissão.', 403);
}

/** Rotas /sys/* do tenant (host da escola). */
export async function rotaSistema(req, env, tenant, p) {
  const m = req.method, partes = p.split('/').filter(Boolean).slice(1); // tira "sys"
  let corpo = {}; if (m !== 'GET' && m !== 'DELETE') { try { corpo = await req.json(); } catch { corpo = {}; } }
  const cfg = await controleDe(env, tenant), ehLogin = partes[0] === 'auth' && partes[1] === 'login';
  if (cfg.suspensa) return erro(cfg.suspensa_msg || 'Sistema indisponível.', 423);
  if (cfg.somente_leitura && m !== 'GET' && !ehLogin && !(partes[0] === 'auth' && ['logout-all', 'password'].includes(partes[1]))) return erro('A escola está em modo somente leitura. Nada pode ser gravado agora.', 423);

  if (partes[0] === 'public' && partes[1] === 'criativos' && m === 'GET') { // modelos de carteirinha e de aniversário definidos na Central (null = usar os padrões do sistema)
    const r = await env.DB.prepare("SELECT v FROM settings WHERE k='criativos'").first();
    return new Response(JSON.stringify({ catalogo: r ? JSON.parse(r.v) : null }), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=60' } });
  }
  if (partes[0] === 'public' && partes[1] === 'planos' && m === 'GET') { // planos para a escola em teste escolher (modal "Escolha seu plano")
    const pl = await env.DB.prepare('SELECT nome,mensal,implantacao,descricao FROM planos WHERE ativo=1 ORDER BY mensal').all(), w = await env.DB.prepare("SELECT v FROM settings WHERE k='empresa_whats'").first(), e = await env.DB.prepare('SELECT escola FROM clientes WHERE url_sistema=?').bind('https://' + tenant).first();
    return new Response(JSON.stringify({ escola: e ? e.escola : '', planos: pl.results || [], whats: w ? String(w.v).replace(/\D/g, '') : '' }), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
  }
  if (partes[0] === 'plano' && m === 'POST') { // a escola em teste escolhe o plano: fica registrado em Clientes (notas) e na atividade da Central
    const s = await lerToken(req, env, tenant);
    if (!s || s.role !== 'admin') return erro('Faça login como administrador.', 401);
    const nome = String(corpo.plano || '').slice(0, 60), pl = await env.DB.prepare('SELECT nome,mensal FROM planos WHERE ativo=1 AND nome=?').bind(nome).first();
    if (!pl) return erro('Plano não encontrado.', 404);
    const c = await env.DB.prepare('SELECT id,escola,notas FROM clientes WHERE url_sistema=?').bind('https://' + tenant).first();
    if (!c) return erro('Escola não encontrada.', 404);
    const quando = new Date().toISOString();
    await env.DB.prepare('INSERT INTO settings(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v').bind('plano_escolhido:' + c.id, JSON.stringify({ plano: pl.nome, quando })).run();
    await env.DB.prepare('UPDATE clientes SET notas=? WHERE id=?').bind(((c.notas || '') + '\nEscolheu o plano ' + pl.nome + ' em ' + quando.slice(0, 10)).trim(), c.id).run();
    await env.DB.prepare('INSERT INTO atividade(quando,tipo,texto) VALUES(?,?,?)').bind(quando, 'plano', c.escola + ' escolheu o plano ' + pl.nome).run();
    const w = await env.DB.prepare("SELECT v FROM settings WHERE k='empresa_whats'").first();
    return new Response(JSON.stringify({ ok: true, plano: pl.nome, whats: w ? String(w.v).replace(/\D/g, '') : '' }), { headers: { 'content-type': 'application/json; charset=utf-8' } });
  }
  if (partes[0] === 'public' && partes[1] === 'patrocinadores' && m === 'GET') {
    const r = await env.DB.prepare("SELECT id,data FROM sys_docs WHERE tenant=? AND col='patrocinadores'").bind(tenant).all();
    const cfg = await env.DB.prepare("SELECT data FROM sys_docs WHERE tenant=? AND col='system_settings' AND id='patrocinadores'").bind(tenant).first();
    const itens = (r.results || []).map((x) => JSON.parse(x.data)).filter((d) => d.ativo !== false).sort((a, b) => (a.ordem || 0) - (b.ordem || 0)).map((d) => ({ nome: d.nome, logo: d.logo, whatsapp: d.whatsapp }));
    return J({ mostrar: cfg ? JSON.parse(cfg.data).mostrar !== false : true, itens });
  }
  if (partes[0] === 'auth') {
    const email = String(corpo.email || '').trim().toLowerCase();
    if (partes[1] === 'login' && m === 'POST') {
      const chave = 'sysfalha:' + tenant + ':' + email, desde = Date.now() - (cfg.lim_login_janela_min || 15) * 60000;
      const chaveIp = 'sysip:' + tenant + ':' + (req.headers.get('cf-connecting-ip') || 'x');
      const f = await env.DB.prepare('SELECT COUNT(*) n FROM tentativas WHERE chave=? AND quando>?').bind(chave, desde).first();
      const fi = await env.DB.prepare('SELECT COUNT(*) n FROM tentativas WHERE chave=? AND quando>?').bind(chaveIp, desde).first();
      if ((cfg.lim_login_tentativas && f.n >= cfg.lim_login_tentativas) || (cfg.lim_login_ip && fi.n >= cfg.lim_login_ip)) return erro('Muitas tentativas. Espere ' + (cfg.lim_login_janela_min || 15) + ' minutos.', 429);
      let u = await env.DB.prepare('SELECT * FROM sys_users WHERE tenant=? AND email=?').bind(tenant, email).first();
      if (email) { // professor: o cadastro em "teachers" manda (senha ou CPF digitados batem); a conta nasce ou é realinhada no login
        const t = await env.DB.prepare("SELECT data FROM sys_docs WHERE tenant=? AND col='teachers' AND lower(trim(json_extract(data,'$.email')))=? LIMIT 1").bind(tenant, email).first();
        const td = t && JSON.parse(t.data), bruta = String(corpo.password || ''), pw = bruta.trim(), cpfT = String(td && td.cpf || '').replace(/\D/g, ''), senhaT = String(td && td.senha || '').trim();
        if (td && cfg.primeiro_acesso_prof !== false && (!u || u.role !== 'admin')) {
          if (td.active === false) u = null;
          else if (!u && cfg.lim_usuarios && (await env.DB.prepare('SELECT COUNT(*) n FROM sys_users WHERE tenant=?').bind(tenant).first()).n >= cfg.lim_usuarios) u = null;
          else if (((senhaT && senhaT === pw) || (cfg.cpf_senha !== false && cpfT.length === 11 && cpfT === pw.replace(/\D/g, ''))) && (!u || u.role !== 'professor' || (await pbkdf2(bruta, u.salt)) !== u.hash)) {
            const { salt, hash } = await hashSenha(bruta), uid = u ? u.uid : idNovo();
            await env.DB.prepare('INSERT INTO sys_users(tenant,email,salt,hash,uid,role) VALUES(?,?,?,?,?,?) ON CONFLICT(tenant,email) DO UPDATE SET salt=excluded.salt,hash=excluded.hash,role=excluded.role').bind(tenant, email, salt, hash, uid, 'professor').run();
            u = { tenant, email, salt, hash, uid, role: 'professor' };
          }
        }
      }
      if (!u && email && cfg.primeiro_acesso_pais !== false && cfg.cpf_senha !== false) { // primeiro acesso do responsável: e-mail do cadastro + CPF como senha (o mesmo padrão do sistema original)
        const cpf = String(corpo.password || '').replace(/\D/g, '');
        const reg = cpf.length === 11 && await env.DB.prepare("SELECT 1 x FROM sys_docs WHERE tenant=? AND col='rumo_ao_esporte_2026_registrations' AND lower(trim(json_extract(data,'$.responsavel.email')))=? AND replace(replace(replace(json_extract(data,'$.responsavel.cpf'),'.',''),'-',''),' ','')=? LIMIT 1").bind(tenant, email, cpf).first();
        if (reg && !(cfg.lim_usuarios && (await env.DB.prepare('SELECT COUNT(*) n FROM sys_users WHERE tenant=?').bind(tenant).first()).n >= cfg.lim_usuarios)) {
          const { salt, hash } = await hashSenha(cpf), uid = idNovo();
          await env.DB.prepare('INSERT INTO sys_users(tenant,email,salt,hash,uid,role) VALUES(?,?,?,?,?,?)').bind(tenant, email, salt, hash, uid, 'user').run();
          u = { tenant, email, salt, hash, uid, role: 'user' };
        }
      }
      if (!u ||(await pbkdf2(String(corpo.password || ''), u.salt)) !== u.hash) {
        await env.DB.prepare('INSERT INTO tentativas(chave,quando) VALUES(?,?)').bind(chave, Date.now()).run();
        await env.DB.prepare('INSERT INTO tentativas(chave,quando) VALUES(?,?)').bind(chaveIp, Date.now()).run();
        return erro('Credenciais inválidas.', 401);
      }
      const flU = await env.DB.prepare("SELECT data FROM sys_docs WHERE tenant=? AND col='sys_flags' AND id=?").bind(tenant, u.email).first();
      if (flU && JSON.parse(flU.data).bloqueado) return erro('Este usuário foi bloqueado pela Central.', 403);
      const papel = u.role, barrado =(papel === 'user' && cfg.bloq_login_pais) ? 'O acesso dos responsáveis está bloqueado pela escola.' : (papel === 'professor' && cfg.bloq_login_professor) ? 'O acesso dos professores está bloqueado pela escola.' : (papel === 'admin' && cfg.bloq_login_admin) ? 'O acesso dos administradores está bloqueado.' : (papel !== 'admin' && cfg.manutencao) ? (cfg.manutencao_msg || 'Sistema em manutenção.') : '';
      if (barrado) return erro(barrado, 403);
      const ipsOk = String(cfg.admin_ips || '').split(',').map((x) => x.trim()).filter(Boolean);
      if (papel === 'admin' && ipsOk.length && !ipsOk.includes(req.headers.get('cf-connecting-ip') || '')) return erro('Este endereço não está autorizado a entrar como administrador.', 403);
      await env.DB.prepare('DELETE FROM tentativas WHERE chave=?').bind(chave).run();
      if (cfg.log_logins) await auditar(env, tenant, { email: u.email }, 'login (' + papel + ')');
      return J({ token: await emitirToken(env, tenant, u), uid: u.uid, email: u.email, role: u.role });
    }
    const s = await lerToken(req, env, tenant);
    if (!s) return erro('Faça login.', 401);
    if (partes[1] === 'me') return J(s);
    if (partes[1] === 'create' && m === 'POST') {
      if (s.role !== 'admin') return erro('Sem permissão.', 403);
      if (cfg.adm_criar_usuarios === false) return erro('A criação de usuários foi desligada pela Central.', 403);
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return erro('E-mail inválido.');
      const fraca = senhaFraca(cfg, corpo.password); if (fraca) return erro(fraca);
      if (await env.DB.prepare('SELECT 1 x FROM sys_users WHERE tenant=? AND email=?').bind(tenant, email).first()) return erro('E-mail já cadastrado.', 409);
      if (cfg.lim_usuarios && (await env.DB.prepare('SELECT COUNT(*) n FROM sys_users WHERE tenant=?').bind(tenant).first()).n >= cfg.lim_usuarios) return erro('Limite de usuários do plano atingido. Fale com a Central.', 403);
      const { salt, hash } = await hashSenha(String(corpo.password)), uid = idNovo();
      await env.DB.prepare('INSERT INTO sys_users(tenant,email,salt,hash,uid,role) VALUES(?,?,?,?,?,?)').bind(tenant, email, salt, hash, uid, 'user').run();
      return J({ uid, email });
    }
    if (partes[1] === 'logout-all' && m === 'POST') {
      await revogar(env, tenant, s.email);
      return J({ ok: true });
    }
    if (partes[1] === 'reset' && m === 'POST') { // o admin redefine a senha de um usuário (recuperação sem e-mail)
      if (s.role !== 'admin') return erro('Sem permissão.', 403);
      if (cfg.adm_redefinir_senhas === false) return erro('A redefinição de senhas foi desligada pela Central.', 403);
      const fraca = senhaFraca(cfg, corpo.password); if (fraca) return erro(fraca);
      if (!(await env.DB.prepare('SELECT 1 x FROM sys_users WHERE tenant=? AND email=?').bind(tenant, email).first())) return erro('Usuário não encontrado.', 404);
      const { salt, hash } = await hashSenha(String(corpo.password));
      await env.DB.prepare('UPDATE sys_users SET salt=?,hash=? WHERE tenant=? AND email=?').bind(salt, hash, tenant, email).run();
      await revogar(env, tenant, email); // sessões antigas do usuário caem
      await auditar(env, tenant, s, 'redefiniu a senha de ' + email);
      return J({ ok: true });
    }
    if (partes[1] === 'password' && m === 'POST') {
      const fraca = senhaFraca(cfg, corpo.password); if (fraca) return erro(fraca);
      const { salt, hash } = await hashSenha(String(corpo.password));
      await env.DB.prepare('UPDATE sys_users SET salt=?,hash=? WHERE tenant=? AND email=?').bind(salt, hash, tenant, s.email).run();
      return J({ ok: true });
    }
    return erro('Não encontrado.', 404);
  }

  if (partes[0] === 'export' && m === 'GET') { // cópia de segurança de todos os dados da escola (sem a chave do WhatsApp nem as senhas)
    const s = await lerToken(req, env, tenant);
    if (!s) return erro('Faça login.', 401);
    if (s.role !== 'admin') return erro('Sem permissão.', 403);
    if (cfg.adm_exportar === false || cfg.bloq_exportar) return erro('A exportação de dados foi desligada pela Central.', 403);
    const r = await env.DB.prepare("SELECT col,id,data FROM sys_docs WHERE tenant=? AND NOT (col='system_settings' AND id='whatsapp_evolution') AND substr(col,1,4)<>'sys_'").bind(tenant).all();
    await auditar(env, tenant, s, 'exportou os dados da escola');
    return new Response(JSON.stringify({ tenant, geradoEm: new Date().toISOString(), docs: (r.results || []).map((x) => ({ col: x.col, id: x.id, data: JSON.parse(x.data) })) }), { headers: { 'content-type': 'application/json; charset=utf-8', 'content-disposition': 'attachment; filename="backup-' + tenant.split('.')[0] + '.json"', 'cache-control': 'no-store' } });
  }

  if (partes[0] === 'import' && m === 'POST') { // importação de alunos (linhas de planilha); entram como pendentes de aprovação
    const s = await lerToken(req, env, tenant);
    if (!s) return erro('Faça login.', 401);
    if (s.role !== 'admin') return erro('Sem permissão.', 403);
    if (cfg.adm_importar === false) return erro('A importação de alunos foi desligada pela Central.', 403);
    const linhas = Array.isArray(corpo.linhas) ? corpo.linhas : [];
    if (!linhas.length || linhas.length > 500) return erro('Envie de 1 a 500 linhas.');
    const ok = [], falhas = [], txt = (v, n = 120) => String(v == null ? '' : v).trim().slice(0, n), dig = (v) => String(v || '').replace(/\D/g, '');
    for (let i = 0; i < linhas.length; i++) {
      const l = linhas[i] || {}, nome = txt(l.responsavel_nome), aluno = txt(l.aluno_nome), email = txt(l.responsavel_email).toLowerCase(), cpf = dig(l.responsavel_cpf);
      if (nome.length < 3 || aluno.length < 2) { falhas.push({ linha: i + 2, motivo: 'Nome do responsável ou do aluno ausente.' }); continue; }
      if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { falhas.push({ linha: i + 2, motivo: 'E-mail inválido.' }); continue; }
      if (cpf && cpf.length !== 11) { falhas.push({ linha: i + 2, motivo: 'CPF do responsável deve ter 11 dígitos.' }); continue; }
      ok.push({ responsavel: { nome, email, cpf, telefonePrincipal: dig(l.responsavel_telefone).slice(0, 13) }, alunos: [{ nome: aluno, dataNascimento: txt(l.aluno_nascimento, 10), cpf: dig(l.aluno_cpf).slice(0, 11) }], status: 'pendente', contractStatus: 'pendente', origem: 'importacao' });
    }
    if (!(await dentroDoLimite(env, tenant, ok.length))) return erro('A importação passaria do limite de matrículas do plano.', 403);
    for (const d of ok) await gravar(env, tenant, { op: 'set', col: 'rumo_ao_esporte_2026_registrations', id: idNovo(), data: d });
    await auditar(env, tenant, s, `importou ${ok.length} aluno(s) por planilha (${falhas.length} recusados)`);
    return J({ importados: ok.length, falhas });
  }

  if (partes[0] === 'wa') {
    const s = await lerToken(req, env, tenant);
    if (!s) return erro('Faça login.', 401);
    if (s.role !== 'admin') return erro('Sem permissão.', 403);
    if (cfg.bloq_wa && partes[1] === 'enviar') return erro('O envio de WhatsApp foi desligado pela Central.', 403);
    if (cfg.adm_whatsapp_config === false && partes[1] === 'config' && m === 'PUT') return erro('A Central desligou: configurar o servidor de WhatsApp.', 403);
    if (cfg.lim_wa_dia && partes[1] === 'enviar') {
      const ch = 'wa:' + tenant, dia = Date.now() - 86400e3, n = await env.DB.prepare('SELECT COUNT(*) n FROM tentativas WHERE chave=? AND quando>?').bind(ch, dia).first();
      if (n.n >= cfg.lim_wa_dia) return erro('Limite diário de mensagens de WhatsApp atingido (' + cfg.lim_wa_dia + ').', 429);
      await env.DB.prepare('INSERT INTO tentativas(chave,quando) VALUES(?,?)').bind(ch, Date.now()).run();
    }
    return rotaWa(req, env, tenant, partes, corpo);
  }

  if (partes[0] === 'db' || partes[0] === 'batch') {
    const s = await lerToken(req, env, tenant);
    // Sem login: só o que o formulário de inscrição precisa ler (planos e duas configurações) e só gravar uma inscrição nova.
    // O resto volta vazio (a tela de login consulta antes de autenticar) e nenhuma outra gravação é aceita.
    if (!s) {
      const [, col, id] = partes;
      if (col === 'auditoria') return erro('Faça login.', 401);
      if (m === 'GET' && col === 'rumo_ao_esporte_2026_plans' && !id) return publico(env, tenant, col);
      if (m === 'GET' && col === 'system_settings' && (id === 'plan_auto_allocation' || id === 'patrocinadores' || id === 'inscricoes')) return publico(env, tenant, col, id);
      if (partes[0] === 'db' && m === 'POST' && col === 'rumo_ao_esporte_2026_registrations' && !id) return novaInscricao(req, env, tenant, corpo);
      return m === 'GET' ? J(id ? { existe: false } : { docs: [] }) : erro('Faça login.', 401);
    }
    if (cfg.manutencao && s.role !== 'admin') return erro(cfg.manutencao_msg || 'Sistema em manutenção.', 503);
    if (s.role === 'professor') return portalProfessor(env, tenant, s, m, partes, corpo);
    if (s.role !== 'admin') return portalPais(env, tenant, s, m, partes, corpo);
    try {
      if (partes[0] === 'batch' && m === 'POST') {
        for (const op of corpo.ops || []) { if (String(op.col).startsWith('sys_')) return erro('Coleção reservada.', 403); const rec = recusaDb(cfg, op.op, String(op.col), op.id); if (rec) return erro(rec, 403); }
        for (const op of corpo.ops || []) await gravar(env, tenant, op);
        await auditar(env, tenant, s, 'lote: ' + (corpo.ops || []).slice(0, 5).map((o) => `${o.op} ${o.col}/${o.id}`).join('; '));
        return J({ ok: true });
      }
      const [, col, id] = partes;
      if (!colOk(col || '')) return erro('Coleção inválida.');
      if (col.startsWith('sys_')) return erro('Coleção reservada.', 403); // flags de sessão e limites do plano (só o dono mexe)
      if (col === 'system_settings' && id === 'whatsapp_evolution') return erro('Use as rotas de WhatsApp.', 403);
      const recusa = recusaDb(cfg, m === 'GET' ? 'get' : m === 'DELETE' ? 'delete' : 'set', col, id); if (recusa) return erro(recusa, 403);
      if (m !== 'GET' && col !== 'auditoria') await auditar(env, tenant, s, `${m} ${col}/${id || '(novo)'}`);
      if (col === 'auditoria' && m !== 'GET') return erro('O registro de ações não pode ser alterado.', 403);
      if (m === 'GET' && !id) {
        const r = await env.DB.prepare('SELECT id,data FROM sys_docs WHERE tenant=? AND col=?').bind(tenant, col).all();
        return J({ docs: (r.results || []).map((x) => ({ id: x.id, data: JSON.parse(x.data) })) });
      }
      if (m === 'GET') { const x = await env.DB.prepare('SELECT data FROM sys_docs WHERE tenant=? AND col=? AND id=?').bind(tenant, col, id).first(); return J(x ? { existe: true, data: JSON.parse(x.data) } : { existe: false }); }
      if (m === 'POST' && !id) { const novo = idNovo(); await gravar(env, tenant, { op: 'set', col, id: novo, data: corpo.data }); return J({ id: novo }); }
      if (m === 'PUT') { await gravar(env, tenant, { op: corpo.update ? 'update' : 'set', col, id, data: corpo.data, merge: corpo.merge }); return J({ ok: true }); }
      if (m === 'DELETE') { await gravar(env, tenant, { op: 'delete', col, id }); return J({ ok: true }); }
    } catch (e) { return erro(e.message, 400); }
  }
  return erro('Não encontrado.', 404);
}

// Nome antigo do sistema ("Rumo ao Esporte", "... e ao Lazer - REAL", "... 2026") vira o nome da escola do subdomínio.
const NOME_ANTIGO = /Rumo ao Esporte( e ao Lazer\s*[-–]\s*REAL)?( 2026)?/gi;
export const sessaoDoToken = lerToken; // a rota de assinatura (index.js) confere a sessão da escola
const LOGOS = new Set(['/rumo-ao-esporte-logo.png', '/logo-dashboard.png', '/real-logo-transparente.svg', '/escola/pwa/icon-192.png', '/escola/pwa/icon-512.png']);
const PNG_TRANSPARENTE = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const PNG_VAZIO ='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const attr = (x) => String(x).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function marcaDaEscola(env, host) {
  const c = await env.DB.prepare('SELECT escola, lead_id FROM clientes WHERE url_sistema=?').bind('https://' + host).first();
  if (!c) return null;
  const l = c.lead_id ? await env.DB.prepare('SELECT logo FROM leads WHERE id=?').bind(c.lead_id).first() : null;
  const a = await env.DB.prepare("SELECT email FROM sys_users WHERE tenant=? AND role='admin' ORDER BY rowid LIMIT 1").bind(host).first();
  const pf = await env.DB.prepare("SELECT data FROM sys_docs WHERE tenant=? AND col='system_settings' AND id='school_profile'").bind(host).first();
  const f = pf ? JSON.parse(pf.data) : {}, t = (v) => String(v == null ? '' : v).trim();
  const cidade = t(f.cidade), uf = t(f.uf), foroC = t(f.foroCidade) || cidade, foroU = t(f.foroUf) || uf;
  // Campos prontos para os documentos (vazio = o campo [..DA ESCOLA] continua aparecendo); a assinatura (imagem grande) vai por /assinatura-associacao.png
  const perfil = {
    cnpj: t(f.cnpj), cep: t(f.cep), email: t(f.email), telefone: t(f.telefone),
    endereco: [t(f.rua) && t(f.rua) + (t(f.numero) ? ', ' + t(f.numero) : ''), t(f.bairro), cidade && cidade + (uf ? '/' + uf : '')].filter(Boolean).join(', '),
    foro: foroC ? foroC + (foroU ? '/' + foroU : '') : '',
  };
  return { nome: c.escola, logo: l && l.logo ? l.logo : '', adminEmail: a ? a.email : '', perfil, assinatura: t(f.assinatura) };
}
// Sem logo enviada, um selo com as iniciais da escola (SVG serve em qualquer <img>).
function selo(nome) {
  const ini = String(nome).split(/\s+/).filter((w) => w.length > 2).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || String(nome)[0] || 'E';
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" rx="36" fill="#17428f"/><circle cx="100" cy="100" r="74" fill="none" stroke="#00a63a" stroke-width="10"/><text x="100" y="124" text-anchor="middle" font-family="Arial,sans-serif" font-weight="800" font-size="72" fill="#fff">' + attr(ini) + '</text></svg>';
}

/** Entrega o sistema (SPA) já compilado em /escola/ para o host da escola, com a marca dela. */
export async function servirSistema(req, env, p, host) {
  const r = await servirSistemaBase(req, env, p, host), h = new Headers(r.headers);
  if ((h.get('content-type') || '').includes('text/html')) h.set('content-security-policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: blob: https:; font-src 'self' data: https:; media-src 'self' https: data:; connect-src 'self' https:; frame-src 'self' https:; object-src 'none'; base-uri 'self'; frame-ancestors 'self'");
  h.set('x-content-type-options', 'nosniff'); h.set('x-frame-options', 'SAMEORIGIN'); h.set('referrer-policy', 'same-origin');
  h.set('strict-transport-security', 'max-age=31536000'); h.set('permissions-policy', 'camera=(self), microphone=(), geolocation=()');
  return new Response(r.body, { status: r.status, statusText: r.statusText, headers: h });
}
async function servirSistemaBase(req, env, p, host) {
  // Sem PWA offline neste sistema: um service worker que se desinstala limpa qualquer versão antiga do navegador.
  if (p === '/sw.js') return new Response("self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(self.registration.unregister().then(()=>caches.keys()).then(k=>Promise.all(k.map(x=>caches.delete(x))))));", { headers: { 'content-type': 'text/javascript', 'cache-control': 'no-store' } });
  if (p === '/__entrar') { // "Entrar como a escola" (dono): o token vem no fragmento (#t=...), que não vai para registros de acesso
    return new Response('<!doctype html><meta charset="utf-8"><title>Entrando…</title><script>var go="/admin/dashboard";try{var t=(location.hash.match(/t=([^&]+)/)||[])[1],r=(location.hash.match(/r=([a-z]+)/)||[])[1];if(t){localStorage.setItem("pg_sys_token",t);["rae_admin_auth","rae_teacher_auth","rae_student_auth"].forEach(function(k){localStorage.removeItem(k)});if(r==="professor"){localStorage.setItem("rae_teacher_auth","true");go="/professor/turmas";}else if(r==="user"){localStorage.setItem("rae_student_auth","true");go="/aluno/dashboard";}else{localStorage.setItem("rae_admin_auth","true");sessionStorage.setItem("rae_admin_session_active","true");}}}catch(e){}location.replace(go);</script>', { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
  }
  if (p === '/assinatura-associacao.png' || p === '/escola/assinatura-associacao.png') { // assinatura da associação (página "Dados da escola"); sem ela, um PNG transparente
    const m = await marcaDaEscola(env, host), d = m && /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(m.assinatura);
    const bytes = d ? Uint8Array.from(atob(d[2]), (ch) => ch.charCodeAt(0)) : Uint8Array.from(atob(PNG_TRANSPARENTE), (ch) => ch.charCodeAt(0));
    return new Response(bytes, { headers: { 'content-type': d ? d[1] : 'image/png', 'cache-control': 'no-cache' } });
  }
  if (LOGOS.has(p) || p.startsWith('/escola/pwa/')) {
    const m = await marcaDaEscola(env, host);
    const d = m && /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(m.logo);
    if (d) return new Response(Uint8Array.from(atob(d[2]), (ch) => ch.charCodeAt(0)), { headers: { 'content-type': d[1], 'cache-control': 'no-cache' } });
    return new Response(selo(m ? m.nome : 'Escola'), { headers: { 'content-type': 'image/svg+xml', 'cache-control': 'no-cache' } });
  }
  const alvo = new URL(req.url);
  alvo.pathname = p.startsWith('/escola/') ? p : '/escola' + (p === '/' || p === '' ? '/' : p);
  let r = await env.ASSETS.fetch(new Request(alvo, req));
  if (!(r.status !== 404 && (r.status < 300 || r.status === 304))) { // 304 (cache do navegador) também é resposta válida
    alvo.pathname = '/escola/'; // rotas do React Router caem no index.html
    r = await env.ASSETS.fetch(new Request(alvo, { method: 'GET', headers: req.headers }));
  }
  if (!(r.headers.get('content-type') || '').includes('text/html')) return r;
  const m = await marcaDaEscola(env, host);
  if (!m) return r;
  let html = (await r.text()).replace(NOME_ANTIGO, (x) => attr(x === x.toUpperCase() ? m.nome.toUpperCase() : m.nome));
  const cfg = await controleDe(env, host);
  if (cfg.suspensa) return new Response('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + attr(m.nome) + '</title></head><body style="font-family:Arial,sans-serif;background:#f4f8fc;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0"><div style="background:#fff;padding:32px;border-radius:12px;max-width:440px;margin:16px;text-align:center;box-shadow:0 10px 40px rgba(9,36,92,.12)"><h1 style="color:#17428f;font-size:1.4rem">' + attr(m.nome) + '</h1><p style="color:#444">' + attr(cfg.suspensa_msg || 'Sistema indisponível.') + '</p></div></body></html>', { status: 503, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
  html = html.replace('</head>', '<script>window.__MARCA__=' + JSON.stringify({ nome: m.nome, adminEmail: m.adminEmail, perfil: m.perfil, controle: controlePublico(cfg) }).replace(/</g, '\\u003c') + '</script></head>');
  return new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}

/** Importação em massa (só dono): usuários e documentos de um tenant. */
export async function importarSistema(env, b) {
  const tenant = String(b.tenant || '').toLowerCase();
  if (!/^[a-z0-9-]+\.(thayruan|penagrama)\.com\.br$/.test(tenant)) throw new Error('Tenant inválido.');
  let u = 0, d = 0;
  for (const x of b.users || []) {
    const { salt, hash } = await hashSenha(String(x.password));
    await env.DB.prepare('INSERT INTO sys_users(tenant,email,salt,hash,uid,role) VALUES(?,?,?,?,?,?) ON CONFLICT(tenant,email) DO UPDATE SET salt=excluded.salt,hash=excluded.hash,role=excluded.role')
      .bind(tenant, String(x.email).toLowerCase(), salt, hash, x.uid || idNovo(), x.role === 'admin' ? 'admin' : 'user').run(); u++;
  }
  for (const x of b.docs || []) { if (!colOk(x.col) || !idOk(x.id)) continue; await env.DB.prepare('INSERT INTO sys_docs(tenant,col,id,data) VALUES(?,?,?,?) ON CONFLICT(tenant,col,id) DO UPDATE SET data=excluded.data').bind(tenant, x.col, x.id, JSON.stringify(x.data)).run(); d++; }
  return { usuarios: u, docs: d };
}

// Usado pelas rotas do dono (index.js): entrar como a escola, encerrar sessões, registrar ações do dono.
export const tokenParaDono = (env, tenant, u, horas) => emitirToken(env, tenant, u, horas);
export { revogar, auditar };
