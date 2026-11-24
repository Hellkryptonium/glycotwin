import {
  GoogleGenAI,
  type GenerateContentParameters,
  type GenerateContentResponse,
} from '@google/genai';
import { loadEnvironment, type Environment } from '../../config/env.js';

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

export class GeminiClientError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'GeminiClientError';
  }
}

export class GeminiDisabledError extends GeminiClientError {
  constructor() {
    super('Gemini AI is disabled');
    this.name = 'GeminiDisabledError';
  }
}

export class GeminiConfigurationError extends GeminiClientError {
  constructor(message: string) {
    super(message);
    this.name = 'GeminiConfigurationError';
  }
}

export class GeminiTimeoutError extends GeminiClientError {
  constructor() {
    super('Gemini request timed out');
    this.name = 'GeminiTimeoutError';
  }
}

export class GeminiProviderError extends GeminiClientError {
  constructor(options?: ErrorOptions) {
    super('Gemini provider request failed', options);
    this.name = 'GeminiProviderError';
  }
}

export class GeminiEmptyResponseError extends GeminiClientError {
  constructor() {
    super('Gemini returned an empty response');
    this.name = 'GeminiEmptyResponseError';
  }
}

export interface GeminiClient {
  generateText(systemInstruction: string, userMessage: string): Promise<string>;
  generateContent(parameters: GenerateContentParameters): Promise<GenerateContentResponse>;
}

export function createGeminiClient(
  environment: Environment,
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
): GeminiClient | null {
  if (!environment.AI_ENABLED) {
    return null;
  }

  if (!environment.GEMINI_API_KEY) {
    throw new GeminiConfigurationError('GEMINI_API_KEY is required when AI_ENABLED=true');
  }

  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new GeminiConfigurationError('Gemini request timeout must be a positive number');
  }

  const client = new GoogleGenAI({ apiKey: environment.GEMINI_API_KEY });
  const model = environment.GEMINI_MODEL;

  return {
    async generateContent(parameters: GenerateContentParameters): Promise<GenerateContentResponse> {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        return await client.models.generateContent({
          ...parameters,
          config: {
            ...parameters.config,
            abortSignal: controller.signal,
            httpOptions: {
              ...parameters.config?.httpOptions,
              timeout: timeoutMs,
            },
          },
        });
      } catch (error) {
        if (controller.signal.aborted) {
          throw new GeminiTimeoutError();
        }
        if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
          throw new GeminiTimeoutError();
        }
        throw new GeminiProviderError({ cause: error });
      } finally {
        clearTimeout(timeout);
      }
    },

    async generateText(systemInstruction: string, userMessage: string): Promise<string> {
      if (!systemInstruction.trim()) {
        throw new GeminiConfigurationError('Gemini system instruction must not be empty');
      }
      if (!userMessage.trim()) {
        throw new GeminiConfigurationError('Gemini user message must not be empty');
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await client.models.generateContent({
          model,
          contents: userMessage,
          config: {
            systemInstruction,
            abortSignal: controller.signal,
            httpOptions: { timeout: timeoutMs },
          },
        });

        const text = response.text?.trim();
        if (!text) {
          throw new GeminiEmptyResponseError();
        }

        return text;
      } catch (error) {
        if (controller.signal.aborted) {
          throw new GeminiTimeoutError();
        }
        if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
          throw new GeminiTimeoutError();
        }
        if (error instanceof GeminiEmptyResponseError) {
          throw error;
        }
        throw new GeminiProviderError({ cause: error });
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

export async function generateGeminiText(
  systemInstruction: string,
  userMessage: string,
  environment: Environment = loadEnvironment(),
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
): Promise<string> {
  const client = createGeminiClient(environment, timeoutMs);
  if (!client) {
    throw new GeminiDisabledError();
  }

  return client.generateText(systemInstruction, userMessage);
}
