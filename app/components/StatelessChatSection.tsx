'use client';

import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, Upload, X, FileText, Eye, EyeOff, Settings, Plus, Trash2, Edit2, Check, RotateCcw, ChevronDown, ChevronLeft, ChevronRight, PanelLeftOpen, PanelLeftClose } from 'lucide-react';
import config from '../../config';
import ChunkedUploader from '../utils/chunkedUpload';
import { getStoredApiKeys } from '../utils/apiKeys';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  progress?: {
    status: string;
    step: number;
    total: number;
    stepCost?: number;
    stepTime?: number;
  };
  metadata?: {
    selectedDocuments?: Array<{id: number, filename: string}>;
    relevantPagesCount?: number;
    timing?: {
      document_selection?: number;
      page_detection?: number;
      answer_generation?: number;
      total_time?: number;
    };
    costs?: {
      document_selection?: number;
      page_detection?: number;
      answer_generation?: number;
      total_cost?: number;
    };
    model?: string;
  };
}

interface DocumentData {
  id: number;
  filename: string;
  pages: Array<{
    page_number: number;
    text: string;
  }>;
  total_pages: number;
}

interface AvailableModel {
  id: string;
  name: string;
  provider: string;
  tier: string;
  input_cost_per_1k: number;
  output_cost_per_1k: number;
  context_window: number;
}

interface StatelessChatSectionProps {
  documents: DocumentData[];
  description: string;
  onReset: () => void;
  onUpdateDocuments: (documents: DocumentData[]) => void;
  onUpdateDescription: (description: string) => void;
}

