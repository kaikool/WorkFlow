'use client'

import React, { useState } from 'react'
import { ChevronLeft, ListTodo, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { NewTodoForm } from '../_components/todos/NewTodoForm'
import { NewReportForm } from '../_components/reports/NewReportForm'
import Link from 'next/link'

export default function NewTaskPage() {
  const [formType, setFormType] = useState('task')

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-10 animate-fade-in-up pb-20">
      <div className="flex items-center justify-between mb-6 pt-4 sm:pt-0">
        <Button variant="ghost" asChild className="p-0 hover:bg-transparent text-slate-500 hover:text-slate-900 transition-colors">
          <Link href="/dashboard/tasks" className="flex items-center gap-2">
            <ChevronLeft className="w-4 h-4" />
            <span className="text-[13px] font-medium">Quay lại</span>
          </Link>
        </Button>
      </div>

      <div className="px-4 sm:px-0 mb-6">
        <Tabs defaultValue="task" value={formType} onValueChange={setFormType} className="w-full max-w-sm">
          <TabsList className="grid grid-cols-2 min-h-11">
            <TabsTrigger value="task" className="rounded-lg text-sm font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm flex items-center justify-center">
              <ListTodo className="w-3.5 h-3.5 mr-1.5 shrink-0" />
              <span className="hidden sm:inline">Giao Công Việc</span>
              <span className="inline sm:hidden">Giao việc</span>
            </TabsTrigger>
            <TabsTrigger value="report" className="rounded-lg text-sm font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm flex items-center justify-center">
              <FileText className="w-3.5 h-3.5 mr-1.5 shrink-0" />
              <span className="hidden sm:inline">Yêu Cầu Báo Cáo</span>
              <span className="inline sm:hidden">Báo cáo</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {formType === 'task' ? <NewTodoForm /> : <NewReportForm />}
    </div>
  )
}
