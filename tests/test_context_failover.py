from typing import Dict, Iterator, List

from APIShift import Conversation
from APIShift.exceptions import RateLimitError
from APIShift.providers import LLMProvider


class CapturingProvider(LLMProvider):
    def __init__(self, name: str, api_keys: List[str], *, fail: bool = False):
        super().__init__(api_keys, name=name)
        self.fail = fail
        self.received_messages: List[List[Dict[str, str]]] = []

    def generate_response(self, messages: List[Dict[str, str]], **kwargs) -> str:
        self.received_messages.append(messages)
        if self.fail:
            raise RateLimitError(self.name)
        return f"response from {self.name}"

    def generate_stream(self, messages: List[Dict[str, str]], **kwargs) -> Iterator[str]:
        self.received_messages.append(messages)
        if self.fail:
            raise RateLimitError(self.name)
        yield f"response from {self.name}"

    def _detect_rate_limit(self, response):
        return False

    def _detect_quota_exceeded(self, response):
        return False


def test_failover_provider_receives_same_conversation_context():
    primary = CapturingProvider("primary", ["key-1"], fail=True)
    fallback = CapturingProvider("fallback", ["key-2"])
    conversation = Conversation([primary, fallback], system_prompt="Stay on task")

    conversation.history = [
        {"role": "user", "content": "We are building a router."},
        {"role": "assistant", "content": "I will preserve context."},
    ]

    response = conversation.send_message("Continue the implementation.")

    assert response == "response from fallback"
    assert primary.received_messages == fallback.received_messages
    sent = fallback.received_messages[0]
    assert sent[0]["role"] == "system"
    assert "Stay on task" in sent[0]["content"]
    assert {"role": "user", "content": "We are building a router."} in sent
    assert {"role": "assistant", "content": "I will preserve context."} in sent
    assert {"role": "user", "content": "Continue the implementation."} in sent


def test_trimmed_messages_are_kept_in_compiled_summary_context():
    provider = CapturingProvider("provider", ["key"])
    conversation = Conversation([provider], max_history_length=2)

    conversation.send_message("first important requirement")
    conversation.send_message("second request")

    compiled = conversation.get_compiled_context()
    system_messages = [message for message in compiled if message["role"] == "system"]

    assert system_messages
    assert "first important requirement" in system_messages[0]["content"]
