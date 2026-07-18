/**
 * exportUtils.js - Utility functions for exporting data to Excel and PDF
 */
import * as XLSX from 'xlsx'
import { fmtIDR, fmtDate } from './format'

// ══════════════════════════════════════════════════════════════
// EXCEL EXPORT FUNCTIONS
// ══════════════════════════════════════════════════════════════

/**
 * Export asset inventory to Excel
 */
export function exportAssetInventoryToExcel(assets, coa) {
  const data = assets.map(asset => ({
    'Kode Aset': asset.assetCode,
    'Nama Aset': asset.assetName,
    'Kategori': asset.category,
    'Lokasi': asset.location || '-',
    'Departemen': asset.department || '-',
    'Tanggal Perolehan': fmtDate(asset.acquisitionDate),
    'Harga Perolehan': asset.acquisitionCost,
    'Umur Ekonomis (Tahun)': asset.usefulLifeYears,
    'Akumulasi Penyusutan': asset.accumulatedDepreciation || 0,
    'Nilai Buku': asset.bookValue || asset.acquisitionCost,
    'Kondisi': asset.condition,
    'Status': asset.status,
    'COA Aset': asset.coaAssetCode,
    'COA Beban Penyusutan': asset.coaDepreciationCode,
    'COA Akumulasi Penyusutan': asset.coaAccumulatedCode,
    'Deskripsi': asset.description || '-'
  }))

  const ws = XLSX.utils.json_to_sheet(data)
  
  // Set column widths
  const colWidths = [
    { wch: 12 }, // Kode Aset
    { wch: 30 }, // Nama Aset
    { wch: 20 }, // Kategori
    { wch: 20 }, // Lokasi
    { wch: 20 }, // Departemen
    { wch: 15 }, // Tanggal Perolehan
    { wch: 18 }, // Harga Perolehan
    { wch: 20 }, // Umur Ekonomis
    { wch: 20 }, // Akumulasi Penyusutan
    { wch: 18 }, // Nilai Buku
    { wch: 12 }, // Kondisi
    { wch: 10 }, // Status
    { wch: 12 }, // COA Aset
    { wch: 22 }, // COA Beban Penyusutan
    { wch: 25 }, // COA Akumulasi Penyusutan
    { wch: 40 }  // Deskripsi
  ]
  ws['!cols'] = colWidths

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Inventaris Aset')

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().slice(0, 10)
  const filename = `Inventaris_Aset_${timestamp}.xlsx`
  
  XLSX.writeFile(wb, filename)
}

/**
 * Export asset depreciation report to Excel
 */
export function exportDepreciationToExcel(depreciations, assets) {
  const data = depreciations
    .filter(d => d.status === 'POSTED')
    .map(depr => {
      const asset = assets.find(a => a.id === depr.assetId)
      return {
        'Periode': `${depr.periodMonth}/${depr.periodYear}`,
        'Kode Aset': asset?.assetCode || '-',
        'Nama Aset': asset?.assetName || '-',
        'Kategori': asset?.category || '-',
        'Nilai Buku Awal': depr.openingBookValue,
        'Beban Penyusutan': depr.depreciationAmount,
        'Nilai Buku Akhir': depr.closingBookValue,
        'Metode': depr.calculationMethod,
        'Tanggal Kalkulasi': fmtDate(depr.calculationDate),
        'Tanggal Post': fmtDate(depr.postedAt),
        'Posted By': depr.postedBy,
        'Status': depr.status
      }
    })

  const ws = XLSX.utils.json_to_sheet(data)
  
  const colWidths = [
    { wch: 12 }, // Periode
    { wch: 12 }, // Kode Aset
    { wch: 30 }, // Nama Aset
    { wch: 20 }, // Kategori
    { wch: 18 }, // Nilai Buku Awal
    { wch: 18 }, // Beban Penyusutan
    { wch: 18 }, // Nilai Buku Akhir
    { wch: 18 }, // Metode
    { wch: 18 }, // Tanggal Kalkulasi
    { wch: 18 }, // Tanggal Post
    { wch: 15 }, // Posted By
    { wch: 10 }  // Status
  ]
  ws['!cols'] = colWidths

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Penyusutan Aset')

  const timestamp = new Date().toISOString().slice(0, 10)
  const filename = `Penyusutan_Aset_${timestamp}.xlsx`
  
  XLSX.writeFile(wb, filename)
}

