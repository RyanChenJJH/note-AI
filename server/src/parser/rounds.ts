import type { NormalizedMessage, Round } from '../types.ts';

interface DraftRound {
  index: number;
  question: string;
  answerParts: string[];
}

/**
 * 归一化消息流 → Round[]（docs/03 §C 分轮算法）。
 * 遇真人提问开新轮，其后 AI 文字回复并入当前轮。
 */
export function splitRounds(messages: NormalizedMessage[]): Round[] {
  // 先按 timestamp 升序（稳定排序：同 ts 保持原顺序，提问先于回复）。
  const ordered = [...messages].sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));

  const rounds: Round[] = [];
  let current: DraftRound | null = null;

  for (const msg of ordered) {
    if (msg.type === 'question') {
      if (current) rounds.push(finalize(current));
      current = { index: rounds.length + 1, question: msg.text, answerParts: [] };
    } else if (msg.type === 'answer' && current) {
      current.answerParts.push(msg.text);
    }
  }
  if (current) rounds.push(finalize(current));
  return rounds;
}

function finalize(c: DraftRound): Round {
  return {
    index: c.index,
    question: { id: `r${c.index}-q`, text: c.question, exported: false },
    answer: { id: `r${c.index}-a`, text: c.answerParts.join('\n\n'), exported: false },
  };
}
