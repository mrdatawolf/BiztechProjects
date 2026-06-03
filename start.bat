@echo off
setlocal EnableDelayedExpansion
title ProjectPlan

echo.
echo  ==============================
echo       ProjectPlan  Startup
echo  ==============================
echo.

:: ── Locate directories ────────────────────────────────────────────────────────
set "ROOT_DIR=%~dp0"
:: Remove trailing backslash
if "%ROOT_DIR:~-1%"=="\" set "ROOT_DIR=%ROOT_DIR:~0,-1%"
set "APP_DIR=%ROOT_DIR%\app"
set "ROOT_ENV=%ROOT_DIR%\.env"
set "ROOT_ENV_EXAMPLE=%ROOT_DIR%\.env.example"

if not exist "%APP_DIR%" (
  echo [FAIL] Cannot find app\ directory at: %APP_DIR%
  pause
  exit /b 1
)

cd /d "%APP_DIR%"
echo [INFO] Working directory: %APP_DIR%

:: ── Check: Node.js ────────────────────────────────────────────────────────────
echo [INFO] Checking Node.js...
where node >nul 2>&1
if errorlevel 1 (
  echo [FAIL] Node.js is not installed.
  echo        Download it from https://nodejs.org ^(v18 or later required^).
  pause
  exit /b 1
)

:: Check minimum version (18+)
for /f "delims=" %%v in ('node -e "console.log(parseInt(process.versions.node.split(\".\")[0]))"') do set NODE_MAJOR=%%v
if !NODE_MAJOR! LSS 18 (
  echo [FAIL] Node.js v18 or later is required.
  for /f "delims=" %%v in ('node --version') do echo        You have: %%v
  echo        Update at https://nodejs.org
  pause
  exit /b 1
)
for /f "delims=" %%v in ('node --version') do echo [ OK  ] Node.js %%v

:: ── Check: npm ────────────────────────────────────────────────────────────────
echo [INFO] Checking npm...
where npm >nul 2>&1
if errorlevel 1 (
  echo [FAIL] npm is not installed. It normally ships with Node.js.
  echo        Reinstall Node from https://nodejs.org
  pause
  exit /b 1
)
for /f "delims=" %%v in ('npm --version') do echo [ OK  ] npm %%v

:: ── Check: .env (project root) ───────────────────────────────────────────────
echo [INFO] Checking .env...
if not exist "%ROOT_ENV%" (
  if exist "%ROOT_ENV_EXAMPLE%" (
    copy "%ROOT_ENV_EXAMPLE%" "%ROOT_ENV%" >nul
    echo [WARN] .env not found -- copied from .env.example.
    echo [WARN] Please review .env at the project root before using in production
    echo        ^(especially JWT_SECRET and DB_PATH^).
  ) else (
    echo [FAIL] .env file is missing from the project root and no .env.example to copy from.
    pause
    exit /b 1
  )
) else (
  echo [ OK  ] .env found at project root
)

:: ── Check: node_modules ───────────────────────────────────────────────────────
echo [INFO] Checking dependencies...
if not exist "node_modules" (
  echo [WARN] node_modules not found -- running npm install...
  call npm install
  if errorlevel 1 (
    echo [FAIL] npm install failed. Check your internet connection and try again.
    pause
    exit /b 1
  )
  echo [ OK  ] Dependencies installed
) else (
  echo [ OK  ] node_modules present
)

:: ── Ensure data directory exists ──────────────────────────────────────────────
echo [INFO] Checking data directory...
for /f "delims=" %%d in ('node -e "require(\"dotenv\").config({path:\"%ROOT_ENV:\=/%\"});const p=require(\"path\").resolve(\"%ROOT_DIR:\=/%\",process.env.DB_PATH||\"Data/projectdb\");console.log(require(\"path\").dirname(p))" 2^>nul') do set DATA_DIR=%%d
if "!DATA_DIR!"=="" set DATA_DIR=%ROOT_DIR%\Data
if not exist "!DATA_DIR!" (
  mkdir "!DATA_DIR!"
)
echo [ OK  ] Data directory ready: !DATA_DIR!

:: ── Read host/port for display ───────────────────────────────────────────────
for /f "delims=" %%p in ('node -e "require(\"dotenv\").config({path:\"%ROOT_ENV:\=/%\"});console.log(process.env.PORT||3000)" 2^>nul') do set PORT=%%p
if "!PORT!"=="" set PORT=3000
for /f "delims=" %%h in ('node -e "require(\"dotenv\").config({path:\"%ROOT_ENV:\=/%\"});const h=process.env.HOST||\"0.0.0.0\";console.log(h===\"0.0.0.0\"?\"localhost\":h)" 2^>nul') do set DISPLAY_HOST=%%h
if "!DISPLAY_HOST!"=="" set DISPLAY_HOST=localhost

:: ── Launch ────────────────────────────────────────────────────────────────────
echo.
echo  All checks passed. Starting server...
echo  Open your browser at: http://!DISPLAY_HOST!:!PORT!
echo.

node server\index.js
if errorlevel 1 (
  echo.
  echo [FAIL] Server exited with an error. See output above.
  pause
)
