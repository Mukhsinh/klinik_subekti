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
  const { data, error } = await supabase
    .from('clinic_entities').select('*').order('branch_code')
  handleError(error, 'fetchBranches')
  return normArr(data)
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
  const rows = batches.map(b => {
    const r = snake(b)
    r.unit_cost_price = Number(r.unit_cost_price || 0)
    r.quantity_received = parseInt(r.quantity_received || 0)
    r.quantity_current = parseInt(r.quantity_current || 0)
    return r
  })
  const { data, error } = await supabase
    .from('inventory_batches').insert(rows).select()
  handleError(error, 'insertBatches')
  return normArr(data)
}
export async function updateBatchQty(id, qty) {
  const { error } = await supabase
    .from('inventory_batches')
    .update({ quantity_current: parseInt(qty) })
    .eq('id', id)
  handleError(error, 'updateBatchQty')
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
  const rows = entries.map(e => {
    const r = snake(e)
    r.quantity_in = parseInt(r.quantity_in || 0)
    r.quantity_out = parseInt(r.quantity_out || 0)
    r.balance_after = parseInt(r.balance_after || 0)
    r.unit_cost = Number(r.unit_cost || 0)
    r.total_value = Number(r.total_value || 0)
    return r
  })
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
export async function upsertExpense(expense) {
  const row = snake(expense)
    ;['gross_amount', 'ppn_amount', 'pph_amount', 'net_amount'].forEach(k => { row[k] = Number(row[k] || 0) })
  const { data, error } = await supabase
    .from('expense_entries')
    .upsert(row, { onConflict: 'id' })
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

export async function fetchStockOutflowItems(outflowIds = []) {
  if (!outflowIds.length) return []
  const { data, error } = await supabase
    .from('stock_outflow_items').select('*')
    .in('outflow_id', outflowIds)
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

