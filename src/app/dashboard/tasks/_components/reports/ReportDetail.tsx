'use client'

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft, Loader2, CheckCircle2, Trash2, Send, Flag, Target, AlertCircle, MessageSquare, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { createClient } from "@/utils/supabase/client"
import Link from "next/link"

export function ReportDetail({ id }: { id: string }) {
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
  const [siblingReports, setSiblingReports] = useState<any[]>([])
  const [remindingId, setRemindingId] = useState<string|null>(null)
  const [isRemindingAll, setIsRemindingAll] = useState(false)
  const [deptProfiles, setDeptProfiles] = useState<any[]>([])
  const [delegationOpen, setDelegationOpen] = useState(false)
  const [selectedDelegate, setSelectedDelegate] = useState("")
  const [isEditingTask, setIsEditingTask] = useState(false)
  const [editData, setEditData] = useState<any>({})

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
          .select("*, creator:profiles!tasks_created_by_fkey(full_name,avatar_url,department_id,departments(name)), assignee:profiles!tasks_assignee_id_fkey(id,full_name,avatar_url), task_assignees(user_id,profile:profiles(full_name,avatar_url,role))")
          .eq("id", id).single()
        if (error) throw error
        const isOwner = data.created_by === user?.id
        const isAssignee = data.assignee_id === user?.id || data.task_assignees?.some((a: any) => a.user_id === user?.id)
        const taskDeptId = data.department_id || data.creator?.department_id
        const isSameDept = taskDeptId === p?.department_id
        if (p?.role !== "admin" && !isOwner && !isAssignee && !isSameDept) {
          toast({ variant: "destructive", title: "Truy cập bị từ chối", description: "Bạn không có quyền xem báo cáo này." })
          router.push("/dashboard/tasks"); return
        }
        setTask(data)
        const all = [...(data.task_assignees || [])]
        if (data.assignee_id && !all.find((a: any) => a.user_id === data.assignee_id)) all.push({ user_id: data.assignee_id, profile: data.assignee })
        setAssignees(all)
        const { data: siblings } = await supabase.from("tasks")
          .select("id,status,progress,due_date,assignee_id,department_id,departments(name),assignee:profiles!tasks_assignee_id_fkey(id,full_name,avatar_url)")
          .eq("title", data.title).eq("created_by", data.created_by).eq("task_type", "report").order("created_at", { ascending: true })
        setSiblingReports(siblings || [])
        const sibIds = Array.from(new Set([data.id, ...(siblings||[]).map((s: any) => s.id)]))
        const { data: cmts } = await supabase.from("task_comments").select("*, user:profiles(full_name,avatar_url)").in("task_id", sibIds).order("created_at", { ascending: true })
        setComments(cmts || [])
      } catch (err: any) { console.error(err) }
      finally { setLoading(false) }
    }
    fetchData()
    const ch = supabase.channel(`report_${id}`).on("postgres_changes", { event: "UPDATE", schema: "public", table: "tasks", filter: `id=eq.${id}` }, (p) => setTask(p.new)).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [id])

  useEffect(() => {
    if (profile?.department_id)
      supabase.from("profiles").select("*").eq("department_id", profile.department_id).neq("role", "manager").then(({ data }) => setDeptProfiles(data || []))
  }, [profile])

  const isCreatorOrAdmin = task?.created_by === profile?.id || profile?.role === "admin" || profile?.role === "director"
  const isAssigneeMe = assignees.some(a => a.user_id === profile?.id) || task?.assignee_id === profile?.id
  const isAdminOrDir = profile?.role === "admin" || profile?.role === "director"
  const canEdit = isAdminOrDir || (profile?.role === "manager" && task?.department_id === profile?.department_id) || isAssigneeMe || task?.created_by === profile?.id

  const refreshComments = async () => {
    const sibIds = Array.from(new Set([id, ...siblingReports.map(s => s.id)]))
    const { data: cmts } = await supabase.from("task_comments").select("*, user:profiles(full_name,avatar_url)").in("task_id", sibIds).order("created_at", { ascending: true })
    setComments(cmts || [])
  }

  const handleSendReminder = async (sibId: string, assigneeId: string, deptName: string) => {
    if (!assigneeId) { toast({ variant: "destructive", title: "Không thể nhắc nhở", description: `Phòng ${deptName} chưa có cán bộ tiếp nhận.` }); return }
    setRemindingId(sibId)
    try {
      await supabase.from("notifications").insert({ user_id: assigneeId, title: "Nhắc hoàn thành báo cáo [HỎA TỐC]", content: `${profile?.full_name} nhắc hoàn thành báo cáo "${task.title}" của phòng ${deptName}`, link: `/dashboard/tasks/${sibId}` })
      toast({ title: "Đã gửi nhắc nhở", description: `Gửi thông báo thành công tới phòng ${deptName}!` })
    } catch (err: any) { toast({ variant: "destructive", title: "Lỗi", description: err.message }) }
    finally { setRemindingId(null) }
  }

  const handleSendReminderAll = async () => {
    const uncompleted = siblingReports.filter(r => r.status !== "done")
    if (uncompleted.length === 0) { toast({ title: "Tất cả đã hoàn thành!" }); return }
    const assigned = uncompleted.filter(r => r.assignee_id)
    const unassigned = uncompleted.filter(r => !r.assignee_id).map(r => r.departments?.name || "Phòng chuyên môn")
    if (assigned.length === 0) { toast({ variant: "destructive", title: "Không thể nhắc nhở", description: "Các phòng chưa có cán bộ tiếp nhận." }); return }
    setIsRemindingAll(true)
    try {
      await supabase.from("notifications").insert(assigned.map(r => ({ user_id: r.assignee_id, title: "Nhắc hoàn thành báo cáo [HỎA TỐC]", content: `Khẩn trương hoàn thành báo cáo "${task.title}".`, link: `/dashboard/tasks/${r.id}` })))
      toast({ title: "Đã đôn đốc hỏa tốc!", description: `Đã gửi tới ${assigned.length} phòng.${unassigned.length>0?` Không gửi được: ${unassigned.join(", ")}` : ""}` })
    } catch (err: any) { toast({ variant: "destructive", title: "Lỗi", description: err.message }) }
    finally { setIsRemindingAll(false) }
  }

  const handleToggleSiblingStatus = async (sibId: string, currentStatus: string) => {
    if (!isCreatorOrAdmin) return
    const ns = currentStatus === "done" ? "todo" : "done"
    const np = ns === "done" ? 100 : 0
    try {
      await supabase.from("tasks").update({ status: ns, progress: np }).eq("id", sibId)
      const updated = siblingReports.map(s => s.id === sibId ? { ...s, status: ns, progress: np } : s)
      setSiblingReports(updated)
      const total = updated.length; const done = updated.filter(s => s.status === "done").length
      let parentStatus = done === total ? "done" : done > 0 ? "doing" : (task.due_date && new Date(task.due_date) < new Date() ? "late" : "todo")
      if (parentStatus !== "done" && task.due_date && new Date(task.due_date) < new Date()) parentStatus = "late"
      const overallProg = total > 0 ? Math.round((done/total)*100) : 0
      await supabase.from("tasks").update({ status: parentStatus, progress: overallProg }).eq("id", id)
      setTask((prev: any) => prev ? { ...prev, status: parentStatus, progress: overallProg } : null)
      const sib = updated.find(s => s.id === sibId)
      if (sib?.assignee_id) await supabase.from("notifications").insert({ user_id: sib.assignee_id, title: ns==="done"?"Báo cáo được ghi nhận":"Hủy ghi nhận báo cáo", content: ns==="done"?`Lãnh đạo đã xác nhận báo cáo "${task.title}" của đơn vị bạn.`:`Lãnh đạo đã hủy xác nhận báo cáo "${task.title}".`, link: `/dashboard/tasks/${sibId}` })
      toast({ title: "Cập nhật thành công" })
    } catch (err: any) { toast({ variant: "destructive", title: "Lỗi", description: err.message }) }
  }

  const handleDelegate = async () => {
    if (!selectedDelegate) return; setSaving(true)
    try {
      if (!assignees.some(a => a.user_id === selectedDelegate)) {
        await supabase.from("task_assignees").insert({ task_id: id, user_id: selectedDelegate })
        await supabase.from("tasks").update({ assignee_id: selectedDelegate }).eq("id", id)
        await supabase.from("notifications").insert({ user_id: selectedDelegate, title: "Báo cáo được phân công", content: `${profile?.full_name} đã phân công: ${task.title}`, link: `/dashboard/tasks/${id}` })
        toast({ title: "Đã phân công" }); setDelegationOpen(false)
        const sel = deptProfiles.find(x => x.id === selectedDelegate)
        if (sel) setAssignees([...assignees, { user_id: selectedDelegate, profile: sel }])
      } else { toast({ title: "Cán bộ đã có trong danh sách." }) }
    } catch (err: any) { toast({ variant: "destructive", title: "Lỗi", description: err.message }) }
    finally { setSaving(false) }
  }

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault(); if (!newComment.trim()) return; setPosting(true)
    try {
      await supabase.from("task_comments").insert({ task_id: id, user_id: profile.id, content: newComment })
      const ids = new Set(assignees.map(a => a.user_id))
      if (task.created_by) ids.add(task.created_by)
      siblingReports.forEach(s => { if (s.assignee_id) ids.add(s.assignee_id) })
      ids.delete(profile?.id)
      if (ids.size > 0) await supabase.from("notifications").insert(Array.from(ids).map(uid => ({ user_id: uid, title: `Thảo luận: ${task.title}`, content: `${profile.full_name}: "${newComment.substring(0,60)}${newComment.length>60?"...":""}\"`, link: `/dashboard/tasks/${id}` })))
      setNewComment(""); await refreshComments()
    } catch (err: any) { toast({ variant: "destructive", title: "Lỗi", description: err.message }) }
    finally { setPosting(false) }
  }

  const handleUpdateTaskInfo = async () => {
    setSaving(true)
    try {
      await supabase.from("tasks").update({ title: editData.title, description: editData.description }).eq("id", id)
      setTask({ ...task, title: editData.title, description: editData.description }); setIsEditingTask(false)
      toast({ title: "Đã cập nhật" })
    } catch (err: any) { toast({ variant: "destructive", title: "Lỗi", description: err.message }) }
    finally { setSaving(false) }
  }

  if (loading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary"/></div>
  if (!task) return <div className="p-20 text-center font-bold text-slate-500">Không tìm thấy dữ liệu.</div>

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-6 animate-fade-in-up pb-20">
      <div className="flex items-center justify-between">
        <Button variant="ghost" asChild className="p-0 hover:bg-transparent text-slate-500 hover:text-primary group">
          <Link href="/dashboard/tasks" className="flex items-center gap-2">
            <div className="p-2 rounded-xl group-hover:bg-primary/5"><ChevronLeft className="w-4 h-4"/></div>
            <span className="text-[13px] font-medium">Quay lại danh sách</span>
          </Link>
        </Button>
        {isCreatorOrAdmin && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" className="text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl px-4 h-10 text-[13px] font-medium">
                <Trash2 className="w-4 h-4 mr-2"/>Xóa báo cáo
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-2xl border-none shadow-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-[17px] font-semibold">Xác nhận xóa?</AlertDialogTitle>
                <AlertDialogDescription className="text-slate-500 font-medium">Dữ liệu sẽ được gỡ khỏi hệ thống vĩnh viễn.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="mt-4 gap-3">
                <AlertDialogCancel className="rounded-xl h-10 font-medium">Quay lại</AlertDialogCancel>
                <AlertDialogAction onClick={async()=>{ await supabase.from("tasks").delete().eq("id",id); router.push("/dashboard/tasks") }} className="rounded-xl h-10 bg-red-600 font-medium hover:bg-red-700 text-white border-none">Xác nhận xóa</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          {/* Header card */}
          <div className="premium-card p-6 border-none space-y-6">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="px-3 py-1 text-[11px] font-medium rounded-full border-none bg-slate-900 text-white">Yêu cầu báo cáo</Badge>
              {task.priority === "high" && <Badge className="bg-red-50 text-red-600 border-none text-[11px] px-3 py-1 rounded-full">Khẩn cấp</Badge>}
            </div>
            {isEditingTask ? (
              <div className="space-y-4">
                <Input value={editData.title||""} onChange={e=>setEditData({...editData,title:e.target.value})} className="text-xl font-semibold bg-white"/>
                <Input value={editData.description||""} onChange={e=>setEditData({...editData,description:e.target.value})} placeholder="Mô tả" className="bg-white"/>
                <div className="flex gap-2">
                  <Button onClick={handleUpdateTaskInfo} disabled={saving} className="bg-primary text-white">Lưu</Button>
                  <Button variant="outline" onClick={()=>setIsEditingTask(false)}>Hủy</Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-start">
                  <h1 className="text-xl md:text-2xl font-semibold text-slate-900 tracking-tight leading-tight">{task.title}</h1>
                  {isCreatorOrAdmin && <Button variant="ghost" size="sm" onClick={()=>{setEditData(task);setIsEditingTask(true)}}>Sửa</Button>}
                </div>
                <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100/50">
                  <p className="text-sm text-slate-500 font-medium leading-relaxed italic">"{task.description||"Chưa có mô tả chi tiết."}"</p>
                </div>
              </>
            )}
          </div>

          {/* Panel theo dõi (dành cho người tạo/admin) hoặc nút xác nhận nộp (dành cho người nhận) */}
          {isCreatorOrAdmin ? (
            <div className="premium-card p-6 border-none space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase flex items-center gap-2"><Target className="w-4 h-4"/>Theo dõi tiến độ các phòng ban</h3>
                  <p className="text-[11px] text-slate-500 font-medium mt-1">Tổng số: {siblingReports.length} đơn vị nhận yêu cầu</p>
                </div>
                <div className="flex gap-2">
                  <Badge className="bg-emerald-50 text-emerald-600 border-none font-bold text-[10px]">ĐÃ NỘP: {siblingReports.filter(r=>r.status==="done").length}</Badge>
                  <Badge className="bg-amber-50 text-amber-600 border-none font-bold text-[10px]">CHƯA NỘP: {siblingReports.filter(r=>r.status!=="done").length}</Badge>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="pb-3 pl-2 w-1/2">Đơn vị tiếp nhận</th>
                      <th className="pb-3 w-1/2 text-right pr-2">Ghi nhận nộp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {siblingReports.map(sib=>{
                      const isDone = sib.status==="done"
                      return (
                        <tr key={sib.id} className={cn("transition-colors",!isDone?"bg-amber-50/30 hover:bg-amber-50/50":"hover:bg-slate-50/30")}>
                          <td className="py-4 pl-2 font-semibold text-xs text-slate-900">
                            <Link href={`/dashboard/tasks/${sib.id}`} className="hover:text-primary transition-colors flex items-center gap-2">
                              <span className={cn("p-1 rounded-lg shrink-0",isDone?"bg-emerald-50 text-emerald-600":"bg-amber-50 text-amber-600")}>
                                {isDone?<CheckCircle2 className="w-3.5 h-3.5"/>:<Target className="w-3.5 h-3.5"/>}
                              </span>
                              {sib.departments?.name||"Phòng chuyên môn"}
                            </Link>
                          </td>
                          <td className="py-4 text-right pr-2">
                            <div className="flex items-center justify-end gap-2" onClick={e=>e.stopPropagation()}>
                              <Checkbox checked={isDone} disabled={!isCreatorOrAdmin} onCheckedChange={()=>handleToggleSiblingStatus(sib.id,sib.status)} className="h-4.5 w-4.5 rounded border-slate-300 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"/>
                              <span className={cn("text-[11px] font-bold cursor-pointer select-none",isDone?"text-emerald-600":"text-slate-400")} onClick={()=>isCreatorOrAdmin&&handleToggleSiblingStatus(sib.id,sib.status)}>
                                {isDone?"Đã nộp":"Chưa nộp"}
                              </span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {siblingReports.some(r=>r.status!=="done")&&(
                <div className="pt-4 border-t border-slate-100 flex justify-center">
                  <Button disabled={isRemindingAll} onClick={handleSendReminderAll} className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-none rounded-xl text-[11px] font-bold h-9 px-5 shadow-sm active:scale-95 flex items-center gap-2">
                    {isRemindingAll?<Loader2 className="w-3.5 h-3.5 animate-spin"/>:<Zap className="w-3.5 h-3.5 fill-current"/>}Nhắc báo cáo
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center p-2">
              <Button disabled={!canEdit||saving} onClick={async()=>{ try { const val=(task.progress||0)>=100?0:100; const ns=val>=100?"done":"todo"; await supabase.from("tasks").update({progress:val,status:ns}).eq("id",id); if(task.created_by&&task.created_by!==profile?.id) await supabase.from("notifications").insert({user_id:task.created_by,title:`Tiến độ mới: ${task.title}`,content:`${profile?.full_name} đã ${val>=100?"xác nhận nộp":"hủy nộp"} báo cáo.`,link:`/dashboard/tasks/${id}`}); setTask({...task,progress:val,status:ns}) } catch(err:any){toast({variant:"destructive",title:"Lỗi",description:err.message})} }}
                className={cn("w-full sm:max-w-[300px] h-12 rounded-xl font-bold transition-all shadow-sm flex items-center justify-center gap-2 text-[14px]",(task.progress||0)>=100?"bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/50":"bg-primary text-white hover:bg-primary/90")}>
                <CheckCircle2 className="w-5 h-5"/>{(task.progress||0)>=100?"Đã nộp báo cáo (Hủy)":"Xác nhận nộp báo cáo"}
              </Button>
            </div>
          )}

          {/* Thảo luận */}
          <div className="space-y-6 pt-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase pl-2 flex items-center gap-2 truncate whitespace-nowrap">
              <MessageSquare className="w-4 h-4 text-primary"/>LUỒNG THẢO LUẬN
            </h3>
            <div className="space-y-4">
              {comments.map(c=>(
                <div key={c.id} className="premium-card p-6 border-none flex gap-4">
                  <Avatar className="h-11 w-11 shrink-0 border shadow-sm ring-1 ring-slate-100">
                    <AvatarImage src={c.user?.avatar_url} className="object-cover"/><AvatarFallback className="bg-slate-100 text-slate-500 font-bold">{c.user?.full_name?.[0]}</AvatarFallback>
                  </Avatar>
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-900">{c.user?.full_name}</span>
                      <span className="text-[11px] text-slate-500 font-medium">{new Date(c.created_at).toLocaleDateString("vi-VN")}</span>
                    </div>
                    <p className="text-[13px] text-slate-600 font-medium leading-relaxed bg-slate-50/50 p-3 rounded-2xl rounded-tl-none">{c.content}</p>
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={handlePostComment} className="flex gap-3 pt-2">
              <Input placeholder="Nhập nội dung trao đổi..." className="finance-input flex-1 h-10 text-[14px] font-medium" value={newComment} onChange={e=>setNewComment(e.target.value)} disabled={posting}/>
              <Button type="submit" disabled={posting||!newComment.trim()} className="h-10 w-10 rounded-xl bg-slate-900 hover:bg-black shadow-sm shrink-0 p-0"><Send className="w-5 h-5 text-white"/></Button>
            </form>
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          <div className="premium-card p-6 border-none space-y-6">
            {!isCreatorOrAdmin && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-500 uppercase pl-1 truncate whitespace-nowrap">Cán bộ tiếp nhận</p>
                  {(profile?.role==="manager"||profile?.role==="admin")&&(
                    <Popover open={delegationOpen} onOpenChange={setDelegationOpen}>
                      <PopoverTrigger asChild><Button variant="ghost" size="sm" className="h-7 text-[11px] font-bold text-primary hover:bg-primary/5">Phân công</Button></PopoverTrigger>
                      <PopoverContent className="w-[260px] p-3 rounded-xl shadow-xl border-slate-200" align="end">
                        <div className="space-y-3">
                          <h4 className="font-bold text-[13px] text-slate-900">Phân công cho cán bộ</h4>
                          <Select value={selectedDelegate} onValueChange={setSelectedDelegate}>
                            <SelectTrigger className="w-full h-9 text-[12px] rounded-lg bg-slate-50 border-slate-200"><SelectValue placeholder="Chọn cán bộ..."/></SelectTrigger>
                            <SelectContent className="rounded-lg">{deptProfiles.map(p=><SelectItem key={p.id} value={p.id} className="text-[12px]">{p.full_name}</SelectItem>)}</SelectContent>
                          </Select>
                          <Button onClick={handleDelegate} disabled={saving} className="w-full h-9 rounded-lg text-[12px] bg-primary">Xác nhận</Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
                <div className="space-y-2">
                  {assignees.length>0?assignees.map(a=>(
                    <div key={a.user_id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <Avatar className="h-8 w-8"><AvatarImage src={a.profile?.avatar_url} className="object-cover"/><AvatarFallback className="bg-primary text-white text-[9px] font-bold">{a.profile?.full_name?.[0]}</AvatarFallback></Avatar>
                      <span className="text-xs font-bold text-slate-900">{a.profile?.full_name}</span>
                    </div>
                  )):(
                    <div className="p-4 bg-primary/5 rounded-xl border border-primary/10 text-center">
                      <p className="text-xs font-bold text-primary uppercase truncate">{task.department?.name||"PHÒNG NGHIỆP VỤ"}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="pt-4 border-t border-slate-50 grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-500 uppercase pl-1 truncate whitespace-nowrap">Hạn chót</p>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <AlertCircle className="w-3.5 h-3.5 text-primary"/>{new Date(task.due_date).toLocaleDateString("vi-VN")}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-500 uppercase pl-1 truncate whitespace-nowrap">Mức độ</p>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <Flag className={cn("w-3.5 h-3.5",task.priority==="high"?"text-red-500":"text-primary")}/>{task.priority==="high"?"KHẨN":"THƯỜNG"}
                </div>
              </div>
            </div>
            <div className="pt-6 border-t border-slate-50 space-y-3">
              <p className="text-xs font-bold text-slate-500 uppercase pl-1 truncate whitespace-nowrap">Khởi tạo bởi</p>
              <div className="flex items-center gap-3 px-1">
                <Avatar className="h-7 w-7 border border-white shadow-sm"><AvatarImage src={task.creator?.avatar_url} className="object-cover"/><AvatarFallback className="text-[8px] font-bold">{task.creator?.full_name?.[0]}</AvatarFallback></Avatar>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-900 leading-none">{task.creator?.full_name}</span>
                  <span className="text-[9px] font-medium text-slate-500">{task.creator?.departments?.name}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
