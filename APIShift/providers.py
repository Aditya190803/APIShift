import abc
import json
import time
from email.utils import parsedate_to_datetime
from typing import Any, Dict, Iterator, List, Optional

import requests

from .exceptions import ProviderInitializationError, QuotaExceededError, RateLimitError


FREE_OPENROUTER_MODELS = [
    "meta-llama/llama-3.1-8b-instruct:free",
    "mistralai/mistral-7b-instruct:free",
    "google/gemma-2-9b-it:free",
]

OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models"


class LLMProvider(abc.ABC):
    """Abstract base class for Language Model Providers.

    Providers expose one normalized chat interface while also tracking API-key
    availability. Conversation-level routing uses this state to avoid retrying a
    key immediately after it hit a rate limit or quota boundary.
    """

    def __init__(
        self,
        api_keys: List[str],
        *,
        name: Optional[str] = None,
        free_tier: bool = True,
        priority: int = 100,
    ):
        if not api_keys:
            raise ProviderInitializationError(
                self.__class__.__name__, "No API keys provided"
            )
        self.api_keys = list(api_keys)
        self.current_key_index = 0
        self.name = name or self.__class__.__name__
        self.free_tier = free_tier
        self.priority = priority
        self._key_cooldowns = [0.0 for _ in self.api_keys]
        self.key_usage_counts = [0 for _ in self.api_keys]
        self.key_failure_counts = [0 for _ in self.api_keys]
        self.last_error: Optional[str] = None

    @property
    def current_api_key(self) -> str:
        """Return the currently selected, available API key when possible."""
        self._ensure_available_key_selected()
        return self.api_keys[self.current_key_index]

    def _available_key_indices(self) -> List[int]:
        now = time.monotonic()
        return [
            index
            for index, unavailable_until in enumerate(self._key_cooldowns)
            if unavailable_until <= now
        ]

    def select_key(self, strategy: str = "adaptive"):
        """Select an available key for the next request.

        `adaptive` spreads work across the least-used healthy keys while still
        respecting per-key cooldowns. `round_robin` uses the current key and
        advances after each successful request. `sticky` keeps the current key
        until it is cooling down.
        """
        available = self._available_key_indices()
        if not available:
            return

        if strategy == "adaptive":
            total = len(self.api_keys)
            self.current_key_index = min(
                available,
                key=lambda index: (
                    self.key_usage_counts[index],
                    self.key_failure_counts[index],
                    (index - self.current_key_index) % total,
                ),
            )
            return

        if self.current_key_index not in available:
            self.current_key_index = available[0]

    def record_current_key_success(self, strategy: str = "adaptive"):
        """Record successful use and optionally advance the pool cursor."""
        self.key_usage_counts[self.current_key_index] += 1
        self.last_error = None
        if strategy == "round_robin":
            self.rotate_key()

    def rotate_key(self):
        """Rotate to the next available key, falling back to round-robin."""
        now = time.monotonic()
        for offset in range(1, len(self.api_keys) + 1):
            candidate = (self.current_key_index + offset) % len(self.api_keys)
            if self._key_cooldowns[candidate] <= now:
                self.current_key_index = candidate
                return
        self.current_key_index = (self.current_key_index + 1) % len(self.api_keys)

    def mark_current_key_unavailable(self, cooldown_seconds: float, reason: str = ""):
        """Temporarily pause the current key after a retryable failure."""
        self._key_cooldowns[self.current_key_index] = (
            time.monotonic() + cooldown_seconds
        )
        self.key_failure_counts[self.current_key_index] += 1
        self.last_error = reason or "temporarily unavailable"

    def has_available_key(self) -> bool:
        return bool(self._available_key_indices())

    def available_key_count(self) -> int:
        return len(self._available_key_indices())

    def _ensure_available_key_selected(self):
        if self.has_available_key() and self._key_cooldowns[self.current_key_index] > time.monotonic():
            self.rotate_key()

    @abc.abstractmethod
    def generate_response(self, messages: List[Dict[str, str]], **kwargs) -> str:
        """Generate a response from the LLM."""
        pass

    @abc.abstractmethod
    def generate_stream(
        self, messages: List[Dict[str, str]], **kwargs
    ) -> Iterator[str]:
        """Generate a streaming response from the LLM."""
        pass

    @abc.abstractmethod
    def _detect_rate_limit(self, response: Any) -> bool:
        pass

    @abc.abstractmethod
    def _detect_quota_exceeded(self, response: Any) -> bool:
        pass


