// TEST-2 K5 实测（TEST-2 裁决 P3）：从 reset-e2e-db.ps1 取出守卫 DO 块，只对 postgres 维护库运行，断言被拒绝。
// 不运行脚本本身、不发送 DROP/CREATE（执行前 assertHarmless 断言）；不连 venue_booking 或 venue_booking_e2e。
// 前置：本终端已设置 PGPASSWORD（docs/07 第 3 节的本机开发口令），psql 在 PATH 上，PostgreSQL 在 localhost:5432。
// 用法：pnpm test:e2e:tools
import { spawnSync } from 'node:child_process'

import { describe, expect, it } from 'vitest'

import { assertHarmless, readResetScript } from './resetScript'

const MAINTENANCE_DB = 'postgres'

function runOnMaintenanceDb(statement: string): { status: number | null; stderr: string } {
  assertHarmless(statement)
  const result = spawnSync('psql', [
    '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-h', 'localhost', '-p', '5432', '-U', 'venue', '-d', MAINTENANCE_DB, '-c', statement,
  ], { encoding: 'utf8', env: process.env })
  if (result.error) {
    throw result.error
  }
  return { status: result.status, stderr: result.stderr }
}

describe('TEST-2 K5 重置工具的库名守卫（实测，postgres 维护库）', () => {
  it('前提：本终端设置了 PGPASSWORD，且能连上维护库', () => {
    expect(process.env.PGPASSWORD ?? '', '先在本终端设置 PGPASSWORD').not.toBe('')
    const probe = runOnMaintenanceDb('SELECT 1;')
    expect([probe.status, probe.stderr]).toEqual([0, ''])
  })

  it('对 postgres 库运行守卫：拒绝并报出所连的库名，psql 以非零退出', () => {
    const guard = readResetScript().guard
    const result = runOnMaintenanceDb(guard)

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain(`refused: connected to database ${MAINTENANCE_DB}, not venue_booking_e2e`)
  })
})
