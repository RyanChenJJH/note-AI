import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  emptyManifest,
  recordExport,
  deriveSessionStatus,
  deriveBlockStatus,
  loadManifest,
  saveManifest,
} from '../src/manifest.ts';

const ALL = ['r1-q', 'r1-a', 'r2-q', 'r2-a']; // 某会话的全部块

test('deriveSessionStatus: none → partial → full as exported blocks accumulate', () => {
  const m = emptyManifest();
  const id = 'claude:s1';

  assert.equal(deriveSessionStatus(m, id, ALL), 'none');

  recordExport(m, id, { title: 'T', exportedAt: 't1', file: 'f1.md', blocks: ['r1-q', 'r1-a'], aiTidy: false });
  assert.equal(deriveSessionStatus(m, id, ALL), 'partial');

  recordExport(m, id, { title: 'T', exportedAt: 't2', file: 'f2.md', blocks: ['r2-q', 'r2-a'], aiTidy: false });
  assert.equal(deriveSessionStatus(m, id, ALL), 'full');
});

test('deriveBlockStatus: returns the union of exported block ids across all exports', () => {
  const m = emptyManifest();
  const id = 'claude:s1';
  recordExport(m, id, { title: 'T', exportedAt: 't1', file: 'f1.md', blocks: ['r1-q'], aiTidy: false });
  recordExport(m, id, { title: 'T', exportedAt: 't2', file: 'f2.md', blocks: ['r2-a'], aiTidy: false });

  const exported = deriveBlockStatus(m, id);
  assert.ok(exported.has('r1-q'));
  assert.ok(exported.has('r2-a'));
  assert.ok(!exported.has('r1-a'));
});

test('loadManifest/saveManifest: missing file → empty; round-trips written records', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'aida-mf-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'manifest.json');

  const fresh = loadManifest(path); // 不存在 → 空
  assert.equal(fresh.version, 1);
  assert.deepEqual(fresh.records, {});

  recordExport(fresh, 'codex:s2', { title: 'T2', exportedAt: 't', file: 'f.md', blocks: ['r1-q'], aiTidy: false });
  saveManifest(path, fresh);

  const reloaded = loadManifest(path);
  assert.deepEqual(reloaded.records['codex:s2'].exports[0].blocks, ['r1-q']);
});
