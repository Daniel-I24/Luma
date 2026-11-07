# -----------------------------------------------------------------
# remote.ps1 - lo que cambia el proyecto de Supabase, y la prueba de
# que cambio. Una opcion solo dice OK si "secrets list" y "functions
# list" lo confirman: el codigo de salida no basta (ver Invoke-Supabase).
# Nunca imprime un secreto.
# -----------------------------------------------------------------

# Version fija: la 4 quita opciones y "npx supabase" sin version cambia sola.
$script:SupabaseCli = 'supabase@3.0.0'
$script:LumaUnchanged = @()
$script:LumaLoaded = @{}

function Get-LumaNow { return [DateTimeOffset]::UtcNow }

# npx.cmd, nunca npx: npx.ps1 relee el TEXTO de la linea que lo llama, asi
# que "@args" no llega a la CLI, que muestra la ayuda y sale con 0. Asi las
# opciones decian OK sin hacer nada.
function Invoke-Supabase {
  # Continue: en PowerShell 5.1, 2>&1 de un programa con Stop corta el script.
  $ErrorActionPreference = 'Continue'
  $out = @(& npx.cmd --yes $script:SupabaseCli @args 2>&1 | ForEach-Object { [string]$_ })
  $code = [int]$LASTEXITCODE
  $script:LumaCliOutput = $out -join "`n"
  if ($code -ne 0) { $out | Select-Object -Last 5 | ForEach-Object { Say "  $_" } }
  return $code
}

# Solo la salida estandar, en JSON; $null si el comando falla.
function Invoke-SupabaseJson {
  $ErrorActionPreference = 'Continue'
  $text = (& npx.cmd --yes $script:SupabaseCli @args --output json 2>$null) -join "`n"
  if ([int]$LASTEXITCODE -ne 0) { return $null }
  try { return (ConvertFrom-Json $text) } catch { return $null }
}

# Carga secretos desde un archivo temporal que siempre se borra.
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

# Se detiene en la primera que falla: devuelve las que no quedaron.
function Deploy-LumaFunctions([string]$ProjectRef, [string[]]$Names) {
  for ($i = 0; $i -lt $Names.Count; $i++) {
    Say "Desplegando $($Names[$i])..."
    $code = Invoke-Supabase functions deploy $Names[$i] --use-api "--remote=$ProjectRef" --yes
    if ($code -ne 0) { return @($Names[$i..($Names.Count - 1)]) }
    # Mismo codigo que el desplegado: la CLI no sube nada y la fecha no cambia.
    if ($script:LumaCliOutput -match 'No change found') { $script:LumaUnchanged += $Names[$i] }
  }
  return @()
}

function Get-LumaDigest([string]$Value) {
  $hash = [Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($Value))
  return (-join ($hash | ForEach-Object { $_.ToString('x2') }))
}

function Format-LumaDate([DateTimeOffset]$When) { return $When.ToLocalTime().ToString('yyyy-MM-dd HH:mm') }

# Lo que hay de verdad en el proyecto; $null si no se pudo leer.
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

# Una linea por secreto y funcion. $Keep: se exigen, pero esta opcion no los carga.
function Test-LumaRemote([string]$ProjectRef, [string[]]$Secrets, [string[]]$Functions, [DateTimeOffset]$Since, [string[]]$Keep = @()) {
  # En la opcion 8 hay una sola tabla, al final.
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
