"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
 LayoutDashboard, 
 Users, 
 CheckSquare, 
 Target, 
 LogOut, 
 Menu,
 ShieldAlert,
 X,
 Search,
 Settings,
 Loader2
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
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/utils/supabase/client";

function AppLogo({ className }: { className?: string }) {
 return (
 <div className={cn("flex items-center gap-3", className)}>
 <div className="w-8 h-8 bg-slate-900 rounded-[0.5rem] flex items-center justify-center shadow-sm">
 <div className="w-3.5 h-3.5 bg-white rounded-[0.2rem] rotate-45" />
 </div>
 <div className="flex flex-col leading-none">
 <span className="text-lg font-bold text-slate-900">Portal</span>
 </div>
 </div>
 );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
 const pathname = usePathname();
 const router = useRouter();
 const { toast } = useToast();
 const supabase = createClient();
 const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
 const [role, setRole] = useState<'director' | 'manager' | 'staff' | null>(null);
 const [currentUser, setCurrentUser] = useState<any>(null);
 const [headerSearch, setHeaderSearch] = useState("");
 const [loading, setLoading] = useState(true);

 useEffect(() => {
 const checkUser = async () => {
 setLoading(true);
 const { data: { user } } = await supabase.auth.getUser();
 
 if (!user) {
 router.push('/login');
 return;
 }

 const { data: profile } = await supabase
 .from('profiles')
 .select('*')
 .eq('id', user.id)
 .single();

 if (profile) {
 setRole(profile.role);
 setCurrentUser(profile);
 } else {
 // Fallback if profile not found
 router.push('/login');
 }
 setLoading(false);
 };

 checkUser();
 }, [router, supabase]);

 const navItems = [
   { name: "Tổng quan", href: "/dashboard", icon: LayoutDashboard },
  { name: "Nhiệm vụ", href: "/dashboard/tasks", icon: CheckSquare, hideFor: ['driver'] },
  { name: "Mục tiêu & KPIs", href: "/dashboard/kpi", icon: Target, hideFor: ['driver', 'hr_officer', 'secretary'] },
  { name: "Đội ngũ", href: "/dashboard/team", icon: Users },
 ].filter(item => !(item.hideFor || []).includes(role as string));

 const handleLogout = async () => {
    await supabase.auth.signOut();
    // Chuyển hướng cứng (Hard reload) để dọn sạch hoàn toàn các lớp phủ Dialog Portal Radix bị kẹt và session cũ
    window.location.href = '/login';
  };

 const handleHeaderSearchSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 if (headerSearch.trim()) {
 router.push(`/dashboard/tasks?query=${encodeURIComponent(headerSearch)}`);
 setHeaderSearch("");
 toast({
 title: "Đang tìm kiếm",
 description: `Truy xuất dữ liệu cho: "${headerSearch}"`,
 });
 }
 };

 if (loading) {
 return (
 <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
 <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center animate-pulse shadow-lg">
 <div className="w-5 h-5 bg-white rounded-lg rotate-45" />
 </div>
 <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
 </div>
 );
 }

 if (!role || !currentUser) return null;

 const roleLabel = currentUser.isAdmin ? "Quản trị viên" : {
 director: "Ban Giám Đốc",
 manager: "Quản lý phòng",
 staff: "Cán bộ nhân viên"
 }[role];

 return (
 <div className="flex min-h-screen bg-slate-50/50">
 {/* Sidebar Desktop */}
 <aside className="hidden lg:flex flex-col w-64 bg-slate-50/50 backdrop-blur-xl border-r border-slate-200/60 sticky top-0 h-screen shrink-0">
 <div className="px-5 py-6">
 <AppLogo />
 </div>

 <nav className="flex-1 px-4 space-y-1 mt-2">
 {navItems.map((item) => {
 const isActive = pathname === item.href;
 return (
 <Link
 key={item.name}
 href={item.href}
 className={cn(
 "flex items-center gap-3 px-3 py-2.5 rounded-lg text-[14px] font-medium transition-all duration-150",
 isActive 
 ? "bg-slate-900 text-white" 
 : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
 )}
 >
 <item.icon className={cn("w-[18px] h-[18px] shrink-0", isActive ? "text-white" : "text-slate-500")} />
 {item.name}
 </Link>
 );
 })}
 
 {currentUser.isAdmin && (
 <div className="mt-8 pt-6 border-t border-slate-100 space-y-1">
 <p className="px-3 text-[11px] font-semibold text-slate-400 mb-1">Admin Panel</p>
 <Link
 href="/dashboard/admin"
 className={cn(
 "flex items-center gap-3 px-3 py-2.5 rounded-lg text-[14px] font-medium transition-all duration-150",
 pathname === "/dashboard/admin" 
 ? "bg-slate-900 text-white" 
 : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
 )}
 >
 <ShieldAlert className="w-[18px] h-[18px] shrink-0" />
 Quản trị Hệ thống
 </Link>
 </div>
 )}
 </nav>

 <div className="px-3 py-4 border-t border-slate-200/60 space-y-0.5">
 <Link
 href="/dashboard/settings"
 className={cn(
 "flex items-center gap-3 px-3 py-2.5 rounded-lg text-[14px] font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all duration-150",
 pathname === "/dashboard/settings" && "bg-slate-100 text-slate-900"
 )}
 >
 <Settings className="w-[18px] h-[18px] shrink-0" />
 Cài đặt
 </Link>
 <Button variant="ghost" className="w-full justify-start text-red-500 hover:bg-red-50 hover:text-red-600 rounded-lg h-9 text-[14px] font-medium" onClick={handleLogout}>
 <LogOut className="w-4 h-4 mr-2.5" />
 Đăng xuất
 </Button>
 </div>
 </aside>

 <div className="flex-1 flex flex-col min-w-0">
 <header className="h-16 bg-white/80 backdrop-blur-md border border-slate-100 sticky top-4 z-40 flex items-center justify-between px-4 sm:px-8 mx-4 lg:mx-8 mt-4 rounded-2xl shadow-sm">
 <div className="flex items-center gap-4">
 <Button variant="ghost" size="icon" className="lg:hidden h-11 w-11 text-slate-600" onClick={() => setIsMobileMenuOpen(true)}>
 <Menu className="w-6 h-6 stroke-[2.5]" />
 </Button>
 <form onSubmit={handleHeaderSearchSubmit} className="relative hidden md:block">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
 <Input 
 value={headerSearch}
 onChange={(e) => setHeaderSearch(e.target.value)}
 className="pl-10 h-10 w-72 bg-slate-100/50 border-none rounded-xl text-[13px] focus-visible:ring-1 focus-visible:ring-slate-200 transition-all" 
 placeholder="Tìm hồ sơ, nhiệm vụ..." 
 />
 </form>
 </div>

 <div className="flex items-center gap-4">
 <div className="hidden sm:block text-right">
 <p className="text-[13px] font-bold text-slate-900">{currentUser.name}</p>
 <p className="text-[10px] text-slate-500 font-bold truncate whitespace-nowrap">{roleLabel}</p>
 </div>
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Avatar className="h-9 w-9 border-2 border-white shadow-sm cursor-pointer hover:scale-[1.02] transition-transform">
 <AvatarImage src={`https://picsum.photos/seed/${currentUser.adAccount}/80/80`} />
 <AvatarFallback className="bg-slate-900 text-white text-[10px]">{currentUser.name[0]}</AvatarFallback>
 </Avatar>
 </DropdownMenuTrigger>
 <DropdownMenuContent className="w-56 mt-2 rounded-xl" align="end">
 <DropdownMenuLabel className="font-bold">Hồ sơ Cán bộ</DropdownMenuLabel>
 <DropdownMenuSeparator />
 <DropdownMenuItem asChild className="rounded-lg cursor-pointer"><Link href="/dashboard/profile">Thông tin cá nhân</Link></DropdownMenuItem>
 <DropdownMenuItem asChild className="rounded-lg cursor-pointer"><Link href="/dashboard/settings">Cấu hình hệ thống</Link></DropdownMenuItem>
 <DropdownMenuSeparator />
 <DropdownMenuItem className="text-red-500 font-bold rounded-lg cursor-pointer" onClick={handleLogout}>
 <LogOut className="w-4 h-4 mr-2.5" /> Đăng xuất
 </DropdownMenuItem>
 </DropdownMenuContent>
 </DropdownMenu>
 </div>
 </header>

 {isMobileMenuOpen && (
 <div className="lg:hidden fixed inset-0 z-[100] flex animate-in fade-in">
 <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}></div>
 <div className="relative w-72 bg-white h-full flex flex-col animate-in slide-in-from-left duration-300">
 <div className="p-8 border-b border-slate-100 flex justify-between items-center">
 <AppLogo />
 <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(false)}><X className="w-5 h-5 text-slate-500" /></Button>
 </div>
 <nav className="flex-1 p-6 space-y-1">
 {navItems.map((item) => (
 <Link key={item.name} href={item.href} onClick={() => setIsMobileMenuOpen(false)} className={cn("flex items-center gap-3 px-4 py-3 rounded-xl text-[13px] font-bold", pathname === item.href ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50")}>
 <item.icon className="w-4 h-4" />{item.name}
 </Link>
 ))}
 </nav>
 </div>
 </div>
 )}

 <main className="flex-1 py-6 md:py-8 w-full overflow-x-hidden">
 {children}
 </main>
 </div>
 </div>
 );
}
