import type { Config, DB, Draft, Member, Notice, Profile, SavedContact, Seat, Session, Variant } from './types'
import { COLS, MAX_SEATS, ROWS, SEED_SOLD } from './seed'

export const MIN = 60000
export const GRACE_MS = 60000
export const AUTO_RELEASE_MS = 2 * MIN
export const NUDGE_COOLDOWN_MS = 5 * MIN
export const EXTENSION_MS = 10 * MIN
export const PASS_WINDOW_MS = 5 * MIN

export const simNowFrom = (c: Config, offset: number, real = Date.now()) =>
  c.clock.anchorSim + (real + offset - c.clock.anchorReal) * c.clock.speed

export const uid = (p = '') => p + Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 5)
export const normPhone = (p: string) => p.replace(/\D/g, '').slice(-10)
export const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?'
export const firstName = (name: string) => name.trim().split(/\s+/)[0] || name
export const inr = (n: number) => '₹' + n.toLocaleString('en-IN')

export const fmtClock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(s / 60)
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
export const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
export const fmtDate = (ts: number) => new Date(ts).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })

export const ALL_SEATS = ROWS.flatMap((r) => Array.from({ length: COLS }, (_, i) => `${r}${i + 1}`))

/* ---------------- derived helpers ---------------- */

export const isActive = (s: Session) => s.status === 'live' || s.status === 'expired'

export function seatsTakenBySessions(db: DB, exceptSession?: string) {
  const out = new Set<string>()
  for (const s of Object.values(db.sessions)) {
    if (s.id === exceptSession) continue
    if (s.status === 'cancelled') continue
    for (const seat of s.seats) if (seat.state !== 'released') out.add(seat.id)
  }
  return out
}

export function soldSet(db: DB, exceptSession?: string) {
  const s = seatsTakenBySessions(db, exceptSession)
  SEED_SOLD.forEach((x) => s.add(x))
  db.config.extraSold.forEach((x) => s.add(x))
  return s
}

export function activeSessionForHost(db: DB, phone: string) {
  const p = normPhone(phone)
  return Object.values(db.sessions).find((s) => isActive(s) && normPhone(s.hostPhone) === p)
}

/** E17: hold may not run past 30 min before showtime. Returns null when group mode is unavailable. */
export function holdMinutesFor(db: DB, now: number): number | null {
  const untilCutoff = Math.floor((db.show.startsAt - 30 * MIN - now) / MIN)
  const m = Math.min(db.config.holdMinutes, untilCutoff)
  return m < 10 ? null : m
}

export const memberById = (s: Session, id: string | null | undefined) => s.members.find((m) => m.id === id)
export const seatOf = (s: Session, memberId: string) => s.seats.find((x) => x.memberId === memberId)
export const host = (s: Session) => s.members.find((m) => m.isHost)!

/** Seats that still need money in Variant A (held or open). */
export const unpaidSeats = (s: Session) => s.seats.filter((x) => x.state === 'held' || x.state === 'open')

/** Variant B: members who still owe the host */
export const owingMembers = (s: Session) =>
  s.members.filter((m) => !m.isHost && m.status !== 'paid' && s.seats.some((x) => x.memberId === m.id))

export type SeatDisplay = 'paid' | 'pending' | 'failed' | 'open' | 'declined' | 'released' | 'covered' | 'owes'

export function seatDisplay(s: Session, seat: Seat): SeatDisplay {
  if (seat.state === 'released') return 'released'
  if (seat.state === 'open') return 'open'
  const m = memberById(s, seat.memberId)
  if (s.variant === 'B') {
    if (!m || m.isHost || m.status === 'paid') return 'paid'
    return m.status === 'failed' ? 'failed' : 'owes'
  }
  if (seat.state === 'paid') return seat.coveredByHost && !m?.isHost && m?.status !== 'paid' ? 'covered' : 'paid'
  if (m?.status === 'failed') return 'failed'
  return 'pending'
}

export function memberDisplay(s: Session, m: Member): SeatDisplay {
  const seat = seatOf(s, m.id)
  if (!seat) return m.status === 'released' || m.status === 'left' ? 'released' : 'declined'
  return seatDisplay(s, seat)
}

