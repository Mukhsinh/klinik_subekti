# Dokumentasi Analisis Permasalahan Sistem Informasi Akuntansi & Rekomendasi Perbaikan Sesuai Kaidah Akuntansi Berterima Umum (PABU)

---

## 1. Pendahuluan

Dokumen ini disusun untuk menganalisis berbagai temuan permasalahan, keterbatasan, dan ketidaksesuaian fungsi pada aplikasi Sistem Informasi Akuntansi (SIA) operasional klinik saat ini. Evaluasi dilakukan berdasarkan prinsip-prinsip akuntansi berterima umum (GAAP/PABU), Pernyataan Standar Akuntansi Keuangan (PSAK), serta praktik terbaik manajemen persediaan dan transaksi operasional medis.

Tujuan dari perbaikan ini adalah menciptakan sistem akuntansi yang **andal (*reliable*)**, **dapat ditelusuri (*auditable*)**, **terintegrasi secara otomatis (*real-time integration*)**, dan **menghasilkan laporan keuangan yang akurat**.

---

## 2. Matriks Analisis Permasalahan dan Rekomendasi Solusi

| No | Modul / Fungsi | Permasalahan Saat Ini | Ekspektasi Bisnis Operasional | Dampak Akuntansi & Risiko | Rekomendasi Perbaikan & Kaidah Akuntansi yang Benar |
|:--:|:---|:---|:---|:---|:---|
| **1** | **Input Obat** | Tidak bisa menginput nominal dengan koma (sen/desimal). | Dapat menginput angka desimal (koma) sesuai faktur/nota supplier. | Varians persediaan, kesalahan *unit cost*, dan pencatatan utang/kas yang tidak presisi (*rounding errors*). | Implementasikan format numerik *floating-point* (desimal 2 digit/`DECIMAL(18,2)`) di basis data dan UI. *Internal Control*: Pengakuan *Cost of Goods Sold* (HPP) dan Utang Usaha wajib presisi sesuai faktur. |
| **2** | **Input Obat** | Transaksi yang sudah diinput tidak dapat diedit/koreksi jika terjadi kesalahan. | Tersedia fitur edit/koreksi jika terjadi kesalahan input tanpa mengulang dari awal. | Risiko manipulasi data jika edit langsung (*direct overwrite*) tanpa jejak audit, atau inefisiensi jika harus hapus total. | Terapkan prinsip **Audit Trail** & **Jurnal Koreksi / Reversal**. Sistem tidak boleh menghapus/mengubah log asli. Edit dilakukan dengan membuat dokumen koreksi (retur/koreksi nilai) dan jurnal balik (*reversing entry*) secara otomatis. |
| **3** | **Input Obat** | Belum ada kolom input Tanggal Faktur / Tanggal Dokumen. | Tersedia kolom *Tanggal Faktur* agar transaksi dapat ditelusuri secara linier. | Ketidaksesuaian periode akuntansi (*cut-off assertion*), kesalahan pengakuan utang usaha, dan kesulitan penelusuran (*traceability*). | Wajib menambahkan atribut `Tanggal Faktur` (Vendor Date) dan `Tanggal Catat` (Posting Date). Penjurnalan dan laporan keuangan harus berbasis *Posting Date* sesuai **Accrual Basis** (PSAK 1). |
| **4** | **Penerimaan Obat (GRN)** | Header/summary (total kuantitas & total nilai GRN) tidak otomatis *update* saat item diinput. | Total kuantitas dan total nilai Penerimaan Barang (GRN) terhitung otomatis (*real-time*). | *Human error* dalam perhitungan manual, ketidakseimbangan saldo penerimaan barang, dan laporan persediaan tidak akurat. | Gunakan kalkulasi *real-time* / *reactive state* pada UI & triggers basis data. Setiap penambahan item baris (*line item*) secara otomatis memperbarui *header totals* untuk menjaga konsistensi data. |
| **5** | **Penerimaan Obat (GRN)** | Tampilan input penerimaan obat hilang / kurang informatif. | Tampilan informatif dan menyajikan detail hasil inputan secara presisi. | Kesalahan penginputan data barang, tipe obat, kuantitas, dan harga beli akibat kurangnya konfirmasi visual. | Redesain UI/UX Formulir Penerimaan Barang (*Goods Receipt Note*). Tampilkan detail ringkasan: Kode Barang, Nama Obat, No. Batch, Tanggal Kadaluarsa (*Expired Date*), Satuan, Qty Received, Unit Cost, Subtotal, dan Grand Total. |
| **6** | **Pengeluaran Manual** | Pilihan pengeluaran belum mencakup "Paketan Pasien". | Tambahkan opsi pengeluaran manual untuk "Paketan Pasien". | Pengeluaran obat/BHP paketan tidak tercatat otomatis, menyebabkan *untracked inventory loss* dan kesalahan pembebanan biaya. | Tambahkan opsi *Issue Type*: **Paketan Pasien**. Integrasikan dengan *Bill of Materials* (BOM) / Paket Medis. Jurnal Otomatis: **(D) Beban Obat/BHP - Paketan / HPP** dan **(K) Persediaan Obat**. |
| **7** | **Pengeluaran Manual** | Pilihan pengeluaran belum mencakup "Penyesuaian" (*Adjustment*). | Tambahkan opsi pengeluaran manual untuk "Penyesuaian Stock". | Penyesuaian akibat obat rusak, kadaluarsa, atau selisih opname tidak dapat dibukukan secara akurat. | Tambahkan opsi *Issue Type*: **Penyesuaian Persediaan (Inventory Adjustment)**. Jurnal Otomatis: **(D) Beban Kerugian Selisih Persediaan / Obat Kadaluarsa** dan **(K) Persediaan Obat**. |
| **8** | **Stok Barang & Rumus** | Pengeluaran barang belum terhubung ke stok persediaan secara otomatis. | Pengeluaran barang memotong sisa stok secara terintegrasi dari penerimaan hingga pengeluaran. | *Negative stock*, persediaan *phantom*, dan ketidaksesuaian antara fisik obat dengan catatan akuntansi. | Integrasikan seluruh transaksi persediaan menggunakan metode **Perpetual Inventory System** dan metode penilaian **FIFO** (*First-In, First-Out*) atau **Moving Average** sesuai PSAK 14. |
| **9** | **Jurnal Pendapatan** | Pembentuk jurnal otomatis untuk *Pendapatan Konsultasi Dokter Spesialis* tidak sesuai COA. | Jurnal otomatis sesuai dengan akun "Pendapatan Konsultasi Dokter Spesialis". | Laporan Laba Rugi menyajikan klasifikasi pendapatan yang salah (*misclassification error*). | Tinjau dan perbaiki *Posting Matrix / Auto-Journal Mapping*. Transaksi Konsultasi Spesialis harus otomatis mendebet Kas/Piutang dan mengkredit akun COA spesifik: **Pendapatan Jasa Konsultasi Dokter Spesialis**. |
| **10** | **Perhitungan Jasa Medis** | Skema perhitungan Jasa Medis (JM) keliru/belum sesuai *rule* bisnis klinik. | JM Konsultasi: Flatt Rp 100.000. Tindakan > Rp 1.000.000: Maksimal JM Rp 1.000.000 (sisanya bagian klinik). | Kesalahan pembayaran ke dokter (utang JM membengkak atau undersettled), merugikan arus kas klinik. | Terapkan *Business Logic Rule Engine* pada perhitungan JM: <br>- `JM Konsultasi = Rp 100.000`<br>- `JM Tindakan = MIN(Nilai Tindakan * %JM, 1.000.000)`<br>Jurnal Otomatis: **(D) Pendapatan Gross**, **(K) Utang Jasa Medis Dokter**, **(K) Pendapatan Bersih Klinik**. |
| **11** | **Bahan Habis Pakai (BHP)** | Komponen tarif Rp 150.000 dicatat seluruhnya sebagai Jasa Medis (seharusnya Rp 50.000 BHP). | Jasa medis Rp 100.000, sedangkan Rp 50.000 merupakan Pendapatan/Penggantian BHP Klinik. | Overstatement Utang Jasa Medis Dokter dan Understatement Pendapatan BHP/Klinik. | Pisahkan struktur tarif (*Tariff Split*): <br>- Tarif Total: Rp 150.000<br>- Portion JM Dokter: Rp 100.000<br>- Portion BHP Klinik: Rp 50.000<br>Jurnal: **(D) Kas/Piutang Rp 150k**, **(K) Utang JM Rp 100k**, **(K) Pendapatan BHP Rp 50k**. |
| **12** | **Filter Laporan** | Belum ada filter laporan pendapatan per dokter spesialis. | Tersedia filter transaksi/pendapatan berdasarkan masing-masing dokter. | Kesulitan analisis performa per dokter dan validasi rekapitulasi *payout* jasa medis. | Tambahkan atribut `Doctor_ID` pada tabel header transaksi. Sediakan modul laporan *Revenue & Medical Fee Breakdown by Doctor* berbasis filter tanggal dan nama dokter. |
| **13** | **Chart of Accounts (COA)** | Input transaksi menginput akun objek, belum otomatis *summing* dari sub-rincian. | Input dilakukan pada *Sub-Rincian* (Child Account), Rekening Objek (Parent Account) menggunakan rumus/hierarki. | Kesalahan hirarki laporan keuangan, struktur COA tidak rapi, dan potensi *double counting*. | Terapkan **Hierarchical Chart of Accounts (Parent-Child Structure)**. Batasi transaksi *postings* **hanya pada level terendah (Header = False / Detail Account)**. Saldo Parent Account terhitung secara rollup/agregasi otomatis. |
| **14** | **Format Angka / Currency** | Nominal angka pada inputan & laporan tidak menggunakan separator ribuan (titik/koma). | Nominal rupiah menggunakan format standar yang benar (Contoh: `Rp 5.000,02`). | Kesulitan membaca nominal, potensi salah baca digit (misal: 50000 vs 500000). | Terapkan *Localization Formatter* (Format Indonesia `id-ID`): titik (`.`) sebagai pemisah ribuan dan koma (`,`) sebagai pemisah desimal di seluruh UI dan Laporan Keuangan. |
| **15** | **Laporan Keuangan** | Laporan Keuangan masih keliru dan tidak terhubung dengan transaksi/jurnal. | Laporan Keuangan terhubung penuh (*real-time*) dengan seluruh transaksi & jurnal manual. | Laporan Keuangan tidak valid dan tidak dapat dipercaya (*unreliable financial statements*). | Menerapkan arsitektur **General Ledger (Buku Besar Utama)** yang secara otomatis diposting dari modul transaksi (*Sub-ledger*) maupun *General Journal Entry*. |
| **16** | **Buku Besar** | Buku Besar keliru (penerimaan obat belum terposting ke Buku Besar). | Buku Besar terhubung mutlak ke seluruh transaksi (penerimaan obat, pengeluaran, jurnal). | Saldo persediaan dan utang usaha pada Laporan Posisi Keuangan (Neraca) *out-of-balance*. | Integrasikan modul Penerimaan Obat (GRN) ke Buku Besar secara otomatis via Jurnal Otomatis: **(D) Persediaan Obat** & **(K) Utang Usaha / Kas**. |
| **17** | **Modul Jurnal Manual** | Jurnal umum belum bisa memilih akun (pilihan akun belum tersedia). | Pengguna dapat memilih daftar COA aktif saat membuat Jurnal Umum manual. | Transaksi non-operasional/penyesuaian tidak dapat dicatat ke sistem. | Buat modul *General Journal Entry* dengan fitur *Dropdown/Searchable Autocomplete COA List* yang tervalidasi aktif. Terapkan aturan *Balanced Entry* (Total Debet wajib sama dengan Total Kredit). |
| **18** | **Laporan Perubahan Modal** | Laporan Perubahan Modal belum tersedia di dalam aplikasi. | Menyediakan Laporan Perubahan Ekuitas yang terintegrasi. | Informasi mengenai saldo laba ditahan (*retained earnings*), deviden, atau injeksi modal tidak tersaji. | Buat modul **Laporan Perubahan Ekuitas (Statement of Changes in Equity)** yang menarik data dari Saldo Awal Modal + Laba/Rugi Bersih Periode Berjalan (dari Laba Rugi) - Setoran/Prive. |
| **19** | **Saldo Awal & Integration** | Saldo awal belum terhubung ke perhitungan transaksi berjalan. | Saldo Awal terintegrasi penuh ke Buku Besar dan Laporan Keuangan. | Saldo akhir periode tidak merefleksikan kondisi keuangan yang sebenarnya (*historical mismatch*). | Sediakan modul khusus **Input Saldo Awal (Beginning Balance)**. Formula Saldo Akhir Buku Besar: `Saldo Akhir = Saldo Awal + Total Mutasi Debet - Total Mutasi Kredit`. |

