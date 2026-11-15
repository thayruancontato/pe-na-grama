import { rotaSistema, servirSistema, importarSistema } from './sistema.js';
// Worker do Pé na Grama: recebe os pedidos do formulário, gera proposta e contrato, cobra por Pix e alimenta a Central do dono.
// Tudo no mesmo domínio: /api/* cai aqui; o resto é servido como arquivo estático.

import { SCHEMA } from './schema.js';

const DEFAULT_CONTRATO = `CONTRATO DE ASSINATURA DO SISTEMA PÉ NA GRAMA

CONTRATADA: {{empresa}}{{doc_empresa}}.
CONTRATANTE: {{escola}}, representada por {{assinante}}.

1. OBJETO
A CONTRATADA concede à CONTRATANTE o direito de uso do sistema de gestão para escolas de esporte Pé na Grama (cadastro de alunos, turmas, cobranças, mensagens por WhatsApp e demais módulos do plano), acessado pela internet, durante a vigência deste contrato.

2. PLANO E PREÇO
Plano: {{plano}}. Mensalidade: {{mensal}}. Implantação (cobrada uma vez, junto da primeira fatura): {{implantacao}}. Vencimento das mensalidades: todo dia {{dia}}.

3. PAGAMENTO
As cobranças são emitidas por fatura com Pix. O não pagamento até o vencimento pode levar à suspensão do acesso após aviso à CONTRATANTE.

4. IMPLANTAÇÃO E SUPORTE
A CONTRATADA configura a conta da CONTRATANTE, o nome e a identidade visual da escola e orienta a conexão do WhatsApp e do Pix. O suporte é prestado pelos canais informados pela CONTRATADA.

5. DADOS E PRIVACIDADE
Os dados de alunos e responsáveis cadastrados pertencem à CONTRATANTE, que responde pela base legal de seu uso. A CONTRATADA trata esses dados somente para prestar o serviço e conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018).

6. VIGÊNCIA E CANCELAMENTO
O contrato vigora por prazo indeterminado, a partir da data da assinatura. Qualquer das partes pode cancelar mediante aviso por escrito; a mensalidade do mês em curso permanece devida.

7. ACEITE
Ao assinar eletronicamente, a CONTRATANTE declara que leu e concorda com estes termos. O registro da assinatura guarda nome, documento, data, hora e endereço de acesso.

Local e data: {{data}}.`;

const J = (d, status = 200, h = {}) => new Response(JSON.stringify(d), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...h } });
// ---------- subdomínio de cada escola (<nome>.thayruan.com.br) ----------
const DOMINIO = 'thayruan.com.br';
const RESERVADOS = new Set(['esporte', 'www', 'admin', 'api', 'mail', 'ftp', 'app', 'painel', 'webmail']);
const slugify = (x) => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '');
async function novoSubdominio(env, escola) {
  const base = slugify(escola) || 'escola';
  for (let i = 1; i < 50; i++) {
    const sl = i === 1 ? base : base + '-' + i;
    if (RESERVADOS.has(sl)) continue;
    const u = 'https://' + sl + '.' + DOMINIO;
    if (!(await env.DB.prepare('SELECT 1 x FROM clientes WHERE url_sistema=?').bind(u).first())) return u;
  }
  return 'https://escola-' + Date.now().toString(36) + '.' + DOMINIO;
}
const escHtml = (x) => String(x == null ? '' : x).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SITUACAO = { implantando: ['Implantando', 'Estamos preparando o sistema da sua escola. Este endereço já é o definitivo e o painel será liberado aqui assim que a implantação terminar.'], ativo: ['Ativo', 'O sistema da escola está ativo neste endereço.'], pausado: ['Pausado', 'O sistema desta escola está temporariamente pausado.'], cancelado: ['Encerrado', 'O contrato desta escola foi encerrado.'] };
async function paginaEscola(req, env, host, p) {
  if (p.startsWith('/ds/') || p.startsWith('/assets/')) return env.ASSETS.fetch(req);
  const c = await env.DB.prepare('SELECT escola,status,plano_nome FROM clientes WHERE url_sistema=?').bind('https://' + host).first();
  const [tag, texto] = c ? (SITUACAO[c.status] || SITUACAO.implantando) : ['', ''];
  const corpo = c
    ? '<span class="pg-badge ok">' + escHtml(tag) + '</span><h1>' + escHtml(c.escola) + '</h1><p>' + escHtml(texto) + '</p><small>Sistema Pé na Grama · ' + escHtml(host) + '</small>'
    : '<h1>Endereço não encontrado</h1><p>Nenhuma escola usa este endereço.</p>';
  const html = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>' + escHtml(c ? c.escola : 'Pé na Grama') + '</title><link rel="stylesheet" href="/ds/tokens.css"><link rel="stylesheet" href="/ds/components.css"><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg,#f4f7fc);font-family:Lato,system-ui,sans-serif;color:#1c2b4a}main{max-width:520px;margin:24px;padding:36px 28px;background:#fff;border:1px solid #e3e8f2;border-radius:16px;text-align:center}h1{margin:14px 0 8px;font-size:1.6rem;color:#17428f}p{margin:0 0 18px;line-height:1.55;color:#4a5875}small{color:#7a859c}</style></head><body><main>' + corpo + '</main></body></html>';
  return new Response(html, { status: c ? 200 : 404, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}

const erro = (msg, status = 400) => J({ erro: msg }, status);
const agora = () => new Date().toISOString();
const tz = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const somaDias = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const somaMes = (ym, n) => { const [y, m] = ym.split('-').map(Number), d = new Date(Date.UTC(y, m - 1 + n, 1)); return d.toISOString().slice(0, 7); };
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const token = (n = 24) => hex(crypto.getRandomValues(new Uint8Array(n)));
const txt = (v, max = 200) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max);
const int = (v, def = 0) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? n : def; };
const ip = req => req.headers.get('cf-connecting-ip') || '';
const brl = c => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBr = iso => iso ? iso.slice(0, 10).split('-').reverse().join('/') : '';

async function sha256(s) { return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))); }
async function hmac(key, msg) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg)));
}
const iguais = async (a, b) => (await sha256(a)) === (await sha256(b)); // compara hashes: tempo não depende de onde o texto difere

