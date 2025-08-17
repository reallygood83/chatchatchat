import os
import json
import time
from typing import List, Dict, Any, Optional, AsyncGenerator, Tuple
import openai
from openai import OpenAI
import google.generativeai as genai
from google.generativeai import GenerativeModel
from models import DocumentData, ChatMessage

class UnifiedLLMService:
    """Unified service for both OpenAI and Google Gemini models"""
    
    def __init__(self, openai_api_key: str = None, gemini_api_key: str = None):
        # Initialize OpenAI
        if not openai_api_key:
            openai_api_key = os.environ.get("OPENAI_API_KEY")
        
        self.openai_client = None
        if openai_api_key:
            try:
                self.openai_client = OpenAI(api_key=openai_api_key)
                print("✅ OpenAI client initialized")
            except Exception as e:
                print(f"❌ OpenAI initialization failed: {e}")
        
        # Initialize Google Gemini
        if not gemini_api_key:
            gemini_api_key = os.environ.get("GEMINI_API_KEY")
        
        self.gemini_available = False
        if gemini_api_key:
            try:
                genai.configure(api_key=gemini_api_key)
                # Test the configuration
                list(genai.list_models(page_size=1))
                self.gemini_available = True
                print("✅ Google Gemini client initialized")
            except Exception as e:
                print(f"❌ Gemini initialization failed: {e}")

    def get_available_models(self) -> List[Dict[str, Any]]:
        """Get list of available models based on configured API keys"""
        models = []
        
        # OpenAI models
        if self.openai_client:
            models.extend([
                {
                    "id": "gpt-4o",
                    "name": "GPT-4o",
                    "provider": "openai",
                    "tier": "premium",
                    "input_cost_per_1k": 0.0050,
                    "output_cost_per_1k": 0.0150,
                    "context_window": 128000
                },
                {
                    "id": "gpt-4o-mini",
                    "name": "GPT-4o Mini",
                    "provider": "openai", 
                    "tier": "standard",
                    "input_cost_per_1k": 0.000150,
                    "output_cost_per_1k": 0.000600,
                    "context_window": 128000
                },
                {
                    "id": "gpt-3.5-turbo",
                    "name": "GPT-3.5 Turbo",
                    "provider": "openai",
                    "tier": "basic",
                    "input_cost_per_1k": 0.0005,
                    "output_cost_per_1k": 0.0015,
                    "context_window": 16385
                }
            ])
        
        # Google Gemini models
        if self.gemini_available:
            models.extend([
                {
                    "id": "gemini-2.0-flash-exp",
                    "name": "Gemini 2.0 Flash",
                    "provider": "google",
                    "tier": "premium",
                    "input_cost_per_1k": 0.000075,
                    "output_cost_per_1k": 0.0003,
                    "context_window": 1000000
                },
                {
                    "id": "gemini-1.5-pro",
                    "name": "Gemini 1.5 Pro",
                    "provider": "google",
                    "tier": "premium", 
                    "input_cost_per_1k": 0.00125,
                    "output_cost_per_1k": 0.005,
                    "context_window": 2000000
                },
                {
                    "id": "gemini-1.5-flash",
                    "name": "Gemini 1.5 Flash",
                    "provider": "google",
                    "tier": "standard",
                    "input_cost_per_1k": 0.000075,
                    "output_cost_per_1k": 0.0003,
                    "context_window": 1000000
                },
                {
                    "id": "gemini-1.0-pro",
                    "name": "Gemini 1.0 Pro", 
                    "provider": "google",
                    "tier": "basic",
                    "input_cost_per_1k": 0.0005,
                    "output_cost_per_1k": 0.0015,
                    "context_window": 30720
                }
            ])
        
        return models

    def get_model_info(self, model_id: str) -> Optional[Dict[str, Any]]:
        """Get information about a specific model"""
        for model in self.get_available_models():
            if model["id"] == model_id:
                return model
        return None

    def is_openai_model(self, model_id: str) -> bool:
        """Check if model is an OpenAI model"""
        return model_id.startswith("gpt-")

    def is_gemini_model(self, model_id: str) -> bool:
        """Check if model is a Gemini model"""
        return model_id.startswith("gemini-")

    async def analyze_documents_for_question(
        self, 
        question: str, 
        documents: List[DocumentData], 
        description: str,
        model: str = "gpt-4o-mini"
    ) -> Tuple[List[int], float]:
        """Analyze which documents are most relevant to the question"""
        
        if not documents:
            return [], 0.0

        # Create document summaries for analysis
        doc_summaries = []
        for doc in documents:
            # Get first few pages for summary (limit context)
            summary_pages = doc.pages[:3]  # First 3 pages
            summary_text = " ".join([page.text[:500] for page in summary_pages])  # First 500 chars per page
            doc_summaries.append({
                "id": doc.id,
                "filename": doc.filename,
                "total_pages": doc.total_pages,
                "summary": summary_text[:1000]  # Limit to 1000 chars
            })

        prompt = f"""Collection Description: {description}

Question: {question}

Available Documents:
{json.dumps(doc_summaries, indent=2)}

Analyze which documents are most likely to contain information relevant to answering the question.
Consider the document filenames, content summaries, and the question context.

Return a JSON response with:
- "relevant_documents": array of document IDs (max 10) ranked by relevance
- "reasoning": brief explanation of why these documents were selected

Format: {{"relevant_documents": [1, 3, 5], "reasoning": "Selected documents focus on..."}}"""

        try:
            if self.is_openai_model(model):
                response = await self._call_openai_chat(prompt, model)
            else:
                response = await self._call_gemini_chat(prompt, model)
            
            # Parse response
            result = json.loads(response.strip())
            selected_docs = result.get("relevant_documents", [])
            reasoning = result.get("reasoning", "")
            
            print(f"📄 Document Selection: {selected_docs}")
            print(f"🤔 Reasoning: {reasoning}")
            
            # Calculate cost (simplified)
            input_tokens = len(prompt) // 4  # Rough estimate
            output_tokens = len(response) // 4
            cost = self._calculate_cost(model, input_tokens, output_tokens)
            
            return selected_docs, cost
            
        except Exception as e:
            print(f"❌ Error in document analysis: {e}")
            # Fallback: return first few documents
            fallback_docs = [doc.id for doc in documents[:5]]
            return fallback_docs, 0.0

    async def find_relevant_pages(
        self, 
        question: str, 
        documents: List[DocumentData], 
        selected_doc_ids: List[int],
        model: str = "gpt-4o-mini"
    ) -> Tuple[List[Dict], float]:
        """Find the most relevant pages within selected documents"""
        
        relevant_pages = []
        total_cost = 0.0
        
        for doc_id in selected_doc_ids:
            # Find the document
            document = next((doc for doc in documents if doc.id == doc_id), None)
            if not document:
                continue
                
            # Analyze pages in batches to avoid context limits
            pages_per_batch = 5
            for i in range(0, len(document.pages), pages_per_batch):
                batch_pages = document.pages[i:i+pages_per_batch]
                
                page_content = []
                for page in batch_pages:
                    # Limit page content to avoid context overflow
                    content = page.text[:2000] if len(page.text) > 2000 else page.text
                    page_content.append({
                        "page_number": page.page_number,
                        "content": content
                    })

                prompt = f"""Question: {question}

Document: {document.filename}
Pages to analyze:
{json.dumps(page_content, indent=2)}

Analyze which of these pages contain information most relevant to answering the question.
Score each page from 0-10 based on relevance to the question.

Return a JSON response with:
- "relevant_pages": array of objects with "page_number" and "relevance_score" (only include pages with score >= 6)
- "reasoning": brief explanation

Format: {{"relevant_pages": [{{"page_number": 1, "relevance_score": 8}}], "reasoning": "Page 1 contains..."}}"""

                try:
                    if self.is_openai_model(model):
                        response = await self._call_openai_chat(prompt, model)
                    else:
                        response = await self._call_gemini_chat(prompt, model)
                    
                    result = json.loads(response.strip())
                    batch_relevant = result.get("relevant_pages", [])
                    
                    # Add document info to relevant pages
                    for page_info in batch_relevant:
                        relevant_pages.append({
                            "document_id": doc_id,
                            "document_filename": document.filename,
                            "page_number": page_info["page_number"],
                            "relevance_score": page_info["relevance_score"],
                            "content": next(p.text for p in batch_pages if p.page_number == page_info["page_number"])
                        })
                    
                    # Calculate cost
                    input_tokens = len(prompt) // 4
                    output_tokens = len(response) // 4
                    total_cost += self._calculate_cost(model, input_tokens, output_tokens)
                    
                except Exception as e:
                    print(f"❌ Error analyzing pages in {document.filename}: {e}")
                    continue

        # Sort by relevance score and limit to top pages
        relevant_pages.sort(key=lambda x: x["relevance_score"], reverse=True)
        top_pages = relevant_pages[:10]  # Limit to top 10 pages
        
        print(f"📑 Found {len(top_pages)} relevant pages")
        return top_pages, total_cost

    async def generate_answer(
        self, 
        question: str, 
        relevant_pages: List[Dict], 
        chat_history: List[ChatMessage],
        model: str = "gpt-4o-mini"
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Generate streaming answer based on relevant pages"""
        
        # Prepare context from relevant pages
        context_parts = []
        for page in relevant_pages:
            context_parts.append(f"Document: {page['document_filename']}, Page {page['page_number']}:\n{page['content'][:1500]}")
        
        context = "\n\n".join(context_parts)
        
        # Prepare chat history
        history_text = ""
        if chat_history:
            for msg in chat_history[-5:]:  # Last 5 messages for context
                history_text += f"{msg.role.title()}: {msg.content}\n"
        
        prompt = f"""You are a helpful AI assistant that answers questions based on provided document content.

{f"Previous conversation context:\n{history_text}\n" if history_text else ""}

Current question: {question}

Relevant document content:
{context}

Please provide a comprehensive answer based on the document content above. 
- Use specific information from the documents
- Cite the document names and page numbers when referencing information
- If the documents don't contain enough information, acknowledge this
- Be helpful and conversational while staying accurate to the source material

Answer:"""

        try:
            if self.is_openai_model(model):
                async for chunk in self._stream_openai_response(prompt, model):
                    yield chunk
            else:
                async for chunk in self._stream_gemini_response(prompt, model):
                    yield chunk
                    
        except Exception as e:
            yield {"type": "error", "error": f"Error generating response: {str(e)}"}

    async def _call_openai_chat(self, prompt: str, model: str) -> str:
        """Make a chat completion call to OpenAI"""
        if not self.openai_client:
            raise Exception("OpenAI client not initialized")
        
        response = self.openai_client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=1500
        )
        
        return response.choices[0].message.content

    async def _call_gemini_chat(self, prompt: str, model: str) -> str:
        """Make a chat completion call to Gemini"""
        if not self.gemini_available:
            raise Exception("Gemini client not available")
        
        # Map model IDs to Gemini model names
        model_mapping = {
            "gemini-2.0-flash-exp": "gemini-2.0-flash-exp",
            "gemini-1.5-pro": "gemini-1.5-pro-latest",
            "gemini-1.5-flash": "gemini-1.5-flash-latest",
            "gemini-1.0-pro": "gemini-1.0-pro-latest"
        }
        
        gemini_model = GenerativeModel(model_mapping.get(model, "gemini-1.5-flash-latest"))
        response = gemini_model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.1,
                max_output_tokens=1500,
            )
        )
        
        return response.text

    async def _stream_openai_response(self, prompt: str, model: str) -> AsyncGenerator[Dict[str, Any], None]:
        """Stream response from OpenAI"""
        if not self.openai_client:
            raise Exception("OpenAI client not initialized")
        
        try:
            stream = self.openai_client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=2000,
                stream=True
            )
            
            full_response = ""
            for chunk in stream:
                if chunk.choices[0].delta.content is not None:
                    content = chunk.choices[0].delta.content
                    full_response += content
                    yield {
                        "type": "content",
                        "content": content,
                        "delta": content
                    }
            
            # Calculate final cost
            input_tokens = len(prompt) // 4
            output_tokens = len(full_response) // 4
            cost = self._calculate_cost(model, input_tokens, output_tokens)
            
            yield {
                "type": "done",
                "cost": cost,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens
            }
            
        except Exception as e:
            yield {"type": "error", "error": str(e)}

    async def _stream_gemini_response(self, prompt: str, model: str) -> AsyncGenerator[Dict[str, Any], None]:
        """Stream response from Gemini"""
        if not self.gemini_available:
            raise Exception("Gemini client not available")
        
        try:
            # Map model IDs
            model_mapping = {
                "gemini-2.0-flash-exp": "gemini-2.0-flash-exp",
                "gemini-1.5-pro": "gemini-1.5-pro-latest",
                "gemini-1.5-flash": "gemini-1.5-flash-latest", 
                "gemini-1.0-pro": "gemini-1.0-pro-latest"
            }
            
            gemini_model = GenerativeModel(model_mapping.get(model, "gemini-1.5-flash-latest"))
            response = gemini_model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=0.3,
                    max_output_tokens=2000,
                ),
                stream=True
            )
            
            full_response = ""
            for chunk in response:
                if chunk.text:
                    content = chunk.text
                    full_response += content
                    yield {
                        "type": "content",
                        "content": content,
                        "delta": content
                    }
            
            # Calculate final cost
            input_tokens = len(prompt) // 4
            output_tokens = len(full_response) // 4
            cost = self._calculate_cost(model, input_tokens, output_tokens)
            
            yield {
                "type": "done",
                "cost": cost,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens
            }
            
        except Exception as e:
            yield {"type": "error", "error": str(e)}

    def _calculate_cost(self, model: str, input_tokens: int, output_tokens: int) -> float:
        """Calculate cost based on model and token usage"""
        model_info = self.get_model_info(model)
        if not model_info:
            return 0.0
        
        input_cost = (input_tokens / 1000) * model_info["input_cost_per_1k"]
        output_cost = (output_tokens / 1000) * model_info["output_cost_per_1k"]
        
        return input_cost + output_cost