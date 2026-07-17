-- ============================================================
-- BAGAN AKUN STANDAR KLINIK MEDIS ANTIGRAVITY
-- Mengacu: PSAK, ISAK 35, PMK 174/2021, PER-2/PJ/2024
-- Format Kode: X-XX-XXX
-- ============================================================

INSERT INTO chart_of_accounts (account_code, account_name, account_type, account_group, account_subgroup, natural_balance, is_header, sort_order) VALUES

-- ============================================================
-- 1. ASET (ASSET)
-- ============================================================
('1', 'ASET', 'ASSET', 'ASET', NULL, 'DEBIT', TRUE, 100),

-- 1.1 Aset Lancar
('1-1', 'Aset Lancar', 'ASSET', 'ASET LANCAR', NULL, 'DEBIT', TRUE, 110),
('1-11', 'Kas dan Bank', 'ASSET', 'ASET LANCAR', 'Kas dan Bank', 'DEBIT', TRUE, 111),
('1-11-001', 'Kas Kecil', 'ASSET', 'ASET LANCAR', 'Kas dan Bank', 'DEBIT', FALSE, 112),
('1-11-002', 'Kas Kasir Utama', 'ASSET', 'ASET LANCAR', 'Kas dan Bank', 'DEBIT', FALSE, 113),
('1-11-003', 'Bank BCA - Operasional', 'ASSET', 'ASET LANCAR', 'Kas dan Bank', 'DEBIT', FALSE, 114),
('1-11-004', 'Bank Mandiri - Payroll', 'ASSET', 'ASET LANCAR', 'Kas dan Bank', 'DEBIT', FALSE, 115),
('1-11-005', 'Bank BNI - BPJS', 'ASSET', 'ASET LANCAR', 'Kas dan Bank', 'DEBIT', FALSE, 116),

-- 1.12 Piutang
('1-12', 'Piutang Usaha', 'ASSET', 'ASET LANCAR', 'Piutang', 'DEBIT', TRUE, 120),
('1-12-001', 'Piutang Klaim BPJS Kesehatan', 'ASSET', 'ASET LANCAR', 'Piutang', 'DEBIT', FALSE, 121),
('1-12-002', 'Piutang Klaim Asuransi Swasta', 'ASSET', 'ASET LANCAR', 'Piutang', 'DEBIT', FALSE, 122),
('1-12-003', 'Piutang Pasien Umum', 'ASSET', 'ASET LANCAR', 'Piutang', 'DEBIT', FALSE, 123),
('1-12-004', 'Piutang Perusahaan Rekanan', 'ASSET', 'ASET LANCAR', 'Piutang', 'DEBIT', FALSE, 124),

-- 1.13 Persediaan
('1-13', 'Persediaan', 'ASSET', 'ASET LANCAR', 'Persediaan', 'DEBIT', TRUE, 130),
('1-13-001', 'Persediaan Obat Etikal (Rx)', 'ASSET', 'ASET LANCAR', 'Persediaan', 'DEBIT', FALSE, 131),
('1-13-002', 'Persediaan Obat OTC', 'ASSET', 'ASET LANCAR', 'Persediaan', 'DEBIT', FALSE, 132),
('1-13-003', 'Persediaan BHP Medis', 'ASSET', 'ASET LANCAR', 'Persediaan', 'DEBIT', FALSE, 133),
('1-13-004', 'Persediaan Alat Medis Pakai Habis', 'ASSET', 'ASET LANCAR', 'Persediaan', 'DEBIT', FALSE, 134),
('1-13-005', 'Persediaan Vaksin', 'ASSET', 'ASET LANCAR', 'Persediaan', 'DEBIT', FALSE, 135),

-- 1.14 Aset Lancar Lainnya
('1-14', 'Aset Lancar Lainnya', 'ASSET', 'ASET LANCAR', 'Aset Lancar Lainnya', 'DEBIT', TRUE, 140),
('1-14-001', 'Uang Muka Pembelian', 'ASSET', 'ASET LANCAR', 'Aset Lancar Lainnya', 'DEBIT', FALSE, 141),
('1-14-002', 'Pajak Dibayar Dimuka (PPN Masukan)', 'ASSET', 'ASET LANCAR', 'Aset Lancar Lainnya', 'DEBIT', FALSE, 142),
('1-14-003', 'PPh 25 Dibayar Dimuka', 'ASSET', 'ASET LANCAR', 'Aset Lancar Lainnya', 'DEBIT', FALSE, 143),
('1-14-004', 'Biaya Dibayar Dimuka', 'ASSET', 'ASET LANCAR', 'Aset Lancar Lainnya', 'DEBIT', FALSE, 144);

