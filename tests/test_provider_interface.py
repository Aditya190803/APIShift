import pytest
from typing import List, Dict, Iterator
from APIShift.providers import LLMProvider


def test_llm_provider_interface():
    class MockProvider(LLMProvider):
        def generate_response(self, messages: List[Dict[str, str]], **kwargs) -> str:
            return "mock response"

        def generate_stream(
            self, messages: List[Dict[str, str]], **kwargs
        ) -> Iterator[str]:
            yield "mock"
            yield " stream"

        def _detect_rate_limit(self, response):
            return False

        def _detect_quota_exceeded(self, response):
            return False

    provider = MockProvider(api_keys=["test-key"])
    assert provider.generate_response([]) == "mock response"
    assert "".join(list(provider.generate_stream([]))) == "mock stream"


def test_llm_provider_abstract():
    class IncompleteProvider(LLMProvider):
        def generate_response(self, messages: List[Dict[str, str]], **kwargs) -> str:
            return "mock response"

        def generate_stream(
            self, messages: List[Dict[str, str]], **kwargs
        ) -> Iterator[str]:
            yield "mock"

        def _detect_rate_limit(self, response):
            return False

        def _detect_quota_exceeded(self, response):
            return False

    # This should now succeed because all methods are implemented
    provider = IncompleteProvider(api_keys=["test-key"])
    assert provider.generate_response([]) == "mock response"


def test_llm_provider_truly_incomplete():
    class TrulyIncompleteProvider(LLMProvider):
        def generate_response(self, messages: List[Dict[str, str]], **kwargs) -> str:
            return "mock response"

    with pytest.raises(TypeError):
        TrulyIncompleteProvider(api_keys=["test-key"])
