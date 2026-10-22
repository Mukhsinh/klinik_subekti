import { useState, useMemo, useEffect } from 'react'
import { Download, Filter, FileText, FileSpreadsheet, Search, CheckCircle2, AlertTriangle, Info, ArrowUpRight, ArrowDownLeft } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { fmtIDR, fmtDate, fmtPct, monthStart, monthEnd, PPN_RATE } from '../../utils/format'
import { exportPPNReportPDF } from '../../utils/exportPDF'
import { fetchBillings, fetchExpenses, fetchAllBillingItems } from '../../lib/db'
import * as XLSX from 'xlsx'
import toast from 'react-hot-toast'

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
]

export default function PPNPage() {
  const { billings, expenses, billingItems, branches, activeBranchId, appSettings } = useStore()

  // Filter States
  const [filterType, setFilterType] = useState('ALL') // 'ALL', 'MONTHLY', 'CUSTOM', 'YEARLY'
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [dateFrom, setDateFrom] = useState(monthStart())
  const [dateTo, setDateTo] = useState(monthEnd())
  const [branchFilter, setBranchFilter] = useState(activeBranchId || 'ALL')
  const [searchTerm, setSearchTerm] = useState('')

  // Live database states
  const [dbBillings, setDbBillings] = useState([])
  const [dbExpenses, setDbExpenses] = useState([])
  const [dbBillingItems, setDbBillingItems] = useState([])

  useEffect(() => {
    let isMounted = true
    const loadLiveData = async () => {
      try {
        const [bills, exps, items] = await Promise.all([
          fetchBillings().catch(() => []),
          fetchExpenses().catch(() => []),
          fetchAllBillingItems().catch(() => [])
        ])
        if (isMounted) {
          if (Array.isArray(bills) && bills.length > 0) setDbBillings(bills)
          if (Array.isArray(exps) && exps.length > 0) setDbExpenses(exps)
          if (Array.isArray(items) && items.length > 0) setDbBillingItems(items)
        }
      } catch (err) {
        console.warn('[PPNPage] Error fetching live DB:', err.message)
      }
    }
    loadLiveData()
    return () => { isMounted = false }
  }, [])

  const effectiveBillings = dbBillings.length > 0 ? dbBillings : (billings || [])
  const effectiveExpenses = dbExpenses.length > 0 ? dbExpenses : (expenses || [])
  const effectiveBillingItems = dbBillingItems.length > 0 ? dbBillingItems : (billingItems || [])

  // Filtered Billings for PPN Keluaran
  const periodBillings = useMemo(() => {
    return effectiveBillings.filter(b => {
      if (b.status !== 'PAID') return false
      if ((b.ppnAmount || 0) <= 0 && (b.subtotalPharmacy || 0) <= 0) return false
      if (branchFilter !== 'ALL' && b.branchId !== branchFilter) return false

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
      // If filterType === 'ALL', display all transactions!

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase()
        const matchBill = (b.billingNumber || '').toLowerCase().includes(q)
        const matchPatient = (b.patientName || '').toLowerCase().includes(q)
        if (!matchBill && !matchPatient) return false
      }

      return true
    }).sort((a, b) => new Date(b.visitDate) - new Date(a.visitDate))
  }, [effectiveBillings, filterType, selectedMonth, selectedYear, dateFrom, dateTo, branchFilter, searchTerm])

  // Filtered Expenses for PPN Masukan
  const periodExpenses = useMemo(() => {
    return effectiveExpenses.filter(e => {
      if (e.status !== 'POSTED') return false
      if ((e.ppnAmount || 0) <= 0) return false
      if (branchFilter !== 'ALL' && e.branchId !== branchFilter) return false

      if (filterType === 'MONTHLY') {
        const d = new Date(e.expenseDate)
        if (d.getFullYear() !== selectedYear || d.getMonth() + 1 !== selectedMonth) return false
      } else if (filterType === 'CUSTOM') {
        if (dateFrom && e.expenseDate < dateFrom) return false
        if (dateTo && e.expenseDate > dateTo) return false
      } else if (filterType === 'YEARLY') {
        const d = new Date(e.expenseDate)
        if (d.getFullYear() !== selectedYear) return false
      }
      // If filterType === 'ALL', display all transactions!

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase()
        const matchExp = (e.expenseNumber || '').toLowerCase().includes(q)
        const matchVendor = (e.vendorName || '').toLowerCase().includes(q)
        const matchDesc = (e.description || '').toLowerCase().includes(q)
        if (!matchExp && !matchVendor && !matchDesc) return false
      }

      return true
    }).sort((a, b) => new Date(b.expenseDate) - new Date(a.expenseDate))
  }, [effectiveExpenses, filterType, selectedMonth, selectedYear, dateFrom, dateTo, branchFilter, searchTerm])

  // Calculations
  const dppFarmasi = useMemo(() =>
    periodBillings.reduce((s, b) => s + (b.subtotalPharmacy || 0), 0),
    [periodBillings]
  )

  const ppnKeluaran = useMemo(() =>
    periodBillings.reduce((s, b) => s + (b.ppnAmount || 0), 0),
    [periodBillings]
  )

  const dppMasukan = useMemo(() =>
    periodExpenses.reduce((s, e) => s + (e.grossAmount || 0), 0),
    [periodExpenses]
  )

  const ppnMasukan = useMemo(() =>
    periodExpenses.reduce((s, e) => s + (e.ppnAmount || 0), 0),
    [periodExpenses]
  )

  // Selisih PPN Kurang/Lebih Bayar
  const ppnTerutang = ppnKeluaran - ppnMasukan

  const periodLabel = useMemo(() => {
    if (filterType === 'ALL') return 'Semua Periode (Seluruh Transaksi)'
    if (filterType === 'MONTHLY') return `${MONTHS[selectedMonth - 1]} ${selectedYear}`
    if (filterType === 'YEARLY') return `Tahun ${selectedYear}`
    return `${fmtDate(dateFrom)} s/d ${fmtDate(dateTo)}`
  }, [filterType, selectedMonth, selectedYear, dateFrom, dateTo])

  const activeBranchObj = branches.find(b => b.id === branchFilter)
  const branchName = branchFilter === 'ALL' ? 'Semua Cabang' : (activeBranchObj?.entityName || 'Cabang Utama')

  // Helper to get pharmacy item names for a billing
  const getBillingPharmacySummary = (billingId) => {
    const items = effectiveBillingItems.filter(i =>
      ((i.billingId || i.billing_id) === billingId) &&
      ((i.itemType || i.item_type) === 'PHARMACY')
    )
    if (items.length === 0) return 'Obat Farmasi Rawat Jalan'
    return items.map(i => `${i.itemName || i.item_name} (${i.quantity || 1})`).join(', ')
  }

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
      toast.success('Laporan PPN CoreTax (PDF) berhasil diunduh.')
    } catch (err) {
      console.error('[PPNPage] Download error:', err)
      toast.error('Gagal mengunduh laporan PPN.')
    }
  }

  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new()

      // Sheet 1: PPN Keluaran
      const wsKeluaranData = [
        ['REKAPITULASI PPN KELUARAN — PENJUALAN OBAT (CORETAX DJP)'],
        [`Klinik: ${appSettings?.companyName || 'KLINIK PRATAMA SUBEKTI'} | NPWP: ${appSettings?.taxId || appSettings?.npwp || '01.234.567.8-012.000'}`],
        [`Periode: ${periodLabel} | Cabang: ${branchName}`],
        [''],
        ['No', 'No. Billing / Dokumen', 'Tanggal', 'Nama Pasien', 'Jenis Dokumen (CoreTax)', 'DPP Farmasi (Rp)', 'Tarif', 'PPN 11% (Rp)', 'Grand Total (Rp)']
      ]

      periodBillings.forEach((b, idx) => {
        wsKeluaranData.push([
          idx + 1,
          b.billingNumber,
          b.visitDate,
          b.patientName || '—',
          'Faktur Pajak Digunggung (Pedagang Eceran Farmasi)',
          b.subtotalPharmacy || 0,
          '11%',
          b.ppnAmount || 0,
          b.grandTotal || 0
        ])
      })

      wsKeluaranData.push(['', '', '', '', 'TOTAL', dppFarmasi, '', ppnKeluaran, ''])
      const wsKeluaran = XLSX.utils.aoa_to_sheet(wsKeluaranData)
      wsKeluaran['!cols'] = [
        { wch: 6 }, { wch: 22 }, { wch: 14 }, { wch: 28 }, { wch: 40 },
        { wch: 20 }, { wch: 10 }, { wch: 20 }, { wch: 20 }
      ]
      XLSX.utils.book_append_sheet(wb, wsKeluaran, 'PPN Keluaran')

      // Sheet 2: PPN Masukan
      const wsMasukanData = [
        ['REKAPITULASI PPN MASUKAN — PEMBELIAN BKP / JKP (CORETAX DJP)'],
        [`Klinik: ${appSettings?.companyName || 'KLINIK PRATAMA SUBEKTI'} | NPWP: ${appSettings?.taxId || appSettings?.npwp || '01.234.567.8-012.000'}`],
        [`Periode: ${periodLabel} | Cabang: ${branchName}`],
        [''],
        ['No', 'No. Transaksi', 'Tanggal', 'Nama PKP Rekanan / Supplier', 'No. Faktur Pajak Masukan', 'Keterangan Barang/Jasa', 'DPP (Rp)', 'PPN Masukan 11% (Rp)']
      ]

      periodExpenses.forEach((e, idx) => {
        wsMasukanData.push([
          idx + 1,
          e.expenseNumber,
          e.expenseDate,
          e.vendorName || '—',
          e.taxInvoiceNumber || e.invoiceNumber || 'Faktur Pajak Standar',
          e.description || 'Pembelian Persediaan / Operasional',
          e.grossAmount || 0,
          e.ppnAmount || 0
        ])
      })

      wsMasukanData.push(['', '', '', '', '', 'TOTAL', dppMasukan, ppnMasukan])
      const wsMasukan = XLSX.utils.aoa_to_sheet(wsMasukanData)
      wsMasukan['!cols'] = [
        { wch: 6 }, { wch: 20 }, { wch: 14 }, { wch: 30 }, { wch: 28 },
        { wch: 35 }, { wch: 20 }, { wch: 20 }
      ]
      XLSX.utils.book_append_sheet(wb, wsMasukan, 'PPN Masukan')

      XLSX.writeFile(wb, `Laporan_PPN_CoreTax_${periodLabel.replace(/[\s/]+/g, '_')}.xlsx`)
      toast.success('Laporan Excel format CoreTax berhasil diunduh.')
    } catch (err) {
      console.error('[PPNPage] Excel export error:', err)
      toast.error('Gagal mengekspor file Excel.')
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Laporan PPN (Pajak Pertambahan Nilai)</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Sesuai Kaidah CoreTax DJP & UU HPP No. 7/2021 — Rekapitulasi Pajak Masukan & Keluaran (11%)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary flex items-center gap-1.5" onClick={handleDownloadReport}>
            <FileText className="w-4 h-4 text-emerald-600" />
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
            <h3 className="font-semibold text-slate-700">Filter Periode & Cabang</h3>
          </div>
          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
            {periodBillings.length} Penyerahan BKP • {periodExpenses.length} Perolehan BKP
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
              <option value="ALL">Semua Periode (Seluruh Transaksi)</option>
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

          {/* Filter Cabang */}
          <div>
            <label className="form-label">Cabang Klinik</label>
            <select className="form-select" value={branchFilter} onChange={e => setBranchFilter(e.target.value)}>
              <option value="ALL">Semua Cabang</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.entityName}</option>)}
            </select>
          </div>

          {/* Search Box */}
          <div className={filterType === 'ALL' ? 'md:col-span-3' : ''}>
            <label className="form-label">Cari No. Dokumen / Pasien / Rekanan</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                className="form-input pl-9"
                placeholder="Cari billing, pasien, vendor..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Ketentuan PPN UU HPP & CoreTax Info */}
      <div className="card card-body bg-emerald-50 border-emerald-200 border text-sm text-emerald-950">
        <div className="flex items-start gap-2.5">
          <Info className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <p className="font-bold text-emerald-900 text-sm">
              Ketentuan Perlakuan PPN Fasilitas Kesehatan (UU HPP No. 7/2021 & PMK 71/2022):
            </p>
            <ul className="list-disc list-inside space-y-0.5">
              <li><strong>Jasa Pelayanan Kesehatan Medis Dibebaskan:</strong> Konsultasi dokter, tindakan medis klinis, dan rawat inap dibebaskan dari pengenaan PPN (Non-BKP).</li>
              <li><strong>Penjualan Obat-obatan Terutang PPN 11%:</strong> Penyerahan obat-obatan farmasi kepada pasien rawat jalan/konsumen akhir terutang PPN 11% menggunakan Faktur Pajak Digunggung.</li>
              <li><strong>Mekanisme Pengkreditan CoreTax:</strong> Pajak Masukan atas perolehan obat/BKP dapat dikreditkan terhadap Pajak Keluaran untuk menentukan status SPT Masa PPN (Kurang Bayar / Lebih Bayar).</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 font-sans">
        {/* PPN Keluaran */}
        <div className="rounded-xl p-4 shadow-sm" style={{ background: '#059669' }}>
          <div className="flex items-center justify-between text-emerald-100">
            <p className="text-[11px] font-bold uppercase tracking-wider">PPN Keluaran (Output)</p>
            <ArrowUpRight className="w-4 h-4" />
          </div>
          <p className="text-xs text-emerald-200 mt-0.5">DPP Farmasi: {fmtIDR(dppFarmasi)}</p>
          <p className="font-extrabold text-2xl text-white tracking-tight mt-2">{fmtIDR(ppnKeluaran)}</p>
          <p className="text-[11px] text-emerald-100 mt-1">{periodBillings.length} Faktur Digunggung</p>
        </div>

        {/* PPN Masukan */}
        <div className="rounded-xl p-4 shadow-sm" style={{ background: '#2563EB' }}>
          <div className="flex items-center justify-between text-blue-100">
            <p className="text-[11px] font-bold uppercase tracking-wider">PPN Masukan (Input)</p>
            <ArrowDownLeft className="w-4 h-4" />
          </div>
          <p className="text-xs text-blue-200 mt-0.5">DPP Pembelian: {fmtIDR(dppMasukan)}</p>
          <p className="font-extrabold text-2xl text-white tracking-tight mt-2">{fmtIDR(ppnMasukan)}</p>
          <p className="text-[11px] text-blue-100 mt-1">{periodExpenses.length} Faktur Masukan</p>
        </div>

        {/* DPP Total */}
        <div className="rounded-xl p-4 shadow-sm" style={{ background: '#475569' }}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-200">Total Perputaran BKP (DPP)</p>
          <p className="text-xs text-slate-300 mt-0.5">Keluaran + Masukan Terdaftar</p>
          <p className="font-extrabold text-2xl text-white tracking-tight mt-2">{fmtIDR(dppFarmasi + dppMasukan)}</p>
          <p className="text-[11px] text-slate-300 mt-1">Tarif Efektif 11% UU HPP</p>
        </div>

        {/* Status SPT PPN */}
        <div className="rounded-xl p-4 shadow-sm" style={{ background: ppnTerutang >= 0 ? '#DC2626' : '#0D9488' }}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-white/90">
            {ppnTerutang >= 0 ? 'Status: PPN Kurang Bayar' : 'Status: PPN Lebih Bayar'}
          </p>
          <p className="text-xs text-white/80 mt-0.5">
            {ppnTerutang >= 0 ? 'Wajib Disetor ke Kas Negara' : 'Dapat Dikompensasikan'}
          </p>
          <p className="font-extrabold text-2xl text-white tracking-tight mt-2">{fmtIDR(Math.abs(ppnTerutang))}</p>
          <p className="text-[11px] text-white/80 mt-1">
            {ppnTerutang >= 0 ? 'Kode Akun DJP 411211 KJS 100' : 'Kompensasi SPT Masa Berikutnya'}
          </p>
        </div>
      </div>

      {/* Tables Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Table 1: PPN Keluaran */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <div>
              <span className="section-title text-emerald-800">1. PPN Keluaran — Penyerahan BKP Farmasi</span>
              <p className="text-xs text-slate-400 mt-0.5">Faktur Pajak Digunggung Konsumen Akhir ({periodBillings.length})</p>
            </div>
            <span className="badge badge-green font-bold">
              Total: {fmtIDR(ppnKeluaran)}
            </span>
          </div>
          <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
            <table className="table-base">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th>No</th>
                  <th>No. Billing / Tanggal</th>
                  <th>Pasien / Rincian Obat</th>
                  <th className="text-right">DPP Farmasi</th>
                  <th className="text-right">PPN 11%</th>
                </tr>
              </thead>
              <tbody>
                {periodBillings.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-slate-400">
                      Tidak ada data penyerahan BKP terutang PPN pada periode ini
                    </td>
                  </tr>
                ) : (
                  periodBillings.map((b, idx) => (
                    <tr key={b.id}>
                      <td className="text-center text-xs text-slate-400">{idx + 1}</td>
                      <td>
                        <div className="font-mono text-xs text-primary-700 font-bold">{b.billingNumber}</div>
                        <div className="text-[11px] text-slate-400">{fmtDate(b.visitDate)}</div>
                      </td>
                      <td>
                        <div className="font-medium text-sm text-slate-800">{b.patientName}</div>
                        <div className="text-[11px] text-slate-500 truncate max-w-[200px]" title={getBillingPharmacySummary(b.id)}>
                          {getBillingPharmacySummary(b.id)}
                        </div>
                      </td>
                      <td className="text-right font-mono text-sm">{fmtIDR(b.subtotalPharmacy || 0)}</td>
                      <td className="text-right font-mono text-sm font-bold text-emerald-700">{fmtIDR(b.ppnAmount || 0)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {periodBillings.length > 0 && (
                <tfoot className="sticky bottom-0 bg-slate-50 font-bold">
                  <tr>
                    <td colSpan={3} className="text-right pr-4">TOTAL PPN KELUARAN</td>
                    <td className="text-right font-mono text-slate-800">{fmtIDR(dppFarmasi)}</td>
                    <td className="text-right font-mono text-emerald-700">{fmtIDR(ppnKeluaran)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* Table 2: PPN Masukan */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <div>
              <span className="section-title text-blue-800">2. PPN Masukan — Pembelian & Pengeluaran</span>
              <p className="text-xs text-slate-400 mt-0.5">Faktur Pajak Masukan Dapat Dikreditkan ({periodExpenses.length})</p>
            </div>
            <span className="badge badge-blue font-bold">
              Total: {fmtIDR(ppnMasukan)}
            </span>
          </div>
          <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
            <table className="table-base">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th>No</th>
                  <th>No. Transaksi / Tanggal</th>
                  <th>Rekanan & No. Faktur</th>
                  <th className="text-right">DPP Pembelian</th>
                  <th className="text-right">PPN Masukan</th>
                </tr>
              </thead>
              <tbody>
                {periodExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-slate-400">
                      Tidak ada faktur pajak masukan pada periode ini
                    </td>
                  </tr>
                ) : (
                  periodExpenses.map((e, idx) => (
                    <tr key={e.id}>
                      <td className="text-center text-xs text-slate-400">{idx + 1}</td>
                      <td>
                        <div className="font-mono text-xs text-primary-700 font-bold">{e.expenseNumber}</div>
                        <div className="text-[11px] text-slate-400">{fmtDate(e.expenseDate)}</div>
                      </td>
                      <td>
                        <div className="font-medium text-sm text-slate-800">{e.vendorName || 'Rekanan PKP'}</div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          FP: {e.taxInvoiceNumber || e.invoiceNumber || 'Standar CoreTax'}
                        </div>
                      </td>
                      <td className="text-right font-mono text-sm">{fmtIDR(e.grossAmount || 0)}</td>
                      <td className="text-right font-mono text-sm font-bold text-blue-700">{fmtIDR(e.ppnAmount || 0)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {periodExpenses.length > 0 && (
                <tfoot className="sticky bottom-0 bg-slate-50 font-bold">
                  <tr>
                    <td colSpan={3} className="text-right pr-4">TOTAL PPN MASUKAN</td>
                    <td className="text-right font-mono text-slate-800">{fmtIDR(dppMasukan)}</td>
                    <td className="text-right font-mono text-blue-700">{fmtIDR(ppnMasukan)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
