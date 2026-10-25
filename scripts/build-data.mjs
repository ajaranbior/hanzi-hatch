// Builds the static data the app ships with.
//   public/data/hsk.json    HSK 2.0 + 3.0 word lists   (committed; source: drkameleon/complete-hsk-vocabulary, MIT)
//   public/data/dict.json   compact CC-CEDICT          (generated from the `cc-cedict` npm package, CC BY-SA 4.0)
//   public/strokes/*.json   stroke-order data          (copied from `hanzi-writer-data`, Make Me a Hanzi data)
//
//   node scripts/build-data.mjs                 build everything that can be built
//   node scripts/build-data.mjs --if-missing    only build what is not there yet (used by predev/prebuild)
//   node scripts/build-data.mjs --refresh-hsk   re-download the HSK list from GitHub first
//
// Needs Node >= 22.18 (runs the TypeScript pinyin module directly).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { isValidSyllable, parsePinyin } from '../src/core/pinyin.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = new Set(process.argv.slice(2))
const ifMissing = args.has('--if-missing')
const out = (...p) => path.join(root, 'public', ...p)

const HSK_URL = 'https://raw.githubusercontent.com/drkameleon/complete-hsk-vocabulary/main/complete.min.json'
const RAW_HSK = path.join(root, 'data', 'complete.min.json') // gitignored cache of the download

const isHan = (c) => /\p{Script=Han}/u.test(c)
const hanCount = (s) => [...s].filter(isHan).length

/** Normalise any pinyin spelling to "ni3 hao3"; null if it can't be parsed into valid syllables. */
function numeric(p) {
  const syl = parsePinyin(p, true)
  if (!syl.length || !syl.every((s) => isValidSyllable(s.base) || s.base === 'r')) return null
  return syl.map((s) => `${s.base}${s.tone}`).join(' ')
}

async function buildHsk() {
  if (ifMissing && fs.existsSync(out('data', 'hsk.json'))) return
  if (args.has('--refresh-hsk') || !fs.existsSync(RAW_HSK)) {
    if (!fs.existsSync(RAW_HSK) && fs.existsSync(out('data', 'hsk.json')) && !args.has('--refresh-hsk')) return
    console.log('downloading HSK list…')
    const res = await fetch(HSK_URL)
    if (!res.ok) throw new Error(`HSK download failed: ${res.status}`)
    fs.mkdirSync(path.dirname(RAW_HSK), { recursive: true })
    fs.writeFileSync(RAW_HSK, Buffer.from(await res.arrayBuffer()))
  }
  const raw = JSON.parse(fs.readFileSync(RAW_HSK, 'utf8'))
  const rows = []
  let bad = 0
  for (const w of raw) {
    let oldL = 0
    let newL = 0
    for (const l of w.l) {
      const n = Number(l.slice(1))
      if (l[0] === 'o') oldL = oldL ? Math.min(oldL, n) : n
      if (l[0] === 'n') newL = newL ? Math.min(newL, n) : n
    }
    if (!oldL && !newL) continue // only in the 't' (Taiwan TOCFL) lists
    for (const f of w.f) {
      const py = numeric(f.i.y) ?? numeric(f.i.n)
      if (!py) {
        bad++
        continue
      }
      const meaning = f.m.slice(0, 4).join('; ')
      rows.push([w.s, py, meaning, oldL, newL, w.q ?? 99999, f.c?.[0] ?? ''])
    }
  }
  rows.sort((a, b) => a[5] - b[5])
  fs.mkdirSync(out('data'), { recursive: true })
  fs.writeFileSync(out('data', 'hsk.json'), JSON.stringify(rows))
  const mism = rows.filter((r) => hanCount(r[0]) !== r[1].split(' ').length).length
  console.log(`hsk.json: ${rows.length} entries (${bad} skipped unparsable, ${mism} with syllable/hanzi count mismatch)`)
}

async function buildDict() {
  if (ifMissing && fs.existsSync(out('data', 'dict.json'))) return
  const pkgDir = path.join(root, 'node_modules', 'cc-cedict')
  const mod = await import(pathToFileURL(path.join(pkgDir, 'data', 'all.js')).href)
  const rows = []
  for (const e of mod.default.all) {
    const [trad, simp, py, defs] = e
    const p = numeric(py)
    if (!p) continue
    const d = Array.isArray(defs) ? defs.join('; ') : String(defs)
    rows.push(trad === simp ? [simp, p, d] : [simp, p, d, trad])
  }
  fs.mkdirSync(out('data'), { recursive: true })
  fs.writeFileSync(out('data', 'dict.json'), JSON.stringify(rows))
  console.log(`dict.json: ${rows.length} entries, ${(fs.statSync(out('data', 'dict.json')).size / 1e6).toFixed(1)} MB`)
}

function copyStrokes() {
  const dest = out('strokes')
  if (ifMissing && fs.existsSync(dest) && fs.readdirSync(dest).length > 1000) return
  const src = path.join(root, 'node_modules', 'hanzi-writer-data')
  fs.mkdirSync(dest, { recursive: true })
  let n = 0
  for (const f of fs.readdirSync(src)) {
    if (!f.endsWith('.json') || f === 'package.json' || f === 'all.json') continue
    fs.copyFileSync(path.join(src, f), path.join(dest, f))
    n++
  }
  console.log(`strokes: ${n} characters`)
}

await buildHsk()
await buildDict()
copyStrokes()
