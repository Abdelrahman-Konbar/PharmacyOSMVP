import { useState } from 'react'
import { Plus, ShoppingCart, Send, XCircle, PackageCheck, Pencil, Trash2, Printer, Truck, Save, Mail, Phone, Download, AlertTriangle, Power } from 'lucide-react'
import { useStore, stockOf, stockStatus, inScope, move, logAudit, nextNo, uid, now, addStock, pushNotif, round2, type PO, type Supplier } from '../store'
import { Button, Card, PageHeader, Field, Input, Select, Modal, Confirm, Badge, StatusBadge, Table, Toolbar, SearchInput, KV, Empty, go, fDate, fDateTime, useToast, Tabs, Textarea, Stat, Meter, useLoading, Skeleton } from '../ui'
import { downloadCSV } from './sales'

const qp = () => new URLSearchParams(window.location.hash.split('?')[1] || '')
const poTotal = (p: PO) => round2(p.items.reduce((a, i) => a + i.qty * i.cost, 0))

export function PurchaseOrders() {
  const { db, scope, money, can } = useStore()
  const loading = useLoading()
  const [tab, setTab] = useState('open')
  const [q, setQ] = useState('')
  const [sup, setSup] = useState('all')
  const base = db.pos.filter((p) => inScope(p.branchId, scope))
  const rows = base.filter((p) => (tab === 'all' || (tab === 'open' ? ['draft', 'submitted', 'partially_received'].includes(p.status) : p.status === tab)) && (sup === 'all' || p.supplierId === sup) && (!q || p.no.toLowerCase().includes(q.toLowerCase()))).sort((a, b) => b.date.localeCompare(a.date))
  return (
    <div>
      <PageHeader title="Purchase Orders" subtitle="Order from suppliers, then receive into batch-tracked inventory." actions={can('purchasing') && <Button variant="primary" icon={Plus} onClick={() => go('purchase-orders/new')}>Create PO</Button>} />
      <Card pad={false}>
        <Toolbar>
          <Tabs value={tab} onChange={setTab} tabs={[{ value: 'open', label: 'Open', count: base.filter((p) => ['draft', 'submitted', 'partially_received'].includes(p.status)).length }, { value: 'received', label: 'Received' }, { value: 'cancelled', label: 'Cancelled' }, { value: 'all', label: 'All' }]} />
          <div className="flex-1" />
          <SearchInput value={q} onChange={setQ} placeholder="PO number…" className="w-[200px]" />
          <Select aria-label="Supplier" className="w-[220px]" value={sup} onChange={setSup} options={[{ value: 'all', label: 'All suppliers' }, ...db.suppliers.map((s) => ({ value: s.id, label: s.name }))]} />
        </Toolbar>
        {loading ? <Skeleton /> : <Table rows={rows} rowKey={(r) => r.id} onRow={(r) => go(`purchase-orders/${r.id}`)} empty={<Empty icon={ShoppingCart} title="No purchase orders" action={<Button onClick={() => go('purchase-orders/new')}>Create PO</Button>} />} cols={[
          { key: 'n', label: 'PO', render: (r) => <span className="font-semibold text-teal">{r.no}</span> },
          { key: 's', label: 'Supplier', render: (r) => db.suppliers.find((s) => s.id === r.supplierId)?.name },
          { key: 'b', label: 'Deliver to', render: (r) => db.branches.find((b) => b.id === r.branchId)?.name },
          { key: 'd', label: 'Ordered', render: (r) => fDate(r.date), sort: (r) => r.date },
          { key: 'e', label: 'Expected', render: (r) => { const late = r.expected < new Date().toISOString().slice(0, 10) && ['submitted', 'partially_received'].includes(r.status); return <span className={late ? 'font-semibold text-red-600' : ''}>{fDate(r.expected)}{late && ' · late'}</span> } },
          { key: 'p', label: 'Received', render: (r) => { const o = r.items.reduce((a, i) => a + i.qty, 0), g = r.items.reduce((a, i) => a + i.received, 0); return <div className="flex w-28 items-center gap-2"><Meter value={g} max={o} /><span className="tnum text-[11.5px] text-muted">{g}/{o}</span></div> } },
          { key: 't', label: 'Total', align: 'right', render: (r) => <b>{money(poTotal(r))}</b>, sort: poTotal },
          { key: 'st', label: 'Status', render: (r) => <StatusBadge s={r.status} /> },
        ]} />}
      </Card>
    </div>
  )
}

