import { useEffect, useState } from 'react'
import { DEFAULT_SETTINGS, type Settings } from '../core/types'
import { repo } from './repo'

/** Settings with optimistic updates: the UI changes immediately, persistence follows. */
export function useSettings(): [Settings, (s: Settings) => void] {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  useEffect(() => {
    let alive = true
    repo.getSettings().then((s) => alive && setSettings(s))
    return () => {
      alive = false
    }
  }, [])
  return [
    settings,
    (next) => {
      setSettings(next)
      void repo.saveSettings(next)
    },
  ]
}
