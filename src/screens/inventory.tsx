import { useMemo, useState } from 'react'
import { Plus, Pill, Pencil, Archive, ArchiveRestore, SlidersHorizontal, Boxes, CalendarClock, AlertTriangle, ClipboardCheck, Download, Save, CheckCircle2, Eye, EyeOff, ShoppingCart, ArrowLeftRight, PackagePlus } from 'lucide-react'
import { useStore, stockOf, stockStatus, daysToExpiry, isExpired, inScope, move, logAudit, nextNo, uid, now, addStock, checkLowStock, type Product, type MoveType } from '../store'
import { Button, Card, PageHeader, Field, Input, Select, Modal, Confirm, Badge, StatusBadge, Table, Toolbar, SearchInput, KV, Empty, go, fDate, fDateTime, useToast, cx, Tabs, Toggle, Stat, useLoading, Skeleton, useRoute, Meter } from '../ui'
import { downloadCSV } from './sales'

const CATS = ['Analgesics', 'Antibiotics', 'Diabetes', 'Cardiovascular', 'Gastro', 'Allergy', 'Respiratory', 'Vitamins', 'Dermatology', 'Endocrine', 'Devices']

export function Products() {
  const { db, scope, money, can } = useStore()
  const loading = useLoading()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('all')
  const [st, setSt] = useState('all')
  const [arch, setArch] = useState(false)
  const rows = db.products.filter((p) => (arch ? p.status === 'archived' : p.status === 'active') && (cat === 'all' || p.category === cat) && (st === 'all' || (st === 'rx' ? p.rx : st === 'otc' ? !p.rx : stockStatus(db, p, scope) === st)) && (!q || `${p.name} ${p.nameAr} ${p.generic} ${p.sku} ${p.barcode} ${p.manufacturer}`.toLowerCase().includes(q.toLowerCase())))
  return (
    <div>
      <PageHeader title="Products" subtitle={`${db.products.filter((p) => p.status === 'active').length} active SKUs in the catalog`} actions={<><Button icon={Download} onClick={() => downloadCSV('products.csv', [['SKU', 'Barcode', 'Name', 'Generic', 'Category', 'Price', 'Cost', 'Stock'], ...rows.map((p) => [p.sku, p.barcode, p.name, p.generic, p.category, p.price, p.cost, stockOf(db, p.id, scope)])])}>Export</Button>{can('products.edit') && <Button variant="primary" icon={Plus} onClick={() => go('products/new')}>Add product</Button>}</>} />
      <Card pad={false}>
        <Toolbar>
          <SearchInput value={q} onChange={setQ} placeholder="Name, generic, SKU, barcode…" className="w-[300px]" />
          <Select aria-label="Category" className="w-[160px]" value={cat} onChange={setCat} options={[{ value: 'all', label: 'All categories' }, ...CATS.map((c) => ({ value: c, label: c }))]} />
          <Select aria-label="Filter" className="w-[150px]" value={st} onChange={setSt} options={[{ value: 'all', label: 'Any status' }, { value: 'ok', label: 'In stock' }, { value: 'low', label: 'Low stock' }, { value: 'out', label: 'Out of stock' }, { value: 'rx', label: 'Prescription' }, { value: 'otc', label: 'OTC' }]} />
          <div className="flex-1" />
          <label className="flex items-center gap-2 text-[12.5px] font-semibold text-muted"><Toggle checked={arch} onChange={setArch} label="Show archived" />Archived</label>
        </Toolbar>
        {loading ? <Skeleton /> : <Table rows={rows} rowKey={(r) => r.id} onRow={(r) => go(`products/${r.id}`)} pageSize={15} empty={<Empty icon={Pill} title="No products found" body="Adjust filters or add a new product." action={can('products.edit') && <Button onClick={() => go('products/new')}>Add product</Button>} />} cols={[
          { key: 'n', label: 'Product', sort: (r) => r.name, render: (r) => <div className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-lg bg-canvas text-teal ring-1 ring-line"><Pill className="size-4" /></span><div><div className="font-semibold">{r.name} <span className="font-normal text-muted">{r.strength}</span></div><div className="text-[11.5px] text-muted">{r.generic}</div></div></div> },
          { key: 'sku', label: 'SKU', render: (r) => <span className="font-mono text-[12px] text-muted">{r.sku}</span> },
          { key: 'c', label: 'Category', render: (r) => r.category, sort: (r) => r.category },
          { key: 'rx', label: 'Type', render: (r) => (r.rx ? <Badge tone="blue">Rx</Badge> : <Badge>OTC</Badge>) },
          { key: 'p', label: 'Price', align: 'right', render: (r) => money(r.price), sort: (r) => r.price },
          { key: 'm', label: 'Margin', align: 'right', render: (r) => <span className="text-muted">{Math.round(((r.price - r.cost) / r.price) * 100)}%</span> },
          { key: 's', label: 'On hand', align: 'right', render: (r) => <b>{stockOf(db, r.id, scope)}</b>, sort: (r) => stockOf(db, r.id, scope) },
          { key: 'st', label: 'Status', render: (r) => <StatusBadge s={stockStatus(db, r, scope)} /> },
        ]} />}
      </Card>
    </div>
  )
}

export function ProductForm({ id }: { id?: string }) {
  const { db, act } = useStore()
  const toast = useToast()
  const ex = id ? db.products.find((p) => p.id === id) : undefined
  const [f, setF] = useState<Omit<Product, 'id' | 'price' | 'cost' | 'reorder'> & { price: string; cost: string; reorder: string }>(
    ex ? { ...ex, price: String(ex.price), cost: String(ex.cost), reorder: String(ex.reorder) } : { sku: `SKU-${1001 + db.products.length}`, barcode: '', name: '', nameAr: '', generic: '', category: 'Analgesics', form: 'Tablet', strength: '', manufacturer: '', price: '', cost: '', reorder: '10', rx: false, taxable: true, status: 'active' },
  )
  const [err, setErr] = useState<Record<string, string>>({})
  if (id && !ex) return <Empty title="Product not found" action={<Button onClick={() => go('products')}>Back</Button>} />
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })
  const save = () => {
    const er: Record<string, string> = {}
    if (f.name.trim().length < 2) er.name = 'Brand name is required'
    if (!f.generic.trim()) er.generic = 'Generic / active ingredient is required'
    if (!f.strength.trim()) er.strength = 'Strength is required'
    if (!/^\d{8,14}$/.test(f.barcode)) er.barcode = 'Barcode must be 8–14 digits'
    else if (db.products.some((p) => p.barcode === f.barcode && p.id !== id)) er.barcode = 'Barcode already used by another product'
    if (db.products.some((p) => p.sku === f.sku && p.id !== id)) er.sku = 'SKU must be unique'
    if (!(+f.price > 0)) er.price = 'Enter a selling price'
    if (!(+f.cost >= 0) || f.cost === '') er.cost = 'Enter a unit cost'
    else if (+f.cost > +f.price) er.cost = 'Cost is higher than price'
    if (!(+f.reorder >= 0)) er.reorder = 'Invalid'
    setErr(er)
    if (Object.keys(er).length) return toast({ kind: 'error', title: 'Please fix the highlighted fields' })
    const pid = id || uid('p')
    act((d) => {
      const data = { ...f, id: pid, price: +f.price, cost: +f.cost, reorder: +f.reorder }
      if (id) { Object.assign(d.products.find((p) => p.id === id)!, data); logAudit(d, 'product.update', f.name, 'Product master data updated') }
      else { d.products.push(data); logAudit(d, 'product.create', f.name, `Created ${f.sku}`) }
    })
    toast({ kind: 'success', title: id ? 'Product updated' : 'Product created', body: id ? undefined : 'Receive stock through a purchase order to make it sellable.' })
    go(`products/${pid}`)
  }
  return (
    <div className="max-w-[920px]">
      <PageHeader back={id ? `products/${id}` : 'products'} title={id ? `Edit ${ex!.name}` : 'Add product'} subtitle="Master data is shared by all branches; stock is tracked per branch and batch." actions={<><Button onClick={() => go(id ? `products/${id}` : 'products')}>Cancel</Button><Button variant="primary" icon={Save} onClick={save}>Save product</Button></>} />
      <div className="space-y-4">
        <Card title="Identification">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Brand name *" error={err.name}><Input value={f.name} onChange={set('name')} invalid={!!err.name} autoFocus /></Field>
            <Field label="Arabic name"><Input dir="rtl" value={f.nameAr} onChange={set('nameAr')} /></Field>
            <Field label="Generic / active ingredient *" error={err.generic}><Input value={f.generic} onChange={set('generic')} invalid={!!err.generic} /></Field>
            <Field label="Manufacturer"><Input value={f.manufacturer} onChange={set('manufacturer')} /></Field>
            <Field label="SKU" error={err.sku}><Input value={f.sku} onChange={set('sku')} invalid={!!err.sku} /></Field>
            <Field label="Barcode (GTIN) *" error={err.barcode}><Input value={f.barcode} onChange={(e) => setF({ ...f, barcode: e.target.value.replace(/\D/g, '') })} invalid={!!err.barcode} inputMode="numeric" /></Field>
          </div>
        </Card>
        <Card title="Clinical classification">
          <div className="grid grid-cols-3 gap-4">
            <Field label="Category"><Select value={f.category} onChange={(v) => setF({ ...f, category: v })} options={CATS.map((c) => ({ value: c, label: c }))} /></Field>
            <Field label="Dosage form"><Select value={f.form} onChange={(v) => setF({ ...f, form: v })} options={['Tablet', 'Capsule', 'Suspension', 'Syrup', 'Injection', 'Pen', 'Inhaler', 'Spray', 'Cream', 'Ointment', 'Gel', 'Softgel', 'Sachet', 'Strip', 'Balm'].map((c) => ({ value: c, label: c }))} /></Field>
            <Field label="Strength *" error={err.strength}><Input value={f.strength} onChange={set('strength')} invalid={!!err.strength} placeholder="e.g. 500 mg" /></Field>
          </div>
          <div className="mt-4 flex items-center justify-between rounded-lg bg-canvas p-3"><div><div className="text-[13px] font-semibold">Prescription required</div><div className="text-[12px] text-muted">POS will require an Rx reference before completing the sale.</div></div><Toggle checked={f.rx} onChange={(v) => setF({ ...f, rx: v })} label="Prescription required" /></div>
        </Card>
        <Card title="Pricing & replenishment">
          <div className="grid grid-cols-4 gap-4">
            <Field label={`Selling price (${db.settings.currency}) *`} error={err.price}><Input value={f.price} onChange={set('price')} invalid={!!err.price} inputMode="decimal" /></Field>
            <Field label="Unit cost *" error={err.cost}><Input value={f.cost} onChange={set('cost')} invalid={!!err.cost} inputMode="decimal" /></Field>
            <Field label="Reorder point" error={err.reorder} hint="Per branch"><Input value={f.reorder} onChange={set('reorder')} invalid={!!err.reorder} inputMode="numeric" /></Field>
            <Field label="Margin"><div className="flex h-9 items-center text-[14px] font-bold text-teal">{+f.price > 0 ? `${Math.round(((+f.price - +f.cost) / +f.price) * 100)}%` : '—'}</div></Field>
          </div>
          <div className="mt-4 flex items-center justify-between rounded-lg bg-canvas p-3"><div><div className="text-[13px] font-semibold">Subject to VAT ({db.settings.taxRate}%)</div><div className="text-[12px] text-muted">Zero-rated medicines should be excluded.</div></div><Toggle checked={f.taxable} onChange={(v) => setF({ ...f, taxable: v })} label="Taxable" /></div>
        </Card>
      </div>
    </div>
  )
}

