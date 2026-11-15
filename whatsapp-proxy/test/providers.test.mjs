// Rode: node --test whatsapp-proxy/test/providers.test.mjs   (precisa de Node 20+ e de `npx esbuild`)
// HTTP mockado: confere URL, autenticação e corpo de cada provedor e o formato normalizado de saída.
import test from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = mkdtempSync(path.join(tmpdir(), "prov-"));
const bundle = path.join(dir, "routes.mjs");
execSync(`npx --yes esbuild "${path.join(here, "../src/providers/routes.js")}" --bundle --format=esm --outfile="${bundle}" --log-level=error`, { stdio: "inherit" });
const R = await import(pathToFileURL(bundle).href);
const A = await import(pathToFileURL(path.join(here, "../src/providers/adapters.js")).href);
const registry = JSON.parse(readFileSync(path.join(here, "../../src/data/paymentProviders.json"), "utf8"));

/** fetch falso: responde na ordem e guarda as chamadas. */
function fake(...responses) {
  const calls = [];
  const f = async (url, init = {}) => {
    calls.push({ url, method: init.method || "GET", headers: init.headers || {}, body: init.body });
    const r = responses.shift() ?? {};
    return { ok: (r.status || 200) < 400, status: r.status || 200, text: async () => (typeof r.body === "string" ? r.body : JSON.stringify(r.body ?? {})) };
  };
  return { f, calls, ctx: { fetch: f, webhookUrl: "https://w.test/webhooks/x/s", mtls: () => null } };
}
const input = (o = {}) => A.normInput({ amount: 15000, billingType: "PIX", responsibleName: "Ana Souza", responsibleCpf: "529.982.247-25", responsibleEmail: "ana@x.com", responsiblePhone: "11987654321", dueDate: "2030-05-10", description: "Mensalidade MAI", externalReference: "REG1_3_99", ...o });
const basic = (u, p = "") => "Basic " + Buffer.from(`${u}:${p}`).toString("base64");

test("catálogo: 16+ provedores, logo, campos e todos com adaptador (exceto Cora, legado)", () => {
  assert.ok(registry.length >= 16);
  for (const p of registry) {
    assert.ok(p.name && p.docs && p.methods.length, p.id);
    if (p.id !== "cora" && p.id !== "asaas") assert.ok(A.ADAPTERS[p.id], `adaptador ${p.id}`);
    for (const f of p.fields) assert.ok(f.key && f.label);
  }
  assert.equal(new Set(registry.map((p) => p.id)).size, registry.length);
});

test("normInput: centavos, CPF só dígitos, DDD", () => {
  const p = input();
  assert.equal(p.cents, 15000); assert.equal(p.value, 150); assert.equal(p.cpf, "52998224725"); assert.equal(p.ddd, "11"); assert.equal(A.normInput({ value: 99.9 }).cents, 9990);
});

test("Mercado Pago: Pix", async () => {
  const m = fake({ body: { id: 123, status: "pending", transaction_amount: 150, payment_method_id: "pix", external_reference: "REG1_3_99", point_of_interaction: { transaction_data: { qr_code: "000201...", qr_code_base64: "data:image/png;base64,AAAA", ticket_url: "https://mp/t" } } } });
  const pay = await A.ADAPTERS.mercadopago.create({ accessToken: "APP_USR-1" }, input(), m.ctx);
  const c = m.calls[0], body = JSON.parse(c.body);
  assert.equal(c.url, "https://api.mercadopago.com/v1/payments"); assert.equal(c.headers.Authorization, "Bearer APP_USR-1"); assert.ok(c.headers["X-Idempotency-Key"]);
  assert.equal(body.transaction_amount, 150); assert.equal(body.payment_method_id, "pix"); assert.equal(body.payer.identification.number, "52998224725"); assert.equal(body.notification_url, "https://w.test/webhooks/x/s");
  assert.deepEqual([pay.id, pay.status, pay.pixQrCode, pay.pixQrCodeUrl, pay.externalReference, pay.value], ["123", "PENDING", "000201...", "AAAA", "REG1_3_99", 150]);
});

