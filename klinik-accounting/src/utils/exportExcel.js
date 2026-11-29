import * as XLSX from 'xlsx'
import { fmtDate, fmtDateTime } from './format'

const DEFAULT_CLINIC = 'KLINIK AKUNTANSI AKAPRO'
const DEFAULT_FOOTER = 'Dokumen laporan ini dihasilkan secara otomatis oleh Sistem Akuntansi Klinik dan sah tanpa tanda tangan basah jika dicetak secara elektronik.'
function getClinicName(appSettings) { return (appSettings?.companyName || appSettings?.appName || DEFAULT_CLINIC).toUpperCase() }
function getFooterText(appSettings) { return appSettings?.footerText || DEFAULT_FOOTER }

function autoWidthAOA(ws, aoaData) {
  const colWidths = {}
  aoaData.forEach(row => {
    if (Array.isArray(row)) {
      row.forEach((cell, i) => {
        const len = String(cell ?? '').length
        colWidths[i] = Math.max(colWidths[i] || 10, len + 3)
      })
    }
  })
  ws['!cols'] = Object.values(colWidths).map(w => ({ wch: Math.min(w, 60) }))
}

function autoWidth(ws, data) {
  const colWidths = {}
  data.forEach(row => {
    Object.keys(row).forEach((k, i) => {
      const len = String(row[k] ?? '').length
      colWidths[i] = Math.max(colWidths[i] || 8, len + 2)
    })
  })
  ws['!cols'] = Object.values(colWidths).map(w => ({ wch: Math.min(w, 50) }))
}

// Helper to format full formal timestamp in Indonesian
function getFormalTimestamp() {
  return new Date().toLocaleString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

// ─── Trial Balance Excel ──────────────────────────────────────
export function exportTrialBalanceExcel(data, period, branchName, appSettings = null) {
  const CLINIC = getClinicName(appSettings)
  const rows = data.map(r => ({
    'Kode Akun': r.accountCode,
    'Nama Akun': r.accountName,
    'Tipe Akun': r.accountType,
    'Natural Balance': r.naturalBalance,
    'Total Debit': Number(r.totalDebit || 0),
    'Total Kredit': Number(r.totalCredit || 0),
    'Saldo Debit': Number(r.finalDebit || 0),
    'Saldo Kredit': Number(r.finalCredit || 0),
  }))

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)
  autoWidth(ws, rows)

  const lastRow = rows.length + 1
  ws[`E${lastRow + 1}`] = { f: `SUM(E2:E${lastRow})`, t: 'n' }
  ws[`F${lastRow + 1}`] = { f: `SUM(F2:F${lastRow})`, t: 'n' }
  ws[`G${lastRow + 1}`] = { f: `SUM(G2:G${lastRow})`, t: 'n' }
  ws[`H${lastRow + 1}`] = { f: `SUM(H2:H${lastRow})`, t: 'n' }

  XLSX.utils.book_append_sheet(wb, ws, 'Neraca Saldo')

  const meta = XLSX.utils.aoa_to_sheet([
    [CLINIC],
    ['Neraca Saldo (Trial Balance)'],
    [`Periode: ${period}`],
    [`Cabang: ${branchName}`],
    [`Dicetak: ${getFormalTimestamp()} WIB`],
    ['Catatan: Nilai dalam Rupiah (IDR). Tidak ada sel yang digabung untuk menjaga kompatibilitas VLOOKUP/XLOOKUP.'],
    [],
    [getFooterText(appSettings)],
  ])
  XLSX.utils.book_append_sheet(wb, meta, 'Info')

  XLSX.writeFile(wb, `NeracaSaldo_${period?.replace(/\s/g, '_') || 'export'}.xlsx`)
}

