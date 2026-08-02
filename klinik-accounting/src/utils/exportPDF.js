import jsPDF from 'jspdf'
import 'jspdf-autotable'
import { fmtDate, fmtDateTime, fmtIDR } from './format'

const CLINIC_NAME = 'Klinik Medis Antigravity'
const CLINIC_ADDR = 'Jl. Sudirman No. 1, Jakarta Pusat'
const CLINIC_PHONE = '(021) 1234-5678'

function addHeader(doc, title, subtitle = '', branchName = '', appSettings = null) {
  const pageW = doc.internal.pageSize.getWidth()
  const cName = appSettings?.companyName || appSettings?.appName || CLINIC_NAME
  const cAddr = appSettings?.address || CLINIC_ADDR
  const cPhone = appSettings?.phone ? (appSettings.phone.startsWith('Telp:') ? appSettings.phone : `Telp: ${appSettings.phone}`) : CLINIC_PHONE

  // Render Logo Image from appSettings if available, or default stylized badge
  if (appSettings?.logoUrl) {
    try {
      doc.addImage(appSettings.logoUrl, 'PNG', 14, 12, 20, 20)
    } catch (_) {
      doc.setFillColor(4, 100, 199)
      doc.roundedRect(14, 12, 20, 20, 3, 3, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text((cName.charAt(0) || 'K').toUpperCase(), 22, 25)
    }
  } else {
    doc.setFillColor(4, 100, 199)
    doc.roundedRect(14, 12, 20, 20, 3, 3, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text((cName.charAt(0) || 'K').toUpperCase(), 22, 25)
  }

  // Clinic info
  doc.setTextColor(15, 23, 42)
  doc.setFontSize(13)
  doc.text(cName, 40, 19)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(71, 85, 105)
  doc.text(cAddr, 40, 25)
  doc.text(cPhone, 40, 30)

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

function addFooter(doc, appSettings = null) {
  const pageCount = doc.internal.getNumberOfPages()
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const cName = appSettings?.companyName || appSettings?.appName || CLINIC_NAME
  const footerNote = appSettings?.footerText || `Dokumen ini digenerate secara otomatis oleh Sistem Akuntansi ${cName}`

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.3)
    doc.line(14, pageH - 14, pageW - 14, pageH - 14)
    doc.setFontSize(7)
    doc.setTextColor(148, 163, 184)
    doc.text(`Dicetak: ${fmtDateTime(new Date())}`, 14, pageH - 8)
    doc.text(`Halaman ${i} dari ${pageCount}`, pageW - 14, pageH - 8, { align: 'right' })
    doc.text(footerNote, pageW / 2, pageH - 8, { align: 'center' })
  }
}

// ─── Trial Balance PDF ────────────────────────────────────────
export function exportTrialBalancePDF(data, period, branchName, appSettings = null) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const startY = addHeader(doc, 'NERACA SALDO (TRIAL BALANCE)', period, branchName, appSettings)

  const body = data.map(r => [
    r.accountCode,
    r.accountName,
    r.finalDebit > 0 ? fmtIDR(r.finalDebit) : '',
    r.finalCredit > 0 ? fmtIDR(r.finalCredit) : '',
  ])
  const totD = data.reduce((s, r) => s + (r.finalDebit || 0), 0)
  const totC = data.reduce((s, r) => s + (r.finalCredit || 0), 0)

  doc.autoTable({
    startY,
    head: [['Kode Akun', 'Nama Akun', 'Debit (Rp)', 'Kredit (Rp)']],
    body,
    foot: [['', 'TOTAL', fmtIDR(totD), fmtIDR(totC)]],
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [4, 100, 199], textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 28, fontStyle: 'bold' },
      1: { cellWidth: 90 },
      2: { cellWidth: 36, halign: 'right' },
      3: { cellWidth: 36, halign: 'right' },
    },
  })
  addFooter(doc, appSettings)
  doc.save(`NeracaSaldo_${period?.replace(/\s/g, '_') || 'export'}.pdf`)
}

