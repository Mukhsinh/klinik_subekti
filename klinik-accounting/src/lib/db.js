/**
 * db.js — Supabase data access layer
 * Handles camelCase ↔ snake_case conversion and all CRUD operations.
 */
import { supabase, sbErr } from './supabase'

// ── camelCase → snake_case (handles acronyms like COGSCode → cogs_code) ─────
function toSnake(str) {
  return str
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
}
function snake(obj) {
  if (!obj || typeof obj !== 'object') return obj
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    out[toSnake(k)] = v
  }
  return out
}

// ── snake_case → camelCase ────────────────────────────────────
function toCamel(str) {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
}
function norm(row) {
  if (!row || typeof row !== 'object') return row
  const out = {}
  for (const [k, v] of Object.entries(row)) {
    out[toCamel(k)] = v
  }
  return out
}
function normArr(rows) { return (rows || []).map(norm) }

// ── Safe error handler ────────────────────────────────────────
export function handleError(error, context = '') {
  if (error) {
    console.error(`[DB:${context}]`, error.message, error.details || '')
    throw new Error(error.message)
  }
}

// ══════════════════════════════════════════════════════════════
// CLINIC ENTITIES
// ══════════════════════════════════════════════════════════════
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
export async function upsertBranch(branch) {
  const { data, error } = await supabase
    .from('clinic_entities')
    .upsert(snake(branch), { onConflict: 'id' })
    .select().single()
  handleError(error, 'upsertBranch')
  return norm(data)
}

// ══════════════════════════════════════════════════════════════
// CHART OF ACCOUNTS
// ══════════════════════════════════════════════════════════════
export async function fetchCOA() {
  const { data, error } = await supabase
    .from('chart_of_accounts').select('*').order('sort_order')
  handleError(error, 'fetchCOA')
  return normArr(data)
}
export async function upsertAccount(account) {
  const { data, error } = await supabase
    .from('chart_of_accounts')
    .upsert(snake(account), { onConflict: 'account_code' })
    .select().single()
  handleError(error, 'upsertAccount')
  return norm(data)
}
export async function updateAccount(code, updates) {
  const { error } = await supabase
    .from('chart_of_accounts')
    .update(snake(updates))
    .eq('account_code', code)
  handleError(error, 'updateAccount')
}

// ══════════════════════════════════════════════════════════════
// JOURNAL ENTRIES + ITEMS
// ══════════════════════════════════════════════════════════════
export async function fetchJournalEntries(filters = {}) {
  let q = supabase.from('journal_entries').select('*')
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false })
  if (filters.branchId) q = q.eq('branch_id', filters.branchId)
  if (filters.dateFrom) q = q.gte('transaction_date', filters.dateFrom)
  if (filters.dateTo) q = q.lte('transaction_date', filters.dateTo)
  if (filters.status) q = q.eq('status', filters.status)
  if (filters.limit) q = q.limit(filters.limit)
  const { data, error } = await q
  handleError(error, 'fetchJournalEntries')
  return normArr(data)
}

// ══════════════════════════════════════════════════════════════
// FIXED ASSETS
// ══════════════════════════════════════════════════════════════
export async function fetchFixedAssets(filters = {}) {
  let q = supabase.from('fixed_assets').select('*')
    .order('asset_code')
  if (filters.status) q = q.eq('status', filters.status)
  if (filters.category) q = q.eq('category', filters.category)
  if (filters.location) q = q.eq('location', filters.location)
  const { data, error } = await q
  handleError(error, 'fetchFixedAssets')
  return normArr(data)
}

export async function upsertFixedAsset(asset) {
  const { data, error } = await supabase
    .from('fixed_assets')
    .upsert(snake(asset), { onConflict: 'id' })
    .select().single()
  handleError(error, 'upsertFixedAsset')
  return norm(data)
}

export async function updateFixedAsset(id, updates) {
  const { data, error } = await supabase
    .from('fixed_assets')
    .update(snake(updates))
    .eq('id', id)
    .select().single()
  handleError(error, 'updateFixedAsset')
  return norm(data)
}

export async function deleteFixedAsset(id) {
  const { error } = await supabase
    .from('fixed_assets')
    .delete()
    .eq('id', id)
  handleError(error, 'deleteFixedAsset')
}

export async function deleteAssetMutationsByAsset(assetId) {
  const { error } = await supabase
    .from('asset_mutations')
    .delete()
    .eq('asset_id', assetId)
  handleError(error, 'deleteAssetMutationsByAsset')
}

