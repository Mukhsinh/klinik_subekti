# 🔧 Instruksi: Clear Cache & Reload Data

## ⚠️ Problem
Halaman `/branches` masih menampilkan data lama (cached) bukan data fresh dari database.

---

## ✅ Solusi: 3 Cara

### Cara 1: Clear Cache via UI (RECOMMENDED) ⭐
1. Buka halaman `/branches`
2. Klik tombol **"Clear Cache"** (merah) di kanan atas
3. Confirm dialog yang muncul
4. Aplikasi akan otomatis reload dengan data fresh dari database

**Kapan digunakan:** Saat data tidak sync dengan database

---

### Cara 2: Refresh Button
1. Buka halaman `/branches`
2. Klik tombol **"Refresh"** di kanan atas
3. Tunggu hingga loading selesai

**Kapan digunakan:** Refresh cepat tanpa clear localStorage

---

### Cara 3: Hard Refresh Browser (Manual)
1. Tekan **Ctrl + Shift + R** (Windows/Linux)
2. Atau **Cmd + Shift + R** (Mac)
3. Atau buka DevTools (F12) → klik kanan tombol Refresh → **"Empty Cache and Hard Reload"**

**Kapan digunakan:** Jika cara 1 & 2 tidak berhasil

---

## 🎯 Setelah Clear Cache

Anda akan melihat di halaman `/branches`:

### Expected Data (Sesuai Database):
```
✅ Total Cabang: 1
✅ Nama: "Klinik Subekti — Pusat"
✅ Branch Code: "Subekti-01"
✅ Info Banner: "Data Real-time dari Supabase Database"
```

### Di Console (F12):
```
[Bootstrap] Starting fresh data load from Supabase...
[Bootstrap] Data Sources:
  - Branches: 1 from Supabase ✓
  - COA: 380 from Supabase ✓

[BranchesPage] Current branches data: 
  [{
    id: "11111111-0001-0001-0001-000000000001",
    branchCode: "Subekti-01",
    entityName: "Klinik Subekti — Pusat",
    isHeadquarters: true,
    isActive: true,
    ...
  }]
```

---

## 🔍 Debugging Tools (Sudah Ditambahkan)

### 1. Debug Console Logs
Di browser console (F12), Anda akan melihat:
- `[Bootstrap]` logs - kapan data di-load dari DB
- `[BranchesPage]` logs - data apa yang diterima
- Warning jika data kosong atau error

### 2. Debug: Lihat Data Mentah
Di halaman `/branches`:
1. Scroll ke info box biru
2. Klik **"🔍 Debug: Lihat Data Mentah"**
3. Lihat JSON data lengkap yang di-load

### 3. Network Tab
Di DevTools → Network tab:
1. Filter: `XHR` atau `Fetch`
2. Cari request ke Supabase
3. Check response body

---

## 🚨 Troubleshooting

### Problem: Masih tampil 2 cabang (dummy data)
**Cause:** Browser cache belum clear  
**Solution:** Gunakan Cara 1 (Clear Cache button)

### Problem: Tampil 0 cabang
**Cause:** Database memang kosong atau fetch error  
**Solution:** 
- Check console for errors
- Verify Supabase connection
- Check RLS policies
- Use "Tambah Cabang" button

### Problem: Error saat fetch
**Cause:** Supabase credentials atau network issue  
**Solution:**
- Check `.env` file (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
- Check Supabase dashboard status
- Check browser console for error details

---

## 📝 Technical Details

### What "Clear Cache" Does:
1. Clear `localStorage` (including activeBranchId)
2. Reset bootstrap flag (`_bootstrapDone = false`)
3. Force reload page (`window.location.reload()`)
4. Fresh fetch from Supabase on next load

### Data Flow After Clear:
```
Clear Cache Button Clicked
  ↓
localStorage.clear()
  ↓
window.location.reload()
  ↓
App restarts → bootstrap()
  ↓
Fetch from Supabase (no cache)
  ↓
setState with fresh data
  ↓
UI updates with database data ✓
```

---

## ✅ Verification Steps

Setelah clear cache, verify:

1. **Console Logs**
   - [ ] Lihat `[Bootstrap] Starting fresh...`
   - [ ] Lihat `Branches: 1 from Supabase ✓`
   - [ ] Tidak ada warning tentang fallback

2. **UI `/branches`**
   - [ ] Total Cabang: 1
   - [ ] Card menampilkan: "Klinik Subekti — Pusat"
   - [ ] Branch Code: "Subekti-01"
   - [ ] Info banner hijau/biru

3. **Header Branch Selector**
   - [ ] Dropdown shows: "Subekti-01 — Pusat"
   - [ ] Hanya 1 item di dropdown

4. **Debug Data**
   - [ ] Expand "Debug: Lihat Data Mentah"
   - [ ] Verify JSON match dengan database

---

## 🎉 Conclusion

Setelah mengikuti instruksi di atas, halaman `/branches` akan:
- ✅ Menampilkan data 100% dari database
- ✅ Tidak ada dummy/fallback data
- ✅ Sync dengan branch selector
- ✅ Clear indicator data source

---

**Last Updated**: 2026-07-20 08:21  
**Tested**: Pending user verification  
**Status**: Ready for testing