test("Mercado Pago: pago vira RECEIVED; webhook extrai o id", async () => {
  const m = fake({ body: { id: 9, status: "approved", transaction_amount: 10, payment_method_id: "pix" } });
  assert.equal((await A.ADAPTERS.mercadopago.get({ accessToken: "t" }, "9", m.ctx)).status, "RECEIVED");
  assert.deepEqual(A.ADAPTERS.mercadopago.webhookIds({ type: "payment", data: { id: "9" } }, new URLSearchParams()), ["9"]);
  assert.deepEqual(A.ADAPTERS.mercadopago.webhookIds({}, new URLSearchParams("data.id=7")), ["7"]);
});

test("PagBank: Pix (qr_codes) e boleto (charges)", async () => {
  const pix = fake({ body: { id: "ORDE_1", reference_id: "REG1_3_99", qr_codes: [{ amount: { value: 15000 }, expiration_date: "2030-05-10T23:59:59-03:00", text: "000201PB" }] } });
  const a = await A.ADAPTERS.pagbank.create({ token: "tk", environment: "sandbox" }, input(), pix.ctx);
  assert.equal(pix.calls[0].url, "https://sandbox.api.pagseguro.com/orders"); assert.equal(pix.calls[0].headers.Authorization, "Bearer tk");
  const body = JSON.parse(pix.calls[0].body); assert.equal(body.qr_codes[0].amount.value, 15000); assert.equal(body.items[0].unit_amount, 15000); assert.deepEqual(body.notification_urls, ["https://w.test/webhooks/x/s"]);
  assert.deepEqual([a.id, a.pixQrCode, a.billingType, a.status], ["ORDE_1", "000201PB", "PIX", "PENDING"]);
  const bol = fake({ body: { id: "ORDE_2", charges: [{ id: "CHAR_1", status: "WAITING", amount: { value: 15000 }, links: [{ rel: "SELF", href: "x" }, { media: "application/pdf", href: "https://pb/b.pdf" }], payment_method: { boleto: { due_date: "2030-05-10" } } }] } });
  const b = await A.ADAPTERS.pagbank.create({ token: "tk" }, input({ billingType: "BOLETO" }), bol.ctx);
  assert.equal(JSON.parse(bol.calls[0].body).charges[0].payment_method.boleto.due_date, "2030-05-10");
  assert.deepEqual([b.billingType, b.bankSlipUrl, b.dueDate], ["BOLETO", "https://pb/b.pdf", "2030-05-10"]);
  const paid = fake({ body: { id: "ORDE_2", charges: [{ status: "PAID", amount: { value: 100 } }] } });
  assert.equal((await A.ADAPTERS.pagbank.get({ token: "t" }, "ORDE_2", paid.ctx)).status, "RECEIVED");
});

test("Pagar.me: Pix e cancelamento via charge", async () => {
  const m = fake({ body: { id: "or_1", code: "REG1_3_99", charges: [{ id: "ch_1", status: "pending", amount: 15000, payment_method: "pix", last_transaction: { qr_code: "000201PG", qr_code_url: "u" } }] } });
  const a = await A.ADAPTERS.pagarme.create({ secretKey: "sk_test_1" }, input(), m.ctx);
  assert.equal(m.calls[0].url, "https://api.pagar.me/core/v5/orders"); assert.equal(m.calls[0].headers.Authorization, basic("sk_test_1"));
  const body = JSON.parse(m.calls[0].body); assert.equal(body.payments[0].payment_method, "pix"); assert.equal(body.items[0].amount, 15000); assert.equal(body.customer.document_type, "CPF");
  assert.deepEqual([a.id, a.pixQrCode, a.status], ["or_1", "000201PG", "PENDING"]);
  const c = fake({ body: { id: "or_1", charges: [{ id: "ch_1" }] } }, { body: {} });
  await A.ADAPTERS.pagarme.cancel({ secretKey: "k" }, "or_1", c.ctx);
  assert.deepEqual([c.calls[1].method, c.calls[1].url], ["DELETE", "https://api.pagar.me/core/v5/charges/ch_1"]);
  assert.deepEqual(A.ADAPTERS.pagarme.webhookIds({ type: "charge.paid", data: { id: "ch_1", order: { id: "or_1" } } }), ["or_1"]);
  assert.deepEqual(A.ADAPTERS.pagarme.webhookIds({ type: "order.paid", data: { id: "or_2" } }), ["or_2"]);
});

