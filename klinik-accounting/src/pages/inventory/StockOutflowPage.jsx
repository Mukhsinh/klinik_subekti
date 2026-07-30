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
import { Plus, Eye, Trash2, CheckCircle, Package, TrendingDown } from 'lucide-react'
import Modal from '../../components/ui/Modal'
import SearchInput from '../../components/ui/SearchInput'
import SearchableSelect from '../../components/ui/SearchableSelect'
import { StatusBadge } from '../../components/ui/Badge'
import { fmtIDR, fmtDate, todayISO } from '../../utils/format'
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
    return list.filter(i => i.isActive !== false)
  }, [dbPharmacyItems, pharmacyItems])

  const activeBatches = useMemo(() => {
    return dbBatches.length > 0 ? dbBatches : (invBatches || [])
  }, [dbBatches, invBatches])

  const getItemStock = (itemId) => {
    return activeBatches
      .filter(b => b.itemId === itemId && Number(b.quantityCurrent) > 0)
      .reduce((sum, b) => sum + Number(b.quantityCurrent || 0), 0)
  }

  const pharmacyOptions = useMemo(() =>
    activePharmacyItems
      .sort((a, b) => (a.itemName || '').localeCompare(b.itemName || ''))
      .map(i => {
        const stk = getItemStock(i.id)
        return {
          value: i.id,
          label: `${i.itemCode || i.skuCode || 'ITEM'} — ${i.itemName} (Stok: ${stk})`,
          disabled: stk === 0
        }
      }),
    [activePharmacyItems, activeBatches]
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
        .filter(s => s.transactionType === 'BILLING' && s.quantityOut > 0)
        .forEach(s => {
          const item = pharmacySource.find(p => p.id === s.itemId)
          const billing = billingSource.find(b => b.billingNumber === s.referenceNumber)
          const key = `${s.referenceNumber}_${s.itemId}`
          processedKeys.add(key)

          list.push({
            id: s.id,
            date: s.loggedAt || s.transactionDate,
            referenceNumber: s.referenceNumber || '-',
            itemName: item?.itemName || 'Obat / BHP Kasir',
            quantity: s.quantityOut || 0,
            unitCost: s.unitCost || 0,
            totalValue: s.totalValue || (s.quantityOut * (s.unitCost || 0)),
            source: 'BILLING',
            patientName: billing?.patientName || '-'
          })
        })
    }

    if (Array.isArray(bItemsSource)) {
      bItemsSource
        .filter(bi => bi.itemType === 'PHARMACY' || bi.pharmacyItemId)
        .forEach(bi => {
          const billing = billingSource.find(b => b.id === bi.billingId)
          if (!billing) return

          const itemId = bi.pharmacyItemId || bi.itemId
          const key = `${billing.billingNumber}_${itemId}`

          if (!processedKeys.has(key)) {
            processedKeys.add(key)
            const item = pharmacySource.find(p => p.id === itemId)
            const qty = bi.quantity || 1
            const unitPrice = bi.unitPrice || bi.price || 0
            const itemCost = item?.purchasePrice || item?.hpp || unitPrice

            list.push({
              id: bi.id,
              date: billing.visitDate || billing.createdAt,
              referenceNumber: billing.billingNumber || '-',
              itemName: bi.itemName || item?.itemName || 'Obat / BHP Kasir',
              quantity: qty,
              unitCost: itemCost,
              totalValue: qty * itemCost,
              source: 'BILLING',
              patientName: billing.patientName || '-'
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

      if (field === 'itemId') {
        const pharmacyItem = activePharmacyItems.find(p => p.id === value)
        if (pharmacyItem) {
          updated.itemName = pharmacyItem.itemName
          const batches = activeBatches.filter(b => b.itemId === value && Number(b.quantityCurrent) > 0)
          if (batches.length > 0) {
            const avgCost = batches.reduce((sum, b) => sum + Number(b.unitCostPrice || 0), 0) / batches.length
            updated.unitCost = avgCost
            updated.totalCost = (parseFloat(updated.quantity) || 1) * avgCost
          } else {
            const defaultCost = Number(pharmacyItem.purchasePrice || pharmacyItem.hpp || 0)
            updated.unitCost = defaultCost
            updated.totalCost = (parseFloat(updated.quantity) || 1) * defaultCost
          }
        }
      }

      if (field === 'quantity' || field === 'unitCost') {
        updated.totalCost = (parseFloat(updated.quantity) || 0) * (parseFloat(updated.unitCost) || 0)
      }

      return updated
    }))
  }

  const resetForm = () => {
    setOutflowDate(todayISO())
    setOutflowType('INTERNAL_USE')
    setDescription('')
    setItems([])
  }

  // Direct database saving without relying on useStore
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
      if (item.quantity > available) {
        toast.error(`Stok "${item.itemName}" tidak mencukupi. Tersedia: ${available}, Diminta: ${item.quantity}`)
        return
      }
    }

    const totalVal = validItems.reduce((sum, i) => sum + (Number(i.totalCost) || 0), 0)
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

      const outflowItemsList = validItems.map(item => ({
        id: uuidv4(),
        outflowId,
        itemId: item.itemId,
        itemName: item.itemName,
        quantity: Number(item.quantity || 1),
        unitCost: Number(item.unitCost || 0),
        totalCost: Number(item.totalCost || 0),
        notes: item.notes || '',
      }))

      // FIFO stock depletion directly against live database batches
      const ledgerEntries = []
      const currentBatches = [...activeBatches]

      for (const item of validItems) {
        let remaining = Number(item.quantity)
        const itemBatches = currentBatches
          .filter(b => b.itemId === item.itemId && Number(b.quantityCurrent) > 0)
          .sort((a, b) => new Date(a.expiryDate || a.createdAt) - new Date(b.expiryDate || b.createdAt))

        let currentItemBalance = currentBatches
          .filter(b => b.itemId === item.itemId)
          .reduce((sum, b) => sum + Number(b.quantityCurrent || 0), 0)

        for (const batch of itemBatches) {
          if (remaining <= 0) break
          const take = Math.min(Number(batch.quantityCurrent), remaining)
          remaining -= take
          const newQty = Number(batch.quantityCurrent) - take
          batch.quantityCurrent = newQty

          await updateBatchQty(batch.id, newQty)

          currentItemBalance -= take

          ledgerEntries.push({
            id: uuidv4(),
            batchId: batch.id,
            itemId: item.itemId,
            transactionType: 'OUTFLOW',
            referenceId: outflowId,
            referenceNumber: outflowNumber,
            quantityIn: 0,
            quantityOut: take,
            balanceAfter: Math.max(0, currentItemBalance),
            unitCost: Number(batch.unitCostPrice || 0),
            totalValue: take * Number(batch.unitCostPrice || 0),
            notes: `Pengeluaran ${outflowType} (${outflowNumber})`,
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

      const journalItemsList = [
        {
          id: uuidv4(),
          journalEntryId: journalId,
          accountCode: targetExpenseAccount,
          description: `Beban Pengeluaran Stok ${outflowType} — ${outflowNumber}`,
          debit: totalVal,
          credit: 0
        },
        {
          id: uuidv4(),
          journalEntryId: journalId,
          accountCode: '1-13-001',
          description: `Pengurangan Persediaan — ${outflowNumber}`,
          debit: 0,
          credit: totalVal
        }
      ]

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

      // Persist directly to Supabase database tables stock_outflow_entries and stock_outflow_items
      await insertStockOutflow(outflowEntry)
      await insertStockOutflowItems(outflowItemsList)
      await upsertJournalEntry(journalHeader)
      await insertJournalItems(journalItemsList)

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

  const totalValue = items.reduce((sum, i) => sum + (i.totalCost || 0), 0)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Pengeluaran Stok</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Pencatatan pengeluaran stok non-billing dan riwayat dari transaksi kasir
          </p>
        </div>
        <button className="btn-primary" onClick={() => { resetForm(); setModal('new') }}>
          <Plus className="w-4 h-4" />Pengeluaran Baru
        </button>
      </div>

      {/* Tabs */}
      <div className="card">
        <div className="border-b border-slate-200">
          <div className="flex gap-1 px-4">
            <button
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${modal !== 'billing' ? 'border-primary-600 text-primary-700' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              onClick={() => setModal(null)}
            >
              <Package className="w-4 h-4 inline mr-2" />
              Pengeluaran Manual ({filtered.length})
            </button>
            <button
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${modal === 'billing' ? 'border-primary-600 text-primary-700' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              onClick={() => setModal('billing')}
            >
              <TrendingDown className="w-4 h-4 inline mr-2" />
              Riwayat dari Billing ({billingOutflows.length})
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
                <span className="ml-auto text-sm text-slate-400">{filtered.length} pengeluaran</span>
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
                        <td className="py-2 px-2.5 text-right font-mono text-[11px] font-bold whitespace-nowrap">{fmtIDR(o.totalValue)}</td>
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
                      <td className="py-2 px-2.5 text-right text-[11px] whitespace-nowrap">{o.quantity}</td>
                      <td className="py-2 px-2.5 text-right font-mono text-[11px] whitespace-nowrap">{fmtIDR(o.unitCost)}</td>
                      <td className="py-2 px-2.5 text-right font-mono text-[11px] font-bold text-slate-800 whitespace-nowrap">{fmtIDR(o.totalValue)}</td>
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
              <div className="border border-slate-200 rounded-xl overflow-hidden">
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
                    {items.map(item => (
                      <tr key={item.id}>
                        <td>
                          <div>
                            <SearchableSelect
                              value={item.itemId}
                              onChange={val => updateItem(item.id, 'itemId', val)}
                              options={pharmacyOptions}
                              placeholder="— Pilih Item —"
                              hideValue={true}
                              searchPlaceholder="Ketik nama item..."
                            />
                            {item.itemId && (
                              <p className="text-[10px] text-blue-600 mt-1 font-medium">
                                Stok Tersedia di Database: <strong>{getItemStock(item.itemId)} unit</strong>
                              </p>
                            )}
                          </div>
                        </td>
                        <td>
                          <input
                            type="number"
                            className="form-input text-right text-xs py-1 w-20"
                            value={item.quantity}
                            min={1}
                            onChange={e => updateItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                          />
                        </td>
                        <td className="text-right font-mono text-sm">{fmtIDR(item.unitCost)}</td>
                        <td className="text-right font-mono text-sm font-bold">{fmtIDR(item.totalCost)}</td>
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
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50">
                      <td colSpan={3} className="text-right font-semibold pr-4">Total Nilai</td>
                      <td className="text-right font-mono font-bold text-primary-700">{fmtIDR(totalValue)}</td>
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
                    <td className="text-sm">{item.itemName}</td>
                    <td className="text-right text-sm">{item.quantity}</td>
                    <td className="text-right font-mono text-sm">{fmtIDR(item.unitCost)}</td>
                    <td className="text-right font-mono text-sm font-bold">{fmtIDR(item.totalCost)}</td>
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
                  <td colSpan={3} className="text-right pr-4">Total</td>
                  <td className="text-right font-mono text-primary-700">{fmtIDR(selected.totalValue)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Modal>
    </div>
  )
}
