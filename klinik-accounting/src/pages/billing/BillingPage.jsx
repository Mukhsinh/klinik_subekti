import { useState, useMemo } from 'react'
import { Plus, Eye, CheckCircle, Trash2, Stethoscope, Package } from 'lucide-react'
import { useStore } from '../../store/useStore'
import Modal from '../../components/ui/Modal'
import SearchInput from '../../components/ui/SearchInput'
import { StatusBadge } from '../../components/ui/Badge'
import SearchableSelect from '../../components/ui/SearchableSelect'
import AddPharmacyItemModal from '../../components/billing/AddPharmacyItemModal'
import {
  fmtIDR, fmtDate, todayISO,
  calcPPh21Doctor, PPN_RATE, paymentMethodLabel,
} from '../../utils/format'
import toast from 'react-hot-toast'
import { v4 as uuidv4 } from 'uuid'

const PAYMENT_METHODS = ['TUNAI', 'TRANSFER', 'QRIS']
const BPJS_RATIO = 0.80

export default function BillingPage() {
  const {
    pharmacyItems, invBatches, billings, billingItems, doctors, serviceTariffs,
    generateBillingNumber, saveBilling,
    activeBranchId, saveJournalDraft, postJournalEntry, generateEntryNumber,
    getItemStock, depleteInventoryFIFO,
  } = useStore()

  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
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

  const billingNumber = useMemo(() => generateBillingNumber(), [billings])
  const activeDoctors = useMemo(() => (doctors || []).filter(d => d.isActive !== false), [doctors])
  const doctorOptions = useMemo(() => activeDoctors.map(d => ({ value: d.id, label: `${d.title ? d.title + ' ' : ''}${d.fullName}`.trim() })), [activeDoctors])

  const activeServices = useMemo(() => (serviceTariffs || []).filter(s => s.isActive !== false && s.serviceCategory !== 'LABORATORIUM' && s.service_category !== 'LABORATORIUM'), [serviceTariffs])
  const serviceOptions = useMemo(() => activeServices.map(s => ({ value: s.id, label: `${s.code} — ${s.name} (${fmtIDR(s.price)})` })), [activeServices])

  const labServices = useMemo(() => (serviceTariffs || []).filter(s => s.isActive !== false && (s.serviceCategory === 'LABORATORIUM' || s.service_category === 'LABORATORIUM')), [serviceTariffs])
  const labOptions = useMemo(() => labServices.map(s => ({ value: s.id, label: `${s.code} — ${s.name} (${fmtIDR(s.price)})` })), [labServices])

  const pharmacyOptions = useMemo(() =>
    pharmacyItems
      .filter(i => i.isActive !== false)
      .filter(i => ['OBAT_PATEN', 'OBAT_GENERIK'].includes(i.category)) // Use 'category' not 'itemCategory'
      .sort((a, b) => a.itemName.localeCompare(b.itemName))
      .map(i => {
        const stk = invBatches.filter(b => b.itemId === i.id && b.quantityCurrent > 0).reduce((s, b) => s + b.quantityCurrent, 0)
        const category = i.category === 'OBAT_PATEN' ? '🔵 Paten' : '🟢 Generik'
        return {
          value: i.id,
          label: `${category} | ${i.itemCode || i.skuCode} — ${i.itemName} | Stok: ${stk}`,
          stock: stk, // Add stock to option for validation
          disabled: stk === 0
        }
      }),
    [pharmacyItems, invBatches]
  )

  const subService = serviceLines.reduce((s, l) => s + (parseFloat(l.qty) || 1) * (parseFloat(l.price) || 0), 0)
  const subLab = labLines.reduce((s, l) => s + (parseFloat(l.qty) || 1) * (parseFloat(l.price) || 0), 0)
  const subPharmacy = pharmacyLines.reduce((s, l) => s + (parseFloat(l.qty) || 0) * (parseFloat(l.price) || 0), 0)
  const discountAmt = parseFloat(discount) || 0
  const ppnAmount = subPharmacy * PPN_RATE
  const grandTotal = subService + subLab + subPharmacy + ppnAmount - discountAmt
  const patientPortion = ['BPJS', 'ASURANSI'].includes(payMethod) ? grandTotal * (1 - BPJS_RATIO) : grandTotal
  const insurancePortion = ['BPJS', 'ASURANSI'].includes(payMethod) ? grandTotal * BPJS_RATIO : 0
  const feeRate = selectedDoctor ? (selectedDoctor.feePercentage || 30) : 0
  const grossDoctorFee = (subService + subLab) * (feeRate / 100)
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

  const handleCheckout = async () => {
    if (!patientName.trim()) { toast.error('Nama pasien wajib diisi.'); return }
    if (!serviceLines.length && !labLines.length && !pharmacyLines.length) { toast.error('Minimal 1 item layanan, lab, atau farmasi.'); return }

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
      ...serviceLines.map(l => ({ id: uuidv4(), billingId: bId, itemType: 'SERVICE', itemName: l.name, quantity: l.qty, unitPrice: l.price, totalPrice: l.qty * l.price, discountPct: 0 })),
      ...labLines.map(l => ({ id: uuidv4(), billingId: bId, itemType: 'LAB', itemName: l.name, quantity: l.qty, unitPrice: l.price, totalPrice: l.qty * l.price, discountPct: 0 })),
      ...pharmacyLines.filter(l => l.itemId).map(l => ({ id: uuidv4(), billingId: bId, itemType: 'PHARMACY', itemName: l.name, pharmacyItemId: l.itemId, quantity: l.qty, unitPrice: l.price, totalPrice: l.qty * l.price, discountPct: 0 })),
    ]
    const billing = {
      id: bId, branchId: activeBranchId, billingNumber, patientName, patientMRN,
      doctorId: selectedDoctor?.id || null, doctorName: docName,
      visitDate, paymentMethod: payMethod, bpjsClaimNumber: bpjsClaimNo,
      subtotalServices: subService + subLab, subtotalPharmacy: subPharmacy,
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
    const ji = []
    if (['TUNAI', 'QRIS', 'TRANSFER', 'MIXED'].includes(payMethod)) {
      ji.push({ accountCode: '1-11-002', description: `Kas Tunai — ${billingNumber}`, debit: grandTotal, credit: 0 })
    } else if (payMethod === 'BPJS') {
      ji.push({ accountCode: '1-11-002', description: `Bayar Pasien BPJS — ${billingNumber}`, debit: patientPortion, credit: 0 })
      ji.push({ accountCode: '1-12-001', description: `Piutang BPJS — ${billingNumber}`, debit: insurancePortion, credit: 0 })
    } else {
      ji.push({ accountCode: '1-11-002', description: `Bayar Pasien Asuransi — ${billingNumber}`, debit: patientPortion, credit: 0 })
      ji.push({ accountCode: '1-12-002', description: `Piutang Asuransi — ${billingNumber}`, debit: insurancePortion, credit: 0 })
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
        ji.push({ accountCode: accCode, description: `Pendapatan Layanan — ${billingNumber}`, debit: 0, credit: amount })
      }
    })

    if (subPharmacy > 0) ji.push({ accountCode: '4-13-001', description: `Penjualan Obat — ${billingNumber}`, debit: 0, credit: subPharmacy })
    if (ppnAmount > 0) ji.push({ accountCode: '2-14-001', description: `PPN 11% — ${billingNumber}`, debit: 0, credit: ppnAmount })
    if (discountAmt > 0) {
      // Discount reduces the first revenue account
      const firstRevAccount = Object.keys(revenueByAccount)[0] || '4-11-001'
      ji.push({ accountCode: firstRevAccount, description: `Diskon — ${billingNumber}`, debit: discountAmt, credit: 0 })
    }
    if (grossDoctorFee > 0 && selectedDoctor) {
      ji.push({ accountCode: '6-12-001', description: `Jasa Medis ${docName}`, debit: grossDoctorFee, credit: 0 })
      ji.push({ accountCode: '2-13-001', description: `PPh 21 ${docName}`, debit: 0, credit: pph21Calc.pph21Amount })
      ji.push({ accountCode: '2-12-001', description: `Net Fee ${docName}`, debit: 0, credit: pph21Calc.netToDoctor })
    }

    // Append consolidated HPP / COGS journal entries
    Object.entries(hppDebits).forEach(([coaCode, val]) => {
      ji.push({ accountCode: coaCode, description: `HPP Penjualan Obat — ${billingNumber}`, debit: val, credit: 0 })
    })
    Object.entries(hppCredits).forEach(([coaCode, val]) => {
      ji.push({ accountCode: coaCode, description: `Persediaan Obat Terjual — ${billingNumber}`, debit: 0, credit: val })
    })

    const td = ji.reduce((s, i) => s + (i.debit || 0), 0)
    const tc = ji.reduce((s, i) => s + (i.credit || 0), 0)
    await saveJournalDraft({ id: eId, branchId: activeBranchId, entryNumber: eNum, transactionDate: visitDate, description: `Billing ${patientName} — ${billingNumber}`, entryType: 'BILLING', totalDebit: td, totalCredit: tc }, ji)
    await saveBilling(billing, items)
    await postJournalEntry(eId, 'System-Billing')
    toast.success(`Billing ${billingNumber} berhasil. Jurnal diposting.`)
    setModal(null); resetForm()
  }

  const filtered = useMemo(() =>
    billings
      .filter(b => statusFilter === 'ALL' || b.status === statusFilter)
      .filter(b => !search || b.patientName?.toLowerCase().includes(search.toLowerCase()) || b.billingNumber?.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [billings, statusFilter, search])

  const viewItems = selected ? billingItems.filter(i => i.billingId === selected.id) : []

  return (
    <div className="space-y-5">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Kasir &amp; Billing Pasien</h1>
          <p className="text-sm text-slate-400 mt-0.5">Checkout pasien — split BPJS — PPh 21 dokter otomatis</p>
        </div>
        <button className="btn-primary" onClick={() => { resetForm(); setModal('new') }}>
          <Plus className="w-4 h-4" />Billing Baru
        </button>
      </div>

      {/* ── Filter bar ──────────────────────────────────────── */}
      <div className="card card-body">
        <div className="flex flex-wrap gap-3 items-center">
          <SearchInput value={search} onChange={setSearch} placeholder="Cari nama pasien atau no. billing…" className="w-64" />
          <select className="form-select w-40" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="ALL">Semua Status</option>
            <option value="PAID">Lunas</option>
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
                <th className="text-right">Bagian Pasien</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-slate-400">Belum ada transaksi billing</td></tr>
              ) : filtered.map(b => (
                <tr key={b.id}>
                  <td className="font-mono text-xs text-primary-700">{b.billingNumber}</td>
                  <td className="text-sm">{fmtDate(b.visitDate)}</td>
                  <td className="font-medium text-sm">{b.patientName}</td>
                  <td className="text-sm text-slate-500">{b.doctorName || '—'}</td>
                  <td><span className="badge badge-blue text-xs">{paymentMethodLabel(b.paymentMethod)}</span></td>
                  <td className="text-right font-mono text-sm font-bold">{fmtIDR(b.grandTotal)}</td>
                  <td className="text-right font-mono text-sm">{fmtIDR(b.patientPortion)}</td>
                  <td><StatusBadge status={b.status} /></td>
                  <td>
                    <button className="btn-ghost p-1.5" onClick={() => { setSelected(b); setModal('view') }}>
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── New Billing Modal ────────────────────────────────── */}
      <Modal open={modal === 'new'} onClose={() => setModal(null)} title={`Billing Baru — ${billingNumber}`} size="xl"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModal(null)}>Batal</button>
            <button className="btn-success px-6" onClick={handleCheckout}>
              <CheckCircle className="w-4 h-4" />Proses Pembayaran
            </button>
          </>
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
              <span className="text-slate-500">Diskon (Rp)</span>
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
                <div className="flex justify-between text-xs text-slate-500"><span>Bruto ({feeRate}% × Jasa Medis + Lab)</span><span className="font-mono">{fmtIDR(grossDoctorFee)}</span></div>
                <div className="flex justify-between text-xs text-slate-500"><span>DPP (50%)</span><span className="font-mono">{fmtIDR(pph21Calc.dpp)}</span></div>
                <div className="flex justify-between text-xs text-red-600"><span>PPh 21 ({(pph21Calc.rate * 100).toFixed(0)}%)</span><span className="font-mono">({fmtIDR(pph21Calc.pph21Amount)})</span></div>
                <div className="flex justify-between text-xs text-emerald-700 font-medium"><span>Bersih ke Dokter</span><span className="font-mono">{fmtIDR(pph21Calc.netToDoctor)}</span></div>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* ── View Detail Modal ────────────────────────────────── */}
      <Modal open={modal === 'view'} onClose={() => setModal(null)} title={`Detail Billing — ${selected?.billingNumber}`} size="lg">
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div><span className="text-slate-500">Pasien:</span><strong className="ml-2">{selected.patientName}</strong></div>
              <div><span className="text-slate-500">Tanggal:</span><span className="ml-2">{fmtDate(selected.visitDate)}</span></div>
              <div><span className="text-slate-500">Dokter:</span><span className="ml-2">{selected.doctorName || '—'}</span></div>
              <div><span className="text-slate-500">Metode:</span><span className="ml-2">{paymentMethodLabel(selected.paymentMethod)}</span></div>
              <div><span className="text-slate-500">Grand Total:</span><span className="ml-2 font-bold font-mono">{fmtIDR(selected.grandTotal)}</span></div>
              <div><span className="text-slate-500">Status:</span><StatusBadge status={selected.status} /></div>
            </div>
            <table className="table-base border border-slate-200 rounded-xl overflow-hidden">
              <thead>
                <tr><th>Item</th><th>Tipe</th><th className="text-right">Qty</th><th className="text-right">Harga</th><th className="text-right">Total</th></tr>
              </thead>
              <tbody>
                {viewItems.map(i => (
                  <tr key={i.id}>
                    <td className="text-sm">{i.itemName}</td>
                    <td><span className={`badge text-xs ${i.itemType === 'SERVICE' ? 'badge-blue' : i.itemType === 'LAB' ? 'badge-purple' : 'badge-green'}`}>{i.itemType === 'SERVICE' ? 'Jasa Medis' : i.itemType === 'LAB' ? 'Laboratorium' : 'Farmasi'}</span></td>
                    <td className="text-right text-sm">{i.quantity}</td>
                    <td className="text-right font-mono text-sm">{fmtIDR(i.unitPrice)}</td>
                    <td className="text-right font-mono text-sm font-bold">{fmtIDR(i.totalPrice)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-semibold">
                  <td colSpan={4} className="text-right pr-4">Grand Total</td>
                  <td className="text-right font-mono text-primary-700">{fmtIDR(selected.grandTotal)}</td>
                </tr>
              </tfoot>
            </table>
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
