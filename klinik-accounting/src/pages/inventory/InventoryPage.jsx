import { useState, useMemo, useRef } from 'react'
import { Plus, Pencil, Package, AlertTriangle, Download, Upload, FileDown, RefreshCw } from 'lucide-react'
import { useStore } from '../../store/useStore'
import Modal from '../../components/ui/Modal'
import SearchInput from '../../components/ui/SearchInput'
import { StatusBadge } from '../../components/ui/Badge'
import { fmtIDR } from '../../utils/format'
import { exportStockExcel } from '../../utils/exportExcel'
import Alert from '../../components/ui/Alert'
import toast from 'react-hot-toast'
import { v4 as uuidv4 } from 'uuid'
import * as XLSX from 'xlsx'

const CATEGORIES = ['ETHICAL','OTC','BHP','ALAT_MEDIS','VAKSIN']
const CAT_LABELS  = { ETHICAL:'Obat Etikal (Rx)', OTC:'Obat OTC', BHP:'BHP Medis', ALAT_MEDIS:'Alat Medis', VAKSIN:'Vaksin' }
const CAT_COLORS  = { ETHICAL:'badge-blue', OTC:'badge-green', BHP:'badge-purple', ALAT_MEDIS:'badge-yellow', VAKSIN:'badge-teal' }
const CAT_INV_COA = { ETHICAL:'1-13-001', OTC:'1-13-002', BHP:'1-13-003', ALAT_MEDIS:'1-13-004', VAKSIN:'1-13-005' }
const CAT_HPP_COA = { ETHICAL:'5-11-001', OTC:'5-11-002', BHP:'5-11-003', ALAT_MEDIS:'5-11-004', VAKSIN:'5-11-001' }

