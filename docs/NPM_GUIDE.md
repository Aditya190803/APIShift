# NPM & Vercel AI SDK Guide

`@apishift/core` provides same-provider API key pooling for Vercel AI SDK models. The primary pattern is multiple model entries for one provider, each configured with a different API key/account. APIShift rotates across healthy keys first, cools down limited keys, and only uses fallback providers when the primary pool is unavailable.

## Installation

```bash
bun add @apishift/core ai @ai-sdk/google @ai-sdk/openai
```

## Basic Setup: Gemini Key Pool

Create one model entry per API key. Give entries from the same provider the same `provider` or `pool` value.

```typescript
import { APIShift } from '@apishift/core';
import { google } from '@ai-sdk/google';

const shift = new APIShift([
  {
    provider: 'gemini',
    keyIndex: 0,
    name: 'gemini-account-1',
    model: google('gemini-1.5-flash', { apiKey: process.env.GEMINI_KEY_1 }),
    free: true,
    priority: 10,
  },
  {
    provider: 'gemini',
    keyIndex: 1,
    name: 'gemini-account-2',
    model: google('gemini-1.5-flash', { apiKey: process.env.GEMINI_KEY_2 }),
    free: true,
    priority: 10,
  },
], {
  keyStrategy: 'adaptive',
  routingStrategy: 'same_provider_first',
  systemPrompt: 'Continue the same task even if the API key changes.',
});
```

## Add Cross-Provider Fallback

Fallback providers are secondary. APIShift tries available entries in the `gemini` pool before moving to `openai` or another provider.

```typescript
import { APIShift, JsonMemoryStore } from '@apishift/core';
import { google } from '@ai-sdk/google';
import { openai } from '@ai-sdk/openai';

const shift = new APIShift([
  {
    provider: 'gemini',
    keyIndex: 0,
    name: 'gemini-account-1',
    model: google('gemini-1.5-flash', { apiKey: process.env.GEMINI_KEY_1 }),
    free: true,
    priority: 10,
  },
  {
    provider: 'gemini',
    keyIndex: 1,
    name: 'gemini-account-2',
    model: google('gemini-1.5-flash', { apiKey: process.env.GEMINI_KEY_2 }),
    free: true,
    priority: 10,
  },
  {
    provider: 'openai',
    keyIndex: 0,
    name: 'openai-paid-fallback',
    model: openai('gpt-4o-mini', { apiKey: process.env.OPENAI_KEY }),
    free: false,
    priority: 100,
  },
], {
  keyStrategy: 'adaptive',
  routingStrategy: 'same_provider_first',
  memoryStore: new JsonMemoryStore('.apishift/memory.jsonl'),
});
```

## Key Strategies

- `adaptive` (default): use the least-used healthy key in the provider pool and skip keys that are cooling down.
- `round_robin`: spread requests by usage count across healthy keys.
- `sticky`: keep using the highest-priority entry until it is unavailable.

## Streaming with `streamMessage`

```typescript
const { textStream } = await shift.streamMessage(
  'Explain the event loop in Node.js'
);

for await (const chunk of textStream) {
  process.stdout.write(chunk);
}
```

For streaming, APIShift peeks for the first chunk. If a key fails before output starts, it can retry another key from the same pool with the same context. If a stream breaks after chunks were yielded, the error is surfaced to avoid duplicated output.

## Static Generation with `sendMessage`

```typescript
const { text } = await shift.sendMessage('What is the capital of France?');
console.log(text);
console.log(shift.lastRoute);
```

`lastRoute` includes safe routing telemetry:

```typescript
{
  name: 'gemini-account-2',
  provider: 'gemini',
  pool: 'gemini',
  keyIndex: 1,
  keyLabel: 'key-2',
  attempts: 1,
  availableKeys: 2,
  totalKeys: 2,
  keyStrategy: 'adaptive'
}
```

Raw API keys are never included in telemetry.

## Why use APIShift for JS?

Managing multiple same-provider API keys usually means repetitive `try/catch` blocks, cooldown bookkeeping, and context replay code. APIShift handles that layer:

- **Same-provider key pool first**: use all healthy keys in the primary provider pool before fallback.
- **Retry-aware cooldowns**: parse common retry/reset headers and pause only the failed key.
- **Context preservation**: `sendMessage` and `streamMessage` keep one canonical conversation.
- **Fallback when necessary**: use another provider only after the current provider pool is unavailable.
- **Type safety**: works with Vercel AI SDK parameters while omitting only the `model` parameter.