-- 1.2 Aset Tidak Lancar
INSERT INTO chart_of_accounts (account_code, account_name, account_type, account_group, account_subgroup, natural_balance, is_header, sort_order) VALUES
('1-2', 'Aset Tidak Lancar', 'ASSET', 'ASET TIDAK LANCAR', NULL, 'DEBIT', TRUE, 150),
('1-21', 'Aset Tetap', 'ASSET', 'ASET TIDAK LANCAR', 'Aset Tetap', 'DEBIT', TRUE, 151),
('1-21-001', 'Tanah', 'ASSET', 'ASET TIDAK LANCAR', 'Aset Tetap', 'DEBIT', FALSE, 152),
('1-21-002', 'Bangunan', 'ASSET', 'ASET TIDAK LANCAR', 'Aset Tetap', 'DEBIT', FALSE, 153),
('1-21-003', 'Peralatan Medis', 'ASSET', 'ASET TIDAK LANCAR', 'Aset Tetap', 'DEBIT', FALSE, 154),
('1-21-004', 'Alat Laboratorium', 'ASSET', 'ASET TIDAK LANCAR', 'Aset Tetap', 'DEBIT', FALSE, 155),
('1-21-005', 'Mebel dan Perlengkapan Kantor', 'ASSET', 'ASET TIDAK LANCAR', 'Aset Tetap', 'DEBIT', FALSE, 156),
('1-21-006', 'Kendaraan Operasional', 'ASSET', 'ASET TIDAK LANCAR', 'Aset Tetap', 'DEBIT', FALSE, 157),
('1-21-007', 'Komputer dan Sistem Informasi', 'ASSET', 'ASET TIDAK LANCAR', 'Aset Tetap', 'DEBIT', FALSE, 158),

-- Akumulasi Penyusutan
('1-22', 'Akumulasi Penyusutan', 'ASSET', 'ASET TIDAK LANCAR', 'Akumulasi Penyusutan', 'CREDIT', TRUE, 160),
('1-22-001', 'Akum. Penyusutan Bangunan', 'ASSET', 'ASET TIDAK LANCAR', 'Akumulasi Penyusutan', 'CREDIT', FALSE, 161),
('1-22-002', 'Akum. Penyusutan Peralatan Medis', 'ASSET', 'ASET TIDAK LANCAR', 'Akumulasi Penyusutan', 'CREDIT', FALSE, 162),
('1-22-003', 'Akum. Penyusutan Alat Laboratorium', 'ASSET', 'ASET TIDAK LANCAR', 'Akumulasi Penyusutan', 'CREDIT', FALSE, 163),
('1-22-004', 'Akum. Penyusutan Mebel & Perlengkapan', 'ASSET', 'ASET TIDAK LANCAR', 'Akumulasi Penyusutan', 'CREDIT', FALSE, 164),
('1-22-005', 'Akum. Penyusutan Kendaraan', 'ASSET', 'ASET TIDAK LANCAR', 'Akumulasi Penyusutan', 'CREDIT', FALSE, 165),
('1-22-006', 'Akum. Penyusutan Komputer & SI', 'ASSET', 'ASET TIDAK LANCAR', 'Akumulasi Penyusutan', 'CREDIT', FALSE, 166),

-- Aset Tidak Berwujud
('1-23', 'Aset Tidak Berwujud', 'ASSET', 'ASET TIDAK LANCAR', 'Aset Tidak Berwujud', 'DEBIT', TRUE, 170),
('1-23-001', 'Lisensi Perangkat Lunak', 'ASSET', 'ASET TIDAK LANCAR', 'Aset Tidak Berwujud', 'DEBIT', FALSE, 171),
('1-23-002', 'Izin Praktik Klinik (SIK/SIA)', 'ASSET', 'ASET TIDAK LANCAR', 'Aset Tidak Berwujud', 'DEBIT', FALSE, 172);