test("iugu: fatura com Pix e webhook de formulário", async () => {
  const m = fake({ body: { id: "INV1", status: "pending", total_cents: 15000, due_date: "2030-05-10", order_id: "REG1_3_99", secure_url: "https://faturas.iugu.com/x", pix: { qrcode_text: "000201IU" } } });
  const a = await A.ADAPTERS.iugu.create({ apiToken: "tok" }, input(), m.ctx);
  const body = JSON.parse(m.calls[0].body);
  assert.equal(m.calls[0].url, "https://api.iugu.com/v1/invoices"); assert.equal(m.calls[0].headers.Authorization, basic("tok"));
  assert.deepEqual(body.payable_with, ["pix"]); assert.equal(body.items[0].price_cents, 15000); assert.equal(body.payer.cpf_cnpj, "52998224725");
  assert.deepEqual([a.id, a.pixQrCode, a.invoiceUrl, a.value], ["INV1", "000201IU", "https://faturas.iugu.com/x", 150]);
  assert.deepEqual(A.ADAPTERS.iugu.webhookIds({ event: "invoice.status_changed", "data[id]": "INV1", "data[status]": "paid" }), ["INV1"]);
});

test("Woovi: AppID cru no Authorization, valor em centavos", async () => {
  const m = fake({ body: { charge: { correlationID: "REG1_3_99", status: "ACTIVE", value: 15000, brCode: "000201WO", paymentLinkUrl: "https://woovi/p" } } });
  const a = await A.ADAPTERS.woovi.create({ appId: "Q2xp" }, input(), m.ctx);
  assert.equal(m.calls[0].url, "https://api.openpix.com.br/api/v1/charge"); assert.equal(m.calls[0].headers.Authorization, "Q2xp");
  const body = JSON.parse(m.calls[0].body); assert.equal(body.value, 15000); assert.equal(body.correlationID, "REG1_3_99");
  assert.deepEqual([a.id, a.pixQrCode, a.status], ["REG1_3_99", "000201WO", "PENDING"]);
  const done = fake({ body: { charge: { correlationID: "x", status: "COMPLETED", value: 1 } } });
  assert.equal((await A.ADAPTERS.woovi.get({ appId: "a" }, "x", done.ctx)).status, "RECEIVED");
});

