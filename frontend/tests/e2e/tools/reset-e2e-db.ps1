# 重置联调库 venue_booking_e2e（BE-8 裁决第 2 节 B2、第 9 节）：删除并重建 public schema。
# 之后用 start-e2e-backend.ps1 以 demo profile 启动后端：Flyway 重建表与 V100 种子，DemoReservationSeeder 写入两条演示预约。
# 安全约束：
#   - 库名写死，不接受任何参数；开发库 venue_booking 与测试库不在本工具范围内。
#   - 同一条 SQL 先核对 current_database() 且库上没有其他会话（联调后端须已停止），否则抛错，不执行删除。
#   - 口令只来自环境变量 PGPASSWORD（psql 自身的约定），不写进任何文件。
# 用法（Terminal 面板，先停后端）：& .\frontend\tests\e2e\tools\reset-e2e-db.ps1
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$Database = 'venue_booking_e2e'

if ([string]::IsNullOrEmpty($env:PGPASSWORD)) {
    throw 'PGPASSWORD is not set in this terminal (venue user password, see docs/07 section 3).'
}

# SQL 只用 ASCII，避免 Windows 命令行代码页影响。
$Sql = @'
DO $$
BEGIN
  IF current_database() <> 'venue_booking_e2e' THEN
    RAISE EXCEPTION 'refused: connected to database %, not venue_booking_e2e', current_database();
  END IF;
  IF EXISTS (SELECT 1 FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid()) THEN
    RAISE EXCEPTION 'refused: other sessions are connected to venue_booking_e2e; stop the e2e backend first';
  END IF;
END
$$;
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
'@

& psql -X -q -v ON_ERROR_STOP=1 -h localhost -p 5432 -U venue -d $Database -c $Sql
if ($LASTEXITCODE -ne 0) {
    throw "psql exited with code $LASTEXITCODE; $Database was not reset."
}
Write-Host "Reset done: schema public of $Database dropped and recreated. Start the backend with start-e2e-backend.ps1."
