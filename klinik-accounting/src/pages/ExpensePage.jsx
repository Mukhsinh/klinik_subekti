import { useState, useMemo } from 'react'
import { Plus, CheckCircle, Eye } from 'lucide-react'
import { useStore } from '../store/useStore'
import Modal from '../components/ui/Modal'
import SearchInput from '../components/ui/SearchInput'
import { StatusBadge } from '../components/ui/Badge'
import { fmtIDR, fmtDate, todayISO, paymentMethodLabel } from '../utils/format'
import SearchableSelect from '../components/ui/SearchableSelect'
import toast from 'react-hot-toast'
import { v4 as uuidv4 } from 'uuid'

const EXPENSE_CATEGORIES = [
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

function ExpenseForm({ onSave, onClose, generateExpenseNumber, activeBranchId, vendors = [] }) {
  const [form, setForm] = useState({
    expenseNumber: generateExpenseNumber(),
    expenseDate: todayISO(),
    category: EXPENSE_CATEGORIES[0].label,
    description: '',
    vendorName: '',
    paymentMethod: 'TRANSFER',
    grossAmount: '',
    ppnAmount: '',
    pphAmount: '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const vendorOptions = useMemo(() =>
    (vendors || [])
      .filter(v => v.isActive !== false)
      .map(v => ({ value: v.name, label: `${v.code} — ${v.name}` })),
    [vendors]
  )

  const selectedCat = EXPENSE_CATEGORIES.find(c => c.label === form.category) || EXPENSE_CATEGORIES[0]
  const gross = parseFloat(form.grossAmount) || 0
  const ppn = parseFloat(form.ppnAmount) || 0
  const pph = parseFloat(form.pphAmount) || 0
  const netAmount = gross + ppn - pph

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
      branchId: activeBranchId, 
      status: 'DRAFT' 
    })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="form-label">No. Pengeluaran</label>
          <input className="form-input font-mono bg-slate-50" value={form.expenseNumber} readOnly />
        </div>
        <div>
          <label className="form-label">Tanggal</label>
          <input type="date" className="form-input" value={form.expenseDate} onChange={e => set('expenseDate', e.target.value)} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="form-label">Kategori Pengeluaran *</label>
          <SearchableSelect
            value={form.category}
            onChange={val => set('category', val)}
            options={EXPENSE_CATEGORIES.map(c => ({ value: c.label, label: `${c.label} (${c.coa})` }))}
            placeholder="— Pilih Kategori —"
          />
        </div>
        <div>
          <label className="form-label">Metode Pembayaran</label>
          <SearchableSelect
            value={form.paymentMethod}
            onChange={val => set('paymentMethod', val)}
            options={[
              { value: 'KAS', label: 'Kas' },
              { value: 'TRANSFER', label: 'Transfer Bank' },
              { value: 'KARTU_KREDIT', label: 'Kartu Kredit' },
            ]}
            placeholder="— Pilih Metode —"
          />
        </div>
      </div>
      <div>
        <label className="form-label">Keterangan *</label>
        <textarea className="form-textarea" rows={2} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Deskripsi pengeluaran…" required />
      </div>
      <div>
        <label className="form-label">Nama Vendor / Penerima</label>
        <SearchableSelect
          value={form.vendorName}
          onChange={val => set('vendorName', val)}
          options={vendorOptions}
          placeholder="— Pilih Vendor / Penerima —"
        />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="form-label">Nilai Bruto (Rp) *</label>
          <input type="number" className="form-input" value={form.grossAmount} onChange={e => set('grossAmount', e.target.value)} min={0} step={1000} required />
        </div>
        <div>
          <label className="form-label">PPN (Rp)</label>
          <input type="number" className="form-input" value={form.ppnAmount} onChange={e => set('ppnAmount', e.target.value)} min={0} step={1000} />
        </div>
        <div>
          <label className="form-label">PPh Dipotong (Rp)</label>
          <input type="number" className="form-input" value={form.pphAmount} onChange={e => set('pphAmount', e.target.value)} min={0} step={1000} />
        </div>
      </div>
      <div className="flex justify-between items-center bg-slate-50 rounded-xl px-4 py-3 text-sm">
        <span className="text-slate-600">Net Dibayarkan:</span>
        <span className="font-mono font-bold text-slate-800">{fmtIDR(netAmount)}</span>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 text-xs text-blue-700">
        Jurnal otomatis: <strong>Debit {selectedCat.coa} {selectedCat.label}</strong> / <strong>Kredit {form.paymentMethod === 'KAS' ? '1-11-001 Kas Kecil' : '1-11-003 Bank BCA'}</strong>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn-secondary" onClick={onClose}>Batal</button>
        <button type="submit" className="btn-primary">Simpan Draft</button>
      </div>
    </form>
  )
}

