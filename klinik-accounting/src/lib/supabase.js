import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://hatrvqeihrjczsqxmfqf.supabase.co'
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhhdHJ2cWVpaHJqY3pzcXhtZnFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxODI3NzAsImV4cCI6MjEwMDc1ODc3MH0.dJ74w-lqjecyF_JsrDAF3fxsoNk0itIE3mBSTEamn1g'

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
