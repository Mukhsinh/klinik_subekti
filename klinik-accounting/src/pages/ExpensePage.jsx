import { useState, useMemo, useEffect } from 'react'
import {
  Plus, CheckCircle, Eye, CheckSquare, Square, Building2, AlertCircle,
  CreditCard, Receipt, FileText, Check, ArrowRight, RefreshCw, Layers,
  Search, ShieldCheck, Banknote, Wallet
} from 'lucide-react'
import { useStore } from '../store/useStore'
import Modal from '../components/ui/Modal'
import SearchInput from '../components/ui/SearchInput'
import { StatusBadge } from '../components/ui/Badge'
import { fmtIDR, fmtDate, todayISO, paymentMethodLabel } from '../utils/format'
import { getAccountCode, EXPENSE_CATEGORY_MAPPING_KEY } from '../utils/accountMapping'
import SearchableSelect from '../components/ui/SearchableSelect'
import { fetchBatches, fetchExpenses, upsertExpense, updateFixedAsset } from '../lib/db'
import toast from 'react-hot-toast'
import { v4 as uuidv4 } from 'uuid'

const EXPENSE_CATEGORIES = [
  { label: 'Pembayaran Utang PBF / Supplier', coa: '2-11-001' },
  { label: 'Pembayaran Utang Pembelian Aset Tetap', coa: '2-11-002' },
  { label: 'Listrik', coa: '6-13-003' },
  { label: 'Air (PDAM)', coa: '6-13-004' },
  { label: 'Telepon & Internet', coa: '6-13-005' },
  { label: 'Sewa Gedung / Bangunan', coa: '6-14-001' },
  { label: 'Alat Tulis Kantor (ATK)', coa: '6-13-001' },
  { label: 'Bahan Cetakan & Fotokopi', coa: '6-13-002' },
  { label: 'Kebersihan & Sanitasi', coa: '6-13-006' },
  { label: 'Keamanan', coa: '6-13-007' },
  { label: 'Pemeliharaan Gedung', coa: '6-15-001' },
  { label: 'Pemeliharaan Peralatan Medis', coa: '6-15-002' },
  { label: 'Pemeliharaan IT & Komputer', coa: '6-15-005' },
  { label: 'Iklan & Promosi', coa: '6-17-001' },
  { label: 'Gaji Dokter Tetap', coa: '6-11-001' },
  { label: 'Gaji Perawat & Bidan', coa: '6-11-002' },
  { label: 'Gaji Staff Administrasi', coa: '6-11-004' },
  { label: 'Tunjangan Karyawan', coa: '6-11-006' },
  { label: 'Lembur Karyawan', coa: '6-11-007' },
  { label: 'Konsumsi & Jamuan', coa: '6-13-010' },
  { label: 'Parkir & Transportasi', coa: '6-13-009' },
  { label: 'Beban Pajak & Perizinan', coa: '6-19-003' },
  { label: 'Beban Admin Bank', coa: '6-19-001' },
  { label: 'Beban Lain-Lain', coa: '6-91-004' }
]

// Helper untuk parsing nominal persis tanpa pembulatan distorsif
function parseExactNominal(val) {
  if (val === '' || val === null || val === undefined) return 0
  if (typeof val === 'number') return val
  const clean = String(val).replace(/[^0-9.-]+/g, '')
  const num = parseFloat(clean)
  return isNaN(num) ? 0 : num
}

