# ✅ TEST CHECKLIST - User Acceptance Testing

**Date**: 2026-07-19  
**Tester**: _______________  
**App URL**: http://localhost:5174/

---

## 🎯 CRITICAL TESTS (Must Pass)

### ✅ Test 1: Application Loads
```
[ ] 1. Buka browser di http://localhost:5174/
[ ] 2. Wait 3-5 detik untuk app load
[ ] 3. ✅ Verify: Tidak ada white screen
[ ] 4. ✅ Verify: Dashboard/Home page tampil
[ ] 5. Open DevTools (F12) → Console tab
[ ] 6. ✅ Verify: Tidak ada error merah
[ ] 7. ✅ Verify: Tidak ada "404 Not Found" error
```

**Expected Result**: App loads normal tanpa error

**Status**: [ ] PASS / [ ] FAIL  
**Notes**: _______________________________________

---

### ✅ Test 2: Menu Navigation
```
[ ] 1. Lihat Sidebar (kiri)
[ ] 2. ✅ Verify: Menu "Transaksi" ada
[ ] 3. Klik menu "Transaksi"
[ ] 4. ✅ Verify: Submenu expand:
        [ ] Billing Kasir
        [ ] Laporan Billing
[ ] 5. Klik menu "Inventory"
[ ] 6. ✅ Verify: Submenu ada:
        [ ] Daftar Barang
        [ ] Penerimaan (GRN)
        [ ] Pengeluaran Stok [NEW]
        [ ] Kartu Stok
```

**Expected Result**: Semua menu baru tampil

**Status**: [ ] PASS / [ ] FAIL  
**Notes**: _______________________________________

---

### ✅ Test 3: Laporan Billing Page
```
[ ] 1. Klik: Transaksi → Laporan Billing
[ ] 2. ✅ Verify: Page load tanpa error
[ ] 3. ✅ Verify: Filter panel tampil di atas
[ ] 4. ✅ Verify: 4 KPI cards tampil:
        [ ] Total Pendapatan (💰)
        [ ] Total Transaksi Jasa (🏥)
        [ ] Total Transaksi Farmasi (💊)
        [ ] Total Pasien Unik (👥)
[ ] 5. ✅ Verify: 3 Charts tampil:
        [ ] Trend Pendapatan (Line Chart)
        [ ] Jumlah Pasien (Bar Chart)
        [ ] Metode Pembayaran (Pie Chart)
[ ] 6. ✅ Verify: Tabel transaksi tampil
[ ] 7. ✅ Verify: Tombol export tampil:
        [ ] Unduh PDF
        [ ] Unduh Excel
```

**Expected Result**: Page complete dengan semua komponen

**Status**: [ ] PASS / [ ] FAIL  
**Notes**: _______________________________________

---

### ✅ Test 4: Filter Laporan Billing
```
[ ] 1. Masih di halaman Laporan Billing
[ ] 2. Klik dropdown "Pilih Periode"
[ ] 3. ✅ Verify: Options tampil:
        [ ] Harian
        [ ] Bulanan
        [ ] Kuartalan
        [ ] Semester
        [ ] Tahunan
[ ] 4. Pilih "Bulanan"
[ ] 5. ✅ Verify: Dropdown bulan tampil
[ ] 6. Pilih "Juli"
[ ] 7. Pilih tahun "2026"
[ ] 8. ✅ Verify: Data filtered (atau "Tidak ada data" jika empty)
```

**Expected Result**: Filter bekerja tanpa error

**Status**: [ ] PASS / [ ] FAIL  
**Notes**: _______________________________________

---

### ✅ Test 5: Export PDF
```
[ ] 1. Masih di halaman Laporan Billing
[ ] 2. Klik tombol "Unduh PDF"
[ ] 3. ✅ Verify: Download dimulai (~1-2 detik)
[ ] 4. ✅ Verify: File PDF downloaded
[ ] 5. Buka file PDF
[ ] 6. ✅ Verify: PDF format professional:
        [ ] Header "LAPORAN BILLING KASIR"
        [ ] Periode tampil
        [ ] KPI summary
        [ ] Tabel data
        [ ] Footer dengan tanggal
```

**Expected Result**: PDF generated dengan format bagus

**Status**: [ ] PASS / [ ] FAIL  
**Notes**: _______________________________________

---

### ✅ Test 6: Export Excel
```
[ ] 1. Masih di halaman Laporan Billing
[ ] 2. Klik tombol "Unduh Excel"
[ ] 3. ✅ Verify: Download dimulai (<1 detik)
[ ] 4. ✅ Verify: File XLSX downloaded
[ ] 5. Buka file Excel
[ ] 6. ✅ Verify: Excel format proper:
        [ ] Sheet name: "Billing Report"
        [ ] Header row dengan styling
        [ ] Data rows complete
        [ ] Columns: No, Tanggal, Pasien, etc.
```

