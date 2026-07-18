/**
 * useAuth.js — Authentication & user management store
 * Users are synced with Supabase.
 * Audit logs & app settings are synced to Supabase.
 */
import { useState, useEffect } from 'react'
import { insertAuditLog, fetchAuditLogs, fetchAppSettings, saveAllAppSettings, fetchUsers, upsertUser, deleteUser } from '../lib/db'

// ── localStorage helpers ──────────────────────────────────────
function persist(key, val) { try { localStorage.setItem(key, JSON.stringify(val)) } catch (_) { } }
function load(key, fallback) { try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback } catch (_) { return fallback } }

// ── Defaults ──────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  appName: 'Klinik Medis Antigravity',
  companyName: 'PT Klinik Medis Antigravity',
  address: 'Jl. Sudirman No. 1, Jakarta Pusat',
  phone: '(021) 1234-5678',
  email: 'info@antigravity-klinik.id',
  website: 'www.antigravity-klinik.id',
  npwp: '01.234.567.8-901.000',
  footerText: 'Terima kasih telah mempercayakan kesehatan Anda kepada kami.',
  logoUrl: '',
  currency: 'IDR',
  timezone: 'Asia/Jakarta',
  fiscalYearStart: '01-01',
  invoicePrefix: 'INV',
  receiptPrefix: 'RCP',
  taxRate: 11,
}

const DEFAULT_USERS = [
  { id: 'u1', name: 'Administrator', username: 'admin', password: 'admin123', role: 'admin', email: 'admin@klinik.id', isActive: true, createdAt: '2024-01-01T00:00:00Z' },
  { id: 'u2', name: 'Staf Keuangan', username: 'keuangan', password: 'keuangan123', role: 'keuangan', email: 'finance@klinik.id', isActive: true, createdAt: '2024-01-01T00:00:00Z' },
  { id: 'u3', name: 'Staf Gudang', username: 'gudang', password: 'gudang123', role: 'gudang', email: 'gudang@klinik.id', isActive: true, createdAt: '2024-01-01T00:00:00Z' },
]

// ── Role definitions ──────────────────────────────────────────
export const ROLE_LABELS = { admin: 'Administrator', keuangan: 'Staf Keuangan', gudang: 'Staf Gudang' }
export const ROLE_COLORS = { admin: 'badge-blue', keuangan: 'badge-green', gudang: 'badge-yellow' }
export const ROLE_ACCESS = {
  admin: ['dashboard', 'akuntansi', 'laporan', 'inventory', 'aset', 'billing', 'pengeluaran', 'pajak', 'cabang', 'pengaturan'],
  keuangan: ['dashboard', 'akuntansi', 'laporan', 'inventory', 'aset', 'pengeluaran', 'pajak', 'cabang'],
  gudang: ['dashboard', 'inventory'],
}

// ── Singleton ─────────────────────────────────────────────────
let _auth = null
const _authListeners = new Set()

function getAuth() {
  if (!_auth) {
    _auth = {
      currentUser: load('currentUser', null),
      users: load('authUsers', DEFAULT_USERS),
      appSettings: load('appSettings', DEFAULT_SETTINGS),
      auditLogs: [],
      isInitialized: false,
    }
  }
  return _auth
}

function setAuth(updater) {
  const prev = getAuth()
  const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater }
  _auth = next
  // Persist to localStorage
  if (next.currentUser !== prev.currentUser) persist('currentUser', next.currentUser)
  if (next.users !== prev.users) persist('authUsers', next.users)
  if (next.appSettings !== prev.appSettings) persist('appSettings', next.appSettings)
  _authListeners.forEach(fn => fn())
}

// ── Bootstrap — sync app settings, audit logs & users from Supabase
let _authBootstrapDone = false
async function bootstrapAuth() {
  if (_authBootstrapDone) return
  _authBootstrapDone = true
  try {
    const [dbSettings, dbLogs, dbUsers] = await Promise.all([
      fetchAppSettings().catch(() => ({})),
      fetchAuditLogs(500).catch(() => []),
      fetchUsers().catch(() => []),
    ])

    // Merge DB settings into defaults (DB wins)
    const merged = { ...DEFAULT_SETTINGS, ...dbSettings }

    // Push defaults to Supabase if nothing there yet
    if (Object.keys(dbSettings).length === 0) {
      saveAllAppSettings(DEFAULT_SETTINGS).catch(() => { })
    }

    // Seed defaults to Supabase users table if database does not contain any users yet
    let finalUsers = dbUsers
    if (dbUsers.length === 0) {
      finalUsers = DEFAULT_USERS
      await Promise.all(DEFAULT_USERS.map(u => upsertUser(u))).catch(() => { })
    }

    setAuth(s => ({
      ...s,
      appSettings: merged,
      auditLogs: dbLogs.length ? dbLogs : s.auditLogs,
      users: finalUsers.length ? finalUsers : s.users,
      isInitialized: true,
    }))
  } catch (err) {
    console.warn('[bootstrapAuth]', err.message)
    setAuth(s => ({ ...s, isInitialized: true }))
  }
}

