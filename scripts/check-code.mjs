#!/usr/bin/env node
// 代码门禁（与实现语言无关的 grep 级检查）：
//   node scripts/check-code.mjs                 全部模式检查，frontend/ backend/ 不存在时跳过对应部分
//   node scripts/check-code.mjs --errors backend   docs/12 中每个错误码至少在后端测试中出现一次
//   node scripts/check-code.mjs --errors frontend  同上，针对前端测试
//   node scripts/check-code.mjs --trace M3         docs/04 中 ACC-M3-* 每个编号必须出现在测试代码或 docs/evidence/ 中
// 说明：这是“取巧行为”的粗筛，不能证明代码正确；配套的人工/独立审计流程见 docs/16。
// 门禁文件（scripts/、eslint、checkstyle、ArchUnit、契约测试）不得由施工方修改，见 docs/16 第 2 节。
// 不读取 sys.old/。

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const args = process.argv.slice(2);
const problems = [];
const SKIP_DIRS = new Set(['node_modules', 'target', 'dist', '.git', 'sys.old', '.vite']);

function walk(dir, exts, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, exts, out);
    else if (exts.some((e) => name.endsWith(e))) out.push(p);
  }
  return out;
}

function scan(files, rules, allow = () => false) {
  for (const f of files) {
    const rel = relative(root, f).replaceAll('\\', '/');
    readFileSync(f, 'utf8').split('\n').forEach((text, i) => {
      for (const [re, msg] of rules) {
        if (re.test(text) && !allow(rel, text)) problems.push(`${rel}:${i + 1}  ${msg}`);
      }
    });
  }
}

const banned = [[/capacity|conflict_strategy|LIMITED_CAPACITY|TIME_SLOT|PARTICIPANT/i, '禁用术语（docs/14 第 9 节）']];

// ---------- 模式检查 ----------
const be = join(root, 'backend');
const fe = join(root, 'frontend');
const beMain = walk(join(be, 'src/main'), ['.java', '.yml', '.yaml', '.properties', '.sql']);
const beTest = walk(join(be, 'src/test'), ['.java', '.yml', '.yaml', '.properties']);
const feSrc = walk(join(fe, 'src'), ['.ts', '.vue', '.tsx']);
const feTests = walk(join(fe, 'tests'), ['.ts']); // QA-1 起扫描前端测试目录

