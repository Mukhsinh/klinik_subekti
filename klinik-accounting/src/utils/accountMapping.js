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
  billing_cash: {
    key: 'billing_cash',
    module: 'BILLING',
    moduleLabel: 'Billing Kasir',
    label: 'Kas Masuk Kasir (Tunai)',
    defaultCode: '1-11-002',
    description: 'Penerimaan pembayaran kasir pasien secara tunai fisik',
    targetType: 'ASSET'
  },
  billing_transfer: {
    key: 'billing_transfer',
    module: 'BILLING',
    moduleLabel: 'Billing Kasir',
    label: 'Penerimaan Kasir via Transfer Bank',
    defaultCode: '1-11-005',
    description: 'Penerimaan kasir pasien melalui transfer rekening bank (BCA/Mandiri/BRI)',
    targetType: 'ASSET'
  },
  billing_qris: {
    key: 'billing_qris',
    module: 'BILLING',
    moduleLabel: 'Billing Kasir',
    label: 'Penerimaan Kasir via QRIS Digital',
    defaultCode: '1-11-004',
    description: 'Penerimaan kasir pasien melalui pembayaran nontunai QRIS',
    targetType: 'ASSET'
  },
  billing_piutang_bpjs: {
    key: 'billing_piutang_bpjs',
    module: 'BILLING',
    moduleLabel: 'Billing Kasir',
    label: 'Piutang Klaim Jaminan BPJS',
    defaultCode: '1-12-001',
    description: 'Porsi tagihan klaim BPJS Kesehatan yang belum cair',
    targetType: 'ASSET'
  },
  billing_piutang_asuransi: {
    key: 'billing_piutang_asuransi',
    module: 'BILLING',
    moduleLabel: 'Billing Kasir',
    label: 'Piutang Klaim Asuransi Swasta',
    defaultCode: '1-12-002',
    description: 'Porsi tagihan klaim asuransi rekanan perusahaan yang belum dibayar',
    targetType: 'ASSET'
  },
  billing_ppn_output: {
    key: 'billing_ppn_output',
    module: 'BILLING',
    moduleLabel: 'Billing Kasir',
    label: 'Utang PPN Keluaran Kasir (11%)',
    defaultCode: '2-14-001',
    description: 'Pajak PPN 11% yang dipungut dari penjualan obat pasien',
    targetType: 'LIABILITY'
  },
  billing_pph21_payable: {
    key: 'billing_pph21_payable',
    module: 'BILLING',
    moduleLabel: 'Billing Kasir',
    label: 'Utang PPh 21 Dokter',
    defaultCode: '2-13-001',
    description: 'Potongan PPh 21 atas jasa dokter yang wajib disetorkan ke kas negara',
    targetType: 'LIABILITY'
  },
  billing_doctor_fee_payable: {
    key: 'billing_doctor_fee_payable',
    module: 'BILLING',
    moduleLabel: 'Billing Kasir',
    label: 'Utang Jasa Medis Dokter (Bersih)',
    defaultCode: '2-12-003',
    description: 'Kewajiban klinik membayarkan hak jasa medis bersih kepada dokter pemeriksa',
    targetType: 'LIABILITY'
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

// ══════════════════════════════════════════════════════════════
// 5. STRUKTUR DETAIL JURNAL OTOMATIS SISTEM (AUTO JOURNAL TEMPLATES)
// ══════════════════════════════════════════════════════════════
export const DEFAULT_AUTO_JOURNAL_TEMPLATES = {
  AJ_BILLING_CASH: {
    id: 'AJ_BILLING_CASH',
    name: 'Kasir Billing Pasien Umum (Tunai, QRIS, Transfer)',
    module: 'BILLING',
    moduleLabel: 'Billing Kasir',
    trigger: 'Kasir menyelesaikan pembayaran billing pasien umum status LUNAS (metode Tunai / QRIS / Transfer)',
    description: 'Mencatat kas masuk atas pendapatan layanan konsultasi, tindakan medis, laboratorium, obat & BHP, serta diskon pasien.',
    debits: [
      { code: '1-11-002', name: 'Kas Kasir / Penerimaan', note: 'Total uang kasir diterima (Grand Total)' },
      { code: '4-14-001', name: 'Potongan / Diskon Penjualan', note: 'Alokasi diskon pasien (jika diberikan)' }
    ],
    credits: [
      { code: '4-11-001', name: 'Pendapatan Konsultasi Dokter', note: 'Jasa pemeriksaan & konsultasi dokter' },
      { code: '4-11-003', name: 'Pendapatan Tindakan Medis & BHP', note: 'Tindakan medis keperawatan & bhp' },
      { code: '4-12-001', name: 'Pendapatan Laboratorium Medis', note: 'Pemeriksaan sampel lab & diagnostik' },
      { code: '4-13-001', name: 'Pendapatan Penjualan Obat Etikal', note: 'DPP penjualan obat paten resep dokter' },
      { code: '4-13-002', name: 'Pendapatan Penjualan Obat Bebas / OTC', note: 'DPP penjualan obat bebas & generik' },
      { code: '4-13-003', name: 'Pendapatan Penjualan BHP Pasien', note: 'DPP penjualan bahan medis habis pakai' },
      { code: '2-14-001', name: 'Utang PPN Keluaran', note: 'Pajak PPN 11% yang dipungut dari pasien (bila ada)' }
    ]
  },
  AJ_BILLING_BPJS: {
    id: 'AJ_BILLING_BPJS',
    name: 'Pelayanan Pasien Jaminan BPJS Kesehatan & Asuransi',
    module: 'BILLING',
    moduleLabel: 'Billing Kasir',
    trigger: 'Billing kasir dengan metode pembayaran klaim BPJS Kesehatan atau Asuransi rekanan',
    description: 'Mencatat porsi iuran tunai pasien dan porsi piutang klaim yang akan ditagihkan ke BPJS / Asuransi rekanan.',
    debits: [
      { code: '1-11-002', name: 'Kas Kasir / Penerimaan', note: 'Porsi iuran bayar tunai pasien (co-payment)' },
      { code: '1-12-001', name: 'Piutang Klaim BPJS Kesehatan', note: 'Porsi tagihan klaim BPJS Kesehatan' },
      { code: '1-12-002', name: 'Piutang Klaim Asuransi Swasta', note: 'Porsi tagihan klaim Asuransi rekanan' }
    ],
    credits: [
      { code: '4-11-001', name: 'Pendapatan Konsultasi Dokter', note: 'Pengakuan omzet konsultasi dokter BPJS' },
      { code: '4-11-003', name: 'Pendapatan Tindakan Medis & BHP', note: 'Pengakuan omzet tindakan medis jaminan' },
      { code: '4-13-001', name: 'Pendapatan Obat Etikal & Generik', note: 'Pengakuan omzet obat resep jaminan BPJS' }
    ]
  },
  AJ_BILLING_DOCTOR_FEE: {
    id: 'AJ_BILLING_DOCTOR_FEE',
    name: 'Pengakuan Hak Jasa Medis Dokter & PPh 21',
    module: 'BILLING',
    moduleLabel: 'Billing Kasir',
    trigger: 'Posting billing dengan keterlibatan dokter yang berhak atas bagi hasil jasa medis',
    description: 'Mencatat beban operasional bagi hasil jasa dokter, pemotongan pajak PPh 21, dan pengakuan utang fee bersih dokter.',
    debits: [
      { code: '6-12-001', name: 'Beban Bagi Hasil Jasa Medis Dokter', note: 'Total hak kotor (gross) jasa dokter' }
    ],
    credits: [
      { code: '2-13-001', name: 'Utang Pemotongan PPh 21 Dokter', note: 'Pajak penghasilan dokter yang dipotong klinik' },
      { code: '2-12-003', name: 'Utang Jasa Medis Dokter Bersih', note: 'Kewajiban bersih yang wajib dibayarkan ke dokter' }
    ]
  },
  AJ_BILLING_COGS: {
    id: 'AJ_BILLING_COGS',
    name: 'HPP Penjualan Obat & Pengurangan Persediaan (COGS FIFO)',
    module: 'HPP',
    moduleLabel: 'HPP & Persediaan',
    trigger: 'Kasir menyelesaikan resep obat / BHP yang otomatis mendepresi batch stok dengan metode FIFO',
    description: 'Mencatat Beban Pokok Penjualan (HPP) modal beli obat/BHP dan mengurangi nilai buku aset persediaan apotek.',
    debits: [
      { code: '5-11-001', name: 'HPP Penjualan Obat Paten / Etikal', note: 'Nilai pokok persediaan obat paten terjual' },
      { code: '5-11-002', name: 'HPP Penjualan Obat Generik / OTC', note: 'Nilai pokok persediaan obat bebas terjual' },
      { code: '5-11-003', name: 'HPP Bahan Habis Pakai (BHP)', note: 'Nilai pokok BHP medis yang digunakan di kasir' }
    ],
    credits: [
      { code: '1-13-001', name: 'Persediaan Obat Paten / Etikal', note: 'Pengurangan nilai persediaan obat paten' },
      { code: '1-13-002', name: 'Persediaan Obat Generik / OTC', note: 'Pengurangan nilai persediaan obat bebas' },
      { code: '1-13-003', name: 'Persediaan BHP Medis', note: 'Pengurangan nilai persediaan BHP apotek' }
    ]
  },
  AJ_GRN_PURCHASE: {
    id: 'AJ_GRN_PURCHASE',
    name: 'Penerimaan Faktur Pembelian Obat dari Supplier PBF (GRN)',
    module: 'HPP',
    moduleLabel: 'HPP & Persediaan',
    trigger: 'Penerimaan barang dan faktur distributor PBF diposting di modul Goods Receipt (GRN)',
    description: 'Mencatat penambahan nilai aset persediaan obat di gudang farmasi, PPN masukan, dan timbulnya kewajiban utang usaha tempo.',
    debits: [
      { code: '1-13-001', name: 'Persediaan Obat Paten / Etikal', note: 'Nilai pembelian obat paten masuk gudang' },
      { code: '1-13-002', name: 'Persediaan Obat Generik / OTC', note: 'Nilai pembelian obat bebas masuk gudang' },
      { code: '1-13-003', name: 'Persediaan BHP Medis', note: 'Nilai pembelian bahan medis masuk gudang' },
      { code: '1-14-001', name: 'PPN Masukan Dibayar Dimuka', note: 'Pajak masukan 11% faktur pajak PBF (bila PKP)' }
    ],
    credits: [
      { code: '2-11-001', name: 'Utang Usaha PBF / Supplier Obat', note: 'Utang dagang pembelian tempo ke distributor farmasi' },
      { code: '1-11-001', name: 'Kas Utama / Bank BCA', note: 'Jika pembelian dilakukan secara tunai / COD' }
    ]
  },
  AJ_STOCK_OUTFLOW: {
    id: 'AJ_STOCK_OUTFLOW',
    name: 'Pengeluaran Stok Non-Billing (Internal, Expired, Donasi, Sampel)',
    module: 'STOCK_OUTFLOW',
    moduleLabel: 'Pengeluaran Stok',
    trigger: 'Posting berita acara pengeluaran stok di modul /stock-outflow',
    description: 'Mencatat beban operasional pemakaian internal, kerugian obat rusak/kadaluarsa, donasi sosial, atau promosi sampel.',
    debits: [
      { code: '6-18-001', name: 'Beban Pemakaian Internal / Kerugian Expired', note: 'Beban pemakaian internal atau kerugian expired' },
      { code: '6-17-001', name: 'Beban Sampel & Promosi Obat', note: 'Beban pemberian sampel / edukasi' },
      { code: '6-91-002', name: 'Beban Bantuan Sosial & Donasi Medis', note: 'Beban bakti sosial / donasi kemanusiaan' }
    ],
    credits: [
      { code: '1-13-001', name: 'Persediaan Obat Paten / Etikal', note: 'Pengurangan kuantitas persediaan obat paten' },
      { code: '1-13-002', name: 'Persediaan Obat Generik / OTC', note: 'Pengurangan kuantitas persediaan obat generik' },
      { code: '1-13-003', name: 'Persediaan BHP Medis', note: 'Pengurangan kuantitas persediaan bahan medis' }
    ]
  },
  AJ_EXPENSE_AP_SETTLEMENT: {
    id: 'AJ_EXPENSE_AP_SETTLEMENT',
    name: 'Pelunasan Utang Usaha Faktur Supplier PBF',
    module: 'EXPENSES',
    moduleLabel: 'Beban Operasional',
    trigger: 'Bagian keuangan melakukan pembayaran faktur utang PBF di modul /expenses',
    description: 'Mencatat pelunasan kewajiban utang dagang farmasi dan pengeluaran kas atau saldo rekening bank operasional.',
    debits: [
      { code: '2-11-001', name: 'Utang Usaha PBF / Supplier Obat', note: 'Pelunasan saldo faktur utang distributor farmasi' }
    ],
    credits: [
      { code: '1-11-003', name: 'Bank BCA Operasional', note: 'Pengurangan saldo bank transfer pembayaran' },
      { code: '1-11-001', name: 'Kas Utama Kasir', note: 'Pengurangan saldo kas jika dibayar tunai' }
    ]
  },
  AJ_EXPENSE_OPERATIONAL: {
    id: 'AJ_EXPENSE_OPERATIONAL',
    name: 'Pembayaran Beban Operasional Umum (Listrik, Air, Sewa, Gaji)',
    module: 'EXPENSES',
    moduleLabel: 'Beban Operasional',
    trigger: 'Pencatatan pengeluaran biaya operasional rutin di modul /expenses',
    description: 'Mencatat beban operasional klinik dan pengeluaran uang kas / bank.',
    debits: [
      { code: '6-13-003', name: 'Beban Listrik (PLN)', note: 'Beban utilitas pembayaran listrik klinik' },
      { code: '6-13-004', name: 'Beban Air (PDAM)', note: 'Beban utilitas pembayaran air bersih' },
      { code: '6-13-005', name: 'Beban Telepon & Internet', note: 'Beban internet fiber & komunikasi' },
      { code: '6-14-001', name: 'Beban Sewa Gedung', note: 'Beban sewa tempat usaha klinik' },
      { code: '6-11-001', name: 'Beban Gaji Paramedis & Staf', note: 'Payroll gaji pokok tenaga kesehatan & staf' }
    ],
    credits: [
      { code: '1-11-001', name: 'Kas Utama Kasir', note: 'Pengeluaran uang tunai kas kecil' },
      { code: '1-11-003', name: 'Bank BCA Operasional', note: 'Pengeluaran via transfer bank' }
    ]
  },
  AJ_ASSET_ACQUISITION: {
    id: 'AJ_ASSET_ACQUISITION',
    name: 'Perolehan Aset Tetap Medis / Non-Medis Baru',
    module: 'ASSETS',
    moduleLabel: 'Aset Tetap',
    trigger: 'Registrasi perolehan aset tetap baru di modul /assets',
    description: 'Mencatat penambahan nilai perolehan aset tetap peralatan medis/gedung/kendaraan dan pengeluaran kas atau utang aset.',
    debits: [
      { code: '1-21-001', name: 'Aset Tetap Peralatan Medis & Lab', note: 'Nilai perolehan alat medis baru' },
      { code: '1-21-003', name: 'Aset Tetap Peralatan IT & Komputer', note: 'Nilai perolehan komputer & server' },
      { code: '1-21-004', name: 'Aset Tetap Kendaraan Operasional', note: 'Nilai perolehan kendaraan klinik' }
    ],
    credits: [
      { code: '1-11-003', name: 'Bank BCA Operasional', note: 'Pembayaran transfer pembelian tunai' },
      { code: '2-21-001', name: 'Utang Pembelian Aset Jangka Panjang', note: 'Kewajiban jika dibeli secara tempo / kredit' }
    ]
  },
  AJ_ASSET_DEPRECIATION: {
    id: 'AJ_ASSET_DEPRECIATION',
    name: 'Penyusutan Bulanan Aset Tetap (Depresiasi Garis Lurus)',
    module: 'ASSETS',
    moduleLabel: 'Aset Tetap',
    trigger: 'Eksekusi kalkulasi penyusutan aset tetap bulanan di modul /assets',
    description: 'Mencatat pengakuan beban depresiasi peralatan medis/bangunan dan menambah akumulasi penyusutan.',
    debits: [
      { code: '6-15-001', name: 'Beban Penyusutan Peralatan Medis', note: 'Alokasi beban depresiasi peralatan medis' },
      { code: '6-15-002', name: 'Beban Penyusutan Bangunan Gedung', note: 'Alokasi beban depresiasi gedung tempat usaha' }
    ],
    credits: [
      { code: '1-22-001', name: 'Akumulasi Penyusutan Peralatan Medis', note: 'Kontra-aset pengurang nilai buku alat' },
      { code: '1-22-002', name: 'Akumulasi Penyusutan Bangunan Gedung', note: 'Kontra-aset pengurang nilai buku gedung' }
    ]
  }
}

// ══════════════════════════════════════════════════════════════
// 6. PEMETAAN AKUN NERACA (BALANCE SHEET MAPPINGS)
// ══════════════════════════════════════════════════════════════
export const DEFAULT_BALANCE_SHEET_MAPPINGS = {
  bs_cash_register: {
    key: 'bs_cash_register',
    group: 'ASET LANCAR',
    label: 'Kas Kasir & Kas Kecil (Petty Cash)',
    defaultCode: '1-11-001',
    naturalBalance: 'DEBIT',
    description: 'Uang tunai fisik di laci kasir dan kas kecil operasional harian'
  },
  bs_cash_petty: {
    key: 'bs_cash_petty',
    group: 'ASET LANCAR',
    label: 'Kas Operasional Klinik',
    defaultCode: '1-11-002',
    naturalBalance: 'DEBIT',
    description: 'Saldo kas brankas untuk operasional dan cadangan kas klinik'
  },
  bs_bank_bca: {
    key: 'bs_bank_bca',
    group: 'ASET LANCAR',
    label: 'Rekening Bank BCA Operasional',
    defaultCode: '1-11-003',
    naturalBalance: 'DEBIT',
    description: 'Rekening giro/tabungan BCA untuk penampungan transfer dan operasional utama'
  },
  bs_bank_mandiri: {
    key: 'bs_bank_mandiri',
    group: 'ASET LANCAR',
    label: 'Rekening Bank Mandiri & QRIS',
    defaultCode: '1-11-004',
    naturalBalance: 'DEBIT',
    description: 'Rekening penampungan pembayaran QRIS, EDC, dan transfer pasien'
  },
  bs_ar_patient: {
    key: 'bs_ar_patient',
    group: 'ASET LANCAR',
    label: 'Piutang Pasien Umum',
    defaultCode: '1-12-001',
    naturalBalance: 'DEBIT',
    description: 'Tagihan tertunda atau pembayaran tempo pasien umum'
  },
  bs_ar_bpjs: {
    key: 'bs_ar_bpjs',
    group: 'ASET LANCAR',
    label: 'Piutang Klaim BPJS Kesehatan',
    defaultCode: '1-12-002',
    naturalBalance: 'DEBIT',
    description: 'Klaim pelayanan pasien peserta BPJS yang belum cair dari kantor BPJS'
  },
  bs_ar_insurance: {
    key: 'bs_ar_insurance',
    group: 'ASET LANCAR',
    label: 'Piutang Asuransi Rekanan Swasta',
    defaultCode: '1-12-003',
    naturalBalance: 'DEBIT',
    description: 'Tagihan klaim jaminan kesehatan asuransi perusahaan swasta'
  },
  bs_inv_ethical: {
    key: 'bs_inv_ethical',
    group: 'ASET LANCAR',
    label: 'Persediaan Obat Paten / Etikal',
    defaultCode: '1-13-001',
    naturalBalance: 'DEBIT',
    description: 'Nilai persediaan obat paten / resep dokter di instalasi farmasi'
  },
  bs_inv_otc: {
    key: 'bs_inv_otc',
    group: 'ASET LANCAR',
    label: 'Persediaan Obat Bebas / OTC / Generik',
    defaultCode: '1-13-002',
    naturalBalance: 'DEBIT',
    description: 'Nilai persediaan obat bebas, suplemen, dan obat generik'
  },
  bs_inv_bhp: {
    key: 'bs_inv_bhp',
    group: 'ASET LANCAR',
    label: 'Persediaan Bahan Medis Habis Pakai (BHP)',
    defaultCode: '1-13-003',
    naturalBalance: 'DEBIT',
    description: 'Nilai persediaan spuit, jarum, kassa, infus, dan alat habis pakai'
  },
  bs_prepaid_expenses: {
    key: 'bs_prepaid_expenses',
    group: 'ASET LANCAR',
    label: 'Beban Dibayar Dimuka & Sewa Dimuka',
    defaultCode: '1-14-001',
    naturalBalance: 'DEBIT',
    description: 'Uang muka sewa gedung dan asuransi operasional yang belum terakru'
  },
  bs_prepaid_vat: {
    key: 'bs_prepaid_vat',
    group: 'ASET LANCAR',
    label: 'PPN Masukan Dibayar Dimuka',
    defaultCode: '1-14-002',
    naturalBalance: 'DEBIT',
    description: 'Pajak masukan atas pembelian faktur PBF yang dapat dikreditkan'
  },
  bs_fa_medical: {
    key: 'bs_fa_medical',
    group: 'ASET TIDAK LANCAR',
    label: 'Aset Tetap Peralatan Medis & Laboratorium',
    defaultCode: '1-21-001',
    naturalBalance: 'DEBIT',
    description: 'Harga perolehan alat USG, EKG, dental unit, mikroskop lab, dan autoklaf'
  },
  bs_fa_building: {
    key: 'bs_fa_building',
    group: 'ASET TIDAK LANCAR',
    label: 'Gedung & Bangunan Klinik',
    defaultCode: '1-21-002',
    naturalBalance: 'DEBIT',
    description: 'Harga perolehan bangunan fisik ruko/gedung klinik'
  },
  bs_fa_vehicle: {
    key: 'bs_fa_vehicle',
    group: 'ASET TIDAK LANCAR',
    label: 'Kendaraan Ambulans & Operasional',
    defaultCode: '1-21-003',
    naturalBalance: 'DEBIT',
    description: 'Harga perolehan mobil ambulans dan motor kurir farmasi'
  },
  bs_fa_it: {
    key: 'bs_fa_it',
    group: 'ASET TIDAK LANCAR',
    label: 'Peralatan IT, Komputer & Server',
    defaultCode: '1-21-004',
    naturalBalance: 'DEBIT',
    description: 'Harga perolehan komputer kasir, server rekam medis, dan printer barcode'
  },
  bs_acc_depr: {
    key: 'bs_acc_depr',
    group: 'ASET TIDAK LANCAR',
    label: 'Akumulasi Penyusutan Aset Tetap (Kontra Aset)',
    defaultCode: '1-22-001',
    naturalBalance: 'CREDIT',
    description: 'Total akumulasi penyusutan yang mengurangi nilai buku aset tetap'
  },
  bs_ap_pbf: {
    key: 'bs_ap_pbf',
    group: 'LIABILITAS JANGKA PENDEK',
    label: 'Utang Usaha ke Distributor PBF / Supplier Obat',
    defaultCode: '2-11-001',
    naturalBalance: 'CREDIT',
    description: 'Kewajiban pembayaran faktur tempo pembelian obat ke pedagang besar farmasi'
  },
  bs_ap_doctor: {
    key: 'bs_ap_doctor',
    group: 'LIABILITAS JANGKA PENDEK',
    label: 'Utang Biaya Jasa Medis Dokter',
    defaultCode: '2-12-001',
    naturalBalance: 'CREDIT',
    description: 'Akrual hak bagi hasil jasa medis dokter yang belum dibayarkan'
  },
  bs_ap_salary: {
    key: 'bs_ap_salary',
    group: 'LIABILITAS JANGKA PENDEK',
    label: 'Utang Gaji & Honor Paramedis / Staf',
    defaultCode: '2-12-002',
    naturalBalance: 'CREDIT',
    description: 'Akrual kewajiban gaji perawat, bidan, dan staf administrasi'
  },
  bs_tax_ppn: {
    key: 'bs_tax_ppn',
    group: 'LIABILITAS JANGKA PENDEK',
    label: 'Utang Pajak PPN Keluaran',
    defaultCode: '2-13-001',
    naturalBalance: 'CREDIT',
    description: 'Pajak PPN 11% yang telah dipungut kasir dan harus disetor ke kas negara'
  },
  bs_tax_pph21: {
    key: 'bs_tax_pph21',
    group: 'LIABILITAS JANGKA PENDEK',
    label: 'Utang Pajak PPh 21 Dokter & Karyawan',
    defaultCode: '2-13-002',
    naturalBalance: 'CREDIT',
    description: 'Pemotongan PPh pasal 21 dokter dan gaji karyawan yang wajib disetor'
  },
  bs_loan_bank: {
    key: 'bs_loan_bank',
    group: 'LIABILITAS JANGKA PANJANG',
    label: 'Utang Bank Investasi Jangka Panjang',
    defaultCode: '2-21-001',
    naturalBalance: 'CREDIT',
    description: 'Pinjaman modal kerja atau kredit investasi perbankan jangka panjang'
  },
  bs_eq_capital: {
    key: 'bs_eq_capital',
    group: 'EKUITAS',
    label: 'Modal Disetor Pemilik Klinik',
    defaultCode: '3-11-001',
    naturalBalance: 'CREDIT',
    description: 'Setoran modal awal para pendiri atau pemilik klinik'
  },
  bs_eq_retained: {
    key: 'bs_eq_retained',
    group: 'EKUITAS',
    label: 'Laba Ditahan Tahun Sebelumnya',
    defaultCode: '3-12-001',
    naturalBalance: 'CREDIT',
    description: 'Akumulasi laba bersih klinik yang tidak dibagikan dari tahun buku sebelumnya'
  },
  bs_eq_current: {
    key: 'bs_eq_current',
    group: 'EKUITAS',
    label: 'Laba / (Rugi) Periode Berjalan',
    defaultCode: '3-12-002',
    naturalBalance: 'CREDIT',
    description: 'Hasil kinerja laba atau rugi bersih tahun buku yang sedang berjalan'
  },
  bs_eq_prive: {
    key: 'bs_eq_prive',
    group: 'EKUITAS',
    label: 'Prive / Pengambilan Pribadi Pemilik',
    defaultCode: '3-13-001',
    naturalBalance: 'DEBIT',
    description: 'Penarikan dana atau pembagian deviden pribadi oleh pemilik klinik'
  }
}

// ══════════════════════════════════════════════════════════════
// 7. PEMETAAN LAPORAN ARUS KAS (CASH FLOW MAPPINGS)
// ══════════════════════════════════════════════════════════════
export const DEFAULT_CASH_FLOW_MAPPINGS = {
  cf_inflow_patient: {
    key: 'cf_inflow_patient',
    section: 'OPERASI',
    sectionLabel: 'Aktivitas Operasi',
    flowType: 'INFLOW',
    label: 'Penerimaan Kas dari Pasien Billing Kasir',
    defaultCode: '1-11-002',
    description: 'Aliran kas masuk dari transaksi pelayanan pasien di kasir'
  },
  cf_inflow_bpjs: {
    key: 'cf_inflow_bpjs',
    section: 'OPERASI',
    sectionLabel: 'Aktivitas Operasi',
    flowType: 'INFLOW',
    label: 'Penerimaan Pencairan Klaim BPJS Kesehatan',
    defaultCode: '1-12-001',
    description: 'Penerimaan dana pencairan piutang klaim dari BPJS Kesehatan'
  },
  cf_inflow_insurance: {
    key: 'cf_inflow_insurance',
    section: 'OPERASI',
    sectionLabel: 'Aktivitas Operasi',
    flowType: 'INFLOW',
    label: 'Penerimaan Pembayaran Klaim Asuransi Swasta',
    defaultCode: '1-12-002',
    description: 'Penerimaan pencairan piutang klaim dari asuransi rekanan'
  },
  cf_outflow_pbf: {
    key: 'cf_outflow_pbf',
    section: 'OPERASI',
    sectionLabel: 'Aktivitas Operasi',
    flowType: 'OUTFLOW',
    label: 'Pembayaran Kas Faktur Supplier PBF / Obat',
    defaultCode: '2-11-001',
    description: 'Pengeluaran kas untuk pelunasan utang dagang distributor obat'
  },
  cf_outflow_doctor_fee: {
    key: 'cf_outflow_doctor_fee',
    section: 'OPERASI',
    sectionLabel: 'Aktivitas Operasi',
    flowType: 'OUTFLOW',
    label: 'Pembayaran Kas Bagi Hasil Jasa Medis Dokter',
    defaultCode: '6-12-001',
    description: 'Pengeluaran kas untuk fee jasa medis dokter umum dan spesialis'
  },
  cf_outflow_salary: {
    key: 'cf_outflow_salary',
    section: 'OPERASI',
    sectionLabel: 'Aktivitas Operasi',
    flowType: 'OUTFLOW',
    label: 'Pembayaran Kas Gaji Paramedis & Staf',
    defaultCode: '6-11-002',
    description: 'Pengeluaran kas untuk gaji perawat, bidan, dan staf administrasi'
  },
  cf_outflow_utilities: {
    key: 'cf_outflow_utilities',
    section: 'OPERASI',
    sectionLabel: 'Aktivitas Operasi',
    flowType: 'OUTFLOW',
    label: 'Pembayaran Biaya Operasional, Listrik & Air',
    defaultCode: '6-13-003',
    description: 'Pengeluaran kas untuk pembayaran tagihan PLN, PDAM, dan internet'
  },
  cf_outflow_rent: {
    key: 'cf_outflow_rent',
    section: 'OPERASI',
    sectionLabel: 'Aktivitas Operasi',
    flowType: 'OUTFLOW',
    label: 'Pembayaran Sewa Tempat & Gedung Klinik',
    defaultCode: '6-14-001',
    description: 'Pengeluaran kas untuk sewa gedung klinik dan tempat parkir'
  },
  cf_outflow_tax: {
    key: 'cf_outflow_tax',
    section: 'OPERASI',
    sectionLabel: 'Aktivitas Operasi',
    flowType: 'OUTFLOW',
    label: 'Pembayaran Kas Setoran Pajak (PPN & PPh)',
    defaultCode: '2-13-001',
    description: 'Pengeluaran kas penyetoran pajak PPN dan PPh ke kas negara'
  },
  cf_outflow_fa_medical: {
    key: 'cf_outflow_fa_medical',
    section: 'INVESTASI',
    sectionLabel: 'Aktivitas Investasi',
    flowType: 'OUTFLOW',
    label: 'Pengeluaran Kas Pembelian Alat Medis & Diagnostik',
    defaultCode: '1-21-001',
    description: 'Aliran kas keluar investasi pengadaan peralatan medis klinik'
  },
  cf_outflow_fa_bldg: {
    key: 'cf_outflow_fa_bldg',
    section: 'INVESTASI',
    sectionLabel: 'Aktivitas Investasi',
    flowType: 'OUTFLOW',
    label: 'Pengeluaran Kas Renovasi & Perluasan Gedung',
    defaultCode: '1-21-002',
    description: 'Aliran kas keluar investasi pengembangan ruang poli & gedung'
  },
  cf_inflow_fa_sale: {
    key: 'cf_inflow_fa_sale',
    section: 'INVESTASI',
    sectionLabel: 'Aktivitas Investasi',
    flowType: 'INFLOW',
    label: 'Penerimaan Kas Penjualan Aset Medis Bekas',
    defaultCode: '8-91-001',
    description: 'Aliran kas masuk pelepasan atau penjualan alat medis lama'
  },
  cf_inflow_capital: {
    key: 'cf_inflow_capital',
    section: 'PENDANAAN',
    sectionLabel: 'Aktivitas Pendanaan',
    flowType: 'INFLOW',
    label: 'Penyetoran Tambahan Modal oleh Pemilik / Investor',
    defaultCode: '3-11-001',
    description: 'Aliran kas masuk setoran modal dari pemilik klinik'
  },
  cf_outflow_prive: {
    key: 'cf_outflow_prive',
    section: 'PENDANAAN',
    sectionLabel: 'Aktivitas Pendanaan',
    flowType: 'OUTFLOW',
    label: 'Penarikan Kas Prive / Deviden oleh Pemilik',
    defaultCode: '3-13-001',
    description: 'Aliran kas keluar penarikan prive pribadi oleh pemilik klinik'
  },
  cf_inflow_bank_loan: {
    key: 'cf_inflow_bank_loan',
    section: 'PENDANAAN',
    sectionLabel: 'Aktivitas Pendanaan',
    flowType: 'INFLOW',
    label: 'Penerimaan Kas Pinjaman Bank / Kredit Investasi',
    defaultCode: '2-21-001',
    description: 'Penerimaan pencairan pinjaman bank untuk pembiayaan klinik'
  },
  cf_outflow_bank_loan: {
    key: 'cf_outflow_bank_loan',
    section: 'PENDANAAN',
    sectionLabel: 'Aktivitas Pendanaan',
    flowType: 'OUTFLOW',
    label: 'Pembayaran Angsuran Pokok Pinjaman Bank',
    defaultCode: '2-21-001',
    description: 'Pengeluaran kas untuk mencicil pokok utang pinjaman perbankan'
  }
}

/**
 * Helper untuk mengekstrak objek raw dari appSettings
 */
function extractRawSettings(appSettings, key) {
  let saved = appSettings?.[key] || {}
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
 * Helper untuk mengekstrak objek raw account_mappings dari appSettings
 */
function extractRawMappings(appSettings) {
  return extractRawSettings(appSettings, 'account_mappings')
}

/**
 * Mendapatkan struktur template jurnal otomatis yang digabung dengan setting dari database
 */
export function getEffectiveAutoJournalTemplates(appSettings = {}) {
  const saved = extractRawSettings(appSettings, 'auto_journal_templates')
  const result = {}

  Object.keys(DEFAULT_AUTO_JOURNAL_TEMPLATES).forEach(k => {
    const def = DEFAULT_AUTO_JOURNAL_TEMPLATES[k]
    const custom = saved[k]
    if (custom && typeof custom === 'object') {
      result[k] = { ...def, ...custom, isCustom: false, isModified: true }
    } else {
      result[k] = { ...def, isCustom: false, isModified: false }
    }
  })

  // Sertakan jika ada template kustom baru dari user
  Object.keys(saved).forEach(k => {
    if (!DEFAULT_AUTO_JOURNAL_TEMPLATES[k]) {
      result[k] = { ...saved[k], isCustom: true, isModified: false }
    }
  })

  return result
}

/**
 * Mendapatkan mapping neraca aktif yang digabung dengan setting dari database
 */
export function getEffectiveBalanceSheetMappings(appSettings = {}) {
  const saved = extractRawSettings(appSettings, 'balance_sheet_mappings')
  const result = {}

  Object.keys(DEFAULT_BALANCE_SHEET_MAPPINGS).forEach(k => {
    const def = DEFAULT_BALANCE_SHEET_MAPPINGS[k]
    const s = saved[k]
    if (typeof s === 'object' && s !== null) {
      result[k] = {
        ...def,
        ...s,
        accountCode: s.accountCode || def.defaultCode,
        isCustom: false,
        isModified: (s.accountCode || def.defaultCode) !== def.defaultCode
      }
    } else if (typeof s === 'string' && s.trim()) {
      result[k] = {
        ...def,
        accountCode: s.trim(),
        isCustom: false,
        isModified: s.trim() !== def.defaultCode
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

  // Kustom dari pengguna
  Object.keys(saved).forEach(k => {
    if (!DEFAULT_BALANCE_SHEET_MAPPINGS[k]) {
      const c = saved[k]
      result[k] = {
        key: k,
        group: c.group || 'ASET LANCAR',
        label: c.label || k,
        defaultCode: c.accountCode || '',
        accountCode: c.accountCode || '',
        naturalBalance: c.naturalBalance || 'DEBIT',
        description: c.description || '',
        isCustom: true,
        isModified: false
      }
    }
  })

  return result
}

/**
 * Mendapatkan mapping arus kas aktif yang digabung dengan setting dari database
 */
export function getEffectiveCashFlowMappings(appSettings = {}) {
  const saved = extractRawSettings(appSettings, 'cash_flow_mappings')
  const result = {}

  Object.keys(DEFAULT_CASH_FLOW_MAPPINGS).forEach(k => {
    const def = DEFAULT_CASH_FLOW_MAPPINGS[k]
    const s = saved[k]
    if (typeof s === 'object' && s !== null) {
      result[k] = {
        ...def,
        ...s,
        accountCode: s.accountCode || def.defaultCode,
        isCustom: false,
        isModified: (s.accountCode || def.defaultCode) !== def.defaultCode
      }
    } else if (typeof s === 'string' && s.trim()) {
      result[k] = {
        ...def,
        accountCode: s.trim(),
        isCustom: false,
        isModified: s.trim() !== def.defaultCode
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

  // Kustom dari pengguna
  Object.keys(saved).forEach(k => {
    if (!DEFAULT_CASH_FLOW_MAPPINGS[k]) {
      const c = saved[k]
      result[k] = {
        key: k,
        section: c.section || 'OPERASI',
        sectionLabel: c.sectionLabel || 'Aktivitas Operasi',
        flowType: c.flowType || 'INFLOW',
        label: c.label || k,
        defaultCode: c.accountCode || '',
        accountCode: c.accountCode || '',
        description: c.description || '',
        isCustom: true,
        isModified: false
      }
    }
  })

  return result
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
    // Beban Persediaan / Stock Outflow
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
