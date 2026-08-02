import { useState, useMemo, Fragment } from 'react'
import { Download, Printer, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { useAuth } from '../../store/useAuth'
import { fmtIDR, fmtDate, monthStart, monthEnd, fmtPct } from '../../utils/format'
import { exportEquityChangesPDF } from '../../utils/exportPDF'
import { exportEquityChangesExcel } from '../../utils/exportExcel'

function buildEquityData(coa, journalEntries, journalItems, dateFrom, dateTo, branchFilter) {
    // Filter posted journals within period
    const postedJournalsInPeriod = journalEntries.filter(j =>
        j.status === 'POSTED' &&
        j.transactionDate >= dateFrom &&
        j.transactionDate <= dateTo &&
        (branchFilter === 'ALL' || j.branchId === branchFilter)
    )
    const periodJournalIds = new Set(postedJournalsInPeriod.map(j => j.id))

    // Filter posted journals PRIOR to period (for Saldo Awal calculation)
    const postedJournalsPrior = journalEntries.filter(j =>
        j.status === 'POSTED' &&
        j.transactionDate < dateFrom &&
        (branchFilter === 'ALL' || j.branchId === branchFilter)
    )
    const priorJournalIds = new Set(postedJournalsPrior.map(j => j.id))

    // 1. Calculate Beginning Equity (Saldo Modal Awal sebelum dateFrom)
    let openingCapital = 0
    let openingRetainedEarnings = 0

    journalItems.forEach(item => {
        const acc = coa.find(a => a.accountCode === item.accountCode)
        if (!acc) return
        const d = parseFloat(item.debit || 0)
        const c = parseFloat(item.credit || 0)

        if (priorJournalIds.has(item.journalEntryId)) {
            // Prior equity accounts
            if (acc.accountType === 'EQUITY') {
                const netChange = acc.naturalBalance === 'CREDIT' ? (c - d) : (d - c)
                if (acc.accountGroup === 'MODAL' || acc.accountCode.startsWith('3-11')) {
                    openingCapital += netChange
                } else if (acc.accountGroup === 'LABA DITAHAN' || acc.accountCode.startsWith('3-2')) {
                    openingRetainedEarnings += netChange
                }
            }
            // Prior Revenues & Expenses flow into Retained Earnings
            if (acc.accountType === 'REVENUE') {
                openingRetainedEarnings += (c - d)
            } else if (acc.accountType === 'EXPENSE') {
                openingRetainedEarnings -= (d - c)
            }
        }
    })

    // Total Beginning Equity
    const totalBeginningEquity = openingCapital + openingRetainedEarnings

    // 2. Period Calculations (dateFrom to dateTo)
    let periodRevenues = 0
    let periodExpenses = 0
    let periodCapitalAdditions = 0
    let periodPrive = 0

    journalItems.forEach(item => {
        if (!periodJournalIds.has(item.journalEntryId)) return
        const acc = coa.find(a => a.accountCode === item.accountCode)
        if (!acc) return
        const d = parseFloat(item.debit || 0)
        const c = parseFloat(item.credit || 0)

        if (acc.accountType === 'REVENUE') {
            periodRevenues += (c - d)
        } else if (acc.accountType === 'EXPENSE') {
            periodExpenses += (d - c)
        } else if (acc.accountType === 'EQUITY') {
            if (acc.accountCode.startsWith('3-12') || acc.accountGroup === 'PRIVE' || acc.naturalBalance === 'DEBIT') {
                periodPrive += (d - c)
            } else if (acc.accountCode.startsWith('3-11') || acc.accountGroup === 'MODAL') {
                periodCapitalAdditions += (c - d)
            }
        }
    })

    // Net Income for period
    const netIncome = periodRevenues - periodExpenses

    // Ending Equity
    const endingEquity = totalBeginningEquity + periodCapitalAdditions + netIncome - periodPrive

    return {
        openingCapital,
        openingRetainedEarnings,
        totalBeginningEquity,
        periodCapitalAdditions,
        netIncome,
        periodPrive,
        endingEquity,
        periodRevenues,
        periodExpenses
    }
}

export default function EquityChangesPage() {
    const { coa, journalEntries, journalItems, branches, activeBranchId } = useStore()
    const { appSettings } = useAuth()

    const [dateFrom, setDateFrom] = useState(monthStart())
    const [dateTo, setDateTo] = useState(monthEnd())
    const [branchFilter, setBranchFilter] = useState(activeBranchId || 'ALL')

    const equityData = useMemo(() =>
        buildEquityData(coa, journalEntries, journalItems, dateFrom, dateTo, branchFilter),
        [coa, journalEntries, journalItems, dateFrom, dateTo, branchFilter]
    )

    const periodLabel = `${fmtDate(dateFrom)} s/d ${fmtDate(dateTo)}`
    const branchName = branches.find(b => b.id === branchFilter)?.entityName || 'Semua Cabang'

    // Structured rows for report export & table display
    const reportRows = useMemo(() => [
        { isHeader: true, description: '1. SALDO EKUITAS AWAL PERIODE' },
        { accountCode: '3-11-001', description: 'Modal Disetor (Awal)', amount: equityData.openingCapital },
        { accountCode: '3-21-001', description: 'Saldo Laba Ditahan (Awal)', amount: equityData.openingRetainedEarnings },
        { isTotal: true, description: 'TOTAL EKUITAS AWAL', amount: equityData.totalBeginningEquity },

        { isHeader: true, description: '2. MUTASI & PERUBAHAN EKUITAS PERIODE BERJALAN' },
        { accountCode: '3-11-002', description: 'Tambahan Setoran Modal', amount: equityData.periodCapitalAdditions },
        { accountCode: '4/5/6', description: 'Laba Bersih Periode Berjalan (dari Laporan Laba Rugi)', amount: equityData.netIncome },
        { accountCode: '3-12-001', description: 'Prive / Pengambilan Pemilik', amount: equityData.periodPrive > 0 ? -equityData.periodPrive : 0 },
        { isTotal: true, description: 'TOTAL MUTASI EKUITAS', amount: (equityData.periodCapitalAdditions + equityData.netIncome - equityData.periodPrive) },

        { isHeader: true, description: '3. SALDO EKUITAS AKHIR PERIODE' },
        { isTotal: true, isGrandTotal: true, description: 'TOTAL EKUITAS AKHIR (MODAL AKHIR)', amount: equityData.endingEquity },
    ], [equityData])

    return (
        <div className="space-y-5">
            {/* ── Header ──────────────────────────────────────────── */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="page-title">Laporan Perubahan Ekuitas</h1>
                    <p className="text-sm text-slate-400 mt-0.5">Statement of Changes in Equity — SAK EMKM / SAK EP</p>
                </div>
                <div className="flex gap-2">
                    <button className="btn-secondary" onClick={() => exportEquityChangesExcel(reportRows, periodLabel, branchName, appSettings)}>
                        <Download className="w-4 h-4" />Excel
                    </button>
                    <button className="btn-secondary" onClick={() => exportEquityChangesPDF(reportRows, periodLabel, branchName, appSettings)}>
                        <Printer className="w-4 h-4" />PDF
                    </button>
                </div>
            </div>

            {/* ── Filters ─────────────────────────────────────────── */}
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

            {/* ── Bright Solid KPI Cards ───────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="card card-body bg-slate-700 text-white border-0 shadow-sm">
                    <p className="text-xs text-slate-200 uppercase tracking-wider font-semibold mb-1">Ekuitas Awal</p>
                    <p className="font-mono font-extrabold text-white text-2xl">{fmtIDR(equityData.totalBeginningEquity)}</p>
                    <p className="text-xs text-slate-300 mt-1">Modal Awal + Laba Ditahan</p>
                </div>
                <div className={`card card-body border-0 shadow-sm text-white ${equityData.netIncome >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                    <p className="text-xs text-emerald-100 uppercase tracking-wider font-semibold mb-1">Laba Bersih Periode</p>
                    <p className="font-mono font-extrabold text-white text-2xl">{fmtIDR(equityData.netIncome)}</p>
                    <p className="text-xs text-emerald-100 mt-1">Artikulasi Laba Rugi Realtime</p>
                </div>
                <div className="card card-body bg-amber-500 text-white border-0 shadow-sm">
                    <p className="text-xs text-amber-100 uppercase tracking-wider font-semibold mb-1">Prive & Mutasi Modal</p>
                    <p className="font-mono font-extrabold text-white text-2xl">{fmtIDR(equityData.periodCapitalAdditions - equityData.periodPrive)}</p>
                    <p className="text-xs text-amber-100 mt-1">Setoran: {fmtIDR(equityData.periodCapitalAdditions)} | Prive: {fmtIDR(equityData.periodPrive)}</p>
                </div>
                <div className="card card-body bg-primary-600 text-white border-0 shadow-sm">
                    <p className="text-xs text-primary-100 uppercase tracking-wider font-semibold mb-1">Ekuitas Akhir</p>
                    <p className="font-mono font-extrabold text-white text-2xl">{fmtIDR(equityData.endingEquity)}</p>
                    <p className="text-xs text-primary-100 mt-1">Sinkron dengan Neraca (Balance Sheet)</p>
                </div>
            </div>

            {/* ── Main Report Table ────────────────────────────────── */}
            <div className="card overflow-hidden">
                <div className="card-header flex justify-between items-center bg-slate-50 border-b border-slate-200 py-3 px-5">
                    <div>
                        <span className="section-title text-base font-bold text-slate-800">Laporan Perubahan Ekuitas</span>
                        <span className="text-xs text-slate-500 ml-3">{periodLabel} · {branchName}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg font-medium border border-emerald-200">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Terartikulasi SAK EMKM / EP
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-primary-700 text-white">
                                <th className="px-5 py-3 text-left font-semibold w-36">Kode Akun</th>
                                <th className="px-5 py-3 text-left font-semibold">Keterangan komponen Ekuitas</th>
                                <th className="px-5 py-3 text-right font-semibold pr-6">Jumlah</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {reportRows.map((row, idx) => {
                                if (row.isHeader) {
                                    return (
                                        <tr key={`hdr-${idx}`} className="bg-slate-100/80 font-bold text-slate-700">
                                            <td colSpan={3} className="px-5 py-2.5 text-xs uppercase tracking-wider text-primary-800">
                                                {row.description}
                                            </td>
                                        </tr>
                                    )
                                }
                                if (row.isGrandTotal) {
                                    return (
                                        <tr key={`gt-${idx}`} className="bg-primary-50 border-t-2 border-primary-400 font-bold">
                                            <td className="px-5 py-3.5 font-mono text-primary-700">EKUITAS AKHIR</td>
                                            <td className="px-5 py-3.5 text-slate-900 text-base">{row.description}</td>
                                            <td className="px-5 py-3.5 text-right font-mono text-primary-800 font-extrabold text-lg pr-6">
                                                {fmtIDR(row.amount)}
                                            </td>
                                        </tr>
                                    )
                                }
                                if (row.isTotal) {
                                    return (
                                        <tr key={`tot-${idx}`} className="bg-slate-50 font-semibold border-t border-slate-200">
                                            <td className="px-5 py-2.5"></td>
                                            <td className="px-5 py-2.5 text-slate-800">{row.description}</td>
                                            <td className="px-5 py-2.5 text-right font-mono font-bold text-slate-900 pr-6">
                                                {fmtIDR(row.amount)}
                                            </td>
                                        </tr>
                                    )
                                }
                                return (
                                    <tr key={`row-${idx}`} className="hover:bg-slate-50/50">
                                        <td className="px-5 py-2 font-mono text-xs text-slate-500">{row.accountCode}</td>
                                        <td className="px-5 py-2 text-slate-700 pl-8">{row.description}</td>
                                        <td className="px-5 py-2 text-right font-mono text-slate-900 pr-6">
                                            {fmtIDR(row.amount)}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                        <tfoot>
                            <tr className="bg-primary-800 text-white">
                                <td colSpan={2} className="px-5 py-3 font-bold">SALDO AKHIR EKUITAS (SIAP PINDAH KE NERACA)</td>
                                <td className="px-5 py-3 text-right font-mono font-extrabold text-base pr-6">{fmtIDR(equityData.endingEquity)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    )
}
