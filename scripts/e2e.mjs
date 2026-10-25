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
  await page.getByRole('button', { name: 'Add next 10' }).click()
  await page.getByText('Added ✓').first().waitFor()
  step('added first 10 HSK 2.0 level-1 words')

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
    if (kicker === 'New word') await finalClick(page.getByRole('button', { name: /Start practising/ }))
    else if (kicker.startsWith('What does')) { await page.getByRole('button', { name: /Show answer/ }).click(); await finalClick(page.locator('.btn.grade.g3')) }
    else if (kicker.startsWith('Which tones')) {
      const n = await page.locator('.tone-slot').count()
      for (let k = 0; k < n; k++) await page.locator('.tone-btn').nth(0).click()
      await finalClick(page.locator('.btn.grade.g1'))
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
