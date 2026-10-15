import { useMemo, useState } from 'react'
import { Wallet, Lock, Plus, Trash2, ReceiptText, Download, TrendingUp, Banknote, CreditCard, ShieldPlus, Undo2, PiggyBank, Scale, ScanLine } from 'lucide-react'
import { useStore, logAudit, uid, now, inScope, round2 } from '../store'
import { Button, Card, PageHeader, Field, Input, Select, Modal, Confirm, Badge, StatusBadge, Table, Toolbar, SearchInput, Empty, go, fDate, fDateTime, useToast, Stat, Bars, Meter, Tabs, cx } from '../ui'
import { shiftCash, downloadCSV } from './sales'

export function Shifts() {
  const { db, act, scope, me, money, can } = useStore()
  const toast = useToast()
  const [close, setClose] = useState(false)
  const [counted, setCounted] = useState('')
  const [notes, setNotes] = useState('')
  const [fb, setFb] = useState('all')
  const mine = db.shifts.find((s) => s.status === 'open' && s.userId === me!.id && (scope === 'all' || s.branchId === scope))
  const cash = mine ? shiftCash(db, mine) : null
  const rows = db.shifts.filter((s) => inScope(s.branchId, scope) && (fb === 'all' || s.status === fb))
  const mineSales = mine ? db.sales.filter((s) => s.shiftId === mine.id) : []
  const variance = cash && counted !== '' ? round2(+counted - cash.expected) : 0
  return (
    <div>
      <PageHeader title="Cash Shifts" subtitle="Drawer accountability per cashier, with expected vs. counted cash." actions={can('pos') && !mine && <Button variant="primary" icon={ScanLine} onClick={() => go('pos')}>Open shift in POS</Button>} />
      {mine && cash && (
        <div className="mb-5 overflow-hidden rounded-xl border border-line bg-white">
          <div className="flex items-center justify-between bg-navy px-6 py-4 text-white">
            <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-lg bg-mint/15 text-mint"><Wallet className="size-5" /></span><div><div className="text-[15px] font-bold">Your open shift · {db.branches.find((b) => b.id === mine.branchId)?.name}</div><div className="text-[12.5px] text-[#a9bccb]">Opened {fDateTime(mine.openedAt)} · {mineSales.length} sales</div></div></div>
            <Button variant="primary" icon={Lock} onClick={() => { setCounted(''); setClose(true) }}>Close shift</Button>
          </div>
          <div className="grid grid-cols-5 divide-x divide-line">
            {[['Opening float', mine.openingCash], ['Cash sales', cash.sales], ['Cash refunds', -cash.refunds], ['Cash expenses', -cash.exp], ['Expected in drawer', cash.expected]].map(([l, v], i) => (
              <div key={l as string} className="px-5 py-4"><div className="text-[12px] font-semibold text-muted">{l}</div><div className={cx('tnum mt-1 text-[18px] font-extrabold', i === 4 && 'text-teal')}>{money(v as number)}</div></div>
            ))}
          </div>
          <div className="flex gap-6 border-t border-line px-6 py-3 text-[12.5px] text-muted">
            <span className="flex items-center gap-1.5"><CreditCard className="size-3.5" />Card {money(mineSales.filter((s) => s.payment === 'card').reduce((a, s) => a + s.total, 0))}</span>
            <span className="flex items-center gap-1.5"><ShieldPlus className="size-3.5" />Insurance {money(mineSales.filter((s) => s.payment === 'insurance').reduce((a, s) => a + s.total, 0))}</span>
          </div>
        </div>
      )}
      <Card pad={false}>
        <Toolbar><Tabs value={fb} onChange={setFb} tabs={[{ value: 'all', label: 'All shifts' }, { value: 'open', label: 'Open', count: db.shifts.filter((s) => s.status === 'open' && inScope(s.branchId, scope)).length }, { value: 'closed', label: 'Closed' }]} /></Toolbar>
        <Table rows={rows} rowKey={(s) => s.id} pageSize={15} cols={[
          { key: 'o', label: 'Opened', render: (s) => fDateTime(s.openedAt), sort: (s) => s.openedAt },
          { key: 'c', label: 'Closed', render: (s) => <span className="text-muted">{s.closedAt ? fDateTime(s.closedAt) : '—'}</span> },
          { key: 'b', label: 'Branch', render: (s) => db.branches.find((b) => b.id === s.branchId)?.name },
          { key: 'u', label: 'Cashier', render: (s) => db.users.find((u) => u.id === s.userId)?.name },
          { key: 'n', label: 'Sales', align: 'right', render: (s) => db.sales.filter((x) => x.shiftId === s.id).length },
          { key: 'e', label: 'Expected', align: 'right', render: (s) => money(s.expectedCash ?? shiftCash(db, s).expected) },
          { key: 'ct', label: 'Counted', align: 'right', render: (s) => (s.countedCash !== undefined ? money(s.countedCash) : '—') },
          { key: 'v', label: 'Variance', align: 'right', sort: (s) => (s.countedCash ?? 0) - (s.expectedCash ?? 0), render: (s) => { if (s.countedCash === undefined) return '—'; const v = round2(s.countedCash - s.expectedCash!); return <b className={v < 0 ? 'text-red-600' : v > 0 ? 'text-amber-600' : 'text-emerald-700'}>{v === 0 ? 'Balanced' : (v > 0 ? '+' : '') + v.toFixed(2)}</b> } },
          { key: 's', label: 'Status', render: (s) => <StatusBadge s={s.status} /> },
        ]} />
      </Card>
      <Modal open={close} onClose={() => setClose(false)} title="Close shift" desc="Count all cash in the drawer, including the opening float." width={460}
        footer={<><Button onClick={() => setClose(false)}>Cancel</Button><Button variant="primary" disabled={counted === ''} onClick={() => {
          act((d) => { const s = d.shifts.find((x) => x.id === mine!.id)!; s.status = 'closed'; s.closedAt = now(); s.expectedCash = cash!.expected; s.countedCash = +counted; s.notes = notes; logAudit(d, 'shift.close', 'Cash shift', `Expected ${money(cash!.expected)} · counted ${money(+counted)} · variance ${variance.toFixed(2)}`, s.branchId)
            if (variance !== 0) d.notifications.unshift({ id: uid('n'), date: now(), title: 'Shift variance recorded', body: `${d.users.find((u) => u.id === s.userId)?.name}: ${variance > 0 ? '+' : ''}${variance.toFixed(2)} at ${d.branches.find((b) => b.id === s.branchId)?.name}.`, type: 'sales', read: false, link: 'shifts', branchId: s.branchId }) })
          setClose(false); toast({ kind: variance === 0 ? 'success' : 'warning', title: 'Shift closed', body: variance === 0 ? 'Drawer balanced.' : `Variance of ${money(variance)} recorded.` })
        }}>Close shift</Button></>}>
        <div className="mb-4 rounded-lg bg-canvas p-4"><div className="flex justify-between text-[13px]"><span className="text-muted">Expected cash</span><b className="tnum">{money(cash?.expected || 0)}</b></div></div>
        <Field label="Counted cash"><Input autoFocus className="tnum h-11 text-[16px] font-bold" inputMode="decimal" value={counted} onChange={(e) => setCounted(e.target.value.replace(/[^\d.]/g, ''))} /></Field>
        {counted !== '' && <div className={cx('mt-3 flex justify-between rounded-lg p-3 text-[13px] font-semibold', variance === 0 ? 'bg-emerald-50 text-emerald-700' : variance < 0 ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700')}><span>{variance === 0 ? 'Balanced' : variance < 0 ? 'Short' : 'Over'}</span><span className="tnum">{variance.toFixed(2)}</span></div>}
        <Field label="Notes" className="mt-3"><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={variance ? 'Explain the variance' : 'Optional'} /></Field>
      </Modal>
    </div>
  )
}

const ECATS = ['Rent', 'Utilities', 'Salaries', 'Maintenance', 'Supplies', 'Delivery', 'Marketing', 'Other']
export function Expenses() {
  const { db, act, scope, myBranches, me, money } = useStore()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [del, setDel] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('all')
  const [f, setF] = useState({ branchId: scope === 'all' ? myBranches[0]?.id : scope, category: 'Supplies', amount: '', description: '', method: 'cash' as 'cash' | 'card' | 'bank', date: new Date().toISOString().slice(0, 10) })
  const [err, setErr] = useState<Record<string, string>>({})
  const rows = db.expenses.filter((e) => inScope(e.branchId, scope) && (cat === 'all' || e.category === cat) && (!q || e.description.toLowerCase().includes(q.toLowerCase()))).sort((a, b) => b.date.localeCompare(a.date))
  const total = rows.reduce((a, e) => a + e.amount, 0)
  const byCat = ECATS.map((c) => ({ c, v: rows.filter((e) => e.category === c).reduce((a, e) => a + e.amount, 0) })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v)
  const shift = db.shifts.find((s) => s.status === 'open' && s.userId === me!.id && s.branchId === f.branchId)
  const save = () => {
    const er: Record<string, string> = {}
    if (!(+f.amount > 0)) er.amount = 'Enter an amount'
    if (f.description.trim().length < 3) er.description = 'Describe the expense'
    if (f.method === 'cash' && !shift) er.method = 'Cash expenses need your open shift at this branch'
    setErr(er)
    if (Object.keys(er).length) return
    act((d) => { d.expenses.unshift({ id: uid('ex'), branchId: f.branchId, date: new Date(f.date + 'T12:00').toISOString(), category: f.category, amount: +f.amount, description: f.description.trim(), method: f.method, userId: me!.id, shiftId: f.method === 'cash' ? shift!.id : null }); logAudit(d, 'expense.create', f.category, `${money(+f.amount)} · ${f.description}`, f.branchId) })
    toast({ kind: 'success', title: 'Expense recorded', body: f.method === 'cash' ? 'Deducted from your shift\'s expected cash.' : undefined })
    setOpen(false); setF({ ...f, amount: '', description: '' })
  }
  return (
    <div>
      <PageHeader title="Expenses" subtitle={`${rows.length} entries · ${money(total)}`} actions={<><Button icon={Download} onClick={() => downloadCSV('expenses.csv', [['Date', 'Branch', 'Category', 'Description', 'Method', 'Amount'], ...rows.map((e) => [e.date, e.branchId, e.category, e.description, e.method, e.amount])])}>Export</Button><Button variant="primary" icon={Plus} onClick={() => setOpen(true)}>Record expense</Button></>} />
      <div className="grid grid-cols-[1fr_300px] gap-4">
        <Card pad={false}>
          <Toolbar><SearchInput value={q} onChange={setQ} placeholder="Search description…" className="w-[260px]" /><Select aria-label="Category" className="w-[160px]" value={cat} onChange={setCat} options={[{ value: 'all', label: 'All categories' }, ...ECATS.map((c) => ({ value: c, label: c }))]} /></Toolbar>
          <Table rows={rows} rowKey={(e) => e.id} empty={<Empty icon={ReceiptText} title="No expenses" action={<Button onClick={() => setOpen(true)}>Record expense</Button>} />} cols={[
            { key: 'd', label: 'Date', render: (e) => fDate(e.date), sort: (e) => e.date },
            { key: 'b', label: 'Branch', render: (e) => db.branches.find((b) => b.id === e.branchId)?.code },
            { key: 'c', label: 'Category', render: (e) => <Badge>{e.category}</Badge> },
            { key: 'x', label: 'Description', render: (e) => e.description },
            { key: 'm', label: 'Method', render: (e) => <span className="capitalize text-muted">{e.method}</span> },
            { key: 'u', label: 'By', render: (e) => <span className="text-muted">{db.users.find((u) => u.id === e.userId)?.name}</span> },
            { key: 'a', label: 'Amount', align: 'right', render: (e) => <b>{money(e.amount)}</b>, sort: (e) => e.amount },
            { key: 'del', label: '', align: 'right', render: (e) => <button aria-label="Delete expense" onClick={() => setDel(e.id)} className="rounded p-1 text-muted hover:bg-red-50 hover:text-red-600"><Trash2 className="size-4" /></button> },
          ]} />
        </Card>
        <Card title="By category">{byCat.length === 0 ? <div className="text-[13px] text-muted">No data</div> : byCat.map((x) => <div key={x.c} className="mb-3.5 last:mb-0"><div className="mb-1 flex justify-between text-[13px]"><span className="font-semibold">{x.c}</span><span className="tnum text-muted">{money(x.v)}</span></div><Meter value={x.v} max={byCat[0].v} /></div>)}</Card>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Record expense" width={500} footer={<><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" onClick={save}>Save expense</Button></>}>
        <div className="grid grid-cols-2 gap-3.5">
          <Field label="Branch"><Select value={f.branchId} onChange={(v) => setF({ ...f, branchId: v })} options={myBranches.map((b) => ({ value: b.id, label: b.name }))} /></Field>
          <Field label="Date"><Input type="date" value={f.date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <Field label="Category"><Select value={f.category} onChange={(v) => setF({ ...f, category: v })} options={ECATS.map((c) => ({ value: c, label: c }))} /></Field>
          <Field label={`Amount (${db.settings.currency})`} error={err.amount}><Input autoFocus inputMode="decimal" value={f.amount} invalid={!!err.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/[^\d.]/g, '') })} /></Field>
          <Field label="Description" error={err.description} className="col-span-2"><Input value={f.description} invalid={!!err.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <Field label="Paid via" error={err.method} hint={f.method === 'cash' ? (shift ? 'Taken from your open drawer' : undefined) : undefined} className="col-span-2"><Select value={f.method} onChange={(v) => setF({ ...f, method: v as typeof f.method })} options={[{ value: 'cash', label: 'Cash from drawer' }, { value: 'card', label: 'Company card' }, { value: 'bank', label: 'Bank transfer' }]} /></Field>
        </div>
      </Modal>
      <Confirm open={!!del} onClose={() => setDel(null)} danger title="Delete expense?" confirmLabel="Delete" body="This entry will be removed and logged in the audit trail." onConfirm={() => { act((d) => { const e = d.expenses.find((x) => x.id === del)!; d.expenses = d.expenses.filter((x) => x.id !== del); logAudit(d, 'expense.delete', e.category, `${money(e.amount)} · ${e.description}`, e.branchId) }); toast({ kind: 'success', title: 'Expense deleted' }) }} />
    </div>
  )
}

export function Reports() {
  const { db, scope, money } = useStore()
  const [range, setRange] = useState('30')
  const r = useMemo(() => {
    const days = +range
    const since = Date.now() - days * 86400000
    const sales = db.sales.filter((s) => inScope(s.branchId, scope) && new Date(s.date).getTime() >= since)
    const returns = db.returns.filter((x) => inScope(x.branchId, scope) && new Date(x.date).getTime() >= since)
    const expenses = db.expenses.filter((x) => inScope(x.branchId, scope) && new Date(x.date).getTime() >= since)
    const gross = sales.reduce((a, s) => a + s.total, 0)
    const tax = sales.reduce((a, s) => a + s.tax, 0)
    const refunds = returns.reduce((a, x) => a + x.refund, 0)
    const cost = (id: string) => db.products.find((p) => p.id === id)?.cost || 0
    const cogs = sales.reduce((a, s) => a + s.items.reduce((b, i) => b + (i.qty - i.returned) * cost(i.productId), 0), 0)
    const netRev = gross - tax - refunds
    const exp = expenses.reduce((a, e) => a + e.amount, 0)
    const daily = Array.from({ length: days }, (_, i) => { const dt = new Date(Date.now() - (days - 1 - i) * 86400000).toISOString().slice(0, 10); return { label: dt.slice(5), value: sales.filter((s) => s.date.slice(0, 10) === dt).reduce((a, s) => a + s.total, 0), hi: i === days - 1 } })
    const cat = new Map<string, number>(), prod = new Map<string, { n: string; q: number; v: number; m: number }>()
    sales.forEach((s) => s.items.forEach((i) => { const p = db.products.find((x) => x.id === i.productId)!; const v = i.qty * i.price * (1 - i.discount / 100); cat.set(p.category, (cat.get(p.category) || 0) + v); const t = prod.get(p.id) || { n: p.name, q: 0, v: 0, m: 0 }; t.q += i.qty; t.v += v; t.m += v - i.qty * p.cost; prod.set(p.id, t) }))
    const hours = Array.from({ length: 15 }, (_, k) => ({ label: `${k + 8}:00`, value: sales.filter((s) => new Date(s.date).getHours() === k + 8).length }))
    const pay = (['cash', 'card', 'insurance'] as const).map((k) => ({ k, v: sales.filter((s) => s.payment === k).reduce((a, s) => a + s.total, 0) }))
    const branches = db.branches.filter((b) => inScope(b.id, scope)).map((b) => { const bs = sales.filter((s) => s.branchId === b.id); return { b, rev: bs.reduce((a, s) => a + s.total, 0), n: bs.length, exp: expenses.filter((e) => e.branchId === b.id).reduce((a, e) => a + e.amount, 0) } })
    return { sales, gross, tax, refunds, cogs, netRev, exp, gp: netRev - cogs, net: netRev - cogs - exp, daily, cat: [...cat.entries()].sort((a, b) => b[1] - a[1]), prod: [...prod.values()].sort((a, b) => b.v - a.v).slice(0, 10), hours, pay, branches, returnsN: returns.length }
  }, [db, scope, range])
  const icons = { cash: Banknote, card: CreditCard, insurance: ShieldPlus }
  return (
    <div>
      <PageHeader title="Reports & Analytics" subtitle={`${scope === 'all' ? 'All branches' : db.branches.find((b) => b.id === scope)?.name} · computed from recorded transactions`}
        actions={<><Tabs value={range} onChange={setRange} tabs={[{ value: '7', label: '7 days' }, { value: '14', label: '14 days' }, { value: '30', label: '30 days' }]} /><Button icon={Download} onClick={() => downloadCSV(`pnl-${range}d.csv`, [['Metric', 'Amount'], ['Gross sales (incl. VAT)', r.gross], ['VAT collected', r.tax], ['Refunds', r.refunds], ['Net revenue', r.netRev], ['COGS', r.cogs], ['Gross profit', r.gp], ['Operating expenses', r.exp], ['Net profit', r.net]])}>Export P&amp;L</Button></>} />
      <div className="grid grid-cols-5 gap-4">
        <Stat label="Gross sales" value={money(r.gross)} sub={`${r.sales.length} invoices`} icon={TrendingUp} />
        <Stat label="Refunds" value={money(r.refunds)} sub={`${r.returnsN} returns`} icon={Undo2} tone="amber" />
        <Stat label="Gross profit" value={money(r.gp)} sub={`${r.netRev ? Math.round((r.gp / r.netRev) * 100) : 0}% margin`} icon={Scale} tone="blue" />
        <Stat label="Expenses" value={money(r.exp)} icon={ReceiptText} tone="red" />
        <Stat label="Net profit" value={money(r.net)} icon={PiggyBank} tone="navy" />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-4">
        <Card className="col-span-2" title="Revenue trend"><Bars data={r.daily} h={200} fmt={money} /><div className="mt-2 flex justify-between text-[11px] text-muted"><span>{r.daily[0]?.label}</span><span>Today</span></div></Card>
        <Card title="Profit & loss">
          <div className="tnum space-y-2 text-[13px]">
            {[['Gross sales', r.gross], ['− VAT collected', -r.tax], ['− Refunds', -r.refunds], ['Net revenue', r.netRev, true], ['− Cost of goods', -r.cogs], ['Gross profit', r.gp, true], ['− Expenses', -r.exp], ['Net profit', r.net, true]].map(([l, v, b]) => (
              <div key={l as string} className={cx('flex justify-between', b ? 'border-t border-line pt-2 font-bold' : 'text-muted')}><span>{l}</span><span className={cx(b && (v as number) < 0 && 'text-red-600')}>{money(v as number)}</span></div>
            ))}
          </div>
        </Card>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-4">
        <Card title="Sales by category">{r.cat.map(([c, v]) => <div key={c} className="mb-3 last:mb-0"><div className="mb-1 flex justify-between text-[13px]"><span className="font-semibold">{c}</span><span className="tnum text-muted">{money(v)}</span></div><Meter value={v} max={r.cat[0][1]} /></div>)}{!r.cat.length && <Empty title="No sales in range" />}</Card>
        <Card title="Payment methods">{r.pay.map(({ k, v }) => { const I = icons[k]; const tot = r.pay.reduce((a, x) => a + x.v, 0); return <div key={k} className="mb-4 flex items-center gap-3 last:mb-0"><span className="grid size-9 place-items-center rounded-lg bg-canvas text-teal ring-1 ring-line"><I className="size-4" /></span><div className="flex-1"><div className="flex justify-between text-[13px]"><span className="font-semibold capitalize">{k}</span><span className="tnum">{tot ? Math.round((v / tot) * 100) : 0}%</span></div><div className="tnum text-[12px] text-muted">{money(v)}</div></div></div> })}
          <div className="mt-5 border-t border-line pt-4"><div className="mb-2 text-[11px] font-bold tracking-wider text-muted uppercase">Transactions by hour</div><Bars data={r.hours} h={70} /></div></Card>
        <Card title="Branch comparison" pad={false}>
          <Table rows={r.branches} rowKey={(x) => x.b.id} dense cols={[{ key: 'b', label: 'Branch', render: (x) => <b>{x.b.code}</b> }, { key: 'r', label: 'Revenue', align: 'right', render: (x) => money(x.rev) }, { key: 'n', label: 'Inv.', align: 'right', render: (x) => x.n }, { key: 'e', label: 'Expenses', align: 'right', render: (x) => money(x.exp) }]} />
        </Card>
      </div>
      <Card className="mt-4" title="Top products" pad={false} action={<Button size="sm" icon={Download} onClick={() => downloadCSV('top-products.csv', [['Product', 'Units', 'Revenue', 'Margin'], ...r.prod.map((p) => [p.n, p.q, round2(p.v), round2(p.m)])])}>CSV</Button>}>
        <Table rows={r.prod} rowKey={(p) => p.n} dense cols={[
          { key: 'n', label: 'Product', render: (p) => <b>{p.n}</b> },
          { key: 'q', label: 'Units', align: 'right', render: (p) => p.q },
          { key: 'v', label: 'Revenue (ex. VAT)', align: 'right', render: (p) => money(p.v) },
          { key: 'm', label: 'Gross margin', align: 'right', render: (p) => <span className="text-emerald-700">{money(p.m)}</span> },
          { key: 'pc', label: 'Margin %', align: 'right', render: (p) => `${Math.round((p.m / p.v) * 100)}%` },
        ]} />
      </Card>
    </div>
  )
}
