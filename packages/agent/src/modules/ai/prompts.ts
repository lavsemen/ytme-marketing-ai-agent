import defaultPromptsJson from '../../config/prompts.json' with { type: 'json' };
import type { PromptsConfig } from '../../config/agentConfig.js';

/**
 * Default prompt texts shipped with the repo.
 * Effective prompts at runtime are loaded via loadPrompts() in agentConfig and may be overridden by
 * editing Firestore config/prompts (the admin UI Prompts page writes there).
 */
export const DEFAULT_PROMPTS: PromptsConfig = defaultPromptsJson as PromptsConfig;
