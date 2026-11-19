import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import { Avatar, BottomBar, Button, Card, Divider, Field, Header, Pill, Sheet, TimerBar } from '../components/ui'
import { Legend, SeatMap, type SeatLook } from '../components/SeatMap'
import { PaySheet } from '../components/PaySheet'
import { Poster, SeatTag, seatSort } from './Host'
import {
  AUTO_RELEASE_MS, GRACE_MS, NUDGE_COOLDOWN_MS, answerMove, canPay, cancelSession, claimOpenSeat, extend, firstName, fmtClock, fmtDate, fmtTime,
  host, inr, isActive, claimableSeats, joinAs, memberById, memberDecline, memberDisplay, memberPay, moveSeat, normPhone, nudge, outcomeLabel, owingMembers,
  passSeat, releaseSeat, resolve, seatDisplay, seatOf, soldSet, startCheckout, unpaidSeats, uid, log, type Resolution,
} from '../logic'
import { CONTACTS } from '../seed'
import type { Member, SavedContact, Session } from '../types'

export const sessionLink = (sid: string, memberId?: string) => `${location.origin}/s/${sid}${memberId ? `?m=${memberId}` : ''}`

export function SessionRoute({ sid }: { sid: string }) {
  const { db, identity, nav } = useStore()
  const s = db.sessions[sid]
  const meId = identity(sid)

  if (!s) {
    return (
      <div className="bg-white min-h-dvh">
        <Header title="Group booking" onBack={() => nav('/')} />
        <div className="p-6 text-center">
          <h2 className="text-[18px] font-semibold mb-1">This link doesn't work any more</h2>
          <p className="text-[13px] text-sub mb-5">The session may have been reset. Ask your friend for a new link.</p>
          <Button onClick={() => nav('/')}>Go to home</Button>
        </div>
      </div>
    )
  }
  const me = memberById(s, meId)
  if (!me) return <Landing s={s} />
  return <Live s={s} me={me} />
}

/* ---------------- notices → banners ---------------- */

function useNoticeBanners(s: Session, me: Member) {
  const { toast } = useStore()
  const seen = useRef<Set<string> | null>(null)
  const key = `${s.id}:${me.id}`
  const lastKey = useRef(key)
  if (!seen.current || lastKey.current !== key) { seen.current = new Set(s.notices.map((n) => n.id)); lastKey.current = key }
  useEffect(() => {
    for (const n of s.notices) {
      if (seen.current!.has(n.id)) continue
      seen.current!.add(n.id)
      // The resolution sheet already says it all: don't cover it with banners.
      if (me.isHost && s.status === 'expired') continue
      if (isForMe(n.to, me)) toast(n.text, n.tone)
    }
  }, [s.notices, s.status, me, toast])
}

const isForMe = (to: string, me: Member) => to === 'all' || to === me.id || (to === 'host' && me.isHost) || (to === 'members' && !me.isHost)
export const forMe = (s: Session, me: Member) => s.notices.filter((n) => isForMe(n.to, me))

/** E13: a paid member is asked to accept a seat move. Shown on the live view and the ticket. */
export function MoveRequestCard({ s, me }: { s: Session; me: Member }) {
  const { act, toast } = useStore()
  const r = s.moveRequests.find((x) => x.memberId === me.id)
  if (!r) return null
  const h = host(s)
  return (
    <Card className="p-4 border-brand">
      <div className="text-[15px] font-semibold">Move to {r.to}?</div>
      <div className="text-[13px] text-sub mt-0.5">{firstName(h.name)} wants to move you from {r.from} to {r.to}. Your ticket stays paid.</div>
      <div className="grid grid-cols-2 gap-2 mt-3">
        <Button variant="outline" className="!h-10" onClick={() => act((d, n) => { answerMove(d, n, s.id, r.id, false) })}>Keep {r.from}</Button>
        <Button className="!h-10" onClick={async () => { let e: string | null = null; await act((d, n) => { e = answerMove(d, n, s.id, r.id, true) }); if (e) toast(e, 'error') }}>Move to {r.to}</Button>
      </div>
    </Card>
  )
}

/* ---------------- 7. Invite landing ---------------- */

