import { useState, useMemo, useEffect } from 'react'
import { Download, Filter, UserCheck } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { fetchDoctors, fetchBillings } from '../../lib/db'
import { fmtIDR, fmtDate, fmtPct, monthStart, monthEnd, calcPPh21Doctor } from '../../utils/format'
import { exportPPh21ReportPDF } from '../../utils/exportPDF'
import * as XLSX from 'xlsx'
import toast from 'react-hot-toast'

export default function PPh21Page() {
  const { billings, doctors, activeBranchId, branches, appSettings } = useStore()
  const [dateFrom, setDateFrom] = useState(monthStart())
  const [dateTo, setDateTo] = useState(monthEnd())
  const [branchFilter, setBranchFilter] = useState(activeBranchId || 'ALL')
  const [doctorFilter, setDoctorFilter] = useState('ALL')

  // Live database states from Supabase
  const [dbDoctors, setDbDoctors] = useState([])
  const [dbBillings, setDbBillings] = useState([])

  useEffect(() => {
    let isMounted = true
    const loadData = async () => {
      try {
        const [docData, billData] = await Promise.all([
          fetchDoctors().catch(() => []),
          fetchBillings().catch(() => []),
        ])
        if (isMounted) {
          if (Array.isArray(docData) && docData.length > 0) setDbDoctors(docData)
          if (Array.isArray(billData) && billData.length > 0) setDbBillings(billData)
        }
      } catch (err) {
        console.warn('[PPh21Page] Error loading live DB:', err.message)
      }
    }
    loadData()
    return () => { isMounted = false }
  }, [])

  const effectiveDoctors = dbDoctors.length > 0 ? dbDoctors : (doctors || [])
  const effectiveBillings = dbBillings.length > 0 ? dbBillings : (billings || [])

  // Doctor dropdown options
  const doctorOptions = useMemo(() => {
    const map = new Map()
    effectiveDoctors.forEach(d => {
      const fullName = d.fullName || d.full_name || d.name || ''
      const title = d.title || ''
      const formattedName = title ? `${title} ${fullName}`.trim() : fullName
      if (formattedName) {
        map.set(d.id, { id: d.id, name: formattedName, raw: d })
      }
    })
    effectiveBillings.forEach(b => {
      if (b.doctorName && !Array.from(map.values()).some(d => d.name === b.doctorName || d.id === b.doctorId)) {
        map.set(b.doctorId || b.doctorName, { id: b.doctorId || b.doctorName, name: b.doctorName })
      }
    })
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [effectiveDoctors, effectiveBillings])

  // Filtered transactions & calculate PPh 21 based on billing data
  const pph21Transactions = useMemo(() => {
    const filtered = effectiveBillings.filter(b => {
      if (b.status !== 'PAID') return false
      if (!b.doctorName && !b.doctorId) return false
      if (b.visitDate < dateFrom || b.visitDate > dateTo) return false
      if (branchFilter !== 'ALL' && b.branchId !== branchFilter) return false

      if (doctorFilter !== 'ALL') {
        const matchesId = b.doctorId === doctorFilter
        const selectedDocObj = doctorOptions.find(d => d.id === doctorFilter)
        const matchesName = b.doctorName === doctorFilter || (selectedDocObj && b.doctorName === selectedDocObj.name)
        if (!matchesId && !matchesName) return false
      }
      return true
    })

    return filtered.map(b => {
      // Find doctor to get accurate feePercentage (default 70% if not set)
      const doc = effectiveDoctors.find(d => d.id === b.doctorId || (d.fullName && b.doctorName && b.doctorName.includes(d.fullName)))
      const feeRate = doc ? (doc.feePercentage ?? doc.fee_percentage ?? 70) : 70

      // Gross doctor fee: subtotal services * feeRate
      const subtotalServices = b.subtotalServices || 0
      const grossAmount = Math.round(subtotalServices * (feeRate / 100))

      const calc = calcPPh21Doctor(grossAmount, 0)

      return {
        id: b.id,
        billingNumber: b.billingNumber,
        visitDate: b.visitDate,
        doctorName: b.doctorName || (doc ? `${doc.title || ''} ${doc.fullName}`.trim() : 'Dokter'),
        patientName: b.patientName || '—',
        patientMRN: b.patientMRN || '—',
        feeRate,
        subtotalServices,
        grossAmount,
        dpp: calc.dpp,
        rate: calc.rate,
        pph21Amount: calc.pph21Amount,
        netToDoctor: calc.netToDoctor,
      }
    }).sort((a, b) => new Date(b.visitDate) - new Date(a.visitDate))
  }, [effectiveBillings, effectiveDoctors, dateFrom, dateTo, branchFilter, doctorFilter, doctorOptions])

  const totalGross = pph21Transactions.reduce((s, d) => s + d.grossAmount, 0)
  const totalDPP = pph21Transactions.reduce((s, d) => s + d.dpp, 0)
  const totalPPh21 = pph21Transactions.reduce((s, d) => s + d.pph21Amount, 0)
  const totalNet = pph21Transactions.reduce((s, d) => s + d.netToDoctor, 0)

  const periodLabel = `${fmtDate(dateFrom)} s/d ${fmtDate(dateTo)}`
  const activeBranchObj = branches.find(b => b.id === branchFilter)
  const branchName = branchFilter === 'ALL' ? 'Semua Cabang' : (activeBranchObj?.entityName || 'Cabang Utama')
  const doctorNameFilter = doctorFilter === 'ALL' ? 'Semua Dokter' : (doctorOptions.find(d => d.id === doctorFilter)?.name || 'Dokter')

  const handleDownloadReport = () => {
    try {
      exportPPh21ReportPDF({
        pph21Transactions,
        totalGross,
        totalDPP,
        totalPPh21,
        totalNet,
        periodLabel,
        branchName,
        doctorNameFilter,
        appSettings
      })
      toast.success('Laporan PPh 21 (PDF) berhasil diunduh.')
    } catch (err) {
      console.error('[PPh21Page] Download error:', err)
      toast.error('Gagal mengunduh laporan PPh 21.')
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Laporan PPh 21 Jasa Medis Dokter</h1>
          <p className="text-sm text-slate-400 mt-0.5">Sesuai PER-2/PJ/2024 — Bukan Pegawai Berkesinambungan (Terintegrasi Billing)</p>
        </div>
        <button className="btn-danger-red flex items-center gap-2" onClick={handleDownloadReport}>
          <Download className="w-4 h-4" />Unduh Laporan
        </button>
      </div>

      {/* Filter Section */}
      <div className="card card-body">
        <div className="flex flex-wrap gap-4 items-end">
          <div><label className="form-label">Dari Tanggal</label><input type="date" className="form-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></div>
          <div><label className="form-label">Sampai Tanggal</label><input type="date" className="form-input" value={dateTo} onChange={e => setDateTo(e.target.value)} /></div>
          <div>
            <label className="form-label">Dokter</label>
            <select className="form-select font-medium" value={doctorFilter} onChange={e => setDoctorFilter(e.target.value)}>
              <option value="ALL">Semua Dokter</option>
              {doctorOptions.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Cabang</label>
            <select className="form-select" value={branchFilter} onChange={e => setBranchFilter(e.target.value)}>
              <option value="ALL">Semua Cabang</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.entityName}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Summary KPI cards — Vibrant Solid Colors (Supabase Live Data) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-sans">
        <div className="rounded-xl p-4 shadow-sm" style={{ background: '#2563EB' }}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-blue-100 font-sans">Total Jasa Medis Bruto</p>
          <p className="font-extrabold text-2xl text-white tracking-tight font-sans mt-2">{fmtIDR(totalGross)}</p>
        </div>
        <div className="rounded-xl p-4 shadow-sm" style={{ background: '#DC2626' }}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-red-100 font-sans">Total PPh 21 Dipotong</p>
          <p className="font-extrabold text-2xl text-white tracking-tight font-sans mt-2">{fmtIDR(totalPPh21)}</p>
        </div>
        <div className="rounded-xl p-4 shadow-sm" style={{ background: '#059669' }}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-100 font-sans">Total Neto ke Dokter</p>
          <p className="font-extrabold text-2xl text-white tracking-tight font-sans mt-2">{fmtIDR(totalNet)}</p>
        </div>
      </div>

      {/* PPh21 basis info */}
      <div className="card card-body bg-amber-50 border-amber-200 border text-sm text-amber-800">
        <p className="font-semibold mb-1">Dasar Hukum Perhitungan PPh 21 Dokter (PER-2/PJ/2024):</p>
        <ul className="list-disc list-inside space-y-0.5 text-xs">
          <li>DPP = 50% dari Penghasilan Bruto Jasa Medis (sesuai persentase fee dokter dari Billing)</li>
          <li>Tarif Progresif Pasal 17: 5% (s/d Rp 60 jt) · 15% (Rp 60–250 jt) · 25% (Rp 250–500 jt) · 30% (diatas Rp 500 jt)</li>
          <li>Akumulasi DPP dihitung per tahun kalender (YTD basis)</li>
          <li>Jurnal Otomatis Billing: Dr 6-12-001 Beban Jasa Medis | Cr 2-13-001 Utang PPh 21 | Cr 2-12-003 Utang Jasa Medis Bersih</li>
        </ul>
      </div>

      {/* Detail Transaksi PPh 21 Table */}
      <div className="card">
        <div className="card-header">
          <span className="section-title">Detail PPh 21 Jasa Medis Transaksi ({pph21Transactions.length})</span>
          <span className="text-xs text-slate-400">{periodLabel}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>No. Billing / Tanggal</th>
                <th>Nama Dokter</th>
                <th>Nama Pasien</th>
                <th>No. RM</th>
                <th className="text-right">Jasa Medis Bruto</th>
                <th className="text-right">DPP (50%)</th>
                <th className="text-right">Tarif PPh 21</th>
                <th className="text-right">PPh 21 Dipotong</th>
                <th className="text-right">Neto ke Dokter</th>
              </tr>
            </thead>
            <tbody>
              {pph21Transactions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-400">
                    Belum ada data transaksi jasa medis dokter pada periode ini
                  </td>
                </tr>
              ) : pph21Transactions.map(d => (
                <tr key={d.id}>
                  <td>
                    <div className="font-mono text-xs text-primary-700 font-bold">{d.billingNumber}</div>
                    <div className="text-xs text-slate-400">{fmtDate(d.visitDate)}</div>
                  </td>
                  <td className="font-medium text-sm text-slate-800">{d.doctorName}</td>
                  <td className="font-medium text-sm text-slate-700">{d.patientName}</td>
                  <td className="font-mono text-xs text-slate-500">{d.patientMRN}</td>
                  <td className="text-right font-mono text-sm">{fmtIDR(d.grossAmount)}</td>
                  <td className="text-right font-mono text-sm">{fmtIDR(d.dpp)}</td>
                  <td className="text-right"><span className="badge badge-yellow">{fmtPct(d.rate * 100)}</span></td>
                  <td className="text-right font-mono text-sm text-red-600 font-bold">{fmtIDR(d.pph21Amount)}</td>
                  <td className="text-right font-mono text-sm text-emerald-700 font-bold">{fmtIDR(d.netToDoctor)}</td>
                </tr>
              ))}
            </tbody>
            {pph21Transactions.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 font-bold">
                  <td colSpan={4}>TOTAL</td>
                  <td className="text-right font-mono amount-debit">{fmtIDR(totalGross)}</td>
                  <td className="text-right font-mono">{fmtIDR(totalDPP)}</td>
                  <td />
                  <td className="text-right font-mono text-red-700">{fmtIDR(totalPPh21)}</td>
                  <td className="text-right font-mono text-emerald-700">{fmtIDR(totalNet)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}
