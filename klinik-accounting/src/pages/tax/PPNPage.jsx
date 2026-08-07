import { useState, useMemo, useEffect } from 'react'
import { Download } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { fmtIDR, fmtDate, fmtPct, monthStart, monthEnd, PPN_RATE } from '../../utils/format'
import { exportPPNReportPDF } from '../../utils/exportPDF'
import * as XLSX from 'xlsx'
import toast from 'react-hot-toast'

export default function PPNPage() {
  const { billings, expenses, branches, activeBranchId, appSettings } = useStore()
  const [dateFrom, setDateFrom] = useState(monthStart())
  const [dateTo, setDateTo] = useState(monthEnd())
  const [branchFilter, setBranchFilter] = useState(activeBranchId || 'ALL')

  const effectiveBillings = billings || []
  const effectiveExpenses = expenses || []

  const periodBillings = useMemo(() =>
    effectiveBillings.filter(b =>
      b.status === 'PAID' &&
      b.visitDate >= dateFrom && b.visitDate <= dateTo &&
      (branchFilter === 'ALL' || b.branchId === branchFilter)
    ),
    [effectiveBillings, dateFrom, dateTo, branchFilter])

  // PPN Keluaran (Output Tax) — from pharmacy sales
  const ppnKeluaran = useMemo(() =>
    periodBillings.reduce((s, b) => s + (b.ppnAmount || 0), 0),
    [periodBillings])

  // DPP Penjualan Obat
  const dppFarmasi = useMemo(() =>
    periodBillings.reduce((s, b) => s + (b.subtotalPharmacy || 0), 0),
    [periodBillings])

  // PPN Masukan (Input Tax) — from expense PPN
  const periodExpenses = useMemo(() =>
    effectiveExpenses.filter(e =>
      e.status === 'POSTED' &&
      e.expenseDate >= dateFrom && e.expenseDate <= dateTo &&
      (branchFilter === 'ALL' || e.branchId === branchFilter)
    ),
    [effectiveExpenses, dateFrom, dateTo, branchFilter])

  const ppnMasukan = useMemo(() =>
    periodExpenses.reduce((s, e) => s + (e.ppnAmount || 0), 0),
    [periodExpenses])

  // PPN Kurang/Lebih Bayar
  const ppnTerutang = ppnKeluaran - ppnMasukan
  const periodLabel = `${fmtDate(dateFrom)} s/d ${fmtDate(dateTo)}`
  const activeBranchObj = branches.find(b => b.id === branchFilter)
  const branchName = branchFilter === 'ALL' ? 'Semua Cabang' : (activeBranchObj?.entityName || 'Cabang Utama')

  const handleDownloadReport = () => {
    try {
      exportPPNReportPDF({
        periodBillings,
        periodExpenses,
        dppFarmasi,
        ppnKeluaran,
        ppnMasukan,
        ppnTerutang,
        periodLabel,
        branchName,
        appSettings
      })
      toast.success('Laporan PPN (PDF) berhasil diunduh.')
    } catch (err) {
      console.error('[PPNPage] Download error:', err)
      toast.error('Gagal mengunduh laporan PPN.')
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Laporan PPN</h1>
          <p className="text-sm text-slate-400 mt-0.5">Pajak Pertambahan Nilai 11% — UU HPP No. 7/2021</p>
        </div>
        <button
          className="btn-danger-red flex items-center gap-2"
          onClick={handleDownloadReport}
        >
          <Download className="w-4 h-4" />Unduh Laporan
        </button>
      </div>

      {/* Filter Section */}
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

      {/* Ketentuan PPN */}
      <div className="card card-body bg-blue-50 border-blue-200 border text-sm text-blue-800">
        <p className="font-semibold mb-1">Ketentuan PPN Klinik Medis (UU HPP 2021 & PMK):</p>
        <ul className="list-disc list-inside space-y-0.5 text-xs">
          <li><strong>Dibebaskan PPN:</strong> Jasa Kesehatan Medis (konsultasi, tindakan, rawat inap sesuai PMK 71/2022)</li>
          <li><strong>Dikenakan PPN 11%:</strong> Penjualan Obat-obatan dan Alat Kesehatan kepada konsumen akhir</li>
          <li>Klinik PKP wajib memungut PPN atas penjualan obat dan menyetorkan ke DJP paling lambat tanggal 15 bulan berikutnya</li>
          <li>PPN Masukan atas pembelian barang/jasa (dengan faktur pajak) dapat dikreditkan</li>
        </ul>
      </div>

      {/* Summary Cards — Vibrant Solid Colors */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-sans">
        <div className="rounded-xl p-4 shadow-sm" style={{ background: '#059669' }}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-100 font-sans">PPN Keluaran (Output)</p>
          <p className="text-xs text-emerald-200 mt-0.5">DPP Farmasi: {fmtIDR(dppFarmasi)}</p>
          <p className="font-extrabold text-2xl text-white tracking-tight font-sans mt-2">{fmtIDR(ppnKeluaran)}</p>
        </div>
        <div className="rounded-xl p-4 shadow-sm" style={{ background: '#2563EB' }}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-blue-100 font-sans">PPN Masukan (Input)</p>
          <p className="text-xs text-blue-200 mt-0.5">{periodExpenses.length} faktur pembelian</p>
          <p className="font-extrabold text-2xl text-white tracking-tight font-sans mt-2">{fmtIDR(ppnMasukan)}</p>
        </div>
        <div className="rounded-xl p-4 shadow-sm" style={{ background: ppnTerutang >= 0 ? '#DC2626' : '#0D9488' }}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-white/90 font-sans">{ppnTerutang >= 0 ? 'PPN Kurang Bayar (Setor)' : 'PPN Lebih Bayar (Kredit)'}</p>
          <p className="text-xs text-white/80 mt-0.5">{ppnTerutang >= 0 ? '⚠ Wajib disetorkan ke DJP' : 'Dapat dikreditkan'}</p>
          <p className="font-extrabold text-2xl text-white tracking-tight font-sans mt-2">{fmtIDR(Math.abs(ppnTerutang))}</p>
        </div>
      </div>

      {/* Tables Section */}
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
                  : periodBillings.filter(b => (b.ppnAmount || 0) > 0).map(b => (
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
                {periodExpenses.filter(e => (e.ppnAmount || 0) > 0).length === 0
                  ? <tr><td colSpan={4} className="text-center py-6 text-slate-400">Belum ada faktur masukan</td></tr>
                  : periodExpenses.filter(e => (e.ppnAmount || 0) > 0).map(e => (
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
                  <td className="text-right font-mono text-sm">{fmtIDR(periodExpenses.reduce((s, e) => s + (e.grossAmount || 0), 0))}</td>
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
