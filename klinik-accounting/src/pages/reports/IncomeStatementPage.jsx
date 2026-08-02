import { useState, useMemo, Fragment } from 'react'
import { Download, Printer } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { useAuth } from '../../store/useAuth'
import { fmtIDR, fmtDate, monthStart, monthEnd, fmtPct } from '../../utils/format'
import { exportIncomeStatementPDF } from '../../utils/exportPDF'
import { exportIncomeStatementExcel } from '../../utils/exportExcel'

function buildAccountBalances(coa, journalEntries, journalItems, dateFrom, dateTo, branchFilter) {
  const postedIds = new Set(
    journalEntries
      .filter(j =>
        j.status === 'POSTED' &&
        j.transactionDate >= dateFrom &&
        j.transactionDate <= dateTo &&
        (branchFilter === 'ALL' || j.branchId === branchFilter)
      )
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

function SectionRow({ label, value, indent = 0, isTotal = false, isGrandTotal = false }) {
  return (
    <tr className={isGrandTotal ? 'bg-primary-50 border-t-2 border-primary-200' : isTotal ? 'bg-slate-50 border-t border-slate-200' : ''}>
      <td className={`py-2 ${indent === 1 ? 'pl-8' : indent === 2 ? 'pl-14' : 'pl-4'} ${isTotal || isGrandTotal ? 'font-semibold' : ''} text-sm`}>
        {label}
      </td>
      <td className={`text-right py-2 font-mono text-sm pr-4 ${isGrandTotal ? 'text-primary-700 font-bold text-base' : isTotal ? 'font-semibold' : ''}`}>
        {value !== null && value !== undefined ? fmtIDR(value) : ''}
      </td>
    </tr>
  )
}

export default function IncomeStatementPage() {
  const { coa, journalEntries, journalItems, branches, activeBranchId } = useStore()
  const { appSettings } = useAuth()
  const [dateFrom, setDateFrom] = useState(monthStart())
  const [dateTo, setDateTo] = useState(monthEnd())
  const [branchFilter, setBranchFilter] = useState(activeBranchId || 'ALL')

  const balances = useMemo(() =>
    buildAccountBalances(coa, journalEntries, journalItems, dateFrom, dateTo, branchFilter),
    [coa, journalEntries, journalItems, dateFrom, dateTo, branchFilter])

  const getBalance = (code) => balances[code] || 0

  // Revenue groups — sorted by sortOrder so subgroups display in correct order
  const revGroups = useMemo(() => {
    const groups = {}
    coa.filter(a => a.accountType === 'REVENUE' && !a.isHeader).forEach(a => {
      const g = a.accountSubgroup || a.accountGroup
      if (!groups[g]) groups[g] = { label: g, items: [], minSort: a.sortOrder || 999 }
      groups[g].items.push({ ...a, amount: getBalance(a.accountCode) })
      groups[g].minSort = Math.min(groups[g].minSort, a.sortOrder || 999)
    })
    return Object.values(groups)
      .sort((a, b) => a.minSort - b.minSort)
      .map(g => ({ ...g, items: g.items.sort((a, b) => (a.accountCode || '').localeCompare(b.accountCode || '')) }))
  }, [coa, balances])

  const totalRevenue = revGroups.reduce((s, g) => s + g.items.reduce((ss, i) => ss + i.amount, 0), 0)

  // HPP
  const hppItems = useMemo(() => coa.filter(a => a.accountType === 'EXPENSE' && a.accountGroup === 'HARGA POKOK' && !a.isHeader)
    .sort((a, b) => (a.accountCode || '').localeCompare(b.accountCode || ''))
    .map(a => ({ ...a, amount: getBalance(a.accountCode) })), [coa, balances])
  const totalHPP = hppItems.reduce((s, i) => s + i.amount, 0)
  const grossProfit = totalRevenue - totalHPP

  // Operating expenses by subgroup
  const expGroups = useMemo(() => {
    const groups = {}
    coa.filter(a => a.accountType === 'EXPENSE' && a.accountGroup !== 'HARGA POKOK' && !a.isHeader).forEach(a => {
      const g = a.accountSubgroup || a.accountGroup
      if (!groups[g]) groups[g] = { label: g, items: [], minSort: a.sortOrder || 999 }
      groups[g].items.push({ ...a, amount: getBalance(a.accountCode) })
      groups[g].minSort = Math.min(groups[g].minSort, a.sortOrder || 999)
    })
    return Object.values(groups)
      .sort((a, b) => a.minSort - b.minSort)
      .map(g => ({ ...g, items: g.items.sort((a, b) => (a.accountCode || '').localeCompare(b.accountCode || '')) }))
  }, [coa, balances])

  const totalOpEx = expGroups.reduce((s, g) => s + g.items.reduce((ss, i) => ss + i.amount, 0), 0)
  const netProfit = grossProfit - totalOpEx
  const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0
  const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0

  const periodLabel = `${fmtDate(dateFrom)} s/d ${fmtDate(dateTo)}`
  const branchName = branches.find(b => b.id === branchFilter)?.entityName || 'Semua Cabang'

  // For export (PDF & Excel)
  const exportData = useMemo(() => {
    const rows = []
    rows.push({ accountCode: '', accountName: 'PENDAPATAN', isGroup: true, subtotal: totalRevenue })
    revGroups.forEach(g => {
      const sub = g.items.reduce((s, i) => s + i.amount, 0)
      rows.push({ accountCode: '', accountName: g.label, isGroup: true, subtotal: null })
      g.items.forEach(i => rows.push({ accountCode: i.accountCode, accountName: `${i.accountCode} — ${i.accountName}`, isGroup: false, amount: i.amount }))
      rows.push({ accountCode: '', accountName: `Total ${g.label}`, isGroup: true, subtotal: sub })
    })
    rows.push({ accountCode: '', accountName: 'TOTAL PENDAPATAN', isGroup: true, subtotal: totalRevenue })

    rows.push({ accountCode: '', accountName: 'HARGA POKOK PENJUALAN', isGroup: true, subtotal: totalHPP })
    hppItems.forEach(i => rows.push({ accountCode: i.accountCode, accountName: `${i.accountCode} — ${i.accountName}`, isGroup: false, amount: i.amount }))
    rows.push({ accountCode: '', accountName: 'TOTAL HARGA POKOK PENJUALAN', isGroup: true, subtotal: totalHPP })
    rows.push({ accountCode: '', accountName: 'LABA KOTOR', isGroup: true, subtotal: grossProfit })

    rows.push({ accountCode: '', accountName: 'BEBAN OPERASIONAL', isGroup: true, subtotal: totalOpEx })
    expGroups.forEach(g => {
      const sub = g.items.reduce((s, i) => s + i.amount, 0)
      rows.push({ accountCode: '', accountName: g.label, isGroup: true, subtotal: null })
      g.items.forEach(i => rows.push({ accountCode: i.accountCode, accountName: `${i.accountCode} — ${i.accountName}`, isGroup: false, amount: i.amount }))
      rows.push({ accountCode: '', accountName: `Total ${g.label}`, isGroup: true, subtotal: sub })
    })
    rows.push({ accountCode: '', accountName: 'TOTAL BEBAN OPERASIONAL', isGroup: true, subtotal: totalOpEx })
    rows.push({ accountCode: '', accountName: 'LABA BERSIH SEBELUM PAJAK', isGroup: true, subtotal: netProfit })
    return rows
  }, [revGroups, hppItems, expGroups, totalRevenue, totalHPP, grossProfit, totalOpEx, netProfit])

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Laporan Laba Rugi</h1>
          <p className="text-sm text-slate-400 mt-0.5">Income Statement — PSAK 1 / ISAK 35</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => exportIncomeStatementExcel(exportData, periodLabel, branchName, appSettings)}><Download className="w-4 h-4" />Excel</button>
          <button className="btn-secondary" onClick={() => exportIncomeStatementPDF(exportData, periodLabel, branchName, appSettings)}><Printer className="w-4 h-4" />PDF</button>
        </div>
      </div>

      {/* Filters */}
      <div className="card card-body">
        <div className="flex flex-wrap gap-4 items-end">
          <div><label className="form-label">Dari Tanggal</label><input type="date" className="form-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></div>
          <div><label className="form-label">Sampai Tanggal</label><input type="date" className="form-input" value={dateTo} onChange={e => setDateTo(e.target.value)} /></div>
          <div>
            <label className="form-label">Cabang</label>
            <select className="form-select" value={branchFilter} onChange={e => setBranchFilter(e.target.value)}>
              <option value="ALL">Semua Cabang</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.entityName}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* KPIs with Bright Solid Theme */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card card-body bg-emerald-500 text-white border-0 shadow-sm">
          <p className="text-xs text-emerald-100 uppercase tracking-wider font-semibold mb-1">Total Pendapatan</p>
          <p className="font-mono font-extrabold text-white text-2xl">{fmtIDR(totalRevenue)}</p>
        </div>
        <div className="card card-body bg-amber-500 text-white border-0 shadow-sm">
          <p className="text-xs text-amber-100 uppercase tracking-wider font-semibold mb-1">Laba Kotor</p>
          <p className="font-mono font-extrabold text-white text-2xl">{fmtIDR(grossProfit)}</p>
          <p className="text-xs text-amber-100 mt-1 font-semibold">Margin: {fmtPct(grossMargin)}</p>
        </div>
        <div className="card card-body bg-blue-500 text-white border-0 shadow-sm">
          <p className="text-xs text-blue-100 uppercase tracking-wider font-semibold mb-1">Total Beban Operasional</p>
          <p className="font-mono font-extrabold text-white text-2xl">{fmtIDR(totalOpEx)}</p>
        </div>
        <div className={`card card-body border-0 shadow-sm text-white ${netProfit >= 0 ? 'bg-purple-500' : 'bg-rose-500'}`}>
          <p className="text-xs text-purple-100 uppercase tracking-wider font-semibold mb-1">Laba Bersih</p>
          <p className="font-mono font-extrabold text-white text-2xl">{fmtIDR(netProfit)}</p>
          <p className="text-xs text-purple-100 mt-1 font-semibold">Margin: {fmtPct(netMargin)}</p>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="section-title">Laporan Laba Rugi</span>
          <span className="text-xs text-slate-400">{periodLabel} · {branchName}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-primary-700 text-white">
                <th className="px-4 py-3 text-left font-semibold">Keterangan</th>
                <th className="px-4 py-3 text-right font-semibold pr-4">Jumlah</th>
              </tr>
            </thead>
            <tbody>
              {/* PENDAPATAN */}
              <SectionRow label="PENDAPATAN" value={null} isTotal />
              {revGroups.map(g => {
                const sub = g.items.reduce((s, i) => s + i.amount, 0)
                return (
                  <Fragment key={`rev-grp-${g.label}`}>
                    <SectionRow label={g.label} value={null} indent={1} isTotal />
                    {g.items.map(i => <SectionRow key={i.accountCode} label={`${i.accountCode} — ${i.accountName}`} value={i.amount > 0 ? i.amount : null} indent={2} />)}
                    <SectionRow label={`Total ${g.label}`} value={sub} indent={1} isTotal />
                  </Fragment>
                )
              })}
              <SectionRow label="TOTAL PENDAPATAN" value={totalRevenue} isTotal />

              {/* HPP */}
              <tr><td colSpan={2} className="py-1" /></tr>
              <SectionRow label="HARGA POKOK PENJUALAN" value={null} isTotal />
              {hppItems.map(i => <SectionRow key={i.accountCode} label={`${i.accountCode} — ${i.accountName}`} value={i.amount > 0 ? i.amount : null} indent={2} />)}
              <SectionRow label="TOTAL HPP" value={totalHPP} isTotal />
              <SectionRow label="LABA KOTOR" value={grossProfit} isTotal />

              {/* BEBAN OPERASIONAL */}
              <tr><td colSpan={2} className="py-1" /></tr>
              <SectionRow label="BEBAN OPERASIONAL" value={null} isTotal />
              {expGroups.map(g => {
                const sub = g.items.reduce((s, i) => s + i.amount, 0)
                return (
                  <Fragment key={`exp-grp-${g.label}`}>
                    <SectionRow label={g.label} value={null} indent={1} isTotal />
                    {g.items.map(i => <SectionRow key={i.accountCode} label={`${i.accountCode} — ${i.accountName}`} value={i.amount > 0 ? i.amount : null} indent={2} />)}
                    <SectionRow label={`Total ${g.label}`} value={sub} indent={1} isTotal />
                  </Fragment>
                )
              })}
              <SectionRow label="TOTAL BEBAN OPERASIONAL" value={totalOpEx} isTotal />
            </tbody>
            <tfoot>
              <tr className="bg-primary-700 text-white">
                <td className="px-4 py-3 font-bold">LABA BERSIH SEBELUM PAJAK</td>
                <td className="px-4 py-3 text-right font-mono font-bold pr-4">{fmtIDR(netProfit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}