def _error_text(response: Any) -> str:
    try:
        if hasattr(response, "text"):
            return str(response.text).lower()
    except Exception:
        pass
    return str(response).lower()


def _headers(response: Any) -> Dict[str, str]:
    raw_headers = getattr(response, "headers", None)
    if not raw_headers:
        raw_response = getattr(response, "response", None)
        raw_headers = getattr(raw_response, "headers", None)
    if not raw_headers:
        return {}
    return {str(key).lower(): str(value) for key, value in dict(raw_headers).items()}


def _parse_retry_after(value: Optional[str]) -> Optional[float]:
    if not value:
        return None
    try:
        return max(0.0, float(value))
    except ValueError:
        try:
            dt = parsedate_to_datetime(value)
            return max(0.0, dt.timestamp() - time.time())
        except Exception:
            return None


def _parse_epoch_or_delta(value: Optional[str]) -> Optional[float]:
    if not value:
        return None
    try:
        parsed = float(value)
    except ValueError:
        return None
    # Values larger than a recent epoch are absolute reset times.
    if parsed > 1_000_000_000:
        return max(0.0, parsed - time.time())
    return max(0.0, parsed)


def retry_after_seconds(response: Any) -> Optional[float]:
    """Extract provider-specific retry timing from HTTP headers/errors."""
    headers = _headers(response)
    candidates = [
        _parse_retry_after(headers.get("retry-after")),
        _parse_epoch_or_delta(headers.get("x-ratelimit-reset")),
        _parse_epoch_or_delta(headers.get("x-ratelimit-reset-requests")),
        _parse_epoch_or_delta(headers.get("x-ratelimit-reset-tokens")),
        _parse_epoch_or_delta(headers.get("anthropic-ratelimit-requests-reset")),
        _parse_epoch_or_delta(headers.get("x-ratelimit-reset-after")),
    ]
    candidates = [candidate for candidate in candidates if candidate is not None]
    return max(candidates) if candidates else None


def _status_code(response: Any) -> Optional[int]:
    status = getattr(response, "status_code", None) or getattr(response, "status", None)
    if status is None:
        raw_response = getattr(response, "response", None)
        status = getattr(raw_response, "status_code", None) or getattr(raw_response, "status", None)
    try:
        return int(status) if status is not None else None
    except (TypeError, ValueError):
        return None


def _rate_limit_error(provider: str, response: Any) -> RateLimitError:
    return RateLimitError(
        provider,
        retry_after_seconds=retry_after_seconds(response),
        status_code=_status_code(response),
        headers=_headers(response),
    )


def _quota_error(provider: str, response: Any) -> QuotaExceededError:
    return QuotaExceededError(
        provider,
        retry_after_seconds=retry_after_seconds(response),
        status_code=_status_code(response),
        headers=_headers(response),
    )


def discover_openrouter_free_models(
    *,
    api_key: Optional[str] = None,
    timeout: float = 10.0,
    require_free_suffix: bool = False,
) -> List[str]:
    """Fetch current OpenRouter free model ids.

    OpenRouter exposes pricing strings. Models with zero prompt and completion
    pricing are usable as free-tier candidates; `:free` ids are included too.
    Falls back to `FREE_OPENROUTER_MODELS` if the network request fails.
    """
    headers: Dict[str, str] = {}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    try:
        response = requests.get(OPENROUTER_MODELS_URL, headers=headers, timeout=timeout)
        response.raise_for_status()
        data = response.json().get("data", [])
    except Exception:
        return list(FREE_OPENROUTER_MODELS)

    free_models: List[str] = []
    for model in data:
        model_id = model.get("id")
        if not model_id:
            continue
        pricing = model.get("pricing") or {}
        prompt = str(pricing.get("prompt", "")).strip()
        completion = str(pricing.get("completion", "")).strip()
        is_zero_priced = prompt in {"0", "0.0", "0.000000", ""} and completion in {
            "0",
            "0.0",
            "0.000000",
            "",
        }
        is_free_suffix = str(model_id).endswith(":free")
        if (is_free_suffix or (is_zero_priced and not require_free_suffix)) and model_id not in free_models:
            free_models.append(str(model_id))

    return free_models or list(FREE_OPENROUTER_MODELS)


