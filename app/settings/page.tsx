'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Eye, EyeOff, Check, X, RefreshCw, Save, Trash2 } from 'lucide-react';
import config from '../../config';
import {
  getStoredApiKeys,
  storeApiKey,
  removeApiKey,
  clearAllApiKeys,
  testApiKeys,
  getSafeKeyDisplay,
  validateAvailableKeys,
} from '../utils/apiKeys';

interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  tier: string;
}

interface TestResult {
  success: boolean;
  message: string;
  models?: ModelInfo[];
}

export default function SettingsPage() {
  const router = useRouter();
  const [keys, setKeys] = useState({ openai: '', gemini: '' });
  const [showKeys, setShowKeys] = useState({ openai: false, gemini: false });
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Load stored keys on mount
  useEffect(() => {
    const storedKeys = getStoredApiKeys();
    setKeys({
      openai: storedKeys.openai || '',
      gemini: storedKeys.gemini || '',
    });
  }, []);

  // Track changes
  useEffect(() => {
    const storedKeys = getStoredApiKeys();
    const hasOpenAIChange = keys.openai !== (storedKeys.openai || '');
    const hasGeminiChange = keys.gemini !== (storedKeys.gemini || '');
    setHasChanges(hasOpenAIChange || hasGeminiChange);
  }, [keys]);

  const handleKeyChange = (provider: 'openai' | 'gemini', value: string) => {
    setKeys(prev => ({ ...prev, [provider]: value }));
    setTestResult(null); // Clear previous test results
  };

  const handleToggleVisibility = (provider: 'openai' | 'gemini') => {
    setShowKeys(prev => ({ ...prev, [provider]: !prev[provider] }));
  };

  const handleSaveKeys = () => {
    if (keys.openai.trim()) {
      storeApiKey('openai', keys.openai);
    } else {
      removeApiKey('openai');
    }

    if (keys.gemini.trim()) {
      storeApiKey('gemini', keys.gemini);
    } else {
      removeApiKey('gemini');
    }

    setHasChanges(false);
    setTestResult({
      success: true,
      message: 'API keys saved successfully!',
    });

    // Clear success message after 3 seconds
    setTimeout(() => {
      setTestResult(null);
    }, 3000);
  };

  const handleTestKeys = async () => {
    setIsLoading(true);
    setTestResult(null);

    try {
      // Save current keys temporarily for testing
      const originalKeys = getStoredApiKeys();
      
      // Save test keys
      if (keys.openai.trim()) storeApiKey('openai', keys.openai);
      if (keys.gemini.trim()) storeApiKey('gemini', keys.gemini);

      const result = await testApiKeys(config.apiBaseUrl);
      
      if (result.valid) {
        setTestResult({
          success: true,
          message: result.message || 'Keys validated successfully!',
          models: result.models,
        });
      } else {
        setTestResult({
          success: false,
          message: result.message || 'Validation failed',
        });
        
        // Restore original keys on failure
        if (originalKeys.openai) {
          storeApiKey('openai', originalKeys.openai);
        } else {
          removeApiKey('openai');
        }
        
        if (originalKeys.gemini) {
          storeApiKey('gemini', originalKeys.gemini);
        } else {
          removeApiKey('gemini');
        }
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearAll = () => {
    if (confirm('Are you sure you want to clear all API keys? This action cannot be undone.')) {
      clearAllApiKeys();
      setKeys({ openai: '', gemini: '' });
      setTestResult(null);
      setHasChanges(false);
    }
  };

  const canTest = keys.openai.trim() || keys.gemini.trim();
  const validation = validateAvailableKeys();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Header */}
        <div className="flex items-center mb-8">
          <button
            onClick={() => router.back()}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
          <h1 className="text-3xl font-bold text-gray-900 ml-6">API Settings</h1>
        </div>

        {/* Privacy Notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-blue-800">Privacy-First Design</h3>
              <p className="text-sm text-blue-700 mt-1">
                Your API keys are stored locally in your browser and sent directly to AI providers. 
                They are never transmitted to or stored on our servers.
              </p>
            </div>
          </div>
        </div>

        {/* Settings Form */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Configure API Keys</h2>

          {/* OpenAI API Key */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              OpenAI API Key
              <span className="text-gray-500 font-normal ml-1">(for GPT models)</span>
            </label>
            <div className="relative">
              <input
                type={showKeys.openai ? 'text' : 'password'}
                value={keys.openai}
                onChange={(e) => handleKeyChange('openai', e.target.value)}
                placeholder="sk-..."
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => handleToggleVisibility('openai')}
                className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                {showKeys.openai ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Get your key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">platform.openai.com/api-keys</a>
            </p>
          </div>

          {/* Google Gemini API Key */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Google Gemini API Key
              <span className="text-gray-500 font-normal ml-1">(for Gemini models)</span>
            </label>
            <div className="relative">
              <input
                type={showKeys.gemini ? 'text' : 'password'}
                value={keys.gemini}
                onChange={(e) => handleKeyChange('gemini', e.target.value)}
                placeholder="AIza..."
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => handleToggleVisibility('gemini')}
                className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                {showKeys.gemini ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Get your key from <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">makersuite.google.com/app/apikey</a>
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3 mb-6">
            <button
              onClick={handleSaveKeys}
              disabled={!hasChanges}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md font-medium transition-colors ${
                hasChanges
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              <Save className="w-4 h-4" />
              <span>Save Keys</span>
            </button>

            <button
              onClick={handleTestKeys}
              disabled={!canTest || isLoading}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md font-medium transition-colors ${
                canTest && !isLoading
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>{isLoading ? 'Testing...' : 'Validate Keys'}</span>
            </button>

            <button
              onClick={handleClearAll}
              className="flex items-center space-x-2 px-4 py-2 rounded-md font-medium text-red-600 hover:bg-red-50 transition-colors border border-red-300"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear All</span>
            </button>
          </div>

          {/* Test Results */}
          {testResult && (
            <div className={`p-4 rounded-md mb-6 ${
              testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}>
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  {testResult.success ? (
                    <Check className="w-5 h-5 text-green-600" />
                  ) : (
                    <X className="w-5 h-5 text-red-600" />
                  )}
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-medium ${
                    testResult.success ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {testResult.message}
                  </p>
                  
                  {/* Show available models on success */}
                  {testResult.success && testResult.models && testResult.models.length > 0 && (
                    <div className="mt-3">
                      <h4 className="text-sm font-medium text-green-800 mb-2">Available Models:</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {testResult.models.map((model) => (
                          <div
                            key={model.id}
                            className="flex items-center justify-between p-2 bg-white rounded border border-green-200"
                          >
                            <div>
                              <div className="text-sm font-medium text-gray-900">{model.name}</div>
                              <div className="flex items-center space-x-2 mt-1">
                                <span className={`text-xs px-2 py-1 rounded-full ${
                                  model.provider === 'openai' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                                }`}>
                                  {model.provider === 'openai' ? 'OpenAI' : 'Google'}
                                </span>
                                <span className={`text-xs px-2 py-1 rounded-full ${
                                  model.tier === 'premium' ? 'bg-purple-100 text-purple-800' :
                                  model.tier === 'standard' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {model.tier}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Current Status */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Current Status</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">OpenAI API Key:</span>
                <span className={`text-sm ${validation.details?.openai ? 'text-green-600' : 'text-gray-400'}`}>
                  {validation.details?.openai ? (
                    <span className="flex items-center space-x-1">
                      <Check className="w-4 h-4" />
                      <span>Configured ({getSafeKeyDisplay(keys.openai)})</span>
                    </span>
                  ) : (
                    'Not configured'
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Gemini API Key:</span>
                <span className={`text-sm ${validation.details?.gemini ? 'text-green-600' : 'text-gray-400'}`}>
                  {validation.details?.gemini ? (
                    <span className="flex items-center space-x-1">
                      <Check className="w-4 h-4" />
                      <span>Configured ({getSafeKeyDisplay(keys.gemini)})</span>
                    </span>
                  ) : (
                    'Not configured'
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-gray-50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-2">Instructions</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• You need at least one API key (OpenAI or Gemini) to use the chatbot</li>
            <li>• Both keys are recommended for access to all available models</li>
            <li>• Keys are stored locally in your browser and never sent to our servers</li>
            <li>• Use "Validate Keys" to test your keys and see available models</li>
            <li>• Changes are only applied when you click "Save Keys"</li>
          </ul>
        </div>
      </div>
    </div>
  );
}