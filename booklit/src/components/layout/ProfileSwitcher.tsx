import { useState } from 'react'
import { useProfiles } from '../../context/ProfileContext'
import { useBook } from '../../context/BookContext'
import { initialsFor, type Profile } from '../../lib/profiles'
import { Plus, RefreshCw, Trash2, Loader2, Lock } from 'lucide-react'

/**
 * Whose shelf you're looking at. This is the switcher that used to be
 * "Libraries" — the difference is that it now changes *which* library is
 * loaded rather than filtering one merged pile down to a subset.
 */
export function ProfileSwitcher() {
  const {
    owner, guests, activeProfileId, setActiveProfile, addGuest, removeGuest,
  } = useProfiles()
  const { syncProfile, syncingProfileId } = useBook()
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAdd = async (raw: string) => {
    const input = raw.trim()
    if (!input) { setAdding(false); return }
    setBusy(true)
    setError(null)
    try {
      await addGuest(input)
      setAdding(false)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const handleSync = async (p: Profile) => {
    if (!p.goodreadsUserId) return
    try {
      await syncProfile(p.id, p.goodreadsUserId)
    } catch (err) {
      window.alert(`Couldn’t refresh ${p.name}: ${(err as Error).message}`)
    }
  }

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between px-3 mb-3">
        {/* "Shelves" is already taken by the read/want/reading filters above —
            this group is whose library you're in, which is a different axis. */}
        <h2 className="text-[10px] font-bold tracking-[0.16em] uppercase text-on-chrome-muted">
          Libraries
        </h2>
        <button
          onClick={() => { setAdding(a => !a); setError(null) }}
          className="text-on-chrome-muted hover:text-on-chrome transition-colors"
          title="Browse someone else's shelf"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex flex-col gap-1">
        {owner && (
          <ProfileRow
            profile={owner}
            active={activeProfileId === owner.id}
            syncing={syncingProfileId === owner.id}
            onSelect={() => setActiveProfile(owner.id)}
            onSync={owner.goodreadsUserId ? () => handleSync(owner) : undefined}
          />
        )}

        {guests.map(g => (
          <ProfileRow
            key={g.id}
            profile={g}
            active={activeProfileId === g.id}
            syncing={syncingProfileId === g.id}
            onSelect={() => setActiveProfile(g.id)}
            onSync={g.goodreadsUserId ? () => handleSync(g) : undefined}
            onRemove={g.bundledCsv ? undefined : () => removeGuest(g.id)}
          />
        ))}

        {adding && (
          <div className="px-3 pt-2 pb-1">
            <input
              autoFocus
              disabled={busy}
              placeholder="Goodreads profile URL"
              className="w-full rounded-lg bg-chrome-active/60 border border-on-chrome-muted/20 px-2.5 py-1.5 text-[12px] text-on-chrome placeholder:text-on-chrome-muted focus:outline-none focus:border-on-chrome-muted/50 disabled:opacity-50"
              onKeyDown={e => {
                if (e.key === 'Enter') handleAdd((e.target as HTMLInputElement).value)
                if (e.key === 'Escape') { setAdding(false); setError(null) }
              }}
            />
            <p className="text-[10px] text-on-chrome-muted mt-1.5 leading-snug">
              {busy
                ? 'Reading their shelf…'
                : error
                  ? <span className="text-accent-warm">{error}</span>
                  : 'Their shelf loads separately — it never merges into yours.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function ProfileRow({ profile, active, syncing, onSelect, onSync, onRemove }: {
  profile: Profile
  active: boolean
  syncing: boolean
  onSelect: () => void
  onSync?: () => void
  onRemove?: () => void
}) {
  const isGuest = profile.kind === 'guest'
  return (
    <div className="group/profile relative">
      <button
        onClick={onSelect}
        className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
          active
            ? 'bg-chrome-active text-on-chrome-active'
            : 'text-on-chrome-dim hover:text-on-chrome hover:bg-chrome-active/40'
        }`}
      >
        <span
          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
          style={{ background: profile.tint }}
        >
          {syncing ? <Loader2 className="w-3 h-3 animate-spin" /> : initialsFor(profile.name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="block text-sm truncate leading-snug">{profile.name}</span>
            {/* Someone else's shelf can be read but not edited — Goodreads has
                no write API, and it wouldn't be yours to change if it did. */}
            {isGuest && <Lock className="w-2.5 h-2.5 flex-shrink-0 opacity-50" />}
          </span>
          <span className="block text-[10px] text-on-chrome-muted truncate">
            {profile.kind === 'owner' && !profile.goodreadsUserId
              ? 'No Goodreads connected'
              : profile.blurb}
          </span>
        </span>
      </button>

      {/* Row actions, revealed on hover so the resting state stays clean. */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover/profile:opacity-100 transition-opacity">
        {onSync && (
          <button
            onClick={onSync}
            disabled={syncing}
            className="p-1 rounded text-on-chrome-muted hover:text-on-chrome disabled:opacity-40"
            title="Re-read this shelf from Goodreads"
          >
            <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
          </button>
        )}
        {onRemove && (
          <button
            onClick={onRemove}
            className="p-1 rounded text-on-chrome-muted hover:text-accent-warm"
            title={`Stop following ${profile.name}`}
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  )
}
