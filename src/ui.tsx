import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes } from 'react'
import { X, CheckCircle2, AlertTriangle, Info, XCircle, Search, Inbox, ChevronLeft, ArrowUpDown } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// ---------- Router ----------
const sub = (cb: () => void) => { window.addEventListener('hashchange', cb); return () => window.removeEventListener('hashchange', cb) }
export const useRoute = () => useSyncExternalStore(sub, () => window.location.hash.replace(/^#\/?/, '') || 'dashboard')
export const go = (p: string) => { window.location.hash = '/' + p }
export const cx = (...a: (string | number | false | null | undefined)[]) => a.filter(Boolean).join(' ')

// ---------- Dates ----------
export const fDate = (s?: string) => (s ? new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')
export const fDateTime = (s?: string) => (s ? new Date(s).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—')
export const fAgo = (s: string) => {
  const m = Math.round((Date.now() - new Date(s).getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (m < 1440) return `${Math.round(m / 60)}h ago`
  return `${Math.round(m / 1440)}d ago`
}

// ---------- Toasts ----------
type Toast = { id: number; kind: 'success' | 'error' | 'info' | 'warning'; title: string; body?: string }
const ToastC = createContext<(t: Omit<Toast, 'id'>) => void>(() => {})
export const useToast = () => useContext(ToastC)
export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Toast[]>([])
  const push = (t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random()
    setList((l) => [...l, { ...t, id }])
    setTimeout(() => setList((l) => l.filter((x) => x.id !== id)), 4200)
  }
  const icon = { success: CheckCircle2, error: XCircle, info: Info, warning: AlertTriangle }
  const col = { success: 'text-emerald-600', error: 'text-red-600', info: 'text-sky-600', warning: 'text-amber-600' }
  return (
    <ToastC.Provider value={push}>
      {children}
      <div className="fixed bottom-5 right-5 z-[100] flex w-[360px] flex-col gap-2" role="status" aria-live="polite">
        {list.map((t) => { const I = icon[t.kind]; return (
          <div key={t.id} className="anim-in flex gap-3 rounded-xl border border-line bg-white p-3.5 shadow-[0_8px_30px_rgba(20,43,59,0.14)]">
            <I className={cx('mt-0.5 size-[18px] shrink-0', col[t.kind])} />
            <div className="min-w-0 flex-1"><div className="text-[13px] font-semibold">{t.title}</div>{t.body && <div className="mt-0.5 text-[12.5px] text-muted">{t.body}</div>}</div>
            <button aria-label="Dismiss" onClick={() => setList((l) => l.filter((x) => x.id !== t.id))} className="text-muted hover:text-ink"><X className="size-4" /></button>
          </div>) })}
      </div>
    </ToastC.Provider>
  )
}

// ---------- Primitives ----------
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'dark'; size?: 'sm' | 'md' | 'lg'; icon?: LucideIcon; loading?: boolean }
export function Button({ variant = 'secondary', size = 'md', icon: I, loading, className, children, disabled, ...r }: BtnProps) {
  const v = {
    primary: 'bg-teal text-white hover:bg-teal-d shadow-[0_1px_2px_rgba(8,127,119,0.3)]',
    secondary: 'bg-white text-ink border border-line hover:border-[#c9d5de] hover:bg-[#fafcfd]',
    ghost: 'text-ink hover:bg-[#eef3f6]',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    dark: 'bg-navy text-white hover:bg-navy-2',
  }[variant]
  const s = { sm: 'h-8 px-2.5 text-[12.5px] gap-1.5 rounded-md', md: 'h-9 px-3.5 text-[13px] gap-2 rounded-lg', lg: 'h-11 px-5 text-[14px] gap-2 rounded-[10px]' }[size]
  return (
    <button {...r} disabled={disabled || loading} className={cx('inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap transition-all duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45', v, s, className)}>
      {loading ? <span className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" /> : I && <I className={size === 'sm' ? 'size-3.5' : 'size-4'} />}
      {children}
    </button>
  )
}
export function Card({ children, className, title, action, pad = true }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode; pad?: boolean }) {
  return (
    <section className={cx('rounded-xl border border-line bg-white shadow-[0_1px_2px_rgba(20,43,59,0.04)]', className)}>
      {title && <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5"><h3 className="text-[14px] font-bold tracking-[-0.01em]">{title}</h3>{action}</header>}
      <div className={pad ? 'p-5' : ''}>{children}</div>
    </section>
  )
}
const TONES = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15', amber: 'bg-amber-50 text-amber-700 ring-amber-600/20', red: 'bg-red-50 text-red-700 ring-red-600/15',
  blue: 'bg-sky-50 text-sky-700 ring-sky-600/15', gray: 'bg-slate-100 text-slate-600 ring-slate-500/15', teal: 'bg-teal/8 text-teal ring-teal/20', navy: 'bg-navy text-white ring-navy',
}
export type Tone = keyof typeof TONES
export function Badge({ tone = 'gray', children, dot }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  return <span className={cx('inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11.5px] font-semibold whitespace-nowrap ring-1 ring-inset', TONES[tone])}>{dot && <span className="size-1.5 rounded-full bg-current" />}{children}</span>
}
const STATUS: Record<string, [Tone, string]> = {
  completed: ['green', 'Completed'], partially_returned: ['amber', 'Partially returned'], returned: ['gray', 'Returned'], refunded: ['blue', 'Refunded'],
  draft: ['gray', 'Draft'], submitted: ['blue', 'Submitted'], partially_received: ['amber', 'Partially received'], received: ['green', 'Received'], cancelled: ['red', 'Cancelled'],
  in_transit: ['blue', 'In transit'], in_progress: ['amber', 'In progress'], open: ['green', 'Open'], closed: ['gray', 'Closed'], active: ['green', 'Active'], inactive: ['gray', 'Inactive'],
  invited: ['blue', 'Invited'], suspended: ['red', 'Suspended'], archived: ['gray', 'Archived'], ok: ['green', 'In stock'], low: ['amber', 'Low stock'], out: ['red', 'Out of stock'],
}
export const StatusBadge = ({ s }: { s: string }) => { const [t, l] = STATUS[s] || ['gray', s]; return <Badge tone={t} dot>{l}</Badge> }

export function Field({ label, error, hint, children, className }: { label: string; error?: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1.5 block text-[12.5px] font-semibold text-ink">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-[12px] font-medium text-red-600">{error}</span> : hint && <span className="mt-1 block text-[12px] text-muted">{hint}</span>}
    </label>
  )
}
const inputCls = 'h-9 w-full rounded-lg border border-line bg-white px-3 text-[13px] text-ink placeholder:text-[#9aabb8] transition focus:border-teal focus:ring-3 focus:ring-teal/12 focus:outline-none disabled:bg-canvas'
export const Input = ({ className, invalid, ...r }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; ref?: React.Ref<HTMLInputElement> }) => <input {...r} className={cx(inputCls, invalid && 'border-red-400', className)} />
export function Select({ value, onChange, options, className, ...r }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; className?: string; 'aria-label'?: string; disabled?: boolean }) {
  return <select {...r} value={value} onChange={(e) => onChange(e.target.value)} className={cx(inputCls, 'cursor-pointer pr-8', className)}>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
}
export const Textarea = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={cx(inputCls, 'h-auto min-h-[80px] py-2', p.className)} />
export function SearchInput({ value, onChange, placeholder = 'Search…', className, autoFocus }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string; autoFocus?: boolean }) {
  return (
    <div className={cx('relative', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
      <Input autoFocus={autoFocus} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pl-9" aria-label={placeholder} />
    </div>
  )
}
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={cx('relative h-5 w-9 shrink-0 rounded-full transition', checked ? 'bg-teal' : 'bg-[#cfd9e1]')}>
      <span className={cx('absolute top-0.5 size-4 rounded-full bg-white shadow transition-all', checked ? 'left-[18px]' : 'left-0.5')} />
    </button>
  )
}

