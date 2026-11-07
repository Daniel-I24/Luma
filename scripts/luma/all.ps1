# -----------------------------------------------------------------
# Opcion 8 - desplegar y verificar todo, sin preguntas: cada servicio
# con lo guardado en la carpeta de secretos y una sola tabla al final,
# leida de "secrets list" y "functions list". Si un servicio falla,
# sigue con los demas y la tabla lo muestra.
# -----------------------------------------------------------------

# Igual que scripts/doctor/expected.mjs (lo comprueba luma.test.mjs).
$script:LumaAllSecrets = @(
  'LLM_PROVIDER', 'LLM_MODEL', 'LLM_API_KEY',
  'FCM_SERVICE_ACCOUNT', 'PUSH_DISPATCH_SECRET',
  'WOMPI_ENV', 'WOMPI_PUBLIC_KEY', 'WOMPI_PRIVATE_KEY', 'WOMPI_INTEGRITY_SECRET', 'WOMPI_EVENTS_SECRET', 'PAYMENTS_CRON_SECRET', 'PAYMENT_RETURN_URL',
  'ROUTE_API_KEY', 'ROUTE_PROVIDER',
  'WHATSAPP_VERIFY_TOKEN', 'WHATSAPP_APP_SECRET', 'WHATSAPP_PHONE_NUMBER_ID'
)
# Se exige que existan, sin mirar la fecha (ALLOWED_ORIGINS la carga Pagos).
$script:LumaAllKept = @('ALLOWED_ORIGINS', 'GEOCODE_PROVIDER', 'GEOCODE_API_KEY')
$script:LumaAllFunctions = @(
  'delete-account', 'recommend', 'suggest-promotions', 'extract-menu', 'geocode', 'route', 'verify-website',
  'whatsapp-webhook', 'push-dispatch', 'create-payment', 'wompi-webhook', 'reconcile-payments', 'void-payment'
)
# Sin secretos propios: ninguna otra opcion las despliega.
$script:LumaPlainFunctions = @('delete-account', 'geocode', 'verify-website')

function Invoke-LumaAll([string]$ProjectRef) {
  $since = Get-LumaNow
  $script:LumaUnattended = $true
  $script:LumaFinalCheck = $false
  $lines = @()
  try {
    $steps = [ordered]@{
      'Luma IA' = { Invoke-LumaAi $ProjectRef }
      'Push' = { Invoke-LumaPush $ProjectRef }
      'Pagos' = { Invoke-LumaPayments $ProjectRef }
      'Rutas' = { Invoke-LumaRoutes $ProjectRef }
      'WhatsApp' = { Invoke-LumaWhatsapp $ProjectRef }
    }
    foreach ($label in $steps.Keys) {
      Say "== $label =="
      try { $lines += & $steps[$label] }
      catch { $lines += New-LumaLine 'FALTA' "$label se detuvo: $($_.Exception.Message)" 'Repite la opcion 8.' }
    }
    Say '== Funciones sin secretos propios =='
    $failed = @(Deploy-LumaFunctions $ProjectRef $script:LumaPlainFunctions)
    if ($failed.Count) { $lines += New-LumaLine 'FALTA' "No se desplego: $($failed -join ', ')" 'Lee el mensaje de arriba y repite la opcion 8.' }

    $script:LumaFinalCheck = $true
    $names = $script:LumaAllSecrets + $script:LumaAllKept
    $table = @(Test-LumaRemote $ProjectRef $names $script:LumaAllFunctions $since $script:LumaAllKept)
    $lines += New-LumaLine 'TABLA' 'Estado leido del proyecto:'
    return $lines + $table
  } finally {
    $script:LumaUnattended = $false
    $script:LumaFinalCheck = $false
  }
}
