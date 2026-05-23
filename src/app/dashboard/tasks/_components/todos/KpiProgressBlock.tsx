'use client'

import React from 'react'
import { CheckCircle2, Loader2, Minus, Plus as PlusIcon, Target, TrendingUp, Zap } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

interface Props {
  task: any
  profile: any
  assignees: any[]
  canEdit: boolean
  isLeader: boolean
  saving: boolean
  displayProgress: number
  currentValue: string
  setCurrentValue: (v: string) => void
  adjustValue: (delta: number) => void
  handleUpdateAchievement: () => void
  handleLeaderUpdateContribution: (userId: string, val: number) => void
  handleGeneralAdjustment: (delta: number) => void
}

export function KpiProgressBlock({
  task, profile, assignees, canEdit, isLeader, saving, displayProgress,
  currentValue, setCurrentValue, adjustValue,
  handleUpdateAchievement, handleLeaderUpdateContribution, handleGeneralAdjustment,
}: Props) {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-sm font-medium text-slate-500 flex items-center gap-2"><Target className="w-3 h-3" />Mục tiêu cần đạt</p>
          <p className="text-2xl font-bold text-slate-900 tabular-nums">{task.target_value?.toLocaleString("vi-VN")} <span className="text-xs text-slate-500">{task.unit}</span></p>
        </div>
        <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 shadow-sm">
          <p className="text-sm font-medium text-primary flex items-center gap-2"><Zap className="w-3 h-3" />Thực tế ghi nhận</p>
          <p className="text-2xl font-bold text-primary tabular-nums">{(task.current_value || 0).toLocaleString("vi-VN")} <span className="text-xs opacity-60">{task.unit}</span></p>
        </div>
      </div>
      <Progress value={Math.min(100, displayProgress)} className="h-2 bg-slate-50 shadow-inner" />
      {canEdit && (
        <div className="pt-6 border-t border-slate-50 space-y-4">
          <p className="text-sm font-medium text-primary">Cá nhân tôi đóng góp</p>
          <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center">
            <div className="flex items-center gap-2 bg-primary/5 p-1.5 rounded-xl border border-primary/10 w-full md:max-w-xs">
              <Button type="button" variant="ghost" onClick={() => adjustValue(-1)} className="h-11 w-11 rounded-xl hover:bg-white text-primary active:scale-95 transition-all"><Minus className="w-4 h-4" /></Button>
              <Input type="number" value={currentValue} onChange={e => setCurrentValue(e.target.value)} className="min-h-11 bg-transparent border-none shadow-none text-center font-bold text-xl px-2 focus-visible:ring-0 text-primary" />
              <Button type="button" variant="ghost" onClick={() => adjustValue(1)} className="h-11 w-11 rounded-xl hover:bg-white text-primary active:scale-95 transition-all"><PlusIcon className="w-4 h-4" /></Button>
            </div>
            <Button onClick={handleUpdateAchievement} disabled={saving} className="bg-primary hover:bg-primary/90 min-h-11 px-5 rounded-xl font-medium w-full md:w-auto active:scale-95 transition-all">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-2" />}Cập nhật đóng góp
            </Button>
          </div>
        </div>
      )}
      <div className="pt-6 border-t border-slate-50 space-y-4">
        <h4 className="text-sm font-medium text-slate-500">Tổng hợp đóng góp thực tế</h4>
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
          {assignees.map((a, idx) => {
            const contrib = task.metadata?.contributions?.[a.user_id] || 0
            const weight = task.current_value > 0 ? Math.min(100, Math.round((contrib / task.current_value) * 100)) : 0
            return (
              <div key={a.user_id} className={cn("flex flex-col p-4 sm:p-5 gap-3", idx !== 0 && "border-t border-slate-50", a.user_id === profile?.id && "bg-primary/[0.02]")}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Avatar className="h-8 w-8 shrink-0 border border-white shadow-sm ring-1 ring-slate-100">
                      <AvatarImage src={a.profile?.avatar_url} className="object-cover" />
                      <AvatarFallback className="text-sm font-medium bg-slate-100 text-slate-500">{a.profile?.full_name?.[0]}</AvatarFallback>
                    </Avatar>
                    <span className={cn("text-sm font-medium truncate", a.user_id === profile?.id ? "text-primary" : "text-slate-700")}>{a.profile?.full_name}</span>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    {isLeader ? (
                      <div className="relative max-w-[110px]">
                        <Input type="number" value={contrib} onChange={e => handleLeaderUpdateContribution(a.user_id, parseInt(e.target.value) || 0)} className="w-full min-h-11 md:min-h-10 bg-slate-50/50 border border-slate-100 rounded-lg text-right text-base md:text-sm font-medium px-2 pr-14 focus:bg-white focus:border-primary/30 [appearance:textfield]" />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500 pointer-events-none truncate max-w-[45px]">{task.unit}</span>
                      </div>
                    ) : (
                      <p className="font-bold text-slate-900 text-xs">{contrib.toLocaleString("vi-VN")} <span className="text-xs text-slate-500">{task.unit}</span></p>
                    )}
                    <span className="text-sm font-medium text-primary min-w-[30px] text-right">{weight}%</span>
                  </div>
                </div>
                <div className="w-full h-1.5 bg-slate-50 rounded-full overflow-hidden shadow-inner">
                  <div className="h-full bg-primary/40 transition-all duration-1000 rounded-full" style={{ width: `${weight}%` }} />
                </div>
              </div>
            )
          })}
          {isLeader && (
            <div className="bg-slate-50/50 border-t border-slate-100 p-4 sm:p-5 flex items-center justify-between">
              <span className="text-xs font-medium text-primary/60 flex items-center gap-2"><TrendingUp className="w-4 h-4" />Hiệu chỉnh phòng</span>
              <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200/60 shadow-sm">
                <Button variant="ghost" size="icon" className="h-11 w-11 rounded-xl text-primary hover:bg-primary/5" onClick={() => handleGeneralAdjustment(-1)}><Minus className="w-4 h-4" /></Button>
                <span className="min-w-[40px] text-center font-medium text-sm text-slate-900">{(task.metadata?.general_adjustment || 0).toLocaleString("vi-VN")}</span>
                <Button variant="ghost" size="icon" className="h-11 w-11 rounded-xl text-primary hover:bg-primary/5" onClick={() => handleGeneralAdjustment(1)}><PlusIcon className="w-4 h-4" /></Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
