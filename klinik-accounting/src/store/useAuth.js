import { useState, useEffect } from 'react'
import { insertAuditLog, fetchAuditLogs } from '../lib/db'

// ── Persistence helpers ───────────────────────────────────────
function persist(key, val) { try { localStorage.setItem(key, JSON.stringify(val)) } catch (_) {} }
function load(key, fallback) { try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback } catch (_) { return fallback } }

// ── Default app settings ──────────────────────────────────────
const DEFAULT_SETTINGS = {
  appName:       'Klinik Medis Antigravity',
  companyName:   'PT Klinik Medis Antigravity',
  address:       'Jl. Sudirman No. 1, Jakarta Pusat',
  phone:         '(021) 1234-5678',
  email:         'info@antigravity-klinik.id',
  website:       'www.antigravity-klinik.id',
  npwp:          '01.234.567.8-901.000',
  footerText:    'Terima kasih telah mempercayakan kesehatan Anda kepada kami.',
  logoUrl:       '',
  currency:      'IDR',
  timezone:      'Asia/Jakarta',
  fiscalYearStart: '01-01',
  invoicePrefix:  'INV',
  receiptPrefix:  'RCP',
  taxRate:        11,
}

// ── Default users ─────────────────────────────────────────────
const DEFAULT_USERS = [
  { id: 'u1', name: 'Administrator', username: 'admin',   password: 'admin123',   role: 'admin',    email: 'admin@klinik.id',    isActive: true,  createdAt: '2024-01-01T00:00:00Z' },
  { id: 'u2', name: 'Staf Keuangan', username: 'keuangan',password: 'keuangan123',role: 'keuangan', email: 'finance@klinik.id',   isActive: true,  createdAt: '2024-01-01T00:00:00Z' },
  { id: 'u3', name: 'Staf Gudang',   username: 'gudang',  password: 'gudang123',  role: 'gudang',   email: 'gudang@klinik.id',    isActive: true,  createdAt: '2024-01-01T00:00:00Z' },
]

// ── Role labels ────────────────────────────────────────────────
export const ROLE_LABELS = {
  admin:    'Administrator',
  keuangan: 'Staf Keuangan',
  gudang:   'Staf Gudang',
}
export const ROLE_COLORS = {
  admin:    'badge-blue',
  keuangan: 'badge-green',
  gudang:   'badge-yellow',
}

// ── Role access matrix ─────────────────────────────────────────
export const ROLE_ACCESS = {
  admin:    ['dashboard','akuntansi','laporan','inventaris','billing','pengeluaran','pajak','cabang','pengaturan'],
  keuangan: ['dashboard','akuntansi','laporan','inventaris','pengeluaran','pajak','cabang'],
  gudang:   ['dashboard','inventaris'],
}

// ── Singleton auth state ──────────────────────────────────────
let _auth = null
const _authListeners = new Set()

function getAuth() {
  if (!_auth) {
    _auth = {
      currentUser:   load('currentUser',   null),
      users:         load('authUsers',     DEFAULT_USERS),
      appSettings:   load('appSettings',   DEFAULT_SETTINGS),
      auditLogs:     load('auditLogs',     []),
      isInitialized: true,
    }
  }
  return _auth
}

function setAuth(updater) {
  const prev = getAuth()
  const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater }
  _auth = next
  const keys = ['currentUser','authUsers','appSettings','auditLogs']
  const storageKeys = { currentUser:'currentUser', users:'authUsers', appSettings:'appSettings', auditLogs:'auditLogs' }
  Object.entries(storageKeys).forEach(([field, key]) => {
    if (next[field] !== prev[field]) persist(key, next[field])
  })
  _authListeners.forEach(fn => fn())
}

// ── Audit log writer ──────────────────────────────────────────
function writeAuditLog(user, action, module, detail = '') {
  const log = {
    id:         crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    userId:     user?.id || 'anonymous',
    userName:   user?.name || 'Tidak diketahui',
    userRole:   user?.role || '—',
    action,
    module,
    detail,
    ipAddress:  '127.0.0.1',
    ip:         '127.0.0.1',
    timestamp:  new Date().toISOString(),
    createdAt:  new Date().toISOString(),
  }
  setAuth(s => ({ ...s, auditLogs: [log, ...s.auditLogs].slice(0, 2000) }))
  // Also persist to Supabase
  insertAuditLog(log).catch(() => {})
  return log
}

