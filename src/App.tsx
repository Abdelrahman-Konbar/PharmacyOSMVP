import { useEffect, useMemo, useRef, useState } from 'react'
import {
  LayoutDashboard, Bell, ScanLine, Receipt, Undo2, Pill, Boxes, ArrowLeftRight, ClipboardCheck, ShoppingCart, PackageCheck, Truck,
  Building2, Users, ShieldCheck, Wallet, ReceiptText, BarChart3, ScrollText, Settings as SettingsIcon, LogOut, ChevronDown, Search, Repeat, Activity, Languages,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { StoreProvider, useStore, type Perm } from './store'
import { ToastProvider, useRoute, go, cx, Avatar, Empty, Button } from './ui'
import { Login, Forgot, OrgSetup, BranchSetup } from './screens/auth'
import { Dashboard, Notifications } from './screens/overview'
import { POS, SalesHistory, SaleDetails, Returns, ReturnDetails } from './screens/sales'
import { Products, ProductForm, ProductDetails, InventoryOverview, Movements, Counts, CountWorkspace } from './screens/inventory'
import { PurchaseOrders, POForm, PODetails, Receipts, Receiving, Suppliers, SupplierDetails } from './screens/purchasing'
import { Transfers, TransferForm, TransferDetails } from './screens/transfers'
import { Branches, BranchDetails, UsersScreen, Roles } from './screens/org'
import { Shifts, Expenses, Reports } from './screens/finance'
import { AuditLogs, SettingsScreen } from './screens/admin'

type NavItem = { path: string; label: string; icon: LucideIcon; perm: Perm; match?: string[] }
const NAV: { group: string; items: NavItem[] }[] = [
  { group: 'Overview', items: [{ path: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, perm: 'dashboard' }, { path: 'notifications', label: 'Notifications', icon: Bell, perm: 'pos' }] },
  { group: 'Sales', items: [{ path: 'pos', label: 'Point of Sale', icon: ScanLine, perm: 'pos' }, { path: 'sales', label: 'Sales History', icon: Receipt, perm: 'sales' }, { path: 'returns', label: 'Sales Returns', icon: Undo2, perm: 'returns' }] },
  { group: 'Inventory', items: [{ path: 'products', label: 'Products', icon: Pill, perm: 'products' }, { path: 'inventory', label: 'Inventory Overview', icon: Boxes, perm: 'inventory' }, { path: 'movements', label: 'Stock Movements', icon: Activity, perm: 'inventory' }, { path: 'counts', label: 'Stock Counts', icon: ClipboardCheck, perm: 'counts' }] },
  { group: 'Purchasing', items: [{ path: 'purchase-orders', label: 'Purchase Orders', icon: ShoppingCart, perm: 'purchasing' }, { path: 'receipts', label: 'Goods Receipts', icon: PackageCheck, perm: 'purchasing', match: ['receive'] }, { path: 'suppliers', label: 'Suppliers', icon: Truck, perm: 'suppliers' }] },
  { group: 'Transfers', items: [{ path: 'transfers', label: 'Transfers', icon: ArrowLeftRight, perm: 'transfers' }] },
  { group: 'Organization', items: [{ path: 'branches', label: 'Branches', icon: Building2, perm: 'branches' }, { path: 'users', label: 'Users & Access', icon: Users, perm: 'users' }, { path: 'roles', label: 'Roles & Permissions', icon: ShieldCheck, perm: 'roles' }] },
  { group: 'Finance', items: [{ path: 'shifts', label: 'Cash Shifts', icon: Wallet, perm: 'shifts' }, { path: 'expenses', label: 'Expenses', icon: ReceiptText, perm: 'expenses' }, { path: 'reports', label: 'Reports & Analytics', icon: BarChart3, perm: 'reports' }] },
  { group: 'Administration', items: [{ path: 'audit', label: 'Audit Logs', icon: ScrollText, perm: 'audit' }, { path: 'settings', label: 'Settings', icon: SettingsIcon, perm: 'settings' }] },
]

export function Logo({ light = true }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative grid size-8 place-items-center rounded-[9px] bg-gradient-to-br from-mint to-teal">
        <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="#142B3B" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /><circle cx="12" cy="12" r="2.2" fill="#142B3B" stroke="none" /></svg>
      </div>
      <div className={cx('text-[16px] font-extrabold tracking-[-0.02em]', light ? 'text-white' : 'text-navy')}>Pharmacy<span className="text-mint">OS</span></div>
    </div>
  )
}

