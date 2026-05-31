import {
  generateText,
  streamText,
  type LanguageModel,
  type ModelMessage,
} from 'ai';
import { approximateTokenCount, normalizeMessageContent, packMessagesToTokenBudget } from './context';
import type {
  APIShiftOptions,
  KeyRotationStrategy,
  ModelEntry,
  PersistentMemoryStore,
  RouteInfo,
  RoutingStrategy,
} from './types';

type StreamTextParameters = Parameters<typeof streamText>[0];
type GenerateTextParameters = Parameters<typeof generateText>[0];
type GenerateTextWithoutModel = Omit<GenerateTextParameters, 'model'>;
type StreamTextWithoutModel = Omit<StreamTextParameters, 'model'>;

type ManagedModel = Required<Omit<ModelEntry, 'name' | 'model' | 'provider' | 'pool' | 'keyIndex'>> & {
  model: LanguageModel;
  name: string;
  provider: string;
  pool: string;
  keyIndex: number;
  cooldownUntil: number;
  usageCount: number;
  failureCount: number;
};

function isModelEntry(value: LanguageModel | ModelEntry): value is ModelEntry {
  return typeof value === 'object' && value !== null && 'model' in value;
}

function headerValue(headers: any, name: string): string | undefined {
  if (!headers) return undefined;
  if (typeof headers.get === 'function') return headers.get(name) ?? headers.get(name.toLowerCase()) ?? undefined;
  return headers[name] ?? headers[name.toLowerCase()];
}

