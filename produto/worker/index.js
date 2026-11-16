import { rotaSistema, servirSistema, importarSistema, tokenParaDono, revogar, auditar, confereSenha } from './sistema.js';
import { CATALOGO, INTERNO, limparControle, limparInterno, controleDe, esquecerControle } from './controle.js';
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
// ---------- subdomínio de cada escola (<nome>.<domínio>) ----------
// O sistema atende os dois domínios. Escolas novas nascem no DOMINIO_PADRAO (variável do wrangler.toml); as antigas continuam onde estão.
const DOMINIOS = ['penagrama.com.br', 'thayruan.com.br'];
const dominioPadrao = (env) => (DOMINIOS.includes(env.DOMINIO_PADRAO) ? env.DOMINIO_PADRAO : 'thayruan.com.br');
const dominioDe = (host) => DOMINIOS.find((d) => host.endsWith('.' + d)) || '';
const RESERVADOS = new Set(['esporte', 'www', 'admin', 'api', 'mail', 'ftp', 'app', 'painel', 'webmail']);
const slugify = (x) => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '');
async function novoSubdominio(env, escola) {
  const base = slugify(escola) || 'escola';
  for (let i = 1; i < 50; i++) {
    const sl = i === 1 ? base : base + '-' + i;
    if (RESERVADOS.has(sl)) continue;
    const u = 'https://' + sl + '.' + dominioPadrao(env);
    if (!(await env.DB.prepare('SELECT 1 x FROM clientes WHERE url_sistema=?').bind(u).first())) return u;
  }
  return 'https://escola-' + Date.now().toString(36) + '.' + dominioPadrao(env);
}
// Senhas definidas pela Central (criar usuário, nova senha, acesso do administrador): ficam guardadas para o dono ver no painel.
// Se o usuário trocar a própria senha depois, a guardada deixa de conferir com a atual e some da tela.
async function guardaSenha(env, tenant, email, senha) {
  const x = await env.DB.prepare("SELECT data FROM sys_docs WHERE tenant=? AND col='sys_owner' AND id='senhas'").bind(tenant).first(), v = x ? JSON.parse(x.data) : {};
  if (senha == null) delete v[email]; else v[email] = senha;
  await env.DB.prepare('INSERT INTO sys_docs(tenant,col,id,data) VALUES(?,?,?,?) ON CONFLICT(tenant,col,id) DO UPDATE SET data=excluded.data').bind(tenant, 'sys_owner', 'senhas', JSON.stringify(v)).run();
}
// Catálogo de artes (aba Criativos da Central): confere a forma e limita o tamanho; o desenho em si é interpretado no navegador (motor.js).
const TIPOS_CAMADA = new Set(['ret', 'elipse', 'poli', 'linha', 'texto', 'foto', 'logo', 'qr', 'grao', 'meiotom', 'guilloche', 'listras', 'confete', 'arcos', 'campo', 'foil', 'balao']);
function limpaCatalogo(c) {
  if (!c || typeof c !== 'object') return null;
  const id = (x) => typeof x === 'string' && /^[a-z0-9]{1,24}$/.test(x), nome = (x) => txt(x, 40) || 'Sem nome';
  const camadas = (l) => (Array.isArray(l) ? l : []).slice(0, 400).filter((x) => x && typeof x === 'object' && TIPOS_CAMADA.has(x.t));
  const temas = {};
  for (const tipo of ['carteirinha', 'aniversario']) {
    const lista = ((c.temas || {})[tipo] || []).slice(0, 24).filter((t) => t && id(t.id) && t.tokens && typeof t.tokens === 'object');
    if (!lista.length) return null;
    temas[tipo] = lista.map((t) => ({ id: t.id, nome: nome(t.nome), tokens: Object.fromEntries(Object.entries(t.tokens).slice(0, 30).filter(([k, v]) => /^[a-zA-Z0-9]{1,20}$/.test(k) && typeof v === 'string').map(([k, v]) => [k, v.slice(0, 300)])) }));
  }
  const modelo = (tipo) => (Array.isArray(c[tipo]) ? c[tipo] : []).slice(0, 60).filter((m) => m && id(m.id)).map((m) => {
    const base = { id: m.id, nome: nome(m.nome), tipo, w: Math.min(4000, Math.max(200, Math.round(Number(m.w) || (tipo === 'carteirinha' ? 1012 : 1080)))), h: Math.min(4000, Math.max(200, Math.round(Number(m.h) || (tipo === 'carteirinha' ? 638 : 1350)))), ativo: m.ativo !== false, temas: (Array.isArray(m.temas) ? m.temas : []).filter((x) => temas[tipo].some((t) => t.id === x)) };
    return tipo === 'carteirinha' ? { ...base, lados: { frente: camadas((m.lados || {}).frente), verso: camadas((m.lados || {}).verso) } } : { ...base, camadas: camadas(m.camadas) };
  });
  const saida = { versao: 1, temas, carteirinha: modelo('carteirinha'), aniversario: modelo('aniversario') };
  return JSON.stringify(saida).length > 2_000_000 ? null : saida;
}
const escHtml = (x) => String(x == null ? '' : x).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SITUACAO = { implantando: ['Estamos preparando tudo', 'O sistema da sua escola está sendo montado com carinho. Em breve este endereço abre o seu painel, é só voltar daqui a pouco.'], ativo: ['Sistema ativo', 'O sistema da escola está ativo neste endereço.'], pausado: ['Temporariamente pausado', 'O sistema desta escola está pausado por enquanto. Fale com a escola para saber mais.'], cancelado: ['Contrato encerrado', 'O contrato desta escola foi encerrado.'] };
const ETAPAS_IMPL = 7; // quantidade de passos do roteiro de implantação (a página só mostra a porcentagem)
async function paginaEscola(req, env, host, p) {
  if (p.startsWith('/ds/') || p.startsWith('/assets/')) return env.ASSETS.fetch(req);
  const c = await env.DB.prepare('SELECT c.escola,c.status,c.checklist,l.logo FROM clientes c LEFT JOIN leads l ON l.id=c.lead_id WHERE c.url_sistema=?').bind('https://' + host).first();
  if (p === '/__logo') { // logo da escola, só para esta página
    const mm = c && /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(c.logo || ''); if (!mm) return new Response('', { status: 404 });
    return new Response(Uint8Array.from(atob(mm[2]), (ch) => ch.charCodeAt(0)), { headers: { 'content-type': mm[1], 'cache-control': 'public, max-age=300' } });
  }
  const [titulo, texto] = c ? (SITUACAO[c.status] || SITUACAO.implantando) : ['', ''];
  let pct = 0; try { pct = Math.min(100, Math.round(Object.values(JSON.parse(c ? c.checklist || '{}' : '{}')).filter(Boolean).length / ETAPAS_IMPL * 100)); } catch { /* checklist inválida: 0% */ }
  const temLogo = c && /^data:image\//.test(c.logo || '');
  const corpo = c
    ? '<div class="marca">' + (temLogo ? '<img class="esc" src="/__logo" alt="Logo de ' + escHtml(c.escola) + '">' : '<div class="ini">' + escHtml((c.escola.match(/[A-Za-zÀ-ú0-9]+/g) || ['?']).slice(0, 2).map((w) => w[0]).join('').toUpperCase()) + '</div>') + '</div><h2>' + escHtml(c.escola) + '</h2><h1>' + escHtml(titulo) + '</h1><p>' + escHtml(texto) + '</p>'
      + (c.status === 'implantando' ? '<div class="prog" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '" aria-label="Andamento da implantação"><i style="width:' + Math.max(pct, 4) + '%"></i></div><b class="pct">' + pct + '%</b>' : '')
      + '<footer><span>Feito com</span><img src="/assets/logo-600.png" alt="Pé na Grama"></footer>'
    : '<h1>Endereço não encontrado</h1><p>Nenhuma escola usa este endereço.</p>';
  const css = 'body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f4f7fc;font-family:Lato,system-ui,sans-serif;color:#1c2b4a}main{width:min(480px,calc(100vw - 32px));margin:24px 0;padding:40px 32px 28px;background:#fff;border:1px solid #e3e8f2;border-radius:20px;text-align:center;box-shadow:0 8px 30px rgba(16,33,63,.07)}'
    + '.marca{display:grid;place-items:center;margin-bottom:14px}.esc{max-width:220px;max-height:120px;object-fit:contain}.ini{width:88px;height:88px;border-radius:22px;background:#eef3fb;color:#17428f;display:grid;place-items:center;font-size:1.8rem;font-weight:800}'
    + 'h2{margin:0;font-size:.95rem;font-weight:700;color:#6b7893;letter-spacing:.02em}h1{margin:18px 0 8px;font-size:1.55rem;line-height:1.25;color:#17428f}p{margin:0 auto 22px;max-width:380px;line-height:1.55;color:#4a5875}'
    + '.prog{height:10px;border-radius:99px;background:#e6edf7;overflow:hidden}.prog i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#00a63a,#4cc96f);transition:width .6s}.pct{display:block;margin-top:10px;font-size:1.1rem;color:#00803a;font-variant-numeric:tabular-nums}'
    + 'footer{margin-top:28px;padding-top:18px;border-top:1px solid #eef1f7;display:flex;align-items:center;justify-content:center;gap:10px;color:#8a95ab;font-size:.8rem}footer img{height:34px}';
  const html = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>' + escHtml(c ? c.escola : 'Pé na Grama') + '</title><style>' + css + '</style></head><body><main>' + corpo + '</main></body></html>';
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

/** Publica o endereço da escola como domínio do Worker pela API do Cloudflare (precisa do segredo CF_API_TOKEN).
 *  O Cloudflare cria o DNS e o certificado sozinho. Devolve { ok, motivo } e nunca lança: o pedido que chamou não pode falhar por isso. */
async function publicarDominio(env, urlSistema) {
  if (!env.CF_API_TOKEN) return { ok: false, motivo: 'Chave de API do Cloudflare ainda não configurada (segredo CF_API_TOKEN).' };
  let host; try { host = new URL(urlSistema).host; } catch { return { ok: false, motivo: 'Endereço inválido.' }; }
  const DOMINIO = dominioDe(host);
  if (!DOMINIO) return { ok: false, motivo: 'Só subdomínios de ' + DOMINIOS.join(' ou ') + ' são publicados automaticamente.' };
  const cf = async (m, p, b) => { const r = await fetch('https://api.cloudflare.com/client/v4' + p, { method: m, headers: { authorization: 'Bearer ' + env.CF_API_TOKEN, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined, signal: AbortSignal.timeout(15000) }); const j = await r.json().catch(() => ({})); if (!r.ok || j.success === false) throw new Error((j.errors && j.errors[0] && j.errors[0].message) || 'Cloudflare respondeu ' + r.status); return j.result; };
  try {
    const z = await cf('GET', '/zones?name=' + DOMINIO + '&account.id=' + env.CF_ACCOUNT_ID);
    if (!z.length) throw new Error('Zona ' + DOMINIO + ' não encontrada nesta conta.');
    await cf('PUT', '/accounts/' + env.CF_ACCOUNT_ID + '/workers/domains', { hostname: host, service: env.CF_WORKER_NAME || 'esporte-thayruan', environment: 'production', zone_id: z[0].id });
    await env.DB.prepare('INSERT INTO settings(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v').bind('dominio:' + host, 'ok').run();
    await log(env, 'sistema', 'Endereço publicado: ' + host);
    return { ok: true };
  } catch (e) {
    await env.DB.prepare('INSERT INTO settings(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v').bind('dominio:' + host, 'erro: ' + e.message).run();
    return { ok: false, motivo: e.message };
  }
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
  const urlNova = await novoSubdominio(env, c.escola);
  await env.DB.prepare('UPDATE clientes SET url_sistema=? WHERE id=?').bind(urlNova, cid).run();
  await publicarDominio(env, urlNova); // sem a chave do Cloudflare apenas registra o motivo; o dono pode tentar de novo na Central
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
  if (rec === 'contagens' && m === 'GET') { // números do menu: o que está esperando o dono
    const [l, f] = await Promise.all([env.DB.prepare("SELECT COUNT(*) n FROM leads WHERE status='novo'").first(), env.DB.prepare("SELECT COUNT(*) n FROM faturas WHERE status='informada' OR (status='aberta' AND vencimento<?)").bind(tz()).first()]);
    return J({ pedidos: l.n, faturas: f.n });
  }
  if (rec === 'sys-import' && m === 'POST') { try { return J(await importarSistema(env, await body())); } catch (e) { return erro(e.message); } }

  if (rec === 'leads') {
    if (id && acao === 'logo' && m === 'GET') { // logo leve para as listas (imagem de verdade, com cache)
      const l = await env.DB.prepare('SELECT logo FROM leads WHERE id=?').bind(id).first();
      const mm = l && /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(l.logo || ''); if (!mm) return erro('Sem logo.', 404);
      return new Response(Uint8Array.from(atob(mm[2]), (ch) => ch.charCodeAt(0)), { headers: { 'content-type': mm[1], 'cache-control': 'private, max-age=300' } });
    }
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
    if (id && acao === 'saude' && m === 'GET') { // situação do sistema da escola: dados, usuários, última ação, limite
      const c = await env.DB.prepare('SELECT url_sistema FROM clientes WHERE id=?').bind(id).first(); if (!c || !c.url_sistema) return erro('Cliente sem endereço do sistema.', 404);
      const t = new URL(c.url_sistema).host, n = async (sql, ...a) => (await env.DB.prepare(sql).bind(...a).first()) || {};
      const [reg, usu, doc, ult, lim] = await Promise.all([
        n("SELECT COUNT(*) n FROM sys_docs WHERE tenant=? AND col='rumo_ao_esporte_2026_registrations'", t), n('SELECT COUNT(*) n FROM sys_users WHERE tenant=?', t),
        n('SELECT COUNT(*) n, COALESCE(SUM(LENGTH(data)),0) bytes FROM sys_docs WHERE tenant=?', t),
        n("SELECT data FROM sys_docs WHERE tenant=? AND col='auditoria' ORDER BY json_extract(data,'$.quando') DESC LIMIT 1", t),
        n("SELECT data FROM sys_docs WHERE tenant=? AND col='sys_owner' AND id='limites'", t)]);
      return J({ matriculas: reg.n || 0, usuarios: usu.n || 0, documentos: doc.n || 0, kb: Math.round((doc.bytes || 0) / 1024), ultima_acao: ult.data ? JSON.parse(ult.data) : null, limite: lim.data ? JSON.parse(lim.data).maxMatriculas || 0 : 0 });
    }
    if (id && ['backups', 'backup', 'restaurar'].includes(acao)) { // cópias automáticas diárias (7 mais recentes) e restauração
      const c = await env.DB.prepare('SELECT url_sistema FROM clientes WHERE id=?').bind(id).first(); if (!c || !c.url_sistema) return erro('Cliente sem endereço do sistema.', 404);
      const tenant = new URL(c.url_sistema).host, b = m === 'GET' ? {} : await body();
      const op = acao === 'backups' ? { op: 'backup-lista', tenant } : acao === 'backup' ? { op: 'backup-agora', tenant } : { op: 'backup-restaurar', tenant, quando: String(b.quando || '') };
      if (acao === 'restaurar' && b.confirmar !== true) return erro('Confirme a restauração (substitui os dados atuais da escola).');
      const r = await env.BANCO.get(env.BANCO.idFromName('principal')).fetch('https://banco/', { method: 'POST', body: JSON.stringify(op) }), j = await r.json();
      if (!r.ok) return erro(j.erro || 'Falha no backup.', 500);
      if (acao === 'restaurar') await log(env, 'sistema', 'Dados de ' + tenant + ' restaurados do backup de ' + op.quando);
      return J(j);
    }
    if (id && acao === 'publicar' && m === 'POST') { // (re)publica o endereço da escola no Cloudflare
      const c = await env.DB.prepare('SELECT url_sistema FROM clientes WHERE id=?').bind(id).first(); if (!c || !c.url_sistema) return erro('Cliente sem endereço do sistema.', 404);
      return J(await publicarDominio(env, c.url_sistema));
    }
    if (id && acao === 'dominio' && m === 'GET') {
      const c = await env.DB.prepare('SELECT url_sistema FROM clientes WHERE id=?').bind(id).first(); if (!c || !c.url_sistema) return J({ estado: 'sem endereço' });
      const h = new URL(c.url_sistema).host, v = await env.DB.prepare('SELECT v FROM settings WHERE k=?').bind('dominio:' + h).first();
      return J({ host: h, estado: v ? v.v : 'não publicado pela automação', chave_configurada: Boolean(env.CF_API_TOKEN) });
    }
    if (id && acao === 'acesso' && m === 'POST') { // gera (ou refaz) o acesso do administrador da escola; a senha aparece só agora
      const c = await env.DB.prepare('SELECT escola,contato_email,url_sistema FROM clientes WHERE id=?').bind(id).first(); if (!c || !c.url_sistema) return erro('Cliente sem endereço do sistema.', 404);
      // O sistema da escola reconhece como administrador principal o PRIMEIRO admin do tenant: se já existe, refaz a senha dele em vez de criar outro.
      const t = new URL(c.url_sistema).host, ja = await env.DB.prepare("SELECT email FROM sys_users WHERE tenant=? AND role='admin' ORDER BY rowid LIMIT 1").bind(t).first();
      const email = ja ? ja.email : /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.contato_email || '') ? c.contato_email.toLowerCase() : 'admin@' + t;
      const senha = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'[b % 54]).join('');
      await importarSistema(env, { tenant: t, users: [{ email, password: senha, role: 'admin' }] }); await guardaSenha(env, t, email, senha);
      await log(env, 'sistema', 'Acesso do administrador gerado para ' + c.escola);
      return J({ email, senha, url: c.url_sistema + '/admin/login' });
    }
    // ---- Dono master: controle total da escola (opções, usuários, dados, sessões, entrar como a escola) ----
    if (id && ['controle', 'usuarios', 'usuario', 'sessoes', 'dados', 'limpar-dados', 'auditoria', 'exportar', 'entrar'].includes(acao)) {
      const c0 = await env.DB.prepare('SELECT escola,url_sistema FROM clientes WHERE id=?').bind(id).first();
      if (!c0 || !c0.url_sistema) return erro('Cliente sem endereço do sistema.', 404);
      const t = new URL(c0.url_sistema).host, q = (sql, ...a) => env.DB.prepare(sql).bind(...a);
      const doc = async (nome) => { const x = await q("SELECT data FROM sys_docs WHERE tenant=? AND col='sys_owner' AND id=?", t, nome).first(); return x ? JSON.parse(x.data) : null; };
      const salvarDoc = (nome, v) => q('INSERT INTO sys_docs(tenant,col,id,data) VALUES(?,?,?,?) ON CONFLICT(tenant,col,id) DO UPDATE SET data=excluded.data', t, 'sys_owner', nome, JSON.stringify(v)).run();
      const senhaNova = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'[b % 54]).join('');
      if (acao === 'controle' && m === 'GET') {
        const salvo = await doc('controle'); esquecerControle(t);
        return J({ catalogo: CATALOGO.map(({ paths, ...o }) => ({ ...o, modulo: Boolean(paths) })), valores: await controleDe(env, t), definidos: salvo ? salvo.valores || {} : {}, interno_campos: INTERNO, interno: salvo ? salvo.interno || {} : {} });
      }
      if (acao === 'controle' && m === 'PUT') {
        const b = await body(), salvo = (await doc('controle')) || {}, novo = { valores: { ...(salvo.valores || {}), ...limparControle(b.valores) }, interno: { ...(salvo.interno || {}), ...limparInterno(b.interno) } };
        await salvarDoc('controle', novo); esquecerControle(t);
        await log(env, 'sistema', 'Controle de ' + c0.escola + ' alterado (' + Object.keys(limparControle(b.valores)).length + ' opções)');
        return J({ ok: true, valores: await controleDe(env, t) });
      }
      if (acao === 'usuarios' && m === 'GET') {
        const r = await q('SELECT email,role,uid,salt,hash,rowid FROM sys_users WHERE tenant=? ORDER BY rowid', t).all(), fl = await q("SELECT id,data FROM sys_docs WHERE tenant=? AND col='sys_flags'", t).all(), sn = (await doc('senhas')) || {};
        const bloq = new Set((fl.results || []).filter((x) => JSON.parse(x.data).bloqueado).map((x) => x.id));
        const lista = await Promise.all((r.results || []).map(async (u, i) => {
          const guardada = sn[u.email], vale = guardada ? await confereSenha(guardada, u) : false;
          return { email: u.email, role: u.role, bloqueado: bloq.has(u.email), principal: u.role === 'admin' && !(r.results || []).slice(0, i).some((x) => x.role === 'admin'), senha: vale ? guardada : '', senha_trocada: Boolean(guardada && !vale) };
        }));
        return J({ usuarios: lista });
      }
      if (acao === 'usuario' && m === 'POST') {
        const b = await body(), email = String(b.email || '').trim().toLowerCase(), papel = ['admin', 'professor', 'user'].includes(b.papel) ? b.papel : 'user';
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return erro('E-mail inválido.');
        const u = await q('SELECT email,role FROM sys_users WHERE tenant=? AND email=?', t, email).first();
        const primeiro = await q("SELECT email FROM sys_users WHERE tenant=? AND role='admin' ORDER BY rowid LIMIT 1", t).first();
        const ehPrincipal = Boolean(u && primeiro && primeiro.email === email);
        const bloqueio = async (v) => q('INSERT INTO sys_docs(tenant,col,id,data) VALUES(?,?,?,?) ON CONFLICT(tenant,col,id) DO UPDATE SET data=excluded.data', t, 'sys_flags', email, JSON.stringify({ ...(JSON.parse(((await q("SELECT data FROM sys_docs WHERE tenant=? AND col='sys_flags' AND id=?", t, email).first()) || { data: '{}' }).data)), bloqueado: v })).run();
        if (b.acao === 'criar') {
          if (u) return erro('E-mail já cadastrado.', 409);
          const lim = await controleDe(env, t);
          if (lim.lim_usuarios && (await q('SELECT COUNT(*) n FROM sys_users WHERE tenant=?', t).first()).n >= lim.lim_usuarios) return erro('Limite de usuários desta escola atingido (' + lim.lim_usuarios + '). Aumente em Limites do plano.', 403);
          if (papel === 'admin' && lim.lim_admins && (await q("SELECT COUNT(*) n FROM sys_users WHERE tenant=? AND role='admin'", t).first()).n >= lim.lim_admins) return erro('Limite de administradores atingido (' + lim.lim_admins + ').', 403);
          const senha = String(b.senha || '') || senhaNova(); await importarSistema(env, { tenant: t, users: [{ email, password: senha, role: papel === 'admin' ? 'admin' : papel === 'professor' ? 'professor' : 'user' }] });
          await q("UPDATE sys_users SET role=? WHERE tenant=? AND email=?", papel, t, email).run(); await guardaSenha(env, t, email, senha);
          await log(env, 'sistema', 'Usuário ' + email + ' (' + papel + ') criado em ' + c0.escola); return J({ ok: true, email, senha });
        }
        if (!u) return erro('Usuário não encontrado.', 404);
        if (b.acao === 'senha') { const senha = String(b.senha || '') || senhaNova(); await importarSistema(env, { tenant: t, users: [{ email, password: senha, role: u.role === 'admin' ? 'admin' : u.role }] }); await q('UPDATE sys_users SET role=? WHERE tenant=? AND email=?', u.role, t, email).run(); await guardaSenha(env, t, email, senha); await revogar(env, t, email); await log(env, 'sistema', 'Senha de ' + email + ' redefinida em ' + c0.escola); return J({ ok: true, senha }); }
        if (b.acao === 'papel') { if (ehPrincipal) return erro('O administrador principal não pode mudar de papel.'); const lim = await controleDe(env, t); if (papel === 'admin' && u.role !== 'admin' && lim.lim_admins && (await q("SELECT COUNT(*) n FROM sys_users WHERE tenant=? AND role='admin'", t).first()).n >= lim.lim_admins) return erro('Limite de administradores atingido (' + lim.lim_admins + ').', 403); await q('UPDATE sys_users SET role=? WHERE tenant=? AND email=?', papel, t, email).run(); await revogar(env, t, email); return J({ ok: true }); }
        if (b.acao === 'bloquear') { if (ehPrincipal) return erro('O administrador principal não pode ser bloqueado.'); await bloqueio(true); await revogar(env, t, email); return J({ ok: true }); }
        if (b.acao === 'desbloquear') { await bloqueio(false); return J({ ok: true }); }
        if (b.acao === 'sessoes') { await revogar(env, t, email); return J({ ok: true }); }
        if (b.acao === 'excluir') { await guardaSenha(env, t, email, null); if (ehPrincipal) return erro('O administrador principal não pode ser excluído.'); await q('DELETE FROM sys_users WHERE tenant=? AND email=?', t, email).run(); await log(env, 'sistema', 'Usuário ' + email + ' excluído de ' + c0.escola); return J({ ok: true }); }
        return erro('Ação desconhecida.');
      }
      if (acao === 'sessoes' && m === 'POST') { const r = await q('SELECT email FROM sys_users WHERE tenant=?', t).all(); for (const u of r.results || []) await revogar(env, t, u.email); await log(env, 'sistema', 'Todas as sessões de ' + c0.escola + ' encerradas'); return J({ ok: true, usuarios: (r.results || []).length }); }
      if (acao === 'dados' && m === 'GET') { const r = await q('SELECT col, COUNT(*) n, COALESCE(SUM(LENGTH(data)),0) b FROM sys_docs WHERE tenant=? GROUP BY col ORDER BY b DESC', t).all(); return J({ colecoes: (r.results || []).map((x) => ({ col: x.col, n: x.n, kb: Math.round(x.b / 1024) })) }); }
      if (acao === 'limpar-dados' && m === 'POST') {
        const b = await body(); if (!['auditoria', 'rumo_ao_esporte_2026_chamadas'].includes(b.col) || b.confirmar !== true) return erro('Só dá para limpar o registro de ações e as chamadas, com confirmação.');
        const r = await q('DELETE FROM sys_docs WHERE tenant=? AND col=?', t, b.col).run(); await log(env, 'sistema', 'Coleção ' + b.col + ' de ' + c0.escola + ' limpa'); return J({ ok: true, apagados: r.meta ? r.meta.changes : 0 });
      }
      if (acao === 'auditoria' && m === 'GET') { const r = await q("SELECT data FROM sys_docs WHERE tenant=? AND col='auditoria' ORDER BY json_extract(data,'$.quando') DESC LIMIT 80", t).all(); return J({ registros: (r.results || []).map((x) => JSON.parse(x.data)) }); }
      if (acao === 'exportar' && m === 'GET') {
        const r = await q("SELECT col,id,data FROM sys_docs WHERE tenant=? AND NOT (col='system_settings' AND id='whatsapp_evolution') AND substr(col,1,4)<>'sys_'", t).all();
        await log(env, 'sistema', 'Dados de ' + c0.escola + ' exportados pelo dono');
        return new Response(JSON.stringify({ tenant: t, geradoEm: new Date().toISOString(), docs: (r.results || []).map((x) => ({ col: x.col, id: x.id, data: JSON.parse(x.data) })) }), { headers: { 'content-type': 'application/json; charset=utf-8', 'content-disposition': 'attachment; filename="dados-' + t.split('.')[0] + '.json"' } });
      }
      if (acao === 'entrar' && m === 'POST') {
        const alvo = String((await body()).email || '').trim().toLowerCase(); // sem e-mail: entra como o administrador principal
        const a = alvo ? await q('SELECT email,uid,role FROM sys_users WHERE tenant=? AND email=?', t, alvo).first() : await q("SELECT email,uid,role FROM sys_users WHERE tenant=? AND role='admin' ORDER BY rowid LIMIT 1", t).first();
        if (!a) return erro(alvo ? 'Usuário não encontrado.' : 'A escola ainda não tem administrador. Gere o acesso primeiro.', alvo ? 404 : 409);
        const papel = a.role === 'professor' ? 'professor' : a.role === 'user' ? 'user' : 'admin';
        const tk = await tokenParaDono(env, t, { email: a.email, uid: a.uid, role: papel }, 0.5);
        await log(env, 'sistema', 'Dono entrou como ' + a.email + ' (' + papel + ') de ' + c0.escola); return J({ url: c0.url_sistema + '/__entrar#t=' + tk + '&r=' + papel });
      }
    }
    if (id && acao === 'limite' && m === 'PUT') { // limite de matrículas do plano (0 = sem limite)
      const c = await env.DB.prepare('SELECT url_sistema FROM clientes WHERE id=?').bind(id).first(); if (!c || !c.url_sistema) return erro('Cliente sem endereço do sistema.', 404);
      const max = Math.max(0, Math.min(100000, Math.floor(Number((await body()).max) || 0)));
      await env.DB.prepare('INSERT INTO sys_docs(tenant,col,id,data) VALUES(?,?,?,?) ON CONFLICT(tenant,col,id) DO UPDATE SET data=excluded.data').bind(new URL(c.url_sistema).host, 'sys_owner', 'limites', JSON.stringify({ maxMatriculas: max })).run();
      return J({ ok: true, limite: max });
    }
    if (id && acao === 'logo' && m === 'GET') { // logo leve para a lista de clientes (imagem de verdade, com cache)
      const l = await env.DB.prepare('SELECT l.logo FROM clientes c JOIN leads l ON l.id=c.lead_id WHERE c.id=?').bind(id).first();
      const mm = l && /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(l.logo || ''); if (!mm) return erro('Sem logo.', 404);
      return new Response(Uint8Array.from(atob(mm[2]), (ch) => ch.charCodeAt(0)), { headers: { 'content-type': mm[1], 'cache-control': 'private, max-age=300' } });
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
      if (typeof b.contato_email === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(b.contato_email)) { campos.push('contato_email=?'); vals.push(txt(b.contato_email, 120).toLowerCase()); }
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
      let sql = 'SELECT f.*, c.escola, c.lead_id FROM faturas f JOIN clientes c ON c.id=f.cliente_id', args = [];
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

  if (rec === 'criativos') { // modelos de carteirinha e de aniversário que as escolas podem escolher
    if (m === 'GET') { const r = await env.DB.prepare("SELECT v FROM settings WHERE k='criativos'").first(); return J({ catalogo: r ? JSON.parse(r.v) : null }); }
    if (m === 'PUT') {
      const c = limpaCatalogo((await body()).catalogo); if (!c) return erro('Catálogo inválido ou grande demais.');
      await env.DB.prepare("INSERT INTO settings(k,v) VALUES('criativos',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v").bind(JSON.stringify(c)).run();
      await log(env, 'sistema', 'Modelos de carteirinha e de aniversário atualizados na Central');
      return J({ ok: true });
    }
    if (m === 'DELETE') { await env.DB.prepare("DELETE FROM settings WHERE k='criativos'").run(); await log(env, 'sistema', 'Modelos de arte voltaram ao padrão'); return J({ ok: true }); }
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
// Backup automático: o alarme do Durable Object (não precisa de cron) tira uma cópia diária dos dados de cada escola e guarda as 7 mais recentes.
// shortcut: a cópia fica no mesmo banco (protege de erro humano e de exclusão, não de perda do próprio Worker); para isso baixe o backup da escola.
const DIA = 24 * 3600e3, FILTRO_BACKUP = "NOT (col='system_settings' AND id='whatsapp_evolution') AND col<>'sys_flags'";
export class Banco {
  constructor(state) { this.state = state; this.sql = state.storage.sql; state.blockConcurrencyWhile(async () => { for (const s of SCHEMA) this.sql.exec(s); if (!(await state.storage.getAlarm())) await state.storage.setAlarm(Date.now() + DIA); }); }
  async alarm() { try { for (const { tenant } of this.sql.exec('SELECT DISTINCT tenant FROM sys_docs').toArray()) this.backup(tenant); } finally { await this.state.storage.setAlarm(Date.now() + DIA); } }
  backup(tenant) {
    const quando = new Date().toISOString(), json = JSON.stringify(this.sql.exec(`SELECT col,id,data FROM sys_docs WHERE tenant=? AND ${FILTRO_BACKUP}`, tenant).toArray().map((x) => [x.col, x.id, x.data]));
    for (let i = 0, parte = 0; i < json.length || parte === 0; i += 400000) this.sql.exec('INSERT INTO backups(tenant,quando,parte,data) VALUES(?,?,?,?)', tenant, quando, parte++, json.slice(i, i + 400000));
    for (const v of this.sql.exec('SELECT DISTINCT quando FROM backups WHERE tenant=? ORDER BY quando DESC LIMIT -1 OFFSET 7', tenant).toArray()) this.sql.exec('DELETE FROM backups WHERE tenant=? AND quando=?', tenant, v.quando);
    return quando;
  }
  restaurar(tenant, quando) {
    const partes = this.sql.exec('SELECT data FROM backups WHERE tenant=? AND quando=? ORDER BY parte', tenant, quando).toArray();
    if (!partes.length) throw new Error('Backup não encontrado.');
    const docs = JSON.parse(partes.map((p) => p.data).join(''));
    this.state.storage.transactionSync(() => {
      this.backup(tenant); // guarda o estado de agora antes de substituir
      this.sql.exec(`DELETE FROM sys_docs WHERE tenant=? AND ${FILTRO_BACKUP}`, tenant);
      for (const [col, id, data] of docs) this.sql.exec('INSERT INTO sys_docs(tenant,col,id,data) VALUES(?,?,?,?)', tenant, col, id, data);
    });
    return docs.length;
  }
  async fetch(req) {
    try {
      const corpo = await req.json();
      if (corpo.op === 'backup-lista') return Response.json({ lista: this.sql.exec('SELECT quando, SUM(LENGTH(data)) bytes FROM backups WHERE tenant=? GROUP BY quando ORDER BY quando DESC', corpo.tenant).toArray(), proximo: await this.state.storage.getAlarm() });
      if (corpo.op === 'backup-agora') return Response.json({ quando: this.backup(corpo.tenant) });
      if (corpo.op === 'backup-restaurar') return Response.json({ docs: this.restaurar(corpo.tenant, corpo.quando) });
      const { sql, binds, modo } = corpo, cur = this.sql.exec(sql, ...binds), linhas = cur.toArray();
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
    if (dominioDe(host) && host !== 'esporte.' + dominioDe(host)) {
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
      // Planos ativos, para a página de vendas mostrar o preço (desative um plano na Central e ele some do site).
      else if (p === '/api/planos' && m === 'GET') r = J((await env.DB.prepare('SELECT nome,mensal,implantacao,descricao FROM planos WHERE ativo=1 ORDER BY mensal').all()).results, 200, { 'cache-control': 'public, max-age=300' });
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
