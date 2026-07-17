import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://jrnhkiljfudmzoglkisf.supabase.co'
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpybmhraWxqZnVkbXpvZ2xraXNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyMDQwNTYsImV4cCI6MjA5OTc4MDA1Nn0.xU1Okb53w0cgyRmUkldTbJVLO7tpCUUYYTuzDKGt1mk'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: { persistSession: false },
})

// ── Generic error handler ─────────────────────────────────────
export function sbErr(error, context = '') {
  if (error) {
    console.error(`[Supabase${context ? ':' + context : ''}]`, error.message)
    throw new Error(error.message)
  }
}
