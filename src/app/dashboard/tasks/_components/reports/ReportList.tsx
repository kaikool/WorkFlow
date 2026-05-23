'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Search, Filter, Loader2, Calendar, Zap, Users, FileText, ChevronDown, ChevronUp, Building2
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EmptyState } from '@/components/ui/empty-state'
import { ListSkeleton } from '@/components/ui/list-skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
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
          <EmptyState
            icon={<FileText className="icon-lg" />}
            title="Chưa có báo cáo nào"
            description="Báo cáo mới sẽ hiển thị tại đây."
            variant="default"
          />
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

          const isDeptAssigned = siblings.some(s => !s.assignee_id)

          return (
            <div
              key={task.id}
              className={cn(
                "premium-card p-5 space-y-4 relative transition-all duration-300",
                task.status === 'done' ? "opacity-75 bg-slate-50/50" : "hover:border-primary/20 hover:shadow-md"
              )}
            >
              <div className="flex justify-between items-start gap-4">
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {task.priority === 'high' && <Zap className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0" />}
                    <Link href={`/dashboard/tasks/${task.id}`} className={cn(
                      'font-bold text-[15px] sm:text-base line-clamp-2 leading-snug hover:text-primary transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/20 rounded-sm',
                      task.status === 'done' && 'text-slate-500 line-through decoration-slate-300'
                    )}>
                      {task.title}
                    </Link>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-slate-500">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Calendar className={cn("w-3.5 h-3.5", isLate && task.status !== 'done' && "text-red-500")} />
                      <span className={cn(isLate && task.status !== 'done' && 'text-red-600 font-bold')}>
                        {new Date(task.due_date).toLocaleDateString('vi-VN')}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-1.5 min-w-0">
                      {firstAssignee ? (
                        <>
                          <Avatar className="w-5 h-5 shrink-0">
                            <AvatarImage src={firstAssignee.avatar_url} />
                            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{firstAssignee.full_name?.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <span className="truncate">{firstAssignee.full_name}</span>
                        </>
                      ) : deptName ? (
                        <>
                          <Building2 className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="truncate">{deptName}</span>
                        </>
                      ) : (
                        <>
                          <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>Chưa giao</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`switch-${task.id}`} className="text-[13px] font-medium text-slate-600 cursor-pointer select-none">
                      Đã nộp
                    </Label>
                    <Switch 
                      id={`switch-${task.id}`}
                      checked={task.status === 'done'}
                      onCheckedChange={() => handleToggleStatus({ stopPropagation: () => {} } as any, task.id, task.status)}
                    />
                  </div>
                  {(isCreator || isAdminOrDir) && totalDepts > 0 && (
                    <span className="text-xs font-semibold text-slate-500">
                      {doneDepts}/{totalDepts} {isDeptAssigned ? 'phòng' : 'người'}
                    </span>
                  )}
                </div>
              </div>

              <DeadlineProgress
                compact
                createdAt={task.created_at}
                dueDate={task.due_date}
                done={task.status === 'done'}
                className="pt-1 max-w-[400px]"
              />
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
