import { useState, useMemo, useEffect } from 'react'
import { Download, Filter, UserCheck, FileText, FileSpreadsheet, Calendar, Search } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { fmtIDR, fmtDate, fmtPct, todayISO, monthStart, monthEnd, calcPPh21Doctor } from '../../utils/format'
import { exportPPh21ReportPDF } from '../../utils/exportPDF'
import { fetchDoctors, fetchBillings } from '../../lib/db'
import * as XLSX from 'xlsx'
import toast from 'react-hot-toast'

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
]

export default function PPh21Page() {
  const { billings, doctors, activeBranchId, branches, appSettings } = useStore()

  // Filter States
  const [filterType, setFilterType] = useState('ALL') // 'ALL', 'MONTHLY', 'CUSTOM', 'YEARLY'
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [dateFrom, setDateFrom] = useState(monthStart())
  const [dateTo, setDateTo] = useState(monthEnd())
  const [branchFilter, setBranchFilter] = useState(activeBranchId || 'ALL')
  const [doctorFilter, setDoctorFilter] = useState('ALL')
  const [searchTerm, setSearchTerm] = useState('')

  // Live Database States
  const [dbDoctors, setDbDoctors] = useState([])
  const [dbBillings, setDbBillings] = useState([])

  useEffect(() => {
    let isMounted = true
    const loadLiveData = async () => {
      try {
        const [docs, bills] = await Promise.all([
          fetchDoctors().catch(() => []),
          fetchBillings().catch(() => [])
        ])
        if (isMounted) {
          if (Array.isArray(docs) && docs.length > 0) setDbDoctors(docs)
          if (Array.isArray(bills) && bills.length > 0) setDbBillings(bills)
        }
      } catch (err) {
        console.warn('[PPh21Page] Error fetching live DB:', err.message)
      }
    }
    loadLiveData()
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
      const npwp = d.npwp || d.doctor_npwp || d.nik || '—'
      if (formattedName) {
        map.set(d.id, { id: d.id, name: formattedName, npwp, raw: d })
      }
    })
    effectiveBillings.forEach(b => {
      if (b.doctorName && !Array.from(map.values()).some(d => d.name === b.doctorName || d.id === b.doctorId)) {
        map.set(b.doctorId || b.doctorName, {
          id: b.doctorId || b.doctorName,
          name: b.doctorName,
          npwp: '—'
        })
      }
    })
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [effectiveDoctors, effectiveBillings])

  // Filtered transactions & calculate PPh 21 based on billing data
  const pph21Transactions = useMemo(() => {
    const filtered = effectiveBillings.filter(b => {
      // Must be paid billing with doctor assigned
      if (b.status !== 'PAID') return false
      if (!b.doctorName && !b.doctorId) return false
      if (branchFilter !== 'ALL' && b.branchId !== branchFilter) return false

      // Doctor Filter
      if (doctorFilter !== 'ALL') {
        const matchesId = b.doctorId === doctorFilter
        const selectedDocObj = doctorOptions.find(d => d.id === doctorFilter)
        const matchesName = b.doctorName === doctorFilter || (selectedDocObj && b.doctorName === selectedDocObj.name)
        if (!matchesId && !matchesName) return false
      }

      // Period Filter
      if (filterType === 'MONTHLY') {
        const d = new Date(b.visitDate)
        if (d.getFullYear() !== selectedYear || d.getMonth() + 1 !== selectedMonth) return false
      } else if (filterType === 'CUSTOM') {
        if (dateFrom && b.visitDate < dateFrom) return false
        if (dateTo && b.visitDate > dateTo) return false
      } else if (filterType === 'YEARLY') {
        const d = new Date(b.visitDate)
        if (d.getFullYear() !== selectedYear) return false
      }
      // If filterType === 'ALL', display all transactions without date restriction!

      // Text search
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase()
        const matchBill = (b.billingNumber || '').toLowerCase().includes(q)
        const matchDoc = (b.doctorName || '').toLowerCase().includes(q)
        const matchPatient = (b.patientName || '').toLowerCase().includes(q)
        const matchMRN = (b.patientMRN || '').toLowerCase().includes(q)
        if (!matchBill && !matchDoc && !matchPatient && !matchMRN) return false
      }

      return true
    })

    return filtered.map(b => {
      // Find doctor to get accurate feePercentage (default 70% if not set)
      const doc = effectiveDoctors.find(d => d.id === b.doctorId || (d.fullName && b.doctorName && b.doctorName.includes(d.fullName)))
      const feeRate = doc ? (Number(doc.feePercentage ?? doc.fee_percentage) || 70) : 70
      const docNpwp = doc?.npwp || doc?.doctor_npwp || doc?.nik || '00.000.000.0-000.000'

      // PPh 21 Dokter HANYA untuk pemeriksaan/tindakan medis oleh dokter, TIDAK termasuk laboratorium dan farmasi!
      const doctorServices = Number(b.subtotalDoctorServices !== undefined ? b.subtotalDoctorServices : (Number(b.subtotalServices || 0) - Number(b.subtotalLab || 0)))
      const grossAmount = Math.round(doctorServices * (feeRate / 100))

      const calc = calcPPh21Doctor(grossAmount, 0)
      const ym = b.visitDate ? b.visitDate.replace(/-/g, '').substring(0, 6) : '2026'
      const bupotNumber = `BUPOT-21/${ym}/${(b.billingNumber || '').replace(/[^0-9]/g, '').slice(-5) || '00001'}`

      return {
        id: b.id,
        bupotNumber,
        billingNumber: b.billingNumber,
        visitDate: b.visitDate,
        doctorId: b.doctorId || doc?.id,
        doctorName: b.doctorName || (doc ? `${doc.title || ''} ${doc.fullName}`.trim() : 'Dokter'),
        doctorNpwp: docNpwp,
        patientName: b.patientName || '—',
        patientMRN: b.patientMRN || '—',
        feeRate,
        doctorServices,
        grossAmount,
        dpp: calc.dpp,
        rate: calc.rate,
        pph21Amount: calc.pph21Amount,
        netToDoctor: calc.netToDoctor,
      }
    }).sort((a, b) => new Date(b.visitDate) - new Date(a.visitDate))
  }, [effectiveBillings, effectiveDoctors, filterType, selectedMonth, selectedYear, dateFrom, dateTo, branchFilter, doctorFilter, doctorOptions, searchTerm])

  const totalGross = pph21Transactions.reduce((s, d) => s + d.grossAmount, 0)
  const totalDPP = pph21Transactions.reduce((s, d) => s + d.dpp, 0)
  const totalPPh21 = pph21Transactions.reduce((s, d) => s + d.pph21Amount, 0)
  const totalNet = pph21Transactions.reduce((s, d) => s + d.netToDoctor, 0)

  const periodLabel = useMemo(() => {
    if (filterType === 'ALL') return 'Semua Periode (Keseluruhan Transaksi)'
    if (filterType === 'MONTHLY') return `${MONTHS[selectedMonth - 1]} ${selectedYear}`
    if (filterType === 'YEARLY') return `Tahun ${selectedYear}`
    return `${fmtDate(dateFrom)} s/d ${fmtDate(dateTo)}`
  }, [filterType, selectedMonth, selectedYear, dateFrom, dateTo])

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
      toast.success('Laporan PPh 21 CoreTax (PDF) berhasil diunduh.')
    } catch (err) {
      console.error('[PPh21Page] Download error:', err)
      toast.error('Gagal mengunduh laporan PPh 21.')
    }
  }

  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new()

      // Sheet 1: e-Bupot 21 CoreTax Format
      const wsData = [
        ['REKAPITULASI BUKTI POTONG PPH PASAL 21 DOKTER (CORETAX DJP)'],
        [`Klinik: ${appSettings?.companyName || 'KLINIK PRATAMA SUBEKTI'} | NPWP: ${appSettings?.taxId || appSettings?.npwp || '01.234.567.8-012.000'}`],
        [`Periode: ${periodLabel} | Filter Dokter: ${doctorNameFilter}`],
        [''],
        [
          'No', 'No. Bukti Potong CoreTax', 'No. Billing', 'Tanggal', 'Nama Dokter',
          'NPWP / NIK Dokter', 'Kode Objek Pajak', 'Nama Pasien', 'No. RM',
          'Jasa Medis Bruto (Rp)', 'Dasar Pengenaan Pajak / DPP (Rp)', 'Tarif Pajak',
          'PPh 21 Dipotong (Rp)', 'Neto Diterima Dokter (Rp)'
        ]
      ]

      pph21Transactions.forEach((t, idx) => {
        wsData.push([
          idx + 1,
          t.bupotNumber,
          t.billingNumber,
          t.visitDate,
          t.doctorName,
          t.doctorNpwp,
          '21-100-07',
          t.patientName,
          t.patientMRN,
          t.grossAmount,
          t.dpp,
          `${(t.rate * 100).toFixed(0)}%`,
          t.pph21Amount,
          t.netToDoctor
        ])
      })

      // Summary row
      wsData.push([
        '', '', '', '', 'TOTAL', '', '', '', '',
        totalGross, totalDPP, '', totalPPh21, totalNet
      ])

      const ws = XLSX.utils.aoa_to_sheet(wsData)
      ws['!cols'] = [
        { wch: 6 }, { wch: 26 }, { wch: 22 }, { wch: 14 }, { wch: 30 },
        { wch: 24 }, { wch: 16 }, { wch: 28 }, { wch: 14 },
        { wch: 20 }, { wch: 20 }, { wch: 12 }, { wch: 20 }, { wch: 20 }
      ]

      XLSX.utils.book_append_sheet(wb, ws, 'e-Bupot CoreTax 21')
      XLSX.writeFile(wb, `Laporan_PPh21_CoreTax_${periodLabel.replace(/[\s/]+/g, '_')}.xlsx`)
      toast.success('Laporan Excel format CoreTax berhasil diunduh.')
    } catch (err) {
      console.error('[PPh21Page] Excel export error:', err)
      toast.error('Gagal mengekspor file Excel.')
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Laporan PPh 21 Jasa Medis Dokter</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Sesuai Kaidah Perpajakan CoreTax DJP & PER-2/PJ/2024 — Bukan Pegawai Berkesinambungan (DPP 50%)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary flex items-center gap-1.5" onClick={handleDownloadReport}>
            <FileText className="w-4 h-4 text-red-600" />
            PDF CoreTax
          </button>
          <button className="btn-success flex items-center gap-1.5" onClick={handleExportExcel}>
            <FileSpreadsheet className="w-4 h-4" />
            Excel CoreTax
          </button>
        </div>
      </div>

      {/* Filter Section */}
      <div className="card card-body">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-primary-600" />
            <h3 className="font-semibold text-slate-700">Filter Periode, Dokter & Cabang</h3>
          </div>
          <span className="text-xs font-semibold text-primary-700 bg-primary-50 px-2.5 py-1 rounded-md border border-primary-200">
            {pph21Transactions.length} Transaksi Ditemukan
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Tipe Periode Filter */}
          <div>
            <label className="form-label">Tipe Filter Periode</label>
            <select
              className="form-select font-medium"
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
            >
              <option value="ALL">Semua Periode (Semua Transaksi)</option>
              <option value="MONTHLY">Bulanan</option>
              <option value="CUSTOM">Rentang Tanggal (Kustom)</option>
              <option value="YEARLY">Tahunan</option>
            </select>
          </div>

          {filterType === 'MONTHLY' && (
            <>
              <div>
                <label className="form-label">Bulan Pajak</label>
                <select className="form-select" value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}>
                  {MONTHS.map((m, idx) => <option key={idx} value={idx + 1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Tahun Pajak</label>
                <input type="number" className="form-input" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} />
              </div>
            </>
          )}

          {filterType === 'CUSTOM' && (
            <>
              <div>
                <label className="form-label">Dari Tanggal</label>
                <input type="date" className="form-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Sampai Tanggal</label>
                <input type="date" className="form-input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
              </div>
            </>
          )}

          {filterType === 'YEARLY' && (
            <div>
              <label className="form-label">Tahun Pajak</label>
              <input type="number" className="form-input" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} />
            </div>
          )}

          {/* Filter Dokter */}
          <div>
            <label className="form-label">Dokter Penerima Penghasilan</label>
            <select className="form-select font-medium" value={doctorFilter} onChange={e => setDoctorFilter(e.target.value)}>
              <option value="ALL">Semua Dokter</option>
              {doctorOptions.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Filter Cabang */}
          <div>
            <label className="form-label">Cabang Klinik</label>
            <select className="form-select" value={branchFilter} onChange={e => setBranchFilter(e.target.value)}>
              <option value="ALL">Semua Cabang</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.entityName}</option>)}
            </select>
          </div>

          {/* Search Box */}
          <div className={filterType === 'ALL' ? 'md:col-span-2' : ''}>
            <label className="form-label">Cari No. Billing / Pasien</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                className="form-input pl-9"
                placeholder="Cari billing, dokter, pasien..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards — CoreTax Alignment */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 font-sans">
        <div className="rounded-xl p-4 shadow-sm" style={{ background: '#2563EB' }}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-blue-100 font-sans">Jasa Medis Bruto Dokter</p>
          <p className="text-xs text-blue-200 mt-0.5">Komponen Lab & Farmasi Dikecualikan</p>
          <p className="font-extrabold text-2xl text-white tracking-tight font-sans mt-2">{fmtIDR(totalGross)}</p>
        </div>

        <div className="rounded-xl p-4 shadow-sm" style={{ background: '#475569' }}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-200 font-sans">Dasar Pengenaan Pajak (DPP)</p>
          <p className="text-xs text-slate-300 mt-0.5">50% × Penghasilan Bruto (PER-2/PJ/2024)</p>
          <p className="font-extrabold text-2xl text-white tracking-tight font-sans mt-2">{fmtIDR(totalDPP)}</p>
        </div>

        <div className="rounded-xl p-4 shadow-sm" style={{ background: '#DC2626' }}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-red-100 font-sans">PPh 21 Terutang Dipotong</p>
          <p className="text-xs text-red-200 mt-0.5">Disetor via e-Billing CoreTax DJP</p>
          <p className="font-extrabold text-2xl text-white tracking-tight font-sans mt-2">{fmtIDR(totalPPh21)}</p>
        </div>

        <div className="rounded-xl p-4 shadow-sm" style={{ background: '#059669' }}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-100 font-sans">Total Neto Diterima Dokter</p>
          <p className="text-xs text-emerald-200 mt-0.5">Jasa Medis Bruto dikurangi PPh 21</p>
          <p className="font-extrabold text-2xl text-white tracking-tight font-sans mt-2">{fmtIDR(totalNet)}</p>
        </div>
      </div>

      {/* Ketentuan Perpajakan CoreTax */}
      <div className="card card-body bg-blue-50 border-blue-200 border text-sm text-blue-900">
        <p className="font-semibold mb-1">Kaidah Perpajakan PPh 21 Tenaga Ahli Dokter (CoreTax DJP & PER-2/PJ/2024):</p>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li><strong>Kode Objek Pajak:</strong> <code>21-100-07</code> (Imbalan Kepada Tenaga Ahli / Dokter yang Melakukan Pekerjaan Bebas).</li>
          <li><strong>Dasar Pengenaan Pajak (DPP):</strong> Dihitung sebesar <strong>50%</strong> dari penghasilan bruto jasa medis dokter (pemeriksaan dan tindakan), <em>tidak termasuk</em> penjualan obat farmasi maupun pemeriksaan laboratorium.</li>
          <li><strong>Tarif Pajak:</strong> Tarif Progresif Pasal 17 UU HPP (5% s/d Rp 60jt, 15% Rp 60-250jt, 25% Rp 250-500jt, 30% diatas Rp 500jt).</li>
          <li><strong>Integrasi Otomatis Kasir:</strong> Terintegrasi langsung dengan menu Billing Kasir dan posting otomatis ke jurnal akuntansi klinik (Beban Jasa Medis, Utang PPh 21, dan Utang Jasa Medis Bersih).</li>
        </ul>
      </div>

      {/* Detail Transaksi PPh 21 Table */}
      <div className="card">
        <div className="card-body border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-800">Detail Bukti Pemotongan PPh 21 Dokter</h3>
            <p className="text-xs text-slate-400 mt-0.5">{periodLabel} • {doctorNameFilter}</p>
          </div>
          <span className="badge badge-red font-bold">
            Total PPh 21: {fmtIDR(totalPPh21)}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>No</th>
                <th>No. Bukti / Billing</th>
                <th>Tanggal</th>
                <th>Nama & NPWP Dokter</th>
                <th>Pasien / RM</th>
                <th className="text-right">Jasa Medis Bruto</th>
                <th className="text-right">DPP (50%)</th>
                <th className="text-center">Tarif</th>
                <th className="text-right">PPh 21 Dipotong</th>
                <th className="text-right">Neto ke Dokter</th>
              </tr>
            </thead>
            <tbody>
              {pph21Transactions.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-slate-400">
                    Tidak ada transaksi PPh 21 pada periode yang dipilih
                  </td>
                </tr>
              ) : (
                pph21Transactions.map((d, idx) => (
                  <tr key={d.id}>
                    <td className="text-center text-xs text-slate-400">{idx + 1}</td>
                    <td>
                      <div className="font-mono text-xs text-primary-700 font-bold">{d.bupotNumber}</div>
                      <div className="font-mono text-[11px] text-slate-400">{d.billingNumber}</div>
                    </td>
                    <td className="text-xs">{fmtDate(d.visitDate)}</td>
                    <td>
                      <div className="font-medium text-sm text-slate-800">{d.doctorName}</div>
                      <div className="font-mono text-[11px] text-slate-400">NPWP: {d.doctorNpwp}</div>
                    </td>
                    <td>
                      <div className="font-medium text-sm text-slate-700">{d.patientName}</div>
                      <div className="font-mono text-xs text-slate-400">RM: {d.patientMRN}</div>
                    </td>
                    <td className="text-right font-mono text-sm">{fmtIDR(d.grossAmount)}</td>
                    <td className="text-right font-mono text-sm text-slate-600">{fmtIDR(d.dpp)}</td>
                    <td className="text-center">
                      <span className="badge badge-yellow font-bold text-xs">{fmtPct(d.rate * 100)}</span>
                    </td>
                    <td className="text-right font-mono text-sm text-red-600 font-bold">{fmtIDR(d.pph21Amount)}</td>
                    <td className="text-right font-mono text-sm text-emerald-700 font-bold">{fmtIDR(d.netToDoctor)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {pph21Transactions.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 font-bold">
                  <td colSpan={5} className="text-right pr-4">TOTAL KESELURUHAN</td>
                  <td className="text-right font-mono text-blue-700">{fmtIDR(totalGross)}</td>
                  <td className="text-right font-mono text-slate-700">{fmtIDR(totalDPP)}</td>
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
