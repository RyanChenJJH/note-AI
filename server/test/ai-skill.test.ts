import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadSkill } from '../src/ai/skill.ts';

/** 在 base 下铺一份最小 skill：SKILL.md(含 frontmatter) + references/type-selection + 两个模板。 */
function writeSkill(base: string): void {
  writeFileSync(
    join(base, 'SKILL.md'),
    ['---', 'name: test-skill', 'description: 一个测试 skill', '---', '', '# 正文', 'MARKER_SKILL_BODY'].join('\n'),
    'utf8',
  );
  const refs = join(base, 'references');
  const tpl = join(refs, 'templates');
  mkdirSync(tpl, { recursive: true });
  writeFileSync(join(refs, 'type-selection.md'), '# 类型指南 MARKER_TYPESEL', 'utf8');
  writeFileSync(join(tpl, '概念页.md'), 'MARKER_TPL_CONCEPT', 'utf8');
  writeFileSync(join(tpl, '通用页.md'), 'MARKER_TPL_GENERAL', 'utf8');
}

test('loadSkill：拼出含 SKILL 正文 + 类型指南 + 全部模板的 system prompt，且剥掉 frontmatter', () => {
  const base = mkdtempSync(join(tmpdir(), 'aida-skill-'));
  try {
    writeSkill(base);
    const { systemPrompt, root } = loadSkill(base);
    assert.equal(root, base);
    // 输出契约前言钉死
    assert.match(systemPrompt, /<<<NOTE filename=/);
    assert.match(systemPrompt, /<<<NO NOTES:/);
    // 正文与参考资料都在
    assert.match(systemPrompt, /MARKER_SKILL_BODY/);
    assert.match(systemPrompt, /MARKER_TYPESEL/);
    assert.match(systemPrompt, /MARKER_TPL_CONCEPT/);
    assert.match(systemPrompt, /MARKER_TPL_GENERAL/);
    // 分节标记
    assert.match(systemPrompt, /===== references\/templates\/概念页\.md =====/);
    // frontmatter 被剥掉
    assert.doesNotMatch(systemPrompt, /name: test-skill/);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test('loadSkill：skillPath 给父目录时向下浅搜定位 SKILL.md', () => {
  const base = mkdtempSync(join(tmpdir(), 'aida-skill-'));
  try {
    const deep = join(base, 'a', 'b');
    mkdirSync(deep, { recursive: true });
    writeSkill(deep);
    const { systemPrompt, root } = loadSkill(base); // 传父目录
    assert.equal(root, deep);
    assert.match(systemPrompt, /MARKER_SKILL_BODY/);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test('loadSkill：找不到 SKILL.md 抛错', () => {
  const base = mkdtempSync(join(tmpdir(), 'aida-skill-'));
  try {
    assert.throws(() => loadSkill(base), /未找到 SKILL\.md/);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});
