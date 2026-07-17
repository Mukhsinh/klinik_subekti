import { useState, useMemo, useEffect } from 'react'
import { Plus, Pencil, PowerOff, UserCheck, Phone, Mail, CreditCard, FileText } from 'lucide-react'
import { useStore } from '../../store/useStore'
import Modal from '../../components/ui/Modal'
import SearchInput from '../../components/ui/SearchInput'
import { StatusBadge } from '../../components/ui/Badge'
import { fmtIDR, fmtPct } from '../../utils/format'
import { upsertDoctor, deleteDoctor } from '../../lib/db'
import toast from 'react-hot-toast'
import { v4 as uuidv4 } from 'uuid'

const SPECIALIZATIONS = [
  'Dokter Umum', 'Dokter Gigi', 'Spesialis Anak (Sp.A)', 'Spesialis Penyakit Dalam (Sp.PD)',
  'Spesialis Kandungan (Sp.OG)', 'Spesialis Bedah (Sp.B)', 'Spesialis Mata (Sp.M)',
  'Spesialis THT (Sp.THT)', 'Spesialis Kulit (Sp.KK)', 'Spesialis Saraf (Sp.S)',
  'Spesialis Jantung (Sp.JP)', 'Spesialis Radiologi (Sp.Rad)', 'Lainnya',
]
const BANKS = ['BCA', 'BNI', 'BRI', 'Mandiri', 'CIMB Niaga', 'BSI', 'Permata', 'Danamon', 'OCBC', 'Lainnya']

