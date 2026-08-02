import { ThemeProvider } from './context/ThemeContext'
import { AppProvider } from './context/AppContext'
import { AuthProvider } from './context/AuthContext'
import { ProfileProvider } from './context/ProfileContext'
import { BookProvider } from './context/BookContext'
import { ClipProvider } from './context/ClipContext'
import { AppShell } from './components/layout/AppShell'
import { ReaderPane } from './components/reader/ReaderPane'
import { AuthGate } from './components/auth/AuthGate'
import { ErrorBoundary } from './components/ErrorBoundary'

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AppProvider>
          {/* Auth → profiles → books, in that order: a profile belongs to an
              account, and which books load depends on which profile is open. */}
          <AuthProvider>
            <ProfileProvider>
              <BookProvider>
                {/* Inside BookProvider: clips and the reader share one speech
                    synthesiser, so ClipContext has to be able to stop the book. */}
                <ClipProvider>
                  <div className="film-grain">
                    <AppShell />
                    <ReaderPane />
                    <AuthGate />
                  </div>
                </ClipProvider>
              </BookProvider>
            </ProfileProvider>
          </AuthProvider>
        </AppProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}
