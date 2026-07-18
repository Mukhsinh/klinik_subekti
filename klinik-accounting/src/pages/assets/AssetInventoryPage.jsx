import { useState, useMemo } from 'react'
import { Plus, Pencil, Trash2, TrendingDown, Building2, AlertCircle, Download, XCircle } from 'lucide-react'
import { useStore } from '../../store/useStore'
import Modal from '../../components/ui/Modal'
import SearchInput from '../../components/ui/SearchInput'
import AssetDisposalWizard from '../../components/assets/AssetDisposalWizard'
import { fmtIDR, fmtDate, todayISO } from '../../utils/format'
import { exportAssetInventoryToExcel } from '../../utils/exportUtils'
import toast from 'react-hot-toast'

// Asset categories
const ASSET_CATEGORIES = [
  'Peralatan Medis',
  'Perabot & Perlengkapan',
  'Kendaraan',
  'Bangunan',
  'Komputer & Elektronik',
  'Lainnya'
]

// Conditions
const CONDITIONS = ['BAIK', 'RUSAK', 'DALAM_PERBAIKAN']
const CONDITION_LABELS = { BAIK: 'Baik', RUSAK: 'Rusak', DALAM_PERBAIKAN: 'Dalam Perbaikan' }
const CONDITION_COLORS = { BAIK: 'badge-green', RUSAK: 'badge-red', DALAM_PERBAIKAN: 'badge-yellow' }

// COA Mapping per kategori
const COA_MAPPING = {
  'Peralatan Medis': {
    asset: '1-14-001',
    depreciation: '6-21-001',
    accumulated: '1-15-001'
  },
  'Perabot & Perlengkapan': {
    asset: '1-14-002',
    depreciation: '6-21-002',
    accumulated: '1-15-002'
  },
  'Kendaraan': {
    asset: '1-14-003',
    depreciation: '6-21-003',
    accumulated: '1-15-003'
  },
  'Bangunan': {
    asset: '1-14-004',
    depreciation: '6-21-004',
    accumulated: '1-15-004'
  },
  'Komputer & Elektronik': {
    asset: '1-14-005',
    depreciation: '6-21-005',
    accumulated: '1-15-005'
  },
  'Lainnya': {
    asset: '1-14-001',
    depreciation: '6-21-001',
    accumulated: '1-15-001'
  }
}

