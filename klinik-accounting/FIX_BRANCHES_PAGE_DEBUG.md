# 🔧 Fix: Branches Page Data Display - Debug Enhancement

**Tanggal:** 2026-07-20  
**Status:** ✅ Enhanced Debugging Implemented

## 📋 Masalah

Halaman `/branches` menampilkan "Belum ada data cabang" meskipun data ada di database:
- Database memiliki 1 record di tabel `clinic_entities`
- ID: `11111111-0001-0001-0001-000000000001`
- entity_name: "Klinik Subekti — Pusat"
- branch_code: "Subekti-01"

## 🔍 Analisis

### Data Flow
```
Database (clinic_entities)
  ↓ fetchBranches() in db.js
  ↓ snake_case → camelCase transformation
  ↓ bootstrap() in useStore.js
  ↓ setState({ branches: [...] })
  ↓ BranchesPage.jsx renders
```

### Yang Sudah Dicek ✅
1. **Database:** Data ada dan valid ✅
2. **RLS Policy:** `allow_all_clinic_entities` mengizinkan akses ✅
3. **Supabase Client:** Konfigurasi benar ✅
4. **fetchBranches():** Implementasi benar ✅
5. **Data Transformation:** `entity_name` → `entityName` bekerja ✅
6. **useStore fallback:** Sudah dihapus, hanya gunakan data dari DB ✅

### Kemungkinan Penyebab
1. **Browser Cache:** State lama tersimpan di browser memory
2. **Bootstrap Issue:** bootstrap() tidak dipanggil ulang dengan benar
3. **React State:** setState tidak trigger re-render

## ✨ Solusi yang Diterapkan

### 1. Enhanced Logging di `db.js`

Menambahkan detailed console logs di `fetchBranches()`:

```javascript
export async function fetchBranches() {
  console.log('[fetchBranches] Fetching from clinic_entities table...')
  const { data, error } = await supabase
    .from('clinic_entities').select('*').order('branch_code')
  console.log('[fetchBranches] Raw Supabase response:', { data, error })
  console.log('[fetchBranches] Data count:', data?.length || 0)
  if (data && data.length > 0) {
    console.log('[fetchBranches] First record (raw):', data[0])
  }
  handleError(error, 'fetchBranches')
  const normalized = normArr(data)
  console.log('[fetchBranches] After normalization:', normalized)
  if (normalized && normalized.length > 0) {
    console.log('[fetchBranches] First record (normalized):', normalized[0])
  }
  return normalized
}
```

**Tujuan:** Melacak setiap tahap fetch data dari database

### 2. Enhanced Logging di `useStore.js`

Menambahkan step-by-step logging di `bootstrap()`:

```javascript
console.log('[Bootstrap] Step 1: Fetching branches from clinic_entities table...')
const branchesRaw = await fetchBranches()
console.log('[Bootstrap] Branches fetched:', branchesRaw)
console.log('[Bootstrap] Branches count:', branchesRaw?.length || 0)
console.log('[Bootstrap] Branches raw data:', JSON.stringify(branchesRaw, null, 2))

// After all fetch
console.log('[Bootstrap] Step 3: Data Sources Summary:')
console.log('  - Branches:', finalBranches?.length > 0 ? `${finalBranches.length} from Supabase ✓` : '0 from Supabase (database empty)')
console.log('  - Branches Detail:', finalBranches)

if (finalBranches.length === 0) {
  console.warn('[Bootstrap] ⚠️ No branches in database. Please add branch via /branches page.')
} else {
  console.log('[Bootstrap] ✓ Successfully loaded', finalBranches.length, 'branches')
  finalBranches.forEach((b, idx) => {
    console.log(`  [${idx}] ${b.branchCode} - ${b.entityName} (ID: ${b.id})`)
  })
}
```

**Tujuan:** Melacak proses bootstrap dari awal sampai akhir

### 3. Debug Tools di `BranchesPage.jsx` (Sudah Ada)

- Button "Clear Cache" untuk hapus localStorage dan reload
- Button "Refresh" untuk force re-fetch dari database
- Auto-refresh saat page mount
- Debug info box dengan data mentah
- Console logs untuk tracking state changes

## 📝 Langkah Testing

### Langkah 1: Clear Browser State
```
1. Buka halaman /branches
2. Buka DevTools Console (F12)
3. Klik button "Clear Cache" (merah)
4. Page akan reload otomatis
```

