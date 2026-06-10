import { useApp } from '../../context/AppContext'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { PlayerBar } from './PlayerBar'
import { SettingsModal } from './SettingsModal'
import { LiquidGradient } from '../background/LiquidGradient'
import { LibraryView } from '../library/LibraryView'

export function AppShell() {
  const { sidebarOpen } = useApp()

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <LiquidGradient />

      {/* App grid */}
      <div className="relative z-10 h-full flex flex-col">
        {/* Main area */}
        <div className="flex flex-1 min-h-0">
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
            <main className="flex-1 min-h-0 overflow-auto p-6">
              <LibraryView />
            </main>
          </div>
        </div>

        {/* Player bar */}
        <PlayerBar />
      </div>

      <SettingsModal />
    </div>
  )
}
