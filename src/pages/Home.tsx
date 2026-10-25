import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../data/db'
import { repo } from '../data/repo'

export function HomePage() {
  const stats = useLiveQuery(async () => {
    await Promise.all([db.words.count(), db.items.count(), db.logs.count()]) // subscribe to all tables
    return repo.stats()
  }, [])
  if (!stats) return null
  const todo = stats.dueReviews + stats.newToday
  return (
    <div className="page">
      <h1>Today</h1>
      {stats.words === 0 ? (
        <div className="panel center-text">
          <p>Your collection is empty. Start with an HSK list or add your own words.</p>
          <div className="row center">
            <Link className="btn primary" to="/decks">Browse HSK lists</Link>
            <Link className="btn" to="/add">Add a word</Link>
          </div>
        </div>
      ) : (
        <>
          <div className="stats">
            <div className="stat"><b>{stats.dueReviews}</b><span>reviews due</span></div>
            <div className="stat"><b>{stats.newToday}</b><span>new words today</span></div>
            <div className="stat"><b>{stats.reviewedToday}</b><span>answered today</span></div>
            <div className="stat"><b>{stats.words}</b><span>words in collection</span></div>
          </div>
          <div className="row center">
            {todo > 0 ? (
              <Link className="btn primary big" to="/study">Start studying ({todo})</Link>
            ) : (
              <div className="panel center-text">All done for today 🎉</div>
            )}
          </div>
          {stats.waiting > stats.newToday && (
            <div className="row center">
              <Link className="btn" to="/study?extra=10">Learn 10 more new words</Link>
            </div>
          )}
        </>
      )}
    </div>
  )
}
