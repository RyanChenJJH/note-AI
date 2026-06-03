import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupByDay, badgeOf } from '../src/lib/group.ts';
import type { Session } from '../src/lib/types.ts';

const mk = (id: string, day: string, startedAt: string): Session => ({
  id,
  source: 'claude',
  title: id,
  startedAt,
  day,
  turnCount: 1,
  exported: 'none',
});

test('groupByDay: 组按 day 倒序、组内按 startedAt 倒序', () => {
  const sessions = [
    mk('a', '2026-05-30', '2026-05-30T08:00:00Z'),
    mk('b', '2026-06-01', '2026-06-01T09:00:00Z'),
    mk('c', '2026-06-01', '2026-06-01T12:00:00Z'),
  ];
  const groups = groupByDay(sessions);
  assert.deepEqual(
    groups.map((g) => g.day),
    ['2026-06-01', '2026-05-30'],
  );
  assert.deepEqual(
    groups[0].items.map((s) => s.id),
    ['c', 'b'], // 同日内 startedAt 倒序
  );
});

test('groupByDay: 空数组 → 空分组；不修改输入', () => {
  assert.deepEqual(groupByDay([]), []);
  const input = [mk('a', '2026-06-01', '2026-06-01T08:00:00Z')];
  const copy = [...input];
  groupByDay(input);
  assert.deepEqual(input, copy);
});

test('badgeOf: full/partial/none', () => {
  assert.equal(badgeOf('full'), '●');
  assert.equal(badgeOf('partial'), '◐');
  assert.equal(badgeOf('none'), null);
});
