'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Search, Filter, Loader2, Calendar, Zap, Users, ChevronDown, ChevronUp
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { cn, compareProfilesByHierarchy } from '@/lib/utils'

const STATUS_MAP: Record<string, { label: string; color: string; dot: string; light: string }> = {
  todo:   { label: 'Đang chờ',   color: 'text-muted-foreground', dot: 'bg-slate-400',  light: 'bg-muted'       },
  doing:  { label: 'Đang làm',   color: 'text-primary',          dot: 'bg-primary',    light: 'bg-primary/5'   },
  done:   { label: 'Hoàn thành', color: 'text-emerald-700',      dot: 'bg-emerald-500',light: 'bg-emerald-50'  },
  late:   { label: 'Trễ hạn',    color: 'text-red-600',          dot: 'bg-red-500',    light: 'bg-red-50'      },
}

interface TodoListProps {
  searchQuery: string
  filterStatus: string
}

export function TodoList({ searchQuery, filterStatus }: TodoListProps) {
  const [tasks,        setTasks]       = useState<any[]>([])
  const [loading,      setLoading]     = useState(true)
  const [profile,      setProfile]     = useState<any>(null)
  const [showAllTasks, setShowAllTasks] = useState(false)
  const supabase = createClient()
  const router   = useRouter()

  useEffect(() => { fetchTasks() }, [])

  const fetchTasks = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      let query = supabase
        .from('tasks')
        .select(`*, creator:profiles!tasks_created_by_fkey(full_name,avatar_url,department_id), department:departments(name), task_assignees(profile:profiles(id,full_name,avatar_url,role,is_department_head))`)
        // Chỉ lấy công việc, loại trừ báo cáo
        .neq('task_type', 'report')

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

  const displayData = tasks.filter(t => {
    if (filterStatus === 'all') {
      if (!searchQuery && t.status === 'done') return false
      if (t.is_archived) return false
    } else {
      if (t.status !== filterStatus) return false
    }
    return t.title.toLowerCase().includes(searchQuery.toLowerCase())
  })

  if (loading) {
    return <div className="flex h-96 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
  }

  return (
    <div className="space-y-6">
      {/* Mobile card view */}
      <div className="block sm:hidden space-y-4">
        {(showAllTasks ? displayData : displayData.slice(0, 5)).map(task => {
          const status       = STATUS_MAP[task.status] || STATUS_MAP.todo
          const sortedAssignees = [...(task.task_assignees || [])].sort((a: any, b: any) => compareProfilesByHierarchy(a.profile, b.profile))
          const firstAssignee = sortedAssignees[0]?.profile
          const otherCount   = sortedAssignees.length - 1
          return (
            <Link
              key={task.id}
              href={`/dashboard/tasks/${task.id}`}
              className="premium-card p-6 space-y-4 active:scale-[0.98] transition-transform block outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            >
              <div className="flex justify-between items-start gap-4">
                <div className="space-y-1 flex-1">
                  <h3 className="font-bold text-slate-900 text-[15px] line-clamp-2 leading-snug">{task.title}</h3>
                  <div className="flex items-center gap-2 text-[12px] font-medium text-slate-500 truncate whitespace-nowrap">
                    <Calendar className="w-3 h-3" />
                    {new Date(task.due_date).toLocaleDateString('vi-VN')}
                  </div>
                </div>
                <Badge className={cn('border-none px-2.5 py-1 text-[12px] font-medium shrink-0 whitespace-nowrap', status.light, status.color)}>
                  {status.label}
                </Badge>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {sortedAssignees.slice(0, 3).map((a: any, i: number) => (
                        <Avatar key={i} className="h-6 w-6 border-2 border-white shadow-sm">
                          <AvatarImage src={a.profile?.avatar_url} className="object-cover" />
                          <AvatarFallback className="bg-primary text-white text-sm font-medium">{a.profile?.full_name?.[0]}</AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                    <span className="text-sm font-medium text-slate-600">
                      {firstAssignee?.full_name} {otherCount > 0 && `+${otherCount}`}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-primary">{task.progress}%</span>
                </div>
                <Progress value={task.progress} className="h-1.5 bg-slate-100" />
              </div>
            </Link>
          )
        })}
      </div>

      {/* Desktop table view */}
      <div className="hidden sm:block premium-card border-none overflow-hidden p-0 rounded-[2rem]">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/50 hover:bg-slate-50/50 border-b border-slate-100 h-14">
              <TableHead className="w-[350px] font-medium text-xs text-slate-500 pl-8">Hồ sơ công việc</TableHead>
              <TableHead className="w-[140px] font-medium text-xs text-slate-500">Trạng thái</TableHead>
              <TableHead className="w-[120px] font-medium text-xs text-slate-500 text-center">Tiến độ</TableHead>
              <TableHead className="font-medium text-xs text-slate-500">Người xử lý</TableHead>
              <TableHead className="w-[140px] font-medium text-xs text-slate-500 text-right pr-8">Hạn cuối</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(showAllTasks ? displayData : displayData.slice(0, 5)).map(task => {
              const status        = STATUS_MAP[task.status] || STATUS_MAP.todo
              const isLate        = task.status !== 'done' && new Date(task.due_date) < new Date()
              const sortedAssignees = [...(task.task_assignees || [])].sort((a: any, b: any) => compareProfilesByHierarchy(a.profile, b.profile))
              const firstAssignee = sortedAssignees[0]?.profile
              const otherCount    = sortedAssignees.length - 1
              return (
                <TableRow
                  key={task.id}
                  className="group hover:bg-slate-50/80 transition-all border-b border-slate-50/80 h-20"
                >
                  <TableCell className="pl-8 py-4 relative">
                    <div className="flex items-center gap-3">
                      {task.priority === 'high' && (
                        <div className="p-1.5 bg-red-50 rounded-lg shrink-0">
                          <Zap className="w-3 h-3 text-red-500 fill-red-500" />
                        </div>
                      )}
                      <Link href={`/dashboard/tasks/${task.id}`} className="text-sm font-bold text-slate-900 group-hover:text-primary transition-colors line-clamp-1 before:absolute before:inset-0 outline-none">
                        {task.title}
                      </Link>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={cn('border-none px-3 py-1 text-xs font-medium', status.light, status.color)}>
                      <div className={cn('w-1 h-1 rounded-full mr-2 opacity-60', status.dot)} />
                      {status.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-2 items-center">
                      <span className="text-sm font-medium text-primary">
                        {task.progress || 0}%
                      </span>
                      <Progress value={task.progress} className="h-1 w-16 bg-slate-100 shadow-inner" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex -space-x-3 overflow-hidden">
                        {sortedAssignees.slice(0, 3).map((a: any, i: number) => (
                          <Avatar key={i} className="h-8 w-8 border-2 border-white shadow-sm ring-1 ring-slate-100/50">
                            <AvatarImage src={a.profile?.avatar_url} className="object-cover" />
                            <AvatarFallback className="bg-primary text-white text-sm font-medium">{a.profile?.full_name?.[0]}</AvatarFallback>
                          </Avatar>
                        ))}
                        {otherCount > 2 && (
                          <div className="h-8 w-8 rounded-full bg-slate-50 border-2 border-white flex items-center justify-center text-sm font-medium text-slate-500 ring-1 ring-slate-100/50">
                            +{otherCount - 2}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-slate-600 line-clamp-1">{firstAssignee?.full_name}</span>
                        {otherCount > 0 && (
                          <span className="text-xs font-medium text-slate-500 flex items-center gap-1 truncate whitespace-nowrap">
                            <Users className="w-2.5 h-2.5" /> + {otherCount} hỗ trợ
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right pr-8">
                    <Badge className={cn('text-[12px] font-medium px-3 py-1 border-none shadow-none', isLate ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-500')}>
                      {new Date(task.due_date).toLocaleDateString('vi-VN')}
                    </Badge>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {displayData.length > 5 && (
        <div className="flex justify-center pt-2">
          <Button 
            variant="ghost" 
            onClick={() => setShowAllTasks(!showAllTasks)}
            className="text-sm font-medium text-primary hover:bg-primary/5 rounded-full px-6 py-2 flex items-center gap-1.5"
          >
            {showAllTasks ? (
              <>Thu gọn <ChevronUp className="w-4 h-4" /></>
            ) : (
              <>Xem thêm {displayData.length - 5} công việc <ChevronDown className="w-4 h-4" /></>
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
