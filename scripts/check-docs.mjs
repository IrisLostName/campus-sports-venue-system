#!/usr/bin/env node
// 文档一致性检查：node scripts/check-docs.mjs
// 检查项：
//   1. 文档间引用：`NN` 第 X 节 指向的文档与章节标题必须存在
//   2. 已退役文件名与私人邮箱不得出现在被跟踪的文件中
//   3. 禁用术语（capacity 等）只允许出现在“已取消/不做”一类说明行
//   4. docs/15、docs/04 中出现的 ACC-* 编号必须在 docs/04 中定义
// 退出码：0 通过，1 有问题。不读取 sys.old/。

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const docsDir = join(root, 'docs');
const problems = [];
const fail = (file, line, msg) => problems.push(`${relative(root, file)}:${line}  ${msg}`);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'sys.old' || name === '.git' || name === 'node_modules') continue;
    const p = join(dir, name);
    statSync(p).isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
}

const mdFiles = walk(root).filter((f) => f.endsWith('.md'));
const docFiles = readdirSync(docsDir).filter((f) => /^\d\d-.*\.md$/.test(f));
const byNumber = new Map(docFiles.map((f) => [f.slice(0, 2), join(docsDir, f)]));

// ---- 章节标题表：每个文档有哪些编号章节 ----
const headings = new Map();
for (const [num, file] of byNumber) {
  const set = new Set();
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^#{2,4}\s+(\d+(?:\.\d+)*)[.\s]/);
    if (m) set.add(m[1]);
  }
  headings.set(num, set);
}

// ---- 1. 交叉引用 ----
const refRe = /`(\d\d)`\s*第\s*([\d.、,，–\-—\s]+?)\s*节/g;
const bareRe = /(?:见|参见|以|对应)\s*`(\d\d)`(?!\s*第)/g;
for (const file of mdFiles) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((text, i) => {
    let m;
    refRe.lastIndex = 0;
    while ((m = refRe.exec(text))) {
      const [, doc, secs] = m;
      if (!byNumber.has(doc)) { fail(file, i + 1, `引用了不存在的文档 ${doc}`); continue; }
      for (const sec of secs.split(/[、,，–\-—\s]+/).filter(Boolean)) {
        if (!headings.get(doc).has(sec)) fail(file, i + 1, `文档 ${doc} 没有第 ${sec} 节`);
      }
    }
    bareRe.lastIndex = 0;
    while ((m = bareRe.exec(text))) {
      if (!byNumber.has(m[1])) fail(file, i + 1, `引用了不存在的文档 ${m[1]}`);
    }
  });
}

// ---- 2. 退役文件与私人邮箱 ----
const retired = /CODEX_HANDOFF|RESTRUCTURE_(PLAN|BLUEPRINT|LOG)|(^|[^\w/])TODO\.md/;
const privateMail = /[\w.+-]+@(?!users\.noreply\.github\.com|github\.com)(?:[\w-]+\.)+[A-Za-z]{2,}\b/; // 只允许 GitHub noreply 邮箱与 git@github.com 形式的 SSH 地址
for (const file of mdFiles) {
  readFileSync(file, 'utf8').split('\n').forEach((text, i) => {
    if (retired.test(text) && !file.endsWith(`${sep}16-quality-gates-and-audit.md`)) fail(file, i + 1, '引用了已退役文件');
    if (privateMail.test(text)) fail(file, i + 1, '出现非 noreply 邮箱');
  });
}

// ---- 3. 禁用术语 ----
const banned = /capacity|conflict_strategy|LIMITED_CAPACITY|TIME_SLOT|PARTICIPANT|审批|\?view=/i;
const explain = /已取消|已删除|取消|不设|不做|不要|不得|不出现|不使用|不是|不采用|禁用|删除|旧|早期|ACC-M1-02|无审批|不接|后续扩展|不引入|容量型/;
for (const file of mdFiles) {
  if (file.endsWith(`${sep}16-quality-gates-and-audit.md`)) continue;
  readFileSync(file, 'utf8').split('\n').forEach((text, i) => {
    if (banned.test(text) && !explain.test(text)) fail(file, i + 1, `禁用术语出现在非说明语境：${text.trim().slice(0, 60)}`);
  });
}

// ---- 4. 验收编号 ----
const accDefined = new Set();
const accFile = byNumber.get('04');
if (accFile) {
  for (const m of readFileSync(accFile, 'utf8').matchAll(/ACC-M\d-\d\d/g)) accDefined.add(m[0]);
  for (const num of ['15']) {
    const f = byNumber.get(num);
    if (!f) continue;
    readFileSync(f, 'utf8').split('\n').forEach((text, i) => {
      for (const m of text.matchAll(/ACC-M\d-\d\d/g)) {
        if (!accDefined.has(m[0])) fail(f, i + 1, `${m[0]} 未在 04 中定义`);
      }
    });
  }
}

// ---- 5. 接口清单：每个接口都必须写明响应（返回类型或 204） ----
const apiFile = byNumber.get('12');
if (apiFile) {
  readFileSync(apiFile, 'utf8').split('\n').forEach((text, i) => {
    if (/^\|\s*`(GET|POST|PUT|PATCH|DELETE) \//.test(text) && !/返回|204/.test(text)) {
      fail(apiFile, i + 1, `接口没有写明响应：${text.trim().slice(0, 50)}`);
    }
  });
}

if (problems.length) {
  console.error(`发现 ${problems.length} 个问题：\n` + problems.join('\n'));
  process.exit(1);
}
console.log(`文档检查通过（${mdFiles.length} 个 md 文件，${byNumber.size} 个编号文档）`);
