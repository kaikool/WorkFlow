'use client'

export const dynamic = 'force-dynamic'

import React, { Suspense, useState } from 'react'
import { Plus, ListTodo, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TodoList } from './_components/todos/TodoList'
import { ReportList } from './_components/reports/ReportList'
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Link from 'next/link'
import PageHeader from '@/components/layout/PageHeader'
import { ListSkeleton } from '@/components/ui/list-skeleton'

function TasksContent() {
  const [viewMode, setViewMode] = useState('task')
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const searchQuery = searchParams.get('q') || '';
  const filterStatus = searchParams.get('status') || 'all';

  return (
    <div className="page-container space-y-6 md:space-y-8 animate-fade-in-up">
      <PageHeader
        title={viewMode === 'task' ? 'Công việc' : 'Yêu cầu báo cáo'}
        description="Quản trị & theo dõi tiến độ"
        action={
          <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground min-h-11 px-5 rounded-xl font-medium shadow-sm">
            <Link href="/dashboard/tasks/new">
              <Plus className="mr-2 h-4 w-4" />
              {viewMode === 'task' ? 'Giao việc' : 'Yêu cầu báo cáo'}
            </Link>
          </Button>
        }
      />

      <div className="w-full">
        <Tabs defaultValue="task" value={viewMode} onValueChange={(val) => {
          setViewMode(val);
          const params = new URLSearchParams();
          router.replace(`${pathname}?${params.toString()}`);
        }} className="w-full">
          <TabsList className="min-h-11">
            <TabsTrigger value="task" className="flex-1 rounded-lg py-1.5 font-semibold text-[13px] md:text-[14px] data-[state=active]:bg-white data-[state=active]:shadow-sm flex items-center justify-center transition-all active:scale-95">
              <ListTodo className="icon-sm mr-1.5" />
              <span>Công việc</span>
            </TabsTrigger>
            <TabsTrigger value="report" className="flex-1 rounded-lg py-1.5 font-semibold text-[13px] md:text-[14px] data-[state=active]:bg-white data-[state=active]:shadow-sm flex items-center justify-center transition-all active:scale-95">
              <FileText className="icon-sm mr-1.5" />
              <span>Báo cáo</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

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
    <Suspense fallback={<div className="page-container py-10"><ListSkeleton rows={5} /></div>}>
      <TasksContent />
    </Suspense>
  )
}
