/**
 * accountMapping.js
 * Centralized Account Mapping System for Klinik Accounting
 * Connects transactional modules (/billing, /stock-outflow, /expenses) with COA (/coa)
 * and feeds the Income Statement (/income-statement).
 */

export const DEFAULT_ACCOUNT_MAPPINGS = {
  // ── 1. MODUL BILLING KASIR ──
  billing_consultation: {
    key: 'billing_consultation',
    module: 'BILLING',
    moduleLabel: 'Billing Kasir',
    label: 'Pendapatan Konsultasi Dokter Umum',
    defaultCode: '4-11-001',
    description: 'Akun pendapatan default saat konsultasi dokter umum pada billing kasir',
    targetType: 'REVENUE'
  },
  billing_consultation_sp: {
    key: 'billing_consultation_sp',
    module: 'BILLING',
    moduleLabel: 'Billing Kasir',
    label: 'Pendapatan Konsultasi Dokter Spesialis',
    defaultCode: '4-11-002',
    description: 'Akun pendapatan saat konsultasi dokter spesialis pada billing kasir',
    targetType: 'REVENUE'
  },
  billing_action: {
    key: 'billing_action',
    module: 'BILLING',
    moduleLabel: 'Billing Kasir',
    label: 'Pendapatan Tindakan Medis & BHP',
    defaultCode: '4-11-003',
    description: 'Akun pendapatan untuk tindakan medis, observasi, dan tindakan keperawatan',
    targetType: 'REVENUE'
  },
  billing_lab: {
    key: 'billing_lab',
    module: 'BILLING',
    moduleLabel: 'Billing Kasir',
    label: 'Pendapatan Laboratorium Medis',
    defaultCode: '4-12-001',
    description: 'Akun pendapatan pemeriksaan lab (darah, urine, kimia darah)',
    targetType: 'REVENUE'
  },
  billing_pharmacy_ethical: {
    key: 'billing_pharmacy_ethical',
    module: 'BILLING',
    moduleLabel: 'Billing Kasir',
    label: 'Pendapatan Penjualan Obat Etikal (Resep)',
    defaultCode: '4-13-001',
    description: 'Akun pendapatan DPP penjualan obat paten / resep dokter',
    targetType: 'REVENUE'
  },
  billing_pharmacy_otc: {
    key: 'billing_pharmacy_otc',
    module: 'BILLING',
    moduleLabel: 'Billing Kasir',
    label: 'Pendapatan Penjualan Obat OTC / Generik',
    defaultCode: '4-13-002',
    description: 'Akun pendapatan DPP penjualan obat bebas / OTC / generik',
    targetType: 'REVENUE'
  },
  billing_pharmacy_bhp: {
    key: 'billing_pharmacy_bhp',
    module: 'BILLING',
    moduleLabel: 'Billing Kasir',
    label: 'Pendapatan Penjualan BHP Medis Pasien',
    defaultCode: '4-13-003',
    description: 'Akun pendapatan penjualan bahan habis pakai & alkes pasien',
    targetType: 'REVENUE'
  },
  billing_doctor_fee: {
    key: 'billing_doctor_fee',
    module: 'BILLING',
    moduleLabel: 'Billing Kasir',
    label: 'Beban Bagi Hasil Jasa Medis Dokter Umum',
    defaultCode: '6-12-001',
    description: 'Akun beban operasional pembagian fee jasa dokter umum',
    targetType: 'EXPENSE'
  },
  billing_doctor_fee_sp: {
    key: 'billing_doctor_fee_sp',
    module: 'BILLING',
    moduleLabel: 'Billing Kasir',
    label: 'Beban Bagi Hasil Jasa Medis Spesialis',
    defaultCode: '6-12-002',
    description: 'Akun beban operasional pembagian fee jasa dokter spesialis',
    targetType: 'EXPENSE'
  },

  // ── 2. MODUL HPP & PERSEDIAAN OBAT ──
  cogs_ethical: {
    key: 'cogs_ethical',
    module: 'HPP',
    moduleLabel: 'HPP & Persediaan',
    label: 'HPP Penjualan Obat Paten / Etikal',
    defaultCode: '5-11-001',
    description: 'Harga Pokok Penjualan persediaan obat paten yang terjual ke pasien',
    targetType: 'EXPENSE'
  },
  cogs_otc: {
    key: 'cogs_otc',
    module: 'HPP',
    moduleLabel: 'HPP & Persediaan',
    label: 'HPP Penjualan Obat Generik / OTC',
    defaultCode: '5-11-002',
    description: 'Harga Pokok Penjualan persediaan obat generik yang terjual ke pasien',
    targetType: 'EXPENSE'
  },
  cogs_bhp: {
    key: 'cogs_bhp',
    module: 'HPP',
    moduleLabel: 'HPP & Persediaan',
    label: 'HPP Bahan Habis Pakai (BHP) Medis',
    defaultCode: '5-11-003',
    description: 'Harga Pokok persediaan BHP yang digunakan pada billing/tindakan',
    targetType: 'EXPENSE'
  },
  inv_ethical: {
    key: 'inv_ethical',
    module: 'HPP',
    moduleLabel: 'HPP & Persediaan',
    label: 'Persediaan Obat Paten / Etikal',
    defaultCode: '1-13-001',
    description: 'Akun aset neraca untuk persediaan obat paten di apotek/gudang',
    targetType: 'ASSET'
  },
  inv_otc: {
    key: 'inv_otc',
    module: 'HPP',
    moduleLabel: 'HPP & Persediaan',
    label: 'Persediaan Obat Generik / OTC',
    defaultCode: '1-13-002',
    description: 'Akun aset neraca untuk persediaan obat generik di apotek/gudang',
    targetType: 'ASSET'
  },
  inv_bhp: {
    key: 'inv_bhp',
    module: 'HPP',
    moduleLabel: 'HPP & Persediaan',
    label: 'Persediaan BHP Medis',
    defaultCode: '1-13-003',
    description: 'Akun aset neraca untuk persediaan bahan medis habis pakai',
    targetType: 'ASSET'
  },

  // ── 3. MODUL STOCK OUTFLOW (PENGELUARAN NON-BILLING) ──
  outflow_internal: {
    key: 'outflow_internal',
    module: 'STOCK_OUTFLOW',
    moduleLabel: 'Pengeluaran Stok',
    label: 'Beban Pemakaian Internal Klinik',
    defaultCode: '6-18-001',
    description: 'Akun beban saat obat/BHP digunakan untuk keperluan internal operasional klinik',
    targetType: 'EXPENSE'
  },
  outflow_sample: {
    key: 'outflow_sample',
    module: 'STOCK_OUTFLOW',
    moduleLabel: 'Pengeluaran Stok',
    label: 'Beban Sampel & Promosi Obat',
    defaultCode: '6-17-001',
    description: 'Akun beban untuk pemberian obat sample atau keperluan promosi',
    targetType: 'EXPENSE'
  },
  outflow_donation: {
    key: 'outflow_donation',
    module: 'STOCK_OUTFLOW',
    moduleLabel: 'Pengeluaran Stok',
    label: 'Beban Bantuan & Donasi Medis',
    defaultCode: '6-91-002',
    description: 'Akun beban bantuan sosial, donasi kemanusiaan, atau bakti sosial',
    targetType: 'EXPENSE'
  },
  outflow_waste: {
    key: 'outflow_waste',
    module: 'STOCK_OUTFLOW',
    moduleLabel: 'Pengeluaran Stok',
    label: 'Beban Kerugian Obat Rusak & Kadaluarsa',
    defaultCode: '6-18-001',
    description: 'Akun beban kerugian akibat obat rusak fisik atau expired/kadaluarsa',
    targetType: 'EXPENSE'
  },
  outflow_other: {
    key: 'outflow_other',
    module: 'STOCK_OUTFLOW',
    moduleLabel: 'Pengeluaran Stok',
    label: 'Beban Pengeluaran Stok Lain-lain',
    defaultCode: '6-18-006',
    description: 'Akun beban untuk kebutuhan pengeluaran stok lainnya',
    targetType: 'EXPENSE'
  },

  // ── 4. MODUL EXPENSES (BEBAN OPERASIONAL KAS / BANK) ──
  expense_electricity: {
    key: 'expense_electricity',
    module: 'EXPENSES',
    moduleLabel: 'Beban Operasional',
    label: 'Beban Listrik (PLN)',
    defaultCode: '6-13-003',
    description: 'Beban operasional pembayaran listrik klinik',
    targetType: 'EXPENSE'
  },
  expense_water: {
    key: 'expense_water',
    module: 'EXPENSES',
    moduleLabel: 'Beban Operasional',
    label: 'Beban Air (PDAM)',
    defaultCode: '6-13-004',
    description: 'Beban operasional pembayaran air bersih klinik',
    targetType: 'EXPENSE'
  },
  expense_internet: {
    key: 'expense_internet',
    module: 'EXPENSES',
    moduleLabel: 'Beban Operasional',
    label: 'Beban Telepon & Internet',
    defaultCode: '6-13-005',
    description: 'Beban komunikasi, internet broadband, dan telepon',
    targetType: 'EXPENSE'
  },
  expense_rent: {
    key: 'expense_rent',
    module: 'EXPENSES',
    moduleLabel: 'Beban Operasional',
    label: 'Beban Sewa Gedung / Bangunan',
    defaultCode: '6-14-001',
    description: 'Beban sewa bangunan atau tempat usaha klinik',
    targetType: 'EXPENSE'
  },
  expense_maintenance_med: {
    key: 'expense_maintenance_med',
    module: 'EXPENSES',
    moduleLabel: 'Beban Operasional',
    label: 'Beban Pemeliharaan Alat Medis',
    defaultCode: '6-15-002',
    description: 'Biaya servis, kalibrasi, dan perawatan peralatan medis',
    targetType: 'EXPENSE'
  },
  expense_doctor_salary: {
    key: 'expense_doctor_salary',
    module: 'EXPENSES',
    moduleLabel: 'Beban Operasional',
    label: 'Beban Gaji Dokter Tetap',
    defaultCode: '6-11-001',
    description: 'Gaji pokok dokter dengan status karyawan tetap',
    targetType: 'EXPENSE'
  },
  expense_nurse_salary: {
    key: 'expense_nurse_salary',
    module: 'EXPENSES',
    moduleLabel: 'Beban Operasional',
    label: 'Beban Gaji Perawat & Bidan',
    defaultCode: '6-11-002',
    description: 'Gaji pokok perawat, bidan, dan staf paramedis',
    targetType: 'EXPENSE'
  },
  expense_admin_salary: {
    key: 'expense_admin_salary',
    module: 'EXPENSES',
    moduleLabel: 'Beban Operasional',
    label: 'Beban Gaji Staff Administrasi',
    defaultCode: '6-11-004',
    description: 'Gaji pokok staf administrasi, kasir, dan resepsionis',
    targetType: 'EXPENSE'
  },
  expense_allowance: {
    key: 'expense_allowance',
    module: 'EXPENSES',
    moduleLabel: 'Beban Operasional',
    label: 'Beban Tunjangan Karyawan',
    defaultCode: '6-11-006',
    description: 'Tunjangan hari raya, kehadiran, dan kompensasi kerja',
    targetType: 'EXPENSE'
  },
  expense_overtime: {
    key: 'expense_overtime',
    module: 'EXPENSES',
    moduleLabel: 'Beban Operasional',
    label: 'Beban Lembur Karyawan',
    defaultCode: '6-11-007',
    description: 'Upah lembur dan shift tambahan karyawan klinik',
    targetType: 'EXPENSE'
  },
  expense_atk: {
    key: 'expense_atk',
    module: 'EXPENSES',
    moduleLabel: 'Beban Operasional',
    label: 'Beban Alat Tulis Kantor (ATK)',
    defaultCode: '6-13-001',
    description: 'Biaya kertas, pena, map rekam medis, dan perlengkapan kantor',
    targetType: 'EXPENSE'
  },
  expense_print: {
    key: 'expense_print',
    module: 'EXPENSES',
    moduleLabel: 'Beban Operasional',
    label: 'Beban Cetakan & Fotokopi',
    defaultCode: '6-13-002',
    description: 'Biaya cetak brosur, kartu pasien, resep, dan fotokopi',
    targetType: 'EXPENSE'
  },
  expense_clean: {
    key: 'expense_clean',
    module: 'EXPENSES',
    moduleLabel: 'Beban Operasional',
    label: 'Beban Kebersihan & Sanitasi',
    defaultCode: '6-13-006',
    description: 'Biaya cairan disinfektan, sabun medis, sapu, dan kebersihan',
    targetType: 'EXPENSE'
  },
  expense_security: {
    key: 'expense_security',
    module: 'EXPENSES',
    moduleLabel: 'Beban Operasional',
    label: 'Beban Keamanan & Satpam',
    defaultCode: '6-13-007',
    description: 'Iuran keamanan lingkungan atau jasa sekuriti klinik',
    targetType: 'EXPENSE'
  },
  expense_maintenance_bldg: {
    key: 'expense_maintenance_bldg',
    module: 'EXPENSES',
    moduleLabel: 'Beban Operasional',
    label: 'Beban Pemeliharaan Gedung',
    defaultCode: '6-15-001',
    description: 'Biaya renovasi ringan, cat, perbaikan atap, dan AC',
    targetType: 'EXPENSE'
  },
  expense_maintenance_it: {
    key: 'expense_maintenance_it',
    module: 'EXPENSES',
    moduleLabel: 'Beban Operasional',
    label: 'Beban Pemeliharaan IT & Komputer',
    defaultCode: '6-15-005',
    description: 'Biaya perbaikan komputer, printer kasir, dan router jaringan',
    targetType: 'EXPENSE'
  },
  expense_marketing: {
    key: 'expense_marketing',
    module: 'EXPENSES',
    moduleLabel: 'Beban Operasional',
    label: 'Beban Iklan & Promosi',
    defaultCode: '6-17-001',
    description: 'Biaya promosi media sosial, spanduk kesehatan, dan publikasi',
    targetType: 'EXPENSE'
  },
  expense_meal: {
    key: 'expense_meal',
    module: 'EXPENSES',
    moduleLabel: 'Beban Operasional',
    label: 'Beban Konsumsi & Jamuan',
    defaultCode: '6-13-010',
    description: 'Konsumsi rapat manajemen, shift malam jaga dokter, dan tamu',
    targetType: 'EXPENSE'
  },
  expense_transport: {
    key: 'expense_transport',
    module: 'EXPENSES',
    moduleLabel: 'Beban Operasional',
    label: 'Beban Parkir & Transportasi',
    defaultCode: '6-13-009',
    description: 'Biaya bensin operasional pengadaan obat, parkir, dan kurir',
    targetType: 'EXPENSE'
  },
  expense_tax: {
    key: 'expense_tax',
    module: 'EXPENSES',
    moduleLabel: 'Beban Operasional',
    label: 'Beban Pajak & Perizinan',
    defaultCode: '6-19-003',
    description: 'Biaya perpanjangan izin operasional klinik, PBB, dan retribusi',
    targetType: 'EXPENSE'
  },
  expense_bank_admin: {
    key: 'expense_bank_admin',
    module: 'EXPENSES',
    moduleLabel: 'Beban Operasional',
    label: 'Beban Administrasi Bank',
    defaultCode: '6-19-001',
    description: 'Biaya admin bulanan rekening bank dan biaya transfer antar bank',
    targetType: 'EXPENSE'
  },
  expense_other: {
    key: 'expense_other',
    module: 'EXPENSES',
    moduleLabel: 'Beban Operasional',
    label: 'Beban Operasional Lain-Lain',
    defaultCode: '6-91-004',
    description: 'Pengeluaran operasional umum lainnya yang belum terklasifikasi',
    targetType: 'EXPENSE'
  },
  ap_supplier: {
    key: 'ap_supplier',
    module: 'EXPENSES',
    moduleLabel: 'Beban Operasional',
    label: 'Pelunasan Utang PBF / Supplier Obat',
    defaultCode: '2-11-001',
    description: 'Akun kewajiban utang usaha saat pelunasan faktur GRN supplier',
    targetType: 'LIABILITY'
  },
}

