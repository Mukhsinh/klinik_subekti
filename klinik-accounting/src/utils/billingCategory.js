export const SERVICE_CATEGORIES = [
  { value: 'KONSULTASI_UMUM', label: 'Konsultasi Dokter Umum' },
  { value: 'KONSULTASI_SPESIALIS', label: 'Konsultasi Dokter Spesialis' },
  { value: 'TINDAKAN_MEDIS_MINOR', label: 'Tindakan Medis Minor' },
  { value: 'TINDAKAN_MEDIS_MAYOR', label: 'Tindakan Medis Mayor' },
  { value: 'BHP', label: 'Bahan Habis Pakai (BHP)' },
  { value: 'IMUNISASI_VAKSINASI', label: 'Imunisasi & Vaksinasi' },
  { value: 'MCU', label: 'MCU (Medical Check Up)' },
  { value: 'KLINIK_GIGI', label: 'Klinik Gigi' },
  { value: 'LABORATORIUM', label: 'Pemeriksaan Laboratorium' },
  { value: 'LAINNYA', label: 'Lainnya' },
]

export const SERVICE_CATEGORY_MAP = {
  KONSULTASI_UMUM: 'Konsultasi Dokter',
  KONSULTASI_SPESIALIS: 'Konsultasi Spesialis',
  TINDAKAN_MEDIS_MINOR: 'Tindakan Medis',
  TINDAKAN_MEDIS_MAYOR: 'Tindakan Medis Mayor',
  BHP: 'BHP (Bahan Habis Pakai)',
  IMUNISASI_VAKSINASI: 'Imunisasi & Vaksinasi',
  MCU: 'Medical Check Up',
  KLINIK_GIGI: 'Klinik Gigi',
  LABORATORIUM: 'Laboratorium',
  LAINNYA: 'Lainnya',
}

/**
 * Menyelesaikan nama kategori tampilan untuk item billing secara akurat
 * sinkron dengan konfigurasi manajemen tarif (/settings/service-tariffs) & master farmasi.
 *
 * @param {Object} item - Item billing (dari tabel billing_items atau form)
 * @param {Array} serviceTariffs - Daftar tarif layanan dari store / DB
 * @param {Array} pharmacyItems - Daftar master item obat/BHP dari store / DB
 * @returns {string} Label kategori yang rapi (misal: 'BHP (Bahan Habis Pakai)', 'Tindakan Medis', 'Laboratorium', dll.)
 */
export function resolveBillingItemCategory(item, serviceTariffs = [], pharmacyItems = []) {
  if (!item) return 'Layanan Medis'

  const itemName = (item.itemName || item.item_name || '').trim()
  const itemNameUpper = itemName.toUpperCase()
  const sId = item.serviceTariffId || item.service_tariff_id
  const pId = item.pharmacyItemId || item.pharmacy_item_id
  const iType = (item.itemType || item.item_type || 'SERVICE').toUpperCase()

  // 1. Cek langsung jika nama mengandung BHP atau kata Bahan Habis Pakai
  if (
    itemNameUpper.includes('BHP') ||
    itemNameUpper.includes('BAHAN HABIS PAKAI') ||
    itemNameUpper.startsWith('BHP-') ||
    itemNameUpper.endsWith('-BHP')
  ) {
    return 'BHP (Bahan Habis Pakai)'
  }

  // 2. Cocokkan dengan master Tarif Layanan (Service Tariffs)
  const matchedService = (serviceTariffs || []).find(s => 
    (sId && (s.id === sId || s.code === sId)) ||
    (s.name && s.name.toUpperCase().trim() === itemNameUpper)
  )

  if (matchedService) {
    const rawCat = matchedService.serviceCategory || matchedService.service_category
    if (rawCat === 'BHP' || (matchedService.name || '').toUpperCase().includes('BHP')) {
      return 'BHP (Bahan Habis Pakai)'
    }
    if (rawCat && SERVICE_CATEGORY_MAP && SERVICE_CATEGORY_MAP[rawCat]) {
      return SERVICE_CATEGORY_MAP[rawCat]
    }
    if (rawCat) {
      return rawCat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    }
  }

  // 3. Cocokkan dengan master Farmasi (Pharmacy Items)
  const matchedPharm = (pharmacyItems || []).find(p => 
    (pId && p.id === pId) ||
    (p.itemName && p.itemName.toUpperCase().trim() === itemNameUpper) ||
    (p.item_name && p.item_name.toUpperCase().trim() === itemNameUpper)
  )

  if (matchedPharm) {
    const pCat = (matchedPharm.category || matchedPharm.itemCategory || '').toUpperCase()
    const pCode = (matchedPharm.itemCode || matchedPharm.item_code || '').toUpperCase()
    if (pCat === 'BHP' || pCat === 'PEMAKAIAN BHP' || pCode.startsWith('BHP-')) {
      return 'BHP (Bahan Habis Pakai)'
    }
    return 'Farmasi / Obat'
  }

  // 4. Fallback berdasarkan item_type
  if (iType === 'LAB') return 'Laboratorium'
  if (iType === 'PHARMACY') return 'Farmasi / Obat'
  return 'Jasa Medis'
}

/**
 * Mengembalikan styling badge (CSS classes) untuk kategori item billing
 */
export function getBillingCategoryBadgeClass(categoryLabel) {
  if (!categoryLabel) return 'bg-slate-100 text-slate-700 border border-slate-200'
  const cat = categoryLabel.toUpperCase()
  if (cat.includes('BHP')) {
    return 'bg-amber-50 text-amber-700 border border-amber-200'
  }
  if (cat.includes('LAB')) {
    return 'bg-purple-50 text-purple-700 border border-purple-200'
  }
  if (cat.includes('FARMASI') || cat.includes('OBAT')) {
    return 'bg-emerald-50 text-emerald-700 border border-emerald-200'
  }
  if (cat.includes('KONSULTASI')) {
    return 'bg-sky-50 text-sky-700 border border-sky-200'
  }
  if (cat.includes('TINDAKAN')) {
    return 'bg-indigo-50 text-indigo-700 border border-indigo-200'
  }
  return 'bg-blue-50 text-blue-700 border border-blue-200'
}
