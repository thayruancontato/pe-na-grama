# Guia do dono (Central do dono)

Endereço: `https://esporte.thayruan.com.br/admin`. A senha da Central fica só com você (guarde em um gerenciador de senhas).

## Rotina para uma escola nova
1. **Pedidos**: o pedido chega pela landing page. Abra, ajuste a proposta e envie o contrato.
2. **Contratos**: o cliente assina no link. Ao assinar, a escola vira **Cliente**, ganha um endereço (`nome-da-escola.thayruan.com.br`) e a primeira fatura.
3. **Publicar o endereço**: é automático no momento da assinatura, desde que a chave do Cloudflare esteja configurada (veja "Configurar a publicação automática" abaixo). Em Clientes > Detalhes, "Endereço no ar" mostra o estado, e **Publicar endereço** tenta de novo. Para republicar todas de uma vez (reparo): `node produto/provisionar-subdominios.mjs <central> <senha>`. **Não coloque domínios de escola em `[[routes]]` no `wrangler.toml`:** com rotas no arquivo, cada `wrangler deploy` apaga os domínios que não estão nele (testado: o endereço caiu com erro 530). Sem rotas no arquivo, o deploy preserva todos.
4. **Clientes > Detalhes > Sistema da escola**: veja a situação (matrículas, usuários, última ação) e clique em **Gerar acesso do administrador**. Anote e envie o endereço, o e-mail e a senha: a senha aparece uma única vez.
5. Mude a **Situação** para **Ativo**. Com isso o endereço passa a abrir o sistema de verdade.

## Configurar a publicação automática (uma vez)
1. No painel do Cloudflare: **Meu perfil > Tokens de API > Criar token > modelo "Editar Cloudflare Workers"**.
2. Em "Recursos da zona", escolha **thayruan.com.br** (a zona precisa estar na lista) e, se o modelo não incluir, adicione a permissão **Zona > DNS > Editar**.
3. Copie o token e, na pasta `produto/`, rode `npx wrangler secret put CF_API_TOKEN` e cole quando pedir (o token não fica em arquivo nem no repositório).
4. Teste em Clientes > Detalhes > **Publicar endereço**: deve aparecer "Publicado".

## Limites e suspensão
- **Limite de matrículas**: no mesmo bloco. `0` é sem limite. Ao chegar no limite, o formulário público e a importação recusam novas matrículas.
- **Suspender**: mude a Situação para **Pausado** ou **Encerrado**. O endereço volta a mostrar a página de aviso.

## Cobrança e pagamento
- As faturas saem pelo contrato. Configure a **chave Pix** em Configurações para o cliente ver o Pix ao pagar.
- Cada escola escolhe o próprio provedor de pagamento no painel dela.

## O que não é automático
- Criar o servidor de WhatsApp de cada escola (veja `docs/evolution-por-escola.md`).
- Backup automático: não há agendador. A escola baixa o backup em **Inscrições e backup**.
- Domínio próprio da escola.