export const MODULE_OPTIONS = [
  { value: 'BILLING', label: 'Billing Kasir' },
  { value: 'HPP', label: 'HPP & Persediaan' },
  { value: 'STOCK_OUTFLOW', label: 'Pengeluaran Stok' },
  { value: 'EXPENSES', label: 'Beban Operasional' },
  { value: 'OTHER', label: 'Lainnya / Umum' },
]

export const EXPENSE_CATEGORY_MAPPING_KEY = {
  'Pembayaran Utang PBF / Supplier': 'ap_supplier',
  'Listrik': 'expense_electricity',
  'Air (PDAM)': 'expense_water',
  'Telepon & Internet': 'expense_internet',
  'Sewa Gedung / Bangunan': 'expense_rent',
  'Alat Tulis Kantor (ATK)': 'expense_atk',
  'Bahan Cetakan & Fotokopi': 'expense_print',
  'Kebersihan & Sanitasi': 'expense_clean',
  'Keamanan': 'expense_security',
  'Pemeliharaan Gedung': 'expense_maintenance_bldg',
  'Pemeliharaan Peralatan Medis': 'expense_maintenance_med',
  'Pemeliharaan IT & Komputer': 'expense_maintenance_it',
  'Iklan & Promosi': 'expense_marketing',
  'Gaji Dokter Tetap': 'expense_doctor_salary',
  'Gaji Perawat & Bidan': 'expense_nurse_salary',
  'Gaji Staff Administrasi': 'expense_admin_salary',
  'Tunjangan Karyawan': 'expense_allowance',
  'Lembur Karyawan': 'expense_overtime',
  'Konsumsi & Jamuan': 'expense_meal',
  'Parkir & Transportasi': 'expense_transport',
  'Beban Pajak & Perizinan': 'expense_tax',
  'Beban Admin Bank': 'expense_bank_admin',
  'Beban Lain-Lain': 'expense_other'
}

