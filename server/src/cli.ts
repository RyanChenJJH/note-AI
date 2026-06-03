import { parseArgs } from 'node:util';
import { readJsonl } from './jsonl.ts';
import { parseSessionFile } from './parser/index.ts';
import { scanAll, scanClaude, scanCodex, resolveSessionPath } from './scanner.ts';
import { buildMarkdown, writeExport } from './exporter.ts';
import { loadManifest, recordExport, saveManifest, deriveBlockStatus } from './manifest.ts';
import { claudeRoot, codexRoot, manifestPath, testExportDir } from './paths.ts';
import type { Source } from './types.ts';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    source: { type: 'string' },
    json: { type: 'boolean' },
    thinking: { type: 'boolean' },
    blocks: { type: 'string' },
    filename: { type: 'string' },
    dir: { type: 'string' },
    ai: { type: 'boolean' },
  },
});

const [cmd, id] = positionals;
const sourceOf = (sid: string): Source => (sid.startsWith('codex:') ? 'codex' : 'claude');

switch (cmd) {
  case 'scan':
    cmdScan();
    break;
  case 'show':
    cmdShow();
    break;
  case 'export':
    cmdExport();
    break;
  case 'verify':
    cmdVerify();
    break;
  default:
    console.log('用法：\n  scan [--source claude|codex] [--json]\n  show <id> [--thinking]\n  export <id> --blocks r1-q,r1-a [--filename x] [--dir d] [--ai]\n  verify <id>');
}

function cmdScan(): void {
  const manifest = loadManifest(manifestPath());
  let sessions =
    values.source === 'claude'
      ? scanClaude(claudeRoot(), manifest)
      : values.source === 'codex'
        ? scanCodex(codexRoot(), manifest)
        : scanAll({ claudeRoot: claudeRoot(), codexRoot: codexRoot(), manifest });

  sessions = sessions.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));

  if (values.json) {
    console.log(JSON.stringify(sessions, null, 2));
    return;
  }
  console.log(`共 ${sessions.length} 个会话\n`);
  const badge = { none: ' ', partial: '◐', full: '●' } as const;
  for (const s of sessions) {
    console.log(
      `${badge[s.exported]} [${s.source.padEnd(6)}] ${s.day}  轮${String(s.turnCount).padStart(3)}  ${s.title}`,
    );
  }
}

function cmdShow(): void {
  if (!id) return void console.error('需要 <id>');
  const source = sourceOf(id);
  const file = resolveSessionPath(id, source === 'claude' ? claudeRoot() : codexRoot(), source);
  if (!file) return void console.error(`未找到会话：${id}`);

  const { meta, rounds } = parseSessionFile(file, source, { includeThinking: values.thinking });
  console.log(`# ${meta.title}\n来源:${meta.source}  项目:${meta.project ?? '-'}  日期:${meta.day}  轮数:${rounds.length}\n`);
  for (const r of rounds) {
    console.log(`\n## 第 ${r.index} 轮 · 提问 [${r.question.id}]\n${r.question.text}`);
    console.log(`\n## 第 ${r.index} 轮 · 回复 [${r.answer.id}]\n${r.answer.text || '（无回复）'}`);
  }
}

function cmdExport(): void {
  if (!id) return void console.error('需要 <id>');
  if (!values.blocks) return void console.error('需要 --blocks r1-q,r1-a');
  const source = sourceOf(id);
  const file = resolveSessionPath(id, source === 'claude' ? claudeRoot() : codexRoot(), source);
  if (!file) return void console.error(`未找到会话：${id}`);

  const blockIds = values.blocks.split(',').map((s) => s.trim()).filter(Boolean);
  const { meta, rounds } = parseSessionFile(file, source);
  const md = buildMarkdown(meta, rounds, blockIds);

  const dir = values.dir ?? testExportDir();
  const filename = values.filename ?? meta.title.slice(0, 20);
  const out = writeExport(md, dir, filename);

  const manifest = loadManifest(manifestPath());
  recordExport(manifest, meta.id, {
    title: meta.title,
    exportedAt: new Date().toISOString(),
    file: out,
    blocks: blockIds,
    aiTidy: Boolean(values.ai),
  });
  saveManifest(manifestPath(), manifest);
  console.log(`已导出 → ${out}`);
}

function cmdVerify(): void {
  if (!id) return void console.error('需要 <id>');
  const source = sourceOf(id);
  const file = resolveSessionPath(id, source === 'claude' ? claudeRoot() : codexRoot(), source);
  if (!file) return void console.error(`未找到会话：${id}`);

  const rawCount = readJsonl(file).length;
  const off = parseSessionFile(file, source, { includeThinking: false });
  const on = parseSessionFile(file, source, { includeThinking: true });

  console.log(`会话 ${id}`);
  console.log(`  文件:        ${file}`);
  console.log(`  原始记录数:  ${rawCount}`);
  console.log(`  轮数:        ${off.rounds.length}`);
  console.log(`  标题:        ${off.meta.title}`);
  console.log(`  项目(cwd):   ${off.meta.project ?? '-'}`);
  console.log(`  日期:        ${off.meta.day}`);

  const firstQ = off.rounds[0]?.question.text ?? '';
  const wrapped = /^\s*<(environment_context|permissions|developer)/i.test(firstQ);
  console.log(`  首问是注入上下文? ${wrapped ? '是 ✗' : '否 ✓'}`);

  const offLen = off.rounds[0]?.answer.text.length ?? 0;
  const onLen = on.rounds[0]?.answer.text.length ?? 0;
  console.log(`  首轮回复长度 thinking off/on: ${offLen} / ${onLen}  ${onLen > offLen ? '(开关有效 ✓)' : ''}`);

  const exported = deriveBlockStatus(loadManifest(manifestPath()), id);
  console.log(`  已导出块:    ${exported.size ? [...exported].join(', ') : '（无）'}`);
}
