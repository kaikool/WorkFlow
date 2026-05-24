'use client'

import { useContext, useMemo } from 'react';
import { AppDataContext } from '@/components/providers/AppDataProvider';
import type { Profile } from '@/types/profile';

export function useAppData() {
 const ctx = useContext(AppDataContext);
 if (!ctx) {
 throw new Error('useAppData phải nằm bên trong <AppDataProvider /> (dashboard layout).');
 }
 return ctx;
}

// Tiện ích: tìm profile theo id (memo theo profiles array để tránh map lại mỗi render)
export function useProfileLookup() {
 const { profiles } = useAppData();
 return useMemo(() => {
 const map = new Map<string, Profile>();
 profiles.forEach((p) => map.set(p.id, p));
 return map;
 }, [profiles]);
}
