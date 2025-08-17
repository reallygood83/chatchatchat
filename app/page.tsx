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
            티보드 chat
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
              <h2 className="text-2xl font-bold text-gray-900 mb-6">🍎 교사를 위한 티보드 chat 활용 가이드</h2>
              
              {/* 개요 */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">📚 교육 현장에서의 활용</h3>
                <p className="text-gray-700 leading-relaxed mb-4">
                  티보드 chat은 교사의 수업 준비와 학생 지도를 위한 AI 어시스턴트입니다. 
                  교과서, 참고서, 논문, 보고서 등 다양한 PDF 자료를 업로드하여 즉시 질의응답할 수 있습니다.
                </p>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-blue-800 mb-2">🎯 수업 준비 활용</h4>
                    <ul className="text-sm text-blue-700 space-y-1">
                      <li>• 교과서 핵심 내용 정리 및 요약</li>
                      <li>• 참고 자료에서 수업 아이디어 추출</li>
                      <li>• 학습 목표에 맞는 문제 출제 도움</li>
                      <li>• 교안 작성을 위한 자료 종합</li>
                    </ul>
                  </div>
                  
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-green-800 mb-2">👥 학생 지도 활용</h4>
                    <ul className="text-sm text-green-700 space-y-1">
                      <li>• 학생 질문에 대한 정확한 답변 준비</li>
                      <li>• 과제 평가 기준 및 피드백 작성</li>
                      <li>• 개별 학습 자료 맞춤 제작</li>
                      <li>• 학부모 상담 자료 준비</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* 시작하기 */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">🔑 1단계: API 키 설정 (최초 1회)</h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <p className="text-gray-700">AI 서비스를 이용하기 위해 API 키가 필요합니다. 한 번만 설정하면 계속 사용 가능합니다:</p>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="border border-blue-200 rounded-lg p-3 bg-blue-50">
                      <h4 className="font-semibold text-blue-800 mb-2">💰 비용 효율적인 선택</h4>
                      <p className="text-sm text-blue-700 mb-2"><strong>OpenAI GPT-4o Mini</strong> 추천</p>
                      <ul className="text-xs text-blue-600 space-y-1">
                        <li>• 교육용으로 충분한 성능</li>
                        <li>• 저렴한 이용 요금 (토큰당 $0.15/1M)</li>
                        <li>• 빠른 응답 속도</li>
                      </ul>
                      <span className="text-xs text-blue-600">🔗 https://platform.openai.com/account/api-keys</span>
                    </div>
                    
                    <div className="border border-red-200 rounded-lg p-3 bg-red-50">
                      <h4 className="font-semibold text-red-800 mb-2">🆓 무료 대안</h4>
                      <p className="text-sm text-red-700 mb-2"><strong>Google Gemini 1.5 Flash</strong></p>
                      <ul className="text-xs text-red-600 space-y-1">
                        <li>• 월 무료 사용량 제공</li>
                        <li>• 한국어 지원 우수</li>
                        <li>• 교육 분야 성능 좋음</li>
                      </ul>
                      <span className="text-xs text-red-600">🔗 https://ai.google.dev/</span>
                    </div>
                  </div>
                  <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    <p className="text-sm text-yellow-700">
                      💡 <strong>교사 팁:</strong> 처음에는 Google Gemini로 시작해보세요. 
                      더 많은 기능이 필요하면 OpenAI API도 추가로 설정할 수 있습니다.
                    </p>
                  </div>
                </div>
              </div>

              {/* 교육 자료 업로드 */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">📖 2단계: 교육 자료 업로드</h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="grid md:grid-cols-3 gap-4 mb-4">
                    <div className="text-center p-3 bg-white rounded-lg border">
                      <div className="text-2xl mb-2">📚</div>
                      <p className="text-sm font-medium">교과서 & 참고서</p>
                      <p className="text-xs text-gray-600">수업 내용 정리</p>
                    </div>
                    <div className="text-center p-3 bg-white rounded-lg border">
                      <div className="text-2xl mb-2">📄</div>
                      <p className="text-sm font-medium">논문 & 보고서</p>
                      <p className="text-xs text-gray-600">최신 연구 자료</p>
                    </div>
                    <div className="text-center p-3 bg-white rounded-lg border">
                      <div className="text-2xl mb-2">📝</div>
                      <p className="text-sm font-medium">학습 자료</p>
                      <p className="text-xs text-gray-600">과제 및 평가 자료</p>
                    </div>
                  </div>
                  
                  <ul className="list-disc pl-6 space-y-2 text-gray-700">
                    <li><strong>간편 업로드:</strong> PDF 파일을 화면에 끌어다 놓거나 "첫 번째 문서 추가" 클릭</li>
                    <li><strong>여러 자료 동시 업로드:</strong> 교과서, 참고서, 워크북 등을 한 번에 업로드</li>
                    <li><strong>자료 설명 추가:</strong> "3학년 수학 교과서, 문제집" 같은 설명으로 구분</li>
                  </ul>
                  
                  <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md">
                    <p className="text-sm text-green-700">
                      ✅ <strong>보안:</strong> 업로드된 파일은 브라우저에서만 처리되며, 외부로 전송되지 않습니다.
                    </p>
                  </div>
                </div>
              </div>

              {/* 교육 활용 예시 */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">💡 3단계: 교육 현장 활용 예시</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold text-gray-800 mb-3">🎓 수업 준비 질문 예시</h4>
                      <div className="space-y-3">
                        <div className="bg-white p-3 rounded border-l-4 border-blue-400">
                          <p className="text-sm text-gray-800 font-medium">"3단원 핵심 내용을 3가지로 요약해줘"</p>
                          <p className="text-xs text-gray-600 mt-1">→ 수업 개요 작성에 활용</p>
                        </div>
                        <div className="bg-white p-3 rounded border-l-4 border-green-400">
                          <p className="text-sm text-gray-800 font-medium">"이 단원으로 만들 수 있는 문제 5개 추천해줘"</p>
                          <p className="text-xs text-gray-600 mt-1">→ 평가 문제 출제에 활용</p>
                        </div>
                        <div className="bg-white p-3 rounded border-l-4 border-purple-400">
                          <p className="text-sm text-gray-800 font-medium">"학생들이 어려워할 개념을 쉽게 설명하는 방법은?"</p>
                          <p className="text-xs text-gray-600 mt-1">→ 교수법 개선에 활용</p>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold text-gray-800 mb-3">👨‍🎓 학생 지도 질문 예시</h4>
                      <div className="space-y-3">
                        <div className="bg-white p-3 rounded border-l-4 border-orange-400">
                          <p className="text-sm text-gray-800 font-medium">"○○ 개념을 이해하지 못하는 학생을 위한 설명법은?"</p>
                          <p className="text-xs text-gray-600 mt-1">→ 개별 지도 방안 수립</p>
                        </div>
                        <div className="bg-white p-3 rounded border-l-4 border-red-400">
                          <p className="text-sm text-gray-800 font-medium">"이 과제의 평가 기준을 구체적으로 알려줘"</p>
                          <p className="text-xs text-gray-600 mt-1">→ 공정한 평가 기준 마련</p>
                        </div>
                        <div className="bg-white p-3 rounded border-l-4 border-teal-400">
                          <p className="text-sm text-gray-800 font-medium">"학부모에게 설명할 학습 진도와 성취 수준은?"</p>
                          <p className="text-xs text-gray-600 mt-1">→ 학부모 상담 자료 준비</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    <p className="text-sm text-yellow-700">
                      🎯 <strong>질문 노하우:</strong> "구체적인 페이지나 단원을 언급"하면 더 정확한 답변을 받을 수 있습니다.
                      <br/>예: "2학년 수학 교과서 67페이지 분수 개념을 설명해줘"
                    </p>
                  </div>
                </div>
              </div>

              {/* 실무 활용 팁 */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">⚡ 실무 활용 팁</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-semibold text-gray-800 mb-2">⏰ 시간 절약 활용법</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• 교안 작성 시간 50% 단축</li>
                        <li>• 즉석 학생 질문 대응 가능</li>
                        <li>• 다양한 교수법 아이디어 확보</li>
                        <li>• 평가 문제 자동 생성 지원</li>
                      </ul>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold text-gray-800 mb-2">📈 수업 품질 향상</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• 다각도 설명으로 이해도 증진</li>
                        <li>• 학생 수준별 맞춤 자료 제작</li>
                        <li>• 최신 교육 동향 반영</li>
                        <li>• 창의적 수업 활동 아이디어</li>
                      </ul>
                    </div>
                  </div>
                  
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-sm text-blue-700">
                      💡 <strong>동료 교사와 공유:</strong> 좋은 질문과 답변은 동료 교사들과 공유하여 
                      교직원 전체의 수업 역량을 향상시킬 수 있습니다.
                    </p>
                  </div>
                </div>
              </div>

              {/* 문제해결 */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">🛠️ 자주 묻는 질문</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="space-y-3">
                    <div className="border-l-4 border-blue-400 pl-3">
                      <p className="font-medium text-gray-800">API 키 설정이 어려워요</p>
                      <p className="text-sm text-gray-600">Settings 버튼을 클릭하고 Google Gemini부터 시작해보세요. 무료 사용량이 제공됩니다.</p>
                    </div>
                    
                    <div className="border-l-4 border-green-400 pl-3">
                      <p className="font-medium text-gray-800">한 번에 몇 개의 문서를 업로드할 수 있나요?</p>
                      <p className="text-sm text-gray-600">제한은 없지만, 3-5개 정도가 최적입니다. 너무 많으면 검색 시간이 길어집니다.</p>
                    </div>
                    
                    <div className="border-l-4 border-yellow-400 pl-3">
                      <p className="font-medium text-gray-800">답변이 부정확할 때는 어떻게 하나요?</p>
                      <p className="text-sm text-gray-600">더 구체적인 질문을 하거나, 페이지 번호를 명시해보세요. 다른 AI 모델로 바꿔서 시도해볼 수도 있습니다.</p>
                    </div>
                    
                    <div className="border-l-4 border-red-400 pl-3">
                      <p className="font-medium text-gray-800">학생 정보나 개인정보 보안은 안전한가요?</p>
                      <p className="text-sm text-gray-600">모든 처리는 브라우저에서만 이루어지며, 개인정보는 서버로 전송되지 않습니다. 안전합니다.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 개발자 정보 */}
              <div className="border-t pt-4">
                <p className="text-sm text-gray-500 text-center">
                  🍎 교사를 위한 티보드 chat | AI 기반 교육 도구 | 
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
