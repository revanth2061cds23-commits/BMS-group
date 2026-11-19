import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createBackend, isDemo, type Backend } from './backend'
import type { DB, Draft, Profile } from './types'
import { needsTick, simNowFrom, tick } from './logic'
import { DEFAULT_PROFILE } from './seed'

/* ---------------- tiny router ---------------- */

function usePath() {
  const [path, setPath] = useState(location.pathname)
  useEffect(() => {
    const on = () => setPath(location.pathname)
    window.addEventListener('popstate', on)
    return () => window.removeEventListener('popstate', on)
  }, [])
  const nav = useCallback((to: string, replace = false) => {
    if (replace) history.replaceState(null, '', to)
    else history.pushState(null, '', to)
    setPath(to.split('?')[0])
    window.scrollTo(0, 0)
  }, [])
  return { path, nav }
}

/* ---------------- local persistence helpers ---------------- */

const lsGet = <T,>(k: string, d: T): T => {
  try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d } catch { return d }
}
const lsSet = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* ignore */ } }

export const facilitatorFlag = (() => {
  const q = new URLSearchParams(location.search)
  if (q.get('facilitator') === '1') sessionStorage.setItem('gb_fac', '1')
  if (q.get('facilitator') === '0') sessionStorage.removeItem('gb_fac')
  return sessionStorage.getItem('gb_fac') === '1'
})()

// ?as=<memberId> lets one tab act as a specific member (demo / multi-tab testing)
const asOverride = (() => {
  const q = new URLSearchParams(location.search)
  const as = q.get('as')
  const m = location.pathname.match(/^\/s\/([^/]+)/)
  if (as && m) sessionStorage.setItem('gb_as_' + m[1], as)
})()
void asOverride

const urlVariant = (() => {
  const v = new URLSearchParams(location.search).get('variant')
  return v === 'A' || v === 'B' ? v : null
})()

/* ---------------- context ---------------- */

export interface Toast { id: number; text: string; tone: 'info' | 'success' | 'warn' | 'error' }

interface Store {
  db: DB
  now: number
  backend: Backend
  online: boolean
  simOffline: boolean
  setSimOffline(v: boolean): void
  act(fn: (db: DB, now: number) => boolean | void): Promise<boolean>
  path: string
  nav(to: string, replace?: boolean): void
  profile: Profile
  setProfile(p: Profile): void
  draft: Draft
  setDraft(d: Draft): void
  identity(sid: string): string | null
  setIdentity(sid: string, memberId: string | null, tabOnly?: boolean): void
  toasts: Toast[]
  toast(text: string, tone?: Toast['tone']): void
  facOpen: boolean
  setFacOpen(v: boolean): void
  demo: boolean
  offset: number
}

const Ctx = createContext<Store | null>(null)
export const useStore = () => useContext(Ctx)!

export const emptyDraft = (): Draft => ({ seats: [], assign: {}, hostSeat: null })

