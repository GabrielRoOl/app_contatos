#!/data/data/com.termux/files/usr/bin/sh
# Controla o App Contatos no Termux: API (porta 3333), nginx (8100) e backup diário.
# Usa o Postgres compartilhado com o aura (porta 5431). Segue o padrão do aura.sh.
DIR="$HOME/contatos"
PGD="$PREFIX/var/lib/postgresql"
LOGS="$HOME/logs"
mkdir -p "$LOGS" "$DIR/backups"

start() {
  # Postgres: sobe só se ninguém subiu (o aura.sh também sobe)
  pg_isready -h localhost -p 5431 -q || {
    rm -f "$PGD/postmaster.pid"
    pg_ctl -D "$PGD" -l "$LOGS/postgres.log" start >/dev/null
    for i in $(seq 1 30); do pg_isready -h localhost -p 5431 -q && break; sleep 2; done
  }
  pgrep -f "nginx: master" >/dev/null || nginx
  tmux has-session -t contatos 2>/dev/null || tmux new-session -d -s contatos \
    "while true; do $DIR/api.sh >> $LOGS/contatos-api.log 2>&1; sleep 5; done"
  tmux has-session -t contatos-backup 2>/dev/null || tmux new-session -d -s contatos-backup \
    "while true; do $DIR/backup.sh >> $LOGS/contatos-backup.log 2>&1; sleep 3600; done"
  echo "iniciado (a API leva ~40s)"
}

stop() {
  tmux kill-session -t contatos 2>/dev/null
  tmux kill-session -t contatos-backup 2>/dev/null
  pkill -f contatos-api.jar
  echo parado   # Postgres e nginx são do aura também: não paro aqui
}

status() {
  pg_isready -h localhost -p 5431 -q && echo "postgres ok" || echo "postgres FORA"
  pgrep -f "nginx: master" >/dev/null && echo "nginx ok" || echo "nginx FORA"
  c=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8100/api/v1/pessoas)
  case $c in 401|403) echo "api ok ($c)";; *) echo "api: $c";; esac
  ls -1t "$DIR"/backups 2>/dev/null | head -1 | sed 's/^/ultimo backup: /'
}

case "$1" in
  start) start;; stop) stop;; restart) stop; sleep 2; start;; status) status;;
  *) echo "uso: contatos.sh start|stop|restart|status";;
esac
