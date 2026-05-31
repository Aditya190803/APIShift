from pathlib import Path
from unittest.mock import MagicMock, patch

from APIShift import Conversation, discover_openrouter_free_models
from APIShift.context import pack_messages_to_token_budget
from APIShift.providers import OpenRouterProvider, retry_after_seconds


def test_json_memory_store_rehydrates_history(tmp_path: Path):
    memory_path = tmp_path / "memory.jsonl"
    first = Conversation([], memory_path=str(memory_path), enable_rag=False)
    first.history.append({"role": "user", "content": "persist me"})
    first.memory_store.append_message(first.history[-1])

    second = Conversation([], memory_path=str(memory_path), enable_rag=False)

    assert second.get_history() == [{"role": "user", "content": "persist me"}]


def test_context_packing_keeps_newest_messages_inside_budget():
    packed = pack_messages_to_token_budget(
        system_sections=["system instructions"],
        messages=[
            {"role": "user", "content": "old " * 100},
            {"role": "assistant", "content": "recent answer"},
            {"role": "user", "content": "latest question"},
        ],
        max_context_tokens=50,
    )

    rendered = "\n".join(message["content"] for message in packed)
    assert "latest question" in rendered
    assert "recent answer" in rendered
    assert "old " * 20 not in rendered


def test_retry_after_header_parsing():
    response = MagicMock()
    response.headers = {"Retry-After": "12"}

    assert retry_after_seconds(response) == 12


def test_openrouter_free_model_discovery_filters_zero_priced_models():
    fake_response = MagicMock()
    fake_response.json.return_value = {
        "data": [
            {"id": "paid/model", "pricing": {"prompt": "0.01", "completion": "0.01"}},
            {"id": "free/model:free", "pricing": {"prompt": "0", "completion": "0"}},
        ]
    }
    fake_response.raise_for_status.return_value = None

    with patch("requests.get", return_value=fake_response):
        assert discover_openrouter_free_models() == ["free/model:free"]


def test_openrouter_rate_limit_error_carries_retry_after():
    provider = OpenRouterProvider(["key"])
    fake_response = MagicMock()
    fake_response.ok = False
    fake_response.status_code = 429
    fake_response.headers = {"retry-after": "9"}
    fake_response.text = "too many requests"

    with patch("requests.post", return_value=fake_response):
        try:
            provider.generate_response([{"role": "user", "content": "hi"}])
        except Exception as exc:
            assert getattr(exc, "retry_after_seconds", None) == 9
        else:
            raise AssertionError("expected rate-limit exception")
