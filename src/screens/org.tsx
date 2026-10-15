import { useState } from 'react'
import { Plus, Building2, MapPin, Phone, Clock, Pencil, Power, Users as UsersIcon, ShieldCheck, Mail, Trash2, UserPlus, Lock, Boxes, TrendingUp, ArrowRight } from 'lucide-react'
import { useStore, logAudit, uid, inScope, stockStatus, ALL_PERMS, type Branch, type User, type Perm } from '../store'
import { Button, Card, PageHeader, Field, Input, Select, Modal, Confirm, Badge, StatusBadge, Table, Toolbar, SearchInput, KV, Empty, go, fAgo, useToast, Stat, Avatar, Bars, cx, Textarea } from '../ui'

function BranchModal({ initial, onClose }: { initial?: Branch; onClose: () => void }) {
  const { db, act } = useStore()
  const toast = useToast()
  const [f, setF] = useState<Omit<Branch, 'id'>>(initial || { name: '', code: '', city: '', address: '', phone: '', manager: '', status: 'active', hours: '09:00 – 23:00' })
  const [err, setErr] = useState<Record<string, string>>({})
  const set = (k: keyof Branch) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: k === 'code' ? e.target.value.toUpperCase().slice(0, 4) : e.target.value })
  const save = () => {
    const er: Record<string, string> = {}
    if (!f.name.trim()) er.name = 'Required'
    if (!/^[A-Z]{2,4}$/.test(f.code)) er.code = '2–4 letters'
    else if (db.branches.some((b) => b.code === f.code && b.id !== initial?.id)) er.code = 'Code in use'
    if (!f.city.trim()) er.city = 'Required'
    if (!f.address.trim()) er.address = 'Required'
    setErr(er)
    if (Object.keys(er).length) return
    act((d) => {
      if (initial) Object.assign(d.branches.find((b) => b.id === initial.id)!, f)
      else { const id = uid('b'); d.branches.push({ ...f, id }); d.users.filter((u) => d.roles.find((r) => r.id === u.roleId)?.name === 'Owner').forEach((u) => u.branchIds.push(id)) }
      logAudit(d, initial ? 'branch.update' : 'branch.create', f.name, f.address)
    })
    toast({ kind: 'success', title: initial ? 'Branch updated' : 'Branch created', body: initial ? undefined : 'Stock it via purchase orders or transfers.' })
    onClose()
  }
  return (
    <Modal open onClose={onClose} title={initial ? 'Edit branch' : 'Add branch'} width={560} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Save branch</Button></>}>
      <div className="grid grid-cols-2 gap-3.5">
        <Field label="Branch name *" error={err.name}><Input value={f.name} onChange={set('name')} invalid={!!err.name} autoFocus /></Field>
        <Field label="Code *" error={err.code}><Input value={f.code} onChange={set('code')} invalid={!!err.code} /></Field>
        <Field label="City *" error={err.city}><Input value={f.city} onChange={set('city')} invalid={!!err.city} /></Field>
        <Field label="Phone"><Input value={f.phone} onChange={set('phone')} /></Field>
        <Field label="Address *" error={err.address} className="col-span-2"><Input value={f.address} onChange={set('address')} invalid={!!err.address} /></Field>
        <Field label="Branch manager"><Select value={f.manager} onChange={(v) => setF({ ...f, manager: v })} options={[{ value: '', label: 'Unassigned' }, ...db.users.map((u) => ({ value: u.name, label: u.name }))]} /></Field>
        <Field label="Opening hours"><Input value={f.hours} onChange={set('hours')} /></Field>
      </div>
    </Modal>
  )
}

