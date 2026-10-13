export type QuickAction = { id: string; label: string; instruction: string }

/** One-click asks for a selection. The instruction is what the model sees; the label is for people. */
export const SELECTION_ACTIONS: QuickAction[] = [
  {
    id: 'improve',
    label: 'Improve',
    instruction: 'Improve this passage: make it clearer and more direct without changing its meaning.',
  },
  {
    id: 'shorten',
    label: 'Shorten',
    instruction: 'Make this passage noticeably shorter. Keep every fact and the main point.',
  },
  {
    id: 'grammar',
    label: 'Fix grammar',
    instruction: 'Fix spelling, grammar and punctuation only. Change nothing else.',
  },
  {
    id: 'formal',
    label: 'More formal',
    instruction: 'Make the tone more formal and professional.',
  },
  {
    id: 'friendly',
    label: 'Friendlier',
    instruction: 'Make the tone warmer and more conversational.',
  },
]

/** Quick pushes on an existing suggestion, the things writers say most often to an editor. */
export const REFINE_ACTIONS: QuickAction[] = [
  { id: 'shorter', label: 'Shorter', instruction: 'Make it shorter.' },
  { id: 'simpler', label: 'Simpler', instruction: 'Use simpler, plainer words.' },
  { id: 'closer', label: 'Closer to mine', instruction: 'Stay closer to my original wording.' },
  { id: 'another', label: 'Another take', instruction: 'Try a different approach.' },
]

export const REVIEW_LABEL = 'Review'