export function StoreProvider({ children }: { children: ReactNode }) {
  const backend = useMemo(() => createBackend(), [])
  const [db, setDb] = useState<DB | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [online, setOnline] = useState(true)
  const [simOffline, setSimOfflineState] = useState(false)
  const [real, setReal] = useState(Date.now())
  const { path, nav } = usePath()
  const [profile, setProfileState] = useState<Profile>(() => {
    const p = lsGet<Profile | null>('gb_profile', null)
    // Older builds shared one placeholder number on every device: give this device its own.
    if (p && !(p.name === DEFAULT_PROFILE.name && p.phone === DEFAULT_PROFILE.phone)) return p
    const fresh = { name: DEFAULT_PROFILE.name, phone: '98765' + String(Math.floor(10000 + Math.random() * 89999)) }
    lsSet('gb_profile', fresh)
    return fresh
  })
  const [draft, setDraftState] = useState<Draft>(() => {
    try { return JSON.parse(sessionStorage.getItem('gb_draft') || '') as Draft } catch { return emptyDraft() }
  })
  const [ids, setIds] = useState<Record<string, string>>(() => lsGet('gb_me', {}))
  const [toasts, setToasts] = useState<Toast[]>([])
  const [facOpen, setFacOpen] = useState(false)
  const dbRef = useRef<DB | null>(null)
  dbRef.current = db

  useEffect(() => {
    let unsub = () => {}
    let unsubStatus = () => {}
    backend.init().then(async (d) => {
      setDb(d)
      unsub = backend.subscribe(setDb)
      unsubStatus = backend.onStatus(setOnline)
      if (urlVariant && d.config.variant !== urlVariant) {
        await backend.mutate((x) => { if (x.config.variant === urlVariant) return false; x.config.variant = urlVariant })
      }
    }).catch((e) => setErr(String(e?.message ?? e)))
    return () => { unsub(); unsubStatus() }
  }, [backend])

  useEffect(() => {
    const t = setInterval(() => setReal(Date.now()), 250)
    return () => clearInterval(t)
  }, [])

  const offset = backend.clockOffset()
  const now = db ? simNowFrom(db.config, offset, real) : real

  const toast = useCallback((text: string, tone: Toast['tone'] = 'info') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t.filter((x) => x.text !== text).slice(-1), { id, text, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 5000 : 3500)
  }, [])

  const act = useCallback(async (fn: (db: DB, now: number) => boolean | void) => {
    try {
      let changed = true
      await backend.mutate((d) => {
        const n = simNowFrom(d.config, backend.clockOffset())
        const r = fn(d, n)
        if (r === false) changed = false
        return r
      })
      return changed
    } catch (e) {
      toast((e as Error).message || 'Something went wrong', 'error')
      return false
    }
  }, [backend, toast])

  // Time-based transitions: every client checks, CAS keeps it idempotent.
  const ticking = useRef(false)
  useEffect(() => {
    const t = setInterval(() => {
      const d = dbRef.current
      if (!d || ticking.current) return
      const n = simNowFrom(d.config, backend.clockOffset())
      if (!needsTick(d, n)) return
      ticking.current = true
      backend.mutate((x) => tick(x, simNowFrom(x.config, backend.clockOffset())) ? undefined : false)
        .catch(() => {})
        .finally(() => { ticking.current = false })
    }, 1000)
    return () => clearInterval(t)
  }, [backend])

  const setProfile = (p: Profile) => { setProfileState(p); lsSet('gb_profile', p) }
  const setDraft = (d: Draft) => { setDraftState(d); try { sessionStorage.setItem('gb_draft', JSON.stringify(d)) } catch { /* ignore */ } }
  const [, bump] = useState(0)
  const identity = useCallback((sid: string) => sessionStorage.getItem('gb_as_' + sid) ?? ids[sid] ?? null, [ids])
  const setIdentity = useCallback((sid: string, memberId: string | null, tabOnly = false) => {
    if (tabOnly || sessionStorage.getItem('gb_as_' + sid)) {
      if (memberId) sessionStorage.setItem('gb_as_' + sid, memberId)
      else sessionStorage.removeItem('gb_as_' + sid)
      bump((x) => x + 1)
      return // a tab acting as someone never changes the identity other tabs share
    }
    setIds((cur) => {
      const next = { ...cur }
      if (memberId) next[sid] = memberId
      else delete next[sid]
      lsSet('gb_me', next)
      return next
    })
  }, [])
  const setSimOffline = (v: boolean) => { setSimOfflineState(v); backend.setSimOffline(v) }

  if (err) {
    return (
      <div className="p-6 text-sm">
        <h1 className="text-lg font-semibold mb-2">Couldn't connect to the shared database</h1>
        <p className="text-[#666] mb-3">{err}</p>
        <p className="text-[#666]">Check the Supabase keys and that the <code>gb_state</code> table exists (see README), or open with <code>?demo=1</code> to use single-device demo mode.</p>
      </div>
    )
  }
  if (!db) return <div className="h-dvh grid place-items-center text-sm text-[#666]">Loading session…</div>

  const value: Store = {
    db, now, backend, online, simOffline, setSimOffline, act, path, nav, profile, setProfile, draft, setDraft,
    identity, setIdentity, toasts, toast, facOpen, setFacOpen, demo: isDemo, offset,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