export function Modal({ open, onClose, title, children, footer, width = 520, desc }: { open: boolean; onClose: () => void; title: string; desc?: string; children: ReactNode; footer?: ReactNode; width?: number }) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy/40 p-6 pt-[8vh] backdrop-blur-[2px]" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className="anim-in w-full rounded-[14px] bg-white shadow-[0_24px_60px_rgba(20,43,59,0.25)]" style={{ maxWidth: width }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-3">
          <div><h2 className="text-[16px] font-bold tracking-[-0.01em]">{title}</h2>{desc && <p className="mt-1 text-[13px] text-muted">{desc}</p>}</div>
          <button aria-label="Close" onClick={onClose} className="rounded-md p-1 text-muted hover:bg-canvas hover:text-ink"><X className="size-4" /></button>
        </div>
        <div className="px-6 pb-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 rounded-b-[14px] border-t border-line bg-[#fafcfd] px-6 py-3.5">{footer}</div>}
      </div>
    </div>
  )
}
export function Confirm({ open, onClose, onConfirm, title, body, confirmLabel = 'Confirm', danger }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; body: ReactNode; confirmLabel?: string; danger?: boolean }) {
  return (
    <Modal open={open} onClose={onClose} title={title} width={440} footer={<><Button onClick={onClose}>Cancel</Button><Button variant={danger ? 'danger' : 'primary'} autoFocus onClick={() => { onConfirm(); onClose() }}>{confirmLabel}</Button></>}>
      <div className="text-[13.5px] leading-relaxed text-muted">{body}</div>
    </Modal>
  )
}

