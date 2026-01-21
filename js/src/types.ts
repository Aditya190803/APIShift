import { z } from 'zod';

export const ProviderSchema = z.object({
  name: z.string(),
  model: z.string(),
  apiKey: z.string().optional(),
});

export type Provider = z.infer<typeof ProviderSchema>;
