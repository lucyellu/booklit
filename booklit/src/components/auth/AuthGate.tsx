import { useState, type FormEvent } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useProfiles } from '../../context/ProfileContext'
import { parseGoodreadsId } from '../../lib/profiles'
import { X, LogIn, UserPlus, BookUser, Loader2 } from 'lucide-react'

/**
 * Everything that has to happen before the library means anything: signing in
 * (when Firebase is configured) and saying whose shelf this is.
 *
 * Both are modals rather than full-page takeovers, because neither is a hard
 * gate — with Firebase unconfigured you're never asked to sign in, and you can
 * dismiss setup and browse the bundled guest shelves without connecting
 * anything at all.
 */
export function AuthGate() {
  const { mode, user, ready, authOpen, setAuthOpen } = useAuth()
  const { needsSetup } = useProfiles()
  const [setupDismissed, setSetupDismissed] = useState(false)

  if (!ready) return null

  // Signing in comes first: profiles are stored per account, so setting one up
  // before signing in would just write it to the wrong place.
  if (authOpen || (mode === 'cloud' && !user)) {
    return <AuthModal dismissable={!!user || authOpen} onClose={() => setAuthOpen(false)} />
  }
  if (needsSetup && !setupDismissed) {
    return <OwnerSetupModal onClose={() => setSetupDismissed(true)} />
  }
  return null
}

function Shell({ title, subtitle, onClose, dismissable, children }: {
  title: string
  subtitle: string
  onClose?: () => void
  dismissable?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="scrim fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="surface rounded-3xl w-[420px] max-w-full p-7 shadow-xl">
        <div className="flex items-start justify-between mb-5 gap-4">
          <div>
            <h2 className="font-display text-lg font-bold tracking-tight text-text">{title}</h2>
            <p className="text-[12px] text-text-muted mt-1 leading-snug">{subtitle}</p>
          </div>
          {dismissable && onClose && (
            <button
              onClick={onClose}
              className="p-1.5 -mr-1 -mt-1 rounded-lg text-text-muted hover:text-text hover:bg-bg transition-colors flex-shrink-0"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  )
}

const inputCls =
  'w-full rounded-xl bg-bg border border-border px-3.5 py-2.5 text-[13px] text-text ' +
  'placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors'

const primaryCls =
  'w-full flex items-center justify-center gap-2 rounded-xl bg-accent text-white ' +
  'px-4 py-2.5 text-[13px] font-bold transition-opacity hover:opacity-90 disabled:opacity-50'

function AuthModal({ dismissable, onClose }: { dismissable: boolean; onClose: () => void }) {
  const { signIn, signUp, signInWithGoogle } = useAuth()
  const [tab, setTab] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (tab === 'in') await signIn(email, password)
      else await signUp(email, password, name)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const google = async () => {
    setError(null)
    setBusy(true)
    try { await signInWithGoogle() } catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }

  return (
    <Shell
      title={tab === 'in' ? 'Welcome back' : 'Create your account'}
      subtitle="Your shelves, edits and saved books sync to this account."
      dismissable={dismissable}
      onClose={onClose}
    >
      <div className="flex gap-1 p-1 rounded-xl bg-bg mb-5">
        {([['in', 'Sign in'], ['up', 'Sign up']] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => { setTab(id); setError(null) }}
            className={`flex-1 rounded-lg px-3 py-1.5 text-[12px] font-bold transition-colors ${
              tab === id ? 'bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="flex flex-col gap-2.5">
        {tab === 'up' && (
          <input
            className={inputCls}
            placeholder="Your name"
            value={name}
            onChange={e => setName(e.target.value)}
            autoComplete="name"
          />
        )}
        <input
          className={inputCls}
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <input
          className={inputCls}
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoComplete={tab === 'in' ? 'current-password' : 'new-password'}
          required
        />

        {error && (
          <p className="text-[12px] text-accent-warm leading-snug px-0.5">{error}</p>
        )}

        <button type="submit" disabled={busy} className={`${primaryCls} mt-1.5`}>
          {busy
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : tab === 'in' ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
          {tab === 'in' ? 'Sign in' : 'Create account'}
        </button>
      </form>

      <div className="flex items-center gap-3 my-4">
        <span className="h-px flex-1 bg-border" />
        <span className="text-[10px] uppercase tracking-[0.14em] text-text-muted">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <button
        onClick={google}
        disabled={busy}
        className="w-full rounded-xl border border-border px-4 py-2.5 text-[13px] font-bold text-text hover:bg-bg transition-colors disabled:opacity-50"
      >
        Continue with Google
      </button>
    </Shell>
  )
}

function OwnerSetupModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth()
  const { setUpOwner } = useProfiles()
  const [name, setName] = useState(user?.displayName || '')
  const [goodreads, setGoodreads] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = goodreads.trim()
    let grId: string | undefined
    if (trimmed) {
      const parsed = parseGoodreadsId(trimmed)
      if (!parsed) {
        setError('That doesn’t contain a Goodreads user id. Paste your profile URL, or leave it blank.')
        return
      }
      grId = parsed
    }
    setUpOwner(name || user?.displayName || 'My Library', grId)
    onClose()
  }

  return (
    <Shell
      title="Whose library is this?"
      subtitle="This becomes your default shelf. Other people's shelves stay separate — you switch into them."
      dismissable
      onClose={onClose}
    >
      <form onSubmit={submit} className="flex flex-col gap-2.5">
        <input
          className={inputCls}
          placeholder="Your name"
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <input
          className={inputCls}
          placeholder="Goodreads profile URL (optional)"
          value={goodreads}
          onChange={e => { setGoodreads(e.target.value); setError(null) }}
        />
        <p className="text-[11px] text-text-muted leading-snug px-0.5">
          e.g. goodreads.com/user/show/51553805-lucy — the profile must be public.
          Goodreads is read-only, so shelf edits you make here stay in Booklit.
        </p>

        {error && <p className="text-[12px] text-accent-warm leading-snug px-0.5">{error}</p>}

        <button type="submit" className={`${primaryCls} mt-1.5`}>
          <BookUser className="w-4 h-4" />
          Use this as my library
        </button>
      </form>
    </Shell>
  )
}
