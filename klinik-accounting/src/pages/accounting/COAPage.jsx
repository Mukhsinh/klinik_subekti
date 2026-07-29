import { useState, useMemo, useRef } from 'react'
import { Plus, Pencil, PowerOff, Download, Upload, RefreshCw, Trash2 } from 'lucide-react'
import { useStore } from '../../store/useStore'
import Modal from '../../components/ui/Modal'
import SearchInput from '../../components/ui/SearchInput'
import { StatusBadge } from '../../components/ui/Badge'
import { accountTypeBadge, accountTypeLabel } from '../../utils/format'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'

const ACCOUNT_TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']
const NATURAL_BALANCES = ['DEBIT', 'CREDIT']

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
            set('naturalBalance', ['ASSET', 'EXPENSE'].includes(t) ? 'DEBIT' : 'CREDIT')
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
  const { coa, addAccount, updateAccount, deactivateAccount, clearAllCOA, batchAddAccounts } = useStore()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [modal, setModal] = useState(null) // null | 'add' | 'edit' | 'import'
  const [selected, setSelected] = useState(null)
  const [importData, setImportData] = useState([])
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef(null)

  const TYPE_ORDER = { ASSET: 1, LIABILITY: 2, EQUITY: 3, REVENUE: 4, EXPENSE: 5 }

  const filtered = useMemo(() =>
    coa
      .filter(a => typeFilter === 'ALL' || a.accountType === typeFilter)
      .filter(a =>
        a.accountCode.toLowerCase().includes(search.toLowerCase()) ||
        a.accountName.toLowerCase().includes(search.toLowerCase()) ||
        (a.accountGroup || '').toLowerCase().includes(search.toLowerCase())
      )
      .sort((a, b) => {
        const orderA = TYPE_ORDER[a.accountType] || 99
        const orderB = TYPE_ORDER[b.accountType] || 99
        if (orderA !== orderB) return orderA - orderB
        const sortA = a.sortOrder ?? 99999
        const sortB = b.sortOrder ?? 99999
        if (sortA !== sortB) return sortA - sortB
        return (a.accountCode || '').localeCompare(b.accountCode || '', undefined, { numeric: true })
      }),
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

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result
        const workbook = XLSX.read(data, { type: 'binary' })
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(firstSheet)

        // Parse and validate
        const parsed = rows.map((row, idx) => {
          const acc = {
            accountCode: String(row.account_code || row['Kode Akun'] || '').trim(),
            accountName: String(row.account_name || row['Nama Akun'] || '').trim(),
            accountType: String(row.account_type || row['Tipe'] || 'ASSET').toUpperCase(),
            accountGroup: String(row.account_group || row['Kelompok'] || '').trim(),
            accountSubgroup: String(row.account_subgroup || row['Sub-Kelompok'] || '').trim(),
            naturalBalance: String(row.natural_balance || row['Saldo Normal'] || 'DEBIT').toUpperCase(),
            isHeader: row.is_header === true || row.is_header === 'true' || row.is_header === 'TRUE' || row['Header?'] === 'Ya',
            parentCode: String(row.parent_code || row['Parent Code'] || '').trim() || null,
            description: String(row.description || row['Keterangan'] || '').trim(),
            isActive: row.is_active !== false && row.is_active !== 'false' && row['Aktif?'] !== 'Tidak',
            sortOrder: parseInt(row.sort_order || row['Urutan'] || (idx + 1) * 10),
          }
          return acc
        }).filter(a => a.accountCode && a.accountName)

        if (parsed.length === 0) {
          toast.error('Tidak ada data valid di file CSV/Excel')
          return
        }

        setImportData(parsed)
        setModal('import')
        toast.success(`${parsed.length} akun siap diimport`)
      } catch (error) {
        console.error('[handleFileUpload] Error:', error)
        toast.error('Gagal membaca file: ' + error.message)
      }
    }
    reader.readAsBinaryString(file)
    e.target.value = '' // Reset input
  }

  const executeImport = async (replaceAll = false) => {
    setImporting(true)
    try {
      if (replaceAll) {
        if (!window.confirm('⚠️ PERHATIAN: Ini akan MENGHAPUS SEMUA akun yang ada dan menggantinya dengan data baru. Lanjutkan?')) {
          setImporting(false)
          return
        }
        await clearAllCOA()
        toast.success('Data COA lama berhasil dihapus')
      }

      await batchAddAccounts(importData)
      toast.success(`${importData.length} akun berhasil ${replaceAll ? 'diimport (replace)' : 'ditambahkan'}`)
      setModal(null)
      setImportData([])
    } catch (error) {
      console.error('[executeImport] Error:', error)
      toast.error('Gagal import: ' + error.message)
    } finally {
      setImporting(false)
    }
  }

  const handleClearAll = async () => {
    if (!window.confirm('⚠️ BAHAYA: Menghapus SEMUA akun COA. Data tidak dapat dikembalikan! Lanjutkan?')) return
    if (!window.confirm('Konfirmasi sekali lagi: HAPUS SEMUA COA?')) return

    try {
      await clearAllCOA()
      toast.success('Semua akun COA berhasil dihapus')
    } catch (error) {
      console.error('[handleClearAll] Error:', error)
      toast.error('Gagal menghapus COA: ' + error.message)
    }
  }

  const exportXLSX = () => {
    const rows = coa.sort((a, b) => a.sortOrder - b.sortOrder).map(a => ({
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
          <button className="btn-royal-blue" onClick={exportXLSX}><Download className="w-4 h-4" />Unduh Excel</button>
          <button className="btn-emerald" onClick={() => fileInputRef.current?.click()}><Upload className="w-4 h-4" />Impor CSV/Excel</button>
          <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} className="hidden" />
          <button className="btn-secondary text-red-600 hover:bg-red-50" onClick={handleClearAll}><Trash2 className="w-4 h-4" />Clear All</button>
          <button className="btn-danger-red" onClick={() => { setSelected(null); setModal('add') }}><Plus className="w-4 h-4" />Tambah Akun</button>
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
                <th style={{ width: 120 }}>Kode Akun</th>
                <th>Nama Akun</th>
                <th>Tipe</th>
                <th>Kelompok</th>
                <th>Saldo Normal</th>
                <th className="text-center">Header</th>
                <th className="text-center">Status</th>
                <th style={{ width: 100 }} className="text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-slate-400">Tidak ada akun ditemukan</td></tr>
              ) : filtered.map(acc => (
                <tr key={acc.accountCode} className={acc.isHeader ? 'bg-slate-50/60' : ''}>
                  <td>
                    <span className={`font-mono text-xs ${acc.isHeader ? 'font-bold text-slate-700' : 'text-primary-700 font-bold'}`}>
                      {acc.accountCode}
                    </span>
                  </td>
                  <td className={`${acc.isHeader ? 'font-bold text-slate-800' : 'font-medium'} ${acc.accountCode.split('-').length === 1 ? 'uppercase' : acc.accountCode.split('-').length === 2 ? 'pl-3' : 'pl-6'}`}>
                    {acc.accountName}
                  </td>
                  <td><span className={`badge ${accountTypeBadge(acc.accountType)}`}>{accountTypeLabel(acc.accountType)}</span></td>
                  <td className="text-xs text-slate-500">{acc.accountGroup}</td>
                  <td>
                    <span className={`badge text-xs ${acc.naturalBalance === 'DEBIT' ? 'badge-blue' : 'badge-green'}`}>{acc.naturalBalance}</span>
                  </td>
                  <td className="text-center text-xs font-bold">{acc.isHeader ? '✓' : ''}</td>
                  <td className="text-center"><StatusBadge status={acc.isActive ? 'ACTIVE' : 'INACTIVE'} /></td>
                  <td className="text-center">
                    {!acc.isHeader && (
                      <div className="flex items-center justify-center gap-1.5">
                        <button className="btn-action-edit" onClick={() => { setSelected(acc); setModal('edit') }} title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                        {acc.isActive && <button className="btn-action-delete" onClick={() => handleDeactivate(acc)} title="Nonaktifkan"><PowerOff className="w-3.5 h-3.5" /></button>}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'add' ? 'Tambah Akun Baru' : modal === 'edit' ? 'Edit Akun' : 'Import COA'} size="lg">
        {modal === 'import' ? (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800 font-medium mb-2">📊 Data siap diimport:</p>
              <p className="text-2xl font-bold text-blue-900">{importData.length} akun</p>
              <div className="mt-3 text-xs text-blue-700 space-y-1">
                <p>• Asset: {importData.filter(a => a.accountType === 'ASSET').length}</p>
                <p>• Liability: {importData.filter(a => a.accountType === 'LIABILITY').length}</p>
                <p>• Equity: {importData.filter(a => a.accountType === 'EQUITY').length}</p>
                <p>• Revenue: {importData.filter(a => a.accountType === 'REVENUE').length}</p>
                <p>• Expense: {importData.filter(a => a.accountType === 'EXPENSE').length}</p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-amber-800 mb-2">⚠️ Pilih Mode Import:</p>
              <div className="space-y-2 text-xs text-amber-700">
                <p><strong>Replace All (Ganti Semua):</strong> Hapus semua COA yang ada, lalu import data baru</p>
                <p><strong>Add New (Tambah Baru):</strong> Tambahkan akun baru, lewati yang sudah ada</p>
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto border rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left">Kode</th>
                    <th className="px-3 py-2 text-left">Nama Akun</th>
                    <th className="px-3 py-2 text-left">Tipe</th>
                    <th className="px-3 py-2 text-left">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {importData.slice(0, 50).map((acc, i) => (
                    <tr key={i} className="border-t hover:bg-slate-50">
                      <td className="px-3 py-1.5 font-mono">{acc.accountCode}</td>
                      <td className="px-3 py-1.5">{acc.accountName}</td>
                      <td className="px-3 py-1.5">{acc.accountType}</td>
                      <td className="px-3 py-1.5">{acc.naturalBalance}</td>
                    </tr>
                  ))}
                  {importData.length > 50 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-2 text-center text-slate-400">
                        ... dan {importData.length - 50} akun lainnya
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setModal(null)} disabled={importing}>Batal</button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => executeImport(false)}
                disabled={importing}
              >
                {importing ? 'Importing...' : 'Add New (Tambah Baru)'}
              </button>
              <button
                type="button"
                className="btn-primary bg-red-600 hover:bg-red-700"
                onClick={() => executeImport(true)}
                disabled={importing}
              >
                {importing ? 'Importing...' : 'Replace All (Ganti Semua)'}
              </button>
            </div>
          </div>
        ) : (
          <AccountForm initial={modal === 'edit' ? selected : {}} onSave={handleSave} onClose={() => setModal(null)} />
        )}
      </Modal>
    </div>
  )
}
