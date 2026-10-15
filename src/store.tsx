import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

// ---------- Types ----------
export type ID = string
export type Branch = { id: ID; name: string; code: string; city: string; address: string; phone: string; manager: string; status: 'active' | 'inactive'; hours: string }
export type Perm =
  | 'dashboard' | 'pos' | 'sales' | 'returns' | 'products' | 'products.edit' | 'inventory' | 'counts' | 'purchasing' | 'suppliers'
  | 'transfers' | 'branches' | 'users' | 'roles' | 'shifts' | 'expenses' | 'reports' | 'audit' | 'settings'
export type Role = { id: ID; name: string; description: string; permissions: Perm[]; system?: boolean }
export type User = { id: ID; name: string; email: string; roleId: ID; branchIds: ID[]; status: 'active' | 'invited' | 'suspended'; lastActive: string; phone: string }
export type Product = {
  id: ID; sku: string; barcode: string; name: string; nameAr: string; generic: string; category: string; form: string; strength: string
  manufacturer: string; price: number; cost: number; reorder: number; rx: boolean; taxable: boolean; status: 'active' | 'archived'
}
export type Batch = { id: ID; productId: ID; branchId: ID; lot: string; expiry: string; qty: number; cost: number; receivedAt: string }
export type MoveType = 'sale' | 'return' | 'receipt' | 'transfer_out' | 'transfer_in' | 'adjustment' | 'count'
export type Movement = { id: ID; date: string; productId: ID; branchId: ID; lot: string; type: MoveType; qty: number; ref: string; userId: ID }
export type SaleItem = { productId: ID; name: string; qty: number; price: number; discount: number; allocs: { batchId: ID; lot: string; qty: number }[]; returned: number }
export type Sale = {
  id: ID; no: string; date: string; branchId: ID; userId: ID; shiftId: ID | null; customer: string; items: SaleItem[]
  subtotal: number; discount: number; tax: number; total: number; payment: 'cash' | 'card' | 'insurance'; tendered: number
  status: 'completed' | 'partially_returned' | 'returned'; rxRef?: string
}
export type Return = {
  id: ID; no: string; saleId: ID; date: string; branchId: ID; userId: ID; items: { productId: ID; name: string; qty: number; price: number; restock: boolean }[]
  reason: string; refund: number; method: 'cash' | 'card' | 'insurance'; status: 'refunded'
}
export type Supplier = { id: ID; name: string; contact: string; email: string; phone: string; terms: string; leadDays: number; status: 'active' | 'inactive'; license: string; address: string }
export type POStatus = 'draft' | 'submitted' | 'partially_received' | 'received' | 'cancelled'
export type PO = { id: ID; no: string; supplierId: ID; branchId: ID; date: string; expected: string; status: POStatus; items: { productId: ID; qty: number; cost: number; received: number }[]; notes: string; userId: ID }
export type Receipt = { id: ID; no: string; poId: ID; date: string; branchId: ID; userId: ID; items: { productId: ID; qty: number; lot: string; expiry: string; cost: number }[]; invoiceRef: string }
export type TransferStatus = 'draft' | 'in_transit' | 'received' | 'cancelled'
export type Transfer = {
  id: ID; no: string; from: ID; to: ID; date: string; status: TransferStatus; notes: string; userId: ID
  items: { productId: ID; qty: number; allocs: { lot: string; expiry: string; qty: number; cost: number }[] }[]
  dispatchedAt?: string; receivedAt?: string
}
export type Count = { id: ID; no: string; branchId: ID; date: string; status: 'in_progress' | 'completed'; scope: string; lines: { productId: ID; expected: number; counted: number | null }[]; completedAt?: string; userId: ID }
export type Shift = { id: ID; branchId: ID; userId: ID; openedAt: string; closedAt?: string; openingCash: number; countedCash?: number; expectedCash?: number; status: 'open' | 'closed'; notes?: string }
export type Expense = { id: ID; branchId: ID; date: string; category: string; amount: number; description: string; method: 'cash' | 'card' | 'bank'; userId: ID; shiftId?: ID | null }
export type Notif = { id: ID; date: string; title: string; body: string; type: 'stock' | 'expiry' | 'purchase' | 'transfer' | 'system' | 'sales'; read: boolean; link?: string; branchId?: ID }
export type Audit = { id: ID; date: string; userId: ID; action: string; entity: string; details: string; branchId?: ID }
export type Settings = { orgName: string; legalName: string; currency: string; taxRate: number; language: 'en' | 'ar'; receiptFooter: string; expiryAlertDays: number; allowNegative: boolean; requireRxRef: boolean; crNumber: string }
export type DB = {
  v: number; setupDone: boolean; settings: Settings; branches: Branch[]; roles: Role[]; users: User[]; products: Product[]; batches: Batch[]
  movements: Movement[]; sales: Sale[]; returns: Return[]; suppliers: Supplier[]; pos: PO[]; receipts: Receipt[]; transfers: Transfer[]
  counts: Count[]; shifts: Shift[]; expenses: Expense[]; notifications: Notif[]; audit: Audit[]; counters: Record<string, number>
  session: { userId: ID; branchId: ID | 'all' } | null
}

