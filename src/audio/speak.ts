/**
 * Audio goes through a provider so other free sources (e.g. bundled recordings) can be added later.
 * The default provider is the Web Speech API, which is free and works offline with the device's
 * Mandarin voice (Chrome/Edge/Safari/Android/iOS all ship one; some Linux setups do not).
 */
export interface AudioProvider {
  available(): boolean
  speak(text: string, opts?: { rate?: number }): Promise<void>
  stop(): void
}

function pickVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices()
  const zh = voices.filter((v) => /^zh[-_](CN|Hans)|^cmn/i.test(v.lang) || /mandarin|chinese.*(mainland|simplified)/i.test(v.name))
  return zh.find((v) => v.localService) ?? zh[0] ?? voices.find((v) => /^zh/i.test(v.lang))
}

export const webSpeech: AudioProvider = {
  available() {
    return typeof window !== 'undefined' && 'speechSynthesis' in window && !!pickVoice()
  },
  speak(text, opts) {
    return new Promise((resolve) => {
      if (!('speechSynthesis' in window)) return resolve()
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(text)
      u.lang = 'zh-CN'
      const v = pickVoice()
      if (v) u.voice = v
      u.rate = opts?.rate ?? 0.85
      u.onend = () => resolve()
      u.onerror = () => resolve()
      window.speechSynthesis.speak(u)
    })
  },
  stop() {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
  },
}

export const audio: AudioProvider = webSpeech

/** voices load asynchronously in Chrome; resolves once we know whether a Chinese voice exists */
export function whenVoicesReady(): Promise<boolean> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) return resolve(false)
    if (window.speechSynthesis.getVoices().length) return resolve(webSpeech.available())
    const done = () => resolve(webSpeech.available())
    window.speechSynthesis.addEventListener('voiceschanged', done, { once: true })
    setTimeout(done, 1500)
  })
}
