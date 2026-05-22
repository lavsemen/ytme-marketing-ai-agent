import type { LlmClient, LlmCompleteInput } from './llmClient.js';

export type MockResponder = (input: LlmCompleteInput) => string | Promise<string>;

export class MockLlmClient implements LlmClient {
  constructor(private responder: MockResponder) {}

  async complete(input: LlmCompleteInput): Promise<string> {
    return this.responder(input);
  }
}
