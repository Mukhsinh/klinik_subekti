import { useState, useMemo, useRef } from 'react'
import {
  Plus, Pencil, PowerOff, Download, Upload, RefreshCw, Trash2,
  Settings, CheckCircle2, AlertTriangle, Layers, RotateCcw, Save, Search,
  ShoppingCart, Package, DollarSign
} from 'lucide-react'
import { useStore } from '../../store/useStore'
import { useAuth } from '../../store/useAuth'
import Modal from '../../components/ui/Modal'
import SearchInput from '../../components/ui/SearchInput'
import SearchableSelect from '../../components/ui/SearchableSelect'
import { StatusBadge } from '../../components/ui/Badge'
import { accountTypeBadge, accountTypeLabel } from '../../utils/format'
import {
  DEFAULT_ACCOUNT_MAPPINGS,
  MODULE_OPTIONS,
  getEffectiveAccountMappings
} from '../../utils/accountMapping'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'

const ACCOUNT_TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']
const NATURAL_BALANCES = ['DEBIT', 'CREDIT']

function AccountForm({ initial = {}, headerAccounts = [], onSave, onClose }) {
  const [form, setForm] = useState({
    accountCode: initial.accountCode || '',
    accountName: initial.accountName || '',
    accountType: initial.accountType || 'ASSET',
    accountGroup: initial.accountGroup || '',
    accountSubgroup: initial.accountSubgroup || '',
    parentCode: initial.parentCode || '',
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

  // Filter header accounts matching the selected accountType
  const filteredParents = headerAccounts.filter(h => h.accountType === form.accountType && h.accountCode !== form.accountCode)

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
            set('parentCode', '')
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
          <label className="form-label">Akun Induk (Parent Account)</label>
          <select className="form-select" value={form.parentCode} onChange={e => set('parentCode', e.target.value)}>
            <option value="">-- Tanpa Induk (Top Level) --</option>
            {filteredParents.map(h => (
              <option key={h.accountCode} value={h.accountCode}>
                {h.accountCode} — {h.accountName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label">Kelompok Akun *</label>
          <input className="form-input" value={form.accountGroup} onChange={e => set('accountGroup', e.target.value)} placeholder="mis. ASET LANCAR" required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="form-label">Sub-Kelompok</label>
          <input className="form-input" value={form.accountSubgroup} onChange={e => set('accountSubgroup', e.target.value)} placeholder="mis. Kas dan Bank" />
        </div>
        <div>
          <label className="form-label">Saldo Normal</label>
          <select className="form-select" value={form.naturalBalance} onChange={e => set('naturalBalance', e.target.value)}>
            {NATURAL_BALANCES.map(n => <option key={n} value={n}>{n === 'DEBIT' ? 'Debit' : 'Kredit'}</option>)}
          </select>
        </div>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.isHeader} onChange={e => set('isHeader', e.target.checked)} className="w-4 h-4 accent-primary-600" />
          <span className="text-sm font-medium text-slate-700">Akun Header (Akun Induk / Non-Posting)</span>
        </label>
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
  const {
    coa, addAccount, updateAccount, deactivateAccount, clearAllCOA, batchAddAccounts,
    refreshAll, appSettings: storeAppSettings, updateAppSettings
  } = useStore()
  const { appSettings: authAppSettings, saveAppSettings } = useAuth()
  const appSettings = (storeAppSettings && typeof storeAppSettings === 'object' && storeAppSettings.account_mappings)
    ? storeAppSettings
    : (authAppSettings || {})

  // Main page tab: 'accounts' (Chart of accounts) or 'mappings' (Pengaturan Mapping Transaksi)
  const [activeTab, setActiveTab] = useState('accounts')

  // Search & Filter for COA accounts
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [modal, setModal] = useState(null) // null | 'add' | 'edit' | 'import' | 'add_mapping' | 'edit_mapping'
  const [selected, setSelected] = useState(null)
  const [importData, setImportData] = useState([])
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef(null)

  // Mapping state
  const [mappingSearch, setMappingSearch] = useState('')
  const [mappingFilter, setMappingFilter] = useState('ALL')
  const [selectedMapping, setSelectedMapping] = useState(null)
  const [isSavingMapping, setIsSavingMapping] = useState(false)

  // Mapping Form state (Add / Edit)
  const [mappingForm, setMappingForm] = useState({
    key: '',
    label: '',
    module: 'BILLING',
    accountCode: '',
    description: '',
    targetType: 'REVENUE'
  })

  // Effective mappings
  const effectiveMappings = useMemo(() => getEffectiveAccountMappings(appSettings), [appSettings])

  // Lookup map for COA table badges
  const mappingLookup = useMemo(() => {
    const lookup = {}
    Object.values(effectiveMappings).forEach(m => {
      if (!lookup[m.accountCode]) lookup[m.accountCode] = []
      lookup[m.accountCode].push(m)
    })
    return lookup
  }, [effectiveMappings])

  // Filtered COA accounts
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

  // Filtered mapping items list
  const filteredMappingItems = useMemo(() => {
    return Object.values(effectiveMappings).filter(m => {
      const matchMod = mappingFilter === 'ALL' || m.module === mappingFilter
      const matchQ = !mappingSearch ||
        m.label.toLowerCase().includes(mappingSearch.toLowerCase()) ||
        m.accountCode.toLowerCase().includes(mappingSearch.toLowerCase()) ||
        (m.description || '').toLowerCase().includes(mappingSearch.toLowerCase())
      return matchMod && matchQ
    })
  }, [effectiveMappings, mappingFilter, mappingSearch])

  // Candidate accounts for SearchableSelect in mapping modal
  const candidateAccounts = useMemo(() => {
    return coa
      .filter(a => !a.isHeader)
      .map(a => ({
        value: a.accountCode,
        label: `${a.accountCode} — ${a.accountName}`,
        sub: `Tipe: ${a.accountType} | Grup: ${a.accountGroup || '—'} | Saldo: ${a.naturalBalance}`
      }))
  }, [coa])

  // Handlers for Account (COA)
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
  }

  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result
        const wb = XLSX.read(bstr, { type: 'binary' })
        const wsname = wb.SheetNames[0]
        const ws = wb.Sheets[wsname]
        const data = XLSX.utils.sheet_to_json(ws)
        const parsed = data.map((row, idx) => ({
          accountCode: String(row['Kode Akun'] || row['Kode'] || row['accountCode'] || '').trim(),
          accountName: String(row['Nama Akun'] || row['Nama'] || row['accountName'] || '').trim(),
          accountType: String(row['Tipe'] || row['accountType'] || 'ASSET').toUpperCase().trim(),
          accountGroup: String(row['Kelompok'] || row['accountGroup'] || 'ASET').trim(),
          accountSubgroup: String(row['Sub-Kelompok'] || row['accountSubgroup'] || '').trim() || null,
          naturalBalance: String(row['Saldo Normal'] || row['naturalBalance'] || 'DEBIT').toUpperCase().trim(),
          isHeader: String(row['Header?'] || row['isHeader'] || '').toLowerCase() === 'ya' || row['isHeader'] === true,
          parentCode: String(row['Parent'] || row['parentCode'] || '').trim() || null,
          description: String(row['Keterangan'] || row['description'] || '').trim(),
          isActive: true,
          sortOrder: (idx + 1) * 10
        })).filter(a => a.accountCode && a.accountName)

        if (parsed.length === 0) {
          toast.error('File tidak berisi data COA yang valid.')
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
    e.target.value = ''
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

  // ── Mapping Handlers (Add, Edit, Delete / Reset) ──
  const handleOpenAddMapping = () => {
    setMappingForm({
      key: `custom_${Date.now()}`,
      label: '',
      module: 'BILLING',
      accountCode: '',
      description: '',
      targetType: 'REVENUE'
    })
    setModal('add_mapping')
  }

  const handleOpenEditMapping = (item) => {
    setSelectedMapping(item)
    setMappingForm({
      key: item.key,
      label: item.label,
      module: item.module,
      accountCode: item.accountCode,
      description: item.description || '',
      targetType: item.targetType || 'EXPENSE'
    })
    setModal('edit_mapping')
  }

  const handleSaveMappingForm = async (e) => {
    e.preventDefault()
    if (!mappingForm.label.trim()) {
      toast.error('Nama pos transaksi wajib diisi')
      return
    }
    if (!mappingForm.accountCode) {
      toast.error('Kode rekening COA wajib dipilih')
      return
    }

    setIsSavingMapping(true)
    try {
      const currentSaved = { ...(appSettings?.account_mappings || {}) }
      const selectedAcc = coa.find(a => a.accountCode === mappingForm.accountCode)

      currentSaved[mappingForm.key] = {
        key: mappingForm.key,
        label: mappingForm.label.trim(),
        module: mappingForm.module,
        moduleLabel: MODULE_OPTIONS.find(m => m.value === mappingForm.module)?.label || 'Umum',
        accountCode: mappingForm.accountCode,
        description: mappingForm.description.trim(),
        targetType: selectedAcc?.accountType || mappingForm.targetType || 'EXPENSE',
        isCustom: !DEFAULT_ACCOUNT_MAPPINGS[mappingForm.key]
      }

      if (typeof updateAppSettings === 'function') {
        await updateAppSettings({ account_mappings: currentSaved }).catch(err => console.warn('[updateAppSettings]', err))
      }
      if (typeof saveAppSettings === 'function') {
        await saveAppSettings({ account_mappings: currentSaved }).catch(err => console.warn('[saveAppSettings]', err))
      }
      if (typeof refreshAll === 'function') {
        await refreshAll().catch(err => console.warn('[refreshAll]', err))
      }
      toast.success(`Pemetaan transaksi "${mappingForm.label}" berhasil disimpan & disinkronkan ke laporan keuangan!`)
      setModal(null)
    } catch (err) {
      console.error('Save mapping error:', err)
      toast.error(`Gagal menyimpan mapping: ${err.message}`)
    } finally {
      setIsSavingMapping(false)
    }
  }

  const handleDeleteOrResetMapping = async (item) => {
    const isCustom = item.isCustom
    const confirmMsg = isCustom
      ? `Hapus pemetaan kustom "${item.label}"?`
      : `Kembalikan pemetaan "${item.label}" ke kode akun default sistem (${item.defaultCode})?`

    if (!window.confirm(confirmMsg)) return

    setIsSavingMapping(true)
    try {
      const currentSaved = { ...(appSettings?.account_mappings || {}) }
      delete currentSaved[item.key]
      if (typeof updateAppSettings === 'function') {
        await updateAppSettings({ account_mappings: currentSaved }).catch(err => console.warn('[updateAppSettings]', err))
      }
      if (typeof saveAppSettings === 'function') {
        await saveAppSettings({ account_mappings: currentSaved }).catch(err => console.warn('[saveAppSettings]', err))
      }
      if (typeof refreshAll === 'function') {
        await refreshAll().catch(err => console.warn('[refreshAll]', err))
      }
      toast.success(isCustom ? `Mapping "${item.label}" berhasil dihapus.` : `Mapping "${item.label}" dikembalikan ke default.`)
    } catch (err) {
      toast.error(`Gagal menghapus mapping: ${err.message}`)
    } finally {
      setIsSavingMapping(false)
    }
  }

  const handleSyncNow = async () => {
    setIsSavingMapping(true)
    try {
      await refreshAll()
      toast.success('Sinkronisasi akun COA dan laporan keuangan berhasil!')
    } catch (err) {
      toast.error('Gagal sinkronisasi: ' + err.message)
    } finally {
      setIsSavingMapping(false)
    }
  }

  const summary = ACCOUNT_TYPES.reduce((acc, t) => ({ ...acc, [t]: coa.filter(a => a.accountType === t && a.isActive).length }), {})

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="page-title flex items-center gap-2">
            Bagan Akun & Pemetaan Transaksi
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-primary-100 text-primary-800 border border-primary-200">
              COA & Mapping
            </span>
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Kelola Master Bagan Akun (COA) dan Pengaturan Pemetaan Rekening Transaksi Otomatis
          </p>
        </div>

        {/* Action Buttons based on active tab */}
        <div className="flex flex-wrap gap-2">
          {activeTab === 'accounts' ? (
            <>
              <button className="btn-royal-blue" onClick={exportXLSX}><Download className="w-4 h-4" />Unduh Excel</button>
              <button className="btn-emerald" onClick={() => fileInputRef.current?.click()}><Upload className="w-4 h-4" />Impor CSV/Excel</button>
              <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} className="hidden" />
              <button className="btn-secondary text-red-600 hover:bg-red-50" onClick={handleClearAll}><Trash2 className="w-4 h-4" />Clear All</button>
              <button className="btn-danger-red" onClick={() => { setSelected(null); setModal('add') }}><Plus className="w-4 h-4" />Tambah Akun</button>
            </>
          ) : (
            <>
              <button className="btn-secondary flex items-center gap-1.5" onClick={handleSyncNow} disabled={isSavingMapping}>
                <RefreshCw className={`w-4 h-4 ${isSavingMapping ? 'animate-spin text-primary-600' : ''}`} />
                <span>Sinkronkan Laporan</span>
              </button>
              <button className="btn-primary flex items-center gap-1.5" onClick={handleOpenAddMapping}>
                <Plus className="w-4 h-4" />
                <span>Tambah Mapping Transaksi</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-4">
          <button
            onClick={() => setActiveTab('accounts')}
            className={`pb-3 px-1 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'accounts'
              ? 'border-primary-600 text-primary-700'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
          >
            <Layers className="w-4 h-4" />
            <span>Daftar Akun COA</span>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono font-medium">
              {coa.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('mappings')}
            className={`pb-3 px-1 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'mappings'
              ? 'border-primary-600 text-primary-700'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
          >
            <Settings className="w-4 h-4" />
            <span>Pengaturan Mapping Rekening Transaksi</span>
            <span className="text-xs bg-primary-100 text-primary-800 px-2 py-0.5 rounded-full font-mono font-bold">
              {Object.keys(effectiveMappings).length} Pos
            </span>
          </button>
        </nav>
      </div>

      {/* TAB 1: ACCOUNTS LIST */}
      {activeTab === 'accounts' && (
        <div className="space-y-4 animate-fadeIn">
          {/* Integration Banner to Mappings */}
          <div className="bg-primary-50 border border-primary-200 rounded-lg p-3 text-xs text-primary-900 flex flex-wrap items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm">💡 Pemetaan Transaksi Aktif:</span>
              <span className="text-slate-700">Akun dengan badge <span className="bg-primary-100 text-primary-800 font-semibold px-1.5 py-0.5 rounded border border-primary-200 text-[11px]">Mapped</span> terhubung otomatis dengan transaksi di /billing, /stock-outflow, /expenses, dan /income-statement.</span>
            </div>
            <button
              onClick={() => setActiveTab('mappings')}
              className="px-3 py-1 rounded bg-primary-600 text-white font-medium hover:bg-primary-700 transition-colors flex items-center gap-1 shadow-xs text-xs"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Buka Pengaturan Mapping ({Object.keys(effectiveMappings).length})</span>
            </button>
          </div>

          {/* Account Type Filters */}
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

          {/* Accounts Table Card */}
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
                        <div>{acc.accountName}</div>
                        {mappingLookup[acc.accountCode] && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {mappingLookup[acc.accountCode].map((m, idx) => (
                              <button
                                key={idx}
                                onClick={() => { setActiveTab('mappings'); setMappingFilter(m.module); setMappingSearch(m.label) }}
                                className="inline-block text-[10px] bg-primary-100/90 text-primary-800 border border-primary-200 px-1.5 py-0.5 rounded font-medium hover:bg-primary-200 cursor-pointer text-left"
                                title="Klik untuk membuka mapping ini di tab Pengaturan Mapping"
                              >
                                Mapped: {m.label} ({m.moduleLabel})
                              </button>
                            ))}
                          </div>
                        )}
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
        </div>
      )}

      {/* TAB 2: TRANSACTION ACCOUNT MAPPINGS */}
      {activeTab === 'mappings' && (
        <div className="space-y-4 animate-fadeIn">
          {/* Mapping Control Card */}
          <div className="card card-body space-y-4 bg-white shadow-sm border border-slate-200">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-primary-600" />
                  Pengaturan Pemetaan Kode Rekening Transaksi
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tentukan akun COA untuk setiap jenis transaksi di modul Kasir (/billing), Farmasi HPP & Persediaan, Pengeluaran Stok (/stock-outflow), dan Beban (/expenses). Setelah disimpan, laporan keuangan otomatis terintegrasi.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenAddMapping}
                  className="btn-primary text-xs flex items-center gap-1.5 py-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Mapping Pos Transaksi</span>
                </button>
              </div>
            </div>

            {/* Filters by Module & Search */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'ALL', label: 'Semua Modul' },
                  { id: 'BILLING', label: 'Billing Kasir' },
                  { id: 'HPP', label: 'HPP & Persediaan' },
                  { id: 'STOCK_OUTFLOW', label: 'Pengeluaran Stok' },
                  { id: 'EXPENSES', label: 'Beban Operasional' },
                  { id: 'OTHER', label: 'Kustom / Lainnya' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setMappingFilter(tab.id)}
                    className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${mappingFilter === tab.id
                      ? 'bg-primary-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="w-full sm:w-72">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari pos transaksi / akun..."
                    value={mappingSearch}
                    onChange={e => setMappingSearch(e.target.value)}
                    className="form-input text-xs pl-8 py-1.5 w-full"
                  />
                </div>
              </div>
            </div>

            {/* Mapping Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2.5">Modul Transaksi</th>
                    <th className="px-3 py-2.5">Pos Transaksi</th>
                    <th className="px-3 py-2.5">Deskripsi / Peruntukan Akuntansi</th>
                    <th className="px-3 py-2.5">Kode Rekening COA</th>
                    <th className="px-3 py-2.5">Nama Akun di COA</th>
                    <th className="px-3 py-2.5 text-center">Status</th>
                    <th className="px-3 py-2.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMappingItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                        Tidak ada mapping transaksi yang cocok dengan pencarian / filter.
                      </td>
                    </tr>
                  ) : (
                    filteredMappingItems.map(item => {
                      const mappedAcc = coa.find(a => a.accountCode === item.accountCode)
                      const isCustom = item.isCustom
                      const isModified = item.isModified

                      return (
                        <tr key={item.key} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-3 py-2.5 font-medium text-slate-700 whitespace-nowrap">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${item.module === 'BILLING' ? 'bg-emerald-100 text-emerald-800' :
                              item.module === 'HPP' ? 'bg-amber-100 text-amber-800' :
                                item.module === 'STOCK_OUTFLOW' ? 'bg-blue-100 text-blue-800' :
                                  item.module === 'EXPENSES' ? 'bg-purple-100 text-purple-800' :
                                    'bg-slate-100 text-slate-700'
                              }`}>
                              {item.moduleLabel}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 font-semibold text-slate-900 whitespace-nowrap">
                            {item.label}
                          </td>
                          <td className="px-3 py-2.5 text-slate-500 max-w-xs">
                            {item.description || '—'}
                          </td>
                          <td className="px-3 py-2.5 font-mono font-bold text-primary-700 whitespace-nowrap">
                            {item.accountCode}
                          </td>
                          <td className="px-3 py-2.5 text-slate-800 whitespace-nowrap">
                            {mappedAcc ? (
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium">{mappedAcc.accountName}</span>
                                <span className="text-[10px] text-slate-400 font-mono">({mappedAcc.accountType} · {mappedAcc.naturalBalance})</span>
                              </div>
                            ) : (
                              <span className="text-rose-600 font-semibold flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5" /> Akun Tidak Ditemukan
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-center whitespace-nowrap">
                            {isCustom ? (
                              <span className="text-[10px] bg-blue-100 text-blue-800 border border-blue-300 px-1.5 py-0.5 rounded font-bold">
                                Kustom Pengguna
                              </span>
                            ) : isModified ? (
                              <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0.5 rounded font-bold">
                                Diedit
                              </span>
                            ) : (
                              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                                Standar Sistem
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenEditMapping(item)}
                                className="px-2.5 py-1 text-xs font-medium rounded bg-primary-50 text-primary-700 hover:bg-primary-100 border border-primary-200"
                                title="Edit mapping rekening ini"
                              >
                                ✏️ Edit
                              </button>
                              {(isCustom || isModified) && (
                                <button
                                  onClick={() => handleDeleteOrResetMapping(item)}
                                  className={`px-2 py-1 text-xs font-medium rounded border ${isCustom
                                    ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-200'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-300'
                                    }`}
                                  title={isCustom ? 'Hapus mapping kustom ini' : 'Reset ke kode rekening default sistem'}
                                >
                                  {isCustom ? <Trash2 className="w-3 h-3" /> : <RotateCcw className="w-3 h-3" />}
                                </button>
                              )}
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
        </div>
      )}

      {/* MODAL COA (Add / Edit / Import) */}
      <Modal open={modal === 'add' || modal === 'edit'} onClose={() => setModal(null)} title={modal === 'add' ? 'Tambah Akun Baru' : 'Edit Akun'} size="lg">
        <AccountForm
          initial={selected || {}}
          headerAccounts={coa.filter(a => a.isHeader)}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      </Modal>

      <Modal open={modal === 'import'} onClose={() => setModal(null)} title="Import COA dari Excel/CSV" size="lg">
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
              <tbody className="divide-y">
                {importData.slice(0, 50).map((a, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-mono">{a.accountCode}</td>
                    <td className="px-3 py-2">{a.accountName}</td>
                    <td className="px-3 py-2">{a.accountType}</td>
                    <td className="px-3 py-2">{a.naturalBalance}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {importData.length > 50 && (
              <p className="text-xs text-center text-slate-400 py-2">Dan {importData.length - 50} akun lainnya...</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-secondary" onClick={() => setModal(null)} disabled={importing}>Batal</button>
            <button className="btn-royal-blue" onClick={() => executeImport(false)} disabled={importing}>
              {importing ? 'Mengimport...' : 'Tambah Baru (Add New)'}
            </button>
            <button className="btn-danger-red" onClick={() => executeImport(true)} disabled={importing}>
              {importing ? 'Mengimport...' : 'Replace All (Hapus & Ganti)'}
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL ADD / EDIT MAPPING */}
      {(modal === 'add_mapping' || modal === 'edit_mapping') && (
        <Modal
          open={true}
          onClose={() => setModal(null)}
          title={modal === 'add_mapping' ? 'Tambah Pemetaan Rekening Transaksi Baru' : `Edit Pemetaan: ${mappingForm.label}`}
          size="md"
        >
          <form onSubmit={handleSaveMappingForm} className="space-y-4">
            <div>
              <label className="form-label text-xs font-semibold">Nama Pos Transaksi *</label>
              <input
                type="text"
                className="form-input text-xs"
                value={mappingForm.label}
                onChange={e => setMappingForm(f => ({ ...f, label: e.target.value }))}
                placeholder="mis. Pendapatan Tindakan Gigi / Beban Obat Kebersihan"
                required
              />
              <p className="text-[11px] text-slate-400 mt-0.5">Nama pos transaksi yang akan teridentifikasi di sistem.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label text-xs font-semibold">Modul Transaksi *</label>
                <select
                  className="form-select text-xs"
                  value={mappingForm.module}
                  onChange={e => setMappingForm(f => ({ ...f, module: e.target.value }))}
                  required
                >
                  {MODULE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label text-xs font-semibold">Tipe Akun Normal</label>
                <select
                  className="form-select text-xs"
                  value={mappingForm.targetType}
                  onChange={e => setMappingForm(f => ({ ...f, targetType: e.target.value }))}
                >
                  <option value="REVENUE">REVENUE (Pendapatan)</option>
                  <option value="EXPENSE">EXPENSE (Beban / HPP)</option>
                  <option value="ASSET">ASSET (Persediaan / Aset)</option>
                  <option value="LIABILITY">LIABILITY (Liabilitas / Utang)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="form-label text-xs font-semibold">Pilih Rekening Akun COA Terpetakan *</label>
              <SearchableSelect
                options={candidateAccounts}
                value={mappingForm.accountCode}
                onChange={val => setMappingForm(f => ({ ...f, accountCode: val }))}
                placeholder="Cari kode atau nama akun COA..."
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Pilih akun COA yang akan didebet/dikredit saat transaksi pada modul ini terjadi.
              </p>
            </div>

            <div>
              <label className="form-label text-xs font-semibold">Deskripsi / Aturan Akuntansi</label>
              <textarea
                className="form-textarea text-xs"
                rows={2}
                value={mappingForm.description}
                onChange={e => setMappingForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Catatan peruntukan pos ini dalam jurnal dan laporan keuangan..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={() => setModal(null)}
                disabled={isSavingMapping}
              >
                Batal
              </button>
              <button
                type="submit"
                className="btn-primary text-xs flex items-center gap-1.5"
                disabled={isSavingMapping || !mappingForm.label || !mappingForm.accountCode}
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSavingMapping ? 'Menyimpan...' : 'Simpan & Sinkronkan Mapping'}</span>
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