function DoctorForm({ initial = {}, onSave, onClose, isEdit = false, nextCode }) {
  const [form, setForm] = useState({
    doctorCode:        initial.doctorCode        || nextCode || '',
    fullName:          initial.fullName          || '',
    title:             initial.title             || 'dr.',
    specialization:    initial.specialization    || 'Dokter Umum',
    sipNumber:         initial.sipNumber         || '',
    nik:               initial.nik               || '',
    npwp:              initial.npwp              || '',
    phone:             initial.phone             || '',
    email:             initial.email             || '',
    address:           initial.address           || '',
    bankName:          initial.bankName          || 'BCA',
    bankAccountNumber: initial.bankAccountNumber || '',
    bankAccountName:   initial.bankAccountName   || '',
    feePercentage:     initial.feePercentage     ?? 30,
    notes:             initial.notes             || '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = (e) => {
    e.preventDefault()
    if (!form.fullName.trim()) { toast.error('Nama lengkap dokter wajib diisi.'); return }
    if (!form.sipNumber.trim()) { toast.error('Nomor SIP wajib diisi.'); return }
    onSave(form)
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {/* Identitas */}
      <div>
        <h3 className="section-title mb-3 pb-2 border-b border-slate-100">Identitas Dokter</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="form-label">Kode Dokter</label>
            <input className="form-input font-mono bg-slate-50" value={form.doctorCode} readOnly />
          </div>
          <div>
            <label className="form-label">Gelar / Sebutan</label>
            <select className="form-select" value={form.title} onChange={e => set('title', e.target.value)}>
              {['dr.','drg.','Dr.','Prof.','Sp.'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="col-span-3 lg:col-span-1 lg:col-start-2">
            {/* spacer */}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-3">
          <div className="col-span-2">
            <label className="form-label">Nama Lengkap (tanpa gelar) *</label>
            <input className="form-input" value={form.fullName} onChange={e => set('fullName', e.target.value)}
              placeholder="Nama lengkap dokter…" required />
          </div>
          <div>
            <label className="form-label">Spesialisasi</label>
            <select className="form-select" value={form.specialization} onChange={e => set('specialization', e.target.value)}>
              {SPECIALIZATIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">No. SIP (Surat Izin Praktik) *</label>
            <input className="form-input" value={form.sipNumber} onChange={e => set('sipNumber', e.target.value)}
              placeholder="SIP/XXXXX/XXXX/XXXX" required />
          </div>
        </div>
      </div>

      {/* Data Pajak */}
      <div>
        <h3 className="section-title mb-3 pb-2 border-b border-slate-100">Data Pajak & Identitas</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="form-label">NIK (KTP)</label>
            <input className="form-input font-mono" value={form.nik} onChange={e => set('nik', e.target.value)}
              placeholder="16 digit NIK" maxLength={16} />
          </div>
          <div>
            <label className="form-label">NPWP</label>
            <input className="form-input font-mono" value={form.npwp} onChange={e => set('npwp', e.target.value)}
              placeholder="XX.XXX.XXX.X-XXX.XXX" />
          </div>
        </div>
      </div>

      {/* Kontak */}
      <div>
        <h3 className="section-title mb-3 pb-2 border-b border-slate-100">Kontak</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="form-label">No. Telepon / HP</label>
            <input className="form-input" value={form.phone} onChange={e => set('phone', e.target.value)} />
          </div>
          <div>
            <label className="form-label">Email</label>
            <input type="email" className="form-input" value={form.email} onChange={e => set('email', e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="form-label">Alamat</label>
            <textarea className="form-textarea" rows={2} value={form.address} onChange={e => set('address', e.target.value)} />
          </div>
        </div>
      </div>

      {/* Rekening Bank */}
      <div>
        <h3 className="section-title mb-3 pb-2 border-b border-slate-100">Rekening Bank (Pembayaran Jasa Medis)</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="form-label">Nama Bank</label>
            <select className="form-select" value={form.bankName} onChange={e => set('bankName', e.target.value)}>
              {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">No. Rekening</label>
            <input className="form-input font-mono" value={form.bankAccountNumber} onChange={e => set('bankAccountNumber', e.target.value)} />
          </div>
          <div>
            <label className="form-label">Nama Pemilik Rekening</label>
            <input className="form-input" value={form.bankAccountName} onChange={e => set('bankAccountName', e.target.value)} />
          </div>
        </div>
      </div>

      {/* Bagi Hasil */}
      <div>
        <h3 className="section-title mb-3 pb-2 border-b border-slate-100">Pengaturan Jasa Medis</h3>
        <div className="grid grid-cols-2 gap-4 items-end">
          <div>
            <label className="form-label">Persentase Bagi Hasil Jasa Medis (%)</label>
            <input type="number" className="form-input" value={form.feePercentage}
              onChange={e => set('feePercentage', parseFloat(e.target.value) || 0)}
              min={0} max={100} step={5} />
            <p className="text-xs text-slate-400 mt-1">
              Dokter akan mendapat {form.feePercentage}% dari total pendapatan jasa medis per kunjungan.
              PPh 21 dihitung otomatis dari DPP 50% × bruto.
            </p>
          </div>
          <div>
            <label className="form-label">Catatan</label>
            <textarea className="form-textarea" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn-secondary" onClick={onClose}>Batal</button>
        <button type="submit" className="btn-primary">{isEdit ? 'Simpan Perubahan' : 'Tambah Dokter'}</button>
      </div>
    </form>
  )
}

export default function DoctorManagementPage() {
  const { doctors: storeDoc, logActivity } = useStore()
  const [localDoctors, setLocalDoctors] = useState([])
  const [search, setSearch]   = useState('')
  const [modal, setModal]     = useState(null)
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(false)

  // Use store doctors synced with Supabase
  useEffect(() => {
    setLocalDoctors(storeDoc || [])
  }, [storeDoc])

  const filtered = useMemo(() =>
    localDoctors
      .filter(d => !search ||
        d.fullName?.toLowerCase().includes(search.toLowerCase()) ||
        d.doctorCode?.toLowerCase().includes(search.toLowerCase()) ||
        d.specialization?.toLowerCase().includes(search.toLowerCase()) ||
        d.sipNumber?.toLowerCase().includes(search.toLowerCase())
      )
      .sort((a, b) => (a.fullName || '').localeCompare(b.fullName || '')),
  [localDoctors, search])

  const nextCode = useMemo(() => {
    const count = localDoctors.length + 1
    return `DOC-${String(count).padStart(4, '0')}`
  }, [localDoctors])

  const handleSave = async (data) => {
    setLoading(true)
    try {
      const isEdit = modal === 'edit'
      const doctor = {
        ...data,
        id: isEdit ? selected.id : uuidv4(),
        isActive: true,
        updatedAt: new Date().toISOString(),
        createdAt: isEdit ? selected.createdAt : new Date().toISOString(),
      }
      const saved = await upsertDoctor(doctor)
      if (isEdit) {
        setLocalDoctors(ds => ds.map(d => d.id === saved.id ? saved : d))
        toast.success('Data dokter berhasil diperbarui.')
        logActivity('UBAH_DOKTER', 'Manajemen Dokter', `Update dokter: ${data.fullName}`)
      } else {
        setLocalDoctors(ds => [...ds, saved])
        toast.success(`Dokter ${data.title} ${data.fullName} berhasil ditambahkan.`)
        logActivity('TAMBAH_DOKTER', 'Manajemen Dokter', `Tambah dokter: ${data.fullName}`)
      }
      setModal(null)
    } catch (err) {
      toast.error(`Gagal menyimpan: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleDeactivate = async (doc) => {
    if (!window.confirm(`Nonaktifkan dokter ${doc.title} ${doc.fullName}?`)) return
    try {
      await deleteDoctor(doc.id)
      setLocalDoctors(ds => ds.map(d => d.id === doc.id ? { ...d, isActive: false } : d))
      logActivity('NONAKTIF_DOKTER', 'Manajemen Dokter', `Nonaktifkan dokter: ${doc.fullName}`)
      toast.success('Dokter dinonaktifkan.')
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Manajemen Dokter</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Master data dokter — terintegrasi dengan Kasir, PPh 21, dan Buku Besar
          </p>
        </div>
        <button className="btn-primary" onClick={() => { setSelected(null); setModal('add') }}>
          <Plus className="w-4 h-4" />Tambah Dokter
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card card-body bg-blue-50 border-0">
          <p className="text-xs text-slate-500 mb-1">Total Dokter</p>
          <p className="font-bold text-2xl text-blue-700">{localDoctors.length}</p>
        </div>
        <div className="card card-body bg-emerald-50 border-0">
          <p className="text-xs text-slate-500 mb-1">Dokter Aktif</p>
          <p className="font-bold text-2xl text-emerald-700">{localDoctors.filter(d => d.isActive !== false).length}</p>
        </div>
        <div className="card card-body bg-purple-50 border-0">
          <p className="text-xs text-slate-500 mb-1">Spesialisasi</p>
          <p className="font-bold text-2xl text-purple-700">
            {new Set(localDoctors.map(d => d.specialization)).size}
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <SearchInput value={search} onChange={setSearch} placeholder="Cari nama, kode, spesialisasi, SIP…" className="w-80" />
          <span className="text-sm text-slate-400 ml-auto">{filtered.length} dokter</span>
        </div>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Kode</th>
                <th>Nama Dokter</th>
                <th>Spesialisasi</th>
                <th>No. SIP</th>
                <th>Telepon</th>
                <th>Bank / Rekening</th>
                <th className="text-right">Bagi Hasil</th>
                <th>NPWP</th>
                <th className="text-center">Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-16 text-slate-400">
                    <UserCheck className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    {search ? 'Dokter tidak ditemukan' : 'Belum ada dokter — klik Tambah Dokter untuk memulai'}
                  </td>
                </tr>
              ) : filtered.map(d => (
                <tr key={d.id}>
                  <td className="font-mono text-xs text-primary-700 font-medium">{d.doctorCode}</td>
                  <td>
                    <div>
                      <p className="font-medium text-sm">{d.title} {d.fullName}</p>
                      {d.email && <p className="text-xs text-slate-400">{d.email}</p>}
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-blue text-xs">{d.specialization}</span>
                  </td>
                  <td className="font-mono text-xs">{d.sipNumber || '—'}</td>
                  <td className="text-sm">
                    {d.phone ? (
                      <div className="flex items-center gap-1 text-slate-600">
                        <Phone className="w-3 h-3" />{d.phone}
                      </div>
                    ) : '—'}
                  </td>
                  <td className="text-xs">
                    {d.bankName && d.bankAccountNumber ? (
                      <div>
                        <p className="font-medium">{d.bankName}</p>
                        <p className="font-mono text-slate-500">{d.bankAccountNumber}</p>
                        <p className="text-slate-400">{d.bankAccountName}</p>
                      </div>
                    ) : '—'}
                  </td>
                  <td className="text-right">
                    <span className="badge badge-green text-xs">{d.feePercentage || 30}%</span>
                  </td>
                  <td className="font-mono text-xs text-slate-500">{d.npwp || '—'}</td>
                  <td className="text-center">
                    <StatusBadge status={d.isActive !== false ? 'ACTIVE' : 'INACTIVE'} />
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button className="btn-ghost p-1.5" onClick={() => { setSelected(d); setModal('edit') }} title="Edit">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {d.isActive !== false && (
                        <button className="btn-ghost p-1.5 text-red-500" onClick={() => handleDeactivate(d)} title="Nonaktifkan">
                          <PowerOff className="w-3.5 h-3.5" />
                        </button>
                      )}
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
        title={modal === 'add' ? 'Tambah Dokter Baru' : `Edit Data Dokter — ${selected?.title} ${selected?.fullName}`}
        size="xl"
      >
        <DoctorForm
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
