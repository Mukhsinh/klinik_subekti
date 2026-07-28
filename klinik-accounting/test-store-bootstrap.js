import {
    fetchBranches, fetchCOA, fetchJournalEntries, fetchPharmacyItems,
    fetchBatches, fetchBillings, fetchExpenses, fetchDoctors,
    fetchFixedAssets, fetchAssetMutations, fetchAssetDepreciations,
    fetchVendors, fetchServiceTariffs, fetchStockOutflows,
    fetchDoctorFeeRecords, fetchAuditLogs, fetchUsers,
    fetchAppSettings, fetchOpeningBalances
} from './src/lib/db.js'

async function run() {
    console.log('Testing all db.js functions used in store bootstrap...')
    const tests = [
        ['fetchBranches', fetchBranches()],
        ['fetchCOA', fetchCOA()],
        ['fetchJournalEntries', fetchJournalEntries()],
        ['fetchPharmacyItems', fetchPharmacyItems()],
        ['fetchBatches', fetchBatches()],
        ['fetchBillings', fetchBillings()],
        ['fetchExpenses', fetchExpenses()],
        ['fetchDoctors', fetchDoctors()],
        ['fetchFixedAssets', fetchFixedAssets({ status: 'ACTIVE' })],
        ['fetchAssetMutations', fetchAssetMutations()],
        ['fetchAssetDepreciations', fetchAssetDepreciations({})],
        ['fetchVendors', fetchVendors()],
        ['fetchServiceTariffs', fetchServiceTariffs()],
        ['fetchStockOutflows', fetchStockOutflows()],
        ['fetchDoctorFeeRecords', fetchDoctorFeeRecords(null, null, 500)],
        ['fetchAuditLogs', fetchAuditLogs(500)],
        ['fetchUsers', fetchUsers()],
        ['fetchAppSettings', fetchAppSettings()],
        ['fetchOpeningBalances', fetchOpeningBalances()],
    ]

    for (const [name, promise] of tests) {
        try {
            const res = await promise
            console.log(`✅ ${name}:`, Array.isArray(res) ? `${res.length} rows` : typeof res)
        } catch (e) {
            console.error(`❌ ${name} FAILED:`, e.message)
        }
    }
}

run().catch(console.error)
