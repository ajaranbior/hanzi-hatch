import type { Grade, ReviewItem } from './types'

const MIN = 60_000
const DAY = 86_400_000
/** learning steps in minutes before a new/lapsed item graduates to day-based reviews */
export const LEARNING_STEPS = [1, 10]
const START_EASE = 2.5
const MIN_EASE = 1.3
const MAX_INTERVAL = 365

export function newItem(wordId: number, kind: ReviewItem['kind'], now: number): ReviewItem {
  return {
    id: `${wordId}:${kind}`,
    wordId,
    kind,
    state: 'new',
    due: now,
    interval: 0,
    ease: START_EASE,
    step: 0,
    reps: 0,
    lapses: 0,
  }
}

/**
 * Anki-style scheduler: short learning steps, then ease-based intervals.
 * Pure function: returns the updated item, never mutates.
 */
export function schedule(item: ReviewItem, grade: Grade, now: number): ReviewItem {
  const next: ReviewItem = { ...item, lastReview: now, reps: item.reps + 1 }

  if (item.state === 'review') {
    if (grade === 1) {
      next.lapses += 1
      next.ease = Math.max(MIN_EASE, item.ease - 0.2)
      next.interval = Math.max(1, Math.round(item.interval * 0.4))
      next.state = 'learning'
      next.step = 0
      next.due = now + LEARNING_STEPS[0] * MIN
      return next
    }
    let interval: number
    if (grade === 2) {
      interval = item.interval * 1.2
      next.ease = Math.max(MIN_EASE, item.ease - 0.15)
    } else if (grade === 3) {
      interval = item.interval * item.ease
    } else {
      interval = item.interval * item.ease * 1.3
      next.ease = item.ease + 0.15
    }
    // always move forward by at least a day more than a "hard" would
    interval = Math.max(interval, item.interval + (grade === 2 ? 1 : grade === 3 ? 2 : 3))
    next.interval = Math.min(MAX_INTERVAL, Math.round(interval))
    next.due = now + next.interval * DAY
    return next
  }

  // new or learning
  const relearning = item.interval > 0
  if (grade === 1) {
    next.state = 'learning'
    next.step = 0
    next.due = now + LEARNING_STEPS[0] * MIN
    return next
  }
  if (grade === 4) return graduate(next, relearning ? next.interval + 1 : 3, now)
  const step = grade === 3 ? item.step + 1 : item.step // hard repeats the step
  if (step >= LEARNING_STEPS.length) return graduate(next, relearning ? Math.max(1, next.interval) : 1, now)
  next.state = 'learning'
  next.step = step
  next.due = now + LEARNING_STEPS[step] * (grade === 2 ? 1.5 : 1) * MIN
  return next
}

function graduate(item: ReviewItem, interval: number, now: number): ReviewItem {
  return { ...item, state: 'review', step: 0, interval, due: now + interval * DAY }
}

/** Human-readable preview of the next interval, for the grade buttons. */
export function previewInterval(item: ReviewItem, grade: Grade, now = Date.now()): string {
  const n = schedule(item, grade, now)
  const ms = n.due - now
  if (ms < 60 * MIN) return `${Math.max(1, Math.round(ms / MIN))}m`
  if (ms < DAY) return `${Math.round(ms / (60 * MIN))}h`
  const d = Math.round(ms / DAY)
  return d < 30 ? `${d}d` : d < 365 ? `${Math.round(d / 30)}mo` : '1y'
}

export function isDue(item: ReviewItem, now: number): boolean {
  return item.due <= now
}