/**
 * Export asset mutations to Excel
 */
export function exportMutationsToExcel(mutations, assets) {
  const data = mutations.map(mut => {
    const asset = assets.find(a => a.id === mut.assetId)
    return {
      'Tanggal': fmtDate(mut.mutationDate),
      'Kode Aset': asset?.assetCode || '-',
      'Nama Aset': asset?.assetName || '-',
      'Jenis Mutasi': mut.mutationType,
      'Dari Lokasi': mut.fromLocation || '-',
      'Ke Lokasi': mut.toLocation || '-',
      'Nilai Transaksi': mut.amount || mut.disposalValue || 0,
      'Nilai Pelepasan': mut.disposalValue || 0,
      'Laba/Rugi': mut.gainLossAmount || 0,
      'Referensi': mut.referenceNumber || '-',
      'Deskripsi': mut.description || '-',
      'Dibuat Oleh': mut.createdBy || '-',
      'Diotorisasi': mut.authorizedBy || '-'
    }
  })

  const ws = XLSX.utils.json_to_sheet(data)
  
  const colWidths = [
    { wch: 12 }, // Tanggal
    { wch: 12 }, // Kode Aset
    { wch: 30 }, // Nama Aset
    { wch: 18 }, // Jenis Mutasi
    { wch: 20 }, // Dari Lokasi
    { wch: 20 }, // Ke Lokasi
    { wch: 18 }, // Nilai Transaksi
    { wch: 18 }, // Nilai Pelepasan
    { wch: 18 }, // Laba/Rugi
    { wch: 20 }, // Referensi
    { wch: 40 }, // Deskripsi
    { wch: 15 }, // Dibuat Oleh
    { wch: 15 }  // Diotorisasi
  ]
  ws['!cols'] = colWidths

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Mutasi Aset')

  const timestamp = new Date().toISOString().slice(0, 10)
  const filename = `Mutasi_Aset_${timestamp}.xlsx`
  
  XLSX.writeFile(wb, filename)
}

/**
 * Export asset card (complete history) to Excel
 */
export function exportAssetCardToExcel(asset, mutations, depreciations) {
  const wb = XLSX.utils.book_new()

  // Sheet 1: Asset Info
  const assetInfo = [
    ['KARTU INVENTARIS ASET'],
    [],
    ['Kode Aset', asset.assetCode],
    ['Nama Aset', asset.assetName],
    ['Kategori', asset.category],
    ['Lokasi', asset.location || '-'],
    ['Departemen', asset.department || '-'],
    ['Kondisi', asset.condition],
    ['Status', asset.status],
    [],
    ['INFORMASI PEROLEHAN'],
    [],
    ['Tanggal Perolehan', fmtDate(asset.acquisitionDate)],
    ['Harga Perolehan', asset.acquisitionCost],
    ['Umur Ekonomis', `${asset.usefulLifeYears} tahun`],
    ['Akumulasi Penyusutan', asset.accumulatedDepreciation || 0],
    ['Nilai Buku', asset.bookValue || asset.acquisitionCost],
    ['Penyusutan Terakhir', asset.lastDepreciationDate ? fmtDate(asset.lastDepreciationDate) : '-'],
    [],
    ['COA TERKAIT'],
    [],
    ['Akun Aset', asset.coaAssetCode],
    ['Akun Beban Penyusutan', asset.coaDepreciationCode],
    ['Akun Akumulasi Penyusutan', asset.coaAccumulatedCode]
  ]

  const wsInfo = XLSX.utils.aoa_to_sheet(assetInfo)
  wsInfo['!cols'] = [{ wch: 25 }, { wch: 30 }]
  XLSX.utils.book_append_sheet(wb, wsInfo, 'Info Aset')

  // Sheet 2: Depreciation History
  if (depreciations.length > 0) {
    const deprData = depreciations
      .filter(d => d.status === 'POSTED')
      .map(d => ({
        'Periode': `${d.periodMonth}/${d.periodYear}`,
        'Nilai Buku Awal': d.openingBookValue,
        'Beban Penyusutan': d.depreciationAmount,
        'Nilai Buku Akhir': d.closingBookValue,
        'Tanggal Post': fmtDate(d.postedAt)
      }))

    const wsDepr = XLSX.utils.json_to_sheet(deprData)
    wsDepr['!cols'] = [
      { wch: 12 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 }
    ]
    XLSX.utils.book_append_sheet(wb, wsDepr, 'Riwayat Penyusutan')
  }

  // Sheet 3: Mutation History
  if (mutations.length > 0) {
    const mutData = mutations.map(m => ({
      'Tanggal': fmtDate(m.mutationDate),
      'Jenis Mutasi': m.mutationType,
      'Detail': m.mutationType === 'TRANSFER' 
        ? `${m.fromLocation || '?'} → ${m.toLocation || '?'}`
        : m.description,
      'Nilai': m.disposalValue || m.amount || 0,
      'Laba/Rugi': m.gainLossAmount || 0,
      'Referensi': m.referenceNumber || '-'
    }))

    const wsMut = XLSX.utils.json_to_sheet(mutData)
    wsMut['!cols'] = [
      { wch: 12 },
      { wch: 18 },
      { wch: 40 },
      { wch: 18 },
      { wch: 18 },
      { wch: 20 }
    ]
    XLSX.utils.book_append_sheet(wb, wsMut, 'Riwayat Mutasi')
  }

  const timestamp = new Date().toISOString().slice(0, 10)
  const filename = `Kartu_Aset_${asset.assetCode}_${timestamp}.xlsx`
  
  XLSX.writeFile(wb, filename)
}

