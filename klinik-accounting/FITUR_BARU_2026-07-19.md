# Dokumentasi Fitur Baru - 19 Juli 2026

## Ringkasan Pembaruan

Tiga fitur utama telah diperbaiki dan ditingkatkan pada aplikasi klinik:

1. ✅ **Kategori Layanan & Integrasi Akun Pendapatan**
2. ✅ **Input Pemeriksaan Laboratorium di Billing**
3. ✅ **Perbaikan Modal Tambah Obat dengan Scroll**

---

## 1. Kategori Layanan & Integrasi Akun Pendapatan

### Perubahan Database

**Tabel:** `service_tariffs`

**Kolom Baru:**
- `service_category` - VARCHAR(100) dengan 9 kategori:
  - KONSULTASI_UMUM
  - KONSULTASI_SPESIALIS
  - TINDAKAN_MEDIS_MINOR
  - TINDAKAN_MEDIS_MAYOR
  - IMUNISASI_VAKSINASI
  - MCU
  - KLINIK_GIGI
  - LABORATORIUM
  - LAINNYA

- `revenue_account_code` - VARCHAR(20) dengan foreign key ke `chart_of_accounts`

### Fitur UI

**Halaman:** Settings → Tarif Layanan

**Form Tambah/Edit Layanan:**
- Dropdown kategori layanan (9 pilihan)
- SearchableSelect untuk memilih akun pendapatan dari COA
- Validasi kategori dan akun pendapatan wajib diisi

**Tabel Tarif Layanan:**
- Kolom baru: Kategori (ditampilkan sebagai badge biru)
- Kolom baru: Akun Pendapatan (format kode akun)

### Integrasi Billing

Saat membuat billing, sistem sekarang:
- Menggunakan `revenue_account_code` yang spesifik untuk setiap layanan
- Mengelompokkan pendapatan berdasarkan akun COA
- Membuat jurnal entry dengan akun yang dinamis (bukan hardcode ke 4-11-001)

**Contoh Jurnal Entry:**
```
Debit:  1-11-002  Kas Tunai                    Rp 550.000
Credit: 4-11-001  Pendapatan Konsultasi Umum   Rp 200.000
Credit: 4-12-001  Pendapatan Laboratorium      Rp 350.000
```

---

## 2. Input Pemeriksaan Laboratorium di Billing

### Fitur Baru

**Halaman:** Billing → Billing Baru

**Section Pemeriksaan Laboratorium:**
- Section terpisah dengan icon "L" biru
- SearchableSelect khusus untuk layanan kategori LABORATORIUM
- Styling berbeda dengan border biru dan background biru muda
- Tarif otomatis muncul dari master tarif layanan

### Cara Kerja

1. Layanan dengan kategori LABORATORIUM **tidak muncul** di dropdown "Layanan Medis"
2. Layanan LABORATORIUM **hanya muncul** di dropdown "Pemeriksaan Laboratorium"
3. Tarif diambil otomatis dari master data
4. Dapat mengatur quantity untuk setiap pemeriksaan
5. Sub-total lab ditampilkan terpisah di ringkasan

### Akuntansi

- Fee dokter dihitung dari: `(Layanan Medis + Laboratorium) × Fee %`
- Pendapatan lab menggunakan akun spesifik dari master tarif
- Default akun lab: `4-12-001` (Pendapatan Laboratorium)

---

## 3. Perbaikan Modal Tambah Obat

### Masalah yang Diperbaiki

❌ **Sebelum:**
- List obat `max-h-64` (256px) - terlalu pendek
- Scroll tidak smooth
- Modal tidak muncul karena component tidak di-render

✅ **Setelah:**
- List obat `max-h-80` (320px) - lebih banyak item terlihat
- Scroll smooth dengan `overflow-y-auto`
- Modal component `AddPharmacyItemModal` ditambahkan di BillingPage
- Props lengkap diteruskan dengan benar

### Fitur Modal

**Komponen:** `AddPharmacyItemModal`

**Fitur:**
- Search obat by kode atau nama
- Filter otomatis hanya obat dengan stok > 0
- Kategori badge (Paten/Generik)
- Tampilan stok realtime
- Validasi quantity vs stok tersedia
- Warning jika stok menipis (< 50 unit)
- Error jika quantity melebihi stok

**Cara Penggunaan:**
1. Klik tombol "Tambah Obat" di section Farmasi
2. Cari obat dengan search bar
3. Klik obat yang diinginkan dari list (scrollable)
4. Masukkan quantity (validasi otomatis)
5. Klik "Tambahkan"

