import { useState } from 'react'
import { Outlet, Navigate, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import { Toaster } from 'react-hot-toast'
import { useAuth } from '../../store/useAuth'
import { ShieldAlert } from 'lucide-react'

// ── Route → module access mapping ─────────────────────────────
const ROUTE_MODULE = {
  '/':                 'dashboard',
  '/coa':              'akuntansi',
  '/journal':          'akuntansi',
  '/ledger':           'akuntansi',
  '/trial-balance':    'akuntansi',
  '/income-statement': 'laporan',
  '/balance-sheet':    'laporan',
  '/cash-flow':        'laporan',
  '/inventory':        'inventory',
  '/grn':              'inventory',
  '/stock-ledger':     'inventory',
  '/assets/inventory': 'aset',
  '/assets/mutations': 'aset',
  '/assets/card':      'aset',
  '/assets/depreciation': 'aset',
  '/billing':          'billing',
  '/expenses':         'pengeluaran',
  '/tax-pph21':        'pajak',
  '/tax-ppn':          'pajak',
  '/branches':         'cabang',
  '/settings/app':     'pengaturan',
  '/settings/users':   'pengaturan',
  '/settings/doctors': 'pengaturan',
  '/settings/audit':   'pengaturan',
}

function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mb-4">
        <ShieldAlert className="w-8 h-8 text-red-500" />
      </div>
      <h2 className="text-xl font-bold text-slate-800 mb-2">Akses Ditolak</h2>
      <p className="text-slate-500 max-w-sm">Anda tidak memiliki hak akses ke halaman ini. Hubungi Administrator untuk informasi lebih lanjut.</p>
    </div>
  )
}

export default function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const { currentUser, hasAccess } = useAuth()
  const location = useLocation()

  // Redirect to login if not authenticated
  if (!currentUser) {
    return <Navigate to="/login" replace />
  }

  // Check route-level access
  const module = ROUTE_MODULE[location.pathname] || null
  const isDenied = module && !hasAccess(module)

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar collapsed={sidebarCollapsed} />
      <Header onMenuClick={() => setSidebarCollapsed(s => !s)} sidebarCollapsed={sidebarCollapsed} />
      <main className={`pt-16 transition-all duration-300 ${sidebarCollapsed ? 'pl-0' : 'pl-64'}`}>
        <div className="p-6 min-h-[calc(100vh-4rem)]">
          {isDenied ? <AccessDenied /> : <Outlet />}
        </div>
      </main>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          style: { fontSize: '14px', fontFamily: 'Inter, sans-serif', borderRadius: '10px' },
          success: { style: { background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0' } },
          error:   { style: { background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' } },
        }}
      />
    </div>
  )
}
