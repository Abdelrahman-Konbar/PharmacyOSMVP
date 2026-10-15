import { useState } from 'react'
import { Download, Save, RotateCcw, ScrollText, Building2, Receipt, Boxes, Plug, Languages } from 'lucide-react'
import { useStore, logAudit, inScope, type Settings } from '../store'
import { Button, Card, PageHeader, Field, Input, Select, Confirm, Badge, Table, Toolbar, SearchInput, Empty, fDateTime, useToast, Toggle, Avatar, go, Textarea } from '../ui'
import { downloadCSV } from './sales'

export function AuditLogs() {
  const { db, scope } = useStore()
  const [q, setQ] = useState('')
  const [user, setUser] = useState('all')
  const [area, setArea] = useState('all')
  const areas = Array.from(new Set(db.audit.map((a) => a.action.split('.')[0])))
  const rows = db.audit.filter((a) => (!a.branchId || inScope(a.branchId, scope)) && (user === 'all' || a.userId === user) && (area === 'all' || a.action.startsWith(area + '.')) && (!q || `${a.entity} ${a.details} ${a.action}`.toLowerCase().includes(q.toLowerCase())))
  return (
    <div>
      <PageHeader title="Audit Logs" subtitle="Tamper-evident record of every material action in the workspace." actions={<Button icon={Download} onClick={() => downloadCSV('audit.csv', [['Time', 'User', 'Action', 'Entity', 'Details', 'Branch'], ...rows.map((a) => [a.date, db.users.find((u) => u.id === a.userId)?.name || 'System', a.action, a.entity, a.details, a.branchId || ''])])}>Export</Button>} />
      <Card pad={false}>
        <Toolbar>
          <SearchInput value={q} onChange={setQ} placeholder="Search entity or details…" className="w-[280px]" />
          <Select aria-label="User" className="w-[180px]" value={user} onChange={setUser} options={[{ value: 'all', label: 'All users' }, ...db.users.map((u) => ({ value: u.id, label: u.name }))]} />
          <Select aria-label="Area" className="w-[160px]" value={area} onChange={setArea} options={[{ value: 'all', label: 'All areas' }, ...areas.map((a) => ({ value: a, label: a }))]} />
        </Toolbar>
        <Table rows={rows} rowKey={(a) => a.id} pageSize={20} dense empty={<Empty icon={ScrollText} title="No audit entries match" />} cols={[
          { key: 't', label: 'Time', render: (a) => <span className="tnum whitespace-nowrap">{fDateTime(a.date)}</span>, sort: (a) => a.date },
          { key: 'u', label: 'User', render: (a) => { const u = db.users.find((x) => x.id === a.userId); return u ? <span className="flex items-center gap-2"><Avatar name={u.name} size={22} />{u.name}</span> : 'System' } },
          { key: 'a', label: 'Action', render: (a) => <span className="rounded bg-canvas px-1.5 py-0.5 font-mono text-[11.5px] font-semibold ring-1 ring-line">{a.action}</span> },
          { key: 'e', label: 'Entity', render: (a) => <b>{a.entity}</b> },
          { key: 'd', label: 'Details', render: (a) => <span className="text-muted">{a.details}</span> },
          { key: 'b', label: 'Branch', render: (a) => (a.branchId ? <Badge>{db.branches.find((b) => b.id === a.branchId)?.code}</Badge> : '—') },
        ]} />
      </Card>
    </div>
  )
}

