# -----------------------------------------------------------------
# common.ps1 - piezas compartidas por scripts\luma.ps1 y sus
# opciones. Todo lo que habla con fuera (la CLI de Supabase, la web,
# las preguntas) pasa por una funcion que las pruebas reemplazan.
# Nunca imprime un secreto.
# -----------------------------------------------------------------

function Get-LumaSecretsDir {
  if ($env:LUMA_SECRETS_DIR) { return $env:LUMA_SECRETS_DIR }
  return (Join-Path $env:USERPROFILE 'luma-secrets')
}

function Say([string]$Text) { Write-Host "  $Text" }

# Una pregunta; con -Secret no se ve lo que se escribe. Enter deja
# el valor actual (que nunca se muestra si es secreto).
function Read-LumaValue([string]$Prompt, [string]$Current = '', [switch]$Secret) {
  if ($script:LumaUnattended) { return $Current }
  $hint = ''
  if ($Current) { $hint = if ($Secret) { ' (Enter = la guardada)' } else { " (Enter = $Current)" } }
  if ($Secret) {
    $secure = Read-Host -Prompt "$Prompt$hint" -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { $value = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
  } else {
    $value = Read-Host -Prompt "$Prompt$hint"
  }
  if ([string]::IsNullOrWhiteSpace($value)) { return $Current }
  return $value.Trim()
}

# Una peticion web: @{ Status; Body }. Nunca lanza.
function Invoke-LumaHttp([string]$Uri, [hashtable]$Headers = @{}, [string]$Method = 'GET', [string]$Body = '') {
  try {
    $request = @{ Uri = $Uri; Headers = $Headers; Method = $Method; UseBasicParsing = $true; TimeoutSec = 20 }
    if ($Body) { $request['Body'] = [Text.Encoding]::UTF8.GetBytes($Body); $request['ContentType'] = 'application/json' }
    $r = Invoke-WebRequest @request
    return @{ Status = [int]$r.StatusCode; Body = [string]$r.Content }
  } catch {
    $status = 0
    if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
    return @{ Status = $status; Body = '' }
  }
}

# El proyecto: el de "npx supabase link" o el que se escriba.
function Get-LumaProjectRef {
  if ($env:SUPABASE_PROJECT_REF) { return $env:SUPABASE_PROJECT_REF }
  $file = Join-Path (Get-Location) 'supabase\.temp\project-ref'
  if (Test-Path $file) { return (Get-Content $file -Raw).Trim() }
  return (Read-LumaValue 'Referencia del proyecto de Supabase (20 letras)')
}

# El proyecto que se va a cambiar, siempre a la vista antes de hacerlo.
function Get-LumaTarget {
  $ref = Get-LumaProjectRef
  if ($ref -notmatch '^[a-z0-9]{20}$') { throw 'Falta el proyecto: ejecuta "npx supabase link" en la carpeta del repo.' }
  Say "Proyecto destino: $ref"
  return $ref
}

# 32 bytes al azar en hexadecimal.
function New-LumaSecret {
  $bytes = New-Object byte[] 32
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  return (-join ($bytes | ForEach-Object { $_.ToString('x2') }))
}

# Lineas NOMBRE=valor de un archivo de la carpeta de secretos.
function Read-LumaEnvFile([string]$Name) {
  $values = @{}
  $path = Join-Path (Get-LumaSecretsDir) $Name
  if (-not (Test-Path $path)) { return $values }
  foreach ($line in Get-Content $path) {
    if ($line -match '^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$') {
      $values[$Matches[1]] = $Matches[2] -replace "^(['""])(.*)\1$", '$2'
    }
  }
  return $values
}

function Write-LumaFile([string]$Name, [string]$Text) {
  $dir = Get-LumaSecretsDir
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
  $utf8 = New-Object Text.UTF8Encoding $false
  [IO.File]::WriteAllText((Join-Path $dir $Name), $Text, $utf8)
}

function Write-LumaEnvFile([string]$Name, [hashtable]$Values) {
  $lines = $Values.Keys | Sort-Object | ForEach-Object { "$_=$($Values[$_])" }
  Write-LumaFile $Name (($lines -join "`n") + "`n")
}

# Una linea del resumen: OK, FALTA o APAGADO, con el siguiente paso.
function New-LumaLine([string]$State, [string]$Item, [string]$Next = '') {
  return [pscustomobject]@{ State = $State; Item = $Item; Next = $Next }
}

function Write-LumaSummary([object[]]$Lines) {
  Write-Host ''
  Write-Host '  Resumen'
  foreach ($line in $Lines) {
    $color = switch ($line.State) { 'OK' { 'Green' } 'FALTA' { 'Red' } 'TABLA' { 'White' } default { 'Yellow' } }
    Write-Host ('  {0,-8}{1}' -f $line.State, $line.Item) -ForegroundColor $color
    if ($line.Next) { Write-Host "          -> $($line.Next)" }
  }
}
