import { useState } from 'react'
import { Trash2, DollarSign, FileText, CheckCircle, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react'
import { fmtIDR, fmtDate, todayISO } from '../../utils/format'
import toast from 'react-hot-toast'

const DISPOSAL_METHODS = [
  { value: 'SALE', label: 'Penjualan', icon: DollarSign, description: 'Aset dijual ke pihak ketiga' },
  { value: 'DISPOSAL', label: 'Penghapusan', icon: Trash2, description: 'Aset dihapus karena rusak/kadaluarsa' },
  { value: 'DONATION', label: 'Hibah', icon: FileText, description: 'Aset dihibahkan ke pihak lain' },
]

const STEPS = [
  { id: 1, title: 'Pilih Aset', icon: FileText },
  { id: 2, title: 'Metode Pelepasan', icon: Trash2 },
  { id: 3, title: 'Nilai & Perhitungan', icon: DollarSign },
  { id: 4, title: 'Review & Konfirmasi', icon: CheckCircle },
]

/**
 * Asset Disposal Wizard Component
 * Step-by-step wizard for asset disposal with automatic gain/loss calculation
 */
export default function AssetDisposalWizard({ assets, onComplete, onCancel }) {
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState({
    assetId: '',
    disposalMethod: 'SALE',
    disposalDate: todayISO(),
    disposalValue: '',
    referenceNumber: '',
    buyerName: '',
    description: '',
    reason: '',
  })

  const selectedAsset = assets.find(a => a.id === formData.assetId)
  
  // Calculate gain/loss
  const bookValue = selectedAsset ? (selectedAsset.bookValue || selectedAsset.acquisitionCost) : 0
  const disposalValue = parseFloat(formData.disposalValue || 0)
  const gainLoss = disposalValue - bookValue
  const isGain = gainLoss > 0
  const isLoss = gainLoss < 0

  const set = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  const nextStep = () => {
    // Validation for each step
    if (currentStep === 1 && !formData.assetId) {
      toast.error('Pilih aset yang akan dilepas')
      return
    }
    if (currentStep === 2 && !formData.disposalMethod) {
      toast.error('Pilih metode pelepasan')
      return
    }
    if (currentStep === 3) {
      if (!formData.disposalValue || parseFloat(formData.disposalValue) < 0) {
        toast.error('Nilai pelepasan harus diisi dan tidak boleh negatif')
        return
      }
      if (formData.disposalMethod === 'SALE' && !formData.buyerName) {
        toast.error('Nama pembeli wajib diisi untuk penjualan')
        return
      }
    }

    if (currentStep < 4) {
      setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSubmit = () => {
    if (!selectedAsset) {
      toast.error('Aset tidak valid')
      return
    }

    const disposalData = {
      asset: selectedAsset,
      disposalMethod: formData.disposalMethod,
      disposalDate: formData.disposalDate,
      disposalValue,
      bookValue,
      gainLoss,
      referenceNumber: formData.referenceNumber,
      buyerName: formData.buyerName,
      description: formData.description,
      reason: formData.reason,
    }

    onComplete(disposalData)
  }

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-between">
        {STEPS.map((step, index) => {
          const Icon = step.icon
          const isActive = currentStep === step.id
          const isCompleted = currentStep > step.id

          return (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    isCompleted
                      ? 'bg-green-600 text-white'
                      : isActive
                      ? 'bg-primary-600 text-white ring-4 ring-primary-100'
                      : 'bg-slate-200 text-slate-400'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>
                <p
                  className={`text-xs mt-2 font-medium ${
                    isActive ? 'text-primary-700' : isCompleted ? 'text-green-700' : 'text-slate-400'
                  }`}
                >
                  {step.title}
                </p>
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={`h-1 flex-1 mx-2 transition-all ${
                    isCompleted ? 'bg-green-600' : 'bg-slate-200'
                  }`}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Step Content */}
      <div className="min-h-[400px]">
        {/* Step 1: Select Asset */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-1">Pilih Aset yang Akan Dilepas</h3>
              <p className="text-sm text-slate-500">
                Pilih aset tetap yang akan dijual atau dihapuskan dari inventaris
              </p>
            </div>

            <div>
              <label className="form-label">Aset *</label>
              <select
                className="form-select"
                value={formData.assetId}
                onChange={e => set('assetId', e.target.value)}
              >
                <option value="">-- Pilih Aset --</option>
                {assets.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.assetCode} - {a.assetName} ({fmtIDR(a.bookValue || a.acquisitionCost)})
                  </option>
                ))}
              </select>
            </div>

            {selectedAsset && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <h4 className="font-semibold text-slate-800 mb-3">Detail Aset</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-slate-500">Kode Aset</p>
                    <p className="font-semibold">{selectedAsset.assetCode}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Kategori</p>
                    <p className="font-semibold">{selectedAsset.category}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Harga Perolehan</p>
                    <p className="font-semibold text-emerald-700">{fmtIDR(selectedAsset.acquisitionCost)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Akumulasi Penyusutan</p>
                    <p className="font-semibold text-amber-700">
                      {fmtIDR(selectedAsset.accumulatedDepreciation || 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Nilai Buku Saat Ini</p>
                    <p className="font-semibold text-lg text-purple-700">
                      {fmtIDR(selectedAsset.bookValue || selectedAsset.acquisitionCost)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Lokasi</p>
                    <p className="font-semibold">{selectedAsset.location || '—'}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Disposal Method */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-1">Metode Pelepasan Aset</h3>
              <p className="text-sm text-slate-500">
                Pilih cara pelepasan aset dari inventaris perusahaan
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {DISPOSAL_METHODS.map(method => {
                const Icon = method.icon
                const isSelected = formData.disposalMethod === method.value

                return (
                  <button
                    key={method.value}
                    type="button"
                    onClick={() => set('disposalMethod', method.value)}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      isSelected
                        ? 'border-primary-600 bg-primary-50'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-2 rounded-lg ${
                          isSelected ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-slate-800">{method.label}</h4>
                        <p className="text-sm text-slate-500 mt-1">{method.description}</p>
                      </div>
                      {isSelected && (
                        <CheckCircle className="w-5 h-5 text-primary-600 flex-shrink-0" />
                      )}
                    </div>
                  </button>
                )
              })}
            </div>

            <div>
              <label className="form-label">Alasan Pelepasan *</label>
              <textarea
                className="form-textarea"
                rows={3}
                value={formData.reason}
                onChange={e => set('reason', e.target.value)}
                placeholder="Jelaskan alasan pelepasan aset ini…"
              />
            </div>
          </div>
        )}

        {/* Step 3: Value & Calculation */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-1">Nilai Pelepasan & Perhitungan</h3>
              <p className="text-sm text-slate-500">
                Masukkan nilai pelepasan untuk menghitung laba/rugi otomatis
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label">Tanggal Pelepasan *</label>
                <input
                  type="date"
                  className="form-input"
                  value={formData.disposalDate}
                  onChange={e => set('disposalDate', e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Nomor Referensi</label>
                <input
                  className="form-input"
                  value={formData.referenceNumber}
                  onChange={e => set('referenceNumber', e.target.value)}
                  placeholder="No. dokumen/kontrak…"
                />
              </div>
            </div>

            {formData.disposalMethod === 'SALE' && (
              <div>
                <label className="form-label">Nama Pembeli *</label>
                <input
                  className="form-input"
                  value={formData.buyerName}
                  onChange={e => set('buyerName', e.target.value)}
                  placeholder="Nama pembeli atau perusahaan…"
                />
              </div>
            )}

            <div>
              <label className="form-label">
                Nilai Pelepasan (Rp) *
                <span className="text-xs text-slate-400 ml-2 font-normal">
                  {formData.disposalMethod === 'SALE' ? 'Harga jual' : 'Nilai sisa/nilai pasar'}
                </span>
              </label>
              <input
                type="number"
                className="form-input"
                value={formData.disposalValue}
                onChange={e => set('disposalValue', e.target.value)}
                min={0}
                step={1000}
                placeholder="0"
              />
            </div>

            {/* Gain/Loss Calculation */}
            {formData.disposalValue && selectedAsset && (
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-lg p-4">
                <h4 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Perhitungan Laba/Rugi Pelepasan
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Nilai Buku Aset:</span>
                    <span className="font-mono font-semibold">{fmtIDR(bookValue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Nilai Pelepasan:</span>
                    <span className="font-mono font-semibold">{fmtIDR(disposalValue)}</span>
                  </div>
                  <div className="border-t border-slate-300 pt-2 mt-2">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-800 font-semibold flex items-center gap-2">
                        {isGain ? (
                          <>
                            <TrendingUp className="w-4 h-4 text-green-600" />
                            Laba Pelepasan:
                          </>
                        ) : isLoss ? (
                          <>
                            <TrendingDown className="w-4 h-4 text-red-600" />
                            Rugi Pelepasan:
                          </>
                        ) : (
                          'Impas:'
                        )}
                      </span>
                      <span
                        className={`font-mono font-bold text-lg ${
                          isGain ? 'text-green-700' : isLoss ? 'text-red-700' : 'text-slate-700'
                        }`}
                      >
                        {fmtIDR(Math.abs(gainLoss))}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="form-label">Keterangan Tambahan</label>
              <textarea
                className="form-textarea"
                rows={2}
                value={formData.description}
                onChange={e => set('description', e.target.value)}
                placeholder="Informasi tambahan tentang transaksi pelepasan…"
              />
            </div>
          </div>
        )}

        {/* Step 4: Review & Confirm */}
        {currentStep === 4 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-1">Review & Konfirmasi</h3>
              <p className="text-sm text-slate-500">
                Periksa kembali informasi pelepasan aset sebelum disimpan
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-800">
                <strong>Perhatian:</strong> Pelepasan aset akan mengubah status aset menjadi{' '}
                <strong>{formData.disposalMethod === 'SALE' ? 'SOLD' : 'DISPOSED'}</strong> dan membuat jurnal
                otomatis untuk mencatat {isGain ? 'laba' : isLoss ? 'rugi' : 'impas'} pelepasan.
              </div>
            </div>

            {/* Summary */}
            <div className="border border-slate-200 rounded-lg divide-y divide-slate-200">
              <div className="p-4 bg-slate-50">
                <h4 className="font-semibold text-slate-800">Ringkasan Pelepasan Aset</h4>
              </div>
              <div className="p-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Aset:</span>
                  <span className="font-semibold">
                    {selectedAsset?.assetCode} - {selectedAsset?.assetName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Metode Pelepasan:</span>
                  <span className="font-semibold">
                    {DISPOSAL_METHODS.find(m => m.value === formData.disposalMethod)?.label}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Tanggal Pelepasan:</span>
                  <span className="font-semibold">{fmtDate(formData.disposalDate)}</span>
                </div>
                {formData.buyerName && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Pembeli:</span>
                    <span className="font-semibold">{formData.buyerName}</span>
                  </div>
                )}
                {formData.referenceNumber && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Referensi:</span>
                    <span className="font-semibold">{formData.referenceNumber}</span>
                  </div>
                )}
              </div>
              <div className="p-4 bg-slate-50 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Nilai Buku:</span>
                  <span className="font-mono font-semibold">{fmtIDR(bookValue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Nilai Pelepasan:</span>
                  <span className="font-mono font-semibold">{fmtIDR(disposalValue)}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                  <span className="text-slate-800 font-semibold">
                    {isGain ? 'Laba Pelepasan' : isLoss ? 'Rugi Pelepasan' : 'Impas'}:
                  </span>
                  <span
                    className={`font-mono font-bold text-lg ${
                      isGain ? 'text-green-700' : isLoss ? 'text-red-700' : 'text-slate-700'
                    }`}
                  >
                    {fmtIDR(Math.abs(gainLoss))}
                  </span>
                </div>
              </div>
              {formData.reason && (
                <div className="p-4">
                  <p className="text-xs text-slate-500 mb-1">Alasan Pelepasan:</p>
                  <p className="text-sm text-slate-700">{formData.reason}</p>
                </div>
              )}
              {formData.description && (
                <div className="p-4">
                  <p className="text-xs text-slate-500 mb-1">Keterangan:</p>
                  <p className="text-sm text-slate-700">{formData.description}</p>
                </div>
              )}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-xs text-blue-700">
              <strong>Jurnal yang akan dibuat:</strong>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Debit: Kas/Bank - {fmtIDR(disposalValue)}</li>
                <li>Debit: Akumulasi Penyusutan - {fmtIDR(selectedAsset?.accumulatedDepreciation || 0)}</li>
                {isLoss && <li>Debit: Rugi Pelepasan Aset - {fmtIDR(Math.abs(gainLoss))}</li>}
                <li>Credit: Aset Tetap ({selectedAsset?.coaAssetCode}) - {fmtIDR(selectedAsset?.acquisitionCost || 0)}</li>
                {isGain && <li>Credit: Laba Pelepasan Aset - {fmtIDR(gainLoss)}</li>}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between pt-4 border-t border-slate-200">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Batal
        </button>
        <div className="flex gap-2">
          {currentStep > 1 && (
            <button type="button" className="btn-secondary" onClick={prevStep}>
              Kembali
            </button>
          )}
          {currentStep < 4 ? (
            <button type="button" className="btn-primary" onClick={nextStep}>
              Lanjut
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={handleSubmit}>
              <CheckCircle className="w-4 h-4" />
              Konfirmasi Pelepasan
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
