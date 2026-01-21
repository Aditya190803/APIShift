import pytest
import httpx
import json
from unittest.mock import MagicMock, patch
from APIShift.providers import OpenRouterProvider
from APIShift.exceptions import RateLimitError


def test_openrouter_streaming_success():
    """Test successful streaming from OpenRouter."""
    provider = OpenRouterProvider(api_keys=["test-key"])
    messages = [{"role": "user", "content": "Hello"}]

    # Mock httpx response for streaming
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.iter_lines.return_value = [
        'data: {"choices": [{"delta": {"content": "Hello"}}]}',
        'data: {"choices": [{"delta": {"content": " world"}}]}',
        "data: [DONE]",
    ]

    with patch("httpx.Client") as mock_client:
        mock_client.return_value.__enter__.return_value.stream.return_value.__enter__.return_value = mock_response

        chunks = list(provider.generate_stream(messages))

        assert chunks == ["Hello", " world"]
        mock_client.return_value.__enter__.return_value.stream.assert_called_once()
        args, kwargs = mock_client.return_value.__enter__.return_value.stream.call_args
        assert kwargs["json"]["stream"] is True


def test_openrouter_streaming_rate_limit():
    """Test rate limit detection during streaming setup."""
    provider = OpenRouterProvider(api_keys=["test-key"])
    messages = [{"role": "user", "content": "Hello"}]

    mock_response = MagicMock()
    mock_response.status_code = 429
    mock_response.is_error = True

    with patch("httpx.Client") as mock_client:
        mock_client.return_value.__enter__.return_value.stream.return_value.__enter__.return_value = mock_response

        with pytest.raises(RateLimitError):
            list(provider.generate_stream(messages))
