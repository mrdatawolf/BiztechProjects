#!/usr/bin/env bash
set -euo pipefail

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${CYAN}[ProjectPlan]${NC} $*"; }
ok()    { echo -e "${GREEN}[  OK  ]${NC} $*"; }
warn()  { echo -e "${YELLOW}[ WARN ]${NC} $*"; }
fail()  { echo -e "${RED}[ FAIL ]${NC} $*"; exit 1; }

echo ""
echo -e "${CYAN}╔══════════════════════════════╗${NC}"
echo -e "${CYAN}║     ProjectPlan  Startup     ║${NC}"
echo -e "${CYAN}╚══════════════════════════════╝${NC}"
echo ""

# ── Locate app/ directory ─────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$SCRIPT_DIR/app"

if [ ! -d "$APP_DIR" ]; then
  fail "Cannot find app/ directory at: $APP_DIR"
fi

cd "$APP_DIR"
info "Working directory: $APP_DIR"

# ── Check: Node.js ────────────────────────────────────────────────────────────
info "Checking Node.js..."
if ! command -v node &>/dev/null; then
  fail "Node.js is not installed. Download it from https://nodejs.org (v18 or later required)."
fi

NODE_VERSION=$(node -e "process.exit(parseInt(process.versions.node.split('.')[0]))" 2>/dev/null; node -e "console.log(parseInt(process.versions.node.split('.')[0]))")
if [ "$NODE_VERSION" -lt 18 ]; then
  fail "Node.js v18 or later is required. You have: $(node --version). Update at https://nodejs.org"
fi
ok "Node.js $(node --version)"

# ── Check: npm ────────────────────────────────────────────────────────────────
info "Checking npm..."
if ! command -v npm &>/dev/null; then
  fail "npm is not installed. It normally ships with Node.js — reinstall Node from https://nodejs.org"
fi
ok "npm $(npm --version)"

# ── Check: .env (root of project, one level up from app/) ────────────────────
info "Checking .env..."
ROOT_ENV="$SCRIPT_DIR/.env"
ROOT_ENV_EXAMPLE="$SCRIPT_DIR/.env.example"
if [ ! -f "$ROOT_ENV" ]; then
  if [ -f "$ROOT_ENV_EXAMPLE" ]; then
    cp "$ROOT_ENV_EXAMPLE" "$ROOT_ENV"
    warn ".env not found — copied from .env.example."
    warn "Please review .env at the project root before using in production"
    warn "(especially JWT_SECRET and DB_PATH)."
  else
    fail ".env file is missing from the project root and no .env.example to copy from."
  fi
else
  ok ".env found at project root"
fi

# ── Check: node_modules ───────────────────────────────────────────────────────
info "Checking dependencies..."
if [ ! -d "node_modules" ]; then
  warn "node_modules not found — running npm install..."
  npm install
  ok "Dependencies installed"
else
  ok "node_modules present"
fi

# ── Ensure data directory exists ──────────────────────────────────────────────
info "Checking data directory..."
DATA_DIR=$(node -e "require('dotenv').config({path:'$ROOT_ENV'}); const p=require('path').resolve('$SCRIPT_DIR', process.env.DB_PATH||'Data/projectdb'); console.log(require('path').dirname(p))" 2>/dev/null || echo "$SCRIPT_DIR/Data")
mkdir -p "$DATA_DIR"
ok "Data directory ready: $DATA_DIR"

# ── Read host/port for display ────────────────────────────────────────────────
PORT=$(node -e "require('dotenv').config({path:'$ROOT_ENV'}); console.log(process.env.PORT||3000)" 2>/dev/null || echo "3000")
HOST=$(node -e "require('dotenv').config({path:'$ROOT_ENV'}); const h=process.env.HOST||'0.0.0.0'; console.log(h==='0.0.0.0'?'localhost':h)" 2>/dev/null || echo "localhost")

# ── Launch ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}All checks passed. Starting server...${NC}"
echo -e "${CYAN}Open your browser at: http://${HOST}:${PORT}${NC}"
echo ""

exec node server/index.js
