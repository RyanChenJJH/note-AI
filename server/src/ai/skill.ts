// 载入「整理 skill」并拼成给模型的 system prompt（docs/15 §5.1）。
// 直连原生 API 无法让模型自己读文件，所以把 SKILL.md + type-selection + 全部模板内联进 system prompt。
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

export interface LoadedSkill {
  systemPrompt: string;
  root: string; // skill 根目录（含 SKILL.md）
}

/** 强化输出契约的前言（SKILL.md 自身也写了，这里再钉一遍，确保后端能稳定切块）。 */
const HEADER = [
  '你是「AI 对话 → 知识笔记」整理助手。下面是你必须严格遵循的 SKILL 指令与参考资料',
  '（知识类型判定指南 + 全部笔记模板）。请完全按 SKILL.md 的工作流、取舍标准与输出契约执行。',
  '',
  '【输出契约 · 最重要，必须遵守】',
  '- 只输出哨兵分隔块，块内是原始 Markdown，一个字都不要转义，不要包在代码块里，不要任何前言/解释/JSON。',
  '- 每篇笔记的格式：',
  '  <<<NOTE filename="YYYYMMDD-类型-主题.md">>>',
  '  （整篇 md 原文，含它自己的 frontmatter）',
  '  <<<END NOTE>>>',
  '- 多篇就连续输出多个块，块之间空一行。',
  '- 若整份对话没有够格沉淀的知识，只输出一行：<<<NO NOTES: 原因>>>。',
  '- 正文里不要出现 <<<END NOTE>>> 这串字符。',
  '',
  '下面是 SKILL 全文与参考资料：',
].join('\n');

/**
 * 载入 skill，拼出 system prompt。
 * skillPath 直接含 SKILL.md 则用之；否则向下浅搜（≤3 层）取最浅的 SKILL.md
 * （兼容把 skillPath 配成父目录，如 my_personal_skill）。
 * 读不到 SKILL.md → 抛错，由 tidy() 捕获转 degraded。
 */
export function loadSkill(skillPath: string): LoadedSkill {
  const skillMd = findSkillMd(skillPath);
  if (!skillMd) throw new Error(`未找到 SKILL.md（路径：${skillPath}）`);
  const root = dirname(skillMd);

  const parts: string[] = [HEADER];
  parts.push(section('SKILL.md', stripFrontMatter(readFileSync(skillMd, 'utf8'))));

  const typeSel = join(root, 'references', 'type-selection.md');
  if (existsSync(typeSel)) {
    parts.push(section('references/type-selection.md', readFileSync(typeSel, 'utf8')));
  }

  const tplDir = join(root, 'references', 'templates');
  if (existsSync(tplDir)) {
    for (const f of readdirSync(tplDir).filter((n) => n.toLowerCase().endsWith('.md')).sort()) {
      parts.push(section(`references/templates/${f}`, readFileSync(join(tplDir, f), 'utf8')));
    }
  }

  return { systemPrompt: parts.join('\n\n'), root };
}

function section(name: string, body: string): string {
  return `===== ${name} =====\n${body.trim()}`;
}

/** 去掉 SKILL.md 给 Claude Code 用的 YAML frontmatter（name/description），只留正文。 */
function stripFrontMatter(md: string): string {
  if (!md.startsWith('---')) return md;
  const end = md.indexOf('\n---', 3);
  if (end === -1) return md;
  const nl = md.indexOf('\n', end + 1);
  return nl === -1 ? '' : md.slice(nl + 1).trimStart();
}

/** 定位 SKILL.md：先看 skillPath 本身，再按层级向下浅搜（≤maxDepth 层），取最浅的。 */
function findSkillMd(skillPath: string, maxDepth = 3): string | undefined {
  const direct = join(skillPath, 'SKILL.md');
  if (existsSync(direct)) return direct;

  let frontier = [skillPath];
  for (let depth = 0; depth < maxDepth && frontier.length; depth++) {
    const next: string[] = [];
    for (const dir of frontier) {
      let entries;
      try {
        entries = readdirSync(dir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const e of entries) {
        if (e.isFile() && e.name === 'SKILL.md') return join(dir, 'SKILL.md');
      }
      for (const e of entries) {
        if (e.isDirectory() && e.name !== 'node_modules') next.push(join(dir, e.name));
      }
    }
    frontier = next;
  }
  return undefined;
}