// ─── Item Form ───────────────────────────────────────────────
function ItemForm({ initial = {}, onSave, onClose, coa, nextCode, nextSku }) {
  const invCOA = coa.filter(a => a.accountGroup === 'ASET LANCAR' && a.accountSubgroup === 'Persediaan' && !a.isHeader)
  const hppCOA = coa.filter(a => a.accountGroup === 'HARGA POKOK' && !a.isHeader)

  const [form, setForm] = useState({
    itemCode:        initial.itemCode        || nextCode || '',
    skuCode:         initial.skuCode         || nextSku  || '',
    itemName:        initial.itemName        || '',
    genericName:     initial.genericName     || '',
    category:        initial.category        || 'ETHICAL',
    baseUnit:        initial.baseUnit        || 'Tablet',
    minSafetyStock:  initial.minSafetyStock  ?? 50,
    reorderPoint:    initial.reorderPoint    ?? 100,
    coaInventoryCode: initial.coaInventoryCode || '1-13-001',
    coaCOGSCode:     initial.coaCOGSCode     || '5-11-001',
    sellingPrice:    initial.sellingPrice    ?? 0,
    isPrescription:  initial.isPrescription  ?? false,
    notes:           initial.notes           || '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleCategoryChange = (cat) => {
    set('category', cat)
    set('coaInventoryCode', CAT_INV_COA[cat] || '1-13-002')
    set('coaCOGSCode',      CAT_HPP_COA[cat] || '5-11-002')
  }

  const submit = (e) => {
    e.preventDefault()
    if (!form.itemName.trim()) { toast.error('Nama item wajib diisi.'); return }
    if (!form.itemCode.trim()) { toast.error('Kode barang wajib diisi.'); return }
    onSave(form)
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* Kode & SKU */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="form-label">Kode Barang *</label>
          <input className="form-input font-mono" value={form.itemCode}
            onChange={e => set('itemCode', e.target.value.toUpperCase())}
            placeholder="ETH-0001" required />
          <p className="text-xs text-slate-400 mt-1">Kode unik untuk identifikasi barang di sistem</p>
        </div>
        <div>
          <label className="form-label">Kode SKU (Barcode)</label>
          <input className="form-input font-mono" value={form.skuCode}
            onChange={e => set('skuCode', e.target.value)}
            placeholder="SKU-00001" />
          <p className="text-xs text-slate-400 mt-1">Kode barcode supplier / internal</p>
        </div>
      </div>

      {/* Kategori */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="form-label">Kategori *</label>
          <select className="form-select" value={form.category} onChange={e => handleCategoryChange(e.target.value)}>
            {CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">Satuan Dasar *</label>
          <input className="form-input" value={form.baseUnit}
            onChange={e => set('baseUnit', e.target.value)}
            placeholder="Tablet, Botol, Pcs, Box…" />
        </div>
      </div>

      {/* Nama */}
      <div>
        <label className="form-label">Nama Item *</label>
        <input className="form-input" value={form.itemName}
          onChange={e => set('itemName', e.target.value)}
          placeholder="Nama lengkap obat / alat medis…" required />
      </div>
      <div>
        <label className="form-label">Nama Generik / Zat Aktif</label>
        <input className="form-input" value={form.genericName}
          onChange={e => set('genericName', e.target.value)}
          placeholder="Nama generik / zat aktif (opsional)…" />
      </div>

      {/* Stok */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="form-label">Stok Minimum (Safety Stock)</label>
          <input type="number" className="form-input" value={form.minSafetyStock}
            onChange={e => set('minSafetyStock', parseInt(e.target.value) || 0)} min={0} />
        </div>
        <div>
          <label className="form-label">Titik Reorder (Reorder Point)</label>
          <input type="number" className="form-input" value={form.reorderPoint}
            onChange={e => set('reorderPoint', parseInt(e.target.value) || 0)} min={0} />
        </div>
      </div>

      {/* COA */}
      <div className="grid grid-cols-2 gap-4">
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

      {/* Harga & Resep */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="form-label">Harga Jual (Rp)</label>
          <input type="number" className="form-input" value={form.sellingPrice}
            onChange={e => set('sellingPrice', parseFloat(e.target.value) || 0)}
            min={0} step={100} />
        </div>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.isPrescription}
              onChange={e => set('isPrescription', e.target.checked)}
              className="w-4 h-4 accent-primary-600" />
            <span className="text-sm text-slate-700">Memerlukan Resep Dokter (Rx)</span>
          </label>
        </div>
      </div>

      <div>
        <label className="form-label">Catatan</label>
        <textarea className="form-textarea" rows={2} value={form.notes}
          onChange={e => set('notes', e.target.value)}
          placeholder="Indikasi, kontraindikasi, catatan penyimpanan…" />
      </div>

      {/* Info COA otomatis */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 text-xs text-blue-700">
        Jurnal otomatis saat penerimaan barang (GRN):<br />
        <strong>Debit {form.coaInventoryCode}</strong> (Persediaan) — <strong>Kredit 2-11-001</strong> (Utang PBF)
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn-secondary" onClick={onClose}>Batal</button>
        <button type="submit" className="btn-primary">Simpan Item</button>
      </div>
    </form>
  )
}

// ─── Main Page ───────────────────────────────────────────────
export default function InventoryPage() {
  const { coa, pharmacyItems, invBatches, addPharmacyItem, updatePharmacyItem, generateSku, generateItemCode } = useStore()
  const [search,      setSearch]      = useState('')
  const [catFilter,   setCatFilter]   = useState('ALL')
  const [modal,       setModal]       = useState(null)
  const [selected,    setSelected]    = useState(null)
  const [importModal, setImportModal] = useState(false)
  const [importRows,  setImportRows]  = useState([])
  const [importErrs,  setImportErrs]  = useState([])
  const fileRef = useRef(null)

  // ── Derived ──────────────────────────────────────────────
  const nextSku  = useMemo(() => generateSku  ? generateSku()           : `SKU-${String(pharmacyItems.length+1).padStart(5,'0')}`, [pharmacyItems])
  const nextCode = useMemo(() => generateItemCode ? generateItemCode('ETHICAL') : `ETH-${String(pharmacyItems.filter(p=>p.category==='ETHICAL').length+1).padStart(4,'0')}`, [pharmacyItems])

  const filtered = useMemo(() =>
    pharmacyItems
      .filter(i => catFilter === 'ALL' || i.category === catFilter)
      .filter(i => !search ||
        i.itemName.toLowerCase().includes(search.toLowerCase()) ||
        (i.itemCode||'').toLowerCase().includes(search.toLowerCase()) ||
        (i.skuCode||'').toLowerCase().includes(search.toLowerCase()) ||
        (i.genericName||'').toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => (a.itemCode||'').localeCompare(b.itemCode||'')),
  [pharmacyItems, catFilter, search])

  const getStock = (itemId) =>
    invBatches.filter(b => b.itemId===itemId && b.quantityCurrent>0).reduce((s,b)=>s+b.quantityCurrent, 0)

  const isExpiringSoon = (itemId) => {
    const limit = new Date(); limit.setDate(limit.getDate()+180)
    return invBatches.some(b => b.itemId===itemId && b.quantityCurrent>0 && new Date(b.expiryDate)<=limit)
  }

  const criticalCount = pharmacyItems.filter(i => getStock(i.id) <= (i.minSafetyStock||50)).length

  // ── Save handler ────────────────────────────────────────
  const handleSave = async (data) => {
    if (modal === 'add') {
      // Check duplicate code
      if (pharmacyItems.find(p => p.itemCode === data.itemCode)) {
        toast.error(`Kode barang ${data.itemCode} sudah digunakan.`)
        return
      }
      await addPharmacyItem({ ...data, isActive: true })
      toast.success(`Item ${data.itemName} berhasil ditambahkan.`)
    } else {
      await updatePharmacyItem(selected.id, data)
      toast.success('Item berhasil diperbarui.')
    }
    setModal(null)
  }

  // ── Download template ────────────────────────────────────
  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { 'Kode Barang':'ETH-0001','Kode SKU':'SKU-00001','Nama Item':'Amoxicillin 500mg','Nama Generik':'Amoxicillin','Kategori':'ETHICAL','Satuan':'Kapsul','Stok Minimum':50,'Reorder Point':100,'Harga Jual':5000,'Perlu Resep (Y/N)':'Y','Catatan':'Antibiotik' },
      { 'Kode Barang':'OTC-0001','Kode SKU':'SKU-00002','Nama Item':'Paracetamol 500mg','Nama Generik':'Acetaminophen','Kategori':'OTC','Satuan':'Tablet','Stok Minimum':100,'Reorder Point':200,'Harga Jual':2500,'Perlu Resep (Y/N)':'N','Catatan':'' },
      { 'Kode Barang':'BHP-0001','Kode SKU':'SKU-00003','Nama Item':'Kasa Steril 10x10cm','Nama Generik':'','Kategori':'BHP','Satuan':'Lembar','Stok Minimum':200,'Reorder Point':500,'Harga Jual':1500,'Perlu Resep (Y/N)':'N','Catatan':'' },
    ])
    ws['!cols'] = [16,15,30,25,15,12,15,15,15,18,30].map(w=>({wch:w}))
    const info = XLSX.utils.aoa_to_sheet([
      ['TEMPLATE IMPORT MASTER ITEM FARMASI & MEDIS - Klinik Medis Antigravity'],[''],
      ['Petunjuk:'],
      ['1. Jangan ubah baris header (baris pertama)'],
      ['2. Kode Barang harus unik — format: XXX-NNNN (mis. ETH-0001)'],
      ['3. Kategori: ETHICAL | OTC | BHP | ALAT_MEDIS | VAKSIN'],
      ['4. Harga Jual: angka Rupiah tanpa pemisah ribuan'],
      ['5. Perlu Resep: Y atau N'],
      ['6. COA persediaan & HPP ditetapkan otomatis berdasarkan Kategori'],
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws,   'Template Import')
    XLSX.utils.book_append_sheet(wb, info, 'Petunjuk')
    XLSX.writeFile(wb, 'Template_Import_MasterBarang.xlsx')
    toast.success('Template berhasil diunduh.')
  }

  // ── Parse import file ────────────────────────────────────
  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const wb   = XLSX.read(ev.target.result, { type:'binary' })
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval:'' })
        const errs = []
        const parsed = rows.map((row, i) => {
          const cat  = String(row['Kategori']||'').toUpperCase().trim()
          const code = String(row['Kode Barang']||'').trim().toUpperCase()
          const name = String(row['Nama Item']||'').trim()
          if (!name) errs.push(`Baris ${i+2}: Nama Item kosong.`)
          if (!code) errs.push(`Baris ${i+2}: Kode Barang kosong.`)
          if (!CATEGORIES.includes(cat)) errs.push(`Baris ${i+2}: Kategori "${cat}" tidak valid.`)
          return {
            itemCode:        code,
            skuCode:         String(row['Kode SKU']||'').trim() || `SKU-${String(pharmacyItems.length+i+1).padStart(5,'0')}`,
            itemName:        name,
            genericName:     String(row['Nama Generik']||''),
            category:        cat || 'OTC',
            baseUnit:        String(row['Satuan']||'Pcs'),
            minSafetyStock:  parseInt(row['Stok Minimum'])  || 50,
            reorderPoint:    parseInt(row['Reorder Point']) || 100,
            sellingPrice:    parseFloat(row['Harga Jual'])  || 0,
            isPrescription:  String(row['Perlu Resep (Y/N)']).toUpperCase() === 'Y',
            notes:           String(row['Catatan']||''),
            coaInventoryCode: CAT_INV_COA[cat] || '1-13-002',
            coaCOGSCode:      CAT_HPP_COA[cat] || '5-11-002',
          }
        }).filter(r => r.itemName && r.itemCode)
        setImportRows(parsed)
        setImportErrs(errs)
        setImportModal(true)
      } catch (_) {
        toast.error('Gagal membaca file. Pastikan format sesuai template.')
      }
    }
    reader.readAsBinaryString(file)
    e.target.value = ''
  }

  // ── Execute import ───────────────────────────────────────
  const executeImport = async () => {
    if (importErrs.length > 0) { toast.error('Perbaiki error terlebih dahulu.'); return }
    let added = 0, skipped = 0
    for (const item of importRows) {
      if (pharmacyItems.find(p => p.itemCode===item.itemCode)) { skipped++; continue }
      await addPharmacyItem({ ...item, isActive:true })
      added++
    }
    toast.success(`Import selesai: ${added} item ditambahkan, ${skipped} dilewati (kode sudah ada).`)
    setImportModal(false)
    setImportRows([])
  }

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Master Item Farmasi &amp; Medis</h1>
          <p className="text-sm text-slate-400 mt-0.5">Manajemen inventaris obat, BHP, alat medis — terintegrasi Supabase</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={downloadTemplate}><FileDown className="w-4 h-4" />Unduh Template</button>
          <button className="btn-secondary" onClick={() => fileRef.current?.click()}><Upload className="w-4 h-4" />Import Excel</button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} className="hidden" />
          <button className="btn-secondary" onClick={() => exportStockExcel(pharmacyItems, invBatches)}><Download className="w-4 h-4" />Export Stok</button>
          <button className="btn-primary" onClick={() => { setSelected(null); setModal('add') }}><Plus className="w-4 h-4" />Tambah Item</button>
        </div>
      </div>

      {/* Category filter pills */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setCatFilter('ALL')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${catFilter==='ALL' ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
          Semua <span className="ml-1 opacity-60">{pharmacyItems.length}</span>
        </button>
        {CATEGORIES.map(c => (
          <button key={c} onClick={() => setCatFilter(catFilter===c ? 'ALL' : c)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${catFilter===c ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
            {CAT_LABELS[c]} <span className="ml-1 opacity-60">{pharmacyItems.filter(i=>i.category===c).length}</span>
          </button>
        ))}
        {criticalCount > 0 && (
          <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-700 border border-red-200 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />{criticalCount} item stok kritis
          </span>
        )}
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-header">
          <SearchInput value={search} onChange={setSearch} placeholder="Cari kode, nama, generik, SKU…" className="w-80" />
          <span className="text-sm text-slate-400 ml-auto">{filtered.length} item</span>
        </div>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th style={{width:110}}>Kode Barang</th>
                <th style={{width:100}}>SKU</th>
                <th>Nama Item</th>
                <th>Generik</th>
                <th>Kategori</th>
                <th className="text-right">Stok</th>
                <th className="text-right">Min. Stok</th>
                <th className="text-right">Harga Jual</th>
                <th>Status</th>
                <th style={{width:60}}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-14 text-slate-400">
                  <Package className="w-10 h-10 mx-auto mb-3 opacity-20" />
                  <p>{search ? 'Item tidak ditemukan' : 'Belum ada item — tambah manual atau import Excel'}</p>
                </td></tr>
              ) : filtered.map(item => {
                const stock    = getStock(item.id)
                const critical = stock <= (item.minSafetyStock || 50)
                const expiring = isExpiringSoon(item.id)
                return (
                  <tr key={item.id}>
                    <td className="font-mono text-xs text-primary-700 font-semibold">{item.itemCode || '—'}</td>
                    <td className="font-mono text-xs text-slate-500">{item.skuCode || '—'}</td>
                    <td>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-medium">{item.itemName}</span>
                        {item.isPrescription && <span className="badge badge-red text-xs">Rx</span>}
                        {expiring && <span className="badge badge-yellow text-xs">⚠ Hampir ED</span>}
                      </div>
                    </td>
                    <td className="text-xs text-slate-500">{item.genericName || '—'}</td>
                    <td><span className={`badge text-xs ${CAT_COLORS[item.category]}`}>{CAT_LABELS[item.category]}</span></td>
                    <td className={`text-right font-mono text-sm font-bold ${critical ? 'text-red-600' : 'text-slate-800'}`}>
                      {stock} <span className="font-normal text-slate-400 text-xs">{item.baseUnit}</span>
                    </td>
                    <td className="text-right text-sm text-slate-500">{item.minSafetyStock || 50}</td>
                    <td className="text-right font-mono text-sm">{fmtIDR(item.sellingPrice || 0)}</td>
                    <td><StatusBadge status={critical ? 'KRITIS' : 'AMAN'} /></td>
                    <td>
                      <button className="btn-ghost p-1.5" onClick={() => { setSelected(item); setModal('edit') }}>
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      <Modal open={!!modal && modal !== 'import'} onClose={() => setModal(null)}
        title={modal === 'add' ? 'Tambah Item Baru' : `Edit Item — ${selected?.itemCode}`}
        size="lg">
        <ItemForm
          initial={modal === 'edit' ? selected : {}}
          onSave={handleSave}
          onClose={() => setModal(null)}
          coa={coa}
          nextCode={modal === 'add' ? nextCode : undefined}
          nextSku={modal === 'add' ? nextSku : undefined}
        />
      </Modal>

      {/* Import Preview Modal */}
      <Modal open={importModal}
        onClose={() => { setImportModal(false); setImportRows([]); setImportErrs([]) }}
        title="Preview Import Master Barang"
        size="xl"
        footer={
          <>
            <button className="btn-secondary" onClick={() => { setImportModal(false); setImportRows([]); setImportErrs([]) }}>Batal</button>
            <button className="btn-primary" disabled={importErrs.length > 0 || importRows.length === 0} onClick={executeImport}>
              <Upload className="w-4 h-4" />Import {importRows.length} Item
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
            <Alert type="success" message={`${importRows.length} item siap diimpor. Periksa data di bawah.`} />
          )}
          <div className="overflow-x-auto max-h-96">
            <table className="table-base">
              <thead className="sticky top-0 bg-white z-10">
                <tr>
                  <th>#</th><th>Kode Barang</th><th>Kode SKU</th>
                  <th>Nama Item</th><th>Kategori</th>
                  <th className="text-right">Min. Stok</th>
                  <th className="text-right">Harga Jual</th><th>Resep</th>
                </tr>
              </thead>
              <tbody>
                {importRows.map((item, i) => (
                  <tr key={i}>
                    <td className="text-xs text-slate-400">{i+1}</td>
                    <td className="font-mono text-xs font-semibold text-primary-700">{item.itemCode}</td>
                    <td className="font-mono text-xs text-slate-500">{item.skuCode}</td>
                    <td className="text-sm font-medium">{item.itemName}</td>
                    <td><span className={`badge text-xs ${CAT_COLORS[item.category]||'badge-gray'}`}>{CAT_LABELS[item.category]||item.category}</span></td>
                    <td className="text-right text-sm">{item.minSafetyStock}</td>
                    <td className="text-right font-mono text-sm">{fmtIDR(item.sellingPrice)}</td>
                    <td className="text-center">{item.isPrescription ? <span className="badge badge-red text-xs">Rx</span> : '—'}</td>
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
