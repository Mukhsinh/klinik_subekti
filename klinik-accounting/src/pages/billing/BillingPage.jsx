import { useState, useMemo } from 'react'
import { Plus, Eye, CheckCircle, Trash2, Stethoscope, Package, Printer, Pencil, UserCheck, CreditCard } from 'lucide-react'
import { useStore } from '../../store/useStore'
import Modal from '../../components/ui/Modal'
import SearchInput from '../../components/ui/SearchInput'
import { StatusBadge } from '../../components/ui/Badge'
import SearchableSelect from '../../components/ui/SearchableSelect'
import AddPharmacyItemModal from '../../components/billing/AddPharmacyItemModal'
import { exportBillingReceiptPDF } from '../../utils/exportPDF'
import {
  updateBilling, deleteBillingItemsByBilling, insertBillingItems, fetchBillingItems,
  deleteDoctorFeeRecordByBilling, insertDoctorFeeRecord, updateBatchQty,
  insertStockLedger, fetchStockLedger, insertAuditLog
} from '../../lib/db'
import {
  fmtIDR, fmtDate, todayISO,
  calcPPh21Doctor, PPN_RATE, paymentMethodLabel,
} from '../../utils/format'
import toast from 'react-hot-toast'
import { v4 as uuidv4 } from 'uuid'

const PAYMENT_METHODS = ['TUNAI', 'TRANSFER', 'QRIS', 'BPJS', 'ASURANSI']
const BPJS_RATIO = 0.80

