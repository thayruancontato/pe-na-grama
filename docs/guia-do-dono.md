# Guia do dono (Central do dono)

Endereço: `https://esporte.thayruan.com.br/admin`. A senha da Central fica só com você (guarde em um gerenciador de senhas).

## Rotina para uma escola nova
1. **Pedidos**: o pedido chega pela landing page. Abra, ajuste a proposta e envie o contrato.
2. **Contratos**: o cliente assina no link. Ao assinar, a escola vira **Cliente**, ganha um endereço (`nome-da-escola.thayruan.com.br`) e a primeira fatura.
3. **Publicar o endereço** (passo manual): rode `node produto/provisionar-subdominios.mjs` e depois `npx wrangler deploy` em `produto/`. Sem isso o endereço novo mostra a página "Implantando".
4. **Clientes > Detalhes > Sistema da escola**: veja a situação (matrículas, usuários, última ação) e clique em **Gerar acesso do administrador**. Anote e envie o endereço, o e-mail e a senha: a senha aparece uma única vez.
5. Mude a **Situação** para **Ativo**. Com isso o endereço passa a abrir o sistema de verdade.

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
