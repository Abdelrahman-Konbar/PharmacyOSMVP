import { useState } from 'react'
import { Plus, ArrowLeftRight, Send, PackageCheck, XCircle, Trash2, ArrowRight, Printer, Save } from 'lucide-react'
import { useStore, stockOf, inScope, move, logAudit, nextNo, uid, now, allocateFEFO, addStock, pushNotif, checkLowStock, type Transfer, type DB } from '../store'
import { Button, Card, PageHeader, Field, Input, Select, Confirm, StatusBadge, Table, Toolbar, SearchInput, KV, Empty, go, fDate, fDateTime, useToast, Tabs, Textarea } from '../ui'

function dispatch(d: DB, t: Transfer) {
  t.items.forEach((i) => {
    const { allocs } = allocateFEFO(d, i.productId, t.from, i.qty)
    i.allocs = allocs.map((a) => ({ lot: a.batch.lot, expiry: a.batch.expiry, qty: a.qty, cost: a.batch.cost }))
    allocs.forEach((a) => { a.batch.qty -= a.qty; move(d, { productId: i.productId, branchId: t.from, lot: a.batch.lot, type: 'transfer_out', qty: -a.qty, ref: t.no }) })
    checkLowStock(d, i.productId, t.from)
  })
  t.status = 'in_transit'
  t.dispatchedAt = now()
  pushNotif(d, { title: `Transfer ${t.no} dispatched`, body: `${d.branches.find((b) => b.id === t.from)?.name} → ${d.branches.find((b) => b.id === t.to)?.name}, awaiting receipt.`, type: 'transfer', link: `transfers/${t.id}`, branchId: t.to })
  logAudit(d, 'transfer.dispatch', t.no, `${t.items.reduce((a, i) => a + i.qty, 0)} units dispatched`, t.from)
}

export function Transfers() {
  const { db, scope, can } = useStore()
  const [tab, setTab] = useState('active')
  const [q, setQ] = useState('')
  const base = db.transfers.filter((t) => scope === 'all' || t.from === scope || t.to === scope)
  const rows = base.filter((t) => (tab === 'all' || (tab === 'active' ? ['draft', 'in_transit'].includes(t.status) : tab === 'incoming' ? t.status === 'in_transit' && (scope === 'all' || t.to === scope) : t.status === tab)) && (!q || t.no.toLowerCase().includes(q.toLowerCase()))).sort((a, b) => b.date.localeCompare(a.date))
  return (
    <div>
      <PageHeader title="Transfers" subtitle="Move stock between branches with dispatch and receipt confirmation." actions={can('transfers') && db.branches.length > 1 && <Button variant="primary" icon={Plus} onClick={() => go('transfers/new')}>New transfer</Button>} />
      <Card pad={false}>
        <Toolbar>
          <Tabs value={tab} onChange={setTab} tabs={[{ value: 'active', label: 'Active', count: base.filter((t) => ['draft', 'in_transit'].includes(t.status)).length }, { value: 'incoming', label: 'Incoming', count: base.filter((t) => t.status === 'in_transit' && (scope === 'all' || t.to === scope)).length }, { value: 'received', label: 'Received' }, { value: 'all', label: 'All' }]} />
          <div className="flex-1" /><SearchInput value={q} onChange={setQ} placeholder="Transfer no…" className="w-[220px]" />
        </Toolbar>
        <Table rows={rows} rowKey={(t) => t.id} onRow={(t) => go(`transfers/${t.id}`)} empty={<Empty icon={ArrowLeftRight} title="No transfers" action={can('transfers') && <Button onClick={() => go('transfers/new')}>New transfer</Button>} />} cols={[
          { key: 'n', label: 'Transfer', render: (t) => <span className="font-semibold text-teal">{t.no}</span> },
          { key: 'r', label: 'Route', render: (t) => <span className="flex items-center gap-2">{db.branches.find((b) => b.id === t.from)?.name}<ArrowRight className="size-3.5 text-muted" />{db.branches.find((b) => b.id === t.to)?.name}</span> },
          { key: 'd', label: 'Created', render: (t) => fDate(t.date), sort: (t) => t.date },
          { key: 'i', label: 'Lines', align: 'right', render: (t) => t.items.length },
          { key: 'u', label: 'Units', align: 'right', render: (t) => t.items.reduce((a, i) => a + i.qty, 0) },
          { key: 's', label: 'Status', render: (t) => <StatusBadge s={t.status} /> },
        ]} />
      </Card>
    </div>
  )
}

