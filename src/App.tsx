import { NavLink, Route, Routes } from 'react-router-dom'
import { AddWordPage } from './pages/AddWord'
import { CollectionPage } from './pages/Collection'
import { DeckPage, DecksPage } from './pages/Decks'
import { HomePage } from './pages/Home'
import { SettingsPage } from './pages/Settings'
import { StudyPage } from './pages/Study'
import { setTheme, useTheme, type ThemeChoice } from './theme'

const NEXT: Record<ThemeChoice, ThemeChoice> = { auto: 'light', light: 'dark', dark: 'auto' }
const ICON: Record<ThemeChoice, string> = { auto: '🌓', light: '☀️', dark: '🌙' }

function ThemeToggle() {
  const { choice } = useTheme()
  return (
    <button className="btn icon theme-toggle" title={`Theme: ${choice} (click to change)`} onClick={() => setTheme(NEXT[choice])}>
      {ICON[choice]} <small>{choice}</small>
    </button>
  )
}

export function App() {
  return (
    <div className="app">
      <header className="topbar">
        <NavLink to="/" className="brand">字 Hanzi Hatch</NavLink>
        <nav>
          <NavLink to="/" end>Home</NavLink>
          <NavLink to="/decks">HSK lists</NavLink>
          <NavLink to="/add">Add word</NavLink>
          <NavLink to="/words">My words</NavLink>
          <NavLink to="/settings">Settings</NavLink>
        </nav>
        <ThemeToggle />
      </header>
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/study" element={<StudyPage />} />
          <Route path="/decks" element={<DecksPage />} />
          <Route path="/decks/:version/:level" element={<DeckPage />} />
          <Route path="/add" element={<AddWordPage />} />
          <Route path="/words" element={<CollectionPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  )
}
