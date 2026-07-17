import { useState, useMemo } from 'react'
import { Download } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { fmtIDR, fmtDate, fmtPct, monthStart, monthEnd, calcPPh21Doctor } from '../../utils/format'
import * as XLSX from 'xlsx'
import toast from 'react-hot-toast'

export default function PPh21Page() {
  const { billings, activeBranchId, branches } = useStore()
  const [dateFrom, setDateFrom] = useState(monthStart())
  const [dateTo,   setDateTo]   = useState(monthEnd())
  const [branchFilter, setBranchFilter] = useState(activeBranchId || 'ALL')

  // Aggregate doctor fees from billing
  const doctorData = useMemo(() => {
    const filtered = billings.filter(b =>
      b.status === 'PAID' &&
      b.doctorName &&
      b.visitDate >= dateFrom &&
      b.visitDate <= dateTo &&
      (branchFilter === 'ALL' || b.branchId === branchFilter)
    )
    const doctors = {}
    filtered.forEach(b => {
      const d = b.doctorName
      if (!doctors[d]) doctors[d] = { doctorName: d, transactions: [], totalGrossJasa: 0 }
      const feeRate = 0.30 // default 30%
      const grossJasa = (b.subtotalServices || 0) * feeRate
      doctors[d].transactions.push({ billingNumber: b.billingNumber, visitDate: b.visitDate, grandTotal: b.grandTotal, grossJasa })
      doctors[d].totalGrossJasa += grossJasa
    })
    return Object.values(doctors).map(d => {
      const calc = calcPPh21Doctor(d.totalGrossJasa, 0)
      return { ...d, ...calc }
    })
  }, [billings, dateFrom, dateTo, branchFilter])

  const totalGross = doctorData.reduce((s, d) => s + d.grossAmount, 0)
  const totalPPh21 = doctorData.reduce((s, d) => s + d.pph21Amount, 0)
  const totalNet   = doctorData.reduce((s, d) => s + d.netToDoctor, 0)

  const exportXLSX = () => {
    const rows = doctorData.map(d => ({
      'Nama Dokter':         d.doctorName,
      'Jasa Medis Bruto':    Number(d.grossAmount.toFixed(2)),
      'DPP (50%)':           Number(d.dpp.toFixed(2)),
      'Tarif PPh 21 (%)':    Number((d.rate * 100).toFixed(2)),
      'PPh 21 Dipotong':     Number(d.pph21Amount.toFixed(2)),
      'Neto ke Dokter':      Number(d.netToDoctor.toFixed(2)),
      'Jumlah Transaksi':    d.transactions.length,
    }))
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, 'PPh21 Dokter')
    XLSX.writeFile(wb, `PPh21_Dokter_${dateFrom}_${dateTo}.xlsx`)
    toast.success('File Excel berhasil diunduh.')
  }

  const periodLabel = `${fmtDate(dateFrom)} s/d ${fmtDate(dateTo)}`

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Laporan PPh 21 Jasa Medis Dokter</h1>
          <p className="text-sm text-slate-400 mt-0.5">Sesuai PER-2/PJ/2024 — Bukan Pegawai Berkesinambungan</p>
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

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card card-body bg-blue-50 border-0">
          <p className="text-xs text-slate-500 mb-1">Total Jasa Medis Bruto</p>
          <p className="font-bold text-xl text-blue-700">{fmtIDR(totalGross)}</p>
        </div>
        <div className="card card-body bg-red-50 border-0">
          <p className="text-xs text-slate-500 mb-1">Total PPh 21 Dipotong</p>
          <p className="font-bold text-xl text-red-700">{fmtIDR(totalPPh21)}</p>
        </div>
        <div className="card card-body bg-emerald-50 border-0">
          <p className="text-xs text-slate-500 mb-1">Total Neto ke Dokter</p>
          <p className="font-bold text-xl text-emerald-700">{fmtIDR(totalNet)}</p>
        </div>
      </div>

      {/* PPh21 basis info */}
      <div className="card card-body bg-amber-50 border-amber-200 border text-sm text-amber-800">
        <p className="font-semibold mb-1">Dasar Hukum Perhitungan PPh 21 Dokter (PER-2/PJ/2024):</p>
        <ul className="list-disc list-inside space-y-0.5 text-xs">
          <li>DPP = 50% dari Penghasilan Bruto Jasa Medis</li>
          <li>Tarif Progresif Pasal 17: 5% (s/d Rp 60 jt) · 15% (Rp 60–250 jt) · 25% (Rp 250–500 jt) · 30% (diatas Rp 500 jt)</li>
          <li>Akumulasi DPP dihitung per tahun kalender (YTD basis)</li>
          <li>Jurnal: Dr 6-12-001 Beban Jasa Medis | Cr 2-13-001 Utang PPh 21 | Cr 2-12-001 Utang Jasa Medis Bersih</li>
        </ul>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="section-title">Rekap PPh 21 per Dokter</span>
          <span className="text-xs text-slate-400">{periodLabel}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Nama Dokter</th>
                <th className="text-right">Jasa Medis Bruto</th>
                <th className="text-right">DPP (50%)</th>
                <th className="text-right">Tarif PPh 21</th>
                <th className="text-right">PPh 21 Dipotong</th>
                <th className="text-right">Neto ke Dokter</th>
                <th className="text-right">Jml Transaksi</th>
              </tr>
            </thead>
            <tbody>
              {doctorData.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-400">
                  Belum ada data jasa medis dokter pada periode ini
                </td></tr>
              ) : doctorData.map(d => (
                <tr key={d.doctorName}>
                  <td className="font-medium">{d.doctorName}</td>
                  <td className="text-right font-mono text-sm">{fmtIDR(d.grossAmount)}</td>
                  <td className="text-right font-mono text-sm">{fmtIDR(d.dpp)}</td>
                  <td className="text-right"><span className="badge badge-yellow">{fmtPct(d.rate * 100)}</span></td>
                  <td className="text-right font-mono text-sm text-red-600 font-bold">{fmtIDR(d.pph21Amount)}</td>
                  <td className="text-right font-mono text-sm text-emerald-700">{fmtIDR(d.netToDoctor)}</td>
                  <td className="text-right text-sm">{d.transactions.length}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 font-bold">
                <td>TOTAL</td>
                <td className="text-right font-mono amount-debit">{fmtIDR(totalGross)}</td>
                <td className="text-right font-mono">{fmtIDR(doctorData.reduce((s,d) => s+d.dpp,0))}</td>
                <td />
                <td className="text-right font-mono text-red-700">{fmtIDR(totalPPh21)}</td>
                <td className="text-right font-mono text-emerald-700">{fmtIDR(totalNet)}</td>
                <td className="text-right">{doctorData.reduce((s,d)=>s+d.transactions.length,0)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}
