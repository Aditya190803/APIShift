import type { APIShiftMessage } from './types';

export function approximateTokenCount(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.max(Math.ceil(text.length / 4), text.trim().split(/\s+/).filter(Boolean).length));
}

export function normalizeMessageContent(content: APIShiftMessage['content']): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part: any) => {
        if (typeof part === 'string') return part;
        if (typeof part?.text === 'string') return part.text;
        if (typeof part?.content === 'string') return part.content;
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }
  return String(content ?? '');
}

export function messageTokenCount(
  message: APIShiftMessage,
  tokenCounter: (text: string) => number = approximateTokenCount,
): number {
  return 4 + tokenCounter(message.role) + tokenCounter(normalizeMessageContent(message.content));
}

export function packMessagesToTokenBudget(options: {
  systemSections: string[];
  messages: APIShiftMessage[];
  maxContextTokens?: number;
  tokenCounter?: (text: string) => number;
}): APIShiftMessage[] {
  const tokenCounter = options.tokenCounter ?? approximateTokenCount;
  const maxContextTokens = options.maxContextTokens;
  const systemContent = options.systemSections.filter(Boolean).join('\n\n');

  if (!maxContextTokens || maxContextTokens <= 0) {
    return systemContent
      ? ([{ role: 'system', content: systemContent }, ...options.messages] as APIShiftMessage[])
      : [...options.messages];
  }

  let used = 0;
  let systemMessage: APIShiftMessage | undefined;
  if (systemContent) {
    systemMessage = { role: 'system', content: systemContent } as APIShiftMessage;
    let tokens = messageTokenCount(systemMessage, tokenCounter);
    if (tokens > maxContextTokens) {
      systemMessage = { role: 'system', content: systemContent.slice(-Math.max(200, maxContextTokens * 4)) } as APIShiftMessage;
      tokens = messageTokenCount(systemMessage, tokenCounter);
    }
    used += Math.min(tokens, maxContextTokens);
  }

  const packed: APIShiftMessage[] = [];
  for (const message of [...options.messages].reverse()) {
    const tokens = messageTokenCount(message, tokenCounter);
    if (used + tokens > maxContextTokens) continue;
    packed.push(message);
    used += tokens;
  }

  packed.reverse();
  return systemMessage ? [systemMessage, ...packed] : packed;
}
