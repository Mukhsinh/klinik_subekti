import jsPDF from 'jspdf'
import 'jspdf-autotable'
import { fmtDate, fmtDateTime, fmtIDR } from './format'
import { resolveBillingItemCategory } from './billingCategory'

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

function addSignatureBlock(doc, finalY, leftTitle = 'Disiapkan Oleh,', rightTitle = 'Disetujui Oleh,', leftName = 'Petugas Keuangan', rightName = 'Pimpinan / Penanggung Jawab') {
  const pageH = doc.internal.pageSize.getHeight()
  const pageW = doc.internal.pageSize.getWidth()
  let y = finalY + 12
  if (y > pageH - 42) {
    doc.addPage()
    y = 25
  }
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(30, 41, 59)

  // Left
  doc.text(leftTitle, 20, y)
  doc.text('( .................................... )', 20, y + 20)
  doc.text(leftName, 20, y + 25)

  // Right
  doc.text(rightTitle, pageW - 75, y)
  doc.text('( .................................... )', pageW - 75, y + 20)
  doc.text(rightName, pageW - 75, y + 25)
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

// ─── Billing / Receipt PDF (Nota Transaksi Kasir — Setengah Kertas A4 / A5) ───
export function exportBillingReceiptPDF(billing, items = [], appSettings = null, options = {}) {
  // A5 Landscape is 210mm x 148mm (exactly half of A4 210mm x 297mm)
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a5' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()

  const cName = appSettings?.companyName || appSettings?.appName || CLINIC_NAME
  const cAddr = appSettings?.address || CLINIC_ADDR
  const cPhone = appSettings?.phone ? (appSettings.phone.startsWith('Telp:') ? appSettings.phone : `Telp: ${appSettings.phone}`) : CLINIC_PHONE

  // 1. KOP SURAT
  if (appSettings?.logoUrl) {
    try {
      doc.addImage(appSettings.logoUrl, 'PNG', 12, 8, 14, 14)
    } catch (_) {
      doc.setFillColor(4, 100, 199)
      doc.roundedRect(12, 8, 14, 14, 2, 2, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text((cName.charAt(0) || 'K').toUpperCase(), 17, 18)
    }
  } else {
    doc.setFillColor(4, 100, 199)
    doc.roundedRect(12, 8, 14, 14, 2, 2, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text((cName.charAt(0) || 'K').toUpperCase(), 17, 18)
  }

  doc.setTextColor(15, 23, 42)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text(cName.toUpperCase(), 30, 13)

  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(71, 85, 105)
  doc.text(`${cAddr} | ${cPhone}`, 30, 18)
  doc.text('Izin Operasional Klinik / SIPA Terdaftar — Layanan Medis & Farmasi', 30, 22)

  // Title on right side
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(4, 100, 199)
  doc.text('BUKTI PEMBAYARAN / NOTA RAWAT JALAN', pageW - 12, 13, { align: 'right' })

  // Status Stamp (LUNAS / BELUM LUNAS)
  const isPaid = (billing.status || '').toUpperCase() === 'PAID'
  if (isPaid) {
    doc.setFillColor(220, 252, 231)
    doc.setDrawColor(22, 163, 74)
    doc.roundedRect(pageW - 48, 16, 36, 7, 1.5, 1.5, 'FD')
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(22, 163, 74)
    doc.text('✓ LUNAS', pageW - 30, 21, { align: 'center' })
  } else {
    doc.setFillColor(254, 242, 242)
    doc.setDrawColor(220, 38, 38)
    doc.roundedRect(pageW - 55, 16, 43, 7, 1.5, 1.5, 'FD')
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(220, 38, 38)
    doc.text('⚠ BELUM LUNAS', pageW - 33.5, 21, { align: 'center' })
  }

  // Double separator line
  doc.setDrawColor(4, 100, 199)
  doc.setLineWidth(0.6)
  doc.line(12, 25, pageW - 12, 25)
  doc.setDrawColor(203, 213, 225)
  doc.setLineWidth(0.2)
  doc.line(12, 26, pageW - 12, 26)

  // 2. METADATA SECTION (Compact 2 columns)
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(12, 28, pageW - 24, 17, 1.5, 1.5, 'FD')

  doc.setFontSize(7.5)
  doc.setTextColor(51, 65, 85)

  // Column 1
  doc.setFont('helvetica', 'bold')
  doc.text('No. Billing', 16, 33)
  doc.setFont('helvetica', 'normal')
  doc.text(`: ${billing.billingNumber || '—'}`, 36, 33)

  doc.setFont('helvetica', 'bold')
  doc.text('Nama Pasien', 16, 38)
  doc.setFont('helvetica', 'normal')
  doc.text(`: ${billing.patientName || '—'} (RM: ${billing.patientMRN || '—'})`, 36, 38)

  doc.setFont('helvetica', 'bold')
  doc.text('Tanggal Visit', 16, 43)
  doc.setFont('helvetica', 'normal')
  doc.text(`: ${fmtDate(billing.visitDate)}`, 36, 43)

  // Column 2
  doc.setFont('helvetica', 'bold')
  doc.text('Dokter Pemeriksa', 115, 33)
  doc.setFont('helvetica', 'normal')
  doc.text(`: ${billing.doctorName || '—'}`, 145, 33)

  doc.setFont('helvetica', 'bold')
  doc.text('Metode Pembayaran', 115, 38)
  doc.setFont('helvetica', 'normal')
  doc.text(`: ${billing.paymentMethod || 'TUNAI'}`, 145, 38)

  doc.setFont('helvetica', 'bold')
  doc.text('Penjamin / Klaim', 115, 43)
  doc.setFont('helvetica', 'normal')
  doc.text(`: ${billing.bpjsClaimNumber || (billing.paymentMethod === 'BPJS' ? 'BPJS Kesehatan' : 'Umum / Mandiri')}`, 145, 43)

  // 3. ITEMS TABLE
  const body = (items || []).map((it, idx) => {
    const typeLabel = resolveBillingItemCategory(it, options?.serviceTariffs || [], options?.pharmacyItems || [])
    const q = Number(it.quantity || 1)
    const price = Number(it.unitPrice ?? it.unit_price ?? 0)
    const total = Number(it.totalPrice ?? it.total_price ?? (q * price))
    return [
      idx + 1,
      it.itemName || it.item_name || '—',
      typeLabel,
      q,
      fmtIDR(price),
      fmtIDR(total)
    ]
  })

  doc.autoTable({
    startY: 47,
    head: [['No', 'Uraian Layanan Medis / Tindakan / Obat', 'Kategori', 'Qty', 'Tarif / Harga (Rp)', 'Subtotal (Rp)']],
    body: body.length > 0 ? body : [['—', 'Tidak ada rincian item', '—', '—', '—', '—']],
    styles: { font: 'helvetica', fontSize: 7, cellPadding: 1.2 },
    headStyles: { fillColor: [4, 100, 199], textColor: 255, fontStyle: 'bold', halign: 'left' },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 86 },
      2: { cellWidth: 28 },
      3: { cellWidth: 14, halign: 'right' },
      4: { cellWidth: 24, halign: 'right' },
      5: { cellWidth: 24, halign: 'right' },
    },
    margin: { left: 12, right: 12 }
  })

  // 4. SUMMARY & SIGNATURES SECTION
  let finalY = doc.lastAutoTable.finalY + 3
  if (finalY + 32 > pageH) {
    doc.addPage()
    finalY = 15
  }

  const rightBoxX = 125
  const valX = pageW - 14
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(51, 65, 85)

  let sumY = finalY + 1
  const subDoctor = Number(billing.subtotalDoctorServices || billing.subtotal_doctor_services || (Number(billing.subtotalServices || billing.subtotal_services || 0) - Number(billing.subtotalLab || billing.subtotal_lab || 0)))
  const subLab = Number(billing.subtotalLab || billing.subtotal_lab || 0)
  const subPharm = Number(billing.subtotalPharmacy || billing.subtotal_pharmacy || 0)
  const ppn = Number(billing.ppnAmount || billing.ppn_amount || 0)
  const disc = Number(billing.discountAmount || billing.discount_amount || 0)
  const gTotal = Number(billing.grandTotal || billing.grand_total || 0)

  if (subDoctor > 0) {
    doc.text('Subtotal Jasa Medis & Tindakan Dokter:', rightBoxX, sumY)
    doc.text(fmtIDR(subDoctor), valX, sumY, { align: 'right' })
    sumY += 3.5
  }
  if (subLab > 0) {
    doc.text('Subtotal Pemeriksaan Laboratorium:', rightBoxX, sumY)
    doc.text(fmtIDR(subLab), valX, sumY, { align: 'right' })
    sumY += 3.5
  }
  if (subPharm > 0) {
    doc.text('Subtotal Obat / Farmasi:', rightBoxX, sumY)
    doc.text(fmtIDR(subPharm), valX, sumY, { align: 'right' })
    sumY += 3.5
  }
  if (ppn > 0) {
    doc.text('PPN 11% (Farmasi):', rightBoxX, sumY)
    doc.text(fmtIDR(ppn), valX, sumY, { align: 'right' })
    sumY += 3.5
  }
  if (disc > 0) {
    doc.text('Diskon / Potongan:', rightBoxX, sumY)
    doc.text(`-${fmtIDR(disc)}`, valX, sumY, { align: 'right' })
    sumY += 3.5
  }

  doc.setDrawColor(4, 100, 199)
  doc.setLineWidth(0.4)
  doc.line(rightBoxX, sumY, valX, sumY)
  sumY += 3.5

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(4, 100, 199)
  doc.text('TOTAL TAGIHAN:', rightBoxX, sumY)
  doc.text(fmtIDR(gTotal), valX, sumY, { align: 'right' })

  // Signatures on Left Bottom
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(71, 85, 105)

  const sigY = finalY + 2
  doc.text('Pasien / Keluarga Pasien,', 30, sigY, { align: 'center' })
  doc.text('( ______________________ )', 30, sigY + 15, { align: 'center' })

  doc.text('Petugas Kasir / Pembayaran,', 78, sigY, { align: 'center' })
  doc.text(`( ${billing.createdBy || 'Petugas Kasir'} )`, 78, sigY + 15, { align: 'center' })

  // Bottom Notice
  doc.setFontSize(6.5)
  doc.setTextColor(148, 163, 184)
  doc.text(`* Bukti pembayaran sah ini diterbitkan otomatis oleh Sistem Akuntansi Klinik (Dicetak: ${fmtDateTime(new Date())})`, 12, pageH - 6)

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

// ─── PPN Tax Report PDF (CoreTax DJP Compliant) ────────────────────────
export function exportPPNReportPDF({
  periodBillings = [],
  periodExpenses = [],
  dppFarmasi = 0,
  ppnKeluaran = 0,
  ppnMasukan = 0,
  ppnTerutang = 0,
  periodLabel = 'Semua Periode',
  branchName = 'Utama',
  appSettings = null
}) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()

  const subtitle = `Rekapitulasi SPT Masa PPN Sesuai Kaidah CoreTax DJP & UU HPP | Periode: ${periodLabel}`
  let startY = addHeader(doc, 'LAPORAN PAJAK PERTAMBAHAN NILAI (PPN) — CORETAX', subtitle, branchName, appSettings)

  // 1. Identitas PKP & Rekapitulasi CoreTax DJP
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(203, 213, 225)
  doc.roundedRect(14, startY + 2, pageW - 28, 22, 2, 2, 'FD')

  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 41, 59)
  doc.text('IDENTITAS PKP & REKAPITULASI SPT MASA PPN', 18, startY + 7)

  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  const npwpPKP = appSettings?.taxId || appSettings?.npwp || '01.234.567.8-012.000'
  doc.text(`Nama PKP : ${appSettings?.companyName || 'KLINIK PRATAMA SUBEKTI'}`, 18, startY + 12)
  doc.text(`NPWP/NITKU: ${npwpPKP}`, 18, startY + 16)
  doc.text(`Ketentuan : Penjualan Obat Terutang PPN 11% (Jasa Medis Dibebaskan PMK 71/2022)`, 18, startY + 20)

  const col2X = 145
  doc.text(`DPP Penjualan Obat (BKP) : ${fmtIDR(dppFarmasi)}`, col2X, startY + 12)
  doc.text(`PPN Keluaran Dipungut (11%): ${fmtIDR(ppnKeluaran)}`, col2X, startY + 16)
  doc.text(`PPN Masukan Dikreditkan   : ${fmtIDR(ppnMasukan)}`, col2X, startY + 20)

  const col3X = 220
  const isKurangBayar = ppnTerutang >= 0
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(isKurangBayar ? 220 : 13, isKurangBayar ? 38 : 148, isKurangBayar ? 38 : 136)
  doc.text(isKurangBayar ? 'STATUS: PPN KURANG BAYAR' : 'STATUS: PPN LEBIH BAYAR', col3X, startY + 12)
  doc.setFontSize(10)
  doc.text(fmtIDR(Math.abs(ppnTerutang)), col3X, startY + 18)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.text(isKurangBayar ? 'Wajib disetor ke Kas Negara (CoreTax)' : 'Dapat dikompensasikan ke masa berikutnya', col3X, startY + 22)

  startY += 28

  // 2. Table PPN Keluaran
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 23, 42)
  doc.text('I. PPN KELUARAN — PENYERAHAN BARANG KENA PAJAK (FARMASI & OBAT-OBATAN)', 14, startY)

  const kelRows = (periodBillings || [])
    .filter(b => (b.ppnAmount || 0) > 0)
    .map((b, idx) => [
      idx + 1,
      b.billingNumber,
      fmtDate(b.visitDate),
      b.patientName || '—',
      'FP Digunggung (Konsumen Akhir)',
      fmtIDR(b.subtotalPharmacy || 0),
      '11%',
      fmtIDR(b.ppnAmount || 0)
    ])

  doc.autoTable({
    startY: startY + 3,
    head: [['No', 'No. Billing / Dokumen', 'Tanggal', 'Nama Pembeli / Pasien', 'Jenis Faktur (CoreTax)', 'DPP Farmasi (Rp)', 'Tarif', 'PPN 11% (Rp)']],
    body: kelRows.length > 0 ? kelRows : [['—', '—', '—', 'Tidak ada penyerahan terutang PPN pada periode ini', '—', '0', '0%', '0']],
    styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 1.8 },
    headStyles: { fillColor: [5, 150, 105], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 38 },
      2: { cellWidth: 24 },
      3: { cellWidth: 65 },
      4: { cellWidth: 55 },
      5: { cellWidth: 35, halign: 'right' },
      6: { cellWidth: 15, halign: 'center' },
      7: { cellWidth: 27, halign: 'right' },
    },
    foot: [['', '', '', '', 'TOTAL PPN KELUARAN', fmtIDR(dppFarmasi), '', fmtIDR(ppnKeluaran)]],
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', halign: 'right' }
  })

  let tableEndY = doc.lastAutoTable.finalY + 7

  // Check page break for Table 2
  if (tableEndY + 45 > pageH - 25) {
    doc.addPage()
    tableEndY = 18
  }

  // 3. Table PPN Masukan
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 23, 42)
  doc.text('II. PPN MASUKAN — PEROLEHAN BARANG KENA PAJAK / JASA KENA PAJAK (PEMBELIAN OPERASIONAL)', 14, tableEndY)

  const totalDPPExpense = (periodExpenses || []).reduce((s, e) => s + (e.grossAmount || 0), 0)
  const masRows = (periodExpenses || [])
    .filter(e => (e.ppnAmount || 0) > 0)
    .map((e, idx) => [
      idx + 1,
      e.expenseNumber,
      fmtDate(e.expenseDate),
      e.vendorName || '—',
      e.taxInvoiceNumber || e.invoiceNumber || 'Faktur Pajak Standar',
      e.description || 'Pembelian Barang/Obat',
      fmtIDR(e.grossAmount || 0),
      fmtIDR(e.ppnAmount || 0)
    ])

  doc.autoTable({
    startY: tableEndY + 3,
    head: [['No', 'No. Transaksi', 'Tanggal', 'Nama PKP Penjual / Rekanan', 'No. Faktur Pajak', 'Keterangan BKP / JKP', 'DPP (Rp)', 'PPN Masukan (Rp)']],
    body: masRows.length > 0 ? masRows : [['—', '—', '—', '—', '—', 'Tidak ada faktur pajak masukan pada periode ini', '0', '0']],
    styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 1.8 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 32 },
      2: { cellWidth: 22 },
      3: { cellWidth: 48 },
      4: { cellWidth: 42 },
      5: { cellWidth: 50 },
      6: { cellWidth: 33, halign: 'right' },
      7: { cellWidth: 32, halign: 'right' },
    },
    foot: [['', '', '', '', '', 'TOTAL PPN MASUKAN', fmtIDR(totalDPPExpense), fmtIDR(ppnMasukan)]],
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', halign: 'right' }
  })

  const finalY = doc.lastAutoTable.finalY
  addSignatureBlock(doc, finalY)
  addFooter(doc, appSettings)
  doc.save(`Laporan_PPN_CoreTax_${periodLabel.replace(/[\s/]+/g, '_')}.pdf`)
}

