import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { audio } from '../audio/speak'
import { hanChars } from '../core/hanzi'
import { checkPinyin, numericToMarked, splitNumeric, TONE_NAMES } from '../core/pinyin'
import { previewInterval } from '../core/srs'
import { GRADE_LABEL, type Grade, type ReviewItem, type Settings, type Word } from '../core/types'
import { AudioButton } from './AudioButton'
import { HanziWriterBox } from './HanziWriterBox'
import { PinyinText, ToneHanzi } from './PinyinText'

const TONE_MARK = ['ˉ', 'ˊ', 'ˇ', 'ˋ', '·']

export interface CardProps {
  word: Word
  item: ReviewItem
  settings: Settings
  onGrade: (g: Grade) => void
}

/** Keyboard shortcut helper: handler gets the key, ignores events from text inputs unless `allowInInput`. */
function useKey(handler: (e: KeyboardEvent) => void, allowInInput = false) {
  const ref = useRef(handler)
  ref.current = handler
  useEffect(() => {
    // React flushes state synchronously inside a keydown, so a card mounted by pressing Enter would
    // receive that same Enter on window and act on it. Ignore events older than the listener.
    const born = performance.now()
    const fn = (e: KeyboardEvent) => {
      if (e.timeStamp < born) return
      const t = e.target as HTMLElement
      if (!allowInInput && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
      ref.current(e)
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [allowInInput])
}

export function GradePanel({ item, suggested, onGrade }: { item: ReviewItem; suggested?: Grade; onGrade: (g: Grade) => void }) {
  useKey((e) => {
    if (e.key >= '1' && e.key <= '4') onGrade(Number(e.key) as Grade)
    else if ((e.key === 'Enter' || e.key === ' ') && suggested) {
      e.preventDefault()
      onGrade(suggested)
    }
  }, true)
  const now = useMemo(() => Date.now(), [])
  return (
    <div className="grades">
      {([1, 2, 3, 4] as Grade[]).map((g) => (
        <button key={g} className={`btn grade g${g} ${suggested === g ? 'suggested' : ''}`} onClick={() => onGrade(g)}>
          <b>{GRADE_LABEL[g]}</b>
          <small>{previewInterval(item, g, now)}</small>
          <kbd>{g}</kbd>
        </button>
      ))}
    </div>
  )
}

function Verdict({ ok, children }: { ok: boolean; children: ReactNode }) {
  return <div className={`verdict ${ok ? 'ok' : 'bad'}`}>{ok ? '✓ ' : '✗ '}{children}</div>
}

// ---------------------------------------------------------------------------

export function IntroCard({ word, settings, onStart }: { word: Word; settings: Settings; onStart: () => void }) {
  const chars = hanChars(word.hanzi)
  useEffect(() => {
    if (settings.autoPlayAudio) audio.speak(word.hanzi)
  }, [word, settings.autoPlayAudio])
  useKey((e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onStart()
    }
  }, true)
  return (
    <div className="card-body">
      <div className="kicker">New word</div>
      <div className="big-hanzi"><ToneHanzi hanzi={word.hanzi} pinyin={word.pinyin} colors={settings.toneColors} /></div>
      <div className="row center">
        <PinyinText pinyin={word.pinyin} colors={settings.toneColors} className="large" />
        <AudioButton text={word.hanzi} />
        <AudioButton text={word.hanzi} slow label="Slow" />
      </div>
      <div className="meaning">{word.meaning}</div>
      <div className="row center wrap">
        {chars.slice(0, 4).map((c) => (
          <HanziWriterBox key={c} char={c} size={140} mode="animate" />
        ))}
      </div>
      <button className="btn primary big" onClick={onStart}>Start practising <kbd>Enter</kbd></button>
    </div>
  )
}

// ---------------------------------------------------------------------------

export function MeaningCard({ word, item, settings, onGrade }: CardProps) {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (settings.autoPlayAudio) audio.speak(word.hanzi)
  }, [word, settings.autoPlayAudio])
  useKey((e) => {
    if (!shown && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      setShown(true)
    }
  })
  return (
    <div className="card-body">
      <div className="kicker">What does this mean?</div>
      <div className="big-hanzi"><ToneHanzi hanzi={word.hanzi} pinyin={word.pinyin} colors={false} /></div>
      {shown ? (
        <>
          <div className="row center"><PinyinText pinyin={word.pinyin} colors={settings.toneColors} className="large" /><AudioButton text={word.hanzi} /></div>
          <div className="meaning">{word.meaning}</div>
          <GradePanel item={item} onGrade={onGrade} />
        </>
      ) : (
        <button className="btn primary big" onClick={() => setShown(true)}>Show answer <kbd>Space</kbd></button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

export function ToneCard({ word, item, settings, onGrade }: CardProps) {
  const want = useMemo(() => splitNumeric(word.pinyin), [word])
  const [picked, setPicked] = useState<number[]>([])
  const done = picked.length === want.length
  const correct = done && picked.every((t, i) => t === want[i].tone)
  const idx = Math.min(picked.length, want.length - 1)

  useEffect(() => {
    if (done && settings.autoPlayAudio) audio.speak(word.hanzi)
  }, [done, word, settings.autoPlayAudio])
  useKey((e) => {
    if (!done && e.key >= '1' && e.key <= '5') setPicked((p) => [...p, Number(e.key)])
    if (!done && e.key === 'Backspace') setPicked((p) => p.slice(0, -1))
  })

  return (
    <div className="card-body">
      <div className="kicker">Which tones?</div>
      <div className="big-hanzi"><ToneHanzi hanzi={word.hanzi} pinyin={word.pinyin} colors={false} /></div>
      <div className="meaning small">{word.meaning}</div>
      <div className="row center">
        {want.map((s, i) => (
          <div key={i} className={`tone-slot ${i === picked.length && !done ? 'active' : ''} ${done ? (picked[i] === s.tone ? 'right' : 'wrong') : ''}`}>
            <span className="base">{s.base}</span>
            <span className={`pick ${picked[i] ? `tone-${picked[i]}` : ''}`}>{picked[i] ? TONE_MARK[picked[i] - 1] : '?'}</span>
          </div>
        ))}
      </div>
      {!done ? (
        <>
          <div className="tone-pad" aria-label={`Tone for syllable ${idx + 1}`}>
            {[1, 2, 3, 4, 5].map((t) => (
              <button key={t} className={`btn tone-btn tone-${t}`} onClick={() => setPicked((p) => [...p, t])}>
                <span className="mark">{TONE_MARK[t - 1]}</span>
                <small>{TONE_NAMES[t]}</small>
                <kbd>{t}</kbd>
              </button>
            ))}
          </div>
          {picked.length > 0 && <button className="btn link" onClick={() => setPicked((p) => p.slice(0, -1))}>undo</button>}
        </>
      ) : (
        <>
          <Verdict ok={correct}><PinyinText pinyin={word.pinyin} colors={settings.toneColors} className="large" /></Verdict>
          <div className="row center"><AudioButton text={word.hanzi} /></div>
          <GradePanel item={item} suggested={correct ? 3 : 1} onGrade={onGrade} />
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

export function PronunciationCard({ word, item, settings, onGrade }: CardProps) {
  const [text, setText] = useState('')
  const [result, setResult] = useState<ReturnType<typeof checkPinyin> | null>(null)
  const [hint, setHint] = useState(false)
  useEffect(() => {
    audio.speak(word.hanzi)
  }, [word])
  const submit = () => {
    if (!text.trim()) return
    setResult(checkPinyin(text, word.pinyin, settings.strictTones))
    if (settings.autoPlayAudio) audio.speak(word.hanzi)
  }
  return (
    <div className="card-body">
      <div className="kicker">Listen and type the pinyin</div>
      <div className="row center">
        <AudioButton text={word.hanzi} />
        <AudioButton text={word.hanzi} slow label="Slow" />
      </div>
      {!result ? (
        <>
          <input
            className="pinyin-input"
            autoFocus
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder={settings.strictTones ? 'e.g. ni3 hao3 or nǐ hǎo' : 'e.g. ni hao'}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
          <div className="row center">
            <button className="btn primary" onClick={submit}>Check <kbd>Enter</kbd></button>
            <button className="btn" onClick={() => setHint(true)} disabled={hint}>Hint</button>
            <button className="btn link" onClick={() => setResult({ correct: false, syllables: [] })}>I don't know</button>
          </div>
          {hint && <div className="meaning small">{word.meaning}</div>}
        </>
      ) : (
        <>
          <Verdict ok={result.correct}>
            <ToneHanzi hanzi={word.hanzi} pinyin={word.pinyin} colors={settings.toneColors} /> · <PinyinText pinyin={word.pinyin} colors={settings.toneColors} />
          </Verdict>
          {!result.correct && text.trim() && <div className="typed">You typed: <b>{numericToMarked(text.trim()) || text}</b></div>}
          <div className="meaning small">{word.meaning}</div>
          <GradePanel item={item} suggested={result.correct ? 3 : 1} onGrade={onGrade} />
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

export function WritingCard({ word, item, settings, onGrade }: CardProps) {
  const chars = useMemo(() => hanChars(word.hanzi), [word])
  const [idx, setIdx] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  const [gaveUp, setGaveUp] = useState(false)
  const [missing, setMissing] = useState(0)
  const finished = idx >= chars.length || gaveUp

  useEffect(() => {
    if (settings.autoPlayAudio) audio.speak(word.hanzi)
  }, [word, settings.autoPlayAudio])
  useEffect(() => {
    if (finished && !gaveUp && settings.autoPlayAudio) audio.speak(word.hanzi)
  }, [finished, gaveUp, word, settings.autoPlayAudio])

  const suggested: Grade = gaveUp ? 1 : mistakes === 0 ? 3 : mistakes <= 2 * chars.length ? 2 : 1
  const size = chars.length > 3 ? 150 : chars.length > 1 ? 200 : 260

  return (
    <div className="card-body">
      <div className="kicker">Write this word</div>
      <div className="row center">
        <PinyinText pinyin={word.pinyin} colors={settings.toneColors} className="large" />
        <AudioButton text={word.hanzi} />
      </div>
      <div className="meaning">{word.meaning}</div>
      <div className="row center wrap writing-row">
        {chars.map((c, i) => (
          <HanziWriterBox
            key={`${c}-${i}-${gaveUp}`}
            char={c}
            size={size}
            leniency={settings.leniency}
            showOutline={settings.showOutline}
            mode={gaveUp ? (i >= idx ? 'animate' : 'static') : i < idx ? 'static' : i === idx ? 'quiz' : 'idle'}
            onMistake={() => setMistakes((m) => m + 1)}
            onComplete={() => setIdx((n) => n + 1)}
            onMissing={() => {
              setMissing((n) => n + 1)
              setIdx((n) => (n === i ? n + 1 : n))
            }}
          />
        ))}
      </div>
      {!finished ? (
        <div className="row center">
          <span className="muted">Draw stroke by stroke · mistakes: {mistakes}</span>
          <button className="btn link" onClick={() => setGaveUp(true)}>Show me</button>
        </div>
      ) : (
        <>
          <Verdict ok={!gaveUp && suggested > 1}>
            <ToneHanzi hanzi={word.hanzi} pinyin={word.pinyin} colors={settings.toneColors} />
            {gaveUp ? ' — study the strokes, then continue' : mistakes ? ` — ${mistakes} mistake${mistakes > 1 ? 's' : ''}` : ' — perfect'}
          </Verdict>
          {missing > 0 && <div className="muted">No stroke data for {missing} character(s); they were skipped.</div>}
          <GradePanel item={item} suggested={suggested} onGrade={onGrade} />
        </>
      )}
    </div>
  )
}
