/** What the co-author is doing right now, as shown in the top bar. */
export type CoauthorStatus =
  { kind: 'idle' } | { kind: 'working'; message: string; suggestionId: string | null }

/** A one-line message at the bottom of the screen: the model's note, or what went wrong. */
export type NoticeMessage = { id: number; tone: 'info' | 'error'; text: string }

/** A one-click ask. The instruction is what the model sees; the label is for people. */
export type QuickAction = { id: string; label: string; instruction: string }