// ---------- Utils ----------
let _id = 0
export const uid = (p = 'x') => `${p}_${Date.now().toString(36)}${(_id++).toString(36)}${Math.random().toString(36).slice(2, 5)}`
const DAY = 86400000
export const now = () => new Date().toISOString()
const daysFrom = (d: number, h = 10) => { const x = new Date(Date.now() + d * DAY); x.setHours(h, Math.floor(Math.random() * 60)); return x.toISOString() }
const dateOnly = (d: number) => new Date(Date.now() + d * DAY).toISOString().slice(0, 10)
let seed = 42
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }
const ri = (a: number, b: number) => Math.floor(rnd() * (b - a + 1)) + a
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)]
export const round2 = (n: number) => Math.round(n * 100) / 100

export const ALL_PERMS: { key: Perm; label: string; group: string }[] = [
  { key: 'dashboard', label: 'View dashboard', group: 'Overview' },
  { key: 'pos', label: 'Operate POS', group: 'Sales' },
  { key: 'sales', label: 'View sales history', group: 'Sales' },
  { key: 'returns', label: 'Process returns', group: 'Sales' },
  { key: 'products', label: 'View products', group: 'Inventory' },
  { key: 'products.edit', label: 'Create & edit products', group: 'Inventory' },
  { key: 'inventory', label: 'View stock & movements', group: 'Inventory' },
  { key: 'counts', label: 'Run stock counts', group: 'Inventory' },
  { key: 'purchasing', label: 'Manage purchasing', group: 'Purchasing' },
  { key: 'suppliers', label: 'Manage suppliers', group: 'Purchasing' },
  { key: 'transfers', label: 'Manage transfers', group: 'Transfers' },
  { key: 'branches', label: 'Manage branches', group: 'Organization' },
  { key: 'users', label: 'Manage users', group: 'Organization' },
  { key: 'roles', label: 'Manage roles', group: 'Organization' },
  { key: 'shifts', label: 'Cash shifts', group: 'Finance' },
  { key: 'expenses', label: 'Record expenses', group: 'Finance' },
  { key: 'reports', label: 'Reports & analytics', group: 'Finance' },
  { key: 'audit', label: 'View audit logs', group: 'Administration' },
  { key: 'settings', label: 'Organization settings', group: 'Administration' },
]

