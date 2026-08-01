import { useState, useMemo, useEffect } from 'react'
import { Plus, Trash2, CheckCircle, AlertTriangle, Package, TrendingUp, Eye, Edit3, X, ListPlus, Lock } from 'lucide-react'
import { useStore } from '../../store/useStore'
import SearchableSelect from '../../components/ui/SearchableSelect'
import Modal from '../../components/ui/Modal'
import { fmtIDR, fmtDate, todayISO, daysBetween, fmtNum, parseNumericInput } from '../../utils/format'
import toast from 'react-hot-toast'
import { v4 as uuidv4 } from 'uuid'
import {
  fetchPharmacyItems,
  fetchVendors,
  fetchBatches,
  insertBatches,
  insertStockLedger,
  upsertJournalEntry,
  insertJournalItems,
  deleteGRNByRef,
} from '../../lib/db'
import { supabase } from '../../lib/supabase'

function generateGRN(batches = []) {
  const d = new Date()
  const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  const prefix = `GRN/${dateStr}/`

  let maxSeq = 0
  if (Array.isArray(batches)) {
    batches.forEach(b => {
      const ref = b.grnReference || b.grn_reference || b.referenceNumber || b.reference_number || ''
      if (ref && typeof ref === 'string' && ref.includes('GRN/')) {
        const parts = ref.split('/')
        const seqStr = parts[parts.length - 1]
        const seq = parseInt(seqStr, 10)
        if (!isNaN(seq) && seq > maxSeq) {
          maxSeq = seq
        }
      }
    })
  }

  return `${prefix}${String(maxSeq + 1).padStart(5, '0')}`
}

function FormattedNumberInput({ value, onChange, placeholder, className, style, disabled }) {
  const [displayVal, setDisplayVal] = useState('')

  useEffect(() => {
    if (value !== undefined && value !== null && value !== '') {
      const num = parseNumericInput(value)
      setDisplayVal(num ? fmtNum(num) : String(value))
    } else {
      setDisplayVal('')
    }
  }, [value])

  const handleChange = (e) => {
    if (disabled) return
    const raw = e.target.value
    const num = parseNumericInput(raw)
    setDisplayVal(raw)
    onChange(num)
  }

  const handleBlur = () => {
    const num = parseNumericInput(displayVal)
    setDisplayVal(num ? fmtNum(num) : '')
  }

  return (
    <input
      type="text"
      className={`${className} ${disabled ? 'bg-slate-100/90 text-slate-500 cursor-not-allowed border-slate-200' : ''}`}
      value={displayVal}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      style={style}
      disabled={disabled}
    />
  )
}

