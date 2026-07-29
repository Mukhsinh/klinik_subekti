import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { Search, Save, Package, RefreshCw, AlertCircle } from 'lucide-react'
import { fmtIDR } from '../../utils/format'
import toast from 'react-hot-toast'
import { v4 as uuidv4 } from 'uuid'

export default function InventoryItemOpeningBalancePage() {
    const [pharmacyItems, setPharmacyItems] = useState([])
    const [invBatches, setInvBatches] = useState([])
    const [searchTerm, setSearchTerm] = useState('')
    const [editableBalances, setEditableBalances] = useState({})
    const [saving, setSaving] = useState(false)
    const [loading, setLoading] = useState(true)

    // Load data dari Supabase langsung tanpa useStore
    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        setLoading(true)
        try {
            // Fetch pharmacy items
            const { data: itemsData, error: itemsError } = await supabase
                .from('pharmacy_items')
                .select('*')
                .eq('is_active', true)
                .order('item_name')

            if (itemsError) throw itemsError

            // Fetch batches dengan batch_number SALDO-AWAL
            const { data: batchesData, error: batchesError } = await supabase
                .from('inventory_batches')
                .select('*')
                .like('batch_number', '%SALDO-AWAL%')

            if (batchesError) throw batchesError

            // Normalize data
            const normalizedItems = (itemsData || []).map(item => ({
                id: item.id,
                itemCode: item.item_code,
                skuCode: item.sku_code,
                itemName: item.item_name,
                category: item.category,
                baseUnit: item.base_unit,
                coaInventoryCode: item.coa_inventory_code,
                coaCOGSCode: item.coa_cogs_code,
                isActive: item.is_active
            }))

            const normalizedBatches = (batchesData || []).map(batch => ({
                id: batch.id,
                itemId: batch.item_id,
                batchNumber: batch.batch_number,
                quantityReceived: batch.quantity_received,
                quantityCurrent: batch.quantity_current,
                unitCostPrice: batch.unit_cost_price,
                expiryDate: batch.expiry_date
            }))

            setPharmacyItems(normalizedItems)
            setInvBatches(normalizedBatches)

            // Initialize editable balances
            const balanceMap = {}
            normalizedItems.forEach(item => {
                const match = normalizedBatches.find(
                    b => b.itemId === item.id && b.batchNumber.includes('SALDO-AWAL')
                )
                balanceMap[item.id] = {
                    quantity: match ? match.quantityReceived : 0,
                    unitCost: match ? match.unitCostPrice : 0,
                }
            })
            setEditableBalances(balanceMap)
        } catch (error) {
            console.error('[loadData] Error:', error)
            toast.error(`Gagal memuat data: ${error.message}`)
        } finally {
            setLoading(false)
        }
    }

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
            .filter(item => item.quantity > 0)

        if (dataToSave.length === 0) {
            toast.error('Tidak ada saldo awal dengan Qty > 0 yang diisi.')
            return
        }

        setSaving(true)
        try {
            const today = new Date().toISOString().split('T')[0]
            const futureDate = new Date()
            futureDate.setFullYear(futureDate.getFullYear() + 10)
            const expiryDate = futureDate.toISOString().split('T')[0]

            for (const item of dataToSave) {
                const pharmacyItem = pharmacyItems.find(p => p.id === item.itemId)
                if (!pharmacyItem) continue

                // Check if batch already exists
                const existingBatch = invBatches.find(
                    b => b.itemId === item.itemId && b.batchNumber.includes('SALDO-AWAL')
                )

                if (existingBatch) {
                    // Update existing batch
                    const { error: updateError } = await supabase
                        .from('inventory_batches')
                        .update({
                            quantity_received: item.quantity,
                            quantity_current: item.quantity,
                            unit_cost_price: item.unitCost,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', existingBatch.id)

                    if (updateError) throw updateError

                    // Update stock ledger
                    const { error: ledgerUpdateError } = await supabase
                        .from('stock_ledger_cards')
                        .update({
                            quantity_in: item.quantity,
                            balance_after: item.quantity,
                            unit_cost: item.unitCost,
                            total_value: item.quantity * item.unitCost
                        })
                        .eq('batch_id', existingBatch.id)
                        .eq('transaction_type', 'SALDO_AWAL')

                    if (ledgerUpdateError) {
                        console.warn('[updateLedger] Warning:', ledgerUpdateError)
                    }
                } else {
                    // Create new batch
                    const batchId = uuidv4()
                    const { error: batchError } = await supabase
                        .from('inventory_batches')
                        .insert({
                            id: batchId,
                            item_id: item.itemId,
                            batch_number: `SALDO-AWAL-${pharmacyItem.itemCode}`,
                            expiry_date: expiryDate,
                            manufacture_date: today,
                            unit_cost_price: item.unitCost,
                            quantity_received: item.quantity,
                            quantity_current: item.quantity,
                            grn_reference: 'SALDO-AWAL',
                            supplier_name: 'Saldo Awal Sistem',
                            received_at: new Date().toISOString(),
                            created_at: new Date().toISOString()
                        })

                    if (batchError) throw batchError

                    // Create stock ledger entry
                    const { error: ledgerError } = await supabase
                        .from('stock_ledger_cards')
                        .insert({
                            id: uuidv4(),
                            batch_id: batchId,
                            item_id: item.itemId,
                            transaction_type: 'SALDO_AWAL',
                            reference_number: 'SALDO-AWAL',
                            quantity_in: item.quantity,
                            quantity_out: 0,
                            balance_after: item.quantity,
                            unit_cost: item.unitCost,
                            total_value: item.quantity * item.unitCost,
                            notes: 'Saldo awal persediaan',
                            logged_at: new Date().toISOString()
                        })

                    if (ledgerError) throw ledgerError
                }
            }

            toast.success(`Saldo awal ${dataToSave.length} item berhasil disimpan.`)
            await loadData()
        } catch (error) {
            console.error('[handleSave] Error:', error)
            toast.error(`Gagal menyimpan: ${error.message}`)
        } finally {
            setSaving(false)
        }
    }

    const grandTotalValue = useMemo(() => {
        return Object.values(editableBalances).reduce((acc, curr) => {
            return acc + (curr.quantity * curr.unitCost)
        }, 0)
    }, [editableBalances])

    const CAT_LABELS = {
        BRANDED: 'BRANDED',
        GENERIK: 'GENERIK',
        BHP: 'BHP',
        'PEMAKAIAN BHP': 'BHP',
        OBAT_PATEN: 'BRANDED',
        OBAT_GENERIK: 'GENERIK',
        RUMAH_TANGGA: 'RUMAH TANGGA'
    }

    const CAT_COLORS = {
        BRANDED: 'badge-blue',
        GENERIK: 'badge-green',
        BHP: 'badge-purple',
        'PEMAKAIAN BHP': 'badge-purple',
        OBAT_PATEN: 'badge-blue',
        OBAT_GENERIK: 'badge-green',
        RUMAH_TANGGA: 'badge-yellow'
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto text-primary-600 mb-3" />
                    <p className="text-slate-500">Memuat data...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                    <h1 className="page-title">Saldo Awal Item Inventory</h1>
                    <p className="text-sm text-slate-400 mt-0.5">
                        Input saldo awal kuantitas dan harga pokok per item barang yang tersambung ke kartu stok
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
                    <button className="btn-square-refresh" onClick={loadData} title="Refresh data">
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Summary card & Search */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
                <div className="card p-3.5 bg-emerald-500 text-white border-0 shadow-sm md:col-span-2 flex items-center justify-between">
                    <div>
                        <p className="text-xs text-emerald-100 font-semibold uppercase tracking-wider mb-0.5">Total Nilai Saldo Awal Persediaan</p>
                        <p className="font-extrabold text-2xl font-mono text-white leading-tight">{fmtIDR(grandTotalValue)}</p>
                    </div>
                    <div className="text-xs text-white font-semibold bg-emerald-600/60 px-3 py-1.5 rounded-md">
                        {Object.values(editableBalances).filter(b => b.quantity > 0).length} item terisi
                    </div>
                </div>

                <div className="card p-3.5 flex flex-col justify-center">
                    <label className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1">
                        <Search className="w-3.5 h-3.5 text-slate-400" /> Cari Item
                    </label>
                    <input
                        type="text"
                        className="form-input text-xs py-1.5"
                        placeholder="Cari kode, nama atau SKU..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Main Table */}
            <div className="card">
                <div className="w-full">
                    <table className="w-full text-left border-collapse table-auto">
                        <thead>
                            <tr className="bg-slate-100/80 border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                                <th className="py-2.5 px-2.5" style={{ width: '100px' }}>Kode</th>
                                <th className="py-2.5 px-2.5" style={{ minWidth: '180px' }}>Nama Item</th>
                                <th className="py-2.5 px-2.5" style={{ width: '90px' }}>Kategori</th>
                                <th className="py-2.5 px-2.5" style={{ width: '70px' }}>Satuan</th>
                                <th className="py-2.5 px-2.5 text-right" style={{ width: '110px' }}>Kuantitas (Qty)</th>
                                <th className="py-2.5 px-2.5 text-right" style={{ width: '160px' }}>HPP / Unit</th>
                                <th className="py-2.5 px-2.5 text-right" style={{ width: '140px' }}>Total Nilai</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white text-[11px]">
                            {filteredItems.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-12 text-slate-400">
                                        <Package className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                        <p className="text-xs">{searchTerm ? 'Item tidak ditemukan' : 'Belum ada master item / data kosong'}</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredItems.map(item => {
                                    const stateVal = editableBalances[item.id] || { quantity: 0, unitCost: 0 }
                                    const totalVal = stateVal.quantity * stateVal.unitCost

                                    return (
                                        <tr key={item.id} className="hover:bg-slate-50">
                                            <td className="py-2 px-2.5 font-mono text-[11px] text-primary-700 font-semibold whitespace-nowrap">{item.itemCode || '—'}</td>
                                            <td className="py-2 px-2.5">
                                                <div className="font-bold text-slate-900 leading-tight">{item.itemName}</div>
                                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">SKU: {item.skuCode || '—'}</div>
                                            </td>
                                            <td className="py-2 px-2.5 whitespace-nowrap">
                                                <span className={`badge ${CAT_COLORS[item.category] || 'badge-gray'} text-[10px] px-2 py-0.5`}>
                                                    {CAT_LABELS[item.category] || item.category}
                                                </span>
                                            </td>
                                            <td className="py-2 px-2.5 text-[11px] text-slate-600 whitespace-nowrap">{item.baseUnit}</td>
                                            <td className="py-2 px-2.5">
                                                <input
                                                    type="number"
                                                    className="form-input text-right font-mono font-semibold text-[11px] py-1 px-2"
                                                    value={stateVal.quantity === 0 ? '' : stateVal.quantity}
                                                    onChange={(e) => handleQtyChange(item.id, e.target.value)}
                                                    placeholder="0"
                                                    min="0"
                                                />
                                            </td>
                                            <td className="py-2 px-2.5">
                                                <div className="relative rounded-md shadow-sm">
                                                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2">
                                                        <span className="text-[10px] text-slate-400">Rp</span>
                                                    </div>
                                                    <input
                                                        type="number"
                                                        className="form-input text-right font-mono pl-6 text-[11px] py-1 px-2"
                                                        value={stateVal.unitCost === 0 ? '' : stateVal.unitCost}
                                                        onChange={(e) => handleCostChange(item.id, e.target.value)}
                                                        placeholder="0"
                                                        min="0"
                                                        step="100"
                                                    />
                                                </div>
                                            </td>
                                            <td className="py-2 px-2.5 text-right font-mono text-[11px] font-bold text-slate-700 whitespace-nowrap">
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
