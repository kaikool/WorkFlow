'use client'

export const dynamic = 'force-dynamic'

import { Suspense, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { TodoDetail } from '../_components/todos/TodoDetail'
import { ReportDetail } from '../_components/reports/ReportDetail'

function TaskRouter() {
  const { id } = useParams<{ id: string }>()
  const [taskType, setTaskType] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase.from('tasks').select('task_type').eq('id', id).single()
      .then(({ data }: any) => setTaskType(data?.task_type ?? 'regular'))
  }, [id])

  if (!taskType) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
  if (taskType === 'report') return <ReportDetail id={id} />
  return <TodoDetail id={id} />
}

export default function TaskDetailPage() {
  return (
    <Suspense fallback={<div className="flex h-96 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
      <TaskRouter />
    </Suspense>
  )
}
