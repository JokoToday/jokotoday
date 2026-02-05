import { createClient } from '@supabase/supabase-js'
import { buildUrl } from './url'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// DEBUG: Log Supabase connection on startup
console.log('🔗 Supabase Client Initialized')
console.log('   VITE_SUPABASE_URL:', supabaseUrl)

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,

    // 🔴 IMPORTANT: Disable auto URL session parsing
    detectSessionInUrl: false,

    flowType: 'pkce',
    redirectTo: buildUrl('/auth/callback'),
  },
})
