'use client'

export const dynamic = 'force-dynamic'

import React, { Suspense, useState } from 'react'
import { Loader2, Plus, ListTodo, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TodoList } from './_components/todos/TodoList'
import { ReportList } from './_components/reports/ReportList'
import Link from 'next/link'

function TasksContent() {
  const [viewMode, setViewMode] = useState('task')

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-6 md:space-y-10 animate-fade-in-up pb-20">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 md:gap-6 pt-4 sm:pt-0">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
            {viewMode === 'task' ? 'Công việc' : 'Yêu cầu báo cáo'}
          </h1>
          <p className="text-[13px] text-slate-500 font-medium">Quản trị &amp; theo dõi tiến độ</p>
        </div>
        <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground h-10 px-5 rounded-xl font-medium">
          <Link href="/dashboard/tasks/new">
            <Plus className="mr-2 h-4 w-4" />
            {viewMode === 'task' ? 'Giao việc' : 'Yêu cầu báo cáo'}
          </Link>
        </Button>
      </div>

      <div className="px-4 sm:px-0">
        <Tabs defaultValue="task" value={viewMode} onValueChange={setViewMode} className="w-full max-w-sm">
          <TabsList className="grid w-full grid-cols-2 h-12 p-1 bg-slate-100 rounded-xl">
            <TabsTrigger value="task" className="rounded-lg text-sm font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <ListTodo className="w-3.5 h-3.5 mr-1.5" />Công việc
            </TabsTrigger>
            <TabsTrigger value="report" className="rounded-lg text-sm font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <FileText className="w-3.5 h-3.5 mr-1.5" />Báo cáo
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {viewMode === 'task' ? <TodoList /> : <ReportList />}
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
