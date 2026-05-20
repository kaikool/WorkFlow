"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

const MS_PER_DAY = 24 * 60 * 60 * 1000

type DeadlineProgressProps = {
  createdAt?: string | null
  dueDate?: string | null
  done?: boolean
  compact?: boolean
  className?: string
}

type DeadlineTone = "safe" | "warning" | "danger" | "late" | "done" | "neutral"

function getDeadlineState(createdAt: string | null | undefined, dueDate: string | null | undefined, done: boolean | undefined, now: number) {
  const due = dueDate ? new Date(dueDate).getTime() : Number.NaN
  const created = createdAt ? new Date(createdAt).getTime() : Number.NaN

  if (!Number.isFinite(due)) {
    return {
      value: 0,
      tone: "neutral" as DeadlineTone,
      label: "Chưa có hạn",
      helper: "",
    }
  }

  const dueLabel = new Intl.DateTimeFormat("vi-VN").format(due)

  if (done) {
    return {
      value: 100,
      tone: "done" as DeadlineTone,
      label: "Đã nộp",
      helper: `Hạn ${dueLabel}`,
    }
  }

  const start = Number.isFinite(created) && created < due ? created : now
  const total = Math.max(due - start, MS_PER_DAY)
  const remaining = due - now
  const remainingRatio = Math.max(0, Math.min(1, remaining / total))
  const value = Math.round(remainingRatio * 100)

  if (remaining <= 0) {
    const lateDays = Math.ceil(Math.abs(remaining) / MS_PER_DAY)
    return {
      value: 100,
      tone: "late" as DeadlineTone,
      label: lateDays > 0 ? `Quá hạn ${lateDays} ngày` : "Quá hạn hôm nay",
      helper: `Hạn ${dueLabel}`,
    }
  }

  const remainingDays = Math.ceil(remaining / MS_PER_DAY)
  const tone: DeadlineTone = value <= 25 ? "danger" : value <= 50 ? "warning" : "safe"

  return {
    value: Math.max(value, 6),
    tone,
    label: remaining < MS_PER_DAY ? "Còn dưới 1 ngày" : `Còn ${remainingDays} ngày`,
    helper: `Hạn ${dueLabel}`,
  }
}

const fillClasses: Record<DeadlineTone, string> = {
  safe: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
  late: "bg-red-600",
  done: "bg-emerald-500",
  neutral: "bg-slate-300",
}

const textClasses: Record<DeadlineTone, string> = {
  safe: "text-emerald-700",
  warning: "text-amber-700",
  danger: "text-red-700",
  late: "text-red-700",
  done: "text-emerald-700",
  neutral: "text-slate-500",
}

export function DeadlineProgress({ createdAt, dueDate, done, compact = false, className }: DeadlineProgressProps) {
  const [now, setNow] = React.useState(() => Date.now())

  React.useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(intervalId)
  }, [])

  const state = getDeadlineState(createdAt, dueDate, done, now)

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-slate-500">
          {compact ? "Thời hạn" : "Thời gian đến hạn"}
        </span>
        <span className={cn("text-xs font-semibold", textClasses[state.tone])}>
          {state.label}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={compact ? "Tiến độ thời hạn" : "Thời gian đến hạn"}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={state.value}
        className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 shadow-inner"
      >
        <div
          className={cn("h-full rounded-full transition-all duration-700 ease-out", fillClasses[state.tone])}
          style={{ width: `${state.value}%` }}
        />
      </div>
      {!compact && state.helper && (
        <p className="text-xs font-medium text-slate-500">{state.helper}</p>
      )}
    </div>
  )
}
