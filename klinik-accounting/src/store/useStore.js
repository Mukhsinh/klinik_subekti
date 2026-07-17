/**
 * useStore.js — Global state backed by Supabase
 * Single pub/sub singleton — all components share one live state.
 * Writes: optimistic UI update first, then async persist to Supabase.
 * Reads:  bootstrap loads everything from Supabase once on first mount.
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
  fetchDoctors,
  insertAuditLog,
  insertDoctorFeeRecord,
} from '../lib/db'
import { initialCOA }      from '../data/initialCOA'
import { initialBranches } from '../data/initialData'

// ── Singleton state ───────────────────────────────────────────
let _state = {
  branches:       [],
  coa:            [],
  journalEntries: [],
  journalItems:   [],
  pharmacyItems:  [],
  invBatches:     [],
  stockLedger:    [],
  billings:       [],
  billingItems:   [],
  expenses:       [],
  doctors:        [],
  activeBranchId: null,
  loading:        true,
  initialized:    false,
  error:          null,
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

async function bootstrap() {
  if (_bootstrapDone) return
  if (_bootstrapProm) return _bootstrapProm

  _bootstrapProm = (async () => {
    try {
      // Parallel fetch all data
      const [
        branches, coa, journals, pharmacyItems,
        batches, billings, expenses, doctors,
      ] = await Promise.all([
        fetchBranches(),
        fetchCOA(),
        fetchJournalEntries(),
        fetchPharmacyItems(),
        fetchBatches(),
        fetchBillings(),
        fetchExpenses(),
        fetchDoctors(),
      ])

      // Use local seed as fallback if DB empty
      const finalBranches = branches.length ? branches : initialBranches
      const finalCOA      = coa.length      ? coa      : initialCOA

      // Fetch relational data
      const entryIds   = journals.map(j => j.id)
      const billingIds = billings.map(b => b.id)

      const [jItems, bItems, stockRows] = await Promise.all([
        entryIds.length   ? fetchJournalItems(entryIds)   : Promise.resolve([]),
        billingIds.length ? fetchBillingItems(billingIds) : Promise.resolve([]),
        fetchStockLedger(),
      ])

      // Active branch persistence
      const savedBranch = localStorage.getItem('activeBranchId')
      const validBranch = finalBranches.find(b => b.id === savedBranch)
      const activeBranchId = validBranch ? savedBranch : (finalBranches[0]?.id || null)

      setState({
        branches:       finalBranches,
        coa:            finalCOA,
        journalEntries: journals,
        journalItems:   jItems,
        pharmacyItems,
        invBatches:     batches,
        stockLedger:    stockRows,
        billings,
        billingItems:   bItems,
        expenses,
        doctors,
        activeBranchId,
        loading:        false,
        initialized:    true,
        error:          null,
      })
      _bootstrapDone = true
    } catch (err) {
      console.error('[Bootstrap] Supabase load failed, using local fallback:', err.message)
      setState({
        branches:       initialBranches,
        coa:            initialCOA,
        loading:        false,
        initialized:    true,
        error:          err.message,
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

  // ── Refresh (re-fetch from Supabase) ──────────────────────
  const refreshAll = useCallback(async () => {
    _bootstrapDone = false; _bootstrapProm = null
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

  // ── Journal ───────────────────────────────────────────────
  const generateEntryNumber = useCallback((type = 'JU') => {
    const d = new Date()
    const ym = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}`
    const existing = s.journalEntries.filter(j => j.entryNumber?.startsWith(`${type}/`)).length + 1
    return `${type}/${ym}/${String(existing).padStart(5,'0')}`
  }, [s.journalEntries])

  const saveJournalDraft = useCallback(async (header, items) => {
    const entryId  = header.id || uuidv4()
    const entry    = { ...header, id: entryId, status: 'DRAFT', createdAt: header.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() }
    const newItems = items.map(it => ({ ...it, id: it.id || uuidv4(), journalEntryId: entryId }))

    // Optimistic update
    setState(prev => ({
      ...prev,
      journalEntries: [...prev.journalEntries.filter(j => j.id !== entryId), entry],
      journalItems:   [...prev.journalItems.filter(i => i.journalEntryId !== entryId), ...newItems],
    }))

    // Persist
    try {
      await deleteJournalItemsByEntry(entryId)
      await upsertJournalEntry(entry)
      await insertJournalItems(newItems)
    } catch (e) { console.error('[saveJournalDraft]', e.message) }
    return entryId
  }, [])

  const postJournalEntry = useCallback(async (entryId, postedBy = 'System') => {
    const entry = s.journalEntries.find(j => j.id === entryId)
    if (!entry) return { ok: false, error: 'Jurnal tidak ditemukan.' }

    const items      = s.journalItems.filter(i => i.journalEntryId === entryId)
    const totalDebit = items.reduce((sum, i) => sum + parseFloat(i.debit  || 0), 0)
    const totalCredit= items.reduce((sum, i) => sum + parseFloat(i.credit || 0), 0)

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
  }, [s.journalEntries, s.journalItems])

  const reverseJournal = useCallback(async (entryId, reversedBy = 'System', reason = '') => {
    const entry = s.journalEntries.find(j => j.id === entryId)
    if (!entry || entry.status !== 'POSTED') return { ok: false, error: 'Hanya jurnal POSTED yang dapat dibalik.' }

    const origItems = s.journalItems.filter(i => i.journalEntryId === entryId)
    const revId     = uuidv4()
    const revEntry  = {
      id: revId, branchId: entry.branchId,
      entryNumber: generateEntryNumber('PEMBALIK'),
      transactionDate: new Date().toISOString().split('T')[0],
      description: `[PEMBALIK] ${entry.description} — ${reason}`,
      entryType: 'REVERSAL', status: 'POSTED',
      reversalOf: entryId,
      totalDebit: entry.totalDebit, totalCredit: entry.totalCredit,
      createdBy: reversedBy, postedBy: reversedBy,
      postedAt:  new Date().toISOString(), createdAt: new Date().toISOString(),
    }
    const revItems = origItems.map(it => ({
      id: uuidv4(), journalEntryId: revId,
      accountCode: it.accountCode, description: it.description || '',
      debit: it.credit, credit: it.debit,
    }))

    setState(prev => ({
      ...prev,
      journalEntries: [...prev.journalEntries.map(j => j.id === entryId ? { ...j, status: 'REVERSED' } : j), revEntry],
      journalItems:   [...prev.journalItems, ...revItems],
    }))
    try {
      await updateJournalStatus(entryId, 'REVERSED')
      await upsertJournalEntry(revEntry)
      await insertJournalItems(revItems)
    } catch (e) { console.error('[reverseJournal]', e.message) }
    return { ok: true, reversalId: revId }
  }, [s.journalEntries, s.journalItems, generateEntryNumber])

  // ── Inventory ─────────────────────────────────────────────
  const generateSku = useCallback(() =>
    `SKU-${String(s.pharmacyItems.length + 1).padStart(5,'0')}`,
  [s.pharmacyItems])

  const generateItemCode = useCallback((category = 'OTC') => {
    const prefix = { ETHICAL:'ETH', OTC:'OTC', BHP:'BHP', ALAT_MEDIS:'ALM', VAKSIN:'VAK' }[category] || 'ITM'
    const count  = s.pharmacyItems.filter(p => p.category === category).length + 1
    return `${prefix}-${String(count).padStart(4,'0')}`
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
    const now     = new Date().toISOString()
    const batches = batchesData.map(b => ({ ...b, id: b.id || uuidv4(), receivedAt: now, createdAt: now }))
    const ledger  = batches.map(b => ({
      id: uuidv4(), batchId: b.id, itemId: b.itemId,
      transactionType: 'GRN', referenceId: b.id,
      referenceNumber: grnData.grnNumber,
      quantityIn: b.quantityReceived, quantityOut: 0, balanceAfter: b.quantityReceived,
      unitCost: b.unitCostPrice, totalValue: b.quantityReceived * b.unitCostPrice,
      loggedAt: now,
    }))

    setState(prev => ({
      ...prev,
      invBatches:  [...prev.invBatches, ...batches],
      stockLedger: [...prev.stockLedger, ...ledger],
    }))
    try {
      await insertBatches(batches)
      await insertStockLedger(ledger)
    } catch (e) { console.error('[receiveGRN]', e.message) }
    return batches
  }, [])

  const adjustStock = useCallback(async (batchId, itemId, qty, reason, type) => {
    const batch = s.invBatches.find(b => b.id === batchId)
    if (!batch) return
    const newQty = type === 'REMOVE' ? 0 : Math.max(0, batch.quantityCurrent + qty)
    const entry  = {
      id: uuidv4(), batchId, itemId,
      transactionType: type === 'REMOVE' ? 'EXPIRED' : 'ADJUSTMENT',
      referenceId: batchId, referenceNumber: `ADJ-${Date.now()}`,
      quantityIn:  type === 'ADD'    ? Math.abs(qty) : 0,
      quantityOut: type === 'REMOVE' ? batch.quantityCurrent : (qty < 0 ? Math.abs(qty) : 0),
      balanceAfter: newQty,
      unitCost:   batch.unitCostPrice,
      totalValue: (type === 'REMOVE' ? batch.quantityCurrent : Math.abs(qty)) * batch.unitCostPrice,
      notes: reason, loggedAt: new Date().toISOString(),
    }
    setState(prev => ({
      ...prev,
      invBatches:  prev.invBatches.map(b => b.id === batchId ? { ...b, quantityCurrent: newQty } : b),
      stockLedger: [...prev.stockLedger, entry],
    }))
    try { await updateBatchQty(batchId, newQty); await insertStockLedger([entry]) } catch (e) { console.error('[adjustStock]', e.message) }
  }, [s.invBatches])

  const getItemStock = useCallback((itemId) =>
    s.invBatches.filter(b => b.itemId === itemId && b.quantityCurrent > 0)
      .reduce((sum, b) => sum + b.quantityCurrent, 0),
  [s.invBatches])

  // ── Billing ───────────────────────────────────────────────
  const generateBillingNumber = useCallback(() => {
    const d  = new Date()
    const ym = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`
    return `INV/${ym}/${String(s.billings.length + 1).padStart(5,'0')}`
  }, [s.billings])

  const saveBilling = useCallback(async (billing, items) => {
    const id    = billing.id || uuidv4()
    const entry = { ...billing, id, createdAt: billing.createdAt || new Date().toISOString() }
    const bItems= items.map(it => ({ ...it, id: it.id || uuidv4(), billingId: id }))

    setState(prev => ({
      ...prev,
      billings:     [...prev.billings.filter(b => b.id !== id), entry],
      billingItems: [...prev.billingItems.filter(i => i.billingId !== id), ...bItems],
    }))
    try {
      await insertBilling(entry)
      await insertBillingItems(bItems)
    } catch (e) { console.error('[saveBilling]', e.message) }
    return id
  }, [])

  // ── Expense ───────────────────────────────────────────────
  const generateExpenseNumber = useCallback(() => {
    const d  = new Date()
    const ym = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}`
    return `EXP/${ym}/${String(s.expenses.length + 1).padStart(5,'0')}`
  }, [s.expenses])

  const saveExpense = useCallback(async (data) => {
    const id    = data.id || uuidv4()
    const entry = { ...data, id, createdAt: data.createdAt || new Date().toISOString() }
    setState(prev => ({ ...prev, expenses: [...prev.expenses.filter(e => e.id !== id), entry] }))
    try { await upsertExpense(entry) } catch (e) { console.error('[saveExpense]', e.message) }
    return id
  }, [])

  const postExpense = useCallback(async (expenseId, postedBy = 'System') => {
    const extra = { status: 'POSTED', authorizedBy: postedBy, postedAt: new Date().toISOString() }
    setState(prev => ({ ...prev, expenses: prev.expenses.map(e => e.id === expenseId ? { ...e, ...extra } : e) }))
    try {
      const cur = s.expenses.find(e => e.id === expenseId)
      if (cur) await upsertExpense({ ...cur, ...extra })
    } catch (e) { console.error('[postExpense]', e.message) }
  }, [s.expenses])

  // ── Doctor fee + PPh21 recording ─────────────────────────
  const saveDoctorFeeRecord = useCallback(async (rec) => {
    try { return await insertDoctorFeeRecord(rec) } catch (e) { console.error('[saveDoctorFeeRecord]', e.message) }
  }, [])

  // ── Audit log ─────────────────────────────────────────────
  const logActivity = useCallback((action, module, detail = '') => {
    const auth = (() => { try { return JSON.parse(localStorage.getItem('currentUser') || '{}') } catch { return {} } })()
    const log  = {
      id: uuidv4(), userId: auth.id || 'system',
      userName: auth.name || 'System', userRole: auth.role || 'system',
      action, module, detail, ipAddress: '127.0.0.1',
      createdAt: new Date().toISOString(),
    }
    insertAuditLog(log).catch(() => {})
  }, [])

  return {
    ...s,
    refreshAll,
    setActiveBranch, getActiveBranch,
    addBranch, updateBranch,
    addAccount, updateAccount: updateAccountFn, deactivateAccount,
    generateEntryNumber, saveJournalDraft, postJournalEntry, reverseJournal,
    generateSku, generateItemCode,
    addPharmacyItem, updatePharmacyItem, receiveGRN, adjustStock, getItemStock,
    generateBillingNumber, saveBilling,
    generateExpenseNumber, saveExpense, postExpense,
    saveDoctorFeeRecord,
    logActivity,
  }
}