export function TransferForm() {
  const { db, act, scope, myBranches, me } = useStore()
  const toast = useToast()
  const pre = new URLSearchParams(window.location.hash.split('?')[1] || '').get('product')
  const from0 = scope === 'all' ? myBranches[0].id : scope
  const [f, setF] = useState({ from: from0, to: db.branches.find((b) => b.id !== from0 && b.status === 'active')?.id || '', notes: '', items: pre ? [{ productId: pre, qty: 1 }] : ([] as { productId: string; qty: number }[]) })
  const [add, setAdd] = useState('')
  const [err, setErr] = useState('')
  const [confirm, setConfirm] = useState(false)
  const check = () => {
    if (f.from === f.to) return setErr('Source and destination must differ'), false
    if (!f.items.length) return setErr('Add at least one product'), false
    for (const i of f.items) { const a = stockOf(db, i.productId, f.from, true); if (!(i.qty > 0) || i.qty > a) return setErr(`${db.products.find((p) => p.id === i.productId)?.name}: quantity must be 1–${a}`), false }
    setErr(''); return true
  }
  const save = (send: boolean) => {
    let tid = ''
    act((d) => {
      tid = uid('tr')
      const t: Transfer = { id: tid, no: nextNo(d, 'TRF'), from: f.from, to: f.to, date: now(), status: 'draft', notes: f.notes, userId: me!.id, items: f.items.map((i) => ({ ...i, allocs: [] })) }
      d.transfers.unshift(t)
      logAudit(d, 'transfer.create', t.no, `${t.items.length} lines`, f.from)
      if (send) dispatch(d, d.transfers[0])
    })
    toast({ kind: 'success', title: send ? 'Transfer dispatched' : 'Draft saved', body: send ? 'Stock left the source branch and is in transit.' : undefined })
    go(`transfers/${tid}`)
  }
  return (
    <div>
      <PageHeader back="transfers" title="New transfer" actions={<><Button icon={Save} onClick={() => check() && save(false)}>Save draft</Button><Button variant="primary" icon={Send} onClick={() => check() && setConfirm(true)}>Dispatch now</Button></>} />
      <div className="grid grid-cols-3 gap-4">
        <Card className="col-span-2" title="Items" pad={false}>
          <div className="flex gap-2 border-b border-line p-4">
            <Select aria-label="Add product" className="flex-1" value={add} onChange={setAdd} options={[{ value: '', label: 'Add a product with stock at source…' }, ...db.products.filter((p) => p.status === 'active' && !f.items.find((i) => i.productId === p.id) && stockOf(db, p.id, f.from, true) > 0).map((p) => ({ value: p.id, label: `${p.name} ${p.strength} — ${stockOf(db, p.id, f.from, true)} available` }))]} />
            <Button icon={Plus} disabled={!add} onClick={() => { setF({ ...f, items: [...f.items, { productId: add, qty: 1 }] }); setAdd('') }}>Add</Button>
          </div>
          {f.items.length === 0 ? <Empty icon={ArrowLeftRight} title="No items" body="Batches are allocated first-expiry-first-out at dispatch." /> : f.items.map((i, k) => { const p = db.products.find((x) => x.id === i.productId)!; const a = stockOf(db, p.id, f.from, true); return (
            <div key={i.productId} className="flex items-center gap-4 border-b border-line/70 px-5 py-3">
              <div className="flex-1"><b className="text-[13px]">{p.name}</b> <span className="text-[13px] text-muted">{p.strength}</span><div className="text-[12px] text-muted">Source {a} · destination {stockOf(db, p.id, f.to)}</div></div>
              <Input aria-label="Qty" className="tnum w-24 text-right" value={i.qty} invalid={i.qty > a} onChange={(e) => setF({ ...f, items: f.items.map((x, j) => (j === k ? { ...x, qty: parseInt(e.target.value) || 0 } : x)) })} />
              <button aria-label="Remove" onClick={() => setF({ ...f, items: f.items.filter((_, j) => j !== k) })} className="rounded p-1 text-muted hover:bg-red-50 hover:text-red-600"><Trash2 className="size-4" /></button>
            </div>) })}
          {err && <div className="px-5 py-3 text-[12.5px] font-medium text-red-600">{err}</div>}
        </Card>
        <Card title="Route">
          <div className="space-y-3.5">
            <Field label="From"><Select value={f.from} onChange={(v) => setF({ ...f, from: v, items: [] })} options={myBranches.map((b) => ({ value: b.id, label: b.name }))} /></Field>
            <Field label="To"><Select value={f.to} onChange={(v) => setF({ ...f, to: v })} options={db.branches.filter((b) => b.id !== f.from && b.status === 'active').map((b) => ({ value: b.id, label: b.name }))} /></Field>
            <Field label="Notes"><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Reason, courier, cold-chain notes…" /></Field>
          </div>
        </Card>
      </div>
      <Confirm open={confirm} onClose={() => setConfirm(false)} title="Dispatch transfer?" confirmLabel="Dispatch" onConfirm={() => save(true)} body={`${f.items.reduce((a, i) => a + i.qty, 0)} units will be deducted from ${db.branches.find((b) => b.id === f.from)?.name} immediately and held in transit until received.`} />
    </div>
  )
}

