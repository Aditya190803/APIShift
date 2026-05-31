import assert from 'node:assert/strict';
import { createOpenAI } from '@ai-sdk/openai';
import { APIShift, discoverOpenRouterFreeModels } from '../dist/index.mjs';

const apiKey = process.env.APISHIFT_OPENROUTER_API_KEY;
if (!apiKey) {
  console.log('Skipping live JS OpenRouter test: set APISHIFT_OPENROUTER_API_KEY.');
  process.exit(0);
}

const models = await discoverOpenRouterFreeModels({ apiKey });
assert.ok(models.length > 0, 'expected at least one discovered free model');

const openrouter = createOpenAI({
  apiKey,
  baseURL: 'https://openrouter.ai/api/v1',
  headers: {
    'HTTP-Referer': 'https://github.com/Aditya190803/APIShift',
    'X-Title': 'APIShift live integration test',
  },
});

const orchestrator = new APIShift([
  { model: openrouter.chat(models[0]), name: `openrouter:${models[0]}`, free: true, priority: 10 },
], {
  systemPrompt: 'Answer exactly and briefly for a live integration smoke test.',
  maxContextTokens: 1000,
});

const result = await orchestrator.sendMessage('Reply with exactly: apishift-js-live-ok', {
  maxOutputTokens: 20,
});

assert.match(result.text.toLowerCase(), /apishift-js-live-ok/);
console.log('JS live OpenRouter test passed using', models[0]);
