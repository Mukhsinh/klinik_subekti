import { useState, useMemo } from 'react'
import { Plus, Pencil, Trash2, TrendingDown, Building2, AlertCircle, Download, XCircle } from 'lucide-react'
import { useStore } from '../../store/useStore'
import Modal from '../../components/ui/Modal'
import SearchInput from '../../components/ui/SearchInput'
import AssetDisposalWizard from '../../components/assets/AssetDisposalWizard'
import { fmtIDR, fmtDate, todayISO } from '../../utils/format'
import { exportAssetInventoryToExcel } from '../../utils/exportUtils'
import toast from 'react-hot-toast'

// Asset categories with COA-based prefix
const ASSET_CATEGORIES = [
  { label: 'Peralatan Medis', prefix: 'MED', coa: '1-14-001', depr: '6-21-001', accum: '1-15-001' },
  { label: 'Perabot & Perlengkapan', prefix: 'FRN', coa: '1-14-002', depr: '6-21-002', accum: '1-15-002' },
  { label: 'Kendaraan Dinas', prefix: 'VHC', coa: '1-14-003', depr: '6-21-003', accum: '1-15-003' },
  { label: 'Bangunan & Prasarana', prefix: 'BLD', coa: '1-14-004', depr: '6-21-004', accum: '1-15-004' },
  { label: 'Komputer & IT', prefix: 'COM', coa: '1-14-005', depr: '6-21-005', accum: '1-15-005' },
  { label: 'Lainnya', prefix: 'OTH', coa: '1-14-006', depr: '6-21-006', accum: '1-15-006' },
]
const CAT_MAP = Object.fromEntries(ASSET_CATEGORIES.map(c => [c.label, c]))

// Conditions
const CONDITIONS = ['BAIK', 'RUSAK', 'DALAM_PERBAIKAN']
const CONDITION_LABELS = { BAIK: 'Baik', RUSAK: 'Rusak', DALAM_PERBAIKAN: 'Dlm Perbaikan' }
const CONDITION_COLORS = { BAIK: 'badge-green', RUSAK: 'badge-red', DALAM_PERBAIKAN: 'badge-yellow' }

