# -----------------------------------------------------------------
# Opcion 1 - Luma IA con Gemini: clave, modelo y modelo de respaldo.
# Guarda ai.env en la carpeta de secretos, carga los secretos LLM_*,
# despliega recommend, suggest-promotions y extract-menu y prueba la
# clave con cada modelo. Repetible: Enter deja lo guardado.
# -----------------------------------------------------------------

$script:GeminiUrl = 'https://generativelanguage.googleapis.com/v1beta'

# Una llamada real y minima de generateContent: el codigo HTTP.
function Test-LumaGeminiModel([string]$Key, [string]$Model) {
  $uri = "$script:GeminiUrl/models/$([uri]::EscapeDataString($Model)):generateContent"
  $body = '{"contents":[{"parts":[{"text":"Responde solo: OK"}]}],"generationConfig":{"maxOutputTokens":16}}'
  $r = Invoke-LumaHttp $uri @{ 'x-goog-api-key' = $Key } 'POST' $body
  return $r.Status
}

# 503 y 429: el modelo existe pero esta saturado o sin cupo en este momento.
function Test-LumaBusy([int]$Status) { return $Status -eq 503 -or $Status -eq 429 }

function Invoke-LumaAi([string]$ProjectRef) {
  $since = Get-LumaNow
  $saved = Read-LumaEnvFile 'ai.env'
  $key = Read-LumaValue 'Clave de Gemini (AI Studio)' $saved['LLM_API_KEY'] -Secret
  $model = Read-LumaValue 'Modelo' ($(if ($saved['LLM_MODEL']) { $saved['LLM_MODEL'] } else { 'gemini-3.6-flash' }))
  $defaultFallback = if ($saved['LLM_FALLBACK_MODEL']) { $saved['LLM_FALLBACK_MODEL'] } else { 'gemini-3.5-flash-lite' }
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
  elseif (Test-LumaBusy $status) { $lines += New-LumaLine 'APAGADO' "Gemini: $model saturado ahora, el respaldo lo cubrira" 'No hace falta hacer nada; vuelve a probar mas tarde.' }
  elseif ($status -eq 404) { $lines += New-LumaLine 'FALTA' "Gemini: el modelo $model no existe" 'Vuelve a la opcion 1 con otro modelo.' }
  else { $lines += New-LumaLine 'FALTA' "Gemini: la clave fue rechazada ($status)" 'Crea otra clave en AI Studio.' }
  if ($fallback) {
    $fb = Test-LumaGeminiModel $key $fallback
    if ($fb -eq 200) { $lines += New-LumaLine 'OK' "Gemini: modelo de respaldo $fallback listo" }
    elseif (Test-LumaBusy $fb) { $lines += New-LumaLine 'APAGADO' "Gemini: el respaldo $fallback esta saturado ahora" 'Normal en horas pico; se reintenta solo.' }
    else { $lines += New-LumaLine 'FALTA' "Gemini: el modelo de respaldo $fallback respondio $fb" 'Elige otro o escribe - para ninguno.' }
  } else {
    $lines += New-LumaLine 'APAGADO' 'Gemini: sin modelo de respaldo' 'Opcional: ayuda cuando el modelo principal esta saturado.'
  }

  if (-not (Set-LumaSecrets $ProjectRef $values)) {
    return $lines + (New-LumaLine 'FALTA' 'Luma IA: no se pudieron cargar los secretos' 'Revisa "npx supabase login" y "npx supabase link".')
  }
  $functions = @('recommend', 'suggest-promotions', 'extract-menu')
  $failed = @(Deploy-LumaFunctions $ProjectRef $functions)
  if ($failed.Count) { return $lines + (New-LumaLine 'FALTA' "No se desplego: $($failed -join ', ')" 'Repite la opcion 1; si sigue, mira el mensaje de arriba.') }
  $lines += Test-LumaRemote $ProjectRef @($values.Keys | Sort-Object) $functions $since
  return $lines
}