export async function deleteAssetDepreciationsByAsset(assetId) {
  const { error } = await supabase
    .from('asset_depreciations')
    .delete()
    .eq('asset_id', assetId)
  handleError(error, 'deleteAssetDepreciationsByAsset')
}

// ══════════════════════════════════════════════════════════════
// ASSET MUTATIONS
// ══════════════════════════════════════════════════════════════
export async function fetchAssetMutations(assetId = null) {
  let q = supabase.from('asset_mutations').select('*')
    .order('mutation_date', { ascending: false })
  if (assetId) q = q.eq('asset_id', assetId)
  const { data, error } = await q
  handleError(error, 'fetchAssetMutations')
  return normArr(data)
}

export async function insertAssetMutation(mutation) {
  const { data, error } = await supabase
    .from('asset_mutations')
    .insert(snake(mutation))
    .select().single()
  handleError(error, 'insertAssetMutation')
  return norm(data)
}

// ══════════════════════════════════════════════════════════════
// ASSET DEPRECIATIONS
// ══════════════════════════════════════════════════════════════
export async function fetchAssetDepreciations(filters = {}) {
  let q = supabase.from('asset_depreciations').select('*')
    .order('period_year', { ascending: false })
    .order('period_month', { ascending: false })
  if (filters.assetId) q = q.eq('asset_id', filters.assetId)
  if (filters.periodYear) q = q.eq('period_year', filters.periodYear)
  if (filters.periodMonth) q = q.eq('period_month', filters.periodMonth)
  if (filters.status) q = q.eq('status', filters.status)
  const { data, error } = await q
  handleError(error, 'fetchAssetDepreciations')
  return normArr(data)
}

export async function upsertAssetDepreciation(depreciation) {
  const { data, error } = await supabase
    .from('asset_depreciations')
    .upsert(snake(depreciation), { onConflict: 'id' })
    .select().single()
  handleError(error, 'upsertAssetDepreciation')
  return norm(data)
}

export async function updateDepreciationStatus(id, status, extras = {}) {
  const { data, error } = await supabase
    .from('asset_depreciations')
    .update({ status, ...snake(extras) })
    .eq('id', id)
    .select().single()
  handleError(error, 'updateDepreciationStatus')
  return norm(data)
}

// Calculate monthly depreciation using stored procedure
export async function calculateMonthlyDepreciation(assetId, year, month) {
  const { data, error } = await supabase
    .rpc('calculate_monthly_depreciation', {
      p_asset_id: assetId,
      p_year: year,
      p_month: month
    })
  handleError(error, 'calculateMonthlyDepreciation')
  return data
}

export async function fetchJournalItems(entryIds = []) {
  if (!entryIds.length) return []
  const { data, error } = await supabase
    .from('journal_items').select('*')
    .in('journal_entry_id', entryIds)
  handleError(error, 'fetchJournalItems')
  return normArr(data)
}

export async function upsertJournalEntry(entry) {
  const row = snake(entry)
  // Ensure numeric fields
  row.total_debit = Number(row.total_debit || 0)
  row.total_credit = Number(row.total_credit || 0)
  const { data, error } = await supabase
    .from('journal_entries')
    .upsert(row, { onConflict: 'id' })
    .select().single()
  handleError(error, 'upsertJournalEntry')
  return norm(data)
}

export async function insertJournalItems(items) {
  if (!items.length) {
    console.log('[insertJournalItems] No items to insert')
    return []
  }

  const rows = items.map(it => {
    const r = snake(it)
    r.debit = Number(r.debit || 0)
    r.credit = Number(r.credit || 0)

    // Ensure required fields exist
    if (!r.journal_entry_id) {
      console.error('[insertJournalItems] Missing journal_entry_id for item:', it)
      throw new Error('journal_entry_id is required for journal items')
    }
    if (!r.account_code) {
      console.error('[insertJournalItems] Missing account_code for item:', it)
      throw new Error('account_code is required for journal items')
    }

    return r
  })

  console.log('[insertJournalItems] Inserting', rows.length, 'items:', rows)

  const { data, error } = await supabase
    .from('journal_items').insert(rows).select()

  if (error) {
    console.error('[insertJournalItems] Database error:', error)
  } else {
    console.log('[insertJournalItems] Successfully inserted:', data?.length, 'items')
  }

  handleError(error, 'insertJournalItems')
  return normArr(data)
}