/**
 * Helper untuk mengekstrak objek raw account_mappings dari appSettings
 */
function extractRawMappings(appSettings) {
  let saved = appSettings?.account_mappings || {}
  if (typeof saved === 'string') {
    try {
      saved = JSON.parse(saved)
    } catch {
      saved = {}
    }
  }
  return (saved && typeof saved === 'object') ? saved : {}
}

/**
 * Mendapatkan mapping aktif saat ini yang digabung dengan setting dari appSettings
 * Mendukung pemetaan default, modifikasi, dan pemetaan kustom yang ditambahkan pengguna.
 */
export function getEffectiveAccountMappings(appSettings = {}) {
  const savedMappings = extractRawMappings(appSettings)
  const result = {}

  // 1. Muat pemetaan default, timpa jika sudah pernah diedit
  Object.keys(DEFAULT_ACCOUNT_MAPPINGS).forEach(k => {
    const def = DEFAULT_ACCOUNT_MAPPINGS[k]
    const saved = savedMappings[k]
    if (typeof saved === 'object' && saved !== null) {
      result[k] = {
        ...def,
        ...saved,
        isCustom: false,
        isModified: saved.accountCode !== def.defaultCode
      }
    } else if (typeof saved === 'string') {
      result[k] = {
        ...def,
        accountCode: saved,
        isCustom: false,
        isModified: saved !== def.defaultCode
      }
    } else {
      result[k] = {
        ...def,
        accountCode: def.defaultCode,
        isCustom: false,
        isModified: false
      }
    }
  })

  // 2. Muat pemetaan kustom yang ditambahkan oleh pengguna
  Object.keys(savedMappings).forEach(k => {
    if (!DEFAULT_ACCOUNT_MAPPINGS[k]) {
      const customItem = savedMappings[k]
      if (typeof customItem === 'object' && customItem !== null) {
        result[k] = {
          key: k,
          module: customItem.module || 'OTHER',
          moduleLabel: customItem.moduleLabel || MODULE_OPTIONS.find(m => m.value === customItem.module)?.label || 'Kustom',
          label: customItem.label || k,
          defaultCode: customItem.accountCode || '',
          accountCode: customItem.accountCode || '',
          description: customItem.description || '',
          targetType: customItem.targetType || 'EXPENSE',
          isCustom: true,
          isModified: false
        }
      } else if (typeof customItem === 'string') {
        result[k] = {
          key: k,
          module: 'OTHER',
          moduleLabel: 'Kustom',
          label: k,
          defaultCode: customItem,
          accountCode: customItem,
          description: '',
          targetType: 'EXPENSE',
          isCustom: true,
          isModified: false
        }
      }
    }
  })

  return result
}