// ─── General Ledger PDF ───────────────────────────────────────
export function exportLedgerPDF(accountName, entries, period, appSettings = null) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const startY = addHeader(doc, `BUKU BESAR: ${accountName}`, period, '', appSettings)

  const body = entries.map(r => [
    fmtDate(r.transactionDate),
    r.entryNumber,
    r.description,
    r.debit > 0 ? fmtIDR(r.debit) : '',
    r.credit > 0 ? fmtIDR(r.credit) : '',
    fmtIDR(r.runningBalance),
  ])

  doc.autoTable({
    startY,
    head: [['Tanggal', 'No. Jurnal', 'Keterangan', 'Debit', 'Kredit', 'Saldo']],
    body,
    styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 1.5 },
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
  addFooter(doc, appSettings)
  doc.save(`BukuBesar_${accountName}_${period || 'export'}.pdf`)
}

// ─── Income Statement PDF ─────────────────────────────────────
export function exportIncomeStatementPDF(data, period, branchName, appSettings = null) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const startY = addHeader(doc, 'LAPORAN LABA RUGI', period, branchName, appSettings)

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
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2 },
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
  addFooter(doc, appSettings)
  doc.save(`LabaRugi_${period?.replace(/\s/g, '_') || 'export'}.pdf`)
}

// ─── Journal Entry PDF ────────────────────────────────────────
export function exportJournalPDF(entry, items, coa, appSettings = null) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const startY = addHeader(doc, 'BUKTI JURNAL UMUM', '', '', appSettings)

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
      it.debit > 0 ? fmtIDR(it.debit) : '',
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
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [4, 100, 199], textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [241, 245, 249], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 24, fontStyle: 'bold' },
      1: { cellWidth: 70 },
      2: { cellWidth: 58 },
      3: { cellWidth: 36, halign: 'right', fontStyle: 'bold' },
      4: { cellWidth: 36, halign: 'right', fontStyle: 'bold' },
    },
  })
  addFooter(doc, appSettings)
  doc.save(`Jurnal_${entry.entryNumber}.pdf`)
}