**Expected Result**: Excel file editable dan lengkap

**Status**: [ ] PASS / [ ] FAIL  
**Notes**: _______________________________________

---

### ✅ Test 7: Pengeluaran Stok Page
```
[ ] 1. Klik: Inventory → Pengeluaran Stok
[ ] 2. ✅ Verify: Page load tanpa error
[ ] 3. ✅ Verify: 2 Tabs tampil:
        [ ] Pengeluaran Manual
        [ ] Dari Billing
[ ] 4. ✅ Verify: Tab "Pengeluaran Manual" active
[ ] 5. ✅ Verify: Tombol "+ Pengeluaran Baru" tampil
[ ] 6. ✅ Verify: Tabel pengeluaran tampil (bisa kosong)
```

**Expected Result**: Page complete dengan tabs

**Status**: [ ] PASS / [ ] FAIL  
**Notes**: _______________________________________

---

### ✅ Test 8: Tambah Pengeluaran Stok
```
[ ] 1. Masih di Pengeluaran Stok → Tab "Pengeluaran Manual"
[ ] 2. Klik tombol "+ Pengeluaran Baru"
[ ] 3. ✅ Verify: Modal form muncul
[ ] 4. ✅ Verify: Form fields lengkap:
        [ ] Jenis Pengeluaran (dropdown)
        [ ] Tanggal
        [ ] Keterangan
        [ ] Tabel items (kosong)
        [ ] Tombol "Tambah Item"
        [ ] Tombol "Simpan" & "Batal"
[ ] 5. Pilih Jenis: "Pemakaian Internal"
[ ] 6. Pilih Tanggal: Hari ini
[ ] 7. Isi Keterangan: "Test pengeluaran stok"
[ ] 8. Klik "Tambah Item"
```

**Expected Result**: Form lengkap dan responsive

**Status**: [ ] PASS / [ ] FAIL  
**Notes**: _______________________________________

---

### ✅ Test 9: Tambah Item Pengeluaran
```
[ ] 1. Modal "Tambah Item" muncul
[ ] 2. ✅ Verify: Fields tampil:
        [ ] Barang (searchable dropdown)
        [ ] Quantity
        [ ] Stok Tersedia (readonly)
        [ ] Total (auto-calculated)
[ ] 3. Pilih barang dari dropdown (ex: Paracetamol)
[ ] 4. ✅ Verify: Stok tersedia tampil otomatis
[ ] 5. Input Quantity: 5
[ ] 6. ✅ Verify: Total calculated otomatis
[ ] 7. Klik "Simpan"
[ ] 8. ✅ Verify: Item muncul di tabel form utama
[ ] 9. ✅ Verify: Total Value updated
```

**Expected Result**: Item ditambahkan ke form

**Status**: [ ] PASS / [ ] FAIL  
**Notes**: _______________________________________

---

### ✅ Test 10: Simpan Pengeluaran Stok
```
[ ] 1. Klik tombol "Simpan" di form utama
[ ] 2. ✅ Verify: Loading indicator muncul
[ ] 3. ✅ Verify: Modal close
[ ] 4. ✅ Verify: Tabel refresh dengan data baru
[ ] 5. ✅ Verify: Entry baru muncul di row teratas
[ ] 6. ✅ Verify: Toast notification "Berhasil"
```

**Expected Result**: Data saved successfully

**Status**: [ ] PASS / [ ] FAIL  
**Notes**: _______________________________________

---

### ✅ Test 11: Data Persistence (CRITICAL!)
```
[ ] 1. Masih lihat data yang baru disimpan di tabel
[ ] 2. Refresh browser (F5 atau Ctrl+R)
[ ] 3. Wait app load ulang
[ ] 4. Buka lagi: Inventory → Pengeluaran Stok
[ ] 5. ✅ CRITICAL VERIFY: Data tetap ada!
[ ] 6. ✅ Verify: Entry yang tadi dibuat masih muncul
[ ] 7. ✅ Verify: Semua detail sama (tanggal, qty, total)
```

**Expected Result**: ✅ DATA PERSISTENT (TIDAK HILANG)

**Status**: [ ] PASS / [ ] FAIL  
**Notes**: _______________________________________

**⚠️ JIKA FAIL**: Data hilang setelah refresh = BUG KRITIS!

---

### ✅ Test 12: Tab "Dari Billing"
```
[ ] 1. Masih di Pengeluaran Stok
[ ] 2. Klik Tab "Dari Billing"
[ ] 3. ✅ Verify: Tab switch tanpa error
[ ] 4. ✅ Verify: Filter tanggal tampil
[ ] 5. ✅ Verify: Tabel billing history tampil
[ ] 6. (Optional jika ada data billing)
        [ ] Entry billing tampil
        [ ] Kolom lengkap: No Billing, Pasien, Tanggal, Items
        [ ] Tombol "Lihat Detail" ada
```

