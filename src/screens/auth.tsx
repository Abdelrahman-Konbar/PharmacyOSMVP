import { useState } from 'react'
import { Mail, Lock, ArrowRight, ShieldCheck, Building2, MapPin, CheckCircle2, KeyRound } from 'lucide-react'
import { useStore, uid, now } from '../store'
import { Button, Field, Input, Select, go, useToast, cx } from '../ui'
import { Logo } from '../App'

function AuthFrame({ children, step }: { children: React.ReactNode; step?: number }) {
  return (
    <div className="flex min-h-full">
      <div className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-navy p-12 lg:flex">
        <svg className="absolute inset-0 h-full w-full opacity-[0.14]" aria-hidden>
          <defs><pattern id="g" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0V48" fill="none" stroke="#42D5B1" strokeWidth="0.6" /></pattern></defs>
          <rect width="100%" height="100%" fill="url(#g)" />
        </svg>
        <div className="absolute -right-24 -bottom-24 size-[420px] rounded-full bg-teal/30 blur-3xl" />
        <div className="relative"><Logo /></div>
        <div className="relative max-w-md">
          <div className="mb-4 text-[11px] font-bold tracking-[0.16em] text-mint uppercase">Connected Precision</div>
          <h1 className="text-[36px] leading-[1.12] font-extrabold tracking-[-0.03em] text-white">Every batch, every branch, every sale — in one precise system.</h1>
          <p className="mt-4 text-[14.5px] leading-relaxed text-[#a9bccb]">PharmacyOS connects dispensing, inventory, purchasing and finance for independent pharmacies and multi-branch chains.</p>
          <div className="mt-10 grid grid-cols-3 gap-3">
            {[['FEFO', 'batch dispensing'], ['Real-time', 'multi-branch stock'], ['Audited', 'every action']].map(([a, b]) => (
              <div key={a} className="rounded-xl border border-white/10 bg-white/[0.04] p-3.5"><div className="text-[15px] font-bold text-white">{a}</div><div className="text-[12px] text-[#8ea4b5]">{b}</div></div>
            ))}
          </div>
        </div>
        <div className="relative text-[12px] text-[#6f8799]">Demo environment · No real authentication, payments, or regulatory checks are performed.</div>
      </div>
      <div className="flex flex-1 items-center justify-center bg-white p-10">
        <div className="anim-in w-full max-w-[400px]">
          {step && <div className="mb-8 flex gap-2">{[1, 2].map((s) => <div key={s} className={cx('h-1 flex-1 rounded-full', s <= step ? 'bg-teal' : 'bg-line')} />)}</div>}
          {children}
        </div>
      </div>
    </div>
  )
}

