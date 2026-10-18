# 以 demo profile 启动联调后端，只连 venue_booking_e2e（BE-8 裁决第 2 节 B2/B3、第 9 节）。
# 全部配置经环境变量给出（docs/14 第 3.1 节），不改 application*.yml：
#   - DB_URL 写死为 e2e 库；DB_PASSWORD 取自本终端的 PGPASSWORD，不写进任何文件；
#   - JWT_SECRET 每次启动随机生成，只在本进程环境中；
#   - 这些变量只在 java 运行期间存在：脚本退出时（含出错与 Ctrl-C）恢复为启动前的值，不留在调用它的终端会话里（BE-8 审计 N3）；
#   - CORS_ALLOWED_ORIGINS 由 -AllowedOrigin 给出（反证时传入不含前端来源的值）。
# 工作目录是不含 .env 的临时目录：application.yml 的 spring.config.import 会读取工作目录下的 .env，联调绝不能读到 backend/.env。
# 只监听 127.0.0.1。-NoSweep 关闭每分钟的清扫（走查截图期间用；契约运行保持开启）。
# 用法（Terminal 面板，先运行 reset-e2e-db.ps1）：& .\frontend\tests\e2e\tools\start-e2e-backend.ps1 [-AllowedOrigin <来源>] [-NoSweep]
param(
    [string]$AllowedOrigin = 'http://127.0.0.1:4173',
    [switch]$NoSweep
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ([string]::IsNullOrEmpty($env:PGPASSWORD)) {
    throw 'PGPASSWORD is not set in this terminal (venue user password, see docs/07 section 3).'
}

# 其他 SPRING_* 变量或 JVM 选项可能把数据源改到别的库，出现即拒绝启动。
$Overrides = @(Get-ChildItem Env: | Where-Object {
        ($_.Name -like 'SPRING_*' -and $_.Name -ne 'SPRING_PROFILES_ACTIVE') -or
        $_.Name -in @('JAVA_TOOL_OPTIONS', 'JDK_JAVA_OPTIONS', '_JAVA_OPTIONS')
    } | ForEach-Object { $_.Name })
if ($Overrides.Count -gt 0) {
    throw "refused: these variables could override the e2e configuration: $($Overrides -join ', ')"
}

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..')).Path
$Jar = Join-Path $RepoRoot 'backend\target\venue-booking-0.1.0-SNAPSHOT.jar'
if (-not (Test-Path $Jar)) {
    throw "Jar not found: $Jar. Run mvn -B clean verify in backend first."
}

$RunDir = Join-Path ([System.IO.Path]::GetTempPath()) 'campus-venue-e2e-run'
New-Item -ItemType Directory -Force -Path $RunDir | Out-Null
if (Test-Path (Join-Path $RunDir '.env')) {
    throw "refused: $RunDir contains a .env file."
}

$BackendEnv = [ordered]@{
    SPRING_PROFILES_ACTIVE = 'demo'
    SERVER_PORT            = '8080'
    DB_URL                 = 'jdbc:postgresql://localhost:5432/venue_booking_e2e'
    DB_USERNAME            = 'venue'
    DB_PASSWORD            = $env:PGPASSWORD
    JWT_SECRET             = [Guid]::NewGuid().ToString('N') + [Guid]::NewGuid().ToString('N')
    CORS_ALLOWED_ORIGINS   = $AllowedOrigin
    APP_TIMEZONE           = 'Asia/Shanghai'
}
# 记下启动前的值（多数为未设置），finally 中逐个恢复。
$Saved = @{}
foreach ($Name in $BackendEnv.Keys) {
    $Saved[$Name] = [Environment]::GetEnvironmentVariable($Name, 'Process')
}

$JavaArgs = @('-jar', $Jar, '--server.address=127.0.0.1')
if ($NoSweep) {
    $JavaArgs += '--app.sweep.enabled=false'
}
Write-Host "Starting e2e backend: DB_URL=$($BackendEnv.DB_URL) CORS_ALLOWED_ORIGINS=$AllowedOrigin sweep=$(-not $NoSweep) workdir=$RunDir"
Push-Location $RunDir
try {
    foreach ($Name in $BackendEnv.Keys) {
        [Environment]::SetEnvironmentVariable($Name, $BackendEnv[$Name], 'Process')
    }
    & java @JavaArgs
}
finally {
    foreach ($Name in $BackendEnv.Keys) {
        [Environment]::SetEnvironmentVariable($Name, $Saved[$Name], 'Process')
    }
    Pop-Location
    Write-Host 'e2e backend stopped; backend environment variables restored for this terminal.'
}