export function ProductDetails({ id }: { id: string }) {
  const { db, act, scope, money, can, myBranches } = useStore()
  const toast = useToast()
  const [adj, setAdj] = useState(false)
  const [arch, setArch] = useState(false)
  const p = db.products.find((x) => x.id === id)
  if (!p) return <Empty title="Product not found" action={<Button onClick={() => go('products')}>Back</Button>} />
  const batches = db.batches.filter((b) => b.productId === id && inScope(b.branchId, scope) && b.qty > 0).sort((a, b) => a.expiry.localeCompare(b.expiry))
  const moves = db.movements.filter((m) => m.productId === id && inScope(m.branchId, scope)).slice(0, 40)
  const sold30 = db.sales.filter((s) => inScope(s.branchId, scope) && Date.now() - new Date(s.date).getTime() < 30 * 86400000).reduce((a, s) => a + s.items.filter((i) => i.productId === id).reduce((x, i) => x + i.qty, 0), 0)
  const onHand = stockOf(db, id, scope)
  return (
    <div>
      <PageHeader back="products" eyebrow={`${p.sku} · ${p.category}`} title={<span className="flex items-center gap-3">{p.name} <span className="font-semibold text-muted">{p.strength}</span>{p.rx && <Badge tone="blue">Rx</Badge>}{p.status === 'archived' && <StatusBadge s="archived" />}</span>} subtitle={`${p.generic} · ${p.form} · ${p.manufacturer}`}
        actions={<>{can('products.edit') && <Button icon={p.status === 'active' ? Archive : ArchiveRestore} onClick={() => setArch(true)}>{p.status === 'active' ? 'Archive' : 'Restore'}</Button>}{can('inventory') && <Button icon={SlidersHorizontal} onClick={() => setAdj(true)}>Adjust stock</Button>}{can('purchasing') && <Button icon={ShoppingCart} onClick={() => go(`purchase-orders/new?product=${p.id}`)}>Reorder</Button>}{can('products.edit') && <Button variant="primary" icon={Pencil} onClick={() => go(`products/${p.id}/edit`)}>Edit</Button>}</>} />
      <div className="grid grid-cols-4 gap-4">
        <Stat label="On hand" value={onHand} sub={<StatusBadge s={stockStatus(db, p, scope)} />} icon={Boxes} />
        <Stat label="Sold · 30 days" value={sold30} sub={sold30 ? `≈ ${Math.round(onHand / (sold30 / 30))} days of cover` : 'No recent sales'} icon={CalendarClock} tone="blue" />
        <Stat label="Price / cost" value={money(p.price)} sub={`Cost ${money(p.cost)} · ${Math.round(((p.price - p.cost) / p.price) * 100)}% margin`} icon={Pill} tone="navy" />
        <Stat label="Stock value (cost)" value={money(batches.reduce((a, b) => a + b.qty * b.cost, 0))} sub={`${batches.length} active batches`} icon={Boxes} tone="amber" />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-4">
        <Card className="col-span-2" title="Batches — dispensed first-expiry-first-out" pad={false}>
          <Table rows={batches} rowKey={(b) => b.id} empty={<Empty icon={Boxes} title="No stock on hand" body="Receive a purchase order or transfer to add batches." />} cols={[
            { key: 'l', label: 'Lot', render: (b) => <span className="font-mono text-[12.5px] font-semibold">{b.lot}</span> },
            { key: 'b', label: 'Branch', render: (b) => db.branches.find((x) => x.id === b.branchId)?.name },
            { key: 'e', label: 'Expiry', render: (b) => { const d = daysToExpiry(b.expiry); return <span className="flex items-center gap-2">{fDate(b.expiry)}{d < 0 ? <Badge tone="red">Expired</Badge> : d <= db.settings.expiryAlertDays && <Badge tone="amber">{d}d</Badge>}</span> } },
            { key: 'q', label: 'Qty', align: 'right', render: (b) => <b>{b.qty}</b> },
            { key: 'c', label: 'Unit cost', align: 'right', render: (b) => b.cost.toFixed(2) },
            { key: 'r', label: 'Received', render: (b) => <span className="text-muted">{fDate(b.receivedAt)}</span> },
          ]} />
        </Card>
        <Card title="Stock by branch">
          {db.branches.map((b) => { const q = stockOf(db, p.id, b.id); return (
            <div key={b.id} className="mb-4 last:mb-0"><div className="mb-1.5 flex justify-between text-[13px]"><span className="font-semibold">{b.name}</span><span className="tnum">{q} <span className="text-muted">/ RP {p.reorder}</span></span></div><Meter value={q} max={Math.max(p.reorder * 4, q)} tone={q === 0 ? 'bg-red-500' : q <= p.reorder ? 'bg-amber-500' : 'bg-teal'} /></div>) })}
          {can('transfers') && myBranches.length > 1 && <Button className="mt-4 w-full" icon={ArrowLeftRight} onClick={() => go(`transfers/new?product=${p.id}`)}>Transfer between branches</Button>}
          <div className="mt-5 border-t border-line pt-4"><KV items={[['Barcode', <span className="font-mono text-[12.5px]">{p.barcode}</span>], ['Arabic name', <span dir="rtl">{p.nameAr || '—'}</span>], ['VAT', p.taxable ? `${db.settings.taxRate}%` : 'Zero-rated'], ['Reorder point', p.reorder]]} /></div>
        </Card>
      </div>
      <Card className="mt-4" title="Recent stock movements" pad={false}><MovementTable rows={moves} /></Card>
      <AdjustModal open={adj} onClose={() => setAdj(false)} product={p} />
      <Confirm open={arch} onClose={() => setArch(false)} title={p.status === 'active' ? 'Archive product?' : 'Restore product?'} body={p.status === 'active' ? 'Archived products are hidden from POS and purchasing. Stock history is kept.' : 'The product will be available again in POS and purchasing.'} confirmLabel={p.status === 'active' ? 'Archive' : 'Restore'} danger={p.status === 'active'}
        onConfirm={() => { act((d) => { const x = d.products.find((x) => x.id === id)!; x.status = x.status === 'active' ? 'archived' : 'active'; logAudit(d, `product.${x.status === 'active' ? 'restore' : 'archive'}`, x.name, '') }); toast({ kind: 'success', title: p.status === 'active' ? 'Product archived' : 'Product restored' }) }} />
    </div>
  )
}

