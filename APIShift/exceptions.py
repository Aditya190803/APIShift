from typing import Mapping, Optional


class MultiLLMManagerError(Exception):
    """Base exception for multi_llm_manager package."""
    pass


class RateLimitError(MultiLLMManagerError):
    """Raised when an API rate limit is exceeded."""

    def __init__(
        self,
        provider,
        message="Rate limit exceeded",
        *,
        retry_after_seconds: Optional[float] = None,
        status_code: Optional[int] = None,
        headers: Optional[Mapping[str, str]] = None,
    ):
        self.provider = provider
        self.retry_after_seconds = retry_after_seconds
        self.status_code = status_code
        self.headers = dict(headers or {})
        suffix = f"; retry after {retry_after_seconds:.0f}s" if retry_after_seconds else ""
        self.message = f"{provider} {message}{suffix}"
        super().__init__(self.message)


class QuotaExceededError(MultiLLMManagerError):
    """Raised when a provider's daily/monthly quota is exhausted."""

    def __init__(
        self,
        provider,
        message="Quota exceeded",
        *,
        retry_after_seconds: Optional[float] = None,
        status_code: Optional[int] = None,
        headers: Optional[Mapping[str, str]] = None,
    ):
        self.provider = provider
        self.retry_after_seconds = retry_after_seconds
        self.status_code = status_code
        self.headers = dict(headers or {})
        suffix = f"; retry after {retry_after_seconds:.0f}s" if retry_after_seconds else ""
        self.message = f"{provider} {message}{suffix}"
        super().__init__(self.message)


class NoAvailableProvidersError(MultiLLMManagerError):
    """Raised when no providers are available to handle the request."""

    def __init__(self, message="No available providers"):
        super().__init__(message)


class ProviderInitializationError(MultiLLMManagerError):
    """Raised when a provider fails to initialize."""

    def __init__(self, provider, message="Provider initialization failed"):
        self.provider = provider
        self.message = f"{provider} {message}"
        super().__init__(self.message)
