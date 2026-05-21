'use client'

import React, { useEffect, useState, useRef } from "react";
import {
  Mail,
  ShieldCheck,
  Camera,
  CheckCircle2,
  Loader2,
  Briefcase,
  LogOut,
  History,
  Phone,
  Calendar,
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
import { getProfileDisplayTitle, getProfileTitleBadgeClass, cn } from "@/lib/utils";

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
  const [newPhone, setNewPhone] = useState("");
  const [newBirthday, setNewBirthday] = useState("");

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
      setNewPhone(data.phone || "");
      setNewBirthday(data.birthday || "");
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
        department_id: newDept || null,
        phone: newPhone || null,
        birthday: newBirthday || null
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

  if (loading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  if (!profile) return null;

  const isAdmin = profile.role === 'admin';

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-6 md:space-y-10 animate-fade-in-up pb-20">
      {/* Header chuẩn theo MASTER.md */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-4 sm:pt-0">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900">Hồ sơ cá nhân</h1>
          <p className="text-[13px] text-slate-500 font-medium">Thông tin tài khoản và quá trình công tác</p>
        </div>
        <Button 
          variant="ghost" 
          onClick={async () => { await supabase.auth.signOut(); router.push('/login'); }} 
          className="rounded-xl px-5 font-medium text-red-500 transition-all hover:bg-red-50 hover:text-red-600 active:scale-95"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Đăng xuất
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-10">
        <div className="lg:col-span-8 space-y-6 md:space-y-10">
          
          {/* Card Hồ sơ */}
          <div className="premium-card p-6 border-none flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-10">
            <div
              className="relative group cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              role="button"
              tabIndex={0}
              aria-label="Cập nhật ảnh đại diện"
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
            >
              <Avatar className="h-28 w-28 sm:h-32 sm:w-32 shadow-sm transition-all group-hover:opacity-80">
                <AvatarImage src={profile.avatar_url} className="object-cover" />
                <AvatarFallback className="bg-slate-100 text-slate-600 text-3xl font-semibold tabular-nums">
                  {profile.full_name?.[0]}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                {uploading ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : <Camera className="w-6 h-6 text-white" />}
              </div>
              <Input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarUpload} disabled={uploading} />
            </div>
            
            <div className="space-y-6 flex-1 text-center sm:text-left min-w-0">
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <h2 className="text-[20px] font-bold text-slate-900 truncate w-full sm:w-auto">
                    {profile.full_name}
                  </h2>
                  <Badge className={cn("text-[11px] font-medium px-2.5 py-0.5 rounded-full shrink-0", getProfileTitleBadgeClass(profile))}>
                    {getProfileDisplayTitle(profile)}
                  </Badge>
                </div>
                <p className="text-slate-500 font-medium text-sm truncate">
                  {(profile.role === 'director' || profile.role === 'admin') ? "Quản trị & Điều hành" : (profile.departments?.name || "Chưa xác định phòng ban")}
                </p>
              </div>

              <div className="pt-2 flex justify-center sm:justify-start">
                <Dialog open={isUpdateOpen} onOpenChange={setIsUpdateOpen}>
                  <DialogTrigger asChild>
                    <Button className="rounded-xl bg-slate-900 px-5 font-medium text-white shadow-sm transition-all hover:bg-slate-800 active:scale-95">
                      Thiết lập hồ sơ
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-2xl border-none p-0 overflow-hidden max-w-sm shadow-2xl">
                    <div className="bg-slate-900 p-6 text-white">
                      <DialogTitle className="text-[17px] font-semibold">Cập nhật thông tin</DialogTitle>
                      <p className="text-[12px] font-medium opacity-80 mt-1">Hoàn thiện thông tin hệ thống</p>
                    </div>
                    <div className="p-6 space-y-5">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-slate-500 truncate">Họ và tên</Label>
                        <Input value={newName} onChange={(e) => setNewName(e.target.value)} className="h-10 bg-slate-50 border-none rounded-xl font-medium text-[14px]" />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-slate-500 truncate">Số điện thoại</Label>
                        <Input type="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} className="h-10 bg-slate-50 border-none rounded-xl font-medium text-[14px]" placeholder="VD: 0912345678" />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-slate-500 truncate">Ngày sinh</Label>
                        <Input type="date" value={newBirthday} onChange={(e) => setNewBirthday(e.target.value)} className="h-10 bg-slate-50 border-none rounded-xl font-medium text-[14px]" />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-slate-500 truncate">Phòng ban công tác</Label>
                        <Select value={newDept} onValueChange={setNewDept}>
                          <SelectTrigger className="h-10 bg-slate-50 border-none rounded-xl font-medium text-[14px]">
                            <SelectValue placeholder="Chọn phòng ban..." />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-none shadow-lg">
                            {departments.map((d) => (
                              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {isAdmin && (
                        <div className="space-y-2 pt-4 border-t border-slate-100">
                          <Label className="text-sm font-medium text-slate-700 truncate">Quyền hệ thống (Admin)</Label>
                          <Select value={newRole} onValueChange={setNewRole}>
                            <SelectTrigger className="h-10 bg-slate-50 border-none rounded-xl font-medium text-slate-900 text-[14px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-none shadow-lg">
                              <SelectItem value="staff">Cán bộ</SelectItem>
                              <SelectItem value="manager">Lãnh đạo phòng</SelectItem>
                              <SelectItem value="director">Ban giám đốc</SelectItem>
                              <SelectItem value="admin">Quản trị hệ thống</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <Button onClick={handleUpdateProfile} disabled={updating || !newName.trim()} className="w-full bg-slate-900 hover:bg-slate-800 text-white h-10 rounded-xl font-medium mt-4 shadow-sm active:scale-95 transition-all">
                        {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Lưu thay đổi"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>

          {/* Lịch sử hoạt động */}
          <div className="premium-card p-6 border-none space-y-6">
            <h3 className="text-sm font-medium text-slate-500 flex items-center gap-2 truncate">
              <History className="w-4 h-4 text-slate-400 shrink-0" /> Hoạt động gần đây
            </h3>
            <div className="space-y-3">
              {activities.length > 0 ? activities.map((act) => (
                <div key={act.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-4 group hover:bg-white hover:shadow-sm transition-all">
                  <div className="p-2 bg-white rounded-xl shadow-sm shrink-0">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <p className="text-[14px] font-medium text-slate-900 truncate">
                      Phản hồi tại: <span className="font-semibold text-slate-700">{act.task?.title}</span>
                    </p>
                    <p className="text-[12px] font-medium text-slate-500 truncate tabular-nums">
                      {new Date(act.created_at).toLocaleString('vi-VN')}
                    </p>
                  </div>
                </div>
              )) : (
                <div className="py-8 flex flex-col items-center justify-center text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                  <p className="text-[13px] font-medium text-slate-500">Chưa có hoạt động nào được ghi nhận.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Thông tin công tác */}
        <div className="lg:col-span-4 space-y-6">
          <div className="premium-card p-6 border-none space-y-6">
            <h3 className="text-sm font-medium text-slate-500 flex items-center gap-2 truncate">
              <Briefcase className="w-4 h-4 text-slate-400 shrink-0" /> Thông tin công tác
            </h3>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold text-slate-500 truncate">Email</p>
                <div className="px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-3 min-w-0">
                  <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-[14px] font-medium text-slate-900 truncate">{profile.email}</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold text-slate-500 truncate">Chức danh</p>
                <div className="px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-3 min-w-0">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-[14px] font-medium text-slate-900 truncate">{getProfileDisplayTitle(profile)}</span>
                </div>
              </div>
              
              {profile.phone && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold text-slate-500 truncate">Số điện thoại</p>
                  <div className="px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-3 min-w-0 group">
                    <Phone className="w-4 h-4 text-blue-500 shrink-0" />
                    <a href={`tel:${profile.phone}`} className="text-[14px] font-medium text-slate-900 truncate hover:text-blue-600 hover:underline">
                      {profile.phone}
                    </a>
                  </div>
                </div>
              )}

              {profile.birthday && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold text-slate-500 truncate">Ngày sinh</p>
                  <div className="px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-3 min-w-0">
                    <Calendar className="w-4 h-4 text-amber-500 shrink-0" />
                    <span className="text-[14px] font-medium text-slate-900 truncate">
                      {new Date(profile.birthday).toLocaleDateString('vi-VN')}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
