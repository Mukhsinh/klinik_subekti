import { useState, useMemo } from 'react'
import { Package, AlertCircle, CheckCircle, X, Search } from 'lucide-react'
import Modal from '../ui/Modal'
import { fmtIDR } from '../../utils/format'
import toast from 'react-hot-toast'

export default function AddPharmacyItemModal({
  open,
  onClose,
  pharmacyItems,
  invBatches,
  getItemStock,
  onAdd
}) {
  const [selectedItem, setSelectedItem] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')

  // Filter and prepare pharmacy options
  const availableItems = useMemo(() => {
    return (pharmacyItems || [])
      .filter(i => i.isActive !== false && i.is_active !== false)
      .map(i => {
        const stock = (invBatches || [])
          .filter(b => b.itemId === i.id && b.quantityCurrent > 0)
          .reduce((s, b) => s + b.quantityCurrent, 0)

        const catRaw = i.category || i.itemCategory || i.item_category || ''
        let categoryLabel = 'BHP'
        if (catRaw === 'OBAT_PATEN' || catRaw === 'BRANDED') categoryLabel = 'BRANDED'
        else if (catRaw === 'OBAT_GENERIK' || catRaw === 'GENERIK') categoryLabel = 'GENERIK'
        else if (catRaw === 'BHP' || catRaw === 'BHP_MEDIS') categoryLabel = 'BHP'
        else if (catRaw === 'RUMAH_TANGGA' || catRaw === 'RT') categoryLabel = 'RT'

        const code = i.itemCode || i.skuCode || i.item_code || i.sku_code || 'SKU'
        const name = i.itemName || i.item_name || 'Item'
        const price = i.sellingPrice || i.selling_price || 0

        return {
          ...i,
          id: i.id,
          itemCode: code,
          itemName: name,
          sellingPrice: price,
          stock,
          categoryLabel,
          searchText: `${code} ${name}`.toLowerCase()
        }
      })
      .filter(i => i.stock > 0) // Only show items with stock
      .sort((a, b) => a.itemName.localeCompare(b.itemName))
  }, [pharmacyItems, invBatches])

  // Filter items based on search
  const filteredItems = useMemo(() => {
    if (!searchTerm) return availableItems
    const term = searchTerm.toLowerCase()
    return availableItems.filter(i => i.searchText.includes(term))
  }, [availableItems, searchTerm])

  const handleSelectItem = (item) => {
    setSelectedItem(item)
    setQuantity(1)
  }

  const handleAdd = () => {
    if (!selectedItem) {
      toast.error('Pilih obat terlebih dahulu')
      return
    }

    if (quantity <= 0) {
      toast.error('Jumlah harus lebih dari 0')
      return
    }

    if (quantity > selectedItem.stock) {
      toast.error(`Stok tidak mencukupi! Tersedia: ${selectedItem.stock}`)
      return
    }

    onAdd({
      itemId: selectedItem.id,
      name: selectedItem.itemName,
      qty: quantity,
      price: selectedItem.sellingPrice || 0,
      availableStock: selectedItem.stock
    })

    // Reset form
    setSelectedItem(null)
    setQuantity(1)
    setSearchTerm('')
    toast.success(`${selectedItem.itemName} berhasil ditambahkan`)
  }

  const handleClose = () => {
    setSelectedItem(null)
    setQuantity(1)
    setSearchTerm('')
    onClose()
  }

  const isOverStock = selectedItem && quantity > selectedItem.stock

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Tambah Obat ke Billing"
      size="lg"
      footer={
        <>
          <button className="btn-secondary" onClick={handleClose}>
            <X className="w-4 h-4" />
            Batal
          </button>
          <button
            className="btn-primary"
            onClick={handleAdd}
            disabled={!selectedItem || isOverStock}
          >
            <CheckCircle className="w-4 h-4" />
            Tambahkan
          </button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            className="form-input pl-10"
            placeholder="Cari kode atau nama obat..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
          />
        </div>

        {/* Item List */}
        <div>
          <label className="form-label mb-2">Pilih Obat ({filteredItems.length} tersedia)</label>
          <div className="border border-slate-200 rounded-xl max-h-80 overflow-y-auto">
            {filteredItems.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">
                  {searchTerm ? 'Tidak ada obat yang cocok' : 'Tidak ada obat tersedia'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectItem(item)}
                    className={`w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors ${selectedItem?.id === item.id ? 'bg-primary-50 border-l-4 border-primary-600' : ''
                      }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded ${item.category === 'OBAT_PATEN'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-green-100 text-green-700'
                            }`}>
                            {item.categoryLabel}
                          </span>
                          <span className="text-xs text-slate-500 font-mono">{item.itemCode}</span>
                        </div>
                        <h4 className="font-semibold text-slate-900 mb-1">{item.itemName}</h4>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-slate-600">
                            Harga: <span className="font-mono font-semibold">{fmtIDR(item.sellingPrice || 0)}</span>
                          </span>
                          <span className={`font-medium ${item.stock < 50 ? 'text-orange-600' : 'text-emerald-600'}`}>
                            Stok: {item.stock} unit
                          </span>
                        </div>
                      </div>
                      {selectedItem?.id === item.id && (
                        <div className="flex-shrink-0">
                          <div className="w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center">
                            <CheckCircle className="w-4 h-4 text-white" />
                          </div>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quantity Input */}
        {selectedItem && (
          <div className="bg-slate-50 rounded-xl p-4 space-y-4 border border-slate-200">
            <div className="flex items-start justify-between">
              <div>
                <h5 className="font-semibold text-slate-900 mb-1">{selectedItem.itemName}</h5>
                <p className="text-sm text-slate-600">
                  {fmtIDR(selectedItem.sellingPrice)} × Quantity = <span className="font-mono font-bold text-primary-700">{fmtIDR(selectedItem.sellingPrice * quantity)}</span>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label">Jumlah *</label>
                <input
                  type="number"
                  className={`form-input text-center text-lg font-semibold ${isOverStock ? 'border-red-500 bg-red-50' : ''
                    }`}
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                  min={1}
                  max={selectedItem.stock}
                />
              </div>
              <div>
                <label className="form-label">Stok Tersedia</label>
                <div className={`form-input bg-white text-center text-lg font-bold ${isOverStock ? 'text-red-600' : 'text-emerald-600'
                  }`}>
                  {selectedItem.stock} unit
                </div>
              </div>
            </div>

            {/* Warning if over stock */}
            {isOverStock && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-900">Stok tidak mencukupi!</p>
                  <p className="text-xs text-red-700 mt-1">
                    Jumlah yang Anda minta ({quantity} unit) melebihi stok tersedia ({selectedItem.stock} unit).
                    Silakan kurangi jumlah atau pilih obat lain.
                  </p>
                </div>
              </div>
            )}

            {/* Stock warning */}
            {!isOverStock && selectedItem.stock < 50 && (
              <div className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-orange-900">Stok menipis</p>
                  <p className="text-xs text-orange-700 mt-1">
                    Stok obat ini tersisa {selectedItem.stock} unit. Pertimbangkan untuk melakukan pemesanan ulang.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!selectedItem && (
          <div className="text-center py-8 text-slate-400">
            <Package className="w-16 h-16 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Pilih obat dari daftar di atas untuk melanjutkan</p>
          </div>
        )}
      </div>
    </Modal>
  )
}
