# -----------------------------------------------------------------
# Option 2 - push notifications (docs/push-setup.md):
#   1. reads firebase-service-account.json from the secrets folder,
#   2. reuses the push-dispatch secret (or generates one),
#   3. sets FCM_SERVICE_ACCOUNT and PUSH_DISPATCH_SECRET,
#   4. deploys push-dispatch,
#   5. writes push-settings.sql to paste in the SQL Editor.
# -----------------------------------------------------------------

# The secret already written in push-settings.sql: repeating does not break what was pasted.
function Get-LumaPushSecret {
  $path = Join-Path (Get-LumaSecretsDir) 'push-settings.sql'
  if ((Test-Path $path) -and ((Get-Content $path -Raw) -match "'([0-9a-f]{64})'")) { return $Matches[1] }
  return (New-LumaSecret)
}

function Invoke-LumaPush([string]$ProjectRef) {
  $since = Get-LumaNow
  $account = Join-Path (Get-LumaSecretsDir) 'firebase-service-account.json'
  if (-not (Test-Path $account)) {
    return @(New-LumaLine 'FALTA' 'Push: no esta firebase-service-account.json' `
      "Descargalo de Firebase (docs/push-setup.md, paso 2) y guardalo en $(Get-LumaSecretsDir).")
  }
  try { $json = Get-Content $account -Raw | ConvertFrom-Json }
  catch { return @(New-LumaLine 'FALTA' 'Push: el archivo de Firebase no es un JSON valido' 'Descargalo otra vez.') }
  foreach ($name in 'project_id', 'client_email', 'private_key') {
    if (-not $json.$name) { return @(New-LumaLine 'FALTA' "Push: al JSON le falta $name" 'Descarga la cuenta de servicio otra vez.') }
  }
  if ($json.type -ne 'service_account') {
    return @(New-LumaLine 'FALTA' 'Push: el JSON no es una cuenta de servicio' 'Descarga "Cuenta de servicio" en Firebase.')
  }
  $lines = @(New-LumaLine 'OK' "Push: cuenta de servicio del proyecto $($json.project_id)")

  $secret = Get-LumaPushSecret
  $oneLine = ($json | ConvertTo-Json -Compress -Depth 5)
  if (-not (Set-LumaSecrets $ProjectRef @{ FCM_SERVICE_ACCOUNT = $oneLine; PUSH_DISPATCH_SECRET = $secret })) {
    return $lines + (New-LumaLine 'FALTA' 'Push: no se pudieron cargar los secretos' 'Revisa "npx supabase login" y "npx supabase link".')
  }
  $failed = @(Deploy-LumaFunctions $ProjectRef @('push-dispatch'))
  if ($failed.Count) { return $lines + (New-LumaLine 'FALTA' 'Push: no se desplego push-dispatch' 'Repite la opcion 2.') }
  $lines += Test-LumaRemote $ProjectRef @('FCM_SERVICE_ACCOUNT', 'PUSH_DISPATCH_SECRET') @('push-dispatch') $since

  $url = "https://$ProjectRef.supabase.co/functions/v1/push-dispatch"
  $sql = @"
-- Pegar en Supabase -> SQL Editor (docs/push-setup.md, paso 4).
-- Contiene el secreto: no lo copies al repositorio.
insert into private.push_settings (function_url, secret)
values ('$url', '$secret')
on conflict (id) do update
  set function_url = excluded.function_url,
      secret = excluded.secret;
"@
  Write-LumaFile 'push-settings.sql' $sql
  $lines += New-LumaLine 'OK' 'Push: push-settings.sql escrito en la carpeta de secretos' `
    'Pegalo en el SQL Editor (una vez basta si el secreto no cambio) y activa pg_net y pg_cron.'
  $gs = Join-Path (Get-Location) 'android/app/google-services.json'
  if (Test-Path $gs) { $lines += New-LumaLine 'OK' 'Push: android\app\google-services.json listo para el APK' }
  else { $lines += New-LumaLine 'FALTA' 'Push: falta android\app\google-services.json' 'Descargalo de Firebase (app Android) y copialo ahi; luego opcion 6.' }
  return $lines
}
