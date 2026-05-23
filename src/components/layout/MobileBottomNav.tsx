'use client'

import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface NavItem {
  name: string;
  href: string;
  icon: any;
}

interface Props {
  navItems: NavItem[];
  pathname: string;
}

export default function MobileBottomNav({ navItems, pathname }: Props) {
  return (
    <nav className="lg:hidden fixed inset-x-0 bottom-0 z-50 border-t border-slate-200/50 bg-white/80 px-2 pb-[max(env(safe-area-inset-bottom),34px)] pt-2 shadow-[0_-12px_30px_-20px_rgba(15,23,42,0.35)] backdrop-blur-2xl">
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${Math.min(navItems.length, 5)}, minmax(0, 1fr))` }}
      >
        {navItems.slice(0, 5).map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              aria-label={item.name}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                isActive ? "bg-primary/10 text-primary" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <span className="max-w-full truncate">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
