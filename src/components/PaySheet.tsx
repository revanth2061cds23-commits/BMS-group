import { useState } from 'react'
import { Button, Sheet } from './ui'
import { inr } from '../logic'

/** Fake checkout: never collects card or UPI details. */
export function PaySheet({ open, amount, title, lines, onClose, onResult, note }: {
  open: boolean
  amount: number
  title: string
  lines?: [string, string][]
  note?: string
  onClose(): void
  onResult(success: boolean): Promise<void> | void
}) {
  const [method, setMethod] = useState<'upi' | 'card'>('upi')
  const [busy, setBusy] = useState(false)
  const go = async (ok: boolean) => {
    setBusy(true)
    await new Promise((r) => setTimeout(r, 700))
    await onResult(ok)
    setBusy(false)
  }
  return (
    <Sheet open={open} onClose={() => !busy && onClose()} title={title}>
      {lines && (
        <div className="space-y-1.5 mb-4 text-[13px]">
          {lines.map(([a, b]) => (
            <div key={a} className="flex justify-between"><span className="text-sub">{a}</span><span>{b}</span></div>
          ))}
        </div>
      )}
      <div className="flex justify-between items-baseline border-t border-line pt-3 mb-4">
        <span className="font-medium">Amount payable</span>
        <span className="text-[20px] font-semibold">{inr(amount)}</span>
      </div>
      <div className="text-[12px] text-sub mb-2">Pay with</div>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {(['upi', 'card'] as const).map((m) => (
          <button key={m} onClick={() => setMethod(m)} className={`h-12 rounded-lg border text-[14px] ${method === m ? 'border-ink bg-surface font-medium' : 'border-line'}`}>
            {m === 'upi' ? 'UPI' : 'Debit / credit card'}
          </button>
        ))}
      </div>
      {note && <div className="text-[12px] bg-[#fff4e0] text-[#7a4b00] rounded-lg p-2.5 mb-3">{note}</div>}
      <div className="rounded-lg border border-dashed border-[#c5c7d4] p-3 mb-3 text-[12px] text-sub">
        Simulated payment. No real {method === 'upi' ? 'UPI' : 'card'} details are collected and no money moves. Choose an outcome:
      </div>
      {busy ? (
        <div className="h-[100px] grid place-items-center text-sub text-[13px]">
          <div className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />Processing payment…</div>
        </div>
      ) : (
        <div className="grid gap-2">
          <Button onClick={() => go(true)}>Payment succeeds · {inr(amount)}</Button>
          <Button variant="danger" onClick={() => go(false)}>Payment fails</Button>
        </div>
      )}
    </Sheet>
  )
}
