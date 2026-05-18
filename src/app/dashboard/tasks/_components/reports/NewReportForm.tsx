'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft, Loader2, CheckCircle2, ArrowRight, Calendar, Flag, Check, Building2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { Calendar as CalendarPicker } from '@/components/ui/calendar'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import { useToast } from '@/hooks/use-toast'
import { createClient } from '@/utils/supabase/client'
import { cn } from '@/lib/utils'
import Link from 'next/link'

export function NewReportForm() {
  const router  = useRouter()
  const { toast } = useToast()
  const supabase  = createClient()

  const [loading,        setLoading]    = useState(false)
  const [isSuccess,      setIsSuccess]  = useState(false)
  const [profiles,       setProfiles]   = useState<any[]>([])
  const [departments,    setDepts]      = useState<any[]>([])
  const [creatorProfile, setCreator]    = useState<any>(null)
  const [assignType,     setAssignType] = useState<'profile' | 'department'>('department')
  const [selectedAssignees,   setAssignees]  = useState<string[]>([])
  const [selectedDepartments, setSelDepts]   = useState<string[]>([])
  const [dueDate,        setDueDate]    = useState<Date | undefined>(new Date())
  const [reminders,      setReminders]  = useState<string[]>([])

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setCreator(p)

    let query = supabase.from('profiles').select('*')
    if (p && p.role !== 'admin' && p.role !== 'director' && p.department_id) {
      query = query.eq('department_id', p.department_id)
    }
    const { data: members } = await query.order('full_name')
    setProfiles((members || []).filter((m: any) => m.role !== 'director' && m.role !== 'admin'))

    const { data: depts } = await supabase.from('departments').select('*').order('name')
    setDepts(depts || [])
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.currentTarget)

    try {
      if (assignType === 'department') {
        // Gửi tới từng phòng ban, tự tìm trưởng phòng làm người tiếp nhận
        if (selectedDepartments.length === 0) {
          toast({ variant: 'destructive', title: 'Lỗi', description: 'Vui lòng chọn ít nhất một phòng ban nhận báo cáo.' })
          setLoading(false); return
        }

        const { data: managers, error: mgrError } = await supabase.from('profiles')
          .select('id, department_id, full_name')
          .in('department_id', selectedDepartments)
          .eq('role', 'manager')
        if (mgrError) throw mgrError

        const missingDepts = selectedDepartments.filter(id => !managers?.some((m: any) => m.department_id === id))
        if (missingDepts.length > 0) {
          const names = missingDepts.map(id => departments.find(d => d.id === id)?.name).join(', ')
          toast({ variant: 'destructive', title: 'Lỗi', description: `Các phòng sau chưa có Trưởng phòng: ${names}` })
          setLoading(false); return
        }

        for (const deptId of selectedDepartments) {
          // Lấy TẤT CẢ các LĐP của phòng này
          const deptManagers = managers!.filter((m: any) => m.department_id === deptId)

          const { data: newTask, error: taskError } = await supabase.from('tasks').insert({
            title:       formData.get('title'),
            description: formData.get('description'),
            assignee_id: null, // Bỏ trống người nhận cụ thể để phòng tự xử lý
            priority:    formData.get('priority') || 'medium',
            task_type:   'report',
            due_date:    dueDate?.toISOString(),
            created_by:  creatorProfile?.id,
            department_id: deptId,
            status:      'todo',
            progress:    0,
            metadata:    { reminders },
          }).select().single()
          if (taskError) throw taskError

          // Gửi chuông thông báo cho TẤT CẢ Lãnh đạo phòng
          const notifications = deptManagers.map((m: any) => ({
            user_id: m.id,
            title:   'Phòng có yêu cầu báo cáo mới',
            content: `${creatorProfile?.full_name} đã yêu cầu báo cáo: ${formData.get('title')}`,
            link:    `/dashboard/tasks/${newTask.id}`,
          }))
          
          if (notifications.length > 0) {
            await supabase.from('notifications').insert(notifications)
          }
        }
      } else {
        // Gửi tới cán bộ cụ thể
        if (selectedAssignees.length === 0) {
          toast({ variant: 'destructive', title: 'Lỗi', description: 'Vui lòng chọn ít nhất một người nhận.' })
          setLoading(false); return
        }
        const firstAssignee = profiles.find(x => x.id === selectedAssignees[0])
        const targetDeptId  = firstAssignee?.department_id || creatorProfile?.department_id

        const { data: newTask, error: taskError } = await supabase.from('tasks').insert({
          title:       formData.get('title'),
          description: formData.get('description'),
          assignee_id: selectedAssignees[0],
          priority:    formData.get('priority') || 'medium',
          task_type:   'report',
          due_date:    dueDate?.toISOString(),
          created_by:  creatorProfile?.id,
          department_id: targetDeptId,
          status:      'todo',
          progress:    0,
          metadata:    { reminders },
        }).select().single()
        if (taskError) throw taskError

        await supabase.from('task_assignees').insert(
          selectedAssignees.map(userId => ({ task_id: newTask.id, user_id: userId }))
        )
        await supabase.from('notifications').insert(
          selectedAssignees.map(userId => ({
            user_id: userId,
            title:   'Bạn có yêu cầu báo cáo mới',
            content: `${creatorProfile?.full_name} đã giao cho bạn: ${formData.get('title')}`,
            link:    `/dashboard/tasks/${newTask.id}`,
          }))
        )
      }

      setIsSuccess(true)
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Lỗi', description: err.message })
    } finally {
      setLoading(false)
    }
  }

  if (isSuccess) {
    return (
      <div className="max-w-md mx-auto py-24 text-center space-y-6 animate-in zoom-in duration-500">
        <div className="inline-flex items-center justify-center bg-emerald-50 text-emerald-600 p-6 rounded-full">
          <CheckCircle2 className="w-12 h-12" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-slate-900 tracking-tight">Hoàn tất!</h2>
          <p className="text-slate-500 font-medium text-sm">Yêu cầu báo cáo đã được gửi thành công.</p>
        </div>
        <div className="flex flex-col gap-2 pt-4">
          <Button asChild className="bg-primary hover:bg-primary/90 h-10 rounded-xl font-medium">
            <Link href="/dashboard/tasks">Về danh sách <ArrowRight className="ml-2 w-4 h-4" /></Link>
          </Button>
          <Button variant="ghost" onClick={() => setIsSuccess(false)} className="text-slate-500 font-medium h-10 rounded-xl hover:bg-slate-50">
            Tạo thêm
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Cột nội dung chính */}
        <div className="lg:col-span-8 space-y-6">
          <div className="premium-card p-6 border-none space-y-4">
            <div className="flex items-center gap-2">
              <Badge className="px-2 py-0.5 text-[11px] font-medium rounded-md border-none bg-slate-900 text-white">
                Yêu cầu báo cáo
              </Badge>
            </div>
            <Input
              name="title"
              placeholder="Nhập tên báo cáo yêu cầu..."
              className="h-14 rounded-xl bg-slate-50 border-none shadow-none font-semibold text-slate-900 text-xl focus-visible:ring-0 placeholder:text-slate-500 px-4"
              required
            />
            <div className="bg-slate-50 p-4 rounded-xl space-y-2">
              <Label htmlFor="description" className="text-xs font-bold text-slate-500 uppercase truncate whitespace-nowrap">
                Nội dung báo cáo chi tiết
              </Label>
              <Textarea
                name="description"
                rows={2}
                placeholder="Nhập hướng dẫn, yêu cầu của báo cáo..."
                className="min-h-[60px] bg-transparent border-none text-slate-600 font-medium p-0 focus-visible:ring-0 resize-none leading-relaxed text-base md:text-sm overflow-hidden"
                onInput={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                  e.target.style.height = 'auto'
                  e.target.style.height = `${e.target.scrollHeight}px`
                }}
              />
            </div>
          </div>
        </div>

        {/* Cột sidebar */}
        <div className="lg:col-span-4 space-y-6">
          <div className="premium-card p-6 border-none space-y-6">
            {/* Phòng nhận / Cán bộ nhận */}
            <div className="space-y-3">
              <Label className="text-[13px] font-medium text-slate-500">Người / Phòng nhận</Label>
              <Tabs value={assignType} onValueChange={(v: any) => setAssignType(v)} className="w-full mb-3">
                <TabsList className="grid w-full grid-cols-2 h-9 p-1 bg-slate-100 rounded-lg">
                  <TabsTrigger value="profile"    className="rounded-md text-[11px] font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm">Cán bộ</TabsTrigger>
                  <TabsTrigger value="department" className="rounded-md text-[11px] font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm">Phòng ban</TabsTrigger>
                </TabsList>
              </Tabs>

              {assignType === 'profile' ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full h-auto min-h-[44px] rounded-xl border-none bg-slate-50 justify-between px-4 py-2 text-left font-bold text-slate-900 shadow-sm transition-all hover:bg-slate-100">
                      <div className="flex flex-wrap gap-1.5 overflow-hidden">
                        {selectedAssignees.length === 0
                          ? <span className="text-slate-400 font-normal">Chọn người nhận</span>
                          : selectedAssignees.map(id => profiles.find(p => p.id === id)).filter(Boolean).map(p => (
                              <Badge key={p.id} variant="secondary" className="bg-primary text-white border-none px-2 py-0.5 rounded-md text-[12px] font-medium whitespace-nowrap truncate">
                                {p.full_name}
                              </Badge>
                            ))
                        }
                      </div>
                      <ChevronLeft className="w-4 h-4 text-slate-500 -rotate-90 shrink-0" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-2 rounded-xl border border-slate-200 shadow-lg" align="end">
                    <div className="max-h-[300px] overflow-y-auto space-y-1 p-1">
                      {profiles.map(p => (
                        <div
                          key={p.id}
                          onClick={() => setAssignees(prev => prev.includes(p.id) ? prev.filter(a => a !== p.id) : [...prev, p.id])}
                          className={cn('flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all', selectedAssignees.includes(p.id) ? 'bg-primary/5 text-primary' : 'hover:bg-slate-50')}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn('w-4 h-4 rounded-md border flex items-center justify-center transition-all', selectedAssignees.includes(p.id) ? 'bg-primary border-primary' : 'border-slate-300')}>
                              {selectedAssignees.includes(p.id) && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <span className="text-xs font-bold">{p.full_name}</span>
                          </div>
                          {p.role === 'manager' && <Badge className="text-[11px] bg-amber-50 text-amber-600 border-none px-1.5 font-medium">Lãnh đạo</Badge>}
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              ) : (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full h-auto min-h-[44px] rounded-xl border-none bg-slate-50 justify-between px-4 py-2 text-left font-bold text-slate-900 shadow-sm transition-all hover:bg-slate-100">
                      <div className="flex flex-wrap gap-1.5 overflow-hidden">
                        {selectedDepartments.length === 0
                          ? <span className="text-slate-400 font-normal">Chọn các phòng ban...</span>
                          : selectedDepartments.map(id => departments.find(d => d.id === id)).filter(Boolean).map(d => (
                              <Badge key={d.id} variant="secondary" className="bg-primary text-white border-none px-2 py-0.5 rounded-md text-[12px] font-medium whitespace-nowrap truncate">
                                {d.name}
                              </Badge>
                            ))
                        }
                      </div>
                      <Building2 className="w-4 h-4 text-slate-500 shrink-0" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-2 rounded-xl border border-slate-200 shadow-lg" align="end">
                    <div className="max-h-[300px] overflow-y-auto space-y-1 p-1">
                      {departments.map(d => (
                        <div
                          key={d.id}
                          onClick={() => setSelDepts(prev => prev.includes(d.id) ? prev.filter(x => x !== d.id) : [...prev, d.id])}
                          className={cn('flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all', selectedDepartments.includes(d.id) ? 'bg-primary/5 text-primary' : 'hover:bg-slate-50')}
                        >
                          <div className={cn('w-4 h-4 rounded-md border flex items-center justify-center transition-all', selectedDepartments.includes(d.id) ? 'bg-primary border-primary' : 'border-slate-300')}>
                            {selectedDepartments.includes(d.id) && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <span className="text-xs font-bold">{d.name}</span>
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>

            {/* Hạn hoàn thành & Mức độ */}
            <div className="grid grid-cols-1 gap-6 pt-2 border-t border-slate-50">
              <div className="space-y-2">
                <Label className="text-[13px] font-medium text-slate-500">Hạn hoàn thành</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn('w-full h-11 rounded-xl bg-slate-50 border-none font-bold text-slate-900 justify-start px-4 shadow-sm', !dueDate && 'text-muted-foreground')}>
                      <Calendar className="mr-2 h-4 w-4 text-primary" />
                      {dueDate ? format(dueDate, 'dd/MM/yyyy') : <span>Chọn ngày</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 rounded-xl border border-slate-200 shadow-lg" align="start">
                    <CalendarPicker mode="single" selected={dueDate} onSelect={setDueDate} initialFocus locale={vi} />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label className="text-[13px] font-medium text-slate-500">Mức độ ưu tiên</Label>
                <Select name="priority" defaultValue="medium">
                  <SelectTrigger className="h-10 rounded-xl bg-slate-50 border-none font-medium text-slate-900 px-4 shadow-sm">
                    <div className="flex items-center gap-2">
                      <Flag className="w-4 h-4 text-primary" />
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border border-slate-200 shadow-lg">
                    <SelectItem value="low"    className="font-medium text-[13px] py-2">Ưu tiên thấp</SelectItem>
                    <SelectItem value="medium" className="font-medium text-[13px] py-2 text-primary">Bình thường</SelectItem>
                    <SelectItem value="high"   className="font-medium text-[13px] py-2 text-red-600">Khẩn trương</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Nhắc nhở tự động */}
            <div className="space-y-3 pt-4 border-t border-slate-50">
              <Label className="text-[13px] font-medium text-slate-500">Cài đặt nhắc nhở tự động</Label>
              <div className="flex flex-col gap-3">
                {[
                  { value: '1d', label: 'Nhắc trước 1 ngày' },
                  { value: '2h', label: 'Nhắc trước 2 giờ'  },
                ].map(opt => (
                  <label key={opt.value} className="flex items-center gap-3 cursor-pointer group">
                    <Checkbox
                      checked={reminders.includes(opt.value)}
                      onCheckedChange={c => setReminders(prev => c ? [...prev, opt.value] : prev.filter(x => x !== opt.value))}
                      className="rounded-[6px] data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                    />
                    <span className="text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Nút submit */}
            <div className="pt-6 border-t border-slate-50 space-y-3">
              <Button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary/90 h-10 rounded-xl font-medium text-[14px]">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Gửi yêu cầu báo cáo'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => router.back()} className="text-slate-500 font-bold h-10 w-full rounded-xl hover:bg-slate-50 text-xs">
                Hủy bỏ
              </Button>
            </div>
          </div>
        </div>
      </div>
    </form>
  )
}