// ─── Asset Form Component ─────────────────────────────────
function AssetForm({ initial, onSave, onClose, coa, fixedAssets }) {
  const base = initial || {}
  const isEdit = !!base.id

  // Generate next code by category prefix
  const nextCodeForCategory = (catLabel) => {
    const cat = CAT_MAP[catLabel]
    if (!cat) return ''
    const prefix = cat.prefix
    const existing = (fixedAssets || [])
      .filter(a => a.category === catLabel)
      .map(a => { const m = (a.assetCode || '').match(/-0*(\d+)$/); return m ? parseInt(m[1]) : 0 })
    const max = existing.length > 0 ? Math.max(...existing) : 0
    return `${prefix}-${String(max + 1).padStart(4, '0')}`
  }

  const defaultCat = ASSET_CATEGORIES[0]
  const [form, setForm] = useState({
    assetCode: base.assetCode || (isEdit ? '' : nextCodeForCategory(defaultCat.label)),
    assetName: base.assetName || '',
    category: base.category || defaultCat.label,
    acquisitionCost: base.acquisitionCost || '',
    acquisitionDate: base.acquisitionDate || todayISO(),
    usefulLifeYears: base.usefulLifeYears || 5,
    qty: base.qty || 1,
    location: base.location || '',
    condition: base.condition || 'BAIK',
    description: base.description || '',
    coaAssetCode: base.coaAssetCode || defaultCat.coa,
    coaDepreciationCode: base.coaDepreciationCode || defaultCat.depr,
    coaAccumulatedCode: base.coaAccumulatedCode || defaultCat.accum,
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Auto-set COA based on category
  const handleCategoryChange = (catLabel) => {
    set('category', catLabel)
    const cat = CAT_MAP[catLabel]
    if (cat) {
      set('coaAssetCode', cat.coa)
      set('coaDepreciationCode', cat.depr)
      set('coaAccumulatedCode', cat.accum)
    }
    if (!isEdit) set('assetCode', nextCodeForCategory(catLabel))
  }

  const submit = (e) => {
    e.preventDefault()
    if (!form.assetName.trim()) { toast.error('Nama aset wajib diisi'); return }
    if (!form.acquisitionCost || parseFloat(form.acquisitionCost) <= 0) { toast.error('Harga perolehan harus > 0'); return }
    onSave({
      ...form,
      acquisitionCost: parseFloat(form.acquisitionCost),
      usefulLifeYears: parseInt(form.usefulLifeYears),
      qty: parseInt(form.qty) || 1,
    })
  }

  const monthlyDepr = form.acquisitionCost && form.usefulLifeYears
    ? parseFloat(form.acquisitionCost) / (parseInt(form.usefulLifeYears) * 12)
    : 0

  return (
    <form onSubmit={submit} className="space-y-4 max-h-[70vh] overflow-y-auto">
      {/* Kategori - di atas */}
      <div>
        <label className="form-label">Kategori Aset *</label>
        <select className="form-select" value={form.category} onChange={e => handleCategoryChange(e.target.value)}>
          {ASSET_CATEGORIES.map(c => (
            <option key={c.label} value={c.label}>{c.label} — prefix: {c.prefix}-</option>
          ))}
        </select>
      </div>

      {/* Kode otomatis banner */}
      <div className="p-3 rounded-xl bg-purple-600 text-white flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-purple-200">Kode Aset (Otomatis)</p>
          <p className="text-xl font-black font-mono">{form.assetCode || (isEdit ? '—' : '…')}</p>
        </div>
        <span className="text-xs bg-white/20 px-2 py-1 rounded-lg font-mono">
          {CAT_MAP[form.category]?.coa || '1-14-001'}
        </span>
      </div>

      {/* Nama Aset */}
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

      <div className="grid grid-cols-3 gap-4">
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
        <div>
          <label className="form-label">Qty / Jumlah Unit</label>
          <input
            type="number"
            className="form-input"
            value={form.qty}
            onChange={e => set('qty', e.target.value)}
            min={1}
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
        <label className="form-label">Keterangan</label>
        <textarea
          className="form-textarea"
          rows={2}
          value={form.description}
          onChange={e => set('description', e.target.value)}
          placeholder="Spesifikasi, nomor seri, dll…"
        />
      </div>

      <div className="bg-blue-600 text-white rounded-xl px-4 py-3 text-xs flex items-start gap-2">
        <TrendingDown className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div>
          <strong>Penyusutan Garis Lurus:</strong><br />
          Per bulan = <strong className="font-mono">{fmtIDR(monthlyDepr)}</strong><br />
          Akun: Dr {form.coaDepreciationCode} — Cr {form.coaAccumulatedCode}
        </div>
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
    (fixedAssets || [])
      .filter(a => a && a.status === 'ACTIVE')
      .filter(a => categoryFilter === 'ALL' || a.category === categoryFilter)
      .filter(a => !search ||
        (a.assetName || '').toLowerCase().includes(search.toLowerCase()) ||
        (a.assetCode || '').toLowerCase().includes(search.toLowerCase()) ||
        (a.location || '').toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => (a.assetCode || '').localeCompare(b.assetCode || '')),
    [fixedAssets, categoryFilter, search]
  )

  // Summary calculations
  const totalValue = (fixedAssets || [])
    .filter(a => a && a.status === 'ACTIVE')
    .reduce((s, a) => s + (Number(a.bookValue) || 0), 0)
  const totalAcquisition = (fixedAssets || [])
    .filter(a => a && a.status === 'ACTIVE')
    .reduce((s, a) => s + (Number(a.acquisitionCost) || 0), 0)
  const totalDepreciation = (fixedAssets || [])
    .filter(a => a && a.status === 'ACTIVE')
    .reduce((s, a) => s + (Number(a.accumulatedDepreciation) || 0), 0)

  // Handlers
  const handleSave = async (data) => {
    try {
      if (selected) {
        await updateAsset(selected.id, data)
        toast.success('Aset berhasil diperbarui')
      } else {
        // Check duplicate code
        if ((fixedAssets || []).find(a => a.assetCode === data.assetCode)) {
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

      {/* Summary Cards - Solid */}
      <div className="grid grid-cols-4 gap-4">
        <div className="card card-body bg-blue-600 text-white border-0">
          <p className="text-xs text-blue-100 mb-1">Total Aset Aktif</p>
          <p className="font-bold text-2xl">
            {fixedAssets.filter(a => a.status === 'ACTIVE').length}
          </p>
          <p className="text-xs text-blue-200 mt-1">unit aset tetap</p>
        </div>
        <div className="card card-body bg-emerald-600 text-white border-0">
          <p className="text-xs text-emerald-100 mb-1">Harga Perolehan</p>
          <p className="font-bold text-lg">{fmtIDR(totalAcquisition)}</p>
          <p className="text-xs text-emerald-200 mt-1">total investasi aset</p>
        </div>
        <div className="card card-body bg-amber-500 text-white border-0">
          <p className="text-xs text-amber-100 mb-1">Akum. Penyusutan</p>
          <p className="font-bold text-lg">{fmtIDR(totalDepreciation)}</p>
          <p className="text-xs text-amber-100 mt-1">s/d hari ini</p>
        </div>
        <div className="card card-body bg-purple-600 text-white border-0">
          <p className="text-xs text-purple-100 mb-1">Nilai Buku</p>
          <p className="font-bold text-lg">{fmtIDR(totalValue)}</p>
          <p className="text-xs text-purple-200 mt-1">nilai aset saat ini</p>
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
            key={c.label}
            onClick={() => setCategoryFilter(c.label)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${categoryFilter === c.label
              ? 'bg-primary-600 text-white border-primary-600'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
          >
            [{c.prefix}] {c.label}{' '}
            <span className="ml-1 opacity-60">
              {fixedAssets.filter(a => a.category === c.label && a.status === 'ACTIVE').length}
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
                <th style={{ width: 100 }}>Kode Aset</th>
                <th>Nama Aset</th>
                <th>Kategori</th>
                <th style={{ width: 50 }} className="text-center">Qty</th>
                <th>Lokasi</th>
                <th className="text-right">Harga Perolehan</th>
                <th>Tgl Perolehan</th>
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
                      <td>
                        <span className="badge badge-blue">{asset.category}</span>
                      </td>
                      <td className="text-center font-bold text-slate-700">{asset.qty || 1}</td>
                      <td className="text-sm text-slate-500">{asset.location || '—'}</td>
                      <td className="text-right font-mono text-sm">
                        {fmtIDR(asset.acquisitionCost)}
                      </td>
                      <td className="text-xs text-slate-500">{asset.acquisitionDate ? asset.acquisitionDate.slice(0, 10) : '—'}</td>
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
                        <span className={`badge ${CONDITION_COLORS[asset.condition]}`}>
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
            fixedAssets={fixedAssets}
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