// ---------- sessão do dono ----------
async function criarSessao(env) { const exp = Math.floor(Date.now() / 1000) + 12 * 3600; return exp + '.' + await hmac(env.SESSION_SECRET, 'sessao:' + exp); }
async function sessaoValida(req, env) {
  const c = (req.headers.get('cookie') || '').split(/;\s*/).find(x => x.startsWith('pg_admin='));
  if (!c || !env.SESSION_SECRET) return false;
  const [exp, sig] = c.slice(9).split('.');
  if (!exp || !sig || Number(exp) < Date.now() / 1000) return false;
  return sig === await hmac(env.SESSION_SECRET, 'sessao:' + exp);
}
async function limite(env, chave, max, janelaSeg) {
  const desde = Date.now() - janelaSeg * 1000;
  const r = await env.DB.prepare('SELECT COUNT(*) n FROM tentativas WHERE chave=? AND quando>?').bind(chave, desde).first();
  if (r.n >= max) return false;
  await env.DB.prepare('INSERT INTO tentativas(chave,quando) VALUES(?,?)').bind(chave, Date.now()).run();
  await env.DB.prepare('DELETE FROM tentativas WHERE quando<?').bind(Date.now() - 86400000).run();
  return true;
}
const log = (env, tipo, texto) => env.DB.prepare('INSERT INTO atividade(quando,tipo,texto) VALUES(?,?,?)').bind(agora(), tipo, texto).run();

// ---------- configurações ----------
async function config(env) {
  const { results } = await env.DB.prepare('SELECT k,v FROM settings').all();
  const c = Object.fromEntries(results.map(r => [r.k, r.v]));
  return { empresa_nome: 'Pé na Grama', empresa_doc: '', empresa_email: '', empresa_whats: '', pix_chave: '', pix_nome: '', pix_cidade: '', dia_venc_padrao: '10', contrato_texto: DEFAULT_CONTRATO, ...c };
}
const CONFIG_CHAVES = ['empresa_nome', 'empresa_doc', 'empresa_email', 'empresa_whats', 'pix_chave', 'pix_nome', 'pix_cidade', 'dia_venc_padrao', 'contrato_texto'];

// ---------- Pix estático (BR Code) ----------
function crc16(s) { let c = 0xFFFF; for (let i = 0; i < s.length; i++) { c ^= s.charCodeAt(i) << 8; for (let j = 0; j < 8; j++) c = (c & 0x8000) ? ((c << 1) ^ 0x1021) & 0xFFFF : (c << 1) & 0xFFFF; } return c.toString(16).toUpperCase().padStart(4, '0'); }
const tlv = (id, v) => id + String(v.length).padStart(2, '0') + v;
const ascii = (s, n) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 .\-]/g, '').toUpperCase().slice(0, n) || 'NA';
function pixPayload(c, valorCentavos, idCobranca) {
  if (!c.pix_chave) return null;
  const conta = tlv('00', 'br.gov.bcb.pix') + tlv('01', c.pix_chave.trim());
  let p = tlv('00', '01') + tlv('26', conta) + tlv('52', '0000') + tlv('53', '986') + tlv('54', (valorCentavos / 100).toFixed(2)) + tlv('58', 'BR') + tlv('59', ascii(c.pix_nome || c.empresa_nome, 25)) + tlv('60', ascii(c.pix_cidade || 'BRASIL', 15)) + tlv('62', tlv('05', ascii(String(idCobranca), 25).replace(/ /g, '') || '***')) + '6304';
  return p + crc16(p);
}

// ---------- validações ----------
function docValido(d) {
  d = d.replace(/\D/g, '');
  if (/^(\d)\1+$/.test(d)) return false;
  if (d.length === 11) { const dv = n => { let s = 0; for (let i = 0; i < n; i++) s += +d[i] * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; }; return dv(9) === +d[9] && dv(10) === +d[10]; }
  if (d.length === 14) { const dv = n => { const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]; let s = 0; for (let i = 0; i < n; i++) s += +d[i] * pesos[i]; const r = s % 11; return r < 2 ? 0 : 11 - r; }; return dv(12) === +d[12] && dv(13) === +d[13]; }
  return false;
}
const preencher = (t, v) => t.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in v ? v[k] : m));

// ---------- clientes e faturas ----------
async function criarFatura(env, { cliente_id, descricao, competencia = null, valor, vencimento }) {
  const t = token(16);
  const r = await env.DB.prepare('INSERT INTO faturas(token,cliente_id,descricao,competencia,valor,vencimento,status,criado) VALUES(?,?,?,?,?,?,?,?)').bind(t, cliente_id, descricao, competencia, valor, vencimento, 'aberta', agora()).run();
  return { id: r.meta.last_row_id, token: t };
}
function vencimentoDe(ym, dia) { return ym + '-' + String(Math.min(Math.max(dia, 1), 28)).padStart(2, '0'); }

async function gerarMensais(env) {
  const hoje = tz(); let criadas = 0;
  const { results } = await env.DB.prepare("SELECT * FROM clientes WHERE status IN ('ativo','implantando') AND mensal>0").all();
  for (const c of results) {
    const ult = await env.DB.prepare('SELECT MAX(competencia) m FROM faturas WHERE cliente_id=? AND competencia IS NOT NULL AND status<>\'cancelada\'').bind(c.id).first();
    const prox = ult && ult.m ? somaMes(ult.m, 1) : hoje.slice(0, 7);
    const venc = vencimentoDe(prox, c.dia_venc);
    if (somaDias(venc, -7) <= hoje) { await criarFatura(env, { cliente_id: c.id, descricao: 'Mensalidade ' + prox.slice(5) + '/' + prox.slice(0, 4), competencia: prox, valor: c.mensal, vencimento: venc }); criadas++; }
  }
  if (criadas) await log(env, 'fatura', criadas + ' mensalidade(s) gerada(s)');
  return criadas;
}

// Sem tarefa agendada (o plano gratuito da conta já usa as 5 permitidas): gera as mensalidades no máximo uma vez por dia,
// quando alguém abre o painel do dono ou uma fatura.
async function geracaoDiaria(env) {
  const hoje = tz(), r = await env.DB.prepare("SELECT v FROM settings WHERE k='ultima_geracao'").first();
  if (r && r.v === hoje) return;
  await env.DB.prepare("INSERT INTO settings(k,v) VALUES('ultima_geracao',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v").bind(hoje).run();
  await gerarMensais(env);
}

