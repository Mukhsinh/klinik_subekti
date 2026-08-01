import { useState, useMemo, useEffect } from 'react'
import { useStore } from '../../store/useStore'
import {
  fetchStockLedger,
  fetchStockOutflows,
  fetchStockOutflowItems,
  insertStockOutflow,
  insertStockOutflowItems,
  updateStockOutflow,
  fetchBillings,
  fetchAllBillingItems,
  fetchPharmacyItems,
  fetchBatches,
  updateBatchQty,
  insertStockLedger,
  upsertJournalEntry,
  insertJournalItems,
  fetchBranches,
} from '../../lib/db'
import { Plus, Eye, Trash2, CheckCircle, Package, TrendingDown, Layers } from 'lucide-react'
import Modal from '../../components/ui/Modal'
import SearchInput from '../../components/ui/SearchInput'
import SearchableSelect from '../../components/ui/SearchableSelect'
import { StatusBadge } from '../../components/ui/Badge'
import { fmtIDR, fmtDate, fmtNum, todayISO } from '../../utils/format'
import { calculateFifoValuation, depleteFefoPhysicalStock } from '../../lib/inventoryEngine'
import toast from 'react-hot-toast'
import { v4 as uuidv4 } from 'uuid'

const OUTFLOW_TYPES = [
  { value: 'INTERNAL_USE', label: 'Pemakaian Internal / Operasional' },
  { value: 'DONATION', label: 'Donasi' },
  { value: 'SAMPLE', label: 'Sampel Gratis' },
  { value: 'WASTE', label: 'Barang Rusak/Terbuang' },
  { value: 'OTHER', label: 'Lainnya' }
]

