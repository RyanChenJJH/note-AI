import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toggleBlock, roundBlockIds, allBlockIds } from '../src/lib/selection.ts';
import type { Round } from '../src/lib/types.ts';

const round = (i: number, answer: string): Round => ({
  index: i,
  question: { id: `r${i}-q`, text: `问${i}`, exported: false },
  answer: { id: `r${i}-a`, text: answer, exported: false },
});

test('toggleBlock: 增删且不改原集合', () => {
  const a = new Set<string>();
  const b = toggleBlock(a, 'r1-q');
  assert.equal(a.size, 0); // 原集合不变
  assert.ok(b.has('r1-q'));
  const c = toggleBlock(b, 'r1-q');
  assert.ok(!c.has('r1-q'));
});

test('roundBlockIds: 空回复块被排除', () => {
  assert.deepEqual(roundBlockIds(round(1, '答1')), ['r1-q', 'r1-a']);
  assert.deepEqual(roundBlockIds(round(2, '   ')), ['r2-q']); // 空白回复不计
});

test('allBlockIds: 跨轮汇总有文本的块', () => {
  assert.deepEqual(allBlockIds([round(1, '答1'), round(2, '')]), ['r1-q', 'r1-a', 'r2-q']);
});
