'use client'

import React, { useState, useEffect } from "react";
import {
 Users,
 Search,
 ChevronRight,
 Loader2,
 Building2,
 UserPlus,
 Check,
 Copy
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NavbarPortal } from "@/components/layout/navbar-portal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
 Dialog,
 DialogContent,
 DialogTitle,
 DialogTrigger,
 DialogFooter
} from "@/components/ui/dialog";
import {
 Table,
 TableBody,
 TableCell,
 TableHead,
 TableHeader,
 TableRow
} from '@/components/ui/table'
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/utils/supabase/client";
import { notifyError, notifySuccess } from "@/lib/notify";
import { cn, sortProfilesByHierarchy } from "@/lib/utils";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { canAccessPeopleDirectory } from "@/lib/permissions";
import PageHeader from "@/components/layout/PageHeader";
import { ListSkeleton } from "@/components/ui/list-skeleton";
import { EmptyState } from "@/components/ui/empty-state";

export default function TeamPage() {
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('q') || '';
  
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteUrl, setInviteUrl] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  // Auto-open invite dialog khi vào URL có ?create=1 (từ FAB mobile)
  useEffect(() => {
    if (searchParams.get('create') === '1') {
      setIsInviteOpen(true);
    }
  }, [searchParams]);

  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    fetchTeam();
  }, []);

 const fetchTeam = async () => {
 setLoading(true);
 try {
 const { data: { user } } = await supabase.auth.getUser();
 let currentProfile = null;
 if (user) {
 const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single();
 setProfile(p);
 currentProfile = p;
 }

 if (currentProfile && !canAccessPeopleDirectory(currentProfile)) {
   notifyError(null, "Bạn không có quyền truy cập danh bạ cán bộ.");
   router.push('/dashboard');
   return;
 }

 let query = supabase.from('profiles').select(`*, departments (name)`);

 // Lọc theo phòng ban nếu không phải Admin, Director hoặc Cán bộ Nhân sự
 if (currentProfile && currentProfile.role !== 'admin' && currentProfile.role !== 'director' && currentProfile.role !== 'hr_officer' && currentProfile.department_id) {
 query = query.eq('department_id', currentProfile.department_id);
 }

 const { data, error } = await query;
 if (error) throw error;

  const sortedMembers = sortProfilesByHierarchy(data || []);

 setMembers(sortedMembers);
 } catch (error) {
 notifyError(error, "Không tải được danh bạ");
 } finally {
 setLoading(false);
 }
 };

 const handleCreateInvite = async () => {
 const inviteId = Math.random().toString(36).substring(2, 15);
 const url = `${window.location.origin}/register?invite=${inviteId}`;
 setInviteUrl(url);
 };

 const copyToClipboard = () => {
 navigator.clipboard.writeText(inviteUrl);
 setIsCopied(true);
 setTimeout(() => setIsCopied(false), 2000);
 notifySuccess("Đã sao chép link mời");
 };

 const filteredMembers = members.filter(m =>
 m.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
 m.departments?.name?.toLowerCase().includes(searchQuery.toLowerCase())
 );

 const roleLabels: Record<string, { label: string, color: string }> = {
 admin: { label: "Quản trị hệ thống", color: "bg-slate-900 text-white shadow-sm" },
 director: { label: "Ban giám đốc", color: "bg-primary text-white shadow-primary-glow" },
 manager: { label: "Lãnh đạo đơn vị", color: "bg-amber-50 text-amber-600 border border-amber-200" },
 staff: { label: "Cán bộ", color: "bg-slate-50 text-slate-500 border border-slate-100" },
 secretary: { label: "Lễ tân", color: "bg-amber-50 text-amber-700 border border-amber-200" },
 hr_officer: { label: "Cán bộ Nhân sự", color: "bg-blue-50 text-blue-600 border border-blue-200" },
 driver: { label: "Lái xe cơ quan", color: "bg-emerald-50 text-emerald-600 border border-emerald-200" }
 };

 if (loading) return <div className="page-container py-10"><ListSkeleton variant="table" rows={6} /></div>;

 return (
 <div className="page-container space-y-10 animate-fade-in-up">
 <PageHeader
   title="Nhân sự"
   description="Danh sách đội ngũ cán bộ"
   action={
     (profile?.role === 'admin' || profile?.role === 'manager') ? (
 <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
 <DialogTrigger asChild>
 <Button className="bg-primary hover:bg-primary/90 h-10 px-5 rounded-xl font-medium">
 <UserPlus className="w-5 h-5 mr-2" /> Thêm nhân sự
 </Button>
 </DialogTrigger>
 <DialogContent className="rounded-2xl border-none p-0 overflow-hidden max-w-sm">
 <div className="bg-primary p-8 text-white text-center">
 <Users className="w-8 h-8 mx-auto mb-2" />
 <DialogTitle className="text-[17px] font-semibold">Mời nhân sự mới</DialogTitle>
 </div>
 <div className="p-8 space-y-6">
 {!inviteUrl ? (
 <Button onClick={handleCreateInvite} className="w-full bg-slate-900 h-11 rounded-xl font-bold">Tạo Link mời</Button>
 ) : (
 <div className="space-y-4">
 <div className="p-3 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-[10px] text-primary font-bold break-all text-center">{inviteUrl}</div>
 <Button onClick={copyToClipboard} className="w-full bg-emerald-600 h-11 rounded-xl font-bold">
 {isCopied ? <><Check className="w-5 h-5 mr-2" /> Đã sao chép</> : <><Copy className="w-5 h-5 mr-2" /> Sao chép Link</>}
 </Button>
 </div>
 )}
 </div>
 </DialogContent>
 </Dialog>
 ) : null
   }
 />



 <div className="hidden sm:block premium-card border-none overflow-hidden p-0 rounded-[2rem]">
 <Table>
 <TableHeader>
 <TableRow className="bg-slate-50/50 hover:bg-slate-50/50 border-b border-slate-100 h-14">
 <TableHead className="font-medium text-[11px] text-slate-500 pl-8">Nhân sự</TableHead>
 <TableHead className="font-medium text-[11px] text-slate-500">Đơn vị công tác</TableHead>
 <TableHead className="font-medium text-[11px] text-slate-500">Phân quyền</TableHead>
 <TableHead className="font-medium text-[11px] text-slate-500 text-right pr-8">Thao tác</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {filteredMembers.map((member) => (
 <TableRow
 key={member.id}
 className="group hover:bg-slate-50/80 transition-all border-b border-slate-50 h-16 relative"
 >
 <TableCell className="pl-8 py-3">
 <div className="flex items-center gap-4">
 <Avatar className="h-9 w-9 border-2 border-white shadow-sm ring-1 ring-slate-100">
 <AvatarImage src={member.avatar_url} className="object-cover" />
 <AvatarFallback className="bg-primary text-white text-sm font-medium">{member.full_name?.[0]}</AvatarFallback>
 </Avatar>
 <Link href={`/dashboard/team/${member.id}`} className="text-sm font-bold text-slate-900 group-hover:text-primary transition-colors before:absolute before:inset-0 outline-none rounded-md focus-visible:ring-2 focus-visible:ring-primary/20">{member.full_name}</Link>
 </div>
 </TableCell>
 <TableCell>
 <span className="text-[13px] font-medium text-slate-500">{member.departments?.name || "Hội sở / Chi nhánh"}</span>
 </TableCell>
 <TableCell>
 <Badge className={cn("px-3 py-1 rounded-full text-[11px] font-medium border-none", roleLabels[member.role]?.color)}>
 {roleLabels[member.role]?.label}
 </Badge>
 </TableCell>
 <TableCell className="text-right pr-8">
 <div className="inline-flex items-center justify-center p-2 rounded-xl group-hover:bg-primary/5 transition-colors">
 <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-primary transition-all" />
 </div>
 </TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </div>

 <div className="block sm:hidden space-y-4">
 {filteredMembers.map((member) => (
 <Link key={member.id} href={`/dashboard/team/${member.id}`} className="premium-card p-6 flex items-center justify-between active:scale-[0.98] transition-transform block outline-none focus-visible:ring-2 focus-visible:ring-primary/20">
 <div className="flex items-center gap-4">
 <Avatar className="h-12 w-12 border-2 border-white shadow-sm ring-1 ring-slate-100">
 <AvatarImage src={member.avatar_url} className="object-cover" />
 <AvatarFallback className="bg-primary text-white text-sm font-bold">{member.full_name?.[0]}</AvatarFallback>
 </Avatar>
 <div className="space-y-1">
 <div className="flex flex-col">
 <h1 className="text-[15px] font-bold text-slate-900 leading-tight">{member.full_name}</h1>
 <p className="text-[12px] font-medium text-slate-500 truncate max-w-[150px] xs:max-w-none">{member.departments?.name || "Chi nhánh"}</p>
 </div>
 <Badge className={cn("px-2 py-0 text-[10px] font-medium border-none rounded-full", roleLabels[member.role]?.color)}>
 {roleLabels[member.role]?.label}
 </Badge>
 </div>
 </div>
 <div className="p-2 bg-slate-50 rounded-xl">
 <ChevronRight className="w-4 h-4 text-slate-500" />
 </div>
 </Link>
 ))}
 </div>
 </div>
 );
}
