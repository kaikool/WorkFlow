'use client'

import React, { useState } from "react";
import { 
  Bell, 
  Shield, 
  Lock, 
  Smartphone,
  ChevronRight,
  History,
  Loader2,
  Mail,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { usePushSubscription } from "@/hooks/use-push-subscription";

export default function SettingsPage() {
  const { toast } = useToast();
  const { subscription, permission, subscribe, unsubscribe } = usePushSubscription();
  const [isSaving, setIsSaving] = useState(false);
  const [notifications, setNotifications] = useState({
    zalo: true,
    email: true,
    deadline: true
  });

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      toast({ title: "Đã lưu cài đặt" });
    }, 1000);
  };

  const handleNotImplemented = (featureName: string) => {
    toast({
      title: "Chức năng đang phát triển",
      description: `Tính năng ${featureName} sẽ sớm ra mắt trong bản cập nhật tới.`,
    });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-6 md:space-y-10 animate-fade-in-up pb-20">
      {/* Header chuẩn theo MASTER.md */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-4 sm:pt-0">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Cài đặt hệ thống</h1>
          <p className="text-[13px] text-slate-500 font-medium">Cấu hình trải nghiệm cá nhân và bảo mật tài khoản</p>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={isSaving} 
          className="bg-slate-900 hover:bg-slate-800 text-white h-10 px-5 rounded-xl font-medium shadow-sm active:scale-95 transition-all w-full sm:w-auto"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Lưu thay đổi
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:gap-10">
        {/* Notifications Section */}
        <div className="space-y-6">
          <h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 truncate">
            <Bell className="w-4 h-4 text-slate-400 shrink-0" /> Nhận thông báo
          </h3>
          <div className="premium-card p-0 border-none overflow-hidden divide-y divide-slate-100">
            {/* Thông báo tức thời */}
            <div className="p-6 flex items-center justify-between group hover:bg-slate-50/50 transition-all">
              <div className="flex items-center gap-4 flex-1 min-w-0 pr-4">
                <div className="p-3 bg-amber-50 rounded-xl text-amber-600 shrink-0"><Zap className="w-5 h-5" /></div>
                <div className="space-y-1">
                  <p className="text-[15px] font-bold text-slate-900">Thông báo tức thời (Push Notifications)</p>
                  <p className="text-[13px] text-slate-500 font-medium">Thông báo nổi trên thiết bị khi có công việc mới hoặc cập nhật trạng thái</p>
                </div>
              </div>
              <Switch 
                checked={!!subscription} 
                onCheckedChange={async (v) => {
                  if (v) {
                    const sub = await subscribe();
                    if (sub) {
                      toast({ title: "Đã bật thông báo đẩy", description: "Bạn sẽ nhận được tin nhắn tức thời từ hệ thống." });
                    } else {
                      toast({ 
                        variant: "destructive", 
                        title: "Không thể bật thông báo", 
                        description: "Vui lòng đảm bảo bạn đã 'Thêm vào màn hình chính' và cấp quyền thông báo cho ứng dụng." 
                      });
                    }
                  } else {
                    await unsubscribe();
                    toast({ title: "Đã tắt thông báo đẩy" });
                  }
                }} 
              />
            </div>

            {/* Báo cáo Email */}
            <div className="p-6 flex items-center justify-between group hover:bg-slate-50/50 transition-all">
              <div className="flex items-center gap-4 flex-1 min-w-0 pr-4">
                <div className="p-3 bg-slate-50 rounded-xl text-slate-500 shrink-0"><Mail className="w-5 h-5" /></div>
                <div className="space-y-1">
                  <p className="text-[15px] font-bold text-slate-900">Báo cáo Email</p>
                  <p className="text-[13px] text-slate-500 font-medium">Tóm tắt kết quả xử lý công việc và biến động vào cuối mỗi ngày</p>
                </div>
              </div>
              <Switch checked={notifications.email} onCheckedChange={(v) => setNotifications({...notifications, email: v})} />
            </div>
          </div>
        </div>

        {/* Security Section */}
        <div className="space-y-6">
          <h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 truncate">
            <Shield className="w-4 h-4 text-slate-400 shrink-0" /> Bảo mật & Đăng nhập
          </h3>
          <div className="premium-card p-0 border-none overflow-hidden divide-y divide-slate-100">
            {/* Thay đổi mật khẩu */}
            <div 
              className="p-6 flex items-center justify-between group hover:bg-slate-50/50 transition-all cursor-pointer"
              onClick={() => handleNotImplemented('Đổi mật khẩu')}
            >
              <div className="flex items-center gap-4 flex-1 min-w-0 pr-4">
                <div className="p-3 bg-slate-100 rounded-xl text-slate-600 shrink-0"><Lock className="w-5 h-5" /></div>
                <div className="space-y-1">
                  <p className="text-[15px] font-bold text-slate-900">Thay đổi mật khẩu</p>
                  <p className="text-[13px] text-slate-500 font-medium">Cập nhật mật khẩu định kỳ (đang phát triển)</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-600 transition-all shrink-0" />
            </div>

            {/* 2FA */}
            <div className="p-6 flex items-center justify-between group hover:bg-slate-50/50 transition-all opacity-60">
              <div className="flex items-center gap-4 flex-1 min-w-0 pr-4">
                <div className="p-3 bg-slate-50 rounded-xl text-slate-400 shrink-0"><Smartphone className="w-5 h-5" /></div>
                <div className="space-y-1">
                  <p className="text-[15px] font-bold text-slate-900">Xác thực 2 bước (2FA)</p>
                  <p className="text-[13px] text-slate-500 font-medium">Sắp ra mắt: Bảo vệ tài khoản bằng mã OTP</p>
                </div>
              </div>
              <Switch disabled checked={false} />
            </div>

            {/* Lịch sử đăng nhập */}
            <div 
              className="p-6 flex items-center justify-between group hover:bg-slate-50/50 transition-all cursor-pointer"
              onClick={() => handleNotImplemented('Lịch sử đăng nhập')}
            >
              <div className="flex items-center gap-4 flex-1 min-w-0 pr-4">
                <div className="p-3 bg-slate-50 rounded-xl text-slate-500 shrink-0"><History className="w-5 h-5" /></div>
                <div className="space-y-1">
                  <p className="text-[15px] font-bold text-slate-900">Lịch sử đăng nhập</p>
                  <p className="text-[13px] text-slate-500 font-medium">Kiểm tra các phiên bản thiết bị đã từng truy cập (đang phát triển)</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-600 transition-all shrink-0" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