// ---------- rotas públicas ----------
async function postLead(req, env) {
  let b; try { b = await req.json(); } catch { return erro('Corpo inválido.'); }
  if (b.site) return J({ ok: true });                                   // campo-isca: robô
  const escola = txt(b.escola, 120), nome = txt(b.contato_nome, 120), tel = txt(b.contato_tel, 30).replace(/[^\d()+\- ]/g, '');
  if (!escola) return erro('Informe o nome da escola.');
  if (nome.length < 2) return erro('Informe seu nome.');
  if (tel.replace(/\D/g, '').length < 10) return erro('Informe um WhatsApp com DDD.');
  if (!(await limite(env, 'lead:' + ip(req), 8, 3600))) return erro('Muitas tentativas. Tente de novo em instantes.', 429);
  const cfg = JSON.stringify(b.config && typeof b.config === 'object' ? b.config : {});
  if (cfg.length > 40000) return erro('Dados grandes demais.');
  const logo = typeof b.logo === 'string' && /^data:image\/(png|jpeg|webp);base64,/.test(b.logo) && b.logo.length < 700000 ? b.logo : '';
  const r = await env.DB.prepare('INSERT INTO leads(criado,escola,cidade,uf,contato_nome,contato_tel,contato_email,config,logo,ip) VALUES(?,?,?,?,?,?,?,?,?,?)')
    .bind(agora(), escola, txt(b.cidade, 80), txt(b.uf, 2), nome, tel, txt(b.contato_email, 120), cfg, logo, ip(req)).run();
  await log(env, 'lead', 'Novo pedido de teste: ' + escola);
  return J({ ok: true, id: r.meta.last_row_id });
}

async function getContrato(env, t) {
  const c = await env.DB.prepare('SELECT * FROM contratos WHERE token=?').bind(t).first();
  if (!c) return erro('Contrato não encontrado.', 404);
  const cfg = await config(env), l = c.lead_id ? await env.DB.prepare('SELECT contato_nome FROM leads WHERE id=?').bind(c.lead_id).first() : null;
  let fatura = null;
  if (c.status === 'assinado' && c.cliente_id) { const f = await env.DB.prepare("SELECT token FROM faturas WHERE cliente_id=? AND status<>'cancelada' ORDER BY id LIMIT 1").bind(c.cliente_id).first(); fatura = f && f.token; }
  return J({ escola: c.escola, plano: c.plano_nome, mensal: c.mensal, implantacao: c.implantacao, dia: c.dia_venc, texto: c.texto, status: c.status, assinado_em: c.assinado_em, assinante: c.ass_nome, sugestao_nome: l ? l.contato_nome : '', empresa: cfg.empresa_nome, fatura });
}

async function assinar(req, env, t) {
  let b; try { b = await req.json(); } catch { return erro('Corpo inválido.'); }
  const c = await env.DB.prepare('SELECT * FROM contratos WHERE token=?').bind(t).first();
  if (!c) return erro('Contrato não encontrado.', 404);
  if (c.status === 'assinado') return erro('Este contrato já foi assinado.', 409);
  if (c.status !== 'enviado') return erro('Este contrato não está mais disponível.', 410);
  const nome = txt(b.nome, 120), doc = txt(b.documento, 20);
  if (nome.length < 3) return erro('Informe o nome completo de quem assina.');
  if (!docValido(doc)) return erro('CPF ou CNPJ inválido. Confira os números.');
  if (b.aceito !== true) return erro('É preciso aceitar os termos para assinar.');
  if (!(await limite(env, 'ass:' + t, 6, 3600))) return erro('Muitas tentativas.', 429);
  const quando = agora(), ass_ip = ip(req), ua = txt(req.headers.get('user-agent'), 200);
  const h = await sha256([c.texto, nome, doc.replace(/\D/g, ''), quando, ass_ip].join('|'));
  const lead = c.lead_id ? await env.DB.prepare('SELECT * FROM leads WHERE id=?').bind(c.lead_id).first() : null;
  const cli = await env.DB.prepare('INSERT INTO clientes(lead_id,contrato_id,escola,contato_nome,contato_tel,contato_email,plano_nome,mensal,dia_venc,status,criado) VALUES(?,?,?,?,?,?,?,?,?,?,?)')
    .bind(c.lead_id, c.id, c.escola, lead ? lead.contato_nome : nome, lead ? lead.contato_tel : '', lead ? lead.contato_email : '', c.plano_nome, c.mensal, c.dia_venc, 'implantando', quando).run();
  const cid = cli.meta.last_row_id, hoje = tz(), ym = hoje.slice(0, 7);
  await env.DB.prepare('UPDATE clientes SET url_sistema=? WHERE id=?').bind(await novoSubdominio(env, c.escola), cid).run();
  await env.DB.prepare('UPDATE contratos SET status=?,assinado_em=?,ass_nome=?,ass_doc=?,ass_ip=?,ass_ua=?,ass_hash=?,cliente_id=? WHERE id=?').bind('assinado', quando, nome, doc, ass_ip, ua, h, cid, c.id).run();
  if (c.lead_id) await env.DB.prepare("UPDATE leads SET status='contratado' WHERE id=?").bind(c.lead_id).run();
  const valor = c.mensal + c.implantacao;
  const desc = (c.implantacao > 0 ? 'Implantação + ' : '') + 'Mensalidade ' + ym.slice(5) + '/' + ym.slice(0, 4);
  const f = valor > 0 ? await criarFatura(env, { cliente_id: cid, descricao: desc, competencia: ym, valor, vencimento: somaDias(hoje, 3) }) : null;
  await log(env, 'contrato', c.escola + ' assinou o contrato (' + nome + ')');
  return J({ ok: true, fatura: f && f.token });
}

