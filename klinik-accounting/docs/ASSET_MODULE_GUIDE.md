# Panduan Modul Manajemen Aset Tetap

## Overview
Modul Manajemen Aset Tetap adalah sistem terintegrasi untuk mengelola inventarisasi aset tetap klinik, mutasi aset, dan kalkulasi penyusutan menggunakan metode garis lurus (straight-line method) tanpa nilai residu.

## Fitur Utama

### 1. Inventarisasi Aset Tetap (`AssetInventoryPage.jsx`)
**Path:** `/assets/inventory`

#### Fitur:
- ✅ Master data aset tetap dengan informasi lengkap
- ✅ Kategorisasi aset (Peralatan Medis, Perabot, Kendaraan, Bangunan, Komputer & Elektronik)
- ✅ Tracking kondisi aset (Baik, Rusak, Dalam Perbaikan)
- ✅ Integrasi COA otomatis berdasarkan kategori
- ✅ Kalkulasi otomatis nilai buku dan akumulasi penyusutan
- ✅ Filter by kategori dan search
- ✅ Summary cards (Total Aset, Harga Perolehan, Akumulasi Penyusutan, Nilai Buku)

#### Data Fields:
- `assetCode`: Kode unik aset (auto-generated, contoh: MED-0001)
- `assetName`: Nama aset
- `category`: Kategori aset
- `acquisitionCost`: Harga perolehan (Rp)
- `acquisitionDate`: Tanggal perolehan
- `usefulLifeYears`: Umur ekonomis (tahun)
- `location`: Lokasi aset
- `department`: Departemen pengguna
- `condition`: Kondisi aset
- `description`: Keterangan tambahan
- `bookValue`: Nilai buku (Harga Perolehan - Akumulasi Penyusutan)
- `accumulatedDepreciation`: Total akumulasi penyusutan
- `status`: Status aset (ACTIVE, DISPOSED, SOLD)

#### COA Mapping:
Setiap kategori aset memiliki mapping COA otomatis:

| Kategori | Akun Aset | Akun Beban Penyusutan | Akun Akumulasi |
|----------|-----------|----------------------|----------------|
| Peralatan Medis | 1-14-001 | 6-21-001 | 1-15-001 |
| Perabot & Perlengkapan | 1-14-002 | 6-21-002 | 1-15-002 |
| Kendaraan | 1-14-003 | 6-21-003 | 1-15-003 |
| Bangunan | 1-14-004 | 6-21-004 | 1-15-004 |
| Komputer & Elektronik | 1-14-005 | 6-21-005 | 1-15-005 |

### 2. Penyusutan Aset (`AssetDepreciationPage.jsx`)
**Path:** `/assets/depreciation`

#### Fitur:
- ✅ Kalkulasi penyusutan bulanan metode garis lurus
- ✅ Multi-select aset untuk batch processing
- ✅ Draft & Post system dengan workflow approval
- ✅ Grouping by period (tahun & bulan)
- ✅ Auto-update nilai buku aset setelah posting
- ✅ Integrasi dengan jurnal akuntansi (coming soon)
- ✅ Filter by tahun dan bulan
- ✅ Summary statistics

#### Formula Penyusutan:
```
Beban Penyusutan per Bulan = Harga Perolehan ÷ (Umur Ekonomis × 12 bulan)
Nilai Buku = Harga Perolehan - Akumulasi Penyusutan
```

#### Workflow:
1. **Pilih Periode**: Tentukan tahun dan bulan penyusutan
2. **Pilih Aset**: Select aset yang akan dihitung penyusutannya
3. **Hitung & Simpan**: Sistem menghitung otomatis dan menyimpan sebagai DRAFT
4. **Review**: Periksa hasil kalkulasi
5. **Post**: Posting penyusutan akan:
   - Mengupdate status menjadi POSTED
   - Mengupdate akumulasi penyusutan aset
   - Mengupdate nilai buku aset
   - Membuat jurnal otomatis (future enhancement)

#### Status Penyusutan:
- **DRAFT**: Dapat diedit/dihapus, belum mempengaruhi nilai buku
- **POSTED**: Tidak dapat diubah, sudah mempengaruhi nilai buku aset
- **REVERSED**: Dibatalkan (future enhancement)

### 3. Mutasi Aset
**Path:** `/assets/mutations` (Coming Soon)

Akan mencatat:
- Pembelian aset baru
- Penjualan aset
- Transfer lokasi
- Penghapusan aset
- Revaluasi aset

### 4. Kartu Inventaris Aset
**Path:** `/assets/card` (Coming Soon)

Laporan detail per aset mencakup:
- Informasi lengkap aset
- Riwayat mutasi
- Riwayat penyusutan
- Nilai buku historis

## Database Schema

### 1. Table: `fixed_assets`
```sql
- id (UUID, PK)
- asset_code (VARCHAR, UNIQUE)
- asset_name (VARCHAR)
- category (VARCHAR)
- acquisition_cost (NUMERIC)
- acquisition_date (DATE)
- useful_life_years (INTEGER)
- location (VARCHAR)
- department (VARCHAR)
- condition (ENUM: BAIK, RUSAK, DALAM_PERBAIKAN)
- description (TEXT)
- coa_asset_code (VARCHAR, FK)
- coa_depreciation_code (VARCHAR, FK)
- coa_accumulated_code (VARCHAR, FK)
- accumulated_depreciation (NUMERIC)
- book_value (NUMERIC)
- last_depreciation_date (DATE)
- status (ENUM: ACTIVE, DISPOSED, SOLD)
- disposal_date (DATE)
- disposal_value (NUMERIC)
- created_at, updated_at
```

