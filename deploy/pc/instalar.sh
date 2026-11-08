#!/usr/bin/env bash
# Instala o backup no PC: copia o script e liga o timer do systemd (modo usuário).
set -euo pipefail
AQUI="$(cd "$(dirname "$0")" && pwd)"
mkdir -p ~/.local/bin ~/.config/systemd/user
install -m 755 "$AQUI/baixar-backup.sh" ~/.local/bin/contatos-baixar-backup
install -m 644 "$AQUI/contatos-backup.service" "$AQUI/contatos-backup.timer" ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now contatos-backup.timer
systemctl --user list-timers contatos-backup.timer --no-pager
