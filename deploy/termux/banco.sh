#!/data/data/com.termux/files/usr/bin/sh
# Cria usuário e banco "contatos" no Postgres compartilhado (5431) e o ~/contatos/.env.
# Não mexe no banco do aura. Não imprime token nem senha. Seguro rodar de novo: não sobrescreve.
DIR="$HOME/contatos"
ENV="$DIR/.env"
DOMINIO="${1:?uso: bash banco.sh <dominio>}"
mkdir -p "$DIR"
rand() { head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'; }
if [ ! -f "$ENV" ]; then
  umask 077
  cat > "$ENV" <<EOT
PORT=3333
API_TOKEN=$(rand)
CORS_ORIGIN=https://$DOMINIO
TZ=America/Sao_Paulo
POSTGRES_HOST=localhost
POSTGRES_PORT=5431
POSTGRES_DB=contatos
POSTGRES_USER=contatos
POSTGRES_PASSWORD=$(rand)
EOT
  echo ".env criado"
fi
chmod 600 "$ENV"
set -a; . "$ENV"; set +a
PSQL="psql -h localhost -p $POSTGRES_PORT -d postgres -v ON_ERROR_STOP=1 -q"
$PSQL -tAc "select 1 from pg_roles where rolname='$POSTGRES_USER'" | grep -q 1 \
  && $PSQL -c "alter role $POSTGRES_USER with login password '$POSTGRES_PASSWORD'" \
  || $PSQL -c "create role $POSTGRES_USER login password '$POSTGRES_PASSWORD'"
$PSQL -tAc "select 1 from pg_database where datname='$POSTGRES_DB'" | grep -q 1 \
  || $PSQL -c "create database $POSTGRES_DB owner $POSTGRES_USER encoding 'UTF8'"
echo "banco ok"