function Landing({ s }: { s: Session }) {
  const { act, setIdentity, nav, demo, toast } = useStore()
  const q = new URLSearchParams(location.search)
  const pre = memberById(s, q.get('m'))
  const h = host(s)
  const active = isActive(s)
  const price = s.show.pricePerSeat
  const claimable = claimableSeats(s)
  const preSeat = pre ? seatOf(s, pre.id) : undefined
  const [seatId, setSeatId] = useState<string | null>(
    preSeat && claimable.includes(preSeat) ? preSeat.id : claimable.length === 1 ? claimable[0].id : null,
  )
  const ownerOf = (id: string | null) => memberById(s, s.seats.find((x) => x.id === id)?.memberId)
  const [name, setName] = useState(ownerOf(seatId)?.name ?? '')
  const [nameTouched, setNameTouched] = useState(false)
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const going = s.members.filter((m) => !m.isHost && seatOf(s, m.id))
  const needsSeat = active && claimable.length > 0
  // A number already in the session is enough: that person already has a place (E10).
  const known = normPhone(phone).length === 10 && s.members.some((m) => m.phone === normPhone(phone))
  const valid = name.trim().length >= 2 && normPhone(phone).length === 10 && (!needsSeat || seatId !== null || known)

  const join = async (thenPay: boolean) => {
    setBusy(true)
    let r: { memberId?: string; error?: string } = {}
    await act((d, n) => { r = joinAs(d, n, s.id, name, phone, active ? seatId : null); return !!r.memberId })
    setBusy(false)
    if (r.error) { toast(r.error, 'error'); setSeatId(null); return }
    if (!r.memberId) return
    if (thenPay) sessionStorage.setItem('gb_autopay_' + s.id, '1')
    setIdentity(s.id, r.memberId, demo)
  }

  return (
    <div className="bg-surface min-h-dvh">
      <Header title={`${firstName(h.name)} invited you`} sub="Group booking" onBack={() => nav('/')} />
      <TimerBar s={s} />
      <div className="bg-white p-4 flex gap-3">
        <Poster small />
        <div className="text-[13px] min-w-0">
          <div className="font-semibold text-[17px] leading-tight">{s.show.movie}</div>
          <div className="text-sub mt-0.5">{fmtDate(s.show.startsAt)} · {fmtTime(s.show.startsAt)}</div>
          <div className="text-sub truncate">{s.show.cinema}</div>
          <div className="text-sub">{s.show.screen}</div>
        </div>
      </div>

      <div className="p-3 space-y-3">
        <Card className="p-4">
          {active ? (
            <>
              <div className="text-[13px] text-sub">
                {s.variant === 'A'
                  ? `${firstName(h.name)} is holding ${s.seats.length} seats. Everyone pays for their own.`
                  : `${firstName(h.name)} already paid for all ${s.seats.length} seats. Your seat is confirmed.`}
              </div>
              <div className="flex items-end justify-between mt-3">
                <div>
                  <div className="text-[12px] text-sub">{s.variant === 'A' ? 'Your share' : `You pay ${firstName(h.name)} back`}</div>
                  <div className="text-[30px] font-semibold leading-none mt-1">{inr(price)}</div>
                </div>
                <div className="text-[11px] text-sub text-right">1 seat<br />No extra fee</div>
              </div>
            </>
          ) : (
            <>
              <div className="text-[16px] font-semibold">{s.status === 'cancelled' ? 'This session was cancelled' : 'This session has ended'}</div>
              <div className="text-[13px] text-sub mt-1">Enter your number to see what happened to your seat.</div>
            </>
          )}
          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-line">
            <div className="flex -space-x-2">
              <Avatar name={h.name} initials={h.initials} size={28} ring="#fff" />
              {going.slice(0, 6).map((m) => <Avatar key={m.id} name={m.name} initials={m.initials} size={28} ring="#fff" />)}
            </div>
            <div className="text-[12px] text-sub truncate">{[h, ...going].map((m) => firstName(m.name)).join(', ')}</div>
          </div>
        </Card>

        {needsSeat && (
          <Card className="p-4">
            <div className="text-[14px] font-semibold">Which seat is yours?</div>
            <div className="text-[12px] text-sub mb-3">{firstName(h.name)} saved these for the group.</div>
            <div className="grid grid-cols-2 gap-2">
              {claimable.map((x) => {
                const o = memberById(s, x.memberId)
                const on = seatId === x.id
                return (
                  <button
                    key={x.id}
                    onClick={() => { setSeatId(x.id); if (!nameTouched) setName(o?.name ?? '') }}
                    className={`h-12 px-3 rounded-lg border text-left flex items-center gap-2 ${on ? 'border-brand bg-[#fff5f7]' : 'border-line'}`}
                    aria-pressed={on}
                  >
                    <span className={`w-9 h-7 rounded-md grid place-items-center text-[12px] font-semibold shrink-0 ${o ? 'bg-amber text-ink' : 'border border-dashed border-amber text-[#a86500]'}`}>{x.id}</span>
                    <span className="text-[13px] truncate">{o ? firstName(o.name) : 'Open seat'}</span>
                  </button>
                )
              })}
            </div>
          </Card>
        )}
        {active && claimable.length === 0 && (
          <Card className="p-4 text-[13px] text-sub">Every seat has been claimed. If one of them is yours, enter the same number you used before.</Card>
        )}

        <Card className="p-4 space-y-3">
          <Field label="Your name" value={name} onChange={(e) => { setName(e.target.value); setNameTouched(true) }} autoComplete="name" />
          <Field label="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="10-digit mobile number" />
          <div className="text-[11px] text-sub">No account or password. Your number is only used to recognise you if you open the link again.</div>
        </Card>
      </div>

      <BottomBar>
        {active ? (
          <div className="grid gap-1">
            <Button className="w-full" disabled={!valid || busy} onClick={() => join(true)}>
              {s.variant === 'A' ? `Pay ${inr(price)}${seatId ? ` for ${seatId}` : ''}` : `Pay ${firstName(h.name)} back ${inr(price)}`}
            </Button>
            <button className="h-8 text-[12px] text-sub disabled:opacity-50" disabled={!valid || busy} onClick={() => join(false)}>Not now, just show me the group</button>
          </div>
        ) : (
          <Button className="w-full" disabled={!valid || busy} onClick={() => join(false)}>Continue</Button>
        )}
      </BottomBar>
    </div>
  )
}

/* ---------------- 5. Live view (host and members) ---------------- */

