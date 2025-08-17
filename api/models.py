import sys
import os
import json
from http.server import BaseHTTPRequestHandler

# Add the backend directory to the Python path before importing
backend_path = os.path.join(os.path.dirname(__file__), "..", "backend")
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from unified_llm_service import UnifiedLLMService


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        """Get available models based on provided API keys"""
        try:
            # Set CORS headers
            self.send_response(200)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type, X-OpenAI-Key, X-Gemini-Key")
            self.send_header("Content-Type", "application/json")
            self.end_headers()

            # Extract API keys from headers
            openai_key = self.headers.get('X-OpenAI-Key')
            gemini_key = self.headers.get('X-Gemini-Key')

            # Check if at least one API key is provided
            if not openai_key and not gemini_key:
                error_data = {
                    "error": "No API keys provided. Please configure OpenAI or Gemini API keys.",
                    "models": []
                }
                self.wfile.write(json.dumps(error_data).encode())
                return

            # Initialize LLM service with provided API keys
            llm_service = UnifiedLLMService(openai_api_key=openai_key, gemini_api_key=gemini_key)
            
            # Get available models
            models = llm_service.get_available_models()
            
            response_data = {
                "models": models,
                "total_count": len(models),
                "openai_available": llm_service.openai_client is not None,
                "gemini_available": llm_service.gemini_available
            }

            self.wfile.write(json.dumps(response_data).encode())

        except Exception as e:
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            error_data = {"error": str(e)}
            self.wfile.write(json.dumps(error_data).encode())
            print(f"❌ Error in models handler: {str(e)}")

    def do_OPTIONS(self):
        # Handle CORS preflight
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-OpenAI-Key, X-Gemini-Key")
        self.end_headers()