import { useEffect, useState } from 'react'
import { Dictionary, type DictRow, type HskRow } from '../core/dictionary'

const base = import.meta.env.BASE_URL
let small: Promise<Dictionary> | null = null
let full: Promise<Dictionary> | null = null
let hskRows: HskRow[] | null = null

async function getHsk(): Promise<HskRow[]> {
  if (!hskRows) hskRows = (await (await fetch(`${base}data/hsk.json`)).json()) as HskRow[]
  return hskRows
}

/** HSK words only: ~12k entries, loads instantly. */
export function loadHskDictionary(): Promise<Dictionary> {
  small ??= getHsk().then((h) => new Dictionary(h))
  return small
}

/** HSK + all of CC-CEDICT (124k entries, ~4 MB gzipped, cached by the service worker). */
export function loadFullDictionary(): Promise<Dictionary> {
  full ??= Promise.all([getHsk(), fetch(`${base}data/dict.json`).then((r) => r.json() as Promise<DictRow[]>)]).then(
    ([h, d]) => new Dictionary(h, d),
  )
  return full
}

/** Returns the HSK dictionary immediately and swaps in the full one when it has loaded. */
export function useDictionary(wantFull: boolean) {
  const [dict, setDict] = useState<Dictionary | null>(null)
  const [isFull, setIsFull] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    loadHskDictionary().then((d) => alive && !isFull && setDict((cur) => cur ?? d)).catch((e) => alive && setError(String(e)))
    if (wantFull)
      loadFullDictionary()
        .then((d) => {
          if (alive) {
            setDict(d)
            setIsFull(true)
          }
        })
        .catch(() => alive && setError('Could not load the full dictionary — showing HSK words only.'))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantFull])
  return { dict, isFull, error }
}
