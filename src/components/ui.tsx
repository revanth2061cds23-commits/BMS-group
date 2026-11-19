import { useRef, type ReactNode, type ButtonHTMLAttributes } from 'react'
import { useStore } from '../store'
import { fmtClock, type SeatDisplay } from '../logic'
import type { Session } from '../types'

export function Button({ variant = 'primary', className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'outline' | 'ghost' | 'danger' | 'dark' }) {
  const v = {
    primary: 'bg-brand text-white disabled:bg-[#f7a3b3]',
    outline: 'border border-brand text-brand bg-white disabled:opacity-50',
    ghost: 'text-brand bg-transparent disabled:opacity-50',
    danger: 'border border-err text-err bg-white disabled:opacity-50',
    dark: 'bg-ink text-white disabled:opacity-50',
  }[variant]
  return <button {...p} className={`h-11 px-4 rounded-lg text-[14px] font-medium active:scale-[.98] transition disabled:active:scale-100 ${v} ${className}`} />
}

export function Header({ title, sub, onBack, right }: { title: string; sub?: string; onBack?: () => void; right?: ReactNode }) {
  const { setFacOpen } = useStore()
  const timer = useRef<number | null>(null)
  const start = () => { timer.current = window.setTimeout(() => setFacOpen(true), 650) }
  const stop = () => { if (timer.current) clearTimeout(timer.current) }
  return (
    <header
      className="sticky top-0 z-30 bg-ink text-white px-3 h-14 flex items-center gap-2 select-none"
      onPointerDown={start} onPointerUp={stop} onPointerLeave={stop} onContextMenu={(e) => e.preventDefault()}
    >
      {onBack && (
        <button aria-label="Back" onClick={onBack} className="w-8 h-8 -ml-1 grid place-items-center rounded-full active:bg-white/10">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-semibold truncate">{title}</div>
        {sub && <div className="text-[11px] text-white/70 truncate">{sub}</div>}
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
      className="bg-ink text-white h-12 px-4 flex items-center justify-between select-none"
      onPointerDown={() => { timer.current = window.setTimeout(() => setFacOpen(true), 650) }}
      onPointerUp={() => timer.current && clearTimeout(timer.current)}
      onPointerLeave={() => timer.current && clearTimeout(timer.current)}
    >
      <div className="font-semibold tracking-wide text-[15px]">Movie tickets</div>
      <div className="text-[11px] text-white/60">Prototype</div>
    </div>
  )
}

export function BottomBar({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="h-24" />
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] bg-white border-t border-line px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] z-30">
        {children}
      </div>
    </>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`bg-white rounded-lg border border-line ${className}`}>{children}</div>
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
  paid: { label: 'Paid', cls: 'bg-[#e6f6ea] text-[#137a2c]' },
  covered: { label: 'Covered by host', cls: 'bg-[#e6f6ea] text-[#137a2c]' },
  pending: { label: 'Pending', cls: 'bg-[#fff4e0] text-[#a86500]' },
  owes: { label: 'Owes host', cls: 'bg-[#fff4e0] text-[#a86500]' },
  failed: { label: 'Payment failed', cls: 'bg-[#fdecea] text-err' },
  open: { label: 'Open', cls: 'bg-[#eef0f6] text-[#555a72]' },
  declined: { label: 'Declined', cls: 'bg-[#eef0f6] text-[#555a72]' },
  released: { label: 'Released', cls: 'bg-[#fdecea] text-err' },
}

export function Pill({ kind, label }: { kind: SeatDisplay; label?: string }) {
  const p = PILL[kind]
  return <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${p.cls}`}>{label ?? p.label}</span>
}

export function TimerBar({ s }: { s: Session }) {
  const { now } = useStore()
  const left = s.expiresAt - now
  if (s.status !== 'live') return null
  const tone = left <= 3 * 60000 ? 'bg-err text-white' : left <= 10 * 60000 ? 'bg-amber text-ink' : 'bg-[#e9eaf1] text-ink'
  const label = s.variant === 'A' ? 'Seats held for' : 'Repayment window'
  return (
    <div className={`sticky top-14 z-20 h-10 px-4 flex items-center justify-between text-[13px] transition-colors ${tone}`} role="timer" aria-live="off">
      <span className="font-medium">{label}</span>
      <span className="font-semibold tabular-nums text-[16px]">{fmtClock(left)}</span>
    </div>
  )
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose(): void; title?: string; children: ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex justify-center">
      <div className="absolute inset-0 bg-black/40 anim-fade" onClick={onClose} />
      <div className="absolute bottom-0 w-full max-w-[390px] bg-white rounded-t-2xl max-h-[88dvh] overflow-y-auto anim-up pb-[env(safe-area-inset-bottom)]">
        <div className="sticky top-0 bg-white pt-2 pb-2 px-4 border-b border-line z-10">
          <div className="w-10 h-1 rounded-full bg-[#d5d6df] mx-auto mb-2" />
          {title && (
            <div className="flex items-center justify-between">
              <h2 className="text-[17px] font-semibold">{title}</h2>
              <button onClick={onClose} aria-label="Close" className="w-8 h-8 grid place-items-center rounded-full text-[#666] active:bg-surface">✕</button>
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
  const tone = { info: 'bg-ink', success: 'bg-[#137a2c]', warn: 'bg-[#a86500]', error: 'bg-err' }
  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 w-full max-w-[390px] px-3 z-[60] pointer-events-none space-y-2">
      {toasts.map((t) => (
        <div key={t.id} className={`${tone[t.tone]} text-white text-[13px] rounded-lg px-3 py-2.5 shadow-lg anim-down`}>{t.text}</div>
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
      <input {...p} className="mt-1 w-full h-11 px-3 rounded-lg border border-line text-[15px] outline-none focus:border-ink bg-white" />
    </label>
  )
}

export function Divider() { return <div className="h-2 bg-surface" /> }
