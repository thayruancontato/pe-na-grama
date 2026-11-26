#!/usr/bin/env bash
# Instala o servidor de WhatsApp (Evolution API) e liga tudo à Central sozinho. Uso: o comando gerado em Central > Configuracoes > Servidor de WhatsApp.
set -euo pipefail
: "${TOKEN:?Gere o comando na Central (Configuracoes > Servidor de WhatsApp)}"
: "${CENTRAL:?Falta o endereco da Central}"
[ "$(id -u)" = 0 ] || { echo "Rode com sudo."; exit 1; }

echo "==> Preparando a maquina"
command -v docker >/dev/null 2>&1 || curl -fsSL https://get.docker.com | sh
command -v jq >/dev/null 2>&1 || { (apt-get update -qq && apt-get install -y -qq jq) || yum install -y jq || dnf install -y jq; }
mkdir -p /opt/evolution && cd /opt/evolution

echo "==> Criando o endereco seguro no Cloudflare"
RESP=$(curl -sS -X POST "$CENTRAL/api/wa/registrar" -H 'content-type: application/json' -d "{\"token\":\"$TOKEN\"}")
[ "$(echo "$RESP" | jq -r '.ok // false')" = true ] || { echo "A Central recusou: $(echo "$RESP" | jq -r '.erro // .')"; exit 1; }
TUN=$(echo "$RESP" | jq -r '.tunnelToken // empty'); URL=$(echo "$RESP" | jq -r '.url // empty')
[ -n "$TUN" ] && [ -n "$URL" ] || { echo "Resposta inesperada: $RESP"; exit 1; }

KEY=$(openssl rand -hex 32); PG=$(openssl rand -hex 16)
umask 077
cat > .env <<ENV
SERVER_URL=$URL
AUTHENTICATION_API_KEY=$KEY
POSTGRES_PASSWORD=$PG
CLOUDFLARE_TUNNEL_TOKEN=$TUN
ENV
cat > docker-compose.yml <<'COMPOSE'
services:
  postgres:
    image: postgres:15-alpine
    restart: always
    environment: { POSTGRES_USER: evolution, POSTGRES_PASSWORD: "${POSTGRES_PASSWORD}", POSTGRES_DB: evolution }
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck: { test: ["CMD-SHELL", "pg_isready -U evolution"], interval: 10s, retries: 10 }
  redis:
    image: redis:7-alpine
    restart: always
    command: redis-server --save 60 1 --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes: [redisdata:/data]
  evolution:
    image: atendai/evolution-api:v2.1.1
    restart: always
    depends_on: { postgres: { condition: service_healthy }, redis: { condition: service_started } }
    environment:
      SERVER_URL: "${SERVER_URL}"
      AUTHENTICATION_API_KEY: "${AUTHENTICATION_API_KEY}"
      DATABASE_PROVIDER: postgresql
      DATABASE_CONNECTION_URI: "postgresql://evolution:${POSTGRES_PASSWORD}@postgres:5432/evolution"
      CACHE_REDIS_ENABLED: "true"
      CACHE_REDIS_URI: redis://redis:6379/0
      DATABASE_SAVE_DATA_INSTANCE: "true"
      DATABASE_SAVE_DATA_NEW_MESSAGE: "false"
      DATABASE_SAVE_MESSAGE_UPDATE: "false"
      DATABASE_SAVE_DATA_CONTACTS: "false"
      DATABASE_SAVE_DATA_CHATS: "false"
      DATABASE_SAVE_DATA_LABELS: "false"
      DATABASE_SAVE_DATA_HISTORIC: "false"
      CONFIG_SESSION_PHONE_CLIENT: Pe na Grama
      LOG_LEVEL: ERROR
    expose: ["8080"]
    volumes: [evoinstances:/evolution/instances]
  cloudflared:
    image: cloudflare/cloudflared:latest
    restart: always
    command: tunnel --no-autoupdate run
    environment: { TUNNEL_TOKEN: "${CLOUDFLARE_TUNNEL_TOKEN}" }
    depends_on: [evolution]
volumes: { pgdata: {}, redisdata: {}, evoinstances: {} }
COMPOSE

echo "==> Subindo o servidor (a primeira vez baixa as imagens, ~2 min)"
docker compose up -d
echo "==> Esperando o servidor responder em $URL"
for i in $(seq 1 60); do curl -fsS -o /dev/null "$URL" && break; sleep 5; done
curl -fsS -o /dev/null "$URL" || { echo "O servidor nao respondeu a tempo. Veja: docker compose logs evolution"; exit 1; }

echo "==> Ligando a Central e criando o WhatsApp das escolas"
curl -fsS -X POST "$CENTRAL/api/wa/pronto" -H 'content-type: application/json' -d "{\"token\":\"$TOKEN\",\"apikey\":\"$KEY\"}" | jq .
echo "Pronto. Agora, na Central, abra a escola > Controle total > WhatsApp e leia o QR com o celular do numero dela."
