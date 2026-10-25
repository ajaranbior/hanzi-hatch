import { useEffect, useState } from 'react'
import { whenVoicesReady } from '../audio/speak'
import { ITEM_KINDS, KIND_LABEL } from '../core/types'
import { useSettings } from '../data/hooks'
import { repo } from '../data/repo'
import { setTheme, useTheme, type ThemeChoice } from '../theme'

export function SettingsPage() {
  const [s, save] = useSettings()
  const { choice } = useTheme()
  const [voice, setVoice] = useState<boolean | null>(null)
  const [msg, setMsg] = useState('')
  useEffect(() => {
    whenVoicesReady().then(setVoice)
  }, [])

  const exportData = async () => {
    const blob = new Blob([JSON.stringify(await repo.exportAll())], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `hanzi-hatch-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  const importData = async (file: File) => {
    try {
      if (!confirm('This replaces everything in the app with the backup. Continue?')) return
      await repo.importAll(JSON.parse(await file.text()))
      setMsg('Backup restored.')
    } catch (e) {
      setMsg(`Import failed: ${(e as Error).message}`)
    }
  }
  return (
    <div className="page">
      <h1>Settings</h1>
      <section className="panel form">
        <label>
          Theme
          <select value={choice} onChange={(e) => setTheme(e.target.value as ThemeChoice)}>
            <option value="auto">Match my device</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <label>
          New words per day
          <input type="number" min={1} max={100} value={s.newWordsPerDay} onChange={(e) => save({ ...s, newWordsPerDay: Math.max(1, Number(e.target.value) || 1) })} />
        </label>
        <fieldset>
          <legend>Practise</legend>
          {ITEM_KINDS.map((k) => (
            <label key={k} className="check">
              <input type="checkbox" checked={s.kinds[k]} onChange={(e) => save({ ...s, kinds: { ...s.kinds, [k]: e.target.checked } })} /> {KIND_LABEL[k]}
            </label>
          ))}
        </fieldset>
        <label className="check"><input type="checkbox" checked={s.toneColors} onChange={(e) => save({ ...s, toneColors: e.target.checked })} /> Colour pinyin and hanzi by tone</label>
        <label className="check"><input type="checkbox" checked={s.autoPlayAudio} onChange={(e) => save({ ...s, autoPlayAudio: e.target.checked })} /> Play audio automatically</label>
        <label className="check"><input type="checkbox" checked={s.strictTones} onChange={(e) => save({ ...s, strictTones: e.target.checked })} /> Require tones when typing pinyin</label>
        <label className="check"><input type="checkbox" checked={s.showOutline} onChange={(e) => save({ ...s, showOutline: e.target.checked })} /> Show faint outline while writing (easier)</label>
        <label>
          Writing leniency ({s.leniency.toFixed(1)}) — higher accepts sloppier strokes
          <input type="range" min={0.6} max={2} step={0.1} value={s.leniency} onChange={(e) => save({ ...s, leniency: Number(e.target.value) })} />
        </label>
      </section>
      <section className="panel">
        <h2>Audio</h2>
        {voice === null ? <p className="muted">Checking voices…</p> : voice ? <p>A Mandarin voice is available on this device ✓</p> : <p className="error">No Mandarin text-to-speech voice found. Install a Chinese voice in your OS/browser settings (Chrome, Edge, Safari, Android and iOS include one).</p>}
      </section>
      <section className="panel">
        <h2>Backup</h2>
        <p className="muted">Your data lives only in this browser. Export a backup to move it to another device.</p>
        <div className="row wrap">
          <button className="btn" onClick={exportData}>Export backup</button>
          <label className="btn">Import backup<input hidden type="file" accept="application/json" onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} /></label>
        </div>
        {msg && <p>{msg}</p>}
      </section>
      <section className="panel muted">
        <h2>Credits</h2>
        <p>HSK lists: <a href="https://github.com/drkameleon/complete-hsk-vocabulary">complete-hsk-vocabulary</a> (MIT). Dictionary: <a href="https://cc-cedict.org/">CC-CEDICT</a> (CC BY-SA 4.0). Stroke data: <a href="https://github.com/skishore/makemeahanzi">Make Me a Hanzi</a> via <a href="https://hanziwriter.org/">Hanzi Writer</a> (Arphic Public License). Pinyin conversion: pinyin-pro.</p>
      </section>
    </div>
  )
}
