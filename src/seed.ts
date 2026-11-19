import type { Config, DB, Group, SavedContact, Show } from './types'

export const ROWS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']
export const COLS = 12
export const MAX_SEATS = 10

/** Seats already sold before anyone starts (deterministic so every phone agrees) */
export const SEED_SOLD = [
  'A1', 'A2', 'A11', 'A12', 'B5', 'B6', 'B7', 'C3', 'C4', 'C9', 'D1', 'D12',
  'E6', 'E7', 'G2', 'G3', 'G10', 'H5', 'H6', 'H7', 'H8', 'I1', 'I12', 'J4', 'J5', 'J9',
]

export const CONTACTS: SavedContact[] = [
  { name: 'Aman Verma', phone: '9876500002' },
  { name: 'Priya Nair', phone: '9876500003' },
  { name: 'Karan Mehta', phone: '9876500004' },
  { name: 'Neha Iyer', phone: '9876500005' },
  { name: 'Vikram Rao', phone: '9876500006' },
  { name: 'Sara Khan', phone: '9876500007' },
  { name: 'Dev Patel', phone: '9876500008' },
  { name: 'Isha Gupta', phone: '9876500009' },
]

export const SEED_GROUPS = (now: number): Group[] => [
  { id: 'g_hostel', name: 'Hostel gang', members: CONTACTS.slice(0, 4), lastUsedAt: now - 86400000 * 3 },
  { id: 'g_office', name: 'Office squad', members: [CONTACTS[4], CONTACTS[5]], lastUsedAt: now - 86400000 * 12 },
]

export const DEFAULT_PROFILE = { name: 'Rohan Sharma', phone: '9876500001' }

/** The show everyone books by default: 19 Dec 2026, 11:20 PM India time. */
export const SHOW_STARTS_AT = Date.parse('2026-12-19T23:20:00+05:30')

/** minutesToShow = 0 uses the fixed show time; a positive value puts the show that many minutes away (to test E17). */
export function makeShow(simNow: number, minutesToShow: number): Show {
  return {
    movie: 'Kites Over Bandra',
    language: 'Hindi · 2D',
    certificate: 'UA',
    cinema: 'Galaxy Cinemas: Andheri West',
    screen: 'Audi 3',
    startsAt: minutesToShow > 0 ? simNow + minutesToShow * 60000 : SHOW_STARTS_AT,
    pricePerSeat: 300,
  }
}

export function defaultConfig(now: number): Config {
  return {
    variant: 'A',
    holdMinutes: 30,
    extensionAllowed: true,
    minutesToShow: 0,
    clock: { anchorReal: now, anchorSim: now, speed: 1 },
    extraSold: [],
    snipeNext: false,
  }
}

export function freshDB(now: number, keep?: Partial<Config>): DB {
  const config = { ...defaultConfig(now), ...(keep ?? {}) }
  config.clock = { anchorReal: now, anchorSim: now, speed: keep?.clock?.speed ?? 1 }
  config.extraSold = []
  config.snipeNext = false
  return {
    version: 1,
    config,
    show: makeShow(now, config.minutesToShow),
    sessions: {},
    groups: SEED_GROUPS(now),
    events: [],
  }
}
