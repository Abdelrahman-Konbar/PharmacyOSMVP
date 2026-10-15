import { useMemo, useState } from 'react'
import { TrendingUp, Receipt, AlertTriangle, CalendarClock, ScanLine, ShoppingCart, ArrowLeftRight, PackageCheck, Bell, Check, Boxes, Truck, Info, Trash2 } from 'lucide-react'
import { useStore, stockOf, stockStatus, daysToExpiry, inScope } from '../store'
import { Card, PageHeader, Stat, Button, Bars, Badge, StatusBadge, go, fAgo, fDate, Empty, Tabs, cx, useLoading, Skeleton, Meter } from '../ui'

export function Dashboard() {
  const { db, scope, money, me, can } = useStore()
  const loading = useLoading()
  const d = useMemo(() => {
    const sales = db.sales.filter((s) => inScope(s.branchId, scope))
    const td = new Date().toISOString().slice(0, 10)
    const todays = sales.filter((s) => s.date.slice(0, 10) === td)
    const refunds = db.returns.filter((r) => inScope(r.branchId, scope) && r.date.slice(0, 10) === td).reduce((a, r) => a + r.refund, 0)
    const days = Array.from({ length: 14 }, (_, i) => { const dt = new Date(Date.now() - (13 - i) * 86400000).toISOString().slice(0, 10); return { label: new Date(dt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }), value: sales.filter((s) => s.date.slice(0, 10) === dt).reduce((a, s) => a + s.total, 0), hi: i === 13 } })
    const low = db.products.filter((p) => p.status === 'active' && stockStatus(db, p, scope) !== 'ok')
    const expiring = db.batches.filter((b) => inScope(b.branchId, scope) && b.qty > 0 && daysToExpiry(b.expiry) <= db.settings.expiryAlertDays).sort((a, b) => a.expiry.localeCompare(b.expiry))
    const top = new Map<string, { name: string; qty: number; rev: number }>()
    sales.filter((s) => Date.now() - new Date(s.date).getTime() < 30 * 86400000).forEach((s) => s.items.forEach((i) => { const t = top.get(i.productId) || { name: i.name, qty: 0, rev: 0 }; t.qty += i.qty; t.rev += i.qty * i.price; top.set(i.productId, t) }))
    const pay = { cash: 0, card: 0, insurance: 0 }
    sales.filter((s) => Date.now() - new Date(s.date).getTime() < 30 * 86400000).forEach((s) => (pay[s.payment] += s.total))
    const branchPerf = db.branches.map((b) => ({ b, v: db.sales.filter((s) => s.branchId === b.id && Date.now() - new Date(s.date).getTime() < 30 * 86400000).reduce((a, s) => a + s.total, 0) }))
    return { todays, revenue: todays.reduce((a, s) => a + s.total, 0) - refunds, days, low, expiring, top: [...top.values()].sort((a, b) => b.rev - a.rev).slice(0, 5), pay, branchPerf }
  }, [db, scope])
  const pendingPO = db.pos.filter((p) => inScope(p.branchId, scope) && ['submitted', 'partially_received'].includes(p.status))
  const incoming = db.transfers.filter((t) => t.status === 'in_transit' && (scope === 'all' || t.to === scope))
  const payTotal = d.pay.cash + d.pay.card + d.pay.insurance
  const hour = new Date().getHours()
  return (
    <div>
      <PageHeader eyebrow={new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} title={`Good ${hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'}, ${me!.name.replace('Dr. ', '').split(' ')[0]}`}
        subtitle={scope === 'all' ? `Consolidated view across ${db.branches.length} branches` : `Showing ${db.branches.find((b) => b.id === scope)?.name}`}
        actions={<>{can('purchasing') && <Button icon={ShoppingCart} onClick={() => go('purchase-orders/new')}>New PO</Button>}{can('pos') && <Button variant="primary" icon={ScanLine} onClick={() => go('pos')}>Open POS</Button>}</>} />
      <div className="grid grid-cols-4 gap-4">
        <Stat label="Net sales today" value={money(d.revenue)} sub={`${d.todays.length} transactions`} icon={TrendingUp} onClick={() => go('sales')} />
        <Stat label="Avg. basket" value={money(d.todays.length ? d.todays.reduce((a, s) => a + s.total, 0) / d.todays.length : 0)} sub="Today" icon={Receipt} tone="blue" />
        <Stat label="Low / out of stock" value={d.low.length} sub="Below reorder point" icon={AlertTriangle} tone="amber" onClick={() => go('inventory')} />
        <Stat label="Expiring ≤ 60 days" value={d.expiring.length} sub={`${d.expiring.reduce((a, b) => a + b.qty, 0)} units at risk`} icon={CalendarClock} tone="red" onClick={() => go('inventory?tab=expiry')} />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-4">
        <Card className="col-span-2" title="Sales — last 14 days" action={<span className="tnum text-[12.5px] text-muted">{money(d.days.reduce((a, x) => a + x.value, 0))} total</span>}>
          {loading ? <div className="skeleton h-[180px]" /> : <Bars data={d.days} h={180} fmt={money} />}
          <div className="mt-2 flex justify-between text-[11px] text-muted"><span>{d.days[0].label}</span><span>Today</span></div>
        </Card>
        <Card title="Payment mix · 30 days">
          {(['cash', 'card', 'insurance'] as const).map((k) => (
            <div key={k} className="mb-4 last:mb-0">
              <div className="mb-1.5 flex justify-between text-[13px]"><span className="font-semibold capitalize">{k}</span><span className="tnum text-muted">{money(d.pay[k])} · {payTotal ? Math.round((d.pay[k] / payTotal) * 100) : 0}%</span></div>
              <Meter value={d.pay[k]} max={payTotal} tone={k === 'cash' ? 'bg-teal' : k === 'card' ? 'bg-navy' : 'bg-mint'} />
            </div>
          ))}
          {scope === 'all' && <div className="mt-5 border-t border-line pt-4"><div className="mb-2 text-[11px] font-bold tracking-wider text-muted uppercase">Branch performance</div>
            {d.branchPerf.map(({ b, v }) => <div key={b.id} className="flex justify-between py-1 text-[13px]"><button className="font-medium hover:text-teal" onClick={() => go(`branches/${b.id}`)}>{b.name}</button><span className="tnum font-semibold">{money(v)}</span></div>)}</div>}
        </Card>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-4">
        <Card title="Needs reorder" pad={false} action={<Button size="sm" variant="ghost" onClick={() => go('inventory')}>View all</Button>}>
          {loading ? <Skeleton rows={4} /> : d.low.length === 0 ? <Empty icon={Boxes} title="Stock levels healthy" /> : d.low.slice(0, 6).map((p) => (
            <button key={p.id} onClick={() => go(`products/${p.id}`)} className="flex w-full items-center justify-between border-b border-line/70 px-5 py-2.5 text-left last:border-0 hover:bg-canvas">
              <div><div className="text-[13px] font-semibold">{p.name}</div><div className="text-[11.5px] text-muted">{p.strength} · reorder at {p.reorder}</div></div>
              <div className="flex items-center gap-2"><span className="tnum text-[13px] font-bold">{stockOf(db, p.id, scope)}</span><StatusBadge s={stockStatus(db, p, scope)} /></div>
            </button>
          ))}
        </Card>
        <Card title="Expiring soon" pad={false} action={<Button size="sm" variant="ghost" onClick={() => go('inventory?tab=expiry')}>View all</Button>}>
          {loading ? <Skeleton rows={4} /> : d.expiring.length === 0 ? <Empty icon={CalendarClock} title="No batches near expiry" /> : d.expiring.slice(0, 6).map((b) => { const p = db.products.find((x) => x.id === b.productId)!; const dd = daysToExpiry(b.expiry); return (
            <button key={b.id} onClick={() => go(`products/${p.id}`)} className="flex w-full items-center justify-between border-b border-line/70 px-5 py-2.5 text-left last:border-0 hover:bg-canvas">
              <div><div className="text-[13px] font-semibold">{p.name}</div><div className="text-[11.5px] text-muted">Lot {b.lot} · {b.qty} units · {db.branches.find((x) => x.id === b.branchId)?.code}</div></div>
              <Badge tone={dd < 0 ? 'red' : dd <= 30 ? 'red' : 'amber'}>{dd < 0 ? 'Expired' : `${dd}d`}</Badge>
            </button>) })}
        </Card>
        <Card title="Inbound & top sellers" pad={false}>
          <div className="space-y-1 p-3">
            {pendingPO.slice(0, 3).map((p) => <button key={p.id} onClick={() => go(`purchase-orders/${p.id}`)} className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-canvas"><span className="grid size-8 place-items-center rounded-lg bg-sky-100 text-sky-700"><PackageCheck className="size-4" /></span><div className="flex-1"><div className="text-[13px] font-semibold">{p.no}</div><div className="text-[11.5px] text-muted">{db.suppliers.find((s) => s.id === p.supplierId)?.name}</div></div><StatusBadge s={p.status} /></button>)}
            {incoming.map((t) => <button key={t.id} onClick={() => go(`transfers/${t.id}`)} className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-canvas"><span className="grid size-8 place-items-center rounded-lg bg-teal/10 text-teal"><ArrowLeftRight className="size-4" /></span><div className="flex-1"><div className="text-[13px] font-semibold">{t.no}</div><div className="text-[11.5px] text-muted">From {db.branches.find((b) => b.id === t.from)?.name}</div></div><StatusBadge s={t.status} /></button>)}
            {!pendingPO.length && !incoming.length && <div className="p-3 text-[12.5px] text-muted">No inbound shipments.</div>}
          </div>
          <div className="border-t border-line px-5 pt-3 pb-4">
            <div className="mb-2 text-[11px] font-bold tracking-wider text-muted uppercase">Top sellers · 30 days</div>
            {d.top.map((t, i) => <div key={t.name} className="flex items-center gap-2 py-1 text-[13px]"><span className="tnum w-4 text-muted">{i + 1}</span><span className="flex-1 font-medium">{t.name}</span><span className="tnum text-muted">{t.qty} u</span></div>)}
          </div>
        </Card>
      </div>
    </div>
  )
}

const NI = { stock: Boxes, expiry: AlertTriangle, purchase: Truck, transfer: ArrowLeftRight, system: Info, sales: Receipt }
export function Notifications() {
  const { db, act, scope } = useStore()
  const [tab, setTab] = useState<'all' | 'unread'>('all')
  const [type, setType] = useState('all')
  const list = db.notifications.filter((n) => (!n.branchId || scope === 'all' || n.branchId === scope) && (tab === 'all' || !n.read) && (type === 'all' || n.type === type))
  const unread = db.notifications.filter((n) => !n.read && (!n.branchId || scope === 'all' || n.branchId === scope)).length
  return (
    <div className="max-w-[860px]">
      <PageHeader title="Notifications" subtitle="Operational alerts generated by stock, purchasing, transfers and shifts."
        actions={<><Button icon={Check} disabled={!unread} onClick={() => act((d) => d.notifications.forEach((n) => (n.read = true)))}>Mark all read</Button><Button icon={Trash2} variant="ghost" disabled={!db.notifications.some((n) => n.read)} onClick={() => act((d) => { d.notifications = d.notifications.filter((n) => !n.read) })}>Clear read</Button></>} />
      <div className="mb-4 flex items-center justify-between">
        <Tabs value={tab} onChange={setTab} tabs={[{ value: 'all', label: 'All' }, { value: 'unread', label: 'Unread', count: unread }]} />
        <div className="flex gap-1">{['all', 'stock', 'expiry', 'purchase', 'transfer', 'sales', 'system'].map((t) => <button key={t} onClick={() => setType(t)} className={cx('rounded-md px-2.5 py-1 text-[12px] font-semibold capitalize', type === t ? 'bg-navy text-white' : 'text-muted hover:bg-white')}>{t}</button>)}</div>
      </div>
      <Card pad={false}>
        {list.length === 0 ? <Empty icon={Bell} title="You're all caught up" body="New alerts will appear here." /> : list.map((n) => { const I = NI[n.type]; return (
          <div key={n.id} className={cx('group flex items-start gap-3.5 border-b border-line/70 px-5 py-4 last:border-0', !n.read && 'bg-teal/[0.03]')}>
            <span className={cx('grid size-9 shrink-0 place-items-center rounded-lg', n.type === 'expiry' ? 'bg-red-100 text-red-600' : n.type === 'stock' ? 'bg-amber-100 text-amber-700' : 'bg-teal/10 text-teal')}><I className="size-4" /></span>
            <button className="min-w-0 flex-1 text-left" onClick={() => { act((d) => { d.notifications.find((x) => x.id === n.id)!.read = true }); if (n.link) go(n.link) }}>
              <div className="flex items-center gap-2"><span className="text-[13.5px] font-bold">{n.title}</span>{!n.read && <span className="size-2 rounded-full bg-teal" />}</div>
              <div className="mt-0.5 text-[13px] text-muted">{n.body}</div>
              <div className="mt-1 text-[11.5px] text-muted">{fAgo(n.date)} · {fDate(n.date)}{n.branchId && ` · ${db.branches.find((b) => b.id === n.branchId)?.name}`}</div>
            </button>
            <Button size="sm" variant="ghost" onClick={() => act((d) => { const x = d.notifications.find((x) => x.id === n.id)!; x.read = !x.read })}>{n.read ? 'Mark unread' : 'Mark read'}</Button>
          </div>) })}
      </Card>
    </div>
  )
}
