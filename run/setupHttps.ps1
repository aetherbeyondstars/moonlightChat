# ============================================================================
# setupHttps.ps1 — Configura HTTPS local para desarrollo en LAN
# ----------------------------------------------------------------------------
# Uso: click derecho -> "Ejecutar con PowerShell" (como Administrador)
# ============================================================================

if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "Reiniciando como Administrador..." -ForegroundColor Yellow
    Start-Process powershell "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

$ErrorActionPreference = "Stop"
$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# ── 1. Instalar mkcert ───────────────────────────────────────────────────────
Write-Host ""
Write-Host "[ 1/5 ] Comprobando mkcert..." -ForegroundColor Cyan

if (-not (Get-Command mkcert -ErrorAction SilentlyContinue)) {
    Write-Host "        mkcert no encontrado, instalando..." -ForegroundColor Yellow

    if (Get-Command choco -ErrorAction SilentlyContinue) {
        choco install mkcert -y
    }
    elseif (Get-Command winget -ErrorAction SilentlyContinue) {
        winget install FiloSottile.mkcert --accept-source-agreements --accept-package-agreements
    }
    else {
        Write-Host "        Descargando mkcert directamente desde GitHub..." -ForegroundColor Yellow
        $mkcertPath = "$env:USERPROFILE\mkcert.exe"
        $url = "https://github.com/FiloSottile/mkcert/releases/latest/download/mkcert-v1.4.4-windows-amd64.exe"
        Invoke-WebRequest -Uri $url -OutFile $mkcertPath
        $env:Path += ";$env:USERPROFILE"
    }

    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User") + ";$env:USERPROFILE"
} else {
    Write-Host "        mkcert ya instalado." -ForegroundColor Green
}

if (-not (Get-Command mkcert -ErrorAction SilentlyContinue)) {
    Write-Host "Error: no se pudo instalar mkcert." -ForegroundColor Red
    exit 1
}

# ── 2. Instalar la CA local ──────────────────────────────────────────────────
Write-Host ""
Write-Host "[ 2/5 ] Instalando autoridad certificadora local..." -ForegroundColor Cyan
mkcert -install
Write-Host "        CA instalada." -ForegroundColor Green

# ── 3. Detectar IP de red local ─────────────────────────────────────────────
Write-Host ""
Write-Host "[ 3/5 ] Detectando IP de red local..." -ForegroundColor Cyan
$localIp = (Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -notmatch "^127\." -and $_.IPAddress -notmatch "^169\.254\." } |
    Sort-Object InterfaceMetric |
    Select-Object -First 1).IPAddress

if (-not $localIp) {
    Write-Host "No se pudo detectar la IP local. Conectate a una red WiFi o Ethernet." -ForegroundColor Red
    exit 1
}
Write-Host "        IP detectada: $localIp" -ForegroundColor Green

# ── 4. Generar certificados y copiar a frontend y backend ───────────────────
Write-Host ""
Write-Host "[ 4/5 ] Generando certificados SSL para $localIp..." -ForegroundColor Cyan

$frontendCertsDir = Join-Path $rootDir "..\frontend\certs"
$backendCertsDir  = Join-Path $rootDir "..\backend\certs"
New-Item -ItemType Directory -Force -Path $frontendCertsDir | Out-Null
New-Item -ItemType Directory -Force -Path $backendCertsDir  | Out-Null

Push-Location $frontendCertsDir
mkcert $localIp localhost 127.0.0.1
Pop-Location

# Copiar los mismos certificados al backend
Copy-Item "$frontendCertsDir\*" -Destination $backendCertsDir -Force

$certFile = Get-ChildItem $frontendCertsDir -Filter "*.pem" | Where-Object { $_.Name -notmatch "key" } | Select-Object -First 1
$keyFile  = Get-ChildItem $frontendCertsDir -Filter "*-key.pem" | Select-Object -First 1

if (-not $certFile -or -not $keyFile) {
    Write-Host "Error: no se encontraron los archivos .pem" -ForegroundColor Red
    exit 1
}
Write-Host "        Certificados generados en frontend/certs/ y backend/certs/" -ForegroundColor Green

# ── 5. Actualizar vite.config.js, frontend/.env y backend/.env ──────────────
Write-Host ""
Write-Host "[ 5/5 ] Actualizando configuracion..." -ForegroundColor Cyan

$viteConfig = @"
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
    https: {
      cert: fs.readFileSync(path.resolve(__dirname, 'certs/$($certFile.Name)')),
      key:  fs.readFileSync(path.resolve(__dirname, 'certs/$($keyFile.Name)')),
    },
  },
});
"@
Set-Content -Path (Join-Path $rootDir "..\frontend\vite.config.js") -Value $viteConfig -Encoding UTF8

$frontendEnv = Join-Path $rootDir "..\frontend\.env"
if (Test-Path $frontendEnv) {
    $envContent = Get-Content $frontendEnv
    $envContent = $envContent -replace "VITE_API_URL=.*", "VITE_API_URL=https://${localIp}:4000"
    Set-Content -Path $frontendEnv -Value $envContent -Encoding UTF8
}

$backendEnv = Join-Path $rootDir "..\backend\.env"
if (Test-Path $backendEnv) {
    $envContent = Get-Content $backendEnv
    $envContent = $envContent -replace "CLIENT_URL=.*", "CLIENT_URL=https://${localIp}:5173"
    Set-Content -Path $backendEnv -Value $envContent -Encoding UTF8
}
Write-Host "        Configuracion actualizada." -ForegroundColor Green

# ── Resumen ──────────────────────────────────────────────────────────────────
$mkcertRoot = & mkcert -CAROOT

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host " HTTPS configurado correctamente!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host " Frontend : https://${localIp}:5173" -ForegroundColor White
Write-Host " Backend  : https://${localIp}:4000" -ForegroundColor White
Write-Host ""
Write-Host " Para que el movil Android confie en el certificado:" -ForegroundColor Yellow
Write-Host "   1. Manda este archivo a tu telefono (email, Drive, cable...):" -ForegroundColor White
Write-Host "      $mkcertRoot\rootCA.pem" -ForegroundColor Gray
Write-Host "   2. Abrelo en el telefono e instalalo:" -ForegroundColor White
Write-Host "      Ajustes > Seguridad > Instalar certificado > Certificado CA" -ForegroundColor Gray
Write-Host "   3. Abre https://${localIp}:5173 en Chrome" -ForegroundColor White
Write-Host ""
Write-Host " Reinicia backend y frontend para aplicar los cambios." -ForegroundColor Yellow
Write-Host ""
Read-Host " Pulsa Enter para cerrar"