export function Login() {
  const { db, act } = useStore()
  const toast = useToast()
  const [email, setEmail] = useState('lina@shifa.health')
  const [pw, setPw] = useState('demo1234')
  const [err, setErr] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const er: Record<string, string> = {}
    if (!/^\S+@\S+\.\S+$/.test(email)) er.email = 'Enter a valid email address'
    if (pw.length < 6) er.pw = 'Password must be at least 6 characters'
    const u = db.users.find((x) => x.email.toLowerCase() === email.toLowerCase())
    if (!er.email && !u) er.email = 'No account found for this email in the demo workspace'
    if (u && u.status !== 'active') er.email = u.status === 'invited' ? 'This user has not accepted their invitation yet' : 'This account is suspended'
    setErr(er)
    if (Object.keys(er).length) return
    setLoading(true)
    setTimeout(() => {
      const role = db.roles.find((r) => r.id === u!.roleId)!
      act((d) => { d.session = { userId: u!.id, branchId: role.name === 'Owner' ? 'all' : u!.branchIds[0] }; d.users.find((x) => x.id === u!.id)!.lastActive = now(); d.audit.unshift({ id: uid('a'), date: now(), userId: u!.id, action: 'auth.login', entity: u!.name, details: 'Signed in (simulated)' }) })
      toast({ kind: 'success', title: `Welcome back, ${u!.name.split(' ').slice(-2).join(' ')}` })
      go(role.permissions.includes('dashboard') ? 'dashboard' : 'pos')
    }, 500)
  }
  const demo = db.users.filter((u) => u.status === 'active').slice(0, 5)
  return (
    <AuthFrame>
      <h2 className="text-[26px] font-extrabold tracking-[-0.025em]">Sign in</h2>
      <p className="mt-1 text-[13.5px] text-muted">Access {db.settings.orgName}'s workspace.</p>
      <form onSubmit={submit} className="mt-7 space-y-4" noValidate>
        <Field label="Work email" error={err.email}>
          <div className="relative"><Mail className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" /><Input className="h-11 pl-9" type="email" value={email} onChange={(e) => setEmail(e.target.value)} invalid={!!err.email} autoComplete="email" /></div>
        </Field>
        <Field label="Password" error={err.pw}>
          <div className="relative"><Lock className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" /><Input className="h-11 pl-9" type="password" value={pw} onChange={(e) => setPw(e.target.value)} invalid={!!err.pw} autoComplete="current-password" /></div>
        </Field>
        <div className="flex justify-end"><button type="button" onClick={() => go('forgot')} className="text-[12.5px] font-semibold text-teal hover:underline">Forgot password?</button></div>
        <Button variant="primary" size="lg" className="w-full" loading={loading} type="submit">Sign in<ArrowRight className="size-4" /></Button>
      </form>
      <div className="mt-7 rounded-xl border border-line bg-canvas p-3.5">
        <div className="mb-2 text-[11px] font-bold tracking-wider text-muted uppercase">Demo accounts · any 6+ char password</div>
        <div className="flex flex-wrap gap-1.5">
          {demo.map((u) => <button key={u.id} type="button" onClick={() => { setEmail(u.email); setErr({}) }} className={cx('rounded-md border px-2 py-1 text-[12px] font-medium', email === u.email ? 'border-teal bg-teal/8 text-teal' : 'border-line bg-white hover:border-teal/40')}>{db.roles.find((r) => r.id === u.roleId)?.name} · {u.name.split(' ')[0] === 'Dr.' ? 'Lina' : u.name.split(' ')[0]}</button>)}
        </div>
      </div>
      <p className="mt-6 text-center text-[13px] text-muted">New pharmacy? <button onClick={() => go('setup-org')} className="font-semibold text-teal hover:underline">Set up an organization</button></p>
    </AuthFrame>
  )
}

export function Forgot() {
  const [email, setEmail] = useState('')
  const [err, setErr] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  return (
    <AuthFrame>
      <div className="mb-5 grid size-11 place-items-center rounded-xl bg-teal/10 text-teal"><KeyRound className="size-5" /></div>
      {sent ? (
        <>
          <h2 className="text-[24px] font-extrabold tracking-[-0.025em]">Check your inbox</h2>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted">If an account exists for <b className="text-ink">{email}</b>, a reset link would be sent. <span className="rounded bg-amber-50 px-1 text-amber-700">Demo: no email is actually sent.</span></p>
          <Button variant="primary" size="lg" className="mt-7 w-full" onClick={() => go('login')}>Return to sign in</Button>
        </>
      ) : (
        <>
          <h2 className="text-[24px] font-extrabold tracking-[-0.025em]">Reset your password</h2>
          <p className="mt-1 text-[13.5px] text-muted">Enter your work email and we'll send recovery instructions.</p>
          <form className="mt-6 space-y-4" noValidate onSubmit={(e) => { e.preventDefault(); if (!/^\S+@\S+\.\S+$/.test(email)) return setErr('Enter a valid email address'); setErr(''); setLoading(true); setTimeout(() => { setLoading(false); setSent(true) }, 700) }}>
            <Field label="Work email" error={err}><Input className="h-11" type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} invalid={!!err} placeholder="name@pharmacy.com" /></Field>
            <Button variant="primary" size="lg" className="w-full" loading={loading} type="submit">Send reset link</Button>
          </form>
          <button onClick={() => go('login')} className="mt-5 w-full text-center text-[13px] font-semibold text-muted hover:text-teal">Back to sign in</button>
        </>
      )}
    </AuthFrame>
  )
}