function AdjustModal({ open, onClose, product }: { open: boolean; onClose: () => void; product: Product }) {
  const { db, act, scope, myBranches } = useStore()
  const toast = useToast()
  const [branch, setBranch] = useState(scope === 'all' ? myBranches[0]?.id : scope)
  const [mode, setMode] = useState<'remove' | 'add'>('remove')
  const [batch, setBatch] = useState('')
  const [qty, setQty] = useState('')
  const [lot, setLot] = useState('')
  const [expiry, setExpiry] = useState('')
  const [reason, setReason] = useState('Damaged')
  const [err, setErr] = useState('')
  const bs = db.batches.filter((b) => b.productId === product.id && b.branchId === branch && b.qty > 0)
  const submit = () => {
    const n = parseInt(qty)
    if (!(n > 0)) return setErr('Enter a quantity greater than zero')
    if (mode === 'remove') { const b = bs.find((x) => x.id === batch); if (!b) return setErr('Select a batch'); if (n > b.qty) return setErr(`Batch has only ${b.qty} units`) }
    else { if (!lot.trim()) return setErr('Enter a lot number'); if (!expiry) return setErr('Enter an expiry date') }
    act((d) => {
      const ref = `ADJ-${Date.now().toString().slice(-5)}`
      if (mode === 'remove') { const b = d.batches.find((x) => x.id === batch)!; b.qty -= n; move(d, { productId: product.id, branchId: branch, lot: b.lot, type: 'adjustment', qty: -n, ref: `${ref} · ${reason}` }) }
      else { addStock(d, product.id, branch, lot.trim(), expiry, n, product.cost); move(d, { productId: product.id, branchId: branch, lot: lot.trim(), type: 'adjustment', qty: n, ref: `${ref} · ${reason}` }) }
      checkLowStock(d, product.id, branch)
      logAudit(d, 'stock.adjust', product.name, `${mode === 'remove' ? '−' : '+'}${n} · ${reason}`, branch)
    })
    toast({ kind: 'success', title: 'Stock adjusted', body: `${mode === 'remove' ? 'Removed' : 'Added'} ${n} units of ${product.name}.` })
    setQty(''); setErr(''); onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title="Adjust stock" desc={`${product.name} ${product.strength}`} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={submit}>Apply adjustment</Button></>}>
      <div className="space-y-3.5">
        <div className="flex gap-2"><Tabs value={mode} onChange={(v) => { setMode(v); setReason(v === 'remove' ? 'Damaged' : 'Found stock') }} tabs={[{ value: 'remove', label: 'Remove / write-off' }, { value: 'add', label: 'Add stock' }]} /></div>
        <Field label="Branch"><Select value={branch} onChange={(v) => { setBranch(v); setBatch('') }} options={myBranches.map((b) => ({ value: b.id, label: b.name }))} /></Field>
        {mode === 'remove' ? (
          <Field label="Batch"><Select value={batch} onChange={setBatch} options={[{ value: '', label: bs.length ? 'Select batch…' : 'No stock at this branch' }, ...bs.map((b) => ({ value: b.id, label: `${b.lot} · exp ${fDate(b.expiry)} · ${b.qty} units${isExpired(b) ? ' · EXPIRED' : ''}` }))]} /></Field>
        ) : (
          <div className="grid grid-cols-2 gap-3"><Field label="Lot number"><Input value={lot} onChange={(e) => setLot(e.target.value)} /></Field><Field label="Expiry"><Input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} /></Field></div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantity"><Input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
          <Field label="Reason"><Select value={reason} onChange={setReason} options={(mode === 'remove' ? ['Damaged', 'Expired', 'Theft / loss', 'Sample', 'Recall'] : ['Found stock', 'Opening balance', 'Correction']).map((x) => ({ value: x, label: x }))} /></Field>
        </div>
        {err && <div className="text-[12.5px] font-medium text-red-600">{err}</div>}
      </div>
    </Modal>
  )
}