function ExpenseForm({ onSave, onClose, generateExpenseNumber, activeBranchId, vendors = [], storeBatches = [], storeExpenses = [], appSettings = {} }) {
  const [form, setForm] = useState(() => ({
    expenseNumber: typeof generateExpenseNumber === 'function' ? generateExpenseNumber() : '',
    expenseDate: todayISO(),
    category: EXPENSE_CATEGORIES[2].label, // Listrik
    description: '',
    vendorName: '',
    paymentMethod: 'KAS_BESAR',
    grossAmount: '',
    ppnAmount: '',
    pphAmount: '',
    selectedGrnRefs: [],
  }))

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const vendorOptions = useMemo(() => {
    const list = []
    const nameSet = new Set()

    ;(vendors || []).forEach(v => {
      if (v.name && v.isActive !== false) {
        const key = v.name.toLowerCase().trim()
        if (!nameSet.has(key)) {
          nameSet.add(key)
          list.push({ value: v.name, label: `${v.code ? v.code + ' — ' : ''}${v.name}` })
        }
      }
    })

    ;(storeBatches || []).forEach(b => {
      const sName = (b.supplierName || b.supplier_name || '').trim()
      if (sName && !sName.toLowerCase().includes('saldo awal')) {
        const key = sName.toLowerCase()
        if (!nameSet.has(key)) {
          nameSet.add(key)
          list.push({ value: sName, label: `Supplier GRN: ${sName}` })
        }
      }
    })

    return list.sort((a, b) => a.label.localeCompare(b.label))
  }, [vendors, storeBatches])

  const selectedCat = useMemo(() => {
    const cat = EXPENSE_CATEGORIES.find(c => c.label === form.category) || EXPENSE_CATEGORIES[0]
    const mapKey = EXPENSE_CATEGORY_MAPPING_KEY[form.category]
    const effectiveCoa = (mapKey ? getAccountCode(mapKey, appSettings) : null) || cat.coa || '6-91-004'
    return { ...cat, coa: effectiveCoa }
  }, [form.category, appSettings])

  const gross = parseExactNominal(form.grossAmount)
  const ppn = parseExactNominal(form.ppnAmount)
  const pph = parseExactNominal(form.pphAmount)
  // Nominal kas terbayar persis
  const netAmount = gross + ppn - pph

  const creditAccountCode = useMemo(() => {
    const map = {
      KAS: '1-11-001',
      KAS_BESAR: '1-11-002',
      TRANSFER: '1-11-003',
      KARTU_KREDIT: '2-11-005'
    }
    return map[form.paymentMethod] || '1-11-002'
  }, [form.paymentMethod])

  const submit = (e) => {
    e.preventDefault()
    if (!form.description.trim()) {
      toast.error('Keterangan pengeluaran wajib diisi.')
      return
    }
    if (!(gross > 0)) {
      toast.error('Nominal pengeluaran harus lebih dari 0.')
      return
    }
    onSave({
      ...form,
      grossAmount: gross,
      ppnAmount: ppn,
      pphAmount: pph,
      netAmount,
      coaCode: selectedCat.coa,
      creditCoaCode: creditAccountCode,
      branchId: activeBranchId,
      status: 'DRAFT'
    })
  }

  return (
    <form onSubmit={submit} className="space-y-4 text-xs">
      {/* Top Banner */}
      <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-xs flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-blue-200 font-bold">Pencatatan Pengeluaran Kas/Bank</p>
          <h3 className="text-base font-extrabold">{form.expenseNumber}</h3>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-blue-200">Perkiraan COA Terpetakan</p>
          <p className="text-xs font-bold font-mono bg-blue-800/80 px-2 py-0.5 rounded border border-blue-400">
            DR: {selectedCat.coa} | CR: {creditAccountCode}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="form-label text-xs">No. Transaksi</label>
          <input className="form-input text-xs font-mono bg-slate-100 text-slate-800 font-bold" value={form.expenseNumber} readOnly />
        </div>
        <div>
          <label className="form-label text-xs">Tanggal Transaksi *</label>
          <input type="date" className="form-input text-xs" value={form.expenseDate} onChange={e => set('expenseDate', e.target.value)} required />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="form-label text-xs">Kategori Beban (COA) *</label>
          <SearchableSelect
            value={form.category}
            onChange={val => set('category', val)}
            options={EXPENSE_CATEGORIES.map(c => ({ value: c.label, label: `${c.label} [${c.coa}]` }))}
            placeholder="— Pilih Kategori Beban —"
          />
        </div>
        <div>
          <label className="form-label text-xs">Metode Pembayaran *</label>
          <SearchableSelect
            value={form.paymentMethod}
            onChange={val => set('paymentMethod', val)}
            options={[
              { value: 'KAS', label: 'Kas Kecil Kasir (1-11-001)' },
              { value: 'KAS_BESAR', label: 'Kas Besar Klinik (1-11-002)' },
              { value: 'TRANSFER', label: 'Transfer Bank BCA (1-11-003)' },
              { value: 'KARTU_KREDIT', label: 'Kartu Kredit Operasional (2-11-005)' },
            ]}
            placeholder="— Pilih Metode Pembayaran —"
          />
        </div>
      </div>

      <div>
        <label className="form-label text-xs">Vendor / Pihak Terkait (Opsional)</label>
        <SearchableSelect
          value={form.vendorName}
          onChange={val => set('vendorName', val)}
          options={vendorOptions}
          placeholder="— Pilih Vendor / Supplier —"
        />
      </div>

      <div>
        <label className="form-label text-xs">Keterangan Transaksi *</label>
        <textarea className="form-textarea text-xs" rows={2} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Tulis rincian peruntukan pengeluaran…" required />
      </div>

      {/* Rincian Nominal: Sama Persis dengan yang diinput */}
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-700">Rincian Nominal & Pajak (Sama Persis)</p>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="form-label text-xs">Nilai Pokok / Bruto (Rp) *</label>
            <input
              type="number"
              step="any"
              className="form-input text-xs font-mono font-bold text-slate-900"
              value={form.grossAmount}
              onChange={e => set('grossAmount', e.target.value)}
              required
              placeholder="mis. 500000"
            />
            {gross > 0 && <p className="text-[10px] text-slate-500 mt-1 font-mono">{fmtIDR(gross)}</p>}
          </div>
          <div>
            <label className="form-label text-xs">PPN Masukan (Rp)</label>
            <input
              type="number"
              step="any"
              className="form-input text-xs font-mono"
              value={form.ppnAmount}
              onChange={e => set('ppnAmount', e.target.value)}
              placeholder="0"
            />
          </div>
          <div>
            <label className="form-label text-xs">PPh Dipotong (Rp)</label>
            <input
              type="number"
              step="any"
              className="form-input text-xs font-mono"
              value={form.pphAmount}
              onChange={e => set('pphAmount', e.target.value)}
              placeholder="0"
            />
          </div>
        </div>
      </div>

      {/* Total Net Banner */}
      <div className="flex justify-between items-center bg-blue-600 text-white rounded-xl px-4 py-2.5 shadow-xs">
        <span className="text-xs font-semibold">Total Nominal Terbayar:</span>
        <span className="font-mono text-lg font-bold">{fmtIDR(netAmount)}</span>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn-secondary text-xs" onClick={onClose}>Batal</button>
        <button type="submit" className="btn-primary text-xs px-5">Simpan Draft Pengeluaran</button>
      </div>
    </form>
  )
}

