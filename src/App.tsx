import { NavLink, Route, Routes } from 'react-router-dom'
import { AddWordPage } from './pages/AddWord'
import { CollectionPage } from './pages/Collection'
import { DeckPage, DecksPage } from './pages/Decks'
import { HomePage } from './pages/Home'
import { SettingsPage } from './pages/Settings'
import { StudyPage } from './pages/Study'

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
