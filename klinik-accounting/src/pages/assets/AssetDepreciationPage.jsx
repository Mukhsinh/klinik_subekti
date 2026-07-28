import { useState, useMemo } from 'react'
import { TrendingDown, Plus, CheckCircle, XCircle, Calendar, AlertCircle, Download } from 'lucide-react'
import { useStore } from '../../store/useStore'
import Modal from '../../components/ui/Modal'
import { fmtIDR, fmtDate, fmtMonthYear } from '../../utils/format'
import { exportDepreciationToExcel } from '../../utils/exportUtils'
import toast from 'react-hot-toast'

// Status badges
const STATUS_COLORS = {
  DRAFT: 'badge-yellow',
  POSTED: 'badge-green',
  REVERSED: 'badge-red'
}
const STATUS_LABELS = {
  DRAFT: 'Draft',
  POSTED: 'Posted',
  REVERSED: 'Reversed'
}

// ─── Depreciation Form Component ──────────────────────────────
function DepreciationForm({ onSave, onClose, assets, period }) {
  const [selectedAssets, setSelectedAssets] = useState([])
  const [year, setYear] = useState(period.year)
  const [month, setMonth] = useState(period.month)
  const { calculateDepreciation } = useStore()

  const activeAssets = useMemo(() =>
    assets.filter(a => a.status === 'ACTIVE')
      .sort((a, b) => a.assetCode.localeCompare(b.assetCode)),
    [assets]
  )

  const toggleAsset = (asset) => {
    setSelectedAssets(prev => {
      const exists = prev.find(a => a.id === asset.id)
      if (exists) {
        return prev.filter(a => a.id !== asset.id)
      }
      // Calculate depreciation for this asset
      const monthlyDepr = asset.acquisitionCost / (asset.usefulLifeYears * 12)
      return [...prev, {
        ...asset,
        depreciationAmount: monthlyDepr
      }]
    })
  }

  const selectAll = () => {
    const allWithDepr = activeAssets.map(asset => ({
      ...asset,
      depreciationAmount: asset.acquisitionCost / (asset.usefulLifeYears * 12)
    }))
    setSelectedAssets(allWithDepr)
  }

  const deselectAll = () => {
    setSelectedAssets([])
  }

  const submit = (e) => {
    e.preventDefault()
    if (selectedAssets.length === 0) {
      toast.error('Pilih minimal 1 aset untuk dihitung penyusutannya')
      return
    }
    onSave({ selectedAssets, year, month })
  }

  const totalDepreciation = selectedAssets.reduce((sum, a) => sum + a.depreciationAmount, 0)

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="form-label">Tahun</label>
          <input
            type="number"
            className="form-input"
            value={year}
            onChange={e => setYear(parseInt(e.target.value))}
            min={2020}
            max={2100}
            required
          />
        </div>
        <div>
          <label className="form-label">Bulan</label>
          <select
            className="form-select"
            value={month}
            onChange={e => setMonth(parseInt(e.target.value))}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
              <option key={m} value={m}>
                {new Date(2024, m - 1).toLocaleString('id-ID', { month: 'long' })}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-slate-700">
            Pilih Aset ({selectedAssets.length} / {activeAssets.length})
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="text-xs text-primary-600 hover:text-primary-700 font-medium"
              onClick={selectAll}
            >
              Pilih Semua
            </button>
            <span className="text-slate-300">|</span>
            <button
              type="button"
              className="text-xs text-slate-500 hover:text-slate-700 font-medium"
              onClick={deselectAll}
            >
              Batal Pilih
            </button>
          </div>
        </div>

        <div className="max-h-80 overflow-y-auto space-y-2">
          {activeAssets.map(asset => {
            const isSelected = selectedAssets.find(a => a.id === asset.id)
            const monthlyDepr = asset.acquisitionCost / (asset.usefulLifeYears * 12)

            return (
              <label
                key={asset.id}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${isSelected
                  ? 'bg-primary-50 border-primary-300'
                  : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
              >
                <input
                  type="checkbox"
                  checked={!!isSelected}
                  onChange={() => toggleAsset(asset)}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="font-semibold text-sm text-slate-800 truncate">
                      {asset.assetCode} — {asset.assetName}
                    </p>
                    <p className="text-sm font-mono font-semibold text-primary-700 whitespace-nowrap">
                      {fmtIDR(monthlyDepr)}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span>{asset.category}</span>
                    <span>•</span>
                    <span>{asset.usefulLifeYears} tahun</span>
                    <span>•</span>
                    <span>Nilai Buku: {fmtIDR(asset.bookValue || asset.acquisitionCost)}</span>
                  </div>
                </div>
              </label>
            )
          })}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-blue-700">
            Total Beban Penyusutan Periode Ini
          </p>
          <p className="text-lg font-bold font-mono text-blue-700">
            {fmtIDR(totalDepreciation)}
          </p>
        </div>
        <p className="text-xs text-blue-600 mt-1">
          Jurnal otomatis: Debit Beban Penyusutan, Kredit Akumulasi Penyusutan
        </p>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn-secondary" onClick={onClose}>
          Batal
        </button>
        <button type="submit" className="btn-primary">
          <Plus className="w-4 h-4" />
          Hitung & Simpan Draft
        </button>
      </div>
    </form>
  )
}

