import { useState, useMemo, Fragment } from 'react'
import { Download, Printer } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { useAuth } from '../../store/useAuth'
import { fmtIDR, fmtDate, monthStart, monthEnd, fmtPct, todayISO } from '../../utils/format'
import { exportIncomeStatementPDF } from '../../utils/exportPDF'
import { exportIncomeStatementExcel } from '../../utils/exportExcel'

function buildAccountBalances(coa, journalEntries, journalItems, dateFrom, dateTo, branchFilter) {
  const postedIds = new Set(
    journalEntries
      .filter(j =>
        j.status === 'POSTED' &&
        (!dateFrom || j.transactionDate >= dateFrom) &&
        (!dateTo || j.transactionDate <= dateTo) &&
        (branchFilter === 'ALL' || !j.branchId || j.branchId === branchFilter)
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

function SectionRow({ label, value, indent = 0, isTotal = false, isGrandTotal = false, isSubHeader = false }) {
  return (
    <tr className={
      isGrandTotal
        ? 'bg-primary-50 border-t-2 border-b-2 border-primary-300 font-bold'
        : isTotal
          ? 'bg-slate-50 border-t border-slate-200 font-semibold'
          : isSubHeader
            ? 'bg-slate-50/50 font-medium text-slate-700'
            : 'hover:bg-slate-50/30'
    }>
      <td className={`py-2 ${indent === 1 ? 'pl-8' : indent === 2 ? 'pl-14' : 'pl-4'} ${isTotal || isGrandTotal ? 'font-semibold text-slate-900' : 'text-slate-700'} text-sm`}>
        {label}
      </td>
      <td className={`text-right py-2 font-mono text-sm pr-4 ${isGrandTotal ? 'text-primary-800 font-bold text-base' : isTotal ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
        {value !== null && value !== undefined ? fmtIDR(value) : ''}
      </td>
    </tr>
  )
}

export default function IncomeStatementPage() {
  const {
    coa, journalEntries, journalItems, branches, activeBranchId
  } = useStore()
  const { appSettings } = useAuth()

  // Date Filters — Default: Seluruh transaksi tahun berjalan (jika tidak difilter)
  const currentYear = new Date().getFullYear()
  const [dateFrom, setDateFrom] = useState(`${currentYear}-01-01`)
  const [dateTo, setDateTo] = useState(`${currentYear}-12-31`)
  const [branchFilter, setBranchFilter] = useState('ALL')

  // Presets for Date Filter
  const applyPreset = (preset) => {
    const now = new Date()
    const yr = now.getFullYear()
    if (preset === 'THIS_MONTH') {
      setDateFrom(monthStart())
      setDateTo(monthEnd())
    } else if (preset === 'LAST_MONTH') {
      const prevMonth = new Date(yr, now.getMonth() - 1, 1)
      setDateFrom(monthStart(prevMonth))
      setDateTo(monthEnd(prevMonth))
    } else if (preset === 'THIS_QUARTER') {
      const qStartMonth = Math.floor(now.getMonth() / 3) * 3
      const qStart = new Date(yr, qStartMonth, 1)
      const qEnd = new Date(yr, qStartMonth + 3, 0)
      setDateFrom(monthStart(qStart))
      setDateTo(monthEnd(qEnd))
    } else if (preset === 'YTD') {
      setDateFrom(`${yr}-01-01`)
      setDateTo(`${yr}-12-31`)
    } else if (preset === 'ALL') {
      setDateFrom('2025-01-01')
      setDateTo(`${yr + 1}-12-31`)
    }
  }

  // Account Balances
  const balances = useMemo(() =>
    buildAccountBalances(coa, journalEntries, journalItems, dateFrom, dateTo, branchFilter),
    [coa, journalEntries, journalItems, dateFrom, dateTo, branchFilter])

  const getBalance = (code) => balances[code] || 0

  // 1. Operating Revenue (Pendapatan Usaha: 4-1x-xxx)
  const operatingRevGroups = useMemo(() => {
    const groups = {}
    coa
      .filter(a => a.accountType === 'REVENUE' && !a.isHeader && (a.accountCode.startsWith('4-1') || !(a.accountCode.startsWith('4-9') || a.accountCode.startsWith('8-'))))
      .forEach(a => {
        const g = a.accountSubgroup || a.accountGroup || 'Pendapatan Usaha'
        if (!groups[g]) groups[g] = { label: g, items: [], minSort: a.sortOrder || 999 }
        groups[g].items.push({ ...a, amount: getBalance(a.accountCode) })
        groups[g].minSort = Math.min(groups[g].minSort, a.sortOrder || 999)
      })
    return Object.values(groups)
      .sort((a, b) => a.minSort - b.minSort)
      .map(g => ({ ...g, items: g.items.sort((a, b) => (a.accountCode || '').localeCompare(b.accountCode || '')) }))
  }, [coa, balances])

  const totalOperatingRevenue = operatingRevGroups.reduce((s, g) => s + g.items.reduce((ss, i) => ss + i.amount, 0), 0)

  // 2. Harga Pokok Penjualan (HPP: 5-xx-xxx)
  const hppItems = useMemo(() =>
    coa
      .filter(a => a.accountType === 'EXPENSE' && !a.isHeader && (a.accountCode.startsWith('5-') || (a.accountGroup || '').toUpperCase().includes('HARGA POKOK') || (a.accountGroup || '').toUpperCase().includes('HPP')))
      .sort((a, b) => (a.accountCode || '').localeCompare(b.accountCode || ''))
      .map(a => ({ ...a, amount: getBalance(a.accountCode) })),
    [coa, balances])

  const totalHPP = hppItems.reduce((s, i) => s + i.amount, 0)
  const grossProfit = totalOperatingRevenue - totalHPP

  // 3. Operating Expenses (Beban Operasional: 6-xx-xxx)
  const operatingExpGroups = useMemo(() => {
    const groups = {}
    coa
      .filter(a =>
        a.accountType === 'EXPENSE' &&
        !a.isHeader &&
        !a.accountCode.startsWith('5-') &&
        !a.accountCode.startsWith('7-') &&
        !(a.accountGroup || '').toUpperCase().includes('HARGA POKOK') &&
        !(a.accountGroup || '').toUpperCase().includes('HPP') &&
        !(a.accountGroup || '').toUpperCase().includes('NON-OPERASIONAL')
      )
      .forEach(a => {
        const g = a.accountSubgroup || a.accountGroup || 'Beban Operasional'
        if (!groups[g]) groups[g] = { label: g, items: [], minSort: a.sortOrder || 999 }
        groups[g].items.push({ ...a, amount: getBalance(a.accountCode) })
        groups[g].minSort = Math.min(groups[g].minSort, a.sortOrder || 999)
      })
    return Object.values(groups)
      .sort((a, b) => a.minSort - b.minSort)
      .map(g => ({ ...g, items: g.items.sort((a, b) => (a.accountCode || '').localeCompare(b.accountCode || '')) }))
  }, [coa, balances])

  const totalOperatingExpense = operatingExpGroups.reduce((s, g) => s + g.items.reduce((ss, i) => ss + i.amount, 0), 0)
  const operatingProfit = grossProfit - totalOperatingExpense

  // 4. Non-Operating Items (4-9x-xxx, 8-xx-xxx, 7-xx-xxx)
  const nonOperatingRevItems = useMemo(() =>
    coa
      .filter(a => a.accountType === 'REVENUE' && !a.isHeader && (a.accountCode.startsWith('4-9') || a.accountCode.startsWith('8-') || (a.accountGroup || '').toUpperCase().includes('NON-OPERASIONAL')))
      .sort((a, b) => (a.accountCode || '').localeCompare(b.accountCode || ''))
      .map(a => ({ ...a, amount: getBalance(a.accountCode) })),
    [coa, balances])
  const totalNonOperatingRevenue = nonOperatingRevItems.reduce((s, i) => s + i.amount, 0)

  const nonOperatingExpItems = useMemo(() =>
    coa
      .filter(a => a.accountType === 'EXPENSE' && !a.isHeader && (a.accountCode.startsWith('7-') || (a.accountGroup || '').toUpperCase().includes('NON-OPERASIONAL')))
      .sort((a, b) => (a.accountCode || '').localeCompare(b.accountCode || ''))
      .map(a => ({ ...a, amount: getBalance(a.accountCode) })),
    [coa, balances])
  const totalNonOperatingExpense = nonOperatingExpItems.reduce((s, i) => s + i.amount, 0)

  const netNonOperating = totalNonOperatingRevenue - totalNonOperatingExpense
  const netProfit = operatingProfit + netNonOperating

  const totalAllRevenue = totalOperatingRevenue + totalNonOperatingRevenue
  const grossMargin = totalOperatingRevenue > 0 ? (grossProfit / totalOperatingRevenue) * 100 : 0
  const netMargin = totalAllRevenue > 0 ? (netProfit / totalAllRevenue) * 100 : 0

  const periodLabel = `${fmtDate(dateFrom)} s/d ${fmtDate(dateTo)}`
  const branchName = appSettings?.companyName || 'Klinik Subekti'

  // Export Data Builder
  const exportData = useMemo(() => {
    const rows = []
    rows.push({ accountCode: '', accountName: 'I. PENDAPATAN USAHA', isGroup: true, subtotal: totalOperatingRevenue })
    operatingRevGroups.forEach(g => {
      const sub = g.items.reduce((s, i) => s + i.amount, 0)
      rows.push({ accountCode: '', accountName: g.label, isGroup: true, subtotal: null })
      g.items.forEach(i => rows.push({ accountCode: i.accountCode, accountName: `${i.accountCode} — ${i.accountName}`, isGroup: false, amount: i.amount }))
      rows.push({ accountCode: '', accountName: `Total ${g.label}`, isGroup: true, subtotal: sub })
    })
    rows.push({ accountCode: '', accountName: 'TOTAL PENDAPATAN USAHA', isGroup: true, subtotal: totalOperatingRevenue })

    rows.push({ accountCode: '', accountName: 'II. HARGA POKOK PENJUALAN', isGroup: true, subtotal: totalHPP })
    hppItems.forEach(i => rows.push({ accountCode: i.accountCode, accountName: `${i.accountCode} — ${i.accountName}`, isGroup: false, amount: i.amount }))
    rows.push({ accountCode: '', accountName: 'TOTAL HARGA POKOK PENJUALAN (HPP)', isGroup: true, subtotal: totalHPP })
    rows.push({ accountCode: '', accountName: 'LABA KOTOR (GROSS PROFIT)', isGroup: true, subtotal: grossProfit })

    rows.push({ accountCode: '', accountName: 'III. BEBAN OPERASIONAL', isGroup: true, subtotal: totalOperatingExpense })
    operatingExpGroups.forEach(g => {
      const sub = g.items.reduce((s, i) => s + i.amount, 0)
      rows.push({ accountCode: '', accountName: g.label, isGroup: true, subtotal: null })
      g.items.forEach(i => rows.push({ accountCode: i.accountCode, accountName: `${i.accountCode} — ${i.accountName}`, isGroup: false, amount: i.amount }))
      rows.push({ accountCode: '', accountName: `Total ${g.label}`, isGroup: true, subtotal: sub })
    })
    rows.push({ accountCode: '', accountName: 'TOTAL BEBAN OPERASIONAL', isGroup: true, subtotal: totalOperatingExpense })
    rows.push({ accountCode: '', accountName: 'LABA OPERASIONAL (OPERATING PROFIT)', isGroup: true, subtotal: operatingProfit })

    if (totalNonOperatingRevenue > 0 || totalNonOperatingExpense > 0) {
      rows.push({ accountCode: '', accountName: 'IV. PENDAPATAN & BEBAN NON-OPERASIONAL', isGroup: true, subtotal: netNonOperating })
      if (totalNonOperatingRevenue > 0) {
        rows.push({ accountCode: '', accountName: 'Pendapatan Non-Operasional', isGroup: true, subtotal: totalNonOperatingRevenue })
        nonOperatingRevItems.forEach(i => rows.push({ accountCode: i.accountCode, accountName: `${i.accountCode} — ${i.accountName}`, isGroup: false, amount: i.amount }))
      }
      if (totalNonOperatingExpense > 0) {
        rows.push({ accountCode: '', accountName: 'Beban Non-Operasional & Pajak', isGroup: true, subtotal: totalNonOperatingExpense })
        nonOperatingExpItems.forEach(i => rows.push({ accountCode: i.accountCode, accountName: `${i.accountCode} — ${i.accountName}`, isGroup: false, amount: i.amount }))
      }
    }

    rows.push({ accountCode: '', accountName: 'LABA BERSIH SEBELUM PAJAK', isGroup: true, subtotal: netProfit })
    return rows
  }, [
    operatingRevGroups, hppItems, operatingExpGroups, nonOperatingRevItems, nonOperatingExpItems,
    totalOperatingRevenue, totalHPP, grossProfit, totalOperatingExpense, operatingProfit,
    totalNonOperatingRevenue, totalNonOperatingExpense, netNonOperating, netProfit
  ])

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="page-title flex items-center gap-2">
            Laporan Laba Rugi
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-primary-100 text-primary-800 border border-primary-200">
              PSAK 1 / ISAK 35
            </span>
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Laporan Kinerja Keuangan Terintegrasi dengan Kasir, Farmasi, Pengeluaran Stok, & Operasional
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-secondary" onClick={() => exportIncomeStatementExcel(exportData, periodLabel, branchName, appSettings)}>
            <Download className="w-4 h-4" /> Excel
          </button>
          <button className="btn-secondary" onClick={() => exportIncomeStatementPDF(exportData, periodLabel, branchName, appSettings)}>
            <Printer className="w-4 h-4" /> PDF
          </button>
        </div>
      </div>

      {/* Filters & Presets Card */}
      <div className="card card-body space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            <span className="text-xs font-medium text-slate-500 self-center mr-1">Pintasan Periode:</span>
            {[
              { id: 'THIS_MONTH', label: 'Bulan Ini' },
              { id: 'LAST_MONTH', label: 'Bulan Lalu' },
              { id: 'THIS_QUARTER', label: 'Kuartal Berjalan' },
              { id: 'YTD', label: 'Tahun 2026 (YTD)' },
              { id: 'ALL', label: 'Semua Transaksi' },
            ].map(p => (
              <button
                key={p.id}
                onClick={() => applyPreset(p.id)}
                className="text-xs px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="text-xs text-slate-400 font-mono">
            {periodLabel} · {branchName}
          </div>
        </div>

        <div className="flex flex-wrap gap-4 items-end pt-1 border-t border-slate-100">
          <div>
            <label className="form-label text-xs">Dari Tanggal</label>
            <input type="date" className="form-input text-xs" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="form-label text-xs">Sampai Tanggal</label>
            <input type="date" className="form-input text-xs" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card card-body bg-emerald-600 text-white border-0 shadow-sm">
          <p className="text-xs text-emerald-100 uppercase tracking-wider font-semibold mb-1">Total Pendapatan Usaha</p>
          <p className="font-mono font-extrabold text-white text-2xl">{fmtIDR(totalOperatingRevenue)}</p>
          <p className="text-[11px] text-emerald-100 mt-1 font-medium">DPP Layanan + Farmasi</p>
        </div>
        <div className="card card-body bg-amber-500 text-white border-0 shadow-sm">
          <p className="text-xs text-amber-100 uppercase tracking-wider font-semibold mb-1">Laba Kotor (Gross Profit)</p>
          <p className="font-mono font-extrabold text-white text-2xl">{fmtIDR(grossProfit)}</p>
          <p className="text-xs text-amber-100 mt-1 font-semibold">Margin: {fmtPct(grossMargin)}</p>
        </div>
        <div className="card card-body bg-blue-600 text-white border-0 shadow-sm">
          <p className="text-xs text-blue-100 uppercase tracking-wider font-semibold mb-1">Total Beban Operasional</p>
          <p className="font-mono font-extrabold text-white text-2xl">{fmtIDR(totalOperatingExpense)}</p>
          <p className="text-[11px] text-blue-100 mt-1 font-medium">Beban SDM, Jasa Medis, dll.</p>
        </div>
        <div className={`card card-body border-0 shadow-sm text-white ${netProfit >= 0 ? 'bg-purple-600' : 'bg-rose-600'}`}>
          <p className="text-xs text-purple-100 uppercase tracking-wider font-semibold mb-1">Laba Bersih Sebelum Pajak</p>
          <p className="font-mono font-extrabold text-white text-2xl">{fmtIDR(netProfit)}</p>
          <p className="text-xs text-purple-100 mt-1 font-semibold">Margin Bersih: {fmtPct(netMargin)}</p>
        </div>
      </div>

      {/* Main Income Statement Table */}
      <div className="card shadow-sm border border-slate-200">
        <div className="card-header bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div>
            <span className="section-title text-base">Laporan Laba Rugi Komprehensif</span>
            <p className="text-xs text-slate-500 mt-0.5">{periodLabel} · {branchName}</p>
          </div>
          <span className="text-xs font-mono font-semibold text-slate-600 bg-white px-2.5 py-1 rounded border border-slate-200">
            Mata Uang: IDR (Rupiah)
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-primary-700 text-white">
                <th className="px-4 py-3 text-left font-semibold">Keterangan / Rekening COA</th>
                <th className="px-4 py-3 text-right font-semibold pr-4">Jumlah (Rp)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {/* I. PENDAPATAN USAHA */}
              <SectionRow label="I. PENDAPATAN USAHA (REVENUE)" value={null} isTotal />
              {operatingRevGroups.map(g => {
                const sub = g.items.reduce((s, i) => s + i.amount, 0)
                return (
                  <Fragment key={`rev-grp-${g.label}`}>
                    <SectionRow label={g.label} value={null} indent={1} isSubHeader />
                    {g.items.map(i => (
                      <SectionRow
                        key={i.accountCode}
                        label={`${i.accountCode} — ${i.accountName}`}
                        value={i.amount !== 0 ? i.amount : null}
                        indent={2}
                      />
                    ))}
                    <SectionRow label={`Total ${g.label}`} value={sub} indent={1} isTotal />
                  </Fragment>
                )
              })}
              <SectionRow label="TOTAL PENDAPATAN USAHA" value={totalOperatingRevenue} isTotal />

              {/* II. HARGA POKOK PENJUALAN */}
              <tr><td colSpan={2} className="py-1 bg-slate-100/50" /></tr>
              <SectionRow label="II. HARGA POKOK PENJUALAN (HPP / COGS)" value={null} isTotal />
              {hppItems.map(i => (
                <SectionRow
                  key={i.accountCode}
                  label={`${i.accountCode} — ${i.accountName}`}
                  value={i.amount !== 0 ? i.amount : null}
                  indent={2}
                />
              ))}
              <SectionRow label="TOTAL HARGA POKOK PENJUALAN" value={totalHPP} isTotal />
              <SectionRow label="LABA KOTOR (GROSS PROFIT)" value={grossProfit} isTotal isGrandTotal />

              {/* III. BEBAN OPERASIONAL */}
              <tr><td colSpan={2} className="py-1 bg-slate-100/50" /></tr>
              <SectionRow label="III. BEBAN OPERASIONAL" value={null} isTotal />
              {operatingExpGroups.map(g => {
                const sub = g.items.reduce((s, i) => s + i.amount, 0)
                return (
                  <Fragment key={`exp-grp-${g.label}`}>
                    <SectionRow label={g.label} value={null} indent={1} isSubHeader />
                    {g.items.map(i => (
                      <SectionRow
                        key={i.accountCode}
                        label={`${i.accountCode} — ${i.accountName}`}
                        value={i.amount !== 0 ? i.amount : null}
                        indent={2}
                      />
                    ))}
                    <SectionRow label={`Total ${g.label}`} value={sub} indent={1} isTotal />
                  </Fragment>
                )
              })}
              <SectionRow label="TOTAL BEBAN OPERASIONAL" value={totalOperatingExpense} isTotal />
              <SectionRow label="LABA OPERASIONAL (OPERATING PROFIT)" value={operatingProfit} isTotal />

              {/* IV. NON-OPERASIONAL (JIKA ADA) */}
              {(totalNonOperatingRevenue > 0 || totalNonOperatingExpense > 0) && (
                <>
                  <tr><td colSpan={2} className="py-1 bg-slate-100/50" /></tr>
                  <SectionRow label="IV. PENDAPATAN & BEBAN NON-OPERASIONAL" value={null} isTotal />
                  {totalNonOperatingRevenue > 0 && (
                    <>
                      <SectionRow label="Pendapatan Non-Operasional" value={null} indent={1} isSubHeader />
                      {nonOperatingRevItems.map(i => (
                        <SectionRow key={i.accountCode} label={`${i.accountCode} — ${i.accountName}`} value={i.amount !== 0 ? i.amount : null} indent={2} />
                      ))}
                      <SectionRow label="Total Pendapatan Non-Operasional" value={totalNonOperatingRevenue} indent={1} isTotal />
                    </>
                  )}
                  {totalNonOperatingExpense > 0 && (
                    <>
                      <SectionRow label="Beban Non-Operasional & Keuangan" value={null} indent={1} isSubHeader />
                      {nonOperatingExpItems.map(i => (
                        <SectionRow key={i.accountCode} label={`${i.accountCode} — ${i.accountName}`} value={i.amount !== 0 ? i.amount : null} indent={2} />
                      ))}
                      <SectionRow label="Total Beban Non-Operasional" value={totalNonOperatingExpense} indent={1} isTotal />
                    </>
                  )}
                  <SectionRow label="TOTAL NON-OPERASIONAL BERSIH" value={netNonOperating} isTotal />
                </>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-primary-800 text-white border-t-2 border-primary-900">
                <td className="px-4 py-3.5 font-bold text-base">LABA BERSIH SEBELUM PAJAK (NET PROFIT)</td>
                <td className="px-4 py-3.5 text-right font-mono font-extrabold text-lg pr-4">{fmtIDR(netProfit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}
