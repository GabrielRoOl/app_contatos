#!/usr/bin/env bash
# Baixa do celular-servidor os dumps do Contatos que ainda não estão no PC.
# Idempotente e barato: se o celular não responde, só registra e sai (o timer tenta de novo na próxima hora).
# Destino: ~/backups-contatos (fora do repositório). Apaga o que tem mais de 90 dias (3 meses).
set -uo pipefail
DESTINO="${BACKUP_DESTINO:-$HOME/backups-contatos}"
mkdir -p "$DESTINO"
log() { echo "$(date '+%F %T') $*"; }

for host in celular-wifi celular; do
  if ssh -o BatchMode=yes -o ConnectTimeout=10 "$host" true 2>/dev/null; then
    ORIGEM="$host"; break
  fi
done
if [ -z "${ORIGEM:-}" ]; then log "celular fora do ar ou fora da rede; tento na próxima"; exit 0; fi

# --ignore-existing: nunca sobrescreve um backup já baixado
if ! rsync -a --ignore-existing --include='contatos-*.sql.gz' --exclude='*' "$ORIGEM:contatos/backups/" "$DESTINO/"; then
  log "rsync falhou ($ORIGEM)"; exit 1
fi

# confere cada dump: gzip íntegro e com a tabela pessoa
ruim=0
for f in "$DESTINO"/contatos-*.sql.gz; do
  [ -e "$f" ] || continue
  [ -e "$f.ok" ] && continue
  if gzip -t "$f" 2>/dev/null && zcat "$f" | grep -q 'CREATE TABLE public.pessoa'; then touch "$f.ok"
  else log "DUMP INVALIDO: $f"; ruim=1; fi
done

find "$DESTINO" -maxdepth 1 -name 'contatos-*.sql.gz*' -mtime +90 -delete
log "ok via $ORIGEM; ultimo: $(ls -1t "$DESTINO"/contatos-*.sql.gz | head -1 | xargs -r basename)"
exit $ruim