function Live({ s, me }: { s: Session; me: Member }) {
  const { act, nav, now, toast, db, demo } = useStore()
  useNoticeBanners(s, me)
  const [shareOpen, setShareOpen] = useState(() => new URLSearchParams(location.search).get('share') === '1' && me.isHost)
  const [payOpen, setPayOpen] = useState(false)
  const [moving, setMoving] = useState<string | null>(null)
  const [passFor, setPassFor] = useState<string | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const [resolveDismissed, setResolveDismissed] = useState(false)
  const [lastSeenLog, setLastSeenLog] = useState(() => forMe(s, me).length)
  useEffect(() => { if (shareOpen) history.replaceState(null, '', `/s/${s.id}`) }, [shareOpen, s.id])
  useEffect(() => { if (s.status === 'live') setResolveDismissed(false) }, [s.status])

  const h = host(s)
  const mySeat = seatOf(s, me.id)
  const price = s.show.pricePerSeat
  const final = !isActive(s)
  const sold = useMemo(() => soldSet(db, s.id), [db, s.id])
  const paidCount = s.variant === 'A' ? s.seats.filter((x) => x.state === 'paid').length : s.members.filter((m) => m.status === 'paid' && seatOf(s, m.id)).length
  const notices = forMe(s, me)
  const unread = notices.length - lastSeenLog
  const pay = canPay(s, me, now)

  const look = (id: string): SeatLook => {
    const seat = s.seats.find((x) => x.id === id)
    if (moving) {
      if (seat) return seat.id === moving ? { kind: 'selected', label: initialsFor(s, seat.memberId) || '+' } : { kind: 'disabled' }
      return sold.has(id) ? { kind: 'sold' } : { kind: 'target' }
    }
    if (!seat) return sold.has(id) ? { kind: 'sold' } : { kind: 'disabled' }
    const d = seatDisplay(s, seat)
    const label = initialsFor(s, seat.memberId)
    if (d === 'paid' || d === 'covered') return { kind: 'paid', label }
    if (d === 'pending' || d === 'owes') return { kind: 'held', label }
    if (d === 'failed') return { kind: 'failed', label }
    if (d === 'open') return { kind: 'open' }
    return { kind: 'released' }
  }

  const onSeatTap = async (id: string) => {
    if (!me.isHost || final) return
    if (moving) {
      if (id === moving) { setMoving(null); return }
      if (s.seats.some((x) => x.id === id)) return
      let r: string | null = null
      await act((d, n) => { r = moveSeat(d, n, s.id, moving, id); return r === null || r === 'REQUESTED' })
      setMoving(null)
      if (r === 'REQUESTED') toast(`Paid seat: asked ${firstName(memberById(s, s.seats.find((x) => x.id === moving)?.memberId)?.name ?? '')} to accept the move to ${id}`, 'info')
      else if (r) toast(r, 'error')
      return
    }
    const seat = s.seats.find((x) => x.id === id)
    if (!seat || seat.state === 'released') return
    setMoving(id)
  }

  const onPay = async (ok: boolean) => {
    let r: { ok: boolean; error?: string; grace?: boolean } = { ok: false }
    await act((d, n) => { r = memberPay(d, n, s.id, me.id, ok); return true })
    setPayOpen(false)
    if (r.ok) nav(`/s/${s.id}/ticket`)
    else if (r.error && ok) toast(r.error, 'error')
  }

  const openPay = async () => {
    await act((d, n) => startCheckout(d, n, s.id, me.id))
    setPayOpen(true)
  }

  // Coming straight from the invite's "Pay" button: open checkout immediately.
  useEffect(() => {
    const k = 'gb_autopay_' + s.id
    if (sessionStorage.getItem(k) !== '1') return
    sessionStorage.removeItem(k)
    if (pay.ok && !me.isHost) openPay()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // E1/E4 resolution sheet
  if (me.isHost && s.status === 'expired' && s.variant === 'A' && !resolveDismissed) {
    return <Resolution s={s} onClose={() => setResolveDismissed(true)} />
  }
  if (final) return <Outcome s={s} me={me} onSave={() => setSaveOpen(true)} saveOpen={saveOpen} setSaveOpen={setSaveOpen} />

  const hero = (() => {
    if (me.isHost) {
      const total = s.seats.length
      const pct = s.variant === 'A' ? (paidCount / total) * 100 : total > 1 ? ((paidCount - 1) / (total - 1)) * 100 : 100
      return (
        <Card className="p-4">
          <div className="flex items-baseline justify-between">
            <div className="text-[16px] font-semibold">
              {s.variant === 'A' ? `${paidCount} of ${total} seats paid` : `${inr((paidCount - 1) * price)} of ${inr((total - 1) * price)} paid back`}
            </div>
            {s.status === 'expired' && <button className="text-brand text-[13px] font-medium" onClick={() => setResolveDismissed(false)}>Resolve</button>}
          </div>
          <div className="h-2 rounded-full bg-surface mt-2 overflow-hidden"><div className="h-full bg-ok transition-all" style={{ width: `${pct}%` }} /></div>
          <div className="text-[12px] text-sub mt-2">
            {s.variant === 'A'
              ? s.status === 'expired' ? 'The hold has ended. Decide what happens to unpaid seats.' : 'Each seat is confirmed the moment its friend pays.'
              : 'Every seat is already confirmed. Friends are paying you back.'}
          </div>
        </Card>
      )
    }
    if (!mySeat) {
      const open = s.seats.filter((x) => x.state === 'open')
      return (
        <Card className="p-4">
          <div className="text-[16px] font-semibold">{me.status === 'released' ? 'Your seat was released' : me.status === 'left' ? 'You left this booking' : "You don't have a seat yet"}</div>
          <div className="text-[13px] text-sub mt-1">{open.length ? 'Pick an open seat to join the group.' : 'There are no open seats right now.'}</div>
          {open.length > 0 && s.status === 'live' && (
            <div className="flex flex-wrap gap-2 mt-3">
              {open.map((x) => (
                <Button key={x.id} variant="outline" className="!h-9" onClick={() => act((d, n) => claimOpenSeat(d, n, s.id, me.id, x.id))}>Take {x.id}</Button>
              ))}
            </div>
          )}
        </Card>
      )
    }
    const d = seatDisplay(s, mySeat)
    const paid = d === 'paid' || d === 'covered'
    return (
      <Card className={`p-4 ${paid ? 'bg-[#effaf1] border-[#c4ebcd]' : 'bg-[#fff8ec] border-[#f8dca6]'}`}>
        <div className="flex items-center gap-3">
          <SeatTag id={mySeat.id} tone={paid ? 'bg-ok text-white' : 'bg-amber text-ink'} />
          <div className="flex-1">
            <div className="text-[16px] font-semibold">
              {paid
                ? s.variant === 'A' ? (d === 'covered' ? `${firstName(h.name)} paid for your seat` : 'Your seat is confirmed') : `You paid ${firstName(h.name)} back`
                : s.variant === 'A' ? `${firstName(me.name)}, ${mySeat.id} is held for you` : `${firstName(me.name)}, ${mySeat.id} is booked for you`}
            </div>
            <div className="text-[12px] text-sub">
              {paid
                ? 'Your ticket is ready.'
                : s.variant === 'A' ? `Pay ${inr(price)} to confirm it before the timer ends.` : `${firstName(h.name)} paid for it. Pay back ${inr(price)}.`}
            </div>
          </div>
        </div>
        {me.status === 'failed' && !paid && <div className="mt-3 text-[12px] text-err bg-[#fdecea] rounded-md px-2.5 py-2">Payment failed, try again. Your seat is still held.</div>}
        {s.status === 'expired' && !paid && !pay.ok && <div className="mt-3 text-[12px] text-err bg-[#fdecea] rounded-md px-2.5 py-2">The hold has ended. {firstName(h.name)} is deciding what happens to unpaid seats.</div>}
        {paid && <Button variant="outline" className="w-full mt-3 !h-10" onClick={() => nav(`/s/${s.id}/ticket`)}>{s.variant === 'A' ? 'View my ticket' : 'View receipt'}</Button>}
      </Card>
    )
  })()

  return (
    <div>
      <Header
        title={s.show.movie}
        sub={`${fmtDate(s.show.startsAt)} · ${fmtTime(s.show.startsAt)} · ${s.show.cinema.split(':')[0]}`}
        onBack={() => nav('/')}
        right={
          <button aria-label="Notifications" onClick={() => { setLogOpen(true); setLastSeenLog(notices.length) }} className="relative w-9 h-9 grid place-items-center rounded-full active:bg-white/10">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 003.4 0" /></svg>
            {unread > 0 && <span className="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-brand text-[10px] grid place-items-center">{unread}</span>}
          </button>
        }
      />
      <TimerBar s={s} />
      {s.status === 'expired' && <div className="sticky top-14 z-20 h-10 px-4 flex items-center justify-between text-[13px] bg-err text-white"><span className="font-medium">Hold ended</span><span className="tabular-nums">Auto-release in {fmtClock((s.expiredAt ?? now) + AUTO_RELEASE_MS - now)}</span></div>}
      <div className="p-3 space-y-3">
        <MoveRequestCard s={s} me={me} />
        {hero}
        <Card className="py-3 px-1">
          <div className="px-3 flex items-center justify-between mb-2">
            <div className="text-[13px] font-semibold">Where you'll sit</div>
            {me.isHost && <div className="text-[11px] text-sub">{moving ? `Moving ${moving}: tap a free seat` : 'Tap a seat to move it'}</div>}
          </div>
          <SeatMap look={look} onTap={me.isHost ? onSeatTap : undefined} me={mySeat?.id} compact />
          <div className="mt-3 px-2">
            <Legend items={s.variant === 'A'
              ? [['paid', 'Paid'], ['held', 'Pending'], ['failed', 'Failed'], ['open', 'Open'], ['released', 'Released']]
              : [['paid', 'Paid back'], ['held', 'Owes host'], ['open', 'Open']]} />
          </div>
          {moving && <div className="px-3 mt-2"><Button variant="ghost" className="w-full !h-9" onClick={() => setMoving(null)}>Cancel move</Button></div>}
        </Card>
        <Card>
          <div className="px-3 pt-3 pb-1 flex items-center justify-between">
            <div className="text-[13px] font-semibold">The group</div>
            <div className="text-[12px] text-sub">{paidCount}/{s.seats.length} {s.variant === 'A' ? 'paid' : 'settled'}</div>
          </div>
          {s.seats.slice().sort((a, b) => seatSort(a.id, b.id)).map((seat) => (
            <SeatRow key={seat.id} s={s} seatId={seat.id} me={me} onPass={() => setPassFor(seat.id)} />
          ))}
          {s.members.filter((m) => !m.isHost && !seatOf(s, m.id)).map((m) => (
            <div key={m.id} className="px-3 py-2.5 flex items-center gap-3 border-t border-line opacity-70">
              <span className="w-10" />
              <Avatar name={m.name} initials={m.initials} size={30} />
              <div className="flex-1 text-[14px]">{firstName(m.name)}{m.id === me.id && ' (you)'}</div>
              <Pill kind={memberDisplay(s, m)} label={m.status === 'left' ? 'Left' : m.status === 'released' ? 'Passed on' : undefined} />
            </div>
          ))}
        </Card>
        {me.isHost && (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => setSaveOpen(true)}>Save as group</Button>
            <Button variant="danger" onClick={() => setCancelOpen(true)}>Cancel session</Button>
          </div>
        )}
        {!me.isHost && mySeat && (s.variant === 'A' ? mySeat.state === 'paid' : me.status === 'paid') && (
          <button className="w-full text-center text-[12px] text-sub py-1" onClick={() => nav(`/s/${s.id}/ticket`)}>Need to drop out? Manage from your ticket</button>
        )}
        {demo && <div className="text-[11px] text-center text-sub">Demo mode: switch who you are using the bar at the top.</div>}
      </div>
      <BottomBar>
        {me.isHost ? (
          <Button className="w-full" onClick={() => setShareOpen(true)}>
            <span className="inline-flex items-center gap-2 justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg>
              Share invite link
            </span>
          </Button>
        ) : mySeat && pay.ok ? (
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <Button variant="outline" onClick={async () => { if (confirm(`Give up ${mySeat.id}? ${firstName(h.name)} will be told so they can pass it on.`)) await act((d, n) => { memberDecline(d, n, s.id, me.id) }) }}>Can't make it</Button>
            <Button onClick={openPay} className={s.status === 'live' && s.expiresAt - now < 3 * 60000 ? 'pulse' : ''}>
              {s.variant === 'A' ? `Pay ${inr(price)} for my seat` : `Pay ${firstName(h.name)} back ${inr(price)}`}
            </Button>
          </div>
        ) : (
          <Button className="w-full" variant="outline" onClick={() => setLogOpen(true)}>See group activity</Button>
        )}
      </BottomBar>

      <ShareSheet s={s} open={shareOpen} onClose={() => setShareOpen(false)} />
      <PaySheet
        open={payOpen} amount={price} onClose={() => setPayOpen(false)} onResult={onPay}
        title={s.variant === 'A' ? `Pay for seat ${mySeat?.id}` : `Pay ${firstName(h.name)} back`}
        lines={s.variant === 'A' ? [[`Seat ${mySeat?.id} · ${s.show.movie}`, inr(price)], ['Group booking fee', '₹0']] : [[`Your share of seat ${mySeat?.id}`, inr(price)], ['Paid to', h.name]]}
        note={s.variant === 'A' && now >= s.expiresAt ? `The timer has ended, but payments already in progress get ${GRACE_MS / 1000} extra seconds.` : undefined}
      />
      <PassSheet s={s} seatId={passFor} onClose={() => setPassFor(null)} />
      <Sheet open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel this session?">
        <p className="text-[13px] text-sub mb-4">
          {s.variant === 'A'
            ? `Unpaid seats are released straight away. ${paidCount > 1 ? `${paidCount - 1} friend${paidCount > 2 ? 's have' : ' has'} already paid; they'll be notified and refunded under the cinema's cancellation policy.` : ''}`
            : 'Tickets you paid for are cancelled and refunded under the cinema’s cancellation policy. Everyone in the group is notified.'}
        </p>
        <div className="grid gap-2">
          <Button variant="danger" onClick={async () => { await act((d, n) => { cancelSession(d, n, s.id) }); setCancelOpen(false) }}>Yes, cancel session</Button>
          <Button variant="ghost" onClick={() => setCancelOpen(false)}>Keep it</Button>
        </div>
      </Sheet>
      <NoticeLog open={logOpen} onClose={() => setLogOpen(false)} s={s} me={me} />
      <SaveGroupSheet open={saveOpen} onClose={() => setSaveOpen(false)} s={s} />
    </div>
  )
}

const initialsFor = (s: Session, memberId: string | null) => memberById(s, memberId)?.initials ?? ''

function SeatRow({ s, seatId, me, onPass }: { s: Session; seatId: string; me: Member; onPass(): void }) {
  const { act, now, toast } = useStore()
  const seat = s.seats.find((x) => x.id === seatId)!
  const m = memberById(s, seat.memberId)
  const d = seatDisplay(s, seat)
  const active = isActive(s)
  const canNudge = me.isHost && m && !m.isHost && (d === 'pending' || d === 'owes' || d === 'failed')
  const cooldown = m?.lastNudgeAt ? NUDGE_COOLDOWN_MS - (now - m.lastNudgeAt) : 0
  const tone = d === 'paid' || d === 'covered' ? 'bg-ok text-white' : d === 'open' ? undefined : d === 'released' ? 'bg-[#fdecea] text-err' : 'bg-amber text-ink'
  return (
    <div className="px-3 py-2.5 flex items-center gap-3 border-t border-line">
      <SeatTag id={seat.id} open={d === 'open'} tone={tone} />
      {m ? <Avatar name={m.name} initials={m.initials} size={30} /> : <div className="w-[30px] h-[30px] rounded-full border border-dashed border-[#c5c7d4] grid place-items-center text-sub text-[14px]">+</div>}
      <div className="flex-1 min-w-0">
        <div className="text-[14px] truncate">{m ? `${firstName(m.name)}${m.isHost ? ' · host' : ''}${m.id === me.id ? ' (you)' : ''}` : 'Open seat'}</div>
        {m && !m.isHost && me.isHost && <div className="text-[11px] text-sub">{m.phone}{m.remindersSent ? ` · ${m.remindersSent} reminder${m.remindersSent > 1 ? 's' : ''}` : ''}{!m.joinedAt ? ' · link not opened' : ''}</div>}
      </div>
      {!(active && me.isHost && d === 'open') && <Pill kind={d} />}
      {active && canNudge && (
        <button
          className={`text-[12px] font-medium px-2 h-8 rounded-md border ${cooldown > 0 ? 'text-sub border-line' : 'text-brand border-brand'}`}
          onClick={async () => {
            let e: string | null = null
            await act((dd, n) => { e = nudge(dd, n, s.id, m!.id); return e === null })
            toast(e ?? `Nudged ${firstName(m!.name)}`, e ? 'warn' : 'success')
          }}
        >{cooldown > 0 ? fmtClock(cooldown) : 'Nudge'}</button>
      )}
      {active && me.isHost && d === 'open' && (
        <div className="flex gap-1">
          <button className="text-[12px] font-medium px-2 h-8 rounded-md border border-brand text-brand" onClick={onPass}>Pass</button>
          {s.variant === 'A' && <button className="text-[12px] font-medium px-2 h-8 rounded-md border border-line text-sub" onClick={() => act((dd, n) => { releaseSeat(dd, n, s.id, seat.id) })}>Release</button>}
        </div>
      )}
    </div>
  )
}

/* ---------------- 6. Share sheet ---------------- */

export function inviteText(s: Session) {
  const h = host(s)
  const seats = s.seats.map((x) => `${x.id} ${memberById(s, x.memberId) ? firstName(memberById(s, x.memberId)!.name) : '(open)'}`).join(', ')
  const when = `${fmtDate(s.show.startsAt)}, ${fmtTime(s.show.startsAt)}`
  return s.variant === 'A'
    ? `🎬 ${s.show.movie} · ${when} at ${s.show.cinema}\n${firstName(h.name)} is holding seats for us: ${seats}.\nPay ${inr(s.show.pricePerSeat)} for your seat in the next ${s.holdMinutes} min or it may be released 👇\n${sessionLink(s.id)}`
    : `🎬 ${s.show.movie} · ${when} at ${s.show.cinema}\n${firstName(h.name)} booked seats for all of us: ${seats}.\nPay back ${inr(s.show.pricePerSeat)} here 👇\n${sessionLink(s.id)}`
}

function ShareSheet({ s, open, onClose }: { s: Session; open: boolean; onClose(): void }) {
  const { act, toast } = useStore()
  const text = inviteText(s)
  const logShare = (channel: string, extra: Record<string, unknown> = {}) => act((d, n) => { log(d, n, d.sessions[s.id], host(s).name, 'link_shared', { channel, ...extra }) })
  const copy = async (t: string) => {
    try { await navigator.clipboard.writeText(t); toast('Link copied', 'success') } catch { toast(t, 'info') }
  }
  return (
    <Sheet open={open} onClose={onClose} title="Invite your friends">
      <div className="text-[12px] text-sub mb-2">Message preview</div>
      <div className="bg-[#e7ffdb] rounded-lg rounded-tr-none p-3 text-[13px] whitespace-pre-wrap break-words mb-4 shadow-sm">{text}</div>
      <div className="grid gap-2">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer"
          onClick={() => logShare('whatsapp')}
          className="h-11 rounded-lg bg-[#25D366] text-white text-[14px] font-medium grid place-items-center"
        >Share on WhatsApp</a>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => { copy(sessionLink(s.id)); logShare('copy') }}>Copy link</Button>
          <Button variant="outline" onClick={async () => {
            if (navigator.share) { try { await navigator.share({ text }); logShare('native') } catch { /* cancelled */ } }
            else { copy(text); logShare('copy_message') }
          }}>More options</Button>
        </div>
      </div>
      <div className="mt-5 text-[12px] text-sub mb-1">Or send each friend their own link (opens with their seat)</div>
      {s.members.filter((m) => !m.isHost && seatOf(s, m.id)).map((m) => (
        <div key={m.id} className="flex items-center gap-2 py-2 border-t border-line">
          <Avatar name={m.name} initials={m.initials} size={26} />
          <div className="flex-1 text-[13px]">{firstName(m.name)} · {seatOf(s, m.id)?.id}</div>
          <a className="text-[12px] text-[#128C7E] font-medium px-2" target="_blank" rel="noreferrer" onClick={() => logShare('whatsapp_personal', { memberId: m.id })}
            href={`https://wa.me/91${m.phone}?text=${encodeURIComponent(`${firstName(m.name)}, ${seatOf(s, m.id)?.id} is ${s.variant === 'A' ? 'held' : 'booked'} for you 🎬 ${sessionLink(s.id, m.id)}`)}`}>WhatsApp</a>
          <button className="text-[12px] text-brand font-medium px-2" onClick={() => { copy(sessionLink(s.id, m.id)); logShare('copy_personal', { memberId: m.id }) }}>Copy</button>
        </div>
      ))}
    </Sheet>
  )
}