// ══════════════════════════════════════════════════════════════
// PDF EXPORT FUNCTIONS (using browser print)
// ══════════════════════════════════════════════════════════════

/**
 * Generate printable HTML for asset card (can be printed to PDF)
 */
export function generateAssetCardHTML(asset, mutations, depreciations) {
  const totalDepr = depreciations
    .filter(d => d.status === 'POSTED')
    .reduce((sum, d) => sum + d.depreciationAmount, 0)
  
  const currentBookValue = asset.acquisitionCost - totalDepr

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Kartu Aset ${asset.assetCode}</title>
      <style>
        @media print {
          @page { margin: 1cm; }
          body { margin: 0; }
        }
        body {
          font-family: Arial, sans-serif;
          font-size: 11px;
          line-height: 1.4;
          color: #333;
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
        }
        h1 { font-size: 20px; margin-bottom: 5px; color: #1e40af; }
        h2 { font-size: 16px; margin-top: 20px; margin-bottom: 10px; color: #1e40af; border-bottom: 2px solid #1e40af; padding-bottom: 5px; }
        h3 { font-size: 14px; margin-top: 15px; margin-bottom: 8px; color: #059669; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #1e40af; padding-bottom: 15px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }
        .info-item { padding: 8px; background: #f8fafc; border-left: 3px solid #3b82f6; }
        .info-label { font-weight: bold; color: #64748b; font-size: 10px; }
        .info-value { color: #1e293b; margin-top: 2px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10px; }
        th { background: #1e40af; color: white; padding: 8px; text-align: left; font-weight: 600; }
        td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }
        tr:hover { background: #f8fafc; }
        .amount { text-align: right; font-family: 'Courier New', monospace; font-weight: 600; }
        .text-right { text-align: right; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 9px; font-weight: 600; }
        .badge-green { background: #d1fae5; color: #065f46; }
        .badge-blue { background: #dbeafe; color: #1e40af; }
        .footer { margin-top: 30px; text-align: center; color: #64748b; font-size: 9px; border-top: 1px solid #e2e8f0; padding-top: 10px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>KARTU INVENTARIS ASET TETAP</h1>
        <div style="font-size: 14px; color: #64748b; margin-top: 5px;">
          ${asset.assetCode} - ${asset.assetName}
        </div>
      </div>

      <h2>Informasi Aset</h2>
      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">Kode Aset</div>
          <div class="info-value">${asset.assetCode}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Kategori</div>
          <div class="info-value">${asset.category}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Lokasi</div>
          <div class="info-value">${asset.location || '-'}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Departemen</div>
          <div class="info-value">${asset.department || '-'}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Kondisi</div>
          <div class="info-value">${asset.condition}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Status</div>
          <div class="info-value"><span class="badge badge-green">${asset.status}</span></div>
        </div>
      </div>

      <h2>Informasi Keuangan</h2>
      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">Tanggal Perolehan</div>
          <div class="info-value">${fmtDate(asset.acquisitionDate)}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Harga Perolehan</div>
          <div class="info-value amount">${fmtIDR(asset.acquisitionCost)}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Umur Ekonomis</div>
          <div class="info-value">${asset.usefulLifeYears} tahun</div>
        </div>
        <div class="info-item">
          <div class="info-label">Akumulasi Penyusutan</div>
          <div class="info-value amount" style="color: #d97706;">${fmtIDR(totalDepr)}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Nilai Buku Saat Ini</div>
          <div class="info-value amount" style="color: #7c3aed; font-size: 14px;">${fmtIDR(currentBookValue)}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Penyusutan Terakhir</div>
          <div class="info-value">${asset.lastDepreciationDate ? fmtDate(asset.lastDepreciationDate) : '-'}</div>
        </div>
      </div>

      <h3>Akun COA Terkait</h3>
      <table>
        <tr>
          <td style="width: 40%;">Akun Aset</td>
          <td><strong>${asset.coaAssetCode}</strong></td>
        </tr>
        <tr>
          <td>Akun Beban Penyusutan</td>
          <td><strong>${asset.coaDepreciationCode}</strong></td>
        </tr>
        <tr>
          <td>Akun Akumulasi Penyusutan</td>
          <td><strong>${asset.coaAccumulatedCode}</strong></td>
        </tr>
      </table>

      ${depreciations.filter(d => d.status === 'POSTED').length > 0 ? `
        <h2>Riwayat Penyusutan</h2>
        <table>
          <thead>
            <tr>
              <th>Periode</th>
              <th class="text-right">Nilai Buku Awal</th>
              <th class="text-right">Beban Penyusutan</th>
              <th class="text-right">Nilai Buku Akhir</th>
              <th>Tanggal Post</th>
            </tr>
          </thead>
          <tbody>
            ${depreciations
              .filter(d => d.status === 'POSTED')
              .sort((a, b) => {
                if (a.periodYear !== b.periodYear) return b.periodYear - a.periodYear
                return b.periodMonth - a.periodMonth
              })
              .map(d => `
                <tr>
                  <td>${new Date(d.periodYear, d.periodMonth - 1).toLocaleString('id-ID', { month: 'long', year: 'numeric' })}</td>
                  <td class="amount">${fmtIDR(d.openingBookValue)}</td>
                  <td class="amount" style="color: #d97706;">${fmtIDR(d.depreciationAmount)}</td>
                  <td class="amount" style="color: #7c3aed;">${fmtIDR(d.closingBookValue)}</td>
                  <td>${fmtDate(d.postedAt)}</td>
                </tr>
              `).join('')}
          </tbody>
        </table>
      ` : ''}

      ${mutations.length > 0 ? `
        <h2>Riwayat Mutasi</h2>
        <table>
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Jenis</th>
              <th>Detail</th>
              <th class="text-right">Nilai</th>
              <th>Referensi</th>
            </tr>
          </thead>
          <tbody>
            ${mutations
              .sort((a, b) => new Date(b.mutationDate) - new Date(a.mutationDate))
              .map(m => `
                <tr>
                  <td>${fmtDate(m.mutationDate)}</td>
                  <td><span class="badge badge-blue">${m.mutationType}</span></td>
                  <td>${m.mutationType === 'TRANSFER' 
                    ? `${m.fromLocation || '?'} → ${m.toLocation || '?'}`
                    : m.description || '-'
                  }</td>
                  <td class="amount">${fmtIDR(m.disposalValue || m.amount || 0)}</td>
                  <td>${m.referenceNumber || '-'}</td>
                </tr>
              `).join('')}
          </tbody>
        </table>
      ` : ''}

      <div class="footer">
        Dicetak pada: ${new Date().toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' })}<br>
        Sistem Akuntansi Klinik - Karo Inventaris Aset Tetap
      </div>
    </body>
    </html>
  `
}

/**
 * Print asset card (opens print dialog which can save as PDF)
 */
export function printAssetCard(asset, mutations, depreciations) {
  const html = generateAssetCardHTML(asset, mutations, depreciations)
  const printWindow = window.open('', '_blank')
  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.focus()
  setTimeout(() => {
    printWindow.print()
  }, 250)
}
