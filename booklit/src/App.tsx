import { AppProvider } from './context/AppContext'
import { BookProvider } from './context/BookContext'
import { AppShell } from './components/layout/AppShell'
import { ReaderPane } from './components/reader/ReaderPane'

export default function App() {
  return (
    <AppProvider>
      <BookProvider>
        <div className="film-grain">
          <AppShell />
          <ReaderPane />
        </div>
      </BookProvider>
    </AppProvider>
  )
}
