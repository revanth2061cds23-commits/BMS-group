import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { DB } from './types'
import { freshDB } from './seed'

/**
 * The whole shared state is one JSON document. Every phone subscribes to it,
 * and every write is a compare-and-swap on `version`, so concurrent writers retry
 * instead of overwriting each other.
 */
export interface Backend {
  kind: 'local' | 'supabase'
  init(): Promise<DB>
  subscribe(cb: (db: DB) => void): () => void
  mutate(fn: (db: DB) => boolean | void): Promise<DB>
  /** ms to add to Date.now() to get the server's clock */
  clockOffset(): number
  onStatus(cb: (online: boolean) => void): () => void
  setSimOffline(v: boolean): void
}

export class OfflineError extends Error {
  constructor() {
    super("You're offline. Reconnecting…")
  }
}

abstract class Base {
  protected listeners = new Set<(db: DB) => void>()
  protected statusListeners = new Set<(online: boolean) => void>()
  protected simOffline = false
  protected realOnline = typeof navigator === 'undefined' ? true : navigator.onLine
  protected last: DB | null = null

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => { this.realOnline = true; this.emitStatus(); this.refresh() })
      window.addEventListener('offline', () => { this.realOnline = false; this.emitStatus() })
    }
  }
  get online() { return this.realOnline && !this.simOffline }
  protected emitStatus() { this.statusListeners.forEach((l) => l(this.online)) }
  protected emit(db: DB) {
    if (!this.online) return
    if (this.last && db.version < this.last.version && db.version !== 1) return
    this.last = db
    this.listeners.forEach((l) => l(db))
  }
  subscribe(cb: (db: DB) => void) {
    this.listeners.add(cb)
    return () => { this.listeners.delete(cb) }
  }
  onStatus(cb: (online: boolean) => void) {
    this.statusListeners.add(cb)
    cb(this.online)
    return () => { this.statusListeners.delete(cb) }
  }
  setSimOffline(v: boolean) {
    this.simOffline = v
    this.emitStatus()
    if (!v) this.refresh()
  }
  abstract refresh(): Promise<void>
}

const LS_KEY = 'gb_db_v1'

class LocalBackend extends Base implements Backend {
  kind = 'local' as const
  private bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('gb_db') : null

  constructor() {
    super()
    this.bc?.addEventListener('message', () => this.refresh())
    window.addEventListener('storage', (e) => { if (e.key === LS_KEY) this.refresh() })
  }
  private read(): DB | null {
    try {
      const raw = localStorage.getItem(LS_KEY)
      return raw ? (JSON.parse(raw) as DB) : null
    } catch {
      return null
    }
  }
  private write(db: DB) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(db)) } catch { /* storage full or blocked */ }
    this.bc?.postMessage('changed')
  }
  async init() {
    let db = this.read()
    if (!db) { db = freshDB(Date.now()); this.write(db) }
    this.last = db
    return db
  }
  async refresh() {
    const db = this.read()
    if (db) { this.last = null; this.emit(db) }
  }
  async mutate(fn: (db: DB) => boolean | void) {
    if (!this.online) throw new OfflineError()
    const cur = this.read() ?? freshDB(Date.now())
    const next = structuredClone(cur)
    if (fn(next) === false) return cur
    next.version = cur.version + 1
    this.write(next)
    this.emit(next)
    return next
  }
  clockOffset() { return 0 }
}

const TABLE = 'gb_state'

class SupabaseBackend extends Base implements Backend {
  kind = 'supabase' as const
  private sb: SupabaseClient
  private offset = 0
  constructor(url: string, key: string, private room: string) {
    super()
    this.sb = createClient(url, key, { realtime: { params: { eventsPerSecond: 20 } } })
  }
  private async fetchRow(): Promise<DB | null> {
    const { data, error } = await this.sb.from(TABLE).select('data').eq('id', this.room).maybeSingle()
    if (error) throw error
    return (data?.data as DB) ?? null
  }
  private async syncClock(url: string) {
    // Use the server's Date header so every phone shares one clock (E19 note in PRD).
    try {
      const t0 = Date.now()
      const res = await fetch(url, { method: 'HEAD', cache: 'no-store' })
      const t1 = Date.now()
      const d = res.headers.get('date')
      if (d) this.offset = new Date(d).getTime() + 500 - (t0 + t1) / 2
    } catch { /* keep 0 */ }
  }
  async init() {
    const url = import.meta.env.VITE_SUPABASE_URL as string
    await this.syncClock(`${url}/rest/v1/`)
    let db = await this.fetchRow()
    if (!db) {
      db = freshDB(Date.now() + this.offset)
      const { error } = await this.sb.from(TABLE).insert({ id: this.room, data: db, version: db.version })
      if (error) db = (await this.fetchRow()) ?? db // someone else created it first
    }
    this.last = db
    this.sb
      .channel(`gb_${this.room}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE, filter: `id=eq.${this.room}` }, (p) => {
        const d = (p.new as { data?: DB })?.data
        if (d && d.version) this.emit(d)
        else this.refresh()
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') { this.realOnline = true; this.emitStatus(); this.refresh() }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') { this.realOnline = false; this.emitStatus() }
      })
    // Safety net in case a realtime message is dropped.
    setInterval(() => { if (this.online) this.refresh() }, 4000)
    return db
  }
  async refresh() {
    try {
      const db = await this.fetchRow()
      if (db) this.emit(db)
    } catch { /* ignore, next poll */ }
  }
  async mutate(fn: (db: DB) => boolean | void) {
    if (!this.online) throw new OfflineError()
    for (let attempt = 0; attempt < 8; attempt++) {
      const cur = (await this.fetchRow()) ?? freshDB(Date.now() + this.offset)
      const next = structuredClone(cur)
      if (fn(next) === false) return cur
      next.version = cur.version + 1
      const { data, error } = await this.sb
        .from(TABLE)
        .update({ data: next, version: next.version })
        .eq('id', this.room)
        .eq('version', cur.version)
        .select('id')
      if (error) throw error
      if (data && data.length) { this.emit(next); return next }
      await new Promise((r) => setTimeout(r, 60 + Math.random() * 120))
    }
    throw new Error('Too many people acting at once. Please try again.')
  }
  clockOffset() { return this.offset }
}

export const isDemo = (() => {
  const q = new URLSearchParams(location.search)
  if (q.get('demo') === '1') sessionStorage.setItem('gb_demo', '1')
  if (q.get('demo') === '0') sessionStorage.removeItem('gb_demo')
  return sessionStorage.getItem('gb_demo') === '1'
})()

export function createBackend(): Backend {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  const room = (import.meta.env.VITE_ROOM as string | undefined) || 'main'
  if (url && key && !isDemo) return new SupabaseBackend(url, key, room)
  return new LocalBackend()
}
