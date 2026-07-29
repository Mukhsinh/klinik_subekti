import { useState, useMemo, useRef, useEffect } from 'react'
import { Plus, Pencil, Package, AlertTriangle, Download, Upload, FileDown, RefreshCw } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import Modal from '../../components/ui/Modal'
import SearchInput from '../../components/ui/SearchInput'
import Alert from '../../components/ui/Alert'
import toast from 'react-hot-toast'
import { v4 as uuidv4 } from 'uuid'
import * as XLSX from 'xlsx'

const CATEGORIES = ['BRANDED', 'GENERIK', 'BHP']
const CAT_LABELS = {
  BRANDED: 'BRANDED',
  GENERIK: 'GENERIK',
  'PEMAKAIAN BHP': 'BHP',
  BHP: 'BHP',
  OBAT_PATEN: 'BRANDED',
  OBAT_GENERIK: 'GENERIK',
  RUMAH_TANGGA: 'Rumah Tangga'
}
const CAT_COLORS = {
  BRANDED: 'badge-blue',
  GENERIK: 'badge-green',
  'PEMAKAIAN BHP': 'badge-purple',
  BHP: 'badge-purple',
  OBAT_PATEN: 'badge-blue',
  OBAT_GENERIK: 'badge-green',
  RUMAH_TANGGA: 'badge-yellow'
}
const CAT_INV_COA = {
  BRANDED: '1-13-001',
  GENERIK: '1-13-002',
  'PEMAKAIAN BHP': '1-13-003',
  BHP: '1-13-003',
  OBAT_PATEN: '1-13-001',
  OBAT_GENERIK: '1-13-002',
  RUMAH_TANGGA: '1-13-004'
}
const CAT_HPP_COA = {
  BRANDED: '5-11-001',
  GENERIK: '5-11-002',
  'PEMAKAIAN BHP': '5-11-003',
  BHP: '5-11-003',
  OBAT_PATEN: '5-11-001',
  OBAT_GENERIK: '5-11-002',
  RUMAH_TANGGA: '5-11-004'
}
// Prefix for auto-generated codes
const CAT_PREFIX = {
  BRANDED: 'PAT',
  GENERIK: 'GEN',
  'PEMAKAIAN BHP': 'BHP',
  BHP: 'BHP',
  OBAT_PATEN: 'PAT',
  OBAT_GENERIK: 'GEN',
  RUMAH_TANGGA: 'RT'
}

const BENTUK_OPTIONS = [
  'TABLET', 'KAPLET', 'KAPSUL', 'SUSPENSI', 'SYIRUP', 'DRY SYIRUP',
  'INJEKSI', 'TETES MATA', 'SALEP MATA', 'ALKES', 'GEL', 'CAIRAN', 'INFUS',
  'TABLET KUNYAH', 'Pcs'
]

const GOLONGAN_OPTIONS = ['UMUM', 'NARKOTIKA PSIKOTROPIKA']

