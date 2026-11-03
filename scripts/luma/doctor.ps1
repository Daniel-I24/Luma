# -----------------------------------------------------------------
# Opcion 7 - diagnostico (npm run doctor). Usa la sesion de la CLI
# ("npx supabase login"): nombres de secretos y funciones. Migraciones
# y banderas necesitan un token personal: se pide opcional, solo en
# memoria (nunca se escribe a disco) y se borra al terminar.
# Ningun archivo de luma-secrets contiene tokens de cuenta.
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
    # Fuera de esta ventana tampoco queda: se borra de la memoria del proceso.
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