// ─── General Ledger Excel ─────────────────────────────────────
export function exportLedgerExcel(accountName, entries, period, appSettings = null) {
  const CLINIC = getClinicName(appSettings)
  const safeName = (accountName || 'BukuBesar').replace(/[\/\\?%*:|"<>]/g, '').trim()
  const rows = entries.map(r => ({
    'Tanggal': fmtDate(r.transactionDate),
    'No. Jurnal': r.entryNumber,
    'Keterangan': r.description,
    'Debit': Number(r.debit || 0),
    'Kredit': Number(r.credit || 0),
    'Saldo Berjalan': Number(r.runningBalance || 0),
    'Saldo D/K': r.balanceSide || '',
  }))

  const wb = XLSX.utils.book_new()

  // Info sheet with header
  const info = XLSX.utils.aoa_to_sheet([
    [CLINIC],
    [`BUKU BESAR: ${accountName}`],
    [`Periode: ${period}`],
    [`Dicetak: ${getFormalTimestamp()} WIB`],
    [],
    [getFooterText(appSettings)],
  ])
  XLSX.utils.book_append_sheet(wb, info, 'Info')

  const ws = XLSX.utils.json_to_sheet(rows)
  autoWidth(ws, rows)
  XLSX.utils.book_append_sheet(wb, ws, safeName.substring(0, 31))
  XLSX.writeFile(wb, `BukuBesar_${safeName.replace(/\s+/g, '_')}_${period || 'export'}.xlsx`)
}

// ─── Income Statement Excel ───────────────────────────────────
export function exportIncomeStatementExcel(data, period, branchName, appSettings = null) {
  const CLINIC = getClinicName(appSettings)
  const rows = data.map(r => ({
    'Kode Akun': r.isGroup ? '' : r.accountCode,
    'Keterangan': r.accountName,
    'Jumlah': r.isGroup ? 0 : Number(r.amount || 0),
    'Sub-Total': r.isGroup ? Number(r.subtotal || 0) : 0,
  }))

  const wb = XLSX.utils.book_new()

  // Info sheet with header
  const info = XLSX.utils.aoa_to_sheet([
    [CLINIC],
    ['LAPORAN LABA RUGI (INCOME STATEMENT)'],
    [`Periode: ${period}`],
    [`Cabang: ${branchName}`],
    [`Dicetak: ${getFormalTimestamp()} WIB`],
    [],
    [getFooterText(appSettings)],
  ])
  XLSX.utils.book_append_sheet(wb, info, 'Info')

  const ws = XLSX.utils.json_to_sheet(rows)
  autoWidth(ws, rows)
  XLSX.utils.book_append_sheet(wb, ws, 'Laba Rugi')
  XLSX.writeFile(wb, `LabaRugi_${period?.replace(/\s/g, '_') || 'export'}.xlsx`)
}

// ─── Balance Sheet Excel ──────────────────────────────────────
export function exportBalanceSheetExcel(assets, liabEquity, period, branchName, appSettings = null) {
  const CLINIC = getClinicName(appSettings)
  const maxLen = Math.max(assets.length, liabEquity.length)
  const rows = []
  for (let i = 0; i < maxLen; i++) {
    const a = assets[i]
    const l = liabEquity[i]
    rows.push({
      'Kode (Aset)': a?.accountCode || '',
      'Keterangan (Aset)': a?.accountName || '',
      'Nilai Aset': a ? Number(a.balance || 0) : '',
      'Kode (Liabilitas/Ekuitas)': l?.accountCode || '',
      'Keterangan (Liabilitas/Ekuitas)': l?.accountName || '',
      'Nilai Liabilitas/Ekuitas': l ? Number(l.balance || 0) : '',
    })
  }
  const wb = XLSX.utils.book_new()

  // Info sheet with header
  const info = XLSX.utils.aoa_to_sheet([
    [CLINIC],
    ['LAPORAN POSISI KEUANGAN (NERACA)'],
    [`Periode: ${period}`],
    [`Cabang: ${branchName}`],
    [`Dicetak: ${getFormalTimestamp()} WIB`],
    [],
    [getFooterText(appSettings)],
  ])
  XLSX.utils.book_append_sheet(wb, info, 'Info')

  const ws = XLSX.utils.json_to_sheet(rows)
  autoWidth(ws, rows)
  XLSX.utils.book_append_sheet(wb, ws, 'Neraca')
  XLSX.writeFile(wb, `Neraca_${period?.replace(/\s/g, '_') || 'export'}.xlsx`)
}

// ─── Journal Entries Excel ─────────────────────────────────────
export function exportJournalExcel(entries, items, coa, period, appSettings = null) {
  const CLINIC = getClinicName(appSettings)
  const coaMap = Object.fromEntries((coa || []).map(a => [a.accountCode, a.accountName]))
  const rows = []
  entries.forEach(e => {
    const eItems = items.filter(i => i.journalEntryId === e.id)
    eItems.forEach(it => {
      rows.push({
        'No. Jurnal': e.entryNumber,
        'Tanggal': fmtDate(e.transactionDate),
        'Tipe': e.entryType,
        'Status': e.status,
        'Keterangan': e.description,
        'Kode Akun': it.accountCode,
        'Nama Akun': coaMap[it.accountCode] || it.accountCode,
        'Ket. Baris': it.description || '',
        'Debit': Number(it.debit || 0),
        'Kredit': Number(it.credit || 0),
      })
    })
  })
  const wb = XLSX.utils.book_new()

  // Info sheet with header
  const info = XLSX.utils.aoa_to_sheet([
    [CLINIC],
    ['JURNAL UMUM (GENERAL JOURNAL)'],
    [`Periode: ${period}`],
    [`Dicetak: ${getFormalTimestamp()} WIB`],
    [],
    [getFooterText(appSettings)],
  ])
  XLSX.utils.book_append_sheet(wb, info, 'Info')

  const ws = XLSX.utils.json_to_sheet(rows)
  autoWidth(ws, rows)
  XLSX.utils.book_append_sheet(wb, ws, 'Jurnal Umum')
  XLSX.writeFile(wb, `JurnalUmum_${period || 'export'}.xlsx`)
}

// ─── Formal Stock Report Excel (All Items Recap with Kop, Auto Date & Signature Footer) ───────
export function exportStockExcel(items, batches, recapData, appSettings = null, options = {}) {
  const CLINIC = getClinicName(appSettings)
  const nowFormatted = getFormalTimestamp()
  const categoryFilter = options?.categoryFilter || 'ALL'
  const categoryLabel = options?.categoryLabel || 'Semua Jenis Obat & BHP'

  const aoaData = [
    [CLINIC],
    ['LAPORAN REKAPITULASI STOCK LEDGER & MUTASI PERSEDIAAN'],
    ['Standard Akuntansi Persediaan Rumah Sakit & Klinik (PSAK 14) | Metode FEFO (First Expiry First Out) & FIFO (First In First Out)'],
    [`Filter Jenis Obat / Kategori: ${categoryLabel}`],
    [`Tanggal Cetak Otomatis: ${nowFormatted} WIB`],
    [], // Blank separator row
    [
      'No.',
      'Kode / SKU',
      'Nama Item Farmasi / Medis',
      'Kategori',
      'Satuan',
      'Saldo Awal',
      'Penerimaan (+)',
      'Pengeluaran (-)',
      'Saldo Akhir (Stok Tersedia)',
      'Rata-rata HPP (Rp)',
      'Nilai Total Stok (Rp)',
      'Metode Valuasi'
    ]
  ]

  let sumSaldoAwal = 0
  let sumPenerimaan = 0
  let sumPengeluaran = 0
  let sumSaldoAkhir = 0
  let sumTotalNilai = 0

    ; (recapData || []).forEach((item, idx) => {
      const activeBatches = (batches || []).filter(b => b.itemId === item.id && b.quantityCurrent > 0)
      const totalStock = item.saldoAkhir !== undefined ? item.saldoAkhir : activeBatches.reduce((s, b) => s + b.quantityCurrent, 0)
      const avgCost = activeBatches.length
        ? activeBatches.reduce((s, b) => s + b.unitCostPrice * b.quantityCurrent, 0) / (activeBatches.reduce((s, b) => s + b.quantityCurrent, 0) || 1)
        : Number(item.purchasePrice || item.hpp || 0)
      const totalVal = Number((totalStock * avgCost).toFixed(2))

      const sAwal = Number(item.saldoAwal || 0)
      const pMasuk = Number(item.penerimaan || 0)
      const pKeluar = Number(item.pengeluaran || 0)

      sumSaldoAwal += sAwal
      sumPenerimaan += pMasuk
      sumPengeluaran += pKeluar
      sumSaldoAkhir += totalStock
      sumTotalNilai += totalVal

      aoaData.push([
        idx + 1,
        item.itemCode || item.skuCode || '—',
        item.itemName,
        item.category || 'Obat / Medis',
        item.baseUnit || item.unit || 'Unit',
        sAwal,
        pMasuk,
        pKeluar,
        totalStock,
        Number(avgCost.toFixed(2)),
        totalVal,
        'FEFO / FIFO'
      ])
    })

  // Total Summary Row
  aoaData.push([
    '',
    '',
    'TOTAL REKAPITULASI MUTASI',
    '',
    '',
    sumSaldoAwal,
    sumPenerimaan,
    sumPengeluaran,
    sumSaldoAkhir,
    '',
    sumTotalNilai,
    ''
  ])

  // Formal Footer & Signature Block
  aoaData.push(
    [],
    ['INFORMASI DOKUMEN & PENGESAHAN FORMAL:'],
    ['Status Dokumen', 'RESMI / TERPOSTING DATABASE SUPABASE'],
    ['Waktu Cetak Sistem', `${nowFormatted} WIB`],
    [],
    ['Disiapkan Oleh,', '', '', '', '', '', '', 'Disetujui Oleh,'],
    [],
    [],
    ['( Petugas Logistik / Apt. )', '', '', '', '', '', '', '( Manajer Keuangan / Kepala Klinik )'],
    [getFooterText(appSettings)]
  )

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(aoaData)
  autoWidthAOA(ws, aoaData)

  XLSX.utils.book_append_sheet(wb, ws, 'Rekap Stock Ledger')
  const catSuffix = categoryFilter && categoryFilter !== 'ALL' ? `_${categoryFilter}` : ''
  XLSX.writeFile(wb, `LaporanRekapStockLedger${catSuffix}_${new Date().toISOString().split('T')[0]}.xlsx`)
}

// ─── Formal Stock Ledger Single Item Detail Excel (With Kop, Auto Date & Signatures) ───
export function exportStockLedgerDetailExcel(item, ledgerLines, itemBatches, appSettings = null) {
  const CLINIC = getClinicName(appSettings)
  const nowFormatted = getFormalTimestamp()
  const safeItemName = (item?.itemName || 'KartuStok').replace(/[\/\\?%*:|"<>]/g, '').trim()
  const sheetName = safeItemName.substring(0, 31) || 'KartuStok'
  const fileName = `KartuStok_${safeItemName.replace(/\s+/g, '_') || 'Detail'}_${new Date().toISOString().split('T')[0]}.xlsx`

  const aoaData = [
    [CLINIC],
    ['LAPORAN KARTU STOK & MUTASI PERSEDIAAN INDIVIDUAL'],
    [`Nama Item: ${item?.itemName || '—'} | SKU/Kode: ${item?.skuCode || item?.itemCode || '—'} | Satuan: ${item?.baseUnit || item?.unit || 'Unit'}`],
    ['Metode Penilaian Stock Ledger: FEFO (First Expiry First Out) & FIFO (First In First Out) | Standard PSAK 14'],
    [`Tanggal Cetak Otomatis: ${nowFormatted} WIB`],
    [], // Blank separator row
    [
      'No.',
      'Tanggal & Waktu',
      'Tipe Transaksi',
      'No. Referensi',
      'Saldo Awal',
      'Penerimaan (+)',
      'Pengeluaran (-)',
      'Saldo Akhir (Stok Tersedia)',
      'HPP / Unit (Rp)',
      'Total Nilai (Rp)',
      'Metode Valuasi'
    ]
  ]

  let sumSaldoAwal = 0
  let sumPenerimaan = 0
  let sumPengeluaran = 0
  let lastBalance = 0

  if (Array.isArray(ledgerLines) && ledgerLines.length > 0) {
    ledgerLines.forEach((l, idx) => {
      const tType = String(l.transactionType || l.transaction_type || '').toUpperCase()
      const refNo = String(l.referenceNumber || l.reference_number || '').toUpperCase()
      const isOpening = l.isOpening === true || tType === 'SALDO_AWAL' || refNo === 'SALDO-AWAL' || refNo.startsWith('SALDO-AWAL')

      // Saldo Awal TIDAK boleh masuk kolom Penerimaan (+) atau menambah Total Penerimaan
      const qtyIn = isOpening
        ? 0
        : Number(l.penerimaan !== undefined ? l.penerimaan : (l.quantityIn ?? l.quantity_in ?? 0))
      const qtyOut = isOpening
        ? 0
        : Number(l.pengeluaran !== undefined ? l.pengeluaran : (l.quantityOut ?? l.quantity_out ?? 0))
      const sAkhir = Number(l.saldoAkhir !== undefined ? l.saldoAkhir : (l.balanceAfter ?? l.balance_after ?? 0))
      const unitCost = Number(l.unitCost ?? l.unit_cost ?? 0)
      const openingQty = isOpening ? Number(l.quantityIn ?? l.quantity_in ?? sAkhir ?? 0) : 0
      const totalVal = Number(l.totalValue ?? l.total_value ?? (unitCost * (isOpening ? openingQty : (qtyIn || qtyOut))))

      if (isOpening) {
        sumSaldoAwal += openingQty
      } else {
        sumPenerimaan += qtyIn
        sumPengeluaran += qtyOut
      }
      lastBalance = sAkhir

      aoaData.push([
        idx + 1,
        fmtDateTime(l.loggedAt || l.transactionDate),
        isOpening ? 'SALDO_AWAL' : l.transactionType,
        l.referenceNumber || '—',
        Number(l.saldoAwal || 0),
        qtyIn,
        qtyOut,
        sAkhir,
        unitCost,
        totalVal,
        'FEFO / FIFO'
      ])
    })
  } else {
    // Fallback row if 0 mutation entries exist yet for this item
    sumSaldoAwal = Number(item?.saldoAwal || 0)
    lastBalance = Number(item?.saldoAkhir || 0)
    aoaData.push([
      1,
      nowFormatted,
      'SALDO_AWAL',
      'SALDO-AWAL',
      0,
      0,
      0,
      lastBalance,
      Number(item?.purchasePrice || item?.hpp || 0),
      Number(item?.totalValue || 0),
      'FEFO / FIFO'
    ])
  }

  // Summary Row (Saldo Awal terpisah dari Total Penerimaan Baru)
  aoaData.push([
    '',
    '',
    'TOTAL MUTASI ITEM',
    '',
    sumSaldoAwal,
    sumPenerimaan,
    sumPengeluaran,
    lastBalance,
    '',
    '',
    ''
  ])

  // Formal Footer & Sign-off Block
  aoaData.push(
    [],
    ['INFORMASI DOKUMEN & PENGESAHAN FORMAL:'],
    ['Status Dokumen', 'RESMI / TERPOSTING DATABASE SUPABASE'],
    ['Waktu Cetak Sistem', `${nowFormatted} WIB`],
    [],
    ['Disiapkan Oleh,', '', '', '', '', '', '', 'Disetujui Oleh,'],
    [],
    [],
    ['( Petugas Logistik / Apt. )', '', '', '', '', '', '', '( Manajer Keuangan / Kepala Klinik )'],
    [getFooterText(appSettings)]
  )

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(aoaData)
  autoWidthAOA(ws, aoaData)
  XLSX.utils.book_append_sheet(wb, ws, sheetName)

  // Add active batch details sheet if available
  if (Array.isArray(itemBatches) && itemBatches.length > 0) {
    const batchAoa = [
      [CLINIC],
      [`DETAIL BATCH & ED — ${item?.itemName || '—'}`],
      [`Tanggal Cetak: ${nowFormatted} WIB`],
      [],
      ['No.', 'No. Batch', 'Tgl Kadaluarsa', 'Supplier / PBF', 'HPP / Unit (Rp)', 'Jumlah Diterima', 'Sisa Stok', 'Status Batch']
    ]
    itemBatches.forEach((b, i) => {
      batchAoa.push([
        i + 1,
        b.batchNumber,
        fmtDate(b.expiryDate),
        b.supplierName || '—',
        Number(b.unitCostPrice || 0),
        Number(b.quantityReceived || 0),
        Number(b.quantityCurrent || 0),
        b.quantityCurrent > 0 ? 'Aktif' : 'Habis'
      ])
    })
    const wsBatch = XLSX.utils.aoa_to_sheet(batchAoa)
    autoWidthAOA(wsBatch, batchAoa)
    XLSX.utils.book_append_sheet(wb, wsBatch, 'Detail Batch')
  }

  XLSX.writeFile(wb, fileName)
}

// ─── Statement of Changes in Equity (Perubahan Ekuitas) Excel ───
export function exportEquityChangesExcel(data, period, branchName, appSettings = null) {
  const CLINIC = getClinicName(appSettings)
  const rows = data.map(r => ({
    'Kode Akun': r.isHeader || r.isTotal ? '' : (r.accountCode || ''),
    'Keterangan': r.description || r.accountName || '',
    'Jumlah (Rp)': r.amount === '' || r.amount === undefined ? '' : Number(r.amount || 0),
  }))

  const wb = XLSX.utils.book_new()
  const info = XLSX.utils.aoa_to_sheet([
    [CLINIC],
    ['LAPORAN PERUBAHAN EKUITAS (STATEMENT OF CHANGES IN EQUITY)'],
    [`Periode: ${period}`],
    [`Cabang: ${branchName}`],
    [`Dicetak: ${getFormalTimestamp()} WIB`],
    [],
    [getFooterText(appSettings)],
  ])
  XLSX.utils.book_append_sheet(wb, info, 'Info')

  const ws = XLSX.utils.json_to_sheet(rows)
  autoWidth(ws, rows)
  XLSX.utils.book_append_sheet(wb, ws, 'Perubahan Ekuitas')
  XLSX.writeFile(wb, `Perubahan_Ekuitas_${period?.replace(/\s/g, '_') || 'export'}.xlsx`)
}

// ─── Cash Flow (Arus Kas) Excel ───────────────────────────────
export function exportCashFlowExcel(cashFlowData, period, branchName, appSettings = null) {
  const CLINIC = getClinicName(appSettings)
  const rows = [
    { 'Keterangan': 'I. ARUS KAS DARI AKTIVITAS OPERASI', 'Jumlah (Rp)': '' },
    { 'Keterangan': '   Laba Bersih Sebelum Pajak', 'Jumlah (Rp)': Number(cashFlowData.netProfit || 0) },
    { 'Keterangan': '   Penyesuaian untuk merekonsiliasi laba bersih:', 'Jumlah (Rp)': '' },
    { 'Keterangan': '     Beban Penyusutan & Amortisasi', 'Jumlah (Rp)': Number(cashFlowData.totalDepreciation || 0) },
    { 'Keterangan': '   Perubahan Modal Kerja:', 'Jumlah (Rp)': '' },
    { 'Keterangan': '     (Kenaikan) / Penurunan Piutang Usaha', 'Jumlah (Rp)': -Number(cashFlowData.receivableChange || 0) },
    { 'Keterangan': '     (Kenaikan) / Penurunan Persediaan Obat & BHP', 'Jumlah (Rp)': -Number(cashFlowData.inventoryChange || 0) },
    { 'Keterangan': '     Kenaikan / (Penurunan) Utang Usaha', 'Jumlah (Rp)': Number(cashFlowData.payableChange || 0) },
    { 'Keterangan': '     Kenaikan / (Penurunan) Utang Pajak', 'Jumlah (Rp)': Number(cashFlowData.taxPayableChange || 0) },
    { 'Keterangan': 'ARUS KAS BERSIH DARI AKTIVITAS OPERASI', 'Jumlah (Rp)': Number(cashFlowData.operatingCF || 0) },
    { 'Keterangan': '', 'Jumlah (Rp)': '' },
    { 'Keterangan': 'II. ARUS KAS DARI AKTIVITAS INVESTASI', 'Jumlah (Rp)': '' },
    { 'Keterangan': '   Perolehan Aset Tetap & Peralatan Medis', 'Jumlah (Rp)': -Number(cashFlowData.investingCF || 0) },
    { 'Keterangan': 'ARUS KAS BERSIH DARI AKTIVITAS INVESTASI', 'Jumlah (Rp)': Number(cashFlowData.investingCF || 0) },
    { 'Keterangan': '', 'Jumlah (Rp)': '' },
    { 'Keterangan': 'III. ARUS KAS DARI AKTIVITAS PENDANAAN', 'Jumlah (Rp)': '' },
    { 'Keterangan': '   Penambahan / (Pembayaran) Utang Bank & Modal', 'Jumlah (Rp)': Number(cashFlowData.financingCF || 0) },
    { 'Keterangan': 'ARUS KAS BERSIH DARI AKTIVITAS PENDANAAN', 'Jumlah (Rp)': Number(cashFlowData.financingCF || 0) },
    { 'Keterangan': '', 'Jumlah (Rp)': '' },
    { 'Keterangan': 'KENAIKAN / (PENURUNAN) KAS BERSIH', 'Jumlah (Rp)': Number(cashFlowData.netCashFlow || 0) },
    { 'Keterangan': 'SALDO KAS & SETARA KAS AWAL PERIODE', 'Jumlah (Rp)': Number(cashFlowData.openingCashBalance || 0) },
    { 'Keterangan': 'SALDO KAS & SETARA KAS AKHIR PERIODE', 'Jumlah (Rp)': Number(cashFlowData.endingCashBalance || 0) },
  ]

  const wb = XLSX.utils.book_new()
  const info = XLSX.utils.aoa_to_sheet([
    [CLINIC],
    ['LAPORAN ARUS KAS (STATEMENT OF CASH FLOWS) — METODE TIDAK LANGSUNG (PSAK 2)'],
    [`Periode: ${period}`],
    [`Cabang: ${branchName}`],
    [`Dicetak: ${getFormalTimestamp()} WIB`],
    ['Catatan: Angka bernilai negatif menunjukkan arus kas keluar.'],
    [],
    [getFooterText(appSettings)],
  ])
  XLSX.utils.book_append_sheet(wb, info, 'Info')

  const ws = XLSX.utils.json_to_sheet(rows)
  autoWidth(ws, rows)
  XLSX.utils.book_append_sheet(wb, ws, 'Arus Kas')
  XLSX.writeFile(wb, `Laporan_Arus_Kas_${period?.replace(/\s+/g, '_') || 'export'}.xlsx`)
}


// ─── Laporan Pasien Batal Periksa Excel (Profesional dengan Kop & Footer) ───
export function exportCancelledPatientsExcel({
  cancelledBillings = [],
  periodLabel = 'Semua Periode',
  doctorLabel = 'Semua Dokter',
  branchName = '',
  appSettings = null
}) {
  const CLINIC = getClinicName(appSettings)
  const cAddr = appSettings?.address || ''
  const cPhone = appSettings?.phone ? (appSettings.phone.startsWith('Telp:') ? appSettings.phone : `Telp: ${appSettings.phone}`) : ''
  const contactLine = [cAddr, cPhone].filter(Boolean).join(' | ')
  const nowFormatted = getFormalTimestamp()

  const totalCount = (cancelledBillings || []).length
  const totalServices = (cancelledBillings || []).reduce((s, b) => s + Number(b.subtotalServices ?? b.subtotal_services ?? 0), 0)
  const totalPharmacy = (cancelledBillings || []).reduce((s, b) => s + Number(b.subtotalPharmacy ?? b.subtotal_pharmacy ?? 0), 0)
  const totalGrand = (cancelledBillings || []).reduce((s, b) => s + Number(b.grandTotal ?? b.grand_total ?? 0), 0)

  const payMethodMap = {
    TUNAI: 'Tunai',
    QRIS: 'QRIS',
    TRANSFER: 'Transfer',
    BPJS: 'BPJS',
    ASURANSI: 'Asuransi',
    MIXED: 'Mixed'
  }

  const aoaData = [
    [CLINIC],
    ...(contactLine ? [[contactLine]] : []),
    [],
    ['LAPORAN PASIEN BATAL PERIKSA'],
    [`Periode: ${periodLabel}`],
    ...(branchName ? [[`Cabang: ${branchName}`]] : []),
    [`Filter Dokter: ${doctorLabel}`],
    [`Tanggal Cetak Otomatis: ${nowFormatted} WIB`],
    [],
    ['RINGKASAN LAPORAN'],
    ['Total Pasien Batal Periksa', `${totalCount} pasien`],
    ['Total Nilai Jasa Medis Dibatalkan (Rp)', totalServices],
    ['Total Nilai Farmasi Dibatalkan (Rp)', totalPharmacy],
    ['Total Estimasi Tagihan Dibatalkan (Rp)', totalGrand],
    [],
    [
      'No.',
      'No. Billing',
      'Tanggal Kunjungan',
      'No. Rekam Medis (RM)',
      'Nama Pasien',
      'Dokter Pemeriksa',
      'Metode Pembayaran',
      'Subtotal Jasa (Rp)',
      'Subtotal Farmasi (Rp)',
      'Total Tagihan Dibatalkan (Rp)',
      'Status'
    ]
  ]

  if (totalCount > 0) {
    cancelledBillings.forEach((b, idx) => {
      const mrn = b.patientMRN || b.patientMrn || b.patient_mrn || '-'
      const pName = b.patientName || b.patient_name || '-'
      const docName = b.doctorName || b.doctor_name || '-'
      const method = b.paymentMethod || b.payment_method || 'TUNAI'
      const subSvc = Number(b.subtotalServices ?? b.subtotal_services ?? 0)
      const subPharm = Number(b.subtotalPharmacy ?? b.subtotal_pharmacy ?? 0)
      const gt = Number(b.grandTotal ?? b.grand_total ?? 0)

      aoaData.push([
        idx + 1,
        b.billingNumber || b.billing_number || '-',
        fmtDate(b.visitDate || b.visit_date),
        mrn,
        pName,
        docName,
        payMethodMap[method] || method,
        subSvc,
        subPharm,
        gt,
        'Batal Periksa'
      ])
    })
  } else {
    aoaData.push(['-', '-', '-', '-', 'Tidak ada data pasien batal periksa pada periode ini', '-', '-', 0, 0, 0, '-'])
  }

  // Baris Total
  aoaData.push([
    '',
    '',
    '',
    '',
    `TOTAL (${totalCount} Pasien Batal Periksa)`,
    '',
    '',
    totalServices,
    totalPharmacy,
    totalGrand,
    ''
  ])

  // Footer & Pengesahan Formal
  aoaData.push(
    [],
    ['INFORMASI DOKUMEN & PENGESAHAN FORMAL:'],
    ['Status Dokumen', 'RESMI / TERINTEGRASI SISTEM AKUNTANSI KLINIK'],
    ['Catatan Akuntansi', 'Seluruh transaksi berstatus Batal Periksa telah dibalikkan jurnal piutang/pendapatannya (saldo bersih Rp 0).'],
    ['Waktu Cetak Sistem', `${nowFormatted} WIB`],
    [],
    ['Disiapkan Oleh,', '', '', '', '', '', '', 'Disetujui Oleh,'],
    [],
    [],
    ['( Petugas Kasir / Pendaftaran )', '', '', '', '', '', '', '( Kepala Klinik / Penanggung Jawab )'],
    [],
    [getFooterText(appSettings)]
  )

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(aoaData)
  autoWidthAOA(ws, aoaData)

  XLSX.utils.book_append_sheet(wb, ws, 'Pasien Batal Periksa')
  const safePeriod = (periodLabel || 'Semua_Periode').replace(/[\s/\\:*?"<>|]+/g, '_')
  XLSX.writeFile(wb, `Laporan_Pasien_Batal_Periksa_${safePeriod}.xlsx`)
}

// ─── Laporan Pengeluaran Obat Pasien Dibatalkan (Batal Periksa) Excel ───
export function exportCancelledMedicineOutflowExcel({
  cancelledOutflows = [],
  periodLabel = 'Semua Periode',
  branchName = '',
  appSettings = null
}) {
  const CLINIC = getClinicName(appSettings)
  const cAddr = appSettings?.address || ''
  const cPhone = appSettings?.phone ? (appSettings.phone.startsWith('Telp:') ? appSettings.phone : `Telp: ${appSettings.phone}`) : ''
  const contactLine = [cAddr, cPhone].filter(Boolean).join(' | ')
  const nowFormatted = getFormalTimestamp()

  const flatRows = []
  let totalQty = 0
  let totalHpp = 0
  let totalSelling = 0

  ;(cancelledOutflows || []).forEach(o => {
    const itemsList = Array.isArray(o.items) && o.items.length > 0 ? o.items : []
    if (itemsList.length === 0) {
      flatRows.push({
        outflowNumber: o.outflowNumber || o.outflow_number || '-',
        date: o.outflowDate || o.outflow_date || o.createdAt,
        billingNumber: o.prescriptionNo || o.billingNumber || '-',
        patientName: o.patientName || '-',
        patientMRN: o.patientMRN || o.patientMrn || o.patient_mrn || '-',
        doctorName: o.doctorName || '-',
        itemName: '(Tidak ada rincian item)',
        quantity: 0,
        unit: '-',
        unitCost: 0,
        totalCost: Number(o.totalValue || 0),
        sellingPrice: 0,
        subtotalSale: Number(o.totalSelling || 0),
        stockStatus: 'Stok Tetap Utuh (Tidak Keluar)'
      })
      totalHpp += Number(o.totalValue || 0)
      totalSelling += Number(o.totalSelling || 0)
    } else {
      itemsList.forEach(it => {
        const qty = Number(it.quantity || 0)
        const uCost = Number(it.unitCost ?? it.unit_cost ?? 0)
        const cost = Number(it.totalCost ?? it.total_cost ?? (qty * uCost))
        const uSale = Number(it.sellingPrice ?? it.selling_price ?? 0)
        const sale = Number(it.subtotalSale ?? it.subtotal_sale ?? (qty * uSale))
        totalQty += qty
        totalHpp += cost
        totalSelling += sale
        flatRows.push({
          outflowNumber: o.outflowNumber || o.outflow_number || '-',
          date: o.outflowDate || o.outflow_date || o.createdAt,
          billingNumber: o.prescriptionNo || o.billingNumber || '-',
          patientName: o.patientName || '-',
          patientMRN: o.patientMRN || o.patientMrn || o.patient_mrn || '-',
          doctorName: o.doctorName || '-',
          itemName: it.itemName || it.item_name || 'Obat',
          quantity: qty,
          unit: it.unit || 'Unit',
          unitCost: uCost,
          totalCost: cost,
          sellingPrice: uSale,
          subtotalSale: sale,
          stockStatus: 'Stok Tetap Utuh (Tidak Keluar)'
        })
      })
    }
  })

  const aoaData = [
    [CLINIC],
    ...(contactLine ? [[contactLine]] : []),
    [],
    ['LAPORAN PENGELUARAN OBAT PASIEN DIBATALKAN (BATAL PERIKSA DARI KASIR)'],
    [`Periode: ${periodLabel}`],
    ...(branchName ? [[`Cabang: ${branchName}`]] : []),
    [`Tanggal Cetak Otomatis: ${nowFormatted} WIB`],
    [],
    ['RINGKASAN & STATUS PERSEDIAAN'],
    ['Total Transaksi Resep Dibatalkan', `${(cancelledOutflows || []).length} resep/pasien`],
    ['Total Unit Obat Dibatalkan', `${totalQty} unit`],
    ['Total Estimasi Nilai HPP Dibatalkan (Rp)', totalHpp],
    ['Total Estimasi Nilai Jual Dibatalkan (Rp)', totalSelling],
    ['Status Stok Fisik Persediaan', 'AMAN — Obat tidak keluar dan tetap menjadi stok tersedia di apotek'],
    [],
    [
      'No.',
      'No. Pengeluaran',
      'Tanggal',
      'No. Billing',
      'No. RM',
      'Nama Pasien',
      'Dokter Pemeriksa',
      'Nama Obat / BHP',
      'Qty',
      'Satuan',
      'HPP/Unit (Rp)',
      'Total HPP (Rp)',
      'Harga Jual (Rp)',
      'Subtotal Jual (Rp)',
      'Status Stok'
    ]
  ]

  if (flatRows.length > 0) {
    flatRows.forEach((r, idx) => {
      aoaData.push([
        idx + 1,
        r.outflowNumber,
        fmtDate(r.date),
        r.billingNumber,
        r.patientMRN,
        r.patientName,
        r.doctorName,
        r.itemName,
        r.quantity,
        r.unit,
        r.unitCost,
        r.totalCost,
        r.sellingPrice,
        r.subtotalSale,
        r.stockStatus
      ])
    })
  } else {
    aoaData.push(['-', '-', '-', '-', '-', 'Tidak ada data pengeluaran obat pasien yang dibatalkan pada periode ini', '-', '-', 0, '-', 0, 0, 0, 0, '-'])
  }

  aoaData.push([
    '',
    '',
    '',
    '',
    '',
    `TOTAL (${(cancelledOutflows || []).length} Resep Dibatalkan)`,
    '',
    '',
    totalQty,
    '',
    '',
    totalHpp,
    '',
    totalSelling,
    'Stok Tetap Utuh'
  ])

  aoaData.push(
    [],
    ['INFORMASI DOKUMEN & PENGESAHAN FORMAL:'],
    ['Status Dokumen', 'RESMI / AUDIT TRAIL FARMASI & KASIR'],
    ['Konfirmasi Persediaan', 'Seluruh item obat yang tercantum di atas batal diserahkan ke pasien (Batal Periksa) dan dipastikan tetap utuh pada saldo persediaan apotek (tidak terpotong).'],
    ['Waktu Cetak Sistem', `${nowFormatted} WIB`],
    [],
    ['Disiapkan Oleh,', '', '', '', '', '', '', '', '', 'Disetujui Oleh,'],
    [],
    [],
    ['( Petugas Farmasi / Apoteker )', '', '', '', '', '', '', '', '', '( Kepala Klinik / Penanggung Jawab )'],
    [],
    [getFooterText(appSettings)]
  )

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(aoaData)
  autoWidthAOA(ws, aoaData)

  XLSX.utils.book_append_sheet(wb, ws, 'Obat Batal Periksa')
  const safePeriod = (periodLabel || 'Semua_Periode').replace(/[\s/\\:*?"<>|]+/g, '_')
  XLSX.writeFile(wb, `Laporan_Obat_Batal_Periksa_${safePeriod}.xlsx`)
}