export async function updateJournalStatus(id, status, extra = {}) {
  const { error } = await supabase
    .from('journal_entries')
    .update({ status, ...snake(extra), updated_at: new Date().toISOString() })
    .eq('id', id)
  handleError(error, 'updateJournalStatus')
}

export async function deleteJournalItemsByEntry(entryId) {
  const { error } = await supabase
    .from('journal_items').delete().eq('journal_entry_id', entryId)
  handleError(error, 'deleteJournalItems')
}

export async function deleteJournalEntry(id) {
  const { error } = await supabase
    .from('journal_entries').delete().eq('id', id)
  handleError(error, 'deleteJournalEntry')
}

// ══════════════════════════════════════════════════════════════
// PHARMACY ITEMS
// ══════════════════════════════════════════════════════════════
export async function fetchPharmacyItems() {
  const { data, error } = await supabase
    .from('pharmacy_items').select('*').order('item_name')
  handleError(error, 'fetchPharmacyItems')
  return normArr(data)
}
export async function upsertPharmacyItem(item) {
  const row = snake(item)
  row.selling_price = Number(row.selling_price || 0)
  row.min_safety_stock = parseInt(row.min_safety_stock || 50)
  row.reorder_point = parseInt(row.reorder_point || 100)
  if (!row.sku_code || row.sku_code.trim() === '') {
    row.sku_code = row.item_code || `SKU-${Date.now()}`
  }
  const { data, error } = await supabase
    .from('pharmacy_items')
    .upsert(row, { onConflict: 'id' })
    .select().single()
  handleError(error, 'upsertPharmacyItem')
  return norm(data)
}

// ══════════════════════════════════════════════════════════════
// INVENTORY BATCHES
// ══════════════════════════════════════════════════════════════
export async function fetchBatches() {
  const { data, error } = await supabase
    .from('inventory_batches').select('*').order('expiry_date')
  handleError(error, 'fetchBatches')
  return normArr(data)
}
export async function insertBatches(batches) {
  if (!batches.length) return []
  const rows = batches.map(b => ({
    id: b.id,
    item_id: b.itemId || b.item_id,
    batch_number: b.batchNumber || b.batch_number,
    expiry_date: b.expiryDate || b.expiry_date,
    manufacture_date: b.manufactureDate || b.manufacture_date || null,
    unit_cost_price: Number(b.unitCostPrice ?? b.unit_cost_price ?? 0),
    quantity_received: Number(b.quantityReceived ?? b.quantity_received ?? 0),
    quantity_current: Number(b.quantityCurrent ?? b.quantity_current ?? 0),
    grn_reference: b.grnReference || b.grn_reference,
    supplier_name: b.supplierName || b.supplier_name || null,
    journal_entry_id: b.journalEntryId || b.journal_entry_id || null,
    received_at: b.receivedAt || b.received_at || new Date().toISOString(),
    created_at: b.createdAt || b.created_at || new Date().toISOString(),
  }))
  const { data, error } = await supabase
    .from('inventory_batches').insert(rows).select()
  handleError(error, 'insertBatches')
  return normArr(data)
}
export async function updateBatchQty(id, qty) {
  const { error } = await supabase
    .from('inventory_batches')
    .update({ quantity_current: Number(qty) })
    .eq('id', id)
  handleError(error, 'updateBatchQty')
}

export async function deleteGRNByRef(grnReference, journalEntryId = null) {
  let targetJournalId = journalEntryId
  if (!targetJournalId) {
    const { data: batchData } = await supabase
      .from('inventory_batches')
      .select('journal_entry_id')
      .eq('grn_reference', grnReference)
      .limit(1)
    if (batchData && batchData.length > 0 && batchData[0].journal_entry_id) {
      targetJournalId = batchData[0].journal_entry_id
    }
  }

  // Delete stock ledger cards
  const { error: err1 } = await supabase.from('stock_ledger_cards').delete().eq('reference_number', grnReference)
  handleError(err1, 'deleteGRNByRef.stockLedger')

  // Delete inventory batches
  const { error: err2 } = await supabase.from('inventory_batches').delete().eq('grn_reference', grnReference)
  handleError(err2, 'deleteGRNByRef.inventoryBatches')

  // Delete journal items & entries
  if (targetJournalId) {
    const { error: err3 } = await supabase.from('journal_items').delete().eq('journal_entry_id', targetJournalId)
    handleError(err3, 'deleteGRNByRef.journalItems')

    const { error: err4 } = await supabase.from('journal_entries').delete().eq('id', targetJournalId)
    handleError(err4, 'deleteGRNByRef.journalEntries')
  }
}

