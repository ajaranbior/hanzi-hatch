import { useEffect, useRef } from 'react'
import HanziWriter from 'hanzi-writer'

const base = import.meta.env.BASE_URL

export const charDataLoader = (char: string, onLoad: (d: unknown) => void, onError: (e?: unknown) => void) => {
  fetch(`${base}strokes/${encodeURIComponent(char)}.json`)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error('no stroke data'))))
    .then(onLoad)
    .catch(onError)
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
  const cbs = useRef({ onMistake, onComplete, onReady, onMissing })
  cbs.current = { onMistake, onComplete, onReady, onMissing }

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.innerHTML = ''
    let cancelled = false
    let loop: ReturnType<typeof setTimeout> | undefined
    const writer = HanziWriter.create(el, char, {
      width: size,
      height: size,
      padding: 10,
      charDataLoader: charDataLoader as never,
      showOutline: mode === 'animate' || mode === 'static' || showOutline,
      showCharacter: mode === 'static',
      strokeColor: color ?? '#2b2b2b',
      outlineColor: '#d9d3c9',
      drawingColor: '#c0392b',
      radicalColor: undefined,
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
  }, [char, size, mode, showOutline, leniency, color])

  return <div ref={ref} className="writer-box" style={{ width: size, height: size }} />
}