export function SettingsScreen() {
  const { db, act, reset } = useStore()
  const toast = useToast()
  const [f, setF] = useState<Settings>(db.settings)
  const [confirm, setConfirm] = useState(false)
  const [err, setErr] = useState<Record<string, string>>({})
  const dirty = JSON.stringify(f) !== JSON.stringify(db.settings)
  const save = () => {
    const er: Record<string, string> = {}
    if (!f.orgName.trim()) er.orgName = 'Required'
    if (!(f.taxRate >= 0 && f.taxRate <= 30)) er.taxRate = '0–30%'
    if (!(f.expiryAlertDays >= 7 && f.expiryAlertDays <= 365)) er.expiry = '7–365 days'
    setErr(er)
    if (Object.keys(er).length) return
    act((d) => { d.settings = f; logAudit(d, 'settings.update', 'Organization settings', 'Settings saved') })
    toast({ kind: 'success', title: 'Settings saved' })
  }
  const Row = ({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) => <div className="flex items-center justify-between gap-6 border-b border-line/70 py-3.5 last:border-0"><div><div className="text-[13.5px] font-semibold">{title}</div><div className="text-[12.5px] text-muted">{desc}</div></div>{children}</div>
  return (
    <div className="max-w-[900px]">
      <PageHeader title="Settings" subtitle="Organization-wide configuration" actions={<><Button disabled={!dirty} onClick={() => setF(db.settings)}>Discard</Button><Button variant="primary" icon={Save} disabled={!dirty} onClick={save}>Save changes</Button></>} />
      <div className="space-y-4">
        <Card title={<span className="flex items-center gap-2"><Building2 className="size-4 text-teal" />Organization</span>}>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Trading name" error={err.orgName}><Input value={f.orgName} onChange={(e) => setF({ ...f, orgName: e.target.value })} invalid={!!err.orgName} /></Field>
            <Field label="Legal name"><Input value={f.legalName} onChange={(e) => setF({ ...f, legalName: e.target.value })} /></Field>
            <Field label="Commercial / VAT registration"><Input value={f.crNumber} onChange={(e) => setF({ ...f, crNumber: e.target.value })} /></Field>
            <Field label="Currency"><Select value={f.currency} onChange={(v) => setF({ ...f, currency: v })} options={['SAR', 'AED', 'KWD', 'EGP', 'USD'].map((c) => ({ value: c, label: c }))} /></Field>
          </div>
        </Card>
        <Card title={<span className="flex items-center gap-2"><Receipt className="size-4 text-teal" />Sales & receipts</span>}>
          <div className="grid grid-cols-2 gap-4"><Field label="VAT rate (%)" error={err.taxRate}><Input inputMode="decimal" value={f.taxRate} onChange={(e) => setF({ ...f, taxRate: parseFloat(e.target.value) || 0 })} invalid={!!err.taxRate} /></Field></div>
          <Field label="Receipt footer" className="mt-4"><Textarea value={f.receiptFooter} onChange={(e) => setF({ ...f, receiptFooter: e.target.value })} /></Field>
          <div className="mt-2"><Row title="Require prescription reference" desc="Block POS checkout for Rx items until a prescription reference is entered."><Toggle checked={f.requireRxRef} onChange={(v) => setF({ ...f, requireRxRef: v })} label="Require Rx reference" /></Row></div>
        </Card>
        <Card title={<span className="flex items-center gap-2"><Boxes className="size-4 text-teal" />Inventory</span>}>
          <div className="grid grid-cols-2 gap-4"><Field label="Expiry alert window (days)" error={err.expiry}><Input inputMode="numeric" value={f.expiryAlertDays} onChange={(e) => setF({ ...f, expiryAlertDays: parseInt(e.target.value) || 0 })} invalid={!!err.expiry} /></Field></div>
          <div className="mt-4 rounded-lg bg-canvas p-3 text-[12.5px] text-muted">Dispensing always follows first-expiry-first-out, and expired batches are never sellable. Negative stock is not permitted.</div>
        </Card>
        <Card title={<span className="flex items-center gap-2"><Languages className="size-4 text-teal" />Language</span>}>
          <Row title="Interface language" desc="Arabic switches to right-to-left layout and IBM Plex Sans Arabic."><Select className="w-[180px]" value={f.language} onChange={(v) => setF({ ...f, language: v as 'en' | 'ar' })} options={[{ value: 'en', label: 'English' }, { value: 'ar', label: 'العربية (Arabic)' }]} /></Row>
        </Card>
        <Card title={<span className="flex items-center gap-2"><Plug className="size-4 text-teal" />Integrations</span>}>
          {[['Card payment terminal', 'Card sales are recorded after manual terminal confirmation.'], ['Insurance eligibility (NPHIES)', 'Claims are recorded for manual submission; eligibility is not checked.'], ['SFDA drug track & trace', 'Serial verification is not performed.'], ['Supplier EDI / email', 'POs are marked as sent; share printed copies directly.']].map(([t, d]) => <Row key={t} title={t} desc={d}><Badge tone="gray">Not connected</Badge></Row>)}
        </Card>
        <Card title="Demo data">
          <Row title="Restore demo dataset" desc="Replace all local data with the seeded Shifa Pharmacies workspace. You'll be signed out."><Button icon={RotateCcw} onClick={() => setConfirm(true)}>Restore</Button></Row>
        </Card>
      </div>
      <Confirm open={confirm} onClose={() => setConfirm(false)} danger title="Restore demo data?" confirmLabel="Restore & sign out" body="All transactions, products and settings you've created in this browser will be replaced." onConfirm={() => { reset(); go('login'); toast({ kind: 'info', title: 'Demo data restored' }) }} />
    </div>
  )
}