// ---------- Seed ----------
function buildSeed(): DB {
  seed = 42
  const branches: Branch[] = [
    { id: 'b1', name: 'Al Olaya Main', code: 'OLY', city: 'Riyadh', address: 'King Fahd Rd, Al Olaya', phone: '+966 11 410 2200', manager: 'Sara Al-Harbi', status: 'active', hours: '08:00 – 24:00' },
    { id: 'b2', name: 'Al Malqa', code: 'MLQ', city: 'Riyadh', address: 'Anas Bin Malik Rd, Al Malqa', phone: '+966 11 455 8810', manager: 'Khalid Nasser', status: 'active', hours: '09:00 – 23:00' },
    { id: 'b3', name: 'Corniche Jeddah', code: 'JED', city: 'Jeddah', address: 'Corniche Rd, Al Shati', phone: '+966 12 660 1430', manager: 'Omar Farouk', status: 'active', hours: '24 hours' },
  ]
  const all = ALL_PERMS.map((p) => p.key)
  const roles: Role[] = [
    { id: 'r1', name: 'Owner', description: 'Full access across all branches', permissions: all, system: true },
    { id: 'r2', name: 'Branch Manager', description: 'Runs daily operations for assigned branches', permissions: all.filter((p) => !['roles', 'settings', 'audit'].includes(p)) },
    { id: 'r3', name: 'Pharmacist', description: 'Dispensing, inventory and receiving', permissions: ['dashboard', 'pos', 'sales', 'returns', 'products', 'inventory', 'counts', 'purchasing', 'transfers', 'shifts'] },
    { id: 'r4', name: 'Cashier', description: 'Point of sale and own cash shift', permissions: ['pos', 'sales', 'shifts', 'products'] },
  ]
  const users: User[] = [
    { id: 'u1', name: 'Dr. Lina Mansour', email: 'lina@shifa.health', roleId: 'r1', branchIds: ['b1', 'b2', 'b3'], status: 'active', lastActive: daysFrom(0), phone: '+966 50 111 2233' },
    { id: 'u2', name: 'Sara Al-Harbi', email: 'sara@shifa.health', roleId: 'r2', branchIds: ['b1'], status: 'active', lastActive: daysFrom(0), phone: '+966 55 201 4400' },
    { id: 'u3', name: 'Khalid Nasser', email: 'khalid@shifa.health', roleId: 'r2', branchIds: ['b2'], status: 'active', lastActive: daysFrom(-1), phone: '+966 55 789 1020' },
    { id: 'u4', name: 'Yousef Haddad', email: 'yousef@shifa.health', roleId: 'r3', branchIds: ['b1', 'b2'], status: 'active', lastActive: daysFrom(0), phone: '+966 54 330 6677' },
    { id: 'u5', name: 'Mona Saleh', email: 'mona@shifa.health', roleId: 'r4', branchIds: ['b1'], status: 'active', lastActive: daysFrom(0), phone: '+966 56 902 1188' },
    { id: 'u6', name: 'Omar Farouk', email: 'omar@shifa.health', roleId: 'r2', branchIds: ['b3'], status: 'active', lastActive: daysFrom(-2), phone: '+966 50 765 4321' },
    { id: 'u7', name: 'Hana Qureshi', email: 'hana@shifa.health', roleId: 'r3', branchIds: ['b3'], status: 'invited', lastActive: '', phone: '+966 53 440 2299' },
  ]
  const P: [string, string, string, string, string, string, string, number, number, boolean][] = [
    ['Panadol Extra', 'بنادول إكسترا', 'Paracetamol + Caffeine', 'Analgesics', 'Tablet', '500/65 mg', 'GSK', 14.5, 9.2, false],
    ['Brufen', 'بروفين', 'Ibuprofen', 'Analgesics', 'Tablet', '400 mg', 'Abbott', 18.75, 11.4, false],
    ['Augmentin', 'أوجمنتين', 'Amoxicillin + Clavulanate', 'Antibiotics', 'Tablet', '1 g', 'GSK', 62.0, 41.5, true],
    ['Zithromax', 'زيثروماكس', 'Azithromycin', 'Antibiotics', 'Capsule', '250 mg', 'Pfizer', 48.3, 31.0, true],
    ['Ciprobay', 'سيبروباي', 'Ciprofloxacin', 'Antibiotics', 'Tablet', '500 mg', 'Bayer', 39.9, 25.2, true],
    ['Glucophage', 'جلوكوفاج', 'Metformin', 'Diabetes', 'Tablet', '850 mg', 'Merck', 22.4, 13.1, true],
    ['Lantus SoloStar', 'لانتوس', 'Insulin glargine', 'Diabetes', 'Pen', '100 IU/ml', 'Sanofi', 185.0, 142.0, true],
    ['Januvia', 'جانوفيا', 'Sitagliptin', 'Diabetes', 'Tablet', '100 mg', 'MSD', 236.5, 178.0, true],
    ['Concor', 'كونكور', 'Bisoprolol', 'Cardiovascular', 'Tablet', '5 mg', 'Merck', 31.2, 19.8, true],
    ['Lipitor', 'ليبيتور', 'Atorvastatin', 'Cardiovascular', 'Tablet', '20 mg', 'Pfizer', 94.0, 63.0, true],
    ['Aspocid', 'أسبوسيد', 'Acetylsalicylic acid', 'Cardiovascular', 'Tablet', '81 mg', 'Tabuk', 7.5, 3.9, false],
    ['Norvasc', 'نورفاسك', 'Amlodipine', 'Cardiovascular', 'Tablet', '5 mg', 'Pfizer', 44.6, 28.9, true],
    ['Nexium', 'نيكسيوم', 'Esomeprazole', 'Gastro', 'Tablet', '40 mg', 'AstraZeneca', 71.25, 47.0, true],
    ['Gaviscon Advance', 'جافيسكون', 'Sodium alginate', 'Gastro', 'Suspension', '250 ml', 'Reckitt', 32.0, 20.5, false],
    ['Imodium', 'إيموديوم', 'Loperamide', 'Gastro', 'Capsule', '2 mg', 'J&J', 16.8, 9.7, false],
    ['Claritine', 'كلاريتين', 'Loratadine', 'Allergy', 'Tablet', '10 mg', 'Bayer', 24.5, 14.2, false],
    ['Zyrtec', 'زيرتك', 'Cetirizine', 'Allergy', 'Tablet', '10 mg', 'UCB', 21.9, 12.9, false],
    ['Ventolin Inhaler', 'فنتولين', 'Salbutamol', 'Respiratory', 'Inhaler', '100 mcg', 'GSK', 19.5, 11.0, true],
    ['Symbicort Turbuhaler', 'سيمبيكورت', 'Budesonide + Formoterol', 'Respiratory', 'Inhaler', '160/4.5', 'AstraZeneca', 128.0, 96.0, true],
    ['Otrivin Spray', 'أوتريفين', 'Xylometazoline', 'Respiratory', 'Spray', '0.1%', 'Haleon', 15.25, 8.6, false],
    ['Vitamin D3 5000', 'فيتامين د٣', 'Cholecalciferol', 'Vitamins', 'Softgel', '5000 IU', 'Now Foods', 58.0, 33.0, false],
    ['Centrum Adults', 'سنتروم', 'Multivitamin', 'Vitamins', 'Tablet', '30s', 'Haleon', 72.5, 46.0, false],
    ['Omega-3 Fish Oil', 'أوميغا ٣', 'EPA/DHA', 'Vitamins', 'Softgel', '1000 mg', 'Nature Made', 64.0, 38.5, false],
    ['Fucidin Cream', 'فيوسيدين', 'Fusidic acid', 'Dermatology', 'Cream', '2% 15g', 'LEO', 27.4, 16.0, true],
    ['Bepanthen', 'بيبانثين', 'Dexpanthenol', 'Dermatology', 'Ointment', '5% 30g', 'Bayer', 29.95, 17.8, false],
    ['La Roche Cicaplast', 'سيكابلاست', 'Panthenol balm', 'Dermatology', 'Balm', '40 ml', 'L\'Oréal', 68.0, 41.0, false],
    ['Eltroxin', 'إلتروكسين', 'Levothyroxine', 'Endocrine', 'Tablet', '50 mcg', 'Aspen', 18.2, 10.4, true],
    ['Voltaren Emulgel', 'فولتارين', 'Diclofenac', 'Analgesics', 'Gel', '1% 50g', 'Haleon', 34.5, 21.0, false],
    ['ORS Sachets', 'محلول الإرواء', 'Oral rehydration salts', 'Gastro', 'Sachet', '10s', 'SPIMACO', 9.75, 4.8, false],
    ['Accu-Chek Strips', 'شرائط أكيو تشيك', 'Glucose test strips', 'Devices', 'Strip', '50s', 'Roche', 112.0, 79.0, false],
  ]
  const products: Product[] = P.map((p, i) => ({
    id: `p${i + 1}`, sku: `SKU-${(1001 + i).toString()}`, barcode: `628${(1000000000 + i * 7919).toString().slice(0, 10)}`,
    name: p[0], nameAr: p[1], generic: p[2], category: p[3], form: p[4], strength: p[5], manufacturer: p[6], price: p[7], cost: p[8], rx: p[9],
    reorder: ri(10, 30), taxable: p[3] !== 'Antibiotics' && p[3] !== 'Diabetes', status: 'active',
  }))
  const batches: Batch[] = []
  products.forEach((pr, i) => {
    branches.forEach((b) => {
      const n = ri(1, 2)
      for (let k = 0; k < n; k++) {
        let exp = ri(40, 720)
        if (i % 9 === 0 && k === 0) exp = ri(10, 55)
        let qty = ri(8, 90)
        if ((i + b.id.length * 3) % 7 === 0) qty = ri(0, 6)
        batches.push({ id: `bt${batches.length + 1}`, productId: pr.id, branchId: b.id, lot: `L${ri(2300, 2499)}${String.fromCharCode(65 + ri(0, 25))}`, expiry: dateOnly(exp), qty, cost: pr.cost, receivedAt: daysFrom(-ri(20, 120)) })
      }
    })
  })
  const suppliers: Supplier[] = [
    { id: 's1', name: 'Nahdi Medical Distribution', contact: 'Faisal Al-Otaibi', email: 'orders@nmd.sa', phone: '+966 11 222 0011', terms: 'Net 30', leadDays: 2, status: 'active', license: 'SFDA-DIST-10442', address: 'Industrial City 2, Riyadh' },
    { id: 's2', name: 'Al Dawaa Wholesale', contact: 'Reem Bakr', email: 'supply@aldawaa-ws.sa', phone: '+966 13 880 4500', terms: 'Net 45', leadDays: 3, status: 'active', license: 'SFDA-DIST-20981', address: 'Dammam 2nd Industrial' },
    { id: 's3', name: 'Tamer Healthcare', contact: 'Ahmed Tamer', email: 'b2b@tamer.com', phone: '+966 12 650 7700', terms: 'Net 30', leadDays: 4, status: 'active', license: 'SFDA-DIST-05530', address: 'Al Khumrah, Jeddah' },
    { id: 's4', name: 'SPIMACO Direct', contact: 'Nawaf Saud', email: 'direct@spimaco.sa', phone: '+966 11 477 3300', terms: 'Net 60', leadDays: 5, status: 'inactive', license: 'SFDA-MFG-00121', address: 'Qassim Industrial' },
  ]
  const counters: Record<string, number> = { INV: 10240, RET: 310, PO: 1180, GRN: 940, TRF: 220, CNT: 45 }
  const next = (k: string) => `${k}-${++counters[k]}`
  const movements: Movement[] = []
  const sales: Sale[] = []
  const shifts: Shift[] = []
  // past closed shifts & sales
  for (let d = -29; d <= 0; d++) {
    branches.forEach((b) => {
      const cashier = b.id === 'b1' ? 'u5' : b.id === 'b2' ? 'u3' : 'u6'
      const shift: Shift = { id: uid('sh'), branchId: b.id, userId: cashier, openedAt: daysFrom(d, 8), openingCash: 500, status: d === 0 && b.id !== 'b1' ? 'open' : 'closed' }
      if (d === 0 && b.id === 'b1') { shifts.push({ ...shift, status: 'closed', closedAt: daysFrom(-0.0001, 7), countedCash: 500, expectedCash: 500 }); return }
      let cash = 500
      const n = ri(2, 5) + (b.id === 'b1' ? 2 : 0)
      for (let s = 0; s < n; s++) {
        const items: SaleItem[] = []
        const k = ri(1, 3)
        for (let j = 0; j < k; j++) {
          const pr = pick(products)
          if (items.find((x) => x.productId === pr.id)) continue
          const qty = ri(1, 2)
          const bt = batches.find((x) => x.productId === pr.id && x.branchId === b.id)!
          items.push({ productId: pr.id, name: pr.name, qty, price: pr.price, discount: 0, allocs: [{ batchId: bt.id, lot: bt.lot, qty }], returned: 0 })
        }
        const subtotal = round2(items.reduce((a, x) => a + x.qty * x.price, 0))
        const tax = round2(items.reduce((a, x) => a + (products.find((p) => p.id === x.productId)!.taxable ? x.qty * x.price * 0.15 : 0), 0))
        const payment = pick(['cash', 'cash', 'card', 'card', 'insurance'] as const)
        const total = round2(subtotal + tax)
        if (payment === 'cash') cash += total
        const sale: Sale = { id: uid('sa'), no: next('INV'), date: daysFrom(d, ri(9, 21)), branchId: b.id, userId: cashier, shiftId: shift.id, customer: pick(['Walk-in', 'Walk-in', 'Walk-in', 'Abdullah R.', 'Noura K.', 'Fahad M.']), items, subtotal, discount: 0, tax, total, payment, tendered: total, status: 'completed' }
        sales.push(sale)
        items.forEach((it) => movements.push({ id: uid('mv'), date: sale.date, productId: it.productId, branchId: b.id, lot: it.allocs[0].lot, type: 'sale', qty: -it.qty, ref: sale.no, userId: cashier }))
      }
      if (shift.status === 'closed') { shift.closedAt = daysFrom(d, 23); shift.expectedCash = round2(cash); shift.countedCash = round2(cash + (ri(0, 6) === 0 ? -ri(5, 20) : 0)) }
      shifts.push(shift)
    })
  }
  sales.sort((a, b) => b.date.localeCompare(a.date))
  const pos: PO[] = [
    { id: 'po1', no: next('PO'), supplierId: 's1', branchId: 'b1', date: daysFrom(-12), expected: dateOnly(-9), status: 'received', items: [{ productId: 'p1', qty: 60, cost: 9.2, received: 60 }, { productId: 'p6', qty: 40, cost: 13.1, received: 40 }], notes: 'Monthly replenishment', userId: 'u2' },
    { id: 'po2', no: next('PO'), supplierId: 's2', branchId: 'b1', date: daysFrom(-3), expected: dateOnly(0), status: 'submitted', items: [{ productId: 'p3', qty: 30, cost: 41.5, received: 0 }, { productId: 'p10', qty: 20, cost: 63, received: 0 }, { productId: 'p13', qty: 24, cost: 47, received: 0 }], notes: '', userId: 'u2' },
    { id: 'po3', no: next('PO'), supplierId: 's3', branchId: 'b3', date: daysFrom(-5), expected: dateOnly(-1), status: 'partially_received', items: [{ productId: 'p7', qty: 20, cost: 142, received: 10 }, { productId: 'p21', qty: 36, cost: 33, received: 36 }], notes: 'Insulin cold-chain', userId: 'u6' },
    { id: 'po4', no: next('PO'), supplierId: 's1', branchId: 'b2', date: daysFrom(-1), expected: dateOnly(2), status: 'draft', items: [{ productId: 'p16', qty: 40, cost: 14.2, received: 0 }], notes: 'Allergy season', userId: 'u3' },
  ]
  const receipts: Receipt[] = [
    { id: 'gr1', no: next('GRN'), poId: 'po1', date: daysFrom(-9), branchId: 'b1', userId: 'u4', items: [{ productId: 'p1', qty: 60, lot: 'L2410K', expiry: dateOnly(500), cost: 9.2 }, { productId: 'p6', qty: 40, lot: 'L2398C', expiry: dateOnly(420), cost: 13.1 }], invoiceRef: 'NMD-88213' },
    { id: 'gr2', no: next('GRN'), poId: 'po3', date: daysFrom(-2), branchId: 'b3', userId: 'u6', items: [{ productId: 'p7', qty: 10, lot: 'L2455A', expiry: dateOnly(300), cost: 142 }, { productId: 'p21', qty: 36, lot: 'L2461F', expiry: dateOnly(600), cost: 33 }], invoiceRef: 'TMR-55190' },
  ]
  const transfers: Transfer[] = [
    { id: 'tr1', no: next('TRF'), from: 'b1', to: 'b2', date: daysFrom(-6), status: 'received', notes: 'Stock balancing', userId: 'u2', items: [{ productId: 'p17', qty: 10, allocs: [{ lot: 'L2340B', expiry: dateOnly(300), qty: 10, cost: 12.9 }] }], dispatchedAt: daysFrom(-6), receivedAt: daysFrom(-5) },
    { id: 'tr2', no: next('TRF'), from: 'b1', to: 'b3', date: daysFrom(-1), status: 'in_transit', notes: 'Urgent: inhalers', userId: 'u2', items: [{ productId: 'p18', qty: 6, allocs: [{ lot: 'L2377D', expiry: dateOnly(380), qty: 6, cost: 11 }] }], dispatchedAt: daysFrom(-1) },
  ]
  const counts: Count[] = [
    { id: 'c1', no: next('CNT'), branchId: 'b1', date: daysFrom(-14), status: 'completed', scope: 'Analgesics', userId: 'u4', completedAt: daysFrom(-14, 16), lines: products.filter((p) => p.category === 'Analgesics').map((p) => ({ productId: p.id, expected: 40, counted: 40 })) },
  ]
  const expenses: Expense[] = [
    { id: uid('ex'), branchId: 'b1', date: daysFrom(-20), category: 'Rent', amount: 18500, description: 'Monthly rent — Olaya', method: 'bank', userId: 'u1' },
    { id: uid('ex'), branchId: 'b1', date: daysFrom(-8), category: 'Utilities', amount: 1240, description: 'Electricity (SEC)', method: 'bank', userId: 'u2' },
    { id: uid('ex'), branchId: 'b2', date: daysFrom(-6), category: 'Maintenance', amount: 380, description: 'Fridge thermostat repair', method: 'cash', userId: 'u3' },
    { id: uid('ex'), branchId: 'b3', date: daysFrom(-4), category: 'Supplies', amount: 215.5, description: 'Receipt rolls & bags', method: 'cash', userId: 'u6' },
    { id: uid('ex'), branchId: 'b2', date: daysFrom(-2), category: 'Rent', amount: 14000, description: 'Monthly rent — Malqa', method: 'bank', userId: 'u1' },
    { id: uid('ex'), branchId: 'b1', date: daysFrom(-1), category: 'Delivery', amount: 96, description: 'Courier — customer deliveries', method: 'card', userId: 'u2' },
  ]
  const notifications: Notif[] = [
    { id: uid('n'), date: daysFrom(0, 9), title: 'Low stock: Ventolin Inhaler', body: 'Al Olaya Main is below the reorder point.', type: 'stock', read: false, link: 'products/p18', branchId: 'b1' },
    { id: uid('n'), date: daysFrom(0, 8), title: 'Batches expiring within 60 days', body: 'Several batches need attention. Review the expiry report.', type: 'expiry', read: false, link: 'inventory' },
    { id: uid('n'), date: daysFrom(-1, 15), title: 'Transfer TRF-222 dispatched', body: 'Al Olaya Main → Corniche Jeddah, awaiting receipt.', type: 'transfer', read: false, link: 'transfers/tr2', branchId: 'b3' },
    { id: uid('n'), date: daysFrom(-2, 11), title: 'PO-1183 partially received', body: '10 of 20 Lantus pens still outstanding.', type: 'purchase', read: true, link: 'purchase-orders/po3', branchId: 'b3' },
    { id: uid('n'), date: daysFrom(-3, 10), title: 'Shift variance recorded', body: 'A closed shift had a cash shortfall.', type: 'sales', read: true, link: 'shifts' },
  ]
  const audit: Audit[] = [
    { id: uid('a'), date: daysFrom(-1, 15), userId: 'u2', action: 'transfer.dispatch', entity: 'TRF-222', details: 'Dispatched 6 units to Corniche Jeddah', branchId: 'b1' },
    { id: uid('a'), date: daysFrom(-2, 11), userId: 'u6', action: 'receipt.create', entity: 'GRN-942', details: 'Received 46 units against PO-1183', branchId: 'b3' },
    { id: uid('a'), date: daysFrom(-3, 9), userId: 'u2', action: 'po.submit', entity: 'PO-1182', details: 'Submitted to Al Dawaa Wholesale', branchId: 'b1' },
    { id: uid('a'), date: daysFrom(-7, 13), userId: 'u1', action: 'user.invite', entity: 'Hana Qureshi', details: 'Invited as Pharmacist — Corniche Jeddah' },
    { id: uid('a'), date: daysFrom(-14, 16), userId: 'u4', action: 'count.complete', entity: 'CNT-46', details: 'Analgesics count — no variance', branchId: 'b1' },
  ]
  return {
    v: 3, setupDone: true,
    settings: { orgName: 'Shifa Pharmacies', legalName: 'Shifa Healthcare Trading Co.', currency: 'SAR', taxRate: 15, language: 'en', receiptFooter: 'Thank you. Keep medicines out of reach of children.', expiryAlertDays: 60, allowNegative: false, requireRxRef: true, crNumber: '1010 456 789' },
    branches, roles, users, products, batches, movements, sales, returns: [], suppliers, pos, receipts, transfers, counts, shifts, expenses, notifications, audit, counters, session: null,
  }
}

