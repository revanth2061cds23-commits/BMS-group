import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store'
import { Avatar, Button, Field, Sheet } from './ui'
import { initials, log, normPhone, uid } from '../logic'
import { CONTACTS } from '../seed'
import type { Group, SavedContact } from '../types'

const samePerson = (a: SavedContact, b: SavedContact) => normPhone(a.phone) === normPhone(b.phone)

/** Everyone the host might want to invite: demo contacts, saved groups, plus anyone passed in. */
export function useContactPool(extra: SavedContact[] = []) {
  const { db, profile } = useStore()
  return useMemo(() => {
    const all = [...extra, ...CONTACTS, ...db.groups.flatMap((g) => g.members)]
    return all
      .filter((c, i) => all.findIndex((x) => samePerson(x, c)) === i)
      .filter((c) => normPhone(c.phone) !== normPhone(profile.phone))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [db.groups, profile.phone, extra])
}

type PickerContact = { name?: string[]; tel?: string[] }
type ContactsApi = { select(props: string[], opts: { multiple: boolean }): Promise<PickerContact[]> }
const phoneContacts = (): ContactsApi | null => {
  const n = navigator as Navigator & { contacts?: ContactsApi }
  return n.contacts && 'select' in n.contacts ? n.contacts : null
}

/**
 * Bottom sheet for choosing several people at once.
 * Uses the phone's own contact picker where the browser offers one (Chrome on Android).
 */
export function ContactsSheet({ open, onClose, title, initial, max, cta, onDone }: {
  open: boolean
  onClose(): void
  title: string
  initial: SavedContact[]
  max?: number
  cta: (n: number) => string
  onDone(list: SavedContact[]): void
}) {
  const { toast } = useStore()
  const [picked, setPicked] = useState<SavedContact[]>(initial)
  const [fromPhone, setFromPhone] = useState<SavedContact[]>([])
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  useEffect(() => { if (open) { setPicked(initial); setQ(''); setAdding(false) } }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const pool = useContactPool(useMemo(() => [...fromPhone, ...initial], [fromPhone, initial]))
  const shown = pool.filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()) || normPhone(c.phone).includes(q.replace(/\D/g, '')))
  const isOn = (c: SavedContact) => picked.some((x) => samePerson(x, c))
  const full = max !== undefined && picked.length >= max

  const toggle = (c: SavedContact) => {
    if (isOn(c)) { setPicked(picked.filter((x) => !samePerson(x, c))); return }
    if (full) { toast(`You have ${max} seat${max === 1 ? '' : 's'} for friends. Remove someone first, or pick more seats.`, 'warn'); return }
    setPicked([...picked, c])
  }

  const pickFromPhone = async () => {
    const api = phoneContacts()
    if (!api) return
    try {
      const res = await api.select(['name', 'tel'], { multiple: true })
      const got = res
        .map((r) => ({ name: r.name?.[0]?.trim() || 'Friend', phone: normPhone(r.tel?.[0] ?? '') }))
        .filter((c) => c.phone.length === 10)
      if (!got.length) { toast('No contacts with a 10-digit mobile number were chosen', 'warn'); return }
      setFromPhone((cur) => [...got, ...cur])
      let next = [...picked]
      for (const c of got) if (!next.some((x) => samePerson(x, c)) && (max === undefined || next.length < max)) next = [...next, c]
      setPicked(next)
    } catch { /* picker closed */ }
  }

  const addNew = () => {
    const c = { name: name.trim(), phone: normPhone(phone) }
    if (c.name.length < 2 || c.phone.length !== 10) { toast('Enter a name and a 10-digit mobile number', 'warn'); return }
    setFromPhone((cur) => [c, ...cur])
    if (!isOn(c)) { if (full) toast('All seats are filled', 'warn'); else setPicked([...picked, c]) }
    setName(''); setPhone(''); setAdding(false)
  }

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="flex items-center gap-2 h-12 px-4 rounded-2xl bg-surface mb-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-sub shrink-0"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" strokeLinecap="round" /></svg>
        <input className="flex-1 bg-transparent outline-none text-[15px] min-w-0" placeholder="Search name or number" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search contacts" />
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        {phoneContacts() ? (
          <button onClick={pickFromPhone} className="h-11 rounded-2xl bg-brand-soft text-brand text-[13px] font-semibold flex items-center justify-center gap-1.5">
            <ContactIcon size={16} /> Phone contacts
          </button>
        ) : (
          <div className="h-11 rounded-2xl bg-surface text-sub text-[11px] leading-tight grid place-items-center px-2 text-center">Phone contacts open on Android Chrome</div>
        )}
        <button onClick={() => setAdding(!adding)} className="h-11 rounded-2xl border-[1.5px] border-line text-[13px] font-semibold">+ New person</button>
      </div>
      {adding && (
        <div className="rounded-2xl bg-surface p-3 mb-3 space-y-2">
          <input className="w-full h-11 px-4 rounded-2xl bg-white text-[14px] outline-none" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="w-full h-11 px-4 rounded-2xl bg-white text-[14px] outline-none" placeholder="Mobile number" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Button className="w-full !h-11" onClick={addNew}>Add</Button>
        </div>
      )}
      <div className="flex items-center justify-between text-[12px] text-sub mb-1 px-1">
        <span>{shown.length} contact{shown.length === 1 ? '' : 's'}</span>
        {max !== undefined && <span className={full ? 'text-brand font-semibold' : ''}>{picked.length} of {max} seats filled</span>}
      </div>
      <div className="-mx-4">
        {shown.map((c) => {
          const on = isOn(c)
          return (
            <button key={c.phone} onClick={() => toggle(c)} className="w-full px-4 py-2.5 flex items-center gap-3 text-left active:bg-surface" aria-pressed={on}>
              <Avatar name={c.name} initials={initials(c.name)} size={40} />
              <div className="flex-1 min-w-0"><div className="text-[14px] font-medium truncate">{c.name}</div><div className="text-[12px] text-sub">{c.phone}</div></div>
              <span className={`w-6 h-6 rounded-lg grid place-items-center text-[13px] font-bold transition ${on ? 'bg-brand text-white' : 'border-[1.5px] border-[#c9cbd6] text-transparent'}`}>✓</span>
            </button>
          )
        })}
        {shown.length === 0 && <div className="text-[13px] text-sub text-center py-8">No one matches “{q}”.</div>}
      </div>
      <div className="sticky bottom-0 bg-white pt-3 pb-1">
        <Button className="w-full" onClick={() => onDone(picked)}>{cta(picked.length)}</Button>
      </div>
    </Sheet>
  )
}

