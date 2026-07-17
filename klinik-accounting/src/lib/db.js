/**
 * db.js — Supabase data access layer
 * All functions return plain JS objects (snake_case → camelCase normalized).
 */
import { supabase, sbErr } from './supabase'

// ── Helpers ───────────────────────────────────────────────────
const norm = (row) => {
  if (!row) return null
  const out = {}
  Object.entries(row).forEach(([k, v]) => {
    const camel = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
    out[camel] = v
  })
  return out
}
const normArr = (rows) => (rows || []).map(norm)

const snake = (obj) => {
  const out = {}
  Object.entries(obj || {}).forEach(([k, v]) => {
    const s = k.replace(/([A-Z])/g, '_$1').toLowerCase()
    out[s] = v
  })
  return out
}

// ══════════════════════════════════════════════════════════════
// CLINIC ENTITIES (branches)
// ══════════════════════════════════════════════════════════════
export async function fetchBranches() {
  const { data, error } = await supabase.from('clinic_entities').select('*').order('branch_code')
  sbErr(error, 'fetchBranches')
  return normArr(data)
}

export async function upsertBranch(branch) {
  const row = snake(branch)
  const { data, error } = await supabase
    .from('clinic_entities')
    .upsert(row, { onConflict: 'id' })
    .select()
    .single()
  sbErr(error, 'upsertBranch')
  return norm(data)
}

// ══════════════════════════════════════════════════════════════
// CHART OF ACCOUNTS
// ══════════════════════════════════════════════════════════════
export async function fetchCOA() {
  const { data, error } = await supabase
    .from('chart_of_accounts')
    .select('*')
    .order('sort_order')
  sbErr(error, 'fetchCOA')
  return normArr(data)
}

export async function upsertAccount(account) {
  const row = snake(account)
  const { data, error } = await supabase
    .from('chart_of_accounts')
    .upsert(row, { onConflict: 'account_code' })
    .select()
    .single()
  sbErr(error, 'upsertAccount')
  return norm(data)
}

export async function updateAccount(code, updates) {
  const { error } = await supabase
    .from('chart_of_accounts')
    .update(snake(updates))
    .eq('account_code', code)
  sbErr(error, 'updateAccount')
}

// ══════════════════════════════════════════════════════════════
// JOURNAL ENTRIES
// ══════════════════════════════════════════════════════════════
export async function fetchJournalEntries(branchId = null, dateFrom = null, dateTo = null) {
  let q = supabase.from('journal_entries').select('*').order('transaction_date', { ascending: false }).order('created_at', { ascending: false })
  if (branchId) q = q.eq('branch_id', branchId)
  if (dateFrom) q = q.gte('transaction_date', dateFrom)
  if (dateTo) q = q.lte('transaction_date', dateTo)
  const { data, error } = await q
  sbErr(error, 'fetchJournalEntries')
  return normArr(data)
}

export async function fetchJournalItems(entryIds = []) {
  if (!entryIds.length) return []
  const { data, error } = await supabase
    .from('journal_items')
    .select('*')
    .in('journal_entry_id', entryIds)
  sbErr(error, 'fetchJournalItems')
  return normArr(data)
}

export async function upsertJournalEntry(entry) {
  const row = snake(entry)
  const { data, error } = await supabase
    .from('journal_entries')
    .upsert(row, { onConflict: 'id' })
    .select()
    .single()
  sbErr(error, 'upsertJournalEntry')
  return norm(data)
}

export async function insertJournalItems(items) {
  if (!items.length) return []
  const rows = items.map(snake)
  const { data, error } = await supabase.from('journal_items').insert(rows).select()
  sbErr(error, 'insertJournalItems')
  return normArr(data)
}

export async function updateJournalStatus(id, status, extra = {}) {
  const { error } = await supabase
    .from('journal_entries')
    .update({ status, ...snake(extra) })
    .eq('id', id)
  sbErr(error, 'updateJournalStatus')
}

export async function deleteJournalItemsByEntry(entryId) {
  const { error } = await supabase
    .from('journal_items')
    .delete()
    .eq('journal_entry_id', entryId)
  sbErr(error, 'deleteJournalItems')
}

// ══════════════════════════════════════════════════════════════
// PHARMACY ITEMS
// ══════════════════════════════════════════════════════════════
export async function fetchPharmacyItems() {
  const { data, error } = await supabase
    .from('pharmacy_items')
    .select('*')
    .order('item_name')
  sbErr(error, 'fetchPharmacyItems')
  return normArr(data)
}

export async function upsertPharmacyItem(item) {
  const row = snake(item)
  const { data, error } = await supabase
    .from('pharmacy_items')
    .upsert(row, { onConflict: 'id' })
    .select()
    .single()
  sbErr(error, 'upsertPharmacyItem')
  return norm(data)
}

// ══════════════════════════════════════════════════════════════
// INVENTORY BATCHES
// ══════════════════════════════════════════════════════════════
export async function fetchBatches() {
  const { data, error } = await supabase
    .from('inventory_batches')
    .select('*')
    .order('expiry_date')
  sbErr(error, 'fetchBatches')
  return normArr(data)
}

export async function insertBatches(batches) {
  if (!batches.length) return []
  const { data, error } = await supabase
    .from('inventory_batches')
    .insert(batches.map(snake))
    .select()
  sbErr(error, 'insertBatches')
  return normArr(data)
}

export async function updateBatchQty(id, qty) {
  const { error } = await supabase
    .from('inventory_batches')
    .update({ quantity_current: qty })
    .eq('id', id)
  sbErr(error, 'updateBatchQty')
}

