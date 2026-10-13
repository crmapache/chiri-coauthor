import { useCallback, useState, useSyncExternalStore } from 'react'

import type { CoauthorCommands } from '../editor/coauthorKeymap'
import { EditorStore } from '../editor/editorStore'

/**
 * Mounts the editor into the element the returned ref is attached to, and re-renders whenever the
 * text, selection or suggestions change.
 */
export function useCoauthorEditor(commands: { current: CoauthorCommands }) {
  const [store] = useState(() => new EditorStore(commands))
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot)

  const parentRef = useCallback(
    (parent: HTMLDivElement | null) => {
      if (!parent) return

      store.mount(parent)

      return () => store.unmount()
    },
    [store],
  )

  return { parentRef, snapshot }
}