const MT: Record<MoveType, [string, 'green' | 'red' | 'blue' | 'amber' | 'teal' | 'gray']> = { sale: ['Sale', 'gray'], return: ['Return', 'blue'], receipt: ['Receipt', 'green'], transfer_out: ['Transfer out', 'amber'], transfer_in: ['Transfer in', 'teal'], adjustment: ['Adjustment', 'red'], count: ['Count', 'blue'] }
function MovementTable({ rows, showProduct }: { rows: ReturnType<typeof useStore>['db']['movements']; showProduct?: boolean }) {
  const { db } = useStore()
  return <Table rows={rows} rowKey={(m) => m.id} pageSize={15} dense empty={<Empty icon={Boxes} title="No movements" />} cols={[
    { key: 'd', label: 'Date', render: (m) => fDateTime(m.date), sort: (m) => m.date },
    ...(showProduct ? [{ key: 'p', label: 'Product', render: (m: (typeof rows)[0]) => <button className="font-semibold hover:text-teal" onClick={() => go(`products/${m.productId}`)}>{db.products.find((p) => p.id === m.productId)?.name}</button> }] : []),
    { key: 't', label: 'Type', render: (m) => <Badge tone={MT[m.type][1]}>{MT[m.type][0]}</Badge> },
    { key: 'b', label: 'Branch', render: (m) => db.branches.find((b) => b.id === m.branchId)?.code },
    { key: 'l', label: 'Lot', render: (m) => <span className="font-mono text-[12px]">{m.lot}</span> },
    { key: 'r', label: 'Reference', render: (m) => <span className="text-muted">{m.ref}</span> },
    { key: 'u', label: 'User', render: (m) => <span className="text-muted">{db.users.find((u) => u.id === m.userId)?.name || 'System'}</span> },
    { key: 'q', label: 'Qty', align: 'right', render: (m) => <b className={m.qty > 0 ? 'text-emerald-700' : 'text-ink'}>{m.qty > 0 ? `+${m.qty}` : m.qty}</b> },
  ]} />
}