**Expected Result**: Tab tampil normal

**Status**: [ ] PASS / [ ] FAIL  
**Notes**: _______________________________________

---

## 🎯 INTEGRATION TESTS (Optional)

### ✅ Test 13: Billing → Stock Update
```
[ ] 1. Buka: Transaksi → Billing Kasir
[ ] 2. Klik "+ Billing Baru"
[ ] 3. Isi data pasien:
        [ ] Nama: "Test Patient"
        [ ] MRN: "MRN-TEST-001"
        [ ] Dokter: [Pilih]
        [ ] Tanggal: Hari ini
[ ] 4. Section "Items Farmasi"
[ ] 5. Klik "+ Tambah Item"
[ ] 6. Pilih barang (ex: Paracetamol)
[ ] 7. Input Quantity: 2
[ ] 8. Klik "Simpan Item"
[ ] 9. Pilih Metode Pembayaran: "Tunai"
[ ] 10. Klik "Simpan & Bayar"
[ ] 11. ✅ Verify: Billing saved
```

**Status**: [ ] PASS / [ ] FAIL  
**Notes**: _______________________________________

---

### ✅ Test 14: Verify Stock Reduced
```
[ ] 1. Setelah billing saved
[ ] 2. Buka: Inventory → Kartu Stok
[ ] 3. Pilih barang yang tadi di-billing (Paracetamol)
[ ] 4. ✅ Verify: Kolom "Out" ada entry baru
[ ] 5. ✅ Verify: Quantity = 2 (sesuai billing)
[ ] 6. ✅ Verify: Balance berkurang 2
[ ] 7. ✅ Verify: Tanggal = hari ini
```

**Expected Result**: Stok otomatis berkurang

**Status**: [ ] PASS / [ ] FAIL  
**Notes**: _______________________________________

---

### ✅ Test 15: Billing Appears in "Dari Billing"
```
[ ] 1. Buka: Inventory → Pengeluaran Stok
[ ] 2. Klik Tab "Dari Billing"
[ ] 3. ✅ Verify: Billing tadi muncul di tabel
[ ] 4. Klik tombol "Lihat Detail" pada row tersebut
[ ] 5. ✅ Verify: Modal detail muncul
[ ] 6. ✅ Verify: Items tampil:
        [ ] Nama barang (Paracetamol)
        [ ] Quantity (2)
        [ ] Harga
        [ ] Total
```

**Expected Result**: Billing sync ke pengeluaran stok

**Status**: [ ] PASS / [ ] FAIL  
**Notes**: _______________________________________

---

## 🎯 PERFORMANCE TESTS

### ✅ Test 16: Page Load Speed
```
[ ] 1. Clear browser cache (Ctrl+Shift+Delete)
[ ] 2. Close DevTools
[ ] 3. Refresh browser (F5)
[ ] 4. Start timer saat refresh
[ ] 5. Stop timer saat app fully loaded
[ ] 6. ✅ Verify: Load time < 5 detik
```

**Load Time**: _____ seconds

**Status**: [ ] PASS (<5s) / [ ] FAIL (>5s)  
**Notes**: _______________________________________

---

### ✅ Test 17: Filter Response Time
```
[ ] 1. Buka: Laporan Billing
[ ] 2. Change filter: Pilih "Bulanan"
[ ] 3. Start timer
[ ] 4. Pilih bulan "Januari"
[ ] 5. Stop timer saat data updated
[ ] 6. ✅ Verify: Response < 1 detik
```

**Response Time**: _____ ms

**Status**: [ ] PASS (<1s) / [ ] FAIL (>1s)  
**Notes**: _______________________________________

---

### ✅ Test 18: Export PDF Speed
```
[ ] 1. Buka: Laporan Billing (dengan data)
[ ] 2. Start timer
[ ] 3. Klik "Unduh PDF"
[ ] 4. Stop timer saat download complete
[ ] 5. ✅ Verify: Generation time < 3 detik
```

**Generation Time**: _____ seconds

**Status**: [ ] PASS (<3s) / [ ] FAIL (>3s)  
**Notes**: _______________________________________

---

## 🎯 ERROR HANDLING TESTS

### ✅ Test 19: Validation - Empty Form
```
[ ] 1. Buka: Pengeluaran Stok
[ ] 2. Klik "+ Pengeluaran Baru"
[ ] 3. Jangan isi apapun
[ ] 4. Klik "Simpan"
[ ] 5. ✅ Verify: Error message tampil
[ ] 6. ✅ Verify: Form tidak close
[ ] 7. ✅ Verify: Required fields highlighted
```

**Expected Result**: Validation prevents empty save

**Status**: [ ] PASS / [ ] FAIL  
**Notes**: _______________________________________

