#!/usr/bin/env bash
set -euo pipefail

open_terminal() {
  local title="$1"
  local command="$2"

  if command -v gnome-terminal >/dev/null 2>&1; then
    gnome-terminal --title="$title" -- bash -lc "$command"
    return 0
  fi

  if command -v x-terminal-emulator >/dev/null 2>&1; then
    x-terminal-emulator -T "$title" -e bash -lc "$command"
    return 0
  fi

  if command -v konsole >/dev/null 2>&1; then
    konsole --new-tab -p tabtitle="$title" -e bash -lc "$command"
    return 0
  fi

  echo "No supported terminal emulator found (gnome-terminal, x-terminal-emulator, konsole)." >&2
  return 1
}

open_terminal "backend" "cd backend && npm start"
open_terminal "frontend" "cd frontend && npm start"
