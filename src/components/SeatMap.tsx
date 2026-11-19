import { COLS, ROWS } from '../seed'

export type SeatLook =
  | { kind: 'available' }
  | { kind: 'sold' }
  | { kind: 'selected'; label?: string }
  | { kind: 'paid'; label: string }
  | { kind: 'held'; label: string }
  | { kind: 'failed'; label: string }
  | { kind: 'open' }
  | { kind: 'released' }
  | { kind: 'disabled' }
  | { kind: 'target' }

interface Props {
  look: (id: string) => SeatLook
  onTap?: (id: string) => void
  me?: string | null
  compact?: boolean
  price?: number
}

const STYLE: Record<SeatLook['kind'], string> = {
  available: 'bg-white border border-ok text-ok',
  sold: 'bg-sold border border-sold text-transparent',
  selected: 'bg-ok border border-ok text-white',
  paid: 'bg-ok border border-ok text-white',
  held: 'bg-amber border border-amber text-ink',
  failed: 'bg-white border-2 border-err text-err',
  open: 'bg-white border-2 border-dashed border-amber text-amber',
  released: 'bg-err-soft border border-err/40 text-err/70',
  disabled: 'bg-white border border-[#cfd0d8] text-[#c4c5cf]',
  target: 'bg-white border-2 border-brand text-brand',
}

export function SeatMap({ look, onTap, me, compact, price }: Props) {
  const size = compact ? 22 : 24
  return (
    <div className="select-none">
      <div className="overflow-x-auto">
        <div className="mx-auto w-max py-1">
          {price !== undefined && <div className="text-[11px] text-sub text-center mb-2">{`₹${price} · CLASSIC`}</div>}
          {ROWS.map((r) => (
            <div key={r} className="flex items-center gap-[3px] mb-[3px]">
              <div className="w-4 text-[10px] text-sub text-center">{r}</div>
              {Array.from({ length: COLS }, (_, i) => {
                const id = `${r}${i + 1}`
                const l = look(id)
                const label = 'label' in l && l.label ? l.label : l.kind === 'available' || l.kind === 'disabled' || l.kind === 'target' ? String(i + 1) : l.kind === 'open' ? '+' : ''
                const tappable = !!onTap && l.kind !== 'sold'
                return (
                  <span key={id} className="contents">
                    {i === 6 && <span style={{ width: 10 }} />}
                    <button
                      type="button"
                      aria-label={`Seat ${id} ${l.kind}`}
                      disabled={!tappable}
                      onClick={() => onTap?.(id)}
                      className={`rounded-[4px] grid place-items-center font-semibold leading-none ${STYLE[l.kind]} ${me === id ? 'ring-2 ring-brand ring-offset-1' : ''} ${tappable ? 'cursor-pointer' : 'cursor-default'}`}
                      style={{ width: size, height: size, fontSize: label.length > 2 ? 8 : 10 }}
                    >
                      {label}
                    </button>
                  </span>
                )
              })}
            </div>
          ))}
          <div className="mt-3 mx-6 h-1.5 rounded-full bg-gradient-to-r from-transparent via-[#9fa4c4] to-transparent" />
          <div className="text-[10px] text-sub text-center mt-1">All eyes this way</div>
        </div>
      </div>
    </div>
  )
}

export function Legend({ items }: { items: [SeatLook['kind'], string][] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center text-[11px] text-sub">
      {items.map(([k, t]) => (
        <span key={t} className="flex items-center gap-1.5">
          <span className={`inline-block w-3.5 h-3.5 rounded-[3px] ${STYLE[k]}`} />
          {t}
        </span>
      ))}
    </div>
  )
}
