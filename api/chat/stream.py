import sys
import os
import json
import time
import asyncio
from http.server import BaseHTTPRequestHandler
from typing import Optional

# Add the backend directory to the Python path
backend_path = os.path.join(os.path.dirname(__file__), "..", "..", "backend")
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from models import ChatRequest, DocumentData, DocumentPage
from unified_llm_service import UnifiedLLMService


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            # Set CORS headers for streaming
            self.send_response(200)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type, X-OpenAI-Key, X-Gemini-Key")
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "keep-alive")
            self.end_headers()

            # Get API keys from headers
            openai_key = self.headers.get('X-OpenAI-Key')
            gemini_key = self.headers.get('X-Gemini-Key')

            # Read request body
            content_length = int(self.headers["Content-Length"])
            post_data = self.rfile.read(content_length)
            request_data = json.loads(post_data.decode("utf-8"))

            # Parse request using ChatRequest model
            request = ChatRequest(**request_data)

            # Initialize unified LLM service with API keys from headers
            llm_service = UnifiedLLMService(openai_api_key=openai_key, gemini_api_key=gemini_key)

            # Process the chat request and stream response
            asyncio.run(self._process_chat_request(request, llm_service))

        except Exception as e:
            error_data = {"type": "error", "error": str(e)}
            self.wfile.write(f"data: {json.dumps(error_data)}\n\n".encode())
            print(f"❌ Error in chat handler: {str(e)}")

    async def _process_chat_request(self, request: ChatRequest, llm_service: UnifiedLLMService):
        """Process chat request with streaming response - matches backend/main.py logic"""
        start_time = time.time()
        print(f"🌊 Streaming chat request started")
        print(f"📝 Question: {request.question}")
        print(f"📊 Received {len(request.documents)} documents")

        try:
            total_cost = 0.0

            # Convert DocumentData to the format expected by LLMService
            documents_dict = []
            for doc in request.documents:
                pages_dict = []
                for page in doc.pages:
                    pages_dict.append(
                        {"page_number": page.page_number, "text": page.text}
                    )

                documents_dict.append(
                    {
                        "id": doc.id,
                        "filename": doc.filename,
                        "pages": pages_dict,
                        "total_pages": doc.total_pages,
                    }
                )

            # Step 1: Select relevant documents
            step1_start = time.time()
            doc_selection_status = {
                "type": "status",
                "step": "document_selection",
                "message": "Finding relevant documents...",
                "step_number": 1,
                "total_steps": 3,
            }
            self._send_sse_data(doc_selection_status)

            print("⏱️ Step 1: Starting document selection...")
            # Convert DocumentData objects to the expected format
            doc_data_objects = []
            for doc_dict in documents_dict:
                pages = [DocumentPage(**page) for page in doc_dict["pages"]]
                doc_data_objects.append(DocumentData(
                    id=doc_dict["id"],
                    filename=doc_dict["filename"],
                    pages=pages,
                    total_pages=doc_dict["total_pages"]
                ))
                
            # Get selected document IDs
            selected_doc_ids, step1_cost = await llm_service.analyze_documents_for_question(
                request.question,
                doc_data_objects,
                request.description,
                request.model
            )
            
            # Filter to selected documents
            selected_docs = [doc for doc in documents_dict if doc["id"] in selected_doc_ids]
            total_cost += step1_cost
            step1_time = time.time() - step1_start
            print(f"✅ Step 1: Document selection completed in {step1_time:.2f}s")

            # Send completion status for document selection
            doc_selection_complete = {
                "type": "step_complete",
                "step": "document_selection",
                "selected_documents": [
                    {"id": doc["id"], "filename": doc["filename"]}
                    for doc in selected_docs
                ],
                "cost": step1_cost,
                "time_taken": step1_time,
            }
            self._send_sse_data(doc_selection_complete)

            # Step 2: Find relevant pages
            step2_start = time.time()
            page_selection_status = {
                "type": "status",
                "step": "page_selection",
                "message": "Finding relevant pages in selected documents...",
                "step_number": 2,
                "total_steps": 3,
            }
            self._send_sse_data(page_selection_status)

            print("⏱️ Step 2: Starting page selection...")
            # Process documents in parallel to maintain filename context

            async def process_document(doc):
                # Convert pages to DocumentPage objects for this document
                pages = [DocumentPage(**page) for page in doc["pages"]]
                doc_object = DocumentData(
                    id=doc["id"],
                    filename=doc["filename"], 
                    pages=pages,
                    total_pages=doc["total_pages"]
                )
                return await llm_service.find_relevant_pages(
                    request.question,
                    [doc_object],  # Pass as list since method expects List[DocumentData]
                    [doc["id"]],   # Selected doc IDs
                    request.model
                )

            # Create tasks for all documents
            doc_tasks = [process_document(doc) for doc in selected_docs]

            # Wait for all documents to complete
            doc_results = await asyncio.gather(*doc_tasks)

            # Combine results
            all_relevant_pages = []
            step2_cost = 0.0
            for doc_relevant_pages, doc_cost in doc_results:
                all_relevant_pages.extend(doc_relevant_pages)
                step2_cost += doc_cost

            relevant_pages = all_relevant_pages
            total_cost += step2_cost
            step2_time = time.time() - step2_start
            print(f"✅ Step 2: Page selection completed in {step2_time:.2f}s")

            # Send completion status for page selection
            page_selection_complete = {
                "type": "step_complete",
                "step": "page_selection",
                "relevant_pages_count": len(relevant_pages),
                "cost": step2_cost,
                "time_taken": step2_time,
            }
            self._send_sse_data(page_selection_complete)

            # Step 3: Generate answer
            step3_start = time.time()
            answer_generation_status = {
                "type": "status",
                "step": "answer_generation",
                "message": "Generating comprehensive answer...",
                "step_number": 3,
                "total_steps": 3,
            }
            self._send_sse_data(answer_generation_status)

            print("⏱️ Step 3: Starting answer generation...")

            # Stream the answer generation
            async for chunk in llm_service.generate_answer(
                request.question, relevant_pages, request.chat_history, request.model
            ):
                if chunk.get("type") == "content":
                    content_data = {
                        "type": "content",
                        "content": chunk["content"],
                    }
                    self._send_sse_data(content_data)
                elif chunk.get("type") == "cost":
                    total_cost += chunk["cost"]

            step3_time = time.time() - step3_start
            print(f"✅ Step 3: Answer generation completed in {step3_time:.2f}s")

            # Send final completion
            total_time = time.time() - start_time
            completion_data = {
                "type": "complete",
                "timing_breakdown": {
                    "document_selection": step1_time,
                    "page_detection": step2_time,
                    "answer_generation": step3_time,
                    "total_time": total_time,
                },
                "cost_breakdown": {
                    "document_selection": step1_cost,
                    "page_detection": step2_cost,
                    "answer_generation": total_cost - step1_cost - step2_cost,
                    "total_cost": total_cost,
                },
            }
            self._send_sse_data(completion_data)

            print(
                f"🎉 Request completed in {total_time:.2f}s, total cost: ${total_cost:.4f}"
            )

        except Exception as e:
            error_data = {"type": "error", "error": str(e)}
            self._send_sse_data(error_data)
            print(f"❌ Error in stream_response: {str(e)}")

    def _send_sse_data(self, data: dict):
        """Helper method to send SSE data"""
        sse_data = f"data: {json.dumps(data)}\n\n"
        self.wfile.write(sse_data.encode())
        self.wfile.flush()

    def do_OPTIONS(self):
        # Handle CORS preflight
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-OpenAI-Key, X-Gemini-Key")
        self.end_headers()

    def do_GET(self):
        # Add GET method for testing
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Type", "application/json")
        self.end_headers()

        response_data = {
            "message": "Chat stream endpoint",
            "method": "POST",
            "description": "Use POST method to send chat requests with API keys in headers",
            "headers": {
                "X-OpenAI-Key": "Optional OpenAI API key",
                "X-Gemini-Key": "Optional Google Gemini API key"
            }
        }

        self.wfile.write(json.dumps(response_data).encode())