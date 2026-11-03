# -----------------------------------------------------------------
# Opcion 3 - pagos de Wompi en sandbox (docs/payments-setup.md):
#   1. lee wompi-sandbox.txt y reconoce cada llave por su prefijo
#      (pub_test_, prv_test_, test_events_, test_integrity_), sin
#      importar el orden ni el texto que las rodee,
#   2. reutiliza o genera PAYMENTS_CRON_SECRET,
#   3. carga los secretos WOMPI_* y despliega las 4 funciones,
#   4. escribe payments-settings.sql para pegar en el SQL Editor.
# Los pagos en linea siguen APAGADOS hasta que el equipo los encienda.
# -----------------------------------------------------------------

$script:WompiPrefixes = [ordered]@{
  WOMPI_PUBLIC_KEY       = 'pub_test_'
  WOMPI_PRIVATE_KEY      = 'prv_test_'
  WOMPI_EVENTS_SECRET    = 'test_events_'
  WOMPI_INTEGRITY_SECRET = 'test_integrity_'
}

# Cada llave del texto por su prefijo; las que no estan quedan fuera.
function Read-LumaWompiKeys([string]$Text) {
  $keys = @{}
  foreach ($name in $script:WompiPrefixes.Keys) {
    $prefix = $script:WompiPrefixes[$name]
    if ($Text -match "(?<![A-Za-z0-9_])($prefix[A-Za-z0-9_]+)") { $keys[$name] = $Matches[1] }
  }
  return $keys
}

function Get-LumaCronSecret {
  $path = Join-Path (Get-LumaSecretsDir) 'payments-settings.sql'
  if ((Test-Path $path) -and ((Get-Content $path -Raw) -match "'([0-9a-f]{64})'")) { return $Matches[1] }
  return (New-LumaSecret)
}

function Invoke-LumaPayments([string]$ProjectRef) {
  $file = Join-Path (Get-LumaSecretsDir) 'wompi-sandbox.txt'
  if (-not (Test-Path $file)) {
    return @(New-LumaLine 'FALTA' 'Pagos: no esta wompi-sandbox.txt' `
      "Copia las 4 llaves de sandbox del panel de Wompi en $file (en cualquier orden).")
  }
  $keys = Read-LumaWompiKeys (Get-Content $file -Raw)
  $absent = @($script:WompiPrefixes.Keys | Where-Object { -not $keys.ContainsKey($_) })
  if ($absent.Count) {
    $names = ($absent | ForEach-Object { $script:WompiPrefixes[$_] + '...' }) -join ', '
    return @(New-LumaLine 'FALTA' "Pagos: en wompi-sandbox.txt falta $names" 'Copialas del panel de Wompi (Desarrolladores -> Llaves).')
  }
  $lines = @(New-LumaLine 'OK' 'Pagos: las 4 llaves de sandbox estan en wompi-sandbox.txt')

  $cron = Get-LumaCronSecret
  $values = @{ WOMPI_ENV = 'test'; PAYMENTS_CRON_SECRET = $cron }
  foreach ($name in $keys.Keys) { $values[$name] = $keys[$name] }
  if (-not (Set-LumaSecrets $ProjectRef $values)) {
    return $lines + (New-LumaLine 'FALTA' 'Pagos: no se pudieron cargar los secretos' 'Revisa "npx supabase login" y "npx supabase link".')
  }
  $lines += New-LumaLine 'OK' 'Pagos: secretos WOMPI_* y PAYMENTS_CRON_SECRET cargados'

  $failed = Deploy-LumaFunctions $ProjectRef @('create-payment', 'wompi-webhook', 'reconcile-payments', 'void-payment')
  if ($failed.Count) { $lines += New-LumaLine 'FALTA' "Pagos: no se desplego $($failed -join ', ')" 'Repite la opcion 3.' }
  else { $lines += New-LumaLine 'OK' 'Pagos: las 4 funciones de pago desplegadas' }

  $base = "https://$ProjectRef.supabase.co/functions/v1"
  $sql = @"
-- Pegar en Supabase -> SQL Editor (docs/payments-setup.md).
-- Contiene el secreto del cron: no lo copies al repositorio.
insert into private.payments_cron (function_url, secret)
values ('$base/reconcile-payments', '$cron')
on conflict (id) do update
  set function_url = excluded.function_url,
      secret = excluded.secret;

-- Encender los pagos en linea (sandbox) cuando hayas probado todo:
-- update public.app_settings set int_value = 1 where key = 'payments_enabled';
"@
  Write-LumaFile 'payments-settings.sql' $sql
  $lines += New-LumaLine 'OK' 'Pagos: payments-settings.sql escrito en la carpeta de secretos' 'Pegalo en el SQL Editor.'
  $lines += New-LumaLine 'APAGADO' 'Pagos en linea: siguen apagados hasta que los enciendas' `
    "En Wompi (sandbox) pon la URL de eventos $base/wompi-webhook; prueba y luego quita el -- de la ultima linea del SQL."
  return $lines
}
