'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Search, Filter, Loader2, Calendar, Zap, Users, FileText, ChevronDown, ChevronUp
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useRouter, useSearchParams } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'
import { cn, compareProfilesByHierarchy } from '@/lib/utils'
import { DeadlineProgress } from '../DeadlineProgress'

const STATUS_MAP: Record<string, { label: string; color: string; dot: string; light: string }> = {
  todo:   { label: 'Đang chờ',   color: 'text-muted-foreground', dot: 'bg-slate-400',  light: 'bg-muted'       },
  doing:  { label: 'Đang làm',   color: 'text-primary',          dot: 'bg-primary',    light: 'bg-primary/5'   },
  done:   { label: 'Hoàn thành', color: 'text-emerald-700',      dot: 'bg-emerald-500',light: 'bg-emerald-50'  },
  late:   { label: 'Trễ hạn',    color: 'text-red-600',          dot: 'bg-red-500',    light: 'bg-red-50'      },
}

interface ReportListProps {
  searchQuery: string
  filterStatus: string
}

export function ReportList({ searchQuery, filterStatus }: ReportListProps) {
  const [tasks,        setTasks]   = useState<any[]>([])
  const [loading,      setLoading] = useState(true)
  const [profile,      setProfile] = useState<any>(null)
  const [showAllReports, setShowAllReports] = useState(false)
  const supabase = createClient()
  const router   = useRouter()
  const { toast } = useToast()

  useEffect(() => { fetchReports() }, [])

  const fetchReports = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      let query = supabase
        .from('tasks')
        .select(`*, creator:profiles!tasks_created_by_fkey(full_name,avatar_url,department_id), department:departments(name), task_assignees(profile:profiles(id,full_name,avatar_url,role,is_department_head))`)
        .eq('task_type', 'report')

      if (user) {
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)
        if (p && p.role !== 'admin' && p.role !== 'director' && p.department_id) {
          query = query.or(`department_id.eq.${p.department_id},created_by.eq.${user.id},assignee_id.eq.${user.id}`)
        }
      }

      const { data } = await query.order('created_at', { ascending: false })
      setTasks(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleStatus = async (e: React.MouseEvent, taskId: string, currentStatus: string) => {
    e.stopPropagation()
    const newStatus = currentStatus === 'done' ? 'todo' : 'done'
    try {
      const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId)
      if (error) throw error
      setTasks(tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t))
      toast({ title: 'Cập nhật thành công', description: 'Đã thay đổi trạng thái báo cáo.' })
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Lỗi', description: err.message })
    }
  }

  // Lọc danh sách, bỏ bản sao (người tạo/admin thấy 1 đại diện mỗi nhóm)
  const allFiltered = tasks.filter(t => {
    if (filterStatus === 'all') {
      if (!searchQuery && t.status === 'done') return false
      if (t.is_archived) return false
    } else {
      if (t.status !== filterStatus) return false
    }
    return t.title.toLowerCase().includes(searchQuery.toLowerCase())
  })

  const seenKeys   = new Set<string>()
  const displayData = allFiltered.filter(t => {
    const isCreator    = t.created_by === profile?.id
    const isAdminOrDir = profile?.role === 'admin' || profile?.role === 'director'
    if (isCreator || isAdminOrDir) {
      const key = `${t.title}_${t.created_by}`
      if (seenKeys.has(key)) return false
      seenKeys.add(key)
    }
    return true
  })

  if (loading) {
    return <div className="flex h-96 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
  }

  return (
    <div className="space-y-6">
      {/* Danh sách báo cáo */}
      <div className="space-y-3">
        {displayData.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl border border-slate-100 shadow-sm">
            <FileText className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Chưa có báo cáo nào</p>
          </div>
        )}
        {(showAllReports ? displayData : displayData.slice(0, 5)).map(task => {
          const status        = STATUS_MAP[task.status] || STATUS_MAP.todo
          const isLate        = task.status !== 'done' && new Date(task.due_date) < new Date()
          const sortedAssignees = [...(task.task_assignees || [])].sort((a: any, b: any) => compareProfilesByHierarchy(a.profile, b.profile))
          const firstAssignee = sortedAssignees[0]?.profile
          const deptName      = task.department?.name

          // Tính số phòng đã nộp trong nhóm báo cáo này
          const siblings = tasks.filter(t => t.title === task.title && t.created_by === task.created_by)
          const totalDepts  = siblings.length
          const doneDepts   = siblings.filter(t => t.status === 'done').length
          const isCreator    = task.created_by === profile?.id
          const isAdminOrDir = profile?.role === 'admin' || profile?.role === 'director'

          return (
            <div
              key={task.id}
              className="premium-card p-6 flex items-center gap-4 cursor-pointer hover:bg-slate-50/50 transition-all"
              onClick={() => router.push(`/dashboard/tasks/${task.id}`)}
            >
              {/* Checkbox toggle nộp báo cáo */}
              <div
                className="flex items-center justify-center pt-1 self-start"
                onClick={e => handleToggleStatus(e, task.id, task.status)}
              >
                <Checkbox checked={task.status === 'done'} className="w-5 h-5 rounded-[6px]" />
              </div>

              <div className="flex-1 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  {task.priority === 'high' && <Zap className="w-3 h-3 text-red-500 fill-red-500 shrink-0" />}
                  <h3 className={cn('font-bold text-[15px] transition-colors', task.status === 'done' ? 'text-slate-500 line-through' : 'text-slate-900')}>
                    {task.title}
                  </h3>
                  {(isCreator || isAdminOrDir) && totalDepts > 0 && (
                    <Badge className={cn(
                      'border-none text-sm font-medium px-2 py-1 rounded-full shadow-sm select-none',
                      doneDepts === totalDepts
                        ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-50'
                        : 'bg-red-50 text-red-600 hover:bg-red-50'
                    )}>
                      {doneDepts}/{totalDepts} phòng
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-slate-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span className={cn(isLate && 'text-red-600 font-bold')}>
                      {new Date(task.due_date).toLocaleDateString('vi-VN')}
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {firstAssignee?.full_name || deptName || 'Chưa giao'}
                  </span>
                </div>
                <DeadlineProgress
                  compact
                  createdAt={task.created_at}
                  dueDate={task.due_date}
                  done={task.status === 'done'}
                  className="max-w-md pt-1"
                />
              </div>

              <div className="hidden sm:block shrink-0">
                <div className={cn('inline-flex items-center px-3 py-1 rounded-full text-xs font-medium', status.light, status.color)}>
                  <div className={cn('w-1 h-1 rounded-full mr-2 opacity-60', status.dot)} />
                  {status.label}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {displayData.length > 5 && (
        <div className="flex justify-center pt-2">
          <Button 
            variant="ghost" 
            onClick={() => setShowAllReports(!showAllReports)}
            className="text-sm font-medium text-primary hover:bg-primary/5 rounded-full px-6 py-2 flex items-center gap-1.5"
          >
            {showAllReports ? (
              <>Thu gọn <ChevronUp className="w-4 h-4" /></>
            ) : (
              <>Xem thêm {displayData.length - 5} báo cáo <ChevronDown className="w-4 h-4" /></>
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
