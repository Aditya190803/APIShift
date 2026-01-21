import unittest
from unittest.mock import MagicMock, patch
from APIShift import Conversation
from APIShift.providers import GeminiProvider, OpenRouterProvider


class TestConversation(unittest.TestCase):
    def setUp(self):
        gemini_keys = ["test_gemini_key"]
        openrouter_keys = ["test_openrouter_key"]

        # Mock the providers to avoid API calls and missing dependency issues in tests
        self.mock_gemini = MagicMock(spec=GeminiProvider)
        self.mock_gemini.api_keys = gemini_keys
        self.mock_gemini.generate_response.return_value = "Mocked Gemini Response"

        self.mock_openrouter = MagicMock(spec=OpenRouterProvider)
        self.mock_openrouter.api_keys = openrouter_keys
        self.mock_openrouter.generate_response.return_value = (
            "Mocked OpenRouter Response"
        )

        self.conversation = Conversation([self.mock_gemini, self.mock_openrouter])

    def test_send_message(self):
        response = self.conversation.send_message("Hello, test!")
        self.assertIsNotNone(response)
        self.assertEqual(response, "Mocked Gemini Response")

    def test_faiss_context_retrieval(self):
        # Add messages to FAISS index
        self.conversation.add_to_faiss("Hello, how are you?")
        self.conversation.add_to_faiss("What is the weather like today?")

        # Send a message and check if response is returned
        response = self.conversation.send_message("Tell me about the weather.")
        self.assertIsNotNone(response)


if __name__ == "__main__":
    unittest.main()
