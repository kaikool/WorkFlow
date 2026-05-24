'use client'

import React, { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { fetchCurrentProfile } from "@/lib/fetch-profile";

// Floating Action Button (FAB) cho tạo mới, contextual theo route.
// Theo HIG: chỉ hiển thị mobile (lg:hidden), nằm trên mobile bottom nav,
// kích thước 56pt (h-14), bo tròn full, shadow nổi bật.
// Tự ẩn khi có Dialog/Popover/Sheet mở (rule :has trong globals.css).
// Không hiển thị cho role 'admin' — admin = quản trị hệ thống, không tạo
// resource cấp chi nhánh.

type CreateAction =
  | { kind: 'link'; href: string }
  | { kind: 'param'; param?: string };

// Map route → hành động tạo mới tương ứng
const CREATE_ACTIONS: Record<string, CreateAction> = {
  '/dashboard/tasks':    { kind: 'param', param: 'create' },
  '/dashboard/schedule': { kind: 'param', param: 'create' },
  '/dashboard/team':     { kind: 'param', param: 'create' },
  '/dashboard/handover': { kind: 'param', param: 'create' },
};

export default function MobileCreateFab() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [role, setRole] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const p = await fetchCurrentProfile(supabase);
      if (!alive) return;
      setRole(p?.role ?? null);
      setReady(true);
    })();
    return () => { alive = false; };
  }, [supabase]);

  const action = CREATE_ACTIONS[pathname];
  if (!action) return null;
  // Chờ load profile xong rồi mới quyết định — tránh flash FAB cho admin.
  if (!ready) return null;
  // Admin = quản trị hệ thống, không tham gia tạo resource chi nhánh.
  if (role === 'admin') return null;

  const handleClick = () => {
    if (action.kind === 'link') {
      router.push(action.href);
    } else {
      const params = new URLSearchParams(window.location.search);
      params.set(action.param || 'create', '1');
      router.replace(`${pathname}?${params.toString()}`);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Tạo mới"
      data-fab
      className="fab-shell lg:hidden"
    >
      <Plus className="h-6 w-6" strokeWidth={2.5} />
    </button>
  );
}
