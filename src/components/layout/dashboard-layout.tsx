'use client'

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
 LayoutDashboard, 
 Users, 
 ListTodo,
 Target,
 LogOut, 
 Menu,
 X,
 Building2,
 RefreshCw,
 Loader2,
 CalendarDays,
 ShieldCheck
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
 DropdownMenu, 
 DropdownMenuContent, 
 DropdownMenuItem, 
 DropdownMenuLabel, 
 DropdownMenuSeparator, 
 DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import {
 AlertDialog,
 AlertDialogAction,
 AlertDialogCancel,
 AlertDialogContent,
 AlertDialogDescription,
 AlertDialogFooter,
 AlertDialogHeader,
 AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { createClient } from "@/utils/supabase/client";
import { NotificationsDropdown } from "@/components/notifications-dropdown";

interface DashboardLayoutProps {
 children: React.ReactNode;
 profile: any;
}

export function DashboardLayout({ children, profile }: DashboardLayoutProps) {
 const pathname = usePathname();
 const router = useRouter();
 const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
 const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
 const [mounted, setMounted] = useState(false);
 const [isRefreshing, setIsRefreshing] = useState(false);
 const [pullDistance, setPullDistance] = useState(0);
 const [startY, setStartY] = useState(0);
 const supabase = createClient();

 React.useEffect(() => {
 setMounted(true);
 // Kích hoạt dọn dẹp dữ liệu cũ ngầm (Archive & Cleanup)
 const cleanup = async () => {
   try {
     await supabase.rpc('auto_archive_and_cleanup');
   } catch (e) {
     console.error("Cleanup error:", e);
   }
 };
 cleanup();
 }, []);

 // Xử lý logic Pull-to-refresh
 const handleTouchStart = (e: React.TouchEvent) => {
 if (window.scrollY === 0) {
 setStartY(e.touches[0].pageY);
 }
 };

 const handleTouchMove = (e: React.TouchEvent) => {
 if (startY === 0 || window.scrollY > 0) return;
 const currentY = e.touches[0].pageY;
 const distance = currentY - startY;
 if (distance > 0 && distance < 150) {
 setPullDistance(distance);
 // Ngăn chặn cuộn trang mặc định khi đang kéo làm mới
 if (distance > 20 && e.cancelable) e.preventDefault();
 }
 };

 const handleTouchEnd = () => {
 if (pullDistance > 80) {
 handleRefresh();
 }
 setPullDistance(0);
 setStartY(0);
 };

 const handleRefresh = async () => {
 setIsRefreshing(true);
 // Rung nhẹ nếu là điện thoại
 if (window.navigator && window.navigator.vibrate) {
 window.navigator.vibrate(50);
 }
 router.refresh();
 // Giả lập thời gian nạp dữ liệu mượt mà
 setTimeout(() => {
 setIsRefreshing(false);
 }, 1000);
 };

 const handleLogout = async () => {
    setIsLogoutDialogOpen(false);
    await supabase.auth.signOut();
    // Chuyển hướng cứng (Hard reload) để dọn sạch hoàn toàn các lớp phủ Dialog Portal Radix bị kẹt và session cũ
    window.location.href = '/login';
  };
  const canManageSystem = profile?.role === 'admin' || profile?.role === 'secretary';

 const navItems = [
   { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Công việc', href: '/dashboard/tasks', icon: ListTodo },
  { name: 'Kế hoạch', href: '/dashboard/kpi', icon: Target },
  { name: 'Lịch trình', href: '/dashboard/schedule', icon: CalendarDays },
  { name: 'Cán bộ', href: '/dashboard/team', icon: Users },
 ];

  const roleLabels: Record<string, string> = {
    admin: "Quản trị hệ thống",
    director: "Ban giám đốc",
    manager: "Lãnh đạo phòng",
    staff: "Cán bộ",
    hr_officer: "Cán bộ Nhân sự",
    driver: "Tài xế",
    secretary: "Thư ký"
  };

 return (
 <div className="flex min-h-screen bg-background">
 {/* Logout Confirmation Dialog (Shared) */}
 <AlertDialog open={isLogoutDialogOpen} onOpenChange={setIsLogoutDialogOpen}>
 <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
 <AlertDialogHeader>
 <AlertDialogTitle className="text-xl font-bold tabular-nums">Xác nhận Đăng xuất?</AlertDialogTitle>
 <AlertDialogDescription className="text-slate-500">
 Bạn có chắc chắn muốn kết thúc phiên làm việc hiện tại không?
 </AlertDialogDescription>
 </AlertDialogHeader>
 <AlertDialogFooter className="mt-4 gap-3">
 <AlertDialogCancel className="rounded-xl h-11 border-slate-200">Hủy</AlertDialogCancel>
 <AlertDialogAction onClick={handleLogout} className="rounded-xl h-11 bg-red-600 hover:bg-red-700 font-bold px-6">
 Đăng xuất ngay
 </AlertDialogAction>
 </AlertDialogFooter>
 </AlertDialogContent>
 </AlertDialog>

 {/* Sidebar Desktop */}
 <aside className="hidden lg:flex flex-col w-[272px] bg-[#f5f5f7]/90 backdrop-blur-xl border-r border-slate-200/70 sticky top-0 h-screen shrink-0 z-50">
 <div className="px-4 py-5 flex items-center gap-3">
    <div className="flex items-center justify-center shrink-0">
      <img src="/logo.png" alt="Logo" className="w-9 h-9 object-contain" />
    </div>
    <div className="flex flex-col">
      <span className="text-[15px] font-semibold text-slate-900 leading-none">WorkFlow</span>
      <span className="text-[11px] text-slate-500 mt-0.5">CN Hoàng Mai</span>
    </div>
  </div>

 <nav className="flex-1 px-3 space-y-1 mt-3">
 {navItems.map((item) => {
 const isActive = pathname === item.href;
 return (
 <Link
 key={item.name}
 href={item.href}
 aria-current={isActive ? "page" : undefined}
 className={cn(
 "flex h-10 items-center gap-3 rounded-xl px-3 text-[13px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
              isActive
                ? "bg-white text-slate-950 shadow-sm ring-1 ring-slate-200/70"
                : "text-slate-600 hover:bg-white/70 hover:text-slate-950"
 )}
 >
 <item.icon className={cn("w-[18px] h-[18px] shrink-0", isActive ? "text-primary" : "text-slate-500")} />
 {item.name}
 </Link>
 );
 })}
 
 {canManageSystem && (
 <div className="mt-7 pt-5 border-t border-slate-200/70 space-y-1">
 <p className="px-3 text-[11px] font-medium text-slate-500 mb-1">Hệ thống</p>
 <Link
 href="/dashboard/admin"
 aria-current={pathname === "/dashboard/admin" ? "page" : undefined}
 className={cn(
 "flex h-10 items-center gap-3 rounded-xl px-3 text-[13px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
                pathname === "/dashboard/admin"
                  ? "bg-white text-slate-950 shadow-sm ring-1 ring-slate-200/70"
                  : "text-slate-600 hover:bg-white/70 hover:text-slate-950"
 )}
 >
 <ShieldCheck className={cn("w-[18px] h-[18px] shrink-0", pathname === "/dashboard/admin" ? "text-primary" : "text-slate-500")} />
 Quản trị
 </Link>
 </div>
 )}
 </nav>

 <div className="p-4">
 <div className="flex items-center gap-3 px-2 py-2 mb-2">
 <div className="flex items-center gap-3">
 <div className="w-7 h-7 rounded-lg bg-white/80 shadow-sm ring-1 ring-slate-200/70 flex items-center justify-center shrink-0">
 <Building2 className="w-4 h-4 text-slate-500" />
 </div>
 <div className="flex flex-col min-w-0">
 <span className="text-[11px] text-slate-400 truncate">Cơ quan</span>
 <span className="text-[13px] font-medium text-slate-900 truncate leading-tight">
 {(profile?.role === 'director' || profile?.role === 'admin') ? "Quản trị & Điều hành" : (profile?.departments?.name || "Chi nhánh chính")}
 </span>
 </div>
 </div>
 </div>
 <Button 
 variant="ghost" 
 className="w-full justify-start text-red-600 hover:bg-red-50 hover:text-red-700 rounded-xl h-10 font-medium text-[13px] px-3 focus-visible:ring-2 focus-visible:ring-red-500/20" 
 onClick={() => setIsLogoutDialogOpen(true)}
 >
 <LogOut className="w-4 h-4 mr-2.5" />
 Đăng xuất
 </Button>
 </div>
 </aside>

 <div className="flex-1 flex flex-col min-w-0">
 <header className="h-16 bg-white/80 backdrop-blur-md border border-slate-100 sticky top-0 sm:top-4 z-40 flex items-center justify-between px-4 lg:px-8 mx-0 sm:mx-8 mt-0 sm:mt-4 rounded-none sm:rounded-2xl shadow-sm border-x-0 sm:border-x border-t-0 sm:border-t">
 <div className="flex items-center gap-4">
 <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setIsMobileMenuOpen(true)}>
 <Menu className="w-6 h-6" />
 </Button>
 <div className="hidden md:flex items-center gap-2 text-slate-500">
 <span className="text-sm font-medium text-slate-500">{profile?.departments?.name || "Chi nhánh"}</span>
 </div>
 </div>

 <div className="flex items-center gap-5">
 <NotificationsDropdown />
 
 <div className="hidden sm:flex flex-col text-right">
 <span className="text-sm font-bold text-slate-900 leading-none">
 {profile?.full_name || 'Cán bộ'}
 </span>
  <span className="text-sm font-medium text-primary mt-1.5 truncate whitespace-nowrap">
  {profile?.role === 'admin' ? 'Hệ thống' : profile?.role === 'director' ? 'Giám đốc' : profile?.role === 'manager' ? 'Lãnh đạo' : profile?.role === 'hr_officer' ? 'Nhân sự' : profile?.role === 'driver' ? 'Tài xế' : profile?.role === 'secretary' ? 'Thư ký' : 'Cán bộ'}
  </span>
 </div>

 {mounted ? (
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Avatar className="h-11 w-11 border-2 border-white shadow-sm cursor-pointer hover:scale-[1.02] transition-transform">
 <AvatarImage src={profile?.avatar_url} className="object-cover" />
 <AvatarFallback className="bg-primary text-primary-foreground font-bold">{profile?.full_name?.[0]}</AvatarFallback>
 </Avatar>
 </DropdownMenuTrigger>
 <DropdownMenuContent className="w-56 mt-2 rounded-xl" align="end">
 <DropdownMenuLabel>Tài khoản của tôi</DropdownMenuLabel>
 <DropdownMenuSeparator />
 <DropdownMenuItem className="cursor-pointer" onClick={() => router.push('/dashboard/profile')}>Hồ sơ cá nhân</DropdownMenuItem>
 <DropdownMenuItem className="cursor-pointer" onClick={() => router.push('/dashboard/settings')}>Cài đặt</DropdownMenuItem>
 <DropdownMenuSeparator />
 <DropdownMenuItem className="text-red-500 font-bold cursor-pointer" onClick={() => setIsLogoutDialogOpen(true)}>
 <LogOut className="w-4 h-4 mr-2" /> Đăng xuất
 </DropdownMenuItem>
 </DropdownMenuContent>
 </DropdownMenu>
 ) : (
 <Avatar className="h-11 w-11 border-2 border-white shadow-sm">
 <AvatarImage src={profile?.avatar_url} className="object-cover" />
 <AvatarFallback className="bg-primary text-primary-foreground font-bold">{profile?.full_name?.[0]}</AvatarFallback>
 </Avatar>
 )}
 </div>
 </header>

 {/* Mobile Menu */}
 {isMobileMenuOpen && (
 <div className="lg:hidden fixed inset-0 z-[100] flex animate-in fade-in duration-300">
 <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsMobileMenuOpen(false)}></div>
 <div className="relative w-[300px] bg-white h-full flex flex-col shadow-2xl animate-in slide-in-from-left duration-500">
 <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-[#f5f5f7]/80">
 <div className="flex items-center gap-3">
 <div className="flex items-center justify-center shrink-0">
 <img src="/logo.png" alt="Logo" className="w-9 h-9 object-contain" />
 </div>
 <span className="font-semibold text-lg text-slate-900 tabular-nums">WorkFlow</span>
 </div>
 <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(false)} className="rounded-xl"><X className="w-5 h-5 text-slate-500" /></Button>
 </div>
 <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
 <p className="text-[11px] font-medium text-slate-500 mb-3 pl-2 truncate whitespace-nowrap">Menu điều hướng</p>
 {navItems.map((item) => (
 <Link key={item.name} href={item.href} onClick={() => setIsMobileMenuOpen(false)} className={cn("flex h-12 items-center gap-3 rounded-xl px-4 text-[14px] font-medium transition-colors", pathname === item.href ? "bg-slate-100 text-slate-950" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950")}>
 <item.icon className="w-5 h-5" />{item.name}
 </Link>
 ))}
 
 {canManageSystem && (
 <div className="pt-5 mt-5 border-t border-slate-100 space-y-1">
 <p className="text-[11px] font-medium text-slate-500 mb-2 pl-2 truncate whitespace-nowrap">Hệ thống</p>
 <Link 
 href="/dashboard/admin" 
 onClick={() => setIsMobileMenuOpen(false)} 
 className={cn(
 "flex h-12 items-center gap-3 rounded-xl px-4 text-[14px] font-medium transition-colors", 
 pathname === "/dashboard/admin" ? "bg-slate-100 text-slate-950" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
 )}
 >
 <ShieldCheck className="w-5 h-5" />Quản trị hệ thống
 </Link>
 </div>
 )}
 <div className="pt-5 mt-5 border-t border-slate-100 space-y-3">
 <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1.5">
 <p className="text-[11px] font-medium text-slate-500 truncate whitespace-nowrap">Đang đăng nhập</p>
 <p className="text-sm font-medium text-slate-900">{profile?.full_name}</p>
 </div>
 <Button variant="ghost" className="w-full h-12 justify-start text-red-600 hover:bg-red-50 hover:text-red-700 font-medium px-4 text-[14px] rounded-xl" onClick={() => { setIsMobileMenuOpen(false); setIsLogoutDialogOpen(true); }}>
 <LogOut className="w-5 h-5 mr-3" /> Đăng xuất
 </Button>
 </div>
 </nav>
 </div>
 </div>
 )}

 <main 
 className="flex-1 p-4 lg:p-8 max-w-full relative"
 onTouchStart={handleTouchStart}
 onTouchMove={handleTouchMove}
 onTouchEnd={handleTouchEnd}
 >
 {/* Pull to refresh indicator */}
 <div 
 className="absolute left-0 right-0 flex justify-center pointer-events-none transition-all duration-200 z-50"
 style={{ 
 top: pullDistance > 0 ? `${pullDistance/2}px` : '-40px',
 opacity: pullDistance / 100
 }}
 >
 <div className="bg-white rounded-full p-2 shadow-xl border border-slate-100">
 <RefreshCw className={cn("w-5 h-5 text-primary", pullDistance > 80 && "rotate-180 transition-transform")} />
 </div>
 </div>

 {/* Refreshing Overlay */}
 {isRefreshing && (
 <div className="fixed inset-0 bg-white/80 backdrop-blur-[2px] z-[999] flex flex-col items-center justify-center animate-in fade-in duration-300">
 <div className="bg-white p-6 rounded-[2rem] shadow-2xl flex flex-col items-center gap-4 border border-slate-50">
 <Loader2 className="w-8 h-8 text-primary animate-spin" />
 <span className="text-sm font-medium text-slate-900 truncate whitespace-nowrap">Đang cập nhật dữ liệu...</span>
 </div>
 </div>
 )}

 {children}
 </main>
 </div>
 </div>
 );
}
