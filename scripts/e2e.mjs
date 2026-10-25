// Smoke test in a real browser against the production build:  npm run build && npm run e2e
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

const server = spawn('npx', ['vite', 'preview', '--port', '4177', '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 420, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
const step = (s) => console.log('•', s)
const base = 'http://localhost:4177/'
try {
  await page.goto(base)
  await page.getByText('Browse HSK lists').click()
  await page.getByRole('link', { name: /HSK 1/ }).first().click()
  // mark the first word as known, then "Study now" must skip it and start the next 10
  const first = await page.locator('.entry .hanzi-cell').first().innerText()
  await page.locator('.entry').first().getByRole('button', { name: 'I know it' }).click()
  await page.locator('.entry').first().locator('.status-known').waitFor()
  step(`marked ${first} as known`)
  await page.getByRole('button', { name: /Study now/ }).click()
  await page.waitForURL(/#\/study\?ids=/)
  await page.getByText('New word').first().waitFor()
  const introduced = await page.locator('.big-hanzi').first().innerText()
  if (introduced === first) throw new Error('Study now started with the known word')
  step(`Study now opened a session starting with ${introduced} (known ${first} skipped)`)
  // dark mode: the writer box must use light ink on the dark card
  await page.locator('.theme-toggle').click() // auto -> light
  await page.locator('.theme-toggle').click() // light -> dark
  if ((await page.evaluate(() => document.documentElement.dataset.theme)) !== 'dark') throw new Error('theme did not switch to dark')
  await page.waitForTimeout(3500)
  await page.screenshot({ path: (process.argv[2] ?? 'e2e.png').replace('.png', '-dark.png') })
  const ink = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--ink').trim())
  const strokeFill = await page.evaluate(() => [...document.querySelectorAll('.writer-box svg path')].map((p) => getComputedStyle(p).fill).find((f) => f && f !== 'none'))
  console.log('  dark theme --ink', ink, '| writer stroke fill', strokeFill)
  await page.locator('.theme-toggle').click() // dark -> auto
  step('theme toggle works')
  await page.goto(base + '#/decks/old/1')
  await page.getByRole('button', { name: /Add next 50/ }).click()
  await page.getByText('Added ✓').first().waitFor()
  step('add next 50 for later')

  await page.goto(base + '#/add')
  await page.getByPlaceholder('你好 · ni hao · hello').fill('nihao')
  await page.getByText('你好').first().waitFor()
  step('pinyin search "nihao" finds 你好')
  await page.getByPlaceholder('你好 · ni hao · hello').fill('daughter')
  await page.getByText('女儿').first().waitFor({ timeout: 20000 })
  step('English search finds 女儿 (full dictionary loaded)')
  await page.getByPlaceholder('你好 · ni hao · hello').fill('的')
  await page.locator('.entry').first().waitFor()
  await page.waitForTimeout(500)
  const de = await page.locator('.hanzi-cell', { hasText: /^的$/ }).count()
  if (de !== 1) throw new Error(`searching 的 should list the single word 的 once, got ${de}`)
  step('searching 的 shows a single entry')
  await page.getByPlaceholder('你好 · ni hao · hello').fill('咖啡')
  await page.getByText('coffee').first().waitFor()
  await page.getByRole('button', { name: 'Add', exact: true }).first().click()
  step('added 咖啡 from dictionary')
  await page.getByPlaceholder('你好', { exact: true }).fill('朋友们')
  const py = await page.getByPlaceholder('ni3 hao3 or nǐ hǎo').inputValue()
  console.log('  auto pinyin for 朋友们 →', py)

  await page.goto(base + '#/study')
  await page.evaluate(() => { window.__log = []; let last = ''; setInterval(() => { const c = document.querySelector('.card'); const t = c ? (c.querySelector('.kicker')?.textContent ?? '?') + (c.querySelector('.verdict') ? ' [result]' : '') : '-'; if (t !== last) { window.__log.push(t); last = t } }, 20) })
  let introPinyin = ''
  let autoChecked = false
  const seen = new Set()
  const finalClick = async (locator) => {
    const before = await page.locator('.card').innerText()
    await locator.click()
    await page.waitForFunction((t) => !document.querySelector('.card') || document.querySelector('.card').innerText !== t, before, { timeout: 5000 })
  }
  for (let i = 0; i < 60 && seen.size < 5; i++) {
    const kicker = await page.locator('.kicker').first().textContent({ timeout: 3000 }).catch(() => null)
    if (!kicker) break
    seen.add(kicker)
    if (kicker === 'New word') { introPinyin = (await page.locator('.card .pinyin').first().innerText()).replace(/\s+/g, ' ').trim(); await finalClick(page.getByRole('button', { name: /Start practising/ })) }
    else if (kicker.startsWith('What does')) { await page.getByRole('button', { name: /Show answer/ }).click(); await finalClick(page.locator('.btn.grade.g3')) }
    else if (kicker.startsWith('Which tones')) {
      const n = await page.locator('.tone-slot').count()
      for (let k = 0; k < n; k++) await page.locator('.tone-btn').nth(0).click()
      await finalClick(page.locator('.btn.grade.g1'))
    } else if (kicker.startsWith('Listen') && !autoChecked && introPinyin) {
      // a correct answer must move on by itself, with no click on a grade button
      const before = await page.locator('.card').innerText()
      await page.locator('.pinyin-input').fill(introPinyin); await page.keyboard.press('Enter')
      await page.waitForFunction((t) => document.querySelector('.card')?.innerText !== t && !document.querySelector('.card .verdict'), before, { timeout: 4000 })
      autoChecked = true; step(`correct pinyin "${introPinyin}" advanced automatically`)
    } else if (kicker.startsWith('Listen')) { await page.locator('.pinyin-input').fill('zzz'); await page.keyboard.press('Enter'); await page.waitForTimeout(300); if (!(await page.locator('.verdict').count())) throw new Error('Enter on the pronunciation card skipped the result (key leaked into grade panel)'); await finalClick(page.locator('.btn.grade.g1')) }
    else if (kicker.startsWith('Write')) {
      await page.locator('svg').first().waitFor()
      await page.getByRole('button', { name: 'Show me' }).click()
      await finalClick(page.locator('.btn.grade.g1'))
    }
  }
  console.log('  card types seen:', [...seen].join(' | '))
  await page.screenshot({ path: process.argv[2] ?? 'e2e.png' })
  const s = await page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name))
  console.log('  databases:', s)
  if (errors.length) { console.log('CONSOLE ERRORS:\n' + errors.join('\n')); process.exitCode = 1 } else console.log('no console errors')
} catch (e) {
  console.error('LOG', JSON.stringify(await page.evaluate(() => window.__log).catch(() => null)));
  console.error('E2E FAILED', e.message.split('\n').slice(0, 6).join(' / '), '\nCARD:', (await page.locator('.card').innerText().catch(() => '?')).replace(/\n+/g, ' | ')); await page.screenshot({ path: 'e2e-fail.png' }); process.exitCode = 1
} finally {
  await browser.close(); server.kill()
}
