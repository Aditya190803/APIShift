# APIShift: same-provider key-pool orchestration with optional provider fallback.
from .context import approximate_token_count, pack_messages_to_token_budget
from .conversation import Conversation
from .memory import JsonMemoryStore
from .providers import (
    LLMProvider,
    GeminiProvider,
    OpenRouterProvider,
    GroqProvider,
    FREE_OPENROUTER_MODELS,
    discover_openrouter_free_models,
)
from .exceptions import (
    MultiLLMManagerError,
    RateLimitError,
    QuotaExceededError,
    NoAvailableProvidersError,
    ProviderInitializationError
)

__version__ = "1.2.0"

__all__ = [
    # Main classes
    'Conversation',
    'LLMProvider',
    'GeminiProvider',
    'OpenRouterProvider',
    'GroqProvider',
    'FREE_OPENROUTER_MODELS',
    'discover_openrouter_free_models',
    'JsonMemoryStore',
    'approximate_token_count',
    'pack_messages_to_token_budget',

    # Exceptions
    'MultiLLMManagerError',
    'RateLimitError',
    'QuotaExceededError',
    'NoAvailableProvidersError',
    'ProviderInitializationError'
]