export function outcomeLabel(s: Session): string {
  const paid = s.seats.filter((x) => x.state === 'paid').length
  const total = s.seats.length
  if (s.showCancelled) return 'Show cancelled'
  switch (s.status) {
    case 'live': return s.variant === 'A' ? 'Hold live' : 'Collecting repayments'
    case 'expired': return 'Hold ended: needs resolving'
    case 'confirmed': return 'All seats confirmed'
    case 'partial': return `${paid} of ${total} seats confirmed`
    case 'cancelled': return 'Cancelled'
    case 'settled': {
      const o = owingMembers(s).length
      return o ? `Settled, ${o} pending` : 'Settled'
    }
  }
}

/* ---------------- logging ---------------- */

export function log(db: DB, now: number, s: Session | null, actor: string, type: string, payload: Record<string, unknown> = {}) {
  db.events.push({ ts: now, realTs: Date.now(), sessionId: s?.id ?? '', variant: s?.variant ?? '', actor, type, payload })
}

export function notify(s: Session, now: number, to: string, text: string, tone: Notice['tone'] = 'info') {
  s.notices.push({ id: uid('n'), ts: now, to, text, tone })
  if (s.notices.length > 80) s.notices.splice(0, s.notices.length - 80)
}

function newMember(c: SavedContact, isHost: boolean, now: number): Member {
  return {
    id: uid('m_'), name: c.name.trim(), phone: normPhone(c.phone), initials: initials(c.name), isHost,
    status: 'pending', paidAt: null, remindersSent: 0, lastNudgeAt: null, payingSince: null, joinedAt: isHost ? now : null,
  }
}

/* ---------------- host: create ---------------- */

export interface CreateResult { ok: boolean; sessionId?: string; memberId?: string; error?: string }

export function createSession(db: DB, now: number, profile: Profile, draft: Draft, variant: Variant, paySucceeds: boolean): CreateResult {
  const hold = holdMinutesFor(db, now)
  if (hold === null) return { ok: false, error: 'Group booking is not available this close to showtime.' }
  const active = activeSessionForHost(db, profile.phone)
  if (active) return { ok: false, error: `You have an active session for ${active.show.movie}. Finish or cancel it first.` }
  if (draft.seats.length < 2 || draft.seats.length > MAX_SEATS) return { ok: false, error: 'Pick 2 to 10 seats.' }
  const sold = soldSet(db)
  const lost = draft.seats.filter((x) => sold.has(x))
  if (lost.length) return { ok: false, error: `Seat ${lost.join(', ')} is no longer available.` }

  const sid = uid()
  const stub = { id: sid, variant } as Session
  const total = draft.seats.length * db.show.pricePerSeat
  if (!paySucceeds) {
    log(db, now, stub, profile.name, 'payment_failed', { who: 'host', amount: variant === 'A' ? db.show.pricePerSeat : total, stage: 'creation' })
    return { ok: false, error: 'Payment failed. Your seats were not held.' }
  }

  const hostM = newMember(profile, true, now)
  hostM.status = 'paid'
  hostM.paidAt = now
  const members: Member[] = [hostM]
  const hostSeat = draft.hostSeat ?? draft.seats[0]
  const seats: Seat[] = draft.seats.map((id) => {
    if (id === hostSeat) return { id, memberId: hostM.id, state: 'paid' }
    const c = draft.assign[id]
    if (!c) return { id, memberId: null, state: variant === 'B' ? 'paid' : 'open' }
    const existing = members.find((m) => m.phone === normPhone(c.phone))
    const m = existing ?? newMember(c, false, now)
    if (!existing) members.push(m)
    return { id, memberId: m.id, state: variant === 'B' ? 'paid' : 'held' }
  })

  const s: Session = {
    id: sid, variant, show: { ...db.show }, hostId: hostM.id, hostPhone: hostM.phone, seats, members,
    holdMinutes: hold, startedAt: now, expiresAt: variant === 'B' ? db.show.startsAt : now + hold * MIN, expiredAt: null, extensionUsed: false,
    extensionAllowed: db.config.extensionAllowed, status: 'live', createdAt: now, endedAt: null,
    autoReminders: { half: false, five: false }, moveRequests: [], notices: [], showCancelled: false, autoReleased: false,
  }
  db.sessions[sid] = s
  notify(s, now, 'all', variant === 'A'
    ? `${firstName(hostM.name)} paid for ${hostSeat}. Other seats are held for ${hold} minutes.`
    : `${firstName(hostM.name)} paid ${inr(total)} for all ${seats.length} seats. Everyone's seat is confirmed.`, 'success')
  log(db, now, s, hostM.name, 'session_created', { seats: draft.seats, members: members.length, holdMinutes: hold, hostPaid: variant === 'A' ? db.show.pricePerSeat : total })
  if (draft.groupName) {
    const g = db.groups.find((x) => x.name === draft.groupName)
    if (g) g.lastUsedAt = now
  }
  return { ok: true, sessionId: sid, memberId: hostM.id }
}

