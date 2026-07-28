import { useState, useEffect, useMemo } from 'react'
import { useStore } from '../../store/useStore'
import { Search, Save, Package, RefreshCw } from 'lucide-react'
import { fmtIDR } from '../../utils/format'
import toast from 'react-hot-toast'

export default function InventoryOpeningBalancePage() {
    const {
        pharmacyItems,
        invBatches,
        saveInventoryOpeningBalance,
        refreshAll,
    } = useStore()

    const [searchTerm, setSearchTerm] = useState('')
    const [editableBalances, setEditableBalances] = useState({})
    const [saving, setSaving] = useState(false)

    // Initialize editable balances from loaded batches
    useEffect(() => {
        const balanceMap = {}
        pharmacyItems.forEach(item => {
            const match = invBatches.find(
                b => b.itemId === item.id && b.batchNumber === 'SALDO-AWAL'
            )
            balanceMap[item.id] = {
                quantity: match ? match.quantityReceived : 0,
                unitCost: match ? match.unitCostPrice : 0,
            }
        })
        setEditableBalances(balanceMap)
    }, [pharmacyItems, invBatches])

    // Filters items by search query
    const filteredItems = useMemo(() => {
        const q = searchTerm.toLowerCase()
        return pharmacyItems.filter(
            item =>
                item.itemName.toLowerCase().includes(q) ||
                (item.itemCode || '').toLowerCase().includes(q) ||
                (item.skuCode || '').toLowerCase().includes(q)
        )
    }, [pharmacyItems, searchTerm])

    const handleQtyChange = (itemId, val) => {
        setEditableBalances(prev => ({
            ...prev,
            [itemId]: {
                ...prev[itemId],
                quantity: val === '' ? 0 : parseInt(val) || 0,
            },
        }))
    }

    const handleCostChange = (itemId, val) => {
        setEditableBalances(prev => ({
            ...prev,
            [itemId]: {
                ...prev[itemId],
                unitCost: val === '' ? 0 : parseFloat(val) || 0,
            },
        }))
    }

    const handleSave = async () => {
        // Collect non-zero opening balances
        const dataToSave = Object.entries(editableBalances)
            .map(([itemId, val]) => ({
                itemId,
                quantity: val.quantity,
                unitCost: val.unitCost,
            }))
            .filter(item => item.quantity > 0) // only save items with positive quantity

        if (dataToSave.length === 0) {
            toast.error('Tidak ada saldo awal dengan Qty > 0 yang diisi.')
            return
        }

        setSaving(true)
        try {
            await saveInventoryOpeningBalance(dataToSave)
            toast.success('Saldo awal persediaan berhasil disimpan.')
            if (refreshAll) await refreshAll()
        } catch (e) {
            toast.error(`Gagal menyimpan: ${e.message}`)
        } finally {
            setSaving(false)
        }
    }

    const grandTotalValue = useMemo(() => {
        return Object.values(editableBalances).reduce((acc, curr) => {
            return acc + (curr.quantity * curr.unitCost)
        }, 0)
    }, [editableBalances])

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                    <h1 className="page-title">Saldo Awal Persediaan (Inventory)</h1>
                    <p className="text-sm text-slate-400 mt-0.5">
                        Input saldo awal kuantitas dan harga pokok (HPP) untuk setiap item barang medis / farmasi.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                    <button className="btn-orange">
                        <Package className="w-4 h-4" />Unduh Template Impor
                    </button>
                    <button className="btn-emerald">
                        <Package className="w-4 h-4" />Impor Data
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="btn-danger-red"
                    >
                        <Save className="w-4 h-4" /> {saving ? 'Menyimpan...' : 'Simpan Saldo Awal'}
                    </button>
                    <button className="btn-royal-blue">
                        <Package className="w-4 h-4" />Unduh Laporan
                    </button>
                    {refreshAll && (
                        <button className="btn-square-refresh" onClick={refreshAll} title="Tarik data terbaru">
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Summary card & Search */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="card card-body bg-emerald-500 text-white border-0 shadow-sm md:col-span-2 flex items-center justify-between">
                    <div>
                        <p className="text-xs text-emerald-100 font-semibold uppercase tracking-wider mb-1">Total Nilai Saldo Awal Persediaan</p>
                        <p className="font-extrabold text-3xl font-mono text-white">{fmtIDR(grandTotalValue)}</p>
                    </div>
                    <div className="text-sm text-emerald-100 font-semibold bg-emerald-600/50 px-3 py-1.5 rounded-lg">
                        {Object.values(editableBalances).filter(b => b.quantity > 0).length} item terisi saldo awal
                    </div>
                </div>

                <div className="card card-body justify-center">
                    <label className="text-xs font-semibold text-slate-500 mb-1.5 flex items-center gap-1">
                        <Search className="w-3.5 h-3.5" /> Cari Item
                    </label>
                    <input
                        type="text"
                        className="form-input"
                        placeholder="Cari kode, nama atau SKU barang..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Main Table */}
            <div className="card">
                <div className="overflow-x-auto">
                    <table className="table-base">
                        <thead>
                            <tr>
                                <th style={{ width: 120 }}>Kode Barang</th>
                                <th>Nama Item</th>
                                <th>Kategori</th>
                                <th>Satuan</th>
                                <th style={{ width: 140 }} className="text-right">Kuantitas (Qty)</th>
                                <th style={{ width: 200 }} className="text-right">Harga Pokok (HPP) / Unit</th>
                                <th style={{ width: 180 }} className="text-right">Total Nilai</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredItems.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-14 text-slate-400">
                                        <Package className="w-10 h-10 mx-auto mb-3 opacity-20" />
                                        <p>Barang tidak ditemukan / belum ada master barang</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredItems.map(item => {
                                    const stateVal = editableBalances[item.id] || { quantity: 0, unitCost: 0 }
                                    const totalVal = stateVal.quantity * stateVal.unitCost

                                    return (
                                        <tr key={item.id}>
                                            <td className="font-mono text-xs text-primary-700 font-semibold">{item.itemCode || '—'}</td>
                                            <td>
                                                <div className="font-medium text-sm text-slate-800">{item.itemName}</div>
                                                <div className="text-xs text-slate-400 font-mono mt-0.5">SKU: {item.skuCode || '—'}</div>
                                            </td>
                                            <td>
                                                <span className="badge badge-gray text-xs">{item.category}</span>
                                            </td>
                                            <td className="text-sm text-slate-500">{item.baseUnit}</td>
                                            <td>
                                                <input
                                                    type="number"
                                                    className="form-input text-right font-mono font-semibold"
                                                    value={stateVal.quantity === 0 ? '' : stateVal.quantity}
                                                    onChange={(e) => handleQtyChange(item.id, e.target.value)}
                                                    placeholder="0"
                                                    min="0"
                                                />
                                            </td>
                                            <td>
                                                <div className="relative rounded-md shadow-sm">
                                                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2">
                                                        <span className="text-xs text-slate-400">Rp</span>
                                                    </div>
                                                    <input
                                                        type="number"
                                                        className="form-input text-right font-mono pl-7"
                                                        value={stateVal.unitCost === 0 ? '' : stateVal.unitCost}
                                                        onChange={(e) => handleCostChange(item.id, e.target.value)}
                                                        placeholder="0"
                                                        min="0"
                                                        step="100"
                                                    />
                                                </div>
                                            </td>
                                            <td className="text-right font-mono text-sm font-bold text-slate-700">
                                                {fmtIDR(totalVal)}
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