async function getFatura(env, t) {
  await geracaoDiaria(env);
  const f = await env.DB.prepare('SELECT f.*, c.escola FROM faturas f JOIN clientes c ON c.id=f.cliente_id WHERE f.token=?').bind(t).first();
  if (!f) return erro('Fatura não encontrada.', 404);
  const cfg = await config(env), hoje = tz();
  const aberta = f.status === 'aberta' || f.status === 'informada';
  return J({ escola: f.escola, descricao: f.descricao, valor: f.valor, vencimento: f.vencimento, status: f.status, atrasada: aberta && f.vencimento < hoje, pago_em: f.pago_em,
    pix: aberta ? { payload: pixPayload(cfg, f.valor, 'PG' + f.id), chave: cfg.pix_chave || '', nome: cfg.pix_nome || cfg.empresa_nome } : null,
    empresa: cfg.empresa_nome, whats: cfg.empresa_whats });
}
async function paguei(env, t, req) {
  const f = await env.DB.prepare('SELECT f.*, c.escola FROM faturas f JOIN clientes c ON c.id=f.cliente_id WHERE f.token=?').bind(t).first();
  if (!f) return erro('Fatura não encontrada.', 404);
  if (f.status !== 'aberta') return J({ ok: true, status: f.status });
  if (!(await limite(env, 'pg:' + t, 5, 3600))) return erro('Muitas tentativas.', 429);
  await env.DB.prepare("UPDATE faturas SET status='informada',informado_em=? WHERE id=?").bind(agora(), f.id).run();
  await log(env, 'fatura', f.escola + ' informou o pagamento de ' + brl(f.valor));
  return J({ ok: true, status: 'informada' });
}

// ---------- rotas do dono ----------
async function resumo(env, mesPedido) {
  await geracaoDiaria(env);
  const hoje = tz(), mesHoje = hoje.slice(0, 7), mes = /^\d{4}-(0[1-9]|1[0-2])$/.test(mesPedido || '') ? mesPedido : mesHoje;
  const ini = mes + '-01', fim = somaMes(mes, 1) + '-01', agoraMs = Date.now(), iso = ms => new Date(ms).toISOString();
  const Q = (sql, ...b) => env.DB.prepare(sql).bind(...b);
  const [leads, clientes, aReceber, recMes, atras, serie, ativ, prevMes, leadsMes, propMes, assMes, cliMes, mrrAnt, porPlano, funilProp, funilAss, tempo, novos, paradas, informadas, atrasadas, vencendo, impl, ultimos] = await Promise.all([
    Q('SELECT status, COUNT(*) n FROM leads GROUP BY status').all(),
    Q('SELECT status, COUNT(*) n, COALESCE(SUM(mensal),0) mrr FROM clientes GROUP BY status').all(),
    Q("SELECT COALESCE(SUM(valor),0) v, COUNT(*) n FROM faturas WHERE status IN ('aberta','informada') AND vencimento>=?").bind(hoje).first(),
    Q("SELECT COALESCE(SUM(valor),0) v, COUNT(*) n FROM faturas WHERE status='paga' AND substr(pago_em,1,7)=?").bind(mes).first(),
    Q("SELECT COALESCE(SUM(valor),0) v, COUNT(*) n FROM faturas WHERE status IN ('aberta','informada') AND vencimento<?").bind(hoje).first(),
    Q("SELECT substr(pago_em,1,7) m, SUM(valor) v, COUNT(*) n FROM faturas WHERE status='paga' AND pago_em>=? GROUP BY m ORDER BY m").bind(somaMes(mes, -11) + '-01').all(),
    Q('SELECT quando,tipo,texto FROM atividade ORDER BY id DESC LIMIT 14').all(),
    Q("SELECT COALESCE(SUM(valor),0) v, COUNT(*) n FROM faturas WHERE status<>'cancelada' AND substr(vencimento,1,7)=?").bind(mes).first(),
    Q('SELECT COUNT(*) n FROM leads WHERE substr(criado,1,7)=?').bind(mes).first(),
    Q('SELECT COUNT(*) n FROM contratos WHERE substr(criado,1,7)=?').bind(mes).first(),
    Q("SELECT COUNT(*) n FROM contratos WHERE status='assinado' AND substr(assinado_em,1,7)=?").bind(mes).first(),
    Q('SELECT COUNT(*) n, COALESCE(SUM(mensal),0) mrr FROM clientes WHERE substr(criado,1,7)=?').bind(mes).first(),
    Q("SELECT COALESCE(SUM(mensal),0) mrr FROM clientes WHERE criado<? AND status<>'cancelado'").bind(ini).first(),
    Q("SELECT plano_nome nome, COUNT(*) n, SUM(mensal) mrr FROM clientes WHERE status IN ('ativo','implantando') GROUP BY plano_nome ORDER BY mrr DESC").all(),
    Q('SELECT COUNT(DISTINCT lead_id) n FROM contratos WHERE lead_id IS NOT NULL').first(),
    Q("SELECT COUNT(DISTINCT lead_id) n FROM contratos WHERE lead_id IS NOT NULL AND status='assinado'").first(),
    Q("SELECT AVG(julianday(c.assinado_em)-julianday(l.criado)) d FROM contratos c JOIN leads l ON l.id=c.lead_id WHERE c.status='assinado'").first(),
    Q("SELECT id,escola,criado FROM leads WHERE status='novo' ORDER BY id LIMIT 6").all(),
    Q("SELECT lead_id,escola,criado FROM contratos WHERE status='enviado' AND criado<? ORDER BY id LIMIT 6").bind(iso(agoraMs - 2 * 864e5)).all(),
    Q("SELECT f.id,f.descricao,f.valor,c.escola FROM faturas f JOIN clientes c ON c.id=f.cliente_id WHERE f.status='informada' ORDER BY f.id LIMIT 6").all(),
    Q("SELECT f.id,f.descricao,f.valor,f.vencimento,c.escola FROM faturas f JOIN clientes c ON c.id=f.cliente_id WHERE f.status IN ('aberta','informada') AND f.vencimento<? ORDER BY f.vencimento LIMIT 6").bind(hoje).all(),
    Q("SELECT f.id,f.descricao,f.valor,f.vencimento,c.escola FROM faturas f JOIN clientes c ON c.id=f.cliente_id WHERE f.status='aberta' AND f.vencimento>=? AND f.vencimento<=? ORDER BY f.vencimento LIMIT 8").bind(hoje, somaDias(hoje, 7)).all(),
    Q("SELECT id,escola,criado FROM clientes WHERE status='implantando' AND criado<? ORDER BY id LIMIT 6").bind(iso(agoraMs - 7 * 864e5)).all(),
    Q('SELECT id,escola,contato_nome,criado,status FROM leads ORDER BY id DESC LIMIT 6').all(),
  ]);
  const L = Object.fromEntries(leads.results.map(r => [r.status, r.n])), C = Object.fromEntries(clientes.results.map(r => [r.status, r]));
  const totalLeads = Object.values(L).reduce((x, y) => x + y, 0);
  const ativos = (C.ativo || {}).n || 0, mrr = ((C.ativo || {}).mrr || 0) + ((C.implantando || {}).mrr || 0);
  const meses = []; for (let i = 11; i >= 0; i--) { const m = somaMes(mes, -i), r = serie.results.find(x => x.m === m); meses.push({ mes: m, valor: r ? r.v : 0, n: r ? r.n : 0 }); }
  const dias = ms => Math.max(0, Math.floor((agoraMs - new Date(ms).getTime()) / 864e5));
  const atencao = [];
  if (informadas.results.length) atencao.push({ tipo: 'informada', nivel: 'info', titulo: 'Confira o pagamento na sua conta', itens: informadas.results.map(f => ({ texto: f.escola, detalhe: f.descricao + ' · ' + brl(f.valor) + ' informado pelo cliente', rota: '#/faturas?f=informada' })) });
  if (atrasadas.results.length) atencao.push({ tipo: 'atrasada', nivel: 'bad', titulo: 'Faturas atrasadas', itens: atrasadas.results.map(f => ({ texto: f.escola, detalhe: f.descricao + ' · ' + brl(f.valor) + ' · venceu ' + dataBr(f.vencimento), rota: '#/faturas?f=atrasada' })) });
  if (novos.results.length) atencao.push({ tipo: 'novo', nivel: 'info', titulo: 'Pedidos novos sem resposta', itens: novos.results.map(l => ({ texto: l.escola, detalhe: dias(l.criado) ? 'chegou há ' + dias(l.criado) + ' dia(s)' : 'chegou hoje', rota: '#/pedidos?abrir=' + l.id })) });
  if (paradas.results.length) atencao.push({ tipo: 'proposta', nivel: 'warn', titulo: 'Propostas esperando assinatura há mais de 2 dias', itens: paradas.results.map(c => ({ texto: c.escola, detalhe: 'enviada há ' + dias(c.criado) + ' dia(s)', rota: c.lead_id ? '#/pedidos?abrir=' + c.lead_id : '#/contratos' })) });
  if (impl.results.length) atencao.push({ tipo: 'implantacao', nivel: 'warn', titulo: 'Implantações paradas há mais de 7 dias', itens: impl.results.map(c => ({ texto: c.escola, detalhe: 'contratou há ' + dias(c.criado) + ' dia(s) e ainda não está ativa', rota: '#/clientes?abrir=' + c.id })) });
  return J({
    mes, mes_atual: mesHoje,
    leads: { total: totalLeads, novo: L.novo || 0, proposta: L.proposta || 0, contratado: L.contratado || 0, perdido: L.perdido || 0 },
    clientes: { ativo: ativos, implantando: (C.implantando || {}).n || 0, cancelado: (C.cancelado || {}).n || 0 },
    mrr, mrr_ativo: (C.ativo || {}).mrr || 0, mrr_anterior: mrrAnt.mrr, arr: mrr * 12, ticket: ativos + ((C.implantando || {}).n || 0) ? Math.round(mrr / (ativos + ((C.implantando || {}).n || 0))) : 0,
    a_receber: { valor: aReceber.v, n: aReceber.n }, recebido_mes: { valor: recMes.v, n: recMes.n }, atrasado: { valor: atras.v, n: atras.n },
    previsto_mes: { valor: prevMes.v, n: prevMes.n },
    periodo: { pedidos: leadsMes.n, propostas: propMes.n, assinados: assMes.n, clientes_novos: cliMes.n, mrr_novo: cliMes.mrr },
    conversao: totalLeads ? Math.round(((L.contratado || 0) / totalLeads) * 100) : 0,
    funil: { pedidos: totalLeads, propostas: funilProp.n, assinados: funilAss.n, dias_ate_assinar: tempo.d == null ? null : Math.round(tempo.d * 10) / 10 },
    receita_meses: meses, por_plano: porPlano.results, atencao,
    vencendo: vencendo.results.map(f => ({ id: f.id, escola: f.escola, descricao: f.descricao, valor: f.valor, vencimento: f.vencimento })),
    ultimos_pedidos: ultimos.results, atividade: ativ.results,
  });
}

