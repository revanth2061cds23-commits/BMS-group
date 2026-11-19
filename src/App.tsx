import { useStore, facilitatorFlag } from './store'
import { OfflineBanner, Toasts } from './components/ui'
import { Facilitator } from './components/Facilitator'
import { AddMembers, Review, SeatSelect, ShowSummary } from './screens/Host'
import { SessionRoute } from './screens/Session'
import { TicketScreen } from './screens/Ticket'
import { History } from './screens/History'
import { firstName } from './logic'

function DemoBar() {
  const { demo, path, db, identity, setIdentity } = useStore()
  if (!demo) return null
  const sid = path.match(/^\/s\/([^/]+)/)?.[1]
  const s = sid ? db.sessions[sid] : undefined
  const me = sid ? identity(sid) : null
  return (
    <div className="bg-[#fff4e0] border-b border-[#f8dca6] px-2 py-1.5 flex items-center gap-1.5 overflow-x-auto text-[12px]">
      <span className="shrink-0 font-semibold text-[#7a4b00] pr-1">Demo · viewing as</span>
      {!s && <span className="text-[#7a4b00]">the host (open a session to switch people)</span>}
      {s?.members.map((m) => (
        <button key={m.id} onClick={() => setIdentity(s.id, m.id, true)} className={`shrink-0 h-7 px-2.5 rounded-full border ${me === m.id ? 'bg-ink text-white border-ink' : 'bg-white border-[#f8dca6]'}`}>
          {firstName(m.name)}{m.isHost ? ' (host)' : ''}
        </button>
      ))}
      {s && <button onClick={() => setIdentity(s.id, null, true)} className={`shrink-0 h-7 px-2.5 rounded-full border ${!me ? 'bg-ink text-white border-ink' : 'bg-white border-[#f8dca6]'}`}>+ New person</button>}
    </div>
  )
}

export default function App() {
  const { path, setFacOpen, demo } = useStore()
  const s = path.match(/^\/s\/([^/]+)(\/ticket)?\/?$/)
  let screen
  if (s && s[2]) screen = <TicketScreen sid={s[1]} />
  else if (s) screen = <SessionRoute key={s[1]} sid={s[1]} />
  else if (path === '/seats') screen = <SeatSelect />
  else if (path === '/members') screen = <AddMembers />
  else if (path === '/review') screen = <Review />
  else if (path === '/history') screen = <History />
  else screen = <ShowSummary />
  return (
    <>
      <OfflineBanner />
      <DemoBar />
      {screen}
      <Toasts />
      <Facilitator />
      {(facilitatorFlag || demo) && (
        <button
          onClick={() => setFacOpen(true)}
          className="fixed z-40 right-[max(0px,calc(50%-195px))] top-[45%] w-7 h-14 rounded-l-lg bg-[#1d1e29]/80 text-white grid place-items-center text-[10px] font-semibold [writing-mode:vertical-rl]"
          aria-label="Open facilitator panel"
        >FAC</button>
      )}
    </>
  )
}