/* ---------------- pass a seat ---------------- */

function ContactPicker({ s, value, onChange }: { s: Session; value: SavedContact | null; onChange(c: SavedContact | null): void }) {
  const { db } = useStore()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const inSession = new Set(s.members.filter((m) => seatOf(s, m.id)).map((m) => m.phone))
  const pool = [...CONTACTS, ...db.groups.flatMap((g) => g.members)].filter((c, i, arr) => arr.findIndex((x) => normPhone(x.phone) === normPhone(c.phone)) === i && !inSession.has(normPhone(c.phone)))
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {pool.slice(0, 8).map((c) => (
          <button key={c.phone} onClick={() => onChange(c)} className={`h-8 px-3 rounded-full border text-[12px] ${value && normPhone(value.phone) === normPhone(c.phone) ? 'border-brand text-brand bg-[#fff5f7]' : 'border-line'}`}>{c.name}</button>
        ))}
      </div>
      <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
        <input className="h-9 px-2.5 rounded-lg border border-line text-[13px] min-w-0" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="h-9 px-2.5 rounded-lg border border-line text-[13px] min-w-0" placeholder="Phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <button className="h-9 px-3 rounded-lg border border-ink text-[12px]" disabled={name.trim().length < 2 || normPhone(phone).length < 10} onClick={() => onChange({ name: name.trim(), phone: normPhone(phone) })}>Use</button>
      </div>
      {value && <div className="text-[12px] text-ok mt-2">Passing to {value.name} · {value.phone}</div>}
    </div>
  )
}

