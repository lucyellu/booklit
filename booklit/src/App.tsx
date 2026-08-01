import { ThemeProvider } from './context/ThemeContext'
import { AppProvider } from './context/AppContext'
import { BookProvider } from './context/BookContext'
import { ClipProvider } from './context/ClipContext'
import { AppShell } from './components/layout/AppShell'
import { ReaderPane } from './components/reader/ReaderPane'
import { ErrorBoundary } from './components/ErrorBoundary'

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AppProvider>
          <BookProvider>
            {/* Inside BookProvider: clips and the reader share one speech
                synthesiser, so ClipContext has to be able to stop the book. */}
            <ClipProvider>
              <div className="film-grain">
                <AppShell />
                <ReaderPane />
              </div>
            </ClipProvider>
          </BookProvider>
        </AppProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}
