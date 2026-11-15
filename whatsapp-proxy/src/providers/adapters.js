/**
 * Adaptadores de provedores de pagamento. Cada um devolve o formato "tipo Asaas" que o
 * front já usa: { id, provider, status PENDING|RECEIVED|OVERDUE|DELETED, value (reais),
 * dueDate, billingType, invoiceUrl, bankSlipUrl, pixQrCode (copia e cola), pixQrCodeUrl
 * (base64 puro, sem "data:"), externalReference, ... }.
 * ctx = { fetch, webhookUrl, mtls(id) }; cfg = campos salvos pelo dono (registry.json).
 */

const UA = "PeNaGrama-Pagamentos/1.0";
const only = (s) => String(s || "").replace(/\D/g, "");
const b64 = (s) => btoa(s);
const stripDataUri = (s) => String(s || "").replace(/^data:image\/\w+;base64,/, "");
const today = () => new Date().toISOString().slice(0, 10);
const form = (o, pre = "", out = []) => {
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined || v === null || v === "") continue;
    const key = pre ? `${pre}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((x, i) => (typeof x === "object" ? form(x, `${key}[${i}]`, out) : out.push([`${key}[]`, x])));
    else if (typeof v === "object") form(v, key, out);
    else out.push([key, v]);
  }
  return out;
};
const formBody = (o) => new URLSearchParams(form(o)).toString();

/** Entrada normalizada a partir do payload do front (amount em centavos OU value em reais). */
export function normInput(p) {
  const cents = p.amount !== undefined ? Math.round(Number(p.amount)) : Math.round(Number(p.value || 0) * 100);
  const a = p.address || p.responsibleAddress || {};
  const phone = only(p.responsiblePhone || p.phone);
  return {
    cents, value: cents / 100,
    billingType: String(p.billingType || "PIX").toUpperCase(),
    name: p.responsibleName || p.name || "Responsável",
    cpf: only(p.responsibleCpf || p.cpf || p.document),
    email: p.responsibleEmail || p.email || "",
    phone, ddd: phone.length > 9 ? phone.replace(/^55/, "").slice(0, 2) : "", phoneNumber: phone.replace(/^55/, "").slice(-9),
    dueDate: p.dueDate || today(),
    description: p.description || "Cobrança",
    ref: String(p.externalReference || p.registrationId || `PNG_${Date.now()}`).slice(0, 60),
    address: {
      street: a.street || a.logradouro || "Rua não informada", number: String(a.number || a.numero || "S/N"),
      district: a.district || a.bairro || "Centro", city: a.city || a.cidade || "São Paulo",
      state: a.state || a.uf || "SP", zip: only(a.zipCode || a.cep) || "01001000"
    }
  };
}

function out(provider, o) {
  return {
    provider, id: String(o.id), status: o.status || "PENDING", value: o.value ?? 0, netValue: o.netValue ?? o.value ?? 0,
    dueDate: o.dueDate || null, description: o.description || "", billingType: o.billingType || "PIX",
    invoiceUrl: o.invoiceUrl || null, bankSlipUrl: o.bankSlipUrl || null,
    pixQrCode: o.pixQrCode || null, pixQrCodeUrl: o.pixQrCodeUrl ? stripDataUri(o.pixQrCodeUrl) : null,
    externalReference: o.externalReference || null, customer: o.customer || null,
    dateCreated: o.dateCreated || new Date().toISOString(), paymentDate: o.paymentDate || null
  };
}

async function call(ctx, provider, url, init = {}) {
  const f = init.fetcher || ctx.fetch;
  const { fetcher, ...rest } = init;
  const res = await f(url, { ...rest, headers: { "User-Agent": UA, ...(rest.headers || {}) } });
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text.slice(0, 300) }; }
  if (!res.ok) {
    const e = data.message || data.error?.message || data.error_description || data.error || data.errors?.[0]?.description || data.errors?.[0]?.message ||
      (Array.isArray(data.cause) && data.cause[0]?.description) || data.detail || data.raw || "";
    const err = new Error(`${provider}: ${typeof e === "string" ? e : JSON.stringify(e)} (HTTP ${res.status})`.replace(/\s+/g, " "));
    err.status = res.status;
    throw err;
  }
  return data;
}
const json = (o) => JSON.stringify(o);
const need = (cfg, ...keys) => { for (const k of keys) if (!cfg[k]) throw new Error(`Configure o campo "${k}" deste provedor antes de usar.`); };
const sandbox = (cfg) => cfg.environment === "sandbox";

/* ----------------------------- Mercado Pago ----------------------------- */
const MP = "https://api.mercadopago.com";
const mpStatus = { approved: "RECEIVED", authorized: "RECEIVED", pending: "PENDING", in_process: "PENDING", cancelled: "DELETED", rejected: "DELETED", refunded: "DELETED", charged_back: "DELETED" };
const mpHead = (cfg) => ({ Authorization: `Bearer ${cfg.accessToken}`, "Content-Type": "application/json" });
function mpOut(d) {
  const t = d.point_of_interaction?.transaction_data || {};
  const boleto = d.payment_method_id !== "pix";
  return out("mercadopago", {
    id: d.id, status: mpStatus[d.status] || "PENDING", value: d.transaction_amount, dueDate: (d.date_of_expiration || "").slice(0, 10),
    description: d.description, billingType: boleto ? "BOLETO" : "PIX", externalReference: d.external_reference,
    invoiceUrl: t.ticket_url || d.transaction_details?.external_resource_url, bankSlipUrl: boleto ? d.transaction_details?.external_resource_url : null,
    pixQrCode: t.qr_code, pixQrCodeUrl: t.qr_code_base64, paymentDate: d.date_approved
  });
}

/* -------------------------------- PagBank -------------------------------- */
const pbBase = (cfg) => (sandbox(cfg) ? "https://sandbox.api.pagseguro.com" : "https://api.pagseguro.com");
function pbOut(d) {
  const ch = d.charges?.[0], qr = d.qr_codes?.[0];
  const st = ch?.status;
  const link = (rel) => (ch?.links || []).find((l) => l.rel === rel)?.href;
  const bol = ch?.payment_method?.boleto;
  return out("pagbank", {
    id: d.id, status: st === "PAID" ? "RECEIVED" : st === "CANCELED" || st === "DECLINED" ? "DELETED" : "PENDING",
    value: (ch?.amount?.value ?? qr?.amount?.value ?? 0) / 100, dueDate: bol?.due_date || (qr?.expiration_date || "").slice(0, 10),
    billingType: ch ? "BOLETO" : "PIX", externalReference: d.reference_id, description: d.items?.[0]?.name,
    pixQrCode: qr?.text, bankSlipUrl: (ch?.links || []).find((l) => l.media === "application/pdf")?.href || link("BOLETO"),
    invoiceUrl: (ch?.links || []).find((l) => l.media === "application/pdf")?.href, paymentDate: ch?.paid_at
  });
}

/* -------------------------------- Pagar.me -------------------------------- */
const pgBase = "https://api.pagar.me/core/v5";
const pgHead = (cfg) => ({ Authorization: `Basic ${b64(cfg.secretKey + ":")}`, "Content-Type": "application/json" });
function pgOut(d) {
  const ch = d.charges?.[0], t = ch?.last_transaction || {};
  const st = ch?.status || d.status;
  return out("pagarme", {
    id: d.id, status: st === "paid" || st === "overpaid" ? "RECEIVED" : st === "canceled" || st === "failed" ? "DELETED" : "PENDING",
    value: (ch?.amount ?? d.amount ?? 0) / 100, dueDate: (t.due_at || t.expires_at || "").slice(0, 10), billingType: ch?.payment_method === "boleto" ? "BOLETO" : "PIX",
    externalReference: d.code, description: d.items?.[0]?.description, pixQrCode: t.qr_code, bankSlipUrl: t.pdf || t.url, invoiceUrl: t.url || t.pdf,
    paymentDate: ch?.paid_at
  });
}

/* ---------------------------------- iugu ---------------------------------- */
const iuguHead = (cfg) => ({ Authorization: `Basic ${b64(cfg.apiToken + ":")}`, "Content-Type": "application/json", Accept: "application/json" });
const iuguStatus = { paid: "RECEIVED", partially_paid: "PENDING", canceled: "DELETED", expired: "OVERDUE", refunded: "DELETED", chargeback: "DELETED" };
function iuguOut(d) {
  const slip = d.bank_slip || {};
  return out("iugu", {
    id: d.id, status: iuguStatus[d.status] || "PENDING", value: (d.total_cents ?? 0) / 100, dueDate: d.due_date,
    billingType: slip.digitable_line ? "BOLETO" : "PIX", externalReference: d.order_id, description: d.items?.[0]?.description,
    invoiceUrl: d.secure_url, bankSlipUrl: slip.bank_slip_pdf_url || slip.bank_slip_url, pixQrCode: d.pix?.qrcode_text, pixQrCodeUrl: null,
    paymentDate: d.paid_at
  });
}

/* ---------------------------------- Woovi ---------------------------------- */
const wvBase = "https://api.openpix.com.br/api/v1";
function wvOut(d) {
  const c = d.charge || d;
  return out("woovi", {
    id: c.correlationID, status: c.status === "COMPLETED" ? "RECEIVED" : c.status === "EXPIRED" ? "OVERDUE" : "PENDING",
    value: (c.value ?? 0) / 100, dueDate: (c.expiresDate || "").slice(0, 10), externalReference: c.correlationID, description: c.comment,
    invoiceUrl: c.paymentLinkUrl, pixQrCode: c.brCode, paymentDate: c.paidAt
  });
}

/* -------------------------------- AbacatePay -------------------------------- */
const abBase = "https://api.abacatepay.com/v2";
const abHead = (cfg) => ({ Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" });
function abOut(d, input) {
  const x = d.data || d;
  return out("abacatepay", {
    id: x.id, status: x.status === "PAID" ? "RECEIVED" : x.status === "EXPIRED" ? "OVERDUE" : x.status === "CANCELLED" ? "DELETED" : "PENDING",
    value: (x.amount ?? input?.cents ?? 0) / 100, dueDate: (x.expiresAt || "").slice(0, 10), pixQrCode: x.brCode, pixQrCodeUrl: x.brCodeBase64,
    externalReference: x.metadata?.externalId || input?.ref, description: x.description
  });
}

/* ---------------------------------- Stripe ---------------------------------- */
const stBase = "https://api.stripe.com/v1";
const stHead = (cfg) => ({ Authorization: `Bearer ${cfg.secretKey}`, "Content-Type": "application/x-www-form-urlencoded" });
function stOut(d) {
  if (d.object === "checkout.session") {
    return out("stripe", {
      id: d.id, status: d.payment_status === "paid" ? "RECEIVED" : d.status === "expired" ? "DELETED" : "PENDING", value: (d.amount_total ?? 0) / 100,
      billingType: "CREDIT_CARD", invoiceUrl: d.url, externalReference: d.client_reference_id || d.metadata?.ref
    });
  }
  const n = d.next_action || {};
  const pix = n.pix_display_qr_code, bol = n.boleto_display_details;
  return out("stripe", {
    id: d.id, status: d.status === "succeeded" ? "RECEIVED" : d.status === "canceled" ? "DELETED" : "PENDING", value: (d.amount ?? 0) / 100,
    dueDate: ((pix?.expires_at || bol?.expires_at) ? new Date((pix?.expires_at || bol?.expires_at) * 1000).toISOString() : "").slice(0, 10),
    billingType: bol ? "BOLETO" : "PIX", externalReference: d.metadata?.ref, description: d.description,
    invoiceUrl: pix?.hosted_instructions_url || bol?.hosted_voucher_url, bankSlipUrl: bol?.pdf || bol?.hosted_voucher_url, pixQrCode: pix?.data
  });
}

/* ---------------------------------- PayPal ---------------------------------- */
const ppBase = (cfg) => (sandbox(cfg) ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com");
async function ppToken(cfg, ctx) {
  const d = await call(ctx, "paypal", `${ppBase(cfg)}/v1/oauth2/token`, {
    method: "POST", headers: { Authorization: `Basic ${b64(`${cfg.clientId}:${cfg.clientSecret}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials"
  });
  return d.access_token;
}
function ppOut(d) {
  const pu = d.purchase_units?.[0] || {};
  const cap = pu.payments?.captures?.[0];
  const st = d.status;
  return out("paypal", {
    id: d.id, status: st === "COMPLETED" ? "RECEIVED" : st === "VOIDED" ? "DELETED" : "PENDING", value: Number(pu.amount?.value || 0),
    billingType: "CREDIT_CARD", externalReference: pu.custom_id || pu.reference_id, description: pu.description,
    invoiceUrl: (d.links || []).find((l) => l.rel === "payer-action" || l.rel === "approve")?.href, paymentDate: cap?.create_time
  });
}

/* ---------------------------------- Cielo ---------------------------------- */
const cieloUrls = (cfg) => (sandbox(cfg)
  ? { tx: "https://apisandbox.cieloecommerce.cielo.com.br", q: "https://apiquerysandbox.cieloecommerce.cielo.com.br" }
  : { tx: "https://api.cieloecommerce.cielo.com.br", q: "https://apiquery.cieloecommerce.cielo.com.br" });
const cieloHead = (cfg) => ({ MerchantId: cfg.merchantId, MerchantKey: cfg.merchantKey, "Content-Type": "application/json" });
function cieloOut(d) {
  const p = d.Payment || d;
  const st = p.Status;
  return out("cielo", {
    id: p.PaymentId, status: st === 2 || st === 1 ? "RECEIVED" : [3, 10, 11, 13].includes(st) ? "DELETED" : "PENDING", value: (p.Amount ?? 0) / 100,
    dueDate: (p.ExpirationDate || "").slice(0, 10), billingType: p.Type === "Boleto" ? "BOLETO" : "PIX", externalReference: d.MerchantOrderId,
    bankSlipUrl: p.Url, invoiceUrl: p.Url, pixQrCode: p.QrCodeString, pixQrCodeUrl: p.QrCodeBase64Image, paymentDate: p.ReceivedDate
  });
}

/* ---------------------------------- Vindi ---------------------------------- */
const vdBase = (cfg) => (sandbox(cfg) ? "https://sandbox-app.vindi.com.br/api/v1" : "https://app.vindi.com.br/api/v1");
const vdHead = (cfg) => ({ Authorization: `Basic ${b64(cfg.apiKey + ":")}`, "Content-Type": "application/json" });
function vdOut(d) {
  const b = d.bill || d, ch = b.charges?.[0], t = ch?.last_transaction, g = t?.gateway_response_fields || {};
  const code = b.payment_method?.code || ch?.payment_method?.code;
  return out("vindi", {
    id: b.id, status: b.status === "paid" ? "RECEIVED" : b.status === "canceled" ? "DELETED" : "PENDING", value: Number(b.amount || 0),
    dueDate: (b.due_at || b.created_at || "").slice(0, 10), billingType: code === "bank_slip" ? "BOLETO" : code === "credit_card" ? "CREDIT_CARD" : "PIX",
    externalReference: b.code, invoiceUrl: ch?.print_url || b.url, bankSlipUrl: ch?.print_url, pixQrCode: g.qrcode_original_path, paymentDate: ch?.paid_at
  });
}

/* ---------------------------------- Zoop ---------------------------------- */
const zpBase = (cfg) => `https://api.zoop.ws/v1/marketplaces/${encodeURIComponent(cfg.marketplaceId)}`;
const zpHead = (cfg) => ({ Authorization: `Basic ${b64(cfg.publishableKey + ":")}`, "Content-Type": "application/json" });
function zpOut(d) {
  const s = String(d.status || "").toLowerCase();
  return out("zoop", {
    id: d.id, status: s === "succeeded" ? "RECEIVED" : s === "canceled" || s === "failed" ? "DELETED" : "PENDING", value: Number(d.amount || 0) / 100,
    externalReference: d.reference_id, description: d.description, pixQrCode: d.qr_code?.emv || d.payment_method?.qr_code?.emv
  });
}

/* ------------- Pix padrão BACEN (Efí, Inter, Sicoob): /cob e /loc ------------- */
const BACEN = {
  efi: { base: (c) => (sandbox(c) ? "https://pix-h.api.efipay.com.br" : "https://pix.api.efipay.com.br"), token: "/oauth/token", prefix: "/v2", basic: true, scope: false },
  inter: { base: () => "https://cdpj.partners.bancointer.com.br", token: "/oauth/v2/token", prefix: "/pix/v2", basic: false, scope: "cob.write cob.read webhook.write webhook.read" },
  sicoob: { base: () => "https://api.sicoob.com.br", token: null, tokenUrl: "https://auth.sicoob.com.br/auth/realms/cooperado/protocol/openid-connect/token", prefix: "/pix/api/v2", basic: false, scope: "cob.write cob.read webhook.write webhook.read" }
};
const bacenStatus = { CONCLUIDA: "RECEIVED", REMOVIDA_PELO_USUARIO_RECEBEDOR: "DELETED", REMOVIDA_PELO_PSP: "DELETED" };
const randomTxid = () => { const a = new Uint8Array(16); crypto.getRandomValues(a); return [...a].map((x) => x.toString(16).padStart(2, "0")).join(""); };

function bacenFetcher(id, ctx) {
  const f = ctx.mtls?.(id);
  if (!f) throw new Error(`Certificado não instalado: crie o binding mTLS ${"MTLS_" + id.toUpperCase()} no Cloudflare (veja docs/provedores-de-pagamento.md).`);
  return f;
}
async function bacenToken(id, cfg, ctx) {
  const b = BACEN[id], fetcher = bacenFetcher(id, ctx);
  const headers = { "Content-Type": b.basic ? "application/json" : "application/x-www-form-urlencoded" };
  let body;
  if (b.basic) { headers.Authorization = `Basic ${b64(`${cfg.clientId}:${cfg.clientSecret}`)}`; body = json({ grant_type: "client_credentials" }); }
  else {
    const p = { client_id: cfg.clientId, grant_type: "client_credentials", scope: b.scope };
    if (cfg.clientSecret) p.client_secret = cfg.clientSecret;
    body = new URLSearchParams(p).toString();
  }
  const d = await call(ctx, id, b.tokenUrl || b.base(cfg) + b.token, { method: "POST", headers, body, fetcher });
  return d.access_token;
}
async function bacenCall(id, cfg, ctx, method, path, body) {
  const b = BACEN[id], fetcher = bacenFetcher(id, ctx), token = await bacenToken(id, cfg, ctx);
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  if (id === "inter" && cfg.accountNumber) headers["x-conta-corrente"] = cfg.accountNumber;
  return call(ctx, id, b.base(cfg) + b.prefix + path, { method, headers, body: body ? json(body) : undefined, fetcher });
}
function bacenOut(id, d) {
  const ref = (d.infoAdicionais || []).find((x) => x.nome === "ref")?.valor;
  return out(id, {
    id: d.txid, status: bacenStatus[d.status] || (d.pix?.length ? "RECEIVED" : "PENDING"), value: Number(d.valor?.original || 0),
    dueDate: d.calendario?.criacao ? new Date(new Date(d.calendario.criacao).getTime() + (d.calendario.expiracao || 0) * 1000).toISOString().slice(0, 10) : null,
    externalReference: ref, description: d.solicitacaoPagador, pixQrCode: d.pixCopiaECola, paymentDate: d.pix?.[0]?.horario
  });
}
const bacenAdapter = (id) => ({
  async create(cfg, p, ctx) {
    need(cfg, "clientId", "pixKey");
    if (p.billingType !== "PIX") throw new Error("Este provedor aceita apenas Pix.");
    const txid = randomTxid();
    const body = {
      calendario: { expiracao: Math.max(3600, Math.round((new Date(`${p.dueDate}T23:59:59-03:00`) - Date.now()) / 1000)) },
      valor: { original: p.value.toFixed(2) }, chave: cfg.pixKey, solicitacaoPagador: p.description.slice(0, 140),
      infoAdicionais: [{ nome: "ref", valor: p.ref }]
    };
    if (p.cpf.length === 11) body.devedor = { cpf: p.cpf, nome: p.name };
    else if (p.cpf.length === 14) body.devedor = { cnpj: p.cpf, nome: p.name };
    return bacenOut(id, await bacenCall(id, cfg, ctx, "PUT", `/cob/${txid}`, body));
  },
  async get(cfg, pid, ctx) { return bacenOut(id, await bacenCall(id, cfg, ctx, "GET", `/cob/${encodeURIComponent(pid)}`)); },
  async cancel(cfg, pid, ctx) { await bacenCall(id, cfg, ctx, "PATCH", `/cob/${encodeURIComponent(pid)}`, { status: "REMOVIDA_PELO_USUARIO_RECEBEDOR" }); return { id: pid, deleted: true }; },
  async test(cfg, ctx) { need(cfg, "clientId"); await bacenToken(id, cfg, ctx); return { message: "Autenticação mTLS + OAuth ok." }; },
  async registerWebhook(cfg, ctx) {
    need(cfg, "pixKey");
    const b = BACEN[id], fetcher = bacenFetcher(id, ctx), token = await bacenToken(id, cfg, ctx);
    await call(ctx, id, `${b.base(cfg)}${b.prefix}/webhook/${encodeURIComponent(cfg.pixKey)}`, {
      method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "x-skip-mtls-checking": "true" },
      body: json({ webhookUrl: ctx.webhookUrl }), fetcher
    });
    return { message: "Webhook registrado." };
  },
  // callback Pix: { pix: [{ endToEndId, txid, valor, horario }] }
  webhookIds: (body) => (body.pix || []).map((x) => x.txid).filter(Boolean)
});

/* ------------------------------ tabela de adaptadores ------------------------------ */
export const ADAPTERS = {
  mercadopago: {
    async create(cfg, p, ctx) {
      need(cfg, "accessToken");
      const [first, ...rest] = p.name.split(" ");
      const payer = { email: p.email || "financeiro@example.com", first_name: first, last_name: rest.join(" ") || first };
      if (p.cpf) payer.identification = { type: p.cpf.length > 11 ? "CNPJ" : "CPF", number: p.cpf };
      const body = {
        transaction_amount: p.value, description: p.description, external_reference: p.ref, notification_url: ctx.webhookUrl,
        payment_method_id: p.billingType === "BOLETO" ? "bolbradesco" : "pix", payer,
        date_of_expiration: `${p.dueDate}T23:59:59.000-03:00`
      };
      if (p.billingType === "BOLETO") payer.address = { zip_code: p.address.zip, street_name: p.address.street, street_number: p.address.number, neighborhood: p.address.district, city: p.address.city, federal_unit: p.address.state };
      return mpOut(await call(ctx, "mercadopago", `${MP}/v1/payments`, { method: "POST", headers: { ...mpHead(cfg), "X-Idempotency-Key": crypto.randomUUID() }, body: json(body) }));
    },
    async get(cfg, id, ctx) { return mpOut(await call(ctx, "mercadopago", `${MP}/v1/payments/${encodeURIComponent(id)}`, { headers: mpHead(cfg) })); },
    async cancel(cfg, id, ctx) { await call(ctx, "mercadopago", `${MP}/v1/payments/${encodeURIComponent(id)}`, { method: "PUT", headers: mpHead(cfg), body: json({ status: "cancelled" }) }); return { id, deleted: true }; },
    async test(cfg, ctx) { need(cfg, "accessToken"); const u = await call(ctx, "mercadopago", `${MP}/users/me`, { headers: mpHead(cfg) }); return { message: `Conta ${u.nickname || u.email || u.id} autenticada.` }; },
    // { type:"payment", data:{ id } } (ou ?data.id=)
    webhookIds: (b, q) => [b?.data?.id || q.get("data.id") || q.get("id")].filter(Boolean)
  },

  pagbank: {
    async create(cfg, p, ctx) {
      need(cfg, "token");
      const body = {
        reference_id: p.ref, notification_urls: ctx.webhookUrl ? [ctx.webhookUrl] : undefined,
        customer: { name: p.name, email: p.email || "financeiro@example.com", tax_id: p.cpf || undefined, phones: p.ddd ? [{ country: "55", area: p.ddd, number: p.phoneNumber, type: "MOBILE" }] : undefined },
        items: [{ name: p.description.slice(0, 100), quantity: 1, unit_amount: p.cents }]
      };
      if (p.billingType === "BOLETO") {
        body.charges = [{
          reference_id: p.ref, description: p.description.slice(0, 63), amount: { value: p.cents, currency: "BRL" },
          payment_method: { type: "BOLETO", boleto: { due_date: p.dueDate, instruction_lines: { line_1: "Pagamento até o vencimento", line_2: p.description.slice(0, 75) }, holder: { name: p.name, tax_id: p.cpf, email: p.email || "financeiro@example.com", address: { street: p.address.street, number: p.address.number, locality: p.address.district, city: p.address.city, region: p.address.state, region_code: p.address.state, country: "BRA", postal_code: p.address.zip } } } }
        }];
      } else {
        body.qr_codes = [{ amount: { value: p.cents }, expiration_date: `${p.dueDate}T23:59:59-03:00` }];
      }
      return pbOut(await call(ctx, "pagbank", `${pbBase(cfg)}/orders`, { method: "POST", headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json", "x-idempotency-key": crypto.randomUUID() }, body: json(body) }));
    },
    async get(cfg, id, ctx) { return pbOut(await call(ctx, "pagbank", `${pbBase(cfg)}/orders/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${cfg.token}` } })); },
    async cancel(cfg, id, ctx) {
      const o = await call(ctx, "pagbank", `${pbBase(cfg)}/orders/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${cfg.token}` } });
      const ch = o.charges?.[0];
      if (!ch) throw new Error("PagBank: Pix sem pagamento expira sozinho; não há cobrança para cancelar.");
      await call(ctx, "pagbank", `${pbBase(cfg)}/charges/${ch.id}/cancel`, { method: "POST", headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" }, body: json({ amount: { value: ch.amount.value } }) });
      return { id, deleted: true };
    },
    // 404 com token válido; 401/403 com token inválido
    async test(cfg, ctx) {
      need(cfg, "token");
      try { await call(ctx, "pagbank", `${pbBase(cfg)}/orders/ORDE_00000000-0000-0000-0000-000000000000`, { headers: { Authorization: `Bearer ${cfg.token}` } }); }
      catch (e) { if (e.status === 401 || e.status === 403) throw e; }
      return { message: "Token aceito pelo PagBank." };
    },
    // o corpo é o próprio pedido (id ORDE_...)
    webhookIds: (b) => [b?.id].filter((x) => String(x).startsWith("ORDE_"))
  },

  pagarme: {
    async create(cfg, p, ctx) {
      need(cfg, "secretKey");
      const pay = p.billingType === "BOLETO"
        ? { payment_method: "boleto", boleto: { instructions: p.description.slice(0, 256), due_at: `${p.dueDate}T23:59:59Z`, document_number: p.ref.replace(/\D/g, "").slice(0, 16) || undefined, type: "DM" } }
        : { payment_method: "pix", pix: { expires_at: `${p.dueDate}T23:59:59Z` } };
      const body = {
        code: p.ref, items: [{ amount: p.cents, description: p.description.slice(0, 256), quantity: 1, code: p.ref }],
        customer: {
          name: p.name, email: p.email || "financeiro@example.com", document: p.cpf, document_type: p.cpf.length > 11 ? "CNPJ" : "CPF", type: p.cpf.length > 11 ? "company" : "individual",
          phones: p.ddd ? { mobile_phone: { country_code: "55", area_code: p.ddd, number: p.phoneNumber } } : undefined,
          address: { line_1: `${p.address.number}, ${p.address.street}, ${p.address.district}`, zip_code: p.address.zip, city: p.address.city, state: p.address.state, country: "BR" }
        },
        payments: [pay]
      };
      return pgOut(await call(ctx, "pagarme", `${pgBase}/orders`, { method: "POST", headers: pgHead(cfg), body: json(body) }));
    },
    async get(cfg, id, ctx) { return pgOut(await call(ctx, "pagarme", `${pgBase}/orders/${encodeURIComponent(id)}`, { headers: pgHead(cfg) })); },
    async cancel(cfg, id, ctx) {
      const o = await call(ctx, "pagarme", `${pgBase}/orders/${encodeURIComponent(id)}`, { headers: pgHead(cfg) });
      const ch = o.charges?.[0]; if (!ch) throw new Error("Pagar.me: pedido sem cobrança.");
      await call(ctx, "pagarme", `${pgBase}/charges/${ch.id}`, { method: "DELETE", headers: pgHead(cfg) });
      return { id, deleted: true };
    },
    async test(cfg, ctx) { need(cfg, "secretKey"); await call(ctx, "pagarme", `${pgBase}/orders?size=1`, { headers: pgHead(cfg) }); return { message: "Chave aceita pelo Pagar.me." }; },
    // order.*: data.id = or_...; charge.*: data.order.id
    webhookIds: (b) => [b?.data?.order?.id || (String(b?.data?.id || "").startsWith("or_") ? b.data.id : null)].filter(Boolean)
  },

  iugu: {
    async create(cfg, p, ctx) {
      need(cfg, "apiToken");
      const body = {
        email: p.email || "financeiro@example.com", due_date: p.dueDate, order_id: p.ref, notification_url: ctx.webhookUrl,
        payable_with: p.billingType === "BOLETO" ? ["bank_slip"] : ["pix"], items: [{ description: p.description, quantity: 1, price_cents: p.cents }],
        payer: { name: p.name, cpf_cnpj: p.cpf, email: p.email || "financeiro@example.com", phone_prefix: p.ddd, phone: p.phoneNumber, address: { zip_code: p.address.zip, number: p.address.number, street: p.address.street, district: p.address.district, city: p.address.city, state: p.address.state, country: "Brasil" } }
      };
      return iuguOut(await call(ctx, "iugu", "https://api.iugu.com/v1/invoices", { method: "POST", headers: iuguHead(cfg), body: json(body) }));
    },
    async get(cfg, id, ctx) { return iuguOut(await call(ctx, "iugu", `https://api.iugu.com/v1/invoices/${encodeURIComponent(id)}`, { headers: iuguHead(cfg) })); },
    async cancel(cfg, id, ctx) { await call(ctx, "iugu", `https://api.iugu.com/v1/invoices/${encodeURIComponent(id)}/cancel`, { method: "PUT", headers: iuguHead(cfg) }); return { id, deleted: true }; },
    async test(cfg, ctx) { need(cfg, "apiToken"); await call(ctx, "iugu", "https://api.iugu.com/v1/invoices?limit=1", { headers: iuguHead(cfg) }); return { message: "Token aceito pela iugu." }; },
    // gatilho vem como formulário: event=invoice.status_changed&data[id]=...
    webhookIds: (b) => [b?.data?.id || b?.["data[id]"]].filter(Boolean)
  },

  vindi: {
    async create(cfg, p, ctx) {
      need(cfg, "apiKey", "productId");
      const base = vdBase(cfg), h = vdHead(cfg);
      const found = p.cpf ? await call(ctx, "vindi", `${base}/customers?query=${encodeURIComponent(`registry_code:${p.cpf}`)}`, { headers: h }) : { customers: [] };
      let customer = found.customers?.[0];
      if (!customer) {
        const c = await call(ctx, "vindi", `${base}/customers`, { method: "POST", headers: h, body: json({ name: p.name, email: p.email || undefined, registry_code: p.cpf || undefined, code: p.cpf || p.ref, phones: p.phone ? [{ phone_type: "mobile", number: `55${p.ddd}${p.phoneNumber}` }] : undefined }) });
        customer = c.customer;
      }
      const method = p.billingType === "BOLETO" ? "bank_slip" : p.billingType === "CREDIT_CARD" ? "credit_card" : "pix";
      const d = await call(ctx, "vindi", `${base}/bills`, { method: "POST", headers: h, body: json({ customer_id: customer.id, payment_method_code: method, code: p.ref, due_at: p.dueDate, bill_items: [{ product_id: Number(cfg.productId), amount: p.value, description: p.description }] }) });
      return vdOut(d);
    },
    async get(cfg, id, ctx) { return vdOut(await call(ctx, "vindi", `${vdBase(cfg)}/bills/${encodeURIComponent(id)}`, { headers: vdHead(cfg) })); },
    async cancel(cfg, id, ctx) { await call(ctx, "vindi", `${vdBase(cfg)}/bills/${encodeURIComponent(id)}`, { method: "DELETE", headers: vdHead(cfg) }); return { id, deleted: true }; },
    async test(cfg, ctx) { need(cfg, "apiKey"); await call(ctx, "vindi", `${vdBase(cfg)}/customers?per_page=1`, { headers: vdHead(cfg) }); return { message: "Chave aceita pela Vindi." }; },
    // { event: { type, data: { bill: { id } } } } ou charge.bill.id
    webhookIds: (b) => [b?.event?.data?.bill?.id || b?.event?.data?.charge?.bill?.id].filter(Boolean)
  },

  woovi: {
    async create(cfg, p, ctx) {
      need(cfg, "appId");
      const secs = Math.max(3600, Math.round((new Date(`${p.dueDate}T23:59:59-03:00`) - Date.now()) / 1000));
      const body = { correlationID: p.ref, value: p.cents, comment: p.description.slice(0, 140), expiresIn: secs, customer: { name: p.name, taxID: p.cpf || undefined, email: p.email || undefined, phone: p.phone ? `55${p.ddd}${p.phoneNumber}` : undefined } };
      return wvOut(await call(ctx, "woovi", `${wvBase}/charge`, { method: "POST", headers: { Authorization: cfg.appId, "Content-Type": "application/json" }, body: json(body) }));
    },
    async get(cfg, id, ctx) { return wvOut(await call(ctx, "woovi", `${wvBase}/charge/${encodeURIComponent(id)}`, { headers: { Authorization: cfg.appId } })); },
    async cancel(cfg, id, ctx) { await call(ctx, "woovi", `${wvBase}/charge/${encodeURIComponent(id)}`, { method: "DELETE", headers: { Authorization: cfg.appId } }); return { id, deleted: true }; },
    async test(cfg, ctx) { need(cfg, "appId"); await call(ctx, "woovi", `${wvBase}/charge?limit=1`, { headers: { Authorization: cfg.appId } }); return { message: "AppID aceito pela Woovi." }; },
    webhookIds: (b) => [b?.charge?.correlationID].filter(Boolean)
  },

  abacatepay: {
    async create(cfg, p, ctx) {
      need(cfg, "apiKey");
      if (p.billingType !== "PIX") throw new Error("AbacatePay: apenas Pix neste adaptador.");
      const secs = Math.max(3600, Math.round((new Date(`${p.dueDate}T23:59:59-03:00`) - Date.now()) / 1000));
      const body = { method: "PIX", data: { amount: p.cents, description: p.description.slice(0, 37), expiresIn: secs, customer: p.cpf ? { name: p.name, email: p.email || undefined, cellphone: p.phone || undefined, taxId: p.cpf } : undefined, metadata: { externalId: p.ref } } };
      return abOut(await call(ctx, "abacatepay", `${abBase}/transparents/create`, { method: "POST", headers: abHead(cfg), body: json(body) }), p);
    },
    async get(cfg, id, ctx) { return abOut(await call(ctx, "abacatepay", `${abBase}/transparents/check?id=${encodeURIComponent(id)}`, { headers: abHead(cfg) })); },
    async cancel() { throw new Error("AbacatePay: o Pix expira sozinho; cancelamento não está disponível."); },
    async test(cfg, ctx) {
      need(cfg, "apiKey");
      try { await call(ctx, "abacatepay", `${abBase}/transparents/check?id=teste`, { headers: abHead(cfg) }); }
      catch (e) { if (e.status === 401 || e.status === 403) throw e; }
      return { message: "Chave aceita pela AbacatePay." };
    },
    webhookIds: (b) => [b?.data?.transparent?.id || b?.data?.id].filter(Boolean)
  },

  zoop: {
    async create(cfg, p, ctx) {
      need(cfg, "marketplaceId", "sellerId", "publishableKey");
      if (p.billingType !== "PIX") throw new Error("Zoop: apenas Pix neste adaptador.");
      const body = { amount: p.cents, currency: "BRL", description: p.description, payment_type: "pix", on_behalf_of: cfg.sellerId, reference_id: p.ref, capture: true };
      return zpOut(await call(ctx, "zoop", `${zpBase(cfg)}/transactions`, { method: "POST", headers: zpHead(cfg), body: json(body) }));
    },
    async get(cfg, id, ctx) { return zpOut(await call(ctx, "zoop", `${zpBase(cfg)}/transactions/${encodeURIComponent(id)}`, { headers: zpHead(cfg) })); },
    async cancel(cfg, id, ctx) { await call(ctx, "zoop", `${zpBase(cfg)}/transactions/${encodeURIComponent(id)}/void`, { method: "POST", headers: zpHead(cfg), body: "{}" }); return { id, deleted: true }; },
    async test(cfg, ctx) { need(cfg, "marketplaceId", "publishableKey"); await call(ctx, "zoop", `${zpBase(cfg)}/transactions?limit=1`, { headers: zpHead(cfg) }); return { message: "Credenciais aceitas pela Zoop." }; },
    // { type: "transaction.succeeded", payload: { object: { id } } }
    webhookIds: (b) => [b?.payload?.object?.id].filter(Boolean)
  },

  stripe: {
    async create(cfg, p, ctx) {
      need(cfg, "secretKey");
      const idem = { "Idempotency-Key": crypto.randomUUID() };
      const meta = { ref: p.ref };
      if (p.billingType === "CREDIT_CARD") {
        const url = cfg.successUrl || "https://stripe.com";
        const body = formBody({ mode: "payment", success_url: url, client_reference_id: p.ref, customer_email: p.email || undefined, metadata: meta, line_items: [{ quantity: 1, price_data: { currency: "brl", unit_amount: p.cents, product_data: { name: p.description.slice(0, 120) } } }] });
        return stOut(await call(ctx, "stripe", `${stBase}/checkout/sessions`, { method: "POST", headers: { ...stHead(cfg), ...idem }, body }));
      }
      const pm = p.billingType === "BOLETO" ? "boleto" : "pix";
      const data = { amount: p.cents, currency: "brl", confirm: true, description: p.description, metadata: meta, payment_method_types: [pm], payment_method_data: { type: pm } };
      if (pm === "boleto") {
        data.payment_method_data.boleto = { tax_id: p.cpf };
        data.payment_method_data.billing_details = { name: p.name, email: p.email || "financeiro@example.com", address: { line1: `${p.address.number}, ${p.address.street}`, city: p.address.city, state: p.address.state, postal_code: p.address.zip, country: "BR" } };
        data.payment_method_options = { boleto: { expires_after_days: Math.max(1, Math.min(60, Math.ceil((new Date(`${p.dueDate}T12:00:00`) - Date.now()) / 864e5))) } };
      } else data.payment_method_options = { pix: { expires_after_seconds: Math.max(10, Math.min(1209600, Math.round((new Date(`${p.dueDate}T23:59:59-03:00`) - Date.now()) / 1000))) } };
      return stOut(await call(ctx, "stripe", `${stBase}/payment_intents`, { method: "POST", headers: { ...stHead(cfg), ...idem }, body: formBody(data) }));
    },
    async get(cfg, id, ctx) { return stOut(await call(ctx, "stripe", `${stBase}/${id.startsWith("cs_") ? "checkout/sessions" : "payment_intents"}/${encodeURIComponent(id)}`, { headers: stHead(cfg) })); },
    async cancel(cfg, id, ctx) {
      const path = id.startsWith("cs_") ? `checkout/sessions/${id}/expire` : `payment_intents/${id}/cancel`;
      await call(ctx, "stripe", `${stBase}/${path}`, { method: "POST", headers: stHead(cfg), body: "" }); return { id, deleted: true };
    },
    async test(cfg, ctx) { need(cfg, "secretKey"); await call(ctx, "stripe", `${stBase}/balance`, { headers: stHead(cfg) }); return { message: "Chave aceita pela Stripe." }; },
    webhookIds: (b) => { const o = b?.data?.object; return [o?.object === "checkout.session" ? o.id : o?.id].filter(Boolean); }
  },

  paypal: {
    async create(cfg, p, ctx) {
      need(cfg, "clientId", "clientSecret");
      const token = await ppToken(cfg, ctx);
      const ret = cfg.returnUrl || "https://www.paypal.com";
      const body = {
        intent: "CAPTURE",
        purchase_units: [{ custom_id: p.ref, description: p.description.slice(0, 127), amount: { currency_code: "BRL", value: p.value.toFixed(2) } }],
        payment_source: { paypal: { experience_context: { return_url: ret, cancel_url: ret, user_action: "PAY_NOW", shipping_preference: "NO_SHIPPING", locale: "pt-BR" } } }
      };
      return ppOut(await call(ctx, "paypal", `${ppBase(cfg)}/v2/checkout/orders`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "PayPal-Request-Id": crypto.randomUUID() }, body: json(body) }));
    },
    async get(cfg, id, ctx) {
      const token = await ppToken(cfg, ctx), h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
      let d = await call(ctx, "paypal", `${ppBase(cfg)}/v2/checkout/orders/${encodeURIComponent(id)}`, { headers: h });
      // o pagador aprovou: só vira dinheiro depois da captura
      if (d.status === "APPROVED") d = await call(ctx, "paypal", `${ppBase(cfg)}/v2/checkout/orders/${encodeURIComponent(id)}/capture`, { method: "POST", headers: h, body: "{}" });
      return ppOut(d);
    },
    async cancel() { throw new Error("PayPal: pedidos não aprovados expiram sozinhos; cancelamento não está disponível."); },
    async test(cfg, ctx) { need(cfg, "clientId", "clientSecret"); await ppToken(cfg, ctx); return { message: "Credenciais aceitas pelo PayPal." }; },
    webhookIds: (b) => { const r = b?.resource; return [r?.supplementary_data?.related_ids?.order_id || (String(b?.event_type).startsWith("CHECKOUT.ORDER") ? r?.id : null)].filter(Boolean); }
  },

  cielo: {
    async create(cfg, p, ctx) {
      need(cfg, "merchantId", "merchantKey");
      if (p.billingType === "CREDIT_CARD") throw new Error("Cielo: Pix e boleto apenas neste adaptador.");
      const u = cieloUrls(cfg);
      const customer = { Name: p.name, Identity: p.cpf, IdentityType: p.cpf.length > 11 ? "CNPJ" : "CPF", Email: p.email || undefined, Address: { Street: p.address.street, Number: p.address.number, District: p.address.district, ZipCode: p.address.zip, City: p.address.city, State: p.address.state, Country: "BRA" } };
      const payment = p.billingType === "BOLETO"
        ? { Type: "Boleto", Amount: p.cents, Provider: cfg.boletoProvider || "Bradesco2", Address: customer.Address, Identification: p.cpf, Instructions: p.description.slice(0, 450), ExpirationDate: p.dueDate, Assignor: "Escola" }
        : { Type: "Pix", Amount: p.cents };
      return cieloOut(await call(ctx, "cielo", `${u.tx}/1/sales/`, { method: "POST", headers: cieloHead(cfg), body: json({ MerchantOrderId: p.ref, Customer: customer, Payment: payment }) }));
    },
    async get(cfg, id, ctx) {
      const d = await call(ctx, "cielo", `${cieloUrls(cfg).q}/1/sales/${encodeURIComponent(id)}`, { headers: cieloHead(cfg) });
      return cieloOut({ ...d, Payment: { ...d.Payment, PaymentId: d.Payment?.PaymentId || id } });
    },
    async cancel(cfg, id, ctx) { await call(ctx, "cielo", `${cieloUrls(cfg).tx}/1/sales/${encodeURIComponent(id)}/void`, { method: "PUT", headers: cieloHead(cfg) }); return { id, deleted: true }; },
    async test(cfg, ctx) {
      need(cfg, "merchantId", "merchantKey");
      try { await call(ctx, "cielo", `${cieloUrls(cfg).q}/1/sales/00000000-0000-0000-0000-000000000000`, { headers: cieloHead(cfg) }); }
      catch (e) { if (e.status === 401 || e.status === 403) throw e; }
      return { message: "MerchantId/MerchantKey aceitos pela Cielo." };
    },
    // { PaymentId, ChangeType }
    webhookIds: (b) => [b?.PaymentId].filter(Boolean)
  },

  efi: bacenAdapter("efi"),
  inter: bacenAdapter("inter"),
  sicoob: bacenAdapter("sicoob"),

  pixmanual: {
    async create(cfg, p) {
      need(cfg, "pixKey", "receiverName", "receiverCity");
      const id = `PIX${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
      return out("pixmanual", { id, value: p.value, dueDate: p.dueDate, externalReference: p.ref, description: p.description, pixQrCode: pixPayload(cfg, p.cents, id) });
    },
    async get() { throw new Error("Pix manual não consulta status: dê a baixa manualmente."); },
    async cancel(cfg, id) { return { id, deleted: true }; },
    async test(cfg) { need(cfg, "pixKey", "receiverName", "receiverCity"); return { message: "BR Code gerado localmente; sem rede." }; },
    webhookIds: () => []
  }
};

/* BR Code estático (Pix copia e cola), mesmo algoritmo do painel do dono. */
function crc16(s) { let c = 0xFFFF; for (let i = 0; i < s.length; i++) { c ^= s.charCodeAt(i) << 8; for (let j = 0; j < 8; j++) c = (c & 0x8000) ? ((c << 1) ^ 0x1021) & 0xFFFF : (c << 1) & 0xFFFF; } return c.toString(16).toUpperCase().padStart(4, "0"); }
const tlv = (id, v) => id + String(v.length).padStart(2, "0") + v;
const ascii = (s, n) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9 .\-]/g, "").toUpperCase().slice(0, n) || "NA";
export function pixPayload(cfg, cents, txid) {
  const conta = tlv("00", "br.gov.bcb.pix") + tlv("01", cfg.pixKey.trim());
  const p = tlv("00", "01") + tlv("26", conta) + tlv("52", "0000") + tlv("53", "986") + tlv("54", (cents / 100).toFixed(2)) + tlv("58", "BR") +
    tlv("59", ascii(cfg.receiverName, 25)) + tlv("60", ascii(cfg.receiverCity, 15)) + tlv("62", tlv("05", ascii(txid, 25).replace(/ /g, "") || "***")) + "6304";
  return p + crc16(p);
}

/** Gera as parcelas (matrícula + mensalidades) usando o createPayment do provedor. */
export async function carnet(adapter, cfg, payload, ctx) {
  const list = [];
  const child = payload.childName ? ` - ${payload.childName}` : "";
  const mod = payload.modalidade ? ` (${payload.modalidade})` : "";
  const day = Math.min(Number(payload.paymentDay || 10), 28);
  const t = new Date(), min = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const base = { ...payload, amount: undefined, value: undefined };
  const reg = payload.registrationId || "PNG";
  if (Number(payload.matriculaValue) > 0) list.push(await adapter.create(cfg, normInput({ ...base, amount: payload.matriculaValue, dueDate: fmt(min), description: `Matrícula${child}${mod}`, externalReference: `${reg}_MATRICULA_${Date.now()}` }), ctx));
  const m = Number(payload.mensalidadeValue || 0);
  if (m > 0) {
    const end = payload.installmentEndDate ? new Date(`${payload.installmentEndDate}T12:00:00`) : null;
    for (let i = 0; i < (end ? 36 : 12); i++) {
      let due = new Date(min.getFullYear(), min.getMonth() + i, day);
      if (due < min) due = new Date(min);
      if (end && due > end) break;
      const label = due.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toUpperCase();
      list.push(await adapter.create(cfg, normInput({ ...base, amount: m, dueDate: fmt(due), description: `Mensalidade ${label}${child}${mod}`, externalReference: `${reg}_${i + 1}_${Date.now()}` }), ctx));
    }
  }
  return list;
}
