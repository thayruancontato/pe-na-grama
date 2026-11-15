/**
 * Rotas e armazenamento dos provedores de pagamento configuráveis pelo dono da escola.
 * - Config por provedor no KV (RAE_STORAGE), cifrada com AES-GCM quando PROVIDER_CONFIG_KEY existe.
 * - Rotas de configuração exigem a chave PROVIDER_ADMIN_KEY (segredo do Worker).
 * - Webhooks: /webhooks/<provedor>/<segredo>. O corpo NUNCA é confiado: o pagamento é
 *   sempre consultado de novo no provedor antes de gravar.
 */
import REGISTRY from "../../../src/data/paymentProviders.json";
import { ADAPTERS, normInput, carnet } from "./adapters.js";

export const LEGACY = new Set(["asaas", "cora"]);
export const registryById = (id) => REGISTRY.find((p) => p.id === id);
export const knownProvider = (id) => Boolean(registryById(id));
export const isAdapterProvider = (id) => Boolean(ADAPTERS[id]);

const enc = new TextEncoder(), dec = new TextDecoder();
const toB64 = (u8) => btoa(String.fromCharCode(...u8));
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const kvKey = (id) => `provider-config:${id}`;

async function aesKey(env) {
  if (!env.PROVIDER_CONFIG_KEY) return null;
  const raw = await crypto.subtle.digest("SHA-256", enc.encode(env.PROVIDER_CONFIG_KEY));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function loadConfig(env, id) {
  const raw = await env.RAE_STORAGE.get(kvKey(id));
  if (!raw) return null;
  if (raw.startsWith("enc:")) {
    const key = await aesKey(env);
    if (!key) throw new Error("Config cifrada, mas PROVIDER_CONFIG_KEY não está definida no Worker.");
    const [, iv, ct] = raw.split(":");
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(iv) }, key, fromB64(ct));
    return JSON.parse(dec.decode(plain));
  }
  return JSON.parse(raw);
}

export async function saveConfig(env, id, patch) {
  const def = registryById(id);
  const old = (await loadConfig(env, id)) || {};
  const next = { ...old };
  for (const f of def.fields) {
    const v = patch.fields?.[f.key];
    if (v === undefined) continue;
    if (f.secret && v === "") continue; // campo secreto em branco = manter o atual
    next[f.key] = String(v).trim();
  }
  const envs = def.environments.map((e) => e.id);
  if (patch.environment && envs.includes(patch.environment)) next.environment = patch.environment;
  next.updatedAt = new Date().toISOString();
  const key = await aesKey(env);
  let value = JSON.stringify(next);
  if (key) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(value)));
    value = `enc:${toB64(iv)}:${toB64(ct)}`;
  }
  await env.RAE_STORAGE.put(kvKey(id), value);
  return next;
}

export const clearConfig = (env, id) => env.RAE_STORAGE.delete(kvKey(id));

function missingRequired(def, cfg) {
  return def.fields.filter((f) => f.required && !cfg?.[f.key]).map((f) => f.key);
}

/** O que o painel pode ver: segredos viram só "preenchido". */
export function publicConfig(def, cfg, encrypted) {
  const fields = {};
  for (const f of def.fields) fields[f.key] = f.secret ? { set: Boolean(cfg?.[f.key]) } : (cfg?.[f.key] || "");
  return { id: def.id, fields, environment: cfg?.environment || def.environments[0].id, updatedAt: cfg?.updatedAt || null, encrypted, configured: missingRequired(def, cfg).length === 0 && Boolean(cfg) };
}

/** Situação (só booleanos) de todos os provedores novos, para a lista. */
export async function adapterProviderStatus(env) {
  const out = [];
  for (const def of REGISTRY) {
    if (LEGACY.has(def.id)) continue;
    const cfg = await loadConfig(env, def.id).catch(() => null);
    const certOk = !def.certificate || Boolean(env[def.certificate]);
    out.push({ id: def.id, configured: Boolean(cfg) && missingRequired(def, cfg).length === 0, certificateInstalled: certOk });
  }
  return out;
}

