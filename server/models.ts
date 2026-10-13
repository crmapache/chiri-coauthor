/**
 * Models the app knows how to call. The default was chosen by the bake-off in `evals/`;
 * `OPENROUTER_MODEL` can point to any other OpenRouter model without a code change.
 */
export type ModelProfile = {
  id: string
  label: string
  /** OpenRouter's unified reasoning switch. Editing is a fast task; long thinking only adds latency. */
  reasoning?: { effort?: 'minimal' | 'low' | 'medium' | 'high'; enabled?: boolean }
}

export const MODEL_PROFILES: ModelProfile[] = [
  { id: 'anthropic/claude-haiku-5.5', label: 'Claude Haiku 5.5', reasoning: { enabled: false } },
  // Sonnet 5.5 refuses requests with reasoning switched off; low effort is the closest to none.
  { id: 'anthropic/claude-sonnet-5.5', label: 'Claude Sonnet 5.5', reasoning: { effort: 'low' } },
  { id: 'openai/gpt-6-luna', label: 'GPT-6 Luna', reasoning: { effort: 'low' } },
  { id: 'google/gemini-3.8-flash', label: 'Gemini 3.8 Flash', reasoning: { effort: 'low' } },
]

export const DEFAULT_MODEL_ID = 'anthropic/claude-sonnet-5.5'

export function resolveModel(id: string | undefined): ModelProfile {
  const wanted = id?.trim() || DEFAULT_MODEL_ID

  return MODEL_PROFILES.find((profile) => profile.id === wanted) ?? { id: wanted, label: wanted }
}
