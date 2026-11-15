# Central do dono e infraestrutura de venda

Endereço: https://esporte.thayruan.com.br/admin/ (a senha foi entregue na conversa; troque quando quiser).

## Fluxo

1. A escola monta o teste em `/testar`. O pedido vai para `POST /api/leads` e aparece em **Pedidos**.
2. Em **Pedidos > Detalhes > Criar proposta** você escolhe plano e valores. O sistema gera o link `/contrato?t=…`.
3. O cliente abre o link, confere o contrato, informa nome e CPF/CNPJ (validado) e assina. Fica gravado nome, documento, data, IP e um código SHA-256.
4. A assinatura cria o **cliente** (situação "Implantando") e a primeira fatura (implantação + mensalidade). O cliente cai em `/fatura?t=…` com QR Code e Pix copia e cola.
5. O cliente toca em "Já fiz o pagamento" (opcional). Você confere na sua conta e clica em **Marcar paga**.
6. Você acompanha a implantação pelo checklist do cliente e muda a situação para "Ativo".
7. As mensalidades seguintes são geradas sozinhas (7 dias antes do vencimento), no máximo uma vez por dia, quando alguém abre o painel ou uma fatura. O botão "Gerar mensalidades" força na hora.

## Antes da primeira venda

Em **Configurações**: seu CNPJ/CPF, a chave Pix, o nome e a cidade do Pix, o WhatsApp (com 55). Em **Planos**: pelo menos um plano. O texto do contrato é um modelo-base: peça para um advogado revisar.

## Como funciona por baixo

- Tudo roda no Worker `esporte-thayruan` (`produto/worker/index.js`): `/api/*` é o Worker, o resto são arquivos estáticos.
- Banco: SQLite dentro de um Durable Object (classe `Banco`). Não usa D1 porque a conta já tem 10 bancos D1, o limite. O esquema está em `produto/worker/schema.js` e roda sozinho na partida.
- Sem tarefa agendada: o plano gratuito da conta já usa as 5 permitidas. A geração diária está em `geracaoDiaria()`.
- Acesso do dono: senha em `ADMIN_PASSWORD` e chave da sessão em `SESSION_SECRET`, ambos segredos do Worker. Sessão de 12 h em cookie HttpOnly, bloqueio de 15 min depois de 8 senhas erradas seguidas (acertar zera a contagem).
- Pix: BR Code estático gerado no Worker (valor + chave). O dinheiro cai direto na sua conta; não há baixa automática.

## Comandos

```bash
cd produto
npx wrangler deploy                      # publica tudo
npx wrangler secret put ADMIN_PASSWORD   # troca a senha da Central
npx wrangler dev --port 8788 --persist-to ../.wrangler-state   # testar local (crie .dev.vars com ADMIN_PASSWORD e SESSION_SECRET)
node ../scripts/demo/e2e.mjs http://127.0.0.1:8788 <senha>     # teste de ponta a ponta (só no local: cria dados)
```

## Design system

`produto/ds/` (público em `/ds/`): `tokens.css`, `components.css`, `icons.js` e a página de documentação. Os valores foram medidos nas telas reais do sistema (`scripts/demo/snapshot.cjs` congela as telas). A Central, o contrato e a fatura usam só isso.

## Subdomínio e sistema de cada escola

- Ao assinar o contrato, a escola ganha `<nome>.thayruan.com.br` (campo "Endereço do sistema"). Para colocar o endereço no ar: `cd produto && node provisionar-subdominios.mjs https://esporte.thayruan.com.br <senha>` (o Cloudflare cria DNS e certificado).
- Cliente **implantando**: o endereço mostra uma página com o nome e a situação. Cliente **ativo**: o endereço serve o sistema da escola de verdade (`produto/escola/`, gerado com `npx vite build --mode sem-firebase`).
- O sistema da escola não usa Firebase: `src/shim/core.ts` troca o Firestore e o Auth por rotas `/sys/*` do Worker (SQLite no Cloudflare, uma "caixa" por subdomínio). Usuários e dados entram por `POST /api/admin/sys-import` (veja `scripts/demo/exportar-para-escola.mjs`).
- Limites: só o administrador acessa por enquanto (portal do aluno/responsável não); consultas rodam no navegador sobre a coleção inteira; sem recuperação de senha por e-mail nem upload de arquivos; sem modo offline (PWA desligado).