// ─── Billing / Receipt PDF (Nota Transaksi Kasir) ──────────────
export function exportBillingReceiptPDF(billing, items = [], appSettings = null) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const startY = addHeader(doc, 'NOTA TRANSAKSI / BUKTI PEMBAYARAN', `No. Nota: ${billing.billingNumber || '—'}`, billing.branchName || '', appSettings)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(30, 41, 59)

  // Patient & Transaction Metadata Box
  doc.setFillColor(248, 250, 252)
  doc.roundedRect(14, startY, 182, 32, 2, 2, 'F')
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(14, startY, 182, 32, 2, 2, 'S')

  const col1X = 18
  const col2X = 105
  let y = startY + 6

  // Left Column
  doc.setFont('helvetica', 'bold')
  doc.text('Nama Pasien', col1X, y)
  doc.setFont('helvetica', 'normal')
  doc.text(`: ${billing.patientName || '—'}`, col1X + 28, y)

  doc.setFont('helvetica', 'bold')
  doc.text('No. RM', col1X, y + 6)
  doc.setFont('helvetica', 'normal')
  doc.text(`: ${billing.patientMRN || '—'}`, col1X + 28, y + 6)

  doc.setFont('helvetica', 'bold')
  doc.text('Dokter', col1X, y + 12)
  doc.setFont('helvetica', 'normal')
  doc.text(`: ${billing.doctorName || '—'}`, col1X + 28, y + 12)

  doc.setFont('helvetica', 'bold')
  doc.text('Tanggal Visit', col1X, y + 18)
  doc.setFont('helvetica', 'normal')
  doc.text(`: ${fmtDate(billing.visitDate)}`, col1X + 28, y + 18)

  // Right Column
  doc.setFont('helvetica', 'bold')
  doc.text('No. Billing', col2X, y)
  doc.setFont('helvetica', 'normal')
  doc.text(`: ${billing.billingNumber || '—'}`, col2X + 28, y)

  doc.setFont('helvetica', 'bold')
  doc.text('Metode Bayar', col2X, y + 6)
  doc.setFont('helvetica', 'normal')
  doc.text(`: ${billing.paymentMethod || 'TUNAI'}`, col2X + 28, y + 6)

  doc.setFont('helvetica', 'bold')
  doc.text('Status', col2X, y + 12)
  doc.setFont('helvetica', 'normal')
  doc.text(`: ${billing.status || 'PAID'}`, col2X + 28, y + 12)

  if (billing.bpjsClaimNumber) {
    doc.setFont('helvetica', 'bold')
    doc.text('No. Klaim', col2X, y + 18)
    doc.setFont('helvetica', 'normal')
    doc.text(`: ${billing.bpjsClaimNumber}`, col2X + 28, y + 18)
  }

  // Items Table
  const tableY = startY + 38
  const body = items.map((it, idx) => [
    idx + 1,
    it.itemName || '—',
    it.itemType === 'SERVICE' ? 'Jasa Medis' : it.itemType === 'LAB' ? 'Laboratorium' : 'Farmasi',
    it.quantity || 1,
    fmtIDR(it.unitPrice || 0),
    fmtIDR(it.totalPrice || (it.quantity || 1) * (it.unitPrice || 0)),
  ])

  doc.autoTable({
    startY: tableY,
    head: [['No', 'Nama Item / Layanan', 'Tipe', 'Qty', 'Harga Satuan', 'Total (Rp)']],
    body,
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2.5 },
    headStyles: { fillColor: [4, 100, 199], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 78 },
      2: { cellWidth: 32 },
      3: { cellWidth: 15, halign: 'right' },
      4: { cellWidth: 25, halign: 'right' },
      5: { cellWidth: 20, halign: 'right' },
    },
  })

  // Summary Box below table
  const finalY = doc.lastAutoTable.finalY + 6
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')

  const summaryRightX = 196
  let sumY = finalY

  if (billing.subtotalServices > 0) {
    doc.text('Subtotal Layanan/Lab:', 125, sumY)
    doc.text(fmtIDR(billing.subtotalServices), summaryRightX, sumY, { align: 'right' })
    sumY += 5
  }
  if (billing.subtotalPharmacy > 0) {
    doc.text('Subtotal Obat/Farmasi:', 125, sumY)
    doc.text(fmtIDR(billing.subtotalPharmacy), summaryRightX, sumY, { align: 'right' })
    sumY += 5
  }
  if (billing.ppnAmount > 0) {
    doc.text('PPN (11%):', 125, sumY)
    doc.text(fmtIDR(billing.ppnAmount), summaryRightX, sumY, { align: 'right' })
    sumY += 5
  }
  if (billing.discountAmount > 0) {
    doc.text('Diskon:', 125, sumY)
    doc.text(`-${fmtIDR(billing.discountAmount)}`, summaryRightX, sumY, { align: 'right' })
    sumY += 5
  }

  doc.setDrawColor(4, 100, 199)
  doc.setLineWidth(0.5)
  doc.line(125, sumY, 196, sumY)
  sumY += 5

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(4, 100, 199)
  doc.text('GRAND TOTAL:', 125, sumY)
  doc.text(fmtIDR(billing.grandTotal || 0), summaryRightX, sumY, { align: 'right' })

  // Signature lines
  const sigY = Math.max(sumY + 20, finalY + 30)
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(71, 85, 105)

  doc.text('Pasien / Keluarga', 35, sigY, { align: 'center' })
  doc.text('( ____________________ )', 35, sigY + 18, { align: 'center' })

  doc.text('Petugas Kasir', 160, sigY, { align: 'center' })
  doc.text(`( ${billing.createdBy || 'Kasir Klinik'} )`, 160, sigY + 18, { align: 'center' })

  addFooter(doc, appSettings)
  doc.save(`Nota_Billing_${billing.billingNumber || 'Receipt'}.pdf`)
}

// ─── Statement of Changes in Equity (Laporan Perubahan Ekuitas) PDF ───
export function exportEquityChangesPDF(data, period, branchName, appSettings = null) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const startY = addHeader(doc, 'LAPORAN PERUBAHAN EKUITAS', period, branchName, appSettings)

  const body = data.map(r => [
    r.isHeader || r.isTotal ? '' : (r.accountCode || ''),
    r.description || r.accountName,
    r.amount === '' || r.amount === undefined ? '' : fmtIDR(r.amount)
  ])

  doc.autoTable({
    startY,
    head: [['Kode Akun', 'Keterangan', 'Jumlah (Rp)']],
    body,
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [4, 100, 199], textColor: 255, fontStyle: 'bold' },
    didParseCell(hookData) {
      if (hookData.row.raw?.[0] === '' && hookData.row.raw?.[2] !== '') {
        hookData.cell.styles.fontStyle = 'bold'
        hookData.cell.styles.fillColor = [241, 245, 249]
      }
    },
    columnStyles: {
      0: { cellWidth: 35 },
      1: { cellWidth: 110 },
      2: { cellWidth: 40, halign: 'right' },
    },
  })
  addFooter(doc, appSettings)
  doc.save(`Perubahan_Ekuitas_${period?.replace(/\s/g, '_') || 'export'}.pdf`)
}