const KEY = 'pharmacyos.setup'
export function OrgSetup() {
  const saved = JSON.parse(sessionStorage.getItem(KEY) || '{}')
  const [f, setF] = useState({ orgName: saved.orgName || '', legalName: saved.legalName || '', crNumber: saved.crNumber || '', currency: saved.currency || 'SAR', taxRate: saved.taxRate ?? '15', owner: saved.owner || '', email: saved.email || '' })
  const [err, setErr] = useState<Record<string, string>>({})
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })
  const next = () => {
    const er: Record<string, string> = {}
    if (f.orgName.trim().length < 2) er.orgName = 'Organization name is required'
    if (!f.legalName.trim()) er.legalName = 'Legal entity name is required'
    if (!/^[\d ]{6,}$/.test(f.crNumber)) er.crNumber = 'Enter a valid registration number (digits)'
    if (isNaN(+f.taxRate) || +f.taxRate < 0 || +f.taxRate > 30) er.taxRate = 'Tax rate must be 0–30%'
    if (f.owner.trim().length < 3) er.owner = 'Owner name is required'
    if (!/^\S+@\S+\.\S+$/.test(f.email)) er.email = 'Enter a valid email'
    setErr(er)
    if (Object.keys(er).length) return
    sessionStorage.setItem(KEY, JSON.stringify(f))
    go('setup-branch')
  }
  return (
    <AuthFrame step={1}>
      <div className="mb-1 flex items-center gap-2 text-[12px] font-bold tracking-wider text-teal uppercase"><Building2 className="size-4" />Step 1 of 2</div>
      <h2 className="text-[24px] font-extrabold tracking-[-0.025em]">Your organization</h2>
      <p className="mt-1 text-[13.5px] text-muted">This creates a fresh workspace with a starter product catalog.</p>
      <div className="mt-6 space-y-3.5">
        <Field label="Organization name" error={err.orgName}><Input value={f.orgName} onChange={set('orgName')} invalid={!!err.orgName} placeholder="e.g. Noor Pharmacies" autoFocus /></Field>
        <Field label="Legal entity name" error={err.legalName}><Input value={f.legalName} onChange={set('legalName')} invalid={!!err.legalName} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Commercial reg. no." error={err.crNumber}><Input value={f.crNumber} onChange={set('crNumber')} invalid={!!err.crNumber} /></Field>
          <Field label="VAT rate (%)" error={err.taxRate}><Input value={f.taxRate} onChange={set('taxRate')} invalid={!!err.taxRate} inputMode="decimal" /></Field>
        </div>
        <Field label="Currency"><Select value={f.currency} onChange={(v) => setF({ ...f, currency: v })} options={['SAR', 'AED', 'KWD', 'EGP', 'USD'].map((c) => ({ value: c, label: c }))} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Owner full name" error={err.owner}><Input value={f.owner} onChange={set('owner')} invalid={!!err.owner} /></Field>
          <Field label="Owner email" error={err.email}><Input value={f.email} onChange={set('email')} invalid={!!err.email} /></Field>
        </div>
      </div>
      <div className="mt-7 flex gap-2"><Button size="lg" onClick={() => go('login')}>Cancel</Button><Button variant="primary" size="lg" className="flex-1" onClick={next}>Continue<ArrowRight className="size-4" /></Button></div>
    </AuthFrame>
  )
}

