import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseSessionFile } from '../src/parser/index.ts';

const FIXTURES = join(import.meta.dirname, 'fixtures');
const fixture = (name: string) => join(FIXTURES, name);

test('Claude: a user question followed by an assistant reply forms one round', () => {
  const { rounds } = parseSessionFile(fixture('claude-minimal.jsonl'), 'claude');

  assert.equal(rounds.length, 1);
  assert.equal(rounds[0].index, 1);
  assert.equal(rounds[0].question.text, '你好');
  assert.equal(rounds[0].question.id, 'r1-q');
  assert.equal(rounds[0].answer.text, '你好！有什么可以帮你？');
  assert.equal(rounds[0].answer.id, 'r1-a');
});

test('Claude: a user record with array text content (no tool_result) is a question', () => {
  const { rounds } = parseSessionFile(fixture('claude-user-array-text.jsonl'), 'claude');

  assert.equal(rounds.length, 1);
  assert.equal(rounds[0].question.text, '数组型提问');
  assert.equal(rounds[0].answer.text, '数组型回应');
});

test('Claude: a tool_result user record is excluded; tool-loop assistant text stays in the same round', () => {
  const { rounds } = parseSessionFile(fixture('claude-tool-result.jsonl'), 'claude');

  assert.equal(rounds.length, 1);
  assert.equal(rounds[0].question.text, '问题A');
  assert.match(rounds[0].answer.text, /回复A1/);
  assert.match(rounds[0].answer.text, /回复A2/);
});

test('Claude: thinking block is dropped by default', () => {
  const { rounds } = parseSessionFile(fixture('claude-thinking.jsonl'), 'claude');

  assert.equal(rounds[0].answer.text, '答T');
});

test('Claude: thinking block is kept when includeThinking is true', () => {
  const { rounds } = parseSessionFile(fixture('claude-thinking.jsonl'), 'claude', { includeThinking: true });

  assert.match(rounds[0].answer.text, /我在想一个答案/);
  assert.match(rounds[0].answer.text, /答T/);
});

test('Claude: isSidechain records and noise types are dropped', () => {
  const { rounds } = parseSessionFile(fixture('claude-sidechain-noise.jsonl'), 'claude');

  assert.equal(rounds.length, 1);
  assert.equal(rounds[0].question.text, '主问');
  assert.equal(rounds[0].answer.text, '主答');
  assert.doesNotMatch(rounds[0].answer.text, /子任务/);
});

test('Claude: inline reasoning ending with </think> is stripped by default', () => {
  const { rounds } = parseSessionFile(fixture('claude-inline-think.jsonl'), 'claude');

  assert.equal(rounds[0].answer.text, '这是真正的答案I');
  assert.doesNotMatch(rounds[0].answer.text, /内部推理/);
});

test('Claude: inline reasoning is kept when includeThinking is true', () => {
  const { rounds } = parseSessionFile(fixture('claude-inline-think.jsonl'), 'claude', { includeThinking: true });

  assert.match(rounds[0].answer.text, /内部推理过程/);
  assert.match(rounds[0].answer.text, /真正的答案I/);
});

test('Codex: a response_item user/assistant pair forms one round', () => {
  const { rounds } = parseSessionFile(fixture('codex-minimal.jsonl'), 'codex');

  assert.equal(rounds.length, 1);
  assert.equal(rounds[0].question.text, '你好');
  assert.equal(rounds[0].answer.text, '你好回复');
});

test('Codex: developer + environment_context noise excluded; event_msg does not duplicate', () => {
  const { meta, rounds } = parseSessionFile(fixture('codex-noise.jsonl'), 'codex');

  assert.equal(rounds.length, 1);
  assert.equal(rounds[0].question.text, '真正的第一个问题');
  assert.equal(rounds[0].answer.text, '真正的回答'); // 精确相等 → 若 event_msg 重复会变成两段
  assert.doesNotMatch(rounds[0].question.text, /environment_context/);
  assert.doesNotMatch(rounds[0].answer.text, /permissions/);
  assert.equal(meta.title, '真正的第一个问题');
});

test('rounds: messages are ordered by timestamp before splitting', () => {
  const { rounds } = parseSessionFile(fixture('claude-unordered.jsonl'), 'claude');

  assert.equal(rounds.length, 2);
  assert.equal(rounds[0].question.text, 'Q1');
  assert.equal(rounds[0].answer.text, 'A1');
  assert.equal(rounds[1].question.text, 'Q2');
  assert.equal(rounds[1].answer.text, 'A2');
});

test('meta: title is truncated to <=40 chars while the question block keeps full text', () => {
  const { meta, rounds } = parseSessionFile(fixture('claude-long-title.jsonl'), 'claude');

  assert.equal(rounds[0].question.text.length, 48); // 块保留完整正文
  assert.equal(meta.title.length, 41); // 40 + …
  assert.ok(meta.title.endsWith('…'));
});

test('rounds: a trailing question with no answer yields an empty answer block', () => {
  const { rounds } = parseSessionFile(fixture('claude-long-title.jsonl'), 'claude');

  assert.equal(rounds.length, 2);
  assert.equal(rounds[1].question.text, '末尾问题没有回答');
  assert.equal(rounds[1].answer.text, '');
});

test('Codex: 同一 session_meta.id、不同 rollout 文件名 → 不同会话 id（回归 docs/16 撞车 bug）', () => {
  const dir = mkdtempSync(join(tmpdir(), 'aida-codex-id-'));
  try {
    const lines = (q: string) =>
      [
        JSON.stringify({
          timestamp: '2026-05-29T05:00:00.000Z',
          type: 'session_meta',
          payload: { id: 'thread-shared', timestamp: '2026-05-29T05:00:00.000Z', cwd: 'E:\\p' },
        }),
        JSON.stringify({
          timestamp: '2026-05-29T05:00:01.000Z',
          type: 'response_item',
          payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: q }] },
        }),
        JSON.stringify({
          timestamp: '2026-05-29T05:00:05.000Z',
          type: 'response_item',
          payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: '答' }] },
        }),
      ].join('\n');
    // 两个文件 session_meta.id 相同（thread-shared），但文件名 uuid 不同（原始 vs 续接）
    const fA = join(dir, 'rollout-2026-05-29T13-07-15-019e7221-26a7-7cc0-907e-2746b0743369.jsonl');
    const fB = join(dir, 'rollout-2026-05-29T13-47-19-019e7245-d356-7962-bbd2-1361137a0aae.jsonl');
    writeFileSync(fA, lines('原始会话'), 'utf8');
    writeFileSync(fB, lines('续接会话'), 'utf8');

    const a = parseSessionFile(fA, 'codex').meta;
    const b = parseSessionFile(fB, 'codex').meta;
    assert.equal(a.sessionId, '019e7221-26a7-7cc0-907e-2746b0743369');
    assert.equal(b.sessionId, '019e7245-d356-7962-bbd2-1361137a0aae');
    assert.notEqual(a.id, b.id); // 关键：不再撞车
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
