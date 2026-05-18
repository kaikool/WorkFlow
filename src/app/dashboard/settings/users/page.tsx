'use client'

import React, { useState, useEffect } from "react";
import { 
 Users, 
 Search, 
 Loader2, 
 Shield,
 Building2,
 Save,
 Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
 Select, 
 SelectContent, 
 SelectItem, 
 SelectTrigger, 
 SelectValue 
} from "@/components/ui/select";
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

export default function UserManagementPage() {
 const [users, setUsers] = useState<any[]>([]);
 const [departments, setDepartments] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);
 const [searchQuery, setSearchQuery] = useState("");
 const [updatingId, setUpdatingId] = useState<string | null>(null);
 
 const { toast } = useToast();
 const supabase = createClient();

 useEffect(() => {
 fetchData();
 }, []);

 const fetchData = async () => {
 setLoading(true);
 try {
 const { data: profiles, error: pError } = await supabase
 .from('profiles')
 .select(`*, departments (id, name)`)
 .order('full_name');
 
 if (pError) throw pError;
 setUsers(profiles || []);

 const { data: depts, error: dError } = await supabase
 .from('departments')
 .select('*')
 .order('name');
 
 if (dError) throw dError;
 setDepartments(depts || []);

 } catch (error: any) {
 toast({ variant: "destructive", title: "Lỗi", description: error.message });
 } finally {
 setLoading(false);
 }
 };

 const handleUpdateUser = async (userId: string, updates: any) => {
 setUpdatingId(userId);
 try {
 const { error } = await supabase
 .from('profiles')
 .update(updates)
 .eq('id', userId);

 if (error) throw error;
 
 setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...updates } : u));
 toast({ title: "Thành công", description: "Đã cập nhật thông tin người dùng." });
 } catch (error: any) {
 toast({ variant: "destructive", title: "Lỗi", description: error.message });
 } finally {
 setUpdatingId(null);
 }
 };

 const filteredUsers = users.filter(u => 
 u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
 u.role?.toLowerCase().includes(searchQuery.toLowerCase())
 );

 const roleLabels: Record<string, string> = {
 admin: "Quản trị hệ thống",
 director: "Ban giám đốc",
 manager: "Lãnh đạo phòng",
 staff: "Cán bộ"
 };

 if (loading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

 return (
 <div className="max-w-6xl mx-auto space-y-10 animate-fade-in-up pb-20">
 {/* Header */}
 <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 px-4 sm:px-0 pt-4 sm:pt-0">
 <div className="space-y-1">
 <h1 className="text-3xl font-bold text-slate-900 tracking-tight tabular-nums">
 Quản lý nhân sự
 </h1>
 <p className="text-[12px] text-slate-500 font-bold uppercase truncate whitespace-nowrap">CẤU HÌNH QUYỀN HẠN & PHÒNG BAN</p>
 </div>
 </div>

 {/* Filters */}
 <div className="px-4 sm:px-0">
 <div className="bg-white p-2 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-2">
 <div className="relative flex-1">
 <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
 <Input 
 placeholder="Tìm kiếm cán bộ hoặc chức danh..." 
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className="pl-11 bg-transparent border-none focus-visible:ring-0 h-11 font-bold text-slate-600"
 />
 </div>
 </div>
 </div>

 {/* User Table */}
 <div className="px-4 sm:px-0">
 <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
 <Table>
 <TableHeader className="bg-slate-50/50">
 <TableRow className="hover:bg-transparent border-slate-50">
 <TableHead className="w-[300px] text-[10px] font-bold uppercase text-slate-500 py-5 pl-8 truncate whitespace-nowrap">Cán bộ</TableHead>
 <TableHead className="text-[10px] font-bold uppercase text-slate-500 truncate whitespace-nowrap">Phòng ban</TableHead>
 <TableHead className="text-[10px] font-bold uppercase text-slate-500 truncate whitespace-nowrap">Quyền hạn</TableHead>
 <TableHead className="text-right pr-8"></TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {filteredUsers.map((user) => (
 <TableRow key={user.id} className="group hover:bg-slate-50/50 transition-all border-slate-50">
 <TableCell className="py-4 pl-8">
 <div className="flex items-center gap-4">
 <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
 <AvatarImage src={user.avatar_url} />
 <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">
 {user.full_name?.[0]?.toUpperCase()}
 </AvatarFallback>
 </Avatar>
 <div className="flex flex-col">
 <span className="text-sm font-bold text-slate-900 group-hover:text-primary transition-colors">{user.full_name}</span>
 <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight truncate whitespace-nowrap">{user.role}</span>
 </div>
 </div>
 </TableCell>
 <TableCell>
 <Select 
 value={user.department_id || "none"} 
 onValueChange={(val) => handleUpdateUser(user.id, { department_id: val === "none" ? null : val })}
 disabled={updatingId === user.id}
 >
 <SelectTrigger className="w-[200px] bg-slate-50 border-none rounded-xl h-9 text-xs font-bold text-slate-600">
 <SelectValue />
 </SelectTrigger>
 <SelectContent className="rounded-xl border-none shadow-2xl">
 <SelectItem value="none">Chưa xác định</SelectItem>
 {departments.map((d) => (
 <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </TableCell>
 <TableCell>
 <Select 
 value={user.role} 
 onValueChange={(val) => handleUpdateUser(user.id, { role: val })}
 disabled={updatingId === user.id}
 >
 <SelectTrigger className="w-[180px] bg-slate-50 border-none rounded-xl h-9 text-xs font-bold text-slate-600">
 <SelectValue />
 </SelectTrigger>
 <SelectContent className="rounded-xl border-none shadow-2xl">
 <SelectItem value="staff">Cán bộ</SelectItem>
 <SelectItem value="manager">Lãnh đạo phòng</SelectItem>
 <SelectItem value="director">Ban giám đốc</SelectItem>
 <SelectItem value="admin">Quản trị hệ thống</SelectItem>
 </SelectContent>
 </Select>
 </TableCell>
 <TableCell className="text-right pr-8">
 {updatingId === user.id && <Loader2 className="w-4 h-4 animate-spin text-primary inline-block" />}
 </TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </div>
 </div>
 </div>
 );
}
