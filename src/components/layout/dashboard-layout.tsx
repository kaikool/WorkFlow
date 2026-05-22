'use client'

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { 
 LayoutDashboard, 
 Users, 
 ListTodo,
 SlidersHorizontal,
 Target,
 LogOut, 
 Menu,
 Building2,
 CalendarDays,
 ShieldCheck,
 Gift,
 HeartHandshake,
 Search
} from "lucide-react";
import { cn, getProfileDisplayTitle } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import {
 Dialog,
 DialogContent,
 DialogDescription,
 DialogHeader,
 DialogTitle,
} from "@/components/ui/dialog";
import {
 Sheet,
 SheetContent,
 SheetDescription,
 SheetHeader,
 SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createClient } from "@/utils/supabase/client";
import { NotificationsDropdown } from "@/components/notifications-dropdown";
import { canManageResourceCatalog } from "@/lib/permissions";

interface DashboardLayoutProps {
 children: React.ReactNode;
 profile: any;
}


function TopNavActionsContent() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

  // Define configurations for pages that need search/filter
  const configMap: Record<string, { placeholder: string, hasStatusFilter?: boolean }> = {
    '/dashboard/team': { placeholder: 'Tìm kiếm cán bộ, phòng ban...' },
    '/dashboard/tasks': { placeholder: 'Tìm kiếm công việc, báo cáo...', hasStatusFilter: true },
    '/dashboard/kpi': { placeholder: 'Tìm kiếm kế hoạch, mục tiêu...' },
    '/dashboard/admin': { placeholder: 'Tìm kiếm tài khoản, dữ liệu...' },
    '/dashboard/settings/users': { placeholder: 'Tìm kiếm người dùng...' },
  };

  const config = configMap[pathname];
  if (!config) return null;

  const q = searchParams.get('q') || '';
  const status = searchParams.get('status') || 'all';

  const handleSearch = (val: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (val) params.set('q', val);
    else params.delete('q');
    router.replace(`${pathname}?${params.toString()}`);
  };

  const handleStatusFilter = (val: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (val !== 'all') params.set('status', val);
    else params.delete('status');
    router.replace(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex items-center justify-end lg:justify-center flex-1 gap-2 w-full min-w-0">
      {/* Desktop View */}
      <div className="hidden lg:flex items-center gap-3 w-full">
        <div className="relative flex-1 group transition-all duration-300">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />
          <Input
            placeholder={config.placeholder}
            className="pl-10"
            defaultValue={q}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
        
        {/* Bộ lọc trạng thái — icon-only trigger */}
        {config.hasStatusFilter && (
          <Select value={status} onValueChange={handleStatusFilter}>
          <SelectTrigger className="relative flex h-11 w-11 items-center justify-center rounded-full border-none bg-transparent shadow-none hover:bg-accent focus:ring-0 shrink-0 [&>svg.lucide-chevron-down]:hidden">
            <SlidersHorizontal className="w-5 h-5 text-muted-foreground" />
            {status !== "all" && (
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary" />
            )}
          </SelectTrigger>
          <SelectContent className="rounded-xl border border-slate-100 shadow-premium">
            <SelectItem value="all">Tất cả trạng thái</SelectItem>
            <SelectItem value="todo">Đang chờ</SelectItem>
            <SelectItem value="doing">Đang làm</SelectItem>
            <SelectItem value="done">Hoàn thành</SelectItem>
            <SelectItem value="late">Trễ hạn</SelectItem>
          </SelectContent>
        </Select>
        )}
      </div>

      {/* Mobile View */}
      <Button 
        variant="ghost" 
        size="icon" 
        className="lg:hidden w-10 h-10 rounded-full shrink-0" 
        onClick={() => setIsMobileSearchOpen(true)}
      >
        <Search className="w-5 h-5 text-slate-600" />
      </Button>

      {/* Mobile Search Overlay */}
      {isMobileSearchOpen && (
        <div className="fixed inset-x-0 top-0 h-[64px] bg-white/90 backdrop-blur-2xl z-[60] flex items-center px-3 gap-2 border-b border-slate-100 animate-in fade-in slide-in-from-top-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              autoFocus 
              placeholder={config.placeholder}
              className="pl-10"
              defaultValue={q}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
          {config.hasStatusFilter && (
            <Select value={status} onValueChange={handleStatusFilter}>
            <SelectTrigger className="relative flex h-11 w-11 items-center justify-center rounded-full border-none bg-transparent shadow-none focus:ring-0 shrink-0 [&>svg.lucide-chevron-down]:hidden">
              <SlidersHorizontal className="w-5 h-5 text-muted-foreground" />
              {status !== "all" && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary" />
              )}
            </SelectTrigger>
            <SelectContent className="rounded-xl border border-slate-100 shadow-premium">
              <SelectItem value="all">Tất cả trạng thái</SelectItem>
              <SelectItem value="todo">Đang chờ</SelectItem>
              <SelectItem value="doing">Đang làm</SelectItem>
              <SelectItem value="done">Hoàn thành</SelectItem>
              <SelectItem value="late">Trễ hạn</SelectItem>
            </SelectContent>
          </Select>
          )}
          <Button variant="ghost" className="shrink-0 text-slate-600 font-medium px-3 rounded-xl h-11" onClick={() => setIsMobileSearchOpen(false)}>
            Huỷ
          </Button>
        </div>
      )}
    </div>
  );
}

