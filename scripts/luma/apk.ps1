# -----------------------------------------------------------------
# Option 6 - build and install the APK. Reads app.env from the secrets
# folder with every build variable (docs/release.md):
# SUPABASE_URL, SUPABASE_ANON_KEY, AI_MODE, PUSH_ENABLED,
# SUPPORT_WHATSAPP, LEGAL_CONTACT_EMAIL and, to sign,
# LUMA_KEYSTORE_PATH, LUMA_KEYSTORE_PASSWORD, LUMA_KEY_ALIAS and
# LUMA_KEY_PASSWORD (without them, a debug APK). When app.env is missing
# it creates it: asks for SUPABASE_ANON_KEY, AI_MODE=remote when ai.env exists and
# PUSH_ENABLED=1 when google-services.json exists. Installs with adb (PATH,
# ANDROID_HOME or the Android Studio SDK) and asks which phone when
# several are connected.
# -----------------------------------------------------------------

$script:BuildNames = 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'AI_MODE', 'PUSH_ENABLED', 'SUPPORT_WHATSAPP', 'LEGAL_CONTACT_EMAIL'
$script:SigningNames = 'LUMA_KEYSTORE_PATH', 'LUMA_KEYSTORE_PASSWORD', 'LUMA_KEY_ALIAS', 'LUMA_KEY_PASSWORD'

# npm's output goes to the screen; returns only the exit code (an integer).
# npm.cmd, never npm: npm.ps1 re-reads the text of this line and "@args" is lost
# (it listed the scripts and exited with 0, without building).
function Invoke-LumaNpm {
  & npm.cmd run @args | Out-Host
  return [int]$LASTEXITCODE
}

# This build's APK, not one that was already there.
function Test-LumaApkFresh([string]$Path, [DateTime]$Since) {
  return (Test-Path $Path) -and ((Get-Item $Path).LastWriteTime -ge $Since.AddMinutes(-1))
}

# adb: in the PATH, in ANDROID_HOME or in the Android Studio SDK (Windows or Linux).
function Find-LumaAdb {
  $command = Get-Command adb -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }
  # Android Studio: LOCALAPPDATA on Windows, ~/Android/Sdk on Linux.
  $local = if ($env:LOCALAPPDATA) { Join-Path $env:LOCALAPPDATA 'Android/Sdk' }
  $linux = if ($env:OS -ne 'Windows_NT') { Join-Path $HOME 'Android/Sdk' }
  foreach ($root in @($env:ANDROID_HOME, $local, $linux)) {
    if (-not $root) { continue }
    foreach ($name in 'adb.exe', 'adb') {
      $path = Join-Path $root "platform-tools/$name"
      if (Test-Path $path) { return $path }
    }
  }
  return $null
}

function Invoke-LumaAdb {
  $adb = Find-LumaAdb
  if (-not $adb) { return @('LUMA_NO_ADB') }
  $ErrorActionPreference = 'Continue'
  return @(& $adb @args 2>&1 | ForEach-Object { [string]$_ })
}

# "adb devices": the phones that are ready and those waiting for authorisation.
function Get-LumaPhones {
  $phones = @(); $waiting = @(); $missing = $false
  foreach ($line in (Invoke-LumaAdb devices)) {
    if ([string]$line -eq 'LUMA_NO_ADB') { $missing = $true }
    elseif ([string]$line -match '^(\S+)\s+device$') { $phones += $Matches[1] }
    elseif ([string]$line -match '^(\S+)\s+unauthorized$') { $waiting += $Matches[1] }
  }
  return @{ Ready = $phones; Unauthorized = $waiting; NoAdb = $missing }
}

# A new app.env: the project URL, the public key and what is already set up.
function New-LumaAppEnv {
  $ref = Get-LumaProjectRef
  $anon = Read-LumaValue 'SUPABASE_ANON_KEY (Supabase -> Project Settings -> API -> anon public)'
  $values = @{ SUPABASE_URL = "https://$ref.supabase.co"; SUPABASE_ANON_KEY = $anon }
  if (Test-Path (Join-Path (Get-LumaSecretsDir) 'ai.env')) { $values['AI_MODE'] = 'remote' }
  $google = @((Join-Path (Get-LumaSecretsDir) 'google-services.json'), 'android/app/google-services.json')
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
  $started = Get-Date
  try { $code = Invoke-LumaNpm "apk:$mode" }
  finally { foreach ($name in $previous.Keys) { [Environment]::SetEnvironmentVariable($name, $previous[$name]) } }
  if ($code -ne 0) { return $lines + (New-LumaLine 'FALTA' 'APK: la compilacion fallo' 'Lee el mensaje de arriba; docs/android.md explica cada caso.') }
  $apk = "android/app/build/outputs/apk/$mode/app-$mode.apk"
  if (-not (Test-LumaApkFresh $apk $started)) {
    return $lines + (New-LumaLine 'FALTA' "APK: la compilacion no dejo un archivo nuevo en $apk" 'Lee el mensaje de arriba y repite la opcion 6.')
  }
  $lines += New-LumaLine 'OK' "APK: compilado $(Get-Date -Format 'yyyy-MM-dd HH:mm') ($apk)"

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
