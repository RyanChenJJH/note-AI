import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { scanClaude, scanCodex } from '../src/scanner.ts';
import { emptyManifest, recordExport } from '../src/manifest.ts';

const SCAN = join(import.meta.dirname, 'fixtures', 'scan');

test('scanClaude: lists sessions and excludes subagents files', () => {
  const sessions = scanClaude(join(SCAN, 'claude'));

  assert.equal(sessions.length, 1); // subagents/agent-x.jsonl 不计入
  const s = sessions[0];
  assert.equal(s.id, 'claude:claude-scan-1');
  assert.equal(s.source, 'claude');
  assert.equal(s.title, '扫描问题一');
  assert.equal(s.turnCount, 1);
  assert.equal(s.day, '2026-05-20');
  assert.equal(s.exported, 'none');
});

test('scanCodex: day comes from the directory path (local), not the UTC timestamp', () => {
  const sessions = scanCodex(join(SCAN, 'codex'));

  assert.equal(sessions.length, 1);
  // 阶段7 后修复：codex id 取自文件名 uuid（非 session_meta.id，见 docs/16）
  assert.equal(sessions[0].id, 'codex:019e0000-0000-7000-8000-0000000000c1');
  assert.equal(sessions[0].title, '扫描C问题');
  assert.equal(sessions[0].day, '2026-06-01'); // 目录本地日期，而非 UTC 的 2026-05-31
});

test('scan: exported status is injected from the manifest', () => {
  const m = emptyManifest();
  recordExport(m, 'claude:claude-scan-1', { title: 'x', exportedAt: 't', file: 'f.md', blocks: ['r1-q'], aiTidy: false });

  const sessions = scanClaude(join(SCAN, 'claude'), m);
  assert.equal(sessions[0].exported, 'partial');
});
