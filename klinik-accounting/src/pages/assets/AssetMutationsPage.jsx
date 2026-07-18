import { useState, useMemo } from 'react'
import { ArrowRightLeft, Plus, Package, Trash2, TrendingUp, TrendingDown, MapPin, AlertCircle, FileText, Download } from 'lucide-react'
import { useStore } from '../../store/useStore'
import Modal from '../../components/ui/Modal'
import SearchInput from '../../components/ui/SearchInput'
import { fmtIDR, fmtDate, todayISO } from '../../utils/format'
import { exportMutationsToExcel } from '../../utils/exportUtils'
import toast from 'react-hot-toast'

// Mutation types
const MUTATION_TYPES = [
  { value: 'ACQUISITION', label: 'Pembelian Baru', icon: Package, color: 'text-green-600' },
  { value: 'DISPOSAL', label: 'Penghapusan', icon: Trash2, color: 'text-red-600' },
  { value: 'SALE', label: 'Penjualan', icon: TrendingUp, color: 'text-blue-600' },
  { value: 'TRANSFER', label: 'Transfer Lokasi', icon: MapPin, color: 'text-purple-600' },
  { value: 'REVALUATION', label: 'Revaluasi', icon: TrendingDown, color: 'text-amber-600' },
]

const MUTATION_COLORS = {
  ACQUISITION: 'badge-green',
  DISPOSAL: 'badge-red',
  SALE: 'badge-blue',
  TRANSFER: 'badge-purple',
  REVALUATION: 'badge-yellow'
}

