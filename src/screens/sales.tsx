import { useEffect, useMemo, useRef, useState } from 'react'
import { ScanLine, Plus, Minus, Trash2, Banknote, CreditCard, ShieldPlus, Printer, Undo2, Receipt as ReceiptIcon, Wallet, Building2, Keyboard, CheckCircle2, AlertTriangle, Search, Download, User as UserIcon } from 'lucide-react'
import { useStore, allocateFEFO, stockOf, move, logAudit, checkLowStock, nextNo, uid, now, round2, type Sale, type Shift, type DB, type Product } from '../store'
import { Button, Card, PageHeader, Field, Input, Select, Modal, Confirm, Badge, StatusBadge, Table, Toolbar, SearchInput, KV, Empty, go, fDateTime, useToast, cx, Tabs, Textarea, useLoading, Skeleton, Toggle } from '../ui'

export function shiftCash(db: DB, s: Shift) {
  const end = s.closedAt || '9999'
  const sales = db.sales.filter((x) => x.shiftId === s.id && x.payment === 'cash').reduce((a, x) => a + x.total, 0)
  const refunds = db.returns.filter((r) => r.branchId === s.branchId && r.userId === s.userId && r.method === 'cash' && r.date >= s.openedAt && r.date <= end).reduce((a, r) => a + r.refund, 0)
  const exp = db.expenses.filter((e) => e.shiftId === s.id && e.method === 'cash').reduce((a, e) => a + e.amount, 0)
  return { sales, refunds, exp, expected: round2(s.openingCash + sales - refunds - exp) }
}
export function downloadCSV(name: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  a.download = name
  a.click()
}

type Line = { productId: string; qty: number; discount: number }