export function Branches() {
  const { db, money, can } = useStore()
  const [open, setOpen] = useState(false)
  const rev = (id: string) => db.sales.filter((s) => s.branchId === id && Date.now() - new Date(s.date).getTime() < 30 * 86400000).reduce((a, s) => a + s.total, 0)
  return (
    <div>
      <PageHeader title="Branches" subtitle={`${db.branches.filter((b) => b.status === 'active').length} active locations`} actions={can('branches') && <Button variant="primary" icon={Plus} onClick={() => setOpen(true)}>Add branch</Button>} />
      <div className="grid grid-cols-3 gap-4">
        {db.branches.map((b) => { const staff = db.users.filter((u) => u.branchIds.includes(b.id)).length; const low = db.products.filter((p) => p.status === 'active' && stockStatus(db, p, b.id) !== 'ok').length; return (
          <button key={b.id} onClick={() => go(`branches/${b.id}`)} className="group overflow-hidden rounded-xl border border-line bg-white text-left shadow-[0_1px_2px_rgba(20,43,59,0.04)] transition hover:-translate-y-0.5 hover:border-teal/40 hover:shadow-lg">
            <div className="relative h-20 bg-navy p-4">
              <svg className="absolute inset-0 h-full w-full opacity-20" aria-hidden><defs><pattern id={`p${b.id}`} width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#42D5B1" /></pattern></defs><rect width="100%" height="100%" fill={`url(#p${b.id})`} /></svg>
              <div className="relative flex items-start justify-between"><span className="rounded-md bg-mint/15 px-2 py-0.5 font-mono text-[12px] font-bold text-mint">{b.code}</span><StatusBadge s={b.status} /></div>
            </div>
            <div className="p-4">
              <div className="text-[16px] font-bold">{b.name}</div>
              <div className="mt-1 flex items-center gap-1.5 text-[12.5px] text-muted"><MapPin className="size-3.5" />{b.address}, {b.city}</div>
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3 text-center">
                <div><div className="tnum text-[14px] font-bold">{money(rev(b.id)).replace(db.settings.currency + ' ', '')}</div><div className="text-[11px] text-muted">30d sales</div></div>
                <div><div className="tnum text-[14px] font-bold">{staff}</div><div className="text-[11px] text-muted">Staff</div></div>
                <div><div className={cx('tnum text-[14px] font-bold', low && 'text-amber-600')}>{low}</div><div className="text-[11px] text-muted">Low SKUs</div></div>
              </div>
            </div>
          </button>) })}
      </div>
      {open && <BranchModal onClose={() => setOpen(false)} />}
    </div>
  )
}