test("Stripe: PaymentIntent Pix em formulário; Checkout para cartão", async () => {
  const m = fake({ body: { id: "pi_1", status: "requires_action", amount: 15000, metadata: { ref: "REG1_3_99" }, next_action: { pix_display_qr_code: { data: "000201ST", hosted_instructions_url: "https://pay.stripe.com/p", expires_at: 1893456000 } } } });
  const a = await A.ADAPTERS.stripe.create({ secretKey: "sk_test_x" }, input(), m.ctx);
  const sent = new URLSearchParams(m.calls[0].body);
  assert.equal(m.calls[0].url, "https://api.stripe.com/v1/payment_intents"); assert.equal(m.calls[0].headers.Authorization, "Bearer sk_test_x");
  assert.equal(sent.get("amount"), "15000"); assert.equal(sent.get("currency"), "brl"); assert.equal(sent.get("payment_method_types[]"), "pix"); assert.equal(sent.get("confirm"), "true"); assert.equal(sent.get("metadata[ref]"), "REG1_3_99");
  assert.deepEqual([a.id, a.pixQrCode, a.invoiceUrl], ["pi_1", "000201ST", "https://pay.stripe.com/p"]);
  const cc = fake({ body: { id: "cs_1", object: "checkout.session", url: "https://checkout.stripe.com/c/1", payment_status: "unpaid", status: "open", amount_total: 15000 } });
  const c = await A.ADAPTERS.stripe.create({ secretKey: "k", successUrl: "https://ok" }, input({ billingType: "CREDIT_CARD" }), cc.ctx);
  assert.equal(cc.calls[0].url, "https://api.stripe.com/v1/checkout/sessions"); assert.equal(new URLSearchParams(cc.calls[0].body).get("line_items[0][price_data][unit_amount]"), "15000");
  assert.deepEqual([c.billingType, c.invoiceUrl, c.status], ["CREDIT_CARD", "https://checkout.stripe.com/c/1", "PENDING"]);
  assert.equal((await A.ADAPTERS.stripe.get({ secretKey: "k" }, "pi_1", fake({ body: { id: "pi_1", status: "succeeded", amount: 1 } }).ctx)).status, "RECEIVED");
});

test("PayPal: token, pedido, captura quando APPROVED", async () => {
  const m = fake({ body: { access_token: "AT" } }, { body: { id: "ORD1", status: "PAYER_ACTION_REQUIRED", purchase_units: [{ custom_id: "REG1_3_99", amount: { value: "150.00" } }], links: [{ rel: "payer-action", href: "https://paypal/pay" }] } });
  const a = await A.ADAPTERS.paypal.create({ clientId: "ci", clientSecret: "cs", environment: "sandbox" }, input(), m.ctx);
  assert.equal(m.calls[0].url, "https://api-m.sandbox.paypal.com/v1/oauth2/token"); assert.equal(m.calls[0].headers.Authorization, basic("ci", "cs"));
  assert.equal(m.calls[1].headers.Authorization, "Bearer AT");
  const body = JSON.parse(m.calls[1].body); assert.equal(body.purchase_units[0].amount.value, "150.00"); assert.equal(body.purchase_units[0].amount.currency_code, "BRL");
  assert.deepEqual([a.invoiceUrl, a.status, a.billingType], ["https://paypal/pay", "PENDING", "CREDIT_CARD"]);
  const g = fake({ body: { access_token: "AT" } }, { body: { id: "ORD1", status: "APPROVED", purchase_units: [{ amount: { value: "1.00" } }] } }, { body: { id: "ORD1", status: "COMPLETED", purchase_units: [{ amount: { value: "1.00" } }] } });
  const paid = await A.ADAPTERS.paypal.get({ clientId: "a", clientSecret: "b" }, "ORD1", g.ctx);
  assert.equal(g.calls[2].url, "https://api-m.paypal.com/v2/checkout/orders/ORD1/capture"); assert.equal(paid.status, "RECEIVED");
});