// ── Audit log writer ──────────────────────────────────────────
function writeAuditLog(user, action, module, detail = '') {
  const id = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const log = {
    id,
    userId: user?.id || 'anonymous',
    userName: user?.name || 'Tidak diketahui',
    userRole: user?.role || '—',
    action, module, detail,
    ipAddress: '127.0.0.1',
    ip: '127.0.0.1',
    timestamp: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  }
  setAuth(s => ({ ...s, auditLogs: [log, ...(s.auditLogs || [])].slice(0, 2000) }))
  insertAuditLog(log).catch(() => { })
  return log
}

// ── React hook ────────────────────────────────────────────────
export function useAuth() {
  const [, forceRender] = useState(0)

  useEffect(() => {
    const listener = () => forceRender(n => n + 1)
    _authListeners.add(listener)
    bootstrapAuth()
    return () => _authListeners.delete(listener)
  }, [])

  const state = getAuth()

  // Login
  const login = (username, password) => {
    const user = state.users.find(u =>
      u.username === username && u.password === password && u.isActive
    )
    if (!user) return { ok: false, error: 'Username atau password salah.' }
    const currentUser = { id: user.id, name: user.name, username: user.username, role: user.role, email: user.email }
    setAuth(s => ({ ...s, currentUser }))
    writeAuditLog(user, 'LOGIN', 'Autentikasi', 'Login berhasil dari perangkat web')
    return { ok: true, user }
  }

  // Logout
  const logout = () => {
    if (state.currentUser) writeAuditLog(state.currentUser, 'LOGOUT', 'Autentikasi', 'Keluar dari sistem')
    setAuth(s => ({ ...s, currentUser: null }))
  }

  // Add user
  const addUser = (data) => {
    if (state.users.find(u => u.username === data.username)) {
      return { ok: false, error: 'Username sudah digunakan.' }
    }
    const newUser = {
      ...data,
      id: `u${Date.now()}`,
      isActive: true,
      createdAt: new Date().toISOString(),
    }
    setAuth(s => ({ ...s, users: [...s.users, newUser] }))
    upsertUser(newUser).catch(err => console.error('[addUser SB]', err.message))
    writeAuditLog(state.currentUser, 'TAMBAH_PENGGUNA', 'Manajemen Pengguna',
      `Menambahkan pengguna: ${data.username} (${data.role})`)
    return { ok: true, user: newUser }
  }

  // Update user
  const updateUser = (id, data) => {
    const target = state.users.find(u => u.id === id)
    if (!target) return { ok: false, error: 'User tidak ditemukan.' }
    const updatedUser = { ...target, ...data }
    setAuth(s => ({ ...s, users: s.users.map(u => u.id === id ? updatedUser : u) }))
    upsertUser(updatedUser).catch(err => console.error('[updateUser SB]', err.message))
    writeAuditLog(state.currentUser, 'UBAH_PENGGUNA', 'Manajemen Pengguna', `Mengubah pengguna ID: ${id}`)
    return { ok: true }
  }

  // Deactivate user
  const deactivateUser = (id) => {
    const target = state.users.find(u => u.id === id)
    if (!target) return
    const updatedUser = { ...target, isActive: false }
    setAuth(s => ({ ...s, users: s.users.map(u => u.id === id ? updatedUser : u) }))
    upsertUser(updatedUser).catch(err => console.error('[deactivateUser SB]', err.message))
    writeAuditLog(state.currentUser, 'NONAKTIFKAN_PENGGUNA', 'Manajemen Pengguna',
      `Menonaktifkan pengguna: ${target?.username}`)
  }

  // Reset password
  const resetPassword = (id, newPassword) => {
    const target = state.users.find(u => u.id === id)
    if (!target) return { ok: false, error: 'User tidak ditemukan.' }
    const updatedUser = { ...target, password: newPassword }
    setAuth(s => ({ ...s, users: s.users.map(u => u.id === id ? updatedUser : u) }))
    upsertUser(updatedUser).catch(err => console.error('[resetPassword SB]', err.message))
    writeAuditLog(state.currentUser, 'RESET_PASSWORD', 'Manajemen Pengguna',
      `Reset password untuk: ${target?.username}`)
    return { ok: true }
  }

  // Save app settings — local + Supabase
  const saveAppSettings = (data) => {
    const merged = { ...state.appSettings, ...data }
    setAuth(s => ({ ...s, appSettings: merged }))
    writeAuditLog(state.currentUser, 'UBAH_PENGATURAN', 'Pengaturan Aplikasi', 'Menyimpan pengaturan aplikasi')
    saveAllAppSettings(merged).catch(err => console.warn('[saveAppSettings]', err.message))
  }

  // Reload audit logs from Supabase
  const reloadAuditLogs = async () => {
    try {
      const rows = await fetchAuditLogs(1000)
      setAuth(s => ({ ...s, auditLogs: rows }))
      return rows
    } catch (e) {
      console.warn('[reloadAuditLogs]', e.message)
      return state.auditLogs
    }
  }

  // Manual log
  const logActivity = (action, module, detail = '') => {
    writeAuditLog(state.currentUser, action, module, detail)
  }

  // Access check
  const hasAccess = (module) => (ROLE_ACCESS[state.currentUser?.role || 'gudang'] || []).includes(module)
  const isAdmin = () => state.currentUser?.role === 'admin'

  return {
    ...state,
    login, logout,
    addUser, updateUser, deactivateUser, resetPassword,
    saveAppSettings,
    reloadAuditLogs,
    logActivity,
    hasAccess, isAdmin,
  }
}
