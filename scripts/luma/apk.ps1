# -----------------------------------------------------------------
# Opcion 6 - compilar e instalar el APK. Lee app.env de la carpeta de
# secretos con todas las variables de compilacion (docs/release.md):
# SUPABASE_URL, SUPABASE_ANON_KEY, AI_MODE, PUSH_ENABLED,
# SUPPORT_WHATSAPP, LEGAL_CONTACT_EMAIL y, para firmar,
# LUMA_KEYSTORE_PATH, LUMA_KEYSTORE_PASSWORD, LUMA_KEY_ALIAS y
# LUMA_KEY_PASSWORD (sin ellas, APK de prueba). Si app.env no existe
# lo crea: pregunta SUPABASE_ANON_KEY, AI_MODE=remote si hay ai.env y
# PUSH_ENABLED=1 si hay google-services.json. Instala con adb (PATH,
# ANDROID_HOME o el SDK de Android Studio) y pregunta el telefono si
# hay varios conectados.
# -----------------------------------------------------------------

$script:BuildNames = 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'AI_MODE', 'PUSH_ENABLED', 'SUPPORT_WHATSAPP', 'LEGAL_CONTACT_EMAIL'
$script:SigningNames = 'LUMA_KEYSTORE_PATH', 'LUMA_KEYSTORE_PASSWORD', 'LUMA_KEY_ALIAS', 'LUMA_KEY_PASSWORD'

# La salida de npm va a la pantalla; devuelve solo el codigo (un entero).
function Invoke-LumaNpm {
  & npm run @args | Out-Host
  return [int]$LASTEXITCODE
}

# adb: en el PATH, en ANDROID_HOME o en el SDK de Android Studio.
function Find-LumaAdb {
  $command = Get-Command adb -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }
  foreach ($root in @($env:ANDROID_HOME, $(if ($env:LOCALAPPDATA) { Join-Path $env:LOCALAPPDATA 'Android\Sdk' }))) {
    if (-not $root) { continue }
    $path = Join-Path $root 'platform-tools\adb.exe'
    if (Test-Path $path) { return $path }
  }
  return $null
}

function Invoke-LumaAdb {
  $adb = Find-LumaAdb
  if (-not $adb) { return @('LUMA_NO_ADB') }
  $ErrorActionPreference = 'Continue'
  return @(& $adb @args 2>&1 | ForEach-Object { [string]$_ })
}

# "adb devices": los telefonos listos y los que esperan autorizacion.
function Get-LumaPhones {
  $phones = @(); $waiting = @(); $missing = $false
  foreach ($line in (Invoke-LumaAdb devices)) {
    if ([string]$line -eq 'LUMA_NO_ADB') { $missing = $true }
    elseif ([string]$line -match '^(\S+)\s+device$') { $phones += $Matches[1] }
    elseif ([string]$line -match '^(\S+)\s+unauthorized$') { $waiting += $Matches[1] }
  }
  return @{ Ready = $phones; Unauthorized = $waiting; NoAdb = $missing }
}

# app.env nuevo: la URL del proyecto, la clave publica y lo que ya esta configurado.
function New-LumaAppEnv {
  $ref = Get-LumaProjectRef
  $anon = Read-LumaValue 'SUPABASE_ANON_KEY (Supabase -> Project Settings -> API -> anon public)'
  $values = @{ SUPABASE_URL = "https://$ref.supabase.co"; SUPABASE_ANON_KEY = $anon }
  if (Test-Path (Join-Path (Get-LumaSecretsDir) 'ai.env')) { $values['AI_MODE'] = 'remote' }
  $google = @((Join-Path (Get-LumaSecretsDir) 'google-services.json'), 'android\app\google-services.json')
  if ($google | Where-Object { Test-Path $_ }) { $values['PUSH_ENABLED'] = '1' }
  Write-LumaEnvFile 'app.env' $values
  return (New-LumaLine 'OK' 'APK: app.env creado en la carpeta de secretos' 'Anade alli SUPPORT_WHATSAPP, LEGAL_CONTACT_EMAIL o la firma si las necesitas.')
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
  $created = @()
  if (-not (Test-Path (Join-Path (Get-LumaSecretsDir) 'app.env'))) { $created = @(New-LumaAppEnv) }
  $app = Read-LumaEnvFile 'app.env'
  $absent = @('SUPABASE_URL', 'SUPABASE_ANON_KEY' | Where-Object { -not $app[$_] })
  if ($absent.Count) {
    return $created + @(New-LumaLine 'FALTA' "APK: en app.env falta $($absent -join ', ')" 'Copialos de Supabase -> Project Settings -> API (docs/release.md).')
  }
  $signed = -not ($script:SigningNames | Where-Object { -not $app[$_] })
  $mode = if ($signed) { 'release' } else { 'debug' }
  $lines = $created
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

  $found = Get-LumaPhones
  $phones = @($found.Ready)
  if ($found.NoAdb) {
    return $lines + (New-LumaLine 'FALTA' 'APK: no se encontro adb' 'Instala Android Studio (Platform Tools) o anade adb al PATH; tambien sirve ANDROID_HOME.')
  }
  if ($phones.Count -eq 0 -and $found.Unauthorized.Count) {
    return $lines + (New-LumaLine 'FALTA' "APK: el telefono $($found.Unauthorized[0]) no autorizo esta computadora" 'Desbloquealo, acepta "Permitir depuracion USB" (marca "Permitir siempre") y repite la opcion 6.')
  }
  if ($phones.Count -eq 0) {
    return $lines + (New-LumaLine 'FALTA' 'APK: no hay telefono conectado' 'Conecta el telefono con depuracion USB activa y repite la opcion 6.')
  }
  $phone = Select-LumaPhone $phones
  $out = Invoke-LumaAdb -s $phone install -r $apk
  if (($out -join ' ') -match 'Success') { $lines += New-LumaLine 'OK' "APK: instalado en $phone" }
  else { $lines += New-LumaLine 'FALTA' "APK: no se pudo instalar en $phone" 'Desinstala la version anterior si se firmo con otra clave.' }
  return $lines
}
