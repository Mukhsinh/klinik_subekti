import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://jrnhkiljfudmzoglkisf.supabase.co'
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpybmhraWxqZnVkbXpvZ2xraXNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyMDQwNTYsImV4cCI6MjA5OTc4MDA1Nn0.xU1Okb53w0cgyRmUkldTbJVLO7tpCUUYYTuzDKGt1mk'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)

function toSnake(str) {
    return str.replace(/([A-Z])/g, '_$1').toLowerCase()
}
function snake(obj) {
    if (!obj || typeof obj !== 'object') return obj
    const out = {}
    for (const [k, v] of Object.entries(obj)) {
        out[toSnake(k)] = v
    }
    return out
}

const data = {
    assetCode: 'TEST-AST-0002',
    assetName: 'Test Medis 2',
    category: 'Peralatan Medis',
    acquisitionCost: 15000000,
    acquisitionDate: '2026-07-01',
    usefulLifeYears: 5,
    location: 'Lab A',
    department: 'Medis',
    condition: 'BAIK',
    description: 'Test Deskripsi',
    coaAssetCode: '1-14-001',
    coaDepreciationCode: '6-21-001',
    coaAccumulatedCode: '1-15-001',
}

const asset = {
    ...data,
    id: 'a3b8d1b6-0b3b-4b1a-9c1a-1a2b3c4d5e6e',
    status: 'ACTIVE',
    accumulatedDepreciation: 0,
    bookValue: data.acquisitionCost,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
}

console.log('Inserting asset payload (snake case):', snake(asset))

const { data: resData, error } = await supabase
    .from('fixed_assets')
    .upsert(snake(asset), { onConflict: 'id' })
    .select()

if (error) {
    console.error('Error inserting fixed_assets:', error)
} else {
    console.log('Success:', resData)
}
process.exit()
