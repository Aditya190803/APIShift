from typing import Dict, Iterator, List

from APIShift import Conversation
from APIShift.exceptions import RateLimitError
from APIShift.providers import LLMProvider


class KeyAwareProvider(LLMProvider):
    def __init__(self, keys: List[str], *, fail_keys=None, name="gemini"):
        super().__init__(keys, name=name, priority=10)
        self.fail_keys = set(fail_keys or [])
        self.calls: List[str] = []

    def generate_response(self, messages: List[Dict[str, str]], **kwargs) -> str:
        key = self.current_api_key
        self.calls.append(key)
        if key in self.fail_keys:
            raise RateLimitError(self.name)
        return f"response via {self.name}:{key}"

    def generate_stream(self, messages: List[Dict[str, str]], **kwargs) -> Iterator[str]:
        yield self.generate_response(messages, **kwargs)

    def _detect_rate_limit(self, response):
        return False

    def _detect_quota_exceeded(self, response):
        return False


def test_adaptive_key_pool_spreads_successes_inside_same_provider():
    provider = KeyAwareProvider(["key-1", "key-2", "key-3"])
    conversation = Conversation([provider], key_strategy="adaptive")

    conversation.send_message("one")
    conversation.send_message("two")
    conversation.send_message("three")

    assert provider.calls == ["key-1", "key-2", "key-3"]
    assert conversation.last_route["provider"] == "gemini"
    assert conversation.last_route["total_keys"] == 3
    assert conversation.last_route["key_strategy"] == "adaptive"


def test_same_provider_key_pool_is_exhausted_before_cross_provider_fallback():
    gemini = KeyAwareProvider(["g-key-1", "g-key-2"], fail_keys={"g-key-1"}, name="gemini")
    openrouter = KeyAwareProvider(["or-key-1"], name="openrouter")
    conversation = Conversation([gemini, openrouter], key_strategy="adaptive")

    response = conversation.send_message("continue")

    assert response == "response via gemini:g-key-2"
    assert gemini.calls == ["g-key-1", "g-key-2"]
    assert openrouter.calls == []
    assert conversation.last_route["provider"] == "gemini"
    assert conversation.last_route["key_index"] == 1


def test_cross_provider_fallback_happens_after_provider_pool_is_blocked():
    gemini = KeyAwareProvider(
        ["g-key-1", "g-key-2"], fail_keys={"g-key-1", "g-key-2"}, name="gemini"
    )
    openrouter = KeyAwareProvider(["or-key-1"], name="openrouter")
    conversation = Conversation([gemini, openrouter], key_strategy="adaptive")

    response = conversation.send_message("continue")

    assert response == "response via openrouter:or-key-1"
    assert gemini.calls == ["g-key-1", "g-key-2"]
    assert openrouter.calls == ["or-key-1"]
    assert conversation.last_route["provider"] == "openrouter"
