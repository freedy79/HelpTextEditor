#!/usr/bin/env bash
set -euo pipefail

START_DIR="$(pwd)"

open_terminal() {
  local title="$1"
  local command="$2"
  local full_command="cd \"$START_DIR\" && $command"

  if grep -qi microsoft /proc/version 2>/dev/null && command -v wt.exe >/dev/null 2>&1; then
    if [[ -n "${WSL_DISTRO_NAME:-}" ]]; then
      wt.exe -w 0 new-tab --title "$title" wsl.exe -d "$WSL_DISTRO_NAME" -- bash -lc "$full_command"
    else
      wt.exe -w 0 new-tab --title "$title" wsl.exe -- bash -lc "$full_command"
    fi
    return 0
  fi

  if command -v gnome-terminal >/dev/null 2>&1; then
    gnome-terminal --title="$title" -- bash -lc "$full_command"
    return 0
  fi

  if command -v x-terminal-emulator >/dev/null 2>&1; then
    x-terminal-emulator -T "$title" -e bash -lc "$full_command"
    return 0
  fi

  if command -v konsole >/dev/null 2>&1; then
    konsole --new-tab -p tabtitle="$title" -e bash -lc "$full_command"
    return 0
  fi

  echo "No supported terminal emulator found (gnome-terminal, x-terminal-emulator, konsole)." >&2
  return 1
}

open_terminal "backend" "cd backend && npm start" &
open_terminal "frontend" "npm start" &
wait