export function BranchSetup() {
  const { act } = useStore()
  const toast = useToast()
  const org = JSON.parse(sessionStorage.getItem(KEY) || 'null')
  const [f, setF] = useState({ name: '', code: '', city: '', address: '', phone: '', hours: '09:00 – 23:00' })
  const [err, setErr] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  if (!org) { go('setup-org'); return null }
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: k === 'code' ? e.target.value.toUpperCase().slice(0, 4) : e.target.value })
  const finish = () => {
    const er: Record<string, string> = {}
    if (!f.name.trim()) er.name = 'Branch name is required'
    if (!/^[A-Z]{2,4}$/.test(f.code)) er.code = '2–4 letters'
    if (!f.city.trim()) er.city = 'City is required'
    if (!f.address.trim()) er.address = 'Address is required'
    setErr(er)
    if (Object.keys(er).length) return
    setLoading(true)
    setTimeout(() => {
      act((d) => {
        const bid = uid('b'), ouid = uid('u')
        d.settings = { ...d.settings, orgName: org.orgName, legalName: org.legalName, crNumber: org.crNumber, currency: org.currency, taxRate: +org.taxRate }
        d.branches = [{ id: bid, ...f, phone: f.phone || '—', manager: org.owner, status: 'active' }]
        d.users = [{ id: ouid, name: org.owner, email: org.email, roleId: 'r1', branchIds: [bid], status: 'active', lastActive: now(), phone: '' }]
        d.products.forEach((p) => (p.status = 'active'))
        Object.assign(d, { batches: [], movements: [], sales: [], returns: [], pos: [], receipts: [], transfers: [], counts: [], shifts: [], expenses: [], audit: [], notifications: [] })
        d.notifications.push({ id: uid('n'), date: now(), title: 'Workspace ready', body: 'Start by creating a purchase order and receiving stock.', type: 'system', read: false, link: 'purchase-orders/new' })
        d.audit.push({ id: uid('a'), date: now(), userId: ouid, action: 'org.create', entity: org.orgName, details: `Organization and first branch ${f.name} created` })
        d.session = { userId: ouid, branchId: 'all' }
      })
      sessionStorage.removeItem(KEY)
      toast({ kind: 'success', title: 'Workspace created', body: 'Restore the demo dataset anytime from Settings.' })
      go('dashboard')
    }, 700)
  }
  return (
    <AuthFrame step={2}>
      <div className="mb-1 flex items-center gap-2 text-[12px] font-bold tracking-wider text-teal uppercase"><MapPin className="size-4" />Step 2 of 2</div>
      <h2 className="text-[24px] font-extrabold tracking-[-0.025em]">First branch</h2>
      <p className="mt-1 text-[13.5px] text-muted">Add the location for <b className="text-ink">{org.orgName}</b>. You can add more later.</p>
      <div className="mt-6 space-y-3.5">
        <div className="grid grid-cols-[1fr_110px] gap-3">
          <Field label="Branch name" error={err.name}><Input value={f.name} onChange={set('name')} invalid={!!err.name} autoFocus placeholder="e.g. Downtown" /></Field>
          <Field label="Code" error={err.code}><Input value={f.code} onChange={set('code')} invalid={!!err.code} placeholder="DTN" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="City" error={err.city}><Input value={f.city} onChange={set('city')} invalid={!!err.city} /></Field>
          <Field label="Phone"><Input value={f.phone} onChange={set('phone')} /></Field>
        </div>
        <Field label="Street address" error={err.address}><Input value={f.address} onChange={set('address')} invalid={!!err.address} /></Field>
        <Field label="Opening hours"><Input value={f.hours} onChange={set('hours')} /></Field>
        <div className="flex items-start gap-2.5 rounded-lg bg-canvas p-3 text-[12.5px] text-muted"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-teal" />Pharmacy license verification with regulators is not performed in this demo.</div>
      </div>
      <div className="mt-7 flex gap-2"><Button size="lg" onClick={() => go('setup-org')}>Back</Button><Button variant="primary" size="lg" className="flex-1" loading={loading} onClick={finish}><CheckCircle2 className="size-4" />Create workspace</Button></div>
    </AuthFrame>
  )
}