/* ---------------- members ---------------- */

export function joinSession(db: DB, now: number, sid: string, name: string, phone: string): { memberId: string; isNew: boolean } | null {
  const s = db.sessions[sid]
  if (!s) return null
  const p = normPhone(phone)
  let m = s.members.find((x) => x.phone === p) // E10: one person, one member
  const isNew = !m
  if (!m) {
    m = newMember({ name, phone: p }, false, now)
    m.status = 'declined' // no seat yet; can claim an open one
    s.members.push(m)
    notify(s, now, 'host', `${firstName(m.name)} opened the invite link.`)
  }
  if (!m.joinedAt) m.joinedAt = now
  log(db, now, s, m.name, 'link_opened', { memberId: m.id, matched: !isNew, status: s.status })
  return { memberId: m.id, isNew }
}

/** Seats a person opening the link can still say are theirs. */
export function claimableSeats(s: Session) {
  return s.seats.filter((x) => {
    if (x.state === 'open') return isActive(s)
    const m = memberById(s, x.memberId)
    return !!m && !m.isHost && !m.joinedAt && m.status !== 'paid' && x.state !== 'released'
  })
}

/**
 * Invite landing: the friend says which seat is theirs and gives a name and number.
 * A number already in the session always wins (E10: one person, one member).
 */
export function joinAs(db: DB, now: number, sid: string, name: string, phone: string, seatId: string | null): { memberId?: string; error?: string } {
  const s = db.sessions[sid]
  if (!s) return { error: 'Session not found.' }
  const p = normPhone(phone)
  const existing = s.members.find((x) => x.phone === p)
  if (existing) {
    if (!existing.joinedAt) existing.joinedAt = now
    log(db, now, s, existing.name, 'link_opened', { memberId: existing.id, matched: 'phone', status: s.status })
    return { memberId: existing.id }
  }
  const seat = seatId ? s.seats.find((x) => x.id === seatId) : undefined
  if (seat && !claimableSeats(s).includes(seat)) return { error: `Someone has already claimed ${seat.id}. Pick another seat.` }
  const owner = seat && memberById(s, seat.memberId)
  if (seat && owner) {
    // The host added this friend; the real person now confirms it's them.
    owner.name = name.trim() || owner.name
    owner.initials = initials(owner.name)
    owner.phone = p
    owner.joinedAt = now
    notify(s, now, 'host', `${firstName(owner.name)} opened the invite for ${seat.id}.`)
    log(db, now, s, owner.name, 'link_opened', { memberId: owner.id, matched: 'seat', seat: seat.id, status: s.status })
    return { memberId: owner.id }
  }
  const m = newMember({ name, phone: p }, false, now)
  m.joinedAt = now
  s.members.push(m)
  if (seat) {
    seat.memberId = m.id
    seat.state = s.variant === 'A' ? 'held' : 'paid'
    notify(s, now, 'all', `${firstName(m.name)} took open seat ${seat.id}.`)
  } else {
    m.status = 'declined' // no seat; can still view the group
    notify(s, now, 'host', `${firstName(m.name)} opened the invite link.`)
  }
  log(db, now, s, m.name, 'link_opened', { memberId: m.id, matched: seat ? 'open_seat' : 'none', seat: seat?.id ?? null, status: s.status })
  return { memberId: m.id }
}

