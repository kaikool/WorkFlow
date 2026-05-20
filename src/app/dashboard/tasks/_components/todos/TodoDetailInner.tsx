'use client'

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft, Loader2, Clock, CheckCircle2, Trash2, Send, Flag, Target, PlayCircle, AlertCircle, TrendingUp, Minus, Plus as PlusIcon, Star, Zap, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useToast } from "@/hooks/use-toast"
import { cn, compareProfilesByHierarchy, sortProfilesByHierarchy } from "@/lib/utils"
import { createClient } from "@/utils/supabase/client"
import Link from "next/link"

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  todo:   { label: "Đang chờ",    color: "text-slate-600",   bg: "bg-slate-100"  },
  doing:  { label: "Đang làm",    color: "text-primary",     bg: "bg-primary/5"  },
  done:   { label: "Hoàn thành",  color: "text-emerald-700", bg: "bg-emerald-50" },
  late:   { label: "Trễ hạn",     color: "text-red-700",     bg: "bg-red-50"     },
}

export function TodoDetailInner({ id }: { id: string }) {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [posting, setPosting] = useState(false)
  const [task, setTask] = useState<any>(null)
  const [assignees, setAssignees] = useState<any[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [comments, setComments] = useState<any[]>([])
  const [newComment, setNewComment] = useState("")
  const [currentValue, setCurrentValue] = useState("")
  const [isEditingTask, setIsEditingTask] = useState(false)
  const [editData, setEditData] = useState<any>({})
  const [deptProfiles, setDeptProfiles] = useState<any[]>([])
  const [delegationOpen, setDelegationOpen] = useState(false)
  const [selectedDelegate, setSelectedDelegate] = useState("")

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        let p: any = null
        if (user) {
          const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single()
          p = data; setProfile(data)
        }
        const { data, error } = await supabase.from("tasks")
          .select("*, creator:profiles!tasks_created_by_fkey(full_name,avatar_url,department_id,departments(name)), assignee:profiles!tasks_assignee_id_fkey(id,full_name,avatar_url,role,is_department_head), task_assignees(user_id,profile:profiles(full_name,avatar_url,role,is_department_head))")
          .eq("id", id).single()
        if (error) throw error
        const isOwner = data.created_by === user?.id
        const isAssignee = data.assignee_id === user?.id || data.task_assignees?.some((a: any) => a.user_id === user?.id)
        const taskDeptId = data.department_id || data.creator?.department_id
        const isSameDept = taskDeptId === p?.department_id
        if (p?.role !== "admin" && !isOwner && !isAssignee && !isSameDept) {
          toast({ variant: "destructive", title: "Truy cập bị từ chối", description: "Bạn không có quyền xem công việc này." })
          router.push("/dashboard/tasks"); return
        }
        setTask(data)
        const all = [...(data.task_assignees || [])]
        if (data.assignee_id && !all.find((a: any) => a.user_id === data.assignee_id)) all.push({ user_id: data.assignee_id, profile: data.assignee })
        setAssignees(all.sort((a: any, b: any) => compareProfilesByHierarchy(a.profile, b.profile)))
        const { data: cmts } = await supabase.from("task_comments").select("*, user:profiles(full_name,avatar_url)").eq("task_id", id).order("created_at", { ascending: true })
        setComments(cmts || [])
      } catch (err: any) { console.error(err) }
      finally { setLoading(false) }
    }
    fetchData()
    const ch = supabase.channel(`task_${id}`).on("postgres_changes", { event: "UPDATE", schema: "public", table: "tasks", filter: `id=eq.${id}` }, (p: any) => setTask(p.new)).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [id])

  useEffect(() => {
    if (task && profile) setCurrentValue((task.metadata?.contributions?.[profile.id] || 0).toString())
  }, [task, profile])

  useEffect(() => {
    if (profile?.department_id)
      supabase.from("profiles").select("*").eq("department_id", profile.department_id).neq("role", "manager").then(({ data }: any) => setDeptProfiles(sortProfilesByHierarchy(data || [])))
  }, [profile])
  const handleDelegate = async () => {
    if (!selectedDelegate) return; setSaving(true)
    try {
      if (!assignees.some(a => a.user_id === selectedDelegate)) {
        await supabase.from("task_assignees").insert({ task_id: id, user_id: selectedDelegate })
        await supabase.from("tasks").update({ assignee_id: selectedDelegate }).eq("id", id)
        await supabase.from("notifications").insert({ user_id: selectedDelegate, title: "Công việc được phân công", content: `${profile?.full_name} đã phân công: ${task.title}`, link: `/dashboard/tasks/${id}` })
        toast({ title: "Đã phân công công việc" }); setDelegationOpen(false)
        const sel = deptProfiles.find(x => x.id === selectedDelegate)
        if (sel) setAssignees([...assignees, { user_id: selectedDelegate, profile: sel }].sort((a: any, b: any) => compareProfilesByHierarchy(a.profile, b.profile)))
      } else { toast({ title: "Cán bộ này đã có trong danh sách." }) }
    } catch (err: any) { toast({ variant: "destructive", title: "Lỗi", description: err.message }) }
    finally { setSaving(false) }
  }

  const handleUpdateTaskInfo = async () => {
    setSaving(true)
    try {
      await supabase.from("tasks").update({ title: editData.title, description: editData.description }).eq("id", id)
      setTask({ ...task, title: editData.title, description: editData.description }); setIsEditingTask(false)
      toast({ title: "Đã cập nhật thông tin" })
    } catch (err: any) { toast({ variant: "destructive", title: "Lỗi", description: err.message }) }
    finally { setSaving(false) }
  }

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault(); if (!newComment.trim()) return; setPosting(true)
    try {
      await supabase.from("task_comments").insert({ task_id: id, user_id: profile.id, content: newComment })
      const ids = new Set(assignees.map(a => a.user_id)); if (task.created_by) ids.add(task.created_by); ids.delete(profile?.id)
      if (ids.size > 0) await supabase.from("notifications").insert(Array.from(ids).map(uid => ({ user_id: uid, title: `Thảo luận: ${task.title}`, content: `${profile.full_name}: "${newComment.substring(0,60)}${newComment.length>60?"...":""}\"`, link: `/dashboard/tasks/${id}` })))
      setNewComment("")
      const { data: cmts } = await supabase.from("task_comments").select("*, user:profiles(full_name,avatar_url)").eq("task_id", id).order("created_at", { ascending: true })
      setComments(cmts || [])
    } catch (err: any) { toast({ variant: "destructive", title: "Lỗi", description: err.message }) }
    finally { setPosting(false) }
  }

  const updateProgress = async (val: number) => {
    try {
      const ns = val === 100 ? "done" : val > 0 ? "doing" : "todo"
      await supabase.from("tasks").update({ progress: val, status: ns }).eq("id", id)
      const t1 = `Tiến độ mới: ${task.title}`; const c1 = `${profile?.full_name} đã cập nhật tiến độ lên ${val}%`
      if (task.created_by !== profile?.id) await supabase.from("notifications").insert({ user_id: task.created_by, title: t1, content: c1, link: `/dashboard/tasks/${id}` })
      const notifyA = assignees.filter(a => a.user_id !== profile?.id).map(a => ({ user_id: a.user_id, title: t1, content: c1, link: `/dashboard/tasks/${id}` }))
      if (notifyA.length > 0) await supabase.from("notifications").insert(notifyA)
      setTask({ ...task, progress: val, status: ns }); toast({ title: `Cập nhật: ${val}%` })
    } catch (err: any) { toast({ variant: "destructive", title: "Lỗi", description: err.message }) }
  }

  const handleUpdateStatus = async (ns: string) => {
    setSaving(true)
    try {
      await supabase.from("tasks").update({ status: ns }).eq("id", id)
      const labels: Record<string,string> = { done:"Hoàn thành", late:"Trễ hạn", doing:"Đang thực hiện", todo:"Đang chờ" }
      const t1 = `Trạng thái mới: ${task.title}`; const c1 = `${profile?.full_name} đã chuyển sang: ${labels[ns]||ns}`
      if (task.created_by !== profile?.id) await supabase.from("notifications").insert({ user_id: task.created_by, title: t1, content: c1, link: `/dashboard/tasks/${id}` })
      const notifyA = assignees.filter(a => a.user_id !== profile?.id).map(a => ({ user_id: a.user_id, title: t1, content: c1, link: `/dashboard/tasks/${id}` }))
      if (notifyA.length > 0) await supabase.from("notifications").insert(notifyA)
      setTask({ ...task, status: ns }); toast({ title: "Đã cập nhật trạng thái" })
    } catch (err: any) { toast({ variant: "destructive", title: "Lỗi", description: err.message }) }
    finally { setSaving(false) }
  }

  const handleLeaderUpdateContribution = async (userId: string, val: number) => {
    setSaving(true)
    const nm = { ...task.metadata, contributions: { ...(task.metadata?.contributions||{}), [userId]: val } }
    const sum = Object.values(nm.contributions||{}).reduce((a:any,b:any)=>a+(parseInt(b)||0),0) as number
    const total = sum + (parseInt(nm.general_adjustment)||0); const prog = task.target_value ? Math.round((total/task.target_value)*100) : 0
    try {
      await supabase.from("tasks").update({ current_value: total, progress: prog, metadata: nm }).eq("id", id)
      if (userId !== profile?.id) await supabase.from("notifications").insert({ user_id: userId, title: `Cập nhật đóng góp: ${task.title}`, content: `Lãnh đạo điều chỉnh số liệu: ${val} ${task.unit||""}`, link: `/dashboard/tasks/${id}` })
      setTask({ ...task, current_value: total, progress: prog, metadata: nm }); toast({ title: "Đã điều chỉnh đóng góp" })
    } catch (err: any) { toast({ variant: "destructive", title: "Lỗi", description: err.message }) }
    finally { setSaving(false) }
  }

  const handleGeneralAdjustment = async (delta: number) => {
    setSaving(true)
    const newAdj = (task.metadata?.general_adjustment||0)+delta
    const nm = { ...task.metadata, general_adjustment: newAdj }
    const sum = Object.values(nm.contributions||{}).reduce((a:any,b:any)=>a+(parseInt(b)||0),0) as number
    const total = sum + newAdj; const prog = task.target_value ? Math.round((total/task.target_value)*100) : 0
    try {
      await supabase.from("tasks").update({ current_value: total, progress: prog, metadata: nm }).eq("id", id)
      const nu = assignees.filter(a=>a.user_id!==profile?.id).map(a=>({ user_id:a.user_id, title:`Hiệu chỉnh phòng: ${task.title}`, content:`Số liệu điều chỉnh ${delta>0?"+":""}${delta} ${task.unit||""}`, link:`/dashboard/tasks/${id}` }))
      if (nu.length>0) await supabase.from("notifications").insert(nu)
      setTask({ ...task, current_value: total, progress: prog, metadata: nm }); toast({ title: "Đã điều chỉnh thực tế phòng" })
    } catch (err: any) { toast({ variant: "destructive", title: "Lỗi", description: err.message }) }
    finally { setSaving(false) }
  }

  const handleUpdateAchievement = async () => {
    setSaving(true); const contrib = parseInt(currentValue)||0
    const nm = { ...task.metadata, contributions: { ...(task.metadata?.contributions||{}), [profile.id]: contrib } }
    const sum = Object.values(nm.contributions||{}).reduce((a:any,b:any)=>a+(parseInt(b)||0),0) as number
    const total = sum + (parseInt(nm.general_adjustment)||0); const prog = task.target_value ? Math.round((total/task.target_value)*100) : 0
    try {
      await supabase.from("tasks").update({ current_value: total, progress: prog, metadata: nm, status: prog>=100?"done":task.status }).eq("id", id)
      if (prog>=100 && task.status!=="done" && task.created_by!==profile?.id) await supabase.from("notifications").insert({ user_id: task.created_by, title: `Đạt mục tiêu: ${task.title}`, content: `${profile?.full_name} đã hoàn thành 100% chỉ tiêu.`, link: `/dashboard/tasks/${id}` })
      setTask({ ...task, current_value: total, progress: prog, metadata: nm, status: prog>=100?"done":task.status })
      toast({ title: "Đã ghi nhận đóng góp", description: `Bạn đóng góp ${contrib} ${task.unit||""}` })
    } catch (err: any) { toast({ variant: "destructive", title: "Lỗi", description: err.message }) }
    finally { setSaving(false) }
  }

  const handleToggleFocal = async () => {
    if (!canEdit) return; setSaving(true); const nf = !task.metadata?.is_focal
    try {
      await supabase.from("tasks").update({ metadata: { ...task.metadata, is_focal: nf } }).eq("id", id)
      setTask({ ...task, metadata: { ...task.metadata, is_focal: nf } })
      toast({ title: nf ? "Đã thiết lập Kế hoạch trọng tâm" : "Đã bỏ ghim Kế hoạch" })
    } catch (err: any) { toast({ variant: "destructive", title: "Lỗi", description: err.message }) }
    finally { setSaving(false) }
  }

  const adjustValue = (d: number) => setCurrentValue(p => Math.max(0,(parseInt(p)||0)+d).toString())

  const isAdminOrDir = profile?.role==="admin"||profile?.role==="director"
  const isInDept = task?.department_id===profile?.department_id
  const isAssigneeMe = assignees.some(a=>a.user_id===profile?.id)||task?.assignee_id===profile?.id
  const canEdit = isAdminOrDir||(profile?.role==="manager"&&isInDept)||isAssigneeMe||task?.created_by===profile?.id
  const isKpi = task?.task_type==="kpi"
  const displayProgress = isKpi ? (task.target_value ? Math.round(((task.current_value||0)/task.target_value)*100) : 0) : (task?.progress||0)
  const curStatus = task ? (STATUS_MAP[task.status]||STATUS_MAP.todo) : STATUS_MAP.todo
  const isCreatorOrAdmin = task?.created_by===profile?.id||profile?.role==="admin"||profile?.role==="director"
  const isLeader = profile?.role === "admin" || profile?.role === "director" || profile?.role === "manager"

  if (loading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
  if (!task) return <div className="p-20 text-center font-bold text-slate-500">Không tìm thấy dữ liệu.</div>

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-6 animate-fade-in-up pb-20">
      <div className="flex items-center justify-between">
        <Button variant="ghost" asChild className="p-0 hover:bg-transparent text-slate-500 hover:text-primary group">
          <Link href={isKpi ? "/dashboard/kpi" : "/dashboard/tasks"} className="flex items-center gap-2">
            <div className="p-2 rounded-xl group-hover:bg-primary/5"><ChevronLeft className="w-4 h-4" /></div>
            <span className="text-sm font-medium">Quay lại danh sách</span>
          </Link>
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" className="text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl px-4 min-h-11 text-sm font-medium">
              <Trash2 className="w-4 h-4 mr-2" /> Xóa {isKpi ? "Kế hoạch KPIs" : "Công việc"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="rounded-2xl border-none shadow-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-[17px] font-semibold">Xác nhận xóa?</AlertDialogTitle>
              <AlertDialogDescription className="text-slate-500 font-medium">Dữ liệu sẽ được gỡ khỏi hệ thống vĩnh viễn.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-4 gap-3">
              <AlertDialogCancel className="rounded-xl min-h-11 font-medium active:scale-95 transition-all">Quay lại</AlertDialogCancel>
              <AlertDialogAction onClick={async () => { await supabase.from("tasks").delete().eq("id", id); router.push(isKpi ? "/dashboard/kpi" : "/dashboard/tasks") }} className="rounded-xl min-h-11 bg-red-600 font-medium hover:bg-red-700 text-white border-none active:scale-95 transition-all">Xác nhận xóa</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          {/* Header card */}
          <div className="premium-card p-6 border-none space-y-6 relative overflow-hidden">
            <div className="absolute -top-12 -right-12 opacity-5 pointer-events-none"><Target className="w-48 h-48 rotate-12 text-primary" /></div>
            <div className="flex items-center gap-2 relative z-10 flex-wrap">
              <Badge className={cn("px-3 py-1 text-xs font-medium rounded-full border-none", isKpi ? "bg-primary text-white" : "bg-slate-100 text-slate-500")}>
                {isKpi ? "Kế hoạch KPIs" : "Công việc nghiệp vụ"}
              </Badge>
              {task.priority === "high" && <Badge className="bg-red-50 text-red-600 border-none text-xs px-3 py-1 rounded-full">Khẩn cấp</Badge>}
            </div>
            {isEditingTask ? (
              <div className="relative z-10 space-y-4">
                <Input value={editData.title||""} onChange={e=>setEditData({...editData,title:e.target.value})} className="text-xl font-semibold bg-white" />
                <Input value={editData.description||""} onChange={e=>setEditData({...editData,description:e.target.value})} placeholder="Mô tả" className="bg-white" />
                <div className="flex gap-2">
                  <Button onClick={handleUpdateTaskInfo} disabled={saving} className="bg-primary text-white rounded-xl active:scale-95 transition-all">Lưu</Button>
                  <Button variant="outline" onClick={()=>setIsEditingTask(false)} className="rounded-xl active:scale-95 transition-all">Hủy</Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-start relative z-10">
                  <h1 className="text-xl md:text-2xl font-semibold text-slate-900 leading-tight">{task.title}</h1>
                  {(task.created_by===profile?.id||profile?.role==="admin")&&<Button variant="ghost" size="sm" onClick={()=>{setEditData(task);setIsEditingTask(true)}} className="rounded-xl active:scale-95 transition-all">Sửa</Button>}
                </div>
                <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100/50 relative z-10">
                  <p className="text-sm text-slate-500 font-medium leading-relaxed italic">"{task.description||"Chưa có mô tả chi tiết."}"</p>
                </div>
              </>
            )}
          </div>

          {/* Progress / KPI card */}
          <div className="premium-card p-6 border-none space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-slate-500 flex items-center gap-2 truncate whitespace-nowrap">
                <TrendingUp className="w-4 h-4 text-primary" />{isKpi ? "Tiến độ kế hoạch" : "Tiến độ thực hiện"}
              </h3>
              <span className="text-3xl font-bold text-primary tabular-nums">{displayProgress}%</span>
            </div>
            {isKpi ? (
              <div className="space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm">
                    <p className="text-sm font-medium text-slate-500 flex items-center gap-2"><Target className="w-3 h-3"/>Mục tiêu cần đạt</p>
                    <p className="text-2xl font-bold text-slate-900 tabular-nums">{task.target_value?.toLocaleString("vi-VN")} <span className="text-xs text-slate-500">{task.unit}</span></p>
                  </div>
                  <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 shadow-sm">
                    <p className="text-sm font-medium text-primary flex items-center gap-2"><Zap className="w-3 h-3"/>Thực tế ghi nhận</p>
                    <p className="text-2xl font-bold text-primary tabular-nums">{(task.current_value||0).toLocaleString("vi-VN")} <span className="text-xs opacity-60">{task.unit}</span></p>
                  </div>
                </div>
                <Progress value={Math.min(100,displayProgress)} className="h-2 bg-slate-50 shadow-inner" />
                {canEdit && (
                  <div className="pt-6 border-t border-slate-50 space-y-4">
                    <p className="text-sm font-medium text-primary">Cá nhân tôi đóng góp</p>
                    <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center">
                      <div className="flex items-center gap-2 bg-primary/5 p-1.5 rounded-xl border border-primary/10 w-full md:max-w-xs">
                        <Button type="button" variant="ghost" onClick={()=>adjustValue(-1)} className="h-11 w-11 rounded-xl hover:bg-white text-primary active:scale-95 transition-all"><Minus className="w-4 h-4"/></Button>
                        <Input type="number" value={currentValue} onChange={e=>setCurrentValue(e.target.value)} className="min-h-11 bg-transparent border-none shadow-none text-center font-bold text-xl px-2 focus-visible:ring-0 text-primary" />
                        <Button type="button" variant="ghost" onClick={()=>adjustValue(1)} className="h-11 w-11 rounded-xl hover:bg-white text-primary active:scale-95 transition-all"><PlusIcon className="w-4 h-4"/></Button>
                      </div>
                      <Button onClick={handleUpdateAchievement} disabled={saving} className="bg-primary hover:bg-primary/90 min-h-11 px-5 rounded-xl font-medium w-full md:w-auto active:scale-95 transition-all">
                        {saving?<Loader2 className="w-4 h-4 animate-spin mr-2"/>:<CheckCircle2 className="w-3.5 h-3.5 mr-2"/>}Cập nhật đóng góp
                      </Button>
                    </div>
                  </div>
                )}
                <div className="pt-6 border-t border-slate-50 space-y-4">
                  <h4 className="text-sm font-medium text-slate-500">Tổng hợp đóng góp thực tế</h4>
                  <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                    {assignees.map((a,idx)=>{
                      const contrib=task.metadata?.contributions?.[a.user_id]||0
                      const weight=task.current_value>0?Math.min(100,Math.round((contrib/task.current_value)*100)):0
                      return (
                        <div key={a.user_id} className={cn("flex flex-col p-4 sm:p-5 gap-3",idx!==0&&"border-t border-slate-50",a.user_id===profile?.id&&"bg-primary/[0.02]")}>
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <Avatar className="h-8 w-8 shrink-0 border border-white shadow-sm ring-1 ring-slate-100">
                                <AvatarImage src={a.profile?.avatar_url} className="object-cover"/>
                                <AvatarFallback className="text-sm font-medium bg-slate-100 text-slate-500">{a.profile?.full_name?.[0]}</AvatarFallback>
                              </Avatar>
                              <span className={cn("text-sm font-medium truncate",a.user_id===profile?.id?"text-primary":"text-slate-700")}>{a.profile?.full_name}</span>
                            </div>
                            <div className="flex items-center gap-4 shrink-0">
                              {isLeader?(
                                <div className="relative max-w-[110px]">
                                  <input type="number" value={contrib} onChange={e=>handleLeaderUpdateContribution(a.user_id,parseInt(e.target.value)||0)} className="w-full min-h-11 md:min-h-10 bg-slate-50/50 border border-slate-100 rounded-lg text-right text-base md:text-sm font-medium px-2 pr-14 focus:outline-none focus:bg-white focus:border-primary/30 transition-all [appearance:textfield]"/>
                                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500 pointer-events-none truncate max-w-[45px]">{task.unit}</span>
                                </div>
                              ):(
                                <p className="font-bold text-slate-900 text-xs">{contrib.toLocaleString("vi-VN")} <span className="text-xs text-slate-500">{task.unit}</span></p>
                              )}
                              <span className="text-sm font-medium text-primary min-w-[30px] text-right">{weight}%</span>
                            </div>
                          </div>
                          <div className="w-full h-1.5 bg-slate-50 rounded-full overflow-hidden shadow-inner">
                            <div className="h-full bg-primary/40 transition-all duration-1000 rounded-full" style={{width:`${weight}%`}}/>
                          </div>
                        </div>
                      )
                    })}
                    {isLeader && (
                      <div className="bg-slate-50/50 border-t border-slate-100 p-4 sm:p-5 flex items-center justify-between">
                        <span className="text-xs font-medium text-primary/60 flex items-center gap-2"><TrendingUp className="w-4 h-4"/>Hiệu chỉnh phòng</span>
                        <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200/60 shadow-sm">
                          <Button variant="ghost" size="icon" className="h-11 w-11 rounded-xl text-primary hover:bg-primary/5" onClick={()=>handleGeneralAdjustment(-1)}><Minus className="w-4 h-4"/></Button>
                          <span className="min-w-[40px] text-center font-bold text-sm text-slate-900">{(task.metadata?.general_adjustment||0).toLocaleString("vi-VN")}</span>
                          <Button variant="ghost" size="icon" className="h-11 w-11 rounded-xl text-primary hover:bg-primary/5" onClick={()=>handleGeneralAdjustment(1)}><PlusIcon className="w-4 h-4"/></Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex gap-2 h-2">
                  {[25,50,75,100].map(val=>(
                    <button key={val} onClick={()=>canEdit&&updateProgress(val)} className={cn("flex-1 rounded-full transition-all duration-300",(task.progress||0)>=val?"bg-primary":"bg-slate-100",!canEdit&&"cursor-default")}/>
                  ))}
                </div>
                <div className="flex justify-between px-1">
                  {["Tiếp nhận","Thực hiện","Kiểm soát","Hoàn tất"].map((label,i)=>(
                    <span key={i} className={cn("text-xs font-medium transition-colors",(task.progress||0)>=(i+1)*25?"text-primary":"text-slate-500")}>{label}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Thảo luận */}
          <div className="space-y-6 pt-4">
            <h3 className="text-sm font-medium text-slate-500 pl-2 flex items-center gap-2 truncate whitespace-nowrap">
              <MessageSquare className="w-4 h-4 text-primary"/>Luồng thảo luận
            </h3>
            <div className="space-y-4">
              {comments.map(c=>(
                <div key={c.id} className="premium-card p-6 border-none flex gap-4">
                  <Avatar className="h-11 w-11 shrink-0 border shadow-sm ring-1 ring-slate-100">
                    <AvatarImage src={c.user?.avatar_url} className="object-cover"/>
                    <AvatarFallback className="bg-slate-100 text-slate-500 font-bold">{c.user?.full_name?.[0]}</AvatarFallback>
                  </Avatar>
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-900">{c.user?.full_name}</span>
                      <span className="text-xs text-slate-500 font-medium">{new Date(c.created_at).toLocaleDateString("vi-VN")}</span>
                    </div>
                    <p className="text-sm text-slate-600 font-medium leading-relaxed bg-slate-50/50 p-3 rounded-2xl rounded-tl-none">{c.content}</p>
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={handlePostComment} className="flex gap-3 pt-2">
              <Input placeholder="Nhập nội dung trao đổi..." className="finance-input flex-1 min-h-11 text-sm font-medium" value={newComment} onChange={e=>setNewComment(e.target.value)} disabled={posting}/>
              <Button type="submit" disabled={posting||!newComment.trim()} className="min-h-11 w-10 rounded-xl bg-slate-900 hover:bg-black shadow-sm shrink-0 p-0"><Send className="w-5 h-5 text-white"/></Button>
            </form>
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          <div className="premium-card p-6 border-none space-y-6">
            <div className="space-y-4">
              <p className="text-sm font-medium text-slate-500">Trạng thái hiện tại</p>
              <Select disabled={(!canEdit&&task.created_by!==profile?.id)||saving} value={task.status} onValueChange={handleUpdateStatus}>
                <SelectTrigger className={cn("h-11 rounded-xl border-none shadow-sm flex items-center justify-between px-4 font-medium text-sm transition-all",curStatus.bg,curStatus.color)}>
                  <SelectValue/>
                </SelectTrigger>
                 <SelectContent className="rounded-xl border border-slate-200 shadow-lg p-1.5 min-w-[200px]">
                  {Object.entries(STATUS_MAP).map(([key,val])=>(
                    <SelectItem key={key} value={key} className="rounded-lg py-2 font-medium text-sm">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-2 h-2 rounded-full",key==="done"?"bg-emerald-500":key==="doing"?"bg-primary":key==="late"?"bg-red-500":"bg-slate-300")}/>
                        {val.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isKpi&&isCreatorOrAdmin&&(
              <div className="pt-2">
                <Button onClick={handleToggleFocal} variant={task.metadata?.is_focal?"default":"outline"} className={cn("w-full min-h-11 rounded-xl font-medium text-sm gap-2",task.metadata?.is_focal?"bg-amber-400 hover:bg-amber-500 text-white border-none shadow-lg shadow-amber-200":"bg-slate-50 border-none text-slate-500 hover:bg-slate-100")}>
                  <Star className={cn("w-4 h-4",task.metadata?.is_focal&&"fill-current")}/>{task.metadata?.is_focal?"Kế hoạch KPIs trọng tâm":"Ghim làm Kế hoạch trọng tâm"}
                </Button>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500 pl-1 truncate whitespace-nowrap">Cán bộ tiếp nhận</p>
                {(profile?.role==="manager"||profile?.role==="admin")&&(
                  <Popover open={delegationOpen} onOpenChange={setDelegationOpen}>
                    <PopoverTrigger asChild><Button variant="ghost" size="sm" className="min-h-10 text-sm font-medium text-primary hover:bg-primary/5">Phân công</Button></PopoverTrigger>
                    <PopoverContent className="w-[260px] p-3 rounded-xl shadow-xl border-slate-200" align="end">
                      <div className="space-y-3">
                        <h4 className="font-bold text-sm text-slate-900">Phân công cho cán bộ</h4>
                        <Select value={selectedDelegate} onValueChange={setSelectedDelegate}>
                          <SelectTrigger className="w-full min-h-11 text-xs rounded-lg bg-slate-50 border-slate-200"><SelectValue placeholder="Chọn cán bộ..."/></SelectTrigger>
                          <SelectContent className="rounded-lg">{deptProfiles.map(p=><SelectItem key={p.id} value={p.id} className="text-xs">{p.full_name}</SelectItem>)}</SelectContent>
                        </Select>
                        <Button onClick={handleDelegate} disabled={saving} className="w-full min-h-11 rounded-lg text-xs bg-primary">Xác nhận</Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
              <div className="space-y-2">
                {assignees.length>0 ? assignees.map(a=>(
                  <div key={a.user_id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <Avatar className="h-8 w-8 border border-white shadow-sm"><AvatarImage src={a.profile?.avatar_url} className="object-cover"/><AvatarFallback className="bg-primary text-white text-sm font-medium">{a.profile?.full_name?.[0]}</AvatarFallback></Avatar>
                    <div className="flex flex-col"><span className="text-sm font-medium text-slate-900">{a.profile?.full_name}</span><span className="text-sm font-medium text-slate-500 truncate whitespace-nowrap">Cán bộ</span></div>
                  </div>
                )) : task.assignee ? (
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <Avatar className="h-8 w-8"><AvatarImage src={task.assignee?.avatar_url} className="object-cover"/><AvatarFallback className="bg-primary text-white text-sm font-medium">{task.assignee?.full_name?.[0]}</AvatarFallback></Avatar>
                    <span className="text-sm font-medium text-slate-900">{task.assignee?.full_name}</span>
                  </div>
                ) : (
                  <div className="p-4 bg-primary/5 rounded-xl border border-primary/10 text-center">
                    <p className="text-sm font-medium text-primary truncate whitespace-nowrap">{task.department?.name||"Phòng nghiệp vụ"}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-50 grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-500 pl-1 truncate whitespace-nowrap">Hạn chót</p>
                <div className="flex items-center gap-2 text-sm font-medium text-slate-900 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <Flag className="w-3.5 h-3.5 text-primary"/>{new Date(task.due_date).toLocaleDateString("vi-VN")}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-500 pl-1 truncate whitespace-nowrap">Mức độ</p>
                <div className="flex items-center gap-2 text-sm font-medium text-slate-900 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <Flag className={cn("w-3.5 h-3.5",task.priority==="high"?"text-red-500":"text-primary")}/>{task.priority==="high"?"Khẩn":"Thường"}
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-50 space-y-3">
              <p className="text-sm font-medium text-slate-500 pl-1 truncate whitespace-nowrap">Khởi tạo bởi</p>
              <div className="flex items-center gap-3 px-1">
                <Avatar className="h-8 w-8 border border-white shadow-sm"><AvatarImage src={task.creator?.avatar_url} className="object-cover"/><AvatarFallback className="text-sm font-medium">{task.creator?.full_name?.[0]}</AvatarFallback></Avatar>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-slate-900 leading-none">{task.creator?.full_name}</span>
                  <span className="text-xs font-medium text-slate-500">{task.creator?.departments?.name}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
