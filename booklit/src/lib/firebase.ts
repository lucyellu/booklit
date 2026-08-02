/**
 * Firebase, initialised only if it's actually configured.
 *
 * Booklit launches from a desktop shortcut and has always worked with zero
 * setup, so Firebase is strictly opt-in: with no VITE_FIREBASE_* variables the
 * app runs exactly as before, keeping profiles and shelf edits in
 * localStorage. Fill in .env.local and the same data starts syncing to an
 * account instead. Nothing here throws when the config is absent.
 */

import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
}

/** Enough config present to bother trying. */
export const isFirebaseConfigured = Boolean(
  config.apiKey && config.authDomain && config.projectId && config.appId,
)

interface FirebaseBits {
  app: FirebaseApp
  auth: Auth
  db: Firestore
}

let bits: FirebaseBits | null = null
let initFailed = false

/**
 * The initialised SDK, or null when unconfigured (or when init blew up — a bad
 * project id shouldn't take the whole library down with it, it should just
 * leave you in local mode).
 */
export function getFirebase(): FirebaseBits | null {
  if (bits) return bits
  if (!isFirebaseConfigured || initFailed) return null
  try {
    const app = initializeApp(config as Required<typeof config>)
    bits = { app, auth: getAuth(app), db: getFirestore(app) }
    return bits
  } catch (e) {
    console.error('Firebase init failed — staying in local mode:', e)
    initFailed = true
    return null
  }
}

/** Firebase's error codes are not something to show a human as-is. */
export function friendlyAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code || ''
  switch (code) {
    case 'auth/invalid-email': return 'That email address doesn’t look right.'
    case 'auth/missing-password': return 'Enter a password.'
    case 'auth/weak-password': return 'Password needs to be at least 6 characters.'
    case 'auth/email-already-in-use': return 'There’s already an account with that email. Try signing in.'
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found': return 'Email or password is incorrect.'
    case 'auth/too-many-requests': return 'Too many attempts. Wait a minute and try again.'
    case 'auth/network-request-failed': return 'Couldn’t reach Firebase. Check your connection.'
    case 'auth/popup-closed-by-user': return 'Sign-in window was closed.'
    case 'auth/operation-not-allowed': return 'That sign-in method isn’t enabled in the Firebase console.'
    default: return (err as Error)?.message || 'Something went wrong signing in.'
  }
}
