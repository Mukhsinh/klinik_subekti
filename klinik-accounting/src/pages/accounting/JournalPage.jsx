import { useState, useMemo } from 'react'
import { Plus, Eye, RotateCcw, CheckCircle, Trash2, Download, Printer } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { useAuth } from '../../store/useAuth'
import Modal from '../../components/ui/Modal'
import SearchInput from '../../components/ui/SearchInput'
import { StatusBadge } from '../../components/ui/Badge'
import SearchableSelect from '../../components/ui/SearchableSelect'
import { fmtIDR, fmtDate, todayISO } from '../../utils/format'
import { exportJournalPDF } from '../../utils/exportPDF'
import { exportJournalExcel } from '../../utils/exportExcel'
import toast from 'react-hot-toast'
import { v4 as uuidv4 } from 'uuid'

// Tipe jurnal dengan label Bahasa Indonesia
const ENTRY_TYPES = [
  { value: 'MANUAL', label: 'Manual' },
  { value: 'BILLING', label: 'Tagihan Kasir' },
  { value: 'EXPENSE', label: 'Pengeluaran' },
  { value: 'GRN', label: 'Penerimaan Barang' },
  { value: 'STOCK_OUTFLOW', label: 'Pengeluaran Stok' },
  { value: 'OUTFLOW', label: 'Pengeluaran Barang' },
  { value: 'ADJUSTMENT', label: 'Penyesuaian Stok' },
  { value: 'CLOSING', label: 'Penutupan Periode' },
  { value: 'REVERSAL', label: 'Jurnal Pembalik' },
]
const ENTRY_TYPE_LABEL = Object.fromEntries(ENTRY_TYPES.map(t => [t.value, t.label]))