-- ============================================================
-- 2. LIABILITAS (LIABILITY)
-- ============================================================
INSERT INTO chart_of_accounts (account_code, account_name, account_type, account_group, account_subgroup, natural_balance, is_header, sort_order) VALUES
('2', 'LIABILITAS', 'LIABILITY', 'LIABILITAS', NULL, 'CREDIT', TRUE, 200),

-- 2.1 Liabilitas Jangka Pendek
('2-1', 'Liabilitas Jangka Pendek', 'LIABILITY', 'LIABILITAS JANGKA PENDEK', NULL, 'CREDIT', TRUE, 210),
('2-11', 'Utang Usaha', 'LIABILITY', 'LIABILITAS JANGKA PENDEK', 'Utang Usaha', 'CREDIT', TRUE, 211),
('2-11-001', 'Utang Pembelian Obat & Alkes (PBF)', 'LIABILITY', 'LIABILITAS JANGKA PENDEK', 'Utang Usaha', 'CREDIT', FALSE, 212),
('2-11-002', 'Utang Pembelian Alat Medis', 'LIABILITY', 'LIABILITAS JANGKA PENDEK', 'Utang Usaha', 'CREDIT', FALSE, 213),
('2-11-003', 'Utang Biaya Operasional', 'LIABILITY', 'LIABILITAS JANGKA PENDEK', 'Utang Usaha', 'CREDIT', FALSE, 214),

('2-12', 'Utang Jasa Medis', 'LIABILITY', 'LIABILITAS JANGKA PENDEK', 'Utang Jasa Medis', 'CREDIT', TRUE, 220),
('2-12-001', 'Utang Jasa Medis Dokter Umum', 'LIABILITY', 'LIABILITAS JANGKA PENDEK', 'Utang Jasa Medis', 'CREDIT', FALSE, 221),
('2-12-002', 'Utang Jasa Medis Dokter Spesialis', 'LIABILITY', 'LIABILITAS JANGKA PENDEK', 'Utang Jasa Medis', 'CREDIT', FALSE, 222),

('2-13', 'Utang Pajak', 'LIABILITY', 'LIABILITAS JANGKA PENDEK', 'Utang Pajak', 'CREDIT', TRUE, 230),
('2-13-001', 'Utang PPh Pasal 21 (Dokter)', 'LIABILITY', 'LIABILITAS JANGKA PENDEK', 'Utang Pajak', 'CREDIT', FALSE, 231),
('2-13-002', 'Utang PPh Pasal 21 (Karyawan)', 'LIABILITY', 'LIABILITAS JANGKA PENDEK', 'Utang Pajak', 'CREDIT', FALSE, 232),
('2-13-003', 'Utang PPh Pasal 23', 'LIABILITY', 'LIABILITAS JANGKA PENDEK', 'Utang Pajak', 'CREDIT', FALSE, 233),
('2-13-004', 'Utang PPh Pasal 25', 'LIABILITY', 'LIABILITAS JANGKA PENDEK', 'Utang Pajak', 'CREDIT', FALSE, 234),
('2-14', 'Utang PPN', 'LIABILITY', 'LIABILITAS JANGKA PENDEK', 'Utang Pajak', 'CREDIT', TRUE, 235),
('2-14-001', 'PPN Keluaran - Penjualan Obat', 'LIABILITY', 'LIABILITAS JANGKA PENDEK', 'Utang Pajak', 'CREDIT', FALSE, 236),

('2-15', 'Utang Lainnya', 'LIABILITY', 'LIABILITAS JANGKA PENDEK', 'Utang Lainnya', 'CREDIT', TRUE, 240),
('2-15-001', 'Utang BPJS Ketenagakerjaan', 'LIABILITY', 'LIABILITAS JANGKA PENDEK', 'Utang Lainnya', 'CREDIT', FALSE, 241),
('2-15-002', 'Utang BPJS Kesehatan', 'LIABILITY', 'LIABILITAS JANGKA PENDEK', 'Utang Lainnya', 'CREDIT', FALSE, 242),
('2-15-003', 'Pendapatan Diterima Dimuka', 'LIABILITY', 'LIABILITAS JANGKA PENDEK', 'Utang Lainnya', 'CREDIT', FALSE, 243),
('2-15-004', 'Uang Jaminan Pasien', 'LIABILITY', 'LIABILITAS JANGKA PENDEK', 'Utang Lainnya', 'CREDIT', FALSE, 244),