function Shell() {
  const { db, act, me, role, can, scope, myBranches, t } = useStore()
  const route = useRoute()
  const [menu, setMenu] = useState<'branch' | 'user' | null>(null)
  const [cmd, setCmd] = useState(false)
  const seg = route.split('?')[0].split('/')
  const unread = db.notifications.filter((n) => !n.read && (!n.branchId || scope === 'all' || n.branchId === scope)).length
  const multi = role?.name === 'Owner' || myBranches.length > 1

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setCmd((v) => !v) }
      if (e.altKey && e.key.toLowerCase() === 'p' && can('pos')) { e.preventDefault(); go('pos') }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [can])

  const allowed = NAV.flatMap((g) => g.items).find((i) => i.path === seg[0] || i.match?.includes(seg[0]) || (seg[0] === 'receive' && i.path === 'receipts'))
  const page = (() => {
    if (allowed && !can(allowed.perm)) return <Empty icon={ShieldCheck} title="You don't have access to this area" body={`Your role (${role?.name}) doesn't include this permission. Ask an owner to update Roles & Permissions.`} action={<Button onClick={() => go(can('dashboard') ? 'dashboard' : 'pos')}>Go to home</Button>} />
    const [a, b, c] = seg
    switch (a) {
      case 'dashboard': return <Dashboard />
      case 'notifications': return <Notifications />
      case 'pos': return <POS />
      case 'sales': return b ? <SaleDetails id={b} /> : <SalesHistory />
      case 'returns': return b ? <ReturnDetails id={b} /> : <Returns />
      case 'products': return b === 'new' ? <ProductForm /> : c === 'edit' ? <ProductForm id={b} /> : b ? <ProductDetails id={b} /> : <Products />
      case 'inventory': return <InventoryOverview />
      case 'movements': return <Movements />
      case 'counts': return b ? <CountWorkspace id={b} /> : <Counts />
      case 'purchase-orders': return b === 'new' ? <POForm /> : c === 'edit' ? <POForm id={b} /> : b ? <PODetails id={b} /> : <PurchaseOrders />
      case 'receipts': return <Receipts />
      case 'receive': return <Receiving poId={b} />
      case 'suppliers': return b ? <SupplierDetails id={b} /> : <Suppliers />
      case 'transfers': return b === 'new' ? <TransferForm /> : b ? <TransferDetails id={b} /> : <Transfers />
      case 'branches': return b ? <BranchDetails id={b} /> : <Branches />
      case 'users': return <UsersScreen />
      case 'roles': return <Roles />
      case 'shifts': return <Shifts />
      case 'expenses': return <Expenses />
      case 'reports': return <Reports />
      case 'audit': return <AuditLogs />
      case 'settings': return <SettingsScreen />
      default: return <Empty title="Page not found" body="This screen doesn't exist." action={<Button onClick={() => go('dashboard')}>Go to dashboard</Button>} />
    }
  })()
  const isPOS = seg[0] === 'pos'
  const scopeName = scope === 'all' ? t('All branches') : db.branches.find((b) => b.id === scope)?.name

  return (
    <div className="flex h-full">
      <aside className="flex w-[244px] shrink-0 flex-col bg-navy text-[#b7c6d2]">
        <div className="px-5 pt-5 pb-4"><Logo /></div>
        <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Main">
          {NAV.map((g) => { const items = g.items.filter((i) => can(i.perm)); if (!items.length) return null; return (
            <div key={g.group} className="mt-3">
              <div className="px-3 pb-1.5 text-[10.5px] font-bold tracking-[0.14em] text-[#6f8799] uppercase">{t(g.group)}</div>
              {items.map((i) => { const active = seg[0] === i.path || i.match?.includes(seg[0]); return (
                <button key={i.path} onClick={() => go(i.path)} aria-current={active ? 'page' : undefined} className={cx('group relative mb-px flex w-full items-center gap-2.5 rounded-lg px-3 py-[7px] text-[13px] font-medium transition', active ? 'bg-white/[0.08] text-white' : 'hover:bg-white/[0.04] hover:text-white')}>
                  {active && <span className="absolute top-1.5 bottom-1.5 left-0 w-[3px] rounded-full bg-mint" />}
                  <i.icon className={cx('size-[17px]', active ? 'text-mint' : 'text-[#7d95a7] group-hover:text-[#b7c6d2]')} />
                  <span className="flex-1 text-left">{t(i.label)}</span>
                  {i.path === 'notifications' && unread > 0 && <span className="tnum rounded-full bg-mint px-1.5 text-[10.5px] font-bold text-navy">{unread}</span>}
                </button>) })}
            </div>) })}
        </nav>
        <div className="m-3 rounded-xl bg-white/[0.05] p-3 text-[11.5px] leading-relaxed text-[#8ea4b5]">
          <div className="mb-1 font-semibold text-white">Demo workspace</div>
          Data is stored locally in your browser. Payments and integrations are simulated.
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[60px] shrink-0 items-center gap-3 border-b border-line bg-white px-6">
          <button onClick={() => setCmd(true)} className="flex h-9 w-[340px] items-center gap-2 rounded-lg border border-line bg-canvas px-3 text-[13px] text-muted hover:border-[#c9d5de]">
            <Search className="size-4" /><span className="flex-1 text-left">Search products, invoices, POs…</span><kbd className="rounded border border-line bg-white px-1.5 text-[11px] font-semibold">Ctrl K</kbd>
          </button>
          <div className="flex-1" />
          <div className="relative">
            <button disabled={!multi} onClick={() => setMenu(menu === 'branch' ? null : 'branch')} className="flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-[13px] font-semibold hover:bg-canvas disabled:hover:bg-transparent">
              <Building2 className="size-4 text-teal" />{scopeName}{multi && <ChevronDown className="size-3.5 text-muted" />}
            </button>
            {menu === 'branch' && (
              <Dropdown onClose={() => setMenu(null)}>
                {role?.name === 'Owner' && <DItem active={scope === 'all'} onClick={() => { act((d) => { d.session!.branchId = 'all' }); setMenu(null) }}>{t('All branches')}</DItem>}
                {myBranches.filter((b) => b.status === 'active').map((b) => <DItem key={b.id} active={scope === b.id} onClick={() => { act((d) => { d.session!.branchId = b.id }); setMenu(null) }}>{b.name}<span className="ml-auto text-[11px] text-muted">{b.code}</span></DItem>)}
              </Dropdown>
            )}
          </div>
          <button aria-label="Toggle language" title="Toggle English / العربية" onClick={() => act((d) => { d.settings.language = d.settings.language === 'en' ? 'ar' : 'en' })} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-canvas hover:text-ink"><Languages className="size-[18px]" /></button>
          <button aria-label="Notifications" onClick={() => go('notifications')} className="relative grid size-9 place-items-center rounded-lg text-muted hover:bg-canvas hover:text-ink">
            <Bell className="size-[18px]" />{unread > 0 && <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-red-500 ring-2 ring-white" />}
          </button>
          <div className="relative">
            <button onClick={() => setMenu(menu === 'user' ? null : 'user')} className="flex items-center gap-2.5 rounded-lg py-1 pr-2 pl-1 hover:bg-canvas">
              <Avatar name={me!.name} size={30} />
              <div className="text-left leading-tight"><div className="text-[12.5px] font-bold">{me!.name}</div><div className="text-[11px] text-muted">{role?.name}</div></div>
              <ChevronDown className="size-3.5 text-muted" />
            </button>
            {menu === 'user' && (
              <Dropdown onClose={() => setMenu(null)} wide>
                <div className="px-3 pt-1 pb-2 text-[11px] font-bold tracking-wider text-muted uppercase">Switch demo user</div>
                {db.users.filter((u) => u.status === 'active').map((u) => (
                  <DItem key={u.id} active={u.id === me!.id} onClick={() => { act((d) => { d.session = { userId: u.id, branchId: db.roles.find((r) => r.id === u.roleId)?.name === 'Owner' ? 'all' : u.branchIds[0] } }); setMenu(null); go(db.roles.find((r) => r.id === u.roleId)?.permissions.includes('dashboard') ? 'dashboard' : 'pos') }}>
                    <Repeat className="size-3.5 text-muted" />{u.name}<span className="ml-auto text-[11px] text-muted">{db.roles.find((r) => r.id === u.roleId)?.name}</span>
                  </DItem>
                ))}
                <div className="my-1 border-t border-line" />
                <DItem onClick={() => { act((d) => { d.session = null }); go('login') }}><LogOut className="size-3.5" />{t('Sign out')}</DItem>
              </Dropdown>
            )}
          </div>
        </header>
        <main className={cx('flex-1 overflow-y-auto', !isPOS && 'px-8 py-7')}>
          <div key={route} className={cx('anim-in', !isPOS && 'mx-auto max-w-[1360px]', isPOS && 'h-full')}>{page}</div>
        </main>
      </div>
      {cmd && <CommandPalette onClose={() => setCmd(false)} />}
    </div>
  )
}

