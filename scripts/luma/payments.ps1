# -----------------------------------------------------------------
# Opcion 3 - pagos de Wompi en sandbox (docs/payments-setup.md):
#   1. lee wompi-sandbox.txt (y functions.env para lo que falte) y
#      reconoce cada llave por su prefijo (pub_test_, prv_test_,
#      test_events_, test_integrity_), sin importar el orden ni el
#      texto que las rodee. Una llave de produccion nunca se carga,
#   2. reutiliza o genera PAYMENTS_CRON_SECRET; con WEB_ORIGIN de web.env,
#      PAYMENT_RETURN_URL (Wompi solo acepta https) y ALLOWED_ORIGINS,
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

# Las llaves de prueba de los archivos; Production dice si habia de produccion.
function Find-LumaWompiKeys {
  $found = @{ Keys = @{}; Production = $false; Files = 0 }
  foreach ($name in 'wompi-sandbox.txt', 'functions.env') {
    $path = Join-Path (Get-LumaSecretsDir) $name
    if (-not (Test-Path $path)) { continue }
    $found.Files++
    $text = Get-Content $path -Raw
    if ($text -match '(pub_prod_|prv_prod_|prod_events_|prod_integrity_)') { $found.Production = $true }
    $keys = Read-LumaWompiKeys $text
    foreach ($key in $keys.Keys) { if (-not $found.Keys.ContainsKey($key)) { $found.Keys[$key] = $keys[$key] } }
  }
  return $found
}

function Get-LumaCronSecret {
  $path = Join-Path (Get-LumaSecretsDir) 'payments-settings.sql'
  if ((Test-Path $path) -and ((Get-Content $path -Raw) -match "'([0-9a-f]{64})'")) { return $Matches[1] }
  return (New-LumaSecret)
}

function Invoke-LumaPayments([string]$ProjectRef) {
  $since = Get-LumaNow
  $file = Join-Path (Get-LumaSecretsDir) 'wompi-sandbox.txt'
  $found = Find-LumaWompiKeys
  if (-not $found.Files) {
    return @(New-LumaLine 'FALTA' 'Pagos: no esta wompi-sandbox.txt' `
      "Copia las 4 llaves de sandbox del panel de Wompi en $file (en cualquier orden).")
  }
  $keys = $found.Keys
  $absent = @($script:WompiPrefixes.Keys | Where-Object { -not $keys.ContainsKey($_) })
  if ($absent.Count) {
    $names = ($absent | ForEach-Object { $script:WompiPrefixes[$_] + '...' }) -join ', '
    $why = if ($found.Production) { ' (hay llaves de PRODUCCION: no se cargan)' } else { '' }
    return @(New-LumaLine 'FALTA' "Pagos: faltan llaves de sandbox: $names$why" `
      "Wompi -> modo Sandbox -> Desarrolladores -> Llaves. Pegalas en $file; no cargues llaves *_prod_ aqui.")
  }
  $web = (Read-LumaEnvFile 'web.env')['WEB_ORIGIN']
  if ($web -notmatch '^https://[a-z0-9.-]+$' -or $web -match '^https://localhost') {
    return @(New-LumaLine 'FALTA' 'Pagos: falta el dominio web en web.env' `
      "Escribe WEB_ORIGIN=https://tu-dominio (sin / al final) en $(Join-Path (Get-LumaSecretsDir) 'web.env'). Wompi solo vuelve a una URL https.")
  }
  $lines = @(New-LumaLine 'OK' 'Pagos: las 4 llaves de sandbox encontradas')

  $cron = Get-LumaCronSecret
  $values = @{
    WOMPI_ENV = 'test'; PAYMENTS_CRON_SECRET = $cron; PAYMENT_RETURN_URL = "$web/pago-listo.html"
    ALLOWED_ORIGINS = "$web,https://localhost,http://localhost:4200"
  }
  foreach ($name in $keys.Keys) { $values[$name] = $keys[$name] }
  if (-not (Set-LumaSecrets $ProjectRef $values)) {
    return $lines + (New-LumaLine 'FALTA' 'Pagos: no se pudieron cargar los secretos' 'Revisa "npx supabase login" y "npx supabase link".')
  }
  $functions = @('create-payment', 'wompi-webhook', 'reconcile-payments', 'void-payment')
  $failed = @(Deploy-LumaFunctions $ProjectRef $functions)
  if ($failed.Count) { return $lines + (New-LumaLine 'FALTA' "Pagos: no se desplego $($failed -join ', ')" 'Repite la opcion 3.') }
  $lines += Test-LumaRemote $ProjectRef @($values.Keys | Sort-Object) $functions $since

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
