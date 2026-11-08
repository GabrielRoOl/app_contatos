#!/data/data/com.termux/files/usr/bin/sh
# Um dump por dia em ~/contatos/backups, guarda os 14 mais recentes. Idempotente.
DIR="$HOME/contatos"
set -a; . "$DIR/.env"; set +a
OUT="$DIR/backups/contatos-$(date +%F).sql.gz"
[ -s "$OUT" ] && exit 0
export PGPASSWORD="$POSTGRES_PASSWORD"
if pg_dump -h localhost -p "$POSTGRES_PORT" -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$OUT.tmp" && [ -s "$OUT.tmp" ]; then
  mv "$OUT.tmp" "$OUT"; echo "$(date '+%F %T') backup ok: $OUT"
else
  rm -f "$OUT.tmp"; echo "$(date '+%F %T') backup FALHOU"; exit 1
fi
ls -1t "$DIR"/backups/contatos-*.sql.gz | tail -n +15 | xargs -r rm -f