export function POForm({ id }: { id?: string }) {
  const { db, act, scope, myBranches, me, money } = useStore()
  const toast = useToast()
  const ex = id ? db.pos.find((p) => p.id === id) : undefined
  const [f, setF] = useState(() => {
    if (ex) return { supplierId: ex.supplierId, branchId: ex.branchId, expected: ex.expected, notes: ex.notes, items: ex.items.map((i) => ({ ...i })) }
    const branchId = scope === 'all' ? myBranches[0]?.id : scope
    const p = qp()
    let items: PO['items'] = []
    if (p.get('product')) { const pr = db.products.find((x) => x.id === p.get('product')); if (pr) items = [{ productId: pr.id, qty: Math.max(10, pr.reorder * 2), cost: pr.cost, received: 0 }] }
    if (p.get('low')) items = db.products.filter((x) => x.status === 'active' && stockStatus(db, x, branchId) !== 'ok').map((x) => ({ productId: x.id, qty: Math.max(5, x.reorder * 2 - stockOf(db, x.id, branchId)), cost: x.cost, received: 0 }))
    return { supplierId: db.suppliers.find((s) => s.status === 'active')!.id, branchId, expected: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10), notes: '', items }
  })
  const [add, setAdd] = useState('')
  const [err, setErr] = useState<Record<string, string>>({})
  if (id && (!ex || ex.status !== 'draft')) return <Empty title="This PO can't be edited" body="Only drafts are editable." action={<Button onClick={() => go(id ? `purchase-orders/${id}` : 'purchase-orders')}>Back</Button>} />
  const total = round2(f.items.reduce((a, i) => a + i.qty * i.cost, 0))
  const save = (submit: boolean) => {
    const er: Record<string, string> = {}
    if (!f.items.length) er.items = 'Add at least one product'
    if (f.items.some((i) => !(i.qty > 0) || !(i.cost >= 0))) er.items = 'Every line needs a quantity and cost'
    if (!f.expected) er.expected = 'Expected date is required'
    setErr(er)
    if (Object.keys(er).length) return
    let pid = id || ''
    act((d) => {
      const sup = d.suppliers.find((s) => s.id === f.supplierId)!
      if (id) { const p = d.pos.find((x) => x.id === id)!; Object.assign(p, f, { status: submit ? 'submitted' : 'draft' }); logAudit(d, submit ? 'po.submit' : 'po.update', p.no, submit ? `Submitted to ${sup.name}` : 'Draft updated', p.branchId) }
      else { pid = uid('po'); const no = nextNo(d, 'PO'); d.pos.unshift({ id: pid, no, ...f, date: now(), status: submit ? 'submitted' : 'draft', userId: me!.id }); logAudit(d, submit ? 'po.submit' : 'po.create', no, `${f.items.length} lines · ${sup.name}`, f.branchId) }
    })
    toast({ kind: 'success', title: submit ? 'PO submitted' : 'Draft saved', body: submit ? 'Marked as sent. Email/EDI delivery to suppliers is not connected in this demo.' : undefined })
    go(`purchase-orders/${pid}`)
  }
  const sup = db.suppliers.find((s) => s.id === f.supplierId)
  return (
    <div>
      <PageHeader back={id ? `purchase-orders/${id}` : 'purchase-orders'} title={id ? `Edit ${ex!.no}` : 'Create purchase order'} actions={<><Button icon={Save} onClick={() => save(false)}>Save draft</Button><Button variant="primary" icon={Send} onClick={() => save(true)}>Submit to supplier</Button></>} />
      <div className="grid grid-cols-3 gap-4">
        <Card className="col-span-2" title="Order lines" pad={false} action={<span className="text-[12.5px] text-muted">{f.items.length} products</span>}>
          <div className="flex gap-2 border-b border-line p-4">
            <Select aria-label="Add product" className="flex-1" value={add} onChange={setAdd} options={[{ value: '', label: 'Add a product…' }, ...db.products.filter((p) => p.status === 'active' && !f.items.find((i) => i.productId === p.id)).map((p) => ({ value: p.id, label: `${p.name} ${p.strength} — on hand ${stockOf(db, p.id, f.branchId)}` }))]} />
            <Button icon={Plus} disabled={!add} onClick={() => { const p = db.products.find((x) => x.id === add)!; setF({ ...f, items: [...f.items, { productId: p.id, qty: Math.max(10, p.reorder * 2), cost: p.cost, received: 0 }] }); setAdd('') }}>Add</Button>
          </div>
          {f.items.length === 0 ? <Empty icon={ShoppingCart} title="No lines yet" body="Add products above, or start from Inventory → Reorder low stock." /> : (
            <table className="w-full text-[13px]"><thead><tr className="border-b border-line bg-[#fafcfd] text-[11px] font-bold tracking-wider text-muted uppercase"><th className="px-4 py-2 text-left">Product</th><th className="px-4 py-2 text-right">On hand</th><th className="px-4 py-2 text-right">Qty</th><th className="px-4 py-2 text-right">Unit cost</th><th className="px-4 py-2 text-right">Line total</th><th /></tr></thead>
              <tbody>{f.items.map((i, k) => { const p = db.products.find((x) => x.id === i.productId)!; return (
                <tr key={i.productId} className="border-b border-line/70">
                  <td className="px-4 py-2"><b>{p.name}</b> <span className="text-muted">{p.strength}</span></td>
                  <td className="tnum px-4 py-2 text-right text-muted">{stockOf(db, p.id, f.branchId)}</td>
                  <td className="px-4 py-2 text-right"><Input aria-label="Qty" className="tnum ml-auto h-8 w-20 text-right" value={i.qty} onChange={(e) => { const it = [...f.items]; it[k] = { ...i, qty: parseInt(e.target.value) || 0 }; setF({ ...f, items: it }) }} /></td>
                  <td className="px-4 py-2 text-right"><Input aria-label="Cost" className="tnum ml-auto h-8 w-24 text-right" value={i.cost} onChange={(e) => { const it = [...f.items]; it[k] = { ...i, cost: parseFloat(e.target.value) || 0 }; setF({ ...f, items: it }) }} /></td>
                  <td className="tnum px-4 py-2 text-right font-semibold">{(i.qty * i.cost).toFixed(2)}</td>
                  <td className="px-2"><button aria-label="Remove line" onClick={() => setF({ ...f, items: f.items.filter((_, j) => j !== k) })} className="rounded p-1 text-muted hover:bg-red-50 hover:text-red-600"><Trash2 className="size-4" /></button></td>
                </tr>) })}</tbody></table>
          )}
          {err.items && <div className="px-4 py-3 text-[12.5px] font-medium text-red-600">{err.items}</div>}
          <div className="flex justify-end border-t border-line px-5 py-4 text-[15px]"><span className="mr-6 text-muted">Order total</span><b className="tnum">{money(total)}</b></div>
        </Card>
        <Card title="Order details">
          <div className="space-y-3.5">
            <Field label="Supplier"><Select value={f.supplierId} onChange={(v) => setF({ ...f, supplierId: v })} options={db.suppliers.filter((s) => s.status === 'active').map((s) => ({ value: s.id, label: s.name }))} /></Field>
            {sup && <div className="rounded-lg bg-canvas p-3 text-[12px] text-muted">{sup.terms} · lead time {sup.leadDays} days · {sup.email}</div>}
            <Field label="Deliver to branch"><Select value={f.branchId} onChange={(v) => setF({ ...f, branchId: v })} options={myBranches.map((b) => ({ value: b.id, label: b.name }))} /></Field>
            <Field label="Expected delivery" error={err.expected}><Input type="date" value={f.expected} onChange={(e) => setF({ ...f, expected: e.target.value })} /></Field>
            <Field label="Notes to supplier"><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
          </div>
        </Card>
      </div>
    </div>
  )
}