export function InventoryOverview() {
  const { db, act, scope, money, can } = useStore()
  const toast = useToast()
  const route = useRoute()
  const [tab, setTab] = useState<'levels' | 'low' | 'expiry'>(route.includes('tab=expiry') ? 'expiry' : route.includes('tab=low') ? 'low' : 'levels')
  const [q, setQ] = useState('')
  const [wo, setWo] = useState<string | null>(null)
  const active = db.products.filter((p) => p.status === 'active')
  const value = db.batches.filter((b) => inScope(b.branchId, scope)).reduce((a, b) => a + b.qty * b.cost, 0)
  const low = active.filter((p) => stockStatus(db, p, scope) !== 'ok')
  const exp = db.batches.filter((b) => inScope(b.branchId, scope) && b.qty > 0 && daysToExpiry(b.expiry) <= db.settings.expiryAlertDays).sort((a, b) => a.expiry.localeCompare(b.expiry))
  const branches = scope === 'all' ? db.branches : db.branches.filter((b) => b.id === scope)
  const filt = (p: Product) => !q || `${p.name} ${p.generic} ${p.sku}`.toLowerCase().includes(q.toLowerCase())
  const woBatch = db.batches.find((b) => b.id === wo)
  return (
    <div>
      <PageHeader title="Inventory Overview" subtitle="Live stock positions by branch and batch" actions={<>{can('counts') && <Button icon={ClipboardCheck} onClick={() => go('counts')}>Stock counts</Button>}{can('purchasing') && <Button variant="primary" icon={PackagePlus} onClick={() => go('purchase-orders/new?low=1')}>Reorder low stock</Button>}</>} />
      <div className="mb-4 grid grid-cols-4 gap-4">
        <Stat label="Inventory value (cost)" value={money(value)} icon={Boxes} tone="navy" />
        <Stat label="Units on hand" value={db.batches.filter((b) => inScope(b.branchId, scope)).reduce((a, b) => a + b.qty, 0).toLocaleString()} icon={Boxes} />
        <Stat label="Below reorder point" value={low.length} icon={AlertTriangle} tone="amber" onClick={() => setTab('low')} />
        <Stat label="Expiring / expired batches" value={exp.length} sub={money(exp.reduce((a, b) => a + b.qty * b.cost, 0)) + ' at cost'} icon={CalendarClock} tone="red" onClick={() => setTab('expiry')} />
      </div>
      <Card pad={false}>
        <Toolbar><Tabs value={tab} onChange={setTab} tabs={[{ value: 'levels', label: 'Stock levels' }, { value: 'low', label: 'Reorder', count: low.length }, { value: 'expiry', label: 'Expiry', count: exp.length }]} /><div className="flex-1" /><SearchInput value={q} onChange={setQ} className="w-[260px]" placeholder="Filter products…" /></Toolbar>
        {tab === 'levels' && <Table rows={active.filter(filt)} rowKey={(p) => p.id} onRow={(p) => go(`products/${p.id}`)} pageSize={15} dense cols={[
          { key: 'n', label: 'Product', sort: (p) => p.name, render: (p) => <div><span className="font-semibold">{p.name}</span> <span className="text-muted">{p.strength}</span></div> },
          ...branches.map((b) => ({ key: b.id, label: b.code, align: 'right' as const, sort: (p: Product) => stockOf(db, p.id, b.id), render: (p: Product) => { const q = stockOf(db, p.id, b.id); return <span className={cx('font-semibold', q === 0 ? 'text-red-600' : q <= p.reorder ? 'text-amber-600' : '')}>{q}</span> } })),
          { key: 'tot', label: 'Total', align: 'right', render: (p) => <b>{stockOf(db, p.id, scope)}</b>, sort: (p) => stockOf(db, p.id, scope) },
          { key: 'v', label: 'Value', align: 'right', render: (p) => money(db.batches.filter((b) => b.productId === p.id && inScope(b.branchId, scope)).reduce((a, b) => a + b.qty * b.cost, 0)) },
          { key: 's', label: 'Status', render: (p) => <StatusBadge s={stockStatus(db, p, scope)} /> },
        ]} />}
        {tab === 'low' && <Table rows={low.filter(filt)} rowKey={(p) => p.id} onRow={(p) => go(`products/${p.id}`)} empty={<Empty icon={CheckCircle2} title="Nothing to reorder" />} cols={[
          { key: 'n', label: 'Product', render: (p) => <b>{p.name} <span className="font-normal text-muted">{p.strength}</span></b> },
          { key: 'q', label: 'On hand', align: 'right', render: (p) => stockOf(db, p.id, scope) },
          { key: 'r', label: 'Reorder point', align: 'right', render: (p) => (scope === 'all' ? p.reorder * db.branches.length : p.reorder) },
          { key: 'sug', label: 'Suggested qty', align: 'right', render: (p) => <b className="text-teal">{Math.max(0, (scope === 'all' ? p.reorder * db.branches.length : p.reorder) * 2 - stockOf(db, p.id, scope))}</b> },
          { key: 's', label: 'Status', render: (p) => <StatusBadge s={stockStatus(db, p, scope)} /> },
        ]} />}
        {tab === 'expiry' && <Table rows={exp.filter((b) => filt(db.products.find((p) => p.id === b.productId)!))} rowKey={(b) => b.id} empty={<Empty icon={CalendarClock} title="No batches near expiry" />} cols={[
          { key: 'n', label: 'Product', render: (b) => <button className="font-semibold hover:text-teal" onClick={() => go(`products/${b.productId}`)}>{db.products.find((p) => p.id === b.productId)?.name}</button> },
          { key: 'l', label: 'Lot', render: (b) => <span className="font-mono text-[12px]">{b.lot}</span> },
          { key: 'br', label: 'Branch', render: (b) => db.branches.find((x) => x.id === b.branchId)?.name },
          { key: 'e', label: 'Expiry', render: (b) => fDate(b.expiry), sort: (b) => b.expiry },
          { key: 'd', label: 'Remaining', render: (b) => { const d = daysToExpiry(b.expiry); return <Badge tone={d < 0 ? 'red' : d <= 30 ? 'red' : 'amber'}>{d < 0 ? `Expired ${-d}d ago` : `${d} days`}</Badge> } },
          { key: 'q', label: 'Qty', align: 'right', render: (b) => <b>{b.qty}</b> },
          { key: 'v', label: 'Value', align: 'right', render: (b) => money(b.qty * b.cost) },
          { key: 'a', label: '', align: 'right', render: (b) => can('inventory') && <Button size="sm" variant={isExpired(b) ? 'danger' : 'secondary'} onClick={(e) => { e.stopPropagation(); setWo(b.id) }}>Write off</Button> },
        ]} />}
      </Card>
      <Confirm open={!!wo} onClose={() => setWo(null)} danger title="Write off batch?" confirmLabel="Write off" body={woBatch && `Remove all ${woBatch.qty} units of lot ${woBatch.lot} (${db.products.find((p) => p.id === woBatch.productId)?.name}) from sellable stock. This is logged as an adjustment.`}
        onConfirm={() => { const b = woBatch!; act((d) => { const x = d.batches.find((y) => y.id === b.id)!; move(d, { productId: x.productId, branchId: x.branchId, lot: x.lot, type: 'adjustment', qty: -x.qty, ref: 'Expiry write-off' }); logAudit(d, 'stock.writeoff', x.lot, `${x.qty} units written off`, x.branchId); x.qty = 0 }); toast({ kind: 'success', title: 'Batch written off' }) }} />
    </div>
  )
}

