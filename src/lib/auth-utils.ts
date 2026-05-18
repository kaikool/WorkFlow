import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

export async function getProfile() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select(`
      *,
      departments (name)
    `)
    .eq('id', user.id)
    .single()

  return profile
}
