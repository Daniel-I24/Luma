# -----------------------------------------------------------------
# Option 5 - WhatsApp (docs/whatsapp-setup.md): reads whatsapp.env
# (WHATSAPP_VERIFY_TOKEN, WHATSAPP_APP_SECRET, WHATSAPP_PHONE_NUMBER_ID),
# generates the verify token when missing, sets the secrets,
# deploys whatsapp-webhook and tests Meta's challenge.
# -----------------------------------------------------------------

$script:WhatsappNames = 'WHATSAPP_VERIFY_TOKEN', 'WHATSAPP_APP_SECRET', 'WHATSAPP_PHONE_NUMBER_ID'

function Invoke-LumaWhatsapp([string]$ProjectRef) {
  $since = Get-LumaNow
  $values = Read-LumaEnvFile 'whatsapp.env'
  if (-not $values['WHATSAPP_VERIFY_TOKEN']) { $values['WHATSAPP_VERIFY_TOKEN'] = New-LumaSecret }
  if (-not $values['WHATSAPP_APP_SECRET']) {
    $values['WHATSAPP_APP_SECRET'] = Read-LumaValue 'Clave secreta de la app de Meta (App Secret)' -Secret
  }
  if (-not $values['WHATSAPP_PHONE_NUMBER_ID']) {
    $values['WHATSAPP_PHONE_NUMBER_ID'] = Read-LumaValue 'Identificador del numero de WhatsApp (Phone number ID)'
  }
  $absent = @($script:WhatsappNames | Where-Object { -not $values[$_] })
  if ($absent.Count) {
    return @(New-LumaLine 'FALTA' "WhatsApp: falta $($absent -join ', ')" 'Copialos de developers.facebook.com (docs/whatsapp-setup.md).')
  }
  $saved = @{}
  foreach ($name in $script:WhatsappNames) { $saved[$name] = $values[$name] }
  Write-LumaEnvFile 'whatsapp.env' $saved

  if (-not (Set-LumaSecrets $ProjectRef $saved)) {
    return @(New-LumaLine 'FALTA' 'WhatsApp: no se pudieron cargar los secretos' 'Revisa "npx supabase login" y "npx supabase link".')
  }
  $failed = @(Deploy-LumaFunctions $ProjectRef @('whatsapp-webhook'))
  if ($failed.Count) { return @(New-LumaLine 'FALTA' 'WhatsApp: no se desplego whatsapp-webhook' 'Repite la opcion 5.') }
  $lines = @(Test-LumaRemote $ProjectRef $script:WhatsappNames @('whatsapp-webhook') $since)

  $url = "https://$ProjectRef.supabase.co/functions/v1/whatsapp-webhook"
  $challenge = [string](Get-Random -Minimum 100000 -Maximum 999999)
  $token = [uri]::EscapeDataString($saved['WHATSAPP_VERIFY_TOKEN'])
  $test = Invoke-LumaHttp "$url`?hub.mode=subscribe&hub.verify_token=$token&hub.challenge=$challenge"
  if ($test.Status -eq 200 -and $test.Body.Trim() -eq $challenge) {
    $lines += New-LumaLine 'OK' 'WhatsApp: el webhook responde al reto de Meta' `
      "En Meta -> WhatsApp -> Configuracion: URL $url y el token de whatsapp.env; suscribe 'messages'."
  } else {
    $lines += New-LumaLine 'FALTA' "WhatsApp: el reto respondio $($test.Status)" 'Espera un minuto (despliegue) y repite la opcion 5.'
  }
  return $lines
}
