'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft, Plus, Loader2, CheckCircle2, ArrowRight, Calendar, Flag, Lock
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Calendar as CalendarPicker } from '@/components/ui/calendar'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import { useToast } from '@/hooks/use-toast'
import { createClient } from '@/utils/supabase/client'
import { cn, sortProfilesByHierarchy } from '@/lib/utils'
import Link from 'next/link'

export function NewTodoForm() {
  const router  = useRouter()
  const { toast } = useToast()
  const supabase  = createClient()

  const [loading,          setLoading]    = useState(false)
  const [isSuccess,        setIsSuccess]  = useState(false)
  const [profiles,         setProfiles]   = useState<any[]>([])
  const [creatorProfile,   setCreator]    = useState<any>(null)
  const [selectedAssignees, setAssignees] = useState<string[]>([])
  const [dueDate,          setDueDate]    = useState<Date | undefined>(new Date())

  const isStaff = creatorProfile?.role === 'staff'

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
    // Không đưa Ban giám đốc và Admin vào danh sách giao việc
    let filteredMembers = (members || []).filter((m: any) => m.role !== 'director' && m.role !== 'admin')
    
    setProfiles(sortProfilesByHierarchy(filteredMembers))
    setAssignees([user.id])
  }

  const toggleAssignee = (id: string) => {
    if (isStaff) return
    setAssignees(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id])
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (selectedAssignees.length === 0) {
      toast({ variant: 'destructive', title: 'Lỗi', description: 'Vui lòng chọn ít nhất một người xử lý.' })
      return
    }
    setLoading(true)
    const formData = new FormData(e.currentTarget)

    const firstAssignee = profiles.find(x => x.id === selectedAssignees[0])
    const targetDeptId  = firstAssignee?.department_id || creatorProfile?.department_id

    try {
      const { data: newTask, error: taskError } = await supabase.from('tasks').insert({
        title:       formData.get('title'),
        description: formData.get('description'),
        assignee_id: selectedAssignees[0],
        priority:    formData.get('priority') || 'medium',
        task_type:   formData.get('task_type') || 'regular',
        due_date:    dueDate?.toISOString(),
        created_by:  creatorProfile?.id,
        department_id: targetDeptId,
        status:      'todo',
        progress:    0,
      }).select().single()

      if (taskError) throw taskError

      await supabase.from('task_assignees').insert(
        selectedAssignees.map(userId => ({ task_id: newTask.id, user_id: userId }))
      )

      await supabase.from('notifications').insert(
        selectedAssignees.map(userId => ({
          user_id: userId,
          title:   'Bạn có công việc mới',
          content: `${creatorProfile?.full_name} đã giao cho bạn: ${formData.get('title')}`,
          link:    `/dashboard/tasks/${newTask.id}`,
        }))
      )

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
          <CheckCircle2 className="h-12 w-12" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-slate-900">Hoàn tất!</h2>
          <p className="text-slate-500 font-medium text-sm">Công việc đã được giao thành công.</p>
        </div>
        <div className="flex flex-col gap-2 pt-4">
          <Button asChild className="bg-primary hover:bg-primary/90 min-h-11 rounded-xl font-medium">
            <Link href="/dashboard/tasks">Về danh sách <ArrowRight className="ml-2 w-4 h-4" /></Link>
          </Button>
          <Button variant="ghost" onClick={() => setIsSuccess(false)} className="text-slate-500 font-medium min-h-11 rounded-xl hover:bg-slate-50">
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
              <Badge className="px-2.5 py-1 text-sm font-medium rounded-full border-none bg-primary text-white">
                Công việc
              </Badge>
            </div>
            <Input
              name="title"
              placeholder="Nhập tiêu đề công việc..."
              className="min-h-11 rounded-xl bg-slate-50 border-none shadow-none font-medium text-slate-900 text-base focus-visible:ring-0 placeholder:text-slate-500 px-4"
              required
            />
            <div className="bg-slate-50 p-4 rounded-xl space-y-2">
              <Label htmlFor="description" className="text-sm font-medium text-slate-500 truncate whitespace-nowrap">
                Mô tả chi tiết
              </Label>
              <Textarea
                name="description"
                rows={2}
                placeholder="Nhập nội dung mô tả kế hoạch..."
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
            {/* Người nhận */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-slate-500">Người nhận</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild disabled={isStaff}>
                  <Button variant="outline" className={cn(
                    'w-full h-auto min-h-[44px] rounded-xl border-none bg-slate-50 justify-between px-4 py-2 text-left font-bold text-slate-900 shadow-sm transition-all hover:bg-slate-100 active:scale-95',
                    isStaff && 'cursor-not-allowed opacity-80'
                  )}>
                    <div className="flex flex-wrap gap-1.5 overflow-hidden">
                      {selectedAssignees.length === 0
                        ? <span className="text-slate-400 font-normal">Chọn người nhận</span>
                        : selectedAssignees.map(id => profiles.find(p => p.id === id)).filter(Boolean).map(p => (
                            <Badge key={p.id} variant="secondary" className="bg-primary text-white border-none px-2.5 py-1 rounded-full flex items-center gap-1 shrink-0 text-sm font-medium whitespace-nowrap truncate">
                              {p.full_name}
                            </Badge>
                          ))
                      }
                    </div>
                    {isStaff ? <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" /> : <ChevronLeft className="w-4 h-4 text-slate-500 -rotate-90 shrink-0" />}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[300px] rounded-xl border border-slate-200 p-2 shadow-lg" align="end">
                  <ScrollArea className="h-[min(18rem,var(--radix-dropdown-menu-content-available-height))]">
                  <div className="space-y-1 p-1 pr-2">
                    {profiles.map(p => {
                      const checked = selectedAssignees.includes(p.id)
                      return (
                      <DropdownMenuCheckboxItem
                        key={p.id}
                        checked={checked}
                        onCheckedChange={() => toggleAssignee(p.id)}
                        onSelect={(event) => event.preventDefault()}
                        className="rounded-xl py-3 text-sm font-medium"
                      >
                        {p.full_name}
                      </DropdownMenuCheckboxItem>
                    )})}
                  </div>
                  </ScrollArea>
                </DropdownMenuContent>
              </DropdownMenu>
              {isStaff && <p className="text-xs text-slate-500 font-medium pl-1 italic">Bạn đang tự giao việc cho chính mình.</p>}
            </div>

            {/* Loại công việc */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-slate-500">Phân loại danh mục</Label>
              <Select name="task_type" defaultValue="regular">
                <SelectTrigger className="min-h-11 rounded-xl bg-slate-50 border-none font-medium text-slate-900 px-4 shadow-sm hover:bg-slate-100 transition-all">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border border-slate-200 shadow-lg">
                  <SelectItem value="regular" className="font-medium text-sm py-2">Công việc nghiệp vụ</SelectItem>
                  <SelectItem value="kpi"     className="font-medium text-sm py-2">Chỉ tiêu kinh doanh</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Hạn hoàn thành & Mức độ */}
            <div className="grid grid-cols-1 gap-6 pt-2 border-t border-slate-50">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-500">Hạn hoàn thành</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn('w-full h-11 rounded-xl bg-slate-50 border-none font-bold text-slate-900 justify-start px-4 shadow-sm active:scale-95 transition-all', !dueDate && 'text-muted-foreground')}>
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
                <Label className="text-sm font-medium text-slate-500">Mức độ ưu tiên</Label>
                <Select name="priority" defaultValue="medium">
                  <SelectTrigger className="min-h-11 rounded-xl bg-slate-50 border-none font-medium text-slate-900 px-4 shadow-sm">
                    <div className="flex items-center gap-2">
                      <Flag className="w-4 h-4 text-primary" />
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border border-slate-200 shadow-lg">
                    <SelectItem value="low"    className="font-medium text-sm py-2">Ưu tiên thấp</SelectItem>
                    <SelectItem value="medium" className="font-medium text-sm py-2 text-primary">Bình thường</SelectItem>
                    <SelectItem value="high"   className="font-medium text-sm py-2 text-red-600">Khẩn trương</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Nút submit */}
            <div className="pt-6 border-t border-slate-50 space-y-3">
              <Button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary/90 min-h-11 rounded-xl font-medium text-sm active:scale-95 transition-all">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (isStaff ? 'Tạo công việc' : 'Giao việc')}
              </Button>
              <Button type="button" variant="ghost" onClick={() => router.back()} className="text-slate-500 font-bold min-h-11 w-full rounded-xl hover:bg-slate-50 text-xs active:scale-95 transition-all">
                Hủy bỏ
              </Button>
            </div>
          </div>
        </div>
      </div>
    </form>
  )
}