class GeminiProvider(LLMProvider):
    """Provider for Google Gemini API."""

    def __init__(
        self,
        api_keys: List[str],
        model: str = "gemini-1.5-flash",
        *,
        free_tier: bool = True,
        priority: int = 10,
    ):
        try:
            import google.generativeai  # noqa: F401
        except ImportError:
            raise ProviderInitializationError(
                "GeminiProvider", "google-generativeai package not installed"
            )

        super().__init__(
            api_keys, name="GeminiProvider", free_tier=free_tier, priority=priority
        )
        self.model_name = model

    def _split_system_and_contents(self, messages: List[Dict[str, str]]):
        system_parts: List[str] = []
        contents: List[Dict[str, Any]] = []

        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role == "system":
                system_parts.append(content)
                continue
            contents.append(
                {
                    "role": "model" if role == "assistant" else "user",
                    "parts": [content],
                }
            )

        return "\n\n".join(system_parts) or None, contents

    def generate_response(self, messages: List[Dict[str, str]], **kwargs) -> str:
        import google.generativeai as genai

        genai.configure(api_key=self.current_api_key)
        system_instruction, contents = self._split_system_and_contents(messages)

        try:
            model = genai.GenerativeModel(
                self.model_name, system_instruction=system_instruction
            )
            response = model.generate_content(contents, **kwargs)
            if not getattr(response, "parts", None):
                raise Exception("No response generated")
            return response.text
        except Exception as e:
            if self._detect_rate_limit(e):
                raise _rate_limit_error("GeminiProvider", e)
            if self._detect_quota_exceeded(e):
                raise _quota_error("GeminiProvider", e)
            raise

    def generate_stream(
        self, messages: List[Dict[str, str]], **kwargs
    ) -> Iterator[str]:
        import google.generativeai as genai

        genai.configure(api_key=self.current_api_key)
        system_instruction, contents = self._split_system_and_contents(messages)

        try:
            model = genai.GenerativeModel(
                self.model_name, system_instruction=system_instruction
            )
            response = model.generate_content(contents, stream=True, **kwargs)
            for chunk in response:
                text = getattr(chunk, "text", "")
                if text:
                    yield text
        except Exception as e:
            if self._detect_rate_limit(e):
                raise _rate_limit_error("GeminiProvider", e)
            if self._detect_quota_exceeded(e):
                raise _quota_error("GeminiProvider", e)
            raise

    def _detect_rate_limit(self, response: Any) -> bool:
        error_str = _error_text(response)
        status_code = getattr(response, "status_code", None) or getattr(response, "code", None)
        return status_code == 429 or any(
            phrase in error_str
            for phrase in ["rate limit", "too many requests", "resource exhausted"]
        )

    def _detect_quota_exceeded(self, response: Any) -> bool:
        error_str = _error_text(response)
        return any(
            phrase in error_str
            for phrase in ["quota exceeded", "quota exhausted", "daily limit reached"]
        )