/** Is a payment by this member allowed right now? Includes the E7 grace period. */
export function canPay(s: Session, m: Member, now: number): { ok: boolean; grace?: boolean; reason?: string } {
  if (s.status === 'cancelled') return { ok: false, reason: s.showCancelled ? 'The show was cancelled.' : 'The host cancelled this session.' }
  const seat = seatOf(s, m.id)
  if (!seat) return { ok: false, reason: 'You no longer have a seat in this session.' }
  if (s.variant === 'B') return m.status === 'paid' ? { ok: false, reason: 'Already paid.' } : { ok: true }
  if (seat.state === 'paid') return { ok: false, reason: 'This seat is already paid for.' }
  if (s.status === 'live' && now < s.expiresAt) return { ok: true }
  const graceEnd = s.expiresAt + GRACE_MS
  if (m.payingSince !== null && m.payingSince <= s.expiresAt && now <= graceEnd && (s.status === 'live' || s.status === 'expired'))
    return { ok: true, grace: true }
  return { ok: false, reason: 'This hold has ended.' }
}

export function startCheckout(db: DB, now: number, sid: string, memberId: string) {
  const s = db.sessions[sid]
  const m = s && memberById(s, memberId)
  if (!m) return false
  m.payingSince = now
}

export function memberPay(db: DB, now: number, sid: string, memberId: string, success: boolean): { ok: boolean; error?: string; grace?: boolean } {
  const s = db.sessions[sid]
  const m = s && memberById(s, memberId)
  if (!s || !m) return { ok: false, error: 'Session not found.' }
  const check = canPay(s, m, now)
  if (!check.ok) { m.payingSince = null; return { ok: false, error: check.reason } }
  const seat = seatOf(s, m.id)!
  if (!success) {
    m.status = 'failed'
    m.payingSince = null
    notify(s, now, m.id, 'Payment failed, try again. Your seat is still held.', 'error')
    notify(s, now, 'host', `${firstName(m.name)}'s payment for ${seat.id} failed.`, 'warn')
    log(db, now, s, m.name, 'payment_failed', { memberId: m.id, seat: seat.id, amount: s.show.pricePerSeat })
    return { ok: false, error: 'Payment failed, try again.' }
  }
  m.status = 'paid'
  m.paidAt = now
  m.payingSince = null
  if (s.variant === 'A') { seat.state = 'paid'; seat.coveredByHost = false }
  const msg = s.variant === 'A'
    ? `${firstName(m.name)} paid for ${seat.id}. Seat confirmed.`
    : `${firstName(m.name)} paid ${firstName(host(s).name)} back ${inr(s.show.pricePerSeat)}.`
  notify(s, now, 'all', msg, 'success')
  log(db, now, s, m.name, 'member_paid', { memberId: m.id, seat: seat.id, amount: s.show.pricePerSeat, grace: !!check.grace, msToExpiry: s.expiresAt - now })
  checkComplete(db, now, s)
  return { ok: true, grace: check.grace }
}

function checkComplete(db: DB, now: number, s: Session) {
  if (s.variant === 'A') {
    if ((s.status === 'live' || s.status === 'expired') && s.seats.every((x) => x.state === 'paid')) {
      s.status = 'confirmed'
      s.endedAt = now
      notify(s, now, 'all', `All ${s.seats.length} seats confirmed. Enjoy the show!`, 'success')
      log(db, now, s, 'system', 'session_completed', { outcome: 'confirmed', msFromStart: now - s.startedAt })
    }
  } else {
    if ((s.status === 'live' || s.status === 'settled') && s.seats.every((x) => x.state !== 'open') && owingMembers(s).length === 0) {
      const wasSettled = s.status === 'settled'
      s.status = 'settled'
      if (!wasSettled) s.endedAt = now
      notify(s, now, 'all', `Everyone has paid ${firstName(host(s).name)} back. Settled.`, 'success')
      log(db, now, s, 'system', 'session_completed', { outcome: 'settled', pending: 0, msFromStart: now - s.startedAt })
    }
  }
}

export function memberDecline(db: DB, now: number, sid: string, memberId: string) {
  const s = db.sessions[sid]
  const m = s && memberById(s, memberId)
  if (!s || !m || m.isHost) return false
  const seat = seatOf(s, m.id)
  if (!seat || (s.variant === 'A' && seat.state === 'paid')) return false
  seat.memberId = null
  if (s.variant === 'A') seat.state = 'open'
  m.status = 'declined'
  notify(s, now, 'host', `${firstName(m.name)} can't make it. ${seat.id} is now an open seat: pass it on or release it.`, 'warn')
  notify(s, now, 'members', `${firstName(m.name)} dropped out. ${seat.id} is open.`)
  log(db, now, s, m.name, 'member_declined', { memberId: m.id, seat: seat.id })
}

