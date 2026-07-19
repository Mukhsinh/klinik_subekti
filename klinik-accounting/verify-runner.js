import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// Read .env file
const envPath = path.resolve(process.cwd(), '.env')
const envContent = fs.readFileSync(envPath, 'utf8')
const envVars = {}
envContent.split('\n').forEach(line => {
    const parts = line.split('=')
    if (parts.length >= 2) {
        const key = parts[0].trim()
        const value = parts.slice(1).join('=').trim()
        envVars[key] = value
    }
})

const url = envVars.VITE_SUPABASE_URL
const key = envVars.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
    console.error('Missing URL or Key in .env')
    process.exit(1)
}

const supabase = createClient(url, key)

const VALID_BRANCH_ID = '11111111-0001-0001-0001-000000000001'

console.log('Verifying DB constraints and operations...')

async function runTests() {
    try {
        // Test 1: Verify journal_entries constraints for ACQUISITION and DISPOSAL
        console.log('\n--- Test 1: Testing journal_entries.entry_type check constraint ---')
        const testEntryId = '99999999-9999-9999-9999-999999999999'

        // Cleanup first if exists
        await supabase.from('journal_entries').delete().eq('id', testEntryId)

        // Insert ACQUISITION entry
        console.log('Inserting journal entry with entryType ACQUISITION...')
        const { data: entryData, error: entryErr } = await supabase
            .from('journal_entries')
            .insert({
                id: testEntryId,
                branch_id: VALID_BRANCH_ID,
                entry_number: 'TEST/ACQ/00001',
                transaction_date: '2026-07-19',
                description: 'Test Acquisition Entry',
                entry_type: 'ACQUISITION',
                status: 'POSTED',
                total_debit: 1000000,
                total_credit: 1000000,
                created_by: 'System'
            })
            .select()

        if (entryErr) {
            console.error('Failed to insert ACQUISITION entry type:', entryErr.message)
            throw entryErr;
        } else {
            console.log('Success! ACQUISITION entry type allowed. Result:', entryData)
        }

        // Update to DISPOSAL to verify both work
        console.log('Updating journal entry to DISPOSAL...')
        const { data: updateData, error: updateErr } = await supabase
            .from('journal_entries')
            .update({
                entry_type: 'DISPOSAL'
            })
            .eq('id', testEntryId)
            .select()

        if (updateErr) {
            console.error('Failed to update to DISPOSAL entry type:', updateErr.message)
            throw updateErr;
        } else {
            console.log('Success! DISPOSAL entry type allowed. Result:', updateData)
        }

        // Cleanup journal entry
        await supabase.from('journal_entries').delete().eq('id', testEntryId)
        console.log('Journal Entry cleanup complete.')

        // Test 2: Verify pharmacy_items upsert with fallback sku_code
        console.log('\n--- Test 2: Testing pharmacy_items insertion ---')
        const testItemId = '00000000-0000-0000-0000-000000009999'
        await supabase.from('pharmacy_items').delete().eq('id', testItemId)

        // Simulating db.js upsertPharmacyItem logic with fallback
        const mockItem = {
            id: testItemId,
            itemCode: 'PAT-VERIFY-99',
            skuCode: '', // blank to trigger fallback
            itemName: 'Amoxicillin Verification Test',
            category: 'OBAT_PATEN',
            baseUnit: 'Tablet',
            sellingPrice: 5000,
            minSafetyStock: 50,
            reorderPoint: 100,
            coaInventoryCode: '1-13-001',
            coaCOGSCode: '5-11-001',
        }

        // Helper functions mapping to db.js
        function toSnake(str) { return str.replace(/([A-Z])/g, '_$1').toLowerCase() }
        function snake(obj) {
            if (!obj || typeof obj !== 'object') return obj
            const out = {}
            for (const [k, v] of Object.entries(obj)) {
                out[toSnake(k)] = v
            }
            return out
        }

        const row = snake(mockItem)
        row.selling_price = Number(row.selling_price || 0)
        row.min_safety_stock = parseInt(row.min_safety_stock || 50)
        row.reorder_point = parseInt(row.reorder_point || 100)

        // Apply client-side fallback fixed in db.js
        if (!row.sku_code || row.sku_code.trim() === '') {
            row.sku_code = row.item_code || `SKU-${Date.now()}`
        }

        console.log('Inserting pharmacy item payload (snake):', row)
        const { data: itemData, error: itemErr } = await supabase
            .from('pharmacy_items')
            .upsert(row, { onConflict: 'id' })
            .select()

        if (itemErr) {
            console.error('Failed to upsert pharmacy item:', itemErr.message)
            throw itemErr
        } else {
            console.log('Success! Pharmacy item upserted. Result:', itemData)
        }

        // Test 3: Insert Patient Billing using upsert
        console.log('\n--- Test 3: Testing patient_billings upsert ---')
        const testBillingId = 'b0000000-0000-0000-0000-000000000001'
        const testBillingJournalEntryId = '99999999-9999-9999-9999-999999999999'

        await supabase.from('patient_billings').delete().eq('id', testBillingId)
        await supabase.from('journal_entries').delete().eq('id', testBillingJournalEntryId)

        // Save journal entry FIRST
        console.log('Inserting journal entry for billing FIRST...')
        const { data: billJData, error: billJErr } = await supabase
            .from('journal_entries')
            .insert({
                id: testBillingJournalEntryId,
                branch_id: VALID_BRANCH_ID,
                entry_number: 'TEST/BILLING/00001',
                transaction_date: '2026-07-19',
                description: 'Journal for Billing Verification',
                entry_type: 'BILLING',
                status: 'POSTED',
                total_debit: 100000,
                total_credit: 100000,
                created_by: 'System'
            })
            .select()

        if (billJErr) {
            console.error('Failed to create journal entry for billing:', billJErr.message)
            throw billJErr
        }
        console.log('Journal entry created successfully.')

        // Now insert billing (FK should be satisfied because journal exists)
        console.log('Inserting billing with journal_entry_id referencing the journal entry...')
        const billingRow = {
            id: testBillingId,
            branch_id: VALID_BRANCH_ID,
            billing_number: 'INV/TEST/00001',
            visit_date: '2026-07-19',
            patient_name: 'Patient Verification',
            payment_method: 'TUNAI',
            registration_fee: 50000,
            subtotal_services: 0,
            subtotal_pharmacy: 50000,
            discount_amount: 0,
            ppn_amount: 0,
            grand_total: 100000,
            patient_portion: 100000,
            insurance_portion: 0,
            status: 'PAID',
            journal_entry_id: testBillingJournalEntryId
        }

        // Call upsert patient_billings
        const { data: billRes, error: billErr } = await supabase
            .from('patient_billings')
            .upsert(billingRow, { onConflict: 'id' })
            .select()

        if (billErr) {
            console.error('Failed to upsert billing:', billErr.message)
            throw billErr
        } else {
            console.log('Success! Billing upserted successfully. Result:', billRes)
        }

        // Clean up billing and billing journal
        await supabase.from('patient_billings').delete().eq('id', testBillingId)
        await supabase.from('journal_entries').delete().eq('id', testBillingJournalEntryId)
        console.log('Billing test cleanup complete.')

        console.log('\n=========================================')
        console.log('ALL DB VERIFICATION TESTS PASSED SUCCESSFULLY!')
        console.log('=========================================')

    } catch (err) {
        console.error('\nVerification tests failed with error:', err.message)
        process.exit(1)
    }
}

runTests()