// ---------- Selectors ----------
export const today = () => new Date().toISOString().slice(0, 10)
export const isExpired = (b: Batch) => b.expiry < today()
export const daysToExpiry = (exp: string) => Math.ceil((new Date(exp).getTime() - Date.now()) / DAY)
export const inScope = (branchId: ID, scope: ID | 'all') => scope === 'all' || branchId === scope
export function stockOf(db: DB, productId: ID, scope: ID | 'all', sellableOnly = false) {
  return db.batches.filter((b) => b.productId === productId && inScope(b.branchId, scope) && (!sellableOnly || !isExpired(b))).reduce((a, b) => a + b.qty, 0)
}
export function stockStatus(db: DB, p: Product, scope: ID | 'all') {
  const q = stockOf(db, p.id, scope)
  const r = scope === 'all' ? p.reorder * db.branches.length : p.reorder
  return q === 0 ? 'out' : q <= r ? 'low' : 'ok'
}

// ---------- Mutating helpers (operate on draft) ----------
export const nextNo = (d: DB, k: string) => `${k}-${(d.counters[k] = (d.counters[k] || 0) + 1)}`
export function logAudit(d: DB, action: string, entity: string, details: string, branchId?: ID) {
  d.audit.unshift({ id: uid('a'), date: now(), userId: d.session?.userId || 'system', action, entity, details, branchId })
}
export function pushNotif(d: DB, n: Omit<Notif, 'id' | 'date' | 'read'>) { d.notifications.unshift({ ...n, id: uid('n'), date: now(), read: false }) }
export function move(d: DB, m: Omit<Movement, 'id' | 'date' | 'userId'>) { d.movements.unshift({ ...m, id: uid('mv'), date: now(), userId: d.session?.userId || 'system' }) }
/** First-expiry-first-out allocation from sellable batches. */
export function allocateFEFO(d: DB, productId: ID, branchId: ID, qty: number) {
  const bs = d.batches.filter((b) => b.productId === productId && b.branchId === branchId && b.qty > 0 && !isExpired(b)).sort((a, b) => a.expiry.localeCompare(b.expiry))
  const out: { batch: Batch; qty: number }[] = []
  let left = qty
  for (const b of bs) { if (left <= 0) break; const t = Math.min(b.qty, left); out.push({ batch: b, qty: t }); left -= t }
  return { allocs: out, short: left }
}
export function checkLowStock(d: DB, productId: ID, branchId: ID) {
  const p = d.products.find((x) => x.id === productId)!
  const q = stockOf(d, productId, branchId)
  if (q <= p.reorder) {
    const br = d.branches.find((b) => b.id === branchId)!
    const exists = d.notifications.find((n) => !n.read && n.title === `Low stock: ${p.name}` && n.branchId === branchId)
    if (!exists) pushNotif(d, { title: `Low stock: ${p.name}`, body: `${br.name} has ${q} units (reorder at ${p.reorder}).`, type: 'stock', link: `products/${p.id}`, branchId })
  }
}
export function addStock(d: DB, productId: ID, branchId: ID, lot: string, expiry: string, qty: number, cost: number) {
  const ex = d.batches.find((b) => b.productId === productId && b.branchId === branchId && b.lot === lot)
  if (ex) ex.qty += qty
  else d.batches.push({ id: uid('bt'), productId, branchId, lot, expiry, qty, cost, receivedAt: now() })
}

