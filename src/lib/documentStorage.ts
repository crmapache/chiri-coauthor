const STORAGE_KEY = 'coauthor:document:v1'

/** The saved draft, or null on first visit or when storage is unavailable (private mode). */
export function loadDocument(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function saveDocument(text: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, text)
  } catch {
    // Storage full or blocked: the editor keeps working, the draft just won't survive a reload.
  }
}
