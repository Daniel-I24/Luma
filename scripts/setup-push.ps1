# -----------------------------------------------------------------
# setup-push.ps1 - the local part of docs/push-setup.md, without showing
# any secret (it is option 2 of scripts\luma.ps1):
#   1. reads the Firebase service account (outside the repository),
#   2. reuses or generates the shared secret of push-dispatch,
#   3. sets FCM_SERVICE_ACCOUNT and PUSH_DISPATCH_SECRET with
#      "npx supabase secrets set" from a temporary file it deletes,
#   4. deploys push-dispatch (npx supabase ... --use-api),
#   5. writes push-settings.sql (outside the repository) for the SQL Editor.
# Usage (PowerShell, in the repository folder, after "npx supabase link"):
#   powershell -ExecutionPolicy Bypass -File scripts\setup-push.ps1
# -----------------------------------------------------------------
param(
  [string]$SecretsDir = (Join-Path $(if ($env:USERPROFILE) { $env:USERPROFILE } else { $HOME }) 'luma-secrets'),
  [string]$ProjectRef = ''
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'luma/common.ps1')
. (Join-Path $PSScriptRoot 'luma/remote.ps1')
. (Join-Path $PSScriptRoot 'luma/push.ps1')

$env:LUMA_SECRETS_DIR = $SecretsDir
if (-not $ProjectRef) { $ProjectRef = Get-LumaProjectRef }
if ($ProjectRef -notmatch '^[a-z0-9]{20}$') {
  Say 'ERROR: falta el proyecto: usa -ProjectRef o "npx supabase link".'
  exit 1
}
$lines = Invoke-LumaPush $ProjectRef
Write-LumaSummary $lines
if ($lines | Where-Object { $_.State -eq 'FALTA' }) { exit 1 }