export function PODetails({ id }: { id: string }) {
  const { db, act, money, can } = useStore()
  const toast = useToast()
  const [c, setC] = useState<'submit' | 'cancel' | null>(null)
  const p = db.pos.find((x) => x.id === id)
  if (!p) return <Empty title="PO not found" action={<Button onClick={() => go('purchase-orders')}>Back</Button>} />
  const sup = db.suppliers.find((s) => s.id === p.supplierId)!
  const grns = db.receipts.filter((r) => r.poId === id)
  const steps = ['draft', 'submitted', 'partially_received', 'received']
  const idx = steps.indexOf(p.status)
  const setStatus = (s: PO['status']) => { act((d) => { const x = d.pos.find((x) => x.id === id)!; x.status = s; logAudit(d, `po.${s === 'submitted' ? 'submit' : 'cancel'}`, x.no, s === 'submitted' ? `Submitted to ${sup.name}` : 'Cancelled', x.branchId) }); toast({ kind: s === 'cancelled' ? 'info' : 'success', title: s === 'cancelled' ? 'PO cancelled' : 'PO submitted' }) }
  return (
    <div>
      <PageHeader back="purchase-orders" title={<span className="flex items-center gap-3">{p.no}<StatusBadge s={p.status} /></span>} subtitle={`${sup.name} → ${db.branches.find((b) => b.id === p.branchId)?.name}`}
        actions={can('purchasing') && <>
          <Button icon={Printer} onClick={() => window.print()}>Print</Button>
          {['draft', 'submitted'].includes(p.status) && <Button icon={XCircle} onClick={() => setC('cancel')}>Cancel PO</Button>}
          {p.status === 'draft' && <><Button icon={Pencil} onClick={() => go(`purchase-orders/${id}/edit`)}>Edit</Button><Button variant="primary" icon={Send} onClick={() => setC('submit')}>Submit</Button></>}
          {['submitted', 'partially_received'].includes(p.status) && <Button variant="primary" icon={PackageCheck} onClick={() => go(`receive/${id}`)}>Receive goods</Button>}
        </>} />
      {p.status !== 'cancelled' && (
        <div className="mb-4 flex items-center rounded-xl border border-line bg-white px-6 py-4">
          {['Draft', 'Submitted', 'Partially received', 'Received'].map((s, i) => (
            <div key={s} className="flex flex-1 items-center last:flex-none">
              <div className="flex items-center gap-2"><span className={`grid size-6 place-items-center rounded-full text-[11px] font-bold ${i <= idx ? 'bg-teal text-white' : 'bg-canvas text-muted ring-1 ring-line'}`}>{i + 1}</span><span className={`text-[12.5px] font-semibold ${i <= idx ? 'text-ink' : 'text-muted'}`}>{s}</span></div>
              {i < 3 && <div className={`mx-3 h-px flex-1 ${i < idx ? 'bg-teal' : 'bg-line'}`} />}
            </div>
          ))}
        </div>
      )}
      <div className="grid grid-cols-3 gap-4">
        <Card className="col-span-2" title="Lines" pad={false}>
          <Table rows={p.items} rowKey={(i) => i.productId} cols={[
            { key: 'p', label: 'Product', render: (i) => { const pr = db.products.find((x) => x.id === i.productId)!; return <button onClick={() => go(`products/${pr.id}`)} className="font-semibold hover:text-teal">{pr.name} <span className="font-normal text-muted">{pr.strength}</span></button> } },
            { key: 'o', label: 'Ordered', align: 'right', render: (i) => i.qty },
            { key: 'r', label: 'Received', align: 'right', render: (i) => <span className={i.received >= i.qty ? 'font-semibold text-emerald-700' : i.received ? 'font-semibold text-amber-700' : 'text-muted'}>{i.received}</span> },
            { key: 'c', label: 'Unit cost', align: 'right', render: (i) => i.cost.toFixed(2) },
            { key: 't', label: 'Total', align: 'right', render: (i) => <b>{(i.qty * i.cost).toFixed(2)}</b> },
          ]} />
          <div className="flex justify-end border-t border-line px-5 py-4 text-[15px]"><span className="mr-6 text-muted">Order total</span><b className="tnum">{money(poTotal(p))}</b></div>
        </Card>
        <div className="space-y-4">
          <Card title="Details"><KV items={[['Ordered', fDate(p.date)], ['Expected', fDate(p.expected)], ['Terms', sup.terms], ['Created by', db.users.find((u) => u.id === p.userId)?.name], ['Supplier', <button className="font-semibold text-teal" onClick={() => go(`suppliers/${sup.id}`)}>{sup.name}</button>], ['Notes', p.notes || '—']]} /></Card>
          <Card title="Goods receipts" pad={false}>{grns.length === 0 ? <div className="p-5 text-[13px] text-muted">Nothing received yet.</div> : grns.map((g) => <div key={g.id} className="border-b border-line/70 px-5 py-3 last:border-0"><div className="flex justify-between"><b className="text-[13px]">{g.no}</b><span className="text-[12px] text-muted">{fDateTime(g.date)}</span></div><div className="text-[12px] text-muted">{g.items.reduce((a, i) => a + i.qty, 0)} units · Inv {g.invoiceRef} · {db.users.find((u) => u.id === g.userId)?.name}</div></div>)}</Card>
        </div>
      </div>
      <Confirm open={c === 'submit'} onClose={() => setC(null)} title="Submit purchase order?" body={`${p.no} will be marked as sent to ${sup.name}. Supplier email/EDI integration is simulated — share the printed PO directly.`} confirmLabel="Submit" onConfirm={() => setStatus('submitted')} />
      <Confirm open={c === 'cancel'} onClose={() => setC(null)} danger title="Cancel purchase order?" body="The PO will be closed and can no longer be received." confirmLabel="Cancel PO" onConfirm={() => setStatus('cancelled')} />
    </div>
  )
}

