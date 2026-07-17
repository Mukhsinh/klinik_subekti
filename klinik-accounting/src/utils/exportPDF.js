import jsPDF from 'jspdf'
import 'jspdf-autotable'
import { fmtDate, fmtDateTime, fmtIDR } from './format'

const CLINIC_NAME  = 'Klinik Medis Antigravity'
const CLINIC_ADDR  = 'Jl. Sudirman No. 1, Jakarta Pusat'
const CLINIC_PHONE = '(021) 1234-5678'

function addHeader(doc, title, subtitle = '', branchName = '') {
  const pageW = doc.internal.pageSize.getWidth()
  // Logo placeholder box
  doc.setFillColor(4, 100, 199)
  doc.roundedRect(14, 12, 20, 20, 3, 3, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('K', 22, 25)
  // Clinic info
  doc.setTextColor(15, 23, 42)
  doc.setFontSize(13)
  doc.text(CLINIC_NAME, 40, 19)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(71, 85, 105)
  doc.text(CLINIC_ADDR, 40, 25)
  doc.text(CLINIC_PHONE, 40, 30)
  // Report title
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.5)
  doc.line(14, 36, pageW - 14, 36)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(4, 100, 199)
  doc.text(title, pageW / 2, 44, { align: 'center' })
  if (subtitle) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 116, 139)
    doc.text(subtitle, pageW / 2, 51, { align: 'center' })
  }
  if (branchName) {
    doc.setFontSize(8)
    doc.text(`Cabang: ${branchName}`, pageW / 2, 57, { align: 'center' })
  }
  return subtitle ? 62 : 50
}

function addFooter(doc) {
  const pageCount = doc.internal.getNumberOfPages()
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.3)
    doc.line(14, pageH - 14, pageW - 14, pageH - 14)
    doc.setFontSize(7)
    doc.setTextColor(148, 163, 184)
    doc.text(`Dicetak: ${fmtDateTime(new Date())}`, 14, pageH - 8)
    doc.text(`Halaman ${i} dari ${pageCount}`, pageW - 14, pageH - 8, { align: 'right' })
    doc.text('Dokumen ini digenerate secara otomatis oleh Sistem Akuntansi Klinik Medis Antigravity', pageW / 2, pageH - 8, { align: 'center' })
  }
}

// ─── Trial Balance PDF ────────────────────────────────────────
export function exportTrialBalancePDF(data, period, branchName) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const startY = addHeader(doc, 'NERACA SALDO (TRIAL BALANCE)', period, branchName)

  const body = data.map(r => [
    r.accountCode,
    r.accountName,
    r.finalDebit  > 0 ? fmtIDR(r.finalDebit)  : '',
    r.finalCredit > 0 ? fmtIDR(r.finalCredit) : '',
  ])
  const totD = data.reduce((s, r) => s + (r.finalDebit  || 0), 0)
  const totC = data.reduce((s, r) => s + (r.finalCredit || 0), 0)

  doc.autoTable({
    startY,
    head: [['Kode Akun', 'Nama Akun', 'Debit (Rp)', 'Kredit (Rp)']],
    body,
    foot: [['', 'TOTAL', fmtIDR(totD), fmtIDR(totC)]],
    styles: { font: 'courier', fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [4, 100, 199], textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 28, fontStyle: 'bold' },
      1: { cellWidth: 90 },
      2: { cellWidth: 36, halign: 'right' },
      3: { cellWidth: 36, halign: 'right' },
    },
  })
  addFooter(doc)
  doc.save(`NeracaSaldo_${period?.replace(/\s/g,'_') || 'export'}.pdf`)
}

