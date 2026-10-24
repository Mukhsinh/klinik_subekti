import { useState, useMemo } from 'react'
import { Download, ArrowRightLeft, FileSpreadsheet } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { useAuth } from '../../store/useAuth'
import { fmtIDR, fmtDate, monthStart, monthEnd } from '../../utils/format'
import { exportCashFlowPDF } from '../../utils/exportPDF'
import { exportCashFlowExcel } from '../../utils/exportExcel'
import { getEffectiveCashFlowMappings } from '../../utils/accountMapping'

export default function CashFlowPage() {
  const { coa, journalEntries, journalItems, branches, activeBranchId, openingBalances } = useStore()
  const { appSettings } = useAuth()
  const currentYear = new Date().getFullYear()
  const [dateFrom, setDateFrom] = useState(`${currentYear}-01-01`)
  const [dateTo, setDateTo] = useState(`${currentYear}-12-31`)
  const [branchFilter, setBranchFilter] = useState('ALL')

  // Dynamic cash flow mappings from database settings
  const effectiveCashFlow = useMemo(() => getEffectiveCashFlowMappings(appSettings), [appSettings])

  // Kas & Setara Kas (1-11-xxx atau grup Kas)
  const operatingCashCodes = useMemo(() => {
    const fromCOA = coa
      .filter(a => a.accountType === 'ASSET' && (a.accountCode.startsWith('1-11') || (a.accountSubgroup || '').toLowerCase().includes('kas')))
      .map(a => a.accountCode)
    return fromCOA.length > 0 ? fromCOA : ['1-11-001', '1-11-002', '1-11-003', '1-11-004', '1-11-005']
  }, [coa])

  // Akun Aktivitas Investasi dari mapping aktif
  const investingCodes = useMemo(() => {
    const list = Object.values(effectiveCashFlow)
      .filter(m => m.section === 'INVESTASI')
      .map(m => m.accountCode)
    return list.length > 0 ? [...new Set(list)] : ['1-21-001', '1-21-002', '1-21-003', '1-21-004', '1-21-005', '1-21-006', '1-21-007']
  }, [effectiveCashFlow])

  // Akun Aktivitas Pendanaan dari mapping aktif
  const financingCodes = useMemo(() => {
    const list = Object.values(effectiveCashFlow)
      .filter(m => m.section === 'PENDANAAN')
      .map(m => m.accountCode)
    return list.length > 0 ? [...new Set(list)] : ['2-21-001', '2-21-002', '3-11-001', '3-11-002', '3-13-001']
  }, [effectiveCashFlow])

  const postedItems = useMemo(() => {
    const ids = new Set(
      journalEntries
        .filter(j => j.status === 'POSTED' && j.transactionDate >= dateFrom && j.transactionDate <= dateTo && (branchFilter === 'ALL' || !j.branchId || j.branchId === branchFilter))
        .map(j => j.id)
    )
    return journalItems.filter(i => ids.has(i.journalEntryId))
  }, [journalEntries, journalItems, dateFrom, dateTo, branchFilter])

  const getNetFlow = (codes) =>
    postedItems
      .filter(i => codes.includes(i.accountCode))
      .reduce((s, i) => {
        const acc = coa.find(a => a.accountCode === i.accountCode)
        if (!acc) return s
        const d = parseFloat(i.debit || 0)
        const c = parseFloat(i.credit || 0)
        return s + (acc.naturalBalance === 'DEBIT' ? d - c : c - d)
      }, 0)

  // Revenues and expenses for indirect method
  const revenueItems = postedItems.filter(i => {
    const acc = coa.find(a => a.accountCode === i.accountCode)
    return acc?.accountType === 'REVENUE'
  })
  const expenseItems = postedItems.filter(i => {
    const acc = coa.find(a => a.accountCode === i.accountCode)
    return acc?.accountType === 'EXPENSE'
  })

  const totalRevenue = revenueItems.reduce((s, i) => s + parseFloat(i.credit || 0), 0)
  const totalExpense = expenseItems.reduce((s, i) => s + parseFloat(i.debit || 0), 0)
  const netProfit = totalRevenue - totalExpense

  // Non-cash adjustments: depreciation
  const depreciationItems = postedItems.filter(i => i.accountCode?.startsWith('6-15'))
  const totalDepreciation = depreciationItems.reduce((s, i) => s + parseFloat(i.debit || 0), 0)

  // Changes in working capital (simplified)
  const receivableChange = postedItems.filter(i => i.accountCode?.startsWith('1-12'))
    .reduce((s, i) => s + parseFloat(i.debit || 0) - parseFloat(i.credit || 0), 0)
  const inventoryChange = postedItems.filter(i => i.accountCode?.startsWith('1-13'))
    .reduce((s, i) => s + parseFloat(i.debit || 0) - parseFloat(i.credit || 0), 0)
  const payableChange = postedItems.filter(i => i.accountCode?.startsWith('2-11'))
    .reduce((s, i) => s + parseFloat(i.credit || 0) - parseFloat(i.debit || 0), 0)
  const taxPayableChange = postedItems.filter(i => i.accountCode?.startsWith('2-13'))
    .reduce((s, i) => s + parseFloat(i.credit || 0) - parseFloat(i.debit || 0), 0)

  const operatingCF = netProfit + totalDepreciation - receivableChange - inventoryChange + payableChange + taxPayableChange
  const investingCF = -getNetFlow(investingCodes)
  const financingCF = getNetFlow(financingCodes)
  const netCashFlow = operatingCF + investingCF + financingCF

  // Get opening cash balance (sum of all cash accounts' opening balances + prior cash movements)
  const fiscalYear = new Date(dateFrom).getFullYear()
  const rawOpeningCash = operatingCashCodes.reduce((sum, code) => {
    const ob = openingBalances.find(
      o => o.accountCode === code &&
        o.fiscalYear === fiscalYear &&
        (branchFilter === 'ALL' || !o.branchId || o.branchId === branchFilter)
    )
    return sum + parseFloat(ob?.openingBalance || 0)
  }, 0)

  const priorCashMovements = useMemo(() => {
    const priorIds = new Set(
      journalEntries
        .filter(j => j.status === 'POSTED' && j.transactionDate >= `${fiscalYear}-01-01` && j.transactionDate < dateFrom && (branchFilter === 'ALL' || !j.branchId || j.branchId === branchFilter))
        .map(j => j.id)
    )
    return journalItems
      .filter(i => priorIds.has(i.journalEntryId) && operatingCashCodes.includes(i.accountCode))
      .reduce((s, i) => s + (parseFloat(i.debit || 0) - parseFloat(i.credit || 0)), 0)
  }, [journalEntries, journalItems, dateFrom, fiscalYear, branchFilter, operatingCashCodes])

  const openingCashBalance = rawOpeningCash + priorCashMovements
  const endingCashBalance = openingCashBalance + netCashFlow

  const periodLabel = `${fmtDate(dateFrom)} s/d ${fmtDate(dateTo)}`
  const branchName = appSettings?.companyName || 'Klinik Subekti'

  const cashFlowData = {
    netProfit,
    totalDepreciation,
    receivableChange,
    inventoryChange,
    payableChange,
    taxPayableChange,
    operatingCF,
    investingCF,
    financingCF,
    netCashFlow,
    openingCashBalance,
    endingCashBalance,
  }

  const handleExportPDF = () => {
    exportCashFlowPDF(cashFlowData, periodLabel, branchName, appSettings)
  }

  const handleExportExcel = () => {
    exportCashFlowExcel(cashFlowData, periodLabel, branchName, appSettings)
  }

  function Row({ label, value, indent = 0, isSection = false, isTotal = false, sign = 1 }) {
    const display = value !== undefined && value !== null ? (sign < 0 ? -value : value) : null
    return (
      <tr className={isTotal ? 'bg-slate-50 font-semibold border-t border-slate-200' : isSection ? 'bg-slate-700' : ''}>
        <td className={`py-2 text-sm ${indent === 1 ? 'pl-8' : indent === 2 ? 'pl-14' : 'pl-4'} ${isSection ? 'text-white font-semibold' : ''}`}>{label}</td>
        <td className={`text-right py-2 font-mono text-sm pr-4 ${isSection ? 'text-white' : display !== null && display < 0 ? 'text-red-600' : display !== null && display > 0 ? 'text-emerald-700' : ''}`}>
          {display !== null && display !== undefined ? fmtIDR(display) : ''}
        </td>
      </tr>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Laporan Arus Kas</h1>
          <p className="text-sm text-slate-400 mt-0.5">Statement of Cash Flows — Metode Tidak Langsung (PSAK 2)</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportPDF}
            className="btn-danger-red flex items-center gap-1.5 shadow-sm"
            title="Unduh Laporan Arus Kas format PDF Resmi"
          >
            <Download className="w-4 h-4" />
            <span>Unduh PDF</span>
          </button>
          <button
            onClick={handleExportExcel}
            className="btn-success flex items-center gap-1.5 shadow-sm"
            title="Unduh Laporan Arus Kas format Microsoft Excel"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Unduh Excel</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card card-body">
        <div className="flex flex-wrap gap-4 items-end">
          <div><label className="form-label">Dari Tanggal</label><input type="date" className="form-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></div>
          <div><label className="form-label">Sampai Tanggal</label><input type="date" className="form-input" value={dateTo} onChange={e => setDateTo(e.target.value)} /></div>
        </div>
      </div>

      {/* Summary KPIs with Bright Solid Theme */}
      <div className="grid grid-cols-3 gap-4">
        <div className={`card card-body border-0 shadow-sm text-white ${operatingCF >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}>
          <p className="text-xs text-white/90 uppercase tracking-wider font-semibold mb-1">Arus Kas Operasi</p>
          <p className="font-mono font-extrabold text-white text-2xl">{fmtIDR(operatingCF)}</p>
        </div>
        <div className={`card card-body border-0 shadow-sm text-white ${investingCF >= 0 ? 'bg-blue-500' : 'bg-amber-500'}`}>
          <p className="text-xs text-white/90 uppercase tracking-wider font-semibold mb-1">Arus Kas Investasi</p>
          <p className="font-mono font-extrabold text-white text-2xl">{fmtIDR(investingCF)}</p>
        </div>
        <div className={`card card-body border-0 shadow-sm text-white ${netCashFlow >= 0 ? 'bg-purple-500' : 'bg-rose-500'}`}>
          <p className="text-xs text-white/90 uppercase tracking-wider font-semibold mb-1">Kenaikan / Penurunan Kas Bersih</p>
          <p className="font-mono font-extrabold text-white text-2xl">{fmtIDR(netCashFlow)}</p>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="section-title">Laporan Arus Kas</span>
          <span className="text-xs text-slate-400">{periodLabel} · {branchName} · Metode Tidak Langsung</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-primary-700 text-white">
                <th className="px-4 py-3 text-left">Keterangan</th>
                <th className="px-4 py-3 text-right pr-4">Jumlah</th>
              </tr>
            </thead>
            <tbody>
              <Row label="I. ARUS KAS DARI AKTIVITAS OPERASI" isSection />
              <Row label="Laba Bersih Sebelum Pajak" value={netProfit} indent={1} />
              <Row label="Penyesuaian:" indent={1} />
              <Row label="Penambahan Beban Penyusutan" value={totalDepreciation} indent={2} />
              <Row label="Perubahan Modal Kerja:" indent={1} />
              <Row label="(Kenaikan)/Penurunan Piutang Usaha" value={-receivableChange} indent={2} />
              <Row label="(Kenaikan)/Penurunan Persediaan" value={-inventoryChange} indent={2} />
              <Row label="Kenaikan/(Penurunan) Utang Usaha" value={payableChange} indent={2} />
              <Row label="Kenaikan/(Penurunan) Utang Pajak" value={taxPayableChange} indent={2} />
              <Row label="JUMLAH ARUS KAS OPERASI" value={operatingCF} isTotal />

              <tr><td colSpan={2} className="py-2" /></tr>
              <Row label="II. ARUS KAS DARI AKTIVITAS INVESTASI" isSection />
              <Row label="Perolehan Aset Tetap" value={-investingCF} indent={1} sign={-1} />
              <Row label="JUMLAH ARUS KAS INVESTASI" value={investingCF} isTotal />

              <tr><td colSpan={2} className="py-2" /></tr>
              <Row label="III. ARUS KAS DARI AKTIVITAS PENDANAAN" isSection />
              <Row label="Penambahan/(Pembayaran) Utang Bank" value={financingCF} indent={1} />
              <Row label="JUMLAH ARUS KAS PENDANAAN" value={financingCF} isTotal />
            </tbody>
            <tfoot>
              <tr className={`${netCashFlow >= 0 ? 'bg-emerald-700' : 'bg-red-700'} text-white`}>
                <td className="px-4 py-3 font-bold">KENAIKAN / (PENURUNAN) KAS BERSIH</td>
                <td className="px-4 py-3 text-right font-mono font-bold pr-4">{fmtIDR(netCashFlow)}</td>
              </tr>
              <tr className="bg-blue-50 border-t-2 border-blue-200">
                <td className="px-4 py-2.5 font-semibold text-blue-800">SALDO KAS AWAL PERIODE</td>
                <td className="px-4 py-2.5 text-right font-mono font-semibold pr-4 text-blue-800">{fmtIDR(openingCashBalance)}</td>
              </tr>
              <tr className="bg-primary-700 text-white">
                <td className="px-4 py-3 font-bold text-lg">SALDO KAS AKHIR PERIODE</td>
                <td className="px-4 py-3 text-right font-mono font-bold pr-4 text-lg">{fmtIDR(endingCashBalance)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="card-body border-t border-slate-100">
          <p className="text-xs text-slate-400">
            * Laporan arus kas menggunakan metode tidak langsung (indirect method) sesuai PSAK 2.
            Angka berdasarkan entri jurnal yang telah diposting pada periode yang dipilih.
          </p>
        </div>
      </div>
    </div>
  )
}