export function Receipts() {
  const { db, scope, money, can } = useStore()
  const [pick, setPick] = useState(false)
  const [q, setQ] = useState('')
  const open = db.pos.filter((p) => inScope(p.branchId, scope) && ['submitted', 'partially_received'].includes(p.status))
  const rows = db.receipts.filter((r) => inScope(r.branchId, scope) && (!q || `${r.no} ${r.invoiceRef} ${db.pos.find((p) => p.id === r.poId)?.no}`.toLowerCase().includes(q.toLowerCase()))).sort((a, b) => b.date.localeCompare(a.date))
  return (
    <div>
      <PageHeader title="Goods Receipts" subtitle="Every receipt creates batches with lot and expiry, and updates the PO." actions={can('purchasing') && <Button variant="primary" icon={PackageCheck} onClick={() => setPick(true)}>Receive goods</Button>} />
      {open.length > 0 && <div className="mb-4 grid grid-cols-3 gap-3">{open.slice(0, 3).map((p) => <button key={p.id} onClick={() => go(`receive/${p.id}`)} className="flex items-center gap-3 rounded-xl border border-dashed border-teal/40 bg-teal/[0.03] p-4 text-left transition hover:border-teal hover:bg-teal/[0.06]"><span className="grid size-9 place-items-center rounded-lg bg-teal/10 text-teal"><Truck className="size-4" /></span><div className="flex-1"><div className="text-[13px] font-bold">{p.no} · awaiting</div><div className="text-[12px] text-muted">{db.suppliers.find((s) => s.id === p.supplierId)?.name} · expected {fDate(p.expected)}</div></div><StatusBadge s={p.status} /></button>)}</div>}
      <Card pad={false}>
        <Toolbar><SearchInput value={q} onChange={setQ} placeholder="GRN, PO or supplier invoice…" className="w-[300px]" /></Toolbar>
        <Table rows={rows} rowKey={(r) => r.id} onRow={(r) => go(`purchase-orders/${r.poId}`)} empty={<Empty icon={PackageCheck} title="No receipts yet" />} cols={[
          { key: 'n', label: 'GRN', render: (r) => <span className="font-semibold text-teal">{r.no}</span> },
          { key: 'po', label: 'PO', render: (r) => db.pos.find((p) => p.id === r.poId)?.no },
          { key: 's', label: 'Supplier', render: (r) => db.suppliers.find((s) => s.id === db.pos.find((p) => p.id === r.poId)?.supplierId)?.name },
          { key: 'b', label: 'Branch', render: (r) => db.branches.find((b) => b.id === r.branchId)?.name },
          { key: 'i', label: 'Supplier inv.', render: (r) => <span className="font-mono text-[12px]">{r.invoiceRef}</span> },
          { key: 'd', label: 'Received', render: (r) => fDateTime(r.date), sort: (r) => r.date },
          { key: 'u', label: 'Units', align: 'right', render: (r) => r.items.reduce((a, i) => a + i.qty, 0) },
          { key: 'v', label: 'Value', align: 'right', render: (r) => <b>{money(r.items.reduce((a, i) => a + i.qty * i.cost, 0))}</b> },
        ]} />
      </Card>
      <Modal open={pick} onClose={() => setPick(false)} title="Select purchase order" desc="Goods are received against an open PO." width={520}>
        {open.length === 0 ? <Empty icon={ShoppingCart} title="No open POs" body="Submit a purchase order first." action={<Button onClick={() => go('purchase-orders/new')}>Create PO</Button>} /> : <div className="space-y-2">{open.map((p) => <button key={p.id} onClick={() => go(`receive/${p.id}`)} className="flex w-full items-center justify-between rounded-lg border border-line p-3 text-left hover:border-teal"><div><b className="text-[13px]">{p.no}</b><div className="text-[12px] text-muted">{db.suppliers.find((s) => s.id === p.supplierId)?.name} · {db.branches.find((b) => b.id === p.branchId)?.name}</div></div><StatusBadge s={p.status} /></button>)}</div>}
      </Modal>
    </div>
  )
}

