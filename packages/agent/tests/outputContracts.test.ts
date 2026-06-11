import { describe, it, expect } from 'vitest';
import { composeLlmSystemPrompt, NEWS_ANALYZER_OUTPUT_CONTRACT } from '../src/modules/ai/outputContracts.js';

describe('outputContracts', () => {
  it('places contract before editable instructions', () => {
    const system = composeLlmSystemPrompt(NEWS_ANALYZER_OUTPUT_CONTRACT, 'Мои критерии');
    const contractIdx = system.indexOf('ФОРМАТ ОТВЕТА');
    const taskIdx = system.indexOf('Мои критерии');
    expect(contractIdx).toBeGreaterThan(-1);
    expect(taskIdx).toBeGreaterThan(contractIdx);
    expect(system).toContain('infopovodList');
  });
});
