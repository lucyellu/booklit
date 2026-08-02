import { useApp } from '../../context/AppContext'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../context/AuthContext'
import { useProfiles } from '../../context/ProfileContext'
import { useBook } from '../../context/BookContext'
import type { Theme } from '../../context/ThemeContext'
import { parseGoodreadsId } from '../../lib/profiles'
import { toGoodreadsCsv, downloadCsv } from '../../lib/exportCsv'
import { X, Sun, Moon, LogOut, LogIn, Download, Link2, HardDrive } from 'lucide-react'

const THEMES: { id: Theme; label: string; hint: string; icon: typeof Sun; swatch: string[] }[] = [
  {
    id: 'day',
    label: 'Forest Day',
    hint: 'Sage paper, deep-green chrome',
    icon: Sun,
    swatch: ['#e8ede4', '#f0ebe0', '#1a3a0a', '#a0522d'],
  },
  {
    id: 'evening',
    label: 'Forest Evening',
    hint: 'Same hues, ground flipped',
    icon: Moon,
    swatch: ['#14260d', '#1e3614', '#0a1606', '#d08a50'],
  },
]

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-bold tracking-[0.16em] uppercase text-accent-warm mb-3">
      {children}
    </div>
  )
}

function ActionRow({ icon: Icon, label, hint, onClick, danger }: {
  icon: typeof LogOut
  label: string
  hint?: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left hover:bg-bg transition-colors"
    >
      <Icon className={`w-4 h-4 flex-shrink-0 ${danger ? 'text-accent-warm' : 'text-text-muted'}`} />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-bold text-text">{label}</span>
        {hint && <span className="block text-[11px] text-text-muted mt-0.5 truncate">{hint}</span>}
      </span>
    </button>
  )
}

export function SettingsModal() {
  const { settingsOpen, setSettingsOpen } = useApp()
  const { theme, setTheme } = useTheme()
  const { mode, user, signOut, setAuthOpen } = useAuth()
  const { owner, setUpOwner, guests } = useProfiles()
  const { localBooks, syncProfile, importLocalLibrary } = useBook()

  if (!settingsOpen) return null

  const connectGoodreads = async () => {
    const input = window.prompt(
      'Paste your Goodreads profile URL.\nIt must be a public profile.',
      owner?.goodreadsUserId ?? '',
    )
    if (!input) return
    const grId = parseGoodreadsId(input)
    if (!grId) { window.alert('That doesn’t contain a Goodreads user id.'); return }
    setUpOwner(owner?.name || user?.displayName || 'My Library', grId)
    try {
      const n = await syncProfile('owner', grId)
      window.alert(n > 0 ? `Linked. Your library now reads ${n} books.` : 'No books found — is the profile public?')
    } catch (err) {
      window.alert(`Couldn’t read that shelf: ${(err as Error).message}`)
    }
  }

  const exportShelf = () => {
    if (localBooks.length === 0) { window.alert('Nothing to export yet.'); return }
    const name = (owner?.name || 'booklit').toLowerCase().replace(/[^a-z0-9]+/g, '-')
    downloadCsv(`${name}-shelf.csv`, toGoodreadsCsv(localBooks))
  }

  const rescanLocal = async () => {
    try {
      const n = await importLocalLibrary(true)
      window.alert(n > 0 ? `Found ${n} books in your local folder.` : 'No new local books found.')
    } catch (err) {
      window.alert(`Local scan failed: ${(err as Error).message}`)
    }
  }

  return (
    <div
      className="scrim fixed inset-0 z-[80] flex items-center justify-center p-4"
      onClick={() => setSettingsOpen(false)}
    >
      <div
        className="surface rounded-3xl w-[440px] max-w-full max-h-[88vh] overflow-y-auto p-7 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-lg font-bold tracking-tight text-text">Settings</h2>
          <button
            onClick={() => setSettingsOpen(false)}
            className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-bg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ---- Account ---- */}
        <SectionTitle>Account</SectionTitle>
        <div className="rounded-2xl bg-bg/60 px-4 py-3 mb-2">
          {mode === 'local' ? (
            <>
              <div className="text-[13px] font-bold text-text">Signed out · local only</div>
              <div className="text-[11px] text-text-muted mt-0.5 leading-snug">
                Firebase isn’t configured, so your shelves and edits live on this
                machine. See <code className="text-[10px]">FIREBASE_SETUP.md</code> to
                turn on accounts and sync.
              </div>
            </>
          ) : user ? (
            <>
              <div className="text-[13px] font-bold text-text truncate">
                {user.displayName || 'Signed in'}
              </div>
              <div className="text-[11px] text-text-muted mt-0.5 truncate">{user.email}</div>
            </>
          ) : (
            <>
              <div className="text-[13px] font-bold text-text">Not signed in</div>
              <div className="text-[11px] text-text-muted mt-0.5 leading-snug">
                Sign in to sync your shelves and edits across devices.
              </div>
            </>
          )}
        </div>
        <div className="flex flex-col gap-px mb-6">
          {mode === 'cloud' && (user
            ? <ActionRow icon={LogOut} label="Sign out" onClick={() => { signOut(); setSettingsOpen(false) }} danger />
            : <ActionRow icon={LogIn} label="Sign in" onClick={() => { setAuthOpen(true); setSettingsOpen(false) }} />)}
        </div>

        {/* ---- Library sources ---- */}
        <SectionTitle>Your library</SectionTitle>
        <div className="flex flex-col gap-px mb-6">
          <ActionRow
            icon={Link2}
            label={owner?.goodreadsUserId ? 'Change linked Goodreads' : 'Link your Goodreads'}
            hint={owner?.goodreadsUserId
              ? `Reading from user ${owner.goodreadsUserId} · ${guests.length} other shelf${guests.length === 1 ? '' : 'ves'} followed`
              : 'Read your shelves from a public profile'}
            onClick={connectGoodreads}
          />
          <ActionRow
            icon={HardDrive}
            label="Rescan local folder"
            hint="Re-read the books folder on this machine"
            onClick={rescanLocal}
          />
          <ActionRow
            icon={Download}
            label="Export shelf as CSV"
            hint={`${localBooks.length} books · import at goodreads.com/review/import`}
            onClick={exportShelf}
          />
        </div>
        <p className="text-[11px] text-text-muted leading-snug mb-6 px-1">
          Goodreads retired its API, so Booklit can read a public shelf but never
          write to one. Shelf changes you make here stay in Booklit — the CSV
          export is the way to push them back.
        </p>

        <SectionTitle>Appearance</SectionTitle>
        <div className="flex flex-col gap-2.5">
          {THEMES.map(({ id, label, hint, icon: Icon, swatch }) => (
            <button
              key={id}
              onClick={() => setTheme(id)}
              className={`flex items-center gap-4 rounded-2xl px-4 py-3.5 text-left transition-all border-l-4 ${
                theme === id
                  ? 'border-accent bg-bg'
                  : 'border-transparent hover:bg-bg hover:border-border-hover'
              }`}
            >
              <Icon
                className={`w-4 h-4 flex-shrink-0 ${
                  theme === id ? 'text-accent' : 'text-text-muted'
                }`}
              />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-bold text-text">{label}</div>
                <div className="text-[11px] text-text-muted mt-0.5">{hint}</div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                {swatch.map(c => (
                  <span
                    key={c}
                    className="w-3.5 h-3.5 rounded-[3px] border border-border"
                    style={{ background: c }}
                  />
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