export default function ExpensePage() {
  const { expenses, generateExpenseNumber, saveExpense, postExpense, activeBranchId, saveJournalDraft, postJournalEntry, generateEntryNumber, coa, vendors } = useStore()
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('ALL')

  const filtered = useMemo(() =>
    expenses
      .filter(e => catFilter === 'ALL' || e.category === catFilter)
      .filter(e => !search || e.description?.toLowerCase().includes(search.toLowerCase()) ||
        e.expenseNumber?.toLowerCase().includes(search.toLowerCase()) ||
        e.vendorName?.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => new Date(b.expenseDate) - new Date(a.expenseDate)),
    [expenses, catFilter, search])

  const handleSaveDraft = async (data) => {
    await saveExpense(data)
    toast.success(`Draft pengeluaran ${data.expenseNumber} disimpan.`)
    setModal(null)
  }

  const handlePost = async (expense) => {
    const entryId = uuidv4()
    const entryNumber = generateEntryNumber('EXP')
    const catObj = EXPENSE_CATEGORIES.find(c => c.label === expense.category) || { coa: '6-18-006' }
    const debitAcc = catObj.coa
    const creditAcc = expense.paymentMethod === 'KAS' ? '1-11-001' : '1-11-003'
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
    await postExpense(expense.id, entryId, 'Admin')
    toast.success(`Pengeluaran ${expense.expenseNumber} diposting ke buku besar.`)
  }

  const totalPosted = expenses.filter(e => e.status === 'POSTED').reduce((s, e) => s + (e.grossAmount || 0), 0)
  const totalDraft = expenses.filter(e => e.status === 'DRAFT').length

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Portal Pengeluaran (Expense)</h1>
          <p className="text-sm text-slate-400 mt-0.5">Pencatatan biaya operasional</p>
        </div>
        <button className="btn-primary" onClick={() => setModal('add')}><Plus className="w-4 h-4" />Catat Pengeluaran</button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="card card-body bg-red-50 border-0">
          <p className="text-xs text-slate-500 mb-1">Total Pengeluaran (Posted)</p>
          <p className="font-bold text-xl text-red-700">{fmtIDR(totalPosted)}</p>
        </div>
        <div className="card card-body bg-amber-50 border-0">
          <p className="text-xs text-slate-500 mb-1">Menunggu Otorisasi</p>
          <p className="font-bold text-xl text-amber-700">{totalDraft}</p>
        </div>
        <div className="card card-body bg-slate-50 border-0">
          <p className="text-xs text-slate-500 mb-1">Total Transaksi</p>
          <p className="font-bold text-xl text-slate-700">{expenses.length}</p>
        </div>
      </div>

      <div className="card card-body">
        <div className="flex flex-wrap gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Cari keterangan, vendor…" className="w-64" />
          <select className="form-select w-48" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
            <option value="ALL">Semua Kategori</option>
            {EXPENSE_CATEGORIES.map(c => <option key={c.label} value={c.label}>{c.label}</option>)}
          </select>
          <span className="ml-auto text-sm text-slate-400">{filtered.length} transaksi</span>
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
                  <td className="font-mono text-xs text-primary-700">{e.expenseNumber}</td>
                  <td className="text-sm">{fmtDate(e.expenseDate)}</td>
                  <td className="text-xs"><span className="badge badge-yellow">{e.category}</span></td>
                  <td className="max-w-[180px] truncate text-sm">{e.description}</td>
                  <td className="text-xs text-slate-500">{e.vendorName || '—'}</td>
                  <td className="text-xs">{paymentMethodLabel(e.paymentMethod)}</td>
                  <td className="text-right font-mono text-sm font-bold">{fmtIDR(e.grossAmount)}</td>
                  <td><StatusBadge status={e.status === 'POSTED' ? 'POSTED' : e.status === 'VOID' ? 'VOID' : 'DRAFT'} /></td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button className="btn-ghost p-1.5" onClick={() => { setSelected(e); setModal('view') }}><Eye className="w-3.5 h-3.5" /></button>
                      {e.status === 'DRAFT' && (
                        <button className="btn-ghost p-1.5 text-emerald-600" onClick={() => handlePost(e)} title="Otorisasi & Post">
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
        <ExpenseForm vendors={vendors} onSave={handleSaveDraft} onClose={() => setModal(null)} generateExpenseNumber={generateExpenseNumber} activeBranchId={activeBranchId} />
      </Modal>

      <Modal open={modal === 'view'} onClose={() => setModal(null)} title={`Detail Pengeluaran — ${selected?.expenseNumber}`} size="md"
        footer={<>
          {selected?.status === 'DRAFT' && <button className="btn-success" onClick={() => { handlePost(selected); setModal(null) }}><CheckCircle className="w-4 h-4" />Otorisasi & Posting</button>}
          <button className="btn-secondary" onClick={() => setModal(null)}>Tutup</button>
        </>}>
        {selected && (
          <div className="space-y-3 text-sm">
            {[
              ['No.', selected.expenseNumber], 
              ['Tanggal', fmtDate(selected.expenseDate)], 
              ['Kategori', selected.category],
              ['Keterangan', selected.description], 
              ['Vendor', selected.vendorName || '—'],
              ['Metode', paymentMethodLabel(selected.paymentMethod)],
              ['Nilai Bruto', fmtIDR(selected.grossAmount)], 
              ['PPN', fmtIDR(selected.ppnAmount || 0)],
              ['PPh Dipotong', fmtIDR(selected.pphAmount || 0)], 
              ['Net Dibayar', fmtIDR(selected.netAmount || selected.grossAmount)]
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">{k}</span>
                <span className="font-medium">{v}</span>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}
