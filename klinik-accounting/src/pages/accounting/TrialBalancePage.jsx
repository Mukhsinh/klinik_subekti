import { useState, useMemo } from 'react'
import { Download, Printer, RefreshCw } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { useAuth } from '../../store/useAuth'
import { fmtIDR, fmtDate, monthStart, monthEnd, accountTypeLabel, accountTypeBadge } from '../../utils/format'
import { exportTrialBalancePDF } from '../../utils/exportPDF'
import { exportTrialBalanceExcel } from '../../utils/exportExcel'
import Alert from '../../components/ui/Alert'

export default function TrialBalancePage() {
  const { coa, journalEntries, journalItems, branches, activeBranchId, openingBalances } = useStore()
  const { appSettings } = useAuth()
  const [dateFrom, setDateFrom] = useState(monthStart())
  const [dateTo, setDateTo] = useState(monthEnd())
  const [branchFilter, setBranchFilter] = useState(activeBranchId || 'ALL')
  const [hideZero, setHideZero] = useState(true)

  const trialBalance = useMemo(() => {
    const fiscalYear = new Date(dateFrom).getFullYear()

    // Get opening balances for the fiscal year
    const openingBalanceMap = {}
    ;(openingBalances || []).forEach(ob => {
      if (ob && ob.fiscalYear === fiscalYear && (branchFilter === 'ALL' || ob.branchId === branchFilter)) {
        openingBalanceMap[ob.accountCode] = parseFloat(ob.openingBalance || 0)
      }
    })

    const priorPostedIds = new Set(
      (journalEntries || [])
        .filter(j =>
          j &&
          j.status === 'POSTED' &&
          j.transactionDate >= `${fiscalYear}-01-01` &&
          j.transactionDate < dateFrom &&
          (branchFilter === 'ALL' || j.branchId === branchFilter)
        )
        .map(j => j.id)
    )

    const priorBalances = {}
    ;(journalItems || []).forEach(item => {
      if (!item || !priorPostedIds.has(item.journalEntryId)) return
      if (!priorBalances[item.accountCode]) priorBalances[item.accountCode] = { debit: 0, credit: 0 }
      priorBalances[item.accountCode].debit += parseFloat(item.debit || 0)
      priorBalances[item.accountCode].credit += parseFloat(item.credit || 0)
    })

    const postedIds = new Set(
      (journalEntries || [])
        .filter(j =>
          j &&
          j.status === 'POSTED' &&
          j.transactionDate >= dateFrom &&
          j.transactionDate <= dateTo &&
          (branchFilter === 'ALL' || j.branchId === branchFilter)
        )
        .map(j => j.id)
    )

    const balances = {}
    ;(journalItems || []).forEach(item => {
      if (!item || !postedIds.has(item.journalEntryId)) return
      if (!balances[item.accountCode]) balances[item.accountCode] = { totalDebit: 0, totalCredit: 0 }
      balances[item.accountCode].totalDebit += parseFloat(item.debit || 0)
      balances[item.accountCode].totalCredit += parseFloat(item.credit || 0)
    })

    return (coa || [])
      .filter(a => a && !a.isHeader)
      .map(a => {
        const b = balances[a.accountCode] || { totalDebit: 0, totalCredit: 0 }
        const isDebit = (a.naturalBalance || a.normalBalance || (['ASSET', 'EXPENSE'].includes(a.accountType) ? 'DEBIT' : 'CREDIT')) === 'DEBIT'
        const rawOb = openingBalanceMap[a.accountCode] || 0
        const pb = priorBalances[a.accountCode] || { debit: 0, credit: 0 }
        const priorMovement = isDebit ? (pb.debit - pb.credit) : (pb.credit - pb.debit)
        const openingBalance = rawOb + priorMovement

        // Calculate ending balance: opening + period movements
        let endingBalance = openingBalance
        if (isDebit) {
          endingBalance += b.totalDebit - b.totalCredit
        } else {
          endingBalance += b.totalCredit - b.totalDebit
        }

        const finalDebit = (isDebit && endingBalance > 0) ? endingBalance : (!isDebit && endingBalance < 0 ? Math.abs(endingBalance) : 0)
        const finalCredit = (!isDebit && endingBalance > 0) ? endingBalance : (isDebit && endingBalance < 0 ? Math.abs(endingBalance) : 0)

        return {
          ...a,
          ...b,
          openingBalance,
          finalDebit,
          finalCredit
        }
      })
      .filter(a => !hideZero || (a.totalDebit > 0 || a.totalCredit > 0 || a.openingBalance !== 0))
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
  }, [coa, journalEntries, journalItems, dateFrom, dateTo, branchFilter, hideZero, openingBalances])

  const totDebit = trialBalance.reduce((s, a) => s + (a.finalDebit || 0), 0)
  const totCredit = trialBalance.reduce((s, a) => s + (a.finalCredit || 0), 0)
  const isBalanced = Math.abs(totDebit - totCredit) < 0.01
  const selBranch = (branches || []).find(b => b.id === branchFilter)
  const periodLabel = `${fmtDate(dateFrom)} s/d ${fmtDate(dateTo)}`

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Neraca Saldo (Trial Balance)</h1>
          <p className="text-sm text-slate-400 mt-0.5">Rekap saldo semua akun pada periode tertentu</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => exportTrialBalanceExcel(trialBalance, periodLabel, selBranch?.entityName || 'Semua Cabang', appSettings)}>
            <Download className="w-4 h-4" />Excel
          </button>
          <button className="btn-secondary" onClick={() => exportTrialBalancePDF(trialBalance, periodLabel, selBranch?.entityName || 'Semua Cabang', appSettings)}>
            <Printer className="w-4 h-4" />PDF
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card card-body">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="form-label">Dari Tanggal</label>
            <input type="date" className="form-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Sampai Tanggal</label>
            <input type="date" className="form-input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Cabang</label>
            <select className="form-select" value={branchFilter} onChange={e => setBranchFilter(e.target.value)}>
              <option value="ALL">Semua Cabang (Konsolidasi)</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.branchCode} — {b.entityName}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer pb-1">
            <input type="checkbox" checked={hideZero} onChange={e => setHideZero(e.target.checked)} className="w-4 h-4 accent-primary-600" />
            <span className="text-sm text-slate-600">Sembunyikan akun saldo nol</span>
          </label>
        </div>
      </div>

      {/* Balance status */}
      {trialBalance.length > 0 && (
        <Alert
          type={isBalanced ? 'success' : 'error'}
          title={isBalanced ? '✓ Neraca Saldo Balance' : '⚠ Neraca Saldo Tidak Balance'}
          message={isBalanced
            ? `Total Debit = Total Kredit = ${fmtIDR(totDebit)}`
            : `Selisih: ${fmtIDR(Math.abs(totDebit - totCredit))} — Periksa jurnal yang belum diposting atau ada entri yang tidak tepat.`
          }
        />
      )}

      {/* Summary cards */}
      {trialBalance.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'].slice(0, 4).map(type => {
            const typeRows = trialBalance.filter(a => a.accountType === type)
            const total = typeRows.reduce((s, a) => s + (a.naturalBalance === 'DEBIT' ? a.finalDebit : a.finalCredit), 0)
            return (
              <div key={type} className="card card-body">
                <p className="text-xs text-slate-400 uppercase mb-1">{accountTypeLabel(type)}</p>
                <p className="font-mono font-bold text-slate-800">{fmtIDR(total)}</p>
                <p className="text-xs text-slate-400 mt-0.5">{typeRows.length} akun</p>
              </div>
            )
          })}
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <span className="section-title">Neraca Saldo</span>
          <span className="text-xs text-slate-400">{periodLabel} · {branchFilter === 'ALL' ? 'Semua Cabang' : selBranch?.branchCode} · {trialBalance.length} akun</span>
        </div>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th style={{ width: 120 }}>Kode Akun</th>
                <th>Nama Akun</th>
                <th>Tipe</th>
                <th className="text-right">Saldo Awal</th>
                <th className="text-right">Total Debit</th>
                <th className="text-right">Total Kredit</th>
                <th className="text-right">Saldo Debit</th>
                <th className="text-right">Saldo Kredit</th>
              </tr>
            </thead>
            <tbody>
              {trialBalance.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-slate-400">
                  <RefreshCw className="w-6 h-6 mx-auto mb-2 opacity-40" />
                  Belum ada transaksi diposting pada periode ini
                </td></tr>
              ) : trialBalance.map(a => (
                <tr key={a.accountCode}>
                  <td className="font-mono text-xs text-primary-700 font-medium">{a.accountCode}</td>
                  <td className="text-sm">{a.accountName}</td>
                  <td><span className={`badge text-xs ${accountTypeBadge(a.accountType)}`}>{accountTypeLabel(a.accountType)}</span></td>
                  <td className="text-right font-mono text-xs text-blue-700 font-semibold">{a.openingBalance !== 0 ? fmtIDR(Math.abs(a.openingBalance)) : ''}</td>
                  <td className="text-right font-mono text-xs amount-debit">{a.totalDebit > 0 ? fmtIDR(a.totalDebit) : ''}</td>
                  <td className="text-right font-mono text-xs amount-credit">{a.totalCredit > 0 ? fmtIDR(a.totalCredit) : ''}</td>
                  <td className="text-right font-mono text-xs amount-debit">{a.finalDebit > 0 ? fmtIDR(a.finalDebit) : ''}</td>
                  <td className="text-right font-mono text-xs amount-credit">{a.finalCredit > 0 ? fmtIDR(a.finalCredit) : ''}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 font-bold border-t-2 border-slate-300">
                <td colSpan={3} className="text-right py-3 pr-4">GRAND TOTAL</td>
                <td className="text-right font-mono text-blue-700 py-3">{fmtIDR(trialBalance.reduce((s, a) => s + Math.abs(a.openingBalance || 0), 0))}</td>
                <td className="text-right font-mono amount-debit py-3">{fmtIDR(trialBalance.reduce((s, a) => s + (a.totalDebit || 0), 0))}</td>
                <td className="text-right font-mono amount-credit py-3">{fmtIDR(trialBalance.reduce((s, a) => s + (a.totalCredit || 0), 0))}</td>
                <td className="text-right font-mono amount-debit py-3">{fmtIDR(totDebit)}</td>
                <td className="text-right font-mono amount-credit py-3">{fmtIDR(totCredit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}
