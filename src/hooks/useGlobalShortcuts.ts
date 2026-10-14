import { useEffect, type RefObject } from 'react'

import type { CoauthorCommands } from '../editor/coauthorKeymap'

/**
 * `Mod-K` and `Escape` from anywhere on the page, not only from inside the text: after clicking a
 * button the focus is elsewhere, and the shortcut should still work. Inside the editor CodeMirror
 * handles them first and marks the event as handled.
 */
export function useGlobalShortcuts(commands: RefObject<CoauthorCommands>) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return

      const isModK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k'

      if (isModK) {
        event.preventDefault()
        commands.current.openAsk()
        return
      }

      if (event.key === 'Escape' && commands.current.cancelRequest()) event.preventDefault()
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [commands])
}