function parseRetryAfter(value?: string): number | undefined {
  if (!value) return undefined;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return Math.max(0, numeric * 1000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}

function parseReset(value?: string): number | undefined {
  if (!value) return undefined;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return undefined;
  return Math.max(0, numeric > 1_000_000_000 ? numeric * 1000 - Date.now() : numeric * 1000);
}

function retryAfterMs(error: any): number | undefined {
  const headers = error?.headers ?? error?.response?.headers ?? error?.cause?.headers;
  const candidates = [
    parseRetryAfter(headerValue(headers, 'retry-after')),
    parseReset(headerValue(headers, 'x-ratelimit-reset')),
    parseReset(headerValue(headers, 'x-ratelimit-reset-requests')),
    parseReset(headerValue(headers, 'x-ratelimit-reset-tokens')),
    parseReset(headerValue(headers, 'x-ratelimit-reset-after')),
  ].filter((value): value is number => value !== undefined);
  return candidates.length > 0 ? Math.max(...candidates) : undefined;
}

export class APIShift {
  private models: ManagedModel[];
  private history: ModelMessage[] = [];
  private summary = '';
  private options: Required<Omit<APIShiftOptions, 'memoryStore' | 'tokenCounter'>> & Pick<APIShiftOptions, 'tokenCounter'>;
  private memoryStore?: PersistentMemoryStore;
  private ready: Promise<void>;
  public lastRoute?: RouteInfo;

  constructor(models: Array<LanguageModel | ModelEntry>, options: APIShiftOptions = {}) {
    this.options = {
      systemPrompt: options.systemPrompt ?? '',
      maxHistoryLength: options.maxHistoryLength ?? 20,
      summaryMaxChars: options.summaryMaxChars ?? 4000,
      defaultCooldownMs: options.defaultCooldownMs ?? 60_000,
      maxContextTokens: options.maxContextTokens ?? 6000,
      keyStrategy: options.keyStrategy ?? 'adaptive',
      routingStrategy: options.routingStrategy ?? 'same_provider_first',
      tokenCounter: options.tokenCounter,
    };
    this.memoryStore = options.memoryStore;

    this.models = models.map((entry, index) => {
      if (isModelEntry(entry)) {
        return {
          model: entry.model,
          name: entry.name ?? `model-${index}`,
          provider: entry.provider ?? entry.pool ?? entry.name ?? `provider-${index}`,
          pool: entry.pool ?? entry.provider ?? entry.name ?? `provider-${index}`,
          keyIndex: entry.keyIndex ?? index,
          free: entry.free ?? true,
          priority: entry.priority ?? 100,
          cooldownMs: entry.cooldownMs ?? this.options.defaultCooldownMs,
          cooldownUntil: 0,
          usageCount: 0,
          failureCount: 0,
        };
      }

      return {
        model: entry,
        name: `model-${index}`,
        provider: `provider-${index}`,
        pool: `provider-${index}`,
        keyIndex: index,
        free: true,
        priority: 100 + index,
        cooldownMs: this.options.defaultCooldownMs,
        cooldownUntil: 0,
        usageCount: 0,
        failureCount: 0,
      };
    });

    this.sortModels();
    this.ready = this.loadMemory();
  }

  private async loadMemory() {
    if (!this.memoryStore) return;
    const loaded = await this.memoryStore.load();
    this.history = loaded.history ?? [];
    this.summary = loaded.summary ?? '';
  }

  private sortModels() {
    this.models.sort((a, b) => {
      if (a.free !== b.free) return a.free ? -1 : 1;
      if (a.priority !== b.priority) return a.priority - b.priority;
      if (a.pool !== b.pool) return a.pool.localeCompare(b.pool);
      return a.keyIndex - b.keyIndex;
    });
  }

  private availableModels(): ManagedModel[] {
    const now = Date.now();
    return this.models.filter((entry) => entry.cooldownUntil <= now);
  }

  private orderedCandidates(): ManagedModel[] {
    const available = this.availableModels();
    if (this.options.routingStrategy === 'priority_first') {
      return this.orderKeys(available, this.options.keyStrategy);
    }

    const pools = new Map<string, ManagedModel[]>();
    for (const entry of available) {
      const poolEntries = pools.get(entry.pool) ?? [];
      poolEntries.push(entry);
      pools.set(entry.pool, poolEntries);
    }

    return [...pools.values()]
      .sort((a, b) => {
        const left = a[0];
        const right = b[0];
        if (left.free !== right.free) return left.free ? -1 : 1;
        return left.priority - right.priority;
      })
      .flatMap((poolEntries) => this.orderKeys(poolEntries, this.options.keyStrategy));
  }

  private orderKeys(entries: ManagedModel[], strategy: KeyRotationStrategy): ManagedModel[] {
    const copy = [...entries];
    if (strategy === 'adaptive') {
      return copy.sort((a, b) => {
        if (a.usageCount !== b.usageCount) return a.usageCount - b.usageCount;
        if (a.failureCount !== b.failureCount) return a.failureCount - b.failureCount;
        if (a.priority !== b.priority) return a.priority - b.priority;
        return a.keyIndex - b.keyIndex;
      });
    }
    if (strategy === 'round_robin') {
      return copy.sort((a, b) => {
        if (a.usageCount !== b.usageCount) return a.usageCount - b.usageCount;
        return a.keyIndex - b.keyIndex;
      });
    }
    return copy.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.keyIndex - b.keyIndex;
    });
  }

  private poolStats(entry: ManagedModel) {
    const poolEntries = this.models.filter((candidate) => candidate.pool === entry.pool);
    const now = Date.now();
    return {
      availableKeys: poolEntries.filter((candidate) => candidate.cooldownUntil <= now).length,
      totalKeys: poolEntries.length,
    };
  }

  private recordRoute(entry: ManagedModel, attempts: number, cooldownMs?: number) {
    const stats = this.poolStats(entry);
    this.lastRoute = {
      name: entry.name,
      provider: entry.provider,
      pool: entry.pool,
      keyIndex: entry.keyIndex,
      keyLabel: `key-${entry.keyIndex + 1}`,
      attempts,
      cooldownMs,
      availableKeys: stats.availableKeys,
      totalKeys: stats.totalKeys,
      keyStrategy: this.options.keyStrategy,
    };
  }

  private recordSuccess(entry: ManagedModel, attempts: number) {
    entry.usageCount += 1;
    this.recordRoute(entry, attempts);
  }

  private markUnavailable(entry: ManagedModel, error: unknown, attempts: number) {
    const cooldownMs = retryAfterMs(error) ?? entry.cooldownMs;
    entry.cooldownUntil = Date.now() + cooldownMs;
    entry.failureCount += 1;
    this.recordRoute(entry, attempts, cooldownMs);
  }

  private isRetryableError(error: any): boolean {
    if (error && typeof error === 'object') {
      const statusCode = error.statusCode ?? error.status ?? error.response?.status ?? error.cause?.status;
      if (statusCode === 429 || statusCode === 503) return true;

      const message = String(error.message ?? error.cause?.message ?? '').toLowerCase();
      return [
        'rate limit',
        'too many requests',
        'quota exceeded',
        'quota exhausted',
        'daily limit',
        'usage limit',
        'temporarily unavailable',
      ].some((phrase) => message.includes(phrase));
    }
    return false;
  }

  private async rememberTrimmed(messages: ModelMessage[]) {
    if (messages.length === 0) return;
    const rendered = messages
      .map((message) => `${message.role}: ${normalizeMessageContent(message.content)}`)
      .join('\n');
    const combined = `${this.summary}\n${rendered}`.trim();
    this.summary = combined.slice(-this.options.summaryMaxChars);
    await this.memoryStore?.saveSummary(this.summary);
  }

  private async trimHistory() {
    if (this.history.length <= this.options.maxHistoryLength) return;
    const overflow = this.history.length - this.options.maxHistoryLength;
    const trimmed = this.history.splice(0, overflow);
    await this.rememberTrimmed(trimmed);
  }

  private compileContext(additionalMessages: ModelMessage[] = []): ModelMessage[] {
    const systemSections: string[] = [];
    if (this.options.systemPrompt) systemSections.push(this.options.systemPrompt);
    if (this.summary) {
      systemSections.push(
        `Earlier conversation summary. Preserve this task context across provider switches:\n${this.summary}`,
      );
    }

    const recent = [...this.history, ...additionalMessages].slice(-this.options.maxHistoryLength);
    return packMessagesToTokenBudget({
      systemSections,
      messages: recent,
      maxContextTokens: this.options.maxContextTokens,
      tokenCounter: this.options.tokenCounter ?? approximateTokenCount,
    });
  }

  private async withGenerateFailover(params: GenerateTextWithoutModel) {
    let lastError: unknown;
    let attempts = 0;

    for (const entry of this.orderedCandidates()) {
      attempts += 1;
      try {
        const result = await generateText({
          ...params,
          model: entry.model,
        } as GenerateTextParameters);
        this.recordSuccess(entry, attempts);
        return result;
      } catch (error) {
        lastError = error;
        if (!this.isRetryableError(error)) throw error;
        this.markUnavailable(entry, error, attempts);
      }
    }

    throw lastError ?? new Error('No available APIShift models');
  }

  private async withStreamFailover(params: StreamTextWithoutModel) {
    let lastError: unknown;
    let attempts = 0;

    for (const entry of this.orderedCandidates()) {
      attempts += 1;
      try {
        const result = await streamText({
          ...params,
          model: entry.model,
        } as StreamTextParameters);

        const iterator = result.textStream[Symbol.asyncIterator]();
        const first = await iterator.next();

        async function* guardedStream() {
          if (!first.done) yield first.value;
          while (true) {
            const next = await iterator.next();
            if (next.done) break;
            yield next.value;
          }
        }

        this.recordSuccess(entry, attempts);
        return {
          ...result,
          textStream: guardedStream(),
        };
      } catch (error) {
        lastError = error;
        if (!this.isRetryableError(error)) throw error;
        this.markUnavailable(entry, error, attempts);
      }
    }

    throw lastError ?? new Error('No available APIShift models');
  }

  async generateText(params: GenerateTextWithoutModel): Promise<any> {
    await this.ready;
    return this.withGenerateFailover(params);
  }

  async streamText(params: StreamTextWithoutModel): Promise<any> {
    await this.ready;
    return this.withStreamFailover(params);
  }

  async sendMessage(
    content: string,
    params: Omit<GenerateTextWithoutModel, 'prompt' | 'messages'> = {},
  ): Promise<any> {
    await this.ready;
    const userMessage = { role: 'user', content } as ModelMessage;
    this.history.push(userMessage);
    await this.memoryStore?.saveMessage(userMessage);
    await this.trimHistory();

    const result = await this.withGenerateFailover({
      ...params,
      messages: this.compileContext(),
    } as GenerateTextWithoutModel);

    const assistantMessage = { role: 'assistant', content: result.text } as ModelMessage;
    this.history.push(assistantMessage);
    await this.memoryStore?.saveMessage(assistantMessage);
    await this.trimHistory();
    return result;
  }

  async streamMessage(
    content: string,
    params: Omit<StreamTextWithoutModel, 'prompt' | 'messages'> = {},
  ): Promise<any> {
    await this.ready;
    const userMessage = { role: 'user', content } as ModelMessage;
    this.history.push(userMessage);
    await this.memoryStore?.saveMessage(userMessage);
    await this.trimHistory();

    const result = await this.withStreamFailover({
      ...params,
      messages: this.compileContext(),
    } as StreamTextWithoutModel);

    const chunks: string[] = [];
    const originalStream = result.textStream;
    const history = this.history;
    const memoryStore = this.memoryStore;

    async function* rememberingStream() {
      for await (const chunk of originalStream) {
        chunks.push(chunk);
        yield chunk;
      }
      const assistantMessage = { role: 'assistant', content: chunks.join('') } as ModelMessage;
      history.push(assistantMessage);
      await memoryStore?.saveMessage(assistantMessage);
    }

    return {
      ...result,
      textStream: rememberingStream(),
    };
  }

  async getHistory() {
    await this.ready;
    return [...this.history];
  }

  async getCompiledContext() {
    await this.ready;
    return this.compileContext();
  }

  async clearHistory() {
    await this.ready;
    this.history = [];
    this.summary = '';
    await this.memoryStore?.clear();
  }
}