// ─── PPh 21 Tax Report PDF (CoreTax DJP Compliant) ─────────────
export function exportPPh21ReportPDF({
  pph21Transactions = [],
  totalGross = 0,
  totalDPP = 0,
  totalPPh21 = 0,
  totalNet = 0,
  periodLabel = 'Semua Periode',
  branchName = 'Utama',
  doctorNameFilter = 'Semua Dokter',
  appSettings = null
}) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()

  const subtitle = `Sesuai PER-2/PJ/2024 & Kaidah CoreTax DJP | Kode Objek Pajak: 21-100-07 (Tenaga Ahli/Dokter) | Periode: ${periodLabel}`
  let startY = addHeader(doc, 'BUKTI PEMOTONGAN & REKAPITULASI PPH PASAL 21 DOKTER', subtitle, branchName, appSettings)

  // 1. Identitas Pemotong & Dasar Perhitungan Box
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(203, 213, 225)
  doc.roundedRect(14, startY + 2, pageW - 28, 22, 2, 2, 'FD')

  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 41, 59)
  doc.text('IDENTITAS PEMOTONG PAJAK & KETENTUAN CORETAX DJP', 18, startY + 7)

  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  const npwpPemotong = appSettings?.taxId || appSettings?.npwp || '01.234.567.8-012.000'
  doc.text(`Nama Pemotong : ${appSettings?.companyName || 'KLINIK PRATAMA SUBEKTI'}`, 18, startY + 12)
  doc.text(`NPWP Pemotong : ${npwpPemotong}`, 18, startY + 16)
  doc.text(`Filter Dokter : ${doctorNameFilter}`, 18, startY + 20)

  const midX = 140
  doc.text(`Kode Objek Pajak : 21-100-07 (Imbalan Kepada Tenaga Ahli / Dokter)`, midX, startY + 12)
  doc.text(`Dasar DPP        : 50% × Jasa Medis Pemeriksaan & Tindakan Dokter`, midX, startY + 16)
  doc.text(`Catatan Khusus   : Komponen Farmasi dan Laboratorium Dikecualikan`, midX, startY + 20)

  const rightKpiX = 225
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(220, 38, 38)
  doc.text('TOTAL PPH 21 TERUTANG', rightKpiX, startY + 12)
  doc.setFontSize(10.5)
  doc.text(fmtIDR(totalPPh21), rightKpiX, startY + 18)
  doc.setFontSize(7)
  doc.setTextColor(5, 150, 105)
  doc.text(`Neto Dokter: ${fmtIDR(totalNet)}`, rightKpiX, startY + 22)

  startY += 28

  // 2. Table Detail Transaksi CoreTax
  const rows = (pph21Transactions || []).map((d, idx) => [
    idx + 1,
    d.billingNumber,
    fmtDate(d.visitDate),
    d.doctorName || '—',
    d.doctorNpwp || '00.000.000.0-000.000',
    `${d.patientName || '—'} (${d.patientMRN || '—'})`,
    fmtIDR(d.grossAmount),
    fmtIDR(d.dpp),
    `${(d.rate * 100).toFixed(0)}%`,
    fmtIDR(d.pph21Amount),
    fmtIDR(d.netToDoctor)
  ])

  doc.autoTable({
    startY,
    head: [['No', 'No. Billing / Ref', 'Tanggal', 'Nama Dokter', 'NPWP Dokter', 'Nama Pasien (RM)', 'Bruto Jasa Medis', 'DPP 50%', 'Tarif', 'PPh 21 Dipotong', 'Neto Diterima']],
    body: rows.length > 0 ? rows : [['—', '—', '—', '—', '—', 'Tidak ada data transaksi PPh 21 pada periode ini', '0', '0', '0%', '0', '0']],
    styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 1.8 },
    headStyles: { fillColor: [220, 38, 38], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 32 },
      2: { cellWidth: 20 },
      3: { cellWidth: 38 },
      4: { cellWidth: 32 },
      5: { cellWidth: 38 },
      6: { cellWidth: 25, halign: 'right' },
      7: { cellWidth: 22, halign: 'right' },
      8: { cellWidth: 14, halign: 'center' },
      9: { cellWidth: 23, halign: 'right' },
      10: { cellWidth: 25, halign: 'right' },
    },
    foot: [['', '', '', '', '', 'TOTAL', fmtIDR(totalGross), fmtIDR(totalDPP), '', fmtIDR(totalPPh21), fmtIDR(totalNet)]],
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', halign: 'right' }
  })

  const finalY = doc.lastAutoTable.finalY
  addSignatureBlock(doc, finalY)
  addFooter(doc, appSettings)
  doc.save(`Laporan_PPh21_CoreTax_${periodLabel.replace(/[\s/]+/g, '_')}.pdf`)
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