/** E11 */
export function memberLeaveAfterPaying(db: DB, now: number, sid: string, memberId: string) {
  const s = db.sessions[sid]
  const m = s && memberById(s, memberId)
  const seat = s && m && seatOf(s, m.id)
  if (!s || !m || !seat || m.isHost) return false
  seat.memberId = null
  if (s.variant === 'A') seat.state = 'open'
  m.status = 'left'
  notify(s, now, m.id, s.variant === 'A'
    ? 'Your ticket was cancelled. A refund follows the cinema’s cancellation policy.'
    : 'You left the group. Ask the host about your repayment.', 'info')
  notify(s, now, 'host', `${firstName(m.name)} left after paying. ${seat.id} is open again.`, 'warn')
  log(db, now, s, m.name, 'member_declined', { memberId: m.id, seat: seat.id, afterPaying: true })
  if (s.variant === 'A' && s.status === 'confirmed') { s.status = 'live'; s.endedAt = null; if (s.expiresAt < now) s.expiresAt = now + PASS_WINDOW_MS }
}

export function claimOpenSeat(db: DB, now: number, sid: string, memberId: string, seatId: string) {
  const s = db.sessions[sid]
  const m = s && memberById(s, memberId)
  const seat = s?.seats.find((x) => x.id === seatId)
  if (!s || !m || !seat || seat.state !== 'open' || !isActive(s) || seatOf(s, m.id)) return false
  seat.memberId = m.id
  seat.state = s.variant === 'A' ? 'held' : 'paid'
  m.status = 'pending'
  notify(s, now, 'all', `${firstName(m.name)} took open seat ${seat.id}.`)
  log(db, now, s, m.name, 'seat_passed', { seat: seat.id, to: m.id, via: 'claim' })
}

/* ---------------- host actions ---------------- */

export function nudge(db: DB, now: number, sid: string, memberId: string): string | null {
  const s = db.sessions[sid]
  const m = s && memberById(s, memberId)
  if (!s || !m) return 'Member not found'
  if (m.lastNudgeAt && now - m.lastNudgeAt < NUDGE_COOLDOWN_MS)
    return `You can nudge ${firstName(m.name)} again in ${fmtClock(NUDGE_COOLDOWN_MS - (now - m.lastNudgeAt))}`
  m.lastNudgeAt = now
  m.remindersSent++
  const seat = seatOf(s, m.id)
  notify(s, now, m.id, s.variant === 'A'
    ? `${firstName(host(s).name)} is waiting on you: pay ${inr(s.show.pricePerSeat)} for ${seat?.id ?? 'your seat'} before the hold ends.`
    : `${firstName(host(s).name)} reminded you to pay back ${inr(s.show.pricePerSeat)}.`, 'warn')
  log(db, now, s, host(s).name, 'nudge_sent', { memberId: m.id, count: m.remindersSent })
  return null
}

export function moveSeat(db: DB, now: number, sid: string, fromId: string, toId: string): string | null {
  const s = db.sessions[sid]
  if (!s || !isActive(s)) return 'Session is not active'
  const seat = s.seats.find((x) => x.id === fromId)
  if (!seat) return 'Seat not found'
  if (soldSet(db).has(toId)) return `${toId} is not available`
  const m = memberById(s, seat.memberId)
  const paid = s.variant === 'A' ? seat.state === 'paid' : !!m && (m.isHost || m.status === 'paid')
  if (m?.isHost) { seat.id = toId; log(db, now, s, m.name, 'seat_changed', { from: fromId, to: toId, who: 'host' }); notify(s, now, 'all', `${firstName(m.name)} moved to ${toId}.`); return null }
  if (paid && m) {
    if (s.moveRequests.some((r) => r.memberId === m.id)) return `${firstName(m.name)} hasn't answered your last request yet`
    s.moveRequests.push({ id: uid('r'), memberId: m.id, from: fromId, to: toId, createdAt: now })
    notify(s, now, m.id, `${firstName(host(s).name)} wants to move you from ${fromId} to ${toId}.`, 'warn')
    log(db, now, s, host(s).name, 'seat_move_requested', { memberId: m.id, from: fromId, to: toId })
    return 'REQUESTED'
  }
  seat.id = toId
  notify(s, now, 'all', m ? `${firstName(m.name)}'s seat moved from ${fromId} to ${toId}.` : `Open seat ${fromId} moved to ${toId}.`)
  log(db, now, s, host(s).name, 'seat_changed', { from: fromId, to: toId, memberId: m?.id ?? null })
  return null
}

