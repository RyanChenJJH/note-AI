// provider 无关的对话接口（docs/15 §5.2）。v1 实现 openai-compatible；anthropic/ollama 同形 stub。
import type { AiConfig, AiProvider } from '../types.ts';
import { openaiCompatible } from './providers/openai.ts';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatProvider {
  /** 发一轮对话，返回模型纯文本输出；非 2xx / 空 / 网络错误抛异常（由 tidy 捕获降级）。 */
  chat(messages: ChatMessage[], cfg: AiConfig, signal: AbortSignal): Promise<string>;
}

export function getProvider(p: AiProvider): ChatProvider {
  switch (p) {
    case 'openai-compatible':
      return openaiCompatible;
    case 'anthropic':
      return notImplemented('anthropic');
    case 'ollama':
      return notImplemented('ollama');
    default:
      return notImplemented(String(p));
  }
}

/** 未实现的 provider：调用即报错（后续迭代按同一 ChatProvider 形状补；docs/06 §5）。 */
function notImplemented(name: string): ChatProvider {
  return {
    chat() {
      return Promise.reject(new Error(`provider「${name}」暂未实现（见 docs/06 §5 后续迭代）`));
    },
  };
}
