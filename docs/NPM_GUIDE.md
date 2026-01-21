# NPM & Vercel AI SDK Guide

`@apishift/core` provides a lightweight, TypeScript-native orchestration layer that integrates perfectly with the [Vercel AI SDK](https://sdk.vercel.ai/).

## Installation

```bash
npm install @apishift/core ai @ai-sdk/google @ai-sdk/openai
```

## Basic Setup

The `APIShift` class takes an array of `LanguageModelV1` instances (from any Vercel AI SDK provider). It will attempt to use them in order, failing over if one returns a `429 Too Many Requests` error.

```typescript
import { APIShift } from '@apishift/core';
import { google } from '@ai-sdk/google';
import { openai } from '@ai-sdk/openai';

const orchestrator = new APIShift([
  google('gemini-1.5-flash'), // Primary
  google('gemini-1.5-pro'),   // Fallback 1
  openai('gpt-4o-mini'),      // Fallback 2
]);
```

## Streaming with `streamText`

Use `orchestrator.streamText` exactly like you would use the standard `streamText` function, but omit the `model` parameter in the arguments.

```typescript
const { textStream } = await orchestrator.streamText({
  messages: [
    { role: 'user', content: 'Explain the event loop in Node.js' }
  ],
});

for await (const chunk of textStream) {
  process.stdout.write(chunk);
}
```

## Static Generation with `generateText`

Similarly, use `generateText` for non-streaming responses:

```typescript
const { text } = await orchestrator.generateText({
  prompt: 'What is the capital of France?',
});

console.log(text);
```

## Why use APIShift for JS?

While the Vercel AI SDK provides powerful primitives, managing multiple API keys and fallback logic usually requires writing repetitive `try/catch` blocks. 

APIShift abstracts this away:
- **Sequential Failover**: It tries models in the order you provide them.
- **Smart Detection**: It specifically looks for rate-limit headers and status codes to decide when to failover vs when to throw an error.
- **Type Safety**: Fully written in TypeScript with complete IDE autocompletion for SDK parameters.

## Advanced: Dynamic Fallbacks

Since you pass instances of models, you can configure different settings for each:

```typescript
const orchestrator = new APIShift([
  google('gemini-1.5-flash', { safetySettings: [...] }),
  openai('gpt-4o', { user: 'user_123' }),
]);
```
