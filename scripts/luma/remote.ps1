# -----------------------------------------------------------------
# remote.ps1 - what changes the Supabase project, and the proof that
# it changed. An option only says OK when "secrets list" and "functions
# list" confirm it: the exit code is not enough (see Invoke-Supabase).
# Never prints a secret.
# -----------------------------------------------------------------

# Pinned version: 4 removes options, and "npx supabase" without a version changes by itself.
$script:SupabaseCli = 'supabase@3.0.0'
$script:LumaUnchanged = @()
$script:LumaLoaded = @{}

function Get-LumaNow { return [DateTimeOffset]::UtcNow }

# npx.cmd, never npx: npx.ps1 re-reads the TEXT of the calling line, so
# "@args" never reaches the CLI, which shows its help and exits with 0. That is how
# the options said OK without doing anything.
function Invoke-Supabase {
  # Continue: in PowerShell 5.1, 2>&1 of a program under Stop ends the script.
  $ErrorActionPreference = 'Continue'
  $out = @(& npx.cmd --yes $script:SupabaseCli @args 2>&1 | ForEach-Object { [string]$_ })
  $code = [int]$LASTEXITCODE
  $script:LumaCliOutput = $out -join "`n"
  if ($code -ne 0) { $out | Select-Object -Last 5 | ForEach-Object { Say "  $_" } }
  return $code
}

# Standard output only, as JSON; $null when the command fails.
function Invoke-SupabaseJson {
  $ErrorActionPreference = 'Continue'
  $text = (& npx.cmd --yes $script:SupabaseCli @args --output json 2>$null) -join "`n"
  if ([int]$LASTEXITCODE -ne 0) { return $null }
  try { return (ConvertFrom-Json $text) } catch { return $null }
}

# Sets secrets from a temporary file that is always deleted.
function Set-LumaSecrets([string]$ProjectRef, [hashtable]$Values) {
  $utf8 = New-Object Text.UTF8Encoding $false
  $temp = Join-Path $env:TEMP ('luma-' + [guid]::NewGuid() + '.env')
  try {
    $lines = foreach ($name in ($Values.Keys | Sort-Object)) {
      $value = [string]$Values[$name]
      if ($value.Contains("'")) { throw "El valor de $name tiene comillas simples." }
      "$name='$value'"
    }
    [IO.File]::WriteAllText($temp, ($lines -join "`n"), $utf8)
    $code = Invoke-Supabase secrets set --env-file $temp "--remote=$ProjectRef" --yes
    if ($code -ne 0) { return $false }
    foreach ($name in $Values.Keys) { $script:LumaLoaded[$name] = Get-LumaDigest ([string]$Values[$name]) }
    return $true
  } finally {
    if (Test-Path $temp) { Remove-Item $temp -Force }
  }
}

# Stops at the first failure: returns the ones left undeployed.
function Deploy-LumaFunctions([string]$ProjectRef, [string[]]$Names) {
  for ($i = 0; $i -lt $Names.Count; $i++) {
    Say "Desplegando $($Names[$i])..."
    $code = Invoke-Supabase functions deploy $Names[$i] --use-api "--remote=$ProjectRef" --yes
    if ($code -ne 0) { return @($Names[$i..($Names.Count - 1)]) }
    # Same code as deployed: the CLI uploads nothing and the date does not change.
    if ($script:LumaCliOutput -match 'No change found') { $script:LumaUnchanged += $Names[$i] }
  }
  return @()
}

function Get-LumaDigest([string]$Value) {
  $hash = [Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($Value))
  return (-join ($hash | ForEach-Object { $_.ToString('x2') }))
}

function Format-LumaDate([DateTimeOffset]$When) { return $When.ToLocalTime().ToString('yyyy-MM-dd HH:mm') }

# What the project really has; $null when it could not be read.
function Get-LumaRemoteState([string]$ProjectRef) {
  $secrets = Invoke-SupabaseJson secrets list "--remote=$ProjectRef"
  $functions = Invoke-SupabaseJson functions list "--remote=$ProjectRef"
  if ($null -eq $secrets -or $null -eq $functions) { return $null }
  if ($functions.PSObject.Properties['functions']) { $functions = $functions.functions }
  $state = @{ Secrets = @{}; Functions = @{} }
  foreach ($s in @($secrets)) {
    $when = [DateTimeOffset]::MinValue
    if ($s.PSObject.Properties['updated_at'] -and $s.updated_at) { $when = [DateTimeOffset]::Parse([string]$s.updated_at) }
    $state.Secrets[[string]$s.name] = @{ Updated = $when; Digest = [string]$s.value }
  }
  foreach ($f in @($functions)) {
    $state.Functions[[string]$f.slug] = @{ Updated = [DateTimeOffset]::FromUnixTimeMilliseconds([long]$f.updated_at); Status = [string]$f.status }
  }
  return $state
}

# One line per secret and function. $Keep: required, but this option does not set them.
function Test-LumaRemote([string]$ProjectRef, [string[]]$Secrets, [string[]]$Functions, [DateTimeOffset]$Since, [string[]]$Keep = @()) {
  # Option 8 has a single table, at the end.
  if ($script:LumaUnattended -and -not $script:LumaFinalCheck) { return @() }
  $state = Get-LumaRemoteState $ProjectRef
  if (-not $state) {
    return @(New-LumaLine 'FALTA' 'No pude leer el proyecto para comprobarlo' 'Revisa "npx supabase login" y vuelve a esta opcion.')
  }
  $limit = $Since.AddMinutes(-2)
  $lines = @()
  foreach ($name in $Secrets) {
    $found = $state.Secrets[$name]
    if (-not $found) { $lines += New-LumaLine 'FALTA' ('Secreto {0,-26} NO EXISTE' -f $name) 'Repite esta opcion y lee el mensaje de arriba.'; continue }
    $date = Format-LumaDate $found.Updated
    if ($Keep -contains $name) { $lines += New-LumaLine 'OK' ('Secreto {0,-26} existe ({1})' -f $name, $date) }
    elseif ($found.Updated -ge $limit) { $lines += New-LumaLine 'OK' ('Secreto {0,-26} cargado {1}' -f $name, $date) }
    elseif ($script:LumaLoaded[$name] -and $script:LumaLoaded[$name] -eq $found.Digest) { $lines += New-LumaLine 'OK' ('Secreto {0,-26} sin cambios desde {1}' -f $name, $date) }
    else { $lines += New-LumaLine 'FALTA' ('Secreto {0,-26} sigue con fecha {1}' -f $name, $date) 'No se cargo: repite esta opcion.' }
  }
  foreach ($name in $Functions) {
    $found = $state.Functions[$name]
    if (-not $found) { $lines += New-LumaLine 'FALTA' ('Funcion {0,-26} NO EXISTE' -f $name) 'Repite esta opcion y lee el mensaje de arriba.'; continue }
    $date = Format-LumaDate $found.Updated
    if ($found.Status -ne 'ACTIVE') { $lines += New-LumaLine 'FALTA' ('Funcion {0,-26} en estado {1}' -f $name, $found.Status) 'Repite esta opcion.' }
    elseif ($found.Updated -ge $limit) { $lines += New-LumaLine 'OK' ('Funcion {0,-26} desplegada {1}' -f $name, $date) }
    elseif ($script:LumaUnchanged -contains $name) { $lines += New-LumaLine 'OK' ('Funcion {0,-26} sin cambios desde {1}' -f $name, $date) }
    else { $lines += New-LumaLine 'FALTA' ('Funcion {0,-26} sigue con fecha {1}' -f $name, $date) 'No se desplego: repite esta opcion.' }
  }
  return $lines
}