---

## 3. Arsitektur Jurnal Akuntansi Standar (Auto-Journal Rules)

Untuk menjamin kepatuhan terhadap kaidah akuntansi berterima umum, berikut adalah matriks pemetaan jurnal otomatis (*Auto-Posting Rules*) yang harus diterapkan pada sistem:

### 3.1. Transaksi Penerimaan Obat (Goods Receipt Note - GRN)
* **Kondisi**: Penerimaan obat dari Vendor/Supplier secara Kredit.
  * **(D) Persediaan Obat / BHP** `[Nilai Faktur Presisi + Desimal]`
  * **(K) Utang Usaha** `[Nilai Faktur Presisi + Desimal]`

### 3.2. Transaksi Pengeluaran Obat / BHP (Paketan Pasien)
* **Kondisi**: Penggunaan obat/BHP untuk operasional medis paketan.
  * **(D) Beban Obat & BHP (HPP)** `[Nominal FIFO/Average]`
  * **(K) Persediaan Obat / BHP** `[Nominal FIFO/Average]`

### 3.3. Transaksi Penyesuaian Stok (Inventory Adjustment / Stock Opname)
* **Kondisi**: Pengeluaran obat akibat kadaluarsa, rusak, atau selisih kurang.
  * **(D) Beban Kerugian Selisih Persediaan / Obat Expired** `[Nominal]`
  * **(K) Persediaan Obat / BHP** `[Nominal]`