export function BranchDetails({ id }: { id: string }) {
  const { db, act, money, can } = useStore()
  const toast = useToast()
  const [edit, setEdit] = useState(false)
  const [tog, setTog] = useState(false)
  const b = db.branches.find((x) => x.id === id)
  if (!b) return <Empty title="Branch not found" action={<Button onClick={() => go('branches')}>Back</Button>} />
  const sales = db.sales.filter((s) => s.branchId === id)
  const days = Array.from({ length: 30 }, (_, i) => { const dt = new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10); return { label: dt.slice(5), value: sales.filter((s) => s.date.slice(0, 10) === dt).reduce((a, s) => a + s.total, 0), hi: i === 29 } })
  const staff = db.users.filter((u) => u.branchIds.includes(id))
  const value = db.batches.filter((x) => inScope(x.branchId, id)).reduce((a, x) => a + x.qty * x.cost, 0)
  const openShift = db.shifts.find((s) => s.branchId === id && s.status === 'open')
  return (
    <div>
      <PageHeader back="branches" eyebrow={b.code} title={<span className="flex items-center gap-3">{b.name}<StatusBadge s={b.status} /></span>} subtitle={`${b.address}, ${b.city}`}
        actions={can('branches') && <><Button icon={Power} onClick={() => setTog(true)}>{b.status === 'active' ? 'Deactivate' : 'Activate'}</Button><Button variant="primary" icon={Pencil} onClick={() => setEdit(true)}>Edit branch</Button></>} />
      <div className="mb-4 grid grid-cols-4 gap-4">
        <Stat label="Sales · 30 days" value={money(days.reduce((a, d) => a + d.value, 0))} icon={TrendingUp} />
        <Stat label="Inventory value" value={money(value)} icon={Boxes} tone="navy" />
        <Stat label="Staff" value={staff.length} icon={UsersIcon} tone="blue" />
        <Stat label="Cash shift" value={openShift ? 'Open' : 'Closed'} sub={openShift ? `by ${db.users.find((u) => u.id === openShift.userId)?.name}` : 'No active drawer'} icon={Clock} tone="amber" onClick={() => go('shifts')} />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Card className="col-span-2" title="Daily sales"><Bars data={days} h={170} fmt={money} /></Card>
        <Card title="Location">
          <KV items={[['Manager', b.manager || '—'], ['Phone', b.phone], ['Hours', b.hours], ['City', b.city]]} />
          <div className="mt-4 space-y-1.5 text-[12.5px] text-muted"><div className="flex items-center gap-2"><Phone className="size-3.5" />{b.phone}</div><div className="flex items-center gap-2"><Clock className="size-3.5" />{b.hours}</div></div>
        </Card>
      </div>
      <Card className="mt-4" title="Team" pad={false} action={can('users') && <Button size="sm" variant="ghost" onClick={() => go('users')}>Manage users<ArrowRight className="size-3.5" /></Button>}>
        <Table rows={staff} rowKey={(u) => u.id} cols={[
          { key: 'n', label: 'Name', render: (u) => <div className="flex items-center gap-2.5"><Avatar name={u.name} /><b>{u.name}</b></div> },
          { key: 'r', label: 'Role', render: (u) => db.roles.find((r) => r.id === u.roleId)?.name },
          { key: 'e', label: 'Email', render: (u) => <span className="text-muted">{u.email}</span> },
          { key: 's', label: 'Status', render: (u) => <StatusBadge s={u.status} /> },
        ]} />
      </Card>
      {edit && <BranchModal initial={b} onClose={() => setEdit(false)} />}
      <Confirm open={tog} onClose={() => setTog(false)} danger={b.status === 'active'} title={b.status === 'active' ? 'Deactivate branch?' : 'Activate branch?'} confirmLabel={b.status === 'active' ? 'Deactivate' : 'Activate'} body={b.status === 'active' ? 'The branch will be hidden from POS and transfer destinations. History is preserved.' : 'The branch becomes available for sales and transfers.'}
        onConfirm={() => { act((d) => { const x = d.branches.find((x) => x.id === id)!; x.status = x.status === 'active' ? 'inactive' : 'active'; logAudit(d, 'branch.status', x.name, x.status) }); toast({ kind: 'success', title: 'Branch updated' }) }} />
    </div>
  )
}

