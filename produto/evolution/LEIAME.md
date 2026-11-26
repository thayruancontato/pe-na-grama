# Servidor de WhatsApp das escolas (Evolution API) — custo zero

Um único servidor atende todas as escolas. Cada escola tem uma **instância própria**: número, chave e conversas isoladas.
O sistema cria a instância sozinho quando a escola é criada; você só conecta o número lendo o QR (Central → escola → Controle total → WhatsApp).

## Por que assim (barato, estável, escalável)
- **Oracle Cloud "Always Free"**: máquina ARM com até 4 núcleos e 24 GB de RAM, grátis para sempre. Cada instância usa ~50–80 MB; cabem algumas centenas de escolas.
- **Cloudflare Tunnel**: grátis, HTTPS no seu domínio e nenhuma porta aberta na máquina.
- **Postgres + Redis** no mesmo servidor, com gravação de mensagens desligada (menos disco; o histórico fica no celular).
- Crescer = criar outra máquina igual e outro endereço; a Central aceita um servidor por vez (hoje um).

## Passo a passo (uma vez só, ~5 minutos)
1. Crie a conta em oracle.com/cloud/free e uma máquina **VM.Standard.A1.Flex** (Ubuntu 22.04, 2–4 OCPU, 12–24 GB). Qualquer Linux com Docker serve.
2. Na Central: **Configurações → Servidor de WhatsApp → Gerar comando de instalação** e copie o comando.
3. Entre na máquina por SSH e cole o comando. Ele instala o Docker, cria o endereço seguro (`wa.seudominio`) no Cloudflare, sobe o servidor, liga a Central e **cria o WhatsApp de todas as escolas**. Nada para digitar.
4. Por escola: **Clientes → Controle → WhatsApp → Mostrar QR code** e leia com o celular do número dela.
Escolas criadas depois já nascem com o WhatsApp pronto (falta só ler o QR).

(O `docker-compose.yml` desta pasta é a versão manual do que o comando faz.)

## Manutenção
- Backup semanal: `docker compose exec postgres pg_dump -U evolution evolution | gzip > backup-$(date +%F).sql.gz`
- Atualizar: troque a versão da imagem no compose, `docker compose pull && docker compose up -d`.
- Cuidado: o WhatsApp não oficial (Baileys) pode ter número banido se disparar spam; mantenha envios moderados e só para contatos conhecidos.
