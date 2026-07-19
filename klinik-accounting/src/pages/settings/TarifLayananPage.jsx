import { useState, useMemo, useEffect } from 'react'
import { Plus, Pencil, PowerOff, ShieldCheck, DollarSign } from 'lucide-react'
import { useStore } from '../../store/useStore'
import Modal from '../../components/ui/Modal'
import SearchInput from '../../components/ui/SearchInput'
import SearchableSelect from '../../components/ui/SearchableSelect'
import { StatusBadge } from '../../components/ui/Badge'
import { fmtIDR } from '../../utils/format'
import toast from 'react-hot-toast'
import { v4 as uuidv4 } from 'uuid'

const SERVICE_CATEGORIES = [
    { value: 'KONSULTASI_UMUM', label: 'Konsultasi Dokter Umum' },
    { value: 'KONSULTASI_SPESIALIS', label: 'Konsultasi Dokter Spesialis' },
    { value: 'TINDAKAN_MEDIS_MINOR', label: 'Tindakan Medis Minor' },
    { value: 'TINDAKAN_MEDIS_MAYOR', label: 'Tindakan Medis Mayor' },
    { value: 'IMUNISASI_VAKSINASI', label: 'Imunisasi & Vaksinasi' },
    { value: 'MCU', label: 'MCU (Medical Check Up)' },
    { value: 'KLINIK_GIGI', label: 'Klinik Gigi' },
    { value: 'LABORATORIUM', label: 'Pemeriksaan Laboratorium' },
    { value: 'LAINNYA', label: 'Lainnya' },
]