// ---------- Context ----------
type Ctx = {
  db: DB
  act: (fn: (d: DB) => void) => void
  reset: () => void
  me: User | null
  role: Role | null
  can: (p: Perm) => boolean
  scope: ID | 'all'
  myBranches: Branch[]
  money: (n: number) => string
  t: (en: string) => string
}
const C = createContext<Ctx>(null as unknown as Ctx)
const KEY = 'pharmacyos.db.v3'

const AR: Record<string, string> = {
  Dashboard: 'لوحة التحكم', Notifications: 'الإشعارات', 'Point of Sale': 'نقطة البيع', 'Sales History': 'سجل المبيعات', 'Sales Returns': 'المرتجعات',
  Products: 'المنتجات', 'Inventory Overview': 'المخزون', 'Stock Movements': 'حركات المخزون', 'Stock Counts': 'الجرد', 'Purchase Orders': 'أوامر الشراء',
  'Goods Receipts': 'استلام البضائع', Suppliers: 'الموردون', Transfers: 'التحويلات', Branches: 'الفروع', 'Users & Access': 'المستخدمون', 'Roles & Permissions': 'الأدوار والصلاحيات',
  'Cash Shifts': 'الورديات', Expenses: 'المصروفات', 'Reports & Analytics': 'التقارير', 'Audit Logs': 'سجل التدقيق', Settings: 'الإعدادات',
  Overview: 'نظرة عامة', Sales: 'المبيعات', Inventory: 'المخزون', Purchasing: 'المشتريات', Organization: 'المنظمة', Finance: 'المالية', Administration: 'الإدارة',
  'All branches': 'كل الفروع', 'Sign out': 'تسجيل الخروج', Search: 'بحث',
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB>(() => {
    try { const s = localStorage.getItem(KEY); if (s) { const p = JSON.parse(s); if (p.v === 3) return p } } catch { /* ignore */ }
    return buildSeed()
  })
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(db)) }, [db])
  useEffect(() => {
    document.documentElement.dir = db.settings.language === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.lang = db.settings.language
  }, [db.settings.language])
  const value = useMemo<Ctx>(() => {
    const me = db.session ? db.users.find((u) => u.id === db.session!.userId) || null : null
    const role = me ? db.roles.find((r) => r.id === me.roleId) || null : null
    const myBranches = me ? db.branches.filter((b) => me.branchIds.includes(b.id)) : []
    const fmt = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    return {
      db,
      act: (fn) => setDb((prev) => { const d = structuredClone(prev); fn(d); return d }),
      reset: () => { const s = buildSeed(); setDb(s) },
      me, role, myBranches,
      can: (p) => !!role?.permissions.includes(p),
      scope: db.session?.branchId || 'all',
      money: (n) => `${db.settings.currency} ${fmt.format(n)}`,
      t: (en) => (db.settings.language === 'ar' ? AR[en] || en : en),
    }
  }, [db])
  return <C.Provider value={value}>{children}</C.Provider>
}
export const useStore = () => useContext(C)