-- 2.2 Liabilitas Jangka Panjang
('2-2', 'Liabilitas Jangka Panjang', 'LIABILITY', 'LIABILITAS JANGKA PANJANG', NULL, 'CREDIT', TRUE, 250),
('2-21-001', 'Utang Bank Jangka Panjang', 'LIABILITY', 'LIABILITAS JANGKA PANJANG', 'Utang Bank', 'CREDIT', FALSE, 251),
('2-21-002', 'Utang Leasing Alat Medis', 'LIABILITY', 'LIABILITAS JANGKA PANJANG', 'Utang Leasing', 'CREDIT', FALSE, 252);

-- ============================================================
-- 3. EKUITAS (EQUITY)
-- ============================================================
INSERT INTO chart_of_accounts (account_code, account_name, account_type, account_group, account_subgroup, natural_balance, is_header, sort_order) VALUES
('3', 'EKUITAS', 'EQUITY', 'EKUITAS', NULL, 'CREDIT', TRUE, 300),
('3-11-001', 'Modal Disetor', 'EQUITY', 'EKUITAS', 'Modal', 'CREDIT', FALSE, 301),
('3-11-002', 'Tambahan Modal Disetor', 'EQUITY', 'EKUITAS', 'Modal', 'CREDIT', FALSE, 302),
('3-12-001', 'Laba Ditahan', 'EQUITY', 'EKUITAS', 'Laba Ditahan', 'CREDIT', FALSE, 303),
('3-12-002', 'Laba / Rugi Tahun Berjalan', 'EQUITY', 'EKUITAS', 'Laba Ditahan', 'CREDIT', FALSE, 304),
('3-13-001', 'Dividen Dibayarkan', 'EQUITY', 'EKUITAS', 'Dividen', 'DEBIT', FALSE, 305);

-- ============================================================
-- 4. PENDAPATAN (REVENUE)
-- ============================================================
INSERT INTO chart_of_accounts (account_code, account_name, account_type, account_group, account_subgroup, natural_balance, is_header, sort_order) VALUES
('4', 'PENDAPATAN', 'REVENUE', 'PENDAPATAN', NULL, 'CREDIT', TRUE, 400),

-- 4.1 Pendapatan Jasa Medis
('4-11', 'Pendapatan Jasa Medis', 'REVENUE', 'PENDAPATAN OPERASIONAL', 'Jasa Medis', 'CREDIT', TRUE, 410),
('4-11-001', 'Pendapatan Konsultasi Dokter Umum', 'REVENUE', 'PENDAPATAN OPERASIONAL', 'Jasa Medis', 'CREDIT', FALSE, 411),
('4-11-002', 'Pendapatan Konsultasi Dokter Spesialis', 'REVENUE', 'PENDAPATAN OPERASIONAL', 'Jasa Medis', 'CREDIT', FALSE, 412),
('4-11-003', 'Pendapatan Tindakan Medis Minor', 'REVENUE', 'PENDAPATAN OPERASIONAL', 'Jasa Medis', 'CREDIT', FALSE, 413),
('4-11-004', 'Pendapatan Tindakan Medis Mayor', 'REVENUE', 'PENDAPATAN OPERASIONAL', 'Jasa Medis', 'CREDIT', FALSE, 414),
('4-11-005', 'Pendapatan Imunisasi & Vaksinasi', 'REVENUE', 'PENDAPATAN OPERASIONAL', 'Jasa Medis', 'CREDIT', FALSE, 415),
('4-11-006', 'Pendapatan MCU (Medical Check Up)', 'REVENUE', 'PENDAPATAN OPERASIONAL', 'Jasa Medis', 'CREDIT', FALSE, 416),
('4-11-007', 'Pendapatan Klinik Gigi', 'REVENUE', 'PENDAPATAN OPERASIONAL', 'Jasa Medis', 'CREDIT', FALSE, 417),