export function Receiving({ poId }: { poId: string }) {
  const { db, act, money } = useStore()
  const toast = useToast()
  const p = db.pos.find((x) => x.id === poId)
  const [lines, setLines] = useState(() => (p?.items || []).filter((i) => i.received < i.qty).map((i) => ({ productId: i.productId, remaining: i.qty - i.received, qty: String(i.qty - i.received), lot: '', expiry: '', cost: String(i.cost) })))
  const [inv, setInv] = useState('')
  const [err, setErr] = useState<Record<string, string>>({})
  const [confirm, setConfirm] = useState(false)
  if (!p || !['submitted', 'partially_received'].includes(p.status)) return <Empty title="Nothing to receive" body="This PO isn't open for receiving." action={<Button onClick={() => go('receipts')}>Back to receipts</Button>} />
  const sup = db.suppliers.find((s) => s.id === p.supplierId)!
  const td = new Date().toISOString().slice(0, 10)
  const validate = () => {
    const er: Record<string, string> = {}
    if (!inv.trim()) er.inv = 'Supplier invoice / delivery note is required'
    lines.forEach((l, i) => {
      const q = parseInt(l.qty) || 0
      if (q < 0 || q > l.remaining) er[`q${i}`] = `0–${l.remaining}`
      if (q > 0 && !l.lot.trim()) er[`l${i}`] = 'Lot required'
      if (q > 0 && !l.expiry) er[`e${i}`] = 'Expiry required'
      else if (q > 0 && l.expiry <= td) er[`e${i}`] = 'Already expired'
    })
    if (!lines.some((l) => (parseInt(l.qty) || 0) > 0)) er.inv = er.inv || 'Enter at least one received quantity'
    setErr(er)
    return !Object.keys(er).length
  }
  const total = lines.reduce((a, l) => a + (parseInt(l.qty) || 0) * (+l.cost || 0), 0)
  const commit = () => {
    act((d) => {
      const po = d.pos.find((x) => x.id === poId)!
      const no = nextNo(d, 'GRN')
      const items = lines.filter((l) => (parseInt(l.qty) || 0) > 0).map((l) => ({ productId: l.productId, qty: parseInt(l.qty), lot: l.lot.trim().toUpperCase(), expiry: l.expiry, cost: +l.cost }))
      items.forEach((i) => { addStock(d, i.productId, po.branchId, i.lot, i.expiry, i.qty, i.cost); move(d, { productId: i.productId, branchId: po.branchId, lot: i.lot, type: 'receipt', qty: i.qty, ref: no }); po.items.find((x) => x.productId === i.productId)!.received += i.qty })
      po.status = po.items.every((i) => i.received >= i.qty) ? 'received' : 'partially_received'
      d.receipts.unshift({ id: uid('gr'), no, poId, date: now(), branchId: po.branchId, userId: d.session!.userId, items, invoiceRef: inv.trim() })
      pushNotif(d, { title: `${po.no} ${po.status === 'received' ? 'fully received' : 'partially received'}`, body: `${items.reduce((a, i) => a + i.qty, 0)} units added to stock via ${no}.`, type: 'purchase', link: `purchase-orders/${po.id}`, branchId: po.branchId })
      logAudit(d, 'receipt.create', no, `${items.reduce((a, i) => a + i.qty, 0)} units against ${po.no}`, po.branchId)
    })
    toast({ kind: 'success', title: 'Goods received', body: 'Batches created and stock is now sellable.' })
    go(`purchase-orders/${poId}`)
  }
  const up = (i: number, k: string, v: string) => setLines(lines.map((l, j) => (j === i ? { ...l, [k]: v } : l)))
  return (
    <div>
      <PageHeader back={`purchase-orders/${poId}`} eyebrow="Goods receiving" title={`Receive ${p.no}`} subtitle={`${sup.name} → ${db.branches.find((b) => b.id === p.branchId)?.name}`} actions={<Button variant="primary" icon={PackageCheck} onClick={() => validate() && setConfirm(true)}>Post receipt</Button>} />
      <div className="mb-4 grid grid-cols-3 gap-4">
        <Card><Field label="Supplier invoice / delivery note *" error={err.inv}><Input autoFocus value={inv} onChange={(e) => setInv(e.target.value)} invalid={!!err.inv} placeholder="e.g. NMD-88214" /></Field></Card>
        <Stat label="Lines to receive" value={lines.length} icon={Truck} />
        <Stat label="Receipt value" value={money(total)} icon={PackageCheck} tone="navy" />
      </div>
      <Card pad={false} title="Check each line against the physical delivery">
        <table className="w-full text-[13px]"><thead><tr className="border-b border-line bg-[#fafcfd] text-[11px] font-bold tracking-wider text-muted uppercase"><th className="px-4 py-2 text-left">Product</th><th className="px-4 py-2 text-right">Outstanding</th><th className="px-4 py-2 text-left">Received qty</th><th className="px-4 py-2 text-left">Lot / batch</th><th className="px-4 py-2 text-left">Expiry</th><th className="px-4 py-2 text-left">Unit cost</th></tr></thead>
          <tbody>{lines.map((l, i) => { const pr = db.products.find((x) => x.id === l.productId)!; const short = l.expiry && l.expiry > td && (new Date(l.expiry).getTime() - Date.now()) / 86400000 < 180; return (
            <tr key={l.productId} className="border-b border-line/70 align-top">
              <td className="px-4 py-3"><b>{pr.name}</b> <span className="text-muted">{pr.strength}</span>{pr.rx && <span className="ml-1"><Badge tone="blue">Rx</Badge></span>}</td>
              <td className="tnum px-4 py-3 text-right">{l.remaining}</td>
              <td className="px-4 py-2"><Input aria-label="Received qty" className="tnum w-20" value={l.qty} invalid={!!err[`q${i}`]} onChange={(e) => up(i, 'qty', e.target.value.replace(/\D/g, ''))} />{err[`q${i}`] && <div className="mt-1 text-[11px] text-red-600">{err[`q${i}`]}</div>}</td>
              <td className="px-4 py-2"><Input aria-label="Lot" className="w-32 font-mono uppercase" value={l.lot} invalid={!!err[`l${i}`]} onChange={(e) => up(i, 'lot', e.target.value)} placeholder="L2501A" />{err[`l${i}`] && <div className="mt-1 text-[11px] text-red-600">{err[`l${i}`]}</div>}</td>
              <td className="px-4 py-2"><Input aria-label="Expiry" type="date" className="w-40" value={l.expiry} invalid={!!err[`e${i}`]} onChange={(e) => up(i, 'expiry', e.target.value)} />{err[`e${i}`] ? <div className="mt-1 text-[11px] text-red-600">{err[`e${i}`]}</div> : short && <div className="mt-1 flex items-center gap-1 text-[11px] text-amber-700"><AlertTriangle className="size-3" />Short-dated (&lt;6 months)</div>}</td>
              <td className="px-4 py-2"><Input aria-label="Cost" className="tnum w-24" value={l.cost} onChange={(e) => up(i, 'cost', e.target.value.replace(/[^\d.]/g, ''))} /></td>
            </tr>) })}</tbody></table>
      </Card>
      <Confirm open={confirm} onClose={() => setConfirm(false)} title="Post goods receipt?" confirmLabel="Post receipt" onConfirm={commit} body={`${lines.reduce((a, l) => a + (parseInt(l.qty) || 0), 0)} units (${money(total)}) will be added to ${db.branches.find((b) => b.id === p.branchId)?.name} as new batches. Unreceived quantities stay open on the PO.`} />
    </div>
  )
}

