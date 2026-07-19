-- ============================================================
-- STOCK OUTFLOW TRACKING & BILLING ENHANCEMENTS
-- Schema Extension v1.1
-- ============================================================

-- ============================================================
-- 1. STOCK OUTFLOW ENTRIES (Non-Billing Stock Movements)
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_outflow_entries (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id          UUID NOT NULL REFERENCES clinic_entities(id) ON DELETE RESTRICT,
    outflow_number     VARCHAR(30) UNIQUE NOT NULL,
    outflow_date       DATE NOT NULL,
    outflow_type       VARCHAR(50) NOT NULL
                       CHECK (outflow_type IN ('INTERNAL_USE','DONATION','SAMPLE','WASTE','OTHER')),
    description        TEXT NOT NULL,
    total_value        NUMERIC(15,2) NOT NULL DEFAULT 0,
    status             VARCHAR(10) NOT NULL DEFAULT 'DRAFT'
                       CHECK (status IN ('DRAFT','POSTED','CANCELLED')),
    journal_entry_id   UUID REFERENCES journal_entries(id),
    created_by         VARCHAR(100),
    authorized_by      VARCHAR(100),
    created_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_outflow_items (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outflow_id         UUID NOT NULL REFERENCES stock_outflow_entries(id) ON DELETE CASCADE,
    item_id            UUID NOT NULL REFERENCES pharmacy_items(id) ON DELETE RESTRICT,
    item_name          VARCHAR(255) NOT NULL,
    quantity           INT NOT NULL CHECK (quantity > 0),
    unit_cost          NUMERIC(15,4) NOT NULL DEFAULT 0,
    total_cost         NUMERIC(15,4) NOT NULL DEFAULT 0,
    notes              TEXT
);

CREATE INDEX idx_stock_outflow_branch ON stock_outflow_entries(branch_id);
CREATE INDEX idx_stock_outflow_date ON stock_outflow_entries(outflow_date);
CREATE INDEX idx_stock_outflow_status ON stock_outflow_entries(status);
CREATE INDEX idx_stock_outflow_items_outflow ON stock_outflow_items(outflow_id);

-- ============================================================
-- 2. Enable RLS for new tables
-- ============================================================
ALTER TABLE stock_outflow_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_outflow_items ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. Policies (Allow all for public - adjust based on auth needs)
-- ============================================================
CREATE POLICY allow_all_stock_outflow_entries 
ON stock_outflow_entries FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY allow_all_stock_outflow_items 
ON stock_outflow_items FOR ALL TO public USING (true) WITH CHECK (true);

-- ============================================================
-- 4. Indexes for better query performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_patient_billings_date ON patient_billings(visit_date);
CREATE INDEX IF NOT EXISTS idx_patient_billings_branch ON patient_billings(branch_id);
CREATE INDEX IF NOT EXISTS idx_patient_billings_status ON patient_billings(status);
CREATE INDEX IF NOT EXISTS idx_patient_billings_payment ON patient_billings(payment_method);
CREATE INDEX IF NOT EXISTS idx_billing_items_billing ON billing_items(billing_id);
CREATE INDEX IF NOT EXISTS idx_billing_items_pharmacy ON billing_items(pharmacy_item_id);

-- ============================================================
-- 5. View for comprehensive billing report data
-- ============================================================
CREATE OR REPLACE VIEW v_billing_report_summary AS
SELECT 
    pb.id,
    pb.branch_id,
    pb.billing_number,
    pb.patient_name,
    pb.patient_mrn,
    pb.doctor_name,
    pb.visit_date,
    pb.payment_method,
    pb.subtotal_services,
    pb.subtotal_pharmacy,
    pb.discount_amount,
    pb.ppn_amount,
    pb.grand_total,
    pb.patient_portion,
    pb.insurance_portion,
    pb.status,
    pb.created_at,
    EXTRACT(YEAR FROM pb.visit_date) as year,
    EXTRACT(MONTH FROM pb.visit_date) as month,
    EXTRACT(QUARTER FROM pb.visit_date) as quarter,
    CASE 
        WHEN EXTRACT(MONTH FROM pb.visit_date) BETWEEN 1 AND 6 THEN 1
        ELSE 2
    END as semester,
    ce.entity_name as branch_name
FROM patient_billings pb
LEFT JOIN clinic_entities ce ON pb.branch_id = ce.id
WHERE pb.status = 'PAID';

COMMENT ON VIEW v_billing_report_summary IS 
'Comprehensive view for billing reports with date dimensions for filtering';