// Load audit logs from Supabase on demand
export async function loadAuditLogsFromDB() {
  try {
    const rows = await fetchAuditLogs(1000)
    setAuth(s => ({ ...s, auditLogs: rows }))
    return rows
  } catch (_) {
    return getAuth().auditLogs
  }
}

// ── React hook ────────────────────────────────────────────────
export function useAuth() {
  const [, forceRender] = useState(0)

  useEffect(() => {
    const listener = () => forceRender(n => n + 1)
    _authListeners.add(listener)
    return () => _authListeners.delete(listener)
  }, [])

  const state = getAuth()

  // ── Login ─────────────────────────────────────────────────
  const login = (username, password) => {
    const user = state.users.find(u => u.username === username && u.password === password && u.isActive)
    if (!user) return { ok: false, error: 'Username atau password salah.' }
    setAuth(s => ({ ...s, currentUser: { id: user.id, name: user.name, username: user.username, role: user.role, email: user.email } }))
    writeAuditLog(user, 'LOGIN', 'Autentikasi', `Login berhasil dari perangkat web`)
    return { ok: true, user }
  }

  // ── Logout ────────────────────────────────────────────────
  const logout = () => {
    const user = state.currentUser
    if (user) writeAuditLog(user, 'LOGOUT', 'Autentikasi', 'Keluar dari sistem')
    setAuth(s => ({ ...s, currentUser: null }))
  }

  // ── User management ───────────────────────────────────────
  const addUser = (data) => {
    const user = state.currentUser
    if (state.users.find(u => u.username === data.username)) {
      return { ok: false, error: 'Username sudah digunakan.' }
    }
    const newUser = {
      ...data,
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      isActive: true,
      createdAt: new Date().toISOString(),
    }
    setAuth(s => ({ ...s, users: [...s.users, newUser] }))
    writeAuditLog(user, 'TAMBAH_PENGGUNA', 'Manajemen Pengguna', `Menambahkan pengguna: ${data.username} (${data.role})`)
    return { ok: true, user: newUser }
  }

  const updateUser = (id, data) => {
    const user = state.currentUser
    setAuth(s => ({ ...s, users: s.users.map(u => u.id === id ? { ...u, ...data } : u) }))
    writeAuditLog(user, 'UBAH_PENGGUNA', 'Manajemen Pengguna', `Mengubah pengguna ID: ${id}`)
    return { ok: true }
  }

  const deactivateUser = (id) => {
    const user = state.currentUser
    const target = state.users.find(u => u.id === id)
    setAuth(s => ({ ...s, users: s.users.map(u => u.id === id ? { ...u, isActive: false } : u) }))
    writeAuditLog(user, 'NONAKTIFKAN_PENGGUNA', 'Manajemen Pengguna', `Menonaktifkan pengguna: ${target?.username}`)
  }

  const resetPassword = (id, newPassword) => {
    const user = state.currentUser
    const target = state.users.find(u => u.id === id)
    setAuth(s => ({ ...s, users: s.users.map(u => u.id === id ? { ...u, password: newPassword } : u) }))
    writeAuditLog(user, 'RESET_PASSWORD', 'Manajemen Pengguna', `Reset password untuk: ${target?.username}`)
    return { ok: true }
  }

  // ── App settings ──────────────────────────────────────────
  const saveAppSettings = (data) => {
    const user = state.currentUser
    setAuth(s => ({ ...s, appSettings: { ...s.appSettings, ...data } }))
    writeAuditLog(user, 'UBAH_PENGATURAN', 'Pengaturan Aplikasi', 'Menyimpan pengaturan aplikasi')
  }

  // ── Manual audit log ──────────────────────────────────────
  const logActivity = (action, module, detail = '') => {
    return writeAuditLog(state.currentUser, action, module, detail)
  }

  // ── Access check ──────────────────────────────────────────
  const hasAccess = (module) => {
    const role = state.currentUser?.role || 'gudang'
    return (ROLE_ACCESS[role] || []).includes(module)
  }

  const isAdmin = () => state.currentUser?.role === 'admin'

  return {
    ...state,
    login, logout,
    addUser, updateUser, deactivateUser, resetPassword,
    saveAppSettings,
    logActivity,
    hasAccess, isAdmin,
  }
}
