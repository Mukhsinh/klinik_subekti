import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../store/useAuth'
import { Activity, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const { login, appSettings } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) { toast.error('Username dan password wajib diisi.'); return }
    setLoading(true)
    await new Promise(r => setTimeout(r, 400)) // simulate network
    const result = login(username.trim(), password)
    setLoading(false)
    if (result.ok) {
      toast.success('Login berhasil. Selamat bekerja!')
      navigate('/', { replace: true })
    } else {
      toast.error(result.error)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-950 via-primary-900 to-primary-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header banner */}
          <div className="bg-primary-600 px-8 py-7 text-center">
            {appSettings?.logoUrl ? (
              <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center mx-auto mb-3 overflow-hidden p-1">
                <img src={appSettings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
              </div>
            ) : (
              <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center mx-auto mb-3">
                <Activity className="w-7 h-7 text-white" />
              </div>
            )}
            <h1 className="text-xl font-bold text-white">{appSettings?.appName || 'Klinik Medis Antigravity'}</h1>
            <p className="text-primary-200 text-sm mt-1">Sistem Akuntansi & Inventory</p>
          </div>

          {/* Form */}
          <div className="px-8 py-8">
            <h2 className="text-lg font-semibold text-slate-800 mb-1">Masuk ke Sistem</h2>
            <p className="text-sm text-slate-400 mb-6">Silakan masukkan kredensial Anda</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="form-label">Username</label>
                <input
                  className="form-input"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Masukkan username…"
                  autoComplete="username"
                  autoFocus
                />
              </div>
              <div>
                <label className="form-label">Password</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    className="form-input pr-10"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Masukkan password…"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5 mt-2">
                {loading ? (
                  <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Memverifikasi…</span>
                ) : 'Masuk'}
              </button>
            </form>

            <div className="mt-6 p-4 bg-slate-50 rounded-xl text-xs text-slate-500 space-y-1">
              <p className="font-semibold text-slate-600 mb-2">Akun Demo:</p>
              <p>👑 <strong>admin</strong> / admin123 → Administrator (akses penuh)</p>
              <p>💼 <strong>keuangan</strong> / keuangan123 → Staf Keuangan</p>
              <p>📦 <strong>gudang</strong> / gudang123 → Staf Gudang</p>
            </div>
          </div>
        </div>

        <p className="text-center text-slate-200 text-xs mt-4 font-medium">
          Pintar Klinik@2026. Mukhsin Hadi. All Right Reserved
        </p>
      </div>
    </div>
  )
}