test("Cielo: Pix e boleto com MerchantId/MerchantKey", async () => {
  const m = fake({ body: { MerchantOrderId: "REG1_3_99", Payment: { PaymentId: "pid1", Type: "Pix", Amount: 15000, Status: 12, QrCodeString: "000201CI", QrCodeBase64Image: "BBBB" } } });
  const a = await A.ADAPTERS.cielo.create({ merchantId: "mid", merchantKey: "mk", environment: "sandbox" }, input(), m.ctx);
  assert.equal(m.calls[0].url, "https://apisandbox.cieloecommerce.cielo.com.br/1/sales/"); assert.equal(m.calls[0].headers.MerchantId, "mid"); assert.equal(m.calls[0].headers.MerchantKey, "mk");
  const body = JSON.parse(m.calls[0].body); assert.equal(body.Payment.Type, "Pix"); assert.equal(body.Payment.Amount, 15000); assert.equal(body.Customer.Identity, "52998224725");
  assert.deepEqual([a.id, a.status, a.pixQrCode, a.pixQrCodeUrl], ["pid1", "PENDING", "000201CI", "BBBB"]);
  const g = fake({ body: { MerchantOrderId: "o", Payment: { Type: "Pix", Amount: 100, Status: 2 } } });
  const paid = await A.ADAPTERS.cielo.get({ merchantId: "a", merchantKey: "b" }, "pid1", g.ctx);
  assert.equal(g.calls[0].url, "https://apiquery.cieloecommerce.cielo.com.br/1/sales/pid1"); assert.deepEqual([paid.status, paid.id], ["RECEIVED", "pid1"]);
  const bol = fake({ body: { Payment: { PaymentId: "b1", Type: "Boleto", Amount: 15000, Status: 1, Url: "https://cielo/boleto", ExpirationDate: "2030-05-10" } } });
  assert.equal((await A.ADAPTERS.cielo.create({ merchantId: "a", merchantKey: "b" }, input({ billingType: "BOLETO" }), bol.ctx)).bankSlipUrl, "https://cielo/boleto");
});

test("Vindi: cliente + fatura com produto", async () => {
  const m = fake({ body: { customers: [] } }, { body: { customer: { id: 5 } } }, { body: { bill: { id: 77, status: "pending", amount: "150.0", code: "REG1_3_99", due_at: "2030-05-10", charges: [{ last_transaction: { gateway_response_fields: { qrcode_original_path: "000201VI" } } }] } } });
  const a = await A.ADAPTERS.vindi.create({ apiKey: "vk", productId: "321" }, input(), m.ctx);
  assert.equal(m.calls[2].url, "https://app.vindi.com.br/api/v1/bills"); assert.equal(m.calls[2].headers.Authorization, basic("vk"));
  const body = JSON.parse(m.calls[2].body); assert.equal(body.customer_id, 5); assert.equal(body.payment_method_code, "pix"); assert.equal(body.bill_items[0].product_id, 321); assert.equal(body.bill_items[0].amount, 150);
  assert.deepEqual([a.id, a.pixQrCode, a.value], ["77", "000201VI", 150]);
  await assert.rejects(() => A.ADAPTERS.vindi.create({ apiKey: "vk" }, input(), fake().ctx), /productId/);
});

test("AbacatePay: Pix v2", async () => {
  const m = fake({ data: {}, body: { data: { id: "tr_1", amount: 15000, status: "PENDING", brCode: "000201AB", brCodeBase64: "data:image/png;base64,CCCC" } } });
  const a = await A.ADAPTERS.abacatepay.create({ apiKey: "ak" }, input(), m.ctx);
  assert.equal(m.calls[0].url, "https://api.abacatepay.com/v2/transparents/create"); assert.equal(m.calls[0].headers.Authorization, "Bearer ak");
  const body = JSON.parse(m.calls[0].body); assert.equal(body.method, "PIX"); assert.equal(body.data.amount, 15000);
  assert.deepEqual([a.id, a.pixQrCode, a.pixQrCodeUrl], ["tr_1", "000201AB", "CCCC"]);
  const g = fake({ body: { data: { id: "tr_1", status: "PAID", amount: 1 } } });
  assert.equal((await A.ADAPTERS.abacatepay.get({ apiKey: "k" }, "tr_1", g.ctx)).status, "RECEIVED"); assert.match(g.calls[0].url, /transparents\/check\?id=tr_1$/);
});