/* ------------------------------ acesso do dono ------------------------------ */
// Sem login de terceiros: o painel envia a chave PROVIDER_ADMIN_KEY (segredo do Worker) em Authorization: Bearer.
async function sameKey(given, expected) {
  const h = async (x) => new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(String(x))));
  const [x, y] = [await h(given), await h(expected)];
  let d = 0; for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}
export async function verifyAdmin(request, env) {
  const given = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!env.PROVIDER_ADMIN_KEY || !given) return null;
  return (await sameKey(given, env.PROVIDER_ADMIN_KEY)) ? { admin: true } : null;
}

/* ------------------------------ operações de cobrança ------------------------------ */
async function webhookSecret(env) {
  let s = await env.RAE_STORAGE.get("providers:webhook-secret");
  if (!s) { s = toB64(crypto.getRandomValues(new Uint8Array(24))).replace(/[^A-Za-z0-9]/g, "x"); await env.RAE_STORAGE.put("providers:webhook-secret", s); }
  return s;
}

async function runtime(env, id, origin, overrideEnv) {
  const def = registryById(id), cfg = (await loadConfig(env, id)) || {};
  if (overrideEnv && def.environments.some((e) => e.id === overrideEnv)) cfg.environment = overrideEnv;
  const secret = await webhookSecret(env);
  const ctx = {
    fetch: (u, i) => fetch(u, i),
    webhookUrl: `${origin}/webhooks/${id}/${secret}`,
    mtls: (pid) => { const b = env[`MTLS_${pid.toUpperCase()}`]; return b?.fetch ? (u, i) => b.fetch(u, i) : null; }
  };
  return { def, cfg, ctx, adapter: ADAPTERS[id] };
}

export async function createPayment(env, id, payload, origin) {
  const { cfg, ctx, adapter } = await runtime(env, id, origin, payload.environment);
  return adapter.create(cfg, normInput(payload), ctx);
}
export async function createCarnet(env, id, payload, origin) {
  const { cfg, ctx, adapter } = await runtime(env, id, origin, payload.environment);
  return carnet(adapter, cfg, payload, ctx);
}
export async function getPayment(env, id, paymentId, origin, environment) {
  const { cfg, ctx, adapter } = await runtime(env, id, origin, environment);
  return adapter.get(cfg, paymentId, ctx);
}
export async function cancelPayment(env, id, paymentId, origin, environment) {
  const { cfg, ctx, adapter } = await runtime(env, id, origin, environment);
  return adapter.cancel(cfg, paymentId, ctx);
}

/**
 * Rotas /payment-providers/config/* , /payment-providers/webhook-info, /payment-providers/webhook-register
 * (com login de administrador) e /webhooks/<provedor>/<segredo> (público, segredo na URL).
 * `hooks` traz o pipeline financeiro do index.js. Devolve Response ou null.
 */