// ══════════════════════════════════════════════════════════════
// STOCK LEDGER
// ══════════════════════════════════════════════════════════════
export async function fetchStockLedger(itemId = null) {
  let q = supabase.from('stock_ledger_cards').select('*')
    .order('logged_at', { ascending: false })
  if (itemId) q = q.eq('item_id', itemId)
  const { data, error } = await q
  handleError(error, 'fetchStockLedger')
  return normArr(data)
}
export async function insertStockLedger(entries) {
  if (!entries.length) return []
  const rows = entries.map(e => ({
    id: e.id,
    batch_id: e.batchId || e.batch_id || null,
    item_id: e.itemId || e.item_id,
    transaction_type: e.transactionType || e.transaction_type,
    reference_id: e.referenceId || e.reference_id || null,
    reference_number: e.referenceNumber || e.reference_number || null,
    quantity_in: Number(e.quantityIn ?? e.quantity_in ?? 0),
    quantity_out: Number(e.quantityOut ?? e.quantity_out ?? 0),
    balance_after: Number(e.balanceAfter ?? e.balance_after ?? 0),
    unit_cost: Number(e.unitCost ?? e.unit_cost ?? 0),
    total_value: Number(e.totalValue ?? e.total_value ?? 0),
    notes: e.notes || null,
    logged_at: e.loggedAt || e.logged_at || new Date().toISOString(),
  }))
  const { data, error } = await supabase
    .from('stock_ledger_cards').insert(rows).select()
  handleError(error, 'insertStockLedger')
  return normArr(data)
}

// ══════════════════════════════════════════════════════════════
// PATIENT BILLINGS
// ══════════════════════════════════════════════════════════════
export async function fetchBillings(branchId = null) {
  let q = supabase.from('patient_billings').select('*')
    .order('created_at', { ascending: false })
  if (branchId) q = q.eq('branch_id', branchId)
  const { data, error } = await q
  handleError(error, 'fetchBillings')
  return normArr(data)
}
export async function insertBilling(billing) {
  const row = snake(billing)
    // Ensure numeric
    ;['subtotal_services', 'subtotal_pharmacy', 'discount_amount', 'ppn_amount', 'grand_total', 'patient_portion', 'insurance_portion'].forEach(k => { row[k] = Number(row[k] || 0) })
  const { data, error } = await supabase
    .from('patient_billings').upsert(row, { onConflict: 'id' }).select().single()
  handleError(error, 'insertBilling')
  return norm(data)
}
export async function fetchBillingItems(billingIds = []) {
  if (!billingIds.length) return []
  const { data, error } = await supabase
    .from('billing_items').select('*')
    .in('billing_id', billingIds)
  handleError(error, 'fetchBillingItems')
  return normArr(data)
}
export async function fetchAllBillingItems() {
  const { data, error } = await supabase
    .from('billing_items').select('*')
  handleError(error, 'fetchAllBillingItems')
  return normArr(data)
}
export async function insertBillingItems(items) {
  if (!items.length) return []
  const rows = items.map(it => {
    const r = snake(it)
    r.quantity = Number(r.quantity || 1)
    r.unit_price = Number(r.unit_price || 0)
    r.total_price = Number(r.total_price || 0)
    r.discount_pct = Number(r.discount_pct || 0)
    return r
  })
  const { data, error } = await supabase
    .from('billing_items').insert(rows).select()
  handleError(error, 'insertBillingItems')
  return normArr(data)
}
export async function deleteBillingItemsByBilling(billingId) {
  const { error } = await supabase
    .from('billing_items').delete().eq('billing_id', billingId)
  handleError(error, 'deleteBillingItemsByBilling')
}
export async function updateBilling(id, updates) {
  const row = snake(updates)
  if (!row.updated_at) row.updated_at = new Date().toISOString()
  const { data, error } = await supabase
    .from('patient_billings')
    .update(row)
    .eq('id', id)
    .select().single()
  handleError(error, 'updateBilling')
  return norm(data)
}
export async function deleteDoctorFeeRecordByBilling(billingId) {
  const { error } = await supabase
    .from('doctor_fee_records')
    .delete()
    .eq('billing_id', billingId)
  handleError(error, 'deleteDoctorFeeRecordByBilling')
}


