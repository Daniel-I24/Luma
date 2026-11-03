# -----------------------------------------------------------------
# setup-push.ps1 - lo local de docs/push-setup.md, sin mostrar
# ningun secreto:
#   1. lee la cuenta de servicio de Firebase (fuera del repo),
#   2. genera el secreto compartido de push-dispatch,
#   3. carga FCM_SERVICE_ACCOUNT y PUSH_DISPATCH_SECRET con
#      "supabase secrets set" desde un archivo temporal que borra,
#   4. despliega push-dispatch,
#   5. escribe push-settings.sql (fuera del repo) para el SQL Editor.
# Uso (PowerShell, en la carpeta del repo, con "supabase link" hecho):
#   powershell -ExecutionPolicy Bypass -File scripts\setup-push.ps1
# -----------------------------------------------------------------
param(
  [string]$SecretsDir = 'C:\Users\ivan2\luma-secrets',
  [string]$ProjectRef = ''
)
$ErrorActionPreference = 'Stop'

function Say([string]$Text) { Write-Host "  $Text" }
function Fail([string]$Text) {
  Write-Host "  ERROR: $Text" -ForegroundColor Red
  exit 1
}

$account = Join-Path $SecretsDir 'firebase-service-account.json'
if (-not (Test-Path $account)) {
  Fail "No encuentro $account. Descargalo de Firebase (paso 2)."
}
if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
  Fail 'No encuentro la CLI de Supabase (npm i -g supabase).'
}

# Proyecto: el parametro o el que dejo "supabase link".
if (-not $ProjectRef) {
  $refFile = Join-Path (Get-Location) 'supabase\.temp\project-ref'
  if (Test-Path $refFile) {
    $ProjectRef = (Get-Content $refFile -Raw).Trim()
  }
}
if ($ProjectRef -notmatch '^[a-z0-9]{20}$') {
  Fail 'Falta el proyecto: usa -ProjectRef o "supabase link".'
}

# La cuenta de servicio: solo se revisa su forma.
try {
  $json = Get-Content $account -Raw | ConvertFrom-Json
} catch {
  Fail 'El archivo de Firebase no es un JSON valido.'
}
$fields = 'project_id', 'client_email', 'private_key'
foreach ($name in $fields) {
  if (-not $json.$name) { Fail "Al JSON le falta $name." }
}
if ($json.type -ne 'service_account') {
  Fail 'El JSON no es una cuenta de servicio.'
}
Say "Cuenta de servicio del proyecto $($json.project_id)."

# El secreto compartido: 32 bytes al azar en hexadecimal.
$bytes = New-Object byte[] 32
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$secret = -join ($bytes | ForEach-Object { $_.ToString('x2') })

# Una sola linea de JSON; los \n de la clave siguen escapados.
$oneLine = ($json | ConvertTo-Json -Compress -Depth 5)
if ($oneLine.Contains("'")) { Fail 'El JSON tiene comillas simples.' }

$utf8 = New-Object Text.UTF8Encoding $false
$temp = Join-Path $env:TEMP ("luma-push-" + [guid]::NewGuid() + '.env')
try {
  $lines = @(
    "FCM_SERVICE_ACCOUNT='$oneLine'",
    "PUSH_DISPATCH_SECRET=$secret"
  )
  [IO.File]::WriteAllText($temp, ($lines -join "`n"), $utf8)
  Say 'Cargando los secretos en Supabase...'
  supabase secrets set --env-file $temp --project-ref $ProjectRef | Out-Null
  if ($LASTEXITCODE -ne 0) { Fail 'supabase secrets set fallo.' }
} finally {
  if (Test-Path $temp) { Remove-Item $temp -Force }
}
Say 'Secretos cargados (el archivo temporal ya se borro).'

Say 'Desplegando push-dispatch...'
supabase functions deploy push-dispatch `
  --no-verify-jwt --project-ref $ProjectRef | Out-Null
if ($LASTEXITCODE -ne 0) { Fail 'El despliegue de push-dispatch fallo.' }
Say 'push-dispatch desplegada.'

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
$out = Join-Path $SecretsDir 'push-settings.sql'
[IO.File]::WriteAllText($out, $sql, $utf8)
Say "Listo. Pega $out en el SQL Editor."
Say 'Despues: activa pg_net y pg_cron si no lo estan.'
