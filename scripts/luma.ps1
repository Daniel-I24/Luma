# -----------------------------------------------------------------
# luma.ps1 - set up Luma without pasting long commands.
# Usage (PowerShell, in the repository folder):
#   powershell -ExecutionPolicy Bypass -File scripts\luma.ps1
# Once, before: "npx supabase login" and "npx supabase link".
# An option only says OK when the project confirms it (luma\remote.ps1).
# Secrets live in %USERPROFILE%\luma-secrets (outside the repository);
# none is ever shown. Every option can be repeated.
# -----------------------------------------------------------------
param([string]$Option = '')
$ErrorActionPreference = 'Stop'
foreach ($part in 'common', 'remote', 'ai', 'push', 'payments', 'routes', 'whatsapp', 'apk', 'doctor', 'all') {
  . (Join-Path $PSScriptRoot "luma/$part.ps1")
}

$menu = [ordered]@{
  '1' = @('Luma IA (clave, modelo y respaldo de Gemini)', { Invoke-LumaAi (Get-LumaTarget) })
  '2' = @('Notificaciones push', { Invoke-LumaPush (Get-LumaTarget) })
  '3' = @('Pagos de Wompi en sandbox', { Invoke-LumaPayments (Get-LumaTarget) })
  '4' = @('Rutas (OpenRouteService)', { Invoke-LumaRoutes (Get-LumaTarget) })
  '5' = @('WhatsApp (verificacion de contactos)', { Invoke-LumaWhatsapp (Get-LumaTarget) })
  '6' = @('Compilar e instalar el APK', { Invoke-LumaApk })
  '7' = @('Diagnostico (npm run doctor)', { Invoke-LumaDoctor })
  '8' = @('Desplegar y verificar todo', { Invoke-LumaAll (Get-LumaTarget) })
}

while ($true) {
  $choice = $Option
  if (-not $choice) {
    Write-Host ''
    Write-Host '  Luma - configuracion'
    foreach ($key in $menu.Keys) { Write-Host "   $key. $($menu[$key][0])" }
    Write-Host '   0. Salir'
    $choice = Read-Host -Prompt '  Elige una opcion'
  }
  if ($choice -eq '0' -or -not $choice) { break }
  if (-not $menu.Contains($choice)) { Say 'Esa opcion no existe.'; if ($Option) { exit 1 }; continue }
  try {
    $lines = & $menu[$choice][1]
  } catch {
    $lines = @(New-LumaLine 'FALTA' "La opcion $choice se detuvo: $($_.Exception.Message)" 'Corrige lo que dice y repitela.')
  }
  Write-LumaSummary $lines
  if ($Option) { if ($lines | Where-Object { $_.State -eq 'FALTA' }) { exit 1 } else { exit 0 } }
}
