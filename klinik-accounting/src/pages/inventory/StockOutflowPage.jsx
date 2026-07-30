import { useState, useMemo, useEffect } from 'react'
import { useStore } from '../../store/useStore'
import { fetchStockLedger, fetchStockOutflows, fetchBillings } from '../../lib/db'
import { Plus, Eye, Trash2, CheckCircle, Package, TrendingDown, AlertCircle } from 'lucide-react'
import Modal from '../../components/ui/Modal'
import SearchInput from '../../components/ui/SearchInput'
import SearchableSelect from '../../components/ui/SearchableSelect'
import { StatusBadge } from '../../components/ui/Badge'
import { fmtIDR, fmtDate, todayISO } from '../../utils/format'
import toast from 'react-hot-toast'
import { v4 as uuidv4 } from 'uuid'

const OUTFLOW_TYPES = [
  { value: 'INTERNAL_USE', label: 'Pemakaian Internal' },
  { value: 'OVERHEAD', label: 'Overhead / Operasional' },
  { value: 'DONATION', label: 'Donasi' },
  { value: 'SAMPLE', label: 'Sampel Gratis' },
  { value: 'WASTE', label: 'Barang Rusak/Terbuang' },
  { value: 'OTHER', label: 'Lainnya' }
]

export default function StockOutflowPage() {
  const {
    pharmacyItems, invBatches, stockLedger, billings, billingItems,
    activeBranchId, getItemStock,
    saveStockOutflow, postStockOutflow,
    generateOutflowNumber
  } = useStore()

  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')

  const [dbStockLedger, setDbStockLedger] = useState([])
  const [dbBillings, setDbBillings] = useState([])
  const [dbBillingItems, setDbBillingItems] = useState([])
  const [dbOutflows, setDbOutflows] = useState([])

  useEffect(() => {
    let isMounted = true
    const loadLiveDbData = async () => {
      try {
        const [ledgerData, billingData, bItemsData, outflowData] = await Promise.all([
          fetchStockLedger(),
          fetchBillings(),
          fetchAllBillingItems().catch(() => []),
          fetchStockOutflows(),
        ])
        if (isMounted) {
          if (Array.isArray(ledgerData)) setDbStockLedger(ledgerData)
          if (Array.isArray(billingData)) setDbBillings(billingData)
          if (Array.isArray(bItemsData)) setDbBillingItems(bItemsData)
          if (Array.isArray(outflowData)) setDbOutflows(outflowData)
        }
      } catch (err) {
        console.warn('[StockOutflowPage] Error loading live database:', err.message)
      }
    }
    loadLiveDbData()
    return () => { isMounted = false }
  }, [])

  // Form states
  const [outflowDate, setOutflowDate] = useState(todayISO())
  const [outflowType, setOutflowType] = useState('INTERNAL_USE')
  const [description, setDescription] = useState('')
  const [items, setItems] = useState([])

  const outflowNumber = useMemo(() => generateOutflowNumber(), [])

  const pharmacyOptions = useMemo(() =>
    pharmacyItems
      .filter(i => i.isActive !== false)
      .sort((a, b) => a.itemName.localeCompare(b.itemName))
      .map(i => {
        const stk = getItemStock(i.id)
        return {
          value: i.id,
          label: `${i.itemCode || i.skuCode} — ${i.itemName} (Stok: ${stk})`,
          disabled: stk === 0
        }
      }),
    [pharmacyItems, invBatches, getItemStock]
  )

  const stockOutflows = useStore(state => state.stockOutflows || [])
  const stockOutflowItems = useStore(state => state.stockOutflowItems || [])

  const outflows = dbOutflows.length > 0 ? dbOutflows : stockOutflows
  const outflowItems = stockOutflowItems

  // Consolidate billing-related outflows from live database stock ledger & billing_items
  const billingOutflows = useMemo(() => {
    const ledgerSource = dbStockLedger.length > 0 ? dbStockLedger : (stockLedger || [])
    const billingSource = dbBillings.length > 0 ? dbBillings : (billings || [])
    const bItemsSource = dbBillingItems.length > 0 ? dbBillingItems : (billingItems || [])
    const pharmacySource = pharmacyItems || []

    const list = []
    const processedKeys = new Set()

    // 1. Add entries from stock ledger cards
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

    // 2. Reconcile with billing_items if missing from stock_ledger_cards
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
  }, [dbStockLedger, stockLedger, dbBillings, billings, dbBillingItems, billingItems, pharmacyItems])

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
        const pharmacyItem = pharmacyItems.find(p => p.id === value)
        if (pharmacyItem) {
          updated.itemName = pharmacyItem.itemName
          // Calculate average unit cost from available batches
          const batches = invBatches.filter(b => b.itemId === value && b.quantityCurrent > 0)
          if (batches.length > 0) {
            const avgCost = batches.reduce((sum, b) => sum + b.unitCostPrice, 0) / batches.length
            updated.unitCost = avgCost
            updated.totalCost = updated.quantity * avgCost
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

  const handleSave = async () => {
    if (!description.trim()) {
      toast.error('Deskripsi wajib diisi')
      return
    }

    if (items.length === 0 || !items.some(i => i.itemId)) {
      toast.error('Minimal harus ada 1 item')
      return
    }

    // Validate stock availability
    for (const item of items.filter(i => i.itemId)) {
      const available = getItemStock(item.itemId)
      if (item.quantity > available) {
        toast.error(`Stok "${item.itemName}" tidak mencukupi. Tersedia: ${available}, Diminta: ${item.quantity}`)
        return
      }
    }

    const totalValue = items.reduce((sum, i) => sum + (i.totalCost || 0), 0)

    try {
      await saveStockOutflow({
        outflowNumber,
        outflowDate,
        outflowType,
        description,
        totalValue,
        items: items.filter(i => i.itemId)
      })

      toast.success('Pengeluaran stok berhasil disimpan')
      setModal(null)
      resetForm()
    } catch (err) {
      toast.error(err.message || 'Gagal menyimpan pengeluaran stok')
    }
  }

  const filtered = useMemo(() => {
    // Ensure outflows is always an array
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

    // Safe sort with null check for createdAt
    return result.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0)
      const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0)
      return dateB - dateA
    })
  }, [outflows, statusFilter, search])

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
              Pengeluaran Manual
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
                    <th className="py-2.5 px-2.5" style={{ width: '120px' }}>Tipe</th>
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
                        Belum ada pengeluaran stok manual
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
                {(!Array.isArray(outflowItems) ? [] : outflowItems.filter(i => i.outflowId === selected.id)).map(item => (
                  <tr key={item.id}>
                    <td className="text-sm">{item.itemName}</td>
                    <td className="text-right text-sm">{item.quantity}</td>
                    <td className="text-right font-mono text-sm">{fmtIDR(item.unitCost)}</td>
                    <td className="text-right font-mono text-sm font-bold">{fmtIDR(item.totalCost)}</td>
                  </tr>
                ))}
                {(Array.isArray(outflowItems) && outflowItems.filter(i => i.outflowId === selected.id).length === 0) && (
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
