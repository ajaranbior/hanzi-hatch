import { splitNumeric, syllableToMarked } from '../core/pinyin'

/** Renders numeric pinyin as tone-marked syllables, optionally coloured by tone. */
export function PinyinText({ pinyin, colors = true, className = '' }: { pinyin: string; colors?: boolean; className?: string }) {
  return (
    <span className={`pinyin ${className}`}>
      {splitNumeric(pinyin).map((s, i) => (
        <span key={i} className={colors ? `tone-${s.tone}` : undefined}>
          {syllableToMarked(s.base, s.tone)}
        </span>
      ))}
    </span>
  )
}

export function ToneHanzi({ hanzi, pinyin, colors = true }: { hanzi: string; pinyin: string; colors?: boolean }) {
  const syl = splitNumeric(pinyin)
  const han = [...hanzi].filter((c) => /\p{Script=Han}/u.test(c))
  const aligned = syl.length === han.length
  let i = 0
  return (
    <span className="hanzi">
      {[...hanzi].map((ch, k) => {
        const isHan = /\p{Script=Han}/u.test(ch)
        const s = isHan && aligned ? syl[i++] : undefined
        return (
          <span key={k} className={colors && s ? `tone-${s.tone}` : undefined}>
            {ch}
          </span>
        )
      })}
    </span>
  )
}
