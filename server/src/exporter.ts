import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Round, SessionMeta } from './types.ts';

export interface BuildOptions {
  exportedAt?: string; // ISO 时间，默认当前本地时间
  tags?: string[]; // 默认 [AI对话, <source>]
}

/**
 * 拼正文（不含 front matter）：只含勾选块；按轮升序、提问在回复前；正文原样保留。
 * 返回正文字符串与涉及的轮号（供 front matter 的 rounds 字段）。
 */
export function buildBody(
  rounds: Round[],
  blockIds: string[],
): { body: string; involvedRounds: number[] } {
  const selected = new Set(blockIds);
  const involvedRounds: number[] = [];
  const sections: string[] = [];

  for (const round of rounds) {
    let touched = false;
    if (selected.has(round.question.id)) {
      sections.push(`## 第 ${round.index} 轮 · 提问\n\n${round.question.text}`);
      touched = true;
    }
    if (selected.has(round.answer.id)) {
      sections.push(`## 第 ${round.index} 轮 · 回复\n\n${round.answer.text}`);
      touched = true;
    }
    if (touched) involvedRounds.push(round.index);
  }

  return { body: sections.join('\n\n'), involvedRounds };
}

/** 生成 YAML front matter（docs/05 §3）。 */
export function buildFrontMatter(
  meta: SessionMeta,
  involvedRounds: number[],
  opts: BuildOptions = {},
): string {
  const exportedAt = opts.exportedAt ?? localISONow();
  const tags = opts.tags ?? ['AI对话', meta.source];
  return [
    '---',
    `title: ${yamlString(meta.title)}`,
    `source: ${meta.source}`,
    `session_id: ${yamlString(meta.sessionId)}`,
    `project: ${yamlString((meta.project ?? '').replace(/\\/g, '/'))}`,
    `date: ${meta.day}`,
    `exported_at: ${exportedAt}`,
    `rounds: [${involvedRounds.join(', ')}]`,
    `tags: [${tags.join(', ')}]`,
    '---',
  ].join('\n');
}

/**
 * 把选中的块拼成带 YAML front matter 的 Markdown（docs/05 §3）。
 * = buildFrontMatter + buildBody 组合（输出与历史逐字一致）。
 */
export function buildMarkdown(
  meta: SessionMeta,
  rounds: Round[],
  blockIds: string[],
  opts: BuildOptions = {},
): string {
  const { body, involvedRounds } = buildBody(rounds, blockIds);
  return `${buildFrontMatter(meta, involvedRounds, opts)}\n\n${body}\n`;
}

/**
 * 把内容写入导出目录，返回最终绝对路径。
 * 目录不存在自动创建；文件名净化非法字符并补 .md；同名追加 (2)/(3)…（docs/05 §2）。
 */
export function writeExport(content: string, dir: string, filename: string): string {
  mkdirSync(dir, { recursive: true });
  const target = resolveTarget(dir, filename);
  writeFileSync(target, content, 'utf8');
  return target;
}

function resolveTarget(dir: string, filename: string): string {
  const base = filename.replace(/\.md$/i, '').replace(/[\\/:*?"<>|]/g, '-').trim() || 'untitled';
  let candidate = join(dir, `${base}.md`);
  for (let n = 2; existsSync(candidate); n++) {
    candidate = join(dir, `${base} (${n}).md`);
  }
  return candidate;
}

/** YAML 双引号字符串，转义内部双引号与反斜杠。 */
function yamlString(s: string): string {
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/** 当前时间的本地 ISO（带时区偏移，如 +08:00），用于 exported_at。 */
function localISONow(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const oh = pad(Math.floor(Math.abs(off) / 60));
  const om = pad(Math.abs(off) % 60);
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${oh}:${om}`
  );
}