export function Movements() {
  const { db, scope } = useStore()
  const loading = useLoading()
  const [q, setQ] = useState('')
  const [type, setType] = useState('all')
  const [range, setRange] = useState('30')
  const rows = db.movements.filter((m) => inScope(m.branchId, scope) && (type === 'all' || m.type === type) && (range === 'all' || Date.now() - new Date(m.date).getTime() < +range * 86400000) && (!q || `${db.products.find((p) => p.id === m.productId)?.name} ${m.ref} ${m.lot}`.toLowerCase().includes(q.toLowerCase())))
  const inQ = rows.filter((m) => m.qty > 0).reduce((a, m) => a + m.qty, 0), outQ = rows.filter((m) => m.qty < 0).reduce((a, m) => a - m.qty, 0)
  return (
    <div>
      <PageHeader title="Stock Movements" subtitle={`Immutable ledger · ${rows.length} entries · +${inQ} in / −${outQ} out`} actions={<Button icon={Download} onClick={() => downloadCSV('movements.csv', [['Date', 'Product', 'Type', 'Branch', 'Lot', 'Ref', 'Qty'], ...rows.map((m) => [m.date, db.products.find((p) => p.id === m.productId)!.name, m.type, m.branchId, m.lot, m.ref, m.qty])])}>Export</Button>} />
      <Card pad={false}>
        <Toolbar>
          <SearchInput value={q} onChange={setQ} placeholder="Product, reference, lot…" className="w-[280px]" />
          <Select aria-label="Type" className="w-[160px]" value={type} onChange={setType} options={[{ value: 'all', label: 'All types' }, ...Object.entries(MT).map(([k, v]) => ({ value: k, label: v[0] }))]} />
          <Select aria-label="Range" className="w-[140px]" value={range} onChange={setRange} options={[{ value: '1', label: 'Today' }, { value: '7', label: 'Last 7 days' }, { value: '30', label: 'Last 30 days' }, { value: 'all', label: 'All time' }]} />
        </Toolbar>
        {loading ? <Skeleton /> : <MovementTable rows={rows} showProduct />}
      </Card>
    </div>
  )
}

