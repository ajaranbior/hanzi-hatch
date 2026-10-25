import { useEffect, useRef } from 'react'
import HanziWriter from 'hanzi-writer'
import { useTheme } from '../theme'

const base = import.meta.env.BASE_URL

export const charDataLoader = (char: string, onLoad: (d: unknown) => void, onError: (e?: unknown) => void) => {
  fetch(`${base}strokes/${encodeURIComponent(char)}.json`)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error('no stroke data'))))
    .then(onLoad)
    .catch(onError)
}

/** Browsers report translucent CSS colours as #rrggbbaa, which Hanzi Writer rejects: use rgba() instead. */
function writerColor(value: string): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value)
  if (!m) return value
  const [r, g, b, a] = m.slice(1).map((h) => parseInt(h, 16))
  return `rgba(${r}, ${g}, ${b}, ${+(a / 255).toFixed(2)})`
}

export interface WriterHandle {
  writer: HanziWriter
}

interface Props {
  char: string
  size?: number
  /** 'animate' loops the stroke order demo, 'static' shows the character, 'quiz' hides it and lets the user draw */
  mode: 'animate' | 'static' | 'quiz' | 'idle'
  showOutline?: boolean
  leniency?: number
  onReady?: (w: HanziWriter) => void
  onMistake?: () => void
  onComplete?: (mistakes: number) => void
  onMissing?: () => void
  color?: string
}

/** One square drawing box backed by hanzi-writer (stroke data is served from /strokes). */
export function HanziWriterBox({ char, size = 220, mode, showOutline = false, leniency = 1, onReady, onMistake, onComplete, onMissing, color }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const { resolved: theme } = useTheme() // re-create the writer with the right colours when the theme changes
  const cbs = useRef({ onMistake, onComplete, onReady, onMissing })
  cbs.current = { onMistake, onComplete, onReady, onMissing }

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.innerHTML = ''
    const css = getComputedStyle(document.documentElement)
    const v = (name: string) => writerColor(css.getPropertyValue(name).trim())
    let cancelled = false
    let loop: ReturnType<typeof setTimeout> | undefined
    const writer = HanziWriter.create(el, char, {
      width: size,
      height: size,
      padding: 10,
      charDataLoader: charDataLoader as never,
      showOutline: mode === 'animate' || mode === 'static' || showOutline,
      showCharacter: mode === 'static',
      strokeColor: color ?? v('--ink'),
      outlineColor: v('--outline'),
      highlightColor: v('--accent'),
      // your own stroke: a thick, soft grey "ink" line rather than a thin red scribble
      drawingColor: v('--draw'),
      drawingWidth: 40,
      drawingFadeDuration: 150,
      // a correct stroke snaps into place instead of fading in
      strokeFadeDuration: 0,
      strokeAnimationSpeed: 1.2,
      delayBetweenStrokes: 250,
      leniency,
      showHintAfterMisses: 3,
      highlightOnComplete: true,
      onLoadCharDataError: () => cbs.current.onMissing?.(),
    })
    cbs.current.onReady?.(writer)
    if (mode === 'animate') {
      const play = () => {
        if (cancelled) return
        writer.animateCharacter({ onComplete: () => (loop = setTimeout(play, 1200)) })
      }
      play()
    } else if (mode === 'quiz') {
      writer.quiz({
        onMistake: () => cbs.current.onMistake?.(),
        onComplete: (s) => cbs.current.onComplete?.(s.totalMistakes),
      })
    }
    return () => {
      cancelled = true
      if (loop) clearTimeout(loop)
      try {
        writer.cancelQuiz()
      } catch {
        /* not started */
      }
    }
  }, [char, size, mode, showOutline, leniency, color, theme])

  return <div ref={ref} className="writer-box" style={{ width: size, height: size }} />
}