test("Zoop: Pix pela transação do marketplace", async () => {
  const m = fake({ body: { id: "z1", status: "pending", amount: 15000, reference_id: "REG1_3_99", qr_code: { emv: "000201ZO" } } });
  const a = await A.ADAPTERS.zoop.create({ marketplaceId: "mk", sellerId: "sl", publishableKey: "zpk" }, input(), m.ctx);
  assert.equal(m.calls[0].url, "https://api.zoop.ws/v1/marketplaces/mk/transactions"); assert.equal(m.calls[0].headers.Authorization, basic("zpk"));
  const body = JSON.parse(m.calls[0].body); assert.equal(body.payment_type, "pix"); assert.equal(body.on_behalf_of, "sl"); assert.equal(body.amount, 15000);
  assert.deepEqual([a.id, a.pixQrCode], ["z1", "000201ZO"]);
});

test("Pix padrão BACEN (Efí/Inter/Sicoob): exige certificado, depois OAuth + cobrança", async () => {
  const sem = fake();
  await assert.rejects(() => A.ADAPTERS.efi.create({ clientId: "c", clientSecret: "s", pixKey: "k" }, input(), sem.ctx), /MTLS_EFI/);
  for (const [id, host, tokenUrl, prefix] of [["efi", "https://pix-h.api.efipay.com.br", "https://pix-h.api.efipay.com.br/oauth/token", "/v2"], ["inter", "https://cdpj.partners.bancointer.com.br", "https://cdpj.partners.bancointer.com.br/oauth/v2/token", "/pix/v2"], ["sicoob", "https://api.sicoob.com.br", "https://auth.sicoob.com.br/auth/realms/cooperado/protocol/openid-connect/token", "/pix/api/v2"]]) {
    const m = fake({ body: { access_token: "T" } }, { body: { txid: "abc", status: "ATIVA", valor: { original: "150.00" }, calendario: { criacao: "2030-05-01T10:00:00Z", expiracao: 86400 }, pixCopiaECola: "000201BC", infoAdicionais: [{ nome: "ref", valor: "REG1_3_99" }] } });
    const used = [];
    m.ctx.mtls = (pid) => { used.push(pid); return m.f; };
    const a = await A.ADAPTERS[id].create({ clientId: "ci", clientSecret: "cs", pixKey: "chave@x.com", environment: "sandbox" }, input(), m.ctx);
    assert.equal(m.calls[0].url, tokenUrl, id); assert.equal(m.calls[1].method, "PUT"); assert.match(m.calls[1].url, new RegExp(`^${(id === "efi" ? host : host).replace(/[.]/g, "\\.")}${prefix.replace(/\//g, "\\/")}\\/cob\\/[0-9a-f]{32}$`));
    assert.equal(m.calls[1].headers.Authorization, "Bearer T");
    const body = JSON.parse(m.calls[1].body); assert.equal(body.valor.original, "150.00"); assert.equal(body.chave, "chave@x.com"); assert.equal(body.devedor.cpf, "52998224725");
    assert.deepEqual([a.id, a.pixQrCode, a.externalReference, a.status], ["abc", "000201BC", "REG1_3_99", "PENDING"]); assert.ok(used.length >= 2);
  }
  const done = fake({ body: { access_token: "T" } }, { body: { txid: "t1", status: "CONCLUIDA", valor: { original: "1.00" }, pix: [{ horario: "2030-05-02T10:00:00Z" }] } });
  done.ctx.mtls = () => done.f;
  assert.equal((await A.ADAPTERS.inter.get({ clientId: "a", clientSecret: "b" }, "t1", done.ctx)).status, "RECEIVED");
  assert.deepEqual(A.ADAPTERS.efi.webhookIds({ pix: [{ txid: "a" }, { txid: "b" }] }), ["a", "b"]);
});