function ServiceTariffForm({ initial = {}, onSave, onClose, isEdit = false, nextCode, revenueAccounts }) {
    const [form, setForm] = useState({
        code: initial.code || nextCode || '',
        name: initial.name || '',
        price: initial.price || '',
        serviceCategory: initial.serviceCategory || 'KONSULTASI_UMUM',
        revenueAccountCode: initial.revenueAccountCode || '4-11-001',
    })
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

    const submit = (e) => {
        e.preventDefault()
        if (!form.name.trim()) { toast.error('Nama layanan wajib diisi.'); return }
        if (!(parseFloat(form.price) >= 0)) { toast.error('Tarif layanan harus bernilai 0 atau lebih.'); return }
        if (!form.serviceCategory) { toast.error('Kategori layanan wajib dipilih.'); return }
        if (!form.revenueAccountCode) { toast.error('Akun pendapatan wajib dipilih.'); return }
        onSave({ 
            ...form, 
            price: parseFloat(form.price),
            service_category: form.serviceCategory,
            revenue_account_code: form.revenueAccountCode
        })
    }

    return (
        <form onSubmit={submit} className="space-y-4">
            <div>
                <label className="form-label">Kode Layanan</label>
                <input className="form-input font-mono bg-slate-50" value={form.code} readOnly />
            </div>
            
            <div>
                <label className="form-label">Kategori Layanan *</label>
                <select 
                    className="form-select" 
                    value={form.serviceCategory} 
                    onChange={e => set('serviceCategory', e.target.value)}
                    required
                >
                    {SERVICE_CATEGORIES.map(cat => (
                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                    Kategori ini akan memudahkan pengelompokan layanan dan pelaporan
                </p>
            </div>

            <div>
                <label className="form-label">Nama Layanan *</label>
                <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)}
                    placeholder="Nama layanan medis…" required />
            </div>
            
            <div>
                <label className="form-label">Tarif Layanan (Rp) *</label>
                <input type="number" className="form-input" value={form.price} onChange={e => set('price', e.target.value)}
                    placeholder="Tarif layanan dalam rupiah…" min={0} step={1000} required />
            </div>

            <div>
                <label className="form-label">Akun Pendapatan (COA) *</label>
                <SearchableSelect
                    value={form.revenueAccountCode}
                    onChange={val => set('revenueAccountCode', val)}
                    options={revenueAccounts}
                    placeholder="— Pilih akun pendapatan —"
                    searchPlaceholder="Cari akun pendapatan..."
                    required
                />
                <p className="text-xs text-slate-500 mt-1">
                    Akun ini akan digunakan saat membuat jurnal entry dari billing/kasir
                </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn-secondary" onClick={onClose}>Batal</button>
                <button type="submit" className="btn-primary">{isEdit ? 'Simpan Perubahan' : 'Tambah Layanan'}</button>
            </div>
        </form>
    )
}

export default function TarifLayananPage() {
    const { serviceTariffs, coa, addServiceTariff, updateServiceTariff, logActivity } = useStore()
    const [search, setSearch] = useState('')
    const [modal, setModal] = useState(null)
    const [selected, setSelected] = useState(null)

    // Filter revenue accounts (type REVENUE)
    const revenueAccounts = useMemo(() => 
        (coa || [])
            .filter(a => a.accountType === 'REVENUE' && a.isActive !== false && !a.isHeader)
            .map(a => ({ 
                value: a.accountCode, 
                label: `${a.accountCode} — ${a.accountName}`
            }))
            .sort((a, b) => a.value.localeCompare(b.value)),
        [coa])

    const filtered = useMemo(() =>
        (serviceTariffs || [])
            .filter(s => !search ||
                s.name?.toLowerCase().includes(search.toLowerCase()) ||
                s.code?.toLowerCase().includes(search.toLowerCase())
            )
            .sort((a, b) => (a.code || '').localeCompare(b.code || '')),
        [serviceTariffs, search])

    const nextCode = useMemo(() => {
        const activeLength = (serviceTariffs || []).length
        return `SVC-${String(activeLength + 1).padStart(3, '0')}`
    }, [serviceTariffs])
    
    const getCategoryLabel = (category) => {
        const cat = SERVICE_CATEGORIES.find(c => c.value === category)
        return cat ? cat.label : category
    }

    const handleSave = async (data) => {
        try {
            const isEdit = modal === 'edit'
            if (isEdit) {
                await updateServiceTariff(selected.id, data)
                toast.success('Tarif layanan berhasil diperbarui.')
                logActivity('UBAH_TARIF_LAYANAN', 'Manajemen Tarif Layanan', `Update layanan: ${data.name}`)
            } else {
                await addServiceTariff(data)
                toast.success(`Layanan ${data.name} berhasil ditambahkan.`)
                logActivity('TAMBAH_TARIF_LAYANAN', 'Manajemen Tarif Layanan', `Tambah layanan: ${data.name}`)
            }
            setModal(null)
        } catch (err) {
            toast.error(`Gagal menyimpan: ${err.message}`)
        }
    }

    const handleToggleActive = async (service) => {
        const nextStatus = !service.isActive
        if (!window.confirm(`${nextStatus ? 'Aktifkan' : 'Nonaktifkan'} layanan ${service.name}?`)) return
        try {
            await updateServiceTariff(service.id, { isActive: nextStatus })
            logActivity(nextStatus ? 'AKTIFKAN_TARIF_LAYANAN' : 'NONAKTIF_TARIF_LAYANAN', 'Manajemen Tarif Layanan', `${nextStatus ? 'Aktifkan' : 'Nonaktifkan'} layanan: ${service.name}`)
            toast.success(`Layanan telah ${nextStatus ? 'diaktifkan' : 'dinonaktifkan'}.`)
        } catch (err) {
            toast.error(err.message)
        }
    }

    return (
        <div className="space-y-5">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="page-title">Manajemen Tarif Layanan</h1>
                    <p className="text-sm text-slate-400 mt-0.5">
                        Tarif dan biaya administrasi layanan medis terintegrasi dengan loket kasir &amp; billing
                    </p>
                </div>
                <button className="btn-primary" onClick={() => { setSelected(null); setModal('add') }}>
                    <Plus className="w-4 h-4" />Tambah Layanan
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4">
                <div className="card card-body bg-blue-50 border-0">
                    <p className="text-xs text-slate-500 mb-1">Total Layanan</p>
                    <p className="font-bold text-2xl text-blue-700">{(serviceTariffs || []).length}</p>
                </div>
                <div className="card card-body bg-emerald-50 border-0">
                    <p className="text-xs text-slate-500 mb-1">Layanan Aktif</p>
                    <p className="font-bold text-2xl text-emerald-700">{(serviceTariffs || []).filter(s => s.isActive !== false).length}</p>
                </div>
                <div className="card card-body bg-purple-50 border-0">
                    <p className="text-xs text-slate-500 mb-1">Rata-rata Tarif</p>
                    <p className="font-bold text-2xl text-purple-700">
                        {fmtIDR((serviceTariffs || []).reduce((acc, current) => acc + (current.price || 0), 0) / ((serviceTariffs || []).length || 1))}
                    </p>
                </div>
            </div>

            <div className="card">
                <div className="card-header">
                    <SearchInput value={search} onChange={setSearch} placeholder="Cari nama atau kode layanan…" className="w-80" />
                    <span className="text-sm text-slate-400 ml-auto">{filtered.length} layanan</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="table-base">
                        <thead>
                            <tr>
                                <th>Kode</th>
                                <th>Kategori</th>
                                <th>Nama Layanan</th>
                                <th className="text-right">Tarif</th>
                                <th>Akun Pendapatan</th>
                                <th className="text-center">Status</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-16 text-slate-400">
                                        <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                        {search ? 'Layanan tidak ditemukan' : 'Belum ada tarif layanan — klik Tambah Layanan untuk memulai'}
                                    </td>
                                </tr>
                            ) : filtered.map(s => (
                                <tr key={s.id}>
                                    <td className="font-mono text-xs text-primary-700 font-medium">{s.code}</td>
                                    <td>
                                        <span className="badge badge-blue text-xs">
                                            {getCategoryLabel(s.serviceCategory || s.service_category)}
                                        </span>
                                    </td>
                                    <td className="text-sm font-medium text-slate-700">{s.name}</td>
                                    <td className="text-right font-mono text-sm font-bold text-slate-800">{fmtIDR(s.price || 0)}</td>
                                    <td className="font-mono text-xs text-slate-600">
                                        {s.revenueAccountCode || s.revenue_account_code || '4-11-001'}
                                    </td>
                                    <td className="text-center">
                                        <StatusBadge status={s.isActive !== false ? 'ACTIVE' : 'INACTIVE'} />
                                    </td>
                                    <td>
                                        <div className="flex items-center gap-1 justify-end">
                                            <button className="btn-ghost p-1.5" onClick={() => { setSelected(s); setModal('edit') }} title="Edit">
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                            <button className="btn-ghost p-1.5 text-slate-500" onClick={() => handleToggleActive(s)} title={s.isActive !== false ? 'Nonaktifkan' : 'Aktifkan'}>
                                                <PowerOff className="w-3.5 h-3.5 text-slate-400 hover:text-red-500" />
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
                title={modal === 'add' ? 'Tambah Layanan Baru' : `Edit Layanan — ${selected?.name}`}
                size="md"
            >
                <ServiceTariffForm
                    initial={modal === 'edit' ? {
                        ...selected,
                        serviceCategory: selected?.serviceCategory || selected?.service_category || 'KONSULTASI_UMUM',
                        revenueAccountCode: selected?.revenueAccountCode || selected?.revenue_account_code || '4-11-001'
                    } : {}}
                    onSave={handleSave}
                    onClose={() => setModal(null)}
                    isEdit={modal === 'edit'}
                    nextCode={nextCode}
                    revenueAccounts={revenueAccounts}
                />
            </Modal>
        </div>
    )
}
