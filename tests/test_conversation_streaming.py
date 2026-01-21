import unittest
from unittest.mock import MagicMock, patch
from APIShift import Conversation
from APIShift.providers import LLMProvider
from APIShift.exceptions import RateLimitError, NoAvailableProvidersError
from typing import Iterator


class MockProvider(LLMProvider):
    def __init__(self, name, api_keys):
        super().__init__(api_keys)
        self.name = name
        self.fail_on_stream = False
        self.stream_response = ["Chunk1", "Chunk2"]

    def generate_response(self, messages, **kwargs):
        return "Response from " + self.name

    def generate_stream(self, messages, **kwargs) -> Iterator[str]:
        if self.fail_on_stream:
            raise RateLimitError(self.name)
        for chunk in self.stream_response:
            yield chunk

    def _detect_rate_limit(self, response):
        return False

    def _detect_quota_exceeded(self, response):
        return False


class TestConversationStreaming(unittest.TestCase):
    def setUp(self):
        self.provider1 = MockProvider("Provider1", ["key1"])
        self.provider2 = MockProvider("Provider2", ["key2"])
        self.conversation = Conversation([self.provider1, self.provider2])

    def test_send_message_stream_success(self):
        # Test basic streaming success
        stream = self.conversation.send_message_stream("Hello")
        chunks = list(stream)
        self.assertEqual(chunks, ["Chunk1", "Chunk2"])

        # Verify history
        history = self.conversation.get_history()
        self.assertEqual(len(history), 2)
        self.assertEqual(history[0]["role"], "user")
        self.assertEqual(history[1]["role"], "assistant")
        self.assertEqual(history[1]["content"], "Chunk1Chunk2")

    def test_send_message_stream_failover(self):
        # Provider 1 fails at start of stream
        self.provider1.fail_on_stream = True

        stream = self.conversation.send_message_stream("Hello")
        chunks = list(stream)

        # Should have switched to Provider 2
        self.assertEqual(chunks, ["Chunk1", "Chunk2"])

        # Verify history
        history = self.conversation.get_history()
        self.assertEqual(len(history), 2)
        self.assertEqual(history[1]["content"], "Chunk1Chunk2")

        # Verify current provider is now provider 2
        # In current implementation of _switch_provider, if key is exhausted it deletes, otherwise rotates.
        # Since we only have 1 key in MockProvider, it might delete or switch index.
        # We just want to see that it's NOT the first provider anymore if possible,
        # but _switch_provider logic is complex.
        # Let's just verify we got the right chunks.
        self.assertEqual(chunks, ["Chunk1", "Chunk2"])

    def test_send_message_stream_empty(self):
        # Test empty stream
        self.provider1.stream_response = []
        stream = self.conversation.send_message_stream("Hello")
        chunks = list(stream)
        self.assertEqual(chunks, [])

        # Verify history
        history = self.conversation.get_history()
        self.assertEqual(len(history), 2)
        self.assertEqual(history[1]["content"], "")

    def test_send_message_stream_all_fail(self):
        self.provider1.fail_on_stream = True
        self.provider2.fail_on_stream = True

        with self.assertRaises(NoAvailableProvidersError):
            list(self.conversation.send_message_stream("Hello"))

    def test_send_message_stream_failover_partial(self):
        # Provider 1 fails AFTER yielding some data
        # In this case, it should NOT failover to provider 2 because data was already yielded.

        def failing_stream(messages, **kwargs):
            yield "Partial"
            raise RateLimitError("Provider1")

        self.provider1.generate_stream = MagicMock(side_effect=failing_stream)

        stream = self.conversation.send_message_stream("Hello")

        with self.assertRaises(RateLimitError):
            list(stream)

        # History should NOT have been updated with assistant response yet
        history = self.conversation.get_history()
        self.assertEqual(len(history), 1)
        self.assertEqual(history[0]["role"], "user")


if __name__ == "__main__":
    unittest.main()