export function POS() {
  const { db, act, scope, me, money, myBranches, can } = useStore()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('All')
  const [sel, setSel] = useState(0)
  const [cart, setCart] = useState<Line[]>([])
  const [active, setActive] = useState<string | null>(null)
  const [payment, setPayment] = useState<'cash' | 'card' | 'insurance'>('cash')
  const [tendered, setTendered] = useState('')
  const [customer, setCustomer] = useState('')
  const [rxRef, setRxRef] = useState('')
  const [ins, setIns] = useState({ provider: 'Bupa Arabia', member: '' })
  const [cardOk, setCardOk] = useState(false)
  const [done, setDone] = useState<Sale | null>(null)
  const [clear, setClear] = useState(false)
  const [help, setHelp] = useState(false)
  const [err, setErr] = useState('')
  const [opening, setOpening] = useState('500')
  const searchRef = useRef<HTMLInputElement>(null)
  const tenderRef = useRef<HTMLInputElement>(null)

  const branchId = scope === 'all' ? null : scope
  const shift = db.shifts.find((s) => s.status === 'open' && s.branchId === branchId && s.userId === me!.id)
  const tax = db.settings.taxRate / 100
  const cats = ['All', ...Array.from(new Set(db.products.map((p) => p.category)))]
  const results = useMemo(() => {
    const s = q.toLowerCase().trim()
    return db.products.filter((p) => p.status === 'active' && (cat === 'All' || p.category === cat) && (!s || `${p.name} ${p.nameAr} ${p.generic} ${p.sku} ${p.barcode}`.toLowerCase().includes(s))).slice(0, 40)
  }, [db.products, q, cat])
  useEffect(() => setSel(0), [q, cat])

  const pmap = (id: string) => db.products.find((p) => p.id === id)!
  const avail = (id: string) => (branchId ? stockOf(db, id, branchId, true) : 0)
  const lines = cart.map((l) => { const p = pmap(l.productId); const gross = l.qty * p.price; const disc = round2(gross * (l.discount / 100)); const net = gross - disc; return { ...l, p, gross, disc, net, tax: p.taxable ? round2(net * tax) : 0 } })
  const subtotal = round2(lines.reduce((a, l) => a + l.gross, 0))
  const discount = round2(lines.reduce((a, l) => a + l.disc, 0))
  const taxAmt = round2(lines.reduce((a, l) => a + l.tax, 0))
  const total = round2(subtotal - discount + taxAmt)
  const needsRx = lines.some((l) => l.p.rx)
  const change = payment === 'cash' && +tendered >= total ? round2(+tendered - total) : 0

  const add = (p: Product, n = 1) => {
    const inCart = cart.find((l) => l.productId === p.id)?.qty || 0
    if (inCart + n > avail(p.id)) { toast({ kind: 'warning', title: 'Insufficient stock', body: `${p.name}: only ${avail(p.id)} sellable units at this branch.` }); return }
    setCart((c) => (c.find((l) => l.productId === p.id) ? c.map((l) => (l.productId === p.id ? { ...l, qty: l.qty + n } : l)) : [...c, { productId: p.id, qty: n, discount: 0 }]))
    setActive(p.id)
    setErr('')
  }
  const setQty = (id: string, qty: number) => {
    if (qty <= 0) { setCart((c) => c.filter((l) => l.productId !== id)); return }
    if (qty > avail(id)) { toast({ kind: 'warning', title: 'Insufficient stock', body: `Only ${avail(id)} units available.` }); return }
    setCart((c) => c.map((l) => (l.productId === id ? { ...l, qty } : l)))
  }
  const reset = () => { setCart([]); setTendered(''); setCustomer(''); setRxRef(''); setIns({ ...ins, member: '' }); setCardOk(false); setPayment('cash'); setErr(''); setActive(null); searchRef.current?.focus() }

  const charge = () => {
    if (!cart.length) return setErr('Cart is empty')
    if (needsRx && db.settings.requireRxRef && !rxRef.trim()) return setErr('Prescription reference required for Rx items')
    if (payment === 'cash' && +tendered < total) { tenderRef.current?.focus(); return setErr('Cash tendered is less than total') }
    if (payment === 'card' && !cardOk) return setErr('Confirm the card terminal approval first')
    if (payment === 'insurance' && ins.member.trim().length < 4) return setErr('Enter the insurance member ID')
    for (const l of lines) if (l.qty > avail(l.productId)) return setErr(`${l.p.name} no longer has enough stock`)
    let sale: Sale | null = null
    act((d) => {
      const items = lines.map((l) => {
        const { allocs } = allocateFEFO(d, l.productId, branchId!, l.qty)
        allocs.forEach((a) => { a.batch.qty -= a.qty })
        return { productId: l.productId, name: l.p.name, qty: l.qty, price: l.p.price, discount: l.discount, allocs: allocs.map((a) => ({ batchId: a.batch.id, lot: a.batch.lot, qty: a.qty })), returned: 0 }
      })
      sale = { id: uid('sa'), no: nextNo(d, 'INV'), date: now(), branchId: branchId!, userId: me!.id, shiftId: shift!.id, customer: payment === 'insurance' ? `${customer || 'Insured patient'} · ${ins.provider} ${ins.member}` : customer || 'Walk-in', items, subtotal, discount, tax: taxAmt, total, payment, tendered: payment === 'cash' ? +tendered : total, status: 'completed', rxRef: rxRef || undefined }
      d.sales.unshift(sale)
      items.forEach((i) => { i.allocs.forEach((a) => move(d, { productId: i.productId, branchId: branchId!, lot: a.lot, type: 'sale', qty: -a.qty, ref: sale!.no })); checkLowStock(d, i.productId, branchId!) })
      logAudit(d, 'sale.create', sale.no, `${items.length} items · ${payment} · ${money(total)}`, branchId!)
    })
    setDone(sale)
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (done || clear) return
      const tag = (e.target as HTMLElement).tagName
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') { e.preventDefault(); searchRef.current?.focus() }
      if (e.key === 'F2') { e.preventDefault(); setPayment('cash'); setTimeout(() => tenderRef.current?.focus()) }
      if (e.key === 'F3') { e.preventDefault(); setPayment('card') }
      if (e.key === 'F4') { e.preventDefault(); setPayment('insurance') }
      if (e.key === 'F9' || (e.ctrlKey && e.key === 'Enter')) { e.preventDefault(); charge() }
      if (e.key === 'F8' && cart.length) { e.preventDefault(); setClear(true) }
      if (e.key === '?' && tag !== 'INPUT') setHelp(true)
      if (active && tag !== 'INPUT' && (e.key === '+' || e.key === '=')) setQty(active, (cart.find((l) => l.productId === active)?.qty || 0) + 1)
      if (active && tag !== 'INPUT' && e.key === '-') setQty(active, (cart.find((l) => l.productId === active)?.qty || 0) - 1)
      if (active && tag !== 'INPUT' && e.key === 'Delete') setCart((c) => c.filter((l) => l.productId !== active))
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  if (!branchId) return (
    <div className="grid h-full place-items-center p-8"><Card className="w-[440px]"><div className="text-center"><Building2 className="mx-auto size-8 text-teal" /><h2 className="mt-3 text-[18px] font-bold">Choose a branch to sell from</h2><p className="mt-1 text-[13px] text-muted">POS transactions always belong to one branch and one cash shift.</p>
      <div className="mt-5 space-y-2">{myBranches.filter((b) => b.status === 'active').map((b) => <Button key={b.id} className="w-full" onClick={() => act((d) => { d.session!.branchId = b.id })}>{b.name}</Button>)}</div></div></Card></div>
  )
  if (!shift) return (
    <div className="grid h-full place-items-center p-8"><Card className="w-[440px]">
      <div className="mb-4 grid size-11 place-items-center rounded-xl bg-teal/10 text-teal"><Wallet className="size-5" /></div>
      <h2 className="text-[18px] font-bold">Open a cash shift</h2>
      <p className="mt-1 text-[13px] text-muted">Count the drawer float at {db.branches.find((b) => b.id === branchId)?.name} before your first sale.</p>
      <Field label={`Opening cash (${db.settings.currency})`} className="mt-5"><Input autoFocus inputMode="decimal" value={opening} onChange={(e) => setOpening(e.target.value.replace(/[^\d.]/g, ''))} onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget.form, document.getElementById('open-shift')?.click())} /></Field>
      <Button id="open-shift" variant="primary" size="lg" className="mt-4 w-full" disabled={!can('shifts') || opening === ''} onClick={() => { act((d) => { d.shifts.unshift({ id: uid('sh'), branchId, userId: me!.id, openedAt: now(), openingCash: +opening, status: 'open' }); logAudit(d, 'shift.open', 'Cash shift', `Opening float ${money(+opening)}`, branchId) }); toast({ kind: 'success', title: 'Shift opened', body: 'You can start selling.' }) }}>Open shift & start selling</Button>
    </Card></div>
  )

  return (
    <div className="flex h-full">
      {/* Catalog */}
      <div className="flex min-w-0 flex-1 flex-col p-5">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <ScanLine className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-teal" />
            <input ref={searchRef} autoFocus value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search or scan barcode" placeholder="Scan barcode or search name, generic, SKU…  ( / )"
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(results.length - 1, s + 1)) }
                if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)) }
                if (e.key === 'Enter') { const exact = db.products.find((p) => p.barcode === q.trim() || p.sku.toLowerCase() === q.trim().toLowerCase()); const p = exact || results[sel]; if (p) { add(p); setQ('') } }
                if (e.key === 'Escape') setQ('')
              }}
              className="h-12 w-full rounded-xl border border-line bg-white pr-4 pl-11 text-[15px] font-medium shadow-sm focus:border-teal focus:ring-4 focus:ring-teal/10 focus:outline-none" />
          </div>
          <Button size="lg" variant="ghost" icon={Keyboard} onClick={() => setHelp(true)} aria-label="Keyboard shortcuts">Shortcuts</Button>
        </div>
        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
          {cats.map((c) => <button key={c} onClick={() => setCat(c)} className={cx('rounded-full px-3 py-1 text-[12.5px] font-semibold whitespace-nowrap transition', cat === c ? 'bg-navy text-white' : 'bg-white text-muted ring-1 ring-line hover:text-ink')}>{c}</button>)}
        </div>
        <div className="mt-3 grid flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-2.5 overflow-y-auto pb-2">
          {results.length === 0 && <div className="col-span-full"><Empty icon={Search} title="No products match" body="Check the spelling or scan the barcode again." /></div>}
          {results.map((p, i) => { const a = avail(p.id); return (
            <button key={p.id} onClick={() => add(p)} disabled={a === 0} onMouseEnter={() => setSel(i)}
              className={cx('group flex flex-col rounded-xl border bg-white p-3 text-left transition disabled:opacity-50', i === sel ? 'border-teal ring-3 ring-teal/10' : 'border-line hover:border-teal/40')}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><div className="truncate text-[13.5px] font-bold">{db.settings.language === 'ar' ? p.nameAr : p.name}</div><div className="truncate text-[11.5px] text-muted">{p.generic}</div></div>
                {p.rx && <Badge tone="blue">Rx</Badge>}
              </div>
              <div className="mt-1 text-[11.5px] text-muted">{p.form} · {p.strength}</div>
              <div className="mt-3 flex items-end justify-between">
                <span className="tnum text-[15px] font-extrabold">{p.price.toFixed(2)}</span>
                <span className={cx('tnum text-[11.5px] font-semibold', a === 0 ? 'text-red-600' : a <= p.reorder ? 'text-amber-600' : 'text-emerald-600')}>{a === 0 ? 'Out of stock' : `${a} in stock`}</span>
              </div>
            </button>) })}
        </div>
      </div>

      {/* Cart */}
      <aside className="flex w-[420px] shrink-0 flex-col border-l border-line bg-white">
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <div><div className="text-[15px] font-bold">Current sale</div><div className="text-[11.5px] text-muted">{db.branches.find((b) => b.id === branchId)?.name} · Shift since {new Date(shift.openedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div></div>
          <Button size="sm" variant="ghost" icon={Trash2} disabled={!cart.length} onClick={() => setClear(true)}>Clear</Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {lines.length === 0 ? <Empty icon={ScanLine} title="Scan or select a product" body="Press / to focus search, Enter to add the highlighted item." /> : lines.map((l) => (
            <div key={l.productId} onClick={() => setActive(l.productId)} className={cx('border-b border-line/70 px-5 py-3', active === l.productId && 'bg-teal/[0.04]')}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><div className="truncate text-[13.5px] font-semibold">{l.p.name} {l.p.rx && <Badge tone="blue">Rx</Badge>}</div><div className="tnum text-[11.5px] text-muted">{l.p.price.toFixed(2)} × {l.qty}{l.discount > 0 && ` · −${l.discount}%`}{l.p.taxable && ` · VAT`}</div></div>
                <div className="tnum text-[14px] font-bold">{l.net.toFixed(2)}</div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <div className="flex items-center rounded-lg border border-line">
                  <button aria-label="Decrease" className="grid size-7 place-items-center hover:bg-canvas" onClick={() => setQty(l.productId, l.qty - 1)}><Minus className="size-3.5" /></button>
                  <input aria-label="Quantity" className="tnum h-7 w-10 border-x border-line text-center text-[13px] font-semibold outline-none" value={l.qty} onChange={(e) => setQty(l.productId, parseInt(e.target.value) || 0)} />
                  <button aria-label="Increase" className="grid size-7 place-items-center hover:bg-canvas" onClick={() => setQty(l.productId, l.qty + 1)}><Plus className="size-3.5" /></button>
                </div>
                <Select aria-label="Line discount" className="h-7 w-[92px] text-[12px]" value={String(l.discount)} onChange={(v) => setCart((c) => c.map((x) => (x.productId === l.productId ? { ...x, discount: +v } : x)))} options={[0, 5, 10, 15, 20].map((n) => ({ value: String(n), label: n ? `−${n}%` : 'No disc.' }))} />
                <span className="flex-1" />
                <button aria-label="Remove" onClick={() => setCart((c) => c.filter((x) => x.productId !== l.productId))} className="rounded-md p-1 text-muted hover:bg-red-50 hover:text-red-600"><Trash2 className="size-4" /></button>
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-3 border-t border-line bg-[#fafcfd] px-5 py-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="relative"><UserIcon className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted" /><Input className="h-8 pl-8 text-[12.5px]" placeholder="Customer (optional)" value={customer} onChange={(e) => setCustomer(e.target.value)} /></div>
            <Input className={cx('h-8 text-[12.5px]', needsRx && !rxRef && 'border-amber-400')} placeholder={needsRx ? 'Rx reference *' : 'Rx reference'} value={rxRef} onChange={(e) => setRxRef(e.target.value)} />
          </div>
          <div className="tnum space-y-1 text-[13px]">
            <div className="flex justify-between text-muted"><span>Subtotal</span><span>{subtotal.toFixed(2)}</span></div>
            {discount > 0 && <div className="flex justify-between text-emerald-700"><span>Discount</span><span>−{discount.toFixed(2)}</span></div>}
            <div className="flex justify-between text-muted"><span>VAT {db.settings.taxRate}%</span><span>{taxAmt.toFixed(2)}</span></div>
            <div className="flex items-baseline justify-between pt-1"><span className="text-[14px] font-bold">Total</span><span className="text-[26px] font-extrabold tracking-[-0.02em]">{money(total)}</span></div>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {([['cash', Banknote, 'F2'], ['card', CreditCard, 'F3'], ['insurance', ShieldPlus, 'F4']] as const).map(([k, I, kb]) => (
              <button key={k} onClick={() => { setPayment(k); setErr('') }} className={cx('flex flex-col items-center gap-1 rounded-lg border py-2 text-[12px] font-semibold capitalize transition', payment === k ? 'border-teal bg-teal/8 text-teal' : 'border-line bg-white hover:border-teal/40')}>
                <I className="size-4" />{k}<kbd className="text-[10px] font-medium text-muted">{kb}</kbd>
              </button>
            ))}
          </div>
          {payment === 'cash' && (
            <div>
              <div className="flex gap-2"><Input ref={tenderRef} className="tnum h-10 flex-1 text-[15px] font-semibold" inputMode="decimal" placeholder="Cash tendered" value={tendered} onChange={(e) => setTendered(e.target.value.replace(/[^\d.]/g, ''))} onKeyDown={(e) => e.key === 'Enter' && charge()} />
                <Button className="h-10" onClick={() => setTendered(String(total))}>Exact</Button>
                <Button className="h-10" onClick={() => setTendered(String(Math.ceil(total / 50) * 50 || 50))}>{Math.ceil(total / 50) * 50 || 50}</Button></div>
              <div className="tnum mt-1.5 flex justify-between text-[13px]"><span className="text-muted">Change due</span><span className="font-bold text-teal">{change.toFixed(2)}</span></div>
            </div>
          )}
          {payment === 'card' && (
            <label className="flex items-start gap-2.5 rounded-lg border border-line bg-white p-2.5 text-[12.5px]"><input type="checkbox" className="mt-0.5 accent-teal" checked={cardOk} onChange={(e) => setCardOk(e.target.checked)} /><span><b>Terminal approved</b> — confirm the standalone card terminal shows approval. No payment is processed by PharmacyOS.</span></label>
          )}
          {payment === 'insurance' && (
            <div className="grid grid-cols-2 gap-2"><Select className="h-8 text-[12.5px]" value={ins.provider} onChange={(v) => setIns({ ...ins, provider: v })} options={['Bupa Arabia', 'Tawuniya', 'MedGulf', 'AXA'].map((x) => ({ value: x, label: x }))} /><Input className="h-8 text-[12.5px]" placeholder="Member ID" value={ins.member} onChange={(e) => setIns({ ...ins, member: e.target.value })} />
              <div className="col-span-2 text-[11.5px] text-muted">Eligibility is not verified — the claim is recorded for manual submission.</div></div>
          )}
          {err && <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-[12.5px] font-medium text-red-700"><AlertTriangle className="size-4" />{err}</div>}
          <Button variant="primary" size="lg" className="h-12 w-full text-[15px]" disabled={!cart.length} onClick={charge}>Complete sale · {money(total)}<kbd className="ml-1 rounded bg-white/20 px-1.5 text-[11px]">F9</kbd></Button>
        </div>
      </aside>

      <Confirm open={clear} onClose={() => setClear(false)} onConfirm={reset} danger title="Clear current sale?" body="All items in the cart will be removed." confirmLabel="Clear sale" />
      <Modal open={help} onClose={() => setHelp(false)} title="Keyboard shortcuts" width={420}>
        <div className="space-y-2 text-[13px]">{[['/', 'Focus search / scanner'], ['↑ ↓  Enter', 'Pick & add product (barcode adds instantly)'], ['+ / −', 'Change qty of selected line'], ['Delete', 'Remove selected line'], ['F2 / F3 / F4', 'Cash / Card / Insurance'], ['F9 or Ctrl+Enter', 'Complete sale'], ['F8', 'Clear sale'], ['Ctrl+K', 'Global search']].map(([k, v]) => <div key={k} className="flex justify-between"><span className="text-muted">{v}</span><kbd className="rounded border border-line bg-canvas px-2 text-[12px] font-semibold">{k}</kbd></div>)}</div>
      </Modal>
      {done && <ReceiptModal sale={done} onClose={() => { setDone(null); reset() }} fresh />}
    </div>
  )
}

export function ReceiptModal({ sale, onClose, fresh }: { sale: Sale; onClose: () => void; fresh?: boolean }) {
  const { db, money } = useStore()
  const br = db.branches.find((b) => b.id === sale.branchId)
  useEffect(() => {
    if (!fresh) return
    const h = (e: KeyboardEvent) => e.key === 'Enter' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [fresh, onClose])
  return (
    <Modal open onClose={onClose} title={fresh ? 'Sale completed' : 'Receipt'} width={420} footer={<><Button icon={Printer} onClick={() => window.print()}>Print</Button><Button variant="primary" onClick={onClose} autoFocus>{fresh ? 'New sale (Enter)' : 'Close'}</Button></>}>
      {fresh && <div className="mb-4 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-[13px] font-semibold text-emerald-700"><CheckCircle2 className="size-4" />{sale.payment === 'cash' ? `Change due: ${money(round2(sale.tendered - sale.total))}` : 'Payment recorded'}</div>}
      <div className="rounded-lg border border-dashed border-line p-4 font-mono text-[12px]">
        <div className="text-center font-sans"><div className="text-[14px] font-bold">{db.settings.orgName}</div><div className="text-muted">{br?.name} · {br?.phone}</div><div className="text-muted">VAT reg. {db.settings.crNumber}</div></div>
        <div className="my-3 border-t border-dashed border-line" />
        <div className="flex justify-between"><span>{sale.no}</span><span>{fDateTime(sale.date)}</span></div>
        <div className="text-muted">{sale.customer}{sale.rxRef && ` · Rx ${sale.rxRef}`}</div>
        <div className="my-3 border-t border-dashed border-line" />
        {sale.items.map((i) => <div key={i.productId} className="flex justify-between"><span className="truncate pr-2">{i.qty}× {i.name}{i.discount ? ` (−${i.discount}%)` : ''}</span><span>{(i.qty * i.price * (1 - i.discount / 100)).toFixed(2)}</span></div>)}
        <div className="my-3 border-t border-dashed border-line" />
        <div className="flex justify-between"><span>VAT</span><span>{sale.tax.toFixed(2)}</span></div>
        <div className="flex justify-between text-[14px] font-bold"><span>TOTAL</span><span>{money(sale.total)}</span></div>
        <div className="flex justify-between text-muted capitalize"><span>{sale.payment}</span><span>{sale.tendered.toFixed(2)}</span></div>
        <div className="mt-3 text-center font-sans text-[11px] text-muted">{db.settings.receiptFooter}</div>
      </div>
    </Modal>
  )
}

export function SalesHistory() {
  const { db, scope, money, can } = useStore()
  const loading = useLoading()
  const [q, setQ] = useState('')
  const [pay, setPay] = useState('all')
  const [status, setStatus] = useState('all')
  const [range, setRange] = useState('30')
  const rows = db.sales.filter((s) => (scope === 'all' || s.branchId === scope) && (pay === 'all' || s.payment === pay) && (status === 'all' || s.status === status) && (range === 'all' || Date.now() - new Date(s.date).getTime() < +range * 86400000) && (!q || `${s.no} ${s.customer} ${s.items.map((i) => i.name).join(' ')}`.toLowerCase().includes(q.toLowerCase())))
  const total = rows.reduce((a, s) => a + s.total, 0)
  return (
    <div>
      <PageHeader title="Sales History" subtitle={`${rows.length} invoices · ${money(total)}`} actions={<><Button icon={Download} onClick={() => downloadCSV('sales.csv', [['Invoice', 'Date', 'Branch', 'Customer', 'Payment', 'Total', 'Status'], ...rows.map((s) => [s.no, s.date, db.branches.find((b) => b.id === s.branchId)!.code, s.customer, s.payment, s.total, s.status])])}>Export CSV</Button>{can('pos') && <Button variant="primary" icon={ScanLine} onClick={() => go('pos')}>New sale</Button>}</>} />
      <Card pad={false}>
        <Toolbar>
          <SearchInput value={q} onChange={setQ} placeholder="Search invoice, customer, product…" className="w-[300px]" />
          <Select aria-label="Date range" className="w-[140px]" value={range} onChange={setRange} options={[{ value: '1', label: 'Today' }, { value: '7', label: 'Last 7 days' }, { value: '30', label: 'Last 30 days' }, { value: 'all', label: 'All time' }]} />
          <Select aria-label="Payment" className="w-[140px]" value={pay} onChange={setPay} options={[{ value: 'all', label: 'All payments' }, { value: 'cash', label: 'Cash' }, { value: 'card', label: 'Card' }, { value: 'insurance', label: 'Insurance' }]} />
          <Select aria-label="Status" className="w-[170px]" value={status} onChange={setStatus} options={[{ value: 'all', label: 'All statuses' }, { value: 'completed', label: 'Completed' }, { value: 'partially_returned', label: 'Partially returned' }, { value: 'returned', label: 'Returned' }]} />
        </Toolbar>
        {loading ? <Skeleton /> : <Table rows={rows} rowKey={(r) => r.id} onRow={(r) => go(`sales/${r.id}`)} cols={[
          { key: 'no', label: 'Invoice', render: (r) => <span className="font-semibold text-teal">{r.no}</span>, sort: (r) => r.no },
          { key: 'date', label: 'Date', render: (r) => fDateTime(r.date), sort: (r) => r.date },
          { key: 'br', label: 'Branch', render: (r) => db.branches.find((b) => b.id === r.branchId)?.name },
          { key: 'c', label: 'Customer', render: (r) => <span className="text-muted">{r.customer}</span> },
          { key: 'i', label: 'Items', align: 'right', render: (r) => r.items.reduce((a, i) => a + i.qty, 0) },
          { key: 'p', label: 'Payment', render: (r) => <span className="capitalize">{r.payment}</span> },
          { key: 't', label: 'Total', align: 'right', render: (r) => <b>{money(r.total)}</b>, sort: (r) => r.total },
          { key: 's', label: 'Status', render: (r) => <StatusBadge s={r.status} /> },
        ]} />}
      </Card>
    </div>
  )
}

export function SaleDetails({ id }: { id: string }) {
  const { db, money, can } = useStore()
  const [receipt, setReceipt] = useState(false)
  const [ret, setRet] = useState(false)
  const s = db.sales.find((x) => x.id === id)
  if (!s) return <Empty title="Sale not found" action={<Button onClick={() => go('sales')}>Back to sales</Button>} />
  const returns = db.returns.filter((r) => r.saleId === s.id)
  const returnable = s.items.some((i) => i.qty > i.returned)
  return (
    <div>
      <PageHeader back="sales" title={<span className="flex items-center gap-3">{s.no}<StatusBadge s={s.status} /></span>} subtitle={`${fDateTime(s.date)} · ${db.branches.find((b) => b.id === s.branchId)?.name}`}
        actions={<><Button icon={Printer} onClick={() => setReceipt(true)}>Receipt</Button>{can('returns') && <Button variant="primary" icon={Undo2} disabled={!returnable} onClick={() => setRet(true)}>Process return</Button>}</>} />
      <div className="grid grid-cols-3 gap-4">
        <Card className="col-span-2" title="Items" pad={false}>
          <Table rows={s.items} rowKey={(r) => r.productId} cols={[
            { key: 'n', label: 'Product', render: (r) => <button className="font-semibold hover:text-teal" onClick={() => go(`products/${r.productId}`)}>{r.name}</button> },
            { key: 'l', label: 'Batches (FEFO)', render: (r) => <span className="text-[12px] text-muted">{r.allocs.map((a) => `${a.lot} ×${a.qty}`).join(', ')}</span> },
            { key: 'q', label: 'Qty', align: 'right', render: (r) => r.qty },
            { key: 'r', label: 'Returned', align: 'right', render: (r) => (r.returned ? <span className="text-amber-700">{r.returned}</span> : '—') },
            { key: 'p', label: 'Price', align: 'right', render: (r) => r.price.toFixed(2) },
            { key: 'd', label: 'Disc.', align: 'right', render: (r) => (r.discount ? `${r.discount}%` : '—') },
            { key: 't', label: 'Line total', align: 'right', render: (r) => <b>{(r.qty * r.price * (1 - r.discount / 100)).toFixed(2)}</b> },
          ]} />
          <div className="tnum ml-auto w-[280px] space-y-1 px-5 py-4 text-[13px]">
            <div className="flex justify-between text-muted"><span>Subtotal</span><span>{s.subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between text-muted"><span>Discount</span><span>−{s.discount.toFixed(2)}</span></div>
            <div className="flex justify-between text-muted"><span>VAT</span><span>{s.tax.toFixed(2)}</span></div>
            <div className="flex justify-between border-t border-line pt-2 text-[15px] font-bold"><span>Total</span><span>{money(s.total)}</span></div>
          </div>
        </Card>
        <div className="space-y-4">
          <Card title="Details"><KV items={[['Customer', s.customer], ['Cashier', db.users.find((u) => u.id === s.userId)?.name], ['Payment', <span className="capitalize">{s.payment}</span>], ['Tendered', s.tendered.toFixed(2)], ['Rx reference', s.rxRef || '—'], ['Shift', s.shiftId ? 'Linked' : '—']]} /></Card>
          <Card title="Returns" pad={false}>
            {returns.length === 0 ? <div className="p-5 text-[13px] text-muted">No returns against this invoice.</div> : returns.map((r) => <button key={r.id} onClick={() => go(`returns/${r.id}`)} className="flex w-full justify-between border-b border-line/70 px-5 py-3 text-left last:border-0 hover:bg-canvas"><div><div className="text-[13px] font-semibold text-teal">{r.no}</div><div className="text-[11.5px] text-muted">{fDateTime(r.date)}</div></div><b className="tnum text-[13px]">−{money(r.refund)}</b></button>)}
          </Card>
        </div>
      </div>
      {receipt && <ReceiptModal sale={s} onClose={() => setReceipt(false)} />}
      <ReturnModal open={ret} onClose={() => setRet(false)} sale={s} />
    </div>
  )
}

function ReturnModal({ open, onClose, sale }: { open: boolean; onClose: () => void; sale: Sale }) {
  const { db, act, money, me } = useStore()
  const toast = useToast()
  const [qty, setQty] = useState<Record<string, number>>({})
  const [restock, setRestock] = useState(true)
  const [reason, setReason] = useState('Customer changed mind')
  const [notes, setNotes] = useState('')
  const [method, setMethod] = useState<'cash' | 'card' | 'insurance'>(sale.payment)
  const ratio = sale.subtotal - sale.discount > 0 ? sale.total / (sale.subtotal - sale.discount) : 1
  const refund = round2(sale.items.reduce((a, i) => a + (qty[i.productId] || 0) * i.price * (1 - i.discount / 100) * ratio, 0))
  const any = Object.values(qty).some((v) => v > 0)
  const submit = () => {
    let rid = ''
    act((d) => {
      const s = d.sales.find((x) => x.id === sale.id)!
      const items: { productId: string; name: string; qty: number; price: number; restock: boolean }[] = []
      const no = nextNo(d, 'RET')
      s.items.forEach((i) => {
        const n = qty[i.productId] || 0
        if (!n) return
        i.returned += n
        items.push({ productId: i.productId, name: i.name, qty: n, price: i.price, restock })
        if (restock) {
          let left = n
          for (const a of [...i.allocs].reverse()) { if (!left) break; const t = Math.min(a.qty, left); const b = d.batches.find((x) => x.id === a.batchId); if (b) { b.qty += t; move(d, { productId: i.productId, branchId: s.branchId, lot: a.lot, type: 'return', qty: t, ref: no }) } left -= t }
        }
      })
      s.status = s.items.every((i) => i.returned >= i.qty) ? 'returned' : 'partially_returned'
      rid = uid('rt')
      d.returns.unshift({ id: rid, no, saleId: s.id, date: now(), branchId: s.branchId, userId: me!.id, items, reason: notes ? `${reason} — ${notes}` : reason, refund, method, status: 'refunded' })
      logAudit(d, 'return.create', no, `Refund ${money(refund)} via ${method} for ${s.no}${restock ? ' · restocked' : ' · quarantined'}`, s.branchId)
    })
    toast({ kind: 'success', title: 'Return processed', body: `${money(refund)} refund recorded (${method}).` })
    onClose()
    go(`returns/${rid}`)
  }
  return (
    <Modal open={open} onClose={onClose} title={`Return items from ${sale.no}`} desc="Select quantities to return. Refund is prorated including VAT and discounts." width={620}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!any} onClick={submit}>Refund {money(refund)}</Button></>}>
      <div className="space-y-2">
        {sale.items.map((i) => { const max = i.qty - i.returned; return (
          <div key={i.productId} className="flex items-center gap-3 rounded-lg border border-line p-3">
            <div className="flex-1"><div className="text-[13px] font-semibold">{i.name}</div><div className="text-[11.5px] text-muted">Sold {i.qty} · returned {i.returned} · {i.price.toFixed(2)} each</div></div>
            <Input aria-label={`Return qty ${i.name}`} disabled={max === 0} className="tnum w-20 text-center" type="number" min={0} max={max} value={qty[i.productId] || 0} onChange={(e) => setQty({ ...qty, [i.productId]: Math.max(0, Math.min(max, parseInt(e.target.value) || 0)) })} />
            <Button size="sm" variant="ghost" disabled={max === 0} onClick={() => setQty({ ...qty, [i.productId]: max })}>All</Button>
          </div>) })}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Field label="Reason"><Select value={reason} onChange={(v) => { setReason(v); if (v === 'Damaged / defective' || v === 'Expired') setRestock(false) }} options={['Customer changed mind', 'Wrong item dispensed', 'Damaged / defective', 'Expired', 'Prescription changed'].map((x) => ({ value: x, label: x }))} /></Field>
        <Field label="Refund method"><Select value={method} onChange={(v) => setMethod(v as typeof method)} options={[{ value: 'cash', label: 'Cash (from drawer)' }, { value: 'card', label: 'Card (manual terminal refund)' }, { value: 'insurance', label: 'Insurance claim reversal' }]} /></Field>
      </div>
      <Field label="Notes" className="mt-3"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" /></Field>
      <div className="mt-3 flex items-center justify-between rounded-lg bg-canvas p-3"><div><div className="text-[13px] font-semibold">Return to sellable stock</div><div className="text-[12px] text-muted">Turn off for damaged or expired items — they won't be restocked.</div></div><Toggle checked={restock} onChange={setRestock} label="Restock" /></div>
    </Modal>
  )
}

export function Returns() {
  const { db, scope, money, can } = useStore()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [find, setFind] = useState(false)
  const [inv, setInv] = useState('')
  const [tab, setTab] = useState<'all' | 'restocked' | 'writeoff'>('all')
  const rows = db.returns.filter((r) => (scope === 'all' || r.branchId === scope) && (tab === 'all' || (tab === 'restocked' ? r.items.some((i) => i.restock) : r.items.some((i) => !i.restock))) && (!q || `${r.no} ${db.sales.find((s) => s.id === r.saleId)?.no} ${r.reason}`.toLowerCase().includes(q.toLowerCase())))
  return (
    <div>
      <PageHeader title="Sales Returns" subtitle={`${rows.length} returns · ${money(rows.reduce((a, r) => a + r.refund, 0))} refunded`} actions={can('returns') && <Button variant="primary" icon={Undo2} onClick={() => setFind(true)}>New return</Button>} />
      <Card pad={false}>
        <Toolbar><SearchInput value={q} onChange={setQ} placeholder="Search return or invoice no…" className="w-[300px]" /><div className="flex-1" /><Tabs value={tab} onChange={setTab} tabs={[{ value: 'all', label: 'All' }, { value: 'restocked', label: 'Restocked' }, { value: 'writeoff', label: 'Not restocked' }]} /></Toolbar>
        <Table rows={rows} rowKey={(r) => r.id} onRow={(r) => go(`returns/${r.id}`)} empty={<Empty icon={Undo2} title="No returns yet" body="Returns are created from a sale's details page." action={can('returns') && <Button onClick={() => setFind(true)}>Find an invoice</Button>} />} cols={[
          { key: 'no', label: 'Return', render: (r) => <span className="font-semibold text-teal">{r.no}</span> },
          { key: 'inv', label: 'Invoice', render: (r) => db.sales.find((s) => s.id === r.saleId)?.no },
          { key: 'd', label: 'Date', render: (r) => fDateTime(r.date), sort: (r) => r.date },
          { key: 'b', label: 'Branch', render: (r) => db.branches.find((b) => b.id === r.branchId)?.name },
          { key: 'r', label: 'Reason', render: (r) => <span className="text-muted">{r.reason}</span> },
          { key: 'm', label: 'Method', render: (r) => <span className="capitalize">{r.method}</span> },
          { key: 'a', label: 'Refund', align: 'right', render: (r) => <b>{money(r.refund)}</b>, sort: (r) => r.refund },
          { key: 's', label: 'Status', render: (r) => <StatusBadge s={r.status} /> },
        ]} />
      </Card>
      <Modal open={find} onClose={() => setFind(false)} title="Find original invoice" desc="Returns must reference the original sale." width={420} footer={<><Button onClick={() => setFind(false)}>Cancel</Button><Button variant="primary" onClick={() => { const s = db.sales.find((x) => x.no.toLowerCase() === inv.trim().toLowerCase()); if (!s) return toast({ kind: 'error', title: 'Invoice not found', body: `No sale matches "${inv}".` }); setFind(false); go(`sales/${s.id}`) }}>Open invoice</Button></>}>
        <Field label="Invoice number" hint={`e.g. ${db.sales[0]?.no}`}><Input autoFocus value={inv} onChange={(e) => setInv(e.target.value)} placeholder="INV-" /></Field>
        <div className="mt-3 text-[12px] text-muted">Recent: {db.sales.filter((s) => scope === 'all' || s.branchId === scope).slice(0, 4).map((s) => <button key={s.id} className="mr-2 font-semibold text-teal hover:underline" onClick={() => setInv(s.no)}>{s.no}</button>)}</div>
      </Modal>
    </div>
  )
}

export function ReturnDetails({ id }: { id: string }) {
  const { db, money } = useStore()
  const r = db.returns.find((x) => x.id === id)
  if (!r) return <Empty title="Return not found" action={<Button onClick={() => go('returns')}>Back</Button>} />
  const sale = db.sales.find((s) => s.id === r.saleId)
  return (
    <div>
      <PageHeader back="returns" title={<span className="flex items-center gap-3">{r.no}<StatusBadge s={r.status} /></span>} subtitle={`${fDateTime(r.date)} · ${db.branches.find((b) => b.id === r.branchId)?.name}`} actions={<><Button icon={Printer} onClick={() => window.print()}>Print credit note</Button>{sale && <Button icon={ReceiptIcon} onClick={() => go(`sales/${sale.id}`)}>Original invoice</Button>}</>} />
      <div className="grid grid-cols-3 gap-4">
        <Card className="col-span-2" title="Returned items" pad={false}>
          <Table rows={r.items} rowKey={(i) => i.productId} cols={[
            { key: 'n', label: 'Product', render: (i) => <b>{i.name}</b> },
            { key: 'q', label: 'Qty', align: 'right', render: (i) => i.qty },
            { key: 'p', label: 'Unit price', align: 'right', render: (i) => i.price.toFixed(2) },
            { key: 'r', label: 'Disposition', render: (i) => (i.restock ? <Badge tone="green">Restocked</Badge> : <Badge tone="red">Not restocked</Badge>) },
          ]} />
        </Card>
        <Card title="Refund record"><KV items={[['Refund amount', <b className="text-[16px]">{money(r.refund)}</b>], ['Method', <span className="capitalize">{r.method}</span>], ['Invoice', sale?.no], ['Processed by', db.users.find((u) => u.id === r.userId)?.name], ['Reason', r.reason], ['Customer', sale?.customer]]} />
          {r.method !== 'cash' && <div className="mt-4 rounded-lg bg-amber-50 p-3 text-[12px] text-amber-800">{r.method === 'card' ? 'Complete the refund on the card terminal — PharmacyOS does not move funds.' : 'Submit the claim reversal to the insurer manually.'}</div>}
        </Card>
      </div>
    </div>
  )
}
