import { useState, useMemo } from 'react'
import { FileText, Building2, MapPin, Calendar, TrendingDown, Package, Search, Download, FileSpreadsheet } from 'lucide-react'
import { useStore } from '../../store/useStore'
import SearchInput from '../../components/ui/SearchInput'
import { fmtIDR, fmtDate } from '../../utils/format'
import { exportAssetCardToExcel, printAssetCard } from '../../utils/exportUtils'
import toast from 'react-hot-toast'

// ─── Asset Card Detail Component ──────────────────────────────
function AssetCardDetail({ asset, mutations, depreciations }) {
  // Sort mutations by date
  const sortedMutations = [...mutations].sort((a, b) =>
    new Date(b.mutationDate) - new Date(a.mutationDate)
  )

  // Sort depreciations by period
  const sortedDepreciations = [...depreciations]
    .filter(d => d.status === 'POSTED')
    .sort((a, b) => {
      if (a.periodYear !== b.periodYear) return b.periodYear - a.periodYear
      return b.periodMonth - a.periodMonth
    })

  const totalDepreciation = sortedDepreciations.reduce((sum, d) => sum + d.depreciationAmount, 0)
  const currentBookValue = asset.acquisitionCost - totalDepreciation

  return (
    <div className="space-y-5">
      {/* Asset Header */}
      <div className="card">
        <div className="card-header bg-gradient-to-r from-primary-600 to-primary-700 text-white">
          <div>
            <h2 className="text-xl font-bold">{asset.assetCode}</h2>
            <p className="text-primary-100 text-sm mt-1">{asset.assetName}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-primary-200">Nilai Buku Saat Ini</p>
            <p className="text-2xl font-bold">{fmtIDR(currentBookValue)}</p>
          </div>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-slate-500 mb-1">Kategori</p>
              <p className="font-semibold text-slate-800">{asset.category}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Lokasi</p>
              <p className="font-semibold text-slate-800 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                {asset.location || '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Kondisi</p>
              <p className="font-semibold text-slate-800">{asset.condition}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Departemen</p>
              <p className="font-semibold text-slate-800">{asset.department || '—'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Acquisition Info */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Package className="w-5 h-5 text-primary-600" />
            Informasi Perolehan
          </h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-slate-500 mb-1">Tanggal Perolehan</p>
              <p className="font-semibold text-slate-800">{fmtDate(asset.acquisitionDate)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Harga Perolehan</p>
              <p className="font-semibold text-emerald-700">{fmtIDR(asset.acquisitionCost)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Umur Ekonomis</p>
              <p className="font-semibold text-slate-800">{asset.usefulLifeYears} tahun</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Akumulasi Penyusutan</p>
              <p className="font-semibold text-amber-700">{fmtIDR(totalDepreciation)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Nilai Buku</p>
              <p className="font-semibold text-purple-700">{fmtIDR(currentBookValue)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Penyusutan Terakhir</p>
              <p className="font-semibold text-slate-800">
                {asset.lastDepreciationDate ? fmtDate(asset.lastDepreciationDate) : '—'}
              </p>
            </div>
          </div>
          {asset.description && (
            <div className="mt-4 pt-4 border-t border-slate-200">
              <p className="text-xs text-slate-500 mb-1">Deskripsi</p>
              <p className="text-sm text-slate-700">{asset.description}</p>
            </div>
          )}
        </div>
      </div>

      {/* COA Mapping */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-slate-800">Akun COA Terkait</h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-slate-500 mb-1">Akun Aset</p>
              <p className="font-mono font-semibold text-slate-800">{asset.coaAssetCode}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Akun Beban Penyusutan</p>
              <p className="font-mono font-semibold text-slate-800">{asset.coaDepreciationCode}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Akun Akumulasi Penyusutan</p>
              <p className="font-mono font-semibold text-slate-800">{asset.coaAccumulatedCode}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Depreciation History */}
      {sortedDepreciations.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-primary-600" />
              Riwayat Penyusutan
            </h3>
            <span className="text-sm text-slate-500">{sortedDepreciations.length} periode</span>
          </div>
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Periode</th>
                  <th className="text-right">Nilai Buku Awal</th>
                  <th className="text-right">Beban Penyusutan</th>
                  <th className="text-right">Nilai Buku Akhir</th>
                  <th>Tanggal Post</th>
                </tr>
              </thead>
              <tbody>
                {sortedDepreciations.map(d => (
                  <tr key={d.id}>
                    <td className="font-semibold">
                      {fmtMonthYear(new Date(d.periodYear, d.periodMonth - 1))}
                    </td>
                    <td className="text-right font-mono text-sm">{fmtIDR(d.openingBookValue)}</td>
                    <td className="text-right font-mono text-sm font-semibold text-amber-700">
                      {fmtIDR(d.depreciationAmount)}
                    </td>
                    <td className="text-right font-mono text-sm font-semibold text-purple-700">
                      {fmtIDR(d.closingBookValue)}
                    </td>
                    <td className="text-sm text-slate-500">{fmtDate(d.postedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Mutation History */}
      {sortedMutations.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary-600" />
              Riwayat Mutasi
            </h3>
            <span className="text-sm text-slate-500">{sortedMutations.length} transaksi</span>
          </div>
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Jenis Mutasi</th>
                  <th>Detail</th>
                  <th className="text-right">Nilai</th>
                  <th>Referensi</th>
                </tr>
              </thead>
              <tbody>
                {sortedMutations.map(m => (
                  <tr key={m.id}>
                    <td className="text-sm">{fmtDate(m.mutationDate)}</td>
                    <td>
                      <span className="badge badge-blue text-xs">{m.mutationType}</span>
                    </td>
                    <td className="text-sm text-slate-600">
                      {m.mutationType === 'TRANSFER'
                        ? `${m.fromLocation || '?'} → ${m.toLocation || '?'}`
                        : m.description
                      }
                    </td>
                    <td className="text-right font-mono text-sm">
                      {m.disposalValue ? fmtIDR(m.disposalValue) : m.amount ? fmtIDR(m.amount) : '—'}
                    </td>
                    <td className="text-sm text-slate-500">{m.referenceNumber || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────
export default function AssetCardPage() {
  const {
    fixedAssets,
    assetMutations,
    assetDepreciations,
    loading
  } = useStore()

  const [search, setSearch] = useState('')
  const [locationFilter, setLocationFilter] = useState('ALL')
  const [selectedAssetId, setSelectedAssetId] = useState(null)

  // Get unique locations
  const locations = useMemo(() => {
    const locs = new Set()
    fixedAssets.forEach(a => {
      if (a.location) locs.add(a.location)
    })
    return Array.from(locs).sort()
  }, [fixedAssets])

  // Filter assets
  const filteredAssets = useMemo(() =>
    fixedAssets
      .filter(a => a.status === 'ACTIVE')
      .filter(a => locationFilter === 'ALL' || a.location === locationFilter)
      .filter(a => !search ||
        a.assetName.toLowerCase().includes(search.toLowerCase()) ||
        a.assetCode.toLowerCase().includes(search.toLowerCase()) ||
        (a.location || '').toLowerCase().includes(search.toLowerCase()) ||
        (a.department || '').toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => a.assetCode.localeCompare(b.assetCode)),
    [fixedAssets, locationFilter, search]
  )

  const selectedAsset = fixedAssets.find(a => a.id === selectedAssetId)
  const selectedMutations = assetMutations.filter(m => m.assetId === selectedAssetId)
  const selectedDepreciations = assetDepreciations.filter(d => d.assetId === selectedAssetId)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-slate-500">Memuat kartu aset...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <FileText className="w-7 h-7 text-primary-600" />
            Kartu Inventaris Aset
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Kartu riwayat lengkap per aset: perolehan, penyusutan, mutasi, dan lokasi
          </p>
        </div>
        {selectedAsset && (
          <div className="flex gap-2">
            <button
              className="btn-secondary"
              onClick={() => {
                exportAssetCardToExcel(selectedAsset, selectedMutations, selectedDepreciations)
                toast.success('Kartu aset berhasil di-export ke Excel')
              }}
            >
              <FileSpreadsheet className="w-4 h-4" />
              Export Excel
            </button>
            <button
              className="btn-secondary"
              onClick={() => {
                printAssetCard(selectedAsset, selectedMutations, selectedDepreciations)
                toast.success('Membuka dialog cetak/PDF')
              }}
            >
              <Download className="w-4 h-4" />
              Cetak/PDF
            </button>
          </div>
        )}
      </div>

      {/* Stats with Bright Solid Theme */}
      <div className="grid grid-cols-4 gap-4">
        <div className="card card-body bg-blue-500 text-white border-0 shadow-sm">
          <p className="text-xs text-blue-100 uppercase tracking-wider font-semibold mb-1">Total Aset Aktif</p>
          <p className="font-bold text-3xl font-mono text-white">
            {fixedAssets.filter(a => a.status === 'ACTIVE').length}
          </p>
        </div>
        <div className="card card-body bg-purple-500 text-white border-0 shadow-sm">
          <p className="text-xs text-purple-100 uppercase tracking-wider font-semibold mb-1">Lokasi Terdaftar</p>
          <p className="font-bold text-3xl font-mono text-white">{locations.length}</p>
        </div>
        <div className="card card-body bg-emerald-500 text-white border-0 shadow-sm">
          <p className="text-xs text-emerald-100 uppercase tracking-wider font-semibold mb-1">Total Penyusutan</p>
          <p className="font-bold text-xl font-mono text-white">
            {fmtIDR(assetDepreciations
              .filter(d => d.status === 'POSTED')
              .reduce((sum, d) => sum + d.depreciationAmount, 0)
            )}
          </p>
        </div>
        <div className="card card-body bg-amber-500 text-white border-0 shadow-sm">
          <p className="text-xs text-amber-100 uppercase tracking-wider font-semibold mb-1">Total Mutasi</p>
          <p className="font-bold text-3xl font-mono text-white">{assetMutations.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-5">
        {/* Asset List */}
        <div className="col-span-12 lg:col-span-4">
          <div className="card sticky top-5">
            <div className="card-header">
              <h3 className="font-semibold text-slate-800">Daftar Aset</h3>
            </div>
            <div className="p-4 border-b border-slate-200">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Cari aset…"
                className="w-full"
              />
              <select
                className="form-select mt-2"
                value={locationFilter}
                onChange={e => setLocationFilter(e.target.value)}
              >
                <option value="ALL">Semua Lokasi ({fixedAssets.filter(a => a.status === 'ACTIVE').length})</option>
                {locations.map(loc => (
                  <option key={loc} value={loc}>
                    {loc} ({fixedAssets.filter(a => a.location === loc && a.status === 'ACTIVE').length})
                  </option>
                ))}
              </select>
            </div>
            <div className="max-h-[600px] overflow-y-auto">
              {filteredAssets.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <Building2 className="w-10 h-10 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">Tidak ada aset</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {filteredAssets.map(asset => (
                    <button
                      key={asset.id}
                      onClick={() => setSelectedAssetId(asset.id)}
                      className={`w-full text-left p-3 hover:bg-slate-50 transition-colors ${selectedAssetId === asset.id ? 'bg-primary-50 border-l-4 border-primary-600' : ''
                        }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-xs text-primary-700 font-semibold">{asset.assetCode}</p>
                          <p className="font-medium text-sm text-slate-800 truncate mt-0.5">{asset.assetName}</p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                            <MapPin className="w-3 h-3" />
                            <span>{asset.location || 'No location'}</span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs text-slate-500">Nilai Buku</p>
                          <p className="font-mono text-xs font-semibold text-purple-700">
                            {fmtIDR(asset.bookValue || asset.acquisitionCost)}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Asset Card Detail */}
        <div className="col-span-12 lg:col-span-8">
          {selectedAsset ? (
            <AssetCardDetail
              asset={selectedAsset}
              mutations={selectedMutations}
              depreciations={selectedDepreciations}
            />
          ) : (
            <div className="card card-body text-center py-20">
              <Search className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <p className="text-lg font-medium text-slate-600 mb-2">Pilih Aset untuk Melihat Detail</p>
              <p className="text-sm text-slate-400">
                Pilih aset dari daftar di sebelah kiri untuk melihat kartu inventaris lengkap
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
