'use client'

export const dynamic = 'force-dynamic'

import React, { Suspense, useState } from 'react'
import { Loader2, Plus, ListTodo, FileText, Search, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TodoList } from './_components/todos/TodoList'
import { ReportList } from './_components/reports/ReportList'
import Link from 'next/link'

function TasksContent() {
  const [viewMode, setViewMode] = useState('task')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-6 md:space-y-8 animate-fade-in-up pb-20">
      {/* Hàng 1: Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 md:gap-6 pt-4 sm:pt-0">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900">
            {viewMode === 'task' ? 'Công việc' : 'Yêu cầu báo cáo'}
          </h1>
          <p className="text-[13px] text-slate-500 font-medium">Quản trị &amp; theo dõi tiến độ</p>
        </div>
        <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground min-h-11 px-5 rounded-xl font-medium shadow-sm">
          <Link href="/dashboard/tasks/new">
            <Plus className="mr-2 h-4 w-4" />
            {viewMode === 'task' ? 'Giao việc' : 'Yêu cầu báo cáo'}
          </Link>
        </Button>
      </div>

      {/* Hàng 2: Tabs chuyển hướng chính - Đồng bộ 100% Với tabs lịch trình và tràn rộng hết chiều ngang */}
      <div className="w-full">
        <Tabs defaultValue="task" value={viewMode} onValueChange={(val) => { setViewMode(val); setSearchQuery(''); setFilterStatus('all'); }} className="w-full">
          <TabsList className="bg-slate-100/60 p-1 rounded-xl min-h-11 w-full flex gap-1">
            <TabsTrigger value="task" className="flex-1 rounded-lg py-1.5 font-semibold text-[13px] md:text-[14px] data-[state=active]:bg-white data-[state=active]:shadow-sm flex items-center justify-center transition-all active:scale-95">
              <ListTodo className="w-3.5 h-3.5 mr-1.5 shrink-0" />
              <span>Công việc</span>
            </TabsTrigger>
            <TabsTrigger value="report" className="flex-1 rounded-lg py-1.5 font-semibold text-[13px] md:text-[14px] data-[state=active]:bg-white data-[state=active]:shadow-sm flex items-center justify-center transition-all active:scale-95">
              <FileText className="w-3.5 h-3.5 mr-1.5 shrink-0" />
              <span>Báo cáo</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Hàng 3: Thanh công cụ phụ trợ (Search & Filter) - Gộp chung vào 1 Dòng duy nhất */}
      <div className="flex items-center gap-2 bg-slate-50/60 p-2 rounded-2xl border border-slate-100/80 shadow-sm w-full min-h-14">
        {/* Ô Tìm kiếm chiếm toàn bộ diện tích còn lại ở bên trái */}
        <div className="relative flex-1 group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 group-focus-within:text-primary transition-colors" />
          <Input
            placeholder={viewMode === 'task' ? "Tìm kiếm công việc..." : "Tìm kiếm báo cáo..."}
            className="w-full pl-9 pr-3 min-h-11 text-sm font-medium bg-white border-slate-200/60 rounded-xl focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary transition-all placeholder:text-xs"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Bộ lọc Trạng thái nằm gọn gàng bên phải */}
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-32 sm:w-44 min-h-11 bg-white border-slate-200/60 rounded-xl font-medium text-slate-600 px-3 hover:border-primary/30 transition-all text-sm justify-between shrink-0">
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-primary/60 shrink-0" />
              <span className="truncate"><SelectValue placeholder="Trạng thái" /></span>
            </div>
          </SelectTrigger>
          <SelectContent className="rounded-xl border-none shadow-premium-hover p-1">
            <SelectItem value="all" className="rounded-lg py-2 text-sm font-medium">Tất cả</SelectItem>
            <SelectItem value="todo" className="rounded-lg py-2 text-sm font-medium">Đang chờ</SelectItem>
            {viewMode === 'task' && <SelectItem value="doing" className="rounded-lg py-2 text-sm font-medium">Đang làm</SelectItem>}
            <SelectItem value="done" className="rounded-lg py-2 text-sm font-medium">Hoàn thành</SelectItem>
            <SelectItem value="late" className="rounded-lg py-2 text-sm font-medium text-red-600">Trễ hạn</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Danh sách nội dung */}
      {viewMode === 'task' ? (
        <TodoList searchQuery={searchQuery} filterStatus={filterStatus} />
      ) : (
        <ReportList searchQuery={searchQuery} filterStatus={filterStatus} />
      )}
    </div>
  )
}

export default function TasksPage() {
  return (
    <Suspense fallback={<div className="flex h-96 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
      <TasksContent />
    </Suspense>
  )
}