scan([...beMain, ...beTest], [
  ...banned,
  [/@Disabled|@Ignore\b/, '跳过测试'],
  [/ddl-auto\s*[:=]\s*(update|create|create-drop)/, 'JPA 不得自动改表，只能 validate（docs/13）'],
  [/\bh2\b|jdbc:h2|hsqldb|sqlite/i, '测试与运行必须使用真实 PostgreSQL（docs/07）'],
  [/System\.out\.print|printStackTrace/, '用日志，不用标准输出'],
  [/@SuppressWarnings\(\s*"(all|unchecked|rawtypes)"/, '不得用压制警告掩盖问题'],
  [/\b(TODO|FIXME|HACK|XXX)\b/, '遗留标记，必须在提交前处理或转为文档记录'],
  [/Thread\.sleep/, '不得用 sleep 制造并发或等待，使用 CountDownLatch / Awaitility'],
]);
scan(beMain.filter((f) => f.endsWith('.java')), [
  [/Demo@1234|JWT_SECRET\s*[:=]\s*["'][^$"']+["']/, '密码或密钥不得写进主代码'],
  [/catch\s*\(\s*(Exception|Throwable)\s+\w+\s*\)\s*\{\s*\}/, '空 catch 吞异常'],
]);

scan(feSrc, [
  ...banned,
  [/\b(it|test|describe)\.skip\b|\bxit\(|\bxdescribe\(/, '跳过测试'],
  [/\b(it|test|describe)\.only\b/, '遗留 .only'],
  [/@ts-ignore|@ts-nocheck|@ts-expect-error|eslint-disable/, '不得压制类型或 lint 检查'],
  [/:\s*any\b|\bas any\b|<any>/, '不得使用 any（用 unknown 或精确类型）'],
  [/console\.(log|debug)/, '遗留调试输出'],
  [/\b(TODO|FIXME|HACK|XXX)\b/, '遗留标记'],
]);
// QA-1：前端测试同样不得跳过、压制、使用 any 或留调试输出。测试本来就要用 mock、storage，所以不加那几条规则。
scan(feTests, [
  ...banned,
  [/\.(skip|only|todo|skipIf|runIf)(?![\w$])/, '不得跳过、遗留 .only、占位测试或按条件运行（含 .skip.each、.only.each、.skipIf()、.runIf() 等链式写法）'],
  [/\b(xit|xdescribe|fit|fdescribe)\(/, '不得跳过、遗留聚焦的测试'],
  [/@ts-ignore|@ts-nocheck|@ts-expect-error|eslint-disable/, '不得压制类型或 lint 检查'],
  [/:\s*any\b|\bas any\b|<any>/, '不得使用 any（用 unknown 或精确类型）'],
  [/\b(TODO|FIXME|HACK|XXX)\b/, '遗留标记'],
  [/console\.(log|debug)/, '遗留调试输出'],
]);
// 页面/组件/store 不得直接碰 mock、fetch、axios（只能经 api/index.ts）
scan(feSrc.filter((f) => !relative(root, f).replaceAll('\\', '/').startsWith('frontend/src/api/')), [
  [/from\s+['"][^'"]*api\/mock|from\s+['"][^'"]*api\/http/, '只能从 api/index 取数据（ADR-0006）'],
  [/\bfetch\(|from\s+['"]axios['"]|XMLHttpRequest/, '网络请求只允许出现在 src/api/http'],
], (rel) => rel.includes('.spec.') || rel.includes('.test.'));
// 令牌只允许在 auth store 中读写 storage
scan(feSrc, [[/localStorage|sessionStorage/, 'storage 只允许在 stores/auth 中使用']],
  (rel) => rel.includes('stores/auth') || rel.includes('.spec.') || rel.includes('.test.'));

// ---------- 错误码覆盖 ----------
function errorCodes() {
  const f = join(root, 'docs/12-api-contract.md');
  const codes = [];
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\|\s*`([A-Z][A-Z_]+)`\s*\|\s*\d{3}\s*\|/);
    if (m) codes.push(m[1]);
  }
  return codes;
}
const RESERVED = new Set(['HAS_HISTORY', 'INTERNAL_ERROR']); // 无对应接口或难以触发，docs/12 已注明
const errIdx = args.indexOf('--errors');
if (errIdx >= 0) {
  const side = args[errIdx + 1];
  const files = side === 'backend' ? beTest : walk(fe, ['.ts', '.vue']).filter((f) => /\.(spec|test)\./.test(f));
  if (!files.length) problems.push(`没有找到 ${side} 的测试文件`);
  const text = files.map((f) => readFileSync(f, 'utf8')).join('\n');
  for (const c of errorCodes()) {
    if (!RESERVED.has(c) && !text.includes(c)) problems.push(`错误码 ${c} 没有任何 ${side} 测试引用`);
  }
}

// ---------- 验收编号追溯 ----------
const trIdx = args.indexOf('--trace');
if (trIdx >= 0) {
  const ms = args[trIdx + 1]; // 如 M3
  const spec = readFileSync(join(root, 'docs/04-delivery-and-acceptance.md'), 'utf8');
  const ids = [...new Set(spec.match(new RegExp(`ACC-${ms}-\\d\\d`, 'g')) ?? [])];
  const evidenceDir = join(root, 'docs/evidence');
  const pool = [...beTest, ...walk(fe, ['.ts', '.vue']).filter((f) => /\.(spec|test)\./.test(f)), ...walk(evidenceDir, ['.md'])];
  const text = pool.map((f) => readFileSync(f, 'utf8')).join('\n');
  for (const id of ids) if (!text.includes(id)) problems.push(`${id} 没有测试或证据文件（docs/evidence/${id}.md）`);
}

if (problems.length) {
  console.error(`发现 ${problems.length} 个问题：\n` + problems.join('\n'));
  process.exit(1);
}
const scanned = beMain.length + beTest.length + feSrc.length + feTests.length;
console.log(`代码门禁通过（扫描 ${scanned} 个文件${scanned === 0 ? '；frontend/ backend/ 尚未创建' : ''}）`);
