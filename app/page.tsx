'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Settings, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import StatelessChatSection from './components/StatelessChatSection';
import { validateAvailableKeys } from './utils/apiKeys';

interface DocumentData {
  id: number;
  filename: string;
  pages: { page_number: number; text: string }[];
  total_pages: number;
}

// GitHub Icon Component
function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
    </svg>
  );
}

export default function Home() {
  const router = useRouter();
  const [documents, setDocuments] = useState<DocumentData[]>([]);
  const [description, setDescription] = useState('');
  const [hasValidKeys, setHasValidKeys] = useState(false);
  const [showManual, setShowManual] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const savedDocuments = localStorage.getItem('chatbot_documents');
      const savedDescription = localStorage.getItem('chatbot_description');
      
      if (savedDocuments) {
        const parsedDocuments = JSON.parse(savedDocuments);
        if (Array.isArray(parsedDocuments)) {
          setDocuments(parsedDocuments);
        } else {
          console.warn('Invalid documents format in localStorage, clearing...');
          localStorage.removeItem('chatbot_documents');
          setDocuments([]);
        }
      }
      if (savedDescription) {
        setDescription(savedDescription);
      }
    } catch (error) {
      console.error('Error loading from localStorage:', error);
    }
  }, []);

  // Save to localStorage whenever documents or description changes
  useEffect(() => {
    try {
      if (documents.length > 0) {
        localStorage.setItem('chatbot_documents', JSON.stringify(documents));
      }
      if (description) {
        localStorage.setItem('chatbot_description', description);
      }
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  }, [documents, description]);

  // Check API key validity on mount and when returning from settings
  useEffect(() => {
    const checkKeys = () => {
      const validation = validateAvailableKeys();
      setHasValidKeys(validation.valid);
    };
    
    checkKeys();
    
    // Listen for storage changes (when keys are updated in settings)
    const handleStorageChange = () => {
      checkKeys();
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', checkKeys); // Check when returning to tab
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', checkKeys);
    };
  }, []);

  const handleReset = () => {
    setDocuments([]);
    setDescription('');
    try {
      localStorage.removeItem('chatbot_documents');
      localStorage.removeItem('chatbot_description');
    } catch (error) {
      console.error('Error clearing localStorage:', error);
    }
  };

  const handleUpdateDocuments = (newDocuments: DocumentData[]) => {
    console.log('handleUpdateDocuments called with:', newDocuments);
    
    // Validate input
    if (!Array.isArray(newDocuments)) {
      console.error('newDocuments is not an array:', newDocuments);
      return;
    }
    
    setDocuments(newDocuments);
  };

  const handleUpdateDescription = (newDescription: string) => {
    setDescription(newDescription);
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8 relative">
          {/* Settings Button */}
          <button
            onClick={() => router.push('/settings')}
            className={`absolute top-0 left-0 flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              hasValidKeys 
                ? 'text-green-700 bg-green-50 hover:bg-green-100 border border-green-200' 
                : 'text-red-700 bg-red-50 hover:bg-red-100 border border-red-200'
            }`}
            title={hasValidKeys ? 'API keys configured' : 'Configure API keys'}
          >
            <Settings className="w-4 h-4" />
            <span>{hasValidKeys ? 'Settings' : 'Setup Required'}</span>
          </button>

          {/* GitHub Icon */}
          <a
            href="https://github.com/roe-ai/vectorless-chatbot"
            target="_blank"
            rel="noopener noreferrer"
            className="absolute top-0 right-0 text-gray-600 hover:text-gray-900 transition-colors flex items-center space-x-2 group"
            title="Star us on GitHub"
          >
            <span className="text-sm font-medium group-hover:text-gray-900 transition-colors">
              Star us
            </span>
            <GitHubIcon className="w-8 h-8" />
          </a>
          
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            티보드--Chat
          </h1>
          <p className="text-gray-600">
            PDF 문서와 채팅하세요. 벡터 임베딩 없이도 빠르고 정확한 답변을 제공합니다.
          </p>

          {/* Manual Toggle Button */}
          <button
            onClick={() => setShowManual(!showManual)}
            className="mt-4 inline-flex items-center space-x-2 px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <BookOpen className="w-4 h-4" />
            <span>사용 설명서</span>
            {showManual ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {/* Manual Section */}
          {showManual && (
            <div className="mt-6 max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-6 text-left">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">🚀 티보드--Chat 사용 설명서</h2>
              
              {/* 개요 */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">📋 개요</h3>
                <p className="text-gray-700 leading-relaxed">
                  티보드--Chat은 PDF 문서와 자연스럽게 대화할 수 있는 AI 챗봇입니다. 
                  복잡한 벡터 임베딩 과정 없이도 문서의 내용을 정확히 이해하고 답변을 제공합니다.
                </p>
              </div>

              {/* 시작하기 */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">🔑 1단계: API 키 설정</h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <p className="text-gray-700">먼저 AI 모델을 사용하기 위한 API 키를 설정해야 합니다:</p>
                  <ul className="list-disc pl-6 space-y-2 text-gray-700">
                    <li><strong>OpenAI API 키</strong>: GPT-4o, GPT-4o Mini, GPT-3.5 Turbo 모델 사용
                      <br/><span className="text-sm text-blue-600">🔗 https://platform.openai.com/account/api-keys</span>
                    </li>
                    <li><strong>Google Gemini API 키</strong>: Gemini 2.0 Flash, 1.5 Pro, 1.5 Flash, 1.0 Pro 모델 사용
                      <br/><span className="text-sm text-blue-600">🔗 https://ai.google.dev/</span>
                    </li>
                  </ul>
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-sm text-blue-700">
                      💡 <strong>팁:</strong> 하나 또는 두 제공사의 API 키를 모두 설정할 수 있습니다. 
                      설정된 API 키에 따라 사용 가능한 모델이 자동으로 표시됩니다.
                    </p>
                  </div>
                </div>
              </div>

              {/* 문서 업로드 */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">📄 2단계: PDF 문서 업로드</h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <ul className="list-disc pl-6 space-y-2 text-gray-700">
                    <li><strong>드래그 앤 드롭:</strong> PDF 파일을 업로드 영역에 끌어다 놓기</li>
                    <li><strong>클릭하여 선택:</strong> "첫 번째 문서 추가" 버튼 클릭 후 파일 선택</li>
                    <li><strong>여러 문서:</strong> 최대 여러 개의 PDF 문서를 한 번에 업로드 가능</li>
                    <li><strong>문서 설명:</strong> 업로드한 문서들에 대한 간단한 설명 추가 (선택사항)</li>
                  </ul>
                  <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md">
                    <p className="text-sm text-green-700">
                      ✅ <strong>지원 형식:</strong> PDF 파일만 지원합니다. 문서는 브라우저에서 안전하게 처리됩니다.
                    </p>
                  </div>
                </div>
              </div>

              {/* AI 모델 선택 */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">🤖 3단계: AI 모델 선택</h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <p className="text-gray-700">설정된 API 키에 따라 사용 가능한 모델을 선택할 수 있습니다:</p>
                  
                  <div className="grid md:grid-cols-2 gap-4 mt-4">
                    <div className="border border-gray-200 rounded-lg p-3">
                      <h4 className="font-semibold text-gray-800 mb-2">🔵 OpenAI 모델</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• <strong>GPT-4o</strong> (프리미엄) - 최고 성능</li>
                        <li>• <strong>GPT-4o Mini</strong> (표준) - 균형잡힌 성능</li>
                        <li>• <strong>GPT-3.5 Turbo</strong> (기본) - 빠르고 경제적</li>
                      </ul>
                    </div>
                    
                    <div className="border border-gray-200 rounded-lg p-3">
                      <h4 className="font-semibold text-gray-800 mb-2">🔴 Google Gemini 모델</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• <strong>Gemini 2.0 Flash</strong> (프리미엄) - 최신 모델</li>
                        <li>• <strong>Gemini 1.5 Pro</strong> (프리미엄) - 고성능</li>
                        <li>• <strong>Gemini 1.5 Flash</strong> (표준) - 빠른 응답</li>
                        <li>• <strong>Gemini 1.0 Pro</strong> (기본) - 기본 성능</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* 채팅하기 */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">💬 4단계: 문서와 채팅하기</h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <ul className="list-disc pl-6 space-y-2 text-gray-700">
                    <li><strong>질문 입력:</strong> 텍스트 상자에 문서에 대한 질문을 입력</li>
                    <li><strong>전송:</strong> "전송" 버튼 클릭 또는 Ctrl+Enter 키 사용</li>
                    <li><strong>실시간 처리:</strong> AI가 문서를 분석하고 관련 페이지를 찾아 답변 생성</li>
                    <li><strong>출처 표시:</strong> 답변에는 참조한 문서와 페이지 번호가 함께 표시됩니다</li>
                  </ul>
                  
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    <p className="text-sm text-yellow-700">
                      💡 <strong>효과적인 질문 요령:</strong>
                      <br/>• 구체적이고 명확한 질문을 하세요
                      <br/>• "문서에서 ~에 대해 설명해주세요" 같은 형태로 질문
                      <br/>• 여러 문서가 있을 때는 특정 주제나 키워드를 언급
                    </p>
                  </div>
                </div>
              </div>

              {/* 고급 기능 */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">⚡ 고급 기능</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-semibold text-gray-800 mb-2">🔄 세션 관리</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• 새 세션 시작 버튼으로 대화 초기화</li>
                        <li>• 브라우저 새로고침 시 이전 문서 자동 복원</li>
                        <li>• 로컬 저장소에 안전하게 임시 보관</li>
                      </ul>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold text-gray-800 mb-2">📊 비용 및 성능</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• 실시간 토큰 사용량 및 비용 표시</li>
                        <li>• 3단계 처리: 문서선택 → 페이지검색 → 답변생성</li>
                        <li>• 처리 시간 및 단계별 비용 상세 정보</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* 문제해결 */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">🛠️ 문제해결</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="space-y-3">
                    <div className="border-l-4 border-red-400 pl-3">
                      <p className="font-medium text-gray-800">모델이 1개만 표시되는 경우</p>
                      <p className="text-sm text-gray-600">Settings에서 API 키를 확인하고 다시 설정해보세요.</p>
                    </div>
                    
                    <div className="border-l-4 border-yellow-400 pl-3">
                      <p className="font-medium text-gray-800">업로드가 안 되는 경우</p>
                      <p className="text-sm text-gray-600">PDF 파일 형식인지 확인하고, 파일 크기가 너무 크지 않은지 점검하세요.</p>
                    </div>
                    
                    <div className="border-l-4 border-blue-400 pl-3">
                      <p className="font-medium text-gray-800">답변이 부정확한 경우</p>
                      <p className="text-sm text-gray-600">더 구체적인 질문을 하거나, 다른 AI 모델을 시도해보세요.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 개발자 정보 */}
              <div className="border-t pt-4">
                <p className="text-sm text-gray-500 text-center">
                  🚀 티보드--Chat | 벡터 임베딩 없는 PDF 채팅 솔루션 | 
                  <a href="https://github.com/reallygood83/chatchatchat" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
                    GitHub에서 소스 코드 보기
                  </a>
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="max-w-6xl mx-auto h-[80vh]">
          <StatelessChatSection
            documents={documents}
            description={description}
            onReset={handleReset}
            onUpdateDocuments={handleUpdateDocuments}
            onUpdateDescription={handleUpdateDescription}
          />
        </div>
      </div>
    </main>
  );
}
