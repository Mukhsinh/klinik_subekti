-- ============================================================
-- KLINIK MEDIS ANTIGRAVITY - ENTERPRISE ACCOUNTING SYSTEM
-- Database Schema v1.0 | PostgreSQL / Supabase
-- Standar: PSAK, ISAK 35, Regulasi Kemenkes RI
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. ENTITAS KLINIK (MULTI-CABANG)
-- ============================================================
CREATE TABLE clinic_entities (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_name        VARCHAR(150) NOT NULL,
    branch_code        VARCHAR(20)  UNIQUE NOT NULL,
    address            TEXT,
    phone              VARCHAR(20),
    email              VARCHAR(100),
    npwp               VARCHAR(20),
    sik_number         VARCHAR(50),
    is_headquarters    BOOLEAN NOT NULL DEFAULT FALSE,
    is_active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 2. BAGAN AKUN (CHART OF ACCOUNTS)
-- Format: X-XX-XXX  (Tipe-Kelompok-Sub)
-- ============================================================
CREATE TABLE chart_of_accounts (
    account_code       VARCHAR(10)  PRIMARY KEY,
    account_name       VARCHAR(150) NOT NULL,
    account_type       VARCHAR(20)  NOT NULL
                       CHECK (account_type IN ('ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE')),
    account_group      VARCHAR(50)  NOT NULL,
    account_subgroup   VARCHAR(80),
    natural_balance    VARCHAR(6)   NOT NULL CHECK (natural_balance IN ('DEBIT','CREDIT')),
    is_header          BOOLEAN      NOT NULL DEFAULT FALSE,
    parent_code        VARCHAR(10)  REFERENCES chart_of_accounts(account_code),
    description        TEXT,
    is_active          BOOLEAN      NOT NULL DEFAULT TRUE,
    sort_order         INT          NOT NULL DEFAULT 0,
    created_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 3. JURNAL UMUM - HEADER
-- ============================================================
CREATE TABLE journal_entries (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id          UUID NOT NULL REFERENCES clinic_entities(id) ON DELETE RESTRICT,
    entry_number       VARCHAR(30) UNIQUE NOT NULL,
    transaction_date   DATE NOT NULL,
    reference_number   VARCHAR(100),
    description        TEXT NOT NULL,
    entry_type         VARCHAR(30) NOT NULL DEFAULT 'MANUAL'
                       CHECK (entry_type IN ('MANUAL','BILLING','EXPENSE','GRN','ADJUSTMENT','CLOSING','REVERSAL')),
    status             VARCHAR(10) NOT NULL DEFAULT 'DRAFT'
                       CHECK (status IN ('DRAFT','POSTED','REVERSED')),
    reversal_of        UUID REFERENCES journal_entries(id),
    total_debit        NUMERIC(18,4) NOT NULL DEFAULT 0,
    total_credit       NUMERIC(18,4) NOT NULL DEFAULT 0,
    created_by         VARCHAR(100),
    posted_by          VARCHAR(100),
    posted_at          TIMESTAMP WITH TIME ZONE,
    created_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT chk_balanced CHECK (status = 'DRAFT' OR ABS(total_debit - total_credit) < 0.01)
);

-- ============================================================
-- 4. JURNAL UMUM - DETAIL (DOUBLE ENTRY)
-- ============================================================
CREATE TABLE journal_items (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_entry_id   UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_code       VARCHAR(10) NOT NULL REFERENCES chart_of_accounts(account_code) ON DELETE RESTRICT,
    description        TEXT,
    debit              NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK (debit >= 0),
    credit             NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK (credit >= 0),
    CONSTRAINT chk_split_nonzero CHECK (debit > 0 OR credit > 0)
);

CREATE INDEX idx_journal_items_entry    ON journal_items(journal_entry_id);
CREATE INDEX idx_journal_items_account  ON journal_items(account_code);
CREATE INDEX idx_journal_entries_date   ON journal_entries(transaction_date);
CREATE INDEX idx_journal_entries_branch ON journal_entries(branch_id);
CREATE INDEX idx_journal_entries_status ON journal_entries(status);

-- ============================================================
-- 5. MASTER ITEM FARMASI & MEDIS
-- ============================================================
CREATE TABLE pharmacy_items (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku_code           VARCHAR(50) UNIQUE NOT NULL,
    item_name          VARCHAR(255) NOT NULL,
    generic_name       VARCHAR(255),
    category           VARCHAR(30) NOT NULL
                       CHECK (category IN ('ETHICAL','OTC','BHP','ALAT_MEDIS','VAKSIN')),
    base_unit          VARCHAR(20) NOT NULL,
    min_safety_stock   INT NOT NULL DEFAULT 50,
    reorder_point      INT NOT NULL DEFAULT 100,
    coa_inventory_code VARCHAR(10) NOT NULL REFERENCES chart_of_accounts(account_code),
    coa_cogs_code      VARCHAR(10) NOT NULL REFERENCES chart_of_accounts(account_code),
    selling_price      NUMERIC(15,2) NOT NULL DEFAULT 0,
    is_prescription    BOOLEAN NOT NULL DEFAULT FALSE,
    is_active          BOOLEAN NOT NULL DEFAULT TRUE,
    notes              TEXT,
    created_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 6. BATCH INVENTARIS (FIFO TRACKING)
-- ============================================================
CREATE TABLE inventory_batches (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id            UUID NOT NULL REFERENCES pharmacy_items(id) ON DELETE RESTRICT,
    batch_number       VARCHAR(100) NOT NULL,
    expiry_date        DATE NOT NULL,
    manufacture_date   DATE,
    unit_cost_price    NUMERIC(15,4) NOT NULL,
    quantity_received  INT NOT NULL,
    quantity_current   INT NOT NULL CHECK (quantity_current >= 0),
    grn_reference      VARCHAR(100) NOT NULL,
    supplier_name      VARCHAR(150),
    journal_entry_id   UUID REFERENCES journal_entries(id),
    received_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_batches_fifo    ON inventory_batches(item_id, expiry_date, created_at);
CREATE INDEX idx_batches_expiry  ON inventory_batches(expiry_date);
CREATE INDEX idx_batches_grn     ON inventory_batches(grn_reference);

-- ============================================================
-- 7. KARTU STOK (STOCK LEDGER CARD)
-- ============================================================
CREATE TABLE stock_ledger_cards (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id           UUID NOT NULL REFERENCES inventory_batches(id) ON DELETE RESTRICT,
    item_id            UUID NOT NULL REFERENCES pharmacy_items(id) ON DELETE RESTRICT,
    transaction_type   VARCHAR(50) NOT NULL
                       CHECK (transaction_type IN ('GRN','PATIENT_SALE','ADJUSTMENT','EXPIRED','DAMAGED','TRANSFER_IN','TRANSFER_OUT','RETURN')),
    reference_id       UUID,
    reference_number   VARCHAR(100),
    quantity_in        INT NOT NULL DEFAULT 0 CHECK (quantity_in >= 0),
    quantity_out       INT NOT NULL DEFAULT 0 CHECK (quantity_out >= 0),
    balance_after      INT NOT NULL,
    unit_cost          NUMERIC(15,4) NOT NULL DEFAULT 0,
    total_value        NUMERIC(18,4) NOT NULL DEFAULT 0,
    notes              TEXT,
    logged_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_stock_ledger_item ON stock_ledger_cards(item_id);
CREATE INDEX idx_stock_ledger_date ON stock_ledger_cards(logged_at);

-- ============================================================
-- 8. BILLING / TRANSAKSI PASIEN
-- ============================================================
CREATE TABLE patient_billings (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id          UUID NOT NULL REFERENCES clinic_entities(id),
    billing_number     VARCHAR(30) UNIQUE NOT NULL,
    patient_name       VARCHAR(150) NOT NULL,
    patient_mrn        VARCHAR(30),
    doctor_name        VARCHAR(100),
    visit_date         DATE NOT NULL,
    payment_method     VARCHAR(30) NOT NULL
                       CHECK (payment_method IN ('TUNAI','QRIS','TRANSFER','BPJS','ASURANSI','MIXED')),
    bpjs_claim_number  VARCHAR(50),
    subtotal_services  NUMERIC(15,2) NOT NULL DEFAULT 0,
    subtotal_pharmacy  NUMERIC(15,2) NOT NULL DEFAULT 0,
    discount_amount    NUMERIC(15,2) NOT NULL DEFAULT 0,
    ppn_amount         NUMERIC(15,2) NOT NULL DEFAULT 0,
    grand_total        NUMERIC(15,2) NOT NULL DEFAULT 0,
    patient_portion    NUMERIC(15,2) NOT NULL DEFAULT 0,
    insurance_portion  NUMERIC(15,2) NOT NULL DEFAULT 0,
    status             VARCHAR(10) NOT NULL DEFAULT 'DRAFT'
                       CHECK (status IN ('DRAFT','PAID','CANCELLED','REFUNDED')),
    journal_entry_id   UUID REFERENCES journal_entries(id),
    created_by         VARCHAR(100),
    created_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE billing_items (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    billing_id         UUID NOT NULL REFERENCES patient_billings(id) ON DELETE CASCADE,
    item_type          VARCHAR(20) NOT NULL CHECK (item_type IN ('SERVICE','PHARMACY')),
    item_name          VARCHAR(255) NOT NULL,
    pharmacy_item_id   UUID REFERENCES pharmacy_items(id),
    quantity           NUMERIC(10,2) NOT NULL DEFAULT 1,
    unit_price         NUMERIC(15,2) NOT NULL DEFAULT 0,
    discount_pct       NUMERIC(5,2)  NOT NULL DEFAULT 0,
    total_price        NUMERIC(15,2) NOT NULL DEFAULT 0
);

-- ============================================================
-- 9. PENGELUARAN (EXPENSE)
-- ============================================================
CREATE TABLE expense_entries (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id          UUID NOT NULL REFERENCES clinic_entities(id),
    expense_number     VARCHAR(30) UNIQUE NOT NULL,
    expense_date       DATE NOT NULL,
    category           VARCHAR(50) NOT NULL,
    description        TEXT NOT NULL,
    vendor_name        VARCHAR(150),
    payment_method     VARCHAR(30) NOT NULL
                       CHECK (payment_method IN ('KAS','TRANSFER','KARTU_KREDIT')),
    gross_amount       NUMERIC(15,2) NOT NULL,
    ppn_amount         NUMERIC(15,2) NOT NULL DEFAULT 0,
    pph_amount         NUMERIC(15,2) NOT NULL DEFAULT 0,
    net_amount         NUMERIC(15,2) NOT NULL,
    receipt_file_url   TEXT,
    status             VARCHAR(10) NOT NULL DEFAULT 'DRAFT'
                       CHECK (status IN ('DRAFT','POSTED','VOID')),
    journal_entry_id   UUID REFERENCES journal_entries(id),
    created_by         VARCHAR(100),
    authorized_by      VARCHAR(100),
    created_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 10. MASTER DOKTER & JASA MEDIS
-- ============================================================
CREATE TABLE doctors (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_code            VARCHAR(50) UNIQUE NOT NULL,
    full_name              VARCHAR(150) NOT NULL,
    title                  VARCHAR(50),
    specialization         VARCHAR(100),
    sip_number             VARCHAR(50),
    nik                    VARCHAR(20),
    npwp                   VARCHAR(20),
    phone                  VARCHAR(20),
    email                  VARCHAR(100),
    address                TEXT,
    bank_name              VARCHAR(100),
    bank_account_number    VARCHAR(50),
    bank_account_name      VARCHAR(150),
    fee_percentage         NUMERIC(5,2) NOT NULL DEFAULT 30,
    is_active              BOOLEAN NOT NULL DEFAULT TRUE,
    notes                  TEXT,
    created_at             TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at             TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE doctor_fee_records (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    billing_id               UUID NOT NULL REFERENCES patient_billings(id),
    doctor_id                UUID REFERENCES doctors(id) ON DELETE SET NULL,
    doctor_name              VARCHAR(100) NOT NULL,
    doctor_npwp              VARCHAR(20),
    gross_jasa_medis         NUMERIC(15,4) NOT NULL,
    dpp_amount               NUMERIC(15,4) NOT NULL,
    tax_rate                 NUMERIC(5,2)  NOT NULL,
    pph21_amount             NUMERIC(15,4) NOT NULL,
    net_to_doctor            NUMERIC(15,4) NOT NULL,
    cumulative_gross_ytd     NUMERIC(15,4) NOT NULL DEFAULT 0,
    journal_entry_id         UUID REFERENCES journal_entries(id),
    created_at               TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_fee_records ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY allow_all_doctors ON doctors FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY allow_all_doctor_fee_records ON doctor_fee_records FOR ALL TO public USING (true) WITH CHECK (true);

-- ============================================================
-- 10B. TARIF LAYANAN & VENDOR
-- ============================================================
CREATE TABLE service_tariffs (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code                   VARCHAR(50) UNIQUE NOT NULL,
    name                   VARCHAR(255) NOT NULL,
    price                  NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
    is_active              BOOLEAN NOT NULL DEFAULT TRUE,
    created_at             TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at             TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE vendors (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code                   VARCHAR(50) UNIQUE NOT NULL,
    name                   VARCHAR(255) NOT NULL,
    address                TEXT,
    phone                  VARCHAR(50),
    npwp                   VARCHAR(50),
    is_active              BOOLEAN NOT NULL DEFAULT TRUE,
    created_at             TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at             TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE service_tariffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY allow_all_service_tariffs ON service_tariffs FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY allow_all_vendors ON vendors FOR ALL TO public USING (true) WITH CHECK (true);


-- ============================================================
-- 11. LAPORAN PENUTUPAN PERIODE
-- ============================================================
CREATE TABLE period_closings (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id          UUID NOT NULL REFERENCES clinic_entities(id),
    period_year        SMALLINT NOT NULL,
    period_month       SMALLINT NOT NULL,
    closing_date       DATE NOT NULL,
    status             VARCHAR(10) NOT NULL DEFAULT 'OPEN'
                       CHECK (status IN ('OPEN','CLOSED')),
    checksum_hash      VARCHAR(64),
    closed_by          VARCHAR(100),
    closed_at          TIMESTAMP WITH TIME ZONE,
    notes              TEXT,
    UNIQUE(branch_id, period_year, period_month)
);

-- ============================================================
-- 12. TRIGGERS - IMMUTABLE LEDGER
-- ============================================================
CREATE OR REPLACE FUNCTION fn_immutable_journal_items()
RETURNS TRIGGER AS $$
BEGIN
    IF (SELECT status FROM journal_entries WHERE id = OLD.journal_entry_id) = 'POSTED' THEN
        RAISE EXCEPTION 'SECURITY: Entri jurnal yang sudah diposting bersifat permanen dan tidak dapat diubah.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_immutable_journal_items
BEFORE UPDATE OR DELETE ON journal_items
FOR EACH ROW EXECUTE FUNCTION fn_immutable_journal_items();

CREATE OR REPLACE FUNCTION fn_immutable_journal_header()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status = 'POSTED' AND NEW.status != 'REVERSED' THEN
        RAISE EXCEPTION 'SECURITY: Header jurnal yang sudah diposting tidak dapat dimodifikasi. Gunakan jurnal pembalik.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_immutable_journal_header
BEFORE UPDATE ON journal_entries
FOR EACH ROW EXECUTE FUNCTION fn_immutable_journal_header();

-- ============================================================
-- 13. FUNGSI FIFO DEPLETION ENGINE
-- ============================================================
CREATE OR REPLACE FUNCTION process_fifo_stock_depletion(
    p_journal_entry_id UUID,
    p_item_id          UUID,
    p_qty_requested    INT,
    p_reference_id     UUID
) RETURNS NUMERIC AS $$
DECLARE
    v_remaining_qty INT := p_qty_requested;
    v_batch         RECORD;
    v_deduct_qty    INT;
    v_coa_inv       VARCHAR(10);
    v_coa_cogs      VARCHAR(10);
    v_total_cost    NUMERIC(18,4) := 0;
BEGIN
    SELECT coa_inventory_code, coa_cogs_code INTO v_coa_inv, v_coa_cogs
    FROM pharmacy_items WHERE id = p_item_id;

    FOR v_batch IN
        SELECT id, quantity_current, unit_cost_price
        FROM inventory_batches
        WHERE item_id = p_item_id AND quantity_current > 0 AND expiry_date >= CURRENT_DATE
        ORDER BY expiry_date ASC, created_at ASC
        FOR UPDATE
    LOOP
        EXIT WHEN v_remaining_qty = 0;
        IF v_batch.quantity_current >= v_remaining_qty THEN
            v_deduct_qty    := v_remaining_qty;
            v_remaining_qty := 0;
        ELSE
            v_deduct_qty    := v_batch.quantity_current;
            v_remaining_qty := v_remaining_qty - v_batch.quantity_current;
        END IF;

        UPDATE inventory_batches SET quantity_current = quantity_current - v_deduct_qty
        WHERE id = v_batch.id;

        INSERT INTO stock_ledger_cards
            (batch_id, item_id, transaction_type, reference_id, quantity_out, balance_after, unit_cost, total_value)
        VALUES (v_batch.id, p_item_id, 'PATIENT_SALE', p_reference_id, v_deduct_qty,
                v_batch.quantity_current - v_deduct_qty,
                v_batch.unit_cost_price,
                v_deduct_qty * v_batch.unit_cost_price);

        INSERT INTO journal_items (journal_entry_id, account_code, debit, credit)
        VALUES (p_journal_entry_id, v_coa_cogs, v_deduct_qty * v_batch.unit_cost_price, 0);

        INSERT INTO journal_items (journal_entry_id, account_code, debit, credit)
        VALUES (p_journal_entry_id, v_coa_inv, 0, v_deduct_qty * v_batch.unit_cost_price);

        v_total_cost := v_total_cost + (v_deduct_qty * v_batch.unit_cost_price);
    END LOOP;

    IF v_remaining_qty > 0 THEN
        RAISE EXCEPTION 'STOK TIDAK MENCUKUPI: Sisa permintaan % unit tidak dapat dipenuhi.', v_remaining_qty;
    END IF;

    RETURN v_total_cost;
END;
$$ LANGUAGE plpgsql;