function UserModal({ initial, onClose }: { initial?: User; onClose: () => void }) {
  const { db, act } = useStore()
  const toast = useToast()
  const [f, setF] = useState({ name: initial?.name || '', email: initial?.email || '', phone: initial?.phone || '', roleId: initial?.roleId || 'r4', branchIds: initial?.branchIds || [db.branches[0].id] })
  const [err, setErr] = useState<Record<string, string>>({})
  const save = () => {
    const er: Record<string, string> = {}
    if (f.name.trim().length < 3) er.name = 'Full name required'
    if (!/^\S+@\S+\.\S+$/.test(f.email)) er.email = 'Valid email required'
    else if (db.users.some((u) => u.email.toLowerCase() === f.email.toLowerCase() && u.id !== initial?.id)) er.email = 'Email already in use'
    if (!f.branchIds.length) er.branches = 'Assign at least one branch'
    setErr(er)
    if (Object.keys(er).length) return
    act((d) => {
      if (initial) { Object.assign(d.users.find((u) => u.id === initial.id)!, f); logAudit(d, 'user.update', f.name, `Role ${d.roles.find((r) => r.id === f.roleId)?.name}`) }
      else { d.users.push({ ...f, id: uid('u'), status: 'invited', lastActive: '' }); logAudit(d, 'user.invite', f.name, `Invited as ${d.roles.find((r) => r.id === f.roleId)?.name}`) }
    })
    toast({ kind: 'success', title: initial ? 'User updated' : 'Invitation created', body: initial ? undefined : 'Demo: no email is sent. Use "Activate" to simulate acceptance.' })
    onClose()
  }
  return (
    <Modal open onClose={onClose} title={initial ? 'Edit user' : 'Invite user'} width={540} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>{initial ? 'Save changes' : 'Send invite'}</Button></>}>
      <div className="grid grid-cols-2 gap-3.5">
        <Field label="Full name *" error={err.name}><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} invalid={!!err.name} autoFocus /></Field>
        <Field label="Phone"><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        <Field label="Work email *" error={err.email} className="col-span-2"><Input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} invalid={!!err.email} /></Field>
        <Field label="Role" className="col-span-2"><Select value={f.roleId} onChange={(v) => setF({ ...f, roleId: v })} options={db.roles.map((r) => ({ value: r.id, label: `${r.name} — ${r.description}` }))} /></Field>
      </div>
      <div className="mt-4"><div className="mb-1.5 text-[12.5px] font-semibold">Branch access</div>
        <div className="grid grid-cols-2 gap-2">{db.branches.map((b) => <label key={b.id} className={cx('flex cursor-pointer items-center gap-2.5 rounded-lg border p-2.5 text-[13px]', f.branchIds.includes(b.id) ? 'border-teal bg-teal/[0.04]' : 'border-line')}><input type="checkbox" className="accent-teal" checked={f.branchIds.includes(b.id)} onChange={(e) => setF({ ...f, branchIds: e.target.checked ? [...f.branchIds, b.id] : f.branchIds.filter((x) => x !== b.id) })} />{b.name}</label>)}</div>
        {err.branches && <div className="mt-1 text-[12px] text-red-600">{err.branches}</div>}
      </div>
    </Modal>
  )
}

export function UsersScreen() {
  const { db, act, me } = useStore()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [role, setRole] = useState('all')
  const [modal, setModal] = useState<User | 'new' | null>(null)
  const [sus, setSus] = useState<User | null>(null)
  const rows = db.users.filter((u) => (role === 'all' || u.roleId === role) && (!q || `${u.name} ${u.email}`.toLowerCase().includes(q.toLowerCase())))
  return (
    <div>
      <PageHeader title="Users & Access" subtitle={`${db.users.length} people · ${db.users.filter((u) => u.status === 'invited').length} pending invitations`} actions={<Button variant="primary" icon={UserPlus} onClick={() => setModal('new')}>Invite user</Button>} />
      <Card pad={false}>
        <Toolbar><SearchInput value={q} onChange={setQ} placeholder="Search people…" className="w-[280px]" /><Select aria-label="Role" className="w-[180px]" value={role} onChange={setRole} options={[{ value: 'all', label: 'All roles' }, ...db.roles.map((r) => ({ value: r.id, label: r.name }))]} /></Toolbar>
        <Table rows={rows} rowKey={(u) => u.id} cols={[
          { key: 'n', label: 'User', render: (u) => <div className="flex items-center gap-3"><Avatar name={u.name} size={32} /><div><b>{u.name}</b>{u.id === me!.id && <span className="ml-1.5"><Badge tone="teal">You</Badge></span>}<div className="text-[12px] text-muted">{u.email}</div></div></div> },
          { key: 'r', label: 'Role', render: (u) => <Badge tone={db.roles.find((r) => r.id === u.roleId)?.name === 'Owner' ? 'navy' : 'gray'}>{db.roles.find((r) => r.id === u.roleId)?.name}</Badge> },
          { key: 'b', label: 'Branches', render: (u) => <div className="flex flex-wrap gap-1">{u.branchIds.map((id) => <span key={id} className="rounded bg-canvas px-1.5 py-0.5 font-mono text-[11px] font-semibold ring-1 ring-line">{db.branches.find((b) => b.id === id)?.code}</span>)}</div> },
          { key: 'l', label: 'Last active', render: (u) => <span className="text-muted">{u.lastActive ? fAgo(u.lastActive) : 'Never'}</span> },
          { key: 's', label: 'Status', render: (u) => <StatusBadge s={u.status} /> },
          { key: 'a', label: '', align: 'right', render: (u) => <div className="flex justify-end gap-1">
            {u.status === 'invited' && <Button size="sm" onClick={() => { act((d) => { d.users.find((x) => x.id === u.id)!.status = 'active'; logAudit(d, 'user.activate', u.name, 'Invitation accepted (simulated)') }); toast({ kind: 'success', title: `${u.name} activated` }) }}>Activate</Button>}
            <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setModal(u)}>Edit</Button>
            {u.id !== me!.id && u.status !== 'invited' && <Button size="sm" variant="ghost" onClick={() => setSus(u)}>{u.status === 'suspended' ? 'Reinstate' : 'Suspend'}</Button>}
          </div> },
        ]} />
      </Card>
      {modal && <UserModal initial={modal === 'new' ? undefined : modal} onClose={() => setModal(null)} />}
      <Confirm open={!!sus} onClose={() => setSus(null)} danger={sus?.status === 'active'} title={sus?.status === 'active' ? `Suspend ${sus?.name}?` : `Reinstate ${sus?.name}?`} confirmLabel={sus?.status === 'active' ? 'Suspend' : 'Reinstate'} body={sus?.status === 'active' ? 'They will be signed out and unable to sign in. Their history remains in the audit log.' : 'They will regain access with their current role.'}
        onConfirm={() => { const u = sus!; act((d) => { const x = d.users.find((x) => x.id === u.id)!; x.status = x.status === 'active' ? 'suspended' : 'active'; logAudit(d, 'user.status', x.name, x.status) }); toast({ kind: 'success', title: 'Access updated' }) }} />
    </div>
  )
}

