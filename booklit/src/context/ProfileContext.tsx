import {
  createContext, useContext, useState, useEffect, useCallback, type ReactNode,
} from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { getFirebase } from '../lib/firebase'
import { useAuth, storageUid } from './AuthContext'
import {
  type Profile, type ShelfOverride,
  SEED_GUESTS, makeOwnerProfile, guestProfileId, parseGoodreadsId, tintFor,
  loadProfiles, saveProfiles, loadOverrides, saveOverrides,
  loadActiveProfileId, saveActiveProfileId,
} from '../lib/profiles'

interface ProfileContextValue {
  profiles: Profile[]
  activeProfile: Profile | null
  activeProfileId: string
  owner: Profile | null
  guests: Profile[]
  /** True once profiles have loaded — the library waits for this. */
  ready: boolean
  /** No owner shelf connected yet, so first-run setup should show. */
  needsSetup: boolean
  overrides: Record<string, ShelfOverride>

  setActiveProfile: (id: string) => void
  /** Create/replace the owner profile. Called from first-run setup and settings. */
  setUpOwner: (name: string, goodreadsUserId?: string) => void
  addGuest: (goodreadsUrlOrId: string) => Promise<Profile>
  removeGuest: (id: string) => void
  markSynced: (id: string) => void
  setOverride: (key: string, patch: Partial<Omit<ShelfOverride, 'updatedAt'>>) => void
  clearOverride: (key: string) => void
}

const ProfileContext = createContext<ProfileContextValue | null>(null)

