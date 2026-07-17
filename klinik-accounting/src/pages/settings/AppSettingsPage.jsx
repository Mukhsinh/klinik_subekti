import { useState } from 'react'
import { Save, Settings, Building2, Globe, FileText } from 'lucide-react'
import { useAuth } from '../../store/useAuth'
import toast from 'react-hot-toast'

export default function AppSettingsPage() {
  const { appSettings, saveAppSettings } = useAuth()
  const [form, setForm] = useState({ ...appSettings })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = (e) => {
    e.preventDefault()
    saveAppSettings(form)
    toast.success('Pengaturan aplikasi berhasil disimpan.')
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="page-title">Pengaturan Aplikasi</h1>
        <p className="text-sm text-slate-400 mt-0.5">Konfigurasi identitas, tampilan, dan parameter sistem</p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* Identitas */}
        <div className="card">
          <div className="card-header">
            <div className="flex items-center gap-2"><Building2 className="w-4 h-4 text-primary-600" /><span className="section-title">Identitas Klinik</span></div>
          </div>
          <div className="card-body space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label">Nama Aplikasi</label>
                <input className="form-input" value={form.appName || ''} onChange={e => set('appName', e.target.value)} placeholder="Klinik Medis Antigravity" />
              </div>
              <div>
                <label className="form-label">Nama Perusahaan (Legal)</label>
                <input className="form-input" value={form.companyName || ''} onChange={e => set('companyName', e.target.value)} placeholder="PT Klinik Medis Antigravity" />
              </div>
            </div>
            <div>
              <label className="form-label">Alamat</label>
              <textarea className="form-textarea" rows={2} value={form.address || ''} onChange={e => set('address', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label">Nomor Telepon</label>
                <input className="form-input" value={form.phone || ''} onChange={e => set('phone', e.target.value)} />
              </div>
              <div>
                <label className="form-label">Email</label>
                <input type="email" className="form-input" value={form.email || ''} onChange={e => set('email', e.target.value)} />
              </div>
              <div>
                <label className="form-label">Website</label>
                <input className="form-input" value={form.website || ''} onChange={e => set('website', e.target.value)} />
              </div>
              <div>
                <label className="form-label">NPWP</label>
                <input className="form-input font-mono" value={form.npwp || ''} onChange={e => set('npwp', e.target.value)} placeholder="XX.XXX.XXX.X-XXX.XXX" />
              </div>
            </div>
          </div>
        </div>

        {/* Pengaturan Sistem */}
        <div className="card">
          <div className="card-header">
            <div className="flex items-center gap-2"><Settings className="w-4 h-4 text-primary-600" /><span className="section-title">Parameter Sistem</span></div>
          </div>
          <div className="card-body space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="form-label">Mata Uang</label>
                <select className="form-select" value={form.currency || 'IDR'} onChange={e => set('currency', e.target.value)}>
                  <option value="IDR">IDR — Rupiah</option>
                  <option value="USD">USD — Dollar AS</option>
                </select>
              </div>
              <div>
                <label className="form-label">Zona Waktu</label>
                <select className="form-select" value={form.timezone || 'Asia/Jakarta'} onChange={e => set('timezone', e.target.value)}>
                  <option value="Asia/Jakarta">WIB — Jakarta (UTC+7)</option>
                  <option value="Asia/Makassar">WITA — Makassar (UTC+8)</option>
                  <option value="Asia/Jayapura">WIT — Jayapura (UTC+9)</option>
                </select>
              </div>
              <div>
                <label className="form-label">Tahun Fiskal Mulai</label>
                <select className="form-select" value={form.fiscalYearStart || '01-01'} onChange={e => set('fiscalYearStart', e.target.value)}>
                  <option value="01-01">1 Januari</option>
                  <option value="04-01">1 April</option>
                  <option value="07-01">1 Juli</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="form-label">Tarif PPN (%)</label>
                <input type="number" className="form-input" value={form.taxRate ?? 11} onChange={e => set('taxRate', parseFloat(e.target.value) || 11)} min={0} max={100} step={1} />
              </div>
              <div>
                <label className="form-label">Prefix Invoice</label>
                <input className="form-input font-mono" value={form.invoicePrefix || 'INV'} onChange={e => set('invoicePrefix', e.target.value)} />
              </div>
              <div>
                <label className="form-label">Prefix Kwitansi</label>
                <input className="form-input font-mono" value={form.receiptPrefix || 'RCP'} onChange={e => set('receiptPrefix', e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        {/* Laporan */}
        <div className="card">
          <div className="card-header">
            <div className="flex items-center gap-2"><FileText className="w-4 h-4 text-primary-600" /><span className="section-title">Pengaturan Laporan & Cetak</span></div>
          </div>
          <div className="card-body space-y-4">
            <div>
              <label className="form-label">Teks Footer Laporan / Invoice</label>
              <textarea className="form-textarea" rows={2} value={form.footerText || ''} onChange={e => set('footerText', e.target.value)} placeholder="Teks yang muncul di footer setiap laporan dan invoice…" />
            </div>
            <div>
              <label className="form-label">URL Logo (opsional)</label>
              <input className="form-input" value={form.logoUrl || ''} onChange={e => set('logoUrl', e.target.value)} placeholder="https://… atau path relatif" />
              <p className="text-xs text-slate-400 mt-1">Logo akan ditampilkan di header laporan PDF dan invoice.</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button type="submit" className="btn-primary px-8">
            <Save className="w-4 h-4" />Simpan Pengaturan
          </button>
        </div>
      </form>
    </div>
  )
}