function PassSheet({ s, seatId, onClose }: { s: Session; seatId: string | null; onClose(): void }) {
  const { act, toast } = useStore()
  const [c, setC] = useState<SavedContact | null>(null)
  useEffect(() => setC(null), [seatId])
  return (
    <Sheet open={!!seatId} onClose={onClose} title={`Pass ${seatId} to someone`}>
      <p className="text-[12px] text-sub mb-3">They keep the same seat and get the same timer. Share the link with them after.</p>
      <ContactPicker s={s} value={c} onChange={setC} />
      <Button className="w-full mt-4" disabled={!c} onClick={async () => {
        let ok = false
        await act((d, n) => { ok = passSeat(d, n, s.id, seatId!, c!); return ok })
        if (!ok) toast('That person already has a seat in this session', 'error')
        onClose()
      }}>Pass seat</Button>
    </Sheet>
  )
}

/* ---------------- 10. Expiry resolution ---------------- */

function Resolution({ s, onClose }: { s: Session; onClose(): void }) {
  const { act, now, db, toast } = useStore()
  const unpaid = unpaidSeats(s)
  const [plan, setPlan] = useState<Record<string, Resolution>>({})
  const price = s.show.pricePerSeat
  const paid = s.seats.filter((x) => x.state === 'paid').length
  const onlyHost = paid === 1
  const autoLeft = (s.expiredAt ?? now) + AUTO_RELEASE_MS - now
  const decided = unpaid.every((x) => plan[x.id] && (plan[x.id].action !== 'pass' || plan[x.id].contact))
  const coverTotal = Object.values(plan).filter((p) => p.action === 'cover').length * price
  const [payOpen, setPayOpen] = useState(false)
  const set = (id: string, r: Resolution) => setPlan((p) => ({ ...p, [id]: r }))

  const commit = async () => {
    await act((d, n) => { resolve(d, n, s.id, plan) })
  }

  return (
    <div className="bg-white min-h-dvh">
      <Header title="The hold has ended" sub={`${s.show.movie} · ${fmtTime(s.show.startsAt)}`} />
      <div className="bg-err text-white px-4 py-2 flex items-center justify-between text-[13px] sticky top-14 z-20">
        <span>Decide now, or unpaid seats are released</span>
        <span className="font-semibold tabular-nums">{fmtClock(autoLeft)}</span>
      </div>
      <div className="p-4">
        {onlyHost ? (
          <div className="rounded-lg bg-[#fdecea] border border-[#f5c2bd] p-3 mb-3">
            <div className="text-[15px] font-semibold text-err">Only your seat is confirmed.</div>
            <div className="text-[13px] text-ink mt-0.5">Release {unpaid.length} seat{unpaid.length > 1 ? 's' : ''} or pay for them?</div>
          </div>
        ) : (
          <div className="mb-3">
            <div className="text-[16px] font-semibold">{paid} of {s.seats.length} seats are confirmed</div>
            <div className="text-[13px] text-sub">Paid seats are safe. Choose what happens to the {unpaid.length} unpaid seat{unpaid.length > 1 ? 's' : ''}.</div>
          </div>
        )}
        <div className="space-y-3">
          {unpaid.map((seat) => {
            const m = memberById(s, seat.memberId)
            const r = plan[seat.id]
            return (
              <div key={seat.id} className="rounded-lg border border-line p-3">
                <div className="flex items-center gap-3 mb-2.5">
                  <SeatTag id={seat.id} open={seat.state === 'open'} tone={seat.state === 'open' ? undefined : 'bg-amber text-ink'} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-medium truncate">{m ? m.name : 'Open seat'}</div>
                    <div className="text-[11px] text-sub">{m ? (m.status === 'failed' ? 'Payment failed' : `Didn't pay · ${m.remindersSent} reminder${m.remindersSent === 1 ? '' : 's'}`) : 'Nobody claimed it'}</div>
                  </div>
                  <div className="text-[13px] font-medium">{inr(price)}</div>
                </div>
                <div className="grid grid-cols-3 rounded-lg border border-line overflow-hidden text-[12px]" role="radiogroup" aria-label={`What happens to ${seat.id}`}>
                  {([['cover', `Pay ${inr(price)} myself`], ['pass', 'Pass to someone'], ['release', 'Release']] as const).map(([k, label], i) => (
                    <button
                      key={k} role="radio" aria-checked={r?.action === k}
                      onClick={() => set(seat.id, { action: k, contact: r?.contact })}
                      className={`h-10 px-1 leading-tight ${i ? 'border-l border-line' : ''} ${r?.action === k ? (k === 'release' ? 'bg-err text-white' : 'bg-ink text-white') : 'bg-white'}`}
                    >{label}</button>
                  ))}
                </div>
                {r?.action === 'pass' && (
                  <div className="mt-3"><ContactPicker s={s} value={r.contact ?? null} onChange={(c) => set(seat.id, { action: 'pass', contact: c ?? undefined })} /></div>
                )}
              </div>
            )
          })}
        </div>
        <button className="w-full mt-3 text-[13px] text-err font-medium h-10" onClick={() => setPlan(Object.fromEntries(unpaid.map((x) => [x.id, { action: 'release' } as Resolution])))}>
          Release all unpaid seats
        </button>
        <div className="rounded-lg bg-surface p-3 mt-1 flex items-center gap-3">
          <div className="flex-1 text-[13px]">
            <div className="font-medium">Need more time?</div>
            <div className="text-sub text-[12px]">{s.extensionUsed ? 'You can only extend once.' : !db.config.extensionAllowed ? 'Not available for this show: it is in high demand.' : 'Keep every unpaid seat held for 10 more minutes. Once only.'}</div>
          </div>
          <Button variant="outline" className="!h-9 shrink-0" disabled={s.extensionUsed || !db.config.extensionAllowed} onClick={async () => {
            let e: string | null = null
            await act((d, n) => { e = extend(d, n, s.id); return e === null })
            if (e) toast(e, 'error')
          }}>{s.extensionUsed ? 'Extension used' : 'Extend 10 min'}</Button>
        </div>
        <button className="w-full mt-2 text-[12px] text-sub h-9" onClick={onClose}>View the session first</button>
      </div>
      <BottomBar>
        <Button className="w-full" disabled={!decided} onClick={() => coverTotal ? setPayOpen(true) : commit()}>
          {!decided ? `Choose for ${unpaid.filter((x) => !plan[x.id]).length || 'each'} seat${unpaid.filter((x) => !plan[x.id]).length === 1 ? '' : 's'}` : coverTotal ? `Pay ${inr(coverTotal)} and confirm` : 'Confirm'}
        </Button>
      </BottomBar>
      <PaySheet open={payOpen} amount={coverTotal} title="Pay for unpaid seats" onClose={() => setPayOpen(false)}
        lines={Object.entries(plan).filter(([, p]) => p.action === 'cover').map(([id]) => [`Seat ${id}`, inr(price)])}
        onResult={async (ok) => { setPayOpen(false); if (ok) await commit(); else toast('Payment failed. Nothing changed, try again.', 'error') }} />
    </div>
  )
}

