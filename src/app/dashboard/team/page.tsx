'use client'

export const dynamic = 'force-dynamic';

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
import { useToast } from "@/hooks/use-toast";
import { cn, sortProfilesByHierarchy } from "@/lib/utils";
import { useRouter } from "next/navigation";

export default function TeamPage() {
 const [members, setMembers] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);
 const [searchQuery, setSearchQuery] = useState("");
 const [isInviteOpen, setIsInviteOpen] = useState(false);
 const [inviteUrl, setInviteUrl] = useState("");
 const [isCopied, setIsCopied] = useState(false);
 const [profile, setProfile] = useState<any>(null);
 
 const { toast } = useToast();
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

 let query = supabase.from('profiles').select(`*, departments (name)`);
 
 // Lọc theo phòng ban nếu không phải Admin, Director hoặc Cán bộ Nhân sự
 if (currentProfile && currentProfile.role !== 'admin' && currentProfile.role !== 'director' && currentProfile.role !== 'hr_officer' && currentProfile.department_id) {
 query = query.eq('department_id', currentProfile.department_id);
 }

 const { data, error } = await query;
 if (error) throw error;
 
  const sortedMembers = sortProfilesByHierarchy(data || []);

 setMembers(sortedMembers);
 } catch (error: any) {
 toast({ variant: "destructive", title: "Lỗi", description: error.message });
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
 toast({ title: "Đã sao chép Link mời" });
 };

 const filteredMembers = members.filter(m => 
 m.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
 m.departments?.name?.toLowerCase().includes(searchQuery.toLowerCase())
 );

 const roleLabels: Record<string, { label: string, color: string }> = {
 admin: { label: "Quản trị hệ thống", color: "bg-slate-900 text-white shadow-sm" },
 director: { label: "Ban giám đốc", color: "bg-primary text-white shadow-primary-glow" },
 manager: { label: "Lãnh đạo đơn vị", color: "bg-amber-50 text-amber-600 border border-amber-200" },
 staff: { label: "Cán bộ", color: "bg-slate-50 text-slate-500 border border-slate-100" },
 secretary: { label: "Thư ký TCTH", color: "bg-indigo-50 text-indigo-600 border border-indigo-200" },
 hr_officer: { label: "Cán bộ Nhân sự", color: "bg-blue-50 text-blue-600 border border-blue-200" },
 driver: { label: "Lái xe cơ quan", color: "bg-emerald-50 text-emerald-600 border border-emerald-200" }
 };

 if (loading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

 return (
 <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-10 animate-fade-in-up pb-20">
 <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pt-4 sm:pt-0">
 <div className="space-y-1">
 <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
 Nhân sự
 </h1>
 <p className="text-[13px] text-slate-500 font-medium">Danh sách đội ngũ cán bộ</p>
 </div>

 {(profile?.role === 'admin' || profile?.role === 'manager') && (
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
 )}
 </div>

 {/* Unified Search & Filter Bar */}
 <div className="flex items-center gap-2 bg-slate-50/60 p-1.5 rounded-2xl border border-slate-100/80 shadow-sm w-full h-13 sm:h-14">
   <div className="flex items-center gap-2 px-2 shrink-0">
     <Users className="w-4 h-4 text-primary shrink-0" />
     <span className="text-xs font-bold text-slate-600 uppercase tracking-wider hidden sm:inline">Danh sách cán bộ ({filteredMembers.length})</span>
     <span className="text-xs font-bold text-slate-600 tracking-wider inline sm:hidden">({filteredMembers.length})</span>
   </div>
   <div className="relative flex-1 group">
     <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 group-focus-within:text-primary transition-colors" />
     <Input 
       placeholder="Tìm kiếm cán bộ hoặc phòng ban..." 
       className="w-full pl-9 pr-3 h-10 text-xs font-semibold bg-white border-slate-200/60 rounded-xl focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary transition-all" 
       value={searchQuery}
       onChange={(e) => setSearchQuery(e.target.value)}
     />
   </div>
 </div>

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
 className="group hover:bg-slate-50/80 transition-all cursor-pointer border-b border-slate-50 h-16"
 onClick={() => router.push(`/dashboard/team/${member.id}`)}
 >
 <TableCell className="pl-8 py-3">
 <div className="flex items-center gap-4">
 <Avatar className="h-9 w-9 border-2 border-white shadow-sm ring-1 ring-slate-100">
 <AvatarImage src={member.avatar_url} className="object-cover" />
 <AvatarFallback className="bg-primary text-white text-[10px] font-bold">{member.full_name?.[0]}</AvatarFallback>
 </Avatar>
 <span className="text-sm font-bold text-slate-900 group-hover:text-primary transition-colors">{member.full_name}</span>
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
 <div key={member.id} className="premium-card p-6 flex items-center justify-between active:scale-[0.98] transition-transform" onClick={() => router.push(`/dashboard/team/${member.id}`)}>
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
 </div>
 ))}
 </div>
 </div>
 );
}
