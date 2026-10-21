// TEST-2 K5（BE-8 审计 N4）静态规格：重置工具只能作用于 venue_booking_e2e，且库名守卫先于删除执行。
// 只读脚本文本，不连接数据库；对守卫的实测见 resetGuard.e2e.ts（只对 postgres 维护库运行守卫块）。
import { describe, expect, it } from 'vitest'

import { assertHarmless, readResetScript } from './resetScript'

const script = readResetScript()

describe('TEST-2 K5 reset-e2e-db.ps1 的库名守卫（静态）', () => {
  it('库名是写死的字面值 venue_booking_e2e，脚本不接受任何参数', () => {
    expect(script.database).toBe('venue_booking_e2e')
    expect(script.text).not.toMatch(/^\s*param\s*\(/im)
    expect(script.text).not.toMatch(/\$args\b/i)
  })

  it('只有一次 psql 调用：连 $Database，ON_ERROR_STOP=1，整段 SQL 以一个 -c 发送（同一隐式事务）', () => {
    expect(script.psqlLines).toHaveLength(1)
    const line = script.psqlLines[0] ?? ''
    expect(line).toContain('-v ON_ERROR_STOP=1')
    expect(line).toContain('-d $Database')
    expect(line).toContain('-c $Sql')
  })

  it('守卫核对 current_database() 不是 venue_booking_e2e 就抛错，且有其他会话时也抛错', () => {
    expect(script.guard).toMatch(/IF current_database\(\) <> 'venue_booking_e2e' THEN\s+RAISE EXCEPTION 'refused: connected to database/)
    expect(script.guard).toMatch(/pg_stat_activity[\s\S]*RAISE EXCEPTION 'refused: other sessions/)
  })

  it('守卫块位于 DROP SCHEMA 之前，SQL 中再没有别的删除语句', () => {
    const guardAt = script.sql.indexOf(script.guard)
    const dropAt = script.sql.indexOf('DROP SCHEMA public CASCADE;')

    expect(script.guard).not.toBe('')
    expect(guardAt).toBe(0)
    expect(dropAt).toBeGreaterThan(guardAt + script.guard.length - 1)
    expect(script.sql.match(/\bDROP\b/g)).toHaveLength(1)
  })

  it('守卫块本身无害（实测前的检查），含删除语句的整段 SQL 会被拒绝', () => {
    expect(() => assertHarmless(script.guard)).not.toThrow()
    expect(() => assertHarmless(script.sql)).toThrow(/拒绝执行/)
  })
})
