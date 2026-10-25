import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { audio } from '../audio/speak'
import { IntroCard, MeaningCard, PronunciationCard, ToneCard, WritingCard } from '../components/cards'
import { DEFAULT_SETTINGS, KIND_LABEL, type Grade, type Settings } from '../core/types'
import { repo, type QueueCard } from '../data/repo'

export function StudyPage() {
  const [params] = useSearchParams()
  const extra = Number(params.get('extra')) || 0
  // "Study now" from a deck: practise exactly these words
  const ids = params.get('ids')?.split(',').map(Number).filter(Boolean)
  const idsKey = ids?.join(',') ?? ''
  const [queue, setQueue] = useState<QueueCard[] | null>(null)
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [idx, setIdx] = useState(0)
  const [answered, setAnswered] = useState(0)
  const total = useRef(0)

  useEffect(() => {
    let alive = true
    Promise.all([repo.buildQueue(Date.now(), extra, ids), repo.getSettings()]).then(([q, s]) => {
      if (!alive) return
      total.current = q.filter((c) => !c.intro).length
      setQueue(q)
      setSettings(s)
    })
    return () => {
      alive = false
      audio.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extra, idsKey])

  if (!queue) return <div className="page"><p className="muted">Loading…</p></div>
  const card = queue[idx]
  if (!card)
    return (
      <div className="page center-text">
        <h1>Session complete 🎉</h1>
        <p>You answered {answered} cards.</p>
        <Link className="btn primary" to="/">Back home</Link>
      </div>
    )

  const advance = () => setIdx((i) => i + 1)

  const grade = async (g: Grade) => {
    audio.stop()
    const next = await repo.grade(card.item, g)
    setAnswered((n) => n + 1)
    if (next.state === 'learning') {
      // see it again before the end of the session
      setQueue((q) => {
        const copy = [...q!]
        copy.splice(Math.min(copy.length, idx + 4), 0, { ...card, item: next, intro: false })
        return copy
      })
    }
    advance()
  }
  const start = async () => {
    audio.stop()
    await repo.markIntroduced(card.word.id!)
    advance()
  }

  const props = { word: card.word, item: card.item, settings, onGrade: grade }
  const key = `${idx}-${card.item.id}`
  const done = queue.slice(0, idx).filter((c) => !c.intro).length
  return (
    <div className="page study">
      <div className="progress"><div style={{ width: `${Math.min(100, (100 * done) / Math.max(1, queue.filter((c) => !c.intro).length))}%` }} /></div>
      <div className="row between muted">
        <span>{card.intro ? 'New word' : KIND_LABEL[card.item.kind]}</span>
        <Link to="/" className="link">End session</Link>
      </div>
      <div className="card">
        {card.intro ? (
          <IntroCard key={key} word={card.word} settings={settings} onStart={start} />
        ) : card.item.kind === 'meaning' ? (
          <MeaningCard key={key} {...props} />
        ) : card.item.kind === 'tone' ? (
          <ToneCard key={key} {...props} />
        ) : card.item.kind === 'pronunciation' ? (
          <PronunciationCard key={key} {...props} />
        ) : (
          <WritingCard key={key} {...props} />
        )}
      </div>
    </div>
  )
}
