/**
 * OpeningBalancePage.jsx
 * Halaman untuk input Saldo Awal (Opening Balance) untuk seluruh COA
 * User dapat langsung mengisi saldo awal di tabel dan klik Simpan
 */
import { useState, useEffect, useMemo } from 'react'
import { useStore } from '../../store/useStore'
import { Search, Save, AlertCircle, CheckCircle, BookOpen, Calendar, RotateCw } from 'lucide-react'
import Alert from '../../components/ui/Alert'
import { fmtIDR } from '../../utils/format'

export default function OpeningBalancePage() {
  const {
    coa,
    branches,
    activeBranchId,
    openingBalances,
    saveOpeningBalances,
    refreshOpeningBalances,
    logActivity,
  } = useStore()

  const currentYear = new Date().getFullYear()

  // Form state
  const [fiscalYear, setFiscalYear] = useState(currentYear)
  const [openingDate, setOpeningDate] = useState(`${currentYear}-01-01`)
  const [selectedBranchId, setSelectedBranchId] = useState(activeBranchId)
  const [searchTerm, setSearchTerm] = useState('')
  const [editableBalances, setEditableBalances] = useState({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  // Load opening balances when branch or fiscal year changes
  useEffect(() => {
    if (selectedBranchId && fiscalYear) {
      refreshOpeningBalances({ branchId: selectedBranchId, fiscalYear })
    }
  }, [selectedBranchId, fiscalYear, refreshOpeningBalances])

  // Initialize editable balances from loaded data
  useEffect(() => {
    const balanceMap = {}
    openingBalances.forEach(ob => {
      if (ob.branchId === selectedBranchId && ob.fiscalYear === fiscalYear) {
        balanceMap[ob.accountCode] = {
          id: ob.id,
          openingBalance: ob.openingBalance || 0,
          description: ob.description || '',
        }
      }
    })
    setEditableBalances(balanceMap)
  }, [openingBalances, selectedBranchId, fiscalYear])

  // Filter COA by search term
  const filteredCOA = useMemo(() => {
    if (!searchTerm.trim()) return coa.filter(a => a.isActive !== false)

    const term = searchTerm.toLowerCase()
    return coa.filter(a =>
      a.isActive !== false && (
        a.accountCode?.toLowerCase().includes(term) ||
        a.accountName?.toLowerCase().includes(term) ||
        a.accountType?.toLowerCase().includes(term)
      )
    )
  }, [coa, searchTerm])

  // Group by account type
  const groupedCOA = useMemo(() => {
    const groups = {}
    filteredCOA.forEach(account => {
      const type = account.accountType || 'OTHER'
      if (!groups[type]) groups[type] = []
      groups[type].push(account)
    })
    return groups
  }, [filteredCOA])

  // Handle balance input change
  const handleBalanceChange = (accountCode, value) => {
    setEditableBalances(prev => ({
      ...prev,
      [accountCode]: {
        ...prev[accountCode],
        openingBalance: value === '' ? 0 : parseFloat(value) || 0,
      }
    }))
  }

  // Handle description change
  const handleDescriptionChange = (accountCode, value) => {
    setEditableBalances(prev => ({
      ...prev,
      [accountCode]: {
        ...prev[accountCode],
        description: value,
      }
    }))
  }

  // Calculate totals
  const totals = useMemo(() => {
    let totalDebit = 0
    let totalCredit = 0

    Object.entries(editableBalances).forEach(([accountCode, data]) => {
      const account = coa.find(a => a.accountCode === accountCode)
      if (!account) return

      const balance = parseFloat(data.openingBalance) || 0
      if (balance === 0) return

      // Determine if it's debit or credit based on normal balance
      if (account.normalBalance === 'DEBIT') {
        totalDebit += balance
      } else {
        totalCredit += balance
      }
    })

    return { totalDebit, totalCredit, difference: totalDebit - totalCredit }
  }, [editableBalances, coa])

  // Handle save
  const handleSave = async () => {
    if (!selectedBranchId) {
      setMessage({ type: 'error', text: 'Pilih cabang terlebih dahulu.' })
      return
    }

    // Prepare data to save (only accounts with non-zero balances)
    const dataToSave = Object.entries(editableBalances)
      .filter(([_, data]) => parseFloat(data.openingBalance || 0) !== 0)
      .map(([accountCode, data]) => {
        const existing = openingBalances.find(
          ob => ob.accountCode === accountCode &&
            ob.branchId === selectedBranchId &&
            ob.fiscalYear === fiscalYear
        )

        return {
          id: existing?.id,
          accountCode,
          branchId: selectedBranchId,
          fiscalYear: parseInt(fiscalYear),
          openingDate,
          openingBalance: parseFloat(data.openingBalance || 0),
          description: data.description || `Saldo awal tahun ${fiscalYear}`,
          createdBy: 'User', // TODO: Get from auth context
        }
      })

    if (dataToSave.length === 0) {
      setMessage({ type: 'error', text: 'Tidak ada saldo awal yang diisi.' })
      return
    }

    // Validate balance (optional: allow unbalanced for flexibility)
    const diff = Math.abs(totals.difference)
    if (diff > 0.01) {
      const confirmSave = window.confirm(
        `Saldo tidak balance. Selisih: Rp ${diff.toLocaleString('id-ID')}.\n\nApakah Anda yakin ingin menyimpan?`
      )
      if (!confirmSave) return
    }

    setSaving(true)
    setMessage(null)

    try {
      const result = await saveOpeningBalances(dataToSave)

      if (result.ok) {
        setMessage({
          type: 'success',
          text: `✓ Berhasil menyimpan ${dataToSave.length} saldo awal untuk tahun fiskal ${fiscalYear}.`
        })
        logActivity('SAVE_OPENING_BALANCES', 'ACCOUNTING',
          `Saved ${dataToSave.length} opening balances for fiscal year ${fiscalYear}`)

        // Refresh data
        await refreshOpeningBalances({ branchId: selectedBranchId, fiscalYear })
      } else {
        setMessage({ type: 'error', text: `Gagal menyimpan: ${result.error}` })
      }
    } catch (error) {
      console.error('[OpeningBalancePage] Save error:', error)
      setMessage({ type: 'error', text: `Error: ${error.message}` })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Header & Action Bar */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-title">Saldo Awal (Opening Balance)</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Input saldo awal untuk setiap akun COA sebagai dasar perhitungan buku besar &amp; laporan keuangan.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <button className="btn-orange">
            <BookOpen className="w-4 h-4" />Unduh Template Impor
          </button>
          <button className="btn-emerald">
            <CheckCircle className="w-4 h-4" />Impor Data
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-danger-red"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Menyimpan...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />Simpan Saldo Awal
              </>
            )}
          </button>
          <button className="btn-royal-blue">
            <BookOpen className="w-4 h-4" />Unduh Laporan
          </button>
          <button
            className="btn-square-refresh"
            onClick={() => refreshOpeningBalances({ branchId: selectedBranchId || activeBranchId, fiscalYear })}
            title="Refresh Data"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Alert Message */}
      {message && (
        <Alert
          type={message.type}
          className="mb-4"
          onClose={() => setMessage(null)}
        >
          {message.text}
        </Alert>
      )}

      {/* Summary Cards with Bright Solid Theme */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card card-body bg-emerald-500 text-white border-0 shadow-sm">
          <p className="text-xs text-emerald-100 font-semibold uppercase tracking-wider mb-1">Total Debit</p>
          <p className="font-extrabold text-3xl font-mono text-white">
            {fmtIDR(totals.totalDebit)}
          </p>
        </div>
        <div className="card card-body bg-blue-500 text-white border-0 shadow-sm">
          <p className="text-xs text-blue-100 font-semibold uppercase tracking-wider mb-1">Total Kredit</p>
          <p className="font-extrabold text-3xl font-mono text-white">
            {fmtIDR(totals.totalCredit)}
          </p>
        </div>
        <div className={`card card-body text-white border-0 shadow-sm ${Math.abs(totals.difference) < 0.01 ? 'bg-purple-500' : 'bg-amber-500'}`}>
          <p className="text-xs text-purple-100 font-semibold uppercase tracking-wider mb-1">
            Selisih {Math.abs(totals.difference) < 0.01 ? '(Balance ✓)' : '(Unbalanced)'}
          </p>
          <p className="font-extrabold text-3xl font-mono text-white">
            {fmtIDR(Math.abs(totals.difference))}
          </p>
        </div>
      </div>

      {/* Filters bar without Branch */}
      <div className="card card-body">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Fiscal Year */}
          <div>
            <label className="form-label flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-500" /> Tahun Fiskal
            </label>
            <input
              type="number"
              value={fiscalYear}
              onChange={(e) => setFiscalYear(parseInt(e.target.value) || currentYear)}
              min="2020"
              max="2100"
              className="form-input"
            />
          </div>

          {/* Opening Date */}
          <div>
            <label className="form-label">Tanggal Efektif</label>
            <input
              type="date"
              value={openingDate}
              onChange={(e) => setOpeningDate(e.target.value)}
              className="form-input"
            />
          </div>

          {/* Search */}
          <div>
            <label className="form-label flex items-center gap-1">
              <Search className="w-3.5 h-3.5 text-slate-500" /> Cari Akun
            </label>
            <input
              type="text"
              placeholder="Kode atau nama akun..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input"
            />
          </div>
        </div>
      </div>

      {/* COA Table */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th style={{ width: 130 }}>Kode Akun</th>
                <th>Nama Akun</th>
                <th>Tipe</th>
                <th className="text-center">Normal Balance</th>
                <th className="text-right" style={{ width: 220 }}>Saldo Awal (Rp)</th>
                <th>Keterangan</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {Object.entries(groupedCOA).map(([accountType, accounts]) => (
                <>
                  {/* Group Header */}
                  <tr key={`header-${accountType}`} className="bg-gray-100">
                    <td colSpan="6" className="px-4 py-2 font-semibold text-gray-800">
                      {accountType}
                    </td>
                  </tr>

                  {/* Group Accounts */}
                  {accounts.map((account) => {
                    const balance = editableBalances[account.accountCode]

                    return (
                      <tr key={account.accountCode} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-mono text-gray-900">
                          {account.accountCode}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {account.accountName}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                            {account.accountType}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-center">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${account.normalBalance === 'DEBIT'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-blue-100 text-blue-700'
                            }`}>
                            {account.normalBalance}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            step="0.01"
                            value={balance?.openingBalance || ''}
                            onChange={(e) => handleBalanceChange(account.accountCode, e.target.value)}
                            placeholder="0.00"
                            className="w-full px-3 py-2 text-right border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={balance?.description || ''}
                            onChange={(e) => handleDescriptionChange(account.accountCode, e.target.value)}
                            placeholder="Opsional"
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </td>
                      </tr>
                    )
                  })}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-6 flex items-center justify-between">
        <div className="text-sm text-gray-600">
          {Object.keys(editableBalances).filter(k => editableBalances[k].openingBalance !== 0).length} akun terisi
        </div>

        <button
          onClick={handleSave}
          disabled={saving || !selectedBranchId}
          className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 shadow-md transition-colors"
        >
          {saving ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Menyimpan...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              Simpan Saldo Awal
            </>
          )}
        </button>
      </div>
    </div>
  )
}
