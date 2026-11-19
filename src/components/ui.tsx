import { useRef, type ReactNode, type ButtonHTMLAttributes } from 'react'
import { useStore } from '../store'
import { fmtClock, type SeatDisplay } from '../logic'
import type { Session } from '../types'

export function Button({ variant = 'primary', className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'outline' | 'ghost' | 'danger' | 'dark' }) {
  const v = {
    primary: 'bg-brand text-white active:bg-brand-dark shadow-[0_6px_16px_rgba(248,68,100,.28)] disabled:bg-brand/40 disabled:shadow-none',
    outline: 'border-[1.5px] border-brand text-brand bg-white active:bg-brand-soft disabled:opacity-50',
    ghost: 'text-brand bg-transparent active:bg-brand-soft disabled:opacity-50',
    danger: 'border-[1.5px] border-err/60 text-err bg-white active:bg-err-soft disabled:opacity-50',
    dark: 'bg-ink text-white disabled:opacity-50',
  }[variant]
  return <button {...p} className={`h-12 px-4 rounded-2xl text-[14px] font-semibold active:scale-[.98] transition disabled:active:scale-100 ${v} ${className}`} />
}

export function Header({ title, sub, onBack, right }: { title: string; sub?: string; onBack?: () => void; right?: ReactNode }) {
  const { setFacOpen } = useStore()
  const timer = useRef<number | null>(null)
  const start = () => { timer.current = window.setTimeout(() => setFacOpen(true), 650) }
  const stop = () => { if (timer.current) clearTimeout(timer.current) }
  return (
    <header
      className="sticky top-0 z-30 bg-white text-ink px-3 h-14 flex items-center gap-2 select-none border-b border-line"
      onPointerDown={start} onPointerUp={stop} onPointerLeave={stop} onContextMenu={(e) => e.preventDefault()}
    >
      {onBack && (
        <button aria-label="Back" onClick={onBack} className="w-10 h-10 -ml-1 grid place-items-center rounded-full active:bg-surface">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-[16px] font-semibold truncate leading-tight">{title}</div>
        {sub && <div className="text-[12px] text-sub truncate mt-0.5">{sub}</div>}
      </div>
      {right}
    </header>
  )
}

export function BrandBar() {
  const { setFacOpen } = useStore()
  const timer = useRef<number | null>(null)
  return (
    <div
      className="bg-white text-ink h-14 px-4 flex items-center justify-between select-none border-b border-line"
      onPointerDown={() => { timer.current = window.setTimeout(() => setFacOpen(true), 650) }}
      onPointerUp={() => timer.current && clearTimeout(timer.current)}
      onPointerLeave={() => timer.current && clearTimeout(timer.current)}
    >
      <div className="flex items-center gap-2">
        <span className="w-8 h-8 rounded-lg bg-brand grid place-items-center text-white">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M4 7a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 000 4v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2a2 2 0 000-4z" /></svg>
        </span>
        <span className="font-semibold text-[16px]">Movie tickets</span>
      </div>
      <div className="text-[11px] text-sub bg-surface rounded-full px-2.5 py-1">Prototype</div>
    </div>
  )
}

export function BottomBar({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="h-24" />
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] bg-white rounded-t-3xl shadow-[0_-6px_24px_rgba(34,37,57,.08)] px-4 pt-4 pb-[max(16px,env(safe-area-inset-bottom))] z-30">
        {children}
      </div>
    </>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`bg-white rounded-2xl border border-transparent shadow-[0_1px_2px_rgba(34,37,57,.04),0_4px_16px_rgba(34,37,57,.05)] ${className}`}>{children}</div>
}

const AV_COLORS = ['#6C5CE7', '#00A8A8', '#E17055', '#0984E3', '#B33771', '#2D8F5B', '#C68A00', '#5758BB', '#D35400', '#1B9CFC']
export function Avatar({ name, initials, size = 32, ring }: { name: string; initials: string; size?: number; ring?: string }) {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return (
    <div
      className="rounded-full grid place-items-center text-white font-semibold shrink-0"
      style={{ width: size, height: size, background: AV_COLORS[h % AV_COLORS.length], fontSize: size * 0.38, boxShadow: ring ? `0 0 0 2px #fff, 0 0 0 4px ${ring}` : undefined }}
    >
      {initials}
    </div>
  )
}

export const PILL: Record<SeatDisplay, { label: string; cls: string }> = {
  paid: { label: 'Paid', cls: 'bg-ok-soft text-ok-ink' },
  covered: { label: 'Covered by host', cls: 'bg-ok-soft text-ok-ink' },
  pending: { label: 'Pending', cls: 'bg-amber-soft text-amber-ink' },
  owes: { label: 'Owes host', cls: 'bg-amber-soft text-amber-ink' },
  failed: { label: 'Payment failed', cls: 'bg-err-soft text-err' },
  open: { label: 'Open', cls: 'bg-surface text-sub' },
  declined: { label: 'Declined', cls: 'bg-surface text-sub' },
  released: { label: 'Released', cls: 'bg-err-soft text-err' },
}

export function Pill({ kind, label }: { kind: SeatDisplay; label?: string }) {
  const p = PILL[kind]
  return <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${p.cls}`}>{label ?? p.label}</span>
}

export function TimerBar({ s }: { s: Session }) {
  const { now } = useStore()
  const left = s.expiresAt - now
  if (s.status !== 'live') return null
  const tone = left <= 3 * 60000 ? 'bg-err text-white' : left <= 10 * 60000 ? 'bg-amber-soft text-amber-ink' : 'bg-white text-ink'
  const label = s.variant === 'A' ? 'Seats held for' : 'Time to pay back'
  return (
    <div className="sticky top-14 z-20 px-3 pt-3 bg-surface">
      <div className={`h-11 px-4 rounded-2xl flex items-center gap-2 text-[13px] transition-colors shadow-[0_1px_2px_rgba(34,37,57,.04),0_4px_16px_rgba(34,37,57,.05)] ${tone}`} role="timer" aria-live="off">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2M9 2h6" /></svg>
        <span className="font-medium flex-1">{label}</span>
        <span className="font-bold tabular-nums text-[17px]">{fmtClock(left)}</span>
      </div>
    </div>
  )
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose(): void; title?: string; children: ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex justify-center">
      <div className="absolute inset-0 bg-black/40 anim-fade" onClick={onClose} />
      <div className="absolute bottom-0 w-full max-w-[390px] bg-white rounded-t-3xl max-h-[88dvh] overflow-y-auto anim-up pb-[env(safe-area-inset-bottom)]">
        <div className="sticky top-0 bg-white pt-2 pb-1 px-4 z-10">
          <div className="w-10 h-1 rounded-full bg-[#d5d6df] mx-auto mb-3" />
          {title && (
            <div className="flex items-center justify-between">
              <h2 className="text-[17px] font-semibold">{title}</h2>
              <button onClick={onClose} aria-label="Close" className="w-8 h-8 grid place-items-center rounded-full bg-surface text-sub active:bg-line">✕</button>
            </div>
          )}
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}

export function Toasts() {
  const { toasts } = useStore()
  const tone = { info: 'bg-ink', success: 'bg-ok-ink', warn: 'bg-amber-ink', error: 'bg-err' }
  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 w-full max-w-[390px] px-3 z-[60] pointer-events-none space-y-2">
      {toasts.map((t) => (
        <div key={t.id} className={`${tone[t.tone]} text-white text-[13px] rounded-2xl px-3 py-2.5 shadow-lg anim-down`}>{t.text}</div>
      ))}
    </div>
  )
}

export function OfflineBanner() {
  const { online } = useStore()
  if (online) return null
  return <div className="sticky top-0 z-40 bg-[#5f6368] text-white text-[12px] text-center py-1.5">Offline, reconnecting… Showing the last known session.</div>
}

export function Field({ label, ...p }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block">
      <span className="text-[12px] text-sub">{label}</span>
      <input {...p} className="mt-1.5 w-full h-12 px-4 rounded-2xl border-[1.5px] border-line text-[15px] outline-none focus:border-brand bg-white placeholder:text-[#a3a6b4]" />
    </label>
  )
}

/** Sections are inset cards now; kept so older call sites still compile. */
export function Divider() { return null }