class OpenRouterProvider(LLMProvider):
    """Provider for OpenRouter's OpenAI-compatible API."""

    def __init__(
        self,
        api_keys: List[str],
        model: str = FREE_OPENROUTER_MODELS[0],
        *,
        base_url: str = "https://openrouter.ai/api/v1/chat/completions",
        free_tier: bool = True,
        priority: int = 20,
        app_name: Optional[str] = None,
        site_url: Optional[str] = None,
    ):
        super().__init__(
            api_keys, name="OpenRouterProvider", free_tier=free_tier, priority=priority
        )
        self.base_url = base_url
        self.model = model
        self.app_name = app_name
        self.site_url = site_url

    def _headers(self) -> Dict[str, str]:
        headers = {
            "Authorization": f"Bearer {self.current_api_key}",
            "Content-Type": "application/json",
        }
        if self.app_name:
            headers["X-Title"] = self.app_name
        if self.site_url:
            headers["HTTP-Referer"] = self.site_url
        return headers

    def generate_response(self, messages: List[Dict[str, str]], **kwargs) -> str:
        payload = {"model": self.model, "messages": messages, **kwargs}

        try:
            response = requests.post(self.base_url, headers=self._headers(), json=payload)
            if not response.ok:
                if self._detect_rate_limit(response):
                    raise _rate_limit_error("OpenRouterProvider", response)
                if self._detect_quota_exceeded(response):
                    raise _quota_error("OpenRouterProvider", response)
                response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"]
        except requests.RequestException as e:
            if self._detect_rate_limit(e):
                raise _rate_limit_error("OpenRouterProvider", e)
            if self._detect_quota_exceeded(e):
                raise _quota_error("OpenRouterProvider", e)
            raise

    def generate_stream(
        self, messages: List[Dict[str, str]], **kwargs
    ) -> Iterator[str]:
        try:
            import httpx
        except ImportError:
            raise ProviderInitializationError(
                "OpenRouterProvider", "httpx package not installed"
            )

        payload = {"model": self.model, "messages": messages, **kwargs, "stream": True}

        try:
            with httpx.Client() as client:
                with client.stream(
                    "POST", self.base_url, headers=self._headers(), json=payload
                ) as response:
                    if response.is_error:
                        if self._detect_rate_limit(response):
                            raise _rate_limit_error("OpenRouterProvider", response)
                        if self._detect_quota_exceeded(response):
                            raise _quota_error("OpenRouterProvider", response)
                        response.raise_for_status()

                    for line in response.iter_lines():
                        if not line:
                            continue
                        if line.startswith("data: "):
                            data_str = line[len("data: ") :]
                            if data_str == "[DONE]":
                                break
                            try:
                                data = json.loads(data_str)
                            except json.JSONDecodeError:
                                continue
                            choices = data.get("choices") or []
                            if choices:
                                delta = choices[0].get("delta", {})
                                content = delta.get("content")
                                if content:
                                    yield content
        except Exception as e:
            if e.__class__.__name__ in {"RateLimitError", "QuotaExceededError"}:
                raise
            if self._detect_rate_limit(e):
                raise _rate_limit_error("OpenRouterProvider", e)
            if self._detect_quota_exceeded(e):
                raise _quota_error("OpenRouterProvider", e)
            raise

    def _detect_rate_limit(self, response: Any) -> bool:
        error_str = _error_text(response)
        status_code = getattr(response, "status_code", None)
        return status_code == 429 or any(
            phrase in error_str for phrase in ["rate limit", "too many requests"]
        )

    def _detect_quota_exceeded(self, response: Any) -> bool:
        error_str = _error_text(response)
        return any(
            phrase in error_str
            for phrase in ["quota exceeded", "daily limit", "usage limit", "insufficient credits"]
        )


class GroqProvider(LLMProvider):
    """Provider for Groq API."""

    def __init__(
        self,
        api_keys: List[str],
        model: str = "llama3-8b-8192",
        *,
        free_tier: bool = True,
        priority: int = 30,
    ):
        try:
            import groq  # noqa: F401
        except ImportError:
            raise ProviderInitializationError(
                "GroqProvider", "groq package not installed"
            )

        super().__init__(api_keys, name="GroqProvider", free_tier=free_tier, priority=priority)
        self.model = model

    def generate_response(self, messages: List[Dict[str, str]], **kwargs) -> str:
        from groq import Groq

        client = Groq(api_key=self.current_api_key)

        try:
            response = client.chat.completions.create(
                model=self.model, messages=messages, **kwargs
            )
            return response.choices[0].message.content
        except Exception as e:
            if self._detect_rate_limit(e):
                raise _rate_limit_error("GroqProvider", e)
            if self._detect_quota_exceeded(e):
                raise _quota_error("GroqProvider", e)
            raise

    def generate_stream(
        self, messages: List[Dict[str, str]], **kwargs
    ) -> Iterator[str]:
        from groq import Groq

        client = Groq(api_key=self.current_api_key)

        try:
            response = client.chat.completions.create(
                model=self.model, messages=messages, stream=True, **kwargs
            )
            for chunk in response:
                content = chunk.choices[0].delta.content
                if content:
                    yield content
        except Exception as e:
            if self._detect_rate_limit(e):
                raise _rate_limit_error("GroqProvider", e)
            if self._detect_quota_exceeded(e):
                raise _quota_error("GroqProvider", e)
            raise

    def _detect_rate_limit(self, response: Any) -> bool:
        error_str = _error_text(response)
        status_code = getattr(response, "status_code", None)
        return status_code == 429 or any(
            phrase in error_str for phrase in ["rate limit", "too many requests"]
        )

    def _detect_quota_exceeded(self, response: Any) -> bool:
        error_str = _error_text(response)
        return any(
            phrase in error_str
            for phrase in ["quota exceeded", "daily limit reached", "usage limit"]
        )
