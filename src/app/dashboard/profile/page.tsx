'use client'

import React, { useEffect, useState, useRef } from "react";
import {
 User,
 Mail,
 ShieldCheck,
 Camera,
 CheckCircle2,
 Loader2,
 Briefcase,
 LogOut,
 History,
 Settings,
 ChevronRight,
 Upload
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
 DialogTrigger
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
 const [profile, setProfile] = useState<any>(null);
 const [loading, setLoading] = useState(true);
 const [updating, setUpdating] = useState(false);
 const [uploading, setUploading] = useState(false);
 const [activities, setActivities] = useState<any[]>([]);
 const [departments, setDepartments] = useState<any[]>([]);
 const [isUpdateOpen, setIsUpdateOpen] = useState(false);

 const [newName, setNewName] = useState("");
 const [newDept, setNewDept] = useState("");
 const [newRole, setNewRole] = useState("");

 const fileInputRef = useRef<HTMLInputElement>(null);
 const { toast } = useToast();
 const supabase = createClient();
 const router = useRouter();

 useEffect(() => {
 fetchProfile();
 fetchActivities();
 fetchDepartments();
 }, []);

 const fetchDepartments = async () => {
 const { data } = await supabase.from('departments').select('*').order('name');
 setDepartments(data || []);
 };

 const fetchProfile = async () => {
 setLoading(true);
 try {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) return;
 const { data, error } = await supabase
 .from('profiles')
 .select(`*, departments (name)`)
 .eq('id', user.id)
 .single();
 if (error) throw error;
 setProfile({ ...data, email: user.email });
 setNewName(data.full_name || "");
 setNewDept(data.department_id || "");
 setNewRole(data.role || "");
 } catch (error: any) {
 toast({ variant: "destructive", title: "Lỗi", description: error.message });
 } finally {
 setLoading(false);
 }
 };

 const fetchActivities = async () => {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) return;
 const { data } = await supabase
 .from('task_comments')
 .select(`*, task:tasks(title)`)
 .eq('user_id', user.id)
 .order('created_at', { ascending: false })
 .limit(5);
 setActivities(data || []);
 };

 const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (!file) return;

 setUploading(true);
 try {
 const fileExt = file.name.split('.').pop();
 const fileName = `${Date.now()}.${fileExt}`;
 const filePath = `${profile.id}/${fileName}`;

 // Upload image to Supabase Storage
 const { error: uploadError } = await supabase.storage
 .from('avatars')
 .upload(filePath, file);

 if (uploadError) throw uploadError;

 // Get Public URL
 const { data: { publicUrl } } = supabase.storage
 .from('avatars')
 .getPublicUrl(filePath);

 // Update Profile
 const { error: updateError } = await supabase
 .from('profiles')
 .update({ avatar_url: publicUrl })
 .eq('id', profile.id);

 if (updateError) throw updateError;

 setProfile({ ...profile, avatar_url: publicUrl });
 toast({ title: "Đã cập nhật ảnh đại diện" });
 router.refresh();
 } catch (error: any) {
 toast({ variant: "destructive", title: "Lỗi tải ảnh", description: error.message });
 } finally {
 setUploading(false);
 }
 };

 const handleUpdateProfile = async () => {
 if (!newName.trim()) return;
 setUpdating(true);
 try {
 const updateData: any = {
 full_name: newName,
 department_id: newDept || null
 };

 if (profile.role === 'admin') {
 updateData.role = newRole;
 }

 const { error } = await supabase
 .from('profiles')
 .update(updateData)
 .eq('id', profile.id);

 if (error) throw error;
 await fetchProfile();
 setIsUpdateOpen(false);
 toast({ title: "Đã cập nhật hồ sơ" });
 router.refresh();
 } catch (error: any) {
 toast({ variant: "destructive", title: "Lỗi", description: error.message });
 } finally {
 setUpdating(false);
 }
 };

 if (loading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
 if (!profile) return null;

 const roleLabels: Record<string, string> = {
 admin: "Quản trị hệ thống",
 director: "Ban giám đốc",
 manager: "Lãnh đạo phòng",
 staff: "Cán bộ"
 };

 const isAdmin = profile.role === 'admin';

 return (
 <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-10 animate-fade-in-up pb-20">
 <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6  pt-4 sm:pt-0 mb-10">
 <div className="space-y-1">
 <h1 className="text-3xl font-bold text-slate-900 tracking-tight tabular-nums">
 Hồ sơ cá nhân
 </h1>
 <p className="text-[12px] text-slate-500 font-bold uppercase truncate whitespace-nowrap">
 THÔNG TIN TÀI KHOẢN CÁ NHÂN
 </p>
 </div>
 <Button variant="outline" onClick={async () => { await supabase.auth.signOut(); router.push('/login'); }} className="border-red-100 text-red-500 font-bold text-sm hover:bg-red-50 hover:text-red-600 rounded-2xl px-8 h-12 transition-all active:scale-95">
 <LogOut className="w-4 h-4 mr-2" />
 Đăng xuất
 </Button>
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 px-4 sm:px-0">
 <div className="lg:col-span-8 space-y-10">
 <div className="bg-white p-8 sm:p-12 rounded-3xl border border-slate-100 shadow-sm flex flex-col sm:flex-row items-center gap-10 relative overflow-hidden">
 <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-full -mr-16 -mt-16" />
 <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
 <Avatar className="h-28 w-28 border-4 border-slate-50 shadow-sm transition-all group-hover:opacity-80">
 <AvatarImage src={profile.avatar_url} className="object-cover" />
 <AvatarFallback className="bg-primary text-white text-3xl font-bold tabular-nums tracking-tighter">{profile.full_name?.[0]?.toUpperCase()}</AvatarFallback>
 </Avatar>
 <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
 {uploading ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : <Camera className="w-6 h-6 text-white" />}
 </div>
 <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarUpload} disabled={uploading} />
 </div>
 <div className="space-y-4 flex-1 text-center sm:text-left">
 <div className="space-y-1">
 <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
 <h2 className="text-2xl font-bold text-slate-900 tabular-nums tracking-tighter">{profile.full_name}</h2>
 <Badge className="bg-primary/5 text-primary border-none text-xs font-bold uppercase px-2.5 py-0.5 rounded-md truncate whitespace-nowrap">
 {roleLabels[profile.role] || "Cán bộ"}
 </Badge>
 </div>
 <p className="text-slate-500 font-bold text-xs uppercase truncate whitespace-nowrap">
 {(profile.role === 'director' || profile.role === 'admin') ? "Quản trị & Điều hành" : (profile.departments?.name || "Chưa xác định phòng ban")}
 </p>
 </div>

 <div className="pt-2 flex justify-center sm:justify-start gap-3">
 <Dialog open={isUpdateOpen} onOpenChange={setIsUpdateOpen}>
 <DialogTrigger asChild>
 <Button className="bg-slate-900 text-white h-9 px-6 rounded-xl text-xs font-bold shadow-lg shadow-slate-900/10">Thiết lập hồ sơ</Button>
 </DialogTrigger>
 <DialogContent className="rounded-3xl border-none p-0 overflow-hidden max-w-sm">
 <div className="bg-slate-900 p-8 text-white">
 <DialogTitle className="text-lg font-bold">Cập nhật thông tin</DialogTitle>
 <p className="text-xs opacity-60 font-bold uppercase mt-1 truncate whitespace-nowrap">Hoàn thiện danh tính cán bộ</p>
 </div>
 <div className="p-8 space-y-5">
 <div className="space-y-1.5">
 <Label className="text-xs font-bold text-slate-500 uppercase pl-1 truncate whitespace-nowrap">Họ và tên</Label>
 <Input value={newName} onChange={(e) => setNewName(e.target.value)} className="h-12 md:h-10 bg-slate-50 border-none rounded-xl font-bold text-base md:text-sm" />
 </div>

 <div className="space-y-1.5">
 <Label className="text-xs font-bold text-slate-500 uppercase pl-1 truncate whitespace-nowrap">Phòng ban công tác</Label>
 <Select value={newDept} onValueChange={setNewDept}>
 <SelectTrigger className="h-12 md:h-10 bg-slate-50 border-none rounded-xl font-bold text-base md:text-sm"><SelectValue placeholder="Chọn phòng ban..." /></SelectTrigger>
 <SelectContent className="rounded-xl border-none shadow-2xl">
 {departments.map((d) => (<SelectItem key={d.id} value={d.id} className="text-base md:text-sm py-3 md:py-2">{d.name}</SelectItem>))}
 </SelectContent>
 </Select>
 </div>

 {isAdmin && (
 <div className="space-y-1.5 pt-2 border-t border-slate-50">
 <Label className="text-xs font-bold text-primary uppercase pl-1 truncate whitespace-nowrap">Chức danh hệ thống (Admin)</Label>
 <Select value={newRole} onValueChange={setNewRole}>
 <SelectTrigger className="h-12 md:h-10 bg-primary/5 border-none rounded-xl font-bold text-primary text-base md:text-sm"><SelectValue /></SelectTrigger>
 <SelectContent className="rounded-xl border-none shadow-2xl">
 <SelectItem value="staff" className="text-base md:text-sm py-3 md:py-2">Cán bộ</SelectItem>
 <SelectItem value="manager" className="text-base md:text-sm py-3 md:py-2">Lãnh đạo phòng</SelectItem>
 <SelectItem value="director" className="text-base md:text-sm py-3 md:py-2">Ban giám đốc</SelectItem>
 <SelectItem value="admin" className="text-base md:text-sm py-3 md:py-2">Quản trị hệ thống</SelectItem>
 </SelectContent>
 </Select>
 </div>
 )}

 <Button onClick={handleUpdateProfile} disabled={updating || !newName.trim()} className="w-full bg-primary h-11 rounded-xl font-bold mt-2 shadow-lg shadow-primary/10">
 {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Lưu thay đổi"}
 </Button>
 </div>
 </DialogContent>
 </Dialog>
 </div>
 </div>
 </div>

 <div className="space-y-6">
 <h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 px-2 truncate whitespace-nowrap">
 <History className="w-3.5 h-3.5 text-primary" /> Hoạt động gần đây
 </h3>
 <div className="space-y-3">
 {activities.length > 0 ? activities.map((act) => (
 <div key={act.id} className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between group hover:border-primary/20 transition-all">
 <div className="flex items-center gap-4">
 <div className="p-2 bg-slate-50 rounded-xl group-hover:bg-primary/5 transition-colors"><CheckCircle2 className="w-4 h-4 text-emerald-500" /></div>
 <div className="space-y-0.5">
 <p className="text-sm font-bold text-slate-800">Phản hồi tại: <span className="text-primary">{act.task?.title}</span></p>
 <p className="text-xs text-slate-500 font-bold uppercase truncate whitespace-nowrap">{new Date(act.created_at).toLocaleString('vi-VN')}</p>
 </div>
 </div>
 </div>
 )) : (<div className="py-12 text-center text-slate-500 italic text-sm bg-white rounded-3xl border border-slate-100 border-dashed">Chưa có hoạt động.</div>)}
 </div>
 </div>
 </div>

 <div className="lg:col-span-4 space-y-6">
 <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
 <h3 className="text-xs font-bold text-slate-500 uppercase px-2 truncate whitespace-nowrap">Thông tin công tác</h3>
 <div className="space-y-4">
 <div className="space-y-1.5">
 <p className="text-xs font-bold text-slate-500 uppercase pl-1 truncate whitespace-nowrap">Email</p>
 <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 flex items-center gap-3">
 <Mail className="w-3.5 h-3.5 text-primary" /><span className="text-xs font-bold text-slate-900 truncate">{profile.email}</span>
 </div>
 </div>
 <div className="space-y-1.5">
 <p className="text-xs font-bold text-slate-500 uppercase pl-1 truncate whitespace-nowrap">Chức danh</p>
 <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 flex items-center gap-3">
 <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /><span className="text-xs font-bold text-slate-900">{roleLabels[profile.role] || "Cán bộ"}</span>
 </div>
 </div>
 </div>
 </div>
 </div>
 </div>
 </div>
 );
}
