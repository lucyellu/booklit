import {
  createContext, useContext, useState, useEffect, useCallback, type ReactNode,
} from 'react'
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  type User,
} from 'firebase/auth'
import { getFirebase, isFirebaseConfigured, friendlyAuthError } from '../lib/firebase'

/**
 * Who's signed in.
 *
 * `mode` is the thing most of the app cares about:
 *   'local' — Firebase isn't configured. One implicit user, everything in
 *             localStorage. This is the zero-setup path.
 *   'cloud' — Firebase is configured. Signed in or not, storage is Firestore.
 */
export type AuthMode = 'local' | 'cloud'

export interface AuthUser {
  uid: string
  email: string | null
  displayName: string | null
}

interface AuthContextValue {
  mode: AuthMode
  user: AuthUser | null
  /** False until the initial auth check settles — don't render gated UI before this. */
  ready: boolean
  /** True when cloud mode is on and nobody is signed in yet. */
  needsSignIn: boolean
  authOpen: boolean
  setAuthOpen: (open: boolean) => void
  signUp: (email: string, password: string, name: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** Stable id for the implicit local user, so storage keys look the same either way. */
export const LOCAL_UID = 'local-user'

export function AuthProvider({ children }: { children: ReactNode }) {
  const mode: AuthMode = isFirebaseConfigured ? 'cloud' : 'local'
  const [user, setUser] = useState<AuthUser | null>(null)
  const [ready, setReady] = useState(mode === 'local')
  const [authOpen, setAuthOpen] = useState(false)

  useEffect(() => {
    if (mode === 'local') return
    const fb = getFirebase()
    if (!fb) { setReady(true); return }
    return onAuthStateChanged(
      fb.auth,
      (u: User | null) => {
        setUser(u ? { uid: u.uid, email: u.email, displayName: u.displayName } : null)
        setReady(true)
      },
      err => {
        console.error('Auth listener failed:', err)
        setReady(true)
      },
    )
  }, [mode])

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    const fb = getFirebase()
    if (!fb) throw new Error('Firebase isn’t configured.')
    try {
      const cred = await createUserWithEmailAndPassword(fb.auth, email.trim(), password)
      const trimmed = name.trim()
      if (trimmed) {
        await updateProfile(cred.user, { displayName: trimmed })
        // onAuthStateChanged already fired with the pre-update user, so the
        // name it carries is stale. Push the fresh one through by hand.
        setUser({ uid: cred.user.uid, email: cred.user.email, displayName: trimmed })
      }
      setAuthOpen(false)
    } catch (e) {
      throw new Error(friendlyAuthError(e), { cause: e })
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const fb = getFirebase()
    if (!fb) throw new Error('Firebase isn’t configured.')
    try {
      await signInWithEmailAndPassword(fb.auth, email.trim(), password)
      setAuthOpen(false)
    } catch (e) {
      throw new Error(friendlyAuthError(e), { cause: e })
    }
  }, [])

  const signInWithGoogle = useCallback(async () => {
    const fb = getFirebase()
    if (!fb) throw new Error('Firebase isn’t configured.')
    try {
      await signInWithPopup(fb.auth, new GoogleAuthProvider())
      setAuthOpen(false)
    } catch (e) {
      throw new Error(friendlyAuthError(e), { cause: e })
    }
  }, [])

  const signOut = useCallback(async () => {
    const fb = getFirebase()
    if (!fb) return
    await fbSignOut(fb.auth)
  }, [])

  return (
    <AuthContext.Provider value={{
      mode,
      user,
      ready,
      needsSignIn: mode === 'cloud' && ready && !user,
      authOpen,
      setAuthOpen,
      signUp,
      signIn,
      signInWithGoogle,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}

/**
 * Storage scope for the current user. Local mode and signed-out cloud mode both
 * get a stable key so work isn't lost before someone signs up.
 */
export function storageUid(user: AuthUser | null): string {
  return user?.uid ?? LOCAL_UID
}
