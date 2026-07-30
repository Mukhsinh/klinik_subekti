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
  const { pharmacyItems, invBatches, receiveGRN, coa, activeBranchId, saveJournalDraft, postJournalEntry, generateEntryNumber, vendors } = useStore()

  const [grnNumber] = useState(() => generateGRN(invBatches.length))
  const [grnDate, setGrnDate] = useState(todayISO())
  const [invoiceDate, setInvoiceDate] = useState(todayISO())
  const [supplierName, setSupplierName] = useState('')
  const [invoiceRef, setInvoiceRef] = useState('')
  const [ppnType, setPpnType] = useState('NONE') // NONE | INCLUDE | EXCLUDE
  const [ppnRate] = useState(0.11)
  const [lines, setLines] = useState([{ id: uuidv4(), itemId: '', batchNumber: '', expiryDate: '', unitCostPrice: '', sellingPrice: '', quantityReceived: '', notes: '' }])
  const [submitting, setSubmitting] = useState(false)

  const vendorOptions = useMemo(() =>
    (vendors || [])
      .filter(v => v.isActive !== false)
      .map(v => ({ value: v.name, label: `${v.code} — ${v.name}` })),
    [vendors]
  )

  const itemOptions = useMemo(() =>
    pharmacyItems
      .filter(i => i.isActive)
      .sort((a, b) => a.itemName.localeCompare(b.itemName))
      .map(i => ({ value: i.id, label: `${i.itemCode} — ${i.itemName}` })),
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

  const addLine = () => setLines(ls => [...ls, { id: uuidv4(), itemId: '', batchNumber: '', expiryDate: '', unitCostPrice: '', sellingPrice: '', quantityReceived: '', notes: '' }])
  const removeLine = (id) => { if (lines.length > 1) setLines(ls => ls.filter(l => l.id !== id)) }
  const setLine = (id, field, val, batch = {}) => setLines(ls => ls.map(l => {
    if (l.id !== id) return l
    const updated = { ...l, [field]: val, ...batch }
    if (field === 'unitCostPrice') {
      const hpp = parseFloat(val) || 0
      const currentSP = parseFloat(l.sellingPrice) || 0
      const prevAuto = Math.round((parseFloat(l.unitCostPrice) || 0) * 1.25)
      if (currentSP === 0 || currentSP === prevAuto) {
        updated.sellingPrice = Math.round(hpp * 1.25)
      }
    }
    return updated
  }))

  const rawSubtotal = lines.reduce((s, l) => s + (parseFloat(l.unitCostPrice) || 0) * (parseFloat(l.quantityReceived) || 0), 0)

  let netInventoryValue = rawSubtotal
  let ppnAmount = 0
  if (ppnType === 'EXCLUDE') {
    ppnAmount = rawSubtotal * ppnRate
  } else if (ppnType === 'INCLUDE') {
    netInventoryValue = rawSubtotal / (1 + ppnRate)
    ppnAmount = rawSubtotal - netInventoryValue
  }
  const totalValue = netInventoryValue + ppnAmount

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
    const validLines = lines.filter(l => l.itemId && l.batchNumber && l.expiryDate && parseFloat(l.unitCostPrice) > 0 && parseFloat(l.quantityReceived) > 0)
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
      const entryId = uuidv4()

      const batchesData = validLines.map(l => {
        const item = pharmacyItems.find(i => i.id === l.itemId)
        const rawHpp = parseFloat(l.unitCostPrice) || 0
        const qty = parseFloat(l.quantityReceived) || 0
        // Effective unit cost adjusted for PPN if INCLUDE
        const effectiveHpp = ppnType === 'INCLUDE' ? rawHpp / (1 + ppnRate) : rawHpp
        const sp = parseFloat(l.sellingPrice) || Math.round(rawHpp * 1.25)
        return {
          itemId: l.itemId,
          batchNumber: l.batchNumber,
          expiryDate: l.expiryDate,
          unitCostPrice: effectiveHpp,
          sellingPrice: sp,
          quantityReceived: qty,
          quantityCurrent: qty,
          grnReference: grnNumber,
          supplierName,
          journalEntryId: entryId,
        }
      })

      const entryNumber = generateEntryNumber('GRN')
      const journalLines = []
      validLines.forEach(l => {
        const item = pharmacyItems.find(i => i.id === l.itemId)
        const rawHpp = parseFloat(l.unitCostPrice) || 0
        const qty = parseFloat(l.quantityReceived) || 0
        const invVal = ppnType === 'INCLUDE' ? (rawHpp * qty) / (1 + ppnRate) : (rawHpp * qty)
        journalLines.push({ id: uuidv4(), journalEntryId: entryId, accountCode: item?.coaInventoryCode || '1-13-001', description: `GRN ${grnNumber} — ${item?.itemName || 'Obat'}`, debit: invVal, credit: 0 })
      })

      if (ppnAmount > 0) {
        journalLines.push({ id: uuidv4(), journalEntryId: entryId, accountCode: '1-14-002', description: `PPN Masukan (Input PPN 11%) — ${grnNumber}`, debit: ppnAmount, credit: 0 })
      }

      journalLines.push({ id: uuidv4(), journalEntryId: entryId, accountCode: '2-11-001', description: `Utang Usaha / PBF — ${supplierName || 'Supplier'} (Faktur: ${invoiceRef || '-'})`, debit: 0, credit: totalValue })

      const header = {
        id: entryId, branchId: activeBranchId, entryNumber,
        transactionDate: grnDate, description: `Penerimaan Barang (GRN) ${grnNumber} — ${supplierName} (Faktur ${invoiceRef || '-'} tgl ${invoiceDate})`,
        entryType: 'GRN', totalDebit: totalValue, totalCredit: totalValue,
      }

      await saveJournalDraft(header, journalLines)
      await receiveGRN({ grnNumber, supplierName, invoiceRef, grnDate, invoiceDate, totalValue, apStatus: 'UNPAID' }, batchesData)
      await postJournalEntry(entryId, 'System-GRN')

      // Update selling price on items table based on latest batch
      for (const bd of batchesData) {
        const { supabase: sb } = await import('../../lib/supabase')
        await sb.from('pharmacy_items').update({ selling_price: bd.sellingPrice, updated_at: new Date().toISOString() }).eq('id', bd.itemId)
      }

      toast.success(`GRN ${grnNumber} berhasil diproses & diposting ke Jurnal Umum!`)
      setLines([{ id: uuidv4(), itemId: '', batchNumber: '', expiryDate: '', unitCostPrice: '', sellingPrice: '', quantityReceived: '', notes: '' }])
      setInvoiceRef('')
    } catch (err) {
      console.error('[GRN Submit Error]', err)
      toast.error(`Gagal menyimpan GRN: ${err.message || 'Terjadi kesalahan'}`)
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
        <div className="card card-body bg-blue-600 text-white border-0">
          <p className="text-xs text-blue-100 mb-1 font-medium">Item Terisi</p>
          <p className="font-bold text-2xl">{totalItems} <span className="text-sm font-normal text-blue-200">item</span></p>
        </div>
        <div className="card card-body bg-emerald-600 text-white border-0">
          <p className="text-xs text-emerald-100 mb-1 font-medium">Total Kuantitas</p>
          <p className="font-bold text-2xl">{totalQty} <span className="text-sm font-normal text-emerald-200">unit</span></p>
        </div>
        <div className="card card-body bg-amber-500 text-white border-0">
          <p className="text-xs text-amber-100 mb-1 font-medium">Total Nilai GRN (Utang PBF)</p>
          <p className="font-bold text-xl">{fmtIDR(totalValue)}</p>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
            <div>
              <label className="form-label">No. GRN</label>
              <input className="form-input font-mono bg-slate-50 text-primary-700 font-semibold" value={grnNumber} readOnly />
            </div>
            <div>
              <label className="form-label">Tanggal Penerimaan *</label>
              <input type="date" className="form-input text-xs" value={grnDate} onChange={e => setGrnDate(e.target.value)} required />
            </div>
            <div>
              <label className="form-label">Tanggal Faktur Supplier</label>
              <input type="date" className="form-input text-xs" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
            </div>
            <div>
              <label className="form-label">Nama Supplier / PBF *</label>
              <SearchableSelect
                value={supplierName}
                onChange={val => setSupplierName(val)}
                options={vendorOptions}
                placeholder="— Pilih Vendor / PBF —"
              />
            </div>
            <div>
              <label className="form-label">No. Invoice / Faktur</label>
              <input className="form-input text-xs" value={invoiceRef} onChange={e => setInvoiceRef(e.target.value)} placeholder="No. faktur pembelian…" />
            </div>
            <div>
              <label className="form-label">Perlakuan PPN (11%)</label>
              <select className="form-select text-xs font-semibold" value={ppnType} onChange={e => setPpnType(e.target.value)}>
                <option value="NONE">Tanpa PPN (Non-PKP)</option>
                <option value="EXCLUDE">Exclude PPN 11% (Ditambah)</option>
                <option value="INCLUDE">Include PPN 11% (Sudah Termasuk)</option>
              </select>
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
          <div className="w-full">
            <table className="w-full text-left border-collapse table-auto">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  <th className="py-2.5 px-2" style={{ minWidth: '200px' }}>Item Farmasi / Medis</th>
                  <th className="py-2.5 px-2" style={{ width: '110px' }}>No. Batch</th>
                  <th className="py-2.5 px-2" style={{ width: '120px' }}>Tgl Kadaluarsa</th>
                  <th className="py-2.5 px-2 text-right" style={{ width: '130px' }}>HPP / Unit (Rp)</th>
                  <th className="py-2.5 px-2 text-right" style={{ width: '130px' }}>Harga Jual (Rp)</th>
                  <th className="py-2.5 px-2 text-right" style={{ width: '90px' }}>Qty</th>
                  <th className="py-2.5 px-2 text-right" style={{ width: '130px' }}>Sub-Total (Rp)</th>
                  <th style={{ width: '40px' }} className="py-2.5 px-1 text-center"></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, idx) => {
                  const warn = getExpiryWarning(l.expiryDate)
                  const hpp = parseFloat(l.unitCostPrice) || 0
                  const subTotal = hpp * (parseInt(l.quantityReceived) || 0)
                  return (
                    <tr key={l.id} className="group">
                      <td className="py-2.5">
                        <SearchableSelect
                          value={l.itemId}
                          onChange={val => setLine(l.id, 'itemId', val)}
                          options={itemOptions}
                          placeholder="— Pilih Item —"
                          hideValue={true}
                          searchPlaceholder="Ketik kode/nama..."
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
                        <input type="number" className="form-input text-xs py-2 text-right font-mono" value={l.unitCostPrice}
                          onChange={e => setLine(l.id, 'unitCostPrice', e.target.value)}
                          placeholder="0" min={0} step={1} />
                      </td>
                      <td className="py-2.5">
                        <div>
                          <input type="number" className="form-input text-xs py-2 text-right font-mono text-amber-700 font-bold" value={l.sellingPrice}
                            onChange={e => setLine(l.id, 'sellingPrice', e.target.value)}
                            placeholder={l.unitCostPrice ? Math.round(parseFloat(l.unitCostPrice) * 1.25) : '0'} min={0} step={1} />
                          {l.unitCostPrice && !l.sellingPrice && (
                            <p className="text-[9px] text-amber-600 mt-0.5">Default: {fmtIDR(Math.round(parseFloat(l.unitCostPrice) * 1.25))}</p>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5">
                        <input type="number" className="form-input text-xs py-2 text-right font-mono font-bold text-blue-700" value={l.quantityReceived}
                          onChange={e => setLine(l.id, 'quantityReceived', e.target.value)}
                          placeholder="0 unit" min={1} style={{ minWidth: 90 }} />
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
                <tr className="bg-slate-800 text-white font-semibold border-t-2 border-slate-600">
                  <td colSpan={6} className="text-right pr-4 text-sm py-3">TOTAL NILAI GRN (Utang PBF)</td>
                  <td className="text-right font-mono text-sm py-3">{fmtIDR(totalValue)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Journal info banner */}
          <div className="px-5 py-3 border-t border-slate-100 bg-emerald-600">
            <p className="text-xs text-white flex items-start gap-1.5">
              <span className="mt-0.5 flex-shrink-0">ℹ</span>
              <span>
                Jurnal otomatis: <strong>Dr Persediaan</strong> / <strong>Cr Utang PBF 2-11-001</strong> — Total <strong>{fmtIDR(totalValue)}</strong> | Status AP: <strong>UNPAID</strong> → dapat dilunasi melalui Pengeluaran
              </span>
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" className="btn-secondary px-5" onClick={() => {
            setLines([{ id: uuidv4(), itemId: '', batchNumber: '', expiryDate: '', unitCostPrice: '', sellingPrice: '', quantityReceived: '', notes: '' }])
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
