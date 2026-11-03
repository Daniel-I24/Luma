# -----------------------------------------------------------------
# Opcion 1 - Luma IA con Gemini: clave, modelo y modelo de respaldo.
# Guarda ai.env en la carpeta de secretos, carga los secretos LLM_*,
# despliega recommend, suggest-promotions y extract-menu y prueba la
# clave con cada modelo. Repetible: Enter deja lo guardado.
# -----------------------------------------------------------------

$script:GeminiUrl = 'https://generativelanguage.googleapis.com/v1beta'

function Test-LumaGeminiModel([string]$Key, [string]$Model) {
  $uri = "$script:GeminiUrl/models/$([uri]::EscapeDataString($Model))"
  $r = Invoke-LumaHttp $uri @{ 'x-goog-api-key' = $Key }
  return $r.Status
}

function Invoke-LumaAi([string]$ProjectRef) {
  $saved = Read-LumaEnvFile 'ai.env'
  $key = Read-LumaValue 'Clave de Gemini (AI Studio)' $saved['LLM_API_KEY'] -Secret
  $model = Read-LumaValue 'Modelo' ($(if ($saved['LLM_MODEL']) { $saved['LLM_MODEL'] } else { 'gemini-3.8-flash' }))
  $defaultFallback = if ($saved['LLM_FALLBACK_MODEL']) { $saved['LLM_FALLBACK_MODEL'] } else { 'gemini-3.1-flash-lite' }
  $fallback = Read-LumaValue 'Modelo de respaldo (escribe - para ninguno)' $defaultFallback
  if ($fallback -eq '-') { $fallback = '' }
  $lines = @()
  if (-not $key) {
    return @(New-LumaLine 'FALTA' 'Luma IA: no hay clave' 'Crea una clave gratis en aistudio.google.com y vuelve a la opcion 1.')
  }

  $values = @{ LLM_PROVIDER = 'gemini'; LLM_MODEL = $model; LLM_API_KEY = $key }
  if ($fallback) { $values['LLM_FALLBACK_MODEL'] = $fallback }
  if ($saved['LLM_VISION_MODEL']) { $values['LLM_VISION_MODEL'] = $saved['LLM_VISION_MODEL'] }
  Write-LumaEnvFile 'ai.env' $values

  $status = Test-LumaGeminiModel $key $model
  if ($status -eq 200) { $lines += New-LumaLine 'OK' "Gemini: la clave sirve y el modelo $model existe" }
  elseif ($status -eq 404) { $lines += New-LumaLine 'FALTA' "Gemini: el modelo $model no existe" 'Vuelve a la opcion 1 con otro modelo.' }
  else { $lines += New-LumaLine 'FALTA' "Gemini: la clave fue rechazada ($status)" 'Crea otra clave en AI Studio.' }
  if ($fallback) {
    $fb = Test-LumaGeminiModel $key $fallback
    if ($fb -eq 200) { $lines += New-LumaLine 'OK' "Gemini: modelo de respaldo $fallback listo" }
    else { $lines += New-LumaLine 'FALTA' "Gemini: el modelo de respaldo $fallback respondio $fb" 'Elige otro o escribe - para ninguno.' }
  } else {
    $lines += New-LumaLine 'APAGADO' 'Gemini: sin modelo de respaldo' 'Opcional: ayuda cuando el modelo principal esta saturado.'
  }

  if (-not (Set-LumaSecrets $ProjectRef $values)) {
    return $lines + (New-LumaLine 'FALTA' 'Luma IA: no se pudieron cargar los secretos' 'Revisa "npx supabase login" y "npx supabase link".')
  }
  $lines += New-LumaLine 'OK' 'Luma IA: secretos cargados en Supabase'
  $failed = Deploy-LumaFunctions $ProjectRef @('recommend', 'suggest-promotions', 'extract-menu')
  if ($failed.Count) { $lines += New-LumaLine 'FALTA' "No se desplego: $($failed -join ', ')" 'Repite la opcion 1; si sigue, mira el mensaje de arriba.' }
  else { $lines += New-LumaLine 'OK' 'Luma IA: recommend, suggest-promotions y extract-menu desplegadas' }
  $lines += New-LumaLine 'OK' 'Siguiente paso' 'Compila la app con AI_MODE=remote (opcion 6).'
  return $lines
}
