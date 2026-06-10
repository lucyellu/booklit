import { AppProvider } from './context/AppContext'
import { BookProvider } from './context/BookContext'
import { AppShell } from './components/layout/AppShell'
import { ReaderPane } from './components/reader/ReaderPane'
import { ErrorBoundary } from './components/ErrorBoundary'

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <BookProvider>
          <div className="film-grain">
            <AppShell />
            <ReaderPane />
          </div>
        </BookProvider>
      </AppProvider>
    </ErrorBoundary>
  )
}
