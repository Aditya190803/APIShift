# APIShift

[![NPM Version](https://img.shields.io/npm/v/@apishift/core)](https://www.npmjs.com/package/@apishift/core)
[![PyPI Version](https://img.shields.io/pypi/v/APIShift)](https://pypi.org/project/APIShift/)

**APIShift** is a universal LLM orchestration layer designed for high reliability and cost-efficiency. It provides "Smart Failover" capabilities across multiple free-tier and paid LLM providers, ensuring your applications stay online even when individual providers hit rate limits.

Available for both **Python** and **TypeScript/Node.js**.

## Core Value Propositions

-   **🚀 Smart Failover**: Automatically switches to the next available provider or API key when encountering 429 (Rate Limit) or 503 errors.
-   **💰 Cost Optimization**: Seamlessly rotate through free-tier keys before hitting paid endpoints.
-   **⚡ Native Streaming**: High-performance streaming support for both Python and Vercel AI SDK (TS).
-   **🧠 Integrated RAG**: Built-in FAISS support for Python to handle context retrieval effortlessly.

---

## 🐍 Python Quick Start

### Installation

```bash
pip install APIShift
```

### Basic Usage

```python
from APIShift import Conversation, GeminiProvider, OpenRouterProvider

# Initialize with multiple keys for failover
conversation = Conversation([
    GeminiProvider(['key_1', 'key_2']),
    OpenRouterProvider(['key_a'])
])

# Regular response
response = conversation.send_message("Explain quantum computing.")
print(response)

# Streaming response (with auto-failover)
for chunk in conversation.send_message_stream("Write a poem."):
    print(chunk, end="", flush=True)
```

[See Python Streaming Guide →](./docs/PYTHON_STREAMING.md)

---

## 📦 NPM Quick Start

### Installation

```bash
npm install @apishift/core ai @ai-sdk/google @ai-sdk/openai
```

### Vercel AI SDK Integration

APIShift for JS is designed to work as a drop-in orchestrator for the [Vercel AI SDK](https://sdk.vercel.ai/).

```typescript
import { APIShift } from '@apishift/core';
import { google } from '@ai-sdk/google';
import { openai } from '@ai-sdk/openai';

const orchestrator = new APIShift([
  google('gemini-1.5-flash'),
  openai('gpt-4o-mini')
]);

const { textStream } = await orchestrator.streamText({
  prompt: 'Write a technical blog post about edge computing.',
});

for await (const chunk of textStream) {
  process.stdout.write(chunk);
}
```

[See NPM & Vercel AI SDK Guide →](./docs/NPM_GUIDE.md)

---

## 📂 Monorepo Structure

-   `/APIShift`: Core Python library source code.
-   `/js`: TypeScript library source code (`@apishift/core`).
-   `/docs`: Detailed implementation guides and API references.
-   `/tests`: Comprehensive test suites for both implementations.

## License

MIT