### Langkah 2: Analisis Console Logs

Perhatikan urutan logs yang muncul:

```
[Bootstrap] Starting fresh data load from Supabase...
[Bootstrap] Reset state: {...}
[Bootstrap] Step 1: Fetching branches from clinic_entities table...
[fetchBranches] Fetching from clinic_entities table...
[fetchBranches] Raw Supabase response: {...}
[fetchBranches] Data count: 1
[fetchBranches] First record (raw): {...}
[fetchBranches] After normalization: [...]
[fetchBranches] First record (normalized): {...}
[Bootstrap] Branches fetched: [...]
[Bootstrap] Branches count: 1
[Bootstrap] Branches raw data: "..."
[Bootstrap] Step 3: Data Sources Summary:
  - Branches: 1 from Supabase ✓
  - Branches Detail: [...]
[Bootstrap] ✓ Successfully loaded 1 branches
  [0] Subekti-01 - Klinik Subekti — Pusat (ID: ...)
```

### Langkah 3: Identifikasi Issue

**Jika logs TIDAK muncul:**
- Bootstrap tidak dipanggil → Ada masalah di useStore hook initialization

**Jika logs muncul tapi data count = 0:**
- Supabase query tidak mengembalikan data → Cek RLS policy atau .env config

**Jika data count = 1 tapi UI masih empty:**
- setState tidak trigger re-render → Ada masalah di React state management

**Jika logs muncul sempurna tapi UI tidak update:**
- Browser cache sangat stubborn → Hard refresh (Ctrl+Shift+R) atau clear all site data

### Langkah 4: Force Refresh
```
1. Klik button "Refresh" (hijau)
2. Perhatikan logs di console
3. Verifikasi data muncul di UI
```

## 🎯 Expected Result

Setelah clear cache dan refresh, halaman `/branches` harus menampilkan:

```
┌─────────────────────────────────────────────┐
│ Total Cabang: 1                             │
│ Cabang Aktif: 1                             │
│ Cabang Aktif Saat Ini: Subekti-01          │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ 🏢 Klinik Subekti — Pusat        [PUSAT]  │
│ Subekti-01                        [ACTIVE]  │
│                                             │
│ 📞 021-12345678                            │
│ ✉️  pusat@antigravity-klinik.id           │
│                                             │
│ [✓ Cabang Aktif]  [✏️ Edit]                │
└─────────────────────────────────────────────┘
```

## 🚨 Troubleshooting

### Issue: Data tidak muncul setelah clear cache

**Solusi 1: Verify Supabase Connection**
```javascript
// Buka console, jalankan:
const { data, error } = await supabase.from('clinic_entities').select('*')
console.log({ data, error })
```

**Solusi 2: Check .env File**
```bash
# Pastikan file .env ada dan berisi:
VITE_SUPABASE_URL=https://jrnhkiljfudmzoglkisf.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

**Solusi 3: Hard Refresh Browser**
```
1. Tutup browser completely
2. Clear browser cache dari settings
3. Buka ulang dan test
```

### Issue: Console logs tidak muncul

**Kemungkinan:** useStore hook tidak ter-initialize

**Solusi:**
```javascript
// Check di BranchesPage.jsx, pastikan:
const { branches, ... } = useStore()

// Tambahkan log:
console.log('useStore hook mounted:', { branches })
```

### Issue: Data muncul di console tapi tidak di UI

**Kemungkinan:** React state management issue

**Solusi:**
```javascript
// Di BranchesPage.jsx, tambahkan:
useEffect(() => {
  console.log('[BranchesPage] Branches state changed:', branches)
}, [branches])
```

## 📊 Files Modified

1. ✅ `src/lib/db.js` - Enhanced logging di fetchBranches()
2. ✅ `src/store/useStore.js` - Enhanced logging di bootstrap()
3. ✅ `src/pages/BranchesPage.jsx` - Already has debug tools

## 🔄 Next Steps

1. **User action:** Buka /branches dan klik "Clear Cache"
2. **Monitor console:** Perhatikan detailed logs
3. **Report findings:** Share console output untuk diagnosis lebih lanjut
4. **If still not working:** Ada kemungkinan issue di level yang lebih dalam (React hooks lifecycle, Vite HMR, atau browser-specific bug)

---

**Note:** Enhanced debugging ini temporary untuk diagnosis. Setelah issue resolved, logs bisa dikurangi untuk production.
