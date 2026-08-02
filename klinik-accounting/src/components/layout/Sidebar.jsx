import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, BookOpen, FileText, BarChart3,
  Package, ShoppingCart, Receipt, TrendingUp,
  Building2, Users, ChevronDown, ChevronRight,
  Scale, FileBarChart, Layers, Wallet, ArrowRightLeft,
  Settings, UserCog, ClipboardList, Activity, LogOut, Stethoscope,
  Boxes, FolderInput, ClipboardCheck, Calculator, CreditCard, FileSpreadsheet, TrendingDown, BookMarked, RefreshCw,
  Store, Percent, Tag
} from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../../store/useAuth'

// ── Role-based menu visibility ──────────────────────────────
// roles: admin | keuangan | gudang
const NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', roles: ['admin', 'keuangan', 'gudang'] },
  {
    label: 'Akuntansi', icon: BookOpen, roles: ['admin', 'keuangan'], children: [
      { to: '/coa', icon: Layers, label: 'Bagan Akun (COA)' },
      { to: '/opening-balance', icon: BookMarked, label: 'Saldo Awal' },
      { to: '/journal', icon: FileText, label: 'Jurnal Umum' },
      { to: '/ledger', icon: BookOpen, label: 'Buku Besar' },
      { to: '/ap-ledger', icon: BookMarked, label: 'Buku Pembantu Utang' },
      { to: '/trial-balance', icon: Scale, label: 'Neraca Saldo' },
    ]
  },
  {
    label: 'Laporan Keuangan', icon: BarChart3, roles: ['admin', 'keuangan'], children: [
      { to: '/income-statement', icon: TrendingUp, label: 'Laba Rugi' },
      { to: '/equity-changes', icon: RefreshCw, label: 'Perubahan Ekuitas' },
      { to: '/balance-sheet', icon: FileBarChart, label: 'Neraca' },
      { to: '/cash-flow', icon: ArrowRightLeft, label: 'Arus Kas' },
    ]
  },
  {
    label: 'Transaksi', icon: CreditCard, roles: ['admin'], children: [
      { to: '/billing', icon: Store, label: 'Kasir & Billing' },
      { to: '/billing-report', icon: FileSpreadsheet, label: 'Laporan Billing' },
    ]
  },
  { to: '/expenses', icon: Wallet, label: 'Pengeluaran', roles: ['admin', 'keuangan'] },
  {
    label: 'Inventory', icon: Package, roles: ['admin', 'keuangan', 'gudang'], children: [
      { to: '/inventory', icon: Package, label: 'Master Item' },
      { to: '/inventory/item-opening-balance', icon: BookMarked, label: 'Saldo Awal Item' },
      { to: '/grn', icon: ShoppingCart, label: 'Penerimaan Stock' },
      { to: '/stock-outflow', icon: TrendingDown, label: 'Pengeluaran Stok' },
      { to: '/stock-ledger', icon: BarChart3, label: 'Kartu Stok' },
    ]
  },
  {
    label: 'Aset', icon: Boxes, roles: ['admin', 'keuangan'], children: [
      { to: '/assets/inventory', icon: ClipboardCheck, label: 'Inventarisasi Aset' },
      { to: '/assets/mutations', icon: FolderInput, label: 'Mutasi Aset' },
      { to: '/assets/card', icon: FileBarChart, label: 'Kartu Inventaris Aset' },
      { to: '/assets/depreciation', icon: Calculator, label: 'Kalkulasi Penyusutan' },
    ]
  },
  {
    label: 'Pajak', icon: FileText, roles: ['admin', 'keuangan'], children: [
      { to: '/tax-pph21', icon: Users, label: 'PPh 21 Dokter' },
      { to: '/tax-ppn', icon: Percent, label: 'PPN Obat' },
    ]
  },
  {
    label: 'Pengaturan', icon: Settings, roles: ['admin', 'keuangan'], children: [
      { to: '/settings/app', icon: Settings, label: 'Pengaturan Aplikasi', roles: ['admin'] },
      { to: '/settings/users', icon: UserCog, label: 'Manajemen Pengguna', roles: ['admin'] },
      { to: '/settings/doctors', icon: Stethoscope, label: 'Manajemen Dokter', roles: ['admin'] },
      { to: '/settings/service-tariffs', icon: Tag, label: 'Manajemen Tarif Layanan', roles: ['admin'] },
      { to: '/settings/vendors', icon: Building2, label: 'Manajemen Vendor', roles: ['admin'] },
      { to: '/settings/audit', icon: ClipboardList, label: 'Audit Trail', roles: ['admin'] },
    ]
  },
]

function NavItem({ item, userRole, depth = 0 }) {
  const [open, setOpen] = useState(true)
  const pl = depth === 0 ? 'pl-4' : 'pl-8'

  // Role check
  if (item.roles && !item.roles.includes(userRole)) return null

  if (item.children) {
    return (
      <div>
        <button
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center gap-2.5 px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100/70 rounded-lg transition-colors"
        >
          <item.icon className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1 text-left">{item.label}</span>
          {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
        {open && (
          <div className="ml-2 mt-0.5 border-l border-slate-200 pl-2 space-y-0.5">
            {item.children.map(child => (
              <NavItem key={child.to} item={child} userRole={userRole} depth={1} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        `flex items-center gap-2.5 ${pl} py-2 text-sm rounded-lg transition-colors ` +
        (isActive
          ? 'bg-primary-50 text-primary-700 font-semibold'
          : 'text-slate-600 hover:text-slate-800 hover:bg-slate-100/70')
      }
    >
      <item.icon className="w-4 h-4 flex-shrink-0" />
      <span>{item.label}</span>
    </NavLink>
  )
}

export default function Sidebar({ collapsed }) {
  const { currentUser, appSettings, logout } = useAuth()
  const navigate = useNavigate()
  const role = currentUser?.role || 'gudang'

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <aside className={`fixed top-0 left-0 h-full bg-white border-r border-slate-200 flex flex-col z-30 transition-all duration-300 ${collapsed ? 'w-0 overflow-hidden' : 'w-64'}`}>
      {/* Logo */}
      <div className="h-16 flex items-center gap-3 px-5 border-b border-slate-100 flex-shrink-0">
        {appSettings?.logoUrl ? (
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden bg-slate-50 border border-slate-100">
            <img src={appSettings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
          </div>
        ) : (
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Activity className="w-4 h-4 text-white" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-800 truncate">{appSettings?.appName || 'Klinik Antigravity'}</p>
          <p className="text-xs text-slate-400">Sistem Akuntansi</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {NAV.map((item, i) => (
          <NavItem key={item.to || item.label + i} item={item} userRole={role} />
        ))}
      </nav>

      {/* User info & logout */}
      <div className="px-3 py-3 border-t border-slate-100 flex-shrink-0 space-y-2">
        <div className="flex items-center gap-2.5 px-2">
          <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
            <span className="text-primary-700 font-bold text-xs">
              {currentUser?.name?.charAt(0).toUpperCase() || 'A'}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-700 truncate">{currentUser?.name || 'Administrator'}</p>
            <p className="text-xs text-slate-400 capitalize">{currentUser?.role || 'admin'}</p>
          </div>
          <button onClick={handleLogout} className="p-1.5 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors text-slate-400" title="Keluar">
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  )
}
