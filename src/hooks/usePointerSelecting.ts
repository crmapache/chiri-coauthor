import { useCallback, useEffect, useState } from 'react'

/**
 * True while the mouse button is held after pressing inside the editor. The selection menu waits
 * for the drag to end; popping up mid-drag would jump around under the cursor. Dragging selected
 * text away cancels the pointer instead of releasing it, so that ends the gesture too.
 */
export function usePointerSelecting() {
  const [selecting, setSelecting] = useState(false)

  useEffect(() => {
    if (!selecting) return

    const handleRelease = () => setSelecting(false)
    const events = ['pointerup', 'pointercancel', 'dragend'] as const

    events.forEach((event) => window.addEventListener(event, handleRelease))

    return () => events.forEach((event) => window.removeEventListener(event, handleRelease))
  }, [selecting])

  const handlePointerDown = useCallback(() => setSelecting(true), [])

  return { selecting, handlePointerDown }
}
