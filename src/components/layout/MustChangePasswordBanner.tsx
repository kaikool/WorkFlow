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
    <div className="page-container flex justify-center -mb-2 lg:-mb-4 relative z-10 pt-3 lg:pt-0">
      <Link
        href="/dashboard/profile#change-password"
        className="inline-flex items-center gap-2 lg:gap-3 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors active:scale-[0.995] rounded-full px-4 py-2 shadow-sm max-w-full"
      >
        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
        <span className="text-[13px] font-semibold text-amber-800 truncate">
          Bạn đang dùng mật khẩu mặc định — hãy đổi mật khẩu cá nhân
        </span>
        <ChevronRight className="h-4 w-4 text-amber-600 shrink-0" />
      </Link>
    </div>
  );
}
