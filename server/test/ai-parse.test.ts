import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNotes } from '../src/ai/parse.ts';

test('单篇：抽出 filename 与正文（trim）', () => {
  const raw = '<<<NOTE filename="20260602-概念-MCP原理.md">>>\n---\n标题: 概念-MCP原理\n---\n\n正文A\n<<<END NOTE>>>';
  const r = parseNotes(raw);
  assert.equal(r.notes.length, 1);
  assert.equal(r.notes[0].filename, '20260602-概念-MCP原理.md');
  assert.match(r.notes[0].content, /^---/);
  assert.match(r.notes[0].content, /正文A/);
  assert.equal(r.noNotes, undefined);
});

test('多篇：连续块各自解析', () => {
  const raw = [
    '<<<NOTE filename="a.md">>>',
    'AAA',
    '<<<END NOTE>>>',
    '',
    '<<<NOTE filename="b.md">>>',
    'BBB',
    '<<<END NOTE>>>',
  ].join('\n');
  const r = parseNotes(raw);
  assert.equal(r.notes.length, 2);
  assert.deepEqual(r.notes.map((n) => n.filename), ['a.md', 'b.md']);
  assert.equal(r.notes[1].content, 'BBB');
});

test('NO NOTES：返回原因，notes 空', () => {
  const r = parseNotes('<<<NO NOTES: 通篇是项目执行规划，无普适知识>>>');
  assert.equal(r.notes.length, 0);
  assert.match(r.noNotes ?? '', /项目执行规划/);
});

test('容错：整段被代码围栏误包仍能解析', () => {
  const raw = '```markdown\n<<<NOTE filename="c.md">>>\nCCC\n<<<END NOTE>>>\n```';
  const r = parseNotes(raw);
  assert.equal(r.notes.length, 1);
  assert.equal(r.notes[0].content, 'CCC');
});

test('容错：笔记内部含代码块不被外层剥离误伤', () => {
  const raw = '<<<NOTE filename="d.md">>>\n正文\n```js\nconst x=1\n```\n结尾\n<<<END NOTE>>>';
  const r = parseNotes(raw);
  assert.equal(r.notes.length, 1);
  assert.match(r.notes[0].content, /```js/);
  assert.match(r.notes[0].content, /结尾/);
});

test('容错：文件名缺引号 → 解析；缺名 → 兜底 untitled.md', () => {
  const r1 = parseNotes('<<<NOTE filename=e.md>>>\nE\n<<<END NOTE>>>');
  assert.equal(r1.notes[0].filename, 'e.md');
});

test('空 / 无法解析：notes 空且无 noNotes', () => {
  const r = parseNotes('模型乱说了一堆没有哨兵的东西');
  assert.equal(r.notes.length, 0);
  assert.equal(r.noNotes, undefined);
});
