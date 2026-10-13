import { useCallback, useEffect, useState } from 'react'

/**
 * True while the mouse button is held after pressing inside the editor. The selection menu waits
 * for the drag to end; popping up mid-drag would jump around under the cursor.
 */
export function usePointerSelecting() {
  const [selecting, setSelecting] = useState(false)

  useEffect(() => {
    if (!selecting) return

    const handlePointerUp = () => setSelecting(false)

    window.addEventListener('pointerup', handlePointerUp)

    return () => window.removeEventListener('pointerup', handlePointerUp)
  }, [selecting])

  const handlePointerDown = useCallback(() => setSelecting(true), [])

  return { selecting, handlePointerDown }
}