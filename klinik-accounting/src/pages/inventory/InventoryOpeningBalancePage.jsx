import { useState, useEffect, useMemo, useRef } from 'react'
import { useStore } from '../../store/useStore'
import { Search, Save, Package, RefreshCw, Download, Upload, FileDown, CheckCircle, AlertTriangle, TrendingUp } from 'lucide-react'
import { fmtIDR } from '../../utils/format'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import Modal from '../../components/ui/Modal'
import Alert from '../../components/ui/Alert'
import KpiCard from '../../components/ui/KpiCard'

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

    // Import modal state
    const [importModal, setImportModal] = useState(false)
    const [importRows, setImportRows] = useState([])
    const [importErrs, setImportErrs] = useState([])
    const [importing, setImporting] = useState(false)
    const fileRef = useRef(null)

    // Initialize editable balances from loaded batches
    useEffect(() => {
        const balanceMap = {}
        pharmacyItems.forEach(item => {
            const match = invBatches.find(
                b => b.itemId === item.id && b.batchNumber.includes('SALDO-AWAL')
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
                quantity: val === '' ? 0 : Math.max(0, parseInt(val) || 0),
            },
        }))
    }

    const handleCostChange = (itemId, val) => {
        setEditableBalances(prev => ({
            ...prev,
            [itemId]: {
                ...prev[itemId],
                unitCost: val === '' ? 0 : Math.max(0, parseFloat(val) || 0),
            },
        }))
    }

    const handleSave = async (customBalances = editableBalances) => {
        // Collect non-zero opening balances
        const dataToSave = Object.entries(customBalances)
            .map(([itemId, val]) => ({
                itemId,
                quantity: val.quantity,
                unitCost: val.unitCost,
            }))
            .filter(item => item.quantity > 0)

        if (dataToSave.length === 0) {
            toast.error('Tidak ada saldo awal dengan Qty > 0 yang diisi.')
            return false
        }

        setSaving(true)
        try {
            await saveInventoryOpeningBalance(dataToSave)
            toast.success('Saldo awal persediaan berhasil disimpan ke database.')
            if (refreshAll) await refreshAll()
            return true
        } catch (e) {
            toast.error(`Gagal menyimpan: ${e.message}`)
            return false
        } finally {
            setSaving(false)
        }
    }

    // Unduh Template Impor Excel
    const downloadTemplate = () => {
        try {
            let templateRows = []
            if (pharmacyItems.length > 0) {
                templateRows = pharmacyItems.map(item => {
                    const balance = editableBalances[item.id] || { quantity: 0, unitCost: 0 }
                    return {
                        'KODE ITEM': item.itemCode || '',
                        'NAMA ITEM': item.itemName || '',
                        'KATEGORI': item.category || '',
                        'SATUAN': item.baseUnit || 'Pcs',
                        'QTY SALDO AWAL': balance.quantity || 0,
                        'HPP PER UNIT': balance.unitCost || 0,
                    }
                })
            } else {
                templateRows = [
                    { 'KODE ITEM': 'PAT-0001', 'NAMA ITEM': 'SANMOL 500 MG TAB', 'KATEGORI': 'BRANDED', 'SATUAN': 'TABLET', 'QTY SALDO AWAL': 100, 'HPP PER UNIT': 5000 },
                    { 'KODE ITEM': 'GEN-0001', 'NAMA ITEM': 'LORATADIN 10 MG TAB', 'KATEGORI': 'GENERIK', 'SATUAN': 'TABLET', 'QTY SALDO AWAL': 50, 'HPP PER UNIT': 1500 },
                ]
            }

            const ws = XLSX.utils.json_to_sheet(templateRows)
            ws['!cols'] = [16, 36, 16, 12, 18, 18].map(w => ({ wch: w }))
            const wb = XLSX.utils.book_new()
            XLSX.utils.book_append_sheet(wb, ws, 'Saldo Awal Item')
            XLSX.writeFile(wb, 'Template_Saldo_Awal_Inventory.xlsx')
            toast.success('Template Saldo Awal berhasil diunduh.')
        } catch (error) {
            console.error('[downloadTemplate] Error:', error)
            toast.error(`Gagal mengunduh template: ${error.message}`)
        }
    }

    // Parse import file Excel/CSV
    const handleFileChange = (e) => {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (ev) => {
            try {
                const data = new Uint8Array(ev.target.result)
                const wb = XLSX.read(data, { type: 'array' })
                const sheet = wb.Sheets[wb.SheetNames[0]]
                const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' })

                if (rawRows.length === 0) {
                    toast.error('File Excel/CSV kosong.')
                    return
                }

                const parsed = []
                const errs = []

                rawRows.forEach((row, i) => {
                    const rowNum = i + 2
                    const code = String(row['KODE ITEM'] || row['KODE'] || row['Kode Item'] || row['Kode'] || row['SKU'] || '').trim()
                    const name = String(row['NAMA ITEM'] || row['NAMA'] || row['Nama Item'] || row['Nama'] || '').trim()
                    const qtyRaw = row['QTY SALDO AWAL'] ?? row['KUANTITAS'] ?? row['QTY'] ?? row['Qty'] ?? 0
                    const costRaw = row['HPP PER UNIT'] ?? row['HARGA POKOK'] ?? row['HPP'] ?? row['Hpp'] ?? 0

                    const qty = Math.max(0, parseInt(qtyRaw) || 0)
                    const unitCost = Math.max(0, parseFloat(costRaw) || 0)

                    if (!code && !name) return

                    let matchedItem = null
                    if (code) {
                        matchedItem = pharmacyItems.find(p => (p.itemCode || '').toLowerCase() === code.toLowerCase() || (p.skuCode || '').toLowerCase() === code.toLowerCase())
                    }
                    if (!matchedItem && name) {
                        matchedItem = pharmacyItems.find(p => p.itemName.toLowerCase() === name.toLowerCase())
                    }

                    if (!matchedItem) {
                        errs.push(`Baris ${rowNum}: Item '${code || name}' tidak ditemukan di Master Inventory.`)
                    }

                    parsed.push({
                        rowNum,
                        code: code || matchedItem?.itemCode || '—',
                        name: name || matchedItem?.itemName || '—',
                        matchedItem,
                        quantity: qty,
                        unitCost,
                        totalValue: qty * unitCost,
                        status: matchedItem ? 'valid' : 'invalid'
                    })
                })

                setImportRows(parsed)
                setImportErrs(errs)
                setImportModal(true)
            } catch (err) {
                console.error('[handleFileChange] Error:', err)
                toast.error(`Gagal membaca file: ${err.message}`)
            }
        }
        reader.readAsArrayBuffer(file)
        e.target.value = ''
    }

    const executeImport = async () => {
        const validRows = importRows.filter(r => r.matchedItem && r.quantity > 0)
        if (validRows.length === 0) {
            toast.error('Tidak ada baris saldo awal yang valid dengan Qty > 0.')
            return
        }

        setImporting(true)
        try {
            const updatedMap = { ...editableBalances }
            validRows.forEach(r => {
                updatedMap[r.matchedItem.id] = {
                    quantity: r.quantity,
                    unitCost: r.unitCost
                }
            })
            setEditableBalances(updatedMap)

            const success = await handleSave(updatedMap)
            if (success) {
                setImportModal(false)
                setImportRows([])
                setImportErrs([])
            }
        } catch (error) {
            console.error('[executeImport] Error:', error)
            toast.error(`Gagal memproses impor: ${error.message}`)
        } finally {
            setImporting(false)
        }
    }

    const downloadReport = () => {
        try {
            const reportRows = pharmacyItems.map(item => {
                const balance = editableBalances[item.id] || { quantity: 0, unitCost: 0 }
                return {
                    'Kode Barang': item.itemCode || '—',
                    'Nama Item': item.itemName,
                    'SKU': item.skuCode || '—',
                    'Kategori': item.category,
                    'Satuan': item.baseUnit,
                    'Kuantitas (Qty)': balance.quantity,
                    'HPP / Unit (Rp)': balance.unitCost,
                    'Total Nilai (Rp)': balance.quantity * balance.unitCost
                }
            })

            const ws = XLSX.utils.json_to_sheet(reportRows)
            ws['!cols'] = [16, 36, 16, 16, 12, 16, 18, 20].map(w => ({ wch: w }))
            const wb = XLSX.utils.book_new()
            XLSX.utils.book_append_sheet(wb, ws, 'Laporan Saldo Awal')
            XLSX.writeFile(wb, `Laporan_Saldo_Awal_Inventory_${new Date().toISOString().split('T')[0]}.xlsx`)
            toast.success('Laporan Saldo Awal berhasil diunduh.')
        } catch (error) {
            console.error('[downloadReport] Error:', error)
            toast.error(`Gagal mengunduh laporan: ${error.message}`)
        }
    }

    const grandTotalValue = useMemo(() => {
        return Object.values(editableBalances).reduce((acc, curr) => {
            return acc + (curr.quantity * curr.unitCost)
        }, 0)
    }, [editableBalances])

    const filledCount = useMemo(() => {
        return Object.values(editableBalances).filter(b => b.quantity > 0).length
    }, [editableBalances])

    const totalQty = useMemo(() => {
        return Object.values(editableBalances).reduce((acc, curr) => acc + (curr.quantity || 0), 0)
    }, [editableBalances])

    return (
        <div className="space-y-5">
            {/* Hidden file input */}
            <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="hidden"
            />

            {/* Header */}
            <div>
                <h1 className="page-title">Saldo Awal Persediaan (Inventory)</h1>
                <p className="text-sm text-slate-400 mt-0.5">
                    Input saldo awal kuantitas dan harga pokok (HPP) untuk setiap item barang medis / farmasi.
                </p>
            </div>

            {/* KPI Cards row matching reference image */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard title="Total Master Item" value={pharmacyItems.length.toLocaleString('id-ID')} sub="Computed" icon={Package} color="blue" />
                <KpiCard title="Item Terisi Saldo" value={filledCount.toLocaleString('id-ID')} sub="Computed" icon={CheckCircle} color="green" />
                <KpiCard title="Total Qty Saldo Awal" value={totalQty.toLocaleString('id-ID')} sub="Computed" icon={Package} color="amber" />
                <KpiCard title="Total Nilai Persediaan" value={fmtIDR(grandTotalValue)} sub="Computed" icon={TrendingUp} color="teal" />
            </div>

            {/* Action Bar & Search Filter */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                    <div className="relative w-full max-w-sm">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            className="form-input text-xs pl-9 py-2"
                            placeholder="Cari kode item, nama barang..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                    <button
                        type="button"
                        onClick={downloadTemplate}
                        className="btn-orange"
                    >
                        <FileDown className="w-4 h-4" />Unduh Template Impor
                    </button>
                    <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        className="btn-emerald"
                    >
                        <Upload className="w-4 h-4" />Impor Data
                    </button>
                    <button
                        type="button"
                        onClick={() => handleSave()}
                        disabled={saving}
                        className="btn-danger-red"
                    >
                        <Save className="w-4 h-4" /> {saving ? 'Menyimpan...' : 'Simpan Saldo Awal'}
                    </button>
                    <button
                        type="button"
                        onClick={downloadReport}
                        className="btn-royal-blue"
                    >
                        <Download className="w-4 h-4" />Unduh Laporan
                    </button>
                    {refreshAll && (
                        <button className="btn-square-refresh" onClick={refreshAll} title="Tarik data terbaru">
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    )}
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
            </div >

            {/* Import Preview Modal */}
            < Modal
                open={importModal}
                onClose={() => { setImportModal(false); setImportRows([]); setImportErrs([]) }
                }
                title="Preview Import Saldo Awal Persediaan"
                size="xl"
                footer={
                    <>
                        <button
                            type="button"
                            className="btn-secondary text-xs px-3 py-1.5"
                            onClick={() => { setImportModal(false); setImportRows([]); setImportErrs([]) }}
                            disabled={importing}
                        >
                            Batal
                        </button>
                        <button
                            type="button"
                            className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1"
                            disabled={importing || importRows.filter(r => r.matchedItem && r.quantity > 0).length === 0}
                            onClick={executeImport}
                        >
                            <Upload className="w-3.5 h-3.5" />
                            {importing ? 'Mengimpor...' : `Impor & Simpan (${importRows.filter(r => r.matchedItem && r.quantity > 0).length} Item)`}
                        </button>
                    </>
                }
            >
                <div className="space-y-4 text-xs">
                    {importErrs.length > 0 && (
                        <Alert
                            type="warning"
                            title={`${importErrs.length} Peringatan Ditemukan`}
                            message={importErrs.join(' | ')}
                        />
                    )}
                    {importErrs.length === 0 && importRows.length > 0 && (
                        <Alert
                            type="success"
                            message={`${importRows.filter(r => r.matchedItem).length} item berhasil dicocokkan dengan Master Inventory dan siap disimpan ke database.`}
                        />
                    )}

                    <div className="overflow-x-auto max-h-96 border rounded-lg">
                        <table className="table-base w-full text-left border-collapse">
                            <thead className="sticky top-0 bg-slate-100 font-bold text-[11px]">
                                <tr>
                                    <th className="p-2">#</th>
                                    <th className="p-2">Kode</th>
                                    <th className="p-2">Nama Item</th>
                                    <th className="p-2 text-right">Qty Impor</th>
                                    <th className="p-2 text-right">HPP / Unit</th>
                                    <th className="p-2 text-right">Total Nilai</th>
                                    <th className="p-2 text-center">Status Matching</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 bg-white">
                                {importRows.map((row, idx) => (
                                    <tr key={idx} className={row.matchedItem ? 'hover:bg-slate-50' : 'bg-red-50/50'}>
                                        <td className="p-2 text-slate-400 font-mono text-[10px]">{row.rowNum}</td>
                                        <td className="p-2 font-mono font-semibold text-primary-700">{row.code}</td>
                                        <td className="p-2 font-medium text-slate-800">
                                            {row.name}
                                            {row.matchedItem && (
                                                <span className="block text-[10px] text-slate-400 font-normal">
                                                    Terhubung ke: {row.matchedItem.itemName} ({row.matchedItem.itemCode})
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-2 text-right font-mono font-semibold">{row.quantity}</td>
                                        <td className="p-2 text-right font-mono">{fmtIDR(row.unitCost)}</td>
                                        <td className="p-2 text-right font-mono font-bold text-slate-700">{fmtIDR(row.totalValue)}</td>
                                        <td className="p-2 text-center whitespace-nowrap">
                                            {row.matchedItem ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-700">
                                                    <CheckCircle className="w-3 h-3" /> Cocok
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-700">
                                                    <AlertTriangle className="w-3 h-3" /> Tidak Ditemukan
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </Modal >
        </div >
    )
}