export function answerMove(db: DB, now: number, sid: string, reqId: string, accept: boolean): string | null {
  const s = db.sessions[sid]
  const r = s?.moveRequests.find((x) => x.id === reqId)
  if (!s || !r) return null
  s.moveRequests = s.moveRequests.filter((x) => x.id !== reqId)
  const m = memberById(s, r.memberId)!
  if (!accept) {
    notify(s, now, 'host', `${firstName(m.name)} declined the move to ${r.to}.`)
    log(db, now, s, m.name, 'seat_changed', { from: r.from, to: r.to, accepted: false })
    return null
  }
  if (soldSet(db).has(r.to)) return `${r.to} was taken in the meantime.`
  const seat = s.seats.find((x) => x.id === r.from && x.memberId === m.id)
  if (!seat) return 'Your seat changed in the meantime.'
  seat.id = r.to
  notify(s, now, 'all', `${firstName(m.name)} accepted the move to ${r.to}.`, 'success')
  log(db, now, s, m.name, 'seat_changed', { from: r.from, to: r.to, accepted: true })
  return null
}

export function passSeat(db: DB, now: number, sid: string, seatId: string, c: SavedContact, via = 'host') {
  const s = db.sessions[sid]
  const seat = s?.seats.find((x) => x.id === seatId)
  if (!s || !seat) return false
  const old = memberById(s, seat.memberId)
  if (old && !old.isHost) old.status = 'released'
  let m = s.members.find((x) => x.phone === normPhone(c.phone))
  if (m?.isHost) return false
  if (m) { const other = seatOf(s, m.id); if (other && other !== seat) return false }
  if (!m) { m = newMember(c, false, now); s.members.push(m) }
  m.status = 'pending'
  m.paidAt = null
  seat.memberId = m.id
  seat.coveredByHost = false
  if (s.variant === 'A') seat.state = 'held'
  notify(s, now, 'all', `${firstName(host(s).name)} passed ${seat.id} to ${firstName(m.name)}.`)
  log(db, now, s, host(s).name, via === 'resolution' ? 'resolution_action' : 'seat_passed', { action: 'pass', seat: seat.id, from: old?.id ?? null, to: m.id })
  return true
}

function releaseSeatInner(s: Session) {
  return (seat: Seat) => {
    const m = memberById(s, seat.memberId)
    if (m && !m.isHost && m.status !== 'paid') m.status = 'released'
    seat.state = 'released'
  }
}

export function releaseSeat(db: DB, now: number, sid: string, seatId: string) {
  const s = db.sessions[sid]
  const seat = s?.seats.find((x) => x.id === seatId)
  if (!s || !seat || seat.state === 'paid') return false
  releaseSeatInner(s)(seat)
  notify(s, now, 'all', `${seat.id} was released.`, 'warn')
  log(db, now, s, host(s).name, s.status === 'expired' ? 'resolution_action' : 'seat_released', { action: 'release', seat: seat.id })
  if (s.status === 'live') finishIfResolved(db, now, s)
}

/** After the last unpaid seat is handled while live (A), close the session. */
function finishIfResolved(db: DB, now: number, s: Session) {
  if (s.variant !== 'A') return
  const remaining = s.seats.filter((x) => x.state !== 'released')
  if (remaining.length && remaining.every((x) => x.state === 'paid') && remaining.length < s.seats.length) {
    s.status = 'partial'
    s.endedAt = now
    log(db, now, s, 'system', 'session_completed', { outcome: 'partial', msFromStart: now - s.startedAt })
  } else checkComplete(db, now, s)
}

export type Resolution = { action: 'cover' | 'pass' | 'release'; contact?: SavedContact }

