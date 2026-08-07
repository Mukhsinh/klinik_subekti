import { useState, useMemo, useEffect } from 'react'
import { Plus, CheckCircle, Eye, CheckSquare, Square, Building2, AlertCircle } from 'lucide-react'
import { useStore } from '../store/useStore'
import Modal from '../components/ui/Modal'
import SearchInput from '../components/ui/SearchInput'
import { StatusBadge } from '../components/ui/Badge'
import { fmtIDR, fmtDate, todayISO, paymentMethodLabel } from '../utils/format'
import SearchableSelect from '../components/ui/SearchableSelect'
import { fetchBatches, fetchExpenses, upsertExpense } from '../lib/db'
import toast from 'react-hot-toast'
import { v4 as uuidv4 } from 'uuid'

const EXPENSE_CATEGORIES = [
  { label: 'Pembayaran Utang PBF / Supplier', coa: '2-11-001' },
  { label: 'Listrik', coa: '6-13-001' },
  { label: 'Air (PDAM)', coa: '6-13-002' },
  { label: 'Telepon & Internet', coa: '6-13-003' },
  { label: 'Sewa Gedung', coa: '6-13-004' },
  { label: 'Alat Tulis Kantor', coa: '6-13-005' },
  { label: 'Kebersihan & Sanitasi', coa: '6-13-006' },
  { label: 'Pemeliharaan Gedung', coa: '6-14-001' },
  { label: 'Servis & Kalibrasi Alat', coa: '6-14-002' },
  { label: 'Pemeliharaan Kendaraan', coa: '6-14-003' },
  { label: 'Gaji Karyawan', coa: '6-11-004' },
  { label: 'BPJS Ketenagakerjaan', coa: '6-11-006' },
  { label: 'Iklan & Promosi', coa: '6-16-001' },
  { label: 'Audit & Konsultasi', coa: '6-18-001' },
  { label: 'Notaris & Legal', coa: '6-18-002' },
  { label: 'Perjalanan Dinas', coa: '6-18-003' },
  { label: 'Bunga Pinjaman', coa: '6-18-004' },
  { label: 'Beban Lain-Lain', coa: '6-18-006' },
]

