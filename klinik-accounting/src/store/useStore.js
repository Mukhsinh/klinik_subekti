/**
 * useStore.js — Global state backed by Supabase
 * Uses a simple pub/sub singleton so all components share one state.
 * Data is fetched from Supabase on init and kept in memory.
 * Writes go to Supabase and update local state for instant UI feedback.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import {
  fetchBranches, upsertBranch,
  fetchCOA, upsertAccount, updateAccount as dbUpdateAccount,
  fetchJournalEntries, fetchJournalItems,
  upsertJournalEntry, insertJournalItems,
  updateJournalStatus, deleteJournalItemsByEntry,
  fetchPharmacyItems, upsertPharmacyItem,
  fetchBatches, insertBatches, updateBatchQty,
  fetchStockLedger, insertStockLedger,
  fetchBillings, insertBilling, insertBillingItems, fetchBillingItems,
  fetchExpenses, upsertExpense,
  fetchDoctors, insertAuditLog,
  fetchServiceTariffs, upsertServiceTariff,
  fetchVendors, upsertVendor,
} from '../lib/db'
import { initialCOA } from '../data/initialCOA'
import { initialBranches } from '../data/initialData'

// ── Singleton ─────────────────────────────────────────────────
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
  serviceTariffs: [],
  vendors: [],
  activeBranchId: null,
  loading: true,
  initialized: false,
}
const _listeners = new Set()

function getState() { return _state }
function setState(upd) {
  _state = typeof upd === 'function' ? upd(_state) : { ..._state, ...upd }
  _listeners.forEach(fn => fn())
}

// ── Bootstrap — load all data from Supabase once ──────────────
let _bootstrapPromise = null
async function bootstrap() {
  if (_bootstrapPromise) return _bootstrapPromise
  _bootstrapPromise = (async () => {
    try {
      const [branches, coa, journals, pharmacyItems, batches, billings, expenses, doctors, serviceTariffs, vendors] =
        await Promise.all([
          fetchBranches(),
          fetchCOA(),
          fetchJournalEntries(),
          fetchPharmacyItems(),
          fetchBatches(),
          fetchBillings(),
          fetchExpenses(),
          fetchDoctors(),
          fetchServiceTariffs().catch(() => []),
          fetchVendors().catch(() => []),
        ])

      // Use seeded COA if DB is empty (first run fallback)
      const finalCOA = coa.length > 0 ? coa : initialCOA

      // Use seeded branches if DB is empty
      const finalBranches = branches.length > 0 ? branches : initialBranches

      // Fetch journal items for all entries
      const entryIds = journals.map(j => j.id)
      const [jItems, batchBillings, stockLedgerRows] = await Promise.all([
        entryIds.length ? fetchJournalItems(entryIds) : Promise.resolve([]),
        billings.length ? fetchBillingItems(billings.map(b => b.id)) : Promise.resolve([]),
        fetchStockLedger(),
      ])

      const savedBranchId = localStorage.getItem('activeBranchId')
      const activeBranchId = savedBranchId || (finalBranches[0]?.id ?? null)

      setState({
        branches: finalBranches,
        coa: finalCOA,
        journalEntries: journals,
        journalItems: jItems,
        pharmacyItems,
        invBatches: batches,
        stockLedger: stockLedgerRows,
        billings,
        billingItems: batchBillings,
        expenses,
        doctors,
        serviceTariffs,
        vendors,
        activeBranchId,
        loading: false,
        initialized: true,
      })
    } catch (err) {
      console.error('[Bootstrap] Failed to load from Supabase, using local fallback:', err.message)
      setState({
        branches: initialBranches,
        coa: initialCOA,
        loading: false,
        initialized: true,
      })
    }
  })()
  return _bootstrapPromise
}

// ── React hook ────────────────────────────────────────────────
export function useStore() {
  const [, forceRender] = useState(0)
  const mounted = useRef(false)

  useEffect(() => {
    mounted.current = true
    const listener = () => { if (mounted.current) forceRender(n => n + 1) }
    _listeners.add(listener)
    bootstrap() // idempotent
    return () => { mounted.current = false; _listeners.delete(listener) }
  }, [])

  const state = getState()

  // ── Branch ────────────────────────────────────────────────
  const setActiveBranch = useCallback((id) => {
    localStorage.setItem('activeBranchId', id)
    setState(s => ({ ...s, activeBranchId: id }))
  }, [])

  const getActiveBranch = useCallback(() =>
    state.branches.find(b => b.id === state.activeBranchId) || state.branches[0],
    [state])

  const addBranch = useCallback(async (data) => {
    const branch = { ...data, id: uuidv4(), isActive: true }
    try {
      const saved = await upsertBranch(branch)
      setState(s => ({ ...s, branches: [...s.branches, saved] }))
      return saved
    } catch {
      setState(s => ({ ...s, branches: [...s.branches, branch] }))
      return branch
    }
  }, [])

  const updateBranch = useCallback(async (id, data) => {
    const updated = { ...state.branches.find(b => b.id === id), ...data }
    try { await upsertBranch(updated) } catch (_) { }
    setState(s => ({ ...s, branches: s.branches.map(b => b.id === id ? { ...b, ...data } : b) }))
  }, [state.branches])

  // ── COA ───────────────────────────────────────────────────
  const addAccount = useCallback(async (data) => {
    const acc = { ...data, isActive: true }
    try { await upsertAccount(acc) } catch (_) { }
    setState(s => ({ ...s, coa: [...s.coa, acc] }))
    return acc
  }, [])

  const updateAccountFn = useCallback(async (code, data) => {
    try { await dbUpdateAccount(code, data) } catch (_) { }
    setState(s => ({ ...s, coa: s.coa.map(a => a.accountCode === code ? { ...a, ...data } : a) }))
  }, [])

  const deactivateAccount = useCallback(async (code) => {
    try { await dbUpdateAccount(code, { isActive: false }) } catch (_) { }
    setState(s => ({ ...s, coa: s.coa.map(a => a.accountCode === code ? { ...a, isActive: false } : a) }))
  }, [])

  // ── Journal ───────────────────────────────────────────────
  const generateEntryNumber = useCallback((type = 'JU') => {
    const date = new Date()
    const ym = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`
    const count = state.journalEntries.filter(j => j.entryNumber?.startsWith(type)).length + 1
    return `${type}/${ym}/${String(count).padStart(5, '0')}`
  }, [state.journalEntries])

  const saveJournalDraft = useCallback(async (header, items) => {
    const entryId = header.id || uuidv4()
    const entry = { ...header, id: entryId, status: 'DRAFT', createdAt: header.createdAt || new Date().toISOString() }
    const newItems = items.map(it => ({ ...it, id: it.id || uuidv4(), journalEntryId: entryId }))

    // Optimistic UI update
    setState(s => {
      const entries = s.journalEntries.filter(j => j.id !== entryId)
      const oldItems = s.journalItems.filter(i => i.journalEntryId !== entryId)
      return { ...s, journalEntries: [...entries, entry], journalItems: [...oldItems, ...newItems] }
    })

    // Persist to Supabase
    try {
      await deleteJournalItemsByEntry(entryId)
      await upsertJournalEntry(entry)
      await insertJournalItems(newItems)
    } catch (err) {
      console.error('[saveJournalDraft]', err.message)
    }
    return entryId
  }, [])

  const postJournalEntry = useCallback(async (entryId, postedBy = 'System') => {
    const entry = state.journalEntries.find(j => j.id === entryId)
    if (!entry) return { ok: false, error: 'Jurnal tidak ditemukan.' }
    const items = state.journalItems.filter(i => i.journalEntryId === entryId)
    const totalDebit = items.reduce((s, i) => s + parseFloat(i.debit || 0), 0)
    const totalCredit = items.reduce((s, i) => s + parseFloat(i.credit || 0), 0)
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return { ok: false, error: `Jurnal tidak balance. Debit: ${fmtN(totalDebit)}, Kredit: ${fmtN(totalCredit)}` }
    }
    const extra = { postedBy, postedAt: new Date().toISOString(), totalDebit, totalCredit }
    setState(s => ({
      ...s,
      journalEntries: s.journalEntries.map(j =>
        j.id === entryId ? { ...j, status: 'POSTED', ...extra } : j
      )
    }))
    try { await updateJournalStatus(entryId, 'POSTED', extra) } catch (_) { }
    return { ok: true }
  }, [state.journalEntries, state.journalItems])

  const reverseJournal = useCallback(async (entryId, reversedBy = 'System', reason = '') => {
    const entry = state.journalEntries.find(j => j.id === entryId)
    if (!entry || entry.status !== 'POSTED') return { ok: false, error: 'Hanya jurnal POSTED yang dapat dibalik.' }
    const origItems = state.journalItems.filter(i => i.journalEntryId === entryId)
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
      accountCode: it.accountCode, description: it.description,
      debit: it.credit, credit: it.debit,
    }))
    setState(s => ({
      ...s,
      journalEntries: [...s.journalEntries.map(j => j.id === entryId ? { ...j, status: 'REVERSED' } : j), revEntry],
      journalItems: [...s.journalItems, ...revItems],
    }))
    try {
      await updateJournalStatus(entryId, 'REVERSED')
      await upsertJournalEntry(revEntry)
      await insertJournalItems(revItems)
    } catch (_) { }
    return { ok: true, reversalId: revId }
  }, [state.journalEntries, state.journalItems, generateEntryNumber])

  // ── Inventory ─────────────────────────────────────────────
  const generateSku = useCallback(() =>
    `SKU-${String(state.pharmacyItems.length + 1).padStart(5, '0')}`,
    [state.pharmacyItems])

  const generateItemCode = useCallback((category = 'OTC') => {
    const prefix = { ETHICAL: 'ETH', OTC: 'OTC', BHP: 'BHP', ALAT_MEDIS: 'ALM', VAKSIN: 'VAK' }[category] || 'ITM'
    const count = state.pharmacyItems.filter(p => p.category === category).length + 1
    return `${prefix}-${String(count).padStart(4, '0')}`
  }, [state.pharmacyItems])

  const addPharmacyItem = useCallback(async (data) => {
    const item = { ...data, id: uuidv4(), createdAt: new Date().toISOString() }
    setState(s => ({ ...s, pharmacyItems: [...s.pharmacyItems, item] }))
    try { await upsertPharmacyItem(item) } catch (_) { }
    return item
  }, [])

  const updatePharmacyItem = useCallback(async (id, data) => {
    setState(s => ({ ...s, pharmacyItems: s.pharmacyItems.map(p => p.id === id ? { ...p, ...data } : p) }))
    try {
      const updated = state.pharmacyItems.find(p => p.id === id)
      if (updated) await upsertPharmacyItem({ ...updated, ...data })
    } catch (_) { }
  }, [state.pharmacyItems])

  const receiveGRN = useCallback(async (grnData, batchesData) => {
    const now = new Date().toISOString()
    const batches = batchesData.map(b => ({ ...b, id: uuidv4(), receivedAt: now, createdAt: now }))
    const ledgerEntries = batches.map(b => ({
      id: uuidv4(), batchId: b.id, itemId: b.itemId,
      transactionType: 'GRN', referenceId: b.id,
      referenceNumber: grnData.grnNumber,
      quantityIn: b.quantityReceived, quantityOut: 0,
      balanceAfter: b.quantityReceived,
      unitCost: b.unitCostPrice,
      totalValue: b.quantityReceived * b.unitCostPrice,
      loggedAt: now,
    }))
    setState(s => ({
      ...s,
      invBatches: [...s.invBatches, ...batches],
      stockLedger: [...s.stockLedger, ...ledgerEntries],
    }))
    try {
      await insertBatches(batches)
      await insertStockLedger(ledgerEntries)
    } catch (err) { console.error('[receiveGRN]', err.message) }
    return batches
  }, [])

  const adjustStock = useCallback(async (batchId, itemId, qty, reason, type) => {
    const batch = state.invBatches.find(b => b.id === batchId)
    if (!batch) return
    const newQty = type === 'REMOVE' ? 0 : Math.max(0, batch.quantityCurrent + qty)
    const ledger = {
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
    setState(s => ({
      ...s,
      invBatches: s.invBatches.map(b => b.id === batchId ? { ...b, quantityCurrent: newQty } : b),
      stockLedger: [...s.stockLedger, ledger],
    }))
    try {
      await updateBatchQty(batchId, newQty)
      await insertStockLedger([ledger])
    } catch (_) { }
  }, [state.invBatches])

  const getItemStock = useCallback((itemId) =>
    state.invBatches.filter(b => b.itemId === itemId && b.quantityCurrent > 0)
      .reduce((s, b) => s + b.quantityCurrent, 0),
    [state.invBatches])

  // ── Billing ───────────────────────────────────────────────
  const generateBillingNumber = useCallback(() => {
    const d = new Date()
    const ym = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
    return `INV/${ym}/${String(state.billings.length + 1).padStart(5, '0')}`
  }, [state.billings])

  const saveBilling = useCallback(async (billing, items) => {
    const id = billing.id || uuidv4()
    const entry = { ...billing, id, createdAt: billing.createdAt || new Date().toISOString() }
    const bItems = items.map(it => ({ ...it, id: it.id || uuidv4(), billingId: id }))
    setState(s => ({
      ...s,
      billings: [...s.billings.filter(b => b.id !== id), entry],
      billingItems: [...s.billingItems.filter(i => i.billingId !== id), ...bItems],
    }))
    try {
      await insertBilling(entry)
      await insertBillingItems(bItems)
    } catch (err) { console.error('[saveBilling]', err.message) }
    return id
  }, [])

  // ── Expense ───────────────────────────────────────────────
  const generateExpenseNumber = useCallback(() => {
    const d = new Date()
    const ym = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`
    return `EXP/${ym}/${String(state.expenses.length + 1).padStart(5, '0')}`
  }, [state.expenses])

  const saveExpense = useCallback(async (data) => {
    const id = data.id || uuidv4()
    const entry = { ...data, id, createdAt: data.createdAt || new Date().toISOString() }
    setState(s => ({ ...s, expenses: [...s.expenses.filter(e => e.id !== id), entry] }))
    try { await upsertExpense(entry) } catch (_) { }
    return id
  }, [])

  const postExpense = useCallback(async (expenseId, postedBy = 'System') => {
    const extra = { status: 'POSTED', authorizedBy: postedBy, postedAt: new Date().toISOString() }
    setState(s => ({ ...s, expenses: s.expenses.map(e => e.id === expenseId ? { ...e, ...extra } : e) }))
    try {
      const exp = state.expenses.find(e => e.id === expenseId)
      if (exp) await upsertExpense({ ...exp, ...extra })
    } catch (_) { }
  }, [state.expenses])

  // ── Audit log ─────────────────────────────────────────────
  const logActivity = useCallback((action, module, detail = '') => {
    const auth = (() => {
      try { return JSON.parse(localStorage.getItem('currentUser') || '{}') } catch { return {} }
    })()
    const log = {
      id: uuidv4(), userId: auth.id || 'system',
      userName: auth.name || 'System', userRole: auth.role || 'system',
      action, module, detail,
      ipAddress: '127.0.0.1', createdAt: new Date().toISOString(),
    }
    insertAuditLog(log).catch(() => { })
  }, [])

  // ── Service Tariffs ───────────────────────────────────────
  const addServiceTariff = useCallback(async (data) => {
    const tariff = { ...data, id: data.id || uuidv4(), isActive: true }
    setState(s => ({ ...s, serviceTariffs: [...s.serviceTariffs, tariff] }))
    try { const saved = await upsertServiceTariff(tariff); if (saved) setState(s => ({ ...s, serviceTariffs: s.serviceTariffs.map(t => t.id === tariff.id ? saved : t) })) } catch (_) { }
    return tariff
  }, [])

  const updateServiceTariff = useCallback(async (id, data) => {
    const updated = { ...state.serviceTariffs.find(t => t.id === id), ...data }
    setState(s => ({ ...s, serviceTariffs: s.serviceTariffs.map(t => t.id === id ? { ...t, ...data } : t) }))
    try { await upsertServiceTariff(updated) } catch (_) { }
  }, [state.serviceTariffs])

  // ── Vendors ───────────────────────────────────────────────
  const addVendor = useCallback(async (data) => {
    const vendor = { ...data, id: data.id || uuidv4(), isActive: true }
    setState(s => ({ ...s, vendors: [...s.vendors, vendor] }))
    try { const saved = await upsertVendor(vendor); if (saved) setState(s => ({ ...s, vendors: s.vendors.map(v => v.id === vendor.id ? saved : v) })) } catch (_) { }
    return vendor
  }, [])

  const updateVendor = useCallback(async (id, data) => {
    const updated = { ...state.vendors.find(v => v.id === id), ...data }
    setState(s => ({ ...s, vendors: s.vendors.map(v => v.id === id ? { ...v, ...data } : v) }))
    try { await upsertVendor(updated) } catch (_) { }
  }, [state.vendors])

  return {
    ...state,
    setActiveBranch, getActiveBranch,
    addBranch, updateBranch,
    addAccount, updateAccount: updateAccountFn, deactivateAccount,
    generateEntryNumber, saveJournalDraft, postJournalEntry, reverseJournal,
    generateSku, generateItemCode,
    addPharmacyItem, updatePharmacyItem, receiveGRN, adjustStock, getItemStock,
    generateBillingNumber, saveBilling,
    generateExpenseNumber, saveExpense, postExpense,
    addServiceTariff, updateServiceTariff,
    addVendor, updateVendor,
    logActivity,
  }
}

function fmtN(n) { return new Intl.NumberFormat('id-ID').format(n) }