// ══════════════════════════════════════════════════════════════
// STOCK LEDGER
// ══════════════════════════════════════════════════════════════
export async function fetchStockLedger(itemId = null) {
  let q = supabase.from('stock_ledger_cards').select('*').order('logged_at', { ascending: false })
  if (itemId) q = q.eq('item_id', itemId)
  const { data, error } = await q
  sbErr(error, 'fetchStockLedger')
  return normArr(data)
}

export async function insertStockLedger(entries) {
  if (!entries.length) return []
  const { data, error } = await supabase
    .from('stock_ledger_cards')
    .insert(entries.map(snake))
    .select()
  sbErr(error, 'insertStockLedger')
  return normArr(data)
}

// ══════════════════════════════════════════════════════════════
// BILLINGS
// ══════════════════════════════════════════════════════════════
export async function fetchBillings(branchId = null) {
  let q = supabase
    .from('patient_billings')
    .select('*')
    .order('created_at', { ascending: false })
  if (branchId) q = q.eq('branch_id', branchId)
  const { data, error } = await q
  sbErr(error, 'fetchBillings')
  return normArr(data)
}

export async function insertBilling(billing) {
  const { data, error } = await supabase
    .from('patient_billings')
    .insert(snake(billing))
    .select()
    .single()
  sbErr(error, 'insertBilling')
  return norm(data)
}

export async function insertBillingItems(items) {
  if (!items.length) return []
  const { data, error } = await supabase
    .from('billing_items')
    .insert(items.map(snake))
    .select()
  sbErr(error, 'insertBillingItems')
  return normArr(data)
}

export async function fetchBillingItems(billingIds = []) {
  if (!billingIds.length) return []
  const { data, error } = await supabase
    .from('billing_items')
    .select('*')
    .in('billing_id', billingIds)
  sbErr(error, 'fetchBillingItems')
  return normArr(data)
}

// ══════════════════════════════════════════════════════════════
// EXPENSES
// ══════════════════════════════════════════════════════════════
export async function fetchExpenses(branchId = null) {
  let q = supabase
    .from('expense_entries')
    .select('*')
    .order('expense_date', { ascending: false })
  if (branchId) q = q.eq('branch_id', branchId)
  const { data, error } = await q
  sbErr(error, 'fetchExpenses')
  return normArr(data)
}

export async function upsertExpense(expense) {
  const row = snake(expense)
  const { data, error } = await supabase
    .from('expense_entries')
    .upsert(row, { onConflict: 'id' })
    .select()
    .single()
  sbErr(error, 'upsertExpense')
  return norm(data)
}

// ══════════════════════════════════════════════════════════════
// DOCTORS
// ══════════════════════════════════════════════════════════════
export async function fetchDoctors() {
  const { data, error } = await supabase
    .from('doctors')
    .select('*')
    .order('full_name')
  sbErr(error, 'fetchDoctors')
  return normArr(data)
}

export async function upsertDoctor(doctor) {
  const row = snake(doctor)
  const { data, error } = await supabase
    .from('doctors')
    .upsert(row, { onConflict: 'id' })
    .select()
    .single()
  sbErr(error, 'upsertDoctor')
  return norm(data)
}

export async function deleteDoctor(id) {
  const { error } = await supabase.from('doctors').update({ is_active: false }).eq('id', id)
  sbErr(error, 'deleteDoctor')
}

// ══════════════════════════════════════════════════════════════
// AUDIT LOGS
// ══════════════════════════════════════════════════════════════
export async function insertAuditLog(log) {
  const { error } = await supabase.from('audit_logs').insert(snake(log))
  if (error) console.warn('[AuditLog]', error.message)
}

export async function fetchAuditLogs(limit = 500) {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  sbErr(error, 'fetchAuditLogs')
  return normArr(data)
}

// ══════════════════════════════════════════════════════════════
// APP SETTINGS
// ══════════════════════════════════════════════════════════════
export async function fetchAppSettings() {
  const { data, error } = await supabase.from('app_settings').select('*')
  sbErr(error, 'fetchAppSettings')
  const result = {}
    ; (data || []).forEach(row => { result[row.key] = row.value })
  return result
}

export async function saveAppSettingRow(key, value) {
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key, value: String(value), updated_at: new Date().toISOString() }, { onConflict: 'key' })
  sbErr(error, 'saveAppSetting')
}

// ══════════════════════════════════════════════════════════════
// SERVICE TARIFFS (TARIF LAYANAN)
// ══════════════════════════════════════════════════════════════
export async function fetchServiceTariffs() {
  const { data, error } = await supabase
    .from('service_tariffs')
    .select('*')
    .order('code')
  sbErr(error, 'fetchServiceTariffs')
  return normArr(data)
}

export async function upsertServiceTariff(tariff) {
  const { data, error } = await supabase
    .from('service_tariffs')
    .upsert(snake(tariff))
    .select()
  sbErr(error, 'upsertServiceTariff')
  return data ? norm(data[0]) : null
}

// ══════════════════════════════════════════════════════════════
// VENDORS
// ══════════════════════════════════════════════════════════════
export async function fetchVendors() {
  const { data, error } = await supabase
    .from('vendors')
    .select('*')
    .order('code')
  sbErr(error, 'fetchVendors')
  return normArr(data)
}

export async function upsertVendor(vendor) {
  const { data, error } = await supabase
    .from('vendors')
    .upsert(snake(vendor))
    .select()
  sbErr(error, 'upsertVendor')
  return data ? norm(data[0]) : null
}

