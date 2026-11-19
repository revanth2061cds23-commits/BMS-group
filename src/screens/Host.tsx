import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { useStore, emptyDraft } from '../store'
import { BottomBar, BrandBar, Button, Card, Divider, Field, Header, Sheet, Avatar } from '../components/ui'
import { Legend, SeatMap, type SeatLook } from '../components/SeatMap'
import { PaySheet } from '../components/PaySheet'
import { ContactIcon, ContactsSheet, GroupEditor } from '../components/People'
import {
  activeSessionForHost, createSession, firstName, fmtDate, fmtTime, holdMinutesFor, initials, inr, isActive, log, normPhone, soldSet, uid, type CreateResult,
} from '../logic'
import { MAX_SEATS } from '../seed'
import type { SavedContact } from '../types'

export function Poster({ small }: { small?: boolean }) {
  return (
    <div className={`${small ? 'w-14 h-20 text-[9px]' : 'w-24 h-36 text-[12px]'} rounded-lg shrink-0 overflow-hidden relative bg-[linear-gradient(160deg,#ffb36b_0%,#f84464_45%,#3b2a6b_100%)]`}>
      <svg viewBox="0 0 100 150" className="absolute inset-0 w-full h-full opacity-70">
        <path d="M20 40 l14 -10 l6 16 z" fill="#fff" /><path d="M34 30 q10 40 -4 90" stroke="#fff" strokeWidth=".8" fill="none" />
        <path d="M66 28 l12 -8 l4 14 z" fill="#ffe08a" /><path d="M78 20 q-6 50 6 100" stroke="#ffe08a" strokeWidth=".8" fill="none" />
        <rect x="0" y="118" width="100" height="32" fill="#1c1533" opacity=".7" />
      </svg>
      <div className="absolute bottom-1.5 left-1.5 right-1.5 text-white font-bold leading-tight">Kites Over Bandra</div>
    </div>
  )
}

/* ---------------- 1. Show summary ---------------- */

export function ShowSummary() {
  const { db, nav, profile, setProfile, identity, now } = useStore()
  const [edit, setEdit] = useState(false)
  const [name, setName] = useState(profile.name)
  const [phone, setPhone] = useState(profile.phone)
  const show = db.show
  const active = activeSessionForHost(db, profile.phone)
  const invited = Object.values(db.sessions).filter((s) => isActive(s) && identity(s.id) && s.id !== active?.id)
  const groupOk = holdMinutesFor(db, now) !== null
  const minsToShow = Math.round((show.startsAt - now) / 60000)

  return (
    <div>
      <BrandBar />
      <div className="sect p-4 flex gap-4">
        <Poster />
        <div className="min-w-0">
          <h1 className="text-[18px] font-semibold leading-tight">{show.movie}</h1>
          <div className="text-[12px] text-sub mt-1">{show.certificate} · {show.language}</div>
          <div className="mt-3 text-[13px] font-medium">{show.cinema}</div>
          <div className="text-[12px] text-sub">{show.screen}</div>
          <div className="mt-2 inline-flex items-center gap-2 rounded-lg border border-ok text-ok text-[13px] font-medium px-2.5 py-1">
            {fmtDate(show.startsAt)} · {fmtTime(show.startsAt)}
          </div>
          <div className="text-[11px] text-sub mt-1">Starts in {minsToShow >= 2880 ? `${Math.floor(minsToShow / 1440)} days` : minsToShow >= 60 ? `${Math.floor(minsToShow / 60)}h ${minsToShow % 60}m` : `${minsToShow} min`}</div>
        </div>
      </div>
      <Divider />
      {active && (
        <button onClick={() => nav(`/s/${active.id}`)} className="w-full text-left bg-brand-soft border-y border-brand/20 px-4 py-3">
          <div className="text-[13px] font-semibold text-brand">Your group booking is in progress</div>
          <div className="text-[12px] text-sub">{active.seats.length} seats · tap to open the live session →</div>
        </button>
      )}
      {invited.map((s) => (
        <button key={s.id} onClick={() => nav(`/s/${s.id}`)} className="w-full text-left bg-white border-b border-line px-4 py-3">
          <div className="text-[13px] font-semibold">You're in {firstName(s.members.find((m) => m.isHost)!.name)}'s group</div>
          <div className="text-[12px] text-sub">Open the live session →</div>
        </button>
      ))}
      <div className="p-4 space-y-3">
        <Card className="p-3 flex items-center gap-3">
          <Avatar name={profile.name} initials={initials(profile.name)} />
          <div className="flex-1 min-w-0">
            <div className="text-[12px] text-sub">Booking as</div>
            <div className="text-[14px] font-medium truncate">{profile.name} · {profile.phone}</div>
          </div>
          <button className="text-brand text-[13px] font-medium" onClick={() => setEdit(true)}>Edit</button>
        </Card>
        <Card className="p-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-brand-soft grid place-items-center text-brand shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="8" r="3.5" /><circle cx="17" cy="9" r="2.5" /><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M15 14.6c2.8-.3 5 1.3 6 4.4" /></svg>
            </div>
            <div className="text-[13px]">
              <div className="font-semibold">New: Book with friends</div>
              <div className="text-sub">
                {groupOk
                  ? 'Pick seats for up to 10 friends, share one link, and track who has paid in one place. No extra fee.'
                  : 'Group booking closes 40 minutes before the show. You can still book for yourself.'}
              </div>
            </div>
          </div>
        </Card>
        <button onClick={() => nav('/history')} className="w-full text-left">
          <Card className="p-3 flex items-center justify-between">
            <div>
              <div className="text-[14px] font-medium">Group bookings and saved groups</div>
              <div className="text-[12px] text-sub">{db.groups.length} saved groups · past sessions</div>
            </div>
            <span className="text-sub">›</span>
          </Card>
        </button>
      </div>
      <BottomBar>
        <Button className="w-full" onClick={() => nav('/seats')}>Select seats</Button>
      </BottomBar>
      <Sheet open={edit} onClose={() => setEdit(false)} title="Your details">
        <p className="text-[12px] text-sub mb-3">Testers: use your own name and number so friends' links match you correctly.</p>
        <div className="space-y-3">
          <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Field label="Phone number" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Button className="w-full" disabled={name.trim().length < 2 || normPhone(phone).length < 10} onClick={() => { setProfile({ name: name.trim(), phone: normPhone(phone) }); setEdit(false) }}>Save</Button>
        </div>
      </Sheet>
    </div>
  )
}