### 3.4. Transaksi Pendapatan Konsultasi Spesialis & BHP
* **Contoh Kasus**: Pasien membayar Paket Konsultasi + BHP Total Rp 150.000 (JM Dokter Rp 100.000, BHP Klinik Rp 50.000).
  * **(D) Kas / Bank / Piutang Pasien** `Rp 150.000`
  * **(K) Utang Jasa Medis Dokter Spesialis** `Rp 100.000`
  * **(K) Pendapatan BHP / Operasional Klinik** `Rp 50.000`

---

## 4. Struktur Hierarki Chart of Accounts (COA) & Rule Desain

Sistem harus membedakan dengan tegas antara **Header Account** (Parent) dan **Detail Account** (Child).

### Contoh Struktur COA:
```text
1000 - ASET (Header - Non Posting)
  └── 1100 - ASET LANCAR (Header - Non Posting)
        ├── 1110 - Kas & Bank (Header - Non Posting)
        │     ├── 1111 - Kas Kasir Klinik (Detail - POSTING)
        │     └── 1112 - Bank BCA Operasional (Detail - POSTING)
        └── 1130 - Persediaan (Header - Non Posting)
              ├── 1131 - Persediaan Obat-Obatan (Detail - POSTING)
              └── 1132 - Persediaan BHP Medis (Detail - POSTING)
```

