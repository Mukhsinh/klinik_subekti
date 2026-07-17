import { useState, useMemo, useEffect } from 'react'
import { Download, Filter, ShieldAlert } from 'lucide-react'
import { useAuth, ROLE_LABELS, ROLE_COLORS } from '../../store/useAuth'
import SearchInput from '../../components/ui/SearchInput'
import { fmtDateTime, todayISO, monthStart, monthEnd } from '../../utils/format'
import * as XLSX from 'xlsx'
import toast from 'react-hot-toast'

const ACTION_COLORS = {
  LOGIN: 'badge-green',
  LOGOUT: 'badge-gray',
  TAMBAH_PENGGUNA: 'badge-blue',
  UBAH_PENGGUNA: 'badge-yellow',
  NONAKTIFKAN_PENGGUNA: 'badge-red',
  RESET_PASSWORD: 'badge-orange',
  UBAH_PENGATURAN: 'badge-purple',
  default: 'badge-gray',
}

const MODULE_ICONS = {
  'Autentikasi': '🔐',
  'Manajemen Pengguna': '👤',
  'Pengaturan Aplikasi': '⚙️',
  'Jurnal': '📒',
  'Inventaris': '📦',
  'Billing': '🧾',
  'Pengeluaran': '💳',
}

export default function AuditTrailPage() {
  const { auditLogs, users, reloadAuditLogs } = useAuth()

  useEffect(() => {
    reloadAuditLogs().catch(err => console.error('[AuditTrailPage] Failed loading logs:', err.message))
  }, [])

  const [search, setSearch] = useState('')
  const [userFilter, setUserFilter] = useState('ALL')
  const [modFilter, setModFilter] = useState('ALL')
  const [dateFrom, setDateFrom] = useState(monthStart())
  const [dateTo, setDateTo] = useState(monthEnd())
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 25

  const modules = useMemo(() => ['ALL', ...new Set(auditLogs.map(l => l.module))], [auditLogs])
  const logUsers = useMemo(() => {
    const uniq = {}
    auditLogs.forEach(l => { if (!uniq[l.userId]) uniq[l.userId] = l.userName })
    return [{ id: 'ALL', name: 'Semua Pengguna' }, ...Object.entries(uniq).map(([id, name]) => ({ id, name }))]
  }, [auditLogs])

  const filtered = useMemo(() =>
    auditLogs
      .filter(l => userFilter === 'ALL' || l.userId === userFilter)
      .filter(l => modFilter === 'ALL' || l.module === modFilter)
      .filter(l => !dateFrom || l.timestamp.slice(0, 10) >= dateFrom)
      .filter(l => !dateTo || l.timestamp.slice(0, 10) <= dateTo)
      .filter(l => !search ||
        l.userName.toLowerCase().includes(search.toLowerCase()) ||
        l.action.toLowerCase().includes(search.toLowerCase()) ||
        l.detail.toLowerCase().includes(search.toLowerCase())
      ),
    [auditLogs, userFilter, modFilter, dateFrom, dateTo, search])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const exportXLSX = () => {
    const rows = filtered.map(l => ({
      'Waktu': fmtDateTime(l.timestamp),
      'Pengguna': l.userName,
      'Role': ROLE_LABELS[l.userRole] || l.userRole,
      'Aksi': l.action,
      'Modul': l.module,
      'Detail': l.detail,
      'IP': l.ip,
    }))
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, 'Audit Trail')
    XLSX.writeFile(wb, `AuditTrail_${dateFrom}_${dateTo}.xlsx`)
    toast.success('File audit trail berhasil diunduh.')
  }

  const loginCount = filtered.filter(l => l.action === 'LOGIN').length
  const uniqueUsers = new Set(filtered.map(l => l.userId)).size
  const todayActions = filtered.filter(l => l.timestamp.startsWith(todayISO())).length

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Audit Trail</h1>
          <p className="text-sm text-slate-400 mt-0.5">Catatan aktivitas pengguna sistem secara lengkap dan terperinci</p>
        </div>
        <button className="btn-secondary" onClick={exportXLSX}>
          <Download className="w-4 h-4" />Export Excel
        </button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-4 gap-4">
        <div className="card card-body bg-blue-50 border-0">
          <p className="text-xs text-slate-500 mb-1">Total Log (Filter Aktif)</p>
          <p className="font-bold text-2xl text-blue-700">{filtered.length}</p>
        </div>
        <div className="card card-body bg-emerald-50 border-0">
          <p className="text-xs text-slate-500 mb-1">Login Berhasil</p>
          <p className="font-bold text-2xl text-emerald-700">{loginCount}</p>
        </div>
        <div className="card card-body bg-purple-50 border-0">
          <p className="text-xs text-slate-500 mb-1">Pengguna Aktif</p>
          <p className="font-bold text-2xl text-purple-700">{uniqueUsers}</p>
        </div>
        <div className="card card-body bg-amber-50 border-0">
          <p className="text-xs text-slate-500 mb-1">Aktivitas Hari Ini</p>
          <p className="font-bold text-2xl text-amber-700">{todayActions}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card card-body">
        <div className="flex flex-wrap gap-3 items-end">
          <SearchInput value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="Cari pengguna, aksi, detail…" className="w-64" />
          <div>
            <label className="form-label text-xs">Pengguna</label>
            <select className="form-select" value={userFilter} onChange={e => { setUserFilter(e.target.value); setPage(1) }}>
              {logUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label text-xs">Modul</label>
            <select className="form-select" value={modFilter} onChange={e => { setModFilter(e.target.value); setPage(1) }}>
              {modules.map(m => <option key={m} value={m}>{m === 'ALL' ? 'Semua Modul' : m}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label text-xs">Dari Tanggal</label>
            <input type="date" className="form-input" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1) }} />
          </div>
          <div>
            <label className="form-label text-xs">Sampai Tanggal</label>
            <input type="date" className="form-input" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1) }} />
          </div>
          <span className="text-sm text-slate-400 ml-auto self-end">{filtered.length} catatan</span>
        </div>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th style={{ width: 170 }}>Waktu</th>
                <th style={{ width: 140 }}>Pengguna</th>
                <th style={{ width: 110 }}>Role</th>
                <th style={{ width: 160 }}>Aksi</th>
                <th style={{ width: 140 }}>Modul</th>
                <th>Detail</th>
                <th style={{ width: 100 }}>IP</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-slate-400">
                    <ShieldAlert className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    Tidak ada catatan audit pada filter yang dipilih
                  </td>
                </tr>
              ) : paginated.map(l => (
                <tr key={l.id}>
                  <td className="text-xs font-mono">{fmtDateTime(l.timestamp)}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-primary-700 font-bold text-xs">{l.userName?.charAt(0)?.toUpperCase()}</span>
                      </div>
                      <span className="text-sm font-medium truncate max-w-[90px]">{l.userName}</span>
                    </div>
                  </td>
                  <td><span className={`badge text-xs ${ROLE_COLORS[l.userRole] || 'badge-gray'}`}>{ROLE_LABELS[l.userRole] || l.userRole}</span></td>
                  <td><span className={`badge text-xs ${ACTION_COLORS[l.action] || ACTION_COLORS.default}`}>{l.action}</span></td>
                  <td className="text-xs">
                    <span>{MODULE_ICONS[l.module] || '📋'} {l.module}</span>
                  </td>
                  <td className="text-xs text-slate-600 max-w-[260px] truncate">{l.detail || '—'}</td>
                  <td className="font-mono text-xs text-slate-400">{l.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <p className="text-sm text-slate-500">
              Menampilkan {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} dari {filtered.length}
            </p>
            <div className="flex gap-1">
              <button className="btn-secondary py-1 px-3 text-xs" disabled={page === 1} onClick={() => setPage(p => p - 1)}>←</button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className={`py-1 px-3 text-xs rounded-lg ${p === page ? 'bg-primary-600 text-white' : 'btn-secondary'}`}
                  >{p}</button>
                )
              })}
              <button className="btn-secondary py-1 px-3 text-xs" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>→</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
