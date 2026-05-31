from typing import Callable, Dict, List, Optional

Message = Dict[str, str]
TokenCounter = Callable[[str], int]


def approximate_token_count(text: str) -> int:
    """Fast dependency-free token estimate.

    Most chat routing decisions only need a conservative budget, not exact model
    tokenizer parity. This counts words plus punctuation pressure and generally
    lands close enough to avoid overflowing free-tier context windows.
    """
    if not text:
        return 0
    # 1 token ~= 4 chars is a common approximation; combine with whitespace so
    # short symbols/code do not get undercounted too aggressively.
    by_chars = (len(text) + 3) // 4
    by_words = len(text.split())
    return max(1, max(by_chars, by_words))


def message_token_count(message: Message, token_counter: TokenCounter = approximate_token_count) -> int:
    # Chat APIs have role/message framing overhead. Use 4 tokens/message as the
    # standard OpenAI-style estimate.
    return 4 + token_counter(message.get("role", "")) + token_counter(message.get("content", ""))


def pack_messages_to_token_budget(
    *,
    system_sections: List[str],
    messages: List[Message],
    max_context_tokens: Optional[int],
    token_counter: TokenCounter = approximate_token_count,
) -> List[Message]:
    """Pack system context plus newest messages into a token budget.

    Keeps the newest conversational turns first. If system context alone is too
    large, it is truncated from the left so the latest summary/retrieval text is
    retained.
    """
    if max_context_tokens is None or max_context_tokens <= 0:
        if not system_sections:
            return [message.copy() for message in messages]
        return [
            {"role": "system", "content": "\n\n".join(system_sections)},
            *[message.copy() for message in messages],
        ]

    budget = max_context_tokens
    packed_reversed: List[Message] = []
    used = 0

    system_content = "\n\n".join(section for section in system_sections if section)
    system_message: Optional[Message] = None
    if system_content:
        system_message = {"role": "system", "content": system_content}
        system_tokens = message_token_count(system_message, token_counter)
        if system_tokens > budget:
            # Keep the tail; summaries and retrieval sections are appended after
            # the static system prompt and are usually most relevant.
            approx_chars = max(200, budget * 4)
            system_message["content"] = system_content[-approx_chars:]
            system_tokens = message_token_count(system_message, token_counter)
        used += min(system_tokens, budget)

    for message in reversed(messages):
        tokens = message_token_count(message, token_counter)
        if used + tokens > budget:
            continue
        packed_reversed.append(message.copy())
        used += tokens

    packed = list(reversed(packed_reversed))
    if system_message:
        return [system_message, *packed]
    return packed