-- 4.12 Pendapatan Laboratorium
('4-12', 'Pendapatan Laboratorium', 'REVENUE', 'PENDAPATAN OPERASIONAL', 'Laboratorium', 'CREDIT', TRUE, 420),
('4-12-001', 'Pendapatan Pemeriksaan Darah', 'REVENUE', 'PENDAPATAN OPERASIONAL', 'Laboratorium', 'CREDIT', FALSE, 421),
('4-12-002', 'Pendapatan Pemeriksaan Urine', 'REVENUE', 'PENDAPATAN OPERASIONAL', 'Laboratorium', 'CREDIT', FALSE, 422),
('4-12-003', 'Pendapatan Pemeriksaan Radiologi', 'REVENUE', 'PENDAPATAN OPERASIONAL', 'Laboratorium', 'CREDIT', FALSE, 423),

-- 4.13 Pendapatan Farmasi
('4-13', 'Pendapatan Farmasi', 'REVENUE', 'PENDAPATAN OPERASIONAL', 'Farmasi', 'CREDIT', TRUE, 430),
('4-13-001', 'Pendapatan Penjualan Obat Etikal', 'REVENUE', 'PENDAPATAN OPERASIONAL', 'Farmasi', 'CREDIT', FALSE, 431),
('4-13-002', 'Pendapatan Penjualan Obat OTC', 'REVENUE', 'PENDAPATAN OPERASIONAL', 'Farmasi', 'CREDIT', FALSE, 432),
('4-13-003', 'Pendapatan Penjualan BHP Medis', 'REVENUE', 'PENDAPATAN OPERASIONAL', 'Farmasi', 'CREDIT', FALSE, 433),

-- 4.14 Pendapatan BPJS
('4-14', 'Pendapatan Klaim BPJS', 'REVENUE', 'PENDAPATAN OPERASIONAL', 'BPJS', 'CREDIT', TRUE, 440),
('4-14-001', 'Pendapatan Kapitasi BPJS', 'REVENUE', 'PENDAPATAN OPERASIONAL', 'BPJS', 'CREDIT', FALSE, 441),
('4-14-002', 'Pendapatan Non-Kapitasi BPJS', 'REVENUE', 'PENDAPATAN OPERASIONAL', 'BPJS', 'CREDIT', FALSE, 442),

-- 4.9 Pendapatan Non-Operasional
('4-91-001', 'Pendapatan Bunga Bank', 'REVENUE', 'PENDAPATAN NON-OPERASIONAL', 'Non-Operasional', 'CREDIT', FALSE, 491),
('4-91-002', 'Pendapatan Lain-Lain', 'REVENUE', 'PENDAPATAN NON-OPERASIONAL', 'Non-Operasional', 'CREDIT', FALSE, 492);

-- ============================================================
-- 5. BEBAN (EXPENSE)
-- ============================================================
INSERT INTO chart_of_accounts (account_code, account_name, account_type, account_group, account_subgroup, natural_balance, is_header, sort_order) VALUES
('5', 'HARGA POKOK', 'EXPENSE', 'HARGA POKOK', NULL, 'DEBIT', TRUE, 500),

-- 5.1 HPP
('5-11', 'Harga Pokok Penjualan', 'EXPENSE', 'HARGA POKOK', 'HPP', 'DEBIT', TRUE, 510),
('5-11-001', 'HPP Obat Etikal (FIFO)', 'EXPENSE', 'HARGA POKOK', 'HPP', 'DEBIT', FALSE, 511),
('5-11-002', 'HPP Obat OTC (FIFO)', 'EXPENSE', 'HARGA POKOK', 'HPP', 'DEBIT', FALSE, 512),
('5-11-003', 'HPP BHP Medis (FIFO)', 'EXPENSE', 'HARGA POKOK', 'HPP', 'DEBIT', FALSE, 513),
('5-11-004', 'HPP Alat Medis Pakai Habis', 'EXPENSE', 'HARGA POKOK', 'HPP', 'DEBIT', FALSE, 514),

('6', 'BEBAN OPERASIONAL', 'EXPENSE', 'BEBAN OPERASIONAL', NULL, 'DEBIT', TRUE, 600),