---

## Testing Guide

### Test 1: Kategori Layanan

**Langkah:**
1. Buka Settings → Tarif Layanan
2. Klik "Tambah Layanan"
3. Pilih kategori "LABORATORIUM"
4. Isi nama: "Pemeriksaan Darah Lengkap"
5. Isi tarif: 150000
6. Pilih akun pendapatan: "4-12-001 - Pendapatan Laboratorium"
7. Klik "Tambah Layanan"

**Expected Result:**
- ✅ Layanan tersimpan dengan kategori dan akun pendapatan
- ✅ Muncul di tabel dengan badge "Pemeriksaan Laboratorium"
- ✅ Kolom akun pendapatan menampilkan "4-12-001"

### Test 2: Billing dengan Laboratorium

**Langkah:**
1. Buka Billing → Billing Baru
2. Isi data pasien
3. Tambahkan layanan medis: Konsultasi Dokter Umum
4. Tambahkan pemeriksaan lab: Pemeriksaan Darah Lengkap
5. Review sub-total (harus muncul 3 baris: Jasa Medis, Laboratorium, Farmasi)
6. Proses pembayaran

**Expected Result:**
- ✅ Section laboratorium muncul dengan styling biru
- ✅ Tarif lab muncul otomatis
- ✅ Sub-total lab terhitung dengan benar
- ✅ Jurnal entry menggunakan akun yang tepat:
  - Konsultasi → 4-11-001
  - Lab → 4-12-001
- ✅ Fee dokter dihitung dari (Konsultasi + Lab)

### Test 3: Modal Tambah Obat

**Langkah:**
1. Buka Billing → Billing Baru
2. Scroll ke section "Item Farmasi / Obat"
3. Klik tombol "Tambah Obat"
4. Modal muncul dengan list obat
5. Coba scroll list obat (harus smooth)
6. Search obat "Paracetamol"
7. Pilih obat dari hasil search
8. Masukkan quantity 5
9. Klik "Tambahkan"

**Expected Result:**
- ✅ Modal muncul dengan benar
- ✅ List obat bisa di-scroll dengan smooth
- ✅ Search berfungsi (filter realtime)
- ✅ Obat yang dipilih highlighted dengan border biru
- ✅ Validasi stok berfungsi
- ✅ Obat masuk ke tabel farmasi setelah ditambahkan
- ✅ Modal tertutup otomatis setelah tambah

### Test 4: Integrasi Penuh

**Scenario:** Billing lengkap dengan semua item

**Langkah:**
1. Buat billing baru
2. Tambah layanan: Konsultasi Dokter Spesialis (kategori: KONSULTASI_SPESIALIS, akun: 4-11-002)
3. Tambah lab: Pemeriksaan Urine (kategori: LABORATORIUM, akun: 4-12-001)
4. Tambah lab: Pemeriksaan Darah (kategori: LABORATORIUM, akun: 4-12-001)
5. Tambah obat: Paracetamol 500mg (qty: 10)
6. Tambah obat: Amoxicillin 500mg (qty: 15)
7. Pilih dokter dengan fee 30%
8. Proses pembayaran

**Expected Result:**
- ✅ Grand total = Konsultasi + Lab1 + Lab2 + Obat1 + Obat2 + PPN - Diskon
- ✅ Fee dokter = (Konsultasi + Lab1 + Lab2) × 30%
- ✅ Jurnal entry:
  ```
  Debit:  Kas Tunai           [Grand Total]
  Credit: 4-11-002 Konsultasi [nilai spesifik]
  Credit: 4-12-001 Lab        [Lab1 + Lab2]
  Credit: 4-13-001 Obat       [Obat1 + Obat2]
  Credit: 2-14-001 PPN        [11% dari farmasi]
  Debit:  6-12-001 Jasa Medis [Fee bruto]
  Credit: 2-13-001 PPh 21     [Pajak]
  Credit: 2-12-001 Utang Fee  [Net fee]
  Debit:  5-11-001 HPP        [COGS obat]
  Credit: 1-13-001 Persediaan [Pengurangan stok]
  ```
- ✅ Stok obat berkurang sesuai quantity
- ✅ Data tersimpan di database dengan benar

---

## Verifikasi Database

### Query Cek Service Tariffs

```sql
SELECT 
  code,
  name,
  service_category,
  revenue_account_code,
  price,
  is_active
FROM service_tariffs
ORDER BY service_category, code;
```

### Query Cek Billing dengan Lab

