-- ============================================================
-- ASSET MANAGEMENT MODULE - Fixed Assets & Depreciation
-- Date: 2026-07-18
-- Purpose: Manajemen aset tetap, mutasi, dan kalkulasi penyusutan
-- ============================================================

-- ============================================================
-- 1. MASTER ASET TETAP (Fixed Assets)
-- ============================================================
CREATE TABLE IF NOT EXISTS fixed_assets (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_code           VARCHAR(20)  UNIQUE NOT NULL,
    asset_name           VARCHAR(150) NOT NULL,
    category             VARCHAR(50)  NOT NULL,
    acquisition_cost     NUMERIC(15,2) NOT NULL CHECK (acquisition_cost >= 0),
    acquisition_date     DATE NOT NULL,
    useful_life_years    INTEGER NOT NULL CHECK (useful_life_years > 0),
    location             VARCHAR(100),
    department           VARCHAR(100),
    condition            VARCHAR(20) NOT NULL DEFAULT 'BAIK' 
                         CHECK (condition IN ('BAIK', 'RUSAK', 'DALAM_PERBAIKAN')),
    description          TEXT,
    
    -- COA linkage
    coa_asset_code       VARCHAR(10) NOT NULL REFERENCES chart_of_accounts(account_code),
    coa_depreciation_code VARCHAR(10) NOT NULL REFERENCES chart_of_accounts(account_code),
    coa_accumulated_code VARCHAR(10) NOT NULL REFERENCES chart_of_accounts(account_code),
    
    -- Depreciation tracking
    accumulated_depreciation NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (accumulated_depreciation >= 0),
    book_value           NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (book_value >= 0),
    last_depreciation_date DATE,
    
    -- Status
    status               VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
                         CHECK (status IN ('ACTIVE', 'DISPOSED', 'SOLD')),
    disposal_date        DATE,
    disposal_value       NUMERIC(15,2),
    disposal_method      VARCHAR(50),
    
    -- Audit
    created_by           VARCHAR(100),
    created_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index untuk performa
CREATE INDEX IF NOT EXISTS idx_fixed_assets_status ON fixed_assets(status);
CREATE INDEX IF NOT EXISTS idx_fixed_assets_location ON fixed_assets(location);
CREATE INDEX IF NOT EXISTS idx_fixed_assets_category ON fixed_assets(category);
CREATE INDEX IF NOT EXISTS idx_fixed_assets_code ON fixed_assets(asset_code);

COMMENT ON TABLE fixed_assets IS 'Master data aset tetap dengan tracking penyusutan metode garis lurus tanpa nilai residu';
COMMENT ON COLUMN fixed_assets.useful_life_years IS 'Umur ekonomis aset dalam tahun (untuk kalkulasi penyusutan)';
COMMENT ON COLUMN fixed_assets.accumulated_depreciation IS 'Total akumulasi penyusutan sejak perolehan';
COMMENT ON COLUMN fixed_assets.book_value IS 'Nilai buku = Harga Perolehan - Akumulasi Penyusutan';

-- ============================================================
-- 2. MUTASI ASET (Asset Transactions)
-- ============================================================
CREATE TABLE IF NOT EXISTS asset_mutations (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id             UUID NOT NULL REFERENCES fixed_assets(id) ON DELETE RESTRICT,
    mutation_type        VARCHAR(30) NOT NULL 
                         CHECK (mutation_type IN ('ACQUISITION', 'DISPOSAL', 'SALE', 'TRANSFER', 'REVALUATION')),
    mutation_date        DATE NOT NULL,
    reference_number     VARCHAR(50),
    
    -- Transaction details
    amount               NUMERIC(15,2) NOT NULL DEFAULT 0,
    quantity             INTEGER DEFAULT 1,
    from_location        VARCHAR(100),
    to_location          VARCHAR(100),
    description          TEXT,
    
    -- For disposal/sale
    disposal_value       NUMERIC(15,2),
    gain_loss_amount     NUMERIC(15,2),
    
    -- Journal linkage
    journal_entry_id     UUID REFERENCES journal_entries(id),
    
    -- Audit
    created_by           VARCHAR(100),
    authorized_by        VARCHAR(100),
    created_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asset_mutations_asset ON asset_mutations(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_mutations_type ON asset_mutations(mutation_type);
CREATE INDEX IF NOT EXISTS idx_asset_mutations_date ON asset_mutations(mutation_date);

COMMENT ON TABLE asset_mutations IS 'Riwayat mutasi aset: pembelian, penjualan, transfer lokasi, penghapusan';
COMMENT ON COLUMN asset_mutations.mutation_type IS 'ACQUISITION=pembelian baru, DISPOSAL=penghapusan rusak, SALE=penjualan, TRANSFER=pindah lokasi, REVALUATION=revaluasi';
COMMENT ON COLUMN asset_mutations.gain_loss_amount IS 'Laba/rugi pelepasan aset (positif=laba, negatif=rugi)';

-- ============================================================
-- 3. KALKULASI PENYUSUTAN (Depreciation Calculations)
-- ============================================================
CREATE TABLE IF NOT EXISTS asset_depreciations (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id             UUID NOT NULL REFERENCES fixed_assets(id) ON DELETE CASCADE,
    period_year          SMALLINT NOT NULL CHECK (period_year >= 2020 AND period_year <= 2100),
    period_month         SMALLINT NOT NULL CHECK (period_month >= 1 AND period_month <= 12),
    
    -- Depreciation calculation
    opening_book_value   NUMERIC(15,2) NOT NULL,
    depreciation_amount  NUMERIC(15,2) NOT NULL CHECK (depreciation_amount >= 0),
    closing_book_value   NUMERIC(15,2) NOT NULL CHECK (closing_book_value >= 0),
    
    -- Details
    calculation_method   VARCHAR(30) DEFAULT 'STRAIGHT_LINE',
    calculation_date     DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Journal linkage
    journal_entry_id     UUID REFERENCES journal_entries(id),
    
    -- Status
    status               VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
                         CHECK (status IN ('DRAFT', 'POSTED', 'REVERSED')),
    posted_at            TIMESTAMP WITH TIME ZONE,
    posted_by            VARCHAR(100),
    
    -- Audit
    created_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint: 1 depreciation record per asset per period
    UNIQUE(asset_id, period_year, period_month)
);

CREATE INDEX IF NOT EXISTS idx_asset_depreciations_asset ON asset_depreciations(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_depreciations_period ON asset_depreciations(period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_asset_depreciations_status ON asset_depreciations(status);

COMMENT ON TABLE asset_depreciations IS 'Riwayat kalkulasi penyusutan bulanan per aset dengan metode garis lurus';
COMMENT ON COLUMN asset_depreciations.depreciation_amount IS 'Beban penyusutan bulan ini = (Harga Perolehan / Umur Ekonomis) / 12';
COMMENT ON COLUMN asset_depreciations.calculation_method IS 'STRAIGHT_LINE = metode garis lurus tanpa nilai residu';

-- ============================================================
-- 4. ADD NEW COA ACCOUNTS FOR ASSETS
-- ============================================================
-- Asset accounts (1-14-xxx)
INSERT INTO chart_of_accounts (account_code, account_name, account_type, account_group, account_subgroup, natural_balance, is_header, sort_order)
VALUES
  ('1-14-000', 'ASET TETAP', 'ASSET', 'ASET TETAP', NULL, 'DEBIT', TRUE, 140),
  ('1-14-001', 'Peralatan Medis', 'ASSET', 'ASET TETAP', 'Peralatan', 'DEBIT', FALSE, 141),
  ('1-14-002', 'Perabot & Perlengkapan', 'ASSET', 'ASET TETAP', 'Perabot', 'DEBIT', FALSE, 142),
  ('1-14-003', 'Kendaraan', 'ASSET', 'ASET TETAP', 'Kendaraan', 'DEBIT', FALSE, 143),
  ('1-14-004', 'Bangunan', 'ASSET', 'ASET TETAP', 'Bangunan', 'DEBIT', FALSE, 144),
  ('1-14-005', 'Komputer & Elektronik', 'ASSET', 'ASET TETAP', 'Elektronik', 'DEBIT', FALSE, 145),
  
  -- Accumulated depreciation (1-15-xxx)
  ('1-15-000', 'AKUMULASI PENYUSUTAN', 'ASSET', 'ASET TETAP', NULL, 'CREDIT', TRUE, 150),
  ('1-15-001', 'Akumulasi Penyusutan Peralatan Medis', 'ASSET', 'ASET TETAP', 'Akumulasi Penyusutan', 'CREDIT', FALSE, 151),
  ('1-15-002', 'Akumulasi Penyusutan Perabot', 'ASSET', 'ASET TETAP', 'Akumulasi Penyusutan', 'CREDIT', FALSE, 152),
  ('1-15-003', 'Akumulasi Penyusutan Kendaraan', 'ASSET', 'ASET TETAP', 'Akumulasi Penyusutan', 'CREDIT', FALSE, 153),
  ('1-15-004', 'Akumulasi Penyusutan Bangunan', 'ASSET', 'ASET TETAP', 'Akumulasi Penyusutan', 'CREDIT', FALSE, 154),
  ('1-15-005', 'Akumulasi Penyusutan Komputer', 'ASSET', 'ASET TETAP', 'Akumulasi Penyusutan', 'CREDIT', FALSE, 155),
  
  -- Depreciation expense (6-21-xxx)
  ('6-21-000', 'BEBAN PENYUSUTAN', 'EXPENSE', 'BEBAN OPERASIONAL', NULL, 'DEBIT', TRUE, 621),
  ('6-21-001', 'Beban Penyusutan Peralatan Medis', 'EXPENSE', 'BEBAN OPERASIONAL', 'Beban Penyusutan', 'DEBIT', FALSE, 622),
  ('6-21-002', 'Beban Penyusutan Perabot', 'EXPENSE', 'BEBAN OPERASIONAL', 'Beban Penyusutan', 'DEBIT', FALSE, 623),
  ('6-21-003', 'Beban Penyusutan Kendaraan', 'EXPENSE', 'BEBAN OPERASIONAL', 'Beban Penyusutan', 'DEBIT', FALSE, 624),
  ('6-21-004', 'Beban Penyusutan Bangunan', 'EXPENSE', 'BEBAN OPERASIONAL', 'Beban Penyusutan', 'DEBIT', FALSE, 625),
  ('6-21-005', 'Beban Penyusutan Komputer', 'EXPENSE', 'BEBAN OPERASIONAL', 'Beban Penyusutan', 'DEBIT', FALSE, 626),
  
  -- Gain/Loss on disposal (8-91-001)
  ('8-91-001', 'Laba Pelepasan Aset Tetap', 'REVENUE', 'PENDAPATAN LAIN', 'Gain/Loss Aset', 'CREDIT', FALSE, 891),
  ('6-99-001', 'Rugi Pelepasan Aset Tetap', 'EXPENSE', 'BEBAN LAIN-LAIN', 'Gain/Loss Aset', 'DEBIT', FALSE, 699)
ON CONFLICT (account_code) DO NOTHING;

-- ============================================================
-- 5. TRIGGERS & FUNCTIONS
-- ============================================================

-- Trigger untuk update book_value otomatis
CREATE OR REPLACE FUNCTION update_asset_book_value()
RETURNS TRIGGER AS $$
BEGIN
    NEW.book_value := NEW.acquisition_cost - NEW.accumulated_depreciation;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_asset_book_value ON fixed_assets;
CREATE TRIGGER trg_update_asset_book_value
    BEFORE UPDATE ON fixed_assets
    FOR EACH ROW
    WHEN (OLD.accumulated_depreciation IS DISTINCT FROM NEW.accumulated_depreciation)
    EXECUTE FUNCTION update_asset_book_value();

-- Function untuk kalkulasi penyusutan bulanan
CREATE OR REPLACE FUNCTION calculate_monthly_depreciation(
    p_asset_id UUID,
    p_year SMALLINT,
    p_month SMALLINT
) RETURNS NUMERIC AS $$
DECLARE
    v_acquisition_cost NUMERIC;
    v_useful_life_years INTEGER;
    v_monthly_depreciation NUMERIC;
    v_acquisition_date DATE;
    v_months_since_acquisition INTEGER;
    v_total_months INTEGER;
BEGIN
    -- Get asset details
    SELECT acquisition_cost, useful_life_years, acquisition_date
    INTO v_acquisition_cost, v_useful_life_years, v_acquisition_date
    FROM fixed_assets
    WHERE id = p_asset_id AND status = 'ACTIVE';
    
    IF NOT FOUND THEN
        RETURN 0;
    END IF;
    
    -- Calculate months since acquisition
    v_months_since_acquisition := (p_year - EXTRACT(YEAR FROM v_acquisition_date)) * 12 
                                   + (p_month - EXTRACT(MONTH FROM v_acquisition_date));
    
    -- Total months for depreciation
    v_total_months := v_useful_life_years * 12;
    
    -- If before acquisition or fully depreciated, return 0
    IF v_months_since_acquisition < 0 OR v_months_since_acquisition >= v_total_months THEN
        RETURN 0;
    END IF;
    
    -- Monthly depreciation = Acquisition Cost / (Useful Life Years * 12)
    v_monthly_depreciation := v_acquisition_cost / v_total_months;
    
    RETURN ROUND(v_monthly_depreciation, 2);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_monthly_depreciation IS 'Kalkulasi beban penyusutan bulanan metode garis lurus: Harga Perolehan / (Umur Ekonomis * 12 bulan)';

-- ============================================================
-- GRANT PERMISSIONS (jika menggunakan RLS)
-- ============================================================
-- ALTER TABLE fixed_assets ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE asset_mutations ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE asset_depreciations ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY "Allow all operations" ON fixed_assets FOR ALL USING (true);
-- CREATE POLICY "Allow all operations" ON asset_mutations FOR ALL USING (true);
-- CREATE POLICY "Allow all operations" ON asset_depreciations FOR ALL USING (true);
