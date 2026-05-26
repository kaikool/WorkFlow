'use client'

// Shared client-side cache cho dữ liệu dùng chung toàn dashboard:
//   - profiles (active, có nested departments)
//   - departments
//   - out_of_office (map theo user_id)
//
// Stale-while-revalidate:
//   1. Hydrate SYNC từ localStorage → render ngay (nav giữa trang cảm giác instant)
//   2. Background fetch sau mount → cập nhật state + lưu lại cache
//   3. Realtime subscribe → invalidate ngay khi backend thay đổi
//
// KHÔNG dùng SWR/TanStack (architecture rule).

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { Profile, Department } from '@/types/profile';
import { createClient } from '@/utils/supabase/client';
import { getCached, setCached } from '@/lib/local-cache';
import { AppDataContext, AppDataValue, OutOfOfficeRecord } from '@/hooks/use-app-data';

const TTL = {
 profiles: 60 * 60 * 1000, // 1h
 departments: 24 * 60 * 60 * 1000, // 24h — hiếm khi đổi
 ooo: 30 * 60 * 1000, // 30min
} as const;

const PROFILES_SELECT = '*, departments (id, name, code)';

interface Props {
 currentUserId: string;
 children: React.ReactNode;
}

export function AppDataProvider({ currentUserId, children }: Props) {
 const supabase = useMemo(() => createClient(), []);
 const scope = currentUserId;

 // SSR/first client render LUÔN dùng state rỗng để khớp HTML server gửi xuống.
 // Sau khi mount mới đọc localStorage trong useEffect — tránh hydration mismatch.
 const [profiles, setProfiles] = useState<Profile[]>([]);
 const [departments, setDepartments] = useState<Department[]>([]);
 const [outOfOffice, setOutOfOffice] = useState<Record<string, OutOfOfficeRecord>>({});
 const [hydrating, setHydrating] = useState(true);

  const fetchProfiles = useCallback(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILES_SELECT)
      .eq('is_active', true)
      .order('full_name');
    if (error || !data) return;
    let list = data as unknown as Profile[];
    
    // Tìm profile của current user trong danh sách tải về
    const me = list.find((p) => p.id === currentUserId);
    const isMeAdmin = me?.role === 'admin';
    
    // Nếu tôi KHÔNG phải admin, ẩn toàn bộ các tài khoản Quản trị hệ thống (role = admin) khỏi danh sách tương tác
    if (!isMeAdmin) {
      list = list.filter((p) => p.role !== 'admin');
    }
    
    setProfiles(list);
    setCached(scope, 'profiles', list);
  }, [supabase, scope, currentUserId]);

 const fetchDepartments = useCallback(async () => {
 const { data, error } = await supabase
 .from('departments')
 .select('*')
 .order('name');
 if (error || !data) return;
 const list = data as unknown as Department[];
 setDepartments(list);
 setCached(scope, 'departments', list);
 }, [supabase, scope]);

 const fetchOutOfOffice = useCallback(async () => {
 // OOO table có thể chưa tồn tại trên môi trường cũ — silent skip nếu lỗi
 try {
 const { data, error } = await supabase
 .from('out_of_office')
 .select('*')
 .gte('ends_at', new Date().toISOString());
 if (error || !data) return;
 const map: Record<string, OutOfOfficeRecord> = {};
 (data as OutOfOfficeRecord[]).forEach((row) => {
 map[row.user_id] = row;
 });
 setOutOfOffice(map);
 setCached(scope, 'ooo', map);
 } catch {
 // ignore — không phá UX nếu bảng chưa migrate
 }
 }, [supabase, scope]);

 const refresh = useCallback(async () => {
 await Promise.all([fetchProfiles(), fetchDepartments(), fetchOutOfOffice()]);
 }, [fetchProfiles, fetchDepartments, fetchOutOfOffice]);

 // Initial fetch + realtime subscribe
 useEffect(() => {
 let mounted = true;

 // Hydrate từ localStorage SAU mount để không phá hydration SSR
 const cachedProfiles = getCached<Profile[]>(scope, 'profiles', TTL.profiles);
 const cachedDepts = getCached<Department[]>(scope, 'departments', TTL.departments);
 const cachedOoo = getCached<Record<string, OutOfOfficeRecord>>(scope, 'ooo', TTL.ooo);
 if (cachedProfiles) setProfiles(cachedProfiles);
 if (cachedDepts) setDepartments(cachedDepts);
 if (cachedOoo) setOutOfOffice(cachedOoo);

 void Promise.all([fetchProfiles(), fetchDepartments(), fetchOutOfOffice()]).finally(() => {
 if (mounted) setHydrating(false);
 });

 const channel = supabase
 .channel('app_data_sync')
 .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
 void fetchProfiles();
 })
 .on('postgres_changes', { event: '*', schema: 'public', table: 'departments' }, () => {
 void fetchDepartments();
 })
 .on('postgres_changes', { event: '*', schema: 'public', table: 'out_of_office' }, () => {
 void fetchOutOfOffice();
 })
 .subscribe();

 return () => {
 mounted = false;
 void supabase.removeChannel(channel);
 };
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [scope]);

 const value = useMemo<AppDataValue>(
 () => ({
 profiles,
 currentProfile: profiles.find((p) => p.id === currentUserId) ?? null,
 departments,
 outOfOffice,
 hydrating,
 refresh,
 }),
 [profiles, currentUserId, departments, outOfOffice, hydrating, refresh]
 );

 return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

 