const emptySup: Omit<Supplier, 'id'> = { name: '', contact: '', email: '', phone: '', terms: 'Net 30', leadDays: 3, status: 'active', license: '', address: '' }
function SupplierModal({ open, onClose, initial }: { open: boolean; onClose: () => void; initial?: Supplier }) {
  const { act } = useStore()
  const toast = useToast()
  const [f, setF] = useState<Omit<Supplier, 'id'>>(initial || emptySup)
  const [err, setErr] = useState<Record<string, string>>({})
  const set = (k: keyof Supplier) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: k === 'leadDays' ? parseInt(e.target.value) || 0 : e.target.value })
  const save = () => {
    const er: Record<string, string> = {}
    if (!f.name.trim()) er.name = 'Required'
    if (!/^\S+@\S+\.\S+$/.test(f.email)) er.email = 'Valid email required'
    if (!f.phone.trim()) er.phone = 'Required'
    setErr(er)
    if (Object.keys(er).length) return
    act((d) => { if (initial) Object.assign(d.suppliers.find((s) => s.id === initial.id)!, f); else d.suppliers.push({ ...f, id: uid('s') }); logAudit(d, initial ? 'supplier.update' : 'supplier.create', f.name, '') })
    toast({ kind: 'success', title: initial ? 'Supplier updated' : 'Supplier added' })
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit supplier' : 'Add supplier'} width={560} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Save</Button></>}>
      <div className="grid grid-cols-2 gap-3.5">
        <Field label="Company name *" error={err.name} className="col-span-2"><Input value={f.name} onChange={set('name')} invalid={!!err.name} autoFocus /></Field>
        <Field label="Contact person"><Input value={f.contact} onChange={set('contact')} /></Field>
        <Field label="Distribution license" hint="Recorded only — not verified"><Input value={f.license} onChange={set('license')} /></Field>
        <Field label="Email *" error={err.email}><Input value={f.email} onChange={set('email')} invalid={!!err.email} /></Field>
        <Field label="Phone *" error={err.phone}><Input value={f.phone} onChange={set('phone')} invalid={!!err.phone} /></Field>
        <Field label="Payment terms"><Select value={f.terms} onChange={(v) => setF({ ...f, terms: v })} options={['Cash on delivery', 'Net 15', 'Net 30', 'Net 45', 'Net 60'].map((x) => ({ value: x, label: x }))} /></Field>
        <Field label="Lead time (days)"><Input value={f.leadDays} onChange={set('leadDays')} inputMode="numeric" /></Field>
        <Field label="Address" className="col-span-2"><Input value={f.address} onChange={set('address')} /></Field>
      </div>
    </Modal>
  )
}