### 2. Table: `asset_mutations`
```sql
- id (UUID, PK)
- asset_id (UUID, FK)
- mutation_type (ENUM: ACQUISITION, DISPOSAL, SALE, TRANSFER, REVALUATION)
- mutation_date (DATE)
- reference_number (VARCHAR)
- amount (NUMERIC)
- from_location, to_location (VARCHAR)
- disposal_value, gain_loss_amount (NUMERIC)
- journal_entry_id (UUID, FK)
- created_at
```

### 3. Table: `asset_depreciations`
```sql
- id (UUID, PK)
- asset_id (UUID, FK)
- period_year (SMALLINT)
- period_month (SMALLINT)
- opening_book_value (NUMERIC)
- depreciation_amount (NUMERIC)
- closing_book_value (NUMERIC)
- calculation_method (VARCHAR, DEFAULT 'STRAIGHT_LINE')
- status (ENUM: DRAFT, POSTED, REVERSED)
- journal_entry_id (UUID, FK)
- posted_at, posted_by
- created_at
- UNIQUE(asset_id, period_year, period_month)
```

### 4. Stored Function: `calculate_monthly_depreciation`
```sql
calculate_monthly_depreciation(
    p_asset_id UUID,
    p_year SMALLINT,
    p_month SMALLINT
) RETURNS NUMERIC
```
Menghitung beban penyusutan bulanan dengan validasi:
- Aset harus ACTIVE
- Tidak menghitung sebelum tanggal perolehan
- Stop setelah fully depreciated

## Integration Points

### Supabase Functions (`db.js`)
```javascript
// Fixed Assets
fetchFixedAssets(filters)
upsertFixedAsset(asset)
updateFixedAsset(id, updates)
deleteFixedAsset(id)

// Mutations
fetchAssetMutations(assetId)
insertAssetMutation(mutation)

// Depreciations
fetchAssetDepreciations(filters)
upsertAssetDepreciation(depreciation)
updateDepreciationStatus(id, status, extras)
calculateMonthlyDepreciation(assetId, year, month)
```

### Store Functions (`useStore.js`)
```javascript
// Asset Management
generateAssetCode(category)
addAsset(data)
updateAsset(id, data)
deleteAsset(id)

// Mutations
addAssetMutation(mutation)

// Depreciations
calculateDepreciation(assetId, year, month)
saveDepreciation(depreciation)
postDepreciation(depreciationId, postedBy)
```

## Business Rules

### 1. Penyusutan
- **Metode**: Garis Lurus (Straight-Line)
- **Nilai Residu**: Nihil (Rp 0)
- **Periode**: Bulanan
- **Formula**: Harga Perolehan ÷ (Umur Ekonomis × 12)
- **Stop Condition**: Nilai buku = 0 atau aset disposed

### 2. Nilai Buku
- Nilai Buku = Harga Perolehan - Akumulasi Penyusutan
- Minimum nilai buku = Rp 0
- Update otomatis setelah posting penyusutan

### 3. Status Aset
- **ACTIVE**: Aset masih digunakan, dapat disusutkan
- **DISPOSED**: Aset dihapus (rusak/tidak terpakai)
- **SOLD**: Aset dijual

### 4. Validasi
- Kode aset harus unik
- Harga perolehan > 0
- Umur ekonomis > 0
- Tidak boleh ada 2 penyusutan untuk aset yang sama di periode yang sama

## Future Enhancements

### Phase 2:
- [ ] Auto-generate jurnal saat posting penyusutan
- [ ] Mutasi aset lengkap (acquisition, disposal, sale)
- [ ] Laba/rugi pelepasan aset
- [ ] Export laporan aset (Excel, PDF)
- [ ] Barcode/QR code untuk aset
- [ ] Upload foto aset
- [ ] Maintenance log per aset

### Phase 3:
- [ ] Asset revaluation
- [ ] Depreciation method options (declining balance, sum of years digits)
- [ ] Asset disposal wizard dengan jurnal otomatis
- [ ] Asset transfer between locations/departments
- [ ] Scheduled depreciation posting
- [ ] Dashboard analytics untuk aset

## Compliance

### Standar Akuntansi:
- ✅ PSAK 16 - Aset Tetap
- ✅ PSAK 48 - Penurunan Nilai Aset
- ✅ ISAK 35 - Penyusutan

### Perpajakan:
- ⚠️ Note: Penyusutan fiskal mungkin berbeda dengan penyusutan komersial
- ⚠️ Konsultasi dengan tax advisor untuk penyesuaian fiskal

## Testing Checklist

### Unit Tests:
- [ ] Calculate depreciation formula
- [ ] Book value calculation
- [ ] COA mapping per category
- [ ] Status transitions

### Integration Tests:
- [ ] Add/edit/delete assets
- [ ] Calculate and post depreciation
- [ ] Multi-asset depreciation batch
- [ ] Filter and search functionality

### E2E Tests:
- [ ] Complete asset lifecycle
- [ ] Depreciation workflow (draft → post)
- [ ] Report generation

## Support & Documentation
- Developer: Klinik Medis Antigravity
- Version: 1.0.0
- Last Updated: 2026-07-18
- Database: Supabase PostgreSQL
- Framework: React + Vite

## Related Files
```
src/
├── pages/
│   └── assets/
│       ├── AssetInventoryPage.jsx      # Master aset
│       └── AssetDepreciationPage.jsx   # Penyusutan
├── store/
│   └── useStore.js                     # State management + asset functions
├── lib/
│   ├── db.js                           # Supabase queries
│   └── supabase.js                     # Supabase client
└── App.jsx                             # Routes

database/
└── 04_asset_management_schema.sql      # DB schema + functions
```

---

**Contact**: tim-dev@klinik-antigravity.com
**Documentation**: https://docs.klinik-antigravity.com/assets
