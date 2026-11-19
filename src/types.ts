export type Variant = 'A' | 'B'

export interface Show {
  movie: string
  language: string
  certificate: string
  cinema: string
  screen: string
  /** Simulated epoch ms when the show starts */
  startsAt: number
  pricePerSeat: number
}

export type SeatState = 'held' | 'paid' | 'open' | 'released'

export interface Seat {
  id: string // 'F7'
  memberId: string | null
  state: SeatState
  coveredByHost?: boolean
}

export type MemberStatus = 'pending' | 'paid' | 'declined' | 'failed' | 'left' | 'released'

export interface Member {
  id: string
  name: string
  phone: string
  initials: string
  isHost: boolean
  status: MemberStatus
  paidAt: number | null
  remindersSent: number
  lastNudgeAt: number | null
  /** Simulated time at which a checkout was opened (for the E7 grace period) */
  payingSince: number | null
  joinedAt: number | null
}

export interface MoveRequest {
  id: string
  memberId: string
  from: string
  to: string
  createdAt: number
}

export interface Notice {
  id: string
  ts: number
  /** 'all', 'host', 'members' (everyone except the host) or a member id */
  to: string
  text: string
  tone: 'info' | 'success' | 'warn' | 'error'
}

export type SessionStatus =
  | 'live'
  | 'expired' // timer ended, host must resolve (A)
  | 'confirmed'
  | 'partial'
  | 'settled'
  | 'cancelled'

export interface Session {
  id: string
  variant: Variant
  show: Show
  hostId: string
  hostPhone: string
  seats: Seat[]
  members: Member[]
  holdMinutes: number
  startedAt: number
  expiresAt: number
  expiredAt: number | null
  extensionUsed: boolean
  extensionAllowed: boolean
  status: SessionStatus
  createdAt: number
  endedAt: number | null
  autoReminders: { half: boolean; five: boolean }
  moveRequests: MoveRequest[]
  notices: Notice[]
  showCancelled: boolean
  autoReleased: boolean
}

export interface SavedContact {
  name: string
  phone: string
}

export interface Group {
  id: string
  name: string
  members: SavedContact[]
  lastUsedAt: number
}

export interface AppEvent {
  ts: number // simulated time
  realTs: number
  sessionId: string
  variant: Variant | ''
  actor: string
  type: string
  payload: Record<string, unknown>
}

export interface Config {
  variant: Variant
  holdMinutes: number
  extensionAllowed: boolean
  minutesToShow: number
  clock: { anchorReal: number; anchorSim: number; speed: number }
  /** Seats sold by "someone else" (E18) */
  extraSold: string[]
  /** When true, the next "Continue" on the seat map loses one selected seat (E18) */
  snipeNext: boolean
}

export interface DB {
  version: number
  config: Config
  show: Show
  sessions: Record<string, Session>
  groups: Group[]
  events: AppEvent[]
}

export interface Draft {
  seats: string[]
  /** seatId -> contact (or null for open seat). Host seat is seats[0] by default */
  assign: Record<string, SavedContact | null>
  hostSeat: string | null
  groupName?: string
  /** People to auto-assign once seats are picked (Book again) */
  prefill?: SavedContact[]
}

export interface Profile {
  name: string
  phone: string
}
