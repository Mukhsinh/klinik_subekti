import { useState, useMemo } from 'react'
import { Download, Printer } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { useAuth } from '../../store/useAuth'
import { fmtIDR, fmtDate, monthEnd } from '../../utils/format'
import { exportBalanceSheetExcel } from '../../utils/exportExcel'

function buildBalancesUpTo(coa, journalEntries, journalItems, asOf, branchFilter) {
  const postedIds = new Set(
    journalEntries
      .filter(j => j.status === 'POSTED' && j.transactionDate <= asOf && (branchFilter === 'ALL' || j.branchId === branchFilter))
      .map(j => j.id)
  )
  const balances = {}
  journalItems.forEach(item => {
    if (!postedIds.has(item.journalEntryId)) return
    const acc = coa.find(a => a.accountCode === item.accountCode)
    if (!acc) return
    const d = parseFloat(item.debit || 0)
    const c = parseFloat(item.credit || 0)
    if (!balances[item.accountCode]) balances[item.accountCode] = 0
    if (acc.naturalBalance === 'DEBIT') balances[item.accountCode] += d - c
    else balances[item.accountCode] += c - d
  })
  return balances
}

function BSSection({ title, groups, total, colorClass = '' }) {
  return (
    <div className="mb-4">
      <div className={`px-4 py-2 font-bold text-sm uppercase tracking-wide ${colorClass || 'bg-slate-700 text-white'}`}>{title}</div>
      {groups.map(g => (
        <div key={g.label}>
          <div className="px-4 py-1.5 bg-slate-100 text-xs font-semibold text-slate-600 uppercase">{g.label}</div>
          {g.items.filter(i => i.balance !== 0).map(i => (
            <div key={i.accountCode} className="flex items-center justify-between px-4 py-1.5 border-b border-slate-100 hover:bg-slate-50">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-primary-700 w-24 flex-shrink-0">{i.accountCode}</span>
                <span className="text-sm text-slate-700">{i.accountName}</span>
              </div>
              <span className="font-mono text-sm text-slate-800">{fmtIDR(i.balance)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between px-4 py-2 bg-slate-50 font-semibold text-sm">
            <span className="text-slate-600">Total {g.label}</span>
            <span className="font-mono">{fmtIDR(g.items.reduce((s, i) => s + i.balance, 0))}</span>
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-200 font-bold text-sm">
        <span>TOTAL {title}</span>
        <span className="font-mono">{fmtIDR(total)}</span>
      </div>
    </div>
  )
}

export default function BalanceSheetPage() {
  const { coa, journalEntries, journalItems, branches, activeBranchId, openingBalances } = useStore()
  const { appSettings } = useAuth()
  const [asOf, setAsOf] = useState(monthEnd())
  const [branchFilter, setBranchFilter] = useState(activeBranchId || 'ALL')

  const balances = useMemo(() => {
    const fiscalYear = new Date(asOf).getFullYear()

    // Get opening balances for the fiscal year
    const openingBalanceMap = {}
    openingBalances.forEach(ob => {
      if (ob.fiscalYear === fiscalYear && (branchFilter === 'ALL' || ob.branchId === branchFilter)) {
        openingBalanceMap[ob.accountCode] = parseFloat(ob.openingBalance || 0)
      }
    })

    // Calculate period balances
    const periodBalances = buildBalancesUpTo(coa, journalEntries, journalItems, asOf, branchFilter)

    // Combine: opening + period movements
    const finalBalances = {}
    coa.filter(a => !a.isHeader).forEach(a => {
      const opening = openingBalanceMap[a.accountCode] || 0
      const period = periodBalances[a.accountCode] || 0
      finalBalances[a.accountCode] = opening + period
    })

    return finalBalances
  }, [coa, journalEntries, journalItems, asOf, branchFilter, openingBalances])

  const getBalanceItems = (type, group) =>
    coa
      .filter(a => a.accountType === type && (group ? a.accountGroup === group : true) && !a.isHeader)
      .map(a => ({ ...a, balance: balances[a.accountCode] || 0 }))
      .sort((a, b) => a.sortOrder - b.sortOrder)

  // Build asset groups
  const currentAssets = getBalanceItems('ASSET', 'ASET LANCAR')
  const nonCurrentAssets = getBalanceItems('ASSET', 'ASET TIDAK LANCAR')
  const totalAssets = [...currentAssets, ...nonCurrentAssets].reduce((s, a) => s + a.balance, 0)

  // Build liability groups
  const stLiab = getBalanceItems('LIABILITY', 'LIABILITAS JANGKA PENDEK')
  const ltLiab = getBalanceItems('LIABILITY', 'LIABILITAS JANGKA PANJANG')
  const equity = getBalanceItems('EQUITY')
  const totalLiab = [...stLiab, ...ltLiab].reduce((s, a) => s + a.balance, 0)
  const totalEquity = equity.reduce((s, a) => s + a.balance, 0)
  const totalLiabEquity = totalLiab + totalEquity

  const isBalanced = Math.abs(totalAssets - totalLiabEquity) < 0.01
  const branchName = branches.find(b => b.id === branchFilter)?.entityName || 'Semua Cabang'
  const periodLabel = `Per ${fmtDate(asOf)}`

  // Group helpers for sections
  const buildGroups = (items) => {
    const groups = {}
    items.forEach(i => {
      const g = i.accountSubgroup || i.accountGroup
      if (!groups[g]) groups[g] = { label: g, items: [] }
      groups[g].items.push(i)
    })
    return Object.values(groups)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Neraca (Balance Sheet)</h1>
          <p className="text-sm text-slate-400 mt-0.5">Posisi keuangan pada tanggal tertentu — PSAK 1</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => exportBalanceSheetExcel(
            currentAssets.concat(nonCurrentAssets).map(a => ({ accountCode: a.accountCode, accountName: a.accountName, balance: a.balance })),
            stLiab.concat(ltLiab).concat(equity).map(a => ({ accountCode: a.accountCode, accountName: a.accountName, balance: a.balance })),
            periodLabel, branchName, appSettings
          )}><Download className="w-4 h-4" />Excel</button>
        </div>
      </div>

      {/* Filters */}
      <div className="card card-body">
        <div className="flex flex-wrap gap-4 items-end">
          <div><label className="form-label">Per Tanggal</label><input type="date" className="form-input" value={asOf} onChange={e => setAsOf(e.target.value)} /></div>
          <div>
            <label className="form-label">Cabang</label>
            <select className="form-select" value={branchFilter} onChange={e => setBranchFilter(e.target.value)}>
              <option value="ALL">Semua Cabang</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.entityName}</option>)}
            </select>
          </div>
          <div className={`px-4 py-2 rounded-lg text-sm font-medium ${isBalanced ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            {isBalanced ? '✓ Neraca Balance' : '⚠ Tidak Balance — selisih ' + fmtIDR(Math.abs(totalAssets - totalLiabEquity))}
          </div>
        </div>
      </div>

      {/* Two-column balance sheet */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* ASET */}
        <div className="card overflow-hidden">
          <BSSection
            title="ASET"
            colorClass="bg-blue-700 text-white"
            groups={[
              { label: 'Aset Lancar', items: currentAssets },
              { label: 'Aset Tidak Lancar', items: nonCurrentAssets },
            ]}
            total={totalAssets}
          />
        </div>

        {/* LIABILITAS & EKUITAS */}
        <div className="card overflow-hidden">
          <BSSection
            title="LIABILITAS"
            colorClass="bg-red-700 text-white"
            groups={[
              { label: 'Jangka Pendek', items: stLiab },
              { label: 'Jangka Panjang', items: ltLiab },
            ]}
            total={totalLiab}
          />
          <BSSection
            title="EKUITAS"
            colorClass="bg-purple-700 text-white"
            groups={[{ label: 'Ekuitas Pemilik', items: equity }]}
            total={totalEquity}
          />
          <div className="flex items-center justify-between px-4 py-3 bg-slate-800 text-white font-bold">
            <span>TOTAL LIABILITAS & EKUITAS</span>
            <span className="font-mono">{fmtIDR(totalLiabEquity)}</span>
          </div>
        </div>
      </div>

      {/* Equation check */}
      <div className="card card-body bg-slate-50">
        <div className="flex items-center gap-8 flex-wrap text-sm">
          <div><span className="text-slate-500">Total Aset:</span> <span className="font-mono font-bold ml-2 text-blue-700">{fmtIDR(totalAssets)}</span></div>
          <span className="text-slate-400 text-lg">=</span>
          <div><span className="text-slate-500">Total Liabilitas:</span> <span className="font-mono font-bold ml-2 text-red-700">{fmtIDR(totalLiab)}</span></div>
          <span className="text-slate-400">+</span>
          <div><span className="text-slate-500">Total Ekuitas:</span> <span className="font-mono font-bold ml-2 text-purple-700">{fmtIDR(totalEquity)}</span></div>
          {isBalanced && <span className="badge badge-green ml-auto">✓ Persamaan Akuntansi Terpenuhi</span>}
        </div>
      </div>
    </div>
  )
}
