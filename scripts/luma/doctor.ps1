# -----------------------------------------------------------------
# Option 7 - diagnosis (npm run doctor). Uses the CLI session
# ("npx supabase login"): names of secrets and functions. Migrations
# and flags need a personal token: asked for as optional, kept only in
# memory (never written to disk) and cleared at the end.
# No file in luma-secrets holds account tokens.
# -----------------------------------------------------------------

function Invoke-LumaDoctor {
  Say 'Migraciones y banderas necesitan un token personal de Supabase (opcional).'
  Say 'No se guarda: solo vive durante este diagnostico. Enter para omitir.'
  $token = Read-LumaValue 'Token personal (opcional)' -Secret
  $given = [bool]$token
  $previous = $env:SUPABASE_ACCESS_TOKEN
  try {
    if ($token) { $env:SUPABASE_ACCESS_TOKEN = $token }
    $code = Invoke-LumaNpm doctor
  } finally {
    # Nor does it stay outside this window: it is cleared from the process memory.
    $env:SUPABASE_ACCESS_TOKEN = $previous
    $token = $null
  }
  $lines = @()
  if ($code -eq 0) { $lines += New-LumaLine 'OK' 'Diagnostico: todo lo comprobable esta bien' }
  else { $lines += New-LumaLine 'FALTA' 'Diagnostico: hay cosas por hacer (lista de arriba)' 'Empieza por la primera linea FALTA.' }
  if ($given) {
    $lines += New-LumaLine 'OK' 'El token no se guardo en ningun archivo' `
      'Si lo creaste solo para esto, revocalo en supabase.com/dashboard/account/tokens.'
  }
  return $lines
}