export function Roles() {
  const { db, act } = useStore()
  const toast = useToast()
  const [sel, setSel] = useState(db.roles[1]?.id || db.roles[0].id)
  const [create, setCreate] = useState(false)
  const [del, setDel] = useState(false)
  const [nf, setNf] = useState({ name: '', description: '', copy: 'r4' })
  const r = db.roles.find((x) => x.id === sel) || db.roles[0]
  const users = db.users.filter((u) => u.roleId === r.id)
  const groups = Array.from(new Set(ALL_PERMS.map((p) => p.group)))
  const toggle = (p: Perm) => act((d) => { const x = d.roles.find((x) => x.id === r.id)!; x.permissions = x.permissions.includes(p) ? x.permissions.filter((y) => y !== p) : [...x.permissions, p]; logAudit(d, 'role.update', x.name, `${x.permissions.includes(p) ? 'Granted' : 'Revoked'} ${p}`) })
  return (
    <div>
      <PageHeader title="Roles & Permissions" subtitle="Control what each role can see and do. Changes apply immediately." actions={<Button variant="primary" icon={Plus} onClick={() => setCreate(true)}>New role</Button>} />
      <div className="grid grid-cols-[300px_1fr] gap-4">
        <Card pad={false}>
          {db.roles.map((x) => (
            <button key={x.id} onClick={() => setSel(x.id)} className={cx('flex w-full items-start gap-3 border-b border-line/70 px-4 py-3.5 text-left last:border-0', sel === x.id ? 'bg-teal/[0.05]' : 'hover:bg-canvas')}>
              <span className={cx('mt-0.5 grid size-8 place-items-center rounded-lg', sel === x.id ? 'bg-teal text-white' : 'bg-canvas text-muted')}><ShieldCheck className="size-4" /></span>
              <div className="min-w-0 flex-1"><div className="flex items-center gap-2 text-[13.5px] font-bold">{x.name}{x.system && <Lock className="size-3 text-muted" />}</div><div className="truncate text-[12px] text-muted">{x.description}</div><div className="mt-1 text-[11.5px] text-muted">{x.permissions.length} permissions · {db.users.filter((u) => u.roleId === x.id).length} users</div></div>
            </button>
          ))}
        </Card>
        <Card title={<span className="flex items-center gap-2">{r.name}{r.system && <Badge>System role · locked</Badge>}</span>} action={!r.system && <Button size="sm" variant="ghost" icon={Trash2} onClick={() => setDel(true)}>Delete role</Button>}>
          <div className="space-y-5">
            {groups.map((g) => (
              <div key={g}>
                <div className="mb-2 text-[11px] font-bold tracking-[0.1em] text-muted uppercase">{g}</div>
                <div className="grid grid-cols-2 gap-2">
                  {ALL_PERMS.filter((p) => p.group === g).map((p) => { const on = r.permissions.includes(p.key); return (
                    <label key={p.key} className={cx('flex items-center justify-between rounded-lg border px-3 py-2.5 text-[13px]', on ? 'border-teal/30 bg-teal/[0.03]' : 'border-line', r.system ? 'opacity-70' : 'cursor-pointer')}>
                      <span className="font-medium">{p.label}</span>
                      <input type="checkbox" className="size-4 accent-teal" checked={on} disabled={r.system} onChange={() => toggle(p.key)} />
                    </label>) })}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 border-t border-line pt-4"><div className="mb-2 text-[12.5px] font-semibold">Assigned users</div><div className="flex flex-wrap gap-2">{users.length ? users.map((u) => <span key={u.id} className="flex items-center gap-2 rounded-full bg-canvas py-1 pr-3 pl-1 text-[12.5px] ring-1 ring-line"><Avatar name={u.name} size={22} />{u.name}</span>) : <span className="text-[12.5px] text-muted">No users</span>}</div></div>
        </Card>
      </div>
      <Modal open={create} onClose={() => setCreate(false)} title="New role" width={460} footer={<><Button onClick={() => setCreate(false)}>Cancel</Button><Button variant="primary" onClick={() => { if (!nf.name.trim()) return toast({ kind: 'error', title: 'Role name required' }); if (db.roles.some((x) => x.name.toLowerCase() === nf.name.trim().toLowerCase())) return toast({ kind: 'error', title: 'A role with this name exists' }); const id = uid('r'); act((d) => { d.roles.push({ id, name: nf.name.trim(), description: nf.description || 'Custom role', permissions: [...(d.roles.find((x) => x.id === nf.copy)?.permissions || [])] }); logAudit(d, 'role.create', nf.name, '') }); setSel(id); setCreate(false); setNf({ name: '', description: '', copy: 'r4' }); toast({ kind: 'success', title: 'Role created' }) }}>Create role</Button></>}>
        <div className="space-y-3.5">
          <Field label="Role name"><Input autoFocus value={nf.name} onChange={(e) => setNf({ ...nf, name: e.target.value })} placeholder="e.g. Inventory Clerk" /></Field>
          <Field label="Description"><Textarea value={nf.description} onChange={(e) => setNf({ ...nf, description: e.target.value })} /></Field>
          <Field label="Start from permissions of"><Select value={nf.copy} onChange={(v) => setNf({ ...nf, copy: v })} options={db.roles.map((x) => ({ value: x.id, label: x.name }))} /></Field>
        </div>
      </Modal>
      <Confirm open={del} onClose={() => setDel(false)} danger title={`Delete ${r.name}?`} confirmLabel="Delete" body={users.length ? `${users.length} users still have this role. Reassign them first.` : 'This role will be permanently removed.'}
        onConfirm={() => { if (users.length) return toast({ kind: 'error', title: 'Role in use', body: 'Reassign users before deleting.' }); act((d) => { d.roles = d.roles.filter((x) => x.id !== r.id); logAudit(d, 'role.delete', r.name, '') }); setSel(db.roles[0].id); toast({ kind: 'success', title: 'Role deleted' }) }} />
    </div>
  )
}
