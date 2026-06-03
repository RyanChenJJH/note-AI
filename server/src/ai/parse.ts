// 解析模型输出的哨兵分隔块（docs/15 §5.3）。skill 契约见 docs/15 §2。
// 输出形如：<<<NOTE filename="...">>> …整篇 md… <<<END NOTE>>>（多篇连排）；
// 或单行 <<<NO NOTES: 原因>>>。容错：剥外层误包的代码围栏、文件名缺引号兜底。

export interface TidyNote {
  filename: string; // 笔记文件名（含 .md），由模型按 YYYYMMDD-类型-主题 命名
  content: string; // 整篇 md 原文（含各自 frontmatter），不再套 AIDA 对话 frontmatter
}

export interface ParseResult {
  notes: TidyNote[];
  noNotes?: string; // 命中 <<<NO NOTES: 原因>>> 时的原因（notes 为空）
}

const NOTE_RE = /<<<NOTE\s+filename\s*=\s*"?([^"\n>]+?)"?\s*>>>([\s\S]*?)<<<END\s+NOTE>>>/g;
const NO_NOTES_RE = /<<<NO\s+NOTES:\s*([\s\S]*?)>>>/;

export function parseNotes(raw: string): ParseResult {
  const text = stripOuterFence(raw ?? '');

  const notes: TidyNote[] = [];
  for (const m of text.matchAll(NOTE_RE)) {
    const filename = sanitizeName((m[1] ?? '').trim());
    const content = (m[2] ?? '').trim();
    if (content) notes.push({ filename, content });
  }
  if (notes.length) return { notes };

  const noNotes = NO_NOTES_RE.exec(text);
  if (noNotes) return { notes: [], noNotes: (noNotes[1] ?? '').trim() };

  return { notes: [] }; // 既无 NOTE 块也无 NO NOTES → 让 tidy() 视为「无法解析」降级
}

/** 文件名兜底 + 补 .md（最终写盘时 exporter.writeExport 还会净化非法字符）。 */
function sanitizeName(name: string): string {
  const base = name.replace(/\.md$/i, '').trim();
  return `${base || 'untitled'}.md`;
}

/** 模型偶尔把整段输出误包进 ```代码围栏```；仅当「整段」被包时剥掉，避免误伤笔记内部的代码块。 */
function stripOuterFence(s: string): string {
  const t = s.trim();
  if (!t.startsWith('```')) return t;
  const firstNl = t.indexOf('\n');
  const lastFence = t.lastIndexOf('```');
  if (firstNl !== -1 && lastFence > firstNl) return t.slice(firstNl + 1, lastFence).trim();
  return t;
}
