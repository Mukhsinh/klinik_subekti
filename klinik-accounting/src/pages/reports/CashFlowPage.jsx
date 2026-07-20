import { useState, useMemo } from 'react'
import { Download, ArrowRightLeft } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { fmtIDR, fmtDate, monthStart, monthEnd } from '../../utils/format'

// Simplified indirect method cash flow
const OPERATING_CASH_CODES = [
  '1-11-001','1-11-002','1-11-003','1-11-004','1-11-005', // Cash accounts
]
const INVESTING_CODES = ['1-21-001','1-21-002','1-21-003','1-21-004','1-21-005','1-21-006','1-21-007']
const FINANCING_CODES = ['2-21-001','2-21-002','3-11-001','3-11-002','3-13-001']

export default function CashFlowPage() {
  const { coa, journalEntries, journalItems, branches, activeBranchId, openingBalances } = useStore()
  const [dateFrom, setDateFrom] = useState(monthStart())
  const [dateTo,   setDateTo]   = useState(monthEnd())
  const [branchFilter, setBranchFilter] = useState(activeBranchId || 'ALL')

  const postedItems = useMemo(() => {
    const ids = new Set(
      journalEntries
        .filter(j => j.status === 'POSTED' && j.transactionDate >= dateFrom && j.transactionDate <= dateTo && (branchFilter === 'ALL' || j.branchId === branchFilter))
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
  const totalExpense = expenseItems.reduce((s, i) => s + parseFloat(i.debit  || 0), 0)
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
  const investingCF = -getNetFlow(INVESTING_CODES)
  const financingCF = getNetFlow(FINANCING_CODES)
  const netCashFlow = operatingCF + investingCF + financingCF

  // Get opening cash balance (sum of all cash accounts' opening balances)
  const fiscalYear = new Date(dateFrom).getFullYear()
  const openingCashBalance = OPERATING_CASH_CODES.reduce((sum, code) => {
    const ob = openingBalances.find(
      o => o.accountCode === code && 
           o.fiscalYear === fiscalYear &&
           (branchFilter === 'ALL' || o.branchId === branchFilter)
    )
    return sum + parseFloat(ob?.openingBalance || 0)
  }, 0)

  const endingCashBalance = openingCashBalance + netCashFlow

  const periodLabel = `${fmtDate(dateFrom)} s/d ${fmtDate(dateTo)}`
  const branchName = branches.find(b => b.id === branchFilter)?.entityName || 'Semua Cabang'

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

      {/* Summary KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className={`card card-body border-0 ${operatingCF >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
          <p className="text-xs text-slate-500 uppercase mb-1">Arus Kas Operasi</p>
          <p className={`font-mono font-bold text-lg ${operatingCF >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{fmtIDR(operatingCF)}</p>
        </div>
        <div className={`card card-body border-0 ${investingCF >= 0 ? 'bg-blue-50' : 'bg-amber-50'}`}>
          <p className="text-xs text-slate-500 uppercase mb-1">Arus Kas Investasi</p>
          <p className={`font-mono font-bold text-lg ${investingCF >= 0 ? 'text-blue-700' : 'text-amber-700'}`}>{fmtIDR(investingCF)}</p>
        </div>
        <div className={`card card-body border-0 ${netCashFlow >= 0 ? 'bg-teal-50' : 'bg-red-50'}`}>
          <p className="text-xs text-slate-500 uppercase mb-1">Kenaikan / Penurunan Kas Bersih</p>
          <p className={`font-mono font-bold text-lg ${netCashFlow >= 0 ? 'text-teal-700' : 'text-red-700'}`}>{fmtIDR(netCashFlow)}</p>
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
                <th className="px-4 py-3 text-right pr-4">Jumlah (Rp)</th>
              </tr>
            </thead>
            <tbody>
              <Row label="I. ARUS KAS DARI AKTIVITAS OPERASI" isSection />
              <Row label="Laba Bersih Sebelum Pajak"           value={netProfit}           indent={1} />
              <Row label="Penyesuaian:" indent={1} />
              <Row label="Penambahan Beban Penyusutan"         value={totalDepreciation}   indent={2} />
              <Row label="Perubahan Modal Kerja:" indent={1} />
              <Row label="(Kenaikan)/Penurunan Piutang Usaha"  value={-receivableChange}   indent={2} />
              <Row label="(Kenaikan)/Penurunan Persediaan"     value={-inventoryChange}    indent={2} />
              <Row label="Kenaikan/(Penurunan) Utang Usaha"    value={payableChange}       indent={2} />
              <Row label="Kenaikan/(Penurunan) Utang Pajak"    value={taxPayableChange}    indent={2} />
              <Row label="JUMLAH ARUS KAS OPERASI"             value={operatingCF}         isTotal />

              <tr><td colSpan={2} className="py-2" /></tr>
              <Row label="II. ARUS KAS DARI AKTIVITAS INVESTASI" isSection />
              <Row label="Perolehan Aset Tetap"                value={-investingCF}        indent={1} sign={-1} />
              <Row label="JUMLAH ARUS KAS INVESTASI"           value={investingCF}         isTotal />

              <tr><td colSpan={2} className="py-2" /></tr>
              <Row label="III. ARUS KAS DARI AKTIVITAS PENDANAAN" isSection />
              <Row label="Penambahan/(Pembayaran) Utang Bank"  value={financingCF}         indent={1} />
              <Row label="JUMLAH ARUS KAS PENDANAAN"           value={financingCF}         isTotal />
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
