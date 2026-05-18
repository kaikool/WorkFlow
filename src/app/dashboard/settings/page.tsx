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
 Settings,
 Mail,
 Zap,
 ShieldCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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

 return (
 <div className="max-w-6xl mx-auto px-0 sm:px-6 space-y-10 animate-fade-in-up pb-20">
 {/* System Standard Header */}
 <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 px-4 sm:px-0 pt-4 sm:pt-0 mb-10">
 <div className="space-y-1">
 <h1 className="text-3xl font-bold text-slate-900 tracking-tight tabular-nums">
 Cài đặt hệ thống
 </h1>
 <p className="text-[12px] text-slate-500 font-bold uppercase truncate whitespace-nowrap">
 CẤU HÌNH TRẢI NGHIỆM & BẢO MẬT
 </p>
 </div>
 <Button onClick={handleSave} disabled={isSaving} className="bg-primary hover:bg-primary/90 text-primary-foreground h-12 px-8 rounded-2xl font-bold text-sm shadow-primary-glow active:scale-95 transition-all">
 {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
 Lưu tất cả thay đổi
 </Button>
 </div>

 <div className="grid grid-cols-1 gap-10 px-4 sm:px-0">
 {/* Notifications Section */}
 <div className="space-y-6">
 <h3 className="text-xs md:text-[11px] font-bold text-slate-500 uppercase flex items-center gap-2 px-2 truncate whitespace-nowrap">
 <Bell className="w-3.5 h-3.5 text-primary" /> Nhận thông báo
 </h3>
 <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-50">
 <div className="p-6 flex items-center justify-between group hover:bg-slate-50/50 transition-all">
 <div className="flex items-center gap-4">
 <div className="p-2.5 bg-primary/5 rounded-xl text-primary"><Zap className="w-4 h-4" /></div>
 <div className="space-y-0.5">
 <p className="text-sm font-bold text-slate-800">Thông báo tức thời</p>
 <p className="text-xs text-slate-500 font-bold uppercase tracking-tight truncate whitespace-nowrap">Thông báo đẩy khi có công việc mới</p>
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
 <div className="p-6 flex items-center justify-between group hover:bg-slate-50/50 transition-all">
 <div className="flex items-center gap-4">
 <div className="p-2.5 bg-slate-50 rounded-xl text-slate-500"><Mail className="w-4 h-4" /></div>
 <div className="space-y-0.5">
 <p className="text-sm font-bold text-slate-800">Báo cáo Email</p>
 <p className="text-xs text-slate-500 font-bold uppercase tracking-tight truncate whitespace-nowrap">Tóm tắt kết quả KPI cuối ngày</p>
 </div>
 </div>
 <Switch checked={notifications.email} onCheckedChange={(v) => setNotifications({...notifications, email: v})} />
 </div>
 </div>
 </div>

 {/* Security Section */}
 <div className="space-y-6">
 <h3 className="text-xs md:text-[11px] font-bold text-slate-500 uppercase flex items-center gap-2 px-2 truncate whitespace-nowrap">
 <Shield className="w-3.5 h-3.5 text-primary" /> Bảo mật & Đăng nhập
 </h3>
 <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
 <div className="p-6 flex items-center justify-between group hover:bg-slate-50/50 transition-all cursor-pointer">
 <div className="flex items-center gap-4">
 <div className="p-2.5 bg-slate-900 rounded-xl text-white"><Lock className="w-4 h-4" /></div>
 <div className="space-y-0.5">
 <p className="text-sm font-bold text-slate-900">Thay đổi mật khẩu</p>
 <p className="text-xs text-slate-500 font-bold uppercase tracking-tight truncate whitespace-nowrap">Yêu cầu đổi sau mỗi 90 ngày</p>
 </div>
 </div>
 <ChevronRight className="w-4 h-4 text-slate-200 group-hover:text-primary transition-all" />
 </div>
 <div className="p-6 border-t border-slate-50 flex items-center justify-between group hover:bg-slate-50/50 transition-all">
 <div className="flex items-center gap-4">
 <div className="p-2.5 bg-slate-50 rounded-xl text-slate-500"><Smartphone className="w-4 h-4" /></div>
 <div className="space-y-0.5">
 <p className="text-sm font-bold text-slate-800">Xác thực 2 lớp (2FA)</p>
 <p className="text-xs text-slate-500 font-bold uppercase tracking-tight truncate whitespace-nowrap">Bảo vệ tài khoản qua mã OTP</p>
 </div>
 </div>
 <Switch />
 </div>
 <div className="p-6 border-t border-slate-50 flex items-center justify-between group hover:bg-slate-50/50 transition-all cursor-pointer">
 <div className="flex items-center gap-4">
 <div className="p-2.5 bg-slate-50 rounded-xl text-slate-500"><History className="w-4 h-4" /></div>
 <div className="space-y-0.5">
 <p className="text-sm font-bold text-slate-800">Lịch sử đăng nhập</p>
 <p className="text-xs text-slate-500 font-bold uppercase tracking-tight truncate whitespace-nowrap">Quản lý các thiết bị đã truy cập</p>
 </div>
 </div>
 <ChevronRight className="w-4 h-4 text-slate-200 group-hover:text-primary transition-all" />
 </div>
 </div>
 </div>

 <div className="pt-10 flex flex-col items-center gap-4 border-t border-slate-100">
 <p className="text-xs md:text-[11px] font-medium text-slate-500 italic">made by phuctd</p>
 </div>
 </div>
 </div>
 );
}
