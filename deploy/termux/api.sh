#!/data/data/com.termux/files/usr/bin/sh
# Roda a API em primeiro plano, com as variáveis do .env (token e senha ficam só nele).
cd "$HOME/contatos" || exit 1
set -a; . "$HOME/contatos/.env"; set +a
export SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE=3
exec java -Xmx192m -Xss512k -XX:+UseSerialGC -Duser.timezone=America/Sao_Paulo \
  -jar "$HOME/contatos/contatos-api.jar"
