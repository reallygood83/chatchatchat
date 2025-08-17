interface ApiKeyConfig {
  openai?: string;
  gemini?: string;
}

interface KeyValidation {
  valid: boolean;
  message?: string;
  details?: {
    openai: boolean;
    gemini: boolean;
  };
}

// Storage keys
const STORAGE_KEYS = {
  OPENAI: 'vectorless_openai_key',
  GEMINI: 'vectorless_gemini_key',
} as const;

/**
 * Get stored API keys from localStorage
 */
export function getStoredApiKeys(): ApiKeyConfig {
  if (typeof window === 'undefined') return {};
  
  try {
    const openai = localStorage.getItem(STORAGE_KEYS.OPENAI);
    const gemini = localStorage.getItem(STORAGE_KEYS.GEMINI);
    
    return {
      ...(openai && { openai }),
      ...(gemini && { gemini }),
    };
  } catch (error) {
    console.error('Error reading API keys from localStorage:', error);
    return {};
  }
}

/**
 * Store API key in localStorage
 */
export function storeApiKey(provider: 'openai' | 'gemini', key: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    const storageKey = provider === 'openai' ? STORAGE_KEYS.OPENAI : STORAGE_KEYS.GEMINI;
    if (key.trim()) {
      localStorage.setItem(storageKey, key.trim());
    } else {
      localStorage.removeItem(storageKey);
    }
  } catch (error) {
    console.error(`Error storing ${provider} API key:`, error);
  }
}

/**
 * Remove API key from localStorage
 */
export function removeApiKey(provider: 'openai' | 'gemini'): void {
  if (typeof window === 'undefined') return;
  
  try {
    const storageKey = provider === 'openai' ? STORAGE_KEYS.OPENAI : STORAGE_KEYS.GEMINI;
    localStorage.removeItem(storageKey);
  } catch (error) {
    console.error(`Error removing ${provider} API key:`, error);
  }
}

/**
 * Clear all API keys from localStorage
 */
export function clearAllApiKeys(): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem(STORAGE_KEYS.OPENAI);
    localStorage.removeItem(STORAGE_KEYS.GEMINI);
  } catch (error) {
    console.error('Error clearing API keys:', error);
  }
}

/**
 * Validate that at least one API key is available
 */
export function validateAvailableKeys(): KeyValidation {
  const keys = getStoredApiKeys();
  const hasOpenAI = !!keys.openai;
  const hasGemini = !!keys.gemini;
  
  if (!hasOpenAI && !hasGemini) {
    return {
      valid: false,
      message: 'No API keys configured. Please add OpenAI or Gemini API keys in Settings.',
      details: { openai: false, gemini: false },
    };
  }
  
  return {
    valid: true,
    details: { openai: hasOpenAI, gemini: hasGemini },
  };
}

/**
 * Get API headers with stored keys for making requests
 */
export function getApiHeaders(): Record<string, string> {
  const keys = getStoredApiKeys();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (keys.openai) {
    headers['X-OpenAI-Key'] = keys.openai;
  }
  
  if (keys.gemini) {
    headers['X-Gemini-Key'] = keys.gemini;
  }
  
  return headers;
}

/**
 * Test API key validity by making a request to the models endpoint
 */
export async function testApiKeys(apiBaseUrl: string): Promise<KeyValidation & { models?: any[] }> {
  try {
    const headers = getApiHeaders();
    
    // Check if we have any keys to test
    const validation = validateAvailableKeys();
    if (!validation.valid) {
      return validation;
    }
    
    const response = await fetch(`${apiBaseUrl}/models`, {
      method: 'GET',
      headers,
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      return {
        valid: false,
        message: `API key validation failed: ${errorData.error || response.statusText}`,
        details: validation.details,
      };
    }
    
    const data = await response.json();
    return {
      valid: true,
      message: `Successfully validated! Found ${data.models?.length || 0} available models.`,
      details: validation.details,
      models: data.models,
    };
  } catch (error) {
    return {
      valid: false,
      message: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: { openai: false, gemini: false },
    };
  }
}

/**
 * Get a safe display version of API key (showing only first/last few characters)
 */
export function getSafeKeyDisplay(key: string): string {
  if (!key || key.length < 8) return '••••••••';
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}