```sql
SELECT 
  b.billing_number,
  b.patient_name,
  b.subtotal_services,
  bi.item_type,
  bi.item_name,
  bi.unit_price
FROM patient_billings b
JOIN billing_items bi ON bi.billing_id = b.id
WHERE bi.item_type = 'LAB'
ORDER BY b.created_at DESC
LIMIT 10;
```

### Query Cek Journal Entry

```sql
SELECT 
  je.entry_number,
  je.description,
  ji.account_code,
  ji.description as item_description,
  ji.debit,
  ji.credit
FROM journal_entries je
JOIN journal_items ji ON ji.journal_entry_id = je.id
WHERE je.entry_type = 'BILLING'
  AND je.created_at >= CURRENT_DATE
ORDER BY je.created_at DESC, ji.debit DESC;
```

---

## Konfigurasi Akun Pendapatan yang Disarankan

### Setup Chart of Accounts (COA)

Pastikan akun-akun berikut sudah dibuat:

```
4-11     Pendapatan Jasa Medis                    (HEADER)
4-11-001 Pendapatan Konsultasi Dokter Umum        (Kredit)
4-11-002 Pendapatan Konsultasi Dokter Spesialis   (Kredit)
4-11-003 Pendapatan Tindakan Medis Minor          (Kredit)
4-11-004 Pendapatan Tindakan Medis Mayor          (Kredit)
4-11-005 Pendapatan Imunisasi & Vaksinasi         (Kredit)
4-11-006 Pendapatan MCU (Medical Check Up)        (Kredit)
4-11-007 Pendapatan Klinik Gigi                   (Kredit)

4-12     Pendapatan Laboratorium                  (HEADER)
4-12-001 Pendapatan Pemeriksaan Darah             (Kredit)
4-12-002 Pendapatan Pemeriksaan Urine             (Kredit)

4-13     Pendapatan Farmasi                       (HEADER)
4-13-001 Pendapatan Penjualan Obat                (Kredit)
```

---

## Migration History

**File:** `add_service_category_and_revenue_account.sql`

**Changes:**
1. Added column `service_category VARCHAR(100)` with CHECK constraint
2. Added column `revenue_account_code VARCHAR(20)` with FK to chart_of_accounts
3. Updated existing records with default category based on name pattern
4. Added comments for documentation

**Rollback (jika diperlukan):**
```sql
ALTER TABLE public.service_tariffs
DROP CONSTRAINT IF EXISTS service_tariffs_service_category_check,
DROP CONSTRAINT IF EXISTS service_tariffs_revenue_account_code_fkey,
DROP COLUMN IF EXISTS service_category,
DROP COLUMN IF EXISTS revenue_account_code;
```

---

## File yang Dimodifikasi

1. **Database Migration**
   - Migration: `add_service_category_and_revenue_account.sql`

2. **Backend/Store**
   - `src/lib/db.js` - Sudah support camelCase conversion
   - `src/store/useStore.js` - Tidak perlu perubahan (auto-convert)

3. **Frontend Pages**
   - `src/pages/settings/TarifLayananPage.jsx` - Form & table
   - `src/pages/billing/BillingPage.jsx` - Section lab & jurnal logic

4. **Frontend Components**
   - `src/components/billing/AddPharmacyItemModal.jsx` - Scroll fix

---

## Catatan Penting

### Backward Compatibility

- ✅ Data lama tetap berfungsi (default: service_category = 'LAINNYA', revenue_account_code = '4-11-001')
- ✅ Billing existing tidak terpengaruh
- ✅ Journal entry existing tetap valid

### Best Practices

1. **Selalu isi kategori dan akun pendapatan** saat menambah layanan baru
2. **Gunakan akun yang sesuai** dengan kategori layanan
3. **Review jurnal entry** setelah billing untuk memastikan akun yang benar
4. **Jangan edit service_category** layanan yang sudah ada di billing history

### Troubleshooting

**Problem:** Layanan lab muncul di dropdown layanan medis
- **Solution:** Pastikan `service_category` = 'LABORATORIUM' (exact match)

**Problem:** Modal tambah obat tidak muncul
- **Solution:** Check console untuk error, pastikan props diteruskan dengan benar

**Problem:** Jurnal entry masih menggunakan akun hardcode
- **Solution:** Update data service tariff dengan revenue_account_code yang benar

---

## Kontak & Support

Untuk pertanyaan atau issue terkait fitur ini, silakan hubungi tim development.

**Tanggal Implementasi:** 19 Juli 2026
**Versi:** 1.0.0
**Status:** ✅ Production Ready
