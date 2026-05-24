'use client'

import React, { useEffect, useMemo, useState } from "react";
import { Save, Camera, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import AvatarCropDialog from "@/components/ui/avatar-crop-dialog";
import { createClient } from "@/utils/supabase/client";
import { notifyError, notifySuccess, notifyValidation } from "@/lib/notify";

// Form sửa hồ sơ — 2 mode:
//  - Self: chỉnh phone, extension, seat_location, avatar_url, birthday, gender, birthday_notify_optout.
//  - Admin/HR: thêm full_name, title, department_id, role, is_department_head,
//              branch_join_date, ad_account, employee_code.
// Validation: phone VN, extension 3-6 ký tự số.
// Avatar upload đi qua AvatarCropDialog để user căn khung mặt.
interface EditProfileDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  target: any;
  viewer: any;
  onSaved?: () => void;
}

const PHONE_VN_RE = /^(0|\+?84)(\d){9}$/;
const EXTENSION_RE = /^\d{3,6}$/;

export default function EditProfileDialog({ open, onOpenChange, target, viewer, onSaved }: EditProfileDialogProps) {
  const supabase = useMemo(() => createClient(), []);
  const isAdminMode = viewer && ['admin', 'hr_officer'].includes(viewer.role);
  const [departments, setDepartments] = useState<any[]>([]);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropOpen, setCropOpen] = useState(false);

  useEffect(() => {
    if (!open || !target) return;
    setForm({
      full_name: target.full_name ?? '',
      phone: target.phone ?? '',
      extension: target.extension ?? '',
      seat_location: target.seat_location ?? '',
      avatar_url: target.avatar_url ?? '',
      title: target.title ?? '',
      department_id: target.department_id ?? '',
      role: target.role ?? 'staff',
      is_department_head: !!target.is_department_head,
      branch_join_date: target.branch_join_date ? target.branch_join_date.slice(0, 10) : '',
      birthday: target.birthday ? target.birthday.slice(0, 10) : '',
      gender: target.gender ?? '',
      ad_account: target.ad_account ?? '',
      employee_code: target.employee_code ?? '',
      birthday_notify_optout: !!target.birthday_notify_optout,
    });
  }, [open, target]);

  useEffect(() => {
    if (!isAdminMode || !open) return;
    supabase.from('departments').select('id, name, code').order('name').then((res: any) => {
      setDepartments(res.data ?? []);
    });
  }, [isAdminMode, open, supabase]);

  const setField = (k: string, v: any) => setForm((s: any) => ({ ...s, [k]: v }));

  const handleAvatarPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setCropFile(file);
    setCropOpen(true);
  };

  const handleCroppedUpload = async (blob: Blob) => {
    if (!target?.id) return;
    setUploadingAvatar(true);
    try {
      const path = `${target.id}/${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, blob, {
        upsert: true,
        contentType: 'image/jpeg',
      });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      // Bust cache để hiện ngay ảnh mới (Supabase CDN giữ public URL cố định)
      const busted = `${data.publicUrl}?v=${Date.now()}`;
      setField('avatar_url', busted);
      notifySuccess("Đã cập nhật ảnh đại diện");
    } catch (error) {
      notifyError(error, "Không tải được ảnh");
    } finally {
      setUploadingAvatar(false);
      setCropFile(null);
    }
  };

  const submit = async () => {
    if (form.phone && !PHONE_VN_RE.test(form.phone)) { notifyValidation("Số điện thoại không hợp lệ"); return; }
    if (form.extension && !EXTENSION_RE.test(form.extension)) { notifyValidation("Số nội bộ 3-6 chữ số"); return; }
    if (isAdminMode && !form.full_name?.trim()) { notifyValidation("Họ tên không được trống"); return; }

    setSaving(true);
    try {
      const payload: any = {
        phone: form.phone || null,
        extension: form.extension || null,
        seat_location: form.seat_location || null,
        avatar_url: form.avatar_url || null,
        birthday: form.birthday || null,
        gender: form.gender || null,
        birthday_notify_optout: !!form.birthday_notify_optout,
      };

      if (isAdminMode) {
        payload.full_name = form.full_name.trim();
        payload.title = form.title || null;
        payload.department_id = form.department_id || null;
        payload.is_department_head = !!form.is_department_head;
        payload.branch_join_date = form.branch_join_date || null;
        payload.ad_account = form.ad_account || null;
        payload.employee_code = form.employee_code || null;
        // Chỉ admin được sửa role (hr_officer không leo quyền)
        if (viewer.role === 'admin') payload.role = form.role;
      }

      const { error } = await supabase.from('profiles').update(payload).eq('id', target.id);
      if (error) throw error;
      notifySuccess("Đã lưu hồ sơ");
      onSaved?.();
      onOpenChange(false);
    } catch (error) {
      notifyError(error, "Không lưu được hồ sơ");
    } finally {
      setSaving(false);
    }
  };

  if (!target) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="app-dialog-sheet app-dialog-sheet--xl">
          <DialogHeader className="app-dialog-sheet-header">
            <DialogTitle className="heading-section">Sửa hồ sơ</DialogTitle>
          </DialogHeader>

          <ScrollArea className="app-dialog-sheet-body">
            <div className="px-[var(--app-page-x)] py-4 group-stack">
              {/* Avatar — hover overlay đồng nhất với trang Profile */}
              <div className="item-stack !gap-2">
                <Label className="text-label">Ảnh đại diện</Label>
                <div className="flex items-center gap-4">
                  <label
                    className="relative group cursor-pointer shrink-0 focus-within:outline-none"
                    aria-label="Chọn ảnh đại diện"
                  >
                    <Avatar className="h-16 w-16 ring-2 ring-slate-100 shadow-sm">
                      <AvatarImage src={form.avatar_url} />
                      <AvatarFallback className="bg-primary text-white text-xl font-bold">
                        {form.full_name?.[0] ?? '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                      {uploadingAvatar ? <Loader2 className="icon-sm text-white animate-spin" /> : <Camera className="icon-sm text-white" />}
                    </div>
                    <input type="file" accept="image/*" className="hidden" onChange={handleAvatarPicked} disabled={uploadingAvatar} />
                  </label>
                  <div className="item-stack !gap-1 min-w-0">
                    <p className="text-label !text-slate-900 font-semibold">Chọn ảnh từ thiết bị</p>
                    <p className="text-meta">Bạn sẽ căn khung mặt sau khi chọn ảnh</p>
                  </div>
                </div>
              </div>

              {isAdminMode && (
                <div className="item-stack !gap-2">
                  <Label className="text-label">Họ và tên</Label>
                  <Input value={form.full_name} onChange={(e) => setField('full_name', e.target.value)} className="min-h-11 rounded-xl" />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="item-stack !gap-2">
                  <Label className="text-label">Số điện thoại</Label>
                  <Input value={form.phone} onChange={(e) => setField('phone', e.target.value)} placeholder="09xx…" className="min-h-11 rounded-xl" />
                </div>
                <div className="item-stack !gap-2">
                  <Label className="text-label">Số nội bộ</Label>
                  <Input value={form.extension} onChange={(e) => setField('extension', e.target.value)} placeholder="1234" className="min-h-11 rounded-xl" />
                </div>
              </div>

              <div className="item-stack !gap-2">
                <Label className="text-label">Vị trí chỗ ngồi</Label>
                <Input value={form.seat_location} onChange={(e) => setField('seat_location', e.target.value)} placeholder="Tầng 2 — bàn 12" className="min-h-11 rounded-xl" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="item-stack !gap-2">
                  <Label className="text-label">Ngày sinh</Label>
                  <Input type="date" value={form.birthday} onChange={(e) => setField('birthday', e.target.value)} className="min-h-11 rounded-xl" />
                </div>
                <div className="item-stack !gap-2">
                  <Label className="text-label">Giới tính</Label>
                  <Select value={form.gender} onValueChange={(v) => setField('gender', v)}>
                    <SelectTrigger className="min-h-11 rounded-xl"><SelectValue placeholder="Chọn" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Nam</SelectItem>
                      <SelectItem value="female">Nữ</SelectItem>
                      <SelectItem value="other">Khác</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {isAdminMode && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="item-stack !gap-2">
                      <Label className="text-label">Chức danh</Label>
                      <Input value={form.title} onChange={(e) => setField('title', e.target.value)} className="min-h-11 rounded-xl" />
                    </div>
                    <div className="item-stack !gap-2">
                      <Label className="text-label">Mã CBNV</Label>
                      <Input value={form.employee_code} onChange={(e) => setField('employee_code', e.target.value)} className="min-h-11 rounded-xl" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="item-stack !gap-2">
                      <Label className="text-label">Phòng ban</Label>
                      <Select value={form.department_id} onValueChange={(v) => setField('department_id', v)}>
                        <SelectTrigger className="min-h-11 rounded-xl"><SelectValue placeholder="Chọn phòng" /></SelectTrigger>
                        <SelectContent>
                          {departments.map((d) => (<SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    {viewer.role === 'admin' && (
                      <div className="item-stack !gap-2">
                        <Label className="text-label">Phân quyền</Label>
                        <Select value={form.role} onValueChange={(v) => setField('role', v)}>
                          <SelectTrigger className="min-h-11 rounded-xl"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Quản trị</SelectItem>
                            <SelectItem value="director">Giám đốc</SelectItem>
                            <SelectItem value="manager">Lãnh đạo</SelectItem>
                            <SelectItem value="staff">Cán bộ</SelectItem>
                            <SelectItem value="secretary">Lễ tân</SelectItem>
                            <SelectItem value="hr_officer">Cán bộ Nhân sự</SelectItem>
                            <SelectItem value="driver">Lái xe</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-3 border border-slate-100">
                    <Label className="text-label !text-slate-900 font-semibold !mb-0">Là trưởng phòng</Label>
                    <Switch checked={form.is_department_head} onCheckedChange={(v) => setField('is_department_head', v)} />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="item-stack !gap-2">
                      <Label className="text-label">Ngày vào chi nhánh</Label>
                      <Input type="date" value={form.branch_join_date} onChange={(e) => setField('branch_join_date', e.target.value)} className="min-h-11 rounded-xl" />
                    </div>
                    <div className="item-stack !gap-2">
                      <Label className="text-label">AD account</Label>
                      <Input value={form.ad_account} onChange={(e) => setField('ad_account', e.target.value)} className="min-h-11 rounded-xl" />
                    </div>
                  </div>
                </>
              )}

              <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-3 border border-slate-100">
                <div className="min-w-0 item-stack !gap-1">
                  <p className="text-label !text-slate-900 font-semibold">Nhận lời chúc sinh nhật</p>
                  <p className="text-meta">Đồng nghiệp được thông báo khi sinh nhật bạn đến</p>
                </div>
                <Switch
                  checked={!form.birthday_notify_optout}
                  onCheckedChange={(v) => setField('birthday_notify_optout', !v)}
                />
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="app-dialog-sheet-footer flex-row gap-2">
            <Button variant="outline" className="flex-1 min-h-11 rounded-xl" onClick={() => onOpenChange(false)} disabled={saving}>Huỷ</Button>
            <Button onClick={submit} disabled={saving} className="flex-1 min-h-11 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold">
              <Save className="icon-sm mr-1.5" /> {saving ? "Đang lưu…" : "Lưu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AvatarCropDialog
        open={cropOpen}
        onOpenChange={setCropOpen}
        file={cropFile}
        onCropped={handleCroppedUpload}
      />
    </>
  );
}