-- 6.1 Beban SDM
('6-11', 'Beban Sumber Daya Manusia', 'EXPENSE', 'BEBAN OPERASIONAL', 'SDM', 'DEBIT', TRUE, 610),
('6-11-001', 'Gaji Dokter Tetap', 'EXPENSE', 'BEBAN OPERASIONAL', 'SDM', 'DEBIT', FALSE, 611),
('6-11-002', 'Gaji Perawat & Bidan', 'EXPENSE', 'BEBAN OPERASIONAL', 'SDM', 'DEBIT', FALSE, 612),
('6-11-003', 'Gaji Apoteker & Asisten Apoteker', 'EXPENSE', 'BEBAN OPERASIONAL', 'SDM', 'DEBIT', FALSE, 613),
('6-11-004', 'Gaji Staff Administrasi', 'EXPENSE', 'BEBAN OPERASIONAL', 'SDM', 'DEBIT', FALSE, 614),
('6-11-005', 'Tunjangan Karyawan', 'EXPENSE', 'BEBAN OPERASIONAL', 'SDM', 'DEBIT', FALSE, 615),
('6-11-006', 'BPJS Ketenagakerjaan - Bagian Perusahaan', 'EXPENSE', 'BEBAN OPERASIONAL', 'SDM', 'DEBIT', FALSE, 616),
('6-11-007', 'BPJS Kesehatan - Bagian Perusahaan', 'EXPENSE', 'BEBAN OPERASIONAL', 'SDM', 'DEBIT', FALSE, 617),

-- 6.12 Jasa Medis Dokter
('6-12', 'Beban Jasa Medis Dokter', 'EXPENSE', 'BEBAN OPERASIONAL', 'Jasa Medis', 'DEBIT', TRUE, 620),
('6-12-001', 'Bagi Hasil Jasa Medis - Dokter Umum', 'EXPENSE', 'BEBAN OPERASIONAL', 'Jasa Medis', 'DEBIT', FALSE, 621),
('6-12-002', 'Bagi Hasil Jasa Medis - Dokter Spesialis', 'EXPENSE', 'BEBAN OPERASIONAL', 'Jasa Medis', 'DEBIT', FALSE, 622),

-- 6.13 Beban Operasional Klinik
('6-13', 'Beban Operasional Klinik', 'EXPENSE', 'BEBAN OPERASIONAL', 'Operasional', 'DEBIT', TRUE, 630),
('6-13-001', 'Beban Listrik', 'EXPENSE', 'BEBAN OPERASIONAL', 'Operasional', 'DEBIT', FALSE, 631),
('6-13-002', 'Beban Air (PDAM)', 'EXPENSE', 'BEBAN OPERASIONAL', 'Operasional', 'DEBIT', FALSE, 632),
('6-13-003', 'Beban Telepon & Internet', 'EXPENSE', 'BEBAN OPERASIONAL', 'Operasional', 'DEBIT', FALSE, 633),
('6-13-004', 'Beban Sewa Gedung', 'EXPENSE', 'BEBAN OPERASIONAL', 'Operasional', 'DEBIT', FALSE, 634),
('6-13-005', 'Beban Alat Tulis Kantor', 'EXPENSE', 'BEBAN OPERASIONAL', 'Operasional', 'DEBIT', FALSE, 635),
('6-13-006', 'Beban Kebersihan & Sanitasi', 'EXPENSE', 'BEBAN OPERASIONAL', 'Operasional', 'DEBIT', FALSE, 636),

-- 6.14 Pemeliharaan & Kalibrasi
('6-14', 'Beban Pemeliharaan & Kalibrasi', 'EXPENSE', 'BEBAN OPERASIONAL', 'Pemeliharaan', 'DEBIT', TRUE, 640),
('6-14-001', 'Pemeliharaan Gedung', 'EXPENSE', 'BEBAN OPERASIONAL', 'Pemeliharaan', 'DEBIT', FALSE, 641),
('6-14-002', 'Servis & Kalibrasi Alat Medis', 'EXPENSE', 'BEBAN OPERASIONAL', 'Pemeliharaan', 'DEBIT', FALSE, 642),
('6-14-003', 'Pemeliharaan Kendaraan', 'EXPENSE', 'BEBAN OPERASIONAL', 'Pemeliharaan', 'DEBIT', FALSE, 643),

