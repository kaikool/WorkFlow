'use client'

import React, { useState } from 'react'
import { Lock, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { notifyError, notifySuccess, notifyValidation } from '@/lib/notify'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

// Section đổi mật khẩu — dùng trong /dashboard/profile.
// Khi profile.must_change_password=true, section này hiển thị banner cảnh báo và
// tự cuộn tới form ngay khi mở trang.

interface Props {
  profileId: string | undefined;
  mustChange: boolean;
}

export default function ChangePasswordSection({ profileId, mustChange }: Props) {
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword.length < 6) {
      notifyValidation('Mật khẩu mới phải có tối thiểu 6 ký tự.', 'Mật khẩu quá ngắn')
      return
    }
    if (newPassword !== confirmPassword) {
      notifyValidation('Mật khẩu xác nhận không khớp với mật khẩu mới.', 'Không khớp')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error

      if (profileId) {
        await supabase.from('profiles').update({ must_change_password: false }).eq('id', profileId)
      }

      notifySuccess('Đã đổi mật khẩu')
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
      router.refresh()
    } catch (err) {
      notifyError(err, 'Không đổi được mật khẩu')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section id="change-password" className="card-base space-y-5 scroll-mt-20">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center">
          <Lock className="h-4 w-4 text-slate-600" />
        </div>
        <div>
          <h3 className="heading-section">Đổi mật khẩu</h3>
          <p className="text-meta">Bảo vệ tài khoản với mật khẩu mới</p>
        </div>
      </div>

      {mustChange && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-100">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-bold text-amber-800">Bạn đang dùng mật khẩu mặc định</p>
            <p className="text-xs font-medium text-amber-700">Vui lòng đặt mật khẩu cá nhân mới để bảo mật tài khoản.</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label className="text-label">Mật khẩu mới</Label>
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={6}
            required
            placeholder="Tối thiểu 6 ký tự"
            className="min-h-11 rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-label">Xác nhận mật khẩu mới</Label>
          <Input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={6}
            required
            placeholder="Nhập lại mật khẩu mới"
            className="min-h-11 rounded-xl"
          />
        </div>
        <Button
          type="submit"
          disabled={saving || !newPassword || !confirmPassword}
          className="min-h-11 rounded-xl bg-primary hover:bg-primary/90 text-white font-medium px-5 active:scale-95 transition-all"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
          Cập nhật mật khẩu
        </Button>
      </form>
    </section>
  )
}
