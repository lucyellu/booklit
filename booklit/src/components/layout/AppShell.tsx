import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { PlayerBar } from './PlayerBar'
import { SettingsModal } from './SettingsModal'
import { ResizeHandle } from './ResizeHandle'
import { LibraryView } from '../library/LibraryView'
import { HomeView } from '../library/HomeView'
import { PlaylistView } from '../library/PlaylistView'
import { SectionIndexView } from '../library/SectionIndexView'
import { BookDetailPanel } from '../library/BookDetailPanel'

export function AppShell() {
  const { sidebarOpen, view, sidebarWidth, setSidebarWidth } = useApp()
  // Suppressed while dragging so the width transition (built for the open/
  // close toggle) doesn't fight the live drag with a 300ms chase.
  const [resizingSidebar, setResizingSidebar] = useState(false)

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-bg">
      {/* App grid: chrome sidebar + content column, with the player band
          spanning the full width underneath. */}
      <div className="relative h-full flex flex-col">
        <div className="flex flex-1 min-h-0">
          {/* Sidebar */}
          <div
            className={`flex-shrink-0 overflow-hidden ${
              resizingSidebar ? '' : 'transition-all duration-300 ease-out'
            }`}
            style={{ width: sidebarOpen ? sidebarWidth : 0 }}
          >
            <Sidebar />
          </div>

          {sidebarOpen && (
            <ResizeHandle
              className="relative w-[5px] flex-shrink-0"
              onDragStart={() => setResizingSidebar(true)}
              onDragEnd={() => setResizingSidebar(false)}
              onResize={delta => setSidebarWidth(w => w + delta)}
            />
          )}

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
