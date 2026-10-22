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
  insertBillingItems,
  updateBilling,
} from '../../lib/db'
import { Plus, Eye, Trash2, CheckCircle, Package, TrendingDown, Layers, Pill, Stethoscope, UserCheck, AlertCircle } from 'lucide-react'
import Modal from '../../components/ui/Modal'
import SearchInput from '../../components/ui/SearchInput'
import SearchableSelect from '../../components/ui/SearchableSelect'
import { StatusBadge } from '../../components/ui/Badge'
import { fmtIDR, fmtDate, fmtNum, todayISO } from '../../utils/format'
import { getAccountCode } from '../../utils/accountMapping'
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
    pharmacyItems, invBatches, stockLedger, stockOutflows, stockOutflowItems, billings, billingItems,
    branches, activeBranchId, refreshAll, doctors, appSettings
  } = useStore()

  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')

  // Form states - Outflow Manual
  const [outflowDate, setOutflowDate] = useState(todayISO())
  const [outflowType, setOutflowType] = useState('INTERNAL_USE')
  const [description, setDescription] = useState('')
  const [items, setItems] = useState([])

  // Form states - Pengeluaran Obat Pasien (Apotek / Farmasi)
  const [selectedBillingId, setSelectedBillingId] = useState('')
  const [patientMedItems, setPatientMedItems] = useState([])
  const [isSavingPatientMed, setIsSavingPatientMed] = useState(false)

  const effectiveBranchId = useMemo(() => {
    return activeBranchId || (branches && branches[0]?.id) || 'f265df27-e277-4775-8b1d-5f28e585599a'
  }, [activeBranchId, branches])

  const outflows = stockOutflows || []
  const outflowItems = stockOutflowItems || []

  const outflowNumber = useMemo(() => {
    const d = new Date()
    const ym = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`
    return `OUT/${ym}/${String((outflows || []).length + 1).padStart(5, '0')}`
  }, [outflows])

  const activePharmacyItems = useMemo(() => {
    const list = pharmacyItems || []
    return list.filter(i => (i.isActive !== false && i.is_active !== false))
  }, [pharmacyItems])

  const activeBatches = useMemo(() => {
    return invBatches || []
  }, [invBatches])

  const getItemStock = (itemId) => {
    if (!itemId) return 0

    // 1. Calculate stock from inventory batches
    const batchList = activeBatches || []
    const batchStock = batchList
      .filter(b => (b.itemId === itemId || b.item_id === itemId) && Number(b.quantityCurrent ?? b.quantity_current ?? 0) > 0)
      .reduce((sum, b) => sum + Number(b.quantityCurrent ?? b.quantity_current ?? 0), 0)

    // 2. Calculate stock from stock ledger cards (Kartu Stok)
    const ledgerSource = stockLedger || []
    const bItemsSource = billingItems || []

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
          const billing = (billings || []).find(b => b.id === (bi.billingId || bi.billing_id))
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
    [activePharmacyItems, activeBatches, stockLedger, billingItems, billings]
  )

  // Consolidate billing-related outflows from store stock ledger & billing_items
  const billingOutflows = useMemo(() => {
    const ledgerSource = stockLedger || []
    const billingSource = billings || []
    const bItemsSource = billingItems || []
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
          const isPaid = billing?.status === 'PAID'

          list.push({
            id: s.id,
            date: s.loggedAt || s.logged_at || s.transactionDate || s.transaction_date,
            referenceNumber: sRef,
            itemName: item?.itemName || item?.item_name || 'Obat / BHP Kasir',
            quantity: qOut,
            unitCost: uCost,
            totalValue: Number(s.totalValue ?? s.total_value ?? (qOut * uCost)),
            source: 'BILLING',
            patientName: billing?.patientName || billing?.patient_name || '-',
            isPaid,
            paymentStatus: isPaid ? 'LUNAS' : 'BELUM LUNAS'
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
            const isPaid = billing.status === 'PAID'

            list.push({
              id: bi.id,
              date: billing.visitDate || billing.visit_date || billing.createdAt || billing.created_at,
              referenceNumber: bNum,
              itemName: bi.itemName || bi.item_name || item?.itemName || item?.item_name || 'Obat / BHP Kasir',
              quantity: qty,
              unitCost: itemCost,
              totalValue: qty * itemCost,
              source: 'BILLING',
              patientName: billing.patientName || billing.patient_name || '-',
              isPaid,
              paymentStatus: isPaid ? 'LUNAS' : 'BELUM LUNAS'
            })
          }
        })
    }

    return list.sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [stockLedger, billings, billingItems, activePharmacyItems])

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

  // ── Patient Medicine Outflow Helpers ─────────────────────────
  const patientBillingOptions = useMemo(() => {
    return (billings || [])
      .filter(b => {
        const s = (b.status || '').toUpperCase()
        return s === 'UNPAID' || s === 'BELUM_LUNAS' || s === 'DRAFT' || s === 'PENDING'
      })
      .map(b => {
        const doc = (doctors || []).find(d => d.id === (b.doctorId || b.doctor_id))
        const docName = doc?.fullName || doc?.full_name || 'Dokter Pemeriksa'
        const pName = b.patientName || b.patient_name || 'Pasien'
        const bNum = b.billingNumber || b.billing_number || 'INV'
        const mrn = b.patientMRN || b.patient_mrn || '-'
        const date = fmtDate(b.visitDate || b.visit_date || b.createdAt || b.created_at)
        return {
          value: b.id,
          label: `${bNum} — ${pName} (RM: ${mrn}) | ${date} [BELUM LUNAS]`,
          billing: b,
          docName
        }
      })
  }, [billings, doctors])

  const selectedBilling = useMemo(() => {
    if (!selectedBillingId) return null
    return (billings || []).find(b => b.id === selectedBillingId) || null
  }, [billings, selectedBillingId])

  const existingBillingMeds = useMemo(() => {
    if (!selectedBillingId) return []
    return (billingItems || []).filter(i => (i.billingId === selectedBillingId || i.billing_id === selectedBillingId) && (i.itemType === 'PHARMACY' || i.item_type === 'PHARMACY'))
  }, [billingItems, selectedBillingId])

  const resetPatientMedForm = () => {
    setSelectedBillingId('')
    setPatientMedItems([{
      id: uuidv4(),
      itemId: '',
      itemName: '',
      quantity: 1,
      sellPrice: 0,
      unitCost: 0,
      totalPrice: 0,
      totalCost: 0,
      unit: 'Unit',
      notes: ''
    }])
  }

  const addPatientMedLine = () => {
    setPatientMedItems(prev => [
      ...prev,
      {
        id: uuidv4(),
        itemId: '',
        itemName: '',
        quantity: 1,
        sellPrice: 0,
        unitCost: 0,
        totalPrice: 0,
        totalCost: 0,
        unit: 'Unit',
        notes: ''
      }
    ])
  }

  const removePatientMedLine = (id) => {
    setPatientMedItems(prev => prev.filter(i => i.id !== id))
  }

  const updatePatientMedLine = (id, field, value) => {
    setPatientMedItems(prev => prev.map(item => {
      if (item.id !== id) return item
      const updated = { ...item, [field]: value }
      const targetItemId = field === 'itemId' ? value : updated.itemId
      const reqQty = field === 'quantity' ? Math.max(1, parseInt(value) || 1) : Math.max(1, parseInt(updated.quantity) || 1)

      if (targetItemId) {
        const pItem = activePharmacyItems.find(p => p.id === targetItemId)
        if (pItem) {
          updated.itemName = pItem.itemName || pItem.item_name
          updated.unit = pItem.baseUnit || pItem.base_unit || 'Unit'
          const purchaseCost = Number(pItem.purchasePrice || pItem.purchase_price || pItem.hpp || 0)
          const baseSale = Number(pItem.salePrice || pItem.sale_price || Math.round(purchaseCost * 1.25))

          if (field === 'itemId') {
            updated.sellPrice = baseSale
          }
          const itemBatches = activeBatches.filter(b => (b.itemId === targetItemId || b.item_id === targetItemId) && Number(b.quantityCurrent ?? b.quantity_current ?? 0) > 0)
          const { totalValuation, avgUnitCost } = calculateFifoValuation(itemBatches, reqQty, purchaseCost)
          updated.quantity = reqQty
          updated.unitCost = avgUnitCost
          updated.totalCost = totalValuation
          updated.totalPrice = reqQty * (Number(updated.sellPrice) || 0)
        }
      }

      if (field === 'sellPrice') {
        const prc = parseFloat(value) || 0
        updated.sellPrice = prc
        updated.totalPrice = (parseFloat(updated.quantity) || 0) * prc
      }

      if (field === 'quantity') {
        updated.quantity = reqQty
        updated.totalPrice = reqQty * (Number(updated.sellPrice) || 0)
      }

      return updated
    }))
  }

  const handleSavePatientMedicine = async () => {
    if (!selectedBilling) {
      toast.error('Silakan pilih data billing pasien terlebih dahulu')
      return
    }

    const bStatus = (selectedBilling.status || '').toUpperCase()
    if (bStatus === 'PAID' || bStatus === 'LUNAS') {
      toast.error('Billing pasien ini sudah LUNAS. Obat tidak dapat dikeluarkan untuk transaksi yang sudah lunas.')
      return
    }

    const validItems = patientMedItems.filter(i => i.itemId && Number(i.quantity) > 0)
    if (validItems.length === 0) {
      toast.error('Minimal harus ada 1 obat valid dengan kuantitas > 0')
      return
    }

    // Check stock
    for (const item of validItems) {
      const avail = getItemStock(item.itemId)
      if (avail === 0) {
        toast.error(`Stok "${item.itemName}" kosong (0 unit). Tidak dapat mengeluarkan obat ini.`)
        return
      }
      if (item.quantity > avail) {
        toast.error(`Stok "${item.itemName}" tidak mencukupi (Tersedia: ${avail}, Diminta: ${item.quantity}).`)
        return
      }
    }

    setIsSavingPatientMed(true)
    const now = new Date().toISOString()
    const billingNum = selectedBilling.billingNumber || selectedBilling.billing_number || 'INV'
    const patientDisplay = selectedBilling.patientName || selectedBilling.patient_name || 'Pasien'
    const outflowId = uuidv4()
    const outNum = `OUT-MED/${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}/${Math.floor(10000 + Math.random() * 90000)}`

    try {
      let totalHpp = 0
      const ledgerEntries = []
      const newBillingItems = []
      const newOutflowItems = []

      for (const item of validItems) {
        const itemBatches = activeBatches.filter(b => (b.itemId === item.itemId || b.item_id === item.itemId) && Number(b.quantityCurrent ?? b.quantity_current ?? 0) > 0)
        const pItem = activePharmacyItems.find(p => p.id === item.itemId)
        const purchaseCost = Number(pItem?.purchasePrice || pItem?.purchase_price || pItem?.hpp || 0)

        // FIFO valuation
        const { totalValuation, avgUnitCost, fifoBreakdown } = calculateFifoValuation(itemBatches, item.quantity, purchaseCost)
        totalHpp += totalValuation

        // FEFO Physical Stock Depletion
        const physicalUpdates = depleteFefoPhysicalStock(itemBatches, item.quantity)
        for (const update of physicalUpdates) {
          if (update.batchId) {
            await updateBatchQty(update.batchId, update.newQtyCurrent)
          }
        }

        // Ledger logging
        let currentItemBalance = getItemStock(item.itemId)
        for (const fifoPart of fifoBreakdown) {
          currentItemBalance -= fifoPart.qty
          ledgerEntries.push({
            id: uuidv4(),
            batchId: fifoPart.batchId,
            itemId: item.itemId,
            transactionType: 'BILLING',
            referenceId: selectedBilling.id,
            referenceNumber: billingNum,
            quantityIn: 0,
            quantityOut: fifoPart.qty,
            balanceAfter: Math.max(0, currentItemBalance),
            unitCost: Number(fifoPart.unitCost || 0),
            totalValue: Number(fifoPart.totalCost || 0),
            notes: `Obat Pasien: ${patientDisplay} (${billingNum}) [${item.notes || 'Resep Obat'}]`,
            loggedAt: now,
          })
        }

        // Billing Item row
        const lineTotal = Number(item.quantity) * Number(item.sellPrice || 0)
        newBillingItems.push({
          id: uuidv4(),
          billingId: selectedBilling.id,
          itemType: 'PHARMACY',
          pharmacyItemId: item.itemId,
          serviceTariffId: null,
          itemId: item.itemId,
          itemName: item.itemName,
          quantity: Number(item.quantity),
          unitPrice: Number(item.sellPrice || 0),
          totalPrice: lineTotal,
          discountPct: 0
        })

        // Outflow entry item
        newOutflowItems.push({
          id: uuidv4(),
          outflowId,
          itemId: item.itemId,
          itemName: item.itemName,
          quantity: Number(item.quantity),
          unitCost: avgUnitCost,
          totalCost: totalValuation,
          notes: `Obat Pasien: ${patientDisplay} (${billingNum})`
        })
      }

      // 1. Insert billing items to database
      await insertBillingItems(newBillingItems)

      // 2. Insert stock ledger cards to database
      if (ledgerEntries.length > 0) {
        await insertStockLedger(ledgerEntries)
      }

      // 3. Create stock outflow entry for pharmacy audit history
      await insertStockOutflow({
        id: outflowId,
        branchId: effectiveBranchId,
        outflowNumber: outNum,
        outflowDate: todayISO(),
        outflowType: 'INTERNAL_USE',
        description: `Pengeluaran Obat Pasien: ${patientDisplay} (No. Billing: ${billingNum})`,
        totalValue: totalHpp,
        status: 'POSTED',
        journalEntryId: null,
        createdBy: 'Farmasi/Apotek',
        createdAt: now,
        updatedAt: now,
      })
      await insertStockOutflowItems(newOutflowItems)

      // 4. Update patient_billings totals in database
      const addedPharmacySubtotal = newBillingItems.reduce((sum, it) => sum + (it.totalPrice || 0), 0)
      const currentPharmSubtotal = Number(selectedBilling.subtotalPharmacy || selectedBilling.subtotal_pharmacy || 0)
      const currentDoctorSvc = Number(selectedBilling.subtotalDoctorServices || selectedBilling.subtotal_doctor_services || 0)
      const currentLab = Number(selectedBilling.subtotalLab || selectedBilling.subtotal_lab || 0)
      const currentSvcSubtotal = Number(selectedBilling.subtotalServices || selectedBilling.subtotal_services || (currentDoctorSvc + currentLab))
      const currentDiscount = Number(selectedBilling.discountAmount || selectedBilling.discount_amount || 0)

      const updatedPharmSubtotal = currentPharmSubtotal + addedPharmacySubtotal
      // PPN 11% is strictly applied on pharmacy items
      const updatedPpn = Math.round(updatedPharmSubtotal * 0.11)
      const updatedGrandTotal = Math.max(0, currentSvcSubtotal + updatedPharmSubtotal + updatedPpn - currentDiscount)

      const payMethod = selectedBilling.paymentMethod || selectedBilling.payment_method || 'TUNAI'
      let patientPortion = updatedGrandTotal
      let insurancePortion = 0
      if (payMethod === 'BPJS') {
        insurancePortion = Math.round(updatedGrandTotal * 0.8)
        patientPortion = updatedGrandTotal - insurancePortion
      } else if (payMethod === 'ASURANSI') {
        insurancePortion = updatedGrandTotal
        patientPortion = 0
      }

      await updateBilling(selectedBilling.id, {
        subtotal_pharmacy: updatedPharmSubtotal,
        ppn_amount: updatedPpn,
        grand_total: updatedGrandTotal,
        patient_portion: patientPortion,
        insurance_portion: insurancePortion,
        updated_at: now
      })

      // 5. Refresh full store state across all components in real time!
      await refreshAll()

      toast.success(`Pengeluaran obat untuk ${patientDisplay} berhasil! Data otomatis terupdate di billing pasien.`)
      setModal('billing')
      resetPatientMedForm()
    } catch (err) {
      console.error('[handleSavePatientMedicine] Error:', err)
      toast.error(`Gagal menyimpan pengeluaran obat: ${err.message}`)
    } finally {
      setIsSavingPatientMed(false)
    }
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

      // Journal entry creation using dynamic account mapping
      const OUTFLOW_EXPENSE_MAP = {
        INTERNAL_USE: getAccountCode('outflow_internal', appSettings, '6-18-001'),
        SAMPLE: getAccountCode('outflow_sample', appSettings, '6-17-001'),
        DONATION: getAccountCode('outflow_donation', appSettings, '6-91-002'),
        WASTE: getAccountCode('outflow_waste', appSettings, '6-18-001'),
        OTHER: getAccountCode('outflow_other', appSettings, '6-18-006'),
      }
      const targetExpenseAccount = OUTFLOW_EXPENSE_MAP[outflowType] || getAccountCode('outflow_internal', appSettings, '6-18-001')
      const entryNumber = `OUT/${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}/${Math.floor(10000 + Math.random() * 90000)}`

      const inventoryCredits = {}
      processedItems.forEach(item => {
        const pharmacyItem = activePharmacyItems.find(p => p.id === item.itemId)
        const isBHP = pharmacyItem?.category === 'BHP' || pharmacyItem?.category === 'PEMAKAIAN BHP' || (pharmacyItem?.itemCode || pharmacyItem?.item_code || '').startsWith('BHP-')
        const isOTC = (pharmacyItem?.category || pharmacyItem?.itemCategory || '').toUpperCase().includes('OTC') || (pharmacyItem?.category || pharmacyItem?.itemCategory || '').toUpperCase().includes('GENERIK') || (pharmacyItem?.category || pharmacyItem?.itemCategory || '').toUpperCase().includes('BEBAS')
        const defaultInv = isBHP ? getAccountCode('inv_bhp', appSettings, '1-13-003') : (isOTC ? getAccountCode('inv_otc', appSettings, '1-13-002') : getAccountCode('inv_ethical', appSettings, '1-13-001'))
        const itemInv = pharmacyItem?.coaInventoryCode || pharmacyItem?.coa_inventory_code
        const accCode = (itemInv && !['1-13-001', '1-13-002', '1-13-003'].includes(itemInv)) ? itemInv : defaultInv
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
      await refreshAll()
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
        <div className="flex gap-2">
          <button
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm text-white shadow-sm transition-all font-sans"
            style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}
            onClick={() => { resetPatientMedForm(); setModal('patient_medicine') }}
          >
            <Pill className="w-4 h-4" />Pengeluaran Obat Pasien
          </button>
          <button className="btn-primary font-sans" onClick={() => { resetForm(); setModal('new') }}>
            <Plus className="w-4 h-4" />Pengeluaran Baru
          </button>
        </div>
      </div>

      {/* Modern Compact Score Cards — Vibrant Solid Colors */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-xl p-3.5 shadow-sm" style={{ background: '#2563EB' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-blue-100 font-sans">Total Outflow Manual</p>
              <p className="text-xl font-extrabold text-white tracking-tight font-sans mt-0.5">
                {fmtNum((outflows || []).length)} <span className="text-xs font-semibold text-blue-200 font-sans">transaksi</span>
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
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-100 font-sans">Total Kuantitas Outflow</p>
              <p className="text-xl font-extrabold text-white tracking-tight font-sans mt-0.5">
                {fmtNum(totalQtyOut)} <span className="text-xs font-semibold text-emerald-200 font-sans">unit</span>
              </p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-white/20 text-white flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div className="rounded-xl p-3.5 shadow-sm" style={{ background: '#7C3AED' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-purple-100 font-sans">Total Nilai HPP</p>
              <p className="text-xl font-extrabold text-white tracking-tight font-mono mt-0.5">
                {fmtIDR(totalValueOut)}
              </p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-white/20 text-white flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div className="rounded-xl p-3.5 shadow-sm" style={{ background: '#D97706' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-100 font-sans">Riwayat Billing Kasir</p>
              <p className="text-xl font-extrabold text-white tracking-tight font-sans mt-0.5">
                {fmtNum(billingOutflows.length)} <span className="text-xs font-semibold text-amber-200 font-sans">item</span>
              </p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-white/20 text-white flex items-center justify-center">
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
                  <th className="py-2.5 px-2.5" style={{ width: '90px' }}>Tanggal</th>
                  <th className="py-2.5 px-2.5" style={{ width: '130px' }}>No. Billing</th>
                  <th className="py-2.5 px-2.5" style={{ minWidth: '130px' }}>Nama Pasien</th>
                  <th className="py-2.5 px-2.5" style={{ minWidth: '160px' }}>Item Obat</th>
                  <th className="py-2.5 px-2.5 text-right" style={{ width: '50px' }}>Qty</th>
                  <th className="py-2.5 px-2.5 text-right" style={{ width: '100px' }}>Harga Pokok</th>
                  <th className="py-2.5 px-2.5 text-right" style={{ width: '110px' }}>Total Nilai</th>
                  <th className="py-2.5 px-2.5 text-center" style={{ width: '120px' }}>Status Pembayaran</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white text-[11px]">
                {billingOutflows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-slate-400">
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
                      <td className="py-2 px-2.5 text-center whitespace-nowrap">
                        {o.isPaid ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-sm">
                            ✓ LUNAS
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-extrabold bg-red-100 text-red-800 border border-red-300 shadow-sm">
                            ⚠ BELUM LUNAS
                          </span>
                        )}
                      </td>
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
                    <td></td>
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

      {/* ═══ Patient Medicine Outflow Modal ═══════════════════════ */}
      <Modal
        open={modal === 'patient_medicine'}
        onClose={() => setModal(null)}
        title="Pengeluaran Obat Pasien (Apotek/Farmasi)"
        size="xl"
      >
        <div className="space-y-5">
          {/* Step 1: Select Billing */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-slate-700 font-sans">Pilih Data Billing Pasien <span className="text-red-500">*</span></label>
            <SearchableSelect
              value={selectedBillingId}
              onChange={val => setSelectedBillingId(val)}
              options={patientBillingOptions}
              placeholder="— Cari billing pasien (Nama / MRN / No. Invoice) —"
              searchPlaceholder="Ketik nama pasien, MRN, atau nomor invoice..."
            />
          </div>

          {/* Patient Info Card */}
          {selectedBilling && (
            <div className="rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-base font-extrabold text-emerald-900 font-sans">
                    {selectedBilling.patientName || selectedBilling.patient_name || 'Pasien'}
                  </p>
                  <p className="text-xs text-emerald-600 font-sans">
                    RM: {selectedBilling.patientMRN || selectedBilling.patient_mrn || '-'} &bull; {selectedBilling.billingNumber || selectedBilling.billing_number}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs text-slate-600">
                <div><span className="font-semibold">Tanggal:</span> {fmtDate(selectedBilling.visitDate || selectedBilling.visit_date)}</div>
                <div><span className="font-semibold">Dokter:</span> {patientBillingOptions.find(o => o.value === selectedBillingId)?.docName || '-'}</div>
                <div><span className="font-semibold">Bayar:</span> {selectedBilling.paymentMethod || selectedBilling.payment_method || 'TUNAI'}</div>
              </div>

              {existingBillingMeds.length > 0 && (
                <div className="mt-3 p-2.5 rounded-lg bg-amber-50 border border-amber-200">
                  <div className="flex items-center gap-1.5 text-amber-700 text-xs font-bold mb-1">
                    <AlertCircle className="w-3.5 h-3.5" /> Obat yang sudah diinput pada billing ini:
                  </div>
                  <ul className="list-disc ml-5 text-xs text-amber-800 space-y-0.5">
                    {existingBillingMeds.map(m => (
                      <li key={m.id}>{m.itemName || m.item_name} × {m.quantity} — {fmtIDR(m.totalPrice || m.total_price || 0)}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Medicine Items Table */}
          {selectedBilling && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800 font-sans">Daftar Obat yang Dikeluarkan</h3>
                <button
                  type="button"
                  onClick={addPatientMedLine}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition font-sans"
                >
                  <Plus className="w-3.5 h-3.5" /> Tambah Obat
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left border-collapse table-auto">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      <th className="py-2.5 px-2.5" style={{ minWidth: '220px' }}>Item Obat / Farmasi</th>
                      <th className="py-2.5 px-2.5 text-center" style={{ width: '80px' }}>Qty</th>
                      <th className="py-2.5 px-2.5 text-right" style={{ width: '120px' }}>Harga Jual</th>
                      <th className="py-2.5 px-2.5 text-right" style={{ width: '120px' }}>Sub Total</th>
                      <th className="py-2.5 px-2.5 text-right" style={{ width: '100px' }}>HPP/Unit</th>
                      <th style={{ width: '40px' }} className="py-2.5 px-1 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white text-xs">
                    {patientMedItems.map(item => {
                      const avail = item.itemId ? getItemStock(item.itemId) : 0
                      const isOver = item.itemId && item.quantity > avail
                      return (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="py-2 px-2.5">
                            <SearchableSelect
                              value={item.itemId}
                              onChange={val => updatePatientMedLine(item.id, 'itemId', val)}
                              options={pharmacyOptions}
                              placeholder="— Pilih Obat —"
                              hideValue={true}
                              searchPlaceholder="Cari nama obat..."
                            />
                            {item.itemId && (
                              <div className={`flex items-center gap-1 mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                avail > 0 ? 'text-emerald-700 bg-emerald-50' : 'text-red-600 bg-red-50'
                              }`}>
                                <Package className="w-3 h-3" />
                                Stok: <strong>{fmtNum(avail)} {item.unit}</strong>
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-2.5">
                            <input
                              type="number"
                              className={`form-input text-center text-xs py-1 w-20 font-bold ${isOver ? 'border-red-500 text-red-600 bg-red-50 ring-2 ring-red-200' : ''}`}
                              value={item.quantity}
                              min={1}
                              max={avail > 0 ? avail : 1}
                              onChange={e => updatePatientMedLine(item.id, 'quantity', e.target.value)}
                            />
                            {isOver && <p className="text-[10px] text-red-600 font-bold mt-0.5 text-center">Melebihi stok!</p>}
                          </td>
                          <td className="py-2 px-2.5">
                            <input
                              type="number"
                              className="form-input text-right text-xs py-1 w-28 font-semibold"
                              value={item.sellPrice}
                              min={0}
                              onChange={e => updatePatientMedLine(item.id, 'sellPrice', e.target.value)}
                            />
                          </td>
                          <td className="text-right font-sans font-extrabold text-slate-900 text-sm px-2.5">{fmtIDR(item.totalPrice)}</td>
                          <td className="text-right font-sans text-slate-500 text-[11px] px-2.5">{fmtIDR(item.unitCost)}</td>
                          <td className="px-1 text-center">
                            <button type="button" onClick={() => removePatientMedLine(item.id)} className="p-1 text-slate-300 hover:text-red-500">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50">
                      <td colSpan={3} className="text-right font-sans font-bold text-slate-700 pr-4 text-sm">Total Harga Jual</td>
                      <td className="text-right font-sans font-extrabold text-primary-700 text-base px-2.5">
                        {fmtIDR(patientMedItems.reduce((s, i) => s + (i.totalPrice || 0), 0))}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                    <tr className="bg-slate-50/50">
                      <td colSpan={3} className="text-right font-sans text-slate-500 pr-4 text-xs">Total HPP (Cost)</td>
                      <td className="text-right font-sans text-slate-500 text-xs px-2.5">
                        {fmtIDR(patientMedItems.reduce((s, i) => s + (i.totalCost || 0), 0))}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Info Alert */}
              <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-800">
                <Stethoscope className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-bold">Integrasi Otomatis dengan Billing Pasien</p>
                  <p className="mt-0.5 text-blue-600">
                    Obat yang disimpan akan otomatis: (1) Mengurangi stok fisik dengan metode FEFO, 
                    (2) Mencatat HPP dengan metode FIFO di Kartu Stok, 
                    (3) Menambahkan item farmasi ke billing pasien, 
                    (4) Memperbarui total billing pasien secara real-time.
                  </p>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end pt-2">
                <button
                  onClick={handleSavePatientMedicine}
                  disabled={isSavingPatientMed || !selectedBilling || patientMedItems.every(i => !i.itemId)}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-white shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed font-sans"
                  style={{ background: isSavingPatientMed ? '#9CA3AF' : 'linear-gradient(135deg, #10B981, #047857)' }}
                >
                  {isSavingPatientMed ? (
                    <><span className="animate-spin">⏳</span> Menyimpan...</>
                  ) : (
                    <><CheckCircle className="w-4.5 h-4.5" /> Simpan & Keluarkan Obat Pasien</>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