export function Counts() {
  const { db, act, scope, myBranches, me, can } = useStore()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [branch, setBranch] = useState(scope === 'all' ? myBranches[0]?.id : scope)
  const [cat, setCat] = useState('all')
  const rows = db.counts.filter((c) => inScope(c.branchId, scope))
  const create = () => {
    let id = ''
    act((d) => {
      id = uid('c')
      const lines = d.products.filter((p) => p.status === 'active' && (cat === 'all' || p.category === cat)).map((p) => ({ productId: p.id, expected: stockOf(d, p.id, branch), counted: null }))
      const no = nextNo(d, 'CNT')
      d.counts.unshift({ id, no, branchId: branch, date: now(), status: 'in_progress', scope: cat === 'all' ? 'Full count' : cat, lines, userId: me!.id })
      logAudit(d, 'count.start', no, `${lines.length} products · ${cat === 'all' ? 'full' : cat}`, branch)
    })
    setOpen(false)
    toast({ kind: 'success', title: 'Count started', body: 'Expected quantities snapshotted.' })
    go(`counts/${id}`)
  }
  return (
    <div>
      <PageHeader title="Stock Counts" subtitle="Cycle counts reconcile physical stock with the system." actions={can('counts') && <Button variant="primary" icon={Plus} onClick={() => setOpen(true)}>New count</Button>} />
      <Card pad={false}>
        <Table rows={rows} rowKey={(c) => c.id} onRow={(c) => go(`counts/${c.id}`)} empty={<Empty icon={ClipboardCheck} title="No counts yet" action={<Button onClick={() => setOpen(true)}>Start a count</Button>} />} cols={[
          { key: 'n', label: 'Count', render: (c) => <span className="font-semibold text-teal">{c.no}</span> },
          { key: 'b', label: 'Branch', render: (c) => db.branches.find((b) => b.id === c.branchId)?.name },
          { key: 's', label: 'Scope', render: (c) => c.scope },
          { key: 'd', label: 'Started', render: (c) => fDateTime(c.date), sort: (c) => c.date },
          { key: 'p', label: 'Progress', render: (c) => { const n = c.lines.filter((l) => l.counted !== null).length; return <div className="flex w-36 items-center gap-2"><Meter value={n} max={c.lines.length} /><span className="tnum text-[12px] text-muted">{n}/{c.lines.length}</span></div> } },
          { key: 'v', label: 'Variances', align: 'right', render: (c) => { const v = c.lines.filter((l) => l.counted !== null && l.counted !== l.expected).length; return v ? <Badge tone="amber">{v}</Badge> : '—' } },
          { key: 'u', label: 'By', render: (c) => <span className="text-muted">{db.users.find((u) => u.id === c.userId)?.name}</span> },
          { key: 'st', label: 'Status', render: (c) => <StatusBadge s={c.status} /> },
        ]} />
      </Card>
      <Modal open={open} onClose={() => setOpen(false)} title="Start stock count" desc="Current system quantities are captured as the expected baseline." width={440} footer={<><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" onClick={create}>Start count</Button></>}>
        <div className="space-y-3.5">
          <Field label="Branch"><Select value={branch} onChange={setBranch} options={myBranches.map((b) => ({ value: b.id, label: b.name }))} /></Field>
          <Field label="Scope"><Select value={cat} onChange={setCat} options={[{ value: 'all', label: 'Full count — all products' }, ...CATS.map((c) => ({ value: c, label: `Category: ${c}` }))]} /></Field>
        </div>
      </Modal>
    </div>
  )
}

export function CountWorkspace({ id }: { id: string }) {
  const { db, act, money } = useStore()
  const toast = useToast()
  const c = db.counts.find((x) => x.id === id)
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries((c?.lines || []).map((l) => [l.productId, l.counted === null ? '' : String(l.counted)])))
  const [blind, setBlind] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'variance'>('all')
  const [q, setQ] = useState('')
  const [confirm, setConfirm] = useState(false)
  const lines = useMemo(() => (c ? c.lines.map((l) => { const v = vals[l.productId]; const counted = v === '' || v === undefined ? null : +v; return { ...l, counted, diff: counted === null ? 0 : counted - l.expected, p: db.products.find((p) => p.id === l.productId)! } }) : []), [c, vals, db.products])
  if (!c) return <Empty title="Count not found" action={<Button onClick={() => go('counts')}>Back</Button>} />
  const done = c.status === 'completed'
  const counted = lines.filter((l) => l.counted !== null).length
  const variances = lines.filter((l) => l.counted !== null && l.diff !== 0)
  const varValue = variances.reduce((a, l) => a + l.diff * l.p.cost, 0)
  const view = lines.filter((l) => (filter === 'all' || (filter === 'pending' ? l.counted === null : l.counted !== null && l.diff !== 0)) && (!q || `${l.p.name} ${l.p.barcode}`.toLowerCase().includes(q.toLowerCase())))
  const save = (silent = false) => { act((d) => { const x = d.counts.find((x) => x.id === id)!; x.lines.forEach((l) => { const v = vals[l.productId]; l.counted = v === '' || v === undefined ? null : +v }) }); if (!silent) toast({ kind: 'success', title: 'Progress saved' }) }
  const complete = () => {
    act((d) => {
      const x = d.counts.find((x) => x.id === id)!
      x.lines.forEach((l) => { const v = vals[l.productId]; l.counted = v === '' || v === undefined ? l.expected : +v })
      x.lines.forEach((l) => {
        // Diff against live stock (sales may have occurred since the snapshot) to reconcile to counted qty.
        const live = stockOf(d, l.productId, x.branchId)
        let diff = l.counted! - live
        if (!diff) return
        const p = d.products.find((p) => p.id === l.productId)!
        if (diff > 0) {
          const b = d.batches.filter((b) => b.productId === l.productId && b.branchId === x.branchId).sort((a, b) => b.expiry.localeCompare(a.expiry))[0]
          if (b) b.qty += diff; else addStock(d, l.productId, x.branchId, `CNT-${x.no}`, new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10), diff, p.cost)
          move(d, { productId: l.productId, branchId: x.branchId, lot: b?.lot || `CNT-${x.no}`, type: 'count', qty: diff, ref: x.no })
        } else {
          const bs = d.batches.filter((b) => b.productId === l.productId && b.branchId === x.branchId && b.qty > 0).sort((a, b) => a.expiry.localeCompare(b.expiry))
          for (const b of bs) { if (diff >= 0) break; const t = Math.min(b.qty, -diff); b.qty -= t; diff += t; move(d, { productId: l.productId, branchId: x.branchId, lot: b.lot, type: 'count', qty: -t, ref: x.no }) }
        }
        checkLowStock(d, l.productId, x.branchId)
      })
      x.status = 'completed'; x.completedAt = now()
      logAudit(d, 'count.complete', x.no, `${variances.length} variances · ${money(varValue)} net`, x.branchId)
    })
    toast({ kind: 'success', title: 'Count reconciled', body: `${variances.length} variance lines posted as stock adjustments.` })
  }
  return (
    <div>
      <PageHeader back="counts" eyebrow={`${db.branches.find((b) => b.id === c.branchId)?.name} · ${c.scope}`} title={<span className="flex items-center gap-3">{c.no}<StatusBadge s={c.status} /></span>} subtitle={done ? `Completed ${fDateTime(c.completedAt)}` : 'Enter physical counts. Uncounted lines are assumed correct on completion.'}
        actions={!done && <><Button icon={Save} onClick={() => save()}>Save progress</Button><Button variant="primary" icon={CheckCircle2} onClick={() => setConfirm(true)}>Complete & reconcile</Button></>} />
      <div className="mb-4 grid grid-cols-4 gap-4">
        <Stat label="Counted" value={`${counted} / ${lines.length}`} sub={<Meter value={counted} max={lines.length} />} icon={ClipboardCheck} />
        <Stat label="Variance lines" value={variances.length} icon={AlertTriangle} tone="amber" onClick={() => setFilter('variance')} />
        <Stat label="Net variance (units)" value={variances.reduce((a, l) => a + l.diff, 0)} icon={Boxes} tone="blue" />
        <Stat label="Net variance (cost)" value={money(varValue)} icon={Boxes} tone={varValue < 0 ? 'red' : 'teal'} />
      </div>
      <Card pad={false}>
        <Toolbar>
          <SearchInput value={q} onChange={setQ} placeholder="Find product or scan barcode…" className="w-[280px]" />
          <Tabs value={filter} onChange={setFilter} tabs={[{ value: 'all', label: 'All', count: lines.length }, { value: 'pending', label: 'Pending', count: lines.length - counted }, { value: 'variance', label: 'Variances', count: variances.length }]} />
          <div className="flex-1" />
          {!done && <Button size="sm" variant="ghost" icon={blind ? EyeOff : Eye} onClick={() => setBlind(!blind)}>{blind ? 'Blind count' : 'Showing expected'}</Button>}
        </Toolbar>
        <Table rows={view} rowKey={(l) => l.productId} pageSize={20} dense cols={[
          { key: 'p', label: 'Product', render: (l) => <div><b>{l.p.name}</b> <span className="text-muted">{l.p.strength}</span><div className="font-mono text-[11px] text-muted">{l.p.barcode}</div></div> },
          { key: 'e', label: 'Expected', align: 'right', render: (l) => (blind && !done ? <span className="text-muted">•••</span> : l.expected) },
          { key: 'c', label: 'Counted', align: 'right', width: '140px', render: (l) => (done ? <b>{l.counted}</b> : <Input aria-label={`Count ${l.p.name}`} className="tnum h-8 w-24 text-right" inputMode="numeric" value={vals[l.productId] ?? ''} onChange={(e) => setVals({ ...vals, [l.productId]: e.target.value.replace(/\D/g, '') })} onKeyDown={(e) => { if (e.key === 'Enter') { const ins = Array.from(document.querySelectorAll<HTMLInputElement>('input[aria-label^="Count "]')); const i = ins.indexOf(e.currentTarget); ins[i + 1]?.focus() } }} />) },
          { key: 'd', label: 'Variance', align: 'right', render: (l) => (l.counted === null ? <span className="text-muted">—</span> : blind && !done ? <span className="text-muted">hidden</span> : <b className={l.diff < 0 ? 'text-red-600' : l.diff > 0 ? 'text-emerald-700' : 'text-muted'}>{l.diff > 0 ? `+${l.diff}` : l.diff}</b>) },
          { key: 'v', label: 'Value', align: 'right', render: (l) => (l.diff && !(blind && !done) ? money(l.diff * l.p.cost) : '—') },
        ]} />
      </Card>
      <Confirm open={confirm} onClose={() => setConfirm(false)} title="Complete and reconcile count?" confirmLabel="Post adjustments" onConfirm={complete}
        body={<>This posts <b>{variances.length}</b> variance lines ({money(varValue)} at cost) as stock adjustments at {db.branches.find((b) => b.id === c.branchId)?.name}. {lines.length - counted > 0 && <>{lines.length - counted} uncounted lines will be accepted at system quantity.</>} This can't be undone.</>} />
    </div>
  )
}
