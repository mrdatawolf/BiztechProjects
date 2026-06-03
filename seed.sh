#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${CYAN}[Seed]${NC} $*"; }
ok()    { echo -e "${GREEN}[  OK  ]${NC} $*"; }
warn()  { echo -e "${YELLOW}[ WARN ]${NC} $*"; }
fail()  { echo -e "${RED}[ FAIL ]${NC} $*"; exit 1; }

echo ""
echo -e "${CYAN}╔══════════════════════════════╗${NC}"
echo -e "${CYAN}║     ProjectPlan  Seeder      ║${NC}"
echo -e "${CYAN}╚══════════════════════════════╝${NC}"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$SCRIPT_DIR/app"

[ -d "$APP_DIR" ] || fail "Cannot find app/ directory at: $APP_DIR"
cd "$APP_DIR"

command -v node &>/dev/null || fail "Node.js is not installed."
[ -d "node_modules" ]       || fail "node_modules not found — run start.sh first to install dependencies."

# ── First attempt (no --force) ────────────────────────────────────────────────
info "Running seed…"
OUTPUT=$(node server/seed.js 2>&1)
echo "$OUTPUT"

# If seed reported existing data, ask the user
if echo "$OUTPUT" | grep -q "already contains data"; then
  echo ""
  warn "The database already has data."
  echo -e "${YELLOW}  Wiping will permanently delete all existing projects, tasks, users, and time entries.${NC}"
  echo ""
  read -r -p "$(echo -e "${YELLOW}  Force wipe and re-seed with demo data? [y/N]:${NC} ")" REPLY
  echo ""

  case "$REPLY" in
    [yY][eE][sS]|[yY])
      info "Wiping and re-seeding…"
      node server/seed.js --force
      ;;
    *)
      warn "Aborted — existing data kept."
      exit 0
      ;;
  esac
fi

echo ""
ok "Done. Start the server with: ./start.sh"