/** Create a group, or rename it, add or remove people, or delete it. */
export function GroupEditor({ open, onClose, group, initialMembers = [] }: {
  open: boolean
  onClose(): void
  group: Group | null
  initialMembers?: SavedContact[]
}) {
  const { act, toast, db } = useStore()
  const [name, setName] = useState('')
  const [members, setMembers] = useState<SavedContact[]>([])
  const [picking, setPicking] = useState(false)
  useEffect(() => {
    if (!open) return
    setName(group?.name ?? '')
    setMembers(group ? group.members : initialMembers)
  }, [open, group]) // eslint-disable-line react-hooks/exhaustive-deps

  const clash = db.groups.some((g) => g.id !== group?.id && g.name.trim().toLowerCase() === name.trim().toLowerCase())
  const save = async () => {
    const n = name.trim()
    await act((d, now) => {
      if (group) {
        const g = d.groups.find((x) => x.id === group.id)
        if (!g) return false
        g.name = n
        g.members = members
        log(d, now, null, 'host', 'group_edited', { groupId: g.id, name: n, size: members.length })
      } else {
        d.groups.push({ id: uid('g_'), name: n, members, lastUsedAt: now })
        log(d, now, null, 'host', 'group_saved', { name: n, size: members.length, from: 'add_friends' })
      }
    })
    toast(group ? `Updated "${n}"` : `Created "${n}"`, 'success')
    onClose()
  }
  const remove = async () => {
    if (!group || !confirm(`Delete "${group.name}"? This can't be undone.`)) return
    await act((d, now) => {
      d.groups = d.groups.filter((x) => x.id !== group.id)
      log(d, now, null, 'host', 'group_deleted', { groupId: group.id })
    })
    toast(`Deleted "${group.name}"`, 'info')
    onClose()
  }

  return (
    <>
      <Sheet open={open && !picking} onClose={onClose} title={group ? 'Edit group' : 'New group'}>
        <Field label="Group name" placeholder="e.g. Hostel gang" value={name} onChange={(e) => setName(e.target.value)} />
        {clash && <div className="text-[12px] text-err mt-1">You already have a group with this name.</div>}
        <div className="flex items-center justify-between mt-4 mb-1">
          <div className="text-[13px] font-semibold">{members.length} {members.length === 1 ? 'person' : 'people'}</div>
          <button className="text-[13px] font-semibold text-brand flex items-center gap-1" onClick={() => setPicking(true)}><ContactIcon size={15} /> Add people</button>
        </div>
        <div className="-mx-4">
          {members.map((m) => (
            <div key={m.phone} className="px-4 py-2 flex items-center gap-3">
              <Avatar name={m.name} initials={initials(m.name)} size={36} />
              <div className="flex-1 min-w-0"><div className="text-[14px] font-medium truncate">{m.name}</div><div className="text-[12px] text-sub">{m.phone}</div></div>
              <button className="w-8 h-8 rounded-full bg-surface text-sub grid place-items-center" aria-label={`Remove ${m.name}`} onClick={() => setMembers(members.filter((x) => !samePerson(x, m)))}>✕</button>
            </div>
          ))}
          {members.length === 0 && <div className="mx-4 rounded-2xl bg-surface text-[13px] text-sub text-center py-6">No one yet. Tap “Add people”.</div>}
        </div>
        <div className="grid gap-2 mt-4">
          <Button disabled={name.trim().length < 2 || members.length === 0 || clash} onClick={save}>{group ? 'Save changes' : 'Create group'}</Button>
          {group && <Button variant="ghost" className="!text-err" onClick={remove}>Delete group</Button>}
        </div>
      </Sheet>
      <ContactsSheet
        open={open && picking} onClose={() => setPicking(false)} title="Add people to the group" initial={members}
        cta={(n) => `Done · ${n} ${n === 1 ? 'person' : 'people'}`}
        onDone={(list) => { setMembers(list); setPicking(false) }}
      />
    </>
  )
}

export function ContactIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="16" height="18" rx="3" /><circle cx="12" cy="10" r="2.6" /><path d="M7.8 17c.8-1.9 2.4-2.9 4.2-2.9s3.4 1 4.2 2.9M2 8h2M2 12h2M2 16h2" />
    </svg>
  )
}
