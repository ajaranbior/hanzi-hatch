import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { DEFAULT_SETTINGS, type Settings, type Word } from '../core/types'
import { db } from './db'
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

/** The collection keyed by `hanzi|pinyin`; updates live as words are added / marked known. */
export function useCollection(): Map<string, Word> {
  return (
    useLiveQuery(async () => {
      await db.words.count() // subscribe to the table
      return repo.collectionMap()
    }, []) ?? new Map<string, Word>()
  )
}
