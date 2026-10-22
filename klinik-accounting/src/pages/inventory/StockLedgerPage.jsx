import { useState, useMemo, useEffect } from 'react'
import { AlertTriangle, RotateCcw, Download, Search, Package, CheckCircle, TrendingUp, Layers } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { useAuth } from '../../store/useAuth'
import { fetchStockLedger, fetchBatches, fetchPharmacyItems, fetchAllBillingItems, fetchBillings } from '../../lib/db'
import Modal from '../../components/ui/Modal'
import SearchableSelect from '../../components/ui/SearchableSelect'
import { fmtIDR, fmtDate, fmtDateTime, fmtNum } from '../../utils/format'
import { exportStockExcel, exportStockLedgerDetailExcel } from '../../utils/exportExcel'
import toast from 'react-hot-toast'
import { v4 as uuidv4 } from 'uuid'

const TRANS_LABELS = {
  SALDO_AWAL: 'Saldo Awal',
  GRN: 'Penerimaan (GRN)',
  BILLING: 'Penjualan Pasien',
  PATIENT_SALE: 'Penjualan Pasien',
  ADJUSTMENT: 'Penyesuaian',
  EXPIRED: 'Kadaluarsa/Rusak',
  DAMAGED: 'Rusak',
  TRANSFER_IN: 'Masuk Transfer',
  TRANSFER_OUT: 'Keluar Transfer',
  RETURN: 'Retur',
}
const TRANS_COLORS = {
  SALDO_AWAL: 'badge-purple',
  GRN: 'badge-green',
  BILLING: 'badge-blue',
  PATIENT_SALE: 'badge-blue',
  ADJUSTMENT: 'badge-yellow',
  EXPIRED: 'badge-red',
  DAMAGED: 'badge-red',
  TRANSFER_IN: 'badge-teal',
  TRANSFER_OUT: 'badge-orange',
}

