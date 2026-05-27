'use client'

import React from "react";
import Link from "next/link";
import { AlertTriangle, ChevronRight } from "lucide-react";

// Banner nhắc đổi mật khẩu mặc định. Hiển thị ở mọi trang dashboard khi
// profile.must_change_password = true. Bấm vào dẫn thẳng tới /dashboard/profile#change-password

interface Props {
  show: boolean;
}

export default function MustChangePasswordBanner({ show }: Props) {
  if (!show) return null;
  return (
    <Link
      href="/dashboard/profile#change-password"
      className="block bg-amber-50 border-y border-amber-100 hover:bg-amber-100/70 transition-colors active:scale-[0.995] -mb-2 lg:-mb-4 relative z-10"
    >
      <div className="page-container py-3 flex items-center gap-3">
        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
        <p className="flex-1 text-sm font-semibold text-amber-800">
          Bạn đang dùng mật khẩu mặc định — hãy đổi sang mật khẩu cá nhân để bảo mật.
        </p>
        <span className="text-xs font-bold text-amber-700 hidden sm:inline">Đổi ngay</span>
        <ChevronRight className="h-4 w-4 text-amber-600 shrink-0" />
      </div>
    </Link>
  );
}
