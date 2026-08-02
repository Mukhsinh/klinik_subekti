import * as XLSX from 'xlsx'
import { fmtDate, fmtDateTime } from './format'

const DEFAULT_CLINIC = 'KLINIK UTAMA MEDIS ANTIGRAVITY'
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
export function exportStockExcel(items, batches, recapData, appSettings = null) {
  const CLINIC = getClinicName(appSettings)
  const nowFormatted = getFormalTimestamp()

  const aoaData = [
    [CLINIC],
    ['LAPORAN REKAPITULASI STOCK LEDGER & MUTASI PERSEDIAAN'],
    ['Standard Akuntansi Persediaan Rumah Sakit & Klinik (PSAK 14) | Metode FEFO (First Expiry First Out) & FIFO (First In First Out)'],
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
  XLSX.writeFile(wb, `LaporanRekapStockLedger_${new Date().toISOString().split('T')[0]}.xlsx`)
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

  let sumPenerimaan = 0
  let sumPengeluaran = 0
  let lastBalance = 0

  if (Array.isArray(ledgerLines) && ledgerLines.length > 0) {
    ledgerLines.forEach((l, idx) => {
      const qtyIn = Number(l.penerimaan || l.quantityIn || 0)
      const qtyOut = Number(l.pengeluaran || l.quantityOut || 0)
      const sAkhir = Number(l.saldoAkhir !== undefined ? l.saldoAkhir : l.balanceAfter || 0)
      const unitCost = Number(l.unitCost || 0)
      const totalVal = Number(l.totalValue || (unitCost * (qtyIn || qtyOut)))

      sumPenerimaan += qtyIn
      sumPengeluaran += qtyOut
      lastBalance = sAkhir

      aoaData.push([
        idx + 1,
        fmtDateTime(l.loggedAt || l.transactionDate),
        l.transactionType,
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
    aoaData.push([
      1,
      nowFormatted,
      'INFO_STOK',
      'SALDO_SAAT_INI',
      Number(item?.saldoAwal || 0),
      0,
      0,
      Number(item?.saldoAkhir || 0),
      Number(item?.purchasePrice || item?.hpp || 0),
      Number(item?.totalValue || 0),
      'FEFO / FIFO'
    ])
  }

  // Summary Row
  aoaData.push([
    '',
    '',
    'TOTAL MUTASI ITEM',
    '',
    '',
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

