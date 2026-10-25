import { useEffect, useState } from 'react'
import { audio, whenVoicesReady } from '../audio/speak'

export function AudioButton({ text, label = 'Listen', slow = false }: { text: string; label?: string; slow?: boolean }) {
  const [ok, setOk] = useState(true)
  useEffect(() => {
    whenVoicesReady().then(setOk)
  }, [])
  return (
    <button
      className="btn icon"
      type="button"
      title={ok ? label : 'No Mandarin voice found on this device'}
      disabled={!ok}
      onClick={() => audio.speak(text, { rate: slow ? 0.55 : 0.85 })}
    >
      {slow ? '🐢' : '🔊'} <span className="sr">{label}</span>
    </button>
  )
}