/**
 * Mendapatkan kode akun COA aktif untuk kunci mapping tertentu
 */
export function getAccountCode(key, appSettings = {}, fallback = null) {
  if (!key) return fallback
  const savedMappings = extractRawMappings(appSettings)
  const val = savedMappings[key]
  if (typeof val === 'string' && val.trim()) return val.trim()
  if (typeof val === 'object' && val?.accountCode && val.accountCode.trim()) return val.accountCode.trim()
  if (DEFAULT_ACCOUNT_MAPPINGS[key]) return DEFAULT_ACCOUNT_MAPPINGS[key].defaultCode
  return fallback
}

/**
 * Helper untuk memeriksa status sinkronisasi antara dokumen transaksi dan jurnal Laba Rugi
 */
export function auditTransactionSync({
  billings = [],
  expenses = [],
  stockOutflows = [],
  journalEntries = [],
  journalItems = [],
  coa = [],
  dateFrom,
  dateTo,
  branchFilter = 'ALL'
}) {
  // 1. Filtered Posted Journals
  const postedJournals = journalEntries.filter(j =>
    j.status === 'POSTED' &&
    (!dateFrom || j.transactionDate >= dateFrom) &&
    (!dateTo || j.transactionDate <= dateTo) &&
    (branchFilter === 'ALL' || !j.branchId || j.branchId === branchFilter)
  )
  const postedJournalIds = new Set(postedJournals.map(j => j.id))

  // 2. Billing Transactions in period
  const relevantBillings = billings.filter(b => {
    const vDate = b.visitDate || b.visit_date
    const bBranch = b.branchId || b.branch_id
    return (!dateFrom || vDate >= dateFrom) &&
      (!dateTo || vDate <= dateTo) &&
      (branchFilter === 'ALL' || !bBranch || bBranch === branchFilter)
  })

  const paidBillings = relevantBillings.filter(b => b.status === 'PAID')
  const unpaidBillings = relevantBillings.filter(b => b.status === 'UNPAID' || b.status === 'DRAFT' || b.status === 'PENDING')

  const totalBillingPaidGrandTotal = paidBillings.reduce((sum, b) => sum + Number(b.grandTotal || b.grand_total || 0), 0)
  const totalBillingPaidServices = paidBillings.reduce((sum, b) => sum + Number(b.subtotalServices || b.subtotal_services || 0), 0)
  const totalBillingPaidPharmacy = paidBillings.reduce((sum, b) => sum + Number(b.subtotalPharmacy || b.subtotal_pharmacy || 0), 0)
  const totalBillingPaidPpn = paidBillings.reduce((sum, b) => sum + Number(b.ppnAmount || b.ppn_amount || 0), 0)
  const totalBillingPaidDiscount = paidBillings.reduce((sum, b) => sum + Number(b.discountAmount || b.discount_amount || 0), 0)
  const expectedBillingRevenue = (totalBillingPaidServices + totalBillingPaidPharmacy) - totalBillingPaidDiscount

  // 3. Stock Outflow Transactions in period
  const relevantOutflows = stockOutflows.filter(o => {
    const oDate = o.outflowDate || o.outflow_date
    const oBranch = o.branchId || o.branch_id
    return (!dateFrom || oDate >= dateFrom) &&
      (!dateTo || oDate <= dateTo) &&
      (branchFilter === 'ALL' || !oBranch || oBranch === branchFilter)
  })
  const postedOutflows = relevantOutflows.filter(o => o.status === 'POSTED')
  const totalOutflowValue = postedOutflows.reduce((sum, o) => sum + Number(o.totalValue || o.total_value || 0), 0)

  // 4. Expenses Transactions in period
  const relevantExpenses = expenses.filter(e => {
    const eDate = e.expenseDate || e.expense_date
    const eBranch = e.branchId || e.branch_id
    return (!dateFrom || eDate >= dateFrom) &&
      (!dateTo || eDate <= dateTo) &&
      (branchFilter === 'ALL' || !eBranch || eBranch === branchFilter)
  })
  const postedExpenses = relevantExpenses.filter(e => e.status === 'POSTED')
  const totalExpenseGross = postedExpenses.reduce((sum, e) => sum + Number(e.grossAmount || e.gross_amount || 0), 0)

  // 5. Recognized Journal Balances (from Income Statement formula)
  let journalRevenue = 0
  let journalHPP = 0
  let journalDoctorFee = 0
  let journalOutflowExpense = 0
  let journalGeneralExpense = 0

  journalItems.forEach(item => {
    if (!postedJournalIds.has(item.journalEntryId)) return
    const acc = coa.find(a => a.accountCode === item.accountCode)
    if (!acc || acc.isHeader) return

    const d = parseFloat(item.debit || 0)
    const c = parseFloat(item.credit || 0)

    // Revenue
    if (acc.accountType === 'REVENUE') {
      const net = acc.naturalBalance === 'DEBIT' ? (d - c) : (c - d)
      journalRevenue += net
    }
    // HPP
    else if (acc.accountType === 'EXPENSE' && (acc.accountCode.startsWith('5-') || (acc.accountGroup || '').toUpperCase().includes('HARGA POKOK') || (acc.accountGroup || '').toUpperCase().includes('HPP'))) {
      const net = acc.naturalBalance === 'CREDIT' ? (c - d) : (d - c)
      journalHPP += net
    }
    // Jasa Medis Dokter
    else if (acc.accountCode === '6-12-001' || acc.accountCode === '6-12-002') {
      const net = acc.naturalBalance === 'CREDIT' ? (c - d) : (d - c)
      journalDoctorFee += net
    }
    // Kerugian Persediaan / Stock Outflow
    else if (acc.accountCode.startsWith('6-18-')) {
      const net = acc.naturalBalance === 'CREDIT' ? (c - d) : (d - c)
      journalOutflowExpense += net
    }
    // General Operating Expense
    else if (acc.accountType === 'EXPENSE') {
      const net = acc.naturalBalance === 'CREDIT' ? (c - d) : (d - c)
      journalGeneralExpense += net
    }
  })

  return {
    billing: {
      paidCount: paidBillings.length,
      unpaidCount: unpaidBillings.length,
      totalPaidGrandTotal: totalBillingPaidGrandTotal,
      expectedRevenue: expectedBillingRevenue,
      journalRevenue,
      diff: journalRevenue - expectedBillingRevenue,
      isSynced: Math.abs(journalRevenue - expectedBillingRevenue) < 1
    },
    outflow: {
      postedCount: postedOutflows.length,
      totalValue: totalOutflowValue,
      journalOutflowExpense,
      diff: journalOutflowExpense - totalOutflowValue,
      isSynced: Math.abs(journalOutflowExpense - totalOutflowValue) < 1
    },
    expenses: {
      postedCount: postedExpenses.length,
      totalGross: totalExpenseGross,
      journalGeneralExpense,
      isSynced: postedExpenses.length === 0 || Math.abs(journalGeneralExpense - totalExpenseGross) < 1
    }
  }
}
