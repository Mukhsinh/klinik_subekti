/**
 * inventoryEngine.js — Dual Inventory Logic Engine
 * 1. FEFO (First Expiry First Out) -> Physical Stock Depletion
 * 2. FIFO (First In First Out) -> Accounting Cost Valuation & Financial Journaling
 */

/**
 * Calculates FIFO unit cost and total valuation for an outflow transaction.
 * FIFO orders batches by received_at / created_at ASC (earliest received stock first).
 * 
 * @param {Array} batches - Active inventory batches for the item
 * @param {number} qtyNeeded - Quantity requested for outflow
 * @param {number} fallbackCost - Fallback unit cost if active batches are empty/insufficient
 * @returns {Object} { totalValuation, avgUnitCost, fifoBreakdown }
 */
export function calculateFifoValuation(batches, qtyNeeded, fallbackCost = 0) {
    const reqQty = Number(qtyNeeded) || 0
    if (reqQty <= 0) {
        return { totalValuation: 0, avgUnitCost: 0, fifoBreakdown: [] }
    }

    // FIFO: Sort batches by received_at / created_at ASC (earliest received first)
    const fifoBatches = [...(batches || [])]
        .filter(b => Number(b.quantityCurrent ?? b.quantity_current ?? 0) > 0)
        .sort((a, b) => {
            const dateA = new Date(a.receivedAt || a.received_at || a.createdAt || a.created_at || 0)
            const dateB = new Date(b.receivedAt || b.received_at || b.createdAt || b.created_at || 0)
            return dateA - dateB
        })

    let remaining = reqQty
    let totalValuation = 0
    const fifoBreakdown = []

    for (const batch of fifoBatches) {
        if (remaining <= 0) break
        const currentQty = Number(batch.quantityCurrent ?? batch.quantity_current ?? 0)
        const cost = Number(batch.unitCostPrice ?? batch.unit_cost_price ?? 0)
        const take = Math.min(currentQty, remaining)

        remaining -= take
        const val = take * cost
        totalValuation += val

        fifoBreakdown.push({
            batchId: batch.id,
            batchNumber: batch.batchNumber || batch.batch_number,
            qty: take,
            unitCost: cost,
            totalCost: val,
            receivedAt: batch.receivedAt || batch.received_at || batch.createdAt,
        })
    }

    // Fallback for remaining quantity if active batches run short
    if (remaining > 0) {
        const defaultCost = Number(fallbackCost || 0)
        const val = remaining * defaultCost
        totalValuation += val
        fifoBreakdown.push({
            batchId: null,
            batchNumber: 'DIRECT-FIFO-FALLBACK',
            qty: remaining,
            unitCost: defaultCost,
            totalCost: val,
            receivedAt: new Date().toISOString(),
        })
    }

    const avgUnitCost = reqQty > 0 ? totalValuation / reqQty : 0

    return { totalValuation, avgUnitCost, fifoBreakdown }
}

/**
 * Depletes physical stock using FEFO (First Expiry First Out).
 * FEFO orders batches by expiry_date ASC (earliest expiry date first).
 * 
 * @param {Array} batches - Active inventory batches for the item
 * @param {number} qtyNeeded - Quantity requested for outflow
 * @returns {Array} List of physical batch updates [{ batchId, currentQty, takenQty, newQtyCurrent, expiryDate }]
 */
export function depleteFefoPhysicalStock(batches, qtyNeeded) {
    const reqQty = Number(qtyNeeded) || 0
    if (reqQty <= 0) return []

    // FEFO: Sort batches by expiry_date ASC (earliest expiry first)
    const fefoBatches = [...(batches || [])]
        .filter(b => Number(b.quantityCurrent ?? b.quantity_current ?? 0) > 0)
        .sort((a, b) => {
            const expA = new Date(a.expiryDate || a.expiry_date || '2099-12-31')
            const expB = new Date(b.expiryDate || b.expiry_date || '2099-12-31')
            return expA - expB
        })

    let remaining = reqQty
    const physicalUpdates = []

    for (const batch of fefoBatches) {
        if (remaining <= 0) break
        const currentQty = Number(batch.quantityCurrent ?? batch.quantity_current ?? 0)
        const take = Math.min(currentQty, remaining)

        remaining -= take
        const newQtyCurrent = currentQty - take

        physicalUpdates.push({
            batchId: batch.id,
            batchNumber: batch.batchNumber || batch.batch_number,
            currentQty,
            takenQty: take,
            newQtyCurrent,
            expiryDate: batch.expiryDate || batch.expiry_date,
            unitCostPrice: Number(batch.unitCostPrice ?? batch.unit_cost_price ?? 0)
        })
    }

    return physicalUpdates
}