// ─── Balance Sheet (Neraca) PDF ───────────────────────────────
export function exportBalanceSheetPDF(assets, liabEquity, period, branchName, appSettings = null) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const startY = addHeader(doc, 'NERACA (BALANCE SHEET)', period, branchName, appSettings)

  const body = []
  body.push(['', 'ASET (ASSETS)', ''])
  assets.forEach(a => {
    if (a.balance !== 0) {
      body.push([a.accountCode || '', a.accountName || '', fmtIDR(a.balance || 0)])
    }
  })
  const totalAssets = assets.reduce((s, a) => s + (a.balance || 0), 0)
  body.push(['', 'TOTAL ASET', fmtIDR(totalAssets)])

  body.push(['', '', ''])
  body.push(['', 'LIABILITAS & EKUITAS (LIABILITIES & EQUITY)', ''])
  liabEquity.forEach(l => {
    if (l.balance !== 0) {
      body.push([l.accountCode || '', l.accountName || '', fmtIDR(l.balance || 0)])
    }
  })
  const totalLiabEq = liabEquity.reduce((s, l) => s + (l.balance || 0), 0)
  body.push(['', 'TOTAL LIABILITAS & EKUITAS', fmtIDR(totalLiabEq)])

  doc.autoTable({
    startY,
    head: [['Kode Akun', 'Keterangan', 'Saldo (Rp)']],
    body,
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [4, 100, 199], textColor: 255, fontStyle: 'bold' },
    didParseCell(hookData) {
      const isHeaderRow = hookData.row.raw?.[0] === '' && hookData.row.raw?.[2] === '' && hookData.row.raw?.[1] !== ''
      const isTotalRow = hookData.row.raw?.[0] === '' && hookData.row.raw?.[1]?.startsWith('TOTAL')
      if (isHeaderRow) {
        hookData.cell.styles.fontStyle = 'bold'
        hookData.cell.styles.fillColor = [226, 232, 240]
        hookData.cell.styles.textColor = [15, 23, 42]
      }
      if (isTotalRow) {
        hookData.cell.styles.fontStyle = 'bold'
        hookData.cell.styles.fillColor = [241, 245, 249]
        hookData.cell.styles.textColor = [4, 100, 199]
      }
    },
    columnStyles: {
      0: { cellWidth: 35 },
      1: { cellWidth: 110 },
      2: { cellWidth: 40, halign: 'right' },
    },
  })
  addFooter(doc, appSettings)
  doc.save(`Neraca_${period?.replace(/\s/g, '_') || 'export'}.pdf`)
}

// ─── Signature Block Helper ────────────────────────────────────
function addSignatureBlock(doc, startY, city = 'Jakarta', dateStr = fmtDate(new Date())) {
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()

  let y = startY + 12
  if (y + 40 > pageH - 18) {
    doc.addPage()
    y = 20
  }

  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(51, 65, 85)

  doc.text(`${city}, ${dateStr}`, pageW - 20, y, { align: 'right' })

  const col1X = 35
  const col2X = pageW / 2
  const col3X = pageW - 35
  const sigY = y + 7

  doc.text('Pembuat Laporan,', col1X, sigY, { align: 'center' })
  doc.text('Staf Akuntansi & Pajak', col1X, sigY + 4, { align: 'center' })

  doc.text('Diperiksa Oleh,', col2X, sigY, { align: 'center' })
  doc.text('Manager Keuangan', col2X, sigY + 4, { align: 'center' })

  doc.text('Disetujui Oleh,', col3X, sigY, { align: 'center' })
  doc.text('Pimpinan Klinik', col3X, sigY + 4, { align: 'center' })

  const nameY = sigY + 22
  doc.text('( ____________________ )', col1X, nameY, { align: 'center' })
  doc.text('( ____________________ )', col2X, nameY, { align: 'center' })
  doc.text('( ____________________ )', col3X, nameY, { align: 'center' })

  return nameY + 8
}

