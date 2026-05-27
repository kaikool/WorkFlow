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
import { canCoordinateSharedResources, canUseDriverWorkspace } from '@/lib/permissions';

const TTL = {
  profiles: 60 * 60 * 1000, // 1h
  departments: 24 * 60 * 60 * 1000, // 24h — hiếm khi đổi
  ooo: 30 * 60 * 1000, // 30min
  vehicles: 24 * 60 * 60 * 1000, // 24h — admin/secretary mới sửa
  rooms: 24 * 60 * 60 * 1000, // 24h
} as const;

const PROFILES_SELECT = '*, departments (id, name, code)';
const VEHICLES_SELECT = '*, default_driver:profiles!vehicles_driver_id_fkey(id, full_name, phone)';

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
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [hydrating, setHydrating] = useState(true);

  // 1. Tải danh sách phòng ban
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

  // 2. Tải danh sách vắng mặt tạm thời (Out of office)
  const fetchOutOfOffice = useCallback(async () => {
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

  // 3. Tải danh sách xe ô tô điều động (chỉ cho phép khi có quyền)
  const fetchVehicles = useCallback(async () => {
    const { data, error } = await supabase
      .from('vehicles')
      .select(VEHICLES_SELECT)
      .order('name');
    if (error || !data) return;
    setVehicles(data as any[]);
    setCached(scope, 'vehicles', data);
  }, [supabase, scope]);

  // 4. Tải danh sách phòng họp (chỉ cho phép khi có quyền)
  const fetchRooms = useCallback(async () => {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .order('name');
    if (error || !data) return;
    setRooms(data as any[]);
    setCached(scope, 'rooms', data);
  }, [supabase, scope]);

  // 5. Tải danh sách profiles (có gate gọi thêm xe/phòng khi profiles đổi hoặc cache thay đổi)
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

    // Dynamic gate check: nếu user được cấp quyền xe/phòng họp -> tự động tải các tài nguyên này
    const canSee = me ? (canCoordinateSharedResources(me) || canUseDriverWorkspace(me)) : false;
    if (canSee) {
      void fetchVehicles();
      void fetchRooms();
    }
  }, [supabase, scope, currentUserId, fetchVehicles, fetchRooms]);

  // Reactive state check for resource authorization
  const myProfile = useMemo(() => {
    return profiles.find((p) => p.id === currentUserId) ?? null;
  }, [profiles, currentUserId]);

  const hasResourceAccess = useMemo(() => {
    return canCoordinateSharedResources(myProfile) || canUseDriverWorkspace(myProfile);
  }, [myProfile]);

  const refresh = useCallback(async () => {
    const promises: Promise<any>[] = [
      fetchProfiles(),
      fetchDepartments(),
      fetchOutOfOffice(),
    ];

    if (hasResourceAccess) {
      promises.push(fetchVehicles());
      promises.push(fetchRooms());
    }

    await Promise.all(promises);
  }, [fetchProfiles, fetchDepartments, fetchOutOfOffice, fetchVehicles, fetchRooms, hasResourceAccess]);

  // 1. Initial fetch + realtime subscribe cho các bảng chung (profiles, departments, ooo)
  useEffect(() => {
    let mounted = true;

    // Hydrate từ localStorage SAU mount để không phá hydration SSR
    const cachedProfiles = getCached<Profile[]>(scope, 'profiles', TTL.profiles);
    const cachedDepts = getCached<Department[]>(scope, 'departments', TTL.departments);
    const cachedOoo = getCached<Record<string, OutOfOfficeRecord>>(scope, 'ooo', TTL.ooo);
    
    if (cachedProfiles) setProfiles(cachedProfiles);
    if (cachedDepts) setDepartments(cachedDepts);
    if (cachedOoo) setOutOfOffice(cachedOoo);

    const cachedMe = cachedProfiles?.find((p) => p.id === currentUserId);
    const cachedCanSee = cachedMe ? (canCoordinateSharedResources(cachedMe) || canUseDriverWorkspace(cachedMe)) : false;

    const promises: Promise<any>[] = [
      fetchProfiles(),
      fetchDepartments(),
      fetchOutOfOffice(),
    ];

    if (cachedCanSee) {
      const cachedVehicles = getCached<any[]>(scope, 'vehicles', TTL.vehicles);
      const cachedRooms = getCached<any[]>(scope, 'rooms', TTL.rooms);
      if (cachedVehicles) setVehicles(cachedVehicles);
      if (cachedRooms) setRooms(cachedRooms);

      promises.push(fetchVehicles());
      promises.push(fetchRooms());
    }

    void Promise.all(promises).finally(() => {
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
  }, [scope, supabase, currentUserId, fetchProfiles, fetchDepartments, fetchOutOfOffice, fetchVehicles, fetchRooms]);

  // 2. Kênh đồng bộ Real-time cho Vehicles và Rooms (chỉ subscribe khi có quyền)
  useEffect(() => {
    if (!hasResourceAccess) {
      setVehicles([]);
      setRooms([]);
      return;
    }

    const channel = supabase
      .channel('app_resource_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles' }, () => {
        void fetchVehicles();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => {
        void fetchRooms();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, hasResourceAccess, fetchVehicles, fetchRooms]);

  const value = useMemo<AppDataValue>(
    () => ({
      profiles,
      currentProfile: myProfile,
      departments,
      outOfOffice,
      vehicles,
      rooms,
      hydrating,
      refresh,
    }),
    [profiles, myProfile, departments, outOfOffice, vehicles, rooms, hydrating, refresh]
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}
