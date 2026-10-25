import { useSyncExternalStore } from 'react'

export type ThemeChoice = 'auto' | 'light' | 'dark'
const KEY = 'hh-theme'
const listeners = new Set<() => void>()
const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null

function read(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'auto'
  } catch {
    return 'auto'
  }
}

let choice: ThemeChoice = read()

function apply() {
  const el = document.documentElement
  if (choice === 'auto') el.removeAttribute('data-theme')
  else el.setAttribute('data-theme', choice)
}

export function resolveTheme(): 'light' | 'dark' {
  return choice === 'auto' ? (media?.matches ? 'dark' : 'light') : choice
}

/** Call once at startup, before the first render, so there is no flash of the wrong theme. */
export function initTheme() {
  apply()
  media?.addEventListener('change', () => listeners.forEach((l) => l()))
}

export function setTheme(next: ThemeChoice) {
  choice = next
  try {
    localStorage.setItem(KEY, next)
  } catch {
    /* private mode: the choice just won't persist */
  }
  apply()
  listeners.forEach((l) => l())
}

const subscribe = (cb: () => void) => {
  listeners.add(cb)
  return () => listeners.delete(cb)
}
const snapshot = () => `${choice}:${resolveTheme()}`

export function useTheme() {
  const [c, resolved] = useSyncExternalStore(subscribe, snapshot).split(':') as [ThemeChoice, 'light' | 'dark']
  return { choice: c, resolved }
}
