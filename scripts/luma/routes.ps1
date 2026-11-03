# -----------------------------------------------------------------
# Opcion 4 - rutas de "Como llegar" con OpenRouteService: guarda la
# clave en routes.env, la prueba con una ruta corta en Pasto, carga
# ROUTE_PROVIDER y ROUTE_API_KEY y despliega route.
# -----------------------------------------------------------------

$script:OrsTestUrl = 'https://api.openrouteservice.org/v2/directions/foot-walking?start=-77.2811,1.2136&end=-77.2790,1.2150'

function Invoke-LumaRoutes([string]$ProjectRef) {
  $saved = Read-LumaEnvFile 'routes.env'
  $key = Read-LumaValue 'Clave de OpenRouteService' $saved['ROUTE_API_KEY'] -Secret
  if (-not $key) {
    return @(New-LumaLine 'APAGADO' 'Rutas: sin clave (la app muestra una estimacion en linea recta)' `
      'Crea una clave gratis en openrouteservice.org (Dashboard -> Tokens) y vuelve a la opcion 4.')
  }
  Write-LumaEnvFile 'routes.env' @{ ROUTE_PROVIDER = 'openrouteservice'; ROUTE_API_KEY = $key }
  $lines = @()
  $test = Invoke-LumaHttp $script:OrsTestUrl @{ Authorization = $key }
  if ($test.Status -eq 200) { $lines += New-LumaLine 'OK' 'Rutas: la clave de OpenRouteService sirve' }
  else { $lines += New-LumaLine 'FALTA' "Rutas: OpenRouteService respondio $($test.Status)" 'Revisa la clave en openrouteservice.org.' }

  if (-not (Set-LumaSecrets $ProjectRef @{ ROUTE_PROVIDER = 'openrouteservice'; ROUTE_API_KEY = $key })) {
    return $lines + (New-LumaLine 'FALTA' 'Rutas: no se pudieron cargar los secretos' 'Revisa "npx supabase login" y "npx supabase link".')
  }
  $failed = Deploy-LumaFunctions $ProjectRef @('route')
  if ($failed.Count) { $lines += New-LumaLine 'FALTA' 'Rutas: no se desplego route' 'Repite la opcion 4.' }
  else { $lines += New-LumaLine 'OK' 'Rutas: secretos cargados y route desplegada' }
  return $lines
}
