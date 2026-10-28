param([string]$ExtensionPath)
$ErrorActionPreference = 'Stop'
if (-not $ExtensionPath) { $ExtensionPath = Read-Host 'Carpeta actual de Zono MP Monitor' }
$target = (Resolve-Path -LiteralPath $ExtensionPath).Path
$manifestPath = Join-Path $target 'manifest.json'
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
if ($manifest.name -ne 'Zono - Mercado Pago Monitor' -or $manifest.version -notin @('1.7.5','1.7.6')) { throw 'Se requiere Zono MP Monitor 1.7.5 o 1.7.6.' }
$contentPath = Join-Path $target 'content.js'
$content = [IO.File]::ReadAllText($contentPath)
$start = $content.IndexOf('function getRowDate(')
$end = $content.IndexOf('// Helper to extract clean activity item')
if ($start -lt 0 -or $end -le $start) { throw 'No se reconoce el lector de fechas; no se modificaron archivos.' }
$refreshPath = Join-Path $target 'capture-refresh.js'
$refresh = [IO.File]::ReadAllText($refreshPath)
if (-not $refresh.Contains('getRowDate(el)?.dateStr') -and -not $refresh.Contains('getRowDate(el,{requireEvidence:true})?.dateStr')) { throw 'No se reconoce el lector de historial.' }
$bankPath = Join-Path $target 'banking.js'
$oldBank = [IO.File]::ReadAllText($bankPath)
if (-not $oldBank.Contains('dateResolver(el)') -and -not $oldBank.Contains('dateResolver(el,{requireEvidence:true})')) { throw 'No se reconoce el lector bancario.' }
$dateCode = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'date-resolver.txt'))
$bankCode = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'banking.js'))
if (-not $dateCode.StartsWith('function getRowDate(') -or -not $dateCode.Contains('requireEvidence') -or -not $bankCode.Contains('dateResolver(el,{requireEvidence:true})')) { throw 'El paquete de actualización está incompleto.' }
$backup = Join-Path $target ('respaldo-antes-1.7.6-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0,8))
New-Item -ItemType Directory -Path $backup | Out-Null
$files = @('manifest.json','content.js','banking.js','capture-refresh.js')
foreach ($name in $files) { Copy-Item -LiteralPath (Join-Path $target $name) -Destination (Join-Path $backup $name) }
$utf8 = New-Object Text.UTF8Encoding($false)
try {
  [IO.File]::WriteAllText($contentPath, $content.Substring(0,$start) + $dateCode + $content.Substring($end), $utf8)
  [IO.File]::WriteAllText($bankPath, $bankCode, $utf8)
  [IO.File]::WriteAllText($refreshPath, $refresh.Replace('getRowDate(el)?.dateStr','getRowDate(el,{requireEvidence:true})?.dateStr'), $utf8)
  $manifest.version = '1.7.6'
  [IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json -Depth 20), $utf8)
} catch {
  foreach ($name in $files) { Copy-Item -LiteralPath (Join-Path $backup $name) -Destination (Join-Path $target $name) -Force }
  throw
}
Write-Output 'Actualización aplicada: 1.7.6. Recargar la extensión y las pestañas de Mercado Pago en cada perfil.'
Write-Output ('Respaldo: ' + $backup)
