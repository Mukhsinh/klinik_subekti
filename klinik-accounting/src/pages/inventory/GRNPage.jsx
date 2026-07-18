import { useState, useMemo } from 'react'
import { Plus, Trash2, CheckCircle, AlertTriangle } from 'lucide-react'
import { useStore } from '../../store/useStore'
import SearchableSelect from '../../components/ui/SearchableSelect'
import { fmtIDR, fmtDate, todayISO, daysBetween } from '../../utils/format'
import toast from 'react-hot-toast'
import { v4 as uuidv4 } from 'uuid'

function generateGRN(count) {
  const d = new Date()
  return `GRN/${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}/${String(count + 1).padStart(5, '0')}`
}

export default function GRNPage() {
  const { pharmacyItems, invBatches, receiveGRN, coa, activeBranchId, saveJournalDraft, postJournalEntry, generateEntryNumber } = useStore()

  const [grnNumber] = useState(() => generateGRN(invBatches.length))
  const [grnDate, setGrnDate] = useState(todayISO())
  const [supplierName, setSupplierName] = useState('')
  const [invoiceRef, setInvoiceRef] = useState('')
  const [lines, setLines] = useState([{ id: uuidv4(), itemId: '', batchNumber: '', expiryDate: '', unitCostPrice: '', quantityReceived: '', notes: '' }])
  const [submitting, setSubmitting] = useState(false)

  const itemOptions = useMemo(() =>
    pharmacyItems
      .filter(i => i.isActive)
      .sort((a, b) => a.itemName.localeCompare(b.itemName))
      .map(i => ({ value: i.id, label: `${i.skuCode} — ${i.itemName}` })),
    [pharmacyItems]
  )

  // History
  const grnHistory = useMemo(() => {
    const grns = {}
    invBatches.forEach(b => {
      if (!grns[b.grnReference]) grns[b.grnReference] = { grnReference: b.grnReference, receivedAt: b.receivedAt, batches: [] }
      grns[b.grnReference].batches.push(b)
    })
    return Object.values(grns).sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt))
  }, [invBatches])

  const addLine = () => setLines(ls => [...ls, { id: uuidv4(), itemId: '', batchNumber: '', expiryDate: '', unitCostPrice: '', quantityReceived: '', notes: '' }])
  const removeLine = (id) => { if (lines.length > 1) setLines(ls => ls.filter(l => l.id !== id)) }
  const setLine = (id, field, val) => setLines(ls => ls.map(l => l.id === id ? { ...l, [field]: val } : l))

  const totalValue = lines.reduce((s, l) => s + (parseFloat(l.unitCostPrice) || 0) * (parseInt(l.quantityReceived) || 0), 0)

  // Expiry warnings
  const getExpiryWarning = (expiryDate) => {
    if (!expiryDate) return null
    const days = daysBetween(new Date(), new Date(expiryDate))
    if (days <= 0) return { level: 'error', msg: 'Sudah kadaluarsa!' }
    if (days <= 180) return { level: 'warning', msg: `Kadaluarsa dalam ${days} hari` }
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const validLines = lines.filter(l => l.itemId && l.batchNumber && l.expiryDate && parseFloat(l.unitCostPrice) > 0 && parseInt(l.quantityReceived) > 0)
    if (validLines.length === 0) { toast.error('Minimal 1 baris GRN valid harus diisi.'); return }

    // Check expiry
    for (const l of validLines) {
      if (new Date(l.expiryDate) <= new Date()) {
        toast.error(`Batch ${l.batchNumber}: Tanggal kadaluarsa sudah lewat. GRN ditolak.`)
        return
      }
    }

    setSubmitting(true)
    try {
      const batchesData = validLines.map(l => {
        const item = pharmacyItems.find(i => i.id === l.itemId)
        return {
          itemId: l.itemId,
          batchNumber: l.batchNumber,
          expiryDate: l.expiryDate,
          unitCostPrice: parseFloat(l.unitCostPrice),
          quantityReceived: parseInt(l.quantityReceived),
          quantityCurrent: parseInt(l.quantityReceived),
          grnReference: grnNumber,
          supplierName,
        }
      })

      // Auto journal entry for GRN
      // Dr: Persediaan Obat (per item)
      // Cr: Utang PBF / Kas
      const entryId = uuidv4()
      const entryNumber = generateEntryNumber('GRN')
      const journalLines = []
      validLines.forEach(l => {
        const item = pharmacyItems.find(i => i.id === l.itemId)
        const val = parseFloat(l.unitCostPrice) * parseInt(l.quantityReceived)
        journalLines.push({ id: uuidv4(), accountCode: item.coaInventoryCode, description: `GRN ${grnNumber} — ${item.itemName}`, debit: val, credit: 0 })
      })
      journalLines.push({ id: uuidv4(), accountCode: '2-11-001', description: `Utang PBF — ${supplierName || 'Supplier'}`, debit: 0, credit: totalValue })

      const header = {
        id: entryId, branchId: activeBranchId, entryNumber,
        transactionDate: grnDate, description: `Penerimaan Barang (GRN) ${grnNumber} — ${supplierName}`,
        entryType: 'GRN', totalDebit: totalValue, totalCredit: totalValue,
      }

      receiveGRN({ grnNumber, supplierName, invoiceRef, grnDate }, batchesData)
      saveJournalDraft(header, journalLines)
      postJournalEntry(entryId, 'System-GRN')

      toast.success(`GRN ${grnNumber} berhasil diproses. Stok dan jurnal otomatis dicatat.`)
      setLines([{ id: uuidv4(), itemId: '', batchNumber: '', expiryDate: '', unitCostPrice: '', quantityReceived: '', notes: '' }])
    } finally {
      setSubmitting(false)
    }
  }

  // Summary stats
  const totalItems = lines.filter(l => l.itemId).length
  const totalQty = lines.reduce((s, l) => s + (parseInt(l.quantityReceived) || 0), 0)

  return (
    <div className="space-y-6">
      {/* ── Page Header ───────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Penerimaan Barang (GRN)</h1>
          <p className="text-sm text-slate-400 mt-0.5">Goods Receipt Note — Penerimaan obat & alat medis dari PBF/supplier</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200">
            <span className="text-xs text-emerald-600 font-medium">{grnHistory.length} GRN tercatat</span>
          </div>
        </div>
      </div>

      {/* ── Summary Cards ─────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card card-body bg-gradient-to-br from-blue-50 to-indigo-50 border-0">
          <p className="text-xs text-slate-500 mb-1 font-medium">Item Terisi</p>
          <p className="font-bold text-2xl text-indigo-700">{totalItems} <span className="text-sm font-normal text-slate-400">item</span></p>
        </div>
        <div className="card card-body bg-gradient-to-br from-emerald-50 to-teal-50 border-0">
          <p className="text-xs text-slate-500 mb-1 font-medium">Total Kuantitas</p>
          <p className="font-bold text-2xl text-emerald-700">{totalQty} <span className="text-sm font-normal text-slate-400">unit</span></p>
        </div>
        <div className="card card-body bg-gradient-to-br from-amber-50 to-orange-50 border-0">
          <p className="text-xs text-slate-500 mb-1 font-medium">Total Nilai GRN</p>
          <p className="font-bold text-xl text-amber-700">{fmtIDR(totalValue)}</p>
        </div>
      </div>

      {/* ── GRN Form (Full Width) ──────────────────────────── */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Header Info */}
        <div className="card card-body">
          <h3 className="section-title mb-4 flex items-center gap-2">
            <span className="w-1.5 h-5 rounded-full bg-primary-500 inline-block"></span>
            Informasi GRN
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="form-label">No. GRN</label>
              <input className="form-input font-mono bg-slate-50 text-primary-700 font-semibold" value={grnNumber} readOnly />
            </div>
            <div>
              <label className="form-label">Tanggal Penerimaan</label>
              <input type="date" className="form-input" value={grnDate} onChange={e => setGrnDate(e.target.value)} required />
            </div>
            <div>
              <label className="form-label">Nama Supplier / PBF</label>
              <input className="form-input" value={supplierName} onChange={e => setSupplierName(e.target.value)} placeholder="Nama PBF atau distributor…" />
            </div>
            <div>
              <label className="form-label">No. Invoice Supplier</label>
              <input className="form-input" value={invoiceRef} onChange={e => setInvoiceRef(e.target.value)} placeholder="No. faktur pembelian…" />
            </div>
          </div>
        </div>

        {/* Line items */}
        <div className="card">
          <div className="card-header">
            <span className="section-title flex items-center gap-2">
              <span className="w-1.5 h-5 rounded-full bg-emerald-500 inline-block"></span>
              Detail Item Diterima
            </span>
            <button type="button" className="btn-secondary py-1.5 text-xs" onClick={addLine}><Plus className="w-3.5 h-3.5" />Tambah Baris</button>
          </div>
          <div className="overflow-x-auto">
            <table className="table-base" style={{ minWidth: 960 }}>
              <thead>
                <tr>
                  <th style={{ width: '30%', minWidth: 240 }}>Item Farmasi / Medis</th>
                  <th style={{ width: '12%', minWidth: 110 }}>No. Batch</th>
                  <th style={{ width: '14%', minWidth: 130 }}>Tgl Kadaluarsa</th>
                  <th style={{ width: '14%', minWidth: 120 }} className="text-right">HPP / Unit (Rp)</th>
                  <th style={{ width: '9%', minWidth: 80 }} className="text-right">Qty</th>
                  <th style={{ width: '16%', minWidth: 130 }} className="text-right">Sub-Total (Rp)</th>
                  <th style={{ width: '5%', minWidth: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, idx) => {
                  const warn = getExpiryWarning(l.expiryDate)
                  const subTotal = (parseFloat(l.unitCostPrice) || 0) * (parseInt(l.quantityReceived) || 0)
                  return (
                    <tr key={l.id} className="group">
                      <td className="py-2.5">
                        <SearchableSelect
                          value={l.itemId}
                          onChange={val => setLine(l.id, 'itemId', val)}
                          options={itemOptions}
                          placeholder="— Pilih Item —"
                          hideValue={true}
                          searchPlaceholder="Ketik nama obat..."
                        />
                      </td>
                      <td className="py-2.5">
                        <input className="form-input text-xs py-2" value={l.batchNumber} onChange={e => setLine(l.id, 'batchNumber', e.target.value)} placeholder="BTH-001" />
                      </td>
                      <td className="py-2.5">
                        <div>
                          <input type="date" className={`form-input text-xs py-2 ${warn?.level === 'error' ? 'border-red-400 bg-red-50' : warn?.level === 'warning' ? 'border-amber-400 bg-amber-50' : ''}`}
                            value={l.expiryDate} onChange={e => setLine(l.id, 'expiryDate', e.target.value)} />
                          {warn && <p className={`text-[10px] mt-0.5 flex items-center gap-0.5 ${warn.level === 'error' ? 'text-red-600' : 'text-amber-600'}`}><AlertTriangle className="w-3 h-3 flex-shrink-0" />{warn.msg}</p>}
                        </div>
                      </td>
                      <td className="py-2.5">
                        <input type="number" className="form-input text-xs py-2 text-right font-mono" value={l.unitCostPrice} onChange={e => setLine(l.id, 'unitCostPrice', e.target.value)} placeholder="0" min={0} step={1} />
                      </td>
                      <td className="py-2.5">
                        <input type="number" className="form-input text-xs py-2 text-right font-mono font-semibold" value={l.quantityReceived} onChange={e => setLine(l.id, 'quantityReceived', e.target.value)} placeholder="0" min={1} />
                      </td>
                      <td className="text-right font-mono text-sm font-semibold py-2.5">
                        {subTotal > 0 ? (
                          <span className="text-slate-800">{fmtIDR(subTotal)}</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="py-2.5 text-center">
                        <button type="button" onClick={() => removeLine(l.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 hover:text-red-500 text-slate-300 transition-all opacity-50 group-hover:opacity-100"
                          title="Hapus baris">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gradient-to-r from-slate-50 to-slate-100 font-semibold border-t-2 border-slate-200">
                  <td colSpan={5} className="text-right pr-4 text-sm py-3">TOTAL NILAI GRN</td>
                  <td className="text-right font-mono text-sm text-slate-800 py-3">{fmtIDR(totalValue)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Journal info banner */}
          <div className="px-5 py-3 border-t border-slate-100 bg-gradient-to-r from-blue-50 to-indigo-50">
            <p className="text-xs text-blue-700 flex items-start gap-1.5">
              <span className="text-blue-500 mt-0.5 flex-shrink-0">ℹ</span>
              <span>
                Jurnal otomatis akan dibuat: <strong>Debit Persediaan</strong> (sesuai kategori item) / <strong>Kredit Utang PBF 2-11-001</strong> — Total <strong>{fmtIDR(totalValue)}</strong>
              </span>
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" className="btn-secondary px-5" onClick={() => {
            setLines([{ id: uuidv4(), itemId: '', batchNumber: '', expiryDate: '', unitCostPrice: '', quantityReceived: '', notes: '' }])
            setSupplierName(''); setInvoiceRef('')
          }}>
            Reset Form
          </button>
          <button type="submit" disabled={submitting} className="btn-success px-6 shadow-lg shadow-emerald-200/50">
            <CheckCircle className="w-4 h-4" />
            {submitting ? 'Memproses…' : 'Proses & Posting GRN'}
          </button>
        </div>
      </form>

      {/* ── GRN History (Full Width Below) ────────────────── */}
      <div className="card">
        <div className="card-header bg-gradient-to-r from-slate-50 to-slate-100">
          <span className="section-title">Riwayat Penerimaan Barang (GRN)</span>
          <span className="text-sm text-slate-400">{grnHistory.length} transaksi tercatat</span>
        </div>
        <div className="overflow-x-auto">
          {grnHistory.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Belum ada riwayat penerimaan barang</p>
            </div>
          ) : (
            <table className="table-base">
              <thead>
                <tr>
                  <th style={{ width: '15%' }}>No. GRN</th>
                  <th style={{ width: '12%' }}>Tanggal</th>
                  <th style={{ width: '25%' }}>Supplier / PBF</th>
                  <th style={{ width: '10%' }} className="text-center">Jumlah Batch</th>
                  <th style={{ width: '10%' }} className="text-right">Total Qty</th>
                  <th style={{ width: '18%' }} className="text-right">Total Nilai</th>
                  <th style={{ width: '10%' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {grnHistory.map(g => {
                  const grnTotalVal = g.batches.reduce((s, b) => s + (b.unitCostPrice * b.quantityReceived), 0)
                  const grnTotalQty = g.batches.reduce((s, b) => s + b.quantityReceived, 0)
                  const hasExpiringSoon = g.batches.some(b => {
                    const days = daysBetween(new Date(), new Date(b.expiryDate))
                    return days > 0 && days <= 180
                  })
                  return (
                    <tr key={g.grnReference} className="hover:bg-blue-50/30 transition-colors">
                      <td>
                        <span className="font-mono text-xs text-primary-700 font-semibold">{g.grnReference}</span>
                      </td>
                      <td className="text-sm text-slate-600">{fmtDate(g.receivedAt)}</td>
                      <td className="text-sm font-medium text-slate-800">{g.batches[0]?.supplierName || '—'}</td>
                      <td className="text-center">
                        <span className="badge badge-blue text-xs">{g.batches.length} batch</span>
                      </td>
                      <td className="text-right font-mono text-sm font-semibold text-slate-700">{grnTotalQty}</td>
                      <td className="text-right font-mono text-sm font-bold text-slate-800">{fmtIDR(grnTotalVal)}</td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          <span className="badge badge-green text-xs">Diterima</span>
                          {hasExpiringSoon && <span className="badge badge-yellow text-xs">⚠ ED &lt;6bln</span>}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
