#!/data/data/com.termux/files/usr/bin/sh
# Um dump a cada 6 h (00, 06, 12, 18) em ~/contatos/backups; guarda os 28 mais recentes (7 dias). Idempotente.
DIR="$HOME/contatos"
set -a; . "$DIR/.env"; set +a
FAIXA=$(printf "%02d" $(( $(date +%-H) / 6 * 6 )))
OUT="$DIR/backups/contatos-$(date +%F)-$FAIXA.sql.gz"
[ -s "$OUT" ] && exit 0
export PGPASSWORD="$POSTGRES_PASSWORD"
if pg_dump -h localhost -p "$POSTGRES_PORT" -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$OUT.tmp" && [ -s "$OUT.tmp" ]; then
  mv "$OUT.tmp" "$OUT"; echo "$(date '+%F %T') backup ok: $OUT"
else
  rm -f "$OUT.tmp"; echo "$(date '+%F %T') backup FALHOU"; exit 1
fi
ls -1t "$DIR"/backups/contatos-*.sql.gz | tail -n +29 | xargs -r rm -f
