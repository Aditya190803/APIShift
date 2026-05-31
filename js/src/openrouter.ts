import { FREE_OPENROUTER_MODELS, type OpenRouterModelInfo } from './types';

export async function discoverOpenRouterFreeModels(options: {
  apiKey?: string;
  fetchImpl?: typeof fetch;
  requireFreeSuffix?: boolean;
} = {}): Promise<string[]> {
  const fetcher = options.fetchImpl ?? fetch;
  const headers: Record<string, string> = {};
  if (options.apiKey) headers.Authorization = `Bearer ${options.apiKey}`;

  try {
    const response = await fetcher('https://openrouter.ai/api/v1/models', { headers });
    if (!response.ok) return [...FREE_OPENROUTER_MODELS];
    const body = (await response.json()) as { data?: OpenRouterModelInfo[] };
    const models = (body.data ?? [])
      .filter((model) => {
        const pricing = model.pricing ?? {};
        const prompt = String(pricing.prompt ?? '').trim();
        const completion = String(pricing.completion ?? '').trim();
        const zeroPriced = ['0', '0.0', '0.000000', ''].includes(prompt)
          && ['0', '0.0', '0.000000', ''].includes(completion);
        const freeSuffix = model.id.endsWith(':free');
        return freeSuffix || (zeroPriced && !options.requireFreeSuffix);
      })
      .map((model) => model.id);
    return models.length > 0 ? [...new Set(models)] : [...FREE_OPENROUTER_MODELS];
  } catch {
    return [...FREE_OPENROUTER_MODELS];
  }
}