export function resolve(db: DB, now: number, sid: string, plan: Record<string, Resolution>) {
  const s = db.sessions[sid]
  if (!s || s.variant !== 'A') return false
  const h = host(s)
  let passed = 0
  for (const seat of unpaidSeats(s)) {
    const r = plan[seat.id]
    if (!r) continue
    if (r.action === 'cover') {
      seat.state = 'paid'
      seat.coveredByHost = true
      const m = memberById(s, seat.memberId)
      notify(s, now, 'all', `${firstName(h.name)} paid for ${seat.id}${m ? ` (${firstName(m.name)}'s seat)` : ''}.`, 'success')
      log(db, now, s, h.name, 'resolution_action', { action: 'cover', seat: seat.id, memberId: m?.id ?? null, amount: s.show.pricePerSeat })
    } else if (r.action === 'pass' && r.contact) {
      if (passSeat(db, now, sid, seat.id, r.contact, 'resolution')) passed++
    } else if (r.action === 'release') {
      releaseSeatInner(s)(seat)
      log(db, now, s, h.name, 'resolution_action', { action: 'release', seat: seat.id })
    }
  }
  const released = s.seats.filter((x) => x.state === 'released').map((x) => x.id)
  if (passed > 0 && unpaidSeats(s).length) {
    s.status = 'live'
    s.expiredAt = null
    s.expiresAt = now + PASS_WINDOW_MS
    s.autoReminders = { half: true, five: true }
    notify(s, now, 'all', `Passed seats are held for 5 more minutes.`, 'info')
    return true
  }
  finalizeA(db, now, s, released)
  return true
}

function finalizeA(db: DB, now: number, s: Session, released: string[]) {
  const paid = s.seats.filter((x) => x.state === 'paid').length
  s.status = released.length ? 'partial' : 'confirmed'
  s.endedAt = now
  const text = released.length
    ? `${paid} of ${s.seats.length} seats confirmed. ${released.join(', ')} ${released.length > 1 ? 'were' : 'was'} released.`
    : `All ${s.seats.length} seats confirmed.`
  notify(s, now, 'all', text, released.length ? 'warn' : 'success')
  log(db, now, s, 'system', 'session_completed', { outcome: s.status, paid, released, msFromStart: now - s.startedAt })
}

export function extend(db: DB, now: number, sid: string): string | null {
  const s = db.sessions[sid]
  if (!s || s.variant !== 'A') return 'Not available'
  if (s.extensionUsed) return 'Extension used'
  if (!db.config.extensionAllowed) return 'Extensions are not available for this show (high demand).'
  s.extensionUsed = true
  s.status = 'live'
  s.expiredAt = null
  s.expiresAt = Math.max(now, s.expiresAt) + EXTENSION_MS
  s.autoReminders.five = false
  notify(s, now, 'all', `${firstName(host(s).name)} extended the hold by 10 minutes.`, 'info')
  log(db, now, s, host(s).name, 'extension_used', { newExpiresAt: s.expiresAt })
  return null
}

export function cancelSession(db: DB, now: number, sid: string, reason: 'host' | 'show' = 'host') {
  const s = db.sessions[sid]
  if (!s || s.status === 'cancelled') return false
  for (const seat of s.seats) if (seat.state !== 'paid') seat.state = 'released'
  const paidMembers = s.members.filter((m) => m.status === 'paid')
  s.status = 'cancelled'
  s.showCancelled = reason === 'show'
  s.endedAt = now
  if (reason === 'show') {
    for (const seat of s.seats) seat.state = 'released'
    notify(s, now, 'all', 'Show cancelled by the cinema. Everyone who paid is being refunded automatically.', 'error')
  } else {
    notify(s, now, 'all', `${firstName(host(s).name)} cancelled the session. Unpaid seats were released${paidMembers.length > 1 ? '; paid tickets are refunded under the cancellation policy' : ''}.`, 'error')
  }
  log(db, now, s, reason === 'show' ? 'cinema' : host(s).name, 'session_cancelled', { reason, paidMembers: paidMembers.length })
}

/* ---------------- time-based transitions (run by every client, idempotent) ---------------- */

export function needsTick(db: DB, now: number) {
  return Object.values(db.sessions).some((s) => tickSession(structuredClone(db), structuredClone(s), now, true))
}

export function tick(db: DB, now: number) {
  let changed = false
  for (const s of Object.values(db.sessions)) if (tickSession(db, s, now, false)) changed = true
  return changed
}

function tickSession(db: DB, s: Session, now: number, dry: boolean): boolean {
  if (s.status === 'live') {
    const pending = s.variant === 'A'
      ? s.members.filter((m) => !m.isHost && m.status !== 'paid' && seatOf(s, m.id)?.state === 'held')
      : owingMembers(s)
    const half = s.startedAt + (s.holdMinutes * MIN) / 2
    if (!s.autoReminders.half && now >= half && now < s.expiresAt) {
      if (dry) return true
      s.autoReminders.half = true
      pending.forEach((m) => { m.remindersSent++; notify(s, now, m.id, s.variant === 'A' ? `Reminder: half the time is gone. Pay ${inr(s.show.pricePerSeat)} to keep ${seatOf(s, m.id)?.id}.` : `Reminder: pay ${firstName(host(s).name)} back ${inr(s.show.pricePerSeat)}.`, 'warn') })
      if (pending.length) notify(s, now, 'host', `Halfway reminder sent to ${pending.map((m) => firstName(m.name)).join(', ')}.`)
      log(db, now, s, 'system', 'reminder_auto', { at: 'half', members: pending.map((m) => m.id) })
      return true
    }
    if (!s.autoReminders.five && now >= s.expiresAt - 5 * MIN && now < s.expiresAt) {
      if (dry) return true
      s.autoReminders.five = true
      s.autoReminders.half = true
      pending.forEach((m) => { m.remindersSent++; notify(s, now, m.id, s.variant === 'A' ? `5 minutes left to pay for ${seatOf(s, m.id)?.id}.` : `The show starts soon. Pay ${firstName(host(s).name)} back ${inr(s.show.pricePerSeat)}.`, 'error') })
      if (pending.length) notify(s, now, 'host', `5-minute reminder sent to ${pending.map((m) => firstName(m.name)).join(', ')}.`)
      log(db, now, s, 'system', 'reminder_auto', { at: 'five', members: pending.map((m) => m.id) })
      return true
    }
    if (now >= s.expiresAt) {
      if (dry) return true
      if (s.variant === 'A') {
        if (unpaidSeats(s).length === 0) { checkComplete(db, now, s); return true }
        s.status = 'expired'
        s.expiredAt = now
        const n = unpaidSeats(s).length
        const onlyHost = s.seats.filter((x) => x.state === 'paid').length === 1
        notify(s, now, 'host', onlyHost
          ? `Only your seat is confirmed. Release ${n} seat${n > 1 ? 's' : ''} or pay for them?`
          : `The hold has ended. Decide what happens to ${n} unpaid seat${n > 1 ? 's' : ''} within 2 minutes.`, 'error')
        s.members.filter((m) => !m.isHost && m.status !== 'paid').forEach((m) => notify(s, now, m.id, 'The hold has ended. The host is deciding what happens to unpaid seats.', 'error'))
        log(db, now, s, 'system', 'hold_expired', { unpaid: n, onlyHost })
      } else {
        const o = owingMembers(s)
        s.status = 'settled'
        s.endedAt = now
        notify(s, now, 'all', o.length ? `Repayment window closed. Settled, ${o.length} pending.` : 'Settled.', o.length ? 'warn' : 'success')
        log(db, now, s, 'system', 'hold_expired', { owing: o.map((m) => m.id) })
        log(db, now, s, 'system', 'session_completed', { outcome: 'settled', pending: o.length, msFromStart: now - s.startedAt })
      }
      return true
    }
  }
  if (s.status === 'expired' && s.expiredAt !== null && now >= s.expiredAt + AUTO_RELEASE_MS) {
    // E2: host didn't respond
    if (dry) return true
    const unpaid = unpaidSeats(s)
    unpaid.forEach(releaseSeatInner(s))
    s.autoReleased = true
    log(db, now, s, 'system', 'resolution_action', { action: 'auto_release', seats: unpaid.map((x) => x.id) })
    finalizeA(db, now, s, unpaid.map((x) => x.id))
    return true
  }
  return false
}

/* ---------------- facilitator ---------------- */

export function setSpeed(db: DB, offset: number, speed: number) {
  const real = Date.now() + offset
  const sim = simNowFrom(db.config, offset)
  db.config.clock = { anchorReal: real, anchorSim: sim, speed }
}

export function seatsFree(db: DB) {
  const sold = soldSet(db)
  return ALL_SEATS.filter((x) => !sold.has(x))
}
