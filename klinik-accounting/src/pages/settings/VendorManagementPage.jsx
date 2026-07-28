import { useState, useMemo, useEffect } from 'react'
import { Plus, Pencil, PowerOff, Building2, Phone, Mail, FileText } from 'lucide-react'
import { useStore } from '../../store/useStore'
import Modal from '../../components/ui/Modal'
import SearchInput from '../../components/ui/SearchInput'
import { StatusBadge } from '../../components/ui/Badge'
import toast from 'react-hot-toast'
import { v4 as uuidv4 } from 'uuid'

function VendorForm({ initial = {}, onSave, onClose, isEdit = false, nextCode }) {
    const [form, setForm] = useState({
        code: initial.code || nextCode || '',
        name: initial.name || '',
        address: initial.address || '',
        npwp: initial.npwp || '',
        phone: initial.phone || '',
    })
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

    const submit = (e) => {
        e.preventDefault()
        if (!form.name.trim()) { toast.error('Nama vendor wajib diisi.'); return }
        onSave(form)
    }

    return (
        <form onSubmit={submit} className="space-y-4">
            <div>
                <label className="form-label">Kode Vendor</label>
                <input className="form-input font-mono bg-slate-50" value={form.code} readOnly />
            </div>
            <div>
                <label className="form-label">Nama Vendor *</label>
                <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)}
                    placeholder="Nama vendor atau PT/CV distributor…" required />
            </div>
            <div>
                <label className="form-label">No. Telepon / HP</label>
                <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input className="form-input pl-9" value={form.phone} onChange={e => set('phone', e.target.value)}
                        placeholder="08xxxxxxxx / 021-xxxxxx" />
                </div>
            </div>
            <div>
                <label className="form-label">NPWP Vendor</label>
                <div className="relative">
                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input className="form-input pl-9 font-mono" value={form.npwp} onChange={e => set('npwp', e.target.value)}
                        placeholder="00.000.000.0-000.000" />
                </div>
            </div>
            <div>
                <label className="form-label">Alamat</label>
                <textarea className="form-textarea" rows={3} value={form.address} onChange={e => set('address', e.target.value)}
                    placeholder="Alamat kantor / gudang supplier…" />
            </div>

            <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn-secondary" onClick={onClose}>Batal</button>
                <button type="submit" className="btn-primary">{isEdit ? 'Simpan Perubahan' : 'Tambah Vendor'}</button>
            </div>
        </form>
    )
}