/* ---------------- 2. Seat map with Book with friends ---------------- */

export function SeatSelect() {
  const { db, nav, draft, setDraft, toast, profile, act, now } = useStore()
  const [group, setGroup] = useState(draft.seats.length > 0)
  const [hintHidden, setHintHidden] = useState(false)
  const [soloPay, setSoloPay] = useState(false)
  const sold = useMemo(() => soldSet(db), [db])
  const sel = draft.seats
  const max = MAX_SEATS
  const variant = db.config.variant
  const hold = holdMinutesFor(db, now)

  // E18: a seat in my selection was taken by someone else
  useEffect(() => {
    const lost = sel.filter((x) => sold.has(x))
    if (lost.length) {
      toast(`Seat ${lost.join(', ')} is no longer available. The seat map has been refreshed.`, 'error')
      setDraft({ ...draft, seats: sel.filter((x) => !sold.has(x)) })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sold])

  const toggleGroup = () => {
    if (!group) {
      const active = activeSessionForHost(db, profile.phone)
      if (active) { toast(`You have an active session for ${active.show.movie}. Finish or cancel it first.`, 'error'); return }
      if (hold === null) { toast('Book with friends is not available this close to showtime.', 'error'); return }
    }
    setGroup(!group)
    act((d, n) => { log(d, n, null, profile.name, 'group_toggled', { on: !group, seatsSelected: sel.length, variant: d.config.variant }) })
  }

  // Regular (non-group) booking: the user pays for every seat, as in normal checkout.
  const soloResult = async (ok: boolean) => {
    const amount = sel.length * db.show.pricePerSeat
    if (!ok) {
      await act((d, n) => { log(d, n, null, profile.name, 'payment_failed', { mode: 'regular', seats: sel, amount }) })
      setSoloPay(false)
      toast('Payment failed. Your seats were not booked.', 'error')
      return
    }
    const taken = sel.filter((x) => soldSet(db).has(x))
    if (taken.length) { setSoloPay(false); toast(`Seat ${taken.join(', ')} is no longer available.`, 'error'); return }
    const id = uid('BK').toUpperCase()
    await act((d, n) => {
      d.config.extraSold.push(...sel)
      log(d, n, null, profile.name, 'regular_booking_paid', { bookingId: id, seats: sel, amount, groupHintShown: sel.length >= 2 && !hintHidden })
    })
    try { sessionStorage.setItem('gb_last_booking', JSON.stringify({ id, seats: sel, amount, name: profile.name })) } catch { /* ignore */ }
    setSoloPay(false)
    setDraft(emptyDraft())
    nav('/booked', true)
  }

  const tap = (id: string) => {
    if (sel.includes(id)) {
      const assign = { ...draft.assign }
      delete assign[id]
      setDraft({ ...draft, seats: sel.filter((x) => x !== id), assign, hostSeat: draft.hostSeat === id ? null : draft.hostSeat })
      return
    }
    if (sel.length >= max) { toast(group ? 'Group sessions allow up to 10 seats' : 'You can book up to 10 seats', 'warn'); return }
    setDraft({ ...draft, seats: [...sel, id].sort(seatSort) })
  }

  const look = (id: string): SeatLook => {
    if (sold.has(id)) return { kind: 'sold' }
    if (sel.includes(id)) return { kind: 'selected' }
    if (sel.length >= max) return { kind: 'disabled' }
    return { kind: 'available' }
  }

  const proceed = async () => {
    if (!group) { setSoloPay(true); return }
    if (sel.length < 2) { toast('Pick at least 2 seats for a group', 'warn'); return }
    if (db.config.snipeNext) {
      const victim = sel[Math.floor(sel.length / 2)]
      await act((d, n) => {
        d.config.snipeNext = false
        d.config.extraSold.push(victim)
        d.events.push({ ts: n, realTs: Date.now(), sessionId: '', variant: d.config.variant, actor: 'system', type: 'seat_unavailable', payload: { seat: victim } })
      })
      return // the effect above shows the message and refreshes the selection
    }
    nav('/members')
  }

  return (
    <div className="bg-white min-h-dvh">
      <Header title={db.show.movie} sub={`${db.show.cinema} · ${fmtTime(db.show.startsAt)}`} onBack={() => nav('/')} />
      <div className="px-3 pt-3">
        <GroupToggle on={group} disabled={hold === null} variant={variant} onToggle={toggleGroup} />
      </div>
      <div className="py-4 px-2">
        <SeatMap look={look} onTap={tap} price={db.show.pricePerSeat} />
      </div>
      <div className="px-4 pb-2"><Legend items={[['available', 'Available'], ['selected', 'Selected'], ['sold', 'Sold']]} /></div>
      {sel.length >= max && <div className="mx-4 mt-2 text-[12px] text-center text-amber-ink bg-amber-soft rounded-lg py-2">{group ? 'Group sessions allow up to 10 seats' : 'You can book up to 10 seats'}</div>}
      {!group && sel.length >= 2 && !hintHidden && hold !== null && (
        <div className="mx-3 mt-3 rounded-2xl bg-brand-soft p-3 flex items-center gap-3 anim-fade">
          <div className="flex-1 text-[12px] leading-snug">
            <span className="font-semibold">Booking for friends?</span> Turn on <span className="font-semibold">Book with friends</span> so {variant === 'A' ? 'each of them pays for their own seat' : 'they can pay you back in the app'}.
          </div>
          <button className="h-8 px-3 rounded-full bg-brand text-white text-[12px] font-semibold shrink-0" onClick={toggleGroup}>Turn on</button>
          <button className="w-7 h-7 rounded-full text-sub grid place-items-center shrink-0" aria-label="Dismiss" onClick={() => setHintHidden(true)}>✕</button>
        </div>
      )}
      <BottomBar>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="text-[15px] font-semibold">{sel.length ? inr(sel.length * db.show.pricePerSeat) : 'Pick seats'}</div>
            <div className="text-[12px] text-sub">{group ? `${sel.length}/${max} seats` : `${sel.length} seats`}{sel.length ? ` · ${sel.join(', ')}` : ''}</div>
          </div>
          <Button onClick={proceed} disabled={!sel.length}>{group ? 'Add friends' : `Pay ${sel.length ? inr(sel.length * db.show.pricePerSeat) : ''}`}</Button>
        </div>
      </BottomBar>
      <PaySheet
        open={soloPay} amount={sel.length * db.show.pricePerSeat} title="Pay for your tickets" onClose={() => setSoloPay(false)} onResult={soloResult}
        lines={[[`${sel.length} seat${sel.length === 1 ? '' : 's'} · ${sel.join(', ')}`, inr(sel.length * db.show.pricePerSeat)], ['Booking for', 'Just you (regular booking)']]}
      />
    </div>
  )
}

function GroupToggle({ on, disabled, variant, onToggle }: { on: boolean; disabled: boolean; variant: 'A' | 'B'; onToggle(): void }) {
  return (
    <button
      onClick={onToggle} role="switch" aria-checked={on}
      className={`relative w-full overflow-hidden rounded-3xl p-4 text-left transition shadow-[0_8px_24px_rgba(248,68,100,.18)] ${disabled ? 'opacity-60' : ''} ${on ? 'bg-brand text-white' : 'bg-[linear-gradient(120deg,#FFE3E9_0%,#FFF4F6_55%,#FFFFFF_100%)] text-ink ring-[1.5px] ring-brand/35'}`}
    >
      <svg className={`absolute right-14 -bottom-10 w-28 h-28 ${on ? 'text-white/10' : 'text-brand/[.07]'}`} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <circle cx="9" cy="8" r="4" /><circle cx="17" cy="9" r="3" /><path d="M1 21c.8-4.5 4-7 8-7s7.2 2.5 8 7zM15.5 14.2c3.6-.4 6.4 1.6 7.5 5.8h-5.5c-.3-2.4-1-4.3-2-5.8z" />
      </svg>
      <div className="relative flex items-center gap-3">
        <div className={`w-12 h-12 rounded-2xl grid place-items-center shrink-0 ${on ? 'bg-white/20' : 'bg-brand text-white'}`}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="9" cy="8" r="3.5" /><circle cx="17" cy="9" r="2.5" /><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M15 14.6c2.8-.3 5 1.3 6 4.4" /></svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[16px] font-bold">Book with friends</span>
            {!on && !disabled && <span className="text-[10px] font-bold tracking-wide bg-brand text-white rounded-full px-2 py-0.5">NEW</span>}
            {on && <span className="text-[10px] font-bold tracking-wide bg-white text-brand rounded-full px-2 py-0.5">ON</span>}
          </div>
          <div className={`text-[12px] leading-snug mt-0.5 ${on ? 'text-white/90' : 'text-sub'}`}>
            {disabled
              ? 'Unavailable: the show starts too soon'
              : variant === 'A' ? 'Hold seats for the group. Everyone pays for their own seat. No extra fee.' : 'Pay for everyone now. Friends pay you back in the app. No extra fee.'}
          </div>
        </div>
        <span className={`w-12 h-7 rounded-full relative transition shrink-0 ${on ? 'bg-white' : 'bg-[#D5D7E1]'}`}>
          <span className={`absolute top-1 w-5 h-5 rounded-full transition-all shadow ${on ? 'left-6 bg-brand' : 'left-1 bg-white'}`} />
        </span>
      </div>
    </button>
  )
}

/* ---------------- Regular booking confirmation ---------------- */

export function Booked() {
  const { nav, db } = useStore()
  const [qr, setQr] = useState('')
  const b = (() => { try { return JSON.parse(sessionStorage.getItem('gb_last_booking') || '') as { id: string; seats: string[]; amount: number; name: string } } catch { return null } })()
  useEffect(() => { if (b) QRCode.toDataURL(b.id, { margin: 1, width: 220 }).then(setQr).catch(() => {}) }, [b?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!b) { nav('/', true); return null }
  return (
    <div>
      <Header title="Booking confirmed" onBack={() => nav('/')} />
      <div className="p-4">
        <div className="text-center mb-4">
          <div className="w-14 h-14 rounded-full bg-ok-soft text-ok grid place-items-center mx-auto text-2xl font-bold">✓</div>
          <div className="text-[18px] font-semibold mt-2">You're all set!</div>
          <div className="text-[13px] text-sub">{b.seats.length} ticket{b.seats.length === 1 ? '' : 's'} · {inr(b.amount)} paid</div>
        </div>
        <div className="bg-white rounded-3xl overflow-hidden shadow-[0_1px_2px_rgba(34,37,57,.04),0_4px_16px_rgba(34,37,57,.05)]">
          <div className="p-4 flex gap-3">
            <Poster small />
            <div className="text-[13px] min-w-0">
              <div className="font-semibold text-[15px]">{db.show.movie}</div>
              <div className="text-sub">{db.show.language}</div>
              <div className="mt-1">{fmtDate(db.show.startsAt)} · {fmtTime(db.show.startsAt)}</div>
              <div className="text-sub truncate">{db.show.cinema}</div>
            </div>
          </div>
          <div className="border-t border-dashed border-line mx-4" />
          <div className="p-4 flex items-center gap-4">
            {qr ? <img src={qr} alt={`Booking QR code ${b.id}`} className="w-28 h-28" /> : <div className="w-28 h-28 bg-surface rounded-lg" />}
            <div className="text-[13px] space-y-1">
              <div><span className="text-sub">{db.show.screen} · Seats</span><br /><span className="font-semibold text-[18px]">{b.seats.join(', ')}</span></div>
              <div className="text-[11px] text-sub">Booking ID {b.id}</div>
            </div>
          </div>
        </div>
        <Button className="w-full mt-4" onClick={() => nav('/')}>Done</Button>
      </div>
    </div>
  )
}

export const seatSort = (a: string, b: string) => a[0] === b[0] ? parseInt(a.slice(1)) - parseInt(b.slice(1)) : a.localeCompare(b)

/* ---------------- 3. Add members ---------------- */

export function AddMembers() {
  const { db, nav, draft, setDraft, profile, toast } = useStore()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [pickFor, setPickFor] = useState<string | null>(null)
  const [contactsOpen, setContactsOpen] = useState(false)
  const [groupOpen, setGroupOpen] = useState(false)
  const [editGroupId, setEditGroupId] = useState<string | null>(null)
  useEffect(() => { if (draft.seats.length < 2) nav('/seats', true) }, [draft.seats.length, nav])
  const hostSeat = draft.hostSeat ?? draft.seats[0]
  const others = draft.seats.filter((x) => x !== hostSeat)
  // "Book again" / saved group from history: auto-assign once seats are picked
  useEffect(() => {
    if (!draft.prefill?.length || draft.seats.length < 2) return
    const a: Record<string, SavedContact | null> = {}
    const people = draft.prefill.filter((m) => normPhone(m.phone) !== normPhone(profile.phone))
    others.forEach((seat, i) => { a[seat] = people[i] ?? null })
    setDraft({ ...draft, assign: a, prefill: undefined })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const assigned = Object.entries(draft.assign).filter(([k, v]) => v && others.includes(k)) as [string, SavedContact][]
  const isAdded = (c: SavedContact) => assigned.some(([, v]) => normPhone(v.phone) === normPhone(c.phone))

  const assign = (c: SavedContact, seat?: string) => {
    if (normPhone(c.phone) === normPhone(profile.phone)) { toast("That's you. Your seat is already set.", 'warn'); return }
    if (isAdded(c)) {
      const a = { ...draft.assign }
      for (const [k, v] of assigned) if (normPhone(v.phone) === normPhone(c.phone)) delete a[k]
      setDraft({ ...draft, assign: a })
      return
    }
    const target = seat ?? others.find((x) => !draft.assign[x])
    if (!target) { toast('Every seat has someone. Remove a person first, or pick more seats.', 'warn'); return }
    setDraft({ ...draft, assign: { ...draft.assign, [target]: c } })
    setPickFor(null)
  }

  const useGroup = (gid: string) => {
    const g = db.groups.find((x) => x.id === gid)!
    const a: Record<string, SavedContact | null> = {}
    const people = g.members.filter((m) => normPhone(m.phone) !== normPhone(profile.phone))
    others.forEach((seat, i) => { a[seat] = people[i] ?? null })
    setDraft({ ...draft, assign: a, groupName: g.name })
    if (people.length > others.length) {
      const out = people.slice(others.length).map((m) => firstName(m.name)).join(', ')
      toast(`Not enough seats for all of ${g.name}: ${out} left out. Go back to pick more seats.`, 'warn')
    }
  }

  const addManual = () => {
    if (name.trim().length < 2 || normPhone(phone).length < 10) { toast('Enter a name and a 10-digit phone number', 'warn'); return }
    assign({ name: name.trim(), phone: normPhone(phone) }, pickFor ?? undefined)
    setName(''); setPhone('')
  }

  // Contacts sheet: keep people still ticked, drop unticked ones, fill empty seats with new ones.
  const applyContacts = (list: SavedContact[]) => {
    const keep = new Set(list.map((c) => normPhone(c.phone)))
    const a: Record<string, SavedContact | null> = { ...draft.assign }
    for (const seat of others) { const c = a[seat]; if (c && !keep.has(normPhone(c.phone))) a[seat] = null }
    const placed = new Set(others.map((x) => a[x]).filter(Boolean).map((c) => normPhone(c!.phone)))
    const queue = list.filter((c) => !placed.has(normPhone(c.phone)) && normPhone(c.phone) !== normPhone(profile.phone))
    const empty = [...(pickFor && !a[pickFor] ? [pickFor] : []), ...others.filter((x) => !a[x] && x !== pickFor)]
    queue.forEach((c, i) => { if (empty[i]) a[empty[i]] = c })
    setDraft({ ...draft, assign: a })
    setPickFor(null)
    setContactsOpen(false)
  }

  const groups = db.groups.slice().sort((a, b) => b.lastUsedAt - a.lastUsedAt)
  const editing = editGroupId ? db.groups.find((g) => g.id === editGroupId) ?? null : null

  return (
    <div>
      <Header title="Add friends" sub={`${draft.seats.length} seats · give each friend a seat`} onBack={() => nav('/seats')} />
      <div className="sect p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[14px] font-semibold">Saved groups</div>
          <button className="h-8 px-3 rounded-full bg-brand-soft text-brand text-[12px] font-semibold" onClick={() => { setEditGroupId(null); setGroupOpen(true) }}>+ New group</button>
        </div>
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {groups.map((g) => {
            const on = draft.groupName === g.name
            return (
              <div key={g.id} className={`shrink-0 h-10 pl-4 pr-1 rounded-full border-[1.5px] flex items-center gap-1 ${on ? 'border-brand bg-brand-soft text-brand' : 'border-line'}`}>
                <button className="text-[13px] font-medium h-full" onClick={() => useGroup(g.id)}>{g.name} <span className={on ? 'text-brand/70' : 'text-sub'}>· {g.members.length}</span></button>
                <button className="w-8 h-8 rounded-full grid place-items-center text-sub active:bg-surface" aria-label={`Edit ${g.name}`} onClick={() => { setEditGroupId(g.id); setGroupOpen(true) }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" /></svg>
                </button>
              </div>
            )
          })}
          {groups.length === 0 && <div className="text-[13px] text-sub py-2">No groups yet. Add friends, then save them as a group.</div>}
        </div>
      </div>

      <div className="sect">
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <div className="text-[14px] font-semibold">Seats</div>
          <div className="text-[12px] text-sub">{assigned.length} of {others.length} friends added</div>
        </div>
        <div className="px-4 py-2.5 flex items-center gap-3">
          <SeatTag id={hostSeat} />
          <Avatar name={profile.name} initials={initials(profile.name)} size={36} />
          <div className="flex-1 text-[14px] font-medium">{firstName(profile.name)} <span className="text-sub font-normal">(you)</span></div>
          {draft.seats.length > 1 && (
            <select aria-label="Choose your seat" className="text-[12px] font-semibold text-brand bg-brand-soft rounded-full h-8 px-2" value={hostSeat} onChange={(e) => {
              const ns = e.target.value
              const a = { ...draft.assign }
              const moved = a[ns] ?? null
              delete a[ns]
              if (moved) a[hostSeat] = moved
              setDraft({ ...draft, hostSeat: ns, assign: a })
            }}>
              {draft.seats.map((x) => <option key={x} value={x}>My seat: {x}</option>)}
            </select>
          )}
        </div>
        {others.map((seat) => {
          const c = draft.assign[seat]
          return (
            <div key={seat} className="px-4 py-2.5 flex items-center gap-3">
              <SeatTag id={seat} open={!c} />
              {c ? (
                <>
                  <Avatar name={c.name} initials={initials(c.name)} size={36} />
                  <div className="flex-1 min-w-0"><div className="text-[14px] font-medium truncate">{c.name}</div><div className="text-[12px] text-sub">{c.phone}</div></div>
                  <button className="w-8 h-8 rounded-full bg-surface text-sub grid place-items-center text-[12px]" onClick={() => setDraft({ ...draft, assign: { ...draft.assign, [seat]: null } })} aria-label={`Remove ${c.name}`}>✕</button>
                </>
              ) : (
                <>
                  <div className="flex-1 text-[14px] text-sub">Open seat</div>
                  <button className="h-8 px-3 rounded-full bg-brand-soft text-brand text-[12px] font-semibold" onClick={() => { setPickFor(seat); setContactsOpen(true) }}>Add friend</button>
                </>
              )}
            </div>
          )
        })}
        <div className="mx-4 mb-4 mt-1 rounded-2xl bg-surface px-3 py-2 text-[12px] text-sub">Open seats can be claimed by anyone with the link.</div>
      </div>

      <div className="sect p-4">
        <div className="text-[14px] font-semibold mb-3">Add by name and number{pickFor ? ` to ${pickFor}` : ''}</div>
        <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
          <input className="h-12 px-4 rounded-2xl border-[1.5px] border-line text-[14px] min-w-0 outline-none focus:border-brand" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="h-12 px-4 rounded-2xl border-[1.5px] border-line text-[14px] min-w-0 outline-none focus:border-brand" placeholder="Phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <button className="w-12 h-12 rounded-2xl bg-brand-soft text-brand grid place-items-center" aria-label="Choose from contacts" onClick={() => setContactsOpen(true)}><ContactIcon /></button>
        </div>
        <Button variant="outline" className="w-full mt-2" onClick={addManual} disabled={name.trim().length < 2 || normPhone(phone).length < 10}>Add</Button>
        <div className="flex items-center justify-between mt-3">
          <span className="text-[12px] text-sub">Want to reuse these friends later?</span>
          <button className="text-[12px] font-semibold text-brand disabled:text-sub" disabled={assigned.length === 0} onClick={() => { setEditGroupId(null); setGroupOpen(true) }}>Save as a group</button>
        </div>
      </div>

      <BottomBar>
        <Button className="w-full" onClick={() => nav('/review')}>
          Review · {assigned.length} friend{assigned.length === 1 ? '' : 's'}{others.length - assigned.length ? `, ${others.length - assigned.length} open` : ''}
        </Button>
      </BottomBar>
      <ContactsSheet
        open={contactsOpen} onClose={() => { setContactsOpen(false); setPickFor(null) }}
        title={pickFor ? `Who sits in ${pickFor}?` : 'Choose friends'}
        initial={assigned.map(([, c]) => c)} max={others.length}
        cta={(n) => `Done · ${n} of ${others.length} seat${others.length === 1 ? '' : 's'} filled`}
        onDone={applyContacts}
      />
      <GroupEditor open={groupOpen} onClose={() => setGroupOpen(false)} group={editing} initialMembers={assigned.map(([, c]) => c)} />
    </div>
  )
}

export function SeatTag({ id, open, tone }: { id: string; open?: boolean; tone?: string }) {
  return <span className={`w-10 h-7 shrink-0 rounded-lg grid place-items-center text-[12px] font-semibold ${tone ?? (open ? 'border border-dashed border-amber text-amber-ink' : 'bg-ok text-white')}`}>{id}</span>
}

/* ---------------- 4. Review and pay ---------------- */

export function Review() {
  const { db, nav, draft, setDraft, profile, act, setIdentity, now, toast } = useStore()
  const [pay, setPay] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)
  useEffect(() => { if (draft.seats.length < 2) nav('/seats', true) }, [draft.seats.length, nav])
  const variant = db.config.variant
  const price = db.show.pricePerSeat
  const hostSeat = draft.hostSeat ?? draft.seats[0]
  const total = draft.seats.length * price
  const hold = holdMinutesFor(db, now)
  const amount = variant === 'A' ? price : total
  const others = draft.seats.filter((x) => x !== hostSeat)

  const onResult = async (ok: boolean) => {
    let res: CreateResult = { ok: false }
    await act((d, n) => { res = createSession(d, n, profile, draft, d.config.variant, ok); return true })
    setPay(false)
    if (res.ok && res.sessionId) {
      const s = res.sessionId
      setIdentity(s, res.memberId ?? null)
      setDraft(emptyDraft())
      nav(`/s/${s}?share=1`, true)
    } else {
      setFailed(res.error ?? 'Payment failed. Your seats were not held.')
      if (res.error?.includes('no longer available')) toast(res.error, 'error')
    }
  }

  if (failed) {
    return (
      <div className="bg-white min-h-dvh">
        <Header title="Payment failed" onBack={() => setFailed(null)} />
        <div className="p-6 text-center">
          <div className="w-14 h-14 rounded-full bg-err-soft text-err grid place-items-center mx-auto text-2xl mb-3">!</div>
          <h2 className="text-[18px] font-semibold mb-1">{failed}</h2>
          <p className="text-[13px] text-sub mb-6">No group session was created and nobody was invited. You haven't been charged.</p>
          <div className="grid gap-2">
            <Button onClick={() => { setFailed(null); setPay(true) }}>Try again</Button>
            <Button variant="outline" onClick={() => { setFailed(null); nav('/seats') }}>Back to seats</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Header title="Review and pay" sub={`${draft.seats.length} seats · group booking`} onBack={() => nav('/members')} />
      <div className="sect p-4 flex gap-3">
        <Poster small />
        <div className="text-[13px]">
          <div className="font-semibold text-[15px]">{db.show.movie}</div>
          <div className="text-sub">{db.show.cinema}</div>
          <div className="text-sub">{fmtDate(db.show.startsAt)} · {fmtTime(db.show.startsAt)} · {db.show.screen}</div>
        </div>
      </div>
      <Divider />
      <div className="sect">
        <div className="px-4 pt-3 pb-1 text-[12px] text-sub">Who sits where</div>
        <div className="px-4 py-2 flex items-center gap-3"><SeatTag id={hostSeat} /><div className="flex-1 text-[14px]">{firstName(profile.name)} (you)</div></div>
        {others.map((x) => {
          const c = draft.assign[x]
          return <div key={x} className="px-4 py-2 flex items-center gap-3"><SeatTag id={x} open={!c} /><div className={`flex-1 text-[14px] ${c ? '' : 'text-sub'}`}>{c ? c.name : 'Open seat'}</div><div className="text-[13px] text-sub">{inr(price)}</div></div>
        })}
        <div className="h-2" />
      </div>
      <Divider />
      <div className="sect p-4 text-[13px] space-y-2">
        {variant === 'A' ? (
          <>
            <Row a={`Your seat (${hostSeat})`} b={inr(price)} />
            <Row a={`Friends pay for their own seats`} b={`${others.length} × ${inr(price)}`} muted />
          </>
        ) : (
          <>
            <Row a={`All ${draft.seats.length} seats`} b={inr(total)} />
            <Row a="Friends pay you back in the session" b={`${others.length} × ${inr(price)}`} muted />
          </>
        )}
        <Row a="Group booking fee" b="₹0" muted />
        <div className="flex justify-between pt-2 border-t border-line text-[15px] font-semibold"><span>You pay now</span><span>{inr(amount)}</span></div>
      </div>
      <Divider />
      <div className="sect p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="text-[15px] font-bold">How it works</div>
          <div className="h-8 px-3 rounded-full bg-amber-soft text-amber-ink text-[12px] font-bold flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2M9 2h6" /></svg>
            {hold ?? '—'}:00 {variant === 'A' ? 'hold' : 'to pay back'}
          </div>
        </div>
        <ol className="relative">
          {(variant === 'A'
            ? [
                ['card', `You pay ${inr(amount)}`, 'Your seat is confirmed'],
                ['people', 'Friends pay their share', 'Each seat confirmed instantly'],
                ['clock', `When ${hold}:00 ends`, 'Pay, pass on or release unpaid seats'],
              ]
            : [
                ['card', `You pay ${inr(amount)}`, 'Every seat is confirmed now'],
                ['people', 'Friends pay you back', `Within ${hold} min, in the app`],
                ['bell', 'See who still owes', 'Send reminders any time'],
              ]
          ).map(([icon, title, sub], i, arr) => (
            <li key={title} className="relative flex gap-3 pb-4 last:pb-0">
              {i < arr.length - 1 && <span className="absolute left-[19px] top-10 bottom-0 w-0.5 bg-line" aria-hidden="true" />}
              <span className={`w-10 h-10 rounded-2xl grid place-items-center shrink-0 ${i === 0 ? 'bg-brand text-white' : 'bg-brand-soft text-brand'}`}><StepIcon name={icon} /></span>
              <div className="pt-0.5">
                <div className="text-[14px] font-semibold">{title}</div>
                <div className="text-[12px] text-sub">{sub}</div>
              </div>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-1.5 mt-4">
          {(variant === 'A' ? ['Paid seats are never lost', '+10 min, once', 'No extra fee'] : ['Nobody loses a seat', 'Reminders built in', 'No extra fee']).map((t) => (
            <span key={t} className="h-7 px-2.5 rounded-full bg-ok-soft text-ok-ink text-[11px] font-semibold flex items-center gap-1">✓ {t}</span>
          ))}
        </div>
        {hold !== null && hold < db.config.holdMinutes && <div className="mt-3 rounded-2xl bg-amber-soft text-amber-ink text-[12px] px-3 py-2">Hold shortened to {hold} min: it must end 30 min before the show.</div>}
        <details className="mt-3 group">
          <summary className="list-none cursor-pointer text-[12px] font-semibold text-sub flex items-center gap-1">More rules <span className="transition group-open:rotate-180">⌄</span></summary>
          <ul className="mt-2 text-[12px] text-sub space-y-1">
            {variant === 'A' ? (
              <li>· If you don't decide within 2 minutes of the timer ending, unpaid seats are released.</li>
            ) : (
              <li>· If someone doesn't pay you back, the money isn't refunded to you automatically.</li>
            )}
            <li>· One group booking at a time.</li>
            <li>· You can move unpaid seats; a paid seat moves only if that friend agrees.</li>
          </ul>
        </details>
      </div>
      <BottomBar>
        <Button className="w-full" onClick={() => setPay(true)} disabled={hold === null}>
          {variant === 'A' ? `Pay ${inr(amount)} for my seat` : `Pay ${inr(amount)} for all seats`}
        </Button>
      </BottomBar>
      <PaySheet
        open={pay} amount={amount} title={variant === 'A' ? 'Pay for your seat' : 'Pay for all seats'} onClose={() => setPay(false)} onResult={onResult}
        lines={variant === 'A' ? [[`Seat ${hostSeat}`, inr(price)]] : [[`${draft.seats.length} seats`, inr(total)]]}
      />
    </div>
  )
}

function StepIcon({ name }: { name: string }) {
  const p = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  if (name === 'card') return <svg {...p}><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M3 10h18M7 15h4" /></svg>
  if (name === 'people') return <svg {...p}><circle cx="9" cy="8" r="3.5" /><circle cx="17" cy="9" r="2.5" /><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M15 14.6c2.8-.3 5 1.3 6 4.4" /></svg>
  if (name === 'bell') return <svg {...p}><path d="M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 003.4 0" /></svg>
  return <svg {...p}><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2M9 2h6" /></svg>
}

function Row({ a, b, muted }: { a: string; b: string; muted?: boolean }) {
  return <div className={`flex justify-between ${muted ? 'text-sub' : ''}`}><span>{a}</span><span>{b}</span></div>
}
