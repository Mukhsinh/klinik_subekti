import { useState, useRef } from 'react'
import { Save, Settings, Building2, FileText, Upload, Trash2, Image as ImageIcon, Loader2 } from 'lucide-react'
import { useAuth } from '../../store/useAuth'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

export default function AppSettingsPage() {
  const { appSettings, saveAppSettings } = useAuth()
  const [form, setForm] = useState({ ...appSettings })
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // ── Upload logo to Supabase Storage ─────────────────────────
  const handleLogoUpload = async (file) => {
    if (!file) return
    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      toast.error('Format file tidak didukung. Gunakan PNG, JPG, GIF, SVG, atau WebP.')
      return
    }
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 5 MB.')
      return
    }

    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const filePath = `logo/clinic-logo-${Date.now()}.${ext}`

      // Delete old logo if exists
      if (form.logoUrl) {
        try {
          const oldPath = form.logoUrl.split('/storage/v1/object/public/assets/')[1]
          if (oldPath) {
            await supabase.storage.from('assets').remove([oldPath])
          }
        } catch (_) { /* ignore old delete errors */ }
      }

      // Upload new logo
      const { error: uploadError } = await supabase.storage
        .from('assets')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type,
        })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('assets')
        .getPublicUrl(filePath)

      const publicUrl = urlData.publicUrl
      set('logoUrl', publicUrl)
      toast.success('Logo berhasil diunggah!')
    } catch (err) {
      console.error('[LogoUpload]', err)
      toast.error(`Gagal mengunggah logo: ${err.message}`)
    } finally {
      setUploading(false)
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) handleLogoUpload(file)
    e.target.value = '' // reset input
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleLogoUpload(file)
  }

  const handleRemoveLogo = async () => {
    if (!form.logoUrl) return
    if (!window.confirm('Hapus logo klinik saat ini?')) return
    try {
      const oldPath = form.logoUrl.split('/storage/v1/object/public/assets/')[1]
      if (oldPath) {
        await supabase.storage.from('assets').remove([oldPath])
      }
    } catch (_) { /* ignore */ }
    set('logoUrl', '')
    toast.success('Logo berhasil dihapus.')
  }

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

        {/* Laporan & Logo */}
        <div className="card">
          <div className="card-header">
            <div className="flex items-center gap-2"><FileText className="w-4 h-4 text-primary-600" /><span className="section-title">Pengaturan Laporan & Cetak</span></div>
          </div>
          <div className="card-body space-y-4">
            <div>
              <label className="form-label">Teks Footer Laporan / Invoice</label>
              <textarea className="form-textarea" rows={2} value={form.footerText || ''} onChange={e => set('footerText', e.target.value)} placeholder="Teks yang muncul di footer setiap laporan dan invoice…" />
            </div>

            {/* Logo Upload Area */}
            <div>
              <label className="form-label">Logo Klinik</label>
              <div className="flex items-start gap-5">
                {/* Preview */}
                <div className="flex-shrink-0 w-28 h-28 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden">
                  {form.logoUrl ? (
                    <img src={form.logoUrl} alt="Logo Klinik" className="w-full h-full object-contain p-1.5" />
                  ) : (
                    <ImageIcon className="w-10 h-10 text-slate-300" />
                  )}
                </div>

                {/* Upload + Actions */}
                <div className="flex-1 space-y-2.5">
                  {/* Drag & Drop Zone */}
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => !uploading && fileInputRef.current?.click()}
                    className={`
                      relative cursor-pointer rounded-xl border-2 border-dashed px-4 py-5 text-center transition-all duration-200
                      ${dragOver
                        ? 'border-primary-400 bg-primary-50 scale-[1.01]'
                        : 'border-slate-200 bg-slate-50/50 hover:border-primary-300 hover:bg-primary-50/50'}
                      ${uploading ? 'pointer-events-none opacity-60' : ''}
                    `}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/gif,image/svg+xml,image/webp"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    {uploading ? (
                      <div className="flex items-center justify-center gap-2 text-primary-600">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="text-sm font-medium">Mengunggah logo…</span>
                      </div>
                    ) : (
                      <div>
                        <Upload className="w-6 h-6 mx-auto mb-1.5 text-slate-400" />
                        <p className="text-sm font-medium text-slate-600">
                          {dragOver ? 'Lepaskan file di sini' : 'Klik atau seret file ke sini'}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">PNG, JPG, SVG, WebP — Maks. 5 MB</p>
                      </div>
                    )}
                  </div>

                  {/* Remove Button */}
                  {form.logoUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="inline-flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 font-medium transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />Hapus Logo
                    </button>
                  )}

                  <p className="text-xs text-slate-400">Logo akan ditampilkan di header laporan PDF dan invoice.</p>
                </div>
              </div>
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