// ─── PPN Tax Report PDF ────────────────────────────────────────
export function exportPPNReportPDF({ periodBillings, periodExpenses, dppFarmasi, ppnKeluaran, ppnMasukan, ppnTerutang, periodLabel, branchName, appSettings = null }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  let startY = addHeader(doc, 'LAPORAN PAJAK PERTAMBAHAN NILAI (PPN)', `Periode: ${periodLabel}`, branchName, appSettings)

  // Summary Box
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(203, 213, 225)
  doc.roundedRect(14, startY + 2, 182, 22, 2, 2, 'FD')

  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 41, 59)
  doc.text('RINGKASAN REKAPITULASI PPN', 18, startY + 7)

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text(`DPP Penjualan Obat: ${fmtIDR(dppFarmasi)}`, 18, startY + 13)
  doc.text(`PPN Keluaran (11%): ${fmtIDR(ppnKeluaran)}`, 18, startY + 18)

  doc.text(`PPN Masukan (Pembelian): ${fmtIDR(ppnMasukan)}`, 100, startY + 13)
  const statusPPN = ppnTerutang >= 0 ? 'PPN Kurang Bayar (Wajib Setor)' : 'PPN Lebih Bayar (Dikreditkan)'
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(ppnTerutang >= 0 ? 220 : 13, ppnTerutang >= 0 ? 38 : 148, ppnTerutang >= 0 ? 38 : 136)
  doc.text(`${statusPPN}: ${fmtIDR(Math.abs(ppnTerutang))}`, 100, startY + 18)

  startY += 28

  // Table PPN Keluaran
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 23, 42)
  doc.text('1. PPN Keluaran — Penjualan Obat (Billing Kasir)', 14, startY)

  const kelRows = (periodBillings || [])
    .filter(b => (b.ppnAmount || 0) > 0)
    .map(b => [
      b.billingNumber,
      fmtDate(b.visitDate),
      b.patientName || '—',
      fmtIDR(b.subtotalPharmacy || 0),
      fmtIDR(b.ppnAmount || 0)
    ])

  doc.autoTable({
    startY: startY + 3,
    head: [['No. Billing', 'Tanggal', 'Nama Pasien', 'DPP Farmasi (Rp)', 'PPN 11% (Rp)']],
    body: kelRows.length > 0 ? kelRows : [['—', '—', 'Belum ada transaksi PPN Keluaran', '0', '0']],
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [5, 150, 105], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 32 },
      1: { cellWidth: 25 },
      2: { cellWidth: 55 },
      3: { cellWidth: 35, halign: 'right' },
      4: { cellWidth: 35, halign: 'right' },
    },
    foot: [['', '', 'TOTAL PPN KELUARAN', fmtIDR(dppFarmasi), fmtIDR(ppnKeluaran)]],
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', halign: 'right' }
  })

  let tableEndY = doc.lastAutoTable.finalY + 8

  // Table PPN Masukan
  if (tableEndY + 40 > doc.internal.pageSize.getHeight() - 20) {
    doc.addPage()
    tableEndY = 20
  }

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 23, 42)
  doc.text('2. PPN Masukan — Pembelian & Pengeluaran', 14, tableEndY)

  const masRows = (periodExpenses || [])
    .filter(e => (e.ppnAmount || 0) > 0)
    .map(e => [
      e.expenseNumber,
      fmtDate(e.expenseDate),
      e.vendorName || '—',
      e.description || '—',
      fmtIDR(e.grossAmount || 0),
      fmtIDR(e.ppnAmount || 0)
    ])

  const totalDPPExpense = (periodExpenses || []).reduce((s, e) => s + (e.grossAmount || 0), 0)

  doc.autoTable({
    startY: tableEndY + 3,
    head: [['No. Pengeluaran', 'Tanggal', 'Vendor', 'Keterangan', 'DPP (Rp)', 'PPN Masukan (Rp)']],
    body: masRows.length > 0 ? masRows : [['—', '—', '—', 'Belum ada faktur PPN masukan', '0', '0']],
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: 22 },
      2: { cellWidth: 35 },
      3: { cellWidth: 40 },
      4: { cellWidth: 28, halign: 'right' },
      5: { cellWidth: 27, halign: 'right' },
    },
    foot: [['', '', '', 'TOTAL PPN MASUKAN', fmtIDR(totalDPPExpense), fmtIDR(ppnMasukan)]],
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', halign: 'right' }
  })

  const finalY = doc.lastAutoTable.finalY
  addSignatureBlock(doc, finalY)
  addFooter(doc, appSettings)
  doc.save(`Laporan_PPN_${periodLabel.replace(/\s+/g, '_')}.pdf`)
}

