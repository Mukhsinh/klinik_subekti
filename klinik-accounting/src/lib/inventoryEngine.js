/**
 * inventoryEngine.js — Chronological-Aware Dual Inventory Logic Engine
 *
 * Aturan Kronologis & Ketersediaan Stok:
 * 1. Hanya batch yang SUDAH ADA pada atau sebelum tanggal transaksi (effectiveDate <= transactionDate)
 *    yang boleh dipilih. Batch dari pembelian/GRN di masa depan (setelah tanggal transaksi) WAJIB dikecualikan.
 * 2. Batch Saldo Awal (SALDO-AWAL) dianggap selalu tersedia sejak awal periode ('0000-01-01').
 * 3. Di antara batch yang memenuhi syarat kronologis dan memiliki sisa stok > 0:
 *    - Urutan prioritas: FEFO (expiry_date ASC), lalu FIFO (effectiveDate ASC), lalu batchNumber ASC.
 * 4. Jika total stok dari batch yang memenuhi syarat < qtyNeeded (kekurangan stok pada tanggal transaksi),
 *    sistem mengembalikan flag `isInsufficientStock: true` dan `shortfall > 0` agar transaksi dapat
 *    ditolak/diperingatkan — TIDAK BOLEH meminjam stok dari batch pembelian di masa depan.
 */

/**
 * Normalisasi input tanggal (ISO string / YYYY-MM-DD / Date) menjadi string 'YYYY-MM-DD'.
 * Mengembalikan null jika input kosong atau tidak valid.
 */