// ══════════════════════════════════════════════════════════════
// EXPENSES
// ══════════════════════════════════════════════════════════════
export async function fetchExpenses(branchId = null) {
  let q = supabase.from('expense_entries').select('*')
    .order('expense_date', { ascending: false })
  if (branchId) q = q.eq('branch_id', branchId)
  const { data, error } = await q
  handleError(error, 'fetchExpenses')
  return normArr(data)
}
const ALLOWED_EXPENSE_COLUMNS = new Set([
  'id', 'branch_id', 'expense_number', 'expense_date', 'category',
  'description', 'vendor_name', 'payment_method', 'gross_amount',
  'ppn_amount', 'pph_amount', 'net_amount', 'receipt_file_url',
  'status', 'journal_entry_id', 'created_by', 'authorized_by',
  'created_at', 'selected_grn_refs', 'coa_code', 'credit_coa_code'
])

export async function upsertExpense(expense) {
  const row = snake(expense)
  const cleanRow = {}
  for (const [k, v] of Object.entries(row)) {
    if (ALLOWED_EXPENSE_COLUMNS.has(k)) {
      cleanRow[k] = v
    }
  }
  // Ensure numeric fields and fallback values
  ;['gross_amount', 'ppn_amount', 'pph_amount', 'net_amount'].forEach(k => {
    cleanRow[k] = Number(cleanRow[k] || 0)
  })
  if (!cleanRow.branch_id || cleanRow.branch_id === '') cleanRow.branch_id = null
  if (!cleanRow.status) cleanRow.status = 'DRAFT'
  if (!cleanRow.expense_date) cleanRow.expense_date = new Date().toISOString().split('T')[0]
  if (cleanRow.selected_grn_refs && !Array.isArray(cleanRow.selected_grn_refs)) {
    cleanRow.selected_grn_refs = null
  }

  const { data, error } = await supabase
    .from('expense_entries')
    .upsert(cleanRow, { onConflict: 'id' })
    .select().single()
  handleError(error, 'upsertExpense')
  return norm(data)
}


// ══════════════════════════════════════════════════════════════
// DOCTORS
// ══════════════════════════════════════════════════════════════
export async function fetchDoctors() {
  const { data, error } = await supabase
    .from('doctors').select('*').order('full_name')
  handleError(error, 'fetchDoctors')
  return normArr(data)
}
export async function upsertDoctor(doctor) {
  const row = snake(doctor)
  row.fee_percentage = Number(row.fee_percentage || 30)
  const { data, error } = await supabase
    .from('doctors')
    .upsert(row, { onConflict: 'id' })
    .select().single()
  handleError(error, 'upsertDoctor')
  return norm(data)
}
export async function deleteDoctor(id) {
  const { error } = await supabase
    .from('doctors').update({ is_active: false }).eq('id', id)
  handleError(error, 'deleteDoctor')
}

// ══════════════════════════════════════════════════════════════
// AUDIT LOGS
// ══════════════════════════════════════════════════════════════
export async function insertAuditLog(log) {
  try {
    const row = snake(log)
    await supabase.from('audit_logs').insert(row)
  } catch (e) { console.warn('[AuditLog]', e.message) }
}
export async function fetchAuditLogs(limit = 1000) {
  const { data, error } = await supabase
    .from('audit_logs').select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  handleError(error, 'fetchAuditLogs')
  return normArr(data).map(r => ({ ...r, timestamp: r.createdAt }))
}

// ══════════════════════════════════════════════════════════════
// APP SETTINGS
// ══════════════════════════════════════════════════════════════
export async function fetchAppSettings() {
  const { data, error } = await supabase.from('app_settings').select('*')
  handleError(error, 'fetchAppSettings')
  const result = {}
    ; (data || []).forEach(row => {
      // Try parse JSON for non-string values
      try { result[row.key] = JSON.parse(row.value) }
      catch { result[row.key] = row.value }
    })
  return result
}
export async function saveAppSettingRow(key, value) {
  const strVal = typeof value === 'string' ? value : JSON.stringify(value)
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key, value: strVal, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  handleError(error, 'saveAppSetting')
}
export async function saveAllAppSettings(settings) {
  const rows = Object.entries(settings).map(([key, value]) => ({
    key,
    value: typeof value === 'string' ? value : JSON.stringify(value),
    updated_at: new Date().toISOString(),
  }))
  if (!rows.length) return
  const { error } = await supabase
    .from('app_settings').upsert(rows, { onConflict: 'key' })
  handleError(error, 'saveAllAppSettings')
}

