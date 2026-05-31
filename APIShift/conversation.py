from typing import Any, Dict, Iterator, List, Optional, Sequence

from .context import TokenCounter, approximate_token_count, pack_messages_to_token_budget
from .exceptions import NoAvailableProvidersError, QuotaExceededError, RateLimitError
from .memory import JsonMemoryStore
from .providers import (
    FREE_OPENROUTER_MODELS,
    GeminiProvider,
    GroqProvider,
    LLMProvider,
    OpenRouterProvider,
    discover_openrouter_free_models,
)

try:
    import faiss
    from sentence_transformers import SentenceTransformer

    RAG_AVAILABLE = True
except ImportError:
    RAG_AVAILABLE = False


class Conversation:
    """Manage one task/conversation across many LLM providers.

    The important invariant is that provider switching never resets task context.
    APIShift keeps one canonical history, compiles it into provider-neutral chat
    messages, and sends that same compiled context to whichever free/limited API
    is currently healthy.
    """

    def __init__(
        self,
        providers: Optional[List[LLMProvider]] = None,
        max_history_length: int = 20,
        *,
        system_prompt: Optional[str] = None,
        key_cooldown_seconds: float = 60.0,
        key_strategy: str = "adaptive",
        rag_top_k: int = 3,
        enable_rag: bool = True,
        summary_max_chars: int = 4000,
        memory_path: Optional[str] = None,
        max_context_tokens: Optional[int] = 6000,
        token_counter: TokenCounter = approximate_token_count,
    ):
        self.providers = providers or []
        self.max_history_length = max_history_length
        self.system_prompt = system_prompt
        if key_strategy not in {"adaptive", "round_robin", "sticky"}:
            raise ValueError(
                "key_strategy must be one of: adaptive, round_robin, sticky"
            )
        self.key_cooldown_seconds = key_cooldown_seconds
        self.key_strategy = key_strategy
        self.rag_top_k = rag_top_k
        self.enable_rag = enable_rag
        self.summary_max_chars = summary_max_chars
        self.memory_path = memory_path
        self.memory_store = JsonMemoryStore(memory_path) if memory_path else None
        self.max_context_tokens = max_context_tokens
        self.token_counter = token_counter

        self.history: List[Dict[str, str]] = self.memory_store.load_messages() if self.memory_store else []
        self.summary: str = self.memory_store.load_summary() if self.memory_store else ""
        self.current_provider_index = 0
        self.last_route: Optional[Dict[str, Any]] = None
        self._initialize_faiss()

    @classmethod
    def from_gemini_key_pool(
        cls,
        api_keys: Sequence[str],
        *,
        model: str = "gemini-1.5-flash",
        fallback_providers: Optional[Sequence[LLMProvider]] = None,
        **kwargs,
    ) -> "Conversation":
        """Create a same-provider-first Gemini key pool.

        This is the primary APIShift pattern: put multiple API keys/accounts for
        the same provider into one pool, rotate healthy keys adaptively, and only
        use fallback providers when the whole pool is cooling down.
        """
        providers: List[LLMProvider] = [GeminiProvider(list(api_keys), model=model)]
        providers.extend(list(fallback_providers or []))
        return cls(providers=providers, **kwargs)

    @classmethod
    def from_free_providers(
        cls,
        *,
        gemini_keys: Optional[Sequence[str]] = None,
        openrouter_keys: Optional[Sequence[str]] = None,
        openrouter_models: Optional[Sequence[str]] = None,
        discover_openrouter_models: bool = False,
        groq_keys: Optional[Sequence[str]] = None,
        **kwargs,
    ) -> "Conversation":
        """Create a conversation from common free-tier providers.

        Providers are added only when keys are supplied. The resulting router
        prefers lower-priority free providers first, then falls through as keys
        or quotas cool down.
        """
        providers: List[LLMProvider] = []
        if gemini_keys:
            providers.append(GeminiProvider(list(gemini_keys)))
        if openrouter_keys:
            models = list(openrouter_models or [])
            if not models and discover_openrouter_models:
                models = discover_openrouter_free_models(api_key=list(openrouter_keys)[0])
            for model in models or FREE_OPENROUTER_MODELS:
                providers.append(OpenRouterProvider(list(openrouter_keys), model=model))
        if groq_keys:
            providers.append(GroqProvider(list(groq_keys)))
        return cls(providers=providers, **kwargs)

    def _initialize_faiss(self):
        self.faiss_index = None
        self.faiss_data: List[str] = []
        self.model = None

        if not (RAG_AVAILABLE and self.enable_rag):
            return

        try:
            self.model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
            probe = self.model.encode(["dimension probe"]).astype("float32")
            self.faiss_index = faiss.IndexFlatL2(probe.shape[1])
        except Exception:
            # RAG is optional; the router must still work if embeddings cannot load.
            self.faiss_index = None
            self.model = None

    def add_provider(self, provider: LLMProvider):
        self.providers.append(provider)
        self._sort_providers()

    def _sort_providers(self):
        # Prefer free-tier and lower priority values, while preserving stable order
        # for providers with equal metadata.
        self.providers.sort(
            key=lambda provider: (not getattr(provider, "free_tier", True), getattr(provider, "priority", 100))
        )
        if self.providers:
            self.current_provider_index %= len(self.providers)

    def _total_key_count(self) -> int:
        return max(1, sum(len(getattr(provider, "api_keys", [])) for provider in self.providers))

    def _get_current_provider(self) -> LLMProvider:
        if not self.providers:
            raise NoAvailableProvidersError()

        self._sort_providers()
        for offset in range(len(self.providers)):
            idx = (self.current_provider_index + offset) % len(self.providers)
            provider = self.providers[idx]
            has_available = getattr(provider, "has_available_key", lambda: True)
            if has_available():
                self.current_provider_index = idx
                return provider

        raise NoAvailableProvidersError("No providers have an available key right now")

    def _switch_provider(self):
        if not self.providers:
            raise NoAvailableProvidersError()
        self.current_provider_index = (self.current_provider_index + 1) % len(self.providers)

    def _prepare_provider_key(self, provider: LLMProvider):
        select_key = getattr(provider, "select_key", None)
        if callable(select_key):
            select_key(self.key_strategy)

    def _record_provider_success(self, provider: LLMProvider):
        record_success = getattr(provider, "record_current_key_success", None)
        if callable(record_success):
            record_success(self.key_strategy)

    def _handle_retryable_failure(self, provider: LLMProvider, error: Exception):
        mark_unavailable = getattr(provider, "mark_current_key_unavailable", None)
        cooldown = getattr(error, "retry_after_seconds", None) or self.key_cooldown_seconds
        if callable(mark_unavailable):
            mark_unavailable(cooldown, str(error))

        has_available = getattr(provider, "has_available_key", lambda: False)
        if has_available():
            rotate_key = getattr(provider, "rotate_key", None)
            if callable(rotate_key):
                rotate_key()
            return

        self._switch_provider()

    def add_to_faiss(self, message: str):
        if not (self.model and self.faiss_index):
            return
        embedding = self._convert_to_embedding(message)
        self.faiss_index.add(embedding)
        self.faiss_data.append(message)

    def _convert_to_embedding(self, message: str):
        return self.model.encode([message]).astype("float32")

    def retrieve_context(self, query: str, top_k: Optional[int] = None) -> List[str]:
        """Return semantically relevant remembered snippets for the query."""
        if not (self.model and self.faiss_index and self.faiss_data):
            return []

        k = min(top_k or self.rag_top_k, len(self.faiss_data))
        if k <= 0:
            return []

        embedding = self._convert_to_embedding(query)
        _, indices = self.faiss_index.search(embedding, k)
        return [self.faiss_data[i] for i in indices[0] if 0 <= i < len(self.faiss_data)]

    def _remember_trimmed_messages(self, trimmed: List[Dict[str, str]]):
        if not trimmed:
            return
        rendered = "\n".join(
            f"{message.get('role', 'unknown')}: {message.get('content', '')}"
            for message in trimmed
        )
        combined = f"{self.summary}\n{rendered}".strip()
        if len(combined) > self.summary_max_chars:
            combined = combined[-self.summary_max_chars :]
        self.summary = combined
        if self.memory_store:
            self.memory_store.append_summary(self.summary)

    def _trim_history(self):
        if len(self.history) <= self.max_history_length:
            return
        overflow = len(self.history) - self.max_history_length
        trimmed = self.history[:overflow]
        self.history = self.history[overflow:]
        self._remember_trimmed_messages(trimmed)

    def _build_context_messages(self, latest_message: Optional[str] = None) -> List[Dict[str, str]]:
        system_sections: List[str] = []
        if self.system_prompt:
            system_sections.append(self.system_prompt)
        if self.summary:
            system_sections.append(
                "Earlier conversation summary. Preserve this task context across provider switches:\n"
                + self.summary
            )
        if latest_message:
            retrieved = self.retrieve_context(latest_message)
            if retrieved:
                system_sections.append(
                    "Relevant remembered context:\n"
                    + "\n".join(f"- {item}" for item in retrieved)
                )

        messages = self.history[-self.max_history_length :]
        return pack_messages_to_token_budget(
            system_sections=system_sections,
            messages=messages,
            max_context_tokens=self.max_context_tokens,
            token_counter=self.token_counter,
        )

    def _record_route(self, provider: LLMProvider, attempts: int):
        self.last_route = {
            "provider": getattr(provider, "name", provider.__class__.__name__),
            "model": getattr(provider, "model", getattr(provider, "model_name", None)),
            "key_index": getattr(provider, "current_key_index", None),
            "key_label": f"key-{getattr(provider, 'current_key_index', 0) + 1}",
            "available_keys": getattr(provider, "available_key_count", lambda: None)(),
            "total_keys": len(getattr(provider, "api_keys", [])),
            "key_strategy": self.key_strategy,
            "attempts": attempts,
        }

    def send_message(self, message: str, **kwargs) -> str:
        user_message = {"role": "user", "content": message}
        self.history.append(user_message)
        if self.memory_store:
            self.memory_store.append_message(user_message)
        self.add_to_faiss(message)
        self._trim_history()

        attempts = 0
        max_attempts = self._total_key_count()
        last_error: Optional[Exception] = None
        context_messages = self._build_context_messages(message)

        while attempts < max_attempts:
            provider = self._get_current_provider()
            self._prepare_provider_key(provider)
            try:
                response = provider.generate_response(messages=context_messages, **kwargs)
                assistant_response = {"role": "assistant", "content": response}
                self.history.append(assistant_response)
                if self.memory_store:
                    self.memory_store.append_message(assistant_response)
                self.add_to_faiss(response)
                self._trim_history()
                self._record_route(provider, attempts + 1)
                self._record_provider_success(provider)
                return response
            except (RateLimitError, QuotaExceededError) as error:
                last_error = error
                self._handle_retryable_failure(provider, error)
                attempts += 1

        raise NoAvailableProvidersError(str(last_error) if last_error else "No available providers")

    def send_message_stream(self, message: str, **kwargs) -> Iterator[str]:
        user_message = {"role": "user", "content": message}
        self.history.append(user_message)
        if self.memory_store:
            self.memory_store.append_message(user_message)
        self.add_to_faiss(message)
        self._trim_history()

        attempts = 0
        max_attempts = self._total_key_count()
        last_error: Optional[Exception] = None
        context_messages = self._build_context_messages(message)

        while attempts < max_attempts:
            provider = self._get_current_provider()
            self._prepare_provider_key(provider)
            full_content: List[str] = []
            try:
                stream = provider.generate_stream(messages=context_messages, **kwargs)
                iterator = iter(stream)
                try:
                    first_chunk = next(iterator)
                except StopIteration:
                    assistant_response = {"role": "assistant", "content": ""}
                    self.history.append(assistant_response)
                    if self.memory_store:
                        self.memory_store.append_message(assistant_response)
                    self._trim_history()
                    self._record_route(provider, attempts + 1)
                    self._record_provider_success(provider)
                    return

                yield first_chunk
                full_content.append(first_chunk)

                while True:
                    try:
                        chunk = next(iterator)
                    except StopIteration:
                        break
                    yield chunk
                    full_content.append(chunk)

                response = "".join(full_content)
                assistant_response = {"role": "assistant", "content": response}
                self.history.append(assistant_response)
                if self.memory_store:
                    self.memory_store.append_message(assistant_response)
                self.add_to_faiss(response)
                self._trim_history()
                self._record_route(provider, attempts + 1)
                self._record_provider_success(provider)
                return

            except (RateLimitError, QuotaExceededError) as error:
                if full_content:
                    # Once bytes were yielded to the caller, restarting with a new
                    # provider would duplicate/garble output. Surface the partial
                    # stream error to the application instead.
                    raise error
                last_error = error
                self._handle_retryable_failure(provider, error)
                attempts += 1

        raise NoAvailableProvidersError(str(last_error) if last_error else "No available providers")

    def get_history(self) -> List[Dict[str, str]]:
        return self.history.copy()

    def get_compiled_context(self) -> List[Dict[str, str]]:
        """Inspect the exact provider-neutral context sent on the next call."""
        latest = self.history[-1]["content"] if self.history else None
        return self._build_context_messages(latest)

    def clear_history(self):
        self.history.clear()
        self.summary = ""
        if self.memory_store:
            self.memory_store.clear()
        self.faiss_data.clear()
        if self.faiss_index is not None:
            self._initialize_faiss()
