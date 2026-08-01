import { useState, useMemo } from 'react'
import { Download, Printer, Filter } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { useAuth } from '../../store/useAuth'
import SearchableSelect from '../../components/ui/SearchableSelect'
import { fmtIDR, fmtDate, calcBalance, monthStart, monthEnd } from '../../utils/format'
import { exportLedgerPDF } from '../../utils/exportPDF'
import { exportLedgerExcel } from '../../utils/exportExcel'

export default function LedgerPage() {
  const { coa, journalEntries, journalItems, activeBranchId, openingBalances } = useStore()
  const { appSettings } = useAuth()

  const [selectedCode, setSelectedCode] = useState('')
  const [dateFrom, setDateFrom] = useState(monthStart())
  const [dateTo, setDateTo] = useState(monthEnd())

  const activeCoa = useMemo(() => coa.filter(a => a.isActive && !a.isHeader).sort((a, b) => a.sortOrder - b.sortOrder), [coa])
  const selectedAccount = useMemo(() => coa.find(a => a.accountCode === selectedCode), [coa, selectedCode])

  const accountOptions = useMemo(() =>
    activeCoa.map(a => ({ value: a.accountCode, label: `${a.accountCode} — ${a.accountName}` })),
    [activeCoa]
  )

  // Build ledger entries with running balance
  const ledgerEntries = useMemo(() => {
    if (!selectedCode) return []

    // Get opening balance for the selected account
    const fiscalYear = new Date(dateFrom).getFullYear()
    const openingBalance = openingBalances.find(
      ob => ob.accountCode === selectedCode &&
        ob.fiscalYear === fiscalYear &&
        (activeBranchId ? ob.branchId === activeBranchId : true)
    )

    const relevantEntries = journalEntries.filter(j =>
      j.status === 'POSTED' &&
      j.transactionDate >= dateFrom &&
      j.transactionDate <= dateTo &&
      (activeBranchId ? j.branchId === activeBranchId : true)
    )
    const entryMap = Object.fromEntries(relevantEntries.map(j => [j.id, j]))

    const lines = journalItems
      .filter(i => i.accountCode === selectedCode && entryMap[i.journalEntryId])
      .map(i => ({
        ...i,
        transactionDate: entryMap[i.journalEntryId].transactionDate,
        entryNumber: entryMap[i.journalEntryId].entryNumber,
        description: entryMap[i.journalEntryId].description,
        entryType: entryMap[i.journalEntryId].entryType,
        debit: parseFloat(i.debit || 0),
        credit: parseFloat(i.credit || 0),
      }))
      .sort((a, b) => a.transactionDate.localeCompare(b.transactionDate) || a.entryNumber.localeCompare(b.entryNumber))

    // Add opening balance as first entry if exists
    const allLines = []
    let balance = 0

    if (openingBalance && parseFloat(openingBalance.openingBalance || 0) !== 0) {
      const obAmount = parseFloat(openingBalance.openingBalance || 0)
      const isDebitNormal = selectedAccount?.normalBalance === 'DEBIT'

      // Opening balance entry
      const openingEntry = {
        id: `opening-${selectedCode}`,
        transactionDate: openingBalance.openingDate || dateFrom,
        entryNumber: 'SALDO AWAL',
        description: openingBalance.description || `Saldo Awal Tahun ${fiscalYear}`,
        entryType: 'OPENING_BALANCE',
        debit: isDebitNormal ? obAmount : 0,
        credit: isDebitNormal ? 0 : obAmount,
        runningBalance: obAmount,
        balanceSide: selectedAccount?.normalBalance || 'DEBIT',
        isOpeningBalance: true,
      }

      balance = obAmount
      allLines.push(openingEntry)
    }

    // Running balance for transaction lines
    lines.forEach(line => {
      if (selectedAccount?.normalBalance === 'DEBIT') {
        balance += line.debit - line.credit
      } else {
        balance += line.credit - line.debit
      }
      allLines.push({
        ...line,
        runningBalance: balance,
        balanceSide: balance >= 0 ? (selectedAccount?.normalBalance || 'DEBIT') : (selectedAccount?.normalBalance === 'DEBIT' ? 'CREDIT' : 'DEBIT'),
        isOpeningBalance: false,
      })
    })

    return allLines
  }, [selectedCode, journalEntries, journalItems, dateFrom, dateTo, activeBranchId, selectedAccount, openingBalances])

  const totalDebit = ledgerEntries.reduce((s, e) => s + (e.isOpeningBalance ? 0 : e.debit), 0)
  const totalCredit = ledgerEntries.reduce((s, e) => s + (e.isOpeningBalance ? 0 : e.credit), 0)
  const endingBalance = ledgerEntries.at(-1)?.runningBalance || 0
  const periodLabel = `${fmtDate(dateFrom)} s/d ${fmtDate(dateTo)}`

  const doExportPDF = () => exportLedgerPDF(selectedAccount?.accountName || selectedCode, ledgerEntries, periodLabel, appSettings)
  const doExportExcel = () => exportLedgerExcel(selectedAccount?.accountName || selectedCode, ledgerEntries, periodLabel, appSettings)

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Buku Besar (General Ledger)</h1>
          <p className="text-sm text-slate-400 mt-0.5">Rincian transaksi per akun dengan saldo berjalan</p>
        </div>
        {selectedCode && ledgerEntries.length > 0 && (
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={doExportExcel}><Download className="w-4 h-4" />Excel</button>
            <button className="btn-secondary" onClick={doExportPDF}><Printer className="w-4 h-4" />PDF</button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="card card-body">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[240px]">
            <label className="form-label">Pilih Akun</label>
            <SearchableSelect
              value={selectedCode}
              onChange={setSelectedCode}
              options={accountOptions}
              placeholder="— Pilih akun untuk ditampilkan —"
            />
          </div>
          <div>
            <label className="form-label">Dari Tanggal</label>
            <input type="date" className="form-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Sampai Tanggal</label>
            <input type="date" className="form-input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Account header card */}
      {selectedAccount && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card card-body">
            <p className="text-xs text-slate-500 mb-1">Kode Akun</p>
            <p className="font-mono font-bold text-primary-700">{selectedAccount.accountCode}</p>
          </div>
          <div className="card card-body">
            <p className="text-xs text-slate-500 mb-1">Nama Akun</p>
            <p className="font-semibold text-slate-800 truncate">{selectedAccount.accountName}</p>
          </div>
          <div className="card card-body">
            <p className="text-xs text-slate-500 mb-1">Total Mutasi Debit</p>
            <p className="font-mono font-bold amount-debit">{fmtIDR(totalDebit)}</p>
          </div>
          <div className="card card-body">
            <p className="text-xs text-slate-500 mb-1">Saldo Akhir Periode</p>
            <p className={`font-mono font-bold ${endingBalance >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{fmtIDR(Math.abs(endingBalance))}</p>
          </div>
        </div>
      )}

      {/* Ledger table */}
      {!selectedCode ? (
        <div className="card card-body text-center py-16 text-slate-400">
          <Filter className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p>Pilih akun di atas untuk melihat buku besar</p>
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <span className="section-title">{selectedAccount?.accountName}</span>
            <span className="text-xs text-slate-400">{periodLabel} — {ledgerEntries.length} transaksi</span>
          </div>
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>No. Jurnal</th>
                  <th>Keterangan</th>
                  <th className="text-right">Debit (Rp)</th>
                  <th className="text-right">Kredit (Rp)</th>
                  <th className="text-right">Saldo</th>
                  <th>D/K</th>
                </tr>
              </thead>
              <tbody>
                {ledgerEntries.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-10 text-slate-400">Tidak ada transaksi pada periode ini</td></tr>
                ) : ledgerEntries.map((e, i) => (
                  <tr key={e.id || i} className={e.isOpeningBalance ? 'bg-blue-50 font-semibold' : ''}>
                    <td className="text-sm">{fmtDate(e.transactionDate)}</td>
                    <td className={`font-mono text-xs ${e.isOpeningBalance ? 'text-blue-700 font-bold' : 'text-primary-700'}`}>
                      {e.entryNumber}
                    </td>
                    <td className="text-sm max-w-[220px] truncate">{e.description}</td>
                    <td className="text-right amount-debit text-sm">{e.debit > 0 ? fmtIDR(e.debit) : ''}</td>
                    <td className="text-right amount-credit text-sm">{e.credit > 0 ? fmtIDR(e.credit) : ''}</td>
                    <td className="text-right font-mono font-medium text-sm">{fmtIDR(Math.abs(e.runningBalance))}</td>
                    <td><span className={`badge text-xs ${e.balanceSide === 'DEBIT' ? 'badge-blue' : 'badge-green'}`}>{e.balanceSide}</span></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-semibold border-t-2 border-slate-200">
                  <td colSpan={3} className="text-right text-sm py-3 pr-4">TOTAL PERIODE</td>
                  <td className="text-right font-mono text-sm amount-debit py-3">{fmtIDR(totalDebit)}</td>
                  <td className="text-right font-mono text-sm amount-credit py-3">{fmtIDR(totalCredit)}</td>
                  <td className="text-right font-mono text-sm py-3">{fmtIDR(Math.abs(endingBalance))}</td>
                  <td className="py-3"><span className={`badge text-xs ${endingBalance >= 0 ? (selectedAccount?.naturalBalance === 'DEBIT' ? 'badge-blue' : 'badge-green') : 'badge-red'}`}>{endingBalance >= 0 ? selectedAccount?.naturalBalance : 'LAWAN'}</span></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