export default function VendorManagementPage() {
    const { vendors, addVendor, updateVendor, logActivity } = useStore()
    const [search, setSearch] = useState('')
    const [modal, setModal] = useState(null)
    const [selected, setSelected] = useState(null)

    const filtered = useMemo(() =>
        (vendors || [])
            .filter(v => !search ||
                v.name?.toLowerCase().includes(search.toLowerCase()) ||
                v.code?.toLowerCase().includes(search.toLowerCase()) ||
                v.address?.toLowerCase().includes(search.toLowerCase()) ||
                v.npwp?.toLowerCase().includes(search.toLowerCase())
            )
            .sort((a, b) => (a.code || '').localeCompare(b.code || '')),
        [vendors, search])

    const nextCode = useMemo(() => {
        const count = (vendors || []).length + 1
        return `VND-${String(count).padStart(3, '0')}`
    }, [vendors])

    const handleSave = async (data) => {
        try {
            const isEdit = modal === 'edit'
            if (isEdit) {
                await updateVendor(selected.id, data)
                toast.success('Informasi vendor berhasil diperbarui.')
                logActivity('UBAH_VENDOR', 'Manajemen Vendor', `Update vendor: ${data.name}`)
            } else {
                await addVendor(data)
                toast.success(`Vendor ${data.name} berhasil ditambahkan.`)
                logActivity('TAMBAH_VENDOR', 'Manajemen Vendor', `Tambah vendor: ${data.name}`)
            }
            setModal(null)
        } catch (err) {
            toast.error(`Gagal menyimpan: ${err.message}`)
        }
    }

    const handleToggleActive = async (vendor) => {
        const nextStatus = !vendor.isActive
        if (!window.confirm(`${nextStatus ? 'Aktifkan' : 'Nonaktifkan'} vendor ${vendor.name}?`)) return
        try {
            await updateVendor(vendor.id, { isActive: nextStatus })
            logActivity(nextStatus ? 'AKTIFKAN_VENDOR' : 'NONAKTIF_VENDOR', 'Manajemen Vendor', `${nextStatus ? 'Aktifkan' : 'Nonaktifkan'} vendor: ${vendor.name}`)
            toast.success(`Vendor telah ${nextStatus ? 'diaktifkan' : 'dinonaktifkan'}.`)
        } catch (err) {
            toast.error(err.message)
        }
    }

    return (
        <div className="space-y-5">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="page-title">Manajemen Vendor / PBF</h1>
                    <p className="text-sm text-slate-400 mt-0.5">
                        Daftar PBF distributor, supplier obat, dan rekanan pengeluaran beban klinik
                    </p>
                </div>
                <button className="btn-danger-red" onClick={() => { setSelected(null); setModal('add') }}>
                    <Plus className="w-4 h-4" />Tambah Vendor
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4">
                <div className="card card-body bg-blue-500 text-white border-0 shadow-sm">
                    <p className="text-xs text-blue-100 mb-1 font-semibold uppercase tracking-wider">Total Vendor</p>
                    <p className="font-extrabold text-3xl font-mono text-white">{(vendors || []).length}</p>
                </div>
                <div className="card card-body bg-emerald-500 text-white border-0 shadow-sm">
                    <p className="text-xs text-emerald-100 mb-1 font-semibold uppercase tracking-wider">Vendor Aktif</p>
                    <p className="font-extrabold text-3xl font-mono text-white">{(vendors || []).filter(v => v.isActive !== false).length}</p>
                </div>
                <div className="card card-body bg-purple-500 text-white border-0 shadow-sm">
                    <p className="text-xs text-purple-100 mb-1 font-semibold uppercase tracking-wider">NPWP Terdaftar</p>
                    <p className="font-extrabold text-3xl font-mono text-white">{(vendors || []).filter(v => v.npwp && v.npwp.trim()).length}</p>
                </div>
            </div>

            <div className="card">
                <div className="card-header">
                    <SearchInput value={search} onChange={setSearch} placeholder="Cari nama, alamat, NPWP vendor…" className="w-80" />
                    <span className="text-sm text-slate-400 ml-auto">{filtered.length} vendor</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="table-base">
                        <thead>
                            <tr>
                                <th>Kode</th>
                                <th>Nama Vendor</th>
                                <th>No. Telepon</th>
                                <th>NPWP Vendor</th>
                                <th>Alamat</th>
                                <th className="text-center">Status</th>
                                <th className="text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-16 text-slate-400">
                                        <Building2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                        {search ? 'Vendor tidak ditemukan' : 'Belum ada data vendor — klik Tambah Vendor untuk memulai'}
                                    </td>
                                </tr>
                            ) : filtered.map(v => (
                                <tr key={v.id}>
                                    <td className="font-mono text-xs text-primary-700 font-bold">{v.code}</td>
                                    <td className="text-sm font-bold text-slate-800">{v.name}</td>
                                    <td className="text-sm">
                                        {v.phone ? (
                                            <div className="flex items-center gap-1 text-slate-700 font-medium">
                                                <Phone className="w-3.5 h-3.5 text-slate-400" /> {v.phone}
                                            </div>
                                        ) : '—'}
                                    </td>
                                    <td className="font-mono text-xs text-slate-500">{v.npwp || '—'}</td>
                                    <td className="text-xs text-slate-500 max-w-[200px] truncate" title={v.address}>{v.address || '—'}</td>
                                    <td className="text-center">
                                        <StatusBadge status={v.isActive !== false ? 'ACTIVE' : 'INACTIVE'} />
                                    </td>
                                    <td className="text-center">
                                        <div className="flex items-center justify-center gap-1.5">
                                            <button className="btn-action-edit" onClick={() => { setSelected(v); setModal('edit') }} title="Edit">
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                            <button className="btn-action-delete" onClick={() => handleToggleActive(v)} title={v.isActive !== false ? 'Nonaktifkan' : 'Aktifkan'}>
                                                <PowerOff className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <Modal
                open={!!modal}
                onClose={() => setModal(null)}
                title={modal === 'add' ? 'Tambah Vendor Baru' : `Edit Data Vendor — ${selected?.name}`}
                size="md"
            >
                <VendorForm
                    initial={modal === 'edit' ? selected : {}}
                    onSave={handleSave}
                    onClose={() => setModal(null)}
                    isEdit={modal === 'edit'}
                    nextCode={nextCode}
                />
            </Modal>
        </div>
    )
}
