import { useState, useMemo } from 'react'
import { Plus, Pencil, PowerOff, Download } from 'lucide-react'
import { useStore } from '../../store/useStore'
import Modal from '../../components/ui/Modal'
import SearchInput from '../../components/ui/SearchInput'
import { StatusBadge } from '../../components/ui/Badge'
import { accountTypeBadge, accountTypeLabel } from '../../utils/format'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'

const ACCOUNT_TYPES = ['ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE']
const NATURAL_BALANCES = ['DEBIT','CREDIT']

function AccountForm({ initial = {}, onSave, onClose }) {
  const [form, setForm] = useState({
    accountCode: initial.accountCode || '',
    accountName: initial.accountName || '',
    accountType: initial.accountType || 'ASSET',
    accountGroup: initial.accountGroup || '',
    accountSubgroup: initial.accountSubgroup || '',
    naturalBalance: initial.naturalBalance || 'DEBIT',
    isHeader: initial.isHeader ?? false,
    description: initial.description || '',
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = (e) => {
    e.preventDefault()
    if (!form.accountCode.trim() || !form.accountName.trim()) {
      toast.error('Kode akun dan nama akun wajib diisi.')
      return
    }
    onSave(form)
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="form-label">Kode Akun *</label>
          <input className="form-input font-mono" value={form.accountCode} onChange={e => set('accountCode', e.target.value)} placeholder="mis. 1-11-001" disabled={!!initial.accountCode} required />
          <p className="text-xs text-slate-400 mt-1">Format: X-XX-XXX</p>
        </div>
        <div>
          <label className="form-label">Tipe Akun *</label>
          <select className="form-select" value={form.accountType} onChange={e => {
            const t = e.target.value
            set('accountType', t)
            set('naturalBalance', ['ASSET','EXPENSE'].includes(t) ? 'DEBIT' : 'CREDIT')
          }}>
            {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{accountTypeLabel(t)}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="form-label">Nama Akun *</label>
        <input className="form-input" value={form.accountName} onChange={e => set('accountName', e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="form-label">Kelompok Akun *</label>
          <input className="form-input" value={form.accountGroup} onChange={e => set('accountGroup', e.target.value)} placeholder="mis. ASET LANCAR" required />
        </div>
        <div>
          <label className="form-label">Sub-Kelompok</label>
          <input className="form-input" value={form.accountSubgroup} onChange={e => set('accountSubgroup', e.target.value)} placeholder="mis. Kas dan Bank" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="form-label">Saldo Normal</label>
          <select className="form-select" value={form.naturalBalance} onChange={e => set('naturalBalance', e.target.value)}>
            {NATURAL_BALANCES.map(n => <option key={n} value={n}>{n === 'DEBIT' ? 'Debit' : 'Kredit'}</option>)}
          </select>
        </div>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.isHeader} onChange={e => set('isHeader', e.target.checked)} className="w-4 h-4 accent-primary-600" />
            <span className="text-sm text-slate-700">Akun Header (tidak dapat diposting)</span>
          </label>
        </div>
      </div>
      <div>
        <label className="form-label">Keterangan</label>
        <textarea className="form-textarea" rows={2} value={form.description} onChange={e => set('description', e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn-secondary" onClick={onClose}>Batal</button>
        <button type="submit" className="btn-primary">Simpan Akun</button>
      </div>
    </form>
  )
}

export default function COAPage() {
  const { coa, addAccount, updateAccount, deactivateAccount } = useStore()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [modal, setModal] = useState(null) // null | 'add' | 'edit'
  const [selected, setSelected] = useState(null)

  const filtered = useMemo(() =>
    coa
      .filter(a => typeFilter === 'ALL' || a.accountType === typeFilter)
      .filter(a =>
        a.accountCode.toLowerCase().includes(search.toLowerCase()) ||
        a.accountName.toLowerCase().includes(search.toLowerCase()) ||
        (a.accountGroup || '').toLowerCase().includes(search.toLowerCase())
      )
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)),
  [coa, search, typeFilter])

  const handleSave = (data) => {
    if (modal === 'add') {
      if (coa.find(a => a.accountCode === data.accountCode)) {
        toast.error(`Kode akun ${data.accountCode} sudah ada.`)
        return
      }
      addAccount({ ...data, isActive: true, sortOrder: coa.length * 10 })
      toast.success('Akun berhasil ditambahkan.')
    } else {
      updateAccount(selected.accountCode, data)
      toast.success('Akun berhasil diperbarui.')
    }
    setModal(null)
  }

  const handleDeactivate = (acc) => {
    if (!window.confirm(`Nonaktifkan akun ${acc.accountCode} — ${acc.accountName}?`)) return
    deactivateAccount(acc.accountCode)
    toast.success('Akun dinonaktifkan.')
  }

  const exportXLSX = () => {
    const rows = coa.sort((a,b) => a.sortOrder - b.sortOrder).map(a => ({
      'Kode Akun': a.accountCode, 'Nama Akun': a.accountName,
      'Tipe': accountTypeLabel(a.accountType), 'Kelompok': a.accountGroup,
      'Sub-Kelompok': a.accountSubgroup || '', 'Saldo Normal': a.naturalBalance,
      'Header?': a.isHeader ? 'Ya' : 'Tidak', 'Aktif?': a.isActive ? 'Ya' : 'Tidak',
    }))
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, 'COA')
    XLSX.writeFile(wb, 'BaganAkun_Klinik.xlsx')
    toast.success('File Excel berhasil diunduh.')
  }

  const summary = ACCOUNT_TYPES.reduce((acc, t) => ({ ...acc, [t]: coa.filter(a => a.accountType === t && a.isActive).length }), {})

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Bagan Akun (Chart of Accounts)</h1>
          <p className="text-sm text-slate-400 mt-0.5">Standar PSAK / ISAK 35 — Format Kode: X-XX-XXX</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={exportXLSX}><Download className="w-4 h-4" />Export Excel</button>
          <button className="btn-primary" onClick={() => { setSelected(null); setModal('add') }}><Plus className="w-4 h-4" />Tambah Akun</button>
        </div>
      </div>

      {/* Summary badges */}
      <div className="flex flex-wrap gap-2">
        {ACCOUNT_TYPES.map(t => (
          <button key={t} onClick={() => setTypeFilter(typeFilter === t ? 'ALL' : t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${typeFilter === t ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
            {accountTypeLabel(t)} <span className="ml-1.5 opacity-70">{summary[t]}</span>
          </button>
        ))}
        <button onClick={() => setTypeFilter('ALL')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${typeFilter === 'ALL' ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
          Semua <span className="ml-1.5 opacity-70">{coa.length}</span>
        </button>
      </div>

      <div className="card">
        <div className="card-header gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Cari kode atau nama akun…" className="w-72" />
          <span className="text-sm text-slate-400 ml-auto">{filtered.length} akun</span>
        </div>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th style={{width:120}}>Kode Akun</th>
                <th>Nama Akun</th>
                <th>Tipe</th>
                <th>Kelompok</th>
                <th>Saldo Normal</th>
                <th className="text-center">Header</th>
                <th className="text-center">Status</th>
                <th style={{width:100}}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-slate-400">Tidak ada akun ditemukan</td></tr>
              ) : filtered.map(acc => (
                <tr key={acc.accountCode} className={acc.isHeader ? 'bg-slate-50/60' : ''}>
                  <td>
                    <span className={`font-mono text-xs ${acc.isHeader ? 'font-bold text-slate-700' : 'text-primary-700'}`}>
                      {acc.accountCode}
                    </span>
                  </td>
                  <td className={`${acc.isHeader ? 'font-semibold text-slate-700' : ''} ${acc.accountCode.split('-').length === 1 ? 'uppercase' : acc.accountCode.split('-').length === 2 ? 'pl-3 font-medium' : 'pl-6'}`}>
                    {acc.accountName}
                  </td>
                  <td><span className={`badge ${accountTypeBadge(acc.accountType)}`}>{accountTypeLabel(acc.accountType)}</span></td>
                  <td className="text-xs text-slate-500">{acc.accountGroup}</td>
                  <td>
                    <span className={`badge text-xs ${acc.naturalBalance === 'DEBIT' ? 'badge-blue' : 'badge-green'}`}>{acc.naturalBalance}</span>
                  </td>
                  <td className="text-center text-xs">{acc.isHeader ? '✓' : ''}</td>
                  <td className="text-center"><StatusBadge status={acc.isActive ? 'ACTIVE' : 'INACTIVE'} /></td>
                  <td>
                    {!acc.isHeader && (
                      <div className="flex items-center gap-1">
                        <button className="btn-ghost p-1.5" onClick={() => { setSelected(acc); setModal('edit') }} title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                        {acc.isActive && <button className="btn-ghost p-1.5 text-red-500" onClick={() => handleDeactivate(acc)} title="Nonaktifkan"><PowerOff className="w-3.5 h-3.5" /></button>}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'add' ? 'Tambah Akun Baru' : 'Edit Akun'} size="lg">
        <AccountForm initial={modal === 'edit' ? selected : {}} onSave={handleSave} onClose={() => setModal(null)} />
      </Modal>
    </div>
  )
}
