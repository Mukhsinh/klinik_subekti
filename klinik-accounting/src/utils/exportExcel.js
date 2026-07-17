import * as XLSX from 'xlsx'
import { fmtDate } from './format'

const CLINIC = 'Klinik Medis Antigravity'

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

// ─── Trial Balance Excel ──────────────────────────────────────
export function exportTrialBalanceExcel(data, period, branchName) {
  const rows = data.map(r => ({
    'Kode Akun':        r.accountCode,
    'Nama Akun':        r.accountName,
    'Tipe Akun':        r.accountType,
    'Natural Balance':  r.naturalBalance,
    'Total Debit':      Number(r.totalDebit  || 0),
    'Total Kredit':     Number(r.totalCredit || 0),
    'Saldo Debit':      Number(r.finalDebit  || 0),
    'Saldo Kredit':     Number(r.finalCredit || 0),
  }))

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)
  autoWidth(ws, rows)

  // Add SUM formula row
  const lastRow = rows.length + 1
  ws[`E${lastRow + 1}`] = { f: `SUM(E2:E${lastRow})`, t: 'n' }
  ws[`F${lastRow + 1}`] = { f: `SUM(F2:F${lastRow})`, t: 'n' }
  ws[`G${lastRow + 1}`] = { f: `SUM(G2:G${lastRow})`, t: 'n' }
  ws[`H${lastRow + 1}`] = { f: `SUM(H2:H${lastRow})`, t: 'n' }

  XLSX.utils.book_append_sheet(wb, ws, 'Neraca Saldo')

  // Meta sheet
  const meta = XLSX.utils.aoa_to_sheet([
    [CLINIC],
    ['Neraca Saldo (Trial Balance)'],
    [`Periode: ${period}`],
    [`Cabang: ${branchName}`],
    [`Dicetak: ${new Date().toLocaleString('id-ID')}`],
    ['Catatan: Nilai dalam Rupiah (IDR). Tidak ada sel yang digabung untuk menjaga kompatibilitas VLOOKUP/XLOOKUP.'],
  ])
  XLSX.utils.book_append_sheet(wb, meta, 'Info')

  XLSX.writeFile(wb, `NeracaSaldo_${period?.replace(/\s/g,'_') || 'export'}.xlsx`)
}

// ─── General Ledger Excel ─────────────────────────────────────
export function exportLedgerExcel(accountName, entries, period) {
  const rows = entries.map(r => ({
    'Tanggal':        fmtDate(r.transactionDate),
    'No. Jurnal':     r.entryNumber,
    'Keterangan':     r.description,
    'Debit':          Number(r.debit  || 0),
    'Kredit':         Number(r.credit || 0),
    'Saldo Berjalan': Number(r.runningBalance || 0),
    'Saldo D/K':      r.balanceSide || '',
  }))

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)
  autoWidth(ws, rows)
  XLSX.utils.book_append_sheet(wb, ws, accountName.substring(0, 31))
  XLSX.writeFile(wb, `BukuBesar_${accountName}_${period || 'export'}.xlsx`)
}

// ─── Income Statement Excel ───────────────────────────────────
export function exportIncomeStatementExcel(data, period, branchName) {
  const rows = data.map(r => ({
    'Kode Akun':   r.isGroup ? '' : r.accountCode,
    'Keterangan':  r.accountName,
    'Jumlah':      r.isGroup ? 0  : Number(r.amount || 0),
    'Sub-Total':   r.isGroup ? Number(r.subtotal || 0) : 0,
  }))

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)
  autoWidth(ws, rows)
  XLSX.utils.book_append_sheet(wb, ws, 'Laba Rugi')
  XLSX.writeFile(wb, `LabaRugi_${period?.replace(/\s/g,'_') || 'export'}.xlsx`)
}

// ─── Balance Sheet Excel ──────────────────────────────────────
export function exportBalanceSheetExcel(assets, liabEquity, period, branchName) {
  const maxLen = Math.max(assets.length, liabEquity.length)
  const rows = []
  for (let i = 0; i < maxLen; i++) {
    const a = assets[i]
    const l = liabEquity[i]
    rows.push({
      'Kode (Aset)':           a?.accountCode || '',
      'Keterangan (Aset)':     a?.accountName || '',
      'Nilai Aset':            a ? Number(a.balance || 0) : '',
      'Kode (Liabilitas/Ekuitas)': l?.accountCode || '',
      'Keterangan (Liabilitas/Ekuitas)': l?.accountName || '',
      'Nilai Liabilitas/Ekuitas':  l ? Number(l.balance || 0) : '',
    })
  }
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)
  autoWidth(ws, rows)
  XLSX.utils.book_append_sheet(wb, ws, 'Neraca')
  XLSX.writeFile(wb, `Neraca_${period?.replace(/\s/g,'_') || 'export'}.xlsx`)
}

// ─── Journal Entries Excel ─────────────────────────────────────
export function exportJournalExcel(entries, items, coa, period) {
  const coaMap = Object.fromEntries((coa || []).map(a => [a.accountCode, a.accountName]))
  const rows = []
  entries.forEach(e => {
    const eItems = items.filter(i => i.journalEntryId === e.id)
    eItems.forEach(it => {
      rows.push({
        'No. Jurnal':    e.entryNumber,
        'Tanggal':       fmtDate(e.transactionDate),
        'Tipe':          e.entryType,
        'Status':        e.status,
        'Keterangan':    e.description,
        'Kode Akun':     it.accountCode,
        'Nama Akun':     coaMap[it.accountCode] || it.accountCode,
        'Ket. Baris':    it.description || '',
        'Debit':         Number(it.debit  || 0),
        'Kredit':        Number(it.credit || 0),
      })
    })
  })
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)
  autoWidth(ws, rows)
  XLSX.utils.book_append_sheet(wb, ws, 'Jurnal Umum')
  XLSX.writeFile(wb, `JurnalUmum_${period || 'export'}.xlsx`)
}

// ─── Stock Report Excel ────────────────────────────────────────
export function exportStockExcel(items, batches) {
  const rows = items.map(item => {
    const activeBatches = batches.filter(b => b.itemId === item.id && b.quantityCurrent > 0)
    const totalStock = activeBatches.reduce((s, b) => s + b.quantityCurrent, 0)
    const avgCost = activeBatches.length
      ? activeBatches.reduce((s, b) => s + b.unitCostPrice * b.quantityCurrent, 0) / (totalStock || 1)
      : 0
    return {
      'SKU':             item.skuCode,
      'Nama Item':       item.itemName,
      'Kategori':        item.category,
      'Satuan':          item.baseUnit,
      'Stok Tersedia':   Number(totalStock),
      'Stok Minimum':    Number(item.minSafetyStock || 0),
      'Rata-rata HPP':   Number(avgCost.toFixed(2)),
      'Nilai Stok':      Number((totalStock * avgCost).toFixed(2)),
      'Status':          totalStock <= (item.minSafetyStock || 0) ? 'KRITIS' : 'AMAN',
    }
  })
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)
  autoWidth(ws, rows)
  XLSX.utils.book_append_sheet(wb, ws, 'Laporan Stok')
  XLSX.writeFile(wb, `LaporanStok_${new Date().toISOString().split('T')[0]}.xlsx`)
}