export function PageHeader({ title, subtitle, actions, back, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: string; eyebrow?: string }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-6">
      <div className="min-w-0">
        {back && <button onClick={() => go(back)} className="mb-2 inline-flex items-center gap-1 text-[12.5px] font-semibold text-muted hover:text-teal"><ChevronLeft className="size-3.5" />Back</button>}
        {eyebrow && <div className="mb-1 text-[11px] font-bold tracking-[0.12em] text-teal uppercase">{eyebrow}</div>}
        <h1 className="text-[24px] font-extrabold tracking-[-0.025em] text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-[13.5px] text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
export function Stat({ label, value, sub, icon: I, tone = 'teal', onClick }: { label: string; value: ReactNode; sub?: ReactNode; icon: LucideIcon; tone?: 'teal' | 'amber' | 'red' | 'blue' | 'navy'; onClick?: () => void }) {
  const t = { teal: 'bg-teal/10 text-teal', amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-600', blue: 'bg-sky-100 text-sky-700', navy: 'bg-navy text-mint' }[tone]
  const El = onClick ? 'button' : 'div'
  return (
    <El onClick={onClick} className={cx('group rounded-xl border border-line bg-white p-4 text-left shadow-[0_1px_2px_rgba(20,43,59,0.04)] transition', onClick && 'hover:-translate-y-px hover:border-teal/40 hover:shadow-md')}>
      <div className="flex items-center justify-between"><span className="text-[12px] font-semibold text-muted">{label}</span><span className={cx('grid size-8 place-items-center rounded-lg', t)}><I className="size-4" /></span></div>
      <div className="tnum mt-2 text-[22px] font-extrabold tracking-[-0.02em]">{value}</div>
      {sub && <div className="mt-0.5 text-[12px] text-muted">{sub}</div>}
    </El>
  )
}
export function Empty({ icon: I = Inbox, title, body, action }: { icon?: LucideIcon; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="grid size-12 place-items-center rounded-xl bg-canvas text-muted ring-1 ring-line"><I className="size-5" /></div>
      <div className="mt-3 text-[14px] font-bold">{title}</div>
      {body && <div className="mt-1 max-w-sm text-[13px] text-muted">{body}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: string; count?: number }[] }) {
  return (
    <div className="flex gap-1 rounded-[10px] bg-[#e9eff3] p-1" role="tablist">
      {tabs.map((t) => (
        <button key={t.value} role="tab" aria-selected={value === t.value} onClick={() => onChange(t.value)} className={cx('flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition', value === t.value ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink')}>
          {t.label}{t.count !== undefined && <span className={cx('tnum rounded px-1.5 text-[11px]', value === t.value ? 'bg-teal/10 text-teal' : 'bg-white/60')}>{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

// ---------- Table ----------
export type Col<T> = { key: string; label: string; render: (r: T) => ReactNode; align?: 'right' | 'center'; sort?: (r: T) => string | number; width?: string }
export function Table<T>({ rows, cols, onRow, empty, rowKey, pageSize = 12, dense }: { rows: T[]; cols: Col<T>[]; onRow?: (r: T) => void; empty?: ReactNode; rowKey: (r: T) => string; pageSize?: number; dense?: boolean }) {
  const [sort, setSort] = useState<{ k: string; d: 1 | -1 } | null>(null)
  const [page, setPage] = useState(0)
  useEffect(() => setPage(0), [rows.length])
  let data = rows
  if (sort) { const c = cols.find((c) => c.key === sort.k); if (c?.sort) data = [...rows].sort((a, b) => { const x = c.sort!(a), y = c.sort!(b); return (x > y ? 1 : x < y ? -1 : 0) * sort.d }) }
  const pages = Math.max(1, Math.ceil(data.length / pageSize))
  const view = data.slice(page * pageSize, page * pageSize + pageSize)
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-line bg-[#fafcfd]">
              {cols.map((c) => (
                <th key={c.key} style={{ width: c.width }} className={cx('px-4 py-2.5 text-[11px] font-bold tracking-[0.06em] whitespace-nowrap text-muted uppercase', c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left')}>
                  {c.sort ? <button className="inline-flex items-center gap-1 uppercase hover:text-ink" onClick={() => setSort((s) => ({ k: c.key, d: s?.k === c.key && s.d === 1 ? -1 : 1 }))}>{c.label}<ArrowUpDown className={cx('size-3', sort?.k === c.key ? 'text-teal' : 'opacity-40')} /></button> : c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.map((r) => (
              <tr key={rowKey(r)} onClick={onRow ? () => onRow(r) : undefined} tabIndex={onRow ? 0 : undefined} onKeyDown={onRow ? (e) => e.key === 'Enter' && onRow(r) : undefined} className={cx('border-b border-line/70 last:border-0 transition-colors', onRow && 'cursor-pointer hover:bg-[#f4f9f9] focus:bg-[#f4f9f9] focus:outline-none')}>
                {cols.map((c) => <td key={c.key} className={cx('px-4 align-middle', dense ? 'py-2' : 'py-3', c.align === 'right' ? 'tnum text-right' : c.align === 'center' ? 'text-center' : '')}>{c.render(r)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && (empty || <Empty title="No results" body="Try adjusting your filters or search." />)}
      {rows.length > pageSize && (
        <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-[12.5px] text-muted">
          <span className="tnum">{page * pageSize + 1}–{Math.min(data.length, (page + 1) * pageSize)} of {data.length}</span>
          <div className="flex gap-1.5"><Button size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button><Button size="sm" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</Button></div>
        </div>
      )}
    </div>
  )
}
export function Toolbar({ children }: { children: ReactNode }) { return <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">{children}</div> }
export function KV({ items }: { items: [string, ReactNode][] }) {
  return <dl className="grid grid-cols-2 gap-x-6 gap-y-3.5">{items.map(([k, v]) => <div key={k}><dt className="text-[11.5px] font-semibold text-muted">{k}</dt><dd className="mt-0.5 text-[13.5px] font-medium">{v}</dd></div>)}</dl>
}
export function Skeleton({ rows = 5 }: { rows?: number }) { return <div className="space-y-3 p-5">{Array.from({ length: rows }).map((_, i) => <div key={i} className="skeleton h-9" />)}</div> }
/** Brief simulated loading state when entering data-heavy screens. */
export function useLoading(ms = 350) { const [l, s] = useState(true); useEffect(() => { const t = setTimeout(() => s(false), ms); return () => clearTimeout(t) }, [ms]); return l }
export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const ini = name.replace('Dr. ', '').split(' ').map((x) => x[0]).slice(0, 2).join('')
  return <span className="grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-teal to-navy font-bold text-white" style={{ width: size, height: size, fontSize: size * 0.38 }}>{ini}</span>
}
export function Bars({ data, h = 160, fmt }: { data: { label: string; value: number; hi?: boolean }[]; h?: number; fmt?: (n: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="flex items-end gap-[3px]" style={{ height: h }}>
      {data.map((d, i) => (
        <div key={i} className="group relative flex h-full flex-1 flex-col justify-end">
          <div className={cx('w-full rounded-t-[3px] transition-all', d.hi ? 'bg-teal' : 'bg-[#cfe6e3] group-hover:bg-mint')} style={{ height: `${Math.max(2, (d.value / max) * 100)}%` }} />
          <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 rounded-md bg-navy px-2 py-1 text-[11px] whitespace-nowrap text-white opacity-0 group-hover:opacity-100">{d.label}: {fmt ? fmt(d.value) : d.value}</div>
        </div>
      ))}
    </div>
  )
}
export function Meter({ value, max, tone = 'teal' }: { value: number; max: number; tone?: string }) {
  return <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#e9eff3]"><div className={cx('h-full rounded-full', tone === 'teal' ? 'bg-teal' : tone)} style={{ width: `${Math.min(100, (value / Math.max(1, max)) * 100)}%` }} /></div>
}
