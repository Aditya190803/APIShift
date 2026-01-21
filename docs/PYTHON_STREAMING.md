# Python Streaming Guide

APIShift provides a robust way to handle streaming responses from LLMs with built-in auto-failover and key rotation.

## Basic Streaming

The `send_message_stream` method returns an iterator that yields string chunks as they arrive from the provider.

```python
from APIShift import Conversation, OpenRouterProvider

conversation = Conversation([
    OpenRouterProvider(['your_api_key'])
])

# Use the stream
for chunk in conversation.send_message_stream("Tell me a story."):
    print(chunk, end="", flush=True)
```

## How Auto-Failover Works in Streaming

Streaming failover is trickier than standard requests because data might already have been sent to the user before an error occurs. APIShift handles this using a "Peeking" strategy:

1.  **Start Request**: APIShift initiates the stream with the current provider.
2.  **Initial Validation**: It attempts to retrieve the *first chunk* from the stream.
3.  **Failover Catch**: If the first chunk retrieval fails (due to Rate Limit, Quota, or Connection issues), APIShift catches the exception, switches to the next provider/key, and restarts the process.
4.  **Data Flow**: Once the first chunk is successfully retrieved, it is yielded to the user. From this point on, if the stream breaks, the error is raised to the application (since partial data has already been consumed).

## Example: Failover across Multiple Keys

```python
from APIShift import Conversation, GeminiProvider

# If key_1 hits a rate limit, APIShift will automatically 
# try key_2 before yielding any data to the user.
conversation = Conversation([
    GeminiProvider(['key_1', 'key_2'])
])

try:
    for chunk in conversation.send_message_stream("Write a long essay."):
        print(chunk, end="")
except Exception as e:
    print(f"\nStream interrupted: {e}")
```

## Advanced: Combining with RAG (FAISS)

Even when streaming, APIShift automatically indexes your messages in FAISS if the dependencies are installed.

```python
conversation.add_to_faiss("The secret password is 'Swordfish'")

# The orchestrator can use this context in future calls
for chunk in conversation.send_message_stream("What is the secret password?"):
    print(chunk, end="")
```

## Configuration

You can pass standard generation parameters to the stream:

```python
stream = conversation.send_message_stream(
    "Hello",
    temperature=0.7,
    max_tokens=500
)
```
