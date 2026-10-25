# Hanzi Hatch 字

A Skritter-style app for learning Chinese: **drawing characters**, **tones**, **pronunciation** and **meaning**, scheduled with spaced repetition. Runs in the browser (installable as a PWA, works offline) and is structured so a mobile app can be wrapped around it later.

## Features

- **HSK lists** – HSK 2.0 (levels 1–6) and HSK 3.0 (levels 1–7/9); add 10 / 50 / all words, or one at a time.
- **Add your own words** – search by **hanzi** (simplified or traditional), **pinyin** (`nihao`, `ni3hao3`, `nǐ hǎo`) or **English** across all of CC-CEDICT (124k entries); a custom form (hanzi → pinyin auto-filled, or type pinyin yourself) and a bulk "one word per line" import.
- **Four practice types per word**, each scheduled independently:
  - *Writing* – draw every character stroke by stroke (stroke order & direction checked by [Hanzi Writer](https://hanziwriter.org/)).
  - *Tones* – pick the tone of every syllable (keys 1–5).
  - *Pronunciation* – listen, then type the pinyin (tone numbers or marks).
  - *Meaning* – flashcard recall.
- **Spaced repetition** (Anki-style learning steps + ease-based intervals), daily new-word limit, new-word intro with stroke animation.
- Tone colours, audio autoplay, writing leniency, backup export/import (Settings).
- Local-first: all progress is stored in the browser (IndexedDB).

## Develop

```bash
npm install        # also builds public/data/dict.json and public/strokes/ from npm packages
npm run dev        # http://localhost:5173
npm test           # unit tests (pinyin, dictionary, SRS, storage)
npm run build      # production build in dist/
npm run e2e        # browser smoke test (needs Playwright; run `npm run build` first)
```

Needs Node ≥ 22.18.

## Deploy (GitHub Pages)

`.github/workflows/pages.yml` builds and deploys on every push to `main`. One-time setup: in the repository go to **Settings → Pages → Build and deployment → Source: GitHub Actions**. The app uses a relative base path and hash routing, so it works at `https://<user>.github.io/hanzi-hatch/` without extra config.

## Layout

```
src/core/    pure TypeScript: pinyin parsing, SRS scheduler, dictionary search, types  (no DOM – reusable in React Native)
src/data/    Dexie (IndexedDB) schema + repository, dictionary loading
src/audio/   audio provider interface (Web Speech API implementation)
src/components, src/pages   React UI
scripts/build-data.mjs      builds HSK / dictionary / stroke data
```

## Audio

Pronunciation uses the browser's built-in text-to-speech (Web Speech API) with the device's Mandarin voice – free and offline, but quality varies by device and some Linux setups have no Chinese voice (Settings shows whether one was found). Audio goes through `AudioProvider` in `src/audio/speak.ts`, so pre-recorded free sources (e.g. Wiktionary/Commons syllable recordings) can be added as another provider.

## Towards a mobile app

The UI is a standard web app with local storage, so the quickest route is [Capacitor](https://capacitorjs.com/) (`npm i @capacitor/core @capacitor/cli && npx cap init && npx cap add ios android`) wrapping `dist/`. Cloud sync would be the next step: `Repo` in `src/data/repo.ts` is the only code that touches the database.

## Data & credits

- HSK lists: [complete-hsk-vocabulary](https://github.com/drkameleon/complete-hsk-vocabulary) (MIT) – committed as `public/data/hsk.json`; refresh with `node scripts/build-data.mjs --refresh-hsk`.
- Dictionary: [CC-CEDICT](https://cc-cedict.org/) via the `cc-cedict` npm package (CC BY-SA 4.0).
- Stroke order data: [Make Me a Hanzi](https://github.com/skishore/makemeahanzi) via `hanzi-writer-data` (Arphic Public License / LGPL).
- Pinyin generation for custom words: [pinyin-pro](https://github.com/zh-lx/pinyin-pro).