export default function GRNPage() {
  const { pharmacyItems, invBatches, activeBranchId, vendors } = useStore()

  const [dbPharmacyItems, setDbPharmacyItems] = useState([])
  const [dbVendors, setDbVendors] = useState([])
  const [dbBatches, setDbBatches] = useState([])

  const loadLiveDbData = async () => {
    try {
      const [items, vends, batches] = await Promise.all([
        fetchPharmacyItems().catch(() => []),
        fetchVendors().catch(() => []),
        fetchBatches().catch(() => []),
      ])
      if (Array.isArray(items)) setDbPharmacyItems(items)
      if (Array.isArray(vends)) setDbVendors(vends)
      if (Array.isArray(batches)) setDbBatches(batches)
    } catch (err) {
      console.warn('[GRNPage] Error loading live DB:', err)
    }
  }

  useEffect(() => {
    let isMounted = true
    loadLiveDbData()
    return () => { isMounted = false }
  }, [])

  const itemsList = dbPharmacyItems.length > 0 ? dbPharmacyItems : (pharmacyItems || [])
  const vendorsList = dbVendors.length > 0 ? dbVendors : (vendors || [])
  const batchesList = dbBatches.length > 0 ? dbBatches : (invBatches || [])

  // Edit / View state for existing GRNs
  const [editingGrnRef, setEditingGrnRef] = useState(null)
  const [editingJournalId, setEditingJournalId] = useState(null)
  const [viewingGrn, setViewingGrn] = useState(null)

  const [grnNumber, setGrnNumber] = useState(() => generateGRN(batchesList))

  useEffect(() => {
    if (!editingGrnRef && batchesList.length > 0) {
      setGrnNumber(generateGRN(batchesList))
    }
  }, [batchesList, editingGrnRef])
  const [grnDate, setGrnDate] = useState(todayISO())
  const [invoiceDate, setInvoiceDate] = useState(todayISO())
  const [supplierName, setSupplierName] = useState('')
  const [invoiceRef, setInvoiceRef] = useState('')
  const ppnRate = 0.11 // Fixed PPN 11% Include as per PSAK 14 / PSAK 202
  const [lines, setLines] = useState([])
  const [submitting, setSubmitting] = useState(false)

  // Pop-up Item Modal State
  const [itemModalOpen, setItemModalOpen] = useState(false)
  const [isSingleEdit, setIsSingleEdit] = useState(false)
  const [modalTempItems, setModalTempItems] = useState([])
  const [currentItem, setCurrentItem] = useState({
    id: null,
    itemId: '',
    batchNumber: '',
    expiryDate: '',
    unitCostPrice: '',
    sellingPrice: '',
    quantityReceived: '1',
    notes: ''
  })

  const vendorOptions = useMemo(() =>
    vendorsList
      .filter(v => v.isActive !== false)
      .map(v => ({ value: v.name, label: v.name })),
    [vendorsList]
  )

  const itemOptions = useMemo(() =>
    itemsList
      .filter(i => i.isActive !== false)
      .sort((a, b) => (a.itemName || '').localeCompare(b.itemName || ''))
      .map(i => ({
        value: i.id,
        label: i.itemName
      })),
    [itemsList]
  )

  const itemMap = useMemo(() => {
    const m = {}
    itemsList.forEach(i => { m[i.id] = i })
    return m
  }, [itemsList])

  const previewBatches = useMemo(() => {
    return [...batchesList].sort((a, b) => new Date(b.receivedAt || b.createdAt) - new Date(a.receivedAt || a.createdAt))
  }, [batchesList])

  const groupedGRNs = useMemo(() => {
    const groups = {}
    previewBatches.forEach(b => {
      const ref = b.grnReference || 'UNCLASSIFIED'
      if (!groups[ref]) {
        groups[ref] = {
          grnReference: ref,
          receivedAt: b.receivedAt || b.createdAt,
          supplierName: b.supplierName || '—',
          journalEntryId: b.journalEntryId || null,
          batches: []
        }
      }
      groups[ref].batches.push(b)
    })
    return Object.values(groups).sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt))
  }, [previewBatches])

  const handleOpenAddItem = () => {
    setIsSingleEdit(false)
    setModalTempItems([])
    setCurrentItem({
      id: null,
      itemId: '',
      batchNumber: `BTH-${new Date().getFullYear()}-${String(lines.length + 1).padStart(3, '0')}`,
      expiryDate: '',
      unitCostPrice: '',
      sellingPrice: '',
      quantityReceived: '1',
      notes: ''
    })
    setItemModalOpen(true)
  }

  const handleOpenEditItem = (line) => {
    setIsSingleEdit(true)
    setModalTempItems([])
    setCurrentItem({ ...line })
    setItemModalOpen(true)
  }

  const handleRemoveLine = (id) => {
    setLines(ls => ls.filter(l => l.id !== id))
    toast.success('Item dihapus dari daftar penerimaan')
  }

  const handleAddTempItemToModalList = () => {
    if (!currentItem.itemId) {
      toast.error('Silakan pilih Item Farmasi / Medis')
      return
    }
    if (!currentItem.batchNumber.trim()) {
      toast.error('No. Batch wajib diisi')
      return
    }
    if (!currentItem.expiryDate) {
      toast.error('Tanggal kadaluarsa wajib diisi')
      return
    }
    if (new Date(currentItem.expiryDate) <= new Date()) {
      toast.error('Tanggal kadaluarsa harus di masa depan')
      return
    }
    if (!parseFloat(currentItem.unitCostPrice) || parseFloat(currentItem.unitCostPrice) <= 0) {
      toast.error('HPP / Unit (Rp) harus lebih besar dari 0')
      return
    }
    if (!parseFloat(currentItem.quantityReceived) || parseFloat(currentItem.quantityReceived) <= 0) {
      toast.error('Jumlah / Qty harus lebih besar dari 0')
      return
    }

    const hpp = parseFloat(currentItem.unitCostPrice) || 0
    const sp = parseFloat(currentItem.sellingPrice) || Math.round(hpp * 1.25)
    const itemData = {
      ...currentItem,
      id: currentItem.id || uuidv4(),
      unitCostPrice: hpp,
      sellingPrice: sp,
      quantityReceived: parseFloat(currentItem.quantityReceived) || 1,
    }

    if (isSingleEdit) {
      setLines(prev => prev.map(l => l.id === itemData.id ? itemData : l))
      setItemModalOpen(false)
      toast.success('Item berhasil diperbarui!')
      return
    }

    setModalTempItems(prev => [...prev, itemData])
    toast.success(`Data "${itemMap[itemData.itemId]?.itemName || 'Item'}" ditambahkan ke list sementara!`)

    const nextCount = lines.length + modalTempItems.length + 2
    setCurrentItem({
      id: null,
      itemId: '',
      batchNumber: `BTH-${new Date().getFullYear()}-${String(nextCount).padStart(3, '0')}`,
      expiryDate: currentItem.expiryDate || '',
      unitCostPrice: '',
      sellingPrice: '',
      quantityReceived: '1',
      notes: ''
    })
  }

  const handleRemoveTempItem = (tempId) => {
    setModalTempItems(prev => prev.filter(t => t.id !== tempId))
  }

  const handleCommitModalItemsToMain = () => {
    if (modalTempItems.length === 0) {
      if (currentItem.itemId) {
        handleAddTempItemToModalList()
        return
      }
      toast.error('Belum ada item di daftar sementara modal.')
      return
    }

    setLines(prev => [...prev, ...modalTempItems])
    setItemModalOpen(false)
    toast.success(`Berhasil menambahkan ${modalTempItems.length} item ke dokumen GRN!`)
  }

  // PSAK 14 / PSAK 202 Calculations
  const rawSubtotal = lines.reduce((s, l) => s + (parseFloat(l.unitCostPrice) || 0) * (parseFloat(l.quantityReceived) || 0), 0)
  const totalValue = rawSubtotal
  const dppAmount = rawSubtotal / (1 + ppnRate)
  const ppnAmount = rawSubtotal - dppAmount

  const getExpiryWarning = (expiryDate) => {
    if (!expiryDate) return null
    const days = daysBetween(new Date(), new Date(expiryDate))
    if (days <= 0) return { level: 'error', msg: 'Sudah kadaluarsa!' }
    if (days <= 180) return { level: 'warning', msg: `Kadaluarsa dalam ${days} hari` }
    return null
  }

  const handleEditGRN = (grnGroup) => {
    setEditingGrnRef(grnGroup.grnReference)
    setEditingJournalId(grnGroup.journalEntryId)
    setGrnNumber(grnGroup.grnReference)
    if (grnGroup.receivedAt) {
      setGrnDate(grnGroup.receivedAt.split('T')[0])
    }
    setSupplierName(grnGroup.supplierName || '')

    const loadedLines = grnGroup.batches.map(b => ({
      id: b.id || uuidv4(),
      itemId: b.itemId,
      batchNumber: b.batchNumber,
      expiryDate: b.expiryDate ? b.expiryDate.split('T')[0] : '',
      unitCostPrice: b.unitCostPrice,
      sellingPrice: b.sellingPrice,
      quantityReceived: b.quantityReceived,
      notes: ''
    }))
    setLines(loadedLines)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    toast.success(`GRN ${grnGroup.grnReference} dimuat ke form untuk diedit (Jumlah Qty & Harga dikunci).`)
  }

  const resetForm = () => {
    setEditingGrnRef(null)
    setEditingJournalId(null)
    setGrnNumber(generateGRN(batchesList))
    setGrnDate(todayISO())
    setInvoiceDate(todayISO())
    setSupplierName('')
    setInvoiceRef('')
    setLines([])
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!supplierName.trim()) {
      toast.error('Pilih Supplier / PBF terlebih dahulu')
      return
    }

    const validLines = lines.filter(l => l.itemId && l.batchNumber && l.expiryDate && parseFloat(l.unitCostPrice) > 0 && parseFloat(l.quantityReceived) > 0)
    if (validLines.length === 0) {
      toast.error('Minimal 1 baris item GRN valid harus ditambahkan.')
      return
    }

    for (const l of validLines) {
      if (new Date(l.expiryDate) <= new Date()) {
        toast.error(`Batch ${l.batchNumber}: Tanggal kadaluarsa sudah lewat. GRN ditolak.`)
        return
      }
    }

    setSubmitting(true)
    try {
      if (editingGrnRef) {
        await deleteGRNByRef(editingGrnRef, editingJournalId)
      }

      const entryId = editingJournalId || uuidv4()
      const now = new Date().toISOString()
      const receivedTime = grnDate ? `${grnDate}T${now.split('T')[1] || '00:00:00.000Z'}` : now

      const batchesData = validLines.map(l => {
        const rawHpp = parseFloat(l.unitCostPrice) || 0
        const qty = parseFloat(l.quantityReceived) || 0
        const effectiveHpp = rawHpp
        const sp = parseFloat(l.sellingPrice) || Math.round(rawHpp * 1.25)
        return {
          id: uuidv4(),
          itemId: l.itemId,
          batchNumber: l.batchNumber,
          expiryDate: l.expiryDate,
          unitCostPrice: effectiveHpp,
          sellingPrice: sp,
          quantityReceived: qty,
          quantityCurrent: qty,
          grnReference: grnNumber,
          supplierName,
          journalEntryId: entryId,
          receivedAt: receivedTime,
          createdAt: now,
        }
      })

      const ledgerEntries = batchesData.map(b => ({
        id: uuidv4(),
        batchId: b.id,
        itemId: b.itemId,
        transactionType: 'GRN',
        referenceId: b.id,
        referenceNumber: grnNumber,
        quantityIn: b.quantityReceived,
        quantityOut: 0,
        balanceAfter: b.quantityReceived,
        unitCost: b.unitCostPrice,
        totalValue: b.quantityReceived * b.unitCostPrice,
        loggedAt: receivedTime,
      }))

      const entryNumber = editingGrnRef ? `GRN-${grnNumber}` : `GRN/${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}/${Math.floor(10000 + Math.random() * 90000)}`
      const journalLines = []
      validLines.forEach(l => {
        const item = itemsList.find(i => i.id === l.itemId)
        const rawHpp = parseFloat(l.unitCostPrice) || 0
        const qty = parseFloat(l.quantityReceived) || 0
        const invVal = rawHpp * qty
        const isBHP = item?.category === 'BHP' || item?.category === 'PEMAKAIAN BHP' || (item?.itemCode || item?.item_code || '').startsWith('BHP-')
        const invAccCode = item?.coaInventoryCode || item?.coa_inventory_code || (isBHP ? '1-13-003' : '1-13-001')

        journalLines.push({
          id: uuidv4(),
          journalEntryId: entryId,
          accountCode: invAccCode,
          description: `GRN ${grnNumber} — ${item?.itemName || 'Obat'} (Capitalized PPN 11%)`,
          debit: invVal,
          credit: 0
        })
      })

      journalLines.push({
        id: uuidv4(),
        journalEntryId: entryId,
        accountCode: '2-11-001',
        description: `Utang Usaha / PBF — ${supplierName || 'Supplier'} (Faktur: ${invoiceRef || '-'})`,
        debit: 0,
        credit: totalValue
      })

      const header = {
        id: entryId,
        branchId: activeBranchId || null,
        entryNumber,
        transactionDate: grnDate,
        description: `Penerimaan Barang (GRN) ${grnNumber} — ${supplierName} (Faktur ${invoiceRef || '-'} tgl ${invoiceDate})`,
        entryType: 'GRN',
        status: 'POSTED',
        totalDebit: totalValue,
        totalCredit: totalValue,
        createdBy: 'System',
        postedBy: 'System',
        postedAt: now,
        createdAt: now,
        updatedAt: now,
      }

      await upsertJournalEntry(header)
      await insertJournalItems(journalLines)
      await insertBatches(batchesData)
      await insertStockLedger(ledgerEntries)

      for (const bd of batchesData) {
        await supabase.from('pharmacy_items').update({
          selling_price: bd.sellingPrice,
          updated_at: now
        }).eq('id', bd.itemId)
      }

      toast.success(editingGrnRef ? `GRN ${grnNumber} berhasil diperbarui di database!` : `GRN ${grnNumber} berhasil diproses & tersimpan di database!`)
      resetForm()
      await loadLiveDbData()
    } catch (err) {
      console.error('[GRN Submit Error]', err)
      toast.error(`Gagal menyimpan GRN: ${err.message || 'Terjadi kesalahan'}`)
    } finally {
      setSubmitting(false)
    }
  }

  const totalItems = lines.length
  const totalQty = lines.reduce((s, l) => s + (parseFloat(l.quantityReceived) || 0), 0)

  const selectedItemObj = itemMap[currentItem.itemId]
  const currentUnitStr = selectedItemObj?.unit || selectedItemObj?.smallUnit || selectedItemObj?.satuan || selectedItemObj?.uom || 'Unit'

  const currentHpp = parseFloat(currentItem.unitCostPrice) || 0
  const currentQty = parseFloat(currentItem.quantityReceived) || 0
  const currentSubtotal = currentHpp * currentQty
  const currentLineDpp = currentSubtotal / (1 + ppnRate)
  const currentLinePpn = currentSubtotal - currentLineDpp

  return (
    <div className="space-y-6 font-sans">
      {/* Page Title Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title font-sans">Penerimaan Barang (GRN)</h1>
          <p className="text-sm text-slate-400 mt-0.5 font-sans">
            Goods Receipt Note — Penerimaan obat & BHP (PPN Include dikapitalisasi ke Persediaan per PSAK 14)
          </p>
        </div>
        <div className="flex items-center gap-3">
          {editingGrnRef && (
            <div className="px-3 py-1.5 rounded-lg bg-amber-100 text-amber-800 text-xs font-bold flex items-center gap-1.5">
              <Edit3 className="w-3.5 h-3.5" /> Modus Edit: {editingGrnRef} (Harga & Qty Dikunci)
            </div>
          )}
          <div className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200">
            <span className="text-xs text-emerald-700 font-sans font-bold">{groupedGRNs.length} GRN tersimpan</span>
          </div>
        </div>
      </div>

      {/* KPI Cards — Compact, without "Rp" prefix */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Item Terisi</p>
              <p className="text-xl font-extrabold text-slate-800 tracking-tight font-sans mt-0.5">{totalItems} <span className="text-xs font-semibold text-slate-400">item</span></p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Kuantitas</p>
              <p className="text-xl font-extrabold text-slate-800 tracking-tight font-sans mt-0.5">{fmtNum(totalQty)} <span className="text-xs font-semibold text-slate-400">unit</span></p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Estimasi PPN 11%</p>
              <p className="text-xl font-extrabold text-emerald-700 tracking-tight font-sans mt-0.5">{fmtNum(Math.round(ppnAmount))}</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Nilai HPP</p>
              <p className="text-xl font-extrabold text-purple-700 tracking-tight font-sans mt-0.5">{fmtNum(Math.round(totalValue))}</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card card-body">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-800 font-sans">
              Header Dokumen Penerimaan {editingGrnRef && <span className="text-amber-600">(Mengedit {editingGrnRef})</span>}
            </h3>
            {editingGrnRef && (
              <button
                type="button"
                onClick={resetForm}
                className="btn-ghost text-xs py-1 px-2.5 text-slate-500 hover:text-slate-800"
              >
                <X className="w-3.5 h-3.5 inline mr-1" /> Batal Edit
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div>
              <label className="form-label font-sans">No. GRN</label>
              <input
                className="form-input bg-slate-100 font-sans text-xs font-extrabold text-slate-800 tracking-tight"
                value={grnNumber}
                readOnly
              />
            </div>
            <div>
              <label className="form-label font-sans">Tgl. Penerimaan *</label>
              <input type="date" className="form-input text-xs font-sans font-medium" value={grnDate} onChange={e => setGrnDate(e.target.value)} required />
            </div>
            <div>
              <label className="form-label font-sans">Supplier / PBF *</label>
              <SearchableSelect
                value={supplierName}
                onChange={val => setSupplierName(val)}
                options={vendorOptions}
                placeholder="— Pilih Supplier —"
                searchPlaceholder="Cari supplier..."
                hideValue={true}
              />
            </div>
            <div>
              <label className="form-label font-sans">No. Faktur Supplier</label>
              <input className="form-input text-xs font-sans" value={invoiceRef} onChange={e => setInvoiceRef(e.target.value)} placeholder="INV-2026-XXXX" />
            </div>
            <div>
              <label className="form-label font-sans">Tgl. Faktur</label>
              <input type="date" className="form-input text-xs font-sans" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Section List Item with + Tambah Item Penerimaan Button & Table */}
        <div className="card overflow-hidden">
          <div className="card-header bg-slate-50 flex items-center justify-between py-3.5 px-5">
            <div>
              <span className="section-title font-sans">Daftar Item Diterima ({lines.length})</span>
              <p className="text-xs text-slate-500 mt-0.5 font-sans">Klik tombol biru untuk menambah item secara sekaligus ke dalam daftar penerimaan</p>
            </div>
            <button
              type="button"
              onClick={handleOpenAddItem}
              className="btn-primary text-xs py-2 px-4 font-sans font-bold shadow-md shadow-primary-200/50 hover:shadow-lg flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />+ Tambah Item Penerimaan
            </button>
          </div>

          <div className="overflow-x-auto">
            {lines.length === 0 ? (
              <div className="text-center py-8 text-slate-400 font-sans">
                <Package className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p className="text-xs font-medium">Belum ada item penerimaan yang dimasukkan ke daftar.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse table-auto font-sans">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    <th className="py-3 px-3 text-center" style={{ width: '45px' }}>No</th>
                    <th className="py-3 px-3" style={{ minWidth: '220px' }}>Item Farmasi / Medis</th>
                    <th className="py-3 px-3" style={{ width: '120px' }}>No. Batch</th>
                    <th className="py-3 px-3" style={{ width: '120px' }}>Tgl Kadaluarsa</th>
                    <th className="py-3 px-3 text-right" style={{ width: '130px' }}>HPP / Unit (Rp)</th>
                    <th className="py-3 px-3 text-right" style={{ width: '120px' }}>Nilai PPN 11%</th>
                    <th className="py-3 px-3 text-right" style={{ width: '130px' }}>Harga Jual (Rp)</th>
                    <th className="py-3 px-3 text-right" style={{ width: '110px' }}>Jumlah & Satuan</th>
                    <th className="py-3 px-3 text-right" style={{ width: '140px' }}>Total (Qty × HPP)</th>
                    <th style={{ width: '90px' }} className="py-3 px-2 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {lines.map((l, index) => {
                    const item = itemMap[l.itemId]
                    const unitStr = item?.unit || item?.smallUnit || item?.satuan || item?.uom || 'Unit'
                    const warn = getExpiryWarning(l.expiryDate)
                    const hpp = parseFloat(l.unitCostPrice) || 0
                    const qty = parseFloat(l.quantityReceived) || 0
                    const lineSubtotal = hpp * qty
                    const lineDpp = lineSubtotal / (1 + ppnRate)
                    const linePpn = lineSubtotal - lineDpp

                    return (
                      <tr key={l.id} className="hover:bg-slate-50/70 transition-colors text-xs">
                        <td className="py-3 px-3 text-center font-bold text-slate-400">{index + 1}</td>
                        <td className="py-3 px-3">
                          <p className="font-bold text-slate-900">{item?.itemName || '—'}</p>
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-800">{l.batchNumber}</td>
                        <td className="py-3 px-3">
                          <span className={`font-medium ${warn?.level === 'error' ? 'text-red-600 font-bold' : warn?.level === 'warning' ? 'text-amber-600 font-bold' : 'text-slate-700'}`}>
                            {fmtDate(l.expiryDate)}
                          </span>
                          {warn && <p className={`text-[9px] mt-0.5 flex items-center gap-0.5 ${warn.level === 'error' ? 'text-red-600 font-bold' : 'text-amber-600'}`}><AlertTriangle className="w-2.5 h-2.5 flex-shrink-0" />{warn.msg}</p>}
                        </td>
                        <td className="py-3 px-3 text-right font-sans font-bold text-slate-800 tracking-tight">
                          {fmtIDR(hpp)}
                        </td>
                        <td className="py-3 px-3 text-right font-sans font-bold text-emerald-600 tracking-tight whitespace-nowrap">
                          {linePpn > 0 ? fmtIDR(linePpn) : '—'}
                        </td>
                        <td className="py-3 px-3 text-right font-sans font-bold text-amber-700 tracking-tight">
                          {fmtIDR(l.sellingPrice)}
                        </td>
                        <td className="py-3 px-3 text-right font-sans font-extrabold text-blue-700 tracking-tight whitespace-nowrap">
                          {fmtNum(qty)} <span className="text-[11px] font-semibold text-slate-500">{unitStr}</span>
                        </td>
                        <td className="py-3 px-3 text-right font-sans font-extrabold text-slate-900 tracking-tight">
                          {fmtIDR(lineSubtotal)}
                        </td>
                        <td className="py-3 px-2 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditItem(l)}
                              className="p-1.5 rounded-lg hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition-colors"
                              title="Edit rincian item (No. Batch, ED, Nama Item)"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            {!editingGrnRef && (
                              <button
                                type="button"
                                onClick={() => handleRemoveLine(l.id)}
                                className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                                title="Hapus item dari form penerimaan ini"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50/80 border-t border-slate-200 text-xs font-bold">
                    <td colSpan={8} className="py-3 px-4 text-right text-slate-600 uppercase tracking-wider">Total Nilai HPP:</td>
                    <td className="py-3 px-3 text-right font-sans font-extrabold text-primary-700 text-sm">{fmtIDR(totalValue)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 font-sans">
          <button type="button" className="btn-secondary px-5 font-bold" onClick={resetForm}>
            Reset Form
          </button>
          <button type="submit" disabled={submitting} className="btn-success px-6 shadow-lg shadow-emerald-200/50 font-bold">
            <CheckCircle className="w-4 h-4" />
            {submitting ? 'Memproses…' : editingGrnRef ? 'Update & Posting GRN' : 'Proses & Posting GRN'}
          </button>
        </div>
      </form>

      {/* Modern Riwayat & Preview Penerimaan (GRN) Table with View & Edit only (Delete removed) */}
      <div className="card font-sans">
        <div className="card-header bg-gradient-to-r from-slate-50 to-slate-100 flex items-center justify-between py-4 px-5">
          <div>
            <span className="section-title font-sans">Riwayat & Daftar Penerimaan Barang (GRN)</span>
            <p className="text-xs text-slate-500 mt-0.5 font-sans">Seluruh penerimaan tersimpan di Supabase beserta fitur View Detail & Edit</p>
          </div>
          <span className="text-xs badge badge-blue font-sans font-bold">{groupedGRNs.length} GRN</span>
        </div>
        <div className="overflow-x-auto">
          {groupedGRNs.length === 0 ? (
            <div className="text-center py-16 text-slate-400 font-sans">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Belum ada riwayat penerimaan barang di database</p>
            </div>
          ) : (
            <table className="table-base text-xs font-sans">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  <th style={{ width: '120px' }}>Tgl. Penerimaan</th>
                  <th style={{ minWidth: '220px' }}>Nama Barang</th>
                  <th style={{ width: '150px' }}>Nomor GRN</th>
                  <th style={{ width: '180px' }}>Supplier / PBF</th>
                  <th style={{ width: '110px' }} className="text-center">Jumlah Item</th>
                  <th style={{ width: '110px' }} className="text-right">Total Qty</th>
                  <th style={{ width: '150px' }} className="text-right">Nilai HPP</th>
                  <th style={{ width: '100px' }} className="text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {groupedGRNs.map(grn => {
                  const itemsCount = grn.batches.length
                  const totalQtyGrn = grn.batches.reduce((sum, b) => sum + (Number(b.quantityReceived) || 0), 0)
                  const totalValGrn = grn.batches.reduce((sum, b) => sum + (Number(b.quantityReceived) || 0) * (Number(b.unitCostPrice) || 0), 0)

                  const itemNamesList = Array.from(new Set(grn.batches.map(b => itemMap[b.itemId]?.itemName).filter(Boolean)))
                  const firstItemName = itemNamesList[0] || '—'
                  const extraItemsCount = itemNamesList.length - 1

                  return (
                    <tr key={grn.grnReference} className="hover:bg-blue-50/30 transition-colors">
                      <td className="text-slate-600 font-medium whitespace-nowrap">{fmtDate(grn.receivedAt)}</td>
                      <td className="font-bold text-slate-900">
                        <p className="line-clamp-1">{firstItemName}</p>
                        {extraItemsCount > 0 && (
                          <span className="text-[10px] text-slate-500 font-normal block mt-0.5">
                            +{extraItemsCount} barang lainnya
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="font-sans text-xs text-primary-700 font-extrabold tracking-tight">{grn.grnReference}</span>
                      </td>
                      <td className="font-bold text-slate-800">{grn.supplierName}</td>
                      <td className="text-center">
                        <span className="badge badge-purple text-[10px] px-2 py-0.5">{itemsCount} item</span>
                      </td>
                      <td className="text-right font-sans font-extrabold text-blue-700 tracking-tight">{fmtNum(totalQtyGrn)}</td>
                      <td className="text-right font-sans font-extrabold text-slate-900 tracking-tight">{fmtIDR(totalValGrn)}</td>
                      <td className="text-center whitespace-nowrap py-2">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setViewingGrn(grn)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 transition-colors"
                            title="View Detail GRN & Jurnal"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEditGRN(grn)}
                            className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-600 hover:text-amber-800 transition-colors"
                            title="Edit GRN ini (Jumlah Qty & Harga Dikunci)"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* POP-UP MULTI-ITEM INPUT FORM MODAL */}
      <Modal
        open={itemModalOpen}
        onClose={() => setItemModalOpen(false)}
        title={isSingleEdit ? 'Edit Item Penerimaan (GRN)' : 'Form Multi-Input Item Penerimaan Barang'}
        size="xl"
        footer={
          <>
            <button className="btn-secondary px-4 font-bold" onClick={() => setItemModalOpen(false)}>
              Batal
            </button>
            {isSingleEdit ? (
              <button className="btn-primary px-6 font-bold flex items-center gap-2" onClick={handleAddTempItemToModalList}>
                <CheckCircle className="w-4 h-4" /> Update Item
              </button>
            ) : (
              <button
                className="btn-success px-6 font-bold flex items-center gap-2 shadow-lg shadow-emerald-200/50"
                onClick={handleCommitModalItemsToMain}
              >
                <CheckCircle className="w-4 h-4" />
                Simpan & Masukkan {modalTempItems.length > 0 ? `${modalTempItems.length} Item` : ''} ke GRN
              </button>
            )}
          </>
        }
      >
        <div className="space-y-5 font-sans py-1">
          {editingGrnRef && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>Modus Edit GRN ({editingGrnRef}): Jumlah Kuantitas dan Harga (HPP/Harga Jual) dikunci dan tidak dapat diubah demi menjaga integritas stok & nilai jurnal.</span>
            </div>
          )}

          {/* Top Section: Form input item */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Input Details Item</span>
              <span className="text-[11px] text-slate-500 font-medium">Isi form lalu klik "+ Tambah Data Item Ke List"</span>
            </div>

            {/* Item Selection — Pure Item Name ONLY */}
            <div>
              <label className="form-label font-bold text-slate-800 text-xs">Pilih Item Farmasi / Medis *</label>
              <SearchableSelect
                value={currentItem.itemId}
                onChange={val => {
                  const selected = itemMap[val]
                  const defaultCost = Number(selected?.purchasePrice || selected?.hpp || 0)
                  setCurrentItem(prev => ({
                    ...prev,
                    itemId: val,
                    unitCostPrice: prev.unitCostPrice || (defaultCost > 0 ? defaultCost : ''),
                    sellingPrice: prev.sellingPrice || (defaultCost > 0 ? Math.round(defaultCost * 1.25) : '')
                  }))
                }}
                options={itemOptions}
                placeholder="— Pilih Nama Barang —"
                searchPlaceholder="Ketik nama barang..."
                hideValue={true}
              />
            </div>

            {/* Grid Batch & Expiry */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label font-bold text-slate-800 text-xs">No. Batch *</label>
                <input
                  type="text"
                  className="form-input text-xs font-bold font-sans text-slate-800"
                  value={currentItem.batchNumber}
                  onChange={e => setCurrentItem(prev => ({ ...prev, batchNumber: e.target.value }))}
                  placeholder="BTH-2026-001"
                />
              </div>
              <div>
                <label className="form-label font-bold text-slate-800 text-xs">Tanggal Kadaluarsa (ED) *</label>
                <input
                  type="date"
                  className="form-input text-xs font-medium font-sans text-slate-800"
                  value={currentItem.expiryDate}
                  onChange={e => setCurrentItem(prev => ({ ...prev, expiryDate: e.target.value }))}
                />
                {getExpiryWarning(currentItem.expiryDate) && (
                  <p className="text-[11px] text-amber-600 mt-1 font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> {getExpiryWarning(currentItem.expiryDate)?.msg}
                  </p>
                )}
              </div>
            </div>

            {/* Grid HPP & Nilai PPN Display — Locked if editing GRN */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label font-bold text-slate-800 text-xs flex items-center justify-between">
                  <span>HPP / Unit (Rp) * <span className="text-emerald-700 font-normal">(Include PPN 11%)</span></span>
                  {editingGrnRef && <span className="text-[10px] text-amber-700 font-bold flex items-center gap-0.5"><Lock className="w-2.5 h-2.5" /> Dikunci</span>}
                </label>
                <FormattedNumberInput
                  className="form-input text-xs py-2 text-right font-bold text-slate-800"
                  value={currentItem.unitCostPrice}
                  onChange={val => {
                    if (editingGrnRef) return
                    const hpp = parseFloat(val) || 0
                    setCurrentItem(prev => ({
                      ...prev,
                      unitCostPrice: val,
                      sellingPrice: Math.round(hpp * 1.25)
                    }))
                  }}
                  placeholder="Masukkan harga beli per unit..."
                  disabled={!!editingGrnRef}
                />
              </div>

              <div>
                <label className="form-label font-bold text-slate-800 text-xs">Nilai PPN 11% (Dikapitalisasi)</label>
                <div className="px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between">
                  <span className="text-xs font-medium">Nilai Pajak PPN:</span>
                  <span className="font-extrabold text-sm tracking-tight">{fmtIDR(currentLinePpn)}</span>
                </div>
              </div>
            </div>

            {/* Grid Selling Price & Quantity — Locked if editing GRN */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label font-bold text-slate-800 text-xs flex items-center justify-between">
                  <span>Harga Jual (Rp) *</span>
                  {editingGrnRef && <span className="text-[10px] text-amber-700 font-bold flex items-center gap-0.5"><Lock className="w-2.5 h-2.5" /> Dikunci</span>}
                </label>
                <FormattedNumberInput
                  className="form-input text-xs py-2 text-right font-bold text-amber-700"
                  value={currentItem.sellingPrice}
                  onChange={val => {
                    if (editingGrnRef) return
                    setCurrentItem(prev => ({ ...prev, sellingPrice: val }))
                  }}
                  placeholder="Masukkan harga jual..."
                  disabled={!!editingGrnRef}
                />
                <p className="text-[10px] text-slate-400 mt-1">Default otomatis: HPP + Margin 25%</p>
              </div>
              <div>
                <label className="form-label font-bold text-slate-800 text-xs flex items-center justify-between">
                  <span>Jumlah Penerimaan ({currentUnitStr}) *</span>
                  {editingGrnRef && <span className="text-[10px] text-amber-700 font-bold flex items-center gap-0.5"><Lock className="w-2.5 h-2.5" /> Dikunci</span>}
                </label>
                <FormattedNumberInput
                  className="form-input text-xs py-2 text-right font-extrabold text-blue-700"
                  value={currentItem.quantityReceived}
                  onChange={val => {
                    if (editingGrnRef) return
                    setCurrentItem(prev => ({ ...prev, quantityReceived: val }))
                  }}
                  placeholder="1"
                  disabled={!!editingGrnRef}
                />
              </div>
            </div>

            {/* Action Button inside Form: Add Item to Temporary Modal List */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
              <div className="text-xs font-bold text-slate-700">
                Subtotal Baris: <span className="text-emerald-700 font-extrabold text-sm">{fmtIDR(currentSubtotal)}</span>
              </div>
              {!isSingleEdit && (
                <button
                  type="button"
                  onClick={handleAddTempItemToModalList}
                  className="btn-primary text-xs py-2 px-4 font-bold flex items-center gap-1.5 shadow-md"
                >
                  <ListPlus className="w-4 h-4" />+ Tambah Data Item Ke List
                </button>
              )}
            </div>
          </div>

          {/* Middle Section: Temporary List inside Modal (Multi-add mode) */}
          {!isSingleEdit && (
            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
              <div className="bg-slate-100/90 py-2.5 px-4 flex items-center justify-between border-b border-slate-200">
                <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <ListPlus className="w-4 h-4 text-primary-600" /> List Item Sementara Dalam Form ({modalTempItems.length})
                </span>
                {modalTempItems.length > 0 && (
                  <span className="text-xs font-extrabold text-emerald-700">
                    Total: {fmtIDR(modalTempItems.reduce((sum, t) => sum + (t.unitCostPrice * t.quantityReceived), 0))}
                  </span>
                )}
              </div>

              {modalTempItems.length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-xs font-medium">
                  Belum ada item di list sementara form. Isi form di atas dan klik "+ Tambah Data Item Ke List".
                </div>
              ) : (
                <div className="max-h-56 overflow-y-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] font-bold text-slate-600 uppercase border-b border-slate-200">
                        <th className="py-2 px-3 text-center">No</th>
                        <th className="py-2 px-3">Nama Barang</th>
                        <th className="py-2 px-3">No. Batch & ED</th>
                        <th className="py-2 px-3 text-right">HPP / Unit</th>
                        <th className="py-2 px-3 text-right">Jumlah & Satuan</th>
                        <th className="py-2 px-3 text-right">Total</th>
                        <th className="py-2 px-2 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {modalTempItems.map((item, idx) => {
                        const obj = itemMap[item.itemId]
                        const uStr = obj?.unit || obj?.smallUnit || obj?.satuan || obj?.uom || 'Unit'
                        const sub = item.unitCostPrice * item.quantityReceived
                        return (
                          <tr key={item.id} className="hover:bg-slate-50">
                            <td className="py-2 px-3 text-center font-bold text-slate-400">{idx + 1}</td>
                            <td className="py-2 px-3 font-bold text-slate-800">{obj?.itemName || '—'}</td>
                            <td className="py-2 px-3 font-mono text-[11px]">
                              {item.batchNumber} <span className="text-slate-400">({fmtDate(item.expiryDate)})</span>
                            </td>
                            <td className="py-2 px-3 text-right font-bold">{fmtIDR(item.unitCostPrice)}</td>
                            <td className="py-2 px-3 text-right font-bold text-blue-700">
                              {fmtNum(item.quantityReceived)} {uStr}
                            </td>
                            <td className="py-2 px-3 text-right font-extrabold text-slate-900">{fmtIDR(sub)}</td>
                            <td className="py-2 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveTempItem(item.id)}
                                className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
                                title="Hapus dari list sementara"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* VIEW GRN DETAIL MODAL */}
      <Modal
        open={!!viewingGrn}
        onClose={() => setViewingGrn(null)}
        title={`Detail Penerimaan — ${viewingGrn?.grnReference}`}
        size="xl"
      >
        {viewingGrn && (
          <div className="space-y-5 font-sans">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 text-xs">
              <div>
                <span className="text-slate-400 font-medium">No. GRN:</span>
                <p className="font-extrabold text-slate-800 text-sm mt-0.5">{viewingGrn.grnReference}</p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Tgl. Penerimaan:</span>
                <p className="font-bold text-slate-800 mt-0.5">{fmtDate(viewingGrn.receivedAt)}</p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Supplier / PBF:</span>
                <p className="font-bold text-slate-800 mt-0.5">{viewingGrn.supplierName}</p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">ID Jurnal:</span>
                <p className="font-mono text-slate-700 font-bold mt-0.5 text-[11px]">{viewingGrn.journalEntryId || '—'}</p>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase">
                    <th className="py-2.5 px-3">Item Farmasi</th>
                    <th className="py-2.5 px-3">No. Batch</th>
                    <th className="py-2.5 px-3">Tgl Kadaluarsa</th>
                    <th className="py-2.5 px-3 text-right">HPP / Unit</th>
                    <th className="py-2.5 px-3 text-right">Harga Jual</th>
                    <th className="py-2.5 px-3 text-right">Jumlah & Satuan</th>
                    <th className="py-2.5 px-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {viewingGrn.batches.map(b => {
                    const item = itemMap[b.itemId]
                    const uStr = item?.unit || item?.smallUnit || item?.satuan || item?.uom || 'Unit'
                    const total = (Number(b.quantityReceived) || 0) * (Number(b.unitCostPrice) || 0)
                    return (
                      <tr key={b.id}>
                        <td className="py-2.5 px-3 font-bold text-slate-800">{item?.itemName || '—'}</td>
                        <td className="py-2.5 px-3 font-mono">{b.batchNumber}</td>
                        <td className="py-2.5 px-3 font-medium">{fmtDate(b.expiryDate)}</td>
                        <td className="py-2.5 px-3 text-right font-bold">{fmtIDR(b.unitCostPrice)}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-amber-700">{fmtIDR(b.sellingPrice)}</td>
                        <td className="py-2.5 px-3 text-right font-extrabold text-blue-700">{fmtNum(b.quantityReceived)} {uStr}</td>
                        <td className="py-2.5 px-3 text-right font-extrabold text-slate-900">{fmtIDR(total)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