-- 6.15 Penyusutan
('6-15', 'Beban Penyusutan', 'EXPENSE', 'BEBAN OPERASIONAL', 'Penyusutan', 'DEBIT', TRUE, 650),
('6-15-001', 'Penyusutan Bangunan', 'EXPENSE', 'BEBAN OPERASIONAL', 'Penyusutan', 'DEBIT', FALSE, 651),
('6-15-002', 'Penyusutan Peralatan Medis', 'EXPENSE', 'BEBAN OPERASIONAL', 'Penyusutan', 'DEBIT', FALSE, 652),
('6-15-003', 'Penyusutan Kendaraan', 'EXPENSE', 'BEBAN OPERASIONAL', 'Penyusutan', 'DEBIT', FALSE, 653),
('6-15-004', 'Penyusutan Komputer & SI', 'EXPENSE', 'BEBAN OPERASIONAL', 'Penyusutan', 'DEBIT', FALSE, 654),

-- 6.16 Pemasaran
('6-16', 'Beban Pemasaran', 'EXPENSE', 'BEBAN OPERASIONAL', 'Pemasaran', 'DEBIT', TRUE, 660),
('6-16-001', 'Iklan & Promosi', 'EXPENSE', 'BEBAN OPERASIONAL', 'Pemasaran', 'DEBIT', FALSE, 661),
('6-16-002', 'Biaya Pameran & Event', 'EXPENSE', 'BEBAN OPERASIONAL', 'Pemasaran', 'DEBIT', FALSE, 662),

-- 6.17 Kerugian Stok
('6-17', 'Beban Kerugian Persediaan', 'EXPENSE', 'BEBAN OPERASIONAL', 'Kerugian', 'DEBIT', TRUE, 670),
('6-17-001', 'Kerugian Stok Expired/Rusak', 'EXPENSE', 'BEBAN OPERASIONAL', 'Kerugian', 'DEBIT', FALSE, 671),
('6-17-002', 'Selisih Stok Opname', 'EXPENSE', 'BEBAN OPERASIONAL', 'Kerugian', 'DEBIT', FALSE, 672),

-- 6.18 Beban Lain
('6-18', 'Beban Administrasi & Umum', 'EXPENSE', 'BEBAN OPERASIONAL', 'Administrasi', 'DEBIT', TRUE, 680),
('6-18-001', 'Biaya Audit & Konsultasi', 'EXPENSE', 'BEBAN OPERASIONAL', 'Administrasi', 'DEBIT', FALSE, 681),
('6-18-002', 'Biaya Notaris & Legal', 'EXPENSE', 'BEBAN OPERASIONAL', 'Administrasi', 'DEBIT', FALSE, 682),
('6-18-003', 'Biaya Perjalanan Dinas', 'EXPENSE', 'BEBAN OPERASIONAL', 'Administrasi', 'DEBIT', FALSE, 683),
('6-18-004', 'Beban Bunga Pinjaman', 'EXPENSE', 'BEBAN OPERASIONAL', 'Administrasi', 'DEBIT', FALSE, 684),
('6-18-005', 'Beban Pajak Lainnya', 'EXPENSE', 'BEBAN OPERASIONAL', 'Administrasi', 'DEBIT', FALSE, 685),
('6-18-006', 'Beban Lain-Lain', 'EXPENSE', 'BEBAN OPERASIONAL', 'Administrasi', 'DEBIT', FALSE, 686);

-- ============================================================
-- SEED: ENTITAS KLINIK DEFAULT
-- ============================================================
INSERT INTO clinic_entities (entity_name, branch_code, address, phone, email, is_headquarters) VALUES
('Klinik Medis Antigravity - Pusat', 'HQ-001', 'Jl. Sudirman No. 1, Jakarta Pusat', '021-12345678', 'pusat@antigravity-klinik.id', TRUE),
('Klinik Medis Antigravity - Cabang Selatan', 'BR-002', 'Jl. Fatmawati No. 45, Jakarta Selatan', '021-87654321', 'selatan@antigravity-klinik.id', FALSE),
('Klinik Medis Antigravity - Cabang Barat', 'BR-003', 'Jl. Puri Indah No. 12, Jakarta Barat', '021-11223344', 'barat@antigravity-klinik.id', FALSE);
