export const AGENT_MODELS = {
  fast: 'gemini-2.0-flash',
  reasoning: 'gemini-2.0-flash',
} as const;

export const AI_TOKEN_RESOURCE_TYPE = 'GEMINI_TOKENS' as const;

export function isAiTokenResourceType(resourceType: string): boolean {
  return resourceType === AI_TOKEN_RESOURCE_TYPE || resourceType === 'CLAUDE_TOKENS';
}
