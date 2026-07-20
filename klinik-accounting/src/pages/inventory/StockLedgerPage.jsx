import { useState, useMemo } from 'react'
import { AlertTriangle, RotateCcw, Download, Search } from 'lucide-react'
import { useStore } from '../../store/useStore'
import Modal from '../../components/ui/Modal'
import SearchableSelect from '../../components/ui/SearchableSelect'
import { fmtIDR, fmtDate, fmtDateTime } from '../../utils/format'
import { exportStockExcel } from '../../utils/exportExcel'
import toast from 'react-hot-toast'
import { v4 as uuidv4 } from 'uuid'

const TRANS_LABELS = {
  SALDO_AWAL: 'Saldo Awal',
  GRN: 'Penerimaan (GRN)',
  BILLING: 'Penjualan Pasien',
  PATIENT_SALE: 'Penjualan Pasien',
  ADJUSTMENT: 'Penyesuaian',
  EXPIRED: 'Kadaluarsa/Rusak',
  DAMAGED: 'Rusak',
  TRANSFER_IN: 'Masuk Transfer',
  TRANSFER_OUT: 'Keluar Transfer',
  RETURN: 'Retur',
}
const TRANS_COLORS = {
  SALDO_AWAL: 'badge-purple',
  GRN: 'badge-green',
  BILLING: 'badge-blue',
  PATIENT_SALE: 'badge-blue',
  ADJUSTMENT: 'badge-yellow',
  EXPIRED: 'badge-red',
  DAMAGED: 'badge-red',
  TRANSFER_IN: 'badge-teal',
  TRANSFER_OUT: 'badge-orange',
}