function ExpenseForm({ onSave, onClose, generateExpenseNumber, activeBranchId, vendors = [], storeBatches = [], storeExpenses = [] }) {
  const [form, setForm] = useState({
    expenseNumber: generateExpenseNumber(),
    expenseDate: todayISO(),
    category: EXPENSE_CATEGORIES[0].label,
    description: '',
    vendorName: '',
    paymentMethod: 'KAS_BESAR',
    grossAmount: '',
    ppnAmount: '',
    pphAmount: '',
    selectedGrnRefs: [],
  })

  // Selected unpaid GRN debt items state: { [grnRef]: { selected: boolean, payAmount: number, totalVal: number, unpaid: number } }
  const [grnDebtSelections, setGrnDebtSelections] = useState({})

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const vendorOptions = useMemo(() =>
    (vendors || [])
      .filter(v => v.isActive !== false)
      .map(v => ({ value: v.name, label: `${v.code} — ${v.name}` })),
    [vendors]
  )

  const selectedCat = EXPENSE_CATEGORIES.find(c => c.label === form.category) || EXPENSE_CATEGORIES[0]

  // Calculate unpaid GRNs for the selected vendor
  const vendorUnpaidGRNs = useMemo(() => {
    if (!form.vendorName) return []

    // Group batches by GRN reference for this vendor
    const grnMap = {}
    const batchesForVendor = (storeBatches || []).filter(b => {
      const grnRef = (b.grnReference || b.grn_reference || '').toUpperCase()
      const batchNo = (b.batchNumber || b.batch_number || '').toUpperCase()
      const suppName = (b.supplierName || b.supplier_name || '').toLowerCase()
      if (grnRef === 'SALDO-AWAL' || batchNo === 'SALDO-AWAL' || suppName.includes('saldo awal')) return false
      const sName = b.supplierName || b.supplier_name || ''
      return sName.toLowerCase().trim() === form.vendorName.toLowerCase().trim()
    })

    batchesForVendor.forEach(b => {
      const ref = b.grnReference || b.grn_reference || 'GRN-UNKNOWN'
      if (!grnMap[ref]) {
        grnMap[ref] = {
          grnReference: ref,
          supplierName: form.vendorName,
          receivedAt: b.receivedAt || b.received_at || b.createdAt,
          totalVal: 0,
        }
      }
      const qty = Number(b.quantityReceived ?? b.quantity_received ?? 0)
      const cost = Number(b.unitCostPrice ?? b.unit_cost_price ?? 0)
      grnMap[ref].totalVal += qty * cost
    })

    // Calculate total paid per GRN reference from existing expenses
    const paidPerGrn = {}
      ; (storeExpenses || []).forEach(e => {
        if (e.status !== 'VOID' && e.vendorName && e.vendorName.toLowerCase().trim() === form.vendorName.toLowerCase().trim()) {
          const refs = e.selectedGrnRefs || []
          if (Array.isArray(refs) && refs.length > 0) {
            const portion = (e.grossAmount || 0) / refs.length
            refs.forEach(r => {
              paidPerGrn[r] = (paidPerGrn[r] || 0) + portion
            })
          }
        }
      })

    const grnList = Object.values(grnMap).map(g => {
      const totalPaid = paidPerGrn[g.grnReference] || 0
      const unpaid = Math.max(0, g.totalVal - totalPaid)
      return {
        ...g,
        totalPaid,
        unpaid,
      }
    }).filter(g => g.unpaid > 0)

    return grnList.sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt))
  }, [form.vendorName, storeBatches, storeExpenses])

  // Initialize or reset selections when vendorName or vendorUnpaidGRNs changes
  useEffect(() => {
    if (vendorUnpaidGRNs.length > 0) {
      const initialSelections = {}
      vendorUnpaidGRNs.forEach(g => {
        initialSelections[g.grnReference] = {
          selected: false,
          payAmount: Math.round(g.unpaid),
          totalVal: Math.round(g.totalVal),
          unpaid: Math.round(g.unpaid),
        }
      })
      setGrnDebtSelections(initialSelections)
    } else {
      setGrnDebtSelections({})
    }
  }, [vendorUnpaidGRNs])

  // Handle toggling GRN checkbox
  const handleToggleGrn = (grnRef) => {
    setGrnDebtSelections(prev => {
      const current = prev[grnRef] || { selected: false, payAmount: 0 }
      const updated = {
        ...prev,
        [grnRef]: {
          ...current,
          selected: !current.selected,
        }
      }

      // Auto update total gross amount and description
      const checkedRefs = Object.keys(updated).filter(ref => updated[ref].selected)
      const sumAmount = checkedRefs.reduce((s, ref) => s + (Number(updated[ref].payAmount) || 0), 0)

      if (sumAmount > 0) {
        set('grossAmount', sumAmount)
        set('description', `Pelunasan Utang PBF: ${checkedRefs.join(', ')}`)
        set('selectedGrnRefs', checkedRefs)
      }

      return updated
    })
  }

  // Handle changing payment amount for a specific GRN
  const handlePayAmountChange = (grnRef, val) => {
    const numVal = parseFloat(val) || 0
    setGrnDebtSelections(prev => {
      const updated = {
        ...prev,
        [grnRef]: {
          ...prev[grnRef],
          payAmount: numVal,
        }
      }

      const checkedRefs = Object.keys(updated).filter(ref => updated[ref].selected)
      const sumAmount = checkedRefs.reduce((s, ref) => s + (Number(updated[ref].payAmount) || 0), 0)

      if (sumAmount > 0) {
        set('grossAmount', sumAmount)
      }

      return updated
    })
  }

  // Select/Unselect All Unpaid Invoices
  const handleSelectAll = (selectAll) => {
    setGrnDebtSelections(prev => {
      const updated = {}
      Object.keys(prev).forEach(ref => {
        updated[ref] = {
          ...prev[ref],
          selected: selectAll,
        }
      })

      const checkedRefs = selectAll ? Object.keys(updated) : []
      const sumAmount = checkedRefs.reduce((s, ref) => s + (Number(updated[ref].payAmount) || 0), 0)

      if (selectAll) {
        set('grossAmount', sumAmount)
        set('description', `Pelunasan Utang PBF: ${checkedRefs.join(', ')}`)
        set('selectedGrnRefs', checkedRefs)
      }

      return updated
    })
  }

  const gross = parseFloat(form.grossAmount) || 0
  const ppn = parseFloat(form.ppnAmount) || 0
  const pph = parseFloat(form.pphAmount) || 0
  const netAmount = gross + ppn - pph

  const creditAccountCode = useMemo(() => {
    const map = {
      KAS: '1-11-001',
      KAS_BESAR: '1-11-002',
      TRANSFER: '1-11-003',
      KARTU_KREDIT: '2-11-005'
    }
    return map[form.paymentMethod] || '1-11-003'
  }, [form.paymentMethod])

  const submit = (e) => {
    e.preventDefault()
    if (!form.description.trim()) {
      toast.error('Keterangan pengeluaran wajib diisi.')
      return
    }
    if (!(parseFloat(form.grossAmount) > 0)) {
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
    <form onSubmit={submit} className="space-y-5">
      {/* Top Banner */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-md flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-blue-200 font-bold">Form Transit Pengeluaran Kas/Bank</p>
          <h3 className="text-lg font-extrabold">{form.expenseNumber}</h3>
        </div>
        <div className="text-right">
          <p className="text-xs text-blue-200">Perkiraan COA (Debet / Kredit)</p>
          <p className="text-xs font-bold font-mono bg-blue-800/80 px-2.5 py-1 rounded-lg border border-blue-400">
            DR: {selectedCat.coa} | CR: {creditAccountCode}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="form-label">No. Transaksi</label>
          <input className="form-input font-mono bg-slate-100 text-slate-800 font-bold" value={form.expenseNumber} readOnly />
        </div>
        <div>
          <label className="form-label">Tanggal Transaksi *</label>
          <input type="date" className="form-input" value={form.expenseDate} onChange={e => set('expenseDate', e.target.value)} required />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="form-label">Kategori Beban (COA) *</label>
          <SearchableSelect
            value={form.category}
            onChange={val => set('category', val)}
            options={EXPENSE_CATEGORIES.map(c => ({ value: c.label, label: `${c.label} [${c.coa}]` }))}
            placeholder="— Pilih Kategori Beban —"
          />
        </div>
        <div>
          <label className="form-label">Metode Pembayaran *</label>
          <SearchableSelect
            value={form.paymentMethod}
            onChange={val => set('paymentMethod', val)}
            options={[
              { value: 'KAS', label: 'Kas Kecil Klinik (1-11-001)' },
              { value: 'KAS_BESAR', label: 'Kas Besar Klinik (1-11-002)' },
              { value: 'TRANSFER', label: 'Transfer Bank / Rekening (1-11-003)' },
              { value: 'KARTU_KREDIT', label: 'Kartu Kredit Operasional (2-11-005)' },
            ]}
            placeholder="— Pilih Metode Pembayaran —"
          />
        </div>
      </div>

      <div>
        <label className="form-label">Vendor / Supplier Rekanan *</label>
        <SearchableSelect
          value={form.vendorName}
          onChange={val => set('vendorName', val)}
          options={vendorOptions}
          placeholder="— Pilih Master Vendor (/settings/vendors) —"
        />
        {vendorOptions.length === 0 && (
          <p className="text-xs text-amber-600 mt-1">Belum ada vendor terdaftar di Master Vendor. Anda dapat menambahkannya di /settings/vendors.</p>
        )}
      </div>

      {/* Unpaid Vendor Debt Selection Section */}
      {form.vendorName && (
        <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-amber-700" />
              <p className="text-xs font-bold uppercase tracking-wider text-amber-900">
                Daftar Utang / Faktur GRN Belum Lunas — {form.vendorName}
              </p>
            </div>
            {vendorUnpaidGRNs.length > 0 && (
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => handleSelectAll(true)}
                  className="text-amber-800 font-bold hover:underline"
                >
                  Pilih Semua
                </button>
                <span className="text-amber-300">|</span>
                <button
                  type="button"
                  onClick={() => handleSelectAll(false)}
                  className="text-amber-800 font-bold hover:underline"
                >
                  Reset
                </button>
              </div>
            )}
          </div>

          {vendorUnpaidGRNs.length === 0 ? (
            <p className="text-xs text-amber-700 italic">
              ℹ Tidak ada utang/faktur GRN gantung yang belum lunas untuk vendor ini.
            </p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {vendorUnpaidGRNs.map(g => {
                const sel = grnDebtSelections[g.grnReference] || { selected: false, payAmount: Math.round(g.unpaid) }
                return (
                  <div
                    key={g.grnReference}
                    className={`flex flex-wrap items-center justify-between p-2.5 rounded-lg border text-xs transition-colors ${sel.selected ? 'bg-amber-100 border-amber-400 font-medium' : 'bg-white border-amber-200 hover:bg-amber-50/50'}`}
                  >
                    <div
                      className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-[200px]"
                      onClick={() => handleToggleGrn(g.grnReference)}
                    >
                      {sel.selected ? (
                        <CheckSquare className="w-4 h-4 text-amber-700 flex-shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      )}
                      <div>
                        <p className="font-bold text-slate-900 font-mono">{g.grnReference}</p>
                        <p className="text-[10px] text-slate-500">Tgl Penerimaan: {fmtDate(g.receivedAt)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <p className="text-[10px] text-slate-500">Sisa Utang</p>
                        <p className="font-bold font-mono text-red-600">{fmtIDR(g.unpaid)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500">Jumlah Dibayar (Rp)</p>
                        <input
                          type="number"
                          className="w-28 form-input text-right font-mono font-bold py-1 text-xs"
                          value={sel.payAmount}
                          onChange={e => handlePayAmountChange(g.grnReference, e.target.value)}
                          disabled={!sel.selected}
                          min={0}
                          max={g.unpaid}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <div>
        <label className="form-label">Keterangan Transaksi *</label>
        <textarea className="form-textarea" rows={2} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Tulis rincian atau peruntukan pengeluaran…" required />
      </div>

      {/* Rincian Nominal */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-700">Rincian Perhitungan Beban & Pajak</p>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="form-label">Nilai Bruto (Rp) *</label>
            <input type="number" className="form-input font-mono font-bold text-slate-900" value={form.grossAmount} onChange={e => set('grossAmount', e.target.value)} min={0} step={1000} required placeholder="0" />
          </div>
          <div>
            <label className="form-label">PPN Masukan (Rp)</label>
            <input type="number" className="form-input font-mono" value={form.ppnAmount} onChange={e => set('ppnAmount', e.target.value)} min={0} step={1000} placeholder="0" />
          </div>
          <div>
            <label className="form-label">PPh Dipotong (Rp)</label>
            <input type="number" className="form-input font-mono" value={form.pphAmount} onChange={e => set('pphAmount', e.target.value)} min={0} step={1000} placeholder="0" />
          </div>
        </div>
      </div>

      {/* Total Net Banner */}
      <div className="flex justify-between items-center bg-blue-600 text-white rounded-xl px-5 py-3.5 shadow-md">
        <span className="text-sm font-semibold">Total Net Kas Terbayar:</span>
        <span className="font-mono text-xl font-extrabold">{fmtIDR(netAmount)}</span>
      </div>

      <div className="p-3 bg-emerald-600 text-white rounded-xl text-xs flex items-center justify-between">
        <span>ℹ Jurnal Otomatis PSAK:</span>
        <span className="font-mono font-bold">DR: {selectedCat.coa} | CR: {creditAccountCode}</span>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" className="btn-secondary" onClick={onClose}>Batal</button>
        <button type="submit" className="btn-primary px-6">Simpan Draft Pengeluaran</button>
      </div>
    </form>
  )
}

export default function ExpensePage() {
  const { expenses, invBatches, journalEntries, generateExpenseNumber, saveExpense, postExpense, activeBranchId, saveJournalDraft, postJournalEntry, generateEntryNumber, vendors } = useStore()
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('ALL')

  const [dbBatches, setDbBatches] = useState([])
  const [dbExpenses, setDbExpenses] = useState([])

  useEffect(() => {
    let isMounted = true
    const loadLiveData = async () => {
      try {
        const [bData, eData] = await Promise.all([
          fetchBatches().catch(() => []),
          fetchExpenses().catch(() => [])
        ])
        if (isMounted) {
          if (Array.isArray(bData)) setDbBatches(bData)
          if (Array.isArray(eData)) setDbExpenses(eData)
        }
      } catch (err) {
        console.warn('[ExpensePage] Error fetching live DB:', err.message)
      }
    }
    loadLiveData()
    return () => { isMounted = false }
  }, [])

  const effectiveBatches = useMemo(() => {
    const map = new Map()
      ; (dbBatches || []).forEach(b => { if (b.id) map.set(b.id, b) })
      ; (invBatches || []).forEach(b => { if (b.id) map.set(b.id, b) })
    return Array.from(map.values())
  }, [dbBatches, invBatches])

  const effectiveExpenses = useMemo(() => {
    const map = new Map()
      ; (dbExpenses || []).forEach(e => {
        const key = e.id || e.expenseNumber
        if (key) map.set(key, e)
      })
      ; (expenses || []).forEach(e => {
        const key = e.id || e.expenseNumber
        if (key) map.set(key, e)
      })
      // Reconcile missing expense records from posted/draft expense journals
      ; (journalEntries || []).forEach(j => {
        if (j.entryType === 'EXPENSE' || j.entryNumber?.startsWith('EXP/')) {
          const exists = Array.from(map.values()).some(
            e => e.id === j.id || e.journalEntryId === j.id || e.expenseNumber === j.entryNumber
          )
          if (!exists) {
            let cat = 'Beban Lain-Lain'
            let desc = j.description || ''
            if (desc.startsWith('Pengeluaran: ')) {
              const clean = desc.replace('Pengeluaran: ', '')
              const parts = clean.split(' — ')
              if (parts.length >= 1) cat = parts[0]
              if (parts.length >= 2) desc = parts.slice(1).join(' — ')
            }
            const synthExpense = {
              id: j.id,
              expenseNumber: j.entryNumber || `EXP-${j.id.slice(0, 8)}`,
              expenseDate: j.transactionDate,
              category: cat,
              description: desc,
              vendorName: '',
              paymentMethod: 'KAS_BESAR',
              grossAmount: Number(j.totalDebit || 0),
              ppnAmount: 0,
              pphAmount: 0,
              netAmount: Number(j.totalDebit || 0),
              status: j.status === 'POSTED' ? 'POSTED' : 'DRAFT',
              journalEntryId: j.id,
              branchId: j.branchId,
              createdAt: j.createdAt || new Date().toISOString(),
            }
            map.set(synthExpense.id, synthExpense)
            // Persist back to Supabase database so expense_entries table stays populated
            upsertExpense(synthExpense).catch(() => { })
          }
        }
      })
    return Array.from(map.values())
  }, [dbExpenses, expenses, journalEntries])

  const filtered = useMemo(() =>
    effectiveExpenses
      .filter(e => catFilter === 'ALL' || e.category === catFilter)
      .filter(e => !search || e.description?.toLowerCase().includes(search.toLowerCase()) ||
        e.expenseNumber?.toLowerCase().includes(search.toLowerCase()) ||
        e.vendorName?.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => new Date(b.expenseDate) - new Date(a.expenseDate)),
    [effectiveExpenses, catFilter, search])

  const handleSaveDraft = async (data) => {
    try {
      await saveExpense(data)
      const eData = await fetchExpenses().catch(() => [])
      if (Array.isArray(eData)) setDbExpenses(eData)
      toast.success(`Draft pengeluaran ${data.expenseNumber} berhasil disimpan.`)
      setModal(null)
    } catch (err) {
      console.error('[handleSaveDraft] Error:', err)
      toast.error(`Gagal menyimpan draft pengeluaran: ${err.message || 'Terjadi kesalahan'}`)
    }
  }

  const handlePost = async (expense) => {
    try {
      const entryId = uuidv4()
      const entryNumber = generateEntryNumber('EXP')
      const catObj = EXPENSE_CATEGORIES.find(c => c.label === expense.category) || { coa: '6-18-006' }
      const debitAcc = catObj.coa

      const creditAccMap = {
        KAS: '1-11-001',
        KAS_BESAR: '1-11-002',
        TRANSFER: '1-11-003',
        KARTU_KREDIT: '2-11-005'
      }
      const creditAcc = creditAccMap[expense.paymentMethod] || expense.creditCoaCode || '1-11-003'

      const header = {
        id: entryId,
        branchId: expense.branchId || activeBranchId,
        entryNumber,
        transactionDate: expense.expenseDate,
        description: `Pengeluaran: ${expense.category} — ${expense.description}`,
        entryType: 'EXPENSE',
        totalDebit: expense.grossAmount,
        totalCredit: expense.grossAmount,
      }
      const jItems = [
        { id: uuidv4(), journalEntryId: entryId, accountCode: debitAcc, description: expense.description, debit: expense.grossAmount, credit: 0 },
        { id: uuidv4(), journalEntryId: entryId, accountCode: creditAcc, description: `${paymentMethodLabel(expense.paymentMethod)} — ${expense.vendorName || ''}`, debit: 0, credit: expense.grossAmount },
      ]
      await saveJournalDraft(header, jItems)
      await postJournalEntry(entryId, 'Admin')
      await postExpense(expense.id, entryId, 'Admin', expense)

      const eData = await fetchExpenses().catch(() => [])
      if (Array.isArray(eData)) setDbExpenses(eData)

      toast.success(`Pengeluaran ${expense.expenseNumber} berhasil diposting ke jurnal.`)
    } catch (err) {
      console.error('[handlePost] Error:', err)
      toast.error(`Gagal memposting pengeluaran: ${err.message || 'Terjadi kesalahan'}`)
    }
  }

  const totalPosted = effectiveExpenses.filter(e => e.status === 'POSTED').reduce((s, e) => s + (e.grossAmount || 0), 0)
  const totalDraft = effectiveExpenses.filter(e => e.status === 'DRAFT').length

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Portal Pengeluaran (Expense)</h1>
          <p className="text-sm text-slate-400 mt-0.5">Pencatatan biaya operasional & pelunasan utang PBF</p>
        </div>
        <button className="btn-primary font-bold shadow-md flex items-center gap-1.5" onClick={() => setModal('add')}>
          <Plus className="w-4 h-4" />Catat Pengeluaran
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 font-sans">
        <div className="rounded-xl p-4 shadow-sm" style={{ background: '#DC2626' }}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-red-100">Total Pengeluaran (Posted)</p>
          <p className="font-extrabold text-2xl text-white tracking-tight mt-1">{fmtIDR(totalPosted)}</p>
        </div>
        <div className="rounded-xl p-4 shadow-sm" style={{ background: '#D97706' }}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-100">Menunggu Otorisasi</p>
          <p className="font-extrabold text-2xl text-white tracking-tight mt-1">{totalDraft} <span className="text-xs font-semibold text-amber-200">draft</span></p>
        </div>
        <div className="rounded-xl p-4 shadow-sm" style={{ background: '#2563EB' }}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-blue-100">Total Transaksi</p>
          <p className="font-extrabold text-2xl text-white tracking-tight mt-1">{effectiveExpenses.length} <span className="text-xs font-semibold text-blue-200">dokumen</span></p>
        </div>
      </div>

      <div className="card card-body">
        <div className="flex flex-wrap gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Cari keterangan, vendor…" className="w-64" />
          <select className="form-select w-48 text-xs font-medium" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
            <option value="ALL">Semua Kategori</option>
            {EXPENSE_CATEGORIES.map(c => <option key={c.label} value={c.label}>{c.label}</option>)}
          </select>
          <span className="ml-auto text-xs text-slate-400 self-center">{filtered.length} transaksi</span>
        </div>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>No. Pengeluaran</th><th>Tanggal</th><th>Kategori</th><th>Keterangan</th>
                <th>Vendor</th><th>Metode</th><th className="text-right">Nilai Bruto</th>
                <th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-slate-400">Belum ada pengeluaran dicatat</td></tr>
              ) : filtered.map(e => (
                <tr key={e.id}>
                  <td className="font-mono text-xs text-primary-700 font-semibold">{e.expenseNumber}</td>
                  <td className="text-sm">{fmtDate(e.expenseDate)}</td>
                  <td className="text-xs"><span className="badge badge-yellow">{e.category}</span></td>
                  <td className="max-w-[180px] truncate text-sm">{e.description}</td>
                  <td className="text-xs text-slate-500 font-medium">{e.vendorName || '—'}</td>
                  <td className="text-xs font-mono">{paymentMethodLabel(e.paymentMethod)}</td>
                  <td className="text-right font-mono text-sm font-bold">{fmtIDR(e.grossAmount)}</td>
                  <td><StatusBadge status={e.status === 'POSTED' ? 'POSTED' : e.status === 'VOID' ? 'VOID' : 'DRAFT'} /></td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button className="btn-ghost p-1.5" onClick={() => { setSelected(e); setModal('view') }} title="Lihat Detail Preview"><Eye className="w-3.5 h-3.5" /></button>
                      {e.status === 'DRAFT' && (
                        <button className="btn-ghost p-1.5 text-emerald-600" onClick={() => handlePost(e)} title="Otorisasi & Post ke Jurnal">
                          <CheckCircle className="w-3.5 h-3.5" />
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

      <Modal open={modal === 'add'} onClose={() => setModal(null)} title="Catat Pengeluaran Baru" size="lg">
        <ExpenseForm
          vendors={vendors}
          storeBatches={effectiveBatches}
          storeExpenses={effectiveExpenses}
          onSave={handleSaveDraft}
          onClose={() => setModal(null)}
          generateExpenseNumber={generateExpenseNumber}
          activeBranchId={activeBranchId}
        />
      </Modal>

      <Modal open={modal === 'view'} onClose={() => setModal(null)} title={`Detail Pengeluaran — ${selected?.expenseNumber}`} size="md"
        footer={<>
          {selected?.status === 'DRAFT' && <button className="btn-success" onClick={() => { handlePost(selected); setModal(null) }}><CheckCircle className="w-4 h-4" />Otorisasi & Posting</button>}
          <button className="btn-secondary" onClick={() => setModal(null)}>Tutup</button>
        </>}>
        {selected && (
          <div className="space-y-3 text-sm">
            {[
              ['No. Pengeluaran', selected.expenseNumber],
              ['Tanggal Transaksi', fmtDate(selected.expenseDate)],
              ['Kategori Beban', selected.category],
              ['Keterangan', selected.description],
              ['Vendor / Supplier', selected.vendorName || '—'],
              ['Faktur / GRN Terkait', Array.isArray(selected.selectedGrnRefs) && selected.selectedGrnRefs.length > 0 ? selected.selectedGrnRefs.join(', ') : '—'],
              ['Metode Pembayaran', paymentMethodLabel(selected.paymentMethod)],
              ['Nilai Bruto', fmtIDR(selected.grossAmount)],
              ['PPN Masukan', fmtIDR(selected.ppnAmount || 0)],
              ['PPh Dipotong', fmtIDR(selected.pphAmount || 0)],
              ['Net Dibayar', fmtIDR(selected.netAmount || selected.grossAmount)],
              ['Status Jurnal', selected.status === 'POSTED' ? 'POSTED (Terjurnal)' : 'DRAFT']
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">{k}</span>
                <span className="font-medium font-mono text-slate-800">{v}</span>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}