function JournalForm({ initial, onSave, onClose }) {
  const { coa, branches, activeBranchId, generateEntryNumber } = useStore()
  const activeCoa = coa.filter(a => a.isActive && !a.isHeader)

  const accountOptions = useMemo(() =>
    activeCoa
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
      .map(a => ({
        value: a.accountCode,
        label: a.accountName,
        sub: `${a.accountGroup}${a.accountSubgroup ? ' › ' + a.accountSubgroup : ''}`,
        group: a.accountType === 'ASSET' ? '🏦 ASET' :
          a.accountType === 'LIABILITY' ? '💳 LIABILITAS' :
            a.accountType === 'EQUITY' ? '💰 EKUITAS' :
              a.accountType === 'REVENUE' ? '📈 PENDAPATAN' :
                a.accountType === 'EXPENSE' ? '📉 BEBAN' : a.accountType,
      })),
    [activeCoa]
  )

  const [header, setHeader] = useState({
    id: initial?.id || uuidv4(),
    branchId: initial?.branchId || activeBranchId || branches[0]?.id,
    entryNumber: initial?.entryNumber || generateEntryNumber('JU'),
    transactionDate: initial?.transactionDate || todayISO(),
    description: initial?.description || '',
    entryType: initial?.entryType || 'MANUAL',
  })

  const initItems = initial?.items?.length > 0
    ? initial.items
    : [{ id: uuidv4(), accountCode: '', description: '', debit: '', credit: '' },
    { id: uuidv4(), accountCode: '', description: '', debit: '', credit: '' }]

  const [items, setItems] = useState(initItems)

  const totalDebit = items.reduce((s, i) => s + (parseFloat(i.debit) || 0), 0)
  const totalCredit = items.reduce((s, i) => s + (parseFloat(i.credit) || 0), 0)
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0

  const setItem = (id, field, val) =>
    setItems(its => its.map(it => it.id === id ? { ...it, [field]: val } : it))

  const addRow = () => setItems(its => [...its, { id: uuidv4(), accountCode: '', description: '', debit: '', credit: '' }])
  const removeRow = (id) => { if (items.length > 2) setItems(its => its.filter(it => it.id !== id)) }

  const submit = (e) => {
    e.preventDefault()
    if (!header.description.trim()) { toast.error('Keterangan jurnal wajib diisi.'); return }
    const validItems = items.filter(it => it.accountCode && (parseFloat(it.debit) > 0 || parseFloat(it.credit) > 0))
    if (validItems.length < 2) { toast.error('Minimum 2 baris entri jurnal.'); return }
    const td = validItems.reduce((s, i) => s + (parseFloat(i.debit) || 0), 0)
    const tc = validItems.reduce((s, i) => s + (parseFloat(i.credit) || 0), 0)
    if (Math.abs(td - tc) > 0.01) { toast.error(`Jurnal belum balance. Selisih: ${fmtIDR(Math.abs(td - tc))}`); return }
    onSave({ ...header, totalDebit: td, totalCredit: tc }, validItems)
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="form-label">No. Jurnal</label>
          <input className="form-input font-mono text-sm text-slate-700 bg-slate-50" value={header.entryNumber} readOnly />
        </div>
        <div>
          <label className="form-label">Tanggal *</label>
          <input type="date" className="form-input font-mono text-sm text-slate-700" value={header.transactionDate} onChange={e => setHeader(h => ({ ...h, transactionDate: e.target.value }))} required />
        </div>
        <div>
          <label className="form-label">Tipe Jurnal</label>
          <input className="form-input bg-slate-50 font-mono text-sm text-slate-700" value="Manual" readOnly />
        </div>
      </div>
      <div>
        <label className="form-label">Keterangan Jurnal *</label>
        <input className="form-input font-mono text-sm text-slate-700" value={header.description} onChange={e => setHeader(h => ({ ...h, description: e.target.value }))} placeholder="Deskripsi transaksi…" required />
      </div>

      {/* Journal lines */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="form-label mb-0">Baris Jurnal (Double Entry)</label>
          <button type="button" className="btn-ghost text-xs py-1" onClick={addRow}><Plus className="w-3.5 h-3.5" />Tambah Baris</button>
        </div>
        <div className="border border-slate-200 rounded-xl overflow-x-auto">
          <table className="table-base" style={{ minWidth: '900px' }}>
            <thead>
              <tr>
                <th style={{ minWidth: 320 }}>Akun</th>
                <th>Keterangan Baris</th>
                <th style={{ width: 160 }} className="text-right">Debit (Rp)</th>
                <th style={{ width: 160 }} className="text-right">Kredit (Rp)</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => (
                <tr key={it.id}>
                  <td className="relative" style={{ overflow: 'visible' }}>
                    <SearchableSelect
                      value={it.accountCode}
                      onChange={val => setItem(it.id, 'accountCode', val)}
                      options={accountOptions}
                      placeholder="— Pilih Akun —"
                    />
                  </td>
                  <td>
                    <input className="form-input font-mono text-xs py-1 text-slate-700" value={it.description} onChange={e => setItem(it.id, 'description', e.target.value)} placeholder="Keterangan…" />
                  </td>
                  <td>
                    <input type="number" min="0" step="0.01" className="form-input font-mono text-xs py-1 text-right text-slate-700"
                      value={it.debit} onChange={e => { setItem(it.id, 'debit', e.target.value); if (e.target.value) setItem(it.id, 'credit', '') }} />
                  </td>
                  <td>
                    <input type="number" min="0" step="0.01" className="form-input font-mono text-xs py-1 text-right text-slate-700"
                      value={it.credit} onChange={e => { setItem(it.id, 'credit', e.target.value); if (e.target.value) setItem(it.id, 'debit', '') }} />
                  </td>
                  <td>
                    <button type="button" onClick={() => removeRow(it.id)} className="p-1 hover:text-red-500 text-slate-300 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {/* Totals row */}
              <tr className="bg-slate-50 font-semibold">
                <td colSpan={2} className="text-right text-sm pr-4 font-mono text-slate-700">TOTAL</td>
                <td className={`text-right font-mono text-sm ${isBalanced ? 'text-emerald-600' : 'text-red-600'}`}>{fmtIDR(totalDebit)}</td>
                <td className={`text-right font-mono text-sm ${isBalanced ? 'text-emerald-600' : 'text-red-600'}`}>{fmtIDR(totalCredit)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
        {!isBalanced && totalDebit > 0 && (
          <p className="text-xs text-red-600 mt-1.5 font-mono">⚠ Selisih: {fmtIDR(Math.abs(totalDebit - totalCredit))} — Jurnal harus balance sebelum disimpan.</p>
        )}
        {isBalanced && <p className="text-xs text-emerald-600 mt-1.5 font-mono">✓ Jurnal balance.</p>}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn-secondary" onClick={onClose}>Batal</button>
        <button type="submit" className="btn-primary">Simpan Draft</button>
      </div>
    </form>
  )
}

export default function JournalPage() {
  const { journalEntries, journalItems, coa, activeBranchId, saveJournalDraft, postJournalEntry, reverseJournal } = useStore()
  const { logActivity, appSettings } = useAuth()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [reverseReason, setReverseReason] = useState('')

  const filtered = useMemo(() =>
    journalEntries
      .filter(j => activeBranchId ? j.branchId === activeBranchId : true)
      .filter(j => statusFilter === 'ALL' || j.status === statusFilter)
      .filter(j => !dateFrom || j.transactionDate >= dateFrom)
      .filter(j => !dateTo || j.transactionDate <= dateTo)
      .filter(j => !search || j.entryNumber?.toLowerCase().includes(search.toLowerCase()) || j.description?.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => new Date(b.transactionDate) - new Date(a.transactionDate)),
    [journalEntries, activeBranchId, statusFilter, dateFrom, dateTo, search])

  const handleSaveDraft = async (header, items) => {
    await saveJournalDraft(header, items)
    logActivity('SIMPAN_JURNAL', 'Jurnal', `Draft jurnal ${header.entryNumber} disimpan`)
    toast.success(`Jurnal ${header.entryNumber} disimpan sebagai Draft.`)
    setModal(null)
  }

  const handlePost = async (entry) => {
    if (!window.confirm(`Posting jurnal ${entry.entryNumber}? Jurnal yang sudah diposting tidak dapat diedit.`)) return
    const result = await postJournalEntry(entry.id, 'Admin')
    if (result.ok) {
      logActivity('POSTING_JURNAL', 'Jurnal', `Jurnal ${entry.entryNumber} diposting`)
      toast.success(`Jurnal ${entry.entryNumber} berhasil diposting.`)
    } else {
      toast.error(result.error)
    }
  }

  const handleReverse = async () => {
    if (!reverseReason.trim()) { toast.error('Alasan pembalikan wajib diisi.'); return }
    const result = await reverseJournal(selected.id, 'Admin', reverseReason)
    if (result.ok) {
      logActivity('BALIK_JURNAL', 'Jurnal', `Jurnal ${selected.entryNumber} dibalik — ${reverseReason}`)
      toast.success('Jurnal pembalik berhasil dibuat.')
    } else {
      toast.error(result.error)
    }
    setModal(null)
  }

  const viewItems = selected ? journalItems.filter(i => i.journalEntryId === selected.id) : []

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Jurnal Umum</h1>
          <p className="text-sm text-slate-400 mt-0.5">Entri double-entry — semua transaksi keuangan klinik</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => exportJournalExcel(filtered, journalItems, coa, 'Export', appSettings)}>
            <Download className="w-4 h-4" />Excel
          </button>
          <button className="btn-primary" onClick={() => { setSelected(null); setModal('add') }}>
            <Plus className="w-4 h-4" />Jurnal Baru
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card card-body">
        <div className="flex flex-wrap gap-3 items-center">
          <SearchInput value={search} onChange={setSearch} placeholder="Cari no. jurnal atau keterangan…" className="w-64 font-mono text-sm" />
          <select className="form-select w-40 font-mono text-sm text-slate-700" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="ALL">Semua Status</option>
            <option value="DRAFT">Draft</option>
            <option value="POSTED">Diposting</option>
            <option value="REVERSED">Dibalik</option>
          </select>
          <input type="date" className="form-input w-40 font-mono text-sm text-slate-700" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <span className="text-slate-400 text-sm font-mono">s/d</span>
          <input type="date" className="form-input w-40 font-mono text-sm text-slate-700" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          <span className="text-sm text-slate-400 ml-auto font-mono">{filtered.length} entri</span>
        </div>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>No. Jurnal</th><th>Tanggal</th><th>Keterangan</th><th>Tipe</th>
                <th className="text-right">Total Debit</th><th className="text-right">Total Kredit</th>
                <th className="text-center">Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-slate-400 font-mono">Tidak ada jurnal ditemukan</td></tr>
              ) : filtered.map(j => (
                <tr key={j.id}>
                  <td className="font-mono text-xs text-primary-700 font-medium">{j.entryNumber}</td>
                  <td className="text-sm font-mono text-slate-700">{fmtDate(j.transactionDate)}</td>
                  <td className="max-w-[200px] truncate text-sm font-mono text-slate-700">{j.description}</td>
                  <td>
                    <span className="badge badge-gray text-xs font-mono flex items-center gap-1 w-fit">
                      {ENTRY_TYPE_LABEL[j.entryType] || j.entryType}
                      {j.entryType !== 'MANUAL' && j.entryType !== 'REVERSAL' && ' 🔒'}
                    </span>
                  </td>
                  <td className="text-right amount-debit font-mono text-xs text-slate-700">{fmtIDR(j.totalDebit || 0)}</td>
                  <td className="text-right amount-credit font-mono text-xs text-slate-700">{fmtIDR(j.totalCredit || 0)}</td>
                  <td className="text-center"><StatusBadge status={j.status} /></td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button className="btn-ghost p-1.5" onClick={() => { setSelected(j); setModal('view') }} title="Lihat Detail"><Eye className="w-3.5 h-3.5" /></button>
                      {j.status === 'DRAFT' && <button className="btn-ghost p-1.5 text-emerald-600" onClick={() => handlePost(j)} title="Posting"><CheckCircle className="w-3.5 h-3.5" /></button>}
                      {j.status === 'POSTED' && <button className="btn-ghost p-1.5 text-orange-500" onClick={() => { setSelected(j); setReverseReason(''); setModal('reverse') }} title="Balik Jurnal"><RotateCcw className="w-3.5 h-3.5" /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal open={modal === 'add'} onClose={() => setModal(null)} title="Buat Jurnal Baru" size="xl">
        <JournalForm initial={null} onSave={handleSaveDraft} onClose={() => setModal(null)} />
      </Modal>

      {/* View Modal */}
      <Modal open={modal === 'view'} onClose={() => setModal(null)} title={`Detail Jurnal — ${selected?.entryNumber}`} size="lg"
        footer={<>
          <button className="btn-secondary" onClick={() => exportJournalPDF(selected, viewItems, coa, appSettings)}><Printer className="w-4 h-4" />Cetak PDF</button>
          {selected?.status === 'DRAFT' && <button className="btn-success" onClick={() => { handlePost(selected); setModal(null) }}><CheckCircle className="w-4 h-4" />Posting</button>}
        </>}>
        {selected && (
          <div className="space-y-4 font-mono text-slate-700">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div><span className="text-slate-500 font-sans">No. Jurnal:</span> <span className="font-mono font-medium ml-2 text-slate-800">{selected.entryNumber}</span></div>
              <div><span className="text-slate-500 font-sans">Tanggal:</span> <span className="font-mono ml-2 text-slate-800">{fmtDate(selected.transactionDate)}</span></div>
              <div><span className="text-slate-500 font-sans">Tipe:</span> <span className="font-mono ml-2 text-slate-800">{ENTRY_TYPE_LABEL[selected.entryType] || selected.entryType}</span></div>
              <div><span className="text-slate-500 font-sans">Status:</span> <StatusBadge status={selected.status} /></div>
              <div className="col-span-2"><span className="text-slate-500 font-sans">Keterangan:</span> <span className="font-mono ml-2 text-slate-800">{selected.description}</span></div>
            </div>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="table-base">
                <thead><tr><th>Kode</th><th>Nama Akun</th><th>Keterangan</th><th className="text-right">Debit</th><th className="text-right">Kredit</th></tr></thead>
                <tbody>
                  {viewItems.map(it => {
                    const acc = coa.find(a => a.accountCode === it.accountCode)
                    return (
                      <tr key={it.id}>
                        <td className="font-mono text-xs text-slate-700">{it.accountCode}</td>
                        <td className="text-sm font-sans text-slate-800 font-medium">{acc?.accountName || it.accountCode}</td>
                        <td className="text-xs font-mono text-slate-500">{it.description || '—'}</td>
                        <td className="text-right amount-debit font-mono text-sm">{parseFloat(it.debit) > 0 ? fmtIDR(it.debit) : ''}</td>
                        <td className="text-right amount-credit font-mono text-sm">{parseFloat(it.credit) > 0 ? fmtIDR(it.credit) : ''}</td>
                      </tr>
                    )
                  })}
                  <tr className="bg-slate-50 font-semibold">
                    <td colSpan={3} className="text-right text-sm font-mono">TOTAL</td>
                    <td className="text-right font-mono text-sm text-blue-700">{fmtIDR(selected.totalDebit || 0)}</td>
                    <td className="text-right font-mono text-sm text-emerald-700">{fmtIDR(selected.totalCredit || 0)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>

      {/* Reverse Modal */}
      <Modal open={modal === 'reverse'} onClose={() => setModal(null)} title="Buat Jurnal Pembalik"
        footer={<><button className="btn-secondary" onClick={() => setModal(null)}>Batal</button><button className="btn-danger" onClick={handleReverse}><RotateCcw className="w-4 h-4" />Buat Pembalik</button></>}>
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            <strong>Perhatian:</strong> Jurnal pembalik akan membatalkan efek akuntansi dari <em>{selected?.entryNumber}</em>. Tindakan ini tidak dapat dibatalkan.
          </div>
          <div>
            <label className="form-label">Alasan Pembalikan *</label>
            <textarea className="form-textarea" rows={3} value={reverseReason} onChange={e => setReverseReason(e.target.value)} placeholder="Jelaskan alasan pembalikan jurnal…" />
          </div>
        </div>
      </Modal>
    </div>
  )
}