export default function StockLedgerPage() {
  const {
    pharmacyItems, invBatches, stockLedger, billingItems, billings,
    adjustStock, saveJournalDraft, postJournalEntry,
    activeBranchId, generateEntryNumber, refreshAll,
  } = useStore()
  const { appSettings } = useAuth()

  const [selectedItem, setSelectedItem] = useState('ALL_ITEMS')
  const [adjustModal, setAdjustModal] = useState(false)
  const [adjBatch, setAdjBatch] = useState(null)
  const [adjReason, setAdjReason] = useState('')
  const [adjType, setAdjType] = useState('REMOVE')
  const [adjQty, setAdjQty] = useState('')
  const [recapSearch, setRecapSearch] = useState('')

  const effectivePharmacyItems = pharmacyItems || []
  const effectiveBatches = invBatches || []

  const isOpeningBalanceRecord = (l) => {
    const t = String(l.transactionType || l.transaction_type || '').toUpperCase()
    const r = String(l.referenceNumber || l.reference_number || '').toUpperCase()
    const n = String(l.notes || '').toLowerCase()
    return t === 'SALDO_AWAL' || r === 'SALDO-AWAL' || r.startsWith('SALDO-AWAL') || n.includes('saldo awal')
  }

  const effectiveStockLedger = useMemo(() => {
    const baseLedger = stockLedger || []
    const list = [...baseLedger]
    const processedBillingKeys = new Set(
      list.filter(l => l.transactionType === 'BILLING').map(l => `${l.referenceNumber}_${l.itemId}`)
    )

    // Ensure any SALDO-AWAL batches in inventory_batches have a corresponding ledger entry
    const existingOpeningItemIds = new Set(
      list.filter(isOpeningBalanceRecord).map(l => l.itemId)
    )

    if (Array.isArray(effectiveBatches)) {
      effectiveBatches.forEach(b => {
        const bNum = String(b.batchNumber || b.batch_number || '')
        const grnRef = String(b.grnReference || b.grn_reference || '')
        const itemId = b.itemId || b.item_id
        if (itemId && (bNum.includes('SALDO-AWAL') || grnRef === 'SALDO-AWAL') && !existingOpeningItemIds.has(itemId)) {
          existingOpeningItemIds.add(itemId)
          const qty = Number(b.quantityReceived ?? b.quantity_received ?? b.quantityCurrent ?? b.quantity_current ?? 0)
          const cost = Number(b.unitCostPrice ?? b.unit_cost_price ?? 0)
          list.push({
            id: `OPENING-${itemId}`,
            batchId: b.id,
            itemId: itemId,
            transactionType: 'SALDO_AWAL',
            referenceNumber: 'SALDO-AWAL',
            quantityIn: qty,
            quantityOut: 0,
            balanceAfter: qty,
            unitCost: cost,
            totalValue: qty * cost,
            notes: 'Saldo awal persediaan item',
            loggedAt: b.receivedAt || b.received_at || b.createdAt || b.created_at || new Date().toISOString(),
          })
        }
      })
    }

    if (Array.isArray(billingItems) && billingItems.length > 0) {
      billingItems
        .filter(bi => bi.itemType === 'PHARMACY' || bi.pharmacyItemId)
        .forEach(bi => {
          const billing = (billings || []).find(b => b.id === bi.billingId)
          const itemId = bi.pharmacyItemId || bi.itemId
          const refNo = billing?.billingNumber || 'BILL-KASIR'
          const key = `${refNo}_${itemId}`

          if (itemId && !processedBillingKeys.has(key)) {
            processedBillingKeys.add(key)
            list.push({
              id: bi.id,
              batchId: 'DIRECT-BILLING',
              itemId: itemId,
              transactionType: 'BILLING',
              referenceId: bi.id,
              referenceNumber: refNo,
              quantityIn: 0,
              quantityOut: bi.quantity || 1,
              balanceAfter: 0,
              unitCost: bi.unitPrice || 0,
              totalValue: (bi.quantity || 1) * (bi.unitPrice || 0),
              loggedAt: billing?.visitDate || billing?.createdAt || new Date().toISOString(),
            })
          }
        })
    }

    return list
  }, [stockLedger, billingItems, billings, effectiveBatches])

  const selectOptions = useMemo(() => {
    const list = effectivePharmacyItems
      .sort((a, b) => (a.itemName || '').localeCompare(b.itemName || ''))
      .map(i => {
        const qty = effectiveBatches
          .filter(b => b.itemId === i.id && b.quantityCurrent > 0)
          .reduce((s, b) => s + (Number(b.quantityCurrent) || 0), 0)
        return {
          value: i.id,
          label: i.itemName,
          sub: `${i.skuCode || i.itemCode || 'ITEM'} — Stok: ${fmtNum(qty)} ${i.baseUnit || i.unit || 'Unit'}`,
          group: 'Item Farmasi / Medis'
        }
      })
    return [
      {
        value: 'ALL_ITEMS',
        label: 'Semua Item (Laporan Rekapitulasi)',
        sub: 'Tampilkan rekap seluruh saldo awal, penerimaan, pengeluaran & saldo akhir (Metode FEFO/FIFO)',
        group: 'Global'
      },
      ...list
    ]
  }, [effectivePharmacyItems, effectiveBatches])

  // Global Rekapitulasi Data with Saldo Awal, Penerimaan, Pengeluaran, Saldo Akhir
  const recapData = useMemo(() => {
    return effectivePharmacyItems.map(item => {
      const itemLedger = effectiveStockLedger.filter(l => l.itemId === item.id)

      const saldoAwal = itemLedger
        .filter(isOpeningBalanceRecord)
        .reduce((sum, l) => sum + (Number(l.quantityIn ?? l.quantity_in) || 0), 0)

      const penerimaan = itemLedger
        .filter(l => !isOpeningBalanceRecord(l))
        .reduce((sum, l) => sum + (Number(l.quantityIn ?? l.quantity_in) || 0), 0)

      const pengeluaran = itemLedger
        .reduce((sum, l) => sum + (Number(l.quantityOut ?? l.quantity_out) || 0), 0)

      const saldoAkhir = saldoAwal + penerimaan - pengeluaran

      const activeBatches = effectiveBatches.filter(b => b.itemId === item.id && b.quantityCurrent > 0)
      const currentStock = activeBatches.reduce((s, b) => s + (Number(b.quantityCurrent) || 0), 0)
      const finalStock = currentStock > 0 ? currentStock : Math.max(0, saldoAkhir)

      const totalValue = activeBatches.reduce((s, b) => s + (Number(b.quantityCurrent) || 0) * (Number(b.unitCostPrice) || 0), 0)

      return {
        ...item,
        saldoAwal,
        penerimaan,
        pengeluaran,
        saldoAkhir: finalStock,
        totalValue
      }
    })
  }, [effectivePharmacyItems, effectiveStockLedger, effectiveBatches])

  const filteredRecap = useMemo(() => {
    if (!recapSearch.trim()) return recapData
    const q = recapSearch.toLowerCase()
    return recapData.filter(
      r =>
        (r.itemName || '').toLowerCase().includes(q) ||
        (r.skuCode || '').toLowerCase().includes(q) ||
        (r.itemCode || '').toLowerCase().includes(q)
    )
  }, [recapData, recapSearch])

  const selectedItemObj = useMemo(
    () => effectivePharmacyItems.find(i => i.id === selectedItem),
    [effectivePharmacyItems, selectedItem],
  )

  const itemBatches = useMemo(
    () => effectiveBatches
      .filter(b => b.itemId === selectedItem)
      .sort((a, b) => new Date(a.expiryDate || a.createdAt) - new Date(b.expiryDate || b.createdAt)),
    [effectiveBatches, selectedItem],
  )

  // Chronological mutation lines for selected item with precise Saldo Awal, Penerimaan, Pengeluaran, Saldo Akhir
  const itemChronologicalLedger = useMemo(() => {
    if (!selectedItem || selectedItem === 'ALL_ITEMS') return []

    const sortedAsc = [...effectiveStockLedger]
      .filter(l => l.itemId === selectedItem)
      .sort((a, b) => {
        const isAOpen = isOpeningBalanceRecord(a)
        const isBOpen = isOpeningBalanceRecord(b)
        if (isAOpen && !isBOpen) return -1
        if (!isAOpen && isBOpen) return 1
        return new Date(a.loggedAt || a.transactionDate || a.createdAt) - new Date(b.loggedAt || b.transactionDate || b.createdAt)
      })

    let currentBalance = 0
    const processed = sortedAsc.map(l => {
      const isOpening = isOpeningBalanceRecord(l)
      const qtyIn = Number(l.quantityIn ?? l.quantity_in) || 0
      const qtyOut = Number(l.quantityOut ?? l.quantity_out) || 0

      let saldoAwal = currentBalance
      let saldoAkhir = l.balanceAfter !== undefined && l.balanceAfter !== null ? Number(l.balanceAfter) : (saldoAwal + qtyIn - qtyOut)

      if (isOpening) {
        saldoAwal = qtyIn
        saldoAkhir = qtyIn
        currentBalance = qtyIn
      } else {
        currentBalance = saldoAkhir
      }

      return {
        ...l,
        transactionType: isOpening ? 'SALDO_AWAL' : l.transactionType,
        saldoAwal,
        penerimaan: isOpening ? 0 : qtyIn,
        pengeluaran: qtyOut,
        saldoAkhir,
      }
    })

    return processed
  }, [effectiveStockLedger, selectedItem])

  const totalStockSingle = itemBatches.reduce((s, b) => s + (Number(b.quantityCurrent) || 0), 0)
  const totalValueSingle = itemBatches.reduce((s, b) => s + (Number(b.quantityCurrent) || 0) * (Number(b.unitCostPrice) || 0), 0)

  // Global KPI Metrics
  const globalTotalQty = recapData.reduce((sum, r) => sum + (Number(r.saldoAkhir) || 0), 0)
  const globalTotalValue = recapData.reduce((sum, r) => sum + (Number(r.totalValue) || 0), 0)
  const globalActiveBatchesCount = effectiveBatches.filter(b => b.quantityCurrent > 0).length

  const isExpiringSoon = (expiryDate) => {
    if (!expiryDate) return false
    return Math.ceil((new Date(expiryDate) - new Date()) / 86400000) <= 180
  }

  const handleExport = () => {
    try {
      if (selectedItem === 'ALL_ITEMS' || !selectedItem) {
        exportStockExcel(effectivePharmacyItems, effectiveBatches, recapData, appSettings)
        toast.success('Laporan Rekapitulasi Stock Ledger berhasil diunduh!')
      } else {
        const itemObj = selectedItemObj || effectivePharmacyItems.find(i => i.id === selectedItem)
        exportStockLedgerDetailExcel(itemObj, itemChronologicalLedger, itemBatches, appSettings)
        toast.success(`Kartu Stok "${itemObj?.itemName || 'Item'}" berhasil diunduh!`)
      }
    } catch (err) {
      console.error('[StockLedgerPage] Export error:', err)
      toast.error('Gagal mengunduh laporan: ' + err.message)
    }
  }

  // ── Open adjustment modal ─────────────────────────────────
  const openAdjust = (batch) => {
    setAdjBatch(batch)
    setAdjType('REMOVE')
    setAdjReason('')
    setAdjQty('')
    setAdjustModal(true)
  }

  // ── Execute stock adjustment ──────────────────────────────
  const handleAdjust = async () => {
    if (!adjReason.trim()) { toast.error('Alasan penyesuaian wajib diisi.'); return }
    if (adjType !== 'REMOVE' && (!adjQty || parseInt(adjQty) <= 0)) {
      toast.error('Jumlah penyesuaian harus lebih dari 0.')
      return
    }

    const batch = adjBatch
    const lostValue = adjType === 'REMOVE'
      ? batch.quantityCurrent * batch.unitCostPrice
      : Math.abs(parseInt(adjQty)) * batch.unitCostPrice

    await adjustStock(
      batch.id,
      batch.itemId,
      adjType === 'ADD' ? parseInt(adjQty) : -batch.quantityCurrent,
      adjReason,
      adjType,
    )

    if (adjType === 'REMOVE' && lostValue > 0) {
      const entryId = uuidv4()
      const entryNumber = generateEntryNumber('ADJ')
      const it = effectivePharmacyItems.find(p => p.id === batch.itemId)

      const header = {
        id: entryId,
        branchId: activeBranchId,
        entryNumber,
        transactionDate: new Date().toISOString().split('T')[0],
        description: `Penghapusan Stok Expired/Rusak — ${it?.itemName} Batch ${batch.batchNumber}: ${adjReason}`,
        entryType: 'ADJUSTMENT',
        totalDebit: lostValue,
        totalCredit: lostValue,
      }
      const jItems = [
        {
          id: uuidv4(),
          journalEntryId: entryId,
          accountCode: '6-17-001',
          description: `Kerugian stok ${it?.itemName}`,
          debit: lostValue,
          credit: 0,
        },
        {
          id: uuidv4(),
          journalEntryId: entryId,
          accountCode: it?.coaInventoryCode || '1-13-001',
          description: `Hapus stok ${it?.itemName} batch ${batch.batchNumber}`,
          debit: 0,
          credit: lostValue,
        },
      ]
      await saveJournalDraft(header, jItems)
      await postJournalEntry(entryId, 'System-ADJ')
    }

    toast.success('Penyesuaian stok berhasil dicatat. Jurnal otomatis dibuat.')
    setAdjustModal(false)
    await refreshAll()
  }

  return (
    <div className="space-y-5 font-sans">
      {/* Header Title */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title font-sans">Kartu Stok & Stock Ledger</h1>
          <p className="text-sm text-slate-400 mt-0.5 font-sans">
            Riwayat mutasi persediaan per item (Metode FEFO - First Expiry First Out & FIFO - First In First Out)
          </p>
        </div>
        <button
          className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs py-2 px-4 rounded-lg shadow-md shadow-red-200/60 flex items-center gap-1.5 font-sans transition-all active:scale-95 border-0 cursor-pointer"
          onClick={handleExport}
        >
          <Download className="w-4 h-4" /> Unduh Laporan
        </button>
      </div>

      {/* Modern Compact Score Cards — Vibrant Solid Colors */}
      {selectedItem === 'ALL_ITEMS' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="rounded-xl p-3.5 shadow-sm" style={{ background: '#2563EB' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-blue-100">Total Jenis Item</p>
                <p className="text-xl font-extrabold text-white tracking-tight font-sans mt-0.5">
                  {fmtNum(recapData.length)} <span className="text-xs font-semibold text-blue-200">item</span>
                </p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-white/20 text-white flex items-center justify-center">
                <Package className="w-4 h-4" />
              </div>
            </div>
          </div>

          <div className="rounded-xl p-3.5 shadow-sm" style={{ background: '#059669' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-100">Total Kuantitas Stok</p>
                <p className="text-xl font-extrabold text-white tracking-tight font-sans mt-0.5">
                  {fmtNum(globalTotalQty)} <span className="text-xs font-semibold text-emerald-200">unit</span>
                </p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-white/20 text-white flex items-center justify-center">
                <CheckCircle className="w-4 h-4" />
              </div>
            </div>
          </div>

          <div className="rounded-xl p-3.5 shadow-sm" style={{ background: '#D97706' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-100">Total Batch Aktif</p>
                <p className="text-xl font-extrabold text-white tracking-tight font-sans mt-0.5">
                  {fmtNum(globalActiveBatchesCount)} <span className="text-xs font-semibold text-amber-200">batch</span>
                </p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-white/20 text-white flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
            </div>
          </div>

          <div className="rounded-xl p-3.5 shadow-sm" style={{ background: '#7C3AED' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-purple-100">Nilai HPP Total Persediaan</p>
                <p className="text-xl font-extrabold text-white tracking-tight font-sans mt-0.5">
                  {fmtNum(Math.round(globalTotalValue))}
                </p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-white/20 text-white flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="rounded-xl p-3.5 shadow-sm" style={{ background: '#2563EB' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-blue-100">Stok Tersedia</p>
                <p className="text-xl font-extrabold text-white tracking-tight font-sans mt-0.5">
                  {fmtNum(totalStockSingle)} <span className="text-xs font-semibold text-blue-200">{selectedItemObj?.baseUnit || selectedItemObj?.unit || 'unit'}</span>
                </p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-white/20 text-white flex items-center justify-center">
                <Package className="w-4 h-4" />
              </div>
            </div>
          </div>

          <div className="rounded-xl p-3.5 shadow-sm" style={{ background: '#059669' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-100">Batch Aktif</p>
                <p className="text-xl font-extrabold text-white tracking-tight font-sans mt-0.5">
                  {fmtNum(itemBatches.filter(b => b.quantityCurrent > 0).length)} <span className="text-xs font-semibold text-emerald-200">batch</span>
                </p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-white/20 text-white flex items-center justify-center">
                <CheckCircle className="w-4 h-4" />
              </div>
            </div>
          </div>

          <div className="rounded-xl p-3.5 shadow-sm" style={{ background: '#D97706' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-100">Batch Hampir ED</p>
                <p className="text-xl font-extrabold text-white tracking-tight font-sans mt-0.5">
                  {fmtNum(itemBatches.filter(b => b.quantityCurrent > 0 && isExpiringSoon(b.expiryDate)).length)} <span className="text-xs font-semibold text-amber-200">batch</span>
                </p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-white/20 text-white flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
          </div>

          <div className="rounded-xl p-3.5 shadow-sm" style={{ background: '#7C3AED' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-purple-100">Nilai Stok (HPP)</p>
                <p className="text-xl font-extrabold text-white tracking-tight font-sans mt-0.5">
                  {fmtNum(Math.round(totalValueSingle))}
                </p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-white/20 text-white flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Item picker Dropdown */}
      <div className="card card-body">
        <label className="form-label font-sans font-bold text-xs text-slate-700 mb-1.5">Pilih Item Farmasi / Medis</label>
        <SearchableSelect
          options={selectOptions}
          value={selectedItem}
          onChange={val => setSelectedItem(val)}
          placeholder="— Cari & Pilih Item untuk melihat kartu stok —"
          className="max-w-xl"
          hideValue={true}
        />
      </div>

      {/* All Items Recap Table */}
      {selectedItem === 'ALL_ITEMS' && (
        <div className="space-y-4 font-sans">
          {/* Search Box */}
          <div className="card card-body">
            <div className="flex items-center gap-3">
              <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <input
                type="text"
                className="form-input flex-1 text-xs font-sans"
                placeholder="Ketik kata kunci untuk mencari item (nama, kode, SKU)..."
                value={recapSearch}
                onChange={e => setRecapSearch(e.target.value)}
              />
              {recapSearch && (
                <button
                  className="btn-secondary text-xs py-1.5 px-3"
                  onClick={() => setRecapSearch('')}
                >
                  Clear
                </button>
              )}
            </div>
            {recapSearch && (
              <p className="text-[11px] text-slate-500 mt-2 font-sans">
                Menampilkan {filteredRecap.length} dari {recapData.length} item
              </p>
            )}
          </div>

          <div className="card font-sans overflow-hidden">
            <div className="card-header bg-slate-50 flex items-center justify-between py-3.5 px-5">
              <div>
                <h3 className="section-title font-sans">Rekapitulasi Mutasi Stock Ledger Seluruh Item</h3>
                <p className="text-xs text-slate-500 mt-0.5 font-sans">
                  Detail Saldo Awal, Penerimaan (+), Pengeluaran (-), dan Saldo Akhir (Stok Tersedia) per item
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="badge badge-purple text-xs font-bold font-sans">Metode FEFO / FIFO</span>
                <span className="text-xs text-slate-500 font-bold font-sans">Total: {filteredRecap.length} item</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse table-auto font-sans">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    <th className="py-3 px-3" style={{ width: '130px' }}>Kode / SKU</th>
                    <th className="py-3 px-3" style={{ minWidth: '220px' }}>Nama Item</th>
                    <th className="py-3 px-3 text-center" style={{ width: '80px' }}>Satuan</th>
                    <th className="py-3 px-3 text-right" style={{ width: '110px' }}>Saldo Awal</th>
                    <th className="py-3 px-3 text-right" style={{ width: '120px' }}>Penerimaan (+)</th>
                    <th className="py-3 px-3 text-right" style={{ width: '120px' }}>Pengeluaran (-)</th>
                    <th className="py-3 px-3 text-right" style={{ width: '150px' }}>Saldo Akhir (Stok Tersedia)</th>
                    <th className="py-3 px-3 text-center" style={{ width: '120px' }}>Metode Valuasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white text-xs">
                  {filteredRecap.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-slate-400">Tidak ada data rekapitulasi stock ledger</td>
                    </tr>
                  ) : (
                    filteredRecap.map(r => (
                      <tr key={r.id} className="hover:bg-blue-50/30 transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-slate-600 whitespace-nowrap">{r.itemCode || r.skuCode || '—'}</td>
                        <td className="py-3 px-3">
                          <button
                            className="text-left font-bold text-primary-700 hover:text-primary-900 hover:underline leading-tight"
                            onClick={() => setSelectedItem(r.id)}
                          >
                            {r.itemName}
                          </button>
                        </td>
                        <td className="py-3 px-3 text-center font-medium text-slate-500 whitespace-nowrap">{r.baseUnit || r.unit || 'Unit'}</td>
                        <td className="py-3 px-3 text-right font-sans font-bold text-slate-700 whitespace-nowrap">{fmtNum(r.saldoAwal)}</td>
                        <td className="py-3 px-3 text-right font-sans font-extrabold text-emerald-600 whitespace-nowrap">+{fmtNum(r.penerimaan)}</td>
                        <td className="py-3 px-3 text-right font-sans font-extrabold text-red-600 whitespace-nowrap">-{fmtNum(r.pengeluaran)}</td>
                        <td className="py-3 px-3 text-right font-sans font-extrabold text-blue-700 text-sm whitespace-nowrap">{fmtNum(r.saldoAkhir)}</td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <span className="badge badge-teal text-[10px] font-bold">FEFO / FIFO</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Single Item Stock Ledger & Mutation Table */}
      {selectedItem && selectedItem !== 'ALL_ITEMS' && (
        <div className="space-y-6 font-sans">
          {/* Detail Batch (Urutan FEFO / FIFO) */}
          <div className="card font-sans overflow-hidden">
            <div className="card-header bg-slate-50 flex items-center justify-between py-3.5 px-5">
              <div>
                <span className="section-title font-sans">Detail Batch & Kadaluarsa — {selectedItemObj?.itemName}</span>
                <p className="text-xs text-slate-400 mt-0.5 font-sans">
                  Deplesi stok menggunakan skema FEFO (First Expiry Date First Out) & FIFO (First In First Out)
                </p>
              </div>
              <span className="badge badge-teal text-xs font-bold">FEFO & FIFO Active</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse table-auto text-xs">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    <th className="py-3 px-3 text-center" style={{ width: '40px' }}>#</th>
                    <th className="py-3 px-3" style={{ width: '140px' }}>No. Batch</th>
                    <th className="py-3 px-3" style={{ width: '130px' }}>Tgl Kadaluarsa</th>
                    <th className="py-3 px-3" style={{ minWidth: '160px' }}>Supplier / PBF</th>
                    <th className="py-3 px-3 text-right" style={{ width: '130px' }}>HPP / Unit (Rp)</th>
                    <th className="py-3 px-3 text-right" style={{ width: '110px' }}>Diterima</th>
                    <th className="py-3 px-3 text-right" style={{ width: '120px' }}>Sisa Stok</th>
                    <th className="py-3 px-3 text-center" style={{ width: '110px' }}>Status Batch</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {itemBatches.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-10 text-slate-400 font-sans">
                        Belum ada batch aktif untuk item ini
                      </td>
                    </tr>
                  ) : itemBatches.map((b, i) => {
                    const days = Math.ceil((new Date(b.expiryDate) - new Date()) / 86400000)
                    const isExpired = days <= 0
                    const isNearExpiry = days > 0 && days <= 180
                    return (
                      <tr
                        key={b.id}
                        className={isExpired ? 'bg-red-50/60' : isNearExpiry ? 'bg-amber-50/60' : 'hover:bg-slate-50'}
                      >
                        <td className="py-3 px-3 text-center font-bold text-slate-400">{i + 1}</td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-800">{b.batchNumber}</td>
                        <td className="py-3 px-3">
                          <span className={`font-medium ${isExpired ? 'text-red-700 font-bold' : isNearExpiry ? 'text-amber-700 font-bold' : 'text-slate-800'}`}>
                            {fmtDate(b.expiryDate)}
                          </span>
                          {isExpired && (
                            <div className="text-[10px] text-red-600 font-bold flex items-center gap-0.5 mt-0.5"><AlertTriangle className="w-2.5 h-2.5" /> Kadaluarsa</div>
                          )}
                          {isNearExpiry && (
                            <div className="text-[10px] text-amber-600 font-bold flex items-center gap-0.5 mt-0.5"><AlertTriangle className="w-2.5 h-2.5" /> {days} hari lagi</div>
                          )}
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-700">{b.supplierName || '—'}</td>
                        <td className="py-3 px-3 text-right font-sans font-bold text-slate-800">{fmtIDR(b.unitCostPrice)}</td>
                        <td className="py-3 px-3 text-right font-sans font-bold text-slate-700">{fmtNum(b.quantityReceived)}</td>
                        <td className="py-3 px-3 text-right font-sans font-extrabold text-blue-700 text-sm">{fmtNum(b.quantityCurrent)}</td>
                        <td className="py-3 px-3 text-center">
                          <span className={`badge text-[10px] font-bold ${isExpired ? 'badge-red' : isNearExpiry ? 'badge-yellow' : b.quantityCurrent === 0 ? 'badge-gray' : 'badge-green'}`}>
                            {isExpired ? 'Kadaluarsa' : isNearExpiry ? 'Hampir ED' : b.quantityCurrent === 0 ? 'Habis' : 'Aktif'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Riwayat Mutasi Stok & Kartu Stok Table with Saldo Awal, Penerimaan, Pengeluaran, Saldo Akhir */}
          <div className="card font-sans overflow-hidden">
            <div className="card-header bg-slate-50 flex items-center justify-between py-3.5 px-5">
              <div>
                <span className="section-title font-sans">Kartu Stok & Mutasi — {selectedItemObj?.itemName}</span>
                <p className="text-xs text-slate-400 mt-0.5 font-sans">{itemChronologicalLedger.length} catatan mutasi persediaan</p>
              </div>
              <span className="badge badge-blue text-xs font-bold">{itemChronologicalLedger.length} Transaksi</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse table-auto text-xs font-sans">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    <th className="py-3 px-3" style={{ width: '140px' }}>Tanggal & Waktu</th>
                    <th className="py-3 px-3" style={{ width: '130px' }}>Tipe Transaksi</th>
                    <th className="py-3 px-3" style={{ width: '140px' }}>No. Referensi</th>
                    <th className="py-3 px-3 text-right" style={{ width: '100px' }}>Saldo Awal</th>
                    <th className="py-3 px-3 text-right" style={{ width: '110px' }}>Penerimaan (+)</th>
                    <th className="py-3 px-3 text-right" style={{ width: '110px' }}>Pengeluaran (-)</th>
                    <th className="py-3 px-3 text-right" style={{ width: '140px' }}>Saldo Akhir (Stok Tersedia)</th>
                    <th className="py-3 px-3 text-right" style={{ width: '120px' }}>HPP / Unit (Rp)</th>
                    <th className="py-3 px-3 text-right" style={{ width: '130px' }}>Total Nilai (Rp)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {itemChronologicalLedger.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-12 text-slate-400 font-sans">
                        Belum ada mutasi stok tercatat untuk item ini
                      </td>
                    </tr>
                  ) : itemChronologicalLedger.map(l => (
                    <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 font-medium text-slate-700 whitespace-nowrap">{fmtDateTime(l.loggedAt || l.transactionDate)}</td>
                      <td className="py-3 px-3">
                        <span className={`badge text-[10px] font-bold ${TRANS_COLORS[l.transactionType] || 'badge-gray'}`}>
                          {TRANS_LABELS[l.transactionType] || l.transactionType}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono font-extrabold text-primary-700 text-xs">{l.referenceNumber || '—'}</td>
                      <td className="py-3 px-3 text-right font-sans font-bold text-slate-600">{fmtNum(l.saldoAwal)}</td>
                      <td className="py-3 px-3 text-right font-sans font-extrabold text-emerald-600">
                        {l.penerimaan > 0 ? `+${fmtNum(l.penerimaan)}` : '—'}
                      </td>
                      <td className="py-3 px-3 text-right font-sans font-extrabold text-red-600">
                        {l.pengeluaran > 0 ? `-${fmtNum(l.pengeluaran)}` : '—'}
                      </td>
                      <td className="py-3 px-3 text-right font-sans font-extrabold text-blue-700 text-sm">{fmtNum(l.saldoAkhir)}</td>
                      <td className="py-3 px-3 text-right font-sans font-bold text-slate-800">{l.unitCost ? fmtIDR(l.unitCost) : '—'}</td>
                      <td className="py-3 px-3 text-right font-sans font-extrabold text-slate-900">{l.totalValue ? fmtIDR(l.totalValue) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Adjustment Modal */}
      <Modal
        open={adjustModal}
        onClose={() => setAdjustModal(false)}
        title="Penyesuaian Stok"
        footer={
          <>
            <button className="btn-secondary px-4 font-bold" onClick={() => setAdjustModal(false)}>
              Batal
            </button>
            <button className="btn-danger px-5 font-bold flex items-center gap-1.5" onClick={handleAdjust}>
              <RotateCcw className="w-4 h-4" /> Proses Penyesuaian
            </button>
          </>
        }
      >
        {adjBatch && (
          <div className="space-y-4 font-sans text-xs">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="font-bold text-amber-900">Batch: {adjBatch.batchNumber}</p>
              <p className="text-amber-800 mt-1">
                Stok saat ini: <strong>{fmtNum(adjBatch.quantityCurrent)}</strong> unit — HPP: {fmtIDR(adjBatch.unitCostPrice)}/unit
              </p>
              <p className="text-amber-800">
                Nilai potensi hapus: <strong>{fmtIDR(adjBatch.quantityCurrent * adjBatch.unitCostPrice)}</strong>
              </p>
            </div>

            <div>
              <label className="form-label font-bold text-slate-700">Tipe Penyesuaian *</label>
              <select
                className="form-select text-xs font-sans"
                value={adjType}
                onChange={e => setAdjType(e.target.value)}
              >
                <option value="REMOVE">
                  Hapus Seluruh Batch (Kadaluarsa/Rusak) — Catat Kerugian Stok
                </option>
                <option value="ADD">Tambah Stok (Koreksi Stok Opname)</option>
                <option value="REDUCE">Kurangi Stok (Koreksi Stok Opname)</option>
              </select>
            </div>

            {adjType !== 'REMOVE' && (
              <div>
                <label className="form-label font-bold text-slate-700">Jumlah Unit *</label>
                <input
                  type="number"
                  className="form-input text-xs font-sans"
                  value={adjQty}
                  onChange={e => setAdjQty(e.target.value)}
                  min={1}
                  placeholder="Masukkan jumlah unit…"
                />
              </div>
            )}

            <div>
              <label className="form-label font-bold text-slate-700">Alasan Penyesuaian *</label>
              <textarea
                className="form-textarea text-xs font-sans"
                rows={3}
                value={adjReason}
                onChange={e => setAdjReason(e.target.value)}
                placeholder="Jelaskan alasan penyesuaian stok secara detail…"
              />
            </div>

            {adjType === 'REMOVE' && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 font-medium">
                <strong>Jurnal otomatis yang akan dibuat:</strong>
                <br />
                Debit 6-17-001 Kerugian Stok Expired/Rusak → Kredit Akun Persediaan
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