test("Pix manual: BR Code válido (CRC16) com o valor e a chave", async () => {
  const a = await A.ADAPTERS.pixmanual.create({ pixKey: "financeiro@escola.com", receiverName: "Escola Pé na Grama", receiverCity: "São Paulo" }, input(), fake().ctx);
  const code = a.pixQrCode;
  assert.match(code, /^000201/); assert.ok(code.includes("br.gov.bcb.pix0121financeiro@escola.com")); assert.ok(code.includes("540615"+"0.00".slice(0,0)) || code.includes("5406150.00"));
  const body = code.slice(0, -4); let c = 0xffff; for (const ch of body) { c ^= ch.charCodeAt(0) << 8; for (let j = 0; j < 8; j++) c = c & 0x8000 ? ((c << 1) ^ 0x1021) & 0xffff : (c << 1) & 0xffff; }
  assert.equal(code.slice(-4), c.toString(16).toUpperCase().padStart(4, "0"));
});

test("carnê: matrícula + mensalidades até a data final, cada uma com referência e vencimento", async () => {
  const created = [];
  const adapter = { create: async (cfg, p) => { created.push(p); return { id: String(created.length) }; } };
  const list = await A.carnet(adapter, {}, { matriculaValue: 5000, mensalidadeValue: 15000, paymentDay: 10, installmentEndDate: new Date(Date.now() + 100 * 864e5).toISOString().slice(0, 10), registrationId: "R9", childName: "Léo" }, {});
  assert.ok(list.length >= 3 && list.length <= 6); assert.equal(created[0].cents, 5000); assert.match(created[0].description, /Matrícula - Léo/); assert.equal(created[1].cents, 15000);
  assert.equal(new Set(created.map((c) => c.ref)).size, created.length);
});

test("erros do provedor viram mensagem clara", async () => {
  const m = fake({ status: 401, body: { message: "invalid token" } });
  await assert.rejects(() => A.ADAPTERS.mercadopago.test({ accessToken: "x" }, m.ctx), /mercadopago: invalid token \(HTTP 401\)/);
  await assert.rejects(() => A.ADAPTERS.iugu.create({}, input(), fake().ctx), /apiToken/);
});

/* ---------- armazenamento, auth e webhook ---------- */
const kv = () => { const m = new Map(); return { get: async (k, type) => { const v = m.get(k) ?? null; return type === "json" && v ? JSON.parse(v) : v; }, put: async (k, v) => void m.set(k, v), delete: async (k) => void m.delete(k), m }; };

test("config: segredos cifrados no KV, mascarados na leitura, em branco mantém o valor", async () => {
  const env = { RAE_STORAGE: kv(), PROVIDER_CONFIG_KEY: "uma-chave-longa" };
  await R.saveConfig(env, "mercadopago", { fields: { accessToken: "APP_USR-segredo" }, environment: "sandbox" });
  const raw = env.RAE_STORAGE.m.get("provider-config:mercadopago");
  assert.ok(raw.startsWith("enc:") && !raw.includes("segredo"));
  await R.saveConfig(env, "mercadopago", { fields: { accessToken: "" } });
  assert.equal((await R.loadConfig(env, "mercadopago")).accessToken, "APP_USR-segredo");
  const pub = R.publicConfig(R.registryById("mercadopago"), await R.loadConfig(env, "mercadopago"), true);
  assert.deepEqual(pub.fields.accessToken, { set: true }); assert.equal(pub.environment, "sandbox"); assert.ok(!JSON.stringify(pub).includes("segredo"));
  await R.saveConfig(env, "cielo", { fields: { merchantId: "m-1", merchantKey: "k-1" } });
  assert.equal(R.publicConfig(R.registryById("cielo"), await R.loadConfig(env, "cielo"), true).fields.merchantId, "m-1");
  const st = await R.adapterProviderStatus(env);
  assert.equal(st.find((s) => s.id === "mercadopago").configured, true); assert.equal(st.find((s) => s.id === "iugu").configured, false); assert.equal(st.find((s) => s.id === "efi").certificateInstalled, false);
});

test("config sem PROVIDER_CONFIG_KEY fica em texto no KV (e o painel avisa)", async () => {
  const env = { RAE_STORAGE: kv() };
  await R.saveConfig(env, "woovi", { fields: { appId: "abc" } });
  assert.ok(!env.RAE_STORAGE.m.get("provider-config:woovi").startsWith("enc:"));
  assert.equal(R.publicConfig(R.registryById("woovi"), await R.loadConfig(env, "woovi"), false).encrypted, false);
});

