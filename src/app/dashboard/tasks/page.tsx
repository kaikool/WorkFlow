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
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Link from 'next/link'

function TasksContent() {
  const [viewMode, setViewMode] = useState('task')
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const searchQuery = searchParams.get('q') || '';
  const filterStatus = searchParams.get('status') || 'all';

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-6 md:space-y-8 animate-fade-in-up pb-20">
      {/* Hàng 1: Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 md:gap-6 pt-4 sm:pt-0">
        <div className="hidden lg:block space-y-1">
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

      <div className="w-full">
        <Tabs defaultValue="task" value={viewMode} onValueChange={(val) => { 
          setViewMode(val); 
          const params = new URLSearchParams(); // Reset all query params
          router.replace(`${pathname}?${params.toString()}`);
        }} className="w-full">
          <TabsList className="min-h-11">
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
