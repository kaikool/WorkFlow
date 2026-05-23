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
  '/dashboard/schedule': { kind: 'param', param: 'create' },
  '/dashboard/team':     { kind: 'param', param: 'create' },
  '/dashboard/handover': { kind: 'param', param: 'create' },
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
      className={cn(
        // Hiển thị duy nhất mobile/tablet; desktop ẩn (sidebar đã có nút tạo)
        "lg:hidden fixed z-[55] right-4 bottom-safe-fab",
        // Kích thước HIG compose button (56pt)
        "h-14 w-14 rounded-full",
        // Liquid glass primary
        "bg-primary text-white",
        "shadow-[0_8px_24px_-4px_rgba(37,99,235,0.45),0_2px_8px_-2px_rgba(15,23,42,0.12)]",
        "border border-primary/20",
        "flex items-center justify-center",
        "transition-all duration-200 ease-out",
        "active:scale-90 hover:shadow-[0_12px_32px_-4px_rgba(37,99,235,0.55)]",
        // Focus accessible
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
      )}
    >
      <Plus className="h-6 w-6" strokeWidth={2.5} />
    </button>
  );
}
