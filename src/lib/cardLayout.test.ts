import { describe, expect, it } from 'vitest'

import { layoutCards } from './cardLayout'

const box = (id: string, desiredTop: number, height = 50) => ({ id, desiredTop, height })

describe('layoutCards', () => {
  it('keeps cards at their text when there is room', () => {
    const tops = layoutCards([box('a', 0), box('b', 200)], null, 10)

    expect(Object.fromEntries(tops)).toEqual({ a: 0, b: 200 })
  })

  it('pushes colliding cards down when nothing is active', () => {
    const tops = layoutCards([box('a', 100), box('b', 110), box('c', 120)], null, 10)

    expect(Object.fromEntries(tops)).toEqual({ a: 100, b: 160, c: 220 })
  })

  it('pins the active card to its text and pushes earlier cards up', () => {
    const tops = layoutCards([box('a', 100), box('b', 110), box('c', 120)], 'b', 10)

    expect(Object.fromEntries(tops)).toEqual({ a: 50, b: 110, c: 170 })
  })

  it('falls back to flowing down when pushing up would leave the page', () => {
    const tops = layoutCards([box('a', 0), box('b', 10)], 'b', 10)

    expect(Object.fromEntries(tops)).toEqual({ a: 0, b: 60 })
  })
})
