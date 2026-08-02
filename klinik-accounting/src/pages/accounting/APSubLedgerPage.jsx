import { useState, useMemo, useEffect } from 'react'
import { FileText, Download, Building2, Filter, ArrowUpRight, ArrowDownLeft, CheckCircle, Clock, Calendar } from 'lucide-react'
import { useStore } from '../../store/useStore'
import SearchInput from '../../components/ui/SearchInput'
import SearchableSelect from '../../components/ui/SearchableSelect'
import { fmtIDR, fmtDate, monthStart, monthEnd } from '../../utils/format'
import { fetchBatches, fetchExpenses } from '../../lib/db'
import { exportAPLedgerReportPDF } from '../../utils/exportPDF'

export default function APSubLedgerPage() {
    const { vendors, invBatches, expenses, journalEntries, journalItems, branches, activeBranchId, appSettings } = useStore()

    const [dateFrom, setDateFrom] = useState(monthStart())
    const [dateTo, setDateTo] = useState(monthEnd())
    const [vendorFilter, setVendorFilter] = useState('ALL')
    const [branchFilter, setBranchFilter] = useState(activeBranchId || 'ALL')
    const [search, setSearch] = useState('')
    const [activeTab, setActiveTab] = useState('rekap') // 'rekap' | 'detail'

    const [dbBatches, setDbBatches] = useState([])
    const [dbExpenses, setDbExpenses] = useState([])
    const [loading, setLoading] = useState(true)

    // Fetch live batches and expenses from database
    useEffect(() => {
        let isMounted = true
        const loadLiveData = async () => {
            setLoading(true)
            try {
                const [bData, eData] = await Promise.all([
                    fetchBatches().catch(() => []),
                    fetchExpenses().catch(() => [])
                ])
                if (isMounted) {
                    setDbBatches(Array.isArray(bData) && bData.length > 0 ? bData : (invBatches || []))
                    setDbExpenses(Array.isArray(eData) && eData.length > 0 ? eData : (expenses || []))
                }
            } catch (err) {
                console.warn('[APSubLedgerPage] Error loading DB:', err.message)
            } finally {
                if (isMounted) setLoading(false)
            }
        }
        loadLiveData()
        return () => { isMounted = false }
    }, [invBatches, expenses])

    const effectiveBatches = useMemo(() => {
        const map = new Map()
            ; (dbBatches || []).forEach(b => { if (b.id) map.set(b.id, b) })
            ; (invBatches || []).forEach(b => { if (b.id) map.set(b.id, b) })
        return Array.from(map.values())
    }, [dbBatches, invBatches])

    const effectiveExpenses = useMemo(() => {
        const map = new Map()
            ; (dbExpenses || []).forEach(e => {
                const key = e.id || e.expenseNumber
                if (key) map.set(key, e)
            })
            ; (expenses || []).forEach(e => {
                const key = e.id || e.expenseNumber
                if (key) map.set(key, e)
            })
        return Array.from(map.values())
    }, [dbExpenses, expenses])

    // Options for Vendor select dropdown
    const vendorSelectOptions = useMemo(() => {
        const opts = [{ value: 'ALL', label: 'Semua Vendor / Supplier' }]
            ; (vendors || []).forEach(v => {
                if (v.isActive !== false) {
                    opts.push({ value: v.name, label: `${v.code || 'VND'} — ${v.name}` })
                }
            })
        return opts
    }, [vendors])

    const isSaldoAwalBatch = (b) => {
        const grnRef = (b.grnReference || b.grn_reference || '').toUpperCase()
        const batchNo = (b.batchNumber || b.batch_number || '').toUpperCase()
        const suppName = (b.supplierName || b.supplier_name || '').toLowerCase()
        return grnRef === 'SALDO-AWAL' || batchNo === 'SALDO-AWAL' || suppName.includes('saldo awal')
    }

    // Consolidated AP payments from Expenses and Posted Journal Entries (Account 2-11-001)
    const allExpensePayments = useMemo(() => {
        const map = new Map()

            // 1. From Expenses
            ; (effectiveExpenses || []).forEach(e => {
                if (e.status !== 'VOID' && e.vendorName && Number(e.grossAmount || 0) > 0) {
                    const key = e.expenseNumber || e.id
                    const invNoStr = Array.isArray(e.selectedGrnRefs)
                        ? e.selectedGrnRefs.join(', ')
                        : (e.selectedGrnRefs || '—')
                    map.set(key, {
                        id: e.id || key,
                        date: e.expenseDate,
                        timestamp: e.createdAt || e.created_at || e.expenseDate,
                        refNo: e.expenseNumber || key,
                        invoiceNo: invNoStr || '—',
                        vendorName: e.vendorName,
                        description: e.description || `Pelunasan Utang via ${e.paymentMethod}`,
                        debit: Number(e.grossAmount || 0),
                        credit: 0,
                    })
                }
            })

            // 2. From Posted Journal Entries (debiting Utang Usaha / Utang Pembelian 2-11-001)
            ; (journalEntries || []).forEach(j => {
                if (j.status === 'POSTED') {
                    const items = (journalItems || []).filter(ji => ji.journalEntryId === j.id)
                    const apDebitItem = items.find(ji => ji.accountCode === '2-11-001' && Number(ji.debit || 0) > 0)

                    if (apDebitItem) {
                        const key = j.entryNumber || j.id
                        if (!map.has(key)) {
                            let vName = j.vendorName || ''

                            // Extract vendor name from credit item description e.g. "Kas Besar (1-11-002) — AFINA SINAR CEMERLANG"
                            const creditItem = items.find(ji => Number(ji.credit || 0) > 0)
                            if (!vName && creditItem && creditItem.description && creditItem.description.includes('—')) {
                                const parts = creditItem.description.split('—')
                                vName = parts[parts.length - 1].trim()
                            }

                            // Match against known vendors list if needed
                            if (!vName && vendors) {
                                const matchV = vendors.find(v =>
                                    (j.description || '').toLowerCase().includes(v.name.toLowerCase()) ||
                                    (apDebitItem.description || '').toLowerCase().includes(v.name.toLowerCase())
                                )
                                if (matchV) vName = matchV.name
                            }

                            let invNo = '—'
                            const matchGrn = (j.description || apDebitItem.description || '').match(/GRN\/[A-Z0-9\/]+/i)
                            if (matchGrn) invNo = matchGrn[0]

                            map.set(key, {
                                id: j.id || key,
                                date: j.transactionDate,
                                timestamp: j.createdAt || j.created_at || j.transactionDate,
                                refNo: j.entryNumber || key,
                                invoiceNo: invNo,
                                vendorName: vName || 'Vendor Rekanan',
                                description: j.description || apDebitItem.description || 'Pelunasan Utang PBF',
                                debit: Number(apDebitItem.debit || 0),
                                credit: 0,
                            })
                        }
                    }
                }
            })

        return Array.from(map.values())
    }, [effectiveExpenses, journalEntries, journalItems, vendors])

    // Process Accounts Payable Data per Vendor
    const vendorSummaryMap = useMemo(() => {
        const map = {}

            // Initialize map with known vendors
            ; (vendors || []).forEach(v => {
                map[v.name.toLowerCase().trim()] = {
                    code: v.code || 'VND',
                    name: v.name,
                    phone: v.phone || '—',
                    totalGRN: 0,
                    totalPaid: 0,
                    unpaid: 0,
                    grnRefs: new Set(),
                }
            })

        // Process GRN Purchases (Credit to Utang Usaha) — Skip Saldo Awal
        effectiveBatches.forEach(b => {
            if (isSaldoAwalBatch(b)) return
            const sName = b.supplierName || b.supplier_name || 'Vendor Lain'
            const key = sName.toLowerCase().trim()
            if (!map[key]) {
                map[key] = {
                    code: 'VND-MISC',
                    name: sName,
                    phone: '—',
                    totalGRN: 0,
                    totalPaid: 0,
                    unpaid: 0,
                    grnRefs: new Set(),
                }
            }

            const qty = Number(b.quantityReceived ?? b.quantity_received ?? 0)
            const cost = Number(b.unitCostPrice ?? b.unit_cost_price ?? 0)
            const lineVal = qty * cost
            map[key].totalGRN += lineVal

            const grnRef = b.grnReference || b.grn_reference
            if (grnRef) map[key].grnRefs.add(grnRef)
        })

        // Process Expense & Journal Payments (Debit to Utang Usaha)
        allExpensePayments.forEach(e => {
            if (!e.vendorName) return
            const key = e.vendorName.toLowerCase().trim()
            if (!map[key]) {
                map[key] = {
                    code: 'VND-MISC',
                    name: e.vendorName,
                    phone: '—',
                    totalGRN: 0,
                    totalPaid: 0,
                    unpaid: 0,
                    grnRefs: new Set(),
                }
            }
            map[key].totalPaid += e.debit
        })

        // Calculate remaining unpaid balance
        Object.keys(map).forEach(k => {
            map[k].totalGRN = Math.round(map[k].totalGRN)
            map[k].totalPaid = Math.round(map[k].totalPaid)
            map[k].unpaid = Math.max(0, map[k].totalGRN - map[k].totalPaid)
        })

        return map
    }, [vendors, effectiveBatches, allExpensePayments])

    const vendorSummaryList = useMemo(() => {
        return Object.values(vendorSummaryMap)
            .filter(v => vendorFilter === 'ALL' || v.name.toLowerCase().trim() === vendorFilter.toLowerCase().trim())
            .filter(v => !search || v.name.toLowerCase().includes(search.toLowerCase()) || v.code.toLowerCase().includes(search.toLowerCase()))
            .sort((a, b) => b.unpaid - a.unpaid)
    }, [vendorSummaryMap, vendorFilter, search])

    // Generate detailed ledger transactions (Chronological: oldest to newest / "kebawah yang terbaru ke bawah")
    const detailTransactions = useMemo(() => {
        const list = []

        // 1. Add GRN transactions (Kredit: Penambahan Utang) — Skip Saldo Awal
        const grnGroup = {}
        effectiveBatches.forEach(b => {
            if (isSaldoAwalBatch(b)) return
            const ref = b.grnReference || b.grn_reference || 'GRN-UNKNOWN'
            const sName = b.supplierName || b.supplier_name || 'Vendor Lain'
            if (!grnGroup[ref]) {
                grnGroup[ref] = {
                    id: ref,
                    date: b.receivedAt || b.received_at || b.createdAt,
                    timestamp: b.createdAt || b.created_at || b.receivedAt || b.received_at,
                    refNo: ref,
                    invoiceNo: ref,
                    vendorName: sName,
                    description: `Penerimaan Barang (GRN): ${ref}`,
                    debit: 0,
                    credit: 0,
                }
            }
            const qty = Number(b.quantityReceived ?? b.quantity_received ?? 0)
            const cost = Number(b.unitCostPrice ?? b.unit_cost_price ?? 0)
            grnGroup[ref].credit += qty * cost
        })

        Object.values(grnGroup).forEach(g => list.push(g))

        // 2. Add Expense transactions (Debet: Pelunasan Utang)
        allExpensePayments.forEach(e => {
            list.push(e)
        })

        // Sort chronologically by recorded timestamp / date (oldest top, newest bottom)
        list.sort((a, b) => {
            const timeA = new Date(a.timestamp || a.date).getTime()
            const timeB = new Date(b.timestamp || b.date).getTime()
            if (timeA !== timeB) return timeA - timeB

            // Tie-breaker: GRN (credit) comes before Expense (debit) on identical timestamp/date
            if (a.credit > 0 && b.debit > 0) return -1
            if (a.debit > 0 && b.credit > 0) return 1

            return (a.refNo || '').localeCompare(b.refNo || '')
        })

        // Calculate running balance per vendor
        const vendorRunning = {}
        const result = []

        list.forEach(t => {
            const vKey = t.vendorName.toLowerCase().trim()
            if (vendorRunning[vKey] === undefined) vendorRunning[vKey] = 0

            // Accumulate per-vendor running balance
            vendorRunning[vKey] += (t.credit - t.debit)

            // Filter vendor
            if (vendorFilter !== 'ALL' && vKey !== vendorFilter.toLowerCase().trim()) return

            // Filter date range
            if (dateFrom && t.date < dateFrom) return
            if (dateTo && t.date > dateTo) return

            // Filter text search
            if (search &&
                !t.vendorName.toLowerCase().includes(search.toLowerCase()) &&
                !t.refNo.toLowerCase().includes(search.toLowerCase()) &&
                !t.description.toLowerCase().includes(search.toLowerCase())) return

            result.push({
                ...t,
                balance: vendorRunning[vKey],
            })
        })

        return result
    }, [effectiveBatches, effectiveExpenses, vendorFilter, dateFrom, dateTo, search])

    // Summary Metrics
    const summaryMetrics = useMemo(() => {
        const allVendors = Object.values(vendorSummaryMap)
        const filteredVendors = vendorFilter === 'ALL' ? allVendors : allVendors.filter(v => v.name.toLowerCase().trim() === vendorFilter.toLowerCase().trim())

        const totalDebt = filteredVendors.reduce((s, v) => s + v.totalGRN, 0)
        const paidDebt = filteredVendors.reduce((s, v) => s + v.totalPaid, 0)
        const unpaidDebt = filteredVendors.reduce((s, v) => s + v.unpaid, 0)
        const activeVendorsCount = filteredVendors.filter(v => v.totalGRN > 0 || v.totalPaid > 0).length

        return {
            totalDebt,
            paidDebt,
            unpaidDebt,
            activeVendorsCount,
        }
    }, [vendorSummaryMap, vendorFilter])

    // Download PDF Report Handler
    const handleExportPDF = () => {
        const activeBranchName = (branches || []).find(b => b.id === activeBranchId)?.name || 'Utama'
        const periodLabel = dateFrom && dateTo ? `${fmtDate(dateFrom)} s/d ${fmtDate(dateTo)}` : 'Semua Periode'

        exportAPLedgerReportPDF({
            summaryData: summaryMetrics,
            vendorSummaryList,
            detailTransactions,
            vendorFilter: vendorFilter === 'ALL' ? 'Semua Vendor' : vendorFilter,
            periodLabel,
            branchName: activeBranchName,
            appSettings,
        })
    }

    return (
        <div className="space-y-6">
            {/* Page Title & Subtitle */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="page-title">Buku Pembantu Utang (Accounts Payable)</h1>
                    <p className="text-sm text-slate-500 mt-0.5">
                        Daftar rincian utang usaha per vendor, saldo transaksi penerimaan barang (GRN), dan pelunasan pengeluaran.
                    </p>
                </div>
                {/* Solid Red Unduh Laporan Button */}
                <button
                    onClick={handleExportPDF}
                    className="btn-danger-red font-bold px-4 py-2.5 rounded-xl shadow-md flex items-center gap-2 transition-all hover:brightness-110 active:scale-95"
                >
                    <Download className="w-4 h-4" />
                    <span>Unduh Laporan</span>
                </button>
            </div>

            {/* Solid Color KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-sans">
                {/* Card 1: Total Utang Usaha (Solid Red) */}
                <div className="rounded-xl p-4 shadow-sm" style={{ background: '#DC2626' }}>
                    <div className="flex items-center justify-between">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-red-100">Total Pembelian</p>
                        <Building2 className="w-4 h-4 text-red-200" />
                    </div>
                    <p className="font-extrabold text-2xl text-white tracking-tight mt-1">
                        {fmtIDR(summaryMetrics.totalDebt)}
                    </p>
                    <p className="text-xs text-red-100 mt-1 font-medium">Akumulasi Pembelian Supplier</p>
                </div>

                {/* Card 2: Sisa Utang Belum Lunas (Solid Amber) */}
                <div className="rounded-xl p-4 shadow-sm" style={{ background: '#D97706' }}>
                    <div className="flex items-center justify-between">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-amber-100">Utang Belum Lunas</p>
                        <Clock className="w-4 h-4 text-amber-200" />
                    </div>
                    <p className="font-extrabold text-2xl text-white tracking-tight mt-1">
                        {fmtIDR(summaryMetrics.unpaidDebt)}
                    </p>
                    <p className="text-xs text-amber-100 mt-1 font-medium">Kewajiban Jatuh Tempo</p>
                </div>

                {/* Card 3: Total Pelunasan Utang (Solid Emerald) */}
                <div className="rounded-xl p-4 shadow-sm" style={{ background: '#059669' }}>
                    <div className="flex items-center justify-between">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-100">Total Pelunasan Utang</p>
                        <CheckCircle className="w-4 h-4 text-emerald-200" />
                    </div>
                    <p className="font-extrabold text-2xl text-white tracking-tight mt-1">
                        {fmtIDR(summaryMetrics.paidDebt)}
                    </p>
                    <p className="text-xs text-emerald-100 mt-1 font-medium">Terbayar via Expense</p>
                </div>

                {/* Card 4: Vendor Aktif dengan Utang (Solid Blue) */}
                <div className="rounded-xl p-4 shadow-sm" style={{ background: '#2563EB' }}>
                    <div className="flex items-center justify-between">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-blue-100">Vendor Supplier Aktif</p>
                        <Building2 className="w-4 h-4 text-blue-200" />
                    </div>
                    <p className="font-extrabold text-2xl text-white tracking-tight mt-1">
                        {summaryMetrics.activeVendorsCount} <span className="text-xs font-semibold text-blue-200">Supplier</span>
                    </p>
                    <p className="text-xs text-blue-100 mt-1 font-medium">Vendor Rekanan Terdaftar</p>
                </div>
            </div>

            {/* Filter Bar & Controls */}
            <div className="card card-body space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                    {/* Vendor Searchable Select Filter */}
                    <div className="w-64">
                        <label className="form-label text-[11px]">Filter Vendor / Supplier</label>
                        <SearchableSelect
                            value={vendorFilter}
                            onChange={setVendorFilter}
                            options={vendorSelectOptions}
                            placeholder="— Pilih Vendor —"
                        />
                    </div>

                    {/* Date Range */}
                    <div>
                        <label className="form-label text-[11px]">Dari Tanggal</label>
                        <input
                            type="date"
                            className="form-input py-1.5 text-xs font-medium"
                            value={dateFrom}
                            onChange={e => setDateFrom(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="form-label text-[11px]">Sampai Tanggal</label>
                        <input
                            type="date"
                            className="form-input py-1.5 text-xs font-medium"
                            value={dateTo}
                            onChange={e => setDateTo(e.target.value)}
                        />
                    </div>

                    {/* Text Search */}
                    <div className="w-48 ml-auto self-end">
                        <SearchInput
                            value={search}
                            onChange={setSearch}
                            placeholder="Cari vendor, no. ref..."
                        />
                    </div>
                </div>
            </div>

            {/* Tab Selector */}
            <div className="flex border-b border-slate-200">
                <button
                    onClick={() => setActiveTab('rekap')}
                    className={`px-5 py-3 text-xs font-bold transition-colors border-b-2 ${activeTab === 'rekap' ? 'border-primary-600 text-primary-700 bg-primary-50/50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    Rekapitulasi Utang Per Vendor ({vendorSummaryList.length})
                </button>
                <button
                    onClick={() => setActiveTab('detail')}
                    className={`px-5 py-3 text-xs font-bold transition-colors border-b-2 ${activeTab === 'detail' ? 'border-primary-600 text-primary-700 bg-primary-50/50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    Rincian Transaksi Ledger ({detailTransactions.length})
                </button>
            </div>

            {/* Tab Content 1: Rekapitulasi Utang Per Vendor */}
            {activeTab === 'rekap' && (
                <div className="card">
                    <div className="overflow-x-auto">
                        <table className="table-base">
                            <thead>
                                <tr>
                                    <th>No</th>
                                    <th>Kode</th>
                                    <th>Nama Vendor / Supplier</th>
                                    <th className="text-right">Total Pembelian (GRN)</th>
                                    <th className="text-right">Total Pelunasan</th>
                                    <th className="text-right">Sisa Utang (Rp)</th>
                                    <th className="text-center">Status</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {vendorSummaryList.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="text-center py-12 text-slate-400">
                                            Tidak ada data utang vendor yang sesuai filter.
                                        </td>
                                    </tr>
                                ) : (
                                    vendorSummaryList.map((v, i) => (
                                        <tr key={v.name + i}>
                                            <td className="text-center text-xs text-slate-400 font-mono">{i + 1}</td>
                                            <td className="font-mono text-xs text-slate-600 font-semibold">{v.code}</td>
                                            <td className="font-bold text-slate-900 text-sm">{v.name}</td>
                                            <td className="text-right font-mono text-sm">{fmtIDR(v.totalGRN)}</td>
                                            <td className="text-right font-mono text-sm text-emerald-600">{fmtIDR(v.totalPaid)}</td>
                                            <td className="text-right font-mono text-sm font-extrabold text-red-600">{fmtIDR(v.unpaid)}</td>
                                            <td className="text-center">
                                                {v.unpaid > 0 ? (
                                                    <span className="badge badge-red">Belum Lunas</span>
                                                ) : (
                                                    <span className="badge badge-green">Lunas</span>
                                                )}
                                            </td>
                                            <td>
                                                <button
                                                    onClick={() => {
                                                        setVendorFilter(v.name)
                                                        setActiveTab('detail')
                                                    }}
                                                    className="btn-ghost text-xs text-primary-700 font-bold hover:underline"
                                                >
                                                    Lihat Detail Ledger →
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            {vendorSummaryList.length > 0 && (
                                <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                                    <tr>
                                        <td colSpan={3} className="px-4 py-3 text-right">TOTAL REKAPITULASI UTANG:</td>
                                        <td className="px-4 py-3 text-right font-mono">{fmtIDR(summaryMetrics.totalDebt)}</td>
                                        <td className="px-4 py-3 text-right font-mono text-emerald-600">{fmtIDR(summaryMetrics.paidDebt)}</td>
                                        <td className="px-4 py-3 text-right font-mono text-red-600">{fmtIDR(summaryMetrics.unpaidDebt)}</td>
                                        <td colSpan={2}></td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>
            )}

            {/* Tab Content 2: Detail Transaksi Ledger */}
            {activeTab === 'detail' && (
                <div className="card">
                    <div className="overflow-x-auto">
                        <table className="table-base">
                            <thead>
                                <tr>
                                    <th>Tanggal</th>
                                    <th>No. Referensi</th>
                                    <th>No. Faktur</th>
                                    <th>Vendor / Supplier</th>
                                    <th>Keterangan</th>
                                    <th className="text-right">Debet (Pelunasan)</th>
                                    <th className="text-right">Kredit (GRN)</th>
                                    <th className="text-right">Saldo Utang (Rp)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {detailTransactions.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="text-center py-12 text-slate-400">
                                            Belum ada rincian transaksi buku pembantu utang.
                                        </td>
                                    </tr>
                                ) : (
                                    detailTransactions.map((t, i) => (
                                        <tr key={t.id + i}>
                                            <td className="text-xs text-slate-600 whitespace-nowrap">{fmtDate(t.date)}</td>
                                            <td className="font-mono text-xs text-primary-700 font-semibold">{t.refNo}</td>
                                            <td className="font-mono text-xs text-slate-500">{t.invoiceNo}</td>
                                            <td className="font-bold text-slate-800 text-xs">{t.vendorName}</td>
                                            <td className="max-w-[220px] truncate text-xs text-slate-600">{t.description}</td>
                                            <td className="text-right font-mono text-xs text-emerald-600 font-medium">
                                                {t.debit > 0 ? fmtIDR(t.debit) : '—'}
                                            </td>
                                            <td className="text-right font-mono text-xs text-red-600 font-medium">
                                                {t.credit > 0 ? fmtIDR(t.credit) : '—'}
                                            </td>
                                            <td className="text-right font-mono text-xs font-bold text-slate-900">
                                                {fmtIDR(t.balance)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}
