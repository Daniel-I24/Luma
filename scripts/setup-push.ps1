# -----------------------------------------------------------------
# setup-push.ps1 - lo local de docs/push-setup.md, sin mostrar
# ningun secreto (es la opcion 2 de scripts\luma.ps1):
#   1. lee la cuenta de servicio de Firebase (fuera del repo),
#   2. reutiliza o genera el secreto compartido de push-dispatch,
#   3. carga FCM_SERVICE_ACCOUNT y PUSH_DISPATCH_SECRET con
#      "npx supabase secrets set" desde un archivo temporal que borra,
#   4. despliega push-dispatch (npx supabase ... --use-api),
#   5. escribe push-settings.sql (fuera del repo) para el SQL Editor.
# Uso (PowerShell, en la carpeta del repo, con "npx supabase link"):
#   powershell -ExecutionPolicy Bypass -File scripts\setup-push.ps1
# -----------------------------------------------------------------
param(
  [string]$SecretsDir = (Join-Path $env:USERPROFILE 'luma-secrets'),
  [string]$ProjectRef = ''
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'luma\common.ps1')
. (Join-Path $PSScriptRoot 'luma\push.ps1')

$env:LUMA_SECRETS_DIR = $SecretsDir
if (-not $ProjectRef) { $ProjectRef = Get-LumaProjectRef }
if ($ProjectRef -notmatch '^[a-z0-9]{20}$') {
  Say 'ERROR: falta el proyecto: usa -ProjectRef o "npx supabase link".'
  exit 1
}
$lines = Invoke-LumaPush $ProjectRef
Write-LumaSummary $lines
if ($lines | Where-Object { $_.State -eq 'FALTA' }) { exit 1 }
