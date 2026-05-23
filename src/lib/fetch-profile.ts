// Fetch profile của user đang đăng nhập + đảm bảo `departments` là object có code.
// Workaround Supabase đôi khi trả `departments` dạng array — gây fail isHubDepartment.

import type { SupabaseClient } from '@supabase/supabase-js';

export async function fetchCurrentProfile(supabase: SupabaseClient): Promise<any | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: p } = await supabase
    .from('profiles')
    .select('*, departments(id, name, code)')
    .eq('id', user.id)
    .single();
  if (!p) return null;

  const anyP = p as any;

  // Flatten array → object
  if (Array.isArray(anyP.departments)) {
    anyP.departments = anyP.departments[0] ?? null;
  }

  // Fallback: nếu join không load được code (RLS hoặc cache), query riêng
  if (p.department_id && !anyP.departments?.code) {
    const { data: dept } = await supabase
      .from('departments')
      .select('id, name, code')
      .eq('id', p.department_id)
      .single();
    if (dept) anyP.departments = dept;
  }

  return p;
}
