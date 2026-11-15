# Provedores de pagamento

O dono da escola escolhe em **Financeiro > Bancos** entre 17 provedores. Cada um tem a própria tela de credenciais, ambientes e passos de webhook (catálogo em `src/data/paymentProviders.json`, usado pelo painel e pelo Worker). O logo vem de `public/provedores/` (Asaas e Cora usam os SVGs que já existiam; o Pix manual usa um selo).

| Provedor | Formas | Credenciais | Situação |
|---|---|---|---|
| Asaas | Pix, boleto, cartão | chave de API | integração própria (já em produção) |
| Cora | Pix, boleto | segredos `CORA_*` + certificado | integração própria (já em produção) |
| Pix manual | Pix | chave, nome, cidade | BR Code estático; baixa manual |
| Mercado Pago | Pix, boleto | Access Token | conforme a documentação |
| PagBank | Pix, boleto | token | conforme a documentação |
| Pagar.me | Pix, boleto | chave secreta | conforme a documentação |
| Stripe | Pix, boleto, cartão | chave secreta | conforme a documentação |
| PayPal | cartão/conta PayPal | client id + secret | conforme a documentação |
| Cielo | Pix, boleto | MerchantId + MerchantKey | conforme a documentação |
| iugu | Pix, boleto | token | conforme a documentação |
| Woovi | Pix | AppID | conforme a documentação |
| Vindi | Pix, boleto, cartão | chave + ID do produto | documentação parcial |
| AbacatePay | Pix | chave | documentação parcial |
| Zoop | Pix | marketplace, seller, ZPK | documentação parcial |
| Efí, Banco Inter, Sicoob | Pix | client id/secret + chave Pix | requerem certificado mTLS |

## Como funciona

- As credenciais ficam no KV do Worker (`provider-config:<id>`), cifradas com AES-GCM se o segredo `PROVIDER_CONFIG_KEY` existir. O painel nunca recebe o segredo de volta (só "salvo"); campo em branco ao salvar mantém o valor.
- Rotas de configuração e teste exigem o login Firebase de um administrador (`ADMIN_EMAILS`, padrão `rumoaoesporte@admin.com`); o Worker valida a assinatura do token.
- Todo provedor devolve o mesmo formato (`id`, `status`, `value`, `pixQrCode`, `bankSlipUrl`...) que o sistema já usava com o Asaas, então financeiro, carnê e portal do aluno não mudam.
- Webhooks chegam em `/webhooks/<provedor>/<segredo>` (a URL aparece no painel). O corpo recebido **não é confiado**: o Worker consulta o pagamento no provedor e só então dá baixa.
- Provedores com certificado (Efí, Inter, Sicoob): enviar o certificado ao Cloudflare e criar o binding `MTLS_EFI` / `MTLS_INTER` / `MTLS_SICOOB` (exemplo em `whatsapp-proxy/wrangler.toml`); depois, "Registrar webhook" no painel.

## O que NÃO foi verificado

- Nenhuma chamada real foi feita (sem contas/credenciais): os testes (`node --test whatsapp-proxy/test/providers.test.mjs`) usam respostas simuladas montadas a partir da documentação. Valide cada provedor com a **conta de teste** antes de cobrar.
- Não foi possível ler a documentação de Getnet, Rede e PagHiper (bloqueadas/indisponíveis), por isso não estão no catálogo. Sicoob (autenticação e rota Pix) veio do padrão BACEN, sem a página oficial. Vindi, AbacatePay e Zoop: partes dos corpos/respostas seguem o padrão conhecido (marcados "documentação parcial").
- Listagem geral e saldo só existem para Asaas e Cora; nos outros o sistema consulta cada cobrança pelo ID e recebe a baixa por webhook.
- As rotas de criação/consulta de cobrança do Worker continuam abertas como já eram; só configuração e teste exigem login.
