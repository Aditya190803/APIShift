import os

import pytest

from APIShift import Conversation, OpenRouterProvider


@pytest.mark.live
@pytest.mark.skipif(
    not os.getenv("APISHIFT_OPENROUTER_API_KEY"),
    reason="Set APISHIFT_OPENROUTER_API_KEY to run live OpenRouter integration tests.",
)
def test_live_openrouter_free_model_context_roundtrip():
    conversation = Conversation(
        [OpenRouterProvider([os.environ["APISHIFT_OPENROUTER_API_KEY"]])],
        system_prompt="Answer briefly for an integration smoke test.",
        enable_rag=False,
        max_context_tokens=1000,
    )

    response = conversation.send_message("Reply with exactly: apishift-live-ok", max_tokens=20)

    assert "apishift-live-ok" in response.lower()
    assert conversation.last_route["provider"] == "OpenRouterProvider"


@pytest.mark.live
@pytest.mark.skipif(
    not os.getenv("APISHIFT_OPENROUTER_API_KEY"),
    reason="Set APISHIFT_OPENROUTER_API_KEY to run live OpenRouter integration tests.",
)
def test_live_openrouter_streaming_smoke():
    conversation = Conversation(
        [OpenRouterProvider([os.environ["APISHIFT_OPENROUTER_API_KEY"]])],
        enable_rag=False,
        max_context_tokens=1000,
    )

    chunks = list(conversation.send_message_stream("Say hello in one short sentence.", max_tokens=30))

    assert "".join(chunks).strip()