/** Firestore lives behind two docs — one read and one write per concern. */
const profilesDoc = (uid: string) => {
  const fb = getFirebase()
  return fb ? doc(fb.db, 'users', uid, 'meta', 'profiles') : null
}
const overridesDoc = (uid: string) => {
  const fb = getFirebase()
  return fb ? doc(fb.db, 'users', uid, 'meta', 'overrides') : null
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user, mode, ready: authReady } = useAuth()
  const uid = storageUid(user)

  const [profiles, setProfiles] = useState<Profile[]>([])
  const [activeProfileId, setActiveProfileId] = useState<string>('owner')
  const [overrides, setOverrides] = useState<Record<string, ShelfOverride>>({})

  /* Which account's data is currently in state. Doubles as the readiness flag
     and as the guard on the write-back effects below: until it matches `uid`,
     what's in state belongs to someone else (or to nobody yet), and writing it
     back would cross-contaminate accounts. */
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  const ready = loadedFor === uid

  /* ---- load: localStorage first (instant), Firestore second (authoritative) ---- */
  useEffect(() => {
    if (!authReady) return
    let cancelled = false

    const localProfiles = loadProfiles(uid)
    const localOverrides = loadOverrides(uid)
    const localActive = loadActiveProfileId(uid)

    // Seed guests are always present, but never overwrite an existing edit.
    const withSeeds = (list: Profile[] | null): Profile[] => {
      const base = list ?? []
      const have = new Set(base.map(p => p.id))
      return [...base, ...SEED_GUESTS.filter(g => !have.has(g.id))]
    }

    setProfiles(withSeeds(localProfiles))
    setOverrides(localOverrides)
    if (localActive) setActiveProfileId(localActive)

    ;(async () => {
      if (mode === 'cloud' && user) {
        try {
          const pRef = profilesDoc(uid)
          const oRef = overridesDoc(uid)
          const [pSnap, oSnap] = await Promise.all([
            pRef ? getDoc(pRef) : Promise.resolve(null),
            oRef ? getDoc(oRef) : Promise.resolve(null),
          ])
          if (cancelled) return

          if (pSnap?.exists()) {
            const data = pSnap.data() as { profiles?: Profile[]; activeProfileId?: string }
            setProfiles(withSeeds(data.profiles ?? null))
            if (data.activeProfileId) setActiveProfileId(data.activeProfileId)
          } else if (localProfiles) {
            /* First sign-in on a machine that already has local work: push it up
               rather than silently starting from an empty account. */
            await setDoc(pRef!, {
              profiles: withSeeds(localProfiles),
              activeProfileId: localActive ?? 'owner',
            })
          }

          if (oSnap?.exists()) {
            const data = oSnap.data() as { map?: Record<string, ShelfOverride> }
            if (data.map) setOverrides(data.map)
          } else if (Object.keys(localOverrides).length > 0) {
            await setDoc(oRef!, { map: localOverrides })
          }
        } catch (e) {
          console.error('Profile sync failed — using local copy:', e)
        }
      }
      if (cancelled) return
      setLoadedFor(uid)
    })()

    return () => { cancelled = true }
  }, [uid, mode, user, authReady])

  /* ---- persist ---- */
  useEffect(() => {
    if (loadedFor !== uid) return
    saveProfiles(uid, profiles)
    saveActiveProfileId(uid, activeProfileId)
    if (mode === 'cloud' && user) {
      const ref = profilesDoc(uid)
      if (ref) setDoc(ref, { profiles, activeProfileId }).catch(e =>
        console.error('Could not save profiles:', e))
    }
  }, [profiles, activeProfileId, loadedFor, uid, mode, user])

  useEffect(() => {
    if (loadedFor !== uid) return
    saveOverrides(uid, overrides)
    if (mode === 'cloud' && user) {
      const ref = overridesDoc(uid)
      if (ref) setDoc(ref, { map: overrides }).catch(e =>
        console.error('Could not save shelf edits:', e))
    }
  }, [overrides, loadedFor, uid, mode, user])

  const owner = profiles.find(p => p.kind === 'owner') ?? null
  const guests = profiles.filter(p => p.kind === 'guest')
  const activeProfile = profiles.find(p => p.id === activeProfileId) ?? owner ?? guests[0] ?? null

  const setActiveProfile = useCallback((id: string) => setActiveProfileId(id), [])

  const setUpOwner = useCallback((name: string, goodreadsUserId?: string) => {
    setProfiles(prev => {
      const next = makeOwnerProfile(name, goodreadsUserId)
      const existing = prev.find(p => p.kind === 'owner')
      // Keep the sync timestamp only if the shelf it points at hasn't changed.
      if (existing && existing.goodreadsUserId === goodreadsUserId) {
        next.lastSyncedAt = existing.lastSyncedAt
      }
      return [next, ...prev.filter(p => p.kind !== 'owner')]
    })
    setActiveProfileId('owner')
  }, [])

  const addGuest = useCallback(async (input: string): Promise<Profile> => {
    const grId = parseGoodreadsId(input)
    if (!grId) throw new Error('That doesn’t contain a Goodreads user id.')

    const id = guestProfileId(grId)
    const already = profiles.find(p => p.id === id)
    if (already) { setActiveProfileId(id); return already }

    // Resolve the display name from the feed so the profile isn't just a number.
    // This also proves the shelf is public before it's added.
    const resp = await fetch(`/api/goodreads?userid=${encodeURIComponent(grId)}`)
    if (!resp.ok) throw new Error(`Backend error (${resp.status}). Is the Booklit server running?`)
    const data = await resp.json()
    if (data.error) throw new Error(data.error)

    const profile: Profile = {
      id,
      name: data.name || `Goodreads ${grId}`,
      kind: 'guest',
      goodreadsUserId: grId,
      blurb: `${data.count ?? 0} books · Goodreads`,
      tint: tintFor(id),
      lastSyncedAt: Date.now(),
    }
    setProfiles(prev => [...prev, profile])
    setActiveProfileId(id)
    return profile
  }, [profiles])

  const removeGuest = useCallback((id: string) => {
    setProfiles(prev => prev.filter(p => p.id !== id || p.kind === 'owner'))
    setActiveProfileId(cur => (cur === id ? 'owner' : cur))
  }, [])

  const markSynced = useCallback((id: string) => {
    setProfiles(prev => prev.map(p => (p.id === id ? { ...p, lastSyncedAt: Date.now() } : p)))
  }, [])

  const setOverride = useCallback((key: string, patch: Partial<Omit<ShelfOverride, 'updatedAt'>>) => {
    setOverrides(prev => ({
      ...prev,
      [key]: { ...prev[key], ...patch, updatedAt: Date.now() },
    }))
  }, [])

  const clearOverride = useCallback((key: string) => {
    setOverrides(prev => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }, [])

  return (
    <ProfileContext.Provider value={{
      profiles,
      activeProfile,
      activeProfileId: activeProfile?.id ?? 'owner',
      owner,
      guests,
      ready,
      needsSetup: ready && !owner,
      overrides,
      setActiveProfile,
      setUpOwner,
      addGuest,
      removeGuest,
      markSynced,
      setOverride,
      clearOverride,
    }}>
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfiles() {
  const ctx = useContext(ProfileContext)
  if (!ctx) throw new Error('useProfiles must be inside ProfileProvider')
  return ctx
}
