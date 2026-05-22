export interface LlmCompleteInput {
  system: string;
  user: string;
  jsonMode?: boolean;
  maxTokens?: number;
  temperature?: number;
}

export interface LlmClient {
  complete(input: LlmCompleteInput): Promise<string>;
}
