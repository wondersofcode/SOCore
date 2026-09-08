import { createClient } from '@supabase/supabase-js'

// 🔴 TODO-DOLDUR: .env faylında (design_zip/.env) bunları yaz:
//   VITE_SUPABASE_URL=https://xvwuqzqhmnnvitzyedos.supabase.co
//   VITE_SUPABASE_ANON_KEY=<Publishable key, Supabase → Settings → API Keys>
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase env vars missing — auth will not work until VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.')
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '')
