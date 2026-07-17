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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Penerimaan Barang (GRN)</h1>
        <p className="text-sm text-slate-400 mt-0.5">Goods Receipt Note — Penerimaan obat & alat medis dari PBF/supplier</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* GRN Form */}
        <div className="lg:col-span-2 space-y-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Header */}
            <div className="card card-body">
              <h3 className="section-title mb-4">Informasi GRN</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">No. GRN</label>
                  <input className="form-input font-mono bg-slate-50" value={grnNumber} readOnly />
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
                <span className="section-title">Detail Item Diterima</span>
                <button type="button" className="btn-secondary py-1.5 text-xs" onClick={addLine}><Plus className="w-3.5 h-3.5" />Tambah Baris</button>
              </div>
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th style={{ minWidth: 250 }}>Item</th>
                      <th style={{ width: 130 }}>No. Batch</th>
                      <th style={{ width: 140 }}>Tgl Kadaluarsa</th>
                      <th style={{ width: 130 }} className="text-right">HPP/Unit (Rp)</th>
                      <th style={{ width: 100 }} className="text-right">Qty</th>
                      <th style={{ width: 140 }} className="text-right">Sub-Total</th>
                      <th style={{ width: 36 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map(l => {
                      const warn = getExpiryWarning(l.expiryDate)
                      const subTotal = (parseFloat(l.unitCostPrice) || 0) * (parseInt(l.quantityReceived) || 0)
                      return (
                        <tr key={l.id}>
                          <td>
                            <SearchableSelect
                              value={l.itemId}
                              onChange={val => setLine(l.id, 'itemId', val)}
                              options={itemOptions}
                              placeholder="— Pilih Item —"
                            />
                          </td>
                          <td>
                            <input className="form-input text-xs py-1" value={l.batchNumber} onChange={e => setLine(l.id, 'batchNumber', e.target.value)} placeholder="Batch no." />
                          </td>
                          <td>
                            <div>
                              <input type="date" className={`form-input text-xs py-1 ${warn?.level === 'error' ? 'border-red-400' : warn?.level === 'warning' ? 'border-amber-400' : ''}`}
                                value={l.expiryDate} onChange={e => setLine(l.id, 'expiryDate', e.target.value)} />
                              {warn && <p className={`text-xs mt-0.5 ${warn.level === 'error' ? 'text-red-600' : 'text-amber-600'}`}><AlertTriangle className="w-3 h-3 inline mr-0.5" />{warn.msg}</p>}
                            </div>
                          </td>
                          <td>
                            <input type="number" className="form-input text-xs py-1 text-right" value={l.unitCostPrice} onChange={e => setLine(l.id, 'unitCostPrice', e.target.value)} placeholder="0" min={0} step={1} />
                          </td>
                          <td>
                            <input type="number" className="form-input text-xs py-1 text-right" value={l.quantityReceived} onChange={e => setLine(l.id, 'quantityReceived', e.target.value)} placeholder="0" min={1} />
                          </td>
                          <td className="text-right font-mono text-xs font-medium">{subTotal > 0 ? fmtIDR(subTotal) : '—'}</td>
                          <td>
                            <button type="button" onClick={() => removeLine(l.id)} className="p-1 hover:text-red-500 text-slate-300 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 font-semibold">
                      <td colSpan={5} className="text-right pr-4 text-sm">TOTAL NILAI GRN</td>
                      <td className="text-right font-mono text-sm text-slate-800">{fmtIDR(totalValue)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div className="card-body border-t border-slate-100 bg-blue-50">
                <p className="text-xs text-blue-700">
                  ℹ Jurnal otomatis akan dibuat: <strong>Debit Persediaan</strong> (sesuai kategori item) / <strong>Kredit Utang PBF 2-11-001</strong> — Total {fmtIDR(totalValue)}
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <button type="submit" disabled={submitting} className="btn-success px-6">
                <CheckCircle className="w-4 h-4" />
                {submitting ? 'Memproses…' : 'Proses & Posting GRN'}
              </button>
            </div>
          </form>
        </div>

        {/* GRN History sidebar */}
        <div className="card">
          <div className="card-header"><span className="section-title">Riwayat GRN</span></div>
          <div className="overflow-y-auto max-h-[600px]">
            {grnHistory.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">Belum ada GRN</div>
            ) : grnHistory.map(g => (
              <div key={g.grnReference} className="px-4 py-3 border-b border-slate-100 hover:bg-slate-50">
                <p className="font-mono text-xs text-primary-700 font-medium">{g.grnReference}</p>
                <p className="text-xs text-slate-500 mt-0.5">{fmtDate(g.receivedAt)}</p>
                <p className="text-xs text-slate-600 mt-1">{g.batches.length} batch — {g.batches[0]?.supplierName || '—'}</p>
                <p className="text-xs font-mono font-medium text-slate-800 mt-1">
                  {fmtIDR(g.batches.reduce((s, b) => s + (b.unitCostPrice * b.quantityReceived), 0))}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