function TopNavActions() {
  return (
    <Suspense fallback={<div className="w-10 h-10" />}>
      <TopNavActionsContent />
    </Suspense>
  );
}

export function DashboardLayout({ children, profile }: DashboardLayoutProps) {
 const pathname = usePathname();
 const router = useRouter();
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
 const [mounted, setMounted] = useState(false);
 const [isAnniversaryDialogOpen, setIsAnniversaryDialogOpen] = useState(false);
 const supabase = createClient();
  const [isScrolledDown, setIsScrolledDown] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);

  React.useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 50) {
        setIsScrolledDown(true);
      } else if (currentScrollY < lastScrollY) {
        setIsScrolledDown(false);
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);
 const branchJoinDate = profile?.branch_join_date ? new Date(`${profile.branch_join_date}T00:00:00`) : null;
 const anniversaryYears = branchJoinDate ? Math.max(0, new Date().getFullYear() - branchJoinDate.getFullYear()) : 0;
 const anniversaryMessages = [
   "Cảm ơn bạn đã bền bỉ đồng hành, góp sức bằng sự tận tâm và trách nhiệm trong từng ngày làm việc.",
   "Chi nhánh trân trọng những nỗ lực thầm lặng, tinh thần sẻ chia và dấu ấn chuyên môn mà bạn đã mang lại.",
   "Mỗi chặng đường đều có giá trị riêng. Cảm ơn bạn đã cùng tập thể xây dựng một môi trường làm việc tử tế và hiệu quả.",
   "Chúc bạn luôn giữ được nhiệt huyết, niềm vui trong công việc và tiếp tục có thêm nhiều dấu mốc đáng nhớ tại Chi nhánh."
 ];
 const anniversaryMessage = anniversaryMessages[anniversaryYears % anniversaryMessages.length];

 React.useEffect(() => {
 setMounted(true);
 const cleanupKey = `workflow-cleanup-${new Date().toISOString().slice(0, 10)}`;
 if (window.localStorage.getItem(cleanupKey)) return;

 const runCleanup = async () => {
   try {
     await supabase.rpc('auto_archive_and_cleanup');
     window.localStorage.setItem(cleanupKey, "done");
   } catch (e) {
     console.error("Cleanup error:", e);
   }
 };

 const idleCallback = window.requestIdleCallback || ((cb: IdleRequestCallback) => window.setTimeout(cb, 1500));
 const cancelIdleCallback = window.cancelIdleCallback || window.clearTimeout;
 const cleanupId = idleCallback(runCleanup);

 return () => cancelIdleCallback(cleanupId);
 }, [supabase]);

 React.useEffect(() => {
   if (!profile?.id || !profile?.branch_join_date) return;

   const today = new Date();
   const joined = new Date(`${profile.branch_join_date}T00:00:00`);
   const isSameDay = today.getDate() === joined.getDate() && today.getMonth() === joined.getMonth();
   if (!isSameDay) return;

   const storageKey = `branch-anniversary-${profile.id}-${today.getFullYear()}`;
   if (window.localStorage.getItem(storageKey)) return;

   setIsAnniversaryDialogOpen(true);
   window.localStorage.setItem(storageKey, "shown");
 }, [profile?.id, profile?.branch_join_date]);

 const handleLogout = async () => {
    setIsLogoutDialogOpen(false);
    await supabase.auth.signOut();
    // Chuyển hướng cứng (Hard reload) để dọn sạch hoàn toàn các lớp phủ Dialog Portal Radix bị kẹt và session cũ
    window.location.href = '/login';
  };
  const canManageSystem = canManageResourceCatalog(profile);

  const navItems = [
   { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
   { name: 'Công việc', href: '/dashboard/tasks', icon: ListTodo, hideFor: ['driver', 'secretary', 'hr_officer'] },
   { name: 'Kế hoạch', href: '/dashboard/kpi', icon: Target, hideFor: ['driver', 'hr_officer', 'secretary'] },
   { name: 'Lịch trình', href: '/dashboard/schedule', icon: CalendarDays },
   { name: 'Cán bộ', href: '/dashboard/team', icon: Users, hideFor: ['driver', 'secretary', 'staff'] },
  ].filter(item => !(item.hideFor || []).includes(profile?.role));

  const currentNavItem = navItems.find(item => item.href === pathname) || (pathname === '/dashboard/admin' ? {name: 'Quản trị'} : null);
  const pageTitle = currentNavItem ? currentNavItem.name : "WorkFlow";

 return (
 <div className="flex min-h-screen bg-background">
 {/* Branch anniversary appreciation dialog */}
 <Dialog open={isAnniversaryDialogOpen} onOpenChange={setIsAnniversaryDialogOpen}>
 <DialogContent className="overflow-hidden border-none bg-white p-0 shadow-2xl sm:max-w-md">
 <div className="relative bg-gradient-to-br from-rose-50 via-white to-amber-50 px-6 pb-6 pt-8">
 <div className="absolute right-5 top-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/80 shadow-sm ring-1 ring-rose-100">
 <Gift className="h-5 w-5 text-rose-500" />
 </div>
 <DialogHeader className="space-y-3 pr-14">
 <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500 text-white shadow-lg shadow-rose-200">
 <HeartHandshake className="h-7 w-7" />
 </div>
 <DialogTitle className="text-2xl font-bold leading-tight text-slate-950">
 Cảm ơn {profile?.full_name}
 </DialogTitle>
 <DialogDescription className="text-sm font-medium leading-relaxed text-slate-600">
 Hôm nay là ngày kỷ niệm bạn bắt đầu đồng hành cùng Chi nhánh.
 </DialogDescription>
 </DialogHeader>
 <div className="mt-5 rounded-2xl bg-white/85 p-4 shadow-sm ring-1 ring-rose-100/70">
 <p className="text-[15px] font-semibold leading-relaxed text-slate-800">
 {anniversaryMessage}
 </p>
 {anniversaryYears > 0 && (
 <p className="mt-3 text-xs font-bold text-rose-500">
 {anniversaryYears} năm gắn bó
 </p>
 )}
 </div>
 <Button
 className="mt-5 h-11 w-full rounded-xl bg-slate-950 text-sm font-bold text-white hover:bg-slate-800"
 onClick={() => setIsAnniversaryDialogOpen(false)}
 >
 Tiếp tục làm việc
 </Button>
 </div>
 </DialogContent>
 </Dialog>

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
 "flex min-h-11 items-center gap-3 rounded-xl px-3 text-[13px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
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
 "flex min-h-11 items-center gap-3 rounded-xl px-3 text-[13px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
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
 className="w-full justify-start text-red-600 hover:bg-red-50 hover:text-red-700 rounded-xl min-h-11 font-medium text-[13px] px-3 focus-visible:ring-2 focus-visible:ring-red-500/20" 
 onClick={() => setIsLogoutDialogOpen(true)}
 >
 <LogOut className="w-4 h-4 mr-2.5" />
 Đăng xuất
 </Button>
 </div>
 </aside>

 <div className="flex-1 flex flex-col min-w-0">
 <header className={cn(
    "h-[60px] lg:h-16 bg-white/80 backdrop-blur-md border border-slate-100 sticky top-0 lg:top-4 z-40 flex items-center px-3 lg:px-8 mx-0 lg:mx-8 mt-0 lg:mt-4 rounded-none lg:rounded-2xl shadow-sm lg:border-x lg:border-t border-x-0 border-t-0 transition-transform duration-300 ease-in-out gap-4",
    isScrolledDown ? "-translate-y-full lg:translate-y-0" : "translate-y-0"
  )}>
    {/* Left: Page Title */}
    <div className="flex items-center lg:flex-1 shrink-0 overflow-hidden">
       <span className="text-[18px] lg:text-xl font-bold text-slate-900 truncate">{pageTitle}</span>
    </div>

    {/* Middle: Search & Filter */}
    <div className="flex items-center justify-end lg:justify-center flex-1 lg:flex-[2] z-20 min-w-0">
      <TopNavActions />
    </div>

    {/* Right: Notifications & Profile */}
    <div className="flex items-center justify-end gap-3 lg:gap-5 relative z-10 shrink-0 lg:flex-1">
  <NotificationsDropdown />
 
 <div className="hidden sm:flex flex-col text-right">
 <span className="text-sm font-bold text-slate-900 leading-none">
 {profile?.full_name || 'Cán bộ'}
 </span>
  <span className="text-sm font-medium text-primary mt-1.5 truncate whitespace-nowrap">
  {getProfileDisplayTitle(profile)}
  </span>
 </div>

 {mounted ? (
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Button variant="ghost" size="icon" className="h-11 w-11 rounded-full p-0" aria-label="Mở menu tài khoản">
 <Avatar className="h-11 w-11 border-2 border-white shadow-sm cursor-pointer hover:scale-[1.02] transition-transform">
 <AvatarImage src={profile?.avatar_url} className="object-cover" />
 <AvatarFallback className="bg-primary text-primary-foreground font-bold">{profile?.full_name?.[0]}</AvatarFallback>
 </Avatar>
 </Button>
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

 

 <main 
 className="relative flex-1 max-w-full overflow-x-hidden overscroll-x-none p-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] touch-pan-y lg:p-8"
 >
 {children}
 </main>
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
 </div>
 </div>
 );
}
