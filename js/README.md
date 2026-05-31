# APIShift

[![NPM Version](https://img.shields.io/npm/v/@apishift/core)](https://www.npmjs.com/package/@apishift/core)
[![PyPI Version](https://img.shields.io/pypi/v/APIShift)](https://pypi.org/project/APIShift/)

**APIShift** is a same-provider API key pool for LLM apps. Put multiple API keys/accounts for one provider, such as Gemini, into a managed pool. APIShift rotates across healthy keys, cools down keys that hit rate limits or quota windows, preserves task context, and only falls back to another provider when the primary provider pool is unavailable.

Available for **Python** and **TypeScript/Node.js**.

> Use APIShift with API keys and accounts you are authorized to use. It helps coordinate legitimate quota windows and retry behavior, not bypass provider terms.

## Core Value Propositions

- **🔑 Same-Provider Key Pools First**: Treat multiple keys/accounts from one provider as the primary capacity pool.
- **🧭 Adaptive Key Rotation**: Prefer healthy, least-used keys; respect per-key cooldowns from `Retry-After` and rate-limit reset headers.
- **🧱 Provider Pool Exhaustion Before Fallback**: Try every available key in the current provider pool before shifting to another provider.
- **🧠 Context-Preserving Shifts**: Maintains one canonical conversation so a different key or fallback provider receives the same task context.
- **⚡ Native Streaming**: Streaming support for Python and Vercel AI SDK, including pre-yield failover before tokens reach the client.
- **💾 Persistent Memory**: Optional JSONL memory stores for Python and Node so context survives process restarts.
- **📏 Token-Aware Packing**: Packs system prompt, summary, retrieval, and recent turns into a configurable context budget.
- **🔎 Optional Cross-Provider Fallback**: OpenRouter, Groq, and other providers can be used after the primary pool is cooling down.

## Routing Model

APIShift routes in this order by default:

```text
request
  → primary provider pool, for example Gemini
      → account/key 1
      → account/key 2
      → account/key 3
  → fallback provider pool, for example OpenRouter
      → account/key 1
```

Default key strategy is `adaptive`: keys that are cooling down are skipped, healthy keys are spread by usage count, and retry hints from providers are honored. You can also choose `round_robin` or `sticky` in Python, and `round_robin` or `sticky` in TypeScript.

---

## 🐍 Python Quick Start

### Installation

```bash
pip install APIShift
```

### Primary Use: One Provider, Many Keys

```python
from APIShift import Conversation

conversation = Conversation.from_gemini_key_pool(
    api_keys=["gemini_account_1_key", "gemini_account_2_key", "gemini_account_3_key"],
    key_strategy="adaptive",
    system_prompt="Keep task context when switching API keys.",
    memory_path=".apishift/memory.jsonl",
)

for chunk in conversation.send_message_stream("Write a long implementation plan."):
    print(chunk, end="", flush=True)

print(conversation.last_route)
# {'provider': 'GeminiProvider', 'key_label': 'key-2', 'available_keys': 3, ...}
```

### Same Provider First, Cross-Provider If Necessary

```python
from APIShift import Conversation, GeminiProvider, OpenRouterProvider

conversation = Conversation(
    [
        GeminiProvider(["gemini_key_1", "gemini_key_2", "gemini_key_3"]),
        OpenRouterProvider(["openrouter_key_1"]),
    ],
    key_strategy="adaptive",
    system_prompt="Continue the same task even if APIShift changes keys/providers.",
)

response = conversation.send_message("Explain quantum computing.")
print(response)
```

### Free/Fallback Provider Helper

```python
conversation = Conversation.from_free_providers(
    gemini_keys=["gemini_key_1", "gemini_key_2"],
    openrouter_keys=["openrouter_key_1"],
    discover_openrouter_models=True,
    groq_keys=["groq_key_1"],
    key_strategy="adaptive",
    memory_path=".apishift/memory.jsonl",
    max_context_tokens=6000,
)
```

[See Python Streaming Guide →](./docs/PYTHON_STREAMING.md)

---

## 📦 NPM Quick Start

### Installation

```bash
bun add @apishift/core ai @ai-sdk/google @ai-sdk/openai
```

### Vercel AI SDK Integration

Create one model entry per API key/account and give entries from the same provider the same `provider` or `pool` value.

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
    name: 'openai-fallback',
    model: openai('gpt-4o-mini', { apiKey: process.env.OPENAI_KEY }),
    free: false,
    priority: 100,
  },
], {
  keyStrategy: 'adaptive',
  routingStrategy: 'same_provider_first',
  systemPrompt: 'Keep task context when switching keys or providers.',
  memoryStore: new JsonMemoryStore('.apishift/memory.jsonl'),
  maxContextTokens: 6000,
});

const { textStream } = await shift.streamMessage(
  'Write a technical blog post about edge computing.'
);

for await (const chunk of textStream) {
  process.stdout.write(chunk);
}

console.log(shift.lastRoute);
```

[See NPM & Vercel AI SDK Guide →](./docs/NPM_GUIDE.md)

---

## 📂 Monorepo Structure

- `/APIShift`: Core Python library source code.
- `/js`: TypeScript library source code (`@apishift/core`).
- `/docs`: Detailed implementation guides and API references.
- `/tests`: Python test suite.
- `/site`: Landing page.

## License

MIT