// ─── PPh 21 Tax Report PDF ─────────────────────────────────────
export function exportPPh21ReportPDF({ pph21Transactions, totalGross, totalDPP, totalPPh21, totalNet, periodLabel, branchName, doctorNameFilter = 'Semua Dokter', appSettings = null }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const subtitle = `Periode: ${periodLabel} | Dokter: ${doctorNameFilter}`
  let startY = addHeader(doc, 'LAPORAN PPH PASAL 21 JASA MEDIS DOKTER', subtitle, branchName, appSettings)

  const pageW = doc.internal.pageSize.getWidth()

  // Summary Box
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(203, 213, 225)
  doc.roundedRect(14, startY + 2, pageW - 28, 16, 2, 2, 'FD')

  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'bold')

  const colW = (pageW - 28) / 4
  doc.setTextColor(30, 41, 59)
  doc.text(`Total Jasa Medis Bruto: ${fmtIDR(totalGross)}`, 18, startY + 11)
  doc.text(`Total DPP (50%): ${fmtIDR(totalDPP)}`, 18 + colW, startY + 11)
  doc.setTextColor(220, 38, 38)
  doc.text(`Total PPh 21 Dipotong: ${fmtIDR(totalPPh21)}`, 18 + colW * 2, startY + 11)
  doc.setTextColor(5, 150, 105)
  doc.text(`Total Neto ke Dokter: ${fmtIDR(totalNet)}`, 18 + colW * 3, startY + 11)

  startY += 22

  // Table Transactions
  const rows = (pph21Transactions || []).map(d => [
    d.billingNumber,
    fmtDate(d.visitDate),
    d.doctorName,
    d.patientName,
    d.patientMRN,
    fmtIDR(d.grossAmount),
    fmtIDR(d.dpp),
    `${(d.rate * 100).toFixed(0)}%`,
    fmtIDR(d.pph21Amount),
    fmtIDR(d.netToDoctor)
  ])

  doc.autoTable({
    startY,
    head: [['No. Billing', 'Tanggal', 'Nama Dokter', 'Nama Pasien', 'No. RM', 'Bruto (Rp)', 'DPP 50% (Rp)', 'Tarif', 'PPh 21 (Rp)', 'Neto Dokter (Rp)']],
    body: rows.length > 0 ? rows : [['—', '—', '—', 'Tidak ada data transaksi PPh 21 pada periode ini', '—', '0', '0', '0%', '0', '0']],
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [220, 38, 38], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 32 },
      1: { cellWidth: 22 },
      2: { cellWidth: 45 },
      3: { cellWidth: 40 },
      4: { cellWidth: 22 },
      5: { cellWidth: 28, halign: 'right' },
      6: { cellWidth: 25, halign: 'right' },
      7: { cellWidth: 15, halign: 'center' },
      8: { cellWidth: 25, halign: 'right' },
      9: { cellWidth: 28, halign: 'right' },
    },
    foot: [['', '', '', 'TOTAL', '', fmtIDR(totalGross), fmtIDR(totalDPP), '', fmtIDR(totalPPh21), fmtIDR(totalNet)]],
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', halign: 'right' }
  })

  const finalY = doc.lastAutoTable.finalY
  addSignatureBlock(doc, finalY)
  addFooter(doc, appSettings)
  doc.save(`Laporan_PPh21_Dokter_${periodLabel.replace(/\s+/g, '_')}.pdf`)
}

