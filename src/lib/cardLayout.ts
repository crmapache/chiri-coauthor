export type CardBox = { id: string; desiredTop: number; height: number }

export const CARD_GAP = 8

/**
 * Places margin cards next to the text they belong to without overlapping, the way Google Docs
 * does: the active card sits exactly at its text, the cards below it are pushed down and the cards
 * above it are pushed up. With no active card everything flows downward from the top.
 */
export function layoutCards(
  boxes: CardBox[],
  activeId: string | null,
  gap = CARD_GAP,
): Map<string, number> {
  const sorted = [...boxes].sort((left, right) => left.desiredTop - right.desiredTop)
  const tops = new Map<string, number>()

  const flowDown = (start: number, floor: number) => {
    let bottom = floor

    for (let index = start; index < sorted.length; index++) {
      const box = sorted[index] as CardBox
      const top = Math.max(box.desiredTop, bottom)

      tops.set(box.id, top)
      bottom = top + box.height + gap
    }
  }

  const anchor = sorted.findIndex((box) => box.id === activeId)

  if (anchor === -1) {
    flowDown(0, 0)
    return tops
  }

  const active = sorted[anchor] as CardBox

  tops.set(active.id, active.desiredTop)
  flowDown(anchor + 1, active.desiredTop + active.height + gap)

  let ceiling = active.desiredTop - gap

  for (let index = anchor - 1; index >= 0; index--) {
    const box = sorted[index] as CardBox
    const top = Math.min(box.desiredTop, ceiling - box.height)

    tops.set(box.id, top)
    ceiling = top - gap
  }

  // Pushing up ran out of room: give up on exact alignment rather than hide cards off the top.
  if (ceiling + gap < 0) {
    tops.clear()
    flowDown(0, 0)
  }

  return tops
}