// ─── Asset Form Component ─────────────────────────────────────
function AssetForm({ initial, onSave, onClose, coa, nextCode }) {
  const { generateAssetCode } = useStore()
  const base = initial || {}

  const [form, setForm] = useState({
    assetCode: base.assetCode || nextCode || '',
    assetName: base.assetName || '',
    category: base.category || 'Peralatan Medis',
    acquisitionCost: base.acquisitionCost || '',
    acquisitionDate: base.acquisitionDate || todayISO(),
    usefulLifeYears: base.usefulLifeYears || 5,
    location: base.location || '',
    department: base.department || '',
    condition: base.condition || 'BAIK',
    description: base.description || '',
    coaAssetCode: base.coaAssetCode || '1-14-001',
    coaDepreciationCode: base.coaDepreciationCode || '6-21-001',
    coaAccumulatedCode: base.coaAccumulatedCode || '1-15-001',
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Auto-set COA & Asset Code based on category
  const handleCategoryChange = (cat) => {
    set('category', cat)
    const mapping = COA_MAPPING[cat]
    if (mapping) {
      set('coaAssetCode', mapping.asset)
      set('coaDepreciationCode', mapping.depreciation)
      set('coaAccumulatedCode', mapping.accumulated)
    }
    if (!initial) {
      const code = generateAssetCode(cat)
      set('assetCode', code)
    }
  }

  const submit = (e) => {
    e.preventDefault()
    if (!form.assetCode.trim()) {
      toast.error('Kode aset wajib diisi')
      return
    }
    if (!form.assetName.trim()) {
      toast.error('Nama aset wajib diisi')
      return
    }
    if (!form.acquisitionCost || parseFloat(form.acquisitionCost) <= 0) {
      toast.error('Harga perolehan harus > 0')
      return
    }
    onSave({
      ...form,
      acquisitionCost: parseFloat(form.acquisitionCost),
      usefulLifeYears: parseInt(form.usefulLifeYears),
    })
  }

  const monthlyDepr = form.acquisitionCost && form.usefulLifeYears
    ? parseFloat(form.acquisitionCost) / (parseInt(form.usefulLifeYears) * 12)
    : 0
  const yearlyDepr = form.acquisitionCost && form.usefulLifeYears
    ? parseFloat(form.acquisitionCost) / parseInt(form.usefulLifeYears)
    : 0

  return (
    <form onSubmit={submit} className="space-y-4 max-h-[70vh] overflow-y-auto">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="form-label">Kode Aset *</label>
          <input
            className="form-input font-mono"
            value={form.assetCode}
            onChange={e => set('assetCode', e.target.value.toUpperCase())}
            placeholder="MED-0001"
            required
          />
        </div>
        <div>
          <label className="form-label">Kategori *</label>
          <select
            className="form-select"
            value={form.category}
            onChange={e => handleCategoryChange(e.target.value)}
          >
            {ASSET_CATEGORIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="form-label">Nama Aset *</label>
        <input
          className="form-input"
          value={form.assetName}
          onChange={e => set('assetName', e.target.value)}
          placeholder="Nama lengkap aset…"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="form-label">Harga Perolehan (Rp) *</label>
          <input
            type="number"
            className="form-input"
            value={form.acquisitionCost}
            onChange={e => set('acquisitionCost', e.target.value)}
            min={0}
            step={1000}
            required
          />
          <p className="text-xs text-slate-400 mt-1">Harga perolehan = Saldo awal aset</p>
        </div>
        <div>
          <label className="form-label">Tanggal Perolehan *</label>
          <input
            type="date"
            className="form-input"
            value={form.acquisitionDate}
            onChange={e => set('acquisitionDate', e.target.value)}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="form-label">Umur Ekonomis (Tahun) *</label>
          <input
            type="number"
            className="form-input"
            value={form.usefulLifeYears}
            onChange={e => set('usefulLifeYears', e.target.value)}
            min={1}
            max={50}
            required
          />
        </div>
        <div>
          <label className="form-label">Lokasi Aset</label>
          <input
            className="form-input"
            value={form.location}
            onChange={e => set('location', e.target.value)}
            placeholder="Ruang/Lokasi…"
          />
        </div>
        <div>
          <label className="form-label">Kondisi</label>
          <select
            className="form-select"
            value={form.condition}
            onChange={e => set('condition', e.target.value)}
          >
            {CONDITIONS.map(c => (
              <option key={c} value={c}>{CONDITION_LABELS[c]}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="form-label">Departemen</label>
        <input
          className="form-input"
          value={form.department}
          onChange={e => set('department', e.target.value)}
          placeholder="Departemen pengguna…"
        />
      </div>

      <div>
        <label className="form-label">Keterangan</label>
        <textarea
          className="form-textarea"
          rows={2}
          value={form.description}
          onChange={e => set('description', e.target.value)}
          placeholder="Spesifikasi, nomor seri, dll…"
        />
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-700">
        <div className="flex items-start gap-2">
          <TrendingDown className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <strong>Penyusutan Garis Lurus (Tanpa Nilai Residu):</strong><br />
            Beban per bulan = <strong className="font-mono">{fmtIDR(monthlyDepr)}</strong><br />
            Beban per tahun = <strong className="font-mono">{fmtIDR(yearlyDepr)}</strong>
          </div>
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-600">
        <strong>Akun COA Terkait:</strong><br />
        • Aset: {form.coaAssetCode}<br />
        • Beban Penyusutan: {form.coaDepreciationCode}<br />
        • Akumulasi Penyusutan: {form.coaAccumulatedCode}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn-secondary" onClick={onClose}>
          Batal
        </button>
        <button type="submit" className="btn-primary">
          Simpan Aset
        </button>
      </div>
    </form>
  )
}

// ─── Main Page ────────────────────────────────────────────────
export default function AssetInventoryPage() {
  const {
    fixedAssets,
    coa,
    addAsset,
    updateAsset,
    deleteAsset,
    addAssetMutation,
    generateAssetCode,
    generateEntryNumber,
    loading
  } = useStore()

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)

  // Filter assets
  const filtered = useMemo(() =>
    fixedAssets
      .filter(a => a.status === 'ACTIVE')
      .filter(a => categoryFilter === 'ALL' || a.category === categoryFilter)
      .filter(a => !search ||
        a.assetName.toLowerCase().includes(search.toLowerCase()) ||
        a.assetCode.toLowerCase().includes(search.toLowerCase()) ||
        (a.location || '').toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => a.assetCode.localeCompare(b.assetCode)),
    [fixedAssets, categoryFilter, search]
  )

  // Generate next code
  const nextCode = useMemo(() => {
    const category = categoryFilter === 'ALL' ? 'Peralatan Medis' : categoryFilter
    return generateAssetCode(category)
  }, [categoryFilter, generateAssetCode])

  // Summary calculations
  const totalValue = fixedAssets
    .filter(a => a.status === 'ACTIVE')
    .reduce((s, a) => s + (a.bookValue || 0), 0)
  const totalAcquisition = fixedAssets
    .filter(a => a.status === 'ACTIVE')
    .reduce((s, a) => s + a.acquisitionCost, 0)
  const totalDepreciation = fixedAssets
    .filter(a => a.status === 'ACTIVE')
    .reduce((s, a) => s + (a.accumulatedDepreciation || 0), 0)

  // Handlers
  const handleSave = async (data) => {
    try {
      if (selected) {
        await updateAsset(selected.id, data)
        toast.success('Aset berhasil diperbarui')
      } else {
        // Check duplicate code
        if (fixedAssets.find(a => a.assetCode === data.assetCode)) {
          toast.error(`Kode aset ${data.assetCode} sudah digunakan`)
          return
        }
        await addAsset(data)
        toast.success('Aset berhasil ditambahkan')
      }
      setModal(null)
      setSelected(null)
    } catch (error) {
      toast.error('Gagal menyimpan aset: ' + error.message)
    }
  }

  const handleDelete = async (asset) => {
    if (!confirm(`Hapus aset ${asset.assetName}?\n\nAset yang sudah memiliki riwayat penyusutan sebaiknya tidak dihapus. Gunakan fitur pelepasan aset untuk mencatat penjualan/penghapusan.`)) {
      return
    }
    try {
      await deleteAsset(asset.id)
      toast.success('Aset berhasil dihapus')
    } catch (error) {
      toast.error('Gagal menghapus aset: ' + error.message)
    }
  }

  const handleDisposal = async (disposalData) => {
    try {
      const { asset, disposalMethod, disposalDate, disposalValue, bookValue, gainLoss, referenceNumber, buyerName, description, reason } = disposalData

      // Create mutation record
      await addAssetMutation({
        assetId: asset.id,
        mutationType: disposalMethod,
        mutationDate: disposalDate,
        referenceNumber,
        description: `${reason}${description ? '\n\n' + description : ''}${buyerName ? '\n\nPembeli: ' + buyerName : ''}`,
        disposalValue,
        gainLossAmount: gainLoss,
        createdBy: 'System',
        authorizedBy: 'System',
      })

      // Update asset status
      await updateAsset(asset.id, {
        status: disposalMethod === 'SALE' ? 'SOLD' : 'DISPOSED',
        disposalDate,
        disposalValue,
        disposalMethod,
      })

      toast.success(`Pelepasan aset berhasil dicatat. ${gainLoss > 0 ? 'Laba' : gainLoss < 0 ? 'Rugi' : 'Impas'}: ${fmtIDR(Math.abs(gainLoss))}`)
      setModal(null)
    } catch (error) {
      toast.error('Gagal menyimpan pelepasan aset: ' + error.message)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-slate-500">Memuat data aset...</p>
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
            <Building2 className="w-7 h-7 text-primary-600" />
            Inventarisasi Aset Tetap
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Manajemen aset tetap & kalkulasi penyusutan metode garis lurus — Terintegrasi Supabase
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="btn-secondary"
            onClick={() => setModal('disposal')}
            disabled={fixedAssets.filter(a => a.status === 'ACTIVE').length === 0}
          >
            <XCircle className="w-4 h-4" />
            Pelepasan Aset
          </button>
          <button
            className="btn-secondary"
            onClick={() => {
              exportAssetInventoryToExcel(fixedAssets.filter(a => a.status === 'ACTIVE'), coa)
              toast.success('Data berhasil di-export ke Excel')
            }}
            disabled={fixedAssets.filter(a => a.status === 'ACTIVE').length === 0}
          >
            <Download className="w-4 h-4" />
            Export Excel
          </button>
          <button
            className="btn-primary"
            onClick={() => {
              setSelected(null)
              setModal('add')
            }}
          >
            <Plus className="w-4 h-4" />
            Tambah Aset
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="card card-body bg-gradient-to-br from-blue-50 to-indigo-50 border-0">
          <p className="text-xs text-slate-500 mb-1">Total Aset Aktif</p>
          <p className="font-bold text-2xl text-indigo-700">
            {fixedAssets.filter(a => a.status === 'ACTIVE').length}
          </p>
          <p className="text-xs text-slate-400 mt-1">unit aset tetap</p>
        </div>
        <div className="card card-body bg-gradient-to-br from-emerald-50 to-teal-50 border-0">
          <p className="text-xs text-slate-500 mb-1">Harga Perolehan</p>
          <p className="font-bold text-lg text-emerald-700">{fmtIDR(totalAcquisition)}</p>
          <p className="text-xs text-slate-400 mt-1">total investasi aset</p>
        </div>
        <div className="card card-body bg-gradient-to-br from-amber-50 to-orange-50 border-0">
          <p className="text-xs text-slate-500 mb-1">Akum. Penyusutan</p>
          <p className="font-bold text-lg text-amber-700">{fmtIDR(totalDepreciation)}</p>
          <p className="text-xs text-slate-400 mt-1">total penyusutan s/d hari ini</p>
        </div>
        <div className="card card-body bg-gradient-to-br from-purple-50 to-pink-50 border-0">
          <p className="text-xs text-slate-500 mb-1">Nilai Buku</p>
          <p className="font-bold text-lg text-purple-700">{fmtIDR(totalValue)}</p>
          <p className="text-xs text-slate-400 mt-1">nilai aset saat ini</p>
        </div>
      </div>

      {/* Category Filters */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setCategoryFilter('ALL')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${categoryFilter === 'ALL'
            ? 'bg-slate-700 text-white border-slate-700'
            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
        >
          Semua <span className="ml-1 opacity-60">{fixedAssets.filter(a => a.status === 'ACTIVE').length}</span>
        </button>
        {ASSET_CATEGORIES.map(c => (
          <button
            key={c}
            onClick={() => setCategoryFilter(c)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${categoryFilter === c
              ? 'bg-primary-600 text-white border-primary-600'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
          >
            {c}{' '}
            <span className="ml-1 opacity-60">
              {fixedAssets.filter(a => a.category === c && a.status === 'ACTIVE').length}
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
            placeholder="Cari kode, nama, lokasi…"
            className="w-80"
          />
          <span className="text-sm text-slate-400 ml-auto">{filtered.length} aset</span>
        </div>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th style={{ width: 110 }}>Kode Aset</th>
                <th>Nama Aset</th>
                <th>Kategori</th>
                <th>Lokasi</th>
                <th className="text-right">Harga Perolehan</th>
                <th className="text-right">Umur (Thn)</th>
                <th className="text-right">Akum. Penyusutan</th>
                <th className="text-right">Nilai Buku</th>
                <th>Kondisi</th>
                <th className="text-center" style={{ width: 90 }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-14 text-slate-400">
                    <Building2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p className="text-base font-medium mb-1">
                      {search ? 'Aset tidak ditemukan' : 'Belum ada aset tetap'}
                    </p>
                    <p className="text-sm">
                      {search ? 'Coba kata kunci lain' : 'Klik tombol "Tambah Aset" untuk memulai'}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map(asset => {
                  const depreciationPercentage = asset.acquisitionCost > 0
                    ? ((asset.accumulatedDepreciation || 0) / asset.acquisitionCost) * 100
                    : 0

                  return (
                    <tr key={asset.id} className="hover:bg-slate-50">
                      <td className="font-mono text-xs text-primary-700 font-semibold">
                        {asset.assetCode}
                      </td>
                      <td className="font-medium">{asset.assetName}</td>
                      <td className="text-sm text-slate-600">{asset.category}</td>
                      <td className="text-sm text-slate-500">{asset.location || '—'}</td>
                      <td className="text-right font-mono text-sm">
                        {fmtIDR(asset.acquisitionCost)}
                      </td>
                      <td className="text-right text-sm">{asset.usefulLifeYears}</td>
                      <td className="text-right font-mono text-sm text-amber-700">
                        {fmtIDR(asset.accumulatedDepreciation || 0)}
                        <div className="text-xs text-slate-400 mt-0.5">
                          {depreciationPercentage.toFixed(1)}%
                        </div>
                      </td>
                      <td className="text-right font-mono font-semibold text-sm text-purple-700">
                        {fmtIDR(asset.bookValue || asset.acquisitionCost)}
                      </td>
                      <td>
                        <span className={`badge ${CONDITION_COLORS[asset.condition]} text-xs`}>
                          {CONDITION_LABELS[asset.condition]}
                        </span>
                      </td>
                      <td className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => {
                              setSelected(asset)
                              setModal('edit')
                            }}
                            className="p-1.5 hover:bg-blue-50 hover:text-blue-600 rounded transition-colors"
                            title="Edit aset"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(asset)}
                            className="p-1.5 hover:bg-red-50 hover:text-red-600 rounded transition-colors"
                            title="Hapus aset"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info Box */}
      {fixedAssets.filter(a => a.status === 'ACTIVE').length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-700">
            <p className="font-semibold mb-1">Informasi Penyusutan</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Metode penyusutan: <strong>Garis Lurus tanpa Nilai Residu</strong></li>
              <li>Kalkulasi otomatis: Harga Perolehan ÷ (Umur Ekonomis × 12 bulan)</li>
              <li>Gunakan menu <strong>Penyusutan Aset</strong> untuk mencatat beban penyusutan bulanan</li>
              <li>Jurnal otomatis: Debit Beban Penyusutan, Kredit Akumulasi Penyusutan</li>
            </ul>
          </div>
        </div>
      )}

      {/* Modal */}
      {modal === 'add' || modal === 'edit' ? (
        <Modal
          open={true}
          title={selected ? `Edit Aset — ${selected.assetCode}` : 'Tambah Aset Baru'}
          onClose={() => {
            setModal(null)
            setSelected(null)
          }}
          size="lg"
        >
          <AssetForm
            initial={selected}
            onSave={handleSave}
            onClose={() => {
              setModal(null)
              setSelected(null)
            }}
            coa={coa}
            nextCode={nextCode}
          />
        </Modal>
      ) : modal === 'disposal' ? (
        <Modal
          open={true}
          title="Wizard Pelepasan Aset"
          onClose={() => setModal(null)}
          size="xl"
        >
          <AssetDisposalWizard
            assets={fixedAssets.filter(a => a.status === 'ACTIVE')}
            onComplete={handleDisposal}
            onCancel={() => setModal(null)}
          />
        </Modal>
      ) : null}
    </div>
  )
}
