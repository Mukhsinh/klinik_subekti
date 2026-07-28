import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://jrnhkiljfudmzoglkisf.supabase.co'
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpybmhraWxqZnVkbXpvZ2xraXNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyMDQwNTYsImV4cCI6MjA5OTc4MDA1Nn0.xU1Okb53w0cgyRmUkldTbJVLO7tpCUUYYTuzDKGt1mk'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)

const rawCsvContent = fs.readFileSync('public/chart_of_accounts_fixed.csv', 'utf8')
const lines = rawCsvContent.trim().split('\n').slice(1)

const parsedAccounts = lines.map((line, idx) => {
    const parts = line.split(',')
    const account_code = parts[0].trim()
    const account_name = parts[1].trim()
    const account_type = parts[2].trim().toUpperCase()
    const account_group = parts[3].trim()
    const account_subgroup = parts[4] ? parts[4].trim() : null
    const natural_balance = parts[5].trim().toUpperCase()
    const is_header = parts[6].trim() === 'true'
    const parent_code = parts[7] && parts[7].trim() ? parts[7].trim() : null
    const description = parts[8] ? parts[8].trim() : ''
    const is_active = parts[9].trim() === 'true'
    const sort_order = parseInt(parts[10] || (idx + 1) * 10)

    return {
        account_code,
        account_name,
        account_type,
        account_group,
        account_subgroup: account_subgroup || null,
        natural_balance,
        is_header,
        parent_code,
        description,
        is_active,
        sort_order
    }
})

console.log(`Parsed ${parsedAccounts.length} accounts`)

async function seedSupabase() {
    console.log('Upserting chart_of_accounts into Supabase database...')

    // Upsert in chunks of 50
    const chunkSize = 50
    for (let i = 0; i < parsedAccounts.length; i += chunkSize) {
        const chunk = parsedAccounts.slice(i, i + chunkSize)
        const { error: insErr } = await supabase.from('chart_of_accounts').upsert(chunk, { onConflict: 'account_code' })
        if (insErr) {
            console.error(`Error upserting chunk ${i}..${i + chunk.length}:`, insErr)
        } else {
            console.log(`Upserted chunk ${i + 1}..${i + chunk.length}`)
        }
    }

    const { data, error } = await supabase.from('chart_of_accounts').select('account_code', { count: 'exact' })
    if (!error) {
        console.log(`SUCCESS! Total records in Supabase chart_of_accounts table: ${data.length}`)
    } else {
        console.error('Verification query error:', error)
    }
    process.exit(0)
}

seedSupabase()