export default function StatelessChatSection({ 
  documents, 
  description, 
  onReset, 
  onUpdateDocuments, 
  onUpdateDescription 
}: StatelessChatSectionProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showDocuments, setShowDocuments] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>('gpt-4o-mini');
  const [availableModels, setAvailableModels] = useState<AvailableModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedDescription, setEditedDescription] = useState('');
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [selectedNewFiles, setSelectedNewFiles] = useState<File[]>([]);
  const [showUploadSection, setShowUploadSection] = useState(true);
  const [uploadError, setUploadError] = useState('');
  const [uploadProgress, setUploadProgress] = useState<{
    percentComplete: number;
    processedFiles: number;
    totalFiles: number;
    currentChunk: number;
    totalChunks: number;
    isChunked: boolean;
  } | null>(null);
  const [totalSessionCost, setTotalSessionCost] = useState<number>(0);
  const [selectedPageContent, setSelectedPageContent] = useState<{
    content: string;
    pageNumber: number;
    filename: string;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load available models on component mount and when API keys change
  useEffect(() => {
    loadAvailableModels();
    
    // Listen for storage changes (when keys are updated in settings)
    const handleStorageChange = () => {
      console.log('Storage changed, reloading models...');
      loadAvailableModels();
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', loadAvailableModels); // Reload when returning to tab
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', loadAvailableModels);
    };
  }, []);

  const loadAvailableModels = async () => {
    try {
      setIsLoadingModels(true);
      const apiKeys = getStoredApiKeys();
      
      // Check if any API keys are available
      if (!apiKeys.openai && !apiKeys.gemini) {
        console.log('No API keys configured, using fallback models');
        setAvailableModels([
          {
            id: 'gpt-4o-mini',
            name: 'GPT-4o Mini (API 키 필요)',
            provider: 'openai',
            tier: 'standard',
            input_cost_per_1k: 0.000150,
            output_cost_per_1k: 0.000600,
            context_window: 128000
          }
        ]);
        return;
      }
      
      const response = await fetch(`${config.apiBaseUrl}/models`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKeys.openai && { 'X-OpenAI-Key': apiKeys.openai }),
          ...(apiKeys.gemini && { 'X-Gemini-Key': apiKeys.gemini }),
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load models');
      }

      const data = await response.json();
      
      // Handle case where API returns error with 200 status
      if (data.error) {
        console.warn('Models API returned error:', data.error);
        throw new Error(data.error);
      }
      
      if (data.models && Array.isArray(data.models) && data.models.length > 0) {
        setAvailableModels(data.models);
        
        // Set default model based on available models
        const defaultModel = data.models.find((m: AvailableModel) => m.id === 'gpt-4o-mini') || data.models[0];
        setSelectedModel(defaultModel.id);
        console.log(`Loaded ${data.models.length} models, selected: ${defaultModel.name}`);
      } else {
        throw new Error('No models available');
      }
    } catch (error) {
      console.error('Error loading models:', error);
      // Fallback to basic models if API fails
      setAvailableModels([
        {
          id: 'gpt-4o-mini',
          name: 'GPT-4o Mini (설정 필요)',
          provider: 'openai',
          tier: 'standard',
          input_cost_per_1k: 0.000150,
          output_cost_per_1k: 0.000600,
          context_window: 128000
        }
      ]);
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleSendMessage = async () => {
    if (!currentQuestion.trim() || isLoading) return;

    const question = currentQuestion;
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: question,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setCurrentQuestion('');
    setIsLoading(true);

    // Create assistant message placeholder for streaming
    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
      progress: {
        status: 'Starting...',
        step: 0,
        total: 3,
      },
      metadata: {
        selectedDocuments: [],
        relevantPagesCount: 0,
      },
    };
    
    setMessages(prev => [...prev, assistantMessage]);

    try {
      const apiKeys = getStoredApiKeys();
      
      const response = await fetch(`${config.apiBaseUrl}/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKeys.openai && { 'X-OpenAI-Key': apiKeys.openai }),
          ...(apiKeys.gemini && { 'X-Gemini-Key': apiKeys.gemini }),
        },
        body: JSON.stringify({
          question: question,
          documents: documents,
          description: description,
          model: selectedModel,
          chat_history: messages.map(msg => ({
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp.toISOString()
          }))
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No reader available');
      }

      let accumulatedContent = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'status') {
                setMessages(prev => prev.map(msg => 
                  msg.id === assistantMessageId 
                    ? {
                        ...msg,
                        progress: {
                          status: data.message,
                          step: data.step_number,
                          total: data.total_steps,
                        }
                      }
                    : msg
                ));
              } else if (data.type === 'step_complete') {
                setMessages(prev => prev.map(msg => 
                  msg.id === assistantMessageId 
                    ? {
                        ...msg,
                        progress: {
                          ...msg.progress!,
                          stepCost: data.cost,
                          stepTime: data.time_taken,
                        },
                        metadata: {
                          ...msg.metadata,
                          ...(data.step === 'document_selection' && {
                            selectedDocuments: data.selected_documents,
                          }),
                          ...(data.step === 'page_selection' && {
                            relevantPagesCount: data.relevant_pages_count,
                          }),
                        }
                      }
                    : msg
                ));
              } else if (data.type === 'content') {
                accumulatedContent += data.content;
                setMessages(prev => prev.map(msg => 
                  msg.id === assistantMessageId 
                    ? { ...msg, content: accumulatedContent }
                    : msg
                ));
              } else if (data.type === 'complete') {
                if (data.cost_breakdown?.total_cost) {
                  setTotalSessionCost(prev => prev + data.cost_breakdown.total_cost);
                }
                
                setMessages(prev => prev.map(msg => 
                  msg.id === assistantMessageId 
                    ? {
                        ...msg,
                        isStreaming: false,
                        progress: undefined,
                        metadata: {
                          ...msg.metadata,
                          timing: data.timing_breakdown,
                          costs: data.cost_breakdown,
                          model: selectedModel
                        }
                      }
                    : msg
                ));
                
                // Reset loading state when streaming is complete
                setIsLoading(false);
              } else if (data.type === 'error') {
                throw new Error(data.error);
              }
            } catch (parseError) {
              console.warn('Failed to parse SSE data:', line);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? {
              ...msg,
              content: 'Sorry, I encountered an error while processing your question. Please try again.',
              isStreaming: false,
              progress: undefined
            }
          : msg
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleEditDescription = () => {
    setEditedDescription(description);
    setIsEditingDescription(true);
  };

  const handleSaveDescription = () => {
    if (!editedDescription.trim()) {
      return;
    }
    onUpdateDescription(editedDescription);
    setIsEditingDescription(false);
  };

  const handleCancelEdit = () => {
    setIsEditingDescription(false);
    setEditedDescription('');
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    if (files.length > 100) {
      setUploadError('최대 100개 파일만 허용됩니다');
      return;
    }

    const invalidFiles = files.filter(file => !file.name.endsWith('.pdf'));
    if (invalidFiles.length > 0) {
      setUploadError('PDF 파일만 허용됩니다');
      return;
    }

    const currentCount = documents.length;
    if (currentCount + files.length > 100) {
      setUploadError(`${files.length}개 파일을 추가하면 100개 문서 제한을 초과합니다. 현재: ${currentCount}개`);
      return;
    }

    const existingFilenames = documents?.map(doc => doc?.filename).filter(Boolean) || [];
    const duplicateFiles = files.filter(file => existingFilenames.includes(file.name));
    if (duplicateFiles.length > 0) {
      setUploadError(`이미 존재하는 파일: ${duplicateFiles.map(f => f.name).join(', ')}`);
      return;
    }

    setSelectedNewFiles(files);
    setUploadError('');
  };

  const removeNewFile = (index: number) => {
    setSelectedNewFiles(files => files.filter((_, i) => i !== index));
  };

  const handleUploadNewFiles = async () => {
    if (selectedNewFiles.length === 0) {
      setUploadError('최소 하나의 PDF 파일을 선택해주세요');
      return;
    }

    setIsUploadingFiles(true);
    setUploadError('');
    setUploadProgress(null);

    try {
      // Check if chunking will be needed
      const needsChunking = ChunkedUploader.needsChunking(selectedNewFiles);
      
      // Use the new ChunkedUploader
      const result = await ChunkedUploader.upload({
        endpoint: `${config.apiBaseUrl}/upload`,
        files: selectedNewFiles,
        description: description,
        onProgress: (progress) => {
          setUploadProgress({
            ...progress,
            isChunked: needsChunking
          });
          console.log(`Upload progress: ${progress.percentComplete}% (${progress.processedFiles}/${progress.totalFiles} files, chunk ${progress.currentChunk}/${progress.totalChunks})`);
        },
        onChunkComplete: (chunkIndex, totalChunks) => {
          console.log(`Completed chunk ${chunkIndex + 1} of ${totalChunks}`);
        }
      });

      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
      }

      console.log('Upload response:', result);
      
      // Validate the response format
      if (!result.documents || !Array.isArray(result.documents)) {
        console.error('Invalid response format. Expected documents array, got:', result);
        throw new Error(`Invalid response format from server. Expected documents array, got: ${JSON.stringify(result, null, 2)}`);
      }
      
      // Get the highest existing ID
      const maxId = documents && documents.length > 0 ? Math.max(...documents.map(d => d?.id || 0).filter(id => id > 0)) : 0;
      
      // Update IDs for new documents
      const newDocuments = result.documents.map((doc: DocumentData, index: number) => ({
        ...doc,
        id: maxId + index + 1
      }));
      
      // Add to existing documents
      onUpdateDocuments([...documents, ...newDocuments]);
      
      setSelectedNewFiles([]);
      setShowUploadSection(false);
      
      // Show success message with chunking info
      const uploadMessage = result.chunked 
        ? `Successfully uploaded ${result.totalFiles} files using ${ChunkedUploader.estimateChunks(selectedNewFiles)} chunks`
        : `Successfully uploaded ${result.totalFiles} files`;
      
      console.log(uploadMessage);
      
    } catch (error) {
      console.error('Upload error:', error);
      setUploadError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsUploadingFiles(false);
      setUploadProgress(null);
    }
  };

  const handleCancelUpload = () => {
    setSelectedNewFiles([]);
    setShowUploadSection(false);
    setUploadError('');
  };

  const handleDeleteDocument = (documentId: number) => {
    // Confirm deletion
    if (confirm('이 문서를 삭제하시겠습니까?')) {
      const updatedDocuments = documents.filter(doc => doc.id !== documentId);
      onUpdateDocuments(updatedDocuments);
      
      // If no documents left, clear description as well
      if (updatedDocuments.length === 0) {
        onUpdateDescription('');
      }
    }
  };

  // Function to process page references in content before markdown
  const processPageReferences = (content: string): string => {
    if (!content.includes('$PAGE_START')) {
      return content;
    }
    
    // Parse special markers: $PAGE_STARTfilename:pages$PAGE_END
    const pageRefRegex = /\$PAGE_START([^:]+):([^\$]+)\$PAGE_END/g;
    
    // Replace markers with markdown links
    const processedContent = content.replace(pageRefRegex, (match, filename, pageSpec) => {
      const cleanFilename = filename.trim();
      const cleanPageSpec = pageSpec.trim();
      
      // Convert to markdown link format with special data attributes
      return `[${cleanFilename} (Page ${cleanPageSpec})](javascript:void(0) "data-page-ref=${cleanFilename}:${cleanPageSpec}")`;
    });
    
    return processedContent;
  };

  // Helper function to parse page specifications like "5", "2,7,12", "15-18"
  const parsePageSpecification = (pageSpec: string): number[] => {
    const pages: number[] = [];
    
    // Split by commas for multiple pages/ranges
    const parts = pageSpec.split(',');
    
    parts.forEach(part => {
      part = part.trim();
      
      if (part.includes('-')) {
        // Handle range like "15-18"
        const [start, end] = part.split('-').map(p => parseInt(p.trim()));
        if (start && end && start <= end) {
          for (let i = start; i <= end; i++) {
            pages.push(i);
          }
        }
      } else {
        // Handle single page
        const pageNum = parseInt(part);
        if (pageNum) {
          pages.push(pageNum);
        }
      }
    });
    
    return pages;
  };

  const handlePageReference = (filename: string, pageNumber: number) => {
    // Find the document and page content
    const document = documents.find(doc => doc.filename === filename);
    if (!document) {
      console.error('Document not found:', filename);
      return;
    }
    
    const page = document.pages.find(p => p.page_number === pageNumber);
    if (!page) {
      console.error('Page not found:', pageNumber, 'in', filename);
      return;
    }
    
    setSelectedPageContent({
      content: page.text,
      pageNumber: pageNumber,
      filename: filename
    });
  };

  return (
    <div className={`bg-white rounded-lg shadow-lg flex h-full ${isFullscreen ? 'fixed inset-0 z-50 rounded-none' : 'flex-col'}`}>
      {/* Sidebar for Documents and Settings */}
      <div className={`${showSidebar ? 'w-80' : 'w-0'} transition-all duration-300 overflow-hidden border-r border-gray-200 bg-gray-50 flex-shrink-0`}>
        {showSidebar && (
          <div className="p-4 h-full overflow-y-auto">
            {/* Document Management */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">문서 관리</h3>
              
              {/* Upload Section */}
              <div className="mb-4">
                <button
                  onClick={() => setShowUploadSection(!showUploadSection)}
                  className="w-full bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 rounded text-sm font-medium mb-3"
                >
                  {documents.length === 0 ? "첫 번째 문서 추가" : "파일 추가"}
                </button>
                
                {showUploadSection && (
                  <div className="bg-white rounded-lg p-4 border">
                    <h4 className="text-md font-medium text-gray-800 mb-3">새 문서 추가</h4>
                    
                    <div className="mb-4">
                      <div 
                        className="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center hover:border-gray-400 transition-colors cursor-pointer"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          multiple
                          accept=".pdf"
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                        <div className="text-gray-600">
                          <svg className="mx-auto h-6 w-6 text-gray-400 mb-2" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          <p className="text-xs">PDF 파일 선택</p>
                        </div>
                      </div>
                    </div>
                    
                    {selectedNewFiles.length > 0 && (
                      <div className="mb-4">
                        <h5 className="text-sm font-medium text-gray-700 mb-2">
                          선택된 파일 ({selectedNewFiles.length}개)
                        </h5>
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                          {selectedNewFiles.map((file, index) => (
                            <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded border">
                              <span className="text-xs text-gray-700 truncate">{file.name}</span>
                              <button
                                onClick={() => removeNewFile(index)}
                                className="text-red-500 hover:text-red-700 flex-shrink-0 ml-2"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {uploadError && (
                      <div className="mb-4 p-2 bg-red-50 border border-red-200 rounded-md">
                        <p className="text-red-600 text-xs">{uploadError}</p>
                      </div>
                    )}
                    
                    <div className="flex space-x-2">
                      <button
                        onClick={handleUploadNewFiles}
                        disabled={isUploadingFiles || selectedNewFiles.length === 0}
                        className="bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-xs flex-1"
                      >
                        {isUploadingFiles ? '업로드 중...' : '업로드'}
                      </button>
                      <button
                        onClick={handleCancelUpload}
                        className="bg-gray-500 text-white px-3 py-2 rounded hover:bg-gray-600 text-xs"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Document List */}
              {documents.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-700">업로드된 문서 ({documents.length}개)</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {documents.map((doc, index) => (
                      <div key={index} className="bg-white p-3 rounded border border-gray-200">
                        <div className="flex items-start space-x-2">
                          <FileText className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-700 truncate" title={doc.filename}>
                              {doc.filename}
                            </p>
                            <p className="text-xs text-gray-500">
                              ID {doc.id} • {doc.total_pages}페이지
                            </p>
                          </div>
                          <button
                            onClick={() => handleDeleteDocument(doc.id)}
                            className="text-red-500 hover:text-red-700 p-1"
                            title="문서 삭제"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* Model Selection */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">AI 모델</h3>
              <div className="space-y-3">
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  disabled={isLoading || isLoadingModels}
                  className="w-full px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {isLoadingModels ? (
                    <option value="">모델 로딩 중...</option>
                  ) : availableModels.length === 0 ? (
                    <option value="">API 키를 설정해주세요</option>
                  ) : (
                    availableModels.map((model) => {
                      const providerIcon = model.provider === 'openai' ? '🤖' : '🧠';
                      return (
                        <option key={model.id} value={model.id}>
                          {providerIcon} {model.name}
                        </option>
                      );
                    })
                  )}
                </select>
                
                {selectedModel && availableModels.length > 0 && (
                  <div className="p-2 bg-white rounded border text-xs text-gray-600 space-y-1">
                    {(() => {
                      const model = availableModels.find(m => m.id === selectedModel);
                      if (!model) return null;
                      return (
                        <>
                          <div className="flex justify-between">
                            <span>제공사:</span>
                            <span>{model.provider === 'openai' ? 'OpenAI' : 'Google'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>비용:</span>
                            <span>${(model.input_cost_per_1k * 1000).toFixed(2)}/1M</span>
                          </div>
                        </>
                      );
                    })()} 
                  </div>
                )}
              </div>
            </div>
            
            {/* Session Info */}
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">세션 정보</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">총 비용:</span>
                  <span className="font-medium text-green-600">${totalSessionCost.toFixed(4)}</span>
                </div>
                <button
                  onClick={onReset}
                  className="w-full text-gray-500 hover:text-gray-700 px-3 py-2 rounded border border-gray-300 hover:border-gray-400 text-sm"
                >
                  새 세션 시작
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Compact Header */}
        <div className="border-b border-gray-200 p-3 flex-shrink-0">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowSidebar(!showSidebar)}
                className="p-2 text-gray-500 hover:text-gray-700 rounded-md hover:bg-gray-100"
                title={showSidebar ? "사이드바 닫기" : "사이드바 열기"}
              >
                {showSidebar ? (
                  <PanelLeftClose className="w-5 h-5" />
                ) : (
                  <PanelLeftOpen className="w-5 h-5" />
                )}
              </button>
              
              <div>
                <h2 className="text-lg font-semibold text-gray-800">티보드 chat</h2>
                {documents.length > 0 && (
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">{documents.length}개 문서</span>
                    {description && (
                      <>
                        <span className="text-gray-400">•</span>
                        <span className="text-sm text-gray-600">{description}</span>
                        <button
                          onClick={handleEditDescription}
                          className="text-xs text-blue-600 hover:text-blue-800 ml-1"
                          title="설명 편집"
                        >
                          ✏️
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {documents.length === 0 && (
                <button
                  onClick={() => {
                    setShowSidebar(true);
                    setShowUploadSection(true);
                  }}
                  className="bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 rounded text-sm font-medium"
                >
                  첫 번째 문서 추가
                </button>
              )}
              
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-2 text-gray-500 hover:text-gray-700 rounded-md hover:bg-gray-100"
                title={isFullscreen ? "전체화면 종료" : "전체화면"}
              >
                {isFullscreen ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          
          {/* Edit Description Inline */}
          {isEditingDescription && (
            <div className="mt-3 flex items-center space-x-2">
              <input
                type="text"
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                className="flex-1 text-sm border border-gray-300 rounded px-3 py-2"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveDescription();
                  } else if (e.key === 'Escape') {
                    handleCancelEdit();
                  }
                }}
                placeholder="문서 사용 가이드 설명"
                autoFocus
              />
              <button
                onClick={handleSaveDescription}
                className="bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 text-sm"
              >
                저장
              </button>
              <button
                onClick={handleCancelEdit}
                className="bg-gray-500 text-white px-3 py-2 rounded hover:bg-gray-600 text-sm"
              >
                취소
              </button>
            </div>
          )}
        </div>

        {/* Messages Area - Maximum space for reading */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gradient-to-b from-gray-50 to-white">
        {documents.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-lg p-8">
              <div className="bg-blue-50 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
                <FileText className="w-12 h-12 text-blue-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">티보드 chat에 오신 것을 환영합니다!</h3>
              <p className="text-gray-600 mb-6 leading-relaxed">
                교육 자료와 대화를 시작하려면 PDF 문서를 업로드해주세요.<br/>
                교과서, 참고서, 논문, 보고서 등 모든 PDF 자료를 업로드할 수 있습니다.
              </p>
              <button
                onClick={() => {
                  setShowSidebar(true);
                  setShowUploadSection(true);
                }}
                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white text-lg font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-lg transition-all duration-200 hover:shadow-xl"
              >
                <Plus className="w-6 h-6 mr-2" />
                첫 번째 문서 추가하기
              </button>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-2xl p-8">
              <div className="bg-green-50 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-green-700 mb-4">문서 업로드 완료! 이제 질문해보세요.</h3>
              
              <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                <h4 className="font-semibold text-gray-800 mb-3">추천 질문 예시:</h4>
                <div className="space-y-2 text-left">
                  <div className="p-3 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                    <p className="text-sm font-medium text-blue-800">"이 문서의 핵심 내용을 3가지로 요약해주세요"</p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg border-l-4 border-green-400">
                    <p className="text-sm font-medium text-green-800">"[특정 주제]에 대해 어떻게 설명하고 있나요?"</p>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-lg border-l-4 border-purple-400">
                    <p className="text-sm font-medium text-purple-800">"이 내용으로 만들 수 있는 문제 5개를 추천해주세요"</p>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mt-4">
                  팁: 페이지 번호나 단원을 명시하면 더 정확한 답변을 받을 수 있습니다!
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[85%] p-4 rounded-xl shadow-sm ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-900 border border-gray-200'
              }`}
            >
              {/* Progress indicator for streaming messages */}
              {message.isStreaming && message.progress && (
                <div className="mb-3 p-3 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span className="text-sm font-medium text-blue-800">
                      {message.progress.status}
                    </span>
                  </div>
                  
                  <div className="w-full bg-blue-200 rounded-full h-2 mb-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${(message.progress.step / message.progress.total) * 100}%` }}
                    ></div>
                  </div>
                  
                  <div className="flex justify-between text-xs text-blue-600">
                    <span>Step {message.progress.step} of {message.progress.total}</span>
                    {message.progress.stepTime && message.progress.stepCost && (
                      <span>{message.progress.stepTime.toFixed(2)}s • ${message.progress.stepCost.toFixed(4)}</span>
                    )}
                  </div>
                </div>
              )}

              <div className="prose prose-lg max-w-none">
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                    a: ({ href, title, children }) => {
                      // Handle page reference links
                      if (title && title.startsWith('data-page-ref=')) {
                        const pageRef = title.replace('data-page-ref=', '');
                        const [filename, pageSpec] = pageRef.split(':');
                        const pages = parsePageSpecification(pageSpec);
                        
                        if (pages.length > 0) {
                          const pageNum = pages[0]; // Use first page for click
                          return (
                            <button
                              onClick={() => handlePageReference(filename, pageNum)}
                              className="text-blue-600 hover:text-blue-800 underline font-medium cursor-pointer mx-0.5"
                              title={`View ${filename} - Page ${pageNum} content`}
                            >
                              {children}
                            </button>
                          );
                        }
                      }
                      
                      // Regular links
                      return (
                        <a href={href} title={title} className="text-blue-600 hover:text-blue-800 underline">
                          {children}
                        </a>
                      );
                    },
                    h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-base font-bold mb-2">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-sm font-bold mb-1">{children}</h3>,
                    ul: ({ children }) => <ul className="list-disc ml-4 mb-2">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal ml-4 mb-2">{children}</ol>,
                    li: ({ children }) => <li className="mb-1">{children}</li>,
                    code: ({ children, ...props }) => {
                      const isInline = !props.className?.includes('language-');
                      const bgColor = message.role === 'user' ? 'bg-blue-700 bg-opacity-50' : 'bg-gray-200';
                      return isInline ? (
                        <code className={`${bgColor} px-1 rounded text-xs font-mono`}>{children}</code>
                      ) : (
                        <code className={`block ${bgColor} p-2 rounded text-xs font-mono whitespace-pre-wrap`}>{children}</code>
                      );
                    },
                    strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                    em: ({ children }) => <em className="italic">{children}</em>,
                  }}
                >
                  {processPageReferences(message.content)}
                </ReactMarkdown>
              </div>
              {message.metadata && (
                <div className="mt-2 text-xs opacity-60 space-y-1">
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {message.metadata.selectedDocuments && (
                      <span><span className="font-medium">문서:</span> {message.metadata.selectedDocuments.map(doc => `${doc.filename} (ID: ${doc.id})`).join(', ')}</span>
                    )}
                    {message.metadata.relevantPagesCount && (
                      <span><span className="font-medium">페이지:</span> {message.metadata.relevantPagesCount}</span>
                    )}
                    {message.metadata.model && (
                      <span><span className="font-medium">모델:</span> {message.metadata.model}</span>
                    )}
                    {message.metadata.timing?.total_time && (
                      <span><span className="font-medium">시간:</span> {message.metadata.timing.total_time.toFixed(1)}초</span>
                    )}
                    {message.metadata.costs?.total_cost && (
                      <span><span className="font-medium">비용:</span> ${message.metadata.costs.total_cost.toFixed(4)}</span>
                    )}
                  </div>
                </div>
              )}
              <p className={`text-xs mt-1 ${
                message.role === 'user' ? 'text-blue-200' : 'text-gray-500'
              }`}>
                {message.timestamp.toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}

          <div ref={messagesEndRef} />
        </div>

        {/* Enhanced Input Area */}
        <div className="border-t border-gray-200 bg-white p-4 flex-shrink-0">
          <div className="flex space-x-3">
            <div className="flex-1">
              <textarea
                value={currentQuestion}
                onChange={(e) => setCurrentQuestion(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={documents.length === 0 ? "문서를 업로드하고 질문해보세요..." : "업로드된 문서에 대해 질문해보세요... (예: '주요 내용을 요약해주세요', '특정 개념에 대해 설명해주세요')"}
                className="w-full px-4 py-3 text-gray-700 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-base leading-relaxed"
                rows={3}
                disabled={isLoading}
              />
              {currentQuestion.length > 0 && (
                <div className="mt-2 text-xs text-gray-500">
                  {currentQuestion.length} 글자 | Shift+Enter로 줄바꿈, Enter로 전송
                </div>
              )}
            </div>
            
            <div className="flex flex-col space-y-2">
              <button
                onClick={handleSendMessage}
                disabled={!currentQuestion.trim() || isLoading}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium text-base transition-colors duration-200 flex items-center justify-center min-w-[80px]"
              >
                {isLoading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
              
              {documents.length > 0 && (
                <div className="text-xs text-gray-500 text-center">
                  {availableModels.find(m => m.id === selectedModel)?.provider === 'openai' ? '🤖' : '🧠'}
                  <br/>
                  {availableModels.find(m => m.id === selectedModel)?.name.split(' ').slice(0, 2).join(' ')}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Page Content Modal */}
      {selectedPageContent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl max-h-[80vh] w-full flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">
                  {selectedPageContent.filename} - Page {selectedPageContent.pageNumber}
                </h3>
                <p className="text-sm text-gray-600">추출된 텍스트 내용</p>
              </div>
              <button
                onClick={() => setSelectedPageContent(null)}
                className="text-gray-500 hover:text-gray-700 focus:outline-none"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Modal Content */}
            <div className="flex-1 overflow-auto p-6">
              <div className="prose prose-sm max-w-none">
                <div className="whitespace-pre-wrap text-gray-800 leading-relaxed">
                  {selectedPageContent.content}
                </div>
              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="flex justify-end p-4 border-t border-gray-200">
              <button
                onClick={() => setSelectedPageContent(null)}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}