// ─── Item Form ───────────────────────────────────────────────
function ItemForm({ initial = {}, onSave, onClose, coa, nextCodeByCategory }) {
  const invCOA = coa.filter(a => a.accountGroup === 'ASET LANCAR' && a.accountSubgroup === 'Persediaan' && !a.isHeader && a.accountCode !== '1-13-005')
  const hppCOA = coa.filter(a => a.accountGroup === 'HARGA POKOK' && !a.isHeader)
  const isEdit = !!(initial && initial.id)

  const [form, setForm] = useState({
    itemCode: initial.itemCode || (nextCodeByCategory ? nextCodeByCategory('BRANDED') : ''),
    itemName: initial.itemName || '',
    bentuk: initial.bentuk || 'TABLET',
    golongan: initial.golongan || 'UMUM',
    kelasTerapi: initial.kelasTerapi || '',
    kandungan: initial.kandungan || '',
    category: initial.category || 'BRANDED',
    minSafetyStock: initial.minSafetyStock ?? 50,
    reorderPoint: initial.reorderPoint ?? 100,
    coaInventoryCode: initial.coaInventoryCode || '1-13-001',
    coaCOGSCode: initial.coaCOGSCode || '5-11-001',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleCategoryChange = (cat) => {
    set('category', cat)
    set('coaInventoryCode', CAT_INV_COA[cat] || '1-13-002')
    set('coaCOGSCode', CAT_HPP_COA[cat] || '5-11-002')
    if (!isEdit && nextCodeByCategory) set('itemCode', nextCodeByCategory(cat))
  }

  const submit = (e) => {
    e.preventDefault()
    if (!form.itemName.trim()) { toast.error('Nama sediaan farmasi wajib diisi.'); return }
    onSave(form)
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* Kategori & Kode */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="form-label">Kategori Barang *</label>
          <select className="form-select" value={form.category} onChange={e => handleCategoryChange(e.target.value)}>
            {CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABELS[c]} ({CAT_PREFIX[c]}-)</option>)}
          </select>
        </div>

        <div className="p-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-100">Kode Master Inventory</p>
            <p className="text-xl font-black font-mono">{form.itemCode || '—'}</p>
          </div>
          <span className="text-xs bg-white/20 px-2 py-1 rounded-lg font-mono">
            Prefix: {CAT_PREFIX[form.category]}-
          </span>
        </div>
      </div>

      {/* Nama Sediaan Farmasi */}
      <div>
        <label className="form-label">Nama Sediaan Farmasi *</label>
        <input className="form-input" value={form.itemName}
          onChange={e => set('itemName', e.target.value)}
          placeholder="Contoh: SANMOL 500 MG TAB, ANALSIK KAP…" required />
      </div>

      {/* Bentuk & Golongan */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="form-label">Bentuk Sediaan *</label>
          <select className="form-select" value={form.bentuk} onChange={e => set('bentuk', e.target.value)}>
            {BENTUK_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">Golongan *</label>
          <select className="form-select" value={form.golongan} onChange={e => set('golongan', e.target.value)}>
            {GOLONGAN_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
      </div>

      {/* Kelas Terapi & Kandungan */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="form-label">Kelas Terapi</label>
          <input className="form-input" value={form.kelasTerapi}
            onChange={e => set('kelasTerapi', e.target.value)}
            placeholder="Contoh: ANALGESIK, ANTI ALERGI, SUPLEMEN…" />
        </div>
        <div>
          <label className="form-label">Kandungan / Zat Aktif</label>
          <input className="form-input" value={form.kandungan}
            onChange={e => set('kandungan', e.target.value)}
            placeholder="Contoh: PARASETAMOL 500 MG, METAMIZOLE…" />
        </div>
      </div>

      {/* COA */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="form-label">Akun Persediaan (COA)</label>
          <select className="form-select" value={form.coaInventoryCode}
            onChange={e => set('coaInventoryCode', e.target.value)}>
            {invCOA.map(a => <option key={a.accountCode} value={a.accountCode}>{a.accountCode} — {a.accountName}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">Akun HPP / COGS (COA)</label>
          <select className="form-select" value={form.coaCOGSCode}
            onChange={e => set('coaCOGSCode', e.target.value)}>
            {hppCOA.map(a => <option key={a.accountCode} value={a.accountCode}>{a.accountCode} — {a.accountName}</option>)}
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn-secondary" onClick={onClose}>Batal</button>
        <button type="submit" className="btn-primary">Simpan Master Inventory</button>
      </div>
    </form>
  )
}

// ─── Main Page ───────────────────────────────────────────────
export default function InventoryPage() {
  const [coa, setCoa] = useState([])
  const [pharmacyItems, setPharmacyItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('ALL')
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [importModal, setImportModal] = useState(false)
  const [importRows, setImportRows] = useState([])
  const [importErrs, setImportErrs] = useState([])
  const fileRef = useRef(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      // Fetch COA
      const { data: coaData, error: coaError } = await supabase
        .from('chart_of_accounts')
        .select('*')
        .order('sort_order')

      if (coaError) throw coaError

      // Fetch pharmacy items
      const { data: itemsData, error: itemsError } = await supabase
        .from('pharmacy_items')
        .select('*')
        .order('item_code')

      if (itemsError) throw itemsError

      // Normalize COA
      const normalizedCoa = (coaData || []).map(account => ({
        accountCode: account.account_code,
        accountName: account.account_name,
        accountType: account.account_type,
        accountGroup: account.account_group,
        accountSubgroup: account.account_subgroup,
        naturalBalance: account.natural_balance,
        isHeader: account.is_header,
        parentCode: account.parent_code,
        description: account.description,
        isActive: account.is_active,
        sortOrder: account.sort_order
      }))

      // Normalize pharmacy items according to Master Inventory template structure
      const normalizedItems = (itemsData || []).map(item => ({
        id: item.id,
        itemCode: item.item_code || item.sku_code || '',
        skuCode: item.sku_code || item.item_code || '',
        itemName: item.item_name || '',
        bentuk: item.bentuk || item.base_unit || 'Pcs',
        golongan: item.golongan || 'UMUM',
        kelasTerapi: item.kelas_terapi || '—',
        kandungan: item.kandungan || '—',
        category: item.category || 'GENERIK',
        baseUnit: item.base_unit || item.bentuk || 'Pcs',
        minSafetyStock: item.min_safety_stock ?? 50,
        reorderPoint: item.reorder_point ?? 100,
        coaInventoryCode: item.coa_inventory_code || '1-13-001',
        coaCOGSCode: item.coa_cogs_code || '5-11-001',
        sellingPrice: item.selling_price || 0,
        isActive: item.is_active !== false
      }))

      setCoa(normalizedCoa)
      setPharmacyItems(normalizedItems)
    } catch (error) {
      console.error('[InventoryPage] Error loading data:', error)
      toast.error(`Gagal memuat data: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  // ── Derived ──────────────────────────────────────────────
  const nextCodeByCategory = useMemo(() => (cat) => {
    const prefix = CAT_PREFIX[cat] || 'GEN'
    const existing = pharmacyItems
      .filter(p => p.category === cat)
      .map(p => {
        const m = (p.itemCode || '').match(/-0*(\d+)$/)
        return m ? parseInt(m[1]) : 0
      })
    const max = existing.length > 0 ? Math.max(...existing) : 0
    return `${prefix}-${String(max + 1).padStart(4, '0')}`
  }, [pharmacyItems])

  const filtered = useMemo(() =>
    pharmacyItems
      .filter(i => catFilter === 'ALL' || i.category === catFilter)
      .filter(i => !search ||
        i.itemName.toLowerCase().includes(search.toLowerCase()) ||
        (i.itemCode || '').toLowerCase().includes(search.toLowerCase()) ||
        (i.bentuk || '').toLowerCase().includes(search.toLowerCase()) ||
        (i.golongan || '').toLowerCase().includes(search.toLowerCase()) ||
        (i.kelasTerapi || '').toLowerCase().includes(search.toLowerCase()) ||
        (i.kandungan || '').toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => (a.itemCode || '').localeCompare(b.itemCode || '')),
    [pharmacyItems, catFilter, search])

  // ── Save handler ────────────────────────────────────────
  const handleSave = async (data) => {
    if (modal === 'add') {
      let itemCode = data.itemCode
      while (pharmacyItems.find(p => p.itemCode === itemCode)) {
        const prefix = CAT_PREFIX[data.category] || 'GEN'
        const existing = pharmacyItems
          .filter(p => p.category === data.category)
          .map(p => { const m = (p.itemCode || '').match(/-0*(\d+)$/); return m ? parseInt(m[1]) : 0 })
        const max = existing.length > 0 ? Math.max(...existing) : 0
        itemCode = `${prefix}-${String(max + 1).padStart(4, '0')}`
      }

      try {
        const newItem = {
          id: uuidv4(),
          item_code: itemCode,
          sku_code: itemCode,
          item_name: data.itemName,
          bentuk: data.bentuk,
          golongan: data.golongan,
          kelas_terapi: data.kelasTerapi,
          kandungan: data.kandungan,
          category: data.category,
          base_unit: data.bentuk || 'Pcs',
          min_safety_stock: data.minSafetyStock || 50,
          reorder_point: data.reorderPoint || 100,
          coa_inventory_code: data.coaInventoryCode,
          coa_cogs_code: data.coaCOGSCode,
          selling_price: 0,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }

        const { error } = await supabase
          .from('pharmacy_items')
          .insert(newItem)

        if (error) throw error

        toast.success(`Master inventory ${data.itemName} (${itemCode}) berhasil ditambahkan.`)
        await loadData()
      } catch (error) {
        toast.error(`Gagal menambahkan item: ${error.message}`)
        console.error('[handleSave] Error:', error)
      }
    } else {
      try {
        const { error } = await supabase
          .from('pharmacy_items')
          .update({
            item_name: data.itemName,
            bentuk: data.bentuk,
            golongan: data.golongan,
            kelas_terapi: data.kelasTerapi,
            kandungan: data.kandungan,
            category: data.category,
            base_unit: data.bentuk || 'Pcs',
            coa_inventory_code: data.coaInventoryCode,
            coa_cogs_code: data.coaCOGSCode,
            updated_at: new Date().toISOString()
          })
          .eq('id', selected.id)

        if (error) throw error

        toast.success('Master inventory berhasil diperbarui.')
        await loadData()
      } catch (error) {
        toast.error(`Gagal memperbarui item: ${error.message}`)
        console.error('[handleSave] Error:', error)
      }
    }
    setModal(null)
  }

  // ── Download template ────────────────────────────────────
  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { 'KODE': 'PAT-0001', 'NAMA SEDIAAN FARMASI': 'SANMOL 500 MG TAB', 'BENTUK': 'TABLET', 'GOLONGAN': 'UMUM', 'KELAS TERAPI': 'ANALGESIK', 'KANDUNGAN': 'PARASETAMOL 500 MG', 'KATEGORI': 'BRANDED' },
      { 'KODE': 'GEN-0001', 'NAMA SEDIAAN FARMASI': 'LORATADIN 10 MG TAB', 'BENTUK': 'TABLET', 'GOLONGAN': 'UMUM', 'KELAS TERAPI': 'ANTI ALERGI', 'KANDUNGAN': 'LORATADIN 10 MG', 'KATEGORI': 'GENERIK' },
      { 'KODE': 'BHP-0001', 'NAMA SEDIAAN FARMASI': 'MASKER BEDAH EARLOP ONEMED', 'BENTUK': 'ALKES', 'GOLONGAN': 'UMUM', 'KELAS TERAPI': 'ALKES', 'KANDUNGAN': '', 'KATEGORI': 'PEMAKAIAN BHP' },
    ])
    ws['!cols'] = [14, 38, 16, 24, 20, 36, 18].map(w => ({ wch: w }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Master Inventory')
    XLSX.writeFile(wb, 'Master_Inventory_Template.xlsx')
    toast.success('Template Master Inventory berhasil diunduh.')
  }

  // ── Parse import file ────────────────────────────────────
  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'binary' })
        const sheet = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
        const errs = []

        const counters = {
          BRANDED: 0,
          GENERIK: 0,
          'PEMAKAIAN BHP': 0
        }

        pharmacyItems.forEach(p => {
          const cat = p.category
          const m = (p.itemCode || '').match(/-0*(\d+)$/)
          if (m && counters[cat] !== undefined) {
            const num = parseInt(m[1])
            if (num > counters[cat]) counters[cat] = num
          }
        })

        const parsed = rows.map((row, i) => {
          const nama = String(row['NAMA SEDIAAN FARMASI'] || row['NAMA ITEM'] || row['Nama Item'] || '').trim()
          const bentuk = String(row['BENTUK'] || row['Satuan'] || 'TABLET').trim()
          const golongan = String(row['GOLONGAN'] || 'UMUM').trim()
          const kelasTerapi = String(row['KELAS TERAPI'] || '').trim()
          const kandungan = String(row['KANDUNGAN'] || '').trim()

          let catRaw = String(row['KATEGORI'] || row['Kategori'] || '').toUpperCase().trim()
          let category = 'GENERIK'
          if (catRaw === 'BRANDED' || catRaw === 'PATEN' || catRaw === 'OBAT_PATEN') category = 'BRANDED'
          else if (catRaw === 'BHP' || catRaw === 'PEMAKAIAN BHP' || catRaw === 'PEMAKAIAN_BHP') category = 'PEMAKAIAN BHP'
          else category = 'GENERIK'

          let code = String(row['KODE'] || row['Kode Barang'] || '').trim().toUpperCase()
          if (!code) {
            counters[category] = (counters[category] || 0) + 1;
            const prefix = CAT_PREFIX[category] || 'GEN';
            code = `${prefix}-${String(counters[category]).padStart(4, '0')}`;
          }

          if (!nama) errs.push(`Baris ${i + 2}: NAMA SEDIAAN FARMASI kosong.`)

          return {
            itemCode: code,
            skuCode: code,
            itemName: nama,
            bentuk,
            golongan,
            kelasTerapi,
            kandungan,
            category,
            baseUnit: bentuk,
            minSafetyStock: 50,
            reorderPoint: 100,
            coaInventoryCode: CAT_INV_COA[category] || '1-13-002',
            coaCOGSCode: CAT_HPP_COA[category] || '5-11-002'
          }
        }).filter(r => r.itemName)

        setImportRows(parsed)
        setImportErrs(errs)
        setImportModal(true)
      } catch (_) {
        toast.error('Gagal membaca file. Pastikan format sesuai Master inventory.csv.')
      }
    }
    reader.readAsBinaryString(file)
    e.target.value = ''
  }

  // ── Execute import ───────────────────────────────────────
  const executeImport = async () => {
    if (importErrs.length > 0) { toast.error('Perbaiki error terlebih dahulu.'); return }
    let added = 0, skipped = 0

    try {
      for (const item of importRows) {
        if (pharmacyItems.find(p => p.itemCode === item.itemCode)) {
          skipped++
          continue
        }

        const newItem = {
          id: uuidv4(),
          item_code: item.itemCode,
          sku_code: item.skuCode,
          item_name: item.itemName,
          bentuk: item.bentuk,
          golongan: item.golongan,
          kelas_terapi: item.kelasTerapi,
          kandungan: item.kandungan,
          category: item.category,
          base_unit: item.bentuk || 'Pcs',
          min_safety_stock: item.minSafetyStock,
          reorder_point: item.reorderPoint,
          coa_inventory_code: item.coaInventoryCode,
          coa_cogs_code: item.coaCOGSCode,
          selling_price: 0,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }

        const { error } = await supabase
          .from('pharmacy_items')
          .insert(newItem)

        if (error) {
          console.error('[executeImport] Error inserting item:', error)
          continue
        }

        added++
      }

      toast.success(`Import selesai: ${added} master inventory ditambahkan, ${skipped} dilewati.`)
      await loadData()
    } catch (error) {
      toast.error(`Gagal import: ${error.message}`)
      console.error('[executeImport] Error:', error)
    }

    setImportModal(false)
    setImportRows([])
  }

  // ── Render ───────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-primary-600 mb-3" />
          <p className="text-slate-500">Memuat data Master Inventory...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Master Inventory Farmasi &amp; Medis</h1>
          <p className="text-sm text-slate-400 mt-0.5">Daftar master obat, BHP, dan alat medis terintegrasi sistem</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-orange" onClick={downloadTemplate}><FileDown className="w-4 h-4" />Unduh Template Master</button>
          <button className="btn-emerald" onClick={() => fileRef.current?.click()}><Upload className="w-4 h-4" />Impor Master CSV/Excel</button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} className="hidden" />
          <button className="btn-danger-red" onClick={() => { setSelected(null); setModal('add') }}><Plus className="w-4 h-4" />Tambah Master Item</button>
          <button className="btn-square-refresh" onClick={loadData} title="Refresh"><RefreshCw className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Category filter pills */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setCatFilter('ALL')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${catFilter === 'ALL' ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
          Semua <span className="ml-1 opacity-60">{pharmacyItems.length}</span>
        </button>
        {CATEGORIES.map(c => (
          <button key={c} onClick={() => setCatFilter(catFilter === c ? 'ALL' : c)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${catFilter === c ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
            {CAT_LABELS[c]} <span className="ml-1 opacity-60">{pharmacyItems.filter(i => i.category === c).length}</span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card shadow-sm border border-slate-200 rounded-xl overflow-hidden">
        <div className="card-header bg-slate-50 border-b border-slate-200 p-4 flex items-center justify-between flex-wrap gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Cari kode, nama sediaan, bentuk, kandungan..." className="w-80" />
          <span className="text-sm font-semibold text-slate-500">{filtered.length} item</span>
        </div>
        <div className="w-full">
          <table className="w-full text-left border-collapse table-auto">
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                <th className="py-2.5 px-2.5" style={{ width: '90px' }}>Kode</th>
                <th className="py-2.5 px-2.5" style={{ minWidth: '180px' }}>Nama Sediaan Farmasi</th>
                <th className="py-2.5 px-2.5" style={{ width: '85px' }}>Bentuk</th>
                <th className="py-2.5 px-2.5" style={{ width: '110px' }}>Golongan</th>
                <th className="py-2.5 px-2.5" style={{ minWidth: '120px' }}>Kelas Terapi</th>
                <th className="py-2.5 px-2.5" style={{ minWidth: '130px' }}>Kandungan</th>
                <th className="py-2.5 px-2.5" style={{ width: '85px' }}>Kategori</th>
                <th style={{ width: '50px' }} className="py-2.5 px-2 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white text-[11px]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    <p className="text-xs">{search ? 'Item tidak ditemukan' : 'Belum ada data Master Inventory'}</p>
                  </td>
                </tr>
              ) : filtered.map(item => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-2 px-2.5 font-mono text-[11px] text-primary-700 font-bold whitespace-nowrap">{item.itemCode || '—'}</td>
                  <td className="py-2 px-2.5 font-bold text-slate-900 leading-tight">{item.itemName}</td>
                  <td className="py-2 px-2.5 text-[11px] font-medium text-slate-700 whitespace-nowrap">{item.bentuk}</td>
                  <td className="py-2 px-2.5 text-[11px] font-medium text-slate-600 whitespace-nowrap">{item.golongan}</td>
                  <td className="py-2 px-2.5 text-[11px] text-slate-600">{item.kelasTerapi}</td>
                  <td className="py-2 px-2.5 text-[11px] text-slate-600" title={item.kandungan}>{item.kandungan || '—'}</td>
                  <td className="py-2 px-2.5 whitespace-nowrap">
                    <span className={`badge text-[10px] px-2 py-0.5 ${CAT_COLORS[item.category] || 'badge-gray'}`}>
                      {CAT_LABELS[item.category] || item.category}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-center whitespace-nowrap">
                    <button className="btn-action-edit p-1" onClick={() => { setSelected(item); setModal('edit') }} title="Edit">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      <Modal open={!!modal && modal !== 'import'} onClose={() => setModal(null)}
        title={modal === 'add' ? 'Tambah Master Inventory Baru' : `Edit Master Inventory — ${selected?.itemCode}`}
        size="lg">
        <ItemForm
          initial={modal === 'edit' ? selected : {}}
          onSave={handleSave}
          onClose={() => setModal(null)}
          coa={coa}
          nextCodeByCategory={modal === 'add' ? nextCodeByCategory : undefined}
        />
      </Modal>

      {/* Import Preview Modal */}
      <Modal open={importModal}
        onClose={() => { setImportModal(false); setImportRows([]); setImportErrs([]) }}
        title="Preview Import Master Inventory"
        size="xl"
        footer={
          <>
            <button className="btn-secondary" onClick={() => { setImportModal(false); setImportRows([]); setImportErrs([]) }}>Batal</button>
            <button className="btn-primary" disabled={importErrs.length > 0 || importRows.length === 0} onClick={executeImport}>
              <Upload className="w-4 h-4" />Import {importRows.length} Master Inventory
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {importErrs.length > 0 && (
            <Alert type="error" title={`${importErrs.length} error ditemukan`}
              message={importErrs.join(' | ')} />
          )}
          {importErrs.length === 0 && importRows.length > 0 && (
            <Alert type="success" message={`${importRows.length} item master inventory siap diimpor.`} />
          )}
          <div className="overflow-x-auto max-h-96">
            <table className="table-base">
              <thead className="sticky top-0 bg-white z-10">
                <tr>
                  <th>#</th><th>Kode Barang</th>
                  <th>Nama Sediaan Farmasi</th><th>Bentuk</th><th>Golongan</th><th>Kelas Terapi</th>
                  <th>Kandungan</th><th>Kategori</th>
                </tr>
              </thead>
              <tbody>
                {importRows.map((item, i) => (
                  <tr key={i}>
                    <td className="text-xs text-slate-400">{i + 1}</td>
                    <td className="font-mono text-xs font-semibold text-primary-700">{item.itemCode}</td>
                    <td className="text-sm font-medium">{item.itemName}</td>
                    <td className="text-xs">{item.bentuk}</td>
                    <td className="text-xs">{item.golongan}</td>
                    <td className="text-xs">{item.kelasTerapi}</td>
                    <td className="text-xs">{item.kandungan}</td>
                    <td><span className={`badge text-xs ${CAT_COLORS[item.category] || 'badge-gray'}`}>{CAT_LABELS[item.category] || item.category}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>
    </div>
  )
}