/* ---------------- 11. Outcome ---------------- */

function Outcome({ s, me, saveOpen, setSaveOpen }: { s: Session; me: Member; onSave(): void; saveOpen: boolean; setSaveOpen(v: boolean): void }) {
  const { nav, act, now, toast, setDraft } = useStore()
  const h = host(s)
  const mySeat = seatOf(s, me.id)
  const owing = owingMembers(s)
  const released = s.seats.filter((x) => x.state === 'released')
  const cancelled = s.status === 'cancelled'
  const good = s.status === 'confirmed' || (s.status === 'settled' && owing.length === 0)
  const icon = cancelled ? '✕' : good ? '✓' : '!'
  const iconTone = cancelled ? 'bg-[#fdecea] text-err' : good ? 'bg-[#e6f6ea] text-ok' : 'bg-[#fff4e0] text-[#a86500]'
  const myD = mySeat ? seatDisplay(s, mySeat) : null
  const iCanPay = !me.isHost && s.variant === 'B' && s.status === 'settled' && mySeat && me.status !== 'paid'
  const [payOpen, setPayOpen] = useState(false)

  const subtitle = (() => {
    if (s.showCancelled) return 'The cinema cancelled this show. Everyone who paid is refunded automatically.'
    if (cancelled) return `${firstName(h.name)} cancelled the session. Unpaid seats were released; paid tickets are refunded under the cancellation policy.`
    if (s.variant === 'B') return owing.length ? `${owing.map((m) => firstName(m.name)).join(', ')} still owe${owing.length === 1 ? 's' : ''} ${firstName(h.name)} ${inr(owing.length * s.show.pricePerSeat)}.` : `Everyone paid ${firstName(h.name)} back.`
    if (s.autoReleased) return `The host didn't decide within 2 minutes, so ${released.map((x) => x.id).join(', ')} ${released.length > 1 ? 'were' : 'was'} released.`
    if (released.length) return `${released.map((x) => x.id).join(', ')} ${released.length > 1 ? 'were' : 'was'} released. Every paid seat is confirmed.`
    return 'Every seat is paid for and confirmed. Each person has their own ticket.'
  })()

  // E6: member arrives after the hold has ended
  const myMessage = (() => {
    if (me.isHost || cancelled) return null
    if (s.variant === 'A' && (!mySeat || mySeat.state === 'released') && (me.status === 'released' || me.status === 'pending' || me.status === 'failed')) return 'This hold has ended. Your seat was released.'
    if (iCanPay) return `You still owe ${firstName(h.name)} ${inr(s.show.pricePerSeat)}. You can pay it back now.`
    return null
  })()

  return (
    <div>
      <Header title={s.show.movie} sub={`${fmtDate(s.show.startsAt)} · ${fmtTime(s.show.startsAt)}`} onBack={() => nav('/')} />
      <div className="bg-white p-5 text-center">
        <div className={`w-14 h-14 rounded-full grid place-items-center mx-auto text-2xl font-bold mb-3 ${iconTone}`}>{icon}</div>
        <h1 className="text-[20px] font-semibold">{outcomeLabel(s)}</h1>
        <p className="text-[13px] text-sub mt-1">{subtitle}</p>
        {myMessage && <div className="mt-3 rounded-lg bg-[#fdecea] text-err text-[13px] p-3 font-medium">{myMessage}</div>}
      </div>
      <Divider />
      <div className="bg-white">
        <div className="px-4 pt-3 pb-1 text-[12px] text-sub">Seat by seat</div>
        {s.seats.slice().sort((a, b) => seatSort(a.id, b.id)).map((seat) => {
          const m = memberById(s, seat.memberId)
          const d = seatDisplay(s, seat)
          return (
            <div key={seat.id} className="px-4 py-2.5 flex items-center gap-3 border-t border-line">
              <SeatTag id={seat.id} open={d === 'open'} tone={d === 'paid' || d === 'covered' ? 'bg-ok text-white' : d === 'released' ? 'bg-[#fdecea] text-err' : d === 'open' ? undefined : 'bg-amber text-ink'} />
              <div className="flex-1 text-[14px]">{m ? `${firstName(m.name)}${m.isHost ? ' · host' : ''}${m.id === me.id ? ' (you)' : ''}` : d === 'released' ? 'Released' : 'Open seat'}</div>
              <Pill kind={cancelled && d !== 'released' ? 'released' : d} label={cancelled ? (d === 'paid' || d === 'covered' ? 'Refunded' : 'Released') : undefined} />
              {me.isHost && s.variant === 'B' && d === 'owes' && m && (
                <button className="text-[12px] font-medium px-2 h-8 rounded-md border border-brand text-brand" onClick={async () => {
                  let e: string | null = null
                  await act((dd, n) => { e = nudge(dd, n, s.id, m.id); return e === null })
                  toast(e ?? `Reminded ${firstName(m.name)}`, e ? 'warn' : 'success')
                }}>{m.lastNudgeAt && NUDGE_COOLDOWN_MS - (now - m.lastNudgeAt) > 0 ? fmtClock(NUDGE_COOLDOWN_MS - (now - m.lastNudgeAt)) : 'Remind'}</button>
              )}
            </div>
          )
        })}
      </div>
      <div className="p-4 grid gap-2">
        {!cancelled && mySeat && (myD === 'paid' || myD === 'covered') && <Button onClick={() => nav(`/s/${s.id}/ticket`)}>{s.variant === 'A' ? 'View my ticket' : me.isHost ? 'View booking' : 'View receipt'}</Button>}
        {iCanPay && <Button onClick={() => setPayOpen(true)}>Pay {firstName(h.name)} back {inr(s.show.pricePerSeat)}</Button>}
        {me.isHost && !cancelled && <Button variant="outline" onClick={() => setSaveOpen(true)}>Save this group</Button>}
        {me.isHost && (
          <Button variant="outline" onClick={() => {
            setDraft({ seats: [], assign: {}, hostSeat: null, prefill: s.members.filter((m) => !m.isHost && seatOf(s, m.id)).map((m) => ({ name: m.name, phone: m.phone })) })
            nav('/seats')
          }}>Book again with this group</Button>
        )}
        <Button variant="ghost" onClick={() => nav(me.isHost ? '/history' : '/')}>{me.isHost ? 'Group history' : 'Done'}</Button>
      </div>
      <SaveGroupSheet open={saveOpen} onClose={() => setSaveOpen(false)} s={s} />
      <PaySheet open={payOpen} amount={s.show.pricePerSeat} title={`Pay ${firstName(h.name)} back`} onClose={() => setPayOpen(false)}
        onResult={async (ok) => {
          let r: { ok: boolean; error?: string } = { ok: false }
          await act((d, n) => { r = memberPay(d, n, s.id, me.id, ok); return true })
          setPayOpen(false)
          if (r.ok) nav(`/s/${s.id}/ticket`)
        }} />
    </div>
  )
}

