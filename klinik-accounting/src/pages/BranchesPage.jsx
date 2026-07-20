import { useState, useEffect } from 'react'
import { Building2, Plus, Pencil, MapPin, Phone, Mail, FileText, RefreshCw, Trash2 } from 'lucide-react'
import { useStore } from '../store/useStore'
import Modal from '../components/ui/Modal'
import { StatusBadge } from '../components/ui/Badge'
import toast from 'react-hot-toast'

function BranchForm({ initial = {}, onSave, onClose }) {
  const [form, setForm] = useState({
    entityName:     initial.entityName     || '',
    branchCode:     initial.branchCode     || '',
    address:        initial.address        || '',
    phone:          initial.phone          || '',
    email:          initial.email          || '',
    npwp:           initial.npwp           || '',
    sikNumber:      initial.sikNumber      || '',
    isHeadquarters: initial.isHeadquarters ?? false,
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = (e) => {
    e.preventDefault()
    if (!form.entityName.trim() || !form.branchCode.trim()) {
      toast.error('Nama entitas dan kode cabang wajib diisi.')
      return
    }
    onSave(form)
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="form-label">Nama Entitas Klinik *</label>
          <input
            className="form-input"
            value={form.entityName}
            onChange={e => set('entityName', e.target.value)}
            placeholder="Klinik Medis Antigravity — Cabang …"
            required
          />
        </div>
        <div>
          <label className="form-label">Kode Cabang *</label>
          <input
            className="form-input font-mono"
            value={form.branchCode}
            onChange={e => set('branchCode', e.target.value.toUpperCase())}
            placeholder="HQ-001 / BR-002"
            disabled={!!initial.branchCode}
            required
          />
          {initial.branchCode && (
            <p className="text-xs text-slate-400 mt-0.5">Kode cabang tidak dapat diubah.</p>
          )}
        </div>
        <div>
          <label className="form-label">NPWP</label>
          <input
            className="form-input"
            value={form.npwp}
            onChange={e => set('npwp', e.target.value)}
            placeholder="XX.XXX.XXX.X-XXX.XXX"
          />
        </div>
        <div className="col-span-2">
          <label className="form-label">Alamat Lengkap</label>
          <textarea
            className="form-textarea"
            rows={2}
            value={form.address}
            onChange={e => set('address', e.target.value)}
          />
        </div>
        <div>
          <label className="form-label">No. Telepon</label>
          <input
            className="form-input"
            value={form.phone}
            onChange={e => set('phone', e.target.value)}
          />
        </div>
        <div>
          <label className="form-label">Email</label>
          <input
            type="email"
            className="form-input"
            value={form.email}
            onChange={e => set('email', e.target.value)}
          />
        </div>
        <div>
          <label className="form-label">No. SIK / SIA / Izin Klinik</label>
          <input
            className="form-input"
            value={form.sikNumber}
            onChange={e => set('sikNumber', e.target.value)}
          />
        </div>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isHeadquarters}
              onChange={e => set('isHeadquarters', e.target.checked)}
              className="w-4 h-4 accent-primary-600"
            />
            <span className="text-sm text-slate-700">Kantor Pusat / Headquarters</span>
          </label>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn-secondary" onClick={onClose}>Batal</button>
        <button type="submit" className="btn-primary">Simpan Cabang</button>
      </div>
    </form>
  )
}

export default function BranchesPage() {
  const { branches, activeBranchId, setActiveBranch, addBranch, updateBranch, refreshAll } = useStore()
  const [modal,    setModal]    = useState(null) // null | 'add' | 'edit'
  const [selected, setSelected] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  // Debug: log branches data
  useEffect(() => {
    console.log('[BranchesPage] Current branches data:', branches)
    console.log('[BranchesPage] Active branch ID:', activeBranchId)
  }, [branches, activeBranchId])

  // Refresh data when page loads to ensure sync with database
  useEffect(() => {
    const refresh = async () => {
      setRefreshing(true)
      await refreshAll()
      setRefreshing(false)
    }
    refresh()
  }, [refreshAll])

  const handleRefresh = async () => {
    setRefreshing(true)
    console.log('[BranchesPage] Force refresh - clearing cache and reloading from DB')
    
    // Clear localStorage cache
    localStorage.removeItem('activeBranchId')
    
    await refreshAll()
    setRefreshing(false)
    toast.success('Data berhasil di-refresh dari database')
  }

  const handleClearCache = () => {
    if (window.confirm('Clear semua cache dan reload aplikasi dari database?\n\nIni akan mereset semua data ke state fresh dari database.')) {
      console.log('[BranchesPage] Clearing all cache...')
      
      // Clear localStorage
      localStorage.clear()
      
      // Reload page to force fresh bootstrap
      window.location.reload()
    }
  }

  const handleSave = (data) => {
    if (modal === 'add') {
      // Check duplicate code
      if (branches.find(b => b.branchCode === data.branchCode)) {
        toast.error(`Kode cabang ${data.branchCode} sudah digunakan.`)
        return
      }
      addBranch(data)
      toast.success(`Cabang ${data.entityName} berhasil ditambahkan.`)
    } else {
      updateBranch(selected.id, data)
      toast.success('Data cabang berhasil diperbarui.')
    }
    setModal(null)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Manajemen Cabang</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Multi-entitas — konsolidasi lintas cabang klinik. Data real-time dari database Supabase.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="btn-secondary text-red-600 hover:bg-red-50"
            onClick={handleClearCache}
            title="Clear cache & reload"
          >
            <Trash2 className="w-4 h-4" />
            Clear Cache
          </button>
          <button
            className="btn-secondary"
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh data dari database"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            className="btn-primary"
            onClick={() => { setSelected(null); setModal('add') }}
          >
            <Plus className="w-4 h-4" />Tambah Cabang
          </button>
        </div>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card card-body bg-blue-50 border-0">
          <p className="text-xs text-slate-500 mb-1">Total Cabang</p>
          <p className="font-bold text-2xl text-blue-700">{branches.length}</p>
          <p className="text-xs text-slate-400 mt-1">
            {branches.length === 0 ? 'Belum ada data' : 'Dari database'}
          </p>
        </div>
        <div className="card card-body bg-emerald-50 border-0">
          <p className="text-xs text-slate-500 mb-1">Cabang Aktif</p>
          <p className="font-bold text-2xl text-emerald-700">
            {branches.filter(b => b.isActive !== false).length}
          </p>
          <p className="text-xs text-slate-400 mt-1">Status aktif</p>
        </div>
        <div className="card card-body bg-purple-50 border-0">
          <p className="text-xs text-slate-500 mb-1">Cabang Aktif Saat Ini</p>
          <p className="font-semibold text-sm text-purple-700 mt-1 truncate">
            {branches.find(b => b.id === activeBranchId)?.branchCode || '—'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {branches.find(b => b.id === activeBranchId)?.entityName?.substring(0, 25) || 'Belum dipilih'}
          </p>
        </div>
      </div>

      {/* Info: Data source */}
      {branches.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
          <Building2 className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-blue-800">
            <p className="font-semibold">Data Real-time dari Supabase Database</p>
            <p className="text-blue-700 mt-0.5">
              Menampilkan {branches.length} cabang dari tabel <code className="bg-blue-100 px-1 rounded">clinic_entities</code>. 
              Pilihan cabang di header akan otomatis tersinkronisasi dengan data ini.
            </p>
            <details className="mt-2">
              <summary className="cursor-pointer text-blue-600 hover:text-blue-800 font-medium">
                🔍 Debug: Lihat Data Mentah
              </summary>
              <pre className="mt-2 p-2 bg-white rounded text-xs overflow-auto max-h-40 border border-blue-200">
{JSON.stringify(branches, null, 2)}
              </pre>
            </details>
          </div>
        </div>
      )}

      {/* Branch cards */}
      {refreshing ? (
        <div className="card card-body text-center py-16">
          <RefreshCw className="w-8 h-8 mx-auto mb-3 text-primary-600 animate-spin" />
          <p className="text-slate-500">Memuat data cabang dari database...</p>
        </div>
      ) : branches.length === 0 ? (
        <div className="card card-body text-center py-16">
          <Building2 className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="text-slate-500 mb-4">Belum ada data cabang di database</p>
          <button
            className="btn-primary mx-auto"
            onClick={() => { setSelected(null); setModal('add') }}
          >
            <Plus className="w-4 h-4" />Tambah Cabang Pertama
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
        {branches.map(b => (
          <div
            key={b.id}
            className={`card p-5 border-2 transition-all ${
              b.id === activeBranchId
                ? 'border-primary-400 shadow-lg shadow-primary-100'
                : 'border-slate-100'
            }`}
          >
            {/* Card header */}
            <div className="flex items-start justify-between mb-4">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                b.isHeadquarters ? 'bg-primary-100' : 'bg-slate-100'
              }`}>
                <Building2 className={`w-5 h-5 ${
                  b.isHeadquarters ? 'text-primary-600' : 'text-slate-500'
                }`} />
              </div>
              <div className="flex items-center gap-2">
                {b.isHeadquarters && (
                  <span className="badge badge-blue text-xs">Pusat</span>
                )}
                <StatusBadge status={b.isActive !== false ? 'ACTIVE' : 'INACTIVE'} />
              </div>
            </div>

            {/* Info */}
            <p className="font-semibold text-slate-800 mb-0.5 truncate">{b.entityName}</p>
            <p className="font-mono text-xs text-primary-600 mb-3">{b.branchCode}</p>

            <div className="space-y-1.5 text-xs text-slate-500 mb-4">
              {b.address && (
                <div className="flex items-start gap-1.5">
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span className="line-clamp-2">{b.address}</span>
                </div>
              )}
              {b.phone && (
                <div className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{b.phone}</span>
                </div>
              )}
              {b.email && (
                <div className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{b.email}</span>
                </div>
              )}
              {b.npwp && (
                <div className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>NPWP: {b.npwp}</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {b.id !== activeBranchId ? (
                <button
                  className="btn-primary py-1.5 text-xs flex-1 justify-center"
                  onClick={() => setActiveBranch(b.id)}
                >
                  Pilih Cabang Ini
                </button>
              ) : (
                <span className="text-xs text-primary-600 font-semibold flex-1 text-center py-1.5">
                  ✓ Cabang Aktif
                </span>
              )}
              <button
                className="btn-secondary py-1.5 px-3 text-xs"
                onClick={() => { setSelected(b); setModal('edit') }}
                title="Edit"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
      )}

      {/* Modal */}
      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal === 'add' ? 'Tambah Cabang Baru' : 'Edit Data Cabang'}
        size="md"
      >
        <BranchForm
          initial={modal === 'edit' ? selected : {}}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      </Modal>
    </div>
  )
}
