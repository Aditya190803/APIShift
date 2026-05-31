import type { LanguageModel, ModelMessage } from 'ai';
import { z } from 'zod';

export const ProviderSchema = z.object({
  name: z.string(),
  model: z.string(),
  apiKey: z.string().optional(),
});

export type Provider = z.infer<typeof ProviderSchema>;
export type APIShiftMessage = ModelMessage;

export type KeyRotationStrategy = 'adaptive' | 'round_robin' | 'sticky';
export type RoutingStrategy = 'same_provider_first' | 'priority_first';

export interface ModelEntry {
  model: LanguageModel;
  name?: string;
  /** Provider/pool name, for example "gemini" or "openrouter". */
  provider?: string;
  /** Explicit pool id. Defaults to provider/name and groups same-provider keys. */
  pool?: string;
  /** Safe account/key index for telemetry. Raw API keys are never stored here. */
  keyIndex?: number;
  free?: boolean;
  priority?: number;
  cooldownMs?: number;
}

export interface PersistentMemoryStore {
  load(): Promise<{ history: APIShiftMessage[]; summary: string }> | { history: APIShiftMessage[]; summary: string };
  saveMessage(message: APIShiftMessage): Promise<void> | void;
  saveSummary(summary: string): Promise<void> | void;
  clear(): Promise<void> | void;
}

export interface APIShiftOptions {
  systemPrompt?: string;
  maxHistoryLength?: number;
  summaryMaxChars?: number;
  defaultCooldownMs?: number;
  maxContextTokens?: number;
  tokenCounter?: (text: string) => number;
  memoryStore?: PersistentMemoryStore;
  keyStrategy?: KeyRotationStrategy;
  routingStrategy?: RoutingStrategy;
}

export interface RouteInfo {
  name: string;
  provider?: string;
  pool?: string;
  keyIndex?: number;
  keyLabel?: string;
  attempts: number;
  cooldownMs?: number;
  availableKeys?: number;
  totalKeys?: number;
  keyStrategy?: KeyRotationStrategy;
}

export const FREE_OPENROUTER_MODELS = [
  'meta-llama/llama-3.1-8b-instruct:free',
  'mistralai/mistral-7b-instruct:free',
  'google/gemma-2-9b-it:free',
] as const;

export interface OpenRouterModelInfo {
  id: string;
  name?: string;
  context_length?: number;
  pricing?: Record<string, string>;
}