**Kaidah Pengkodean & Rule Aplikasi:**
1. **Aturan Transaksi**: Transaksi jurnal *hanya boleh* diinput pada akun bertipe **Detail (Postable)**.
2. **Aturan Konsolidasi**: Saldo pada akun **Header** dihitung otomatis dari penjumlahan (*rollup sum*) seluruh anak akun di bawahnya:
   $$	ext{Saldo Header} = \sum_{i=1}^{n} 	ext{Saldo Detail Account}_i$$

---

## 5. Rencana Aksi Pengembangan & Implementasi Sistem

```
[Fase 1: Core Engine & COA] ──► [Fase 2: Sub-ledger Integrasi] ──► [Fase 3: Reporting & Audit Trail]
  • Perbaikan DB Format Desimal   • Penerimaan & Pengeluaran Stok   • Buku Besar & Neraca Saldo
  • Re-strukturisasi COA          • Rule Perhitungan Jasa Medis     • Laporan Laba Rugi & Perubahan Modal
  • Modul Saldo Awal              • Auto-Journal Generator          • Audit Log & Koreksi Transaksi
```

### Rekomendasi Fitur Teknis Sistem:
1. **Audit Trail Matrix**: Menyimpan log pencatatan `created_by`, `created_at`, `updated_by`, `updated_at`, serta `cancellation_reason`.
2. **Validation Engine**:
   - Blokir simpan jurnal jika `Total Debet != Total Kredit`.
   - Blokir pengeluaran barang jika `Stok Tersedia < Qty Keluar` (jika tidak diizinkan *backorder*).
3. **Formatter Standard**:
   - Tampilan UI & Export PDF/Excel wajib menggunakan format numerik Indonesia (`#,##0.00`).
