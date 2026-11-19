import { useEffect, useMemo, useState } from 'react'
import { useStore, emptyDraft } from '../store'
import { BottomBar, BrandBar, Button, Card, Divider, Field, Header, Sheet, Avatar } from '../components/ui'
import { Legend, SeatMap, type SeatLook } from '../components/SeatMap'
import { PaySheet } from '../components/PaySheet'
import {
  activeSessionForHost, createSession, firstName, fmtDate, fmtTime, holdMinutesFor, initials, inr, isActive, normPhone, soldSet, type CreateResult,
} from '../logic'
import { CONTACTS, MAX_SEATS } from '../seed'
import type { SavedContact } from '../types'

export function Poster({ small }: { small?: boolean }) {
  return (
    <div className={`${small ? 'w-14 h-20 text-[9px]' : 'w-24 h-36 text-[12px]'} rounded-md shrink-0 overflow-hidden relative bg-[linear-gradient(160deg,#ffb36b_0%,#f84464_45%,#3b2a6b_100%)]`}>
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
      <div className="bg-white p-4 flex gap-4">
        <Poster />
        <div className="min-w-0">
          <h1 className="text-[18px] font-semibold leading-tight">{show.movie}</h1>
          <div className="text-[12px] text-sub mt-1">{show.certificate} · {show.language}</div>
          <div className="mt-3 text-[13px] font-medium">{show.cinema}</div>
          <div className="text-[12px] text-sub">{show.screen}</div>
          <div className="mt-2 inline-flex items-center gap-2 rounded-md border border-ok text-ok text-[13px] font-medium px-2.5 py-1">
            {fmtDate(show.startsAt)} · {fmtTime(show.startsAt)}
          </div>
          <div className="text-[11px] text-sub mt-1">Starts in {minsToShow >= 60 ? `${Math.floor(minsToShow / 60)}h ${minsToShow % 60}m` : `${minsToShow} min`}</div>
        </div>
      </div>
      <Divider />
      {active && (
        <button onClick={() => nav(`/s/${active.id}`)} className="w-full text-left bg-[#fff0f3] border-y border-[#ffd3dc] px-4 py-3">
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
            <div className="w-9 h-9 rounded-full bg-[#fff0f3] grid place-items-center text-brand shrink-0">
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
    if (!group) { toast('Regular checkout is outside this prototype. Turn on Book with friends.', 'info'); return }
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
      <div className="p-3 border-b border-line">
        <button onClick={toggleGroup} className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left ${group ? 'border-brand bg-[#fff5f7]' : 'border-line'} ${hold === null ? 'opacity-60' : ''}`} role="switch" aria-checked={group}>
          <div className="flex-1">
            <div className="text-[14px] font-semibold">Book with friends</div>
            <div className="text-[12px] text-sub">
              {hold === null
                ? 'Unavailable: the show starts too soon'
                : variant === 'A' ? 'Hold seats for your group. Each friend pays for their own seat.' : 'Pay for everyone now. Friends pay you back in the app.'}
            </div>
          </div>
          <span className={`w-11 h-6 rounded-full relative transition ${group ? 'bg-brand' : 'bg-[#c9cad6]'}`}>
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${group ? 'left-[22px]' : 'left-0.5'}`} />
          </span>
        </button>
      </div>
      <div className="py-4 px-2">
        <SeatMap look={look} onTap={tap} price={db.show.pricePerSeat} />
      </div>
      <div className="px-4 pb-2"><Legend items={[['available', 'Available'], ['selected', 'Selected'], ['sold', 'Sold']]} /></div>
      {sel.length >= max && <div className="mx-4 mt-2 text-[12px] text-center text-[#a86500] bg-[#fff4e0] rounded-md py-2">Group sessions allow up to 10 seats</div>}
      <BottomBar>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="text-[15px] font-semibold">{sel.length ? inr(sel.length * db.show.pricePerSeat) : 'Pick seats'}</div>
            <div className="text-[12px] text-sub">{group ? `${sel.length}/${max} seats` : `${sel.length} seats`}{sel.length ? ` · ${sel.join(', ')}` : ''}</div>
          </div>
          <Button onClick={proceed} disabled={!sel.length}>{group ? 'Add friends' : 'Pay'}</Button>
        </div>
      </BottomBar>
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

  return (
    <div>
      <Header title="Add friends" sub={`${draft.seats.length} seats · assign a seat to each friend`} onBack={() => nav('/seats')} />
      <div className="bg-white p-4">
        <div className="text-[12px] text-sub mb-2">Saved groups</div>
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1">
          {db.groups.slice().sort((a, b) => b.lastUsedAt - a.lastUsedAt).map((g) => (
            <button key={g.id} onClick={() => useGroup(g.id)} className={`shrink-0 h-9 px-3 rounded-full border text-[13px] ${draft.groupName === g.name ? 'border-brand text-brand bg-[#fff5f7]' : 'border-line'}`}>
              {g.name} · {g.members.length}
            </button>
          ))}
        </div>
      </div>
      <Divider />
      <div className="bg-white">
        <div className="px-4 pt-3 pb-1 text-[12px] text-sub">Seats ({assigned.length} of {others.length} friends added)</div>
        <div className="px-4 py-2.5 flex items-center gap-3 border-b border-line">
          <SeatTag id={hostSeat} />
          <Avatar name={profile.name} initials={initials(profile.name)} size={28} />
          <div className="flex-1 text-[14px]">{firstName(profile.name)} <span className="text-sub">(you)</span></div>
          {draft.seats.length > 1 && (
            <select aria-label="Choose your seat" className="text-[12px] text-brand bg-transparent" value={hostSeat} onChange={(e) => {
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
            <div key={seat} className={`px-4 py-2.5 flex items-center gap-3 border-b border-line ${pickFor === seat ? 'bg-[#fff5f7]' : ''}`}>
              <SeatTag id={seat} open={!c} />
              {c ? (
                <>
                  <Avatar name={c.name} initials={initials(c.name)} size={28} />
                  <div className="flex-1 min-w-0"><div className="text-[14px] truncate">{c.name}</div><div className="text-[11px] text-sub">{c.phone}</div></div>
                  <button className="text-[12px] text-sub px-2" onClick={() => setDraft({ ...draft, assign: { ...draft.assign, [seat]: null } })} aria-label={`Remove ${c.name}`}>Remove</button>
                </>
              ) : (
                <>
                  <div className="flex-1 text-[14px] text-sub">Open seat</div>
                  <button className="text-[12px] text-brand font-medium px-2" onClick={() => setPickFor(pickFor === seat ? null : seat)}>{pickFor === seat ? 'Choosing…' : 'Assign'}</button>
                </>
              )}
            </div>
          )
        })}
        <div className="px-4 py-2 text-[11px] text-sub">Open seats can be claimed by anyone with the link.</div>
      </div>
      <Divider />
      <div className="bg-white p-4">
        <div className="text-[12px] text-sub mb-2">Add by name and number{pickFor ? ` to ${pickFor}` : ''}</div>
        <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
          <input className="h-10 px-3 rounded-lg border border-line text-[14px] min-w-0" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="h-10 px-3 rounded-lg border border-line text-[14px] min-w-0" placeholder="Phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Button variant="outline" className="!h-10" onClick={addManual}>Add</Button>
        </div>
      </div>
      <Divider />
      <div className="bg-white">
        <div className="px-4 pt-3 pb-1 text-[12px] text-sub">Contacts{pickFor ? ` · choosing for ${pickFor}` : ''}</div>
        {CONTACTS.map((c) => {
          const added = isAdded(c)
          return (
            <button key={c.phone} onClick={() => assign(c, pickFor ?? undefined)} className="w-full px-4 py-2.5 flex items-center gap-3 border-b border-line text-left">
              <Avatar name={c.name} initials={initials(c.name)} size={32} />
              <div className="flex-1"><div className="text-[14px]">{c.name}</div><div className="text-[11px] text-sub">{c.phone}</div></div>
              <span className={`text-[12px] font-medium ${added ? 'text-ok' : 'text-brand'}`}>{added ? `✓ ${assigned.find(([, v]) => normPhone(v.phone) === normPhone(c.phone))?.[0]}` : 'Add'}</span>
            </button>
          )
        })}
      </div>
      <BottomBar>
        <Button className="w-full" onClick={() => nav('/review')}>
          Review · {assigned.length} friend{assigned.length === 1 ? '' : 's'}{others.length - assigned.length ? `, ${others.length - assigned.length} open` : ''}
        </Button>
      </BottomBar>
    </div>
  )
}

export function SeatTag({ id, open, tone }: { id: string; open?: boolean; tone?: string }) {
  return <span className={`w-10 h-7 shrink-0 rounded-md grid place-items-center text-[12px] font-semibold ${tone ?? (open ? 'border border-dashed border-amber text-[#a86500]' : 'bg-ok text-white')}`}>{id}</span>
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
          <div className="w-14 h-14 rounded-full bg-[#fdecea] text-err grid place-items-center mx-auto text-2xl mb-3">!</div>
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
      <div className="bg-white p-4 flex gap-3">
        <Poster small />
        <div className="text-[13px]">
          <div className="font-semibold text-[15px]">{db.show.movie}</div>
          <div className="text-sub">{db.show.cinema}</div>
          <div className="text-sub">{fmtDate(db.show.startsAt)} · {fmtTime(db.show.startsAt)} · {db.show.screen}</div>
        </div>
      </div>
      <Divider />
      <div className="bg-white">
        <div className="px-4 pt-3 pb-1 text-[12px] text-sub">Who sits where</div>
        <div className="px-4 py-2 flex items-center gap-3"><SeatTag id={hostSeat} /><div className="flex-1 text-[14px]">{firstName(profile.name)} (you)</div></div>
        {others.map((x) => {
          const c = draft.assign[x]
          return <div key={x} className="px-4 py-2 flex items-center gap-3"><SeatTag id={x} open={!c} /><div className={`flex-1 text-[14px] ${c ? '' : 'text-sub'}`}>{c ? c.name : 'Open seat'}</div><div className="text-[13px] text-sub">{inr(price)}</div></div>
        })}
        <div className="h-2" />
      </div>
      <Divider />
      <div className="bg-white p-4 text-[13px] space-y-2">
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
      <div className="bg-white p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-11 h-11 rounded-full bg-surface grid place-items-center text-[13px] font-semibold tabular-nums">{hold ?? '—'}<span className="sr-only">minutes</span></div>
          <div className="text-[13px]">
            <div className="font-semibold">{variant === 'A' ? `Seats held for ${hold}:00` : `${hold}:00 to pay you back`}</div>
            <div className="text-sub">{variant === 'A' ? 'Starts when you pay. Friends see the same timer.' : 'All seats are confirmed as soon as you pay.'}</div>
            {hold !== null && hold < db.config.holdMinutes && <div className="text-[#a86500] text-[12px] mt-0.5">Shortened: holds must end 30 minutes before the show.</div>}
          </div>
        </div>
        <ul className="text-[12px] text-sub space-y-1.5 list-disc pl-4">
          {variant === 'A' ? (
            <>
              <li>Your seat is confirmed now. Each friend's seat is confirmed the moment they pay.</li>
              <li>A paid seat is never lost because someone else didn't pay.</li>
              <li>When the timer ends you choose for each unpaid seat: pay for it, pass it on, or release it. You can extend once by 10 minutes.</li>
              <li>If you don't decide within 2 minutes, unpaid seats are released.</li>
            </>
          ) : (
            <>
              <li>You pay for every seat now, so nobody can lose their seat.</li>
              <li>Friends pay you back through the session. You'll see who has paid and who still owes.</li>
              <li>Money isn't refunded to you automatically if someone doesn't pay. You can keep sending reminders.</li>
            </>
          )}
          <li>One active group session at a time. You can move unpaid seats; paid seats move only if that friend agrees.</li>
        </ul>
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

function Row({ a, b, muted }: { a: string; b: string; muted?: boolean }) {
  return <div className={`flex justify-between ${muted ? 'text-sub' : ''}`}><span>{a}</span><span>{b}</span></div>
}
