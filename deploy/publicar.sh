#!/usr/bin/env bash
# Roda no PC: gera o jar e a PWA e envia para o celular (host ssh "celular-wifi" por padrão).
# Uso: deploy/publicar.sh [host-ssh]
set -euo pipefail
HOST="${1:-celular-wifi}"
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"

(cd "$RAIZ/api" && mvn -q -DskipTests package)
(cd "$RAIZ/web" && npm run build)

ssh "$HOST" 'mkdir -p ~/contatos/web ~/contatos/backups ~/logs'
rsync -az "$RAIZ/api/target/contatos-api-0.1.0.jar" "$HOST:contatos/contatos-api.jar.novo"
rsync -az --delete "$RAIZ/web/dist/" "$HOST:contatos/web/"
rsync -az "$RAIZ"/deploy/termux/{contatos.sh,api.sh,backup.sh,banco.sh,nginx-contatos.conf} "$HOST:contatos/"
rsync -az "$RAIZ/deploy/termux/40-contatos" "$HOST:.termux/boot/40-contatos"
ssh "$HOST" 'cd ~/contatos && chmod +x *.sh ~/.termux/boot/40-contatos && mv contatos-api.jar.novo contatos-api.jar'
echo "enviado. Para aplicar a nova API: ssh $HOST '~/contatos/contatos.sh restart'"