export default function BillingPage() {
  const {
    pharmacyItems, invBatches, billings, billingItems, doctors, serviceTariffs,
    generateBillingNumber, saveBilling,
    activeBranchId, saveJournalDraft, postJournalEntry, reverseJournal, generateEntryNumber,
    getItemStock, depleteInventoryFIFO, refreshAll, appSettings,
  } = useStore()

  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [editingBilling, setEditingBilling] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [patientName, setPatientName] = useState('')
  const [patientMRN, setPatientMRN] = useState('')
  const [selectedDoctor, setSelectedDoctor] = useState(null)
  const [visitDate, setVisitDate] = useState(todayISO())
  const [payMethod, setPayMethod] = useState('TUNAI')
  const [bpjsClaimNo, setBpjsClaimNo] = useState('')
  const [serviceLines, setServiceLines] = useState([])
  const [labLines, setLabLines] = useState([])
  const [pharmacyLines, setPharmacyLines] = useState([])
  const [discount, setDiscount] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Modal state for add pharmacy item
  const [showAddPharmModal, setShowAddPharmModal] = useState(false)

  const handleAddPharmItem = (item) => {
    // Check if already exists
    if (pharmacyLines.find(l => l.itemId === item.itemId)) {
      toast.error('Obat ini sudah ditambahkan')
      setShowAddPharmModal(false)
      return
    }

    setPharmacyLines(ls => [...ls, { ...item, id: uuidv4() }])
    setShowAddPharmModal(false)
  }

  const [modalItems, setModalItems] = useState([])
  const [loadingItems, setLoadingItems] = useState(false)

  const handleOpenViewModal = async (b) => {
    setSelected(b)
    setModal('view')
    const inStore = (billingItems || []).filter(i => (i.billingId || i.billing_id) === b.id)
    if (inStore.length > 0) {
      setModalItems(inStore)
    } else {
      setLoadingItems(true)
      try {
        const fetched = await fetchBillingItems([b.id])
        setModalItems(fetched || [])
      } catch (e) {
        console.warn('Failed to fetch modal billing items:', e)
      } finally {
        setLoadingItems(false)
      }
    }
  }

  const viewItems = useMemo(() => {
    if (!selected) return []
    const fromStore = (billingItems || []).filter(i => (i.billingId || i.billing_id) === selected.id)
    return fromStore.length > 0 ? fromStore : modalItems
  }, [billingItems, selected, modalItems])

  const billingNumber = useMemo(() => generateBillingNumber(), [billings])
  const activeDoctors = useMemo(() =>
    (doctors || []).filter(d => d.isActive !== false && d.is_active !== false),
    [doctors]
  )
  const doctorOptions = useMemo(() =>
    activeDoctors.map(d => {
      const dName = d.fullName || d.full_name || d.name || 'Dokter'
      const title = d.title ? `${d.title} ` : ''
      return {
        value: d.id,
        label: `${title}${dName}`.trim(),
        sub: `SIP: ${d.sipNumber || d.sip_number || '—'} | Sp: ${d.specialization || d.specialty || 'Umum'}`
      }
    }),
    [activeDoctors]
  )

  const activeServices = useMemo(() =>
    (serviceTariffs || [])
      .filter(s => (s.isActive !== false && s.is_active !== false) && s.serviceCategory !== 'LABORATORIUM' && s.service_category !== 'LABORATORIUM')
      .sort((a, b) => {
        const codeA = String(a.code || a.service_code || '')
        const codeB = String(b.code || b.service_code || '')
        return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' })
      }),
    [serviceTariffs]
  )
  const serviceOptions = useMemo(() =>
    activeServices.map(s => ({
      value: s.id,
      label: `${s.code || s.service_code || 'SVC'} — ${s.name} (${fmtIDR(s.price || s.tariff || 0)})`,
      price: s.price || s.tariff || 0,
      name: s.name,
      revenueAccountCode: s.revenueAccountCode || s.revenue_account_code || '4-11-001'
    })),
    [activeServices]
  )

  const labServices = useMemo(() =>
    (serviceTariffs || [])
      .filter(s => (s.isActive !== false && s.is_active !== false) && (s.serviceCategory === 'LABORATORIUM' || s.service_category === 'LABORATORIUM' || (s.name || '').toLowerCase().includes('lab')))
      .sort((a, b) => {
        const codeA = String(a.code || a.service_code || '')
        const codeB = String(b.code || b.service_code || '')
        return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' })
      }),
    [serviceTariffs]
  )
  const labOptions = useMemo(() =>
    labServices.map(s => ({
      value: s.id,
      label: `${s.code || s.service_code || 'LAB'} — ${s.name} (${fmtIDR(s.price || s.tariff || 0)})`,
      price: s.price || s.tariff || 0,
      name: s.name,
      revenueAccountCode: s.revenueAccountCode || s.revenue_account_code || '4-12-001'
    })),
    [labServices]
  )

  const pharmacyOptions = useMemo(() =>
    (pharmacyItems || [])
      .filter(i => i.isActive !== false && i.is_active !== false)
      .sort((a, b) => (a.itemName || a.item_name || '').localeCompare(b.itemName || b.item_name || ''))
      .map(i => {
        const stk = (invBatches || []).filter(b => b.itemId === i.id && b.quantityCurrent > 0).reduce((s, b) => s + b.quantityCurrent, 0)
        const catRaw = i.category || i.itemCategory || i.item_category || ''
        let categoryLabel = '📦 Item'
        if (catRaw === 'OBAT_PATEN' || catRaw === 'BRANDED') categoryLabel = '🔵 BRANDED'
        else if (catRaw === 'OBAT_GENERIK' || catRaw === 'GENERIK') categoryLabel = '🟢 GENERIK'
        else if (catRaw === 'BHP' || catRaw === 'BHP_MEDIS') categoryLabel = '🟡 BHP'
        else if (catRaw === 'RUMAH_TANGGA' || catRaw === 'RT') categoryLabel = '🏠 RT'

        const code = i.itemCode || i.skuCode || i.item_code || i.sku_code || 'SKU'
        const name = i.itemName || i.item_name || 'Obat'
        const price = i.sellingPrice || i.selling_price || 0

        return {
          value: i.id,
          label: `${categoryLabel} | ${code} — ${name} | Stok: ${stk}`,
          sub: `Harga: ${fmtIDR(price)}`,
          stock: stk,
          price,
          disabled: stk === 0
        }
      })
      .filter(i => i.stock > 0),
    [pharmacyItems, invBatches]
  )

  const subService = serviceLines.reduce((s, l) => s + (parseFloat(l.qty) || 1) * (parseFloat(l.price) || 0), 0)
  const subLab = labLines.reduce((s, l) => s + (parseFloat(l.qty) || 1) * (parseFloat(l.price) || 0), 0)
  const subPharmacy = pharmacyLines.reduce((s, l) => s + (parseFloat(l.qty) || 0) * (parseFloat(l.price) || 0), 0)
  const discountAmt = parseFloat(discount) || 0

  // Selling price is PPN Exclusive (11% PPN is added on top of pharmacy selling price)
  const ppnAmount = Math.round(subPharmacy * PPN_RATE)
  const grandTotal = Math.max(0, subService + subLab + subPharmacy + ppnAmount - discountAmt)

  const patientPortion = ['BPJS', 'ASURANSI'].includes(payMethod) ? grandTotal * (1 - BPJS_RATIO) : grandTotal
  const insurancePortion = ['BPJS', 'ASURANSI'].includes(payMethod) ? grandTotal * BPJS_RATIO : 0

  // Doctor fee/commission applies ONLY to examination & procedures performed by doctor (serviceLines), excluding lab and pharmacy
  const feeRate = selectedDoctor ? (Number(selectedDoctor.feePercentage ?? selectedDoctor.fee_percentage) || 70) : 70
  const grossDoctorFee = subService * (feeRate / 100)
  const pph21Calc = calcPPh21Doctor(grossDoctorFee)

  const addSvc = (sId) => {
    const s = activeServices.find(x => x.id === sId)
    if (!s) return
    if (serviceLines.find(l => l.serviceId === s.id)) {
      toast.error('Layanan ini sudah ditambahkan.')
      return
    }
    setServiceLines(ls => [...ls, {
      id: uuidv4(),
      serviceId: s.id,
      name: s.name,
      qty: 1,
      price: s.price,
      revenueAccountCode: s.revenueAccountCode || s.revenue_account_code || '4-11-001'
    }])
  }
  const removeSvc = (id) => setServiceLines(ls => ls.filter(l => l.id !== id))

  const addLab = (sId) => {
    const s = labServices.find(x => x.id === sId)
    if (!s) return
    if (labLines.find(l => l.serviceId === s.id)) {
      toast.error('Pemeriksaan lab ini sudah ditambahkan.')
      return
    }
    setLabLines(ls => [...ls, {
      id: uuidv4(),
      serviceId: s.id,
      name: s.name,
      qty: 1,
      price: s.price,
      revenueAccountCode: s.revenueAccountCode || s.revenue_account_code || '4-12-001'
    }])
  }
  const removeLab = (id) => setLabLines(ls => ls.filter(l => l.id !== id))
  const addPharm = () => setPharmacyLines(ls => [...ls, { id: uuidv4(), itemId: '', name: '', qty: 1, price: 0, availableStock: 0 }])
  const removePharm = (id) => setPharmacyLines(ls => ls.filter(l => l.id !== id))
  const setPharm = (id, f, v) => setPharmacyLines(ls => ls.map(l => {
    if (l.id !== id) return l
    const u = { ...l, [f]: v }

    if (f === 'itemId') {
      const it = pharmacyItems.find(i => i.id === v)
      const opt = pharmacyOptions.find(o => o.value === v)
      u.name = it?.itemName || ''
      u.price = it?.sellingPrice || 0
      u.availableStock = opt?.stock || 0 // Store available stock for validation
    }

    if (f === 'qty') {
      const requestedQty = parseInt(v) || 0
      const availableStock = l.availableStock || getItemStock(l.itemId)

      // Show warning if quantity exceeds stock
      if (requestedQty > availableStock) {
        toast.error(`Stok tidak mencukupi! Tersedia: ${availableStock}, Diminta: ${requestedQty}`, {
          duration: 3000,
          icon: '⚠️'
        })
      }
    }

    return u
  }))

  const resetForm = () => {
    setPatientName(''); setPatientMRN(''); setSelectedDoctor(null)
    setVisitDate(todayISO()); setPayMethod('TUNAI'); setBpjsClaimNo('')
    setServiceLines([]); setLabLines([]); setPharmacyLines([]); setDiscount(0)
  }

  const handleRegisterPatient = async () => {
    if (isSubmitting) return
    if (!patientName.trim()) { toast.error('Nama pasien wajib diisi.'); return }
    if (!serviceLines.length && !labLines.length && !pharmacyLines.length) { toast.error('Minimal 1 item layanan, lab, atau farmasi.'); return }

    setIsSubmitting(true)
    try {
      const docName = selectedDoctor ? `${selectedDoctor.title || ''} ${selectedDoctor.fullName}`.trim() : ''
      const bId = uuidv4()
      const items = [
        ...serviceLines.map(l => ({ id: uuidv4(), billingId: bId, itemType: 'SERVICE', itemName: l.name, serviceTariffId: l.serviceId || l.id || null, quantity: l.qty, unitPrice: l.price, totalPrice: l.qty * l.price, discountPct: 0 })),
        ...labLines.map(l => ({ id: uuidv4(), billingId: bId, itemType: 'LAB', itemName: l.name, serviceTariffId: l.serviceId || l.id || null, quantity: l.qty, unitPrice: l.price, totalPrice: l.qty * l.price, discountPct: 0 })),
        ...pharmacyLines.filter(l => l.itemId).map(l => ({ id: uuidv4(), billingId: bId, itemType: 'PHARMACY', itemName: l.name, pharmacyItemId: l.itemId, quantity: l.qty, unitPrice: l.price, totalPrice: l.qty * l.price, discountPct: 0 })),
      ]
      const billing = {
        id: bId,
        branchId: activeBranchId,
        billingNumber,
        patientName,
        patientMRN,
        doctorId: selectedDoctor?.id || null,
        doctorName: docName,
        visitDate,
        paymentMethod: payMethod,
        bpjsClaimNumber: bpjsClaimNo,
        subtotalDoctorServices: subService,
        subtotalLab: subLab,
        subtotalServices: subService + subLab,
        subtotalPharmacy: subPharmacy,
        discountAmount: discountAmt,
        ppnAmount,
        grandTotal,
        patientPortion,
        insurancePortion,
        status: 'UNPAID',
        createdBy: 'Pendaftaran / Kasir',
        journalEntryId: null,
      }

      await saveBilling(billing, items)
      await refreshAll()
      toast.success(`Pendaftaran ${billingNumber} (${patientName}) berhasil disimpan. Status: BELUM LUNAS.`)
      setModal(null)
      resetForm()
    } catch (err) {
      console.error('[handleRegisterPatient] Error:', err)
      toast.error(`Gagal menyimpan pendaftaran: ${err.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCheckout = async () => {
    if (isSubmitting) return
    if (!patientName.trim()) { toast.error('Nama pasien wajib diisi.'); return }
    if (!serviceLines.length && !labLines.length && !pharmacyLines.length) { toast.error('Minimal 1 item layanan, lab, atau farmasi.'); return }

    setIsSubmitting(true)
    try {
      // Validation: check stock limit for each pharmacy item
      for (const line of pharmacyLines.filter(l => l.itemId)) {
        const requestedQty = parseInt(line.qty) || 0
        if (requestedQty <= 0) {
          toast.error('Jumlah pembelian obat harus lebih besar dari 0.')
          return
        }
        const available = getItemStock(line.itemId)
        if (requestedQty > available) {
          toast.error(`Stok obat "${line.name}" tidak mencukupi. (Tersedia: ${available}, Diminta: ${requestedQty})`)
          return
        }
      }

      const docName = selectedDoctor ? `${selectedDoctor.title || ''} ${selectedDoctor.fullName}`.trim() : ''
      const bId = uuidv4()
      const eId = uuidv4()
      const items = [
        ...serviceLines.map(l => ({ id: uuidv4(), billingId: bId, itemType: 'SERVICE', itemName: l.name, serviceTariffId: l.serviceId || l.id || null, quantity: l.qty, unitPrice: l.price, totalPrice: l.qty * l.price, discountPct: 0 })),
        ...labLines.map(l => ({ id: uuidv4(), billingId: bId, itemType: 'LAB', itemName: l.name, serviceTariffId: l.serviceId || l.id || null, quantity: l.qty, unitPrice: l.price, totalPrice: l.qty * l.price, discountPct: 0 })),
        ...pharmacyLines.filter(l => l.itemId).map(l => ({ id: uuidv4(), billingId: bId, itemType: 'PHARMACY', itemName: l.name, pharmacyItemId: l.itemId, quantity: l.qty, unitPrice: l.price, totalPrice: l.qty * l.price, discountPct: 0 })),
      ]
      const billing = {
        id: bId, branchId: activeBranchId, billingNumber, patientName, patientMRN,
        doctorId: selectedDoctor?.id || null, doctorName: docName,
        visitDate, paymentMethod: payMethod, bpjsClaimNumber: bpjsClaimNo,
        subtotalDoctorServices: subService,
        subtotalLab: subLab,
        subtotalServices: subService + subLab,
        subtotalPharmacy: subPharmacy,
        discountAmount: discountAmt, ppnAmount, grandTotal, patientPortion, insurancePortion,
        status: 'PAID', createdBy: 'Kasir',
        journalEntryId: eId,
      }

      // Consolidate HPP / COGS journal entries and deplete stock
      const hppDebits = {}
      const hppCredits = {}

      try {
        for (const line of pharmacyLines.filter(l => l.itemId)) {
          const qtyToDeplete = parseInt(line.qty) || 0
          const cogsDetails = await depleteInventoryFIFO(line.itemId, qtyToDeplete, billingNumber, bId)
          cogsDetails.forEach(d => {
            const val = d.qty * d.unitCostPrice
            if (val > 0) {
              hppDebits[d.coaCOGSCode] = (hppDebits[d.coaCOGSCode] || 0) + val
              hppCredits[d.coaInventoryCode] = (hppCredits[d.coaInventoryCode] || 0) + val
            }
          })
        }
      } catch (err) {
        toast.error(err.message)
        return
      }

      const eNum = generateEntryNumber('BILLING')
      const journalItems = []

      if (['TUNAI', 'QRIS', 'TRANSFER', 'MIXED'].includes(payMethod)) {
        journalItems.push({ id: uuidv4(), journalEntryId: eId, accountCode: '1-11-002', description: `Kas Tunai — ${billingNumber}`, debit: grandTotal, credit: 0 })
      } else if (payMethod === 'BPJS') {
        journalItems.push({ id: uuidv4(), journalEntryId: eId, accountCode: '1-11-002', description: `Bayar Pasien BPJS — ${billingNumber}`, debit: patientPortion, credit: 0 })
        journalItems.push({ id: uuidv4(), journalEntryId: eId, accountCode: '1-12-001', description: `Piutang BPJS — ${billingNumber}`, debit: insurancePortion, credit: 0 })
      } else {
        journalItems.push({ id: uuidv4(), journalEntryId: eId, accountCode: '1-11-002', description: `Bayar Pasien Asuransi — ${billingNumber}`, debit: patientPortion, credit: 0 })
        journalItems.push({ id: uuidv4(), journalEntryId: eId, accountCode: '1-12-002', description: `Piutang Asuransi — ${billingNumber}`, debit: insurancePortion, credit: 0 })
      }

      // Group revenue by account code from service tariff
      const revenueByAccount = {}
      serviceLines.forEach(l => {
        const accCode = l.revenueAccountCode || '4-11-001'
        revenueByAccount[accCode] = (revenueByAccount[accCode] || 0) + (l.qty * l.price)
      })
      labLines.forEach(l => {
        const accCode = l.revenueAccountCode || '4-12-001'
        revenueByAccount[accCode] = (revenueByAccount[accCode] || 0) + (l.qty * l.price)
      })

      // Add revenue entries
      Object.entries(revenueByAccount).forEach(([accCode, amount]) => {
        if (amount > 0) {
          const accDesc = accCode === '4-11-003' ? 'Pendapatan Tindakan Medis & BHP' : accCode === '4-12-001' ? 'Pendapatan Laboratorium' : 'Pendapatan Konsultasi Dokter'
          journalItems.push({ id: uuidv4(), journalEntryId: eId, accountCode: accCode, description: `${accDesc} — ${billingNumber}`, debit: 0, credit: amount })
        }
      })

      // Group pharmacy revenue by item master COA revenue account (DPP = selling price)
      const pharmacyRevAccounts = {}
      pharmacyLines.filter(l => l.itemId).forEach(l => {
        const lineVal = (parseFloat(l.qty) || 0) * (parseFloat(l.price) || 0)
        if (lineVal > 0) {
          const item = pharmacyItems.find(p => p.id === l.itemId)
          const isBHP = item?.category === 'BHP' || item?.category === 'PEMAKAIAN BHP' || (item?.itemCode || item?.item_code || '').startsWith('BHP-')
          const revAcc = item?.coaRevenueCode || item?.coa_revenue_code || (isBHP ? '4-13-003' : item?.category === 'GENERIK' ? '4-13-002' : '4-13-001')
          const dppLine = lineVal
          pharmacyRevAccounts[revAcc] = (pharmacyRevAccounts[revAcc] || 0) + dppLine
        }
      })

      Object.entries(pharmacyRevAccounts).forEach(([accCode, amount]) => {
        if (amount > 0) {
          const accDesc = accCode === '4-13-003' ? 'Pendapatan Penjualan BHP Medis (DPP)' : accCode === '4-13-002' ? 'Pendapatan Penjualan Obat OTC / Generik (DPP)' : 'Penjualan Obat Etikal (DPP)'
          journalItems.push({ id: uuidv4(), journalEntryId: eId, accountCode: accCode, description: `${accDesc} — ${billingNumber}`, debit: 0, credit: amount })
        }
      })

      if (ppnAmount > 0) journalItems.push({ id: uuidv4(), journalEntryId: eId, accountCode: '2-14-001', description: `Utang PPN 11% — ${billingNumber}`, debit: 0, credit: ppnAmount })
      if (discountAmt > 0) {
        // Discount reduces the first revenue account
        const firstRevAccount = Object.keys(revenueByAccount)[0] || '4-11-001'
        journalItems.push({ id: uuidv4(), journalEntryId: eId, accountCode: firstRevAccount, description: `Diskon Billing — ${billingNumber}`, debit: discountAmt, credit: 0 })
      }
      if (grossDoctorFee > 0 && selectedDoctor) {
        journalItems.push({ id: uuidv4(), journalEntryId: eId, accountCode: '6-12-001', description: `Bagi Hasil Jasa Medis ${docName}`, debit: grossDoctorFee, credit: 0 })
        journalItems.push({ id: uuidv4(), journalEntryId: eId, accountCode: '2-13-001', description: `Utang PPh 21 ${docName}`, debit: 0, credit: pph21Calc.pph21Amount })
        journalItems.push({ id: uuidv4(), journalEntryId: eId, accountCode: '2-12-003', description: `Utang Jasa Medis Net ${docName}`, debit: 0, credit: pph21Calc.netToDoctor })
      }

      // Append consolidated HPP / COGS journal entries
      Object.entries(hppDebits).forEach(([coaCode, val]) => {
        journalItems.push({ id: uuidv4(), journalEntryId: eId, accountCode: coaCode, description: `HPP Penjualan Obat — ${billingNumber}`, debit: val, credit: 0 })
      })
      Object.entries(hppCredits).forEach(([coaCode, val]) => {
        journalItems.push({ id: uuidv4(), journalEntryId: eId, accountCode: coaCode, description: `Persediaan Obat Terjual — ${billingNumber}`, debit: 0, credit: val })
      })

      const td = journalItems.reduce((s, i) => s + (i.debit || 0), 0)
      const tc = journalItems.reduce((s, i) => s + (i.credit || 0), 0)

      await saveJournalDraft({ id: eId, branchId: activeBranchId, entryNumber: eNum, transactionDate: visitDate, description: `Billing ${patientName} — ${billingNumber}`, entryType: 'BILLING', totalDebit: td, totalCredit: tc }, journalItems)
      await saveBilling(billing, items)
      await postJournalEntry(eId, 'System-Billing')

      // Record doctor fee and PPh21 to doctor_fee_records
      if (selectedDoctor && grossDoctorFee > 0) {
        try {
          await insertDoctorFeeRecord({
            id: uuidv4(),
            billingId: bId,
            doctorId: selectedDoctor.id,
            doctorName: docName,
            doctorNpwp: selectedDoctor.npwp || selectedDoctor.doctor_npwp || '',
            grossJasaMedis: grossDoctorFee,
            dppAmount: pph21Calc.dpp,
            taxRate: pph21Calc.rate * 100,
            pph21Amount: pph21Calc.pph21Amount,
            netToDoctor: pph21Calc.netToDoctor,
            cumulativeGrossYtd: 0,
            journalEntryId: eId,
            createdAt: new Date().toISOString()
          })
        } catch (dfErr) {
          console.warn('[handleCheckout] Doctor fee record insert error:', dfErr.message)
        }
      }

      toast.success(`Billing ${billingNumber} berhasil. Jurnal diposting.`)
      setModal(null); resetForm()
    } catch (err) {
      console.error('[handleCheckout] Error:', err.message)
      toast.error(`Gagal menyimpan billing: ${err.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePrintReceipt = async (b) => {
    let bItems = (billingItems || []).filter(i => (i.billingId || i.billing_id) === b.id)
    if (bItems.length === 0) {
      try {
        const fetched = await fetchBillingItems([b.id])
        if (fetched && fetched.length > 0) bItems = fetched
      } catch (e) {
        console.warn('Could not fetch billing items for PDF:', e)
      }
    }
    exportBillingReceiptPDF(b, bItems, appSettings)
  }

  const handleOpenEditModal = async (b) => {
    setEditingBilling(b)
    let bItems = (billingItems || []).filter(i => (i.billingId || i.billing_id) === b.id)
    if (bItems.length === 0) {
      try {
        const fetched = await fetchBillingItems([b.id])
        if (fetched && fetched.length > 0) bItems = fetched
      } catch (e) {
        console.warn('Could not fetch billing items for edit:', e)
      }
    }

    setPatientName(b.patientName || b.patient_name || '')
    setPatientMRN(b.patientMRN || b.patient_mrn || '')
    setVisitDate(b.visitDate || b.visit_date || todayISO())
    setPayMethod(b.paymentMethod || b.payment_method || 'TUNAI')
    setBpjsClaimNo(b.bpjsClaimNumber || b.bpjs_claim_number || '')
    setSelectedDoctor((doctors || []).find(d => d.id === (b.doctorId || b.doctor_id)) || null)
    setDiscount(b.discountAmount || b.discount_amount || 0)

    const svcs = bItems.filter(i => (i.itemType || i.item_type) === 'SERVICE').map(i => ({
      id: i.serviceTariffId || i.service_tariff_id || i.id,
      name: i.itemName || i.item_name,
      price: Number(i.unitPrice ?? i.unit_price ?? 0),
      qty: Number(i.quantity || 1),
      revenueAccountCode: i.revenueAccountCode || i.revenue_account_code || '4-11-001'
    }))
    const labs = bItems.filter(i => (i.itemType || i.item_type) === 'LAB').map(i => ({
      id: i.serviceTariffId || i.service_tariff_id || i.id,
      name: i.itemName || i.item_name,
      price: Number(i.unitPrice ?? i.unit_price ?? 0),
      qty: Number(i.quantity || 1),
      revenueAccountCode: i.revenueAccountCode || i.revenue_account_code || '4-12-001'
    }))
    const pharms = bItems.filter(i => (i.itemType || i.item_type) === 'PHARMACY').map(i => ({
      itemId: i.pharmacyItemId || i.pharmacy_item_id || i.itemId || i.item_id,
      name: i.itemName || i.item_name,
      price: Number(i.unitPrice ?? i.unit_price ?? 0),
      qty: Number(i.quantity || 1),
    }))

    setServiceLines(svcs)
    setLabLines(labs)
    setPharmacyLines(pharms)
    setModal('edit')
  }

  const handleSaveEditBilling = async (actionType = 'PAY_NOW') => {
    if (!editingBilling) return
    if (!patientName.trim()) { toast.error('Nama pasien wajib diisi'); return }
    setIsSubmitting(true)
    try {
      const subService = serviceLines.reduce((sum, l) => sum + (l.qty * l.price), 0)
      const subLab = labLines.reduce((sum, l) => sum + (l.qty * l.price), 0)
      const subPharmacy = pharmacyLines.reduce((sum, l) => sum + ((parseFloat(l.qty) || 0) * (parseFloat(l.price) || 0)), 0)
      const discountAmt = Math.min(Number(discount) || 0, subService + subLab + subPharmacy)
      const ppnAmount = Math.round(subPharmacy * PPN_RATE)
      const grandTotal = Math.max(0, subService + subLab + subPharmacy + ppnAmount - discountAmt)

      let patientPortion = grandTotal
      let insurancePortion = 0
      if (payMethod === 'BPJS') {
        insurancePortion = Math.round(grandTotal * BPJS_RATIO)
        patientPortion = grandTotal - insurancePortion
      } else if (payMethod === 'ASURANSI') {
        insurancePortion = grandTotal
        patientPortion = 0
      }

      const docFeePct = selectedDoctor ? (Number(selectedDoctor.feePercentage ?? selectedDoctor.fee_percentage) || 70) : 70
      const docName = selectedDoctor?.fullName || selectedDoctor?.name || 'Dokter'
      const grossDoctorFee = selectedDoctor ? Math.round(subService * (docFeePct / 100)) : 0
      const pph21Calc = calcPPh21Doctor(grossDoctorFee, false)

      const items = [
        ...serviceLines.map(l => ({
          id: uuidv4(), billingId: editingBilling.id, itemType: 'SERVICE',
          serviceTariffId: l.id, itemName: l.name, quantity: l.qty,
          unitPrice: l.price, totalPrice: l.qty * l.price
        })),
        ...labLines.map(l => ({
          id: uuidv4(), billingId: editingBilling.id, itemType: 'LAB',
          serviceTariffId: l.id, itemName: l.name, quantity: l.qty,
          unitPrice: l.price, totalPrice: l.qty * l.price
        })),
        ...pharmacyLines.filter(l => l.itemId).map(l => ({
          id: uuidv4(), billingId: editingBilling.id, itemType: 'PHARMACY',
          pharmacyItemId: l.itemId, itemName: l.name, quantity: parseInt(l.qty) || 1,
          unitPrice: parseFloat(l.price) || 0, totalPrice: (parseInt(l.qty) || 1) * (parseFloat(l.price) || 0)
        })),
      ]

      if (actionType === 'KEEP_UNPAID' || (editingBilling.status === 'UNPAID' && actionType !== 'PAY_NOW')) {
        const updatedBillingObj = {
          id: editingBilling.id,
          patientName,
          patientMRN,
          doctorId: selectedDoctor?.id || null,
          doctorName: docName,
          visitDate,
          paymentMethod: payMethod,
          bpjsClaimNumber: bpjsClaimNo,
          subtotalDoctorServices: subService,
          subtotalLab: subLab,
          subtotalServices: subService + subLab,
          subtotalPharmacy,
          discountAmount: discountAmt,
          ppnAmount,
          grandTotal,
          patientPortion,
          insurancePortion,
          status: 'UNPAID',
          updatedAt: new Date().toISOString()
        }
        await updateBilling(editingBilling.id, updatedBillingObj)
        await deleteBillingItemsByBilling(editingBilling.id)
        await insertBillingItems(items)
        await refreshAll()
        toast.success(`Data pendaftaran ${editingBilling.billingNumber} berhasil diperbarui. Status tetap: BELUM LUNAS.`)
        setModal(null)
        setEditingBilling(null)
        resetForm()
        return
      }

      if (editingBilling.journalEntryId) {
        await reverseJournal(editingBilling.journalEntryId, 'Kasir', `Revisi Billing ${editingBilling.billingNumber}`)
      }

      const stockLedgers = await fetchStockLedger()
      const oldLedgerForBilling = stockLedgers.filter(l => l.referenceNumber === editingBilling.billingNumber && l.quantityOut > 0)

      for (const lEntry of oldLedgerForBilling) {
        if (lEntry.batchId) {
          const batch = invBatches.find(b => b.id === lEntry.batchId)
          if (batch) {
            const restoredQty = batch.quantityCurrent + lEntry.quantityOut
            await updateBatchQty(lEntry.batchId, restoredQty)
            await insertStockLedger([{
              id: uuidv4(),
              batchId: lEntry.batchId,
              itemId: lEntry.itemId,
              transactionType: 'REVISION_RESTORE',
              referenceId: editingBilling.id,
              referenceNumber: editingBilling.billingNumber,
              quantityIn: lEntry.quantityOut,
              quantityOut: 0,
              balanceAfter: restoredQty,
              unitCost: lEntry.unitCost,
              totalValue: lEntry.quantityOut * lEntry.unitCost,
              notes: `Restok revisi billing ${editingBilling.billingNumber}`,
              loggedAt: new Date().toISOString()
            }])
          }
        }
      }

      await deleteDoctorFeeRecordByBilling(editingBilling.id)

      const newJournalId = uuidv4()
      const updatedBillingObj = {
        id: editingBilling.id,
        patientName,
        patientMRN,
        doctorId: selectedDoctor?.id || null,
        doctorName: docName,
        visitDate,
        paymentMethod: payMethod,
        bpjsClaimNumber: bpjsClaimNo,
        subtotalDoctorServices: subService,
        subtotalLab: subLab,
        subtotalServices: subService + subLab,
        subtotalPharmacy,
        discountAmount: discountAmt,
        ppnAmount,
        grandTotal,
        patientPortion,
        insurancePortion,
        status: 'PAID',
        journalEntryId: newJournalId,
        updatedAt: new Date().toISOString()
      }
      await updateBilling(editingBilling.id, updatedBillingObj)
      await deleteBillingItemsByBilling(editingBilling.id)
      await insertBillingItems(items)

      const hppDebits = {}
      const hppCredits = {}
      for (const line of pharmacyLines.filter(l => l.itemId)) {
        const qtyToDeplete = parseInt(line.qty) || 0
        const cogsDetails = await depleteInventoryFIFO(line.itemId, qtyToDeplete, editingBilling.billingNumber, activeBranchId)
        cogsDetails.forEach(d => {
          const val = d.qty * d.unitCostPrice
          if (val > 0) {
            hppDebits[d.coaCOGSCode] = (hppDebits[d.coaCOGSCode] || 0) + val
            hppCredits[d.coaInventoryCode] = (hppCredits[d.coaInventoryCode] || 0) + val
          }
        })
      }

      const eNum = generateEntryNumber('BILLING')
      const journalItems = []
      if (['TUNAI', 'QRIS', 'TRANSFER', 'MIXED'].includes(payMethod)) {
        journalItems.push({ id: uuidv4(), journalEntryId: newJournalId, accountCode: '1-11-002', description: `Kas Tunai — ${editingBilling.billingNumber}`, debit: grandTotal, credit: 0 })
      } else if (payMethod === 'BPJS') {
        journalItems.push({ id: uuidv4(), journalEntryId: newJournalId, accountCode: '1-11-002', description: `Bayar Pasien BPJS — ${editingBilling.billingNumber}`, debit: patientPortion, credit: 0 })
        journalItems.push({ id: uuidv4(), journalEntryId: newJournalId, accountCode: '1-12-001', description: `Piutang BPJS — ${editingBilling.billingNumber}`, debit: insurancePortion, credit: 0 })
      } else {
        journalItems.push({ id: uuidv4(), journalEntryId: newJournalId, accountCode: '1-11-002', description: `Bayar Pasien Asuransi — ${editingBilling.billingNumber}`, debit: patientPortion, credit: 0 })
        journalItems.push({ id: uuidv4(), journalEntryId: newJournalId, accountCode: '1-12-002', description: `Piutang Asuransi — ${editingBilling.billingNumber}`, debit: insurancePortion, credit: 0 })
      }

      const revenueByAccount = {}
      serviceLines.forEach(l => {
        const accCode = l.revenueAccountCode || '4-11-001'
        revenueByAccount[accCode] = (revenueByAccount[accCode] || 0) + (l.qty * l.price)
      })
      labLines.forEach(l => {
        const accCode = l.revenueAccountCode || '4-12-001'
        revenueByAccount[accCode] = (revenueByAccount[accCode] || 0) + (l.qty * l.price)
      })
      Object.entries(revenueByAccount).forEach(([accCode, amount]) => {
        if (amount > 0) {
          const accDesc = accCode === '4-11-003' ? 'Pendapatan Tindakan Medis & BHP' : accCode === '4-12-001' ? 'Pendapatan Laboratorium' : 'Pendapatan Konsultasi Dokter'
          journalItems.push({ id: uuidv4(), journalEntryId: newJournalId, accountCode: accCode, description: `${accDesc} — ${editingBilling.billingNumber}`, debit: 0, credit: amount })
        }
      })

      const pharmacyRevAccounts = {}
      pharmacyLines.filter(l => l.itemId).forEach(l => {
        const lineVal = (parseFloat(l.qty) || 0) * (parseFloat(l.price) || 0)
        if (lineVal > 0) {
          const item = pharmacyItems.find(p => p.id === l.itemId)
          const isBHP = item?.category === 'BHP' || item?.category === 'PEMAKAIAN BHP' || (item?.itemCode || item?.item_code || '').startsWith('BHP-')
          const revAcc = item?.coaRevenueCode || item?.coa_revenue_code || (isBHP ? '4-13-003' : item?.category === 'GENERIK' ? '4-13-002' : '4-13-001')
          const dppLine = lineVal
          pharmacyRevAccounts[revAcc] = (pharmacyRevAccounts[revAcc] || 0) + dppLine
        }
      })

      Object.entries(pharmacyRevAccounts).forEach(([accCode, amount]) => {
        if (amount > 0) {
          const accDesc = accCode === '4-13-003' ? 'Pendapatan Penjualan BHP Medis (DPP)' : accCode === '4-13-002' ? 'Pendapatan Penjualan Obat OTC / Generik (DPP)' : 'Penjualan Obat Etikal (DPP)'
          journalItems.push({ id: uuidv4(), journalEntryId: newJournalId, accountCode: accCode, description: `${accDesc} — ${editingBilling.billingNumber}`, debit: 0, credit: amount })
        }
      })

      if (ppnAmount > 0) journalItems.push({ id: uuidv4(), journalEntryId: newJournalId, accountCode: '2-14-001', description: `Utang PPN 11% — ${editingBilling.billingNumber}`, debit: 0, credit: ppnAmount })
      if (discountAmt > 0) {
        const firstRevAccount = Object.keys(revenueByAccount)[0] || '4-11-001'
        journalItems.push({ id: uuidv4(), journalEntryId: newJournalId, accountCode: firstRevAccount, description: `Diskon Billing — ${editingBilling.billingNumber}`, debit: discountAmt, credit: 0 })
      }
      if (grossDoctorFee > 0 && selectedDoctor) {
        journalItems.push({ id: uuidv4(), journalEntryId: newJournalId, accountCode: '6-12-001', description: `Bagi Hasil Jasa Medis ${docName}`, debit: grossDoctorFee, credit: 0 })
        journalItems.push({ id: uuidv4(), journalEntryId: newJournalId, accountCode: '2-13-001', description: `Utang PPh 21 ${docName}`, debit: 0, credit: pph21Calc.pph21Amount })
        journalItems.push({ id: uuidv4(), journalEntryId: newJournalId, accountCode: '2-12-003', description: `Utang Jasa Medis Net ${docName}`, debit: 0, credit: pph21Calc.netToDoctor })
      }

      Object.entries(hppDebits).forEach(([coaCode, val]) => {
        journalItems.push({ id: uuidv4(), journalEntryId: newJournalId, accountCode: coaCode, description: `HPP Penjualan Obat — ${editingBilling.billingNumber}`, debit: val, credit: 0 })
      })
      Object.entries(hppCredits).forEach(([coaCode, val]) => {
        journalItems.push({ id: uuidv4(), journalEntryId: newJournalId, accountCode: coaCode, description: `Persediaan Obat Terjual — ${editingBilling.billingNumber}`, debit: 0, credit: val })
      })

      const td = journalItems.reduce((s, i) => s + (i.debit || 0), 0)
      const tc = journalItems.reduce((s, i) => s + (i.credit || 0), 0)

      await saveJournalDraft({ id: newJournalId, branchId: activeBranchId, entryNumber: eNum, transactionDate: visitDate, description: `Billing ${patientName} — ${editingBilling.billingNumber}`, entryType: 'BILLING', totalDebit: td, totalCredit: tc }, journalItems)
      await postJournalEntry(newJournalId, 'System-Billing')

      // Record doctor fee and PPh21 to doctor_fee_records
      if (selectedDoctor && grossDoctorFee > 0) {
        try {
          await insertDoctorFeeRecord({
            id: uuidv4(),
            billingId: editingBilling.id,
            doctorId: selectedDoctor.id,
            doctorName: docName,
            doctorNpwp: selectedDoctor.npwp || selectedDoctor.doctor_npwp || '',
            grossJasaMedis: grossDoctorFee,
            dppAmount: pph21Calc.dpp,
            taxRate: pph21Calc.rate * 100,
            pph21Amount: pph21Calc.pph21Amount,
            netToDoctor: pph21Calc.netToDoctor,
            cumulativeGrossYtd: 0,
            journalEntryId: newJournalId,
            createdAt: new Date().toISOString()
          })
        } catch (dfErr) {
          console.warn('[handleSaveEditBilling] Doctor fee record insert error:', dfErr.message)
        }
      }

      await insertAuditLog({
        id: uuidv4(), user_id: 'system', user_name: 'Kasir', user_role: 'system',
        action: 'PAY_BILLING', module: 'BILLING',
        detail: `Pembayaran billing ${editingBilling.billingNumber} (${patientName}) selesai. Status: PAID`,
        created_at: new Date().toISOString()
      })

      await refreshAll()
      toast.success(`Pembayaran billing ${editingBilling.billingNumber} berhasil diproses. Status: LUNAS. Jurnal diposting.`)
      setModal(null)
      setEditingBilling(null)
      resetForm()
    } catch (err) {
      console.error('[handleSaveEditBilling] Error:', err.message)
      toast.error(`Gagal memproses billing: ${err.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const filtered = useMemo(() =>
    (billings || [])
      .filter(b => statusFilter === 'ALL' || b.status === statusFilter)
      .filter(b => {
        if (!search) return true
        const s = search.toLowerCase()
        return (
          (b.patientName || b.patient_name || '').toLowerCase().includes(s) ||
          (b.billingNumber || b.billing_number || '').toLowerCase().includes(s) ||
          (b.patientMRN || b.patient_mrn || '').toLowerCase().includes(s) ||
          (b.doctorName || b.doctor_name || '').toLowerCase().includes(s)
        )
      })
      .sort((a, b) => new Date(b.visitDate || b.createdAt || 0) - new Date(a.visitDate || a.createdAt || 0)),
    [billings, statusFilter, search])

  return (
    <div className="space-y-5">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Kasir &amp; Billing Pasien</h1>
          <p className="text-sm text-slate-400 mt-0.5">Pendaftaran pasien &amp; transaksi bertahap — kasir checkout — PPh 21 dokter otomatis</p>
        </div>
        <button className="btn-danger-red" onClick={() => { resetForm(); setModal('new') }}>
          <Plus className="w-4 h-4" />Billing Baru
        </button>
      </div>

      {/* ── Filter bar ──────────────────────────────────────── */}
      <div className="card card-body">
        <div className="flex flex-wrap gap-3 items-center">
          <SearchInput value={search} onChange={setSearch} placeholder="Cari nama pasien atau no. billing…" className="w-64" />
          <select className="form-select w-44" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="ALL">Semua Status</option>
            <option value="UNPAID">Belum Lunas (Tertunda)</option>
            <option value="PAID">Lunas (Selesai)</option>
            <option value="DRAFT">Draft</option>
            <option value="CANCELLED">Batal</option>
          </select>
          <span className="ml-auto text-sm text-slate-400">{filtered.length} transaksi</span>
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────── */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>No. Billing</th><th>Tanggal</th><th>Nama Pasien</th><th>Dokter</th>
                <th>Metode</th><th className="text-right">Total</th>
                <th className="text-right">Bagian Pasien</th><th>Status</th><th className="text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-slate-400">Belum ada transaksi billing</td></tr>
              ) : filtered.map(b => (
                <tr key={b.id}>
                  <td className="font-mono text-xs text-primary-700 font-bold">{b.billingNumber}</td>
                  <td className="text-sm">{fmtDate(b.visitDate)}</td>
                  <td className="font-bold text-sm text-slate-800">{b.patientName}</td>
                  <td className="text-sm text-slate-500">{b.doctorName || '—'}</td>
                  <td><span className="badge badge-blue">{paymentMethodLabel(b.paymentMethod)}</span></td>
                  <td className="text-right font-mono text-sm font-bold">{fmtIDR(b.grandTotal)}</td>
                  <td className="text-right font-mono text-sm">{fmtIDR(b.patientPortion)}</td>
                  <td><StatusBadge status={b.status} /></td>
                  <td className="text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button className="btn-action-edit" onClick={() => handleOpenViewModal(b)} title="Lihat Rincian & Nota">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors" onClick={() => handlePrintReceipt(b)} title="Cetak Kuitansi Nota (PDF 1/2 A4)">
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                      <button className="p-1.5 text-amber-600 hover:bg-amber-50 rounded transition-colors" onClick={() => handleOpenEditModal(b)} title="Edit / Tambah Transaksi">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {b.status === 'UNPAID' && (
                        <button
                          className="px-2 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded shadow-sm flex items-center gap-1 transition-colors ml-0.5"
                          onClick={() => handleOpenEditModal(b)}
                          title="Klik untuk Proses Pembayaran Pasien (Bayar)"
                        >
                          <CreditCard className="w-3 h-3" />
                          Bayar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── New / Edit Billing Modal ─────────────────────────── */}
      <Modal open={modal === 'new' || modal === 'edit'} onClose={() => { setModal(null); setEditingBilling(null) }} title={modal === 'edit' ? `Edit & Revisi Billing — ${editingBilling?.billingNumber}` : `Billing Baru — ${billingNumber}`} size="xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <button className="btn-secondary" onClick={() => { setModal(null); setEditingBilling(null) }}>Batal</button>
            <div className="flex items-center gap-2">
              {modal === 'new' ? (
                <>
                  <button
                    type="button"
                    className="px-4 py-2 text-sm font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
                    onClick={handleRegisterPatient}
                    disabled={isSubmitting}
                    title="Simpan pendaftaran pasien dengan transaksi tertunda (Belum Lunas)"
                  >
                    <UserCheck className="w-4 h-4 text-amber-600" />
                    Daftar (Belum Lunas)
                  </button>
                  <button
                    type="button"
                    className="btn-success px-5 flex items-center gap-1.5"
                    onClick={handleCheckout}
                    disabled={isSubmitting}
                    title="Proses checkout dan bayar penuh (Status: Lunas)"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Bayar (Lunas)
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="px-4 py-2 text-sm font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
                    onClick={() => handleSaveEditBilling('KEEP_UNPAID')}
                    disabled={isSubmitting}
                    title="Simpan perubahan data pendaftaran pasien (Status tetap Belum Lunas)"
                  >
                    <UserCheck className="w-4 h-4 text-amber-600" />
                    Simpan (Belum Lunas)
                  </button>
                  <button
                    type="button"
                    className="btn-success px-5 flex items-center gap-1.5"
                    onClick={() => handleSaveEditBilling('PAY_NOW')}
                    disabled={isSubmitting}
                    title="Selesaikan transaksi dan proses pembayaran kasir (Status: Lunas)"
                  >
                    <CreditCard className="w-4 h-4" />
                    Bayar Sekarang (Lunas)
                  </button>
                </>
              )}
            </div>
          </div>
        }
      >
        <div className="space-y-5">
          {/* Pasien + Dokter */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-2">
              <label className="form-label">Nama Pasien *</label>
              <input className="form-input" value={patientName} onChange={e => setPatientName(e.target.value)} placeholder="Nama lengkap pasien…" />
            </div>
            <div>
              <label className="form-label">No. MRN / RM</label>
              <input className="form-input" value={patientMRN} onChange={e => setPatientMRN(e.target.value)} />
            </div>
            <div>
              <label className="form-label">Tanggal Kunjungan</label>
              <input type="date" className="form-input" value={visitDate} onChange={e => setVisitDate(e.target.value)} />
            </div>
            <div className="lg:col-span-2">
              <label className="form-label flex items-center gap-1.5">
                <Stethoscope className="w-3.5 h-3.5 text-primary-600" />Dokter Pemeriksa
              </label>
              <SearchableSelect
                value={selectedDoctor?.id || ''}
                onChange={val => setSelectedDoctor(activeDoctors.find(d => d.id === val) || null)}
                options={doctorOptions}
                placeholder="— Pilih dokter (opsional) —"
                hideValue={true}
                searchPlaceholder="Ketik nama dokter…"
              />
              {selectedDoctor && (
                <p className="text-xs text-primary-600 mt-1">
                  SIP: {selectedDoctor.sipNumber || '—'} | {selectedDoctor.bankName} {selectedDoctor.bankAccountNumber || '—'}
                </p>
              )}
            </div>
            <div>
              <label className="form-label">Metode Pembayaran</label>
              <select className="form-select" value={payMethod} onChange={e => setPayMethod(e.target.value)}>
                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{paymentMethodLabel(m)}</option>)}
              </select>
            </div>
            {['BPJS', 'ASURANSI'].includes(payMethod) && (
              <div>
                <label className="form-label">No. Klaim / Polis</label>
                <input className="form-input" value={bpjsClaimNo} onChange={e => setBpjsClaimNo(e.target.value)} />
              </div>
            )}
          </div>

          {/* Layanan Medis */}
          <div>
            <label className="form-label">Layanan Medis</label>
            <div className="mb-3">
              <SearchableSelect
                value=""
                onChange={addSvc}
                options={serviceOptions}
                placeholder="— Tambah Layanan Medis —"
                hideValue={true}
                searchPlaceholder="Ketik nama layanan..."
              />
            </div>
            {serviceLines.length > 0 && (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>Layanan</th>
                      <th style={{ width: 80 }} className="text-right">Qty</th>
                      <th style={{ width: 130 }} className="text-right">Harga</th>
                      <th style={{ width: 130 }} className="text-right">Sub-Total</th>
                      <th style={{ width: 40 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {serviceLines.map(l => (
                      <tr key={l.id}>
                        <td className="text-sm">{l.name}</td>
                        <td>
                          <input type="number" className="form-input text-right text-xs py-1 w-16" value={l.qty} min={1}
                            onChange={e => setServiceLines(ls => ls.map(x => x.id === l.id ? { ...x, qty: parseInt(e.target.value) || 1 } : x))} />
                        </td>
                        <td className="text-right font-mono text-sm">{fmtIDR(l.price)}</td>
                        <td className="text-right font-mono text-sm font-bold">{fmtIDR(l.qty * l.price)}</td>
                        <td>
                          <button type="button" onClick={() => removeSvc(l.id)} className="p-1 text-slate-300 hover:text-red-500">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pemeriksaan Laboratorium */}
          <div>
            <label className="form-label flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 bg-blue-100 text-blue-600 rounded-full text-xs font-bold">L</span>
              Pemeriksaan Laboratorium
            </label>
            <div className="mb-3">
              <SearchableSelect
                value=""
                onChange={addLab}
                options={labOptions}
                placeholder="— Tambah Pemeriksaan Lab —"
                hideValue={true}
                searchPlaceholder="Ketik nama pemeriksaan lab..."
              />
            </div>
            {labLines.length > 0 && (
              <div className="border border-blue-200 rounded-xl overflow-hidden bg-blue-50/30">
                <table className="table-base">
                  <thead>
                    <tr className="bg-blue-50">
                      <th>Pemeriksaan Lab</th>
                      <th style={{ width: 80 }} className="text-right">Qty</th>
                      <th style={{ width: 130 }} className="text-right">Harga</th>
                      <th style={{ width: 130 }} className="text-right">Sub-Total</th>
                      <th style={{ width: 40 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {labLines.map(l => (
                      <tr key={l.id}>
                        <td className="text-sm font-medium text-blue-900">{l.name}</td>
                        <td>
                          <input type="number" className="form-input text-right text-xs py-1 w-16" value={l.qty} min={1}
                            onChange={e => setLabLines(ls => ls.map(x => x.id === l.id ? { ...x, qty: parseInt(e.target.value) || 1 } : x))} />
                        </td>
                        <td className="text-right font-mono text-sm">{fmtIDR(l.price)}</td>
                        <td className="text-right font-mono text-sm font-bold text-blue-700">{fmtIDR(l.qty * l.price)}</td>
                        <td>
                          <button type="button" onClick={() => removeLab(l.id)} className="p-1 text-slate-300 hover:text-red-500">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Farmasi */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="form-label mb-0">Item Farmasi / Obat</label>
              <button type="button" className="btn-primary text-xs py-1.5 px-3" onClick={() => setShowAddPharmModal(true)}>
                <Plus className="w-3.5 h-3.5" />Tambah Obat
              </button>
            </div>
            {pharmacyLines.length > 0 ? (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>Nama Obat</th>
                      <th className="text-center" style={{ width: 120 }}>Quantity</th>
                      <th className="text-right" style={{ width: 140 }}>Harga Satuan</th>
                      <th className="text-right" style={{ width: 140 }}>Sub-Total</th>
                      <th className="text-center" style={{ width: 60 }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pharmacyLines.map(l => {
                      const availableStock = l.availableStock || 0
                      const isOverStock = l.qty > availableStock

                      return (
                        <tr key={l.id} className={isOverStock ? 'bg-red-50 border-l-4 border-red-500' : ''}>
                          <td className="p-3">
                            <div className="font-medium text-slate-900">{l.name}</div>
                            <div className="text-xs mt-1">
                              <span className={isOverStock ? 'text-red-600 font-semibold' : 'text-emerald-600'}>
                                Stok: {availableStock} unit
                              </span>
                              {isOverStock && (
                                <span className="ml-2 text-red-600 font-semibold">⚠️ Melebihi stok tersedia!</span>
                              )}
                            </div>
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              className={`form-input text-center text-sm py-2 w-full ${isOverStock ? 'border-red-500 bg-red-50 text-red-700 font-bold' : ''}`}
                              value={l.qty}
                              min={1}
                              max={availableStock}
                              onChange={e => {
                                const newQty = parseInt(e.target.value) || 1
                                setPharmacyLines(ls => ls.map(item => {
                                  if (item.id !== l.id) return item
                                  if (newQty > availableStock) {
                                    toast.error(`Stok tidak mencukupi! Tersedia: ${availableStock}`, {
                                      duration: 2000,
                                      icon: '⚠️'
                                    })
                                  }
                                  return { ...item, qty: newQty }
                                }))
                              }}
                            />
                          </td>
                          <td className="text-right font-mono text-sm px-3">{fmtIDR(l.price)}</td>
                          <td className="text-right font-mono text-sm font-bold px-3 text-primary-700">{fmtIDR(l.qty * l.price)}</td>
                          <td className="text-center p-2">
                            <button
                              type="button"
                              onClick={() => removePharm(l.id)}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Hapus item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot className="bg-slate-50">
                    <tr>
                      <td colSpan={3} className="text-right font-semibold px-3 py-2">Sub-total Farmasi:</td>
                      <td className="text-right font-mono font-bold text-lg px-3 py-2 text-primary-700">{fmtIDR(subPharmacy)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center bg-slate-50">
                <Package className="w-16 h-16 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-600 mb-1">Belum ada obat ditambahkan</p>
                <p className="text-xs text-slate-400">Klik tombol "Tambah Obat" untuk menambahkan item farmasi ke billing</p>
              </div>
            )}
          </div>

          {/* Ringkasan */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm"><span className="text-slate-600">Sub-total Jasa Medis</span><span className="font-mono">{fmtIDR(subService)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-600">Sub-total Laboratorium</span><span className="font-mono">{fmtIDR(subLab)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-600">Sub-total Farmasi</span><span className="font-mono">{fmtIDR(subPharmacy)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-500">PPN 11% (Farmasi)</span><span className="font-mono">{fmtIDR(ppnAmount)}</span></div>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-slate-500">Diskon</span>
              <input type="number" className="form-input text-right w-40 py-1" value={discount} min={0} step={1000}
                onChange={e => setDiscount(parseFloat(e.target.value) || 0)} />
            </div>
            <div className="border-t border-slate-200 pt-2 flex justify-between font-bold">
              <span>Grand Total</span>
              <span className="font-mono text-primary-700 text-lg">{fmtIDR(grandTotal)}</span>
            </div>
            {['BPJS', 'ASURANSI'].includes(payMethod) && (
              <>
                <div className="flex justify-between text-sm text-emerald-700"><span>Bagian Pasien (20%)</span><span className="font-mono">{fmtIDR(patientPortion)}</span></div>
                <div className="flex justify-between text-sm text-blue-700"><span>Bagian {payMethod} (80%)</span><span className="font-mono">{fmtIDR(insurancePortion)}</span></div>
              </>
            )}
            {selectedDoctor && grossDoctorFee > 0 && (
              <div className="border-t border-slate-200 pt-2 space-y-1">
                <p className="text-xs font-semibold text-slate-600">PPh 21 Dokter — {selectedDoctor.title} {selectedDoctor.fullName}:</p>
                <div className="flex justify-between text-xs text-slate-500"><span>Bruto ({feeRate}% × Jasa Medis Dokter)</span><span className="font-mono">{fmtIDR(grossDoctorFee)}</span></div>
                <div className="flex justify-between text-xs text-slate-500"><span>DPP (50%)</span><span className="font-mono">{fmtIDR(pph21Calc.dpp)}</span></div>
                <div className="flex justify-between text-xs text-red-600"><span>PPh 21 ({(pph21Calc.rate * 100).toFixed(0)}%)</span><span className="font-mono">({fmtIDR(pph21Calc.pph21Amount)})</span></div>
                <div className="flex justify-between text-xs text-emerald-700 font-medium"><span>Bersih ke Dokter</span><span className="font-mono">{fmtIDR(pph21Calc.netToDoctor)}</span></div>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* ── View Detail Modal (Professional Half-A4 Receipt Preview) ── */}
      <Modal
        open={modal === 'view'}
        onClose={() => { setModal(null); setModalItems([]) }}
        title={`Rincian Kuitansi & Nota — ${selected?.billingNumber || ''}`}
        size="xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-slate-400">
              Ukuran Kertas: 1/2 A4 (A5 Landscape: 210 × 148 mm)
            </span>
            <div className="flex items-center gap-2">
              <button className="btn-secondary" onClick={() => setModal(null)}>Tutup</button>
              {selected && (
                <button
                  className="btn-primary flex items-center gap-1.5"
                  onClick={() => handlePrintReceipt(selected)}
                >
                  <Printer className="w-4 h-4" />
                  Cetak Nota (PDF 1/2 A4)
                </button>
              )}
            </div>
          </div>
        }
      >
        {selected && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm font-sans space-y-4">
            {/* Kop Surat Klinik */}
            <div className="flex items-start justify-between border-b-2 border-primary-900 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary-700 text-white rounded-xl flex items-center justify-center font-bold text-xl shadow-md">
                  {(appSettings?.companyName || 'K').charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900 tracking-wide">
                    {appSettings?.companyName || 'KLINIK PRATAMA SUBEKTI'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {appSettings?.address || 'Jl. Raya Subekti No. 12, Jakarta'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {appSettings?.phone || '(021) 7890-1234'} • Izin Operasional Klinik No: 503/KLINIK/2024
                  </p>
                </div>
              </div>

              {/* Status Stamp Badge */}
              <div className="text-right">
                <div className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1">Status Pembayaran</div>
                {selected.status === 'PAID' ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 border-2 border-emerald-500 text-emerald-700 font-extrabold text-sm rounded-lg shadow-sm">
                    ✓ LUNAS
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-50 border-2 border-red-500 text-red-700 font-extrabold text-sm rounded-lg shadow-sm">
                    ⚠ BELUM LUNAS
                  </span>
                )}
              </div>
            </div>

            {/* Title */}
            <div className="text-center py-1">
              <h4 className="text-sm font-extrabold text-primary-900 uppercase tracking-widest">
                Kuitansi / Nota Pembayaran Rawat Jalan
              </h4>
              <p className="text-xs text-slate-400">Dokumen Transaksi Keuangan Resmi (Ukuran 1/2 A4)</p>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-4 bg-slate-50 rounded-lg p-3 text-xs border border-slate-200">
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">No. Billing</span>
                  <span className="font-mono font-bold text-slate-900">{selected.billingNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Nama Pasien</span>
                  <span className="font-semibold text-slate-900">{selected.patientName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">No. Rekam Medis (MRN)</span>
                  <span className="font-mono text-slate-700">{selected.patientMRN || '—'}</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Tanggal Transaksi</span>
                  <span className="font-medium text-slate-900">{fmtDate(selected.visitDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Dokter Pemeriksa</span>
                  <span className="font-medium text-slate-900">{selected.doctorName || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Metode Pembayaran</span>
                  <span className="font-semibold text-primary-700">
                    {paymentMethodLabel(selected.paymentMethod)} {selected.bpjsClaimNumber ? `(${selected.bpjsClaimNumber})` : ''}
                  </span>
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-100 border-b border-slate-200 text-slate-700">
                  <tr>
                    <th className="py-2 px-3 text-center w-10">No</th>
                    <th className="py-2 px-3 text-left">Deskripsi Layanan / Obat</th>
                    <th className="py-2 px-3 text-left w-32">Kategori</th>
                    <th className="py-2 px-3 text-right w-14">Qty</th>
                    <th className="py-2 px-3 text-right w-28">Harga Satuan</th>
                    <th className="py-2 px-3 text-right w-32">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingItems ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400">
                        Memuat rincian transaksi...
                      </td>
                    </tr>
                  ) : viewItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400">
                        Tidak ada rincian item transaksi terlampir
                      </td>
                    </tr>
                  ) : (
                    viewItems.map((item, idx) => {
                      const iType = (item.itemType || item.item_type || 'SERVICE').toUpperCase()
                      const typeLabel = iType === 'SERVICE' ? 'Jasa Medis' : iType === 'LAB' ? 'Laboratorium' : 'Farmasi / Obat'
                      const name = item.itemName || item.item_name || 'Layanan / Obat'
                      const qty = Number(item.quantity || 1)
                      const price = Number(item.unitPrice ?? item.unit_price ?? 0)
                      const total = Number(item.totalPrice ?? item.total_price ?? (qty * price))
                      return (
                        <tr key={item.id || idx} className="hover:bg-slate-50">
                          <td className="py-2 px-3 text-center text-slate-400">{idx + 1}</td>
                          <td className="py-2 px-3 font-medium text-slate-800">{name}</td>
                          <td className="py-2 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              iType === 'SERVICE' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                              iType === 'LAB' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                              'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}>
                              {typeLabel}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right text-slate-700">{qty}</td>
                          <td className="py-2 px-3 text-right font-mono text-slate-700">{fmtIDR(price)}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{fmtIDR(total)}</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Ringkasan Subtotal */}
            <div className="flex justify-end pt-1">
              <div className="w-72 space-y-1.5 text-xs">
                {(selected.subtotalDoctorServices || selected.subtotal_doctor_services || selected.subtotalServices) > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal Jasa Dokter:</span>
                    <span className="font-mono">{fmtIDR(selected.subtotalDoctorServices || selected.subtotal_doctor_services || selected.subtotalServices)}</span>
                  </div>
                )}
                {(selected.subtotalLab || selected.subtotal_lab) > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal Laboratorium:</span>
                    <span className="font-mono">{fmtIDR(selected.subtotalLab || selected.subtotal_lab)}</span>
                  </div>
                )}
                {(selected.subtotalPharmacy || selected.subtotal_pharmacy) > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal Farmasi &amp; Obat:</span>
                    <span className="font-mono">{fmtIDR(selected.subtotalPharmacy || selected.subtotal_pharmacy)}</span>
                  </div>
                )}
                {(selected.ppnAmount || selected.ppn_amount) > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>PPN 11% (Farmasi):</span>
                    <span className="font-mono">{fmtIDR(selected.ppnAmount || selected.ppn_amount)}</span>
                  </div>
                )}
                {(selected.discountAmount || selected.discount_amount) > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Diskon / Potongan:</span>
                    <span className="font-mono text-red-600">-{fmtIDR(selected.discountAmount || selected.discount_amount)}</span>
                  </div>
                )}
                <div className="border-t-2 border-slate-300 pt-1.5 flex justify-between font-bold text-sm text-primary-900">
                  <span>Grand Total:</span>
                  <span className="font-mono text-base">{fmtIDR(selected.grandTotal)}</span>
                </div>
                {['BPJS', 'ASURANSI'].includes(selected.paymentMethod) && (
                  <div className="bg-slate-50 rounded p-2 text-[11px] space-y-1 border border-slate-200 mt-1">
                    <div className="flex justify-between text-emerald-700">
                      <span>Bagian Pasien:</span>
                      <span className="font-mono font-bold">{fmtIDR(selected.patientPortion)}</span>
                    </div>
                    <div className="flex justify-between text-blue-700">
                      <span>Klaim {selected.paymentMethod}:</span>
                      <span className="font-mono font-bold">{fmtIDR(selected.insurancePortion)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Tanda Tangan Footer */}
            <div className="grid grid-cols-2 pt-6 text-center text-xs text-slate-600">
              <div>
                <p>Pasien / Keluarga Pasien,</p>
                <div className="h-14"></div>
                <p className="font-bold border-t border-slate-300 inline-block px-8 pt-1">
                  ( {selected.patientName || 'Pasien'} )
                </p>
              </div>
              <div>
                <p>Petugas Kasir / Administrasi,</p>
                <div className="h-14"></div>
                <p className="font-bold border-t border-slate-300 inline-block px-8 pt-1">
                  ( Bagian Kasir Klinik )
                </p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Add Pharmacy Item Modal ──────────────────────────── */}
      <AddPharmacyItemModal
        open={showAddPharmModal}
        onClose={() => setShowAddPharmModal(false)}
        pharmacyItems={pharmacyItems}
        invBatches={invBatches}
        getItemStock={getItemStock}
        onAdd={handleAddPharmItem}
      />
    </div>
  )
}