// ══════════════════════════════════════════════════════════════
// DOCTOR FEE RECORDS
// ══════════════════════════════════════════════════════════════
export async function insertDoctorFeeRecord(rec) {
  const row = snake(rec)
    ;['gross_jasa_medis', 'dpp_amount', 'tax_rate', 'pph21_amount', 'net_to_doctor', 'cumulative_gross_ytd'].forEach(k => { row[k] = Number(row[k] || 0) })
  const { data, error } = await supabase
    .from('doctor_fee_records').insert(row).select().single()
  handleError(error, 'insertDoctorFeeRecord')
  return norm(data)
}
export async function fetchDoctorFeeRecords(doctorId = null, year = null, limit = null) {
  let q = supabase.from('doctor_fee_records').select('*')
    .order('created_at', { ascending: false })
  if (doctorId) q = q.eq('doctor_id', doctorId)
  if (year) q = q.gte('created_at', `${year}-01-01`).lte('created_at', `${year}-12-31`)
  if (limit) q = q.limit(limit)
  const { data, error } = await q
  handleError(error, 'fetchDoctorFeeRecords')
  return normArr(data)
}

// ══════════════════════════════════════════════════════════════
// VENDORS (PBF / Suppliers)
// ══════════════════════════════════════════════════════════════
export async function fetchVendors() {
  const { data, error } = await supabase
    .from('vendors').select('*').order('name')
  handleError(error, 'fetchVendors')
  return normArr(data)
}
export async function upsertVendor(vendor) {
  const row = snake(vendor)
  const { data, error } = await supabase
    .from('vendors')
    .upsert(row, { onConflict: 'id' })
    .select().single()
  handleError(error, 'upsertVendor')
  return norm(data)
}

// ══════════════════════════════════════════════════════════════
// SERVICE TARIFFS
// ══════════════════════════════════════════════════════════════
export async function fetchServiceTariffs() {
  const { data, error } = await supabase
    .from('service_tariffs').select('*').order('name')
  handleError(error, 'fetchServiceTariffs')
  return normArr(data)
}
export async function upsertServiceTariff(tariff) {
  const row = snake(tariff)
  row.price = Number(row.price || 0)
  const { data, error } = await supabase
    .from('service_tariffs')
    .upsert(row, { onConflict: 'id' })
    .select().single()
  handleError(error, 'upsertServiceTariff')
  return norm(data)
}

// ══════════════════════════════════════════════════════════════
// USERS
// ══════════════════════════════════════════════════════════════
export async function fetchUsers() {
  const { data, error } = await supabase
    .from('users').select('*').order('name')
  handleError(error, 'fetchUsers')
  return normArr(data)
}
export async function upsertUser(user) {
  const row = snake(user)
  const { data, error } = await supabase
    .from('users')
    .upsert(row, { onConflict: 'id' })
    .select().single()
  handleError(error, 'upsertUser')
  return norm(data)
}
export async function deleteUser(id) {
  const { error } = await supabase
    .from('users')
    .delete()
    .eq('id', id)
  handleError(error, 'deleteUser')
}

// ══════════════════════════════════════════════════════════════
// STOCK OUTFLOW ENTRIES
// ══════════════════════════════════════════════════════════════
export async function fetchStockOutflows(branchId = null) {
  let q = supabase.from('stock_outflow_entries').select('*')
    .order('outflow_date', { ascending: false })
  if (branchId) q = q.eq('branch_id', branchId)
  const { data, error } = await q
  handleError(error, 'fetchStockOutflows')
  return normArr(data)
}

export async function insertStockOutflow(outflow) {
  const row = snake(outflow)
  row.total_value = Number(row.total_value || 0)
  const { data, error } = await supabase
    .from('stock_outflow_entries')
    .insert(row)
    .select().single()
  handleError(error, 'insertStockOutflow')
  return norm(data)
}

export async function updateStockOutflow(id, updates) {
  const { data, error } = await supabase
    .from('stock_outflow_entries')
    .update(snake(updates))
    .eq('id', id)
    .select().single()
  handleError(error, 'updateStockOutflow')
  return norm(data)
}

export async function fetchStockOutflowItems(outflowIds = null) {
  let q = supabase.from('stock_outflow_items').select('*')
  if (Array.isArray(outflowIds) && outflowIds.length > 0) {
    q = q.in('outflow_id', outflowIds)
  }
  const { data, error } = await q
  handleError(error, 'fetchStockOutflowItems')
  return normArr(data)
}