function Dropdown({ children, onClose, wide }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    setTimeout(() => document.addEventListener('mousedown', h))
    document.addEventListener('keydown', k)
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k) }
  }, [onClose])
  return <div ref={ref} className={cx('anim-in absolute top-full right-0 z-40 mt-1.5 rounded-xl border border-line bg-white p-1.5 shadow-[0_12px_40px_rgba(20,43,59,0.16)]', wide ? 'w-[300px]' : 'w-[240px]')}>{children}</div>
}
const DItem = ({ children, onClick, active }: { children: React.ReactNode; onClick: () => void; active?: boolean }) => (
  <button onClick={onClick} className={cx('flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[13px] font-medium hover:bg-canvas', active && 'bg-teal/8 text-teal')}>{children}</button>
)

function CommandPalette({ onClose }: { onClose: () => void }) {
  const { db, can } = useStore()
  const [q, setQ] = useState('')
  const [i, setI] = useState(0)
  const results = useMemo(() => {
    const s = q.toLowerCase().trim()
    const r: { label: string; sub: string; path: string; kind: string }[] = []
    NAV.flatMap((g) => g.items).filter((n) => can(n.perm) && n.label.toLowerCase().includes(s)).forEach((n) => r.push({ label: n.label, sub: 'Go to screen', path: n.path, kind: 'Page' }))
    if (s) {
      if (can('products')) db.products.filter((p) => `${p.name} ${p.generic} ${p.sku} ${p.barcode}`.toLowerCase().includes(s)).slice(0, 6).forEach((p) => r.push({ label: p.name, sub: `${p.generic} · ${p.sku}`, path: `products/${p.id}`, kind: 'Product' }))
      if (can('sales')) db.sales.filter((x) => x.no.toLowerCase().includes(s)).slice(0, 4).forEach((x) => r.push({ label: x.no, sub: 'Invoice', path: `sales/${x.id}`, kind: 'Sale' }))
      if (can('purchasing')) db.pos.filter((x) => x.no.toLowerCase().includes(s)).slice(0, 4).forEach((x) => r.push({ label: x.no, sub: 'Purchase order', path: `purchase-orders/${x.id}`, kind: 'PO' }))
      if (can('transfers')) db.transfers.filter((x) => x.no.toLowerCase().includes(s)).slice(0, 4).forEach((x) => r.push({ label: x.no, sub: 'Transfer', path: `transfers/${x.id}`, kind: 'Transfer' }))
    }
    return r.slice(0, 12)
  }, [q, db, can])
  const open = (p: string) => { go(p); onClose() }
  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-navy/40 pt-[12vh] backdrop-blur-[2px]" onMouseDown={onClose}>
      <div className="anim-in h-fit w-[600px] overflow-hidden rounded-[14px] bg-white shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="size-[18px] text-muted" />
          <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setI(0) }} placeholder="Search screens, products, invoices, POs, transfers…" aria-label="Command search"
            onKeyDown={(e) => { if (e.key === 'Escape') onClose(); if (e.key === 'ArrowDown') { e.preventDefault(); setI((x) => Math.min(results.length - 1, x + 1)) } if (e.key === 'ArrowUp') { e.preventDefault(); setI((x) => Math.max(0, x - 1)) } if (e.key === 'Enter' && results[i]) open(results[i].path) }}
            className="h-14 flex-1 bg-transparent text-[15px] outline-none" />
        </div>
        <div className="max-h-[400px] overflow-y-auto p-2">
          {results.length === 0 && <div className="p-8 text-center text-[13px] text-muted">No matches for "{q}"</div>}
          {results.map((r, k) => (
            <button key={r.kind + r.path} onMouseEnter={() => setI(k)} onClick={() => open(r.path)} className={cx('flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left', k === i && 'bg-teal/8')}>
              <span className="w-16 text-[10.5px] font-bold tracking-wider text-muted uppercase">{r.kind}</span>
              <span className="text-[13.5px] font-semibold">{r.label}</span><span className="truncate text-[12.5px] text-muted">{r.sub}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-4 border-t border-line bg-canvas px-4 py-2 text-[11.5px] text-muted"><span>↑↓ navigate</span><span>↵ open</span><span>Esc close</span><span className="ml-auto">Alt+P opens POS</span></div>
      </div>
    </div>
  )
}

function Root() {
  const { db } = useStore()
  const route = useRoute()
  const seg = route.split('/')[0]
  if (!db.session) {
    if (seg === 'forgot') return <Forgot />
    if (seg === 'setup-org') return <OrgSetup />
    if (seg === 'setup-branch') return <BranchSetup />
    return <Login />
  }
  if (['login', 'forgot', 'setup-org', 'setup-branch'].includes(seg)) { go('dashboard'); return null }
  return <Shell />
}

export default function App() {
  return <StoreProvider><ToastProvider><Root /></ToastProvider></StoreProvider>
}
