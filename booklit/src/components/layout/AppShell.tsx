import { useApp } from '../../context/AppContext'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { PlayerBar } from './PlayerBar'
import { SettingsModal } from './SettingsModal'
import { LibraryView } from '../library/LibraryView'
import { HomeView } from '../library/HomeView'
import { PlaylistView } from '../library/PlaylistView'
import { SectionIndexView } from '../library/SectionIndexView'
import { BookDetailPanel } from '../library/BookDetailPanel'

export function AppShell() {
  const { sidebarOpen, view } = useApp()

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-bg">
      {/* App grid: chrome sidebar + content column, with the player band
          spanning the full width underneath. */}
      <div className="relative h-full flex flex-col">
        {/* `relative`: over the 3D views the detail panel positions itself
            against this row instead of taking space in it. */}
        <div className="relative flex flex-1 min-h-0">
          {/* Sidebar */}
          <div
            className="transition-all duration-300 ease-out flex-shrink-0 overflow-hidden"
            style={{ width: sidebarOpen ? 240 : 0 }}
          >
            <Sidebar />
          </div>

          {/* Content area */}
          <div className="flex-1 flex flex-col min-w-0">
            <TopBar />
            <main className="flex-1 min-h-0 overflow-auto p-8">
              {view === 'home' ? <HomeView />
                : view === 'playlist' ? <PlaylistView />
                : view === 'index' ? <SectionIndexView />
                : <LibraryView />}
            </main>
          </div>

          {/* Details for whichever book is selected. Docked beside the library
              rather than floating over it, so picking the next book is one
              click and the 3D scene keeps its own space. */}
          <BookDetailPanel />
        </div>

        {/* Player bar */}
        <PlayerBar />
      </div>

      <SettingsModal />
    </div>
  )
}
