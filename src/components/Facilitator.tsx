import { useState, type ReactNode } from 'react'
import { useStore } from '../store'
import { Button } from './ui'
import {
  AUTO_RELEASE_MS, answerMove, cancelSession, firstName, fmtClock, fmtTime, isActive, log, memberById, memberDecline, memberLeaveAfterPaying,
  memberPay, outcomeLabel, seatOf, setSpeed, tick, MIN,
} from '../logic'
import { freshDB, makeShow } from '../seed'
import type { DB, Session } from '../types'

const csvCell = (v: unknown) => {
  const s = typeof v === 'string' ? v : JSON.stringify(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
function download(name: string, rows: unknown[][]) {
  const blob = new Blob([rows.map((r) => r.map(csvCell).join(',')).join('\n')], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export function summarize(db: DB, s: Session) {
  const ev = db.events.filter((e) => e.sessionId === s.id)
  const lastPay = Math.max(0, ...s.members.filter((m) => !m.isHost && m.paidAt).map((m) => m.paidAt!))
  const expiryActions = ev.filter((e) => e.type === 'resolution_action' || e.type === 'extension_used').map((e) => e.type === 'extension_used' ? 'extend' : String(e.payload.action))
  return {
    sessionId: s.id, variant: s.variant, outcome: outcomeLabel(s), status: s.status, seats: s.seats.length,
    paidSeats: s.variant === 'A' ? s.seats.filter((x) => x.state === 'paid').length : s.members.filter((m) => m.status === 'paid' && seatOf(s, m.id)).length,
    completed: s.status === 'confirmed' || (s.status === 'settled' && !s.members.some((m) => !m.isHost && m.status !== 'paid' && seatOf(s, m.id))),
    minutesToLastPayment: lastPay ? +((lastPay - s.createdAt) / MIN).toFixed(1) : '',
    remindersAuto: ev.filter((e) => e.type === 'reminder_auto').length,
    nudges: ev.filter((e) => e.type === 'nudge_sent').length,
    expiryActions: expiryActions.join(' '),
    createdAt: new Date(s.createdAt).toISOString(),
  }
}

export function Facilitator() {
  const { db, act, now, facOpen, setFacOpen, path, offset, backend, simOffline, setSimOffline, toast, setIdentity, identity } = useStore()
  const sessions = Object.values(db.sessions).sort((a, b) => b.createdAt - a.createdAt)
  const onScreen = path.match(/^\/s\/([^/]+)/)?.[1]
  const [pick, setPick] = useState<string | null>(null)
  const sid = pick && db.sessions[pick] ? pick : onScreen && db.sessions[onScreen] ? onScreen : sessions.find(isActive)?.id ?? sessions[0]?.id
  const s = sid ? db.sessions[sid] : undefined
  const others = s?.members.filter((m) => !m.isHost) ?? []
  const [mid, setMid] = useState<string>('')
  const m = s && (memberById(s, mid) ?? others.find((x) => seatOf(s, x.id) && x.status !== 'paid') ?? others[0])
  const [tab, setTab] = useState<'controls' | 'cases' | 'survey'>('controls')

  if (!facOpen) return null
  const runOn = (fn: (d: DB, n: number, s: Session) => unknown, msg?: string) => act((d, n) => {
    const ss = d.sessions[sid!]
    if (!ss) return false
    const r = fn(d, n, ss)
    log(d, n, ss, 'facilitator', 'facilitator_action', { msg: msg ?? '' })
    return r === false ? false : undefined
  }).then((ok) => { if (!ok) toast('Not available for this session right now', 'warn') })

  const memberAct = async (kind: 'pay' | 'fail' | 'decline' | 'open' | 'late' | 'leave' | 'grace') => {
    if (!s || !m) { toast('No member selected', 'warn'); return }
    let err: string | undefined
    await act((d, n) => {
      const ss = d.sessions[s.id]
      const mm = memberById(ss, m.id)!
      if (kind === 'pay' || kind === 'fail') { const r = memberPay(d, n, s.id, m.id, kind === 'pay'); if (!r.ok && kind === 'pay') err = r.error }
      if (kind === 'decline') memberDecline(d, n, s.id, m.id)
      if (kind === 'leave') memberLeaveAfterPaying(d, n, s.id, m.id)
      if (kind === 'open' || kind === 'late') { mm.joinedAt = mm.joinedAt ?? n; log(d, n, ss, mm.name, 'link_opened', { memberId: mm.id, simulated: true, late: kind === 'late', status: ss.status }) }
      if (kind === 'grace') {
        // E7: checkout opened just before expiry, payment lands just after
        if (ss.status !== 'live') { err = 'Session must be live'; return false }
        mm.payingSince = n - 5000
        ss.expiresAt = n - 2000
        tick(d, n)
        const r = memberPay(d, n + 20000, s.id, m.id, true)
        if (!r.ok) err = r.error
      }
    })
    if (err) toast(err, 'error')
    if (kind === 'late') { toast(`Opening ${firstName(m.name)}'s view in a new tab`, 'info'); window.open(`/s/${s.id}?as=${m.id}`, '_blank') }
  }

  return (
    <div className="fixed inset-0 z-[70] flex justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={() => setFacOpen(false)} />
      <div className="absolute bottom-0 w-full max-w-[390px] h-[90dvh] bg-[#1d1e29] text-white rounded-t-2xl flex flex-col anim-up">
        <div className="px-4 pt-3 pb-2 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[15px] font-semibold">Facilitator panel</div>
              <div className="text-[11px] text-white/50">{backend.kind === 'supabase' ? 'Shared realtime database' : 'Local mode (this browser only)'} · sim {fmtTime(now)} · {db.config.clock.speed}×{offset ? ` · clock offset ${Math.round(offset)}ms` : ''}</div>
            </div>
            <button onClick={() => setFacOpen(false)} className="w-8 h-8 rounded-full bg-white/10" aria-label="Close facilitator panel">✕</button>
          </div>
          <div className="flex gap-1 mt-3">
            {(['controls', 'cases', 'survey'] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`flex-1 h-8 rounded-lg text-[12px] ${tab === t ? 'bg-brand' : 'bg-white/10'}`}>{t === 'controls' ? 'Controls' : t === 'cases' ? 'Edge cases' : 'Survey & data'}</button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-5 text-[13px]">
          {tab === 'controls' && (
            <>
              <Section title="Next new session">
                <Row label="Fallback variant (the host now chooses in the app)">
                  <Seg value={db.config.variant} options={[['A', 'A · own share'], ['B', 'B · host upfront']]} onChange={(v) => act((d, n) => { d.config.variant = v as 'A' | 'B'; log(d, n, null, 'facilitator', 'variant_set', { variant: v }) })} />
                </Row>
                <Row label={`Hold length: ${db.config.holdMinutes} min`}>
                  <input type="range" min={10} max={60} step={5} value={db.config.holdMinutes} onChange={(e) => act((d) => { d.config.holdMinutes = +e.target.value })} className="w-full accent-[#F84464]" />
                </Row>
                <Row label="Show starts">
                  <Seg value={String(db.config.minutesToShow)} options={[['0', '19 Dec 11:20 PM'], ['60', 'In 60 m'], ['45', 'In 45 m'], ['35', 'In 35 m']]}
                    onChange={(v) => act((d, n) => { d.config.minutesToShow = +v; d.show = makeShow(n, +v) })} />
                </Row>
                <Toggle label="Allow one 10-min extension" sub="Off = high-demand show" value={db.config.extensionAllowed} onChange={(v) => act((d) => { d.config.extensionAllowed = v })} />
              </Section>
              <Section title="Time (shared by every phone)">
                <Row label="Speed"><Seg value={String(db.config.clock.speed)} options={[['1', '1×'], ['10', '10×'], ['60', '60×']]} onChange={(v) => act((d) => { setSpeed(d, offset, +v) })} /></Row>
              </Section>
              <Section title={s ? `Session ${s.id.slice(0, 5)} · Variant ${s.variant} · ${outcomeLabel(s)}` : 'No session yet'}>
                {sessions.length > 1 && (
                  <select className="w-full h-9 rounded-lg bg-white/10 px-2 mb-2" value={sid} onChange={(e) => setPick(e.target.value)}>
                    {sessions.map((x) => <option key={x.id} value={x.id} className="text-black">{x.id.slice(0, 5)} · {x.variant} · {x.members[0]?.name} · {outcomeLabel(x)}</option>)}
                  </select>
                )}
                {s && (
                  <>
                    {s.status === 'live' && <div className="text-white/60 mb-2">Time left {fmtClock(s.expiresAt - now)}</div>}
                    <div className="grid grid-cols-2 gap-2">
                      <Btn onClick={() => runOn((_, n, ss) => { if (ss.status !== 'live') return false; ss.expiresAt = n + MIN }, 'Jumped to 1 minute left')}>Jump to 1 min left</Btn>
                      <Btn onClick={() => runOn((_, n, ss) => { if (ss.status !== 'live') return false; ss.expiresAt = n }, 'Expired')}>Expire now</Btn>
                      <Btn onClick={() => runOn((_, n, ss) => { if (ss.status !== 'expired') return false; ss.expiredAt = n - AUTO_RELEASE_MS }, 'Host ran out of time (E2)')}>Skip 2-min decision</Btn>
                      <Btn onClick={() => runOn((d, n) => { cancelSession(d, n, sid!, 'show') }, 'Show cancelled (E20)')}>Cinema cancels show</Btn>
                    </div>
                  </>
                )}
              </Section>
              {s && others.length > 0 && (
                <Section title="Simulate a member">
                  <select className="w-full h-9 rounded-lg bg-white/10 px-2 mb-2" value={m?.id} onChange={(e) => setMid(e.target.value)}>
                    {others.map((x) => <option key={x.id} value={x.id} className="text-black">{x.name} · {seatOf(s, x.id)?.id ?? 'no seat'} · {x.status}</option>)}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <Btn onClick={() => memberAct('pay')}>Pays</Btn>
                    <Btn onClick={() => memberAct('fail')}>Payment fails</Btn>
                    <Btn onClick={() => memberAct('decline')}>Declines</Btn>
                    <Btn onClick={() => memberAct('open')}>Opens the link</Btn>
                    <Btn onClick={() => memberAct('grace')}>Pays in last seconds</Btn>
                    <Btn onClick={() => memberAct('leave')}>Leaves after paying</Btn>
                    <Btn onClick={() => memberAct('late')}>Open their view ↗</Btn>
                    {s.moveRequests.length > 0 && <Btn onClick={() => act((d, n) => { answerMove(d, n, s.id, s.moveRequests[0].id, true) })}>Accept seat move</Btn>}
                  </div>
                  <div className="text-[11px] text-white/50 mt-2">"Open their view" opens a new tab acting as that member. Current tab is {memberById(s, identity(s.id))?.name ?? 'not in this session'}.</div>
                </Section>
              )}
              <Section title="System">
                <Toggle label="Someone takes a seat during selection" sub="Next tap on 'Add friends' loses a seat (E18)" value={db.config.snipeNext} onChange={(v) => act((d) => { d.config.snipeNext = v })} />
                <Toggle label="This phone goes offline" sub="Cached view + banner (E19)" value={simOffline} onChange={setSimOffline} />
                <Button variant="danger" className="w-full !bg-transparent !h-10 mt-2" onClick={async () => {
                  if (!confirm('Reset everything? All sessions, events and saved groups are cleared for every phone.')) return
                  await act((d) => { const keep = { variant: d.config.variant, holdMinutes: d.config.holdMinutes, extensionAllowed: d.config.extensionAllowed, minutesToShow: d.config.minutesToShow }; const f = freshDB(Date.now() + offset, keep); Object.assign(d, f, { version: d.version }) })
                  try { localStorage.removeItem('gb_me'); sessionStorage.clear() } catch { /* ignore */ }
                  if (s) setIdentity(s.id, null)
                  location.href = '/'
                }}>Reset everything</Button>
              </Section>
            </>
          )}
          {tab === 'cases' && <Cases />}
          {tab === 'survey' && <Survey />}
        </div>
      </div>
    </div>
  )
}

function Cases() {
  const cases: [string, string][] = [
    ['E1', 'Expire now with unpaid seats → host sees the resolution sheet'],
    ['E2', 'After expiry, "Skip 2-min decision" → unpaid seats auto-release, everyone notified'],
    ['E3', 'On the resolution sheet tap "Extend 10 min" (once). Turn extensions off to test a busy show'],
    ['E4', 'Expire a session where only the host has paid'],
    ['E5', 'Variant B: Expire now with members still owing → "Settled, n pending"'],
    ['E6', 'Expire + resolve, then "Open their view ↗" for a released member'],
    ['E7', 'Simulate member → "Pays in last seconds" (60 s grace)'],
    ['E8', 'Simulate member → "Payment fails" (seat stays Pending)'],
    ['E9', 'Simulate member → "Declines" (seat becomes Open, host notified)'],
    ['E10', 'Open the link on a 2nd device with the same phone number → same member'],
    ['E11', 'Simulate member → "Leaves after paying"'],
    ['E12', 'On Review and pay, choose "Payment fails"'],
    ['E13', 'As host, tap a paid seat on the session map, then a free seat → move request'],
    ['E14', 'Pick 10 seats in Book with friends, then tap an 11th'],
    ['E15', 'With a live session, start a new booking and turn on Book with friends'],
    ['E16', 'Host taps "Cancel session"'],
    ['E17', 'Set "Show starts in" to 45 m (shorter hold) or 35 m (group mode disabled)'],
    ['E18', 'Turn on "Someone takes a seat…" then tap "Add friends" on the seat map'],
    ['E19', 'Turn on "This phone goes offline"'],
    ['E20', '"Cinema cancels show"'],
  ]
  return (
    <div className="space-y-2">
      <div className="text-white/60 text-[12px]">How to reach each edge case. Use Controls for the buttons.</div>
      {cases.map(([k, v]) => (
        <div key={k} className="flex gap-3 bg-white/5 rounded-lg p-2.5">
          <span className="font-semibold text-brand w-8 shrink-0">{k}</span><span className="text-white/85">{v}</span>
        </div>
      ))}
    </div>
  )
}

function Survey() {
  const { db, act, toast } = useStore()
  const sessions = Object.values(db.sessions).sort((a, b) => b.createdAt - a.createdAt)
  const [sid, setSid] = useState(sessions[0]?.id ?? '')
  const [fair, setFair] = useState(0)
  const [stress, setStress] = useState(0)
  const [note, setNote] = useState('')
  const [pref, setPref] = useState('')
  const [why, setWhy] = useState('')
  const [group, setGroup] = useState('')
  const surveys = db.events.filter((e) => e.type === 'survey_submitted').length

  return (
    <>
      <Section title="Post-round survey">
        <Row label="Group label (e.g. Group 3)"><input className="w-full h-9 rounded-lg bg-white/10 px-2" value={group} onChange={(e) => setGroup(e.target.value)} /></Row>
        <Row label="Session">
          <select className="w-full h-9 rounded-lg bg-white/10 px-2" value={sid} onChange={(e) => setSid(e.target.value)}>
            <option value="" className="text-black">—</option>
            {sessions.map((x) => <option key={x.id} value={x.id} className="text-black">{x.id.slice(0, 5)} · Variant {x.variant} · {outcomeLabel(x)}</option>)}
          </select>
        </Row>
        <Row label="How fair did this feel? (1–5)"><Stars v={fair} set={setFair} /></Row>
        <Row label="How stressful was it for the host? (1–5)"><Stars v={stress} set={setStress} /></Row>
        <Row label="Note"><textarea className="w-full rounded-lg bg-white/10 p-2 h-16" value={note} onChange={(e) => setNote(e.target.value)} /></Row>
        <Button className="w-full !h-10" disabled={!fair || !stress} onClick={async () => {
          await act((d, n) => { log(d, n, d.sessions[sid] ?? null, 'facilitator', 'survey_submitted', { kind: 'round', group, fairness: fair, hostStress: stress, note }) })
          setFair(0); setStress(0); setNote(''); toast('Round survey saved', 'success')
        }}>Save round ratings</Button>
      </Section>
      <Section title="Final preference (after both variants)">
        <Seg value={pref} options={[['A', 'A · own share'], ['B', 'B · host upfront'], ['none', 'No pref.']]} onChange={setPref} />
        <Row label="Why, in one sentence"><input className="w-full h-9 rounded-lg bg-white/10 px-2" value={why} onChange={(e) => setWhy(e.target.value)} /></Row>
        <Button className="w-full !h-10" disabled={!pref} onClick={async () => {
          await act((d, n) => { log(d, n, null, 'facilitator', 'survey_submitted', { kind: 'final', group, preference: pref, why }) })
          setPref(''); setWhy(''); toast('Preference saved', 'success')
        }}>Save preference</Button>
      </Section>
      <Section title="Data">
        <div className="text-white/60 mb-2">{db.events.length} events · {sessions.length} sessions · {surveys} survey responses</div>
        <div className="grid grid-cols-2 gap-2">
          <Btn onClick={() => download(`group-booking-events-${new Date().toISOString().slice(0, 16)}.csv`, [
            ['ts_sim_iso', 'ts_real_iso', 'sessionId', 'variant', 'actor', 'type', 'payload'],
            ...db.events.map((e) => [new Date(e.ts).toISOString(), new Date(e.realTs).toISOString(), e.sessionId, e.variant, e.actor, e.type, e.payload]),
          ])}>Export event log CSV</Btn>
          <Btn onClick={() => {
            const rows = sessions.map((x) => summarize(db, x))
            const head = Object.keys(rows[0] ?? summarize(db, { id: '', members: [], seats: [], status: 'live', variant: 'A', createdAt: 0 } as unknown as Session))
            download(`group-booking-sessions-${new Date().toISOString().slice(0, 16)}.csv`, [head, ...rows.map((r) => head.map((k) => (r as Record<string, unknown>)[k]))])
          }}>Export session summary</Btn>
        </div>
        <div className="mt-3 space-y-1.5">
          {sessions.slice(0, 8).map((x) => {
            const r = summarize(db, x)
            return (
              <div key={x.id} className="bg-white/5 rounded-lg p-2 text-[11px] text-white/80">
                <span className="font-semibold text-white">{x.variant}</span> · {r.outcome} · {r.paidSeats}/{r.seats} paid · last pay {r.minutesToLastPayment || '—'} min · nudges {r.nudges} · {r.expiryActions || 'no expiry action'}
              </div>
            )
          })}
        </div>
      </Section>
    </>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <div><div className="text-[11px] uppercase tracking-wider text-white/50 mb-2">{title}</div><div className="space-y-2.5">{children}</div></div>
}
function Row({ label, children }: { label: string; children: ReactNode }) {
  return <div><div className="text-white/70 text-[12px] mb-1">{label}</div>{children}</div>
}
function Btn({ children, onClick }: { children: ReactNode; onClick(): void }) {
  return <button onClick={onClick} className="h-10 rounded-lg bg-white/10 active:bg-white/20 text-[12px] px-2">{children}</button>
}
function Seg({ value, options, onChange }: { value: string; options: [string, string][]; onChange(v: string): void }) {
  return (
    <div className="flex rounded-lg overflow-hidden border border-white/15">
      {options.map(([v, l]) => <button key={v} onClick={() => onChange(v)} className={`flex-1 h-9 text-[12px] ${value === v ? 'bg-brand' : 'bg-transparent'}`}>{l}</button>)}
    </div>
  )
}
function Toggle({ label, sub, value, onChange }: { label: string; sub?: string; value: boolean; onChange(v: boolean): void }) {
  return (
    <button onClick={() => onChange(!value)} className="w-full flex items-center gap-3 text-left" role="switch" aria-checked={value}>
      <div className="flex-1"><div>{label}</div>{sub && <div className="text-[11px] text-white/50">{sub}</div>}</div>
      <span className={`w-10 h-6 rounded-full relative transition ${value ? 'bg-brand' : 'bg-white/20'}`}><span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${value ? 'left-[18px]' : 'left-0.5'}`} /></span>
    </button>
  )
}
function Stars({ v, set }: { v: number; set(n: number): void }) {
  return (
    <div className="flex gap-1.5">
      {[1, 2, 3, 4, 5].map((n) => <button key={n} onClick={() => set(n)} className={`w-10 h-9 rounded-lg ${n <= v ? 'bg-brand' : 'bg-white/10'}`}>{n}</button>)}
    </div>
  )
}
