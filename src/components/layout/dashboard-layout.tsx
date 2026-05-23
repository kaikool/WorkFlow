'use client'

import React, { useState, Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
 LayoutDashboard,
 Users,
 ListTodo,
 SlidersHorizontal,
 Target,
 LogOut,
 CalendarDays,
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
import { createClient } from "@/utils/supabase/client";
import { NotificationsDropdown } from "@/components/notifications-dropdown";
import { canManageResourceCatalog } from "@/lib/permissions";
import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog";
import AnniversaryDialog from "./AnniversaryDialog";
import DesktopSidebar from "./DesktopSidebar";
import MobileBottomNav from "./MobileBottomNav";

interface DashboardLayoutProps {
 children: React.ReactNode;
 profile: any;
}


function TopNavActionsContent() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  // Define configurations for pages that need search/filter
  const configMap: Record<string, { placeholder: string, hasStatusFilter?: boolean }> = {
    '/dashboard/team': { placeholder: 'Tìm kiếm cán bộ, phòng ban...' },
    '/dashboard/tasks': { placeholder: 'Tìm kiếm công việc, báo cáo...', hasStatusFilter: true },
    '/dashboard/kpi': { placeholder: 'Tìm kiếm kế hoạch, mục tiêu...' },
    '/dashboard/admin': { placeholder: 'Tìm kiếm tài khoản, dữ liệu...' },
    '/dashboard/settings/users': { placeholder: 'Tìm kiếm người dùng...' },
  };

  const config = configMap[pathname];
  if (!config || !isMounted) return null;

  const q = searchParams.get('q') || '';
  const status = searchParams.get('status') || 'all';
  const isFiltering = status !== 'all';

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
          <SelectTrigger
            className={cn(
              "relative flex h-11 w-11 items-center justify-center rounded-xl border-none bg-transparent shadow-none hover:bg-accent focus:ring-0 shrink-0 [&>svg.lucide-chevron-down]:hidden",
              isFiltering && "bg-amber-50 text-amber-700 ring-1 ring-amber-200 hover:bg-amber-100"
            )}
            aria-label={isFiltering ? "Bộ lọc đang được áp dụng" : "Mở bộ lọc"}
            title={isFiltering ? "Đang áp dụng bộ lọc" : "Mở bộ lọc"}
          >
            <SlidersHorizontal className={cn("w-5 h-5", isFiltering ? "text-amber-700" : "text-muted-foreground")} />
            {isFiltering && (
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white" />
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
      <div className="flex items-center gap-1 lg:hidden">
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 rounded-xl shrink-0"
          onClick={() => setIsMobileSearchOpen(true)}
          aria-label="Mở tìm kiếm"
        >
          <Search className="w-5 h-5 text-slate-600" />
        </Button>

        {config.hasStatusFilter && (
          <Select value={status} onValueChange={handleStatusFilter}>
            <SelectTrigger
              className={cn(
                "relative flex h-11 w-11 items-center justify-center rounded-xl border-none bg-transparent shadow-none hover:bg-accent focus:ring-0 shrink-0 [&>svg.lucide-chevron-down]:hidden",
                isFiltering && "bg-amber-50 text-amber-700 ring-1 ring-amber-200 hover:bg-amber-100"
              )}
              aria-label={isFiltering ? "Bộ lọc đang được áp dụng" : "Mở bộ lọc"}
              title={isFiltering ? "Đang áp dụng bộ lọc" : "Mở bộ lọc"}
            >
              <SlidersHorizontal className={cn("w-5 h-5", isFiltering ? "text-amber-700" : "text-slate-600")} />
              {isFiltering && (
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white" />
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
            <SelectTrigger
              className={cn(
                "relative flex h-11 w-11 items-center justify-center rounded-xl border-none bg-transparent shadow-none focus:ring-0 shrink-0 [&>svg.lucide-chevron-down]:hidden",
                isFiltering && "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
              )}
              aria-label={isFiltering ? "Bộ lọc đang được áp dụng" : "Mở bộ lọc"}
              title={isFiltering ? "Đang áp dụng bộ lọc" : "Mở bộ lọc"}
            >
              <SlidersHorizontal className={cn("w-5 h-5", isFiltering ? "text-amber-700" : "text-muted-foreground")} />
              {isFiltering && (
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white" />
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
 }, []);

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

 return (
 <div className="flex min-h-screen bg-background">
 <ConfirmDialogProvider />
 <AnniversaryDialog
   isOpen={isAnniversaryDialogOpen}
   setIsOpen={setIsAnniversaryDialogOpen}
   fullName={profile?.full_name}
   anniversaryYears={anniversaryYears}
   anniversaryMessage={anniversaryMessage}
 />

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
 <DesktopSidebar
   navItems={navItems}
   pathname={pathname}
   canManageSystem={canManageSystem}
   profile={profile}
   onLogout={() => setIsLogoutDialogOpen(true)}
 />

 <div className="flex-1 flex flex-col min-w-0">
 <header className={cn(
    "h-[60px] lg:h-16 bg-white/80 backdrop-blur-md border border-slate-100 sticky top-0 lg:top-4 z-40 flex items-center px-3 lg:px-8 mx-0 lg:mx-8 mt-0 lg:mt-4 rounded-none lg:rounded-2xl shadow-sm lg:border-x lg:border-t border-x-0 border-t-0 transition-transform duration-300 ease-in-out gap-4",
    isScrolledDown ? "-translate-y-full lg:translate-y-0" : "translate-y-0"
  )}>
    {/* Left + Middle: Search & Filter (full width, không còn lặp tiêu đề trang) */}
    <div className="flex items-center flex-1 z-20 min-w-0">
      <TopNavActions />
    </div>

    {/* Right: Notifications & Profile */}
    <div className="flex items-center justify-end gap-3 lg:gap-5 relative z-10 shrink-0">
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
 <MobileBottomNav navItems={navItems} pathname={pathname} />
 </div>
 </div>
 );
}