export function normalizeDateOnly(dateInput) {
  if (!dateInput) return null
  if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) return null
    const y = dateInput.getFullYear()
    const m = String(dateInput.getMonth() + 1).padStart(2, '0')
    const d = String(dateInput.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  const str = String(dateInput).trim()
  if (!str) return null
  // Cocokkan pola YYYY-MM-DD di awal string (termasuk ISO timestamp)
  const match = str.match(/^(\d{4}-\d{2}-\d{2})/)
  if (match) return match[1]
  const parsed = new Date(str)
  if (isNaN(parsed.getTime())) return null
  const y = parsed.getFullYear()
  const m = String(parsed.getMonth() + 1).padStart(2, '0')
  const d = String(parsed.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Menentukan apakah suatu batch merupakan batch Saldo Awal (Opening Balance).
 * Batch Saldo Awal selalu tersedia pada semua tanggal transaksi di periode berjalan.
 */
export function isOpeningBalanceBatch(batch) {
  if (!batch) return false
  const bNum = String(batch.batchNumber || batch.batch_number || '').trim().toUpperCase()
  const grnRef = String(batch.grnReference || batch.grn_reference || '').trim().toUpperCase()
  const supplier = String(batch.supplierName || batch.supplier_name || '').trim().toLowerCase()
  return (
    bNum === 'SALDO-AWAL' ||
    bNum.startsWith('SALDO-AWAL') ||
    grnRef === 'SALDO-AWAL' ||
    supplier === 'saldo awal' ||
    supplier.includes('saldo awal')
  )
}

/**
 * Mengambil tanggal efektif masuknya batch ('YYYY-MM-DD').
 * Untuk Saldo Awal, dikembalikan '0000-01-01' agar selalu memenuhi syarat kronologis.
 */
export function getBatchEffectiveDate(batch) {
  if (!batch) return '9999-12-31'
  if (isOpeningBalanceBatch(batch)) return '0000-01-01'
  return (
    normalizeDateOnly(batch.receivedAt || batch.received_at) ||
    normalizeDateOnly(batch.receivedDate || batch.received_date) ||
    normalizeDateOnly(batch.createdAt || batch.created_at) ||
    '0000-01-01'
  )
}

/**
 * Memfilter dan mengurutkan batch yang memenuhi syarat pada tanggal transaksi tertentu:
 * - quantityCurrent > 0
 * - effectiveDate <= transactionDate (jika transactionDate diberikan)
 * - Urutan: expiryDate ASC (FEFO), lalu effectiveDate ASC (FIFO), lalu batchNumber ASC
 *
 * @param {Array} batches
 * @param {string|Date|null} transactionDate
 * @returns {Array} Eligible sorted batches
 */
export function getEligibleBatchesForDate(batches, transactionDate = null) {
  const txDate = normalizeDateOnly(transactionDate)

  return [...(batches || [])]
    .filter(b => {
      const qty = Number(b.quantityCurrent ?? b.quantity_current ?? 0)
      if (qty <= 0) return false
      if (txDate) {
        const batchDate = getBatchEffectiveDate(b)
        if (batchDate > txDate) return false
      }
      return true
    })
    .sort((a, b) => {
      const expA = normalizeDateOnly(a.expiryDate || a.expiry_date) || '2099-12-31'
      const expB = normalizeDateOnly(b.expiryDate || b.expiry_date) || '2099-12-31'
      if (expA !== expB) return expA.localeCompare(expB)

      const dateA = getBatchEffectiveDate(a)
      const dateB = getBatchEffectiveDate(b)
      if (dateA !== dateB) return dateA.localeCompare(dateB)

      const numA = String(a.batchNumber || a.batch_number || '')
      const numB = String(b.batchNumber || b.batch_number || '')
      return numA.localeCompare(numB)
    })
}

/**
 * Menghitung total stok yang benar-benar tersedia pada tanggal transaksi tertentu
 * (hanya dari batch yang sudah masuk pada atau sebelum transactionDate).
 */
export function getAvailableStockAsOfDate(batches, transactionDate = null) {
  const eligible = getEligibleBatchesForDate(batches, transactionDate)
  return eligible.reduce((sum, b) => sum + Number(b.quantityCurrent ?? b.quantity_current ?? 0), 0)
}

/**
 * Menghitung valuasi HPP & rincian batch untuk transaksi pengeluaran stok
 * dengan mempertimbangkan urutan kronologis transaksi (transactionDate).
 *
 * @param {Array} batches - Daftar batch persediaan untuk item terkait
 * @param {number} qtyNeeded - Kuantitas yang diminta keluar
 * @param {number} fallbackCost - HPP fallback bila allowFallback=true & stok tidak cukup
 * @param {string|Date|null} transactionDate - Tanggal kejadian transaksi ('YYYY-MM-DD')
 * @param {Object} options - { allowFallback: true }
 * @returns {Object} { totalValuation, avgUnitCost, fifoBreakdown, eligibleStock, shortfall, isInsufficientStock, excludedFutureStock }
 */
export function calculateFifoValuation(
  batches,
  qtyNeeded,
  fallbackCost = 0,
  transactionDate = null,
  options = {}
) {
  const { allowFallback = true } = options
  const reqQty = Number(qtyNeeded) || 0
  const txDate = normalizeDateOnly(transactionDate)

  const totalCurrentAllBatches = (batches || [])
    .filter(b => Number(b.quantityCurrent ?? b.quantity_current ?? 0) > 0)
    .reduce((sum, b) => sum + Number(b.quantityCurrent ?? b.quantity_current ?? 0), 0)

  const eligibleBatches = getEligibleBatchesForDate(batches, txDate)
  const eligibleStock = eligibleBatches.reduce(
    (sum, b) => sum + Number(b.quantityCurrent ?? b.quantity_current ?? 0),
    0
  )
  const excludedFutureStock = Math.max(0, totalCurrentAllBatches - eligibleStock)

  if (reqQty <= 0) {
    return {
      totalValuation: 0,
      avgUnitCost: 0,
      fifoBreakdown: [],
      eligibleStock,
      shortfall: 0,
      isInsufficientStock: false,
      excludedFutureStock,
    }
  }

  let remaining = reqQty
  let totalValuation = 0
  const fifoBreakdown = []

  for (const batch of eligibleBatches) {
    if (remaining <= 0) break
    const currentQty = Number(batch.quantityCurrent ?? batch.quantity_current ?? 0)
    const cost = Number(batch.unitCostPrice ?? batch.unit_cost_price ?? 0)
    const take = Math.min(currentQty, remaining)

    remaining -= take
    const val = take * cost
    totalValuation += val

    fifoBreakdown.push({
      batchId: batch.id,
      batchNumber: batch.batchNumber || batch.batch_number,
      qty: take,
      unitCost: cost,
      totalCost: val,
      expiryDate: batch.expiryDate || batch.expiry_date,
      receivedAt: batch.receivedAt || batch.received_at || batch.createdAt,
      effectiveDate: getBatchEffectiveDate(batch),
    })
  }

  const shortfall = remaining
  const isInsufficientStock = shortfall > 0

  // Fallback hanya digunakan untuk estimasi bila diizinkan; transaksi pengeluaran non-pasien
  // wajib memblokir jika isInsufficientStock === true.
  if (remaining > 0 && allowFallback) {
    const defaultCost = Number(fallbackCost || 0)
    const val = remaining * defaultCost
    totalValuation += val
    fifoBreakdown.push({
      batchId: null,
      batchNumber: 'DIRECT-FIFO-FALLBACK',
      qty: remaining,
      unitCost: defaultCost,
      totalCost: val,
      expiryDate: null,
      receivedAt: txDate || new Date().toISOString(),
      effectiveDate: txDate || null,
    })
  }

  const processedQty = allowFallback ? reqQty : reqQty - shortfall
  const avgUnitCost = processedQty > 0 ? totalValuation / processedQty : 0

  return {
    totalValuation,
    avgUnitCost,
    fifoBreakdown,
    eligibleStock,
    shortfall,
    isInsufficientStock,
    excludedFutureStock,
  }
}

/**
 * Memotong stok fisik menggunakan FEFO yang sadar kronologi (Chronological FEFO).
 * Hanya mengambil dari batch yang sudah masuk pada atau sebelum `transactionDate`.
 *
 * @param {Array} batches - Daftar batch persediaan untuk item terkait
 * @param {number} qtyNeeded - Kuantitas yang diminta keluar
 * @param {string|Date|null} transactionDate - Tanggal kejadian transaksi ('YYYY-MM-DD')
 * @returns {Array} Daftar update batch fisik [{ batchId, batchNumber, currentQty, takenQty, newQtyCurrent, expiryDate, unitCostPrice, effectiveDate }]
 */
export function depleteFefoPhysicalStock(batches, qtyNeeded, transactionDate = null) {
  const reqQty = Number(qtyNeeded) || 0
  if (reqQty <= 0) return []

  const eligibleBatches = getEligibleBatchesForDate(batches, transactionDate)

  let remaining = reqQty
  const physicalUpdates = []

  for (const batch of eligibleBatches) {
    if (remaining <= 0) break
    const currentQty = Number(batch.quantityCurrent ?? batch.quantity_current ?? 0)
    const take = Math.min(currentQty, remaining)

    remaining -= take
    const newQtyCurrent = currentQty - take

    physicalUpdates.push({
      batchId: batch.id,
      batchNumber: batch.batchNumber || batch.batch_number,
      currentQty,
      takenQty: take,
      newQtyCurrent,
      expiryDate: batch.expiryDate || batch.expiry_date,
      unitCostPrice: Number(batch.unitCostPrice ?? batch.unit_cost_price ?? 0),
      effectiveDate: getBatchEffectiveDate(batch),
    })
  }

  return physicalUpdates
}

// ══════════════════════════════════════════════════════════════
// KARTU STOK (STOCK LEDGER) & FILTER JENIS OBAT
// ══════════════════════════════════════════════════════════════

export const STOCK_CATEGORY_FILTERS = [
  { value: 'ALL', label: 'Semua Jenis Obat & BHP' },
  { value: 'GENERIK', label: 'Obat Generik / OTC' },
  { value: 'PATEN', label: 'Obat Paten / Branded' },
  { value: 'BHP', label: 'Bahan Habis Pakai (BHP)' },
]

/**
 * Menormalisasi kategori item farmasi ke grup standar:
 * 'GENERIK' | 'PATEN' | 'BHP' | 'OTHER'
 */
export function normalizePharmacyCategory(item) {
  if (!item) return 'OTHER'
  const rawCat = String(item.category || item.itemCategory || item.item_category || '').trim().toUpperCase()
  const rawCode = String(item.itemCode || item.item_code || item.skuCode || item.sku_code || '').trim().toUpperCase()

  if (
    rawCat === 'BHP' ||
    rawCat === 'PEMAKAIAN BHP' ||
    rawCat === 'PEMAKAIAN_BHP' ||
    rawCat === 'BHP_MEDIS' ||
    rawCat.includes('BHP') ||
    rawCode.startsWith('BHP-')
  ) {
    return 'BHP'
  }
  if (
    rawCat === 'BRANDED' ||
    rawCat === 'OBAT_PATEN' ||
    rawCat === 'PATEN' ||
    rawCat === 'ETHICAL' ||
    rawCat.includes('PATEN') ||
    rawCat.includes('BRANDED') ||
    rawCode.startsWith('PAT-') ||
    rawCode.startsWith('ETH-')
  ) {
    return 'PATEN'
  }
  if (
    rawCat === 'GENERIK' ||
    rawCat === 'OBAT_GENERIK' ||
    rawCat === 'OTC' ||
    rawCat.includes('GENERIK') ||
    rawCat.includes('OTC') ||
    rawCat.includes('BEBAS') ||
    rawCode.startsWith('GEN-') ||
    rawCode.startsWith('OTC-')
  ) {
    return 'GENERIK'
  }
  return 'OTHER'
}

/**
 * Memfilter daftar item/rekap berdasarkan filter jenis obat.
 * Jika categoryFilter kosong / null / 'ALL', seluruh data dikembalikan.
 */
export function filterStockByCategory(items, categoryFilter = 'ALL') {
  const list = Array.isArray(items) ? items : []
  if (!categoryFilter || categoryFilter === 'ALL') return list
  const target = String(categoryFilter).toUpperCase()
  return list.filter(it => normalizePharmacyCategory(it) === target)
}

/**
 * Membangun baris Kartu Stok kronologis untuk 1 item:
 * - Baris SALDO_AWAL tampil pada kolom Sisa Stok (saldo berjalan awal),
 *   dengan Penerimaan = 0 dan Pengeluaran = 0 sehingga TIDAK menambah Total Penerimaan.
 * - Rumus konsisten: Sisa Stok Akhir = Saldo Awal + Total Penerimaan - Total Pengeluaran.
 */
export function buildKartuStokRows(ledgerEntries = []) {
  const isOpeningRec = (l) => {
    const t = String(l.transactionType || l.transaction_type || '').toUpperCase()
    const r = String(l.referenceNumber || l.reference_number || '').toUpperCase()
    const n = String(l.notes || '').toLowerCase()
    return t === 'SALDO_AWAL' || r === 'SALDO-AWAL' || r.startsWith('SALDO-AWAL') || n.includes('saldo awal')
  }

  const sortedAsc = [...(ledgerEntries || [])].sort((a, b) => {
    const isAOpen = isOpeningRec(a)
    const isBOpen = isOpeningRec(b)
    if (isAOpen && !isBOpen) return -1
    if (!isAOpen && isBOpen) return 1
    const timeA = new Date(a.loggedAt || a.transactionDate || a.createdAt || 0).getTime()
    const timeB = new Date(b.loggedAt || b.transactionDate || b.createdAt || 0).getTime()
    return timeA - timeB
  })

  let currentBalance = 0
  let totalOpening = 0
  let totalPenerimaan = 0
  let totalPengeluaran = 0

  const rows = sortedAsc.map(l => {
    const isOpening = isOpeningRec(l)
    const rawIn = Number(l.quantityIn ?? l.quantity_in ?? 0)
    const qtyOut = Number(l.quantityOut ?? l.quantity_out ?? 0)

    const saldoAwalBaris = currentBalance
    const penerimaan = isOpening ? 0 : rawIn
    const pengeluaran = isOpening ? 0 : qtyOut
    const saldoAkhirBaris = isOpening ? (saldoAwalBaris + rawIn) : (saldoAwalBaris + penerimaan - pengeluaran)

    currentBalance = saldoAkhirBaris
    if (isOpening) {
      totalOpening += rawIn
    } else {
      totalPenerimaan += penerimaan
      totalPengeluaran += pengeluaran
    }

    return {
      ...l,
      isOpening,
      transactionType: isOpening ? 'SALDO_AWAL' : l.transactionType,
      saldoAwal: saldoAwalBaris,
      penerimaan,
      pengeluaran,
      saldoAkhir: saldoAkhirBaris,
    }
  })

  return {
    rows,
    summary: {
      saldoAwal: totalOpening,
      totalPenerimaan,
      totalPengeluaran,
      sisaStokAkhir: currentBalance,
    }
  }
}
