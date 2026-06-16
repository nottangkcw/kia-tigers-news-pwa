$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$Url = "http://localhost:3000"
$NodePath = "C:\Program Files\nodejs\node.exe"
$NextCli = Join-Path $ProjectRoot "node_modules\next\dist\bin\next"
$DetachedStarter = Join-Path $ProjectRoot "scripts\start-dev-detached.cjs"

function Test-LocalServer {
  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
  } catch {
    return $false
  }
}

Set-Location $ProjectRoot

if (-not (Test-Path $NodePath)) {
  Write-Host "Node.js를 찾지 못했습니다: $NodePath" -ForegroundColor Red
  Read-Host "Enter를 누르면 닫습니다"
  exit 1
}

if (-not (Test-Path $NextCli)) {
  Write-Host "node_modules가 없습니다. 먼저 npm install을 실행해야 합니다." -ForegroundColor Red
  Read-Host "Enter를 누르면 닫습니다"
  exit 1
}

if (-not (Test-LocalServer)) {
  Write-Host "타이거즈 뉴스 로컬 서버를 시작합니다..." -ForegroundColor Yellow
  & $NodePath $DetachedStarter | Out-Host

  for ($i = 0; $i -lt 30; $i++) {
    if (Test-LocalServer) { break }
    Start-Sleep -Seconds 1
  }
}

if (Test-LocalServer) {
  Write-Host "브라우저를 엽니다: $Url" -ForegroundColor Green
  Start-Process $Url
} else {
  Write-Host "서버 시작을 확인하지 못했습니다. dev-server.err.log를 확인하세요." -ForegroundColor Red
  Read-Host "Enter를 누르면 닫습니다"
  exit 1
}