async function rotaAdmin(req, env, url, caminho) {
  const m = req.method, P = caminho.split('/').filter(Boolean); // ['admin', recurso, id, acao]
  const rec = P[1], id = P[2] && /^\d+$/.test(P[2]) ? Number(P[2]) : null, acao = P[3];
  const body = async () => { try { return await req.json(); } catch { return {}; } };

  if (rec === 'resumo' && m === 'GET') return resumo(env, url.searchParams.get('mes'));
  if (rec === 'sys-import' && m === 'POST') { try { return J(await importarSistema(env, await body())); } catch (e) { return erro(e.message); } }

  if (rec === 'leads') {
    if (!id && m === 'GET') {
      const st = url.searchParams.get('status');
      const q = st ? env.DB.prepare('SELECT id,criado,status,escola,cidade,uf,contato_nome,contato_tel,contato_email,config FROM leads WHERE status=? ORDER BY id DESC LIMIT 300').bind(st) : env.DB.prepare('SELECT id,criado,status,escola,cidade,uf,contato_nome,contato_tel,contato_email,config FROM leads ORDER BY id DESC LIMIT 300');
      const { results } = await q.all(); return J(results.map(r => ({ ...r, config: undefined, resumo: resumoLead(r.config) })));
    }
    if (id && !acao && m === 'GET') {
      const l = await env.DB.prepare('SELECT * FROM leads WHERE id=?').bind(id).first(); if (!l) return erro('Pedido não encontrado.', 404);
      const cs = await env.DB.prepare('SELECT id,token,status,plano_nome,mensal,implantacao,criado,assinado_em FROM contratos WHERE lead_id=? ORDER BY id DESC').bind(id).all();
      return J({ ...l, config: JSON.parse(l.config || '{}'), contratos: cs.results });
    }
    if (id && !acao && m === 'PATCH') {
      const b = await body(), campos = [], vals = [];
      if (['novo', 'proposta', 'contratado', 'perdido'].includes(b.status)) { campos.push('status=?'); vals.push(b.status); }
      if (typeof b.notas === 'string') { campos.push('notas=?'); vals.push(txt(b.notas, 4000)); }
      if (!campos.length) return erro('Nada para alterar.');
      await env.DB.prepare('UPDATE leads SET ' + campos.join(',') + ' WHERE id=?').bind(...vals, id).run(); return J({ ok: true });
    }
    if (id && !acao && m === 'DELETE') {
      const l = await env.DB.prepare('SELECT escola FROM leads WHERE id=?').bind(id).first(); if (!l) return erro('Pedido não encontrado.', 404);
      const c = await env.DB.prepare('SELECT COUNT(*) n FROM contratos WHERE lead_id=?').bind(id).first();
      if (c.n > 0) return erro('Este pedido já tem contrato. Marque como perdido em vez de excluir.');
      await env.DB.prepare('DELETE FROM leads WHERE id=?').bind(id).run(); await log(env, 'lead', 'Pedido excluído: ' + l.escola); return J({ ok: true });
    }
    if (id && acao === 'proposta' && m === 'POST') {
      const b = await body(), l = await env.DB.prepare('SELECT * FROM leads WHERE id=?').bind(id).first(); if (!l) return erro('Pedido não encontrado.', 404);
      let nomePlano = txt(b.plano_nome, 80), mensal = int(b.mensal), impl = int(b.implantacao);
      if (b.plano_id) { const p = await env.DB.prepare('SELECT * FROM planos WHERE id=?').bind(int(b.plano_id)).first(); if (p) { nomePlano = nomePlano || p.nome; if (b.mensal == null) mensal = p.mensal; if (b.implantacao == null) impl = p.implantacao; } }
      if (!nomePlano) return erro('Escolha um plano ou dê um nome ao plano.');
      if (mensal < 0 || mensal > 5000000 || impl < 0 || impl > 5000000) return erro('Valores fora do limite.');
      const dia = Math.min(Math.max(int(b.dia_venc, 10), 1), 28), cfg = await config(env);
      const texto = preencher(cfg.contrato_texto, { empresa: cfg.empresa_nome, doc_empresa: cfg.empresa_doc ? ' (CNPJ/CPF ' + cfg.empresa_doc + ')' : '', escola: l.escola, assinante: l.contato_nome || 'seu representante legal', plano: nomePlano, mensal: brl(mensal), implantacao: impl ? brl(impl) : 'sem cobrança', dia: String(dia), data: dataBr(tz()) });
      const t = token(), r = await env.DB.prepare('INSERT INTO contratos(token,lead_id,escola,plano_nome,mensal,implantacao,dia_venc,texto,status,criado) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(t, id, l.escola, nomePlano, mensal, impl, dia, texto, 'enviado', agora()).run();
      await env.DB.prepare("UPDATE leads SET status='proposta' WHERE id=? AND status IN ('novo','perdido')").bind(id).run();
      await log(env, 'proposta', 'Proposta criada para ' + l.escola + ' (' + nomePlano + ', ' + brl(mensal) + '/mês)');
      return J({ ok: true, id: r.meta.last_row_id, token: t, link: new URL('/contrato?t=' + t, url).href });
    }
  }

  if (rec === 'contratos' && !id && m === 'GET') {
    const { results } = await env.DB.prepare('SELECT id,token,escola,plano_nome,mensal,implantacao,status,criado,assinado_em,ass_nome,lead_id,cliente_id FROM contratos ORDER BY id DESC LIMIT 300').all();
    return J(results.map(r => ({ ...r, link: new URL('/contrato?t=' + r.token, url).href })));
  }
  if (rec === 'contratos' && id && m === 'GET') { const c = await env.DB.prepare('SELECT * FROM contratos WHERE id=?').bind(id).first(); return c ? J({ ...c, link: new URL('/contrato?t=' + c.token, url).href }) : erro('Contrato não encontrado.', 404); }
  if (rec === 'contratos' && id && m === 'PATCH') {
    const c = await env.DB.prepare('SELECT status FROM contratos WHERE id=?').bind(id).first(); if (!c) return erro('Contrato não encontrado.', 404);
    if (c.status !== 'enviado') return erro('Só dá para cancelar contrato que ainda não foi assinado.');
    await env.DB.prepare("UPDATE contratos SET status='cancelado' WHERE id=?").bind(id).run(); return J({ ok: true });
  }

  if (rec === 'clientes') {
    const hoje = tz();
    if (!id && m === 'GET') {
      const { results } = await env.DB.prepare(`SELECT c.*, (SELECT COUNT(*) FROM faturas f WHERE f.cliente_id=c.id AND f.status IN ('aberta','informada') AND f.vencimento<?) atrasadas,
        (SELECT COALESCE(SUM(valor),0) FROM faturas f WHERE f.cliente_id=c.id AND f.status IN ('aberta','informada') AND f.vencimento<?) valor_atrasado,
        (SELECT MIN(vencimento) FROM faturas f WHERE f.cliente_id=c.id AND f.status IN ('aberta','informada')) proximo FROM clientes c ORDER BY c.id DESC`).bind(hoje, hoje).all();
      return J(results.map(r => ({ ...r, checklist: JSON.parse(r.checklist || '{}') })));
    }
    if (id && m === 'GET') {
      const c = await env.DB.prepare('SELECT * FROM clientes WHERE id=?').bind(id).first(); if (!c) return erro('Cliente não encontrado.', 404);
      const f = await env.DB.prepare('SELECT id,token,descricao,competencia,valor,vencimento,status,pago_em,informado_em FROM faturas WHERE cliente_id=? ORDER BY id DESC').bind(id).all();
      const ct = c.contrato_id ? await env.DB.prepare('SELECT id,token,status,assinado_em,ass_nome,ass_doc,ass_hash,plano_nome,mensal,implantacao FROM contratos WHERE id=?').bind(c.contrato_id).first() : null;
      const l = c.lead_id ? await env.DB.prepare('SELECT config,logo FROM leads WHERE id=?').bind(c.lead_id).first() : null;
      return J({ ...c, checklist: JSON.parse(c.checklist || '{}'), faturas: f.results, contrato: ct, config: l ? JSON.parse(l.config || '{}') : {}, logo: l ? l.logo : '' });
    }
    if (id && m === 'PATCH') {
      const b = await body(), campos = [], vals = [];
      if (['implantando', 'ativo', 'cancelado'].includes(b.status)) { campos.push('status=?'); vals.push(b.status); }
      if (typeof b.url_sistema === 'string') { campos.push('url_sistema=?'); vals.push(txt(b.url_sistema, 200)); }
      if (typeof b.notas === 'string') { campos.push('notas=?'); vals.push(txt(b.notas, 4000)); }
      if (b.checklist && typeof b.checklist === 'object') { campos.push('checklist=?'); vals.push(JSON.stringify(Object.fromEntries(Object.entries(b.checklist).slice(0, 20).map(([k, v]) => [txt(k, 40), !!v])))); }
      if (b.mensal != null) { campos.push('mensal=?'); vals.push(Math.max(0, int(b.mensal))); }
      if (b.dia_venc != null) { campos.push('dia_venc=?'); vals.push(Math.min(Math.max(int(b.dia_venc, 10), 1), 28)); }
      // logo da escola (PNG/JPEG/WebP em data URL) fica no pedido de origem e é usada no sistema dela
      let logoTrocada = false;
      if (typeof b.logo === 'string' && /^data:image\/(png|jpeg|webp);base64,/.test(b.logo) && b.logo.length < 700000) {
        const c = await env.DB.prepare('SELECT lead_id FROM clientes WHERE id=?').bind(id).first();
        if (c && c.lead_id) { await env.DB.prepare('UPDATE leads SET logo=? WHERE id=?').bind(b.logo, c.lead_id).run(); logoTrocada = true; }
      }
      if (!campos.length && !logoTrocada) return erro('Nada para alterar.');
      if (campos.length) await env.DB.prepare('UPDATE clientes SET ' + campos.join(',') + ' WHERE id=?').bind(...vals, id).run();
      if (b.status) { const c = await env.DB.prepare('SELECT escola FROM clientes WHERE id=?').bind(id).first(); await log(env, 'cliente', (c ? c.escola : 'Cliente') + ' agora está: ' + b.status); }
      return J({ ok: true });
    }
  }

  if (rec === 'faturas') {
    const hoje = tz();
    if (!id && acao == null && P[2] === 'gerar' && m === 'POST') return J({ ok: true, criadas: await gerarMensais(env) });
    if (!id && m === 'GET') {
      const st = url.searchParams.get('status');
      let sql = 'SELECT f.*, c.escola FROM faturas f JOIN clientes c ON c.id=f.cliente_id', args = [];
      if (st === 'atrasada') { sql += " WHERE f.status IN ('aberta','informada') AND f.vencimento<?"; args = [hoje]; }
      else if (st) { sql += ' WHERE f.status=?'; args = [st]; }
      const { results } = await env.DB.prepare(sql + ' ORDER BY f.vencimento DESC, f.id DESC LIMIT 400').bind(...args).all();
      return J(results.map(r => ({ ...r, atrasada: (r.status === 'aberta' || r.status === 'informada') && r.vencimento < hoje, link: new URL('/fatura?t=' + r.token, url).href })));
    }
    if (!id && m === 'POST') {
      const b = await body(), cid = int(b.cliente_id), valor = int(b.valor), venc = txt(b.vencimento, 10);
      if (!cid || valor <= 0 || valor > 50000000 || !/^\d{4}-\d{2}-\d{2}$/.test(venc)) return erro('Informe cliente, valor e vencimento.');
      const f = await criarFatura(env, { cliente_id: cid, descricao: txt(b.descricao, 120) || 'Cobrança avulsa', valor, vencimento: venc });
      return J({ ok: true, ...f, link: new URL('/fatura?t=' + f.token, url).href });
    }
    if (id && m === 'PATCH') {
      const b = await body(), f = await env.DB.prepare('SELECT f.*, c.escola FROM faturas f JOIN clientes c ON c.id=f.cliente_id WHERE f.id=?').bind(id).first(); if (!f) return erro('Fatura não encontrada.', 404);
      if (b.status === 'paga') {
        const dia = /^\d{4}-\d{2}-\d{2}$/.test(b.pago_em || '') ? b.pago_em : hoje;
        await env.DB.prepare("UPDATE faturas SET status='paga',pago_em=? WHERE id=?").bind(dia, id).run();
        await log(env, 'fatura', f.escola + ': ' + brl(f.valor) + ' recebido');
      } else if (b.status === 'cancelada' || b.status === 'aberta') {
        await env.DB.prepare('UPDATE faturas SET status=?,pago_em=NULL WHERE id=?').bind(b.status, id).run();
      } else return erro('Status inválido.');
      return J({ ok: true });
    }
  }

  if (rec === 'planos') {
    if (!id && m === 'GET') { const { results } = await env.DB.prepare('SELECT * FROM planos ORDER BY ativo DESC, mensal').all(); return J(results); }
    if (!id && m === 'POST') {
      const b = await body(), nome = txt(b.nome, 80), mensal = int(b.mensal), impl = int(b.implantacao);
      if (!nome || mensal <= 0 || mensal > 5000000 || impl < 0 || impl > 5000000) return erro('Informe nome e valores válidos.');
      const r = await env.DB.prepare('INSERT INTO planos(nome,mensal,implantacao,descricao,ativo) VALUES(?,?,?,?,1)').bind(nome, mensal, impl, txt(b.descricao, 300)).run(); return J({ ok: true, id: r.meta.last_row_id });
    }
    if (id && m === 'PATCH') {
      const b = await body(), p = await env.DB.prepare('SELECT * FROM planos WHERE id=?').bind(id).first(); if (!p) return erro('Plano não encontrado.', 404);
      await env.DB.prepare('UPDATE planos SET nome=?,mensal=?,implantacao=?,descricao=?,ativo=? WHERE id=?').bind(txt(b.nome, 80) || p.nome, b.mensal != null ? Math.max(1, int(b.mensal)) : p.mensal, b.implantacao != null ? Math.max(0, int(b.implantacao)) : p.implantacao, b.descricao != null ? txt(b.descricao, 300) : p.descricao, b.ativo != null ? (b.ativo ? 1 : 0) : p.ativo, id).run();
      return J({ ok: true });
    }
  }

  if (rec === 'config') {
    if (m === 'GET') return J(await config(env));
    if (m === 'PUT') {
      const b = await body();
      for (const k of CONFIG_CHAVES) if (typeof b[k] === 'string') {
        const v = txt(k === 'contrato_texto' ? b[k] : b[k], k === 'contrato_texto' ? 20000 : 200);
        await env.DB.prepare('INSERT INTO settings(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v').bind(k, v).run();
      }
      return J({ ok: true });
    }
  }
  return erro('Rota não encontrada.', 404);
}

function resumoLead(cfgJson) {
  try { const c = JSON.parse(cfgJson || '{}'); return { modalidades: c.modalidades || [], alunos: c.alunos || '', modulos: (c.modulos || []).length, dor: c.dor || '' }; } catch { return {}; }
}

// ---------- banco: SQLite dentro de um Durable Object, com a mesma interface do D1 (prepare/bind/first/all/run) ----------
export class Banco {
  constructor(state) { this.sql = state.storage.sql; state.blockConcurrencyWhile(async () => { for (const s of SCHEMA) this.sql.exec(s); }); }
  async fetch(req) {
    try {
      const { sql, binds, modo } = await req.json(), cur = this.sql.exec(sql, ...binds), linhas = cur.toArray();
      if (modo === 'all') return Response.json({ results: linhas });
      if (modo === 'first') return Response.json({ row: linhas[0] || null });
      return Response.json({ meta: { last_row_id: this.sql.exec('SELECT last_insert_rowid() id').one().id, changes: cur.rowsWritten } });
    } catch (e) { return Response.json({ erro: String((e && e.message) || e) }, { status: 500 }); }
  }
}
const comBanco = env => ({ ...env, DB: { prepare(sql) {
  let binds = [];
  const chama = async modo => { const r = await env.BANCO.get(env.BANCO.idFromName('principal')).fetch('https://banco/', { method: 'POST', body: JSON.stringify({ sql, binds, modo }) }); const j = await r.json(); if (!r.ok) throw new Error(j.erro); return j; };
  return { bind(...b) { binds = b; return this; }, all: () => chama('all'), first: async () => (await chama('first')).row, run: () => chama('run') };
} } });

export default {
  async fetch(req, env0) {
    const env = comBanco(env0);
    const url = new URL(req.url), p = url.pathname.replace(/\/+$/, '');
    const host = url.hostname.toLowerCase();
    if (host.endsWith('.' + DOMINIO) && host !== 'esporte.' + DOMINIO) {
      if (p.startsWith('/api/')) return erro('Não encontrado.', 404);
      if (p.startsWith('/ds/')) return env.ASSETS.fetch(req);
      const esc = await env.DB.prepare('SELECT status FROM clientes WHERE url_sistema=?').bind('https://' + host).first();
      if (esc && p.startsWith('/sys/')) return rotaSistema(req, env, host, p);
      if (esc && esc.status === 'ativo') return servirSistema(req, env, p, host); // escola ativa: o sistema de verdade
      return paginaEscola(req, env, host, p);
    }
    if (!p.startsWith('/api/')) return env.ASSETS.fetch(req);
    try {
      const m = req.method;
      if (m !== 'GET' && m !== 'HEAD' && m !== 'OPTIONS' && !(req.headers.get('content-type') || '').includes('application/json') && !p.endsWith('/logout')) return erro('Tipo de conteúdo inválido.', 415);
      let r;
      // públicas
      if (p === '/api/leads' && m === 'POST') r = await postLead(req, env);
      else if (/^\/api\/contrato\/[0-9a-f]{48}$/.test(p) && m === 'GET') r = await getContrato(env, p.split('/')[3]);
      else if (/^\/api\/contrato\/[0-9a-f]{48}\/assinar$/.test(p) && m === 'POST') r = await assinar(req, env, p.split('/')[3]);
      else if (/^\/api\/fatura\/[0-9a-f]{32}$/.test(p) && m === 'GET') r = await getFatura(env, p.split('/')[3]);
      else if (/^\/api\/fatura\/[0-9a-f]{32}\/paguei$/.test(p) && m === 'POST') r = await paguei(env, p.split('/')[3], req);
      // dono
      else if (p === '/api/admin/login' && m === 'POST') {
        if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET) return erro('Acesso do dono ainda não configurado.', 503);
        // só senha ERRADA conta: 8 erros a cada 15 minutos por endereço; acertar zera a contagem
        const chave = 'loginfalha:' + ip(req), desde = Date.now() - 900000;
        const f = await env.DB.prepare('SELECT COUNT(*) n FROM tentativas WHERE chave=? AND quando>?').bind(chave, desde).first();
        if (f.n >= 8) return erro('Muitas tentativas erradas. Espere 15 minutos.', 429);
        let b; try { b = await req.json(); } catch { b = {}; }
        if (!(await iguais(String(b.senha || ''), env.ADMIN_PASSWORD))) { await env.DB.prepare('INSERT INTO tentativas(chave,quando) VALUES(?,?)').bind(chave, Date.now()).run(); return erro('Senha incorreta.', 401); }
        await env.DB.prepare('DELETE FROM tentativas WHERE chave=?').bind(chave).run();
        const c = await criarSessao(env);
        r = J({ ok: true }, 200, { 'set-cookie': `pg_admin=${c}; Path=/; HttpOnly; ${url.protocol === 'https:' ? 'Secure; ' : ''}SameSite=Strict; Max-Age=43200` });
      } else if (p === '/api/admin/logout' && m === 'POST') r = J({ ok: true }, 200, { 'set-cookie': 'pg_admin=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0' });
      else if (p.startsWith('/api/admin/')) {
        if (!(await sessaoValida(req, env))) return erro('Entre com a senha do dono.', 401);
        if (m !== 'GET' && req.headers.get('x-pg') !== '1') return erro('Requisição recusada.', 403);
        r = p === '/api/admin/me' ? J({ ok: true }) : await rotaAdmin(req, env, url, p.replace('/api/', ''));
      } else r = erro('Rota não encontrada.', 404);
      return r;
    } catch (e) {
      console.error('erro', e && e.stack || e);
      return erro('Erro interno. Tente de novo.', 500);
    }
  },
  async scheduled(_ev, env) { await gerarMensais(comBanco(env)); },
};