// ─── Accounts Payable Subsidiary Ledger PDF Report ───────────────
export function exportAPLedgerReportPDF({
  summaryData = {},
  vendorSummaryList = [],
  detailTransactions = [],
  vendorFilter = 'Semua Vendor',
  periodLabel = 'Semua Periode',
  branchName = 'Utama',
  appSettings = null,
}) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const subtitle = `Periode: ${periodLabel} | Filter Vendor: ${vendorFilter}`
  let startY = addHeader(doc, 'LAPORAN BUKU PEMBANTU UTANG (ACCOUNTS PAYABLE)', subtitle, branchName, appSettings)

  const pageW = doc.internal.pageSize.getWidth()

  // KPI Summary Box
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(203, 213, 225)
  doc.roundedRect(14, startY + 2, pageW - 28, 16, 2, 2, 'FD')

  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'bold')

  const colW = (pageW - 28) / 4
  doc.setTextColor(220, 38, 38)
  doc.text(`Total Utang Usaha: ${fmtIDR(summaryData.totalDebt || 0)}`, 18, startY + 11)
  doc.setTextColor(217, 119, 6)
  doc.text(`Sisa Belum Lunas: ${fmtIDR(summaryData.unpaidDebt || 0)}`, 18 + colW, startY + 11)
  doc.setTextColor(5, 150, 105)
  doc.text(`Total Pelunasan: ${fmtIDR(summaryData.paidDebt || 0)}`, 18 + colW * 2, startY + 11)
  doc.setTextColor(37, 99, 235)
  doc.text(`Vendor Aktif: ${summaryData.activeVendorsCount || 0} Supplier`, 18 + colW * 3, startY + 11)

  startY += 22

  // Table 1: Rekapitulasi Per Vendor
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 23, 42)
  doc.text('1. Rekapitulasi Utang Per Vendor / Supplier', 14, startY)

  const rekapRows = (vendorSummaryList || []).map((v, i) => [
    (i + 1).toString(),
    v.code || '—',
    v.name,
    fmtIDR(v.totalGRN),
    fmtIDR(v.totalPaid),
    fmtIDR(v.unpaid),
    v.unpaid > 0 ? 'Belum Lunas' : 'Lunas'
  ])

  doc.autoTable({
    startY: startY + 3,
    head: [['No', 'Kode Vendor', 'Nama Vendor / Supplier', 'Total Pembelian (GRN)', 'Total Pelunasan', 'Sisa Utang (Rp)', 'Status']],
    body: rekapRows.length > 0 ? rekapRows : [['—', '—', 'Tidak ada data vendor', '0', '0', '0', '—']],
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 28 },
      2: { cellWidth: 75 },
      3: { cellWidth: 40, halign: 'right' },
      4: { cellWidth: 40, halign: 'right' },
      5: { cellWidth: 40, halign: 'right' },
      6: { cellWidth: 25, halign: 'center' },
    },
    foot: [['', '', 'TOTAL REKAPITULASI UTANG', fmtIDR(summaryData.totalDebt || 0), fmtIDR(summaryData.paidDebt || 0), fmtIDR(summaryData.unpaidDebt || 0), '']],
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', halign: 'right' }
  })

  let table2StartY = doc.lastAutoTable.finalY + 8

  if (table2StartY + 40 > doc.internal.pageSize.getHeight() - 20) {
    doc.addPage()
    table2StartY = 20
  }

  // Table 2: Detail Transaksi Ledger
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 23, 42)
  doc.text('2. Detail Rincian Buku Pembantu Utang (Ledger Transaksi)', 14, table2StartY)

  const detailRows = (detailTransactions || []).map(t => [
    fmtDate(t.date),
    t.refNo,
    t.invoiceNo || '—',
    t.vendorName,
    t.description || '—',
    fmtIDR(t.debit),
    fmtIDR(t.credit),
    fmtIDR(t.balance)
  ])

  doc.autoTable({
    startY: table2StartY + 3,
    head: [['Tanggal', 'No. Referensi', 'No. Faktur', 'Vendor', 'Keterangan', 'Debet / Pelunasan', 'Kredit / Penambahan', 'Saldo Utang (Rp)']],
    body: detailRows.length > 0 ? detailRows : [['—', '—', '—', '—', 'Tidak ada transaksi pada periode ini', '0', '0', '0']],
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [220, 38, 38], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 32 },
      2: { cellWidth: 28 },
      3: { cellWidth: 45 },
      4: { cellWidth: 55 },
      5: { cellWidth: 28, halign: 'right' },
      6: { cellWidth: 28, halign: 'right' },
      7: { cellWidth: 30, halign: 'right' },
    },
  })

  const finalY = doc.lastAutoTable.finalY
  addSignatureBlock(doc, finalY)
  addFooter(doc, appSettings)
  doc.save(`Laporan_Buku_Pembantu_Utang_${periodLabel.replace(/\s+/g, '_')}.pdf`)
}