export default function StockOutflowPage() {
  const {
    pharmacyItems, invBatches, stockLedger, billings, billingItems,
    branches, activeBranchId
  } = useStore()

  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')

  const [dbStockLedger, setDbStockLedger] = useState([])
  const [dbBillings, setDbBillings] = useState([])
  const [dbBillingItems, setDbBillingItems] = useState([])
  const [dbOutflows, setDbOutflows] = useState([])
  const [dbOutflowItems, setDbOutflowItems] = useState([])
  const [dbPharmacyItems, setDbPharmacyItems] = useState([])
  const [dbBatches, setDbBatches] = useState([])
  const [dbBranches, setDbBranches] = useState([])

  const loadLiveDbData = async () => {
    try {
      const [ledgerData, billingData, bItemsData, outflowData, outflowItemsData, pharmacyData, batchData, branchData] = await Promise.all([
        fetchStockLedger().catch(() => []),
        fetchBillings().catch(() => []),
        fetchAllBillingItems().catch(() => []),
        fetchStockOutflows().catch(() => []),
        fetchStockOutflowItems().catch(() => []),
        fetchPharmacyItems().catch(() => []),
        fetchBatches().catch(() => []),
        fetchBranches().catch(() => []),
      ])
      if (Array.isArray(ledgerData)) setDbStockLedger(ledgerData)
      if (Array.isArray(billingData)) setDbBillings(billingData)
      if (Array.isArray(bItemsData)) setDbBillingItems(bItemsData)
      if (Array.isArray(outflowData)) setDbOutflows(outflowData)
      if (Array.isArray(outflowItemsData)) setDbOutflowItems(outflowItemsData)
      if (Array.isArray(pharmacyData)) setDbPharmacyItems(pharmacyData)
      if (Array.isArray(batchData)) setDbBatches(batchData)
      if (Array.isArray(branchData)) setDbBranches(branchData)
    } catch (err) {
      console.warn('[StockOutflowPage] Error loading live database:', err.message)
    }
  }

  useEffect(() => {
    let isMounted = true
    loadLiveDbData()
    return () => { isMounted = false }
  }, [])

  // Form states
  const [outflowDate, setOutflowDate] = useState(todayISO())
  const [outflowType, setOutflowType] = useState('INTERNAL_USE')
  const [description, setDescription] = useState('')
  const [items, setItems] = useState([])

  const effectiveBranchId = useMemo(() => {
    return activeBranchId || (dbBranches && dbBranches[0]?.id) || (branches && branches[0]?.id) || 'f265df27-e277-4775-8b1d-5f28e585599a'
  }, [activeBranchId, dbBranches, branches])

  const outflows = dbOutflows
  const outflowItems = dbOutflowItems

  const outflowNumber = useMemo(() => {
    const d = new Date()
    const ym = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`
    return `OUT/${ym}/${String((outflows || []).length + 1).padStart(5, '0')}`
  }, [outflows])

  const activePharmacyItems = useMemo(() => {
    const list = dbPharmacyItems.length > 0 ? dbPharmacyItems : (pharmacyItems || [])
    return list.filter(i => (i.isActive !== false && i.is_active !== false))
  }, [dbPharmacyItems, pharmacyItems])

  const activeBatches = useMemo(() => {
    return dbBatches.length > 0 ? dbBatches : (invBatches || [])
  }, [dbBatches, invBatches])

  const getItemStock = (itemId) => {
    if (!itemId) return 0

    // 1. Calculate stock from inventory batches
    const batchList = activeBatches || []
    const batchStock = batchList
      .filter(b => (b.itemId === itemId || b.item_id === itemId) && Number(b.quantityCurrent ?? b.quantity_current ?? 0) > 0)
      .reduce((sum, b) => sum + Number(b.quantityCurrent ?? b.quantity_current ?? 0), 0)

    // 2. Calculate stock from stock ledger cards (Kartu Stok)
    const ledgerSource = dbStockLedger.length > 0 ? dbStockLedger : (stockLedger || [])
    const bItemsSource = dbBillingItems.length > 0 ? dbBillingItems : (billingItems || [])

    const itemLedger = ledgerSource.filter(l => (l.itemId === itemId || l.item_id === itemId))

    const saldoAwal = itemLedger
      .filter(l => (l.transactionType === 'SALDO_AWAL' || l.transaction_type === 'SALDO_AWAL'))
      .reduce((sum, l) => sum + Number(l.quantityIn ?? l.quantity_in ?? 0), 0)

    const penerimaan = itemLedger
      .filter(l => (l.transactionType !== 'SALDO_AWAL' && l.transaction_type !== 'SALDO_AWAL'))
      .reduce((sum, l) => sum + Number(l.quantityIn ?? l.quantity_in ?? 0), 0)

    const pengeluaran = itemLedger
      .reduce((sum, l) => sum + Number(l.quantityOut ?? l.quantity_out ?? 0), 0)

    const processedBillingKeys = new Set(
      itemLedger.filter(l => (l.transactionType === 'BILLING' || l.transaction_type === 'BILLING')).map(l => l.referenceNumber || l.reference_number)
    )

    let extraBillingOut = 0
    if (Array.isArray(bItemsSource)) {
      bItemsSource.forEach(bi => {
        const biItemId = bi.pharmacyItemId || bi.pharmacy_item_id || bi.itemId || bi.item_id
        if (biItemId === itemId) {
          const billing = (dbBillings || []).find(b => b.id === (bi.billingId || bi.billing_id))
          const refNo = billing?.billingNumber || billing?.billing_number
          if (!refNo || !processedBillingKeys.has(refNo)) {
            extraBillingOut += Number(bi.quantity || 1)
          }
        }
      })
    }

    const ledgerBalance = Math.max(0, saldoAwal + penerimaan - (pengeluaran + extraBillingOut))

    return batchStock > 0 ? batchStock : ledgerBalance
  }

  const pharmacyOptions = useMemo(() =>
    [...activePharmacyItems]
      .sort((a, b) => {
        const stkA = getItemStock(a.id)
        const stkB = getItemStock(b.id)
        if (stkA > 0 && stkB === 0) return -1
        if (stkA === 0 && stkB > 0) return 1
        const nameA = a.itemName || a.item_name || ''
        const nameB = b.itemName || b.item_name || ''
        return nameA.localeCompare(nameB)
      })
      .map(i => {
        const name = i.itemName || i.item_name || 'Item Tanpa Nama'
        const code = i.itemCode || i.item_code || i.skuCode || i.sku_code || '—'
        const cat = i.category || 'Obat'
        const unit = i.baseUnit || i.base_unit || 'Unit'
        const stk = getItemStock(i.id)
        return {
          value: i.id,
          label: name,
          sub: `Kode: ${code} | Kat: ${cat} | Satuan: ${unit}`,
          group: stk > 0 ? 'Item Tersedia (Kartu Stok)' : 'Stok Kosong (0 Unit)',
          stock: stk,
          unit: unit,
          stockBadge: (
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${stk > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'
              }`}>
              {stk > 0 ? `Stok: ${fmtNum(stk)} ${unit}` : `Stok: 0 ${unit}`}
            </span>
          ),
          disabled: false
        }
      }),
    [activePharmacyItems, activeBatches, dbStockLedger, stockLedger, dbBillingItems, dbBillings]
  )

  // Consolidate billing-related outflows from live database stock ledger & billing_items
  const billingOutflows = useMemo(() => {
    const ledgerSource = dbStockLedger.length > 0 ? dbStockLedger : (stockLedger || [])
    const billingSource = dbBillings.length > 0 ? dbBillings : (billings || [])
    const bItemsSource = dbBillingItems.length > 0 ? dbBillingItems : (billingItems || [])
    const pharmacySource = activePharmacyItems

    const list = []
    const processedKeys = new Set()

    if (Array.isArray(ledgerSource)) {
      ledgerSource
        .filter(s => s.transactionType === 'BILLING' && (s.quantityOut || s.quantity_out) > 0)
        .forEach(s => {
          const sItemId = s.itemId || s.item_id
          const item = pharmacySource.find(p => p.id === sItemId)
          const sRef = s.referenceNumber || s.reference_number || '-'
          const billing = billingSource.find(b => b.billingNumber === sRef || b.billing_number === sRef)
          const key = `${sRef}_${sItemId}`
          processedKeys.add(key)

          const qOut = Number(s.quantityOut ?? s.quantity_out ?? 0)
          const uCost = Number(s.unitCost ?? s.unit_cost ?? 0)

          list.push({
            id: s.id,
            date: s.loggedAt || s.logged_at || s.transactionDate || s.transaction_date,
            referenceNumber: sRef,
            itemName: item?.itemName || item?.item_name || 'Obat / BHP Kasir',
            quantity: qOut,
            unitCost: uCost,
            totalValue: Number(s.totalValue ?? s.total_value ?? (qOut * uCost)),
            source: 'BILLING',
            patientName: billing?.patientName || billing?.patient_name || '-'
          })
        })
    }

    if (Array.isArray(bItemsSource)) {
      bItemsSource
        .filter(bi => bi.itemType === 'PHARMACY' || bi.item_type === 'PHARMACY' || bi.pharmacyItemId || bi.pharmacy_item_id)
        .forEach(bi => {
          const biBillingId = bi.billingId || bi.billing_id
          const billing = billingSource.find(b => b.id === biBillingId)
          if (!billing) return

          const itemId = bi.pharmacyItemId || bi.pharmacy_item_id || bi.itemId || bi.item_id
          const bNum = billing.billingNumber || billing.billing_number || '-'
          const key = `${bNum}_${itemId}`

          if (!processedKeys.has(key)) {
            processedKeys.add(key)
            const item = pharmacySource.find(p => p.id === itemId)
            const qty = Number(bi.quantity || 1)
            const unitPrice = Number(bi.unitPrice ?? bi.unit_price ?? bi.price ?? 0)
            const itemCost = Number(item?.purchasePrice || item?.purchase_price || item?.hpp || unitPrice)

            list.push({
              id: bi.id,
              date: billing.visitDate || billing.visit_date || billing.createdAt || billing.created_at,
              referenceNumber: bNum,
              itemName: bi.itemName || bi.item_name || item?.itemName || item?.item_name || 'Obat / BHP Kasir',
              quantity: qty,
              unitCost: itemCost,
              totalValue: qty * itemCost,
              source: 'BILLING',
              patientName: billing.patientName || billing.patient_name || '-'
            })
          }
        })
    }

    return list.sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [dbStockLedger, stockLedger, dbBillings, billings, dbBillingItems, billingItems, activePharmacyItems])

  const addItem = () => {
    setItems(prev => [...prev, {
      id: uuidv4(),
      itemId: '',
      itemName: '',
      quantity: 1,
      unitCost: 0,
      totalCost: 0,
      unit: 'Unit',
      notes: ''
    }])
  }

  const removeItem = (id) => {
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const updateItem = (id, field, value) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item

      const updated = { ...item, [field]: value }
      const targetItemId = field === 'itemId' ? value : updated.itemId
      const reqQty = field === 'quantity' ? Math.max(1, parseInt(value) || 1) : Math.max(1, parseInt(updated.quantity) || 1)

      if (targetItemId) {
        const pharmacyItem = activePharmacyItems.find(p => p.id === targetItemId)
        if (pharmacyItem) {
          updated.itemName = pharmacyItem.itemName || pharmacyItem.item_name
          updated.unit = pharmacyItem.baseUnit || pharmacyItem.base_unit || 'Unit'
          const defaultCost = Number(pharmacyItem.purchasePrice || pharmacyItem.purchase_price || pharmacyItem.hpp || 0)

          const itemBatches = activeBatches.filter(b => (b.itemId === targetItemId || b.item_id === targetItemId) && Number(b.quantityCurrent ?? b.quantity_current ?? 0) > 0)

          const { totalValuation, avgUnitCost } = calculateFifoValuation(itemBatches, reqQty, defaultCost)
          updated.quantity = reqQty
          updated.unitCost = avgUnitCost
          updated.totalCost = totalValuation
        }
      }

      if (field === 'unitCost') {
        const cost = parseFloat(value) || 0
        updated.unitCost = cost
        updated.totalCost = (parseFloat(updated.quantity) || 0) * cost
      }

      return updated
    }))
  }

  const resetForm = () => {
    setOutflowDate(todayISO())
    setOutflowType('INTERNAL_USE')
    setDescription('')
    setItems([{
      id: uuidv4(),
      itemId: '',
      itemName: '',
      quantity: 1,
      unitCost: 0,
      totalCost: 0,
      unit: 'Unit',
      notes: ''
    }])
  }

  // Direct database saving with FEFO physical stock depletion + FIFO accounting valuation
  const handleSave = async () => {
    if (!description.trim()) {
      toast.error('Deskripsi wajib diisi')
      return
    }

    const validItems = items.filter(i => i.itemId && Number(i.quantity) > 0)
    if (validItems.length === 0) {
      toast.error('Minimal harus ada 1 item valid')
      return
    }

    for (const item of validItems) {
      const available = getItemStock(item.itemId)
      if (available === 0) {
        toast.error(`Stok "${item.itemName}" kosong (0 unit). Tidak dapat mengeluarkan barang ini.`)
        return
      }
      if (item.quantity > available) {
        toast.error(`Stok "${item.itemName}" tidak mencukupi. Stok Tersedia: ${available}, Diminta: ${item.quantity}`)
        return
      }
    }

    // Calculate total value using FIFO accounting valuation
    let totalVal = 0
    const processedItems = validItems.map(item => {
      const pharmacyItem = activePharmacyItems.find(p => p.id === item.itemId)
      const defaultCost = Number(pharmacyItem?.purchasePrice || pharmacyItem?.purchase_price || pharmacyItem?.hpp || item.unitCost || 0)
      const itemBatches = activeBatches.filter(b => (b.itemId === item.itemId || b.item_id === item.itemId) && Number(b.quantityCurrent ?? b.quantity_current ?? 0) > 0)

      const { totalValuation, avgUnitCost, fifoBreakdown } = calculateFifoValuation(itemBatches, item.quantity, defaultCost)
      totalVal += totalValuation

      return {
        ...item,
        unitCost: avgUnitCost,
        totalCost: totalValuation,
        fifoBreakdown
      }
    })

    const now = new Date().toISOString()
    const outflowId = uuidv4()
    const journalId = uuidv4()

    try {
      const outflowEntry = {
        id: outflowId,
        branchId: effectiveBranchId,
        outflowNumber,
        outflowDate,
        outflowType,
        description,
        totalValue: totalVal,
        status: 'POSTED',
        journalEntryId: journalId,
        createdBy: 'System',
        createdAt: now,
        updatedAt: now,
      }

      const outflowItemsList = processedItems.map(item => ({
        id: uuidv4(),
        outflowId,
        itemId: item.itemId,
        itemName: item.itemName,
        quantity: Number(item.quantity || 1),
        unitCost: Number(item.unitCost || 0),
        totalCost: Number(item.totalCost || 0),
        notes: item.notes || '',
      }))

      // 1. FEFO Physical Stock Depletion
      // 2. FIFO Stock Ledger Entry Logging
      const ledgerEntries = []

      for (const item of processedItems) {
        const itemBatches = activeBatches.filter(b => (b.itemId === item.itemId || b.item_id === item.itemId) && Number(b.quantityCurrent ?? b.quantity_current ?? 0) > 0)

        // Physical Depletion via FEFO (earliest expiry date)
        const physicalUpdates = depleteFefoPhysicalStock(itemBatches, item.quantity)
        for (const update of physicalUpdates) {
          if (update.batchId) {
            await updateBatchQty(update.batchId, update.newQtyCurrent)
          }
        }

        // Ledger logging using FIFO valuation breakdown
        let currentItemBalance = getItemStock(item.itemId)
        for (const fifoPart of item.fifoBreakdown) {
          currentItemBalance -= fifoPart.qty
          ledgerEntries.push({
            id: uuidv4(),
            batchId: fifoPart.batchId,
            itemId: item.itemId,
            transactionType: 'OUTFLOW',
            referenceId: outflowId,
            referenceNumber: outflowNumber,
            quantityIn: 0,
            quantityOut: fifoPart.qty,
            balanceAfter: Math.max(0, currentItemBalance),
            unitCost: Number(fifoPart.unitCost || 0),
            totalValue: Number(fifoPart.totalCost || 0),
            notes: `Pengeluaran ${outflowType} (${outflowNumber}) [FEFO Physical / FIFO Cost]`,
            loggedAt: now,
          })
        }
      }

      if (ledgerEntries.length > 0) {
        await insertStockLedger(ledgerEntries)
      }

      // Journal entry creation
      const OUTFLOW_EXPENSE_MAP = {
        INTERNAL_USE: '6-18-001',
        SAMPLE: '6-13-001',
        DONATION: '6-91-002',
        WASTE: '6-91-003',
        OTHER: '6-18-001',
      }
      const targetExpenseAccount = OUTFLOW_EXPENSE_MAP[outflowType] || '6-18-001'
      const entryNumber = `OUT/${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}/${Math.floor(10000 + Math.random() * 90000)}`

      const inventoryCredits = {}
      processedItems.forEach(item => {
        const pharmacyItem = activePharmacyItems.find(p => p.id === item.itemId)
        const isBHP = pharmacyItem?.category === 'BHP' || pharmacyItem?.category === 'PEMAKAIAN BHP' || (pharmacyItem?.itemCode || pharmacyItem?.item_code || '').startsWith('BHP-')
        const accCode = pharmacyItem?.coaInventoryCode || pharmacyItem?.coa_inventory_code || (isBHP ? '1-13-003' : '1-13-001')
        inventoryCredits[accCode] = (inventoryCredits[accCode] || 0) + (item.totalCost || 0)
      })

      const journalItemsList = [
        {
          id: uuidv4(),
          journalEntryId: journalId,
          accountCode: targetExpenseAccount,
          description: `Beban Pengeluaran Stok ${outflowType} — ${outflowNumber}`,
          debit: totalVal,
          credit: 0
        }
      ]

      Object.entries(inventoryCredits).forEach(([accCode, val]) => {
        if (val > 0) {
          journalItemsList.push({
            id: uuidv4(),
            journalEntryId: journalId,
            accountCode: accCode,
            description: `Pengurangan Persediaan — ${outflowNumber}`,
            debit: 0,
            credit: val
          })
        }
      })

      const journalHeader = {
        id: journalId,
        branchId: effectiveBranchId,
        entryNumber,
        transactionDate: outflowDate,
        description: `Pengeluaran Stok ${outflowType} — ${description}`,
        entryType: 'STOCK_OUTFLOW',
        status: 'POSTED',
        totalDebit: totalVal,
        totalCredit: totalVal,
        createdBy: 'System',
        postedBy: 'System',
        postedAt: now,
        createdAt: now,
        updatedAt: now,
      }

      // Persist directly to Supabase database (Strict Foreign Key Dependency Order)
      await upsertJournalEntry(journalHeader)
      await insertJournalItems(journalItemsList)
      await insertStockOutflow(outflowEntry)
      await insertStockOutflowItems(outflowItemsList)

      toast.success('Pengeluaran stok berhasil disimpan ke database Supabase!')
      setModal(null)
      resetForm()

      // Reload live DB data to update UI instantly
      await loadLiveDbData()
    } catch (err) {
      console.error('[StockOutflow handleSave Error]', err)
      toast.error(err.message || 'Gagal menyimpan pengeluaran stok')
    }
  }

  const filtered = useMemo(() => {
    const outflowsArray = Array.isArray(outflows) ? outflows : []
    let result = outflowsArray

    if (statusFilter !== 'ALL') {
      result = result.filter(o => o.status === statusFilter)
    }

    if (search) {
      result = result.filter(o =>
        o.outflowNumber?.toLowerCase().includes(search.toLowerCase()) ||
        o.description?.toLowerCase().includes(search.toLowerCase())
      )
    }

    return result.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0)
      const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0)
      return dateB - dateA
    })
  }, [outflows, statusFilter, search])

  const selectedItems = useMemo(() => {
    if (!selected?.id) return []
    return (outflowItems || []).filter(i => String(i.outflowId) === String(selected.id))
  }, [outflowItems, selected])

  const totalQtyOut = useMemo(() => {
    const manualQty = (outflowItems || []).reduce((sum, i) => sum + (parseFloat(i.quantity) || 0), 0)
    const billingQty = (billingOutflows || []).reduce((sum, i) => sum + (parseFloat(i.quantity) || 0), 0)
    return manualQty + billingQty
  }, [outflowItems, billingOutflows])

  const totalValueOut = useMemo(() => {
    const manualVal = (outflows || []).reduce((sum, o) => sum + (parseFloat(o.totalValue) || 0), 0)
    const billingVal = (billingOutflows || []).reduce((sum, o) => sum + (parseFloat(o.totalValue) || 0), 0)
    return manualVal + billingVal
  }, [outflows, billingOutflows])

  const totalValue = items.reduce((sum, i) => sum + (i.totalCost || 0), 0)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title font-sans">Pengeluaran Stok</h1>
          <p className="text-sm text-slate-400 mt-0.5 font-sans">
            Pencatatan pengeluaran stok non-billing dan riwayat dari transaksi kasir
          </p>
        </div>
        <button className="btn-primary font-sans" onClick={() => { resetForm(); setModal('new') }}>
          <Plus className="w-4 h-4" />Pengeluaran Baru
        </button>
      </div>

      {/* Modern Compact Score Cards — Model Angka Terintegrasi */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-sans">Total Outflow Manual</p>
              <p className="text-xl font-extrabold text-slate-800 tracking-tight font-sans mt-0.5">
                {fmtNum((outflows || []).length)} <span className="text-xs font-semibold text-slate-400 font-sans">transaksi</span>
              </p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-sans">Total Kuantitas Outflow</p>
              <p className="text-xl font-extrabold text-blue-700 tracking-tight font-sans mt-0.5">
                {fmtNum(totalQtyOut)} <span className="text-xs font-semibold text-slate-400 font-sans">unit</span>
              </p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-sans">Total Nilai HPP</p>
              <p className="text-xl font-extrabold text-purple-700 tracking-tight font-mono mt-0.5">
                {fmtIDR(totalValueOut)}
              </p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-sans">Riwayat Billing Kasir</p>
              <p className="text-xl font-extrabold text-emerald-700 tracking-tight font-sans mt-0.5">
                {fmtNum(billingOutflows.length)} <span className="text-xs font-semibold text-slate-400 font-sans">item</span>
              </p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="card">
        <div className="border-b border-slate-200">
          <div className="flex gap-1 px-4">
            <button
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors font-sans ${modal !== 'billing' ? 'border-primary-600 text-primary-700' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              onClick={() => setModal(null)}
            >
              <Package className="w-4 h-4 inline mr-2" />
              Pengeluaran Manual ({fmtNum(filtered.length)})
            </button>
            <button
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors font-sans ${modal === 'billing' ? 'border-primary-600 text-primary-700' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              onClick={() => setModal('billing')}
            >
              <TrendingDown className="w-4 h-4 inline mr-2" />
              Riwayat dari Billing ({fmtNum(billingOutflows.length)})
            </button>
          </div>
        </div>

        {/* Manual Outflows Tab */}
        {modal !== 'billing' && (
          <>
            <div className="card-body border-b border-slate-100">
              <div className="flex flex-wrap gap-3 items-center">
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder="Cari nomor atau deskripsi..."
                  className="w-64"
                />
                <select
                  className="form-select w-40"
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                >
                  <option value="ALL">Semua Status</option>
                  <option value="DRAFT">Draft</option>
                  <option value="POSTED">Posted</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
                <span className="ml-auto text-sm text-slate-400 font-sans">{fmtNum(filtered.length)} pengeluaran</span>
              </div>
            </div>
            <div className="w-full">
              <table className="w-full text-left border-collapse table-auto">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    <th className="py-2.5 px-2.5" style={{ width: '140px' }}>No. Pengeluaran</th>
                    <th className="py-2.5 px-2.5" style={{ width: '100px' }}>Tanggal</th>
                    <th className="py-2.5 px-2.5" style={{ width: '150px' }}>Tipe</th>
                    <th className="py-2.5 px-2.5" style={{ minWidth: '180px' }}>Deskripsi</th>
                    <th className="py-2.5 px-2.5 text-right" style={{ width: '120px' }}>Total Nilai</th>
                    <th className="py-2.5 px-2.5" style={{ width: '90px' }}>Status</th>
                    <th style={{ width: '40px' }} className="py-2.5 px-1 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white text-[11px]">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-400">
                        Belum ada pengeluaran stok manual di database
                      </td>
                    </tr>
                  ) : (
                    filtered.map(o => (
                      <tr key={o.id} className="hover:bg-slate-50">
                        <td className="py-2 px-2.5 font-mono text-[11px] text-primary-700 font-bold whitespace-nowrap">{o.outflowNumber}</td>
                        <td className="py-2 px-2.5 text-[11px] whitespace-nowrap">{fmtDate(o.outflowDate)}</td>
                        <td className="py-2 px-2.5 whitespace-nowrap">
                          <span className="badge badge-purple text-[10px] px-2 py-0.5">
                            {OUTFLOW_TYPES.find(t => t.value === o.outflowType)?.label || o.outflowType}
                          </span>
                        </td>
                        <td className="py-2 px-2.5 text-[11px] text-slate-700">{o.description}</td>
                        <td className="py-2 px-2.5 text-right font-sans text-[11px] font-extrabold text-slate-800 whitespace-nowrap">{fmtIDR(o.totalValue)}</td>
                        <td className="py-2 px-2.5 whitespace-nowrap"><StatusBadge status={o.status} /></td>
                        <td className="py-2 px-1 text-center whitespace-nowrap">
                          <button
                            className="btn-ghost p-1"
                            onClick={() => { setSelected(o); setModal('view') }}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Billing Outflows Tab */}
        {modal === 'billing' && (
          <div className="w-full">
            <table className="w-full text-left border-collapse table-auto">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  <th className="py-2.5 px-2.5" style={{ width: '100px' }}>Tanggal</th>
                  <th className="py-2.5 px-2.5" style={{ width: '130px' }}>No. Billing</th>
                  <th className="py-2.5 px-2.5" style={{ minWidth: '130px' }}>Nama Pasien</th>
                  <th className="py-2.5 px-2.5" style={{ minWidth: '160px' }}>Item</th>
                  <th className="py-2.5 px-2.5 text-right" style={{ width: '60px' }}>Qty</th>
                  <th className="py-2.5 px-2.5 text-right" style={{ width: '110px' }}>Harga Pokok</th>
                  <th className="py-2.5 px-2.5 text-right" style={{ width: '120px' }}>Total Nilai</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white text-[11px]">
                {billingOutflows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400">
                      Belum ada pengeluaran dari billing
                    </td>
                  </tr>
                ) : (
                  billingOutflows.map(o => (
                    <tr key={o.id} className="hover:bg-slate-50">
                      <td className="py-2 px-2.5 text-[11px] whitespace-nowrap">{fmtDate(o.date)}</td>
                      <td className="py-2 px-2.5 font-mono text-[11px] text-primary-700 font-bold whitespace-nowrap">{o.referenceNumber}</td>
                      <td className="py-2 px-2.5 text-[11px] font-medium text-slate-800">{o.patientName}</td>
                      <td className="py-2 px-2.5 text-[11px] text-slate-700">{o.itemName}</td>
                      <td className="py-2 px-2.5 text-right font-sans text-[11px] font-bold text-slate-800 whitespace-nowrap">{fmtNum(o.quantity)}</td>
                      <td className="py-2 px-2.5 text-right font-sans text-[11px] font-medium text-slate-700 whitespace-nowrap">{fmtIDR(o.unitCost)}</td>
                      <td className="py-2 px-2.5 text-right font-sans text-[11px] font-extrabold text-slate-800 whitespace-nowrap">{fmtIDR(o.totalValue)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {billingOutflows.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-50 text-[11px] font-semibold">
                    <td colSpan={6} className="py-2.5 px-2.5 text-right pr-4">TOTAL NILAI HPP</td>
                    <td className="py-2.5 px-2.5 text-right font-mono text-primary-700 font-bold">
                      {fmtIDR(billingOutflows.reduce((sum, o) => sum + o.totalValue, 0))}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {/* New Outflow Modal */}
      <Modal
        open={modal === 'new'}
        onClose={() => setModal(null)}
        title={`Pengeluaran Stok Baru — ${outflowNumber}`}
        size="xl"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModal(null)}>Batal</button>
            <button className="btn-success" onClick={handleSave}>
              <CheckCircle className="w-4 h-4" />Simpan Pengeluaran
            </button>
          </>
        }
      >
        <div className="space-y-5">
          {/* Header Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="form-label">Tanggal Pengeluaran *</label>
              <input
                type="date"
                className="form-input"
                value={outflowDate}
                onChange={e => setOutflowDate(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Tipe Pengeluaran *</label>
              <select
                className="form-select"
                value={outflowType}
                onChange={e => setOutflowType(e.target.value)}
              >
                {OUTFLOW_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-1">
              <label className="form-label">No. Pengeluaran</label>
              <input
                type="text"
                className="form-input bg-slate-50"
                value={outflowNumber}
                disabled
              />
            </div>
          </div>

          <div>
            <label className="form-label">Deskripsi / Keterangan *</label>
            <textarea
              className="form-input"
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Jelaskan tujuan atau alasan pengeluaran stok ini..."
            />
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="form-label mb-0">Item yang Dikeluarkan *</label>
              <button type="button" className="btn-ghost text-xs py-1" onClick={addItem}>
                <Plus className="w-3.5 h-3.5" />Tambah Item
              </button>
            </div>

            {items.length > 0 && (
              <div className="border border-slate-200 rounded-xl overflow-visible">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th style={{ width: 100 }} className="text-right">Qty</th>
                      <th style={{ width: 130 }} className="text-right">Harga Pokok</th>
                      <th style={{ width: 130 }} className="text-right">Total</th>
                      <th style={{ width: 40 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(item => {
                      const avail = getItemStock(item.itemId)
                      const isOver = item.itemId && item.quantity > avail

                      return (
                        <tr key={item.id}>
                          <td>
                            <div>
                              <SearchableSelect
                                value={item.itemId}
                                onChange={val => updateItem(item.id, 'itemId', val)}
                                options={pharmacyOptions}
                                placeholder="— Pilih Item Farmasi / Medis —"
                                hideValue={true}
                                searchPlaceholder="Ketik nama item, kode, atau SKU..."
                              />
                              {item.itemId && (
                                <div className={`flex items-center gap-1.5 mt-1 text-[11px] font-semibold px-2 py-0.5 rounded border ${avail > 0 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-amber-700 bg-amber-50 border-amber-200'
                                  }`}>
                                  <Package className="w-3.5 h-3.5" />
                                  <span>Stok Tersedia di Kartu Stok: <strong>{fmtNum(avail)} {item.unit || 'unit'}</strong></span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td>
                            <input
                              type="number"
                              className={`form-input text-right text-xs py-1 w-24 font-bold ${isOver ? 'border-red-500 text-red-600 bg-red-50 ring-2 ring-red-200' : ''
                                }`}
                              value={item.quantity}
                              min={1}
                              max={avail > 0 ? avail : 1}
                              onChange={e => updateItem(item.id, 'quantity', e.target.value)}
                            />
                            {isOver && (
                              <p className="text-[10px] text-red-600 font-bold mt-1 text-right">
                                Melebihi stok ({fmtNum(avail)})
                              </p>
                            )}
                          </td>
                          <td className="text-right font-sans font-bold text-slate-700 text-sm">{fmtIDR(item.unitCost)}</td>
                          <td className="text-right font-sans font-extrabold text-slate-900 text-sm">{fmtIDR(item.totalCost)}</td>
                          <td>
                            <button
                              type="button"
                              onClick={() => removeItem(item.id)}
                              className="p-1 text-slate-300 hover:text-red-500"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50">
                      <td colSpan={3} className="text-right font-sans font-bold text-slate-700 pr-4">Total Nilai</td>
                      <td className="text-right font-sans font-extrabold text-primary-700 text-base">{fmtIDR(totalValue)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* View Detail Modal */}
      <Modal
        open={modal === 'view'}
        onClose={() => setModal(null)}
        title={`Detail Pengeluaran — ${selected?.outflowNumber}`}
        size="lg"
      >
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div>
                <span className="text-slate-500">Tanggal:</span>
                <strong className="ml-2">{fmtDate(selected.outflowDate)}</strong>
              </div>
              <div>
                <span className="text-slate-500">Tipe:</span>
                <span className="ml-2">
                  {OUTFLOW_TYPES.find(t => t.value === selected.outflowType)?.label || selected.outflowType}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-500">Deskripsi:</span>
                <p className="ml-2 mt-1 text-slate-700">{selected.description}</p>
              </div>
              <div>
                <span className="text-slate-500">Total Nilai:</span>
                <span className="ml-2 font-bold font-mono">{fmtIDR(selected.totalValue)}</span>
              </div>
              <div>
                <span className="text-slate-500">Status:</span>
                <StatusBadge status={selected.status} />
              </div>
            </div>

            <table className="table-base border border-slate-200 rounded-xl overflow-hidden">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Harga Pokok</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {selectedItems.map(item => (
                  <tr key={item.id}>
                    <td className="text-sm font-medium text-slate-800">{item.itemName}</td>
                    <td className="text-right font-sans font-bold text-slate-800 text-sm">{fmtNum(item.quantity)}</td>
                    <td className="text-right font-sans font-medium text-slate-700 text-sm">{fmtIDR(item.unitCost)}</td>
                    <td className="text-right font-sans font-extrabold text-slate-900 text-sm">{fmtIDR(item.totalCost)}</td>
                  </tr>
                ))}
                {selectedItems.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-6 text-slate-400">
                      Tidak ada item untuk pengeluaran ini
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-semibold">
                  <td colSpan={3} className="text-right font-sans font-bold text-slate-700 pr-4">Total</td>
                  <td className="text-right font-sans font-extrabold text-primary-700 text-base">{fmtIDR(selected.totalValue)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Modal>
    </div>
  )
}
