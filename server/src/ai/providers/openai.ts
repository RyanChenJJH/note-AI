// OpenAI 兼容 provider：POST {baseUrl}/chat/completions + Bearer（docs/06 §2 表、docs/15 §5.2）。
// 覆盖 OpenAI / DeepSeek / 通义 / Kimi / 智谱 等。
import type { AiConfig } from '../../types.ts';
import type { ChatMessage, ChatProvider } from '../provider.ts';

interface OpenAiChatResponse {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
}

export const openaiCompatible: ChatProvider = {
  async chat(messages: ChatMessage[], cfg: AiConfig, signal: AbortSignal): Promise<string> {
    const url = `${stripTrailingSlash(cfg.baseUrl)}/chat/completions`;
    const res = await fetch(url, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        messages,
        temperature: cfg.temperature,
        stream: false,
      }),
    });

    if (!res.ok) {
      const detail = await safeErrMessage(res);
      throw new Error(`模型接口返回 ${res.status}${detail ? `：${detail}` : ''}`);
    }

    const data = (await res.json()) as OpenAiChatResponse;
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new Error('模型返回为空');
    }
    return content;
  },
};

function stripTrailingSlash(u: string): string {
  return u.replace(/\/+$/, '');
}

async function safeErrMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as OpenAiChatResponse;
    return body.error?.message ?? '';
  } catch {
    return '';
  }
}
