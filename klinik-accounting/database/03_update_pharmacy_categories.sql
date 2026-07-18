-- ============================================================
-- MIGRATION: Update Pharmacy Items Categories & Remove Fields
-- Date: 2026-07-18
-- Purpose: 
--   1. Update kategori dari 5 menjadi 4 (Obat Paten, Obat Generik, BHP, Rumah Tangga)
--   2. Hapus field: generic_name, is_prescription, notes
--   3. Update COA mapping untuk kategori baru
-- ============================================================

-- Step 1: Add new COA accounts jika belum ada
INSERT INTO chart_of_accounts (account_code, account_name, account_type, account_group, account_subgroup, natural_balance, is_header, sort_order)
VALUES
  ('1-13-001', 'Persediaan Obat Paten',    'ASSET',   'ASET LANCAR', 'Persediaan', 'DEBIT', FALSE, 131),
  ('1-13-002', 'Persediaan Obat Generik',  'ASSET',   'ASET LANCAR', 'Persediaan', 'DEBIT', FALSE, 132),
  ('1-13-003', 'Persediaan BHP',           'ASSET',   'ASET LANCAR', 'Persediaan', 'DEBIT', FALSE, 133),
  ('1-13-004', 'Persediaan Rumah Tangga',  'ASSET',   'ASET LANCAR', 'Persediaan', 'DEBIT', FALSE, 134),
  ('5-11-001', 'Harga Pokok Obat Paten',   'EXPENSE', 'HARGA POKOK', NULL,         'DEBIT', FALSE, 511),
  ('5-11-002', 'Harga Pokok Obat Generik', 'EXPENSE', 'HARGA POKOK', NULL,         'DEBIT', FALSE, 512),
  ('5-11-003', 'Harga Pokok BHP',          'EXPENSE', 'HARGA POKOK', NULL,         'DEBIT', FALSE, 513),
  ('5-11-004', 'Harga Pokok Rumah Tangga', 'EXPENSE', 'HARGA POKOK', NULL,         'DEBIT', FALSE, 514)
ON CONFLICT (account_code) DO NOTHING;

-- Step 2: Update existing items - map old categories to new ones
-- ETHICAL → OBAT_PATEN
-- OTC → OBAT_GENERIK  
-- BHP → BHP (keep same)
-- ALAT_MEDIS → BHP (medical supplies merge to BHP)
-- VAKSIN → OBAT_PATEN (vaccines treated as patent drugs)
UPDATE pharmacy_items
SET 
  category = CASE category
    WHEN 'ETHICAL' THEN 'OBAT_PATEN'
    WHEN 'OTC' THEN 'OBAT_GENERIK'
    WHEN 'BHP' THEN 'BHP'
    WHEN 'ALAT_MEDIS' THEN 'BHP'
    WHEN 'VAKSIN' THEN 'OBAT_PATEN'
    ELSE 'OBAT_GENERIK'
  END,
  coa_inventory_code = CASE category
    WHEN 'ETHICAL' THEN '1-13-001'
    WHEN 'OTC' THEN '1-13-002'
    WHEN 'BHP' THEN '1-13-003'
    WHEN 'ALAT_MEDIS' THEN '1-13-003'
    WHEN 'VAKSIN' THEN '1-13-001'
    ELSE '1-13-002'
  END,
  coa_cogs_code = CASE category
    WHEN 'ETHICAL' THEN '5-11-001'
    WHEN 'OTC' THEN '5-11-002'
    WHEN 'BHP' THEN '5-11-003'
    WHEN 'ALAT_MEDIS' THEN '5-11-003'
    WHEN 'VAKSIN' THEN '5-11-001'
    ELSE '5-11-002'
  END
WHERE category IN ('ETHICAL', 'OTC', 'BHP', 'ALAT_MEDIS', 'VAKSIN');

-- Step 3: Drop unwanted columns
ALTER TABLE pharmacy_items 
  DROP COLUMN IF EXISTS generic_name,
  DROP COLUMN IF EXISTS is_prescription,
  DROP COLUMN IF EXISTS notes;

-- Step 4: Update category constraint
ALTER TABLE pharmacy_items 
  DROP CONSTRAINT IF EXISTS pharmacy_items_category_check;

ALTER TABLE pharmacy_items 
  ADD CONSTRAINT pharmacy_items_category_check 
  CHECK (category IN ('OBAT_PATEN', 'OBAT_GENERIK', 'BHP', 'RUMAH_TANGGA'));

-- Step 5: Add comment for documentation
COMMENT ON TABLE pharmacy_items IS 'Master data item farmasi & medis. Kategori: OBAT_PATEN (branded drugs), OBAT_GENERIK (generic drugs), BHP (medical supplies), RUMAH_TANGGA (household supplies). COA auto-mapped by category.';

-- Step 6: Deactivate old COA accounts yang tidak terpakai (optional)
UPDATE chart_of_accounts 
SET is_active = FALSE
WHERE account_code IN ('1-13-004', '1-13-005') -- old ALAT_MEDIS & VAKSIN inventory codes
  AND account_code NOT IN ('1-13-004'); -- keep 1-13-004 for RUMAH_TANGGA

-- Verification query (run after migration):
-- SELECT category, COUNT(*) as total, 
--        STRING_AGG(DISTINCT coa_inventory_code, ', ') as inv_coa,
--        STRING_AGG(DISTINCT coa_cogs_code, ', ') as cogs_coa
-- FROM pharmacy_items 
-- GROUP BY category;