// ─── Main Page ────────────────────────────────────────────────
export default function AssetDepreciationPage() {
  const {
    fixedAssets,
    assetDepreciations,
    saveDepreciation,
    postDepreciation,
    loading
  } = useStore()

  const [modal, setModal] = useState(null)
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear())
  const [monthFilter, setMonthFilter] = useState('ALL')

  // Filter depreciations
  const filtered = useMemo(() =>
    assetDepreciations
      .filter(d => d.periodYear === yearFilter)
      .filter(d => monthFilter === 'ALL' || d.periodMonth === parseInt(monthFilter))
      .sort((a, b) => {
        if (a.periodYear !== b.periodYear) return b.periodYear - a.periodYear
        if (a.periodMonth !== b.periodMonth) return b.periodMonth - a.periodMonth
        return b.createdAt.localeCompare(a.createdAt)
      }),
    [assetDepreciations, yearFilter, monthFilter]
  )

  // Group by period
  const groupedByPeriod = useMemo(() => {
    const groups = {}
    filtered.forEach(d => {
      const key = `${d.periodYear}-${String(d.periodMonth).padStart(2, '0')}`
      if (!groups[key]) {
        groups[key] = {
          year: d.periodYear,
          month: d.periodMonth,
          depreciations: []
        }
      }
      groups[key].depreciations.push(d)
    })
    return Object.values(groups)
  }, [filtered])

  // Statistics
  const stats = useMemo(() => {
    const thisYear = assetDepreciations.filter(d => d.periodYear === yearFilter)
    return {
      totalThisYear: thisYear.reduce((sum, d) => sum + d.depreciationAmount, 0),
      postedThisYear: thisYear.filter(d => d.status === 'POSTED').length,
      draftThisYear: thisYear.filter(d => d.status === 'DRAFT').length,
    }
  }, [assetDepreciations, yearFilter])

  const handleSave = async ({ selectedAssets, year, month }) => {
    try {
      // Create depreciation records
      for (const asset of selectedAssets) {
        const opening = (asset.bookValue || asset.acquisitionCost)
        const closing = opening - asset.depreciationAmount

        await saveDepreciation({
          assetId: asset.id,
          periodYear: year,
          periodMonth: month,
          openingBookValue: opening,
          depreciationAmount: asset.depreciationAmount,
          closingBookValue: Math.max(0, closing),
          status: 'DRAFT'
        })
      }

      toast.success(`${selectedAssets.length} penyusutan aset berhasil dihitung dan disimpan sebagai DRAFT`)
      setModal(null)
    } catch (error) {
      toast.error('Gagal menyimpan penyusutan: ' + error.message)
    }
  }

  const handlePost = async (depreciation) => {
    if (!confirm(`Post penyusutan aset untuk periode ${fmtMonthYear(new Date(depreciation.periodYear, depreciation.periodMonth - 1))}?\n\nJurnal akan dibuat otomatis dan nilai buku aset akan diperbarui.`)) {
      return
    }

    try {
      const result = await postDepreciation(depreciation.id, 'System')
      if (result.ok) {
        toast.success('Penyusutan berhasil di-post, jurnal telah dibuat')
      } else {
        toast.error(result.error)
      }
    } catch (error) {
      toast.error('Gagal post penyusutan: ' + error.message)
    }
  }

  const handlePostBulk = async (depreciations) => {
    const drafts = depreciations.filter(d => d.status === 'DRAFT')
    if (drafts.length === 0) {
      toast.error('Tidak ada penyusutan DRAFT untuk di-post')
      return
    }

    if (!confirm(`Post ${drafts.length} penyusutan aset sekaligus?\n\nJurnal akan dibuat untuk masing-masing aset.`)) {
      return
    }

    let success = 0
    let failed = 0

    for (const depr of drafts) {
      try {
        const result = await postDepreciation(depr.id, 'System')
        if (result.ok) {
          success++
        } else {
          failed++
        }
      } catch (error) {
        failed++
      }
    }

    if (success > 0) {
      toast.success(`${success} penyusutan berhasil di-post`)
    }
    if (failed > 0) {
      toast.error(`${failed} penyusutan gagal di-post`)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-slate-500">Memuat data penyusutan...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <TrendingDown className="w-7 h-7 text-primary-600" />
            Penyusutan Aset Tetap
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Kalkulasi & pencatatan beban penyusutan bulanan — Metode Garis Lurus
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="btn-secondary"
            onClick={() => {
              exportDepreciationToExcel(assetDepreciations, fixedAssets)
              toast.success('Data berhasil di-export ke Excel')
            }}
            disabled={assetDepreciations.length === 0}
          >
            <Download className="w-4 h-4" />
            Export Excel
          </button>
          <button
            className="btn-primary"
            onClick={() => setModal('add')}
          >
            <Plus className="w-4 h-4" />
            Hitung Penyusutan
          </button>
        </div>
      </div>

      {/* Summary Cards with Bright Solid Theme */}
      <div className="grid grid-cols-4 gap-4">
        <div className="card card-body bg-blue-500 text-white border-0 shadow-sm">
          <p className="text-xs text-blue-100 uppercase tracking-wider font-semibold mb-1">Total Penyusutan {yearFilter}</p>
          <p className="font-bold text-2xl font-mono text-white">{fmtIDR(stats.totalThisYear)}</p>
        </div>
        <div className="card card-body bg-emerald-500 text-white border-0 shadow-sm">
          <p className="text-xs text-emerald-100 uppercase tracking-wider font-semibold mb-1">Posted {yearFilter}</p>
          <p className="font-bold text-3xl font-mono text-white">{stats.postedThisYear}</p>
          <p className="text-xs text-emerald-100 mt-1">periode</p>
        </div>
        <div className="card card-body bg-amber-500 text-white border-0 shadow-sm">
          <p className="text-xs text-amber-100 uppercase tracking-wider font-semibold mb-1">Draft {yearFilter}</p>
          <p className="font-bold text-3xl font-mono text-white">{stats.draftThisYear}</p>
          <p className="text-xs text-amber-100 mt-1">periode</p>
        </div>
        <div className="card card-body bg-purple-500 text-white border-0 shadow-sm">
          <p className="text-xs text-purple-100 uppercase tracking-wider font-semibold mb-1">Aset Aktif</p>
          <p className="font-bold text-3xl font-mono text-white">
            {fixedAssets.filter(a => a.status === 'ACTIVE').length}
          </p>
          <p className="text-xs text-purple-100 mt-1">unit aset</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-slate-600">Tahun:</label>
        <select
          className="form-select w-32"
          value={yearFilter}
          onChange={e => setYearFilter(parseInt(e.target.value))}
        >
          {[...Array(5)].map((_, i) => {
            const y = new Date().getFullYear() - i
            return <option key={y} value={y}>{y}</option>
          })}
        </select>

        <label className="text-sm font-medium text-slate-600 ml-4">Bulan:</label>
        <select
          className="form-select w-40"
          value={monthFilter}
          onChange={e => setMonthFilter(e.target.value)}
        >
          <option value="ALL">Semua Bulan</option>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
            <option key={m} value={m}>
              {new Date(2024, m - 1).toLocaleString('id-ID', { month: 'long' })}
            </option>
          ))}
        </select>
      </div>

      {/* Depreciation Groups by Period */}
      <div className="space-y-4">
        {groupedByPeriod.length === 0 ? (
          <div className="card card-body text-center py-14">
            <TrendingDown className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="text-base font-medium text-slate-600 mb-1">
              Belum ada penyusutan dicatat
            </p>
            <p className="text-sm text-slate-400">
              Klik "Hitung Penyusutan" untuk memulai
            </p>
          </div>
        ) : (
          groupedByPeriod.map(group => {
            const periodDate = new Date(group.year, group.month - 1)
            const totalAmount = group.depreciations.reduce((sum, d) => sum + d.depreciationAmount, 0)
            const draftCount = group.depreciations.filter(d => d.status === 'DRAFT').length
            const postedCount = group.depreciations.filter(d => d.status === 'POSTED').length

            return (
              <div key={`${group.year}-${group.month}`} className="card">
                <div className="card-header bg-slate-50">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-slate-600" />
                    <h3 className="font-semibold text-slate-800">
                      {fmtMonthYear(periodDate)}
                    </h3>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-600">
                      {group.depreciations.length} aset • {fmtIDR(totalAmount)}
                    </span>
                    {draftCount > 0 && (
                      <button
                        className="btn-sm btn-primary"
                        onClick={() => handlePostBulk(group.depreciations)}
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        Post {draftCount} Draft
                      </button>
                    )}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="table-base">
                    <thead>
                      <tr>
                        <th style={{ width: 120 }}>Kode Aset</th>
                        <th>Nama Aset</th>
                        <th className="text-right">Nilai Buku Awal</th>
                        <th className="text-right">Beban Penyusutan</th>
                        <th className="text-right">Nilai Buku Akhir</th>
                        <th>Status</th>
                        <th className="text-center" style={{ width: 80 }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.depreciations.map(depr => {
                        const asset = fixedAssets.find(a => a.id === depr.assetId)
                        return (
                          <tr key={depr.id}>
                            <td className="font-mono text-xs font-semibold text-primary-700">
                              {asset?.assetCode || '—'}
                            </td>
                            <td className="font-medium text-sm">{asset?.assetName || '—'}</td>
                            <td className="text-right font-mono text-sm">
                              {fmtIDR(depr.openingBookValue)}
                            </td>
                            <td className="text-right font-mono font-semibold text-sm text-amber-700">
                              {fmtIDR(depr.depreciationAmount)}
                            </td>
                            <td className="text-right font-mono font-semibold text-sm text-purple-700">
                              {fmtIDR(depr.closingBookValue)}
                            </td>
                            <td>
                              <span className={`badge ${STATUS_COLORS[depr.status]} text-xs`}>
                                {STATUS_LABELS[depr.status]}
                              </span>
                            </td>
                            <td className="text-center">
                              {depr.status === 'DRAFT' && (
                                <button
                                  onClick={() => handlePost(depr)}
                                  className="p-1.5 hover:bg-green-50 hover:text-green-600 rounded transition-colors"
                                  title="Post penyusutan"
                                >
                                  <CheckCircle className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-blue-700">
          <p className="font-semibold mb-1">Cara Kerja Penyusutan</p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>Penyusutan dihitung dengan <strong>metode garis lurus</strong> tanpa nilai residu</li>
            <li>Beban per bulan = Harga Perolehan ÷ (Umur Ekonomis × 12 bulan)</li>
            <li>Status DRAFT dapat diedit/dihapus, status POSTED tidak dapat diubah</li>
            <li>Saat di-post, jurnal otomatis dibuat: Debit Beban Penyusutan, Kredit Akumulasi Penyusutan</li>
          </ul>
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <Modal
          open={true}
          title="Hitung Penyusutan Aset"
          onClose={() => setModal(null)}
          size="lg"
        >
          <DepreciationForm
            onSave={handleSave}
            onClose={() => setModal(null)}
            assets={fixedAssets}
            period={{
              year: new Date().getFullYear(),
              month: new Date().getMonth() + 1
            }}
          />
        </Modal>
      )}
    </div>
  )
}
