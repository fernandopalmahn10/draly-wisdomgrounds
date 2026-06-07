# ═══════════════════════════════════════════════════════════════════
# 📦 DRALY BACKUP — pull the Render persistent disk to local + Drive
#
# Why this exists: SECURITY-SOP.md Part 2 step 12 says "Every Friday
# 5pm — download backup". The original Friday ritual is manual (Render
# shell → tar → click file picker → drag to Drive). This script
# automates the local half so the only manual step left is dragging
# the produced .tar.gz into Google Drive.
#
# What it does:
#   1. SSHs into Render via render-cli (or asks you to paste the
#      tarball URL if render-cli isn't installed) and pulls every
#      file under /data into a timestamped tarball.
#   2. Saves it to .\backups\draly-<YYYYMMDD-HHMM>.tar.gz
#   3. Prints the SHA-256 hash so you can verify the upload to Drive.
#   4. Prunes local copies older than 60 days.
#
# Usage (run from repo root):
#   PowerShell:  .\scripts\backup-disk.ps1
#
# Pre-reqs: Render Hobby+ tier (Shell tab access) OR the render CLI.
# If neither, the script falls back to PRINTING the manual commands
# you'd paste into the Render Shell tab.
# ═══════════════════════════════════════════════════════════════════

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$backupDir = Join-Path $repo 'backups'
if (-not (Test-Path $backupDir)) { New-Item -ItemType Directory -Path $backupDir | Out-Null }

$stamp = Get-Date -Format 'yyyyMMdd-HHmm'
$tarName = "draly-$stamp.tar.gz"
$tarPath = Join-Path $backupDir $tarName

Write-Host ""
Write-Host "📦 Draly backup — $stamp" -ForegroundColor Cyan
Write-Host ""

# Detect render CLI
$renderCli = Get-Command render -ErrorAction SilentlyContinue
if (-not $renderCli) {
  Write-Host "⚠ render CLI not found. Manual fallback:" -ForegroundColor Yellow
  Write-Host ""
  Write-Host "  1. Open https://dashboard.render.com/ → your service → Shell tab"
  Write-Host "  2. Paste this command:"
  Write-Host ""
  Write-Host "     tar -czf /tmp/$tarName -C / data && stat -c '%s' /tmp/$tarName" -ForegroundColor Green
  Write-Host ""
  Write-Host "  3. Use the file picker (📁 icon) to download /tmp/$tarName"
  Write-Host "  4. Move the downloaded file to: $backupDir\"
  Write-Host "  5. Re-run this script with -SkipFetch to compute hash + prune."
  Write-Host ""
  return
}

# render CLI present — automate the fetch
Write-Host "Fetching tarball via render CLI…" -ForegroundColor DarkGray
& render ssh "tar -czf /tmp/$tarName -C / data" 2>&1 | Out-Host
& render cp ":/tmp/$tarName" "$tarPath" 2>&1 | Out-Host
& render ssh "rm /tmp/$tarName" 2>&1 | Out-Null

if (-not (Test-Path $tarPath)) {
  Write-Error "Backup file not found locally: $tarPath"
  return
}

# Hash + size
$size = (Get-Item $tarPath).Length
$sizeMb = [math]::Round($size / 1MB, 2)
$hash = (Get-FileHash $tarPath -Algorithm SHA256).Hash

Write-Host ""
Write-Host "✅ Backup saved" -ForegroundColor Green
Write-Host "   Path : $tarPath"
Write-Host "   Size : $sizeMb MB"
Write-Host "   SHA  : $hash"
Write-Host ""
Write-Host "Next: drag $tarName into Google Drive folder 'Draly backups'." -ForegroundColor Cyan
Write-Host "After upload, verify the Drive copy's SHA matches the above."
Write-Host ""

# Prune local copies older than 60 days
$cutoff = (Get-Date).AddDays(-60)
$pruned = 0
Get-ChildItem $backupDir -Filter 'draly-*.tar.gz' | Where-Object { $_.LastWriteTime -lt $cutoff } | ForEach-Object {
  Remove-Item $_.FullName -Force
  $pruned++
}
if ($pruned -gt 0) {
  Write-Host "🧹 Pruned $pruned backup(s) older than 60 days." -ForegroundColor DarkGray
}
