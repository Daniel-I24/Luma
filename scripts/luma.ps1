# -----------------------------------------------------------------
# luma.ps1 - configurar Luma sin pegar comandos largos.
# Uso (PowerShell, en la carpeta del repo):
#   powershell -ExecutionPolicy Bypass -File scripts\luma.ps1
# Antes, una vez: "npx supabase login" y "npx supabase link".
# Los secretos viven en %USERPROFILE%\luma-secrets (fuera del repo);
# ninguno se muestra. Cada opcion se puede repetir.
# -----------------------------------------------------------------
param([string]$Option = '')
$ErrorActionPreference = 'Stop'
foreach ($part in 'common', 'ai', 'push', 'payments', 'routes', 'whatsapp', 'apk', 'doctor') {
  . (Join-Path $PSScriptRoot "luma\$part.ps1")
}

$menu = [ordered]@{
  '1' = @('Luma IA (clave, modelo y respaldo de Gemini)', { Invoke-LumaAi (Get-LumaProjectRef) })
  '2' = @('Notificaciones push', { Invoke-LumaPush (Get-LumaProjectRef) })
  '3' = @('Pagos de Wompi en sandbox', { Invoke-LumaPayments (Get-LumaProjectRef) })
  '4' = @('Rutas (OpenRouteService)', { Invoke-LumaRoutes (Get-LumaProjectRef) })
  '5' = @('WhatsApp (verificacion de contactos)', { Invoke-LumaWhatsapp (Get-LumaProjectRef) })
  '6' = @('Compilar e instalar el APK', { Invoke-LumaApk })
  '7' = @('Diagnostico (npm run doctor)', { Invoke-LumaDoctor })
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
