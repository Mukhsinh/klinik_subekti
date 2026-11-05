import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useStore } from '../../store/useStore'
import { getAccountCode } from '../../utils/accountMapping'
import { Search, Save, Package, RefreshCw, Download, Upload, FileDown, CheckCircle, AlertTriangle, TrendingUp, Lock } from 'lucide-react'
import { fmtIDR, fmtNum } from '../../utils/format'
import toast from 'react-hot-toast'
import { v4 as uuidv4 } from 'uuid'
import * as XLSX from 'xlsx'
import Modal from '../../components/ui/Modal'
import Alert from '../../components/ui/Alert'

export default function InventoryItemOpeningBalancePage() {
    const { activeBranchId, appSettings, refreshAll } = useStore()
    const [pharmacyItems, setPharmacyItems] = useState([])
    const [invBatches, setInvBatches] = useState([])
    const [lockedItemIds, setLockedItemIds] = useState(new Set())
    const [searchTerm, setSearchTerm] = useState('')
    const [editableBalances, setEditableBalances] = useState({})
    const [saving, setSaving] = useState(false)
    const [loading, setLoading] = useState(true)

    // Import modal state
    const [importModal, setImportModal] = useState(false)
    const [importRows, setImportRows] = useState([])
    const [importErrs, setImportErrs] = useState([])
    const [importing, setImporting] = useState(false)
    const fileRef = useRef(null)

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

            // Deteksi item yang sudah pernah ada transaksi MUTASI KELUAR riil (quantity_out > 0)
            // Item HANYA terkunci jika sudah ada pengeluaran stok fisik riil yang belum ter-reverse (net mutasi keluar > 0)
            const { data: transData, error: transError } = await supabase
                .from('stock_ledger_cards')
                .select('item_id, transaction_type, quantity_in, quantity_out')
                .neq('transaction_type', 'SALDO_AWAL')

            if (transError) throw transError

            const netOutMap = {}
            for (const t of (transData || [])) {
                if (!t.item_id) continue
                if (!netOutMap[t.item_id]) netOutMap[t.item_id] = 0
                const qOut = Number(t.quantity_out || 0)
                const qIn = (t.transaction_type === 'REVISION_RESTORE' || t.transaction_type === 'RETURN') ? Number(t.quantity_in || 0) : 0
                netOutMap[t.item_id] += (qOut - qIn)
            }

            const lockedSet = new Set()
            for (const [itId, netOut] of Object.entries(netOutMap)) {
                if (netOut > 0) {
                    lockedSet.add(itId)
                }
            }
            setLockedItemIds(lockedSet)

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
        if (lockedItemIds.has(itemId)) {
            toast.error('Item ini sudah memiliki transaksi sehingga saldo awal terkunci dan tidak dapat diubah.')
            return
        }
        setEditableBalances(prev => {
            const current = prev[itemId] || { quantity: 0, unitCost: 0 }
            let parsedQty = val
            if (val !== '') {
                const num = parseInt(val, 10)
                parsedQty = isNaN(num) ? 0 : Math.max(0, num)
            }
            return {
                ...prev,
                [itemId]: {
                    ...current,
                    quantity: parsedQty,
                },
            }
        })
    }

    const handleCostChange = (itemId, val) => {
        if (lockedItemIds.has(itemId)) {
            toast.error('Item ini sudah memiliki transaksi sehingga HPP saldo awal terkunci.')
            return
        }
        setEditableBalances(prev => {
            const current = prev[itemId] || { quantity: 0, unitCost: 0 }
            let parsedCost = val
            if (val !== '') {
                const num = parseFloat(val)
                parsedCost = isNaN(num) ? 0 : Math.max(0, num)
            }
            return {
                ...prev,
                [itemId]: {
                    ...current,
                    unitCost: parsedCost,
                },
            }
        })
    }

    // Save functionality for current state or explicit data
    const saveToDatabase = async (balancesMapToSave = editableBalances) => {
        setSaving(true)
        try {
            // Otomatis tanggal 1 Januari pada tahun berjalan
            const currentYear = new Date().getFullYear()
            const openingDate = `${currentYear}-01-01`
            const openingIso = `${currentYear}-01-01T00:00:00.000Z`
            const expiryDate = `${currentYear + 10}-12-31`

            // Item yang sudah ada mutasi operasional tidak boleh diubah
            const entries = Object.entries(balancesMapToSave)
                .filter(([itemId]) => !lockedItemIds.has(itemId))
                .map(([itemId, val]) => ({
                    itemId,
                    quantity: Number(val?.quantity) || 0,
                    unitCost: Number(val?.unitCost) || 0,
                }))

            if (entries.length === 0) {
                toast.error('Tidak ada item yang dapat disimpan atau semua item telah terkunci transaksi.')
                return false
            }

            let savedCount = 0

            for (const item of entries) {
                const pharmacyItem = pharmacyItems.find(p => p.id === item.itemId)
                if (!pharmacyItem) continue

                // Check if batch already exists
                const existingBatch = invBatches.find(
                    b => b.itemId === item.itemId && b.batchNumber.includes('SALDO-AWAL')
                )

                if (item.quantity > 0) {
                    if (existingBatch) {
                        // Update existing batch
                        const { error: updateError } = await supabase
                            .from('inventory_batches')
                            .update({
                                quantity_received: item.quantity,
                                quantity_current: item.quantity,
                                unit_cost_price: item.unitCost,
                                manufacture_date: openingDate,
                                received_at: openingIso,
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', existingBatch.id)

                        if (updateError) throw updateError

                        // Periksa apakah sudah ada kartu stok untuk batch ini
                        const { data: existingLedgerList } = await supabase
                            .from('stock_ledger_cards')
                            .select('id')
                            .eq('batch_id', existingBatch.id)
                            .limit(1)

                        const existingLedger = existingLedgerList?.[0]

                        if (existingLedger) {
                            await supabase
                                .from('stock_ledger_cards')
                                .update({
                                    quantity_in: item.quantity,
                                    balance_after: item.quantity,
                                    unit_cost: item.unitCost,
                                    total_value: item.quantity * item.unitCost,
                                    logged_at: openingIso
                                })
                                .eq('id', existingLedger.id)
                        } else {
                            await supabase
                                .from('stock_ledger_cards')
                                .insert({
                                    id: uuidv4(),
                                    batch_id: existingBatch.id,
                                    item_id: item.itemId,
                                    transaction_type: 'SALDO_AWAL',
                                    reference_number: 'SALDO-AWAL',
                                    quantity_in: item.quantity,
                                    quantity_out: 0,
                                    balance_after: item.quantity,
                                    unit_cost: item.unitCost,
                                    total_value: item.quantity * item.unitCost,
                                    notes: 'Saldo awal persediaan item',
                                    logged_at: openingIso
                                })
                        }
                    } else {
                        // Create new batch
                        const batchId = uuidv4()
                        const { error: batchError } = await supabase
                            .from('inventory_batches')
                            .insert({
                                id: batchId,
                                item_id: item.itemId,
                                batch_number: `SALDO-AWAL-${pharmacyItem.itemCode || pharmacyItem.id.substring(0, 8)}`,
                                expiry_date: expiryDate,
                                manufacture_date: openingDate,
                                unit_cost_price: item.unitCost,
                                quantity_received: item.quantity,
                                quantity_current: item.quantity,
                                grn_reference: 'SALDO-AWAL',
                                supplier_name: 'Saldo Awal Sistem',
                                received_at: openingIso,
                                created_at: openingIso
                            })

                        if (batchError) throw batchError

                        // Create stock ledger entry
                        await supabase
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
                                notes: 'Saldo awal persediaan item',
                                logged_at: openingIso
                            })
                    }
                    savedCount++
                } else if (existingBatch) {
                    // Update batch to 0 if previously recorded
                    await supabase
                        .from('inventory_batches')
                        .update({
                            quantity_received: 0,
                            quantity_current: 0,
                            unit_cost_price: item.unitCost,
                            manufacture_date: openingDate,
                            received_at: openingIso,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', existingBatch.id)

                    await supabase
                        .from('stock_ledger_cards')
                        .update({
                            quantity_in: 0,
                            balance_after: 0,
                            total_value: 0,
                            logged_at: openingIso
                        })
                        .eq('batch_id', existingBatch.id)
                    savedCount++
                }
            }

            // ── Integrasi Penuh dengan Laporan Keuangan (opening_balances) ──
            const totalInventoryValue = Object.entries(balancesMapToSave).reduce((sum, [, val]) => {
                return sum + ((Number(val?.quantity) || 0) * (Number(val?.unitCost) || 0))
            }, 0)

            // Ambil daftar akun persediaan yang valid di COA (1-13%)
            const { data: validInvCOA } = await supabase
                .from('chart_of_accounts')
                .select('account_code')
                .like('account_code', '1-13%')
                .eq('is_header', false)

            const validCodes = new Set((validInvCOA || []).map(c => c.account_code))
            const defaultInvCode = validCodes.has('1-13-001') ? '1-13-001' : (Array.from(validCodes)[0] || '1-13-001')

            // Hitung total saldo awal per akun COA persediaan
            const balanceByAccount = {}
            for (const [itemId, val] of Object.entries(balancesMapToSave)) {
                const qty = Number(val?.quantity) || 0
                const cost = Number(val?.unitCost) || 0
                if (qty <= 0 || cost <= 0) continue
                const pItem = pharmacyItems.find(p => p.id === itemId)
                let acc = pItem?.coaInventoryCode
                if (!acc || !validCodes.has(acc)) {
                    if (pItem?.category === 'GENERIK' || pItem?.category === 'OBAT_GENERIK') {
                        acc = validCodes.has('1-13-002') ? '1-13-002' : defaultInvCode
                    } else if (pItem?.category === 'BHP' || pItem?.category === 'PEMAKAIAN BHP') {
                        acc = validCodes.has('1-13-003') ? '1-13-003' : defaultInvCode
                    } else if (pItem?.category === 'RUMAH_TANGGA') {
                        acc = validCodes.has('1-13-004') ? '1-13-004' : defaultInvCode
                    } else {
                        acc = defaultInvCode
                    }
                }
                balanceByAccount[acc] = (balanceByAccount[acc] || 0) + (qty * cost)
            }

            const fiscalYear = currentYear
            const branchId = activeBranchId || 'f265df27-e277-4775-8b1d-5f28e585599a'

            // Sinkronkan setiap akun persediaan ke opening_balances
            for (const [accCode, totalVal] of Object.entries(balanceByAccount)) {
                const { data: existingOBList } = await supabase
                    .from('opening_balances')
                    .select('id')
                    .eq('account_code', accCode)
                    .eq('fiscal_year', fiscalYear)
                    .limit(1)

                const existingOB = existingOBList?.[0]

                if (existingOB) {
                    await supabase
                        .from('opening_balances')
                        .update({
                            opening_balance: totalVal,
                            opening_date: openingDate,
                            description: 'Saldo awal persediaan farmasi (Otomatis dari Saldo Awal Item)',
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', existingOB.id)
                } else {
                    await supabase
                        .from('opening_balances')
                        .insert({
                            id: uuidv4(),
                            account_code: accCode,
                            branch_id: branchId,
                            fiscal_year: fiscalYear,
                            opening_date: openingDate,
                            opening_balance: totalVal,
                            description: 'Saldo awal persediaan farmasi (Otomatis dari Saldo Awal Item)',
                            created_by: 'system',
                            created_at: new Date().toISOString()
                        })
                }
            }

            toast.success(`Saldo awal item inventory (${savedCount} item diperbarui, total ${fmtIDR(totalInventoryValue)}) berhasil disimpan (per tanggal 1 Januari ${currentYear}) dan terintegrasi dengan laporan keuangan.`)

            // Sinkronkan seluruh data in-memory di useStore
            if (refreshAll) {
                await refreshAll()
            }
            await loadData()
            return true
        } catch (error) {
            console.error('[handleSave] Error:', error)
            toast.error(`Gagal menyimpan ke database: ${error.message}`)
            return false
        } finally {
            setSaving(false)
        }
    }

    const handleSave = () => {
        saveToDatabase()
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
                        'KATEGORI': CAT_LABELS[item.category] || item.category || '',
                        'SATUAN': item.baseUnit || 'Pcs',
                        'QTY SALDO AWAL': balance.quantity || 0,
                        'HPP PER UNIT': balance.unitCost || 0,
                    }
                })
            } else {
                templateRows = [
                    { 'KODE ITEM': 'PAT-0001', 'NAMA ITEM': 'SANMOL 500 MG TAB', 'KATEGORI': 'BRANDED', 'SATUAN': 'TABLET', 'QTY SALDO AWAL': 100, 'HPP PER UNIT': 5000 },
                    { 'KODE ITEM': 'GEN-0001', 'NAMA ITEM': 'LORATADIN 10 MG TAB', 'KATEGORI': 'GENERIK', 'SATUAN': 'TABLET', 'QTY SALDO AWAL': 50, 'HPP PER UNIT': 1500 },
                    { 'KODE ITEM': 'BHP-0001', 'NAMA ITEM': 'MASKER BEDAH EARLOP', 'KATEGORI': 'BHP', 'SATUAN': 'ALKES', 'QTY SALDO AWAL': 200, 'HPP PER UNIT': 1200 },
                ]
            }

            const ws = XLSX.utils.json_to_sheet(templateRows)
            ws['!cols'] = [16, 36, 16, 12, 18, 18].map(w => ({ wch: w }))
            const wb = XLSX.utils.book_new()
            XLSX.utils.book_append_sheet(wb, ws, 'Saldo Awal Item')
            XLSX.writeFile(wb, 'Template_Saldo_Awal_Item_Inventory.xlsx')
            toast.success('Template Saldo Awal Item berhasil diunduh.')
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
                const firstSheetName = wb.SheetNames[0]
                const sheet = wb.Sheets[firstSheetName]
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
                    const name = String(row['NAMA ITEM'] || row['NAMA'] || row['Nama Item'] || row['Nama'] || row['NAMA SEDIAAN FARMASI'] || '').trim()
                    const qtyRaw = row['QTY SALDO AWAL'] ?? row['KUANTITAS'] ?? row['QTY'] ?? row['Qty'] ?? row['Jumlah'] ?? 0
                    const costRaw = row['HPP PER UNIT'] ?? row['HARGA POKOK'] ?? row['HPP'] ?? row['Hpp'] ?? row['Harga Pokok'] ?? row['Unit Cost'] ?? 0

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
                        errs.push(`Baris ${rowNum}: Item '${code || name}' tidak ditemukan di Master Item Inventory.`)
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

    // Execute Import and auto save to DB
    const executeImport = async () => {
        const validRows = importRows.filter(r => r.matchedItem && r.quantity > 0)
        if (validRows.length === 0) {
            toast.error('Tidak ada baris saldo awal yang valid dengan Qty > 0 untuk diimpor.')
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

            const success = await saveToDatabase(updatedMap)
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

    // Unduh Laporan Saldo Awal
    const downloadReport = () => {
        try {
            const reportRows = pharmacyItems
                .map(item => {
                    const balance = editableBalances[item.id] || { quantity: 0, unitCost: 0 }
                    return {
                        'Kode Barang': item.itemCode || '—',
                        'Nama Item': item.itemName,
                        'SKU': item.skuCode || '—',
                        'Kategori': CAT_LABELS[item.category] || item.category,
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
            XLSX.writeFile(wb, `Laporan_Saldo_Awal_Item_${new Date().toISOString().split('T')[0]}.xlsx`)
            toast.success('Laporan Saldo Awal Item berhasil diunduh.')
        } catch (error) {
            console.error('[downloadReport] Error:', error)
            toast.error(`Gagal mengunduh laporan: ${error.message}`)
        }
    }

    const grandTotalValue = useMemo(() => {
        return Object.values(editableBalances).reduce((acc, curr) => {
            const q = Number(curr?.quantity) || 0
            const c = Number(curr?.unitCost) || 0
            return acc + (q * c)
        }, 0)
    }, [editableBalances])

    const filledCount = useMemo(() => {
        return Object.values(editableBalances).filter(b => (Number(b?.quantity) || 0) > 0).length
    }, [editableBalances])

    const totalQty = useMemo(() => {
        return Object.values(editableBalances).reduce((acc, curr) => acc + (Number(curr?.quantity) || 0), 0)
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
            <div className="flex items-center justify-center h-96 font-sans">
                <div className="text-center">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto text-primary-600 mb-3" />
                    <p className="text-slate-500 font-sans text-sm">Memuat data saldo awal...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-5 font-sans">
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
                <h1 className="page-title font-sans">Saldo Awal Item Inventory</h1>
                <p className="text-sm text-slate-400 mt-0.5 font-sans">
                    Input saldo awal kuantitas dan harga pokok per item barang yang tersambung ke kartu stok
                </p>
            </div>

            {/* Sleek Score Cards — Vibrant Solid Colors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 font-sans">
                <div className="rounded-xl p-3.5 shadow-sm" style={{ background: '#2563EB' }}>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-blue-100 font-sans">Total Master Item</p>
                            <p className="text-xl font-extrabold text-white tracking-tight font-sans mt-0.5">
                                {fmtNum(pharmacyItems.length)} <span className="text-xs font-semibold text-blue-200">item</span>
                            </p>
                        </div>
                        <div className="w-8 h-8 rounded-lg bg-white/20 text-white flex items-center justify-center">
                            <Package className="w-4 h-4" />
                        </div>
                    </div>
                </div>

                <div className="rounded-xl p-3.5 shadow-sm" style={{ background: '#059669' }}>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-100 font-sans">Item Terisi Saldo</p>
                            <p className="text-xl font-extrabold text-white tracking-tight font-sans mt-0.5">
                                {fmtNum(filledCount)} <span className="text-xs font-semibold text-emerald-200">item</span>
                            </p>
                        </div>
                        <div className="w-8 h-8 rounded-lg bg-white/20 text-white flex items-center justify-center">
                            <CheckCircle className="w-4 h-4" />
                        </div>
                    </div>
                </div>

                <div className="rounded-xl p-3.5 shadow-sm" style={{ background: '#D97706' }}>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-100 font-sans">Total Qty Saldo Awal</p>
                            <p className="text-xl font-extrabold text-white tracking-tight font-sans mt-0.5">
                                {fmtNum(totalQty)} <span className="text-xs font-semibold text-amber-200 font-sans">unit</span>
                            </p>
                        </div>
                        <div className="w-8 h-8 rounded-lg bg-white/20 text-white flex items-center justify-center">
                            <Package className="w-4 h-4" />
                        </div>
                    </div>
                </div>

                <div className="rounded-xl p-3.5 shadow-sm" style={{ background: '#7C3AED' }}>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-purple-100 font-sans">Total Nilai Persediaan</p>
                            <p className="text-xl font-extrabold text-white tracking-tight font-sans mt-0.5">
                                {fmtNum(Math.round(grandTotalValue))}
                            </p>
                        </div>
                        <div className="w-8 h-8 rounded-lg bg-white/20 text-white flex items-center justify-center">
                            <TrendingUp className="w-4 h-4" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Action Bar & Search Filter */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-wrap items-center justify-between gap-4 font-sans">
                <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                    <div className="relative w-full max-w-sm">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            className="form-input text-xs pl-9 py-2 font-sans"
                            placeholder="Cari kode item, nama barang atau SKU..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                    <button
                        type="button"
                        onClick={downloadTemplate}
                        className="btn-orange font-bold text-xs py-2 px-3 flex items-center gap-1.5"
                    >
                        <FileDown className="w-4 h-4" />Unduh Template Impor
                    </button>
                    <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        className="btn-emerald font-bold text-xs py-2 px-3 flex items-center gap-1.5"
                    >
                        <Upload className="w-4 h-4" />Impor Data
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="btn-danger-red font-bold text-xs py-2 px-3 flex items-center gap-1.5"
                    >
                        <Save className="w-4 h-4" /> {saving ? 'Menyimpan...' : 'Simpan Saldo Awal'}
                    </button>
                    <button
                        type="button"
                        onClick={downloadReport}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs py-2 px-4 rounded-lg shadow-md shadow-red-200/60 flex items-center gap-1.5 font-sans transition-all border-0 cursor-pointer"
                    >
                        <Download className="w-4 h-4" />Unduh Laporan
                    </button>
                    <button className="btn-square-refresh" onClick={loadData} title="Refresh data">
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Main Table */}
            <div className="card font-sans overflow-hidden">
                <div className="w-full">
                    <table className="w-full text-left border-collapse table-auto font-sans">
                        <thead>
                            <tr className="bg-slate-100/80 border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider font-sans">
                                <th className="py-3 px-3" style={{ width: '110px' }}>Kode</th>
                                <th className="py-3 px-3" style={{ minWidth: '220px' }}>Nama Item</th>
                                <th className="py-3 px-3" style={{ width: '100px' }}>Kategori</th>
                                <th className="py-3 px-3 text-center" style={{ width: '80px' }}>Satuan</th>
                                <th className="py-3 px-3 text-center" style={{ width: '130px' }}>Status Saldo</th>
                                <th className="py-3 px-3 text-right" style={{ width: '120px' }}>Kuantitas (Qty)</th>
                                <th className="py-3 px-3 text-right" style={{ width: '150px' }}>HPP / Unit (Rp)</th>
                                <th className="py-3 px-3 text-right" style={{ width: '150px' }}>Total Nilai (Rp)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white text-xs font-sans">
                            {filteredItems.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="text-center py-12 text-slate-400 font-sans">
                                        <Package className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                        <p className="text-xs">{searchTerm ? 'Item tidak ditemukan' : 'Belum ada master item / data kosong'}</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredItems.map(item => {
                                    const isLocked = lockedItemIds.has(item.id)
                                    const stateVal = editableBalances[item.id] || { quantity: 0, unitCost: 0 }
                                    const totalVal = stateVal.quantity * stateVal.unitCost

                                    return (
                                        <tr key={item.id} className={`transition-colors ${isLocked ? 'bg-slate-50/60' : 'hover:bg-slate-50'}`}>
                                            <td className="py-2.5 px-3 font-mono font-bold text-primary-700 whitespace-nowrap">{item.itemCode || '—'}</td>
                                            <td className="py-2.5 px-3">
                                                <div className="font-bold text-slate-900 leading-tight">{item.itemName}</div>
                                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">SKU: {item.skuCode || '—'}</div>
                                            </td>
                                            <td className="py-2.5 px-3 whitespace-nowrap">
                                                <span className={`badge ${CAT_COLORS[item.category] || 'badge-gray'} text-[10px] px-2 py-0.5 font-bold`}>
                                                    {CAT_LABELS[item.category] || item.category}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-3 text-center text-slate-600 font-medium whitespace-nowrap">{item.baseUnit}</td>
                                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                                {isLocked ? (
                                                    <span
                                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200"
                                                        title="Saldo awal terkunci karena item ini sudah memiliki riwayat transaksi (GRN / Outflow / Penjualan)"
                                                    >
                                                        <Lock className="w-3 h-3 text-amber-600" /> Terkunci
                                                    </span>
                                                ) : (
                                                    <span
                                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"
                                                        title="Item belum ada transaksi. Saldo awal dapat diinput atau diperbarui bebas."
                                                    >
                                                        <CheckCircle className="w-3 h-3 text-emerald-600" /> Siap Input
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-2.5 px-3">
                                                <input
                                                    type="number"
                                                    disabled={isLocked}
                                                    className={`form-input text-right font-sans font-bold text-xs py-1 px-2.5 ${
                                                        isLocked
                                                            ? 'bg-slate-100/90 text-slate-400 border-slate-200 cursor-not-allowed select-none'
                                                            : 'focus:ring-primary-500'
                                                    }`}
                                                    value={stateVal.quantity === '' ? '' : (stateVal.quantity ?? 0)}
                                                    onChange={(e) => handleQtyChange(item.id, e.target.value)}
                                                    placeholder="0"
                                                    min="0"
                                                    title={isLocked ? 'Saldo awal terkunci karena item ini sudah memiliki transaksi' : 'Kuantitas saldo awal item'}
                                                />
                                            </td>
                                            <td className="py-2.5 px-3">
                                                <input
                                                    type="number"
                                                    disabled={isLocked}
                                                    className={`form-input text-right font-sans font-bold text-xs py-1 px-2.5 ${
                                                        isLocked
                                                            ? 'bg-slate-100/90 text-slate-400 border-slate-200 cursor-not-allowed select-none'
                                                            : 'focus:ring-primary-500'
                                                    }`}
                                                    value={stateVal.unitCost === '' ? '' : (stateVal.unitCost ?? 0)}
                                                    onChange={(e) => handleCostChange(item.id, e.target.value)}
                                                    placeholder="0"
                                                    min="0"
                                                    step="100"
                                                    title={isLocked ? 'HPP terkunci karena item ini sudah memiliki transaksi' : 'Harga pokok pembelian per unit'}
                                                />
                                            </td>
                                            <td className="py-2.5 px-3 text-right font-sans text-xs font-extrabold text-slate-900 tracking-tight whitespace-nowrap">
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

            {/* Import Preview Modal */}
            <Modal
                open={importModal}
                onClose={() => { setImportModal(false); setImportRows([]); setImportErrs([]) }}
                title="Preview Import Saldo Awal Item Inventory"
                size="xl"
                footer={
                    <>
                        <button
                            type="button"
                            className="btn-secondary text-xs px-3.5 py-2 font-bold"
                            onClick={() => { setImportModal(false); setImportRows([]); setImportErrs([]) }}
                            disabled={importing}
                        >
                            Batal
                        </button>
                        <button
                            type="button"
                            className="btn-primary text-xs px-4 py-2 font-bold flex items-center gap-1.5"
                            disabled={importing || importRows.filter(r => r.matchedItem && r.quantity > 0).length === 0}
                            onClick={executeImport}
                        >
                            <Upload className="w-3.5 h-3.5" />
                            {importing ? 'Mengimpor...' : `Impor & Simpan (${importRows.filter(r => r.matchedItem && r.quantity > 0).length} Item)`}
                        </button>
                    </>
                }
            >
                <div className="space-y-4 text-xs font-sans">
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

                    <div className="overflow-x-auto max-h-96 border rounded-lg font-sans">
                        <table className="table-base w-full text-left border-collapse font-sans">
                            <thead className="sticky top-0 bg-slate-100 font-bold text-[11px]">
                                <tr>
                                    <th className="p-2.5">#</th>
                                    <th className="p-2.5">Kode</th>
                                    <th className="p-2.5">Nama Item</th>
                                    <th className="p-2.5 text-right">Qty Impor</th>
                                    <th className="p-2.5 text-right">HPP / Unit</th>
                                    <th className="p-2.5 text-right">Total Nilai</th>
                                    <th className="p-2.5 text-center">Status Matching</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 bg-white">
                                {importRows.map((row, idx) => (
                                    <tr key={idx} className={row.matchedItem ? 'hover:bg-slate-50' : 'bg-red-50/50'}>
                                        <td className="p-2.5 text-slate-400 font-mono text-[10px]">{row.rowNum}</td>
                                        <td className="p-2.5 font-mono font-bold text-primary-700">{row.code}</td>
                                        <td className="p-2.5 font-bold text-slate-800">
                                            {row.name}
                                            {row.matchedItem && (
                                                <span className="block text-[10px] text-slate-400 font-normal">
                                                    Terhubung ke: {row.matchedItem.itemName} ({row.matchedItem.itemCode})
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-2.5 text-right font-sans font-bold">{fmtNum(row.quantity)}</td>
                                        <td className="p-2.5 text-right font-sans font-bold">{fmtIDR(row.unitCost)}</td>
                                        <td className="p-2.5 text-right font-sans font-extrabold text-slate-900">{fmtIDR(row.totalValue)}</td>
                                        <td className="p-2.5 text-center whitespace-nowrap">
                                            {row.matchedItem ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">
                                                    <CheckCircle className="w-3 h-3" /> Cocok
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">
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
            </Modal>
        </div>
    )
}
