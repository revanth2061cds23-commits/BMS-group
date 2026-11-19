import { useStore } from '../store'
import { Avatar, Button, Card, Header, Pill } from '../components/ui'
import { firstName, fmtDate, fmtTime, host, inr, initials, isActive, log, normPhone, outcomeLabel, owingMembers, seatDisplay } from '../logic'
import type { Group } from '../types'

/* ---------------- 12. Saved groups and history ---------------- */

export function History() {
  const { db, nav, profile, setDraft, act } = useStore()
  const mine = Object.values(db.sessions)
    .filter((s) => s.members.some((m) => m.phone === normPhone(profile.phone)))
    .sort((a, b) => b.createdAt - a.createdAt)

  const bookWith = (g: Group) => {
    setDraft({ seats: [], assign: {}, hostSeat: null, groupName: g.name, prefill: g.members })
    nav('/seats')
  }

  return (
    <div>
      <Header title="Group bookings" sub={`${profile.name}`} onBack={() => nav('/')} />
      <div className="p-3 space-y-3">
        <div className="text-[12px] text-sub px-1">Saved groups</div>
        {db.groups.slice().sort((a, b) => b.lastUsedAt - a.lastUsedAt).map((g) => (
          <Card key={g.id} className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[14px] font-semibold">{g.name}</div>
                <div className="text-[11px] text-sub">{g.members.length} people · last used {fmtDate(g.lastUsedAt)}</div>
              </div>
              <div className="flex items-center gap-1">
                <button className="text-[12px] text-sub px-2 h-8" aria-label={`Delete ${g.name}`} onClick={() => { if (confirm(`Delete "${g.name}"?`)) act((d) => { d.groups = d.groups.filter((x) => x.id !== g.id) }) }}>Delete</button>
                <Button variant="outline" className="!h-8 text-[12px]" onClick={() => bookWith(g)}>Book with them</Button>
              </div>
            </div>
            <div className="flex -space-x-1.5 mt-2">
              {g.members.map((m) => <Avatar key={m.phone} name={m.name} initials={initials(m.name)} size={26} ring="#fff" />)}
            </div>
          </Card>
        ))}
        <div className="text-[12px] text-sub px-1 pt-2">Past and current sessions</div>
        {mine.length === 0 && <Card className="p-4 text-[13px] text-sub text-center">No group bookings yet.</Card>}
        {mine.map((s) => {
          const h = host(s)
          const owing = owingMembers(s)
          return (
            <Card key={s.id} className="p-3">
              <button className="w-full text-left" onClick={() => nav(`/s/${s.id}`)}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[14px] font-semibold">{s.show.movie}</div>
                    <div className="text-[11px] text-sub">{fmtDate(s.show.startsAt)} · {fmtTime(s.show.startsAt)} · hosted by {h.phone === normPhone(profile.phone) ? 'you' : firstName(h.name)} · {s.variant === 'A' ? 'each paid own share' : 'host paid upfront'}</div>
                  </div>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${isActive(s) ? 'bg-[#fff0f3] text-brand' : s.status === 'confirmed' || (s.status === 'settled' && !owing.length) ? 'bg-[#e6f6ea] text-[#137a2c]' : s.status === 'cancelled' ? 'bg-[#eef0f6] text-[#555a72]' : 'bg-[#fff4e0] text-[#a86500]'}`}>{outcomeLabel(s)}</span>
                </div>
                <div className="mt-2 space-y-1">
                  {s.seats.map((seat) => {
                    const m = s.members.find((x) => x.id === seat.memberId)
                    return (
                      <div key={seat.id} className="flex items-center gap-2 text-[12px]">
                        <span className="w-8 text-sub">{seat.id}</span>
                        <span className="flex-1">{m ? firstName(m.name) : '—'}</span>
                        <Pill kind={seatDisplay(s, seat)} />
                      </div>
                    )
                  })}
                </div>
                {owing.length > 0 && !isActive(s) && <div className="mt-2 text-[12px] text-[#a86500]">Outstanding: {inr(owing.length * s.show.pricePerSeat)} from {owing.map((m) => firstName(m.name)).join(', ')}</div>}
              </button>
              {h.phone === normPhone(profile.phone) && !isActive(s) && (
                <Button variant="ghost" className="!h-9 w-full mt-1 text-[13px]" onClick={() => {
                  const people = s.members.filter((m) => !m.isHost && s.seats.some((x) => x.memberId === m.id)).map((m) => ({ name: m.name, phone: m.phone }))
                  setDraft({ seats: [], assign: {}, hostSeat: null, prefill: people })
                  act((d, n) => { log(d, n, d.sessions[s.id], h.name, 'book_again', { people: people.length }) })
                  nav('/seats')
                }}>Book again</Button>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