export default function ExpensePage() {
  const {
    expenses, invBatches, fixedAssets, journalEntries, generateExpenseNumber,
    saveExpense, postExpense, activeBranchId, saveJournalDraft, postJournalEntry,
    generateEntryNumber, vendors, refreshAll, appSettings
  } = useStore()

  // Main Page Tab: 'expenses' (Daftar Pengeluaran) | 'debts' (Fitur Bayar Utang & Tagihan)
  const [activeTab, setActiveTab] = useState('debts') // Langsung buka fitur Bayar Utang sesuai permintaan fokus user

  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('ALL')

  // Debt Tab State
  const [debtSearch, setDebtSearch] = useState('')
  const [debtStatusFilter, setDebtStatusFilter] = useState('UNPAID') // 'ALL' | 'UNPAID' | 'PAID'
  const [debtTypeFilter, setDebtTypeFilter] = useState('ALL') // 'ALL' | 'GRN' | 'ASSET'
  const [payingDebtItem, setPayingDebtItem] = useState(null)
  const [payForm, setPayForm] = useState({
    payAmount: '',
    paymentMethod: 'TRANSFER',
    payDate: todayISO(),
    notes: ''
  })
  const [isProcessingPay, setIsProcessingPay] = useState(false)

  const effectiveBatches = useMemo(() => invBatches || [], [invBatches])
  const effectiveFixedAssets = useMemo(() => fixedAssets || [], [fixedAssets])

  // Reconciled expenses
  const effectiveExpenses = useMemo(() => {
    const map = new Map()
    ;(expenses || []).forEach(e => {
      const key = e.id || e.expenseNumber
      if (key) map.set(key, e)
    })
    return Array.from(map.values())
  }, [expenses])

  // ══════════════════════════════════════════════════════════════
  // INTEGRATED DEBT LIST: 1) GRN Supplier PBF + 2) Aset Tetap Baru
  // ══════════════════════════════════════════════════════════════
  const allDebtItems = useMemo(() => {
    const items = []

    // 1. Tagihan dari Penerimaan Stok / GRN
    const grnMap = {}
    effectiveBatches.forEach(b => {
      const grnRef = (b.grnReference || b.grn_reference || '').toUpperCase().trim()
      const batchNo = (b.batchNumber || b.batch_number || '').toUpperCase().trim()
      const sName = (b.supplierName || b.supplier_name || '').trim()
      if (!grnRef || grnRef === 'SALDO-AWAL' || batchNo === 'SALDO-AWAL' || sName.toLowerCase().includes('saldo awal')) return

      if (!grnMap[grnRef]) {
        grnMap[grnRef] = {
          id: `GRN_${grnRef}`,
          debtType: 'GRN',
          refNumber: grnRef,
          title: `Faktur Penerimaan Stok Farmasi — ${grnRef}`,
          partyName: sName || 'Supplier PBF Farmasi',
          transactionDate: b.receivedAt || b.received_at || b.createdAt,
          debtAccountCode: '2-11-001',
          debtAccountName: 'Utang Pembelian Obat & BHP (PBF)',
          totalAmount: 0,
        }
      }
      const qty = Number(b.quantityReceived ?? b.quantity_received ?? 0)
      const cost = Number(b.unitCostPrice ?? b.unit_cost_price ?? 0)
      grnMap[grnRef].totalAmount += (qty * cost)
    })

    // Hitung total terbayar untuk setiap GRN dari tabel expenses
    const paidPerGrn = {}
    const expenseMapPerGrn = {}
    effectiveExpenses.forEach(e => {
      if (e.status !== 'VOID') {
        const refs = e.selectedGrnRefs || []
        if (Array.isArray(refs) && refs.length > 0) {
          const portion = Number(e.grossAmount || e.netAmount || 0) / refs.length
          refs.forEach(r => {
            paidPerGrn[r] = (paidPerGrn[r] || 0) + portion
            expenseMapPerGrn[r] = e.expenseNumber
          })
        }
      }
    })

    Object.values(grnMap).forEach(g => {
      const totalPaid = paidPerGrn[g.refNumber] || 0
      const unpaid = Math.max(0, g.totalAmount - totalPaid)
      const isPaid = unpaid <= 0.01 // toleransi floating point kecil
      items.push({
        ...g,
        totalPaid,
        unpaid: isPaid ? 0 : unpaid,
        status: isPaid ? 'PAID' : 'UNPAID',
        paymentRef: expenseMapPerGrn[g.refNumber] || null
      })
    })

    // 2. Tagihan dari Pembelian Aset Tetap Baru (/assets)
    effectiveFixedAssets.forEach(a => {
      if (!a || a.status !== 'ACTIVE') return
      const cost = Number(a.acquisitionCost || 0)
      if (cost <= 0) return

      const paidAmount = Number(a.paidAmount || (a.paymentStatus === 'PAID' ? cost : 0))
      const unpaid = Math.max(0, cost - paidAmount)
      const isPaid = a.paymentStatus === 'PAID' || unpaid <= 0.01

      const debtAcc = (a.category === 'PERALATAN_MEDIS' || (a.assetName || '').toLowerCase().includes('medis') || (a.assetName || '').toLowerCase().includes('alat'))
        ? '2-11-002' // Utang Pembelian Alat Kesehatan
        : '2-11-004' // Utang Pengadaan Lain-lain

      items.push({
        id: `ASSET_${a.id}`,
        rawAssetId: a.id,
        debtType: 'ASSET',
        refNumber: a.assetCode,
        title: `Pengadaan Aset Tetap: ${a.assetName}`,
        partyName: a.location ? `${a.assetName} (${a.location})` : a.assetName,
        transactionDate: a.acquisitionDate || a.createdAt,
        debtAccountCode: debtAcc,
        debtAccountName: debtAcc === '2-11-002' ? 'Utang Pembelian Alat Kesehatan' : 'Utang Pengadaan Lain-lain',
        totalAmount: cost,
        totalPaid: isPaid ? cost : paidAmount,
        unpaid: isPaid ? 0 : unpaid,
        status: isPaid ? 'PAID' : 'UNPAID',
        paymentRef: a.paymentRef || null
      })
    })

    return items.sort((a, b) => new Date(b.transactionDate || 0) - new Date(a.transactionDate || 0))
  }, [effectiveBatches, effectiveFixedAssets, effectiveExpenses])

  // Filtered Debts
  const filteredDebts = useMemo(() => {
    return allDebtItems.filter(item => {
      const matchStatus = debtStatusFilter === 'ALL' || item.status === debtStatusFilter
      const matchType = debtTypeFilter === 'ALL' || item.debtType === debtTypeFilter
      const matchSearch = !debtSearch ||
        item.refNumber.toLowerCase().includes(debtSearch.toLowerCase()) ||
        item.title.toLowerCase().includes(debtSearch.toLowerCase()) ||
        item.partyName.toLowerCase().includes(debtSearch.toLowerCase()) ||
        item.debtAccountCode.toLowerCase().includes(debtSearch.toLowerCase())
      return matchStatus && matchType && matchSearch
    })
  }, [allDebtItems, debtStatusFilter, debtTypeFilter, debtSearch])

  // Summary statistik utang
  const totalUnpaidDebt = useMemo(() => allDebtItems.filter(i => i.status === 'UNPAID').reduce((s, i) => s + i.unpaid, 0), [allDebtItems])
  const grnUnpaidDebt = useMemo(() => allDebtItems.filter(i => i.status === 'UNPAID' && i.debtType === 'GRN').reduce((s, i) => s + i.unpaid, 0), [allDebtItems])
  const assetUnpaidDebt = useMemo(() => allDebtItems.filter(i => i.status === 'UNPAID' && i.debtType === 'ASSET').reduce((s, i) => s + i.unpaid, 0), [allDebtItems])
  const paidDebtCount = useMemo(() => allDebtItems.filter(i => i.status === 'PAID').length, [allDebtItems])

  // Handlers Pembayaran Utang
  const handleOpenPayDebt = (item) => {
    setPayingDebtItem(item)
    setPayForm({
      payAmount: String(item.unpaid), // Sama persis dengan sisa utang yang diakui
      paymentMethod: 'TRANSFER',
      payDate: todayISO(),
      notes: `Pelunasan Utang ${item.debtType === 'GRN' ? 'Faktur Supplier PBF' : 'Pengadaan Aset'} — ${item.refNumber} (${item.partyName})`
    })
    setModal('pay_debt')
  }

  const handleExecutePayDebt = async (e) => {
    e.preventDefault()
    if (!payingDebtItem) return

    const amountToPay = parseExactNominal(payForm.payAmount)
    if (amountToPay <= 0) {
      toast.error('Nominal pembayaran harus lebih dari 0.')
      return
    }
    if (amountToPay > payingDebtItem.unpaid + 1) {
      toast.error(`Nominal tidak boleh melebihi sisa utang (${fmtIDR(payingDebtItem.unpaid)})`)
      return
    }

    setIsProcessingPay(true)
    try {
      const expenseId = uuidv4()
      const expenseNumber = typeof generateExpenseNumber === 'function' ? generateExpenseNumber() : `EXP-${Date.now().toString().slice(-6)}`
      const journalEntryId = uuidv4()
      const entryNumber = generateEntryNumber('EXP')

      const creditAccMap = {
        KAS: '1-11-001',
        KAS_BESAR: '1-11-002',
        TRANSFER: '1-11-003',
        KARTU_KREDIT: '2-11-005'
      }
      const creditCoa = creditAccMap[payForm.paymentMethod] || '1-11-003'
      const debitCoa = payingDebtItem.debtAccountCode // 2-11-001 (PBF) atau 2-11-002 (Aset)

      // 1. Simpan dokumen pengeluaran kas (Expense) dengan nominal persis sama
      const expenseDoc = {
        id: expenseId,
        branchId: activeBranchId || null,
        expenseNumber,
        expenseDate: payForm.payDate,
        category: payingDebtItem.debtType === 'GRN' ? 'Pembayaran Utang PBF / Supplier' : 'Pembayaran Utang Pembelian Aset Tetap',
        description: payForm.notes.trim() || `Pelunasan utang ${payingDebtItem.refNumber}`,
        vendorName: payingDebtItem.partyName,
        paymentMethod: payForm.paymentMethod,
        grossAmount: amountToPay,
        ppnAmount: 0,
        pphAmount: 0,
        netAmount: amountToPay,
        coaCode: debitCoa,
        creditCoaCode: creditCoa,
        status: 'POSTED',
        journalEntryId,
        selectedGrnRefs: payingDebtItem.debtType === 'GRN' ? [payingDebtItem.refNumber] : [],
        selectedAssetIds: payingDebtItem.debtType === 'ASSET' ? [payingDebtItem.rawAssetId] : [],
        debtType: payingDebtItem.debtType,
        createdAt: new Date().toISOString()
      }

      // 2. Buat Jurnal Otomatis Pelunasan Utang (DR: Utang Usaha / CR: Kas atau Bank)
      const journalHeader = {
        id: journalEntryId,
        branchId: activeBranchId || null,
        entryNumber,
        transactionDate: payForm.payDate,
        description: `Pelunasan Utang: ${payingDebtItem.refNumber} — ${payingDebtItem.partyName}`,
        entryType: 'EXPENSE',
        status: 'POSTED',
        totalDebit: amountToPay,
        totalCredit: amountToPay,
        createdBy: 'System',
        postedBy: 'Admin',
        postedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      const journalLines = [
        {
          id: uuidv4(),
          journalEntryId,
          accountCode: debitCoa,
          description: `Pelunasan Utang ${payingDebtItem.refNumber} (${payingDebtItem.partyName})`,
          debit: amountToPay,
          credit: 0
        },
        {
          id: uuidv4(),
          journalEntryId,
          accountCode: creditCoa,
          description: `Kas/Bank Pembayaran — ${paymentMethodLabel(payForm.paymentMethod)}`,
          debit: 0,
          credit: amountToPay
        }
      ]

      // Eksekusi simpan ke database Supabase
      await saveJournalDraft(journalHeader, journalLines)
      await postJournalEntry(journalEntryId, 'Admin')
      await upsertExpense(expenseDoc)

      // Jika merupakan pembayaran aset tetap, update status lunas di tabel fixed_assets
      if (payingDebtItem.debtType === 'ASSET' && payingDebtItem.rawAssetId) {
        await updateFixedAsset(payingDebtItem.rawAssetId, {
          payment_status: 'PAID',
          paid_amount: payingDebtItem.totalAmount,
          payment_ref: expenseNumber,
          paid_at: new Date().toISOString()
        }).catch(err => console.warn('[updateFixedAsset payment_status]', err))
      }

      await refreshAll()
      toast.success(`Pelunasan utang ${payingDebtItem.refNumber} sebesar ${fmtIDR(amountToPay)} berhasil! Status otomatis LUNAS dan tercatat di Buku Besar.`)
      setModal(null)
      setPayingDebtItem(null)
    } catch (err) {
      console.error('[handleExecutePayDebt] Error:', err)
      toast.error(`Gagal memproses pelunasan utang: ${err.message || 'Terjadi kesalahan'}`)
    } finally {
      setIsProcessingPay(false)
    }
  }

  // Filtered Regular Expenses
  const filteredExpenses = useMemo(() =>
    effectiveExpenses
      .filter(e => {
        if (catFilter === 'ALL') return true
        if (!e.category) return false
        return e.category === catFilter || e.category.toLowerCase().includes(catFilter.toLowerCase())
      })
      .filter(e => {
        if (!search) return true
        const s = search.toLowerCase()
        return (
          (e.description && e.description.toLowerCase().includes(s)) ||
          (e.expenseNumber && e.expenseNumber.toLowerCase().includes(s)) ||
          (e.vendorName && e.vendorName.toLowerCase().includes(s)) ||
          (e.category && e.category.toLowerCase().includes(s))
        )
      })
      .sort((a, b) => new Date(b.expenseDate || b.createdAt || 0) - new Date(a.expenseDate || a.createdAt || 0)),
    [effectiveExpenses, catFilter, search])

  const totalPostedExpense = effectiveExpenses.filter(e => e.status === 'POSTED').reduce((s, e) => s + (e.grossAmount || 0), 0)
  const totalDraftExpense = effectiveExpenses.filter(e => e.status === 'DRAFT').length

  return (
    <div className="space-y-4 max-w-full overflow-hidden text-xs">
      {/* 1. Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Portal Pengeluaran & Bayar Utang
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-100 text-blue-800 border border-blue-200">
              Integrasi Buku Besar
            </span>
          </h1>
          <p className="text-slate-500 mt-0.5 text-xs">
            Kelola pengeluaran kas operasional serta pelunasan utang faktur GRN supplier PBF dan utang pembelian aset tetap.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'debts' ? (
            <button
              onClick={() => refreshAll().then(() => toast.success('Data tagihan utang disinkronkan!'))}
              className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-3"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Sinkronkan Tagihan</span>
            </button>
          ) : (
            <button
              className="btn-primary text-xs font-bold shadow-xs flex items-center gap-1.5 py-1.5 px-3"
              onClick={() => setModal('add')}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Catat Pengeluaran Baru</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Navigasi Tab Utama (Fitur Bayar Utang vs Pengeluaran Operasional) */}
      <div className="bg-slate-100 p-1.5 rounded-xl border border-slate-200 shadow-xs">
        <nav className="grid grid-cols-2 gap-2 w-full max-w-lg">
          <button
            onClick={() => setActiveTab('debts')}
            className={`py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 text-center shadow-xs ${
              activeTab === 'debts'
                ? 'bg-rose-600 text-white ring-2 ring-rose-400/50'
                : 'bg-white text-slate-700 hover:bg-rose-50 hover:text-rose-700 border border-slate-200'
            }`}
          >
            <CreditCard className="w-4 h-4 shrink-0" />
            <span>Tagihan & Bayar Utang</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
              activeTab === 'debts' ? 'bg-rose-800/90 text-white' : 'bg-rose-100 text-rose-800'
            }`}>
              {allDebtItems.filter(i => i.status === 'UNPAID').length} Tagihan
            </span>
          </button>

          <button
            onClick={() => setActiveTab('expenses')}
            className={`py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 text-center shadow-xs ${
              activeTab === 'expenses'
                ? 'bg-blue-600 text-white ring-2 ring-blue-400/50'
                : 'bg-white text-slate-700 hover:bg-blue-50 hover:text-blue-700 border border-slate-200'
            }`}
          >
            <Receipt className="w-4 h-4 shrink-0" />
            <span>Pengeluaran Kas Operasional</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
              activeTab === 'expenses' ? 'bg-blue-800/90 text-white' : 'bg-blue-100 text-blue-800'
            }`}>
              {effectiveExpenses.length}
            </span>
          </button>
        </nav>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          TAB 1: FITUR 'BAYAR UTANG' (GRN & ASET TETAP BARU)
          ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'debts' && (
        <div className="space-y-3 animate-fadeIn">
          {/* Summary Cards Utang - Solid & Cerah, Huruf Arial Narrow Profesional, Tanpa Sub-tulisan di Bawah Angka */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            <div className="rounded-xl p-3 bg-[#e11d48] text-white shadow-xs">
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/90">Total Sisa Utang Belum Lunas</p>
              <p className="font-bold text-xl md:text-2xl mt-1 tracking-tight" style={{ fontFamily: '"Arial Narrow", "Arial", sans-serif' }}>
                {fmtIDR(totalUnpaidDebt)}
              </p>
            </div>
            <div className="rounded-xl p-3 bg-[#ea580c] text-white shadow-xs">
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/90">Utang Faktur GRN PBF</p>
              <p className="font-bold text-xl md:text-2xl mt-1 tracking-tight" style={{ fontFamily: '"Arial Narrow", "Arial", sans-serif' }}>
                {fmtIDR(grnUnpaidDebt)}
              </p>
            </div>
            <div className="rounded-xl p-3 bg-[#7c3aed] text-white shadow-xs">
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/90">Utang Pengadaan Aset Tetap</p>
              <p className="font-bold text-xl md:text-2xl mt-1 tracking-tight" style={{ fontFamily: '"Arial Narrow", "Arial", sans-serif' }}>
                {fmtIDR(assetUnpaidDebt)}
              </p>
            </div>
            <div className="rounded-xl p-3 bg-[#059669] text-white shadow-xs">
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/90">Tagihan Sudah Lunas</p>
              <p className="font-bold text-xl md:text-2xl mt-1 tracking-tight" style={{ fontFamily: '"Arial Narrow", "Arial", sans-serif' }}>
                {paidDebtCount}
              </p>
            </div>
          </div>

          {/* Filter & Controls */}
          <div className="card p-2.5 bg-white border border-slate-200 rounded-xl shadow-xs flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-500 mr-1">Status:</span>
              {[
                { id: 'UNPAID', label: 'Belum Lunas' },
                { id: 'PAID', label: 'Sudah Lunas' },
                { id: 'ALL', label: 'Semua Status' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setDebtStatusFilter(tab.id)}
                  className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold transition-colors ${
                    debtStatusFilter === tab.id
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}

              <span className="text-[11px] font-bold text-slate-400 mx-1">|</span>
              <span className="text-[11px] font-bold text-slate-500 mr-1">Sumber:</span>
              {[
                { id: 'ALL', label: 'Semua' },
                { id: 'GRN', label: 'GRN Farmasi' },
                { id: 'ASSET', label: 'Aset Tetap' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setDebtTypeFilter(tab.id)}
                  className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold transition-colors ${
                    debtTypeFilter === tab.id
                      ? 'bg-slate-800 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="w-full sm:w-60">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari faktur, aset, supplier..."
                  value={debtSearch}
                  onChange={e => setDebtSearch(e.target.value)}
                  className="form-input text-xs pl-7 py-1 w-full"
                />
              </div>
            </div>
          </div>

          {/* Tabel Tagihan Utang - Tampilan Pas (Fit-to-Width) Tanpa Scroll Geser Kanan-Kiri */}
          <div className="card border border-slate-200 rounded-xl shadow-xs bg-white overflow-hidden">
            <div className="w-full">
              <table className="w-full text-[11px] text-left table-fixed">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                  <tr>
                    <th className="py-2 px-2.5 w-[14%]">No. Tagihan / Ref</th>
                    <th className="py-2 px-2 w-[11%]">Sumber Tagihan</th>
                    <th className="py-2 px-2 w-[16%]">Supplier / Pihak Terkait</th>
                    <th className="py-2 px-2 w-[9%]">Tgl Tagihan</th>
                    <th className="py-2 px-2 w-[13%]">Akun Utang (COA)</th>
                    <th className="py-2 px-2 text-right w-[11%]">Total Tagihan</th>
                    <th className="py-2 px-2 text-right w-[9%]">Terbayar</th>
                    <th className="py-2 px-2 text-right w-[10%]">Sisa Utang</th>
                    <th className="py-2 px-1 text-center w-[7%]">Status</th>
                    <th className="py-2 px-2 text-center w-[7%]">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDebts.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-400">
                        Tidak ada tagihan utang yang cocok dengan kriteria filter.
                      </td>
                    </tr>
                  ) : (
                    filteredDebts.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2 px-2.5 font-mono font-bold text-slate-900 truncate" title={item.refNumber}>
                          {item.refNumber}
                        </td>
                        <td className="py-2 px-2 whitespace-nowrap">
                          {item.debtType === 'GRN' ? (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              GRN Farmasi
                            </span>
                          ) : (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-300">
                              Aset Tetap
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2 font-medium text-slate-800 truncate" title={item.partyName}>
                          {item.partyName}
                        </td>
                        <td className="py-2 px-2 text-slate-500 whitespace-nowrap">
                          {fmtDate(item.transactionDate)}
                        </td>
                        <td className="py-2 px-2 leading-tight">
                          <span className="font-mono font-bold text-slate-800 text-[11px] block">{item.debtAccountCode}</span>
                          <span className="text-[10px] text-slate-500 block truncate" title={item.debtAccountName}>
                            {item.debtAccountCode === '2-11-001' ? 'Utang Obat/PBF' : item.debtAccountCode === '2-11-002' ? 'Utang Alat Medis' : 'Utang Aset Tetap'}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-right font-mono font-semibold text-slate-800 whitespace-nowrap">
                          {fmtIDR(item.totalAmount)}
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-emerald-700 whitespace-nowrap">
                          {fmtIDR(item.totalPaid)}
                        </td>
                        <td className="py-2 px-2 text-right font-mono font-bold whitespace-nowrap">
                          <span className={item.unpaid > 0 ? 'text-rose-600' : 'text-slate-400'}>
                            {fmtIDR(item.unpaid)}
                          </span>
                        </td>
                        <td className="py-2 px-1 text-center whitespace-nowrap">
                          {item.status === 'PAID' ? (
                            <span className="inline-flex items-center justify-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <Check className="w-2.5 h-2.5" /> LUNAS
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              <AlertCircle className="w-2.5 h-2.5" /> UTANG
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-center whitespace-nowrap">
                          {item.status === 'UNPAID' ? (
                            <button
                              onClick={() => handleOpenPayDebt(item)}
                              className="px-2 py-1 text-[11px] font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-xs flex items-center justify-center gap-1 w-full"
                              title="Bayar Utang Sekarang"
                            >
                              <Wallet className="w-3 h-3" />
                              <span>Bayar</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-emerald-700 font-mono font-bold">
                              Lunas
                            </span>
                          )}
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

      {/* ══════════════════════════════════════════════════════════════
          TAB 2: PENGELUARAN KAS OPERASIONAL (REGULAR EXPENSES)
          ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'expenses' && (
        <div className="space-y-3 animate-fadeIn">
          {/* Summary Cards Pengeluaran - Solid & Cerah, Huruf Arial Narrow Profesional, Tanpa Sub-tulisan di Bawah Angka */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            <div className="rounded-xl p-3 shadow-xs bg-[#e11d48] text-white">
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/90">Total Pengeluaran (Posted)</p>
              <p className="font-bold text-xl md:text-2xl mt-1 tracking-tight" style={{ fontFamily: '"Arial Narrow", "Arial", sans-serif' }}>
                {fmtIDR(totalPostedExpense)}
              </p>
            </div>
            <div className="rounded-xl p-3 shadow-xs bg-[#d97706] text-white">
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/90">Menunggu Otorisasi (Draft)</p>
              <p className="font-bold text-xl md:text-2xl mt-1 tracking-tight" style={{ fontFamily: '"Arial Narrow", "Arial", sans-serif' }}>
                {totalDraftExpense}
              </p>
            </div>
            <div className="rounded-xl p-3 shadow-xs bg-[#0284c7] text-white">
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/90">Total Transaksi Pengeluaran</p>
              <p className="font-bold text-xl md:text-2xl mt-1 tracking-tight" style={{ fontFamily: '"Arial Narrow", "Arial", sans-serif' }}>
                {effectiveExpenses.length}
              </p>
            </div>
          </div>

          <div className="card p-2.5 bg-white border border-slate-200 rounded-xl shadow-xs">
            <div className="flex flex-wrap gap-2.5 items-center justify-between">
              <div className="flex flex-wrap gap-2 items-center">
                <SearchInput value={search} onChange={setSearch} placeholder="Cari keterangan, vendor…" className="w-56 text-xs" />
                <select className="form-select w-44 text-xs font-medium py-1" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
                  <option value="ALL">Semua Kategori</option>
                  {EXPENSE_CATEGORIES.map(c => <option key={c.label} value={c.label}>{c.label}</option>)}
                </select>
              </div>
              <span className="text-[11px] text-slate-400">{filteredExpenses.length} transaksi ditemukan</span>
            </div>
          </div>

          {/* Tabel Pengeluaran Kas Operasional - Fit-to-Width Tanpa Scroll Geser Kanan-Kiri */}
          <div className="card border border-slate-200 rounded-xl shadow-xs bg-white overflow-hidden">
            <div className="w-full">
              <table className="w-full text-[11px] text-left table-fixed">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                  <tr>
                    <th className="py-2 px-2.5 w-[15%]">No. Pengeluaran</th>
                    <th className="py-2 px-2 w-[9%]">Tanggal</th>
                    <th className="py-2 px-2 w-[15%]">Kategori Beban</th>
                    <th className="py-2 px-2 w-[21%]">Keterangan</th>
                    <th className="py-2 px-2 w-[13%]">Vendor / Pihak</th>
                    <th className="py-2 px-2 w-[11%]">Metode Bayar</th>
                    <th className="py-2 px-2 text-right w-[11%]">Nominal (Rp)</th>
                    <th className="py-2 px-1 text-center w-[6%]">Status</th>
                    <th className="py-2 px-1 text-center w-[4%]">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredExpenses.length === 0 ? (
                    <tr><td colSpan={9} className="text-center py-8 text-slate-400">Belum ada pengeluaran dicatat</td></tr>
                  ) : filteredExpenses.map(e => (
                    <tr key={e.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2 px-2.5 font-mono font-bold text-primary-700 truncate" title={e.expenseNumber}>{e.expenseNumber}</td>
                      <td className="py-2 px-2 whitespace-nowrap">{fmtDate(e.expenseDate)}</td>
                      <td className="py-2 px-2 whitespace-nowrap"><span className="badge badge-yellow text-[9px] truncate max-w-full">{e.category}</span></td>
                      <td className="py-2 px-2 truncate" title={e.description}>{e.description}</td>
                      <td className="py-2 px-2 text-slate-600 truncate" title={e.vendorName || '—'}>{e.vendorName || '—'}</td>
                      <td className="py-2 px-2 font-mono text-[10px] whitespace-nowrap">{paymentMethodLabel(e.paymentMethod)}</td>
                      <td className="py-2 px-2 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                        {fmtIDR(e.grossAmount || e.netAmount)}
                      </td>
                      <td className="py-2 px-1 text-center whitespace-nowrap">
                        <StatusBadge status={e.status === 'POSTED' ? 'POSTED' : e.status === 'VOID' ? 'VOID' : 'DRAFT'} />
                      </td>
                      <td className="py-2 px-1 text-center whitespace-nowrap">
                        <button className="btn-ghost p-1" onClick={() => { setSelected(e); setModal('view') }} title="Lihat Detail"><Eye className="w-3.5 h-3.5" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          MODAL: BAYAR UTANG TERINTEGRASI (GRN & ASET TETAP)
          ══════════════════════════════════════════════════════════════ */}
      {modal === 'pay_debt' && payingDebtItem && (
        <Modal
          open={true}
          onClose={() => setModal(null)}
          title={`Pelunasan Tagihan Utang: ${payingDebtItem.refNumber}`}
          size="md"
        >
          <form onSubmit={handleExecutePayDebt} className="space-y-4 text-xs">
            {/* Header Ringkasan Tagihan */}
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-rose-900 text-xs">{payingDebtItem.title}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-200 text-rose-900 font-mono">
                  {payingDebtItem.debtType === 'GRN' ? 'FAKTUR PBF' : 'PENGADAAN ASET'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-slate-700 pt-1 border-t border-rose-200/60">
                <div>
                  <span className="text-slate-500">Pihak / Supplier:</span>
                  <p className="font-semibold text-slate-900">{payingDebtItem.partyName}</p>
                </div>
                <div>
                  <span className="text-slate-500">Akun Utang (DR):</span>
                  <p className="font-mono font-bold text-rose-700">{payingDebtItem.debtAccountCode} — {payingDebtItem.debtAccountName}</p>
                </div>
                <div>
                  <span className="text-slate-500">Total Nilai Tagihan:</span>
                  <p className="font-mono font-bold text-slate-900">{fmtIDR(payingDebtItem.totalAmount)}</p>
                </div>
                <div>
                  <span className="text-slate-500">Sisa Utang Belum Lunas:</span>
                  <p className="font-mono font-bold text-red-600 text-sm">{fmtIDR(payingDebtItem.unpaid)}</p>
                </div>
              </div>
            </div>

            {/* Input Nominal yang Dibayar: SAMA PERSIS */}
            <div>
              <label className="form-label text-xs font-bold text-slate-900">Nominal yang Dibayarkan (Rp) *</label>
              <input
                type="number"
                step="any"
                className="form-input text-xs font-mono font-bold text-slate-900 text-base py-2"
                value={payForm.payAmount}
                onChange={e => setPayForm(f => ({ ...f, payAmount: e.target.value }))}
                required
                max={payingDebtItem.unpaid + 1}
              />
              <p className="text-[11px] text-slate-500 mt-1 font-mono">
                Terformat: <strong className="text-slate-800">{fmtIDR(parseExactNominal(payForm.payAmount))}</strong> (Sama persis tanpa pemotongan)
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label text-xs font-bold">Sumber Kas / Rekening Bank (CR) *</label>
                <select
                  className="form-select text-xs font-medium"
                  value={payForm.paymentMethod}
                  onChange={e => setPayForm(f => ({ ...f, paymentMethod: e.target.value }))}
                  required
                >
                  <option value="TRANSFER">Transfer Bank BCA (1-11-003)</option>
                  <option value="KAS_BESAR">Kas Besar Klinik (1-11-002)</option>
                  <option value="KAS">Kas Kecil Kasir (1-11-001)</option>
                  <option value="KARTU_KREDIT">Kartu Kredit Operasional (2-11-005)</option>
                </select>
              </div>

              <div>
                <label className="form-label text-xs font-bold">Tanggal Pembayaran *</label>
                <input
                  type="date"
                  className="form-input text-xs"
                  value={payForm.payDate}
                  onChange={e => setPayForm(f => ({ ...f, payDate: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div>
              <label className="form-label text-xs font-bold">Keterangan / Berita Pembayaran</label>
              <textarea
                className="form-textarea text-xs"
                rows={2}
                value={payForm.notes}
                onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))}
                required
              />
            </div>

            {/* Jurnal Otomatis PSAK Info */}
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 text-[11px] space-y-1">
              <div className="font-bold flex items-center gap-1">
                <Check className="w-3.5 h-3.5 text-emerald-700" />
                Jurnal Pelunasan Otomatis ke Buku Besar:
              </div>
              <div className="font-mono text-emerald-800 pl-4">
                • DR: {payingDebtItem.debtAccountCode} ({payingDebtItem.debtAccountName}) = {fmtIDR(parseExactNominal(payForm.payAmount))}<br />
                • CR: {payForm.paymentMethod === 'TRANSFER' ? '1-11-003' : payForm.paymentMethod === 'KAS_BESAR' ? '1-11-002' : '1-11-001'} (Kas/Bank) = {fmtIDR(parseExactNominal(payForm.payAmount))}
              </div>
              <p className="text-[10px] text-emerald-700 italic pt-0.5">
                *Status tagihan otomatis berubah menjadi LUNAS setelah transaksi ini diposting.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={() => setModal(null)}
                disabled={isProcessingPay}
              >
                Batal
              </button>
              <button
                type="submit"
                className="btn-primary text-xs bg-rose-600 hover:bg-rose-700 border-rose-600 flex items-center gap-1.5 px-4"
                disabled={isProcessingPay}
              >
                <Wallet className="w-4 h-4" />
                <span>{isProcessingPay ? 'Memproses Pelunasan...' : 'Bayar Sekarang & Catat ke Buku Besar'}</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: CATAT PENGELUARAN BARU */}
      <Modal open={modal === 'add'} onClose={() => setModal(null)} title="Catat Pengeluaran Baru" size="lg">
        <ExpenseForm
          vendors={vendors}
          storeBatches={effectiveBatches}
          storeExpenses={effectiveExpenses}
          onSave={async (data) => {
            try {
              await saveExpense(data)
              await refreshAll()
              toast.success(`Pengeluaran ${data.expenseNumber} berhasil disimpan.`)
              setModal(null)
            } catch (err) {
              toast.error(err.message)
            }
          }}
          onClose={() => setModal(null)}
          generateExpenseNumber={generateExpenseNumber}
          activeBranchId={activeBranchId}
          appSettings={appSettings}
        />
      </Modal>

      {/* MODAL: VIEW DETAIL PENGELUARAN */}
      <Modal open={modal === 'view'} onClose={() => setModal(null)} title={`Detail Pengeluaran — ${selected?.expenseNumber}`} size="md"
        footer={<button className="btn-secondary text-xs" onClick={() => setModal(null)}>Tutup</button>}>
        {selected && (
          <div className="space-y-2.5 text-xs">
            {[
              ['No. Pengeluaran', selected.expenseNumber],
              ['Tanggal Transaksi', fmtDate(selected.expenseDate)],
              ['Kategori Beban', selected.category],
              ['Keterangan', selected.description],
              ['Vendor / Pihak', selected.vendorName || '—'],
              ['Metode Pembayaran', paymentMethodLabel(selected.paymentMethod)],
              ['Nominal Pengeluaran', fmtIDR(selected.grossAmount || selected.netAmount)],
              ['Status Jurnal', selected.status === 'POSTED' ? 'POSTED (Tercatat di Buku Besar)' : 'DRAFT']
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-slate-100 pb-1.5">
                <span className="text-slate-500">{k}</span>
                <span className="font-semibold font-mono text-slate-800">{v}</span>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}