/* ---------------- notification log + save group ---------------- */

function NoticeLog({ open, onClose, s, me }: { open: boolean; onClose(): void; s: Session; me: Member }) {
  const list = forMe(s, me).slice().reverse()
  const dot = { info: 'bg-[#9aa0b8]', success: 'bg-ok', warn: 'bg-amber', error: 'bg-err' }
  return (
    <Sheet open={open} onClose={onClose} title="Notifications">
      <p className="text-[11px] text-sub mb-2">Simulated: in the real app these would arrive as push or SMS.</p>
      {list.length === 0 && <div className="text-[13px] text-sub py-6 text-center">Nothing yet</div>}
      {list.map((n) => (
        <div key={n.id} className="flex gap-3 py-2.5 border-t border-line">
          <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${dot[n.tone]}`} />
          <div className="flex-1 text-[13px]">{n.text}</div>
          <div className="text-[11px] text-sub shrink-0">{fmtTime(n.ts)}</div>
        </div>
      ))}
    </Sheet>
  )
}

function SaveGroupSheet({ open, onClose, s }: { open: boolean; onClose(): void; s: Session }) {
  const { act, toast } = useStore()
  const [name, setName] = useState('')
  const people = s.members.filter((m) => !m.isHost && (seatOf(s, m.id) || m.status === 'paid'))
  return (
    <Sheet open={open} onClose={onClose} title="Save as a group">
      <p className="text-[12px] text-sub mb-3">Next time, add everyone in one tap.</p>
      <Field label="Group name" placeholder="e.g. Hostel gang" value={name} onChange={(e) => setName(e.target.value)} />
      <div className="flex flex-wrap gap-1.5 my-3">
        {people.map((m) => <span key={m.id} className="text-[12px] bg-surface rounded-full px-2.5 py-1">{m.name}</span>)}
        {people.length === 0 && <span className="text-[12px] text-sub">No one to save yet.</span>}
      </div>
      <Button className="w-full" disabled={!name.trim() || people.length === 0} onClick={async () => {
        await act((d, n) => {
          d.groups.push({ id: uid('g_'), name: name.trim(), members: people.map((m) => ({ name: m.name, phone: m.phone })), lastUsedAt: n })
          log(d, n, d.sessions[s.id], host(s).name, 'group_saved', { name: name.trim(), size: people.length })
        })
        toast(`Saved "${name.trim()}"`, 'success')
        setName('')
        onClose()
      }}>Save group</Button>
    </Sheet>
  )
}
