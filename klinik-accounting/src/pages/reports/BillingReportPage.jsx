import { useState, useMemo, useEffect } from 'react'
import { useStore } from '../../store/useStore'
import { fetchDoctors, fetchBillings, fetchAllBillingItems } from '../../lib/db'
import {
  Calendar, TrendingUp, Users, Wallet, Download,
  Filter, BarChart3, FileText, FileSpreadsheet, Activity, ShoppingBag,
  Eye, Printer
} from 'lucide-react'
import { fmtIDR, fmtDate, todayISO, paymentMethodLabel } from '../../utils/format'
import { exportBillingReceiptPDF } from '../../utils/exportPDF'
import Modal from '../../components/ui/Modal'
import { StatusBadge } from '../../components/ui/Badge'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import KpiCard from '../../components/ui/KpiCard'
import jsPDF from 'jspdf'
import 'jspdf-autotable'
import * as XLSX from 'xlsx'
import toast from 'react-hot-toast'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const QUARTERS = ['Triwulan 1', 'Triwulan 2', 'Triwulan 3', 'Triwulan 4']
const SEMESTERS = ['Semester 1', 'Semester 2']

export default function BillingReportPage() {
  const { billings, billingItems, branches, activeBranchId, doctors } = useStore()
  const [filterType, setFilterType] = useState('DAILY')
  const [startDate, setStartDate] = useState(todayISO())
  const [endDate, setEndDate] = useState(todayISO())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedQuarter, setSelectedQuarter] = useState(Math.floor(new Date().getMonth() / 3) + 1)
  const [selectedSemester, setSelectedSemester] = useState(new Date().getMonth() < 6 ? 1 : 2)
  const [selectedDoctor, setSelectedDoctor] = useState('ALL')

  // Live database states
  const [dbDoctors, setDbDoctors] = useState([])
  const [dbBillings, setDbBillings] = useState([])
  const [dbBillingItems, setDbBillingItems] = useState([])

  // Modal states for Detail & Receipt PDF
  const [selectedBilling, setSelectedBilling] = useState(null)
  const [modal, setModal] = useState(null)

  useEffect(() => {
    let isMounted = true
    const loadData = async () => {
      try {
        const [docData, billData, itemsData] = await Promise.all([
          fetchDoctors(),
          fetchBillings(),
          fetchAllBillingItems().catch(() => []),
        ])
        if (isMounted) {
          if (Array.isArray(docData)) setDbDoctors(docData)
          if (Array.isArray(billData)) setDbBillings(billData)
          if (Array.isArray(itemsData)) setDbBillingItems(itemsData)
        }
      } catch (err) {
        console.warn('[BillingReportPage] Error loading live DB:', err.message)
      }
    }
    loadData()
    return () => { isMounted = false }
  }, [])

  const activeBranch = branches.find(b => b.id === activeBranchId) || branches[0]

  const effectiveDoctors = dbDoctors.length > 0 ? dbDoctors : (doctors || [])
  const effectiveBillings = dbBillings.length > 0 ? dbBillings : (billings || [])
  const effectiveBillingItems = dbBillingItems.length > 0 ? dbBillingItems : (billingItems || [])

  // Consolidate doctor options strictly from master doctors in settings & billing history
  const doctorOptions = useMemo(() => {
    const map = new Map()

    // 1. Add master doctors from settings
    effectiveDoctors.forEach(d => {
      if (d.isActive === false || d.is_active === false) return
      const fullName = d.fullName || d.full_name || d.name || ''
      const title = d.title || ''
      const spec = d.specialization || d.specialization_name || ''
      const formattedName = title ? `${title} ${fullName}`.trim() : fullName
      const label = spec ? `${formattedName} (${spec})` : formattedName

      if (formattedName) {
        map.set(d.id, {
          value: d.id,
          name: formattedName,
          label,
          rawName: fullName,
        })
      }
    })

    // 2. Also include historical doctor names from billing transactions if not in master
    effectiveBillings.forEach(b => {
      if (b.doctorName && !Array.from(map.values()).some(d => d.name === b.doctorName || d.value === b.doctorId)) {
        map.set(b.doctorId || b.doctorName, {
          value: b.doctorId || b.doctorName,
          name: b.doctorName,
          label: b.doctorName,
          rawName: b.doctorName,
        })
      }
    })

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [effectiveDoctors, effectiveBillings])

  // Filter billings based on selected filter type & doctor
  const filteredBillings = useMemo(() => {
    let paid = (effectiveBillings || []).filter(b => b.status === 'PAID')

    if (selectedDoctor !== 'ALL') {
      const selectedDocObj = doctorOptions.find(d => d.value === selectedDoctor || d.name === selectedDoctor)
      const docId = selectedDoctor
      const docName = selectedDocObj?.name
      const docRawName = selectedDocObj?.rawName

      paid = paid.filter(b => {
        if (b.doctorId && b.doctorId === docId) return true
        if (docName && b.doctorName === docName) return true
        if (docRawName && b.doctorName && b.doctorName.toLowerCase().includes(docRawName.toLowerCase())) return true
        return false
      })
    }

    switch (filterType) {
      case 'DAILY':
        if (startDate === endDate) {
          return paid.filter(b => b.visitDate === startDate)
        }
        return paid.filter(b => b.visitDate >= startDate && b.visitDate <= endDate)

      case 'MONTHLY':
        return paid.filter(b => {
          const d = new Date(b.visitDate)
          return d.getFullYear() === selectedYear && d.getMonth() + 1 === selectedMonth
        })

      case 'QUARTERLY':
        return paid.filter(b => {
          const d = new Date(b.visitDate)
          const quarter = Math.floor(d.getMonth() / 3) + 1
          return d.getFullYear() === selectedYear && quarter === selectedQuarter
        })

      case 'SEMESTER':
        return paid.filter(b => {
          const d = new Date(b.visitDate)
          const semester = d.getMonth() < 6 ? 1 : 2
          return d.getFullYear() === selectedYear && semester === selectedSemester
        })

      case 'YEARLY':
        return paid.filter(b => new Date(b.visitDate).getFullYear() === selectedYear)

      default:
        return paid
    }
  }, [billings, filterType, startDate, endDate, selectedMonth, selectedYear, selectedQuarter, selectedSemester, selectedDoctor])

  // Calculate KPIs
  const kpis = useMemo(() => {
    const total = filteredBillings.reduce((sum, b) => sum + (b.grandTotal || 0), 0)
    const totalServices = filteredBillings.reduce((sum, b) => sum + (b.subtotalServices || 0), 0)
    const totalPharmacy = filteredBillings.reduce((sum, b) => sum + (b.subtotalPharmacy || 0), 0)
    const totalPatients = filteredBillings.length
    const avgTransaction = totalPatients > 0 ? total / totalPatients : 0

    const paymentMethodBreakdown = {}
    filteredBillings.forEach(b => {
      const method = b.paymentMethod || 'TUNAI'
      paymentMethodBreakdown[method] = (paymentMethodBreakdown[method] || 0) + b.grandTotal
    })

    return {
      totalRevenue: total,
      totalServices,
      totalPharmacy,
      totalPatients,
      avgTransaction,
      paymentMethodBreakdown
    }
  }, [filteredBillings])

  // Trend data for charts
  const trendData = useMemo(() => {
    if (filterType === 'DAILY') {
      // Daily breakdown
      const dataMap = {}
      filteredBillings.forEach(b => {
        const date = b.visitDate
        if (!dataMap[date]) dataMap[date] = { date, revenue: 0, patients: 0 }
        dataMap[date].revenue += b.grandTotal
        dataMap[date].patients += 1
      })
      return Object.values(dataMap).sort((a, b) => a.date.localeCompare(b.date))
    } else if (filterType === 'MONTHLY') {
      // Daily breakdown within month
      const dataMap = {}
      filteredBillings.forEach(b => {
        const date = new Date(b.visitDate).getDate()
        if (!dataMap[date]) dataMap[date] = { day: date, revenue: 0, patients: 0 }
        dataMap[date].revenue += b.grandTotal
        dataMap[date].patients += 1
      })
      return Object.values(dataMap).sort((a, b) => a.day - b.day)
    } else if (filterType === 'QUARTERLY') {
      // Monthly breakdown within quarter
      const dataMap = {}
      filteredBillings.forEach(b => {
        const month = new Date(b.visitDate).getMonth() + 1
        if (!dataMap[month]) dataMap[month] = { month: MONTHS[month - 1], revenue: 0, patients: 0 }
        dataMap[month].revenue += b.grandTotal
        dataMap[month].patients += 1
      })
      return Object.values(dataMap).sort((a, b) => MONTHS.indexOf(a.month) - MONTHS.indexOf(b.month))
    } else if (filterType === 'SEMESTER') {
      // Monthly breakdown within semester
      const dataMap = {}
      filteredBillings.forEach(b => {
        const month = new Date(b.visitDate).getMonth() + 1
        if (!dataMap[month]) dataMap[month] = { month: MONTHS[month - 1], revenue: 0, patients: 0 }
        dataMap[month].revenue += b.grandTotal
        dataMap[month].patients += 1
      })
      return Object.values(dataMap).sort((a, b) => MONTHS.indexOf(a.month) - MONTHS.indexOf(b.month))
    } else {
      // Monthly breakdown for year
      const dataMap = {}
      MONTHS.forEach((m, idx) => {
        dataMap[idx + 1] = { month: m, revenue: 0, patients: 0 }
      })
      filteredBillings.forEach(b => {
        const month = new Date(b.visitDate).getMonth() + 1
        dataMap[month].revenue += b.grandTotal
        dataMap[month].patients += 1
      })
      return Object.values(dataMap)
    }
  }, [filteredBillings, filterType])

  // Payment method pie chart data
  const paymentMethodData = useMemo(() => {
    return Object.entries(kpis.paymentMethodBreakdown).map(([method, value]) => ({
      name: { TUNAI: 'Tunai', QRIS: 'QRIS', TRANSFER: 'Transfer', BPJS: 'BPJS', ASURANSI: 'Asuransi', MIXED: 'Mixed' }[method] || method,
      value
    }))
  }, [kpis.paymentMethodBreakdown])

  // Export to PDF
  const exportPDF = () => {
    const doc = new jsPDF()

    // Header
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('LAPORAN BILLING KASIR', 105, 15, { align: 'center' })

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(activeBranch?.entityName || 'Klinik Antigravity', 105, 22, { align: 'center' })

    // Filter info
    let periodText = ''
    if (filterType === 'DAILY') {
      periodText = startDate === endDate ? fmtDate(startDate) : `${fmtDate(startDate)} - ${fmtDate(endDate)}`
    } else if (filterType === 'MONTHLY') {
      periodText = `${MONTHS[selectedMonth - 1]} ${selectedYear}`
    } else if (filterType === 'QUARTERLY') {
      periodText = `${QUARTERS[selectedQuarter - 1]} ${selectedYear}`
    } else if (filterType === 'SEMESTER') {
      periodText = `${SEMESTERS[selectedSemester - 1]} ${selectedYear}`
    } else {
      periodText = `Tahun ${selectedYear}`
    }
    doc.text(`Periode: ${periodText}`, 105, 28, { align: 'center' })
    doc.text(`Tanggal Cetak: ${fmtDate(new Date())}`, 105, 33, { align: 'center' })

    // KPI Summary
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('RINGKASAN', 14, 42)

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(`Total Pendapatan: ${fmtIDR(kpis.totalRevenue)}`, 14, 48)
    doc.text(`Total Jasa Medis: ${fmtIDR(kpis.totalServices)}`, 14, 53)
    doc.text(`Total Farmasi: ${fmtIDR(kpis.totalPharmacy)}`, 14, 58)
    doc.text(`Total Pasien: ${kpis.totalPatients} transaksi`, 110, 48)
    doc.text(`Rata-rata/Transaksi: ${fmtIDR(kpis.avgTransaction)}`, 110, 53)

    // Table
    const tableData = filteredBillings.map(b => [
      b.billingNumber,
      fmtDate(b.visitDate),
      b.patientName,
      b.doctorName || '-',
      { TUNAI: 'Tunai', QRIS: 'QRIS', TRANSFER: 'Transfer', BPJS: 'BPJS', ASURANSI: 'Asuransi', MIXED: 'Mixed' }[b.paymentMethod] || b.paymentMethod,
      fmtIDR(b.grandTotal)
    ])

    doc.autoTable({
      startY: 65,
      head: [['No. Billing', 'Tanggal', 'Pasien', 'Dokter', 'Metode', 'Total']],
      body: tableData,
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 25 },
        2: { cellWidth: 35 },
        3: { cellWidth: 30 },
        4: { cellWidth: 25 },
        5: { cellWidth: 30, halign: 'right' }
      }
    })

    // Footer
    const pageCount = doc.internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setTextColor(150)
      doc.text(`Halaman ${i} dari ${pageCount}`, 105, 285, { align: 'center' })
      doc.text('Sistem Akuntansi Klinik Antigravity', 105, 290, { align: 'center' })
    }

    doc.save(`Laporan-Billing-${periodText.replace(/\s+/g, '-')}.pdf`)
    toast.success('Laporan PDF berhasil diunduh')
  }

  // Export to Excel
  const exportExcel = () => {
    const ws_data = [
      ['LAPORAN BILLING KASIR'],
      [activeBranch?.entityName || 'Klinik Antigravity'],
      [],
      ['Periode:', filterType === 'DAILY' ? (startDate === endDate ? fmtDate(startDate) : `${fmtDate(startDate)} - ${fmtDate(endDate)}`) : filterType === 'MONTHLY' ? `${MONTHS[selectedMonth - 1]} ${selectedYear}` : filterType === 'QUARTERLY' ? `${QUARTERS[selectedQuarter - 1]} ${selectedYear}` : filterType === 'SEMESTER' ? `${SEMESTERS[selectedSemester - 1]} ${selectedYear}` : `Tahun ${selectedYear}`],
      ['Tanggal Cetak:', fmtDate(new Date())],
      [],
      ['RINGKASAN'],
      ['Total Pendapatan', fmtIDR(kpis.totalRevenue)],
      ['Total Jasa Medis', fmtIDR(kpis.totalServices)],
      ['Total Farmasi', fmtIDR(kpis.totalPharmacy)],
      ['Total Pasien', `${kpis.totalPatients} transaksi`],
      ['Rata-rata/Transaksi', fmtIDR(kpis.avgTransaction)],
      [],
      ['DETAIL TRANSAKSI'],
      ['No. Billing', 'Tanggal', 'Pasien', 'No. MRN', 'Dokter', 'Metode Pembayaran', 'Subtotal Jasa', 'Subtotal Farmasi', 'Diskon', 'PPN', 'Grand Total']
    ]

    filteredBillings.forEach(b => {
      ws_data.push([
        b.billingNumber,
        fmtDate(b.visitDate),
        b.patientName,
        b.patientMRN || '-',
        b.doctorName || '-',
        { TUNAI: 'Tunai', QRIS: 'QRIS', TRANSFER: 'Transfer', BPJS: 'BPJS', ASURANSI: 'Asuransi', MIXED: 'Mixed' }[b.paymentMethod] || b.paymentMethod,
        b.subtotalServices || 0,
        b.subtotalPharmacy || 0,
        b.discountAmount || 0,
        b.ppnAmount || 0,
        b.grandTotal || 0
      ])
    })

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(ws_data)

    // Set column widths
    ws['!cols'] = [
      { wch: 20 }, { wch: 12 }, { wch: 25 }, { wch: 12 }, { wch: 25 },
      { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 15 }
    ]

    XLSX.utils.book_append_sheet(wb, ws, 'Laporan Billing')

    const periodText = filterType === 'DAILY' ? (startDate === endDate ? fmtDate(startDate) : `${fmtDate(startDate)}-${fmtDate(endDate)}`) : filterType === 'MONTHLY' ? `${MONTHS[selectedMonth - 1]}-${selectedYear}` : filterType === 'QUARTERLY' ? `Q${selectedQuarter}-${selectedYear}` : filterType === 'SEMESTER' ? `S${selectedSemester}-${selectedYear}` : `${selectedYear}`
    XLSX.writeFile(wb, `Laporan-Billing-${periodText}.xlsx`)
    toast.success('Laporan Excel berhasil diunduh')
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Laporan Billing Kasir</h1>
          <p className="text-sm text-slate-400 mt-0.5">Analisis transaksi billing dengan filter periode lengkap</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={exportPDF}>
            <FileText className="w-4 h-4" />PDF
          </button>
          <button className="btn-success" onClick={exportExcel}>
            <FileSpreadsheet className="w-4 h-4" />Excel
          </button>
        </div>
      </div>

      {/* Filter Section */}
      <div className="card card-body">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-primary-600" />
          <h3 className="font-semibold text-slate-700">Filter Periode</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div>
            <label className="form-label">Tipe Filter Periode</label>
            <select className="form-select" value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="DAILY">Harian</option>
              <option value="MONTHLY">Bulanan</option>
              <option value="QUARTERLY">Triwulanan</option>
              <option value="SEMESTER">Semesteran</option>
              <option value="YEARLY">Tahunan</option>
            </select>
          </div>

          <div>
            <label className="form-label">Dokter Penanggung Jawab</label>
            <select className="form-select font-medium" value={selectedDoctor} onChange={e => setSelectedDoctor(e.target.value)}>
              <option value="ALL">Semua Dokter</option>
              {doctorOptions.map(d => (
                <option key={d.value} value={d.value}>{d.label || d.name}</option>
              ))}
            </select>
          </div>

          {filterType === 'DAILY' && (
            <>
              <div>
                <label className="form-label">Tanggal Awal</label>
                <input type="date" className="form-input" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Tanggal Akhir</label>
                <input type="date" className="form-input" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
            </>
          )}

          {filterType === 'MONTHLY' && (
            <>
              <div>
                <label className="form-label">Bulan</label>
                <select className="form-select" value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}>
                  {MONTHS.map((m, idx) => <option key={idx} value={idx + 1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Tahun</label>
                <input type="number" className="form-input" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} />
              </div>
            </>
          )}

          {filterType === 'QUARTERLY' && (
            <>
              <div>
                <label className="form-label">Triwulan</label>
                <select className="form-select" value={selectedQuarter} onChange={e => setSelectedQuarter(Number(e.target.value))}>
                  {QUARTERS.map((q, idx) => <option key={idx} value={idx + 1}>{q}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Tahun</label>
                <input type="number" className="form-input" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} />
              </div>
            </>
          )}

          {filterType === 'SEMESTER' && (
            <>
              <div>
                <label className="form-label">Semester</label>
                <select className="form-select" value={selectedSemester} onChange={e => setSelectedSemester(Number(e.target.value))}>
                  {SEMESTERS.map((s, idx) => <option key={idx} value={idx + 1}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Tahun</label>
                <input type="number" className="form-input" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} />
              </div>
            </>
          )}

          {filterType === 'YEARLY' && (
            <div>
              <label className="form-label">Tahun</label>
              <input type="number" className="form-input" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} />
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Pendapatan"
          value={fmtIDR(kpis.totalRevenue)}
          icon={Wallet}
          trend={null}
          color="blue"
        />
        <KpiCard
          title="Total Jasa Medis"
          value={fmtIDR(kpis.totalServices)}
          icon={Activity}
          trend={null}
          color="green"
        />
        <KpiCard
          title="Total Farmasi"
          value={fmtIDR(kpis.totalPharmacy)}
          icon={ShoppingBag}
          trend={null}
          color="purple"
        />
        <KpiCard
          title="Total Pasien"
          value={kpis.totalPatients}
          subtitle={`Avg: ${fmtIDR(kpis.avgTransaction)}`}
          icon={Users}
          trend={null}
          color="orange"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Revenue Trend Chart */}
        <div className="card card-body">
          <h3 className="font-semibold text-slate-700 mb-4">Tren Pendapatan</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey={filterType === 'MONTHLY' ? 'day' : filterType === 'DAILY' ? 'date' : 'month'} tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(val) => fmtIDR(val).replace(/Rp\s?/, '')} />
              <Tooltip formatter={(val) => fmtIDR(val)} />
              <Legend />
              <Line type="monotone" dataKey="revenue" name="Pendapatan" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Patient Count Chart */}
        <div className="card card-body">
          <h3 className="font-semibold text-slate-700 mb-4">Jumlah Pasien</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey={filterType === 'MONTHLY' ? 'day' : filterType === 'DAILY' ? 'date' : 'month'} tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="patients" name="Jumlah Pasien" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Payment Method Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card card-body">
          <h3 className="font-semibold text-slate-700 mb-4">Metode Pembayaran</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={paymentMethodData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {paymentMethodData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(val) => fmtIDR(val)} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card card-body">
          <h3 className="font-semibold text-slate-700 mb-4">Detail Metode Pembayaran</h3>
          <div className="space-y-3">
            {paymentMethodData.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                  <span className="text-sm font-medium text-slate-700">{item.name}</span>
                </div>
                <span className="text-sm font-bold text-slate-900">{fmtIDR(item.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Transaction Table */}
      <div className="card">
        <div className="card-body border-b border-slate-100">
          <h3 className="font-semibold text-slate-700">Detail Transaksi ({filteredBillings.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>No. Billing</th>
                <th>Tanggal</th>
                <th>Pasien</th>
                <th>Dokter</th>
                <th>Metode</th>
                <th className="text-right">Jasa Medis</th>
                <th className="text-right">Farmasi</th>
                <th className="text-right">Grand Total</th>
                <th className="text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredBillings.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-400">
                    Tidak ada transaksi pada periode yang dipilih
                  </td>
                </tr>
              ) : (
                filteredBillings.map(b => (
                  <tr key={b.id}>
                    <td className="font-mono text-xs text-primary-700">{b.billingNumber}</td>
                    <td className="text-sm">{fmtDate(b.visitDate)}</td>
                    <td className="font-medium text-sm">{b.patientName}</td>
                    <td className="text-sm text-slate-500">{b.doctorName || '—'}</td>
                    <td>
                      <span className="badge badge-blue text-xs">
                        {{ TUNAI: 'Tunai', QRIS: 'QRIS', TRANSFER: 'Transfer', BPJS: 'BPJS', ASURANSI: 'Asuransi', MIXED: 'Mixed' }[b.paymentMethod] || b.paymentMethod}
                      </span>
                    </td>
                    <td className="text-right font-mono text-sm">{fmtIDR(b.subtotalServices || 0)}</td>
                    <td className="text-right font-mono text-sm">{fmtIDR(b.subtotalPharmacy || 0)}</td>
                    <td className="text-right font-mono text-sm font-bold text-primary-700">{fmtIDR(b.grandTotal)}</td>
                    <td className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          className="p-1.5 text-slate-500 hover:text-primary-600 rounded hover:bg-slate-100 transition-colors"
                          title="Lihat Detail Transaksi"
                          onClick={() => { setSelectedBilling(b); setModal('detail') }}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          className="p-1.5 text-slate-500 hover:text-emerald-600 rounded hover:bg-slate-100 transition-colors"
                          title="Cetak PDF Nota"
                          onClick={() => {
                            const items = effectiveBillingItems.filter(i => i.billingId === b.id || i.billing_id === b.id)
                            exportBillingReceiptPDF(b, items)
                            toast.success(`Nota ${b.billingNumber} berhasil dicetak.`)
                          }}
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filteredBillings.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 font-semibold">
                  <td colSpan={5} className="text-right pr-4">TOTAL</td>
                  <td className="text-right font-mono">{fmtIDR(kpis.totalServices)}</td>
                  <td className="text-right font-mono">{fmtIDR(kpis.totalPharmacy)}</td>
                  <td className="text-right font-mono text-primary-700">{fmtIDR(kpis.totalRevenue)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ── View Detail Billing Modal ──────────────────────────── */}
      <Modal open={modal === 'detail'} onClose={() => setModal(null)} title={`Detail Billing — ${selectedBilling?.billingNumber}`} size="lg">
        {selectedBilling && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div><span className="text-slate-500">Pasien:</span><strong className="ml-2">{selectedBilling.patientName}</strong></div>
              <div><span className="text-slate-500">Tanggal Visit:</span><span className="ml-2">{fmtDate(selectedBilling.visitDate)}</span></div>
              <div><span className="text-slate-500">Dokter:</span><span className="ml-2">{selectedBilling.doctorName || '—'}</span></div>
              <div><span className="text-slate-500">Metode Bayar:</span><span className="ml-2">{paymentMethodLabel(selectedBilling.paymentMethod)}</span></div>
              <div><span className="text-slate-500">Grand Total:</span><span className="ml-2 font-bold font-mono text-primary-700">{fmtIDR(selectedBilling.grandTotal)}</span></div>
              <div><span className="text-slate-500">Status:</span><StatusBadge status={selectedBilling.status || 'PAID'} /></div>
            </div>

            <table className="table-base border border-slate-200 rounded-xl overflow-hidden">
              <thead>
                <tr>
                  <th>Item / Layanan</th>
                  <th>Tipe</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Harga Satuan</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {effectiveBillingItems.filter(i => i.billingId === selectedBilling.id || i.billing_id === selectedBilling.id).length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-4 text-slate-400 text-sm">Tidak ada rincian item</td></tr>
                ) : (
                  effectiveBillingItems.filter(i => i.billingId === selectedBilling.id || i.billing_id === selectedBilling.id).map(i => (
                    <tr key={i.id}>
                      <td className="text-sm">{i.itemName || i.item_name}</td>
                      <td>
                        <span className={`badge text-xs ${i.itemType === 'SERVICE' ? 'badge-blue' : i.itemType === 'LAB' ? 'badge-purple' : 'badge-green'}`}>
                          {i.itemType === 'SERVICE' ? 'Jasa Medis' : i.itemType === 'LAB' ? 'Laboratorium' : 'Farmasi'}
                        </span>
                      </td>
                      <td className="text-right text-sm">{i.quantity}</td>
                      <td className="text-right font-mono text-sm">{fmtIDR(i.unitPrice || i.unit_price)}</td>
                      <td className="text-right font-mono text-sm font-bold">{fmtIDR(i.totalPrice || i.total_price || (i.quantity * i.unitPrice))}</td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-semibold">
                  <td colSpan={4} className="text-right pr-4">Grand Total</td>
                  <td className="text-right font-mono text-primary-700">{fmtIDR(selectedBilling.grandTotal)}</td>
                </tr>
              </tfoot>
            </table>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                className="btn-primary flex items-center gap-2"
                onClick={() => {
                  const items = effectiveBillingItems.filter(i => i.billingId === selectedBilling.id || i.billing_id === selectedBilling.id)
                  exportBillingReceiptPDF(selectedBilling, items)
                  toast.success(`Nota ${selectedBilling.billingNumber} berhasil dicetak.`)
                }}
              >
                <Printer className="w-4 h-4" />Cetak Nota PDF
              </button>
              <button type="button" className="btn-secondary" onClick={() => setModal(null)}>Tutup</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
