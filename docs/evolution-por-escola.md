# Um servidor de WhatsApp (Evolution API) por escola

Cada escola tem o próprio servidor Evolution API e o próprio número. O sistema da escola guarda só o endereço, o nome da instância e a chave (cifrada) em **Mensagens > Servidor WhatsApp**.

## Criar o servidor de uma escola
1. Uma máquina com Docker e um endereço https próprio (ex.: `whatsapp.suaescola.com.br`, com proxy reverso e certificado). Não dá para rodar no Cloudflare Workers: a Evolution API precisa de um processo contínuo.
2. Copie `scripts/evolution/` para a máquina e crie o `.env`:
```
SERVER_URL=https://whatsapp.suaescola.com.br
AUTHENTICATION_API_KEY=<gere uma chave longa e única para esta escola>
DATABASE_ENABLED=true
DATABASE_PROVIDER=postgresql
DATABASE_CONNECTION_URI=postgresql://evolution:<POSTGRES_PASSWORD>@postgres:5432/evolution
POSTGRES_PASSWORD=<outra senha>
```
3. `docker compose up -d`.
4. No sistema da escola: Mensagens > Servidor WhatsApp: endereço, nome da instância e a AUTHENTICATION_API_KEY > Salvar > Criar instância > Gerar QR Code e ler com o WhatsApp da escola.

## O que é automático e o que não é
- Automático: o sistema guarda a configuração por escola, cifra a chave e fala com o servidor (status, QR, envio).
- Manual: **criar e hospedar o servidor** de cada escola. Isso exige uma máquina, que pode ser gratuita em alguns provedores (confira os limites vigentes antes), e um número de WhatsApp dedicado.
- Pendente: as telas antigas de Mensagens e Cobranças ainda chamam o servidor global do projeto original. Elas precisam ser migradas para esta configuração por escola.
