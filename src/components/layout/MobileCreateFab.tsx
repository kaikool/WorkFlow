'use client'

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

// Floating Action Button (FAB) cho tạo mới, contextual theo route.
// Theo HIG: chỉ hiển thị mobile (lg:hidden), nằm trên mobile bottom nav,
// kích thước 56pt (h-14), bo tròn full, shadow nổi bật.

type CreateAction =
  | { kind: 'link'; href: string }
  | { kind: 'param'; param?: string };

// Map route → hành động tạo mới tương ứng
const CREATE_ACTIONS: Record<string, CreateAction> = {
  '/dashboard/tasks':    { kind: 'link', href: '/dashboard/tasks/new' },
  '/dashboard/kpi':      { kind: 'param', param: 'create' },
  '/dashboard/schedule': { kind: 'param', param: 'create' },
  '/dashboard/team':     { kind: 'param', param: 'create' },
};

export default function MobileCreateFab() {
  const pathname = usePathname();
  const router = useRouter();

  const action = CREATE_ACTIONS[pathname];
  if (!action) return null;

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
      // Nav mobile có chiều cao = pt-2 (8) + min-h-14 (56) + pb-max(safe, 34) = 64 + max(safe, 34)
      // FAB phải nằm trên nav + khoảng thở 16px ⇒ bottom = 80 + max(safe, 34)
      style={{
        bottom: 'calc(max(env(safe-area-inset-bottom), 34px) + 5rem)',
      }}
      className={cn(
        // Hiển thị duy nhất mobile/tablet; desktop ẩn (sidebar đã có nút tạo)
        "lg:hidden fixed z-[55] right-5",
        // Kích thước HIG compose button (56pt)
        "h-14 w-14 rounded-full",
        // Hình thức
        "bg-primary text-white shadow-xl shadow-primary/30",
        "flex items-center justify-center",
        "transition-all duration-200 ease-out",
        "active:scale-90 hover:shadow-2xl hover:shadow-primary/40",
        // Focus accessible
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
      )}
    >
      <Plus className="h-6 w-6" strokeWidth={2.5} />
    </button>
  );
}
