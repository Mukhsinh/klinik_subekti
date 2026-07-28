import { useMemo } from 'react'
import { useStore } from '../store/useStore'
import KpiCard from '../components/ui/KpiCard'
import { fmtIDR, fmtDate, monthStart, monthEnd, todayISO } from '../utils/format'
import { StatusBadge } from '../components/ui/Badge'
import {
  TrendingUp, Wallet, Package, AlertTriangle,
  FileText, ShoppingCart, Activity, Clock
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts'

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des']

export default function Dashboard() {
  const { journalEntries, journalItems, coa, billings, expenses, invBatches, pharmacyItems, activeBranchId } = useStore()

  const today = todayISO()
  const mStart = monthStart()
  const mEnd = monthEnd()

  // ── Revenue this month ─────────────────────────────────────
  const revenueCodes = useMemo(() => new Set(coa.filter(a => a.accountType === 'REVENUE' && !a.isHeader).map(a => a.accountCode)), [coa])
  const expenseCodes = useMemo(() => new Set(coa.filter(a => a.accountType === 'EXPENSE' && !a.isHeader).map(a => a.accountCode)), [coa])

  const postedEntries = useMemo(() =>
    journalEntries.filter(j => j.status === 'POSTED' && (activeBranchId ? j.branchId === activeBranchId : true)),
    [journalEntries, activeBranchId])

  const thisMonthEntryIds = useMemo(() =>
    new Set(postedEntries.filter(j => j.transactionDate >= mStart && j.transactionDate <= mEnd).map(j => j.id)),
    [postedEntries, mStart, mEnd])

  const thisMonthItems = useMemo(() =>
    journalItems.filter(i => thisMonthEntryIds.has(i.journalEntryId)),
    [journalItems, thisMonthEntryIds])

  const totalRevenue = useMemo(() => thisMonthItems.filter(i => revenueCodes.has(i.accountCode)).reduce((s, i) => s + parseFloat(i.credit || 0), 0), [thisMonthItems, revenueCodes])
  const totalExpense = useMemo(() => thisMonthItems.filter(i => expenseCodes.has(i.accountCode)).reduce((s, i) => s + parseFloat(i.debit || 0), 0), [thisMonthItems, expenseCodes])
  const netProfit = totalRevenue - totalExpense

  // ── Billing stats ──────────────────────────────────────────
  const todayBillings = billings.filter(b => b.visitDate === today && b.status === 'PAID')
  const todayRevenue = todayBillings.reduce((s, b) => s + parseFloat(b.grandTotal || 0), 0)
  const pendingBilling = billings.filter(b => b.status === 'DRAFT').length

  // ── Stock alerts ───────────────────────────────────────────
  const criticalStock = useMemo(() => {
    return pharmacyItems.filter(item => {
      const qty = invBatches.filter(b => b.itemId === item.id && b.quantityCurrent > 0).reduce((s, b) => s + b.quantityCurrent, 0)
      return qty <= (item.minSafetyStock || 50)
    })
  }, [pharmacyItems, invBatches])

  // Expiring soon (≤ 90 days)
  const expiringBatches = useMemo(() => {
    const limit = new Date(); limit.setDate(limit.getDate() + 90)
    return invBatches.filter(b => b.quantityCurrent > 0 && new Date(b.expiryDate) <= limit)
  }, [invBatches])

  // ── Monthly trend chart (last 6 months) ───────────────────
  const trendData = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
      const ms = d.toISOString().split('T')[0]
      const me = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0]
      const ids = new Set(postedEntries.filter(j => j.transactionDate >= ms && j.transactionDate <= me).map(j => j.id))
      const its = journalItems.filter(x => ids.has(x.journalEntryId))
      const rev = its.filter(x => revenueCodes.has(x.accountCode)).reduce((s, x) => s + parseFloat(x.credit || 0), 0)
      const exp = its.filter(x => expenseCodes.has(x.accountCode)).reduce((s, x) => s + parseFloat(x.debit || 0), 0)
      return { name: MONTH_NAMES[d.getMonth()], Pendapatan: Math.round(rev / 1000), Beban: Math.round(exp / 1000), Laba: Math.round((rev - exp) / 1000) }
    })
  }, [postedEntries, journalItems, revenueCodes, expenseCodes])

  // ── Recent journals ────────────────────────────────────────
  const recentJournals = useMemo(() =>
    [...journalEntries].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 8),
    [journalEntries])

  const fmtK = v => `Rp ${(v / 1000).toFixed(0)}rb`

  return (
    <div className="space-y-6">
      {/* Page title */}
      <div>
        <h1 className="page-title">Dashboard</h1>
        <p className="text-sm text-slate-400 mt-0.5">{fmtDate(today)} — Ikhtisar keuangan klinik hari ini</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Pendapatan Bulan Ini" value={fmtIDR(totalRevenue)} sub="Seluruh cabang" icon={TrendingUp} color="green" />
        <KpiCard title="Beban Bulan Ini" value={fmtIDR(totalExpense)} sub="Total operasional" icon={Wallet} color="amber" />
        <KpiCard title="Laba Bersih Bulan Ini" value={fmtIDR(netProfit)} sub={netProfit >= 0 ? 'Surplus' : 'Defisit'} icon={Activity} color={netProfit >= 0 ? 'teal' : 'red'} />
        <KpiCard title="Transaksi Kasir Hari Ini" value={fmtIDR(todayRevenue)} sub={`${todayBillings.length} pasien`} icon={ShoppingCart} color="blue" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Stok Kritis" value={criticalStock.length} sub="Item di bawah safety stock" icon={AlertTriangle} color="red" />
        <KpiCard title="Hampir Kadaluarsa" value={expiringBatches.length} sub="Batch ≤ 90 hari" icon={Clock} color="amber" />
        <KpiCard title="Jurnal Draft" value={journalEntries.filter(j => j.status === 'DRAFT').length} sub="Belum diposting" icon={FileText} color="purple" />
        <KpiCard title="Tagihan Pending" value={pendingBilling} sub="Belum dilunasi" icon={ShoppingCart} color="blue" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 card">
          <div className="card-header">
            <h3 className="section-title">Tren Pendapatan & Beban (6 Bulan)</h3>
            <span className="text-xs text-slate-400">dalam ribuan Rupiah</span>
          </div>
          <div className="card-body pt-2">
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={trendData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0464c7" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#0464c7" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradExp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}rb`} />
                <Tooltip formatter={(v) => [fmtIDR(v * 1000), '']} contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="Pendapatan" stroke="#0464c7" fill="url(#gradRev)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="Beban" stroke="#f59e0b" fill="url(#gradExp)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3 className="section-title">Laba Bersih Bulanan</h3></div>
          <div className="card-body pt-2">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={trendData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}rb`} />
                <Tooltip formatter={(v) => [fmtIDR(v * 1000), 'Laba']} contentStyle={{ borderRadius: 10, fontSize: 12 }} />
                <Bar dataKey="Laba" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent Journals */}
        <div className="card">
          <div className="card-header">
            <h3 className="section-title">Jurnal Terbaru</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead><tr>
                <th>No. Jurnal</th><th>Tanggal</th><th>Keterangan</th><th>Status</th>
              </tr></thead>
              <tbody>
                {recentJournals.length === 0
                  ? <tr><td colSpan={4} className="text-center py-6 text-slate-400">Belum ada jurnal</td></tr>
                  : recentJournals.map(j => (
                    <tr key={j.id}>
                      <td className="font-mono text-xs text-primary-700">{j.entryNumber}</td>
                      <td className="text-xs">{fmtDate(j.transactionDate)}</td>
                      <td className="max-w-[180px] truncate text-xs">{j.description}</td>
                      <td><StatusBadge status={j.status} /></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Critical Stock */}
        <div className="card">
          <div className="card-header">
            <h3 className="section-title">Stok Kritis</h3>
            {criticalStock.length > 0 && <span className="badge badge-red">{criticalStock.length} item</span>}
          </div>
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead><tr>
                <th>SKU</th><th>Nama Item</th><th className="text-right">Stok</th><th className="text-right">Min.</th>
              </tr></thead>
              <tbody>
                {criticalStock.length === 0
                  ? <tr><td colSpan={4} className="text-center py-6 text-slate-400 text-sm">✓ Semua stok aman</td></tr>
                  : criticalStock.map(item => {
                    const qty = invBatches.filter(b => b.itemId === item.id && b.quantityCurrent > 0).reduce((s, b) => s + b.quantityCurrent, 0)
                    return (
                      <tr key={item.id}>
                        <td className="font-mono text-xs">{item.skuCode}</td>
                        <td className="text-xs">{item.itemName}</td>
                        <td className="text-right text-xs font-bold text-red-600">{qty}</td>
                        <td className="text-right text-xs text-slate-500">{item.minSafetyStock}</td>
                      </tr>
                    )
                  })
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