// ─── Cash Flow (Arus Kas) PDF ──────────────────────────────────
export function exportCashFlowPDF(cashFlowData, period, branchName, appSettings = null) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const startY = addHeader(doc, 'LAPORAN ARUS KAS (STATEMENT OF CASH FLOWS)', period, branchName, appSettings)

  const body = [
    ['I. ARUS KAS DARI AKTIVITAS OPERASI', ''],
    ['   Laba Bersih Sebelum Pajak', fmtIDR(cashFlowData.netProfit)],
    ['   Penyesuaian untuk merekonsiliasi laba bersih:', ''],
    ['     Beban Penyusutan & Amortisasi', fmtIDR(cashFlowData.totalDepreciation)],
    ['   Perubahan dalam Modal Kerja:', ''],
    ['     (Kenaikan) / Penurunan Piutang Usaha', fmtIDR(-cashFlowData.receivableChange)],
    ['     (Kenaikan) / Penurunan Persediaan Obat & BHP', fmtIDR(-cashFlowData.inventoryChange)],
    ['     Kenaikan / (Penurunan) Utang Usaha', fmtIDR(cashFlowData.payableChange)],
    ['     Kenaikan / (Penurunan) Utang Pajak', fmtIDR(cashFlowData.taxPayableChange)],
    ['ARUS KAS BERSIH DARI AKTIVITAS OPERASI', fmtIDR(cashFlowData.operatingCF)],
    ['', ''],
    ['II. ARUS KAS DARI AKTIVITAS INVESTASI', ''],
    ['   Perolehan Aset Tetap & Peralatan Medis', fmtIDR(-cashFlowData.investingCF)],
    ['ARUS KAS BERSIH DARI AKTIVITAS INVESTASI', fmtIDR(cashFlowData.investingCF)],
    ['', ''],
    ['III. ARUS KAS DARI AKTIVITAS PENDANAAN', ''],
    ['   Penambahan / (Pembayaran) Utang Bank & Modal', fmtIDR(cashFlowData.financingCF)],
    ['ARUS KAS BERSIH DARI AKTIVITAS PENDANAAN', fmtIDR(cashFlowData.financingCF)],
    ['', ''],
    ['KENAIKAN / (PENURUNAN) KAS BERSIH', fmtIDR(cashFlowData.netCashFlow)],
    ['SALDO KAS & SETARA KAS AWAL PERIODE', fmtIDR(cashFlowData.openingCashBalance)],
    ['SALDO KAS & SETARA KAS AKHIR PERIODE', fmtIDR(cashFlowData.endingCashBalance)],
  ]

  doc.autoTable({
    startY,
    head: [['Keterangan Arus Kas (Metode Tidak Langsung)', 'Jumlah (Rp)']],
    body,
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2 },
    headStyles: { fillColor: [4, 100, 199], textColor: 255, fontStyle: 'bold' },
    didParseCell(hookData) {
      const text = hookData.row.raw?.[0] || ''
      if (text.startsWith('I.') || text.startsWith('II.') || text.startsWith('III.')) {
        hookData.cell.styles.fontStyle = 'bold'
        hookData.cell.styles.fillColor = [241, 245, 249]
        hookData.cell.styles.textColor = [30, 41, 59]
      } else if (text.startsWith('ARUS KAS BERSIH') || text.startsWith('KENAIKAN') || text.startsWith('SALDO KAS')) {
        hookData.cell.styles.fontStyle = 'bold'
        if (text.startsWith('SALDO KAS AKHIR PERIODE')) {
          hookData.cell.styles.fillColor = [224, 242, 254]
          hookData.cell.styles.textColor = [3, 105, 161]
        }
      }
    },
    columnStyles: {
      0: { cellWidth: 135 },
      1: { cellWidth: 47, halign: 'right', fontStyle: 'bold' },
    },
  })

  const finalY = doc.lastAutoTable.finalY
  addSignatureBlock(doc, finalY)
  addFooter(doc, appSettings)
  doc.save(`Laporan_Arus_Kas_${period.replace(/\s+/g, '_')}.pdf`)
}