export default function StockLedgerPage() {
  const {
    pharmacyItems, invBatches, stockLedger,
    adjustStock, saveJournalDraft, postJournalEntry,
    activeBranchId, generateEntryNumber,
  } = useStore()

  const [selectedItem, setSelectedItem] = useState('')
  const [adjustModal, setAdjustModal] = useState(false)
  const [adjBatch, setAdjBatch] = useState(null)
  const [adjReason, setAdjReason] = useState('')
  const [adjType, setAdjType] = useState('REMOVE')
  const [adjQty, setAdjQty] = useState('')
  const [recapSearch, setRecapSearch] = useState('')

  const selectOptions = useMemo(() => {
    const list = pharmacyItems
      .sort((a, b) => a.itemName.localeCompare(b.itemName))
      .map(i => {
        const qty = invBatches
          .filter(b => b.itemId === i.id && b.quantityCurrent > 0)
          .reduce((s, b) => s + b.quantityCurrent, 0)
        return {
          value: i.id,
          label: i.itemName,
          sub: `${i.skuCode} — Stok: ${qty} ${i.baseUnit}`,
          group: 'Item Farmasi'
        }
      })
    return [
      {
        value: 'ALL_ITEMS',
        label: 'Semua Item (Laporan Rekapitulasi)',
        sub: 'Tampilkan rekap seluruh saldo awal & mutasi',
        group: 'Global'
      },
      ...list
    ]
  }, [pharmacyItems, invBatches])

  const recapData = useMemo(() => {
    return pharmacyItems.map(item => {
      const itemLedger = stockLedger.filter(l => l.itemId === item.id)

      const saldoAwal = itemLedger
        .filter(l => l.transactionType === 'SALDO_AWAL')
        .reduce((sum, l) => sum + l.quantityIn, 0)

      const penerimaan = itemLedger
        .filter(l => l.transactionType !== 'SALDO_AWAL')
        .reduce((sum, l) => sum + l.quantityIn, 0)

      const pengeluaran = itemLedger
        .reduce((sum, l) => sum + l.quantityOut, 0)

      const saldoAkhir = saldoAwal + penerimaan - pengeluaran

      return {
        ...item,
        saldoAwal,
        penerimaan,
        pengeluaran,
        saldoAkhir
      }
    })
  }, [pharmacyItems, stockLedger])

  const filteredRecap = useMemo(() => {
    if (!recapSearch.trim()) return recapData
    const q = recapSearch.toLowerCase()
    return recapData.filter(
      r =>
        r.itemName.toLowerCase().includes(q) ||
        (r.skuCode || '').toLowerCase().includes(q) ||
        (r.itemCode || '').toLowerCase().includes(q)
    )
  }, [recapData, recapSearch])

  const item = useMemo(
    () => pharmacyItems.find(i => i.id === selectedItem),
    [pharmacyItems, selectedItem],
  )

  const itemBatches = useMemo(
    () => invBatches
      .filter(b => b.itemId === selectedItem)
      .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate)),
    [invBatches, selectedItem],
  )

  const ledgerLines = useMemo(
    () => stockLedger
      .filter(l => l.itemId === selectedItem)
      .sort((a, b) => new Date(b.loggedAt) - new Date(a.loggedAt)),
    [stockLedger, selectedItem],
  )

  const totalStock = itemBatches.reduce((s, b) => s + (b.quantityCurrent || 0), 0)

  const isExpiringSoon = (expiryDate) =>
    Math.ceil((new Date(expiryDate) - new Date()) / 86400000) <= 180

  // ── Open adjustment modal ─────────────────────────────────
  const openAdjust = (batch) => {
    setAdjBatch(batch)
    setAdjType('REMOVE')
    setAdjReason('')
    setAdjQty('')
    setAdjustModal(true)
  }

  // ── Execute stock adjustment ──────────────────────────────
  const handleAdjust = async () => {
    if (!adjReason.trim()) { toast.error('Alasan penyesuaian wajib diisi.'); return }
    if (adjType !== 'REMOVE' && (!adjQty || parseInt(adjQty) <= 0)) {
      toast.error('Jumlah penyesuaian harus lebih dari 0.')
      return
    }

    const batch = adjBatch
    const lostValue = adjType === 'REMOVE'
      ? batch.quantityCurrent * batch.unitCostPrice
      : Math.abs(parseInt(adjQty)) * batch.unitCostPrice

    await adjustStock(
      batch.id,
      batch.itemId,
      adjType === 'ADD' ? parseInt(adjQty) : -batch.quantityCurrent,
      adjReason,
      adjType,
    )

    // Auto journal for expired / damaged write-off
    if (adjType === 'REMOVE' && lostValue > 0) {
      const entryId = uuidv4()
      const entryNumber = generateEntryNumber('ADJ')
      const it = pharmacyItems.find(p => p.id === batch.itemId)

      const header = {
        id: entryId,
        branchId: activeBranchId,
        entryNumber,
        transactionDate: new Date().toISOString().split('T')[0],
        description: `Penghapusan Stok Expired/Rusak — ${it?.itemName} Batch ${batch.batchNumber}: ${adjReason}`,
        entryType: 'ADJUSTMENT',
        totalDebit: lostValue,
        totalCredit: lostValue,
      }
      const jItems = [
        {
          id: uuidv4(),
          journalEntryId: entryId,
          accountCode: '6-17-001',
          description: `Kerugian stok ${it?.itemName}`,
          debit: lostValue,
          credit: 0,
        },
        {
          id: uuidv4(),
          journalEntryId: entryId,
          accountCode: it?.coaInventoryCode || '1-13-001',
          description: `Hapus stok ${it?.itemName} batch ${batch.batchNumber}`,
          debit: 0,
          credit: lostValue,
        },
      ]
      await saveJournalDraft(header, jItems)
      await postJournalEntry(entryId, 'System-ADJ')
    }

    toast.success('Penyesuaian stok berhasil dicatat. Jurnal otomatis dibuat.')
    setAdjustModal(false)
  }

  // ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Kartu Stok</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Riwayat mutasi persediaan per item dan batch (Metode FIFO)
          </p>
        </div>
        <button
          className="btn-secondary"
          onClick={() => exportStockExcel(pharmacyItems, invBatches)}
        >
          <Download className="w-4 h-4" />Export Excel
        </button>
      </div>

      {/* Item picker */}
      <div className="card card-body">
        <label className="form-label mb-1.5">Pilih Item</label>
        <SearchableSelect
          options={selectOptions}
          value={selectedItem}
          onChange={val => setSelectedItem(val)}
          placeholder="— Cari & Pilih Item untuk melihat kartu stok —"
          className="max-w-lg"
        />
      </div>

      {/* No item selected */}
      {!selectedItem && (
        <div className="card card-body text-center py-16 text-slate-400">
          <p>Pilih item di atas untuk melihat kartu stok dan detail batch</p>
        </div>
      )}

      {/* All Items Recap */}
      {selectedItem === 'ALL_ITEMS' && (
        <div className="space-y-4">
          {/* Search Input at Top */}
          <div className="card card-body">
            <div className="flex items-center gap-3">
              <Search className="w-5 h-5 text-slate-400 flex-shrink-0" />
              <input
                type="text"
                className="form-input flex-1"
                placeholder="Ketik kata kunci untuk mencari item (nama, kode, SKU)..."
                value={recapSearch}
                onChange={e => setRecapSearch(e.target.value)}
                autoFocus
              />
              {recapSearch && (
                <button
                  className="btn-secondary text-sm"
                  onClick={() => setRecapSearch('')}
                >
                  Clear
                </button>
              )}
            </div>
            {recapSearch && (
              <p className="text-xs text-slate-500 mt-2">
                Menampilkan {filteredRecap.length} dari {recapData.length} item
              </p>
            )}
          </div>

          <div className="card card-body">
            <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
              <div>
                <h3 className="text-base font-semibold text-slate-700">Rekapitulasi Mutasi Seluruh Item</h3>
                <p className="text-xs text-slate-400">Menampilkan rekapitulasi Saldo Awal, Penerimaan, Pengeluaran, dan Saldo Akhir per item</p>
              </div>
              <div className="text-sm text-slate-500">
                Total: <strong>{filteredRecap.length}</strong> item
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Kode / SKU</th>
                    <th>Nama Item</th>
                    <th>Satuan</th>
                    <th className="text-right">Saldo Awal</th>
                    <th className="text-right">Penerimaan (+)</th>
                    <th className="text-right">Pengeluaran (-)</th>
                    <th className="text-right">Saldo Akhir</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecap.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-400">Tidak ada data rekapitulasi</td>
                    </tr>
                  ) : (
                    filteredRecap.map(r => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="font-mono text-xs text-slate-500">{r.itemCode || r.skuCode || '—'}</td>
                        <td>
                          <button
                            className="text-left font-semibold text-primary-600 hover:text-primary-800 hover:underline"
                            onClick={() => setSelectedItem(r.id)}
                          >
                            {r.itemName}
                          </button>
                        </td>
                        <td className="text-slate-500 text-sm">{r.baseUnit}</td>
                        <td className="text-right font-mono text-sm text-slate-600">{r.saldoAwal}</td>
                        <td className="text-right font-mono text-sm text-emerald-700 font-medium">+{r.penerimaan}</td>
                        <td className="text-right font-mono text-sm text-red-600 font-medium">-{r.pengeluaran}</td>
                        <td className="text-right font-mono text-sm font-bold text-slate-900">{r.saldoAkhir}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Item content */}
      {selectedItem && selectedItem !== 'ALL_ITEMS' && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card card-body bg-blue-50 border-0">
              <p className="text-xs text-slate-500 mb-1">Total Stok Tersedia</p>
              <p className="font-bold text-2xl text-blue-700">{totalStock}</p>
              <p className="text-xs text-slate-400">{item?.baseUnit}</p>
            </div>
            <div className="card card-body bg-emerald-50 border-0">
              <p className="text-xs text-slate-500 mb-1">Jumlah Batch Aktif</p>
              <p className="font-bold text-2xl text-emerald-700">
                {itemBatches.filter(b => b.quantityCurrent > 0).length}
              </p>
            </div>
            <div className="card card-body bg-amber-50 border-0">
              <p className="text-xs text-slate-500 mb-1">Batch Hampir Kadaluarsa</p>
              <p className="font-bold text-2xl text-amber-700">
                {itemBatches.filter(b => b.quantityCurrent > 0 && isExpiringSoon(b.expiryDate)).length}
              </p>
            </div>
            <div className="card card-body bg-slate-50 border-0">
              <p className="text-xs text-slate-500 mb-1">Nilai Stok (HPP)</p>
              <p className="font-bold text-lg text-slate-700">
                {fmtIDR(itemBatches.reduce((s, b) => s + b.quantityCurrent * b.unitCostPrice, 0))}
              </p>
            </div>
          </div>

          {/* Batch detail */}
          <div className="card">
            <div className="card-header">
              <span className="section-title">Detail Batch (Urutan FIFO)</span>
              <span className="text-xs text-slate-400">
                Deplesi dimulai dari batch paling awal kadaluarsa
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>No. Batch</th>
                    <th>Tgl Kadaluarsa</th>
                    <th>Supplier</th>
                    <th className="text-right">HPP/Unit</th>
                    <th className="text-right">Diterima</th>
                    <th className="text-right">Sisa Stok</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {itemBatches.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-8 text-slate-400">
                        Belum ada batch untuk item ini
                      </td>
                    </tr>
                  ) : itemBatches.map((b, i) => {
                    const days = Math.ceil((new Date(b.expiryDate) - new Date()) / 86400000)
                    const isExpired = days <= 0
                    const isNearExpiry = days > 0 && days <= 180
                    return (
                      <tr
                        key={b.id}
                        className={isExpired ? 'bg-red-50' : isNearExpiry ? 'bg-amber-50' : ''}
                      >
                        <td className="text-xs text-slate-400">{i + 1}</td>
                        <td className="font-mono text-xs">{b.batchNumber}</td>
                        <td>
                          <div className="text-sm">{fmtDate(b.expiryDate)}</div>
                          {isExpired && (
                            <div className="text-xs text-red-600 font-medium">Sudah Kadaluarsa</div>
                          )}
                          {isNearExpiry && (
                            <div className="text-xs text-amber-600">
                              <AlertTriangle className="w-3 h-3 inline mr-0.5" />
                              {days} hari lagi
                            </div>
                          )}
                        </td>
                        <td className="text-xs text-slate-500">{b.supplierName || '—'}</td>
                        <td className="text-right font-mono text-sm">{fmtIDR(b.unitCostPrice)}</td>
                        <td className="text-right font-mono text-sm">{b.quantityReceived}</td>
                        <td className="text-right font-bold text-sm">{b.quantityCurrent}</td>
                        <td>
                          <span className={`badge text-xs ${isExpired ? 'badge-red' :
                            isNearExpiry ? 'badge-yellow' :
                              b.quantityCurrent === 0 ? 'badge-gray' :
                                'badge-green'
                            }`}>
                            {isExpired ? 'Kadaluarsa' :
                              isNearExpiry ? 'Hampir ED' :
                                b.quantityCurrent === 0 ? 'Habis' : 'Aktif'}
                          </span>
                        </td>
                        <td>
                          {b.quantityCurrent > 0 && (
                            <button
                              className="btn-ghost text-xs py-1 px-2 text-red-600"
                              onClick={() => openAdjust(b)}
                            >
                              <RotateCcw className="w-3.5 h-3.5 mr-1" />Hapus
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mutation history */}
          <div className="card">
            <div className="card-header">
              <span className="section-title">Riwayat Mutasi Stok</span>
              <span className="text-xs text-slate-400">{ledgerLines.length} catatan</span>
            </div>
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Waktu</th>
                    <th>Tipe Transaksi</th>
                    <th>No. Referensi</th>
                    <th className="text-right">Masuk</th>
                    <th className="text-right">Keluar</th>
                    <th className="text-right">Saldo</th>
                    <th className="text-right">Nilai (Rp)</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerLines.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-400">
                        Belum ada mutasi stok
                      </td>
                    </tr>
                  ) : ledgerLines.map(l => (
                    <tr key={l.id}>
                      <td className="text-xs">{fmtDateTime(l.loggedAt)}</td>
                      <td>
                        <span className={`badge text-xs ${TRANS_COLORS[l.transactionType] || 'badge-gray'}`}>
                          {TRANS_LABELS[l.transactionType] || l.transactionType}
                        </span>
                      </td>
                      <td className="font-mono text-xs text-primary-700">
                        {l.referenceNumber || '—'}
                      </td>
                      <td className="text-right font-mono text-sm text-emerald-700">
                        {l.quantityIn > 0 ? `+${l.quantityIn}` : ''}
                      </td>
                      <td className="text-right font-mono text-sm text-red-600">
                        {l.quantityOut > 0 ? `-${l.quantityOut}` : ''}
                      </td>
                      <td className="text-right font-mono text-sm font-bold">
                        {l.balanceAfter}
                      </td>
                      <td className="text-right font-mono text-xs text-slate-600">
                        {l.totalValue > 0 ? fmtIDR(l.totalValue) : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Adjustment Modal */}
      <Modal
        open={adjustModal}
        onClose={() => setAdjustModal(false)}
        title="Penyesuaian Stok"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setAdjustModal(false)}>
              Batal
            </button>
            <button className="btn-danger" onClick={handleAdjust}>
              <RotateCcw className="w-4 h-4" />Proses Penyesuaian
            </button>
          </>
        }
      >
        {adjBatch && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm">
              <p className="font-semibold text-amber-800">Batch: {adjBatch.batchNumber}</p>
              <p className="text-amber-700 mt-1">
                Stok saat ini: <strong>{adjBatch.quantityCurrent}</strong> unit —
                HPP: {fmtIDR(adjBatch.unitCostPrice)}/unit
              </p>
              <p className="text-amber-700">
                Nilai potensi hapus:{' '}
                <strong>{fmtIDR(adjBatch.quantityCurrent * adjBatch.unitCostPrice)}</strong>
              </p>
            </div>

            <div>
              <label className="form-label">Tipe Penyesuaian *</label>
              <select
                className="form-select"
                value={adjType}
                onChange={e => setAdjType(e.target.value)}
              >
                <option value="REMOVE">
                  Hapus Seluruh Batch (Kadaluarsa/Rusak) — Catat Kerugian Stok
                </option>
                <option value="ADD">Tambah Stok (Koreksi Stok Opname)</option>
                <option value="REDUCE">Kurangi Stok (Koreksi Stok Opname)</option>
              </select>
            </div>

            {adjType !== 'REMOVE' && (
              <div>
                <label className="form-label">Jumlah Unit *</label>
                <input
                  type="number"
                  className="form-input"
                  value={adjQty}
                  onChange={e => setAdjQty(e.target.value)}
                  min={1}
                  placeholder="Masukkan jumlah unit…"
                />
              </div>
            )}

            <div>
              <label className="form-label">Alasan Penyesuaian *</label>
              <textarea
                className="form-textarea"
                rows={3}
                value={adjReason}
                onChange={e => setAdjReason(e.target.value)}
                placeholder="Jelaskan alasan penyesuaian stok secara detail…"
              />
            </div>

            {adjType === 'REMOVE' && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700">
                <strong>Jurnal otomatis yang akan dibuat:</strong>
                <br />
                Debit 6-17-001 Kerugian Stok Expired/Rusak → Kredit Akun Persediaan
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
