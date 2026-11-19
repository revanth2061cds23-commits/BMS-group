import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { useStore } from '../store'
import { Button, Header, Sheet } from '../components/ui'
import { firstName, fmtDate, fmtTime, host, inr, memberById, memberLeaveAfterPaying, seatOf, isActive } from '../logic'
import { Poster } from './Host'
import { MoveRequestCard } from './Session'

/* ---------------- 9. Member confirmation: ticket (A) or repayment receipt (B) ---------------- */

export function TicketScreen({ sid }: { sid: string }) {
  const { db, identity, nav, act } = useStore()
  const s = db.sessions[sid]
  const me = s && memberById(s, identity(sid))
  const seat = s && me && seatOf(s, me.id)
  const [qr, setQr] = useState('')
  const [leave, setLeave] = useState(false)
  const code = s && seat ? `GB-${s.id.slice(0, 5).toUpperCase()}-${seat.id}` : ''
  useEffect(() => { if (code) QRCode.toDataURL(code, { margin: 1, width: 220 }).then(setQr).catch(() => {}) }, [code])

  if (!s || !me) { nav(`/s/${sid}`, true); return null }
  const h = host(s)
  const ticket = s.variant === 'A' || me.isHost
  const paid = seat && (s.variant === 'A' ? seat.state === 'paid' : me.isHost || me.status === 'paid')

  return (
    <div>
      <Header title={ticket ? 'Your ticket' : 'Repayment receipt'} onBack={() => nav(`/s/${sid}`)} />
      <div className="p-4">
        <div className="mb-3 empty:hidden"><MoveRequestCard s={s} me={me} /></div>
        {!seat || !paid ? (
          <div className="bg-white rounded-lg border border-line p-5 text-center">
            <div className="text-[16px] font-semibold">No ticket yet</div>
            <div className="text-[13px] text-sub mt-1">{me.status === 'left' ? 'You left this booking. Your refund follows the cancellation policy.' : 'Pay for your seat to get your ticket.'}</div>
            <Button className="mt-4" onClick={() => nav(`/s/${sid}`)}>Back to the group</Button>
          </div>
        ) : (
          <>
            <div className="text-center mb-3">
              <div className="w-12 h-12 rounded-full bg-[#e6f6ea] text-ok grid place-items-center mx-auto text-xl font-bold">✓</div>
              <div className="text-[17px] font-semibold mt-2">
                {ticket ? (seat.coveredByHost && !me.isHost && me.status !== 'paid' ? `${firstName(h.name)} paid for your seat` : "You're in!") : `You paid ${firstName(h.name)} back`}
              </div>
              <div className="text-[12px] text-sub">{ticket ? 'Show this at the entrance. It is your own ticket.' : `Your seat is part of ${firstName(h.name)}'s booking.`}</div>
            </div>
            <div className="bg-white rounded-xl border border-line overflow-hidden">
              <div className="p-4 flex gap-3">
                <Poster small />
                <div className="text-[13px] min-w-0">
                  <div className="font-semibold text-[15px]">{s.show.movie}</div>
                  <div className="text-sub">{s.show.language}</div>
                  <div className="mt-1">{fmtDate(s.show.startsAt)} · {fmtTime(s.show.startsAt)}</div>
                  <div className="text-sub truncate">{s.show.cinema}</div>
                </div>
              </div>
              <div className="relative border-t border-dashed border-[#cfd0da] mx-3">
                <span className="absolute -left-6 -top-3 w-6 h-6 rounded-full bg-surface" /><span className="absolute -right-6 -top-3 w-6 h-6 rounded-full bg-surface" />
              </div>
              {ticket ? (
                <div className="p-4 flex items-center gap-4">
                  {qr ? <img src={qr} alt={`Ticket QR code ${code}`} className="w-28 h-28" /> : <div className="w-28 h-28 bg-surface" />}
                  <div className="text-[13px] space-y-1">
                    <div><span className="text-sub">Name</span><br /><span className="font-medium">{me.name}</span></div>
                    <div><span className="text-sub">{s.show.screen} · Seat</span><br /><span className="font-semibold text-[18px]">{seat.id}</span></div>
                    <div className="text-[11px] text-sub">Booking ID {code}</div>
                  </div>
                </div>
              ) : (
                <div className="p-4 text-[13px] space-y-2">
                  <Line a="Paid to" b={h.name} />
                  <Line a="For seat" b={seat.id} />
                  <Line a="Amount" b={inr(s.show.pricePerSeat)} />
                  <Line a="Paid at" b={me.paidAt ? fmtTime(me.paidAt) : '-'} />
                  <Line a="Receipt" b={code.replace('GB', 'RP')} />
                </div>
              )}
            </div>
            <div className="grid gap-2 mt-4">
              <Button onClick={() => nav(`/s/${sid}`)}>{isActive(s) ? 'Back to the live group' : 'See how the group did'}</Button>
              {!me.isHost && <Button variant="ghost" onClick={() => setLeave(true)}>{s.variant === 'A' ? 'Cancel my ticket' : 'Leave the group'}</Button>}
            </div>
          </>
        )}
      </div>
      <Sheet open={leave} onClose={() => setLeave(false)} title={s.variant === 'A' ? 'Cancel your ticket?' : 'Leave the group?'}>
        <p className="text-[13px] text-sub mb-4">
          {s.variant === 'A'
            ? `The cinema's usual cancellation policy applies to your ticket only. ${seat?.id} becomes an open seat that ${firstName(h.name)} can pass on.`
            : `${seat?.id} becomes an open seat. Sort your repayment out with ${firstName(h.name)}.`}
        </p>
        <div className="grid gap-2">
          <Button variant="danger" onClick={async () => { await act((d, n) => { memberLeaveAfterPaying(d, n, sid, me.id) }); setLeave(false); nav(`/s/${sid}`) }}>Yes, {s.variant === 'A' ? 'cancel ticket' : 'leave'}</Button>
          <Button variant="ghost" onClick={() => setLeave(false)}>Keep my seat</Button>
        </div>
      </Sheet>
    </div>
  )
}

function Line({ a, b }: { a: string; b: string }) {
  return <div className="flex justify-between"><span className="text-sub">{a}</span><span className="font-medium">{b}</span></div>
}
