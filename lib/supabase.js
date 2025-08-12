// lib/supabase.js - 새로 만들 파일
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },  // 인증 불필요
    realtime: { enable: false }  // 실시간 기능 비활성화
})

// ===================================