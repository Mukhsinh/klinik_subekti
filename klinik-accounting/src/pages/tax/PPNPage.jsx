import { useState, useMemo } from 'react'
import { Download } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { fmtIDR, fmtDate, fmtPct, monthStart, monthEnd, PPN_RATE } from '../../utils/format'
import * as XLSX from 'xlsx'
import toast from 'react-hot-toast'

export default function PPNPage() {
  const { billings, expenses, journalItems, journalEntries, branches, activeBranchId } = useStore()
  const [dateFrom, setDateFrom] = useState(monthStart())
  const [dateTo,   setDateTo]   = useState(monthEnd())
  const [branchFilter, setBranchFilter] = useState(activeBranchId || 'ALL')

  const periodBillings = useMemo(() =>
    billings.filter(b =>
      b.status === 'PAID' &&
      b.visitDate >= dateFrom && b.visitDate <= dateTo &&
      (branchFilter === 'ALL' || b.branchId === branchFilter)
    ),
  [billings, dateFrom, dateTo, branchFilter])

  // PPN Keluaran (Output Tax) — from pharmacy sales
  const ppnKeluaran = useMemo(() =>
    periodBillings.reduce((s, b) => s + (b.ppnAmount || 0), 0),
  [periodBillings])

  // DPP Penjualan Obat
  const dppFarmasi = useMemo(() =>
    periodBillings.reduce((s, b) => s + (b.subtotalPharmacy || 0), 0),
  [periodBillings])

  // PPN Masukan (Input Tax) — from expense PPN
  const periodExpenses = expenses.filter(e =>
    e.status === 'POSTED' &&
    e.expenseDate >= dateFrom && e.expenseDate <= dateTo &&
    (branchFilter === 'ALL' || e.branchId === branchFilter)
  )
  const ppnMasukan = periodExpenses.reduce((s, e) => s + (e.ppnAmount || 0), 0)

  // PPN Kurang/Lebih Bayar
  const ppnTerutang = ppnKeluaran - ppnMasukan

  const exportXLSX = () => {
    const outRows = periodBillings.map(b => ({
      'No. Billing':      b.billingNumber,
      'Tanggal':          fmtDate(b.visitDate),
      'DPP Farmasi':      Number(b.subtotalPharmacy || 0),
      'PPN Keluaran 11%': Number(b.ppnAmount || 0),
    }))
    const wb = XLSX.utils.book_new()
    const ws1 = XLSX.utils.json_to_sheet(outRows)
    XLSX.utils.book_append_sheet(wb, ws1, 'PPN Keluaran')

    const inRows = periodExpenses.map(e => ({
      'No. Pengeluaran': e.expenseNumber,
      'Tanggal':         fmtDate(e.expenseDate),
      'Keterangan':      e.description,
      'Vendor':          e.vendorName || '—',
      'DPP':             Number(e.grossAmount || 0),
      'PPN Masukan':     Number(e.ppnAmount || 0),
    }))
    const ws2 = XLSX.utils.json_to_sheet(inRows)
    XLSX.utils.book_append_sheet(wb, ws2, 'PPN Masukan')

    XLSX.writeFile(wb, `LaporanPPN_${dateFrom}_${dateTo}.xlsx`)
    toast.success('File Excel berhasil diunduh.')
  }

  const periodLabel = `${fmtDate(dateFrom)} s/d ${fmtDate(dateTo)}`

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Laporan PPN</h1>
          <p className="text-sm text-slate-400 mt-0.5">Pajak Pertambahan Nilai 11% — UU HPP No. 7/2021</p>
        </div>
        <button className="btn-secondary" onClick={exportXLSX}><Download className="w-4 h-4" />Export Excel</button>
      </div>

      <div className="card card-body">
        <div className="flex flex-wrap gap-4 items-end">
          <div><label className="form-label">Dari Tanggal</label><input type="date" className="form-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></div>
          <div><label className="form-label">Sampai Tanggal</label><input type="date" className="form-input" value={dateTo} onChange={e => setDateTo(e.target.value)} /></div>
          <div>
            <label className="form-label">Cabang</label>
            <select className="form-select" value={branchFilter} onChange={e => setBranchFilter(e.target.value)}>
              <option value="ALL">Semua Cabang</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.entityName}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="card card-body bg-blue-50 border-blue-200 border text-sm text-blue-800">
        <p className="font-semibold mb-1">Ketentuan PPN Klinik Medis (UU HPP 2021 & PMK):</p>
        <ul className="list-disc list-inside space-y-0.5 text-xs">
          <li><strong>Dibebaskan PPN:</strong> Jasa Kesehatan Medis (konsultasi, tindakan, rawat inap sesuai PMK 71/2022)</li>
          <li><strong>Dikenakan PPN 11%:</strong> Penjualan Obat-obatan dan Alat Kesehatan kepada konsumen akhir</li>
          <li>Klinik PKP wajib memungut PPN atas penjualan obat dan menyetorkan ke DJP paling lambat tanggal 15 bulan berikutnya</li>
          <li>PPN Masukan atas pembelian barang/jasa (dengan faktur pajak) dapat dikreditkan</li>
        </ul>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card card-body bg-emerald-50 border-0">
          <p className="text-xs text-slate-500 mb-1">PPN Keluaran (Output)</p>
          <p className="text-xs text-slate-400">DPP Farmasi {fmtIDR(dppFarmasi)}</p>
          <p className="font-bold text-xl text-emerald-700 mt-1">{fmtIDR(ppnKeluaran)}</p>
        </div>
        <div className="card card-body bg-blue-50 border-0">
          <p className="text-xs text-slate-500 mb-1">PPN Masukan (Input)</p>
          <p className="text-xs text-slate-400">{periodExpenses.length} faktur pembelian</p>
          <p className="font-bold text-xl text-blue-700 mt-1">{fmtIDR(ppnMasukan)}</p>
        </div>
        <div className={`card card-body border-0 ${ppnTerutang >= 0 ? 'bg-red-50' : 'bg-teal-50'}`}>
          <p className="text-xs text-slate-500 mb-1">{ppnTerutang >= 0 ? 'PPN Kurang Bayar (Setor)' : 'PPN Lebih Bayar (Kredit)'}</p>
          <p className={`font-bold text-xl ${ppnTerutang >= 0 ? 'text-red-700' : 'text-teal-700'}`}>{fmtIDR(Math.abs(ppnTerutang))}</p>
          {ppnTerutang >= 0 && <p className="text-xs text-red-600 mt-1">⚠ Wajib disetorkan ke DJP</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* PPN Keluaran */}
        <div className="card">
          <div className="card-header">
            <span className="section-title">PPN Keluaran — Penjualan Obat</span>
            <span className="text-xs text-slate-400">{periodBillings.length} faktur</span>
          </div>
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="table-base">
              <thead className="sticky top-0 z-10">
                <tr><th>No. Billing</th><th>Tanggal</th><th className="text-right">DPP</th><th className="text-right">PPN 11%</th></tr>
              </thead>
              <tbody>
                {periodBillings.filter(b => (b.ppnAmount || 0) > 0).length === 0
                  ? <tr><td colSpan={4} className="text-center py-6 text-slate-400">Belum ada data</td></tr>
                  : periodBillings.filter(b => (b.ppnAmount||0) > 0).map(b => (
                  <tr key={b.id}>
                    <td className="font-mono text-xs text-primary-700">{b.billingNumber}</td>
                    <td className="text-xs">{fmtDate(b.visitDate)}</td>
                    <td className="text-right font-mono text-xs">{fmtIDR(b.subtotalPharmacy)}</td>
                    <td className="text-right font-mono text-xs font-bold text-emerald-700">{fmtIDR(b.ppnAmount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-semibold">
                  <td colSpan={2}>TOTAL</td>
                  <td className="text-right font-mono text-sm">{fmtIDR(dppFarmasi)}</td>
                  <td className="text-right font-mono text-sm text-emerald-700">{fmtIDR(ppnKeluaran)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* PPN Masukan */}
        <div className="card">
          <div className="card-header">
            <span className="section-title">PPN Masukan — Pembelian</span>
            <span className="text-xs text-slate-400">{periodExpenses.length} faktur</span>
          </div>
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="table-base">
              <thead className="sticky top-0 z-10">
                <tr><th>No. Exp</th><th>Vendor</th><th className="text-right">DPP</th><th className="text-right">PPN</th></tr>
              </thead>
              <tbody>
                {periodExpenses.filter(e => (e.ppnAmount||0) > 0).length === 0
                  ? <tr><td colSpan={4} className="text-center py-6 text-slate-400">Belum ada faktur masukan</td></tr>
                  : periodExpenses.filter(e => (e.ppnAmount||0) > 0).map(e => (
                  <tr key={e.id}>
                    <td className="font-mono text-xs text-primary-700">{e.expenseNumber}</td>
                    <td className="text-xs truncate max-w-[120px]">{e.vendorName || '—'}</td>
                    <td className="text-right font-mono text-xs">{fmtIDR(e.grossAmount)}</td>
                    <td className="text-right font-mono text-xs font-bold text-blue-700">{fmtIDR(e.ppnAmount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-semibold">
                  <td colSpan={2}>TOTAL</td>
                  <td className="text-right font-mono text-sm">{fmtIDR(periodExpenses.reduce((s,e)=>s+(e.grossAmount||0),0))}</td>
                  <td className="text-right font-mono text-sm text-blue-700">{fmtIDR(ppnMasukan)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
