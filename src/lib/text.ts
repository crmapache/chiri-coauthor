/** Cuts text to a length in characters a person would count, never splitting an emoji in half. */
export function shorten(text: string, limit = 32): string {
  const characters = Array.from(text.replace(/\s+/g, ' ').trim())

  return characters.length > limit
    ? `${characters.slice(0, limit - 1).join('')}…`
    : characters.join('')
}

export function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}
