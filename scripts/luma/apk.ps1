# -----------------------------------------------------------------
# Opcion 6 - compilar e instalar el APK. Lee app.env de la carpeta de
# secretos con todas las variables de compilacion (docs/release.md):
# SUPABASE_URL, SUPABASE_ANON_KEY, AI_MODE, PUSH_ENABLED,
# SUPPORT_WHATSAPP, LEGAL_CONTACT_EMAIL y, para firmar,
# LUMA_KEYSTORE_PATH, LUMA_KEYSTORE_PASSWORD, LUMA_KEY_ALIAS y
# LUMA_KEY_PASSWORD (sin ellas, APK de prueba). Instala con adb y
# pregunta el telefono si hay varios conectados.
# -----------------------------------------------------------------

$script:BuildNames = 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'AI_MODE', 'PUSH_ENABLED', 'SUPPORT_WHATSAPP', 'LEGAL_CONTACT_EMAIL'
$script:SigningNames = 'LUMA_KEYSTORE_PATH', 'LUMA_KEYSTORE_PASSWORD', 'LUMA_KEY_ALIAS', 'LUMA_KEY_PASSWORD'

function Invoke-LumaNpm { & npm run @args; return $LASTEXITCODE }

function Invoke-LumaAdb { return (& adb @args 2>&1) }

# Los telefonos listos de "adb devices" (numero de serie).
function Get-LumaPhones {
  $phones = @()
  foreach ($line in (Invoke-LumaAdb devices)) {
    if ([string]$line -match '^(\S+)\s+device$') { $phones += $Matches[1] }
  }
  return , $phones
}

function Select-LumaPhone([string[]]$Phones) {
  if ($Phones.Count -le 1) { return $Phones[0] }
  for ($i = 0; $i -lt $Phones.Count; $i++) { Say "$($i + 1). $($Phones[$i])" }
  $answer = Read-LumaValue "Que telefono (1 a $($Phones.Count))" '1'
  $index = 0
  if (-not [int]::TryParse($answer, [ref]$index) -or $index -lt 1 -or $index -gt $Phones.Count) { $index = 1 }
  return $Phones[$index - 1]
}

function Invoke-LumaApk {
  $app = Read-LumaEnvFile 'app.env'
  $absent = @('SUPABASE_URL', 'SUPABASE_ANON_KEY' | Where-Object { -not $app[$_] })
  if ($absent.Count) {
    return @(New-LumaLine 'FALTA' "APK: en app.env falta $($absent -join ', ')" 'Copialos de Supabase -> Project Settings -> API (docs/release.md).')
  }
  $signed = -not ($script:SigningNames | Where-Object { -not $app[$_] })
  $mode = if ($signed) { 'release' } else { 'debug' }
  $lines = @()
  if (-not $signed) { $lines += New-LumaLine 'APAGADO' 'APK: sin firma de publicacion (APK de prueba)' 'Para publicar, anade las 4 variables LUMA_KEY* a app.env.' }

  $previous = @{}
  foreach ($name in $script:BuildNames + $script:SigningNames) {
    $previous[$name] = [Environment]::GetEnvironmentVariable($name)
    [Environment]::SetEnvironmentVariable($name, $app[$name])
  }
  try { $code = Invoke-LumaNpm "apk:$mode" }
  finally { foreach ($name in $previous.Keys) { [Environment]::SetEnvironmentVariable($name, $previous[$name]) } }
  if ($code -ne 0) { return $lines + (New-LumaLine 'FALTA' 'APK: la compilacion fallo' 'Lee el mensaje de arriba; docs/android.md explica cada caso.') }
  $apk = "android\app\build\outputs\apk\$mode\app-$mode.apk"
  $lines += New-LumaLine 'OK' "APK: compilado ($apk)"

  $phones = Get-LumaPhones
  if ($phones.Count -eq 0) {
    return $lines + (New-LumaLine 'FALTA' 'APK: no hay telefono conectado' 'Conecta el telefono con depuracion USB activa y repite la opcion 6.')
  }
  $phone = Select-LumaPhone $phones
  $out = Invoke-LumaAdb -s $phone install -r $apk
  if (($out -join ' ') -match 'Success') { $lines += New-LumaLine 'OK' "APK: instalado en $phone" }
  else { $lines += New-LumaLine 'FALTA' "APK: no se pudo instalar en $phone" 'Desinstala la version anterior si se firmo con otra clave.' }
  return $lines
}
