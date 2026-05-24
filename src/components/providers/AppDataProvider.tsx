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

import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import type { Profile, Department } from '@/types/profile';
import { createClient } from '@/utils/supabase/client';
import { getCached, setCached } from '@/lib/local-cache';

export interface OutOfOfficeRecord {
 id: string;
 user_id: string;
 message: string;
 ends_at: string;
 created_at: string;
}

interface AppDataValue {
 profiles: Profile[];
 // Profile của user đang đăng nhập — derive từ profiles theo currentUserId
 currentProfile: Profile | null;
 departments: Department[];
 // Map theo user_id để O(1) lookup
 outOfOffice: Record<string, OutOfOfficeRecord>;
 // Hydrating = lần đầu chưa có cache + chưa fetch xong (rất ngắn, < 1s)
 hydrating: boolean;
 // Force refetch — gọi sau khi sửa hồ sơ, tạo phòng ban,…
 refresh: () => Promise<void>;
}

const AppDataContext = createContext<AppDataValue | null>(null);

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

 // Hydrate ngay từ localStorage — render trước cả khi network response về
 const [profiles, setProfiles] = useState<Profile[]>(
 () => getCached<Profile[]>(scope, 'profiles', TTL.profiles) ?? []
 );
 const [departments, setDepartments] = useState<Department[]>(
 () => getCached<Department[]>(scope, 'departments', TTL.departments) ?? []
 );
 const [outOfOffice, setOutOfOffice] = useState<Record<string, OutOfOfficeRecord>>(
 () => getCached<Record<string, OutOfOfficeRecord>>(scope, 'ooo', TTL.ooo) ?? {}
 );
 const [hydrating, setHydrating] = useState(profiles.length === 0);

 const fetchProfiles = useCallback(async () => {
 const { data, error } = await supabase
 .from('profiles')
 .select(PROFILES_SELECT)
 .eq('is_active', true)
 .order('full_name');
 if (error || !data) return;
 const list = data as unknown as Profile[];
 setProfiles(list);
 setCached(scope, 'profiles', list);
 }, [supabase, scope]);

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

export { AppDataContext };