export function TransferDetails({ id }: { id: string }) {
  const { db, act, scope, can, role } = useStore()
  const toast = useToast()
  const [c, setC] = useState<'dispatch' | 'receive' | 'cancel' | null>(null)
  const t = db.transfers.find((x) => x.id === id)
  if (!t) return <Empty title="Transfer not found" action={<Button onClick={() => go('transfers')}>Back</Button>} />
  const from = db.branches.find((b) => b.id === t.from)!, to = db.branches.find((b) => b.id === t.to)!
  const canReceive = can('transfers') && (scope === t.to || role?.name === 'Owner')
  const short = t.status === 'draft' && t.items.some((i) => i.qty > stockOf(db, i.productId, t.from, true))
  const run = (k: 'dispatch' | 'receive' | 'cancel') => {
    act((d) => {
      const x = d.transfers.find((y) => y.id === id)!
      if (k === 'dispatch') dispatch(d, x)
      if (k === 'receive') {
        x.items.forEach((i) => i.allocs.forEach((a) => { addStock(d, i.productId, x.to, a.lot, a.expiry, a.qty, a.cost); move(d, { productId: i.productId, branchId: x.to, lot: a.lot, type: 'transfer_in', qty: a.qty, ref: x.no }) }))
        x.status = 'received'; x.receivedAt = now()
        logAudit(d, 'transfer.receive', x.no, `Received at ${to.name}`, x.to)
      }
      if (k === 'cancel') {
        if (x.status === 'in_transit') x.items.forEach((i) => i.allocs.forEach((a) => { addStock(d, i.productId, x.from, a.lot, a.expiry, a.qty, a.cost); move(d, { productId: i.productId, branchId: x.from, lot: a.lot, type: 'transfer_in', qty: a.qty, ref: `${x.no} (cancelled)` }) }))
        x.status = 'cancelled'
        logAudit(d, 'transfer.cancel', x.no, 'Cancelled; stock returned to source', x.from)
      }
    })
    toast({ kind: 'success', title: k === 'dispatch' ? 'Transfer dispatched' : k === 'receive' ? 'Transfer received' : 'Transfer cancelled', body: k === 'receive' ? `Stock added to ${to.name} with original lots and expiry.` : undefined })
  }
  const steps = [{ k: 'Created', d: t.date }, { k: 'Dispatched', d: t.dispatchedAt }, { k: 'Received', d: t.receivedAt }]
  return (
    <div>
      <PageHeader back="transfers" title={<span className="flex items-center gap-3">{t.no}<StatusBadge s={t.status} /></span>} subtitle={<span className="flex items-center gap-2">{from.name}<ArrowRight className="size-3.5" />{to.name}</span>}
        actions={<><Button icon={Printer} onClick={() => window.print()}>Print manifest</Button>
          {can('transfers') && ['draft', 'in_transit'].includes(t.status) && <Button icon={XCircle} onClick={() => setC('cancel')}>Cancel</Button>}
          {can('transfers') && t.status === 'draft' && <Button variant="primary" icon={Send} disabled={short} onClick={() => setC('dispatch')}>Dispatch</Button>}
          {t.status === 'in_transit' && <Button variant="primary" icon={PackageCheck} disabled={!canReceive} title={canReceive ? '' : `Switch to ${to.name} to receive`} onClick={() => setC('receive')}>Confirm receipt</Button>}</>} />
      {t.status === 'in_transit' && !canReceive && <div className="mb-4 rounded-lg bg-sky-50 px-4 py-3 text-[13px] text-sky-800">Receipt must be confirmed by {to.name}. Switch branch from the top bar if you have access.</div>}
      {short && <div className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-[13px] text-amber-800">Source stock is no longer sufficient for this draft. Cancel and recreate it.</div>}
      <div className="grid grid-cols-3 gap-4">
        <Card className="col-span-2" title="Items" pad={false}>
          <Table rows={t.items} rowKey={(i) => i.productId} cols={[
            { key: 'p', label: 'Product', render: (i) => { const p = db.products.find((x) => x.id === i.productId)!; return <b>{p.name} <span className="font-normal text-muted">{p.strength}</span></b> } },
            { key: 'q', label: 'Qty', align: 'right', render: (i) => i.qty },
            { key: 'b', label: 'Batches', render: (i) => (i.allocs.length ? <span className="font-mono text-[12px] text-muted">{i.allocs.map((a) => `${a.lot} ×${a.qty} (exp ${fDate(a.expiry)})`).join(' · ')}</span> : <span className="text-[12px] text-muted">Allocated FEFO at dispatch</span>) },
          ]} />
        </Card>
        <Card title="Timeline">
          <ol className="relative space-y-5 border-l border-line pl-5">
            {steps.map((s) => <li key={s.k}><span className={`absolute -left-[5px] mt-1 size-2.5 rounded-full ${s.d ? 'bg-teal' : 'bg-line'}`} /><div className="text-[13px] font-semibold">{s.k}</div><div className="text-[12px] text-muted">{s.d ? fDateTime(s.d) : t.status === 'cancelled' ? '—' : 'Pending'}</div></li>)}
            {t.status === 'cancelled' && <li><span className="absolute -left-[5px] mt-1 size-2.5 rounded-full bg-red-500" /><div className="text-[13px] font-semibold text-red-600">Cancelled</div></li>}
          </ol>
          <div className="mt-5 border-t border-line pt-4"><KV items={[['Created by', db.users.find((u) => u.id === t.userId)?.name], ['Notes', t.notes || '—']]} /></div>
        </Card>
      </div>
      <Confirm open={c === 'dispatch'} onClose={() => setC(null)} title="Dispatch transfer?" confirmLabel="Dispatch" onConfirm={() => run('dispatch')} body={`Stock will be deducted from ${from.name} and marked in transit.`} />
      <Confirm open={c === 'receive'} onClose={() => setC(null)} title="Confirm receipt?" confirmLabel="Receive" onConfirm={() => run('receive')} body={`Confirm all items arrived at ${to.name}. Batches will be added with original lot and expiry.`} />
      <Confirm open={c === 'cancel'} onClose={() => setC(null)} danger title="Cancel transfer?" confirmLabel="Cancel transfer" onConfirm={() => run('cancel')} body={t.status === 'in_transit' ? `In-transit stock will be returned to ${from.name}.` : 'The draft will be closed.'} />
    </div>
  )
}