export function Suppliers() {
  const { db, money, can } = useStore()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const rows = db.suppliers.filter((s) => !q || `${s.name} ${s.contact} ${s.email}`.toLowerCase().includes(q.toLowerCase()))
  const spend = (id: string) => db.pos.filter((p) => p.supplierId === id && p.status !== 'cancelled' && p.status !== 'draft').reduce((a, p) => a + poTotal(p), 0)
  return (
    <div>
      <PageHeader title="Suppliers" subtitle={`${db.suppliers.filter((s) => s.status === 'active').length} active distributors`} actions={<><Button icon={Download} onClick={() => downloadCSV('suppliers.csv', [['Name', 'Contact', 'Email', 'Phone', 'Terms'], ...rows.map((s) => [s.name, s.contact, s.email, s.phone, s.terms])])}>Export</Button>{can('suppliers') && <Button variant="primary" icon={Plus} onClick={() => setOpen(true)}>Add supplier</Button>}</>} />
      <Card pad={false}>
        <Toolbar><SearchInput value={q} onChange={setQ} placeholder="Search suppliers…" className="w-[300px]" /></Toolbar>
        <Table rows={rows} rowKey={(s) => s.id} onRow={(s) => go(`suppliers/${s.id}`)} cols={[
          { key: 'n', label: 'Supplier', render: (s) => <div className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-lg bg-navy text-[11px] font-bold text-mint">{s.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span><div><b>{s.name}</b><div className="text-[11.5px] text-muted">{s.license}</div></div></div> },
          { key: 'c', label: 'Contact', render: (s) => <div><div>{s.contact}</div><div className="text-[11.5px] text-muted">{s.email}</div></div> },
          { key: 't', label: 'Terms', render: (s) => s.terms },
          { key: 'l', label: 'Lead time', render: (s) => `${s.leadDays} days` },
          { key: 'o', label: 'Open POs', align: 'right', render: (s) => db.pos.filter((p) => p.supplierId === s.id && ['submitted', 'partially_received'].includes(p.status)).length },
          { key: 'sp', label: 'Total spend', align: 'right', render: (s) => <b>{money(spend(s.id))}</b>, sort: (s) => spend(s.id) },
          { key: 'st', label: 'Status', render: (s) => <StatusBadge s={s.status} /> },
        ]} />
      </Card>
      {open && <SupplierModal open onClose={() => setOpen(false)} />}
    </div>
  )
}

export function SupplierDetails({ id }: { id: string }) {
  const { db, act, money, can } = useStore()
  const toast = useToast()
  const [edit, setEdit] = useState(false)
  const [tog, setTog] = useState(false)
  const s = db.suppliers.find((x) => x.id === id)
  if (!s) return <Empty title="Supplier not found" action={<Button onClick={() => go('suppliers')}>Back</Button>} />
  const pos = db.pos.filter((p) => p.supplierId === id).sort((a, b) => b.date.localeCompare(a.date))
  const received = pos.filter((p) => p.status === 'received')
  const onTime = received.filter((p) => { const g = db.receipts.filter((r) => r.poId === p.id).pop(); return g && g.date.slice(0, 10) <= p.expected }).length
  return (
    <div>
      <PageHeader back="suppliers" title={<span className="flex items-center gap-3">{s.name}<StatusBadge s={s.status} /></span>} subtitle={s.address}
        actions={can('suppliers') && <><Button icon={Power} onClick={() => setTog(true)}>{s.status === 'active' ? 'Deactivate' : 'Activate'}</Button><Button icon={Pencil} onClick={() => setEdit(true)}>Edit</Button>{s.status === 'active' && <Button variant="primary" icon={Plus} onClick={() => go('purchase-orders/new')}>New PO</Button>}</>} />
      <div className="mb-4 grid grid-cols-4 gap-4">
        <Stat label="Total spend" value={money(pos.filter((p) => !['draft', 'cancelled'].includes(p.status)).reduce((a, p) => a + poTotal(p), 0))} icon={ShoppingCart} tone="navy" />
        <Stat label="Purchase orders" value={pos.length} icon={ShoppingCart} />
        <Stat label="Open" value={pos.filter((p) => ['submitted', 'partially_received'].includes(p.status)).length} icon={Truck} tone="blue" />
        <Stat label="On-time delivery" value={received.length ? `${Math.round((onTime / received.length) * 100)}%` : '—'} sub={`${received.length} completed POs`} icon={PackageCheck} tone="amber" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Card className="col-span-2" title="Purchase history" pad={false}>
          <Table rows={pos} rowKey={(p) => p.id} onRow={(p) => go(`purchase-orders/${p.id}`)} empty={<Empty icon={ShoppingCart} title="No orders with this supplier yet" />} cols={[
            { key: 'n', label: 'PO', render: (p) => <span className="font-semibold text-teal">{p.no}</span> },
            { key: 'b', label: 'Branch', render: (p) => db.branches.find((b) => b.id === p.branchId)?.name },
            { key: 'd', label: 'Date', render: (p) => fDate(p.date) },
            { key: 't', label: 'Total', align: 'right', render: (p) => money(poTotal(p)) },
            { key: 's', label: 'Status', render: (p) => <StatusBadge s={p.status} /> },
          ]} />
        </Card>
        <Card title="Contact">
          <KV items={[['Contact', s.contact], ['Terms', s.terms], ['Lead time', `${s.leadDays} days`], ['License', s.license || '—']]} />
          <div className="mt-5 flex gap-2"><a href={`mailto:${s.email}`} className="flex-1"><Button className="w-full" icon={Mail}>Email</Button></a><a href={`tel:${s.phone}`} className="flex-1"><Button className="w-full" icon={Phone}>Call</Button></a></div>
          <div className="mt-2 text-[12px] text-muted">{s.email} · {s.phone}</div>
        </Card>
      </div>
      {edit && <SupplierModal open initial={s} onClose={() => setEdit(false)} />}
      <Confirm open={tog} onClose={() => setTog(false)} danger={s.status === 'active'} title={s.status === 'active' ? 'Deactivate supplier?' : 'Activate supplier?'} body={s.status === 'active' ? 'Inactive suppliers cannot receive new purchase orders. Existing POs are unaffected.' : 'The supplier will be available for new purchase orders.'} confirmLabel={s.status === 'active' ? 'Deactivate' : 'Activate'}
        onConfirm={() => { act((d) => { const x = d.suppliers.find((x) => x.id === id)!; x.status = x.status === 'active' ? 'inactive' : 'active'; logAudit(d, 'supplier.status', x.name, x.status) }); toast({ kind: 'success', title: 'Supplier updated' }) }} />
    </div>
  )
}