export async function providerRoutes({ request, env, url, path, json, hooks }) {
  const m = request.method;

  if (path.startsWith("/webhooks/") && m === "POST") {
    const [, , id, given] = path.split("/");
    const def = registryById(id), adapter = ADAPTERS[id];
    if (!def || !adapter) return json({ success: false, error: "Provedor desconhecido." }, 404);
    if (given !== (await env.RAE_STORAGE.get("providers:webhook-secret"))) return json({ success: false, error: "Segredo inválido." }, 401);
    const text = await request.text();
    let body = {};
    try { body = JSON.parse(text); } catch { body = Object.fromEntries(new URLSearchParams(text)); }
    const ids = [...new Set(adapter.webhookIds(body, url.searchParams))];
    const done = [];
    for (const pid of ids) {
      const payment = await getPayment(env, id, pid, url.origin).catch((e) => { console.error("webhook", id, e.message); return null; });
      if (!payment) continue;
      const studentId = await hooks.resolveStudent(env, payment);
      if (!studentId) { await hooks.saveEvent(env, { provider: id, payment }, null, "ignored_without_student"); continue; }
      await hooks.save(env, payment, studentId, payment.status === "DELETED" ? "PAYMENT_DELETED" : "PAYMENT_UPDATED");
      await hooks.recompute(env, studentId);
      await hooks.saveEvent(env, { provider: id, paymentId: pid }, studentId, "processed");
      done.push(pid);
    }
    return json({ success: true, received: true, processed: done.length }, 200); // 200 sempre: evita reenvio em loop
  }

  if (path === "/payment-providers/active") {
    if (m === "GET") return json({ success: true, config: (await env.RAE_STORAGE.get("providers:active", "json")) || null }, 200);
    if (m === "PUT") {
      if (!(await verifyAdmin(request, env))) return json({ success: false, error: "Chave de administrador inválida." }, 401);
      const b = await request.json();
      const def = registryById(b.provider);
      if (!def) return json({ success: false, error: "Provedor inválido." }, 400);
      const envId = def.environments.some((e) => e.id === b.environment) ? b.environment : def.environments[0].id;
      const config = { provider: def.id, environment: envId, testMode: Boolean(b.testMode) };
      await env.RAE_STORAGE.put("providers:active", JSON.stringify(config));
      return json({ success: true, config }, 200);
    }
  }

  if (!path.startsWith("/payment-providers/")) return null;
  const sub = path.slice("/payment-providers/".length).split("/");
  const isConfigRoute = sub[0] === "config" || sub[0] === "webhook-info" || sub[0] === "webhook-register";
  if (!isConfigRoute) return null;

  if (!(await verifyAdmin(request, env))) return json({ success: false, error: "Informe a chave de administrador." }, 401);

  if (sub[0] === "webhook-info" && m === "GET") {
    const secret = await webhookSecret(env);
    return json({ success: true, urls: Object.fromEntries(REGISTRY.filter((p) => ADAPTERS[p.id]).map((p) => [p.id, `${url.origin}/webhooks/${p.id}/${secret}`])) }, 200);
  }

  const id = sub[1], def = registryById(id);
  // Asaas guarda só a chave de API aqui; a Cora segue nos segredos do Worker (mTLS).
  if (!def || def.managed || (id !== "asaas" && !ADAPTERS[id])) return json({ success: false, error: "Provedor inválido." }, 400);

  if (sub[0] === "webhook-register" && m === "POST") {
    if (!ADAPTERS[id]?.registerWebhook) return json({ success: false, error: "Este provedor não registra webhook por API; use o painel dele." }, 400);
    const { cfg, ctx, adapter } = await runtime(env, id, url.origin);
    return json({ success: true, ...(await adapter.registerWebhook(cfg, ctx)) }, 200);
  }

  if (m === "GET") return json({ success: true, config: publicConfig(def, await loadConfig(env, id), Boolean(env.PROVIDER_CONFIG_KEY)) }, 200);
  if (m === "PUT") {
    const body = await request.json();
    const cfg = await saveConfig(env, id, body);
    return json({ success: true, config: publicConfig(def, cfg, Boolean(env.PROVIDER_CONFIG_KEY)) }, 200);
  }
  if (m === "DELETE") { await clearConfig(env, id); return json({ success: true }, 200); }
  return null;
}

/** Chave do Asaas salva pelo painel vale quando o segredo ASAAS_API_KEY não existe no Worker. */
export async function withStoredAsaasKey(env) {
  if (env.ASAAS_API_KEY) return env;
  const cfg = await loadConfig(env, "asaas").catch(() => null);
  return cfg?.apiKey ? { ...env, ASAAS_API_KEY: cfg.apiKey } : env;
}

/** Teste de conexão (usado por /payment-providers/test para provedores novos). */
export async function testAdapterProvider(env, id, origin, environment) {
  const { cfg, ctx, adapter } = await runtime(env, id, origin, environment);
  return adapter.test(cfg, ctx);
}
