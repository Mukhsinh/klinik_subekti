import { useState, useMemo, useRef } from 'react'
import {
  Plus, Pencil, PowerOff, Download, Upload, RefreshCw, Trash2,
  Settings, CheckCircle2, AlertTriangle, Layers, RotateCcw, Save, Search,
  BookOpen, TrendingUp, Scale, ArrowRightLeft, ShieldCheck, HelpCircle,
  Check, X, Stethoscope, Pill, PackageCheck, UserCheck, Zap, Building2,
  Wallet, ArrowDownLeft, ArrowUpRight, FileSpreadsheet, ExternalLink,
  ChevronRight, ArrowRight, Filter, Info, Sparkles
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
  getEffectiveAccountMappings,
  DEFAULT_AUTO_JOURNAL_TEMPLATES,
  getEffectiveAutoJournalTemplates,
  DEFAULT_BALANCE_SHEET_MAPPINGS,
  getEffectiveBalanceSheetMappings,
  DEFAULT_CASH_FLOW_MAPPINGS,
  getEffectiveCashFlowMappings,
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
  const appSettings = (storeAppSettings && typeof storeAppSettings === 'object' && (storeAppSettings.account_mappings || storeAppSettings.auto_journal_templates))
    ? storeAppSettings
    : (authAppSettings || {})

  // Main Tabs:
  // 'accounts'          : Daftar Akun COA
  // 'auto_journals'     : Jurnal Otomatis
  // 'income_statement'  : Mapping Rugi Laba
  // 'balance_sheet'     : Mapping Neraca
  // 'cash_flow'         : Mapping Arus Kas
  const [activeTab, setActiveTab] = useState('accounts')

  // Search & Filter for COA accounts
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [importData, setImportData] = useState([])
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef(null)

  // Loading state for saving to database
  const [isSaving, setIsSaving] = useState(false)

  // ── 1. MAPPING RUGI LABA STATE ──
  const [mappingSearch, setMappingSearch] = useState('')
  const [mappingFilter, setMappingFilter] = useState('ALL')
  const [selectedMapping, setSelectedMapping] = useState(null)
  const [mappingForm, setMappingForm] = useState({
    key: '',
    label: '',
    module: 'BILLING',
    accountCode: '',
    description: '',
    targetType: 'REVENUE'
  })

  // ── 2. JURNAL OTOMATIS STATE ──
  const [ajSearch, setAjSearch] = useState('')
  const [ajFilter, setAjFilter] = useState('ALL')
  const [selectedAj, setSelectedAj] = useState(null)
  const [ajForm, setAjForm] = useState({
    id: '',
    name: '',
    module: 'BILLING',
    moduleLabel: 'Billing Kasir',
    trigger: '',
    description: '',
    debits: [],
    credits: []
  })

  // ── 3. MAPPING NERACA STATE ──
  const [bsSearch, setBsSearch] = useState('')
  const [bsFilter, setBsFilter] = useState('ALL')
  const [selectedBs, setSelectedBs] = useState(null)
  const [bsForm, setBsForm] = useState({
    key: '',
    label: '',
    group: 'ASET LANCAR',
    accountCode: '',
    naturalBalance: 'DEBIT',
    description: ''
  })

  // ── 4. MAPPING ARUS KAS STATE ──
  const [cfSearch, setCfSearch] = useState('')
  const [cfFilter, setCfFilter] = useState('ALL')
  const [selectedCf, setSelectedCf] = useState(null)
  const [cfForm, setCfForm] = useState({
    key: '',
    label: '',
    section: 'OPERASI',
    sectionLabel: 'Aktivitas Operasi',
    flowType: 'INFLOW',
    accountCode: '',
    description: ''
  })

  // Effective datasets computed from DB settings
  const effectiveMappings = useMemo(() => getEffectiveAccountMappings(appSettings), [appSettings])
  const effectiveAutoJournals = useMemo(() => getEffectiveAutoJournalTemplates(appSettings), [appSettings])
  const effectiveBalanceSheet = useMemo(() => getEffectiveBalanceSheetMappings(appSettings), [appSettings])
  const effectiveCashFlow = useMemo(() => getEffectiveCashFlowMappings(appSettings), [appSettings])

  // Lookup map for COA table badges
  const mappingLookup = useMemo(() => {
    const lookup = {}
    Object.values(effectiveMappings).forEach(m => {
      if (!lookup[m.accountCode]) lookup[m.accountCode] = []
      lookup[m.accountCode].push(m)
    })
    return lookup
  }, [effectiveMappings])

  // Candidate accounts for SearchableSelect
  const candidateAccounts = useMemo(() => {
    return coa
      .filter(a => !a.isHeader)
      .map(a => ({
        value: a.accountCode,
        label: `${a.accountCode} — ${a.accountName}`,
        sub: `Tipe: ${a.accountType} | Grup: ${a.accountGroup || '—'} | Saldo: ${a.naturalBalance}`
      }))
  }, [coa])

  // Filtered COA accounts
  const TYPE_ORDER = { ASSET: 1, LIABILITY: 2, EQUITY: 3, REVENUE: 4, EXPENSE: 5 }
  const filteredCOA = useMemo(() =>
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

  // ── WORKFLOW CATEGORIZER UNTUK TAB 3 (MAPPING RUGI LABA & KASIR) ──
  const getWorkflowCategory = (item) => {
    const k = item.key || ''
    if (
      k.startsWith('billing_consultation') ||
      k.startsWith('billing_action') ||
      k.startsWith('billing_lab') ||
      k.startsWith('rev_consultation') ||
      k.startsWith('rev_action') ||
      k.startsWith('rev_lab')
    ) {
      return 'MEDIS'
    }
    if (
      k.startsWith('billing_pharmacy') ||
      k.startsWith('billing_cash') ||
      k.startsWith('billing_transfer') ||
      k.startsWith('billing_qris') ||
      k.startsWith('billing_piutang') ||
      k.startsWith('billing_ppn') ||
      k.startsWith('rev_pharmacy') ||
      k.startsWith('rev_obat')
    ) {
      return 'FARMASI'
    }
    if (k.startsWith('cogs_') || k.startsWith('inv_') || item.module === 'HPP') {
      return 'HPP'
    }
    if (
      k.startsWith('billing_doctor_fee') ||
      k.startsWith('billing_pph21') ||
      k.startsWith('exp_honor') ||
      k.startsWith('exp_gaji') ||
      k === 'expense_doctor_salary' ||
      k === 'expense_nurse_salary' ||
      k === 'expense_admin_salary' ||
      k === 'expense_allowance' ||
      k === 'expense_overtime'
    ) {
      return 'DOKTER'
    }
    return 'OPERASIONAL'
  }

  const RUGI_LABA_SECTIONS = [
    {
      id: 'MEDIS',
      title: 'Pendapatan Layanan Medis & Tindakan Klinik',
      icon: Stethoscope,
      accentColor: 'emerald',
      bgColor: 'bg-emerald-50/70 border-emerald-200',
      tagColor: 'bg-emerald-600 text-white',
      badgeClass: 'bg-emerald-100 text-emerald-800',
      description: 'Pemetaan pendapatan jasa pemeriksaan dokter umum, spesialis, tindakan medis & keperawatan, dan laboratorium medis.'
    },
    {
      id: 'FARMASI',
      title: 'Penjualan Farmasi Kasir & Metode Pembayaran Kas/Bank',
      icon: Pill,
      accentColor: 'blue',
      bgColor: 'bg-blue-50/70 border-blue-200',
      tagColor: 'bg-blue-600 text-white',
      badgeClass: 'bg-blue-100 text-blue-800',
      description: 'Pemetaan penjualan obat paten, obat OTC, BHP, rekening kas/bank penerimaan kasir (Tunai, Bank, QRIS), piutang BPJS/Asuransi, dan PPN.'
    },
    {
      id: 'HPP',
      title: 'Harga Pokok Penjualan (HPP FIFO) & Persediaan Farmasi',
      icon: PackageCheck,
      accentColor: 'amber',
      bgColor: 'bg-amber-50/70 border-amber-200',
      tagColor: 'bg-amber-600 text-white',
      badgeClass: 'bg-amber-100 text-amber-800',
      description: 'Pemetaan akun Beban Pokok Penjualan (HPP FIFO) dan pengurangan nilai buku aset persediaan obat di neraca saat transaksi diselesaikan.'
    },
    {
      id: 'DOKTER',
      title: 'Jasa Medis Dokter & Beban SDM Paramedis',
      icon: UserCheck,
      accentColor: 'indigo',
      bgColor: 'bg-indigo-50/70 border-indigo-200',
      tagColor: 'bg-indigo-600 text-white',
      badgeClass: 'bg-indigo-100 text-indigo-800',
      description: 'Pemetaan beban bagi hasil dokter umum & spesialis, pemotongan utang pajak PPh 21, utang fee bersih dokter, dan gaji paramedis.'
    },
    {
      id: 'OPERASIONAL',
      title: 'Beban Operasional Fasilitas Klinik & Pengeluaran Stok',
      icon: Zap,
      accentColor: 'purple',
      bgColor: 'bg-purple-50/70 border-purple-200',
      tagColor: 'bg-purple-600 text-white',
      badgeClass: 'bg-purple-100 text-purple-800',
      description: 'Pemetaan biaya operasional fasilitas (listrik PLN, air PDAM, internet, sewa gedung, ATK, pemeliharaan alat medis) dan pengeluaran obat stok.'
    }
  ]

  // Filtered & Grouped Rugi Laba mapping items
  const groupedRugiLaba = useMemo(() => {
    const groups = {}
    RUGI_LABA_SECTIONS.forEach(sec => {
      groups[sec.id] = []
    })

    Object.values(effectiveMappings).forEach(m => {
      const cat = getWorkflowCategory(m)
      const matchCat = mappingFilter === 'ALL' || mappingFilter === cat || mappingFilter === m.module
      const matchQ = !mappingSearch ||
        m.label.toLowerCase().includes(mappingSearch.toLowerCase()) ||
        m.accountCode.toLowerCase().includes(mappingSearch.toLowerCase()) ||
        (m.description || '').toLowerCase().includes(mappingSearch.toLowerCase()) ||
        (m.key || '').toLowerCase().includes(mappingSearch.toLowerCase())

      if (matchCat && matchQ) {
        if (!groups[cat]) groups[cat] = []
        groups[cat].push(m)
      }
    })
    return groups
  }, [effectiveMappings, mappingFilter, mappingSearch])

  const totalFilteredRugiLaba = useMemo(() => {
    return Object.values(groupedRugiLaba).reduce((sum, arr) => sum + arr.length, 0)
  }, [groupedRugiLaba])

  // Filtered Jurnal Otomatis templates
  const filteredAutoJournals = useMemo(() => {
    return Object.values(effectiveAutoJournals).filter(aj => {
      const matchMod = ajFilter === 'ALL' || aj.module === ajFilter
      const matchQ = !ajSearch ||
        aj.name.toLowerCase().includes(ajSearch.toLowerCase()) ||
        aj.trigger.toLowerCase().includes(ajSearch.toLowerCase()) ||
        (aj.description || '').toLowerCase().includes(ajSearch.toLowerCase()) ||
        aj.debits.some(d => d.code.toLowerCase().includes(ajSearch.toLowerCase()) || d.name.toLowerCase().includes(ajSearch.toLowerCase())) ||
        aj.credits.some(c => c.code.toLowerCase().includes(ajSearch.toLowerCase()) || c.name.toLowerCase().includes(ajSearch.toLowerCase()))
      return matchMod && matchQ
    })
  }, [effectiveAutoJournals, ajFilter, ajSearch])

  // Neraca Sections & Grouped Data
  const NERACA_SECTIONS = [
    {
      id: 'ASET LANCAR',
      title: '1. Aset Lancar (Current Assets)',
      icon: Wallet,
      accentColor: 'emerald',
      bgColor: 'bg-emerald-50/70 border-emerald-200',
      badgeClass: 'bg-emerald-100 text-emerald-800',
      description: 'Kas tunai kasir, saldo rekening bank operasional, piutang klaim BPJS & asuransi, serta persediaan obat dan BHP apotek.'
    },
    {
      id: 'ASET TIDAK LANCAR',
      title: '2. Aset Tidak Lancar / Tetap & Akumulasi Depresiasi',
      icon: Building2,
      accentColor: 'blue',
      bgColor: 'bg-blue-50/70 border-blue-200',
      badgeClass: 'bg-blue-100 text-blue-800',
      description: 'Peralatan & instrumen medis klinik, kendaraan operasional, bangunan tempat praktik, serta akumulasi penyusutan aset tetap.'
    },
    {
      id: 'LIABILITAS',
      title: '3. Liabilitas Jangka Pendek & Kewajiban Pajak',
      icon: Scale,
      accentColor: 'amber',
      bgColor: 'bg-amber-50/70 border-amber-200',
      badgeClass: 'bg-amber-100 text-amber-800',
      description: 'Utang usaha tempo distributor obat (PBF), utang jasa medis dokter, utang pemotongan PPh 21, dan utang PPN kasir.'
    },
    {
      id: 'EKUITAS',
      title: '4. Ekuitas Modal Pemilik & Saldo Laba',
      icon: Layers,
      accentColor: 'purple',
      bgColor: 'bg-purple-50/70 border-purple-200',
      badgeClass: 'bg-purple-100 text-purple-800',
      description: 'Setoran modal pemilik/pendiri klinik, saldo laba ditahan akumulatif, dan laba/rugi bersih periode berjalan.'
    }
  ]

  const groupedNeraca = useMemo(() => {
    const groups = {
      'ASET LANCAR': [],
      'ASET TIDAK LANCAR': [],
      'LIABILITAS': [],
      'EKUITAS': []
    }

    Object.values(effectiveBalanceSheet).forEach(bs => {
      let secId = 'ASET LANCAR'
      if (bs.group === 'ASET TIDAK LANCAR' || bs.group?.includes('TIDAK LANCAR') || bs.group?.includes('TETAP')) {
        secId = 'ASET TIDAK LANCAR'
      } else if (bs.group?.includes('LIABILITAS')) {
        secId = 'LIABILITAS'
      } else if (bs.group?.includes('EKUITAS')) {
        secId = 'EKUITAS'
      }

      const matchGrp = bsFilter === 'ALL' || bsFilter === secId || bs.group === bsFilter
      const matchQ = !bsSearch ||
        bs.label.toLowerCase().includes(bsSearch.toLowerCase()) ||
        bs.accountCode.toLowerCase().includes(bsSearch.toLowerCase()) ||
        (bs.description || '').toLowerCase().includes(bsSearch.toLowerCase())

      if (matchGrp && matchQ) {
        if (!groups[secId]) groups[secId] = []
        groups[secId].push(bs)
      }
    })
    return groups
  }, [effectiveBalanceSheet, bsFilter, bsSearch])

  const totalFilteredNeraca = useMemo(() => {
    return Object.values(groupedNeraca).reduce((sum, arr) => sum + arr.length, 0)
  }, [groupedNeraca])

  // Cash Flow Sections & Grouped Data
  const CASH_FLOW_SECTIONS = [
    {
      id: 'OPERASI',
      title: '1. Aktivitas Operasi (Operating Cash Flow)',
      icon: ArrowRightLeft,
      accentColor: 'emerald',
      bgColor: 'bg-emerald-50/70 border-emerald-200',
      badgeClass: 'bg-emerald-100 text-emerald-800',
      description: 'Aliran kas dari transaksi kasir pasien, klaim BPJS/Asuransi, pembayaran obat ke PBF, jasa dokter, dan operasional fasilitas.'
    },
    {
      id: 'INVESTASI',
      title: '2. Aktivitas Investasi (Investing Cash Flow)',
      icon: Building2,
      accentColor: 'blue',
      bgColor: 'bg-blue-50/70 border-blue-200',
      badgeClass: 'bg-blue-100 text-blue-800',
      description: 'Aliran kas untuk pembelian perlengkapan & instrumen medis baru, renovasi fasilitas, dan penjualan aset lama.'
    },
    {
      id: 'PENDANAAN',
      title: '3. Aktivitas Pendanaan (Financing Cash Flow)',
      icon: Wallet,
      accentColor: 'purple',
      bgColor: 'bg-purple-50/70 border-purple-200',
      badgeClass: 'bg-purple-100 text-purple-800',
      description: 'Aliran kas dari setoran tambahan modal pemilik, pencairan kredit bank, penarikan prive pribadi, dan cicilan bank.'
    }
  ]

  const groupedArusKas = useMemo(() => {
    const groups = {
      'OPERASI': [],
      'INVESTASI': [],
      'PENDANAAN': []
    }

    Object.values(effectiveCashFlow).forEach(cf => {
      const secId = cf.section || 'OPERASI'
      const matchSec = cfFilter === 'ALL' || cfFilter === secId
      const matchQ = !cfSearch ||
        cf.label.toLowerCase().includes(cfSearch.toLowerCase()) ||
        cf.accountCode.toLowerCase().includes(cfSearch.toLowerCase()) ||
        (cf.description || '').toLowerCase().includes(cfSearch.toLowerCase())

      if (matchSec && matchQ) {
        if (!groups[secId]) groups[secId] = []
        groups[secId].push(cf)
      }
    })
    return groups
  }, [effectiveCashFlow, cfFilter, cfSearch])

  const totalFilteredArusKas = useMemo(() => {
    return Object.values(groupedArusKas).reduce((sum, arr) => sum + arr.length, 0)
  }, [groupedArusKas])

  // Handlers for Account (COA)
  const handleSaveAccount = (data) => {
    if (modal === 'add') {
      if (coa.find(a => a.accountCode === data.accountCode)) {
        toast.error(`Kode akun ${data.accountCode} sudah ada.`)
        return
      }
      addAccount({ ...data, isActive: true, sortOrder: coa.length * 10 })
      toast.success('Akun berhasil ditambahkan ke database.')
    } else {
      updateAccount(selected.accountCode, data)
      toast.success('Akun berhasil diperbarui di database.')
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
        toast.success('Data COA lama berhasil dibersihkan')
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
    if (!window.confirm('⚠️ BAHAYA: Menghapus SEMUA akun COA di database. Data tidak dapat dikembalikan! Lanjutkan?')) return
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
    XLSX.writeFile(wb, 'Kode_COA_Klinik.xlsx')
    toast.success('File Excel berhasil diunduh.')
  }

  // ── SINKRONISASI MASTER COA DARI FILE UPDATE ──
  const handleReloadMasterUpdate = async () => {
    if (!window.confirm('Muat ulang seluruh 184 akun standar dari file master "chart_of_accounts_rows_UPDATE"? Tindakan ini akan menyinkronkan data COA ke database Supabase.')) return
    setIsSaving(true)
    try {
      const res = await fetch('/chart_of_accounts_rows_UPDATE.csv')
      if (!res.ok) throw new Error('File master tidak ditemukan di /chart_of_accounts_rows_UPDATE.csv')
      const text = await res.text()
      const lines = text.split('\n').filter(l => l.trim())
      const parsed = []
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',')
        if (parts.length >= 7) {
          parsed.push({
            accountCode: parts[0].trim(),
            accountName: parts[1].trim(),
            accountType: parts[2].trim().toUpperCase(),
            accountGroup: parts[3].trim(),
            accountSubgroup: parts[4].trim() || null,
            naturalBalance: parts[5].trim().toUpperCase(),
            isHeader: parts[6].trim().toLowerCase() === 'true',
            isActive: true,
            sortOrder: i * 10
          })
        }
      }
      if (parsed.length > 0) {
        await batchAddAccounts(parsed)
        await refreshAll()
        toast.success(`Berhasil memuat ${parsed.length} akun master dari chart_of_accounts_rows_UPDATE`)
      }
    } catch (err) {
      console.error(err)
      toast.error('Gagal memuat file master: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  // ── HANDLER SIMPAN / UPDATE KE DATABASE SUPABASE ──
  const persistSettingToDB = async (key, payload, successMsg) => {
    setIsSaving(true)
    try {
      if (typeof updateAppSettings === 'function') {
        await updateAppSettings({ [key]: payload }).catch(err => console.warn('[updateAppSettings]', err))
      }
      if (typeof saveAppSettings === 'function') {
        await saveAppSettings({ [key]: payload }).catch(err => console.warn('[saveAppSettings]', err))
      }
      if (typeof refreshAll === 'function') {
        await refreshAll().catch(err => console.warn('[refreshAll]', err))
      }
      toast.success(successMsg)
      setModal(null)
    } catch (err) {
      console.error('[persistSettingToDB] Error:', err)
      toast.error(`Gagal menyimpan ke database: ${err.message}`)
    } finally {
      setIsSaving(false)
    }
  }

  // 1. Handlers Rugi Laba
  const handleOpenAddRugiLaba = () => {
    setMappingForm({
      key: `custom_${Date.now()}`,
      label: '',
      module: 'BILLING',
      accountCode: '',
      description: '',
      targetType: 'REVENUE'
    })
    setModal('add_rugi_laba')
  }

  const handleOpenEditRugiLaba = (item) => {
    setSelectedMapping(item)
    setMappingForm({
      key: item.key,
      label: item.label,
      module: item.module,
      accountCode: item.accountCode,
      description: item.description || '',
      targetType: item.targetType || 'EXPENSE'
    })
    setModal('edit_rugi_laba')
  }

  const handleSaveRugiLaba = async (e) => {
    e.preventDefault()
    if (!mappingForm.label.trim()) return toast.error('Nama pos transaksi wajib diisi')
    if (!mappingForm.accountCode) return toast.error('Kode rekening COA wajib dipilih')

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

    await persistSettingToDB(
      'account_mappings',
      currentSaved,
      `Mapping Rugi Laba "${mappingForm.label}" berhasil disimpan di database Supabase!`
    )
  }

  const handleDeleteOrResetRugiLaba = async (item) => {
    const isCustom = item.isCustom
    const confirmMsg = isCustom
      ? `Hapus pemetaan kustom "${item.label}"?`
      : `Kembalikan pemetaan "${item.label}" ke kode akun default sistem (${item.defaultCode})?`
    if (!window.confirm(confirmMsg)) return

    const currentSaved = { ...(appSettings?.account_mappings || {}) }
    delete currentSaved[item.key]

    await persistSettingToDB(
      'account_mappings',
      currentSaved,
      isCustom ? `Mapping "${item.label}" berhasil dihapus dari database.` : `Mapping "${item.label}" dikembalikan ke default.`
    )
  }

  // 2. Handlers Jurnal Otomatis
  const handleOpenEditAutoJournal = (item) => {
    setSelectedAj(item)
    setAjForm({
      id: item.id,
      name: item.name,
      module: item.module,
      moduleLabel: item.moduleLabel,
      trigger: item.trigger,
      description: item.description,
      debits: JSON.parse(JSON.stringify(item.debits || [])),
      credits: JSON.parse(JSON.stringify(item.credits || []))
    })
    setModal('edit_auto_journal')
  }

  const handleSaveAutoJournal = async (e) => {
    e.preventDefault()
    if (!ajForm.name.trim()) return toast.error('Nama template jurnal wajib diisi')

    const currentSaved = { ...(appSettings?.auto_journal_templates || {}) }
    currentSaved[ajForm.id] = {
      ...ajForm,
      isCustom: !DEFAULT_AUTO_JOURNAL_TEMPLATES[ajForm.id]
    }

    await persistSettingToDB(
      'auto_journal_templates',
      currentSaved,
      `Struktur Jurnal Otomatis "${ajForm.name}" berhasil disimpan di database Supabase!`
    )
  }

  const handleResetAutoJournal = async (item) => {
    if (!window.confirm(`Kembalikan struktur jurnal otomatis "${item.name}" ke standar bawaan sistem?`)) return
    const currentSaved = { ...(appSettings?.auto_journal_templates || {}) }
    delete currentSaved[item.id]

    await persistSettingToDB(
      'auto_journal_templates',
      currentSaved,
      `Struktur Jurnal Otomatis "${item.name}" berhasil direset ke standar sistem.`
    )
  }

  // 3. Handlers Mapping Neraca
  const handleOpenEditNeraca = (item) => {
    setSelectedBs(item)
    setBsForm({
      key: item.key,
      label: item.label,
      group: item.group,
      accountCode: item.accountCode,
      naturalBalance: item.naturalBalance || 'DEBIT',
      description: item.description || ''
    })
    setModal('edit_neraca')
  }

  const handleSaveNeraca = async (e) => {
    e.preventDefault()
    if (!bsForm.label.trim()) return toast.error('Nama pos neraca wajib diisi')
    if (!bsForm.accountCode) return toast.error('Kode rekening COA wajib dipilih')

    const currentSaved = { ...(appSettings?.balance_sheet_mappings || {}) }
    const selectedAcc = coa.find(a => a.accountCode === bsForm.accountCode)

    currentSaved[bsForm.key] = {
      key: bsForm.key,
      label: bsForm.label.trim(),
      group: bsForm.group,
      accountCode: bsForm.accountCode,
      naturalBalance: selectedAcc?.naturalBalance || bsForm.naturalBalance,
      description: bsForm.description.trim(),
      isCustom: !DEFAULT_BALANCE_SHEET_MAPPINGS[bsForm.key]
    }

    await persistSettingToDB(
      'balance_sheet_mappings',
      currentSaved,
      `Mapping Neraca "${bsForm.label}" berhasil disimpan di database Supabase!`
    )
  }

  const handleResetNeraca = async (item) => {
    if (!window.confirm(`Kembalikan pos neraca "${item.label}" ke kode akun default (${item.defaultCode})?`)) return
    const currentSaved = { ...(appSettings?.balance_sheet_mappings || {}) }
    delete currentSaved[item.key]

    await persistSettingToDB(
      'balance_sheet_mappings',
      currentSaved,
      `Mapping Neraca "${item.label}" dikembalikan ke default.`
    )
  }

  // 4. Handlers Mapping Arus Kas
  const handleOpenEditArusKas = (item) => {
    setSelectedCf(item)
    setCfForm({
      key: item.key,
      label: item.label,
      section: item.section,
      sectionLabel: item.sectionLabel || 'Aktivitas Operasi',
      flowType: item.flowType || 'INFLOW',
      accountCode: item.accountCode,
      description: item.description || ''
    })
    setModal('edit_arus_kas')
  }

  const handleSaveArusKas = async (e) => {
    e.preventDefault()
    if (!cfForm.label.trim()) return toast.error('Nama pos arus kas wajib diisi')
    if (!cfForm.accountCode) return toast.error('Kode rekening COA wajib dipilih')

    const currentSaved = { ...(appSettings?.cash_flow_mappings || {}) }

    currentSaved[cfForm.key] = {
      key: cfForm.key,
      label: cfForm.label.trim(),
      section: cfForm.section,
      sectionLabel: cfForm.section === 'OPERASI' ? 'Aktivitas Operasi' : cfForm.section === 'INVESTASI' ? 'Aktivitas Investasi' : 'Aktivitas Pendanaan',
      flowType: cfForm.flowType,
      accountCode: cfForm.accountCode,
      description: cfForm.description.trim(),
      isCustom: !DEFAULT_CASH_FLOW_MAPPINGS[cfForm.key]
    }

    await persistSettingToDB(
      'cash_flow_mappings',
      currentSaved,
      `Mapping Arus Kas "${cfForm.label}" berhasil disimpan di database Supabase!`
    )
  }

  const handleResetArusKas = async (item) => {
    if (!window.confirm(`Kembalikan pos arus kas "${item.label}" ke kode akun default (${item.defaultCode})?`)) return
    const currentSaved = { ...(appSettings?.cash_flow_mappings || {}) }
    delete currentSaved[item.key]

    await persistSettingToDB(
      'cash_flow_mappings',
      currentSaved,
      `Mapping Arus Kas "${item.label}" dikembalikan ke default.`
    )
  }

  const handleSyncNow = async () => {
    setIsSaving(true)
    try {
      await refreshAll()
      toast.success('Database COA dan konfigurasi mapping berhasil disinkronkan!')
    } catch (err) {
      toast.error('Gagal sinkronisasi: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const summary = ACCOUNT_TYPES.reduce((acc, t) => ({ ...acc, [t]: coa.filter(a => a.accountType === t && a.isActive).length }), {})

  return (
    <div className="space-y-5 max-w-full overflow-hidden">
      {/* 1. Page Header (Bersih: Hanya Judul) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
            Kode dan Mapping COA
          </h1>
        </div>

        {/* Action Buttons based on active tab */}
        <div className="flex flex-wrap items-center gap-2">
          {activeTab === 'accounts' ? (
            <>
              <button
                className="btn-emerald text-xs flex items-center gap-1.5 py-1.5 px-3 shadow-xs"
                onClick={handleReloadMasterUpdate}
                title="Muat ulang seluruh 184 akun standar dari master file chart_of_accounts_rows_UPDATE"
                disabled={isSaving}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Muat Master UPDATE</span>
              </button>
              <button className="btn-royal-blue text-xs flex items-center gap-1.5 py-1.5 px-3 shadow-xs" onClick={exportXLSX}>
                <Download className="w-3.5 h-3.5" />
                <span>Unduh Excel</span>
              </button>
              <button className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-3 shadow-xs" onClick={() => fileInputRef.current?.click()}>
                <Upload className="w-3.5 h-3.5" />
                <span>Impor File</span>
              </button>
              <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} className="hidden" />
              <button className="btn-danger-red text-xs flex items-center gap-1.5 py-1.5 px-3 shadow-xs" onClick={() => { setSelected(null); setModal('add') }}>
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Akun</span>
              </button>
            </>
          ) : (
            <>
              <button className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-3 shadow-xs" onClick={handleSyncNow} disabled={isSaving}>
                <RefreshCw className={`w-3.5 h-3.5 ${isSaving ? 'animate-spin text-primary-600' : ''}`} />
                <span>Sinkronkan Database</span>
              </button>
              {activeTab === 'income_statement' && (
                <button className="btn-primary text-xs flex items-center gap-1.5 py-1.5 px-3 shadow-xs" onClick={handleOpenAddRugiLaba}>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Pos Rugi Laba</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* 2. Main Tab Navigation (Warna-Warna Solid Cerah, Kompak, Tanpa Scroll Horizontal) */}
      <div className="bg-slate-100 p-1.5 rounded-xl border border-slate-200 shadow-xs">
        <nav className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5 w-full">
          {/* Tab 1: COA - Biru Solid Cerah */}
          <button
            onClick={() => setActiveTab('accounts')}
            className={`py-2 px-2.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 text-center shadow-xs ${
              activeTab === 'accounts'
                ? 'bg-blue-600 text-white font-bold ring-2 ring-blue-400/50'
                : 'bg-white text-slate-700 hover:bg-blue-50 hover:text-blue-700 border border-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Daftar Akun COA</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
              activeTab === 'accounts' ? 'bg-blue-800/80 text-white' : 'bg-blue-100 text-blue-800'
            }`}>
              {coa.length}
            </span>
          </button>

          {/* Tab 2: Jurnal Otomatis - Emerald / Hijau Solid Cerah */}
          <button
            onClick={() => setActiveTab('auto_journals')}
            className={`py-2 px-2.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 text-center shadow-xs ${
              activeTab === 'auto_journals'
                ? 'bg-emerald-600 text-white font-bold ring-2 ring-emerald-400/50'
                : 'bg-white text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Jurnal Otomatis</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
              activeTab === 'auto_journals' ? 'bg-emerald-800/80 text-white' : 'bg-emerald-100 text-emerald-800'
            }`}>
              {Object.keys(effectiveAutoJournals).length}
            </span>
          </button>

          {/* Tab 3: Mapping Rugi Laba - Amber / Orange Solid Cerah */}
          <button
            onClick={() => setActiveTab('income_statement')}
            className={`py-2 px-2.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 text-center shadow-xs ${
              activeTab === 'income_statement'
                ? 'bg-amber-500 text-white font-bold ring-2 ring-amber-400/50'
                : 'bg-white text-slate-700 hover:bg-amber-50 hover:text-amber-700 border border-slate-200'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Mapping Rugi Laba</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
              activeTab === 'income_statement' ? 'bg-amber-700/80 text-white' : 'bg-amber-100 text-amber-800'
            }`}>
              {Object.keys(effectiveMappings).length}
            </span>
          </button>

          {/* Tab 4: Mapping Neraca - Sky Blue Solid Cerah */}
          <button
            onClick={() => setActiveTab('balance_sheet')}
            className={`py-2 px-2.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 text-center shadow-xs ${
              activeTab === 'balance_sheet'
                ? 'bg-sky-600 text-white font-bold ring-2 ring-sky-400/50'
                : 'bg-white text-slate-700 hover:bg-sky-50 hover:text-sky-700 border border-slate-200'
            }`}
          >
            <Scale className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Mapping Neraca</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
              activeTab === 'balance_sheet' ? 'bg-sky-800/80 text-white' : 'bg-sky-100 text-sky-800'
            }`}>
              {Object.keys(effectiveBalanceSheet).length}
            </span>
          </button>

          {/* Tab 5: Mapping Arus Kas - Purple Solid Cerah */}
          <button
            onClick={() => setActiveTab('cash_flow')}
            className={`py-2 px-2.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 text-center shadow-xs ${
              activeTab === 'cash_flow'
                ? 'bg-purple-600 text-white font-bold ring-2 ring-purple-400/50'
                : 'bg-white text-slate-700 hover:bg-purple-50 hover:text-purple-700 border border-slate-200'
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Mapping Arus Kas</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
              activeTab === 'cash_flow' ? 'bg-purple-800/80 text-white' : 'bg-purple-100 text-purple-800'
            }`}>
              {Object.keys(effectiveCashFlow).length}
            </span>
          </button>
        </nav>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          TAB 1: DAFTAR AKUN COA (Banner telah dihapus sesuai instruksi)
          ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'accounts' && (
        <div className="space-y-4 animate-fadeIn">
          {/* Account Type Filters */}
          <div className="flex flex-wrap gap-1.5 md:gap-2">
            {ACCOUNT_TYPES.map(t => (
              <button key={t} onClick={() => setTypeFilter(typeFilter === t ? 'ALL' : t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${typeFilter === t ? 'bg-primary-600 text-white border-primary-600 shadow-xs' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                {accountTypeLabel(t)} <span className="ml-1 opacity-80 font-mono">({summary[t]})</span>
              </button>
            ))}
            <button onClick={() => setTypeFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${typeFilter === 'ALL' ? 'bg-slate-800 text-white border-slate-800 shadow-xs' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
              Semua <span className="ml-1 opacity-80 font-mono">({coa.length})</span>
            </button>
          </div>

          {/* Accounts Table Card */}
          <div className="card overflow-hidden border border-slate-200 shadow-xs bg-white rounded-xl">
            <div className="card-header gap-3 p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between">
              <SearchInput value={search} onChange={setSearch} placeholder="Cari kode atau nama akun…" className="w-72" />
              <span className="text-xs text-slate-500 font-medium">{filteredCOA.length} akun terdaftar</span>
            </div>
            <div className="overflow-x-auto w-full">
              <table className="table-base w-full text-xs text-left">
                <thead>
                  <tr className="bg-slate-100 text-slate-700">
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
                <tbody className="divide-y divide-slate-100">
                  {filteredCOA.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-10 text-slate-400">Tidak ada akun ditemukan</td></tr>
                  ) : filteredCOA.map(acc => (
                    <tr key={acc.accountCode} className={acc.isHeader ? 'bg-slate-50/60 font-semibold' : 'hover:bg-slate-50/50'}>
                      <td>
                        <span className={`font-mono text-xs ${acc.isHeader ? 'font-bold text-slate-700' : 'text-primary-700 font-bold'}`}>
                          {acc.accountCode}
                        </span>
                      </td>
                      <td className={`${acc.isHeader ? 'font-bold text-slate-800' : 'font-medium text-slate-900'} ${acc.accountCode.split('-').length === 1 ? 'uppercase' : acc.accountCode.split('-').length === 2 ? 'pl-3' : 'pl-6'}`}>
                        <div>{acc.accountName}</div>
                        {mappingLookup[acc.accountCode] && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {mappingLookup[acc.accountCode].map((m, idx) => (
                              <button
                                key={idx}
                                onClick={() => { setActiveTab('income_statement'); setMappingFilter(m.module); setMappingSearch(m.label) }}
                                className="inline-block text-[10px] bg-primary-50 text-primary-700 border border-primary-200 px-1.5 py-0.5 rounded font-medium hover:bg-primary-100 cursor-pointer text-left"
                                title="Klik untuk membuka mapping ini di tab Mapping Rugi Laba"
                              >
                                Terpetakan: {m.label} ({m.moduleLabel})
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
                      <td className="text-center text-xs font-bold text-slate-600">{acc.isHeader ? '✓' : ''}</td>
                      <td className="text-center"><StatusBadge status={acc.isActive ? 'ACTIVE' : 'INACTIVE'} /></td>
                      <td className="text-center">
                        {!acc.isHeader && (
                          <div className="flex items-center justify-center gap-1.5">
                            <button className="btn-action-edit" onClick={() => { setSelected(acc); setModal('edit') }} title="Edit Akun"><Pencil className="w-3.5 h-3.5" /></button>
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

      {/* ══════════════════════════════════════════════════════════════
          TAB 2: JURNAL OTOMATIS (Detail Lengkap + Debet & Kredit + Edit)
          ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'auto_journals' && (
        <div className="space-y-4 animate-fadeIn">
          {/* Card Penjelasan & Filter */}
          <div className="card p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-emerald-600" />
                  Struktur Jurnal Otomatis Sistem
                </h2>
                <p className="text-xs text-slate-500 mt-1 max-w-4xl leading-relaxed">
                  Rincian struktur jurnal akuntansi otomatis ganda (double-entry) yang otomatis diposting oleh sistem saat transaksi terjadi pada modul Kasir (/billing), Farmasi HPP FIFO, Pengeluaran Stok (/stock-outflow), Pengeluaran Beban (/expenses), dan Aset Tetap (/assets). Klik ikon <strong>Edit</strong> untuk merevisi akun debit/kredit dan menyimpan langsung ke database Supabase.
                </p>
              </div>
            </div>

            {/* Filter Modules & Search */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'ALL', label: 'Semua Alur' },
                  { id: 'BILLING', label: 'Billing Kasir' },
                  { id: 'HPP', label: 'HPP & Persediaan' },
                  { id: 'STOCK_OUTFLOW', label: 'Pengeluaran Stok' },
                  { id: 'EXPENSES', label: 'Beban Operasional' },
                  { id: 'ASSETS', label: 'Aset Tetap & Depresiasi' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setAjFilter(tab.id)}
                    className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${ajFilter === tab.id
                      ? 'bg-emerald-600 text-white shadow-xs'
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
                    placeholder="Cari alur / nama jurnal / akun..."
                    value={ajSearch}
                    onChange={e => setAjSearch(e.target.value)}
                    className="form-input text-xs pl-8 py-1.5 w-full"
                  />
                </div>
              </div>
            </div>

            {/* List / Table Jurnal Otomatis */}
            <div className="space-y-3">
              {filteredAutoJournals.length === 0 ? (
                <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-lg border border-slate-200">
                  Tidak ada struktur jurnal otomatis yang cocok dengan filter / pencarian.
                </div>
              ) : (
                filteredAutoJournals.map(aj => (
                  <div key={aj.id} className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs hover:border-emerald-300 transition-colors">
                    {/* Header Jurnal */}
                    <div className="bg-slate-50/80 px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${aj.module === 'BILLING' ? 'bg-emerald-100 text-emerald-800' :
                          aj.module === 'HPP' ? 'bg-amber-100 text-amber-800' :
                            aj.module === 'STOCK_OUTFLOW' ? 'bg-blue-100 text-blue-800' :
                              aj.module === 'EXPENSES' ? 'bg-purple-100 text-purple-800' :
                                'bg-indigo-100 text-indigo-800'
                          }`}>
                          {aj.moduleLabel}
                        </span>
                        <h3 className="text-sm font-bold text-slate-900">{aj.name}</h3>
                        {aj.isModified && (
                          <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0.2 rounded font-semibold">
                            Disesuaikan
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleOpenEditAutoJournal(aj)}
                          className="px-2.5 py-1 text-xs font-semibold rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 flex items-center gap-1"
                          title="Edit struktur jurnal ini"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span>Revisi Jurnal</span>
                        </button>
                        {aj.isModified && (
                          <button
                            onClick={() => handleResetAutoJournal(aj)}
                            className="px-2 py-1 text-xs font-medium rounded border bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-300"
                            title="Reset ke skema standar sistem"
                          >
                            <RotateCcw className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Deskripsi & Pemicu Transaksi */}
                    <div className="px-4 py-2.5 bg-slate-50/30 text-xs border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-2 text-slate-600">
                      <div>
                        <strong className="text-slate-700">Pemicu Sistem:</strong> {aj.trigger}
                      </div>
                      <div className="text-slate-500 italic">
                        {aj.description}
                      </div>
                    </div>

                    {/* Rincian Posisi Debet & Kredit Berdampingan */}
                    <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200">
                      {/* Sisi DEBET */}
                      <div className="p-3 bg-blue-50/30">
                        <div className="flex items-center justify-between pb-2 border-b border-blue-100 mb-2">
                          <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                            AKUN POSISI DEBET (DR)
                          </span>
                          <span className="text-[11px] text-blue-700 font-medium">{aj.debits.length} Akun</span>
                        </div>
                        <div className="space-y-1.5">
                          {aj.debits.map((d, idx) => {
                            const acc = coa.find(a => a.accountCode === d.code)
                            return (
                              <div key={idx} className="bg-white p-2 rounded border border-blue-100 text-xs flex items-start justify-between gap-2">
                                <div>
                                  <div className="font-mono font-bold text-blue-800 text-[11px] flex items-center gap-1.5">
                                    <span>{d.code}</span>
                                    <span className="text-slate-700 font-sans font-medium">{acc ? acc.accountName : d.name}</span>
                                  </div>
                                  <p className="text-[10px] text-slate-500 mt-0.5">{d.note}</p>
                                </div>
                                <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-mono font-bold shrink-0">
                                  DEBIT
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* Sisi KREDIT */}
                      <div className="p-3 bg-purple-50/30">
                        <div className="flex items-center justify-between pb-2 border-b border-purple-100 mb-2">
                          <span className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-purple-600"></span>
                            AKUN POSISI KREDIT (CR)
                          </span>
                          <span className="text-[11px] text-purple-700 font-medium">{aj.credits.length} Akun</span>
                        </div>
                        <div className="space-y-1.5">
                          {aj.credits.map((c, idx) => {
                            const acc = coa.find(a => a.accountCode === c.code)
                            return (
                              <div key={idx} className="bg-white p-2 rounded border border-purple-100 text-xs flex items-start justify-between gap-2">
                                <div>
                                  <div className="font-mono font-bold text-purple-800 text-[11px] flex items-center gap-1.5">
                                    <span>{c.code}</span>
                                    <span className="text-slate-700 font-sans font-medium">{acc ? acc.accountName : c.name}</span>
                                  </div>
                                  <p className="text-[10px] text-slate-500 mt-0.5">{c.note}</p>
                                </div>
                                <span className="text-[10px] bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded font-mono font-bold shrink-0">
                                  KREDIT
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          TAB 3: MAPPING RUGI LABA & KASIR (Intuitive Workflow Sections)
          ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'income_statement' && (
        <div className="space-y-4 animate-fadeIn">
          {/* Header & Quick Summary */}
          <div className="card p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-amber-600" />
                  Mapping Rugi Laba & Kasir (Income Statement & Cashier Accounts)
                </h2>
                <p className="text-xs text-slate-500 mt-1 max-w-4xl leading-relaxed">
                  Atur akun COA untuk setiap jenis transaksi layanan medis, penerimaan kasir (Tunai, QRIS, Bank, Klaim BPJS/Asuransi), HPP FIFO, jasa medis dokter, dan beban fasilitas operasional. Perubahan pemetaan otomatis tersimpan ke Supabase dan langsung menjadi acuan seluruh transaksi kasir, inventaris, dan Laporan Laba Rugi (<span className="font-mono text-primary-700">/income-statement</span>).
                </p>
              </div>
              <button
                type="button"
                onClick={handleOpenAddRugiLaba}
                className="btn-primary text-xs flex items-center gap-1.5 py-1.5 px-3 self-start md:self-auto shrink-0 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Pos Transaksi</span>
              </button>
            </div>

            {/* Quick Metrics Bar per Workflow */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 pt-2 border-t border-slate-100">
              {RUGI_LABA_SECTIONS.map(sec => {
                const count = (groupedRugiLaba[sec.id] || []).length
                const IconComp = sec.icon
                return (
                  <button
                    key={sec.id}
                    onClick={() => setMappingFilter(mappingFilter === sec.id ? 'ALL' : sec.id)}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      mappingFilter === sec.id
                        ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-400/30'
                        : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <div className="flex items-center gap-1.5">
                        <IconComp className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                        <span className="text-[11px] font-bold text-slate-800 truncate">{sec.id}</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold bg-white px-1.5 py-0.2 rounded border border-slate-200 text-slate-700">
                        {count}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 line-clamp-1">{sec.title}</p>
                  </button>
                )
              })}
            </div>

            {/* Filters by Module & Search */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setMappingFilter('ALL')}
                  className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-colors ${
                    mappingFilter === 'ALL'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Semua Alur ({totalFilteredRugiLaba})
                </button>
                {RUGI_LABA_SECTIONS.map(sec => (
                  <button
                    key={sec.id}
                    onClick={() => setMappingFilter(sec.id)}
                    className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                      mappingFilter === sec.id
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {sec.title.split('&')[0].trim()}
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
          </div>

          {/* Grouped Workflow Sections */}
          {totalFilteredRugiLaba === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl border border-slate-200 text-slate-400">
              <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2 opacity-80" />
              <p className="text-sm font-semibold text-slate-700">Tidak ada mapping pos rugi laba yang cocok</p>
              <p className="text-xs text-slate-400 mt-1">Coba sesuaikan kata kunci pencarian atau ubah filter alur di atas.</p>
            </div>
          ) : (
            RUGI_LABA_SECTIONS.map(sec => {
              const items = groupedRugiLaba[sec.id] || []
              if (items.length === 0) return null
              const IconComp = sec.icon

              return (
                <div key={sec.id} className="card bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
                  {/* Section Header Banner */}
                  <div className="bg-slate-50/80 px-4 py-3 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                        <IconComp className="w-4 h-4 text-amber-700" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900">{sec.title}</h3>
                          <span className="text-[10px] font-mono font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                            {items.length} Pos
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">{sec.description}</p>
                      </div>
                    </div>
                  </div>

                  {/* Table per Section */}
                  <div className="overflow-x-auto w-full">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100/70 text-slate-700 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-2.5 w-1/3">Pos Transaksi & Alur Sistem</th>
                          <th className="px-4 py-2.5 w-1/3">Rekening Akun Terpetakan di COA</th>
                          <th className="px-4 py-2.5 text-center whitespace-nowrap">Status Database</th>
                          <th className="px-4 py-2.5 text-right whitespace-nowrap">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {items.map(item => {
                          const mappedAcc = coa.find(a => a.accountCode === item.accountCode)
                          const isCustom = item.isCustom
                          const isModified = item.isModified

                          return (
                            <tr key={item.key} className="hover:bg-slate-50/70 transition-colors">
                              <td className="px-4 py-3 align-top">
                                <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                                  <span>{item.label}</span>
                                  {isCustom ? (
                                    <span className="text-[9px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded font-bold">Kustom</span>
                                  ) : isModified ? (
                                    <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-bold">Disesuaikan</span>
                                  ) : null}
                                </div>
                                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                  {item.description || 'Digunakan pada modul ' + item.moduleLabel}
                                </p>
                                <span className="inline-block mt-1 text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded">
                                  Key: {item.key}
                                </span>
                              </td>

                              <td className="px-4 py-3 align-top">
                                {mappedAcc ? (
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-mono font-bold text-primary-700 text-xs bg-primary-50 px-2 py-0.5 rounded border border-primary-200">
                                        {item.accountCode}
                                      </span>
                                      <span className="font-semibold text-slate-800">{mappedAcc.accountName}</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-[10px] text-slate-500">
                                      <span className="badge badge-gray">{mappedAcc.accountType}</span>
                                      <span>•</span>
                                      <span>Grup: {mappedAcc.accountGroup || '—'}</span>
                                      <span>•</span>
                                      <span className="font-mono">Saldo: {mappedAcc.naturalBalance}</span>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-rose-600 font-semibold flex items-center gap-1">
                                    <AlertTriangle className="w-4 h-4 shrink-0" />
                                    <span>Kode akun {item.accountCode} belum terdaftar di COA</span>
                                  </div>
                                )}
                              </td>

                              <td className="px-4 py-3 align-middle text-center whitespace-nowrap">
                                {mappedAcc ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                    Terhubung Aktif
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-full">
                                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                                    Perlu Perbaikan
                                  </span>
                                )}
                              </td>

                              <td className="px-4 py-3 align-middle text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => handleOpenEditRugiLaba(item)}
                                    className="px-2.5 py-1 text-xs font-semibold rounded bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 flex items-center gap-1 shadow-xs"
                                    title="Ubah rekening akun COA untuk pos transaksi ini"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                    <span>Ubah Akun</span>
                                  </button>
                                  {(isCustom || isModified) && (
                                    <button
                                      onClick={() => handleDeleteOrResetRugiLaba(item)}
                                      className={`px-2 py-1 text-xs font-medium rounded border ${
                                        isCustom
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
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          TAB 4: MAPPING NERACA (Categorized Balance Sheet Mappings)
          ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'balance_sheet' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="card p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Scale className="w-5 h-5 text-sky-600" />
                  Mapping Neraca (Balance Sheet Classification Mapping)
                </h2>
                <p className="text-xs text-slate-500 mt-1 max-w-4xl leading-relaxed">
                  Pemetaan akun neraca ke dalam 4 klasifikasi standar akuntansi: <strong>Aset Lancar</strong>, <strong>Aset Tetap & Depresiasi</strong>, <strong>Liabilitas Jangka Pendek & Panjang</strong>, dan <strong>Ekuitas Modal Pemilik</strong>. Konfigurasi ini disimpan ke database Supabase dan secara otomatis menjadi acuan Laporan Neraca (<span className="font-mono text-primary-700">/balance-sheet</span>).
                </p>
              </div>
            </div>

            {/* Quick Metrics per Group */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100">
              {NERACA_SECTIONS.map(sec => {
                const count = (groupedNeraca[sec.id] || []).length
                const IconComp = sec.icon
                return (
                  <button
                    key={sec.id}
                    onClick={() => setBsFilter(bsFilter === sec.id ? 'ALL' : sec.id)}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      bsFilter === sec.id
                        ? 'bg-sky-50/80 border-sky-300 ring-2 ring-sky-400/30'
                        : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <div className="flex items-center gap-1.5">
                        <IconComp className="w-3.5 h-3.5 text-sky-700 shrink-0" />
                        <span className="text-[11px] font-bold text-slate-800 truncate">{sec.id}</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold bg-white px-1.5 py-0.2 rounded border border-slate-200 text-slate-700">
                        {count}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 line-clamp-1">{sec.title}</p>
                  </button>
                )
              })}
            </div>

            {/* Filter Group Neraca & Search */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setBsFilter('ALL')}
                  className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-colors ${
                    bsFilter === 'ALL'
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Semua Klasifikasi ({totalFilteredNeraca})
                </button>
                {NERACA_SECTIONS.map(sec => (
                  <button
                    key={sec.id}
                    onClick={() => setBsFilter(sec.id)}
                    className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                      bsFilter === sec.id
                        ? 'bg-sky-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {sec.id}
                  </button>
                ))}
              </div>

              <div className="w-full sm:w-72">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari pos neraca / kode akun..."
                    value={bsSearch}
                    onChange={e => setBsSearch(e.target.value)}
                    className="form-input text-xs pl-8 py-1.5 w-full"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Grouped Neraca Display */}
          {totalFilteredNeraca === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl border border-slate-200 text-slate-400">
              <AlertTriangle className="w-8 h-8 text-sky-500 mx-auto mb-2 opacity-80" />
              <p className="text-sm font-semibold text-slate-700">Tidak ada mapping pos neraca yang cocok</p>
              <p className="text-xs text-slate-400 mt-1">Coba sesuaikan kata kunci pencarian atau ubah filter klasifikasi.</p>
            </div>
          ) : (
            NERACA_SECTIONS.map(sec => {
              const items = groupedNeraca[sec.id] || []
              if (items.length === 0) return null
              const IconComp = sec.icon

              return (
                <div key={sec.id} className="card bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
                  <div className="bg-slate-50/80 px-4 py-3 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-sky-100 flex items-center justify-center shrink-0">
                        <IconComp className="w-4 h-4 text-sky-700" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900">{sec.title}</h3>
                          <span className="text-[10px] font-mono font-bold bg-sky-100 text-sky-800 px-2 py-0.5 rounded-full">
                            {items.length} Pos
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">{sec.description}</p>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto w-full">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100/70 text-slate-700 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-2.5 w-1/3">Pos Akun Neraca</th>
                          <th className="px-4 py-2.5 w-1/3">Rekening Akun Terpetakan di COA</th>
                          <th className="px-4 py-2.5 text-center whitespace-nowrap">Saldo Normal</th>
                          <th className="px-4 py-2.5 text-center whitespace-nowrap">Status Database</th>
                          <th className="px-4 py-2.5 text-right whitespace-nowrap">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {items.map(item => {
                          const mappedAcc = coa.find(a => a.accountCode === item.accountCode)
                          const isModified = item.isModified

                          return (
                            <tr key={item.key} className="hover:bg-slate-50/70 transition-colors">
                              <td className="px-4 py-3 align-top">
                                <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                                  <span>{item.label}</span>
                                  {isModified && (
                                    <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-bold">Disesuaikan</span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                  {item.description || 'Pos klasifikasi ' + item.group}
                                </p>
                                <span className="inline-block mt-1 text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded">
                                  Key: {item.key}
                                </span>
                              </td>

                              <td className="px-4 py-3 align-top">
                                {mappedAcc ? (
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-mono font-bold text-sky-700 text-xs bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                                        {item.accountCode}
                                      </span>
                                      <span className="font-semibold text-slate-800">{mappedAcc.accountName}</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-[10px] text-slate-500">
                                      <span className="badge badge-gray">{mappedAcc.accountType}</span>
                                      <span>•</span>
                                      <span>Grup: {mappedAcc.accountGroup || '—'}</span>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-rose-600 font-semibold flex items-center gap-1">
                                    <AlertTriangle className="w-4 h-4 shrink-0" />
                                    <span>Kode akun {item.accountCode} belum terdaftar di COA</span>
                                  </div>
                                )}
                              </td>

                              <td className="px-4 py-3 align-middle text-center whitespace-nowrap">
                                <span className={`badge text-[10px] font-mono ${item.naturalBalance === 'DEBIT' ? 'badge-blue' : 'badge-green'}`}>
                                  {item.naturalBalance}
                                </span>
                              </td>

                              <td className="px-4 py-3 align-middle text-center whitespace-nowrap">
                                {mappedAcc ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                    Terhubung Aktif
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-full">
                                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                                    Perlu Perbaikan
                                  </span>
                                )}
                              </td>

                              <td className="px-4 py-3 align-middle text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => handleOpenEditNeraca(item)}
                                    className="px-2.5 py-1 text-xs font-semibold rounded bg-sky-50 text-sky-800 hover:bg-sky-100 border border-sky-200 flex items-center gap-1 shadow-xs"
                                    title="Edit mapping pos neraca ini"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                    <span>Ubah Akun</span>
                                  </button>
                                  {isModified && (
                                    <button
                                      onClick={() => handleResetNeraca(item)}
                                      className="px-2 py-1 text-xs font-medium rounded border bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-300"
                                      title="Reset ke akun default sistem"
                                    >
                                      <RotateCcw className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          TAB 5: MAPPING ARUS KAS (PSAK Standard Cash Flow Activities)
          ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'cash_flow' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="card p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <ArrowRightLeft className="w-5 h-5 text-purple-600" />
                  Mapping Arus Kas (Cash Flow Statement Mapping)
                </h2>
                <p className="text-xs text-slate-500 mt-1 max-w-4xl leading-relaxed">
                  Pemetaan akun rekening kas & bank untuk Laporan Arus Kas yang diklasifikasikan ke dalam 3 aktivitas utama standar PSAK: <strong>Aktivitas Operasi</strong>, <strong>Aktivitas Investasi</strong>, dan <strong>Aktivitas Pendanaan</strong>. Perubahan tersimpan ke database Supabase dan langsung menjadi acuan Laporan Arus Kas (<span className="font-mono text-primary-700">/cash-flow</span>).
                </p>
              </div>
            </div>

            {/* Quick Metrics per Activity */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-100">
              {CASH_FLOW_SECTIONS.map(sec => {
                const count = (groupedArusKas[sec.id] || []).length
                const IconComp = sec.icon
                return (
                  <button
                    key={sec.id}
                    onClick={() => setCfFilter(cfFilter === sec.id ? 'ALL' : sec.id)}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      cfFilter === sec.id
                        ? 'bg-purple-50/80 border-purple-300 ring-2 ring-purple-400/30'
                        : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <div className="flex items-center gap-1.5">
                        <IconComp className="w-3.5 h-3.5 text-purple-700 shrink-0" />
                        <span className="text-[11px] font-bold text-slate-800 truncate">{sec.id}</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold bg-white px-1.5 py-0.2 rounded border border-slate-200 text-slate-700">
                        {count}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 line-clamp-1">{sec.title}</p>
                  </button>
                )
              })}
            </div>

            {/* Filter Section Arus Kas & Search */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setCfFilter('ALL')}
                  className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-colors ${
                    cfFilter === 'ALL'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Semua Aktivitas ({totalFilteredArusKas})
                </button>
                {CASH_FLOW_SECTIONS.map(sec => (
                  <button
                    key={sec.id}
                    onClick={() => setCfFilter(sec.id)}
                    className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                      cfFilter === sec.id
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {sec.title.split('(')[0].trim()}
                  </button>
                ))}
              </div>

              <div className="w-full sm:w-72">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari pos arus kas / kode akun..."
                    value={cfSearch}
                    onChange={e => setCfSearch(e.target.value)}
                    className="form-input text-xs pl-8 py-1.5 w-full"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Grouped Cash Flow Display */}
          {totalFilteredArusKas === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl border border-slate-200 text-slate-400">
              <AlertTriangle className="w-8 h-8 text-purple-500 mx-auto mb-2 opacity-80" />
              <p className="text-sm font-semibold text-slate-700">Tidak ada mapping pos arus kas yang cocok</p>
              <p className="text-xs text-slate-400 mt-1">Coba sesuaikan kata kunci pencarian atau ubah filter aktivitas.</p>
            </div>
          ) : (
            CASH_FLOW_SECTIONS.map(sec => {
              const items = groupedArusKas[sec.id] || []
              if (items.length === 0) return null
              const IconComp = sec.icon

              return (
                <div key={sec.id} className="card bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
                  <div className="bg-slate-50/80 px-4 py-3 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
                        <IconComp className="w-4 h-4 text-purple-700" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900">{sec.title}</h3>
                          <span className="text-[10px] font-mono font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                            {items.length} Pos
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">{sec.description}</p>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto w-full">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100/70 text-slate-700 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-2.5 text-center whitespace-nowrap">Arah Aliran</th>
                          <th className="px-4 py-2.5 w-1/3">Pos Arus Kas & Peruntukan</th>
                          <th className="px-4 py-2.5 w-1/3">Rekening Akun Terpetakan di COA</th>
                          <th className="px-4 py-2.5 text-center whitespace-nowrap">Status Database</th>
                          <th className="px-4 py-2.5 text-right whitespace-nowrap">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {items.map(item => {
                          const mappedAcc = coa.find(a => a.accountCode === item.accountCode)
                          const isModified = item.isModified

                          return (
                            <tr key={item.key} className="hover:bg-slate-50/70 transition-colors">
                              <td className="px-4 py-3 align-middle text-center whitespace-nowrap">
                                <span className={`inline-block px-2.5 py-1 rounded text-[10px] font-bold font-mono ${
                                  item.flowType === 'INFLOW'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                                }`}>
                                  {item.flowType === 'INFLOW' ? '↓ KAS MASUK' : '↑ KAS KELUAR'}
                                </span>
                              </td>

                              <td className="px-4 py-3 align-top">
                                <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                                  <span>{item.label}</span>
                                  {isModified && (
                                    <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-bold">Disesuaikan</span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                  {item.description || 'Aliran arus kas ' + sec.title}
                                </p>
                                <span className="inline-block mt-1 text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded">
                                  Key: {item.key}
                                </span>
                              </td>

                              <td className="px-4 py-3 align-top">
                                {mappedAcc ? (
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-mono font-bold text-purple-700 text-xs bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                                        {item.accountCode}
                                      </span>
                                      <span className="font-semibold text-slate-800">{mappedAcc.accountName}</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-[10px] text-slate-500">
                                      <span className="badge badge-gray">{mappedAcc.accountType}</span>
                                      <span>•</span>
                                      <span>Grup: {mappedAcc.accountGroup || '—'}</span>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-rose-600 font-semibold flex items-center gap-1">
                                    <AlertTriangle className="w-4 h-4 shrink-0" />
                                    <span>Kode akun {item.accountCode} belum terdaftar di COA</span>
                                  </div>
                                )}
                              </td>

                              <td className="px-4 py-3 align-middle text-center whitespace-nowrap">
                                {mappedAcc ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                    Terhubung Aktif
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-full">
                                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                                    Perlu Perbaikan
                                  </span>
                                )}
                              </td>

                              <td className="px-4 py-3 align-middle text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => handleOpenEditArusKas(item)}
                                    className="px-2.5 py-1 text-xs font-semibold rounded bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200 flex items-center gap-1 shadow-xs"
                                    title="Edit mapping pos arus kas ini"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                    <span>Ubah Akun</span>
                                  </button>
                                  {isModified && (
                                    <button
                                      onClick={() => handleResetArusKas(item)}
                                      className="px-2 py-1 text-xs font-medium rounded border bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-300"
                                      title="Reset ke akun default sistem"
                                    >
                                      <RotateCcw className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          MODALS SECTION (COA, Jurnal Otomatis, Rugi Laba, Neraca, Arus Kas)
          ══════════════════════════════════════════════════════════════ */}

      {/* 1. Modal Tambah / Edit Akun COA */}
      <Modal open={modal === 'add' || modal === 'edit'} onClose={() => setModal(null)} title={modal === 'add' ? 'Tambah Akun COA Baru' : 'Edit Akun COA'} size="lg">
        <AccountForm
          initial={selected || {}}
          headerAccounts={coa.filter(a => a.isHeader)}
          onSave={handleSaveAccount}
          onClose={() => setModal(null)}
        />
      </Modal>

      {/* 2. Modal Import COA */}
      <Modal open={modal === 'import'} onClose={() => setModal(null)} title="Import COA dari Excel / CSV" size="lg">
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800 font-medium mb-1">📊 Data siap diimport:</p>
            <p className="text-2xl font-bold text-blue-900">{importData.length} akun</p>
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
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-secondary" onClick={() => setModal(null)} disabled={importing}>Batal</button>
            <button className="btn-royal-blue" onClick={() => executeImport(false)} disabled={importing}>Tambah Baru</button>
            <button className="btn-danger-red" onClick={() => executeImport(true)} disabled={importing}>Replace All (Hapus & Ganti)</button>
          </div>
        </div>
      </Modal>

      {/* 3. Modal Edit Jurnal Otomatis */}
      {modal === 'edit_auto_journal' && (
        <Modal
          open={true}
          onClose={() => setModal(null)}
          title={`Revisi Struktur Jurnal Otomatis: ${ajForm.name}`}
          size="lg"
        >
          <form onSubmit={handleSaveAutoJournal} className="space-y-4">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Modul: {ajForm.moduleLabel}</span>
                <span className="text-xs font-mono bg-slate-200 text-slate-800 px-2 py-0.5 rounded font-bold">{ajForm.id}</span>
              </div>
              <div>
                <label className="form-label text-xs font-semibold">Nama Alur Jurnal *</label>
                <input
                  type="text"
                  className="form-input text-xs"
                  value={ajForm.name}
                  onChange={e => setAjForm(f => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="form-label text-xs font-semibold">Pemicu Sistem (Trigger Event)</label>
                <input
                  type="text"
                  className="form-input text-xs"
                  value={ajForm.trigger}
                  onChange={e => setAjForm(f => ({ ...f, trigger: e.target.value }))}
                />
              </div>
              <div>
                <label className="form-label text-xs font-semibold">Deskripsi Akuntansi</label>
                <textarea
                  className="form-textarea text-xs"
                  rows={2}
                  value={ajForm.description}
                  onChange={e => setAjForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>
            </div>

            {/* Konfigurasi Akun Posisi DEBET */}
            <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-200 space-y-2">
              <div className="flex items-center justify-between pb-1 border-b border-blue-200">
                <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                  PENGATURAN AKUN DEBET (DR)
                </span>
                <button
                  type="button"
                  onClick={() => setAjForm(f => ({
                    ...f,
                    debits: [...f.debits, { code: '', name: 'Akun Baru', note: 'Keterangan pos debet' }]
                  }))}
                  className="text-[11px] font-semibold text-blue-700 hover:text-blue-900 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Tambah Baris Debet
                </button>
              </div>

              {ajForm.debits.map((d, idx) => (
                <div key={idx} className="p-2.5 bg-white rounded border border-blue-100 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-800">Baris Debet #{idx + 1}</span>
                    {ajForm.debits.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setAjForm(f => ({ ...f, debits: f.debits.filter((_, i) => i !== idx) }))}
                        className="text-red-500 hover:text-red-700 text-xs"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-500 font-semibold">Pilih Akun Rekening COA</label>
                      <SearchableSelect
                        options={candidateAccounts}
                        value={d.code}
                        onChange={val => {
                          const acc = coa.find(a => a.accountCode === val)
                          setAjForm(f => ({
                            ...f,
                            debits: f.debits.map((item, i) => i === idx ? { ...item, code: val, name: acc?.accountName || item.name } : item)
                          }))
                        }}
                        placeholder="Pilih rekening COA..."
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-semibold">Catatan / Peruntukan Alur</label>
                      <input
                        type="text"
                        className="form-input text-xs py-1"
                        value={d.note}
                        onChange={e => {
                          const v = e.target.value
                          setAjForm(f => ({
                            ...f,
                            debits: f.debits.map((item, i) => i === idx ? { ...item, note: v } : item)
                          }))
                        }}
                        placeholder="mis. Grand Total / Potongan Diskon"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Konfigurasi Akun Posisi KREDIT */}
            <div className="p-3 bg-purple-50/50 rounded-lg border border-purple-200 space-y-2">
              <div className="flex items-center justify-between pb-1 border-b border-purple-200">
                <span className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-600"></span>
                  PENGATURAN AKUN KREDIT (CR)
                </span>
                <button
                  type="button"
                  onClick={() => setAjForm(f => ({
                    ...f,
                    credits: [...f.credits, { code: '', name: 'Akun Baru', note: 'Keterangan pos kredit' }]
                  }))}
                  className="text-[11px] font-semibold text-purple-700 hover:text-purple-900 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Tambah Baris Kredit
                </button>
              </div>

              {ajForm.credits.map((c, idx) => (
                <div key={idx} className="p-2.5 bg-white rounded border border-purple-100 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-800">Baris Kredit #{idx + 1}</span>
                    {ajForm.credits.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setAjForm(f => ({ ...f, credits: f.credits.filter((_, i) => i !== idx) }))}
                        className="text-red-500 hover:text-red-700 text-xs"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-500 font-semibold">Pilih Akun Rekening COA</label>
                      <SearchableSelect
                        options={candidateAccounts}
                        value={c.code}
                        onChange={val => {
                          const acc = coa.find(a => a.accountCode === val)
                          setAjForm(f => ({
                            ...f,
                            credits: f.credits.map((item, i) => i === idx ? { ...item, code: val, name: acc?.accountName || item.name } : item)
                          }))
                        }}
                        placeholder="Pilih rekening COA..."
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-semibold">Catatan / Peruntukan Alur</label>
                      <input
                        type="text"
                        className="form-input text-xs py-1"
                        value={c.note}
                        onChange={e => {
                          const v = e.target.value
                          setAjForm(f => ({
                            ...f,
                            credits: f.credits.map((item, i) => i === idx ? { ...item, note: v } : item)
                          }))
                        }}
                        placeholder="mis. DPP Penjualan Obat / Pendapatan Tindakan"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={() => setModal(null)}
                disabled={isSaving}
              >
                Batal
              </button>
              <button
                type="submit"
                className="btn-primary text-xs flex items-center gap-1.5"
                disabled={isSaving}
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Menyimpan ke Database...' : 'Simpan Struktur Jurnal ke Database'}</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 4. Modal Tambah / Edit Mapping Rugi Laba */}
      {(modal === 'add_rugi_laba' || modal === 'edit_rugi_laba') && (
        <Modal
          open={true}
          onClose={() => setModal(null)}
          title={modal === 'add_rugi_laba' ? 'Tambah Pos Mapping Rugi Laba' : `Edit Mapping Rugi Laba: ${mappingForm.label}`}
          size="md"
        >
          <form onSubmit={handleSaveRugiLaba} className="space-y-4">
            <div>
              <label className="form-label text-xs font-semibold">Nama Pos Transaksi *</label>
              <input
                type="text"
                className="form-input text-xs"
                value={mappingForm.label}
                onChange={e => setMappingForm(f => ({ ...f, label: e.target.value }))}
                placeholder="mis. Pendapatan Tindakan Fisioterapi / Beban Uji Lab Khusus"
                required
              />
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
                Pilih akun COA yang akan didebet/dikredit saat transaksi rugi laba ini berlangsung.
              </p>
              {(() => {
                const selectedAcc = coa.find(a => a.accountCode === mappingForm.accountCode)
                if (!selectedAcc) return null
                return (
                  <div className="mt-2.5 p-2.5 bg-emerald-50/80 border border-emerald-200 rounded-lg flex items-start gap-2.5 animate-fadeIn">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="text-xs space-y-0.5">
                      <div className="font-bold text-emerald-950 font-mono">
                        {selectedAcc.accountCode} — <span className="font-sans font-semibold">{selectedAcc.accountName}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-emerald-800">
                        <span className="font-semibold">{accountTypeLabel(selectedAcc.accountType)}</span>
                        <span>•</span>
                        <span>Grup: {selectedAcc.accountGroup || '—'}</span>
                        <span>•</span>
                        <span className="font-mono bg-white/90 px-1 py-0.2 rounded border border-emerald-300">Saldo: {selectedAcc.naturalBalance}</span>
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>

            <div>
              <label className="form-label text-xs font-semibold">Deskripsi / Peruntukan Laba Rugi</label>
              <textarea
                className="form-textarea text-xs"
                rows={2}
                value={mappingForm.description}
                onChange={e => setMappingForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Catatan peruntukan pos ini dalam Laporan Laba Rugi..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={() => setModal(null)}
                disabled={isSaving}
              >
                Batal
              </button>
              <button
                type="submit"
                className="btn-primary text-xs flex items-center gap-1.5"
                disabled={isSaving || !mappingForm.label || !mappingForm.accountCode}
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Menyimpan...' : 'Simpan Mapping Rugi Laba'}</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 5. Modal Edit Mapping Neraca */}
      {modal === 'edit_neraca' && (
        <Modal
          open={true}
          onClose={() => setModal(null)}
          title={`Edit Mapping Neraca: ${bsForm.label}`}
          size="md"
        >
          <form onSubmit={handleSaveNeraca} className="space-y-4">
            <div>
              <label className="form-label text-xs font-semibold">Nama Pos Neraca *</label>
              <input
                type="text"
                className="form-input text-xs"
                value={bsForm.label}
                onChange={e => setBsForm(f => ({ ...f, label: e.target.value }))}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label text-xs font-semibold">Klasifikasi Neraca *</label>
                <select
                  className="form-select text-xs"
                  value={bsForm.group}
                  onChange={e => setBsForm(f => ({ ...f, group: e.target.value }))}
                  required
                >
                  <option value="ASET LANCAR">ASET LANCAR</option>
                  <option value="ASET TIDAK LANCAR">ASET TIDAK LANCAR</option>
                  <option value="LIABILITAS JANGKA PENDEK">LIABILITAS JANGKA PENDEK</option>
                  <option value="LIABILITAS JANGKA PANJANG">LIABILITAS JANGKA PANJANG</option>
                  <option value="EKUITAS">EKUITAS</option>
                </select>
              </div>

              <div>
                <label className="form-label text-xs font-semibold">Saldo Normal</label>
                <select
                  className="form-select text-xs"
                  value={bsForm.naturalBalance}
                  onChange={e => setBsForm(f => ({ ...f, naturalBalance: e.target.value }))}
                >
                  <option value="DEBIT">DEBIT</option>
                  <option value="CREDIT">KREDIT</option>
                </select>
              </div>
            </div>

            <div>
              <label className="form-label text-xs font-semibold">Pilih Rekening Akun COA Terpetakan *</label>
              <SearchableSelect
                options={candidateAccounts}
                value={bsForm.accountCode}
                onChange={val => setBsForm(f => ({ ...f, accountCode: val }))}
                placeholder="Cari kode atau nama akun COA..."
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Pilih akun COA yang mencerminkan saldo pos neraca ini.
              </p>
              {(() => {
                const selectedAcc = coa.find(a => a.accountCode === bsForm.accountCode)
                if (!selectedAcc) return null
                return (
                  <div className="mt-2.5 p-2.5 bg-sky-50/80 border border-sky-200 rounded-lg flex items-start gap-2.5 animate-fadeIn">
                    <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                    <div className="text-xs space-y-0.5">
                      <div className="font-bold text-sky-950 font-mono">
                        {selectedAcc.accountCode} — <span className="font-sans font-semibold">{selectedAcc.accountName}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-sky-800">
                        <span className="font-semibold">{accountTypeLabel(selectedAcc.accountType)}</span>
                        <span>•</span>
                        <span>Grup: {selectedAcc.accountGroup || '—'}</span>
                        <span>•</span>
                        <span className="font-mono bg-white/90 px-1 py-0.2 rounded border border-sky-300">Saldo: {selectedAcc.naturalBalance}</span>
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>

            <div>
              <label className="form-label text-xs font-semibold">Deskripsi / Peruntukan Pos Neraca</label>
              <textarea
                className="form-textarea text-xs"
                rows={2}
                value={bsForm.description}
                onChange={e => setBsForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Catatan klasifikasi pos ini dalam laporan neraca..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={() => setModal(null)}
                disabled={isSaving}
              >
                Batal
              </button>
              <button
                type="submit"
                className="btn-primary text-xs flex items-center gap-1.5"
                disabled={isSaving || !bsForm.label || !bsForm.accountCode}
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Menyimpan...' : 'Simpan Mapping Neraca'}</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 6. Modal Edit Mapping Arus Kas */}
      {modal === 'edit_arus_kas' && (
        <Modal
          open={true}
          onClose={() => setModal(null)}
          title={`Edit Mapping Arus Kas: ${cfForm.label}`}
          size="md"
        >
          <form onSubmit={handleSaveArusKas} className="space-y-4">
            <div>
              <label className="form-label text-xs font-semibold">Nama Pos Arus Kas *</label>
              <input
                type="text"
                className="form-input text-xs"
                value={cfForm.label}
                onChange={e => setCfForm(f => ({ ...f, label: e.target.value }))}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label text-xs font-semibold">Aktivitas Arus Kas *</label>
                <select
                  className="form-select text-xs"
                  value={cfForm.section}
                  onChange={e => setCfForm(f => ({ ...f, section: e.target.value }))}
                  required
                >
                  <option value="OPERASI">Aktivitas Operasi</option>
                  <option value="INVESTASI">Aktivitas Investasi</option>
                  <option value="PENDANAAN">Aktivitas Pendanaan</option>
                </select>
              </div>

              <div>
                <label className="form-label text-xs font-semibold">Arah Aliran Kas *</label>
                <select
                  className="form-select text-xs"
                  value={cfForm.flowType}
                  onChange={e => setCfForm(f => ({ ...f, flowType: e.target.value }))}
                  required
                >
                  <option value="INFLOW">Kas Masuk (Inflow)</option>
                  <option value="OUTFLOW">Kas Keluar (Outflow)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="form-label text-xs font-semibold">Pilih Rekening Akun COA Terpetakan *</label>
              <SearchableSelect
                options={candidateAccounts}
                value={cfForm.accountCode}
                onChange={val => setCfForm(f => ({ ...f, accountCode: val }))}
                placeholder="Cari kode atau nama akun COA..."
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Pilih akun COA yang memicu atau mencatat aliran kas ini.
              </p>
              {(() => {
                const selectedAcc = coa.find(a => a.accountCode === cfForm.accountCode)
                if (!selectedAcc) return null
                return (
                  <div className="mt-2.5 p-2.5 bg-purple-50/80 border border-purple-200 rounded-lg flex items-start gap-2.5 animate-fadeIn">
                    <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                    <div className="text-xs space-y-0.5">
                      <div className="font-bold text-purple-950 font-mono">
                        {selectedAcc.accountCode} — <span className="font-sans font-semibold">{selectedAcc.accountName}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-purple-800">
                        <span className="font-semibold">{accountTypeLabel(selectedAcc.accountType)}</span>
                        <span>•</span>
                        <span>Grup: {selectedAcc.accountGroup || '—'}</span>
                        <span>•</span>
                        <span className="font-mono bg-white/90 px-1 py-0.2 rounded border border-purple-300">Saldo: {selectedAcc.naturalBalance}</span>
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>

            <div>
              <label className="form-label text-xs font-semibold">Deskripsi / Peruntukan Arus Kas</label>
              <textarea
                className="form-textarea text-xs"
                rows={2}
                value={cfForm.description}
                onChange={e => setCfForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Catatan klasifikasi aliran kas ini..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={() => setModal(null)}
                disabled={isSaving}
              >
                Batal
              </button>
              <button
                type="submit"
                className="btn-primary text-xs flex items-center gap-1.5"
                disabled={isSaving || !cfForm.label || !cfForm.accountCode}
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Menyimpan...' : 'Simpan Mapping Arus Kas'}</span>
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