export async function insertStockOutflowItems(items) {
  if (!items.length) return []
  const rows = items.map(it => {
    const r = snake(it)
    r.quantity = parseInt(r.quantity || 0)
    r.unit_cost = Number(r.unit_cost || 0)
    r.total_cost = Number(r.total_cost || 0)
    return r
  })
  const { data, error } = await supabase
    .from('stock_outflow_items').insert(rows).select()
  handleError(error, 'insertStockOutflowItems')
  return normArr(data)
}


// ══════════════════════════════════════════════════════════════
// OPENING BALANCES (SALDO AWAL)
// ══════════════════════════════════════════════════════════════

/**
 * Fetch opening balances with optional filters
 * @param {Object} filters - { branchId, fiscalYear, accountCode }
 * @returns {Promise<Array>} Array of opening balance records
 */
export async function fetchOpeningBalances(filters = {}) {
  let q = supabase
    .from('opening_balances')
    .select('*')
    .order('account_code')

  if (filters.branchId) q = q.eq('branch_id', filters.branchId)
  if (filters.fiscalYear) q = q.eq('fiscal_year', filters.fiscalYear)
  if (filters.accountCode) q = q.eq('account_code', filters.accountCode)

  const { data, error } = await q
  handleError(error, 'fetchOpeningBalances')
  return normArr(data)
}

/**
 * Upsert a single opening balance
 * @param {Object} openingBalance - Opening balance data
 * @returns {Promise<Object>} The upserted record
 */
export async function upsertOpeningBalance(openingBalance) {
  const row = snake(openingBalance)
  row.opening_balance = Number(row.opening_balance || 0)

  // Validate required fields
  if (!row.account_code || !row.branch_id || !row.fiscal_year || !row.opening_date) {
    throw new Error('Missing required fields: account_code, branch_id, fiscal_year, opening_date')
  }

  const { data, error } = await supabase
    .from('opening_balances')
    .upsert(row, {
      onConflict: 'account_code,branch_id,fiscal_year',
      ignoreDuplicates: false
    })
    .select()
    .single()

  handleError(error, 'upsertOpeningBalance')
  return norm(data)
}

/**
 * Batch upsert opening balances (for bulk save)
 * @param {Array} openingBalances - Array of opening balance records
 * @returns {Promise<Array>} Array of upserted records
 */
export async function batchUpsertOpeningBalances(openingBalances) {
  if (!openingBalances || openingBalances.length === 0) {
    console.log('[batchUpsertOpeningBalances] No records to upsert')
    return []
  }

  const rows = openingBalances.map(ob => {
    const r = snake(ob)
    r.opening_balance = Number(r.opening_balance || 0)

    // Validate required fields
    if (!r.account_code || !r.branch_id || !r.fiscal_year || !r.opening_date) {
      console.error('[batchUpsertOpeningBalances] Invalid record:', ob)
      throw new Error(`Invalid opening balance record: ${JSON.stringify(ob)}`)
    }

    return r
  })

  console.log('[batchUpsertOpeningBalances] Upserting', rows.length, 'records')

  const { data, error } = await supabase
    .from('opening_balances')
    .upsert(rows, {
      onConflict: 'account_code,branch_id,fiscal_year',
      ignoreDuplicates: false
    })
    .select()

  if (error) {
    console.error('[batchUpsertOpeningBalances] Database error:', error)
  } else {
    console.log('[batchUpsertOpeningBalances] Successfully upserted:', data?.length, 'records')
  }

  handleError(error, 'batchUpsertOpeningBalances')
  return normArr(data)
}

/**
 * Delete an opening balance by ID
 * @param {string} id - Opening balance ID
 * @returns {Promise<void>}
 */
export async function deleteOpeningBalance(id) {
  const { error } = await supabase
    .from('opening_balances')
    .delete()
    .eq('id', id)

  handleError(error, 'deleteOpeningBalance')
}

/**
 * Delete opening balances by filters (e.g., delete all for a fiscal year)
 * @param {Object} filters - { branchId, fiscalYear, accountCode }
 * @returns {Promise<void>}
 */
export async function deleteOpeningBalancesByFilter(filters = {}) {
  let q = supabase.from('opening_balances').delete()

  if (filters.branchId) q = q.eq('branch_id', filters.branchId)
  if (filters.fiscalYear) q = q.eq('fiscal_year', filters.fiscalYear)
  if (filters.accountCode) q = q.eq('account_code', filters.accountCode)

  const { error } = await q
  handleError(error, 'deleteOpeningBalancesByFilter')
}

/**
 * Get opening balance for a specific account, branch, and fiscal year
 * @param {string} accountCode - Account code
 * @param {string} branchId - Branch ID
 * @param {number} fiscalYear - Fiscal year
 * @returns {Promise<number>} Opening balance amount (0 if not found)
 */