---

### ✅ Test 20: Validation - Quantity > Stock
```
[ ] 1. Buka: Pengeluaran Stok → Tambah Baru
[ ] 2. Tambah Item
[ ] 3. Pilih barang (ex: stock = 10)
[ ] 4. Input Quantity: 999 (lebih dari stock)
[ ] 5. Klik "Simpan"
[ ] 6. ✅ Verify: Error message:
        "Quantity melebihi stok tersedia"
[ ] 7. ✅ Verify: Item tidak ditambahkan
```

**Expected Result**: Validation prevents overselling

**Status**: [ ] PASS / [ ] FAIL  
**Notes**: _______________________________________

---

### ✅ Test 21: Network Error Handling
```
[ ] 1. Open DevTools → Network tab
[ ] 2. Set throttling: "Offline"
[ ] 3. Buka: Pengeluaran Stok → Tambah Baru
[ ] 4. Fill & submit form
[ ] 5. ✅ Verify: Error toast/message tampil:
        "Gagal menyimpan" atau "Network error"
[ ] 6. ✅ Verify: Data rollback (tidak tersimpan)
[ ] 7. Set throttling: "Online"
[ ] 8. Try save again
[ ] 9. ✅ Verify: Now success
```

**Expected Result**: Graceful error handling

**Status**: [ ] PASS / [ ] FAIL  
**Notes**: _______________________________________

---

## 📊 TEST SUMMARY

### Critical Tests (Must Pass)
```
Test 1: App Loads               [ ] PASS / [ ] FAIL
Test 2: Menu Navigation         [ ] PASS / [ ] FAIL
Test 3: Laporan Billing Page    [ ] PASS / [ ] FAIL
Test 4: Filter Billing          [ ] PASS / [ ] FAIL
Test 5: Export PDF              [ ] PASS / [ ] FAIL
Test 6: Export Excel            [ ] PASS / [ ] FAIL
Test 7: Pengeluaran Stok Page   [ ] PASS / [ ] FAIL
Test 8: Tambah Pengeluaran      [ ] PASS / [ ] FAIL
Test 9: Tambah Item             [ ] PASS / [ ] FAIL
Test 10: Simpan Pengeluaran     [ ] PASS / [ ] FAIL
Test 11: Data Persistence ⭐    [ ] PASS / [ ] FAIL
Test 12: Tab Dari Billing       [ ] PASS / [ ] FAIL
```

**Total Critical**: ___/12 PASSED

---

### Integration Tests (Optional)
```
Test 13: Billing Create         [ ] PASS / [ ] FAIL
Test 14: Stock Reduced          [ ] PASS / [ ] FAIL
Test 15: Billing in Tab         [ ] PASS / [ ] FAIL
```

**Total Integration**: ___/3 PASSED

---

### Performance Tests (Optional)
```
Test 16: Page Load Speed        [ ] PASS / [ ] FAIL
Test 17: Filter Speed           [ ] PASS / [ ] FAIL
Test 18: Export Speed           [ ] PASS / [ ] FAIL
```

**Total Performance**: ___/3 PASSED

---

### Error Handling Tests (Optional)
```
Test 19: Empty Form             [ ] PASS / [ ] FAIL
Test 20: Quantity > Stock       [ ] PASS / [ ] FAIL
Test 21: Network Error          [ ] PASS / [ ] FAIL
```

**Total Error Handling**: ___/3 PASSED

---

## 🎯 FINAL VERDICT

### Overall Result
```
Total Tests Run: _____
Tests Passed: _____
Tests Failed: _____
Pass Rate: _____%
```

### Status
```
[ ] ✅ APPROVED - Ready for production
[ ] ⚠️ CONDITIONAL - Minor issues, can deploy with notes
[ ] ❌ REJECTED - Critical issues, need fixes
```

### Critical Issues Found
```
1. _____________________________________________
2. _____________________________________________
3. _____________________________________________
```

### Non-Critical Issues
```
1. _____________________________________________
2. _____________________________________________
3. _____________________________________________
```

### Recommendations
```
1. _____________________________________________
2. _____________________________________________
3. _____________________________________________
```

---

## 📝 NOTES

### Browser Tested
```
[ ] Chrome (version: _____)
[ ] Firefox (version: _____)
[ ] Edge (version: _____)
[ ] Safari (version: _____)
```

### Environment
```
OS: Windows
Node version: _____
NPM version: _____
Dev Server Port: 5174
```

### Test Date/Time
```
Date: 2026-07-19
Start Time: _____
End Time: _____
Duration: _____ minutes
```

---

**Tester Signature**: _______________  
**Date**: _______________  
**Status**: _______________

---

# ✅ SELESAI TESTING!

**Next Steps**:
- If all PASS → Deploy to production
- If any FAIL → Report issues & fix
- Document all findings