// ─── Mutation Form Component ──────────────────────────────────
function MutationForm({ onSave, onClose, assets, initial = {} }) {
  const [form, setForm] = useState({
    assetId: initial.assetId || '',
    mutationType: initial.mutationType || 'TRANSFER',
    mutationDate: initial.mutationDate || todayISO(),
    referenceNumber: initial.referenceNumber || '',
    amount: initial.amount || '',
    fromLocation: initial.fromLocation || '',
    toLocation: initial.toLocation || '',
    description: initial.description || '',
    disposalValue: initial.disposalValue || '',
    quantity: initial.quantity || 1,
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const selectedAsset = assets.find(a => a.id === form.assetId)

  // Auto-fill from location when asset is selected
  const handleAssetChange = (assetId) => {
    const asset = assets.find(a => a.id === assetId)
    set('assetId', assetId)
    if (asset && form.mutationType === 'TRANSFER') {
      set('fromLocation', asset.location || '')
    }
  }

  const submit = (e) => {
    e.preventDefault()
    if (!form.assetId) {
      toast.error('Pilih aset terlebih dahulu')
      return
    }
    if (form.mutationType === 'TRANSFER' && !form.toLocation) {
      toast.error('Lokasi tujuan wajib diisi untuk transfer')
      return
    }
    if ((form.mutationType === 'SALE' || form.mutationType === 'DISPOSAL') && !form.disposalValue) {
      toast.error('Nilai pelepasan wajib diisi')
      return
    }

    onSave({
      ...form,
      amount: parseFloat(form.amount || 0),
      disposalValue: form.disposalValue ? parseFloat(form.disposalValue) : null,
      quantity: parseInt(form.quantity || 1),
    })
  }

  const isDisposalType = ['SALE', 'DISPOSAL'].includes(form.mutationType)
  const isTransfer = form.mutationType === 'TRANSFER'

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="form-label">Jenis Mutasi *</label>
        <select
          className="form-select"
          value={form.mutationType}
          onChange={e => set('mutationType', e.target.value)}
        >
          {MUTATION_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="form-label">Aset *</label>
        <select
          className="form-select"
          value={form.assetId}
          onChange={e => handleAssetChange(e.target.value)}
          required
        >
          <option value="">-- Pilih Aset --</option>
          {assets.map(a => (
            <option key={a.id} value={a.id}>
              {a.assetCode} - {a.assetName} ({a.location || 'No location'})
            </option>
          ))}
        </select>
      </div>

      {selectedAsset && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-slate-500">Kategori:</span>
              <span className="ml-2 font-medium">{selectedAsset.category}</span>
            </div>
            <div>
              <span className="text-slate-500">Nilai Buku:</span>
              <span className="ml-2 font-medium">{fmtIDR(selectedAsset.bookValue || selectedAsset.acquisitionCost)}</span>
            </div>
            <div>
              <span className="text-slate-500">Lokasi Saat Ini:</span>
              <span className="ml-2 font-medium">{selectedAsset.location || '—'}</span>
            </div>
            <div>
              <span className="text-slate-500">Kondisi:</span>
              <span className="ml-2 font-medium">{selectedAsset.condition}</span>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="form-label">Tanggal Mutasi *</label>
          <input
            type="date"
            className="form-input"
            value={form.mutationDate}
            onChange={e => set('mutationDate', e.target.value)}
            required
          />
        </div>
        <div>
          <label className="form-label">Nomor Referensi</label>
          <input
            className="form-input"
            value={form.referenceNumber}
            onChange={e => set('referenceNumber', e.target.value)}
            placeholder="No. dokumen/PO…"
          />
        </div>
      </div>

      {isTransfer && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="form-label">Dari Lokasi</label>
            <input
              className="form-input"
              value={form.fromLocation}
              onChange={e => set('fromLocation', e.target.value)}
              placeholder="Lokasi asal"
              readOnly
            />
          </div>
          <div>
            <label className="form-label">Ke Lokasi *</label>
            <input
              className="form-input"
              value={form.toLocation}
              onChange={e => set('toLocation', e.target.value)}
              placeholder="Lokasi tujuan"
              required
            />
          </div>
        </div>
      )}

      {isDisposalType && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="form-label">Nilai Pelepasan (Rp) *</label>
            <input
              type="number"
              className="form-input"
              value={form.disposalValue}
              onChange={e => set('disposalValue', e.target.value)}
              min={0}
              step={1000}
              required
            />
            <p className="text-xs text-slate-400 mt-1">
              Nilai jual atau nilai sisa aset
            </p>
          </div>
          <div>
            <label className="form-label">Nilai Buku Saat Ini</label>
            <input
              type="text"
              className="form-input bg-slate-50"
              value={fmtIDR(selectedAsset?.bookValue || 0)}
              readOnly
            />
            {selectedAsset && form.disposalValue && (
              <p className={`text-xs mt-1 font-semibold ${parseFloat(form.disposalValue) > (selectedAsset.bookValue || 0)
                  ? 'text-green-600'
                  : 'text-red-600'
                }`}>
                {parseFloat(form.disposalValue) > (selectedAsset.bookValue || 0)
                  ? `Laba: ${fmtIDR(parseFloat(form.disposalValue) - (selectedAsset.bookValue || 0))}`
                  : `Rugi: ${fmtIDR((selectedAsset.bookValue || 0) - parseFloat(form.disposalValue))}`
                }
              </p>
            )}
          </div>
        </div>
      )}

      {!isDisposalType && !isTransfer && (
        <div>
          <label className="form-label">Jumlah (Rp)</label>
          <input
            type="number"
            className="form-input"
            value={form.amount}
            onChange={e => set('amount', e.target.value)}
            min={0}
            step={1000}
          />
        </div>
      )}

      <div>
        <label className="form-label">Keterangan *</label>
        <textarea
          className="form-textarea"
          rows={3}
          value={form.description}
          onChange={e => set('description', e.target.value)}
          placeholder="Jelaskan detail mutasi aset…"
          required
        />
      </div>

      {isDisposalType && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-800">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <strong>Perhatian:</strong> Mutasi {form.mutationType === 'SALE' ? 'penjualan' : 'penghapusan'}
              akan mengubah status aset menjadi {form.mutationType === 'SALE' ? 'SOLD' : 'DISPOSED'}
              dan membuat jurnal otomatis untuk mencatat laba/rugi pelepasan aset.
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn-secondary" onClick={onClose}>
          Batal
        </button>
        <button type="submit" className="btn-primary">
          Simpan Mutasi
        </button>
      </div>
    </form>
  )
}

// ─── Main Page ────────────────────────────────────────────────
export default function AssetMutationsPage() {
  const {
    fixedAssets,
    assetMutations,
    addAssetMutation,
    updateAsset,
    loading
  } = useStore()

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [modal, setModal] = useState(null)

  // Filter mutations
  const filtered = useMemo(() =>
    assetMutations
      .filter(m => typeFilter === 'ALL' || m.mutationType === typeFilter)
      .filter(m => {
        if (!search) return true
        const asset = fixedAssets.find(a => a.id === m.assetId)
        return (
          m.description?.toLowerCase().includes(search.toLowerCase()) ||
          m.referenceNumber?.toLowerCase().includes(search.toLowerCase()) ||
          asset?.assetName?.toLowerCase().includes(search.toLowerCase()) ||
          asset?.assetCode?.toLowerCase().includes(search.toLowerCase())
        )
      })
      .sort((a, b) => b.mutationDate.localeCompare(a.mutationDate)),
    [assetMutations, fixedAssets, typeFilter, search]
  )

  // Statistics
  const stats = useMemo(() => {
    const thisYear = new Date().getFullYear()
    const thisYearMutations = assetMutations.filter(m =>
      new Date(m.mutationDate).getFullYear() === thisYear
    )
    return {
      totalMutations: assetMutations.length,
      thisYear: thisYearMutations.length,
      transfers: assetMutations.filter(m => m.mutationType === 'TRANSFER').length,
      disposals: assetMutations.filter(m => m.mutationType === 'DISPOSAL' || m.mutationType === 'SALE').length,
    }
  }, [assetMutations])

  const handleSave = async (data) => {
    try {
      const asset = fixedAssets.find(a => a.id === data.assetId)
      if (!asset) {
        toast.error('Aset tidak ditemukan')
        return
      }

      // Calculate gain/loss for disposal
      let gainLossAmount = null
      if (data.mutationType === 'SALE' || data.mutationType === 'DISPOSAL') {
        const bookValue = asset.bookValue || asset.acquisitionCost
        gainLossAmount = data.disposalValue - bookValue
      }

      // Save mutation
      await addAssetMutation({
        ...data,
        gainLossAmount,
        createdBy: 'System',
        authorizedBy: 'System',
      })

      // Update asset based on mutation type
      if (data.mutationType === 'TRANSFER') {
        await updateAsset(data.assetId, {
          location: data.toLocation
        })
        toast.success('Transfer aset berhasil dicatat')
      } else if (data.mutationType === 'SALE') {
        await updateAsset(data.assetId, {
          status: 'SOLD',
          disposalDate: data.mutationDate,
          disposalValue: data.disposalValue,
          disposalMethod: 'SALE'
        })
        toast.success('Penjualan aset berhasil dicatat')
      } else if (data.mutationType === 'DISPOSAL') {
        await updateAsset(data.assetId, {
          status: 'DISPOSED',
          disposalDate: data.mutationDate,
          disposalValue: data.disposalValue,
          disposalMethod: 'DISPOSAL'
        })
        toast.success('Penghapusan aset berhasil dicatat')
      } else {
        toast.success('Mutasi aset berhasil dicatat')
      }

      setModal(null)
    } catch (error) {
      toast.error('Gagal menyimpan mutasi: ' + error.message)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-slate-500">Memuat data mutasi...</p>
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
            <ArrowRightLeft className="w-7 h-7 text-primary-600" />
            Mutasi Aset Tetap
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Riwayat mutasi aset: pembelian, penjualan, transfer, dan penghapusan
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="btn-secondary"
            onClick={() => {
              exportMutationsToExcel(assetMutations, fixedAssets)
              toast.success('Data berhasil di-export ke Excel')
            }}
            disabled={assetMutations.length === 0}
          >
            <Download className="w-4 h-4" />
            Export Excel
          </button>
          <button
            className="btn-primary"
            onClick={() => setModal('add')}
          >
            <Plus className="w-4 h-4" />
            Catat Mutasi
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="card card-body bg-gradient-to-br from-blue-50 to-indigo-50 border-0">
          <p className="text-xs text-slate-500 mb-1">Total Mutasi</p>
          <p className="font-bold text-2xl text-indigo-700">{stats.totalMutations}</p>
          <p className="text-xs text-slate-400 mt-1">semua waktu</p>
        </div>
        <div className="card card-body bg-gradient-to-br from-green-50 to-emerald-50 border-0">
          <p className="text-xs text-slate-500 mb-1">Mutasi Tahun Ini</p>
          <p className="font-bold text-2xl text-emerald-700">{stats.thisYear}</p>
          <p className="text-xs text-slate-400 mt-1">transaksi</p>
        </div>
        <div className="card card-body bg-gradient-to-br from-purple-50 to-pink-50 border-0">
          <p className="text-xs text-slate-500 mb-1">Transfer Lokasi</p>
          <p className="font-bold text-2xl text-purple-700">{stats.transfers}</p>
          <p className="text-xs text-slate-400 mt-1">perpindahan</p>
        </div>
        <div className="card card-body bg-gradient-to-br from-red-50 to-orange-50 border-0">
          <p className="text-xs text-slate-500 mb-1">Pelepasan Aset</p>
          <p className="font-bold text-2xl text-red-700">{stats.disposals}</p>
          <p className="text-xs text-slate-400 mt-1">disposal & sale</p>
        </div>
      </div>

      {/* Type Filters */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setTypeFilter('ALL')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${typeFilter === 'ALL'
              ? 'bg-slate-700 text-white border-slate-700'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
        >
          Semua <span className="ml-1 opacity-60">{assetMutations.length}</span>
        </button>
        {MUTATION_TYPES.map(t => (
          <button
            key={t.value}
            onClick={() => setTypeFilter(t.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${typeFilter === t.value
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
          >
            {t.label}{' '}
            <span className="ml-1 opacity-60">
              {assetMutations.filter(m => m.mutationType === t.value).length}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-header">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Cari mutasi, aset, referensi…"
            className="w-80"
          />
          <span className="text-sm text-slate-400 ml-auto">{filtered.length} mutasi</span>
        </div>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th style={{ width: 110 }}>Tanggal</th>
                <th>Kode Aset</th>
                <th>Nama Aset</th>
                <th>Jenis Mutasi</th>
                <th>Detail Mutasi</th>
                <th className="text-right">Nilai</th>
                <th>Referensi</th>
                <th>Dibuat Oleh</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-14 text-slate-400">
                    <ArrowRightLeft className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p className="text-base font-medium mb-1">
                      {search ? 'Mutasi tidak ditemukan' : 'Belum ada mutasi aset'}
                    </p>
                    <p className="text-sm">
                      {search ? 'Coba kata kunci lain' : 'Klik "Catat Mutasi" untuk memulai'}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map(mutation => {
                  const asset = fixedAssets.find(a => a.id === mutation.assetId)
                  const mutationType = MUTATION_TYPES.find(t => t.value === mutation.mutationType)
                  const Icon = mutationType?.icon || FileText

                  let detailText = mutation.description
                  if (mutation.mutationType === 'TRANSFER') {
                    detailText = `${mutation.fromLocation || '?'} → ${mutation.toLocation || '?'}`
                  }

                  return (
                    <tr key={mutation.id} className="hover:bg-slate-50">
                      <td className="text-sm">{fmtDate(mutation.mutationDate)}</td>
                      <td className="font-mono text-xs text-primary-700 font-semibold">
                        {asset?.assetCode || '—'}
                      </td>
                      <td className="font-medium">{asset?.assetName || '—'}</td>
                      <td>
                        <span className={`badge ${MUTATION_COLORS[mutation.mutationType]} text-xs flex items-center gap-1 w-fit`}>
                          <Icon className="w-3 h-3" />
                          {mutationType?.label || mutation.mutationType}
                        </span>
                      </td>
                      <td className="text-sm text-slate-600">
                        {detailText}
                        {mutation.mutationType === 'SALE' && mutation.gainLossAmount !== null && (
                          <div className={`text-xs mt-1 font-semibold ${mutation.gainLossAmount >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                            {mutation.gainLossAmount >= 0 ? 'Laba' : 'Rugi'}: {fmtIDR(Math.abs(mutation.gainLossAmount))}
                          </div>
                        )}
                      </td>
                      <td className="text-right font-mono text-sm">
                        {mutation.disposalValue ? fmtIDR(mutation.disposalValue) :
                          mutation.amount ? fmtIDR(mutation.amount) : '—'}
                      </td>
                      <td className="text-sm text-slate-500">{mutation.referenceNumber || '—'}</td>
                      <td className="text-sm text-slate-500">{mutation.createdBy || '—'}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-blue-700">
          <p className="font-semibold mb-1">Tentang Mutasi Aset</p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li><strong>Transfer:</strong> Memindahkan aset antar lokasi tanpa mengubah nilai</li>
            <li><strong>Penjualan:</strong> Menjual aset, mencatat laba/rugi pelepasan, status → SOLD</li>
            <li><strong>Penghapusan:</strong> Menghapus aset (rusak/kadaluarsa), status → DISPOSED</li>
            <li><strong>Pembelian:</strong> Mencatat pembelian baru (opsional, bisa langsung di Inventarisasi)</li>
            <li>Mutasi disposal/sale otomatis membuat jurnal untuk laba/rugi pelepasan</li>
          </ul>
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <Modal
          open={true}
          title="Catat Mutasi Aset"
          onClose={() => setModal(null)}
          size="lg"
        >
          <MutationForm
            onSave={handleSave}
            onClose={() => setModal(null)}
            assets={fixedAssets.filter(a => a.status === 'ACTIVE')}
          />
        </Modal>
      )}
    </div>
  )
}
