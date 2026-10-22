/**
 * useStore.js — Global state backed by Supabase
 * Single pub/sub singleton — all components share one live state.
 * Writes: optimistic UI update first, then async persist to Supabase.
 * Reads:  bootstrap loads everything from Supabase once on first mount.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { supabase } from '../lib/supabase'
import {
  fetchBranches, upsertBranch,
  fetchCOA, upsertAccount, updateAccount as dbUpdateAccount,
  fetchJournalEntries, fetchJournalItems,
  upsertJournalEntry, insertJournalItems,
  updateJournalStatus, deleteJournalItemsByEntry,
  fetchPharmacyItems, upsertPharmacyItem,
  fetchBatches, insertBatches, updateBatchQty,
  fetchStockLedger, insertStockLedger,
  fetchBillings, insertBilling, insertBillingItems, fetchBillingItems, deleteBillingItemsByBilling,
  fetchExpenses, upsertExpense,
  fetchDoctors, upsertDoctor, deleteDoctor,
  insertAuditLog, fetchAuditLogs,
  insertDoctorFeeRecord, fetchDoctorFeeRecords,
  fetchFixedAssets, upsertFixedAsset, updateFixedAsset, deleteFixedAsset,
  fetchAssetMutations, insertAssetMutation, deleteAssetMutationsByAsset,
  fetchAssetDepreciations, upsertAssetDepreciation, updateDepreciationStatus, deleteAssetDepreciationsByAsset,
  calculateMonthlyDepreciation, deleteJournalEntry,
  fetchVendors, upsertVendor,
  fetchServiceTariffs, upsertServiceTariff,
  fetchStockOutflows, insertStockOutflow, updateStockOutflow,
  fetchStockOutflowItems, insertStockOutflowItems,
  fetchAppSettings, saveAllAppSettings,
  fetchUsers, upsertUser, deleteUser,
  fetchOpeningBalances, batchUpsertOpeningBalances, deleteOpeningBalance,
  batchUpsertInventoryStatus,
} from '../lib/db'
import { initialCOA } from '../data/initialCOA'
import { initialBranches } from '../data/initialData'
import { getAccountCode } from '../utils/accountMapping'

// ── Singleton state ───────────────────────────────────────────
let _state = {
  branches: [],
  coa: [],
  journalEntries: [],
  journalItems: [],
  pharmacyItems: [],
  invBatches: [],
  stockLedger: [],
  billings: [],
  billingItems: [],
  expenses: [],
  doctors: [],
  doctorFeeRecords: [],
  fixedAssets: [],
  assetMutations: [],
  assetDepreciations: [],
  vendors: [],
  serviceTariffs: [],
  stockOutflows: [],
  stockOutflowItems: [],
  users: [],
  auditLogs: [],
  appSettings: {},
  openingBalances: [],
  activeBranchId: null,
  loading: true,
  initialized: false,
  error: null,
}
const _listeners = new Set()

function getState() { return _state }
function setState(upd) {
  _state = typeof upd === 'function' ? upd(_state) : { ..._state, ...upd }
  _listeners.forEach(fn => fn())
}

// ── Bootstrap — load all from Supabase ────────────────────────
let _bootstrapDone = false
let _bootstrapProm = null

// Force reset bootstrap (untuk debugging)
export function resetBootstrap() {
  _bootstrapDone = false
  _bootstrapProm = null
  console.log('[Bootstrap] Reset - will re-fetch on next call')
}

async function bootstrap() {
  if (_bootstrapDone) return
  if (_bootstrapProm) return _bootstrapProm

  _bootstrapProm = (async () => {
    console.log('[Bootstrap] Starting fresh data load from Supabase...')
    console.log('[Bootstrap] Reset state:', { _bootstrapDone, hasPromise: !!_bootstrapProm })
    try {
      // Log before fetching
      console.log('[Bootstrap] Step 1: Fetching branches from clinic_entities table...')
      const branchesRaw = await fetchBranches().catch(err => { console.warn('[Bootstrap] fetchBranches failed:', err.message); return [] })
      console.log('[Bootstrap] Branches fetched:', branchesRaw)
      console.log('[Bootstrap] Branches count:', branchesRaw?.length || 0)

      // Parallel fetch all other data safely
      console.log('[Bootstrap] Step 2: Fetching all other data in parallel...')
      const [
        coa, journals, pharmacyItems,
        batches, billings, expenses, doctors,
        fixedAssets, assetMutations, assetDepreciations,
        vendors, serviceTariffs, stockOutflows,
        doctorFeeRecords, auditLogs, users, appSettings,
        openingBalances,
      ] = await Promise.all([
        fetchCOA().catch(err => { console.warn('[Bootstrap] fetchCOA failed:', err.message); return [] }),
        fetchJournalEntries().catch(err => { console.warn('[Bootstrap] fetchJournalEntries failed:', err.message); return [] }),
        fetchPharmacyItems().catch(err => { console.warn('[Bootstrap] fetchPharmacyItems failed:', err.message); return [] }),
        fetchBatches().catch(err => { console.warn('[Bootstrap] fetchBatches failed:', err.message); return [] }),
        fetchBillings().catch(err => { console.warn('[Bootstrap] fetchBillings failed:', err.message); return [] }),
        fetchExpenses().catch(err => { console.warn('[Bootstrap] fetchExpenses failed:', err.message); return [] }),
        fetchDoctors().catch(err => { console.warn('[Bootstrap] fetchDoctors failed:', err.message); return [] }),
        fetchFixedAssets({ status: 'ACTIVE' }).catch(err => { console.warn('[Bootstrap] fetchFixedAssets failed:', err.message); return [] }),
        fetchAssetMutations().catch(err => { console.warn('[Bootstrap] fetchAssetMutations failed:', err.message); return [] }),
        fetchAssetDepreciations({}).catch(err => { console.warn('[Bootstrap] fetchAssetDepreciations failed:', err.message); return [] }),
        fetchVendors().catch(err => { console.warn('[Bootstrap] fetchVendors failed:', err.message); return [] }),
        fetchServiceTariffs().catch(err => { console.warn('[Bootstrap] fetchServiceTariffs failed:', err.message); return [] }),
        fetchStockOutflows().catch(err => { console.warn('[Bootstrap] fetchStockOutflows failed:', err.message); return [] }),
        fetchDoctorFeeRecords(null, null, 500).catch(err => { console.warn('[Bootstrap] fetchDoctorFeeRecords failed:', err.message); return [] }),
        fetchAuditLogs(500).catch(err => { console.warn('[Bootstrap] fetchAuditLogs failed:', err.message); return [] }),
        fetchUsers().catch(err => { console.warn('[Bootstrap] fetchUsers failed:', err.message); return [] }),
        fetchAppSettings().catch(err => { console.warn('[Bootstrap] fetchAppSettings failed:', err.message); return {} }),
        fetchOpeningBalances().catch(err => { console.warn('[Bootstrap] fetchOpeningBalances failed:', err.message); return [] }),
      ])

      // IMPORTANT: Prioritize database data over local fallback
      // Only use fallback if fetch fails (not if it returns empty array)
      const finalBranches = branchesRaw // Always use what database returns, even if empty
      const finalCOA = coa.length ? coa : initialCOA // COA still needs fallback for initial setup

      // Log data source for debugging
      console.log('[Bootstrap] Step 3: Data Sources Summary:')
      console.log('  - Branches:', finalBranches?.length > 0 ? `${finalBranches.length} from Supabase ✓` : '0 from Supabase (database empty)')
      console.log('  - Branches Detail:', finalBranches)
      console.log('  - COA:', coa.length > 0 ? `${coa.length} from Supabase ✓` : `${initialCOA.length} from local fallback`)

      if (finalBranches.length === 0) {
        console.warn('[Bootstrap] ⚠️ No branches in database. Please add branch via /branches page.')
      } else {
        console.log('[Bootstrap] ✓ Successfully loaded', finalBranches.length, 'branches')
        finalBranches.forEach((b, idx) => {
          console.log(`  [${idx}] ${b.branchCode} - ${b.entityName} (ID: ${b.id})`)
        })
      }

      // Fetch relational data
      const entryIds = journals.map(j => j.id)
      const billingIds = billings.map(b => b.id)
      const outflowIds = stockOutflows.map(o => o.id)

      const [jItems, bItems, stockRows, outflowItems] = await Promise.all([
        entryIds.length ? fetchJournalItems(entryIds).catch(err => { console.warn('[Bootstrap] fetchJournalItems failed:', err.message); return [] }) : Promise.resolve([]),
        fetchBillingItems().catch(err => { console.warn('[Bootstrap] fetchBillingItems failed:', err.message); return [] }),
        fetchStockLedger().catch(err => { console.warn('[Bootstrap] fetchStockLedger failed:', err.message); return [] }),
        outflowIds.length ? fetchStockOutflowItems(outflowIds).catch(err => { console.warn('[Bootstrap] fetchStockOutflowItems failed:', err.message); return [] }) : Promise.resolve([]),
      ])

      // Active branch persistence
      const savedBranch = localStorage.getItem('activeBranchId')
      const validBranch = finalBranches.find(b => b.id === savedBranch)
      const activeBranchId = validBranch ? savedBranch : (finalBranches[0]?.id || null)

      setState({
        branches: finalBranches,
        coa: finalCOA,
        journalEntries: journals,
        journalItems: jItems,
        pharmacyItems,
        invBatches: batches,
        stockLedger: stockRows,
        billings,
        billingItems: bItems,
        expenses,
        doctors,
        doctorFeeRecords,
        fixedAssets,
        assetMutations,
        assetDepreciations,
        vendors,
        serviceTariffs,
        stockOutflows,
        stockOutflowItems: outflowItems,
        users,
        auditLogs,
        appSettings,
        openingBalances,
        activeBranchId,
        loading: false,
        initialized: true,
        error: null,
      })
      _bootstrapDone = true
    } catch (err) {
      console.error('[Bootstrap] Supabase load failed:', err.message)
      console.error('[Bootstrap] Using minimal fallback for COA only')
      setState({
        branches: [], // No fallback for branches - force user to add via UI
        coa: initialCOA, // COA needs fallback for basic functionality
        fixedAssets: [],
        assetMutations: [],
        assetDepreciations: [],
        vendors: [],
        serviceTariffs: [],
        stockOutflows: [],
        stockOutflowItems: [],
        doctorFeeRecords: [],
        auditLogs: [],
        users: [],
        appSettings: {},
        openingBalances: [],
        loading: false,
        initialized: true,
        error: err.message,
      })
      _bootstrapDone = true
    }
  })()
  return _bootstrapProm
}

// ── React hook ────────────────────────────────────────────────
export function useStore() {
  const [, forceRender] = useState(0)
  const mounted = useRef(false)

  useEffect(() => {
    mounted.current = true
    const listener = () => { if (mounted.current) forceRender(n => n + 1) }
    _listeners.add(listener)
    bootstrap()
    return () => { mounted.current = false; _listeners.delete(listener) }
  }, [])

  const s = getState()

  // ── Audit log ─────────────────────────────────────────────
  const logActivity = useCallback((action, module, detail = '') => {
    const auth = (() => { try { return JSON.parse(localStorage.getItem('currentUser') || '{}') } catch { return {} } })()
    const log = {
      id: uuidv4(), userId: auth.id || 'system',
      userName: auth.name || 'System', userRole: auth.role || 'system',
      action, module, detail, ipAddress: '127.0.0.1',
      createdAt: new Date().toISOString(),
    }
    insertAuditLog(log).catch(() => { })
  }, [])

  // ── Refresh (re-fetch from Supabase) ──────────────────────
  const refreshAll = useCallback(async () => {
    console.log('[RefreshAll] Resetting bootstrap and reloading...')
    _bootstrapDone = false
    _bootstrapProm = null
    setState(prev => ({ ...prev, loading: true }))
    await bootstrap()
  }, [])

  // ── Branch ────────────────────────────────────────────────
  const setActiveBranch = useCallback((id) => {
    localStorage.setItem('activeBranchId', id)
    setState(prev => ({ ...prev, activeBranchId: id }))
  }, [])

  const getActiveBranch = useCallback(() =>
    s.branches.find(b => b.id === s.activeBranchId) || s.branches[0],
    [s])

  const addBranch = useCallback(async (data) => {
    const branch = { ...data, id: uuidv4(), isActive: true, createdAt: new Date().toISOString() }
    setState(prev => ({ ...prev, branches: [...prev.branches, branch] }))
    try { return await upsertBranch(branch) } catch (e) { console.error('[addBranch]', e.message); return branch }
  }, [])

  const updateBranch = useCallback(async (id, data) => {
    setState(prev => ({ ...prev, branches: prev.branches.map(b => b.id === id ? { ...b, ...data } : b) }))
    try {
      const cur = s.branches.find(b => b.id === id)
      if (cur) await upsertBranch({ ...cur, ...data })
    } catch (e) { console.error('[updateBranch]', e.message) }
  }, [s.branches])

  // ── COA ───────────────────────────────────────────────────
  const addAccount = useCallback(async (data) => {
    const acc = { ...data, isActive: true, createdAt: new Date().toISOString() }
    setState(prev => ({ ...prev, coa: [...prev.coa, acc] }))
    try { await upsertAccount(acc) } catch (e) { console.error('[addAccount]', e.message) }
    return acc
  }, [])

  const updateAccountFn = useCallback(async (code, data) => {
    setState(prev => ({ ...prev, coa: prev.coa.map(a => a.accountCode === code ? { ...a, ...data } : a) }))
    try { await dbUpdateAccount(code, data) } catch (e) { console.error('[updateAccount]', e.message) }
  }, [])

  const deactivateAccount = useCallback(async (code) => {
    setState(prev => ({ ...prev, coa: prev.coa.map(a => a.accountCode === code ? { ...a, isActive: false } : a) }))
    try { await dbUpdateAccount(code, { isActive: false }) } catch (e) { console.error('[deactivateAccount]', e.message) }
  }, [])

  const clearAllCOA = useCallback(async () => {
    console.log('[clearAllCOA] Clearing all COA from database...')
    try {
      // Clear from database
      const { error } = await supabase.from('chart_of_accounts').delete().neq('account_code', '')
      if (error) throw error

      // Clear from state
      setState(prev => ({ ...prev, coa: [] }))
      console.log('[clearAllCOA] All COA cleared successfully')
    } catch (e) {
      console.error('[clearAllCOA] Error:', e.message)
      throw e
    }
  }, [])

  const batchAddAccounts = useCallback(async (accounts) => {
    console.log('[batchAddAccounts] Adding', accounts.length, 'accounts...')
    try {
      const accountsToAdd = []
      const existingCodes = new Set(s.coa.map(a => a.accountCode))

      for (const acc of accounts) {
        if (!existingCodes.has(acc.accountCode)) {
          accountsToAdd.push({
            ...acc,
            createdAt: new Date().toISOString()
          })
        }
      }

      if (accountsToAdd.length === 0) {
        console.log('[batchAddAccounts] No new accounts to add')
        return
      }

      // Add to database
      const { error } = await supabase.from('chart_of_accounts').insert(
        accountsToAdd.map(a => ({
          account_code: a.accountCode,
          account_name: a.accountName,
          account_type: a.accountType,
          account_group: a.accountGroup,
          account_subgroup: a.accountSubgroup || null,
          natural_balance: a.naturalBalance,
          is_header: a.isHeader || false,
          parent_code: a.parentCode || null,
          description: a.description || null,
          is_active: a.isActive !== false,
          sort_order: a.sortOrder || 0,
          created_at: a.createdAt
        }))
      )

      if (error) throw error

      // Update state
      setState(prev => ({ ...prev, coa: [...prev.coa, ...accountsToAdd] }))
      console.log('[batchAddAccounts] Successfully added', accountsToAdd.length, 'accounts')
    } catch (e) {
      console.error('[batchAddAccounts] Error:', e.message)
      throw e
    }
  }, [s.coa])

  // ── Journal ───────────────────────────────────────────────
  const generateEntryNumber = useCallback((type = 'JU') => {
    const d = new Date()
    const ym = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`
    const existing = s.journalEntries.filter(j => j.entryNumber?.startsWith(`${type}/`)).length + 1
    return `${type}/${ym}/${String(existing).padStart(5, '0')}`
  }, [s.journalEntries])

  const saveJournalDraft = useCallback(async (header, items) => {
    const entryId = header.id || uuidv4()
    const entry = { ...header, id: entryId, status: 'DRAFT', createdAt: header.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() }
    const newItems = items.map(it => ({ ...it, id: it.id || uuidv4(), journalEntryId: entryId }))

    // Optimistic update
    setState(prev => ({
      ...prev,
      journalEntries: [...prev.journalEntries.filter(j => j.id !== entryId && j.entryNumber !== entry.entryNumber), entry],
      journalItems: [...prev.journalItems.filter(i => i.journalEntryId !== entryId), ...newItems],
    }))

    // Persist
    try {
      await deleteJournalItemsByEntry(entryId)
      await upsertJournalEntry(entry)

      // Ensure items have all required fields before insert
      if (newItems.length > 0) {
        console.log('[saveJournalDraft] Saving items:', newItems.length, 'items')
        const result = await insertJournalItems(newItems)
        console.log('[saveJournalDraft] Insert result:', result)
      }
    } catch (e) {
      console.error('[saveJournalDraft] Error:', e.message, e)
      throw e // Re-throw to allow caller to handle
    }
    return entryId
  }, [])

  const postJournalEntry = useCallback(async (entryId, postedBy = 'System') => {
    const latestState = getState()
    const entry = latestState.journalEntries.find(j => j.id === entryId)
    if (!entry) return { ok: false, error: 'Jurnal tidak ditemukan.' }

    const items = latestState.journalItems.filter(i => i.journalEntryId === entryId)
    const totalDebit = items.reduce((sum, i) => sum + parseFloat(i.debit || 0), 0)
    const totalCredit = items.reduce((sum, i) => sum + parseFloat(i.credit || 0), 0)

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return { ok: false, error: `Jurnal tidak balance. Debit: ${totalDebit.toFixed(2)}, Kredit: ${totalCredit.toFixed(2)}` }
    }

    const extra = { postedBy, postedAt: new Date().toISOString(), totalDebit, totalCredit }
    setState(prev => ({
      ...prev,
      journalEntries: prev.journalEntries.map(j =>
        j.id === entryId ? { ...j, status: 'POSTED', ...extra } : j
      ),
    }))
    try { await updateJournalStatus(entryId, 'POSTED', extra) } catch (e) { console.error('[postJournal]', e.message) }
    return { ok: true }
  }, [])

  const reverseJournal = useCallback(async (entryId, reversedBy = 'System', reason = '') => {
    const latestState = getState()
    const entry = latestState.journalEntries.find(j => j.id === entryId)
    if (!entry || entry.status !== 'POSTED') return { ok: false, error: 'Hanya jurnal POSTED yang dapat dibalik.' }

    const origItems = latestState.journalItems.filter(i => i.journalEntryId === entryId)
    const revId = uuidv4()
    const revEntry = {
      id: revId, branchId: entry.branchId,
      entryNumber: generateEntryNumber('PEMBALIK'),
      transactionDate: new Date().toISOString().split('T')[0],
      description: `[PEMBALIK] ${entry.description} — ${reason}`,
      entryType: 'REVERSAL', status: 'POSTED',
      reversalOf: entryId,
      totalDebit: entry.totalDebit, totalCredit: entry.totalCredit,
      createdBy: reversedBy, postedBy: reversedBy,
      postedAt: new Date().toISOString(), createdAt: new Date().toISOString(),
    }
    const revItems = origItems.map(it => ({
      id: uuidv4(), journalEntryId: revId,
      accountCode: it.accountCode, description: it.description || '',
      debit: it.credit, credit: it.debit,
    }))

    setState(prev => ({
      ...prev,
      journalEntries: [...prev.journalEntries.map(j => j.id === entryId ? { ...j, status: 'REVERSED' } : j), revEntry],
      journalItems: [...prev.journalItems, ...revItems],
    }))
    try {
      await updateJournalStatus(entryId, 'REVERSED')
      await upsertJournalEntry(revEntry)
      await insertJournalItems(revItems)
    } catch (e) { console.error('[reverseJournal]', e.message) }
    return { ok: true, reversalId: revId }
  }, [generateEntryNumber])

  // ── Inventory ─────────────────────────────────────────────
  const generateSku = useCallback(() =>
    `SKU-${String(s.pharmacyItems.length + 1).padStart(5, '0')}`,
    [s.pharmacyItems])

  const generateItemCode = useCallback((category = 'OTC') => {
    const prefix = { ETHICAL: 'ETH', OTC: 'OTC', BHP: 'BHP', ALAT_MEDIS: 'ALM', VAKSIN: 'VAK' }[category] || 'ITM'
    const count = s.pharmacyItems.filter(p => p.category === category).length + 1
    return `${prefix}-${String(count).padStart(4, '0')}`
  }, [s.pharmacyItems])

  const addPharmacyItem = useCallback(async (data) => {
    const item = { ...data, id: data.id || uuidv4(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    setState(prev => ({ ...prev, pharmacyItems: [...prev.pharmacyItems.filter(p => p.id !== item.id), item] }))
    try { const saved = await upsertPharmacyItem(item); setState(prev => ({ ...prev, pharmacyItems: prev.pharmacyItems.map(p => p.id === saved.id ? saved : p) })) } catch (e) { console.error('[addPharmacyItem]', e.message) }
    return item
  }, [])

  const updatePharmacyItem = useCallback(async (id, data) => {
    setState(prev => ({ ...prev, pharmacyItems: prev.pharmacyItems.map(p => p.id === id ? { ...p, ...data, updatedAt: new Date().toISOString() } : p) }))
    try {
      const cur = s.pharmacyItems.find(p => p.id === id)
      if (cur) await upsertPharmacyItem({ ...cur, ...data })
    } catch (e) { console.error('[updatePharmacyItem]', e.message) }
  }, [s.pharmacyItems])

  const receiveGRN = useCallback(async (grnData, batchesData) => {
    const now = new Date().toISOString()
    const receivedTime = grnData.grnDate ? `${grnData.grnDate}T${now.split('T')[1] || '00:00:00.000Z'}` : now
    const batches = batchesData.map(b => ({ ...b, id: b.id || uuidv4(), receivedAt: b.receivedAt || receivedTime, createdAt: now }))
    const ledger = batches.map(b => ({
      id: uuidv4(), batchId: b.id, itemId: b.itemId,
      transactionType: 'GRN', referenceId: b.id,
      referenceNumber: grnData.grnNumber,
      quantityIn: b.quantityReceived, quantityOut: 0, balanceAfter: b.quantityReceived,
      unitCost: b.unitCostPrice, totalValue: b.quantityReceived * b.unitCostPrice,
      loggedAt: b.receivedAt || receivedTime,
    }))

    setState(prev => ({
      ...prev,
      invBatches: [...prev.invBatches, ...batches],
      stockLedger: [...prev.stockLedger, ...ledger],
    }))
    try {
      await insertBatches(batches)
      await insertStockLedger(ledger)
    } catch (e) {
      console.error('[receiveGRN]', e.message)
      throw e
    }
    return batches
  }, [s.invBatches])

  const saveInventoryOpeningBalance = useCallback(async (itemsData) => {
    const now = new Date().toISOString()
    const latestState = getState()

    const batchesToInsert = []
    const batchesToUpdate = []
    const ledgerToInsert = []
    const ledgerToUpdate = []

    for (const data of itemsData) {
      const { itemId, quantity, unitCost } = data
      const existingBatch = latestState.invBatches.find(
        b => b.itemId === itemId && b.batchNumber === 'SALDO-AWAL'
      )

      if (existingBatch) {
        const diffQty = quantity - existingBatch.quantityReceived
        const newQtyCurrent = Math.max(0, existingBatch.quantityCurrent + diffQty)

        const updatedB = {
          ...existingBatch,
          quantityReceived: quantity,
          quantityCurrent: newQtyCurrent,
          unitCostPrice: unitCost,
        }
        batchesToUpdate.push(updatedB)

        const existingLedger = latestState.stockLedger.find(
          l => l.batchId === existingBatch.id && l.transactionType === 'SALDO_AWAL'
        )

        if (existingLedger) {
          const updatedL = {
            ...existingLedger,
            quantityIn: quantity,
            balanceAfter: quantity,
            unitCost: unitCost,
            totalValue: quantity * unitCost,
          }
          ledgerToUpdate.push(updatedL)
        } else {
          ledgerToInsert.push({
            id: uuidv4(),
            batchId: existingBatch.id,
            itemId,
            transactionType: 'SALDO_AWAL',
            referenceId: existingBatch.id,
            referenceNumber: 'SALDO-AWAL',
            quantityIn: quantity,
            quantityOut: 0,
            balanceAfter: quantity,
            unitCost: unitCost,
            totalValue: quantity * unitCost,
            notes: 'Saldo Awal',
            loggedAt: now,
          })
        }
      } else {
        const batchId = uuidv4()
        const newB = {
          id: batchId,
          itemId,
          batchNumber: 'SALDO-AWAL',
          expiryDate: '2035-12-31',
          manufactureDate: null,
          unitCostPrice: unitCost,
          quantityReceived: quantity,
          quantityCurrent: quantity,
          grnReference: 'SALDO-AWAL',
          supplierName: 'Saldo Awal',
          receivedAt: now,
          createdAt: now,
        }
        batchesToInsert.push(newB)

        ledgerToInsert.push({
          id: uuidv4(),
          batchId,
          itemId,
          transactionType: 'SALDO_AWAL',
          referenceId: batchId,
          referenceNumber: 'SALDO-AWAL',
          quantityIn: quantity,
          quantityOut: 0,
          balanceAfter: quantity,
          unitCost: unitCost,
          totalValue: quantity * unitCost,
          notes: 'Saldo Awal',
          loggedAt: now,
        })
      }
    }

    // Optimistic UI updates
    setState(prev => {
      let nextBatches = [...prev.invBatches]
      let nextLedger = [...prev.stockLedger]

      nextBatches = [...nextBatches, ...batchesToInsert]
      nextLedger = [...nextLedger, ...ledgerToInsert]

      batchesToUpdate.forEach(ub => {
        nextBatches = nextBatches.map(b => b.id === ub.id ? ub : b)
      })
      ledgerToUpdate.forEach(ul => {
        nextLedger = nextLedger.map(l => l.id === ul.id ? ul : l)
      })

      return {
        ...prev,
        invBatches: nextBatches,
        stockLedger: nextLedger
      }
    })

    try {
      await batchUpsertInventoryStatus(batchesToInsert, batchesToUpdate, ledgerToInsert, ledgerToUpdate)
      // Log activity directly (logActivity is defined later in hook, can't reference it here)
      insertAuditLog({
        id: uuidv4(), user_id: 'system', user_name: 'System', user_role: 'system',
        action: 'SAVE_INVENTORY_OPENING_BALANCES', module: 'INVENTORY',
        detail: `Saved opening balances for ${itemsData.length} items`,
        ip_address: '127.0.0.1', created_at: new Date().toISOString(),
      }).catch(() => { })
    } catch (e) {
      console.error('[saveInventoryOpeningBalance]', e.message)
      throw e
    }
  }, [s.invBatches, s.stockLedger])


  const adjustStock = useCallback(async (batchId, itemId, qty, reason, type) => {
    const batch = s.invBatches.find(b => b.id === batchId)
    if (!batch) return
    const newQty = type === 'REMOVE' ? 0 : Math.max(0, batch.quantityCurrent + qty)
    const entry = {
      id: uuidv4(), batchId, itemId,
      transactionType: type === 'REMOVE' ? 'EXPIRED' : 'ADJUSTMENT',
      referenceId: batchId, referenceNumber: `ADJ-${Date.now()}`,
      quantityIn: type === 'ADD' ? Math.abs(qty) : 0,
      quantityOut: type === 'REMOVE' ? batch.quantityCurrent : (qty < 0 ? Math.abs(qty) : 0),
      balanceAfter: newQty,
      unitCost: batch.unitCostPrice,
      totalValue: (type === 'REMOVE' ? batch.quantityCurrent : Math.abs(qty)) * batch.unitCostPrice,
      notes: reason, loggedAt: new Date().toISOString(),
    }
    setState(prev => ({
      ...prev,
      invBatches: prev.invBatches.map(b => b.id === batchId ? { ...b, quantityCurrent: newQty } : b),
      stockLedger: [...prev.stockLedger, entry],
    }))
    try { await updateBatchQty(batchId, newQty); await insertStockLedger([entry]) } catch (e) { console.error('[adjustStock]', e.message) }
  }, [s.invBatches])

  const getItemStock = useCallback((itemId) =>
    s.invBatches.filter(b => b.itemId === itemId && b.quantityCurrent > 0)
      .reduce((sum, b) => sum + b.quantityCurrent, 0),
    [s.invBatches])

  const depleteInventoryFIFO = useCallback(async (itemId, qtyNeeded, referenceNumber, branchId) => {
    let item = s.pharmacyItems.find(p => p.id === itemId)
    try {
      const { data: dbItem } = await supabase.from('pharmacy_items').select('*').eq('id', itemId).maybeSingle()
      if (dbItem) {
        item = {
          ...item,
          ...norm(dbItem),
          coaInventoryCode: dbItem.coa_inventory_code || item?.coaInventoryCode,
          coaCOGSCode: dbItem.coa_cogs_code || item?.coaCOGSCode || item?.coaCogsCode,
          coaCogsCode: dbItem.coa_cogs_code || item?.coaCogsCode,
          category: dbItem.category || item?.category
        }
      }
    } catch (_) { }

    const isBHP = item?.category === 'BHP' || item?.category === 'PEMAKAIAN BHP' || item?.itemCategory === 'BHP' || item?.item_category === 'BHP' || item?.category === 'BHP_MEDIS' || (item?.itemCode || item?.item_code || '').startsWith('BHP-')
    const isOTC = (item?.category || item?.itemCategory || '').toUpperCase().includes('OTC') || (item?.category || item?.itemCategory || '').toUpperCase().includes('GENERIK') || (item?.category || item?.itemCategory || '').toUpperCase().includes('BEBAS')

    const cogsKey = isBHP ? 'cogs_bhp' : (isOTC ? 'cogs_otc' : 'cogs_ethical')
    const invKey = isBHP ? 'inv_bhp' : (isOTC ? 'inv_otc' : 'inv_ethical')
    const defaultCogs = isBHP ? '5-11-003' : (isOTC ? '5-11-002' : '5-11-001')
    const defaultInv = isBHP ? '1-13-003' : (isOTC ? '1-13-002' : '1-13-001')

    const mappedCogs = getAccountCode(cogsKey, s.appSettings, defaultCogs)
    const mappedInv = getAccountCode(invKey, s.appSettings, defaultInv)

    const itemCogs = item?.coaCogsCode || item?.coaCOGSCode || item?.coa_cogs_code
    const itemInv = item?.coaInventoryCode || item?.coa_inventory_code

    // Prioritaskan hasil mapping akun yang diatur pada /coa jika item memakai default lama, atau gunakan override khusus
    const coaCOGSCode = (itemCogs && !['5-11-001', '5-11-002', '5-11-003'].includes(itemCogs)) ? itemCogs : mappedCogs
    const coaInventoryCode = (itemInv && !['1-13-001', '1-13-002', '1-13-003'].includes(itemInv)) ? itemInv : mappedInv

    const activeBatches = [...s.invBatches]
      .filter(b => b.itemId === itemId && b.quantityCurrent > 0)
      .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate))

    let remaining = qtyNeeded
    const depletedList = []
    const updatedBatchesMap = {}

    for (const batch of activeBatches) {
      if (remaining <= 0) break

      const take = Math.min(batch.quantityCurrent, remaining)
      remaining -= take

      const newQty = batch.quantityCurrent - take
      depletedList.push({
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        qty: take,
        unitCostPrice: batch.unitCostPrice,
        expiryDate: batch.expiryDate,
        coaCOGSCode,
        coaInventoryCode,
      })
      updatedBatchesMap[batch.id] = newQty
    }

    if (remaining > 0) {
      const fallbackCost = item?.purchasePrice || item?.hpp || item?.unitCostPrice || item?.sellingPrice || 0
      depletedList.push({
        batchId: uuidv4(),
        batchNumber: 'DIRECT-BILLING',
        qty: remaining,
        unitCostPrice: fallbackCost,
        expiryDate: new Date().toISOString(),
        coaCOGSCode,
        coaInventoryCode,
      })
    }

    // Calculate running balance per item for stock_ledger_cards
    const initialItemStock = (s.invBatches || [])
      .filter(b => b.itemId === itemId)
      .reduce((sum, b) => sum + (b.quantityCurrent || 0), 0)

    let currentItemBalance = initialItemStock
    const now = new Date().toISOString()

    const ledgerEntries = depletedList.map(dep => {
      currentItemBalance -= dep.qty
      return {
        id: uuidv4(),
        batchId: dep.batchId,
        itemId: itemId,
        transactionType: 'BILLING',
        referenceId: dep.batchId,
        referenceNumber: referenceNumber,
        quantityIn: 0,
        quantityOut: dep.qty,
        balanceAfter: Math.max(0, currentItemBalance),
        unitCost: dep.unitCostPrice,
        totalValue: dep.qty * dep.unitCostPrice,
        loggedAt: now,
      }
    })

    setState(prev => ({
      ...prev,
      invBatches: prev.invBatches.map(b =>
        updatedBatchesMap[b.id] !== undefined
          ? { ...b, quantityCurrent: updatedBatchesMap[b.id] }
          : b
      ),
      stockLedger: [...prev.stockLedger, ...ledgerEntries],
    }))

    try {
      for (const dep of depletedList) {
        await updateBatchQty(dep.batchId, updatedBatchesMap[dep.batchId])
      }
      await insertStockLedger(ledgerEntries)
    } catch (e) {
      console.error('[depleteInventoryFIFO]', e.message)
    }

    return depletedList
  }, [s.invBatches, s.pharmacyItems])


  // ── Billing ───────────────────────────────────────────────
  const generateBillingNumber = useCallback(() => {
    const d = new Date()
    const ym = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
    const prefix = `INV/${ym}/`
    let maxSeq = 0
    ;(s.billings || []).forEach(b => {
      const bNum = b.billingNumber || b.billing_number || ''
      if (bNum.startsWith(prefix)) {
        const parts = bNum.split('/')
        const seq = parseInt(parts[parts.length - 1], 10)
        if (!isNaN(seq) && seq > maxSeq) maxSeq = seq
      }
    })
    return `${prefix}${String(maxSeq + 1).padStart(5, '0')}`
  }, [s.billings])

  const saveBilling = useCallback(async (billing, items = []) => {
    const id = billing.id || uuidv4()
    let billingNumber = billing.billingNumber
    if (!billingNumber) {
      billingNumber = generateBillingNumber()
    }
    let entry = { ...billing, id, billingNumber, createdAt: billing.createdAt || new Date().toISOString() }
    let bItems = items.map(it => ({ ...it, id: it.id || uuidv4(), billingId: id }))

    let attempts = 0
    let saved = null
    while (attempts < 5) {
      try {
        saved = await insertBilling(entry)
        break
      } catch (err) {
        if (err.message && err.message.includes('patient_billings_billing_number_key')) {
          attempts++
          console.warn(`[saveBilling] Duplicate billing number ${entry.billingNumber}, resolving next sequence... attempt ${attempts}`)
          const d = new Date()
          const ym = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
          const prefix = `INV/${ym}/`
          let curSeq = 0
          const parts = entry.billingNumber.split('/')
          const lastSeq = parseInt(parts[parts.length - 1], 10)
          if (!isNaN(lastSeq)) curSeq = lastSeq
          entry = { ...entry, billingNumber: `${prefix}${String(curSeq + 1).padStart(5, '0')}` }
        } else {
          console.error('[saveBilling]', err.message)
          throw err
        }
      }
    }

    try {
      if (bItems.length > 0) {
        await deleteBillingItemsByBilling(id)
        await insertBillingItems(bItems)
      }
    } catch (e) {
      console.error('[saveBilling items]', e.message)
      throw e
    }

    setState(prev => ({
      ...prev,
      billings: [...prev.billings.filter(b => b.id !== id && b.billingNumber !== entry.billingNumber), entry],
      billingItems: [...prev.billingItems.filter(i => i.billingId !== id), ...bItems],
    }))

    return entry
  }, [generateBillingNumber])

  // ── Expense ───────────────────────────────────────────────
  const generateExpenseNumber = useCallback(() => {
    const d = new Date()
    const ym = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`
    const prefix = `EXP/${ym}/`
    let maxSeq = 0
      ; (s.expenses || []).forEach(e => {
        if (e.expenseNumber?.startsWith(prefix)) {
          const parts = e.expenseNumber.split('/')
          const seq = parseInt(parts[parts.length - 1], 10)
          if (!isNaN(seq) && seq > maxSeq) maxSeq = seq
        }
      })
    return `${prefix}${String(maxSeq + 1).padStart(5, '0')}`
  }, [s.expenses])

  const saveExpense = useCallback(async (data) => {
    const id = data.id || uuidv4()
    const entry = { ...data, id, createdAt: data.createdAt || new Date().toISOString() }
    setState(prev => ({ ...prev, expenses: [...prev.expenses.filter(e => e.id !== id), entry] }))
    try {
      const saved = await upsertExpense(entry)
      if (saved) {
        const merged = { ...entry, ...saved }
        setState(prev => ({ ...prev, expenses: [...prev.expenses.filter(e => e.id !== id), merged] }))
        return merged.id
      }
    } catch (e) {
      console.error('[saveExpense]', e.message)
      throw e
    }
    return id
  }, [])

  const postExpense = useCallback(async (expenseId, journalEntryId, postedBy = 'System', fullExpenseObj = null) => {
    const extra = { status: 'POSTED', journalEntryId, authorizedBy: postedBy, postedAt: new Date().toISOString() }
    const cur = fullExpenseObj || getState().expenses.find(e => e.id === expenseId)
    const updated = cur ? { ...cur, ...extra } : { id: expenseId, ...extra }

    setState(prev => ({ ...prev, expenses: prev.expenses.map(e => e.id === expenseId ? updated : e) }))
    try {
      if (updated) {
        const saved = await upsertExpense(updated)
        if (saved) {
          const merged = { ...updated, ...saved }
          setState(prev => ({ ...prev, expenses: prev.expenses.map(e => e.id === expenseId ? merged : e) }))
        }
      }
    } catch (e) {
      console.error('[postExpense]', e.message)
      throw e
    }
  }, [])


  // ── Doctor fee + PPh21 recording ─────────────────────────
  const saveDoctorFeeRecord = useCallback(async (rec) => {
    try { return await insertDoctorFeeRecord(rec) } catch (e) { console.error('[saveDoctorFeeRecord]', e.message) }
  }, [])

  // ── Doctor Management ─────────────────────────────────────
  const addDoctor = useCallback(async (data) => {
    const docId = data.id || uuidv4()
    const doctor = {
      ...data,
      id: docId,
      feePercentage: Number(data.feePercentage ?? data.fee_percentage ?? 30),
      isActive: true,
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    setState(prev => ({ ...prev, doctors: [...prev.doctors.filter(d => d.id !== docId), doctor] }))
    try {
      const saved = await upsertDoctor(doctor)
      setState(prev => ({ ...prev, doctors: prev.doctors.map(d => d.id === saved.id ? saved : d) }))
      logActivity('ADD_DOCTOR', 'SETTINGS', `Added doctor ${saved.fullName || saved.name}`)
      return saved
    } catch (e) {
      console.error('[addDoctor]', e.message)
      setState(prev => ({ ...prev, doctors: prev.doctors.filter(d => d.id !== docId) }))
      throw e
    }
  }, [logActivity])

  const updateDoctor = useCallback(async (id, data) => {
    const oldDoc = s.doctors.find(d => d.id === id)
    const updated = {
      ...oldDoc,
      ...data,
      id,
      feePercentage: Number(data.feePercentage !== undefined ? data.feePercentage : (oldDoc?.feePercentage ?? 30)),
      updatedAt: new Date().toISOString()
    }
    setState(prev => ({
      ...prev,
      doctors: prev.doctors.map(d => d.id === id ? updated : d)
    }))
    try {
      const saved = await upsertDoctor(updated)
      setState(prev => ({ ...prev, doctors: prev.doctors.map(d => d.id === saved.id ? saved : d) }))
      logActivity('UPDATE_DOCTOR', 'SETTINGS', `Updated doctor ${saved.fullName || saved.name}`)
      return saved
    } catch (e) {
      console.error('[updateDoctor]', e.message)
      if (oldDoc) setState(prev => ({ ...prev, doctors: prev.doctors.map(d => d.id === id ? oldDoc : d) }))
      throw e
    }
  }, [s.doctors, logActivity])

  const removeDoctor = useCallback(async (id) => {
    const oldDoc = s.doctors.find(d => d.id === id)
    setState(prev => ({ ...prev, doctors: prev.doctors.map(d => d.id === id ? { ...d, isActive: false, is_active: false } : d) }))
    try {
      await deleteDoctor(id)
      logActivity('DELETE_DOCTOR', 'SETTINGS', `Deactivated doctor ${oldDoc?.fullName || oldDoc?.name}`)
    } catch (e) {
      console.error('[removeDoctor]', e.message)
      if (oldDoc) setState(prev => ({ ...prev, doctors: prev.doctors.map(d => d.id === id ? oldDoc : d) }))
      throw e
    }
  }, [s.doctors, logActivity])



  // ── Fixed Assets Management ──────────────────────────────
  const generateAssetCode = useCallback((category = 'Peralatan Medis') => {
    const prefix = {
      'Peralatan Medis': 'MED',
      'Perabot & Perlengkapan': 'FUR',
      'Kendaraan': 'VEH',
      'Bangunan': 'BLD',
      'Komputer & Elektronik': 'ELC',
    }[category] || 'AST'
    const count = s.fixedAssets.filter(a => a.category === category).length + 1
    return `${prefix}-${String(count).padStart(4, '0')}`
  }, [s.fixedAssets])

  const addAsset = useCallback(async (data) => {
    const assetId = data.id || uuidv4()
    // Menentukan akun utang pengadaan aset yang sesuai
    const debtAccountCode = (data.category === 'PERALATAN_MEDIS' || (data.assetName || '').toLowerCase().includes('medis') || (data.assetName || '').toLowerCase().includes('alat'))
      ? '2-11-002' // Utang Pembelian Alat Kesehatan
      : '2-11-004' // Utang Pengadaan Lain-lain

    const asset = {
      ...data,
      id: assetId,
      status: 'ACTIVE',
      paymentStatus: 'UNPAID',
      paidAmount: 0,
      paymentRef: null,
      accumulatedDepreciation: 0,
      bookValue: data.acquisitionCost,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const journalId = uuidv4()
    const now = new Date().toISOString()
    const entryNumber = generateEntryNumber('AST')

    const journalEntry = {
      id: journalId,
      branchId: s.activeBranchId,
      entryNumber,
      transactionDate: asset.acquisitionDate,
      description: `Perolehan aset tetap: ${asset.assetName} - ${asset.assetCode} (Utang Pengadaan)`,
      entryType: 'ACQUISITION',
      status: 'POSTED',
      totalDebit: asset.acquisitionCost,
      totalCredit: asset.acquisitionCost,
      createdBy: 'System',
      postedBy: 'System',
      postedAt: now,
      createdAt: now,
      updatedAt: now,
    }

    const journalItems = [
      {
        id: uuidv4(),
        journalEntryId: journalId,
        accountCode: asset.coaAssetCode,
        description: `Perolehan aset tetap ${asset.assetName}`,
        debit: asset.acquisitionCost,
        credit: 0,
      },
      {
        id: uuidv4(),
        journalEntryId: journalId,
        accountCode: debtAccountCode,
        description: `Utang Pengadaan Aset: ${asset.assetName} (${asset.assetCode})`,
        debit: 0,
        credit: asset.acquisitionCost,
      }
    ]

    const mutationId = uuidv4()
    const mutation = {
      id: mutationId,
      assetId: assetId,
      mutationType: 'ACQUISITION',
      mutationDate: asset.acquisitionDate,
      referenceNumber: asset.assetCode,
      amount: asset.acquisitionCost,
      quantity: 1,
      description: `Saldo awal / perolehan aset tetap ${asset.assetName}`,
      journalEntryId: journalId,
      createdBy: 'System',
      authorizedBy: 'System',
      createdAt: now
    }

    // Optimistic UI updates
    setState(prev => ({
      ...prev,
      fixedAssets: [...prev.fixedAssets, asset],
      journalEntries: [...prev.journalEntries, journalEntry],
      journalItems: [...prev.journalItems, ...journalItems],
      assetMutations: [...prev.assetMutations, mutation]
    }))

    try {
      const saved = await upsertFixedAsset(asset)
      await upsertJournalEntry(journalEntry)
      await insertJournalItems(journalItems)
      await insertAssetMutation(mutation)

      logActivity('ACQUISITION_ASSET', 'ASSETS', `Recorded acquisition of asset ${asset.assetCode} - ${asset.assetName}`)
      return saved
    } catch (e) {
      console.error('[addAsset]', e.message)
      return asset
    }
  }, [s.activeBranchId, generateEntryNumber, logActivity])

  const updateAsset = useCallback(async (id, data) => {
    setState(prev => ({
      ...prev,
      fixedAssets: prev.fixedAssets.map(a =>
        a.id === id ? { ...a, ...data, updatedAt: new Date().toISOString() } : a
      )
    }))
    try {
      await updateFixedAsset(id, data)
    } catch (e) {
      console.error('[updateAsset]', e.message)
    }
  }, [])

  const deleteAsset = useCallback(async (id) => {
    const mutations = s.assetMutations.filter(m => m.assetId === id)
    const journalEntryIds = mutations.map(m => m.journalEntryId).filter(Boolean)

    const depreciations = s.assetDepreciations.filter(d => d.assetId === id)
    const depJournalIds = depreciations.map(d => d.journalEntryId).filter(Boolean)

    const allJournalIds = [...new Set([...journalEntryIds, ...depJournalIds])]

    setState(prev => ({
      ...prev,
      fixedAssets: prev.fixedAssets.filter(a => a.id !== id),
      assetMutations: prev.assetMutations.filter(m => m.assetId !== id),
      assetDepreciations: prev.assetDepreciations.filter(d => d.assetId !== id),
      journalEntries: prev.journalEntries.filter(j => !allJournalIds.includes(j.id)),
      journalItems: prev.journalItems.filter(ji => !allJournalIds.includes(ji.journalEntryId)),
    }))

    try {
      await deleteAssetDepreciationsByAsset(id)
      await deleteAssetMutationsByAsset(id)
      await deleteFixedAsset(id)

      for (const jId of allJournalIds) {
        await deleteJournalItemsByEntry(jId)
        await deleteJournalEntry(jId)
      }

      logActivity('DELETE_ASSET', 'ASSETS', `Deleted asset ID ${id} and all related transactions/journals`)
    } catch (e) {
      console.error('[deleteAsset]', e.message)
    }
  }, [s.assetMutations, s.assetDepreciations, logActivity])

  const addAssetMutation = useCallback(async (mutation) => {
    const mutationId = mutation.id || uuidv4()
    const isDisposal = ['DISPOSAL', 'SALE'].includes(mutation.mutationType)

    let journalId = null
    let journalEntry = null
    let journalItems = []

    if (isDisposal) {
      const asset = s.fixedAssets.find(a => a.id === mutation.assetId)
      if (asset) {
        journalId = uuidv4()
        const now = new Date().toISOString()
        const entryNumber = generateEntryNumber('DISP')
        const accumulated = parseFloat(asset.accumulatedDepreciation || 0)
        const acquisition = parseFloat(asset.acquisitionCost || 0)
        const bookValue = acquisition - accumulated
        const disposalValue = parseFloat(mutation.disposalValue || 0)
        const gainLoss = disposalValue - bookValue

        journalEntry = {
          id: journalId,
          branchId: s.activeBranchId,
          entryNumber,
          transactionDate: mutation.mutationDate,
          description: `Pelepasan aset tetap (${mutation.mutationType === 'SALE' ? 'Penjualan' : 'Penghapusan'}): ${asset.assetName} - ${asset.assetCode}`,
          entryType: 'DISPOSAL',
          status: 'POSTED',
          totalDebit: 0,
          totalCredit: 0,
          createdBy: 'System',
          postedBy: 'System',
          postedAt: now,
          createdAt: now,
          updatedAt: now,
        }

        if (accumulated > 0) {
          journalItems.push({
            id: uuidv4(),
            journalEntryId: journalId,
            accountCode: asset.coaAccumulatedCode,
            description: `Akumulasi penyusutan dibalik - ${asset.assetName}`,
            debit: accumulated,
            credit: 0
          })
        }

        if (mutation.mutationType === 'SALE' && disposalValue > 0) {
          journalItems.push({
            id: uuidv4(),
            journalEntryId: journalId,
            accountCode: '1-11-003', // Bank BCA
            description: `Kas masuk dari penjualan ${asset.assetName}`,
            debit: disposalValue,
            credit: 0
          })
        }

        if (gainLoss < 0) {
          journalItems.push({
            id: uuidv4(),
            journalEntryId: journalId,
            accountCode: '6-99-001', // Rugi Pelepasan Aset Tetap
            description: `Kerugian pelepasan aset tetap ${asset.assetName}`,
            debit: Math.abs(gainLoss),
            credit: 0
          })
        } else if (gainLoss > 0) {
          journalItems.push({
            id: uuidv4(),
            journalEntryId: journalId,
            accountCode: '8-91-001', // Laba Pelepasan Aset Tetap
            description: `Keuntungan pelepasan aset tetap ${asset.assetName}`,
            debit: 0,
            credit: gainLoss
          })
        }

        journalItems.push({
          id: uuidv4(),
          journalEntryId: journalId,
          accountCode: asset.coaAssetCode,
          description: `Pemberhentian aset tetap ${asset.assetName}`,
          debit: 0,
          credit: acquisition
        })

        const totalDebit = journalItems.reduce((acc, ji) => acc + (ji.debit || 0), 0)
        journalEntry.totalDebit = totalDebit
        journalEntry.totalCredit = totalDebit
      }
    }

    const newMutation = {
      ...mutation,
      id: mutationId,
      journalEntryId: journalId,
      createdAt: new Date().toISOString(),
    }

    setState(prev => {
      const updatedMutations = [...prev.assetMutations, newMutation]
      const updatedEntries = journalEntry
        ? [...prev.journalEntries, journalEntry]
        : prev.journalEntries
      const updatedItems = journalItems.length > 0
        ? [...prev.journalItems, ...journalItems]
        : prev.journalItems
      return {
        ...prev,
        assetMutations: updatedMutations,
        journalEntries: updatedEntries,
        journalItems: updatedItems
      }
    })

    try {
      if (journalEntry) {
        await upsertJournalEntry(journalEntry)
        await insertJournalItems(journalItems)
      }
      const saved = await insertAssetMutation(newMutation)
      setState(prev => ({
        ...prev,
        assetMutations: prev.assetMutations.map(m => m.id === saved.id ? saved : m)
      }))

      logActivity('MUTATION_ASSET', 'ASSETS', `Recorded mutation ${newMutation.mutationType} for asset ID ${newMutation.assetId}`)
      return saved
    } catch (e) {
      console.error('[addAssetMutation]', e.message)
      return newMutation
    }
  }, [s.activeBranchId, s.fixedAssets, generateEntryNumber, logActivity])

  const calculateDepreciation = useCallback(async (assetId, year, month) => {
    try {
      const amount = await calculateMonthlyDepreciation(assetId, year, month)
      return amount
    } catch (e) {
      console.error('[calculateDepreciation]', e.message)
      return 0
    }
  }, [])



  const saveDepreciation = useCallback(async (depreciation) => {
    const id = depreciation.id || uuidv4()
    const entry = {
      ...depreciation,
      id,
      calculationMethod: 'STRAIGHT_LINE',
      calculationDate: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
    }
    setState(prev => ({
      ...prev,
      assetDepreciations: [...prev.assetDepreciations.filter(d => d.id !== id), entry]
    }))
    try {
      const saved = await upsertAssetDepreciation(entry)
      setState(prev => ({
        ...prev,
        assetDepreciations: prev.assetDepreciations.map(d => d.id === saved.id ? saved : d)
      }))
      return saved
    } catch (e) {
      console.error('[saveDepreciation]', e.message)
      return entry
    }
  }, [])

  const postDepreciation = useCallback(async (depreciationId, postedBy = 'System') => {
    const depreciation = s.assetDepreciations.find(d => d.id === depreciationId)
    if (!depreciation) return { ok: false, error: 'Penyusutan tidak ditemukan.' }

    const asset = s.fixedAssets.find(a => a.id === depreciation.assetId)
    if (!asset) return { ok: false, error: 'Aset tidak ditemukan.' }

    // Update asset accumulated depreciation
    const newAccumulated = (asset.accumulatedDepreciation || 0) + depreciation.depreciationAmount
    const newBookValue = asset.acquisitionCost - newAccumulated

    // Generate journal entry for depreciation
    const journalId = uuidv4()
    const now = new Date().toISOString()
    const transactionDate = `${depreciation.periodYear}-${String(depreciation.periodMonth).padStart(2, '0')}-01`

    const journalEntry = {
      id: journalId,
      branchId: s.activeBranchId,
      entryNumber: generateEntryNumber('DEPR'),
      transactionDate,
      description: `Penyusutan ${asset.assetName} - ${asset.assetCode} periode ${depreciation.periodMonth}/${depreciation.periodYear}`,
      entryType: 'DEPRECIATION',
      status: 'POSTED',
      totalDebit: depreciation.depreciationAmount,
      totalCredit: depreciation.depreciationAmount,
      createdBy: postedBy,
      postedBy,
      postedAt: now,
      createdAt: now,
      updatedAt: now,
    }

    const journalItems = [
      {
        id: uuidv4(),
        journalEntryId: journalId,
        accountCode: asset.coaDepreciationCode,
        description: `Beban penyusutan ${asset.assetName}`,
        debit: depreciation.depreciationAmount,
        credit: 0,
      },
      {
        id: uuidv4(),
        journalEntryId: journalId,
        accountCode: asset.coaAccumulatedCode,
        description: `Akumulasi penyusutan ${asset.assetName}`,
        debit: 0,
        credit: depreciation.depreciationAmount,
      }
    ]

    const extra = {
      status: 'POSTED',
      postedBy,
      postedAt: now,
      journalEntryId: journalId,
    }

    setState(prev => ({
      ...prev,
      assetDepreciations: prev.assetDepreciations.map(d =>
        d.id === depreciationId ? { ...d, ...extra } : d
      ),
      fixedAssets: prev.fixedAssets.map(a =>
        a.id === asset.id
          ? {
            ...a,
            accumulatedDepreciation: newAccumulated,
            bookValue: newBookValue,
            lastDepreciationDate: new Date().toISOString().split('T')[0],
            updatedAt: new Date().toISOString(),
          }
          : a
      ),
      journalEntries: [...prev.journalEntries, journalEntry],
      journalItems: [...prev.journalItems, ...journalItems],
    }))

    try {
      // Save journal first
      await upsertJournalEntry(journalEntry)
      await insertJournalItems(journalItems)

      // Update depreciation status
      await updateDepreciationStatus(depreciationId, 'POSTED', extra)

      // Update asset
      await updateFixedAsset(asset.id, {
        accumulatedDepreciation: newAccumulated,
        bookValue: newBookValue,
        lastDepreciationDate: new Date().toISOString().split('T')[0],
      })

      // Log activity
      logActivity('POST_DEPRECIATION', 'ASSETS', `Posted depreciation for ${asset.assetCode} - ${asset.assetName}`)
    } catch (e) {
      console.error('[postDepreciation]', e.message)
      return { ok: false, error: e.message }
    }

    return { ok: true, journalId }
  }, [s.assetDepreciations, s.fixedAssets, s.activeBranchId, generateEntryNumber, logActivity])

  const addVendor = useCallback(async (data) => {
    const vendor = {
      ...data,
      id: data.id || uuidv4(),
      isActive: data.isActive !== undefined ? data.isActive : true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    setState(prev => ({ ...prev, vendors: [...prev.vendors.filter(v => v.id !== vendor.id), vendor] }))
    try {
      const saved = await upsertVendor(vendor)
      setState(prev => ({ ...prev, vendors: prev.vendors.map(v => v.id === saved.id ? saved : v) }))
      return saved
    } catch (e) {
      console.error('[addVendor]', e.message)
      setState(prev => ({ ...prev, vendors: prev.vendors.filter(v => v.id !== vendor.id) }))
      throw e
    }
  }, [])

  const updateVendor = useCallback(async (id, data) => {
    const prevVendors = s.vendors
    const cur = prevVendors.find(v => v.id === id)
    setState(prev => ({
      ...prev,
      vendors: prev.vendors.map(v => v.id === id ? { ...v, ...data, updatedAt: new Date().toISOString() } : v)
    }))
    try {
      if (cur) await upsertVendor({ ...cur, ...data })
    } catch (e) {
      console.error('[updateVendor]', e.message)
      setState(prev => ({ ...prev, vendors: prevVendors }))
      throw e
    }
  }, [s.vendors])

  const addServiceTariff = useCallback(async (data) => {
    const tariff = {
      ...data,
      id: data.id || uuidv4(),
      isActive: data.isActive !== undefined ? data.isActive : true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    setState(prev => ({ ...prev, serviceTariffs: [...prev.serviceTariffs.filter(t => t.id !== tariff.id), tariff] }))
    try {
      const saved = await upsertServiceTariff(tariff)
      setState(prev => ({ ...prev, serviceTariffs: prev.serviceTariffs.map(t => t.id === saved.id ? saved : t) }))
      return saved
    } catch (e) {
      console.error('[addServiceTariff]', e.message)
      setState(prev => ({ ...prev, serviceTariffs: prev.serviceTariffs.filter(t => t.id !== tariff.id) }))
      throw e
    }
  }, [])

  const updateServiceTariff = useCallback(async (id, data) => {
    const prevTariffs = s.serviceTariffs
    const cur = prevTariffs.find(t => t.id === id)
    setState(prev => ({
      ...prev,
      serviceTariffs: prev.serviceTariffs.map(t => t.id === id ? { ...t, ...data, updatedAt: new Date().toISOString() } : t)
    }))
    try {
      if (cur) await upsertServiceTariff({ ...cur, ...data })
    } catch (e) {
      console.error('[updateServiceTariff]', e.message)
      setState(prev => ({ ...prev, serviceTariffs: prevTariffs }))
      throw e
    }
  }, [s.serviceTariffs])

  // ── Stock Outflow Management ─────────────────────────────
  const generateOutflowNumber = useCallback(() => {
    const d = new Date()
    const ym = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`
    return `OUT/${ym}/${String((s.stockOutflows || []).length + 1).padStart(5, '0')}`
  }, [s.stockOutflows])

  const saveStockOutflow = useCallback(async (data) => {
    const { outflowNumber, outflowDate, outflowType, description, totalValue, items } = data

    if (!items || items.length === 0) {
      throw new Error('Minimal harus ada 1 item')
    }

    const outflowId = uuidv4()
    const journalId = uuidv4()
    const now = new Date().toISOString()

    // Create outflow entry
    const outflow = {
      id: outflowId,
      branchId: s.activeBranchId,
      outflowNumber,
      outflowDate,
      outflowType,
      description,
      totalValue,
      status: 'DRAFT',
      journalEntryId: journalId,
      createdBy: 'User',
      createdAt: now,
      updatedAt: now,
    }

    // Create outflow items
    const outflowItems = items.map(item => ({
      id: uuidv4(),
      outflowId,
      itemId: item.itemId,
      itemName: item.itemName,
      quantity: item.quantity,
      unitCost: item.unitCost,
      totalCost: item.totalCost,
      notes: item.notes || '',
    }))

    // Deplete inventory using FIFO
    const cogsDetails = []
    for (const item of items) {
      const depletedBatches = await depleteInventoryFIFO(
        item.itemId,
        item.quantity,
        outflowNumber,
        outflowId
      )
      cogsDetails.push(...depletedBatches)
    }

    // Create journal entry
    const entryNumber = generateEntryNumber('OUT')
    const journalItems = []

    // Consolidate by COA codes
    const expenseDebits = {}
    const inventoryCredits = {}

    // Map outflowType to appropriate PABU expense account
    const OUTFLOW_EXPENSE_MAP = {
      INTERNAL_USE: '6-18-001', // Beban Perlengkapan & Pemakaian Klinik
      OVERHEAD: '6-18-001',     // Beban Overhead / Operasional Klinik
      SAMPLE: '6-13-001',       // Beban Promosi & Sampel
      DONATION: '6-91-002',     // Beban Donasi & Sosial
      WASTE: '6-91-003',        // Beban Kerugian Barang Rusak / Kadaluarsa
    }

    cogsDetails.forEach(d => {
      const val = d.qty * d.unitCostPrice
      if (val > 0) {
        const targetExpenseAccount = OUTFLOW_EXPENSE_MAP[outflowType] || d.coaCOGSCode || '5-11-001'
        expenseDebits[targetExpenseAccount] = (expenseDebits[targetExpenseAccount] || 0) + val
        inventoryCredits[d.coaInventoryCode || '1-13-001'] = (inventoryCredits[d.coaInventoryCode || '1-13-001'] || 0) + val
      }
    })

    Object.entries(expenseDebits).forEach(([coaCode, val]) => {
      journalItems.push({
        id: uuidv4(),
        journalEntryId: journalId,
        accountCode: coaCode,
        description: `Pengeluaran ${outflowType} — ${outflowNumber}`,
        debit: val,
        credit: 0,
      })
    })

    Object.entries(inventoryCredits).forEach(([coaCode, val]) => {
      journalItems.push({
        id: uuidv4(),
        journalEntryId: journalId,
        accountCode: coaCode,
        description: `Pengurangan Persediaan — ${outflowNumber}`,
        debit: 0,
        credit: val,
      })
    })

    const totalDebit = journalItems.reduce((sum, i) => sum + (i.debit || 0), 0)

    const journalEntry = {
      id: journalId,
      branchId: s.activeBranchId,
      entryNumber,
      transactionDate: outflowDate,
      description: `Pengeluaran Stok ${outflowType} — ${description}`,
      entryType: 'STOCK_OUTFLOW',
      status: 'POSTED',
      totalDebit,
      totalCredit: totalDebit,
      createdBy: 'System',
      postedBy: 'System',
      postedAt: now,
      createdAt: now,
      updatedAt: now,
    }

    // Optimistic updates
    setState(prev => ({
      ...prev,
      stockOutflows: [...prev.stockOutflows, outflow],
      stockOutflowItems: [...prev.stockOutflowItems, ...outflowItems],
      journalEntries: [...prev.journalEntries, journalEntry],
      journalItems: [...prev.journalItems, ...journalItems],
    }))

    // Persist to database
    try {
      await insertStockOutflow(outflow)
      await insertStockOutflowItems(outflowItems)
      await upsertJournalEntry(journalEntry)
      await insertJournalItems(journalItems)

      // Update outflow status to POSTED
      await updateStockOutflow(outflowId, { status: 'POSTED', journalEntryId: journalId })

      setState(prev => ({
        ...prev,
        stockOutflows: prev.stockOutflows.map(o =>
          o.id === outflowId ? { ...o, status: 'POSTED', journalEntryId: journalId } : o
        ),
      }))

      logActivity('CREATE_STOCK_OUTFLOW', 'INVENTORY', `Created stock outflow ${outflowNumber}`)
    } catch (e) {
      console.error('[saveStockOutflow]', e.message)
      throw e
    }

    return outflowId
  }, [s.activeBranchId, depleteInventoryFIFO, generateEntryNumber, logActivity])

  const postStockOutflow = useCallback(async (outflowId, postedBy = 'System') => {
    const outflow = s.stockOutflows.find(o => o.id === outflowId)
    if (!outflow || outflow.status !== 'DRAFT') {
      return { ok: false, error: 'Hanya draft yang dapat diposting' }
    }

    const extra = { status: 'POSTED', authorizedBy: postedBy }
    setState(prev => ({
      ...prev,
      stockOutflows: prev.stockOutflows.map(o => o.id === outflowId ? { ...o, ...extra } : o),
    }))

    try {
      await updateStockOutflow(outflowId, extra)
      logActivity('POST_STOCK_OUTFLOW', 'INVENTORY', `Posted stock outflow ${outflow.outflowNumber}`)
    } catch (e) {
      console.error('[postStockOutflow]', e.message)
      return { ok: false, error: e.message }
    }

    return { ok: true }
  }, [s.stockOutflows, logActivity])

  // ── User Management ──────────────────────────────────────
  const addUser = useCallback(async (data) => {
    const user = {
      ...data,
      id: data.id || uuidv4(),
      createdAt: new Date().toISOString(),
    }
    setState(prev => ({ ...prev, users: [...prev.users, user] }))
    try {
      const saved = await upsertUser(user)
      setState(prev => ({ ...prev, users: prev.users.map(u => u.id === saved.id ? saved : u) }))
      logActivity('CREATE_USER', 'SETTINGS', `Created user ${user.name}`)
      return saved
    } catch (e) {
      console.error('[addUser]', e.message)
      setState(prev => ({ ...prev, users: prev.users.filter(u => u.id !== user.id) }))
      throw e
    }
  }, [logActivity])

  const updateUser = useCallback(async (id, data) => {
    const oldData = s.users.find(u => u.id === id)
    setState(prev => ({
      ...prev,
      users: prev.users.map(u => u.id === id ? { ...u, ...data } : u)
    }))
    try {
      const cur = s.users.find(u => u.id === id)
      if (cur) await upsertUser({ ...cur, ...data })
      logActivity('UPDATE_USER', 'SETTINGS', `Updated user ${data.name || cur.name}`)
    } catch (e) {
      console.error('[updateUser]', e.message)
      setState(prev => ({ ...prev, users: prev.users.map(u => u.id === id ? oldData : u) }))
      throw e
    }
  }, [s.users, logActivity])

  const removeUser = useCallback(async (id) => {
    const user = s.users.find(u => u.id === id)
    setState(prev => ({ ...prev, users: prev.users.filter(u => u.id !== id) }))
    try {
      await deleteUser(id)
      logActivity('DELETE_USER', 'SETTINGS', `Deleted user ${user?.name}`)
    } catch (e) {
      console.error('[removeUser]', e.message)
      setState(prev => ({ ...prev, users: [...prev.users, user] }))
      throw e
    }
  }, [s.users, logActivity])

  // ── App Settings ─────────────────────────────────────────
  const updateAppSettings = useCallback(async (settings) => {
    const oldSettings = { ...s.appSettings }
    setState(prev => ({ ...prev, appSettings: { ...prev.appSettings, ...settings } }))
    try {
      await saveAllAppSettings(settings)
      logActivity('UPDATE_SETTINGS', 'SETTINGS', `Updated app settings`)
    } catch (e) {
      console.error('[updateAppSettings]', e.message)
      setState(prev => ({ ...prev, appSettings: oldSettings }))
      throw e
    }
  }, [s.appSettings, logActivity])

  // ── Opening Balances ──────────────────────────────────────
  const saveOpeningBalances = useCallback(async (openingBalancesData) => {
    const oldBalances = [...s.openingBalances]

    // Optimistic update
    setState(prev => ({ ...prev, openingBalances: openingBalancesData }))

    try {
      const saved = await batchUpsertOpeningBalances(openingBalancesData)
      setState(prev => ({ ...prev, openingBalances: saved }))
      logActivity('SAVE_OPENING_BALANCES', 'ACCOUNTING', `Saved opening balances for ${openingBalancesData.length} accounts`)
      return { ok: true, data: saved }
    } catch (e) {
      console.error('[saveOpeningBalances]', e.message)
      // Rollback on error
      setState(prev => ({ ...prev, openingBalances: oldBalances }))
      return { ok: false, error: e.message }
    }
  }, [s.openingBalances, logActivity])

  const refreshOpeningBalances = useCallback(async (filters = {}) => {
    try {
      const balances = await fetchOpeningBalances(filters)
      setState(prev => ({ ...prev, openingBalances: balances }))
      return balances
    } catch (e) {
      console.error('[refreshOpeningBalances]', e.message)
      return []
    }
  }, [])

  return {
    ...s,
    refreshAll,
    setActiveBranch, getActiveBranch,
    addBranch, updateBranch,
    addAccount, updateAccount: updateAccountFn, deactivateAccount, clearAllCOA, batchAddAccounts,
    generateEntryNumber, saveJournalDraft, postJournalEntry, reverseJournal,
    generateSku, generateItemCode,
    addPharmacyItem, updatePharmacyItem, receiveGRN, adjustStock, getItemStock, depleteInventoryFIFO, saveInventoryOpeningBalance,
    generateBillingNumber, saveBilling,
    generateExpenseNumber, saveExpense, postExpense,
    saveDoctorFeeRecord, addDoctor, updateDoctor, removeDoctor,
    generateAssetCode, addAsset, updateAsset, deleteAsset,
    addAssetMutation, calculateDepreciation, saveDepreciation, postDepreciation,
    addVendor, updateVendor, addServiceTariff, updateServiceTariff,
    generateOutflowNumber, saveStockOutflow, postStockOutflow,
    addUser, updateUser, removeUser,
    updateAppSettings,
    saveOpeningBalances, refreshOpeningBalances,
    logActivity,
  }
}
