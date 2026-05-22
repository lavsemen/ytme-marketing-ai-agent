import Anthropic from '@anthropic-ai/sdk';
import type { LlmClient, LlmCompleteInput } from './llmClient.js';
import { logger } from '../../utils/logger.js';

export interface AnthropicClientOptions {
  apiKey: string;
  model: string;
  defaultMaxTokens?: number;
  defaultTemperature?: number;
}

export class AnthropicClient implements LlmClient {
  private client: Anthropic;

  constructor(private opts: AnthropicClientOptions) {
    this.client = new Anthropic({ apiKey: opts.apiKey });
  }

  async complete(input: LlmCompleteInput): Promise<string> {
    const maxTokens = input.maxTokens ?? this.opts.defaultMaxTokens ?? 2048;
    const temperature = input.temperature ?? this.opts.defaultTemperature ?? 0.4;

    const system = input.jsonMode
      ? `${input.system}\n\nВажно: ответ ДОЛЖЕН быть валидным JSON без пояснений, без markdown-обрамления, без префикса. Только JSON.`
      : input.system;

    logger.debug(
      { model: this.opts.model, maxTokens, temperature, jsonMode: input.jsonMode },
      'Calling Anthropic',
    );

    const response = await this.client.messages.create({
      model: this.opts.model,
      max_tokens: maxTokens,
      temperature,
      system,
      messages: [{ role: 'user', content: input.user }],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('Anthropic response did not contain text block');
    }

    return textBlock.text.trim();
  }
}

export function extractJson(raw: string): string {
  const trimmed = raw.trim();

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch && fenceMatch[1]) return fenceMatch[1].trim();

  const firstBrace = trimmed.search(/[{[]/);
  if (firstBrace > 0) return trimmed.slice(firstBrace);

  return trimmed;
}