// ─── General Ledger PDF ───────────────────────────────────────
export function exportLedgerPDF(accountName, entries, period) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const startY = addHeader(doc, `BUKU BESAR: ${accountName}`, period)

  const body = entries.map(r => [
    fmtDate(r.transactionDate),
    r.entryNumber,
    r.description,
    r.debit  > 0 ? fmtIDR(r.debit)  : '',
    r.credit > 0 ? fmtIDR(r.credit) : '',
    fmtIDR(r.runningBalance),
  ])

  doc.autoTable({
    startY,
    head: [['Tanggal', 'No. Jurnal', 'Keterangan', 'Debit', 'Kredit', 'Saldo']],
    body,
    styles: { font: 'courier', fontSize: 7.5, cellPadding: 1.5 },
    headStyles: { fillColor: [4, 100, 199], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 30 },
      2: { cellWidth: 90 },
      3: { cellWidth: 35, halign: 'right' },
      4: { cellWidth: 35, halign: 'right' },
      5: { cellWidth: 38, halign: 'right' },
    },
  })
  addFooter(doc)
  doc.save(`BukuBesar_${accountName}_${period || 'export'}.pdf`)
}

// ─── Income Statement PDF ─────────────────────────────────────
export function exportIncomeStatementPDF(data, period, branchName) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const startY = addHeader(doc, 'LAPORAN LABA RUGI', period, branchName)

  const body = data.map(r => [
    r.isGroup ? '' : r.accountCode,
    r.accountName,
    r.isGroup ? '' : fmtIDR(r.amount),
    r.isGroup ? fmtIDR(r.subtotal) : '',
  ])

  doc.autoTable({
    startY,
    head: [['Kode Akun', 'Keterangan', 'Jumlah (Rp)', 'Sub-Total (Rp)']],
    body,
    styles: { font: 'courier', fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [4, 100, 199], textColor: 255, fontStyle: 'bold' },
    didParseCell(hookData) {
      if (hookData.row.raw?.[0] === '' && hookData.row.raw?.[3] !== '') {
        hookData.cell.styles.fontStyle = 'bold'
        hookData.cell.styles.fillColor = [241, 245, 249]
      }
    },
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: 100 },
      2: { cellWidth: 40, halign: 'right' },
      3: { cellWidth: 40, halign: 'right' },
    },
  })
  addFooter(doc)
  doc.save(`LabaRugi_${period?.replace(/\s/g,'_') || 'export'}.pdf`)
}

// ─── Journal Entry PDF ────────────────────────────────────────
export function exportJournalPDF(entry, items, coa) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const startY = addHeader(doc, 'BUKTI JURNAL UMUM')

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(51, 65, 85)
  const info = [
    ['No. Jurnal', entry.entryNumber],
    ['Tanggal', fmtDate(entry.transactionDate)],
    ['Tipe', entry.entryType],
    ['Status', entry.status],
    ['Keterangan', entry.description],
  ]
  info.forEach(([k, v], i) => {
    doc.setFont('helvetica', 'bold')
    doc.text(k, 14, startY + i * 7)
    doc.setFont('helvetica', 'normal')
    doc.text(`: ${v}`, 60, startY + i * 7)
  })

  const tableY = startY + info.length * 7 + 6
  const body = items.map(it => {
    const acc = coa.find(c => c.accountCode === it.accountCode)
    return [
      it.accountCode,
      acc?.accountName || it.accountCode,
      it.description || '',
      it.debit  > 0 ? fmtIDR(it.debit)  : '',
      it.credit > 0 ? fmtIDR(it.credit) : '',
    ]
  })
  const totD = items.reduce((s, i) => s + (parseFloat(i.debit) || 0), 0)
  const totC = items.reduce((s, i) => s + (parseFloat(i.credit) || 0), 0)

  doc.autoTable({
    startY: tableY,
    head: [['Kode', 'Nama Akun', 'Keterangan', 'Debit (Rp)', 'Kredit (Rp)']],
    body,
    foot: [['', '', 'TOTAL', fmtIDR(totD), fmtIDR(totC)]],
    styles: { font: 'courier', fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [4, 100, 199], textColor: 255 },
    footStyles: { fillColor: [241, 245, 249], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 70 },
      2: { cellWidth: 58 },
      3: { cellWidth: 36, halign: 'right' },
      4: { cellWidth: 36, halign: 'right' },
    },
  })
  addFooter(doc)
  doc.save(`Jurnal_${entry.entryNumber}.pdf`)
}
