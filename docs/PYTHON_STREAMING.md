# Python Streaming Guide

APIShift streams LLM responses while prioritizing same-provider API key pools. If one key hits a rate limit or quota window before output begins, APIShift cools down that key and retries another key in the same provider pool before falling back to another provider.

## Basic Streaming with a Key Pool

```python
from APIShift import Conversation

conversation = Conversation.from_gemini_key_pool(
    api_keys=["gemini_key_1", "gemini_key_2", "gemini_key_3"],
    key_strategy="adaptive",
    memory_path=".apishift/memory.jsonl",
)

for chunk in conversation.send_message_stream("Tell me a story."):
    print(chunk, end="", flush=True)
```

## How Streaming Failover Works

Streaming failover is trickier than normal requests because data might already have been sent to the user. APIShift uses a peeking strategy:

1. **Choose a key from the current provider pool**: default `adaptive` routing picks a healthy, least-used key.
2. **Start the stream**: APIShift sends the compiled conversation context to that key.
3. **Peek the first chunk**: if the key fails before output starts, APIShift cools down that key using retry headers when available.
4. **Retry same provider first**: another healthy key in the same provider pool is tried before any provider fallback.
5. **Yield data**: once the first chunk is yielded, APIShift will not silently restart on another key, because that could duplicate or garble output.

## Same Provider First, Fallback Provider Second

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

for chunk in conversation.send_message_stream("Write a long essay."):
    print(chunk, end="")
```

In this example, OpenRouter is only attempted after the Gemini key pool has no currently available keys.

## Key Strategies

- `adaptive` (default): prefer the least-used healthy key and skip cooling-down keys.
- `round_robin`: advance to the next healthy key after each successful request.
- `sticky`: keep using the current key until it is unavailable.

```python
conversation = Conversation(
    [GeminiProvider(["key_1", "key_2"])],
    key_strategy="round_robin",
)
```

## Context Preservation Across Key and Provider Shifts

APIShift keeps a canonical history in `Conversation.history`. Before each provider call it compiles:

- the optional `system_prompt`
- a compact summary of trimmed older messages
- recent conversation messages
- optional FAISS-retrieved remembered snippets

That compiled message list is sent to every key/provider attempted for the same user request, so a retry continues the same task.

```python
conversation = Conversation(
    [GeminiProvider(["key_1", "key_2"]), OpenRouterProvider(["key_3"])],
    system_prompt="You are continuing the same coding task across key shifts.",
    max_history_length=20,
)
```

## Inspect Routing

```python
response = conversation.send_message("Continue")
print(conversation.last_route)
```

Example:

```python
{
    "provider": "GeminiProvider",
    "model": "gemini-1.5-flash",
    "key_index": 1,
    "key_label": "key-2",
    "available_keys": 2,
    "total_keys": 3,
    "key_strategy": "adaptive",
    "attempts": 2,
}
```

Raw API keys are never exposed in telemetry.

## Advanced: Combining with RAG (FAISS)

Even when streaming, APIShift automatically indexes your messages in FAISS if the dependencies are installed.

```python
conversation.add_to_faiss("The secret password is 'Swordfish'")

for chunk in conversation.send_message_stream("What is the secret password?"):
    print(chunk, end="")
```

## Configuration

You can pass standard generation parameters to the stream:

```python
stream = conversation.send_message_stream(
    "Hello",
    temperature=0.7,
    max_tokens=500,
)
```
