import { useState, useMemo } from 'react'
import { Plus, Pencil, KeyRound, PowerOff, ShieldCheck } from 'lucide-react'
import { useAuth, ROLE_LABELS, ROLE_COLORS } from '../../store/useAuth'
import Modal from '../../components/ui/Modal'
import SearchInput from '../../components/ui/SearchInput'
import { StatusBadge } from '../../components/ui/Badge'
import { fmtDateTime } from '../../utils/format'
import toast from 'react-hot-toast'

const ROLES = ['admin','keuangan','gudang']

// Role description
const ROLE_DESC = {
  admin:    'Akses penuh ke semua modul termasuk Pengaturan.',
  keuangan: 'Akses ke Akuntansi, Laporan, Inventory, Pengeluaran, Pajak, Cabang. Tidak dapat mengakses Kasir & Billing.',
  gudang:   'Hanya dapat mengakses modul Inventory (Master Item, GRN, Kartu Stok).',
}

function UserForm({ initial = {}, onSave, onClose, isEdit = false }) {
  const [form, setForm] = useState({
    name:     initial.name     || '',
    username: initial.username || '',
    password: '',
    role:     initial.role     || 'keuangan',
    email:    initial.email    || '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.username.trim()) { toast.error('Nama dan username wajib diisi.'); return }
    if (!isEdit && !form.password) { toast.error('Password wajib diisi untuk pengguna baru.'); return }
    onSave(form)
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="form-label">Nama Lengkap *</label>
          <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} required />
        </div>
        <div>
          <label className="form-label">Username *</label>
          <input className="form-input font-mono" value={form.username} onChange={e => set('username', e.target.value)} disabled={isEdit} required />
          {isEdit && <p className="text-xs text-slate-400 mt-0.5">Username tidak dapat diubah.</p>}
        </div>
        <div>
          <label className="form-label">{isEdit ? 'Password Baru (kosongkan jika tidak diubah)' : 'Password *'}</label>
          <input type="password" className="form-input" value={form.password} onChange={e => set('password', e.target.value)} placeholder={isEdit ? 'Biarkan kosong jika tidak diubah' : 'Min. 6 karakter'} />
        </div>
        <div>
          <label className="form-label">Email</label>
          <input type="email" className="form-input" value={form.email} onChange={e => set('email', e.target.value)} />
        </div>
      </div>
      <div>
        <label className="form-label">Role / Hak Akses *</label>
        <div className="grid grid-cols-3 gap-3 mt-2">
          {ROLES.map(r => (
            <label key={r} className={`flex flex-col gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all ${form.role === r ? 'border-primary-500 bg-primary-50' : 'border-slate-200 hover:border-slate-300'}`}>
              <input type="radio" name="role" value={r} checked={form.role === r} onChange={() => set('role', r)} className="sr-only" />
              <div className="flex items-center gap-2">
                <ShieldCheck className={`w-4 h-4 ${form.role === r ? 'text-primary-600' : 'text-slate-400'}`} />
                <span className={`text-sm font-semibold ${form.role === r ? 'text-primary-700' : 'text-slate-600'}`}>{ROLE_LABELS[r]}</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">{ROLE_DESC[r]}</p>
            </label>
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn-secondary" onClick={onClose}>Batal</button>
        <button type="submit" className="btn-primary">Simpan Pengguna</button>
      </div>
    </form>
  )
}

function ResetPasswordForm({ user, onSave, onClose }) {
  const [newPass, setNewPass] = useState('')
  const [confirm, setConfirm] = useState('')

  const submit = (e) => {
    e.preventDefault()
    if (newPass.length < 6) { toast.error('Password minimal 6 karakter.'); return }
    if (newPass !== confirm) { toast.error('Konfirmasi password tidak cocok.'); return }
    onSave(newPass)
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
        Reset password untuk: <strong>{user?.name}</strong> ({user?.username})
      </div>
      <div>
        <label className="form-label">Password Baru *</label>
        <input type="password" className="form-input" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Min. 6 karakter" required />
      </div>
      <div>
        <label className="form-label">Konfirmasi Password *</label>
        <input type="password" className="form-input" value={confirm} onChange={e => setConfirm(e.target.value)} required />
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onClose}>Batal</button>
        <button type="submit" className="btn-danger"><KeyRound className="w-4 h-4" />Reset Password</button>
      </div>
    </form>
  )
}

export default function UserManagementPage() {
  const { users, currentUser, addUser, updateUser, deactivateUser, resetPassword } = useAuth()
  const [search, setSearch]     = useState('')
  const [modal, setModal]       = useState(null) // null | 'add' | 'edit' | 'reset'
  const [selected, setSelected] = useState(null)

  const filtered = useMemo(() =>
    users
      .filter(u => !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.username.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name)),
  [users, search])

  const handleSaveUser = (data) => {
    if (modal === 'add') {
      const result = addUser(data)
      if (!result.ok) { toast.error(result.error); return }
      toast.success(`Pengguna ${data.name} berhasil ditambahkan.`)
    } else {
      const update = { name: data.name, role: data.role, email: data.email }
      if (data.password) update.password = data.password
      updateUser(selected.id, update)
      toast.success('Data pengguna berhasil diperbarui.')
    }
    setModal(null)
  }

  const handleDeactivate = (user) => {
    if (user.id === currentUser?.id) { toast.error('Tidak dapat menonaktifkan akun yang sedang aktif.'); return }
    if (!window.confirm(`Nonaktifkan pengguna ${user.name}?`)) return
    deactivateUser(user.id)
    toast.success(`Pengguna ${user.name} dinonaktifkan.`)
  }

  const handleResetPass = (newPass) => {
    resetPassword(selected.id, newPass)
    toast.success('Password berhasil direset.')
    setModal(null)
  }

  const roleCount = ROLES.reduce((acc, r) => ({ ...acc, [r]: users.filter(u => u.role === r && u.isActive).length }), {})

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Manajemen Pengguna</h1>
          <p className="text-sm text-slate-400 mt-0.5">Kelola akun dan hak akses pengguna sistem</p>
        </div>
        <button className="btn-primary" onClick={() => { setSelected(null); setModal('add') }}>
          <Plus className="w-4 h-4" />Tambah Pengguna
        </button>
      </div>

      {/* Role summary */}
      <div className="grid grid-cols-3 gap-4">
        {ROLES.map(r => (
          <div key={r} className="card card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 mb-1">{ROLE_LABELS[r]}</p>
                <p className="font-bold text-2xl text-slate-800">{roleCount[r] || 0}</p>
                <p className="text-xs text-slate-400 mt-0.5">pengguna aktif</p>
              </div>
              <span className={`badge text-xs ${ROLE_COLORS[r]}`}>{r}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <SearchInput value={search} onChange={setSearch} placeholder="Cari nama atau username…" className="w-64" />
          <span className="text-sm text-slate-400 ml-auto">{filtered.length} pengguna</span>
        </div>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Nama</th><th>Username</th><th>Email</th>
                <th>Role</th><th>Dibuat</th><th className="text-center">Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} className={!u.isActive ? 'opacity-50' : ''}>
                  <td className="font-medium">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-primary-700 font-bold text-xs">{u.name.charAt(0).toUpperCase()}</span>
                      </div>
                      <span>{u.name}</span>
                      {u.id === currentUser?.id && <span className="badge badge-blue text-xs">Anda</span>}
                    </div>
                  </td>
                  <td className="font-mono text-sm">{u.username}</td>
                  <td className="text-sm text-slate-500">{u.email || '—'}</td>
                  <td><span className={`badge text-xs ${ROLE_COLORS[u.role]}`}>{ROLE_LABELS[u.role]}</span></td>
                  <td className="text-xs text-slate-400">{fmtDateTime(u.createdAt)}</td>
                  <td className="text-center"><StatusBadge status={u.isActive ? 'ACTIVE' : 'INACTIVE'} /></td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button className="btn-ghost p-1.5" onClick={() => { setSelected(u); setModal('edit') }} title="Edit">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button className="btn-ghost p-1.5 text-amber-600" onClick={() => { setSelected(u); setModal('reset') }} title="Reset Password">
                        <KeyRound className="w-3.5 h-3.5" />
                      </button>
                      {u.isActive && u.id !== currentUser?.id && (
                        <button className="btn-ghost p-1.5 text-red-500" onClick={() => handleDeactivate(u)} title="Nonaktifkan">
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

      {/* Role matrix info */}
      <div className="card card-body bg-slate-50">
        <p className="text-sm font-semibold text-slate-700 mb-3">Matriks Hak Akses per Role</p>
        <div className="overflow-x-auto">
          <table className="text-xs w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 pr-4 text-slate-600">Modul</th>
                {ROLES.map(r => <th key={r} className="text-center py-2 px-4 text-slate-600">{ROLE_LABELS[r]}</th>)}
              </tr>
            </thead>
            <tbody>
              {[
                ['Dashboard',       true, true, true],
                ['Akuntansi',       true, true, false],
                ['Laporan Keuangan',true, true, false],
                ['Inventory',       true, true, true],
                ['Kasir & Billing', true, false,false],
                ['Pengeluaran',     true, true, false],
                ['Pajak',           true, true, false],
                ['Cabang',          true, true, false],
                ['Pengaturan',      true, false,false],
              ].map(([label, ...access]) => (
                <tr key={label} className="border-b border-slate-100">
                  <td className="py-1.5 pr-4 font-medium text-slate-700">{label}</td>
                  {access.map((a, i) => (
                    <td key={i} className="text-center py-1.5 px-4">
                      {a ? <span className="text-emerald-600 font-bold">✓</span> : <span className="text-slate-300">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modal === 'add'} onClose={() => setModal(null)} title="Tambah Pengguna Baru" size="lg">
        <UserForm onSave={handleSaveUser} onClose={() => setModal(null)} />
      </Modal>
      <Modal open={modal === 'edit'} onClose={() => setModal(null)} title="Edit Data Pengguna" size="lg">
        <UserForm initial={selected} onSave={handleSaveUser} onClose={() => setModal(null)} isEdit />
      </Modal>
      <Modal open={modal === 'reset'} onClose={() => setModal(null)} title="Reset Password" size="sm">
        <ResetPasswordForm user={selected} onSave={handleResetPass} onClose={() => setModal(null)} />
      </Modal>
    </div>
  )
}
