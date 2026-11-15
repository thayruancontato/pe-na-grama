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
export async function hashSenha(senha) { const salt = b64u(crypto.getRandomValues(new Uint8Array(16))); return { salt, hash: await pbkdf2(senha, salt) }; }

const hmacKey = (env) => crypto.subtle.importKey('raw', enc.encode(env.SESSION_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
async function emitirToken(env, tenant, u) {
  const corpo = b64u(enc.encode(JSON.stringify({ t: tenant, e: u.email, u: u.uid, r: u.role, x: Date.now() + 12 * 3600e3 })));
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
    if (fl && JSON.parse(fl.data).revogado > d.x - 12 * 3600e3) return null;
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
  if (json.length > 900000) throw new Error('Documento grande demais.');
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
  if (ci.abertas === false) return erro(String(ci.mensagem || 'As inscrições estão fechadas no momento.').slice(0, 300), 403);
  if (!(await dentroDoLimite(env, tenant, 1))) return erro('Esta escola atingiu o limite de matrículas do plano.', 403);
  const ipc = req.headers.get('cf-connecting-ip') || 'x', chave = 'insc:' + tenant + ':' + ipc, desde = Date.now() - 3600e3;
  const f = await env.DB.prepare('SELECT COUNT(*) n FROM tentativas WHERE chave=? AND quando>?').bind(chave, desde).first();
  if (f.n >= 6) return erro('Muitas inscrições deste endereço. Tente de novo em uma hora.', 429);
  const d = corpo && corpo.data;
  const nome = d && d.responsavel && String(d.responsavel.nome || '').trim();
  if (!d || !nome || nome.length < 3 || !Array.isArray(d.alunos) || d.alunos.length < 1 || d.alunos.length > 8) return erro('Dados da inscrição incompletos.');
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

/** Limite de matrículas do plano (definido pelo dono na Central; 0 ou ausente = sem limite). */
async function dentroDoLimite(env, tenant, adicionar) {
  const l = await env.DB.prepare("SELECT data FROM sys_docs WHERE tenant=? AND col='sys_owner' AND id='limites'").bind(tenant).first();
  const max = l ? JSON.parse(l.data).maxMatriculas || 0 : 0;
  if (!max) return true;
  const n = await env.DB.prepare("SELECT COUNT(*) n FROM sys_docs WHERE tenant=? AND col='rumo_ao_esporte_2026_registrations'").bind(tenant).first();
  return n.n + adicionar <= max;
}
async function revogar(env, tenant, email) {
  await env.DB.prepare('INSERT INTO sys_docs(tenant,col,id,data) VALUES(?,?,?,?) ON CONFLICT(tenant,col,id) DO UPDATE SET data=excluded.data').bind(tenant, 'sys_flags', email, JSON.stringify({ revogado: Date.now() })).run();
}
async function auditar(env, tenant, s, acao) {
  const data = { quem: s.email, quando: new Date().toISOString(), acao: String(acao).slice(0, 300) };
  await env.DB.prepare('INSERT INTO sys_docs(tenant,col,id,data) VALUES(?,?,?,?)').bind(tenant, 'auditoria', idNovo(), JSON.stringify(data)).run();
}

// Acesso do responsável (role 'user'): lê só a própria inscrição (pelo e-mail) e coleções de consulta; edita só dados de contato da própria inscrição.
const LEITURA_PAIS = new Set(['rumo_ao_esporte_2026_plans', 'turmas', 'rentals_locations', 'patrocinadores']);
const CAMPO_PROIBIDO = /^(status|financial|contract|approved|role|plan|valor|desconto|discount|origem)/i;
async function portalPais(env, tenant, s, m, partes, corpo) {
  const [, col, id] = partes, REG = 'rumo_ao_esporte_2026_registrations', meu = (d) => String(d && d.responsavel && d.responsavel.email || '').toLowerCase() === s.email;
  if (partes[0] !== 'db' || !colOk(col || '')) return erro('Sem permissão.', 403);
  if (m === 'GET') {
    if (col === REG) {
      if (id) { const x = await env.DB.prepare('SELECT data FROM sys_docs WHERE tenant=? AND col=? AND id=?').bind(tenant, col, id).first(); const d = x && JSON.parse(x.data); return J(d && meu(d) ? { existe: true, data: d } : { existe: false }); }
      const r = await env.DB.prepare('SELECT id,data FROM sys_docs WHERE tenant=? AND col=?').bind(tenant, col).all();
      return J({ docs: (r.results || []).map((x) => ({ id: x.id, data: JSON.parse(x.data) })).filter((x) => meu(x.data)) });
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

/** Rotas /sys/* do tenant (host da escola). */
export async function rotaSistema(req, env, tenant, p) {
  const m = req.method, partes = p.split('/').filter(Boolean).slice(1); // tira "sys"
  let corpo = {}; if (m !== 'GET' && m !== 'DELETE') { try { corpo = await req.json(); } catch { corpo = {}; } }

  if (partes[0] === 'public' && partes[1] === 'patrocinadores' && m === 'GET') {
    const r = await env.DB.prepare("SELECT id,data FROM sys_docs WHERE tenant=? AND col='patrocinadores'").bind(tenant).all();
    const cfg = await env.DB.prepare("SELECT data FROM sys_docs WHERE tenant=? AND col='system_settings' AND id='patrocinadores'").bind(tenant).first();
    const itens = (r.results || []).map((x) => JSON.parse(x.data)).filter((d) => d.ativo !== false).sort((a, b) => (a.ordem || 0) - (b.ordem || 0)).map((d) => ({ nome: d.nome, logo: d.logo, whatsapp: d.whatsapp }));
    return J({ mostrar: cfg ? JSON.parse(cfg.data).mostrar !== false : true, itens });
  }
  if (partes[0] === 'auth') {
    const email = String(corpo.email || '').trim().toLowerCase();
    if (partes[1] === 'login' && m === 'POST') {
      const chave = 'sysfalha:' + tenant + ':' + email, desde = Date.now() - 900000;
      const chaveIp = 'sysip:' + tenant + ':' + (req.headers.get('cf-connecting-ip') || 'x');
      const f = await env.DB.prepare('SELECT COUNT(*) n FROM tentativas WHERE chave=? AND quando>?').bind(chave, desde).first();
      const fi = await env.DB.prepare('SELECT COUNT(*) n FROM tentativas WHERE chave=? AND quando>?').bind(chaveIp, desde).first();
      if (f.n >= 8 || fi.n >= 30) return erro('Muitas tentativas. Espere 15 minutos.', 429);
      const u = await env.DB.prepare('SELECT * FROM sys_users WHERE tenant=? AND email=?').bind(tenant, email).first();
      if (!u || (await pbkdf2(String(corpo.password || ''), u.salt)) !== u.hash) {
        await env.DB.prepare('INSERT INTO tentativas(chave,quando) VALUES(?,?)').bind(chave, Date.now()).run();
        await env.DB.prepare('INSERT INTO tentativas(chave,quando) VALUES(?,?)').bind(chaveIp, Date.now()).run();
        return erro('Credenciais inválidas.', 401);
      }
      await env.DB.prepare('DELETE FROM tentativas WHERE chave=?').bind(chave).run();
      return J({ token: await emitirToken(env, tenant, u), uid: u.uid, email: u.email, role: u.role });
    }
    const s = await lerToken(req, env, tenant);
    if (!s) return erro('Faça login.', 401);
    if (partes[1] === 'me') return J(s);
    if (partes[1] === 'create' && m === 'POST') {
      if (s.role !== 'admin') return erro('Sem permissão.', 403);
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || String(corpo.password || '').length < 6) return erro('E-mail ou senha inválidos (mínimo 6 caracteres).');
      if (await env.DB.prepare('SELECT 1 x FROM sys_users WHERE tenant=? AND email=?').bind(tenant, email).first()) return erro('E-mail já cadastrado.', 409);
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
      if (String(corpo.password || '').length < 6) return erro('Senha muito curta (mínimo 6 caracteres).');
      if (!(await env.DB.prepare('SELECT 1 x FROM sys_users WHERE tenant=? AND email=?').bind(tenant, email).first())) return erro('Usuário não encontrado.', 404);
      const { salt, hash } = await hashSenha(String(corpo.password));
      await env.DB.prepare('UPDATE sys_users SET salt=?,hash=? WHERE tenant=? AND email=?').bind(salt, hash, tenant, email).run();
      await revogar(env, tenant, email); // sessões antigas do usuário caem
      await auditar(env, tenant, s, 'redefiniu a senha de ' + email);
      return J({ ok: true });
    }
    if (partes[1] === 'password' && m === 'POST') {
      if (String(corpo.password || '').length < 6) return erro('Senha muito curta (mínimo 6 caracteres).');
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
    const r = await env.DB.prepare("SELECT col,id,data FROM sys_docs WHERE tenant=? AND NOT (col='system_settings' AND id='whatsapp_evolution') AND substr(col,1,4)<>'sys_'").bind(tenant).all();
    await auditar(env, tenant, s, 'exportou os dados da escola');
    return new Response(JSON.stringify({ tenant, geradoEm: new Date().toISOString(), docs: (r.results || []).map((x) => ({ col: x.col, id: x.id, data: JSON.parse(x.data) })) }), { headers: { 'content-type': 'application/json; charset=utf-8', 'content-disposition': 'attachment; filename="backup-' + tenant.split('.')[0] + '.json"', 'cache-control': 'no-store' } });
  }

  if (partes[0] === 'import' && m === 'POST') { // importação de alunos (linhas de planilha); entram como pendentes de aprovação
    const s = await lerToken(req, env, tenant);
    if (!s) return erro('Faça login.', 401);
    if (s.role !== 'admin') return erro('Sem permissão.', 403);
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
    if (s.role !== 'admin') return portalPais(env, tenant, s, m, partes, corpo);
    try {
      if (partes[0] === 'batch' && m === 'POST') {
        for (const op of corpo.ops || []) { if (String(op.col).startsWith('sys_')) return erro('Coleção reservada.', 403); await gravar(env, tenant, op); }
        await auditar(env, tenant, s, 'lote: ' + (corpo.ops || []).slice(0, 5).map((o) => `${o.op} ${o.col}/${o.id}`).join('; '));
        return J({ ok: true });
      }
      const [, col, id] = partes;
      if (!colOk(col || '')) return erro('Coleção inválida.');
      if (col.startsWith('sys_')) return erro('Coleção reservada.', 403); // flags de sessão e limites do plano (só o dono mexe)
      if (col === 'system_settings' && id === 'whatsapp_evolution') return erro('Use as rotas de WhatsApp.', 403);
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
const LOGOS = new Set(['/rumo-ao-esporte-logo.png', '/logo-dashboard.png', '/real-logo-transparente.svg', '/escola/pwa/icon-192.png', '/escola/pwa/icon-512.png']);
const PNG_VAZIO = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const attr = (x) => String(x).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function marcaDaEscola(env, host) {
  const c = await env.DB.prepare('SELECT escola, lead_id FROM clientes WHERE url_sistema=?').bind('https://' + host).first();
  if (!c) return null;
  const l = c.lead_id ? await env.DB.prepare('SELECT logo FROM leads WHERE id=?').bind(c.lead_id).first() : null;
  return { nome: c.escola, logo: l && l.logo ? l.logo : '' };
}
// Sem logo enviada, um selo com as iniciais da escola (SVG serve em qualquer <img>).
function selo(nome) {
  const ini = String(nome).split(/\s+/).filter((w) => w.length > 2).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || String(nome)[0] || 'E';
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" rx="36" fill="#17428f"/><circle cx="100" cy="100" r="74" fill="none" stroke="#00a63a" stroke-width="10"/><text x="100" y="124" text-anchor="middle" font-family="Arial,sans-serif" font-weight="800" font-size="72" fill="#fff">' + attr(ini) + '</text></svg>';
}

/** Entrega o sistema (SPA) já compilado em /escola/ para o host da escola, com a marca dela. */
export async function servirSistema(req, env, p, host) {
  const r = await servirSistemaBase(req, env, p, host), h = new Headers(r.headers);
  if ((h.get('content-type') || '').includes('text/html')) h.set('content-security-policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: blob: https:; font-src 'self' data: https:; connect-src 'self' https:; frame-src 'self' https:; object-src 'none'; base-uri 'self'; frame-ancestors 'self'");
  h.set('x-content-type-options', 'nosniff'); h.set('x-frame-options', 'SAMEORIGIN'); h.set('referrer-policy', 'same-origin');
  h.set('strict-transport-security', 'max-age=31536000'); h.set('permissions-policy', 'camera=(self), microphone=(), geolocation=()');
  return new Response(r.body, { status: r.status, statusText: r.statusText, headers: h });
}
async function servirSistemaBase(req, env, p, host) {
  // Sem PWA offline neste sistema: um service worker que se desinstala limpa qualquer versão antiga do navegador.
  if (p === '/sw.js') return new Response("self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(self.registration.unregister().then(()=>caches.keys()).then(k=>Promise.all(k.map(x=>caches.delete(x))))));", { headers: { 'content-type': 'text/javascript', 'cache-control': 'no-store' } });
  if (p === '/assinatura-associacao.png' || p === '/escola/assinatura-associacao.png') return new Response(Uint8Array.from(atob(PNG_VAZIO), (ch) => ch.charCodeAt(0)), { headers: { 'content-type': 'image/png', 'cache-control': 'no-cache' } }); // sem assinatura da escola antiga
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
  html = html.replace('</head>', '<script>window.__MARCA__=' + JSON.stringify({ nome: m.nome }).replace(/</g, '\\u003c') + '</script></head>');
  return new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}

/** Importação em massa (só dono): usuários e documentos de um tenant. */
export async function importarSistema(env, b) {
  const tenant = String(b.tenant || '').toLowerCase();
  if (!/^[a-z0-9-]+\.thayruan\.com\.br$/.test(tenant)) throw new Error('Tenant inválido.');
  let u = 0, d = 0;
  for (const x of b.users || []) {
    const { salt, hash } = await hashSenha(String(x.password));
    await env.DB.prepare('INSERT INTO sys_users(tenant,email,salt,hash,uid,role) VALUES(?,?,?,?,?,?) ON CONFLICT(tenant,email) DO UPDATE SET salt=excluded.salt,hash=excluded.hash,role=excluded.role')
      .bind(tenant, String(x.email).toLowerCase(), salt, hash, x.uid || idNovo(), x.role === 'admin' ? 'admin' : 'user').run(); u++;
  }
  for (const x of b.docs || []) { if (!colOk(x.col) || !idOk(x.id)) continue; await env.DB.prepare('INSERT INTO sys_docs(tenant,col,id,data) VALUES(?,?,?,?) ON CONFLICT(tenant,col,id) DO UPDATE SET data=excluded.data').bind(tenant, x.col, x.id, JSON.stringify(x.data)).run(); d++; }
  return { usuarios: u, docs: d };
}
