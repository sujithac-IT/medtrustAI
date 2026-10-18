<#
.SYNOPSIS
  One-command Windows runner: sets up virtualenv, installs dependencies, builds frontend,
  and serves API + SPA on http://localhost:8000 (and 0.0.0.0:8000).
#>
[CmdletBinding()]
param(
    [string]$Port = $env:PORT,
    [string]$HostAddress = $env:HOST,
    [switch]$SkipFrontendBuild
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

if (-not $Port) { $Port = "8000" }
if (-not $HostAddress) { $HostAddress = "0.0.0.0" }

# 1. Virtual environment setup
$VenvPython = Join-Path $ScriptDir ".venv\Scripts\python.exe"
if (-not (Test-Path $VenvPython)) {
    Write-Host "Creating Python virtualenv (.venv)..." -ForegroundColor Cyan
    python -m venv .venv
}

# 2. Python dependencies
$Req = "backend\requirements.txt"
if ($env:DATABASE_URL -or $env:REDIS_URL) {
    $Req = "backend\requirements-scale.txt"
}
Write-Host "Checking backend dependencies ($Req)..." -ForegroundColor Cyan
& $VenvPython -m pip install -q -r $Req

# 3. Frontend build
if (-not $SkipFrontendBuild -and ($env:SKIP_FRONTEND_BUILD -ne "1")) {
    $FrontendDir = Join-Path $ScriptDir "frontend"
    Write-Host "Building frontend SPA..." -ForegroundColor Cyan
    Push-Location $FrontendDir
    try {
        if (-not (Test-Path "node_modules")) {
            npm ci --no-audit --no-fund
        }
        npm run build
    } finally {
        Pop-Location
    }
}

# 4. Copy .env.example to .env if missing
if (-not (Test-Path ".env") -and (Test-Path ".env.example")) {
    Write-Host "Creating default .env from .env.example..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
}

# 5. Start Backend + SPA server
Write-Host "==========================================================" -ForegroundColor Green
Write-Host " MedTrust AI starting on http://localhost:$Port" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green

Push-Location (Join-Path $ScriptDir "backend")
try {
    & $VenvPython -m uvicorn app.main:app `
        --host $HostAddress `
        --port $Port `
        --proxy-headers `
        --forwarded-allow-ips "127.0.0.1" `
        --ws-max-size 65536 `
        --timeout-keep-alive 15 `
        --limit-concurrency 500 `
        --no-server-header
} finally {
    Pop-Location
}