test("rotas de configuração exigem a chave de administrador; com a chave, grava e lê o provedor ativo", async () => {
  const env = { RAE_STORAGE: kv(), PROVIDER_ADMIN_KEY: "chave-do-dono" };
  const json = (d, s) => ({ status: s, d });
  const call = (method, p, headers = {}, body) => R.providerRoutes({ request: { method, headers: new Headers(headers), json: async () => body }, env, url: new URL("https://w.test" + p), path: p, json, hooks: {} });
  assert.equal((await call("PUT", "/payment-providers/config/woovi", {}, { fields: { appId: "x" } })).status, 401);
  assert.equal((await call("GET", "/payment-providers/config/woovi", { Authorization: "Bearer errada" })).status, 401);
  assert.equal((await call("PUT", "/payment-providers/active", {}, { provider: "woovi" })).status, 401);
  assert.equal(env.RAE_STORAGE.m.size, 0);
  const auth = { Authorization: "Bearer chave-do-dono" };
  assert.equal((await call("PUT", "/payment-providers/config/woovi", auth, { fields: { appId: "abc" } })).status, 200);
  assert.equal((await call("GET", "/payment-providers/config/woovi", auth)).d.config.fields.appId.set, true);
  assert.equal((await call("PUT", "/payment-providers/active", auth, { provider: "mercadopago", environment: "sandbox" })).d.config.environment, "sandbox");
  assert.equal((await call("PUT", "/payment-providers/active", auth, { provider: "nao-existe" })).status, 400);
  assert.equal((await call("GET", "/payment-providers/active")).d.config.provider, "mercadopago");
  assert.equal(await R.verifyAdmin({ headers: new Headers() }, { PROVIDER_ADMIN_KEY: "k" }), null);
  assert.equal(await R.verifyAdmin({ headers: new Headers(auth) }, {}), null);
});

test("webhook: segredo errado = 401; certo = consulta o provedor e grava (nunca confia no corpo)", async () => {
  const env = { RAE_STORAGE: kv(), FIREBASE_PROJECT_ID: "p" };
  await R.saveConfig(env, "mercadopago", { fields: { accessToken: "tok" } });
  await env.RAE_STORAGE.put("providers:webhook-secret", "segredo123");
  const saved = [];
  const hooks = { resolveStudent: async (e, p) => (p.externalReference === "REG1_3_99" ? "REG1" : ""), save: async (e, p, s, ev) => saved.push([p.id, p.status, s, ev]), saveEvent: async () => {}, recompute: async () => {} };
  const json = (d, s) => ({ status: s, d });
  const real = globalThis.fetch;
  let hits = 0;
  globalThis.fetch = async (u) => { hits++; assert.equal(u, "https://api.mercadopago.com/v1/payments/555"); return { ok: true, status: 200, text: async () => JSON.stringify({ id: 555, status: "approved", transaction_amount: 150, payment_method_id: "pix", external_reference: "REG1_3_99" }) }; };
  try {
    const mk = (secret, body) => R.providerRoutes({ request: { method: "POST", headers: new Headers(), text: async () => JSON.stringify(body) }, env, url: new URL(`https://w.test/webhooks/mercadopago/${secret}`), path: `/webhooks/mercadopago/${secret}`, json, hooks });
    assert.equal((await mk("errado", { data: { id: "555" } })).status, 401); assert.equal(hits, 0);
    const ok = await mk("segredo123", { type: "payment", data: { id: "555" }, status: "approved-mentira" });
    assert.equal(ok.status, 200); assert.equal(ok.d.processed, 1);
    assert.deepEqual(saved, [["555", "RECEIVED", "REG1", "PAYMENT_UPDATED"]]);
  } finally { globalThis.fetch = real; }
});