export async function getOpeningBalance(accountCode, branchId, fiscalYear) {
  const { data, error } = await supabase
    .from('opening_balances')
    .select('opening_balance')
    .eq('account_code', accountCode)
    .eq('branch_id', branchId)
    .eq('fiscal_year', fiscalYear)
    .maybeSingle()

  if (error) {
    console.error('[getOpeningBalance] Error:', error)
    return 0
  }

  return data ? Number(data.opening_balance || 0) : 0
}

/**
 * Batch insert/update inventory batches and stock ledger cards
 */
export async function batchUpsertInventoryStatus(batchesToInsert, batchesToUpdate, ledgerToInsert, ledgerToUpdate) {
  // 1. Insert batches
  if (batchesToInsert.length > 0) {
    const rows = batchesToInsert.map(b => {
      const r = snake(b)
      r.unit_cost_price = Number(r.unit_cost_price || 0)
      r.quantity_received = parseInt(r.quantity_received || 0)
      r.quantity_current = parseInt(r.quantity_current || 0)
      return r
    })
    const { error } = await supabase.from('inventory_batches').insert(rows)
    handleError(error, 'batchUpsertInventoryStatus:insertBatches')
  }

  // 2. Insert ledger
  if (ledgerToInsert.length > 0) {
    const rows = ledgerToInsert.map(l => {
      const r = snake(l)
      r.quantity_in = parseInt(r.quantity_in || 0)
      r.quantity_out = parseInt(r.quantity_out || 0)
      r.balance_after = parseInt(r.balance_after || 0)
      r.unit_cost = Number(r.unit_cost || 0)
      r.total_value = Number(r.total_value || 0)
      return r
    })
    const { error } = await supabase.from('stock_ledger_cards').insert(rows)
    handleError(error, 'batchUpsertInventoryStatus:insertLedger')
  }

  // 3. Update batches
  for (const ub of batchesToUpdate) {
    const { error } = await supabase
      .from('inventory_batches')
      .update({
        quantity_received: parseInt(ub.quantityReceived),
        quantity_current: parseInt(ub.quantityCurrent),
        unit_cost_price: Number(ub.unitCostPrice)
      })
      .eq('id', ub.id)
    handleError(error, 'batchUpsertInventoryStatus:updateBatch')
  }

  // 4. Update ledger
  for (const ul of ledgerToUpdate) {
    const { error } = await supabase
      .from('stock_ledger_cards')
      .update({
        quantity_in: parseInt(ul.quantityIn),
        balance_after: parseInt(ul.balanceAfter),
        unit_cost: Number(ul.unitCost),
        total_value: Number(ul.totalValue)
      })
      .eq('id', ul.id)
    handleError(error, 'batchUpsertInventoryStatus:updateLedger')
  }
}

/**
 * Get opening balance batches for all items or specific item
 * @param {string|null} itemId - Optional item ID to filter
 * @returns {Promise<Array>} Array of opening balance batches
 */
export async function fetchInventoryOpeningBalances(itemId = null) {
  let q = supabase
    .from('inventory_batches')
    .select('*')
    .like('batch_number', '%SALDO-AWAL%')
    .order('item_id')

  if (itemId) q = q.eq('item_id', itemId)

  const { data, error } = await q
  handleError(error, 'fetchInventoryOpeningBalances')
  return normArr(data)
}

/**
 * Delete opening balance batch for an item
 * @param {string} itemId - Item ID
 * @returns {Promise<void>}
 */
export async function deleteInventoryOpeningBalance(itemId) {
  // Delete ledger entries first (foreign key constraint)
  const { data: batches } = await supabase
    .from('inventory_batches')
    .select('id')
    .eq('item_id', itemId)
    .like('batch_number', '%SALDO-AWAL%')

  if (batches && batches.length > 0) {
    const batchIds = batches.map(b => b.id)

    // Delete ledger entries
    const { error: ledgerError } = await supabase
      .from('stock_ledger_cards')
      .delete()
      .in('batch_id', batchIds)
      .eq('transaction_type', 'SALDO_AWAL')

    if (ledgerError) {
      console.warn('[deleteInventoryOpeningBalance] Ledger delete warning:', ledgerError)
    }

    // Delete batches
    const { error: batchError } = await supabase
      .from('inventory_batches')
      .delete()
      .in('id', batchIds)

    handleError(batchError, 'deleteInventoryOpeningBalance')
  }
}

