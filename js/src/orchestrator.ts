import {
  streamText,
  generateText,
  type LanguageModelV1,
} from 'ai';
import { type Provider } from './types';

// Extracting parameters from function arguments since they aren't directly exported as types
type StreamTextParameters = Parameters<typeof streamText>[0];
type GenerateTextParameters = Parameters<typeof generateText>[0];

export class APIShift {
  private models: LanguageModelV1[];

  constructor(models: LanguageModelV1[]) {
    this.models = models;
  }

  private isRateLimitError(error: any): boolean {
    // Vercel AI SDK and common providers use 429 for rate limits
    if (error && typeof error === 'object') {
      const statusCode = error.statusCode || error.status;
      if (statusCode === 429) return true;
      
      // Some SDKs might put it in the message or originalError
      const message = error.message?.toLowerCase() || '';
      if (message.includes('rate limit') || message.includes('too many requests')) return true;
    }
    return false;
  }

  async streamText(params: Omit<StreamTextParameters, 'model'>) {
    let lastError: any;

    for (const model of this.models) {
      try {
        return await streamText({
          ...params,
          model,
        } as StreamTextParameters);
      } catch (error) {
        lastError = error;
        if (this.isRateLimitError(error)) {
          continue;
        }
        throw error;
      }
    }

    throw lastError || new Error('All providers failed');
  }

  async generateText(params: Omit<GenerateTextParameters, 'model'>) {
    let lastError: any;

    for (const model of this.models) {
      try {
        return await generateText({
          ...params,
          model,
        } as GenerateTextParameters);
      } catch (error) {
        lastError = error;
        if (this.isRateLimitError(error)) {
          continue;
        }
        throw error;
      }
    }

    throw lastError || new Error('All providers failed');
  }
}
