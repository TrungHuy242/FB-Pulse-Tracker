param(
  [switch]$Build
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$bridgeRoot = Join-Path $repoRoot "gpm-bridge"
$distEntry = Join-Path $bridgeRoot "dist\index.js"
$healthUrl = "http://localhost:3001/health"
$logDir = Join-Path $env:LOCALAPPDATA "FBPulseTracker\logs"
$outLog = Join-Path $logDir "gpm-bridge.out.log"
$errLog = Join-Path $logDir "gpm-bridge.err.log"

function Test-BridgeHealth {
  try {
    $response = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 3
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

if (Test-BridgeHealth) {
  Write-Host "GPM Bridge is already running at $healthUrl"
  exit 0
}

if ($Build -or -not (Test-Path -LiteralPath $distEntry)) {
  Write-Host "Building gpm-bridge..."
  & npm.cmd --prefix $bridgeRoot run build
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
}

New-Item -ItemType Directory -Path $logDir -Force | Out-Null

Write-Host "Starting GPM Bridge in background..."
$process = Start-Process `
  -FilePath "node.exe" `
  -ArgumentList @("dist/index.js") `
  -WorkingDirectory $bridgeRoot `
  -WindowStyle Hidden `
  -RedirectStandardOutput $outLog `
  -RedirectStandardError $errLog `
  -PassThru

Start-Sleep -Seconds 5

if (Test-BridgeHealth) {
  Write-Host "GPM Bridge started. PID: $($process.Id)"
  Write-Host "Logs: $logDir"
  exit 0
}

Write-Error "GPM Bridge did not become healthy. Check logs: $logDir"
exit 1
