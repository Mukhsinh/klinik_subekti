import { Menu, Bell, ChevronDown, Building2, LogOut, User, Settings } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { useAuth, ROLE_LABELS, ROLE_COLORS } from '../../store/useAuth'
import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Header({ onMenuClick, sidebarCollapsed }) {
  const { branches, activeBranchId, setActiveBranch } = useStore()
  const { currentUser, logout } = useAuth()
  const navigate = useNavigate()
  const activeBranch = branches.find(b => b.id === activeBranchId) || branches[0]
  const [showBranch, setShowBranch] = useState(false)
  const [showUser, setShowUser] = useState(false)
  const branchRef = useRef(null)
  const userRef = useRef(null)

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (branchRef.current && !branchRef.current.contains(e.target)) setShowBranch(false)
      if (userRef.current && !userRef.current.contains(e.target)) setShowUser(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const leftPos = sidebarCollapsed ? 'left-0' : 'left-64'

  return (
    <header className={`fixed top-0 right-0 ${leftPos} h-16 bg-white border-b border-slate-200 flex items-center px-5 gap-4 z-20 transition-all duration-300`}>
      <button onClick={onMenuClick} className="btn-ghost p-2 -ml-1 flex-shrink-0">
        <Menu className="w-5 h-5" />
      </button>

      <div className="flex-1" />

      {/* Branch Selector */}
      <div className="relative" ref={branchRef}>
        <button
          onClick={() => setShowBranch(s => !s)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
        >
          <Building2 className="w-4 h-4 text-primary-600 flex-shrink-0" />
          <span className="text-sm font-medium text-slate-700 max-w-[160px] truncate">
            {activeBranch?.branchCode} — {activeBranch?.entityName?.split('—')[1]?.trim() || activeBranch?.entityName}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
        </button>
        {showBranch && (
          <div className="absolute right-0 top-full mt-1 w-72 bg-white rounded-xl shadow-lg border border-slate-200 z-50 py-1">
            <p className="px-4 py-2 text-xs text-slate-400 font-medium uppercase tracking-wide">Pilih Cabang</p>
            {branches.map(b => (
              <button
                key={b.id}
                onClick={() => { setActiveBranch(b.id); setShowBranch(false) }}
                className={`w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50 transition-colors ${b.id === activeBranchId ? 'bg-primary-50' : ''}`}
              >
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${b.id === activeBranchId ? 'bg-primary-600' : 'bg-slate-300'}`} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{b.entityName}</p>
                  <p className="text-xs text-slate-400">{b.branchCode}{b.isHeadquarters ? ' · Kantor Pusat' : ''}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Notifications */}
      <button className="btn-ghost p-2 relative flex-shrink-0">
        <Bell className="w-5 h-5" />
        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
      </button>

      {/* User dropdown */}
      <div className="relative" ref={userRef}>
        <button
          onClick={() => setShowUser(s => !s)}
          className="flex items-center gap-2 pl-1 pr-1 py-1 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-sm font-semibold">
              {currentUser?.name?.charAt(0).toUpperCase() || 'A'}
            </span>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
        </button>
        {showUser && (
          <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-xl shadow-lg border border-slate-200 z-50 py-1 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-800">{currentUser?.name}</p>
              <p className="text-xs text-slate-400">{currentUser?.email}</p>
              <span className={`badge text-xs mt-1.5 ${ROLE_COLORS[currentUser?.role] || 'badge-gray'}`}>{ROLE_LABELS[currentUser?.role]}</span>
            </div>
            {currentUser?.role === 'admin' && (
              <button className="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50 text-sm text-slate-700 transition-colors"
                onClick={() => { navigate('/settings/app'); setShowUser(false) }}>
                <Settings className="w-4 h-4 text-slate-400" />Pengaturan
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
